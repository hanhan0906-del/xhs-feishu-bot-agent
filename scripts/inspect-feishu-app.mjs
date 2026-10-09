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

function summarizeVersion(item) {
  return {
    version: item.version,
    version_id: item.version_id,
    status: item.status,
    publish_time: item.publish_time,
    events: item.events || [],
    scopes: (item.scopes || []).map(scope => ({
      scope: scope.scope,
      token_types: scope.token_types || []
    }))
  };
}

try {
  const result = await client.application.v6.applicationAppVersion.list({
    path: { app_id: appId },
    params: {
      lang: 'zh_cn',
      page_size: 20,
      order: 1
    }
  });

  console.log(JSON.stringify({
    code: result?.code,
    msg: result?.msg,
    items: (result?.data?.items || []).map(summarizeVersion)
  }, null, 2));

  if (result?.code !== 0) process.exit(1);
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
