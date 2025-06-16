/**
 * 座席管理クラス
 * 座席の表示、選択、割り当て機能を管理
 */
class SeatManager {
    constructor(socketManager) {
        this.socketManager = socketManager;
        this.gridConfig = {
            rows: 5,
            cols: 5,
            disabledSeats: []
        };
        this.selectedSeats = [];
        this.assignedSeats = [];
        this.students = [];

        this.setupEventHandlers();
    }

    /**
     * イベントハンドラーの設定
     */
    setupEventHandlers() {
        // Socket.ioからのデータ受信
        this.socketManager.on('roomData', (data) => {
            this.updateFromRoomData(data);
        });

        this.socketManager.on('gridConfigUpdated', (config) => {
            this.updateGridConfig(config);
        });

        this.socketManager.on('assignedSeatsUpdated', (seats) => {
            this.assignedSeats = seats || [];
            this.renderAssignmentGrid();
        });
    }

    /**
     * 部屋データからの更新
     */
    updateFromRoomData(data) {
        if (data.gridConfig) {
            this.updateGridConfig(data.gridConfig);
        }

        if (data.students) {
            this.students = data.students;
        }

        if (data.assignedSeats) {
            this.assignedSeats = data.assignedSeats;
        }

        // 全グリッドを再描画
        this.renderAllGrids();
    }

    /**
     * グリッド設定の更新
     */
    updateGridConfig(config) {
        this.gridConfig = { ...config };
        this.adjustAssignedSeatsArray();
        this.updateGridInputs();
        this.renderAllGrids();
    }

    /**
     * 座席配列のサイズ調整
     */
    adjustAssignedSeatsArray() {
        const totalSeats = this.gridConfig.rows * this.gridConfig.cols;
        const newAssignedSeats = Array(totalSeats).fill(null);

        // 既存データをコピー（範囲内のみ）
        for (let i = 0; i < Math.min(this.assignedSeats.length, totalSeats); i++) {
            newAssignedSeats[i] = this.assignedSeats[i];
        }

        this.assignedSeats = newAssignedSeats;
    }

    /**
     * グリッド入力フィールドの更新
     */
    updateGridInputs() {
        const rowsInput = document.getElementById('gridRows');
        const colsInput = document.getElementById('gridCols');

        if (rowsInput) rowsInput.value = this.gridConfig.rows;
        if (colsInput) colsInput.value = this.gridConfig.cols;
    }

    /**
     * 座席番号の計算（行列形式）
     */
    calculateSeatNumber(index) {
        const row = Math.floor(index / this.gridConfig.cols);
        const col = index % this.gridConfig.cols;
        return col * this.gridConfig.rows + row + 1;
    }

