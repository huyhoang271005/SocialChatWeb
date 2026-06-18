import { socket } from '../../../js/core/websocket.js';

export function handleSocketEvent(ctx, event) {
  if (!event) return;

  const eventType = event.type || event.eventType;
  if (!eventType) return;

  // Xác định đối tượng message (MessageDto) và conversation (ConversationDto)
  let messageDto = null;
  let conversationDto = null;

  // 1. Theo cấu trúc mới DataDto
  if (event.message && typeof event.message === 'object') {
    messageDto = event.message;
  }
  if (event.conversation && typeof event.conversation === 'object') {
    conversationDto = event.conversation;
  }

  // 2. Fallback cấu trúc cũ phẳng hoặc dùng data
  const data = event.data || event;
  if (!messageDto && data && typeof data === 'object') {
    if (data.conversationId || data.messageId || data.text || (data.message && typeof data.message !== 'string')) {
      messageDto = data;
    }
  }
  if (!conversationDto && data && typeof data === 'object') {
    if (data.conversationId && !data.messageId) {
      conversationDto = data;
    }
  }

  switch (eventType) {
    case 'NEW_CONVERSATION':
      if (conversationDto && conversationDto.conversationId) {
        const idx = ctx.conversations.findIndex(c => String(c.conversationId) === String(conversationDto.conversationId));
        let convo;
        if (idx !== -1) {
          const existingConvo = ctx.conversations.splice(idx, 1)[0];
          convo = { ...existingConvo, ...conversationDto };
          ctx.conversations.unshift(convo);
        } else {
          convo = conversationDto;
          ctx.conversations.unshift(convo);
        }
        ctx.renderConversationsList();

        if (String(ctx.conversationId) === String(conversationDto.conversationId)) {
          const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
          const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';
          let avatarUrl = convo.conversationAvatar || (convo.group ? defaultGroupAvatar : defaultUserAvatar);
          let displayTitle = convo.title;
          if (!displayTitle && !convo.group) {
            const currentUserId = localStorage.getItem('chat_user_id');
            const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
            const otherUserId = otherParticipant ? otherParticipant.userId : null;
            if (otherUserId && ctx.profileCache.has(String(otherUserId))) {
              displayTitle = ctx.profileCache.get(String(otherUserId)).fullName;
            } else {
              displayTitle = 'Đang tải...';
            }
          }
          ctx.updateChatHeader(
            displayTitle || ('Cuộc trò chuyện ' + convo.conversationId),
            avatarUrl,
            convo.group ? 'Nhóm trò chuyện' : 'Đang hoạt động',
            convo.conversationId,
            ctx.conversations
          );

          // Tự động làm mới danh sách thành viên trong modal đang hiển thị
          const eventObj = new CustomEvent('members-updated', { detail: { conversationId: convo.conversationId } });
          document.dispatchEvent(eventObj);
        }
      }
      break;

    case 'ADD_MEMBER':
    case 'DELETE_MEMBER':
    case 'REMOVE_MEMBER':
    case 'LEAVE_CONVERSATION':
    case 'UPDATE_CONVERSATION':
      {
        let conversationsList = null;
        if (Array.isArray(data)) {
          conversationsList = data;
        } else if (data && Array.isArray(data.conversations)) {
          conversationsList = data.conversations;
        } else if (event && Array.isArray(event.conversations)) {
          conversationsList = event.conversations;
        }

        if (conversationsList) {
          const currentUserId = String(localStorage.getItem('chat_user_id'));
          const activeConvoId = String(ctx.conversationId);
          const wasActiveMember = ctx.conversations.some(c => String(c.conversationId) === activeConvoId);
          const isActiveMemberStill = conversationsList.some(c => String(c.conversationId) === activeConvoId);

          ctx.conversations = conversationsList;
          ctx.renderConversationsList();

          if (wasActiveMember && !isActiveMemberStill) {
            ctx.conversationId = null;
            sessionStorage.removeItem(`chat_messages_cache_${activeConvoId}`);
            ctx.renderEmptyChatFrame();
          } else {
            const activeConvo = ctx.conversations.find(c => String(c.conversationId) === activeConvoId);
            if (activeConvo) {
              const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
              const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';
              let avatarUrl = activeConvo.conversationAvatar || (activeConvo.group ? defaultGroupAvatar : defaultUserAvatar);
              let displayTitle = activeConvo.title;
              if (!displayTitle && !activeConvo.group) {
                const otherParticipant = activeConvo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
                const otherUserId = otherParticipant ? otherParticipant.userId : null;
                if (otherUserId && ctx.profileCache.has(String(otherUserId))) {
                  displayTitle = ctx.profileCache.get(String(otherUserId)).fullName;
                } else {
                  displayTitle = 'Đang tải...';
                }
              }
              ctx.updateChatHeader(
                displayTitle || ('Cuộc trò chuyện ' + activeConvo.conversationId),
                avatarUrl,
                activeConvo.group ? 'Nhóm trò chuyện' : 'Đang hoạt động',
                activeConvo.conversationId,
                ctx.conversations
              );

              const eventObj = new CustomEvent('members-updated', { detail: { conversationId: activeConvoId } });
              document.dispatchEvent(eventObj);
            }
          }
        } else if (conversationDto && conversationDto.conversationId) {
          const activeConvoId = String(ctx.conversationId);
          const currentUserId = String(localStorage.getItem('chat_user_id'));
          const isStillMember = conversationDto.userConversations?.some(u => String(u.userId) === currentUserId);

          if (String(conversationDto.conversationId) === activeConvoId && !isStillMember) {
            ctx.conversations = ctx.conversations.filter(c => String(c.conversationId) !== String(conversationDto.conversationId));
            ctx.renderConversationsList();
            ctx.conversationId = null;
            sessionStorage.removeItem(`chat_messages_cache_${activeConvoId}`);
            ctx.renderEmptyChatFrame();
          } else {
            const idx = ctx.conversations.findIndex(c => String(c.conversationId) === String(conversationDto.conversationId));
            if (idx !== -1) {
              ctx.conversations[idx] = { ...ctx.conversations[idx], ...conversationDto };
              ctx.renderConversationsList();

              if (String(ctx.conversationId) === String(conversationDto.conversationId)) {
                const convo = ctx.conversations[idx];
                const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
                const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';
                let avatarUrl = convo.conversationAvatar || (convo.group ? defaultGroupAvatar : defaultUserAvatar);
                let displayTitle = convo.title;
                if (!displayTitle && !convo.group) {
                  const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
                  const otherUserId = otherParticipant ? otherParticipant.userId : null;
                  if (otherUserId && ctx.profileCache.has(String(otherUserId))) {
                    displayTitle = ctx.profileCache.get(String(otherUserId)).fullName;
                  } else {
                    displayTitle = 'Đang tải...';
                  }
                }
                ctx.updateChatHeader(
                  displayTitle || ('Cuộc trò chuyện ' + convo.conversationId),
                  avatarUrl,
                  convo.group ? 'Nhóm trò chuyện' : 'Đang hoạt động',
                  convo.conversationId,
                  ctx.conversations
                );

                const eventObj = new CustomEvent('members-updated', { detail: { conversationId: convo.conversationId } });
                document.dispatchEvent(eventObj);
              }
            }
          }
        }
      }
      break;

    case 'SEND_MESSAGE':
    case 'NEW_MESSAGE':
      if (messageDto && messageDto.conversationId) {
        const activeConvoId = String(ctx.conversationId);
        const incomingConvoId = String(messageDto.conversationId);

        const senderId = messageDto.senderId !== undefined && messageDto.senderId !== null ? messageDto.senderId : messageDto.sender?.userId;
        const messageText = messageDto.text || messageDto.message;
        const isRevoked = messageDto.revoked === true;

        const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
        const isMe = String(senderId) === String(currentUserId);

        // Update cache for the incoming conversation if it exists in sessionStorage
        const targetCacheKey = `chat_messages_cache_${incomingConvoId}`;
        const targetCached = sessionStorage.getItem(targetCacheKey);
        if (targetCached) {
          try {
            const targetMsgs = JSON.parse(targetCached);
            const isDuplicate = targetMsgs.some(m => String(m.id) === String(messageDto.messageId || messageDto.id));
            if (!isDuplicate) {
              if (incomingConvoId === activeConvoId) {
                // For active conversation, handle resolving pending/sending states locally
                let existingIndex = ctx.messages.findIndex(m =>
                  m.sender === 'me' &&
                  (m.status === 'pending' || m.status === 'sending') &&
                  (m.text === messageText || m.text.trim() === messageText.trim())
                );
                if (existingIndex === -1) {
                  existingIndex = ctx.messages.findIndex(m =>
                    m.sender === 'me' &&
                    (m.status === 'pending' || m.status === 'sending')
                  );
                }

                if (existingIndex !== -1) {
                  ctx.messages[existingIndex].status = 'sent';
                  ctx.messages[existingIndex].id = messageDto.messageId || messageDto.id;
                  ctx.messages[existingIndex].time = new Date(messageDto.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                  ctx.messages[existingIndex].isRevoked = isRevoked;
                  ctx.messages[existingIndex].type = messageDto.type || messageDto.messageType || ctx.messages[existingIndex].type || 'TEXT';
                  if (isRevoked) {
                    ctx.messages[existingIndex].text = 'Tin nhắn đã bị thu hồi';
                  }
                } else {
                  ctx.messages.push({
                    id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
                    sender: isMe ? 'me' : 'them',
                    text: isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
                    type: messageDto.type || messageDto.messageType || 'TEXT',
                    time: new Date(messageDto.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    status: 'sent',
                    isRevoked: isRevoked
                  });
                }
                sessionStorage.setItem(targetCacheKey, JSON.stringify(ctx.messages));
                ctx.renderMessages();
              } else {
                // For inactive conversation, handle resolving pending/sending states locally in targetMsgs
                let existingIndex = targetMsgs.findIndex(m =>
                  m.sender === 'me' &&
                  (m.status === 'pending' || m.status === 'sending') &&
                  (m.text === messageText || m.text.trim() === messageText.trim())
                );
                if (existingIndex === -1) {
                  existingIndex = targetMsgs.findIndex(m =>
                    m.sender === 'me' &&
                    (m.status === 'pending' || m.status === 'sending')
                  );
                }

                if (existingIndex !== -1) {
                  targetMsgs[existingIndex].status = 'sent';
                  targetMsgs[existingIndex].id = messageDto.messageId || messageDto.id;
                  targetMsgs[existingIndex].time = new Date(messageDto.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                  targetMsgs[existingIndex].isRevoked = isRevoked;
                  targetMsgs[existingIndex].type = messageDto.type || messageDto.messageType || targetMsgs[existingIndex].type || 'TEXT';
                  if (isRevoked) {
                    targetMsgs[existingIndex].text = 'Tin nhắn đã bị thu hồi';
                  }
                } else {
                  targetMsgs.push({
                    id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
                    sender: isMe ? 'me' : 'them',
                    text: isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
                    type: messageDto.type || messageDto.messageType || 'TEXT',
                    time: new Date(messageDto.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    status: 'sent',
                    isRevoked: isRevoked
                  });
                }
                sessionStorage.setItem(targetCacheKey, JSON.stringify(targetMsgs));
              }
            }
          } catch (e) {
            console.warn('Failed to parse and update target messages cache:', e);
          }
        } else if (incomingConvoId === activeConvoId) {
          // Active conversation with no cache yet (fallback, should be rare)
          const isDuplicate = ctx.messages.some(m => String(m.id) === String(messageDto.messageId || messageDto.id));
          if (!isDuplicate) {
            ctx.messages.push({
              id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
              sender: isMe ? 'me' : 'them',
              text: isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
              type: messageDto.type || messageDto.messageType || 'TEXT',
              time: new Date(messageDto.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
              status: 'sent',
              isRevoked: isRevoked
            });
            sessionStorage.setItem(targetCacheKey, JSON.stringify(ctx.messages));
            ctx.renderMessages();
          }
        }
        if (incomingConvoId === activeConvoId && !isMe) {
          if (socket.client && socket.client.connected) {
            socket.sendSeen(activeConvoId, messageDto.messageId, messageDto.senderId);
          }
        }

        if (incomingConvoId !== activeConvoId && !isMe) {
          // Hiển thị thông báo Toast nếu không ở trong hội thoại đó và không phải mình gửi
          let senderName = 'Tin nhắn mới';
          const convo = ctx.conversations.find(c => String(c.conversationId) === incomingConvoId);
          if (convo) {
            if (convo.group) {
              senderName = convo.title || `Nhóm #${incomingConvoId}`;
            } else {
              senderName = convo.title || `Trò chuyện #${incomingConvoId}`;
              const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
              const otherUserId = otherParticipant ? otherParticipant.userId : null;
              if (otherUserId && ctx.profileCache.has(String(otherUserId))) {
                senderName = ctx.profileCache.get(String(otherUserId)).fullName;
              }
            }
          }
          ctx.showIncomingMessageToast(senderName, isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText, incomingConvoId);
        }

        // Cập nhật preview tin nhắn cuối ở sidebar và đưa cuộc trò chuyện lên đầu
        const convoIndex = ctx.conversations.findIndex(c => String(c.conversationId) === incomingConvoId);
        if (convoIndex !== -1) {
          const convo = ctx.conversations[convoIndex];
          convo.lastMessageText = isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText;
          convo.lastMessageTime = messageDto.createdAt;
          convo.lastMessageId = messageDto.messageId || messageDto.id;
          convo.lastMessageSenderId = messageDto.senderId;

          // Tăng số tin nhắn chưa đọc của hội thoại nếu không phải mình gửi
          if (incomingConvoId !== activeConvoId && !isMe) {
            convo.unreadMessage = (convo.unreadMessage || 0) + 1;
          }

          ctx.conversations.splice(convoIndex, 1);
          ctx.conversations.unshift(convo);
          ctx.renderConversationsList();
        } else {
          if (conversationDto) {
            const idx = ctx.conversations.findIndex(c => String(c.conversationId) === String(conversationDto.conversationId));
            if (idx !== -1) {
              ctx.conversations.splice(idx, 1);
            }
            ctx.conversations.unshift(conversationDto);
            ctx.renderConversationsList();
          } else {
            ctx.loadConversations(false);
          }
        }
      }
      break;

    case 'REVOKE_MESSAGE':
      if (messageDto && messageDto.conversationId && (messageDto.messageId || messageDto.id)) {
        const targetMsgId = String(messageDto.messageId || messageDto.id);
        const incomingConvoId = String(messageDto.conversationId);
        const activeConvoId = String(ctx.conversationId);

        // Update cache for the conversation if it exists in sessionStorage
        const targetCacheKey = `chat_messages_cache_${incomingConvoId}`;
        const targetCached = sessionStorage.getItem(targetCacheKey);
        if (targetCached) {
          try {
            const targetMsgs = JSON.parse(targetCached);
            const msgIndex = targetMsgs.findIndex(m => String(m.id) === targetMsgId);
            if (msgIndex !== -1) {
              targetMsgs[msgIndex].text = 'Tin nhắn đã bị thu hồi';
              targetMsgs[msgIndex].isRevoked = true;
              sessionStorage.setItem(targetCacheKey, JSON.stringify(targetMsgs));
            }
          } catch (e) {
            console.warn('Failed to parse and update target messages cache on revoke:', e);
          }
        }

        if (incomingConvoId === activeConvoId) {
          const msgIndex = ctx.messages.findIndex(m => String(m.id) === targetMsgId);
          if (msgIndex !== -1) {
            ctx.messages[msgIndex].text = 'Tin nhắn đã bị thu hồi';
            ctx.messages[msgIndex].isRevoked = true;
            ctx.renderMessages();
          }
        }

        const convo = ctx.conversations.find(c => String(c.conversationId) === incomingConvoId);
        if (convo && convo.lastMessageId && String(convo.lastMessageId) === targetMsgId) {
          convo.lastMessageText = 'Tin nhắn đã bị thu hồi';
          ctx.renderConversationsList();
        }
      }
      break;

    case 'SEEN_MESSAGE':
      {
        const senderId = event.senderId;
        const message = event.message;
        const convoId = message?.conversationId;
        const msgId = message?.messageId;

        if (convoId && senderId && msgId) {
          const incomingConvoId = String(convoId);
          const activeConvoId = String(ctx.conversationId);

          // Cập nhật lastMessageId của user trong userConversations của cuộc trò chuyện trong ctx.conversations
          const convo = ctx.conversations.find(c => String(c.conversationId) === incomingConvoId);
          if (convo && convo.userConversations) {
            const userConvo = convo.userConversations.find(u => String(u.userId) === String(senderId));
            if (userConvo) {
              userConvo.lastMessageId = msgId;
            }
          }

          // Nếu là cuộc trò chuyện đang active và không phải của chính mình
          if (incomingConvoId === activeConvoId) {
            const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';
            if (String(senderId) !== String(currentUserId)) {
              ctx.resolveMessagesSeenStatus(activeConvoId);
              sessionStorage.setItem(`chat_messages_cache_${activeConvoId}`, JSON.stringify(ctx.messages));
              ctx.renderMessages();
            }
          }
        }
      }
      break;

    case 'SEEN':
      if (conversationDto && conversationDto.conversationId) {
        const incomingConvoId = String(conversationDto.conversationId);
        
        // Cập nhật cuộc trò chuyện ở sidebar
        const convoIndex = ctx.conversations.findIndex(c => String(c.conversationId) === incomingConvoId);
        if (convoIndex !== -1) {
          ctx.conversations[convoIndex] = { ...ctx.conversations[convoIndex], ...conversationDto };
          ctx.renderConversationsList();
        }

        // Nếu đối phương đã xem cuộc trò chuyện hiện tại
        const activeConvoId = String(ctx.conversationId);
        if (incomingConvoId === activeConvoId) {
          ctx.messages.forEach(m => {
            if (m.sender === 'me' && m.status === 'sent') {
              m.status = 'seen';
            }
          });
          sessionStorage.setItem(`chat_messages_cache_${ctx.conversationId}`, JSON.stringify(ctx.messages));
          ctx.renderMessages();
        }
      }
      break;

    case 'TYPING':
      if (conversationDto && conversationDto.conversationId) {
        const incomingConvoId = String(conversationDto.conversationId);
        const activeConvoId = String(ctx.conversationId);
        const senderId =  event.senderId;
        const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';

        if (incomingConvoId === activeConvoId && senderId && String(senderId) !== String(currentUserId)) {
          const typingIndicator = document.getElementById('typing-indicator');
          if (typingIndicator) {
             let name = 'Ai đó';
             const convo = ctx.conversations.find(c => String(c.conversationId) === incomingConvoId);
             const participant = convo?.userConversations?.find(u => String(u.userId) === String(senderId));

             if (participant && participant.fullName) {
               name = participant.fullName;
             } else if (ctx.profileCache.has(String(senderId))) {
               name = ctx.profileCache.get(String(senderId)).fullName;
             } else if (convo && !convo.group && convo.title && convo.title !== 'Đang tải...') {
               name = convo.title;
               ctx.profileCache.set(String(senderId), { fullName: name });
             } else if (participant) {
               const resolvedName = participant.user?.fullName ||
                                    participant.displayName ||
                                    participant.username ||
                                    participant.user?.username;
               if (resolvedName) {
                 name = resolvedName;
                 ctx.profileCache.set(String(senderId), { fullName: resolvedName });
               }
             }
            
            typingIndicator.innerHTML = `
              <span class="voice-recording-dot" style="background-color: var(--text-secondary); width: 8px; height: 8px; animation: pulse-dot 1s infinite alternate;"></span>
              <span><strong>${name}</strong> đang soạn tin nhắn...</span>
            `;
            typingIndicator.style.display = 'flex';
            
            const msgContainer = document.getElementById('chat-messages-container');
            if (msgContainer) {
              msgContainer.scrollTop = msgContainer.scrollHeight;
            }
          }
        }
      }
      break;

    case 'UNTYPING':
      if (conversationDto && conversationDto.conversationId) {
        const incomingConvoId = String(conversationDto.conversationId);
        const activeConvoId = String(ctx.conversationId);
        const senderId = event.senderId;
        const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';

        if (incomingConvoId === activeConvoId && senderId && String(senderId) !== String(currentUserId)) {
          const typingIndicator = document.getElementById('typing-indicator');
          if (typingIndicator) {
            typingIndicator.style.display = 'none';
          }
        }
      }
      break;

    default:
      console.warn('Unknown WebSocket event type:', eventType);
  }
}
