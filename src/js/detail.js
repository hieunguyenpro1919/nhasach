import { productService } from '../services/productService.js';
import { cartService } from '../services/cartService.js';
import { reviewService } from '../services/reviewService.js';
import { orderService } from '../services/orderService.js';
import { authService } from '../services/authService.js';
import { saleService } from '../services/saleService.js';
import { wishlistService } from '../services/wishlistService.js';
import { formatPrice, escapeHtml } from '../utils/format.js';
import { initChatbot } from './chatWidget.js';
import { initNotificationBell } from './notificationBell.js';
import { initInternalChat } from './internalChat.js';
import './themeToggle.js';

const detailContainer = document.querySelector('#productDetail');
const loadingElement = document.querySelector('#loading');
const errorElement = document.querySelector('#error');

let currentProduct = null;
let currentReviews = [];
let currentUnreviewedOrders = [];
let currentCompletedOrdersCount = 0;
let selectedRating = 5;

// 1. Lấy số lượng tồn kho của sản phẩm
function getStock(product) {
    const stock = Number(product.stock);
    return Number.isFinite(stock) && stock > 0 ? stock : 0;
}

// 2. Helper tạo chuỗi ngôi sao vàng
function renderStarsHtml(rating) {
    const rounded = Math.round(Number(rating) || 5);
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star-icon ${i <= rounded ? 'filled' : 'empty'}">★</span>`;
    }
    return html;
}

// 3. Helper format thời gian
function formatTimeAgo(isoString) {
    if (!isoString) return 'Gần đây';
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return 'Gần đây';
    }
}

// 4. Sinh HTML phần chọn số lượng + tồn kho
function renderStockAndQuantity(product, effectivePrice) {
    const stock = getStock(product);
    const isSoldOut = stock === 0;
    const canBuy = !isSoldOut;
    const unitPrice = Number(effectivePrice) || Number(product.price);

    return `
        <div class="stock-box ${isSoldOut ? 'stock-out' : (stock <= 5 ? 'stock-low' : '')}">
            <span class="stock-icon">${isSoldOut ? '❌' : (stock <= 5 ? '⚠️' : '✅')}</span>
            <span class="stock-text">
                ${isSoldOut ? 'Tạm hết hàng' : (stock <= 5 ? `Chỉ còn ${stock} cuốn trong kho` : `Còn hàng (${stock} cuốn)`)}
            </span>
        </div>

        ${canBuy ? `
        <div class="detail-qty-total-row">
            <div class="qty-picker">
                <label class="qty-picker-label">Số lượng mua:</label>
                <div class="qty-picker-control">
                    <button type="button" class="qty-btn" id="qtyMinus" aria-label="Giảm số lượng">−</button>
                    <input type="number" class="qty-input" id="qtyInput"
                           value="1" min="1" max="${stock}" inputmode="numeric">
                    <button type="button" class="qty-btn" id="qtyPlus" aria-label="Tăng số lượng">+</button>
                    <span class="qty-max-hint">Tối đa ${stock}</span>
                </div>
            </div>

            <div class="detail-total-box">
                <span class="detail-total-label">Thành tiền tạm tính:</span>
                <span class="detail-total-value" id="detailTotalValue">${formatPrice(unitPrice)}</span>
            </div>
        </div>
        ` : ''}
    `;
}

