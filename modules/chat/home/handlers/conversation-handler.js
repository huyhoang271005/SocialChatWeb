import { api } from '../../../../js/core/api.js';
import { socket } from '../../../../js/core/websocket.js';
import { VoiceRecorder } from './voice-recorder.js';
import { AttachmentHandler } from './attachment-handler.js';
import { t } from '../../../../js/core/i18n.js';

export const ConversationHandler = {
  async loadConversations(ctx, autoSelect = true, initialConversationId = null, nextPage = false, forceRefresh = false) {
    if (ctx.conversationsLoading) return;
    ctx.conversationsLoading = true;

    const listContainer = document.getElementById('conversations-list-container');
    if (!listContainer) {
      ctx.conversationsLoading = false;
      return;
    }

    // Load from cache if not nextPage and not forceRefresh
    if (!nextPage && !forceRefresh) {
      const cached = sessionStorage.getItem('chat_conversations_cache');
      if (cached) {
        try {
          ctx.conversations = JSON.parse(cached);
          ctx.conversations.forEach(c => {
            if (c.unreadMessage !== undefined && c.unreadMessage !== null) {
              c.unreadMessage = parseInt(c.unreadMessage || 0, 10);
            }
          });
          ctx.renderConversationsList();
          ctx.conversationsLoading = false;

          const isMobile = window.innerWidth <= 768;
          let targetId = initialConversationId;
          if (!targetId && isMobile) {
            ctx.renderEmptyChatFrame();
          } else {
            if (!targetId && ctx.conversations.length > 0) {
              targetId = ctx.conversations[0].conversationId;
            }

            if (targetId) {
              this.selectConversation(ctx, targetId);
              if (initialConversationId) {
                const dashboard = document.querySelector('.chat-dashboard');
                if (dashboard) {
                  dashboard.classList.add('show-chat');
                }
              }
            } else {
              ctx.renderEmptyChatFrame();
            }
          }
          return;
        } catch (e) {
          console.warn('Failed to parse cached conversations:', e);
        }
      }
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
      ctx.conversations.forEach(c => {
        if (c.unreadMessage !== undefined && c.unreadMessage !== null) {
          c.unreadMessage = parseInt(c.unreadMessage || 0, 10);
        }
      });
    } catch (err) {
      console.error('Failed to load conversations:', err);
      if (!nextPage) ctx.conversations = [];
    } finally {
      ctx.conversationsLoading = false;
    }

    ctx.renderConversationsList();

    if (autoSelect && !nextPage) {
      const isMobile = window.innerWidth <= 768;
      let targetId = initialConversationId;
      if (!targetId && isMobile) {
        ctx.renderEmptyChatFrame();
      } else {
        if (!targetId && ctx.conversations.length > 0) {
          targetId = ctx.conversations[0].conversationId;
        }

        if (targetId) {
          this.selectConversation(ctx, targetId);
          if (initialConversationId) {
            const dashboard = document.querySelector('.chat-dashboard');
            if (dashboard) {
              dashboard.classList.add('show-chat');
            }
          }
        } else {
          ctx.renderEmptyChatFrame();
        }
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
    }
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

    // Revoke object URLs and clear staged files and reply state
    if (ctx.stagedFiles && ctx.stagedFiles.length > 0) {
      AttachmentHandler.revokeUrls(ctx.stagedFiles);
      ctx.stagedFiles = [];
    }
    ctx.renderStagedFiles();
    if (ctx.clearReplyState) {
      ctx.clearReplyState();
    }

    const items = document.querySelectorAll('.conversation-item');
    items.forEach(item => {
      if (String(item.dataset.id) === String(conversationId)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const targetHash = `home?conversationId=${conversationId}`;
    if (window.location.hash.substring(1) !== targetHash) {
      window.location.hash = targetHash;
    }

    let hasUnread = false;
    if (convo) {
      const currentUserId = localStorage.getItem('chat_user_id');
      const myUserConvo = convo.userConversations?.find(u => String(u.userId) === String(currentUserId));
      const unreadCount = myUserConvo && myUserConvo.unreadMessage !== undefined && myUserConvo.unreadMessage !== null
        ? parseInt(myUserConvo.unreadMessage || 0, 10)
        : parseInt(convo.unreadMessage || 0, 10);

      if (unreadCount > 0) {
        hasUnread = true;
        convo.unreadMessage = 0;
        if (myUserConvo) {
          myUserConvo.unreadMessage = 0;
        }
        ctx.renderConversationsList();
      }

      const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
      const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';

      let displayTitle = convo.title;
      let avatarUrl = convo.conversationAvatarUrl;

      if (!convo.group) {
        // 1-on-1 chat: Set title = other person's fullName, avatar = other person's avatarUrl
        const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
        if (otherParticipant) {
          displayTitle = otherParticipant.fullName ||
                         otherParticipant.user?.fullName ||
                         otherParticipant.displayName ||
                         otherParticipant.username ||
                         otherParticipant.user?.username ||
                         displayTitle ||
                         'Người dùng';
          avatarUrl = otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl || defaultUserAvatar;
        } else {
          displayTitle = displayTitle || 'Trò chuyện #' + conversationId;
          avatarUrl = avatarUrl || defaultUserAvatar;
        }
      } else {
        // Group chat
        displayTitle = displayTitle || 'Nhóm trò chuyện #' + convo.conversationId;
        avatarUrl = avatarUrl || defaultGroupAvatar;
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
        // Chỉ tải tin nhắn từ server để làm mới danh sách nếu socket chưa kết nối
        const isSocketConnected = socket && socket.client && socket.client.connected;
        if (!isSocketConnected) {
          ctx.loadMessages(conversationId, false);
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
      const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
      await showDialog({
        title: 'Lỗi thực hiện',
        message: err.message || 'Không thể thay đổi trạng thái tắt tiếng cuộc trò chuyện. Vui lòng thử lại.',
        type: 'error'
      });
    }
  },

  async deleteConversation(ctx, conversationId) {
    try {
      const response = await api.patch(`conversations/${conversationId}`);
      if (response && response.success) {
        ctx.conversations = ctx.conversations.filter(c => String(c.conversationId) !== String(conversationId));
        ctx.renderConversationsList();
        if (String(ctx.conversationId) === String(conversationId)) {
          ctx.conversationId = null;
          ctx.messages = [];
          ctx.renderEmptyChatFrame();
        }
      } else {
        throw new Error(response?.message || t('delete_convo_failed_msg'));
      }
    } catch (err) {
      console.warn('Delete conversation API failed:', err);
      const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
      await showDialog({
        title: t('error_title'),
        message: err.message || t('delete_convo_failed_msg'),
        type: 'error'
      });
    }
  },

  async disbandConversation(ctx, conversationId) {
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
        throw new Error(response?.message || t('disband_convo_failed_msg'));
      }
    } catch (err) {
      console.warn('Disband conversation API failed:', err);
      const { showDialog } = await import('../../../../js/shared/dialog/dialog.js');
      await showDialog({
        title: t('error_title'),
        message: err.message || t('disband_convo_failed_msg'),
        type: 'error'
      });
    }
  }
};
