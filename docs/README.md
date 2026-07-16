# 项目文档索引

更新日期：2026-07-16

文档按开发阶段归档。编号表示阅读和开发顺序；跨阶段的工程参考集中放在 `90-engineering`。

## 00 — 产品规划

- [新版产品开发规划 v3](00-planning/product-development-plan-v2.md)：产品定位、路线图、阶段目标和执行看板。
- [产品迭代日志](00-planning/product-changelog.md)：面向产品、运营和测试的非技术变更记录。

## 01 — Release 0 稳定化

- [Release 0 记录](01-release-0/release-0.md)：数据库升级、备份、测试、构建与质量门。

## 02 — 单人 MVP

- [Beta 1 发布记录](02-single-user-mvp/release-1-beta-1.md)：单人 MVP 与 iPhone 测试范围。
- [Xcode 安装到 iPhone](02-single-user-mvp/ios-xcode-install-guide.md)：Mac、签名、同步和真机安装步骤。
- [Windows 迁移到 Mac](02-single-user-mvp/windows-to-mac-handoff.md)：GitHub 下载、Mac 环境、Xcode 真机安装和数据迁移。

## 03 — 物品模块 v3

- [设计总说明](03-item-module-v3/item-module-v3-design-spec.md)：物品档案与物品主页的最终设计基线。
- [设计迭代日志](03-item-module-v3/item-module-v3-iteration-log.md)：产品经理可读的逐轮设计变化。
- [档案设计决策与待办](03-item-module-v3/item-module-design-decisions.md)：字段、属性组和估值偏好。
- [主页历史设计记录](03-item-module-v3/item-home-design-history-v3.md)：被调整与被否决方案的过程记录。
- [原型索引](03-item-module-v3/prototypes/README.md)：物品档案 v3 与物品主页 v3 交互原型。
- [对话决策与原文参考](03-item-module-v3/references/item-module-v3-conversation-reference.md)：决策摘要及完整用户/Codex 对话原文。

## 90 — 工程参考

- [数据字典](90-engineering/data-dictionary.md)：单人 MVP 的数据实体、字段和关系。
- [Codex Windows / Mac 双端协同规范](90-engineering/codex-windows-mac-collaboration.md)：双端职责、接手顺序、切换流程与冲突边界。
- [Git 与 GitHub 使用指南](90-engineering/git-guide-for-owner.md)：面向项目负责人的本地/远端、提交、同步、分支和回滚说明。

## 使用规则

- 产品和界面实现优先使用当前阶段的“设计总说明”和定稿原型。
- 历史设计记录与原始对话用于追溯原因，不覆盖后续明确确认的决策。
- 对话引用中的旧路径保持原文，不代表当前文件位置；当前路径以本索引为准。
