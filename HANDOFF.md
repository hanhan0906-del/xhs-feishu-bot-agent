# 小红书飞书机器人 Agent 交接

最后更新时间：2026-07-29 13:21 Asia/Shanghai

## 项目目标与边界

目标：为已有小红书内容实验 Agent 和手机扫码发布 Agent 增加飞书聊天机器人窗口，让用户在飞书里发送指令并接收状态、审计、待发布和扫码发布相关结果。

边界：

- 不自动发布小红书。
- 不保存小红书账号、Cookie、验证码或密钥。
- 不替代 SQLite 事实库。
- 不覆盖现有飞书 Base 同步，只补聊天入口。
- 涉及飞书应用创建、权限开通、长连接启用、线上部署或批量生成的动作必须人工确认。

## 已完成

- 建立项目目录：`C:\Users\Lenovo\Desktop\Codex Agent合集\小红书飞书机器人Agent`
- 确认现有内容 Agent 只有飞书 Base 同步和反馈回写，没有聊天机器人消息入口。
- 选型：飞书长连接机器人，避免公网 webhook、内网穿透和公网回调域名。
- 新增本地机器人代码骨架：
  - `src/feishu-bot.mjs`
  - `src/commands.mjs`
  - `src/config.mjs`
- 新增飞书应用注册辅助脚本：
  - `scripts/register-feishu-bot-app.mjs`
- 新增 Windows 登录启动任务模板：
  - `scripts/windows/start-feishu-bot.ps1`
  - `scripts/windows/install-logon-task.ps1`
- 新增指令说明：
  - `docs/COMMANDS.md`
- 已运行 `npm install`，依赖审计 0 个漏洞。
- 已运行 `npm test`，4/4 通过。
- 已运行语法检查：
  - `node --check src/feishu-bot.mjs`
  - `node --check src/commands.mjs`
  - `node --check scripts/register-feishu-bot-app.mjs`
- 已用本地直接调用验证机器人指令处理器能接通现有 Agent：
  - `状态`：成功读取 `C:\Users\Lenovo\Desktop\小红书Agent数据\xhs_content.sqlite`，显示飞书连接 `xhs-content-agent/ready`。
  - `待发布`：成功列出本地 ready/draft_saved 发布任务包。
  - `审计批次 5 18`：成功调用内容 Agent 审计脚本，按预期返回 05-18 正文/标签审计失败，报告写入 `C:\Users\Lenovo\Desktop\小红书相关的skill\xhs-content-experiment-agent\reports\feishu-bot-audit-5-18-*.json`。

## 当前状态

- 已通过飞书授权创建机器人应用，App ID：`cli_aaecaf4bacb9dbc6`。
- 已在本地 `.env` 保存 `XHS_FEISHU_APP_ID` 和 `XHS_FEISHU_APP_SECRET`；不得把 `.env` 内容复制到聊天或文档。
- 已启动飞书长连接机器人，当前 node 进程 PID：`61120`。
- 启动日志：`logs\bot-20260726-220303.out.log`；错误日志：`logs\bot-20260726-220303.err.log`。
- 日志显示 `ws client ready`，长连接已就绪。
- 尚未安装 Windows 登录启动任务。
- 尚未完成用户在飞书聊天窗口发送 `帮助`/`状态` 的真机验收。

## 尚未完成

1. 用户在飞书里向机器人 `XHS Ops Bot` 发送 `帮助`、`状态`、`待发布` 做真实验收。
2. 如果飞书收不到回复，检查应用是否可见、是否已添加机器人、事件订阅是否包含 `im.message.receive_v1`、权限是否包含 `im:message:send_as_bot`。
3. 验收通过后再决定是否安装登录自启动任务。
4. 后续再把 `生成笔记`、`生成二维码` 做成确认卡片式受控指令。

## 新 Codex 接手后的前三步

