class RoomManager {
    constructor() {
        this.currentRoom = null;
        this.userRole = null;
        this.loadRoomData();
    }

    loadRoomData() {
        try {
            const roomData = localStorage.getItem('currentRoom');
            const userRole = localStorage.getItem('userRole');

            if (roomData) {
                this.currentRoom = JSON.parse(roomData);
            }

            if (userRole) {
                this.userRole = userRole;
            }

            this.ensureCreatorIsAdminPersisted();

            console.log('部屋データ読み込み:', {
                room: this.currentRoom,
                role: this.userRole
            });

        } catch (error) {
            console.error('部屋データの読み込みに失敗:', error);
            this.clearRoomData();
        }
    }

    saveRoomData() {
        try {
            if (this.currentRoom) {
                localStorage.setItem('currentRoom', JSON.stringify(this.currentRoom));
            }

            if (this.userRole) {
                localStorage.setItem('userRole', this.userRole);
            }
        } catch (error) {
            console.error('部屋データの保存に失敗:', error);
        }
    }

    clearRoomData() {
        this.currentRoom = null;
        this.userRole = null;
        localStorage.removeItem('currentRoom');
        localStorage.removeItem('userRole');
    }

    /**
     * 部屋作成者は常に管理者（userRole / adminUsers を整合）
     */
    ensureCreatorIsAdminPersisted() {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (!savedUser || !this.currentRoom?.creator?.sub) return;

            const user = JSON.parse(savedUser);
            if (user.sub !== this.currentRoom.creator.sub) return;

            let changed = false;
            if (this.userRole !== 'admin') {
                this.userRole = 'admin';
                localStorage.setItem('userRole', 'admin');
                changed = true;
            }
            if (!Array.isArray(this.currentRoom.adminUsers)) {
                this.currentRoom.adminUsers = [];
            }
            if (!this.currentRoom.adminUsers.includes(user.sub)) {
                this.currentRoom.adminUsers.push(user.sub);
                changed = true;
            }
            if (changed) {
                localStorage.setItem('currentRoom', JSON.stringify(this.currentRoom));
            }
        } catch (e) {
            console.warn('作成者管理者の整合に失敗:', e);
        }
    }

    getCurrentRoom() {
        return this.currentRoom;
    }

    getUserRole() {
        return this.userRole;
    }

    isAdmin() {
        return this.userRole === 'admin';
    }

    isParticipant() {
        return this.userRole === 'participant';
    }

    canManageSettings() {
        return this.isAdmin();
    }

    canAssignSeats() {
        return this.isAdmin();
    }

    canSelectSeat() {
        return this.isAdmin() || this.isParticipant();
    }

    updateRoomInfo(roomInfo) {
        if (this.currentRoom) {
            Object.assign(this.currentRoom, roomInfo);
            this.saveRoomData();
        }
    }

    addParticipant(user) {
        if (this.currentRoom && this.isAdmin()) {
            if (!this.currentRoom.participants) {
                this.currentRoom.participants = [];
            }

            const existingParticipant = this.currentRoom.participants.find(
                p => p.sub === user.sub
            );

            if (!existingParticipant) {
                this.currentRoom.participants.push(user);
                this.saveRoomData();
                return true;
            }
        }
        return false;
    }

    removeParticipant(userSub) {
        if (this.currentRoom && this.isAdmin()) {
            if (this.currentRoom.participants) {
                this.currentRoom.participants = this.currentRoom.participants.filter(
                    p => p.sub !== userSub
                );
                this.saveRoomData();
                return true;
            }
        }
        return false;
    }

    promoteToAdmin(userSub) {
        if (this.currentRoom && this.isAdmin()) {
            if (!this.currentRoom.adminUsers) {
                this.currentRoom.adminUsers = [];
            }

            if (!this.currentRoom.adminUsers.includes(userSub)) {
                this.currentRoom.adminUsers.push(userSub);
                this.saveRoomData();
                return true;
            }
        }
        return false;
    }

    demoteFromAdmin(userSub) {
        const creatorSub = this.currentRoom?.creator?.sub;
        if (creatorSub && userSub === creatorSub) {
            return false;
        }
        if (this.currentRoom && this.isAdmin()) {
            if (this.currentRoom.adminUsers) {
                this.currentRoom.adminUsers = this.currentRoom.adminUsers.filter(
                    id => id !== userSub
                );
                this.saveRoomData();
                return true;
            }
        }
        return false;
    }

    getRoomParticipants() {
        return this.currentRoom ? this.currentRoom.participants || [] : [];
    }

    getRoomAdmins() {
        if (!this.currentRoom || !this.currentRoom.adminUsers) {
            return [];
        }

        return this.getRoomParticipants().filter(
            p => this.currentRoom.adminUsers.includes(p.sub)
        );
    }

    leaveRoom() {
        this.clearRoomData();
        console.log('部屋から退出しました');
    }

    getRoomDisplayInfo() {
        if (!this.currentRoom) {
            return {
                id: 'なし',
                name: '部屋に参加していません',
                role: 'なし'
            };
        }

        return {
            id: this.currentRoom.id,
            name: this.currentRoom.name,
            role: this.userRole === 'admin' ? '管理者' : '参加者'
        };
    }
}

window.roomManager = new RoomManager();