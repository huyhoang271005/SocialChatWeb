import { api } from '../../../../js/core/api.js';
import { getAvatarHtml } from './conversations.js';
import { t } from '../../../../js/core/i18n.js';

export function updateChatHeader(title, avatarUrl, statusText, conversationId = null, conversations = []) {
  const partnerInfo = document.getElementById('chat-partner-info');
  if (!partnerInfo) return;

  const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
  const currentUserId = localStorage.getItem('chat_user_id');
  const avatarHtml = getAvatarHtml(convo, currentUserId, null, title, avatarUrl);

  partnerInfo.innerHTML = `
    <button id="btn-back-to-list" class="btn-icon-back">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    ${avatarHtml}
    <div>
      <h4 style="font-size: 0.95rem; font-weight: 600;">${title}</h4>
      <p style="font-size: 0.8rem; color: var(--success)">${statusText}</p>
    </div>
  `;

  const backBtn = partnerInfo.querySelector('#btn-back-to-list');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.hash = 'home';
    });
  }

  // Handle chat-header-actions options button & dropdown
  const headerActions = document.getElementById('chat-header-actions');
  if (headerActions) {
    if (conversationId) {
      const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
      const currentUserId = String(localStorage.getItem('chat_user_id'));
      const myConvoEntry = convo?.userConversations?.find(u => String(u.userId) === currentUserId);
      const myRole = myConvoEntry ? String(myConvoEntry.conversationRole || 'MEMBER').toUpperCase() : 'MEMBER';
      const canAddMember = !convo || !convo.group || myRole === 'CREATOR' || myRole === 'ADMIN';

      headerActions.innerHTML = `
        <div class="chat-header-options">
          <button id="btn-chat-options" class="btn-chat-options" title="${t('convo_options_title')}">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1.5"></circle>
              <circle cx="12" cy="5" r="1.5"></circle>
              <circle cx="12" cy="19" r="1.5"></circle>
            </svg>
          </button>
          <div id="chat-options-dropdown" class="chat-options-dropdown" style="display: none;">
            ${canAddMember ? `
            <button class="dropdown-item" id="option-add-member">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <line x1="19" y1="8" x2="19" y2="14"></line>
                <line x1="22" y1="11" x2="16" y2="11"></line>
              </svg>
              ${t('add_member')}
            </button>
            ` : ''}
            <button class="dropdown-item" id="option-view-members">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              ${t('group_members')}
            </button>
            ${convo?.group ? `
            <button class="dropdown-item" id="option-edit-convo">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              ${t('edit_group')}
            </button>
            <button class="dropdown-item" id="option-leave-convo">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--error);">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span style="color: var(--error);">${t('leave_group')}</span>
            </button>
            ${myRole === 'CREATOR' ? `
            <button class="dropdown-item" id="option-disband-convo">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--error);">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              <span style="color: var(--error);">${t('disband')}</span>
            </button>
            ` : ''}
            ` : ''}
          </div>
        </div>
      `;

      const btnChatOptions = headerActions.querySelector('#btn-chat-options');
      const dropdown = headerActions.querySelector('#chat-options-dropdown');

      if (btnChatOptions && dropdown) {
        btnChatOptions.addEventListener('click', (e) => {
          e.stopPropagation();
          const isVisible = dropdown.style.display === 'block';
          dropdown.style.display = isVisible ? 'none' : 'block';
        });

        // Close on click outside
        const closeDropdownListener = (e) => {
          if (!btnChatOptions.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
          }
        };
        document.addEventListener('click', closeDropdownListener);
      }

      // Bind button events inside dropdown
      const optAddMember = headerActions.querySelector('#option-add-member');
      if (optAddMember) {
        optAddMember.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (dropdown) dropdown.style.display = 'none';
          const { showAddMemberModal } = await import('../modals/add-member-modal.js');
          showAddMemberModal(conversationId, conversations);
        });
      }

      const optViewMembers = headerActions.querySelector('#option-view-members');
      if (optViewMembers) {
        optViewMembers.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (dropdown) dropdown.style.display = 'none';
          const { showViewMembersModal } = await import('../modals/view-members-modal.js');
          showViewMembersModal(conversationId, conversations);
        });
      }

      const optEditConvo = headerActions.querySelector('#option-edit-convo');
      if (optEditConvo) {
        optEditConvo.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (dropdown) dropdown.style.display = 'none';
          const { showEditConversationModal } = await import('../modals/edit-conversation-modal.js');
          showEditConversationModal(conversationId, conversations);
        });
      }

      const optLeaveConvo = headerActions.querySelector('#option-leave-convo');
      if (optLeaveConvo) {
        optLeaveConvo.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (dropdown) dropdown.style.display = 'none';

          const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
          const confirm = await showDialog({
            title: t('leave_convo_title'),
            message: t('leave_convo_msg'),
            type: 'warning',
            buttons: [
              { text: t('logout_cancel'), type: 'secondary', value: false },
              { text: t('leave_group'), type: 'danger', value: true }
            ]
          });

          if (confirm) {
            try {
              const res = await api.patch(`conversations/${conversationId}/leave`);
              if (res && res.success) {
                // Clear active conversation and cache via custom event
                document.dispatchEvent(new CustomEvent('left-conversation', { detail: { conversationId } }));
                window.location.hash = 'home';

                await showDialog({
                  title: t('success_title'),
                  message: t('leave_convo_success'),
                  type: 'success'
                });
              } else {
                throw new Error(res?.message || t('leave_convo_failed'));
              }
            } catch (err) {
              await showDialog({
                title: t('error_title'),
                message: err.message || t('leave_convo_failed'),
                type: 'error'
              });
            }
          }
        });
      }

      const optDisbandConvo = headerActions.querySelector('#option-disband-convo');
      if (optDisbandConvo) {
        optDisbandConvo.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (dropdown) dropdown.style.display = 'none';

          const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
          const confirm = await showDialog({
            title: t('disband_convo_title'),
            message: t('disband_convo_msg'),
            type: 'warning',
            buttons: [
              { text: t('logout_cancel'), type: 'secondary', value: false },
              { text: t('disband'), type: 'danger', value: true }
            ]
          });

          if (confirm) {
            document.dispatchEvent(new CustomEvent('disband-conversation', { detail: { conversationId } }));
          }
        });
      }
    } else {
      headerActions.innerHTML = '';
    }
  }
}
