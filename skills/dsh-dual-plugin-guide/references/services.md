# 服务清单（services.md）

> 依据 runtime-inventory.md（权威）。服务注册三查：`Service` 子类 `super(ctx, "name")`、
> `ctx.provide("name", …)` / `ctx.reflect.provide("name", …)`、Service 静态 `provide` 字段。

## 1. `ctx.get` vs `inject`

- **`inject = ['x']`**：声明必需依赖，服务就绪后 `apply` 才跑，缺失则等待；可行选：省略 inject，用时 `ctx.get('x')`。
- **`ctx.get(name, strict?)`**：无 inject 的动态读取；返回 undefined 表示未提供。
- 提供：`super(ctx, name)`、`ctx.provide(name, value)` / `ctx.reflect.provide(name, value)` 均把服务挂到 `ctx.<name>`，返回 disposer。
- 依赖消失时：依赖插件自动 dispose，服务回归后重载。

## 2. Host 服务（55，权威目录 `dsh-tool-cordis/lib/index.js` `SERVICE_API` L19–3345）

`name — 关键方法 / 说明`（括号为 `super(ctx,..)` 出处包的相对名）：

- `agentDefaultModel` — 默认 Agent 模型选择（`dsh-agent-default-model`）
- `agentLoop` — 具体循环驱动器（唯一具体 loop 插件，`dsh-agent-loop`）
- `agentPresets` — 每 session Agent 组合；`ctx.emit("agent-preset/selected",…)`（`dsh-agent-presets`）
- `agents` — Agent 服务（`dsh-agent`）
- `apiProxy` — Host API 分发（transport-agnostic host gateway face，`dsh-host-apiproxy`）
- `approval` — 审批接缝（`dsh-user-approval`）
- `attachments` — 持久化二进制附件（`dsh-attachment`）
- `clientModules` — 客户端插件图宿主（`dsh-client-modules`）
- `codeRuntime` — 代码执行接缝（`dsh-code-runtime`）
- `commands` — 人类命令注册表（`dsh-commands`）
- `compaction` — 压缩接缝（`dsh-compaction`）
- `credentials` — 凭证接缝（`dsh-credentials`）
- `directoryPicker` — 工作区目录选择接缝（`dsh-host-directory-picker`）
- `e2b` — E2B 沙盒生命周期属主（仅 inspect 目录，`SERVICE_API:714`）
- `fs` — 文件系统提供方接缝（`dsh-fs`）
- `goals` — 同 session 目标域（`dsh-goal`）
- `invariants` — 包属不变量注册表（`dsh-invariants`）
- `jobs` — 后台任务注册表；`ctx.jobs.start({kind,label,owner,run})`（`dsh-jobs`）
- `llm` — LLM 适配器注册表（`dsh-llm`）
- `lsp` — 语言服务器导航接缝（仅 inspect 目录，`SERVICE_API:1332`）
- `messageFeedback` — 生命周期绑定消息反馈（`dsh-message-feedback`）
- `permissionPresets` — 权限预设（`dsh-permission-presets`）
- `planMode` — 计划协作状态（`dsh-plan-mode`）
- `sandbox` — 进程沙盒接缝（`dsh-sandbox`）
- `sandboxPolicy` — 沙盒策略宿主（`dsh-sandbox-policy`）
- `sessionPersistence` — 持久化 session 接缝（`dsh-session-persistence`）
- `sessionProjectionCache` — 持久化投影缓存（`dsh-session-projection-cache`）
- `sessionProjections` — session 投影单元（`dsh-session-projection`）
- `sessionQuery` — session 读取/追踪/过滤/搜索（`dsh-session-query`）
- `sessionReferenceResolver` — 跨 session 快照准备（`dsh-session-reference`）
- `sessions` — 内存 session 存储（`dsh-session`）
- `sessionTelemetry` — session 遥测接缝（`dsh-session-telemetry`）
- `sessionTitle` — 日志回填的 session 标题（`dsh-session-title`）
- `settings` — 用户设置接缝（`dsh-settings`）
- `shell` — Bash 执行器接缝（`dsh-shell`）
- `shellEnv` — 受管 bash 环境注册表（`dsh-shell-env`）
- `skills` — 技能提供方注册表；`registerProvider`/`invalidateCache`/`register`/`list`/`get`（`dsh-skill`）
- `spillStore` — 溢出存储接缝（`dsh-spill`）
- `storage` — 非 session 存储枢纽（`dsh-storage`）
- `storageDomain` — 域数据设施（`ctx.provide`，`dsh-storage-domain`）
- `subagents` — 子代理提供方与续接服务（`dsh-subagent`）
- `subprocess` — 子进程接缝（`dsh-subprocess`）
- `systemPrompt` — 系统提示词组装注册表（`dsh-system-prompt`）
- `terminals` — 持久 PTY session 注册表（`dsh-terminal`）
- `timer` — 定时器（`cordis-plugin-timer`；`ctx.timer` + interval/timeout/throttle/debounce）
- `tokenMeter` — 重放 token 计量（`dsh-token-meter`）
- `toolResultPruner` — 无模型工具结果裁剪（`dsh-compaction-tool-result-pruner`）
- `tools` — 工具注册表 + 受守卫执行管线（`ToolRuntime`；`register(definition)` `:2755`）（`dsh-tools`）
- `typert` — 运行时类型注册表（`dsh-typert-registry`）
- `typertGateway` — Typert Host 调用网关（`dsh-api-gateway`）
- `userQuestions` — 人类问答接缝（`dsh-user-questions`）
- `web` — Web 访问提供方注册表（`dsh-web`）
- `webServer` — HTTP 路由注册（`node:http`，`dsh-host-webserver`）
- `workflowEngine` — 工作流脚本引擎（`dsh-workflow`）
- `workspaceRegistry` — 工作区实体注册表（`dsh-workspace`）

