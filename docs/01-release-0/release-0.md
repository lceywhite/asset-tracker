# Release 0：稳定化基线

状态：已完成（2026-07-14）  
版本：0.2.0-alpha.0

已完成：

- 修复首页缺失空间服务导入。
- 数据库升级至 v4，补齐 `activities.startDate/status` 与 `activityItems.activityId` 索引和范围查询。
- 新库 seed 改为升级事务内同步排队，移除悬空动态导入。
- 行程核对和提醒改为持久化回写；新行程不再双写 activityItems。
- 删除房间或包时以事务解除物品引用，避免悬空外键。
- 增加完整备份 v1、格式预检、替换/合并恢复和全量清空。
- 增加全局启动错误页，异常时不自动删除用户数据。
- 移除社区占位导航，统一 Alpha 版本语义。
- 增加最小自动化测试、README、数据字典和新版开发规划。
- 增加 ESLint、Prettier、GitHub Actions CI 和统一 `npm run check` 质量门。
- 增加真实 DB v3 fixture、v4 升级、备份 round-trip 集成测试和 Edge 浏览器 smoke。
- 升级至 Vite 8.1.4 / Vue Plugin 6.0.4；生产与开发依赖安全审计均为 0 漏洞。

验证结果：

- `npm run check`：ESLint、Prettier、4 项自动化测试和 Vite 生产构建全部通过。
- `npm run smoke`：DB v3→v4、物品新增、行程创建、核对刷新持久化和完整备份导出通过。
- `npm audit`：生产和完整依赖树均为 0 个已知漏洞。

Release 1 前置遗留：Activity/Checklist 的统一迁移 fixture、损坏备份产品化提示、图片 Blob 仓储和统一 Plan/CheckSession 模型。
