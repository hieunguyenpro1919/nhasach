import api from '../api/client.js';
import { supabase, isSupabaseEnabled, unwrap } from '../api/supabaseClient.js';
import { storage } from '../utils/storage.js';

const SAFE_USER_COLUMNS = 'id, name, email, role, phone, gender, dob, address, bio, avatar, "shopName", "shopDescription", "shopPhone", "shopAddress", "shopBio", "isLocked", status, "shopStatus", "createdAt"';

export const authService = {
    async login(email, password) {
        if (isSupabaseEnabled) {
            const { data, error } = await supabase.rpc('auth_login', {
                p_email: String(email || '').trim().toLowerCase(),
                p_password: String(password || '')
            });
            if (error) {
                throw new Error(error.message || 'Email hoặc mật khẩu không chính xác.');
            }
            storage.setUser(data);
            return data;
        }

        const response = await api.get('/user', {
            params: { email, password }
        });
        const users = response.data;
        if (!users || users.length === 0) {
            throw new Error('Email hoặc mật khẩu không chính xác.');
        }
        const user = users[0];
        if (user.isLocked === true || user.status === 'locked' || (user.role === 'seller' && user.shopStatus === 'locked')) {
            throw new Error('Tài khoản này đã bị Quản trị viên tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ!');
        }
        storage.setUser(user);
        return user;
    },

    async checkEmailExists(email) {
        if (isSupabaseEnabled) {
            const existing = await this.findUserByEmail(email);
            return Boolean(existing);
        }
        const response = await api.get('/user', {
            params: { email }
        });
        return response.data && response.data.length > 0;
    },

    async register(userData) {
        if (isSupabaseEnabled) {
            const { data, error } = await supabase.rpc('auth_register', {
                p_name: userData.name || userData.email,
                p_email: String(userData.email || '').trim().toLowerCase(),
                p_password: String(userData.password || ''),
                p_role: userData.role || 'customer',
                p_shop_name: userData.shopName || ''
            });
            if (error) {
                throw new Error(error.message || 'Đăng ký tài khoản thất bại.');
            }
            return data;
        }
        const response = await api.post('/user', userData);
        return response.data;
    },

    getCurrentUser() {
        return storage.getUser();
    },

    async getAllUsers() {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('app_users').select(SAFE_USER_COLUMNS).order('id', { ascending: true })) || [];
        }
        const response = await api.get('/user');
        return response.data;
    },

    async findUserByEmail(email) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail) return null;
        if (isSupabaseEnabled) {
            const { data, error } = await supabase
                .from('app_users')
                .select(SAFE_USER_COLUMNS)
                .ilike('email', cleanEmail)
                .maybeSingle();
            if (error) throw new Error(error.message);
            return data || null;
        }
        const response = await api.get('/user', {
            params: { email }
        });
        const users = response.data;
        return (users && users.length > 0) ? users[0] : null;
    },

    async resetPassword(userId, newPassword) {
        if (isSupabaseEnabled) {
            const user = await this.getUserById(userId);
            if (!user?.email) throw new Error('Không tìm thấy tài khoản.');
            const { error } = await supabase.rpc('auth_reset_password', {
                p_email: user.email,
                p_new_password: String(newPassword)
            });
            if (error) throw new Error(error.message);
            return user;
        }
        const response = await api.patch(`/user/${userId}`, {
            password: newPassword
        });
        return response.data;
    },

    async getUserById(userId) {
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('app_users').select(SAFE_USER_COLUMNS).eq('id', Number(userId)).single());
        }
        const response = await api.get(`/user/${userId}`);
        return response.data;
    },

    async updateProfile(userId, profileData) {
        if (isSupabaseEnabled) {
            const safePatch = { ...profileData };
            delete safePatch.password;
            delete safePatch.password_hash;
            const updatedUser = unwrap(
                await supabase.from('app_users').update(safePatch).eq('id', Number(userId)).select(SAFE_USER_COLUMNS).single()
            );
            const current = storage.getUser() || {};
            const merged = { ...current, ...updatedUser };
            storage.setUser(merged);
            return merged;
        }

        const response = await api.patch(`/user/${userId}`, profileData);
        const updatedUser = response.data;
        const current = storage.getUser() || {};
        const merged = { ...current, ...updatedUser };
        storage.setUser(merged);
        return merged;
    },

    async changePassword(userId, oldPassword, newPassword) {
        if (isSupabaseEnabled) {
            const user = await this.getUserById(userId);
            if (!user?.email) throw new Error('Không tìm thấy tài khoản.');
            const { error: checkErr } = await supabase.rpc('auth_login', {
                p_email: user.email,
                p_password: String(oldPassword || '')
            });
            if (checkErr) {
                throw new Error('Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại!');
            }
            await this.resetPassword(userId, newPassword);
            return true;
        }

        const user = await this.getUserById(userId);
        if (!user || user.password !== oldPassword) {
            throw new Error('Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại!');
        }
        const updated = await this.resetPassword(userId, newPassword);
        const current = storage.getUser() || {};
        storage.setUser({ ...current, password: newPassword });
        return updated;
    },

    async createUser(userData) {
        const cleanEmail = (userData.email || '').trim().toLowerCase();
        if (!cleanEmail) {
            throw new Error('Vui lòng nhập email hợp lệ.');
        }

        if (isSupabaseEnabled) {
            const created = await this.register({
                name: userData.name || cleanEmail,
                email: cleanEmail,
                password: userData.password || '123456',
                role: userData.role || 'customer',
                shopName: userData.shopName || ''
            });
            const extra = {
                phone: userData.phone || '',
                address: userData.address || '',
                avatar: userData.avatar || '',
                shopDescription: userData.shopDescription || '',
                isLocked: Boolean(userData.isLocked),
                status: userData.status || (userData.isLocked ? 'locked' : 'active'),
                shopStatus: userData.shopStatus || (userData.isLocked ? 'locked' : 'active')
            };
            return unwrap(
                await supabase.from('app_users').update(extra).eq('id', created.id).select(SAFE_USER_COLUMNS).single()
            );
        }

        const exists = await this.checkEmailExists(cleanEmail);
        if (exists) {
            throw new Error(`Email "${cleanEmail}" đã tồn tại trong hệ thống.`);
        }
        const payload = {
            ...userData,
            email: cleanEmail,
            isLocked: Boolean(userData.isLocked),
            createdAt: userData.createdAt || new Date().toISOString()
        };
        const response = await api.post('/user', payload);
        return response.data;
    },

    async adminUpdateUser(userId, profileData) {
        if (profileData.email) {
            const cleanEmail = profileData.email.trim().toLowerCase();
            const existing = await this.findUserByEmail(cleanEmail);
            if (existing && String(existing.id) !== String(userId)) {
                throw new Error(`Email "${cleanEmail}" đang thuộc về tài khoản #${existing.id}.`);
            }
            profileData = { ...profileData, email: cleanEmail };
        }

        if (isSupabaseEnabled) {
            const patch = { ...profileData };
            const newPass = patch.password;
            delete patch.password;
            delete patch.password_hash;

            if (newPass) {
                await this.resetPassword(userId, newPass);
            }

            const updatedUser = unwrap(
                await supabase.from('app_users').update(patch).eq('id', Number(userId)).select(SAFE_USER_COLUMNS).single()
            );
            const current = storage.getUser();
            if (current && String(current.id) === String(userId)) {
                storage.setUser({ ...current, ...updatedUser });
            }
            return updatedUser;
        }

        const response = await api.patch(`/user/${userId}`, profileData);
        const updatedUser = response.data;
        const current = storage.getUser();
        if (current && String(current.id) === String(userId)) {
            storage.setUser({ ...current, ...updatedUser });
        }
        return updatedUser;
    },

    async deleteUser(userId) {
        if (isSupabaseEnabled) {
            unwrap(await supabase.from('app_users').delete().eq('id', Number(userId)));
            return true;
        }
        await api.delete(`/user/${userId}`);
        return true;
    },

    logout() {
        storage.removeUser();
    }
};
