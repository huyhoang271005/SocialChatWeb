import { api } from '../../../../js/core/api.js';
import { t, formatSystemMessage } from '../../../../js/core/i18n.js';
import { formatMessageTime } from './socket-event-handler.js';

export const MessageLoader = {
  async loadMessages(ctx, conversationId, nextPage = false, forceRefresh = false) {
    if (ctx.messagesLoading) return;
    if (nextPage && ctx.hasMoreMessages === false) return;
    ctx.messagesLoading = true;

    const cacheKey = `chat_messages_cache_${conversationId}`;
    const msgContainer = document.getElementById('chat-messages-container');

    // Load from cache if not nextPage and not forceRefresh
    if (!nextPage && !forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          ctx.messages = JSON.parse(cached);
          ctx.messagesPage = 0;
          ctx.resolveMessagesSeenStatus(conversationId);
          ctx.renderMessages();
          ctx.messagesLoading = false;
          if (msgContainer) {
            msgContainer.scrollTop = msgContainer.scrollHeight;
          }
          return;
        } catch (e) {
          console.warn('Failed to parse cached messages:', e);
        }
      }
    }

    try {
      let page = nextPage ? (ctx.messagesPage || 0) + 1 : 0;
      let size = 20;
      let lastId = '';

      if (nextPage && ctx.messages.length > 0) {
        const oldestMsg = ctx.messages[0];
        lastId = oldestMsg.id || '';
      }

      let url = `messages/${conversationId}?size=${size}`;
      if (lastId) {
        url += `&lastId=${lastId}`;
      }

      const response = await api.get(url);
      if (response && response.success) {
        let messagesList = [];
        let serverHasMore = false;

        if (response.data) {
          if (Array.isArray(response.data.data)) {
            messagesList = response.data.data;
            serverHasMore = response.data.hasMore === true;
          } else if (Array.isArray(response.data)) {
            messagesList = response.data;
          }
        }

        ctx.hasMoreMessages = serverHasMore;

        const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
        const mappedMessages = messagesList.map(msg => {
          const senderId = msg.senderId !== undefined && msg.senderId !== null ? msg.senderId : msg.sender?.userId;
          const isRevoked = msg.revoked === true;
          const msgType = String(msg.type || 'TEXT').toUpperCase();
          let textVal = msg.text || msg.message || '';
          let rawTextVal = textVal;

          const isSystemMsg = msgType === 'REMOVE_MEMBER' || msgType === 'ADD_MEMBER' || msgType === 'LEAVED';
          if (isSystemMsg) {
            textVal = formatSystemMessage(msgType, textVal);
          }

          return {
            id: msg.messageId || msg.id,
            sender: String(senderId) === String(currentUserId) ? 'me' : 'them',
            senderId: senderId,
            text: isRevoked ? t('revoked_msg') : textVal,
            type: msg.type || 'TEXT',
            time: formatMessageTime(msg.createdAt),
            status: 'sent',
            isRevoked: isRevoked,
            replyMessageId: msg.replyMessageId || null,
            replyText: msg.replyText || null,
            replyType: msg.replyType || null,
            replyRevoked: msg.replyRevoked === true,
            rawText: isSystemMsg ? rawTextVal : undefined,
            reactorCount: msg.reactorCount || msg.reactionCount || null,
            createdAt: msg.createdAt
          };
        });

        // Đảo ngược danh sách tin nhắn để hiển thị theo thứ tự thời gian tăng dần (cũ ở trên, mới ở dưới)
        mappedMessages.reverse();

        if (nextPage) {
          ctx.messagesPage = page;
          const previousScrollHeight = msgContainer ? msgContainer.scrollHeight : 0;

          ctx.messages = [...mappedMessages, ...ctx.messages];
          ctx.resolveMessagesSeenStatus(conversationId);

          sessionStorage.setItem(cacheKey, JSON.stringify(ctx.messages));
          ctx.renderMessages();

          if (msgContainer) {
            msgContainer.scrollTop = msgContainer.scrollHeight - previousScrollHeight;
          }
        } else {
          ctx.messagesPage = 0;
          ctx.messages = mappedMessages;
          ctx.resolveMessagesSeenStatus(conversationId);

          sessionStorage.setItem(cacheKey, JSON.stringify(ctx.messages));
          ctx.renderMessages();
          if (msgContainer) {
            msgContainer.scrollTop = msgContainer.scrollHeight;
          }
        }
      }
    } catch (err) {
      console.warn('[HomeView] Failed to load messages:', err);
    } finally {
      ctx.messagesLoading = false;
    }
  },

  setupMessagesScroll(ctx) {
    const msgContainer = document.getElementById('chat-messages-container');
    if (!msgContainer) return;

    msgContainer.addEventListener('scroll', () => {
      if (ctx.hasMoreMessages && !ctx.messagesLoading && msgContainer.scrollTop === 0) {
        if (ctx.conversationId) {
          this.loadMessages(ctx, ctx.conversationId, true);
        }
      }
    });
  }
};