## 3. Client 服务（7，权威目录 `dsh-cordis-client-runner/lib/client.js` `SERVICE_API` L1116–1410）

| 服务 | 说明 |
|---|---|
| `layout` | 布局服务（`ctx.reflect.provide("layout",…)`） |
| `locale` | 语言（`ctx.provide("locale",…)`） |
| `sessions` | 会话客户端代理（`reflect.provide("sessions",…)`） |
| `slots` | Slot 注册/渲染（见 slots.md） |
| `theme` | 主题（`ctx.provide("theme",…)`） |
| `timer` | 定时器 |
| `workspaces` | 工作区 |

## 4. 其他 `ctx.provide` 提供的键（可按 `ctx.get('<name>')` 读取，非 Service 类）

`loader`、`hmr`、`dshHomePath`、`webRuntime`、`webStartup`、`headlessStartup`、`configuredAgentIdentities`、`cmdlineArgs`、`appExit`、
`cordisInspect`、`dynamicCordisRunner`、`remote`、`conversation`、`conversationEvents`、`conversationViews`、`modelDirectories`、
`inputTriggers`、`commandUi`、`connection`、`settingsScope`、`appShell`、`chatFileMentions`、`sessionLogDownload`、`modules`、
`storage.backend.<name>`（如 `"storage.backend.json"`，见 `dsh-storage/lib/index.js:97-99` `storageBackendServiceKey(name)`）。

> 动态插件包内两个真正的 Cordis 服务：`cordisInspect`（`dsh-cordis-host-runner:723`）、`dynamicCordisRunner`（`:1572`）。

## 5. 重点服务用法

### skills
```js
ctx.skills.register({ name, description, content, resourceBase? })   // 返回 disposer
ctx.skills.list(options?)        // ⇒ SkillSummary[]
ctx.skills.get(name, options?)   // ⇒ SkillDefinition|undefined
ctx.skills.registerProvider(create)
```

### tools
```ts
import { defineTool } from '@deepseek-ai/dsh-tools'   // 直接 import，不是 globalThis.harness

export const inject = ['tools']                       // 等 ctx.tools 就绪
ctx.tools.register(defineTool({ name, description, parameters, output, execute })) // 返回 disposer；见 tools.md
ctx.tools.schemas(scope?)   // 模型可见 schema（仅 name/description/parameters）
ctx.tools.get(name, scope?) / ctx.tools.guard((exec)=>string|undefined) / restrict(filter)
```

> 完整最小模板见 `tools.md` §1；与官方 `docs/user/develop/basic/tool.md` 一致。
> 不要把 §5 这一行误读成"`harness` 是服务"——`harness` 是 vm 沙箱全局，不是 `ctx.get` 能读的服务。

### llm / timer / agentPresets / settings
```js
ctx.llm          // 适配器注册表；ctx.llm.registerAdapter(...)
ctx.timer        // interval/timeout/throttle/debounce，卸载自动清理
ctx.agentPresets // ctx.emit("agent-preset/selected", sessionId, agentPreset)
ctx.settings     // 用户设置接缝；settings/update 触发 settings/updated
```

## 6. ⚠️ 纠偏重述

- `harness` 不是服务（见 core-api.md §6）；`ctx.get('harness')` 无值。
- `ctx.tools` 的方法集以工具子系统为准（`presentAs(mode)`、`register`、`restrict`、`guard`、`get`、`schemas`、`executionMode`、`execute`）。
