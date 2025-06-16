/**
 * 出席番号選択状態管理クラス
 * 一時的な選択状態を保持し、リアルタイム更新時に選択を維持する
 */
class SelectionStateManager {
    constructor(socketManager, uiManager) {
        this.socketManager = socketManager;
        this.uiManager = uiManager;

        // 状態管理
        this.currentSelection = null; // 現在選択中の番号
        this.selectionTimestamp = null; // 選択開始時刻
        this.isTemporaryHold = false; // 一時保持中フラグ
        this.holdTimeout = null; // 保持タイムアウト

        // 設定（15秒から3分に変更）
        this.holdDuration = 180000; // 【変更】180秒（3分）に変更
        this.conflictCheckDelay = 500; // 競合チェック遅延

        this.setupEventHandlers();
    }

    /**
     * イベントハンドラーの設定
     */
    setupEventHandlers() {
        // 出席番号選択イベント
        const studentNumberSelect = document.getElementById('studentNumber');
        if (studentNumberSelect) {
            // 【追加】初期状態でテキスト色を修正
            this.forceTextColorFix();

            // 既存のイベントリスナーを上書き
            studentNumberSelect.addEventListener('change', (e) => {
                this.handleNumberSelection(e.target.value);
            });

            // フォーカス時の保護
            studentNumberSelect.addEventListener('focus', () => {
                this.startTemporaryHold();
                // 【追加】フォーカス時にもテキスト色を修正
                this.forceTextColorFix();
            });

            // 【追加】定期的にテキスト色をチェック・修正
            setInterval(() => {
                this.forceTextColorFix();
            }, 5000); // 5秒ごと
        }

        // 既存のSocket.ioイベント処理...
        this.socketManager.on('studentsUpdated', (students) => {
            this.handleStudentsUpdate(students);
        });

        this.socketManager.on('numberConflictDetected', (data) => {
            this.handleNumberConflict(data);
        });

        this.socketManager.on('temporaryHoldExpired', (data) => {
            this.handleHoldExpired(data);
        });
    }

    /**
     * 出席番号選択の処理
     */
    handleNumberSelection(selectedNumber) {
        console.log('出席番号選択:', selectedNumber);

        if (!selectedNumber) {
            this.clearSelection();
            return;
        }

        const number = parseInt(selectedNumber);

        // 現在の選択と同じ場合はスキップ
        if (this.currentSelection === number) {
            return;
        }

        // 前の選択をクリア
        this.clearSelection();

        // 新しい選択を設定
        this.currentSelection = number;
        this.selectionTimestamp = Date.now();
        this.isTemporaryHold = true;

        // 【追加】テキスト色を強制修正
        this.forceTextColorFix();

        // 選択状態を表示
        this.updateSelectionDisplay();

        // サーバーに一時保持を通知
        this.socketManager.sendData('holdNumber', {
            number: number,
            timestamp: this.selectionTimestamp
        });

        // 自動解除タイマーを設定
        this.startHoldTimer();

        console.log(`出席番号${number}番を一時保持開始`);
    }

    /**
     * 一時保持の開始
     */
    startTemporaryHold() {
        if (this.currentSelection && !this.isTemporaryHold) {
            this.isTemporaryHold = true;
            this.updateSelectionDisplay();
            this.startHoldTimer();
        }
    }

    /**
     * 保持タイマーの開始
     */
    startHoldTimer() {
        this.clearHoldTimer();

        console.log(`一時保持タイマー開始: ${this.holdDuration}ms`);

        this.holdTimeout = setTimeout(() => {
            console.log('一時保持タイムアウト - 選択をリセットします');
            this.forceExpireSelection();
        }, this.holdDuration);
    }

    /**
 * 強制的に選択を期限切れにする
 */
    forceExpireSelection() {
        const expiredNumber = this.currentSelection;

        // 選択状態をクリア
        this.currentSelection = null;
        this.selectionTimestamp = null;
        this.isTemporaryHold = false;
        this.clearHoldTimer();

        // DOM要素もリセット
        const studentNumberSelect = document.getElementById('studentNumber');
        if (studentNumberSelect) {
            studentNumberSelect.value = '';
            studentNumberSelect.classList.remove('temporary-hold', 'confirmed-selection', 'conflict-warning');
        }

        // フォームグループのクラスもリセット
        const formGroup = document.getElementById('studentNumberGroup');
        if (formGroup) {
            formGroup.classList.remove('temporary-hold', 'confirmed', 'conflict');
        }

        // 保持時間表示を非表示
        const holdDisplayElement = document.getElementById('numberHoldTime');
        if (holdDisplayElement) {
            holdDisplayElement.style.display = 'none';
            holdDisplayElement.classList.remove('active');
        }

        // サーバーに解除を通知
        if (expiredNumber) {
            this.socketManager.sendData('releaseNumber', {
                number: expiredNumber
            });
        }

        // ユーザーに通知
        if (this.uiManager) {
            this.uiManager.showMessage('出席番号の保持期限が切れました。再度選択してください。', 'warning');
        }

        console.log(`出席番号${expiredNumber}番の保持が期限切れになりました`);
    }

