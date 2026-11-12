# 🏗️ Software Architecture Design — Nhà Sách Trí Tuệ Book

> [!NOTE]
> **Tài liệu Thiết Kế Kiến Trúc Phần Mềm (Software Architecture Design Document)** cho hệ thống Website Thương mại điện tử Nhà sách Trí Tuệ Book.
>
> **Sinh viên thực hiện:** Nguyễn Văn Hiếu — **MSSV:** 501250367  
> **Học phần:** Lập trình JavaScript (JavaScript Programming)  
> **Hình thức:** Đồ án cá nhân (Individual Project)  
> **Mô hình kiến trúc:** Modular Layered Architecture (Vite Multi-Page App + ES6+ Modules) kết nối **Supabase Backend** (PostgreSQL, Auth JWT, RLS, RPC, Storage, Realtime) và **Vercel Hosting** (hỗ trợ Offline Fallback qua `json-server`).

---

## 1. 🌐 High-Level System Architecture (Kiến Trúc Tổng Quan)

Hệ thống áp dụng mô hình **Kiến trúc phân tầng hướng dịch vụ (Modular Layered Architecture)** với hai đường truyền dữ liệu ở tầng Infrastructure: mặc định chạy trực tiếp với **Supabase Production Cloud** thông qua JWT xác thực và tự động fallback sang **`json-server` (:3000)** khi chạy offline.

```mermaid
flowchart TD
    USER["👤 Khách hàng\n(Web Browser)"]
    SELLER["🏪 Đối tác bán hàng\n(Seller Portal)"]
    ADMIN["👑 Quản trị viên\n(Admin Portal)"]

    subgraph PRESENTATION["🖥️ Presentation Layer (Vite MPA - 10 HTML Pages)"]
        PUB_PAGES["Public & Shop Pages\n(index, product-detail, cart, wishlist)"]
        AUTH_PAGES["Auth & Profile Pages\n(login, dangky, profile, orders)"]
        DASH_PAGES["Role Dashboards\n(admin.html, seller.html)"]
    end

    subgraph CONTROLLER["🎮 Controller & Widget Layer (src/js/*.js)"]
        PAGE_CTRLS["Page Controllers\n(home, detail, cart, orders, wishlist, profile, admin, seller, login, register)"]
        WIDGET_CTRLS["Global UI & Widgets\n(mobileNav, chatWidget, internalChat, notificationBell, themeToggle)"]
    end

    subgraph SERVICE["⚙️ Service Layer (src/services/*.js & src/utils/*.js)"]
        CORE_SVC["Core Business Services\n(authService, productService, orderService, cartService)"]
        ENGAGE_SVC["Engagement & Promo Services\n(reviewService, wishlistService, couponService, saleService)"]
        COMMS_SVC["Comms & AI Services\n(notificationService, internalChatService, botService, aiService)"]
        UTILS["Shared Utilities\n(imageUpload, excelImport, excelExport, pagination, format, storage)"]
    end

    subgraph INFRASTRUCTURE["📡 Infrastructure & Backend Layer"]
        SUPA_SDK["Supabase Client (src/api/supabaseClient.js)\nJWT Persist + Auth + PostgREST + RPC + Storage + Realtime"]
        SUPA_CLOUD[("☁️ Supabase Cloud\nPostgreSQL + RLS + Triggers\nAuth Users + Storage 'uploads'")]
        AXIOS["Axios Fallback (src/api/client.js :3000)"]
        JSON_SRV[("🗄️ Offline Fallback\njson-server + db.json")]
    end

    USER --> PUB_PAGES
    USER --> AUTH_PAGES
    SELLER --> DASH_PAGES
    ADMIN --> DASH_PAGES

    PUB_PAGES --> PAGE_CTRLS
    AUTH_PAGES --> PAGE_CTRLS
    DASH_PAGES --> PAGE_CTRLS
    PUB_PAGES --> WIDGET_CTRLS

    PAGE_CTRLS --> CORE_SVC
    PAGE_CTRLS --> ENGAGE_SVC
    WIDGET_CTRLS --> COMMS_SVC
    CORE_SVC --> UTILS
    ENGAGE_SVC --> UTILS

    CORE_SVC --> SUPA_SDK
    ENGAGE_SVC --> SUPA_SDK
    COMMS_SVC --> SUPA_SDK
    SUPA_SDK --> SUPA_CLOUD

    CORE_SVC -.->|"Offline Fallback"| AXIOS
    AXIOS -.-> JSON_SRV
```

