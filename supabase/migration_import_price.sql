-- Migration thêm cột importPrice (Giá nhập vốn) cho bảng products
-- Mặc định giá nhập = 65% giá bán niêm yết (biên lợi nhuận 35%) nếu chưa có dữ liệu

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS "importPrice" NUMERIC(12, 0) NOT NULL DEFAULT 0;

-- Cập nhật giá vốn mẫu cho toàn bộ sách hiện có nếu importPrice = 0
UPDATE public.products
SET "importPrice" = ROUND(price * 0.65)
WHERE "importPrice" = 0 OR "importPrice" IS NULL;
