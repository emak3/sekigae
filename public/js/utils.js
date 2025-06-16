/**
 * ユーティリティ関数集
 * 汎用的な関数をまとめて管理
 */

/**
 * 配列操作ユーティリティ
 */
const ArrayUtils = {
    /**
     * 配列をシャッフル（Fisher-Yates法）
     */
    shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    /**
     * 配列から重複を除去
     */
    unique(array) {
        return [...new Set(array)];
    },

    /**
     * 配列を指定したサイズのチャンクに分割
     */
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    },

    /**
     * 配列をランダムに並び替えて指定数だけ取得
     */
    randomSample(array, count) {
        const shuffled = this.shuffle(array);
        return shuffled.slice(0, count);
    },

    /**
     * 配列の要素をグループ化
     */
    groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }
};

/**
 * バリデーションユーティリティ
 */
const ValidationUtils = {
    /**
     * 文字列が空かどうかチェック
     */
    isEmpty(str) {
        return !str || str.trim().length === 0;
    },

    /**
     * 数値が範囲内かどうかチェック
     */
    isInRange(value, min, max) {
        const num = Number(value);
        return !isNaN(num) && num >= min && num <= max;
    },

    /**
     * 出席番号の有効性チェック
     */
    isValidStudentNumber(number, min = 1, max = 50) {
        return this.isInRange(number, min, max);
    },

    /**
     * 名前の有効性チェック
     */
    isValidName(name) {
        return !this.isEmpty(name) && name.length <= 20;
    },

    /**
     * グリッドサイズの有効性チェック
     */
    isValidGridSize(rows, cols) {
        return this.isInRange(rows, 3, 8) && this.isInRange(cols, 3, 8);
    },

    /**
     * 希望席選択の有効性チェック
     */
    isValidSeatSelection(seats, disabledSeats = []) {
        if (!Array.isArray(seats) || seats.length !== 3) {
            return { valid: false, message: '3つの希望席を選択してください' };
        }

        const uniqueSeats = this.unique(seats);
        if (uniqueSeats.length !== 3) {
            return { valid: false, message: '同じ席を複数選択することはできません' };
        }

        const hasDisabled = seats.some(seat => disabledSeats.includes(seat));
        if (hasDisabled) {
            return { valid: false, message: '無効な席が選択されています' };
        }

        return { valid: true };
    },

    unique: ArrayUtils.unique
};

/**
 * DOM操作ユーティリティ
 */
const DOMUtils = {
    /**
     * 要素を作成して属性を設定
     */
    createElement(tagName, options = {}) {
        const element = document.createElement(tagName);
        
        if (options.className) {
            element.className = options.className;
        }
        
        if (options.textContent) {
            element.textContent = options.textContent;
        }
        
        if (options.innerHTML) {
            element.innerHTML = options.innerHTML;
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        if (options.dataset) {
            Object.entries(options.dataset).forEach(([key, value]) => {
                element.dataset[key] = value;
            });
        }
        
        if (options.styles) {
            Object.assign(element.style, options.styles);
        }
        
        return element;
    },

    /**
     * 要素にクラスを追加（一時的な場合はdurationを指定）
     */
    addClass(element, className, duration = null) {
        if (!element) return;
        
        element.classList.add(className);
        
        if (duration) {
            setTimeout(() => {
                element.classList.remove(className);
            }, duration);
        }
    },

    /**
     * 要素から特定のクラスを持つ親要素を検索
     */
    findParent(element, className) {
        let current = element.parentNode;
        while (current && current !== document) {
            if (current.classList && current.classList.contains(className)) {
                return current;
            }
            current = current.parentNode;
        }
        return null;
    },

    /**
     * 要素を表示/非表示切り替え
     */
    toggle(element, show = null) {
        if (!element) return;
        
        if (show === null) {
            element.style.display = element.style.display === 'none' ? '' : 'none';
        } else {
            element.style.display = show ? '' : 'none';
        }
    },

    /**
     * スムーズスクロール
     */
    scrollTo(element, offset = 0) {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset + rect.top + offset;
        
        window.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
        });
    }
};

/**
 * ローカルストレージユーティリティ
 */
const StorageUtils = {
    /**
     * データを保存
     */
    set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('ストレージ保存エラー:', error);
            return false;
        }
    },

    /**
     * データを取得
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('ストレージ取得エラー:', error);
            return defaultValue;
        }
    },

    /**
     * データを削除
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('ストレージ削除エラー:', error);
            return false;
        }
    },

    /**
     * 全データをクリア
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('ストレージクリアエラー:', error);
            return false;
        }
    },

    /**
     * ストレージ使用量を取得
     */
    getUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length;
            }
        }
        return total;
    }
};

/**
 * フォーマットユーティリティ
 */
const FormatUtils = {
    /**
     * 日付をフォーマット
     */
    formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        const second = String(d.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hour)
            .replace('mm', minute)
            .replace('ss', second);
    },

    /**
     * 数字を日本語の序数に変換
     */
    toOrdinalJP(number) {
        switch (number) {
            case 1: return '第一';
            case 2: return '第二';
            case 3: return '第三';
            default: return `第${number}`;
        }
    },

    /**
     * 配列を読みやすい文字列に変換
     */
    arrayToString(array, separator = '、', lastSeparator = '、') {
        if (!Array.isArray(array) || array.length === 0) {
            return '';
        }
        
        if (array.length === 1) {
            return array[0].toString();
        }
        
        if (array.length === 2) {
            return array.join(lastSeparator);
        }
        
        return array.slice(0, -1).join(separator) + lastSeparator + array[array.length - 1];
    },

    /**
     * ファイルサイズを読みやすい形式に変換
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

/**
 * イベントユーティリティ
 */
const EventUtils = {
    /**
     * デバウンス関数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * スロットル関数
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * カスタムイベントを発火
     */
    emit(element, eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(event);
    },

    /**
     * 複数の要素にイベントリスナーを追加
     */
    addListeners(elements, eventType, handler) {
        const nodeList = Array.isArray(elements) ? elements : [elements];
        nodeList.forEach(element => {
            if (element && element.addEventListener) {
                element.addEventListener(eventType, handler);
            }
        });
    }
};

/**
 * ランダムユーティリティ
 */
const RandomUtils = {
    /**
     * 指定範囲の整数を生成
     */
    integer(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * 指定範囲の浮動小数点数を生成
     */
    float(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * ランダムな文字列を生成
     */
    string(length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    /**
     * 配列からランダムな要素を選択
     */
    choice(array) {
        return array[Math.floor(Math.random() * array.length)];
    },

    /**
     * ランダムなID生成
     */
    id() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};

// グローバルに公開
window.ArrayUtils = ArrayUtils;
window.ValidationUtils = ValidationUtils;
window.DOMUtils = DOMUtils;
window.StorageUtils = StorageUtils;
window.FormatUtils = FormatUtils;
window.EventUtils = EventUtils;
window.RandomUtils = RandomUtils;

// 後方互換性のためのエイリアス
window.Utils = {
    Array: ArrayUtils,
    Validation: ValidationUtils,
    DOM: DOMUtils,
    Storage: StorageUtils,
    Format: FormatUtils,
    Event: EventUtils,
    Random: RandomUtils
};

console.log('ユーティリティライブラリが読み込まれました');