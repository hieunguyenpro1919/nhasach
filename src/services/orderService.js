import api from '../api/client.js';
import { supabase, isSupabaseEnabled, unwrap } from '../api/supabaseClient.js';
import { notificationService } from './notificationService.js';

export const orderService = {
    async createOrder(orderData) {
        if (isSupabaseEnabled) {
            const { data, error } = await supabase.rpc('place_order', {
                p_order: orderData
            });
            if (error) {
                throw new Error(error.message || 'Không thể khởi tạo đơn hàng.');
            }
            return data;
        }

        const response = await api.post('/orders', orderData);
        const newOrder = response.data;
        try {
            if (newOrder && newOrder.userId) {
                await notificationService.createNotification({
                    userId: newOrder.userId,
                    orderId: newOrder.orderCode || `DH${newOrder.id}`,
                    title: '🎉 Đặt hàng thành công!',
                    message: `Đơn hàng #${newOrder.orderCode || `DH${newOrder.id}`} đã được khởi tạo thành công và đang chờ xác nhận.`,
                    type: 'order'
                });
            }
        } catch (e) {
            console.warn('Lỗi tạo thông báo đặt hàng:', e);
        }
        return newOrder;
    },

    async getAllOrders() {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('orders').select('*').order('id', { ascending: false })) || [];
        }
        const response = await api.get('/orders');
        return response.data;
    },

    async updateStatus(orderId, status, extraFields = {}) {
        const payload = { status, ...extraFields };
        let updatedOrder;
        if (isSupabaseEnabled) {
            const res = await supabase
                .from('orders')
                .update(payload)
                .eq('id', Number(orderId))
                .select()
                .single();

            if (res.error) {
                const msg = String(res.error.message || '');
                const hasShippingPayload = 'shippingCarrier' in extraFields || 'trackingCode' in extraFields || 'shippedAt' in extraFields;
                const isMissingColumn = res.error.code === 'PGRST204' || res.error.code === '42703' || msg.includes('shippingCarrier') || msg.includes('trackingCode');
                if (hasShippingPayload && isMissingColumn) {
                    console.warn('Chưa có cột shippingCarrier/trackingCode trên Supabase, fallback cập nhật status:', msg);
                    updatedOrder = unwrap(
                        await supabase.from('orders').update({ status }).eq('id', Number(orderId)).select().single()
                    );
                    Object.assign(updatedOrder, extraFields);
                } else {
                    throw new Error(res.error.message || 'Không thể cập nhật đơn hàng.');
                }
            } else {
                updatedOrder = res.data;
            }
        } else {
            const response = await api.patch(`/orders/${orderId}`, payload);
            updatedOrder = response.data;
        }

        try {
            if (updatedOrder) {
                await notificationService.createOrderStatusNotification(updatedOrder, status);
            }
        } catch (e) {
            console.warn('Lỗi gửi thông báo đổi trạng thái đơn:', e);
        }
        return updatedOrder;
    },

    async dispatchOrder(orderId, { shippingCarrier, trackingCode, status = 'Đang giao hàng' }) {
        return this.updateStatus(orderId, status, {
            shippingCarrier: String(shippingCarrier || '').trim(),
            trackingCode: String(trackingCode || '').trim(),
            shippedAt: new Date().toISOString()
        });
    },

    async deleteOrder(orderId) {
        if (isSupabaseEnabled) {
            unwrap(await supabase.from('orders').delete().eq('id', Number(orderId)));
            return true;
        }
        const response = await api.delete(`/orders/${orderId}`);
        return response.data;
    },

    async lookupGuestOrder(orderCode, phone) {
        if (isSupabaseEnabled) {
            const { data, error } = await supabase.rpc('lookup_guest_order', {
                p_order_code: String(orderCode || '').trim(),
                p_phone: String(phone || '').trim()
            });
            if (error) {
                throw new Error(error.message || 'Không thể tra cứu đơn hàng.');
            }
            return data || null;
        }
        const orders = await this.getAllOrders();
        const normCode = String(orderCode || '').trim().toUpperCase();
        const normPhone = String(phone || '').replace(/\D/g, '');
        return (orders || []).find(o =>
            String(o.orderCode || '').toUpperCase() === normCode &&
            String(o.receiverPhone || '').replace(/\D/g, '') === normPhone
        ) || null;
    }
};