---

## 2. 📂 Project Directory Structure (Cấu Trúc Thư Mục Dự Án)

```text
nhasach/
├── index.html                          # Trang chủ (Entry Point)
├── pages/                              # 9 trang chức năng độc lập (Multi-Page Application)
│   ├── product-detail.html             # Chi tiết sách, Đánh giá sao, Like & Reply lồng nhau
│   ├── cart.html                       # Giỏ hàng, Coupon & Thanh toán COD / VietQR Demo
│   ├── orders.html                     # Lịch sử đơn hàng, Đánh giá nhận hàng & In PDF
│   ├── wishlist.html                   # Sách yêu thích riêng tư theo tài khoản
│   ├── profile.html                    # Hồ sơ cá nhân, Upload Avatar & Đổi mật khẩu
│   ├── seller.html                     # Kênh Người bán (Kho sách, Đơn Shop & Import Excel)
│   ├── admin.html                      # Dashboard Quản trị toàn sàn
│   ├── login.html                      # Đăng nhập Supabase Auth & Quên mật khẩu Email thật
│   └── dangky.html                     # Đăng ký tài khoản Người mua / Gian hàng Seller
│
├── src/
│   ├── api/
│   │   ├── supabaseClient.js           # Client Supabase chính + createStatelessSupabaseClient()
│   │   └── client.js                   # Axios client dự phòng cổng 3000
│   ├── assets/                         # Logo SVG đối ngẫu (logo-light.svg, logo-dark.svg)
│   ├── css/                            # Stylesheet theo từng trang và thành phần
│   │   ├── style.css, dark-theme.css, mobile-nav.css, logo.css
│   │   ├── detail.css, cart.css, orders.css, wishlist.css, profile.css
│   │   ├── admin.css, seller.css, auth.css
│   │   └── chatbot.css, internalChat.css, notifications.css, excelImport.css
│   ├── services/                       # 14 Business & Data Access Services
│   │   ├── authService.js              # Supabase Auth JWT, syncSession, phân quyền, đổi pass
│   │   ├── productService.js           # CRUD sách, cập nhật tồn kho & lượt bán
│   │   ├── orderService.js             # Đặt hàng qua RPC place_order, cập nhật trạng thái, tra cứu
│   │   ├── categoryService.js          # Danh mục thể loại sách
│   │   ├── menuService.js              # Menu điều hướng động
│   │   ├── saleService.js              # Chiến dịch Flash Sale & tính giá giảm
│   │   ├── couponService.js            # Kiểm tra điều kiện & quản lý Voucher
│   │   ├── reviewService.js            # Đánh giá, Verified Purchase, toggleLike & addReply RPC
│   │   ├── wishlistService.js          # Quản lý sách yêu thích
│   │   ├── notificationService.js      # Chuông thông báo & đồng bộ Realtime
│   │   ├── internalChatService.js      # Danh bạ an toàn (get_chat_contacts RPC) & tin nhắn
│   │   ├── cartService.js              # Quản lý giỏ hàng theo user trên LocalStorage
│   │   ├── aiService.js                # Giao tiếp Google Gemini API
│   │   └── botService.js               # Chatbot AI tư vấn sách Lightweight RAG
│   ├── utils/                          # 6 Utilities dùng chung
│   │   ├── format.js                   # Format tiền VND, ngày giờ, escapeHtml
│   │   ├── storage.js                  # Cache hồ sơ user trên trình duyệt
│   │   ├── pagination.js               # Phân trang dùng chung
│   │   ├── imageUpload.js              # Nén ảnh Canvas + Upload Supabase Storage
│   │   ├── excelExport.js              # Xuất kho sách & doanh thu ra .xlsx
│   │   └── excelImport.js              # Đọc & kiểm tra file Excel .xlsx trước khi nhập kho
│   └── js/                             # 15 Page Controllers & Global UI Modules
│       ├── home.js, detail.js, cart.js, orders.js, wishlist.js, profile.js
│       ├── admin.js, seller.js, login.js, register.js
│       └── mobileNav.js, chatWidget.js, internalChat.js, notificationBell.js, themeToggle.js
│
├── supabase/
│   ├── schema.sql                      # Schema đầy đủ (11 bảng, Triggers, RPC, RLS, Storage)
│   ├── migration_real_auth.sql         # Migration nâng cấp Auth JWT + RLS cho DB hiện hữu
│   └── seed.mjs                        # Script đồng bộ auth.users + dữ liệu mẫu từ db.json
├── docs/                               # Tài liệu Kiến trúc, Database, API & Workflow
├── vite.config.js                      # Build config cho 10 HTML entry points
├── vercel.json                         # Static hosting & rewrite trên Vercel
└── package.json
```

