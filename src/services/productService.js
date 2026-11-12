import api from '../api/client.js';
import { supabase, isSupabaseEnabled, unwrap } from '../api/supabaseClient.js';

export const productService = {
    async getAll() {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('products').select('*').order('id', { ascending: true })) || [];
        }
        const response = await api.get('/products');
        return response.data;
    },

    async getById(id) {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('products').select('*').eq('id', Number(id)).single());
        }
        const response = await api.get(`/products/${id}`);
        return response.data;
    },

    async create(productData) {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('products').insert(productData).select().single());
        }
        const response = await api.post('/products', productData);
        return response.data;
    },

    async update(id, productData) {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('products').update(productData).eq('id', Number(id)).select().single());
        }
        const response = await api.put(`/products/${id}`, productData);
        return response.data;
    },

    async delete(id) {
        if (isSupabaseEnabled) {
            unwrap(await supabase.from('products').delete().eq('id', Number(id)));
            return true;
        }
        const response = await api.delete(`/products/${id}`);
        return response.data;
    },

    async updateStock(id, newStock) {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('products').update({ stock: Number(newStock) }).eq('id', Number(id)).select().single());
        }
        const response = await api.patch(`/products/${id}`, { stock: newStock });
        return response.data;
    },

    async increaseSoldCount(id, amount = 1) {
        try {
            const product = await this.getById(id);
            const currentSold = Number(product.soldCount) || 0;
            const nextSold = currentSold + Number(amount);
            if (isSupabaseEnabled) {
                return unwrap(await supabase.from('products').update({ soldCount: nextSold }).eq('id', Number(id)).select().single());
            }
            const response = await api.patch(`/products/${id}`, { soldCount: nextSold });
            return response.data;
        } catch (error) {
            console.warn(`Không thể cập nhật soldCount cho sản phẩm #${id}:`, error);
        }
    }
};
