/**
 * ========================================================
 * UNIFIED MOBILE NAVBAR & SLIDE-OUT APP DRAWER
 * Tự động chuẩn hóa topbar 1 hàng gọn đẹp & Drawer chuyên nghiệp
 * trên Tablet / Smartphone (<= 900px) cho toàn bộ hệ thống.
 * ========================================================
 */

import { authService } from '../services/authService.js';
import { cartService } from '../services/cartService.js';
import { escapeHtml } from '../utils/format.js';

const ROLE_LABELS = {
    admin: 'Quản trị viên',
    seller: 'Nhà bán đối tác',
    customer: 'Khách hàng',
    user: 'Khách hàng',
};

function getPagePrefix() {
    return window.location.pathname.includes('/pages/') ? '.' : './pages';
}

function getRootPrefix() {
    return window.location.pathname.includes('/pages/') ? '..' : '.';
}

function resolveHref(rawHref) {
    try {
        return new URL(rawHref, window.location.href);
    } catch {
        return null;
    }
}

function isSameCurrentPage(rawHref) {
    const target = resolveHref(rawHref);
    if (!target) return false;
    const norm = (p) => p.replace(/\/+$/, '').replace(/\/index\.html$/, '');
    if (norm(target.pathname) !== norm(window.location.pathname)) return false;
    return !target.hash || target.hash === window.location.hash;
}

function pickIconForText(text, href = '') {
    const s = `${text} ${href}`.toLowerCase();
    if (s.includes('index.html') || s.includes('trang chủ') || s.includes('mua sách') || s.includes('mua sắm') || s.includes('bán hàng')) return '🏠';
    if (s.includes('sách mới') || s.includes('new')) return '✨';
    if (s.includes('thể loại') || s.includes('danh mục')) return '📚';
    if (s.includes('đơn hàng') || s.includes('đơn mua') || s.includes('orders')) return '📦';
    if (s.includes('yêu thích') || s.includes('wishlist')) return '❤️';
    if (s.includes('giỏ hàng') || s.includes('cart')) return '🛒';
    if (s.includes('hồ sơ') || s.includes('tài khoản') || s.includes('profile')) return '👤';
    if (s.includes('seller') || s.includes('người bán')) return '🏪';
    if (s.includes('admin') || s.includes('quản trị')) return '👑';
    return '🔗';
}

function cleanLabel(text) {
    return String(text || '')
        .replace(/^←\s*/, '')
        .replace(/\(\s*\d+\s*\)\s*$/, '')
        .replace(/^\s*[\u{1F300}-\u{1FAFF}\u2600-\u27BF]\uFE0F?\s*/u, '')
        .trim();
}

function getCartQuantityTotal() {
    const domCount = document.querySelector('#cartCount')?.textContent;
    if (domCount !== undefined && domCount !== null && domCount.trim() !== '') {
        const parsed = Number(domCount.trim());
        if (!Number.isNaN(parsed)) return parsed;
    }
    try {
        return cartService.getCart().reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    } catch {
        return 0;
    }
}

