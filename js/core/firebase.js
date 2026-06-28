import { CONFIG } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

let app;
let auth;
let provider;

try {
  app = initializeApp(CONFIG.FIREBASE_CONFIG);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
  // Khuyến nghị yêu cầu chọn tài khoản Google mỗi lần nhấp chuột
  provider.setCustomParameters({
    prompt: 'select_account'
  });
} catch (error) {
  console.error('Lỗi khởi tạo Firebase:', error);
}

/**
 * Đăng nhập bằng Google qua Firebase Auth (Popup)
 * @returns {Promise<{firebaseToken: string, user: Object}>}
 */
export async function loginWithGoogle() {
  if (!auth) {
    throw new Error('Firebase Auth chưa được khởi tạo. Vui lòng kiểm tra lại cấu hình.');
  }
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const firebaseToken = await user.getIdToken();
    return {
      firebaseToken,
      user
    };
  } catch (error) {
    console.error('Lỗi đăng nhập Google qua Firebase:', error);
    throw error;
  }
}

/**
 * Lấy FCM Token từ Firebase Cloud Messaging
 * @returns {Promise<string|null>} FCM Token hoặc null nếu lỗi/không hỗ trợ
 */
export async function getFCMToken() {
  try {
    // Chỉ tải module messaging nếu trình duyệt hỗ trợ
    const { getMessaging, getToken, isSupported } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');
    
    const messagingSupported = await isSupported();
    if (!messagingSupported) {
      console.warn('Trình duyệt không hỗ trợ Firebase Messaging (FCM).');
      return null;
    }

    const vapidKey = CONFIG.FIREBASE_CONFIG.vapidKey;
    if (!vapidKey || vapidKey === 'YOUR_FCM_VAPID_KEY') {
      console.warn('FCM VAPID Key chưa được cấu hình. Bỏ qua việc lấy FCM Token.');
      return null;
    }

    // Yêu cầu quyền nhận thông báo
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Quyền thông báo không được chấp nhận. Bỏ qua việc lấy FCM Token.');
      return null;
    }

    // Đăng ký Service Worker với type: 'module' để có thể import trực tiếp CONFIG
    const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', {
      type: 'module'
    });

    try {
      // Ép buộc trình duyệt cập nhật Service Worker mới nhất ngay lập tức
      await registration.update();
    } catch (e) {
      console.warn('Không thể ép buộc cập nhật Service Worker:', e);
    }

    const messaging = getMessaging(app);
    const fcmToken = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey
    });
    return fcmToken;
  } catch (error) {
    console.error('Lỗi trong quá trình lấy FCM Token:', error);
    return null;
  }
}

/**
 * Lắng nghe thông báo khi ứng dụng đang mở (Foreground)
 * @param {Function} onMessageCallback Callback nhận payload khi có thông báo mới
 */
export async function initForegroundNotificationListener(onMessageCallback) {
  try {
    const { getMessaging, onMessage, isSupported } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');
    
    const messagingSupported = await isSupported();
    if (!messagingSupported) {
      console.warn('Trình duyệt không hỗ trợ Firebase Messaging (FCM) để nhận thông báo foreground.');
      return;
    }

    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      if (onMessageCallback) {
        onMessageCallback(payload);
      }
    });
  } catch (error) {
    console.error('Lỗi khi lắng nghe thông báo foreground:', error);
  }
}

/**
 * Lấy Firebase ID Token hiện tại nếu người dùng đang đăng nhập
 * @returns {Promise<string|null>}
 */
export function getCurrentFirebaseToken() {
  return new Promise((resolve) => {
    if (!auth) {
      resolve(null);
      return;
    }
    if (auth.currentUser) {
      auth.currentUser.getIdToken()
        .then(token => resolve(token))
        .catch(() => resolve(null));
      return;
    }
    // Lắng nghe sự thay đổi trạng thái để lấy token ngay khi Firebase Auth load xong
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      if (user) {
        user.getIdToken()
          .then(token => resolve(token))
          .catch(() => resolve(null));
      } else {
        resolve(null);
      }
    });
  });
}

// Set lưu các messageId đã được hiển thị để tránh trùng lặp giữa WebSocket và FCM ở foreground
const processedMessageIds = new Set();

/**
 * Hiển thị thông báo native trên trình duyệt
 * @param {string} title Tiêu đề thông báo
 * @param {string} body Nội dung thông báo
 * @param {string} conversationId ID cuộc trò chuyện để điều hướng khi click
 * @param {string} messageId ID tin nhắn (làm tag để tránh trùng lặp)
 * @param {string} tag Tag tùy chỉnh để gom nhóm
 * @param {string} icon Đường dẫn ảnh đại diện phòng chat/người dùng
 */