1. 读取 `C:\Users\Lenovo\AGENTS.md`、本文件和 `C:\Users\Lenovo\Desktop\小红书相关的skill\xhs-content-experiment-agent\SKILL.md`。
2. 只读检查本项目文件、现有计划任务、飞书 Base 同步状态和两个小红书 Agent 的 `HANDOFF.md`。
3. 运行本地测试；在用户确认后，协助创建或配置飞书应用并启动长连接机器人。

## 禁止事项

- 不得自动点击或触发小红书发布。
- 不得把打开二维码、预览页或编辑页记为发布成功。
- 不得把 App Secret、Cookie、验证码或访问令牌写入文档或聊天。
- 不得未经确认安装登录自启动任务。
- 不得未经确认执行线上部署、批量生成、图片上传或外部 API 写入。

---

## 2026-07-27 16:08 Asia/Shanghai 状态更新

### 已验证

- 用户在飞书 `XHS Ops Bot` 里发送 `帮助` 后未收到回复。
- 本地机器人进程已重启，当前长连接日志显示 `ws client ready` 和 `state: connected`，但没有收到 `im.message.receive_v1` 事件。
- SDK 文档和本地类型定义确认：长连接收消息需要飞书应用事件订阅模式为 `websocket`，应用配置接口为 `application.v7.applicationConfig.patch`，字段为 `event.subscription_type = websocket` 和 `event.add_events = ['im.message.receive_v1']`。
- 已新增脚本：`scripts/configure-feishu-events.mjs`、`scripts/authorize-feishu-config-scope.mjs`。
- 已新增 `package.json` 命令：`authorize:config`、`configure:events`。
- `node --check scripts/authorize-feishu-config-scope.mjs` 通过。
- `node --check scripts/configure-feishu-events.mjs` 通过。
- `npm test` 通过 4/4。

### 当前阻塞

- 执行 `npm run configure:events` 被飞书拒绝，错误码 `99991672`，原因是应用尚未开通 `application:application:patch` 应用身份权限。
- 已启动 `npm run authorize:config` 增量授权流程，日志文件：
  - `logs/authorize-config-20260727-155947.out.log`
  - `logs/authorize-config-20260727-155947.err.log`
- 授权流程仍在 `polling`，等待用户在飞书授权页确认。授权链接是短生命周期链接，不写入本文档。

### 下一步

1. 用户完成飞书授权页确认后，检查 `logs/authorize-config-20260727-155947.out.log` 是否出现授权完成。
2. 重新执行 `npm run configure:events`。
3. 如配置成功，重启 `npm start` 机器人进程，再让用户在飞书 `XHS Ops Bot` 发送 `帮助` 验收。
4. 若飞书仍无事件，进入开发者后台检查应用是否已发布、事件订阅是否包含 `im.message.receive_v1`、机器人是否对当前用户可见。

### 注意

- 不得把 `.env`、App Secret、访问令牌、Cookie 或验证码写入聊天或文档。
- 不得把飞书消息送达、扫码预览页打开或小红书编辑页打开记为发布成功。
- 不得触发小红书自动发布。

---

## 2026-07-27 17:22 Asia/Shanghai 飞书消息事件阻塞更新

### 已验证

- 用户已完成 `application:application:patch` 配置权限授权。
- 已执行 `npm run configure:events` 成功，飞书返回 `code: 0`。
- 已执行 `npm run publish:app` 成功，最新已发布版本到 `1.0.4`，版本 ID `oav_5927215f3c2619a99ba49309abe67989`。
- 用户已完成消息接收权限增量授权，`logs/authorize-messages-20260727-170147.out.log` 显示 `Feishu message scopes authorization completed.`
- 已补加权限：`im:message:send_as_bot`、`im:message.p2p_msg:readonly`、`im:message.group_at_msg:readonly`。
- 主机器人长连接能稳定连接，日志显示 `ws client ready` 和 `state: connected`。
- 已做 SDK Channel 高层入口对照实验：`scripts/probe-feishu-channel.mjs`，日志 `logs/probe-channel-20260727-171810.out.log` 显示 `connected`，等待 120 秒后 `received:false`。
- Channel 对照实验也收不到消息，说明问题不在本地底层 `EventDispatcher` 写法，卡点在飞书平台没有向该应用推送 `im.message.receive_v1`。
- 当前主机器人已恢复启动，进程待实时核验，最新启动日志为 `logs/bot-20260727-172132.out.log`。

