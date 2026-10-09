import path from 'node:path';

export function parseBooleanFeatureFlag(value) {
  return /^(?:1|true|yes|on)$/i.test(String(value ?? '').trim());
}

export function loadBotConfig(env = process.env) {
  return {
    appId: env.XHS_FEISHU_APP_ID || '',
    appSecret: env.XHS_FEISHU_APP_SECRET || '',
    allowedOpenIds: new Set(String(env.XHS_FEISHU_ALLOWED_OPEN_IDS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)),
    contentAgentRoot: path.resolve(env.XHS_CONTENT_AGENT_ROOT || 'C:\\Users\\Lenovo\\Desktop\\小红书相关的skill\\xhs-content-experiment-agent'),
    scanPublishRoot: path.resolve(env.XHS_SCAN_PUBLISH_ROOT || 'C:\\Users\\Lenovo\\Desktop\\Codex Agent合集\\小红书手机扫码发布Agent'),
    publishTaskRoot: path.resolve(env.XHS_PUBLISH_TASK_ROOT || 'C:\\Users\\Lenovo\\Desktop\\小红书发布任务'),
    commandTimeoutMs: Number(env.XHS_FEISHU_COMMAND_TIMEOUT_MS || 10 * 60 * 1000),
    consoleReadonlyCommandsEnabled: parseBooleanFeatureFlag(env.XHS_CONSOLE_READONLY_COMMANDS_ENABLED)
  };
}

export function assertBotConfig(config) {
  const missing = [];
  if (!config.appId) missing.push('XHS_FEISHU_APP_ID');
  if (!config.appSecret) missing.push('XHS_FEISHU_APP_SECRET');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
