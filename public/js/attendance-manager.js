/**
 * 出席番号管理クラス
 * スライダーでの上限設定と欠番管理機能を提供
 */
class AttendanceManager {
    constructor(socketManager) {
        this.socketManager = socketManager;
        this.settings = {
            maxNumber: 35,
            seatCapacity: 25,
            absentEnabled: false,
            absentNumbers: []
        };

        this.isInitialized = false;
        this.setupEventHandlers();
    }

    /**
     * イベントハンドラーの設定
     */
    setupEventHandlers() {
        this.socketManager.on('roomData', (data) => {
            if (data.attendanceSettings) {
                this.updateSettings(data.attendanceSettings);
            }
        });

        this.socketManager.on('attendanceSettingsUpdated', (settings) => {
            this.updateSettings(settings);
        });
    }

    /**
     * 設定の更新
     */
    updateSettings(settings) {
        console.log('設定を更新:', settings);
        this.settings = { ...this.settings, ...settings };
        if (this.isInitialized) {
            this.updateUI();
        }
    }

    /**
     * 座席数変更時の出席番号上限調整
     */
    updateSeatCapacity(newCapacity) {
        console.log('座席数更新:', newCapacity);
        this.settings.seatCapacity = newCapacity;

        // スライダーの範囲を更新
        const slider = document.getElementById('attendanceRange');
        if (slider) {
            const newMin = newCapacity;
            const newMax = newCapacity + 20;

            slider.min = newMin;
            slider.max = newMax;

            // 現在値が範囲外の場合は調整
            if (this.settings.maxNumber < newMin) {
                this.settings.maxNumber = newMin;
                slider.value = newMin;
            } else if (this.settings.maxNumber > newMax) {
                this.settings.maxNumber = newMax;
                slider.value = newMax;
            }

            this.updateSliderDisplay();
        }

        this.updateCapacityIndicator();
    }

    /**
     * スライダーの初期化
     */
    initializeSlider() {
        const slider = document.getElementById('attendanceRange');
        if (!slider) {
            console.error('スライダー要素が見つかりません');
            return;
        }

        console.log('スライダーを初期化中...');

        // 初期値設定
        slider.min = this.settings.seatCapacity;
        slider.max = this.settings.seatCapacity + 20;
        slider.value = this.settings.maxNumber;

        // イベントリスナー
        slider.addEventListener('input', (e) => {
            console.log('スライダー値変更:', e.target.value);
            this.settings.maxNumber = parseInt(e.target.value);
            this.updateSliderDisplay();
            this.saveSettings();
        });

        this.updateSliderDisplay();
        console.log('スライダー初期化完了');
    }

    /**
     * 欠番トグルの初期化
     */
    initializeAbsentToggle() {
        const toggle = document.getElementById('absentToggle');
        const inputContainer = document.getElementById('absentNumbersInput');

        if (!toggle) {
            console.error('欠番トグル要素が見つかりません');
            return;
        }

        if (!inputContainer) {
            console.error('欠番入力コンテナが見つかりません');
            return;
        }

        console.log('欠番トグルを初期化中...');

        // 初期状態設定
        toggle.checked = this.settings.absentEnabled;
        this.updateAbsentToggleDisplay();

        // トグルイベント
        toggle.addEventListener('change', (e) => {
            console.log('欠番トグル変更:', e.target.checked);
            this.settings.absentEnabled = e.target.checked;
            this.updateAbsentToggleDisplay();

            if (e.target.checked) {
                console.log('欠番トグルON - グリッドを生成');
                this.generateAbsentToggles();
            } else {
                console.log('欠番トグルOFF - 欠番リセット');
                this.settings.absentNumbers = [];
            }

            this.updateAbsentSummary();
            this.saveSettings();
        });

        this.updateAbsentSummary();
        console.log('欠番トグル初期化完了');
    }

