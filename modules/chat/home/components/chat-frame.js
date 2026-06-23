export { renderMessages } from './chat-messages.js';
export { updateChatHeader } from './chat-header.js';

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
