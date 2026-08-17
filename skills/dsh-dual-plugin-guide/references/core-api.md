# Cordis 插件核心（core-api.md）

> 依据：`@deepseek-ai/cordis@4.0.1` 源码（`cordis/src/*.ts`）与 `runtime-inventory.md`。
> 版本：DSH `0.1.0-rc.6`，dsh-base `0.1.0-rc.6`。

## 1. 三种插件形态

插件是一个模块/对象，三选一（`Plugin = Plugin.Function | Plugin.Constructor | Plugin.Object`）：

- **函数**：`export function apply(ctx, config)`；可配 `name`、`inject`、`Config`（`Plugin.Base` 元数据）。
- **构造器/类**：`export class MyPlugin extends Service { constructor(ctx, config) { super(ctx, 'name') } }`。
- **对象**：`{ name?, inject?, Config?, apply(ctx, config) }`。

`Plugin.Base` 元数据字段：`name?`、`Config?`（Standard Schema 校验器）、`inject?`、
`provide?: string | string[]`、`intercept?: Dict<boolean>`。配置变换：`Plugin.Transform = { schema?: true; Config: (config)=>T }`。

## 2. `ctx` 方法速查

| API | 语义 | 出处 |
|---|---|---|
| `ctx.on(name, listener)` | 注册监听器，fiber 卸载自动移除；返回 disposer | `events.ts:97` |
| `ctx.once(name, listener)` | 单次监听 | `events.ts:106` |
| `ctx.emit / parallel / serial / bail / waterfall(name, …)` | 事件分派策略（见 events-hooks.md） | `events.ts:32,183-243` |
| `ctx.provide(name, value)` | 注册 fiber 拥有的服务实现，返回 disposer | `service.ts:42-59` |
| `ctx.effect(callback, label?)` | 作用域 effect，返回 disposer；支持返回单 disposer / generator | `fiber.ts:415` |
| `ctx.inject(deps, callback)` | 按依赖启动子插件，返回 fiber（awaitable） | `registry.ts:176` |
| `ctx.plugin(plugin, …config?)` | 启动插件，返回 fiber（awaitable） | `registry.ts:185` |
| `ctx.get(name, strict?)` | 无 inject 读服务（见 services.md 中的 get vs inject） | docs |
| `ctx.set / accessor / mixin / extend / isolate / intercept` | 服务写 / 计算属性 / 混入 / 子上下文 / 独立作用域 / 配置合并 | docs |

## 3. Fiber 6 状态机

定义 `cordis/src/fiber.ts:147-154`（`export const enum FiberState`）。编译后为数值 0–5；
DSH 层在 `dsh-tool-cordis` 保留手写镜像（`lib/types/fiber-state.d.ts` 另导出 `STATE_LABELS`：`0="pending" … 5="unloading"`）。消费者示例见 `dsh-agent/lib/types/index.js:66`（`fiber.state === 5 → UNLOADING`）。

| 状态 | 值 | 含义 |
|---|---|---|
| `PENDING` | 0 | 等待必需服务 |
| `LOADING` | 1 | `apply` 正在运行 |
| `ACTIVE` | 2 | 已加载并供给 |
| `FAILED` | 3 | `apply`/config 抛错 |
| `DISPOSED` | 4 | 已移除，不可重启 |
| `UNLOADING` | 5 | disposer 正在运行 |

流程：`PENDING → LOADING → ACTIVE`；`LOADING` 抛错 → `FAILED`；`ACTIVE → UNLOADING → DISPOSED`。
`fiber.dispose()`：①移除全部注册 ②递归卸载子插件 ③ await 所有异步清理后 resolve（`fiber.ts:265-297`）。
`fiber.restart()`：重新加载（无参；**无 `start/stop` 辅助**）。
`fiber.await()` / `fiber.update(config, noSave?)` / `fiber.assertActive()` 可用。

## 4. 自动清理规则

- 经 `ctx` 的注册在卸载时**自动撤销**：`ctx.on`、`ctx.effect(() => cleanup)`、`ctx.tools.register`、`ctx.plugin(childPlugin)`。
- `ctx.plugin(childPlugin)` 建子 Fiber：继承父 context、独立生命周期、随父卸载。
- disposer 按注册**逆序**触发，但多个异步 disposer **并发、无串行保证**；依赖顺序的清理放单个 `ctx.effect()` 返回的 disposer 内串行 await。
- 必需服务消失（provider 替换）→ 自动卸载（ACTIVE→DISPOSED），服务回来再加载。
- 对已 dispose fiber 建 effect 抛 `CordisError.Code.INACTIVE_EFFECT`（`fiber.ts:171-174`）。

## 5. install 消费 / 提供约定

*install 部分属于动态插件沙箱（见 tools.md、services.md），此处仅列 ctx 侧三法：*

- 消费：`export const inject = ['tools']`，依赖就绪后才跑 `apply`；缺失则等待。
- 可选依赖：省略 inject，用时 `ctx.get('metrics')`。
- 类型合并：`declare module '@deepseek-ai/cordis' { interface Context { metrics: MetricsService } }`。

## 6. ⚠️ 纠偏：`harness` 不是服务

