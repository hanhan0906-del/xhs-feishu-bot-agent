import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HELP_TEXT = [
  '可用指令：',
  '状态',
  '扫描资料',
  '待发布',
  '审计批次 5 18',
  '确认同步飞书',
  '登记已发布',
  '',
  '安全边界：机器人不会自动发布小红书，也不会保存账号、Cookie、验证码或密钥。'
].join('\n');

export function parseIntent(text) {
  const raw = String(text || '').trim();
  const normalized = raw.replace(/\s+/g, ' ');
  if (!normalized) return { type: 'empty', raw };
  if (/^(帮助|help|\/help)$/i.test(normalized)) return { type: 'help', raw };
  if (/^(状态|status|\/status)$/i.test(normalized)) return { type: 'status', raw };
  if (/^(扫描资料|扫描|scan|\/scan)$/i.test(normalized)) return { type: 'scan', raw };
  if (/^(待发布|发布列表|pending|\/pending)$/i.test(normalized)) return { type: 'pending', raw };
  if (/^确认同步飞书$/i.test(normalized)) return { type: 'sync_feishu_confirmed', raw };
  if (/^(同步飞书|飞书同步)$/i.test(normalized)) return { type: 'sync_feishu_needs_confirm', raw };
  if (/^审计批次(?:\s+(\d+))?(?:\s+(\d+))?$/i.test(normalized)) {
    const match = normalized.match(/^审计批次(?:\s+(\d+))?(?:\s+(\d+))?$/i);
    return {
      type: 'audit_batch',
      raw,
      from: Number(match?.[1] || 1),
      to: Number(match?.[2] || match?.[1] || 999)
    };
  }
  if (/^登记已发布/.test(normalized)) return { type: 'register_publication_help', raw };
  if (/^(生成笔记|生成二维码|部署|发布笔记)/.test(normalized)) return { type: 'guarded_not_enabled', raw };
  return { type: 'unknown', raw };
}

export function isUserAllowed(config, openId) {
  if (!config.allowedOpenIds.size) return true;
  return config.allowedOpenIds.has(openId);
}

export async function handleCommand(text, config, context = {}) {
  if (!isUserAllowed(config, context.openId || '')) {
    return '这个飞书用户不在允许名单里。请把你的 open_id 加到 XHS_FEISHU_ALLOWED_OPEN_IDS 后再重启机器人。';
  }
  const intent = parseIntent(text);
  switch (intent.type) {
    case 'empty':
    case 'help':
      return HELP_TEXT;
    case 'status':
      return status(config);
    case 'scan':
      return scanMaterials(config);
    case 'pending':
      return listPendingPackages(config);
    case 'audit_batch':
      return auditBatch(config, intent.from, intent.to);
    case 'sync_feishu_needs_confirm':
      return '同步飞书会写入飞书 Base。请发送“确认同步飞书”再执行。';
    case 'sync_feishu_confirmed':
      return syncFeishu(config);
    case 'register_publication_help':
      return [
        '登记已发布需要人工确认最终发布结果，不能把打开编辑页当成发布成功。',
        '下一版会支持：登记已发布 <任务包路径> <小红书链接或笔记ID>。',
        '当前请先在 Codex 或本地脚本里登记，避免错记生命周期数据。'
      ].join('\n');
    case 'guarded_not_enabled':
      return '这类动作会生成内容、生成二维码、部署或影响外部平台，当前聊天入口先不直接执行。先用“状态”“扫描资料”“审计批次”“待发布”。';
    default:
      return `没识别这个指令：${intent.raw}\n\n${HELP_TEXT}`;
  }
}

