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

export function renderConversationsList(conversations, activeConversationId, getUserNameAndAvatarCallback, selectConversationCallback) {
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
    let avatarUrl = convo.conversationAvatar;
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
        const otherUserId = otherParticipant ? otherParticipant.userId : null;
        if (otherUserId) {
          displayTitle = 'Đang tải...';
          getUserNameAndAvatarCallback(otherUserId, elementUniqueId, avatarUniqueId);
        } else {
          displayTitle = 'Trò chuyện #' + convo.conversationId;
        }
      } else {
        displayTitle = 'Nhóm trò chuyện #' + convo.conversationId;
      }
    }

    // Last message
    const previewText = formatLastMessageText(convo.lastMessageText);

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

    return `
      <div class="conversation-item ${isActive ? 'active' : ''}" data-id="${convo.conversationId}">
        <div class="conversation-avatar-wrapper">
          <img src="${avatarUrl}" id="${avatarUniqueId}" class="conversation-avatar" alt="${convo.title || 'Avatar'}">
        </div>
        <div class="conversation-details">
          <div class="conversation-meta">
            <span class="conversation-name" id="${elementUniqueId}">${displayTitle}</span>
            <span class="conversation-time">${timeStr}</span>
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

  // Bind click events
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
}
