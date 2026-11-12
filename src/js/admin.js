import { productService } from '../services/productService.js';
import { categoryService } from '../services/categoryService.js';
import { orderService } from '../services/orderService.js';
import { authService } from '../services/authService.js';
import { saleService } from '../services/saleService.js';
import { couponService } from '../services/couponService.js';
import { formatPrice, escapeHtml } from '../utils/format.js';
import { paginate, renderPagination, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../utils/pagination.js';
import { excelExportUtil } from '../utils/excelExport.js';
import { excelImportUtil } from '../utils/excelImport.js';
import { setupImageUploader } from '../utils/imageUpload.js';
import './themeToggle.js';

// 1. Kiểm tra quyền truy cập Quản trị viên
const currentUser = authService.getCurrentUser();
if (!currentUser || currentUser.role !== 'admin') {
    alert('⚠️ Bạn cần đăng nhập bằng tài khoản Quản trị viên để truy cập trang này!');
    window.location.href = './login.html';
}

// State quản lý toàn bộ hệ thống
let allCategories = [];
let allBooks = [];
let allOrders = [];
let allUsers = [];
let allCoupons = [];
let currentSaleConfig = null;
let revenuePeriodFilter = 'all';
let revenueDateFrom = '';
let revenueDateTo = '';
let lastRevenueReport = null;

// State phân trang (client-side) cho từng bảng dữ liệu
let booksPage = 1;
let booksPageSize = DEFAULT_PAGE_SIZE;
let ordersPage = 1;
let ordersPageSize = DEFAULT_PAGE_SIZE;
let usersPage = 1;
let usersPageSize = DEFAULT_PAGE_SIZE;
let salesPage = 1;
let salesPageSize = DEFAULT_PAGE_SIZE;

// Lưu lại kết quả lọc hiện tại để phân trang gọi lại được mà không cần lọc lại từ đầu
let filteredBooks = [];
let filteredOrders = [];
let filteredUsers = [];
let filteredSales = [];

// DOM Elements: Thống kê & Tabs
const statTotalBooks = document.querySelector('#statTotalBooks');
const statTotalStock = document.querySelector('#statTotalStock');
const statTotalOrders = document.querySelector('#statTotalOrders');
const statPendingOrders = document.querySelector('#statPendingOrders');
const statTotalRevenue = document.querySelector('#statTotalRevenue');
const statCompletedRevenue = document.querySelector('#statCompletedRevenue');
const statLowStock = document.querySelector('#statLowStock');
const statOutStock = document.querySelector('#statOutStock');

const booksTabCount = document.querySelector('#booksTabCount');
const ordersTabCount = document.querySelector('#ordersTabCount');
const categoriesTabCount = document.querySelector('#categoriesTabCount');
const usersTabCount = document.querySelector('#usersTabCount');
const salesTabCount = document.querySelector('#salesTabCount');

// Bảng dữ liệu
const booksTableBody = document.querySelector('#booksTableBody');
const ordersTableBody = document.querySelector('#ordersTableBody');
const categoriesTableBody = document.querySelector('#categoriesTableBody');
const usersTableBody = document.querySelector('#usersTableBody');
const salesTableBody = document.querySelector('#salesTableBody');

// Container chứa thanh phân trang của từng bảng
const booksPagination = document.querySelector('#booksPagination');
const ordersPagination = document.querySelector('#ordersPagination');
const usersPagination = document.querySelector('#usersPagination');
const salesPagination = document.querySelector('#salesPagination');

// Tìm kiếm & Bộ lọc
const searchBookInput = document.querySelector('#searchBookInput');
const filterBookCategory = document.querySelector('#filterBookCategory');
const filterBookSeller = document.querySelector('#filterBookSeller');
const filterBookStock = document.querySelector('#filterBookStock');
const searchOrderAdminInput = document.querySelector('#searchOrderAdminInput');
const filterOrderSellerSelect = document.querySelector('#filterOrderSellerSelect');
const filterOrderStatusSelect = document.querySelector('#filterOrderStatusSelect');
const searchCategoryInput = document.querySelector('#searchCategoryInput');
const searchUserInput = document.querySelector('#searchUserInput');
const filterUserRole = document.querySelector('#filterUserRole');
const filterUserStatus = document.querySelector('#filterUserStatus');
const btnOpenAddUserModal = document.querySelector('#btnOpenAddUserModal');
const searchSaleBookInput = document.querySelector('#searchSaleBookInput');
const filterSaleStatus = document.querySelector('#filterSaleStatus');
const saleEligibleCount = document.querySelector('#saleEligibleCount');
const bookSellerIdInput = document.querySelector('#bookSellerId');

// Elements Cấu hình Sale & Flash Sale Realtime
const saleStatusIndicator = document.querySelector('#saleStatusIndicator');
const adminSaleLivePanel = document.querySelector('#adminSaleLivePanel');
const adminLiveTitle = document.querySelector('#adminLiveTitle');
const adminLiveTimeRange = document.querySelector('#adminLiveTimeRange');
const adminLiveClock = document.querySelector('#adminLiveClock');
const adminLiveDesc = document.querySelector('#adminLiveDesc');
const customDurationHours = document.querySelector('#customDurationHours');
const btnStartQuickSale = document.querySelector('#btnStartQuickSale');
const btnStopSale = document.querySelector('#btnStopSale');
const btnPresetHoursList = document.querySelectorAll('.btn-preset-hours');
let adminLiveCountdownTimer = null;

const saleCampaignForm = document.querySelector('#saleCampaignForm');
const campaignNameInput = document.querySelector('#campaignName');
const campaignStartDateInput = document.querySelector('#campaignStartDate');
const campaignEndDateInput = document.querySelector('#campaignEndDate');
const campaignDescriptionInput = document.querySelector('#campaignDescription');
const campaignIsActiveInput = document.querySelector('#campaignIsActive');

// Modal Sách
const bookModal = document.querySelector('#bookModal');
const bookModalTitle = document.querySelector('#bookModalTitle');
const bookForm = document.querySelector('#bookForm');
const bookIdInput = document.querySelector('#bookId');
const bookNameInput = document.querySelector('#bookName');
const bookAuthorInput = document.querySelector('#bookAuthor');
const bookCategoryIdInput = document.querySelector('#bookCategoryId');
const bookPriceInput = document.querySelector('#bookPrice');
const bookOnSaleInput = document.querySelector('#bookOnSale');
const bookDiscountPercentInput = document.querySelector('#bookDiscountPercent');
const bookStockInput = document.querySelector('#bookStock');
const bookImportDateInput = document.querySelector('#bookImportDate');
const bookIsNewInput = document.querySelector('#bookIsNew');
const bookImageInput = document.querySelector('#bookImage');
const bookDescriptionInput = document.querySelector('#bookDescription');
const btnOpenAddBookModal = document.querySelector('#btnOpenAddBookModal');
const btnCancelBookModal = document.querySelector('#btnCancelBookModal');

// Khởi tạo Bộ tải ảnh cho Admin
const adminImageUploader = setupImageUploader({
    dropzoneEl: document.querySelector('#bookImageDropzone'),
    fileInputEl: document.querySelector('#bookImageFile'),
    previewContainerEl: document.querySelector('#bookImagePreviewContainer'),
    previewImgEl: document.querySelector('#bookImagePreview'),
    fileNameEl: document.querySelector('#bookImageFileName'),
    fileSizeEl: document.querySelector('#bookImageFileSize'),
    btnChangeEl: document.querySelector('#btnChangeBookImage'),
    btnRemoveEl: document.querySelector('#btnRemoveBookImage'),
    urlInputEl: document.querySelector('#bookImage'),
    toggleUrlBtnEl: document.querySelector('#btnToggleBookImageUrl'),
    urlWrapEl: document.querySelector('#bookImageUrlWrap')
});

// Modal Nhập kho nhanh
const restockModal = document.querySelector('#restockModal');
const restockForm = document.querySelector('#restockForm');
const restockBookId = document.querySelector('#restockBookId');
const restockBookName = document.querySelector('#restockBookName');
const restockCurrentStock = document.querySelector('#restockCurrentStock');
const restockAmount = document.querySelector('#restockAmount');
const btnCancelRestockModal = document.querySelector('#btnCancelRestockModal');

// Modal Chi tiết Đơn hàng
const orderDetailModal = document.querySelector('#orderDetailModal');
const detailOrderCode = document.querySelector('#detailOrderCode');
const detailOrderStatusBadge = document.querySelector('#detailOrderStatusBadge');
const detailReceiverName = document.querySelector('#detailReceiverName');
const detailReceiverPhone = document.querySelector('#detailReceiverPhone');
const detailReceiverAddress = document.querySelector('#detailReceiverAddress');
const detailPaymentMethod = document.querySelector('#detailPaymentMethod');
const detailOrderDate = document.querySelector('#detailOrderDate');
const detailOrderItemsList = document.querySelector('#detailOrderItemsList');
const detailOrderTotal = document.querySelector('#detailOrderTotal');
const btnCloseOrderDetailModal = document.querySelector('#btnCloseOrderDetailModal');

// Modal Thể loại
const categoryModal = document.querySelector('#categoryModal');
const categoryModalTitle = document.querySelector('#categoryModalTitle');
const categoryForm = document.querySelector('#categoryForm');
const categoryIdInput = document.querySelector('#categoryIdInput');
const categoryNameInput = document.querySelector('#categoryNameInput');
const categoryIconInput = document.querySelector('#categoryIconInput');
const btnOpenAddCategoryModal = document.querySelector('#btnOpenAddCategoryModal');
const btnCancelCategoryModal = document.querySelector('#btnCancelCategoryModal');

// Modal Tài khoản & Đối tác
const userModal = document.querySelector('#userModal');
const userModalTitle = document.querySelector('#userModalTitle');
const userForm = document.querySelector('#userForm');
const userIdInput = document.querySelector('#userIdInput');
const userNameInput = document.querySelector('#userNameInput');
const userRoleInput = document.querySelector('#userRoleInput');
const userEmailInput = document.querySelector('#userEmailInput');
const userPasswordInput = document.querySelector('#userPasswordInput');
const userPasswordLabel = document.querySelector('#userPasswordLabel');
const userPhoneInput = document.querySelector('#userPhoneInput');
const userAddressInput = document.querySelector('#userAddressInput');
const sellerFieldsGroup = document.querySelector('#sellerFieldsGroup');
const userShopNameInput = document.querySelector('#userShopNameInput');
const userShopPhoneInput = document.querySelector('#userShopPhoneInput');
const userShopAddressInput = document.querySelector('#userShopAddressInput');
const userIsLockedInput = document.querySelector('#userIsLockedInput');
const btnCancelUserModal = document.querySelector('#btnCancelUserModal');
const btnSaveUser = document.querySelector('#btnSaveUser');

const userDetailModal = document.querySelector('#userDetailModal');
const detailUserCode = document.querySelector('#detailUserCode');
const detailUserStatusBadge = document.querySelector('#detailUserStatusBadge');
const detailUserBody = document.querySelector('#detailUserBody');
const btnCloseUserDetailModal = document.querySelector('#btnCloseUserDetailModal');

// Quản lý Voucher / Mã giảm giá
const couponsTableBody = document.querySelector('#couponsTableBody');
const voucherSummaryBadge = document.querySelector('#voucherSummaryBadge');
const searchCouponInput = document.querySelector('#searchCouponInput');
const filterCouponType = document.querySelector('#filterCouponType');
const filterCouponStatus = document.querySelector('#filterCouponStatus');
const btnOpenAddCouponModal = document.querySelector('#btnOpenAddCouponModal');

const couponModal = document.querySelector('#couponModal');
const couponModalTitle = document.querySelector('#couponModalTitle');
const couponForm = document.querySelector('#couponForm');
const couponIdInput = document.querySelector('#couponIdInput');
const couponCodeInput = document.querySelector('#couponCodeInput');
const btnGenerateCouponCode = document.querySelector('#btnGenerateCouponCode');
const couponTypeInput = document.querySelector('#couponTypeInput');
const couponValueInput = document.querySelector('#couponValueInput');
const couponValueLabel = document.querySelector('#couponValueLabel');
const couponMaxDiscountGroup = document.querySelector('#couponMaxDiscountGroup');
const couponMaxDiscountInput = document.querySelector('#couponMaxDiscountInput');
const couponMinOrderInput = document.querySelector('#couponMinOrderInput');
const couponUsageLimitInput = document.querySelector('#couponUsageLimitInput');
const couponExpiresAtInput = document.querySelector('#couponExpiresAtInput');
const couponDescInput = document.querySelector('#couponDescInput');
const couponActiveInput = document.querySelector('#couponActiveInput');
const btnCancelCouponModal = document.querySelector('#btnCancelCouponModal');
const btnSaveCoupon = document.querySelector('#btnSaveCoupon');

const btnAdminLogout = document.querySelector('#btnAdminLogout');

// 1.1 Tiện ích phân trang dùng chung cho các bảng dữ liệu
/**
 * Gắn sự kiện click / đổi kích thước trang cho một thanh phân trang
 * @param {HTMLElement} container Thẻ chứa thanh phân trang
 * @param {Object} handlers { getPage, setPage, getPageSize, setPageSize, rerender }
 */
function setupPagination(container, handlers) {
    if (!container) return;

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.pagination-btn');
        if (!btn || btn.disabled) return;

        const targetPage = Number(btn.dataset.page);
        if (!Number.isFinite(targetPage) || targetPage < 1) return;

        handlers.setPage(targetPage);
        handlers.rerender();
    });

    container.addEventListener('change', (e) => {
        const select = e.target.closest('.pagination-size-select');
        if (!select) return;

        const newSize = Number(select.value) || DEFAULT_PAGE_SIZE;
        handlers.setPageSize(newSize);
        handlers.setPage(1);
        handlers.rerender();
    });
}

/**
 * Dựng thanh phân trang từ kết quả phân trang
 * @param {HTMLElement} container
 * @param {Object} result Kết quả từ hàm paginate()
 * @param {number} pageSize Số bản ghi / trang đang dùng
 * @param {string} unit Đơn vị hiển thị (vd: "cuốn sách")
 */
function drawPagination(container, result, pageSize, unit) {
    if (!container) return;
    renderPagination(container, {
        page: result.page,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        from: result.from,
        to: result.to,
        unit,
        pageSize,
        sizeOptions: PAGE_SIZE_OPTIONS
    });
}

// 2. Chuyển đổi Tabs & Điều hướng nhanh
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

function switchAdminTab(targetTabId) {
    tabBtns.forEach(b => {
        if (b.dataset.tab === targetTabId) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    tabPanels.forEach(p => {
        if (p.id === targetTabId) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        switchAdminTab(btn.dataset.tab);
    });
});

// 2.1 Điều hướng nhanh từ 4 thẻ Thống kê (Quick Navigation Stat Cards)
const cardStatBooks = document.querySelector('#cardStatBooks');
const cardStatOrders = document.querySelector('#cardStatOrders');
const cardStatRevenue = document.querySelector('#cardStatRevenue');
const cardStatWarning = document.querySelector('#cardStatWarning');

function bindQuickNavCard(cardEl, onTrigger) {
    if (!cardEl) return;
    cardEl.addEventListener('click', onTrigger);
    cardEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTrigger();
        }
    });
}

