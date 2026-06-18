import { socket } from '../../../js/core/websocket.js';
import { api } from '../../../js/core/api.js';

export function renderMessages(messages, conversationId) {
  const msgContainer = document.getElementById('chat-messages-container');
  if (!msgContainer) return;

  const lastOutgoingIndex = messages.map(m => m.sender).lastIndexOf('me');

  msgContainer.innerHTML = messages.map((msg, index) => {
    const msgType = String(msg.type || 'TEXT').toUpperCase();
    if (msgType === 'SMAIL') {
      return `
        <div class="message-row system-message-row" style="display: flex; justify-content: center; width: 100%; margin: 8px 0;">
          <div class="system-message-content" style="background-color: hsla(230, 25%, 15%, 0.4); border: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.75rem; padding: 4px 12px; border-radius: var(--radius-full); text-align: center; max-width: 80%; word-break: break-word;">
            ${msg.text}
          </div>
        </div>
      `;
    }

    const isOutgoing = msg.sender === 'me';
    const isPending = msg.status === 'pending' || msg.status === 'sending';
    const isFailed = msg.status === 'failed';
    const bubbleClass = `message-bubble message-${isOutgoing ? 'outgoing' : 'incoming'} ${isPending ? 'message-pending' : ''} ${isFailed ? 'message-failed' : ''} ${msg.isRevoked ? 'message-revoked' : ''}`;
    
    let contentHtml = msg.text || '';
    if (!msg.isRevoked) {
      const msgType = String(msg.type || 'TEXT').toUpperCase();
      if (msgType === 'IMAGE') {
        contentHtml = `<img src="${msg.text}" class="message-image" alt="Ảnh" style="max-width: 250px; max-height: 250px; border-radius: var(--radius-sm); margin-bottom: 5px; cursor: pointer; display: block;" onclick="window.open('${msg.text}', '_blank')">`;
      } else if (msgType === 'VIDEO') {
        contentHtml = `<video src="${msg.text}" controls style="max-width: 300px; max-height: 200px; border-radius: var(--radius-sm); display: block; margin-bottom: 5px; outline: none;"></video>`;
      } else if (msgType === 'AUDIO') {
        contentHtml = `<audio src="${msg.text}" controls style="width:100%; min-width: 220px; display: block; margin-bottom: 5px; outline: none;"></audio>`;
      } else if (msgType === 'FILE') {
        const fileName = msg.fileName || msg.text.split('/').pop() || 'Tệp tin';
        const fileHref = isPending || isFailed ? 'javascript:void(0)' : msg.text;
        const extraStyle = isPending || isFailed ? 'pointer-events: none; opacity: 0.6;' : '';
        contentHtml = `<a href="${fileHref}" target="_blank" class="message-file-link" style="display: inline-flex; align-items: center; gap: 8px; color: inherit; text-decoration: underline; word-break: break-all; ${extraStyle}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg><span>Tải tệp tin (${fileName})</span></a>`;
      }
    }

    let statusTextHtml = '';
    if (isOutgoing && index === lastOutgoingIndex) {
      if (isPending) {
        statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: var(--text-muted); align-self: flex-end; margin-top: 2px; margin-right: 4px;">Đang gửi...</div>`;
      } else if (msg.status === 'sent') {
        statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: var(--text-secondary); align-self: flex-end; margin-top: 2px; margin-right: 4px;">Đã gửi</div>`;
      } else if (msg.status === 'seen') {
        statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: var(--accent-color); align-self: flex-end; margin-top: 2px; margin-right: 4px; font-weight: 500;">Đã xem</div>`;
      } else if (isFailed) {
        statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: #ef4444; align-self: flex-end; margin-top: 2px; margin-right: 4px; font-weight: 500;">Gửi lỗi</div>`;
      }
    }

    const rowAlign = isOutgoing ? 'align-items: flex-end;' : 'align-items: flex-start;';
    const displayOptions = isOutgoing && !isPending && !isFailed && !msg.isRevoked;

    return `
      <div class="message-row" style="display: flex; flex-direction: column; ${rowAlign} width: 100%;">
        <div style="display: flex; align-items: center; gap: 8px; justify-content: ${isOutgoing ? 'flex-end' : 'flex-start'}; width: 100%; position: relative;" class="message-bubble-wrapper">
          ${displayOptions ? `
            <div class="message-options-dropdown">
              <button class="btn-message-options" data-id="${msg.id}" title="Tuỳ chọn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="1.5"></circle>
                  <circle cx="12" cy="5" r="1.5"></circle>
                  <circle cx="12" cy="19" r="1.5"></circle>
                </svg>
              </button>
              <div class="message-dropdown-menu" id="dropdown-${msg.id}" style="display: none;">
                <button class="dropdown-item btn-revoke-message" data-id="${msg.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--error);">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  <span style="color: var(--error);">Thu hồi</span>
                </button>
              </div>
            </div>
          ` : ''}
          <div class="${bubbleClass}">${contentHtml}<div style="font-size: 0.7rem; text-align: right; opacity: 0.7; margin-top: 4px; white-space: normal;">${msg.time}</div></div>
        </div>
        ${statusTextHtml}
      </div>
    `;
  }).join('');

  // Bind click event on message options buttons
  const optionsButtons = msgContainer.querySelectorAll('.btn-message-options');
  optionsButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.id;
      const dropdown = document.getElementById(`dropdown-${messageId}`);
      if (!dropdown) return;
      
      const isVisible = dropdown.style.display === 'block';
      msgContainer.querySelectorAll('.message-dropdown-menu').forEach(menu => {
        if (menu.id !== `dropdown-${messageId}`) {
          menu.style.display = 'none';
        }
      });
      
      dropdown.style.display = isVisible ? 'none' : 'block';
    });
  });

  // Close dropdowns on document click
  const documentClickListener = () => {
    msgContainer.querySelectorAll('.message-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
    document.removeEventListener('click', documentClickListener);
  };

  optionsButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        document.addEventListener('click', documentClickListener);
      }, 0);
    });
  });

  // Bind click event on revoke buttons
  const revokeButtons = msgContainer.querySelectorAll('.btn-revoke-message');
  revokeButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.id;

      // Close dropdown immediately
      const dropdown = document.getElementById(`dropdown-${messageId}`);
      if (dropdown) dropdown.style.display = 'none';
      
      const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
      const confirm = await showDialog({
        title: 'Thu hồi tin nhắn',
        message: 'Bạn có chắc chắn muốn thu hồi tin nhắn này không?',
        type: 'warning',
        buttons: [
          { text: 'Hủy', type: 'secondary', value: false },
          { text: 'Thu hồi', type: 'danger', value: true }
        ]
      });

      if (confirm) {
        if (conversationId && messageId) {
          socket.sendRevoke(conversationId, messageId);
        }
      }
    });
  });

  msgContainer.scrollTop = msgContainer.scrollHeight;
}

