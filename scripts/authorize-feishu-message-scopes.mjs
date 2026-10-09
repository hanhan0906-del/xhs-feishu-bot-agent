#!/usr/bin/env node
import * as Lark from '@larksuiteoapi/node-sdk';

const appId = process.env.XHS_FEISHU_APP_ID || '';
if (!appId) {
  console.error('Missing XHS_FEISHU_APP_ID.');
  process.exit(2);
}

console.log(`Requesting Feishu message receive scopes for existing app ${appId}.`);

await Lark.registerApp({
  appId,
  source: 'xhs-feishu-chatbot-agent-message-scopes',
  addons: {
    preset: false,
    scopes: {
      tenant: [
        'im:message:send_as_bot',
        'im:message.p2p_msg:readonly',
        'im:message.group_at_msg:readonly'
      ]
    },
    events: {
      items: {
        tenant: ['im.message.receive_v1']
      }
    }
  },
  onQRCodeReady(info) {
    console.log('Open this Feishu authorization URL and approve the message scopes:');
    console.log(info.url);
    console.log(`Expires in ${info.expireIn} seconds.`);
  },
  onStatusChange(info) {
    console.log('Authorization status:', info.status);
  }
});

console.log('Feishu message scopes authorization completed.');
