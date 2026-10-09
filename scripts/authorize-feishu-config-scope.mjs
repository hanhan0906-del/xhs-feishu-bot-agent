#!/usr/bin/env node
import * as Lark from '@larksuiteoapi/node-sdk';

const appId = process.env.XHS_FEISHU_APP_ID || '';
if (!appId) {
  console.error('Missing XHS_FEISHU_APP_ID.');
  process.exit(2);
}

console.log(`Requesting extra Feishu scope for existing app ${appId}: application:application:patch`);

await Lark.registerApp({
  appId,
  source: 'xhs-feishu-chatbot-agent-config',
  addons: {
    preset: false,
    scopes: {
      tenant: ['application:application:patch']
    }
  },
  onQRCodeReady(info) {
    console.log('Open this Feishu authorization URL and approve the scope:');
    console.log(info.url);
    console.log(`Expires in ${info.expireIn} seconds.`);
  },
  onStatusChange(info) {
    console.log('Authorization status:', info.status);
  }
});

console.log('Feishu config scope authorization completed.');
