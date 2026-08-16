# 全量事件目录（events-hooks.md）

> 依据 runtime-inventory.md（权威，含行号）。总线事件**共 81 条独立字符串名**：
> §1.1 Host 域 50 + §1.2 `cordis/*` 6 + §1.3 补充 16 + §1.4 内核 `internal/*` 9。
> mode 取值：`emit` / `parallel` / `serial` / `bail` / `waterfall`（`DispatchMode`）。

## 1. 四种监听模式（示例）

`ctx.on(name, listener)` 把 listener 注册为 effect，卸载自动移除；`options? = { prepend?, global? }`。

```js
// emit —— 同步广播，忽略返回值
ctx.on('session/created', (payload) => console.log(payload))

// serial —— 按序 await，首个 bail 返回截断
ctx.on('agent/turn-stopping', async () => { /* … */ })

// bail —— 按序，首个"非 null/false/undefined"返回值截断
ctx.on('slash/input-begin-command', () => { if (cond) return true })

// waterfall —— 最后一参是 next 中间件；必须调用 next() 委托下游，否则短路
ctx.on('fs/write-intent', ({ target, actor }, next) => {
  if (!allowed) return { kind: 'deny', reason: '…' } // 不调用 next => 拦截
  return next()
})
```

> **waterfall 硬规则**：listener 收到 `(...args, next)`，必须 `next()` 才能让链路继续，否则短路（用于拦截/网关）。

## 2. 分组目录

### A. agent 生命周期钩子（docs `agent/*` 12）

| 事件 | mode | 签名要点 |
|---|---|---|
| `agent/created` | emit | `({agent: Agent})` |
| `agent/disposed` | emit | `({agent: Agent})` |
| `agent/error` | emit | `({agent, turn, step, error})` |
| `agent/inbox/claimed` | emit | `({agent, message, turn})` |
| `agent/inbox/discarded` | emit | `({agent, message})` |
| `agent/inbox/inserted` | emit | `({agent, message})` |
| `agent/pre-step` | waterfall | `({agent, messages, turn, step, signal}, next)⇒ PreStepDecision` |
| `agent/request` | waterfall | `({agent, turn, step, signal}, next)⇒ LlmCallConfig`（可拦截/改写） |
| `agent/request-error` | waterfall | `({agent, turn, step, provider, failure, retryPolicy, signal}, next)` |
| `agent/session-start` | emit | `({agent, source})` |
| `agent/status` | emit | `({agent, status})` |
| `agent/turn-stopping` | serial | `({agent, turn, signal})` |

另有 `agent-loop/config-start-failed`（emit）、`agent-preset/selected`（emit，`(sessionId, agentPreset)`）。

### B. tools 管线（6，全部 waterfall/emit）

| 事件 | mode | 签名 |
|---|---|---|
| `tools/change` | emit | `()` |
| `tools/code-dispatch-log` | waterfall | `(dispatch, next)⇒ ContentBlock[]` |
| `tools/execute` | waterfall | `(exec, next)⇒ ToolExecutionResult`（around-dispatch） |
| `tools/post-execute` | waterfall | `(exec, result, next)⇒ PostToolDecision` |
| `tools/pre-execute` | waterfall | `(exec, next)⇒ PreToolDecision`（allow/deny/ask） |
| `tools/result` | emit | `(exec, result)`（不可变结果观察） |

执行顺序：`tools/pre-execute` → 单调守卫 → `tools/execute` → `tools/post-execute` → `finalizeContent` → `tools/result`。声明见 `dsh-tools/lib/types/index.d.ts:38,49,61,75,83`。

### C. skills/change

| 事件 | mode | 签名 |
|---|---|---|
| `skills/change` | emit | `()`（发布点 `dsh-skill/lib/index.js:404`，skill 目录变化） |

### D. 内核内置（internal/* 9 + loader/hmr 7）

`internal/*` 9（`cordis/src/events.ts:329-352`，普通插件一般不应监听）：
`internal/plugin`(emit)、`internal/status`(emit)、`internal/config`(waterfall)、`internal/service`(emit)、
`internal/update`(waterfall)、`internal/get`(waterfall)、`internal/set`(waterfall)、`internal/listener`(bail)、`internal/dispatch`(emit)。

loader/hmr（7）：`loader/config-update`、`loader/entry-init`、`loader/partial-dispose`（emit）；`loader/patch-context`（waterfall，`(entry, next)`）；`hmr/change`、`hmr/reload`（emit）；`hmr/config-update-failed`（parallel）。

