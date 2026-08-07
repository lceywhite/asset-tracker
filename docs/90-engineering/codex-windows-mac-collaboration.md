# Codex Windows / Mac 双端开发协同规范

更新日期：2026-08-07

本文供 Windows 与 Mac 上的 Codex 在接手项目时共同遵循。目标是让两个环境围绕同一个 GitHub 仓库协作，避免覆盖代码、重复实现或误提交本机配置。

## 项目唯一来源

- GitHub 私有仓库：`https://github.com/lceywhite/asset-tracker`
- 稳定主分支：`main`
- 已归档早期标签：`baseline-2026-07-16`
- 当前行程里程碑标签：`trip-v3-integration-baseline`
- 当前功能里程碑：行程模块 v3，提交 `fbb573b`；下一阶段为单人 MVP 收口与发布准备。
- 产品与设计文档入口：`docs/README.md`
- 项目技术栈：Vue 3、Vite、Pinia、IndexedDB、Capacitor 8、iOS Swift Package Manager。

GitHub 仓库是代码、设计文档和工程配置的共同来源。浏览器与 iPhone App 中录入的物品、行程和图片属于本机业务数据，不进入 Git。

## 平台职责

### Windows

- 日常网页功能开发、界面预览和自动化检查；
- 数据模型、业务逻辑、文档和跨平台代码维护；
- 可以执行 `npm run ios:sync` 检查 Capacitor 同步，但不能完成 iOS 签名和真机安装。

### Mac

- 承接同一套网页和跨平台代码；
- Xcode 工程检查、Apple 签名、模拟器与 iPhone 真机测试；
- 将确实需要共享的 iOS 工程配置提交到 Git；
- 不提交个人证书、私钥、Provisioning Profile 或 Xcode 用户状态。

## Codex 接手前必读顺序

每次在任一电脑开始开发时，Codex 应先执行只读检查，再修改文件：

```bash
git status -sb
git branch --show-current
git log --oneline --decorate -5
git remote -v
```

随后阅读：

1. `README.md`；
2. `docs/README.md`；
3. `docs/00-planning/product-development-plan-v2.md`；
4. 当前模块的设计说明、迭代日志和已确认原型；
5. 本文以及 `docs/90-engineering/git-guide-for-owner.md`。
6. `docs/06-mvp-closure/project-progress-audit-and-plan.md`。

如果工作区不干净，Codex 必须先说明已有改动属于什么范围，不得直接覆盖、重置或删除。设计阶段与工程实现阶段仍按用户约定执行：涉及界面方案时先确认设计；开始对应工程代码前按用户要求确认。

## 每次切换电脑的标准流程

离开当前电脑前：

```bash
git status
npm run check
git add <本次相关文件>
git commit -m "docs: ..."  # 根据实际类型填写
git push
```

到另一台电脑后：

```bash
git status -sb
git switch main
git pull --ff-only
npm ci
npm run check
```

如果里程碑功能分支尚未合并到 `main`，先执行 `git fetch origin`，再切换到远端明确指定的功能分支；不要在落后的 `main` 上重复实现。当前行程 v3 分支为 `codex/trip-module-v3`。

只有 `package-lock.json` 变化、首次安装或依赖异常时才必须重新执行 `npm ci`；为了降低双端差异，也可以在每次重要测试前执行。

Mac 在 Xcode 测试前追加：

```bash
npm run ios:sync
npm run ios:open
```

`git pull --ff-only` 只接受清晰的快进更新，遇到双方分叉时会停止，便于先检查而不是自动制造难以理解的合并结果。

## 分支与提交约定

- `main` 只保存已经检查、可以继续开发的版本；
- 一个明确功能使用一个分支，例如 `feature/item-home-v3`；
- 文档整理可使用 `docs/mac-handoff`；
- 修复使用 `fix/简短问题名`；
- 同一时刻避免 Windows 和 Mac 修改同一文件；
- 提交应小而明确，不把无关改动混在一起。

推荐提交前缀：

- `feat:` 新功能；
- `fix:` 修复；
- `docs:` 文档；
- `refactor:` 不改变功能的代码整理；
- `test:` 测试；
- `chore:` 工程维护。

## 文件边界

应提交：

- `src`、`test`、`scripts`、`docs`；
- `ios` 中需要团队共享的工程配置与原生源代码；
- `package.json`、`package-lock.json`、`capacitor.config.json` 和构建配置。

不应提交：

- `node_modules`、`dist`、测试报告和缓存；
- `.env`、访问令牌、Apple 证书和私钥；
- 仅属于个人 Xcode 界面的 `xcuserdata`；
- 由 `npm run ios:sync` 重新生成的 `ios/App/App/public` 内容（除非仓库现行策略明确要求）。

不要直接编辑 `ios/App/App/public`，它会在 Capacitor 同步时被覆盖。

## 冲突处理

发现 `git pull` 失败或冲突时：

1. 停止继续编辑；
2. 执行 `git status` 记录冲突文件；
3. 比较 Windows、Mac 两侧意图和对应提交；
4. 只合并能解释清楚的内容；
5. 运行 `npm run check`，在 Mac 上再执行 iOS 同步和真机验证；
6. 未经用户确认，不使用 `git reset --hard`、强制推送或删除分支。

## 交接完成标准

- 当前工作已提交并推送，`git status -sb` 没有遗漏；
- 接收端已拉取到相同提交哈希；
- `npm run check` 通过；
- 影响 iOS 时，Mac 端 `npm run ios:sync` 和 Xcode 构建通过；
- 产品变化同步写入产品迭代日志，技术或协作变化同步更新对应工程文档；
- 需要迁移测试数据时，另行导出和导入应用备份。
