import api from '../api/client.js';
import { supabase, isSupabaseEnabled } from '../api/supabaseClient.js';

export const menuService = {
    /**
     * Lấy danh sách menu điều hướng từ database
     */
    async getAll() {
        try {
            let items = [];
            if (isSupabaseEnabled) {
                const { data, error } = await supabase.from('menu').select('*').order('id', { ascending: true });
                if (error) throw error;
                items = Array.isArray(data) ? data : [];
            } else {
                const response = await api.get('/menu');
                items = Array.isArray(response.data) ? response.data : [];
            }
            return items.filter(item => item.url !== '#about' && item.url !== '#contact');
        } catch (error) {
            console.warn('Không thể tải menu từ API, sử dụng menu dự phòng:', error);
            return [
                { id: 1, title: 'Trang chủ', url: './index.html', isHome: true },
                { id: 2, title: 'Sách mới', url: '#newProductsSection' },
                { id: 3, title: 'Thể loại sách', url: '#products', hasDropdown: true },
                { id: 4, title: 'Đơn hàng', url: './pages/orders.html', requireAuth: true }
            ];
        }
    }
};