export function updateChatHeader(title, avatarUrl, statusText, conversationId = null, conversations = []) {
  const partnerInfo = document.getElementById('chat-partner-info');
  if (!partnerInfo) return;

  partnerInfo.innerHTML = `
    <button id="btn-back-to-list" class="btn-icon-back">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    <img src="${avatarUrl}" class="conversation-avatar" alt="${title}">
    <div>
      <h4 style="font-size: 0.95rem; font-weight: 600;">${title}</h4>
      <p style="font-size: 0.8rem; color: var(--success)">${statusText}</p>
    </div>
  `;

  const backBtn = partnerInfo.querySelector('#btn-back-to-list');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const dashboard = document.querySelector('.chat-dashboard');
      if (dashboard) {
        dashboard.classList.remove('show-chat');
      }
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
      const canAddMember = !convo || !convo.group || myRole === 'CREATOR';

      headerActions.innerHTML = `
        <div class="chat-header-options">
          <button id="btn-chat-options" class="btn-chat-options" title="Tùy chọn cuộc trò chuyện">
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
              Thêm thành viên
            </button>
            ` : ''}
            <button class="dropdown-item" id="option-view-members">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Thành viên nhóm
            </button>
            ${convo?.group ? `
            <button class="dropdown-item" id="option-leave-convo">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--error);">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span style="color: var(--error);">Rời nhóm</span>
            </button>
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
        optAddMember.addEventListener('click', (e) => {
          e.stopPropagation();
          if (dropdown) dropdown.style.display = 'none';
          showAddMemberModal(conversationId, conversations);
        });
      }

      const optViewMembers = headerActions.querySelector('#option-view-members');
      if (optViewMembers) {
        optViewMembers.addEventListener('click', (e) => {
          e.stopPropagation();
          if (dropdown) dropdown.style.display = 'none';
          showViewMembersModal(conversationId, conversations);
        });
      }

      const optLeaveConvo = headerActions.querySelector('#option-leave-convo');
      if (optLeaveConvo) {
        optLeaveConvo.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (dropdown) dropdown.style.display = 'none';

          const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
          const confirm = await showDialog({
            title: 'Rời khỏi cuộc trò chuyện',
            message: 'Bạn có chắc chắn muốn rời khỏi nhóm trò chuyện này không?',
            type: 'warning',
            buttons: [
              { text: 'Hủy', type: 'secondary', value: false },
              { text: 'Rời nhóm', type: 'danger', value: true }
            ]
          });

          if (confirm) {
            socket.sendLeaveConversation(conversationId);
          }
        });
      }
    } else {
      headerActions.innerHTML = '';
    }
  }
}

export function renderEmptyChatFrame() {
  const partnerInfo = document.getElementById('chat-partner-info');
  if (partnerInfo) {
    partnerInfo.innerHTML = `
      <div style="font-size: 0.95rem; font-weight: 500; color: var(--text-muted);">
        Không có cuộc hội thoại nào đang mở
      </div>
    `;
  }
  const headerActions = document.getElementById('chat-header-actions');
  if (headerActions) {
    headerActions.innerHTML = '';
  }
  const msgContainer = document.getElementById('chat-messages-container');
  if (msgContainer) {
    msgContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; color: var(--text-muted);">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <p>Chọn hoặc tạo cuộc trò chuyện để bắt đầu nhắn tin.</p>
      </div>
    `;
  }
}