// 5. Sinh HTML danh sách đánh giá & bình luận (Hỗ trợ Like và Trả lời lồng nhau)
function renderReviewsListHtml(reviews) {
    if (!reviews || reviews.length === 0) {
        return `
            <div class="no-reviews-box">
                <p>💬 Chưa có nhận xét nào cho cuốn sách này. Hãy là người đầu tiên chia sẻ cảm nhận của bạn!</p>
            </div>
        `;
    }

    const currentUser = authService.getCurrentUser();

    return reviews.map(r => {
        const likes = Array.isArray(r.likes) ? r.likes : [];
        const replies = Array.isArray(r.replies) ? r.replies : [];
        const hasLiked = currentUser && likes.some(id => String(id) === String(currentUser.id));
        const likeCount = likes.length;

        return `
        <div class="review-item-card" data-review-id="${r.id}">
            <div class="review-item-header">
                <div class="reviewer-avatar">
                    ${(escapeHtml(r.userName || 'B'))[0].toUpperCase()}
                </div>
                <div class="reviewer-meta">
                    <strong class="reviewer-name">${escapeHtml(r.userName || 'Độc giả ẩn danh')}</strong>
                    <div class="reviewer-stars">
                        ${reviewService.isStarReview(r)
                            ? `${renderStarsHtml(r.rating)}${(r.isVerifiedPurchase || r.orderCode) ? `<span class="verified-purchase-badge">✓ Đã mua hàng</span>` : ''}`
                            : `<span class="comment-type-badge">💬 Bình luận / Hỏi đáp</span>`
                        }
                        <span class="review-date">${formatTimeAgo(r.createdAt)}</span>
                    </div>
                </div>
            </div>
            <div class="review-content">
                <p>${escapeHtml(r.comment || 'Người mua không để lại nhận xét bằng lời.')}</p>
            </div>

            <!-- Thanh tương tác: Nút Like & Trả lời bình luận -->
            <div class="review-actions-bar">
                <button type="button" class="btn-review-action btn-like-review ${hasLiked ? 'liked' : ''}" data-review-id="${r.id}">
                    <span class="like-icon">${hasLiked ? '❤️' : '🤍'}</span>
                    <span class="like-label">${hasLiked ? 'Đã thích' : 'Thích'}</span>
                    <span class="like-count">(${likeCount})</span>
                </button>
                <button type="button" class="btn-review-action btn-toggle-reply" data-review-id="${r.id}">
                    💬 Trả lời ${replies.length > 0 ? `<span class="reply-badge">(${replies.length})</span>` : ''}
                </button>
            </div>

            <!-- Danh sách câu trả lời lồng nhau -->
            <div class="replies-wrapper" id="repliesWrap-${r.id}">
                <div class="replies-list" id="repliesList-${r.id}">
                    ${replies.map(rep => `
                        <div class="reply-item">
                            <div class="reply-avatar">${(escapeHtml(rep.userName || 'B'))[0].toUpperCase()}</div>
                            <div class="reply-body">
                                <div class="reply-header">
                                    <strong class="reply-name">${escapeHtml(rep.userName || 'Bạn đọc')}</strong>
                                    <span class="reply-date">${formatTimeAgo(rep.createdAt)}</span>
                                </div>
                                <div class="reply-text">${escapeHtml(rep.comment)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Ô nhập câu trả lời (ẩn mặc định, bấm Trả lời để mở) -->
                <div class="reply-input-box hidden" id="replyBox-${r.id}">
                    <div class="reply-input-group">
                        <input type="text" class="reply-input-field" placeholder="Viết câu trả lời của bạn..." data-review-id="${r.id}" />
                        <button type="button" class="btn-send-reply" data-review-id="${r.id}">Gửi</button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// 5.1 Helper sinh giao diện hộp đánh giá & bình luận chuẩn TMĐT:
// - Đánh giá sao (1-5★): Mỗi đơn hàng Hoàn thành có chứa sách được đánh giá 1 lần (mua đơn mới được đánh giá tiếp)
// - Bình luận / Hỏi đáp (không tính sao): Cộng đồng có thể trao đổi tự do không giới hạn
function renderReviewBoxHtml(currentUser, reviews, product, unreviewedOrders = [], completedOrdersCount = 0) {
    if (!currentUser) {
        return `
            <div class="login-required-review-box">
                <div class="login-req-icon">💬</div>
                <div class="login-req-content">
                    <h4>Vui lòng đăng nhập để bình luận & đánh giá</h4>
                    <p>Hãy chia sẻ cảm nhận hoặc đặt câu hỏi về cuốn sách để cộng đồng độc giả cùng thảo luận!</p>
                    <a href="./login.html" class="btn-login-to-review">🔑 Đăng nhập ngay</a>
                </div>
            </div>
        `;
    }

    const hasPendingOrderReview = Array.isArray(unreviewedOrders) && unreviewedOrders.length > 0;
    const ruleNoticeText = hasPendingOrderReview
        ? `✓ Bạn có ${unreviewedOrders.length} đơn hàng đã nhận chưa đánh giá cho cuốn sách này. Mỗi đơn hàng hoàn thành được gửi 1 đánh giá sao.`
        : completedOrdersCount > 0
            ? `✓ Bạn đã hoàn tất đánh giá sao cho tất cả đơn hàng đã nhận (${completedOrdersCount} đơn). Bạn vẫn có thể gửi bình luận / hỏi đáp hoặc mua đơn mới để đánh giá tiếp.`
            : `🔒 Chỉ khách hàng đã mua và xác nhận nhận hàng mới được đánh giá sao (1 lượt / đơn hàng). Bạn vẫn có thể đặt câu hỏi hoặc bình luận bên dưới (không tính điểm sao).`;

    const orderSelectHtml = hasPendingOrderReview
        ? unreviewedOrders.length > 1
            ? `
                <div class="order-review-select-row" id="orderReviewSelectWrap">
                    <label for="reviewOrderCodeSelect">Chọn đơn hàng đánh giá:</label>
                    <select id="reviewOrderCodeSelect" class="order-select-for-review">
                        ${unreviewedOrders.map(o => `<option value="${escapeHtml(o.orderCode)}">Đơn #${escapeHtml(o.orderCode)} (${formatTimeAgo(o.createdAt)})</option>`).join('')}
                    </select>
                </div>
            `
            : `<input type="hidden" id="reviewOrderCodeSelect" value="${escapeHtml(unreviewedOrders[0].orderCode)}">
               <div class="order-review-single-tag" id="orderReviewSelectWrap">✓ Đánh giá cho đơn hàng đã nhận <strong>#${escapeHtml(unreviewedOrders[0].orderCode)}</strong></div>`
        : '';

    return `
        <div class="review-form-card" id="reviewFormCard" data-submit-mode="${hasPendingOrderReview ? 'review' : 'comment'}">
            <div class="review-form-header">
                <h3>${hasPendingOrderReview ? '⭐ Đánh giá đơn hàng & Bình luận' : '💬 Bình luận & Hỏi đáp sản phẩm'}</h3>
                <span class="review-account-tag">👤 <strong>${escapeHtml(currentUser.name || currentUser.email)}</strong></span>
            </div>

            <p class="review-mode-notice ${hasPendingOrderReview ? 'verified' : 'info'}" id="reviewModeNotice">${ruleNoticeText}</p>

            ${hasPendingOrderReview ? `
                <div class="review-mode-tabs" id="reviewModeTabs">
                    <button type="button" class="review-mode-tab active" data-mode="review">⭐ Đánh giá sao (${unreviewedOrders.length} đơn)</button>
                    <button type="button" class="review-mode-tab" data-mode="comment">💬 Chỉ bình luận / Hỏi đáp</button>
                </div>
            ` : ''}

            <form id="reviewForm" class="review-form">
                ${orderSelectHtml}

                ${hasPendingOrderReview ? `
                <div class="form-rating-picker" id="formRatingPickerWrap">
                    <label class="rating-label">Mức độ hài lòng của bạn:</label>
                    <div class="star-picker" id="starPicker">
                        <button type="button" class="star-btn active" data-val="1">★</button>
                        <button type="button" class="star-btn active" data-val="2">★</button>
                        <button type="button" class="star-btn active" data-val="3">★</button>
                        <button type="button" class="star-btn active" data-val="4">★</button>
                        <button type="button" class="star-btn active" data-val="5">★</button>
                    </div>
                    <span class="star-hint" id="starHint">Rất tuyệt vời (5 sao)</span>
                </div>
                ` : ''}

                <div class="form-group-item">
                    <label for="reviewComment">${hasPendingOrderReview ? 'Nhận xét / câu hỏi về cuốn sách:' : 'Nội dung bình luận hoặc câu hỏi của bạn:'}</label>
                    <textarea
                        id="reviewComment"
                        rows="3"
                        placeholder="${hasPendingOrderReview ? 'Hãy chia sẻ cảm nhận về chất lượng sách, đóng gói, nội dung...' : 'Đặt câu hỏi về nội dung sách, bản in, hoặc chia sẻ bình luận với cộng đồng...'}"
                        required
                    ></textarea>
                </div>

                <div class="form-action-row" style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                    <button type="submit" class="btn-submit-review" id="btnSubmitReview">
                        ${hasPendingOrderReview ? '⭐ Gửi Đánh Giá Đơn Hàng' : '💬 Gửi Bình Luận / Hỏi Đáp'}
                    </button>
                    <p class="review-submit-msg" id="reviewSubmitMsg"></p>
                </div>
            </form>
        </div>
    `;
}

// Quản lý đếm ngược Flash Sale trang chi tiết
let detailSaleCountdownTimer = null;

function startDetailSaleCountdown(saleConfig) {
    if (detailSaleCountdownTimer) {
        clearInterval(detailSaleCountdownTimer);
        detailSaleCountdownTimer = null;
    }

    if (!saleConfig) return;

    function tick() {
        const rem = saleService.getTimeRemaining(saleConfig);
        const clockEl = document.querySelector('#detailSaleCountdown');

        if (rem.isExpired) {
            if (detailSaleCountdownTimer) {
                clearInterval(detailSaleCountdownTimer);
                detailSaleCountdownTimer = null;
            }
            // Tải lại trang chi tiết để giá quay về giá gốc
            getProductDetail();
            return;
        }

        if (clockEl) {
            clockEl.textContent = rem.formatted;
        }
    }

    tick();
    detailSaleCountdownTimer = setInterval(tick, 1000);
}

// 6. Tải và render toàn bộ trang chi tiết
async function getProductDetail() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        if (loadingElement) loadingElement.classList.add('hidden');
        if (errorElement) {
            errorElement.textContent = 'Mã sản phẩm không hợp lệ hoặc bị thiếu.';
            errorElement.classList.remove('hidden');
        }
        return;
    }

    try {
        if (loadingElement) loadingElement.classList.remove('hidden');
        if (errorElement) errorElement.classList.add('hidden');

        const currentUser = authService.getCurrentUser();

        // Tải sản phẩm, đánh giá, cấu hình Sale và đơn hàng (nếu đã đăng nhập) song song
        const [product, reviews, saleConfig, allOrders] = await Promise.all([
            productService.getById(id),
            reviewService.getByProductId(id),
            saleService.getConfig().catch(() => null),
            currentUser ? orderService.getAllOrders().catch(() => []) : Promise.resolve([])
        ]);

        currentProduct = product;
        currentReviews = reviews;

        if (currentUser && Array.isArray(allOrders)) {
            const uid = currentUser.id != null ? String(currentUser.id) : '';
            const email = (currentUser.email || '').toLowerCase().trim();
            currentCompletedOrdersCount = allOrders.filter(o => {
                if (!(o.status || '').toLowerCase().includes('hoàn thành')) return false;
                const matchesOwner =
                    (uid && o.userId != null && String(o.userId) === uid) ||
                    (email && (o.userEmail || '').toLowerCase().trim() === email);
                return matchesOwner && Array.isArray(o.items) && o.items.some(item => String(item.id) === String(id));
            }).length;
            currentUnreviewedOrders = reviewService.getUnreviewedCompletedOrders(allOrders, reviews, currentUser, id);
        } else {
            currentCompletedOrdersCount = 0;
            currentUnreviewedOrders = [];
        }

        if (loadingElement) loadingElement.classList.add('hidden');

        const stock = getStock(product);
        const isSoldOut = stock === 0;
        const soldCount = Number(product.soldCount) || 0;
        const stats = reviewService.calcStats(reviews);

        // Kiểm tra xem cuốn sách này có đang trong đợt Sale hay không
        const isSaleCampaignActive = saleService.isSaleActive(saleConfig);
        const priceInfo = saleService.getPriceInfo(product, isSaleCampaignActive);

        // Khung giá hiển thị
        const priceBoxHtml = priceInfo.isSale
            ? `
                <div class="detail-sale-banner" id="detailSaleBanner">
                    <div class="detail-sale-banner-left">
                        <span class="live-pulse"></span>
                        <span>⚡ FLASH SALE GIỜ VÀNG</span>
                    </div>
                    <div class="detail-sale-countdown">
                        <span>Kết thúc sau:</span>
                        <strong id="detailSaleCountdown">00:00:00</strong>
                    </div>
                </div>

                <div class="detail-price-box on-sale">
                    <div class="detail-price-row">
                        <span class="detail-price-label">Giá ưu đãi:</span>
                        <span class="detail-price sale-price">${formatPrice(priceInfo.salePrice)}</span>
                        <span class="detail-sale-badge">⚡ GIẢM -${priceInfo.discountPercent}%</span>
                    </div>
                    <div class="detail-price-sub-row">
                        <span class="detail-original-price">Giá gốc: <del>${formatPrice(priceInfo.originalPrice)}</del></span>
                        <span class="detail-saved-pill">Tiết kiệm: ${formatPrice(priceInfo.savedAmount)}</span>
                    </div>
                </div>
              `
            : `
                <div class="detail-price-box">
                    <span class="detail-price-label">Giá bìa:</span>
                    <span class="detail-price">${formatPrice(product.price)}</span>
                </div>
              `;

        // Render toàn bộ nội dung chi tiết và khu vực đánh giá
        detailContainer.innerHTML = `
            <div class="product-detail-card">
                <div class="detail-image-box">
                    <div class="detail-image-frame">
                        <img
                            src="${product.image}"
                            alt="${escapeHtml(product.name)}"
                            onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80'"
                        >
                        ${priceInfo.isSale ? `<span class="detail-floating-sale-badge">SALE -${priceInfo.discountPercent}%</span>` : ''}
                    </div>

                    <div class="detail-trust-grid">
                        <div class="detail-trust-item">
                            <span>🚚</span>
                            <div>
                                <strong>Freeship đơn từ 250k</strong>
                                <small>Giao toàn quốc 2–4 ngày</small>
                            </div>
                        </div>
                        <div class="detail-trust-item">
                            <span>🛡️</span>
                            <div>
                                <strong>Sách chính hãng 100%</strong>
                                <small>Kiểm tra hàng khi nhận</small>
                            </div>
                        </div>
                        <div class="detail-trust-item">
                            <span>🔄</span>
                            <div>
                                <strong>Đổi trả miễn phí 7 ngày</strong>
                                <small>Hỗ trợ lỗi in ấn &amp; vận chuyển</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="detail-info">
                    <div class="detail-meta-top">
                        <span class="detail-tag">${escapeHtml(product.tag || 'Sách chọn lọc')}</span>
                        <span class="detail-seller-tag">🏪 ${escapeHtml(product.sellerName || 'Trí Tuệ Book Official')}</span>
                    </div>
                    <h1>${escapeHtml(product.name)}</h1>
                    <p class="detail-author">Tác giả: <strong>${escapeHtml(product.author || 'Đang cập nhật')}</strong></p>

                    <!-- Thống kê Sao và Số lượng đã bán -->
                    <div class="detail-stat-row">
                        <span class="detail-rating-pill">⭐ ${stats.average} / 5 (${stats.total} đánh giá)</span>
                        <span class="detail-sold-pill">🔥 Đã bán ${soldCount} cuốn</span>
                    </div>

                    ${priceBoxHtml}

                    ${renderStockAndQuantity(product, priceInfo.salePrice)}

                    <div class="detail-desc-block">
                        <h3 class="detail-desc-title">Tóm tắt nội dung</h3>
                        <p class="detail-description">${escapeHtml(product.description || 'Chưa có thông tin mô tả chi tiết cho tựa sách này.')}</p>
                    </div>

                    <div class="detail-actions">
                        <div class="detail-actions-primary">
                            <button class="btn-buy" id="btnAddToCart" ${isSoldOut ? 'disabled' : ''}>
                                ${isSoldOut ? '❌ Tạm hết hàng' : '🛒 Thêm vào giỏ hàng'}
                            </button>
                            <button class="btn-buy btn-buy-now" id="btnBuyNow" ${isSoldOut ? 'disabled' : ''}>
                                ⚡ Mua ngay
                            </button>
                        </div>
                        <div class="detail-actions-secondary">
                            <button type="button" class="btn-wishlist-detail" id="btnWishlistDetail" title="Lưu vào danh sách yêu thích">
                                <span id="detailHeartIcon">🤍</span>
                                <span id="detailWishlistText">Yêu thích</span>
                            </button>
                            <div class="share-detail-wrap" id="shareDetailWrap">
                                <button type="button" class="btn-share-detail" id="btnShareDetail" title="Chia sẻ cuốn sách này">
                                    🔗 Chia sẻ
                                </button>
                                <div class="share-popover hidden" id="sharePopover">
                                    <div class="share-popover-title">Chia sẻ cuốn sách này</div>
                                    <div class="share-url-preview">
                                        <input type="text" id="shareUrlInput" readonly aria-label="Đường dẫn sách">
                                        <button type="button" id="btnCopyShareLink" class="btn-copy-share">📋 Sao chép</button>
                                    </div>
                                    <div class="share-social-row">
                                        <button type="button" id="btnShareFacebook" class="share-social-btn fb">📘 Facebook</button>
                                        <button type="button" id="btnShareEmail" class="share-social-btn mail">✉️ Email</button>
                                        <button type="button" id="btnShareNative" class="share-social-btn native hidden">📲 Chia sẻ khác</button>
                                    </div>
                                </div>
                            </div>
                            <button type="button" class="btn-chat-seller-detail" id="btnChatSellerDetail" title="Nhắn tin với gian hàng">
                                💬 Chat với Shop
                            </button>
                            <a href="../index.html" class="btn-secondary">
                                ← Xem thêm sách
                            </a>
                        </div>
                    </div>

                    <p class="detail-feedback" id="detailFeedback"></p>
                </div>
            </div>

            <!-- SECTION ĐÁNH GIÁ & NHẬN XÉT -->
            <section class="reviews-section" id="reviewsSection">
                <div class="reviews-section-header">
                    <h2>⭐ Đánh Giá & Nhận Xét Từ Độc Giả</h2>
                    <span class="reviews-sub-label">Những chia sẻ chân thực từ bạn đọc đã mua cuốn sách này</span>
                </div>

                <div class="reviews-overview-box">
                    <div class="overview-rating-score">
                        <span class="score-number">${stats.average}</span>
                        <div class="score-stars">
                            ${renderStarsHtml(stats.average)}
                        </div>
                        <span class="score-count">Dựa trên ${stats.total} lượt đánh giá</span>
                    </div>
                </div>

                <!-- HỘP ĐÁNH GIÁ (FORM / BADGE ĐÃ ĐÁNH GIÁ / ĐĂNG NHẬP) -->
                <div class="review-box-slot" id="reviewBoxSlot">
                    ${renderReviewBoxHtml(currentUser, currentReviews, product, currentUnreviewedOrders, currentCompletedOrdersCount)}
                </div>

                <!-- DANH SÁCH BÌNH LUẬN -->
                <div class="reviews-list-container">
                    <h3 class="reviews-list-title">Độc giả nói gì về cuốn sách này (${currentReviews.length}):</h3>
                    <div class="reviews-list" id="reviewsList">
                        ${renderReviewsListHtml(currentReviews)}
                    </div>
                </div>
            </section>
        `;

        if (priceInfo.isSale) {
            startDetailSaleCountdown(saleConfig);
        }

        bindEvents(product, stock, priceInfo);
        bindReviewEvents(product);

    } catch (error) {
        console.error('Không thể lấy chi tiết sản phẩm:', error);
        if (loadingElement) loadingElement.classList.add('hidden');
        if (errorElement) {
            errorElement.textContent = 'Không tìm thấy cuốn sách này trên hệ thống.';
            errorElement.classList.remove('hidden');
        }
    }
}

// 7. Gắn sự kiện cho các nút mua hàng & số lượng
function bindEvents(product, stock, priceInfo = { isSale: false, salePrice: product.price }) {
    const btnAdd = document.querySelector('#btnAddToCart');
    const btnBuyNow = document.querySelector('#btnBuyNow');
    const qtyInput = document.querySelector('#qtyInput');
    const qtyMinus = document.querySelector('#qtyMinus');
    const qtyPlus = document.querySelector('#qtyPlus');
    const totalValue = document.querySelector('#detailTotalValue');
    const feedback = document.querySelector('#detailFeedback');
    const cartCount = document.querySelector('#cartCount');
    const effectiveUnitPrice = Number(priceInfo.salePrice) || Number(product.price);

    function updateCartBadge() {
        if (cartCount) cartCount.textContent = cartService.getTotalCount();
    }

    function getSelectedQty() {
        if (!qtyInput) return 1;
        let qty = parseInt(qtyInput.value, 10);
        if (!Number.isFinite(qty) || qty < 1) qty = 1;
        if (qty > stock) qty = stock;
        qtyInput.value = qty;
        return qty;
    }

    function refreshTotal() {
        if (totalValue) {
            totalValue.textContent = formatPrice(effectiveUnitPrice * getSelectedQty());
        }
    }

    function showFeedback(text, type = 'success') {
        if (!feedback) return;
        feedback.textContent = text;
        feedback.className = `detail-feedback ${type} show`;
    }

    if (qtyMinus) {
        qtyMinus.addEventListener('click', () => {
            qtyInput.value = Math.max(1, getSelectedQty() - 1);
            refreshTotal();
        });
    }

    if (qtyPlus) {
        qtyPlus.addEventListener('click', () => {
            qtyInput.value = Math.min(stock, getSelectedQty() + 1);
            refreshTotal();
            if (parseInt(qtyInput.value, 10) === stock) {
                showFeedback(`Đã đạt tối đa ${stock} cuốn trong kho.`, 'warning');
            }
        });
    }

    if (qtyInput) {
        qtyInput.addEventListener('change', () => {
            getSelectedQty();
            refreshTotal();
        });
        qtyInput.addEventListener('input', refreshTotal);
    }

    refreshTotal();
    updateCartBadge();
    window.addEventListener('cartUpdated', updateCartBadge);

    const productToPurchase = priceInfo.isSale ? { ...product, price: effectiveUnitPrice } : product;

    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            const perm = cartService.checkPurchasePermission(authService.getCurrentUser(), productToPurchase);
            if (!perm.allowed) {
                showFeedback(perm.message, 'warning');
                alert(perm.message);
                return;
            }

            const qty = getSelectedQty();
            const result = cartService.addToCart(productToPurchase, qty);

            if (result.blockedReason) {
                showFeedback(result.message, 'warning');
                alert(result.message);
                return;
            }

            if (result.added <= 0) {
                showFeedback(`Bạn đã có tối đa ${stock} cuốn của tựa sách này trong giỏ.`, 'warning');
                return;
            }

            updateCartBadge();
            showFeedback(`✓ Đã thêm ${result.added} cuốn vào giỏ hàng!`, 'success');

            if (result.added < qty) {
                setTimeout(() => {
                    showFeedback(`Chỉ còn ${stock} cuốn trong kho, giỏ hàng đã được giới hạn tối đa.`, 'warning');
                }, 1600);
            }
        });
    }

    if (btnBuyNow) {
        btnBuyNow.addEventListener('click', () => {
            const user = authService.getCurrentUser();
            const qty = getSelectedQty();

            if (!user) {
                // Lưu tạm sách vào giỏ hàng để sau khi đăng nhập khách có thể thanh toán ngay
                cartService.addToCart(productToPurchase, qty);
                updateCartBadge();
                alert('Vui lòng đăng nhập tài khoản để tiến hành mua hàng!');
                window.location.href = './login.html';
                return;
            }

            const perm = cartService.checkPurchasePermission(user, productToPurchase);
            if (!perm.allowed) {
                showFeedback(perm.message, 'warning');
                alert(perm.message);
                return;
            }

            const result = cartService.addToCart(productToPurchase, qty);

            if (result.blockedReason) {
                showFeedback(result.message, 'warning');
                alert(result.message);
                return;
            }

            if (result.added <= 0) {
                showFeedback(`Bạn đã có tối đa ${stock} cuốn của tựa sách này trong giỏ.`, 'warning');
                return;
            }

            updateCartBadge();
            window.location.href = './cart.html';
        });
    }

    // Xử lý nút Thả tim Yêu thích trên trang chi tiết
    const btnWishlistDetail = document.querySelector('#btnWishlistDetail');
    const detailHeartIcon = document.querySelector('#detailHeartIcon');
    const detailWishlistText = document.querySelector('#detailWishlistText');

    async function syncWishlistState() {
        const user = authService.getCurrentUser();
        if (!user || !btnWishlistDetail) return;
        try {
            const wishlistIds = await wishlistService.getUserWishlistProductIds(user.id);
            const isWishlisted = wishlistIds.has(Number(product.id));
            btnWishlistDetail.classList.toggle('active', isWishlisted);
            if (detailHeartIcon) detailHeartIcon.textContent = isWishlisted ? '❤️' : '🤍';
            if (detailWishlistText) detailWishlistText.textContent = isWishlisted ? 'Đã thích' : 'Yêu thích';
        } catch (e) {
            console.warn('Lỗi kiểm tra wishlist:', e);
        }
    }

    if (btnWishlistDetail) {
        syncWishlistState();
        btnWishlistDetail.addEventListener('click', async () => {
            const user = authService.getCurrentUser();
            if (!user) {
                alert('Vui lòng đăng nhập để lưu cuốn sách này vào danh sách Yêu thích của bạn!');
                window.location.href = './login.html';
                return;
            }

            try {
                btnWishlistDetail.disabled = true;
                const result = await wishlistService.toggleWishlist(user.id, product.id);
                btnWishlistDetail.classList.toggle('active', result.isWishlisted);
                if (detailHeartIcon) detailHeartIcon.textContent = result.isWishlisted ? '❤️' : '🤍';
                if (detailWishlistText) detailWishlistText.textContent = result.isWishlisted ? 'Đã thích' : 'Yêu thích';
                showFeedback(result.isWishlisted ? '❤️ Đã thêm vào danh sách yêu thích của bạn!' : 'Đã xóa khỏi danh sách yêu thích.', 'success');
            } catch (err) {
                console.error('Lỗi khi thao tác wishlist:', err);
                showFeedback('Có lỗi xảy ra, vui lòng thử lại.', 'warning');
            } finally {
                btnWishlistDetail.disabled = false;
            }
        });
    }

    // Xử lý nút Chat với Shop trên trang chi tiết
    const btnChatSellerDetail = document.querySelector('#btnChatSellerDetail');
    if (btnChatSellerDetail) {
        btnChatSellerDetail.addEventListener('click', () => {
            const user = authService.getCurrentUser();
            if (!user) {
                alert('Vui lòng đăng nhập để trao đổi tin nhắn trực tiếp với gian hàng!');
                window.location.href = './login.html';
                return;
            }

            const sellerId = product.sellerId || 101;
            const sellerName = product.sellerName || 'Gian hàng đối tác';
            if (typeof window.openInternalChatWith === 'function') {
                window.openInternalChatWith(sellerId, sellerName);
            }
        });
    }

    // Xử lý nút Chia sẻ sách
    const btnShareDetail = document.querySelector('#btnShareDetail');
    const sharePopover = document.querySelector('#sharePopover');
    const shareUrlInput = document.querySelector('#shareUrlInput');
    const btnCopyShareLink = document.querySelector('#btnCopyShareLink');
    const btnShareFacebook = document.querySelector('#btnShareFacebook');
    const btnShareEmail = document.querySelector('#btnShareEmail');
    const btnShareNative = document.querySelector('#btnShareNative');
    const shareUrl = window.location.href;
    const shareTitle = `${product.name || 'Sách hay'} - Trí Tuệ Book`;
    const shareText = `Mình tìm thấy cuốn "${product.name || 'sách hay'}" (${formatPrice(effectiveUnitPrice)}) rất hay tại Trí Tuệ Book, bạn xem thử nhé!`;

    if (shareUrlInput) {
        shareUrlInput.value = shareUrl;
    }

    if (btnShareNative && typeof navigator.share === 'function') {
        btnShareNative.classList.remove('hidden');
        btnShareNative.addEventListener('click', async () => {
            try {
                await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
                if (sharePopover) sharePopover.classList.add('hidden');
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn('Chia sẻ qua thiết bị thất bại:', err);
                }
            }
        });
    }

    if (btnShareDetail && sharePopover) {
        btnShareDetail.addEventListener('click', (e) => {
            e.stopPropagation();
            sharePopover.classList.toggle('hidden');
            if (!sharePopover.classList.contains('hidden') && shareUrlInput) {
                shareUrlInput.select();
            }
        });
    }

    if (btnCopyShareLink) {
        btnCopyShareLink.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(shareUrl);
                } else if (shareUrlInput) {
                    shareUrlInput.select();
                    document.execCommand('copy');
                }
                const oldText = btnCopyShareLink.textContent;
                btnCopyShareLink.textContent = '✓ Đã chép';
                btnCopyShareLink.classList.add('copied');
                showFeedback('🔗 Đã sao chép đường dẫn sách để chia sẻ!', 'success');
                setTimeout(() => {
                    btnCopyShareLink.textContent = oldText;
                    btnCopyShareLink.classList.remove('copied');
                }, 1800);
            } catch (err) {
                console.error('Không sao chép được link:', err);
                showFeedback('Không thể tự động sao chép, bạn hãy copy trực tiếp trong ô link nhé.', 'warning');
            }
        });
    }

    if (btnShareFacebook) {
        btnShareFacebook.addEventListener('click', () => {
            const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            window.open(fbUrl, '_blank', 'noopener,noreferrer,width=640,height=480');
        });
    }

    if (btnShareEmail) {
        btnShareEmail.addEventListener('click', () => {
            const mailUrl = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText + '\n\nXem chi tiết tại: ' + shareUrl)}`;
            window.location.href = mailUrl;
        });
    }
}

// Đóng popover chia sẻ khi click ra ngoài
document.addEventListener('click', (e) => {
    const shareWrap = document.querySelector('#shareDetailWrap');
    const sharePopover = document.querySelector('#sharePopover');
    if (shareWrap && sharePopover && !shareWrap.contains(e.target)) {
        sharePopover.classList.add('hidden');
    }
});

// 8. Gắn sự kiện form đánh giá / bình luận trong #reviewBoxSlot
function bindReviewBoxForm(product) {
    const reviewFormCard = document.querySelector('#reviewFormCard');
    const modeTabs = document.querySelector('#reviewModeTabs');
    const orderSelectWrap = document.querySelector('#orderReviewSelectWrap');
    const orderSelect = document.querySelector('#reviewOrderCodeSelect');
    const ratingPickerWrap = document.querySelector('#formRatingPickerWrap');
    const starPicker = document.querySelector('#starPicker');
    const starHint = document.querySelector('#starHint');
    const reviewForm = document.querySelector('#reviewForm');
    const reviewCommentInput = document.querySelector('#reviewComment');
    const btnSubmit = document.querySelector('#btnSubmitReview');
    const submitMsg = document.querySelector('#reviewSubmitMsg');

    const starHints = {
        1: 'Rất không hài lòng (1 sao)',
        2: 'Không hài lòng (2 sao)',
        3: 'Bình thường (3 sao)',
        4: 'Hài lòng (4 sao)',
        5: 'Rất tuyệt vời (5 sao)'
    };

    function updateStarsUi(starValue) {
        selectedRating = starValue;
        if (!starPicker) return;
        const buttons = starPicker.querySelectorAll('.star-btn');
        buttons.forEach(btn => {
            const val = Number(btn.dataset.val);
            if (val <= starValue) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        if (starHint) starHint.textContent = starHints[starValue] || `${starValue} sao`;
    }

    if (modeTabs && reviewFormCard) {
        modeTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.review-mode-tab');
            if (!tab) return;
            const mode = tab.dataset.mode === 'comment' ? 'comment' : 'review';
            reviewFormCard.dataset.submitMode = mode;

            modeTabs.querySelectorAll('.review-mode-tab').forEach(btn => {
                btn.classList.toggle('active', btn === tab);
            });

            if (ratingPickerWrap) {
                ratingPickerWrap.style.display = mode === 'review' ? '' : 'none';
            }
            if (orderSelectWrap) {
                orderSelectWrap.style.display = mode === 'review' ? '' : 'none';
            }
            if (btnSubmit) {
                btnSubmit.textContent = mode === 'review' ? '⭐ Gửi Đánh Giá Đơn Hàng' : '💬 Gửi Bình Luận / Hỏi Đáp';
            }
            if (reviewCommentInput) {
                reviewCommentInput.placeholder = mode === 'review'
                    ? 'Hãy chia sẻ cảm nhận về chất lượng sách, đóng gói, nội dung...'
                    : 'Đặt câu hỏi về nội dung sách, bản in, hoặc chia sẻ bình luận với cộng đồng...';
            }
        });
    }

    if (starPicker) {
        starPicker.addEventListener('click', (e) => {
            const btn = e.target.closest('.star-btn');
            if (btn) {
                const val = Number(btn.dataset.val);
                updateStarsUi(val);
            }
        });
    }

    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentUser = authService.getCurrentUser();
            if (!currentUser) {
                alert('Vui lòng đăng nhập để gửi bình luận.');
                window.location.href = './login.html';
                return;
            }

            const comment = reviewCommentInput ? reviewCommentInput.value.trim() : '';
            if (!comment) {
                if (submitMsg) {
                    submitMsg.textContent = '⚠️ Vui lòng nhập nội dung cảm nhận hoặc câu hỏi của bạn.';
                    submitMsg.className = 'review-submit-msg error show';
                }
                return;
            }

            const isReviewMode =
                reviewFormCard &&
                reviewFormCard.dataset.submitMode === 'review' &&
                currentUnreviewedOrders.length > 0;
            const selectedOrderCode = isReviewMode
                ? (orderSelect ? orderSelect.value : currentUnreviewedOrders[0].orderCode)
                : '';

            try {
                if (btnSubmit) {
                    btnSubmit.disabled = true;
                    btnSubmit.textContent = isReviewMode ? '⏳ Đang gửi đánh giá...' : '⏳ Đang gửi bình luận...';
                }

                const newReview = await reviewService.create({
                    productId: Number(product.id),
                    userId: currentUser.id,
                    userName: currentUser.name || currentUser.email,
                    userEmail: currentUser.email || '',
                    type: isReviewMode ? 'review' : 'comment',
                    rating: isReviewMode ? selectedRating : 0,
                    orderCode: selectedOrderCode,
                    isVerifiedPurchase: isReviewMode,
                    comment,
                    likes: [],
                    replies: [],
                    createdAt: new Date().toISOString()
                });

                // Cập nhật danh sách hiển thị
                currentReviews.unshift(newReview);
                const reviewsList = document.querySelector('#reviewsList');
                if (reviewsList) {
                    reviewsList.innerHTML = renderReviewsListHtml(currentReviews);
                }

                // Cập nhật tiêu đề số lượng bình luận
                const reviewsListTitle = document.querySelector('.reviews-list-title');
                if (reviewsListTitle) {
                    reviewsListTitle.textContent = `Độc giả nói gì về cuốn sách này (${currentReviews.length}):`;
                }

                // Cập nhật lại điểm số trung bình ở overview và header
                const updatedStats = reviewService.calcStats(currentReviews);
                const scoreNumber = document.querySelector('.score-number');
                if (scoreNumber) scoreNumber.textContent = updatedStats.average;
                const scoreStars = document.querySelector('.score-stars');
                if (scoreStars) scoreStars.innerHTML = renderStarsHtml(updatedStats.average);
                const scoreCount = document.querySelector('.score-count');
                if (scoreCount) scoreCount.textContent = `Dựa trên ${updatedStats.total} lượt đánh giá`;

                const ratingPill = document.querySelector('.detail-rating-pill');
                if (ratingPill) ratingPill.textContent = `⭐ ${updatedStats.average} / 5 (${updatedStats.total} đánh giá)`;

                if (isReviewMode) {
                    // Gỡ đơn hàng vừa đánh giá khỏi danh sách đơn chờ đánh giá (chỉ 1 lần / đơn hàng)
                    currentUnreviewedOrders = currentUnreviewedOrders.filter(o => o.orderCode !== selectedOrderCode);
                    const slot = document.querySelector('#reviewBoxSlot');
                    if (slot) {
                        slot.innerHTML = renderReviewBoxHtml(
                            currentUser,
                            currentReviews,
                            product,
                            currentUnreviewedOrders,
                            currentCompletedOrdersCount
                        );
                        bindReviewBoxForm(product);
                    }
                    const refreshedMsg = document.querySelector('#reviewSubmitMsg');
                    if (refreshedMsg) {
                        refreshedMsg.textContent = `🎉 Đã gửi đánh giá thành công cho đơn hàng #${selectedOrderCode}!`;
                        refreshedMsg.className = 'review-submit-msg success show';
                        setTimeout(() => {
                            refreshedMsg.className = 'review-submit-msg';
                        }, 4000);
                    }
                } else {
                    if (reviewCommentInput) {
                        reviewCommentInput.value = '';
                    }
                    if (submitMsg) {
                        submitMsg.textContent = '🎉 Bình luận của bạn đã được đăng thành công!';
                        submitMsg.className = 'review-submit-msg success show';
                        setTimeout(() => {
                            submitMsg.className = 'review-submit-msg';
                        }, 3500);
                    }
                }
            } catch (err) {
                console.error('Lỗi gửi đánh giá/bình luận:', err);
                if (submitMsg) {
                    submitMsg.textContent = `❌ ${err.message || 'Không thể gửi lúc này, vui lòng thử lại sau.'}`;
                    submitMsg.className = 'review-submit-msg error show';
                }
            } finally {
                const activeBtn = document.querySelector('#btnSubmitReview');
                const activeCard = document.querySelector('#reviewFormCard');
                if (activeBtn && activeBtn.disabled) {
                    activeBtn.disabled = false;
                    activeBtn.textContent = activeCard && activeCard.dataset.submitMode === 'review'
                        ? '⭐ Gửi Đánh Giá Đơn Hàng'
                        : '💬 Gửi Bình Luận / Hỏi Đáp';
                }
            }
        });
    }
}

