import { api } from '../../../js/core/api.js';
import { showDialog } from '../../../js/shared/dialog/dialog.js';

export const Step1 = {
  render() {
    return `
      <div class="step-card active" id="step-card-1">
        <form id="form-step-1">
          <div class="form-group">
            <label class="form-label" for="reg-email">Địa chỉ Email</label>
            <input 
              type="email" 
              id="reg-email" 
              class="form-input" 
              placeholder="ten@viethan.com" 
              required
            >
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password">Mật khẩu</label>
            <input 
              type="password" 
              id="reg-password" 
              class="form-input" 
              placeholder="Tối thiểu 8 ký tự" 
              required
            >
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-confirm-password">Xác nhận mật khẩu</label>
            <input 
              type="password" 
              id="reg-confirm-password" 
              class="form-input" 
              placeholder="Nhập lại mật khẩu" 
              required
            >
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top: 15px;">
            Tiếp tục
          </button>
        </form>
        <div class="auth-links" style="justify-content: center; margin-top: 20px;">
          <span style="color: var(--text-secondary); margin-right: 5px;">Đã có tài khoản?</span>
          <a href="#login" class="auth-link">Đăng nhập</a>
        </div>
      </div>
    `;
  },

  init(state, goToStep, toggleLoading) {
    const form = document.getElementById('form-step-1');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const confirmPassword = document.getElementById('reg-confirm-password').value;

      if (password !== confirmPassword) {
        await showDialog({
          title: 'Mật khẩu không khớp',
          message: 'Mật khẩu xác nhận phải trùng khớp với mật khẩu đã nhập.',
          type: 'warning'
        });
        return;
      }

      toggleLoading(true, 'Đang xác thực thông tin tài khoản...');

      const response = await api.post('users/auth', { emailName: email, password });

      if (!response.success) {
        toggleLoading(false);
        await showDialog({
          title: 'Đăng ký tài khoản thất bại',
          message: Array.isArray(response.data) ? response.data.join(', ') : response.message,
          type: 'error'
        });
        return;
      }
      
      // Save in register parent state
      state.userId = response.data?.userId;

      // Gửi email xác thực trước khi sang bước tiếp theo
      toggleLoading(true, 'Đang gửi email xác thực...');
      try {
        const verifyRes = await api.post('verifications/send-verification-email', { emailName: email });
        toggleLoading(false);

        await showDialog({
          title: verifyRes.success ? 'Gửi email thành công' : 'Gửi email thất bại',
          message: verifyRes.message || 'Mã xác thực đã được gửi đến email của bạn.',
          type: verifyRes.success ? 'success' : 'error'
        });

        if (verifyRes.success) {
          goToStep(2);
        }
      } catch (err) {
        toggleLoading(false);
        await showDialog({
          title: 'Lỗi kết nối',
          message: err.message || 'Không thể kết nối đến máy chủ để gửi email xác thực.',
          type: 'error'
        });
      }
    });
  }
};
export default Step1;
