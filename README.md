# 📚 ĐỒ ÁN: WEBSITE THƯƠNG MẠI ĐIỆN TỬ NHÀ SÁCH TRỰC TUYẾN — TRÍ TUỆ BOOK

> **Học phần:** Lập trình JavaScript (JavaScript Programming)  
> **Sinh viên thực hiện:** Nguyễn Văn Hiếu — **MSSV:** 501250367  
> **Hình thức thực hiện:** Đồ án cá nhân (Individual Project)  
> **Live Demo (Production):** https://nhasach-psi.vercel.app  
> **Repository:** https://github.com/hieunguyenpro1919/nhasach  
> **Kiến trúc hệ thống:** Vite 6 (MPA 10 trang) + Vanilla JavaScript ES6+ + **Supabase Backend** (PostgreSQL, Supabase Auth JWT, RLS, Triggers, RPC, Storage CDN, Realtime) + **Vercel**

---

## 📖 I. GIỚI THIỆU TỔNG QUAN ĐỀ TÀI

### 1. Bối cảnh & Mục tiêu
Dự án **"Trí Tuệ Book"** là nền tảng thương mại điện tử chuyên ngành sách theo mô hình sàn đa gian hàng (**Multi-role Marketplace**), vận hành đầy đủ từ giao diện mua sắm, quản lý giỏ hàng/khuyến mãi, quy trình xử lý đơn hàng đến trang quản trị dành cho Người bán (**Seller**) và Quản trị viên (**Admin**).

Hệ thống được phát triển trọn vẹn theo hướng **Fullstack thực tế**:
- **Frontend thuần ES6+ (Zero UI Framework):** HTML5 ngữ nghĩa, CSS3 thiết kế theo từng mô-đun, JavaScript ES Modules phân tầng rõ ràng (**View → Page Controller → Service → Infrastructure**), đóng gói đa trang (MPA) bằng Vite 6.
- **Backend Production trên Supabase:**
  - **PostgreSQL (11 bảng quan hệ)** với các hàm **RPC `SECURITY DEFINER`** (`place_order`, `toggle_review_like`, `add_review_reply`, `get_chat_contacts`, `lookup_guest_order`) đảm bảo tính toàn vẹn giá bán, tồn kho và lượt dùng voucher phía server.
  - **Supabase Auth (JWT thật):** Xác thực phiên đăng nhập bằng JSON Web Token, hỗ trợ đăng ký tài khoản (khách hàng / gian hàng) và đặt lại mật khẩu qua liên kết Email thật (`PASSWORD_RECOVERY`).
  - **Row Level Security (RLS) & DB Triggers:** Bảo vệ từng dòng dữ liệu theo vai trò (`customer`, `seller`, `admin`), chặn leo thang đặc quyền và chặn sửa đổi giá trị đơn hàng từ phía trình duyệt.
  - **Supabase Storage (`uploads` bucket) & Realtime:** Lưu trữ ảnh bìa sách/avatar lên CDN và đẩy thông báo đơn hàng + chat nội bộ theo thời gian thực.
- **Chế độ dự phòng Offline Fallback:** Tự động chuyển về REST API cục bộ (`json-server` + `db.json` cổng `3000` qua `start.bat`) khi không cấu hình biến môi trường Supabase.

---

## 👥 II. ĐỐI TƯỢNG NGƯỜI DÙNG & PHÂN QUYỀN HỆ THỐNG

| Vai trò | Phân vùng hoạt động | Quyền hạn chính (Bảo vệ bằng JWT + RLS) |
|:---|:---|:---|
| 👤 **Khách hàng (`customer`)** | `index.html`, `product-detail.html`, `cart.html`, `orders.html`, `wishlist.html`, `profile.html` | • Xem, tìm kiếm, lọc sách theo danh mục, giá, Flash Sale, độ bán chạy.<br>• Lưu sách yêu thích (Wishlist riêng tư theo `userId`).<br>• Đánh giá 1–5 sao (gắn nhãn Đã mua hàng nếu có đơn hoàn thành), bình luận, Thích & Trả lời lồng nhau.<br>• Đặt hàng, áp mã giảm giá (tính & kiểm tra trên server), xem mô phỏng QR thanh toán, xuất hóa đơn PDF.<br>• Theo dõi đơn hàng của chính mình, nhận thông báo Realtime, chat AI Gemini & chat nội bộ với Shop/Admin.<br>• Cập nhật hồ sơ, upload avatar lên Supabase Storage, đổi mật khẩu. |
| 🏪 **Người bán (`seller`)** | Kênh Người bán (`pages/seller.html`) | • Đăng, chỉnh sửa, xóa sách **thuộc riêng gian hàng mình** (`sellerId = current_app_user_id()`).<br>• Xem và cập nhật trạng thái các đơn hàng có sản phẩm của Shop mình.<br>• Thống kê doanh thu Shop, Import hàng loạt đầu sách từ Excel (`.xlsx`).<br>• Chat trực tiếp với khách hàng quan tâm sản phẩm. |
| 👑 **Quản trị viên (`admin`)** | Admin Portal (`pages/admin.html`) | • Toàn quyền quản lý danh mục, kho sách toàn sàn, đơn hàng, người dùng (khóa/mở khóa tài khoản/shop, phân quyền).<br>• Thiết lập chiến dịch **Flash Sale** đếm ngược thời gian thực & quản lý **Coupons/Vouchers**.<br>• Thống kê doanh thu toàn sàn, xuất báo cáo đơn hàng & kho sách ra Excel (`.xlsx`). |

