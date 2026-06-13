import { CONFIG } from './js/core/config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getMessaging, onBackgroundMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-sw.js';

// Khởi tạo Firebase App
const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const messaging = getMessaging(app);

// Xử lý thông báo đẩy khi ứng dụng chạy ẩn hoặc đã đóng
onBackgroundMessage(messaging, (payload) => {
  // 1. In hẳn cục này ra để bạn nhìn trong Tab Console của Service Worker
  console.log("Cấu trúc Payload thực tế nhận được:", payload);

  // 2. GIẢI PHÁP AN TOÀN: Kiểm tra xem data nằm ở bọc nào để bốc cho trúng
  // Vì dùng putData nên ta sẽ ưu tiên tìm trong payload.data trước, nếu không có thì tìm ở payload
  const dataSource = payload.data ? payload.data : payload;

  const notificationTitle = dataSource.title || 'Thông báo mới';
  const notificationOptions = {
    body: dataSource.body || 'Bạn có tin nhắn mới.',
    icon: dataSource.icon || '/favicon.ico', // Bốc trường "icon" chính là avatar phòng chat từ Java truyền sang
    badge: '/favicon.ico',
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