---

## 3. 🧱 Layer Responsibility (Trách Nhiệm Từng Tầng Kiến Trúc)

```mermaid
flowchart LR
    subgraph PRESENTATION["🖥️ View Layer"]
        HTML["HTML5 Templates\n(index.html & pages/*.html)"]
        CSS["Modular CSS\n(src/css/*.css)"]
    end

    subgraph CONTROLLER["🎮 Controller Layer"]
        JS_PAGE["Page & Widget Controllers\n(src/js/*.js)"]
    end

    subgraph SERVICE["⚙️ Service Layer"]
        SERVICES["Business Services\n(src/services/*.js)"]
        UTILS["Shared Utilities\n(src/utils/*.js)"]
    end

    subgraph INFRA["🗄️ Infrastructure Layer"]
        SUPA["Supabase Client\n(Auth + PostgREST + RPC + Storage)"]
        STORAGE["LocalStorage\n(Giỏ hàng / Cache hồ sơ / Theme)"]
        FALLBACK["Axios Fallback (:3000)\n(json-server Offline)"]
    end

    HTML -->|"DOM Events"| JS_PAGE
    JS_PAGE -->|"Calls business methods"| SERVICES
    SERVICES -->|"Uses helpers"| UTILS
    SERVICES -->|"JWT Authenticated Calls"| SUPA
    SERVICES <-->|"Cart / Cache"| STORAGE
    SERVICES -.->|"If !isSupabaseEnabled"| FALLBACK
    JS_PAGE -->|"Render DOM"| HTML
```

| Tầng kiến trúc | Thành phần đại diện | Nhiệm vụ chính |
|:---|:---|:---|
| **View Layer** | HTML5, Modular CSS, Dark Theme, Mobile Nav | Giao diện 10 trang đa vai trò, Responsive Mobile Topbar 1 hàng & Drawer, chế độ Tối Cosmic Obsidian. |
| **Controller Layer** | `src/js/*.js` | Gọi `authService.syncSession()` kiểm tra JWT thật, lắng nghe DOM events, điều phối render & Realtime UI. |
| **Service Layer** | `src/services/*.js` + `src/utils/*.js` | Đóng gói nghiệp vụ; tự động ưu tiên gọi Supabase (RPC/PostgREST/Storage) và giữ khả năng fallback sang Axios nếu chạy offline. |
| **Infrastructure Layer** | `supabaseClient.js`, `client.js`, `storage.js` | Quản lý phiên JWT Supabase (`persistSession: true`), kết nối WebSocket Realtime, Storage CDN và LocalStorage. |

---

## 4. 🔄 Request-Response & Security Data Flow

