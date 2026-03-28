/**
 * メインアプリケーション
 * 各管理クラスを統合し、アプリケーション全体を制御
 */
class SeatSimulatorApp {
    constructor() {
        this.configManager = null;
        this.socketManager = null;
        this.seatManager = null;
        this.attendanceManager = null;
        this.uiManager = null;
        this.footerManager = null;
        this.isInitialized = false;
        this.version = '2.0.0';
    }

    /**
     * アプリケーションの初期化
     */
    async initialize() {
        try {
            console.log(`🎯 席替えシミュレーター v${this.version} 初期化開始`);

            // 認証チェックを最初に実行
            await this.waitForAuthSystem();

            // 初期化順序は重要
            await this.initializeConfigManager();
            await this.initializeSocketManager();
            await this.initializeSeatManager();
            await this.initializeAttendanceManager();
            await this.initializeUIManager();
            await this.initializeFooterManager();

            // グローバル参照の設定
            this.setupGlobalReferences();

            // 初期化完了
            this.isInitialized = true;
            console.log('✅ 席替えシミュレーター初期化完了');

            // 初期化完了通知
            this.onInitializationComplete();

        } catch (error) {
            console.error('❌ アプリケーション初期化エラー:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * 認証システムの準備を待つ
     */
    async waitForAuthSystem() {
        console.log('🔐 認証システムの準備を待機中...');

        // authManagerが準備されるまで待つ
        let attempts = 0;
        const maxAttempts = 50; // 5秒間待機

        while (!window.authManager && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!window.authManager) {
            throw new Error('認証システムの初期化に失敗しました');
        }

        console.log('✅ 認証システムが準備されました');
    }

    /**
     * Config Manager の初期化
     */
    async initializeConfigManager() {
        console.log('⚙️ ConfigManager初期化中...');

        this.configManager = new ConfigManager();

        // 設定の妥当性チェック
        const validation = this.configManager.validateConfig();
        if (!validation.valid) {
            console.warn('設定に問題があります:', validation.errors);
            // 問題があっても続行（自動修復される）
        }

        console.log('✅ ConfigManager初期化完了');
    }

    /**
     * Socket Manager の初期化
     */
    async initializeSocketManager() {
        console.log('🔌 SocketManager初期化中...');

        this.socketManager = new SocketManager();
        await this.socketManager.initialize();

        // 認証された部屋IDで確実に接続
        setTimeout(() => {
            this.socketManager.updateRoomId();
        }, 500);

        console.log('✅ SocketManager初期化完了');
    }

    /**
     * Seat Manager の初期化
     */
    async initializeSeatManager() {
        console.log('🪑 SeatManager初期化中...');

        this.seatManager = new SeatManager(this.socketManager);

        // 設定から初期グリッド設定を読み込み
        const gridConfig = this.configManager.getGridConfig();
        this.seatManager.gridConfig = gridConfig;

        // 初期グリッドを強制的に描画
        console.log('デフォルトグリッドを描画中...', gridConfig);
        setTimeout(() => {
            this.seatManager.renderAllGrids();
        }, 200);

        console.log('✅ SeatManager初期化完了');
    }

    /**
     * Attendance Manager の初期化
     */
    async initializeAttendanceManager() {
        console.log('📋 AttendanceManager初期化中...');

        this.attendanceManager = new AttendanceManager(this.socketManager);

        // 設定から初期出席番号設定を読み込み
        const attendanceConfig = this.configManager.getAttendanceConfig();
        this.attendanceManager.settings = attendanceConfig;

        console.log('✅ AttendanceManager初期化完了');
    }

    /**
     * UI Manager の初期化
     */
    async initializeUIManager() {
        console.log('🎨 UIManager初期化中...');

        this.uiManager = new UIManager(this.socketManager, this.seatManager);

        // 初期化完了通知
        this.uiManager.onInitialized();

        console.log('✅ UIManager初期化完了');
    }

    /**
     * Footer Manager の初期化
     */
    async initializeFooterManager() {
        console.log('📄 FooterManager初期化中...');

        this.footerManager = new FooterManager(this.socketManager, this.uiManager);

        // 初期化完了通知
        this.footerManager.initialize();

        console.log('✅ FooterManager初期化完了');
    }

    /**
     * グローバル参照の設定
     */
    setupGlobalReferences() {
        // デバッグやコンソールからのアクセス用
        window.app = this;
        window.configManager = this.configManager;
        window.socketManager = this.socketManager;
        window.seatManager = this.seatManager;
        window.attendanceManager = this.attendanceManager;
        window.uiManager = this.uiManager;
        window.footerManager = this.footerManager;
        window.selectionStateManager = null;

        // ユーティリティクラスの確認
        if (typeof Utils !== 'undefined') {
            console.log('✅ ユーティリティライブラリが利用可能です');
        } else {
            console.warn('⚠️ ユーティリティライブラリが見つかりません');
        }
    }

    /**
     * 初期化完了時の処理
     */
    onInitializationComplete() {
        // パフォーマンス測定
        if (window.performance && window.performance.mark) {
            window.performance.mark('app-initialization-complete');
        }

        // 初期化完了イベントの発火
        const event = new CustomEvent('appInitialized', {
            detail: {
                timestamp: Date.now(),
                version: this.version,
                features: {
                    configManager: !!this.configManager,
                    socketManager: !!this.socketManager,
                    seatManager: !!this.seatManager,
                    attendanceManager: !!this.attendanceManager,
                    uiManager: !!this.uiManager,
                    footerManager: !!this.footerManager
                }
            }
        });
        document.dispatchEvent(event);

        // 設定の同期
        this.syncConfigurations();

        // サービスワーカーの登録（将来の機能拡張用）
        this.registerServiceWorker();

        // 初期化成功メッセージ
        if (this.uiManager) {
            this.uiManager.showMessage('アプリケーションが正常に初期化されました', 'success');
        }
    }

    /**
     * 設定の同期
     */
    syncConfigurations() {
        try {
            // グリッド設定の同期
            const gridConfig = this.configManager.getGridConfig();
            if (this.seatManager) {
                this.seatManager.gridConfig = gridConfig;
            }

            // 出席番号設定の同期
            const attendanceConfig = this.configManager.getAttendanceConfig();
            if (this.attendanceManager) {
                this.attendanceManager.settings = attendanceConfig;
            }

            console.log('⚙️ 設定の同期が完了しました');

        } catch (error) {
            console.error('⚠️ 設定の同期中にエラーが発生しました:', error);
        }
    }

    /**
     * 初期化エラーの処理
     */
    handleInitializationError(error) {
        console.error('💥 アプリケーション初期化に失敗しました:', error);

        // ユーザーにエラーを表示
        const errorElement = document.createElement('div');
        errorElement.className = 'initialization-error';
        errorElement.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>アプリケーションの初期化に失敗しました</h3>
                <p>ページを再読み込みしてください。問題が続く場合は、ブラウザのキャッシュをクリアしてみてください。</p>
                <div class="error-details">
                    <details>
                        <summary>エラー詳細</summary>
                        <pre>${error.message}</pre>
                    </details>
                </div>
                <div class="error-actions">
                    <button onclick="window.location.reload()" class="btn-primary">
                        <i class="fas fa-redo"></i>
                        ページを再読み込み
                    </button>
                    <button onclick="app.resetToDefaults()" class="btn-secondary">
                        <i class="fas fa-trash"></i>
                        設定をリセット
                    </button>
                </div>
            </div>
        `;

        // エラー表示のスタイル
        errorElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            color: white;
            text-align: center;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        const errorContent = errorElement.querySelector('.error-content');
        errorContent.style.cssText = `
            background-color: #1e293b;
            padding: 2rem;
            border-radius: 1rem;
            max-width: 500px;
            margin: 1rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        `;

        document.body.appendChild(errorElement);
    }

    /**
     * 設定をデフォルトにリセット
     */
    resetToDefaults() {
        try {
            if (this.configManager) {
                this.configManager.reset();
            }

            // ローカルストレージをクリア
            if (typeof StorageUtils !== 'undefined') {
                StorageUtils.clear();
            } else {
                localStorage.clear();
            }

            // ページをリロード
            window.location.reload();

        } catch (error) {
            console.error('設定リセットエラー:', error);
            alert('設定のリセットに失敗しました。手動でブラウザのキャッシュをクリアしてください。');
        }
    }

    /**
     * サービスワーカーの登録
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // 本番環境でのみサービスワーカーを登録
                if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
                    console.log('🔧 サービスワーカーの登録をスキップします（開発環境）');
                }
            } catch (error) {
                console.log('⚠️ サービスワーカーの登録に失敗しました:', error);
            }
        }
    }

    /**
     * アプリケーションの状態を取得
     */
    getStatus() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            timestamp: Date.now(),
            components: {
                configManager: !!this.configManager,
                socketManager: !!this.socketManager,
                seatManager: !!this.seatManager,
                attendanceManager: !!this.attendanceManager,
                uiManager: !!this.uiManager,
                footerManager: !!this.footerManager,
                selectionStateManager: !!window.selectionStateManager
            },
            socket: this.socketManager?.getConnectionStatus(),
            currentTab: this.uiManager?.getCurrentTab(),
            studentsCount: this.uiManager?.getStudents()?.length || 0,
            gridConfig: this.seatManager?.getGridConfig(),
            attendanceConfig: this.attendanceManager?.getSettings(),
            capacity: this.configManager?.checkCapacityConsistency(),
            selectionState: window.selectionStateManager?.getCurrentSelection()
        };
    }

    /**
     * アプリケーションのクリーンアップ
     */
    cleanup() {
        console.log('🧹 アプリケーションをクリーンアップ中...');

        try {
            // 【新規追加】SelectionStateManagerのクリーンアップ
            if (window.selectionStateManager) {
                window.selectionStateManager.cleanup();
                delete window.selectionStateManager;
            }

            // Socket接続の切断
            if (this.socketManager) {
                this.socketManager.disconnect();
            }

            // 設定の保存
            if (this.configManager) {
                this.configManager.saveUserSettings();
            }

            // イベントリスナーの削除
            this.removeEventListeners();

            // グローバル参照のクリア
            delete window.app;
            delete window.configManager;
            delete window.socketManager;
            delete window.seatManager;
            delete window.attendanceManager;
            delete window.uiManager;
            delete window.footerManager;

            console.log('✅ アプリケーションのクリーンアップ完了');

        } catch (error) {
            console.error('⚠️ クリーンアップエラー:', error);
        }
    }

    /**
     * イベントリスナーの削除
     */
    removeEventListeners() {
        // ページ離脱時のイベントリスナーを削除
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('unload', this.handleUnload);
        window.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    /**
     * ページ離脱前の処理
     */
    handleBeforeUnload = (event) => {
        // 重要なデータがある場合の離脱確認
        const students = this.uiManager?.getStudents();
        if (students && students.length > 0) {
            const message = '登録された生徒データがあります。ページを離れてもよろしいですか？';
            event.returnValue = message;
            return message;
        }
    }

    /**
     * ページ離脱時の処理
     */
    handleUnload = () => {
        this.cleanup();
    }

    /**
     * ページの表示/非表示切り替え時の処理
     */
    handleVisibilityChange = () => {
        if (document.hidden) {
            // ページが非表示になった時
            console.log('📱 ページが非表示になりました');
        } else {
            // ページが表示された時
            console.log('📱 ページが表示されました');
            // 接続状態を確認
            if (this.socketManager && !this.socketManager.isConnected) {
                console.log('🔄 再接続を試行中...');
                // 必要に応じて再接続処理
            }
        }
    }

    /**
     * デバッグ情報の出力
     */
    debug() {
        const status = this.getStatus();
        console.group('🎯 席替えシミュレーター デバッグ情報');
        console.log('📊 アプリケーション状態:', status);
        console.log('🔌 Socket接続状態:', status.socket);
        console.log('📝 生徒数:', status.studentsCount);
        console.log('⚙️ グリッド設定:', status.gridConfig);
        console.log('📋 出席番号設定:', status.attendanceConfig);
        console.log('📱 現在のタブ:', status.currentTab);
        console.log('💾 容量整合性:', status.capacity);

        // 設定の詳細デバッグ
        if (this.configManager) {
            this.configManager.debug();
        }

        console.groupEnd();

        return status;
    }

    /**
     * パフォーマンス情報の取得
     */
    getPerformanceInfo() {
        if (!window.performance) {
            return { supported: false };
        }

        const navigation = window.performance.getEntriesByType('navigation')[0];
        const marks = window.performance.getEntriesByType('mark');

        return {
            supported: true,
            loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : null,
            domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : null,
            marks: marks.map(mark => ({ name: mark.name, startTime: mark.startTime })),
            memory: window.performance.memory ? {
                used: window.performance.memory.usedJSHeapSize,
                total: window.performance.memory.totalJSHeapSize,
                limit: window.performance.memory.jsHeapSizeLimit
            } : null
        };
    }
}

/**
 * アプリケーションの起動
 */
async function startApp() {
    // DOM読み込み完了を待つ
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }

    // アプリケーションインスタンスを作成・初期化
    const app = new SeatSimulatorApp();

    // ページ離脱時のイベントリスナーを設定
    window.addEventListener('beforeunload', app.handleBeforeUnload);
    window.addEventListener('unload', app.handleUnload);
    window.addEventListener('visibilitychange', app.handleVisibilityChange);

    // 初期化開始
    await app.initialize();

    return app;
}

/**
 * エラーハンドリング
 */
window.addEventListener('error', (event) => {
    console.error('💥 未処理のエラー:', event.error);

    // 重要なエラーの場合はユーザーに通知
    if (window.uiManager && event.error &&
        !event.error.toString().includes('ResizeObserver') &&
        !event.error.toString().includes('Non-Error promise rejection')) {
        window.uiManager.showMessage(
            'アプリケーションでエラーが発生しました。ページを再読み込みしてください。',
            'error'
        );
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('💥 未処理のPromise拒否:', event.reason);

    // Socket.io関連のエラーは通常の動作なので無視
    if (event.reason && (
        event.reason.toString().includes('socket.io') ||
        event.reason.toString().includes('timeout')
    )) {
        event.preventDefault();
        return;
    }

    if (window.uiManager) {
        window.uiManager.showMessage(
            '通信エラーが発生しました。接続状況を確認してください。',
            'warning'
        );
    }
});

/**
 * デバッグ用ヘルパー関数
 */
window.debugApp = () => {
    if (window.app) {
        return window.app.debug();
    } else {
        console.log('⚠️ アプリケーションがまだ初期化されていません');
        return null;
    }
};

window.getAppStatus = () => {
    if (window.app) {
        return window.app.getStatus();
    } else {
        return { error: 'アプリケーション未初期化' };
    }
};

window.getPerformanceInfo = () => {
    if (window.app) {
        return window.app.getPerformanceInfo();
    } else {
        return { error: 'アプリケーション未初期化' };
    }
};

// アプリケーション開始
startApp().catch(error => {
    console.error('💥 アプリケーションの開始に失敗しました:', error);

    // フォールバック: 最小限のエラー表示
    document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui;">
            <div style="text-align: center; padding: 2rem; background: #f8fafc; border-radius: 1rem; border: 1px solid #e2e8f0;">
                <h2 style="color: #dc2626; margin-bottom: 1rem;">⚠️ 初期化エラー</h2>
                <p style="margin-bottom: 1rem;">アプリケーションの初期化に失敗しました。</p>
                <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                    ページを再読み込み
                </button>
            </div>
        </div>
    `;
});