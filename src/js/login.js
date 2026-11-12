import { authService } from '../services/authService.js';
import { supabase, isSupabaseEnabled } from '../api/supabaseClient.js';
import './themeToggle.js';

const loginForm = document.querySelector('#loginForm');
const loginMessage = document.querySelector('#loginMessage');
const message = document.querySelector('#message');

function showMessage(text, isSuccess = false) {
    if (loginMessage) {
        loginMessage.textContent = text;
        loginMessage.className = isSuccess ? 'message success' : 'message error';
        loginMessage.style.display = 'block';
    }
    if (message) {
        message.textContent = text;
    }
}

loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInput = document.querySelector('#email');
    const passwordInput = document.querySelector('#password');

    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
        showMessage('Vui lòng nhập đầy đủ email và mật khẩu.');
        return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đăng nhập...';
    }

    try {
        const user = await authService.login(email, password);

        showMessage(`Đăng nhập thành công! Chào mừng ${user.name}...`, true);

        setTimeout(() => {
            if (user.role === 'admin') {
                window.location.href = './admin.html';
            } else if (user.role === 'seller') {
                window.location.href = './seller.html';
            } else {
                window.location.href = '../index.html';
            }
        }, 700);
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        showMessage(error.message || 'Email hoặc mật khẩu không chính xác.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng nhập';
        }
    }
});

/* ========================================================
   KHÔI PHỤC MẬT KHẨU THẬT QUA SUPABASE AUTH EMAIL
   ======================================================== */
const forgotModal = document.querySelector('#forgotPasswordModal');
const btnOpenForgot = document.querySelector('#btnOpenForgotPassword');
const btnCloseForgot = document.querySelector('#btnCloseForgotModal');
const forgotMessage = document.querySelector('#forgotMessage');

const step1Form = document.querySelector('#forgotStep1Form');
const step3Form = document.querySelector('#forgotStep3Form');

const ind1 = document.querySelector('#stepIndicator1');
const ind2 = document.querySelector('#stepIndicator2');
const line1 = document.querySelector('#stepLine1');

const forgotEmailInput = document.querySelector('#forgotEmail');
const newPasswordInput = document.querySelector('#newPassword');
const confirmNewPasswordInput = document.querySelector('#confirmNewPassword');

function showForgotMessage(text, isSuccess = false) {
    if (forgotMessage) {
        forgotMessage.textContent = text;
        forgotMessage.className = isSuccess ? 'message success' : 'message error';
        forgotMessage.style.display = 'block';
    }
}

function clearForgotMessage() {
    if (forgotMessage) {
        forgotMessage.textContent = '';
        forgotMessage.style.display = 'none';
    }
}

function setForgotStep(step) {
    clearForgotMessage();

    if (step1Form) step1Form.style.display = step === 1 ? 'block' : 'none';
    if (step3Form) step3Form.style.display = step === 2 ? 'block' : 'none';

    if (ind1 && ind2 && line1) {
        ind1.className = `forgot-step-item ${step === 1 ? 'active' : 'completed'}`;
        line1.className = `step-line ${step >= 2 ? 'active' : ''}`;
        ind2.className = `forgot-step-item ${step === 2 ? 'active' : ''}`;
    }

    if (step === 2) {
        if (newPasswordInput) {
            newPasswordInput.value = '';
            newPasswordInput.focus();
        }
        if (confirmNewPasswordInput) confirmNewPasswordInput.value = '';
    }
}

function openForgotModal(step = 1) {
    if (forgotModal) forgotModal.style.display = 'flex';
    setForgotStep(step);
    if (step === 1 && forgotEmailInput) {
        const currentEmail = document.querySelector('#email')?.value.trim();
        if (currentEmail) forgotEmailInput.value = currentEmail;
        forgotEmailInput.focus();
    }
}

function closeForgotModal() {
    if (forgotModal) forgotModal.style.display = 'none';
    clearForgotMessage();
}

btnOpenForgot?.addEventListener('click', (e) => {
    e.preventDefault();
    openForgotModal(1);
});

btnCloseForgot?.addEventListener('click', closeForgotModal);

forgotModal?.addEventListener('click', (e) => {
    if (e.target === forgotModal) closeForgotModal();
});

// BƯỚC 1: Gửi email đặt lại mật khẩu thật qua Supabase Auth
step1Form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearForgotMessage();

    const email = forgotEmailInput?.value.trim().toLowerCase();
    if (!email) {
        showForgotMessage('Vui lòng nhập địa chỉ email.');
        return;
    }

    const btnSubmit = step1Form.querySelector('button[type="submit"]');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Đang gửi liên kết...';
    }

    try {
        await authService.sendPasswordResetEmail(email);
        showForgotMessage(
            '✅ Nếu email này tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi vào hộp thư của bạn (vui lòng kiểm tra cả mục Spam).',
            true
        );
    } catch (error) {
        console.error('Lỗi gửi email khôi phục:', error);
        showForgotMessage(error.message || 'Không thể gửi email khôi phục lúc này, vui lòng thử lại sau.');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Gửi liên kết đặt lại mật khẩu →';
        }
    }
});

// BƯỚC 2: Đặt mật khẩu mới khi người dùng bấm link recovery từ email
step3Form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearForgotMessage();

    const newPass = newPasswordInput?.value || '';
    const confirmPass = confirmNewPasswordInput?.value || '';

    if (newPass.length < 6) {
        showForgotMessage('Mật khẩu mới phải có ít nhất 6 ký tự.');
        return;
    }

    if (newPass !== confirmPass) {
        showForgotMessage('Mật khẩu xác nhận không khớp, vui lòng nhập lại.');
        return;
    }

    const btnSubmit = step3Form.querySelector('button[type="submit"]');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Đang lưu mật khẩu...';
    }

    try {
        await authService.completePasswordRecovery(newPass);
        authService.logout();
        closeForgotModal();
        showMessage('🎉 Đặt lại mật khẩu thành công! Bạn hãy đăng nhập bằng mật khẩu mới.', true);
        if (window.location.search.includes('mode=reset') || window.location.hash.includes('type=recovery')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (error) {
        console.error('Lỗi đặt mật khẩu mới:', error);
        showForgotMessage(error.message || 'Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Lưu mật khẩu mới & Đăng nhập';
        }
    }
});

// Lắng nghe sự kiện PASSWORD_RECOVERY từ Supabase Auth khi người dùng mở link trong email
if (isSupabaseEnabled && supabase) {
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
            openForgotModal(2);
        }
    });

    const isRecoveryUrl =
        window.location.search.includes('mode=reset') &&
        (window.location.hash.includes('type=recovery') || window.location.search.includes('code='));
    if (isRecoveryUrl) {
        supabase.auth.getSession().then(({ data }) => {
            if (data?.session) {
                openForgotModal(2);
            }
        });
    }
}
