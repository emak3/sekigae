/**
 * UI管理クラス
 * タブ切り替え、メッセージ表示、フォーム処理などのUI機能を管理
 */
class UIManager {
    constructor(socketManager, seatManager) {
        this.socketManager = socketManager;
        this.seatManager = seatManager;
        this.students = [];
        this.currentTab = 'seat-selection';

        this.initializeElements();
        this.setupEventHandlers();
        this.setupSocketHandlers();
    }

    /**
     * DOM要素の初期化
     */
    initializeElements() {
        // Tab elements
        this.tabButtons = document.querySelectorAll('.nav-tab');
        this.tabContents = document.querySelectorAll('.tab-content');

        // Form elements
        this.studentNameInput = document.getElementById('studentName');
        this.studentNumberSelect = document.getElementById('studentNumber');
        this.gridRowsInput = document.getElementById('gridRows');
        this.gridColsInput = document.getElementById('gridCols');

        // Button elements
        this.submitButton = document.getElementById('submitSelection');
        this.resetButton = document.getElementById('resetSelection');
        this.assignButton = document.getElementById('assignSeats');
        this.assignRandomButton = document.getElementById('assignRandom');
        this.clearAssignmentsButton = document.getElementById('clearAssignments');
        this.clearAllButton = document.getElementById('clearAllStudents');
        this.updateGridButton = document.getElementById('updateGrid');
        this.saveSettingsButton = document.getElementById('saveSettings');
        this.resetSettingsButton = document.getElementById('resetSettings');
        this.changeRoomButton = document.getElementById('changeRoom');

        // Container elements
        this.messageArea = document.getElementById('messageArea');
        this.studentList = document.getElementById('studentList');
    }