```mermaid
sequenceDiagram
    actor User as 👤 Người dùng
    participant View as 🖥️ HTML / DOM
    participant Ctrl as 🎮 Controller (src/js/)
    participant Svc as ⚙️ Service (src/services/)
    participant Supa as ☁️ Supabase API (JWT)
    participant DB as 🗄️ PostgreSQL + RLS

    User->>View: Tương tác (Đăng nhập / Mua hàng / Quản trị)
    View->>Ctrl: Event Trigger
    Ctrl->>Svc: Gọi nghiệp vụ tương ứng
    Svc->>Supa: Gửi Request kèm JWT Authorization Header
    Supa->>DB: Giải mã auth.uid() & Kiểm tra Policy RLS / Trigger
    alt Hợp lệ
        DB-->>Supa: Thực thi Query / RPC SECURITY DEFINER
        Supa-->>Svc: JSON Response
        Svc-->>Ctrl: Dữ liệu sạch
        Ctrl->>View: Cập nhật DOM / Toast
    else Không đủ quyền hoặc giả mạo
        DB-->>Supa: Chặn theo RLS (0 dòng hoặc Exception)
        Supa-->>Svc: Error 401 / 403 / 42501
        Svc-->>Ctrl: Throw Error rõ ràng
        Ctrl->>View: Hiển thị cảnh báo / Redirect Login
    end
```

---

## 5. 🔐 Multi-Role Authentication, Email Recovery & RLS Guard Flow

Khác với bản mock ban đầu chỉ kiểm tra `localStorage` ở client, hệ thống hiện tại bảo vệ **2 lớp** (UI Guard + Database RLS/Trigger):

```mermaid
flowchart TD
    A["👤 Người dùng mở trang\n(admin.html / seller.html / profile.html / orders.html)"] --> B["authService.syncSession()"]
    B --> C{"JWT Session hợp lệ\ntrên Supabase Auth?"}

    C -- "Không có hoặc hết hạn" --> CLEAR["Xóa cache storage\nRedirect -> pages/login.html"]
    C -- "Có JWT hợp lệ" --> FETCH["Truy vấn app_users\ntheo auth_uid = auth.uid()"]
    FETCH --> LOCK{"Tài khoản bị khóa?"}
    LOCK -- "isLocked = true" --> SIGNOUT["signOut() + Chặn truy cập"]
    LOCK -- "Hợp lệ" --> ROLE{"Kiểm tra Role"}

    ROLE -- "Trang Admin nhưng role != admin" --> FORBID1["⛔ Chặn & Redirect login.html"]
    ROLE -- "Trang Seller nhưng role != seller" --> FORBID2["⛔ Chặn & Redirect login.html"]
    ROLE -- "Đúng vai trò" --> ALLOW["✅ Cho phép tải dữ liệu\n(Mọi query đều bị RLS lọc theo auth.uid())"]

    style CLEAR fill:#ffa94d,color:#fff
    style SIGNOUT fill:#ff6b6b,color:#fff
    style FORBID1 fill:#ff6b6b,color:#fff
    style FORBID2 fill:#ff6b6b,color:#fff
    style ALLOW fill:#51cf66,color:#fff
```

- **Chống tự nâng quyền (Privilege Escalation Protection):** Trigger `handle_new_auth_user()` chỉ cho phép role `customer` hoặc `seller` khi tự đăng ký; Trigger `guard_app_user_update()` chặn mọi request không phải `admin` cố sửa `role`, `isLocked`, `status`, `shopStatus`.
- **Khôi phục mật khẩu thật:** Sử dụng `supabase.auth.resetPasswordForEmail()` gửi link có chữ ký một lần về hộp thư người dùng và kích hoạt sự kiện `PASSWORD_RECOVERY` trên `login.html`.

---

## 6. 🛒 Shopping Cart, Coupon & Atomic `place_order` Checkout Flow

