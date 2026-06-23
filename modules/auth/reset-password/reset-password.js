import { api } from '../../../js/core/api.js';
import { showDialog } from '../../../js/shared/dialog/dialog.js';
import { t } from '../../../js/core/i18n.js';

export const ResetPasswordView = {
  render() {
    return `
      <div class="auth-container" style="max-width: 460px;">
        <!-- Loading Overlay -->
        <div class="loading-overlay" id="reset-loading">
          <div class="spinner"></div>
          <div class="loading-text">${t('updating_password')}</div>
        </div>

        <div class="auth-header">
          <h1>${t('reset_password_title')}</h1>
          <p>${t('reset_password_subtitle')}</p>
        </div>

        <form id="reset-password-form">
          <div class="form-group">
            <label class="form-label" for="reset-new-password">${t('new_password_label')}</label>
            <input 
              type="password" 
              id="reset-new-password" 
              class="form-input" 
              placeholder="${t('password_placeholder')}" 
              required
              autocomplete="new-password"
            >
          </div>

          <div class="form-group">
            <label class="form-label" for="reset-confirm-password">${t('confirm_new_password_label')}</label>
            <input 
              type="password" 
              id="reset-confirm-password" 
              class="form-input" 
              placeholder="${t('confirm_new_password_placeholder')}" 
              required
              autocomplete="new-password"
            >
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top: 15px;">
            ${t('change_password_btn')}
          </button>
        </form>

        <div class="auth-links" style="justify-content: center; margin-top: 20px;">
          <a href="#login" class="auth-link">${t('back_to_login')}</a>
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
          title: t('verification_error_title'),
          message: t('missing_verification_id'),
          type: 'error'
        });
        return;
      }

      const newPassword = document.getElementById('reset-new-password').value;
      const confirmPassword = document.getElementById('reset-confirm-password').value;

      if (newPassword.length < 8) {
        await showDialog({
          title: t('password_too_weak_title'),
          message: t('password_too_weak_msg'),
          type: 'warning'
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        await showDialog({
          title: t('password_mismatch_title'),
          message: t('password_mismatch_reset_msg'),
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
          title: t('success_title'),
          message: t('reset_password_success_msg'),
          type: 'success',
          buttons: [{ text: t('login_now'), type: 'primary', value: true }]
        });

        router.navigate('login');
      } else {
        await showDialog({
          title: t('reset_password_failed_title'),
          message: response?.message || t('reset_password_failed_msg'),
          type: 'error'
        });
      }
    });
  }
};
export default ResetPasswordView;
