import { authService } from './authService.js';

const CART_STORAGE_KEY = 'nhasach_cart';

export const cartService = {
    /**
     * Kiểm tra quyền mua sản phẩm theo vai trò tài khoản (Chặn Admin tự mua & chặn Seller tự mua sách của shop mình)
     * @param {Object|null} user Tài khoản đang đăng nhập
     * @param {Object|null} product Sản phẩm dự kiến mua
     * @returns {{ allowed: boolean, reason?: string, message?: string }}
     */
    checkPurchasePermission(user, product = null) {
        if (!user) return { allowed: true };

        if (user.role === 'admin') {
            return {
                allowed: false,
                reason: 'admin_blocked',
                message: '⛔ Tài khoản Quản trị viên chỉ dùng để vận hành hệ thống, không thể đặt mua hàng. Vui lòng đăng nhập tài khoản Khách hàng!'
            };
        }

        if (
            user.role === 'seller' &&
            product &&
            product.sellerId !== undefined &&
            product.sellerId !== null &&
            String(product.sellerId).trim() !== '' &&
            String(product.sellerId) === String(user.id)
        ) {
            return {
                allowed: false,
                reason: 'seller_own_product',
                message: '⛔ Bạn không thể tự đặt mua sản phẩm thuộc chính gian hàng của mình (quy tắc chống đơn ảo).'
            };
        }

        return { allowed: true };
    },

    /**
     * Kiểm tra toàn bộ giỏ hàng trước khi thanh toán
     * @param {Object|null} user
     * @param {Array} cart
     * @returns {{ allowed: boolean, reason?: string, message?: string, blockedItem?: Object }}
     */
    validateCartForCheckout(user, cart = []) {
        const roleCheck = this.checkPurchasePermission(user, null);
        if (!roleCheck.allowed) return roleCheck;

        if (user && user.role === 'seller' && Array.isArray(cart)) {
            const ownItem = cart.find(item => !this.checkPurchasePermission(user, item).allowed);
            if (ownItem) {
                return {
                    allowed: false,
                    reason: 'seller_own_product',
                    blockedItem: ownItem,
                    message: `⛔ Không thể đặt hàng vì giỏ hàng đang chứa "${ownItem.name}" thuộc chính gian hàng của bạn (chống đơn ảo). Vui lòng xóa sản phẩm này khỏi giỏ trước khi thanh toán.`
                };
            }
        }

        return { allowed: true };
    },
    /**
     * Lấy toàn bộ danh sách sản phẩm trong giỏ hàng
     * @returns {Array} Mảng các sản phẩm [{ id, name, price, image, quantity }]
     */
    getCart() {
        try {
            const raw = localStorage.getItem(CART_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Lỗi khi đọc giỏ hàng từ localStorage:', e);
            return [];
        }
    },

    /**
     * Lưu giỏ hàng vào localStorage
     * @param {Array} cart 
     */
    saveCart(cart) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        // Kích hoạt custom event để các component khác đồng bộ badge
        window.dispatchEvent(new Event('cartUpdated'));
    },

    /**
     * Lấy số lượng của một sản phẩm đang có trong giỏ hàng
     * @param {number|string} productId
     * @returns {number}
     */
    getItemQuantity(productId) {
        const cart = this.getCart();
        const target = cart.find(item => Number(item.id) === Number(productId));
        return target ? Number(target.quantity || 0) : 0;
    },

    /**
     * Lấy số lượng tồn kho của một sản phẩm trong giỏ
     * Sản phẩm cũ (đã lưu trước khi có field stock) được coi như còn hàng
     * @param {number|string} productId
     * @returns {number}
     */
    getStock(productId) {
        const cart = this.getCart();
        const target = cart.find(item => Number(item.id) === Number(productId));
        if (!target || target.stock === undefined || target.stock === null) return Infinity;
        return Number(target.stock);
    },

    /**
     * Thêm một sản phẩm vào giỏ hàng
     * @param {Object} product Sản phẩm cần thêm (có thể kèm field stock)
     * @param {number} quantity Số lượng thêm (mặc định 1)
     * @returns {Object} { cart, added, maxQuantity } - kết quả thêm vào giỏ
     */
    addToCart(product, quantity = 1) {
        if (!product || !product.id) return { cart: this.getCart(), added: 0, maxQuantity: 0 };

        const perm = this.checkPurchasePermission(authService.getCurrentUser(), product);
        if (!perm.allowed) {
            return {
                cart: this.getCart(),
                added: 0,
                maxQuantity: 0,
                blockedReason: perm.reason,
                message: perm.message
            };
        }

        const cart = this.getCart();
        const existingIndex = cart.findIndex(item => Number(item.id) === Number(product.id));

        // Số lượng tồn kho (mặc định không giới hạn nếu thiếu dữ liệu)
        const stock = product.stock === undefined || product.stock === null ? Infinity : Number(product.stock);
        const currentQty = existingIndex > -1 ? cart[existingIndex].quantity : 0;
        const maxQuantity = Math.max(0, stock - currentQty);

        // Không vượt quá tồn kho
        const allowed = Math.min(Number(quantity), maxQuantity);
        if (allowed <= 0) {
            return { cart, added: 0, maxQuantity };
        }

        if (existingIndex > -1) {
            cart[existingIndex].quantity += allowed;
            cart[existingIndex].stock = stock === Infinity ? undefined : stock;
            if (product.sellerId !== undefined) cart[existingIndex].sellerId = product.sellerId;
            if (product.sellerName) cart[existingIndex].sellerName = product.sellerName;
            if (product.categoryId !== undefined) cart[existingIndex].categoryId = product.categoryId;
        } else {
            const newItem = {
                id: Number(product.id),
                name: product.name,
                price: Number(product.price),
                image: product.image,
                quantity: allowed
            };
            if (product.sellerId !== undefined) newItem.sellerId = product.sellerId;
            if (product.sellerName) newItem.sellerName = product.sellerName;
            if (product.categoryId !== undefined) newItem.categoryId = product.categoryId;
            if (stock !== Infinity) newItem.stock = stock;
            cart.push(newItem);
        }

        this.saveCart(cart);
        return { cart, added: allowed, maxQuantity };
    },

    /**
     * Cập nhật số lượng của một sản phẩm
     * @param {number|string} productId
     * @param {number} newQuantity
     */
    updateQuantity(productId, newQuantity) {
        let cart = this.getCart();
        let quantity = Number(newQuantity);

        if (quantity <= 0) {
            // Nếu số lượng <= 0 thì xóa khỏi giỏ
            return this.removeFromCart(productId);
        }

        const target = cart.find(item => Number(item.id) === Number(productId));
        if (target) {
            // Không cho vượt quá số lượng tồn kho
            if (target.stock !== undefined && target.stock !== null) {
                quantity = Math.min(quantity, Number(target.stock));
            }
            target.quantity = quantity;
            this.saveCart(cart);
        }
        return cart;
    },

    /**
     * Xóa một sản phẩm khỏi giỏ hàng
     * @param {number|string} productId 
     */
    removeFromCart(productId) {
        let cart = this.getCart();
        cart = cart.filter(item => Number(item.id) !== Number(productId));
        this.saveCart(cart);
        return cart;
    },

    /**
     * Xóa sạch toàn bộ giỏ hàng
     */
    clearCart() {
        this.saveCart([]);
    },

    /**
     * Tính tổng số lượng cuốn sách có trong giỏ
     * @returns {number}
     */
    getTotalCount() {
        const cart = this.getCart();
        return cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
    },

    /**
     * Tính tổng tiền hàng (chưa bao gồm phí ship)
     * @returns {number}
     */
    getTotalPrice() {
        const cart = this.getCart();
        return cart.reduce((total, item) => total + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    }
};
