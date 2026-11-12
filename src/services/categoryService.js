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
        if (isSupabaseEnabled) {
            unwrap(await supabase.from('categories').delete().eq('id', Number(id)));
            return true;
        }
        const response = await api.delete(`/categories/${id}`);
        return response.data;
    }
};
