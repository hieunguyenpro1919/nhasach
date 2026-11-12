import * as XLSX from 'xlsx';

/**
 * Tiện ích xuất dữ liệu sách ra file Excel (.xlsx) chuẩn cho Admin & Seller
 */
export const excelExportUtil = {
    /**
     * Xuất danh sách sách toàn sàn (Dành cho Admin)
     * @param {Array} books Danh sách sách cần xuất
     * @param {Array} categories Danh mục sách
     */
    exportAdminBooks(books, categories = []) {
        if (!books || books.length === 0) {
            alert('⚠️ Không có sản phẩm nào để xuất ra file Excel.');
            return;
        }

        const worksheetData = books.map((book, index) => {
            const cat = categories.find(c => Number(c.id) === Number(book.categoryId));
            const catName = cat ? cat.name : 'Khác';
            const stock = Number(book.stock !== undefined ? book.stock : 0);
            const discount = Number(book.discountPercent || 0);

            let stockStatus = 'Còn hàng';
            if (stock <= 0) stockStatus = 'Hết hàng (0)';
            else if (stock < 10) stockStatus = `Sắp hết (${stock})`;

            return {
                "STT": index + 1,
                "Mã sách": book.id,
                "Tên tác phẩm": book.name || '',
                "Tác giả": book.author || 'Chưa cập nhật',
                "Thể loại": catName,
                "Nguồn sách / Nhà bán": book.sellerName || 'NXB Trẻ Official',
                "Giá niêm yết (₫)": Number(book.price || 0),
                "Giảm giá (%)": discount > 0 ? `${discount}%` : 'Không',
                "Tồn kho thực tế": stock,
                "Số lượng đã bán": Number(book.soldCount || 0),
                "Trạng thái kho": stockStatus,
                "Khuyến mãi": (book.onSale && discount > 0) ? 'Đang Flash Sale' : 'Giá thường',
                "Ngày nhập kho": book.importDate ? new Date(book.importDate).toLocaleDateString('vi-VN') : '',
                "Link hình ảnh": book.image || ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);

        // Thiết lập độ rộng cột (Column Widths) trực quan
        worksheet['!cols'] = [
            { wch: 6 },  // STT
            { wch: 10 }, // Mã sách
            { wch: 38 }, // Tên tác phẩm
            { wch: 24 }, // Tác giả
            { wch: 22 }, // Thể loại
            { wch: 24 }, // Nhà bán
            { wch: 16 }, // Giá niêm yết
            { wch: 14 }, // Giảm giá
            { wch: 16 }, // Tồn kho
            { wch: 16 }, // Đã bán
            { wch: 18 }, // Trạng thái kho
            { wch: 16 }, // Khuyến mãi
            { wch: 15 }, // Ngày nhập
            { wch: 45 }  // Link ảnh
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Kho Sách Toàn Sàn");

        const dateStr = getFormattedDate();
        const fileName = `danh_sach_sach_toan_san_${dateStr}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    },

    /**
     * Xuất danh sách sách của riêng một Gian Hàng (Dành cho Seller)
     * @param {Array} books Danh sách sách của shop
     * @param {Array} categories Danh mục sách
     * @param {string} shopName Tên gian hàng
     */
    exportSellerBooks(books, categories = [], shopName = 'gian_hang') {
        if (!books || books.length === 0) {
            alert('⚠️ Gian hàng của bạn hiện chưa có sách để xuất ra file Excel.');
            return;
        }

        const worksheetData = books.map((book, index) => {
            const cat = categories.find(c => Number(c.id) === Number(book.categoryId));
            const catName = cat ? cat.name : 'Khác';
            const stock = Number(book.stock !== undefined ? book.stock : 0);
            const discount = Number(book.discountPercent || 0);
            const price = Number(book.price || 0);
            const soldCount = Number(book.soldCount || 0);
            const estimatedRevenue = price * soldCount;

            let stockStatus = 'Còn hàng';
            if (stock <= 0) stockStatus = 'Hết hàng (0)';
            else if (stock < 10) stockStatus = `Sắp hết (${stock})`;

            return {
                "STT": index + 1,
                "Mã sách": book.id,
                "Tên tác phẩm": book.name || '',
                "Tác giả": book.author || 'Chưa cập nhật',
                "Thể loại": catName,
                "Giá niêm yết (₫)": price,
                "Giảm giá (%)": discount > 0 ? `${discount}%` : 'Không',
                "Tồn kho thực tế": stock,
                "Số lượng đã bán": soldCount,
                "Doanh thu ước tính (₫)": estimatedRevenue,
                "Trạng thái kho": stockStatus,
                "Khuyến mãi": (book.onSale && discount > 0) ? 'Đang Sale' : 'Không',
                "Link hình ảnh": book.image || ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);

        // Thiết lập độ rộng cột trực quan
        worksheet['!cols'] = [
            { wch: 6 },  // STT
            { wch: 10 }, // Mã sách
            { wch: 38 }, // Tên tác phẩm
            { wch: 24 }, // Tác giả
            { wch: 22 }, // Thể loại
            { wch: 16 }, // Giá niêm yết
            { wch: 14 }, // Giảm giá
            { wch: 16 }, // Tồn kho
            { wch: 16 }, // Đã bán
            { wch: 22 }, // Doanh thu ước tính
            { wch: 18 }, // Trạng thái kho
            { wch: 16 }, // Khuyến mãi
            { wch: 45 }  // Link ảnh
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sách Gian Hàng");

        const dateStr = getFormattedDate();
        const safeShopName = (shopName || 'shop').replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_').toLowerCase();
        const fileName = `danh_sach_sach_${safeShopName}_${dateStr}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    },

    /**
     * Xuất báo cáo Thống kê Doanh thu toàn sàn ra file Excel nhiều Sheet
     * @param {Object} report { periodLabel, summary, sellerList, catList, topBooks }
     */
    exportRevenueReport(report = {}) {
        const {
            periodLabel = 'Tất cả thời gian',
            summary = {},
            sellerList = [],
            catList = [],
            topBooks = []
        } = report;

        const workbook = XLSX.utils.book_new();

        const summaryRows = [
            { "Chỉ tiêu tài chính": "Kỳ báo cáo", "Giá trị": periodLabel },
            { "Chỉ tiêu tài chính": "Tổng GMV thực thu (₫)", "Giá trị": Number(summary.totalGmv || 0) },
            { "Chỉ tiêu tài chính": "Tiền hàng trước giảm giá (₫)", "Giá trị": Number(summary.totalItemsRevenue || 0) },
            { "Chỉ tiêu tài chính": "Tổng phí vận chuyển (₫)", "Giá trị": Number(summary.totalShipping || 0) },
            { "Chỉ tiêu tài chính": "Tổng trợ giá Voucher (₫)", "Giá trị": Number(summary.totalDiscount || 0) },
            { "Chỉ tiêu tài chính": "Giá trị trung bình mỗi đơn - AOV (₫)", "Giá trị": Number(summary.avgOrderValue || 0) },
            { "Chỉ tiêu tài chính": "Số đơn thành công", "Giá trị": Number(summary.successCount || 0) },
            { "Chỉ tiêu tài chính": "Tổng đơn trong kỳ", "Giá trị": Number(summary.totalOrdersCount || 0) },
            { "Chỉ tiêu tài chính": "Số đơn đã hủy", "Giá trị": Number(summary.cancelledCount || 0) },
            { "Chỉ tiêu tài chính": "Tổng số sách đã bán (cuốn)", "Giá trị": Number(summary.totalBooksSold || 0) }
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        wsSummary['!cols'] = [{ wch: 38 }, { wch: 24 }];
        XLSX.utils.book_append_sheet(workbook, wsSummary, "Tong_Quan");

        const totalBase = Number(summary.totalItemsRevenue || 0);
        const sellerRows = sellerList.map((s, idx) => ({
            "Hạng": idx + 1,
            "Nhà bán hàng": s.name,
            "Số đầu sách": s.bookCount,
            "Số đơn": s.orderCount || 0,
            "Số cuốn bán": s.soldCount,
            "Doanh số tiền hàng (₫)": s.revenue,
            "Tỷ trọng (%)": totalBase > 0 ? Math.round((s.revenue / totalBase) * 100) : 0
        }));
        const wsSellers = XLSX.utils.json_to_sheet(sellerRows.length ? sellerRows : [{ "Thông báo": "Chưa có dữ liệu nhà bán" }]);
        wsSellers['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(workbook, wsSellers, "Theo_Nha_Ban");

        const catRows = catList.map((c, idx) => ({
            "STT": idx + 1,
            "Thể loại": c.name,
            "Số cuốn bán": c.soldCount,
            "Doanh số tiền hàng (₫)": c.revenue,
            "Tỷ trọng (%)": totalBase > 0 ? Math.round((c.revenue / totalBase) * 100) : 0
        }));
        const wsCats = XLSX.utils.json_to_sheet(catRows.length ? catRows : [{ "Thông báo": "Chưa có dữ liệu thể loại" }]);
        wsCats['!cols'] = [{ wch: 8 }, { wch: 28 }, { wch: 14 }, { wch: 22 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(workbook, wsCats, "Theo_The_Loai");

        const bookRows = topBooks.map((b, idx) => ({
            "Hạng": idx + 1,
            "Mã sách": b.id,
            "Tên sách": b.name,
            "Nhà bán": b.sellerName,
            "Số cuốn bán": b.soldCount,
            "Doanh số (₫)": b.revenue,
            "Tỷ trọng (%)": totalBase > 0 ? Math.round((b.revenue / totalBase) * 100) : 0
        }));
        const wsBooks = XLSX.utils.json_to_sheet(bookRows.length ? bookRows : [{ "Thông báo": "Chưa có dữ liệu sách bán" }]);
        wsBooks['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 36 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(workbook, wsBooks, "Top_Sach_Ban_Chay");

        const fileName = `bao_cao_doanh_thu_${getFormattedDate()}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    }
};

function getFormattedDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${y}${m}${d}_${h}${min}`;
}
