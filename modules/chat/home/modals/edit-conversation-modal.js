import { getAvatarHtml } from '../components/conversations.js';
import { updateChatHeader } from '../components/chat-header.js';
import { api } from '../../../../js/core/api.js';
import { t } from '../../../../js/core/i18n.js';

export function showEditConversationModal(conversationId, conversations) {
  const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
  if (!convo) return;

  const currentTitle = convo.title || t('group_chat_prefix') + ' #' + convo.conversationId;
  const currentUserId = localStorage.getItem('chat_user_id');
  const avatarHtml = getAvatarHtml(convo, currentUserId, 'edit-avatar-preview', currentTitle, convo.conversationAvatarUrl);

  const isGroupComposite = convo.group && !convo.conversationAvatarUrl;
  const containerStyle = isGroupComposite
    ? `position: relative; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center;`
    : `position: relative; width: 80px; height: 80px; border-radius: 50%; overflow: hidden; border: 2px solid var(--border-color); background: hsla(230, 25%, 15%, 0.45); display: flex; align-items: center; justify-content: center;`;

  const overlay = document.createElement('div');
  overlay.className = 'chat-modal-overlay';

  overlay.innerHTML = `
    <div class="chat-modal-card">
      <style>
        #edit-avatar-preview-container .conversation-avatar {
          width: 100% !important;
          height: 100% !important;
        }
        #edit-avatar-preview-container .composite-avatar-item.count-badge {
          font-size: 1.1rem !important;
        }
      </style>
      <div class="chat-modal-header">
        <h3>${t('edit_convo_title')}</h3>
        <button class="btn-close-modal" id="btn-close-edit-modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="chat-modal-body">
        <form id="edit-chat-form" class="admin-form-layout" style="display: flex; flex-direction: column; gap: 15px;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 10px;">
            <div id="edit-avatar-preview-container" style="${containerStyle}">
              ${avatarHtml}
            </div>
            <input type="file" id="edit-chat-avatar-file" accept="image/*" style="display: none;">
            <button type="button" id="btn-upload-edit-avatar" class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px; height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px; width: auto;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              ${t('choose_avatar')}
            </button>
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-chat-title-input" style="font-size: 0.8rem; margin-bottom: 4px;">${t('group_name_label')}</label>
            <input type="text" id="edit-chat-title-input" class="form-input" placeholder="${t('group_name_placeholder')}" value="${currentTitle}" style="font-size: 0.85rem; padding: 8px 12px; height: 38px;">
          </div>
        </form>
      </div>
      <div class="chat-modal-footer">
        <button class="btn btn-secondary" id="btn-cancel-edit-convo">${t('voice_preview_cancel')}</button>
        <button class="btn btn-primary" id="btn-confirm-edit-convo">${t('save_changes')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('active');
  }, 10);

  const closeModal = () => {
    overlay.classList.remove('active');
    overlay.addEventListener('transitionend', () => {
      overlay.remove();
    }, { once: true });
  };

  overlay.querySelector('#btn-close-edit-modal').addEventListener('click', closeModal);
  overlay.querySelector('#btn-cancel-edit-convo').addEventListener('click', closeModal);

  const titleInput = overlay.querySelector('#edit-chat-title-input');
  const fileInput = overlay.querySelector('#edit-chat-avatar-file');
  const uploadBtn = overlay.querySelector('#btn-upload-edit-avatar');
  const saveBtn = overlay.querySelector('#btn-confirm-edit-convo');

  let selectedFile = null;

  // File selection
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length === 0) return;
      const file = fileInput.files[0];
      selectedFile = file;
      const previewContainer = overlay.querySelector('#edit-avatar-preview-container');
      if (previewContainer) {
        previewContainer.style.borderRadius = '50%';
        previewContainer.style.overflow = 'hidden';
        previewContainer.style.border = '2px solid var(--border-color)';
        previewContainer.style.background = 'hsla(230, 25%, 15%, 0.45)';
        previewContainer.innerHTML = `<img id="edit-avatar-preview" class="conversation-avatar" src="${URL.createObjectURL(file)}" style="width: 100%; height: 100%; object-fit: cover;" alt="Preview">`;
      }
    });
  }

  // Save changes logic
  saveBtn.addEventListener('click', async () => {
    const newTitle = titleInput.value.trim() || null;
    const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="spinner-sm" style="margin: 0; width: 14px; height: 14px; border-color: #fff;"></div>';

    let finalAvatarUrl = convo.conversationAvatarUrl || null;
    let finalAvatarId = convo.conversationAvatarId || null;

    if (selectedFile) {
      try {
        const res = await api.uploadImage(selectedFile, 'avatars');
        if (res && res.success && res.data) {
          finalAvatarUrl = res.data.publicUrl || res.data.url;
          finalAvatarId = res.data.publicId || res.data.id;
        } else {
          saveBtn.disabled = false;
          saveBtn.innerHTML = t('save_changes');
          const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
          await showDialog({
            title: t('upload_avatar_failed'),
            message: res?.message || t('upload_avatar_failed'),
            type: 'error'
          });
          return;
        }
      } catch (uploadErr) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = t('save_changes');
        console.error(uploadErr);
        const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
        await showDialog({
          title: t('upload_avatar_failed'),
          message: t('upload_avatar_failed'),
          type: 'error'
        });
        return;
      }
    }

    const payload = {
      conversationId: convo.conversationId,
      title: newTitle,
      conversationAvatarUrl: finalAvatarUrl,
      conversationAvatarId: finalAvatarId
    };

    try {
      const response = await api.put('conversations', payload);
      const success = response && response.success;

      if (success) {
        const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
        await showDialog({
          title: t('success_title'),
          message: t('edit_convo_success_msg'),
          type: 'success',
          buttons: [{ text: t('close'), type: 'primary', value: true }]
        });

        convo.title = newTitle;
        convo.conversationAvatarUrl = finalAvatarUrl;
        convo.conversationAvatarId = finalAvatarId;

        document.dispatchEvent(new CustomEvent('refresh-conversations'));

        updateChatHeader(
          newTitle,
          finalAvatarUrl || defaultGroupAvatar,
          t('group_chat_prefix'),
          convo.conversationId,
          conversations
        );

        closeModal();
      } else {
        throw new Error(response?.message || t('edit_convo_failed_msg'));
      }
    } catch (err) {
      console.error(err);
      const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
      await showDialog({
        title: t('edit_convo_error_title'),
        message: err.message || t('edit_convo_error_msg'),
        type: 'error'
      });
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = t('save_changes');
    }
  });
}
