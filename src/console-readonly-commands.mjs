const CONSOLE_ORIGIN = 'http://127.0.0.1:5173';

const ROUTES = Object.freeze({
  help: `${CONSOLE_ORIGIN}/#/overview`,
  overview: `${CONSOLE_ORIGIN}/#/overview`,
  materials: `${CONSOLE_ORIGIN}/#/materials`,
  strategies: `${CONSOLE_ORIGIN}/#/strategies`,
  packages: `${CONSOLE_ORIGIN}/#/packages`,
  scan: `${CONSOLE_ORIGIN}/#/scan`,
  reflections: `${CONSOLE_ORIGIN}/#/reflections`,
  status: `${CONSOLE_ORIGIN}/#/overview`
});

const ROUTE_SET = new Set(Object.values(ROUTES));
const MAX_INPUT_LENGTH = 256;
const MAX_KEYWORD_LENGTH = 40;

const COMMAND_ALIASES = new Map([
  ['帮助', 'help'],
  ['指令', 'help'],
  ['菜单', 'help'],
  ['总览', 'overview'],
  ['概览', 'overview'],
  ['看板', 'overview'],
  ['首页', 'overview'],
  ['资料', 'materials'],
  ['资料库', 'materials'],
  ['素材', 'materials'],
  ['素材库', 'materials'],
  ['策略', 'strategies'],
  ['策略库', 'strategies'],
  ['发布包', 'packages'],
  ['发布任务包', 'packages'],
  ['任务包', 'packages'],
  ['扫码', 'scan'],
  ['扫码发布', 'scan'],
  ['复盘', 'reflections'],
  ['复盘中心', 'reflections'],
  ['反馈', 'reflections'],
  ['状态', 'status'],
  ['运行状态', 'status'],
  ['服务状态', 'status']
]);

const FILTER_CAPABILITIES = Object.freeze({
  help: new Set(),
  overview: new Set(),
  materials: new Set(['page', 'keyword', 'status']),
  strategies: new Set(['page', 'keyword', 'status']),
  packages: new Set(['page', 'keyword', 'status']),
  scan: new Set(['page', 'status']),
  reflections: new Set(['page', 'keyword', 'status']),
  status: new Set()
});

const STATUS_ALIASES = new Map([
  ['待处理', 'pending'],
  ['已就绪', 'ready'],
  ['已保存草稿', 'draft_saved'],
  ['已登记发布', 'user_confirmed_published'],
  ['生成失败', 'generation_failed'],
  ['通过', 'pass'],
  ['警告', 'warn'],
  ['阻断', 'blocked'],
  ['待复核', 'needs_review'],
  ['未观测', 'not_observed'],
  ['可用', 'available'],
  ['待验证', 'pending_verification'],
  ['已验证', 'verified'],
  ['未登记', 'not_registered'],
  ['已登记', 'registered'],
  ['登记冲突', 'conflict_unregistered_claim'],
  ['原始观察', 'raw_observation'],
  ['候选规则', 'candidate_rule'],
  ['多样本验证', 'multi_sample_validation'],
  ['已验证规则', 'verified_rule']
]);

const ALLOWED_STATUSES = new Set([
  'detected',
  'pending',
  'ready',
  'draft_saved',
  'published',
  'user_confirmed_published',
  'generation_failed',
  'pass',
  'warn',
  'blocked',
  'needs_review',
  'not_observed',
  'available',
  'pending_verification',
  'verified',
  'not_registered',
  'registered',
  'conflict_unregistered_claim',
  'raw_observation',
  'candidate_rule',
  'multi_sample_validation',
  'verified_rule'
]);

const ALLOWED_SOURCES = new Set([
  'sqlite',
  'publish_json',
  'source_trace',
  'obsidian',
  'runtime',
  'scan_links_md',
  'scan_sqlite',
  'handoff'
]);

const SENSITIVE_KEYS = new Set([
  'secret',
  'app_secret',
  'client_secret',
  'token',
  'access_token',
  'refresh_token',
  'cookie',
  'password',
  'api_key',
  'authorization',
  'credential',
  'session',
  'verification_code',
  'oauth_code',
  'account',
  'account_id',
  'user_id',
  'open_id',
  'sender_open_id',
  'qr_image_data_url'
]);

const WRITE_ACTION_PATTERN = /(?:生成(?:\s*(?:笔记|内容|图片|二维码))?|改写|仿写|保存\s*草稿|存\s*草稿|确认\s*发布|发布|登记\s*(?:反馈|已发布)|升级\s*规则|同步(?:\s*(?:飞书|数据))?|迁移|写入|上传|部署|扫描\s*资料|审计\s*批次)/i;
const URL_PATTERN = /(?:https?|ftp|file):\/\/|www\./i;
const PATH_PATTERN = /(?:^|\s)\.\.(?:[\\/]|$|\s)|[a-z]:[\\/]|\\\\|[\\/](?:users|windows|etc|api)(?:[\\/]|$)/i;