    /**
    * 欠番トグル表示状態の更新
    */
    updateAbsentToggleDisplay() {
        const inputContainer = document.getElementById('absentNumbersInput');
        if (!inputContainer) return;

        console.log('欠番表示状態更新:', this.settings.absentEnabled);

        if (this.settings.absentEnabled) {
            inputContainer.classList.add('active');
        } else {
            inputContainer.classList.remove('active');
        }
    }
    /**
     * スライダー表示の更新
     */
    updateSliderDisplay() {
        const valueDisplay = document.getElementById('attendanceValue');

        if (valueDisplay) {
            valueDisplay.textContent = this.settings.maxNumber;
        }

        // 出席番号上限が変更された場合、欠番トグルを再生成
        if (this.settings.absentEnabled) {
            // 上限を超える欠番を削除
            const oldLength = this.settings.absentNumbers.length;
            this.settings.absentNumbers = this.settings.absentNumbers.filter(num => num <= this.settings.maxNumber);

            if (oldLength !== this.settings.absentNumbers.length) {
                console.log('上限変更により欠番を調整しました');
            }

            this.generateAbsentToggles();
            this.updateAbsentSummary();
        }

        this.updateCapacityIndicator();
    }

    /**
     * 座席数との比較表示更新
     */
    updateCapacityIndicator() {
        const indicator = document.getElementById('capacityIndicator');
        if (!indicator) return;

        const excess = this.settings.maxNumber - this.settings.seatCapacity;

        if (excess <= 0) {
            indicator.textContent = '座席数内';
            indicator.className = 'capacity-indicator';
        } else if (excess <= 10) {
            indicator.textContent = `座席数+${excess}`;
            indicator.className = 'capacity-indicator warning';
        } else {
            indicator.textContent = `座席数+${excess} (要注意)`;
            indicator.className = 'capacity-indicator error';
        }
    }

    /**
     * 欠番トグルの初期化
     */
    initializeAbsentToggle() {
        const toggle = document.getElementById('absentToggle');
        const inputContainer = document.querySelector('.absent-numbers-input');

        if (!toggle || !inputContainer) return;

        // 初期状態設定
        toggle.checked = this.settings.absentEnabled;
        inputContainer.className = `absent-numbers-input ${this.settings.absentEnabled ? 'active' : ''}`;

        // トグルイベント
        toggle.addEventListener('change', (e) => {
            this.settings.absentEnabled = e.target.checked;
            inputContainer.className = `absent-numbers-input ${e.target.checked ? 'active' : ''}`;

            if (e.target.checked) {
                this.generateAbsentToggles();
            }

            this.updateAbsentSummary();
            this.saveSettings();
        });

        // 初期生成
        if (this.settings.absentEnabled) {
            this.generateAbsentToggles();
        }

        this.updateAbsentSummary();
    }

    /**
     * 出席番号ごとのON/OFFトグルを生成
     */
    generateAbsentToggles() {
        const container = document.getElementById('absentNumbersGrid');
        if (!container) {
            console.error('欠番グリッドコンテナが見つかりません');
            return;
        }

        console.log(`${this.settings.maxNumber}個のトグルを生成中...`);
        container.innerHTML = '';

        for (let i = 1; i <= this.settings.maxNumber; i++) {
            const toggleItem = this.createNumberToggle(i);
            container.appendChild(toggleItem);
        }

        console.log('トグル生成完了');
    }