export function initMobileNav({ onToggleTheme } = {}) {
    if (typeof document === 'undefined') return;
    if (document.querySelector('.mobile-nav-toggle-btn')) return;

    const headerEl = document.querySelector('header.header, header.admin-topbar');
    if (!headerEl) return;

    const actionsEl = headerEl.querySelector('.header-actions, .header-nav, .admin-actions');
    if (!actionsEl) return;

    headerEl.classList.add('has-mobile-nav');

    // 1. Tạo nút giỏ hàng icon gọn trên Topbar cho các trang con có link Cart (orders, wishlist, profile, product-detail)
    let mobileCartBadge = null;
    if (actionsEl.classList.contains('header-nav')) {
        const existingCartLink = actionsEl.querySelector('a[href*="cart.html"]');
        if (existingCartLink) {
            const quickCartBtn = document.createElement('a');
            quickCartBtn.href = existingCartLink.getAttribute('href') || `${getPagePrefix()}/cart.html`;
            quickCartBtn.className = 'mobile-only-cart-btn';
            quickCartBtn.setAttribute('title', 'Xem giỏ hàng');
            quickCartBtn.setAttribute('aria-label', 'Xem giỏ hàng');
            quickCartBtn.innerHTML = '🛒<span class="mobile-cart-badge">0</span>';
            mobileCartBadge = quickCartBtn.querySelector('.mobile-cart-badge');
            actionsEl.appendChild(quickCartBtn);
        }
    }

    const syncCartBadge = () => {
        if (!mobileCartBadge) return;
        const total = getCartQuantityTotal();
        mobileCartBadge.textContent = String(total);
        mobileCartBadge.style.display = total > 0 ? 'inline-flex' : 'inline-flex';
    };
    syncCartBadge();
    window.addEventListener('cartUpdated', syncCartBadge);
    window.addEventListener('storage', (e) => {
        if (e.key === 'nhasach_cart') syncCartBadge();
    });

    const cartCountEl = document.querySelector('#cartCount');
    if (cartCountEl && typeof MutationObserver !== 'undefined') {
        new MutationObserver(syncCartBadge).observe(cartCountEl, { childList: true, characterData: true, subtree: true });
    }

    // 2. Tạo nút Hamburger Toggle (☰ SVG sắc nét) đặt cuối hàng nút
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'mobile-nav-toggle-btn';
    toggleBtn.setAttribute('aria-label', 'Mở menu điều hướng');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="4" y1="7" x2="20" y2="7"></line>
            <line x1="4" y1="12" x2="20" y2="12"></line>
            <line x1="4" y1="17" x2="20" y2="17"></line>
        </svg>
    `;
    actionsEl.appendChild(toggleBtn);

    // 3. Tạo Drawer & Backdrop
    const logoLightSrc = headerEl.querySelector('.logo-light')?.getAttribute('src') || '/src/assets/logo-light.svg';
    const logoDarkSrc = headerEl.querySelector('.logo-dark')?.getAttribute('src') || '/src/assets/logo-dark.svg';
    const logoHref = headerEl.querySelector('.brand-logo-container')?.getAttribute('href') || `${getRootPrefix()}/index.html`;

    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-drawer-backdrop';

    const drawer = document.createElement('aside');
    drawer.className = 'mobile-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Menu điều hướng');
    drawer.innerHTML = `
        <div class="mobile-drawer-header">
            <a href="${escapeHtml(logoHref)}" class="brand-logo-container mobile-drawer-brand">
                <img src="${escapeHtml(logoLightSrc)}" class="logo-light" alt="Trí Tuệ Book">
                <img src="${escapeHtml(logoDarkSrc)}" class="logo-dark" alt="Trí Tuệ Book">
            </a>
            <button type="button" class="mobile-drawer-close" aria-label="Đóng menu">✕</button>
        </div>
        <div class="mobile-drawer-body" id="mobileDrawerBody"></div>
        <div class="mobile-drawer-footer" id="mobileDrawerFooter"></div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    const drawerBody = drawer.querySelector('#mobileDrawerBody');
    const drawerFooter = drawer.querySelector('#mobileDrawerFooter');
    const closeBtn = drawer.querySelector('.mobile-drawer-close');

    function closeDrawer() {
        drawer.classList.remove('open');
        backdrop.classList.remove('open');
        document.body.classList.remove('mobile-drawer-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }

    function openDrawer() {
        renderDrawerContents();
        drawer.classList.add('open');
        backdrop.classList.add('open');
        document.body.classList.add('mobile-drawer-open');
        toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function renderDrawerContents() {
        const user = authService.getCurrentUser();
        const pagePrefix = getPagePrefix();
        const rootPrefix = getRootPrefix();
        const sectionsHtml = [];

        // A. User Hero Card hoặc Guest Card
        if (user) {
            const roleText = ROLE_LABELS[user.role] || 'Thành viên';
            const displayName = user.role === 'seller' && user.shopName
                ? `${user.shopName} (${user.name || user.email})`
                : (user.name || user.email || 'Người dùng');
            const avatarInner = user.avatar
                ? `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(displayName)}">`
                : escapeHtml((user.name || 'U').trim().charAt(0).toUpperCase());

            sectionsHtml.push(`
                <a href="${pagePrefix}/profile.html" class="mobile-drawer-user-card">
                    <div class="mobile-drawer-avatar">${avatarInner}</div>
                    <div class="mobile-drawer-user-meta">
                        <div class="mobile-drawer-user-name">${escapeHtml(displayName)}</div>
                        <span class="mobile-drawer-user-sub">${escapeHtml(roleText)}</span>
                    </div>
                    <span class="mobile-drawer-user-arrow">›</span>
                </a>
            `);
        } else {
            sectionsHtml.push(`
                <div class="mobile-drawer-guest-card">
                    <div class="mobile-drawer-guest-title">Xin chào bạn đọc 👋</div>
                    <div class="mobile-drawer-guest-desc">Đăng nhập để theo dõi đơn hàng, tích lũy yêu thích và nhận ưu đãi.</div>
                    <div class="mobile-drawer-guest-actions">
                        <a href="${pagePrefix}/login.html" class="mobile-drawer-btn-login">Đăng nhập</a>
                        <a href="${pagePrefix}/dangky.html" class="mobile-drawer-btn-register">Đăng ký</a>
                    </div>
                </div>
            `);
        }

        // B. Main Menu trên Homepage (#mainMenu) nếu có
        const mainMenuEl = document.querySelector('#mainMenu');
        if (mainMenuEl && mainMenuEl.children.length > 0) {
            const menuItemsHtml = [];
            Array.from(mainMenuEl.children).forEach((child) => {
                if (child.tagName === 'A') {
                    const href = child.getAttribute('href') || '#';
                    const rawText = child.textContent.trim();
                    const activeCls = child.classList.contains('active') || isSameCurrentPage(href) ? ' active' : '';
                    menuItemsHtml.push(`
                        <a href="${escapeHtml(href)}" class="mobile-drawer-link${activeCls}">
                            <span class="mobile-drawer-link-icon">${pickIconForText(rawText, href)}</span>
                            <span class="mobile-drawer-link-label">${escapeHtml(cleanLabel(rawText))}</span>
                        </a>
                    `);
                } else if (child.classList.contains('menu-item-dropdown')) {
                    const trigger = child.querySelector('.menu-tab');
                    const subLinks = Array.from(child.querySelectorAll('.menu-dropdown-item'));
                    const triggerLabel = cleanLabel(trigger?.textContent || 'Thể loại sách');
                    const subItemsHtml = subLinks.map((sub) => {
                        const subHref = sub.getAttribute('href') || '#';
                        const subText = sub.textContent.trim();
                        return `<a href="${escapeHtml(subHref)}" class="mobile-drawer-sublink">${escapeHtml(subText)}</a>`;
                    }).join('');

                    menuItemsHtml.push(`
                        <div class="mobile-drawer-accordion">
                            <button type="button" class="mobile-drawer-link mobile-drawer-accordion-toggle" aria-expanded="false">
                                <span class="mobile-drawer-link-icon">📚</span>
                                <span class="mobile-drawer-link-label">${escapeHtml(triggerLabel)}</span>
                                <span class="mobile-drawer-chevron">▾</span>
                            </button>
                            <div class="mobile-drawer-sublist">${subItemsHtml}</div>
                        </div>
                    `);
                }
            });

            if (menuItemsHtml.length > 0) {
                sectionsHtml.push(`
                    <div class="mobile-drawer-section">
                        <div class="mobile-drawer-section-title">Khám phá</div>
                        ${menuItemsHtml.join('')}
                    </div>
                `);
            }
        }

        // C. Liên kết điều hướng từ Topbar / Dropdown (chống trùng lặp theo URL)
        const navLinks = [];
        const seenPaths = new Set();

        const pushLink = (href, label, icon, badgeText = '', badgeClass = '') => {
            const url = resolveHref(href);
            const key = url ? `${url.pathname}${url.search}` : href;
            if (!href || seenPaths.has(key)) return;
            seenPaths.add(key);

            const activeCls = isSameCurrentPage(href) ? ' active' : '';
            const badgeHtml = badgeText !== ''
                ? `<span class="mobile-drawer-link-pill ${badgeClass}">${escapeHtml(badgeText)}</span>`
                : '';

            navLinks.push(`
                <a href="${escapeHtml(href)}" class="mobile-drawer-link${activeCls}">
                    <span class="mobile-drawer-link-icon">${icon}</span>
                    <span class="mobile-drawer-link-label">${escapeHtml(label)}</span>
                    ${badgeHtml}
                </a>
            `);
        };

        // Thu thập từ .header-nav / .admin-actions của trang hiện tại
        actionsEl.querySelectorAll('a:not(.mobile-only-cart-btn)').forEach((aEl) => {
            const href = aEl.getAttribute('href');
            const raw = aEl.textContent.trim();
            if (!href || !raw) return;
            const label = cleanLabel(raw);
            let badge = '';
            let badgeClass = '';
            if (href.includes('cart.html')) {
                badge = String(getCartQuantityTotal());
            } else if (href.includes('wishlist.html')) {
                const wc = document.querySelector('#wishlistCount')?.textContent?.trim();
                if (wc) {
                    badge = wc;
                    badgeClass = 'danger';
                }
            }
            pushLink(href, label, pickIconForText(label, href), badge, badgeClass);
        });

        // Thu thập từ #userDropdownMenu nếu là Homepage đã đăng nhập
        if (user) {
            document.querySelectorAll('#userDropdownMenu a.user-dropdown-item').forEach((item) => {
                if (item.style.display === 'none') return;
                const href = item.getAttribute('href');
                const label = cleanLabel(item.textContent);
                let badge = '';
                let badgeClass = '';
                if (href && href.includes('wishlist.html')) {
                    const wc = document.querySelector('#wishlistCount')?.textContent?.trim();
                    if (wc) {
                        badge = wc;
                        badgeClass = 'danger';
                    }
                }
                pushLink(href, label, pickIconForText(label, href), badge, badgeClass);
            });

            // Đảm bảo trang nào cũng có link tiện ích cơ bản nếu chưa nằm trong header
            if (headerEl.classList.contains('admin-topbar')) {
                pushLink(`${rootPrefix}/index.html`, 'Trang bán hàng', '🏪');
            }
        } else {
            const wc = document.querySelector('#wishlistCount')?.textContent?.trim();
            const wishlistEl = actionsEl.querySelector('#wishlistButton');
            if (wishlistEl) {
                pushLink(wishlistEl.getAttribute('href') || `${pagePrefix}/wishlist.html`, 'Sách yêu thích', '❤️', wc || '0', 'danger');
            }
            const cartEl = actionsEl.querySelector('#cartButton');
            if (cartEl) {
                pushLink(cartEl.getAttribute('href') || `${pagePrefix}/cart.html`, 'Giỏ hàng', '🛒', String(getCartQuantityTotal()));
            }
        }

        if (navLinks.length > 0) {
            sectionsHtml.push(`
                <div class="mobile-drawer-section">
                    <div class="mobile-drawer-section-title">Điều hướng nhanh</div>
                    ${navLinks.join('')}
                </div>
            `);
        }

        drawerBody.innerHTML = sectionsHtml.join('');

        // Bind accordion mở danh mục thể loại
        drawerBody.querySelectorAll('.mobile-drawer-accordion-toggle').forEach((btn) => {
            btn.addEventListener('click', () => {
                const subList = btn.nextElementSibling;
                const isExpanded = btn.classList.toggle('expanded');
                btn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
                if (subList) subList.classList.toggle('expanded', isExpanded);
            });
        });

        // Tự đóng Drawer khi bấm link điều hướng cùng trang (ví dụ #danh-muc hoặc ?category=)
        drawerBody.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => closeDrawer());
        });

        // D. Footer: Theme toggle & Nút đăng xuất thật (proxy click nút gốc)
        const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
        const originalLogoutBtn = document.querySelector('#logoutBtn, #btnLogoutTop, #btnAdminLogout, #btnSellerLogout');
        const canLogout = Boolean(user || originalLogoutBtn);

        drawerFooter.innerHTML = `
            <button type="button" class="mobile-drawer-theme-row" id="mobileDrawerThemeBtn">
                <span>${isDark ? '☀️ Giao diện Sáng' : '🌙 Giao diện Tối'}</span>
                <span style="font-size: 0.76rem; opacity: 0.75;">Đổi ngay</span>
            </button>
            ${canLogout ? `
                <button type="button" class="mobile-drawer-logout-btn" id="mobileDrawerLogoutBtn">
                    🚪 Đăng xuất tài khoản
                </button>
            ` : ''}
        `;

        const themeRowBtn = drawerFooter.querySelector('#mobileDrawerThemeBtn');
        themeRowBtn?.addEventListener('click', () => {
            if (typeof onToggleTheme === 'function') {
                onToggleTheme();
            } else {
                document.querySelector('.theme-switch-btn')?.click();
            }
            const darkNow = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
            themeRowBtn.querySelector('span').textContent = darkNow ? '☀️ Giao diện Sáng' : '🌙 Giao diện Tối';
        });

        const drawerLogoutBtn = drawerFooter.querySelector('#mobileDrawerLogoutBtn');
        drawerLogoutBtn?.addEventListener('click', () => {
            closeDrawer();
            if (originalLogoutBtn) {
                originalLogoutBtn.click();
            } else {
                authService.logout();
                window.location.href = `${pagePrefix}/login.html`;
            }
        });
    }

    toggleBtn.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('open')) {
            closeDrawer();
        }
    });
}

