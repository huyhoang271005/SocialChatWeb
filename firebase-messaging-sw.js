import { CONFIG } from '/js/core/config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getMessaging, onBackgroundMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-sw.js';

// Khởi tạo Firebase App
const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const messaging = getMessaging(app);

// Xử lý thông báo đẩy khi ứng dụng chạy ẩn hoặc đã đóng
onBackgroundMessage(messaging, (payload) => {
  // 2. GIẢI PHÁP AN TOÀN: Kiểm tra xem data nằm ở bọc nào để bốc cho trúng
  // Vì dùng putData nên ta sẽ ưu tiên tìm trong payload.data trước, nếu không có thì tìm ở payload
  const dataSource = payload.data ? payload.data : payload;

  const messageId = dataSource.messageId;
  const messageType = dataSource.messageType;

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

  const notificationTitle = dataSource.title || 'Thông báo mới';
  const notificationOptions = {
    body: dataSource.body || 'Bạn có tin nhắn mới.',
    icon: dataSource.icon || '/favicon.ico', // Bốc trường "icon" chính là avatar phòng chat từ Java truyền sang
    badge: '/favicon.ico',
    tag: messageId, // Đặt tag là messageId để định danh phục vụ thu hồi
    data: {
      // Bốc trường "link" điều hướng từ Java
      click_action: dataSource.link
    }
  };

  // Ra lệnh hiển thị thông báo
  self.registration.showNotification(notificationTitle, notificationOptions);
});

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