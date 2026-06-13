import { api } from '../../../js/core/api.js';
import { showDialog } from '../../../js/shared/dialog/dialog.js';

export const ResetPasswordView = {
  render() {
    return `
      <div class="auth-container" style="max-width: 460px;">
        <!-- Loading Overlay -->
        <div class="loading-overlay" id="reset-loading">
          <div class="spinner"></div>
          <div class="loading-text">Đang cập nhật mật khẩu...</div>
        </div>

        <div class="auth-header">
          <h1>Đặt Lại Mật Khẩu</h1>
          <p>Thiết lập mật khẩu mới cho tài khoản của bạn</p>
        </div>

        <form id="reset-password-form">
          <div class="form-group">
            <label class="form-label" for="reset-new-password">Mật khẩu mới</label>
            <input 
              type="password" 
              id="reset-new-password" 
              class="form-input" 
              placeholder="Tối thiểu 8 ký tự" 
              required
              autocomplete="new-password"
            >
          </div>

          <div class="form-group">
            <label class="form-label" for="reset-confirm-password">Xác nhận mật khẩu mới</label>
            <input 
              type="password" 
              id="reset-confirm-password" 
              class="form-input" 
              placeholder="Nhập lại mật khẩu mới" 
              required
              autocomplete="new-password"
            >
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top: 15px;">
            Đổi mật khẩu
          </button>
        </form>

        <div class="auth-links" style="justify-content: center; margin-top: 20px;">
          <a href="#login" class="auth-link">Quay lại đăng nhập</a>
        </div>
      </div>
    `;
  },

  init(router, queryParams) {
    const form = document.getElementById('reset-password-form');
    const loading = document.getElementById('reset-loading');

    const verificationId = queryParams.verificationId;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!verificationId) {
        await showDialog({
          title: 'Lỗi xác thực',
          message: 'Không tìm thấy mã xác thực (verificationId) trên đường dẫn.',
          type: 'error'
        });
        return;
      }

      const newPassword = document.getElementById('reset-new-password').value;
      const confirmPassword = document.getElementById('reset-confirm-password').value;

      if (newPassword.length < 8) {
        await showDialog({
          title: 'Mật khẩu chưa đủ mạnh',
          message: 'Mật khẩu mới phải có độ dài tối thiểu 8 ký tự.',
          type: 'warning'
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        await showDialog({
          title: 'Mật khẩu không khớp',
          message: 'Mật khẩu xác nhận không trùng khớp với mật khẩu mới.',
          type: 'warning'
        });
        return;
      }

      if (loading) loading.classList.add('active');

      const response = await api.post(`verifications/verify`, {
        verificationId,
        newPassword
      });
      if (loading) loading.classList.remove('active');

      if (response && response.success) {
        await showDialog({
          title: 'Thành công',
          message: 'Mật khẩu của bạn đã được thay đổi thành công. Bạn có thể đăng nhập bằng mật khẩu mới.',
          type: 'success',
          buttons: [{ text: 'Đăng nhập ngay', type: 'primary', value: true }]
        });

        router.navigate('login');
      } else {
        await showDialog({
          title: 'Đổi mật khẩu thất bại',
          message: response?.message || 'Có lỗi xảy ra trong quá trình cập nhật mật khẩu.',
          type: 'error'
        });
      }
    });
  }
};
export default ResetPasswordView;
