import { api } from '../../../js/core/api.js';
import { showDialog } from '../../../js/shared/dialog/dialog.js';
import { CONFIG } from '../../../js/core/config.js';
import { loginWithGoogle, getFCMToken } from '../../../js/core/firebase.js';

export const LoginView = {
  render() {
    return `
      <div class="auth-container">
        <!-- Loading Overlay -->
        <div class="loading-overlay" id="login-loading">
          <div class="spinner"></div>
          <div class="loading-text">Đang kết nối...</div>
        </div>

        <div class="auth-header login-header-animate">
          <h1>Đăng Nhập</h1>
          <p>Chào mừng bạn trở lại với ChatApp</p>
        </div>

        <form id="login-form" class="login-form-animate">
          <div class="form-group">
            <label class="form-label" for="login-email">Email</label>
            <input 
              type="email" 
              id="login-email" 
              class="form-input" 
              placeholder="ten@viethan.com" 
              required
              autocomplete="email"
            >
          </div>

          <div class="form-group">
            <label class="form-label" for="login-password">Mật khẩu</label>
            <input 
              type="password" 
              id="login-password" 
              class="form-input" 
              placeholder="••••••••" 
              required
              autocomplete="current-password"
            >
          </div>

          <div class="form-group remember-me-group" style="display: flex; align-items: center; gap: 8px; margin-top: 15px; margin-bottom: 15px;">
            <input 
              type="checkbox" 
              id="login-remember" 
              style="width: 16px; height: 16px; cursor: pointer; margin: 0;"
            >
            <label for="login-remember" style="font-size: 0.9rem; color: var(--text-secondary); cursor: pointer; user-select: none; margin: 0;">
              Ghi nhớ đăng nhập
            </label>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top: 10px;">
            Đăng Nhập
          </button>
        </form>

        <div class="auth-divider login-form-animate" style="animation-delay: 0.15s;">
          <span>Hoặc</span>
        </div>

        <button type="button" id="google-login-btn" class="btn btn-google login-form-animate" style="animation-delay: 0.2s;">
          <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Đăng nhập bằng Google
        </button>

        <div class="auth-links login-form-animate" style="animation-delay: 0.25s;">
          <a href="#forgot-password" class="auth-link" id="link-forgot-pw">Quên mật khẩu?</a>
          <a href="#register" class="auth-link">Đăng ký tài khoản</a>
        </div>
      </div>
    `;
  },

  init(router) {
    const form = document.getElementById('login-form');
    const loading = document.getElementById('login-loading');
    const forgotPwLink = document.getElementById('link-forgot-pw');
    const googleBtn = document.getElementById('google-login-btn');

    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        loading.classList.add('active');
        const loadingText = loading.querySelector('.loading-text');
        const originalText = loadingText ? loadingText.textContent : 'Đang kết nối...';
        
        try {
          if (loadingText) loadingText.textContent = 'Đang kết nối Google...';
          
          // 1. Đăng nhập Google qua Firebase
          const loginResult = await loginWithGoogle();
          const firebaseToken = loginResult.firebaseToken;
          const userEmail = loginResult.user.email || '';

          // 2. Lấy FCM Token (nếu hỗ trợ và đã bật thông báo)
          if (loadingText) loadingText.textContent = 'Đang đăng ký nhận thông báo...';
          const fcmToken = await getFCMToken();

          // 3. Gửi thông tin lên Backend để đăng nhập
          if (loadingText) loadingText.textContent = 'Xác thực tài khoản...';
          const response = await api.post('auth/login/oauth2', { firebaseToken, fcmToken });

          if (!response.success) {
            loading.classList.remove('active');
            if (loadingText) loadingText.textContent = originalText;
            await showDialog({
              title: "Lỗi đăng nhập",
              message: Array.isArray(response.data) ? response.data.join(", ") : response.message,
              type: 'error'
            });
            return;
          }

          const responseEmail = response.data?.emailName || response.data?.email || userEmail;

          // 4. Kiểm tra xác thực email
          if (response.data && response.data.verifiedEmail === false){
            loading.classList.remove('active');
            if (loadingText) loadingText.textContent = originalText;
            const confirmed = await showDialog({
              title: "Xác thực email",
              message: "Email của bạn chưa được xác thực. Vui lòng xác thực để tiếp tục.",
              type: 'warning',
              buttons: [{text: "Xác thực ngay", type: 'primary', value: true}]
            });
            if (confirmed) {
              loading.classList.add('active');
              const verifyEmail = await api.post('verifications/send-verification-email', {
                emailName: responseEmail
              });
              loading.classList.remove('active');
              await showDialog({
                title: "Gửi email xác thực",
                message: verifyEmail.message,
                type: verifyEmail.success ? 'success' : 'error',
              });
            }
            return;
          }

          // 5. Kiểm tra xác thực thiết bị
          if(response.data && response.data.verifiedDevice === false){
            loading.classList.remove('active');
            if (loadingText) loadingText.textContent = originalText;
            const confirmed = await showDialog({
              title: "Xác thực thiết bị",
              message: "Thiết bị của bạn chưa được xác thực. Vui lòng xác thực để tiếp tục.",
              type: 'warning',
              buttons: [{text: "Xác thực ngay", type: 'primary', value: true}]
            });
            if (confirmed) {
              loading.classList.add('active');
              const verifyDevice = await api.post('verifications/send-verification-device', {
                emailName: responseEmail
              });
              loading.classList.remove('active');
              await showDialog({
                title: "Gửi email xác thực",
                message: verifyDevice.message,
                type: verifyDevice.success ? 'success' : 'error',
              });
            }
            return;
          }

          // Ghi nhớ đăng nhập
          localStorage.setItem('chat_remember_me', 'true');

          // 6. Kiểm tra hoàn tất hồ sơ
          if (response.data && (response.data.hasProfile === false || response.data.updateProfile === false)) {
            localStorage.removeItem('chat_profile_completed');
            loading.classList.remove('active');
            if (loadingText) loadingText.textContent = originalText;
            const confirmed = await showDialog({
              title: 'Hoàn tất hồ sơ',
              message: 'Tài khoản của bạn chưa cập nhật thông tin cá nhân. Vui lòng hoàn tất đăng ký để tiếp tục.',
              type: 'info',
              buttons: [{ text: 'Cập nhật ngay', type: 'primary', value: true }]
            });

            if (confirmed) {
              let register_start_step;
              if(response.data.hasProfile === false) register_start_step = '2';
              else if (response.data.updateProfile === false) register_start_step = '3';
              sessionStorage.setItem('register_start_step', register_start_step);
              sessionStorage.setItem('register_email', responseEmail);
              if (response.data.userId) {
                sessionStorage.setItem('register_user_id', response.data.userId);
              }
              router.navigate('register');
            }
            return;
          }

          localStorage.setItem('chat_user_email', responseEmail);
          localStorage.setItem('chat_profile_completed', 'true');

          loading.classList.remove('active');
          if (loadingText) loadingText.textContent = originalText;
          await showDialog({
            title: 'Đăng nhập thành công',
            message: `Chào mừng`,
            type: 'success',
            buttons: [{ text: 'Bắt đầu ngay', type: 'primary', value: true }]
          });

          router.navigate('home');

        } catch (error) {
          loading.classList.remove('active');
          if (loadingText) loadingText.textContent = originalText;
          if (error.code !== 'auth/popup-closed-by-user') {
            await showDialog({
              title: "Lỗi đăng nhập Google",
              message: error.message || "Có lỗi xảy ra trong quá trình đăng nhập bằng Google.",
              type: 'error'
            });
          }
        }
      });
    }

    forgotPwLink.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const currentEmail = document.getElementById('login-email').value.trim();

      const result = await showDialog({
        title: 'Quên mật khẩu',
        message: 'Vui lòng nhập địa chỉ email của bạn để nhận liên kết khôi phục mật khẩu:',
        type: 'info',
        showInput: true,
        inputPlaceholder: 'ten@viethan.com',
        inputValue: currentEmail,
        buttons: [
          { text: 'Hủy', type: 'secondary', value: false },
          { text: 'Tiếp tục', type: 'primary', value: true }
        ]
      });

      if (result && result.buttonValue === true) {
        const emailName = result.inputValue.trim();
        if (!emailName) {
          await showDialog({
            title: 'Lỗi',
            message: 'Địa chỉ email không được để trống.',
            type: 'error'
          });
          return;
        }

        loading.classList.add('active');
        const response = await api.post('verifications/send-verification-reset-password', { emailName });
        loading.classList.remove('active');

        await showDialog({
          title: response.success ? 'Thành công' : 'Lỗi gửi yêu cầu',
          message: response.message,
          type: response.success ? 'success' : 'error'
        });
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const rememberMe = document.getElementById('login-remember').checked;

      loading.classList.add('active');
      const loadingText = loading.querySelector('.loading-text');
      const originalText = loadingText ? loadingText.textContent : 'Đang kết nối...';

      if (loadingText) loadingText.textContent = 'Đang đăng ký nhận thông báo...';
      const fcmToken = await getFCMToken();

      if (loadingText) loadingText.textContent = 'Đang đăng nhập...';
      const response = await api.post('auth/login', { emailName: email, password, fcmToken });
      if (loadingText) loadingText.textContent = originalText;

      if (!response.success) {
        loading.classList.remove('active');
        await showDialog({
          title: "Lỗi đăng nhập",
          message: Array.isArray(response.data) ? response.data.join(", ") : response.message,
          type: 'error'
        });
        return;
      }

      if (response.data && response.data.verifiedEmail === false){
        loading.classList.remove('active');
        const confirmed = await showDialog({
          title: "Xác thực email",
          message: "Email của bạn chưa được xác thực. Vui lòng xác thực để tiêp tục.",
          type: 'warning',
          buttons: [{text: "Xác thực ngay", type: 'primary', value: true}]
        });
        if (confirmed) {
          loading.classList.add('active');
          const verifyEmail = await api.post('verifications/send-verification-email', {
            emailName: email
          });
          loading.classList.remove('active');
          await showDialog({
            title: "Gửi email xác thực",
            message: verifyEmail.message,
            type: verifyEmail.success ? 'success' : 'error',
          });
        }
        return;
      }

      if(response.data && response.data.verifiedDevice === false){
        loading.classList.remove('active');
        const confirmed = await showDialog({
          title: "Xác thực thiết bị",
          message: "Thiết bị của bạn chưa được xác thực. Vui lòng xác thực để tiếp tục.",
          type: 'warning',
          buttons: [{text: "Xác thực ngay", type: 'primary', value: true}]
        });
        if (confirmed) {
          loading.classList.add('active');
          const verifyDevice = await api.post('verifications/send-verification-device', {
            emailName: email
          });
          loading.classList.remove('active');
          await showDialog({
            title: "Gửi email xác thực",
            message: verifyDevice.message,
            type: verifyDevice.success ? 'success' : 'error',
          });
        }
        return;
      }

      if (rememberMe) {
        localStorage.setItem('chat_remember_me', 'true');
      } else {
        localStorage.removeItem('chat_remember_me');
      }

      if (response.data && (response.data.hasProfile === false || response.data.updateProfile === false)) {
        localStorage.removeItem('chat_profile_completed');
        loading.classList.remove('active');
        const confirmed = await showDialog({
          title: 'Hoàn tất hồ sơ',
          message: 'Tài khoản của bạn chưa cập nhật thông tin cá nhân. Vui lòng hoàn tất đăng ký để tiếp tục.',
          type: 'info',
          buttons: [{ text: 'Cập nhật ngay', type: 'primary', value: true }]
        });

        if (confirmed) {
          let register_start_step;
          if(response.data.hasProfile === false) register_start_step = '2';
          else if (response.data.updateProfile === false) register_start_step = '3';
          sessionStorage.setItem('register_start_step', register_start_step);
          sessionStorage.setItem('register_email', email);
          if (response.data.userId) {
            sessionStorage.setItem('register_user_id', response.data.userId);
          }
          router.navigate('register');
        }
        return;
      }

      localStorage.setItem('chat_user_email', email);
      localStorage.setItem('chat_profile_completed', 'true');

      loading.classList.remove('active');
      await showDialog({
        title: 'Đăng nhập thành công',
        message: `Chào mừng`,
        type: 'success',
        buttons: [{ text: 'Bắt đầu ngay', type: 'primary', value: true }]
      });

      router.navigate('home');
    });
  }
};
