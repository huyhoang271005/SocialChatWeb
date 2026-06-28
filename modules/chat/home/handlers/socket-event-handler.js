import { socket } from '../../../../js/core/websocket.js';
import { t, formatSystemMessage } from '../../../../js/core/i18n.js';
import { api } from '../../../../js/core/api.js';
import { ConversationHandler } from './conversation-handler.js';

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
  const merged = { ...oldConvo, ...newConvoDto };
  if (merged.unreadMessage !== undefined && merged.unreadMessage !== null) {
    merged.unreadMessage = parseInt(merged.unreadMessage || 0, 10);
  }
  return merged;
}

export function formatMessageTime(createdAt) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return String(createdAt);

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) {
    return t('just_now');
  }
  if (diffMins < 60) {
    return t('minutes_ago').replace('{count}', diffMins);
  }
  if (diffHours < 24) {
    return t('hours_ago').replace('{count}', diffHours);
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffTime = today.getTime() - compareDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return t('yesterday');
  }
  if (diffDays < 7) {
    return t('days_ago').replace('{count}', diffDays);
  }
  
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return t('weeks_ago').replace('{count}', diffWeeks);
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return t('months_ago').replace('{count}', diffMonths);
  }

  const diffYears = Math.floor(diffDays / 365);
  return t('years_ago').replace('{count}', diffYears);
}

export function formatSpecificTime(createdAt) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (isNaN(date.getTime())) return String(createdAt);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return `${timeStr} ${day}/${month}/${year}`;
}

