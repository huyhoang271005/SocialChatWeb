export function renderMessages(messages) {
  const msgContainer = document.getElementById('chat-messages-container');
  if (!msgContainer) return;

  msgContainer.innerHTML = messages.map(msg => {
    const isOutgoing = msg.sender === 'me';
    const bubbleClass = `message-bubble message-${isOutgoing ? 'outgoing' : 'incoming'} ${msg.status === 'pending' ? 'message-pending' : ''} ${msg.isRevoked ? 'message-revoked' : ''}`;
    
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
        const fileName = msg.text.split('/').pop() || 'Tệp tin';
        contentHtml = `<a href="${msg.text}" target="_blank" class="message-file-link" style="display: inline-flex; align-items: center; gap: 8px; color: inherit; text-decoration: underline; word-break: break-all;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg><span>Tải tệp tin (${fileName})</span></a>`;
      }
    }

    return `<div class="${bubbleClass}">${contentHtml}<div style="font-size: 0.7rem; text-align: right; opacity: 0.7; margin-top: 4px; white-space: normal;">${msg.time}</div></div>`;
  }).join('');
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

export function updateChatHeader(title, avatarUrl, statusText) {
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
