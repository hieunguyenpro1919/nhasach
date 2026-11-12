import api from '../api/client.js';
import { supabase, isSupabaseEnabled, createStatelessSupabaseClient, unwrap } from '../api/supabaseClient.js';
import { storage } from '../utils/storage.js';

const SAFE_USER_COLUMNS = 'id, auth_uid, name, email, role, phone, gender, dob, address, bio, avatar, "shopName", "shopDescription", "shopPhone", "shopAddress", "shopBio", "isLocked", status, "shopStatus", "createdAt"';

function isAccountLocked(user) {
    return Boolean(
        user &&
        (user.isLocked === true || user.status === 'locked' || (user.role === 'seller' && user.shopStatus === 'locked'))
    );
}

function clearSupabaseTokenCache() {
    try {
        Object.keys(localStorage).forEach((k) => {
            if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
                localStorage.removeItem(k);
            }
        });
    } catch {
        // ignore storage errors
    }
}

export const authService = {
    async _fetchProfileByAuthUid(authUid) {
        if (!isSupabaseEnabled || !authUid) return null;
        const { data, error } = await supabase
            .from('app_users')
            .select(SAFE_USER_COLUMNS)
            .eq('auth_uid', authUid)
            .maybeSingle();
        if (error) throw new Error(error.message);
        return data || null;
    },

    async syncSession() {
        if (!isSupabaseEnabled) {
            return storage.getUser();
        }
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session?.user) {
                storage.removeUser();
                return null;
            }
            const profile = await this._fetchProfileByAuthUid(session.user.id);
            if (!profile || isAccountLocked(profile)) {
                await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                storage.removeUser();
                return null;
            }
            storage.setUser(profile);
            return profile;
        } catch (err) {
            console.warn('Lỗi đồng bộ phiên đăng nhập:', err);
            return storage.getUser();
        }
    },

    async login(email, password) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const rawPassword = String(password || '');

        if (isSupabaseEnabled) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: rawPassword
            });
            if (error) {
                if (/email not confirmed/i.test(error.message)) {
                    throw new Error('Tài khoản chưa xác nhận email. Vui lòng kiểm tra hộp thư để kích hoạt.');
                }
                throw new Error('Email hoặc mật khẩu không chính xác.');
            }
            const profile = await this._fetchProfileByAuthUid(data.user.id);
            if (!profile) {
                await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                throw new Error('Không tìm thấy hồ sơ người dùng trong hệ thống.');
            }
            if (isAccountLocked(profile)) {
                await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                storage.removeUser();
                throw new Error('Tài khoản này đã bị Quản trị viên tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ!');
            }
            storage.setUser(profile);
            return profile;
        }

        const response = await api.get('/user', {
            params: { email: cleanEmail, password: rawPassword }
        });
        const users = response.data;
        if (!users || users.length === 0) {
            throw new Error('Email hoặc mật khẩu không chính xác.');
        }
        const user = users[0];
        if (isAccountLocked(user)) {
            throw new Error('Tài khoản này đã bị Quản trị viên tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ!');
        }
        storage.setUser(user);
        return user;
    },

    async checkEmailExists(email) {
        if (isSupabaseEnabled) {
            // Không dò email từ client khi đã bật RLS; Supabase Auth signUp tự kiểm tra trùng email an toàn
            return false;
        }
        const response = await api.get('/user', {
            params: { email: String(email || '').trim().toLowerCase() }
        });
        return response.data && response.data.length > 0;
    },

    async register(userData) {
        const cleanEmail = String(userData.email || '').trim().toLowerCase();
        const safeRole = userData.role === 'seller' ? 'seller' : 'customer';

        if (isSupabaseEnabled) {
            const redirectTo = typeof window !== 'undefined'
                ? `${window.location.origin}/pages/login.html`
                : undefined;

            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password: String(userData.password || ''),
                options: {
                    emailRedirectTo: redirectTo,
                    data: {
                        name: String(userData.name || cleanEmail).trim(),
                        role: safeRole,
                        shopName: safeRole === 'seller' ? String(userData.shopName || '').trim() : '',
                        shopPhone: safeRole === 'seller' ? String(userData.shopPhone || '').trim() : '',
                        shopAddress: safeRole === 'seller' ? String(userData.shopAddress || '').trim() : ''
                    }
                }
            });

            if (error) {
                if (/already registered|already exists/i.test(error.message)) {
                    throw new Error('Email này đã được sử dụng. Vui lòng chọn email khác!');
                }
                throw new Error(error.message || 'Đăng ký tài khoản thất bại.');
            }

            if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                throw new Error('Email này đã được sử dụng. Vui lòng chọn email khác!');
            }

            if (data?.session && data?.user) {
                const profile = await this._fetchProfileByAuthUid(data.user.id);
                if (profile) {
                    storage.setUser(profile);
                }
                return { user: profile, requiresEmailVerification: false };
            }

            return { user: data?.user || null, requiresEmailVerification: true };
        }

        const response = await api.post('/user', { ...userData, email: cleanEmail, role: safeRole });
        return { user: response.data, requiresEmailVerification: false };
    },

    async sendPasswordResetEmail(email) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail) throw new Error('Vui lòng nhập địa chỉ email.');

        if (isSupabaseEnabled) {
            const redirectTo = typeof window !== 'undefined'
                ? `${window.location.origin}/pages/login.html?mode=reset`
                : undefined;
            const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
            if (error) {
                throw new Error(error.message || 'Không thể gửi email đặt lại mật khẩu.');
            }
            return true;
        }
        throw new Error('Chức năng đặt lại mật khẩu qua email yêu cầu kết nối Supabase.');
    },

    async completePasswordRecovery(newPassword) {
        if (!isSupabaseEnabled) {
            throw new Error('Chức năng này yêu cầu kết nối Supabase.');
        }
        const { data, error } = await supabase.auth.updateUser({
            password: String(newPassword || '')
        });
        if (error) {
            throw new Error(error.message || 'Không thể cập nhật mật khẩu mới.');
        }
        return data?.user || true;
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
            params: { email: cleanEmail }
        });
        const users = response.data;
        return (users && users.length > 0) ? users[0] : null;
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
            delete safePatch.id;
            delete safePatch.auth_uid;
            delete safePatch.password;
            delete safePatch.password_hash;
            delete safePatch.role;
            delete safePatch.isLocked;
            delete safePatch.status;
            delete safePatch.shopStatus;

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
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const email = authUser?.email || storage.getUser()?.email;
            if (!email) throw new Error('Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.');

            const { error: checkErr } = await supabase.auth.signInWithPassword({
                email,
                password: String(oldPassword || '')
            });
            if (checkErr) {
                throw new Error('Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại!');
            }

            const { error: updateErr } = await supabase.auth.updateUser({
                password: String(newPassword || '')
            });
            if (updateErr) {
                throw new Error(updateErr.message || 'Không thể cập nhật mật khẩu mới.');
            }
            return true;
        }

        const user = await this.getUserById(userId);
        if (!user || user.password !== oldPassword) {
            throw new Error('Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại!');
        }
        const response = await api.patch(`/user/${userId}`, { password: newPassword });
        const current = storage.getUser() || {};
        storage.setUser({ ...current, password: newPassword });
        return response.data;
    },

    async createUser(userData) {
        const cleanEmail = (userData.email || '').trim().toLowerCase();
        if (!cleanEmail) {
            throw new Error('Vui lòng nhập email hợp lệ.');
        }

        if (isSupabaseEnabled) {
            const stateless = createStatelessSupabaseClient();
            const { data, error } = await stateless.auth.signUp({
                email: cleanEmail,
                password: String(userData.password || ''),
                options: {
                    data: {
                        name: userData.name || cleanEmail,
                        role: userData.role === 'seller' ? 'seller' : 'customer',
                        shopName: userData.shopName || '',
                        shopPhone: userData.shopPhone || '',
                        shopAddress: userData.shopAddress || ''
                    }
                }
            });
            if (error) {
                throw new Error(error.message || 'Không thể tạo tài khoản mới.');
            }
            const createdUid = data?.user?.id;
            if (!createdUid) {
                throw new Error('Không nhận được mã Auth từ Supabase.');
            }

            const adminPatch = {
                name: userData.name || cleanEmail,
                role: userData.role || 'customer',
                phone: userData.phone || '',
                address: userData.address || '',
                avatar: userData.avatar || '',
                shopName: userData.shopName || '',
                shopDescription: userData.shopDescription || '',
                shopPhone: userData.shopPhone || '',
                shopAddress: userData.shopAddress || '',
                isLocked: Boolean(userData.isLocked),
                status: userData.status || (userData.isLocked ? 'locked' : 'active'),
                shopStatus: userData.shopStatus || (userData.isLocked ? 'locked' : 'active')
            };

            return unwrap(
                await supabase.from('app_users').update(adminPatch).eq('auth_uid', createdUid).select(SAFE_USER_COLUMNS).single()
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
        if (isSupabaseEnabled) {
            const patch = { ...profileData };
            const newPass = patch.password;
            delete patch.password;
            delete patch.password_hash;
            delete patch.id;
            delete patch.auth_uid;

            if (patch.email) {
                patch.email = patch.email.trim().toLowerCase();
            }

            if (newPass) {
                const { data: { session } } = await supabase.auth.getSession();
                const target = await this.getUserById(userId);
                if (target?.auth_uid && session?.user?.id === target.auth_uid) {
                    await this.completePasswordRecovery(newPass);
                } else {
                    throw new Error('Vì bảo mật Supabase Auth, Admin không thể đặt mật khẩu trực tiếp cho tài khoản khác. Hãy yêu cầu người dùng dùng chức năng "Quên mật khẩu".');
                }
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

        if (profileData.email) {
            const cleanEmail = profileData.email.trim().toLowerCase();
            const existing = await this.findUserByEmail(cleanEmail);
            if (existing && String(existing.id) !== String(userId)) {
                throw new Error(`Email "${cleanEmail}" đang thuộc về tài khoản #${existing.id}.`);
            }
            profileData = { ...profileData, email: cleanEmail };
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
        clearSupabaseTokenCache();
        if (isSupabaseEnabled && supabase) {
            supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
    }
};