// Thẻ 1: Đầu sách & Tồn kho -> Mở Tab Kho sách toàn sàn
bindQuickNavCard(cardStatBooks, () => {
    switchAdminTab('tab-books');
    if (filterBookStock) filterBookStock.value = '';
    applyBooksFilter(true);
    document.querySelector('#tab-books')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Thẻ 2: Đơn hàng -> Mở Tab Đơn hàng
bindQuickNavCard(cardStatOrders, () => {
    switchAdminTab('tab-orders');
    document.querySelector('#tab-orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Thẻ 3: Tổng doanh thu -> Mở Tab Thống kê doanh thu
bindQuickNavCard(cardStatRevenue, () => {
    switchAdminTab('tab-revenue');
    renderRevenueDashboard();
    document.querySelector('#tab-revenue')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Thẻ 4: Cảnh báo kho hàng -> Mở Tab Kho sách & Lọc ngay sách sắp hết hoặc hết hàng
bindQuickNavCard(cardStatWarning, () => {
    switchAdminTab('tab-books');
    const outOfStockCount = allBooks.filter(b => Number(b.stock || 0) <= 0).length;
    if (filterBookStock) {
        if (outOfStockCount > 0) {
            filterBookStock.value = 'out_of_stock';
        } else {
            filterBookStock.value = 'low_stock';
        }
    }
    applyBooksFilter(true);
    document.querySelector('#tab-books')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// 3. Đăng xuất Admin
if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn đăng xuất khỏi trang Quản trị?')) {
            authService.logout();
            window.location.href = './login.html';
        }
    });
}

// 4. Cập nhật Thống kê toàn diện (Dashboard Stats)
function updateStats() {
    // A. Sách & Tồn kho
    const totalBooks = allBooks.length;
    const totalStock = allBooks.reduce((sum, b) => sum + Number(b.stock !== undefined ? b.stock : 0), 0);
    const lowStockBooks = allBooks.filter(b => Number(b.stock || 0) > 0 && Number(b.stock || 0) < 10).length;
    const outOfStockBooks = allBooks.filter(b => Number(b.stock || 0) <= 0).length;

    if (statTotalBooks) statTotalBooks.textContent = `${totalBooks} đầu sách`;
    if (statTotalStock) statTotalStock.textContent = `Tổng tồn: ${totalStock.toLocaleString()} cuốn`;
    if (booksTabCount) booksTabCount.textContent = totalBooks;

    // B. Đơn hàng
    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(o => (o.status || '').toLowerCase().includes('chờ') || (o.status || '').toLowerCase().includes('đang')).length;
    if (statTotalOrders) statTotalOrders.textContent = `${totalOrders} đơn`;
    if (statPendingOrders) statPendingOrders.textContent = `Chờ/đang giao: ${pendingOrders} đơn`;
    if (ordersTabCount) ordersTabCount.textContent = totalOrders;

    // C. Doanh thu
    const completedOrders = allOrders.filter(o => 
        (o.status || '').toLowerCase().includes('hoàn thành') || 
        (o.status || '').toLowerCase().includes('đã thanh toán')
    );
    const revenue = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    if (statTotalRevenue) statTotalRevenue.textContent = formatPrice(revenue);
    if (statCompletedRevenue) statCompletedRevenue.textContent = `Từ ${completedOrders.length} đơn hoàn thành`;

    // D. Cảnh báo kho
    if (statLowStock) statLowStock.textContent = `${lowStockBooks + outOfStockBooks} sách cần nhập`;
    if (statOutStock) statOutStock.textContent = `Hết hàng: ${outOfStockBooks} | Sắp hết: ${lowStockBooks}`;

    // E. Thể loại & User
    if (categoriesTabCount) categoriesTabCount.textContent = allCategories.length;
    if (usersTabCount) usersTabCount.textContent = allUsers.length;

    // F. Cập nhật Thống kê doanh thu toàn sàn
    renderRevenueDashboard();
}

// 5. Quản lý Kho sách (Render & Filter)
function renderBooks(books) {
    if (!booksTableBody) return;

    // Lưu lại kết quả lọc hiện tại để thanh phân trang gọi lại được
    filteredBooks = Array.isArray(books) ? books : [];

    const pageData = paginate(filteredBooks, booksPage, booksPageSize);

    if (!filteredBooks || filteredBooks.length === 0) {
        booksTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 32px; color: #94a3b8;">
                    Không tìm thấy cuốn sách nào phù hợp với bộ lọc.
                </td>
            </tr>
        `;
        drawPagination(booksPagination, pageData, booksPageSize, 'cuốn sách');
        return;
    }

    booksTableBody.innerHTML = pageData.items.map(book => {
        const cat = allCategories.find(c => Number(c.id) === Number(book.categoryId));
        const catName = cat ? cat.name : 'Khác';
        const stock = book.stock !== undefined ? Number(book.stock) : 0;
        const sellerName = book.sellerName || 'NXB Trẻ Official';

        let stockBadgeHtml = '';
        if (stock <= 0) {
            stockBadgeHtml = `<span class="badge-stock out-of-stock">⚠️ Hết hàng (0)</span>`;
        } else if (stock < 10) {
            stockBadgeHtml = `<span class="badge-stock low-stock">⚡ Chỉ còn ${stock} cuốn</span>`;
        } else {
            stockBadgeHtml = `<span class="badge-stock in-stock">✓ ${stock} cuốn</span>`;
        }

        const isNewBook = book.isNew === true || (book.importDate && (Date.now() - new Date(book.importDate).getTime()) / (1000 * 60 * 60 * 24) <= 45);
        const importDateFormatted = book.importDate ? new Date(book.importDate).toLocaleDateString('vi-VN') : 'Mới cập nhật';

        return `
            <tr>
                <td><strong>#${book.id}</strong></td>
                <td>
                    <div class="book-cell">
                        <img src="${book.image}" alt="${book.name}" onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80'">
                        <div class="book-cell-info">
                            <strong>${book.name}</strong>
                            <span>Tác giả: ${book.author || 'Chưa rõ'}</span>
                            <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
                                ${isNewBook ? '<span style="background: #e0e7ff; color: #4338ca; font-size: 0.72rem; font-weight: 700; padding: 1px 6px; border-radius: 4px;">✨ Sách mới</span>' : ''}
                                <span style="font-size: 0.74rem; color: #64748b;">📅 Nhập: ${importDateFormatted}</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="seller-badge-admin" title="Nguồn: ${sellerName}">
                        🏪 ${sellerName}
                    </span>
                </td>
                <td><span class="admin-cat-pill">${catName}</span></td>
                <td><strong class="admin-price-text">${formatPrice(book.price)}</strong></td>
                <td>${stockBadgeHtml}</td>
                <td style="text-align: right;">
                    <div class="action-btns" style="justify-content: flex-end;">
                        <button type="button" class="btn-action restock btn-open-restock" data-id="${book.id}" data-name="${book.name}" data-stock="${stock}" title="Nhập thêm hàng vào kho">
                            📥 Nhập kho
                        </button>
                        <button type="button" class="btn-action edit btn-edit-book" data-id="${book.id}" title="Sửa thông tin sách">
                            ✏️ Sửa
                        </button>
                        <button type="button" class="btn-action delete btn-delete-book" data-id="${book.id}" title="Xóa sách">
                            🗑️ Xóa
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    drawPagination(booksPagination, pageData, booksPageSize, 'cuốn sách');
}

// Bộ lọc sách kết hợp (Tìm kiếm + Thể loại + Nhà bán + Tồn kho)
function applyBooksFilter(resetPage = true) {
    const query = (searchBookInput?.value || '').trim().toLowerCase();
    const catId = filterBookCategory?.value;
    const sellerId = filterBookSeller?.value;
    const stockStatus = filterBookStock?.value;

    const filtered = allBooks.filter(book => {
        const matchesQuery = !query || 
            (book.name || '').toLowerCase().includes(query) || 
            (book.author || '').toLowerCase().includes(query) ||
            (book.sellerName || '').toLowerCase().includes(query);

        const matchesCat = !catId || Number(book.categoryId) === Number(catId);
        const matchesSeller = !sellerId || Number(book.sellerId) === Number(sellerId);

        const stock = book.stock !== undefined ? Number(book.stock) : 0;
        let matchesStock = true;
        if (stockStatus === 'in_stock') matchesStock = stock >= 10;
        if (stockStatus === 'low_stock') matchesStock = stock > 0 && stock < 10;
        if (stockStatus === 'out_of_stock') matchesStock = stock <= 0;

        return matchesQuery && matchesCat && matchesSeller && matchesStock;
    });

    // Thay đổi bộ lọc -> luôn quay về trang đầu tiên
    if (resetPage) booksPage = 1;
    renderBooks(filtered);
}

if (searchBookInput) searchBookInput.addEventListener('input', () => applyBooksFilter(true));
if (filterBookCategory) filterBookCategory.addEventListener('change', () => applyBooksFilter(true));
if (filterBookSeller) filterBookSeller.addEventListener('change', () => applyBooksFilter(true));
if (filterBookStock) filterBookStock.addEventListener('change', () => applyBooksFilter(true));

// Xuất danh sách sách ra file Excel (Kho sách toàn sàn)
const btnExportBooksAdmin = document.querySelector('#btnExportBooksAdmin');
if (btnExportBooksAdmin) {
    btnExportBooksAdmin.addEventListener('click', () => {
        const exportList = (filteredBooks && filteredBooks.length > 0) ? filteredBooks : allBooks;
        excelExportUtil.exportAdminBooks(exportList, allCategories);
    });
}

// Phân trang bảng Kho sách
setupPagination(booksPagination, {
    getPage: () => booksPage,
    setPage: (p) => { booksPage = p; },
    getPageSize: () => booksPageSize,
    setPageSize: (s) => { booksPageSize = s; },
    rerender: () => renderBooks(filteredBooks)
});

// Sự kiện trên bảng sách (Sửa, Xóa, Nhập kho)
if (booksTableBody) {
    booksTableBody.addEventListener('click', async (e) => {
        // 1. Nhập thêm hàng (Quick Restock)
        const btnRestock = e.target.closest('.btn-open-restock');
        if (btnRestock) {
            const id = btnRestock.dataset.id;
            const name = btnRestock.dataset.name;
            const stock = btnRestock.dataset.stock;

            restockBookId.value = id;
            restockBookName.textContent = name;
            restockCurrentStock.textContent = stock;
            restockAmount.value = 20;
            restockModal.classList.add('active');
            return;
        }

        // 2. Xóa sách
        const btnDelete = e.target.closest('.btn-delete-book');
        if (btnDelete) {
            const id = btnDelete.dataset.id;
            const book = allBooks.find(b => Number(b.id) === Number(id));
            if (confirm(`Bạn có chắc muốn xóa cuốn sách "${book?.name || id}" khỏi kho?`)) {
                try {
                    await productService.delete(id);
                    allBooks = allBooks.filter(b => Number(b.id) !== Number(id));
                    applyBooksFilter(false);
                    updateStats();
                    alert('✓ Đã xóa sách thành công.');
                } catch (err) {
                    console.error('Lỗi khi xóa sách:', err);
                    alert('Không thể xóa sách khỏi server.');
                }
            }
            return;
        }

        // 3. Sửa sách
        const btnEdit = e.target.closest('.btn-edit-book');
        if (btnEdit) {
            const id = btnEdit.dataset.id;
            const book = allBooks.find(b => Number(b.id) === Number(id));
            if (!book) return;

            bookModalTitle.textContent = `Chỉnh sửa sách: ${book.name}`;
            bookIdInput.value = book.id;
            bookNameInput.value = book.name;
            bookAuthorInput.value = book.author || '';
            if (bookSellerIdInput) bookSellerIdInput.value = book.sellerId || 101;
            bookCategoryIdInput.value = book.categoryId;
            bookPriceInput.value = book.price;
            if (bookOnSaleInput) bookOnSaleInput.checked = book.onSale === true;
            if (bookDiscountPercentInput) bookDiscountPercentInput.value = book.discountPercent !== undefined ? book.discountPercent : 0;
            bookStockInput.value = book.stock !== undefined ? book.stock : 50;
            if (bookImportDateInput) {
                bookImportDateInput.value = book.importDate ? book.importDate.split('T')[0] : new Date().toISOString().split('T')[0];
            }
            if (bookIsNewInput) {
                bookIsNewInput.checked = book.isNew === true || (!book.hasOwnProperty('isNew') && book.importDate && (Date.now() - new Date(book.importDate).getTime()) / (1000 * 60 * 60 * 24) <= 45);
            }
            bookImageInput.value = book.image || '';
            if (adminImageUploader) {
                adminImageUploader.setImage(book.image || '', book.name);
            }
            bookDescriptionInput.value = book.description || '';

            bookModal.classList.add('active');
        }
    });
}

// Xử lý Quick Restock Form
if (restockForm) {
    // Các nút chọn nhanh +10, +20, +50, +100
    document.querySelectorAll('.btn-quick-amount').forEach(btn => {
        btn.addEventListener('click', () => {
            const add = Number(btn.dataset.add);
            restockAmount.value = add;
        });
    });

    if (btnCancelRestockModal) {
        btnCancelRestockModal.addEventListener('click', () => {
            restockModal.classList.remove('active');
        });
    }

    restockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = restockBookId.value;
        const addQuantity = Number(restockAmount.value);

        const book = allBooks.find(b => Number(b.id) === Number(id));
        if (!book) return;

        const newStock = (Number(book.stock) || 0) + addQuantity;

        try {
            await productService.updateStock(id, newStock);
            book.stock = newStock;
            restockModal.classList.remove('active');
            applyBooksFilter(false);
            updateStats();
            alert(`✓ Đã nhập thêm ${addQuantity} cuốn vào kho! Tồn kho hiện tại: ${newStock} cuốn.`);
        } catch (err) {
            console.error('Lỗi khi nhập kho:', err);
            alert('Không thể cập nhật số lượng tồn kho. Vui lòng thử lại!');
        }
    });
}

// Modal Thêm / Sửa sách
if (btnOpenAddBookModal) {
    btnOpenAddBookModal.addEventListener('click', () => {
        bookModalTitle.textContent = '➕ Thêm sách mới vào kho';
        bookForm.reset();
        bookIdInput.value = '';
        if (bookOnSaleInput) bookOnSaleInput.checked = false;
        if (bookDiscountPercentInput) bookDiscountPercentInput.value = 0;
        bookStockInput.value = 50;
        if (bookImportDateInput) {
            bookImportDateInput.value = new Date().toISOString().split('T')[0];
        }
        if (bookIsNewInput) {
            bookIsNewInput.checked = true;
        }
        if (adminImageUploader) adminImageUploader.reset();
        bookModal.classList.add('active');
    });
}

if (btnCancelBookModal) {
    btnCancelBookModal.addEventListener('click', () => {
        if (adminImageUploader) adminImageUploader.reset();
        bookModal.classList.remove('active');
    });
}

if (bookForm) {
    bookForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = bookIdInput.value;
        const selectedSellerId = Number(bookSellerIdInput ? bookSellerIdInput.value : 101);
        const selectedSellerName = (bookSellerIdInput && bookSellerIdInput.selectedOptions[0]) 
            ? bookSellerIdInput.selectedOptions[0].textContent 
            : 'NXB Trẻ Official';

        const imageValue = adminImageUploader 
            ? adminImageUploader.getImageValue() 
            : (bookImageInput ? bookImageInput.value.trim() : '');

        if (!imageValue) {
            alert('⚠️ Vui lòng tải lên tệp ảnh bìa sách hoặc nhập đường dẫn ảnh hợp lệ!');
            return;
        }

        const importDateIso = bookImportDateInput && bookImportDateInput.value 
            ? new Date(bookImportDateInput.value).toISOString() 
            : new Date().toISOString();
        const isNewFlag = bookIsNewInput ? bookIsNewInput.checked : true;

        const bookData = {
            name: bookNameInput.value.trim(),
            author: bookAuthorInput.value.trim(),
            categoryId: Number(bookCategoryIdInput.value),
            sellerId: selectedSellerId,
            sellerName: selectedSellerName,
            price: Number(bookPriceInput.value),
            onSale: bookOnSaleInput ? bookOnSaleInput.checked : false,
            discountPercent: bookDiscountPercentInput ? Math.min(90, Math.max(0, Number(bookDiscountPercentInput.value) || 0)) : 0,
            stock: Number(bookStockInput.value),
            importDate: importDateIso,
            isNew: isNewFlag,
            image: imageValue,
            description: bookDescriptionInput.value.trim()
        };

        try {
            if (id) {
                const updated = await productService.update(id, { id: Number(id), ...bookData });
                const index = allBooks.findIndex(b => Number(b.id) === Number(id));
                if (index > -1) allBooks[index] = updated;
                alert('✓ Đã cập nhật thông tin sách và số lượng tồn kho thành công!');
            } else {
                const created = await productService.create(bookData);
                allBooks.push(created);
                alert('✓ Đã thêm sách mới vào kho thành công!');
            }

            bookModal.classList.remove('active');
            applyBooksFilter(false);
            applySaleBooksFilter(false);
            updateStats();
        } catch (err) {
            console.error('Lỗi khi lưu sách:', err);
            alert('Không thể lưu sách. Vui lòng kiểm tra lại kết nối.');
        }
    });
}

// 6. Quản lý Đơn hàng (Render, Filter & Actions)
function renderOrders(orders) {
    if (!ordersTableBody) return;

    // Lưu lại kết quả lọc hiện tại để thanh phân trang gọi lại được
    filteredOrders = Array.isArray(orders) ? orders : [];

    // Sắp xếp đơn hàng từ mới đến cũ (theo createdAt giảm dần, tie-break theo id giảm dần)
    const sorted = [...filteredOrders].sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
    const pageData = paginate(sorted, ordersPage, ordersPageSize);

    if (!filteredOrders || filteredOrders.length === 0) {
        ordersTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 32px; color: #94a3b8;">
                    Không tìm thấy đơn hàng nào.
                </td>
            </tr>
        `;
        drawPagination(ordersPagination, pageData, ordersPageSize, 'đơn hàng');
        return;
    }

    ordersTableBody.innerHTML = pageData.items.map(order => {
        const items = order.items || [];
        const totalItems = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
        const date = new Date(order.createdAt).toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
        });
        const sellerNames = [...new Set(items.map(it => it.sellerName).filter(Boolean))].join(', ') || 'NXB Trẻ Official';

        const statusOptions = [
            'Chờ xác nhận (COD)',
            'Đã thanh toán (VietQR)',
            'Đang giao hàng',
            'Hoàn thành',
            'Đã hủy'
        ];

        const optionsHtml = statusOptions.map(opt => `
            <option value="${opt}" ${order.status === opt ? 'selected' : ''}>${opt}</option>
        `).join('');

        const isCompleted = order.status === 'Hoàn thành' || (order.status || '').toLowerCase().includes('hoàn thành');
        const actionCompleteHtml = isCompleted 
            ? `<span class="badge-order-complete-done">✓ Hoàn thành</span>`
            : `<button type="button" class="btn-action complete btn-complete-order" data-order-id="${order.id}" data-order-code="${order.orderCode}" title="Xác nhận hoàn thành đơn hàng">✓ Hoàn thành</button>`;

        return `
            <tr>
                <td><strong style="color: #4f46e5;">#${order.orderCode}</strong></td>
                <td><span style="font-size: 0.85rem; color: #64748b;">${date}</span></td>
                <td>
                    <strong>${order.receiverName}</strong>
                    <div style="font-size: 0.8rem; color: #94a3b8;">${order.receiverPhone}</div>
                </td>
                <td>
                    <span class="seller-badge-admin" title="${sellerNames}">
                        🏪 ${sellerNames}
                    </span>
                </td>
                <td><strong>${totalItems}</strong> cuốn</td>
                <td><strong style="color: #dc2626;">${formatPrice(order.totalAmount)}</strong></td>
                <td>
                    <select class="select-status" data-order-id="${order.id}">
                        ${optionsHtml}
                    </select>
                </td>
                <td style="text-align: right;">
                    <div class="action-btns" style="justify-content: flex-end;">
                        <button type="button" class="btn-action view btn-view-order-detail" data-order-id="${order.id}" title="Xem chi tiết đơn hàng">
                            👁️ Chi tiết
                        </button>
                        ${actionCompleteHtml}
                        <button class="btn-action delete btn-delete-order" data-order-id="${order.id}" title="Xóa đơn hàng">
                            🗑️ Xóa
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    drawPagination(ordersPagination, pageData, ordersPageSize, 'đơn hàng');
}

function applyOrdersFilter(resetPage = true) {
    const query = (searchOrderAdminInput?.value || '').trim().toLowerCase();
    const sellerId = filterOrderSellerSelect?.value;
    const status = filterOrderStatusSelect?.value;

    const filtered = allOrders.filter(order => {
        const matchesQuery = !query ||
            (order.orderCode || '').toLowerCase().includes(query) ||
            (order.receiverPhone || '').toLowerCase().includes(query) ||
            (order.receiverName || '').toLowerCase().includes(query);

        const orderSellerIds = (order.items || []).map(it => String(it.sellerId || ''));
        const matchesSeller = !sellerId || orderSellerIds.includes(String(sellerId));

        const matchesStatus = !status || order.status === status;

        return matchesQuery && matchesSeller && matchesStatus;
    });

    // Thay đổi bộ lọc -> luôn quay về trang đầu tiên
    if (resetPage) ordersPage = 1;
    renderOrders(filtered);
}

if (searchOrderAdminInput) searchOrderAdminInput.addEventListener('input', () => applyOrdersFilter(true));
if (filterOrderSellerSelect) filterOrderSellerSelect.addEventListener('change', () => applyOrdersFilter(true));
if (filterOrderStatusSelect) filterOrderStatusSelect.addEventListener('change', () => applyOrdersFilter(true));

// Phân trang bảng Đơn hàng
setupPagination(ordersPagination, {
    getPage: () => ordersPage,
    setPage: (p) => { ordersPage = p; },
    getPageSize: () => ordersPageSize,
    setPageSize: (s) => { ordersPageSize = s; },
    rerender: () => renderOrders(filteredOrders)
});

// Sự kiện Bảng Đơn hàng
if (ordersTableBody) {
    ordersTableBody.addEventListener('change', async (e) => {
        if (e.target.classList.contains('select-status')) {
            const orderId = e.target.dataset.orderId;
            const newStatus = e.target.value;

            try {
                await orderService.updateStatus(orderId, newStatus);
                const order = allOrders.find(o => Number(o.id) === Number(orderId));
                if (order) order.status = newStatus;
                applyOrdersFilter(false);
                updateStats();
                alert(`✓ Đã cập nhật trạng thái đơn hàng #${order?.orderCode} thành: "${newStatus}"`);
            } catch (err) {
                console.error('Lỗi khi cập nhật trạng thái đơn:', err);
                alert('Không thể cập nhật trạng thái đơn hàng.');
            }
        }
    });

    ordersTableBody.addEventListener('click', async (e) => {
        // 1. Xem chi tiết đơn hàng
        const btnView = e.target.closest('.btn-view-order-detail');
        if (btnView) {
            const orderId = btnView.dataset.orderId;
            const order = allOrders.find(o => Number(o.id) === Number(orderId));
            if (!order) return;

            detailOrderCode.textContent = `#${order.orderCode}`;
            detailOrderStatusBadge.textContent = `● ${order.status}`;
            detailReceiverName.textContent = order.receiverName;
            detailReceiverPhone.textContent = order.receiverPhone;
            detailReceiverAddress.textContent = order.receiverAddress;
            detailPaymentMethod.textContent = order.paymentMethod === 'VIETQR' ? 'Chuyển khoản VietQR' : 'Thanh toán khi nhận hàng (COD)';
            detailOrderDate.textContent = new Date(order.createdAt).toLocaleString('vi-VN');
            detailOrderTotal.textContent = formatPrice(order.totalAmount);

            const items = order.items || [];
            detailOrderItemsList.innerHTML = items.map(item => `
                <div class="order-detail-item-row">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${item.image}" style="width: 36px; height: 48px; object-fit: cover; border-radius: 4px;">
                        <div>
                            <div style="font-weight: 700; font-size: 0.9rem;">${item.name}</div>
                            <div style="font-size: 0.8rem; color: #64748b;">
                                Số lượng: x${item.quantity} &bull; Đơn giá: ${formatPrice(item.price)}
                                <span class="seller-badge-admin" style="font-size: 0.72rem; padding: 1px 5px; margin-left: 6px;">🏪 ${item.sellerName || 'NXB Trẻ Official'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="admin-price-text" style="font-weight: 700;">${formatPrice(item.price * item.quantity)}</div>
                </div>
            `).join('');

            orderDetailModal.classList.add('active');
            return;
        }

        // 2. Xác nhận hoàn thành đơn
        const btnComplete = e.target.closest('.btn-complete-order');
        if (btnComplete) {
            const orderId = btnComplete.dataset.orderId;
            const orderCode = btnComplete.dataset.orderCode;

            if (confirm(`Bạn muốn xác nhận HOÀN THÀNH cho đơn hàng #${orderCode}?`)) {
                try {
                    await orderService.updateStatus(orderId, 'Hoàn thành');
                    const order = allOrders.find(o => Number(o.id) === Number(orderId));
                    if (order) order.status = 'Hoàn thành';
                    applyOrdersFilter(false);
                    updateStats();
                    alert(`✓ Đã xác nhận hoàn thành đơn hàng #${orderCode}!`);
                } catch (err) {
                    console.error('Lỗi khi hoàn thành đơn:', err);
                    alert('Không thể cập nhật trạng thái đơn hàng.');
                }
            }
            return;
        }

        // 3. Xóa đơn hàng
        const btnDelete = e.target.closest('.btn-delete-order');
        if (btnDelete) {
            const orderId = btnDelete.dataset.orderId;
            if (confirm(`Bạn có chắc muốn xóa đơn hàng này khỏi hệ thống?`)) {
                try {
                    await orderService.deleteOrder(orderId);
                    allOrders = allOrders.filter(o => Number(o.id) !== Number(orderId));
                    applyOrdersFilter(false);
                    updateStats();
                    alert('✓ Đã xóa đơn hàng thành công!');
                } catch (err) {
                    console.error('Lỗi khi xóa đơn hàng:', err);
                    alert('Không thể xóa đơn hàng.');
                }
            }
        }
    });
}

if (btnCloseOrderDetailModal) {
    btnCloseOrderDetailModal.addEventListener('click', () => {
        orderDetailModal.classList.remove('active');
    });
}

// 7. Quản lý Thể loại sách (Tab Categories)
function renderCategories(categories) {
    if (!categoriesTableBody) return;

    if (!categories || categories.length === 0) {
        categoriesTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8;">
                    Chưa có thể loại nào.
                </td>
            </tr>
        `;
        return;
    }

    categoriesTableBody.innerHTML = categories.map(cat => {
        const countBooks = allBooks.filter(b => Number(b.categoryId) === Number(cat.id)).length;

        return `
            <tr>
                <td><strong>#${cat.id}</strong></td>
                <td><span style="font-size: 1.5rem;">${cat.icon || '📖'}</span></td>
                <td><strong>${cat.name}</strong></td>
                <td><span style="font-weight: 700; color: #4f46e5;">${countBooks}</span> tựa sách</td>
                <td style="text-align: right;">
                    <div class="action-btns" style="justify-content: flex-end;">
                        <button type="button" class="btn-action edit btn-edit-category" data-id="${cat.id}" data-name="${cat.name}" data-icon="${cat.icon || '📖'}" title="Sửa thể loại">
                            ✏️ Sửa
                        </button>
                        <button type="button" class="btn-action delete btn-delete-category" data-id="${cat.id}" data-name="${cat.name}" data-count="${countBooks}" title="Xóa thể loại">
                            🗑️ Xóa
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

if (searchCategoryInput) {
    searchCategoryInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        const filtered = allCategories.filter(c => (c.name || '').toLowerCase().includes(query));
        renderCategories(filtered);
    });
}

if (btnOpenAddCategoryModal) {
    btnOpenAddCategoryModal.addEventListener('click', () => {
        categoryModalTitle.textContent = '➕ Thêm thể loại mới';
        categoryForm.reset();
        categoryIdInput.value = '';
        categoryModal.classList.add('active');
    });
}

if (btnCancelCategoryModal) {
    btnCancelCategoryModal.addEventListener('click', () => {
        categoryModal.classList.remove('active');
    });
}

if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = categoryIdInput.value;
        const catData = {
            name: categoryNameInput.value.trim(),
            icon: categoryIconInput.value.trim() || '📖'
        };

        try {
            if (id) {
                const updated = await categoryService.update(id, { id: Number(id), ...catData });
                const index = allCategories.findIndex(c => Number(c.id) === Number(id));
                if (index > -1) allCategories[index] = updated;
                alert('✓ Đã cập nhật thể loại thành công!');
            } else {
                const created = await categoryService.create(catData);
                allCategories.push(created);
                alert('✓ Đã thêm thể loại mới thành công!');
            }

            categoryModal.classList.remove('active');
            renderCategories(allCategories);
            updateCategoriesSelect();
            updateStats();
        } catch (err) {
            console.error('Lỗi khi lưu thể loại:', err);
            alert('Không thể lưu thể loại. Vui lòng kiểm tra lại!');
        }
    });
}

