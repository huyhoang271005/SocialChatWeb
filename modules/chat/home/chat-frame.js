import { socket } from '../../../js/core/websocket.js';
import { api } from '../../../js/core/api.js';

export function renderMessages(messages, conversationId, conversations = []) {
  const msgContainer = document.getElementById('chat-messages-container');
  if (!msgContainer) return;

  const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
  const isGroup = convo ? convo.group === true : false;

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
    
    let replyQuoteHtml = '';
    if (msg.replyMessageId) {
      const replyId = msg.replyMessageId;
      const orig = messages.find(m => String(m.id) === String(replyId));
      let senderName = 'Người dùng';
      
      const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
      if (orig) {
        if (String(orig.senderId) === String(currentUserId)) {
          senderName = 'Bạn';
        } else {
          const senderObj = convo?.userConversations?.find(u => String(u.userId) === String(orig.senderId));
          senderName = senderObj ? (senderObj.fullName || senderObj.displayName || senderObj.username || 'Thành viên') : 'Thành viên';
        }
      } else {
        senderName = 'Tin nhắn';
      }

      let textSnippet = msg.replyText || '';
      if (msg.replyRevoked === true) {
        textSnippet = 'Tin nhắn đã bị thu hồi';
      } else {
        const replyType = String(msg.replyType || 'TEXT').toUpperCase();
        if (replyType === 'IMAGE') textSnippet = '[Hình ảnh]';
        else if (replyType === 'VIDEO') textSnippet = '[Video]';
        else if (replyType === 'AUDIO') textSnippet = '[Tin nhắn thoại]';
        else if (replyType === 'FILE') textSnippet = '[Tài liệu]';
      }

      replyQuoteHtml = `
        <div class="replied-message-quote" data-target-id="${replyId}" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; text-align: left; width: 100%; box-sizing: border-box; gap: 2px; margin-bottom: 6px;">
          <div style="font-weight: 600; font-size: 0.75rem; color: ${isOutgoing ? 'rgba(255, 255, 255, 0.9)' : 'var(--accent-color)'}; text-align: left; align-self: flex-start; margin: 0; padding: 0; width: auto; max-width: 100%; word-break: break-all; display: block;">
            ${senderName}
          </div>
          <div style="opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; text-align: left; align-self: flex-start; margin: 0; padding: 0; width: auto; display: block;">
            ${textSnippet}
          </div>
        </div>
      `;
    }

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
        const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
        let seenNames = [];
        const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
        if (convo && convo.userConversations) {
          const otherParticipants = convo.userConversations.filter(u => String(u.userId) !== String(currentUserId));
          const seenParticipants = otherParticipants.filter(p => {
            const seenId = p.lastMessageId;
            if (!seenId) return false;
            
            const msgId = msg.id;
            if (!isNaN(msgId) && !isNaN(seenId)) {
              return Number(msgId) <= Number(seenId);
            }
            return String(msgId) === String(seenId);
          });

          // Sắp xếp theo seenAt giảm dần, đưa người xem mới nhất lên đầu
          seenParticipants.sort((a, b) => {
            const timeA = a.seenAt || 0;
            const timeB = b.seenAt || 0;
            return timeB - timeA;
          });

          seenNames = seenParticipants.map(p => p.fullName || p.username || 'Ai đó');
        }
        const seenText = seenNames.length > 0 ? `${seenNames.join(', ')} đã xem` : 'Đã xem';
        statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: var(--accent-color); align-self: flex-end; margin-top: 2px; margin-right: 4px; font-weight: 500;">${seenText}</div>`;
      } else if (isFailed) {
        statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: #ef4444; align-self: flex-end; margin-top: 2px; margin-right: 4px; font-weight: 500;">Gửi lỗi</div>`;
      }
    }

    const displayOptions = !isPending && !isFailed && !msg.isRevoked;

    if (isGroup && !isOutgoing) {
      let senderName = '';
      let senderAvatar = '';
      const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';

      const senderObj = convo?.userConversations?.find(u => String(u.userId) === String(msg.senderId));
      if (senderObj) {
        senderName = senderObj.fullName ||
                     senderObj.user?.fullName ||
                     senderObj.displayName ||
                     senderObj.username ||
                     senderObj.user?.username ||
                     'Thành viên';
        senderAvatar = senderObj.avatarUrl || senderObj.user?.avatarUrl || defaultUserAvatar;
      } else {
        senderName = 'Thành viên';
        senderAvatar = defaultUserAvatar;
      }

      const optionsHtml = displayOptions ? `
        <div class="message-options-dropdown">
          <button class="btn-message-options" data-id="${msg.id}" title="Tuỳ chọn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1.5"></circle>
              <circle cx="12" cy="5" r="1.5"></circle>
              <circle cx="12" cy="19" r="1.5"></circle>
            </svg>
          </button>
          <div class="message-dropdown-menu" id="dropdown-${msg.id}" style="display: none; ${isOutgoing ? '' : 'left: 0; right: auto;'}">
            <button class="dropdown-item btn-reply-message" data-id="${msg.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--accent-color);">
                <polyline points="9 17 4 12 9 7"></polyline>
                <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
              </svg>
              <span>Trả lời</span>
            </button>
            ${isOutgoing ? `
              <button class="dropdown-item btn-revoke-message" data-id="${msg.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--error);">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <span style="color: var(--error);">Thu hồi</span>
              </button>
            ` : ''}
          </div>
        </div>
      ` : '';

      const swipeIndicatorHtml = `
        <div class="swipe-reply-indicator" style="position: absolute; ${isOutgoing ? 'right: -40px;' : 'left: -40px;'} display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: hsla(230, 25%, 20%, 0.5); opacity: 0; transform: scale(0.5); transition: opacity 0.2s, transform 0.2s, ${isOutgoing ? 'right' : 'left'} 0.2s; color: var(--accent-color); pointer-events: none;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 17 4 12 9 7"></polyline>
            <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
          </svg>
        </div>
      `;

      const groupBubbleHtml = `<div class="${bubbleClass}" data-id="${msg.id}" style="max-width: 100%;">${replyQuoteHtml}${contentHtml}<div style="font-size: 0.7rem; text-align: right; opacity: 0.7; margin-top: 4px; white-space: normal;">${msg.time}</div></div>`;

      return `
        <div class="message-row group-incoming-row" id="msg-${msg.id}">
          <img src="${senderAvatar}" class="message-sender-avatar" alt="${senderName}" title="${senderName}">
          <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 65%;">
            <span class="message-sender-name">${senderName}</span>
            <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-start; width: 100%; position: relative;" class="message-bubble-wrapper">
              ${swipeIndicatorHtml}
              ${groupBubbleHtml}
              ${optionsHtml}
            </div>
          </div>
        </div>
      `;
    }

    const rowAlign = isOutgoing ? 'align-items: flex-end;' : 'align-items: flex-start;';
    const optionsHtml = displayOptions ? `
      <div class="message-options-dropdown">
        <button class="btn-message-options" data-id="${msg.id}" title="Tuỳ chọn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="12" cy="5" r="1.5"></circle>
            <circle cx="12" cy="19" r="1.5"></circle>
          </svg>
        </button>
        <div class="message-dropdown-menu" id="dropdown-${msg.id}" style="display: none; ${isOutgoing ? '' : 'left: 0; right: auto;'}">
          <button class="dropdown-item btn-reply-message" data-id="${msg.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--accent-color);">
              <polyline points="9 17 4 12 9 7"></polyline>
              <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
            </svg>
            <span>Trả lời</span>
          </button>
          ${isOutgoing ? `
            <button class="dropdown-item btn-revoke-message" data-id="${msg.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--error);">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              <span style="color: var(--error);">Thu hồi</span>
            </button>
          ` : ''}
        </div>
      </div>
    ` : '';

    const swipeIndicatorHtml = `
      <div class="swipe-reply-indicator" style="position: absolute; ${isOutgoing ? 'right: -40px;' : 'left: -40px;'} display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: hsla(230, 25%, 20%, 0.5); opacity: 0; transform: scale(0.5); transition: opacity 0.2s, transform 0.2s, ${isOutgoing ? 'right' : 'left'} 0.2s; color: var(--accent-color); pointer-events: none;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 17 4 12 9 7"></polyline>
          <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
        </svg>
      </div>
    `;

    const bubbleHtml = `<div class="${bubbleClass}" data-id="${msg.id}">${replyQuoteHtml}${contentHtml}<div style="font-size: 0.7rem; text-align: right; opacity: 0.7; margin-top: 4px; white-space: normal;">${msg.time}</div></div>`;

    return `
      <div class="message-row" id="msg-${msg.id}" style="display: flex; flex-direction: column; ${rowAlign} width: 100%;">
        <div style="display: flex; align-items: center; gap: 8px; justify-content: ${isOutgoing ? 'flex-end' : 'flex-start'}; width: 100%; position: relative;" class="message-bubble-wrapper">
          ${swipeIndicatorHtml}
          ${isOutgoing ? `${optionsHtml}${bubbleHtml}` : `${bubbleHtml}${optionsHtml}`}
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

  // Bind click event on reply buttons in dropdown
  const replyButtons = msgContainer.querySelectorAll('.btn-reply-message');
  replyButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.id;
      
      // Close dropdown immediately
      const dropdown = document.getElementById(`dropdown-${messageId}`);
      if (dropdown) dropdown.style.display = 'none';

      // Dispatch custom event
      const event = new CustomEvent('reply-message-click', { detail: { messageId } });
      document.dispatchEvent(event);
    });
  });

  // Bind click event on replied message quote to scroll
  const quotes = msgContainer.querySelectorAll('.replied-message-quote');
  quotes.forEach(quote => {
    quote.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = quote.dataset.targetId;
      if (targetId) {
        const event = new CustomEvent('reply-quote-click', { detail: { targetId } });
        document.dispatchEvent(event);
      }
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
            <button class="dropdown-item" id="option-edit-convo">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Chỉnh sửa nhóm
            </button>
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

      const optEditConvo = headerActions.querySelector('#option-edit-convo');
      if (optEditConvo) {
        optEditConvo.addEventListener('click', (e) => {
          e.stopPropagation();
          if (dropdown) dropdown.style.display = 'none';
          showEditConversationModal(conversationId, conversations);
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
            try {
              let res = await api.delete('conversations/member/leave', { conversationId });
              if (!res || !res.success) {
                res = await api.delete('conversation/member/leave', { conversationId });
              }
              if (res && res.success) {
                await showDialog({
                  title: 'Thành công',
                  message: 'Bạn đã rời nhóm thành công.',
                  type: 'success'
                });
              } else {
                throw new Error(res?.message || 'Không thể rời nhóm');
              }
            } catch (err) {
              await showDialog({
                title: 'Lỗi thực hiện',
                message: err.message || 'Không thể rời cuộc trò chuyện.',
                type: 'error'
              });
            }
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
        const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
        await showDialog({
          title: 'Thành công',
          message: 'Đã thêm thành viên thành công.',
          type: 'success'
        });
      } else {
        throw new Error(res?.message || 'Không thể thêm thành viên');
      }
    } catch (err) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Thêm';
      const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
      await showDialog({
        title: 'Lỗi',
        message: err.message || 'Đã xảy ra lỗi khi thêm thành viên.',
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

  const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
  const userConversations = convo ? (convo.userConversations || []) : [];
  const myConvoEntry = userConversations.find(u => String(u.userId) === currentUserId);
  const myRole = myConvoEntry ? String(myConvoEntry.conversationRole || 'MEMBER').toUpperCase() : 'MEMBER';
  const canDeleteMember = !convo || !convo.group || myRole === 'CREATOR';

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
      <div class="chat-modal-body" id="modal-members-list-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
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

    const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';

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

      const isDeletable = !isSelf && canDeleteMember;

      return `
        <div class="member-list-item" data-id="${member.userId}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: hsla(230, 25%, 6%, 0.25); cursor: default; transition: var(--transition-smooth);">
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
          ${isDeletable ? `
          <button class="btn-delete-member" data-id="${member.userId}" title="Xóa thành viên" style="background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; transition: all 0.2s ease; padding: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--error);">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
          ` : ''}
        </div>
      `;
    }).join('');

    const deleteButtons = container.querySelectorAll('.btn-delete-member');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const userId = btn.dataset.id;
        const memberObj = userConversations.find(u => String(u.userId) === String(userId));
        const memberName = memberObj?.fullName || memberObj?.user?.fullName || memberObj?.displayName || memberObj?.username || 'Thành viên';

        const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
        const confirm = await showDialog({
          title: 'Xóa thành viên',
          message: `Bạn có chắc chắn muốn xóa thành viên "${memberName}" khỏi cuộc trò chuyện này không?`,
          type: 'warning',
          buttons: [
            { text: 'Hủy', type: 'secondary', value: false },
            { text: 'Xóa', type: 'danger', value: true }
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
                title: 'Thành công',
                message: `Đã xóa thành viên "${memberName}" khỏi nhóm.`,
                type: 'success'
              });
            } else {
              throw new Error(res?.message || 'Không thể xóa thành viên');
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
              title: 'Lỗi',
              message: err.message || 'Đã xảy ra lỗi khi xóa thành viên.',
              type: 'error'
            });
          }
        }
      });
    });
  }
}

function showEditConversationModal(conversationId, conversations) {
  const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
  if (!convo) return;

  const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';
  const currentTitle = convo.title || 'Nhóm trò chuyện #' + convo.conversationId;
  const currentAvatar = convo.conversationAvatarUrl || defaultGroupAvatar;

  const overlay = document.createElement('div');
  overlay.className = 'chat-modal-overlay';

  overlay.innerHTML = `
    <div class="chat-modal-card">
      <div class="chat-modal-header">
        <h3>Chỉnh sửa cuộc trò chuyện</h3>
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
            <div style="position: relative; width: 80px; height: 80px; border-radius: 50%; overflow: hidden; border: 2px solid var(--border-color); background: hsla(230, 25%, 15%, 0.45);">
              <img id="edit-avatar-preview" src="${currentAvatar}" style="width: 100%; height: 100%; object-fit: cover;" alt="Preview">
            </div>
            <input type="file" id="edit-chat-avatar-file" accept="image/*" style="display: none;">
            <button type="button" id="btn-upload-edit-avatar" class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px; height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px; width: auto;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              Chọn ảnh đại diện
            </button>
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-chat-title-input" style="font-size: 0.8rem; margin-bottom: 4px;">Tên nhóm trò chuyện</label>
            <input type="text" id="edit-chat-title-input" class="form-input" placeholder="Nhập tên nhóm..." value="${currentTitle}" style="font-size: 0.85rem; padding: 8px 12px; height: 38px;">
          </div>
        </form>
      </div>
      <div class="chat-modal-footer">
        <button class="btn btn-secondary" id="btn-cancel-edit-convo">Hủy</button>
        <button class="btn btn-primary" id="btn-confirm-edit-convo">Lưu thay đổi</button>
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
  const previewImg = overlay.querySelector('#edit-avatar-preview');
  const saveBtn = overlay.querySelector('#btn-confirm-edit-convo');

  let selectedFile = null;

  // File selection
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length === 0) return;
      const file = fileInput.files[0];
      selectedFile = file;
      previewImg.src = URL.createObjectURL(file);
    });
  }

  // Save changes logic
  saveBtn.addEventListener('click', async () => {
    const newTitle = titleInput.value.trim() || null;

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
          saveBtn.innerHTML = 'Lưu thay đổi';
          const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
          await showDialog({
            title: 'Lỗi tải ảnh',
            message: res?.message || 'Không thể tải ảnh đại diện lên.',
            type: 'error'
          });
          return;
        }
      } catch (uploadErr) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Lưu thay đổi';
        console.error(uploadErr);
        const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
        await showDialog({
          title: 'Lỗi tải ảnh',
          message: 'Đã xảy ra lỗi khi tải ảnh đại diện nhóm lên.',
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
        const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
        await showDialog({
          title: 'Thành công',
          message: 'Đã cập nhật thông tin nhóm thành công.',
          type: 'success',
          buttons: [{ text: 'Đóng', type: 'primary', value: true }]
        });

        convo.title = newTitle;
        convo.conversationAvatarUrl = finalAvatarUrl;
        convo.conversationAvatarId = finalAvatarId;

        document.dispatchEvent(new CustomEvent('refresh-conversations'));

        updateChatHeader(
          newTitle,
          finalAvatarUrl || defaultGroupAvatar,
          'Nhóm trò chuyện',
          convo.conversationId,
          conversations
        );

        closeModal();
      } else {
        throw new Error(response?.message || 'Không thể cập nhật cuộc trò chuyện');
      }
    } catch (err) {
      console.error(err);
      const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
      await showDialog({
        title: 'Lỗi cập nhật',
        message: err.message || 'Đã xảy ra lỗi khi cập nhật nhóm trò chuyện.',
        type: 'error'
      });
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Lưu thay đổi';
    }
  });
}
