export const SeenResolver = {
  resolve(messages, conversations, conversationId, currentUserId) {
    if (!messages || messages.length === 0) return;

    const convo = conversations.find(c => String(c.conversationId) === String(conversationId));
    if (!convo || !convo.userConversations) return;

    const otherParticipants = convo.userConversations.filter(u => String(u.userId) !== String(currentUserId));
    const seenIds = otherParticipants.map(u => String(u.lastMessageId || '')).filter(id => id !== '');

    if (seenIds.length === 0) return;

    const isSeen = (msgId) => {
      return seenIds.some(seenId => {
        if (!isNaN(msgId) && !isNaN(seenId)) {
          return Number(msgId) <= Number(seenId);
        }
        return String(msgId) === String(seenId);
      });
    };

    messages.forEach(m => {
      if (m.sender === 'me') {
        if (isSeen(m.id)) {
          m.status = 'seen';
        } else if (m.status === 'seen') {
          m.status = 'sent';
        }
      }
    });
  }
};