function showAddMemberModal(conversationId, conversations) {
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
        <h3>Thêm thành viên</h3>
        <button class="btn-close-modal" id="btn-close-add-modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="chat-modal-body">
        <div class="search-bar-wrapper" style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input type="text" id="modal-user-search-input" class="form-input" placeholder="Tìm kiếm theo email, tên..." style="flex: 1;">
          <button id="btn-modal-user-search" class="btn btn-primary" style="width: auto; height: 38px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 16px;">
            Tìm
          </button>
        </div>
        <div id="modal-users-list" class="users-list-wrapper" style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 4px;">
          <!-- User list cards -->
        </div>
        <div id="modal-load-more-container" style="display: flex; justify-content: center; margin-top: 10px;"></div>
      </div>
      <div class="chat-modal-footer">
        <button class="btn btn-secondary" id="btn-cancel-add-member">Hủy</button>
        <button class="btn btn-primary" id="btn-confirm-add-member">Thêm</button>
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

  overlay.querySelector('#btn-confirm-add-member').addEventListener('click', () => {
    if (selectedUserIds.size === 0) {
      closeModal();
      return;
    }
    socket.sendAddMember(conversationId, Array.from(selectedUserIds));
    closeModal();
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
          Đang tải danh sách...
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
          Không tìm thấy thành viên nào có thể thêm.
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
            <span class="user-list-name" style="font-size: 0.85rem;">${user.fullName || 'Chưa cập nhật'}</span>
            <span class="user-list-username" style="font-size: 0.75rem;">@${user.username || 'chưa_có'}</span>
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
            ${listLoading ? '<div class="spinner-sm" style="display:inline-block; vertical-align:middle; margin-right:6px;"></div> Đang tải...' : 'Xem thêm'}
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

function showViewMembersModal(conversationId, conversations) {
  const currentUserId = String(localStorage.getItem('chat_user_id'));

  const overlay = document.createElement('div');
  overlay.className = 'chat-modal-overlay';

  overlay.innerHTML = `
    <div class="chat-modal-card">
      <div class="chat-modal-header">
        <h3>Danh sách thành viên</h3>
        <button class="btn-close-modal" id="btn-close-view-modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="chat-modal-body" id="modal-members-list-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto;">
        <!-- Members list -->
      </div>
      <div class="chat-modal-footer">
        <button class="btn btn-secondary" id="btn-close-view-members">Đóng</button>
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
          Không có thành viên nào.
        </div>
      `;
      return;
    }

    const myConvoEntry = userConversations.find(u => String(u.userId) === currentUserId);
    const myRole = myConvoEntry ? String(myConvoEntry.conversationRole || 'MEMBER').toUpperCase() : 'MEMBER';
    const canDeleteMember = !convo || !convo.group || myRole === 'CREATOR';

    const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';

    container.innerHTML = userConversations.map(member => {
      const isSelf = String(member.userId) === currentUserId;
      const avatarUrl = member.avatarUrl || defaultAvatar;
      const role = String(member.conversationRole || 'MEMBER').toUpperCase();

      let roleClass = 'role-member';
      let roleLabel = 'Thành viên';
      if (role === 'CREATOR') {
        roleClass = 'role-creator';
        roleLabel = 'Chủ phòng';
      } else if (role === 'ADMIN') {
        roleClass = 'role-admin';
        roleLabel = 'Phó phòng';
      }

      return `
        <div class="member-list-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: hsla(230, 25%, 6%, 0.25);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatarUrl}" class="conversation-avatar" style="width: 36px; height: 36px; border-radius: 50%;" alt="${member.fullName || ''}">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary);">${member.fullName || 'Chưa cập nhật'}${isSelf ? ' (Bạn)' : ''}</span>
                <span class="role-badge ${roleClass}">${roleLabel}</span>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">@${member.username || 'chưa_có'}</span>
            </div>
          </div>
          ${(isSelf || !canDeleteMember) ? '' : `
          <button class="btn-delete-member" data-id="${member.userId}" title="Xóa khỏi cuộc trò chuyện" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 6px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; transition: var(--transition-smooth);">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
          `}
        </div>
      `;
    }).join('');

    const deleteButtons = container.querySelectorAll('.btn-delete-member');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetUserId = btn.dataset.id;
        const memberName = btn.closest('.member-list-item').querySelector('span').textContent.replace(' (Bạn)', '').trim();

        const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
        const confirm = await showDialog({
          title: 'Xóa thành viên',
          message: `Bạn có chắc chắn muốn xóa ${memberName} khỏi cuộc trò chuyện này không?`,
          type: 'warning',
          buttons: [
            { text: 'Hủy', type: 'secondary', value: false },
            { text: 'Xóa', type: 'danger', value: true }
          ]
        });

        if (confirm) {
          socket.sendDeleteMember(conversationId, [targetUserId]);
        }
      });
    });
  }
}
