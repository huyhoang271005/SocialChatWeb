import { api } from '../../../js/core/api.js';
import { showDialog } from '../../../js/shared/dialog/dialog.js';
import { t } from '../../../js/core/i18n.js';

export const Step2 = {
  render() {
    return `
      <div class="step-card" id="step-card-2">
        <form id="form-step-2">
          <div class="form-group" style="margin-top: 20px; margin-bottom: 35px;">
            <label class="form-label" for="reg-fullname">${t('your_fullname_label')}</label>
            <input 
              type="text" 
              id="reg-fullname" 
              class="form-input" 
              placeholder="${t('fullname_placeholder')}" 
              required
            >
          </div>
          <div style="margin-top: 25px;">
            <button type="submit" class="btn btn-primary">
              ${t('continue')}
            </button>
          </div>
        </form>
      </div>
    `;
  },

  init(state, goToStep, toggleLoading) {
    const form = document.getElementById('form-step-2');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fullName = document.getElementById('reg-fullname').value.trim();

      toggleLoading(true, t('initializing_profile'));

      const response = await api.post(`profiles/auth/${state.userId}`, { fullName });
      toggleLoading(false);

      if (!response.success) {
        await showDialog({
          title: t('profile_init_failed'),
          message: response.message,
          type: 'error'
        });
        return;
      }

      goToStep(3);
    });
  }
};
export default Step2;
