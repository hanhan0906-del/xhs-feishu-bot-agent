#!/usr/bin/env node
import * as Lark from '@larksuiteoapi/node-sdk';
import { loadBotConfig, assertBotConfig } from './config.mjs';
import { handleCommand, isUserAllowed } from './commands.mjs';
import { createConsoleReadonlyCommandAdapter } from './console-readonly-adapter.mjs';
import { createConsoleReadonlyDataProvider } from './console-readonly-provider.mjs';

const config = loadBotConfig();
assertBotConfig(config);
const consoleReadonlyDataProvider = createConsoleReadonlyDataProvider({
  fetchImpl: (...args) => globalThis.fetch(...args)
});
const routeCommand = createConsoleReadonlyCommandAdapter({
  enabled: config.consoleReadonlyCommandsEnabled,
  legacyHandler: handleCommand,
  authorizationCheck: isUserAllowed,
  readProvider: consoleReadonlyDataProvider
});

const baseConfig = {
  appId: config.appId,
  appSecret: config.appSecret,
  domain: Lark.Domain.Feishu,
  loggerLevel: Lark.LoggerLevel.info,
  onReady: () => console.log('[xhs-feishu-bot] ws onReady'),
  onError: error => console.error('[xhs-feishu-bot] ws onError', error?.message || error),
  onReconnecting: () => console.warn('[xhs-feishu-bot] ws reconnecting'),
  onReconnected: () => console.log('[xhs-feishu-bot] ws reconnected')
};

const client = new Lark.Client(baseConfig);
const wsClient = new Lark.WSClient(baseConfig);

let queue = Promise.resolve();

function enqueue(task) {
  queue = queue.then(task).catch(error => {
    console.error('[xhs-feishu-bot] queued task failed', error);
  });
  return queue;
}

async function sendText(chatId, text) {
  const data = {
    receive_id: chatId,
    content: JSON.stringify({ text: String(text || '').slice(0, 5000) }),
    msg_type: 'text'
  };
  const request = { params: { receive_id_type: 'chat_id' }, data };
  if (client.im?.v1?.message?.create) return client.im.v1.message.create(request);
  return client.im.message.create(request);
}

function extractPlainText(message) {
  if (!message) return '';
  if (message.message_type !== 'text') return '';
  try {
    const content = JSON.parse(message.content || '{}');
    return content.text || '';
  } catch {
    return '';
  }
}

function extractOpenId(data) {
  return data?.sender?.sender_id?.open_id || data?.sender?.sender_id?.user_id || '';
}

const dispatcher = new Lark.EventDispatcher({}).register({
  'im.message.receive_v1': async data => {
    console.log('[xhs-feishu-bot] event im.message.receive_v1', JSON.stringify({
      message_id: data?.message?.message_id || null,
      chat_id: data?.message?.chat_id || null,
      message_type: data?.message?.message_type || null,
      sender_open_id: data?.sender?.sender_id?.open_id || null
    }));

    const chatId = data?.message?.chat_id;
    const text = extractPlainText(data?.message);
    const openId = extractOpenId(data);
    if (!chatId || !text) {
      console.warn('[xhs-feishu-bot] ignored event without chat_id or text');
      return;
    }

    await sendText(chatId, 'Received. Processing now.');
    enqueue(async () => {
      try {
        const reply = await routeCommand(text, config, { openId, chatId });
        await sendText(chatId, reply);
      } catch (error) {
        await sendText(chatId, `Command failed: ${error.message}`);
      }
    });
  }
});

console.log('[xhs-feishu-bot] starting WS client');
console.log('[xhs-feishu-bot] content agent:', config.contentAgentRoot);
console.log('[xhs-feishu-bot] scan publisher:', config.scanPublishRoot);
console.log('[xhs-feishu-bot] publish root:', config.publishTaskRoot);
if (!config.allowedOpenIds.size) {
  console.warn('[xhs-feishu-bot] XHS_FEISHU_ALLOWED_OPEN_IDS is empty; all tenant users who can message this bot are allowed.');
}

wsClient.start({ eventDispatcher: dispatcher });

setInterval(() => {
  try {
    console.log('[xhs-feishu-bot] ws status', JSON.stringify(wsClient.getConnectionStatus?.() || null));
  } catch (error) {
    console.error('[xhs-feishu-bot] ws status error', error?.message || error);
  }
}, 60 * 1000);
