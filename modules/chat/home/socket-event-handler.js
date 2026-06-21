import { socket } from '../../../js/core/websocket.js';

function mergeConversation(oldConvo, newConvoDto) {
  if (oldConvo && oldConvo.userConversations && newConvoDto && newConvoDto.userConversations) {
    newConvoDto.userConversations.forEach(newU => {
      const oldU = oldConvo.userConversations.find(u => String(u.userId) === String(newU.userId));
      if (oldU) {
        if (String(newU.lastMessageId) !== String(oldU.lastMessageId)) {
          newU.seenAt = Date.now();
        } else {
          newU.seenAt = oldU.seenAt;
        }
      }
    });
  }
  return { ...oldConvo, ...newConvoDto };
}

function formatMessageTime(createdAt) {
  if (!createdAt) {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  const d = new Date(createdAt);
  return !isNaN(d.getTime())
    ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : String(createdAt);
}

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


    case 'UPDATE_CONVERSATION':
      {
        let conversationsList = null;
        if (data && Array.isArray(data)) {
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
              let avatarUrl = activeConvo.conversationAvatarUrl || (activeConvo.group ? defaultGroupAvatar : defaultUserAvatar);
              let displayTitle = activeConvo.title;
              if (!displayTitle && !activeConvo.group) {
                const otherParticipant = activeConvo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
                if (otherParticipant) {
                  displayTitle = otherParticipant.fullName ||
                                 otherParticipant.user?.fullName ||
                                 otherParticipant.displayName ||
                                 otherParticipant.username ||
                                 otherParticipant.user?.username ||
                                 'Người dùng';
                  if (otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl) {
                    avatarUrl = otherParticipant.avatarUrl || otherParticipant.user.avatarUrl;
                  }
                } else {
                  displayTitle = 'Người dùng';
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

          if (!isStillMember) {
            ctx.conversations = ctx.conversations.filter(c => String(c.conversationId) !== String(conversationDto.conversationId));
            ctx.renderConversationsList();
            if (String(conversationDto.conversationId) === activeConvoId) {
              ctx.conversationId = null;
              sessionStorage.removeItem(`chat_messages_cache_${activeConvoId}`);
              ctx.renderEmptyChatFrame();
            }
          } else {
            const idx = ctx.conversations.findIndex(c => String(c.conversationId) === String(conversationDto.conversationId));
            let convo;
            if (idx !== -1) {
              const oldC = ctx.conversations.splice(idx, 1)[0];
              convo = mergeConversation(oldC, conversationDto);
            } else {
              convo = conversationDto;
            }
            ctx.conversations.unshift(convo);
            ctx.renderConversationsList();

            if (String(ctx.conversationId) === String(conversationDto.conversationId)) {
              const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
              const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';
              let avatarUrl = convo.conversationAvatarUrl || (convo.group ? defaultGroupAvatar : defaultUserAvatar);
              let displayTitle = convo.title;
              if (!displayTitle && !convo.group) {
                const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
                if (otherParticipant) {
                  displayTitle = otherParticipant.fullName ||
                                 otherParticipant.user?.fullName ||
                                 otherParticipant.displayName ||
                                 otherParticipant.username ||
                                 otherParticipant.user?.username ||
                                 'Người dùng';
                  if (otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl) {
                    avatarUrl = otherParticipant.avatarUrl || otherParticipant.user.avatarUrl;
                  }
                } else {
                  displayTitle = 'Người dùng';
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
      break;

    case 'DELETE_CONVERSATION':
      if (conversationDto && conversationDto.conversationId) {
        const targetConvoId = String(conversationDto.conversationId);
        const activeConvoId = String(ctx.conversationId);

        ctx.conversations = ctx.conversations.filter(c => String(c.conversationId) !== targetConvoId);
        ctx.renderConversationsList();

        if (targetConvoId === activeConvoId) {
          ctx.conversationId = null;
          sessionStorage.removeItem(`chat_messages_cache_${activeConvoId}`);
          ctx.renderEmptyChatFrame();
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
                  ctx.messages[existingIndex].time = formatMessageTime(messageDto.createdAt);
                  ctx.messages[existingIndex].isRevoked = isRevoked;
                  ctx.messages[existingIndex].type = messageDto.type || messageDto.messageType || ctx.messages[existingIndex].type || 'TEXT';
                  ctx.messages[existingIndex].replyMessageId = messageDto.replyMessageId || ctx.messages[existingIndex].replyMessageId || null;
                  ctx.messages[existingIndex].replyText = messageDto.replyText || ctx.messages[existingIndex].replyText || null;
                  ctx.messages[existingIndex].replyType = messageDto.replyType || ctx.messages[existingIndex].replyType || null;
                  ctx.messages[existingIndex].replyRevoked = messageDto.replyRevoked === true || ctx.messages[existingIndex].replyRevoked === true;
                  if (isRevoked) {
                    ctx.messages[existingIndex].text = 'Tin nhắn đã bị thu hồi';
                  }
                } else {
                  ctx.messages.push({
                    id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
                    sender: isMe ? 'me' : 'them',
                    senderId: senderId,
                    text: isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
                    type: messageDto.type || messageDto.messageType || 'TEXT',
                    time: formatMessageTime(messageDto.createdAt),
                    status: 'sent',
                    isRevoked: isRevoked,
                    replyMessageId: messageDto.replyMessageId || null,
                    replyText: messageDto.replyText || null,
                    replyType: messageDto.replyType || null,
                    replyRevoked: messageDto.replyRevoked === true
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
                  targetMsgs[existingIndex].time = formatMessageTime(messageDto.createdAt);
                  targetMsgs[existingIndex].isRevoked = isRevoked;
                  targetMsgs[existingIndex].type = messageDto.type || messageDto.messageType || targetMsgs[existingIndex].type || 'TEXT';
                  targetMsgs[existingIndex].replyMessageId = messageDto.replyMessageId || targetMsgs[existingIndex].replyMessageId || null;
                  targetMsgs[existingIndex].replyText = messageDto.replyText || targetMsgs[existingIndex].replyText || null;
                  targetMsgs[existingIndex].replyType = messageDto.replyType || targetMsgs[existingIndex].replyType || null;
                  targetMsgs[existingIndex].replyRevoked = messageDto.replyRevoked === true || targetMsgs[existingIndex].replyRevoked === true;
                  if (isRevoked) {
                    targetMsgs[existingIndex].text = 'Tin nhắn đã bị thu hồi';
                  }
                } else {
                  targetMsgs.push({
                    id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
                    sender: isMe ? 'me' : 'them',
                    senderId: senderId,
                    text: isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
                    type: messageDto.type || messageDto.messageType || 'TEXT',
                    time: formatMessageTime(messageDto.createdAt),
                    status: 'sent',
                    isRevoked: isRevoked,
                    replyMessageId: messageDto.replyMessageId || null,
                    replyText: messageDto.replyText || null,
                    replyType: messageDto.replyType || null,
                    replyRevoked: messageDto.replyRevoked === true
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
              senderId: senderId,
              text: isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
              type: messageDto.type || messageDto.messageType || 'TEXT',
              time: formatMessageTime(messageDto.createdAt),
              status: 'sent',
              isRevoked: isRevoked,
              replyMessageId: messageDto.replyMessageId || null,
              replyText: messageDto.replyText || null,
              replyType: messageDto.replyType || null,
              replyRevoked: messageDto.replyRevoked === true
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
          // Hiển thị thông báo native nếu không ở trong hội thoại đó, không phải mình gửi và tab đang mở hiển thị
          if (document.visibilityState === 'visible') {
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
            import('../../../js/core/firebase.js')
              .then(({ showNativeNotification }) => {
                showNativeNotification(
                  senderName,
                  isRevoked ? 'Tin nhắn đã bị thu hồi' : messageText,
                  incomingConvoId,
                  messageDto.messageId || messageDto.id
                );
              })
              .catch(err => console.warn('Không thể tải showNativeNotification từ firebase.js:', err));
          }
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
              const oldC = ctx.conversations.splice(idx, 1)[0];
              ctx.conversations.unshift(mergeConversation(oldC, conversationDto));
            } else {
              ctx.conversations.unshift(conversationDto);
            }
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
            let updatedCache = false;
            const msgIndex = targetMsgs.findIndex(m => String(m.id) === targetMsgId);
            if (msgIndex !== -1) {
              targetMsgs[msgIndex].text = 'Tin nhắn đã bị thu hồi';
              targetMsgs[msgIndex].isRevoked = true;
              updatedCache = true;
            }
            // Update any replies to this message in cache
            targetMsgs.forEach(m => {
              if (m.replyMessageId && String(m.replyMessageId) === targetMsgId) {
                m.replyText = 'Tin nhắn đã bị thu hồi';
                m.replyRevoked = true;
                updatedCache = true;
              }
            });
            if (updatedCache) {
              sessionStorage.setItem(targetCacheKey, JSON.stringify(targetMsgs));
            }
          } catch (e) {
            console.warn('Failed to parse and update target messages cache on revoke:', e);
          }
        }

        if (incomingConvoId === activeConvoId) {
          let updatedActive = false;
          const msgIndex = ctx.messages.findIndex(m => String(m.id) === targetMsgId);
          if (msgIndex !== -1) {
            ctx.messages[msgIndex].text = 'Tin nhắn đã bị thu hồi';
            ctx.messages[msgIndex].isRevoked = true;
            updatedActive = true;
          }
          // Update any replies to this message in active messages list
          ctx.messages.forEach(m => {
            if (m.replyMessageId && String(m.replyMessageId) === targetMsgId) {
              m.replyText = 'Tin nhắn đã bị thu hồi';
              m.replyRevoked = true;
              updatedActive = true;
            }
          });
          if (updatedActive) {
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
              userConvo.seenAt = Date.now(); // Ghi nhận thời gian xem tin nhắn
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
          ctx.conversations[convoIndex] = mergeConversation(ctx.conversations[convoIndex], conversationDto);
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
