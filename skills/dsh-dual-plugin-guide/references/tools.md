# 动态 Tool（tools.md）

> 依据 runtime-inventory.md（权威）与 static-plugin-reference.md。工具注册路径：
> `ctx.tools.register(defineTool({…}))`（`dsh-tools/lib/index.js:2755`）；`defineTool` 定义于 `dsh-tools/lib/index.js:836` / `types/schema.js:274`。

## 1. 注册属于当前 Fiber，自动清理

`ctx.tools.register(...)` 与沙箱侧的 `harness.registerTool(...)` 均为 effect 式注册：**dispose fiber 即自动反注册**，
schema 自动进入 system-prompt 组装。热替换 = 卸载旧 effect + 注册新工具，注册后不 mutate schema / 替换回调。

## 2. `harness.defineTool` / `harness.registerTool`（沙箱全局）

Host 沙箱全局 `harness`（构造 `dsh-cordis-host-runner/lib/index.js:1220`）提供：
`harness.handle(method, handler)`、`harness.defineTool(def)`、`harness.registerTool(ctx, tool)`。
`defineTool` 推断并校验模型 `arguments`；`registerTool` 把工具挂到当前 fiber 的 `ctx.tools`。

```js
harness.registerTool(ctx, harness.defineTool({
  name: 'greet',
  description: 'Greet someone by name.',
  parameters: { name: { type: 'string', required: true, description: 'the name' } },
  output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
  async execute(args) { return `Hello, ${args.name}!` },
}))
```

## 3. ⚠️ 已纠偏的工具名清单（~38，40 条注册）

> ⚠️ 纠偏：**无 `jig`**（仅 web 前端 locale fixture 字符串）；工具名是 **`ask_user_question` 而非 `ask_user`**；
> 无集中式 `ToolName` 字面量联合 / `ToolArgsMap` 名，权威名即各 `defineTool` 的 `name` 字段。
> `bash` 在两个包注册（`dsh-tool-bash`、`dsh-tool-bash-persistent`）；`run_code` 为 SDK 传输工具（非插件注册）。

- 原生/工具类：`bash`、`pwsh`、`read`、`write`、`edit`、`read_image`、`glob`、`grep`、`str_replace_editor`
- 目标/规划类：`get_goal`、`create_goal`、`update_goal`、`exit_plan_mode`、`todo_write`
- 后台任务类：`job_output`、`job_list`、`job_kill`
- 协作/子代理类：`subagent`、`report`、`send_message`、`interrupt_agent`、`list_agents`、`ralph`
- 技能类：`skill`
- Web/工作流类：`web_search`、`web_fetch`、`workflow`
- 交互类：`ask_user_question`
- Cordis Inspect 类：`cordis_inspect_list`、`cordis_inspect_query`、`cordis_inspect_self`、`cordis_define`、`cordis_run`、`cordis_stop`、`cordis_undefine`
- 调度类：`schedule_create`、`schedule_list`、`schedule_delete`
- SDK 传输（reserved）：`run_code`

（~38 个独特名，40 条注册。出处行见 runtime-inventory §6，如 `dsh-tool-ask-user:16` → `ask_user_question`。）

## 4. Tool schema 与 execute 契约

### schema 字段

- `defineTool` 的 DSL：`ValueSchemaSpec = string | number | integer | boolean | null | array | object | json | oneOf`；
  `ParameterSchemaSpec` 为隐式开放对象属性映射，required 为每个属性上的 `required?: true`。
- 模型可见字段（allowlist）：仅 `name` + `description` + JSON-Schema `parameters`（`type: object`）。
  `output`/`execute`/`finalizeContent`/`timeoutMs`/`isConcurrencySafe`/`presentCall`/`presentResult` 永不上模型线。
- `output`（必填）：`{ schema: JsonSchemaNode; render(args, value): ContentBlock[]; presentationMeta?(args, value): JsonValue }`。
- `execute(args, exec: ToolRunContext)`（必填）：返回唯一**规范值**（canonical value），别返回 content blocks。
- 可选：`finalizeContent?(exec, result)`、`timeoutMs?`、`isConcurrencySafe?(args)`、`presentCall?`、`presentResult?`。

### execute 契约要点（坑）

- **args 自动校验**：`defineTool` 在 `execute` 前按 `ParameterSchemaSpec` 校验模型 `arguments`；对象节点声明 `additionalProperties: true|false`，隐式根开放。
- **执行身份受保护**：`arguments` 单遍物化为 lossless JSON 并冻结，赋不透明 `exec.token`；`callId/name/arguments/agent/token/signal/(parent)` 不可变；`args` 只读；仅 around-dispatch wrapper 可换/恢复 `exec.signal`（强 deadline，不可移除）。
- **一个规范 JSON 值**：`output.schema` 用 `ValueSchemaSpec`（根可 object/array/scalar/null）；`execute` 只返回推断值，别返回 content blocks，别让调用方解析散文取 id。
- **抛错或非法值 = `isError`**：`defineTool` 捕获 throw 及 schema/renderer/metadata/lossless-JSON 失败。
- **尊重 `exec.signal`**：触发即取消在途工作。
- **`exec.agent` 异步通知**：`agent.inject({ content, source: { kind: 'plugin', plugin: '<name>' } })` 追加到下一次模型请求可见上下文（非唤醒）；try/catch 防已 dispose agent。
- **长时运行**：生成器配置门控 `run_in_background`，经 `ctx.jobs.start({ kind, label, owner: exec.agent, run })`；后台分支返回类型化 handle（如 `{ kind: 'background', jobId }`），Code Mode 不得解析散文取 id。
- **UI card 坑**：card 是独立 concern（`presentCall`/`presentResult`，无则回退通用 card）。硬规则：presenter 在直播+REPLAY 都跑，**必须是 `args` 的纯函数**——无 I/O、不读 session 状态、无 clock/random；UI 格式（```console```/diff/相对路径）别塞进规范值/原生内容；畸形展示返回 `undefined`（通用回退）而非 throw。
- **Code Mode 免费**：`await tools.<name>(args)` 成功=最终规范 JSON，失败 reject `ToolCallError`（只能读 `name`/`toolName`/`message`）。

### 决策/守卫类型

`PreToolDecision = {kind:'allow'} | {kind:'deny';reason} | {kind:'ask';reason?}`；`PostToolDecision` 分 `accept` 与 `block`；
`ToolGuard = (execution) => string|undefined`；`ToolExecutionMode = {kind:'parallel'} | {kind:'exclusive'}`。

策略扩展点：`tools/pre-execute`（allow/deny/ask）、`ctx.tools.guard()`（最终单调 deny）、`tools/execute`（deadline/重试/指标）、`tools/post-execute`（替换展示/block/挂上下文）、`tools/result`（观察不可变结果）。顺序见 events-hooks.md §B。
