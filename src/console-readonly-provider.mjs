import { redactSensitive } from './console-readonly-commands.mjs';

const API_ORIGIN = 'http://127.0.0.1:4325';
const DEFAULT_TIMEOUT_MS = 1200;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;
const SUMMARY_ITEM_LIMIT = 3;

const ENDPOINTS = Object.freeze({
  overview: '/api/v1/overview',
  materials: '/api/v1/materials',
  strategies: '/api/v1/strategies',
  packages: '/api/v1/publish-packages',
  scan: '/api/v1/scan-publish',
  reflections: '/api/v1/reflections',
  status: '/api/v1/runtime'
});

const LIST_COMMANDS = new Set(['materials', 'strategies', 'packages', 'scan', 'reflections']);
const AUDIT_STATUSES = new Set(['pass', 'warn', 'blocked', 'needs_review', 'not_observed']);

function safeText(value, maxLength = 56) {
  const sanitized = redactSensitive(String(value ?? ''));
  return String(sanitized || '')
    .replace(/[a-z]:[\\/][^\s]+|\\\\[^\s]+/gi, '[REDACTED_PATH]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function statusQuery(command, status) {
  if (!status) return null;
  if (command === 'materials') return ['state.material_status', status];
  if (command === 'packages') {
    return [AUDIT_STATUSES.has(status) ? 'audit_aggregate.status' : 'publish_state', status];
  }
  if (command === 'scan') return ['lifecycle.status', status];
  if (command === 'reflections') return ['claim_stage', status];
  return null;
}

export function buildConsoleReadonlyApiUrl(intent) {
  const pathname = ENDPOINTS[intent?.command];
  if (!pathname) return null;

  const url = new URL(pathname, API_ORIGIN);
  if (url.origin !== API_ORIGIN || url.pathname !== pathname || url.username || url.password || url.hash) {
    throw new Error('console_api_route_not_allowed');
  }

  const filters = intent?.filters && typeof intent.filters === 'object' ? intent.filters : {};
  if (LIST_COMMANDS.has(intent.command)) {
    url.searchParams.set('page', String(filters.page || 1));
    url.searchParams.set('page_size', String(SUMMARY_ITEM_LIMIT));
  }
  const mappedStatus = statusQuery(intent.command, filters.status);
  if (mappedStatus) url.searchParams.set(mappedStatus[0], mappedStatus[1]);
  return url.toString();
}

async function readBoundedBody(response, maxBytes) {
  const declaredLength = Number(response?.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error('console_api_response_too_large');
  }

  if (response?.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('console_api_response_too_large');
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  }

  const text = String(await response.text());
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new Error('console_api_response_too_large');
  }
  return text;
}

function itemLines(items, select) {
  return (Array.isArray(items) ? items : [])
    .slice(0, SUMMARY_ITEM_LIMIT)
    .map((item, index) => `${index + 1}. ${select(item)}`)
    .filter((line) => line.length > 3);
}

function listHeader(label, data) {
  const pagination = data?.pagination || {};
  return `${label}：共 ${safeNumber(pagination.total)} 条，第 ${safeNumber(pagination.page) || 1}/${safeNumber(pagination.total_pages) || 1} 页`;
}

function summarize(command, data) {
  if (command === 'overview') {
    const counts = data?.counts || {};
    return [
      `总览：资料 ${safeNumber(counts.materials)}，策略引用 ${safeNumber(counts.strategy_references)}，发布包 ${safeNumber(counts.publish_packages)}`,
      `审计阻断 ${safeNumber(counts.audit_blocked)}，扫码入口 ${safeNumber(counts.scan_publish_entries)}，扫码冲突 ${safeNumber(counts.scan_publish_conflicts)}`
    ].join('\n');
  }

  if (command === 'materials') {
    return [
      listHeader('资料', data),
      ...itemLines(data?.items, (item) => `${safeText(item?.display_name) || '未命名'} [${safeText(item?.state?.material_status) || 'unknown'}]`)
    ].join('\n');
  }

  if (command === 'strategies') {
    return [
      listHeader('策略', data),
      ...itemLines(data?.items, (item) => `${safeText(item?.name) || '未命名'} [${safeText(item?.card_kind) || 'unknown'}]`)
    ].join('\n');
  }

  if (command === 'packages') {
    return [
      listHeader('发布包', data),
      ...itemLines(data?.items, (item) => `${safeText(item?.title) || '未命名'} [${safeText(item?.publish_state) || 'unknown'}/${safeText(item?.audit_aggregate?.status) || 'unknown'}]`)
    ].join('\n');
  }

  if (command === 'scan') {
    return [
      listHeader('扫码', data),
      ...itemLines(data?.items, (item) => `${safeText(item?.title) || '未命名'} [${safeText(item?.lifecycle?.status) || 'unknown'}] 冲突 ${safeNumber(item?.conflicts?.length)}`)
    ].join('\n');
  }

  if (command === 'reflections') {
    const counts = data?.summary?.category_counts || {};
    return [
      listHeader('复盘', data),
      `反馈 ${safeNumber(counts.feedback)}，指标 ${safeNumber(counts.metrics)}，观察 ${safeNumber(counts.observations)}，候选规则 ${safeNumber(counts.candidate_rules)}，待确认 ${safeNumber(counts.pending_confirmation)}，已验证 ${safeNumber(counts.verified_rules)}`
    ].join('\n');
  }

  if (command === 'status') {
    const services = Array.isArray(data?.services) ? data.services.slice(0, 4) : [];
    const handoffs = data?.handoffs && typeof data.handoffs === 'object' ? data.handoffs : {};
    const serviceLine = services.length
      ? services.map((service) => `${safeNumber(service?.port)}=${safeText(service?.status) || 'unknown'}`).join('，')
      : '无可用服务状态';
    const handoffCount = Object.values(handoffs).filter((value) => value === true).length;
    return `状态：${serviceLine}\n交接文件可用 ${handoffCount}/${Object.keys(handoffs).length}`;
  }

  return '控制台只读数据已返回。';
}