---

## 🛠️ III. CÔNG NGHỆ & THƯ VIỆN SỬ DỤNG

- **Frontend:** HTML5, CSS3 (Responsive PC/Tablet/Mobile, Dark/Light Mode + Anti-FOUC), Vanilla JavaScript ES6+ Modules.
- **Build Tool & Hosting:** [Vite 6](https://vitejs.dev/) (Multi-Page App), [Vercel](https://vercel.com/) (`vercel.json`).
- **Backend & Database:** [Supabase](https://supabase.com/) (`@supabase/supabase-js` v2 — PostgreSQL, Auth JWT, RLS, Triggers, RPC, Storage, Realtime).
- **Offline Mock Fallback:** [Axios](https://axios-http.com/) + `json-server` (`db.json`, cổng `3000`).
- **AI & Tiện ích:** Google Gemini API (Lightweight RAG tư vấn sách ở `aiService.js`), `html2pdf.js` (xuất hóa đơn A4 PDF), `xlsx` SheetJS (Import/Export Excel `.xlsx`).

---

## 🗂️ IV. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
nhasach/
├── index.html                          # Trang chủ (Cửa hàng, Kệ sách, Tìm kiếm, Flash Sale)
├── pages/                              # 9 trang chức năng độc lập (Multi-Page App)
│   ├── product-detail.html             # Chi tiết sách, Đánh giá sao, Like & Reply lồng nhau
│   ├── cart.html                       # Giỏ hàng, Áp mã Voucher, Thanh toán COD / VietQR Demo
│   ├── orders.html                     # Lịch sử đơn hàng, Đánh giá sau nhận hàng & Xuất PDF
│   ├── wishlist.html                   # Danh sách sách yêu thích theo tài khoản
│   ├── profile.html                    # Hồ sơ cá nhân, Upload Avatar & Đổi mật khẩu
│   ├── seller.html                     # Kênh Người bán (Quản lý sách, Đơn Shop & Import Excel)
│   ├── admin.html                      # Dashboard Quản trị toàn sàn (Đơn, Sách, User, Sale, Coupon)
│   ├── login.html                      # Đăng nhập Supabase Auth & Khôi phục mật khẩu qua Email
│   └── dangky.html                     # Đăng ký tài khoản Khách hàng / Gian hàng Seller
│
├── src/
│   ├── api/
│   │   ├── supabaseClient.js           # Khởi tạo Supabase Client (Auth persist, Realtime, Storage)
│   │   └── client.js                   # Axios Client dự phòng cho json-server (:3000)
│   ├── assets/                         # Dual Logo SVG (Sáng / Tối)
│   ├── css/                            # Stylesheet theo từng trang & mô-đun
│   │   ├── style.css, dark-theme.css, mobile-nav.css, logo.css
│   │   ├── detail.css, cart.css, orders.css, wishlist.css, profile.css
│   │   ├── admin.css, seller.css, auth.css
│   │   └── chatbot.css, internalChat.css, notifications.css, excelImport.css
│   ├── services/                       # Tầng nghiệp vụ & truy cập dữ liệu (Supabase + Fallback)
│   │   ├── authService.js              # Đăng nhập JWT, đồng bộ phiên, đăng ký, đổi/reset pass
│   │   ├── productService.js           # CRUD sách & tồn kho
│   │   ├── orderService.js             # Tạo đơn qua RPC place_order, cập nhật trạng thái, tra cứu
│   │   ├── categoryService.js          # Quản lý thể loại sách
│   │   ├── menuService.js              # Menu điều hướng động
│   │   ├── saleService.js              # Chiến dịch Flash Sale & tính giá giảm
│   │   ├── couponService.js            # Kiểm tra điều kiện & quản lý Voucher
│   │   ├── reviewService.js            # Đánh giá, Verified Purchase, toggleLike & addReply RPC
│   │   ├── wishlistService.js          # Quản lý sách yêu thích
│   │   ├── notificationService.js      # Thông báo biến động đơn hàng & Realtime
│   │   ├── internalChatService.js      # Danh bạ an toàn & hội thoại nội bộ
│   │   ├── cartService.js              # Quản lý giỏ hàng theo user trên LocalStorage
│   │   ├── aiService.js                # Kết nối Google Gemini API
│   │   └── botService.js               # Chatbot tư vấn sách (Lightweight RAG + tra cứu đơn)
│   ├── utils/
│   │   ├── format.js                   # Format tiền VND, ngày giờ, escapeHtml
│   │   ├── storage.js                  # Quản lý cache hồ sơ phiên hiện tại
│   │   ├── pagination.js               # Phân trang dùng chung cho bảng Admin/Seller
│   │   ├── imageUpload.js              # Nén ảnh Canvas + Upload Supabase Storage
│   │   ├── excelExport.js              # Xuất kho sách & báo cáo doanh thu ra .xlsx
│   │   └── excelImport.js              # Đọc, validate & Import hàng loạt từ .xlsx
│   └── js/                             # Page Controllers tương ứng từng trang & Widget
│       ├── home.js, detail.js, cart.js, orders.js, wishlist.js, profile.js
│       ├── admin.js, seller.js, login.js, register.js
│       └── mobileNav.js, chatWidget.js, internalChat.js, notificationBell.js, themeToggle.js
│
├── supabase/
│   ├── schema.sql                      # Schema PostgreSQL đầy đủ (11 bảng, Triggers, RPC, RLS, Storage)
│   ├── migration_real_auth.sql         # Migration nâng cấp Supabase Auth + RLS chuẩn Production
│   └── seed.mjs                        # Script nạp dữ liệu mẫu từ db.json + đồng bộ auth.users
├── docs/                               # Bộ tài liệu thiết kế Kiến trúc, CSDL, API & Workflow
├── LOG/ & BUG/                         # Nhật ký tiến độ & khắc phục lỗi kỹ thuật
├── .env.example                        # Mẫu biến môi trường Supabase
├── vercel.json                         # Cấu hình deploy Vite MPA trên Vercel
├── vite.config.js                      # Cấu hình 10 HTML entry points
├── db.json                             # Dữ liệu mẫu nguồn cho seed.mjs & chế độ offline fallback
├── package.json                        # Thư viện & scripts (dev, build, server)
└── start.bat                           # Script Windows bật nhanh vite + json-server
```

---

## 🚀 V. HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH

### Chế độ 1: Chạy Fullstack với Supabase + Deploy Vercel (Mặc định)

1. **Cài đặt thư viện:**
   ```bash
   npm install
   ```
2. **Khởi tạo cơ sở dữ liệu trên Supabase:**
   - Tạo project trên Supabase, mở **SQL Editor**, chạy toàn bộ nội dung file [`supabase/schema.sql`](supabase/schema.sql) (nếu nâng cấp từ bản cũ chưa bật Auth JWT, chạy [`supabase/migration_real_auth.sql`](supabase/migration_real_auth.sql)).
   - Trong **Authentication → URL Configuration**, cấu hình **Site URL** và **Redirect URLs** (`https://<domain>.vercel.app/**`, `http://localhost:5173/**`).
3. **Cấu hình biến môi trường `.env`:**
   - Copy `.env.example` thành `.env` và điền `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (chỉ dùng chạy seed ở máy local, **không** đưa lên frontend hoặc Git).
4. **Nạp dữ liệu mẫu & tài khoản lên Supabase Auth + PostgreSQL:**
   ```bash
   node supabase/seed.mjs
   ```
5. **Chạy local hoặc build production:**
   ```bash
   npm run dev     # Mở http://localhost:5173
   npm run build   # Build bản production ra thư mục dist/
   ```
6. **Deploy Vercel:** Kết nối GitHub repo với Vercel, preset `Vite`, Output `dist`, khai báo 2 biến môi trường `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.

### Chế độ 2: Chạy Offline cục bộ với `json-server` (Không cần mạng / Supabase)
Nếu xóa hoặc để trống biến môi trường Supabase trong `.env`, hệ thống tự chuyển sang chế độ offline qua `http://localhost:3000`:
- Nhấp đúp [`start.bat`](start.bat) (trên Windows), hoặc chạy song song 2 terminal: `npm run server` và `npm run dev`.

---

## ✨ VI. BẢNG TỔNG HỢP TÍNH NĂNG HOÀN THIỆN

| STT | Tính năng | Trạng thái | Điểm nổi bật về kỹ thuật |
|:---:|:---|:---:|:---|
| **1** | **Xác thực Supabase Auth & Bảo mật RLS** | ✅ Production | JWT thật (`signInWithPassword`, `signUp`), đặt lại mật khẩu qua link Email thật (`PASSWORD_RECOVERY`), RLS khóa dữ liệu cả 11 bảng + Storage bucket `uploads`, Trigger DB chống leo thang `role` & chống sửa tiền đơn hàng. |
| **2** | **Đặt hàng nguyên tử (Atomic Checkout)** | ✅ Production | RPC `place_order` khóa dòng (`FOR UPDATE`), kiểm tra tồn kho, tự tính giá gốc / Flash Sale / Voucher phía server, trừ kho và cộng lượt dùng coupon nguyên tử. |
| **3** | **Upload ảnh bìa sách & Avatar thật** | ✅ Production | Nén ảnh tự động bằng HTML5 Canvas và upload thẳng lên **Supabase Storage** (`uploads` bucket) lấy URL CDN; yêu cầu đã xác thực mới được ghi Storage. |
| **4** | **Sách yêu thích (Wishlist)** | ✅ Hoàn thiện | Lưu riêng tư trên PostgreSQL theo tài khoản (`wishlist`), kiểm tra không cho Seller tự thêm/mua sách của chính gian hàng mình. |
| **5** | **Đánh giá & Bình luận đa cấp** | ✅ Hoàn thiện | Chấm 1–5 sao, tự xác định nhãn **Đã mua hàng** (`isVerifiedPurchase`), Like & Trả lời lồng nhau qua RPC an toàn `toggle_review_like` / `add_review_reply`. |
| **6** | **Kênh Chat kép (AI RAG + Chat nội bộ)** | ✅ Hoàn thiện | Chatbot AI Gemini (Lightweight RAG trên kho sách & tra cứu đơn) + Chat nội bộ Realtime qua `chat_messages` và RPC `get_chat_contacts` ẩn PII. |
| **7** | **Chuông thông báo Realtime** | ✅ Hoàn thiện | Nhận thông báo khi đặt hàng và khi Seller/Admin đổi trạng thái đơn hàng qua Supabase Realtime. |
| **8** | **Flash Sale & Mã giảm giá (Voucher)** | ✅ Hoàn thiện | Đếm ngược chiến dịch Flash Sale toàn sàn; mã giảm `%`, tiền mặt hoặc freeship có điều kiện tối thiểu & giới hạn lượt dùng. |
| **9** | **Báo cáo, Excel & Hóa đơn PDF** | ✅ Hoàn thiện | Thống kê doanh thu Admin/Seller, xuất báo cáo & kho sách ra `.xlsx`, Import hàng loạt từ Excel có xem trước/validate, xuất hóa đơn A4 PDF (`html2pdf.js`). |
| **10** | **Thanh toán COD & VietQR Demo** | ✅ An toàn | Hỗ trợ thanh toán COD và mô phỏng quy trình quét VietQR ngay trên giỏ hàng (không kết nối tài khoản ngân hàng thật để đảm bảo an toàn khi vận hành đồ án). |
| **11** | **Responsive đa thiết bị & Dark/Light Mode** | ✅ Hoàn thiện | Topbar 1 hàng gọn gàng trên mobile kèm Drawer điều hướng, theme Sáng/Tối đồng bộ với script Anti-FOUC. |

---

## 🔑 VII. TÀI KHOẢN KIỂM THỬ & BẢO MẬT

- Tài khoản mẫu được đồng bộ từ `db.json` sang `auth.users` và `app_users` thông qua `node supabase/seed.mjs` (không công khai mật khẩu quản trị trong mã nguồn hoặc tài liệu Git).
- Các vai trò mẫu hiện có trong hệ thống:
  - **Quản trị viên (`admin`):** `admin@bookstore.vn` *(mật khẩu được tạo ngẫu nhiên hoặc đọc từ biến `SEED_ADMIN_PASSWORD` trong `.env` local khi chạy `seed.mjs`)*.
  - **Người bán (`seller`):** `nxbtre@bookstore.vn`, `nhanam@bookstore.vn`, `trithuc@bookstore.vn`.
  - **Khách hàng (`customer`):** `vana@gmail.com` (có sẵn lịch sử đơn hàng & đánh giá mẫu), hoặc tự đăng ký tài khoản mới tại `pages/dangky.html`.
