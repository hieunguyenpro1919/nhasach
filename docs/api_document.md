# 📡 Tài Liệu Giao Tiếp API & Dịch Vụ (API & Service Reference)

> **Tài liệu kỹ thuật Giao tiếp Client — Supabase — Fallback REST API**
> **Tác giả**: Nguyễn Văn Hiếu — MSSV: `501250367`
> **Môi trường Production**: **Supabase JS SDK (`@supabase/supabase-js`)** giao tiếp với **Supabase Auth**, **PostgREST**, **PostgreSQL RPC**, **Storage** và **Realtime** (`https://nhasach-psi.vercel.app`).
> **Môi trường Offline Fallback**: Axios (`src/api/client.js`) kết nối `json-server` tại `http://localhost:3000` khi không cấu hình biến môi trường Supabase.

---

## 1. Kiến trúc Giao tiếp & Xác thực

### 1.1. Khởi tạo Client
- **Production (`src/api/supabaseClient.js`)**: Đọc `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`. Tự động đính kèm JWT Access Token của người dùng vào mọi request PostgREST, RPC và Storage.
- **Offline Fallback (`src/api/client.js`)**: Axios instance trỏ về `VITE_API_BASE_URL` (mặc định `http://localhost:3000`). Các service trong `src/services/` kiểm tra cờ `isSupabaseEnabled()` để định tuyến linh hoạt.

### 1.2. Header chuẩn khi gọi trực tiếp HTTP (PostgREST / RPC)
```http
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <USER_JWT_ACCESS_TOKEN>
Content-Type: application/json
```

---

## 2. Xác thực & Quản lý Tài khoản (`authService.js`)

Sử dụng trực tiếp **Supabase Auth** kết hợp đồng bộ hồ sơ từ bảng `public.app_users`.

| Phương thức Service | Cơ chế Supabase Auth / DB | Mô tả |
| :--- | :--- | :--- |
| `login(email, password)` | `supabase.auth.signInWithPassword(...)` + `SELECT app_users` | Đăng nhập lấy JWT thật, kiểm tra cờ `isLocked` trên `app_users`, lưu session cache. |
| `register(userData)` | `supabase.auth.signUp(...)` | Tạo tài khoản trong `auth.users`; Trigger `on_auth_user_created` tự sinh dòng `app_users` với `role = 'customer'`. |
| `requestPasswordReset(email)` | `supabase.auth.resetPasswordForEmail(email, { redirectTo })` | Gửi email chứa link khôi phục mật khẩu hợp lệ (redirect về `/pages/login.html`). |
| `completePasswordRecovery(newPassword)` | `supabase.auth.updateUser({ password })` | Hoàn tất đặt lại mật khẩu khi người dùng truy cập từ link recovery trong email. |
| `logout()` | `supabase.auth.signOut()` | Hủy JWT session trên Supabase và dọn dẹp `localStorage`. |
| `getCurrentUser()` | `supabase.auth.getSession()` + `app_users` | Đồng bộ lại trạng thái đăng nhập và role thật từ DB. |
| `updateProfile(data)` | `UPDATE public.app_users` | Cập nhật thông tin cá nhân/shop (bị `guard_app_user_update` chặn sửa `role`, `isLocked`). |

---

## 3. Tài nguyên Dữ liệu PostgREST (`public.*`)

Mọi truy vấn qua `supabase.from('<table>')` đều đi qua tầng **Row Level Security (RLS)** của PostgreSQL.

### 3.1. Sách & Danh mục (`productService.js`, `categoryService.js`)
- **Đọc danh sách / chi tiết sách**: `supabase.from('products').select('*')` (Công khai `anon` & `authenticated`).
- **Tìm kiếm / lọc theo danh mục, Flash Sale**: `.eq('categoryId', id)`, `.eq('onSale', true)`, `.ilike('name', '%...%')`.
- **Quản lý sách (Seller / Admin)**: `insert` / `update` / `delete` trên `products` (RLS chỉ cho phép Admin sửa mọi sách, Seller chỉ sửa sách có `sellerId = current_app_user_id()`).
- **Danh mục & Menu (`menuService.js`)**: `SELECT` từ `categories` và `menu`.

### 3.2. Khuyến mãi & Flash Sale (`couponService.js`, `saleService.js`)
- **Flash Sale Config**: Đọc bảng `sale_config`; Admin có quyền `update` thời gian và trạng thái chiến dịch.
- **Mã giảm giá (`coupons`)**: Đọc thông tin mã theo `code`, kiểm tra `active`, `minOrderValue`, `expiresAt`, `usedCount < usageLimit` trước khi hiển thị mức giảm tạm tính cho khách.

### 3.3. Đơn hàng (`orderService.js`)
- **Lấy đơn hàng của tôi**: `supabase.from('orders').select('*').eq('userId', currentUserId)` (RLS tự lọc đúng chủ sở hữu).
- **Quản lý đơn hàng (Admin / Seller)**: Đọc đơn theo phạm vi quyền và cập nhật `status` (được kiểm soát chuyển trạng thái bởi trigger `guard_order_update`).
- **Tạo đơn mới**: Không dùng `INSERT` trực tiếp từ client mà gọi qua **RPC `place_order`** (xem Mục 4) để đảm bảo trừ tồn kho và tăng lượt dùng mã giảm giá nguyên tử.

### 3.4. Đánh giá & Bình luận (`reviewService.js`)
- **Đọc đánh giá sản phẩm**: `supabase.from('reviews').select('*').eq('productId', id)`.
- **Gửi đánh giá / bình luận mới**: `INSERT` vào `reviews` (yêu cầu đã đăng nhập; hệ thống đối chiếu đơn hàng để gắn cờ `isVerifiedPurchase` và `orderCode`).
- **Thả tim & Trả lời**: Gọi qua RPC `toggle_review_like` và `add_review_reply` (xem Mục 4).

