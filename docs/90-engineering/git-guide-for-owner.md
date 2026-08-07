# Git 与 GitHub 使用指南（项目负责人版）

更新日期：2026-08-07

这份指南以当前项目为例，只覆盖日常开发最需要掌握的操作。

## 先理解本地与远端

Git 不会在每次编辑文件时自动保存两个仓库。

```text
修改文件
  ↓ git add
暂存本次要保存的内容
  ↓ git commit
保存到当前电脑的本地仓库
  ↓ git push
上传到 GitHub 远端仓库
```

- 本地仓库：当前电脑中项目目录下的 `.git` 版本历史；
- 远端仓库：GitHub 上的 `lceywhite/asset-tracker`；
- `commit`：本地生成一次有说明的版本快照；
- `push`：把本地尚未上传的提交发到 GitHub；
- `pull`：把 GitHub 的新提交下载并整合到当前电脑；
- `clone`：在一台新电脑上首次下载整个仓库及历史；
- `branch`：从稳定版本分出一条独立开发线；
- `tag`：固定版本书签，适合标记可回滚基线。

编辑器的自动保存只会保存文件，不等于 `commit`；完成 `commit` 也不等于已经上传，必须成功执行 `push`。

当前例子：`fbb573b` 是 Windows 本地已经存在的行程模块 v3 提交；只有 `git push` 成功后，GitHub 和另一台 Mac 才能看到它。

## 怎么判断是否同步

```bash
git status -sb
```

常见结果：

- `## main...origin/main`：本地与远端一致，且没有未提交文件；
- `ahead 1`：本地多一个提交，需要 `git push`；
- `behind 1`：远端多一个提交，需要先 `git pull --ff-only`；
- `M 文件名`：文件已修改但尚未提交；
- `?? 文件名`：新文件还未纳入 Git。

查看最近版本：

```bash
git log --oneline --decorate -10
```

## 一次标准更新

开始工作前：

```bash
git switch main
git pull --ff-only
git status -sb
```

修改完成后：

```bash
npm run check
git status
git diff
git add <与本次任务有关的文件>
git commit -m "feat: 简要说明变动"
git push
```

不要习惯性使用 `git add .`，先看 `git status`，再明确选择本次文件，可以避免把密码、临时文件或无关修改一起提交。

## 推荐的功能分支流程

```bash
git switch main
git pull --ff-only
git switch -c feature/item-home-v3
```

开发并检查后：

```bash
git add <相关文件>
git commit -m "feat: implement item home v3"
git push -u origin feature/item-home-v3
```

随后在 GitHub 创建 Pull Request（PR）。PR 是“申请把功能分支合并回主线”，可以集中查看改了什么、检查是否通过，并留下决策记录。合并后，两台电脑都回到 `main` 并拉取最新版本。

## 回看与恢复版本

当前安全基线为 `baseline-2026-07-16`。

当前行程模块 v3 功能里程碑提交为 `fbb573b`。它在远端推送并通过 CI 前，仍不能代替 GitHub 上的共同基线。

临时查看，不改变主线：

```bash
git switch --detach baseline-2026-07-16
```

查看后返回：

```bash
git switch main
```

基于旧版本建立恢复分支：

```bash
git switch -c restore/baseline-2026-07-16 baseline-2026-07-16
```

这比直接重置主线安全。没有明确确认时，不使用：

```text
git reset --hard
git push --force
```

前者可能丢失本机未提交内容，后者可能改写 GitHub 上其他设备正在使用的历史。

## Windows 与 Mac 来回切换

在电脑 A 结束工作时：检查、提交并 `push`。在电脑 B 开始工作时：先确认没有本机遗留修改，再 `pull --ff-only`。不要在 A 尚未上传时直接到 B 修改同一功能。

如果忘记上传：电脑 B 看不到电脑 A 的最新提交，因为两台电脑的本地仓库彼此不会直接通信，它们通过 GitHub 中转。

## Git 不会同步什么

- Windows 浏览器、Mac 浏览器和 iPhone App 的 IndexedDB 业务数据；
- 未提交的文件修改；
- 被 `.gitignore` 排除的依赖、构建输出和本机文件；
- 密码、Apple 私钥等不应进入仓库的敏感信息。

业务数据要在应用内使用“导出完整备份”和“从备份恢复”。

## 出错时先做什么

先停止继续操作，并保存以下输出：

```bash
git status -sb
git log --oneline --decorate -10
git remote -v
```

把输出交给 Codex 判断。不要因为看到红字就删除 `.git`、重新复制整个工程或强制推送；多数问题都能在保留历史的情况下解决。

## 日常速查

| 目的         | 命令                               |
| ------------ | ---------------------------------- |
| 查看当前状态 | `git status -sb`                   |
| 下载远端更新 | `git pull --ff-only`               |
| 查看具体修改 | `git diff`                         |
| 暂存指定文件 | `git add <文件>`                   |
| 创建本地版本 | `git commit -m "说明"`             |
| 上传本地提交 | `git push`                         |
| 查看最近历史 | `git log --oneline --decorate -10` |
| 新建功能分支 | `git switch -c feature/名称`       |
| 切回主线     | `git switch main`                  |