// 8.1 Gắn sự kiện tương tác đánh giá & bình luận
function bindReviewEvents(product) {
    bindReviewBoxForm(product);

    // Sự kiện tương tác trên danh sách bình luận (Thích & Trả lời)
    const reviewsList = document.querySelector('#reviewsList');
    if (reviewsList) {
        reviewsList.addEventListener('click', async (e) => {
            // 1. NÚT LIKE BÌNH LUẬN
            const likeBtn = e.target.closest('.btn-like-review');
            if (likeBtn) {
                const currentUser = authService.getCurrentUser();
                if (!currentUser) {
                    alert('Vui lòng đăng nhập để thích bình luận.');
                    window.location.href = './login.html';
                    return;
                }
                const reviewId = likeBtn.dataset.reviewId;
                const targetReview = currentReviews.find(r => String(r.id) === String(reviewId));
                if (!targetReview) return;

                targetReview.likes = Array.isArray(targetReview.likes) ? targetReview.likes : [];
                const uid = currentUser.id;
                const idx = targetReview.likes.findIndex(id => String(id) === String(uid));
                if (idx > -1) {
                    targetReview.likes.splice(idx, 1);
                } else {
                    targetReview.likes.push(uid);
                }

                // Cập nhật giao diện nút Like ngay tức thì
                const hasLiked = targetReview.likes.some(id => String(id) === String(uid));
                likeBtn.classList.toggle('liked', hasLiked);
                const iconSpan = likeBtn.querySelector('.like-icon');
                if (iconSpan) iconSpan.textContent = hasLiked ? '❤️' : '🤍';
                const labelSpan = likeBtn.querySelector('.like-label');
                if (labelSpan) labelSpan.textContent = hasLiked ? 'Đã thích' : 'Thích';
                const countSpan = likeBtn.querySelector('.like-count');
                if (countSpan) countSpan.textContent = `(${targetReview.likes.length})`;

                // Lưu thay đổi lên backend/API
                reviewService.toggleLike(reviewId, uid);
                return;
            }

            // 2. NÚT MỞ / ĐÓNG HỘP TRẢ LỜI
            const toggleReplyBtn = e.target.closest('.btn-toggle-reply');
            if (toggleReplyBtn) {
                const reviewId = toggleReplyBtn.dataset.reviewId;
                const replyBox = document.querySelector(`#replyBox-${reviewId}`);
                if (replyBox) {
                    replyBox.classList.toggle('hidden');
                    if (!replyBox.classList.contains('hidden')) {
                        const input = replyBox.querySelector('.reply-input-field');
                        if (input) input.focus();
                    }
                }
                return;
            }

            // 3. NÚT GỬI CÂU TRẢ LỜI
            const sendReplyBtn = e.target.closest('.btn-send-reply');
            if (sendReplyBtn) {
                const currentUser = authService.getCurrentUser();
                if (!currentUser) {
                    alert('Vui lòng đăng nhập để trả lời bình luận.');
                    window.location.href = './login.html';
                    return;
                }
                const reviewId = sendReplyBtn.dataset.reviewId;
                const input = document.querySelector(`.reply-input-field[data-review-id="${reviewId}"]`);
                if (!input) return;
                const comment = input.value.trim();
                if (!comment) {
                    input.focus();
                    return;
                }

                sendReplyBtn.disabled = true;
                sendReplyBtn.textContent = '⏳';

                try {
                    const replyData = {
                        userId: currentUser.id,
                        userName: currentUser.name || currentUser.email,
                        comment
                    };
                    await reviewService.addReply(reviewId, replyData);

                    const targetReview = currentReviews.find(r => String(r.id) === String(reviewId));
                    if (targetReview) {
                        targetReview.replies = Array.isArray(targetReview.replies) ? targetReview.replies : [];
                        targetReview.replies.push({
                            id: Date.now(),
                            userId: currentUser.id,
                            userName: currentUser.name || currentUser.email,
                            comment,
                            createdAt: new Date().toISOString()
                        });
                    }

                    // Render lại toàn bộ danh sách để đồng bộ số lượng câu trả lời
                    reviewsList.innerHTML = renderReviewsListHtml(currentReviews);
                } catch (err) {
                    console.error('Lỗi khi gửi phản hồi:', err);
                    alert('Không thể gửi trả lời lúc này, vui lòng thử lại.');
                }
            }
        });

        // Nhấn phím Enter trong ô nhập trả lời
        reviewsList.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('reply-input-field')) {
                e.preventDefault();
                const reviewId = e.target.dataset.reviewId;
                const sendBtn = document.querySelector(`.btn-send-reply[data-review-id="${reviewId}"]`);
                if (sendBtn) sendBtn.click();
            }
        });
    }
}

getProductDetail();
initNotificationBell();
initInternalChat();
initChatbot();