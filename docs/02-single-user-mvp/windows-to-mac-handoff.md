# Windows 迁移到 Mac 与 Xcode 指引

更新日期：2026-07-16

推荐通过当前 GitHub 私有仓库迁移，不需要压缩整个 Windows 工程发送到 Mac。Git 会下载源代码、工程配置、文档和版本历史；依赖需要在 Mac 重新安装，Xcode 签名需要在 Mac 单独配置。

## 迁移前确认

Windows 端先确认所有需要带走的工作都已提交并上传：

```bash
git status -sb
git log --oneline --decorate -5
```

理想状态应显示 `main...origin/main`，没有 `ahead`、`M` 或 `??`。如果有修改，先检查、提交并执行 `git push`。

当前仓库信息：

- 地址：`https://github.com/lceywhite/asset-tracker`
- 权限：私有；
- 默认分支：`main`；
- 已归档基线：`baseline-2026-07-16`。

## Mac 准备

安装：

1. Xcode，并至少启动一次接受许可和安装组件；
2. Xcode Command Line Tools；
3. Git；
4. Node.js 22 或更高版本；
5. GitHub CLI（推荐，命令为 `gh`）；
6. Codex，并登录与 Windows 相同的工作账号或按实际账号配置。

检查环境：

```bash
xcode-select -p
git --version
node --version
npm --version
gh --version
```

## 登录 GitHub

在 Mac 终端执行：

```bash
gh auth login
```

按提示选择：

1. `GitHub.com`；
2. `HTTPS`；
3. 使用浏览器登录；
4. 登录拥有私有仓库权限的 `lceywhite` 账号。

验证：

```bash
gh auth status
```

仅登录 GitHub 网站并不会自动把项目放到 Mac；还需要执行一次 `git clone`。

## 第一次下载项目

选择一个用于开发的父目录，不要先手动创建同名非空工程目录：

```bash
git clone https://github.com/lceywhite/asset-tracker.git
cd asset-tracker
git status -sb
git log --oneline --decorate -5
```

此时应看到 `main` 跟踪 `origin/main`，最新提交与 GitHub 一致。

安装 Mac 版本依赖并验证：

```bash
npm ci
npm run check
```

`node_modules` 不能从 Windows 复制，因为其中可能包含与操作系统和 CPU 架构有关的内容。`npm ci` 会严格按照 `package-lock.json` 重建依赖。

## 网页端预览

```bash
npm run dev
```

根据终端输出在浏览器打开本地地址。Windows 和 Mac 都可以用同一方式预览网页端。

## 生成并打开 iOS 工程

```bash
npm run ios:sync
npm run ios:open
```

- `ios:sync` 会构建网页资源并同步到 Capacitor iOS 工程；
- `ios:open` 会在 Xcode 打开 `ios/App`；
- 不要直接编辑 `ios/App/App/public`，下次同步会覆盖它。

## Xcode 签名与 iPhone 安装

在 Xcode 中：

1. 选择蓝色 `App` 工程和 `App` Target；
2. 打开 `Signing & Capabilities`；
3. 勾选自动管理签名并选择自己的 Apple Team；
4. 如 Bundle Identifier 冲突，使用个人唯一标识，并记录修改原因；
5. 连接并解锁 iPhone，在运行目标中选择该设备；
6. 按手机提示启用开发者模式和信任；
7. 点击 Run 完成编译、签名和安装。

更完整步骤见 `docs/02-single-user-mvp/ios-xcode-install-guide.md`。

## 让 Mac 上的 Codex 接手

在 Mac 的 Codex 中打开克隆后的 `asset-tracker` 根目录，并给出以下交接指令：

```text
这是 Asset Tracker 的 Mac 开发环境。开始任何修改前，请先阅读 README.md、docs/README.md、docs/90-engineering/codex-windows-mac-collaboration.md 和当前模块设计文档；先检查 git status、当前分支、最近提交和远端状态。保留用户已有改动，不执行破坏性 Git 操作。网页功能可在 Mac 调试，iOS 相关变动需完成 npm run ios:sync、Xcode 构建和 iPhone 真机验证。界面工程调整仍需遵守先确认设计再开始对应代码的约定。
```

Codex 应从仓库文档和 Git 历史继续工作，而不是根据一段简短提示重新猜测产品需求。

## 后续双端更新

离开 Windows 或 Mac 前：

```bash
git status
npm run check
git add <本次相关文件>
git commit -m "类型: 本次变动说明"
git push
```

切换到另一台电脑后：

```bash
git status -sb
git switch main
git pull --ff-only
```

如果当前使用功能分支，应拉取并切换到对应分支，不要误在 `main` 重复开发。

## 业务数据迁移

Git 迁移不包含 Windows 浏览器中已录入的物品、行程、图片和本地偏好。当前网页端、Mac 浏览器与 iPhone App 各自保存本地数据，尚不会自动互相同步。

迁移测试数据：

1. Windows 网页端进入“我的 → 导出完整备份”；
2. 把导出的备份文件安全传到 Mac 或 iPhone；
3. 在目标端进入“我的 → 从备份恢复”；
4. 恢复后抽查物品、行程、图片和设置。

删除 iPhone App 前也必须先导出备份。

## 不要迁移或提交的内容

- Windows 的 `node_modules`、`dist`、缓存和测试报告；
- `.env`、令牌、密码；
- Apple 开发证书、私钥和 Provisioning Profile；
- Xcode 个人用户状态；
- 未确认用途的大体积本地文件。

不要通过微信或网盘反复传递整个工程作为日常同步方式，否则容易产生两个无法判断谁更新的副本。GitHub 应作为代码的唯一共同来源。

## 常见问题

### Mac 能下载但不能安装到 iPhone

代码访问和 Apple 签名是两套权限。检查 Xcode Apple ID、Team、Bundle Identifier、开发者模式和设备信任。

### `npm ci` 失败

确认 Node.js 版本满足 `>=22`，网络可访问 npm，并保留仓库中的 `package-lock.json`。不要先复制 Windows 的 `node_modules`。

### `git pull --ff-only` 失败

通常表示 Mac 有未上传提交，或 Windows 与 Mac 分别产生了不同历史。停止继续修改，执行 `git status -sb` 和 `git log --oneline --decorate -10`，交给 Codex 分析后再合并；不要直接强制覆盖。

### Xcode 中网页内容不是最新

先在项目根目录执行 `npm run ios:sync`，等待成功后回到 Xcode 重新运行。
