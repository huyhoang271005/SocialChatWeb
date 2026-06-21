import { socket } from '../../../js/core/websocket.js';

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
      const item = queue[0];
      try {
        socket.send(item.conversationId, item.message, item.type, null, item.replyMessageId);

        if (String(item.conversationId) === String(ctx.conversationId)) {
          const msgIndex = ctx.messages.findIndex(m => m.id === item.tempId);
          if (msgIndex !== -1) {
            ctx.messages[msgIndex].status = 'sending';
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
