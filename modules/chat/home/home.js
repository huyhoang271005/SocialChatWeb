import { showDialog } from '../../../js/shared/dialog/dialog.js';
import { api } from '../../../js/core/api.js';
import { socket } from '../../../js/core/websocket.js';
import { showIncomingMessageToast } from './toast.js';
import { renderMessages, updateChatHeader, renderEmptyChatFrame } from './chat-frame.js';
import { renderConversationsList } from './conversations.js';
import { AttachmentHandler } from './attachment-handler.js';
import { VoiceRecorder } from './voice-recorder.js';
import { SeenResolver } from './message-seen-resolver.js';
import { handleSocketEvent } from './socket-event-handler.js';
import { OfflineQueueHandler } from './offline-queue-handler.js';
import { MessageSender } from './message-sender.js';
import { ConversationHandler } from './conversation-handler.js';
import { MessageLoader } from './message-loader.js';

export const HomeView = {
  messages: [],
  conversations: [],
  profileCache: new Map(),
  conversationId: null,
  syncIntervalId: null,
  router: null,
  conversationsPage: 0,
  hasMoreConversations: false,
  messagesPage: 0,
  hasMoreMessages: false,
  messagesLoading: false,
  recordingStream: null,
  mediaRecorder: null,
  isRecording: false,
  audioChunks: [],
  stagedFiles: [],
  recordingTimerInterval: null,
  isRecordingCanceled: false,

  render() {
    const userEmail = localStorage.getItem('chat_user_email') || 'user@example.com';
    const nickname = userEmail.split('@')[0];

    return `
      <div class="chat-dashboard">
        <!-- Sidebar -->
        <div class="chat-sidebar">
          <div class="sidebar-profile">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100" 
              class="sidebar-avatar" 
              id="sidebar-user-avatar"
              alt="Avatar"
            >
            <div class="profile-info">
              <h4 id="sidebar-user-name">${nickname}</h4>
              <p id="sidebar-user-status" style="color: var(--success, #10b981)">Online</p>
            </div>
          </div>

          <div class="sidebar-search" style="display: none;">
            <input type="text" class="form-input" placeholder="Tìm bạn bè..." style="padding: 8px 12px; font-size: 0.85rem;">
          </div>

          <div class="conversations-list" id="conversations-list-container">
            <div class="list-fallback-state" style="padding: 20px; text-align: center;">
              <div class="spinner-sm" style="margin: 0 auto 8px;"></div>
              Đang tải danh sách...
            </div>
          </div>
        </div>

        <!-- Chat Frame -->
        <div class="chat-main">
          <div class="chat-header">
            <div class="chat-partner" id="chat-partner-info">
              <!-- Filled dynamically -->
            </div>
            <div class="chat-header-actions" id="chat-header-actions"></div>
          </div>

          <div class="chat-messages" id="chat-messages-container">
            <!-- Filled dynamically -->
          </div>

          <!-- Typing Indicator -->
          <div id="typing-indicator" class="voice-recording-indicator" style="display: none; align-self: flex-start; margin: 0 20px 10px 20px; width: auto; max-width: 60%; background-color: hsla(230, 25%, 20%, 0.35); border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 0.85rem; padding: 6px 12px; border-radius: var(--radius-md); border-bottom-left-radius: 4px;">
            <span class="voice-recording-dot" style="background-color: var(--text-secondary); width: 8px; height: 8px; animation: pulse-dot 1s infinite alternate;"></span>
            <span>Đang soạn tin nhắn...</span>
          </div>

          <div class="chat-footer" style="display: flex; flex-direction: column; align-items: stretch; gap: 10px; padding: 15px 20px;">
            <input type="file" id="image-upload-input" accept="image/*" style="display: none;" multiple>
            <input type="file" id="file-upload-input" accept="*/*" style="display: none;" multiple>
            <input type="file" id="video-upload-input" accept="video/*" style="display: none;" multiple>

            <!-- Mobile extra actions menu (collapsible) -->
            <div id="chat-extra-actions-menu" class="chat-extra-actions-menu" style="display: none;">
              <button id="menu-upload-video" class="menu-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
                <span>Gửi video</span>
              </button>
              <button id="menu-upload-file" class="menu-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
                <span>Tài liệu</span>
              </button>
            </div>

            <!-- Staged Files Preview Area -->
            <div id="staged-files-container" class="staged-files-container" style="display: none;"></div>

            <!-- Voice Recording Indicator -->
            <div id="voice-recording-indicator" class="voice-recording-indicator" style="display: none; align-items: center; justify-content: center;">
              <span class="voice-recording-dot"></span>
              <span>Đang ghi âm: <span id="voice-duration">00:00</span></span>
              <button id="btn-cancel-voice" class="btn btn-secondary" style="width: auto; height: 32px; padding: 0 12px; margin-left: 15px; font-size: 0.8rem; border-color: rgba(239, 68, 68, 0.4); color: #ef4444; background: rgba(239, 68, 68, 0.05); border-radius: var(--radius-sm); font-weight: 500;">Huỷ</button>
            </div>

            <!-- Voice Preview Container -->
            <div id="voice-preview-container" class="voice-preview-container" style="display: none; align-items: center; justify-content: space-between; gap: 15px; width: 100%; padding: 8px 15px; background-color: hsla(230, 25%, 15%, 0.45); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-color);"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                <audio id="voice-preview-player" controls style="height: 32px; flex: 1; min-width: 150px; outline: none;"></audio>
              </div>
              <div style="display: flex; gap: 10px;">
                <button id="btn-cancel-voice-preview" class="btn btn-secondary" style="width: auto; height: 32px; padding: 0 12px; font-size: 0.85rem; border-color: rgba(239, 68, 68, 0.4); color: #ef4444; background: rgba(239, 68, 68, 0.05); border-radius: var(--radius-sm); font-weight: 500;">Huỷ</button>
                <button id="btn-send-voice-preview" class="btn btn-primary" style="width: auto; height: 32px; padding: 0 12px; font-size: 0.85rem; border-radius: var(--radius-sm); font-weight: 500;">Gửi</button>
              </div>
            </div>

            <!-- Input actions row -->
            <div class="chat-input-row" style="display: flex; align-items: center; gap: 15px; width: 100%;">
              <!-- Mobile actions trigger button (+) -->
              <button id="btn-toggle-extra-actions" class="btn btn-secondary chat-footer-btn mobile-actions-trigger" title="Thêm hành động" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: none; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>

              <!-- Image button stays outside on both mobile and desktop -->
              <button id="btn-upload-image" class="btn btn-secondary chat-footer-btn" title="Gửi ảnh" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>

              <!-- Video button stays outside on desktop, hidden on mobile -->
              <button id="btn-upload-video" class="btn btn-secondary chat-footer-btn desktop-only-action" title="Gửi video" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </button>
              
              <!-- Voice recorder button stays outside on both mobile and desktop -->
              <button id="btn-record-voice" class="btn btn-secondary chat-footer-btn" title="Ghi âm giọng nói" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="mic-icon">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </button>

              <!-- File button stays outside on desktop, hidden on mobile -->
              <button id="btn-upload-file" class="btn btn-secondary chat-footer-btn desktop-only-action" title="Gửi tài liệu" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>

              <textarea 
                id="message-input" 
                class="form-input" 
                placeholder="Nhập nội dung tin nhắn..." 
                autocomplete="off"
                rows="1"
                style="resize: none; height: 44px; min-height: 44px; max-height: 120px; padding: 10px 16px; flex: 1; line-height: 1.4; overflow-y: auto;"
              ></textarea>
              <button id="btn-send-message" class="btn btn-primary" style="width: auto;">
                Gửi
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init(router, queryParams) {
    this.router = router;
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('btn-send-message');

    // 1. WebSocket: Chỉ subscribe đúng 1 topic duy nhất theo userId của chính mình
    const localUserId = localStorage.getItem('chat_user_id');
    const setupWebSocket = (uid) => {
      if (!uid) return;
      socket.connect();
      socket.subscribe(uid);
    };

    if (localUserId) {
      setupWebSocket(localUserId);
    }

    // Gọi tới api profiles/short để lấy thông tin cá nhân của bản thân mình
    const userEmail = localStorage.getItem('chat_user_email') || 'user@example.com';
    const fallbackNickname = userEmail.split('@')[0];

    api.get('profiles/short').then(res => {
      if (res && res.success && res.data) {
        const profile = res.data;
        if (profile.userId) {
          localStorage.setItem('chat_user_id', profile.userId);
          if (String(profile.userId) !== String(localUserId)) {
            setupWebSocket(profile.userId);
          }
        }

        // Cập nhật thông tin lên sidebar
        const avatarEl = document.getElementById('sidebar-user-avatar');
        const nameEl = document.getElementById('sidebar-user-name');

        if (avatarEl && profile.avatarUrl) {
          avatarEl.src = profile.avatarUrl;
        }
        if (nameEl) {
          nameEl.textContent = profile.fullName || profile.username || fallbackNickname;
        }
      }
    }).catch(err => {
      console.warn('Failed to fetch user short profile');
    });

    // Setup socket handler callback
    this.onMessageReceived = (event) => {
      handleSocketEvent(this, event);
    };
    socket.addListener(this.onMessageReceived);

    // 2. Tải danh sách cuộc hội thoại
    let initialConversationId = queryParams && (queryParams.conversationId || queryParams.id);
    await this.loadConversations(true, initialConversationId);
    ConversationHandler.setupConversationsScroll(this);
    MessageLoader.setupMessagesScroll(this);

    // 3. Xử lý hàng đợi Offline gửi tin và trạng thái kết nối
    const updateConnectionStatus = (online) => {
      const statusEl = document.getElementById('sidebar-user-status');
      if (statusEl) {
        if (online) {
          statusEl.textContent = 'Online';
          statusEl.style.color = 'var(--success, #10b981)';
        } else {
          statusEl.textContent = 'Mất kết nối';
          statusEl.style.color = '#ef4444';
        }
      }
    };

    socket.onConnectCallback = () => {
      updateConnectionStatus(true);
      OfflineQueueHandler.processOfflineQueue(this);
    };
    socket.onDisconnectCallback = () => {
      updateConnectionStatus(false);
    };

    this.syncIntervalId = setInterval(() => OfflineQueueHandler.processOfflineQueue(this), 4000);

    this.handleOnlineStatus = () => {
      updateConnectionStatus(true);
      OfflineQueueHandler.processOfflineQueue(this);
    };
    this.handleOfflineStatus = () => {
      updateConnectionStatus(false);
    };

    window.addEventListener('online', this.handleOnlineStatus);
    window.addEventListener('offline', this.handleOfflineStatus);

    // 4. Hàm gửi tin nhắn
    const sendMessage = async () => {
      await MessageSender.sendMessage(this, messageInput);
    };

    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }
    if (messageInput) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (e.shiftKey) {
            // Shift + Enter: Cho phép xuống dòng
            return;
          }
          // Enter: Gửi tin nhắn
          e.preventDefault();
          sendMessage();
        }
      });

      // Tự động co giãn chiều cao theo nội dung nhập
      messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
      });

      messageInput.addEventListener('focus', () => {
        const btnUploadImage = document.getElementById('btn-upload-image');
        const btnUploadVideo = document.getElementById('btn-upload-video');
        const btnUploadFile = document.getElementById('btn-upload-file');
        const btnRecordVoice = document.getElementById('btn-record-voice');
        const btnToggleExtraActions = document.getElementById('btn-toggle-extra-actions');

        if (btnUploadImage) btnUploadImage.style.display = 'none';
        if (btnUploadVideo) btnUploadVideo.style.display = 'none';
        if (btnUploadFile) btnUploadFile.style.display = 'none';
        if (btnRecordVoice) btnRecordVoice.style.display = 'none';
        if (btnToggleExtraActions) btnToggleExtraActions.style.display = 'none';

        if (this.conversationId) {
          socket.sendTyping(this.conversationId);
        }
      });

      messageInput.addEventListener('blur', () => {
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

        if (this.conversationId) {
          socket.sendUntyping(this.conversationId);
        }
      });
    }

    // 5. Lắng nghe thông báo Firebase khi ứng dụng đang mở (Foreground)
    import('../../../js/core/firebase.js')
      .then(({ initForegroundNotificationListener }) => {
        initForegroundNotificationListener(async (payload) => {
          // Bỏ qua các sự kiện thu hồi tin nhắn ở foreground để WebSocket tự xử lý giao diện
          if (payload.data?.messageType === 'REVOKE_MESSAGE') {
            return;
          }

          const senderId = payload.data?.senderId;
          const currentUserId = localStorage.getItem('chat_user_id');
          if (senderId && String(senderId) === String(currentUserId)) {
            return;
          }

          const title = payload.notification?.title || 'Thông báo mới';
          const body = payload.notification?.body || 'Bạn có một tin nhắn mới.';
          const conversationId = payload.data?.conversationId || payload.data?.id;

          this.showIncomingMessageToast(title, body, conversationId);
        });
      })
      .catch(err => {
        console.warn('Không thể khởi tạo bộ lắng nghe thông báo:', err);
      });

    // 6. Xử lý tải lên Ảnh, Video, Ghi âm và Tài liệu
    const btnUploadImage = document.getElementById('btn-upload-image');
    const imageUploadInput = document.getElementById('image-upload-input');
    const btnUploadVideo = document.getElementById('btn-upload-video');
    const videoUploadInput = document.getElementById('video-upload-input');
    const btnRecordVoice = document.getElementById('btn-record-voice');
    const micIcon = document.getElementById('mic-icon');
    const btnUploadFile = document.getElementById('btn-upload-file');
    const fileUploadInput = document.getElementById('file-upload-input');
    const btnCancelVoice = document.getElementById('btn-cancel-voice');

    if (btnCancelVoice) {
      btnCancelVoice.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isRecordingCanceled = true;
        VoiceRecorder.stop(this);
      });
    }

    // Các thành phần cho menu mở rộng trên điện thoại
    const btnToggleExtraActions = document.getElementById('btn-toggle-extra-actions');
    const chatExtraActionsMenu = document.getElementById('chat-extra-actions-menu');
    const menuUploadVideo = document.getElementById('menu-upload-video');
    const menuUploadFile = document.getElementById('menu-upload-file');

    const stageFiles = (files, type) => {
      this.stagedFiles = AttachmentHandler.stageFiles(files, type, this.stagedFiles);
      this.renderStagedFiles();
    };

    if (btnUploadImage && imageUploadInput) {
      btnUploadImage.addEventListener('click', () => imageUploadInput.click());
      imageUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length === 0) return;
        stageFiles(e.target.files, 'IMAGE');
        imageUploadInput.value = '';
      });
    }

    if (btnUploadVideo && videoUploadInput) {
      btnUploadVideo.addEventListener('click', () => videoUploadInput.click());
      videoUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length === 0) return;
        stageFiles(e.target.files, 'VIDEO');
        videoUploadInput.value = '';
      });
    }

    if (btnRecordVoice) {
      btnRecordVoice.addEventListener('click', async () => {
        const voiceRecordingIndicator = document.getElementById('voice-recording-indicator');
        const voiceDuration = document.getElementById('voice-duration');

        if (!this.isRecording) {
          await VoiceRecorder.start(
            this,
            micIcon,
            messageInput,
            voiceRecordingIndicator,
            voiceDuration,
            (audioFile) => {
              this.showVoicePreview(audioFile);
            },
            showDialog
          );
        } else {
          VoiceRecorder.stop(this);
        }
      });
    }

    // Gắn sự kiện cho các nút trong khung xem trước ghi âm (voice preview)
    const btnCancelVoicePreview = document.getElementById('btn-cancel-voice-preview');
    const btnSendVoicePreview = document.getElementById('btn-send-voice-preview');

    if (btnCancelVoicePreview) {
      btnCancelVoicePreview.addEventListener('click', () => {
        this.hideVoicePreview();
      });
    }

    if (btnSendVoicePreview) {
      btnSendVoicePreview.addEventListener('click', async () => {
        if (this.recordedVoiceFile) {
          const fileToSend = this.recordedVoiceFile;
          this.hideVoicePreview();
          await MessageSender.handleDirectFileUpload(this, fileToSend, 'AUDIO');
        }
      });
    }

    if (btnUploadFile && fileUploadInput) {
      btnUploadFile.addEventListener('click', () => fileUploadInput.click());
      fileUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length === 0) return;
        stageFiles(e.target.files, 'FILE');
        fileUploadInput.value = '';
      });
    }

    // Gắn sự kiện cho menu mở rộng trên điện thoại
    if (btnToggleExtraActions && chatExtraActionsMenu) {
      btnToggleExtraActions.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = chatExtraActionsMenu.style.display === 'none';
        chatExtraActionsMenu.style.display = isHidden ? 'flex' : 'none';
      });

      if (this.documentClickListener) {
        document.removeEventListener('click', this.documentClickListener);
      }
      this.documentClickListener = (e) => {
        if (chatExtraActionsMenu.style.display !== 'none' &&
          !chatExtraActionsMenu.contains(e.target) &&
          e.target !== btnToggleExtraActions &&
          !btnToggleExtraActions.contains(e.target)) {
          chatExtraActionsMenu.style.display = 'none';
        }
      };
      document.addEventListener('click', this.documentClickListener);
    }

    if (menuUploadVideo && videoUploadInput) {
      menuUploadVideo.addEventListener('click', () => {
        if (chatExtraActionsMenu) chatExtraActionsMenu.style.display = 'none';
        videoUploadInput.click();
      });
    }

    if (menuUploadFile && fileUploadInput) {
      menuUploadFile.addEventListener('click', () => {
        if (chatExtraActionsMenu) chatExtraActionsMenu.style.display = 'none';
        fileUploadInput.click();
      });
    }
  },

  loadConversations(autoSelect = true, initialConversationId = null, nextPage = false) {
    return ConversationHandler.loadConversations(this, autoSelect, initialConversationId, nextPage);
  },

  renderConversationsList() {
    renderConversationsList(
      this.conversations,
      this.conversationId,
      this.getUserNameAndAvatar.bind(this),
      this.selectConversation.bind(this),
      this.muteConversation.bind(this),
      this.deleteConversation.bind(this)
    );
  },

  getUserNameAndAvatar(userId, titleElementId, avatarElementId) {
    ConversationHandler.getUserNameAndAvatar(this, userId, titleElementId, avatarElementId);
  },

  selectConversation(conversationId) {
    return ConversationHandler.selectConversation(this, conversationId);
  },

  muteConversation(conversationId, currentMuted) {
    return ConversationHandler.muteConversation(this, conversationId, currentMuted);
  },

  deleteConversation(conversationId) {
    return ConversationHandler.deleteConversation(this, conversationId);
  },

  updateChatHeader(title, avatarUrl, statusText, conversationId = null, conversations = []) {
    updateChatHeader(title, avatarUrl, statusText, conversationId, conversations);
  },

  renderEmptyChatFrame() {
    renderEmptyChatFrame();
  },

  renderMessages() {
    renderMessages(this.messages, this.conversationId);
  },

  renderStagedFiles() {
    const container = document.getElementById('staged-files-container');
    AttachmentHandler.renderStagedFiles(this.stagedFiles, container, (index) => {
      if (this.stagedFiles[index]) {
        if (this.stagedFiles[index].previewUrl) {
          URL.revokeObjectURL(this.stagedFiles[index].previewUrl);
        }
        this.stagedFiles.splice(index, 1);
        this.renderStagedFiles();
      }
    });
  },

  showVoicePreview(audioFile) {
    this.recordedVoiceFile = audioFile;
    const previewUrl = URL.createObjectURL(audioFile);
    this.recordedVoicePreviewUrl = previewUrl;

    const previewContainer = document.getElementById('voice-preview-container');
    const previewPlayer = document.getElementById('voice-preview-player');
    const inputRow = document.querySelector('.chat-input-row');

    if (previewPlayer) {
      previewPlayer.src = previewUrl;
    }
    if (previewContainer) {
      previewContainer.style.display = 'flex';
    }
    if (inputRow) {
      inputRow.style.display = 'none';
    }
  },

  hideVoicePreview() {
    const previewContainer = document.getElementById('voice-preview-container');
    const previewPlayer = document.getElementById('voice-preview-player');
    const inputRow = document.querySelector('.chat-input-row');

    if (previewContainer) {
      previewContainer.style.display = 'none';
    }
    if (previewPlayer) {
      previewPlayer.src = '';
    }
    if (inputRow) {
      inputRow.style.display = 'flex';
    }

    if (this.recordedVoicePreviewUrl) {
      URL.revokeObjectURL(this.recordedVoicePreviewUrl);
      this.recordedVoicePreviewUrl = null;
    }
    this.recordedVoiceFile = null;
  },

  resolveMessagesSeenStatus(conversationId) {
    const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
    SeenResolver.resolve(this.messages, this.conversations, conversationId, currentUserId);
  },

  showIncomingMessageToast(senderName, text, conversationId) {
    showIncomingMessageToast(
      senderName,
      text,
      conversationId,
      this.conversations,
      this.profileCache,
      this.selectConversation.bind(this)
    );
  },

  loadMessages(conversationId, nextPage = false) {
    return MessageLoader.loadMessages(this, conversationId, nextPage);
  },

  cleanup() {
    if (this.conversationId) {
      socket.sendUntyping(this.conversationId);
    }
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.handleOnlineStatus) {
      window.removeEventListener('online', this.handleOnlineStatus);
      this.handleOnlineStatus = null;
    }
    if (this.handleOfflineStatus) {
      window.removeEventListener('offline', this.handleOfflineStatus);
      this.handleOfflineStatus = null;
    }
    socket.onConnectCallback = null;
    socket.onDisconnectCallback = null;
    if (this.onMessageReceived) {
      socket.removeListener(this.onMessageReceived);
      this.onMessageReceived = null;
    }
    this.isRecordingCanceled = true;
    VoiceRecorder.stop(this);
    this.hideVoicePreview();

    // Revoke object URLs and clear staged files
    if (this.stagedFiles && this.stagedFiles.length > 0) {
      AttachmentHandler.revokeUrls(this.stagedFiles);
      this.stagedFiles = [];
    }
  }
};

export default HomeView;
