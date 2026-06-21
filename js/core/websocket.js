import { CONFIG } from './config.js';
import { handleTokenRefresh } from './api.js';
import { Client } from 'https://esm.sh/@stomp/stompjs';
import SockJS from 'https://esm.sh/sockjs-client';

class WebSocketManager {
  constructor() {
    this.client = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 3000;
    this.listeners = new Set();
    this.isConnecting = false;
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

    // Tránh kết nối trùng lặp
    if (this.isConnecting || (this.client && this.client.connected)) {
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

    // Lấy token mới nhất trước mỗi lượt kết nối lại
    this.client.beforeConnect = async () => {
      let freshToken = sessionStorage.getItem('chat_access_token');
      if (freshToken === 'null' || freshToken === 'undefined') {
        freshToken = null;
      }

      if (freshToken) {
        this.client.connectHeaders = {
          Authorization: `Bearer ${freshToken}`
        };
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
        this.subscribe(id);
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

      // Xử lý hết hạn hoặc lỗi token
      const errorMsg = frame.headers['message'];
      const errorBody = frame.body;
      const isTokenExpiredOrInvalid =
        errorMsg === 'UNAUTHORIZED:TOKEN_EXPIRED' || errorMsg === 'UNAUTHORIZED:TOKEN_INVALID' ||
        errorBody === 'UNAUTHORIZED:TOKEN_EXPIRED' || errorBody === 'UNAUTHORIZED:TOKEN_INVALID';

      if (isTokenExpiredOrInvalid) {
        await this.handleTokenExpired();
      }
    };

    this.client.onWebSocketClose = () => {
      this.isConnecting = false;
      this.subscriptionsMap.clear();
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
    this.disconnect();
    try {
      await handleTokenRefresh();
      await this.connect();
    } catch (error) {
      sessionStorage.clear();
      localStorage.clear();
      window.location.hash = '#login';
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
   * @param {string} type 'text'|'image'|'file'|'revoked'
   * @param fileId
   * @param replyMessageId
   */
  send(conversationId, text, type = 'TEXT', fileId = null, replyMessageId = null) {
    const payload = {
      conversationId,
      text,
      type
    };
    if (fileId) {
      payload.fileId = fileId;
    }
    if (replyMessageId) {
      payload.replyMessageId = replyMessageId;
    }

    if (this.client && this.client.connected) {
      this.client.publish({
        destination: '/app/chat.send', // Thay đổi path này theo cấu hình backend của bạn
        body: JSON.stringify(payload)
      });
    }
  }

  sendTyping(conversationId) {
    if (this.client && this.client.connected) {
      this.client.publish({
        destination: '/app/chat.typing',
        body: JSON.stringify({ conversationId })
      });
    }
  }

  sendUntyping(conversationId) {
    if (this.client && this.client.connected) {
      this.client.publish({
        destination: '/app/chat.untyping',
        body: JSON.stringify({ conversationId })
      });
    }
  }

  sendSeen(conversationId, messageId, senderId) {
    if (this.client && this.client.connected) {
      const payload = {
        conversationId,
        messageId,
        senderId
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
        conversationId,
        messageId
      };
      this.client.publish({
        destination: '/app/chat.revoke',
        body: JSON.stringify(payload)
      });
    }
  }



  /**
   * Đăng ký nhận tin nhắn của một cuộc hội thoại hoặc topic tùy chỉnh
   * @param {string} id 
   * @param {string} topicName 
   */
  subscribe(id) {
    const topicName = "users";
    const subscriptionKey = `${topicName}:${id}`;
    if (this.subscriptionsMap.has(subscriptionKey)) {

      return;
    }

    this.activeSubscriptions.add(subscriptionKey);

    // Đường dẫn subscribe (destination) tùy thuộc cấu hình Spring Boot
    const destination = `/topic/${topicName}.${id}`;

    if (this.client && this.client.connected) {
      const stompSubscription = this.client.subscribe(destination, async (message) => {

        if (message.body === 'UNAUTHORIZED:TOKEN_EXPIRED' || message.body === 'UNAUTHORIZED:TOKEN_INVALID') {
          await this.handleTokenExpired();
          return;
        }

        let data;
        try {
          data = JSON.parse(message.body);
        } catch (e) {
          data = message.body;
        }

        if (data && (
          data.error === 'UNAUTHORIZED:TOKEN_EXPIRED' || data.error === 'UNAUTHORIZED:TOKEN_INVALID' ||
          data.message === 'UNAUTHORIZATION:TOKEN_EXPIRED' || data.message === 'UNAUTHORIZATION:TOKEN_INVALID' ||
          data.message === 'UNAUTHORIZED:TOKEN_EXPIRED' || data.message === 'UNAUTHORIZED:TOKEN_INVALID'
        )) {
          await this.handleTokenExpired();
          return;
        }

        this.listeners.forEach(callback => callback(data));
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