### 当前判断

- 不建议继续让用户重复点授权链接；授权动作已经完成多次。
- 下一步应进入飞书开发者后台人工核验：
  1. 事件与回调：订阅方式是否为“使用长连接接收事件/回调”。
  2. 事件订阅列表：是否实际包含 `im.message.receive_v1`。
  3. 权限管理：是否实际开通并生效 `im:message.p2p_msg:readonly`、`im:message.group_at_msg:readonly`、`im:message:send_as_bot`。
  4. 版本管理/发布管理：`1.0.4` 是否已上线，而不是待审核、待发布或仅创建版本。
  5. 应用能力：机器人能力是否启用，且当前用户/企业可见。

### 注意

- 不要再把“授权成功”误判为“消息事件已生效”；必须以本地日志出现 `event im.message.receive_v1` 为验收标准。
- 不要触发小红书自动发布。
- 不要输出 `.env`、App Secret、访问令牌、Cookie 或验证码。

---

## 2026-07-27 20:12 Asia/Shanghai 飞书后台只读核验

### 后台核验结果

- 已通过 Chrome 打开飞书开发者后台 `XHS Ops Bot`，应用 ID `cli_aaecaf4bacb9dbc6`。
- `凭证与基础信息` 页面显示：
  - 应用为 `已启用`。
  - 应用类型为正式应用。
  - 页面提示 `当前修改均已发布`。
- `事件与回调` 页面显示：
  - 事件订阅方式为 `使用长连接接收事件`。
  - 已添加事件 `接收消息 v2.0 / im.message.receive_v1`。
  - 事件订阅类型为 `应用身份`。
  - 所需权限里 `读取用户发给机器人的单聊消息` 显示 `已开通`。
  - 所需权限里 `获取群组中用户@机器人消息` 显示 `已开通`。
- `机器人` 页面显示：
  - 机器人能力存在且应用仍为 `已启用`。
  - 页面提示需要在权限管理开通收发消息权限，该权限已在事件页和权限页核验。
- `权限管理` 页面显示：
  - `im:message.group_at_msg:readonly` 已开通。
  - `im:message.p2p_msg:readonly` 已开通。
  - `im:message:send_as_bot` 已开通。
- `版本管理与发布` 页面显示：
  - `1.0.4` 版本状态为 `已发布`。
  - 页面提示 `当前修改均已发布`。

### 更新判断

- 飞书后台的事件订阅、权限、机器人能力和版本发布状态均显示正常。
- 本地长连接仍未收到 `im.message.receive_v1`，说明卡点不再是“后台未配置/未授权/未发布”。
- 下一步应优先检查：
  1. 用户是否在真正的“机器人会话”里发消息，而不是飞书 `智能体`/AI 助手入口或另一个同名会话入口。
  2. 飞书后台 `事件与回调` 页面是否有“验证连接状态”按钮或平台侧投递日志；浏览器控制在查该区域时因页面加载慢重置，待继续核验。
  3. 飞书 `日志检索` 中是否有用户发 `帮助` 后的事件投递记录、错误码或过滤条件。
  4. 若后台日志没有任何事件，重新用“添加机器人到群并 @ 机器人”的群聊方式验收 `im:message.group_at_msg:readonly` 路径。

### 注意

- 不要继续重复要求用户授权；授权、权限和发布状态已被后台页面核验。
- 下一轮验收标准仍是本地日志出现 `event im.message.receive_v1`。

---

## 2026-07-28 12:08 Asia/Shanghai 飞书机器人真机消息验收通过

### 已验证结果

