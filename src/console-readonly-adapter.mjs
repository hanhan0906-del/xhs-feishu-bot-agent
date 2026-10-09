import {
  parseConsoleReadonlyCommand,
  renderConsoleSafeReply
} from './console-readonly-commands.mjs';

export const CONSOLE_READONLY_WIRED_DEFAULT = false;

export function formatConsoleSafeReply(reply) {
  const lines = [String(reply?.summary || '只读指令已处理。')];
  if (reply?.console_link) lines.push(`控制台：${reply.console_link}`);

  const warnings = Array.isArray(reply?.warnings) ? reply.warnings.filter(Boolean) : [];
  if (warnings.length) lines.push(`提示：${warnings.join('；')}`);
  return lines.join('\n');
}

export function createConsoleReadonlyCommandAdapter({
  enabled = CONSOLE_READONLY_WIRED_DEFAULT,
  legacyHandler,
  authorizationCheck = () => true,
  readProvider = null
} = {}) {
  if (typeof legacyHandler !== 'function') {
    throw new TypeError('legacyHandler must be a function');
  }
  if (typeof authorizationCheck !== 'function') {
    throw new TypeError('authorizationCheck must be a function');
  }
  if (readProvider != null && typeof readProvider !== 'function') {
    throw new TypeError('readProvider must be a function or null');
  }

  const wired = enabled === true;
  const handler = async (text, config = {}, context = {}) => {
    if (!wired) return legacyHandler(text, config, context);
    if (!authorizationCheck(config, context.openId || '')) {
      return '这个飞书用户不在允许名单里。请把你的 open_id 加到 XHS_FEISHU_ALLOWED_OPEN_IDS 后再重启机器人。';
    }

    const intent = parseConsoleReadonlyCommand(text);
    let readModel = {};
    if (readProvider && !['help', 'blocked_external_action', 'blocked_invalid_input'].includes(intent.command)) {
      try {
        readModel = await readProvider(intent);
      } catch {
        readModel = {
          summary: '控制台只读 API 暂不可用，未执行其他操作。',
          warnings: ['console_readonly_api_unavailable']
        };
      }
    }
    const safeReply = renderConsoleSafeReply(intent, readModel);
    return formatConsoleSafeReply(safeReply);
  };

  Object.defineProperty(handler, 'wiring', {
    value: Object.freeze({
      wired,
      wired_default: CONSOLE_READONLY_WIRED_DEFAULT,
      provider_injected: Boolean(readProvider),
      external_calls_when_disabled: 0
    }),
    enumerable: true
  });

  return handler;
}
