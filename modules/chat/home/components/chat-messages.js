import { socket } from '../../../../js/core/websocket.js';
import { api } from '../../../../js/core/api.js';
import { getAvatarHtml } from './conversations.js';
import { t, formatSystemMessage } from '../../../../js/core/i18n.js';
import { formatSpecificTime } from '../handlers/socket-event-handler.js';




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

function getReactionsHtml(reactorCount, isOutgoing, messageId) {
  if (!reactorCount || typeof reactorCount !== 'object') {
    return '';
  }

  // Filter active reaction types (count > 0) and sort descending by count
  const activeReactions = Object.entries(reactorCount)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (activeReactions.length === 0) {
    return '';
  }

  const limit = 5;
  const topReactions = activeReactions.slice(0, limit);
  const remainingCount = activeReactions.length - limit;

  let pillsHtml = topReactions.map(([reactionKey, count]) => {
    const emoji = REACTION_TYPE_TO_EMOJI[reactionKey] || reactionKey;
    return `
      <span class="reaction-pill-item" style="display: inline-flex; align-items: center; gap: 3px; background: hsla(230, 25%, 15%, 0.85); border: 1px solid var(--border-color); border-radius: var(--radius-full); padding: 2px 6px; font-size: 0.75rem; color: var(--text-secondary); cursor: pointer; user-select: none;" data-emoji="${emoji}" data-message-id="${messageId}">
        <span>${emoji}</span>
        <span style="font-weight: 600; font-size: 0.7rem;">${count}</span>
      </span>
    `;
  }).join('');

  if (remainingCount > 0) {
    pillsHtml += `
      <span class="reaction-pill-item extra-reactions-pill" style="display: inline-flex; align-items: center; background: hsla(230, 25%, 15%, 0.85); border: 1px solid var(--border-color); border-radius: var(--radius-full); padding: 2px 6px; font-size: 0.75rem; color: var(--text-muted); cursor: pointer; user-select: none;" data-message-id="${messageId}">
        <span style="font-weight: 600; font-size: 0.7rem;">+${remainingCount}</span>
      </span>
    `;
  }

  const alignStyle = isOutgoing ? 'right: 8px;' : 'left: 8px;';

  return `
    <div class="message-reactions-container" style="position: absolute; bottom: -10px; ${alignStyle} display: flex; align-items: center; gap: 3px; z-index: 5; pointer-events: auto;">
      ${pillsHtml}
    </div>
  `;
}

