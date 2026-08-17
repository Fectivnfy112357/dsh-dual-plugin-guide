# 动态 Tool（tools.md）

> 依据 runtime-inventory.md（权威）与 static-plugin-reference.md。**静态插件**工具注册路径：
> `ctx.tools.register(defineTool({…}))`（`dsh-tools/lib/index.js:2755` / 源码 `packages/core/tools/src/index.ts:65`）；
> `defineTool` 定义于 `dsh-tools/lib/index.js:836` / 源码 `packages/core/tools/src/schema.ts:545`。
> 沙箱侧的 `harness.defineTool` / `harness.registerTool` 仅对**动态插件**的 `hostCode` 可见——见 §2 的 ⚠️。

## 1. 静态插件的标准注册路径

> 这是**静态插件**该用的模式（`cordis.bundle.patch` / `@deepseek-ai/dsh-bundle-*` 装入的包）。官方最小示例见
> `packages/extensions/.../docs/user/develop/basic/tool.md`；本节与之一致。

`ctx.tools.register(defineTool({...}))` 是 effect 式注册：**dispose fiber 即自动反注册**，
schema 自动进入 system-prompt 组装。热替换 = 卸载旧 effect + 注册新工具，注册后不 mutate schema / 替换回调。

**最小可运行模板**（与官方 `Build a tool` 教程同形）：

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'   // ← 直接 import，不要走 globalThis.harness

export const name = 'greet-tool'
export const inject = ['tools']                       // ← 让 cordis 等 ctx.tools 就绪再 apply

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: { name: { type: 'string', required: true, description: 'the name' } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args) { return `Hello, ${args.name}!` },
  }))
}
```

关键点：
- `defineTool` 来自 `@deepseek-ai/dsh-tools`（`schema.ts:545`），与 `globalThis.harness` 无关。
- `inject = ['tools']` 声明对 `ctx.tools` 服务的硬依赖；缺它就 `ctx.tools` undefined。
- 卸载时 cordis 自动反注册：要么裸 `ctx.tools.register(defineTool(...))`，要么 `ctx.effect(() => ctx.tools.register(defineTool(...)))` —— **不要**两者都包一遍。

## 2. `harness.defineTool` / `harness.registerTool`（**仅**动态插件 host 半的 vm 沙箱）

> ⚠️ **本节是动态插件（`cordis_define` 装入的 `hostCode`）在 `node:vm` 沙箱内才能用的入口。**
> 静态插件（`@deepseek-ai/dsh-bundle-*` / `cordis.bundle.patch` 安装的 npm 包）**没有**
> `globalThis.harness`，读不到 `harness.defineTool` / `harness.registerTool`。
> 静态插件请用 §1 的 `ctx.tools.register(defineTool({...}))`，别照抄本节代码——否则
> `apply` 一进来 `globalThis.harness is undefined` 就抛错，DSH 直接拒启该 plugin。
> 真实反例：`dsh-agent-dock` 一开始按本节写法挂了 `globalThis.harness` guard，
> `dsh web` 启不来报 `harness sandbox global unavailable (defineTool/registerTool missing)`。

**边界**：`harness` 全局只在 `createSandbox`（发布版 `dsh-cordis-host-runner/lib/index.js:1220`；
源码 `packages/extensions/cordis-host-runner/src/sandbox.ts:129`）构造的 `vm.createContext` 沙箱里挂出，
整个调用链 `startHost`（`index.ts:898`）→ `evaluateHostCode`（`sandbox.ts:227`，`runInContext`）
→ `startHostHalf`（`lifecycle.ts:22`）只在 `hostCode !== undefined` 时触发；
静态插件加载走 `cordis-plugin-loader` 的 `import()`，不进 vm，`globalThis.harness` 始终 `undefined`。

**实质等价**：沙箱内 `harness.registerTool(ctx, tool)` 干的事就是
`ctx.tools.register(tool)`（守卫版 `packages/extensions/cordis-host-runner/src/guard.ts:626-629`，
外加 JSON 跨域克隆与 schema 规范化），`harness.defineTool(def)` 实质是
`defineTool` 之上加 VM 域 schema 规范化（`guard.ts:551-592`）。沙箱的两层包装**只**为
应对 model 在 vm 域写代码的跨域场景；你写的 TS/JS 静态插件用不到。

```js
// 仅用于 cordis_define 的 hostCode 体内；静态插件别这样写。
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
