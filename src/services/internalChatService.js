import api from '../api/client.js';
import { supabase, isSupabaseEnabled, unwrap } from '../api/supabaseClient.js';

export const internalChatService = {
    async getConversation(userAId, userBId) {
        if (!userAId || !userBId) return [];
        try {
            if (isSupabaseEnabled) {
                const a = Number(userAId);
                const b = Number(userBId);
                return unwrap(
                    await supabase
                        .from('chat_messages')
                        .select('*')
                        .or(`and(senderId.eq.${a},receiverId.eq.${b}),and(senderId.eq.${b},receiverId.eq.${a})`)
                        .order('timestamp', { ascending: true })
                ) || [];
            }

            const [sentRes, receivedRes] = await Promise.all([
                api.get('/chatMessages', {
                    params: { senderId: Number(userAId), receiverId: Number(userBId) }
                }),
                api.get('/chatMessages', {
                    params: { senderId: Number(userBId), receiverId: Number(userAId) }
                })
            ]);

            const all = [...(sentRes.data || []), ...(receivedRes.data || [])];
            return all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        } catch (error) {
            console.warn('Lỗi lấy hội thoại chat:', error);
            return [];
        }
    },

    async sendMessage(messageData) {
        const payload = {
            senderId: Number(messageData.senderId),
            senderName: messageData.senderName || 'Người dùng',
            senderRole: messageData.senderRole || 'customer',
            senderAvatar: messageData.senderAvatar || '',
            receiverId: Number(messageData.receiverId),
            receiverName: messageData.receiverName || 'Đối tác',
            message: messageData.message.trim(),
            timestamp: new Date().toISOString(),
            read: false
        };

        try {
            const saved = isSupabaseEnabled
                ? unwrap(await supabase.from('chat_messages').insert(payload).select().single())
                : (await api.post('/chatMessages', payload)).data;
            window.dispatchEvent(new CustomEvent('internal-chat:message', { detail: saved }));
            return saved;
        } catch (e) {
            console.error('Lỗi gửi tin nhắn nội bộ:', e);
            throw e;
        }
    },

    async getAvailableContacts(currentUser) {
        try {
            const allUsers = isSupabaseEnabled
                ? unwrap(await supabase.rpc('get_chat_contacts')) || []
                : (await api.get('/user')).data || [];

            const others = allUsers.filter(u => Number(u.id) !== Number(currentUser.id));

            return others.map(u => ({
                id: u.id,
                name: u.shopName || u.name || u.email || 'Người dùng',
                role: u.role,
                avatar: u.avatar || '',
                subtitle: u.role === 'seller' ? 'Gian hàng đối tác' : (u.role === 'admin' ? 'Ban Quản Trị Hệ Thống' : 'Khách hàng')
            }));
        } catch (e) {
            console.warn('Lỗi lấy danh bạ chat:', e);
            return [];
        }
    },

    async markAsRead(senderId, currentUserId) {
        try {
            if (isSupabaseEnabled) {
                unwrap(
                    await supabase
                        .from('chat_messages')
                        .update({ read: true })
                        .eq('senderId', Number(senderId))
                        .eq('receiverId', Number(currentUserId))
                        .eq('read', false)
                );
                return;
            }
            const res = await api.get('/chatMessages', {
                params: { senderId: Number(senderId), receiverId: Number(currentUserId), read: false }
            });
            const unread = res.data || [];
            for (const msg of unread) {
                await api.patch(`/chatMessages/${msg.id}`, { read: true });
            }
        } catch (e) {
            console.warn('Lỗi đánh dấu đã đọc chat:', e);
        }
    }
};
