/**
 * Script nạp toàn bộ dữ liệu mẫu từ db.json lên Supabase PostgreSQL.
 * Cách chạy:
 *   1. Điền VITE_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY vào nhasach/.env
 *   2. Chạy: node nhasach/supabase/seed.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile(envPath) {
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = val;
        }
    }
}

loadEnvFile(path.join(projectRoot, '.env'));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('❌ Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong nhasach/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
});

const db = JSON.parse(fs.readFileSync(path.join(projectRoot, 'db.json'), 'utf8'));

async function seedTable(tableName, rows, onConflict = 'id') {
    if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`⏭️  Bỏ qua ${tableName} (0 dòng)`);
        return;
    }
    const { error } = await supabase.from(tableName).upsert(rows, { onConflict });
    if (error) {
        throw new Error(`Lỗi seed bảng ${tableName}: ${error.message}`);
    }
    console.log(`✅ Đã nạp ${rows.length} dòng vào "${tableName}"`);
}

async function run() {
    console.log('🚀 Bắt đầu nạp dữ liệu từ db.json lên Supabase...');

    // 1. Categories
    await seedTable('categories', db.categories);

    // 2. Users (tạo/đồng bộ tài khoản thật trong Supabase Auth + liên kết app_users.auth_uid)
    const { data: listedAuth, error: listAuthErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listAuthErr) {
        throw new Error(`Lỗi liệt kê Supabase Auth users: ${listAuthErr.message}`);
    }
    const authByEmail = new Map(
        (listedAuth?.users || []).map(au => [String(au.email || '').toLowerCase(), au])
    );

    const users = [...(db.user || [])].sort((a, b) => Number(a.id) - Number(b.id));
    for (const u of users) {
        const cleanEmail = String(u.email || '').trim().toLowerCase();
        if (!cleanEmail) continue;

        const rawPass = String(u.password || '');
        let initialPassword = rawPass;
        let generatedStrongPass = false;
        if (initialPassword.length < 6) {
            initialPassword = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
            generatedStrongPass = !process.env.SEED_ADMIN_PASSWORD;
        }

        let authUser = authByEmail.get(cleanEmail);
        if (!authUser) {
            const { data: createdAuth, error: createAuthErr } = await supabase.auth.admin.createUser({
                email: cleanEmail,
                password: initialPassword,
                email_confirm: true,
                user_metadata: {
                    name: u.name || cleanEmail,
                    role: u.role === 'seller' ? 'seller' : 'customer',
                    shopName: u.shopName || '',
                    shopPhone: u.shopPhone || '',
                    shopAddress: u.shopAddress || ''
                }
            });
            if (createAuthErr) {
                console.warn(`⚠️ Không tạo được Auth user ${cleanEmail}:`, createAuthErr.message);
                continue;
            }
            authUser = createdAuth.user;
            if (generatedStrongPass) {
                console.log(`🔐 Đã tạo mật khẩu mạnh tạm thời cho ${cleanEmail}: ${initialPassword}`);
            }
        }

        const profilePayload = {
            auth_uid: authUser.id,
            name: u.name || cleanEmail,
            email: cleanEmail,
            password_hash: 'AUTH_MANAGED',
            role: u.role || 'customer',
            phone: u.phone || '',
            address: u.address || '',
            avatar: u.avatar || '',
            shopName: u.shopName || '',
            shopDescription: u.shopDescription || '',
            shopPhone: u.shopPhone || '',
            shopAddress: u.shopAddress || '',
            isLocked: Boolean(u.isLocked),
            status: u.status || 'active',
            shopStatus: u.shopStatus || 'active'
        };

        const { data: existingByEmail } = await supabase
            .from('app_users')
            .select('id')
            .ilike('email', cleanEmail)
            .maybeSingle();

        if (existingByEmail) {
            await supabase.from('app_users').update(profilePayload).eq('id', existingByEmail.id);
        } else {
            await supabase.from('app_users').upsert({ id: u.id, ...profilePayload }, { onConflict: 'id' });
        }
    }
    console.log(`✅ Đã đồng bộ ${users.length} tài khoản thật vào Auth + "app_users"`);

    // 3. Products (chuẩn hóa các field boolean/số để bulk upsert không gửi NULL vào cột NOT NULL)
    const normalizedProducts = (db.products || []).map(p => ({
        id: p.id,
        name: p.name || '',
        price: Number(p.price) || 0,
        image: p.image || '',
        description: p.description || '',
        author: p.author || '',
        categoryId: p.categoryId ?? null,
        stock: Number(p.stock) || 0,
        tag: p.tag || '',
        importDate: p.importDate || new Date().toISOString(),
        soldCount: Number(p.soldCount) || 0,
        onSale: Boolean(p.onSale),
        discountPercent: Number(p.discountPercent) || 0,
        sellerId: p.sellerId ?? null,
        sellerName: p.sellerName || '',
        status: p.status || 'active',
        isNew: Boolean(p.isNew)
    }));
    await seedTable('products', normalizedProducts);

    // 4. Sale config
    const rawSale = Array.isArray(db.saleConfig) ? db.saleConfig : (db.saleConfig ? [db.saleConfig] : []);
    const normalizedSale = rawSale.map(s => ({
        id: s.id ?? 1,
        isActive: Boolean(s.isActive),
        campaignName: s.campaignName || 'Flash Sale',
        startTime: s.startTime || null,
        endTime: s.endTime || null,
        startDate: s.startDate || null,
        endDate: s.endDate || null,
        durationHours: Number(s.durationHours) || 8,
        description: s.description || ''
    }));
    await seedTable('sale_config', normalizedSale);

    // 5. Coupons
    const normalizedCoupons = (db.coupons || []).map(c => ({
        id: c.id,
        code: String(c.code || '').trim().toUpperCase(),
        description: c.description || '',
        discountType: c.discountType || 'percent',
        discountValue: Number(c.discountValue) || 0,
        maxDiscount: Number(c.maxDiscount) || 0,
        minOrderValue: Number(c.minOrderValue) || 0,
        usageLimit: Number(c.usageLimit) || 0,
        usedCount: Number(c.usedCount) || 0,
        startsAt: c.startsAt || null,
        expiresAt: c.expiresAt || null,
        active: c.active !== false,
        createdAt: c.createdAt || new Date().toISOString()
    }));
    await seedTable('coupons', normalizedCoupons);

    // 6. Orders
    const normalizedOrders = (db.orders || []).map(o => ({
        id: o.id,
        orderCode: o.orderCode || `DH${o.id}`,
        userId: o.userId ?? null,
        userEmail: o.userEmail || '',
        receiverName: o.receiverName || 'Khách hàng',
        receiverPhone: o.receiverPhone || '',
        receiverAddress: o.receiverAddress || '',
        receiverNote: o.receiverNote || '',
        paymentMethod: o.paymentMethod || 'cod',
        paymentStatus: o.paymentStatus || (o.isPaid ? 'paid' : 'unpaid'),
        isPaid: Boolean(o.isPaid),
        couponCode: o.couponCode || '',
        discountAmount: Number(o.discountAmount) || 0,
        shippingFee: Number(o.shippingFee) || 0,
        subTotal: Number(o.subTotal) || 0,
        totalAmount: Number(o.totalAmount) || 0,
        status: o.status || 'Chờ xác nhận',
        items: Array.isArray(o.items) ? o.items : [],
        createdAt: o.createdAt || new Date().toISOString()
    }));
    await seedTable('orders', normalizedOrders);

    // 7. Reviews
    const normalizedReviews = (db.reviews || []).map(r => ({
        id: r.id,
        productId: Number(r.productId),
        userId: r.userId ?? null,
        userName: r.userName || '',
        userEmail: r.userEmail || '',
        orderCode: r.orderCode || '',
        rating: Number(r.rating) || 0,
        comment: r.comment || '',
        type: r.type || 'review',
        isVerifiedPurchase: Boolean(r.isVerifiedPurchase),
        likes: Array.isArray(r.likes) ? r.likes : [],
        replies: Array.isArray(r.replies) ? r.replies : [],
        createdAt: r.createdAt || new Date().toISOString()
    }));
    await seedTable('reviews', normalizedReviews);

    // 8. Wishlist
    await seedTable('wishlist', db.wishlist);

    // 9. Notifications
    const normalizedNotifications = (db.notifications || []).map(n => ({
        id: n.id,
        userId: Number(n.userId),
        orderId: n.orderId ? String(n.orderId) : null,
        title: n.title || 'Thông báo',
        message: n.message || '',
        type: n.type || 'info',
        read: Boolean(n.read),
        link: n.link || '/pages/orders.html',
        createdAt: n.createdAt || new Date().toISOString()
    }));
    await seedTable('notifications', normalizedNotifications);

    // 10. Chat messages
    const normalizedChats = (db.chatMessages || []).map(m => ({
        id: m.id,
        senderId: Number(m.senderId),
        senderName: m.senderName || 'Người dùng',
        senderRole: m.senderRole || 'customer',
        senderAvatar: m.senderAvatar || '',
        receiverId: Number(m.receiverId),
        receiverName: m.receiverName || 'Đối tác',
        message: m.message || '',
        timestamp: m.timestamp || new Date().toISOString(),
        read: Boolean(m.read)
    }));
    await seedTable('chat_messages', normalizedChats);

    // 11. Menu
    const normalizedMenu = (db.menu || []).map(m => ({
        id: m.id,
        title: m.title || '',
        url: m.url || '#',
        isHome: Boolean(m.isHome),
        hasDropdown: Boolean(m.hasDropdown),
        requireAuth: Boolean(m.requireAuth)
    }));
    await seedTable('menu', normalizedMenu);

    // 12. Đồng bộ sequence ID
    const { error: seqErr } = await supabase.rpc('sync_table_sequences');
    if (seqErr) {
        console.warn('⚠️ Không đồng bộ được sequence:', seqErr.message);
    } else {
        console.log('🔢 Đã đồng bộ lại toàn bộ auto-increment sequence.');
    }

    console.log('🎉 Hoàn tất nạp dữ liệu demo lên Supabase!');
}

run().catch((err) => {
    console.error('❌ Seed thất bại:', err);
    process.exit(1);
});