async function status(config) {
  const result = await runNode(config.contentAgentRoot, ['scripts/inspect_agent_state.mjs'], config.commandTimeoutMs);
  const data = parseJson(result.stdout);
  if (!data) return compactOutput('状态检查完成，但输出不是 JSON：', result.stdout);
  const rows = [
    `数据库：${data.database}`,
    `资料状态：${countRows(data.materials)}`,
    `任务状态：${countRows(data.tasks)}`,
    `可领取任务：${Array.isArray(data.claimable) ? data.claimable.length : 0}`,
    `发布档案：${countRows(data.publish_archives)}`,
    `飞书连接：${Array.isArray(data.feishu_connections) ? data.feishu_connections.map(x => `${x.profile_name}/${x.status}`).join(', ') || '无' : '无'}`,
    `飞书 outbox：${countRows(data.feishu_outbox)}`
  ];
  return rows.join('\n');
}

async function scanMaterials(config) {
  const result = await runNode(config.contentAgentRoot, ['scripts/scan_materials.mjs'], config.commandTimeoutMs);
  return compactOutput('扫描完成：', result.stdout || result.stderr);
}

async function syncFeishu(config) {
  const result = await runNode(config.contentAgentRoot, ['scripts/feishu_sync.mjs', '--push'], config.commandTimeoutMs);
  return compactOutput('飞书同步完成：', result.stdout || result.stderr);
}

async function auditBatch(config, from, to) {
  const defaultRoot = path.join(config.publishTaskRoot, '01 一年级上册-扫码批量');
  const output = path.join(config.contentAgentRoot, 'reports', `feishu-bot-audit-${from}-${to}-${Date.now()}.json`);
  const args = ['scripts/audit_publish_copy.mjs', '--root', defaultRoot, '--from', String(from), '--to', String(to), '--output', output];
  const result = await runNode(config.contentAgentRoot, args, config.commandTimeoutMs, { allowFailure: true });
  const report = parseJsonFile(output);
  if (report) {
    const total = report.rows?.length ?? 0;
    const failures = report.failures?.length ?? 0;
    return [
      failures ? `审计未通过：${failures} 个问题，覆盖 ${total} 篇。` : `审计通过：覆盖 ${total} 篇。`,
      `报告：${output}`,
      ...summarizeAuditFailures(report.failures)
    ].join('\n');
  }
  return compactOutput('审计完成，但未读到报告：', result.stdout || result.stderr);
}

function listPendingPackages(config) {
  if (!fs.existsSync(config.publishTaskRoot)) return `发布任务目录不存在：${config.publishTaskRoot}`;
  const packages = [];
  walk(config.publishTaskRoot, file => {
    if (path.basename(file) !== 'publish.json') return;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.status === 'ready' || data.status === 'draft_saved') {
        packages.push({ title: data.title || path.basename(path.dirname(file)), status: data.status, dir: path.dirname(file) });
      }
    } catch {}
  });
  if (!packages.length) return '没有找到 ready 或 draft_saved 的 publish.json。';
  return packages.slice(0, 20).map((item, index) => `${index + 1}. [${item.status}] ${item.title}\n${item.dir}`).join('\n');
}

function runNode(cwd, args, timeoutMs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      windowsHide: true,
      shell: false,
      env: { ...process.env }
    });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeoutMs}ms: node ${args.join(' ')}`));
    }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      const result = { code, stdout, stderr };
      if (code !== 0 && !options.allowFailure) {
        const error = new Error(`Command failed with ${code}: node ${args.join(' ')}\n${stderr || stdout}`);
        error.result = result;
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function parseJson(value) {
  try { return JSON.parse(value); } catch { return null; }
}

function parseJsonFile(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function countRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return '无';
  return rows.map(row => `${row.status || row.archive_status || row.lifecycle_stage || row.mode || 'unknown'}=${row.count}`).join(', ');
}

function compactOutput(prefix, value) {
  const text = String(value || '').trim();
  if (!text) return prefix;
  return `${prefix}\n${text.length > 1800 ? text.slice(0, 1800) + '\n...[已截断]' : text}`;
}

function summarizeAuditFailures(failures = []) {
  return failures.slice(0, 8).map((failure, index) => {
    if (typeof failure === 'string') return `${index + 1}. ${failure}`;
    return `${index + 1}. ${failure.title || failure.package_dir || 'unknown'}：${failure.reason || JSON.stringify(failure)}`;
  });
}

function walk(root, visit) {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else visit(full);
    }
  }
}
