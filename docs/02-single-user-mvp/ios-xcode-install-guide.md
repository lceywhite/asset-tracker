# 通过 Xcode 安装到 iPhone

本指南对应 `1.0.0-beta.1`，目标是个人真机测试，不包含 App Store 审核或 TestFlight 分发。

## 准备条件

- 一台 Mac；
- Node.js 22 或更高版本；
- Xcode 26 或更高版本及 Xcode Command Line Tools；
- 一台 iOS 15 或更高版本的 iPhone；
- 一个可登录 Xcode 的 Apple ID。免费个人 Team 可用于自己的设备测试。

本工程使用 Swift Package Manager，无需另装 CocoaPods。

## 第一次安装

在 Mac 终端进入项目目录：

```bash
npm ci
npm run check
npm run ios:sync
npm run ios:open
```

随后在 Xcode 中：

1. 在左侧选择蓝色 `App` 工程，再选择 `App` Target。
2. 打开 `Signing & Capabilities`，勾选自动签名并选择你的 Team。
3. 如果 Bundle Identifier 冲突，把 `com.assettracker.personal` 改成你的唯一值，例如 `com.你的名字.assettracker`；同时同步修改根目录 `capacitor.config.json`，避免以后认错工程身份。
4. 用数据线连接并解锁 iPhone，在顶部运行目标中选择这台 iPhone。
5. 如果手机提示，打开“设置 → 隐私与安全性 → 开发者模式”，重启后确认。
6. 点击 Xcode 左上角运行按钮。首次安装时按手机提示信任开发者。

成功标准：iPhone 主屏出现“物品守护”，断网冷启动后仍可进入四个 Tab，并能新增物品和行程。

## 后续更新

每次网页代码变动后先同步，再回到 Xcode 运行：

```bash
npm run ios:sync
```

不要直接编辑 `ios/App/App/public`，它会在同步时被重新生成。原生配置（签名、权限、版本）位于 `ios/App`。

## 真机测试注意

- 删除 App 会一并删除本机业务数据；删除前先到“我的 → 导出完整备份”。
- 免费个人签名通常有有效期，过期后重新连接 Xcode 运行即可；具体限制以 Apple 当前规则为准。
- 本阶段只验证 Xcode 直装。若要提交 App Store，还需要正式图标、隐私清单复核、商店资料、归档签名和审核测试。
