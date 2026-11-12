# 🔄 Tài Liệu Quy Trình Nghiệp Vụ — Đánh Giá, Bình Luận & Bảo Mật Dữ Liệu

> **Tác giả**: Nguyễn Văn Hiếu — MSSV: `501250367`
> **Phạm vi**: Mô tả luồng xử lý nghiệp vụ Đánh giá (Rating), Bình luận (Comment), Thích (Like), Trả lời (Reply) và cơ chế bảo mật RLS + RPC trên Supabase PostgreSQL (kèm chế độ Fallback Offline).

---

## 1. Tổng quan Kiến trúc Chức năng

Module tương tác trên trang chi tiết sách ([`pages/detail.html`](../pages/detail.html), [`src/js/detail.js`](../src/js/detail.js), [`src/services/reviewService.js`](../src/services/reviewService.js)) hỗ trợ 2 hình thức tương tác chính:

1. **Đánh giá sản phẩm (Review / Rating)**:
   - Chấm điểm từ **1 đến 5 sao** kèm nhận xét chi tiết.
   - Hệ thống tự động kiểm tra lịch sử đơn hàng của người dùng qua `orderService.js`; nếu đã mua sản phẩm ở đơn hợp lệ, bản ghi được gắn cờ `isVerifiedPurchase = true` và `orderCode` để hiển thị huy hiệu **"Đã mua hàng"**.
   - Tự động tính điểm trung bình (`rating`) và phân bố số sao.
2. **Bình luận & Hỏi đáp (Comment & Reply)**:
   - Người dùng đã đăng nhập có thể đặt câu hỏi (`type = 'comment'`, `rating = null`).
   - Hỗ trợ **Thả tim / Thích (`likes`)** và **Phản hồi lồng nhau (`replies`)** với badge vai trò (`Admin`, `Người bán`, `Khách hàng`).

---

## 2. Cấu trúc Dữ liệu Đánh giá (`public.reviews`)

Thay vì tách thành nhiều bảng phụ, `likes` và `replies` được lưu trực tiếp dưới dạng cột `JSONB` ngay trong bảng `public.reviews` để tối ưu tốc độ tải trang chi tiết sản phẩm:

```mermaid
erDiagram
    PRODUCTS ||--o{ REVIEWS : "productId (1:N)"
    APP_USERS ||--o{ REVIEWS : "userId (1:N)"

    REVIEWS {
        bigint id PK
        bigint productId FK
        bigint userId FK
        string userName
        string userEmail
        string orderCode
        int rating "1..5 hoặc NULL"
        text comment
        string type "review | comment"
        boolean isVerifiedPurchase
        jsonb likes "Mảng userId đã thích"
        jsonb replies "Mảng object phản hồi"
        timestamptz createdAt
    }
```

### Cấu trúc mẫu các cột `JSONB`
- **`likes`**: `[12, 45, 89]` (danh sách `app_users.id`).
- **`replies`**:
```json
[
  {
    "id": 1731390000123,
    "userId": 2,
    "userName": "Quản trị viên",
    "userRole": "admin",
    "comment": "Cảm ơn bạn đã ủng hộ Nhà sách!",
    "createdAt": "2026-11-12T08:00:00.000Z"
  }
]
```

---

## 3. Luồng Xử lý Chi tiết

### 3.1. Luồng Gửi Đánh giá & Bình luận mới

```mermaid
sequenceDiagram
    actor U as "Người dùng (Đã đăng nhập)"
    participant UI as "detail.js (UI)"
    participant RS as "reviewService.js"
    participant DB as "Supabase PostgreSQL (RLS)"

    U->>UI: "Chọn số sao (hoặc bình luận) & nhập nội dung"
    UI->>UI: "Kiểm tra phiên đăng nhập + validate nội dung"
    UI->>RS: "createReview(productId, payload)"
    RS->>RS: "Kiểm tra đơn đã mua -> gán isVerifiedPurchase & orderCode"
    RS->>DB: "INSERT INTO public.reviews (kèm JWT)"
    Note over DB: "RLS xác nhận userId = current_app_user_id()"
    DB-->>RS: "Trả về bản ghi review vừa tạo"
    RS-->>UI: "Cập nhật danh sách & điểm trung bình sao"
```

### 3.2. Luồng Thả tim (`toggle_review_like`) với Optimistic UI

Để giao diện phản hồi tức thì, nút Like áp dụng **Optimistic UI**: cập nhật giao diện ngay lập tức trong bộ nhớ, đồng thời gọi RPC `toggle_review_like` để PostgreSQL cập nhật nguyên tử (atomic) mảng `likes` JSONB mà không cần cấp quyền `UPDATE` toàn bảng `reviews` cho user thường.

```mermaid
flowchart TD
    A["User click nút Thích (Like)"] --> B{"Đã đăng nhập?"}
    B -- "Chưa" --> C["Thông báo yêu cầu đăng nhập"]
    B -- "Rồi" --> D["Optimistic UI: Đảo trạng thái tim & +/- 1 số lượng"]
    D --> E{"Supabase đang bật?"}
    E -- "Có (Production)" --> F["Gọi RPC toggle_review_like(p_review_id)"]
    F --> G["PostgreSQL dùng current_app_user_id() cập nhật JSONB likes"]
    E -- "Không (Offline)" --> H["PATCH /reviews/:id lên json-server :3000"]
    G --> I{"Thành công?"}
    H --> I
    I -- "Có" --> J["Đồng bộ lại dữ liệu chuẩn từ Server"]
    I -- "Lỗi" --> K["Rollback trạng thái UI & thông báo lỗi"]
```

### 3.3. Luồng Phản hồi (`add_review_reply`)

```mermaid
sequenceDiagram
    actor U as "Người dùng / Seller / Admin"
    participant UI as "detail.js"
    participant RS as "reviewService.js"
    participant RPC as "RPC add_review_reply"

    U->>UI: "Nhập nội dung phản hồi & bấm Gửi"
    UI->>RS: "replyToReview(reviewId, comment)"
    RS->>RPC: "supabase.rpc('add_review_reply', { p_review_id, p_comment })"
    Note over RPC: "SECURITY DEFINER: tự lấy userId, userName, userRole từ app_users"
    RPC-->>RS: "Trả về bản ghi review có mảng replies mới"
    RS-->>UI: "Render lại nhánh phản hồi kèm badge vai trò"
```

---

## 4. Đảm bảo Bảo mật & Toàn vẹn Dữ liệu

1. **Chống giả mạo danh tính**: Người dùng không thể tự gửi `userId` hoặc `userRole` giả khi Reply hay Like, vì `toggle_review_like` và `add_review_reply` đọc trực tiếp danh tính từ JWT thông qua `current_app_user_id()`.
2. **Chống sửa/xóa trái phép**: Chính sách RLS trên bảng `reviews` chỉ cho phép chính chủ sở hữu (`userId = current_app_user_id()`) hoặc `admin` được xóa đánh giá; không cho phép user khác chỉnh sửa nội dung đánh giá của người khác.
3. **Hỗ trợ Offline Fallback**: Khi không có cấu hình Supabase, `reviewService.js` tự động chuyển sang gọi `client.js` (`http://localhost:3000/reviews`) để đảm bảo bài kiểm thử cục bộ vẫn hoạt động thông suốt.
