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

/**
 * Hiển thị thông báo native trên trình duyệt
 * @param {string} title Tiêu đề thông báo
 * @param {string} body Nội dung thông báo
 * @param {string} conversationId ID cuộc trò chuyện để điều hướng khi click
 * @param {string} messageId ID tin nhắn (làm tag để tránh trùng lặp)
 */
export function showNativeNotification(title, body, conversationId, messageId) {
  if (Notification.permission !== 'granted') {
    return;
  }

  const tag = messageId || `msg-${Date.now()}`;
  const options = {
    body: body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: tag,
    data: {
      click_action: `${window.location.origin}/#home?conversationId=${conversationId}`
    }
  };

  if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, options);
    });
  } else {
    const notification = new Notification(title, options);
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      window.location.hash = `#home?conversationId=${conversationId}`;
    };
  }
}
