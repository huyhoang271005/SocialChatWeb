import { api } from '../../../js/core/api.js';

export function showIncomingMessageToast(senderName, text, conversationId, conversations, profileCache, selectConversationCallback) {
  let container = document.getElementById('toast-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-notification-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'incoming-chat-toast';
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    width: 320px;
    padding: 16px;
    background: rgba(17, 24, 39, 0.75);
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    color: white;
    font-family: inherit;
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    animation: toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  `;

  const leftBar = document.createElement('div');
  leftBar.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--accent-gradient, linear-gradient(135deg, #6366f1, #a855f7));
  `;
  toast.appendChild(leftBar);

  const avatar = document.createElement('img');
  avatar.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
  avatar.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  `;
  toast.appendChild(avatar);

  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1;
    min-width: 0;
  `;
  
  const senderTitle = document.createElement('h5');
  senderTitle.textContent = senderName;
  senderTitle.style.cssText = `
    margin: 0 0 4px 0;
    font-size: 0.88rem;
    font-weight: 600;
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  content.appendChild(senderTitle);

  const messagePreview = document.createElement('p');
  messagePreview.textContent = text;
  messagePreview.style.cssText = `
    margin: 0;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.7);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  content.appendChild(messagePreview);

  toast.appendChild(content);

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 4px;
    margin-left: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `;
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
    closeBtn.style.color = 'white';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.color = 'rgba(255, 255, 255, 0.4)';
  });
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissToast(toast);
  });
  toast.appendChild(closeBtn);

  toast.addEventListener('click', () => {
    if (typeof selectConversationCallback === 'function') {
      selectConversationCallback(conversationId);
    }
    dismissToast(toast);
    
    const dashboard = document.querySelector('.chat-dashboard');
    if (dashboard) {
      dashboard.classList.add('show-chat');
    }
  });

  container.appendChild(toast);

  setTimeout(() => {
    dismissToast(toast);
  }, 4500);

  const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
  if (convo) {
    if (convo.conversationAvatar) {
      avatar.src = convo.conversationAvatar;
    } else if (!convo.group) {
      const currentUserId = localStorage.getItem('chat_user_id');
      const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
      const otherUserId = otherParticipant ? otherParticipant.userId : null;
      if (otherUserId && profileCache.has(String(otherUserId))) {
        const cachedProfile = profileCache.get(String(otherUserId));
        if (cachedProfile.avatarUrl) avatar.src = cachedProfile.avatarUrl;
      } else if (otherUserId) {
        api.get(`profiles/${otherUserId}`).then(res => {
          if (res && res.success && res.data) {
            profileCache.set(String(otherUserId), res.data);
            if (res.data.avatarUrl) avatar.src = res.data.avatarUrl;
          }
        });
      }
    }
  }
}

export function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.style.animation = 'toast-slide-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) both';
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}
