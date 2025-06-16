const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// 教室データの保存用オブジェクト
const classrooms = {};

class TemporaryHoldManager {
  constructor() {
    this.holds = new Map(); // roomId -> Map(number -> holdData)
    this.holdTimeout = 180000; // 【変更】180秒（3分）に変更
  }

  createHold(roomId, number, socketId, userId) {
    if (!this.holds.has(roomId)) {
      this.holds.set(roomId, new Map());
    }

    const roomHolds = this.holds.get(roomId);

    // 既存の保持をクリア
    this.clearHold(roomId, number);

    // 新しい保持を作成
    const timeoutId = setTimeout(() => {
      this.expireHold(roomId, number, socketId);
    }, this.holdTimeout);

    roomHolds.set(number, {
      socketId,
      userId,
      timeoutId,
      createdAt: Date.now()
    });

    console.log(`部屋 ${roomId} で出席番号 ${number} を一時保持開始 (${socketId})`);
    return true;
  }

  confirmHold(roomId, number, socketId) {
    const roomHolds = this.holds.get(roomId);
    if (!roomHolds) return false;

    const hold = roomHolds.get(number);
    if (hold && hold.socketId === socketId) {
      clearTimeout(hold.timeoutId);
      roomHolds.delete(number);
      console.log(`部屋 ${roomId} で出席番号 ${number} の保持を確定 (${socketId})`);
      return true;
    }
    return false;
  }

  clearHold(roomId, number) {
    const roomHolds = this.holds.get(roomId);
    if (!roomHolds) return false;

    const hold = roomHolds.get(number);
    if (hold) {
      clearTimeout(hold.timeoutId);
      roomHolds.delete(number);
      console.log(`部屋 ${roomId} で出席番号 ${number} の保持をクリア`);
      return true;
    }
    return false;
  }

  releaseHold(roomId, number, socketId) {
    const roomHolds = this.holds.get(roomId);
    if (!roomHolds) return false;

    const hold = roomHolds.get(number);
    if (hold && hold.socketId === socketId) {
      clearTimeout(hold.timeoutId);
      roomHolds.delete(number);
      console.log(`部屋 ${roomId} で出席番号 ${number} の保持を解除 (${socketId})`);
      return true;
    }
    return false;
  }

  expireHold(roomId, number, socketId) {
    const roomHolds = this.holds.get(roomId);
    if (!roomHolds) return;

    const hold = roomHolds.get(number);
    if (hold && hold.socketId === socketId) {
        roomHolds.delete(number);
        console.log(`部屋 ${roomId} で出席番号 ${number} の保持が期限切れ (${socketId})`);
        
        // 【修正】より確実な通知処理
        try {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                // 本人に期限切れ通知
                socket.emit('temporaryHoldExpired', { number });
                console.log(`期限切れ通知を送信: ${socketId} -> ${number}番`);
                
                // 同じ部屋の他のユーザーに解除通知
                socket.to(roomId).emit('numberReleased', { number });
                console.log(`番号解除通知を送信: room ${roomId} -> ${number}番`);
            } else {
                console.warn(`Socket ${socketId} が見つかりません（既に切断済み）`);
                
                // Socketが見つからない場合でも、部屋の他のユーザーには通知
                io.to(roomId).emit('numberReleased', { number });
            }
        } catch (error) {
            console.error(`期限切れ通知の送信エラー (${socketId}):`, error);
            
            // エラーが発生しても、部屋の他のユーザーには通知を試行
            try {
                io.to(roomId).emit('numberReleased', { number });
            } catch (broadcastError) {
                console.error(`ブロードキャスト通知エラー:`, broadcastError);
            }
        }
    }
}

  cleanupBySocket(socketId) {
    this.holds.forEach((roomHolds, roomId) => {
      const toDelete = [];
      roomHolds.forEach((hold, number) => {
        if (hold.socketId === socketId) {
          clearTimeout(hold.timeoutId);
          toDelete.push(number);
        }
      });

      toDelete.forEach(number => {
        roomHolds.delete(number);
        console.log(`切断により部屋 ${roomId} の出席番号 ${number} の保持をクリア`);
      });
    });
  }

  isHeld(roomId, number) {
    const roomHolds = this.holds.get(roomId);
    return roomHolds ? roomHolds.has(number) : false;
  }

  getHoldInfo(roomId, number) {
    const roomHolds = this.holds.get(roomId);
    if (!roomHolds) return null;
    return roomHolds.get(number) || null;
  }
}