export function handleSocketEvent(ctx, event) {
  if (!event) return;

  const eventType = event.type || event.eventType;
  if (!eventType) return;

  // Xác định đối tượng message (MessageDto) và conversation (ConversationDto)
  let messageDto = null;
  let conversationDto = null;

  // 1. Theo cấu trúc mới DataDto (gộp message/conversation thành data)
  if (event.data && typeof event.data === 'object') {
    if (
      eventType === 'NEW_MESSAGE' ||
      eventType === 'REVOKE_MESSAGE' ||
      eventType === 'SEEN_MESSAGE' ||
      eventType === 'UPDATE_MESSAGE'
    ) {
      messageDto = event.data;
    } else {
      conversationDto = event.data;
    }
  }

  // 2. Fallback cấu trúc cũ
  if (!messageDto && event.message && typeof event.message === 'object') {
    messageDto = event.message;
  }
  if (!conversationDto && event.conversation && typeof event.conversation === 'object') {
    conversationDto = event.conversation;
  }

  // 3. Fallback cấu trúc cũ phẳng hoặc dùng data cũ
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
                                 t('user');
                  if (otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl) {
                    avatarUrl = otherParticipant.avatarUrl || otherParticipant.user.avatarUrl;
                  }
                } else {
                  displayTitle = t('user');
                }
              }
              ctx.updateChatHeader(
                displayTitle || (t('chat') + ' #' + activeConvo.conversationId),
                avatarUrl,
                activeConvo.group ? t('group_chat_prefix') : t('online'),
                activeConvo.conversationId,
                ctx.conversations
              );

              ConversationHandler.updateChatInputRestriction(ctx, activeConvo);
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
                                 t('user');
                  if (otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl) {
                    avatarUrl = otherParticipant.avatarUrl || otherParticipant.user.avatarUrl;
                  }
                } else {
                  displayTitle = t('user');
                }
              }
              ctx.updateChatHeader(
                displayTitle || (t('chat') + ' #' + convo.conversationId),
                avatarUrl,
                convo.group ? t('group_chat_prefix') : t('online'),
                convo.conversationId,
                ctx.conversations
              );

              ConversationHandler.updateChatInputRestriction(ctx, convo);
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
      
    case 'NEW_MESSAGE':
      if (messageDto && messageDto.conversationId) {
        const activeConvoId = String(ctx.conversationId);
        const incomingConvoId = String(messageDto.conversationId);
        const incomingClientMsgId = event.clientMsgId || messageDto.clientMsgId || (event.data && event.data.clientMsgId);

        const senderId = messageDto.senderId !== undefined && messageDto.senderId !== null ? messageDto.senderId : messageDto.sender?.userId;
        let messageText = messageDto.text || messageDto.message || '';
        const msgType = String(messageDto.type || 'TEXT').toUpperCase();

        const isSystemMsg = msgType === 'REMOVE_MEMBER' || msgType === 'ADD_MEMBER' || msgType === 'LEAVED';
        let rawText = messageText;
        if (isSystemMsg) {
          messageDto.rawText = rawText;
          messageText = formatSystemMessage(msgType, rawText);
          messageDto.text = messageText;
        }

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
                let existingIndex = -1;
                if (incomingClientMsgId) {
                  existingIndex = ctx.messages.findIndex(m =>
                    m.sender === 'me' &&
                    (m.status === 'pending' || m.status === 'sending') &&
                    String(m.clientMsgId) === String(incomingClientMsgId)
                  );
                }
                if (existingIndex === -1) {
                  existingIndex = ctx.messages.findIndex(m =>
                    m.sender === 'me' &&
                    (m.status === 'pending' || m.status === 'sending') &&
                    (m.text === messageText || m.text.trim() === messageText.trim())
                  );
                }
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
                  ctx.messages[existingIndex].rawText = messageDto.rawText;
                  ctx.messages[existingIndex].reactorCount = messageDto.reactorCount || messageDto.reactionCount || ctx.messages[existingIndex].reactorCount || null;
                  ctx.messages[existingIndex].createdAt = messageDto.createdAt || ctx.messages[existingIndex].createdAt;
                  if (isRevoked) {
                    ctx.messages[existingIndex].text = t('revoked_msg');
                  }
                } else {
                  ctx.messages.push({
                    id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
                    sender: isMe ? 'me' : 'them',
                    senderId: senderId,
                    text: isRevoked ? t('revoked_msg') : messageText,
                    type: messageDto.type || messageDto.messageType || 'TEXT',
                    time: formatMessageTime(messageDto.createdAt),
                    status: 'sent',
                    isRevoked: isRevoked,
                    replyMessageId: messageDto.replyMessageId || null,
                    replyText: messageDto.replyText || null,
                    replyType: messageDto.replyType || null,
                    replyRevoked: messageDto.replyRevoked === true,
                    rawText: messageDto.rawText,
                    reactorCount: messageDto.reactorCount || messageDto.reactionCount || null,
                    createdAt: messageDto.createdAt
                  });
                }
                sessionStorage.setItem(targetCacheKey, JSON.stringify(ctx.messages));
                ctx.renderMessages();
              } else {
                // For inactive conversation, handle resolving pending/sending states locally in targetMsgs
                let existingIndex = -1;
                if (incomingClientMsgId) {
                  existingIndex = targetMsgs.findIndex(m =>
                    m.sender === 'me' &&
                    (m.status === 'pending' || m.status === 'sending') &&
                    String(m.clientMsgId) === String(incomingClientMsgId)
                  );
                }
                if (existingIndex === -1) {
                  existingIndex = targetMsgs.findIndex(m =>
                    m.sender === 'me' &&
                    (m.status === 'pending' || m.status === 'sending') &&
                    (m.text === messageText || m.text.trim() === messageText.trim())
                  );
                }
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
                  targetMsgs[existingIndex].rawText = messageDto.rawText;
                  targetMsgs[existingIndex].reactorCount = messageDto.reactorCount || messageDto.reactionCount || targetMsgs[existingIndex].reactorCount || null;
                  targetMsgs[existingIndex].createdAt = messageDto.createdAt || targetMsgs[existingIndex].createdAt;
                  if (isRevoked) {
                    targetMsgs[existingIndex].text = t('revoked_msg');
                  }
                } else {
                  targetMsgs.push({
                    id: messageDto.messageId || messageDto.id || `msg_${Date.now()}`,
                    sender: isMe ? 'me' : 'them',
                    senderId: senderId,
                    text: isRevoked ? t('revoked_msg') : messageText,
                    type: messageDto.type || messageDto.messageType || 'TEXT',
                    time: formatMessageTime(messageDto.createdAt),
                    status: 'sent',
                    isRevoked: isRevoked,
                    replyMessageId: messageDto.replyMessageId || null,
                    replyText: messageDto.replyText || null,
                    replyType: messageDto.replyType || null,
                    replyRevoked: messageDto.replyRevoked === true,
                    rawText: messageDto.rawText,
                    reactorCount: messageDto.reactorCount || messageDto.reactionCount || null,
                    createdAt: messageDto.createdAt
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
              text: isRevoked ? t('revoked_msg') : messageText,
              type: messageDto.type || messageDto.messageType || 'TEXT',
              time: formatMessageTime(messageDto.createdAt),
              status: 'sent',
              isRevoked: isRevoked,
              replyMessageId: messageDto.replyMessageId || null,
              replyText: messageDto.replyText || null,
              replyType: messageDto.replyType || null,
              replyRevoked: messageDto.replyRevoked === true,
              rawText: messageDto.rawText,
              reactorCount: messageDto.reactorCount || messageDto.reactionCount || null,
              createdAt: messageDto.createdAt
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
            let senderName = t('new_message_alert');
            const convo = ctx.conversations.find(c => String(c.conversationId) === incomingConvoId);
            let avatarUrl = '/favicon.ico';
            if (convo) {
              const defaultUserAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100';
              const defaultGroupAvatar = 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100';
              avatarUrl = convo.conversationAvatarUrl || (convo.group ? defaultGroupAvatar : defaultUserAvatar);
              if (!convo.group) {
                const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
                if (otherParticipant && (otherParticipant.avatarUrl || otherParticipant.user?.avatarUrl)) {
                  avatarUrl = otherParticipant.avatarUrl || otherParticipant.user.avatarUrl;
                }
              }

              if (convo.group) {
                senderName = convo.title || `${t('group_chat_prefix')} #${incomingConvoId}`;
              } else {
                senderName = convo.title || `${t('chat')} #${incomingConvoId}`;
                const otherParticipant = convo.userConversations?.find(u => String(u.userId) !== String(currentUserId));
                const otherUserId = otherParticipant ? otherParticipant.userId : null;
                if (otherUserId && ctx.profileCache.has(String(otherUserId))) {
                  senderName = ctx.profileCache.get(String(otherUserId)).fullName;
                }
              }
            }

            let notificationBody = isRevoked ? t('revoked_msg') : messageText;
            if (!isRevoked && msgType !== 'TEXT') {
              if (msgType === 'IMAGE') {
                notificationBody = t('snippet_image');
              } else if (msgType === 'VIDEO') {
                notificationBody = t('snippet_video');
              } else if (msgType === 'AUDIO') {
                notificationBody = t('snippet_audio');
              } else if (msgType === 'FILE') {
                notificationBody = t('snippet_file');
              }
            }

            import('../../../../js/core/firebase.js')
              .then(({ showNativeNotification }) => {
                showNativeNotification(
                  senderName,
                  notificationBody,
                  incomingConvoId,
                  messageDto.messageId || messageDto.id,
                  messageDto.tag || event.tag,
                  avatarUrl
                );
              })
              .catch(err => console.warn('Không thể tải showNativeNotification từ firebase.js:', err));
          }
        }

        // Cập nhật preview tin nhắn cuối ở sidebar và đưa cuộc trò chuyện lên đầu
        const convoIndex = ctx.conversations.findIndex(c => String(c.conversationId) === incomingConvoId);
        if (convoIndex !== -1) {
          const convo = ctx.conversations[convoIndex];
          convo.lastMessage = messageDto;
          convo.lastMessageText = isRevoked ? t('revoked_msg') : messageText;
          convo.lastMessageTime = messageDto.createdAt;
          convo.lastMessageId = messageDto.messageId || messageDto.id;
          convo.lastMessageSenderId = messageDto.senderId;

          // Tăng số tin nhắn chưa đọc của hội thoại nếu không phải mình gửi
          if (incomingConvoId !== activeConvoId && !isMe) {
            convo.unreadMessage = parseInt(convo.unreadMessage || 0, 10) + 1;
            const currentUserId = localStorage.getItem('chat_user_id');
            const myUserConvo = convo.userConversations?.find(u => String(u.userId) === String(currentUserId));
            if (myUserConvo) {
              myUserConvo.unreadMessage = parseInt(myUserConvo.unreadMessage || 0, 10) + 1;
            }
          }

          ctx.conversations.splice(convoIndex, 1);
          ctx.conversations.unshift(convo);
          ctx.renderConversationsList();
        } else {
          if (eventType === 'NEW_MESSAGE' || eventType === 'SEND_MESSAGE') {
            api.get(`conversations/${incomingConvoId}`)
              .then(res => {
                if (res && res.success && res.data) {
                  const newConvo = res.data;
                  const idx = ctx.conversations.findIndex(c => String(c.conversationId) === String(newConvo.conversationId));
                  if (idx !== -1) {
                    const oldC = ctx.conversations.splice(idx, 1)[0];
                    ctx.conversations.unshift(mergeConversation(oldC, newConvo));
                  } else {
                    ctx.conversations.unshift(newConvo);
                  }
                  ctx.renderConversationsList();
                } else {
                  ctx.loadConversations(false);
                }
              })
              .catch(err => {
                console.warn('Failed to fetch conversation details for incoming message:', err);
                ctx.loadConversations(false);
              });
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
              targetMsgs[msgIndex].text = t('revoked_msg');
              targetMsgs[msgIndex].isRevoked = true;
              updatedCache = true;
            }
            // Update any replies to this message in cache
            targetMsgs.forEach(m => {
              if (m.replyMessageId && String(m.replyMessageId) === targetMsgId) {
                m.replyText = t('revoked_msg');
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
            ctx.messages[msgIndex].text = t('revoked_msg');
            ctx.messages[msgIndex].isRevoked = true;
            updatedActive = true;
          }
          // Update any replies to this message in active messages list
          ctx.messages.forEach(m => {
            if (m.replyMessageId && String(m.replyMessageId) === targetMsgId) {
              m.replyText = t('revoked_msg');
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
          convo.lastMessageText = t('revoked_msg');
          ctx.renderConversationsList();
        }

        // Thu hồi thông báo native hiển thị (nếu có)
        import('../../../../js/core/firebase.js')
          .then(({ revokeNativeNotification }) => {
            revokeNativeNotification(targetMsgId);
          })
          .catch(err => console.warn('Không thể tải revokeNativeNotification từ firebase.js:', err));
      }
      break;

    case 'UPDATE_MESSAGE':
      if (messageDto && messageDto.conversationId && (messageDto.messageId || messageDto.id)) {
        const incomingConvoId = String(messageDto.conversationId);
        const activeConvoId = String(ctx.conversationId);
        const targetMsgId = String(messageDto.messageId || messageDto.id);

        // 1. Cập nhật cache trong sessionStorage nếu tồn tại
        const cacheKey = `chat_messages_cache_${incomingConvoId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const cachedMsgs = JSON.parse(cached);
            const msgIndex = cachedMsgs.findIndex(m => String(m.id || m.messageId) === targetMsgId);
            if (msgIndex !== -1) {
              cachedMsgs[msgIndex] = { ...cachedMsgs[msgIndex], ...messageDto };
              cachedMsgs[msgIndex].id = messageDto.messageId || messageDto.id;
              sessionStorage.setItem(cacheKey, JSON.stringify(cachedMsgs));
            }
          } catch (e) {
            console.warn('Failed to update cache on UPDATE_MESSAGE:', e);
          }
        }

        // 2. Nếu là cuộc hội thoại đang mở, cập nhật ctx.messages
        if (incomingConvoId === activeConvoId) {
          const msgIndex = ctx.messages.findIndex(m => String(m.id || m.messageId) === targetMsgId);
          if (msgIndex !== -1) {
            ctx.messages[msgIndex] = { ...ctx.messages[msgIndex], ...messageDto };
            ctx.messages[msgIndex].id = messageDto.messageId || messageDto.id;
            ctx.messages[msgIndex].time = formatMessageTime(messageDto.createdAt || ctx.messages[msgIndex].createdAt);
            ctx.renderMessages();
          }
        }
      }
      break;

    case 'SEEN_MESSAGE':
      {
        const senderId = event.senderId;
        const message = event.message || messageDto;
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
      if (event.data) {
        const incomingConvoId = typeof event.data === 'object' && event.data !== null
          ? String(event.data.conversationId || '')
          : String(event.data);
        const activeConvoId = String(ctx.conversationId);
        const senderId =  event.senderId;
        const currentUserId = localStorage.getItem('chat_user_id') || 'user_me';

        if (incomingConvoId === activeConvoId && senderId && String(senderId) !== String(currentUserId)) {
          const typingIndicator = document.getElementById('typing-indicator');
          if (typingIndicator) {
             let name = t('someone');
             const convo = ctx.conversations.find(c => String(c.conversationId) === incomingConvoId);
             const participant = convo?.userConversations?.find(u => String(u.userId) === String(senderId));

             if (participant && participant.fullName) {
               name = participant.fullName;
             } else if (ctx.profileCache.has(String(senderId))) {
               name = ctx.profileCache.get(String(senderId)).fullName;
             } else if (convo && !convo.group && convo.title && convo.title !== t('loading') + '...') {
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
              <span><strong>${name}</strong> ${t('is_typing')}</span>
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
      if (event.data) {
        const incomingConvoId = typeof event.data === 'object' && event.data !== null
          ? String(event.data.conversationId || '')
          : String(event.data);
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
