import { api } from '../../../../js/core/api.js';
import { t } from '../../../../js/core/i18n.js';

export function showAddMemberModal(conversationId, conversations) {
  let usersList = [];
  let selectedUserIds = new Set();
  let searchTerm = '';
  let hasMore = false;
  let listLoading = false;

  const overlay = document.createElement('div');
  overlay.className = 'chat-modal-overlay';

  overlay.innerHTML = `
    <div class="chat-modal-card">
      <div class="chat-modal-header">
        <h3>${t('add_member')}</h3>
        <button class="btn-close-modal" id="btn-close-add-modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="chat-modal-body">
        <div class="search-bar-wrapper" style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input type="text" id="modal-user-search-input" class="form-input" placeholder="${t('search_users_placeholder')}" style="flex: 1;">
          <button id="btn-modal-user-search" class="btn btn-primary" style="width: auto; height: 38px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 16px;">
            ${t('search')}
          </button>
        </div>
        <div id="modal-users-list" class="users-list-wrapper" style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 4px;">
          <!-- User list cards -->
        </div>
        <div id="modal-load-more-container" style="display: flex; justify-content: center; margin-top: 10px;"></div>
      </div>
      <div class="chat-modal-footer">
        <button class="btn btn-secondary" id="btn-cancel-add-member">${t('voice_preview_cancel')}</button>
        <button class="btn btn-primary" id="btn-confirm-add-member">${t('add_member')}</button>
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

  overlay.querySelector('#btn-close-add-modal').addEventListener('click', closeModal);
  overlay.querySelector('#btn-cancel-add-member').addEventListener('click', closeModal);

  overlay.querySelector('#btn-confirm-add-member').addEventListener('click', async () => {
    if (selectedUserIds.size === 0) {
      closeModal();
      return;
    }

    const confirmBtn = overlay.querySelector('#btn-confirm-add-member');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<div class="spinner-sm" style="margin: 0; width: 14px; height: 14px; border-color: #fff;"></div>';

    try {
      const userIds = Array.from(selectedUserIds).map(id => Number(id));
      const res = await api.post('conversations/member', { conversationId, userIds });
      if (res && res.success) {
        closeModal();
        const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
        await showDialog({
          title: t('success_title'),
          message: t('add_member_success_msg'),
          type: 'success'
        });
      } else {
        throw new Error(res?.message || t('add_member_failed_msg'));
      }
    } catch (err) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = t('add_member');
      const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
      await showDialog({
        title: t('error_title'),
        message: err.message || t('add_member_error_msg'),
        type: 'error'
      });
    }
  });

  const searchInput = overlay.querySelector('#modal-user-search-input');
  const searchBtn = overlay.querySelector('#btn-modal-user-search');

  const executeSearch = () => {
    searchTerm = searchInput.value.trim();
    usersList = [];
    loadModalUsers();
  };

  searchBtn.addEventListener('click', executeSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  });

  loadModalUsers();

  async function loadModalUsers(nextPage = false) {
    if (listLoading) return;
    listLoading = true;

    const usersListContainer = overlay.querySelector('#modal-users-list');
    const loadMoreContainer = overlay.querySelector('#modal-load-more-container');

    if (usersListContainer && (usersList.length === 0 || !nextPage)) {
      usersListContainer.innerHTML = `
        <div class="list-fallback-state" style="padding: 20px; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div class="spinner-sm" style="margin-bottom: 8px;"></div>
          ${t('loading_list')}
        </div>
      `;
    }

    try {
      let url = 'profiles/list';
      const params = [];
      if (searchTerm) {
        params.push(`emailName=${encodeURIComponent(searchTerm)}`);
      }
      if (nextPage && usersList.length > 0) {
        const lastUser = usersList[usersList.length - 1];
        const lastId = lastUser.userId;
        if (lastId) {
          params.push(`lastId=${encodeURIComponent(lastId)}`);
        }
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const res = await api.get(url);
      if (res && res.success && res.data) {
        const listData = Array.isArray(res.data) ? res.data : (res.data.data || []);
        hasMore = res.data.hasMore === true;
        if (nextPage) {
          usersList = [...usersList, ...listData];
        } else {
          usersList = listData;
        }
      } else {
        if (!nextPage) usersList = [];
      }
    } catch (err) {
      console.error('Failed to load users for modal:', err);
      if (!nextPage) usersList = [];
    } finally {
      listLoading = false;
      renderModalUsersList();
    }
  }

  function renderModalUsersList() {
    const usersListContainer = overlay.querySelector('#modal-users-list');
    const loadMoreContainer = overlay.querySelector('#modal-load-more-container');
    if (!usersListContainer) return;

    const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
    const memberIds = convo && convo.userConversations ? convo.userConversations.map(u => String(u.userId)) : [];
    const currentUserId = String(localStorage.getItem('chat_user_id'));

    const availableUsers = usersList.filter(user => {
      const userIdStr = String(user.userId);
      return userIdStr !== currentUserId && !memberIds.includes(userIdStr);
    });

    if (availableUsers.length === 0) {
      usersListContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 40px 20px; font-size: 0.9rem;">
          ${t('no_addable_members')}
        </div>
      `;
      if (loadMoreContainer) loadMoreContainer.innerHTML = '';
      return;
    }

    const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';

    usersListContainer.innerHTML = availableUsers.map(user => {
      const isChecked = selectedUserIds.has(String(user.userId));
      const avatarUrl = user.avatarUrl || defaultAvatar;

      return `
        <div class="user-list-card" data-id="${user.userId}" style="padding: 10px 14px; margin-bottom: 2px;">
          <div class="user-list-checkbox-wrapper" onclick="event.stopPropagation()">
            <input type="checkbox" class="modal-user-checkbox user-checkbox" data-id="${user.userId}" ${isChecked ? 'checked' : ''}>
          </div>
          <img src="${avatarUrl}" class="user-list-avatar" style="width: 38px; height: 38px;" alt="${user.fullName}">
          <div class="user-list-info">
            <span class="user-list-name" style="font-size: 0.85rem;">${user.fullName || t('not_updated')}</span>
            <span class="user-list-username" style="font-size: 0.75rem;">@${user.username || t('no_username')}</span>
          </div>
        </div>
      `;
    }).join('');

    const cards = usersListContainer.querySelectorAll('.user-list-card');
    cards.forEach(card => {
      const cb = card.querySelector('.modal-user-checkbox');
      
      card.addEventListener('click', () => {
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        }
      });

      if (cb) {
        cb.addEventListener('change', (e) => {
          const userIdStr = String(cb.dataset.id);
          if (e.target.checked) {
            selectedUserIds.add(userIdStr);
            card.classList.add('active');
          } else {
            selectedUserIds.delete(userIdStr);
            card.classList.remove('active');
          }
        });
        if (cb.checked) {
          card.classList.add('active');
        }
      }
    });

    if (loadMoreContainer) {
      if (hasMore) {
        loadMoreContainer.innerHTML = `
          <button id="btn-modal-load-more" class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px; height: auto;">
            ${listLoading ? `<div class="spinner-sm" style="display:inline-block; vertical-align:middle; margin-right:6px;"></div> ${t('loading')}` : t('see_more')}
          </button>
        `;
        const loadMoreBtn = overlay.querySelector('#btn-modal-load-more');
        if (loadMoreBtn && !listLoading) {
          loadMoreBtn.addEventListener('click', () => {
            loadModalUsers(true);
          });
        }
      } else {
        loadMoreContainer.innerHTML = '';
      }
    }
  }
}
