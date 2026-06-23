import { api } from '../../../js/core/api.js';
import { showDialog } from '../../../js/shared/dialog/dialog.js';
import { t } from '../../../js/core/i18n.js';

export const Step3 = {
  render() {
    return `
      <div class="step-card" id="step-card-3">
        <form id="form-step-3">
          <!-- Image Upload Picker -->
          <div class="avatar-picker-container">
            <div class="avatar-preview-wrapper" id="avatar-click-zone">
              <img 
                src="" 
                class="avatar-preview" 
                id="reg-avatar-preview" 
                style="display: none;" 
                alt="Preview"
              >
              <svg id="avatar-placeholder" class="avatar-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span class="avatar-picker-btn">${t('choose_avatar')}</span>
            <input 
              type="file" 
              id="reg-avatar-input" 
              accept="image/*" 
              style="display: none;"
            >
          </div>

          <!-- Nickname / Biệt danh -->
          <div class="form-group">
            <label class="form-label" for="reg-username">${t('username_label')}</label>
            <input 
              type="text" 
              id="reg-username" 
              class="form-input" 
              placeholder="${t('nickname_placeholder')}" 
              required
            >
          </div>

          <!-- Gender selection -->
          <div class="form-group">
            <label class="form-label">${t('gender_label')}</label>
            <div class="gender-selector">
              <div class="gender-option">
                <input type="radio" name="reg-gender" id="gender-male" value="MALE" checked>
                <label for="gender-male" class="gender-label">${t('gender_male')}</label>
              </div>
              <div class="gender-option">
                <input type="radio" name="reg-gender" id="gender-female" value="FEMALE">
                <label for="gender-female" class="gender-label">${t('gender_female')}</label>
              </div>
              <div class="gender-option">
                <input type="radio" name="reg-gender" id="gender-other" value="OTHER">
                <label for="gender-other" class="gender-label">${t('gender_other')}</label>
              </div>
            </div>
          </div>

          <!-- Birthday -->
          <div class="form-group">
            <label class="form-label" for="reg-birthday">${t('dob_label')}</label>
            <input 
              type="date" 
              id="reg-birthday" 
              class="form-input" 
              required
            >
          </div>

          <div style="margin-top: 25px;">
            <button type="submit" class="btn btn-primary">
              ${t('complete')}
            </button>
          </div>
        </form>
      </div>
    `;
  },

  init(state, goToStep, toggleLoading) {
    const form = document.getElementById('form-step-3');
    const avatarZone = document.getElementById('avatar-click-zone');
    const avatarInput = document.getElementById('reg-avatar-input');
    const avatarPreview = document.getElementById('reg-avatar-preview');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');
    const pickerBtn = document.querySelector('.avatar-picker-btn');

    // Trigger file dialog
    const openFile = () => avatarInput.click();
    avatarZone.addEventListener('click', openFile);
    pickerBtn.addEventListener('click', openFile);

    // Watch file picker changes
    avatarInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        state.avatarFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
          avatarPreview.src = event.target.result;
          avatarPreview.style.display = 'block';
          avatarPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('reg-username').value.trim();
      const birthday = document.getElementById('reg-birthday').value;
      const gender = document.querySelector('input[name="reg-gender"]:checked').value;

      toggleLoading(true, t('preparing_upload_image'));

      let publicUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';
      let publicId = 'default_avatar';

      // 1. Image upload flow if user selected a file
      if (state.avatarFile) {
        toggleLoading(true, t('uploading_avatar'));
        
        // Perform final upload using signature config metadata
        const uploadResponse = await api.uploadImage(state.avatarFile, 'avatars');
        if (!uploadResponse.success) {
          toggleLoading(false);
          await showDialog({
            title: t('upload_avatar_failed'),
            message: uploadResponse.message,
            type: 'error'
          });
          return;
        }
        publicUrl = uploadResponse.data.publicUrl;
        publicId = uploadResponse.data.publicId;
      }

      // 2. Put profile details
      toggleLoading(true, t('saving_profile'));

      const profileResponse = await api.put('profiles', {
        username,
        gender,
        birthday,
        publicUrl,
        publicId
      });
      toggleLoading(false);

      if (!profileResponse.success) {
        await showDialog({
          title: t('profile_update_failed'),
          message: Array.isArray(profileResponse.data) ? profileResponse.data.join(", ") : profileResponse.message,
          type: 'error'
        });
        return;
      }

      // 3. Write session key and log in user
      localStorage.setItem('chat_user_id', state.userId);
      localStorage.setItem('chat_profile_completed', 'true');

      localStorage.removeItem('chat_has_profile');
      sessionStorage.removeItem('register_start_step');
      sessionStorage.removeItem('register_email');
      sessionStorage.removeItem('register_user_id');

      await showDialog({
        title: t('register_success'),
        message: t('register_completed_msg'),
        type: 'success',
        buttons: [{ text: t('open_app'), type: 'primary', value: true }]
      });

      // Clear view state cache & redirect
      window.location.hash = '#home';
    });
  }
};
export default Step3;
