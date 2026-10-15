const fs = require('fs/promises');
const path = require('path');

let patchApplied = false;

async function applyBaileysRuntimePatches() {
  if (patchApplied) return;

  try {
    const baileysPkgPath = require.resolve('@whiskeysockets/baileys/package.json');
    const baileysLibDir = path.join(path.dirname(baileysPkgPath), 'lib');

    // 1. Patch lib/Socket/messages-send.js: support @lid in type === 'sender' receipts
    const msgSendPath = path.join(baileysLibDir, 'Socket', 'messages-send.js');
    let msgSendCode = await fs.readFile(msgSendPath, 'utf8');
    let msgSendUpdated = false;

    if (!msgSendCode.includes('isLidUser')) {
      msgSendCode = msgSendCode.replace(
        'isJidGroup, isJidUser,',
        'isJidGroup, isJidUser, isLidUser,'
      );
      msgSendUpdated = true;
    }

    if (msgSendCode.includes("if (type === 'sender' && isJidUser(jid))")) {
      msgSendCode = msgSendCode.replace(
        "if (type === 'sender' && isJidUser(jid))",
        "if (type === 'sender' && (isJidUser(jid) || isLidUser(jid)))"
      );
      msgSendUpdated = true;
    }

    if (msgSendUpdated) {
      await fs.writeFile(msgSendPath, msgSendCode, 'utf8');
      console.log('[BAILEYS-PATCH] Patched Socket/messages-send.js for @lid sender receipts');
    }

    // 2. Patch lib/Socket/messages-recv.js:
    const msgRecvPath = path.join(baileysLibDir, 'Socket', 'messages-recv.js');
    let msgRecvCode = await fs.readFile(msgRecvPath, 'utf8');
    let msgRecvUpdated = false;

    // 2a. Fix isJidUser(msg.key.remoteJid) -> isJidUser || isLidUser
    if (msgRecvCode.includes('if (isJidUser(msg.key.remoteJid)) {\n                                participant = author;\n                            }')) {
      msgRecvCode = msgRecvCode.replace(
        'if (isJidUser(msg.key.remoteJid)) {\n                                participant = author;\n                            }',
        'if (isJidUser(msg.key.remoteJid) || isLidUser(msg.key.remoteJid)) {\n                                participant = author;\n                            }'
      );
      msgRecvUpdated = true;
    }

    // 2b. Skip assertSessions([participant], true) in sendMessagesAgain when no messages are found
    const oldSendAgainTarget = "const sendToAll = !jidDecode(participant)?.device;\n        await assertSessions([participant], true);";
    const newSendAgainReplacement = "if (!msgs.some(Boolean)) {\n            logger.debug({ jid: key.remoteJid, ids }, 'recv retry request, but message not available (skipping forced session reset)');\n            return;\n        }\n        const sendToAll = !jidDecode(participant)?.device;\n        await assertSessions([participant], true);";
    if (msgRecvCode.includes(oldSendAgainTarget)) {
      msgRecvCode = msgRecvCode.replace(oldSendAgainTarget, newSendAgainReplacement);
      msgRecvUpdated = true;
    }

    // 2c. Do not block retryMutex for 5s on requestPlaceholderResend
    const oldPlaceholderAwait = "const msgId = await requestPlaceholderResend(msgKey);";
    const newPlaceholderAsync = "requestPlaceholderResend(msgKey).catch(() => {}); const msgId = msgKey?.id;";
    if (msgRecvCode.includes(oldPlaceholderAwait)) {
      msgRecvCode = msgRecvCode.replace(oldPlaceholderAwait, newPlaceholderAsync);
      msgRecvUpdated = true;
    }

    // 2d. When retry limit is reached in sendRetryRequest, ACK the node so it doesn't block offline queue
    const oldRetryLimitBlock = `        if (retryCount >= maxMsgRetryCount) {
            logger.debug({ retryCount, msgId }, 'reached retry limit, clearing');
            msgRetryCache.del(key);
            return;
        }`;
    const newRetryLimitBlock = `        if (retryCount >= maxMsgRetryCount) {
            logger.debug({ retryCount, msgId }, 'reached retry limit, clearing');
            msgRetryCache.del(key);
            await sendMessageAck(node).catch(() => {});
            return;
        }`;
    if (msgRecvCode.includes(oldRetryLimitBlock)) {
      msgRecvCode = msgRecvCode.replace(oldRetryLimitBlock, newRetryLimitBlock);
      msgRecvUpdated = true;
    }

    // 2e. When MISSING_KEYS_ERROR_TEXT ('Key used already or never filled') happens:
    //     For fromMe / peer messages (or after 1 retry), send proper receipt + clean ACK instead of NACK 487
    const oldMissingKeysBlock = `                        if (msg?.messageStubParameters?.[0] === MISSING_KEYS_ERROR_TEXT) {
                            return sendMessageAck(node, NACK_REASONS.ParsingError);
                        }`;
    const newMissingKeysBlock = `                        if (msg?.messageStubParameters?.[0] === MISSING_KEYS_ERROR_TEXT) {
                            const retryKey = \`\${msg.key.id}:\${msg.key?.participant}\`;
                            const currentRetries = msgRetryCache.get(retryKey) || 0;
                            if (msg.key.fromMe || category === 'peer' || currentRetries >= 1) {
                                let errType = undefined;
                                let errParticipant = msg.key.participant;
                                if (category === 'peer') {
                                    errType = 'peer_msg';
                                } else if (msg.key.fromMe) {
                                    errType = 'sender';
                                    if (isJidUser(msg.key.remoteJid) || isLidUser(msg.key.remoteJid)) {
                                        errParticipant = author;
                                    }
                                }
                                await sendReceipt(msg.key.remoteJid, errParticipant, [msg.key.id], errType).catch(() => {});
                                return sendMessageAck(node);
                            }
                        }`;
    if (msgRecvCode.includes(oldMissingKeysBlock)) {
      msgRecvCode = msgRecvCode.replace(oldMissingKeysBlock, newMissingKeysBlock);
      msgRecvUpdated = true;
    }

    // 2f. Ensure makeOfflineNodeProcessor flushes ev buffer on every message and upon completion
    const oldOfflineLoop = `                    await nodeProcessor(node);
                }
                isProcessing = false;`;
    const newOfflineLoop = `                    await nodeProcessor(node);
                    if (ev.isBuffering()) {
                        ev.flush();
                    }
                }
                isProcessing = false;
                if (ev.isBuffering()) {
                    ev.flush();
                }`;
    if (msgRecvCode.includes(oldOfflineLoop)) {
      msgRecvCode = msgRecvCode.replace(oldOfflineLoop, newOfflineLoop);
      msgRecvUpdated = true;
    }

    if (msgRecvUpdated) {
      await fs.writeFile(msgRecvPath, msgRecvCode, 'utf8');
      console.log('[BAILEYS-PATCH] Patched Socket/messages-recv.js for @lid receipts, offline queue ACK & buffer flush');
    }

    // 3. Patch lib/Socket/socket.js: ensure offline_preview also schedules an event buffer flush
    const socketPath = path.join(baileysLibDir, 'Socket', 'socket.js');
    let socketCode = await fs.readFile(socketPath, 'utf8');
    const oldOfflinePreview = `    ws.on('CB:ib,,offline_preview', (node) => {
        logger.info('offline preview received', JSON.stringify(node));
        sendNode({
            tag: 'ib',
            attrs: {},
            content: [{ tag: 'offline_batch', attrs: { count: '100' } }]
        });
    });`;
    const newOfflinePreview = `    ws.on('CB:ib,,offline_preview', (node) => {
        logger.info('offline preview received', JSON.stringify(node));
        sendNode({
            tag: 'ib',
            attrs: {},
            content: [{ tag: 'offline_batch', attrs: { count: '100' } }]
        });
        setTimeout(() => {
            if (ev.isBuffering()) {
                ev.flush();
            }
        }, 2500);
    });`;
    if (socketCode.includes(oldOfflinePreview)) {
      socketCode = socketCode.replace(oldOfflinePreview, newOfflinePreview);
      await fs.writeFile(socketPath, socketCode, 'utf8');
      console.log('[BAILEYS-PATCH] Patched Socket/socket.js for offline_preview buffer flush');
    }

    patchApplied = true;
  } catch (err) {
    console.warn('[BAILEYS-PATCH] Warning: failed to apply runtime patch:', err?.message);
  }
}

module.exports = { applyBaileysRuntimePatches };