if (categoriesTableBody) {
    categoriesTableBody.addEventListener('click', async (e) => {
        // Sửa thể loại
        const btnEdit = e.target.closest('.btn-edit-category');
        if (btnEdit) {
            categoryIdInput.value = btnEdit.dataset.id;
            categoryNameInput.value = btnEdit.dataset.name;
            categoryIconInput.value = btnEdit.dataset.icon;
            categoryModalTitle.textContent = `Chỉnh sửa thể loại: ${btnEdit.dataset.name}`;
            categoryModal.classList.add('active');
            return;
        }

        // Xóa thể loại
        const btnDelete = e.target.closest('.btn-delete-category');
        if (btnDelete) {
            const id = btnDelete.dataset.id;
            const name = btnDelete.dataset.name;
            const count = Number(btnDelete.dataset.count);

            if (count > 0) {
                alert(`⚠️ Không thể xóa thể loại "${name}" vì hiện đang có ${count} cuốn sách thuộc thể loại này!`);
                return;
            }

            if (confirm(`Bạn có chắc muốn xóa thể loại "${name}"?`)) {
                try {
                    await categoryService.delete(id);
                    allCategories = allCategories.filter(c => Number(c.id) !== Number(id));
                    renderCategories(allCategories);
                    updateCategoriesSelect();
                    updateStats();
                    alert('✓ Đã xóa thể loại thành công!');
                } catch (err) {
                    console.error('Lỗi khi xóa thể loại:', err);
                    alert('Không thể xóa thể loại.');
                }
            }
        }
    });
}

// 8. Quản lý Người dùng & Đối tác (Tab Users)
function isUserLocked(user) {
    if (!user) return false;
    return user.isLocked === true || user.status === 'locked' || (user.role === 'seller' && user.shopStatus === 'locked');
}

function getUserOrders(user) {
    const emailLower = (user.email || '').trim().toLowerCase();
    return allOrders.filter(o =>
        (o.userId && Number(o.userId) === Number(user.id)) ||
        (emailLower && o.userEmail && o.userEmail.trim().toLowerCase() === emailLower)
    );
}

function getSellerStats(sellerUser) {
    const sellerId = Number(sellerUser.id);
    const books = allBooks.filter(b => Number(b.sellerId) === sellerId);
    const totalStock = books.reduce((sum, b) => sum + (Number(b.stock) || 0), 0);

    let orderCount = 0;
    let completedRevenue = 0;

    allOrders.forEach(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        const matchedItems = items.filter(it => Number(it.sellerId) === sellerId);
        if (matchedItems.length > 0) {
            orderCount++;
            const st = (order.status || '').toLowerCase();
            if (st.includes('hoàn thành') || st.includes('đã thanh toán')) {
                matchedItems.forEach(it => {
                    completedRevenue += (Number(it.price) || 0) * (Number(it.quantity) || 1);
                });
            }
        }
    });

    return { books, totalStock, orderCount, completedRevenue };
}

