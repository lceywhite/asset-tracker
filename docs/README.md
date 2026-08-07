# 项目文档索引

更新日期：2026-08-07

文档按开发阶段归档。编号表示阅读和开发顺序；跨阶段的工程参考集中放在 `90-engineering`。

## 00 — 产品规划

- [新版产品开发规划 v3](00-planning/product-development-plan-v2.md)：产品定位、路线图、阶段目标和执行看板。
- [当前开发进度](00-planning/current-development-status.md)：App、物品、行程、数据和真机验收的真实状态快照。
- [版本管理规范](00-planning/version-management.md)：区分 App、阶段、模块、原型、数据与 Git 版本。
- [产品对话归档索引](00-planning/conversation-archive-index.md)：按时间和开发阶段定位完整需求与回复记录。
- [产品迭代日志](00-planning/product-changelog.md)：面向产品、运营和测试的非技术变更记录。

## 01 — Release 0 稳定化

- [Release 0 记录](01-release-0/release-0.md)：数据库升级、备份、测试、构建与质量门。

## 02 — 单人 MVP

- [Beta 1 发布记录](02-single-user-mvp/release-1-beta-1.md)：单人 MVP 与 iPhone 测试范围。
- [Xcode 安装到 iPhone](02-single-user-mvp/ios-xcode-install-guide.md)：Mac、签名、同步和真机安装步骤。
- [Windows 迁移到 Mac](02-single-user-mvp/windows-to-mac-handoff.md)：GitHub 下载、Mac 环境、Xcode 真机安装和数据迁移。

## 03 — 物品模块 v3

- [设计总说明](03-item-module-v3/item-module-v3-design-spec.md)：物品档案与物品主页的最终设计基线。
- [后端实现记录](03-item-module-v3/item-module-v3-backend-implementation.md)：物品模块接入时的数据库 v6、兼容迁移、物品档案、空间树、布局和备份能力；全局当前版本见数据字典。
- [设计迭代日志](03-item-module-v3/item-module-v3-iteration-log.md)：产品经理可读的逐轮设计变化。
- [档案设计决策与待办](03-item-module-v3/item-module-design-decisions.md)：字段、属性组和估值偏好。
- [主页历史设计记录](03-item-module-v3/item-home-design-history-v3.md)：被调整与被否决方案的过程记录。
- [原型索引](03-item-module-v3/prototypes/README.md)：物品档案 v3 与物品主页 v3 交互原型。
- [对话决策与原文参考](03-item-module-v3/references/item-module-v3-conversation-reference.md)：决策摘要及完整用户/Codex 对话原文。
- [工程阶段对话续录](03-item-module-v3/references/item-module-v3-engineering-conversation-continuation.md)：Git 建仓、正式接入、界面修正、Mac 交接和转入行程模块的完整可见对话。

## 04 — 行程模块 v2 历史归档

- [最终确认原型](04-trip-module-v2/prototypes/trip-module-v2-timeline.html)：行程模块 v2 原型第 11 版初始基线；正式工程中的 2026-08-07 校正以行动档案设计和迭代日志为准。
- [行动档案设计](04-trip-module-v2/trip-module-v2-action-record-design.md)：通勤、外出、旅行和搬家共用的已确认产品基线。
- [工程接入计划](04-trip-module-v2/trip-module-v2-implementation-plan.md)：数据模型、迁移、页面拆分、测试和实施顺序。
- [设计草案与工程细节](04-trip-module-v2/trip-module-v2-design-draft.md)：设计演进和接入阶段继续验证的细节。
- [设计迭代日志](04-trip-module-v2/trip-module-v2-iteration-log.md)：面向非编程人员记录每轮界面与功能变化。
- [对话决策与完整原文](04-trip-module-v2/references/trip-module-v2-conversation-reference.md)：从第一版到第 11 版确认及正式工程校正的用户/Codex 可见对话。
- [第一版历史原型](04-trip-module-v2/prototypes/trip-module-v2.html)：用于追溯早期交互，不作为当前实现依据。

## 05 — 行程模块 v3

- [当前基线索引](05-trip-module-v3/README.md)：当前版本边界、正式设计与 v2 历史入口。
- [设计总说明](05-trip-module-v3/trip-module-v3-design-spec.md)：主页、建档、携带清单、档案、核对和视觉规则。

## 90 — 工程参考

- [数据字典](90-engineering/data-dictionary.md)：单人 MVP 的数据实体、字段和关系。
- [Codex Windows / Mac 双端协同规范](90-engineering/codex-windows-mac-collaboration.md)：双端职责、接手顺序、切换流程与冲突边界。
- [Git 与 GitHub 使用指南](90-engineering/git-guide-for-owner.md)：面向项目负责人的本地/远端、提交、同步、分支和回滚说明。

## 使用规则

- 产品和界面实现优先使用当前阶段的“设计总说明”和定稿原型。
- 历史设计记录与原始对话用于追溯原因，不覆盖后续明确确认的决策。
- 对话引用中的旧路径保持原文，不代表当前文件位置；当前路径以本索引为准。
