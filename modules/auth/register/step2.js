import { api } from '../../../js/core/api.js';
import { showDialog } from '../../../js/shared/dialog/dialog.js';

export const Step2 = {
  render() {
    return `
      <div class="step-card" id="step-card-2">
        <form id="form-step-2">
          <div class="form-group" style="margin-top: 20px; margin-bottom: 35px;">
            <label class="form-label" for="reg-fullname">Họ và Tên của bạn</label>
            <input 
              type="text" 
              id="reg-fullname" 
              class="form-input" 
              placeholder="Nhập đầy đủ cả họ và tên" 
              required
            >
          </div>
          <div style="margin-top: 25px;">
            <button type="submit" class="btn btn-primary">
              Tiếp tục
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

      toggleLoading(true, 'Đang khởi tạo hồ sơ của bạn...');

      const response = await api.post(`profiles/auth/${state.userId}`, { fullName });
      toggleLoading(false);

      if (!response.success) {
        await showDialog({
          title: 'Khởi tạo hồ sơ lỗi',
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
