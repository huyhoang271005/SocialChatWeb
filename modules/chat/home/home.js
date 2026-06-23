import { showDialog } from '../../../js/shared/dialog/dialog.js';
import { api } from '../../../js/core/api.js';
import { socket } from '../../../js/core/websocket.js';
import { t } from '../../../js/core/i18n.js';
import { renderMessages, updateChatHeader, renderEmptyChatFrame } from './components/chat-frame.js';
import { renderConversationsList } from './components/conversations.js';
import { AttachmentHandler } from './handlers/attachment-handler.js';
import { VoiceRecorder } from './handlers/voice-recorder.js';
import { SeenResolver } from './handlers/message-seen-resolver.js';
import { handleSocketEvent } from './handlers/socket-event-handler.js';
import { OfflineQueueHandler } from './handlers/offline-queue-handler.js';
import { MessageSender } from './handlers/message-sender.js';
import { ConversationHandler } from './handlers/conversation-handler.js';
import { MessageLoader } from './handlers/message-loader.js';

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
  wasDisconnected: false,

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
              <p id="sidebar-user-status" style="color: var(--success, #10b981)">${navigator.onLine ? t('connected') : t('disconnected')}</p>
            </div>
          </div>

          <div class="sidebar-search" style="display: none;">
            <input type="text" class="form-input" placeholder="${t('search_placeholder')}" style="padding: 8px 12px; font-size: 0.85rem;">
          </div>

          <div class="conversations-list" id="conversations-list-container">
            <div class="list-fallback-state" style="padding: 20px; text-align: center;">
              <div class="spinner-sm" style="margin: 0 auto 8px;"></div>
              ${t('loading_list')}
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
            <span>${t('typing')}</span>
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
                <span>${t('send_video')}</span>
              </button>
              <button id="menu-upload-file" class="menu-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
                <span>${t('document')}</span>
              </button>
              <button id="menu-record-voice" class="menu-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
                <span>${t('record_voice')}</span>
              </button>
            </div>

            <!-- Staged Files Preview Area -->
            <div id="staged-files-container" class="staged-files-container" style="display: none;"></div>

            <!-- Reply Preview Container -->
            <div id="reply-preview-container" class="reply-preview-container" style="display: none;"></div>

            <!-- Voice Recording Indicator -->
            <div id="voice-recording-indicator" class="voice-recording-indicator" style="display: none; align-items: center; justify-content: center;">
              <span class="voice-recording-dot"></span>
              <span>${t('recording')}: <span id="voice-duration">00:00</span></span>
              <button id="btn-cancel-voice" class="btn btn-secondary" style="width: auto; height: 32px; padding: 0 12px; margin-left: 15px; font-size: 0.8rem; border-color: rgba(239, 68, 68, 0.4); color: #ef4444; background: rgba(239, 68, 68, 0.05); border-radius: var(--radius-sm); font-weight: 500;">${t('voice_preview_cancel')}</button>
            </div>

            <!-- Voice Preview Container -->
            <div id="voice-preview-container" class="voice-preview-container" style="display: none; align-items: center; justify-content: space-between; gap: 15px; width: 100%; padding: 8px 15px; background-color: hsla(230, 25%, 15%, 0.45); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-color);"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                <audio id="voice-preview-player" controls style="height: 32px; flex: 1; min-width: 150px; outline: none;"></audio>
              </div>
              <div style="display: flex; gap: 10px;">
                <button id="btn-cancel-voice-preview" class="btn btn-secondary" style="width: auto; height: 32px; padding: 0 12px; font-size: 0.85rem; border-color: rgba(239, 68, 68, 0.4); color: #ef4444; background: rgba(239, 68, 68, 0.05); border-radius: var(--radius-sm); font-weight: 500;">${t('voice_preview_cancel')}</button>
                <button id="btn-send-voice-preview" class="btn btn-primary" style="width: auto; height: 32px; padding: 0 12px; font-size: 0.85rem; border-radius: var(--radius-sm); font-weight: 500;">${t('voice_preview_send')}</button>
              </div>
            </div>

            <!-- Input actions row -->
            <div class="chat-input-row">
              <!-- Mobile actions trigger button (+) -->
              <button id="btn-toggle-extra-actions" class="btn btn-secondary chat-footer-btn mobile-actions-trigger" title="${t('more_actions')}" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: none; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>

              <!-- Image button stays outside on both mobile and desktop -->
              <button id="btn-upload-image" class="btn btn-secondary chat-footer-btn" title="${t('send_image')}" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>

              <!-- Video button stays outside on desktop, hidden on mobile -->
              <button id="btn-upload-video" class="btn btn-secondary chat-footer-btn desktop-only-action" title="${t('send_video')}" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </button>
              
              <!-- Voice recorder button stays outside on desktop, hidden on mobile -->
              <button id="btn-record-voice" class="btn btn-secondary chat-footer-btn desktop-only-action" title="${t('record_voice')}" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="mic-icon">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </button>

              <!-- File button stays outside on desktop, hidden on mobile -->
              <button id="btn-upload-file" class="btn btn-secondary chat-footer-btn desktop-only-action" title="${t('send_document')}" style="width: 40px; min-width: 40px; height: 40px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>

              <textarea 
                id="message-input" 
                class="form-input chat-input-textarea" 
                placeholder="${t('input_placeholder')}" 
                autocomplete="off"
                rows="1"
              ></textarea>
              <button id="btn-send-message" class="chat-send-btn" title="${t('send')}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init(router, queryParams) {
    this.router = router;
    this.wasDisconnected = !navigator.onLine;
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('btn-send-message');



    // Reset reply state
    this.clearReplyState();

    // Listen to reply custom events
    this.replyClickListener = (e) => {
      const messageId = e.detail.messageId;
      const msg = this.messages.find(m => String(m.id) === String(messageId));
      if (msg) {
        this.showReplyPreview(msg);
      }
    };
    document.addEventListener('reply-message-click', this.replyClickListener);

    this.replyQuoteClickListener = (e) => {
      const targetId = e.detail.targetId;
      this.scrollToAndHighlightMessage(targetId);
    };
    document.addEventListener('reply-quote-click', this.replyQuoteClickListener);

    // Event delegation touch gestures for mobile swipe-to-reply
    const msgContainer = document.getElementById('chat-messages-container');
    if (msgContainer) {
      let touchStart = null;
      let touchElement = null;
      let touchIndicator = null;
      let isSwiping = false;

      this.msgTouchStartListener = (e) => {
        const bubble = e.target.closest('.message-bubble');
        if (!bubble || bubble.classList.contains('message-revoked')) return;
        
        if (e.target.closest('a') || e.target.closest('button') || e.target.closest('img') || e.target.closest('video') || e.target.closest('audio')) {
          return;
        }

        const touch = e.touches[0];
        touchStart = { x: touch.clientX, y: touch.clientY };
        touchElement = bubble;
        
        const wrapper = bubble.closest('.message-bubble-wrapper');
        if (wrapper) {
          touchIndicator = wrapper.querySelector('.swipe-reply-indicator');
        }
        isSwiping = false;
      };

      this.msgTouchMoveListener = (e) => {
        if (!touchStart || !touchElement) return;
        const touch = e.touches[0];
        const diffX = touch.clientX - touchStart.x;
        const diffY = touch.clientY - touchStart.y;

        if (!isSwiping) {
          if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
            isSwiping = true;
          } else if (Math.abs(diffY) > 10) {
            touchStart = null;
            touchElement = null;
            touchIndicator = null;
            return;
          }
        }

        if (isSwiping) {
          const isOutgoing = touchElement.classList.contains('message-outgoing');
          
          if (isOutgoing) {
            // Outgoing message: swipe left (diffX < 0)
            if (diffX < 0) {
              if (e.cancelable) e.preventDefault();
              const translateX = Math.max(diffX, -70);
              touchElement.style.transform = `translateX(${translateX}px)`;
              touchElement.style.transition = 'none';

              if (touchIndicator) {
                const absDiffX = Math.abs(diffX);
                touchIndicator.style.opacity = Math.min(absDiffX / 50, 1);
                touchIndicator.style.transform = `scale(${Math.min(0.5 + (absDiffX / 100), 1)})`;
                touchIndicator.style.left = 'auto';
                touchIndicator.style.right = `${Math.min(-40 + absDiffX * 0.5, 10)}px`;
              }
            }
          } else {
            // Incoming message: swipe right (diffX > 0)
            if (diffX > 0) {
              if (e.cancelable) e.preventDefault();
              const translateX = Math.min(diffX, 70);
              touchElement.style.transform = `translateX(${translateX}px)`;
              touchElement.style.transition = 'none';

              if (touchIndicator) {
                touchIndicator.style.opacity = Math.min(diffX / 50, 1);
                touchIndicator.style.transform = `scale(${Math.min(0.5 + (diffX / 100), 1)})`;
                touchIndicator.style.right = 'auto';
                touchIndicator.style.left = `${Math.min(-40 + diffX * 0.5, 10)}px`;
              }
            }
          }
        }
      };

      this.msgTouchEndListener = (e) => {
        if (!touchStart || !touchElement) return;

        const touch = e.changedTouches[0];
        const diffX = touch.clientX - touchStart.x;
        const isOutgoing = touchElement.classList.contains('message-outgoing');

        let triggerReply = false;
        if (isOutgoing) {
          if (isSwiping && diffX < -50) {
            triggerReply = true;
          }
        } else {
          if (isSwiping && diffX > 50) {
            triggerReply = true;
          }
        }

        if (triggerReply) {
          const messageId = touchElement.dataset.id || touchElement.getAttribute('data-id');
          if (messageId) {
            if (navigator.vibrate) {
              navigator.vibrate(15);
            }
            const msg = this.messages.find(m => String(m.id) === String(messageId));
            if (msg) {
              this.showReplyPreview(msg);
            }
          }
        }

        touchElement.style.transition = 'transform 0.2s ease';
        touchElement.style.transform = '';
        
        if (touchIndicator) {
          touchIndicator.style.transition = 'opacity 0.2s ease, transform 0.2s ease, left 0.2s ease, right 0.2s ease';
          touchIndicator.style.opacity = '0';
          touchIndicator.style.transform = 'scale(0.5)';
          if (isOutgoing) {
            touchIndicator.style.right = '-40px';
          } else {
            touchIndicator.style.left = '-40px';
          }
        }

        touchStart = null;
        touchElement = null;
        touchIndicator = null;
        isSwiping = false;
      };

      msgContainer.addEventListener('touchstart', this.msgTouchStartListener, { passive: true });
      msgContainer.addEventListener('touchmove', this.msgTouchMoveListener, { passive: false });
      msgContainer.addEventListener('touchend', this.msgTouchEndListener, { passive: true });
    }

    // 1. WebSocket: Subscribe topic theo userId và topic thông báo lỗi hệ thống
    const localUserId = localStorage.getItem('chat_user_id');
    const setupWebSocket = (uid) => {
      if (!uid) return;
      socket.connect();
      socket.subscribe(uid);
    };

    if (localUserId) {
      setupWebSocket(localUserId);
    }

    // Gọi tới api profiles/short để lấy thông tin cá nhân của bản thân mình (sử dụng sessionStorage cache)
    const userEmail = localStorage.getItem('chat_user_email') || 'user@example.com';
    const fallbackNickname = userEmail.split('@')[0];

    const updateSidebarProfile = (profile) => {
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
      
      // Attach click listener to avatar to navigate to profile page
      if (avatarEl) {
        avatarEl.style.cursor = 'pointer';
        avatarEl.addEventListener('click', () => {
          // Navigate to profile page using router
          if (this.router) {
            this.router.navigate('profile');
          }
        });
      }
    };

    const cachedShortProfile = sessionStorage.getItem('chat_profile_short');
    if (cachedShortProfile) {
      try {
        const parsedProfile = JSON.parse(cachedShortProfile);
        updateSidebarProfile(parsedProfile);
      } catch (err) {
        console.warn('Failed to parse cached short profile:', err);
        sessionStorage.removeItem('chat_profile_short');
      }
    } else {
      api.get('profiles/short').then(res => {
        if (res && res.success && res.data) {
          const profile = res.data;
          sessionStorage.setItem('chat_profile_short', JSON.stringify(profile));
          updateSidebarProfile(profile);
        }
      }).catch(err => {
        console.warn('Failed to fetch user short profile');
      });
    }

    // Setup socket handler callback
    this.onMessageReceived = (event, destination) => {
      if (event && (event.type === 'ERROR' || event.eventType === 'ERROR')) {
        const errorText = (event.message && typeof event.message === 'object' ? event.message.text : null)
          || event.text
          || (event.data && typeof event.data === 'object' ? event.data.text : null)
          || t('unknown_system_error');
        
        const clientMsgId = event.clientMsgId
          || (event.message && typeof event.message === 'object' ? event.message.clientMsgId : null)
          || (event.data && typeof event.data === 'object' ? event.data.clientMsgId : null);

        if (clientMsgId) {
          // Tìm và cập nhật tin nhắn tương ứng thành trạng thái lỗi
          let found = false;
          const msg = this.messages.find(m => m.clientMsgId && String(m.clientMsgId) === String(clientMsgId));
          if (msg) {
            msg.status = 'failed';
            found = true;
          }

          // Cập nhật trong cache sessionStorage cho tất cả các cuộc hội thoại
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key.startsWith('chat_messages_cache_')) {
              try {
                const cachedMsgs = JSON.parse(sessionStorage.getItem(key));
                if (Array.isArray(cachedMsgs)) {
                  const cachedMsg = cachedMsgs.find(m => m.clientMsgId && String(m.clientMsgId) === String(clientMsgId));
                  if (cachedMsg) {
                    cachedMsg.status = 'failed';
                    sessionStorage.setItem(key, JSON.stringify(cachedMsgs));
                    found = true;
                  }
                }
              } catch (e) {
                console.warn('Error updating cache for error status:', e);
              }
            }
          }

          if (found) {
            this.renderMessages();
          }
        } else {
          // Xóa bỏ tin nhắn đang trong trạng thái đang gửi hiện tại nếu không có clientMsgId cụ thể
          this.messages = this.messages.filter(m => m.status !== 'pending' && m.status !== 'sending');
          if (this.conversationId) {
            sessionStorage.setItem(`chat_messages_cache_${this.conversationId}`, JSON.stringify(this.messages));
          }
          this.renderMessages();
        }

        showDialog({
          title: t('send_message_error_title'),
          message: errorText,
          type: 'error',
          buttons: [{ text: t('close'), type: 'primary', value: true }]
        });
        return;
      }
      handleSocketEvent(this, event);
    };
    socket.addListener(this.onMessageReceived);

    // Setup listener for custom refresh-conversations event
    this.refreshConversationsListener = () => {
      this.renderConversationsList();
    };
    document.addEventListener('refresh-conversations', this.refreshConversationsListener);

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
          statusEl.textContent = t('connected');
          statusEl.style.color = 'var(--success, #10b981)';
        } else {
          statusEl.textContent = t('disconnected');
          statusEl.style.color = '#ef4444';
        }
      }
    };

    // Initialize status text
    updateConnectionStatus(navigator.onLine);

    const clearSessionCaches = () => {
      sessionStorage.removeItem('chat_conversations_cache');
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('chat_messages_cache_')) {
          sessionStorage.removeItem(key);
        }
      }
    };

    socket.onConnectCallback = () => {
      updateConnectionStatus(true);
      OfflineQueueHandler.processOfflineQueue(this);

      if (this.wasDisconnected) {
        clearSessionCaches();
        this.wasDisconnected = false;
      }

      // Refresh conversations list on connect/reconnect
      this.loadConversations(false, null, false, true);
      // Tải lại tin nhắn mới nhất để đồng bộ sau khi kết nối
      if (this.conversationId) {
        this.loadMessages(this.conversationId, false, true);
      }
    };
    socket.onDisconnectCallback = () => {
      updateConnectionStatus(false);
      this.wasDisconnected = true;
    };

    this.syncIntervalId = setInterval(() => OfflineQueueHandler.processOfflineQueue(this), 4000);

    this.handleOnlineStatus = () => {
      updateConnectionStatus(true);
      OfflineQueueHandler.processOfflineQueue(this);

      if (this.wasDisconnected) {
        clearSessionCaches();
        this.wasDisconnected = false;
      }

      // Refresh conversations list on connect/reconnect
      this.loadConversations(false, null, false, true);
      // Tải lại tin nhắn mới nhất để đồng bộ sau khi kết nối lại
      if (this.conversationId) {
        this.loadMessages(this.conversationId, false, true);
      }
    };
    this.handleOfflineStatus = () => {
      updateConnectionStatus(false);
      this.wasDisconnected = true;
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
      .then(({ initForegroundNotificationListener, showNativeNotification }) => {
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

          const title = payload.notification?.title || payload.data?.title || t('new_notification');
          const body = payload.notification?.body || payload.data?.body || t('new_message_alert');
          const conversationId = payload.data?.conversationId || payload.data?.id;
          const messageId = payload.data?.messageId;
          const tag = payload.data?.tag || payload.notification?.tag;

          // Nếu ngoài cuộc trò chuyện đó thì hiển thị thông báo native lên
          if (String(conversationId) !== String(this.conversationId)) {
            showNativeNotification(title, body, conversationId, messageId, tag);
          }
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
    const menuRecordVoice = document.getElementById('menu-record-voice');

    const stageFiles = (files, type) => {
      this.stagedFiles = AttachmentHandler.stageFiles(files, type, this.stagedFiles);
      this.renderStagedFiles();
    };

    if (messageInput) {
      messageInput.addEventListener('paste', (e) => {
        const files = e.clipboardData?.files;
        if (files && files.length > 0) {
          e.preventDefault();
          const images = [];
          const videos = [];
          const others = [];

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
              images.push(file);
            } else if (file.type.startsWith('video/')) {
              videos.push(file);
            } else {
              others.push(file);
            }
          }

          if (images.length > 0) stageFiles(images, 'IMAGE');
          if (videos.length > 0) stageFiles(videos, 'VIDEO');
          if (others.length > 0) stageFiles(others, 'FILE');
        }
      });
    }

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

    const triggerVoiceRecord = async () => {
      const voiceRecordingIndicator = document.getElementById('voice-recording-indicator');
      const voiceDuration = document.getElementById('voice-duration');

      if (!this.isRecording) {
        if (chatExtraActionsMenu) chatExtraActionsMenu.style.display = 'none';
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
    };

    if (btnRecordVoice) {
      btnRecordVoice.addEventListener('click', triggerVoiceRecord);
    }

    if (menuRecordVoice) {
      menuRecordVoice.addEventListener('click', triggerVoiceRecord);
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

  loadConversations(autoSelect = true, initialConversationId = null, nextPage = false, forceRefresh = false) {
    return ConversationHandler.loadConversations(this, autoSelect, initialConversationId, nextPage, forceRefresh);
  },

  renderConversationsList() {
    // Save conversations to cache whenever rendering the list
    sessionStorage.setItem('chat_conversations_cache', JSON.stringify(this.conversations));

    renderConversationsList(
      this.conversations,
      this.conversationId,
      this.getUserNameAndAvatar.bind(this),
      this.selectConversation.bind(this),
      this.muteConversation.bind(this),
      this.deleteConversation.bind(this),
      this.disbandConversation.bind(this)
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

  disbandConversation(conversationId) {
    return ConversationHandler.disbandConversation(this, conversationId);
  },

  updateChatHeader(title, avatarUrl, statusText, conversationId = null, conversations = []) {
    updateChatHeader(title, avatarUrl, statusText, conversationId, conversations);
  },

  renderEmptyChatFrame() {
    renderEmptyChatFrame();
  },

  renderMessages() {
    renderMessages(this.messages, this.conversationId, this.conversations);
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

  loadMessages(conversationId, nextPage = false, forceRefresh = false) {
    return MessageLoader.loadMessages(this, conversationId, nextPage, forceRefresh);
  },

  showReplyPreview(msg) {
    this.replyingToMessage = msg;
    const container = document.getElementById('reply-preview-container');
    if (!container) return;

    const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
    const isSelf = String(msg.senderId) === String(currentUserId);
    
    let senderName = t('user');
    if (isSelf) {
      senderName = t('you');
    } else {
      const convo = this.conversations.find(c => String(c.conversationId) === String(this.conversationId));
      const senderObj = convo?.userConversations?.find(u => String(u.userId) === String(msg.senderId));
      if (senderObj) {
        senderName = senderObj.fullName || senderObj.displayName || senderObj.username || t('member');
      }
    }

    let textSnippet = msg.text || '';
    if (msg.isRevoked) {
      textSnippet = t('revoked_msg');
    } else {
      const type = String(msg.type || 'TEXT').toUpperCase();
      if (type === 'IMAGE') textSnippet = t('snippet_image');
      else if (type === 'VIDEO') textSnippet = t('snippet_video');
      else if (type === 'AUDIO') textSnippet = t('snippet_audio');
      else if (type === 'FILE') textSnippet = t('snippet_file');
    }

    container.innerHTML = `
      <div class="reply-preview-content" style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; border-left: 3px solid var(--accent-color); padding-left: 10px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--accent-color); flex-shrink: 0;">
            <polyline points="9 17 4 12 9 7"></polyline>
            <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
          </svg>
          <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;">
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--accent-color);">${t('replying_to')} ${senderName}</span>
            <span style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${textSnippet}</span>
          </div>
        </div>
        <button id="btn-cancel-reply" class="btn-cancel-reply" style="background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; padding: 0; transition: all 0.2s;" title="${t('cancel_reply')}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;

    container.style.display = 'flex';
    
    const cancelBtn = container.querySelector('#btn-cancel-reply');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.clearReplyState();
      });
    }

    const messageInput = document.getElementById('message-input');
    if (messageInput) {
      messageInput.focus();
    }
  },

  clearReplyState() {
    this.replyingToMessage = null;
    const container = document.getElementById('reply-preview-container');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  },

  async scrollToAndHighlightMessage(targetId) {
    let element = document.getElementById(`msg-${targetId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-flash');
      setTimeout(() => element.classList.remove('highlight-flash'), 2000);
      return;
    }

    if (this.hasMoreMessages && !this.messagesLoading) {
      let searchToast = document.getElementById('reply-search-toast');
      if (!searchToast) {
        searchToast = document.createElement('div');
        searchToast.id = 'reply-search-toast';
        searchToast.style = 'position: absolute; top: 80px; left: 50%; transform: translateX(-50%); background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-full); padding: 6px 16px; font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); z-index: 999; pointer-events: none;';
        searchToast.innerHTML = `<div class="spinner-sm" style="width: 12px; height: 12px; margin: 0;"></div> ${t('searching_older_messages')}`;
        const chatMain = document.querySelector('.chat-main');
        if (chatMain) chatMain.appendChild(searchToast);
      }

      try {
        await this.loadMessages(this.conversationId, true);
        
        element = document.getElementById(`msg-${targetId}`);
        if (element) {
          if (searchToast) searchToast.remove();
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-flash');
          setTimeout(() => element.classList.remove('highlight-flash'), 2000);
        } else {
          setTimeout(() => this.scrollToAndHighlightMessage(targetId), 100);
        }
      } catch (err) {
        console.error('Failed to load messages while searching:', err);
        if (searchToast) searchToast.remove();
      }
    } else {
      const searchToast = document.getElementById('reply-search-toast');
      if (searchToast) searchToast.remove();
      
      const { showDialog } = await import('../../../js/shared/dialog/dialog.js');
      await showDialog({
        title: t('message_not_found_title'),
        message: t('message_not_found_msg'),
        type: 'info'
      });
    }
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
    if (this.refreshConversationsListener) {
      document.removeEventListener('refresh-conversations', this.refreshConversationsListener);
      this.refreshConversationsListener = null;
    }
    
    // Clean up reply listeners
    if (this.replyClickListener) {
      document.removeEventListener('reply-message-click', this.replyClickListener);
      this.replyClickListener = null;
    }
    if (this.replyQuoteClickListener) {
      document.removeEventListener('reply-quote-click', this.replyQuoteClickListener);
      this.replyQuoteClickListener = null;
    }
    
    const msgContainer = document.getElementById('chat-messages-container');
    if (msgContainer) {
      if (this.msgTouchStartListener) {
        msgContainer.removeEventListener('touchstart', this.msgTouchStartListener);
        this.msgTouchStartListener = null;
      }
      if (this.msgTouchMoveListener) {
        msgContainer.removeEventListener('touchmove', this.msgTouchMoveListener);
        this.msgTouchMoveListener = null;
      }
      if (this.msgTouchEndListener) {
        msgContainer.removeEventListener('touchend', this.msgTouchEndListener);
        this.msgTouchEndListener = null;
      }
    }
    this.clearReplyState();

    this.isRecordingCanceled = true;
    VoiceRecorder.stop(this);
    this.hideVoicePreview();

    // Revoke object URLs and clear staged files
    if (this.stagedFiles && this.stagedFiles.length > 0) {
      AttachmentHandler.revokeUrls(this.stagedFiles);
      this.stagedFiles = [];
    }
  },

  onRouteUpdate(queryParams) {
    const newConversationId = queryParams && (queryParams.conversationId || queryParams.id);
    if (newConversationId) {
      if (String(this.conversationId) !== String(newConversationId)) {
        this.selectConversation(newConversationId);
      }
      const dashboard = document.querySelector('.chat-dashboard');
      if (dashboard) {
        dashboard.classList.add('show-chat');
      }
    } else {
      this.conversationId = null;
      const dashboard = document.querySelector('.chat-dashboard');
      if (dashboard) {
        dashboard.classList.remove('show-chat');
      }
      const items = document.querySelectorAll('.conversation-item');
      items.forEach(item => item.classList.remove('active'));
    }
  }
};

export default HomeView;
