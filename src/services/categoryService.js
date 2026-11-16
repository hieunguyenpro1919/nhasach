import api from '../api/client.js';
import { supabase, isSupabaseEnabled, unwrap } from '../api/supabaseClient.js';

export const categoryService = {
    async getAll() {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('categories').select('*').order('id', { ascending: true })) || [];
        }
        const response = await api.get('/categories');
        return response.data;
    },

    async create(categoryData) {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('categories').insert(categoryData).select().single());
        }
        const response = await api.post('/categories', categoryData);
        return response.data;
    },

    async update(id, categoryData) {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('categories').update(categoryData).eq('id', Number(id)).select().single());
        }
        const response = await api.put(`/categories/${id}`, categoryData);
        return response.data;
    },

    async delete(id) {
        return this.deleteWithProducts(id);
    },

    async deleteWithProducts(id) {
        const catId = Number(id);
        if (isSupabaseEnabled) {
            // Xóa toàn bộ sản phẩm gắn thể loại này trước
            unwrap(await supabase.from('products').delete().eq('categoryId', catId));
            // Xóa thể loại
            unwrap(await supabase.from('categories').delete().eq('id', catId));
            return true;
        }
        try {
            const res = await api.get(`/products?categoryId=${catId}`);
            const prods = Array.isArray(res.data) ? res.data : [];
            await Promise.all(prods.map(p => api.delete(`/products/${p.id}`)));
        } catch (e) {
            console.warn('Lỗi khi xóa sản phẩm thuộc category trên mock API:', e);
        }
        const response = await api.delete(`/categories/${catId}`);
        return response.data;
    }
};
