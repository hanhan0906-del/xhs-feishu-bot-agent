#!/usr/bin/env node
import * as Lark from '@larksuiteoapi/node-sdk';

const appId = process.env.XHS_FEISHU_APP_ID || '';
const appSecret = process.env.XHS_FEISHU_APP_SECRET || '';

if (!appId || !appSecret) {
  console.error('Missing XHS_FEISHU_APP_ID or XHS_FEISHU_APP_SECRET.');
  process.exit(2);
}

const channel = Lark.createLarkChannel({
  appId,
  appSecret,
  domain: Lark.Domain.Feishu,
  transport: 'websocket',
  includeRawEvent: true,
  loggerLevel: Lark.LoggerLevel.info,
  policy: {
    dmMode: 'open',
    requireMention: false
  },
  handshakeTimeoutMs: 30000
});

let received = false;

channel.on({
  message: async msg => {
    received = true;
    console.log('[probe-channel] message', JSON.stringify({
      messageId: msg.messageId,
      chatId: msg.chatId,
      chatType: msg.chatType,
      senderId: msg.senderId,
      content: msg.content,
      rawContentType: msg.rawContentType
    }));
    await channel.send(msg.chatId, { text: `Channel received: ${msg.content || ''}` }, { replyTo: msg.messageId });
  },
  reject: evt => {
    console.log('[probe-channel] reject', JSON.stringify(evt));
  },
  botAdded: evt => {
    console.log('[probe-channel] botAdded', JSON.stringify(evt));
  },
  error: err => {
    console.error('[probe-channel] error', err?.code || '', err?.message || err);
  },
  reconnecting: () => console.warn('[probe-channel] reconnecting'),
  reconnected: () => console.log('[probe-channel] reconnected')
});

console.log('[probe-channel] connecting');
await channel.connect();
console.log('[probe-channel] connected', JSON.stringify(channel.getConnectionStatus?.() || null));
console.log('[probe-channel] send a message to XHS Ops Bot now; waiting 120 seconds');

const deadline = Date.now() + 120000;
while (Date.now() < deadline && !received) {
  await new Promise(resolve => setTimeout(resolve, 2000));
}

console.log('[probe-channel] done', JSON.stringify({ received }));
await channel.disconnect();
process.exit(received ? 0 : 2);
