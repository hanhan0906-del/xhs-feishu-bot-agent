import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, isUserAllowed } from '../src/commands.mjs';

test('parse basic intents', () => {
  assert.equal(parseIntent('帮助').type, 'help');
  assert.equal(parseIntent('状态').type, 'status');
  assert.equal(parseIntent('扫描资料').type, 'scan');
  assert.equal(parseIntent('待发布').type, 'pending');
  assert.equal(parseIntent('同步飞书').type, 'sync_feishu_needs_confirm');
  assert.equal(parseIntent('确认同步飞书').type, 'sync_feishu_confirmed');
});

test('parse audit range', () => {
  assert.deepEqual(
    (({ type, from, to }) => ({ type, from, to }))(parseIntent('审计批次 5 18')),
    { type: 'audit_batch', from: 5, to: 18 }
  );
});

test('guard publishing and generation verbs', () => {
  assert.equal(parseIntent('发布笔记').type, 'guarded_not_enabled');
  assert.equal(parseIntent('生成二维码').type, 'guarded_not_enabled');
});

test('allowed open ids are optional but enforced when configured', () => {
  assert.equal(isUserAllowed({ allowedOpenIds: new Set() }, 'ou_1'), true);
  assert.equal(isUserAllowed({ allowedOpenIds: new Set(['ou_1']) }, 'ou_1'), true);
  assert.equal(isUserAllowed({ allowedOpenIds: new Set(['ou_1']) }, 'ou_2'), false);
});
