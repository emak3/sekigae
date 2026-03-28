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
        this.missingNumbers = []; // 欠番の配列

        this.initializeElements();
        this.setupEventHandlers();
        this.setupSocketHandlers();

    }

    /**
     * DOM要素の初期化
     */
    initializeElements() {
        // Tab elements
        this.tabButtons = document.querySelectorAll('.compact-tab');
        this.tabContents = document.querySelectorAll('.tab-content');

        // Form elements (認証システムから自動取得)
        this.studentNameInput = null; // Googleアカウントから自動取得
        this.studentNumberSelect = null; // Googleアカウントから自動取得
        this.gridRowsInput = document.getElementById('gridRows');
        this.gridColsInput = document.getElementById('gridCols');
        this.maxStudentNumberInput = document.getElementById('maxStudentNumber');
        this.missingNumbersGrid = document.getElementById('missingNumbersGrid');

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
        this.deleteRoomButton = document.getElementById('deleteRoom');
        this.copyRoomLinkButton = document.getElementById('copyRoomLink');
        this.roomIdDisplay = document.getElementById('roomIdDisplay');

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
            this.assignRandomButton.addEventListener('click', () => this.handleRandomAssignment());
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

        // 出席番号設定の変更監視
        if (this.maxStudentNumberInput) {
            this.maxStudentNumberInput.addEventListener('input', () => {
                this.updateMissingNumbersGrid();
                this.updateAttendanceSummary();
            });
        }

        if (this.resetSettingsButton) {
            this.resetSettingsButton.addEventListener('click', () => this.seatManager.resetSettings());
        }

        // Room management
        if (this.deleteRoomButton) {
            this.deleteRoomButton.addEventListener('click', () => this.handleDeleteRoom());
        }

        // 部屋ID共有機能
        if (this.copyRoomLinkButton) {
            this.copyRoomLinkButton.addEventListener('click', () => this.handleCopyRoomLink());
        }

        if (this.roomIdDisplay) {
            this.roomIdDisplay.addEventListener('click', () => this.handleCopyRoomLink());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Form enter key handling
        // studentNameInputは不要（Googleアカウントから自動取得）
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
            // データ更新時に権限チェックを再適用
            setTimeout(() => {
                this.applyPermissionBasedUIRestrictions();
            }, 100);
        });

        this.socketManager.on('studentsUpdated', (students) => {
            this.students = students;
            this.updateStudentList();
            this.updateStudentNumberOptions();
            // データ更新時に権限チェックを再適用
            setTimeout(() => {
                this.applyPermissionBasedUIRestrictions();
            }, 100);
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
        // studentNumberSelectは不要（Googleアカウントから自動取得）
        return;

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
                // フォーカスは不要（Googleアカウントから自動取得）
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
        // Googleアカウントから名前と番号を自動取得
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            this.showMessage('ログインが必要です。', 'error');
            return;
        }

        const name = currentUser.name;
        const number = parseInt(currentUser.studentNumber);
        const selectedSeats = this.seatManager.getSelectedSeats();

        // バリデーション
        if (!name) {
            this.showMessage('Googleアカウントから名前を取得できませんでした。', 'error');
            return;
        }

        if (!number) {
            this.showMessage('Googleアカウントから学籍番号を取得できませんでした。', 'error');
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

                // 生徒番号が欠番リストにある場合は欠番から除外
                this.removeFromMissingNumbers(number);
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

        // 生徒番号が欠番リストにある場合は欠番から除外
        this.removeFromMissingNumbers(number);

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

        // フォームリセット（Googleアカウント情報は保持）
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
     * 部屋削除の処理
     */
    handleDeleteRoom() {
        const currentUser = this.getCurrentUser();
        const isAdmin = this.isCurrentUserAdmin();

        // 管理者権限チェック
        if (!isAdmin) {
            this.showMessage('部屋を終わらせる権限がありません（管理者のみ）', 'error');
            return;
        }

        const roomInfo = this.getCurrentRoom();
        const roomName = roomInfo ? roomInfo.name : '現在の部屋';

        if (confirm(`${roomName}を終わらせますか？\n\nこの操作により：\n・すべての生徒データがクリアされます\n・部屋への接続が終了します\n・他の参加者も強制的に退出されます`)) {
            try {
                // ローカルデータをクリア
                localStorage.removeItem('currentRoom');
                localStorage.removeItem('userRole');

                // サーバー側のデータもクリア
                if (this.socketManager && this.socketManager.isConnected) {
                    this.socketManager.socket.emit('clearAllData');
                }

                this.showMessage('部屋を終わらせました', 'success');

                // ログイン画面にリダイレクト
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);

            } catch (error) {
                console.error('部屋削除エラー:', error);
                this.showMessage('部屋の削除中にエラーが発生しました', 'error');
            }
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

        // 番号を下2桁で表示
        const displayNumber = student.number ? String(student.number).slice(-2).padStart(2, '0') : null;
        nameElement.textContent = displayNumber ? `${displayNumber}番 ${student.name}` : student.name;

        // 希望席の表示を削除
        info.appendChild(nameElement);

        const actions = document.createElement('div');
        actions.className = 'student-actions';

        const removeButton = document.createElement('button');
        removeButton.className = 'btn-remove';
        removeButton.innerHTML = '<i class="fas fa-times"></i>';
        removeButton.title = '削除';

        // 権限チェック: 管理者または本人のみ削除可能
        const currentUser = this.getCurrentUser();
        const isAdmin = this.isCurrentUserAdmin();
        const isOwnData = currentUser && student.number === parseInt(currentUser.studentNumber);

        if (isAdmin || isOwnData) {
            removeButton.addEventListener('click', () => this.removeStudent(student.name));
        } else {
            removeButton.disabled = true;
            removeButton.style.opacity = '0.3';
            removeButton.style.cursor = 'not-allowed';
            removeButton.title = '権限がありません（管理者または本人のみ削除可能）';
        }

        actions.appendChild(removeButton);

        element.appendChild(info);
        element.appendChild(actions);

        return element;
    }

    /**
     * 生徒の削除
     */
    removeStudent(name) {
        // 権限チェック
        const currentUser = this.getCurrentUser();
        const isAdmin = this.isCurrentUserAdmin();
        const targetStudent = this.students.find(s => s.name === name);
        const isOwnData = currentUser && targetStudent && targetStudent.number === parseInt(currentUser.studentNumber);

        if (!isAdmin && !isOwnData) {
            this.showMessage('削除権限がありません（管理者または本人のみ削除可能）', 'error');
            return;
        }

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

        // フォーカスは不要（Googleアカウントから自動取得）

        // 管理者権限による表示制御
        this.applyPermissionBasedUIRestrictions();

        // 出席番号設定の初期化
        this.updateMissingNumbersGrid();
        this.updateAttendanceSummary();

        // 【追加】定期的にテキスト色をチェック
        setInterval(() => {
            this.forceSelectTextColor();
        }, 3000); // 3秒ごと

        console.log('UIManager初期化完了');
    }

    /**
     * 現在のユーザー情報を取得
     */
    getCurrentUser() {
        // authGuardから取得を試みる
        if (window.authGuard && window.authGuard.getCurrentUser) {
            return window.authGuard.getCurrentUser();
        }

        // authManagerから取得を試みる
        if (window.authManager && window.authManager.getCurrentUser) {
            return window.authManager.getCurrentUser();
        }

        // localStorageから直接取得
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                return JSON.parse(savedUser);
            }
        } catch (error) {
            console.error('ユーザー情報の取得エラー:', error);
        }

        return null;
    }

    /**
     * 現在のユーザーが管理者かチェック
     */
    isCurrentUserAdmin() {
        // authGuardから権限をチェック
        if (window.authGuard && window.authGuard.isAdmin) {
            return window.authGuard.isAdmin();
        }

        // admin-configから権限をチェック
        if (window.adminConfig && window.adminConfig.isCurrentUserAdmin) {
            return window.adminConfig.isCurrentUserAdmin();
        }

        // userRoleをチェック
        const userRole = localStorage.getItem('userRole');
        if (userRole === 'admin') {
            return true;
        }

        return false;
    }

    /**
     * 現在の部屋情報を取得
     */
    getCurrentRoom() {
        try {
            const roomData = localStorage.getItem('currentRoom');
            if (roomData) {
                return JSON.parse(roomData);
            }
        } catch (error) {
            console.error('部屋データの取得に失敗:', error);
        }
        return null;
    }

    /**
     * 権限に基づいてUIの表示制限を適用
     */
    applyPermissionBasedUIRestrictions() {
        const isAdmin = this.isCurrentUserAdmin();

        console.log('権限チェック結果:', { isAdmin });

        // 管理者以外に制限するタブ（設定タブのみ）
        const restrictedTabs = ['settings'];

        restrictedTabs.forEach(tabName => {
            const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
            if (tabButton) {
                if (isAdmin) {
                    // 管理者: 有効化
                    tabButton.style.pointerEvents = 'auto';
                    tabButton.style.opacity = '1';
                    tabButton.classList.remove('disabled');
                    tabButton.title = '';
                } else {
                    // 一般ユーザー: 無効化
                    tabButton.style.pointerEvents = 'none';
                    tabButton.style.opacity = '0.5';
                    tabButton.classList.add('disabled');
                    tabButton.title = '管理者のみ利用可能';
                }
            }
        });

        // 管理者以外に制限するボタン
        const restrictedButtons = [
            'assignSeats',
            'assignRandom',
            'clearAssignments',
            'clearAllStudents',
            'updateGrid',
            'saveSettings',
            'resetSettings',
            'deleteRoom'
        ];

        restrictedButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                if (isAdmin) {
                    // 管理者: 有効化
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';
                    button.title = '';
                } else {
                    // 一般ユーザー: 無効化
                    button.disabled = true;
                    button.style.opacity = '0.3';
                    button.style.cursor = 'not-allowed';
                    button.title = '管理者のみ利用可能';
                }
            }
        });

        // 設定フォーム要素の制限
        const settingInputs = [
            'gridRows',
            'gridCols',
            'maxStudentNumber'
        ];

        settingInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                if (isAdmin) {
                    input.disabled = false;
                    input.style.opacity = '1';
                } else {
                    input.disabled = true;
                    input.style.opacity = '0.5';
                }
            }
        });

        // 一般ユーザー向けのメッセージ表示
        if (!isAdmin) {
            this.showPermissionRestrictedMessage();
        }
    }

    /**
     * 権限制限メッセージの表示
     */
    showPermissionRestrictedMessage() {
        // 設定タブにメッセージを追加
        const settingsSection = document.getElementById('settings');
        if (settingsSection && !settingsSection.querySelector('.permission-notice')) {
            const notice = document.createElement('div');
            notice.className = 'permission-notice';
            notice.innerHTML = `
                <div class="notice-content">
                    <i class="fas fa-info-circle"></i>
                    <h4>権限制限のお知らせ</h4>
                    <p>
                        現在あなたは一般ユーザーとしてログインしています。<br>
                        設定変更・席割り当て機能は管理者のみ利用可能です。
                    </p>
                    <div class="notice-actions">
                        <button onclick="location.reload()" class="btn-secondary">
                            <i class="fas fa-refresh"></i>
                            ページを更新
                        </button>
                    </div>
                </div>
            `;
            notice.style.cssText = `
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 0.5rem;
                padding: 1.5rem;
                margin: 1rem 0;
                text-align: center;
                color: #64748b;
            `;

            settingsSection.insertBefore(notice, settingsSection.firstChild);
        }

        // 席割り当てタブにメッセージを追加（ボタンのみ制限）
        const assignmentSection = document.getElementById('seating-assignment');
        if (assignmentSection && !assignmentSection.querySelector('.permission-notice')) {
            const notice = document.createElement('div');
            notice.className = 'permission-notice';
            notice.innerHTML = `
                <div class="notice-content">
                    <i class="fas fa-info-circle"></i>
                    <h4>閲覧モード</h4>
                    <p>席割り当ての確認はできますが、変更は管理者のみ可能です。</p>
                </div>
            `;
            notice.style.cssText = `
                background: #f0f9ff;
                border: 1px solid #0ea5e9;
                border-radius: 0.5rem;
                padding: 1rem;
                margin: 1rem 0;
                text-align: center;
                color: #0369a1;
            `;

            assignmentSection.insertBefore(notice, assignmentSection.firstChild);
        }
    }

    /**
     * 出席番号設定の概要を更新
     */
    updateAttendanceSummary() {
        const summaryContainer = document.getElementById('attendanceSummary');
        if (!summaryContainer) return;

        const maxNumber = parseInt(this.maxStudentNumberInput?.value) || 40;

        // 欠番リストを使用
        const missingNumbers = [...this.missingNumbers];

        // 座席数を取得
        const totalSeats = this.seatManager ? this.seatManager.getTotalValidSeats() : 25;

        // 出席予定者数を計算
        const presentStudents = maxNumber - missingNumbers.length;

        // バランスチェック
        const isBalanced = presentStudents <= totalSeats;

        summaryContainer.innerHTML = `
            <div class="summary-stats">
                <div class="stat-item">
                    <span class="stat-label">全体人数:</span>
                    <span class="stat-value">${maxNumber}人</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">欠番:</span>
                    <span class="stat-value">${missingNumbers.length}人</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">出席予定:</span>
                    <span class="stat-value">${presentStudents}人</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">利用可能座席:</span>
                    <span class="stat-value">${totalSeats}席</span>
                </div>
                <div class="balance-check ${isBalanced ? 'balanced' : 'unbalanced'}">
                    <i class="fas ${isBalanced ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                    <span>${isBalanced ? '座席数は十分です' : '座席数が不足しています'}</span>
                </div>
            </div>
        `;

        // スタイルを動的に追加
        if (!document.getElementById('attendance-summary-styles')) {
            const style = document.createElement('style');
            style.id = 'attendance-summary-styles';
            style.textContent = `
                .summary-stats {
                    background: #f8fafc;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin-top: 1rem;
                }
                .stat-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 0.5rem 0;
                }
                .stat-label {
                    color: #64748b;
                }
                .stat-value {
                    font-weight: bold;
                    color: #334155;
                }
                .balance-check {
                    margin-top: 1rem;
                    padding: 0.75rem;
                    border-radius: 0.375rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .balance-check.balanced {
                    background: #dcfce7;
                    color: #166534;
                }
                .balance-check.unbalanced {
                    background: #fef2f2;
                    color: #dc2626;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 欠番グリッドを更新
     */
    updateMissingNumbersGrid() {
        if (!this.missingNumbersGrid) return;

        const maxNumber = parseInt(this.maxStudentNumberInput?.value) || 25;

        // グリッドをクリア
        this.missingNumbersGrid.innerHTML = '';

        // 番号ボタンを生成
        for (let i = 1; i <= maxNumber; i++) {
            const numberBtn = document.createElement('button');
            numberBtn.className = 'missing-number-btn';
            numberBtn.textContent = i;
            numberBtn.title = `番号${i}を欠番として選択/解除`;

            // 選択状態を反映
            if (this.missingNumbers.includes(i)) {
                numberBtn.classList.add('selected');
            }

            // クリックイベント
            numberBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleMissingNumber(i);
            });

            this.missingNumbersGrid.appendChild(numberBtn);
        }

        // スタイルを動的に追加
        if (!document.getElementById('missing-numbers-styles')) {
            const style = document.createElement('style');
            style.id = 'missing-numbers-styles';
            style.textContent = `
                .missing-numbers-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    padding: 1rem;
                    background: #f8fafc;
                    border-radius: 0.5rem;
                    max-height: 200px;
                    overflow-y: auto;
                }
                .missing-number-btn {
                    width: 40px;
                    height: 40px;
                    border: 2px solid #e2e8f0;
                    border-radius: 0.375rem;
                    background: white;
                    color: #64748b;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .missing-number-btn:hover {
                    border-color: #94a3b8;
                    background: #f1f5f9;
                }
                .missing-number-btn.selected {
                    background: #dc2626;
                    border-color: #dc2626;
                    color: white;
                }
                .missing-number-btn.selected:hover {
                    background: #b91c1c;
                    border-color: #b91c1c;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 欠番の選択/解除を切り替え
     */
    toggleMissingNumber(number) {
        const index = this.missingNumbers.indexOf(number);

        if (index === -1) {
            // 選択されていない場合は追加
            this.missingNumbers.push(number);
            this.missingNumbers.sort((a, b) => a - b);
        } else {
            // 選択されている場合は削除
            this.missingNumbers.splice(index, 1);
        }

        // UIを更新
        this.updateMissingNumbersGrid();
        this.updateAttendanceSummary();

        console.log('欠番リスト更新:', this.missingNumbers);
    }

    /**
     * 指定された番号を欠番リストから除外
     */
    removeFromMissingNumbers(number) {
        const index = this.missingNumbers.indexOf(number);

        if (index !== -1) {
            this.missingNumbers.splice(index, 1);

            // UIを更新
            this.updateMissingNumbersGrid();
            this.updateAttendanceSummary();

            console.log(`番号${number}を欠番リストから除外しました:`, this.missingNumbers);
            this.showMessage(`番号${number}番が登録されたため、欠番から除外されました`, 'info');
        }
    }

    /**
     * 出席番号設定の取得
     */
    getAttendanceSettings() {
        const maxNumber = parseInt(this.maxStudentNumberInput?.value) || 40;
        const missingNumbers = [...this.missingNumbers];

        return {
            maxNumber,
            missingNumbers,
            presentCount: maxNumber - missingNumbers.length
        };
    }

    /**
     * 欠番を考慮したランダム割り当て処理
     */
    handleRandomAssignment() {
        const attendanceSettings = this.getAttendanceSettings();
        const { maxNumber, missingNumbers, presentCount } = attendanceSettings;

        // 座席数チェック
        const totalSeats = this.seatManager ? this.seatManager.getTotalValidSeats() : 25;
        if (presentCount > totalSeats) {
            this.showMessage(`出席予定者数(${presentCount}人)が座席数(${totalSeats}席)を超えています。出席番号設定を確認してください。`, 'error');
            return;
        }

        // 出席予定の生徒番号リストを生成
        const presentNumbers = [];
        for (let i = 1; i <= maxNumber; i++) {
            if (!missingNumbers.includes(i)) {
                presentNumbers.push(i);
            }
        }

        // 仮想的な生徒データを作成
        const virtualStudents = presentNumbers.map(number => ({
            name: `生徒${number}`,
            number: number,
            preferences: [],
            assigned: false,
            assignedSeat: null
        }));

        // 既存の生徒データを一時的に保存
        const originalStudents = [...this.students];

        // 仮想データで割り当てを実行
        this.students = virtualStudents;
        this.seatManager.students = virtualStudents;

        // ランダム割り当て実行
        this.seatManager.assignRandomSeats();

        // 元の生徒データを復元
        this.students = originalStudents;
        this.seatManager.students = originalStudents;

        // 成功メッセージ
        this.showMessage(`${presentCount}人の生徒をランダムに配置しました（欠番 ${missingNumbers.length}人を除く）`, 'success');

        // 割り当て結果の詳細を表示
        if (missingNumbers.length > 0) {
            const missingList = missingNumbers.join(', ');
            this.showMessage(`欠番: ${missingList}`, 'info');
        }
    }

    /**
     * 部屋共有リンクをコピー
     */
    async handleCopyRoomLink() {
        try {
            const roomInfo = this.getCurrentRoom();
            if (!roomInfo || !roomInfo.id) {
                this.showMessage('部屋IDが取得できませんでした', 'error');
                return;
            }

            // 共有URLを生成（login.htmlに部屋IDパラメータ付き）
            const baseURL = window.location.origin + window.location.pathname;
            const loginPath = baseURL.replace('index.html', 'login.html');
            const shareURL = `${loginPath}?room=${encodeURIComponent(roomInfo.id)}`;

            // クリップボードにコピー
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(shareURL);
                this.showMessage('共有リンクをコピーしました！', 'success');
            } else {
                // フォールバック: テキストエリアを使用
                this.copyToClipboardFallback(shareURL);
                this.showMessage('共有リンクをコピーしました！', 'success');
            }

            // 視覚的フィードバック
            this.showShareLinkModal(shareURL, roomInfo.id);

        } catch (error) {
            console.error('共有リンクのコピーエラー:', error);
            this.showMessage('共有リンクのコピーに失敗しました', 'error');
        }
    }

    /**
     * クリップボードコピーのフォールバック
     */
    copyToClipboardFallback(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('フォールバックコピー失敗:', err);
        }

        document.body.removeChild(textArea);
    }

    /**
     * 共有リンクモーダルを表示
     */
    showShareLinkModal(shareURL, roomId) {
        // 既存のモーダルがあれば削除
        const existingModal = document.getElementById('shareLinkModal');
        if (existingModal) {
            existingModal.remove();
        }

        // モーダルを作成
        const modal = document.createElement('div');
        modal.id = 'shareLinkModal';
        modal.className = 'share-modal';
        modal.innerHTML = `
            <div class="share-modal-backdrop" onclick="this.parentElement.remove()"></div>
            <div class="share-modal-content">
                <div class="share-modal-header">
                    <h3><i class="fas fa-share-alt"></i> 部屋を共有</h3>
                    <button class="modal-close" onclick="this.closest('.share-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="share-modal-body">
                    <p>この部屋に参加するためのリンクをコピーしました。</p>
                    <div class="share-info">
                        <div class="share-item">
                            <label>部屋ID:</label>
                            <code class="room-id-code">${roomId}</code>
                        </div>
                        <div class="share-item">
                            <label>共有リンク:</label>
                            <div class="share-url-container">
                                <input type="text" class="share-url-input" value="${shareURL}" readonly>
                                <button class="btn-copy-again" onclick="navigator.clipboard.writeText('${shareURL}'); alert('再度コピーしました！')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="share-instructions">
                        <p><i class="fas fa-info-circle"></i> このリンクを他の人に送ると、ログイン後に自動でこの部屋に参加できます。</p>
                    </div>
                </div>
                <div class="share-modal-footer">
                    <button class="btn-primary" onclick="this.closest('.share-modal').remove()">
                        <i class="fas fa-check"></i>
                        閉じる
                    </button>
                </div>
            </div>
        `;

        // スタイルを追加
        if (!document.getElementById('share-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'share-modal-styles';
            style.textContent = `
                .share-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .share-modal-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                }
                .share-modal-content {
                    background: white;
                    border-radius: 0.75rem;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                    max-width: 500px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    position: relative;
                    z-index: 1;
                }
                .share-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1.5rem;
                    border-bottom: 1px solid #e2e8f0;
                }
                .share-modal-header h3 {
                    margin: 0;
                    color: #1e293b;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 1.25rem;
                    color: #64748b;
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: 0.375rem;
                }
                .modal-close:hover {
                    background: #f1f5f9;
                    color: #334155;
                }
                .share-modal-body {
                    padding: 1.5rem;
                }
                .share-info {
                    background: #f8fafc;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin: 1rem 0;
                }
                .share-item {
                    margin: 0.75rem 0;
                }
                .share-item label {
                    display: block;
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 0.25rem;
                }
                .room-id-code {
                    background: #1e293b;
                    color: #f1f5f9;
                    padding: 0.5rem;
                    border-radius: 0.375rem;
                    font-family: monospace;
                    font-size: 1.1rem;
                    letter-spacing: 0.05em;
                }
                .share-url-container {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                }
                .share-url-input {
                    flex: 1;
                    padding: 0.5rem;
                    border: 1px solid #d1d5db;
                    border-radius: 0.375rem;
                    font-size: 0.875rem;
                    background: white;
                }
                .btn-copy-again {
                    padding: 0.5rem;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 0.375rem;
                    cursor: pointer;
                }
                .btn-copy-again:hover {
                    background: #2563eb;
                }
                .share-instructions {
                    background: #dbeafe;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin-top: 1rem;
                }
                .share-instructions p {
                    margin: 0;
                    color: #1e40af;
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                }
                .share-modal-footer {
                    padding: 1.5rem;
                    border-top: 1px solid #e2e8f0;
                    text-align: right;
                }
                .clickable-room-id {
                    cursor: pointer;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.375rem;
                    transition: background-color 0.2s ease;
                }
                .clickable-room-id:hover {
                    background-color: #f1f5f9;
                    color: #3b82f6;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);

        // 3秒後に自動で閉じる
        setTimeout(() => {
            if (modal && modal.parentNode) {
                modal.remove();
            }
        }, 8000);
    }

}

// グローバルに公開
window.UIManager = UIManager;