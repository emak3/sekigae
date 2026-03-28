class LoginAuthManager {
    constructor() {
        this.googleClientId = '116884154238-7qslk5tb0v4fcoc75lc2tf20hm1tif6p.apps.googleusercontent.com';
        this.currentUser = null;
        this.initializeAuth();
    }

    initializeAuth() {
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

        let attempts = 0;
        const maxAttempts = 50;

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

            window.handleGoogleSignIn = this.handleCredentialResponse.bind(this);

            google.accounts.id.initialize({
                client_id: this.googleClientId,
                callback: this.handleCredentialResponse.bind(this),
                auto_select: false,
                cancel_on_tap_outside: false
            });

            this.setupGoogleSignInButton();
            this.setupRoomActions();
            if (new URLSearchParams(window.location.search).get('debug') === '1') {
                this.showDebugInfo();
            }

            console.log('Google認証初期化完了');

        } catch (error) {
            console.error('Google認証の初期化に失敗:', error);
            this.showError('認証システムの初期化に失敗しました');
        }
    }

    setupGoogleSignInButton() {
        try {
            const signInContainer = document.getElementById('g_id_signin');
            if (signInContainer) {
                console.log('Google Sign-Inボタンを設定中...');

                signInContainer.innerHTML = '';

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
                google.accounts.id.prompt();
            });

            container.appendChild(manualBtn);
            console.log('手動Sign-Inボタン作成完了');

        } catch (error) {
            console.error('手動ボタン作成エラー:', error);
        }
    }

    setupRoomActions() {
        const createRoomBtn = document.getElementById('createRoomBtn');
        const joinRoomBtn = document.getElementById('joinRoomBtn');
        const confirmCreateRoom = document.getElementById('confirmCreateRoom');
        const cancelCreateRoom = document.getElementById('cancelCreateRoom');
        const confirmJoinRoom = document.getElementById('confirmJoinRoom');
        const cancelJoinRoom = document.getElementById('cancelJoinRoom');

        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => {
                this.showCreateRoomForm();
            });
        }

        if (joinRoomBtn) {
            joinRoomBtn.addEventListener('click', () => {
                this.showJoinRoomForm();
            });
        }

        if (confirmCreateRoom) {
            confirmCreateRoom.addEventListener('click', () => {
                this.createRoom();
            });
        }

        if (cancelCreateRoom) {
            cancelCreateRoom.addEventListener('click', () => {
                this.hideRoomForms();
            });
        }

        if (confirmJoinRoom) {
            confirmJoinRoom.addEventListener('click', () => {
                this.joinRoom();
            });
        }

        if (cancelJoinRoom) {
            cancelJoinRoom.addEventListener('click', () => {
                this.hideRoomForms();
            });
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

            console.log('ドメインチェック:', payload.email);
            if (!this.validateDomain(payload.email)) {
                this.showError('@s.salesio-sp.ac.jp ドメインのアカウントでログインしてください');
                return;
            }

            const studentNumber = this.extractStudentNumber(payload.email);
            console.log('抽出された学籍番号:', studentNumber);
            if (!studentNumber) {
                this.showError('学籍番号の形式が正しくありません (s[番号]@s.salesio-sp.ac.jp)');
                return;
            }

            const googleName = payload.name || payload.given_name || payload.family_name || 'Unknown';

            this.currentUser = {
                email: payload.email,
                name: googleName,
                studentNumber: studentNumber,
                picture: payload.picture,
                sub: payload.sub
            };

            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

            this.hideError();

            console.log('✅ ログイン成功:', this.currentUser);

            this.showPostLoginSummary();

            const inviteRoomId = window.URLUtils ? window.URLUtils.getRoomId() : null;
            this.showRoomSection();

            if (inviteRoomId && inviteRoomId !== 'default') {
                this.showPendingRoomInvite(inviteRoomId);
            } else {
                this.showRoomChoices();
            }

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

    showRoomSection() {
        const roomSection = document.getElementById('roomSection');
        if (roomSection) {
            roomSection.style.display = 'block';
        }
    }

    showPostLoginSummary() {
        const block = document.getElementById('postLoginSummary');
        if (!block || !this.currentUser) return;

        const avatar = document.getElementById('postLoginAvatar');
        const nameEl = document.getElementById('postLoginName');
        const meta = document.getElementById('postLoginMeta');

        if (avatar) {
            avatar.src = this.currentUser.picture || '';
            avatar.alt = this.currentUser.name || '';
        }
        if (nameEl) nameEl.textContent = this.currentUser.name || '';
        if (meta) {
            meta.textContent = `学籍番号 ${this.currentUser.studentNumber} · ${this.currentUser.email || ''}`;
        }

        block.style.display = 'block';
    }

    showRoomChoices() {
        const choices = document.getElementById('roomChoices');
        const panel = document.getElementById('pendingInvitePanel');
        const hint = document.getElementById('postLoginNextHint');
        if (panel) {
            panel.style.display = 'none';
            panel.setAttribute('hidden', '');
            panel.innerHTML = '';
        }
        if (choices) choices.style.display = 'block';
        if (hint) {
            hint.textContent = 'ステップ 2 · 部屋を作成するか、共有された部屋に参加してください。';
        }
    }

    showPendingRoomInvite(roomId) {
        const panel = document.getElementById('pendingInvitePanel');
        const choices = document.getElementById('roomChoices');
        const hint = document.getElementById('postLoginNextHint');
        if (!panel) return;

        if (choices) choices.style.display = 'none';
        if (hint) {
            hint.textContent = '共有リンクから部屋への参加が案内されています。内容を確認してから参加してください。';
        }

        panel.removeAttribute('hidden');
        panel.style.display = 'block';
        panel.innerHTML = `
            <div class="pending-invite-card">
                <p class="pending-invite-label">共有された部屋</p>
                <p class="pending-invite-id" title="部屋ID"><code>${this.escapeHtml(roomId)}</code></p>
                <p class="pending-invite-note">参加するとこの部屋の席希望・データが共有されます。別の部屋の場合は「部屋IDを変更」から進んでください。</p>
                <div class="pending-invite-actions">
                    <button type="button" class="btn-primary pending-invite-join" id="pendingInviteJoinBtn">
                        <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
                        この部屋に参加する
                    </button>
                    <button type="button" class="btn-outline" id="pendingInviteChangeBtn">
                        部屋IDを手入力する
                    </button>
                </div>
            </div>
        `;

        const joinBtn = document.getElementById('pendingInviteJoinBtn');
        const changeBtn = document.getElementById('pendingInviteChangeBtn');
        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.joinWithRoomId(roomId));
        }
        if (changeBtn) {
            changeBtn.addEventListener('click', () => {
                if (window.URLUtils) {
                    window.URLUtils.setParam('room', null);
                }
                const input = document.getElementById('roomId');
                if (input) input.value = roomId;
                this.showRoomChoices();
                this.showJoinRoomForm();
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showCreateRoomForm() {
        this.hideRoomForms();
        const createForm = document.getElementById('createRoomForm');
        if (createForm) {
            createForm.style.display = 'block';
        }
    }

    showJoinRoomForm() {
        this.hideRoomForms();
        const joinForm = document.getElementById('joinRoomForm');
        if (joinForm) {
            joinForm.style.display = 'block';
        }
    }

    hideRoomForms() {
        const createForm = document.getElementById('createRoomForm');
        const joinForm = document.getElementById('joinRoomForm');

        if (createForm) createForm.style.display = 'none';
        if (joinForm) joinForm.style.display = 'none';
    }

    createRoom() {
        const roomName = document.getElementById('roomName').value;
        const roomDescription = document.getElementById('roomDescription').value;
        const adminNumbers = document.getElementById('adminNumbers').value;

        if (!roomName.trim()) {
            this.showError('部屋名を入力してください');
            return;
        }

        // 管理者権限を設定
        const adminNumbersList = [];
        if (adminNumbers.trim()) {
            const numbers = adminNumbers.split(',').map(n => n.trim()).filter(n => n);
            adminNumbersList.push(...numbers.map(n => parseInt(n)).filter(n => !isNaN(n)));
        }

        // 作成者は常に管理者
        if (!adminNumbersList.includes(parseInt(this.currentUser.studentNumber))) {
            adminNumbersList.push(parseInt(this.currentUser.studentNumber));
        }

        try {
            localStorage.setItem('adminNumbers', JSON.stringify(adminNumbersList));
        } catch (e) {
            console.warn('管理者番号の保存に失敗:', e);
        }
        if (window.adminConfig) {
            window.adminConfig.adminNumbers = adminNumbersList.slice().sort((a, b) => a - b);
            window.adminConfig.saveAdminNumbers();
        }

        const roomData = {
            id: this.generateRoomId(),
            name: roomName.trim(),
            description: roomDescription.trim(),
            creator: this.currentUser,
            createdAt: new Date().toISOString(),
            adminUsers: [this.currentUser.sub],
            participants: [this.currentUser],
            adminNumbers: adminNumbersList
        };

        localStorage.setItem('currentRoom', JSON.stringify(roomData));
        localStorage.setItem('userRole', 'admin');

        console.log('部屋を作成しました:', roomData);

        // URLに部屋IDを設定
        if (window.URLUtils) {
            window.URLUtils.setRoomId(roomData.id);
        }

        this.redirectToApp();
    }

    joinRoom() {
        const input = document.getElementById('roomId');
        const roomId = input ? input.value : '';
        this.joinWithRoomId(roomId);
    }

    joinWithRoomId(roomId) {
        const trimmed = (roomId || '').trim();
        if (!trimmed) {
            this.showError('部屋IDを入力してください');
            return;
        }

        const roomData = {
            id: trimmed,
            name: '参加中の部屋',
            description: '',
            participants: [this.currentUser]
        };

        localStorage.setItem('currentRoom', JSON.stringify(roomData));
        localStorage.setItem('userRole', 'participant');

        if (window.URLUtils) {
            window.URLUtils.setRoomId(roomData.id);
        }

        this.redirectToApp();
    }

    generateRoomId() {
        return Math.random().toString(36).slice(2, 11);
    }

    redirectToApp() {
        // ユーザー情報と部屋情報が正しく保存されているか確認
        const savedUser = localStorage.getItem('currentUser');
        const savedRoom = localStorage.getItem('currentRoom');
        const savedRole = localStorage.getItem('userRole');

        if (!savedUser || !savedRoom || !savedRole) {
            console.error('認証情報の保存に失敗しました');
            this.showError('認証情報の保存に失敗しました。再度お試しください。');
            return;
        }

        console.log('リダイレクト前の確認:', {
            user: !!savedUser,
            room: !!savedRoom,
            role: savedRole
        });

        // 少し待ってからリダイレクト（LocalStorageの確実な保存のため）
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 100);
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
}

window.loginAuthManager = new LoginAuthManager();