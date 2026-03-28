/**
 * 管理者設定管理クラス
 * 学籍番号による管理者権限の設定と管理
 */
class AdminConfig {
    constructor() {
        this.adminNumbers = this.loadAdminNumbers();

        // DOM読み込み完了後にUIをセットアップ
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupUI();
            });
        } else {
            // 少し遅延してからセットアップ（他のコンポーネントが先に初期化されるため）
            setTimeout(() => this.setupUI(), 500);
        }
    }

    /**
     * 管理者番号リストを読み込み
     */
    loadAdminNumbers() {
        try {
            const saved = localStorage.getItem('adminNumbers');
            if (saved) {
                const parsed = JSON.parse(saved);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (error) {
            console.error('管理者番号の読み込みエラー:', error);
        }
        return []; // デフォルトは空
    }

    /**
     * 管理者番号リストを保存
     */
    saveAdminNumbers() {
        try {
            localStorage.setItem('adminNumbers', JSON.stringify(this.adminNumbers));
            console.log('管理者番号を保存しました:', this.adminNumbers);
        } catch (error) {
            console.error('管理者番号の保存エラー:', error);
        }
    }

    /**
     * 管理者番号を追加
     */
    addAdminNumber(number) {
        if (!number || isNaN(number)) return false;

        const numericNumber = parseInt(number);
        if (numericNumber <= 0) return false;

        if (!this.adminNumbers.includes(numericNumber)) {
            this.adminNumbers.push(numericNumber);
            this.adminNumbers.sort((a, b) => a - b);
            this.saveAdminNumbers();
            this.updateUI();
            return true;
        }
        return false;
    }

    /**
     * 管理者番号を削除
     */
    removeAdminNumber(number) {
        const numericNumber = parseInt(number);
        const index = this.adminNumbers.indexOf(numericNumber);
        if (index !== -1) {
            this.adminNumbers.splice(index, 1);
            this.saveAdminNumbers();
            this.updateUI();
            return true;
        }
        return false;
    }

    /**
     * 指定した学籍番号が管理者かチェック
     */
    isAdmin(studentNumber) {
        if (!studentNumber) return false;
        const numericNumber = parseInt(studentNumber);
        return this.adminNumbers.includes(numericNumber);
    }

    /**
     * 現在のユーザーが管理者かチェック
     */
    isCurrentUserAdmin() {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                return this.isAdmin(user.studentNumber);
            }
        } catch (error) {
            console.error('現在ユーザーの管理者チェックエラー:', error);
        }
        return false;
    }

    /**
     * UIのセットアップ
     */
    setupUI() {
        // 設定画面に管理者設定セクションを追加
        this.createAdminSettingsSection();
        this.updateUI();
    }

    /**
     * 管理者設定セクションを作成
     */
    createAdminSettingsSection() {
        if (window.location.pathname.includes('login.html')) {
            return;
        }
        const settingsSection = document.querySelector('#settings .settings-section');
        if (!settingsSection) {
            if (typeof this._settingsRetryCount !== 'number') this._settingsRetryCount = 0;
            if (this._settingsRetryCount < 5) {
                this._settingsRetryCount++;
                setTimeout(() => this.createAdminSettingsSection(), 500);
            }
            return;
        }

        // 既に管理者設定が存在する場合はスキップ
        if (settingsSection.querySelector('.admin-settings')) {
            console.log('管理者設定セクションは既に存在します。');
            return;
        }

        const adminSection = document.createElement('div');
        adminSection.className = 'admin-settings';
        adminSection.innerHTML = `
            <h3><i class="fas fa-user-shield"></i> 管理者権限設定</h3>
            <p class="admin-description">
                管理者権限を付与する学籍番号を設定できます。<br>
                設定・席割り当て機能を利用できるユーザーを制限します。
            </p>

            <div class="admin-add-section">
                <div class="form-group">
                    <label for="adminNumberInput">学籍番号</label>
                    <div class="admin-input-group">
                        <input type="number" id="adminNumberInput" placeholder="例: 12345" min="1">
                        <button id="addAdminNumber" class="btn-primary">
                            <i class="fas fa-plus"></i>
                            追加
                        </button>
                    </div>
                </div>
            </div>

            <div class="admin-list-section">
                <h4>管理者リスト</h4>
                <div id="adminNumbersList" class="admin-numbers-list">
                    <!-- 動的生成 -->
                </div>
                <div class="admin-actions">
                    <button id="clearAllAdmins" class="btn-danger">
                        <i class="fas fa-trash"></i>
                        全て削除
                    </button>
                </div>
            </div>

            <div class="admin-current-status">
                <div class="current-user-status" id="currentUserStatus">
                    <!-- 動的生成 -->
                </div>
            </div>
        `;

        settingsSection.appendChild(adminSection);
        this.setupEventHandlers();
    }

    /**
     * イベントハンドラーの設定
     */
    setupEventHandlers() {
        const addBtn = document.getElementById('addAdminNumber');
        const input = document.getElementById('adminNumberInput');
        const clearBtn = document.getElementById('clearAllAdmins');

        if (addBtn) {
            addBtn.addEventListener('click', () => this.handleAddAdmin());
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAddAdmin();
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClearAll());
        }
    }

    /**
     * 管理者追加の処理
     */
    handleAddAdmin() {
        const input = document.getElementById('adminNumberInput');
        if (!input) return;

        const number = input.value.trim();
        if (!number) {
            this.showMessage('学籍番号を入力してください', 'warning');
            return;
        }

        if (this.addAdminNumber(number)) {
            input.value = '';
            this.showMessage(`学籍番号 ${number} を管理者に追加しました`, 'success');
        } else {
            this.showMessage('既に登録されているか、無効な番号です', 'error');
        }
    }

    /**
     * 全管理者クリアの処理
     */
    handleClearAll() {
        if (this.adminNumbers.length === 0) {
            this.showMessage('管理者リストは既に空です', 'info');
            return;
        }

        if (confirm('全ての管理者権限を削除しますか？\nこの操作は元に戻せません。')) {
            this.adminNumbers = [];
            this.saveAdminNumbers();
            this.updateUI();
            this.showMessage('全ての管理者権限を削除しました', 'success');
        }
    }

    /**
     * UIの更新
     */
    updateUI() {
        this.updateAdminList();
        this.updateCurrentUserStatus();
    }

    /**
     * 管理者リストの更新
     */
    updateAdminList() {
        const listContainer = document.getElementById('adminNumbersList');
        if (!listContainer) return;

        if (this.adminNumbers.length === 0) {
            listContainer.innerHTML = '<p class="no-admins">管理者が設定されていません</p>';
            return;
        }

        listContainer.innerHTML = this.adminNumbers.map(number => `
            <div class="admin-number-item">
                <span class="admin-number">${number}</span>
                <button class="btn-remove" onclick="window.adminConfig.removeAdminNumber(${number})" title="削除">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    /**
     * 現在ユーザーのステータス更新
     */
    updateCurrentUserStatus() {
        const statusContainer = document.getElementById('currentUserStatus');
        if (!statusContainer) return;

        const isCurrentAdmin = this.isCurrentUserAdmin();

        try {
            const savedUser = localStorage.getItem('currentUser');
            const user = savedUser ? JSON.parse(savedUser) : null;

            statusContainer.innerHTML = `
                <div class="current-user-info">
                    <h4>あなたの権限状況</h4>
                    <div class="user-info">
                        <span class="user-number">学籍番号: ${user?.studentNumber || '不明'}</span>
                        <span class="user-role ${isCurrentAdmin ? 'admin' : 'participant'}">
                            <i class="fas ${isCurrentAdmin ? 'fa-shield-alt' : 'fa-user'}"></i>
                            ${isCurrentAdmin ? '管理者' : '一般ユーザー'}
                        </span>
                    </div>
                    ${!isCurrentAdmin ? '<p class="role-note">設定変更や席割り当て機能は管理者のみ利用可能です</p>' : ''}
                </div>
            `;
        } catch (error) {
            console.error('ユーザーステータス更新エラー:', error);
            statusContainer.innerHTML = '<p class="status-error">ユーザー情報の取得に失敗しました</p>';
        }
    }

    /**
     * メッセージ表示
     */
    showMessage(message, type = 'info') {
        // UIManagerが利用可能な場合はそれを使用
        if (window.uiManager && typeof window.uiManager.showMessage === 'function') {
            window.uiManager.showMessage(message, type);
            return;
        }

        // フォールバック: コンソールログ
        console.log(`[${type.toUpperCase()}] ${message}`);

        // 簡易通知の表示
        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem;
            border-radius: 0.5rem;
            color: white;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            background: ${this.getNotificationColor(type)};
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * 通知の色を取得
     */
    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }

    /**
     * 管理者設定データのエクスポート
     */
    exportConfig() {
        return {
            adminNumbers: [...this.adminNumbers],
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * 管理者設定データのインポート
     */
    importConfig(configData) {
        try {
            if (configData && Array.isArray(configData.adminNumbers)) {
                this.adminNumbers = configData.adminNumbers.filter(num =>
                    Number.isInteger(num) && num > 0
                );
                this.saveAdminNumbers();
                this.updateUI();
                return true;
            }
        } catch (error) {
            console.error('設定インポートエラー:', error);
        }
        return false;
    }
}

// グローバルインスタンス（設定ページで使用）
window.adminConfig = new AdminConfig();