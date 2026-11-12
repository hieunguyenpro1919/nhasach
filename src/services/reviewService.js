import api from '../api/client.js';
import { supabase, isSupabaseEnabled, unwrap } from '../api/supabaseClient.js';

export const reviewService = {
    /**
     * Lấy toàn bộ danh sách đánh giá
     */
    async getAll() {
        try {
            if (isSupabaseEnabled) {
                return unwrap(await supabase.from('reviews').select('*').order('id', { ascending: true })) || [];
            }
            const response = await api.get('/reviews');
            return response.data || [];
        } catch (error) {
            console.warn('Không thể tải toàn bộ đánh giá:', error);
            return [];
        }
    },

    /**
     * Lấy danh sách đánh giá cho một sản phẩm cụ thể
     * @param {number|string} productId 
     */
    async getByProductId(productId) {
        try {
            if (isSupabaseEnabled) {
                return unwrap(await supabase.from('reviews').select('*').eq('productId', Number(productId)).order('id', { ascending: true })) || [];
            }
            const response = await api.get(`/reviews?productId=${productId}`);
            return response.data || [];
        } catch (error) {
            console.warn(`Không thể tải đánh giá của sản phẩm #${productId}:`, error);
            return [];
        }
    },

    /**
     * Kiểm tra xem một bản ghi có phải đánh giá kèm số sao hợp lệ hay không
     * (Bình luận / Hỏi đáp cộng đồng có type === 'comment' hoặc rating <= 0 sẽ không tính vào điểm sao)
     */
    isStarReview(review) {
        if (!review || review.type === 'comment') return false;
        const rating = Number(review.rating);
        return Number.isFinite(rating) && rating >= 1 && rating <= 5;
    },

    /**
     * Kiểm tra một review có thuộc về user hiện tại hay không
     */
    isSameUser(review, user) {
        if (!review || !user) return false;
        if (user.id != null && review.userId != null) {
            return String(review.userId) === String(user.id);
        }
        const email = (user.email || '').toLowerCase().trim();
        if (email && (review.userEmail || '').toLowerCase().trim()) {
            return (review.userEmail || '').toLowerCase().trim() === email;
        }
        const name = (user.name || '').toLowerCase().trim();
        return Boolean(name && (review.userName || '').toLowerCase().trim() === name);
    },

    /**
     * Chuẩn TMĐT: Kiểm tra xem sản phẩm trong MỘT ĐƠN HÀNG cụ thể đã được đánh giá chưa
     * (1 đơn hàng hoàn thành = 1 lượt đánh giá cho mỗi sản phẩm trong đơn đó; mua đơn mới được đánh giá tiếp)
     */
    getOrderProductReview(reviews, user, orderCode, productId) {
        if (!Array.isArray(reviews) || !orderCode) return null;
        const normalizedCode = String(orderCode).trim();
        return reviews.find(r => {
            if (!this.isStarReview(r)) return false;
            if (productId != null && String(r.productId) !== String(productId)) return false;
            if (String(r.orderCode || '').trim() !== normalizedCode) return false;
            if (user && r.userId != null && user.id != null) {
                return this.isSameUser(r, user);
            }
            return true;
        }) || null;
    },

    /**
     * Kiểm tra tất cả sản phẩm trong một đơn hàng đã được đánh giá hết chưa
     */
    hasOrderReviewedAllItems(order, reviews, user) {
        if (!order || !Array.isArray(order.items) || order.items.length === 0 || !order.orderCode) {
            return false;
        }
        return order.items.every(item =>
            Boolean(this.getOrderProductReview(reviews, user, order.orderCode, item.id))
        );
    },

    /**
     * Lấy danh sách các đơn hàng đã Hoàn thành của user có chứa productId nhưng chưa đánh giá sản phẩm này
     */
    getUnreviewedCompletedOrders(orders, reviews, user, productId) {
        if (!user || !Array.isArray(orders)) return [];
        const uid = user.id != null ? String(user.id) : '';
        const email = (user.email || '').toLowerCase().trim();

        return orders
            .filter(o => {
                const status = (o.status || '').toLowerCase();
                if (!status.includes('hoàn thành')) return false;

                const matchesOwner =
                    (uid && o.userId != null && String(o.userId) === uid) ||
                    (email && (o.userEmail || '').toLowerCase().trim() === email);
                if (!matchesOwner) return false;

                const hasProduct = Array.isArray(o.items) && o.items.some(item => String(item.id) === String(productId));
                if (!hasProduct) return false;

                return !this.getOrderProductReview(reviews, user, o.orderCode, productId);
            })
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    },

    /**
     * Kiểm tra xem người dùng đã đánh giá sản phẩm này chưa
     * @param {Array} reviews Danh sách đánh giá của sản phẩm
     * @param {Object} user Thông tin người dùng hiện tại
     */
    hasUserReviewed(reviews, user) {
        return Boolean(this.getUserReview(reviews, user));
    },

    /**
     * Lấy đánh giá của một người dùng cụ thể đối với sản phẩm (nếu có)
     * @param {Array} reviews 
     * @param {Object} user 
     */
    getUserReview(reviews, user) {
        if (!user || !Array.isArray(reviews)) return null;
        return reviews.find(r => this.isStarReview(r) && this.isSameUser(r, user)) || null;
    },

    /**
     * Gửi đánh giá (gắn với đơn hàng đã nhận) hoặc bình luận/hỏi đáp cộng đồng
     * @param {Object} reviewData { productId, userId, userName, userEmail, rating, comment, type, orderCode, isVerifiedPurchase, createdAt }
     */
    async create(reviewData) {
        const reviewType = reviewData.type === 'comment' ? 'comment' : 'review';

        if (reviewType === 'review' && reviewData.orderCode) {
            const existingReviews = await this.getByProductId(reviewData.productId);
            const duplicate = this.getOrderProductReview(
                existingReviews,
                reviewData.userId != null ? { id: reviewData.userId, email: reviewData.userEmail } : null,
                reviewData.orderCode,
                reviewData.productId
            );
            if (duplicate) {
                throw new Error(`Đơn hàng #${reviewData.orderCode} đã đánh giá sản phẩm này rồi.`);
            }
        }

        const payload = {
            ...reviewData,
            type: reviewType,
            rating: reviewType === 'comment' ? 0 : Math.max(1, Math.min(5, Math.round(Number(reviewData.rating) || 5))),
            orderCode: reviewData.orderCode || '',
            isVerifiedPurchase: Boolean(reviewData.isVerifiedPurchase || reviewData.orderCode),
            likes: Array.isArray(reviewData.likes) ? reviewData.likes : [],
            replies: Array.isArray(reviewData.replies) ? reviewData.replies : [],
            createdAt: reviewData.createdAt || new Date().toISOString()
        };
        if (isSupabaseEnabled) {
            return unwrap(await supabase.from('reviews').insert(payload).select().single());
        }
        const response = await api.post('/reviews', payload);
        return response.data;
    },

    /**
     * Thích / Bỏ thích một bình luận
     * @param {number|string} reviewId 
     * @param {number|string} userId 
     */
    async toggleLike(reviewId, userId) {
        try {
            if (isSupabaseEnabled) {
                return unwrap(await supabase.rpc('toggle_review_like', {
                    p_review_id: Number(reviewId)
                }));
            }
            const response = await api.get(`/reviews/${reviewId}`);
            const review = response.data;
            const likes = Array.isArray(review.likes) ? [...review.likes] : [];
            const uid = String(userId);
            const index = likes.findIndex(id => String(id) === uid);
            
            if (index > -1) {
                likes.splice(index, 1);
            } else {
                likes.push(userId);
            }

            const patchRes = await api.patch(`/reviews/${reviewId}`, { likes });
            return patchRes.data;
        } catch (error) {
            console.warn('Lỗi khi toggleLike bình luận:', error);
            return null;
        }
    },

    /**
     * Thêm phản hồi / trả lời cho một bình luận
     * @param {number|string} reviewId 
     * @param {Object} replyData { userId, userName, userAvatar, comment }
     */
    async addReply(reviewId, replyData) {
        try {
            if (isSupabaseEnabled) {
                return unwrap(await supabase.rpc('add_review_reply', {
                    p_review_id: Number(reviewId),
                    p_comment: String(replyData?.comment || '').trim()
                }));
            }
            const response = await api.get(`/reviews/${reviewId}`);
            const review = response.data;
            const replies = Array.isArray(review.replies) ? [...review.replies] : [];

            const newReply = {
                id: Date.now(),
                userId: replyData.userId,
                userName: replyData.userName || 'Bạn đọc',
                userAvatar: replyData.userAvatar || '',
                comment: replyData.comment,
                createdAt: new Date().toISOString()
            };

            replies.push(newReply);
            const patchRes = await api.patch(`/reviews/${reviewId}`, { replies });
            return patchRes.data;
        } catch (error) {
            console.warn('Lỗi khi addReply bình luận:', error);
            return null;
        }
    },

    /**
     * Tính toán số sao trung bình và thống kê đánh giá
     * @param {Array} reviews Danh sách đánh giá
     */
    calcStats(reviews = []) {
        const starReviews = Array.isArray(reviews) ? reviews.filter(r => this.isStarReview(r)) : [];
        if (starReviews.length === 0) {
            return {
                average: 5.0,
                total: 0,
                counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
            };
        }

        let sum = 0;
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        starReviews.forEach(r => {
            const star = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5)));
            counts[star] = (counts[star] || 0) + 1;
            sum += Number(r.rating) || 5;
        });

        const average = Number((sum / starReviews.length).toFixed(1));

        return {
            average,
            total: starReviews.length,
            counts
        };
    }
};
