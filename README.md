# 物品守护（Asset Tracker）

本地优先的个人物品与出行核对 App。当前版本为 `1.0.0-beta.1`：保留“物品 / 行程 / 社区 / 我的”四个核心 Tab，并提供可通过 Xcode 安装到 iPhone 的 Capacitor iOS 工程。

## 开发与校验

需要 Node.js 22 或更高版本、npm 10 或更高版本。

```bash
npm install
npm run dev
npm run check
```

常用命令：

```bash
npm run smoke      # iPhone 尺寸核心流程测试（需先启动开发服务器）
npm run ios:sync   # 构建网页资源并同步到 Xcode 工程
npm run ios:open   # 在 macOS 上用 Xcode 打开 iOS 工程
npm run ios:run    # 同步后选择模拟器或真机运行
```

Windows PowerShell 若限制执行 `npm.ps1`，可将 `npm` 改为 `npm.cmd`。

## 当前架构

- Vue 3、Vite、Vue Router、Pinia、Tailwind CSS
- Capacitor 8 + Swift Package Manager 原生 iOS 容器
- IndexedDB v8 保存物品档案 v3、分区、空间树、布局、位置、行程模块 v3（内部 Plan modelVersion 3）与独立核对记录
- JSON 备份 v3 覆盖 12 个数据表和已知本地偏好，并兼容 v1/v2 备份
- 原生分享、文件写入、触觉反馈、状态栏和启动屏插件

业务数据默认保存在当前 App 容器。删除 App 前应先到“我的 → 导出完整备份”，通过 iOS 分享面板保存到“文件”或其他安全位置。

## 文档

- [文档总索引](docs/README.md)
- [新版产品开发规划](docs/00-planning/product-development-plan-v2.md)
- [当前开发进度](docs/00-planning/current-development-status.md)
- [版本管理规范](docs/00-planning/version-management.md)
- [产品迭代日志（非技术版）](docs/00-planning/product-changelog.md)
- [Xcode 安装到 iPhone 指南](docs/02-single-user-mvp/ios-xcode-install-guide.md)
- [Windows 迁移到 Mac 指南](docs/02-single-user-mvp/windows-to-mac-handoff.md)
- [Codex Windows / Mac 双端协同规范](docs/90-engineering/codex-windows-mac-collaboration.md)
- [Git 与 GitHub 使用指南](docs/90-engineering/git-guide-for-owner.md)
- [数据字典](docs/90-engineering/data-dictionary.md)
- [Release 0 记录](docs/01-release-0/release-0.md)
- [单人 MVP Beta 1 记录](docs/02-single-user-mvp/release-1-beta-1.md)
- [物品模块 v3 设计总说明](docs/03-item-module-v3/item-module-v3-design-spec.md)
- [行程模块 v3 当前设计与工程基线](docs/05-trip-module-v3/README.md)
- [行程模块 v2 原型与工程历史归档](docs/04-trip-module-v2/README.md)

## 当前边界

- 社区只保留真实入口和能力说明，尚无账号、内容发布、评论或云端数据。
- “我的”是单人本地资料，不代表已注册的在线账户。
- 旧 Checklist、QR 和演示空间代码不在正式路由中，仅保留为后续迁移参考。
- 图片仍以 Data URL 保存；大量照片使用前需要完成压缩和媒体仓储升级。
- Windows 可以生成、同步 iOS 工程，但最终签名、编译和真机安装必须在 macOS + Xcode 完成。
