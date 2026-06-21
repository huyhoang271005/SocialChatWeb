function formatLastMessageText(text) {
  if (!text || typeof text !== 'string') return 'Chưa có tin nhắn nào';
  if (text === 'Tin nhắn đã bị thu hồi') return text;
  
  const trimmed = text.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const lower = trimmed.toLowerCase();
    
    // Cloudinary resource types or extension check
    if (lower.includes('/image/upload/') || 
        /\.(jpg|jpeg|png|gif|webp|svg|heic)$/i.test(lower)) {
      return '[Hình ảnh]';
    }
    
    if (lower.includes('/video/upload/') || 
        /\.(mp4|webm|mkv|avi|mov|flv|wmv)$/i.test(lower)) {
      // Check if it's an audio file uploaded under video type in Cloudinary
      if (lower.includes('voice_') || /\.(mp3|wav|ogg|aac|m4a)$/i.test(lower)) {
        return '[Âm thanh]';
      }
      return '[Video]';
    }
    
    if (lower.includes('/raw/upload/') || 
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|txt|json)$/i.test(lower)) {
      return '[Tài liệu]';
    }

    // Default fallback if it's a URL but doesn't match above patterns
    return '[Tệp tin]';
  }
  
  return text;
}

export function renderConversationsList(conversations, activeConversationId, getUserNameAndAvatarCallback, selectConversationCallback, muteConversationCallback, deleteConversationCallback) {
  const listContainer = document.getElementById('conversations-list-container');
  if (!listContainer) return;

  if (conversations.length === 0) {
    listContainer.innerHTML = `
      <div class="list-fallback-state" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        Chưa có cuộc trò chuyện nào.<br>Hãy tạo từ quản lý người dùng.
      </div>
    `;
    return;
  }

  const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
  const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';
  const currentUserId = localStorage.getItem('chat_user_id');

  let html = conversations.map(convo => {
    const isActive = String(convo.conversationId) === String(activeConversationId);

    // Avatar
    let avatarUrl = convo.conversationAvatarUrl;
    if (!avatarUrl) {
      avatarUrl = convo.group ? defaultGroupAvatar : defaultUserAvatar;
    }

    // Title
    let displayTitle = convo.title;
    const elementUniqueId = `convo-title-${convo.conversationId}`;
    const avatarUniqueId = `convo-avatar-${convo.conversationId}`;

    if (!displayTitle) {
      if (!convo.group) {
        const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
        if (otherParticipant) {
          displayTitle = otherParticipant.fullName ||
                         otherParticipant.user?.fullName ||
                         otherParticipant.displayName ||
                         otherParticipant.username ||
                         otherParticipant.user?.username ||
                         'Người dùng';
          if (otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl) {
            avatarUrl = otherParticipant.avatarUrl || otherParticipant.user.avatarUrl;
          }
        } else {
          displayTitle = 'Trò chuyện #' + convo.conversationId;
        }
      } else {
        displayTitle = 'Nhóm trò chuyện #' + convo.conversationId;
      }
    }

    // Last message
    const isLastMessageRevoked = convo.revoked === true || convo.lastMessage?.revoked === true || convo.lastMessageRevoked === true || (convo.lastMessageId && !convo.lastMessageText);
    const rawText = isLastMessageRevoked ? 'Tin nhắn đã bị thu hồi' : convo.lastMessageText;
    const formattedText = formatLastMessageText(rawText);
    let previewText = formattedText;

    if (rawText && rawText !== 'Chưa có tin nhắn nào') {
      let senderPrefix = '';
      const lastSenderId = convo.lastMessageSenderId || convo.lastSenderId || convo.senderId || convo.lastMessage?.senderId || convo.lastMessage?.sender;
      if (lastSenderId) {
        if (String(lastSenderId) === String(currentUserId)) {
          senderPrefix = 'Bạn: ';
        } else {
          const senderObj = convo.userConversations?.find(u => String(u.userId) === String(lastSenderId));
          if (senderObj) {
            const sName = senderObj.fullName ||
                          senderObj.user?.fullName ||
                          senderObj.displayName ||
                          senderObj.username ||
                          senderObj.user?.username;
            if (sName) {
              senderPrefix = `${sName}: `;
            }
          }
        }
      }
      previewText = senderPrefix + formattedText;
    }

    // Last message time
    let timeStr = '';
    if (convo.lastMessageTime) {
      try {
        const d = new Date(convo.lastMessageTime);
        timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        timeStr = '';
      }
    }

    const unreadBadgeHtml = convo.unreadMessage && convo.unreadMessage > 0 ? `
      <span class="unread-badge">${convo.unreadMessage}</span>
    ` : '';

    const isMuted = convo.isMuted === true || convo.muted === true;
    const muteIconHtml = isMuted ? `
      <span class="convo-mute-icon" style="margin-left: 6px; color: var(--text-muted); opacity: 0.7; display: inline-flex; align-items: center; vertical-align: middle;" title="Đã tắt tiếng">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      </span>
    ` : '';

    return `
      <div class="conversation-item ${isActive ? 'active' : ''}" data-id="${convo.conversationId}">
        <div class="conversation-avatar-wrapper">
          <img src="${avatarUrl}" id="${avatarUniqueId}" class="conversation-avatar" alt="${convo.title || 'Avatar'}">
        </div>
        <div class="conversation-details">
          <div class="conversation-meta" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span class="conversation-name" id="${elementUniqueId}" style="display: inline-flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">${displayTitle}${muteIconHtml}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="conversation-time">${timeStr}</span>
              <div class="convo-options-dropdown" style="position: relative;">
                <button class="btn-convo-options" data-id="${convo.conversationId}" title="Tuỳ chọn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="1.5"></circle>
                    <circle cx="12" cy="5" r="1.5"></circle>
                    <circle cx="12" cy="19" r="1.5"></circle>
                  </svg>
                </button>
                <div class="convo-dropdown-menu" id="convo-dropdown-${convo.conversationId}" style="display: none;">
                  <button class="dropdown-item btn-mute-convo" data-id="${convo.conversationId}" data-muted="${isMuted}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                      <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                      ${isMuted ? `
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                      ` : `
                        <line x1="23" y1="9" x2="17" y2="15"></line>
                        <line x1="17" y1="9" x2="23" y2="15"></line>
                      `}
                    </svg>
                    <span>${isMuted ? 'Bật tiếng' : 'Tắt tiếng'}</span>
                  </button>
                  <button class="dropdown-item btn-delete-convo" data-id="${convo.conversationId}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--error);">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span style="color: var(--error);">Xoá</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div class="conversation-preview">${previewText}</div>
            ${unreadBadgeHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  listContainer.innerHTML = html;

  // Bind click events on conversation items
  const items = listContainer.querySelectorAll('.conversation-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      const convoId = item.dataset.id;
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      selectConversationCallback(convoId);

      const dashboard = document.querySelector('.chat-dashboard');
      if (dashboard) {
        dashboard.classList.add('show-chat');
      }
    });
  });

  // Bind click events on conversation options buttons
  const optBtns = listContainer.querySelectorAll('.btn-convo-options');
  optBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const convoId = btn.dataset.id;
      const dropdown = document.getElementById(`convo-dropdown-${convoId}`);
      if (!dropdown) return;

      const isVisible = dropdown.style.display === 'block';
      listContainer.querySelectorAll('.convo-dropdown-menu').forEach(menu => {
        if (menu.id !== `convo-dropdown-${convoId}`) {
          menu.style.display = 'none';
        }
      });
      dropdown.style.display = isVisible ? 'none' : 'block';
    });
  });

  // Close dropdowns on document click
  const documentClickListener = () => {
    listContainer.querySelectorAll('.convo-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
    document.removeEventListener('click', documentClickListener);
  };

  optBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        document.addEventListener('click', documentClickListener);
      }, 0);
    });
  });

  // Bind mute events
  const muteBtns = listContainer.querySelectorAll('.btn-mute-convo');
  muteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const convoId = btn.dataset.id;
      const isMuted = btn.dataset.muted === 'true';

      // Close dropdown immediately
      const dropdown = document.getElementById(`convo-dropdown-${convoId}`);
      if (dropdown) dropdown.style.display = 'none';

      if (muteConversationCallback) {
        muteConversationCallback(convoId, isMuted);
      }
    });
  });

  // Bind delete events
  const deleteBtns = listContainer.querySelectorAll('.btn-delete-convo');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const convoId = btn.dataset.id;

      // Close dropdown immediately
      const dropdown = document.getElementById(`convo-dropdown-${convoId}`);
      if (dropdown) dropdown.style.display = 'none';

      if (deleteConversationCallback) {
        deleteConversationCallback(convoId);
      }
    });
  });
}