function renderUsers(users) {
    if (!usersTableBody) return;

    filteredUsers = Array.isArray(users) ? users : [];
    const pageData = paginate(filteredUsers, usersPage, usersPageSize);

    if (!filteredUsers || filteredUsers.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 28px; color: #94a3b8;">
                    Không tìm thấy tài khoản hoặc đối tác nào phù hợp.
                </td>
            </tr>
        `;
        drawPagination(usersPagination, pageData, usersPageSize, 'tài khoản');
        return;
    }

    usersTableBody.innerHTML = pageData.items.map(user => {
        const locked = isUserLocked(user);
        const isSelf = currentUser && String(user.id) === String(currentUser.id);
        const userOrders = getUserOrders(user);
        const displayName = escapeHtml(user.name || 'Chưa đặt tên');
        const displayEmail = escapeHtml(user.email || '');
        const contactPhone = escapeHtml(user.shopPhone || user.phone || '');
        const shopAddress = escapeHtml(user.shopAddress || user.address || '');

        const roleBadge = user.role === 'admin'
            ? `<span style="background: #fee2e2; color: #dc2626; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 0.78rem;">👑 Quản trị viên</span>`
            : user.role === 'seller'
            ? `<span class="seller-role-badge">🏪 Đối tác Nhà bán</span>`
            : `<span style="background: #e0f2fe; color: #0284c7; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.78rem;">👤 Khách hàng</span>`;

        const statusBadge = locked
            ? `<span class="user-status-badge locked">🔒 Đã khóa</span>`
            : `<span class="user-status-badge active">🟢 Hoạt động</span>`;

        let activityHtml = `<strong style="color: #4f46e5;">${userOrders.length}</strong> đơn đã đặt`;
        if (user.role === 'seller') {
            const st = getSellerStats(user);
            activityHtml = `
                <div style="font-size: 0.84rem; line-height: 1.45;">
                    <div>📚 <strong style="color: #4f46e5;">${st.books.length}</strong> đầu sách (tồn ${st.totalStock})</div>
                    <div style="color: #059669; font-weight: 700;">💰 ${formatPrice(st.completedRevenue)}</div>
                </div>
            `;
        }

        const sellerSubInfo = user.role === 'seller'
            ? `<div style="font-size: 0.8rem; color: #4f46e5; font-weight: 600; margin-top: 2px;">🏪 ${escapeHtml(user.shopName || user.name || '')}</div>`
            : '';

        return `
            <tr style="${locked ? 'opacity: 0.72;' : ''}">
                <td><strong>#${user.id}</strong></td>
                <td>
                    <strong>${displayName}</strong>${isSelf ? ' <span style="font-size:0.72rem; color:#059669; font-weight:700;">(Bạn)</span>' : ''}
                    ${sellerSubInfo}
                    ${shopAddress ? `<div style="font-size: 0.76rem; color: #94a3b8; margin-top: 2px;">📍 ${shopAddress}</div>` : ''}
                </td>
                <td>
                    <div style="color: #475569; font-size: 0.88rem;">${displayEmail}</div>
                    ${contactPhone ? `<div style="color: #64748b; font-size: 0.78rem; margin-top: 2px;">📞 ${contactPhone}</div>` : ''}
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 5px;">
                        ${roleBadge}
                        ${statusBadge}
                    </div>
                </td>
                <td>${activityHtml}</td>
                <td style="text-align: center;">
                    <div style="display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: center;">
                        <button type="button" class="btn-action view btn-view-user" data-id="${user.id}" title="Xem hồ sơ chi tiết">👁️</button>
                        <button type="button" class="btn-action edit btn-edit-user" data-id="${user.id}" title="Chỉnh sửa / Phân quyền">✏️</button>
                        <button
                            type="button"
                            class="btn-action ${locked ? 'unlock' : 'lock'} btn-toggle-lock-user"
                            data-id="${user.id}"
                            title="${isSelf ? 'Không thể tự khóa tài khoản của chính bạn' : (locked ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản')}"
                            ${isSelf ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}
                        >${locked ? '🔓' : '🔒'}</button>
                        <button
                            type="button"
                            class="btn-action delete btn-delete-user"
                            data-id="${user.id}"
                            title="${isSelf ? 'Không thể tự xóa tài khoản đang đăng nhập' : 'Xóa tài khoản'}"
                            ${isSelf ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}
                        >🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    drawPagination(usersPagination, pageData, usersPageSize, 'tài khoản');
}

function applyUsersFilter(resetPage = true) {
    const query = searchUserInput ? searchUserInput.value.trim().toLowerCase() : '';
    const roleFilter = filterUserRole ? filterUserRole.value : '';
    const statusFilter = filterUserStatus ? filterUserStatus.value : '';

    const filtered = allUsers.filter(u => {
        const matchQuery = !query ||
            (u.name || '').toLowerCase().includes(query) ||
            (u.email || '').toLowerCase().includes(query) ||
            (u.shopName || '').toLowerCase().includes(query) ||
            (u.phone || '').toLowerCase().includes(query) ||
            (u.shopPhone || '').toLowerCase().includes(query);

        const matchRole = !roleFilter || u.role === roleFilter;
        const locked = isUserLocked(u);
        const matchStatus = !statusFilter ||
            (statusFilter === 'locked' && locked) ||
            (statusFilter === 'active' && !locked);

        return matchQuery && matchRole && matchStatus;
    });

    if (resetPage) usersPage = 1;
    renderUsers(filtered);
}

if (searchUserInput) searchUserInput.addEventListener('input', () => applyUsersFilter(true));
if (filterUserRole) filterUserRole.addEventListener('change', () => applyUsersFilter(true));
if (filterUserStatus) filterUserStatus.addEventListener('change', () => applyUsersFilter(true));

// Phân trang bảng Người dùng
setupPagination(usersPagination, {
    getPage: () => usersPage,
    setPage: (p) => { usersPage = p; },
    getPageSize: () => usersPageSize,
    setPageSize: (s) => { usersPageSize = s; },
    rerender: () => renderUsers(filteredUsers)
});

function toggleSellerFieldsVisibility() {
    if (!sellerFieldsGroup || !userRoleInput) return;
    const isSeller = userRoleInput.value === 'seller';
    sellerFieldsGroup.style.display = isSeller ? 'block' : 'none';
    if (userShopNameInput) userShopNameInput.required = isSeller;
}

if (userRoleInput) {
    userRoleInput.addEventListener('change', toggleSellerFieldsVisibility);
}

function openUserModal(user = null) {
    if (!userModal || !userForm) return;
    userForm.reset();

    if (user) {
        const isSelf = currentUser && String(user.id) === String(currentUser.id);
        if (userModalTitle) userModalTitle.textContent = `✏️ Chỉnh sửa tài khoản #${user.id}`;
        if (userIdInput) userIdInput.value = user.id;
        if (userNameInput) userNameInput.value = user.name || '';
        if (userRoleInput) {
            userRoleInput.value = user.role || 'customer';
            userRoleInput.disabled = isSelf;
        }
        if (userEmailInput) userEmailInput.value = user.email || '';
        if (userPasswordInput) {
            userPasswordInput.value = '';
            userPasswordInput.required = false;
            userPasswordInput.placeholder = 'Để trống nếu giữ mật khẩu hiện tại';
        }
        if (userPasswordLabel) userPasswordLabel.textContent = 'Mật khẩu mới (tùy chọn)';
        if (userPhoneInput) userPhoneInput.value = user.phone || '';
        if (userAddressInput) userAddressInput.value = user.address || '';
        if (userShopNameInput) userShopNameInput.value = user.shopName || '';
        if (userShopPhoneInput) userShopPhoneInput.value = user.shopPhone || '';
        if (userShopAddressInput) userShopAddressInput.value = user.shopAddress || '';
        if (userIsLockedInput) {
            userIsLockedInput.checked = isUserLocked(user);
            userIsLockedInput.disabled = isSelf;
        }
        if (btnSaveUser) btnSaveUser.textContent = 'Lưu thay đổi';
    } else {
        if (userModalTitle) userModalTitle.textContent = '➕ Thêm Tài khoản / Đối tác mới';
        if (userIdInput) userIdInput.value = '';
        if (userRoleInput) {
            userRoleInput.value = 'customer';
            userRoleInput.disabled = false;
        }
        if (userPasswordInput) {
            userPasswordInput.value = '';
            userPasswordInput.required = true;
            userPasswordInput.placeholder = 'Tối thiểu 6 ký tự';
        }
        if (userPasswordLabel) userPasswordLabel.textContent = 'Mật khẩu *';
        if (userIsLockedInput) {
            userIsLockedInput.checked = false;
            userIsLockedInput.disabled = false;
        }
        if (btnSaveUser) btnSaveUser.textContent = 'Tạo tài khoản';
    }

    toggleSellerFieldsVisibility();
    userModal.classList.add('active');
}

function closeUserModal() {
    if (userModal) userModal.classList.remove('active');
}

if (btnOpenAddUserModal) {
    btnOpenAddUserModal.addEventListener('click', () => openUserModal(null));
}
if (btnCancelUserModal) {
    btnCancelUserModal.addEventListener('click', closeUserModal);
}
if (userModal) {
    userModal.addEventListener('click', (e) => {
        if (e.target === userModal) closeUserModal();
    });
}

if (userForm) {
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editingId = userIdInput ? userIdInput.value.trim() : '';
        const name = userNameInput ? userNameInput.value.trim() : '';
        const role = userRoleInput ? userRoleInput.value : 'customer';
        const email = userEmailInput ? userEmailInput.value.trim().toLowerCase() : '';
        const password = userPasswordInput ? userPasswordInput.value : '';
        const phone = userPhoneInput ? userPhoneInput.value.trim() : '';
        const address = userAddressInput ? userAddressInput.value.trim() : '';
        const locked = userIsLockedInput ? userIsLockedInput.checked : false;

        if (!name || !email) {
            alert('Vui lòng nhập đầy đủ Họ tên và Email.');
            return;
        }

        if (!editingId && (!password || password.length < 6)) {
            alert('Mật khẩu cho tài khoản mới phải có ít nhất 6 ký tự.');
            return;
        }

        if (editingId && password && password.length < 6) {
            alert('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }

        const payload = {
            name,
            email,
            role,
            phone,
            address,
            isLocked: locked
        };

        if (password) {
            payload.password = password;
        }

        if (role === 'seller') {
            const shopName = userShopNameInput ? userShopNameInput.value.trim() : '';
            if (!shopName) {
                alert('Vui lòng nhập Tên gian hàng cho tài khoản Nhà bán / Đối tác.');
                return;
            }
            payload.shopName = shopName;
            payload.shopPhone = userShopPhoneInput ? userShopPhoneInput.value.trim() : '';
            payload.shopAddress = userShopAddressInput ? userShopAddressInput.value.trim() : '';
            payload.shopStatus = locked ? 'locked' : 'active';
        }

        if (btnSaveUser) {
            btnSaveUser.disabled = true;
            btnSaveUser.textContent = 'Đang lưu...';
        }

        try {
            if (editingId) {
                await authService.adminUpdateUser(editingId, payload);
                alert('✓ Đã cập nhật thông tin tài khoản thành công!');
            } else {
                await authService.createUser(payload);
                alert('🎉 Đã tạo tài khoản / đối tác mới thành công!');
            }

            allUsers = await authService.getAllUsers();
            updateSellersSelect();
            applyUsersFilter(false);
            updateStats();
            closeUserModal();
        } catch (err) {
            console.error('Lỗi khi lưu tài khoản:', err);
            alert(err.message || 'Không thể lưu thông tin tài khoản. Vui lòng thử lại!');
        } finally {
            if (btnSaveUser) {
                btnSaveUser.disabled = false;
                btnSaveUser.textContent = editingId ? 'Lưu thay đổi' : 'Tạo tài khoản';
            }
        }
    });
}

function openUserDetailModal(user) {
    if (!userDetailModal || !detailUserBody || !user) return;
    const locked = isUserLocked(user);

    if (detailUserCode) detailUserCode.textContent = `#${user.id}`;
    if (detailUserStatusBadge) {
        detailUserStatusBadge.innerHTML = locked
            ? '<span class="user-status-badge locked">🔒 Đang bị khóa</span>'
            : '<span class="user-status-badge active">🟢 Đang hoạt động</span>';
    }

    const roleText = user.role === 'admin' ? '👑 Quản trị viên' : (user.role === 'seller' ? '🏪 Đối tác Nhà bán' : '👤 Khách hàng');
    const orders = getUserOrders(user);
    const totalSpent = orders
        .filter(o => (o.status || '').toLowerCase().includes('hoàn thành') || (o.status || '').toLowerCase().includes('đã thanh toán'))
        .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    let sellerBlock = '';
    let listBlock = '';

    if (user.role === 'seller') {
        const st = getSellerStats(user);
        sellerBlock = `
            <div class="user-detail-card">
                <h4>🏪 Thông tin Gian hàng Đối tác</h4>
                <p><strong>Tên Shop:</strong> ${escapeHtml(user.shopName || user.name || '---')}</p>
                <p><strong>Hotline Shop:</strong> ${escapeHtml(user.shopPhone || user.phone || 'Chưa cập nhật')}</p>
                <p><strong>Địa chỉ kho:</strong> ${escapeHtml(user.shopAddress || user.address || 'Chưa cập nhật')}</p>
                <p><strong>Đầu sách đang bán:</strong> ${st.books.length} cuốn (Tồn kho: ${st.totalStock})</p>
                <p><strong>Doanh thu hoàn thành:</strong> <strong style="color: #059669;">${formatPrice(st.completedRevenue)}</strong> (${st.orderCount} đơn)</p>
            </div>
        `;

        listBlock = `
            <h4 style="font-size: 0.95rem; margin: 14px 0 8px; font-weight: 700;">📚 Sách của gian hàng (${st.books.length})</h4>
            <div class="user-detail-list">
                ${st.books.length > 0 ? st.books.slice(0, 20).map(b => `
                    <div class="user-detail-list-item">
                        <div>
                            <strong>${escapeHtml(b.name)}</strong>
                            <div style="font-size: 0.78rem; color: #64748b;">Tồn: ${b.stock ?? 0} &bull; Đã bán: ${b.soldCount ?? 0}</div>
                        </div>
                        <strong style="color: #4f46e5;">${formatPrice(b.price)}</strong>
                    </div>
                `).join('') : '<div style="padding: 16px; text-align: center; color: #94a3b8;">Gian hàng này chưa đăng bán cuốn sách nào.</div>'}
            </div>
        `;
    } else {
        sellerBlock = `
            <div class="user-detail-card">
                <h4>📊 Thống kê mua hàng</h4>
                <p><strong>Tổng đơn đã đặt:</strong> ${orders.length} đơn</p>
                <p><strong>Tổng chi tiêu (hoàn thành):</strong> <strong style="color: #059669;">${formatPrice(totalSpent)}</strong></p>
                <p><strong>Giới tính / Ngày sinh:</strong> ${escapeHtml(user.gender || '---')} / ${escapeHtml(user.dob || '---')}</p>
            </div>
        `;

        listBlock = `
            <h4 style="font-size: 0.95rem; margin: 14px 0 8px; font-weight: 700;">📦 Lịch sử đơn hàng (${orders.length})</h4>
            <div class="user-detail-list">
                ${orders.length > 0 ? [...orders].reverse().slice(0, 15).map(o => `
                    <div class="user-detail-list-item">
                        <div>
                            <strong>#${escapeHtml(o.orderCode || String(o.id))}</strong>
                            <div style="font-size: 0.78rem; color: #64748b;">${formatDateTimeVn(o.createdAt)} &bull; ${escapeHtml(o.status || 'Chờ xác nhận')}</div>
                        </div>
                        <strong style="color: #dc2626;">${formatPrice(o.totalAmount)}</strong>
                    </div>
                `).join('') : '<div style="padding: 16px; text-align: center; color: #94a3b8;">Người dùng này chưa có đơn hàng nào.</div>'}
            </div>
        `;
    }

    detailUserBody.innerHTML = `
        <div class="user-detail-grid">
            <div class="user-detail-card">
                <h4>👤 Hồ sơ cá nhân</h4>
                <p><strong>Họ tên:</strong> ${escapeHtml(user.name || '---')}</p>
                <p><strong>Email:</strong> ${escapeHtml(user.email || '---')}</p>
                <p><strong>Vai trò:</strong> ${roleText}</p>
                <p><strong>Điện thoại:</strong> ${escapeHtml(user.phone || 'Chưa cập nhật')}</p>
                <p><strong>Địa chỉ:</strong> ${escapeHtml(user.address || 'Chưa cập nhật')}</p>
            </div>
            ${sellerBlock}
        </div>
        ${listBlock}
    `;

    userDetailModal.classList.add('active');
}

function closeUserDetailModal() {
    if (userDetailModal) userDetailModal.classList.remove('active');
}

if (btnCloseUserDetailModal) btnCloseUserDetailModal.addEventListener('click', closeUserDetailModal);
if (userDetailModal) {
    userDetailModal.addEventListener('click', (e) => {
        if (e.target === userDetailModal) closeUserDetailModal();
    });
}

if (usersTableBody) {
    usersTableBody.addEventListener('click', async (e) => {
        const viewBtn = e.target.closest('.btn-view-user');
        if (viewBtn) {
            const id = viewBtn.dataset.id;
            const user = allUsers.find(u => String(u.id) === String(id));
            if (user) openUserDetailModal(user);
            return;
        }

        const editBtn = e.target.closest('.btn-edit-user');
        if (editBtn) {
            const id = editBtn.dataset.id;
            const user = allUsers.find(u => String(u.id) === String(id));
            if (user) openUserModal(user);
            return;
        }

        const lockBtn = e.target.closest('.btn-toggle-lock-user');
        if (lockBtn) {
            const id = lockBtn.dataset.id;
            const user = allUsers.find(u => String(u.id) === String(id));
            if (!user) return;
            if (currentUser && String(user.id) === String(currentUser.id)) {
                alert('⚠️ Bạn không thể tự khóa tài khoản đang đăng nhập!');
                return;
            }
            const nextLocked = !isUserLocked(user);
            const actionLabel = nextLocked ? 'tạm khóa' : 'mở khóa';
            if (!confirm(`Bạn có chắc muốn ${actionLabel} tài khoản "${user.name || user.email}"?`)) return;

            try {
                const patch = { isLocked: nextLocked };
                if (user.role === 'seller') {
                    patch.shopStatus = nextLocked ? 'locked' : 'active';
                }
                await authService.adminUpdateUser(user.id, patch);
                allUsers = await authService.getAllUsers();
                updateSellersSelect();
                applyUsersFilter(false);
                alert(`✓ Đã ${actionLabel} tài khoản thành công!`);
            } catch (err) {
                console.error('Lỗi khóa/mở khóa tài khoản:', err);
                alert('Không thể thay đổi trạng thái tài khoản.');
            }
            return;
        }

        const deleteBtn = e.target.closest('.btn-delete-user');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const user = allUsers.find(u => String(u.id) === String(id));
            if (!user) return;
            if (currentUser && String(user.id) === String(currentUser.id)) {
                alert('⚠️ Bạn không thể tự xóa tài khoản Quản trị viên đang đăng nhập!');
                return;
            }

            let warningMsg = `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${user.name || user.email}" (#${user.id})?`;
            if (user.role === 'seller') {
                const st = getSellerStats(user);
                if (st.books.length > 0) {
                    warningMsg += `\n\n⚠️ Đối tác này đang có ${st.books.length} đầu sách trên sàn (các sách sẽ vẫn giữ trong kho với sellerId cũ).`;
                }
            }
            if (!confirm(warningMsg)) return;

            try {
                await authService.deleteUser(user.id);
                allUsers = allUsers.filter(u => String(u.id) !== String(user.id));
                updateSellersSelect();
                applyUsersFilter(false);
                updateStats();
                alert('✓ Đã xóa tài khoản khỏi hệ thống!');
            } catch (err) {
                console.error('Lỗi khi xóa tài khoản:', err);
                alert('Không thể xóa tài khoản này. Vui lòng thử lại!');
            }
        }
    });
}