```mermaid
flowchart TD
    A["👤 Khách chọn sách"] --> B["cartService.addToCart()\n(Chặn Seller tự mua sách mình)"]
    B --> C["Vào Giỏ hàng (pages/cart.html)"]
    C --> D{"Áp mã Coupon?"}
    D -- "Có" --> E["couponService.applyCoupon()\nKiểm tra điều kiện sơ bộ UI"]
    D -- "Không" --> F["Tính tạm tính + phí ship"]
    E --> F

    F --> G{"Chọn phương thức"}
    G -- "COD" --> H["Gọi orderService.createOrder(payload)"]
    G -- "VietQR (Demo)" --> I["Hiện QR Demo -> Xác nhận"] --> H

    H --> RPC["⚡ RPC place_order(p_order) trên PostgreSQL"]
    RPC --> VERIFY["Khóa dòng sản phẩm FOR UPDATE\nKiểm tra tồn kho, tự tính giá Flash Sale & Voucher\nLấy userId từ auth.uid(), ép shippingFee >= 0"]
    VERIFY --> ATOMIC["Trừ stock, tăng soldCount, tăng usedCount\nINSERT orders + INSERT notifications"]
    ATOMIC --> DONE["✅ Xóa giỏ hàng & Hiện mã đơn thành công"]

    style RPC fill:#4f46e5,color:#fff
    style DONE fill:#51cf66,color:#fff
```

---

## 7. 🤖 Dual Chat Architecture (AI RAG + Realtime Member Chat)

1. **AI Chatbot (`chatWidget.js` + `botService.js` + `aiService.js`):** Tư vấn sách dựa trên dữ liệu kho sách thực tế (Lightweight RAG kết hợp Google Gemini API do người dùng tùy chọn cấu hình key) và hỗ trợ tra cứu đơn hàng của tài khoản đang đăng nhập.
2. **Internal Member Chat (`internalChat.js` + `internalChatService.js`):**
   - Gọi RPC **`get_chat_contacts()`** chỉ trả về `id, name, role, avatar, shopName` (ẩn hoàn toàn email, số điện thoại, địa chỉ của người khác).
   - Tin nhắn lưu ở bảng `chat_messages` được RLS bảo vệ (`senderId = mình` hoặc `receiverId = mình`) và đồng bộ tức thì qua **Supabase Realtime**.

---

## 8. 🗺️ Page Navigation Map (10 Trang MPA)

```mermaid
flowchart TD
    HOME["🏠 Trang Chủ (index.html)"]
    DETAIL["📖 Chi Tiết Sách (pages/product-detail.html)"]
    CART["🛒 Giỏ Hàng (pages/cart.html)"]
    ORDERS["📦 Đơn Hàng (pages/orders.html)"]
    WISHLIST["❤️ Yêu Thích (pages/wishlist.html)"]
    PROFILE["👤 Hồ Sơ (pages/profile.html)"]
    LOGIN["🔑 Đăng Nhập (pages/login.html)"]
    REGISTER["📝 Đăng Ký (pages/dangky.html)"]
    ADMIN["👑 Admin Portal (pages/admin.html)"]
    SELLER["🏪 Seller Portal (pages/seller.html)"]

    HOME <--> DETAIL
    HOME <--> CART
    HOME <--> WISHLIST
    HOME <--> ORDERS
    HOME <--> PROFILE
    HOME <--> LOGIN
    LOGIN <--> REGISTER

    DETAIL --> CART
    CART --> ORDERS
    ORDERS --> DETAIL

    LOGIN -- "Role Admin" --> ADMIN
    LOGIN -- "Role Seller" --> SELLER
    ADMIN <--> HOME
    SELLER <--> HOME
```

---

## 9. ⚡ Cross-Cutting Concerns & Technical Highlights

1. **Anti-FOUC Dark Mode:** Script inline ngay trong `<head>` của cả 10 trang HTML đọc `localStorage.getItem('theme_mode')` để áp class `.dark` trước khi render.
2. **Unified Mobile Navigation (`mobileNav.js` & `mobile-nav.css`):** Tự động đồng bộ Header 1 hàng gọn trên mobile kèm Drawer trượt và phân quyền menu theo vai trò.
3. **Hiệu năng DOM:** Lazy Chunking cho kệ sách trang chủ, Load More khi tìm kiếm và Pagination dùng chung (`pagination.js`) cho các bảng dữ liệu lớn ở Admin/Seller.
4. **Xử lý Ảnh & Tài liệu:** Nén ảnh qua HTML5 Canvas rồi đẩy lên Supabase Storage (`imageUpload.js`); xuất hóa đơn A4 PDF (`html2pdf.js`); xuất/nhập kho Excel `.xlsx` (`xlsx`).
