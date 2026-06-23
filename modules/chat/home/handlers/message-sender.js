import { api } from '../../../../js/core/api.js';
import { socket } from '../../../../js/core/websocket.js';
import { showDialog } from '../../../../js/shared/dialog/dialog.js';
import { AttachmentHandler } from './attachment-handler.js';
import { OfflineQueueHandler } from './offline-queue-handler.js';

export const MessageSender = {
  async sendMessage(ctx, messageInput) {
    const text = messageInput.value.trim();
    const hasStagedFiles = ctx.stagedFiles && ctx.stagedFiles.length > 0;
    
    if (!text && !hasStagedFiles) return;
    if (!ctx.conversationId) return;

    const targetConversationId = ctx.conversationId;
    const replyMessageId = ctx.replyingToMessage ? ctx.replyingToMessage.id : null;
    const replyText = ctx.replyingToMessage ? ctx.replyingToMessage.text : null;
    const replyType = ctx.replyingToMessage ? ctx.replyingToMessage.type : null;
    const replyRevoked = ctx.replyingToMessage ? (ctx.replyingToMessage.isRevoked || ctx.replyingToMessage.revoked) : null;

    if (hasStagedFiles) {
      if (!navigator.onLine) {
        await showDialog({
          title: 'Không có kết nối mạng',
          message: 'Bạn đang ngoại tuyến. Vui lòng kết nối mạng để gửi tệp tin.',
          type: 'error'
        });
        return;
      }

      // Sao chép danh sách tệp tin đang chờ và giải phóng khu vực chọn tệp ở chân trang ngay lập tức
      const filesToUpload = [...ctx.stagedFiles];
      ctx.stagedFiles = [];
      ctx.renderStagedFiles();

      // Reset giá trị của các thẻ input file trong DOM để tránh lỗi chọn lại tệp cũ hoặc gửi lặp
      const imageInput = document.getElementById('image-upload-input');
      const videoInput = document.getElementById('video-upload-input');
      const fileInput = document.getElementById('file-upload-input');
      if (imageInput) imageInput.value = '';
      if (videoInput) videoInput.value = '';
      if (fileInput) fileInput.value = '';

      const tempMsgIds = [];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';

      // Đẩy tin nhắn tạm thời lên màn hình lập tức (Optimistic UI)
      filesToUpload.forEach((item, index) => {
        const tempId = `temp_file_${Date.now()}_${index}`;
        tempMsgIds.push(tempId);

        ctx.messages.push({
          id: tempId,
          sender: 'me',
          senderId: currentUserId,
          text: item.previewUrl || item.file.name,
          fileName: item.file.name,
          type: item.type,
          time: timeStr,
          status: 'pending',
          replyMessageId,
          replyText,
          replyType,
          replyRevoked
        });
      });

      sessionStorage.setItem(`chat_messages_cache_${targetConversationId}`, JSON.stringify(ctx.messages));
      ctx.renderMessages();

      // Bắt đầu tải lên ngầm và gửi WebSocket
      this.uploadFilesInBackground(ctx, filesToUpload, tempMsgIds, targetConversationId, replyMessageId);
    }

    // Gửi tin nhắn văn bản nếu có
    if (text) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const tempId = `temp_${Date.now()}`;

      const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
      const newMsg = {
        id: tempId,
        sender: 'me',
        senderId: currentUserId,
        text,
        time: timeStr,
        status: 'pending',
        replyMessageId,
        replyText,
        replyType,
        replyRevoked
      };

      ctx.messages.push(newMsg);
      messageInput.value = '';
      messageInput.style.height = '44px';
      sessionStorage.setItem(`chat_messages_cache_${targetConversationId}`, JSON.stringify(ctx.messages));
      ctx.renderMessages();

      OfflineQueueHandler.addOfflineMessage(ctx, tempId, targetConversationId, text, 'text', replyMessageId);
    }

    // Xóa trạng thái phản hồi sau khi gửi
    if (ctx.clearReplyState) {
      ctx.clearReplyState();
    }
  },

  async uploadFilesInBackground(ctx, filesToUpload, tempMsgIds, targetConversationId, replyMessageId = null) {
    for (let i = 0; i < filesToUpload.length; i++) {
      const item = filesToUpload[i];
      const tempId = tempMsgIds[i];

      try {
        const uploadFunc = (item.type === 'IMAGE') ? api.uploadImage : api.uploadFile;
        const res = await uploadFunc(item.file, 'messages');

        if (res && res.success && res.data) {
          const fileUrl = res.data.publicUrl;
          const fileId = res.data.publicId;

          // Thu hồi URL xem trước để giải phóng bộ nhớ
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }

          // Gửi tin nhắn qua WebSocket và lấy clientMsgId sinh ra
          const clientMsgId = socket.send(targetConversationId, fileUrl, item.type, fileId, replyMessageId);

          // Cập nhật tin nhắn tạm thời thành URL thật trên máy chủ cùng với ngId
          this.updateLocalMessageAfterUpload(ctx, targetConversationId, tempId, fileUrl, clientMsgId);
        } else {
          throw new Error(res?.message || `Không thể tải lên tệp ${item.file.name}`);
        }
      } catch (err) {
        console.error('Background upload failed:', err);
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
        this.markLocalMessageAsFailed(ctx, targetConversationId, tempId);
      }
    }
  },

  updateLocalMessageAfterUpload(ctx, conversationId, tempId, publicUrl, clientMsgId = null) {
    const cacheKey = `chat_messages_cache_${conversationId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const messages = JSON.parse(cached);
        const msg = messages.find(m => String(m.id) === String(tempId));
        if (msg) {
          msg.text = publicUrl;
          if (clientMsgId) {
            msg.clientMsgId = clientMsgId;
          }
          sessionStorage.setItem(cacheKey, JSON.stringify(messages));
        }
      } catch (e) {
        console.warn('Failed to update cache after upload:', e);
      }
    }

    if (String(ctx.conversationId) === String(conversationId)) {
      const msg = ctx.messages.find(m => String(m.id) === String(tempId));
      if (msg) {
        msg.text = publicUrl;
        if (clientMsgId) {
          msg.clientMsgId = clientMsgId;
        }
        ctx.renderMessages();
      }
    }
  },

  markLocalMessageAsFailed(ctx, conversationId, tempId) {
    const cacheKey = `chat_messages_cache_${conversationId}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const messages = JSON.parse(cached);
        const msg = messages.find(m => String(m.id) === String(tempId));
        if (msg) {
          msg.status = 'failed';
          sessionStorage.setItem(cacheKey, JSON.stringify(messages));
        }
      } catch (e) {
        console.warn('Failed to mark message as failed in cache:', e);
      }
    }

    if (String(ctx.conversationId) === String(conversationId)) {
      const msg = ctx.messages.find(m => String(m.id) === String(tempId));
      if (msg) {
        msg.status = 'failed';
        ctx.renderMessages();
      }
    }
  },

  async handleDirectFileUpload(ctx, file, type, replyMessageId = null) {
    if (!ctx.conversationId) return;

    const targetConversationId = ctx.conversationId;
    const tempId = `temp_direct_${Date.now()}`;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Tạo URL xem trước cục bộ cho tệp tin (ghi âm hoặc ảnh trực tiếp)
    const previewUrl = URL.createObjectURL(file);

    const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';

    let replyText = null;
    let replyType = null;
    let replyRevoked = null;
    if (replyMessageId && ctx.messages) {
      const orig = ctx.messages.find(m => String(m.id) === String(replyMessageId));
      if (orig) {
        replyText = orig.text;
        replyType = orig.type;
        replyRevoked = orig.isRevoked || orig.revoked;
      }
    }

    // Đẩy tin nhắn ghi âm tạm thời lên màn hình lập tức (Optimistic UI)
    ctx.messages.push({
      id: tempId,
      sender: 'me',
      senderId: currentUserId,
      text: previewUrl,
      type: type,
      time: timeStr,
      status: 'pending',
      replyMessageId,
      replyText,
      replyType,
      replyRevoked
    });

    sessionStorage.setItem(`chat_messages_cache_${targetConversationId}`, JSON.stringify(ctx.messages));
    ctx.renderMessages();

    // Thực hiện tải lên ngầm và gửi
    this.uploadDirectFileInBackground(ctx, file, tempId, previewUrl, type, targetConversationId, replyMessageId);

    // Xóa trạng thái phản hồi sau khi gửi
    if (ctx.clearReplyState) {
      ctx.clearReplyState();
    }
  },

  async uploadDirectFileInBackground(ctx, file, tempId, previewUrl, type, targetConversationId, replyMessageId = null) {
    try {
      const uploadFunc = (type === 'IMAGE') ? api.uploadImage : api.uploadFile;
      const res = await uploadFunc(file, 'messages');

      if (res && res.success && res.data) {
        const fileUrl = res.data.publicUrl;
        const fileId = res.data.publicId;

        // Thu hồi URL xem trước cục bộ để giải phóng bộ nhớ
        URL.revokeObjectURL(previewUrl);

        // Gửi qua WebSocket và lấy clientMsgId sinh ra
        const clientMsgId = socket.send(targetConversationId, fileUrl, type, fileId, replyMessageId);

        // Cập nhật tin nhắn tạm thời thành URL thật trên máy chủ kèm theo clientMsgId
        this.updateLocalMessageAfterUpload(ctx, targetConversationId, tempId, fileUrl, clientMsgId);
      } else {
        throw new Error(res?.message || `Không thể tải lên tệp tin`);
      }
    } catch (err) {
      console.error('Background direct file upload failed:', err);
      URL.revokeObjectURL(previewUrl);
      this.markLocalMessageAsFailed(ctx, targetConversationId, tempId);
    }
  }
};