- 用户在飞书 `XHS Ops Bot` 会话里发送 `帮助` 后，机器人已返回 `Received. Processing now.` 和指令菜单。
- 本地长连接日志 `logs\bot-20260727-172132.out.log` 已出现 `event im.message.receive_v1`，消息类型为 `text`。
- 本地机器人进程仍在运行：`cmd.exe` PID `41084`，`node.exe` PID `62980`，命令为 `node --env-file=.env src/feishu-bot.mjs`。
- 这说明飞书应用授权、事件订阅、长连接接收、消息解析和机器人回复链路已经打通。

### 当前判断

- 不需要继续重复授权。
- 飞书机器人入口已经可以作为本地小红书内容 Agent 与扫码发布 Agent 的聊天窗口。
- 仍不得把飞书回复、扫码预览页打开或小红书编辑页打开记为小红书发布成功；发布成功只能由用户实际发布后登记。

### 下一步

1. 继续用飞书会话验收 `状态`、`待发布`、`扫描资料`、`审计批次 5 18` 等指令。
2. 验收通过后，再决定是否安装 Windows 登录自启动任务。
3. 后续再把“生成笔记”“生成二维码批次”“登记已发布”等流程做成更明确的受控指令或确认卡片。

---

## 2026-07-29 12:50 Asia/Shanghai 控制台只读指令默认关闭接线准备

### 本阶段目标与边界

- 将“帮助、总览、资料、策略、发布包、扫码、复盘、状态”8 个控制台只读指令以 feature flag 和纯适配层方式接近机器人主消息入口。
- 默认运行行为必须不变；不得重启机器人、发送飞书消息、调用真实飞书 API/WebSocket、读取或修改 `.env`、密钥和账号配置。
- 本阶段不接控制台 API、不读取 SQLite/Obsidian/publish.json、不生成二维码、不触发旧扫描、审计、同步、生成或发布执行器。

### 已完成实现

- 新增 `src/console-readonly-adapter.mjs`：
  - `CONSOLE_READONLY_WIRED_DEFAULT = false`。
  - feature flag 关闭时原样委托既有 `handleCommand(text, config, context)`。
  - feature flag 显式开启时，8 个只读指令只经过离线解析器、SafeReply 和固定本地控制台链接文本化。
  - 开启后所有写命令失败关闭，不回落到旧执行器。
  - 开启后继续调用既有 `isUserAllowed` 允许名单检查。
  - 纯适配层静态声明 `external_calls: 0`。
- `src/config.mjs` 新增 `XHS_CONSOLE_READONLY_COMMANDS_ENABLED` 解析；未设置、`false`、`0` 或未知值均为关闭，只有 `1/true/yes/on` 显式开启。
- `src/feishu-bot.mjs` 主入口改为调用 `routeCommand`；其开关值来自上述配置，默认仍走原 `handleCommand`。
- 新增 `test/console-readonly-adapter.test.mjs`，覆盖默认委托、8 指令离线路由、写命令失败关闭、允许名单保持和 feature flag 真值解析。

### 验证证据

- `npm test`：21/21 通过；原有 4 个测试、I 分支 12 个测试、M 分支新增 5 个测试全部通过。
- `node --check`：`src/console-readonly-adapter.mjs`、`src/console-readonly-commands.mjs`、`src/config.mjs`、`src/feishu-bot.mjs` 和新增测试均通过。
- 控制台契约验证：2 个 Schema、8 个只读指令、2 组脱敏 fixtures 通过，报告 `external_calls: 0`。
- 纯层 `console-readonly-adapter.mjs` 与 `console-readonly-commands.mjs` 静态搜索飞书 SDK、HTTP/HTTPS、socket、WebSocket、`fetch`、文件系统、子进程、`message.create`、`sendText` 和启动调用为 `NO_MATCH`。
- 默认关闭证据：
  - 源码常量 `CONSOLE_READONLY_WIRED_DEFAULT = false`。
  - `loadBotConfig({}).consoleReadonlyCommandsEnabled === false` 单元测试通过。
  - 默认适配器报告 `wired_default: false`、`wired: false`、`external_calls: 0`。
  - 默认分支参数和返回值原样委托旧处理器的单元测试通过。
