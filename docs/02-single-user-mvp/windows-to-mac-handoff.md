# Windows 开发工程迁移到 Mac

推荐通过私有 Git 仓库迁移；直接压缩工程目录也可行，但不要把 Windows 的 `node_modules` 当作可复用依赖带到 Mac。

## 方案 A：私有 Git 仓库（推荐）

当前目录尚未初始化为 Git 仓库。首次迁移时可在 Windows 项目根目录执行：

```bash
git init
git add .
git commit -m "Single-user MVP beta 1"
git branch -M main
git remote add origin <你的私有仓库地址>
git push -u origin main
```

提交前确认 `.gitignore` 已排除 `node_modules`、`dist`、测试输出和日志，并确认仓库中没有密码、证书或 Apple 私钥。

在 Mac 上：

```bash
git clone <你的私有仓库地址>
cd asset-tracker
npm ci
npm run check
npm run ios:sync
npm run ios:open
```

后续 Windows 和 Mac 都通过 `git pull` / `git push` 同步源代码。每次切到 Mac 真机测试前重新执行 `npm ci`（锁文件变化时）和 `npm run ios:sync`。

## 方案 B：压缩包或移动硬盘

复制项目时应保留：

- `src`、`docs`、`scripts`、`test`、`ios`；
- `package.json`、`package-lock.json`、`capacitor.config.json`；
- Vite、Tailwind、ESLint、Prettier 等配置文件；
- 所有以 `.` 开头的配置文件。

可以排除：

- `node_modules`；
- `dist`；
- `test-results`；
- `ios/App/App/public`（会由 `npm run ios:sync` 重新生成）；
- 日志、缓存和编辑器临时目录。

在 Mac 解压后运行：

```bash
rm -rf node_modules
npm ci
npm run check
npm run ios:sync
npm run ios:open
```

不要只复制 `ios` 文件夹。Xcode 工程需要根目录网页源代码、npm 锁文件和 Capacitor 配置才能持续更新。

## 数据与代码不是同一件事

迁移工程文件不会带走 Windows 浏览器里已经录入的物品和行程。需要在 Windows 网页端进入“我的 → 导出完整备份”，再在 Mac 浏览器或 iPhone App 的“我的 → 从备份恢复”中导入。

当前网页端、Mac 浏览器和 iPhone App 各自保存一份本地数据；在云同步功能完成前，它们不会自动互相同步。