export async function showNativeNotification(title, body, conversationId, messageId, tag, icon) {
  if (Notification.permission !== 'granted') {
    return;
  }

  // Chặn hiển thị thông báo trùng lặp cho cùng một messageId ở foreground
  if (messageId) {
    const msgIdStr = String(messageId);
    if (processedMessageIds.has(msgIdStr)) {
      return;
    }
    processedMessageIds.add(msgIdStr);
    if (processedMessageIds.size > 100) {
      const first = processedMessageIds.keys().next().value;
      processedMessageIds.delete(first);
    }
  }

  // Ưu tiên sử dụng tag gom nhóm từ server/FCM, sau đó mới dùng conversationId
  const groupTag = tag || (conversationId ? `convo-${conversationId}` : (messageId || `msg-${Date.now()}`));
  const clickAction = `${window.location.origin}/#home?conversationId=${conversationId}`;

  if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
    try {
      const registration = await navigator.serviceWorker.ready;
      let messages = [];
      try {
        // Lấy tất cả thông báo hiện có và tìm kiếm theo tag để tăng độ tương thích trên thiết bị di động
        const activeNotifications = await registration.getNotifications();
        const oldNotification = activeNotifications.find(n => n.tag === groupTag);
        if (oldNotification) {
          if (oldNotification.data && Array.isArray(oldNotification.data.messages)) {
            messages = [...oldNotification.data.messages];
          }
          // Đóng thông báo cũ để thông báo mới lướt ra (pop up) trên màn hình
          oldNotification.close();
        }
      } catch (e) {
        console.error('Lỗi khi lấy thông báo cũ (foreground):', e);
      }

      // Thêm tin nhắn mới vào danh sách nhóm
      messages.push({
        messageId: messageId,
        body: body,
        title: title
      });

      const count = messages.length;
      // Tạo tiêu đề kèm số lượng nếu có từ 2 tin nhắn trở lên
      const finalTitle = count > 1 ? `${title} (${count})` : title;

      // Tạo nội dung hiển thị (tối đa 3 tin nhắn gần nhất)
      let finalBody = body;
      if (count > 1) {
        const recentMessages = messages.slice(-3);
        finalBody = recentMessages.map(m => m.body).join('\n');
      }

      const options = {
        body: finalBody,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: groupTag,
        data: {
          click_action: clickAction,
          messages: messages
        }
      };

      registration.showNotification(finalTitle, options);
    } catch (err) {
      console.error('Lỗi khi hiển thị thông báo qua Service Worker:', err);
    }
  } else {
    // Fallback khi không hỗ trợ service worker
    const options = {
      body: body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: groupTag,
      data: {
        click_action: clickAction
      }
    };
    const notification = new Notification(title, options);
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      window.location.hash = `#home?conversationId=${conversationId}`;
    };
  }
}

/**
 * Thu hồi thông báo native trên trình duyệt khi tin nhắn bị xoá/thu hồi ở foreground
 * @param {string} messageId ID tin nhắn bị thu hồi
 */
export async function revokeNativeNotification(messageId) {
  if (!messageId) return;
  if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications();
      notifications.forEach((notification) => {
        if (notification.data && Array.isArray(notification.data.messages)) {
          const hasMessage = notification.data.messages.some(m => String(m.messageId) === String(messageId));
          if (hasMessage) {
            const updatedMessages = notification.data.messages.filter(m => String(m.messageId) !== String(messageId));
            notification.close(); // Đóng thông báo hiện tại
            
            if (updatedMessages.length > 0) {
              const count = updatedMessages.length;
              let originalTitle = notification.title;
              const titleMatch = originalTitle.match(/^(.*?)\s*\(\d+\)$/);
              if (titleMatch) {
                originalTitle = titleMatch[1];
              }
              const finalTitle = count > 1 ? `${originalTitle} (${count})` : originalTitle;
              const finalBody = updatedMessages.slice(-3).map(m => m.body).join('\n');
              
              registration.showNotification(finalTitle, {
                body: finalBody,
                icon: notification.icon,
                badge: notification.badge,
                tag: notification.tag,
                silent: true,
                data: {
                  ...notification.data,
                  messages: updatedMessages
                }
              });
            }
          }
        } else if (notification.tag === messageId) {
          notification.close();
        }
      });
    } catch (err) {
      console.error('Lỗi khi thu hồi thông báo qua Service Worker (foreground):', err);
    }
  }
}

/**
 * Đồng bộ userId hiện tại vào Cache Storage của Service Worker để lọc trùng tin nhắn từ chính mình gửi
 * @param {string|number|null} userId ID của người dùng đăng nhập hiện tại
 */
export async function syncUserIdToServiceWorker(userId) {
  if ('caches' in window) {
    try {
      const cache = await caches.open('user-metadata');
      if (userId) {
        await cache.put('/user-id', new Response(String(userId)));
      } else {
        await cache.delete('/user-id');
      }
    } catch (e) {
      console.warn('Không thể đồng bộ userId với Service Worker:', e);
    }
  }
}

/**
 * Đồng bộ danh sách cuộc trò chuyện vào Cache Storage của Service Worker để lấy ảnh đại diện
 * @param {Array|null} conversations Danh sách các cuộc trò chuyện hiện tại
 */
export async function syncConversationsToServiceWorker(conversations) {
  if ('caches' in window) {
    try {
      const cache = await caches.open('chat-metadata');
      if (conversations) {
        await cache.put('/conversations', new Response(JSON.stringify(conversations)));
      } else {
        await cache.delete('/conversations');
      }
    } catch (e) {
      console.warn('Không thể đồng bộ conversations với Service Worker:', e);
    }
  }
}
