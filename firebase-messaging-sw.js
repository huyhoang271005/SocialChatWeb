import { CONFIG } from '/js/core/config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getMessaging, onBackgroundMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-sw.js';

// Ép buộc Service Worker mới kích hoạt ngay lập tức khi phát hiện thay đổi
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Khởi tạo Firebase App
const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const messaging = getMessaging(app);

// Set để lọc trùng tin nhắn dựa trên messageId khi nhận trong background
const processedBackgroundMessageIds = new Set();

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
  const conversationId = dataSource.conversationId || dataSource.id || dataSource.tag || (payload.notification && payload.notification.tag);
  const msgTypeUpper = messageType ? String(messageType).toUpperCase() : '';

  // Lọc trùng tin nhắn
  if (messageId) {
    const msgIdStr = String(messageId);
    if (processedBackgroundMessageIds.has(msgIdStr)) {
      return;
    }
    processedBackgroundMessageIds.add(msgIdStr);
    if (processedBackgroundMessageIds.size > 100) {
      const first = processedBackgroundMessageIds.keys().next().value;
      processedBackgroundMessageIds.delete(first);
    }
  }

  // Lọc trùng tin nhắn từ chính mình gửi (senderId trùng với userId hiện tại của thiết bị)
  const currentUserId = await getCachedUserId();
  if (dataSource.senderId && currentUserId && String(dataSource.senderId) === String(currentUserId)) {
    // Tạo thông báo im lặng rồi đóng ngay để thoả mãn push event của trình duyệt
    const silentTag = `silent-self-${messageId || Date.now()}`;
    self.registration.showNotification('', {
      silent: true,
      body: '',
      tag: silentTag
    }).then(() => {
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((notification) => {
          if (notification.tag === silentTag) {
            notification.close();
          }
        });
      });
    });
    return;
  }

  // Đóng lập tức các thông báo tự động hiển thị bởi trình duyệt/FCM SDK
  // (Nhận diện thông báo tự động: Không có custom data click_action)
  try {
    const activeNotifications = await self.registration.getNotifications();
    activeNotifications.forEach((n) => {
      if (!n.data || !n.data.click_action) {
        n.close();
      }
    });
  } catch (e) {
    console.error('Lỗi đóng thông báo tự động trùng lặp ban đầu:', e);
  }

  const isRevokeEvent = msgTypeUpper === 'REVOKE_MESSAGE' || 
                        (dataSource.body && String(dataSource.body).toUpperCase() === 'REVOKE_MESSAGE');

  // Nếu là sự kiện thu hồi tin nhắn
  if (isRevokeEvent) {
    if (messageId) {
      // 1. Âm thầm xoá thông báo cũ hoặc lọc bỏ tin nhắn bị thu hồi khỏi nhóm thông báo
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((notification) => {
          if (notification.data && Array.isArray(notification.data.messages)) {
            const hasMessage = notification.data.messages.some(m => String(m.messageId) === String(messageId));
            if (hasMessage) {
              const updatedMessages = notification.data.messages.filter(m => String(m.messageId) !== String(messageId));
              notification.close(); // Đóng thông báo hiện tại
              
              if (updatedMessages.length > 0) {
                // Nếu vẫn còn tin nhắn khác trong nhóm, cập nhật thông báo mới (không rung/âm thanh để tránh phiền)
                const count = updatedMessages.length;
                let originalTitle = notification.title;
                const titleMatch = originalTitle.match(/^(.*?)\s*\(\d+\)$/);
                if (titleMatch) {
                  originalTitle = titleMatch[1];
                }
                const finalTitle = count > 1 ? `${originalTitle} (${count})` : originalTitle;
                const finalBody = updatedMessages.slice(-3).map(m => m.body).join('\n');
                
                self.registration.showNotification(finalTitle, {
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
      });

      // 2. Tạo thông báo trống hoàn toàn im lặng (không rung, không đổ chuông) để thoả mãn push event của trình duyệt
      const silentTag = `silent-revoke-${messageId}`;
      self.registration.showNotification('', {
        silent: true,
        body: '',
        tag: silentTag
      }).then(() => {
        // Đóng ngay lập tức để không hiển thị trên màn hình
        self.registration.getNotifications().then((notifications) => {
          notifications.forEach((notification) => {
            if (notification.tag === silentTag) {
              notification.close();
            }
          });
        });
      });
    } else {
      // Nếu không có messageId, vẫn hiển thị thông báo rỗng ẩn để thoả mãn trình duyệt
      const silentTag = `silent-revoke-empty-${Date.now()}`;
      self.registration.showNotification('', {
        silent: true,
        body: '',
        tag: silentTag
      }).then(() => {
        self.registration.getNotifications().then((notifications) => {
          notifications.forEach((notification) => {
            if (notification.tag === silentTag) {
              notification.close();
            }
          });
        });
      });
    }
    return; // Luôn return để tránh trôi xuống dưới gộp nhóm hiển thị thành tin nhắn mới
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
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((notification) => {
          if (notification.tag === silentTag) {
            notification.close();
          }
        });
      });
    });
    return;
  }

  const isVi = navigator.language && navigator.language.startsWith('vi');
  const notificationTitle = dataSource.title || (isVi ? 'Thông báo mới' : 'New Notification');
  // Ưu tiên gom nhóm theo tag từ server trả về, sau đó mới đến conversationId
  const groupTag = dataSource.tag || (payload.notification && payload.notification.tag) || (conversationId ? `convo-${conversationId}` : messageId);
  const clickAction = dataSource.link || `${self.location.origin}/#home?conversationId=${conversationId}`;

  // Lấy danh sách các tin nhắn đã có trong nhóm thông báo này
  let messages = [];
  try {
    // Lấy tất cả thông báo hiện có và tìm kiếm theo tag để tăng độ tương thích trên thiết bị di động
    const activeNotifications = await self.registration.getNotifications();
    const oldNotification = activeNotifications.find(n => n.tag === groupTag && n.data && n.data.messages);
    if (oldNotification) {
      if (oldNotification.data && Array.isArray(oldNotification.data.messages)) {
        messages = [...oldNotification.data.messages];
      }
      // Đóng thông báo cũ để thông báo mới hiện lên dạng pop-up (lướt ra) trên màn hình
      oldNotification.close();
    }
  } catch (e) {
    console.error('Lỗi khi lấy thông báo cũ:', e);
  }

  let displayBody = dataSource.body || (isVi ? 'Bạn có tin nhắn mới.' : 'You have a new message.');
  if (messageType && messageType !== 'TEXT') {
    const type = String(messageType).toUpperCase();
    if (type === 'IMAGE') {
      displayBody = isVi ? '[Hình ảnh]' : '[Image]';
    } else if (type === 'VIDEO') {
      displayBody = isVi ? '[Video]' : '[Video]';
    } else if (type === 'AUDIO') {
      displayBody = isVi ? '[Tin nhắn thoại]' : '[Voice message]';
    } else if (type === 'FILE') {
      displayBody = isVi ? '[Tài liệu]' : '[Document]';
    }
  }

  // Thêm tin nhắn mới vào danh sách nhóm
  messages.push({
    messageId: messageId,
    body: displayBody,
    title: notificationTitle
  });

  const count = messages.length;
  // Tạo tiêu đề kèm số lượng nếu có từ 2 tin nhắn trở lên
  const finalTitle = count > 1 ? `${notificationTitle} (${count})` : notificationTitle;

  // Tạo nội dung hiển thị (tối đa 3 tin nhắn gần nhất)
  let finalBody = displayBody;
  if (count > 1) {
    const recentMessages = messages.slice(-3);
    finalBody = recentMessages.map(m => m.body).join('\n');
  }

  let customIcon = dataSource.icon || (payload.notification && payload.notification.icon) || null;

  // Lọc bỏ các icon mặc định (Unsplash hoặc favicon) để không hiển thị nếu server trả về null hoặc ảnh mặc định
  if (customIcon && (customIcon.includes('1582213782179') || customIcon.includes('1535713875002') || customIcon === '/favicon.ico')) {
    customIcon = null;
  }

  const notificationOptions = {
    body: finalBody,
    badge: '/favicon.ico',
    tag: groupTag,
    data: {
      click_action: clickAction,
      messages: messages
    }
  };

  if (customIcon) {
    notificationOptions.icon = customIcon;
  }

  // Ra lệnh hiển thị thông báo
  await self.registration.showNotification(finalTitle, notificationOptions);

  // Thêm một lượt dọn dẹp sau 150ms để dọn sạch mọi thông báo tự động từ trình duyệt xuất hiện trễ
  setTimeout(async () => {
    try {
      const activeNotifications = await self.registration.getNotifications();
      activeNotifications.forEach((n) => {
        if (!n.data || !n.data.click_action) {
          n.close();
        }
      });
    } catch (e) {
      console.error('Lỗi dọn dẹp thông báo tự động xuất hiện trễ:', e);
    }
  }, 150);
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