# 单人 MVP 数据字典

数据库名称为 `asset-tracker-db`，当前 schema 版本为 5。

| 存储            | 主键/索引                                  | 当前用途                     | 说明                         |
| --------------- | ------------------------------------------ | ---------------------------- | ---------------------------- |
| items           | id；name/category/status/tags/roomId/bagId | 物品、常驻房间、当前包、图片 | 图片当前为 Data URL          |
| rooms           | id；唯一 name                              | 常驻位置                     | 删除时会事务性解除物品引用   |
| bags            | id；唯一 name                              | 可移动容器                   | 删除时会事务性解除物品引用   |
| locationRecords | id；itemId/timestamp                       | 位置变动历史                 | 后续统一为 Movement          |
| activities      | id；startDate/status                       | 正式行程（Plan）及稳定条目   | 内部保留旧表名以降低迁移风险 |
| checkSessions   | id；planId/startedAt/status                | 每次出发或返程核对           | 结果按 PlanEntry id 保存     |
| activityItems   | id；activityId                             | 旧重复行程条目               | 仅作迁移兼容，不再写入       |
| checklists      | id；type/status                            | 未接入正式路由的旧清单       | 后续迁移或删除               |
| templates       | id                                         | 旧清单模板                   | 后续转为行程模板             |

备份格式为 v2，覆盖上述 9 个 store，以及本地个人资料、旧空间数据、分区、分类、自定义行程类型和物品页视图偏好。恢复逻辑兼容缺少 `checkSessions` 的 v1 备份。