const holdManager = new TemporaryHoldManager();

// デフォルトの部屋データを作成する関数
function createDefaultRoomData(roomId) {
  const defaultGridRows = 5;
  const defaultGridCols = 5;
  const totalSeats = defaultGridRows * defaultGridCols;

  return {
    students: [],
    gridConfig: {
      rows: defaultGridRows,
      cols: defaultGridCols,
      disabledSeats: []
    },
    assignedSeats: Array(totalSeats).fill(null),
    attendanceSettings: {
      maxNumber: totalSeats,
      seatCapacity: totalSeats,
      absentEnabled: false,
      absentNumbers: []
    },
    timestamp: Date.now(),
    roomId: roomId
  };
}

// データの妥当性チェック関数
function validateRoomData(data) {
  // 基本構造のチェック
  if (!data || typeof data !== 'object') {
    return false;
  }

  // 必須フィールドの存在チェック
  const requiredFields = ['students', 'gridConfig', 'assignedSeats', 'attendanceSettings'];
  for (const field of requiredFields) {
    if (!data.hasOwnProperty(field)) {
      console.warn(`必須フィールド '${field}' が不足しています`);
      return false;
    }
  }

  // グリッド設定の妥当性チェック
  const { rows, cols, disabledSeats } = data.gridConfig;
  if (!Number.isInteger(rows) || !Number.isInteger(cols) ||
    rows < 3 || rows > 8 || cols < 3 || cols > 8) {
    console.warn('グリッド設定が無効です');
    return false;
  }

  // 座席配列のサイズチェック
  const expectedSeatCount = rows * cols;
  if (!Array.isArray(data.assignedSeats) || data.assignedSeats.length !== expectedSeatCount) {
    console.warn('座席配列のサイズが不正です');
    return false;
  }

  // 無効座席のチェック
  if (!Array.isArray(disabledSeats) ||
    disabledSeats.some(index => index < 0 || index >= expectedSeatCount)) {
    console.warn('無効座席の設定が不正です');
    return false;
  }

  return true;
}

// データの修復関数
function repairRoomData(data, roomId) {
  console.log(`部屋 ${roomId} のデータを修復中...`);

  const defaultData = createDefaultRoomData(roomId);
  const repairedData = { ...defaultData };

  // 有効なデータを可能な限り保持
  if (data.students && Array.isArray(data.students)) {
    repairedData.students = data.students.filter(student =>
      student && typeof student.name === 'string' && student.name.trim()
    );
  }

  if (data.gridConfig &&
    typeof data.gridConfig.rows === 'number' &&
    typeof data.gridConfig.cols === 'number') {
    const rows = Math.max(3, Math.min(8, data.gridConfig.rows));
    const cols = Math.max(3, Math.min(8, data.gridConfig.cols));
    const totalSeats = rows * cols;

    repairedData.gridConfig = {
      rows,
      cols,
      disabledSeats: Array.isArray(data.gridConfig.disabledSeats)
        ? data.gridConfig.disabledSeats.filter(index => index >= 0 && index < totalSeats)
        : []
    };

    repairedData.assignedSeats = Array(totalSeats).fill(null);
    repairedData.attendanceSettings.seatCapacity = totalSeats - repairedData.gridConfig.disabledSeats.length;
  }

  if (data.attendanceSettings && typeof data.attendanceSettings === 'object') {
    repairedData.attendanceSettings = {
      ...repairedData.attendanceSettings,
      ...data.attendanceSettings,
      maxNumber: Math.max(1, Math.min(100, data.attendanceSettings.maxNumber || repairedData.attendanceSettings.maxNumber)),
      absentEnabled: Boolean(data.attendanceSettings.absentEnabled),
      absentNumbers: Array.isArray(data.attendanceSettings.absentNumbers)
        ? data.attendanceSettings.absentNumbers.filter(num => Number.isInteger(num) && num > 0)
        : []
    };
  }

  repairedData.timestamp = Date.now();
  console.log(`部屋 ${roomId} のデータ修復完了`);

  return repairedData;
}

