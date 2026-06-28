import { CONFIG } from '/js/core/config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getMessaging, onBackgroundMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-sw.js';

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

// Lấy userId hiện tại được đồng bộ từ client qua Cache Storage
async function getCachedUserId() {
  try {
    const cache = await caches.open('user-metadata');
    const response = await cache.match('/user-id');
    if (response) {
      return await response.text();
    }
  } catch (e) {
    console.error('Lỗi khi lấy userId từ cache:', e);
  }
  return null;
}

// Lấy danh sách cuộc trò chuyện được đồng bộ từ client qua Cache Storage
async function getCachedConversations() {
  try {
    const cache = await caches.open('chat-metadata');
    const response = await cache.match('/conversations');
    if (response) {
      const text = await response.text();
      return JSON.parse(text);
    }
  } catch (e) {
    console.error('Lỗi khi lấy danh sách cuộc trò chuyện từ cache:', e);
  }
  return [];
}

// Hàm chuyển đổi Blob thành Data URL (Base64)
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Tải một ảnh thành ImageBitmap, xử lý lỗi và CORS
async function loadImage(url) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch (e) {
    try {
      const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
      const response = await fetch(defaultUserAvatar, { mode: 'cors' });
      const blob = await response.blob();
      return await createImageBitmap(blob);
    } catch (err) {
      return null;
    }
  }
}

// Vẽ ảnh gộp (composite avatar) sử dụng OffscreenCanvas
async function generateCompositeAvatar(avatarUrls) {
  if (!avatarUrls || avatarUrls.length === 0) return null;
  
  const canvasSize = 120; // Kích thước icon chuẩn cho push notification
  const canvas = new OffscreenCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext('2d');
  
  // Tải song song tất cả các ảnh đại diện thành ImageBitmap
  const imagePromises = avatarUrls.slice(0, 4).map(url => loadImage(url));
  const images = (await Promise.all(imagePromises)).filter(img => img !== null);
  
  if (images.length === 0) return null;
  
  // Xóa nền
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  
  // Bo tròn khung viền Canvas để hiển thị dạng hình tròn đẹp mắt
  ctx.save();
  ctx.beginPath();
  ctx.arc(canvasSize / 2, canvasSize / 2, canvasSize / 2, 0, Math.PI * 2);
  ctx.clip();
  
  const count = images.length;
  
  if (count === 1) {
    // 1 ảnh: Vẽ toàn bộ canvas
    ctx.drawImage(images[0], 0, 0, canvasSize, canvasSize);
  } else if (count === 2) {
    // 2 ảnh: Chia đôi dọc (Trái - Phải)
    const w = canvasSize / 2;
    // Ảnh 1 (trái)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w - 1, canvasSize);
    ctx.clip();
    ctx.drawImage(images[0], -w/2, 0, canvasSize, canvasSize);
    ctx.restore();
    
    // Ảnh 2 (phải)
    ctx.save();
    ctx.beginPath();
    ctx.rect(w + 1, 0, w, canvasSize);
    ctx.clip();
    ctx.drawImage(images[1], w - w/2, 0, canvasSize, canvasSize);
    ctx.restore();
  } else if (count === 3) {
    // 3 ảnh: Trái chiếm 1/2 dọc. Phải chia 2 ngang (Trên - Dưới)
    const w = canvasSize / 2;
    const h = canvasSize / 2;
    
    // Ảnh 1 (trái)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w - 1, canvasSize);
    ctx.clip();
    ctx.drawImage(images[0], -w/2, 0, canvasSize, canvasSize);
    ctx.restore();
    
    // Ảnh 2 (trên phải)
    ctx.save();
    ctx.beginPath();
    ctx.rect(w + 1, 0, w, h - 1);
    ctx.clip();
    ctx.drawImage(images[1], w, 0, w, h);
    ctx.restore();
    
    // Ảnh 3 (dưới phải)
    ctx.save();
    ctx.beginPath();
    ctx.rect(w + 1, h + 1, w, h);
    ctx.clip();
    ctx.drawImage(images[2], w, h, w, h);
    ctx.restore();
  } else {
    // 4 ảnh trở lên: Chia làm 4 góc 2x2
    const w = canvasSize / 2;
    const h = canvasSize / 2;
    
    // Top Left
    ctx.drawImage(images[0], 0, 0, w - 1, h - 1);
    // Top Right
    ctx.drawImage(images[1], w + 1, 0, w, h - 1);
    // Bottom Left
    ctx.drawImage(images[2], 0, h + 1, w - 1, h);
    // Bottom Right
    ctx.drawImage(images[3], w + 1, h + 1, w, h);
  }
  
  ctx.restore();
  
  try {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return await blobToDataURL(blob);
  } catch (e) {
    console.error('Lỗi khi convert canvas thành blob/dataUrl:', e);
    return null;
  }
}

// Xử lý thông báo đẩy khi ứng dụng chạy ẩn hoặc đã đóng
onBackgroundMessage(messaging, async (payload) => {
  // 2. GIẢI PHÁP AN TOÀN: Kiểm tra xem data nằm ở bọc nào để bốc cho trúng
  // Vì dùng putData nên ta sẽ ưu tiên tìm trong payload.data trước, nếu không có thì tìm ở payload
  const dataSource = payload.data ? payload.data : payload;

  const messageId = dataSource.messageId;
  const messageType = dataSource.messageType;
  const conversationId = dataSource.conversationId || dataSource.id;
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

  let customIcon = dataSource.icon || (payload.notification && payload.notification.icon);

  const isDefaultIcon = !customIcon || 
                        customIcon === '/favicon.ico' || 
                        customIcon.includes('1582213782179') || 
                        customIcon.includes('1535713875002');

  if (isDefaultIcon) {
    try {
      const conversations = await getCachedConversations();
      const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
      if (convo) {
        // Kiểm tra xem cuộc trò chuyện có avatar tùy chỉnh thực sự không (không phải ảnh mặc định)
        const hasCustomAvatar = convo.conversationAvatarUrl && 
                                !convo.conversationAvatarUrl.includes('1582213782179') && 
                                !convo.conversationAvatarUrl.includes('1535713875002');
                                
        if (hasCustomAvatar) {
          customIcon = convo.conversationAvatarUrl;
        } else if (convo.group) {
          // Xử lý ảnh gộp: Vẽ động ảnh gộp bằng OffscreenCanvas giống như giao diện
          const members = [...(convo.userConversations || [])];
          // Sắp xếp các thành viên theo chiều giảm dần của joinAt hoặc createdAt như ở client
          members.sort((a, b) => {
            const timeA = new Date(a.joinAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.joinAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          
          const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
          const avatarUrls = members.map(u => u.avatarUrl || u.user?.avatarUrl || defaultUserAvatar);
          
          if (avatarUrls.length > 0) {
            const compositeUrl = await generateCompositeAvatar(avatarUrls);
            if (compositeUrl) {
              customIcon = compositeUrl;
            } else {
              customIcon = avatarUrls[0];
            }
          }
        } else {
          // Chat 1-1: Lấy avatar của đối phương
          const currentUserId = await getCachedUserId();
          const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
          if (otherParticipant) {
            customIcon = otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl;
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi khi tìm avatar cuộc trò chuyện từ cache:', err);
    }
  }

  if (!customIcon) {
    customIcon = '/favicon.ico';
  }

  const notificationOptions = {
    body: finalBody,
    icon: customIcon, // Bốc trường "icon" chính là avatar phòng chat từ Java hoặc notification payload truyền sang
    badge: '/favicon.ico',
    tag: groupTag,
    data: {
      click_action: clickAction,
      messages: messages
    }
  };

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