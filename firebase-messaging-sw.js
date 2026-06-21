import { CONFIG } from '/js/core/config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getMessaging, onBackgroundMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-sw.js';

// Khởi tạo Firebase App
const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const messaging = getMessaging(app);

// Kiểm tra xem cuộc trò chuyện có đang mở ở client nào không
async function isConversationActive(conversationId) {
  if (!conversationId) return false;
  try {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      try {
        const url = new URL(client.url);
        const hash = url.hash; // Ví dụ: "#home?conversationId=47"
        if (hash) {
          const queryPart = hash.split('?')[1];
          if (queryPart) {
            const params = new URLSearchParams(queryPart);
            const clientConvoId = params.get('conversationId');
            if (String(clientConvoId) === String(conversationId)) {
              return true;
            }
          }
        }
      } catch (e) {
        console.error('Lỗi phân tích URL client:', e);
      }
    }
  } catch (e) {
    console.error('Lỗi kiểm tra cuộc trò chuyện đang hoạt động:', e);
  }
  return false;
}

// Xử lý thông báo đẩy khi ứng dụng chạy ẩn hoặc đã đóng
onBackgroundMessage(messaging, async (payload) => {
  // 2. GIẢI PHÁP AN TOÀN: Kiểm tra xem data nằm ở bọc nào để bốc cho trúng
  // Vì dùng putData nên ta sẽ ưu tiên tìm trong payload.data trước, nếu không có thì tìm ở payload
  const dataSource = payload.data ? payload.data : payload;

  const messageId = dataSource.messageId;
  const messageType = dataSource.messageType;
  const conversationId = dataSource.conversationId || dataSource.id;

  // Nếu là sự kiện thu hồi tin nhắn
  if (messageType === 'REVOKE_MESSAGE' && messageId) {
    // 1. Âm thầm xoá thông báo cũ có messageId tương ứng
    self.registration.getNotifications({ tag: messageId }).then((notifications) => {
      notifications.forEach((notification) => {
        notification.close();
      });
    });

    // 2. Tạo thông báo trống hoàn toàn im lặng (không rung, không đổ chuông) để thoả mãn push event của trình duyệt
    const silentTag = `silent-revoke-${messageId}`;
    self.registration.showNotification('', {
      silent: true,
      body: '',
      tag: silentTag
    }).then(() => {
      // Đóng ngay lập tức để không hiển thị trên màn hình
      self.registration.getNotifications({ tag: silentTag }).then((notifications) => {
        notifications.forEach((notification) => {
          notification.close();
        });
      });
    });
    return; // Dừng lại, không hiển thị thêm thông báo nào khác
  }

  // Kiểm tra xem cuộc trò chuyện có đang hoạt động hay không
  const isConvoActive = await isConversationActive(conversationId);
  if (isConvoActive) {
    // Nếu người dùng đang ở trong cuộc trò chuyện đó, không hiển thị thông báo (tạo thông báo im lặng rồi đóng ngay)
    const silentTag = `silent-msg-${messageId || Date.now()}`;
    self.registration.showNotification('', {
      silent: true,
      body: '',
      tag: silentTag
    }).then(() => {
      self.registration.getNotifications({ tag: silentTag }).then((notifications) => {
        notifications.forEach((notification) => {
          notification.close();
        });
      });
    });
    return;
  }

  const notificationTitle = dataSource.title || 'Thông báo mới';
  const notificationOptions = {
    body: dataSource.body || 'Bạn có tin nhắn mới.',
    icon: dataSource.icon || '/favicon.ico', // Bốc trường "icon" chính là avatar phòng chat từ Java truyền sang
    badge: '/favicon.ico',
    tag: messageId, // Đặt tag là messageId để định danh phục vụ thu hồi
    data: {
      // Bốc trường "link" điều hướng từ Java
      click_action: dataSource.link || `${self.location.origin}/#home?conversationId=${conversationId}`
    }
  };

  // Ra lệnh hiển thị thông báo
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Giữ nguyên đoạn sự kiện click cũ của bạn
// Giữ nguyên đoạn sự kiện click cũ của bạn
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.click_action;
  if (targetUrl) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  }
});

// Cung cấp các sự kiện lifecycle của Service Worker phục vụ PWA Installable
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through request trực tiếp từ mạng để bảo đảm không bị cache tĩnh làm lỗi SPA routing/API
  event.respondWith(
    fetch(event.request).catch(async () => {
      // Trường hợp mất mạng (offline) thì thử lấy từ cache (nếu có)
      const cache = await caches.open('chatapp-offline');
      return (await cache.match(event.request)) || Response.error();
    })
  );
});