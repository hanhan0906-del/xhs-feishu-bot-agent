import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSOLE_READONLY_COMMANDS,
  isAllowedConsoleLink,
  parseConsoleReadonlyCommand,
  redactSensitive,
  renderConsoleSafeReply
} from '../src/console-readonly-commands.mjs';

const READ_COMMANDS = [
  ['帮助', 'help', '#/overview'],
  ['总览', 'overview', '#/overview'],
  ['资料', 'materials', '#/materials'],
  ['策略库', 'strategies', '#/strategies'],
  ['发布任务包', 'packages', '#/packages'],
  ['扫码', 'scan', '#/scan'],
  ['复盘中心', 'reflections', '#/reflections'],
  ['运行状态', 'status', '#/overview']
];

test('8 个只读命令及同义词路由到本地白名单', () => {
  for (const [text, command, suffix] of READ_COMMANDS) {
    const intent = parseConsoleReadonlyCommand(text);
    assert.equal(intent.command, command);
    assert.equal(intent.permission, 'read_only');
    assert.equal(intent.requires_confirmation, false);
    assert.ok(intent.route.endsWith(suffix));
    assert.equal(isAllowedConsoleLink(intent.route), true);
  }
});

test('安全页码、关键词和状态参数被规范化', () => {
  assert.deepEqual(
    parseConsoleReadonlyCommand('资料 页码 2 关键词 一年级语文 状态 已就绪').filters,
    { page: 2, keyword: '一年级语文', status: 'ready' }
  );
  assert.deepEqual(
    parseConsoleReadonlyCommand('发布包 第3页 状态=阻断').filters,
    { page: 3, status: 'blocked' }
  );
});

test('所有写命令统一阻断且不会请求当前模块确认', () => {
  const writes = [
    '生成笔记',
    '改写 任务包',
    '保存草稿',
    '保存 草稿',
    '发布',
    '发布笔记',
    '确认发布',
    '确认 发布',
    '登记反馈',
    '登记 反馈',
    '升级规则',
    '同步飞书',
    '迁移策略'
  ];
  for (const text of writes) {
    const intent = parseConsoleReadonlyCommand(text);
    assert.equal(intent.command, 'blocked_external_action');
    assert.equal(intent.route, null);
    assert.equal(intent.requires_confirmation, false);
    assert.ok(intent.warnings.includes('write_or_external_action_blocked_confirmation_gate_required'));
  }
});

test('旧扫描和审计执行命令也失败关闭', () => {
  assert.equal(parseConsoleReadonlyCommand('扫描资料').command, 'blocked_external_action');
  assert.equal(parseConsoleReadonlyCommand('审计批次 5 18').command, 'blocked_external_action');
});

test('路径穿越、绝对路径和用户 URL 被阻断', () => {
  assert.equal(parseConsoleReadonlyCommand('资料 关键词 ../secret').command, 'blocked_invalid_input');
  assert.equal(parseConsoleReadonlyCommand('资料 关键词 C:\\temp').command, 'blocked_invalid_input');
  assert.equal(parseConsoleReadonlyCommand('策略 https://example.test/a').command, 'blocked_invalid_input');
});

test('超长输入被阻断且回显有上限', () => {
  const intent = parseConsoleReadonlyCommand(`资料 ${'很'.repeat(300)}`);
  assert.equal(intent.command, 'blocked_invalid_input');
  assert.ok(intent.source_text_redacted.length <= 160);
});

test('未知命令返回帮助而不进入执行状态', () => {
  const intent = parseConsoleReadonlyCommand('看看今天有什么');
  assert.equal(intent.command, 'help');
  assert.ok(intent.warnings.includes('unknown_command_returned_help'));
  assert.equal(intent.permission, 'read_only');
});

test('精确脱敏保留 reason_code 与 error.code', () => {
  const result = redactSensitive({
    reason_code: 'scope_mismatch',
    error: { code: 'INVALID_QUERY', message: 'bad' },
    token: 'test-token-not-real',
    app_secret: 'test-secret-not-real',
    cookie: 'test-cookie-not-real',
    verification_code: '000000',
    oauth_code: 'oauth-test',
    account: 'account-test',
    open_id: 'ou_test',
    nested: { claim_stage: 'raw_observation' }
  });
  assert.equal(result.reason_code, 'scope_mismatch');
  assert.equal(result.error.code, 'INVALID_QUERY');
  assert.equal(result.nested.claim_stage, 'raw_observation');
  for (const key of ['token', 'app_secret', 'cookie', 'verification_code', 'oauth_code', 'account', 'open_id']) {
    assert.equal(Object.hasOwn(result, key), false);
  }
});

test('source_text_redacted 删除键值式敏感串', () => {
  const intent = parseConsoleReadonlyCommand('状态 token=test-token open_id=ou_test');
  assert.doesNotMatch(intent.source_text_redacted, /test-token|ou_test/);
  assert.match(intent.source_text_redacted, /\[REDACTED\]/);
});

test('SafeReply 仅返回短摘要、白名单链接和安全元数据', () => {
  const intent = parseConsoleReadonlyCommand('扫码 第1页');
  const reply = renderConsoleSafeReply(intent, {
    source_of_truth: ['scan_sqlite', 'sqlite'],
    observed_at: '2026-07-29T12:00:00+08:00',
    warnings: ['二维码 data:image/png;base64,ZmFrZQ== 已隐藏'],
    conflicts: [{ reason_code: 'not_registered', open_id: 'ou_test', token: 'test-token' }],
    qr_image_data_url: 'data:image/png;base64,ZmFrZQ==',
    packages: [{ title: '不应进入回复的任务包全文' }]
  });
  assert.equal(reply.schema_version, '1.0');
  assert.equal(reply.console_link, 'http://127.0.0.1:5173/#/scan');
  assert.deepEqual(reply.source_of_truth, ['scan_sqlite', 'sqlite']);
  assert.equal(reply.conflicts[0].reason_code, 'not_registered');
  assert.equal(Object.hasOwn(reply.conflicts[0], 'open_id'), false);
  assert.doesNotMatch(JSON.stringify(reply), /ZmFrZQ|ou_test|test-token|任务包全文/);
});

test('非白名单链接不会进入 SafeReply', () => {
  const reply = renderConsoleSafeReply({
    command: 'materials',
    route: 'http://127.0.0.1:5173/#/admin',
    warnings: []
  }, { observed_at: '2026-07-29T12:00:00+08:00' });
  assert.equal(reply.console_link, null);
  assert.ok(reply.warnings.includes('non_whitelisted_console_link_omitted'));
});

test('导出的命令目录本身仅含固定本地路由', () => {
  for (const route of Object.values(CONSOLE_READONLY_COMMANDS.routes)) {
    assert.equal(isAllowedConsoleLink(route), true);
    assert.match(route, /^http:\/\/127\.0\.0\.1:5173\/#\/(?:overview|materials|strategies|packages|scan|reflections)$/);
  }
});
