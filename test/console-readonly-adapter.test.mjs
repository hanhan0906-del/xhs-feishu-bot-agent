import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSOLE_READONLY_WIRED_DEFAULT,
  createConsoleReadonlyCommandAdapter
} from '../src/console-readonly-adapter.mjs';
import { loadBotConfig, parseBooleanFeatureFlag } from '../src/config.mjs';

const READ_COMMANDS = ['帮助', '总览', '资料', '策略', '发布包', '扫码', '复盘', '状态'];

test('feature flag 默认关闭且只接受显式真值', () => {
  assert.equal(CONSOLE_READONLY_WIRED_DEFAULT, false);
  assert.equal(loadBotConfig({}).consoleReadonlyCommandsEnabled, false);
  assert.equal(parseBooleanFeatureFlag('false'), false);
  assert.equal(parseBooleanFeatureFlag('0'), false);
  assert.equal(parseBooleanFeatureFlag('unexpected'), false);
  for (const value of ['1', 'true', 'TRUE', 'yes', 'on']) {
    assert.equal(parseBooleanFeatureFlag(value), true);
  }
});

test('默认关闭时原样委托旧处理器并保留参数', async () => {
  const calls = [];
  const legacyHandler = async (...args) => {
    calls.push(args);
    return 'legacy-result';
  };
  const routeCommand = createConsoleReadonlyCommandAdapter({ legacyHandler });
  const config = { marker: 'config' };
  const context = { openId: 'synthetic-open-id', chatId: 'synthetic-chat-id' };

  assert.equal(await routeCommand('确认同步飞书', config, context), 'legacy-result');
  assert.deepEqual(calls, [['确认同步飞书', config, context]]);
  assert.deepEqual(routeCommand.wiring, {
    wired: false,
    wired_default: false,
    provider_injected: false,
    external_calls_when_disabled: 0
  });
});

test('显式开启后 8 个只读指令走纯适配层且不调用旧执行器', async () => {
  let legacyCalls = 0;
  const routeCommand = createConsoleReadonlyCommandAdapter({
    enabled: true,
    legacyHandler: async () => {
      legacyCalls += 1;
      return 'must-not-run';
    }
  });

  for (const command of READ_COMMANDS) {
    const reply = await routeCommand(command, {}, {});
    assert.doesNotMatch(reply, /must-not-run/);
    assert.match(reply, /http:\/\/127\.0\.0\.1:5173\/#\//);
  }
  assert.equal(legacyCalls, 0);
  assert.deepEqual(routeCommand.wiring, {
    wired: true,
    wired_default: false,
    provider_injected: false,
    external_calls_when_disabled: 0
  });
});

test('显式开启后写命令失败关闭且不回落旧执行器', async () => {
  let legacyCalls = 0;
  const routeCommand = createConsoleReadonlyCommandAdapter({
    enabled: true,
    legacyHandler: async () => {
      legacyCalls += 1;
      return 'unsafe-legacy-result';
    }
  });

  const reply = await routeCommand('确认同步飞书', {}, {});
  assert.match(reply, /阻断/);
  assert.doesNotMatch(reply, /unsafe-legacy-result/);
  assert.equal(legacyCalls, 0);
});

test('显式开启后仍保留原有用户允许名单检查', async () => {
  let legacyCalls = 0;
  const routeCommand = createConsoleReadonlyCommandAdapter({
    enabled: true,
    legacyHandler: async () => {
      legacyCalls += 1;
      return 'must-not-run';
    },
    authorizationCheck: (config, openId) => config.allowedOpenIds.has(openId)
  });

  const reply = await routeCommand(
    '资料',
    { allowedOpenIds: new Set(['allowed-user']) },
    { openId: 'blocked-user' }
  );
  assert.match(reply, /不在允许名单/);
  assert.equal(legacyCalls, 0);
});

test('默认关闭时不会调用已注入的数据提供器', async () => {
  let providerCalls = 0;
  const routeCommand = createConsoleReadonlyCommandAdapter({
    legacyHandler: async () => 'legacy-result',
    readProvider: async () => {
      providerCalls += 1;
      return { summary: 'must-not-run' };
    }
  });

  assert.equal(await routeCommand('总览', {}, {}), 'legacy-result');
  assert.equal(providerCalls, 0);
  assert.deepEqual(routeCommand.wiring, {
    wired: false,
    wired_default: false,
    provider_injected: true,
    external_calls_when_disabled: 0
  });
});

test('数据提供器异常时安全降级且不回落旧执行器', async () => {
  let legacyCalls = 0;
  const routeCommand = createConsoleReadonlyCommandAdapter({
    enabled: true,
    legacyHandler: async () => {
      legacyCalls += 1;
      return 'unsafe-legacy-result';
    },
    readProvider: async () => {
      throw new Error('sensitive internal failure');
    }
  });

  const reply = await routeCommand('总览', {}, {});
  assert.match(reply, /API 暂不可用/);
  assert.match(reply, /http:\/\/127\.0\.0\.1:5173\/#\/overview/);
  assert.doesNotMatch(reply, /sensitive internal failure|unsafe-legacy-result/);
  assert.equal(legacyCalls, 0);
});