- 全树 grep 验证：**不存在 `Builtin` 消息源枚举，也不存在 `harness` 服务**（`ctx.get('harness')` 读不到）。
- 真 `Builtin` 是 Cordis Inspect 的**类别**（Host 7 / Client 5，如下），枚举动态插件沙箱内可用的 JS 全局符号。
- `harness` 是 Host 侧一个**vm 沙箱全局对象**，只在 `node:vm` 沙箱里挂出——**不是**进程全局，也不是
  静态插件可见的注入服务。出处：
  - 发布版：`dsh-cordis-host-runner/lib/index.js:1220` `createSandbox(id, harnessExtras)`
  - 源码：`packages/extensions/cordis-host-runner/src/sandbox.ts:129` `createSandbox`
  - 调用方：`packages/extensions/cordis-host-runner/src/index.ts:898` `startHost` 仅在
    `hostCode !== undefined` 时构造该沙箱并 `runInContext`（`sandbox.ts:227`）。
- **守卫层等价**：沙箱内的 `harness.registerTool(ctx, tool)` 实际是
  `ctx.tools.register(tool)` 的 marker-guarded 包装（`guard.ts:626-629`）；`harness.defineTool(def)`
  是 `defineTool` 之上加 VM 域 schema 规范化与 JSON 跨域克隆（`guard.ts:551-592`）。
  静态插件直接 `ctx.tools.register(defineTool({...}))` 即可，不需要任何 harness 包装。

> **静态插件的常见错配**：在 `apply` 里 `if (typeof globalThis.harness === 'undefined')` 然后抛错，
> 期望 DSH 暴露 `harness` 全局。DSH **不会**——`cordis-plugin-loader` 用普通 ESM `import()` 装入静态插件，
> 跑在主进程里，`globalThis.harness` 永远是 `undefined`。正确做法见 `tools.md` §1 与官方
> `docs/user/develop/basic/tool.md` 的 `Build a tool` 教程。

## 7. Builtin 清单

**Host 侧（7）** —— 定义于 `dsh-cordis-host-runner/lib/types/sandbox.js:16` `HOST_BUILTIN_INSPECTION`，经 `dsh-tool-cordis/lib/index.js:6416` 暴露：

| 符号 | 签名（示例） | 说明 |
|---|---|---|
| `ctx` | `get/on/provide/effect` | 受限 Cordis Context |
| `harness` | `handle(method,handler)`；`defineTool(def)`；`registerTool(ctx,tool)` | Host helpers（沙箱全局，非服务） |
| `console` | `log/warn/debug/error` | 带 `[cordis:<id>]` 标签的 Host 日志 |
| `btoa` / `atob` / `TextEncoder` / `TextDecoder` | 编码解码 | UTF-8↔base64 等 |

**Client 侧（5）** —— 定义于 `dsh-cordis-client-runner/lib/client.js:3548` `CLIENT_BUILTIN_INSPECTION`：

| 符号 | 签名（示例） | 说明 |
|---|---|---|
| `ctx` | 同上 `get/on/provide/effect` | 受限 Client Context |
| `React` | `createElement`、`useState`、`useEffect` | 无 JSX 转译，须 `createElement(...)` |
| `host` | `call(method, args?)` | 包私有 Client→Host JSON RPC |
| `styles` | `insert(css)` | 包自有样式表插入 |
| `console` | `log/error` | 浏览器日志 |

> `harness` 的其他出现处（均非服务）：system-prompt 段名 `"harness:identity"`、
> 常量 `HARNESS_SOURCE_SECTION = "harness:source"`、错误类型 `HarnessError`。动态插件包内真正的
> Cordis 服务是 `cordisInspect` 与 `dynamicCordisRunner`（见 services.md）。

## 8. 最小函数插件示例

```js
export const name = 'my-plugin'
export const inject = ['tools', 'llm']
export function apply(ctx) {
  const disposer = ctx.on('session/created', () => {
    ctx.logger.info('session created')
  })
  // ctx 注册自动随 fiber 清理；无需手动 undo
}
```

## 9. 官方红线（门禁级契约）

> 来源：官方 AGENTS.md / docs 明文化 + 运行时 `lib/types/*.d.ts` 可核对（DSH 0.1.0-rc.6）。
> 这些规则运行时不一定试得出来，但违反会被官方 CI / 评审挂掉。提炼自社区 dsh-plugin-guide
> （PerryLink）的 Hard rules，按我方惯例标注可核对位置。

1. **注册即 effect**：所有贡献（事件/工具/服务/Slot/定时器）经 `ctx.on()` / `ctx.effect()` / 服务 `register()` 挂接并返回 disposer；卸载自动撤销。禁止模块级副作用、禁止 `apply()` 外的进程级注册。
2. **waterfall 必须调 `next()`**：不调 = 故意短路下游（拦截/网关语义），见 events-hooks.md 示例。
3. **模型可见 ⟺ 已记录**：新的模型可见输入必须新增会话事件（`SessionEventMap` 44 事件见 events-hooks.md）；"能看见但没记录"违反持久化契约。
4. **跨边界 opaque id 用 branded**：会话/任务/审批等 id 从不裸 `string`（`Branded<B>` 来自 `dsh-brand`），字符串在进程/文件边界可被混淆。
5. **merge-extensible union 禁用 `assertNever`**：`SessionEvent` 属后者——switch 必须落**文档化 default**；未知类型带 `ignorable: true` 否则日志拒读（required-on-read）。
6. **配置全 Schema 化、fail loud**：`Config` 用 `@deepseek-ai/schemastery`（见 packaging.md §5），非法配置加载即失败，不静默吞。
7. **不硬编码可调参数**：判据——cordis.yml 能否不改代码改值；能则做成配置字段。
8. **文档纪律**：README 双语成对；工具描述/提示词即行为（模型可见）；非平凡变更加 Agent Note；事件 JSDoc 带 `@mode`。