- 本阶段未启动、停止或重启任何进程。只读复核 PID `62980` 仍为 2026-07-27 17:21:33 启动的既有 Node 进程，因此运行中机器人没有加载本次源码改动。
- 未发送飞书消息，未调用真实飞书 API/WebSocket，未读取或修改 `.env`，未修改控制台 apps、SQLite、Obsidian、发布任务或计划任务；本阶段 `external_calls=0`。

### 当前真实状态与确认门

- 源码已完成“主入口附近、默认关闭”的接线准备，但运行中进程仍使用重启前代码。
- 未读取 `.env`，所以只确认代码默认值为关闭；没有核验或改动实际环境变量。
- 即使未来显式开启，当前纯适配层也只返回命令摘要和固定本地控制台链接，不会取控制台真实数据。
- 以下动作必须先取得用户明确确认：
  1. 修改实际环境变量以开启 `XHS_CONSOLE_READONLY_COMMANDS_ENABLED`。
  2. 重启运行中的飞书机器人，让新入口代码实际生效。
  3. 在飞书发送 8 个指令做真机回复验收。
  4. 新增控制台只读 API 取数适配器或任何真实网络/数据库读取链路。

### 下一步与接手后的前三步

1. 只读复跑 `npm test` 和静态危险调用搜索，确认 `wired_default=false`、`external_calls=0` 仍成立。
2. 如用户批准实际接线，先单独设计“开关、重启、真机消息”变更清单和回滚方法；未经确认不得执行。
3. 如用户只批准继续离线开发，先为控制台只读数据提供者定义注入接口和失败关闭测试，不连接真实 API、数据库或飞书。

### 不得重复或覆盖

- 不得把 feature flag 默认值改为开启。
- 不得让只读分支回落到旧扫描、审计、同步、生成、二维码、发布或登记执行器。
- 不得绕过原有飞书用户允许名单。
- 不得把控制台 API/SQLite/Obsidian/publish.json 真实取数、机器人重启或飞书真机消息混入离线测试。
- 不得输出或修改 `.env`、App Secret、访问令牌、Cookie、验证码或账号标识。

---

## 2026-07-29 13:16 Asia/Shanghai M2 可注入控制台只读数据提供器

### 目标与执行边界

- 为 M1 已接线但默认关闭的 8 个指令增加可注入的本地控制台只读数据提供器。
- “总览、资料、策略、发布包、扫码、复盘、状态”显式开启后可从 `http://127.0.0.1:4325` 固定白名单 GET 路由生成短摘要；“帮助”不取数。
- 本阶段测试必须只用 injected/mock fetch，不访问真实端口；不得设置环境变量、重启机器人、连接飞书或发送消息。

### 已完成实现

- 新增 `src/console-readonly-provider.mjs`：
  - 固定 origin：`http://127.0.0.1:4325`。
  - 固定路径：
    - `/api/v1/overview`
    - `/api/v1/materials`
    - `/api/v1/strategies`
    - `/api/v1/publish-packages`
    - `/api/v1/scan-publish`
    - `/api/v1/reflections`
    - `/api/v1/runtime`
  - 只允许 `GET`，`redirect: error`、`credentials: omit`、`cache: no-store`，无请求体。
  - 默认超时 1200ms，可配置范围 1–5000ms。
  - 默认最大响应 64 KiB，可配置范围 1–256 KiB；同时检查 `Content-Length` 和实际读取字节数。
  - 列表摘要最多 3 条，仅提取各 DTO 的固定字段；不返回正文、二维码 data URL、路径、日志详情、账号或凭据字段。
  - API warnings/conflicts 只保留安全 reason code，不透传任意服务端消息。
  - 关键词当前没有控制台 API 服务端筛选契约，因此不发送并明确返回 `keyword_filter_not_supported_by_console_api`；策略状态等无对应字段时同样明确提示，不伪装筛选成功。
  - API 超时、超大、HTTP/JSON/契约错误统一失败关闭，只返回安全降级提示和 reason code。
