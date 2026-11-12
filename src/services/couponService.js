import api from '../api/client.js';
import { supabase, isSupabaseEnabled, unwrap } from '../api/supabaseClient.js';

export const couponService = {
    /**
     * Lấy toàn bộ danh sách mã giảm giá từ server
     */
    async getAllCoupons() {
        try {
            if (isSupabaseEnabled) {
                return unwrap(await supabase.from('coupons').select('*').order('id', { ascending: false })) || [];
            }
            const res = await api.get('/coupons');
            return res.data || [];
        } catch (e) {
            console.warn('Lỗi lấy danh sách coupon từ API:', e);
            return [];
        }
    },

    /**
     * Lấy danh sách mã giảm giá khả dụng cho khách hàng
     */
    async getActiveCoupons() {
        const all = await this.getAllCoupons();
        const now = Date.now();
        return all.filter(c => {
            if (c.active === false) return false;
            if (c.startsAt && new Date(c.startsAt).getTime() > now) return false;
            if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return false;
            const limit = Number(c.usageLimit) || 0;
            const used = Number(c.usedCount) || 0;
            if (limit > 0 && used >= limit) return false;
            return true;
        });
    },

    /**
     * Tìm thông tin mã giảm giá theo Code
     * @param {string} code
     */
    async findCouponByCode(code) {
        if (!code) return null;
        const normalized = code.trim().toUpperCase();
        try {
            if (isSupabaseEnabled) {
                const { data, error } = await supabase
                    .from('coupons')
                    .select('*')
                    .ilike('code', normalized)
                    .maybeSingle();
                if (!error && data) return data;
            } else {
                const res = await api.get('/coupons', {
                    params: { code: normalized }
                });
                if (res.data && res.data.length > 0) {
                    return res.data[0];
                }
            }
        } catch {
            // fallback
        }
        const activeList = await this.getActiveCoupons();
        return activeList.find(c => c.code.toUpperCase() === normalized) || null;
    },

    /**
     * Kiểm tra và tính toán số tiền giảm giá của mã Coupon
     * @param {string} code Mã giảm giá do khách nhập
     * @param {number} subTotal Tổng tiền hàng trước giảm giá
     * @param {number} shippingFee Phí vận chuyển hiện tại
     * @returns {Promise<{ isValid: boolean, message?: string, coupon?: Object, discountAmount: number }>}
     */
    async applyCoupon(code, subTotal = 0, shippingFee = 0) {
        if (!code || !code.trim()) {
            return { isValid: false, message: 'Vui lòng nhập mã giảm giá.', discountAmount: 0 };
        }

        const coupon = await this.findCouponByCode(code);
        if (!coupon) {
            return { isValid: false, message: 'Mã giảm giá không tồn tại hoặc đã hết hạn sử dụng.', discountAmount: 0 };
        }

        if (coupon.active === false) {
            return { isValid: false, message: 'Mã giảm giá này hiện đang tạm ngưng áp dụng.', discountAmount: 0 };
        }

        if (coupon.startsAt && new Date(coupon.startsAt).getTime() > Date.now()) {
            return { isValid: false, message: 'Mã giảm giá này chưa đến thời gian áp dụng.', discountAmount: 0 };
        }

        if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
            return { isValid: false, message: 'Mã giảm giá đã quá hạn sử dụng.', discountAmount: 0 };
        }

        const usageLimit = Number(coupon.usageLimit) || 0;
        const usedCount = Number(coupon.usedCount) || 0;
        if (usageLimit > 0 && usedCount >= usageLimit) {
            return { isValid: false, message: 'Mã giảm giá đã hết lượt sử dụng.', discountAmount: 0 };
        }

        const minOrder = Number(coupon.minOrderValue) || 0;
        if (subTotal < minOrder) {
            return {
                isValid: false,
                message: `Mã này chỉ áp dụng cho đơn hàng từ ${minOrder.toLocaleString('vi-VN')} đ trở lên (hiện tại: ${subTotal.toLocaleString('vi-VN')} đ).`,
                discountAmount: 0
            };
        }

        let discountAmount = 0;

        if (coupon.discountType === 'percent') {
            const pct = Number(coupon.discountValue) || 0;
            let calculated = Math.round(subTotal * (pct / 100));
            const maxCap = Number(coupon.maxDiscount);
            if (Number.isFinite(maxCap) && maxCap > 0 && calculated > maxCap) {
                calculated = maxCap;
            }
            discountAmount = calculated;
        } else if (coupon.discountType === 'fixed') {
            const fixedVal = Number(coupon.discountValue) || 0;
            discountAmount = Math.min(fixedVal, subTotal);
        } else if (coupon.discountType === 'shipping') {
            const shipDiscount = Number(coupon.discountValue) || 30000;
            discountAmount = Math.min(shipDiscount, shippingFee > 0 ? shippingFee : 30000);
        }

        return {
            isValid: true,
            message: `Áp dụng thành công mã "${coupon.code}"!`,
            coupon,
            discountAmount
        };
    },

    /**
     * Chuẩn hóa mã Voucher (viết hoa, bỏ khoảng trắng)
     * @param {string} rawCode
     */
    normalizeCode(rawCode) {
        return String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '');
    },

    /**
     * Tạo mã giảm giá / Voucher mới (dành cho Admin)
     * @param {Object} couponData
     */
    async createCoupon(couponData) {
        const code = this.normalizeCode(couponData.code);
        if (!code) {
            throw new Error('Mã Voucher không được để trống.');
        }

        const all = await this.getAllCoupons();
        if (all.some(c => this.normalizeCode(c.code) === code)) {
            throw new Error(`Mã Voucher "${code}" đã tồn tại trong hệ thống!`);
        }

        const payload = {
            ...couponData,
            code,
            usedCount: Number(couponData.usedCount) || 0,
            active: couponData.active !== false,
            createdAt: new Date().toISOString()
        };
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('coupons').insert(payload).select().single());
        }
        const res = await api.post('/coupons', payload);
        return res.data;
    },

    /**
     * Cập nhật thông tin Voucher (dành cho Admin)
     * @param {number|string} couponId
     * @param {Object} couponData
     */
    async updateCoupon(couponId, couponData) {
        let payload = { ...couponData };
        if (couponData.code !== undefined) {
            const code = this.normalizeCode(couponData.code);
            if (!code) {
                throw new Error('Mã Voucher không được để trống.');
            }
            const all = await this.getAllCoupons();
            if (all.some(c => String(c.id) !== String(couponId) && this.normalizeCode(c.code) === code)) {
                throw new Error(`Mã Voucher "${code}" đã trùng với một voucher khác!`);
            }
            payload.code = code;
        }
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('coupons').update(payload).eq('id', Number(couponId)).select().single());
        }
        const res = await api.patch(`/coupons/${couponId}`, payload);
        return res.data;
    },

    /**
     * Xóa Voucher khỏi hệ thống (dành cho Admin)
     * @param {number|string} couponId
     */
    async deleteCoupon(couponId) {
        if (isSupabaseEnabled) {
            unwrap(await supabase.from('coupons').delete().eq('id', Number(couponId)));
            return true;
        }
        await api.delete(`/coupons/${couponId}`);
        return true;
    },

    /**
     * Tăng số lượt đã sử dụng khi khách đặt hàng thành công
     * @param {number|string} couponId
     */
    async incrementUsage(couponId) {
        if (!couponId) return null;
        try {
            if (isSupabaseEnabled) {
                const { data: current } = await supabase.from('coupons').select('*').eq('id', Number(couponId)).maybeSingle();
                if (!current) return null;
                const nextCount = (Number(current.usedCount) || 0) + 1;
                return unwrap(await supabase.from('coupons').update({ usedCount: nextCount }).eq('id', Number(couponId)).select().single());
            }
            const res = await api.get(`/coupons/${couponId}`);
            const current = res.data;
            if (!current) return null;
            const nextCount = (Number(current.usedCount) || 0) + 1;
            const updated = await api.patch(`/coupons/${couponId}`, { usedCount: nextCount });
            return updated.data;
        } catch (err) {
            console.warn('Không thể cập nhật lượt sử dụng coupon:', err);
            return null;
        }
    }
};

