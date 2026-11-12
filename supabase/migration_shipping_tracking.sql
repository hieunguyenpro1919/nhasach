-- Migration: Bổ sung thông tin đơn vị vận chuyển & mã vận đơn cho bảng orders
-- Chạy trong Supabase SQL Editor (an toàn, có thể chạy lại nhiều lần)

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS "shippingCarrier" TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS "trackingCode" TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON public.orders ("trackingCode");

CREATE OR REPLACE FUNCTION public.guard_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF auth.uid() IS NULL OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW."orderCode" IS DISTINCT FROM OLD."orderCode"
       OR NEW."userId" IS DISTINCT FROM OLD."userId"
       OR NEW."subTotal" IS DISTINCT FROM OLD."subTotal"
       OR NEW."shippingFee" IS DISTINCT FROM OLD."shippingFee"
       OR NEW."discountAmount" IS DISTINCT FROM OLD."discountAmount"
       OR NEW."totalAmount" IS DISTINCT FROM OLD."totalAmount"
       OR NEW."couponCode" IS DISTINCT FROM OLD."couponCode"
       OR NEW.items IS DISTINCT FROM OLD.items THEN
        RAISE EXCEPTION 'Không thể chỉnh sửa thông tin giá trị hoặc sản phẩm của đơn hàng.';
    END IF;

    -- Chỉ Admin hoặc Seller mới được gắn/cập nhật đơn vị vận chuyển và mã vận đơn
    IF NOT public.is_seller() AND (
        NEW."shippingCarrier" IS DISTINCT FROM OLD."shippingCarrier"
        OR NEW."trackingCode" IS DISTINCT FROM OLD."trackingCode"
        OR NEW."shippedAt" IS DISTINCT FROM OLD."shippedAt"
    ) THEN
        RAISE EXCEPTION 'Chỉ người bán hoặc quản trị viên mới được cập nhật thông tin vận chuyển.';
    END IF;

    RETURN NEW;
END;
$$;
