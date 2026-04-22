function emit(ioLike, eventName, payload, aliases = []) {
  const io = ioLike || global.io;

  if (!io || typeof io.emit !== 'function') {
    return;
  }

  io.emit(eventName, payload);

  for (const alias of aliases) {
    io.emit(alias, payload);
  }
}

function emitMessage(ioLike, payload) {
  emit(ioLike, 'message:new', payload, ['new_message']);
}

function emitConversationUpdate(ioLike, payload) {
  emit(ioLike, 'conversation:update', payload, ['conversation_updated', 'conversation-update']);
}

function emitTypingStart(ioLike, payload) {
  emit(ioLike, 'typing:start', payload, ['typing_start']);
}

function emitTypingStop(ioLike, payload) {
  emit(ioLike, 'typing:stop', payload, ['typing_stop']);
}

module.exports = {
  emitConversationUpdate,
  emitMessage,
  emitTypingStart,
  emitTypingStop,
};
