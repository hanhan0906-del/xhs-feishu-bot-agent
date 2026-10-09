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

console.log(`Publishing Feishu app config for ${appId}.`);

try {
  const result = await client.application.v7.applicationPublish.create({
    path: { app_id: appId },
    data: {
      pc_default_ability: 'bot',
      mobile_default_ability: 'bot',
      remark: 'Enable XHS Ops Bot message receive event through websocket.',
      changelog: 'Enable im.message.receive_v1 websocket event for local XHS operations bot.'
    }
  });

  console.log(JSON.stringify({
    code: result?.code,
    msg: result?.msg,
    ok: result?.code === 0,
    version_id: result?.data?.version_id || null,
    version: result?.data?.version || null
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
