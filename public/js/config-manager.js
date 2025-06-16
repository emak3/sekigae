/**
 * 設定管理クラス
 * アプリケーション全体の設定を一元管理
 */
class ConfigManager {
    constructor() {
        this.defaultConfig = {
            // グリッド設定
            grid: {
                rows: 5,
                cols: 5,
                disabledSeats: [],
                minSize: 3,
                maxSize: 8
            },
            
            // 出席番号設定
            attendance: {
                maxNumber: 25,
                seatCapacity: 25,
                absentEnabled: false,
                absentNumbers: [],
                autoNumbering: true
            },
            
            // UI設定
            ui: {
                theme: 'light',
                animationsEnabled: true,
                autoSave: true,
                showTutorial: true,
                language: 'ja'
            },
            
            // アプリケーション設定
            app: {
                version: '2.0.0',
                autoAssignSeats: false,
                preferenceWeights: {
                    first: 3,
                    second: 2,
                    third: 1
                },
                maxStudentsPerClass: 50
            },
            
            // 通信設定
            connection: {
                timeout: 5000,
                retryAttempts: 3,
                retryDelay: 1000,
                enableOfflineMode: true
            },
            
            // ローカルストレージキー
            storageKeys: {
                students: 'seat_simulator_students',
                assignments: 'seat_simulator_assigned',
                gridConfig: 'seat_simulator_grid_config',
                userSettings: 'seat_simulator_user_settings',
                attendanceSettings: 'seat_simulator_attendance_settings'
            }
        };
        
        this.config = { ...this.defaultConfig };
        this.loadUserSettings();
    }

    /**
     * ユーザー設定の読み込み
     */
    loadUserSettings() {
        try {
            const saved = StorageUtils.get(this.config.storageKeys.userSettings);
            if (saved) {
                this.config = this.mergeConfig(this.config, saved);
                console.log('ユーザー設定を読み込みました:', saved);
            }
        } catch (error) {
            console.error('ユーザー設定の読み込みエラー:', error);
        }
    }

