import { api } from '../../../../js/core/api.js';
import { t } from '../../../../js/core/i18n.js';

export function showViewMembersModal(conversationId, conversations) {
  const currentUserId = String(localStorage.getItem('chat_user_id'));

  const overlay = document.createElement('div');
  overlay.className = 'chat-modal-overlay';

  const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
  const userConversations = convo ? (convo.userConversations || []) : [];
  const myConvoEntry = userConversations.find(u => String(u.userId) === currentUserId);
  const myRole = myConvoEntry ? String(myConvoEntry.conversationRole || 'MEMBER').toUpperCase() : 'MEMBER';
  const canDeleteMember = !convo || !convo.group || myRole === 'CREATOR' || myRole === 'ADMIN';
  const canChangeRole = !convo || !convo.group || myRole === 'CREATOR' || myRole === 'ADMIN';

  overlay.innerHTML = `
    <div class="chat-modal-card">
      <div class="chat-modal-header">
        <h3>${t('members_list_title')}</h3>
        <button class="btn-close-modal" id="btn-close-view-modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="chat-modal-body" id="modal-members-list-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
        <!-- Members list -->
      </div>
      <div class="chat-modal-footer">
        <button class="btn btn-secondary" id="btn-close-view-members">${t('close')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('active');
  }, 10);

  const onMembersUpdated = (e) => {
    if (String(e.detail.conversationId) === String(conversationId)) {
      renderMembersList();
    }
  };
  document.addEventListener('members-updated', onMembersUpdated);

  const closeModal = () => {
    document.removeEventListener('members-updated', onMembersUpdated);
    overlay.classList.remove('active');
    overlay.addEventListener('transitionend', () => {
      overlay.remove();
    }, { once: true });
  };

  overlay.querySelector('#btn-close-view-modal').addEventListener('click', closeModal);
  overlay.querySelector('#btn-close-view-members').addEventListener('click', closeModal);

  renderMembersList();

  function renderMembersList() {
    const container = overlay.querySelector('#modal-members-list-container');
    if (!container) return;

    const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
    const userConversations = convo ? (convo.userConversations || []) : [];

    if (userConversations.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 20px;">
          ${t('no_members_found')}
        </div>
      `;
      return;
    }

    const ROLE_PRIORITY = {
      'CREATOR': 3,
      'ADMIN': 2,
      'MEMBER': 1
    };

    const sortedMembers = [...userConversations].sort((a, b) => {
      const roleA = String(a.conversationRole || 'MEMBER').toUpperCase();
      const roleB = String(b.conversationRole || 'MEMBER').toUpperCase();
      const priorityA = ROLE_PRIORITY[roleA] || 0;
      const priorityB = ROLE_PRIORITY[roleB] || 0;
      return priorityB - priorityA;
    });

    const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';

    container.innerHTML = sortedMembers.map(member => {
      const isSelf = String(member.userId) === currentUserId;
      const avatarUrl = member.avatarUrl || defaultAvatar;
      const role = String(member.conversationRole || 'MEMBER').toUpperCase();

      let roleClass = 'role-member';
      let roleLabel = t('role_member');
      if (role === 'CREATOR') {
        roleClass = 'role-creator';
        roleLabel = t('role_creator');
      } else if (role === 'ADMIN') {
        roleClass = 'role-admin';
        roleLabel = t('role_admin');
      }

      const isDeletable = !isSelf && canDeleteMember && (
        myRole === 'CREATOR' ||
        (myRole === 'ADMIN' && role === 'MEMBER') ||
        (!convo || !convo.group)
      );
      const isRoleEditable = !isSelf && role !== 'CREATOR' && canChangeRole && (
        myRole === 'CREATOR' ||
        (myRole === 'ADMIN' && role === 'MEMBER')
      );

      return `
        <div class="member-list-item" data-id="${member.userId}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: hsla(230, 25%, 6%, 0.25); cursor: default; transition: var(--transition-smooth);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatarUrl}" class="conversation-avatar" style="width: 36px; height: 36px; border-radius: 50%;" alt="${member.fullName || ''}">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary);">${member.fullName || t('not_updated')}${isSelf ? ` (${t('you')})` : ''}</span>
                <span class="role-badge ${roleClass}">${roleLabel}</span>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">@${member.username || t('no_username')}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            ${isRoleEditable ? `
            <button class="btn-change-role" data-id="${member.userId}" data-role="${role}" title="${t('change_role')}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; transition: all 0.2s ease; padding: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--warning);">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </button>
            ` : ''}
            ${isDeletable ? `
            <button class="btn-delete-member" data-id="${member.userId}" title="${t('delete_member_title')}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; transition: all 0.2s ease; padding: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--error);">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    const deleteButtons = container.querySelectorAll('.btn-delete-member');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const userId = btn.dataset.id;
        const memberObj = userConversations.find(u => String(u.userId) === String(userId));
        const memberName = memberObj?.fullName || memberObj?.user?.fullName || memberObj?.displayName || memberObj?.username || t('role_member');

        const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
        const confirm = await showDialog({
          title: t('delete_member_title'),
          message: t('delete_member_confirm').replace('{name}', memberName),
          type: 'warning',
          buttons: [
            { text: t('logout_cancel'), type: 'secondary', value: false },
            { text: t('delete'), type: 'danger', value: true }
          ]
        });

        if (confirm) {
          btn.disabled = true;
          btn.innerHTML = '<div class="spinner-sm" style="margin: 0; width: 14px; height: 14px; border-color: #fff;"></div>';

          try {
            const res = await api.delete(`conversations/${conversationId}/member/${userId}`);

            if (res && res.success) {
              if (convo && convo.userConversations) {
                convo.userConversations = convo.userConversations.filter(u => String(u.userId) !== String(userId));
              }
              renderMembersList();
              await showDialog({
                title: t('success_title'),
                message: t('delete_member_success').replace('{name}', memberName),
                type: 'success'
              });
            } else {
              throw new Error(res?.message || t('delete_member_failed'));
            }
          } catch (err) {
            btn.disabled = false;
            btn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--error);">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            `;
            await showDialog({
              title: t('error_title'),
              message: err.message || t('delete_member_error'),
              type: 'error'
            });
          }
        }
      });
    });

    const changeRoleButtons = container.querySelectorAll('.btn-change-role');
    changeRoleButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const userId = btn.dataset.id;
        const currentRole = btn.dataset.role;
        const memberObj = userConversations.find(u => String(u.userId) === String(userId));
        const memberName = memberObj?.fullName || memberObj?.user?.fullName || memberObj?.displayName || memberObj?.username || t('role_member');
        
        const newRole = currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN';
        const newRoleLabel = newRole === 'ADMIN' ? t('role_admin') : t('role_member');

        const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
        const confirm = await showDialog({
          title: t('confirm_change_role_title'),
          message: t('confirm_change_role_msg').replace('{name}', memberName).replace('{role}', newRoleLabel),
          type: 'warning',
          buttons: [
            { text: t('logout_cancel'), type: 'secondary', value: false },
            { text: t('submit') || 'Xác nhận', type: 'primary', value: true }
          ]
        });

        if (confirm) {
          btn.disabled = true;
          const oldIcon = btn.innerHTML;
          btn.innerHTML = '<div class="spinner-sm" style="margin: 0; width: 14px; height: 14px; border-color: #fff;"></div>';

          try {
            const res = await api.put(`conversations/${conversationId}/member/${userId}`, {
              conversationRole: newRole
            });

            if (res && res.success) {
              if (memberObj) {
                memberObj.conversationRole = newRole;
              }
              renderMembersList();
              
              // Trigger update in sidebar / main view
              document.dispatchEvent(new CustomEvent('refresh-conversations'));
              
              await showDialog({
                title: t('success_title'),
                message: t('change_role_success').replace('{name}', memberName).replace('{role}', newRoleLabel),
                type: 'success'
              });
            } else {
              throw new Error(res?.message || t('change_role_failed'));
            }
          } catch (err) {
            btn.disabled = false;
            btn.innerHTML = oldIcon;
            await showDialog({
              title: t('error_title'),
              message: err.message || t('change_role_failed'),
              type: 'error'
            });
          }
        }
      });
    });
  }
}