    /**
     * 保持タイマーのクリア
     */
    clearHoldTimer() {
        if (this.holdTimeout) {
            clearTimeout(this.holdTimeout);
            this.holdTimeout = null;
        }
    }

    /**
     * 選択の確定
     */
    confirmSelection() {
        if (this.currentSelection && this.isTemporaryHold) {
            this.isTemporaryHold = false;
            this.clearHoldTimer();

            // サーバーに確定を通知
            this.socketManager.sendData('confirmNumber', {
                number: this.currentSelection,
                timestamp: this.selectionTimestamp
            });

            this.updateSelectionDisplay();
            console.log(`出席番号${this.currentSelection}番を確定`);
        }
    }

    /**
     * 選択のクリア
     */
    clearSelection() {
        if (this.currentSelection) {
            const prevNumber = this.currentSelection;

            this.currentSelection = null;
            this.selectionTimestamp = null;
            this.isTemporaryHold = false;
            this.clearHoldTimer();

            // DOM要素もリセット
            const studentNumberSelect = document.getElementById('studentNumber');
            if (studentNumberSelect) {
                studentNumberSelect.value = '';
                studentNumberSelect.classList.remove('temporary-hold', 'confirmed-selection', 'conflict-warning');
            }

            // フォームグループのクラスもリセット
            const formGroup = document.getElementById('studentNumberGroup');
            if (formGroup) {
                formGroup.classList.remove('temporary-hold', 'confirmed', 'conflict');
            }

            // サーバーに解除を通知
            this.socketManager.sendData('releaseNumber', {
                number: prevNumber
            });

            this.updateSelectionDisplay();
            console.log(`出席番号${prevNumber}番の選択を解除`);
        }
    }

    /**
     * 生徒更新の処理（選択状態を保持）
     */
    handleStudentsUpdate(students) {
        console.log('生徒データ更新 - 選択状態チェック中...');

        // 遅延してから競合チェック
        setTimeout(() => {
            this.checkForConflicts(students);
        }, this.conflictCheckDelay);
    }

    /**
     * 競合チェック
     */
    checkForConflicts(students) {
        if (!this.currentSelection) {
            return;
        }

        // 使用済み番号をチェック
        const usedNumbers = students
            .filter(student => student.number)
            .map(student => student.number);

        if (usedNumbers.includes(this.currentSelection)) {
            console.log(`競合検出: ${this.currentSelection}番が使用済みになりました`);
            this.handleNumberConflict({
                number: this.currentSelection,
                conflictType: 'already_used'
            });
        } else {
            // 競合なし - 選択状態を維持
            this.updateSelectionDisplay();
        }
    }

    /**
     * 番号競合の処理
     */
    handleNumberConflict(data) {
        if (data.number === this.currentSelection) {
            const studentNumberSelect = document.getElementById('studentNumber');

            if (studentNumberSelect) {
                // 選択を維持しつつ、使用済み表示を更新
                this.updateSelectionDisplay();

                // ユーザーに通知
                if (this.uiManager) {
                    this.uiManager.showMessage(
                        `出席番号${data.number}番は他の人が使用しました。別の番号を選択してください。`,
                        'warning'
                    );
                }

                // 選択フィールドを強調
                studentNumberSelect.classList.add('conflict-warning');
                setTimeout(() => {
                    studentNumberSelect.classList.remove('conflict-warning');
                }, 2000);
            }
        }
    }

    /**
     * 保持期限切れの処理
     */
    handleHoldExpired(data) {
        console.log('サーバーから保持期限切れ通知:', data);

        if (data.number === this.currentSelection) {
            this.forceExpireSelection();
        }
    }

    /**
 * select要素のテキスト色を強制的に設定
 */
    forceTextColorFix() {
        const studentNumberSelect = document.getElementById('studentNumber');
        if (studentNumberSelect) {
            // インラインスタイルで最優先に設定
            studentNumberSelect.style.color = '#000000';
            studentNumberSelect.style.backgroundColor = '#ffffff';
            studentNumberSelect.style.setProperty('color', '#000000', 'important');
            studentNumberSelect.style.setProperty('background-color', '#ffffff', 'important');

            // option要素も同様に設定
            const options = studentNumberSelect.querySelectorAll('option');
            options.forEach(option => {
                option.style.color = '#000000';
                option.style.backgroundColor = '#ffffff';
                option.style.setProperty('color', '#000000', 'important');
                option.style.setProperty('background-color', '#ffffff', 'important');
            });

            console.log('テキスト色を強制的に設定しました');
        }
    }

