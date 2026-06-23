import { api } from '../../../js/core/api.js';
import { showDialog } from '../../../js/shared/dialog/dialog.js';
import { t } from '../../../js/core/i18n.js';

export const Step1 = {
  render() {
    return `
      <div class="step-card active" id="step-card-1">
        <form id="form-step-1">
          <div class="form-group">
            <label class="form-label" for="reg-email">${t('email_address_label')}</label>
            <input 
              type="email" 
              id="reg-email" 
              class="form-input" 
              placeholder="ten@viethan.com" 
              required
            >
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-password">${t('password_label')}</label>
            <input 
              type="password" 
              id="reg-password" 
              class="form-input" 
              placeholder="${t('password_placeholder')}" 
              required
            >
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-confirm-password">${t('confirm_password_label')}</label>
            <input 
              type="password" 
              id="reg-confirm-password" 
              class="form-input" 
              placeholder="${t('confirm_password_placeholder')}" 
              required
            >
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top: 15px;">
            ${t('continue')}
          </button>
        </form>
        <div class="auth-links" style="justify-content: center; margin-top: 20px;">
          <span style="color: var(--text-secondary); margin-right: 5px;">${t('already_have_account')}</span>
          <a href="#login" class="auth-link">${t('login_title')}</a>
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
          title: t('password_mismatch_title'),
          message: t('password_mismatch_msg'),
          type: 'warning'
        });
        return;
      }

      toggleLoading(true, t('verifying_account_info'));

      const response = await api.post('users/auth', { emailName: email, password });

      if (!response.success) {
        toggleLoading(false);
        await showDialog({
          title: t('register_failed'),
          message: Array.isArray(response.data) ? response.data.join(', ') : response.message,
          type: 'error'
        });
        return;
      }
      
      // Save in register parent state
      state.userId = response.data?.userId;

      // Gửi email xác thực trước khi sang bước tiếp theo
      toggleLoading(true, t('sending_verification_email'));
      try {
        const verifyRes = await api.post('verifications/send-verification-email', { emailName: email });
        toggleLoading(false);

        await showDialog({
          title: verifyRes.success ? t('send_email_success') : t('send_email_failed'),
          message: verifyRes.message || t('verification_email_sent'),
          type: verifyRes.success ? 'success' : 'error'
        });

        if (verifyRes.success) {
          goToStep(2);
        }
      } catch (err) {
        toggleLoading(false);
        await showDialog({
          title: t('connection_error'),
          message: err.message || t('connection_error_msg'),
          type: 'error'
        });
      }
    });
  }
};
export default Step1;
