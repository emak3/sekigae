/**
 * フッター管理クラス
 * フッターの動的更新と機能を管理
 */
class FooterManager {
    constructor(socketManager, uiManager) {
        this.socketManager = socketManager;
        this.uiManager = uiManager;
        this.elements = {};
        this.lastUpdateTime = null;
        this.isInitialized = false;
        
        this.initializeElements();
        this.setupEventHandlers();
        this.startUpdateInterval();
    }

    /**
     * DOM要素の初期化
     */
    initializeElements() {
        this.elements = {
            version: document.getElementById('footerVersion'),
            connection: document.getElementById('footerConnection'),
            connectionText: document.getElementById('footerConnectionText'),
            studentCount: document.getElementById('footerStudentCount'),
            seatCount: document.getElementById('footerSeatCount'),
            lastUpdate: document.getElementById('footerLastUpdate'),
            buildDate: document.getElementById('footerBuildDate'),
            roomId: document.getElementById('footerRoomId'),
            stats: document.getElementById('footerStats')
        };

        console.log('📄 FooterManager DOM要素を初期化しました');
    }

    /**
     * イベントハンドラーの設定
     */
    setupEventHandlers() {
        if (this.socketManager) {
            this.socketManager.on('connected', () => {
                this.updateConnectionStatus(true);
            });

            this.socketManager.on('disconnected', () => {
                this.updateConnectionStatus(false);
            });

            this.socketManager.on('localModeEnabled', () => {
                this.updateConnectionStatus(false, 'ローカル');
            });

            this.socketManager.on('roomData', (data) => {
                this.updateStats(data);
            });

            this.socketManager.on('studentsUpdated', (students) => {
                this.updateStudentCount(students.length);
            });

            this.socketManager.on('gridConfigUpdated', (config) => {
                this.updateSeatCount(config);
            });
        }

        console.log('📄 FooterManager イベントハンドラーを設定しました');
    }

    /**
     * 初期化完了処理
     */
    initialize() {
        this.updateBuildInfo();
        this.updateVersion();
        this.updateRoomId();
        this.updateConnectionStatus(false);
        
        this.isInitialized = true;
        console.log('📄 FooterManager 初期化完了');
    }

    /**
     * バージョン情報の更新
     */
    updateVersion() {
        if (this.elements.version) {
            const version = window.app?.version || '2.0.0';
            this.elements.version.textContent = `v${version}`;
        }
    }

    /**
     * ビルド情報の更新
     */
    updateBuildInfo() {
        if (this.elements.buildDate) {
            const buildDate = new Date().toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            this.elements.buildDate.textContent = buildDate;
        }
    }

    /**
     * 部屋ID表示の更新
     */
    updateRoomId() {
        if (this.elements.roomId && this.socketManager) {
            const roomId = this.socketManager.roomId || 'default';
            this.elements.roomId.textContent = roomId;
        }
    }

    /**
     * 接続状態の更新
     */
    updateConnectionStatus(isConnected, customText = null) {
        if (!this.elements.connection || !this.elements.connectionText) return;

        const connection = this.elements.connection;
        const text = this.elements.connectionText;

        // CSSクラスをリセット
        connection.classList.remove('online', 'offline');

        if (isConnected) {
            connection.classList.add('online');
            connection.querySelector('i').className = 'fas fa-wifi';
            text.textContent = customText || 'オンライン';
        } else {
            connection.classList.add('offline');
            connection.querySelector('i').className = 'fas fa-wifi-slash';
            text.textContent = customText || 'オフライン';
        }

        console.log(`📄 接続状態を更新: ${isConnected ? 'オンライン' : 'オフライン'}`);
    }

    /**
     * 統計情報の更新
     */
    updateStats(data) {
        if (data) {
            if (data.students) {
                this.updateStudentCount(data.students.length);
            }
            
            if (data.gridConfig) {
                this.updateSeatCount(data.gridConfig);
            }
            
            this.updateLastUpdateTime();
        }
    }

    /**
     * 生徒数の更新
     */
    updateStudentCount(count) {
        if (this.elements.studentCount) {
            this.elements.studentCount.textContent = count || 0;
        }
    }

    /**
     * 座席数の更新
     */
    updateSeatCount(gridConfig) {
        if (this.elements.seatCount && gridConfig) {
            const totalSeats = gridConfig.rows * gridConfig.cols;
            const disabledSeats = gridConfig.disabledSeats ? gridConfig.disabledSeats.length : 0;
            const availableSeats = totalSeats - disabledSeats;
            
            this.elements.seatCount.textContent = availableSeats;
        }
    }