function baseIntent(command, route, sourceText, warnings = []) {
  return {
    command,
    route,
    filters: {},
    permission: 'read_only',
    requires_confirmation: false,
    source_text_redacted: redactText(sourceText),
    warnings
  };
}

function blockedIntent(kind, sourceText, warning) {
  return baseIntent(kind, null, sourceText, [warning]);
}

function normalizeText(text) {
  return String(text ?? '').replace(/\u0000/g, '').trim().replace(/\s+/g, ' ');
}

function redactText(value) {
  let text = String(value ?? '');
  text = text.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, '[REDACTED_DATA_URL]');
  text = text.replace(/\bBearer\s+[a-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  text = text.replace(
    /\b(app_secret|client_secret|secret|access_token|refresh_token|token|cookie|password|api_key|authorization|credential|session|verification_code|oauth_code|account_id|account|user_id|open_id|sender_open_id)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    '$1=[REDACTED]'
  );
  return text.slice(0, 160);
}

function findAlias(normalized) {
  const aliases = [...COMMAND_ALIASES.keys()].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (normalized === alias || normalized.startsWith(`${alias} `)) {
      return { alias, command: COMMAND_ALIASES.get(alias), rest: normalized.slice(alias.length).trim() };
    }
  }
  return null;
}

function parsePage(raw) {
  const match = String(raw).match(/^(?:第)?(\d{1,4})(?:页)?$/);
  if (!match) return null;
  const page = Number(match[1]);
  return Number.isInteger(page) && page >= 1 && page <= 999 ? page : null;
}

function normalizeStatus(raw) {
  const status = STATUS_ALIASES.get(raw) || raw;
  return ALLOWED_STATUSES.has(status) ? status : null;
}