    /**
     * 座席選択グリッドの描画
     */
    renderSelectionGrid() {
        const container = document.getElementById('seatSelectionGrid');
        if (!container) return;

        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.gridConfig.cols}, 1fr)`;
        container.setAttribute('data-cols', this.gridConfig.cols);

        const totalSeats = this.gridConfig.rows * this.gridConfig.cols;

        for (let i = 0; i < totalSeats; i++) {
            const seatElement = this.createSeatElement(i, 'selection');
            container.appendChild(seatElement);
        }

        this.updateSeatSelections();
    }

    /**
     * 座席割り当てグリッドの描画
     */
    renderAssignmentGrid() {
        const container = document.getElementById('assignmentGrid');
        if (!container) return;

        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.gridConfig.cols}, 1fr)`;
        container.setAttribute('data-cols', this.gridConfig.cols);

        const totalSeats = this.gridConfig.rows * this.gridConfig.cols;

        for (let i = 0; i < totalSeats; i++) {
            const seatElement = this.createSeatElement(i, 'assignment');
            container.appendChild(seatElement);
        }
    }

    /**
     * カスタマイズグリッドの描画
     */
    renderCustomizationGrid() {
        const container = document.getElementById('customizationGrid');
        if (!container) return;

        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.gridConfig.cols}, 1fr)`;
        container.setAttribute('data-cols', this.gridConfig.cols);

        const totalSeats = this.gridConfig.rows * this.gridConfig.cols;

        for (let i = 0; i < totalSeats; i++) {
            const seatElement = this.createSeatElement(i, 'customization');
            container.appendChild(seatElement);
        }
    }

    /**
     * 座席要素の作成
     */
    createSeatElement(index, type) {
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.dataset.index = index;

        const desk = document.createElement('div');
        desk.className = 'seat-desk';

        // 無効な座席の場合
        if (this.gridConfig.disabledSeats.includes(index)) {
            desk.classList.add('disabled');
        }

        // 座席番号
        const seatNumber = this.calculateSeatNumber(index);
        const numberElement = document.createElement('div');
        numberElement.className = 'seat-number';
        numberElement.textContent = seatNumber;
        desk.appendChild(numberElement);

        // 座席内容
        const content = document.createElement('div');
        content.className = 'seat-content';

        switch (type) {
            case 'selection':
                this.setupSelectionSeat(content, desk, index);
                break;
            case 'assignment':
                this.setupAssignmentSeat(content, desk, index);
                break;
            case 'customization':
                this.setupCustomizationSeat(content, desk, index);
                break;
        }

        desk.appendChild(content);
        seat.appendChild(desk);

        return seat;
    }

    /**
     * 選択用座席の設定
     */
    setupSelectionSeat(content, desk, index) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-chair';
        content.appendChild(icon);

        // 無効でない座席にクリックイベントを追加
        if (!this.gridConfig.disabledSeats.includes(index)) {
            desk.addEventListener('click', () => this.handleSeatSelection(index));
        }
    }

    /**
     * 割り当て用座席の設定
     */
    setupAssignmentSeat(content, desk, index) {
        if (this.gridConfig.disabledSeats.includes(index)) {
            return; // 無効な座席はそのまま
        }

        const assignedStudent = this.assignedSeats[index];

        if (assignedStudent) {
            // 生徒が割り当てられている場合
            const icon = document.createElement('i');

            // 未登録の場合は異なるアイコンを使用
            if (assignedStudent.preference === -2) {
                icon.className = 'fas fa-hashtag'; // 番号を示すアイコン
                icon.style.color = '#6b7280';
            } else {
                icon.className = 'fas fa-user';
            }

            content.appendChild(icon);

            const nameElement = document.createElement('div');
            nameElement.className = 'student-name';
            // 出席番号も表示
            const displayName = assignedStudent.number ? `${assignedStudent.number}番 ${assignedStudent.name}` : assignedStudent.name;
            nameElement.textContent = displayName;

            // 未登録の場合は名前の色を変更
            if (assignedStudent.preference === -2) {
                nameElement.style.color = '#6b7280';
                nameElement.style.fontStyle = 'italic';
            }

            content.appendChild(nameElement);

            const preferenceElement = document.createElement('div');
            preferenceElement.className = 'preference-indicator';

            switch (assignedStudent.preference) {
                case 1:
                    preferenceElement.textContent = '第一希望';
                    preferenceElement.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
                    preferenceElement.style.color = '#dc2626';
                    break;
                case 2:
                    preferenceElement.textContent = '第二希望';
                    preferenceElement.style.backgroundColor = 'rgba(217, 119, 6, 0.1)';
                    preferenceElement.style.color = '#d97706';
                    break;
                case 3:
                    preferenceElement.textContent = '第三希望';
                    preferenceElement.style.backgroundColor = 'rgba(5, 150, 105, 0.1)';
                    preferenceElement.style.color = '#059669';
                    break;
                case -1:
                    preferenceElement.textContent = '自動割り当て';
                    preferenceElement.style.backgroundColor = 'rgba(147, 51, 234, 0.1)';
                    preferenceElement.style.color = '#9333ea';
                    break;
                case -2:
                    preferenceElement.textContent = '未登録';
                    preferenceElement.style.backgroundColor = 'rgba(156, 163, 175, 0.1)';
                    preferenceElement.style.color = '#6b7280';
                    break;
                default:
                    preferenceElement.textContent = 'ランダム';
                    preferenceElement.style.backgroundColor = 'rgba(100, 116, 139, 0.1)';
                    preferenceElement.style.color = '#64748b';
                    break;
            }

            content.appendChild(preferenceElement);
        } else {
            // 空席
            const icon = document.createElement('i');
            icon.className = 'fas fa-chair';
            content.appendChild(icon);

            const emptyText = document.createElement('div');
            emptyText.className = 'student-name';
            emptyText.textContent = '空席';
            emptyText.style.color = '#94a3b8';
            content.appendChild(emptyText);
        }
    }

    /**
     * カスタマイズ用座席の設定
     */
    setupCustomizationSeat(content, desk, index) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-chair';
        content.appendChild(icon);

        desk.addEventListener('click', () => this.toggleSeatDisabled(index));
    }

    /**
     * 座席選択の処理
     */
    handleSeatSelection(index) {
        if (this.gridConfig.disabledSeats.includes(index)) {
            return; // 無効な座席は選択不可
        }

        const existingIndex = this.selectedSeats.indexOf(index);

        if (existingIndex !== -1) {
            // 既に選択されている場合は解除
            this.selectedSeats.splice(existingIndex, 1);
        } else if (this.selectedSeats.length < 3) {
            // 3つまで選択可能
            this.selectedSeats.push(index);
        } else {
            // 3つ選択済みの場合はエラー表示
            this.showSeatSelectionError();
            return;
        }

        this.updateSeatSelections();
    }

    /**
     * 座席選択状態の更新
     */
    updateSeatSelections() {
        const container = document.getElementById('seatSelectionGrid');
        if (!container) return;

        // 既存のラベルを削除
        container.querySelectorAll('.preference-label').forEach(label => label.remove());

        // 全座席のクラスをリセット
        container.querySelectorAll('.seat-desk').forEach(desk => {
            desk.classList.remove('selected-1', 'selected-2', 'selected-3');
        });

        // 選択された座席にスタイルを適用
        this.selectedSeats.forEach((seatIndex, selectionIndex) => {
            const seatElement = container.querySelector(`[data-index="${seatIndex}"]`);
            if (seatElement) {
                const desk = seatElement.querySelector('.seat-desk');
                desk.classList.add(`selected-${selectionIndex + 1}`);

                // 希望順序ラベルを追加
                const label = document.createElement('div');
                label.className = `preference-label ${['first', 'second', 'third'][selectionIndex]}`;
                label.textContent = selectionIndex + 1;
                desk.appendChild(label);
            }
        });
    }

    /**
     * 座席選択エラーの表示
     */
    showSeatSelectionError() {
        const container = document.getElementById('seatSelectionGrid');
        if (container) {
            container.classList.add('shake');
            setTimeout(() => {
                container.classList.remove('shake');
            }, 500);
        }

        // UIManagerのメッセージ表示機能を使用
        if (window.uiManager) {
            window.uiManager.showMessage('最大3つまで選択できます。', 'error');
        }
    }

    /**
     * 座席の有効/無効切り替え
     */
    toggleSeatDisabled(index) {
        const isDisabled = this.gridConfig.disabledSeats.includes(index);

        if (isDisabled) {
            // 有効化
            this.gridConfig.disabledSeats = this.gridConfig.disabledSeats.filter(idx => idx !== index);
        } else {
            // 無効化
            this.gridConfig.disabledSeats.push(index);
        }

        // 表示を更新
        this.renderCustomizationGrid();
    }

    /**
     * 座席割り当ての実行
     */
    assignSeats() {
        if (this.students.length === 0) {
            if (window.uiManager) {
                window.uiManager.showMessage('生徒がいません。まず生徒を追加してください。', 'error');
            }
            return;
        }

        console.log('席割り当て開始 - 全生徒:', this.students);

        // 割り当て前にリセット
        const totalSeats = this.gridConfig.rows * this.gridConfig.cols;
        this.assignedSeats = Array(totalSeats).fill(null);

        // 生徒をシャッフル（公平性のため）
        const shuffledStudents = this.shuffleArray([...this.students]);

        // 全生徒の割り当て状態をリセット
        shuffledStudents.forEach(student => {
            student.assigned = false;
            delete student.assignedSeat;
        });

        console.log('希望順割り当て開始');
        // 希望順に割り当て（出席番号がある生徒のみ）
        for (let preference = 1; preference <= 3; preference++) {
            this.assignByPreference(shuffledStudents, preference);
        }

        console.log('希望順割り当て完了 - 現在の割り当て状況:', this.assignedSeats.filter(s => s !== null));

        console.log('残り生徒のランダム割り当て開始');
        // 残りの生徒をランダムに割り当て
        this.assignRemainingStudents(shuffledStudents);

        console.log('ランダム割り当て完了 - 現在の割り当て状況:', this.assignedSeats.filter(s => s !== null));

        console.log('出席番号未選択の生徒の自動割り当て開始');
        // 出席番号が未選択の生徒を自動割り当て
        this.assignStudentsWithoutNumbers();

        console.log('自動割り当て完了 - 現在の割り当て状況:', this.assignedSeats.filter(s => s !== null));

        console.log('未使用出席番号の空席配置開始');
        // 残りの空席に未使用の出席番号をランダム配置
        this.fillEmptySeatsWithUnusedNumbers();

        console.log('全割り当て完了 - 最終的な割り当て状況:', this.assignedSeats.filter(s => s !== null));

        // データを保存
        this.socketManager.sendData('updateAssignedSeats', this.assignedSeats);

        // 表示を更新
        this.renderAssignmentGrid();

        if (window.uiManager) {
            window.uiManager.showMessage('席の割り当てが完了しました！', 'success');
            window.uiManager.highlightTab('seating-assignment');
        }
    }

    /**
     * 希望順による割り当て
     */
    assignByPreference(students, preference) {
        // 出席番号がある生徒のみを対象にする
        const studentsWithNumbers = students.filter(student => student.number);
        const shuffledStudents = this.shuffleArray(studentsWithNumbers);

        shuffledStudents.forEach(student => {
            if (!student.assigned && student.preferences && student.preferences.length >= preference) {
                const seatIndex = student.preferences[preference - 1];

                // 無効な座席でなく、まだ空いている場合
                if (!this.gridConfig.disabledSeats.includes(seatIndex) && !this.assignedSeats[seatIndex]) {
                    this.assignedSeats[seatIndex] = {
                        name: student.name,
                        number: student.number,
                        preference: preference
                    };
                    student.assigned = true;
                    student.assignedSeat = seatIndex;
                }
            }
        });
    }

    /**
     * 出席番号未選択の生徒を自動割り当て
     */
    assignStudentsWithoutNumbers() {
        // 出席番号が設定されていない生徒を取得
        const studentsWithoutNumbers = this.students.filter(student => !student.number);

        if (studentsWithoutNumbers.length === 0) {
            return;
        }

        console.log('出席番号未選択の生徒:', studentsWithoutNumbers.map(s => s.name));

        // 使用済み出席番号を取得
        const usedNumbers = this.students
            .filter(student => student.number)
            .map(student => student.number);

        console.log('使用済み番号:', usedNumbers);

        // 有効な出席番号の範囲を計算
        const totalSeats = this.gridConfig.rows * this.gridConfig.cols - this.gridConfig.disabledSeats.length;
        const availableNumbers = [];

        for (let i = 1; i <= totalSeats; i++) {
            if (!usedNumbers.includes(i)) {
                availableNumbers.push(i);
            }
        }

        console.log('利用可能な番号:', availableNumbers);

        // 出席番号をシャッフル
        const shuffledNumbers = this.shuffleArray([...availableNumbers]);

        // 空席を取得
        const emptySeats = this.getEmptySeats();
        const shuffledEmptySeats = this.shuffleArray(emptySeats);

        console.log('空席:', emptySeats);

        // 番号未選択の生徒を配置
        studentsWithoutNumbers.forEach((student, index) => {
            if (shuffledEmptySeats.length > 0 && shuffledNumbers.length > 0) {
                const seatIndex = shuffledEmptySeats.pop();
                const assignedNumber = shuffledNumbers.pop();

                console.log(`${student.name}に番号${assignedNumber}を割り当て、席${seatIndex}に配置`);

                // 生徒に出席番号を割り当て
                student.number = assignedNumber;

                this.assignedSeats[seatIndex] = {
                    name: student.name,
                    number: assignedNumber,
                    preference: -1 // 出席番号自動割り当て
                };
                student.assigned = true;
                student.assignedSeat = seatIndex;
            }
        });

        // 生徒データを更新（出席番号が追加されたため）
        this.socketManager.sendData('updateStudents', this.students);

        if (window.uiManager) {
            window.uiManager.updateStudentNumberOptions();
        }
    }
    assignRemainingStudents(students) {
        const unassignedStudents = students.filter(student => !student.assigned);
        const emptySeats = this.getEmptySeats();
        const shuffledEmptySeats = this.shuffleArray(emptySeats);

        unassignedStudents.forEach(student => {
            if (shuffledEmptySeats.length > 0) {
                const seatIndex = shuffledEmptySeats.pop();
                this.assignedSeats[seatIndex] = {
                    name: student.name,
                    preference: 0 // ランダム割り当て
                };
                student.assigned = true;
                student.assignedSeat = seatIndex;
            }
        });
    }

    /**
     * 完全ランダム割り当て
     */
    assignRandomSeats() {
        if (this.students.length === 0) {
            if (window.uiManager) {
                window.uiManager.showMessage('生徒がいません。まず生徒を追加してください。', 'error');
            }
            return;
        }

        // 割り当て前にリセット
        const totalSeats = this.gridConfig.rows * this.gridConfig.cols;
        this.assignedSeats = Array(totalSeats).fill(null);

        const shuffledStudents = this.shuffleArray([...this.students]);
        const emptySeats = this.getEmptySeats();
        const shuffledEmptySeats = this.shuffleArray(emptySeats);

        // 生徒状態をリセット
        shuffledStudents.forEach(student => {
            student.assigned = false;
            delete student.assignedSeat;
        });

        // ランダムに割り当て
        shuffledStudents.forEach(student => {
            if (shuffledEmptySeats.length > 0) {
                const seatIndex = shuffledEmptySeats.pop();
                this.assignedSeats[seatIndex] = {
                    name: student.name,
                    number: student.number,
                    preference: 0 // ランダム割り当て
                };
                student.assigned = true;
                student.assignedSeat = seatIndex;
            }
        });

        // 残りの空席に未使用の出席番号をランダム配置
        this.fillEmptySeatsWithUnusedNumbers();

        // データを保存
        this.socketManager.sendData('updateAssignedSeats', this.assignedSeats);

        // 表示を更新
        this.renderAssignmentGrid();

        if (window.uiManager) {
            window.uiManager.showMessage('ランダムに席を割り当てました！', 'success');
            window.uiManager.highlightTab('seating-assignment');
        }
    }

    /**
     * 空席のインデックス配列を取得
     */
    getEmptySeats() {
        const emptySeats = [];
        const totalSeats = this.gridConfig.rows * this.gridConfig.cols;

        for (let i = 0; i < totalSeats; i++) {
            if (!this.gridConfig.disabledSeats.includes(i) && !this.assignedSeats[i]) {
                emptySeats.push(i);
            }
        }

        console.log('空席計算 - 総座席数:', totalSeats, '無効座席:', this.gridConfig.disabledSeats, '空席:', emptySeats);

        return emptySeats;
    }

    /**
     * 未使用出席番号で空席をランダムに埋める
     */
    fillEmptySeatsWithUnusedNumbers() {
        // 現在使用されている出席番号を取得
        const usedNumbers = [];

        // 実際の生徒が使っている番号
        this.students.forEach(student => {
            if (student.number) {
                usedNumbers.push(student.number);
            }
        });

        console.log('実際の生徒が使用中の番号:', usedNumbers);

        // 有効な出席番号の範囲を計算
        const totalSeats = this.gridConfig.rows * this.gridConfig.cols - this.gridConfig.disabledSeats.length;
        const unusedNumbers = [];

        for (let i = 1; i <= totalSeats; i++) {
            if (!usedNumbers.includes(i)) {
                unusedNumbers.push(i);
            }
        }

        console.log('未使用の出席番号:', unusedNumbers);

        // 空席を取得
        const emptySeats = this.getEmptySeats();
        console.log('現在の空席:', emptySeats);

        if (unusedNumbers.length === 0 || emptySeats.length === 0) {
            console.log('未使用番号または空席がないため、追加配置をスキップ');
            return;
        }

        // 未使用番号と空席をシャッフル
        const shuffledNumbers = this.shuffleArray([...unusedNumbers]);
        const shuffledEmptySeats = this.shuffleArray([...emptySeats]);

        // 空席に未使用番号をランダムに配置
        const assignCount = Math.min(shuffledNumbers.length, shuffledEmptySeats.length);

        for (let i = 0; i < assignCount; i++) {
            const seatIndex = shuffledEmptySeats[i];
            const number = shuffledNumbers[i];

            console.log(`未登録の${number}番を席${seatIndex}に配置`);

            this.assignedSeats[seatIndex] = {
                name: `${number}番`,
                number: number,
                preference: -2 // 未登録を示す特別な値
            };
        }

        console.log(`未使用番号による空席埋め完了: ${assignCount}席を追加配置`);
    }
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * 割り当てクリア
     */
    clearAssignments() {
        const totalSeats = this.gridConfig.rows * this.gridConfig.cols;
        this.assignedSeats = Array(totalSeats).fill(null);

        // 生徒の割り当て状態もリセット
        this.students.forEach(student => {
            student.assigned = false;
            delete student.assignedSeat;
        });

        // データを保存
        this.socketManager.sendData('updateAssignedSeats', this.assignedSeats);

        // 表示を更新
        this.renderAssignmentGrid();

        if (window.uiManager) {
            window.uiManager.showMessage('席の割り当てがクリアされました。', 'success');
        }
    }

    /**
     * 選択をリセット
     */
    resetSelection() {
        this.selectedSeats = [];
        this.updateSeatSelections();

        if (window.uiManager) {
            window.uiManager.showMessage('選択がリセットされました。', 'success');
        }
    }

    /**
     * グリッド設定の更新
     */
    updateGridSettings(rows, cols) {
        // 入力値の検証
        if (isNaN(rows) || isNaN(cols) || rows < 3 || cols < 3 || rows > 8 || cols > 8) {
            if (window.uiManager) {
                window.uiManager.showMessage('行数と列数は3から8の間で指定してください。', 'error');
            }
            return false;
        }

        const newTotal = rows * cols;
        const currentTotal = this.gridConfig.rows * this.gridConfig.cols;

        // サイズが小さくなる場合は確認
        if (newTotal < currentTotal) {
            if (!confirm('グリッドサイズを小さくすると、既存の席割り当てやデータが失われる可能性があります。続けますか？')) {
                return false;
            }
        }

        // 設定を更新
        this.gridConfig.rows = rows;
        this.gridConfig.cols = cols;

        // 無効な座席のフィルタリング
        this.gridConfig.disabledSeats = this.gridConfig.disabledSeats.filter(index => index < newTotal);

        // 割り当て配列のサイズ調整
        this.adjustAssignedSeatsArray();

        if (window.attendanceManager) {
            const validSeats = newTotal - this.gridConfig.disabledSeats.length;
            window.attendanceManager.updateSeatCapacity(validSeats);
        }

        // データを保存
        this.socketManager.sendData('updateGridConfig', this.gridConfig);

        if (window.uiManager) {
            window.uiManager.showMessage('グリッドサイズを更新しました！', 'success');
        }

        return true;
    }

    /**
     * 設定保存
     */
    saveSettings() {
        this.socketManager.sendData('updateGridConfig', this.gridConfig);

        if (window.uiManager) {
            window.uiManager.showMessage('座席設定が保存されました！', 'success');
        }
    }

    /**
     * 設定リセット
     */
    resetSettings() {
        if (confirm('座席の設定をリセットしますか？無効にした座席が全て有効に戻ります。')) {
            this.gridConfig.disabledSeats = [];
            this.socketManager.sendData('updateGridConfig', this.gridConfig);
            this.renderCustomizationGrid();

            if (window.uiManager) {
                window.uiManager.showMessage('座席設定がリセットされました。', 'success');
            }
        }
    }

    /**
     * 全グリッドの再描画
     */
    renderAllGrids() {
        this.renderSelectionGrid();
        this.renderAssignmentGrid();
        this.renderCustomizationGrid();
    }

    /**
     * 現在の選択座席を取得
     */
    getSelectedSeats() {
        return [...this.selectedSeats];
    }

    /**
     * グリッド設定を取得
     */
    getGridConfig() {
        return { ...this.gridConfig };
    }

    /**
     * 生徒データを設定
     */
    setStudents(students) {
        this.students = students || [];
    }
}

// グローバルに公開
window.SeatManager = SeatManager;