import { api } from '../../../js/core/api.js';

export const VerifyView = {
  render() {
    return `
      <div class="auth-container" style="max-width: 460px;">
        <!-- Loading State -->
        <div id="verify-loading" class="verify-status-container">
          <div class="spinner"></div>
          <p class="loading-text">Đang xác thực thông tin của bạn...</p>
        </div>

        <!-- Success State -->
        <div id="verify-success" class="verify-status-container" style="display: none;">
          <div class="status-icon success-icon">&#10003;</div>
          <h2 class="status-title">Xác thực thành công</h2>
          <p class="status-desc">Quá trình xác thực của bạn đã được xác nhận thành công. Giờ đây bạn đã có thể tiếp tục truy cập hệ thống.</p>
          <a href="#login" class="btn btn-primary" style="margin-top: 20px;">Đăng nhập ngay</a>
        </div>

        <!-- Error State -->
        <div id="verify-error" class="verify-status-container" style="display: none;">
          <div class="status-icon error-icon">&#10007;</div>
          <h2 class="status-title">Xác thực thất bại</h2>
          <p class="status-desc" id="verify-error-message">Mã xác thực không hợp lệ.</p>
          <a href="#login" class="btn btn-secondary" style="margin-top: 20px;">Quay lại đăng nhập</a>
        </div>
      </div>
    `;
  },

  async init(router, queryParams) {
    const loading = document.getElementById('verify-loading');
    const success = document.getElementById('verify-success');
    const error = document.getElementById('verify-error');
    const errorMsg = document.getElementById('verify-error-message');

    const verificationId = queryParams.verificationId;

    if (!verificationId) {
      if (loading) loading.style.display = 'none';
      if (errorMsg) errorMsg.textContent = 'Không tìm thấy mã xác thực (verificationId) trên đường dẫn.';
      if (error) error.style.display = 'flex';
      return;
    }

    try {
      // POST to auth/verify/{verificationId} with { verificationId } in body object
      const response = await api.post(`verifications/verify`, { verificationId });

      if (response && response.success) {
        if (loading) loading.style.display = 'none';
        if (success) success.style.display = 'flex';
      } else {
        throw new Error(response.message || 'Phản hồi từ máy chủ báo lỗi xác thực.');
      }
    } catch (err) {
      if (loading) loading.style.display = 'none';
      if (errorMsg) errorMsg.textContent = err.message || 'Không thể tiến hành xác thực tài khoản.';
      if (error) error.style.display = 'flex';
    }
  }
};
export default VerifyView;