- `src/console-readonly-adapter.mjs`：
  - 新增 `readProvider` 注入点。
  - 默认 flag 关闭时不调用 provider，仍原样委托旧处理器。
  - 开启时仅七类数据指令调用 provider；帮助、未知帮助、无效输入和写命令不调用 provider。
  - provider 异常时不回落旧写执行器，不暴露内部错误。
- `src/console-readonly-commands.mjs`：
  - SafeReply 支持使用 provider 生成且再次脱敏、截断的短摘要。
- `src/feishu-bot.mjs`：
  - 只完成 provider 注入代码；真正 fetch 仍被默认关闭的 feature flag 隔离。
  - 没有修改或设置 `.env`，没有重启运行中进程。
- 新增 `test/console-readonly-provider.test.mjs`，扩展 `test/console-readonly-adapter.test.mjs`。

### 离线验证证据

- `npm test`：28/28 通过。
  - 原有与 I/M1 回归 23 个。
  - M2 provider 专项 5 个。
- 所有相关源码和测试 `node --check` 通过。
- 控制台原契约验证仍通过：2 个 Schema、8 个只读指令、2 组脱敏 fixtures，报告 `external_calls: 0`。
- provider 测试只引用 injected `fetchImpl`；静态搜索测试文件中的 `globalThis.fetch` 或直接 `fetch(...)` 为 `NO_REAL_FETCH_REFERENCE`。
- 7 个成功路径和超时、超大、异常路径全部由本地 mock 函数返回/拒绝，未启动服务器、未访问 `4325` 或其他端口。
- `external_calls_during_tests=0`；mock fetch 调用不产生网络。
- 默认关闭证据继续成立：
  - `CONSOLE_READONLY_WIRED_DEFAULT = false`。
  - 未设置/修改 `XHS_CONSOLE_READONLY_COMMANDS_ENABLED`。
  - 关闭时 provider 调用计数为 0 的单元测试通过。
- PID `62980` 仍为 2026-07-27 17:21:33 启动的既有 Node 进程，本阶段没有启动、停止或重启机器人；运行中进程未加载 M1/M2 源码。
- 未读取 `.env`，未连接飞书，未发送消息，未调用真实飞书 API/WebSocket，未修改控制台 apps、SQLite、Obsidian 或发布任务。

### 当前真实状态与限制

- 源码已具备显式开启后读取本机 `4325` 只读 API 的能力，但当前实际运行仍为默认关闭且未加载新代码。
- 本阶段没有验证 `4325` 当前是否监听或真实响应是否与源码契约完全一致；该状态为“待验证”。
- 关键词筛选未被控制台 API 支持，当前采用明确警告和不应用筛选；不得声称关键词已生效。
- API 不可用时只返回“控制台只读 API 暂不可用，未执行其他操作”和固定控制台链接，不会调用旧扫描、审计、同步、生成或发布路径。

### 下一确认门

以下动作仍须用户分别明确确认：

1. 允许对 `http://127.0.0.1:4325` 做一次真实只读 GET smoke，核对七个端点的运行时 DTO 和响应大小。
2. 设置实际 feature flag 并重启机器人，使 M1/M2 源码进入运行态。
3. 在飞书发送 8 个指令做真机回复验收。
4. 如需真正支持关键词筛选，另行修改控制台 API 契约和实现；不得在机器人端伪造全量筛选。

### 接手后的前三步

1. 只读复跑机器人项目 `npm test`，确认 28/28 与 `wired_default=false`。
2. 未获确认前仅静态检查 provider 策略，不访问 `4325`、不读取 `.env`、不操作 PID `62980`。
3. 用户若批准第一道门，只执行七端点 GET smoke 和脱敏/大小核验；仍不得设置 flag、重启或发送飞书消息。

### 不得重复或覆盖

