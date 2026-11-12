// Tiện ích quản lý Đơn vị vận chuyển & Mã vận đơn (bên thứ 3 / giao nội thành)

export const SHIPPING_CARRIERS = [
    { code: 'GHN', name: 'Giao Hàng Nhanh (GHN)', estimatedDays: '2 - 3 ngày' },
    { code: 'GHTK', name: 'Giao Hàng Tiết Kiệm (GHTK)', estimatedDays: '2 - 4 ngày' },
    { code: 'VTP', name: 'Viettel Post', estimatedDays: '3 - 4 ngày' },
    { code: 'EXPRESS', name: 'Giao nội thành 2H', estimatedDays: 'Trong ngày' }
];

/**
 * Sinh mã vận đơn theo định dạng đối tác vận chuyển: <CARRIER>-<YYMMDD>-<4-6 ký tự>.
 */
export function generateTrackingCode(carrierCode = 'GHN', orderCode = '') {
    const prefix = String(carrierCode || 'GHN').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GHN';
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const orderSuffix = String(orderCode || '').replace(/[^A-Z0-9]/gi, '').slice(-3).toUpperCase();
    const rand = String(Math.floor(100 + Math.random() * 900));
    return `${prefix}-${yy}${mm}${dd}-${orderSuffix}${rand}`;
}

/**
 * Chuẩn hóa thông tin vận chuyển của một đơn hàng để hiển thị thống nhất.
 */
export function formatShippingSummary(order) {
    const carrier = String(order?.shippingCarrier || '').trim();
    const trackingCode = String(order?.trackingCode || '').trim();
    const shippedAt = order?.shippedAt || '';
    const hasShipping = Boolean(carrier || trackingCode);

    return {
        hasShipping,
        carrier: carrier || 'Chưa bàn giao ĐVVC',
        trackingCode,
        shippedAtText: shippedAt ? new Date(shippedAt).toLocaleString('vi-VN') : ''
    };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureDispatchModal() {
    let modal = document.getElementById('shippingDispatchModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'shippingDispatchModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 480px;">
            <h3 class="modal-title" style="margin-bottom: 8px;">🚚 Bàn giao đơn vị vận chuyển</h3>
            <p id="dispatchOrderSummary" style="font-size: 0.88rem; color: #64748b; margin-bottom: 16px; line-height: 1.5;"></p>

            <form id="shippingDispatchForm">
                <div class="form-group" style="margin-bottom: 14px;">
                    <label for="dispatchCarrierSelect" style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.9rem;">
                        Đơn vị vận chuyển
                    </label>
                    <select id="dispatchCarrierSelect" required style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: var(--card-bg, #fff); color: inherit;">
                        ${SHIPPING_CARRIERS.map(c => `<option value="${c.code}">${c.name} (${c.estimatedDays})</option>`).join('')}
                    </select>
                </div>

                <div class="form-group" style="margin-bottom: 18px;">
                    <label for="dispatchTrackingInput" style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.9rem;">
                        Mã vận đơn
                    </label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="dispatchTrackingInput" required maxlength="40"
                            placeholder="VD: GHN-261112-123456"
                            style="flex: 1; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; font-family: monospace; font-weight: 700; background: var(--card-bg, #fff); color: inherit;">
                        <button type="button" id="btnRegenerateTracking" class="btn-action edit" style="white-space: nowrap; padding: 0 12px;" title="Tạo mã vận đơn mới">
                            🎲 Tạo mã
                        </button>
                    </div>
                    <small style="display: block; margin-top: 6px; color: #64748b; font-size: 0.78rem;">
                        Khách hàng sẽ thấy đơn vị vận chuyển và mã vận đơn này trong chi tiết đơn hàng.
                    </small>
                </div>

                <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="btn-modal-cancel" id="btnCancelDispatchModal">Hủy</button>
                    <button type="submit" class="btn-modal-save">Xác nhận giao hàng</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

/**
 * Mở hộp thoại bàn giao đơn vị vận chuyển cho Admin / Seller.
 * Trả về { shippingCarrier, trackingCode } hoặc null nếu người dùng hủy.
 */
export function openDispatchModal(order) {
    return new Promise((resolve) => {
        const modal = ensureDispatchModal();
        const summaryEl = modal.querySelector('#dispatchOrderSummary');
        const form = modal.querySelector('#shippingDispatchForm');
        const carrierSelect = modal.querySelector('#dispatchCarrierSelect');
        const trackingInput = modal.querySelector('#dispatchTrackingInput');
        const regenBtn = modal.querySelector('#btnRegenerateTracking');
        const cancelBtn = modal.querySelector('#btnCancelDispatchModal');

        const orderCode = order?.orderCode || `DH${order?.id || ''}`;
        const receiver = order?.receiverName || 'Khách hàng';
        const address = order?.receiverAddress || 'Chưa cập nhật địa chỉ';
        summaryEl.innerHTML = `Đơn hàng <strong style="color: #4f46e5;">#${escapeHtml(orderCode)}</strong> &bull; Người nhận: <strong>${escapeHtml(receiver)}</strong><br>📍 ${escapeHtml(address)}`;

        const existingCarrier = SHIPPING_CARRIERS.find(c => c.name === order?.shippingCarrier);
        carrierSelect.value = existingCarrier ? existingCarrier.code : 'GHN';
        trackingInput.value = order?.trackingCode || generateTrackingCode(carrierSelect.value, orderCode);

        const cleanup = (result) => {
            modal.classList.remove('active');
            form.removeEventListener('submit', onSubmit);
            carrierSelect.removeEventListener('change', onCarrierChange);
            regenBtn.removeEventListener('click', onRegen);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKeyDown);
            resolve(result);
        };

        const onCarrierChange = () => {
            trackingInput.value = generateTrackingCode(carrierSelect.value, orderCode);
        };

        const onRegen = () => {
            trackingInput.value = generateTrackingCode(carrierSelect.value, orderCode);
        };

        const onSubmit = (e) => {
            e.preventDefault();
            const chosen = SHIPPING_CARRIERS.find(c => c.code === carrierSelect.value);
            const trackingCode = trackingInput.value.trim().toUpperCase();
            if (!trackingCode) {
                trackingInput.focus();
                return;
            }
            cleanup({
                shippingCarrier: chosen ? chosen.name : carrierSelect.value,
                trackingCode
            });
        };

        const onCancel = () => cleanup(null);
        const onBackdrop = (e) => {
            if (e.target === modal) cleanup(null);
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape') cleanup(null);
        };

        form.addEventListener('submit', onSubmit);
        carrierSelect.addEventListener('change', onCarrierChange);
        regenBtn.addEventListener('click', onRegen);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeyDown);

        modal.classList.add('active');
        setTimeout(() => trackingInput.focus(), 50);
    });
}
