import { showDialog } from '../../../js/shared/dialog/dialog.js';
import { api } from '../../../js/core/api.js';
import { socket } from '../../../js/core/websocket.js';
import { showIncomingMessageToast } from './toast.js';
import { renderMessages, updateChatHeader, renderEmptyChatFrame } from './chat-frame.js';
import { renderConversationsList } from './conversations.js';

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
              <p>Online</p>
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
          </div>

          <div class="chat-messages" id="chat-messages-container">
            <!-- Filled dynamically -->
          </div>

          <div class="chat-footer">
            <input type="file" id="image-upload-input" accept="image/*" style="display: none;">
            <input type="file" id="file-upload-input" accept="*/*" style="display: none;">
            <input type="file" id="video-upload-input" accept="video/*" style="display: none;">

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
    `;
  },

  async init(router, queryParams) {
    this.router = router;
    const msgContainer = document.getElementById('chat-messages-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('btn-send-message');
    const dashboard = document.querySelector('.chat-dashboard');

    const queueKey = 'chat_offline_queue';

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

    this.onMessageReceived = (event) => {
      if (!event) return;

      const eventType = event.type || event.eventType;
      if (!eventType) return;

      // Xác định đối tượng message (MessageDto) và conversation (ConversationDto)
      let messageDto = null;
      let conversationDto = null;

      // 1. Theo cấu trúc mới DataDto
      if (event.message && typeof event.message === 'object') {
        messageDto = event.message;
      }
      if (event.conversation && typeof event.conversation === 'object') {
        conversationDto = event.conversation;
      }

      // 2. Fallback cấu trúc cũ phẳng hoặc dùng data
      const data = event.data || event;
      if (!messageDto && data && typeof data === 'object') {
        if (data.conversationId || data.messageId || data.text || (data.message && typeof data.message !== 'string')) {
          messageDto = data;
        }
      }
      if (!conversationDto && data && typeof data === 'object') {
        if (data.conversationId && !data.messageId) {
          conversationDto = data;
        }
      }

      switch (eventType) {
        case 'NEW_CONVERSATION':
          if (conversationDto && conversationDto.conversationId) {
            const exists = this.conversations.some(c => String(c.conversationId) === String(conversationDto.conversationId));
            if (!exists) {
              this.conversations.unshift(conversationDto);
              this.renderConversationsList();
            }
          }
          break;

        case 'SEND_MESSAGE':
        case 'NEW_MESSAGE':
          if (messageDto && messageDto.conversationId) {
            const activeConvoId = String(this.conversationId);
            const incomingConvoId = String(messageDto.conversationId);

            const senderId = messageDto.senderId !== undefined && messageDto.senderId !== null ? messageDto.senderId : messageDto.sender?.userId;
            const messageText = messageDto.text || messageDto.message;
            const isRevoked = messageDto.revoked === true;

            const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
            const isMe = String(senderId) === String(currentUserId);

            // Update cache for the incoming conversation if it exists in sessionStorage
            const targetCacheKey = `chat_messages_cache_${incomingConvoId}`;
            const targetCached = sessionStorage.getItem(targetCacheKey);
            if (targetCached) {
              try {
                const targetMsgs = JSON.parse(targetCached);
                const isDuplicate = targetMsgs.some(m => String(m.id) === String(messageDto.messageId || messageDto.id));
                if (!isDuplicate) {
                  if (incomingConvoId === activeConvoId) {
                    // For active conversation, handle resolving pending/sending states locally
                    let existingIndex = this.messages.findIndex(m =>
                      m.sender === 'me' &&
                      (m.status === 'pending' || m.status === 'sending') &&
                      (m.text === messageText || m.text.trim() === messageText.trim())
                    );
                    if (existingIndex === -1) {
                      existingIndex = this.messages.findIndex(m =>
                        m.sender === 'me' &&
                        (m.status === 'pending' || m.status === 'sending')
                      );
                    }

                    if (existingIndex !== -1) {
                      this.messages[existingIndex].status = 'sent';
                      this.messages[existingIndex].id = messageDto.messageId || messageDto.id;
                      this.messages[existingIndex].time = new Date(messageDto.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                      this.messages[existingIndex].isRevoked = isRevoked;
                      this.messages[existingIndex].type = messageDto.type || messageDto.messageType || this.messages[existingIndex].type || 'TEXT';
                      if (isRevoked) {
                        this.messages[existingIndex].text = 'Tin nhắn đã bị thu hồi';
                      }
                    } else {
                      this.messages.push({
                        id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
                        sender: isMe ? 'me' : 'them',
                        text: isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
                        type: messageDto.type || messageDto.messageType || 'TEXT',
                        time: new Date(messageDto.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                        status: 'sent',
                        isRevoked: isRevoked
                      });
                    }
                    sessionStorage.setItem(targetCacheKey, JSON.stringify(this.messages));
                    this.renderMessages();
                  } else {
                    // For inactive conversation, just append to target cached messages list
                    targetMsgs.push({
                      id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
                      sender: isMe ? 'me' : 'them',
                      text: isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
                      type: messageDto.type || messageDto.messageType || 'TEXT',
                      time: new Date(messageDto.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                      status: 'sent',
                      isRevoked: isRevoked
                    });
                    sessionStorage.setItem(targetCacheKey, JSON.stringify(targetMsgs));
                  }
                }
              } catch (e) {
                console.warn('Failed to parse and update target messages cache:', e);
              }
            } else if (incomingConvoId === activeConvoId) {
              // Active conversation with no cache yet (fallback, should be rare)
              const isDuplicate = this.messages.some(m => String(m.id) === String(messageDto.messageId || messageDto.id));
              if (!isDuplicate) {
                this.messages.push({
                  id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
                  sender: isMe ? 'me' : 'them',
                  text: isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
                  type: messageDto.type || messageDto.messageType || 'TEXT',
                  time: new Date(messageDto.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  status: 'sent',
                  isRevoked: isRevoked
                });
                sessionStorage.setItem(targetCacheKey, JSON.stringify(this.messages));
                this.renderMessages();
              }
            }

            if (incomingConvoId !== activeConvoId && !isMe) {
              // Hiển thị thông báo Toast nếu không ở trong hội thoại đó và không phải mình gửi
              let senderName = 'Tin nhắn mới';
              const convo = this.conversations.find(c => String(c.conversationId) === incomingConvoId);
              if (convo) {
                if (convo.group) {
                  senderName = convo.title || `Nhóm #${incomingConvoId}`;
                } else {
                  senderName = convo.title || `Trò chuyện #${incomingConvoId}`;
                  const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
                  const otherUserId = otherParticipant ? otherParticipant.userId : null;
                  if (otherUserId && this.profileCache.has(String(otherUserId))) {
                    senderName = this.profileCache.get(String(otherUserId)).fullName;
                  }
                }
              }
              this.showIncomingMessageToast(senderName, isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText, incomingConvoId);
            }

            // Cập nhật preview tin nhắn cuối ở sidebar và đưa cuộc trò chuyện lên đầu
            const convoIndex = this.conversations.findIndex(c => String(c.conversationId) === incomingConvoId);
            if (convoIndex !== -1) {
              const convo = this.conversations[convoIndex];
              convo.lastMessageText = isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText;
              convo.lastMessageTime = messageDto.createdAt;
              convo.lastMessageId = messageDto.messageId || messageDto.id;

              // Tăng số tin nhắn chưa đọc của hội thoại nếu không phải mình gửi
              if (incomingConvoId !== activeConvoId && !isMe) {
                convo.unreadMessage = (convo.unreadMessage || 0) + 1;
              }

              this.conversations.splice(convoIndex, 1);
              this.conversations.unshift(convo);
              this.renderConversationsList();
            } else {
              if (conversationDto) {
                const idx = this.conversations.findIndex(c => String(c.conversationId) === String(conversationDto.conversationId));
                if (idx !== -1) {
                  this.conversations.splice(idx, 1);
                }
                this.conversations.unshift(conversationDto);
                this.renderConversationsList();
              } else {
                this.loadConversations(false);
              }
            }
          }
          break;

        case 'REVOKE_MESSAGE':
          if (messageDto && messageDto.conversationId && (messageDto.messageId || messageDto.id)) {
            const targetMsgId = String(messageDto.messageId || messageDto.id);
            const incomingConvoId = String(messageDto.conversationId);
            const activeConvoId = String(this.conversationId);

            // Update cache for the conversation if it exists in sessionStorage
            const targetCacheKey = `chat_messages_cache_${incomingConvoId}`;
            const targetCached = sessionStorage.getItem(targetCacheKey);
            if (targetCached) {
              try {
                const targetMsgs = JSON.parse(targetCached);
                const msgIndex = targetMsgs.findIndex(m => String(m.id) === targetMsgId);
                if (msgIndex !== -1) {
                  targetMsgs[msgIndex].text = 'Tin nhắn đã bị thu hồi';
                  targetMsgs[msgIndex].isRevoked = true;
                  sessionStorage.setItem(targetCacheKey, JSON.stringify(targetMsgs));
                }
              } catch (e) {
                console.warn('Failed to parse and update target messages cache on revoke:', e);
              }
            }

            if (incomingConvoId === activeConvoId) {
              const msgIndex = this.messages.findIndex(m => String(m.id) === targetMsgId);
              if (msgIndex !== -1) {
                this.messages[msgIndex].text = 'Tin nhắn đã bị thu hồi';
                this.messages[msgIndex].isRevoked = true;
                this.renderMessages();
              }
            }

            const convo = this.conversations.find(c => String(c.conversationId) === incomingConvoId);
            if (convo && convo.lastMessageId && String(convo.lastMessageId) === targetMsgId) {
              convo.lastMessageText = 'Tin nhắn đã bị thu hồi';
              this.renderConversationsList();
            }
          }
          break;

        case 'SEEN_MESSAGE':
          break;

        default:
          console.warn('Unknown WebSocket event type:', eventType);
      }
    };
    socket.addListener(this.onMessageReceived);

    // 2. Tải danh sách cuộc hội thoại
    let initialConversationId = queryParams && (queryParams.conversationId || queryParams.id);
    await this.loadConversations(true, initialConversationId);
    this.setupConversationsScroll();
    this.setupMessagesScroll();

    // 3. Xử lý hàng đợi Offline gửi tin
    let isSyncing = false;
    const processOfflineQueue = async () => {
      if (isSyncing || !navigator.onLine || !this.conversationId) return;

      let queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      if (queue.length === 0) return;

      if (!socket.ws || socket.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      isSyncing = true;

      while (queue.length > 0 && navigator.onLine) {
        const item = queue[0];
        try {
          socket.send(item.conversationId, item.message, item.type);

          if (String(item.conversationId) === String(this.conversationId)) {
            const msgIndex = this.messages.findIndex(m => m.id === item.tempId);
            if (msgIndex !== -1) {
              this.messages[msgIndex].status = 'sending';
            }
          }

          queue.shift();
          localStorage.setItem(queueKey, JSON.stringify(queue));
          sessionStorage.setItem(`chat_messages_cache_${item.conversationId}`, JSON.stringify(this.messages));

          if (String(item.conversationId) === String(this.conversationId)) {
            this.renderMessages();
          }
        } catch (error) {
          console.error('[Offline Queue] Gửi tin offline thất bại:', error);
          break;
        }
      }
      isSyncing = false;
    };

    this.syncIntervalId = setInterval(processOfflineQueue, 4000);

    this.handleOnlineStatus = () => {
      processOfflineQueue();
    };
    window.addEventListener('online', this.handleOnlineStatus);

    // 4. Hàm gửi tin nhắn
    const sendMessage = () => {
      const text = messageInput.value.trim();
      if (!text || !this.conversationId) return;

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const tempId = `temp_${Date.now()}`;

      const newMsg = {
        id: tempId,
        sender: 'me',
        text,
        time: timeStr,
        status: 'pending'
      };

      this.messages.push(newMsg);
      messageInput.value = '';
      messageInput.style.height = '44px';
      sessionStorage.setItem(`chat_messages_cache_${this.conversationId}`, JSON.stringify(this.messages));
      this.renderMessages();

      let queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      queue.push({
        tempId,
        conversationId: this.conversationId,
        message: text,
        type: 'text'
      });
      localStorage.setItem(queueKey, JSON.stringify(queue));

      processOfflineQueue();
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
    }


    // 6. Lắng nghe thông báo Firebase khi ứng dụng đang mở (Foreground)
    import('../../../js/core/firebase.js')
      .then(({ initForegroundNotificationListener }) => {
        initForegroundNotificationListener(async (payload) => {
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

    // 7. Xử lý tải lên Ảnh, Video, Ghi âm và Tài liệu
    const btnUploadImage = document.getElementById('btn-upload-image');
    const imageUploadInput = document.getElementById('image-upload-input');
    const btnUploadVideo = document.getElementById('btn-upload-video');
    const videoUploadInput = document.getElementById('video-upload-input');
    const btnRecordVoice = document.getElementById('btn-record-voice');
    const micIcon = document.getElementById('mic-icon');
    const btnUploadFile = document.getElementById('btn-upload-file');
    const fileUploadInput = document.getElementById('file-upload-input');

    // Các thành phần cho menu mở rộng trên điện thoại
    const btnToggleExtraActions = document.getElementById('btn-toggle-extra-actions');
    const chatExtraActionsMenu = document.getElementById('chat-extra-actions-menu');
    const menuUploadVideo = document.getElementById('menu-upload-video');
    const menuUploadFile = document.getElementById('menu-upload-file');

    const handleFileUpload = async (file, type) => {
      if (!this.conversationId) return;

      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay active';
      overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">Đang tải tệp tin lên...</div>
      `;
      document.body.appendChild(overlay);

      try {
        const uploadFunc = (type === 'IMAGE') ? api.uploadImage : api.uploadFile;
        const res = await uploadFunc(file, 'messages');
        
        document.body.removeChild(overlay);

        if (res && res.success && res.data) {
          const fileUrl = res.data.publicUrl;
          const fileId = res.data.publicId;
          
          socket.send(this.conversationId, fileUrl, type, fileId);
          
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const tempId = `temp_${Date.now()}`;
          
          this.messages.push({
            id: tempId,
            sender: 'me',
            text: fileUrl,
            type: type,
            time: timeStr,
            status: 'pending'
          });
          
          sessionStorage.setItem(`chat_messages_cache_${this.conversationId}`, JSON.stringify(this.messages));
          this.renderMessages();
        } else {
          await showDialog({
            title: 'Lỗi tải lên',
            message: res?.message || 'Không thể tải tệp tin lên máy chủ.',
            type: 'error'
          });
        }
      } catch (err) {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        console.error('File upload failed:', err);
        await showDialog({
          title: 'Lỗi hệ thống',
          message: err.message || 'Có lỗi hệ thống xảy ra khi tải tệp tin.',
          type: 'error'
        });
      }
    };

    if (btnUploadImage && imageUploadInput) {
      btnUploadImage.addEventListener('click', () => imageUploadInput.click());
      imageUploadInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        const file = e.target.files[0];
        await handleFileUpload(file, 'IMAGE');
        imageUploadInput.value = '';
      });
    }

    if (btnUploadVideo && videoUploadInput) {
      btnUploadVideo.addEventListener('click', () => videoUploadInput.click());
      videoUploadInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        const file = e.target.files[0];
        await handleFileUpload(file, 'VIDEO');
        videoUploadInput.value = '';
      });
    }

    if (btnRecordVoice) {
      btnRecordVoice.addEventListener('click', async () => {
        if (!this.isRecording) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.recordingStream = stream;
            this.audioChunks = [];
            
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.addEventListener('dataavailable', (event) => {
              this.audioChunks.push(event.data);
            });

            this.mediaRecorder.addEventListener('stop', async () => {
              const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
              const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
              await handleFileUpload(audioFile, 'AUDIO');
            });

            this.mediaRecorder.start();
            this.isRecording = true;
            
            btnRecordVoice.style.background = '#ef4444';
            btnRecordVoice.style.color = '#ffffff';
            btnRecordVoice.style.borderColor = '#ef4444';
            btnRecordVoice.title = 'Dừng ghi âm';
            if (micIcon) {
              micIcon.innerHTML = `
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
              `;
            }
          } catch (err) {
            console.error('Cannot access microphone:', err);
            await showDialog({
              title: 'Lỗi truy cập Microphone',
              message: 'Vui lòng cấp quyền truy cập microphone cho trình duyệt.',
              type: 'error'
            });
          }
        } else {
          if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
          }
          if (this.recordingStream) {
            this.recordingStream.getTracks().forEach(track => track.stop());
            this.recordingStream = null;
          }
          this.isRecording = false;

          btnRecordVoice.style.background = '';
          btnRecordVoice.style.color = '';
          btnRecordVoice.style.borderColor = '';
          btnRecordVoice.title = 'Ghi âm giọng nói';
          if (micIcon) {
            micIcon.innerHTML = `
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            `;
          }
        }
      });
    }

    if (btnUploadFile && fileUploadInput) {
      btnUploadFile.addEventListener('click', () => fileUploadInput.click());
      fileUploadInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        const file = e.target.files[0];
        await handleFileUpload(file, 'FILE');
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

  async loadConversations(autoSelect = true, initialConversationId = null, nextPage = false) {
    if (this.conversationsLoading) return;
    this.conversationsLoading = true;

    const listContainer = document.getElementById('conversations-list-container');
    if (!listContainer) {
      this.conversationsLoading = false;
      return;
    }

    try {
      let page = nextPage ? (this.conversationsPage || 0) + 1 : 0;
      let size = 20;
      let lastId = '';

      if (nextPage && this.conversations.length > 0) {
        const lastConvo = this.conversations[this.conversations.length - 1];
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

      this.hasMoreConversations = serverHasMore;

      if (nextPage) {
        this.conversationsPage = page;
        this.conversations = [...this.conversations, ...listData];
      } else {
        this.conversationsPage = 0;
        this.conversations = listData;
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      if (!nextPage) this.conversations = [];
    } finally {
      this.conversationsLoading = false;
    }

    this.renderConversationsList();

    if (autoSelect && !nextPage) {
      let targetId = initialConversationId;
      if (!targetId && this.conversations.length > 0) {
        targetId = this.conversations[0].conversationId;
      }

      if (targetId) {
        this.selectConversation(targetId);
      } else {
        this.renderEmptyChatFrame();
      }
    }
  },

  renderConversationsList() {
    renderConversationsList(
      this.conversations,
      this.conversationId,
      this.getUserNameAndAvatar.bind(this),
      this.selectConversation.bind(this)
    );
  },

  setupConversationsScroll() {
    const listContainer = document.getElementById('conversations-list-container');
    if (!listContainer) return;

    listContainer.addEventListener('scroll', () => {
      if (this.hasMoreConversations && !this.conversationsLoading) {
        if (listContainer.scrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 20) {
          this.loadConversations(false, null, true);
        }
      }
    });
  },

  getUserNameAndAvatar(userId, titleElementId, avatarElementId) {
    if (this.profileCache.has(String(userId))) {
      const profile = this.profileCache.get(String(userId));
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
        this.profileCache.set(String(userId), res.data);
        const titleEl = document.getElementById(titleElementId);
        const avatarEl = document.getElementById(avatarElementId);
        if (titleEl) titleEl.textContent = res.data.fullName;
        if (avatarEl && res.data.avatarUrl) avatarEl.src = res.data.avatarUrl;

        const activeConvo = this.conversations.find(c => String(c.conversationId) === String(this.conversationId));
        if (activeConvo && !activeConvo.title && !activeConvo.group) {
          const currentUserId = localStorage.getItem('chat_user_id');
          const activeOtherParticipant = activeConvo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
          if (activeOtherParticipant && String(activeOtherParticipant.userId) === String(userId)) {
            this.updateChatHeader(res.data.fullName, res.data.avatarUrl, 'Đang hoạt động');
          }
        }
      }
    }).catch(err => {
      console.warn('Failed to lazy load profile:', err);
    });
  },

  async selectConversation(conversationId) {
    this.conversationId = conversationId;

    const items = document.querySelectorAll('.conversation-item');
    items.forEach(item => {
      if (String(item.dataset.id) === String(conversationId)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    history.replaceState(null, '', `#home?conversationId=${conversationId}`);
    if (this.router) {
      this.router.currentHash = `home?conversationId=${conversationId}`;
    }

    const convo = this.conversations.find(c => String(c.conversationId) === String(conversationId));
    let hasUnread = false;
    if (convo) {
      if (convo.unreadMessage && convo.unreadMessage > 0) {
        hasUnread = true;
        convo.unreadMessage = 0;
        this.renderConversationsList();
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
          if (otherUserId && this.profileCache.has(String(otherUserId))) {
            const cachedProfile = this.profileCache.get(String(otherUserId));
            displayTitle = cachedProfile.fullName;
            avatarUrl = cachedProfile.avatarUrl || avatarUrl;
          } else {
            displayTitle = 'Đang tải...';
            if (otherUserId) {
              const elementUniqueId = `convo-title-${convo.conversationId}`;
              const avatarUniqueId = `convo-avatar-${convo.conversationId}`;
              this.getUserNameAndAvatar(otherUserId, elementUniqueId, avatarUniqueId);
            }
          }
        } else {
          displayTitle = 'Nhóm trò chuyện #' + convo.conversationId;
        }
      }

      this.updateChatHeader(displayTitle || ('Cuộc trò chuyện ' + conversationId), avatarUrl, convo.group ? 'Nhóm trò chuyện' : 'Đang hoạt động');
    }

    const cacheKey = `chat_messages_cache_${conversationId}`;
    const cached = sessionStorage.getItem(cacheKey);
    const msgContainer = document.getElementById('chat-messages-container');

    if (cached && !hasUnread) {
      try {
        this.messages = JSON.parse(cached);
        this.hasMoreMessages = this.messages.length >= 20;
        this.messagesPage = Math.max(0, Math.floor(this.messages.length / 20) - 1);
        this.renderMessages();
        if (msgContainer) {
          setTimeout(() => {
            msgContainer.scrollTop = msgContainer.scrollHeight;
          }, 50);
        }
      } catch (e) {
        console.warn('Failed to parse cached messages:', e);
        this.messages = [];
        this.loadMessages(conversationId, false);
      }
    } else {
      this.messages = [];
      if (msgContainer) {
        msgContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
            <div class="spinner" style="margin-bottom: 10px;"></div>
            Đang tải tin nhắn...
          </div>
        `;
      }
      this.loadMessages(conversationId, false);
    }
  },

  updateChatHeader(title, avatarUrl, statusText) {
    updateChatHeader(title, avatarUrl, statusText);
  },

  renderEmptyChatFrame() {
    renderEmptyChatFrame();
  },

  renderMessages() {
    renderMessages(this.messages);
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

  async loadMessages(conversationId, nextPage = false) {
    if (this.messagesLoading) return;
    this.messagesLoading = true;

    const cacheKey = `chat_messages_cache_${conversationId}`;
    const msgContainer = document.getElementById('chat-messages-container');

    try {
      let page = nextPage ? (this.messagesPage || 0) + 1 : 0;
      let size = 20;
      let lastId = '';

      if (nextPage && this.messages.length > 0) {
        const oldestMsg = this.messages[0];
        lastId = oldestMsg.id || '';
      }

      let url = `messages/${conversationId}?page=${page}&size=${size}`;
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

        this.hasMoreMessages = serverHasMore;

        const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
        const mappedMessages = messagesList.map(msg => {
          const senderId = msg.senderId !== undefined && msg.senderId !== null ? msg.senderId : msg.sender?.userId;
          const isRevoked = msg.revoked === true;
          return {
            id: msg.messageId || msg.id,
            sender: String(senderId) === String(currentUserId) ? 'me' : 'them',
            text: isRevoked ? 'Tin nhắn đã bị thu hồi' : (msg.text || msg.message || ''),
            type: msg.type || 'TEXT',
            time: new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            status: 'sent',
            isRevoked: isRevoked
          };
        });

        // Đảo ngược danh sách tin nhắn để hiển thị theo thứ tự thời gian tăng dần (cũ ở trên, mới ở dưới)
        mappedMessages.reverse();

        if (nextPage) {
          this.messagesPage = page;
          const previousScrollHeight = msgContainer ? msgContainer.scrollHeight : 0;

          this.messages = [...mappedMessages, ...this.messages];

          sessionStorage.setItem(cacheKey, JSON.stringify(this.messages));
          this.renderMessages();

          if (msgContainer) {
            msgContainer.scrollTop = msgContainer.scrollHeight - previousScrollHeight;
          }
        } else {
          this.messagesPage = 0;
          this.messages = mappedMessages;
          sessionStorage.setItem(cacheKey, JSON.stringify(this.messages));
          this.renderMessages();
          if (msgContainer) {
            msgContainer.scrollTop = msgContainer.scrollHeight;
          }
        }
      }
    } catch (err) {
      console.warn('[HomeView] Failed to load messages:', err);
    } finally {
      this.messagesLoading = false;
    }
  },

  setupMessagesScroll() {
    const msgContainer = document.getElementById('chat-messages-container');
    if (!msgContainer) return;

    msgContainer.addEventListener('scroll', () => {
      if (this.hasMoreMessages && !this.messagesLoading && msgContainer.scrollTop === 0) {
        if (this.conversationId) {
          this.loadMessages(this.conversationId, true);
        }
      }
    });
  },

  cleanup() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.handleOnlineStatus) {
      window.removeEventListener('online', this.handleOnlineStatus);
      this.handleOnlineStatus = null;
    }
    if (this.onMessageReceived) {
      socket.removeListener(this.onMessageReceived);
      this.onMessageReceived = null;
    }
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }
    this.isRecording = false;
  }
};

export default HomeView;
