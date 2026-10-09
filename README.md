# 小红书飞书机器人 Agent

> 给小红书内容 Agent 和扫码发布 Agent 加一个飞书聊天入口：在飞书里发白名单指令，查询状态、审计结果和待办。

| 项目状态 | 技术栈 |
| --- | --- |
| ✅ 可用（基础指令） | Node.js、飞书开放平台 SDK |

> 本项目为个人 AI 辅助开发（vibe coding）作品。仓库只包含源码与文档，运行数据、账号配置、密钥均已排除；文中出现的本机路径仅供参考，使用时请按自己的环境修改。

---

这个项目给已有的小红书内容实验 Agent 和手机扫码发布 Agent 增加飞书聊天入口。

它只负责：

- 接收飞书机器人聊天消息。
- 解析白名单指令。
- 调用本地已有脚本。
- 把状态、审计结果和待办回复到飞书聊天窗口。

它不负责：

- 自动发布小红书笔记。
- 保存小红书账号、Cookie、验证码或密钥。
- 替代 SQLite 事实库。
- 替代现有飞书 Base 同步。

## 路径

- 内容 Agent：`C:\Users\Lenovo\Desktop\小红书相关的skill\xhs-content-experiment-agent`
- 扫码发布 Agent：`C:\Users\Lenovo\Desktop\Codex Agent合集\小红书手机扫码发布Agent`
- 发布任务：`C:\Users\Lenovo\Desktop\小红书发布任务`

## 初始化

```powershell
cd "C:\Users\Lenovo\Desktop\Codex Agent合集\小红书飞书机器人Agent"
npm install
```

## 飞书应用

方式一：手动在飞书开放平台创建企业自建应用。

需要启用：

- 机器人能力
- 事件：`im.message.receive_v1`
- 权限：`im:message:send_as_bot`
- 事件订阅方式：长连接

方式二：使用脚本创建应用。

```powershell
node scripts/register-feishu-bot-app.mjs --confirm-create-app
```

该脚本会让用户在飞书里确认应用，并在本地创建 `.env`。终端只输出 `App ID`，不会打印 `App Secret`。不要把这些值写入聊天、文档或代码仓库。

## 启动

注册脚本成功后会创建本地 `.env`，直接启动：

```powershell
npm start
```

可选限制操作者：

```powershell
$env:XHS_FEISHU_ALLOWED_OPEN_IDS="ou_xxx,ou_yyy"
```

## 登录自启动

确认机器人能正常运行后，再安装 Windows 登录启动任务：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-logon-task.ps1
```

不要在未验证飞书 App ID/Secret 前安装登录启动任务。