- 不得把 `127.0.0.1:4325` 扩大为可配置 host、用户 URL、任意 path 或非 GET 方法。
- 不得移除 1200ms 超时、64 KiB 默认上限、字段白名单或 reason-code-only 限制。
- 不得在 API 失败时回落旧执行器。
- 不得把 mock fetch 测试结果表述为真实 API 已连通。
- 不得未经确认设置 feature flag、重启机器人或发送飞书消息。

---

## 2026-07-29 13:21 Asia/Shanghai M3 本机只读 provider smoke

### 授权边界

- 本阶段只获准对当前 `http://127.0.0.1:4325` 七个固定白名单端点做真实 GET。
- 不得设置 feature flag、读取或修改 `.env`、重启机器人、连接飞书或发送消息。
- smoke 前后必须复核 SQLite 主文件、全部 publish.json 和 Obsidian Markdown 聚合指纹。

### 真实运行状态

- `127.0.0.1:4325` 由 PID `55972` 监听。
- M1/M2 交接曾记录机器人 PID `62980`；M3 开始时该 PID 已不在进程表中。本阶段没有启动、停止或恢复机器人。
- 当前机器有多个长期计划任务：
  - `小红书Agent-飞书同步`
  - `小红书内容实验Agent-资料扫描`
  - `小红书对标账号自动分析`
- `小红书内容实验Agent-资料扫描` 在 13:19:13 成功运行，下一次计划为 13:24:11。

### 首次 smoke 结果

七端点均由 `createConsoleReadonlyDataProvider({ fetchImpl: globalThis.fetch })` 调用，没有绕过 provider：

| 指令 | GET 路径 | HTTP | 耗时 | 实际响应字节 | 结果 |
| --- | --- | ---: | ---: | ---: | --- |
| 总览 | `/api/v1/overview` | 200 | 185.4ms | 643 | 通过 |
| 资料 | `/api/v1/materials?page=1&page_size=3` | 200 | 7.0ms | 15,074 | 通过 |
| 策略 | `/api/v1/strategies?page=1&page_size=3` | 200 | 223.9ms | 4,167 | 通过 |
| 发布包 | `/api/v1/publish-packages?page=1&page_size=3` | 200 | 156.0ms | 11,422 | 通过 |
| 扫码 | `/api/v1/scan-publish?page=1&page_size=3` | 200 | 19.6ms | 29,574 | 通过 |
| 复盘 | `/api/v1/reflections?page=1&page_size=3` | 200 | 5.4ms | 1,036 | 通过 |
| 状态 | `/api/v1/runtime` | 200 | 6.1ms | 475 | 通过 |

全部端点：

- 返回 `application/json`。
- 未超过默认 1200ms 超时和 64 KiB 响应上限。
- provider 未降级。
- 输出对象只包含 `summary/source_of_truth/observed_at/warnings/conflicts`；conflict 子项只保留 `reason_code`。
- 未发现二维码 data URL、凭据键、open_id、绝对路径或 UNC 路径泄漏。
- 短摘要中的计数与同次 API envelope 一致。

真实短摘要关键计数：

- 总览：资料 29、SQLite 策略引用 0、发布包 21、审计阻断 20、扫码入口 19、扫码冲突 18。
- 资料：29 条。
- Obsidian 策略卡：239 条。此数字与总览中的 SQLite `strategy_references=0` 是两个不同事实来源，不得混为同一计数。
- 发布包：21 条。
- 扫码：19 条。
- 复盘：0 条；反馈、指标、观察、候选规则、待确认和已验证规则均为 0。
- runtime：4317 返回 302，4319 返回 200，3/3 交接文件可用。

### 真实超时、大小上限与安全降级

- 对白名单 `/api/v1/strategies` 使用 1ms provider 超时，得到：
  - 安全摘要：`控制台只读 API 暂不可用，未执行其他操作。`
  - reason：`console_api_timeout`
  - 无内部错误、地址、路径或凭据泄漏。