### 3.5. Yêu thích, Thông báo & Chat (`wishlistService.js`, `notificationService.js`, `internalChatService.js`)
- **Wishlist**: `SELECT / INSERT / DELETE` trên `wishlist` (ràng buộc `UNIQUE("userId", "productId")`).
- **Notifications**: `SELECT / UPDATE (read = true)` trên `notifications` theo `userId`.
- **Chat Messages**: `SELECT / INSERT / UPDATE (read = true)` trên `chat_messages` giữa `senderId` và `receiverId`.

---

## 4. Các Hàm RPC Security-Definer (`/rest/v1/rpc/...`)

Các nghiệp vụ liên quan đến nhiều bảng hoặc cần bảo vệ quyền ghi đều được đóng gói thành PostgreSQL RPC chạy bằng `supabase.rpc('<tên_hàm>', params)`:

| RPC Endpoint | Tham số đầu vào | Giá trị trả về | Nghiệp vụ thực thi |
| :--- | :--- | :--- | :--- |
| `place_order` | `{ p_order: JSONB }` | Bản ghi `orders` (`JSONB`) | Kiểm tra & áp dụng `coupons`, tăng `usedCount`, trừ `products.stock`, tăng `products.soldCount`, lưu `orders` trong 1 transaction. |
| `toggle_review_like` | `{ p_review_id: BIGINT }` | Bản ghi `reviews` (`JSONB`) | Thêm/xóa `current_app_user_id()` trong mảng JSONB `reviews.likes`. |
| `add_review_reply` | `{ p_review_id: BIGINT, p_comment: TEXT }` | Bản ghi `reviews` (`JSONB`) | Nối phản hồi mới (kèm `userId`, `userName`, `userRole` lấy từ DB) vào mảng JSONB `reviews.replies`. |
| `get_chat_contacts` | *(không có)* | Danh sách `{ id, name, role, avatar, shopName }` | Trả về danh bạ chat hợp lệ mà không lộ dữ liệu nhạy cảm của `app_users`. |
| `lookup_guest_order` | `{ p_order_code: TEXT, p_phone: TEXT }` | Bản ghi `orders` (`JSONB`) hoặc `null` | Cho phép khách vãng lai tra cứu trạng thái đơn hàng khi khớp mã đơn và SĐT. |

---

## 5. Supabase Storage & Supabase Realtime

### 5.1. Upload Ảnh (`src/utils/imageUpload.js`)
- **Bucket**: `uploads`
- **Thao tác**: `supabase.storage.from('uploads').upload(filePath, file)` -> lấy URL công khai bằng `getPublicUrl(filePath)`.
- **Phân quyền**: Chỉ người dùng đã xác thực (`authenticated`) được upload/xóa ảnh bìa sách và ảnh đại diện.

### 5.2. Kênh Realtime (`internalChatService.js`, `notificationBell.js`)
- **Chat nội bộ**: Lắng nghe sự kiện `INSERT` trên `public.chat_messages` qua `supabase.channel('chat-realtime')` để cập nhật tin nhắn mới ngay lập tức.
- **Thông báo đơn hàng**: Lắng nghe `INSERT` trên `public.notifications` theo `userId` để cập nhật chuông thông báo theo thời gian thực.

---

## 6. Trợ lý AI Chatbot (`aiService.js`, `botService.js`)

- **Gemini AI (`aiService.js`)**: Khi có cấu hình `VITE_GEMINI_API_KEY`, hệ thống gửi ngữ cảnh danh mục sách thực tế kết hợp câu hỏi người dùng tới Gemini API để tư vấn sách thông minh.
- **Rule-based Fallback (`botService.js`)**: Khi không có API key hoặc mất mạng, chatbot tự động chuyển sang bộ từ điển luật cục bộ để trả lời về chính sách giao hàng, thanh toán COD / VietQR Demo và tìm sách cơ bản.

---

## 7. Môi trường Offline Fallback (`json-server` tại `:3000`)

Khi chạy cục bộ qua `start.bat` mà không cấu hình Supabase env (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`), các service tự động chuyển về `src/api/client.js` (`http://localhost:3000`) với các tài nguyên REST tiêu chuẩn tương ứng trong `db.json`:

| Tài nguyên `db.json` | Endpoints hỗ trợ |
| :--- | :--- |
| Sản phẩm & Danh mục | `GET /products`, `POST /products`, `PATCH /products/:id`, `DELETE /products/:id`, `GET /categories` |
| Người dùng & Menu | `GET /users`, `POST /users`, `PATCH /users/:id`, `GET /menu` |
| Đơn hàng & Voucher | `GET /orders`, `POST /orders`, `PATCH /orders/:id`, `GET /coupons`, `GET /sale_config` |
| Đánh giá, Yêu thích, Chat | `GET /reviews`, `POST /reviews`, `PATCH /reviews/:id`, `GET/POST/DELETE /wishlist`, `GET/POST /notifications`, `GET/POST /chat_messages` |

---

## 8. Tham chiếu Mã nguồn Dịch vụ
- Supabase Client: [`src/api/supabaseClient.js`](../src/api/supabaseClient.js)
- Axios Offline Client: [`src/api/client.js`](../src/api/client.js)
- Tầng Services: [`src/services/`](../src/services/)
- Schema & RPCs: [`supabase/schema.sql`](../supabase/schema.sql)
