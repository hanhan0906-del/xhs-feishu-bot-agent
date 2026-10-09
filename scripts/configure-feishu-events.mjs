#!/usr/bin/env node
import * as Lark from '@larksuiteoapi/node-sdk';

const appId = process.env.XHS_FEISHU_APP_ID || '';
const appSecret = process.env.XHS_FEISHU_APP_SECRET || '';

if (!appId || !appSecret) {
  console.error('Missing XHS_FEISHU_APP_ID or XHS_FEISHU_APP_SECRET.');
  process.exit(2);
}

const client = new Lark.Client({
  appId,
  appSecret,
  domain: Lark.Domain.Feishu,
  loggerLevel: Lark.LoggerLevel.fatal,
  logger: {
    error() {},
    warn() {},
    info() {},
    debug() {},
    trace() {}
  }
});

const payload = {
  path: { app_id: appId },
  data: {
    scope: {
      add_scopes: [
        { scope_name: 'im:message:send_as_bot', token_type: 'tenant' },
        { scope_name: 'im:message.p2p_msg:readonly', token_type: 'tenant' },
        { scope_name: 'im:message.group_at_msg:readonly', token_type: 'tenant' }
      ]
    },
    event: {
      subscription_type: 'websocket',
      add_events: ['im.message.receive_v1']
    }
  }
};

console.log(`Configuring Feishu app ${appId}: websocket events + im.message.receive_v1`);
try {
  const result = await client.application.v7.applicationConfig.patch(payload);
  console.log(JSON.stringify({
    code: result?.code,
    msg: result?.msg,
    ok: result?.code === 0
  }, null, 2));

  if (result?.code !== 0) {
    process.exit(1);
  }
} catch (error) {
  const data = error?.response?.data || {};
  console.error(JSON.stringify({
    code: data.code || null,
    msg: data.msg || error?.message || 'Unknown error',
    log_id: data.error?.log_id || data.log_id || null,
    troubleshooter: data.error?.troubleshooter || null,
    permission_violations: data.error?.permission_violations || []
  }, null, 2));
  process.exit(1);
}
