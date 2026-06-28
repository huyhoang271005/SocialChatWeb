import { CONFIG } from './config.js';
import { handleTokenRefresh } from './api.js';
import { Client } from 'https://esm.sh/@stomp/stompjs';
import SockJS from 'https://esm.sh/sockjs-client';

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class WebSocketManager {
  constructor() {
    this.client = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 3000;
    this.listeners = new Set();
    this.isConnecting = false;
    this.isRefreshingToken = false;
    this.url = null;
    this.activeSubscriptions = new Set(); // Lưu danh sách conversationId dạng chuỗi
    this.subscriptionsMap = new Map(); // Lưu đối tượng subscription của STOMP: conversationId -> STOMP subscription
    this.onConnectCallback = null;
    this.onDisconnectCallback = null;
  }

  // Tương thích ngược với code cũ kiểm tra socket.ws.readyState trong home.js
  get ws() {
    if (this.client && this.client.connected) {
      return { readyState: WebSocket.OPEN };
    }
    return null;
  }

  /**
   * Khởi tạo kết nối STOMP qua SockJS
   */
  async connect() {
    // Không kết nối nếu đang ở các trang auth công khai
    const hash = window.location.hash.substring(1) || '';
    const routeName = hash.split('?')[0];
    const publicRoutes = ['login', 'register', 'verify', 'reset-password'];
    if (publicRoutes.includes(routeName)) {
      return;
    }

    // Tránh kết nối khi đang refresh token hoặc đang kết nối trùng lặp
    if (this.isRefreshingToken || this.isConnecting || (this.client && this.client.connected)) {
      return;
    }

    this.isConnecting = true;

    // Nếu đã tồn tại client cũ, dọn dẹp trước khi tạo mới
    if (this.client) {
      try {
        this.client.deactivate();
      } catch (e) {
      }
      this.client = null;
    }

    let token = sessionStorage.getItem('chat_access_token');
    if (token === 'null' || token === 'undefined') {
      token = null;
    }

    // Không đổi http sang ws, sử dụng SockJS
    const baseUrl = CONFIG.API_BASE_URL;
    this.url = baseUrl.endsWith('/ws') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/ws`;

    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    this.client = new Client({
      webSocketFactory: () => new SockJS(this.url),
      connectHeaders: headers,
      reconnectDelay: this.reconnectInterval,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    // Helper đợi refresh token hoàn tất
    const waitForTokenRefresh = () => {
      return new Promise((resolve) => {
        const check = () => {
          if (!this.isRefreshingToken) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    };

    // Lấy token mới nhất trước mỗi lượt kết nối lại
    this.client.beforeConnect = async () => {
      if (this.isRefreshingToken) {
        console.log('WebSocket beforeConnect: Đang chờ refresh token hoàn tất...');
        await waitForTokenRefresh();
      }

      let freshToken = sessionStorage.getItem('chat_access_token');
      if (freshToken === 'null' || freshToken === 'undefined') {
        freshToken = null;
      }

      if (freshToken) {
        this.client.connectHeaders = {
          Authorization: `Bearer ${freshToken}`
        };
        console.log('WebSocket beforeConnect: Đã cập nhật token mới vào headers kết nối.');
      } else {
        this.client.connectHeaders = {};
      }
    };

    this.client.onConnect = (frame) => {
      this.reconnectAttempts = 0;
      this.isConnecting = false;

      // Clear old subscription cache before resubscribing on the new connection
      this.subscriptionsMap.clear();

      // Đăng ký lại các topic đã subscribe trước đó khi kết nối lại
      const subscriptionsToRestore = Array.from(this.activeSubscriptions);
      this.activeSubscriptions.clear(); // Xóa tạm thời để gọi lại subscribe() không bị trùng lặp

      subscriptionsToRestore.forEach(subKey => {
        const [topicName, id] = subKey.split(':');
        this.subscribe(id || '', topicName);
      });

      if (this.onConnectCallback) {
        try {
          this.onConnectCallback();
        } catch (e) {
          console.warn('Error in websocket onConnectCallback:', e);
        }
      }
    };

    this.client.onStompError = async (frame) => {
      const errorMsg = frame.headers['message'] || '';
      const errorBody = frame.body || '';
      console.warn('STOMP error frame received:', errorMsg, errorBody);
      const isTokenExpiredOrInvalid =
        (typeof errorMsg === 'string' && errorMsg.toUpperCase().includes('UNAUTHORIZED')) ||
        (typeof errorBody === 'string' && errorBody.toUpperCase().includes('UNAUTHORIZED'));

      if (isTokenExpiredOrInvalid) {
        await this.handleTokenExpired();
      }
    };

    this.client.onWebSocketError = async (evt) => {
      console.warn('STOMP WebSocket error observed:', evt);
      const errMsg = (evt && evt.message) || '';
      if (typeof errMsg === 'string' && errMsg.toUpperCase().includes('UNAUTHORIZED')) {
        await this.handleTokenExpired();
      }
    };

    this.client.onWebSocketClose = async (evt) => {
      this.isConnecting = false;
      this.subscriptionsMap.clear();

      const reason = (evt && evt.reason) || '';
      const errMsg = (evt && evt.message) || '';
      const isUnauthorized =
        (typeof reason === 'string' && reason.toUpperCase().includes('UNAUTHORIZED')) ||
        (typeof errMsg === 'string' && errMsg.toUpperCase().includes('UNAUTHORIZED')) ||
        evt?.code === 4001 || evt?.code === 4401;

      if (isUnauthorized) {
        await this.handleTokenExpired();
      }

      if (this.onDisconnectCallback) {
        try {
          this.onDisconnectCallback();
        } catch (e) {
          console.warn('Error in websocket onDisconnectCallback:', e);
        }
      }
    };

    this.client.activate();
  }

  /**
   * Xử lý refresh token khi phát hiện token hết hạn và kết nối lại
   */
  async handleTokenExpired() {
    if (this.isRefreshingToken) {
      return;
    }
    this.isRefreshingToken = true;
    console.warn('WebSocket phát hiện lỗi UNAUTHORIZED. Đang ngắt kết nối cũ và chuẩn bị refresh token...');
    this.disconnect();
    try {
      const res = await handleTokenRefresh();
      if (res && res.success) {
        console.log('Refresh token thành công. Đang kết nối lại WebSocket...');
        await this.connect();
      } else {
        console.warn('Refresh token thất bại, huỷ kết nối WebSocket và yêu cầu đăng nhập lại.');
        sessionStorage.clear();
        localStorage.clear();
        window.location.hash = '#login';
      }
    } catch (error) {
      console.error('Lỗi khi tiến hành refresh token từ WebSocket:', error);
      sessionStorage.clear();
      localStorage.clear();
      window.location.hash = '#login';
    } finally {
      this.isRefreshingToken = false;
    }
  }

  /**
   * Đóng kết nối STOMP một cách chủ động
   */
  disconnect() {
    if (this.client) {
      this.client.deactivate();
      this.client = null;
      this.subscriptionsMap.clear();
    }
  }

  /**
   * Gửi tin nhắn chat chuẩn lên STOMP broker
   * @param {string} conversationId
   * @param {string} text
   * @param {string} type
   * @param {string} fileId
   * @param {string} replyMessageId
   */
  send(conversationId, text, type = 'TEXT', fileId = null, replyMessageId = null) {
    const clientMsgId = generateUUID();
    const payload = {
      data: {
        conversationId,
        text,
        type
      },
      clientMsgId
    };
    if (fileId) {
      payload.data.fileId = fileId;
    }
    if (replyMessageId) {
      payload.data.replyMessageId = replyMessageId;
    }

    if (this.client && this.client.connected) {
      this.client.publish({
        destination: '/app/chat.send', // Thay đổi path này theo cấu hình backend của bạn
        body: JSON.stringify(payload)
      });
    }
    return clientMsgId;
  }

  sendTyping(conversationId) {
    if (this.client && this.client.connected) {
      this.client.publish({
        destination: '/app/chat.typing',
        body: JSON.stringify({
          data: { conversationId },
          clientMsgId: generateUUID()
        })
      });
    }
  }

  sendUntyping(conversationId) {
    if (this.client && this.client.connected) {
      this.client.publish({
        destination: '/app/chat.untyping',
        body: JSON.stringify({
          data: { conversationId },
          clientMsgId: generateUUID()
        })
      });
    }
  }

  sendSeen(conversationId, messageId, senderId) {
    if (this.client && this.client.connected) {
      const payload = {
        data: {
          conversationId,
          messageId,
          senderId
        },
        clientMsgId: generateUUID()
      };
      this.client.publish({
        destination: '/app/chat.seen',
        body: JSON.stringify(payload)
      });
    }
  }

  sendRevoke(conversationId, messageId) {
    if (this.client && this.client.connected) {
      const payload = {
        data: {
          conversationId,
          messageId
        },
        clientMsgId: generateUUID()
      };
      this.client.publish({
        destination: '/app/chat.revoke',
        body: JSON.stringify(payload)
      });
    }
  }

  sendReaction(messageId, reactionType) {
    if (this.client && this.client.connected) {
      const payload = {
        data: {
          messageId,
          reactionType,
          ReactionType: reactionType
        },
        clientMsgId: generateUUID()
      };
      this.client.publish({
        destination: '/app/chat.reaction',
        body: JSON.stringify(payload)
      });
    }
  }

  sendUnreaction(messageId) {
    if (this.client && this.client.connected) {
      const payload = {
        data: {
          messageId
        },
        clientMsgId: generateUUID()
      };
      this.client.publish({
        destination: '/app/chat.unreaction',
        body: JSON.stringify(payload)
      });
    }
  }



  /**
   * Đăng ký nhận tin nhắn của một cuộc hội thoại hoặc topic tùy chỉnh
   * @param {string} id 
   * @param {string} topicName 
   */
  subscribe(id, topicName = 'users') {
    const subscriptionKey = `${topicName}:${id}`;
    if (this.subscriptionsMap.has(subscriptionKey)) {
      return;
    }

    this.activeSubscriptions.add(subscriptionKey);

    // Đường dẫn subscribe (destination) tùy thuộc cấu hình Spring Boot
    let destination;
    if (topicName.startsWith('/') || topicName.includes('/')) {
      destination = topicName.startsWith('/') ? topicName : `/${topicName}`;
    } else {
      destination = `/topic/${topicName}.${id}`;
    }

    if (this.client && this.client.connected) {
      const stompSubscription = this.client.subscribe(destination, async (message) => {
        const bodyStr = typeof message.body === 'string' ? message.body : '';
        if (bodyStr.includes('UNAUTHORIZED')) {
          await this.handleTokenExpired();
          return;
        }

        let data;
        try {
          data = JSON.parse(message.body);
        } catch (e) {
          data = message.body;
        }

        if (data) {
          const errMsg = data.error || data.message || '';
          if (typeof errMsg === 'string' && (errMsg.includes('UNAUTHORIZED') || errMsg.includes('UNAUTHORIZATION'))) {
            await this.handleTokenExpired();
            return;
          }
        }

        this.listeners.forEach(callback => callback(data, destination));
      });

      this.subscriptionsMap.set(subscriptionKey, stompSubscription);
    } else {
    }
  }

  /**
   * Hủy đăng ký nhận tin nhắn
   * @param {string} id 
   * @param {string} topicName 
   */
  unsubscribe(id, topicName = 'conversation') {
    const subscriptionKey = `${topicName}:${id}`;
    this.activeSubscriptions.delete(subscriptionKey);

    const stompSubscription = this.subscriptionsMap.get(subscriptionKey);
    if (stompSubscription) {
      stompSubscription.unsubscribe();
      this.subscriptionsMap.delete(subscriptionKey);
    }
  }

  /**
   * Thêm bộ lắng nghe tin nhắn mới nhận được
   * @param {Function} callback 
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Xóa bộ lắng nghe tin nhắn
   * @param {Function} callback 
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }
}

export const socket = new WebSocketManager();

// Tự động kết nối lại khi thiết bị online trở lại
window.addEventListener('online', async () => {
  await socket.connect();
});
