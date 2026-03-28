class AuthManager {
    constructor() {
        this.googleClientId = '116884154238-7qslk5tb0v4fcoc75lc2tf20hm1tif6p.apps.googleusercontent.com'; // 実際のクライアントIDに置き換える
        this.currentUser = null;
        this.initializeAuth();
    }

    initializeAuth() {
        // DOM読み込み完了を待つ
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.waitForGoogleAPI();
            });
        } else {
            this.waitForGoogleAPI();
        }
    }

    async waitForGoogleAPI() {
        console.log('Google APIの読み込みを待機中...');

        // Google APIが読み込まれるまで待つ
        let attempts = 0;
        const maxAttempts = 50; // 5秒間待機

        while (!window.google && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (window.google) {
            console.log('Google API読み込み完了');
            this.setupGoogleAuth();
        } else {
            console.error('Google APIの読み込みに失敗しました');
            this.showError('Google APIの読み込みに失敗しました。ページを再読み込みしてください。');
        }
    }

    setupGoogleAuth() {
        try {
            console.log('Google認証を初期化中...');

            // グローバルコールバック関数を設定
            window.handleGoogleSignIn = this.handleCredentialResponse.bind(this);

            google.accounts.id.initialize({
                client_id: this.googleClientId,
                callback: this.handleCredentialResponse.bind(this),
                auto_select: false,
                cancel_on_tap_outside: false
            });

            // ヘッダーログアウトボタンの設定
            this.setupHeaderLogoutButton();

            // Google Sign-Inボタンを設定
            this.setupGoogleSignInButton();

            // 初期状態では全タブを無効化（ログインページでない場合のみ）
            if (!window.location.pathname.includes('login.html')) {
                this.disableAllTabs();
                // 既存のセッションチェック
                this.checkExistingSession();
            }

            if (new URLSearchParams(window.location.search).get('debug') === '1') {
                this.showDebugInfo();
            }

            console.log('Google認証初期化完了');

        } catch (error) {
            console.error('Google認証の初期化に失敗:', error);
            this.showError('認証システムの初期化に失敗しました');
        }
    }


    setupHeaderLogoutButton() {
        const headerLogoutBtn = document.getElementById('headerLogoutBtn');
        if (headerLogoutBtn) {
            headerLogoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('ヘッダーログアウトボタンがクリックされました');
                this.logout();
            });
        }
    }


    setupGoogleSignInButton() {
        try {
            const signInContainer = document.getElementById('g_id_signin');
            if (signInContainer) {
                console.log('Google Sign-Inボタンを設定中...');

                // 既存の内容をクリア
                signInContainer.innerHTML = '';

                // ボタンをレンダリング
                setTimeout(() => {
                    try {
                        google.accounts.id.renderButton(
                            signInContainer,
                            {
                                theme: 'outline',
                                size: 'large',
                                type: 'standard',
                                text: 'signin_with',
                                shape: 'rectangular',
                                logo_alignment: 'left',
                                width: 280
                            }
                        );
                        console.log('Google Sign-Inボタン設定完了');
                    } catch (renderError) {
                        console.error('ボタンレンダリングエラー:', renderError);
                        // フォールバック: 手動でボタンを作成
                        this.createManualSignInButton(signInContainer);
                    }
                }, 300);
            }
        } catch (error) {
            console.error('Google Sign-Inボタンの設定に失敗:', error);
        }
    }

    createManualSignInButton(container) {
        try {
            console.log('手動でSign-Inボタンを作成中...');

            const manualBtn = document.createElement('button');
            manualBtn.className = 'manual-google-signin-btn';
            manualBtn.innerHTML = `
                <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                    <g fill="#000" fill-rule="evenodd">
                        <path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335"/>
                        <path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4"/>
                        <path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05"/>
                        <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853"/>
                    </g>
                </svg>
                Sign in with Google
            `;

            manualBtn.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                background: white;
                border: 1px solid #dadce0;
                border-radius: 4px;
                color: #3c4043;
                font-family: 'Roboto', sans-serif;
                font-size: 14px;
                font-weight: 500;
                padding: 12px 16px;
                cursor: pointer;
                transition: all 0.3s ease;
                width: 100%;
                justify-content: center;
            `;

            manualBtn.addEventListener('mouseenter', () => {
                manualBtn.style.backgroundColor = '#f8f9fa';
                manualBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            });

            manualBtn.addEventListener('mouseleave', () => {
                manualBtn.style.backgroundColor = 'white';
                manualBtn.style.boxShadow = 'none';
            });

            manualBtn.addEventListener('click', () => {
                console.log('手動Sign-Inボタンがクリックされました');
                // 手動ボタンはフォールバックなので、プロンプトを試行
                google.accounts.id.prompt();
            });

            container.appendChild(manualBtn);
            console.log('手動Sign-Inボタン作成完了');

        } catch (error) {
            console.error('手動ボタン作成エラー:', error);
        }
    }

    showDebugInfo() {
        try {
            const debugContent = document.getElementById('debugContent');
            const debugInfo = document.getElementById('debugInfo');

            if (debugContent && debugInfo) {
                const info = `
                    <p><strong>クライアントID:</strong> ${this.googleClientId}</p>
                    <p><strong>Google API:</strong> ${window.google ? '読み込み済み' : '未読み込み'}</p>
                    <p><strong>現在のドメイン:</strong> ${window.location.origin}</p>
                    <p><strong>ユーザーエージェント:</strong> ${navigator.userAgent}</p>
                    <p><strong>Cookie有効:</strong> ${navigator.cookieEnabled ? 'はい' : 'いいえ'}</p>
                `;

                debugContent.innerHTML = info;
                debugInfo.style.display = 'block';
            }
        } catch (error) {
            console.error('デバッグ情報の表示に失敗:', error);
        }
    }

    async handleCredentialResponse(response) {
        try {
            console.log('Google認証レスポンスを処理中...');

            const credential = response.credential;
            if (!credential) {
                throw new Error('認証情報が取得できませんでした');
            }

            const payload = this.parseJwt(credential);
            console.log('JWTペイロード:', payload);

            if (!payload) {
                throw new Error('認証情報の解析に失敗しました');
            }

            // ドメインチェック
            console.log('ドメインチェック:', payload.email);
            if (!this.validateDomain(payload.email)) {
                this.showError('@s.salesio-sp.ac.jp ドメインのアカウントでログインしてください');
                return;
            }

            // 学籍番号の抽出
            const studentNumber = this.extractStudentNumber(payload.email);
            console.log('抽出された学籍番号:', studentNumber);
            if (!studentNumber) {
                this.showError('学籍番号の形式が正しくありません (s[番号]@s.salesio-sp.ac.jp)');
                return;
            }

            // Googleアカウントから名前を取得
            const googleName = payload.name || payload.given_name || payload.family_name || 'Unknown';

            console.log('Google名:', googleName);
            console.log('学籍番号:', studentNumber);

            // ユーザー情報の設定（Googleアカウント名のみ使用）
            this.currentUser = {
                email: payload.email,
                name: googleName,
                studentNumber: studentNumber,
                picture: payload.picture,
                sub: payload.sub
            };

            // ローカルストレージに保存
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

            // UIの更新
            this.updateUI();
            this.hideError();

            console.log('✅ ログイン成功:', this.currentUser);

        } catch (error) {
            console.error('❌ 認証エラー:', error);
            this.showError(`ログインに失敗しました: ${error.message}`);
        }
    }

    validateDomain(email) {
        return email && email.endsWith('@s.salesio-sp.ac.jp');
    }

    extractStudentNumber(email) {
        const match = email.match(/^s(\d+)@/);
        return match ? match[1] : null;
    }


    updateUI() {
        if (!this.currentUser) return;

        // ログイン画面を隠す
        const loginSection = document.getElementById('loginSection');
        if (loginSection) {
            loginSection.style.display = 'none';
        }

        // メイン画面を表示
        const mainSection = document.getElementById('mainSection');
        if (mainSection) {
            mainSection.style.display = 'block';
        }

        // ヘッダーにユーザー情報を表示
        this.updateHeaderUserInfo();

        // アクションボタンを表示
        const submitBtn = document.getElementById('submitSelection');
        const resetBtn = document.getElementById('resetSelection');

        if (submitBtn) submitBtn.style.display = 'inline-flex';
        if (resetBtn) resetBtn.style.display = 'inline-flex';

        // 他のタブも有効化
        this.enableAllTabs();
    }

    updateHeaderUserInfo() {
        if (!this.currentUser) return;

        const headerUserInfo = document.getElementById('headerUserInfo');
        const headerUserPhoto = document.getElementById('headerUserPhoto');
        const headerUserName = document.getElementById('headerUserName');
        const headerUserStatus = document.getElementById('headerUserStatus');

        if (headerUserInfo) {
            headerUserInfo.style.display = 'flex';
        }

        if (headerUserPhoto) {
            headerUserPhoto.src = this.currentUser.picture || '';
            headerUserPhoto.alt = this.currentUser.name;
        }

        if (headerUserName) {
            headerUserName.textContent = this.currentUser.name;
        }

        if (headerUserStatus) {
            // メールアドレス表示を削除し、シンプルに
            headerUserStatus.style.display = 'none';
        }
    }

    enableAllTabs() {
        const navTabs = document.querySelectorAll('.compact-tab');
        navTabs.forEach(tab => {
            tab.style.pointerEvents = 'auto';
            tab.style.opacity = '1';
            tab.classList.remove('disabled');
        });
    }

    disableAllTabs() {
        const navTabs = document.querySelectorAll('.compact-tab:not([data-tab="seat-selection"])');
        navTabs.forEach(tab => {
            tab.style.pointerEvents = 'none';
            tab.style.opacity = '0.5';
            tab.classList.add('disabled');
        });

        // 席選択タブも無効化（ログイン前は操作不可）
        const seatSelectionTab = document.querySelector('.compact-tab[data-tab="seat-selection"]');
        if (seatSelectionTab) {
            seatSelectionTab.style.pointerEvents = 'none';
            seatSelectionTab.style.opacity = '0.5';
            seatSelectionTab.classList.add('disabled');
        }
    }

    checkExistingSession() {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                this.updateUI();
                console.log('既存のセッションを復元しました:', this.currentUser);
            }
        } catch (error) {
            console.error('セッション復元エラー:', error);
            localStorage.removeItem('currentUser');
        }
    }

    logout() {
        // Google認証をリセット
        if (window.google) {
            google.accounts.id.disableAutoSelect();
        }

        // ローカルデータをクリア
        this.currentUser = null;
        localStorage.removeItem('currentUser');

        // UIをリセット
        const loginSection = document.getElementById('loginSection');
        const mainSection = document.getElementById('mainSection');
        const headerUserInfo = document.getElementById('headerUserInfo');

        if (loginSection) loginSection.style.display = 'block';
        if (mainSection) mainSection.style.display = 'none';
        if (headerUserInfo) headerUserInfo.style.display = 'none';

        // アクションボタンを隠す
        const submitBtn = document.getElementById('submitSelection');
        const resetBtn = document.getElementById('resetSelection');

        if (submitBtn) submitBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';

        // 全タブを無効化
        this.disableAllTabs();

        console.log('ログアウトしました');
    }


    showError(message) {
        const errorDiv = document.getElementById('loginError');
        const errorText = document.getElementById('loginErrorText');

        if (errorDiv && errorText) {
            errorText.textContent = message;
            errorDiv.style.display = 'flex';
        }
    }

    hideError() {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('JWT解析エラー:', error);
            return null;
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getStudentNumber() {
        return this.currentUser ? this.currentUser.studentNumber : null;
    }

    getStudentName() {
        return this.currentUser ? this.currentUser.name : null;
    }
}

// グローバルインスタンス
window.authManager = new AuthManager();