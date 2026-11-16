/**
 * Định dạng số thành chuỗi tiền tệ chuẩn Việt Nam (VND)
 * @param {number|string} price 
 * @returns {string} ví dụ: "89.000 ₫"
 */
export function formatPrice(price) {
    return Number(price).toLocaleString('vi-VN', {
        style: 'currency',
        currency: 'VND'
    });
}

/**
 * Escape các ký tự đặc biệt của HTML để chèn an toàn vào innerHTML
 * (dùng cho dữ liệu do người dùng nhập như từ khóa tìm kiếm)
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Kiểm tra tính hợp lệ của số điện thoại Việt Nam (10 chữ số, bắt đầu bằng số 0)
 * Đầu số phổ biến: 03x, 05x, 07x, 08x, 09x (hoặc 02x cho số bàn)
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidVietnamesePhone(phone) {
    if (!phone) return false;
    const cleanPhone = String(phone).replace(/[\s\.-]/g, '');
    return /^0\d{9}$/.test(cleanPhone);
}

/**
 * Gắn bộ lọc chỉ cho phép nhập số vào ô điện thoại, chặn chữ và ký tự đặc biệt ngay khi gõ/paste
 * @param {HTMLInputElement} inputEl
 * @param {number} maxLen (mặc định 10)
 */
export function attachNumericPhoneMask(inputEl, maxLen = 10) {
    if (!inputEl) return;
    inputEl.setAttribute('inputmode', 'numeric');
    inputEl.setAttribute('maxlength', String(maxLen));
    inputEl.setAttribute('pattern', `0[0-9]{${maxLen - 1}}`);

    // Chặn bấm phím ký tự không phải số
    inputEl.addEventListener('keypress', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (!/[\d]/.test(e.key)) {
            e.preventDefault();
        }
    });

    // Lọc sạch chữ khi gõ hoặc paste
    inputEl.addEventListener('input', (e) => {
        const cleaned = e.target.value.replace(/\D/g, '').slice(0, maxLen);
        if (e.target.value !== cleaned) {
            e.target.value = cleaned;
        }
    });

    // Xử lý khi paste văn bản chứa chữ
    inputEl.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData)?.getData('text') || '';
        const cleaned = pasteData.replace(/\D/g, '').slice(0, maxLen);
        const start = inputEl.selectionStart || 0;
        const end = inputEl.selectionEnd || 0;
        const current = inputEl.value;
        const nextVal = (current.slice(0, start) + cleaned + current.slice(end)).replace(/\D/g, '').slice(0, maxLen);
        inputEl.value = nextVal;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