    /**
     * 選択表示の更新（強制テキスト色修正版）
     */
    updateSelectionDisplay() {
        const studentNumberSelect = document.getElementById('studentNumber');
        if (!studentNumberSelect) return;

        // 現在の選択を保持
        const currentValue = studentNumberSelect.value;

        // 選択肢を更新（UIManagerの既存機能を使用）
        if (this.uiManager && this.uiManager.updateStudentNumberOptions) {
            this.uiManager.updateStudentNumberOptions();
        }

        // 【追加】テキスト色を強制修正
        this.forceTextColorFix();

        // 選択状態を復元
        if (this.currentSelection) {
            const option = studentNumberSelect.querySelector(`option[value="${this.currentSelection}"]`);

            if (option) {
                studentNumberSelect.value = this.currentSelection;

                // 状態に応じてクラスを設定
                studentNumberSelect.classList.remove('temporary-hold', 'confirmed-selection');

                if (this.isTemporaryHold) {
                    studentNumberSelect.classList.add('temporary-hold');

                    // オプションテキストを更新
                    if (option.disabled) {
                        option.textContent = `${this.currentSelection} (選択中 - 使用済み)`;
                        option.disabled = false; // 一時的に有効化
                    } else {
                        option.textContent = `${this.currentSelection} (選択中)`;
                    }
                } else {
                    studentNumberSelect.classList.add('confirmed-selection');
                }
            }
        }

        // 【追加】再度テキスト色を強制修正
        setTimeout(() => {
            this.forceTextColorFix();
        }, 100);

        // 残り時間の表示
        this.updateHoldTimeDisplay();
    }
    /**
     * 保持時間表示の更新
     */
    updateHoldTimeDisplay() {
        if (!this.isTemporaryHold || !this.selectionTimestamp) {
            // 保持中でない場合は表示を隠す
            const holdDisplayElement = document.getElementById('numberHoldTime');
            if (holdDisplayElement) {
                holdDisplayElement.style.display = 'none';
                holdDisplayElement.classList.remove('active');
            }
            return;
        }

        const elapsed = Date.now() - this.selectionTimestamp;
        const remaining = Math.max(0, this.holdDuration - elapsed);

        console.log(`保持時間更新: 経過=${elapsed}ms, 残り=${remaining}ms`);

        if (remaining > 0) {
            // 【修正】分:秒 形式で表示
            const totalSeconds = Math.ceil(remaining / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            // 保持時間表示要素があれば更新
            const holdDisplayElement = document.getElementById('numberHoldTime');
            if (holdDisplayElement) {
                holdDisplayElement.innerHTML = `
                <i class="fas fa-hourglass-half"></i>
                <span>保持中: ${timeString}</span>
            `;
                holdDisplayElement.style.display = 'block';
                holdDisplayElement.classList.add('active');
            }

            // 【修正】1秒ごとに更新を継続
            setTimeout(() => {
                // 状態が変わっていないかチェック
                if (this.isTemporaryHold && this.selectionTimestamp === this.selectionTimestamp) {
                    this.updateHoldTimeDisplay();
                }
            }, 1000);
        } else {
            // 【修正】時間切れの場合は強制期限切れ処理
            console.log('保持時間が0になりました - 強制期限切れ処理を実行');
            this.forceExpireSelection();
        }
    }

    /**
     * 現在の選択状態を取得
     */
    getCurrentSelection() {
        return {
            number: this.currentSelection,
            timestamp: this.selectionTimestamp,
            isTemporaryHold: this.isTemporaryHold,
            remainingTime: this.selectionTimestamp ?
                Math.max(0, this.holdDuration - (Date.now() - this.selectionTimestamp)) : 0
        };
    }

    /**
     * 強制的に選択をクリア（外部から呼び出し用）
     */
    forceReleaseSelection() {
        this.clearSelection();
    }

    /**
     * デバッグ情報の出力
     */
    debug() {
        console.group('SelectionStateManager デバッグ情報');
        console.log('現在の選択:', this.currentSelection);
        console.log('選択時刻:', this.selectionTimestamp);
        console.log('一時保持中:', this.isTemporaryHold);
        console.log('保持タイマー:', this.holdTimeout ? 'アクティブ' : '非アクティブ');
        console.log('現在の状態:', this.getCurrentSelection());
        console.groupEnd();
    }

    /**
     * クリーンアップ処理
     */
    cleanup() {
        this.clearHoldTimer();
        this.clearSelection();
    }
}

// グローバルに公開
window.SelectionStateManager = SelectionStateManager;

console.log('SelectionStateManager クラスが読み込まれました');