class AuthGuard {
    constructor() {
        this.currentUser = null;
        this.currentRoom = null;
        this.userRole = null;
        // DOM読み込み完了後に認証チェックを実行
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.checkAuthentication();
            });
        } else {
            // 少し遅延してauth-managerの初期化を待つ
            setTimeout(() => this.checkAuthentication(), 100);
        }
    }

    checkAuthentication() {
        try {
            const savedUser = localStorage.getItem('currentUser');
            const savedRoom = localStorage.getItem('currentRoom');
            const savedRole = localStorage.getItem('userRole');

            console.log('認証チェック開始:', {
                hasUser: !!savedUser,
                hasRoom: !!savedRoom,
                hasRole: !!savedRole,
                role: savedRole
            });

            if (!savedUser || !savedRoom) {
                console.log('認証情報または部屋情報が見つかりません。ログインページにリダイレクトします。');
                this.showErrorAndRedirect('認証情報が見つかりません');
                return;
            }

            try {
                this.currentUser = JSON.parse(savedUser);
                this.currentRoom = JSON.parse(savedRoom);
                this.userRole = savedRole;
            } catch (parseError) {
                console.error('認証情報の解析エラー:', parseError);
                this.showErrorAndRedirect('認証情報が破損しています');
                return;
            }

            this.normalizeCreatorAdminState();

            if (!this.validateUserData()) {
                console.log('認証情報が無効です。ログインページにリダイレクトします。');
                this.showErrorAndRedirect('認証情報が無効です');
                return;
            }

            console.log('認証チェック成功:', {
                user: this.currentUser.name,
                room: this.currentRoom.id,
                role: this.userRole
            });

            this.setupAuthenticatedUI();

        } catch (error) {
            console.error('認証チェックエラー:', error);
            this.showErrorAndRedirect('認証チェックに失敗しました');
        }
    }

    validateUserData() {
        if (!this.currentUser || !this.currentUser.email || !this.currentUser.sub) {
            return false;
        }

        if (!this.currentUser.email.endsWith('@s.salesio-sp.ac.jp')) {
            return false;
        }

        if (!this.currentRoom || !this.currentRoom.id) {
            return false;
        }

        if (!this.userRole || (this.userRole !== 'admin' && this.userRole !== 'participant')) {
            return false;
        }

        return true;
    }

    /**
     * 部屋作成者は必ず管理者として扱う（ロールと adminUsers を保存データと一致させる）
     */
    normalizeCreatorAdminState() {
        if (!this.currentRoom?.creator?.sub || !this.currentUser?.sub) return;
        if (this.currentUser.sub !== this.currentRoom.creator.sub) return;

        let changed = false;
        if (this.userRole !== 'admin') {
            this.userRole = 'admin';
            localStorage.setItem('userRole', 'admin');
            changed = true;
        }
        if (!Array.isArray(this.currentRoom.adminUsers)) {
            this.currentRoom.adminUsers = [];
        }
        if (!this.currentRoom.adminUsers.includes(this.currentUser.sub)) {
            this.currentRoom.adminUsers.push(this.currentUser.sub);
            changed = true;
        }
        if (changed) {
            localStorage.setItem('currentRoom', JSON.stringify(this.currentRoom));
        }
        if (window.roomManager && typeof window.roomManager.loadRoomData === 'function') {
            window.roomManager.loadRoomData();
        }
    }

    setupAuthenticatedUI() {
        this.updateHeaderUserInfo();
        this.updateSessionContextStrip();
        this.updateRoomInfo();
        this.setupPermissions();
        this.setupLogoutHandler();
    }

    updateHeaderUserInfo() {
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
            headerUserStatus.style.display = 'none';
        }
    }

    updateSessionContextStrip() {
        const strip = document.getElementById('appContextStrip');
        const roomEl = document.getElementById('stripRoomLabel');
        const badge = document.getElementById('stripRoleBadge');
        if (!strip || !roomEl || !badge || !this.currentRoom) return;

        strip.style.display = 'flex';
        const named = this.currentRoom.name && this.currentRoom.name !== '参加中の部屋';
        roomEl.textContent = named
            ? `${this.currentRoom.name} · ${this.currentRoom.id}`
            : `部屋ID ${this.currentRoom.id}`;

        const creatorIsMe = this.currentRoom.creator?.sub === this.currentUser?.sub;
        const isAdmin = this.userRole === 'admin' || creatorIsMe;
        badge.textContent = isAdmin ? '管理者' : '参加者';
        badge.className = 'strip-role-badge ' + (isAdmin ? 'strip-role-badge--admin' : 'strip-role-badge--participant');
    }

    updateRoomInfo() {
        const roomIdDisplay = document.getElementById('roomIdDisplay');
        const footerRoomId = document.getElementById('footerRoomId');

        if (roomIdDisplay && this.currentRoom) {
            roomIdDisplay.textContent = this.currentRoom.id;
        }

        if (footerRoomId && this.currentRoom) {
            footerRoomId.textContent = this.currentRoom.id;
        }
    }

    setupPermissions() {
        const creatorIsMe = this.currentRoom?.creator?.sub === this.currentUser?.sub;
        const inAdminUsers = Array.isArray(this.currentRoom?.adminUsers) &&
            this.currentRoom.adminUsers.includes(this.currentUser?.sub);

        const isRoomAdmin = this.userRole === 'admin' || creatorIsMe || inAdminUsers;

        const isConfigAdmin = window.adminConfig ? window.adminConfig.isCurrentUserAdmin() : false;

        const isAdmin = isRoomAdmin || isConfigAdmin;

        console.log('権限チェック:', {
            roomAdmin: isRoomAdmin,
            configAdmin: isConfigAdmin,
            finalAdmin: isAdmin,
            studentNumber: this.currentUser?.studentNumber
        });

        const settingsTab = document.querySelector('.nav-tab[data-tab="settings"]');
        const seatingAssignmentTab = document.querySelector('.nav-tab[data-tab="seating-assignment"]');

        if (!isAdmin) {
            // 管理者でない場合は制限
            this.disableAdminFeatures(settingsTab, seatingAssignmentTab);
        } else {
            // 管理者の場合は有効化
            this.enableAdminFeatures(settingsTab, seatingAssignmentTab);
        }

        console.log(`権限設定完了: ${isAdmin ? '管理者' : '参加者'} (部屋管理者: ${isRoomAdmin}, 番号管理者: ${isConfigAdmin})`);
    }

    disableAdminFeatures(settingsTab, seatingAssignmentTab) {
        if (settingsTab) {
            settingsTab.style.pointerEvents = 'none';
            settingsTab.style.opacity = '0.5';
            settingsTab.classList.add('disabled');
            settingsTab.setAttribute('title', '管理者のみ利用可能');
        }

        // 座席配置タブは表示はできるが、操作ボタンのみ制限
        if (seatingAssignmentTab) {
            seatingAssignmentTab.style.pointerEvents = 'auto';
            seatingAssignmentTab.style.opacity = '1';
            seatingAssignmentTab.classList.remove('disabled');
            seatingAssignmentTab.removeAttribute('title');
        }

        const assignSeats = document.getElementById('assignSeats');
        const assignRandom = document.getElementById('assignRandom');
        const clearAssignments = document.getElementById('clearAssignments');

        [assignSeats, assignRandom, clearAssignments].forEach(btn => {
            if (btn) {
                btn.style.pointerEvents = 'none';
                btn.style.opacity = '0.5';
                btn.setAttribute('title', '管理者のみ操作可能（座席の表示は可能です）');
            }
        });

        const settingsButtons = document.querySelectorAll('#settings .btn-primary, #settings .btn-secondary');
        settingsButtons.forEach(btn => {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
            btn.setAttribute('title', '管理者のみ利用可能');
        });
    }

    enableAdminFeatures(settingsTab, seatingAssignmentTab) {
        if (settingsTab) {
            settingsTab.style.pointerEvents = 'auto';
            settingsTab.style.opacity = '1';
            settingsTab.classList.remove('disabled');
            settingsTab.removeAttribute('title');
        }

        if (seatingAssignmentTab) {
            seatingAssignmentTab.style.pointerEvents = 'auto';
            seatingAssignmentTab.style.opacity = '1';
            seatingAssignmentTab.classList.remove('disabled');
            seatingAssignmentTab.removeAttribute('title');
        }

        const assignSeats = document.getElementById('assignSeats');
        const assignRandom = document.getElementById('assignRandom');
        const clearAssignments = document.getElementById('clearAssignments');

        [assignSeats, assignRandom, clearAssignments].forEach(btn => {
            if (btn) {
                btn.style.pointerEvents = 'auto';
                btn.style.opacity = '1';
                btn.removeAttribute('title');
            }
        });

        const settingsButtons = document.querySelectorAll('#settings .btn-primary, #settings .btn-secondary');
        settingsButtons.forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            btn.removeAttribute('title');
        });
    }

    setupLogoutHandler() {
        const headerLogoutBtn = document.getElementById('headerLogoutBtn');
        if (headerLogoutBtn) {
            headerLogoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    logout() {
        console.log('ログアウト処理を開始します');

        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentRoom');
        localStorage.removeItem('userRole');

        this.currentUser = null;
        this.currentRoom = null;
        this.userRole = null;

        this.redirectToLogin();
    }

    showErrorAndRedirect(message) {
        console.error('認証エラー:', message);

        // エラーメッセージを一時的に表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc2626;
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 300px;
        `;
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.875rem; opacity: 0.8;">
                ログインページにリダイレクトします...
            </div>
        `;

        document.body.appendChild(errorDiv);

        // 2秒後にリダイレクト
        setTimeout(() => {
            this.redirectToLogin();
        }, 2000);
    }

    redirectToLogin() {
        window.location.href = 'login.html';
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getCurrentRoom() {
        return this.currentRoom;
    }

    getUserRole() {
        return this.userRole;
    }

    isAdmin() {
        if (this.userRole === 'admin') return true;
        if (this.currentRoom?.creator?.sub && this.currentUser?.sub &&
            this.currentRoom.creator.sub === this.currentUser.sub) {
            return true;
        }
        if (Array.isArray(this.currentRoom?.adminUsers) && this.currentUser?.sub &&
            this.currentRoom.adminUsers.includes(this.currentUser.sub)) {
            return true;
        }
        return false;
    }

    isParticipant() {
        return this.userRole === 'participant';
    }
}

window.authGuard = new AuthGuard();