// Socket.io接続処理
io.on('connection', (socket) => {
  console.log('新しいユーザーが接続しました:', socket.id);
  let currentRoom = null;

  // 部屋に参加
  socket.on('joinRoom', (roomId) => {
    try {
      // 前の部屋から離れる
      if (currentRoom) {
        socket.leave(currentRoom);
        console.log(`ユーザー ${socket.id} が部屋 ${currentRoom} から離れました`);
      }

      // 部屋IDの妥当性チェック
      if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
        roomId = 'default';
      }

      currentRoom = roomId.trim();
      socket.join(currentRoom);
      console.log(`ユーザー ${socket.id} が部屋 ${currentRoom} に参加しました`);

      // この部屋が初めてなら初期化
      if (!classrooms[currentRoom]) {
        classrooms[currentRoom] = createDefaultRoomData(currentRoom);
        console.log(`新しい部屋 ${currentRoom} を初期化しました`);
      } else {
        // 既存データの妥当性チェックと修復
        if (!validateRoomData(classrooms[currentRoom])) {
          console.warn(`部屋 ${currentRoom} のデータが破損しています。修復を実行します。`);
          classrooms[currentRoom] = repairRoomData(classrooms[currentRoom], currentRoom);
        }
      }

      // 現在の部屋のデータを送信
      socket.emit('roomData', classrooms[currentRoom]);

    } catch (error) {
      console.error('部屋参加エラー:', error);
      socket.emit('error', { message: '部屋への参加に失敗しました' });
    }
  });

  // 【新規追加】出席番号の一時保持
  socket.on('holdNumber', (data) => {
    try {
      if (!currentRoom || !classrooms[currentRoom]) {
        console.warn('部屋が見つかりません');
        return;
      }

      const { number, timestamp } = data;
      if (!Number.isInteger(number) || number < 1) {
        console.warn('無効な出席番号:', number);
        return;
      }

      // 既に使用されている番号かチェック
      const usedNumbers = classrooms[currentRoom].students
        .map(student => student.number)
        .filter(num => num);

      if (usedNumbers.includes(number)) {
        socket.emit('numberConflictDetected', {
          number,
          conflictType: 'already_used'
        });
        return;
      }

      // 他のユーザーが保持中かチェック
      const existingHold = holdManager.getHoldInfo(currentRoom, number);
      if (existingHold && existingHold.socketId !== socket.id) {
        socket.emit('numberConflictDetected', {
          number,
          conflictType: 'temporarily_held',
          holdBy: existingHold.userId
        });
        return;
      }

      // 一時保持を作成
      const success = holdManager.createHold(currentRoom, number, socket.id, socket.id);
      if (success) {
        socket.emit('numberHoldConfirmed', { number, timestamp });
        socket.to(currentRoom).emit('numberTemporarilyHeld', {
          number,
          heldBy: socket.id
        });
      }

    } catch (error) {
      console.error('一時保持エラー:', error);
      socket.emit('error', { message: '出席番号の保持に失敗しました' });
    }
  });

  // 【新規追加】出席番号の確定
  socket.on('confirmNumber', (data) => {
    try {
      if (!currentRoom || !classrooms[currentRoom]) {
        console.warn('部屋が見つかりません');
        return;
      }

      const { number, timestamp } = data;
      if (!Number.isInteger(number) || number < 1) {
        console.warn('無効な出席番号:', number);
        return;
      }

      // 保持状況を確認
      const success = holdManager.confirmHold(currentRoom, number, socket.id);
      if (success) {
        socket.emit('numberConfirmed', { number, timestamp });
        socket.to(currentRoom).emit('numberConfirmed', {
          number,
          confirmedBy: socket.id
        });
        console.log(`部屋 ${currentRoom} で出席番号 ${number} が確定されました`);
      } else {
        socket.emit('numberConflictDetected', {
          number,
          conflictType: 'not_held'
        });
      }

    } catch (error) {
      console.error('出席番号確定エラー:', error);
      socket.emit('error', { message: '出席番号の確定に失敗しました' });
    }
  });

  // 【新規追加】出席番号の解除
  socket.on('releaseNumber', (data) => {
    try {
      if (!currentRoom) {
        console.warn('部屋が見つかりません');
        return;
      }

      const { number } = data;
      if (!Number.isInteger(number) || number < 1) {
        console.warn('無効な出席番号:', number);
        return;
      }

      const success = holdManager.releaseHold(currentRoom, number, socket.id);
      if (success) {
        socket.to(currentRoom).emit('numberReleased', { number });
        console.log(`部屋 ${currentRoom} で出席番号 ${number} が解除されました`);
      }

    } catch (error) {
      console.error('出席番号解除エラー:', error);
    }
  });

  // 出席番号設定の更新
  socket.on('updateAttendanceSettings', (data) => {
    try {
      if (!currentRoom || !classrooms[currentRoom]) {
        console.warn('部屋が見つかりません');
        return;
      }

      // データの妥当性チェック
      if (!data || typeof data !== 'object') {
        console.warn('無効な出席番号設定データ');
        return;
      }

      // 安全な更新
      const currentSettings = classrooms[currentRoom].attendanceSettings;
      const updatedSettings = {
        maxNumber: Math.max(1, Math.min(100, parseInt(data.maxNumber) || currentSettings.maxNumber)),
        seatCapacity: parseInt(data.seatCapacity) || currentSettings.seatCapacity,
        absentEnabled: Boolean(data.absentEnabled),
        absentNumbers: Array.isArray(data.absentNumbers)
          ? data.absentNumbers.filter(num => Number.isInteger(num) && num > 0 && num <= (data.maxNumber || 100))
          : []
      };

      classrooms[currentRoom].attendanceSettings = updatedSettings;
      classrooms[currentRoom].timestamp = Date.now();

      console.log(`部屋 ${currentRoom} の出席番号設定を更新:`, updatedSettings);

      // 同じ部屋の他のクライアントに更新を通知
      socket.to(currentRoom).emit('attendanceSettingsUpdated', updatedSettings);

    } catch (error) {
      console.error('出席番号設定更新エラー:', error);
      socket.emit('error', { message: '出席番号設定の更新に失敗しました' });
    }
  });

  // 生徒データの更新
  socket.on('updateStudents', (data) => {
    try {
      if (!currentRoom || !classrooms[currentRoom]) {
        console.warn('部屋が見つかりません');
        return;
      }

      // データの妥当性チェック
      if (!Array.isArray(data)) {
        console.warn('無効な生徒データ');
        return;
      }

      // 生徒データのフィルタリングと正規化
      const validatedStudents = data.filter(student =>
        student &&
        typeof student.name === 'string' &&
        student.name.trim().length > 0
      ).map(student => ({
        name: student.name.trim(),
        number: Number.isInteger(student.number) ? student.number : null,
        preferences: Array.isArray(student.preferences) ? student.preferences : [],
        assigned: Boolean(student.assigned),
        assignedSeat: student.assignedSeat || null
      }));

      classrooms[currentRoom].students = validatedStudents;
      classrooms[currentRoom].timestamp = Date.now();

      console.log(`部屋 ${currentRoom} の生徒データを更新: ${validatedStudents.length}人`);

      // 新しく使用された番号の保持をクリア
      const newUsedNumbers = validatedStudents
        .map(student => student.number)
        .filter(num => num);

      newUsedNumbers.forEach(number => {
        if (holdManager.isHeld(currentRoom, number)) {
          holdManager.clearHold(currentRoom, number);
          io.to(currentRoom).emit('numberConflictDetected', {
            number,
            conflictType: 'now_used'
          });
        }
      });

      // 同じ部屋の他のクライアントに更新を通知（送信者以外）
      socket.to(currentRoom).emit('studentsUpdated', validatedStudents);

    } catch (error) {
      console.error('生徒データ更新エラー:', error);
      socket.emit('error', { message: '生徒データの更新に失敗しました' });
    }
  });

  // 座席割り当ての更新
  socket.on('updateAssignedSeats', (data) => {
    try {
      if (!currentRoom || !classrooms[currentRoom]) {
        console.warn('部屋が見つかりません');
        return;
      }

      // データの妥当性チェック
      if (!Array.isArray(data)) {
        console.warn('無効な座席割り当てデータ');
        return;
      }

      const expectedLength = classrooms[currentRoom].gridConfig.rows * classrooms[currentRoom].gridConfig.cols;
      if (data.length !== expectedLength) {
        console.warn(`座席割り当て配列のサイズが不正: 期待値=${expectedLength}, 実際=${data.length}`);
        return;
      }

      classrooms[currentRoom].assignedSeats = data;
      classrooms[currentRoom].timestamp = Date.now();

      console.log(`部屋 ${currentRoom} の座席割り当てを更新`);

      // 同じ部屋の他のクライアントに更新を通知（送信者以外）
      socket.to(currentRoom).emit('assignedSeatsUpdated', data);

    } catch (error) {
      console.error('座席割り当て更新エラー:', error);
      socket.emit('error', { message: '座席割り当ての更新に失敗しました' });
    }
  });

  // グリッド設定の更新
  socket.on('updateGridConfig', (data) => {
    try {
      if (!currentRoom || !classrooms[currentRoom]) {
        console.warn('部屋が見つかりません');
        return;
      }

      // データの妥当性チェック
      if (!data || typeof data !== 'object') {
        console.warn('無効なグリッド設定データ');
        return;
      }

      const rows = Math.max(3, Math.min(8, parseInt(data.rows) || 5));
      const cols = Math.max(3, Math.min(8, parseInt(data.cols) || 5));
      const totalSeats = rows * cols;

      // 無効座席のフィルタリング
      const disabledSeats = Array.isArray(data.disabledSeats)
        ? data.disabledSeats.filter(index => Number.isInteger(index) && index >= 0 && index < totalSeats)
        : [];

      const validatedGridConfig = {
        rows,
        cols,
        disabledSeats
      };

      classrooms[currentRoom].gridConfig = validatedGridConfig;

      // 座席数が変わった場合は配列サイズを調整
      if (classrooms[currentRoom].assignedSeats.length !== totalSeats) {
        console.log(`座席配列サイズを ${classrooms[currentRoom].assignedSeats.length} から ${totalSeats} に調整`);

        // 新しい座席数に合わせて配列を再作成
        const newAssignedSeats = Array(totalSeats).fill(null);

        // 既存のデータをコピー（範囲内のみ）
        for (let i = 0; i < Math.min(classrooms[currentRoom].assignedSeats.length, totalSeats); i++) {
          newAssignedSeats[i] = classrooms[currentRoom].assignedSeats[i];
        }

        classrooms[currentRoom].assignedSeats = newAssignedSeats;
      }

      // 出席番号設定の座席数を更新
      const validSeatCount = totalSeats - disabledSeats.length;
      classrooms[currentRoom].attendanceSettings.seatCapacity = validSeatCount;

      classrooms[currentRoom].timestamp = Date.now();

      console.log(`部屋 ${currentRoom} のグリッド設定を更新:`, validatedGridConfig);

      // 同じ部屋の他のクライアントに更新を通知
      socket.to(currentRoom).emit('gridConfigUpdated', validatedGridConfig);
      socket.to(currentRoom).emit('assignedSeatsUpdated', classrooms[currentRoom].assignedSeats);
      socket.to(currentRoom).emit('attendanceSettingsUpdated', classrooms[currentRoom].attendanceSettings);

    } catch (error) {
      console.error('グリッド設定更新エラー:', error);
      socket.emit('error', { message: 'グリッド設定の更新に失敗しました' });
    }
  });

  // 全データの要求
  socket.on('requestData', () => {
    try {
      if (!currentRoom || !classrooms[currentRoom]) {
        console.warn('データ要求: 部屋が見つかりません');
        return;
      }

      // データの妥当性を確認してから送信
      if (!validateRoomData(classrooms[currentRoom])) {
        console.warn(`データ要求: 部屋 ${currentRoom} のデータが破損している可能性があります`);
        classrooms[currentRoom] = repairRoomData(classrooms[currentRoom], currentRoom);
      }

      socket.emit('roomData', classrooms[currentRoom]);
      console.log(`部屋 ${currentRoom} のデータを送信しました`);

    } catch (error) {
      console.error('データ要求処理エラー:', error);
      socket.emit('error', { message: 'データの取得に失敗しました' });
    }
  });

  // クライアントが全データをクリア
  socket.on('clearAllData', () => {
    try {
      if (!currentRoom) {
        console.warn('データクリア: 部屋が見つかりません');
        return;
      }

      console.log(`部屋 ${currentRoom} の全データをクリアします`);

      // グリッド設定は保持して新しいデータを作成
      const gridConfig = classrooms[currentRoom]?.gridConfig || { rows: 5, cols: 5, disabledSeats: [] };
      const totalSeats = gridConfig.rows * gridConfig.cols;

      classrooms[currentRoom] = {
        students: [],
        gridConfig: gridConfig,
        assignedSeats: Array(totalSeats).fill(null),
        attendanceSettings: {
          maxNumber: totalSeats,
          seatCapacity: totalSeats - gridConfig.disabledSeats.length,
          absentEnabled: false,
          absentNumbers: []
        },
        timestamp: Date.now(),
        roomId: currentRoom
      };

      // 同じ部屋の全クライアントに通知（送信者含む）
      io.to(currentRoom).emit('roomData', classrooms[currentRoom]);
      console.log(`部屋 ${currentRoom} のデータクリア完了`);

    } catch (error) {
      console.error('データクリアエラー:', error);
      socket.emit('error', { message: 'データのクリアに失敗しました' });
    }
  });

  // 切断時の処理
  socket.on('disconnect', (reason) => {
    console.log(`ユーザーが切断しました: ${socket.id}, 理由: ${reason}`);

    // 一時保持をクリーンアップ
    holdManager.cleanupBySocket(socket.id);

    if (currentRoom) {
      socket.leave(currentRoom);
      // 他のクライアントに番号解除を通知
      socket.to(currentRoom).emit('userDisconnected', { socketId: socket.id });
    }
  });

  // エラーハンドリング
  socket.on('error', (error) => {
    console.error(`Socket エラー (${socket.id}):`, error);
  });
});

// サーバー側エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('未処理の例外:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理のPromise拒否:', reason);
});

// 定期的なメモリクリーンアップ（古い部屋データの削除）
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24時間

  // 古い部屋データの削除
  for (const roomId in classrooms) {
    if (classrooms[roomId].timestamp < now - maxAge) {
      delete classrooms[roomId];
      console.log(`古い部屋データを削除しました: ${roomId}`);
    }
  }

  // 孤立した一時保持のクリーンアップ
  holdManager.holds.forEach((roomHolds, roomId) => {
    if (!classrooms[roomId]) {
      holdManager.holds.delete(roomId);
      console.log(`孤立した保持データを削除しました: ${roomId}`);
    }
  });
}, 60 * 60 * 1000); // 1時間ごとに実行

// サーバー起動
const PORT = process.env.PORT || 5500;
server.listen(PORT, () => {
  console.log(`🚀 席替えシミュレーターサーバーが起動しました`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🕐 起動時刻: ${new Date().toLocaleString('ja-JP')}`);
  console.log(`📊 Node.js バージョン: ${process.version}`);
});