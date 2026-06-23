import { socket } from '../../../../js/core/websocket.js';

export const OfflineQueueHandler = {
  queueKey: 'chat_offline_queue',
  isSyncing: false,

  async processOfflineQueue(ctx) {
    if (this.isSyncing || !navigator.onLine || !ctx.conversationId) return;

    let queue = JSON.parse(localStorage.getItem(this.queueKey) || '[]');
    if (queue.length === 0) return;

    if (!socket.ws || socket.ws.readyState !== 1 /* WebSocket.OPEN */) {
      return;
    }

    this.isSyncing = true;

    while (queue.length > 0 && navigator.onLine) {
      try {
        const item = queue[0];
        const clientMsgId = socket.send(item.conversationId, item.message, item.type.toUpperCase(), null, item.replyMessageId);

        if (String(item.conversationId) === String(ctx.conversationId)) {
          const msgIndex = ctx.messages.findIndex(m => m.id === item.tempId);
          if (msgIndex !== -1) {
            ctx.messages[msgIndex].status = 'sending';
            ctx.messages[msgIndex].clientMsgId = clientMsgId;
          }
        }

        // Cập nhật clientMsgId vào trong cache sessionStorage của cuộc hội thoại
        const cacheKey = `chat_messages_cache_${item.conversationId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const messages = JSON.parse(cached);
            const cachedMsg = messages.find(m => String(m.id) === String(item.tempId));
            if (cachedMsg) {
              cachedMsg.clientMsgId = clientMsgId;
              sessionStorage.setItem(cacheKey, JSON.stringify(messages));
            }
          } catch (e) {
            console.warn('Failed to update cache in offline-queue-handler:', e);
          }
        }

        queue.shift();
        localStorage.setItem(this.queueKey, JSON.stringify(queue));
        sessionStorage.setItem(`chat_messages_cache_${item.conversationId}`, JSON.stringify(ctx.messages));

        if (String(item.conversationId) === String(ctx.conversationId)) {
          ctx.renderMessages();
        }
      } catch (error) {
        console.error('[Offline Queue] Gửi tin offline thất bại:', error);
        break;
      }
    }
    this.isSyncing = false;
  },

  addOfflineMessage(ctx, tempId, conversationId, messageText, type = 'text', replyMessageId = null) {
    let queue = JSON.parse(localStorage.getItem(this.queueKey) || '[]');
    queue.push({
      tempId,
      conversationId,
      message: messageText,
      type,
      replyMessageId
    });
    localStorage.setItem(this.queueKey, JSON.stringify(queue));
    this.processOfflineQueue(ctx);
  }
};