    /**
     * 最終更新時刻の更新
     */
    updateLastUpdateTime() {
        if (this.elements.lastUpdate) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            this.elements.lastUpdate.textContent = timeString;
            this.lastUpdateTime = now;
        }
    }

    /**
     * 定期更新の開始
     */
    startUpdateInterval() {
        // 1分ごとに最終更新時刻を相対表示に更新
        setInterval(() => {
            this.updateRelativeTime();
        }, 60000);

        // 10秒ごとに統計情報を更新
        setInterval(() => {
            this.updateCurrentStats();
        }, 10000);
    }

    /**
     * 相対時間表示の更新
     */
    updateRelativeTime() {
        if (!this.lastUpdateTime || !this.elements.lastUpdate) return;

        const now = new Date();
        const diffMinutes = Math.floor((now - this.lastUpdateTime) / (1000 * 60));

        if (diffMinutes < 1) {
            this.elements.lastUpdate.textContent = '今';
        } else if (diffMinutes < 60) {
            this.elements.lastUpdate.textContent = `${diffMinutes}分前`;
        } else {
            const diffHours = Math.floor(diffMinutes / 60);
            this.elements.lastUpdate.textContent = `${diffHours}時間前`;
        }
    }

    /**
     * 現在の統計情報を更新
     */
    updateCurrentStats() {
        if (!this.isInitialized) return;

        try {
            // UIManagerから現在の生徒数を取得
            if (this.uiManager) {
                const students = this.uiManager.getStudents();
                this.updateStudentCount(students.length);
            }

            // SeatManagerから座席情報を取得
            if (window.seatManager) {
                const gridConfig = window.seatManager.getGridConfig();
                this.updateSeatCount(gridConfig);
            }

            // 部屋IDを更新
            this.updateRoomId();

        } catch (error) {
            console.warn('📄 統計情報の更新中にエラー:', error);
        }
    }

    /**
     * フッターの表示/非表示切り替え
     */
    toggle(show = null) {
        const footer = document.querySelector('.app-footer');
        if (!footer) return;

        if (show === null) {
            footer.style.display = footer.style.display === 'none' ? '' : 'none';
        } else {
            footer.style.display = show ? '' : 'none';
        }
    }

    /**
     * アニメーション効果の追加
     */
    addPulseEffect(elementName, duration = 2000) {
        const element = this.elements[elementName];
        if (!element) return;

        element.classList.add('footer-pulse');
        
        setTimeout(() => {
            element.classList.remove('footer-pulse');
        }, duration);
    }

    /**
     * エラー状態の表示
     */
    showError(message) {
        if (this.elements.connectionText) {
            const originalText = this.elements.connectionText.textContent;
            
            this.elements.connectionText.textContent = 'エラー';
            this.elements.connection.classList.add('offline');
            
            setTimeout(() => {
                this.elements.connectionText.textContent = originalText;
            }, 3000);
        }
    }

    /**
     * 成功状態の表示
     */
    showSuccess(message) {
        this.addPulseEffect('connection', 1000);
    }

    /**
     * ステータス情報の取得
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            lastUpdateTime: this.lastUpdateTime,
            currentStats: {
                studentCount: this.elements.studentCount?.textContent,
                seatCount: this.elements.seatCount?.textContent,
                roomId: this.elements.roomId?.textContent,
                connectionStatus: this.elements.connectionText?.textContent
            }
        };
    }

    /**
     * デバッグ情報の出力
     */
    debug() {
        console.group('📄 FooterManager デバッグ情報');
        console.log('初期化状態:', this.isInitialized);
        console.log('要素:', this.elements);
        console.log('最終更新:', this.lastUpdateTime);
        console.log('現在のステータス:', this.getStatus());
        console.groupEnd();
    }
}

// フッター関連のグローバル関数
window.showHelp = function() {
    if (window.uiManager) {
        window.uiManager.showMessage(`わからなかったら聞いて`.trim(), 'info');
    }
};

window.showKeyboardShortcuts = function() {
    const shortcuts = [
        'Ctrl+1: 希望席選択タブ',
        'Ctrl+2: 生徒管理タブ', 
        'Ctrl+3: 席割り当てタブ',
        'Ctrl+4: 設定タブ',
        'Esc: メッセージクリア',
        'Enter: フォーム送信（名前入力時）'
    ];
    
    if (window.uiManager) {
        window.uiManager.showMessage(
            'キーボードショートカット:\n' + shortcuts.join('\n'),
            'info'
        );
    }
};

window.exportData = function() {
    try {
        const data = {
            timestamp: new Date().toISOString(),
            students: window.uiManager?.getStudents() || [],
            gridConfig: window.seatManager?.getGridConfig() || {},
            attendanceSettings: window.attendanceManager?.getSettings() || {},
            appVersion: window.app?.version || '2.0.0'
        };
        
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `seat-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (window.uiManager) {
            window.uiManager.showMessage('データをエクスポートしました', 'success');
        }
    } catch (error) {
        console.error('エクスポートエラー:', error);
        if (window.uiManager) {
            window.uiManager.showMessage('エクスポートに失敗しました', 'error');
        }
    }
};

window.showAbout = function() {
    const about = `個人作成なのでバグを見つけたら教えて。`.trim();
    
    if (window.uiManager) {
        window.uiManager.showMessage(about, 'info');
    }
};

// グローバルに公開
window.FooterManager = FooterManager;

console.log('📄 FooterManager クラスが読み込まれました');