> 注：文档侧（docs §4.3）计 15（internal 8 + loader/hmr 7，无 `internal/config`/`hmr/config-update-failed`，含 `exit`）；运行时为准计 16。

### E. 其余 Host 域（§1.1 中未归入 A/B/C 的）

| 事件 | mode | 签名/说明 |
|---|---|---|
| `approval/request` | waterfall | 审批请求（`dsh-user-approval/lib/index.js:189`） |
| `commands/change` | emit | 命令目录变化 |
| `credentials/updated` | emit | 凭据更新 |
| `domain/changed` | emit | storage domain 变化 |
| `fs/edit-intent` | waterfall | `({target, actor})` |
| `fs/observed` | emit | `({target, observation, actor})` |
| `fs/write-intent` | waterfall | `({target, actor})` |
| `goal/changed` | emit | goal 状态变化 |
| `llm/adapters-updated` | emit | LLM adapter 列表更新 |
| `llm/stream` | waterfall | `({options})` |
| `session-telemetry/record` | waterfall | `({record})` |
| `session/created` | emit | session 被创建 |
| `session/disposed` | emit | session 被销毁 |
| `session/event` | emit | session 时间线事件 |
| `session/flush` | parallel | session 刷写 |
| `settings/document-updated` | emit | settings 文档更新 |
| `settings/updated` | emit | settings 值更新 |
| `subagent/end` / `start` / `provider-added` / `provider-removed` | emit | 子代理生命周期 |
| `system-prompt/assemble` | waterfall | `({assembly, context})` |
| `system-prompt/change` | emit | |
| `workflow/start` / `phase` / `log` / `agent-start` / `agent-end` / `end` | emit | `{info,…}`（详见签名） |

### F. `cordis/*` 动态插件内部事件（6）

`cordis/dynamic-package`、`cordis/dynamic-retract`、`cordis/inspect-query`、`cordis/inspect-query-resolved`、`cordis/request-run`、`cordis/request-run-resolved`（均 emit）。

### G. §1.3 补充（Client / 命令 / 输入，9；loader/hmr 已在 D 列出）

`connection/reset`、`locale/change`、`slots/changed`（`{key}`）、`theme/change`、`command/executed`（emit）；
`slash/input-begin-command`、`slash/input-consume-token`、`slash/input-insert-reference`、`slash/input-insert-text`（bail）。

## 3. ⚠️ 持久化事件（44）不是总线事件

Session 的持久化日志用 `namespace/action` 命名，**共 44 个类型**，但它们是**持久化 session-event 日志**，不是同名的 Cordis Bus 事件。观测方式：**监听单个 `session/event` 并检查 `event.type`**。

- 3 个 `surface` 事件产生 LLM 消息并带 `surfaceOp`/`sourceEventSeqs`：`assistant/message`、`tool/result`、`user/message`。
- 其余 41 个 `log-only`（durable、可重放、不进模型历史）。
- 事件信封 `SessionEvent`：`{ type, seq, time, data, ignorable?, surfaceOp?, sourceEventSeqs? }`；`SESSION_FORMAT_VERSION = 0`。
- `SurfaceOp = 'append' | { op: 'replace'; start; end }`。

**44 条名**（示例，勿与总线同名混淆）：`agent/inbox/spliced`、`agent-preset/selected`、`approval/asked|decided|policy`、
`assistant/chunk`、`assistant/message`、`command/done|run`、`compaction/end|prune|start|summary`、`feedback/record`、`goal/change`、
`hook/invoked|result`、`llm/retry|retry-started`、`permission/preset`、`plan/mode`、`request/context|header`、`sandbox/mode`、
`schedule/change`、`session/end-seed|title|title-llm-request`、`step/end|start`、`subagent/descriptor`、`todo/write`、
`tool/call|code-dispatch|code-dispatch-start|result`、`tool-workflow/agent-end|agent-start|run-end|run-start`、
`turn/end|start`、`user/message`、`web/deepseek-search-llm-request`。
（`agent/inbox/spliced`、`goal/change` 等与总线 `agent/inbox/*`、`goal/changed` 不同名，勿混淆。）

## 4. 已确认非 Bus 事件（勿登记为事件）

`turn/start`、`assistant/message`、`session/end-seed`、`session/title`、`tour/title-llm-request`、`tool/code-dispatch`、`tool/code-dispatch-start`（session 日志类型）；`approval/requested`、`question/requested`（API 线框）；node EventEmitter 伪事件 `data/error/exit/message/close/add/change/unlink/…`。