- 对白名单 `/api/v1/scan-publish` 使用 1 KiB provider 响应上限，得到：
  - 同一安全摘要。
  - reason：`console_api_response_too_large`
  - 无二维码 data URL、路径或凭据泄漏。
- 两种降级均没有回落旧扫描、审计、同步、生成或发布执行器。

### 指纹审计与并发写入说明

首次宽窗口基线于 13:18:17 记录：

- SQLite：1,499,136 bytes，SHA-256 `f3015bb49c83a5dfa36a4af3c803ea416352ccae2dc5a3b44f1e6ebef533ece0`。
- 21 个 publish.json：124,074 bytes，聚合 SHA-256 `41eae4de5d539daf7dd988fb3a01d02fda2ef7f97bdba90a46171c93a916abb6`。
- 279 个 Obsidian Markdown：1,631,032 bytes，聚合 SHA-256 `516b1d8d3118fe25858a4b3b99366d74bd7ebf79735cd78f5828351edc8e5c97`。

首次 smoke 后：

- publish.json 与 Obsidian 指纹不变。
- SQLite 在 13:19:13 变为 SHA-256 `8a59ae5859ba3730a5e1a0dc90503d2ccaa765dbc9895467c5e0acee170c13cb`。
- 只读核验发现 `小红书内容实验Agent-资料扫描` 恰在 13:19:13 成功运行，时间与 SQLite mtime 完全一致；因此首次宽窗口变化属于计划任务并发写入，不能归因于 provider GET，也不能伪报“宽窗口完全不变”。

为隔离并发任务，在下一调度间隔内完成 1.16 秒受控复验：

- 前置：13:20:42.293。
- 七端点 provider GET 全部成功且未降级。
- 后置：13:20:43.457。
- SQLite：
  - 1,499,136 bytes。
  - mtime `2026-07-29T05:19:13.3030577Z`。
  - SHA-256 前后均为 `8a59ae5859ba3730a5e1a0dc90503d2ccaa765dbc9895467c5e0acee170c13cb`。
- 21 个 publish.json：
  - 124,074 bytes。
  - 聚合 SHA-256 前后均为 `41eae4de5d539daf7dd988fb3a01d02fda2ef7f97bdba90a46171c93a916abb6`。
- 279 个 Obsidian Markdown：
  - 1,631,032 bytes。
  - 聚合 SHA-256 前后均为 `516b1d8d3118fe25858a4b3b99366d74bd7ebf79735cd78f5828351edc8e5c97`。
- 受控复验结论：`sqlite=true`、`publish_json=true`、`obsidian_markdown=true`。

### 代码与回归状态

- 七端点均符合 M2 provider 契约，无需修改 provider 或测试。
- M3 除更新本 HANDOFF 外没有修改源码。
- 最终 `npm test`：28/28 通过。
- 相关源码与测试 `node --check` 全部通过。
- feature flag 默认值仍为 `false`；本阶段未设置任何环境变量。

### 下一确认门

源码、真实本机只读 API 和失败关闭均已验证。以下动作仍须用户明确确认：

1. 决定是否在实际机器人环境中设置 `XHS_CONSOLE_READONLY_COMMANDS_ENABLED=true`。
2. 决定是否启动或重启机器人，使 M1–M3 源码进入运行态；当前历史 PID `62980` 已不存在，启动前必须重新检查真实进程状态。
3. 机器人加载新代码后，决定是否在飞书发送“帮助、总览、资料、策略、发布包、扫码、复盘、状态”做真机验收。
4. 关键词筛选仍没有控制台 API 契约；如需支持，必须另开控制台 API 变更，不得在机器人端伪造全量筛选。

### 不得重复或覆盖

- 不得把首次宽窗口的 SQLite 变化误报为 provider 写入，也不得隐去计划任务并发事实。
- 不得把 239 个 Obsidian 策略卡与 SQLite `strategy_references=0` 混成一个口径。
- 不得未经确认设置 feature flag、启动/重启机器人或发送飞书消息。
- 不得扩大 host/path/method 白名单或放宽超时、大小、字段和脱敏限制。