function isSafeKeyword(value) {
  return Boolean(value)
    && value.length <= MAX_KEYWORD_LENGTH
    && !URL_PATTERN.test(value)
    && !PATH_PATTERN.test(value)
    && !/[\\/<>{}\[\]|`]/.test(value)
    && /^[\p{Script=Han}a-zA-Z0-9 _-]+$/u.test(value);
}

function parseFilters(rest, allowed) {
  if (!rest) return { filters: {}, warnings: [] };
  const tokens = rest.split(' ');
  const filters = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    let key;
    let value;

    const assignment = token.match(/^(页码|页|关键词|关键字|状态)[:=](.+)$/);
    if (assignment) {
      key = assignment[1];
      value = assignment[2];
    } else if (/^第?\d{1,4}页$/.test(token)) {
      key = '页码';
      value = token;
    } else if (['页码', '页', '关键词', '关键字', '状态'].includes(token)) {
      key = token;
      value = tokens[index + 1];
      index += 1;
    } else {
      return { error: `不支持的参数：${redactText(token)}` };
    }

    if (!value) return { error: `参数“${key}”缺少值。` };

    if (key === '页码' || key === '页') {
      if (!allowed.has('page')) return { error: '该只读指令不支持页码参数。' };
      const page = parsePage(value);
      if (!page) return { error: '页码必须是 1 到 999 的整数。' };
      filters.page = page;
    } else if (key === '关键词' || key === '关键字') {
      if (!allowed.has('keyword')) return { error: '该只读指令不支持关键词参数。' };
      if (!isSafeKeyword(value)) return { error: '关键词包含路径、URL、危险字符或长度超限。' };
      filters.keyword = value;
    } else {
      if (!allowed.has('status')) return { error: '该只读指令不支持状态参数。' };
      const status = normalizeStatus(value);
      if (!status) return { error: '状态不在只读白名单中。' };
      filters.status = status;
    }
  }

  return { filters, warnings: [] };
}

export function isAllowedConsoleLink(link) {
  return typeof link === 'string' && ROUTE_SET.has(link);
}

export function parseConsoleReadonlyCommand(text) {
  const raw = String(text ?? '');
  const normalized = normalizeText(raw);

  if (raw.length > MAX_INPUT_LENGTH) {
    return blockedIntent('blocked_invalid_input', raw, 'input_too_long');
  }
  if (!normalized) {
    return baseIntent('help', ROUTES.help, '', ['empty_command_returned_help']);
  }
  if (URL_PATTERN.test(normalized)) {
    return blockedIntent('blocked_invalid_input', normalized, 'user_supplied_url_blocked');
  }
  if (PATH_PATTERN.test(normalized) || /[\\/]/.test(normalized)) {
    return blockedIntent('blocked_invalid_input', normalized, 'path_parameter_blocked');
  }

  const matched = findAlias(normalized);
  if (!matched) {
    if (WRITE_ACTION_PATTERN.test(normalized)) {
      return blockedIntent(
        'blocked_external_action',
        normalized,
        'write_or_external_action_blocked_confirmation_gate_required'
      );
    }
    return baseIntent('help', ROUTES.help, normalized, ['unknown_command_returned_help']);
  }

  if (matched.rest && WRITE_ACTION_PATTERN.test(matched.rest)) {
    return blockedIntent(
      'blocked_external_action',
      normalized,
      'write_or_external_action_blocked_confirmation_gate_required'
    );
  }

  const parsed = parseFilters(matched.rest, FILTER_CAPABILITIES[matched.command]);
  if (parsed.error) {
    return blockedIntent('blocked_invalid_input', normalized, parsed.error);
  }

  return {
    ...baseIntent(matched.command, ROUTES[matched.command], normalized, parsed.warnings),
    filters: parsed.filters
  };
}

function isSensitiveKey(key) {
  const normalized = String(key).toLowerCase();
  if (SENSITIVE_KEYS.has(normalized)) return true;
  return /(?:^|_)(?:access_token|refresh_token|app_secret|client_secret|verification_code|oauth_code|open_id|account_id)$/.test(normalized);
}

function sanitizeString(value) {
  let text = redactText(value);
  text = text.replace(/data:[^\s,]+,[^\s]+/gi, '[REDACTED_DATA_URL]');
  text = text.replace(/https?:\/\/(?!127\.0\.0\.1:5173\/#\/(?:overview|materials|strategies|packages|scan|reflections)\b)[^\s]+/gi, '[REDACTED_URL]');
  return text.slice(0, 240);
}

export function redactSensitive(value, depth = 0) {
  if (depth > 6) return '[TRUNCATED]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactSensitive(item, depth + 1));
  if (typeof value !== 'object') return String(value);

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue;
    result[key] = redactSensitive(child, depth + 1);
  }
  return result;
}

function safeObservedAt(value, warnings) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return value;
  }
  warnings.push('observed_at_missing_or_invalid');
  return null;
}

function safeSources(values, warnings) {
  const sources = Array.isArray(values) ? values.filter((value) => ALLOWED_SOURCES.has(value)) : [];
  if (Array.isArray(values) && sources.length !== values.length) warnings.push('unknown_source_omitted');
  return [...new Set(sources)];
}

function safeEntries(values) {
  if (!Array.isArray(values)) return [];
  return redactSensitive(values.slice(0, 8));
}

function replySummary(command) {
  const summaries = {
    help: '可用只读指令：帮助、总览、资料、策略、发布包、扫码、复盘、状态。',
    overview: '已解析为控制台总览只读查询。',
    materials: '已解析为资料库只读查询。',
    strategies: '已解析为策略库只读查询。',
    packages: '已解析为发布任务包只读查询。',
    scan: '已解析为扫码发布状态只读查询；不会生成二维码或登记发布。',
    reflections: '已解析为复盘中心只读查询；不会登记反馈或升级规则。',
    status: '已解析为本地控制台运行状态只读查询。',
    blocked_external_action: '该指令涉及写入或外部动作，本离线模块已阻断；未来接线必须经过用户确认门。',
    blocked_invalid_input: '输入已因安全校验失败而阻断，没有执行任何动作。'
  };
  return summaries[command] || summaries.help;
}

export function renderConsoleSafeReply(intent, readModel = {}) {
  const warnings = [
    ...(Array.isArray(intent?.warnings) ? intent.warnings : []),
    ...(Array.isArray(readModel?.warnings) ? readModel.warnings : [])
  ];
  const command = typeof intent?.command === 'string' ? intent.command : 'help';
  const consoleLink = isAllowedConsoleLink(intent?.route) ? intent.route : null;
  if (intent?.route && !consoleLink) warnings.push('non_whitelisted_console_link_omitted');

  return {
    schema_version: '1.0',
    summary: typeof readModel?.summary === 'string' && readModel.summary.trim()
      ? sanitizeString(readModel.summary)
      : replySummary(command),
    console_link: consoleLink,
    source_of_truth: safeSources(readModel?.source_of_truth, warnings),
    observed_at: safeObservedAt(readModel?.observed_at, warnings),
    warnings: safeEntries(warnings),
    conflicts: safeEntries(readModel?.conflicts)
  };
}

export const CONSOLE_READONLY_COMMANDS = Object.freeze({
  schema_version: '1.0',
  routes: ROUTES,
  max_input_length: MAX_INPUT_LENGTH,
  max_keyword_length: MAX_KEYWORD_LENGTH
});