    /**
     * 個別の出席番号トグルを作成
     */
    createNumberToggle(number) {
        const item = document.createElement('div');
        item.className = 'number-toggle-item';
        const isAbsent = this.settings.absentNumbers.includes(number);

        if (isAbsent) {
            item.classList.add('absent');
        }

        item.innerHTML = `
            <div class="number-label">${number}番</div>
            <label class="mini-toggle-switch">
                <input type="checkbox" 
                       data-number="${number}"
                       ${isAbsent ? 'checked' : ''}>
                <span class="mini-toggle-slider"></span>
            </label>
            <div class="toggle-status ${isAbsent ? 'absent' : 'present'}">
                ${isAbsent ? '欠番' : '有効'}
            </div>
        `;

        // イベントリスナー追加
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            console.log(`${number}番の状態変更:`, e.target.checked);
            this.toggleAbsentNumber(number, e.target.checked);
        });

        return item;
    }

    /**
     * 個別の出席番号の欠番設定を切り替え
     */
    toggleAbsentNumber(number, isAbsent) {
        const index = this.settings.absentNumbers.indexOf(number);

        if (isAbsent && index === -1) {
            // 欠番に設定
            this.settings.absentNumbers.push(number);
            this.settings.absentNumbers.sort((a, b) => a - b);
            console.log(`${number}番を欠番に設定`);
        } else if (!isAbsent && index !== -1) {
            // 欠番を解除
            this.settings.absentNumbers.splice(index, 1);
            console.log(`${number}番の欠番を解除`);
        }

        // UI更新
        this.updateToggleItemStatus(number, isAbsent);
        this.updateAbsentSummary();
        this.saveSettings();
    }

    /**
 * 欠番サマリーの更新
 */
    updateAbsentSummary() {
        const countElement = document.getElementById('absentCount');
        const listElement = document.getElementById('absentList');

        if (countElement) {
            countElement.textContent = this.settings.absentNumbers.length;
        }

        if (listElement) {
            if (this.settings.absentNumbers.length === 0) {
                listElement.textContent = '';
            } else {
                const numbers = this.settings.absentNumbers.slice(0, 10);
                const displayText = numbers.join(', ') + '番';
                if (this.settings.absentNumbers.length > 10) {
                    listElement.textContent = ` (${displayText}...)`;
                } else {
                    listElement.textContent = ` (${displayText})`;
                }
            }
        }
    }

    /**
     * 個別トグルアイテムの表示状態更新
     */
    updateToggleItemStatus(number, isAbsent) {
        const container = document.getElementById('absentNumbersGrid');
        if (!container) return;

        const toggleItem = container.querySelector(`[data-number="${number}"]`)?.closest('.number-toggle-item');
        const statusElement = toggleItem?.querySelector('.toggle-status');

        if (toggleItem && statusElement) {
            if (isAbsent) {
                toggleItem.classList.add('absent');
                statusElement.textContent = '欠番';
                statusElement.className = 'toggle-status absent';
            } else {
                toggleItem.classList.remove('absent');
                statusElement.textContent = '有効';
                statusElement.className = 'toggle-status present';
            }
        }
    }

    /**
     * 欠番リストの更新
     */
    updateAbsentNumbers(inputValue) {
        this.settings.absentNumbers = [];

        if (inputValue.trim()) {
            const numbers = inputValue.split(',')
                .map(n => parseInt(n.trim()))
                .filter(n => !isNaN(n) && n > 0 && n <= this.settings.maxNumber);

            this.settings.absentNumbers = [...new Set(numbers)].sort((a, b) => a - b);
        }
    }

    /**
     * 欠番プレビューの更新
     */
    updateAbsentPreview() {
        const preview = document.getElementById('absentPreview');
        if (!preview) return;

        if (!this.settings.absentEnabled || this.settings.absentNumbers.length === 0) {
            preview.textContent = '欠番なし';
        } else {
            preview.textContent = `欠番: ${this.settings.absentNumbers.join(', ')}番`;
        }
    }

    /**
     * 有効な出席番号リストを取得（欠番を除外）
     */
    getValidNumbers() {
        const numbers = [];
        for (let i = 1; i <= this.settings.maxNumber; i++) {
            if (!this.settings.absentEnabled || !this.settings.absentNumbers.includes(i)) {
                numbers.push(i);
            }
        }
        console.log('有効な出席番号:', numbers.length + '個');
        return numbers;
    }

    /**
     * 設定の保存
     */
    saveSettings() {
        console.log('設定を保存:', this.settings);
        this.socketManager.sendData('updateAttendanceSettings', this.settings);
        
        if (window.uiManager) {
            window.uiManager.updateStudentNumberOptions();
        }
    }

    /**
     * UIの初期化
     */
    initializeUI() {
        console.log('AttendanceManager UI初期化開始');

        // 要素の存在確認
        const slider = document.getElementById('attendanceRange');
        const toggle = document.getElementById('absentToggle');

        if (!slider) {
            console.error('attendanceRange要素が見つかりません');
            return;
        }

        if (!toggle) {
            console.error('absentToggle要素が見つかりません');
            return;
        }

        this.initializeSlider();
        this.initializeAbsentToggle();

        this.isInitialized = true;
        console.log('AttendanceManager UI初期化完了');
        console.log('現在の設定:', this.settings);
    }

    /**
     * 全UIの更新
     */
    updateUI() {
        console.log('UI全体を更新');
        this.updateSliderDisplay();
        this.updateAbsentToggleDisplay();
        
        // 欠番トグルの再生成
        if (this.settings.absentEnabled) {
            this.generateAbsentToggles();
        }
        
        this.updateAbsentSummary();
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
            maxNumber: this.settings.seatCapacity + 10,
            seatCapacity: this.settings.seatCapacity,
            absentEnabled: false,
            absentNumbers: []
        };
        
        this.updateUI();
        this.saveSettings();
    }
}

// グローバルに公開
window.AttendanceManager = AttendanceManager;