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

    async updateStatus(orderId, status) {
        let updatedOrder;
        if (isSupabaseEnabled) {
            updatedOrder = unwrap(
                await supabase.from('orders').update({ status }).eq('id', Number(orderId)).select().single()
            );
        } else {
            const response = await api.patch(`/orders/${orderId}`, { status });
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

    async deleteOrder(orderId) {
        if (isSupabaseEnabled) {
            unwrap(await supabase.from('orders').delete().eq('id', Number(orderId)));
            return true;
        }
        const response = await api.delete(`/orders/${orderId}`);
        return response.data;
    }
};