    /**
     * 設定の深いマージ
     */
    mergeConfig(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    result[key] = this.mergeConfig(target[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    /**
     * 設定値の取得
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current[key] === undefined) {
                return defaultValue;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * 設定値の設定
     */
    set(path, value, save = true) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;
        
        for (const key of keys) {
            if (typeof current[key] !== 'object' || current[key] === null) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
        
        if (save) {
            this.saveUserSettings();
        }
        
        console.log(`設定更新: ${path} = ${JSON.stringify(value)}`);
    }

    /**
     * ユーザー設定の保存
     */
    saveUserSettings() {
        try {
            // デフォルト設定との差分のみを保存
            const userSettings = this.getDifferences(this.config, this.defaultConfig);
            StorageUtils.set(this.config.storageKeys.userSettings, userSettings);
            console.log('ユーザー設定を保存しました');
        } catch (error) {
            console.error('ユーザー設定の保存エラー:', error);
        }
    }

    /**
     * 二つのオブジェクトの差分を取得
     */
    getDifferences(current, defaults) {
        const differences = {};
        
        for (const key in current) {
            if (current.hasOwnProperty(key)) {
                if (typeof current[key] === 'object' && current[key] !== null && !Array.isArray(current[key])) {
                    const nestedDiff = this.getDifferences(current[key], defaults[key] || {});
                    if (Object.keys(nestedDiff).length > 0) {
                        differences[key] = nestedDiff;
                    }
                } else if (JSON.stringify(current[key]) !== JSON.stringify(defaults[key])) {
                    differences[key] = current[key];
                }
            }
        }
        
        return differences;
    }

    /**
     * グリッド設定の取得
     */
    getGridConfig() {
        return {
            rows: this.get('grid.rows'),
            cols: this.get('grid.cols'),
            disabledSeats: this.get('grid.disabledSeats', []),
            minSize: this.get('grid.minSize'),
            maxSize: this.get('grid.maxSize')
        };
    }

    /**
     * グリッド設定の更新
     */
    updateGridConfig(config) {
        if (ValidationUtils.isValidGridSize(config.rows, config.cols)) {
            this.set('grid.rows', config.rows, false);
            this.set('grid.cols', config.cols, false);
            
            if (config.disabledSeats) {
                this.set('grid.disabledSeats', config.disabledSeats, false);
            }
            
            this.saveUserSettings();
            return true;
        }
        return false;
    }

    /**
     * 出席番号設定の取得
     */
    getAttendanceConfig() {
        return {
            maxNumber: this.get('attendance.maxNumber'),
            seatCapacity: this.get('attendance.seatCapacity'),
            absentEnabled: this.get('attendance.absentEnabled'),
            absentNumbers: this.get('attendance.absentNumbers', []),
            autoNumbering: this.get('attendance.autoNumbering')
        };
    }

    /**
     * 出席番号設定の更新
     */
    updateAttendanceConfig(config) {
        for (const key in config) {
            if (config.hasOwnProperty(key)) {
                this.set(`attendance.${key}`, config[key], false);
            }
        }
        this.saveUserSettings();
    }

    /**
     * UI設定の取得
     */
    getUIConfig() {
        return {
            theme: this.get('ui.theme'),
            animationsEnabled: this.get('ui.animationsEnabled'),
            autoSave: this.get('ui.autoSave'),
            showTutorial: this.get('ui.showTutorial'),
            language: this.get('ui.language')
        };
    }

    /**
     * アプリケーション設定の取得
     */
    getAppConfig() {
        return {
            version: this.get('app.version'),
            autoAssignSeats: this.get('app.autoAssignSeats'),
            preferenceWeights: this.get('app.preferenceWeights'),
            maxStudentsPerClass: this.get('app.maxStudentsPerClass')
        };
    }

    /**
     * 通信設定の取得
     */
    getConnectionConfig() {
        return {
            timeout: this.get('connection.timeout'),
            retryAttempts: this.get('connection.retryAttempts'),
            retryDelay: this.get('connection.retryDelay'),
            enableOfflineMode: this.get('connection.enableOfflineMode')
        };
    }

    /**
     * ストレージキーの取得
     */
    getStorageKey(key) {
        return this.get(`storageKeys.${key}`);
    }

    /**
     * 設定の妥当性チェック
     */
    validateConfig() {
        const errors = [];
        
        // グリッド設定のチェック
        const gridConfig = this.getGridConfig();
        if (!ValidationUtils.isValidGridSize(gridConfig.rows, gridConfig.cols)) {
            errors.push('グリッドサイズが無効です');
        }
        
        // 出席番号設定のチェック
        const attendanceConfig = this.getAttendanceConfig();
        if (attendanceConfig.maxNumber < 1 || attendanceConfig.maxNumber > 100) {
            errors.push('出席番号上限が無効です');
        }
        
        if (attendanceConfig.absentNumbers.some(num => num < 1 || num > attendanceConfig.maxNumber)) {
            errors.push('欠番設定に無効な番号があります');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 設定をデフォルトにリセット
     */
    reset() {
        this.config = { ...this.defaultConfig };
        StorageUtils.remove(this.config.storageKeys.userSettings);
        console.log('設定をデフォルトにリセットしました');
    }

    /**
     * 設定をエクスポート
     */
    export() {
        return {
            timestamp: new Date().toISOString(),
            version: this.get('app.version'),
            config: this.config
        };
    }

    /**
     * 設定をインポート
     */
    import(data) {
        try {
            if (data.config) {
                this.config = this.mergeConfig(this.defaultConfig, data.config);
                this.saveUserSettings();
                console.log('設定をインポートしました');
                return true;
            }
        } catch (error) {
            console.error('設定のインポートエラー:', error);
        }
        return false;
    }

    /**
     * 設定のデバッグ情報出力
     */
    debug() {
        console.group('🔧 設定管理デバッグ情報');
        console.log('現在の設定:', this.config);
        console.log('デフォルト設定:', this.defaultConfig);
        console.log('ユーザー設定の差分:', this.getDifferences(this.config, this.defaultConfig));
        console.log('設定の妥当性:', this.validateConfig());
        console.log('ストレージ使用量:', FormatUtils.formatFileSize(StorageUtils.getUsage()));
        console.groupEnd();
    }

    /**
     * 座席の総数を計算
     */
    getTotalSeats() {
        const gridConfig = this.getGridConfig();
        return gridConfig.rows * gridConfig.cols - gridConfig.disabledSeats.length;
    }

    /**
     * 有効な出席番号の数を計算
     */
    getValidNumbersCount() {
        const attendanceConfig = this.getAttendanceConfig();
        let count = attendanceConfig.maxNumber;
        
        if (attendanceConfig.absentEnabled) {
            count -= attendanceConfig.absentNumbers.length;
        }
        
        return count;
    }

    /**
     * 座席と出席番号の整合性チェック
     */
    checkCapacityConsistency() {
        const totalSeats = this.getTotalSeats();
        const validNumbers = this.getValidNumbersCount();
        
        return {
            totalSeats,
            validNumbers,
            hasCapacity: totalSeats >= validNumbers,
            difference: totalSeats - validNumbers
        };
    }
}

// グローバルに公開
window.ConfigManager = ConfigManager;

console.log('設定管理クラスが読み込まれました');