// Cập nhật các select box thể loại
function updateCategoriesSelect() {
    if (bookCategoryIdInput) {
        bookCategoryIdInput.innerHTML = allCategories.map(cat => `
            <option value="${cat.id}">${cat.icon || '📖'} ${cat.name}</option>
        `).join('');
    }

    if (filterBookCategory) {
        filterBookCategory.innerHTML = `
            <option value="">-- Tất cả thể loại --</option>
            ${allCategories.map(cat => `<option value="${cat.id}">${cat.icon || '📖'} ${cat.name}</option>`).join('')}
        `;
    }
}

// Cập nhật các select box Nhà bán hàng / Nguồn sách
function updateSellersSelect() {
    const sellerMap = new Map();
    allUsers.filter(u => u.role === 'seller').forEach(u => {
        sellerMap.set(Number(u.id), u.shopName || u.name);
    });
    allBooks.forEach(b => {
        if (b.sellerId && b.sellerName && !sellerMap.has(Number(b.sellerId))) {
            sellerMap.set(Number(b.sellerId), b.sellerName);
        }
    });

    const sellerOptions = Array.from(sellerMap.entries()).map(([id, name]) => `
        <option value="${id}">${name}</option>
    `).join('');

    if (filterBookSeller) {
        filterBookSeller.innerHTML = `
            <option value="">-- Tất cả nguồn sách / Nhà bán --</option>
            ${sellerOptions}
        `;
    }

    if (filterOrderSellerSelect) {
        filterOrderSellerSelect.innerHTML = `
            <option value="">-- Tất cả nhà bán --</option>
            ${sellerOptions}
        `;
    }

    if (bookSellerIdInput) {
        bookSellerIdInput.innerHTML = sellerOptions || `
            <option value="101">NXB Trẻ Official</option>
            <option value="102">Nhã Nam Books</option>
            <option value="103">Tiệm Sách Tri Thức</option>
        `;
    }
}