function safeReasonCode(value, fallback) {
  const candidate = typeof value === 'string'
    ? value
    : value?.reason_code || value?.code || value?.issue;
  return typeof candidate === 'string' && /^[a-z0-9_:-]{1,64}$/i.test(candidate)
    ? candidate
    : fallback;
}

function safeWarnings(intent, envelope) {
  const warnings = (Array.isArray(envelope?.warnings) ? envelope.warnings : [])
    .slice(0, 8)
    .map((warning) => safeReasonCode(warning, 'console_api_warning'));
  if (intent?.filters?.keyword) warnings.push('keyword_filter_not_supported_by_console_api');
  if (intent?.filters?.status && !statusQuery(intent.command, intent.filters.status)) {
    warnings.push('status_filter_not_supported_by_console_api');
  }
  return [...new Set(warnings)];
}

function safeConflicts(envelope) {
  return (Array.isArray(envelope?.conflicts) ? envelope.conflicts : [])
    .slice(0, 8)
    .map((conflict) => ({
      reason_code: safeReasonCode(conflict, 'console_api_conflict')
    }));
}

function unavailableReadModel(reasonCode = 'console_readonly_api_unavailable') {
  return {
    summary: '控制台只读 API 暂不可用，未执行其他操作。',
    source_of_truth: [],
    observed_at: null,
    warnings: [reasonCode],
    conflicts: []
  };
}

export function createConsoleReadonlyDataProvider({
  fetchImpl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) {
    throw new RangeError('timeoutMs must be between 1 and 5000');
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1024 || maxResponseBytes > 256 * 1024) {
    throw new RangeError('maxResponseBytes must be between 1024 and 262144');
  }

  return async function provideConsoleReadonlyData(intent) {
    const url = buildConsoleReadonlyApiUrl(intent);
    if (!url) return unavailableReadModel('console_readonly_api_route_not_allowed');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response?.ok) throw new Error('console_api_http_error');
      const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) throw new Error('console_api_content_type_invalid');

      const text = await readBoundedBody(response, maxResponseBytes);
      const envelope = JSON.parse(text);
      if (!envelope || typeof envelope !== 'object' || !envelope.data || typeof envelope.data !== 'object') {
        throw new Error('console_api_envelope_invalid');
      }
      return {
        summary: summarize(intent.command, envelope.data),
        source_of_truth: Array.isArray(envelope.source_of_truth) ? envelope.source_of_truth : [],
        observed_at: envelope.observed_at,
        warnings: safeWarnings(intent, envelope),
        conflicts: safeConflicts(envelope)
      };
    } catch (error) {
      const reasonCode = error?.message === 'console_api_response_too_large'
        ? 'console_api_response_too_large'
        : error?.name === 'AbortError'
          ? 'console_api_timeout'
          : 'console_readonly_api_unavailable';
      return unavailableReadModel(reasonCode);
    } finally {
      clearTimeout(timer);
    }
  };
}

export const CONSOLE_READONLY_PROVIDER_POLICY = Object.freeze({
  api_origin: API_ORIGIN,
  endpoints: ENDPOINTS,
  method: 'GET',
  timeout_ms: DEFAULT_TIMEOUT_MS,
  max_response_bytes: DEFAULT_MAX_RESPONSE_BYTES,
  summary_item_limit: SUMMARY_ITEM_LIMIT
});
