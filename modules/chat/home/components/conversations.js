import { t, formatSystemMessage } from '../../../../js/core/i18n.js';


function formatLastMessageText(text) {
  if (!text || typeof text !== 'string') return t('no_messages_yet');
  if (text === 'Tin nhắn đã bị thu hồi' || text === t('revoked_msg')) return t('revoked_msg');
  
  const trimmed = text.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const lower = trimmed.toLowerCase();
    
    // Cloudinary resource types or extension check
    if (lower.includes('/image/upload/') || 
        /\.(jpg|jpeg|png|gif|webp|svg|heic)$/i.test(lower)) {
      return t('snippet_image');
    }
    
    if (lower.includes('/video/upload/') || 
        /\.(mp4|webm|mkv|avi|mov|flv|wmv)$/i.test(lower)) {
      // Check if it's an audio file uploaded under video type in Cloudinary
      if (lower.includes('voice_') || /\.(mp3|wav|ogg|aac|m4a)$/i.test(lower)) {
        return t('snippet_audio');
      }
      return t('snippet_video');
    }
    
    if (lower.includes('/raw/upload/') || 
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|txt|json)$/i.test(lower)) {
      return t('snippet_file');
    }

    // Default fallback if it's a URL but doesn't match above patterns
    return t('snippet_file');
  }
  
  return text;
}