function toLocalYmd(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatCompactVnd(amount) {
    const num = Number(amount || 0);
    if (num >= 1000000) return `${(num / 1000000).toFixed(2).replace(/\.?0+$/, '')}tr`;
    if (num >= 1000) return `${Math.round(num / 1000)}k`;
    return `${num}₫`;
}

function filterOrdersByRevenuePeriod(orders) {
    const now = new Date();
    const todayYmd = toLocalYmd(now);

    if (revenuePeriodFilter === 'today') {
        return {
            periodLabel: `Hôm nay (${now.toLocaleDateString('vi-VN')})`,
            orders: orders.filter(o => toLocalYmd(o.createdAt) === todayYmd)
        };
    }

    if (revenuePeriodFilter === '7d') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 6);
        return {
            periodLabel: '7 ngày gần nhất',
            orders: orders.filter(o => {
                const d = new Date(o.createdAt);
                return !isNaN(d.getTime()) && d >= start && d <= now;
            })
        };
    }

    if (revenuePeriodFilter === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return {
            periodLabel: `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
            orders: orders.filter(o => {
                const d = new Date(o.createdAt);
                return !isNaN(d.getTime()) && d >= monthStart && d <= now;
            })
        };
    }

    if (revenuePeriodFilter === 'custom' && (revenueDateFrom || revenueDateTo)) {
        const labelFrom = revenueDateFrom || '...';
        const labelTo = revenueDateTo || '...';
        return {
            periodLabel: `Từ ${labelFrom} đến ${labelTo}`,
            orders: orders.filter(o => {
                const ymd = toLocalYmd(o.createdAt);
                if (!ymd) return false;
                if (revenueDateFrom && ymd < revenueDateFrom) return false;
                if (revenueDateTo && ymd > revenueDateTo) return false;
                return true;
            })
        };
    }

    return {
        periodLabel: 'Tất cả thời gian',
        orders
    };
}

// Bảng điều khiển Thống kê Doanh thu toàn sàn (Tab 3 chuyên sâu)
function renderRevenueDashboard() {
    const revTotalGmv = document.querySelector('#revTotalGmv');
    const revAvgOrderValue = document.querySelector('#revAvgOrderValue');
    const revSuccessOrders = document.querySelector('#revSuccessOrders');
    const revSuccessRate = document.querySelector('#revSuccessRate');
    const revTotalBooksSold = document.querySelector('#revTotalBooksSold');
    const revItemsSubtotalSub = document.querySelector('#revItemsSubtotalSub');
    const revActiveSellers = document.querySelector('#revActiveSellers');

    const revAccSubtotal = document.querySelector('#revAccSubtotal');
    const revAccShipping = document.querySelector('#revAccShipping');
    const revAccDiscount = document.querySelector('#revAccDiscount');
    const revAccCancelled = document.querySelector('#revAccCancelled');

    const revChartSubtitle = document.querySelector('#revChartSubtitle');
    const revenueDailyChart = document.querySelector('#revenueDailyChart');
    const sellerRevenueTableBody = document.querySelector('#sellerRevenueTableBody');
    const categoryRevenueTableBody = document.querySelector('#categoryRevenueTableBody');
    const topBooksRevenueTableBody = document.querySelector('#topBooksRevenueTableBody');
    const paymentMethodStatsWrap = document.querySelector('#paymentMethodStatsWrap');

    const { periodLabel, orders: periodOrders } = filterOrdersByRevenuePeriod(allOrders);

    const cancelledOrders = periodOrders.filter(o => (o.status || '').toLowerCase().includes('hủy'));
    const completedOrders = periodOrders.filter(o => {
        const st = (o.status || '').toLowerCase();
        if (st.includes('hủy')) return false;
        return st.includes('hoàn thành') || st.includes('đã thanh toán');
    });

    const totalGmv = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalShipping = completedOrders.reduce((sum, o) => sum + Number(o.shippingFee || 0), 0);
    const totalDiscount = completedOrders.reduce((sum, o) => sum + Number(o.discountAmount || 0), 0);
    const totalOrdersCount = periodOrders.length;
    const successCount = completedOrders.length;
    const cancelledCount = cancelledOrders.length;
    const successRate = totalOrdersCount > 0 ? Math.round((successCount / totalOrdersCount) * 100) : 0;
    const avgOrderValue = successCount > 0 ? Math.round(totalGmv / successCount) : 0;

    let totalBooksSold = 0;
    let totalItemsRevenue = 0;
    completedOrders.forEach(o => {
        (o.items || []).forEach(it => {
            const qty = Number(it.quantity || 1);
            const pr = Number(it.price || 0);
            totalBooksSold += qty;
            totalItemsRevenue += pr * qty;
        });
    });

    if (revTotalGmv) revTotalGmv.textContent = formatPrice(totalGmv);
    if (revAvgOrderValue) revAvgOrderValue.textContent = `TB mỗi đơn: ${formatPrice(avgOrderValue)}`;
    if (revSuccessOrders) revSuccessOrders.textContent = `${successCount} / ${totalOrdersCount} đơn`;
    if (revSuccessRate) revSuccessRate.textContent = totalOrdersCount > 0 ? `Tỷ lệ thành công: ${successRate}%` : 'Chưa có đơn trong kỳ';
    if (revTotalBooksSold) revTotalBooksSold.textContent = `${totalBooksSold.toLocaleString()} cuốn`;
    if (revItemsSubtotalSub) revItemsSubtotalSub.textContent = `Tiền hàng: ${formatPrice(totalItemsRevenue)}`;

    if (revAccSubtotal) revAccSubtotal.textContent = formatPrice(totalItemsRevenue);
    if (revAccShipping) revAccShipping.textContent = formatPrice(totalShipping);
    if (revAccDiscount) revAccDiscount.textContent = `-${formatPrice(totalDiscount)}`;
    if (revAccCancelled) revAccCancelled.textContent = `${cancelledCount} đơn`;

    // Tạo map tra cứu nhanh sách & thể loại để tránh dồn sai Seller khi order.items thiếu metadata
    const bookByIdMap = new Map(allBooks.map(b => [String(b.id), b]));

    const resolveSellerInfo = (bookOrItem) => {
        const rawSellerId = bookOrItem?.sellerId;
        const rawSellerName = (bookOrItem?.sellerName || '').trim();
        if (rawSellerId !== undefined && rawSellerId !== null && String(rawSellerId).trim() !== '') {
            const key = String(rawSellerId).trim();
            return {
                key,
                name: rawSellerName || `Nhà bán #${key}`
            };
        }
        return {
            key: 'official',
            name: rawSellerName || 'Trí Tuệ Book Official'
        };
    };

    // 1. Phân bổ doanh thu theo Nhà bán hàng (đối chiếu ngược từ allBooks theo it.id)
    const sellerStatsMap = new Map();
    const ensureSellerEntry = (key, name) => {
        if (!sellerStatsMap.has(key)) {
            sellerStatsMap.set(key, {
                id: key,
                name,
                bookCount: 0,
                soldCount: 0,
                revenue: 0,
                orderIds: new Set()
            });
        }
        return sellerStatsMap.get(key);
    };

    allUsers.filter(u => u.role === 'seller').forEach(s => {
        ensureSellerEntry(String(s.id), s.shopName || s.name || `Nhà bán #${s.id}`);
    });

    allBooks.forEach(b => {
        const info = resolveSellerInfo(b);
        ensureSellerEntry(info.key, info.name).bookCount += 1;
    });

    completedOrders.forEach(o => {
        const orderKey = String(o.id || o.orderCode || Math.random());
        (o.items || []).forEach(it => {
            const prod = bookByIdMap.get(String(it.id));
            const info = resolveSellerInfo(prod || it);
            const s = ensureSellerEntry(info.key, info.name);
            const qty = Number(it.quantity || 1);
            const pr = Number(it.price || 0);
            s.soldCount += qty;
            s.revenue += pr * qty;
            s.orderIds.add(orderKey);
        });
    });

    const sellerList = Array.from(sellerStatsMap.values())
        .map(s => ({ ...s, orderCount: s.orderIds.size }))
        .sort((a, b) => b.revenue - a.revenue || b.soldCount - a.soldCount);

    if (revActiveSellers) {
        const activeCount = sellerList.filter(s => s.revenue > 0).length;
        revActiveSellers.textContent = `${activeCount} nhà bán`;
    }

    if (sellerRevenueTableBody) {
        if (sellerList.length === 0) {
            sellerRevenueTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Chưa có dữ liệu nhà bán.</td></tr>`;
        } else {
            sellerRevenueTableBody.innerHTML = sellerList.map((s, idx) => {
                const rank = idx + 1;
                const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
                const share = totalItemsRevenue > 0 ? Math.round((s.revenue / totalItemsRevenue) * 100) : 0;

                return `
                    <tr>
                        <td><span class="rank-pill ${rankClass}">${rank}</span></td>
                        <td>
                            <strong>${escapeHtml(s.name)}</strong>
                        </td>
                        <td><strong style="color: #6366f1;">${s.bookCount}</strong> đầu sách</td>
                        <td><strong>${s.soldCount}</strong> cuốn</td>
                        <td><strong style="color: #10b981;">${formatPrice(s.revenue)}</strong></td>
                        <td>
                            <div class="share-bar-container">
                                <div class="share-bar-bg">
                                    <div class="share-bar-fill" style="width: ${share}%;"></div>
                                </div>
                                <span class="share-percent-text">${share}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 2. Phân bổ doanh thu theo Thể loại (tính tỷ trọng chuẩn theo totalItemsRevenue)
    const catStatsMap = new Map();
    allCategories.forEach(c => {
        catStatsMap.set(String(c.id), {
            id: c.id,
            name: c.name,
            icon: c.icon || '📖',
            soldCount: 0,
            revenue: 0
        });
    });

    completedOrders.forEach(o => {
        (o.items || []).forEach(it => {
            const prod = bookByIdMap.get(String(it.id));
            const rawCid = prod?.categoryId ?? it.categoryId;
            const cidKey = rawCid != null && catStatsMap.has(String(rawCid)) ? String(rawCid) : 'other';
            if (cidKey === 'other' && !catStatsMap.has('other')) {
                catStatsMap.set('other', {
                    id: 'other',
                    name: 'Thể loại khác / Đã gỡ',
                    icon: '📚',
                    soldCount: 0,
                    revenue: 0
                });
            }
            const c = catStatsMap.get(cidKey);
            const qty = Number(it.quantity || 1);
            const pr = Number(it.price || 0);
            c.soldCount += qty;
            c.revenue += pr * qty;
        });
    });

    const catList = Array.from(catStatsMap.values()).sort((a, b) => b.revenue - a.revenue || b.soldCount - a.soldCount);
    if (categoryRevenueTableBody) {
        if (catList.length === 0) {
            categoryRevenueTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 20px;">Chưa có dữ liệu thể loại.</td></tr>`;
        } else {
            categoryRevenueTableBody.innerHTML = catList.map(c => {
                const share = totalItemsRevenue > 0 ? Math.round((c.revenue / totalItemsRevenue) * 100) : 0;
                return `
                    <tr>
                        <td><strong>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</strong></td>
                        <td><strong>${c.soldCount}</strong> cuốn</td>
                        <td><strong style="color: #4f46e5;">${formatPrice(c.revenue)}</strong></td>
                        <td>
                            <div class="share-bar-container">
                                <div class="share-bar-bg">
                                    <div class="share-bar-fill" style="width: ${share}%; background: linear-gradient(90deg, #10b981, #34d399);"></div>
                                </div>
                                <span class="share-percent-text" style="color: #10b981;">${share}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 3. Top Sách Doanh Thu Cao Nhất trong kỳ
    const topBooksMap = new Map();
    completedOrders.forEach(o => {
        (o.items || []).forEach(it => {
            const bid = String(it.id);
            const prod = bookByIdMap.get(bid);
            const sellerInfo = resolveSellerInfo(prod || it);
            if (!topBooksMap.has(bid)) {
                topBooksMap.set(bid, {
                    id: it.id,
                    name: prod?.name || it.name || `Sách #${bid}`,
                    image: prod?.image || it.image || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=200&q=80',
                    sellerName: sellerInfo.name,
                    soldCount: 0,
                    revenue: 0
                });
            }
            const entry = topBooksMap.get(bid);
            const qty = Number(it.quantity || 1);
            const pr = Number(it.price || 0);
            entry.soldCount += qty;
            entry.revenue += pr * qty;
        });
    });

    const topBooks = Array.from(topBooksMap.values())
        .sort((a, b) => b.revenue - a.revenue || b.soldCount - a.soldCount)
        .slice(0, 8);

    if (topBooksRevenueTableBody) {
        if (topBooks.length === 0) {
            topBooksRevenueTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Chưa có dữ liệu sách bán trong kỳ.</td></tr>`;
        } else {
            topBooksRevenueTableBody.innerHTML = topBooks.map((b, idx) => {
                const rank = idx + 1;
                const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
                const share = totalItemsRevenue > 0 ? Math.round((b.revenue / totalItemsRevenue) * 100) : 0;
                return `
                    <tr>
                        <td><span class="rank-pill ${rankClass}">${rank}</span></td>
                        <td>
                            <div class="rev-book-mini">
                                <img src="${escapeHtml(b.image)}" alt="${escapeHtml(b.name)}">
                                <strong>${escapeHtml(b.name)}</strong>
                            </div>
                        </td>
                        <td>${escapeHtml(b.sellerName)}</td>
                        <td><strong>${b.soldCount}</strong> cuốn</td>
                        <td><strong style="color: #10b981;">${formatPrice(b.revenue)}</strong></td>
                        <td>
                            <div class="share-bar-container">
                                <div class="share-bar-bg">
                                    <div class="share-bar-fill" style="width: ${share}%; background: linear-gradient(90deg, #f59e0b, #fbbf24);"></div>
                                </div>
                                <span class="share-percent-text" style="color: #d97706;">${share}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 4. Biểu đồ doanh thu theo ngày
    if (revChartSubtitle) {
        revChartSubtitle.textContent = `Xu hướng dòng tiền thực thu theo ngày (${periodLabel})`;
    }
    if (revenueDailyChart) {
        const dailyMap = new Map();
        completedOrders.forEach(o => {
            const ymd = toLocalYmd(o.createdAt);
            if (!ymd) return;
            if (!dailyMap.has(ymd)) {
                dailyMap.set(ymd, { ymd, amount: 0, count: 0 });
            }
            const d = dailyMap.get(ymd);
            d.amount += Number(o.totalAmount || 0);
            d.count += 1;
        });

        const dailySeries = Array.from(dailyMap.values())
            .sort((a, b) => a.ymd.localeCompare(b.ymd))
            .slice(-14);

        if (dailySeries.length === 0) {
            revenueDailyChart.innerHTML = `<div style="width: 100%; text-align: center; color: #94a3b8; padding: 36px 12px;">Chưa có đơn hàng thành công nào trong khoảng thời gian đã chọn.</div>`;
        } else {
            const maxAmount = Math.max(...dailySeries.map(d => d.amount), 1);
            revenueDailyChart.innerHTML = dailySeries.map(d => {
                const heightPct = Math.max(6, Math.round((d.amount / maxAmount) * 100));
                const [, mm, dd] = d.ymd.split('-');
                return `
                    <div class="rev-bar-col" title="Ngày ${dd}/${mm}: ${formatPrice(d.amount)} (${d.count} đơn)">
                        <span class="rev-bar-amount">${formatCompactVnd(d.amount)}</span>
                        <div class="rev-bar-track">
                            <div class="rev-bar-fill" style="height: ${heightPct}%;"></div>
                        </div>
                        <span class="rev-bar-date">${dd}/${mm}</span>
                        <span class="rev-bar-orders">${d.count} đơn</span>
                    </div>
                `;
            }).join('');
        }
    }

    // 5. Cơ cấu thanh toán
    let vietQrTotal = 0;
    let codTotal = 0;
    let vietQrCount = 0;
    let codCount = 0;

    completedOrders.forEach(o => {
        const pm = (o.paymentMethod || '').toLowerCase();
        const amt = Number(o.totalAmount || 0);
        if (pm.includes('qr') || pm.includes('vietqr')) {
            vietQrTotal += amt;
            vietQrCount += 1;
        } else {
            codTotal += amt;
            codCount += 1;
        }
    });

    const totalPmAmount = vietQrTotal + codTotal;
    const vietQrShare = totalPmAmount > 0 ? Math.round((vietQrTotal / totalPmAmount) * 100) : 0;
    const codShare = totalPmAmount > 0 ? Math.round((codTotal / totalPmAmount) * 100) : 0;

    if (paymentMethodStatsWrap) {
        paymentMethodStatsWrap.innerHTML = `
            <div class="payment-method-card-box">
                <div class="pm-left">
                    <span class="pm-icon">📲</span>
                    <div>
                        <div class="pm-name">Chuyển khoản VietQR</div>
                        <div class="pm-sub">${vietQrCount} đơn hàng thành công</div>
                    </div>
                </div>
                <div>
                    <div class="pm-amount">${formatPrice(vietQrTotal)}</div>
                    <div class="pm-share">${vietQrShare}% tổng dòng tiền</div>
                </div>
            </div>
            <div class="payment-method-card-box">
                <div class="pm-left">
                    <span class="pm-icon">💵</span>
                    <div>
                        <div class="pm-name">Thu tiền mặt (COD)</div>
                        <div class="pm-sub">${codCount} đơn hàng thành công</div>
                    </div>
                </div>
                <div>
                    <div class="pm-amount" style="color: #f59e0b;">${formatPrice(codTotal)}</div>
                    <div class="pm-share" style="color: #f59e0b;">${codShare}% tổng dòng tiền</div>
                </div>
            </div>
        `;
    }

    lastRevenueReport = {
        periodLabel,
        summary: {
            totalGmv,
            totalItemsRevenue,
            totalShipping,
            totalDiscount,
            avgOrderValue,
            successCount,
            totalOrdersCount,
            cancelledCount,
            totalBooksSold
        },
        sellerList,
        catList,
        topBooks
    };
}

function setupRevenueDashboardControls() {
    const presetsWrap = document.querySelector('#revPeriodPresets');
    const dateFromInput = document.querySelector('#revDateFrom');
    const dateToInput = document.querySelector('#revDateTo');
    const btnExportRevenue = document.querySelector('#btnExportRevenueExcel');

    if (presetsWrap) {
        presetsWrap.addEventListener('click', (e) => {
            const btn = e.target.closest('.rev-period-btn');
            if (!btn) return;

            revenuePeriodFilter = btn.dataset.period || 'all';
            revenueDateFrom = '';
            revenueDateTo = '';
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';

            presetsWrap.querySelectorAll('.rev-period-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderRevenueDashboard();
        });
    }

    const handleCustomDateChange = () => {
        revenueDateFrom = dateFromInput ? dateFromInput.value : '';
        revenueDateTo = dateToInput ? dateToInput.value : '';
        if (revenueDateFrom || revenueDateTo) {
            revenuePeriodFilter = 'custom';
            if (presetsWrap) {
                presetsWrap.querySelectorAll('.rev-period-btn').forEach(b => b.classList.remove('active'));
            }
        } else {
            revenuePeriodFilter = 'all';
            const allBtn = presetsWrap?.querySelector('[data-period="all"]');
            if (allBtn) allBtn.classList.add('active');
        }
        renderRevenueDashboard();
    };

    if (dateFromInput) dateFromInput.addEventListener('change', handleCustomDateChange);
    if (dateToInput) dateToInput.addEventListener('change', handleCustomDateChange);

    if (btnExportRevenue) {
        btnExportRevenue.addEventListener('click', () => {
            if (!lastRevenueReport) renderRevenueDashboard();
            excelExportUtil.exportRevenueReport(lastRevenueReport || {});
        });
    }
}

// Helper định dạng chuỗi datetime-local input YYYY-MM-DDTHH:mm
function toDatetimeLocalValue(isoOrDateStr) {
    if (!isoOrDateStr) return '';
    try {
        const d = new Date(isoOrDateStr);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day}T${h}:${min}`;
    } catch {
        return '';
    }
}

// Helper định dạng ngày giờ hiển thị tiếng Việt
function formatDateTimeVn(isoOrDateStr) {
    if (!isoOrDateStr) return '--:--';
    try {
        const d = new Date(isoOrDateStr);
        if (isNaN(d.getTime())) return String(isoOrDateStr);
        return d.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return String(isoOrDateStr);
    }
}

// ============ 9. QUẢN LÝ SALE & KHUYẾN MÃI ============
function startAdminLiveCountdown(config) {
    if (adminLiveCountdownTimer) {
        clearInterval(adminLiveCountdownTimer);
        adminLiveCountdownTimer = null;
    }

    if (!config) return;

    function tick() {
        const rem = saleService.getTimeRemaining(config);
        const isActive = saleService.isSaleActive(config);

        if (!config.isActive) {
            if (saleStatusIndicator) {
                saleStatusIndicator.innerHTML = '<span class="campaign-status-badge inactive">⚪ Tạm tắt</span>';
            }
            if (adminLiveTitle) adminLiveTitle.textContent = 'CHƯƠNG TRÌNH SALE ĐANG TẮT';
            if (adminLiveClock) adminLiveClock.textContent = '00:00:00';
            if (adminLiveDesc) adminLiveDesc.textContent = 'Chương trình chưa được kích hoạt';
            return;
        }

        if (rem.isExpired) {
            if (saleStatusIndicator) {
                saleStatusIndicator.innerHTML = '<span class="campaign-status-badge ended">🔴 Đã kết thúc</span>';
            }
            if (adminLiveTitle) adminLiveTitle.textContent = 'ĐỢT SALE ĐÃ KẾT THÚC';
            if (adminLiveClock) adminLiveClock.textContent = '00:00:00';
            if (adminLiveDesc) adminLiveDesc.textContent = 'Thời gian Flash Sale đã hết';
            return;
        }

        if (rem.isUpcoming) {
            if (saleStatusIndicator) {
                saleStatusIndicator.innerHTML = '<span class="campaign-status-badge upcoming">🟡 Sắp diễn ra</span>';
            }
            if (adminLiveTitle) adminLiveTitle.textContent = 'SẮP DIỄN RA';
            if (adminLiveClock) adminLiveClock.textContent = rem.formatted;
            if (adminLiveDesc) adminLiveDesc.textContent = 'Chưa đến giờ bắt đầu đợt Sale';
            return;
        }

        // Đang diễn ra Flash Sale
        if (saleStatusIndicator) {
            saleStatusIndicator.innerHTML = '<span class="campaign-status-badge active">🟢 ĐANG DIỄN RA</span>';
        }
        if (adminLiveTitle) adminLiveTitle.textContent = 'ĐỒNG HỒ ĐẾM NGƯỢC REALTIME ĐANG CHẠY';
        if (adminLiveClock) adminLiveClock.textContent = rem.formatted;
        if (adminLiveDesc) adminLiveDesc.textContent = 'Thời gian còn lại của đợt Sale';
    }

    tick();
    adminLiveCountdownTimer = setInterval(tick, 1000);
}

function renderSaleCampaignInfo(config) {
    if (!config) return;
    currentSaleConfig = config;

    if (campaignNameInput) campaignNameInput.value = config.campaignName || '';
    if (campaignStartDateInput) campaignStartDateInput.value = toDatetimeLocalValue(config.startTime || config.startDate);
    if (campaignEndDateInput) campaignEndDateInput.value = toDatetimeLocalValue(config.endTime || config.endDate);
    if (campaignDescriptionInput) campaignDescriptionInput.value = config.description || '';
    if (campaignIsActiveInput) campaignIsActiveInput.checked = config.isActive === true;

    if (adminLiveTimeRange) {
        const startText = formatDateTimeVn(config.startTime || config.startDate);
        const endText = formatDateTimeVn(config.endTime || config.endDate);
        adminLiveTimeRange.textContent = `Bắt đầu: ${startText}  •  Kết thúc: ${endText}`;
    }

    if (customDurationHours && config.durationHours) {
        customDurationHours.value = config.durationHours;
        updateStartQuickSaleButton(config.durationHours);
    }

    // Khởi chạy đồng hồ đếm ngược Realtime trên Admin
    startAdminLiveCountdown(config);
}

function updateSalesTabBadge() {
    const onSaleCount = allBooks.filter(b => b.onSale === true && Number(b.discountPercent) > 0).length;
    const activeCouponsCount = allCoupons.filter(c => getCouponLifecycleStatus(c).code === 'active').length;

    if (saleEligibleCount) saleEligibleCount.textContent = onSaleCount;
    if (voucherSummaryBadge) voucherSummaryBadge.textContent = `${activeCouponsCount} mã đang bật`;
    if (salesTabCount) salesTabCount.textContent = onSaleCount + activeCouponsCount;
}

function applySaleBooksFilter(resetPage = true) {
    if (!salesTableBody) return;
    const query = searchSaleBookInput ? searchSaleBookInput.value.trim().toLowerCase() : '';
    const statusFilter = filterSaleStatus ? filterSaleStatus.value : '';

    updateSalesTabBadge();

    const filtered = allBooks.filter(book => {
        const matchQuery = !query || 
            (book.name || '').toLowerCase().includes(query) || 
            (book.author || '').toLowerCase().includes(query);

        let matchStatus = true;
        if (statusFilter === 'on_sale') {
            matchStatus = book.onSale === true && Number(book.discountPercent) > 0;
        } else if (statusFilter === 'not_sale') {
            matchStatus = !book.onSale || Number(book.discountPercent) <= 0;
        }

        return matchQuery && matchStatus;
    });

    // Thay đổi bộ lọc -> luôn quay về trang đầu tiên
    if (resetPage) salesPage = 1;
    renderSalesTable(filtered);
}

function renderSalesTable(books) {
    if (!salesTableBody) return;

    // Lưu lại kết quả lọc hiện tại để thanh phân trang gọi lại được
    filteredSales = Array.isArray(books) ? books : [];

    const pageData = paginate(filteredSales, salesPage, salesPageSize);

    if (!filteredSales || filteredSales.length === 0) {
        salesTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 32px; color: #94a3b8;">
                    Không tìm thấy cuốn sách nào phù hợp với bộ lọc Sale.
                </td>
            </tr>
        `;
        drawPagination(salesPagination, pageData, salesPageSize, 'cuốn sách');
        return;
    }

    salesTableBody.innerHTML = pageData.items.map(book => {
        const isOnSale = book.onSale === true;
        const discount = Number(book.discountPercent) || (isOnSale ? 20 : 0);
        const salePrice = saleService.calculateSalePrice(book.price, discount);

        return `
            <tr data-book-id="${book.id}">
                <td>
                    <img 
                        src="${book.image}" 
                        alt="${book.name}" 
                        style="width: 44px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0;"
                        onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80'"
                    >
                </td>
                <td>
                    <strong style="color: #1e293b; display: block; font-size: 0.95rem;">${book.name}</strong>
                    <span style="font-size: 0.8rem; color: #64748b;">${book.author || 'Đang cập nhật'}</span>
                </td>
                <td>
                    <strong style="color: #475569;">${formatPrice(book.price)}</strong>
                </td>
                <td style="text-align: center;">
                    <label style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <input 
                            type="checkbox" 
                            class="sale-row-toggle" 
                            data-id="${book.id}"
                            ${isOnSale ? 'checked' : ''}
                            style="width: 18px; height: 18px; accent-color: #e11d48; cursor: pointer;"
                        >
                        <span class="sale-row-status-text" style="font-size: 0.85rem; font-weight: 700; color: ${isOnSale ? '#e11d48' : '#94a3b8'};">
                            ${isOnSale ? 'BẬT' : 'Tắt'}
                        </span>
                    </label>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <input 
                            type="number" 
                            class="sale-discount-input" 
                            data-id="${book.id}"
                            value="${discount}"
                            min="0" 
                            max="90" 
                            step="5"
                        >
                        <span style="font-weight: 700; color: #64748b;">%</span>
                    </div>
                </td>
                <td>
                    <span class="sale-preview-price" id="salePreviewPrice_${book.id}">
                        ${isOnSale && discount > 0 ? formatPrice(salePrice) : '---'}
                    </span>
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn-save-row-sale" data-id="${book.id}">
                        💾 Lưu
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    drawPagination(salesPagination, pageData, salesPageSize, 'cuốn sách');
}

// Phân trang bảng Quản lý Sale
setupPagination(salesPagination, {
    getPage: () => salesPage,
    setPage: (p) => { salesPage = p; },
    getPageSize: () => salesPageSize,
    setPageSize: (s) => { salesPageSize = s; },
    rerender: () => renderSalesTable(filteredSales)
});

function formatDurationLabel(hours) {
    const num = Number(hours);
    if (!num || isNaN(num)) return '8 Tiếng';
    if (num < 1) {
        const mins = Math.round(num * 60 * 10) / 10;
        return `${mins} Phút (${num} Giờ)`;
    }
    return `${num} Tiếng`;
}

function updateStartQuickSaleButton(hours) {
    if (btnStartQuickSale) {
        btnStartQuickSale.textContent = `🚀 Bắt Đầu Đếm Ngược Ngay (${formatDurationLabel(hours)})`;
    }
}

// 1. Bắt sự kiện chọn nhanh thời lượng Flash Sale (1p, 2h, 4h, 8h, 12h, 24h)
if (btnPresetHoursList && btnPresetHoursList.length > 0) {
    btnPresetHoursList.forEach(btn => {
        btn.addEventListener('click', () => {
            btnPresetHoursList.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const hours = Number(btn.dataset.hours) || 8;
            if (customDurationHours) customDurationHours.value = hours;
            updateStartQuickSaleButton(hours);
        });
    });
}

if (customDurationHours) {
    customDurationHours.addEventListener('input', () => {
        const val = Number(customDurationHours.value);
        updateStartQuickSaleButton(val);
    });
}

// 2. Kích hoạt Flash Sale Realtime ngay lập tức (Đếm ngược ngay sau khi bấm)
if (btnStartQuickSale) {
    btnStartQuickSale.addEventListener('click', async () => {
        const val = Number(customDurationHours?.value);
        const hours = (!isNaN(val) && val >= 0.01) ? val : 8;
        btnStartQuickSale.disabled = true;
        btnStartQuickSale.textContent = '⏳ Đang khởi động Sale...';

        try {
            const timeLabel = formatDurationLabel(hours);
            const campaignTitle = `⚡ Flash Sale Giờ Vàng (${timeLabel})`;
            const campaignDesc = `Ưu đãi giá sốc có hạn trong ngày hôm nay - Đếm ngược ${timeLabel}!`;
            const updated = await saleService.startQuickSale(hours, campaignTitle, campaignDesc);
            currentSaleConfig = updated;
            renderSaleCampaignInfo(updated);
            alert(`✓ ĐÃ KÍCH HOẠT FLASH SALE (${timeLabel}) THÀNH CÔNG!\n\nĐồng hồ đếm ngược bắt đầu chạy ngay lập tức. Trang chủ và chi tiết sản phẩm sẽ áp dụng giá sale thời gian thực.`);
        } catch (err) {
            console.error('Lỗi khi kích hoạt Flash Sale:', err);
            alert('Không thể kích hoạt Flash Sale. Vui lòng thử lại!');
        } finally {
            btnStartQuickSale.disabled = false;
            updateStartQuickSaleButton(hours);
        }
    });
}

// 3. Dừng đợt Sale ngay lập tức
if (btnStopSale) {
    btnStopSale.addEventListener('click', async () => {
        if (!confirm('Bạn có chắc chắn muốn DỪNG đợt Sale ngay lập tức?\n\nToàn bộ giá các cuốn sách sẽ quay trở về giá niêm yết gốc ngay bây giờ.')) {
            return;
        }

        btnStopSale.disabled = true;
        btnStopSale.textContent = '⏳ Đang dừng...';

        try {
            const updated = await saleService.stopSale();
            currentSaleConfig = updated;
            renderSaleCampaignInfo(updated);
            alert('✓ Đã dừng đợt Sale thành công! Hệ thống đã chuyển về giá gốc.');
        } catch (err) {
            console.error('Lỗi khi dừng Sale:', err);
            alert('Không thể dừng Sale. Vui lòng thử lại!');
        } finally {
            btnStopSale.disabled = false;
            btnStopSale.textContent = '⏹️ Dừng Sale Ngay';
        }
    });
}

// 4. Bắt sự kiện lưu Cấu hình đợt Sale Nâng Cao
if (saleCampaignForm) {
    saleCampaignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.querySelector('#btnSaveCampaign');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Đang lưu...';
        }

        const startVal = campaignStartDateInput?.value || '';
        const endVal = campaignEndDateInput?.value || '';

        const newConfig = {
            id: 1,
            campaignName: campaignNameInput.value.trim(),
            startTime: startVal ? new Date(startVal).toISOString() : '',
            endTime: endVal ? new Date(endVal).toISOString() : '',
            startDate: startVal ? startVal.slice(0, 10) : '',
            endDate: endVal ? endVal.slice(0, 10) : '',
            description: campaignDescriptionInput.value.trim(),
            isActive: campaignIsActiveInput.checked
        };

        try {
            const updated = await saleService.updateConfig(newConfig);
            currentSaleConfig = updated;
            renderSaleCampaignInfo(updated);
            alert('✓ Đã cập nhật thành công cấu hình đợt Sale!');
        } catch (err) {
            console.error('Lỗi khi lưu cấu hình Sale:', err);
            alert('Không thể lưu cấu hình đợt Sale. Vui lòng thử lại!');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 Lưu Cấu Hình Nâng Cao';
            }
        }
    });
}

// Bắt sự kiện tìm kiếm và lọc sách Sale
if (searchSaleBookInput) {
    searchSaleBookInput.addEventListener('input', applySaleBooksFilter);
}
if (filterSaleStatus) {
    filterSaleStatus.addEventListener('change', applySaleBooksFilter);
}

// Bắt sự kiện trên từng dòng sách trong bảng Sale
if (salesTableBody) {
    // 1. Khi thay đổi checkbox hoặc % giảm giá -> tự động tính lại giá sau Sale
    salesTableBody.addEventListener('input', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;

        const bookId = row.dataset.bookId;
        const book = allBooks.find(b => Number(b.id) === Number(bookId));
        if (!book) return;

        const toggle = row.querySelector('.sale-row-toggle');
        const discountInput = row.querySelector('.sale-discount-input');
        const previewEl = row.querySelector(`#salePreviewPrice_${bookId}`);
        const statusText = row.querySelector('.sale-row-status-text');

        const isOn = toggle ? toggle.checked : false;
        const discountVal = discountInput ? Math.min(90, Math.max(0, Number(discountInput.value) || 0)) : 0;

        if (statusText) {
            statusText.textContent = isOn ? 'BẬT' : 'Tắt';
            statusText.style.color = isOn ? '#e11d48' : '#94a3b8';
        }

        if (previewEl) {
            if (isOn && discountVal > 0) {
                const sPrice = saleService.calculateSalePrice(book.price, discountVal);
                previewEl.textContent = formatPrice(sPrice);
            } else {
                previewEl.textContent = '---';
            }
        }
    });

    // 2. Khi bấm nút "Lưu" từng sản phẩm
    salesTableBody.addEventListener('click', async (e) => {
        const btnSave = e.target.closest('.btn-save-row-sale');
        if (!btnSave) return;

        const id = btnSave.dataset.id;
        const row = btnSave.closest('tr');
        if (!row) return;

        const toggle = row.querySelector('.sale-row-toggle');
        const discountInput = row.querySelector('.sale-discount-input');

        const onSale = toggle ? toggle.checked : false;
        const discountPercent = discountInput ? Math.min(90, Math.max(0, Number(discountInput.value) || 0)) : 0;

        btnSave.disabled = true;
        btnSave.textContent = 'Đang lưu...';

        try {
            await saleService.updateProductSale(id, onSale, discountPercent);
            
            // Cập nhật bộ nhớ cục bộ allBooks
            const book = allBooks.find(b => Number(b.id) === Number(id));
            if (book) {
                book.onSale = onSale;
                book.discountPercent = discountPercent;
            }

            btnSave.textContent = '✓ Đã lưu';
            btnSave.style.background = '#10b981';

            // Cập nhật lại số đếm
            updateSalesTabBadge();

            setTimeout(() => {
                btnSave.disabled = false;
                btnSave.textContent = '💾 Lưu';
                btnSave.style.background = '';
            }, 1500);

        } catch (err) {
            console.error('Lỗi khi cập nhật sale sản phẩm:', err);
            alert('Không thể cập nhật sản phẩm. Vui lòng thử lại!');
            btnSave.disabled = false;
            btnSave.textContent = '💾 Lưu';
        }
    });
}

// ============ 9B. QUẢN LÝ VOUCHER / MÃ GIẢM GIÁ ============
function getCouponLifecycleStatus(coupon) {
    if (!coupon || coupon.active === false) {
        return { code: 'inactive', label: '⏸️ Tạm tắt' };
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
        return { code: 'expired', label: '⌛ Hết hạn' };
    }
    const limit = Number(coupon.usageLimit) || 0;
    const used = Number(coupon.usedCount) || 0;
    if (limit > 0 && used >= limit) {
        return { code: 'expired', label: '🚫 Hết lượt' };
    }
    return { code: 'active', label: '🟢 Đang chạy' };
}

function renderCoupons(coupons) {
    if (!couponsTableBody) return;
    const list = Array.isArray(coupons) ? coupons : [];

    if (list.length === 0) {
        couponsTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 28px; color: #94a3b8;">
                    Chưa có mã Voucher nào khớp với bộ lọc. Bấm "+ Tạo Voucher Mới" để thêm ngay!
                </td>
            </tr>
        `;
        return;
    }

    couponsTableBody.innerHTML = list.map(c => {
        const statusInfo = getCouponLifecycleStatus(c);
        const type = c.discountType || 'fixed';
        const val = Number(c.discountValue) || 0;
        const maxCap = Number(c.maxDiscount) || 0;
        const minOrder = Number(c.minOrderValue) || 0;
        const used = Number(c.usedCount) || 0;
        const limit = Number(c.usageLimit) || 0;

        let typeBadgeHtml = '';
        let discountSummary = '';
        if (type === 'percent') {
            typeBadgeHtml = '<span class="coupon-type-badge percent">📉 Giảm %</span>';
            discountSummary = `Giảm <strong>${val}%</strong>${maxCap > 0 ? ` (tối đa ${formatPrice(maxCap)})` : ''}`;
        } else if (type === 'shipping') {
            typeBadgeHtml = '<span class="coupon-type-badge shipping">🚚 Giảm Ship</span>';
            discountSummary = `Giảm phí ship <strong>${formatPrice(val)}</strong>`;
        } else {
            typeBadgeHtml = '<span class="coupon-type-badge fixed">💵 Giảm tiền</span>';
            discountSummary = `Giảm thẳng <strong>${formatPrice(val)}</strong>`;
        }

        const expiryText = c.expiresAt
            ? `HSD: <strong>${formatDateTimeVn(c.expiresAt)}</strong>`
            : '<span style="color: #059669;">Không giới hạn thời gian</span>';

        const usageText = limit > 0
            ? `<strong>${used}</strong> / ${limit}`
            : `<strong>${used}</strong> / ∞`;

        const isActiveFlag = c.active !== false;

        return `
            <tr>
                <td>
                    <span class="coupon-code-pill">${escapeHtml(c.code)}</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                        ${typeBadgeHtml}
                        <span style="font-size: 0.9rem;">${discountSummary}</span>
                    </div>
                    <div style="font-size: 0.82rem; color: #64748b;">${escapeHtml(c.description || 'Không có mô tả')}</div>
                </td>
                <td>
                    <div style="font-size: 0.84rem; line-height: 1.5;">
                        <div>Đơn tối thiểu: <strong>${minOrder > 0 ? formatPrice(minOrder) : '0 đ'}</strong></div>
                        <div style="font-size: 0.78rem; color: #64748b;">${expiryText}</div>
                    </div>
                </td>
                <td style="text-align: center; font-size: 0.88rem;">
                    ${usageText}
                </td>
                <td style="text-align: center;">
                    <span class="coupon-status-pill ${statusInfo.code}">${statusInfo.label}</span>
                </td>
                <td style="text-align: center;">
                    <div style="display: inline-flex; gap: 6px; justify-content: center;">
                        <button
                            type="button"
                            class="btn-action ${isActiveFlag ? 'lock' : 'unlock'} btn-toggle-coupon"
                            data-id="${c.id}"
                            title="${isActiveFlag ? 'Tạm tắt Voucher' : 'Bật lại Voucher'}"
                        >${isActiveFlag ? '⏸️' : '▶️'}</button>
                        <button type="button" class="btn-action edit btn-edit-coupon" data-id="${c.id}" title="Chỉnh sửa Voucher">✏️</button>
                        <button type="button" class="btn-action delete btn-delete-coupon" data-id="${c.id}" title="Xóa Voucher">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function applyCouponsFilter() {
    updateSalesTabBadge();
    if (!couponsTableBody) return;

    const query = searchCouponInput ? searchCouponInput.value.trim().toLowerCase() : '';
    const typeFilter = filterCouponType ? filterCouponType.value : '';
    const statusFilter = filterCouponStatus ? filterCouponStatus.value : '';

    const filtered = allCoupons.filter(c => {
        const matchQuery = !query ||
            (c.code || '').toLowerCase().includes(query) ||
            (c.description || '').toLowerCase().includes(query);

        const matchType = !typeFilter || (c.discountType || 'fixed') === typeFilter;
        const lifecycle = getCouponLifecycleStatus(c).code;
        const matchStatus = !statusFilter || lifecycle === statusFilter;

        return matchQuery && matchType && matchStatus;
    });

    renderCoupons(filtered);
}

function syncCouponTypeFormFields() {
    if (!couponTypeInput) return;
    const type = couponTypeInput.value;

    if (type === 'percent') {
        if (couponValueLabel) couponValueLabel.textContent = 'Mức giảm (%) *';
        if (couponValueInput) {
            couponValueInput.max = '100';
            couponValueInput.step = '1';
            couponValueInput.placeholder = 'VD: 10, 15, 20';
        }
        if (couponMaxDiscountGroup) couponMaxDiscountGroup.style.display = 'block';
    } else if (type === 'shipping') {
        if (couponValueLabel) couponValueLabel.textContent = 'Giảm phí ship tối đa (VNĐ) *';
        if (couponValueInput) {
            couponValueInput.removeAttribute('max');
            couponValueInput.step = '1000';
            couponValueInput.placeholder = 'VD: 30000';
            if (!couponValueInput.value) couponValueInput.value = '30000';
        }
        if (couponMaxDiscountGroup) couponMaxDiscountGroup.style.display = 'none';
    } else {
        if (couponValueLabel) couponValueLabel.textContent = 'Số tiền giảm cố định (VNĐ) *';
        if (couponValueInput) {
            couponValueInput.removeAttribute('max');
            couponValueInput.step = '1000';
            couponValueInput.placeholder = 'VD: 20000, 50000';
        }
        if (couponMaxDiscountGroup) couponMaxDiscountGroup.style.display = 'none';
    }
}

function openCouponModal(coupon = null) {
    if (!couponModal || !couponForm) return;
    couponForm.reset();

    if (coupon) {
        if (couponModalTitle) couponModalTitle.textContent = `✏️ Chỉnh sửa Voucher "${coupon.code}"`;
        if (couponIdInput) couponIdInput.value = coupon.id;
        if (couponCodeInput) couponCodeInput.value = coupon.code || '';
        if (couponTypeInput) couponTypeInput.value = coupon.discountType || 'fixed';
        if (couponValueInput) couponValueInput.value = coupon.discountValue ?? '';
        if (couponMaxDiscountInput) couponMaxDiscountInput.value = coupon.maxDiscount ?? 0;
        if (couponMinOrderInput) couponMinOrderInput.value = coupon.minOrderValue ?? 0;
        if (couponUsageLimitInput) couponUsageLimitInput.value = coupon.usageLimit ?? 0;
        if (couponExpiresAtInput) couponExpiresAtInput.value = toDatetimeLocalValue(coupon.expiresAt);
        if (couponDescInput) couponDescInput.value = coupon.description || '';
        if (couponActiveInput) couponActiveInput.checked = coupon.active !== false;
        if (btnSaveCoupon) btnSaveCoupon.textContent = 'Lưu thay đổi';
    } else {
        if (couponModalTitle) couponModalTitle.textContent = '🎟️ Tạo Voucher / Mã giảm giá mới';
        if (couponIdInput) couponIdInput.value = '';
        if (couponTypeInput) couponTypeInput.value = 'percent';
        if (couponValueInput) couponValueInput.value = '15';
        if (couponMaxDiscountInput) couponMaxDiscountInput.value = '50000';
        if (couponMinOrderInput) couponMinOrderInput.value = '150000';
        if (couponUsageLimitInput) couponUsageLimitInput.value = '0';
        if (couponExpiresAtInput) couponExpiresAtInput.value = '';
        if (couponDescInput) couponDescInput.value = '';
        if (couponActiveInput) couponActiveInput.checked = true;
        if (btnSaveCoupon) btnSaveCoupon.textContent = 'Tạo Voucher';
    }

    syncCouponTypeFormFields();
    couponModal.classList.add('active');
}

function closeCouponModal() {
    if (couponModal) couponModal.classList.remove('active');
}

if (searchCouponInput) searchCouponInput.addEventListener('input', applyCouponsFilter);
if (filterCouponType) filterCouponType.addEventListener('change', applyCouponsFilter);
if (filterCouponStatus) filterCouponStatus.addEventListener('change', applyCouponsFilter);
if (couponTypeInput) couponTypeInput.addEventListener('change', syncCouponTypeFormFields);

if (btnGenerateCouponCode && couponCodeInput) {
    btnGenerateCouponCode.addEventListener('click', () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let rand = '';
        for (let i = 0; i < 4; i++) {
            rand += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        couponCodeInput.value = `TRITUE${rand}`;
    });
}

if (btnOpenAddCouponModal) {
    btnOpenAddCouponModal.addEventListener('click', () => openCouponModal(null));
}
if (btnCancelCouponModal) {
    btnCancelCouponModal.addEventListener('click', closeCouponModal);
}
if (couponModal) {
    couponModal.addEventListener('click', (e) => {
        if (e.target === couponModal) closeCouponModal();
    });
}

if (couponForm) {
    couponForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editingId = couponIdInput ? couponIdInput.value.trim() : '';
        const code = couponService.normalizeCode(couponCodeInput?.value);
        const discountType = couponTypeInput ? couponTypeInput.value : 'fixed';
        const discountValue = Number(couponValueInput?.value) || 0;
        const minOrderValue = Math.max(0, Number(couponMinOrderInput?.value) || 0);
        const usageLimit = Math.max(0, Math.floor(Number(couponUsageLimitInput?.value) || 0));
        const expiresAtRaw = couponExpiresAtInput ? couponExpiresAtInput.value : '';
        const active = couponActiveInput ? couponActiveInput.checked : true;

        if (!code || code.length < 3) {
            alert('Mã Voucher phải có ít nhất 3 ký tự (không chứa khoảng trắng).');
            return;
        }
        if (discountType === 'percent' && (discountValue <= 0 || discountValue > 100)) {
            alert('Giá trị giảm theo phần trăm phải từ 1% đến 100%.');
            return;
        }
        if (discountType !== 'percent' && discountValue <= 0) {
            alert('Số tiền giảm phải lớn hơn 0 đ.');
            return;
        }

        const maxDiscount = discountType === 'percent'
            ? Math.max(0, Number(couponMaxDiscountInput?.value) || 0)
            : discountValue;

        let description = couponDescInput ? couponDescInput.value.trim() : '';
        if (!description) {
            const minOrderNote = minOrderValue > 0 ? ` cho đơn từ ${formatPrice(minOrderValue)}` : '';
            if (discountType === 'percent') {
                description = `Giảm ${discountValue}%${maxDiscount > 0 ? ` (tối đa ${formatPrice(maxDiscount)})` : ''}${minOrderNote}`;
            } else if (discountType === 'shipping') {
                description = `Giảm ${formatPrice(discountValue)} phí vận chuyển${minOrderNote}`;
            } else {
                description = `Giảm ngay ${formatPrice(discountValue)}${minOrderNote}`;
            }
        }

        const payload = {
            code,
            description,
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            usageLimit,
            expiresAt: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
            active
        };

        if (btnSaveCoupon) {
            btnSaveCoupon.disabled = true;
            btnSaveCoupon.textContent = 'Đang lưu...';
        }

        try {
            if (editingId) {
                await couponService.updateCoupon(editingId, payload);
                alert(`✓ Đã cập nhật Voucher "${code}" thành công!`);
            } else {
                await couponService.createCoupon(payload);
                alert(`🎉 Đã tạo Voucher "${code}" thành công! Khách hàng có thể dùng ngay tại Giỏ hàng.`);
            }

            allCoupons = await couponService.getAllCoupons();
            applyCouponsFilter();
            closeCouponModal();
        } catch (err) {
            console.error('Lỗi khi lưu Voucher:', err);
            alert(err.message || 'Không thể lưu Voucher. Vui lòng thử lại!');
        } finally {
            if (btnSaveCoupon) {
                btnSaveCoupon.disabled = false;
                btnSaveCoupon.textContent = editingId ? 'Lưu thay đổi' : 'Tạo Voucher';
            }
        }
    });
}

if (couponsTableBody) {
    couponsTableBody.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('.btn-toggle-coupon');
        if (toggleBtn) {
            const id = toggleBtn.dataset.id;
            const coupon = allCoupons.find(c => String(c.id) === String(id));
            if (!coupon) return;

            const nextActive = coupon.active === false;
            try {
                await couponService.updateCoupon(coupon.id, { active: nextActive });
                allCoupons = await couponService.getAllCoupons();
                applyCouponsFilter();
            } catch (err) {
                console.error('Lỗi khi bật/tắt Voucher:', err);
                alert('Không thể đổi trạng thái Voucher.');
            }
            return;
        }

        const editBtn = e.target.closest('.btn-edit-coupon');
        if (editBtn) {
            const id = editBtn.dataset.id;
            const coupon = allCoupons.find(c => String(c.id) === String(id));
            if (coupon) openCouponModal(coupon);
            return;
        }

        const deleteBtn = e.target.closest('.btn-delete-coupon');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            const coupon = allCoupons.find(c => String(c.id) === String(id));
            if (!coupon) return;
            if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn Voucher "${coupon.code}"?`)) return;

            try {
                await couponService.deleteCoupon(coupon.id);
                allCoupons = allCoupons.filter(c => String(c.id) !== String(coupon.id));
                applyCouponsFilter();
                alert(`✓ Đã xóa Voucher "${coupon.code}"!`);
            } catch (err) {
                console.error('Lỗi khi xóa Voucher:', err);
                alert('Không thể xóa Voucher này.');
            }
        }
    });
}

// 9. Khởi chạy và nạp dữ liệu ban đầu
async function initAdmin() {
    try {
        const verified = await authService.syncSession();
        if (!verified || verified.role !== 'admin') {
            alert('⚠️ Phiên quản trị không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại!');
            window.location.href = './login.html';
            return;
        }

        const [categories, books, orders, users, fetchedSaleConfig, coupons] = await Promise.all([
            categoryService.getAll(),
            productService.getAll(),
            orderService.getAllOrders(),
            authService.getAllUsers(),
            saleService.getConfig().catch(() => null),
            couponService.getAllCoupons().catch(() => [])
        ]);

        allCategories = categories;
        allBooks = books;
        allOrders = orders;
        allUsers = users;
        allCoupons = coupons || [];
        currentSaleConfig = fetchedSaleConfig;

        updateCategoriesSelect();
        updateSellersSelect();
        renderBooks(allBooks);
        renderOrders(allOrders);
        renderCategories(allCategories);
        applyUsersFilter(true);
        renderSaleCampaignInfo(currentSaleConfig);
        applyCouponsFilter();
        applySaleBooksFilter();
        updateStats();
        renderRevenueDashboard();

    } catch (err) {
        console.error('Lỗi khi tải dữ liệu trang quản trị:', err);
        alert('Không thể kết nối đến máy chủ json-server. Hãy chắc chắn bạn đã chạy lệnh "npm run server"!');
    }
}

// ==========================================
// XỬ LÝ NHẬP SÁCH TỪ EXCEL (ADMIN)
// ==========================================
function setupAdminExcelImport() {
    const btnOpenModal = document.querySelector('#btnImportBooksAdmin');
    const modal = document.querySelector('#adminImportExcelModal');
    const btnClose = document.querySelector('#btnCloseAdminImportModal');
    const btnCancel = document.querySelector('#btnCancelAdminImportModal');
    const btnDownload = document.querySelector('#btnDownloadAdminExcelTemplate');
    const dropzone = document.querySelector('#adminExcelDropzone');
    const fileInput = document.querySelector('#inputAdminExcelFile');
    const btnBrowse = document.querySelector('#btnBrowseAdminExcel');

    const previewSection = document.querySelector('#adminExcelPreviewSection');
    const previewTotal = document.querySelector('#adminPreviewTotal');
    const previewValid = document.querySelector('#adminPreviewValid');
    const previewInvalid = document.querySelector('#adminPreviewInvalid');
    const tbody = document.querySelector('#adminExcelPreviewTbody');
    const btnConfirm = document.querySelector('#btnConfirmAdminImportExcel');
    const confirmCount = document.querySelector('#adminConfirmCount');
    const progressBox = document.querySelector('#adminImportProgress');
    const progressText = document.querySelector('#adminImportProgressText');

    let parsedValidRows = [];

    function openModal() {
        if (!modal) return;
        resetState();
        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    function closeModal() {
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
        resetState();
    }

    function resetState() {
        parsedValidRows = [];
        if (fileInput) fileInput.value = '';
        if (previewSection) previewSection.style.display = 'none';
        if (progressBox) progressBox.style.display = 'none';
        if (tbody) tbody.innerHTML = '';
        if (btnConfirm) {
            btnConfirm.disabled = true;
            btnConfirm.style.opacity = '0.5';
            btnConfirm.style.cursor = 'not-allowed';
            if (confirmCount) confirmCount.textContent = '0';
        }
    }

    if (btnOpenModal && modal) {
        btnOpenModal.addEventListener('click', openModal);
    }

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            excelImportUtil.downloadTemplate(allCategories);
        });
    }

    if (btnBrowse && fileInput) {
        btnBrowse.addEventListener('click', () => fileInput.click());
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });
    }

    async function handleFile(file) {
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            alert('Vui lòng chọn file Excel đúng định dạng (.xlsx hoặc .xls)!');
            return;
        }

        try {
            const { validRows, invalidRows, total } = await excelImportUtil.parseExcel(file, allCategories);
            parsedValidRows = validRows;

            if (previewSection) previewSection.style.display = 'block';
            if (previewTotal) previewTotal.textContent = total;
            if (previewValid) previewValid.textContent = validRows.length;
            if (previewInvalid) previewInvalid.textContent = invalidRows.length;

            if (tbody) {
                let html = '';
                validRows.forEach(r => {
                    html += `
                        <tr>
                            <td>#${r.rowNum}</td>
                            <td><strong>${r.name}</strong></td>
                            <td>${r.author}</td>
                            <td>${r.categoryName}</td>
                            <td>${formatPrice(r.price)}</td>
                            <td>${r.stock}</td>
                            <td><span class="status-badge-ok">✓ Hợp lệ</span></td>
                        </tr>
                    `;
                });
                invalidRows.forEach(r => {
                    html += `
                        <tr class="row-invalid">
                            <td>#${r.rowNum}</td>
                            <td><strong>${r.name}</strong></td>
                            <td>${r.author}</td>
                            <td>--</td>
                            <td>--</td>
                            <td>--</td>
                            <td><span class="status-badge-err">⚠️ ${r.errors}</span></td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
            }

            if (btnConfirm) {
                if (validRows.length > 0) {
                    btnConfirm.disabled = false;
                    btnConfirm.style.opacity = '1';
                    btnConfirm.style.cursor = 'pointer';
                    if (confirmCount) confirmCount.textContent = validRows.length;
                } else {
                    btnConfirm.disabled = true;
                    btnConfirm.style.opacity = '0.5';
                    btnConfirm.style.cursor = 'not-allowed';
                    if (confirmCount) confirmCount.textContent = '0';
                    alert('⚠️ Không tìm thấy dòng dữ liệu nào hợp lệ trong file Excel. Vui lòng kiểm tra lại cột thông tin!');
                }
            }
        } catch (err) {
            console.error('Lỗi đọc file Excel:', err);
            alert(err.message || 'Không thể phân tích dữ liệu từ file Excel này.');
        }
    }

    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            if (!parsedValidRows || parsedValidRows.length === 0) return;

            btnConfirm.disabled = true;
            if (progressBox) progressBox.style.display = 'block';
            if (previewSection) previewSection.style.display = 'none';

            let successCount = 0;

            for (let i = 0; i < parsedValidRows.length; i++) {
                const book = parsedValidRows[i];
                if (progressText) {
                    progressText.textContent = `Đang lưu (${i + 1}/${parsedValidRows.length}): ${book.name}...`;
                }

                try {
                    const payload = {
                        name: book.name,
                        author: book.author,
                        categoryId: book.categoryId,
                        price: book.price,
                        stock: book.stock,
                        discountPercent: book.discountPercent,
                        description: book.description,
                        image: book.image,
                        tag: book.tag,
                        isNew: true,
                        importDate: new Date().toISOString(),
                        soldCount: 0,
                        sellerId: null,
                        sellerName: 'Trí Tuệ Book Official'
                    };

                    await productService.create(payload);
                    successCount++;
                } catch (e) {
                    console.error(`Lỗi khi tạo sách #${book.name}:`, e);
                }
            }

            alert(`🎉 Đã nhập thành công ${successCount}/${parsedValidRows.length} cuốn sách vào kho hệ thống!`);
            closeModal();

            try {
                allBooks = await productService.getAll();
                renderBooks(allBooks);
                updateStats();
            } catch (e) {
                console.warn('Lỗi refresh danh sách sau khi import:', e);
            }
        });
    }
}

setupRevenueDashboardControls();
setupAdminExcelImport();
initAdmin();
