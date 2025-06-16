/**
 * メインアプリケーション
 * 各管理クラスを統合し、アプリケーション全体を制御
 */
class SeatSimulatorApp {
    constructor() {
        this.socketManager = null;
        this.seatManager = null;
        this.uiManager = null;
        this.isInitialized = false;
    }

    /**
     * アプリケーションの初期化
     */
    async initialize() {
        try {
            console.log('席替えシミュレーター初期化開始');

            // 初期化順序は重要
            await this.initializeSocketManager();
            await this.initializeSeatManager();
            await this.initializeUIManager();

            // グローバル参照の設定
            this.setupGlobalReferences();

            // 初期化完了
            this.isInitialized = true;
            console.log('席替えシミュレーター初期化完了');

            // 初期化完了通知
            this.onInitializationComplete();

        } catch (error) {
            console.error('アプリケーション初期化エラー:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Socket Manager の初期化
     */
    async initializeSocketManager() {
        console.log('SocketManager初期化中...');

        this.socketManager = new SocketManager();
        await this.socketManager.initialize();

        console.log('SocketManager初期化完了');
    }

    /**
     * Seat Manager の初期化
     */
    async initializeSeatManager() {
        console.log('SeatManager初期化中...');

        this.seatManager = new SeatManager(this.socketManager);

        console.log('SeatManager初期化完了');
    }

    /**
     * Attendance Manager の初期化
     */
    async initializeAttendanceManager() {
        console.log('AttendanceManager初期化中...');

        this.attendanceManager = new AttendanceManager(this.socketManager);

        console.log('AttendanceManager初期化完了');
    }

    // 既存のinitialize()メソッドに追加
    async initialize() {
        try {
            console.log('席替えシミュレーター初期化開始');

            await this.initializeSocketManager();
            await this.initializeSeatManager();
            await this.initializeAttendanceManager(); // 追加
            await this.initializeUIManager();

            this.setupGlobalReferences();

            this.isInitialized = true;
            console.log('席替えシミュレーター初期化完了');

            this.onInitializationComplete();

        } catch (error) {
            console.error('アプリケーション初期化エラー:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * UI Manager の初期化
     */
    async initializeUIManager() {
        console.log('UIManager初期化中...');

        this.uiManager = new UIManager(this.socketManager, this.seatManager);

        // 初期化完了通知
        this.uiManager.onInitialized();

        console.log('UIManager初期化完了');
    }

    /**
     * グローバル参照の設定
     */
    setupGlobalReferences() {
        // デバッグやコンソールからのアクセス用
        window.app = this;
        window.socketManager = this.socketManager;
        window.seatManager = this.seatManager;
        window.attendanceManager = this.attendanceManager;
        window.uiManager = this.uiManager;
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
                version: '1.0.0'
            }
        });
        document.dispatchEvent(event);

        // サービスワーカーの登録（将来の機能拡張用）
        this.registerServiceWorker();
    }

    /**
     * 初期化エラーの処理
     */
    handleInitializationError(error) {
        console.error('アプリケーション初期化に失敗しました:', error);

        // ユーザーにエラーを表示
        const errorElement = document.createElement('div');
        errorElement.className = 'initialization-error';
        errorElement.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>アプリケーションの初期化に失敗しました</h3>
                <p>ページを再読み込みしてください。問題が続く場合は、ブラウザのキャッシュをクリアしてみてください。</p>
                <button onclick="window.location.reload()" class="btn-primary">
                    <i class="fas fa-redo"></i>
                    ページを再読み込み
                </button>
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
        `;

        const errorContent = errorElement.querySelector('.error-content');
        errorContent.style.cssText = `
            background-color: #1e293b;
            padding: 2rem;
            border-radius: 1rem;
            max-width: 400px;
            margin: 1rem;
        `;

        document.body.appendChild(errorElement);
    }

    /**
     * サービスワーカーの登録
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // 本番環境でのみサービスワーカーを登録
                if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
                    console.log('サービスワーカーの登録をスキップします（開発環境）');
                }
            } catch (error) {
                console.log('サービスワーカーの登録に失敗しました:', error);
            }
        }
    }

    /**
     * アプリケーションの状態を取得
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            socket: this.socketManager?.getConnectionStatus(),
            currentTab: this.uiManager?.getCurrentTab(),
            studentsCount: this.uiManager?.getStudents()?.length || 0,
            gridConfig: this.seatManager?.getGridConfig()
        };
    }

    /**
     * アプリケーションのクリーンアップ
     */
    cleanup() {
        console.log('アプリケーションをクリーンアップ中...');

        try {
            // Socket接続の切断
            if (this.socketManager) {
                this.socketManager.disconnect();
            }

            // イベントリスナーの削除
            this.removeEventListeners();

            // グローバル参照のクリア
            delete window.app;
            delete window.socketManager;
            delete window.seatManager;
            delete window.uiManager;

            console.log('アプリケーションのクリーンアップ完了');

        } catch (error) {
            console.error('クリーンアップエラー:', error);
        }
    }

    /**
     * イベントリスナーの削除
     */
    removeEventListeners() {
        // ページ離脱時のイベントリスナーを削除
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('unload', this.handleUnload);
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
     * デバッグ情報の出力
     */
    debug() {
        const status = this.getStatus();
        console.group('🎯 席替えシミュレーター デバッグ情報');
        console.log('📊 アプリケーション状態:', status);
        console.log('🔌 Socket接続状態:', status.socket);
        console.log('📝 生徒数:', status.studentsCount);
        console.log('⚙️ グリッド設定:', status.gridConfig);
        console.log('📱 現在のタブ:', status.currentTab);
        console.groupEnd();

        return status;
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

    // 初期化開始
    await app.initialize();

    return app;
}

/**
 * エラーハンドリング
 */
window.addEventListener('error', (event) => {
    console.error('未処理のエラー:', event.error);

    // 重要なエラーの場合はユーザーに通知
    if (window.uiManager && event.error && !event.error.toString().includes('ResizeObserver')) {
        window.uiManager.showMessage(
            'アプリケーションでエラーが発生しました。ページを再読み込みしてください。',
            'error'
        );
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromise拒否:', event.reason);

    // Socket.io関連のエラーは通常の動作なので無視
    if (event.reason && event.reason.toString().includes('socket.io')) {
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
        console.log('アプリケーションがまだ初期化されていません');
        return null;
    }
};

// コンソールでの使い方説明
console.log(`
🎯 席替えシミュレーター
デバッグコマンド:
- debugApp() : アプリケーション状態の表示
- app.getStatus() : 詳細ステータス
- socketManager.getConnectionStatus() : 接続状態
- seatManager.getGridConfig() : グリッド設定
- uiManager.getStudents() : 生徒一覧
`);

// アプリケーション開始
startApp().catch(error => {
    console.error('アプリケーションの開始に失敗しました:', error);
});