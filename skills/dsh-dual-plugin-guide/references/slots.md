# Client Slot 清单（slots.md）

> 依据 runtime-inventory.md（权威）`dsh-client-runtime/lib/client.js`（SlotRegistry）+ 各 `lib/types/client/*slots*.d.ts`。
> **共 42 个唯一 Slot 名**。权威来源 `dsh-cordis-client-runner/lib/client.js:3599` `Slots.listSubTree`（读 `ctx.get("slots")`）。

⚠️ 纠偏：**无字面 `*` 通配/anchor slot key**。`tool.call.toolview`、`conversation.chat.commandview` 是按工具/命令名的 **keyed（动态 entryKey）** 座位，非通配字符串。

## 1. 注册模式（slots.inject + register）

```js
// Client 沙箱内：ctx.slots.register({ name:'sidebar.footer.action', … })
ctx.slots.register({
  name: 'my.slot',            // 唯一的 slot 名
  kind: 'single'|'list'|'keyed'|'chain',  // 协议
  // …render payload
})

// 消费端读取子树（Inspect）
const list = ctx.slots.listSubTree()      // Client 端 Slots.listSubTree
```

## 2. Slot 协议四种

- **single** —— 单实例渲染（如 `conversation.session`、`conversation.input.model`）。
- **list** —— 无序/有序注册的列表（如 `conversation.input.right`、`settings.action`）。
- **keyed** —— 按动态 entryKey 分派（`tool.call.toolview` 按工具名、`conversation.chat.commandview` 按命令名）。
- **chain** —— 链式/内含子 slot（如 `conversation.composer`、`conversation.chat.turnTail`）。

## 3. Slot 目录（42，按 root/sidebar/conversation/settings/tool 分组）

### 框架 / 根轴（5）
`root`（Shell 唯一 ctx 级渲染入口）、`sidebar`、`conversation`（scope `session-maybe`）、`details`（scope `session`）、`shell.overlay`（kind list, scope root）。

### Conversation 系（22）
`conversation.session`（single）、`conversation.session.header`、`conversation.session.header.actions`（list）、`conversation.session.header.utilities`（list）、
`conversation.view`（list）、`conversation.chat.node`（同名注册 15 处；keyed 业务节点）、`conversation.chat.commandview`（keyed，entryKey=命令名）、
`conversation.chat.turnTail`（chain）、`conversation.chat.assistant-actions`（list）、`conversation.details.tool`（single）、`conversation.composer`（chain）、
`conversation.composer.bar`、`conversation.composer.dock`、`conversation.input.dock`（list）、`conversation.input.left`（list）、`conversation.input.right`（list）、
`conversation.input.plan`、`conversation.input.model`（single）、`conversation.input.overlay`、`conversation.hero.workspace`（single, scope root）、
`conversation.hero.agentPreset`、`conversation.hero.workspace.directoryFlow`。

### Sidebar 系（4）
`sidebar.workspaces`、`sidebar.workspaces.directoryFlow`、`sidebar.settings`、`sidebar.footer.action`。

### Settings 系（9）
`settings.section`、`settings.general.item`（list）、`settings.plugin.item`（list）、`settings.plugins.tab`（list）、`settings.onboarding`（list）、
`settings.trigger`、`settings.header`、`settings.action`（id:"open-document", list）、`settings.close`。

### Tool 系（2）
`tool.call.toolview`（keyed，按工具名分派）、`tool.view.cordis`（`children:{ "tool.view.cordis": … }` 挂于 `tool.call.toolview`）。

## 4. 常见入口选择建议

| 想要的效果 | 用 Slot | 说明 |
|---|---|---|
| 工具执行时的自定义 UI 卡片/视图 | `tool.call.toolview`（keyed by 工具名） | 再挂子 slot，如 `tool.view.cordis` |
| 在设置页加一个分区/页签 | `settings.section` / `settings.plugins.tab` | 注册方多为 settings 相关包 |
| 侧栏底部加一个动作按钮 | `sidebar.footer.action` | |
| 会话头部加操作/工具 | `conversation.session.header.actions`（list） / `.utilities`（list） | |
| 会话输入区加按钮/图标 | `conversation.input.left` / `conversation.input.right`（list） | |
| 输入框上方 / 底下栏 | `conversation.composer.bar` / `conversation.composer.dock` | |
| 通用权限预设 / 主题入口 | `settings.general.item`（list） | |

> 注册者实例（作参考）：`chat.fileMentions`→`conversation.chat.turnTail`；`ui-cordis`→`sidebar.footer.action`、`tool.view.cordis`；
> `ui-agent-preset`→`conversation.hero.agentPreset`、`conversation.session.header.actions`；`ui-tool`→`conversation.chat.node`、`conversation.details.tool`。
