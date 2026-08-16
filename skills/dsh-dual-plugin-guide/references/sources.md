# 来源与核验总账（sources.md）

> 本文件记录事实库的来源、采集环境、核验日期与裁决记录——把"已核实"变成"可审计"。
> 吸收自社区 dsh-plugin-guide（PerryLink）的 sources 总账实践。

## 事实库来源

| 事实文件 | 性质 | 采集来源 | 采集日期 | 绑定版本 |
|---|---|---|---|---|
| `runtime-inventory.md`（项目侧） | **运行时事实（最权威）** | 本机已装 `@deepseek-ai/dsh@0.1.0-rc.6` 嵌套依赖（node_global 下 191 包；`cordis` 含 `src/*.ts`，余为可读 `lib/*.js` + `lib/types/*.d.ts`） | 2026-08-16 | DSH 0.1.0-rc.6 |
| `docs-catalog.md`（项目侧） | 官方文档提炼 | `deepseek-ai/deepseek-harness` master 分支 `docs/`（16 页全部 200 抓取成功） | 2026-08-16 | master@当日 |
| `static-plugin-reference.md`（项目侧） | 打包流程 | `docs/user/develop/basic/*` + `docs/cookbook/*` | 2026-08-16 | master@当日 |
| `perrylink-absorption-report.md`（项目侧） | 吸收评估 | `PerryLink/dsh-plugin-guide` 浅克隆 | 2026-08-16 | 当日 head |

> 以上四个采集文件位于 `D:\programming\projects\dsh_worlspace\dsh-plugin-skill-research\`，不在本插件包内。

## 裁决记录（矛盾处理）

- **原则：官方文档 ↔ 运行时代码矛盾时，以运行时代码为准**——官方原文可能过期（例：repository-plugin 0811 移除、服务批量改名 `httpServer→webServer`、`tasks→jobs`、`bash→shell`）。
- 已记录纠偏 7 条（见 `references/README.md`「统一纠偏清单」）：`harness` 非服务、`Builtin` 是类别、`ask_user_question` 非 ask_user、无 `jig`、无集中 `ToolName` 联合、无 `daemon`/`start`/`stop`、Slot 无字面通配 key。
- 内核内置事件计数：文档侧 15 vs 运行时 16（**运行时为准**：文档缺 `internal/config`、`hmr/config-update-failed`，多 `exit`）。

## 核验有效期

- 事实库绑定 **DSH `0.1.0-rc.6`**；宿主升级后需重新采集核对（runtime-inventory 的采集路径与行号会变）。
- 外部事实以文中标注的核验日期为准（例：`@deepseek-ai/dsh-tools` `latest`=0.0.1-rc.1、`next`=0.1.0-rc.6，2026-08-14 复核；见 packaging.md §8）。
- 社区链接（ecosystem.md）为当日快照，机制类信息以当前宿主运行时为准。
