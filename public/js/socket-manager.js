/**
 * Socket.io通信管理クラス
 * リアルタイム同期とオフラインモードのフォールバック機能を提供
 */
class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.roomId = this.getRoomIdFromURL();
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
    }

    /**
     * URLパラメータから部屋IDを取得
     */
    getRoomIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('room') || 'default';
    }

    /**
     * Socket.ioの初期化と接続
     */
    async initialize() {
        try {
            console.log(`Socket.io初期化開始 - 部屋ID: ${this.roomId}`);
            
            if (typeof io === 'undefined') {
                throw new Error('Socket.IOライブラリが読み込まれていません');
            }

            // Socket.ioインスタンスを作成
            this.socket = io({
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: this.reconnectDelay,
                timeout: 5000,
                transports: ['websocket', 'polling']
            });

            this.setupEventHandlers();
            
            // 接続タイムアウト（5秒後にローカルモードに切り替え）
            setTimeout(() => {
                if (!this.isConnected) {
                    console.log('接続タイムアウト - ローカルモードに切り替えます');
                    this.enableLocalMode();
                }
            }, 5000);

        } catch (error) {
            console.error('Socket.io初期化エラー:', error);
            this.enableLocalMode();
        }
    }

    /**
     * Socket.ioイベントハンドラーの設定
     */
    setupEventHandlers() {
        if (!this.socket) return;

        // 接続成功
        this.socket.on('connect', () => {
            console.log(`Socket.io接続成功: ${this.socket.id}`);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus();
            
            // 部屋に参加
            this.socket.emit('joinRoom', this.roomId);
            this.emit('connected', { roomId: this.roomId });
        });

        // 接続エラー
        this.socket.on('connect_error', (error) => {
            console.error('Socket.io接続エラー:', error);
            this.handleConnectionError();
        });

        // 切断
        this.socket.on('disconnect', (reason) => {
            console.log(`Socket.io切断: ${reason}`);
            this.isConnected = false;
            this.updateConnectionStatus();
            this.emit('disconnected', { reason });
        });

        // 再接続
        this.socket.on('reconnect', () => {
            console.log('Socket.io再接続成功');
            this.isConnected = true;
            this.updateConnectionStatus();
            
            // 再接続時は部屋に再参加してデータを要求
            this.socket.emit('joinRoom', this.roomId);
            this.socket.emit('requestData');
            this.emit('reconnected');
        });

        // データ受信イベント
        this.socket.on('roomData', (data) => {
            console.log('部屋データ受信:', data);
            this.emit('roomData', data);
        });

        this.socket.on('studentsUpdated', (data) => {
            console.log('生徒データ更新受信');
            this.emit('studentsUpdated', data);
        });

        this.socket.on('assignedSeatsUpdated', (data) => {
            console.log('座席割り当て更新受信');
            this.emit('assignedSeatsUpdated', data);
        });

        this.socket.on('gridConfigUpdated', (data) => {
            console.log('グリッド設定更新受信');
            this.emit('gridConfigUpdated', data);
        });
    }

    /**
     * 接続エラーの処理
     */
    handleConnectionError() {
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('最大再接続試行回数に達しました - ローカルモードに切り替えます');
            this.enableLocalMode();
        }
    }

    /**
     * ローカルモード（オフライン）を有効化
     */
    enableLocalMode() {
        console.log('ローカルモードを有効化');
        this.isConnected = false;
        
        // ダミーのSocketオブジェクトを作成
        this.socket = {
            emit: (event, data) => {
                console.log(`[ローカル] イベント送信: ${event}`);
                this.handleLocalEmit(event, data);
            }
        };

        this.updateConnectionStatus();
        this.loadLocalData();
        this.emit('localModeEnabled');
    }

    /**
     * ローカルモードでのデータ送信処理
     */
    handleLocalEmit(event, data) {
        switch (event) {
            case 'updateStudents':
                localStorage.setItem('seat_simulator_students', JSON.stringify(data));
                break;
            
            case 'updateAssignedSeats':
                localStorage.setItem('seat_simulator_assigned', JSON.stringify(data));
                break;
            
            case 'updateGridConfig':
                localStorage.setItem('seat_simulator_grid_config', JSON.stringify(data));
                this.emit('gridConfigUpdated', data);
                break;
            
            case 'clearAllData':
                localStorage.removeItem('seat_simulator_students');
                localStorage.removeItem('seat_simulator_assigned');
                this.emit('dataCleared');
                break;
        }
    }

    /**
     * ローカルストレージからデータを読み込み
     */
    loadLocalData() {
        try {
            const students = localStorage.getItem('seat_simulator_students');
            const assignedSeats = localStorage.getItem('seat_simulator_assigned');
            const gridConfig = localStorage.getItem('seat_simulator_grid_config');

            const data = {
                students: students ? JSON.parse(students) : [],
                assignedSeats: assignedSeats ? JSON.parse(assignedSeats) : [],
                gridConfig: gridConfig ? JSON.parse(gridConfig) : {
                    rows: 5,
                    cols: 5,
                    disabledSeats: []
                },
                timestamp: Date.now()
            };

            // 少し遅延させてからデータを送信（初期化の完了を待つ）
            setTimeout(() => {
                this.emit('roomData', data);
            }, 100);

        } catch (error) {
            console.error('ローカルデータの読み込みエラー:', error);
        }
    }

    /**
     * 接続状態表示の更新
     */
    updateConnectionStatus() {
        const statusElement = document.getElementById('statusText');
        const statusContainer = document.getElementById('connectionStatus');
        const icon = statusContainer.querySelector('i');

        if (!statusElement || !statusContainer || !icon) return;

        if (this.isConnected) {
            statusElement.textContent = 'オンライン';
            statusContainer.className = 'connection-status online';
            icon.className = 'fas fa-check-circle';
        } else {
            statusElement.textContent = 'オフライン';
            statusContainer.className = 'connection-status offline';
            icon.className = 'fas fa-exclamation-triangle';
        }

        // 部屋ID表示の更新
        const roomIdElement = document.getElementById('roomIdDisplay');
        if (roomIdElement) {
            roomIdElement.textContent = this.roomId;
        }
    }

    /**
     * データ送信
     */
    sendData(event, data) {
        if (this.socket) {
            this.socket.emit(event, data);
        } else {
            console.warn('Socket未初期化 - データ送信をスキップします');
        }
    }

    /**
     * 部屋の変更
     */
    changeRoom(newRoomId) {
        if (newRoomId && newRoomId.trim() !== '') {
            const url = new URL(window.location);
            url.searchParams.set('room', newRoomId);
            window.location.href = url.toString();
        }
    }

    /**
     * イベントリスナーの登録
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    /**
     * イベントの発火
     */
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`イベントハンドラーエラー (${event}):`, error);
                }
            });
        }
    }

    /**
     * 接続状態の取得
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            roomId: this.roomId,
            socketId: this.socket?.id || null
        };
    }

    /**
     * 接続の切断
     */
    disconnect() {
        if (this.socket && typeof this.socket.disconnect === 'function') {
            this.socket.disconnect();
        }
        this.isConnected = false;
        this.updateConnectionStatus();
    }
}

// グローバルに公開
window.SocketManager = SocketManager;