export function getAvatarHtml(convo, currentUserId, avatarUniqueId = null, fallbackTitle = 'Avatar', fallbackAvatarUrl = null) {
  const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
  const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';

  const elementIdAttr = avatarUniqueId ? `id="${avatarUniqueId}"` : '';

  // 1. If conversation has custom avatar URL
  if (convo && convo.conversationAvatarUrl) {
    return `<img src="${convo.conversationAvatarUrl}" ${elementIdAttr} class="conversation-avatar" alt="${convo.title || fallbackTitle}">`;
  }

  // 2. If it's a group conversation, generate composite avatar
  if (convo && convo.group) {
    const members = [...(convo.userConversations || [])];

    // Sắp xếp theo chiều giảm dần của joinAt hoặc createdAt
    members.sort((a, b) => {
      const timeA = new Date(a.joinAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.joinAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    if (members.length === 0) {
      return `<img src="${defaultGroupAvatar}" ${elementIdAttr} class="conversation-avatar" alt="${convo.title || fallbackTitle}">`;
    }
    if (members.length === 1) {
      const u = members[0];
      const avatarUrl = u.avatarUrl || u.user?.avatarUrl || defaultUserAvatar;
      return `<img src="${avatarUrl}" ${elementIdAttr} class="conversation-avatar" alt="${convo.title || fallbackTitle}">`;
    }

    const displayMembers = members.slice(0, 3);
    const remainingCount = members.length - 3;

    let itemsHtml = '';
    displayMembers.forEach(u => {
      const avatarUrl = u.avatarUrl || u.user?.avatarUrl || defaultUserAvatar;
      itemsHtml += `<img src="${avatarUrl}" class="composite-avatar-item" alt="avatar">`;
    });

    if (remainingCount > 0) {
      itemsHtml += `<div class="composite-avatar-item count-badge">+${remainingCount}</div>`;
    }

    const layoutClass = `layout-${members.length > 3 ? 4 : members.length}`;

    return `
      <div ${elementIdAttr} class="conversation-avatar composite-avatar ${layoutClass}">
        ${itemsHtml}
      </div>
    `;
  }

  // 3. If it's an individual chat
  let avatarUrl = fallbackAvatarUrl || defaultUserAvatar;
  if (convo && !convo.group) {
    const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
    if (otherParticipant && (otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl)) {
      avatarUrl = otherParticipant.avatarUrl || otherParticipant.user.avatarUrl;
    }
  }

  return `<img src="${avatarUrl}" ${elementIdAttr} class="conversation-avatar" alt="${(convo && convo.title) || fallbackTitle}">`;
}

export function renderConversationsList(conversations, activeConversationId, getUserNameAndAvatarCallback, selectConversationCallback, muteConversationCallback, deleteConversationCallback) {
  const listContainer = document.getElementById('conversations-list-container');
  if (!listContainer) return;

  if (conversations.length === 0) {
    listContainer.innerHTML = `
      <div class="list-fallback-state" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        ${t('no_conversations_yet')}
      </div>
    `;
    return;
  }

  const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
  const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';
  const currentUserId = localStorage.getItem('chat_user_id');

  let html = conversations.map(convo => {
    const isActive = String(convo.conversationId) === String(activeConversationId);

    // Title & Avatar resolution
    let displayTitle = convo.title;
    let avatarUrl = convo.conversationAvatarUrl;
    const elementUniqueId = `convo-title-${convo.conversationId}`;
    const avatarUniqueId = `convo-avatar-${convo.conversationId}`;

    if (!convo.group) {
      // 1-on-1 chat: Set title = other person's fullName, avatar = other person's avatarUrl
      const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
      if (otherParticipant) {
        displayTitle = otherParticipant.fullName ||
                       otherParticipant.user?.fullName ||
                       otherParticipant.displayName ||
                       otherParticipant.username ||
                       otherParticipant.user?.username ||
                       displayTitle ||
                       t('user');
        avatarUrl = otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl || defaultUserAvatar;
      } else {
        displayTitle = displayTitle || t('chat') + ' #' + convo.conversationId;
        avatarUrl = avatarUrl || defaultUserAvatar;
      }
    } else {
      // Group chat
      displayTitle = displayTitle || t('group_chat_prefix') + ' #' + convo.conversationId;
      avatarUrl = avatarUrl || defaultGroupAvatar;
    }

    // Last message
    const isLastMessageRevoked = convo.revoked === true || convo.lastMessage?.revoked === true || convo.lastMessageRevoked === true || (convo.lastMessageId && !convo.lastMessageText);
    
    let lastMsgText = convo.lastMessageText;
    const lastMsgType = String(convo.lastMessage?.type || convo.lastMessageType || '').toUpperCase();
    const isSystemMsg = lastMsgType === 'REMOVE_MEMBER' || lastMsgType === 'ADD_MEMBER' || lastMsgType === 'LEAVED';
    if (isSystemMsg) {
      const smailRawText = convo.lastMessage?.text || convo.lastMessage?.message || convo.lastMessage?.rawText || convo.lastMessageText || '';
      lastMsgText = formatSystemMessage(lastMsgType, smailRawText);
    }

    const rawText = isLastMessageRevoked ? t('revoked_msg') : lastMsgText;
    const formattedText = formatLastMessageText(rawText);
    let previewText = formattedText;

    if (rawText && rawText !== t('no_messages_yet') && !isSystemMsg) {
      let senderPrefix = '';
      const lastSenderId = convo.lastMessageSenderId || convo.lastSenderId || convo.senderId || convo.lastMessage?.senderId || convo.lastMessage?.sender;
      if (lastSenderId) {
        if (String(lastSenderId) === String(currentUserId)) {
          senderPrefix = t('you') + ': ';
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

    const myUserConvo = convo.userConversations?.find(u => String(u.userId) === String(currentUserId));
    const unreadCount = myUserConvo && myUserConvo.unreadMessage !== undefined && myUserConvo.unreadMessage !== null
      ? parseInt(myUserConvo.unreadMessage || 0, 10)
      : parseInt(convo.unreadMessage || 0, 10);

    const unreadBadgeHtml = unreadCount > 0 ? `
      <span class="unread-badge">${unreadCount}</span>
    ` : '';

    const isMuted = convo.isMuted === true || convo.muted === true;
    const muteIconHtml = isMuted ? `
      <span class="convo-mute-icon" style="margin-left: 6px; color: var(--text-muted); opacity: 0.7; display: inline-flex; align-items: center; vertical-align: middle;" title="${t('muted')}">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
          <line x1="23" y1="9" x2="17" y2="15"></line>
          <line x1="17" y1="9" x2="23" y2="15"></line>
        </svg>
      </span>
    ` : '';

    const avatarHtml = getAvatarHtml(convo, currentUserId, avatarUniqueId, displayTitle, avatarUrl);

    return `
      <div class="conversation-item ${isActive ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}" data-id="${convo.conversationId}">
        <div class="conversation-avatar-wrapper">
          ${avatarHtml}
        </div>
        <div class="conversation-details">
        <div class="conversation-meta" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span class="conversation-name" id="${elementUniqueId}" style="display: inline-flex; align-items: center; gap: 4px; overflow: hidden; min-width: 0; flex: 1;">
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayTitle}</span>${muteIconHtml}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="conversation-time">${timeStr}</span>
              <div class="convo-options-dropdown" style="position: relative;">
                <button class="btn-convo-options desktop-convo-options" data-id="${convo.conversationId}" title="${t('options')}">
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
                    <span>${isMuted ? t('unmute') : t('mute')}</span>
                  </button>
                  <button class="dropdown-item btn-delete-convo" data-id="${convo.conversationId}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--error);">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span style="color: var(--error);">${t('delete')}</span>
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

      // Close all conversation dropdown menus when selecting a conversation
      listContainer.querySelectorAll('.convo-dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
      });

      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      selectConversationCallback(convoId);

      const dashboard = document.querySelector('.chat-dashboard');
      if (dashboard) {
        dashboard.classList.add('show-chat');
      }
    });

    // Mobile: long-press opens dropdown
    let longPressTimer = null;
    let longPressJustFired = false;
    const LONG_PRESS_MS = 500;

    const openConvoDropdown = (convoId) => {
      const dropdown = document.getElementById(`convo-dropdown-${convoId}`);
      if (!dropdown) return;
      // Close all other dropdowns
      listContainer.querySelectorAll('.convo-dropdown-menu').forEach(menu => {
        if (menu.id !== `convo-dropdown-${convoId}`) menu.style.display = 'none';
      });
      dropdown.style.display = 'block';
      // Delay adding the close listener so the touchend-generated click doesn't immediately close it
      setTimeout(() => document.addEventListener('click', function closeFn(ev) {
        if (!dropdown.contains(ev.target) && !item.contains(ev.target)) {
          dropdown.style.display = 'none';
          document.removeEventListener('click', closeFn);
        }
      }), 350);
    };

    item.addEventListener('touchstart', (e) => {
      const convoId = item.dataset.id;
      longPressJustFired = false;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        longPressJustFired = true;
        if (e.cancelable) e.preventDefault();
        openConvoDropdown(convoId);
      }, LONG_PRESS_MS);
    }, { passive: false });

    item.addEventListener('touchend', (e) => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      // Suppress the synthetic click that fires after long-press touchend
      if (longPressJustFired) {
        e.preventDefault();
        e.stopPropagation();
        longPressJustFired = false;
      }
    });

    item.addEventListener('touchmove', () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      longPressJustFired = false;
    });

    // Right-click on desktop
    item.addEventListener('contextmenu', (e) => {
      const convoId = item.dataset.id;
      e.preventDefault();
      e.stopPropagation();
      openConvoDropdown(convoId);
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
    btn.addEventListener('click', async (e) => {
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
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const convoId = btn.dataset.id;

      // Close dropdown immediately
      const dropdown = document.getElementById(`convo-dropdown-${convoId}`);
      if (dropdown) dropdown.style.display = 'none';

      if (deleteConversationCallback) {
        const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
        const confirm = await showDialog({
          title: t('delete_convo_title'),
          message: t('delete_convo_msg'),
          type: 'warning',
          buttons: [
            { text: t('logout_cancel'), type: 'secondary', value: false },
            { text: t('delete'), type: 'danger', value: true }
          ]
        });
        if (confirm) {
          deleteConversationCallback(convoId);
        }
      }
    });
  });
}
