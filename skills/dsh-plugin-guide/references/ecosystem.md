# 生态与参考实现（ecosystem.md）

> 从社区 dsh-plugin-guide（PerryLink）生态档案提炼的关键参考实现与工具索引。
> 链接指向社区仓库；机制/版本以当前宿主运行时为准（见 packaging.md §11 机制漂移警示）。
> 社区生态主要为 DSH-only 单格式；本插件定位双格式 + 已核实事实库——参考实现用于"看真实范例"，不替代事实库。

## 模板与脚手架

- [`omdsh-dev/plugin-template`](https://github.com/omdsh-dev/plugin-template) — 完整生产模板：src 四文件结构 + 7 个开发 skill + tsdown 自包含 prepare + 契约文档 `docs/dsh-plugin-contracts.md`
- [`whyihaveyou/dsh-suite`](https://github.com/whyihaveyou/dsh-suite) — `npm create dsh-plugin@latest` 脚手架（tool/events/webui 三模板）+ 167+ 插件双语目录 + 每日兼容性 CI（🟢/⚪ 徽章）
- 官方 [RFC #1629](https://github.com/deepseek-ai/deepseek-harness/discussions/1629)（2026-08-15）— 官方插件脚手架 template repo + `pnpm create dsh-plugin` 提案（直指 dsh-tools `latest` 版本火车混淆，见 packaging.md §8）

## 健康检查与踩坑档案

- [`omdsh-dev/dsh-plugin-check`](https://github.com/omdsh-dev/dsh-plugin-check) — 插件健康检查：清单协议 / patch 格式 / 构建陷阱（发布前跑）
- [`omdsh-dev/dsh-plugin-dev`](https://github.com/omdsh-dev/dsh-plugin-dev) — 踩坑档案 skill + 文档（20 个实测坑）
- [`Opr4Mp3r/deepseek-harness-plugin-from-scratch`](https://github.com/Opr4Mp3r/deepseek-harness-plugin-from-scratch) — 代码审计式渐进教程：checkpoint + 反模式 17 坑 + 交付检查单（锁 harness@47f9438 / npm rc.6）

## 分发与市场

- GitHub topic [`dsh-plugin`](https://github.com/topics/dsh-plugin) — 官方推荐打标提升可见度（本仓库已打）
- [`vlln/plugin-registry`](https://github.com/vlln/plugin-registry) — 插件注册控制台 + make-dsh-plugin skill；注意其记录的机制时间线（repository-plugin 0809 推出、0811 移除）
- [`omdsh-dev/dsh-hub-workshop`](https://github.com/omdsh-dev/dsh-hub-workshop) — 插件市场/注册 workshop（"发现 ≠ 安装权限"，注意信任边界）
