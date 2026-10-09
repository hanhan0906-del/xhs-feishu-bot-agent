import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConsoleReadonlyCommand } from '../src/console-readonly-commands.mjs';
import {
  CONSOLE_READONLY_PROVIDER_POLICY,
  buildConsoleReadonlyApiUrl,
  createConsoleReadonlyDataProvider
} from '../src/console-readonly-provider.mjs';

function jsonResponse(payload, options = {}) {
  const text = JSON.stringify(payload);
  return {
    ok: options.ok ?? true,
    headers: {
      get(name) {
        const key = String(name).toLowerCase();
        if (key === 'content-type') return options.contentType ?? 'application/json; charset=utf-8';
        if (key === 'content-length') return options.contentLength ?? String(new TextEncoder().encode(text).byteLength);
        return null;
      }
    },
    text: async () => text
  };
}

function envelope(data, overrides = {}) {
  return {
    schema_version: '0.1',
    observed_at: '2026-07-29T13:00:00+08:00',
    source_of_truth: ['sqlite'],
    warnings: [],
    conflicts: [],
    data,
    ...overrides
  };
}

test('七类数据指令只生成固定 127.0.0.1:4325 白名单 GET URL', () => {
  const expected = {
    总览: '/api/v1/overview',
    资料: '/api/v1/materials',
    策略: '/api/v1/strategies',
    发布包: '/api/v1/publish-packages',
    扫码: '/api/v1/scan-publish',
    复盘: '/api/v1/reflections',
    状态: '/api/v1/runtime'
  };

  for (const [command, pathname] of Object.entries(expected)) {
    const url = new URL(buildConsoleReadonlyApiUrl(parseConsoleReadonlyCommand(command)));
    assert.equal(url.origin, 'http://127.0.0.1:4325');
    assert.equal(url.pathname, pathname);
    assert.equal(url.username, '');
    assert.equal(url.password, '');
    assert.equal(url.hash, '');
  }
  assert.equal(buildConsoleReadonlyApiUrl(parseConsoleReadonlyCommand('帮助')), null);
  assert.deepEqual(Object.values(CONSOLE_READONLY_PROVIDER_POLICY.endpoints), Object.values(expected));
});

test('安全筛选只映射到服务端白名单参数', () => {
  const materials = new URL(buildConsoleReadonlyApiUrl(
    parseConsoleReadonlyCommand('资料 第2页 状态=已就绪 关键词 一年级')
  ));
  assert.deepEqual(
    [...materials.searchParams.entries()],
    [['page', '2'], ['page_size', '3'], ['state.material_status', 'ready']]
  );

  const packages = new URL(buildConsoleReadonlyApiUrl(
    parseConsoleReadonlyCommand('发布包 状态=阻断')
  ));
  assert.equal(packages.searchParams.get('audit_aggregate.status'), 'blocked');
  assert.equal(packages.searchParams.has('keyword'), false);
});