    /**
     * イベントハンドラーの設定
     */
    setupEventHandlers() {
        // Tab navigation
        this.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Form submissions
        if (this.submitButton) {
            this.submitButton.addEventListener('click', () => {
                // 選択を確定してから提出処理
                if (window.selectionStateManager) {
                    window.selectionStateManager.confirmSelection();
                }
                this.handleSubmitSelection();
            });
        }

        if (this.resetButton) {
            this.resetButton.addEventListener('click', () => this.handleResetSelection());
        }

        // Seat assignment
        if (this.assignButton) {
            this.assignButton.addEventListener('click', () => this.seatManager.assignSeats());
        }

        if (this.assignRandomButton) {
            this.assignRandomButton.addEventListener('click', () => this.seatManager.assignRandomSeats());
        }

        if (this.clearAssignmentsButton) {
            this.clearAssignmentsButton.addEventListener('click', () => this.handleClearAssignments());
        }

        // Student management
        if (this.clearAllButton) {
            this.clearAllButton.addEventListener('click', () => this.handleClearAllStudents());
        }

        // Settings
        if (this.updateGridButton) {
            this.updateGridButton.addEventListener('click', () => this.handleUpdateGrid());
        }

        if (this.saveSettingsButton) {
            this.saveSettingsButton.addEventListener('click', () => this.handleSaveSettings());
        }

        if (this.resetSettingsButton) {
            this.resetSettingsButton.addEventListener('click', () => this.seatManager.resetSettings());
        }

        // Room management
        if (this.changeRoomButton) {
            this.changeRoomButton.addEventListener('click', () => this.handleChangeRoom());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Form enter key handling
        if (this.studentNameInput) {
            this.studentNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSubmitSelection();
                }
            });
        }
    }

    /**
     * Socket.ioイベントハンドラーの設定
     */
    setupSocketHandlers() {
        this.socketManager.on('roomData', (data) => {
            if (data.students) {
                this.students = data.students;
                this.updateStudentList();
                this.updateStudentNumberOptions();
            }
            if (data.gridConfig) {
                this.updateStudentNumberOptions();
            }
        });

        this.socketManager.on('studentsUpdated', (students) => {
            this.students = students;
            this.updateStudentList();
            this.updateStudentNumberOptions();
        });

        this.socketManager.on('gridConfigUpdated', (config) => {
            this.updateStudentNumberOptions();
        });

        this.socketManager.on('connected', (data) => {
            this.showMessage(`部屋 ${data.roomId} に接続しました`, 'success');
        });

        this.socketManager.on('localModeEnabled', () => {
            this.showMessage('オフラインモードで動作しています', 'warning');
        });

        // 【新規追加】一時保持関連のイベント処理
        this.socketManager.on('numberConflictDetected', (data) => {
            console.log('番号競合検出:', data);
            if (window.selectionStateManager) {
                window.selectionStateManager.handleNumberConflict(data);
            }
        });

        this.socketManager.on('temporaryHoldExpired', (data) => {
            console.log('一時保持期限切れ:', data);
            if (window.selectionStateManager) {
                window.selectionStateManager.handleHoldExpired(data);
            }
        });

        this.socketManager.on('numberReleased', (data) => {
            console.log('番号解除通知:', data);
            // 他のユーザーが番号を解除した場合の処理
            this.updateStudentNumberOptions();
        });
    }

    /**
 * 【新規追加】選択状態のリセット（外部から呼び出し用）
 */
    resetStudentNumberSelection() {
        const studentNumberSelect = document.getElementById('studentNumber');
        if (studentNumberSelect) {
            studentNumberSelect.value = '';
            studentNumberSelect.classList.remove('temporary-hold', 'confirmed-selection', 'conflict-warning');
        }

        const formGroup = document.getElementById('studentNumberGroup');
        if (formGroup) {
            formGroup.classList.remove('temporary-hold', 'confirmed', 'conflict');
        }

        const holdDisplayElement = document.getElementById('numberHoldTime');
        if (holdDisplayElement) {
            holdDisplayElement.style.display = 'none';
            holdDisplayElement.classList.remove('active');
        }

        console.log('出席番号選択をリセットしました');
    }

    /**
     * タブ切り替え
     */
    switchTab(tabId) {
        if (!tabId || this.currentTab === tabId) return;

        // アクティブなタブとコンテンツをリセット
        this.tabButtons.forEach(button => button.classList.remove('active'));
        this.tabContents.forEach(content => content.classList.remove('active'));

        // 新しいタブをアクティブに
        const targetButton = document.querySelector(`[data-tab="${tabId}"]`);
        const targetContent = document.getElementById(tabId);

        if (targetButton && targetContent) {
            targetButton.classList.add('active');
            targetContent.classList.add('active');
            this.currentTab = tabId;

            // タブ切り替え時の処理
            this.handleTabSwitch(tabId);
        }
    }

    /**
 * 【新規追加】select要素のテキスト色を強制修正
 */
    forceSelectTextColor() {
        const studentNumberSelect = document.getElementById('studentNumber');
        if (studentNumberSelect) {
            // DOM直接操作で確実にテキスト色を設定
            studentNumberSelect.style.color = '#000000';
            studentNumberSelect.style.backgroundColor = '#ffffff';
            studentNumberSelect.style.setProperty('color', '#000000', 'important');
            studentNumberSelect.style.setProperty('background-color', '#ffffff', 'important');

            // option要素も修正
            const options = studentNumberSelect.querySelectorAll('option');
            options.forEach(option => {
                option.style.color = '#000000';
                option.style.backgroundColor = '#ffffff';
                option.style.setProperty('color', '#000000', 'important');
                option.style.setProperty('background-color', '#ffffff', 'important');
            });

            console.log('UIManager: テキスト色を強制修正しました');
        }
    }

    /**
     * 出席番号の選択肢を更新（強制テキスト色修正版）
     */
    updateStudentNumberOptions() {
        if (!this.studentNumberSelect) return;

        // 現在の選択を記録
        const currentValue = this.studentNumberSelect.value;
        console.log('出席番号選択肢更新 - 現在の選択:', currentValue);

        // SelectionStateManagerの状態を確認
        const selectionState = window.selectionStateManager ?
            window.selectionStateManager.getCurrentSelection() : null;

        // 出席番号管理の設定を取得
        const attendanceSettings = window.attendanceManager ? window.attendanceManager.getSettings() : null;
        let availableNumbers = [];

        if (attendanceSettings) {
            // AttendanceManagerから有効な番号を取得
            availableNumbers = window.attendanceManager.getValidNumbers();
        } else {
            // フォールバック: 従来の座席数ベース
            const gridConfig = this.seatManager.getGridConfig();
            const totalSeats = gridConfig.rows * gridConfig.cols - gridConfig.disabledSeats.length;
            availableNumbers = Array.from({ length: totalSeats }, (_, i) => i + 1);
        }

        // 使用済み出席番号を取得
        const usedNumbers = this.students.map(student => student.number).filter(num => num);

        // 選択肢をクリア
        this.studentNumberSelect.innerHTML = '<option value="">選択してください</option>';

        // 有効な番号から選択肢を作成
        availableNumbers.forEach(number => {
            const option = document.createElement('option');
            option.value = number;

            const isUsed = usedNumbers.includes(number);
            const isCurrentSelection = selectionState && selectionState.number === number;

            // 選択肢のテキストと状態を設定
            if (isCurrentSelection) {
                // 現在選択中の番号
                if (selectionState.isTemporaryHold) {
                    option.textContent = isUsed ?
                        `${number} (選択中 - 使用済み)` :
                        `${number} (選択中)`;
                    option.className = 'selected-by-me';
                    // 一時的に有効化（使用済みでも選択を維持）
                    option.disabled = false;
                } else {
                    option.textContent = `${number} (確定済み)`;
                    option.className = 'selected-by-me';
                    option.disabled = false;
                }
            } else if (isUsed) {
                // 他の人が使用済み
                option.textContent = `${number} (使用済み)`;
                option.className = 'occupied';
                option.disabled = true;
            } else {
                // 利用可能
                option.textContent = number.toString();
                option.disabled = false;
            }

            this.studentNumberSelect.appendChild(option);
        });

        // 【追加】テキスト色を強制修正
        this.forceSelectTextColor();

        // 選択状態を復元
        if (selectionState && selectionState.number) {
            this.studentNumberSelect.value = selectionState.number;

            // フォームグループのクラスを更新
            const formGroup = document.getElementById('studentNumberGroup');
            if (formGroup) {
                formGroup.classList.remove('temporary-hold', 'confirmed', 'conflict');

                if (selectionState.isTemporaryHold) {
                    formGroup.classList.add('temporary-hold');
                } else {
                    formGroup.classList.add('confirmed');
                }

                // 使用済み番号の場合は競合表示
                if (usedNumbers.includes(selectionState.number)) {
                    formGroup.classList.add('conflict');
                }
            }
        } else if (currentValue) {
            // SelectionStateManagerがない場合の従来の復元
            this.studentNumberSelect.value = currentValue;
        }

        // 【追加】遅延してもう一度テキスト色を修正
        setTimeout(() => {
            this.forceSelectTextColor();
        }, 100);

        console.log('出席番号選択肢更新完了');
    }

    /**
     * タブ切り替え時の処理
     */
    handleTabSwitch(tabId) {
        switch (tabId) {
            case 'seat-selection':
                this.seatManager.renderSelectionGrid();
                if (this.studentNameInput) {
                    this.studentNameInput.focus();
                }
                break;

            case 'student-management':
                this.updateStudentList();
                break;

            case 'seating-assignment':
                this.seatManager.renderAssignmentGrid();
                break;

            case 'settings':
                this.seatManager.renderCustomizationGrid();
                break;
        }
    }

    /**
     * 希望席提出の処理
     */
    handleSubmitSelection() {
        const name = this.studentNameInput?.value?.trim();
        const number = parseInt(this.studentNumberSelect?.value);
        const selectedSeats = this.seatManager.getSelectedSeats();

        // バリデーション
        if (!name) {
            this.showMessage('名前を入力してください。', 'error');
            if (this.studentNameInput) {
                this.studentNameInput.focus();
            }
            return;
        }

        if (!number) {
            this.showMessage('出席番号を選択してください。', 'error');
            if (this.studentNumberSelect) {
                this.studentNumberSelect.focus();
            }
            return;
        }

        if (selectedSeats.length !== 3) {
            this.showMessage('3つの希望席を選択してください。', 'error');
            return;
        }

        const gridConfig = this.seatManager.getGridConfig();
        const hasDisabledSeat = selectedSeats.some(index => gridConfig.disabledSeats.includes(index));
        if (hasDisabledSeat) {
            this.showMessage('無効な席が選択されています。有効な席を選択してください。', 'error');
            return;
        }

        // 使用済み番号の最終チェック
        const usedNumbers = this.students.map(student => student.number).filter(num => num);
        if (usedNumbers.includes(number)) {
            this.showMessage('この出席番号は既に使用されています。別の番号を選択してください。', 'error');
            return;
        }

        // 既存の生徒をチェック（名前または出席番号で）
        const existingByName = this.students.findIndex(student => student.name === name);
        const existingByNumber = this.students.findIndex(student => student.number === number);

        if (existingByName !== -1 && existingByNumber !== -1 && existingByName !== existingByNumber) {
            this.showMessage('この名前または出席番号は既に使用されています。', 'error');
            return;
        }

        if (existingByName !== -1) {
            if (confirm(`${name}さんの情報を更新しますか？`)) {
                this.students[existingByName].number = number;
                this.students[existingByName].preferences = [...selectedSeats];
                this.students[existingByName].assigned = false;
                delete this.students[existingByName].assignedSeat;
            } else {
                return;
            }
        } else if (existingByNumber !== -1) {
            if (confirm(`出席番号${number}番の情報を更新しますか？`)) {
                this.students[existingByNumber].name = name;
                this.students[existingByNumber].preferences = [...selectedSeats];
                this.students[existingByNumber].assigned = false;
                delete this.students[existingByNumber].assignedSeat;
            } else {
                return;
            }
        } else {
            // 新しい生徒を追加
            this.students.push({
                name: name,
                number: number,
                preferences: [...selectedSeats],
                assigned: false
            });
        }

        // 選択状態をクリア
        if (window.selectionStateManager) {
            window.selectionStateManager.clearSelection();
        }

        // データを保存
        this.socketManager.sendData('updateStudents', this.students);
        this.seatManager.setStudents(this.students);

        // UI更新
        this.updateStudentList();
        this.updateStudentNumberOptions();
        this.showMessage(`${name}さん（${number}番）の希望が登録されました！`, 'success');

        // フォームリセット
        if (this.studentNameInput) {
            this.studentNameInput.value = '';
        }
        if (this.studentNumberSelect) {
            this.studentNumberSelect.value = '';
        }
        this.seatManager.resetSelection();
    }

    /**
     * 選択リセットの処理
     */
    handleResetSelection() {
        this.seatManager.resetSelection();
    }

    /**
     * 割り当てクリアの処理
     */
    handleClearAssignments() {
        if (confirm('席の割り当てをクリアしますか？')) {
            this.seatManager.clearAssignments();
        }
    }

    /**
     * 全生徒データクリアの処理
     */
    handleClearAllStudents() {
        if (confirm('すべての生徒データをクリアしますか？この操作は元に戻せません。')) {
            this.students = [];

            // Socket.ioで全クリア通知
            this.socketManager.sendData('clearAllData');

            // UI更新
            this.updateStudentList();
            this.updateStudentNumberOptions();
            this.seatManager.setStudents([]);
            this.seatManager.clearAssignments();

            this.showMessage('すべての生徒データがクリアされました。', 'success');
        }
    }

    /**
     * グリッド更新の処理（修正版）
     */
    handleUpdateGrid() {
        const rows = parseInt(this.gridRowsInput?.value);
        const cols = parseInt(this.gridColsInput?.value);

        if (this.seatManager.updateGridSettings(rows, cols)) {
            // 成功した場合、出席番号の選択肢を更新
            this.updateStudentNumberOptions();

            // グリッドの即座更新
            this.seatManager.renderAllGrids();

            // 現在のタブに応じて適切な再描画を実行
            this.handleTabSwitch(this.currentTab);

            console.log('グリッド更新完了 - 即座に再描画しました');
        }
    }

    /**
     * 設定保存の処理
     */
    handleSaveSettings() {
        this.seatManager.saveSettings();
        // 出席番号の選択肢を更新
        this.updateStudentNumberOptions();
        // 席選択タブに戻る
        this.switchTab('seat-selection');
    }

    /**
     * 部屋変更の処理
     */
    handleChangeRoom() {
        const currentRoomId = this.socketManager.roomId;
        const newRoomId = prompt('新しい部屋IDを入力してください:', currentRoomId);

        if (newRoomId && newRoomId.trim() !== '' && newRoomId !== currentRoomId) {
            this.socketManager.changeRoom(newRoomId);
        }
    }

    /**
     * 生徒リストの更新
     */
    updateStudentList() {
        if (!this.studentList) return;

        this.studentList.innerHTML = '';

        if (this.students.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <i class="fas fa-user-plus"></i>
                <p>生徒はまだ登録されていません</p>
                <p>希望席選択タブから生徒を追加してください</p>
            `;
            this.studentList.appendChild(emptyState);
            return;
        }

        // 出席番号でソート（番号がない場合は最後に）
        const sortedStudents = [...this.students].sort((a, b) => {
            if (!a.number && !b.number) return a.name.localeCompare(b.name, 'ja');
            if (!a.number) return 1;
            if (!b.number) return -1;
            return a.number - b.number;
        });

        sortedStudents.forEach(student => {
            const studentElement = this.createStudentElement(student);
            this.studentList.appendChild(studentElement);
        });
    }

    /**
     * 生徒要素の作成
     */
    createStudentElement(student) {
        const element = document.createElement('div');
        element.className = 'student-item';

        const info = document.createElement('div');
        info.className = 'student-info';

        const nameElement = document.createElement('div');
        nameElement.className = 'name';
        nameElement.textContent = student.number ? `${student.number}番 ${student.name}` : student.name;

        // 希望席の表示を削除
        info.appendChild(nameElement);

        const actions = document.createElement('div');
        actions.className = 'student-actions';

        const removeButton = document.createElement('button');
        removeButton.className = 'btn-remove';
        removeButton.innerHTML = '<i class="fas fa-times"></i>';
        removeButton.title = '削除';
        removeButton.addEventListener('click', () => this.removeStudent(student.name));

        actions.appendChild(removeButton);

        element.appendChild(info);
        element.appendChild(actions);

        return element;
    }

    /**
     * 生徒の削除
     */
    removeStudent(name) {
        if (confirm(`${name}さんのデータを削除しますか？`)) {
            this.students = this.students.filter(student => student.name !== name);

            // データを保存
            this.socketManager.sendData('updateStudents', this.students);
            this.seatManager.setStudents(this.students);

            // UI更新
            this.updateStudentList();
            this.updateStudentNumberOptions();
            this.showMessage(`${name}さんのデータを削除しました。`, 'success');
        }
    }

    /**
     * メッセージ表示
     */
    showMessage(message, type = 'success') {
        if (!this.messageArea) return;

        // 既存のメッセージをクリア
        this.messageArea.innerHTML = '';

        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;

        const icon = document.createElement('i');
        switch (type) {
            case 'success':
                icon.className = 'fas fa-check-circle';
                break;
            case 'error':
                icon.className = 'fas fa-exclamation-circle';
                break;
            case 'warning':
                icon.className = 'fas fa-exclamation-triangle';
                break;
            default:
                icon.className = 'fas fa-info-circle';
        }

        const textElement = document.createElement('span');
        textElement.textContent = message;

        messageElement.appendChild(icon);
        messageElement.appendChild(textElement);
        this.messageArea.appendChild(messageElement);

        // 自動で消去（3秒後）
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.style.opacity = '0';
                messageElement.style.transform = 'translateY(-10px)';

                setTimeout(() => {
                    if (messageElement.parentNode) {
                        messageElement.parentNode.removeChild(messageElement);
                    }
                }, 300);
            }
        }, 3000);
    }

    /**
     * タブのハイライト
     */
    highlightTab(tabId) {
        const tabButton = document.querySelector(`[data-tab="${tabId}"]`);
        if (tabButton) {
            tabButton.classList.add('pulse');
            setTimeout(() => {
                tabButton.classList.remove('pulse');
            }, 1000);
        }
    }

    /**
     * キーボードショートカットの処理
     */
    handleKeyboardShortcuts(e) {
        // Escキーでメッセージをクリア
        if (e.key === 'Escape') {
            if (this.messageArea) {
                this.messageArea.innerHTML = '';
            }
        }

        // Ctrl/Cmd + 数字でタブ切り替え
        if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '4') {
            e.preventDefault();
            const tabIndex = parseInt(e.key) - 1;
            const tabs = ['seat-selection', 'student-management', 'seating-assignment', 'settings'];
            if (tabs[tabIndex]) {
                this.switchTab(tabs[tabIndex]);
            }
        }
    }

    /**
     * ローディング状態の表示
     */
    showLoading(container, message = 'Loading...') {
        if (!container) return;

        container.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner"></i>
                <span>${message}</span>
            </div>
        `;
    }

    /**
     * フォームの有効/無効切り替え
     */
    setFormEnabled(enabled) {
        const formElements = [
            this.studentNameInput,
            this.submitButton,
            this.resetButton,
            this.assignButton,
            this.assignRandomButton,
            this.clearAssignmentsButton,
            this.clearAllButton,
            this.updateGridButton,
            this.saveSettingsButton,
            this.resetSettingsButton
        ];

        formElements.forEach(element => {
            if (element) {
                element.disabled = !enabled;
            }
        });
    }

    /**
     * 現在のタブを取得
     */
    getCurrentTab() {
        return this.currentTab;
    }

    /**
     * 生徒データを取得
     */
    getStudents() {
        return [...this.students];
    }

    /**
     * 初期化完了後の処理
     */
    onInitialized() {
        // 既存の処理
        this.switchTab('seat-selection');

        // SelectionStateManagerの初期化
        setTimeout(() => {
            if (window.SelectionStateManager) {
                window.selectionStateManager = new SelectionStateManager(this.socketManager, this);
                console.log('SelectionStateManager を初期化しました');
            }

            // AttendanceManagerのUI初期化
            if (window.attendanceManager) {
                console.log('AttendanceManager UI初期化を実行');
                window.attendanceManager.initializeUI();
            } else {
                console.error('AttendanceManagerが見つかりません');
            }

            this.updateStudentNumberOptions();

            // 【追加】初期化後にテキスト色を強制修正
            this.forceSelectTextColor();
        }, 100);

        if (this.studentNameInput) {
            this.studentNameInput.focus();
        }

        // 【追加】定期的にテキスト色をチェック
        setInterval(() => {
            this.forceSelectTextColor();
        }, 3000); // 3秒ごと

        console.log('UIManager初期化完了');
    }
}

// グローバルに公開
window.UIManager = UIManager;