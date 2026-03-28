/**
 * 認証連携出席管理クラス
 * Googleログインによる認証システムと連携した簡素化された出席管理
 */
class AttendanceManager {
    constructor(socketManager) {
        this.socketManager = socketManager;
        this.settings = {
            seatCapacity: 25
        };

        this.isInitialized = false;
        this.setupEventHandlers();
    }

    /**
     * イベントハンドラーの設定
     */
    setupEventHandlers() {
        this.socketManager.on('roomData', (data) => {
            if (data.gridConfig) {
                this.updateSeatCapacity(data.gridConfig.rows * data.gridConfig.cols - data.gridConfig.disabledSeats.length);
            }
        });

        this.socketManager.on('gridConfigUpdated', (config) => {
            this.updateSeatCapacity(config.rows * config.cols - config.disabledSeats.length);
        });
    }

    /**
     * 現在ログイン中のユーザー情報を取得
     */
    getCurrentUser() {
        return window.authManager ? window.authManager.getCurrentUser() : null;
    }

    /**
     * 現在のユーザーの学籍番号を取得
     */
    getCurrentStudentNumber() {
        const user = this.getCurrentUser();
        return user ? user.studentNumber : null;
    }

    /**
     * 現在のユーザーの名前を取得
     */
    getCurrentStudentName() {
        const user = this.getCurrentUser();
        return user ? user.name : null;
    }

    /**
     * 座席数の更新
     */
    updateSeatCapacity(newCapacity) {
        console.log('座席数更新:', newCapacity);
        this.settings.seatCapacity = newCapacity;
    }

    /**
     * 認証状態のチェック
     */
    isUserAuthenticated() {
        return window.authManager && window.authManager.isLoggedIn();
    }

    /**
     * 学生データの作成（認証ユーザー用）
     */
    createStudentData() {
        if (!this.isUserAuthenticated()) {
            return null;
        }

        const user = this.getCurrentUser();
        return {
            name: user.name,
            number: user.studentNumber,
            preferences: [],
            assigned: false,
            assignedSeat: null
        };
    }

    /**
     * UIの初期化（認証システム対応）
     */
    initializeUI() {
        console.log('AttendanceManager UI初期化開始（認証システム対応）');

        // 認証システムに依存するため、特別な初期化は不要
        this.isInitialized = true;
        console.log('AttendanceManager UI初期化完了');
        console.log('現在の設定:', this.settings);
    }

    /**
     * 設定を取得
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * 設定をリセット
     */
    resetSettings() {
        console.log('設定をリセット');
        this.settings = {
            seatCapacity: 25
        };
    }
}

// グローバルに公開
window.AttendanceManager = AttendanceManager;