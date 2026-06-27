import { api } from '../../../../js/core/api.js';
import { t } from '../../../../js/core/i18n.js';

const REACTION_TYPE_TO_EMOJI = {
  "LIKE": "👍",
  "HEART": "❤️",
  "HAHA": "😆",
  "WOW": "😮",
  "SAD": "😢",
  "ANGRY": "😡",
  "CARE": "🥰",
  "CLAP": "👏",
  "FIRE": "🔥"
};

const EMOJI_TO_REACTION_TYPE = {
  "👍": "LIKE",
  "❤️": "HEART",
  "😆": "HAHA",
  "😮": "WOW",
  "😢": "SAD",
  "😡": "ANGRY",
  "🥰": "CARE",
  "👏": "CLAP",
  "🔥": "FIRE"
};

export async function showReactionsModal(messageId, conversationId, conversations) {
  const overlay = document.createElement('div');
  overlay.className = 'chat-modal-overlay';

  overlay.innerHTML = `
    <div class="chat-modal-card">
      <div class="chat-modal-header">
        <h3>${t('reactions_title') || 'Người bày tỏ cảm xúc'}</h3>
        <button class="btn-close-modal" id="btn-close-reactions-modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="chat-modal-body" id="modal-reactions-list-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
        ${Array(3).fill(0).map(() => `
          <div class="reactor-skeleton" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: hsla(230, 25%, 6%, 0.25);">
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
              <div class="skeleton-loader skeleton-circle" style="width: 36px; height: 36px; flex-shrink: 0;"></div>
              <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                <div class="skeleton-loader skeleton-text" style="width: 45%; height: 12px; margin-bottom: 0;"></div>
                <div class="skeleton-loader skeleton-text" style="width: 30%; height: 10px; margin-bottom: 0;"></div>
              </div>
            </div>
            <div class="skeleton-loader skeleton-circle" style="width: 24px; height: 24px; flex-shrink: 0; margin-right: 8px;"></div>
          </div>
        `).join('')}
      </div>
      <div class="chat-modal-footer">
        <button class="btn btn-secondary" id="btn-close-reactions-btn">${t('close')}</button>
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

  overlay.querySelector('#btn-close-reactions-modal').addEventListener('click', closeModal);
  overlay.querySelector('#btn-close-reactions-btn').addEventListener('click', closeModal);

  try {
    const res = await api.get(`messages/${messageId}/reactor`);
    const container = overlay.querySelector('#modal-reactions-list-container');
    if (!container) return;

    if (!res || !res.success || !Array.isArray(res.data) || res.data.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 20px;">
          ${t('no_reactions_yet') || 'Chưa có lượt bày tỏ cảm xúc nào.'}
        </div>
      `;
      return;
    }

    const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
    const userConversations = convo ? (convo.userConversations || []) : [];
    const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';

    container.innerHTML = res.data.map(item => {
      const userId = item.userId;
      
      // Determine emoji from reaction payload robustly
      let emoji = '👍';
      let reactionCountVal = 1;
      const countObj = item.reactionCount || item.reactorCount;
      if (countObj && typeof countObj === 'object') {
        const activeReaction = Object.entries(countObj)
          .filter(([_, count]) => Number(count) > 0)
          .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
        if (activeReaction) {
          const key = activeReaction[0];
          emoji = REACTION_TYPE_TO_EMOJI[key] || key;
          reactionCountVal = Number(activeReaction[1]);
        }
      } else if (item.reactionType && REACTION_TYPE_TO_EMOJI[item.reactionType]) {
        emoji = REACTION_TYPE_TO_EMOJI[item.reactionType];
      } else if (item.emoji) {
        emoji = item.emoji;
      } else {
        const foundEmoji = Object.keys(REACTION_TYPE_TO_EMOJI).find(e => item[e] || Object.values(item).includes(e) || Object.values(item).includes(REACTION_TYPE_TO_EMOJI[e]));
        if (foundEmoji) {
          emoji = REACTION_TYPE_TO_EMOJI[foundEmoji];
        } else {
          for (const key of Object.keys(item)) {
            if (REACTION_TYPE_TO_EMOJI[key] || Object.keys(EMOJI_TO_REACTION_TYPE).includes(key)) {
              emoji = REACTION_TYPE_TO_EMOJI[key] || key;
              break;
            }
          }
        }
      }

      // Map userId to userConversations in current conversation
      const participant = userConversations.find(u => String(u.userId) === String(userId));
      const fullName = participant ? (
        participant.fullName ||
        participant.user?.fullName ||
        participant.displayName ||
        participant.user?.displayName ||
        participant.username ||
        participant.user?.username ||
        t('user') || 'Người dùng'
      ) : `${t('user') || 'Người dùng'} #${userId}`;
      const avatarUrl = participant ? (participant.avatarUrl || participant.user?.avatarUrl || defaultAvatar) : defaultAvatar;
      const username = participant ? `@${participant.username || participant.user?.username || ''}` : '';

      return `
        <div class="reactor-list-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: hsla(230, 25%, 6%, 0.25); cursor: default;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatarUrl}" class="conversation-avatar" style="width: 36px; height: 36px; border-radius: 50%;" alt="${fullName}">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary);">${fullName}</span>
              ${username ? `<span style="font-size: 0.75rem; color: var(--text-muted);">${username}</span>` : ''}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="font-size: 1.5rem; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
              ${emoji}
            </div>
            <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); background: hsla(230, 25%, 15%, 0.65); border: 1px solid var(--border-color); padding: 2px 8px; border-radius: var(--radius-full); line-height: 1.2;">
              ${reactionCountVal}
            </span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load reactors:', err);
    const container = overlay.querySelector('#modal-reactions-list-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--error); padding: 20px;">
          ${t('error_loading_reactors') || 'Có lỗi xảy ra khi tải danh sách.'}
        </div>
      `;
    }
  }
}
