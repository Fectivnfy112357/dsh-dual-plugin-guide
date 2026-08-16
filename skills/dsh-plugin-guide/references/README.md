# 参考文献库目录（references/）

> 本分册是"双格式指导插件 `dsh-plugin-guide`"的**已核实事实库**，教 agent 构建
> 同时兼容 DSH 静态插件包 与 Agent Plugins 1.0 两种格式的插件。
> 正文中文；代码 / API 名 / 事件名 / 命令保留原文逐字抄录。
>
> **权威性分级**：`runtime-inventory.md`（从真实运行时代码逐条抄录，含行号溯源）为最权威；
> `docs-catalog.md` 为官方文档提炼。两者矛盾时**以运行时为准**，本文底部统一列出纠偏。

| 文件 | 内容 | 何时读 |
|---|---|---|
| `core-api.md` | Cordis 插件三种形态、`apply`/`inject`/`effect`、ctx 方法、Fiber 6 状态机、自动清理、`harness` 纠偏、Builtin 清单 | 写任何插件的入口时必读；理解生命周期与内置符号 |
| `events-hooks.md` | 全量 81 事件目录（精确名 + mode + 签名，按域分组）+ 四种监听模式示例 + 生命周期钩子 | 需要监听 / 拦截 DSH 事件、挂钩子时 |
| `services.md` | 55 Host + 7 Client 服务清单（名 + 用途 + 关键方法）、`ctx.get` vs `inject`、重点服务用法 | 要消费能力服务（skills/tools/llm/timer/agentPresets/settings）时 |
| `slots.md` | 42 个 Client Slot 清单、注册模式（single/list/keyed/chain）、常见入口建议 | 要往 Client UI 挂自定义界面 / 按钮 / 设置页时 |
| `tools.md` | 动态 Tool 注册（`harness.defineTool`/`registerTool`）、~38 已有工具名、schema 与 execute 契约 | 自定义/注册 agent 可见工具时；查询已有工具名是否冲突 |
| `packaging.md` | DSH 静态插件打包全流程（profile/bundle、`dsh.bundle.patch`、`cordis.patch.yml`、`dsh plugin`、四层加载、安装坑、身份/TS/Windows 坑、机制漂移警示） | 要把插件装成 DSH profile bundle 时（DSH 侧格式） |
| `agent-plugins-1.0.md` | Agent Plugins 1.0 规范（plugin.json schema、skills/ 布局、mcp.json）、单目录双格式布局图 | 要写第二个格式（agent-plugins 兼容客户端）的声明时 |
| `ecosystem.md` | 社区参考实现与工具索引（模板/脚手架/健康检查/踩坑档案/市场） | 要找真实范例、社区工具、发布渠道时 |
| `sources.md` | 来源与核验总账（采集来源/日期/裁决记录/有效期） | 要核实事实来源、判断事实是否过期时 |

## 快速决策

- 想知道"某个能力在运行时候不存在" → 读对应文件，注意 `⚠️ 纠偏` 标注。
- 每个文件 ≤200 行；全部 ≤1200 行。事实条目以"精确名 + 出处行号"为准，改动请回源核实。

## ⚠️ 统一纠偏清单（runtime-inventory 为准，与二手文档/任务假设的差异）

1. `harness` 是 **Host 沙箱全局对象**，不是 `ctx.get('harness')` 服务。
2. `Builtin` 是 Cordis Inspect 的**类别**（数出 Host 7 / Client 5 个沙箱符号），非"消息源枚举"枚举。
3. 动态 Tool 名是 `ask_user_question`（**非 `ask_user`**）；**无 `jig`**。
4. 无集中式 `ToolName` 字面量联合 / `ToolArgsMap` 名；权威名即各 `defineTool` 的 `name` 字段。
5. 插件生命周期**无 `daemon(`、`ctx.start()`/`ctx.stop()`**；唯一 start/stop 风格辅助是 `fiber.restart()`。
6. Client Slot **无字面 `*` 通配 / anchor key**；`tool.call.toolview` 等是按工具/命令名的 keyed（动态 entryKey）座位。

## 来源可用性

- ✅ 真实运行时：`node_global\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\`（191 包，`cordis` 含 `src/*.ts`；余为可读 `lib/*.js` + `lib/types/*.d.ts`）。
- ✅ launcher：`…\node_global\node_modules\@deepseek-ai\dsh\lib\`（仅启动/配置，无域事件/服务定义）。
- ❌ `C:\Users\32115\.dsh\profiles\web\node_modules\@deepseek-ai\…` 本机不存在；以 launcher 嵌套形式采集。
- ⚠️ 仅 `dsh-web-frontend/dist/*` 为压缩 bundle，只作交叉验证，未逐条采集。

> 下文各页面必要时引用行号，例如「`dsh-tool-cordis/lib/index.js:3349`」，便于回源核对。
