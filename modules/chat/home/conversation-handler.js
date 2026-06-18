import { api } from '../../../js/core/api.js';
import { socket } from '../../../js/core/websocket.js';
import { VoiceRecorder } from './voice-recorder.js';
import { AttachmentHandler } from './attachment-handler.js';

export const ConversationHandler = {
  async loadConversations(ctx, autoSelect = true, initialConversationId = null, nextPage = false) {
    if (ctx.conversationsLoading) return;
    ctx.conversationsLoading = true;

    const listContainer = document.getElementById('conversations-list-container');
    if (!listContainer) {
      ctx.conversationsLoading = false;
      return;
    }

    try {
      let page = nextPage ? (ctx.conversationsPage || 0) + 1 : 0;
      let size = 20;
      let lastId = '';

      if (nextPage && ctx.conversations.length > 0) {
        const lastConvo = ctx.conversations[ctx.conversations.length - 1];
        lastId = lastConvo.conversationId || '';
      }

      let url = `conversations?page=${page}&size=${size}`;
      if (lastId) {
        url += `&lastId=${lastId}`;
      }

      const res = await api.get(url);

      let listData = [];
      let serverHasMore = false;

      if (res && res.success && res.data) {
        if (Array.isArray(res.data.data)) {
          listData = res.data.data;
          serverHasMore = res.data.hasMore === true;
        } else if (Array.isArray(res.data)) {
          listData = res.data;
        }
      } else if (res && Array.isArray(res)) {
        listData = res;
      }

      ctx.hasMoreConversations = serverHasMore;

      if (nextPage) {
        ctx.conversationsPage = page;
        ctx.conversations = [...ctx.conversations, ...listData];
      } else {
        ctx.conversationsPage = 0;
        ctx.conversations = listData;
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      if (!nextPage) ctx.conversations = [];
    } finally {
      ctx.conversationsLoading = false;
    }

    ctx.renderConversationsList();

    if (autoSelect && !nextPage) {
      let targetId = initialConversationId;
      if (!targetId && ctx.conversations.length > 0) {
        targetId = ctx.conversations[0].conversationId;
      }

      if (targetId) {
        this.selectConversation(ctx, targetId);
      } else {
        ctx.renderEmptyChatFrame();
      }
    }
  },

  getUserNameAndAvatar(ctx, userId, titleElementId, avatarElementId) {
    if (ctx.profileCache.has(String(userId))) {
      const profile = ctx.profileCache.get(String(userId));
      setTimeout(() => {
        const titleEl = document.getElementById(titleElementId);
        const avatarEl = document.getElementById(avatarElementId);
        if (titleEl) titleEl.textContent = profile.fullName;
        if (avatarEl && profile.avatarUrl) avatarEl.src = profile.avatarUrl;
      }, 0);
      return;
    }

    api.get(`profiles/${userId}`).then(res => {
      if (res && res.success && res.data) {
        ctx.profileCache.set(String(userId), res.data);
        const titleEl = document.getElementById(titleElementId);
        const avatarEl = document.getElementById(avatarElementId);
        if (titleEl) titleEl.textContent = res.data.fullName;
        if (avatarEl && res.data.avatarUrl) avatarEl.src = res.data.avatarUrl;

        const activeConvo = ctx.conversations.find(c => String(c.conversationId) === String(ctx.conversationId));
        if (activeConvo && !activeConvo.title && !activeConvo.group) {
          const currentUserId = localStorage.getItem('chat_user_id');
          const activeOtherParticipant = activeConvo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
          if (activeOtherParticipant && String(activeOtherParticipant.userId) === String(userId)) {
            ctx.updateChatHeader(res.data.fullName, res.data.avatarUrl, 'Đang hoạt động', ctx.conversationId, ctx.conversations);
          }
        }
      }
    }).catch(err => {
      console.warn('Failed to lazy load profile:', err);
    });
  },

  async selectConversation(ctx, conversationId) {
    // Đảm bảo blur ô nhập tin nhắn trước khi đổi conversationId để gửi untyping cho cuộc hội thoại cũ
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
      messageInput.blur();
    }

    ctx.conversationId = conversationId;

    // Stop active voice recording if any
    if (ctx.isRecording) {
      ctx.isRecordingCanceled = true;
      VoiceRecorder.stop(ctx);
    }

    // Ẩn chỉ báo soạn tin của hội thoại cũ
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.style.display = 'none';
    }

    // Đảm bảo các nút đính kèm hiển thị đúng
    if (messageInput) {
      const btnUploadImage = document.getElementById('btn-upload-image');
      const btnUploadVideo = document.getElementById('btn-upload-video');
      const btnUploadFile = document.getElementById('btn-upload-file');
      const btnRecordVoice = document.getElementById('btn-record-voice');
      const btnToggleExtraActions = document.getElementById('btn-toggle-extra-actions');

      if (btnUploadImage) btnUploadImage.style.display = '';
      if (btnUploadVideo) btnUploadVideo.style.display = '';
      if (btnUploadFile) btnUploadFile.style.display = '';
      if (btnRecordVoice) btnRecordVoice.style.display = '';
      if (btnToggleExtraActions) btnToggleExtraActions.style.display = '';
    }

    const convo = ctx.conversations.find(c => String(c.conversationId) === String(conversationId));

    // Gửi sự kiện SEEN qua WebSocket
    if (socket.client && socket.client.connected) {
      socket.sendSeen(conversationId, convo?.lastMessageId);
    }

    // Revoke object URLs and clear staged files
    if (ctx.stagedFiles && ctx.stagedFiles.length > 0) {
      AttachmentHandler.revokeUrls(ctx.stagedFiles);
      ctx.stagedFiles = [];
    }
    ctx.renderStagedFiles();

    const items = document.querySelectorAll('.conversation-item');
    items.forEach(item => {
      if (String(item.dataset.id) === String(conversationId)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    history.replaceState(null, '', `#home?conversationId=${conversationId}`);
    if (ctx.router) {
      ctx.router.currentHash = `home?conversationId=${conversationId}`;
    }

    let hasUnread = false;
    if (convo) {
      if (convo.unreadMessage && convo.unreadMessage > 0) {
        hasUnread = true;
        convo.unreadMessage = 0;
        ctx.renderConversationsList();
      }

      const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
      const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';

      let avatarUrl = convo.conversationAvatar;
      if (!avatarUrl) {
        avatarUrl = convo.group ? defaultGroupAvatar : defaultUserAvatar;
      }

      let displayTitle = convo.title;
      if (!displayTitle) {
        if (!convo.group) {
          const currentUserId = localStorage.getItem('chat_user_id');
          const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
          const otherUserId = otherParticipant ? otherParticipant.userId : null;
          if (otherUserId && ctx.profileCache.has(String(otherUserId))) {
            const cachedProfile = ctx.profileCache.get(String(otherUserId));
            displayTitle = cachedProfile.fullName;
            avatarUrl = cachedProfile.avatarUrl || avatarUrl;
          } else {
            displayTitle = 'Đang tải...';
            if (otherUserId) {
              const elementUniqueId = `convo-title-${convo.conversationId}`;
              const avatarUniqueId = `convo-avatar-${convo.conversationId}`;
              this.getUserNameAndAvatar(ctx, otherUserId, elementUniqueId, avatarUniqueId);
            }
          }
        } else {
          displayTitle = 'Nhóm trò chuyện #' + convo.conversationId;
        }
      }

      ctx.updateChatHeader(displayTitle || ('Cuộc trò chuyện ' + conversationId), avatarUrl, convo.group ? 'Nhóm trò chuyện' : 'Đang hoạt động', conversationId, ctx.conversations);
    }

    const cacheKey = `chat_messages_cache_${conversationId}`;
    const cached = sessionStorage.getItem(cacheKey);
    const msgContainer = document.getElementById('chat-messages-container');

    if (cached && !hasUnread) {
      try {
        ctx.messages = JSON.parse(cached);
        ctx.resolveMessagesSeenStatus(conversationId);
        ctx.hasMoreMessages = ctx.messages.length >= 20;
        ctx.messagesPage = Math.max(0, Math.floor(ctx.messages.length / 20) - 1);
        ctx.renderMessages();
        if (msgContainer) {
          setTimeout(() => {
            msgContainer.scrollTop = msgContainer.scrollHeight;
          }, 50);
        }
      } catch (e) {
        console.warn('Failed to parse cached messages:', e);
        ctx.messages = [];
        ctx.loadMessages(conversationId, false);
      }
    } else {
      ctx.messages = [];
      if (msgContainer) {
        msgContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
            <div class="spinner" style="margin-bottom: 10px;"></div>
            Đang tải tin nhắn...
          </div>
        `;
      }
      ctx.loadMessages(conversationId, false);
    }
  },

  setupConversationsScroll(ctx) {
    const listContainer = document.getElementById('conversations-list-container');
    if (!listContainer) return;

    listContainer.addEventListener('scroll', () => {
      if (ctx.hasMoreConversations && !ctx.conversationsLoading) {
        if (listContainer.scrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 20) {
          this.loadConversations(ctx, false, null, true);
        }
      }
    });
  },

  async muteConversation(ctx, conversationId, currentMuted) {
    const newMuted = !currentMuted;
    try {
      // Gọi PATCH conversations/mute/{id}
      let response = await api.patch(`conversations/mute/${conversationId}`, { muted: newMuted });
      let success = response && response.success;

      if (!success) {
        // Thử dự phòng POST conversations/{id}/mute
        const response2 = await api.post(`conversations/${conversationId}/mute`, { muted: newMuted });
        if (response2 && response2.success) {
          success = true;
          response = response2;
        }
      }

      if (success) {
        const convo = ctx.conversations.find(c => String(c.conversationId) === String(conversationId));
        if (convo) {
          convo.isMuted = newMuted;
          convo.muted = newMuted;
        }
        ctx.renderConversationsList();
      } else {
        throw new Error(response?.message || 'Không thể thay đổi trạng thái tắt tiếng');
      }
    } catch (err) {
      console.warn('Mute conversation API failed:', err);
      const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
      await showDialog({
        title: 'Lỗi thực hiện',
        message: err.message || 'Không thể thay đổi trạng thái tắt tiếng cuộc trò chuyện. Vui lòng thử lại.',
        type: 'error'
      });
    }
  },

  async deleteConversation(ctx, conversationId) {
    const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
    const confirm = await showDialog({
      title: 'Xóa cuộc trò chuyện',
      message: 'Bạn có chắc chắn muốn xóa cuộc trò chuyện này không? Hành động này không thể hoàn tác.',
      type: 'warning',
      buttons: [
        { text: 'Hủy', type: 'secondary', value: false },
        { text: 'Xóa', type: 'danger', value: true }
      ]
    });

    if (!confirm) return;

    try {
      const response = await api.delete(`conversations/${conversationId}`);
      if (response && response.success) {
        ctx.conversations = ctx.conversations.filter(c => String(c.conversationId) !== String(conversationId));
        ctx.renderConversationsList();
        if (String(ctx.conversationId) === String(conversationId)) {
          ctx.conversationId = null;
          ctx.messages = [];
          ctx.renderEmptyChatFrame();
        }
      } else {
        throw new Error(response?.message || 'Lỗi khi xóa cuộc trò chuyện');
      }
    } catch (err) {
      console.warn('Delete conversation API failed:', err);
      await showDialog({
        title: 'Lỗi thực hiện',
        message: err.message || 'Không thể xóa cuộc trò chuyện. Vui lòng thử lại.',
        type: 'error'
      });
    }
  }
};
