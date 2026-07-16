export const RELEASE_NOTES = [
  {
    version: "1.0.0-beta.1",
    date: "2026-07-14",
    title: "单人 MVP · iPhone 测试版",
    summary: "核心结构稳定下来，并增加可以通过 Xcode 安装到 iPhone 的原生应用工程。",
    changes: [
      { area: "导航", text: "固定为物品、行程、社区、我的四个入口，减少选择成本。" },
      { area: "行程", text: "出发核对与返程核对分别保存，退出或刷新后进度不会写坏原清单。" },
      { area: "我的", text: "个人资料、数据备份、隐私说明、安装信息和版本记录集中到一个页面。" },
      { area: "iPhone", text: "新增原生 iOS 容器，可通过 Xcode 签名并安装到真实设备。" },
    ],
  },
  {
    version: "0.2.0-alpha.0",
    date: "2026-07-14",
    title: "Release 0 · 稳定化",
    summary: "先解决启动、数据升级、备份和刷新丢状态问题，为后续产品开发建立安全基线。",
    changes: [
      { area: "数据", text: "旧版数据库可安全升级，删除位置时不会留下失效关联。" },
      { area: "备份", text: "导出内容覆盖物品、房间、包、行程、清单和本地个人设置。" },
      { area: "质量", text: "增加自动测试、代码检查、浏览器核心流程测试和安全审计。" },
    ],
  },
]
