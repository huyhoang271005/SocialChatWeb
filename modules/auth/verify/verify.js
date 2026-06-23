import { api } from '../../../js/core/api.js';
import { t } from '../../../js/core/i18n.js';

export const VerifyView = {
  render() {
    return `
      <div class="auth-container" style="max-width: 460px;">
        <!-- Loading State -->
        <div id="verify-loading" class="verify-status-container">
          <div class="spinner"></div>
          <p class="loading-text">${t('verifying_your_info')}</p>
        </div>

        <!-- Success State -->
        <div id="verify-success" class="verify-status-container" style="display: none;">
          <div class="status-icon success-icon">&#10003;</div>
          <h2 class="status-title">${t('verify_success')}</h2>
          <p class="status-desc">${t('verify_success_msg')}</p>
          <a href="#login" class="btn btn-primary" style="margin-top: 20px;">${t('login_now')}</a>
        </div>

        <!-- Error State -->
        <div id="verify-error" class="verify-status-container" style="display: none;">
          <div class="status-icon error-icon">&#10007;</div>
          <h2 class="status-title">${t('verify_failed')}</h2>
          <p class="status-desc" id="verify-error-message">${t('invalid_verification_code')}</p>
          <a href="#login" class="btn btn-secondary" style="margin-top: 20px;">${t('back_to_login')}</a>
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
      if (errorMsg) errorMsg.textContent = t('missing_verification_id');
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
        throw new Error(response.message || t('verify_server_error'));
      }
    } catch (err) {
      if (loading) loading.style.display = 'none';
      if (errorMsg) errorMsg.textContent = err.message || t('verify_processing_error');
      if (error) error.style.display = 'flex';
    }
  }
};
export default VerifyView;