test('七类数据均由 mock fetch 生成字段白名单短摘要', async () => {
  const fixtures = new Map([
    ['/api/v1/overview', envelope(
      { counts: {
        materials: 7,
        strategy_references: 9,
        publish_packages: 4,
        audit_blocked: 2,
        scan_publish_entries: 3,
        scan_publish_conflicts: 1,
        secret: 'must-not-leak'
      } },
      {
        warnings: [{ reason_code: 'published_notes_empty', message: 'C:\\must-not-leak' }],
        conflicts: [{ issue: 'not_registered', message: 'token=must-not-leak' }]
      }
    )],
    ['/api/v1/materials', envelope({
      pagination: { page: 1, total: 1, total_pages: 1 },
      items: [{ display_name: '一年级资料', state: { material_status: 'ready' }, token: 'must-not-leak' }]
    })],
    ['/api/v1/strategies', envelope({
      pagination: { page: 1, total: 1, total_pages: 1 },
      items: [{ name: '标题策略', card_kind: 'title_formula', body: 'must-not-leak' }]
    }, { source_of_truth: ['obsidian'] })],
    ['/api/v1/publish-packages', envelope({
      pagination: { page: 1, total: 1, total_pages: 1 },
      items: [{
        title: '发布包 A',
        publish_state: 'ready',
        audit_aggregate: { status: 'blocked' },
        body: 'must-not-leak'
      }]
    }, { source_of_truth: ['publish_json', 'source_trace'] })],
    ['/api/v1/scan-publish', envelope({
      pagination: { page: 1, total: 1, total_pages: 1 },
      items: [{
        title: '扫码 A',
        lifecycle: { status: 'link_available' },
        conflicts: [{ issue: 'not_registered' }],
        qr_image_data_url: 'data:image/png;base64,bXVzdC1ub3QtbGVhaw=='
      }]
    }, { source_of_truth: ['scan_links_md', 'scan_sqlite'] })],
    ['/api/v1/reflections', envelope({
      pagination: { page: 1, total: 0, total_pages: 0 },
      items: [],
      summary: { category_counts: {
        feedback: 1,
        metrics: 2,
        observations: 3,
        candidate_rules: 4,
        pending_confirmation: 5,
        verified_rules: 6
      } }
    })],
    ['/api/v1/runtime', envelope({
      handoffs: { console: true, scanAgent: true, feishuAgent: false },
      services: [{ port: 4317, status: 200 }, { port: 4319, status: 'unavailable' }],
      logs: { sensitive_path: 'must-not-leak' }
    }, { source_of_truth: ['runtime'] })]
  ]);
  const requests = [];
  const provider = createConsoleReadonlyDataProvider({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      const payload = fixtures.get(new URL(url).pathname);
      assert.ok(payload);
      return jsonResponse(payload);
    }
  });

  const results = {};
  for (const command of ['总览', '资料', '策略', '发布包', '扫码', '复盘', '状态']) {
    const intent = parseConsoleReadonlyCommand(command);
    results[intent.command] = await provider(intent);
  }

  assert.match(results.overview.summary, /资料 7.*发布包 4/);
  assert.deepEqual(results.overview.warnings, ['published_notes_empty']);
  assert.deepEqual(results.overview.conflicts, [{ reason_code: 'not_registered' }]);
  assert.match(results.materials.summary, /一年级资料.*ready/);
  assert.match(results.strategies.summary, /标题策略.*title_formula/);
  assert.match(results.packages.summary, /发布包 A.*ready\/blocked/);
  assert.match(results.scan.summary, /扫码 A.*link_available.*冲突 1/);
  assert.match(results.reflections.summary, /反馈 1.*已验证 6/);
  assert.match(results.status.summary, /4317=200.*4319=unavailable/);
  assert.doesNotMatch(JSON.stringify(results), /must-not-leak|bXVzdC1ub3QtbGVhaw/);

  assert.equal(requests.length, 7);
  for (const request of requests) {
    assert.equal(request.options.method, 'GET');
    assert.equal(request.options.redirect, 'error');
    assert.equal(request.options.credentials, 'omit');
    assert.equal(request.options.cache, 'no-store');
    assert.equal(request.options.headers.accept, 'application/json');
    assert.equal(new URL(request.url).origin, 'http://127.0.0.1:4325');
  }
});

test('关键词或不支持的状态不会伪装成已应用筛选', async () => {
  const provider = createConsoleReadonlyDataProvider({
    fetchImpl: async () => jsonResponse(envelope({
      pagination: { page: 1, total: 0, total_pages: 0 },
      items: []
    }, { source_of_truth: ['obsidian'] }))
  });
  const result = await provider(parseConsoleReadonlyCommand('策略 关键词 职场 状态=已验证'));
  assert.ok(result.warnings.includes('keyword_filter_not_supported_by_console_api'));
  assert.ok(result.warnings.includes('status_filter_not_supported_by_console_api'));
});

test('超时、超大响应和 API 错误只返回安全降级模型', async () => {
  const timeoutProvider = createConsoleReadonlyDataProvider({
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    })
  });
  const timeoutResult = await timeoutProvider(parseConsoleReadonlyCommand('总览'));
  assert.match(timeoutResult.summary, /API 暂不可用/);
  assert.ok(timeoutResult.warnings.includes('console_api_timeout'));

  const largeProvider = createConsoleReadonlyDataProvider({
    maxResponseBytes: 1024,
    fetchImpl: async () => jsonResponse(envelope({}), { contentLength: '2048' })
  });
  const largeResult = await largeProvider(parseConsoleReadonlyCommand('总览'));
  assert.ok(largeResult.warnings.includes('console_api_response_too_large'));

  const errorProvider = createConsoleReadonlyDataProvider({
    fetchImpl: async () => {
      throw new Error('token=must-not-leak internal path C:\\secret');
    }
  });
  const errorResult = await errorProvider(parseConsoleReadonlyCommand('总览'));
  assert.match(errorResult.summary, /API 暂不可用/);
  assert.doesNotMatch(JSON.stringify(errorResult), /must-not-leak|C:\\secret/);
});