export function renderMessages(messages, conversationId, conversations = []) {
  const msgContainer = document.getElementById('chat-messages-container');
  if (!msgContainer) return;

  const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
  const isGroup = convo ? convo.group === true : false;

  const lastOutgoingIndex = messages.map(m => m.sender).lastIndexOf('me');

  msgContainer.innerHTML = messages.map((msg, index) => {
    const msgType = String(msg.type || 'TEXT').toUpperCase();
    if (msgType === 'REMOVE_MEMBER' || msgType === 'ADD_MEMBER' || msgType === 'LEAVED') {
      const displayHtml = formatSystemMessage(msgType, msg.rawText || msg.text);
      return `
        <div class="message-row system-message-row" style="display: flex; justify-content: center; width: 100%; margin: 8px 0;">
          <div class="system-message-content" style="background-color: hsla(230, 25%, 15%, 0.4); border: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.75rem; padding: 4px 12px; border-radius: var(--radius-full); text-align: center; max-width: 80%; word-break: break-word;">
            ${displayHtml}
          </div>
        </div>
      `;
    }

    let seenNamesStr = '';

    const isOutgoing = msg.sender === 'me';
    const isPending = msg.status === 'pending' || msg.status === 'sending';
    const isFailed = msg.status === 'failed';
    const isMedia = !msg.isRevoked && (msgType === 'IMAGE' || msgType === 'VIDEO' || msgType === 'AUDIO');
    const bubbleClass = `message-bubble message-${isOutgoing ? 'outgoing' : 'incoming'} ${isPending ? 'message-pending' : ''} ${isFailed ? 'message-failed' : ''} ${msg.isRevoked ? 'message-revoked' : ''} ${isMedia ? 'message-media' : ''}`;
    
    let replyQuoteHtml = '';
    if (msg.replyMessageId) {
      const replyId = msg.replyMessageId;
      const orig = messages.find(m => String(m.id) === String(replyId));
      let senderName = t('user');
      
      const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
      if (orig) {
        if (String(orig.senderId) === String(currentUserId)) {
          senderName = t('you');
        } else {
          const senderObj = convo?.userConversations?.find(u => String(u.userId) === String(orig.senderId));
          senderName = senderObj ? (senderObj.fullName || senderObj.displayName || senderObj.username || t('role_member')) : t('role_member');
        }
      } else {
        senderName = t('message');
      }

      let textSnippet = msg.replyText || '';
      if (msg.replyRevoked === true) {
        textSnippet = t('revoked_msg');
      } else {
        const replyType = String(msg.replyType || 'TEXT').toUpperCase();
        if (replyType === 'IMAGE') textSnippet = t('snippet_image');
        else if (replyType === 'VIDEO') textSnippet = t('snippet_video');
        else if (replyType === 'AUDIO') textSnippet = t('snippet_audio');
        else if (replyType === 'FILE') textSnippet = t('snippet_file');
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
        contentHtml = `<img src="${msg.text}" class="message-image" alt="${t('snippet_image')}" onclick="window.open('${msg.text}', '_blank')">`;
      } else if (msgType === 'VIDEO') {
        contentHtml = `<video src="${msg.text}" class="message-video" controls></video>`;
      } else if (msgType === 'AUDIO') {
        contentHtml = `<audio src="${msg.text}" controls style="width:100%; min-width: 220px; display: block; margin-bottom: 5px; outline: none;"></audio>`;
      } else if (msgType === 'FILE') {
        const fileName = msg.fileName || msg.text.split('/').pop() || t('snippet_file');
        const fileHref = isPending || isFailed ? 'javascript:void(0)' : msg.text;
        const extraStyle = isPending || isFailed ? 'pointer-events: none; opacity: 0.6;' : '';
        contentHtml = `<a href="${fileHref}" target="_blank" class="message-file-link" style="display: inline-flex; align-items: center; gap: 8px; color: inherit; text-decoration: underline; word-break: break-all; ${extraStyle}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg><span>${t('download_file')} (${fileName})</span></a>`;
      }
    }

    let statusTextHtml = '';
    if (isOutgoing && index === lastOutgoingIndex) {
      if (isPending) {
        statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: var(--text-muted); align-self: flex-end; margin-top: 2px; margin-right: 4px;">${t('sending')}</div>`;
      } else if (msg.status === 'sent') {
        statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: var(--text-secondary); align-self: flex-end; margin-top: 2px; margin-right: 4px;">${t('sent')}</div>`;
      } else if (msg.status === 'seen') {
        const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
        let seenParticipants = [];
        const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
        const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';

        if (convo && convo.userConversations) {
          const otherParticipants = convo.userConversations.filter(u => String(u.userId) !== String(currentUserId));
          seenParticipants = otherParticipants.filter(p => {
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
        }

        if (seenParticipants.length > 0) {
          seenNamesStr = seenParticipants.map(p => p.fullName || p.username || t('user')).join(', ');
          const avatarsHtml = seenParticipants.map((p, idx) => {
            const avatarUrl = p.avatarUrl || p.user?.avatarUrl || defaultUserAvatar;
            const name = p.fullName || p.username || t('user');
            const style = `width: 16px; height: 16px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--bg-card, #0b0f19);${idx > 0 ? ' margin-left: -5px;' : ''} z-index: ${100 - idx}; position: relative;`;
            return `<img src="${avatarUrl}" class="seen-avatar" style="${style}" title="${name} ${t('seen_by_title')}" alt="${name}">`;
          }).join('');

          statusTextHtml = `
            <div class="message-status-seen-avatars" style="display: flex; align-items: center; align-self: flex-end; margin-top: 4px; margin-right: 4px; justify-content: flex-end; cursor: pointer;">
              ${avatarsHtml}
            </div>
          `;
        } else {
          statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: var(--accent-color); align-self: flex-end; margin-top: 2px; margin-right: 4px; font-weight: 500;">${t('seen')}</div>`;
        }
      } else if (isFailed) {
        statusTextHtml = `<div class="message-status" style="font-size: 0.75rem; color: #ef4444; align-self: flex-end; margin-top: 2px; margin-right: 4px; font-weight: 500;">${t('failed')}</div>`;
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
                     t('role_member');
        senderAvatar = senderObj.avatarUrl || senderObj.user?.avatarUrl || defaultUserAvatar;
      } else {
        senderName = t('role_member');
        senderAvatar = defaultUserAvatar;
      }

      const optionsHtml = displayOptions ? `
        <div class="message-options-dropdown">
          <button class="btn-message-options desktop-msg-options" data-id="${msg.id}" title="${t('options')}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1.5"></circle>
              <circle cx="12" cy="5" r="1.5"></circle>
              <circle cx="12" cy="19" r="1.5"></circle>
            </svg>
          </button>
        </div>
      ` : '';

      const dropdownHtml = displayOptions ? `
        <div class="message-dropdown-menu" id="dropdown-${msg.id}" style="display: none; left: 0px !important; right: auto !important; bottom: 0px !important; top: auto !important; margin-bottom: 0px !important;">
          <div class="reaction-picker-row" style="display: flex; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--border-color); justify-content: space-around;">
            <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="LIKE" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Like">👍</button>
            <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="HEART" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Heart">❤️</button>
            <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="HAHA" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Haha">😆</button>
            <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="WOW" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Wow">😮</button>
            <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="SAD" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Sad">😢</button>
            <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="ANGRY" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Angry">😡</button>
            <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="CARE" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Care">🥰</button>
            <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="CLAP" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Clap">👏</button>
            <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="FIRE" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Fire">🔥</button>
          </div>
          <button class="dropdown-item btn-reply-message" data-id="${msg.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--accent-color);">
              <polyline points="9 17 4 12 9 7"></polyline>
              <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
            </svg>
            <span>${t('reply')}</span>
          </button>
          <button class="dropdown-item btn-remove-reaction" data-id="${msg.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--text-muted);">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
            </svg>
            <span>${t('remove_reaction')}</span>
          </button>
          ${isOutgoing ? `
            <button class="dropdown-item btn-revoke-message" data-id="${msg.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--error);">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              <span style="color: var(--error);">${t('revoke')}</span>
            </button>
          ` : ''}
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

      const reactionsHtml = getReactionsHtml(msg.reactorCount, false, msg.id);
      const hasReactions = msg.reactorCount && Object.values(msg.reactorCount).some(c => c > 0);
      const wrapperMarginStyle = hasReactions ? 'margin-bottom: 12px;' : '';

      const groupBubbleHtml = `
        <div class="message-wrapper-container" style="max-width: 100% !important; ${wrapperMarginStyle}">
          <div class="${bubbleClass}" data-id="${msg.id}" data-seen-by="${seenNamesStr}" data-created-at="${msg.createdAt || ''}" style="width: 100%; max-width: 100% !important;">
            ${replyQuoteHtml}
            ${contentHtml}
            <div class="message-time" style="font-size: 0.7rem; text-align: right; opacity: 0.7; margin-top: 4px; white-space: normal;">${msg.time}</div>
          </div>
          ${reactionsHtml}
        </div>
      `;

      return `
        <div class="message-row group-incoming-row" id="msg-${msg.id}">
          <img src="${senderAvatar}" class="message-sender-avatar" alt="${senderName}" title="${senderName}">
          <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 65%;">
            <span class="message-sender-name">${senderName}</span>
            <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-start; width: 100%; position: relative;" class="message-bubble-wrapper">
              ${swipeIndicatorHtml}
              ${groupBubbleHtml}
              ${optionsHtml}
              ${dropdownHtml}
            </div>
          </div>
        </div>
      `;
    }

    const rowAlign = isOutgoing ? 'align-items: flex-end;' : 'align-items: flex-start;';
    const standardOptionsHtml = displayOptions ? `
      <div class="message-options-dropdown">
        <button class="btn-message-options desktop-msg-options" data-id="${msg.id}" title="${t('options')}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="12" cy="5" r="1.5"></circle>
            <circle cx="12" cy="19" r="1.5"></circle>
          </svg>
        </button>
      </div>
    ` : '';

    const dropdownHtml = displayOptions ? `
      <div class="message-dropdown-menu" id="dropdown-${msg.id}" style="display: none; ${isOutgoing ? 'right: 0px !important; left: auto !important;' : 'left: 0px !important; right: auto !important;'} bottom: 0px !important; top: auto !important; margin-bottom: 0px !important;">
        <div class="reaction-picker-row" style="display: flex; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--border-color); justify-content: space-around;">
          <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="LIKE" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Like">👍</button>
          <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="HEART" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Heart">❤️</button>
          <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="HAHA" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Haha">😆</button>
          <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="WOW" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Wow">😮</button>
          <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="SAD" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Sad">😢</button>
          <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="ANGRY" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Angry">😡</button>
          <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="CARE" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Care">🥰</button>
          <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="CLAP" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Clap">👏</button>
          <button class="reaction-emoji-btn" data-id="${msg.id}" data-reaction="FIRE" style="background: none; border: none; font-size: 1.15rem; cursor: pointer; padding: 2px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'" title="Fire">🔥</button>
        </div>
        <button class="dropdown-item btn-reply-message" data-id="${msg.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--accent-color);">
            <polyline points="9 17 4 12 9 7"></polyline>
            <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
          </svg>
          <span>${t('reply')}</span>
        </button>
        <button class="dropdown-item btn-remove-reaction" data-id="${msg.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--text-muted);">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
          </svg>
          <span>${t('remove_reaction')}</span>
        </button>
        ${isOutgoing ? `
          <button class="dropdown-item btn-revoke-message" data-id="${msg.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; color: var(--error);">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span style="color: var(--error);">${t('revoke')}</span>
          </button>
        ` : ''}
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

    const reactionsHtml = getReactionsHtml(msg.reactorCount, isOutgoing, msg.id);
    const hasReactions = msg.reactorCount && Object.values(msg.reactorCount).some(c => c > 0);
    const wrapperMarginStyle = hasReactions ? 'margin-bottom: 12px;' : '';

    const bubbleHtml = `
      <div class="message-wrapper-container" style="${wrapperMarginStyle}">
        <div class="${bubbleClass}" data-id="${msg.id}" data-seen-by="${seenNamesStr}" data-created-at="${msg.createdAt || ''}" style="width: 100%; max-width: 100% !important;">
          ${replyQuoteHtml}
          ${contentHtml}
          <div class="message-time" style="font-size: 0.7rem; text-align: right; opacity: 0.7; margin-top: 4px; white-space: normal;">${msg.time}</div>
        </div>
        ${reactionsHtml}
      </div>
    `;

    return `
      <div class="message-row" id="msg-${msg.id}" style="display: flex; flex-direction: column; ${rowAlign} width: 100%;">
        <div style="display: flex; align-items: center; gap: 8px; justify-content: ${isOutgoing ? 'flex-end' : 'flex-start'}; width: 100%; position: relative;" class="message-bubble-wrapper">
          ${swipeIndicatorHtml}
          ${isOutgoing ? `${standardOptionsHtml}${bubbleHtml}` : `${bubbleHtml}${standardOptionsHtml}`}
          ${dropdownHtml}
        </div>
        ${statusTextHtml}
      </div>
    `;
  }).join('');

  // Helper function to show who read the message and specific time inline
  const showMessageDetailsInline = (bubbleElement) => {
    // Clear any existing inline status
    msgContainer.querySelectorAll('.message-click-status').forEach(el => el.remove());

    const wrapper = bubbleElement.closest('.message-bubble-wrapper');
    if (!wrapper) return;

    const createdAt = bubbleElement.dataset.createdAt;
    let detailText = '';
    if (createdAt) {
      const specificTime = formatSpecificTime(createdAt);
      detailText = specificTime;
    }

    const seenBy = bubbleElement.dataset.seenBy;
    if (seenBy) {
      if (detailText) {
        detailText += ` • ${t('seen_by')}${seenBy}`;
      } else {
        detailText = `${t('seen_by')}${seenBy}`;
      }
    }

    if (!detailText) return;

    const detailDiv = document.createElement('div');
    detailDiv.className = 'message-click-status';
    
    const isOutgoing = bubbleElement.classList.contains('message-outgoing');
    detailDiv.style.alignSelf = isOutgoing ? 'flex-end' : 'flex-start';
    detailDiv.style.marginRight = isOutgoing ? '8px' : '0px';
    detailDiv.style.marginLeft = isOutgoing ? '0px' : '8px';
    detailDiv.style.fontSize = '0.75rem';
    detailDiv.style.color = 'var(--text-secondary)';
    detailDiv.style.opacity = '0.85';
    detailDiv.style.marginTop = '4px';
    detailDiv.textContent = detailText;

    wrapper.insertAdjacentElement('afterend', detailDiv);

    // Click listener to dismiss when clicking anywhere else
    const dismissListener = (event) => {
      if (!bubbleElement.contains(event.target) && !detailDiv.contains(event.target)) {
        detailDiv.remove();
        document.removeEventListener('click', dismissListener);
      }
    };
    setTimeout(() => document.addEventListener('click', dismissListener), 0);
  };

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

  // Mobile: long-press on message bubble opens dropdown
  const MSG_LONG_PRESS_MS = 500;
  const openMsgDropdown = (messageId) => {
    const dropdown = document.getElementById(`dropdown-${messageId}`);
    if (!dropdown) return;
    msgContainer.querySelectorAll('.message-dropdown-menu').forEach(menu => {
      if (menu.id !== `dropdown-${messageId}`) menu.style.display = 'none';
    });
    dropdown.style.display = 'block';
    // Delay adding the close listener so the touchend-generated click doesn't immediately close it
    setTimeout(() => document.addEventListener('click', function closeFn(ev) {
      if (!dropdown.contains(ev.target)) {
        dropdown.style.display = 'none';
        document.removeEventListener('click', closeFn);
      }
    }), 350);
  };

  const bubbleWrappers = msgContainer.querySelectorAll('.message-bubble-wrapper');
  bubbleWrappers.forEach(wrapper => {
    const bubble = wrapper.querySelector('.message-bubble');
    if (!bubble) return;
    const messageId = bubble.dataset.id;
    if (!messageId) return;

    let longPressTimer = null;
    let longPressJustFired = false;

    bubble.addEventListener('touchstart', (e) => {
      if (e.target.closest('a, button')) return;
      longPressJustFired = false;
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        longPressJustFired = true;
        if (e.cancelable) e.preventDefault();
        openMsgDropdown(messageId);
      }, MSG_LONG_PRESS_MS);
    }, { passive: false });

    bubble.addEventListener('touchend', (e) => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      // Suppress the synthetic click that fires right after touchend on long-press
      if (longPressJustFired) {
        e.preventDefault();
        e.stopPropagation();
        longPressJustFired = false;
      }
    });
    bubble.addEventListener('touchmove', () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      longPressJustFired = false;
    });

    // Right-click on desktop
    bubble.addEventListener('contextmenu', (e) => {
      if (e.target.closest('a, button')) return;
      e.preventDefault();
      e.stopPropagation();
      openMsgDropdown(messageId);
    });

    // Double tap to HEART reaction, single click to see who read it inline
    let lastTap = 0;
    bubble.addEventListener('click', (e) => {
      if (e.target.closest('a, button, audio, video, img')) return;
      
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTap < DOUBLE_TAP_DELAY) {
        e.stopPropagation();
        e.preventDefault();
        
        // Double tap: send HEART reaction
        socket.sendReaction(messageId, 'HEART');
        
        // Remove seen status if shown
        msgContainer.querySelectorAll('.message-click-status').forEach(el => el.remove());
        lastTap = 0;
        return;
      }
      lastTap = now;
      showMessageDetailsInline(bubble);
    });
  });

  // Bind click event on seen avatars to show details inline (no popup dialog anymore)
  const seenAvatarsContainers = msgContainer.querySelectorAll('.message-status-seen-avatars');
  seenAvatarsContainers.forEach(container => {
    container.addEventListener('click', (e) => {
      e.stopPropagation();
      const bubble = container.parentElement?.querySelector('.message-bubble');
      if (bubble) {
        showMessageDetailsInline(bubble);
      }
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

  // Bind click event on reaction emoji buttons
  const reactionBtns = msgContainer.querySelectorAll('.reaction-emoji-btn');
  reactionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.id;
      const reactionType = btn.dataset.reaction;

      // Close dropdown immediately
      const dropdown = document.getElementById(`dropdown-${messageId}`);
      if (dropdown) dropdown.style.display = 'none';

      if (messageId && reactionType) {
        socket.sendReaction(messageId, reactionType);
      }
    });
  });

  // Bind click event on existing reaction pills to show the reactors list modal
  const reactionPills = msgContainer.querySelectorAll('.reaction-pill-item');
  reactionPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = pill.dataset.messageId;
      if (messageId) {
        import('../modals/reactions-modal.js').then(({ showReactionsModal }) => {
          showReactionsModal(messageId, conversationId, conversations);
        });
      }
    });
  });

  // Bind click event on remove reaction buttons
  const removeReactionBtns = msgContainer.querySelectorAll('.btn-remove-reaction');
  removeReactionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const messageId = btn.dataset.id;

      // Close dropdown immediately
      const dropdown = document.getElementById(`dropdown-${messageId}`);
      if (dropdown) dropdown.style.display = 'none';

      if (messageId) {
        socket.sendUnreaction(messageId);
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
      
      const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
      const confirm = await showDialog({
        title: t('confirm_revoke_title'),
        message: t('confirm_revoke_message'),
        type: 'warning',
        buttons: [
          { text: t('logout_cancel'), type: 'secondary', value: false },
          { text: t('revoke'), type: 'danger', value: true }
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
