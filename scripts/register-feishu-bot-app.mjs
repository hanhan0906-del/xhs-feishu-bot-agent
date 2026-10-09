#!/usr/bin/env node
import * as Lark from '@larksuiteoapi/node-sdk';
import fs from 'node:fs';
import path from 'node:path';

if (!process.argv.includes('--confirm-create-app')) {
  console.error('This creates or updates a Feishu app after user authorization.');
  console.error('Run again with --confirm-create-app only when ready.');
  process.exit(2);
}

const result = await Lark.registerApp({
  createOnly: true,
  source: 'xhs-feishu-chatbot-agent',
  appPreset: {
    name: 'XHS Ops Bot',
    desc: 'Chat entry for the local XHS content and scan-publish agents.'
  },
  addons: {
    preset: false,
    scopes: {
      tenant: ['im:message:send_as_bot']
    },
    events: {
      items: {
        tenant: ['im.message.receive_v1']
      }
    }
  },
  onQRCodeReady(info) {
    console.log('Open this Feishu authorization URL and confirm the app:');
    console.log(info.url);
    console.log(`Expires in ${info.expireIn} seconds.`);
  },
  onStatusChange(info) {
    console.log('Authorization status:', info.status);
  }
});

const envPath = path.resolve('.env');
const envLines = [
  `XHS_FEISHU_APP_ID=${result.client_id}`,
  `XHS_FEISHU_APP_SECRET=${result.client_secret}`,
  '',
  'XHS_CONTENT_AGENT_ROOT=C:\\Users\\Lenovo\\Desktop\\小红书相关的skill\\xhs-content-experiment-agent',
  'XHS_SCAN_PUBLISH_ROOT=C:\\Users\\Lenovo\\Desktop\\Codex Agent合集\\小红书手机扫码发布Agent',
  'XHS_PUBLISH_TASK_ROOT=C:\\Users\\Lenovo\\Desktop\\小红书发布任务'
];

if (fs.existsSync(envPath)) {
  throw new Error(`Refusing to overwrite existing ${envPath}`);
}

fs.writeFileSync(envPath, envLines.join('\n') + '\n', 'utf8');

console.log('App created. Local .env has been created.');
console.log('XHS_FEISHU_APP_ID=' + result.client_id);
console.log('XHS_FEISHU_APP_SECRET saved to .env and not printed.');
