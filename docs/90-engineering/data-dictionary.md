# 单人 MVP 数据字典

数据库名称为 `asset-tracker-db`，当前 schema 版本为 6。

## IndexedDB 数据表

| 存储            | 主要索引                                          | 当前用途                     | 说明                                        |
| --------------- | ------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| items           | name/category/status/tags/itemCode/locationNodeId | 物品档案 v3                  | 保留 roomId、bagId、value、photo 兼容旧页面 |
| homeSections    | key/sortOrder                                     | 物品主页分区                 | 默认三个分区不可删除，自定义分区可管理      |
| spaceNodes      | sectionId/parentId/kind/mobility                  | 房屋、车辆、区域和各类容器   | 通用父子树，不向用户显示 L0/L1/L2           |
| spaceLayouts    | nodeId/sortOrder                                  | 空间的多套布局与下级节点位置 | 只保存当前空间的直接下级                    |
| rooms           | 唯一 name                                         | 旧常驻位置                   | 兼容旧页面，已迁移为 spaceNodes             |
| bags            | 唯一 name                                         | 旧移动容器                   | 兼容旧页面，已迁移为 spaceNodes             |
| locationRecords | itemId/timestamp/fromNodeId/toNodeId              | 物品位置变动历史             | 包含来源、目标、原因和备注                  |
| activities      | startDate/status                                  | 正式行程（Plan）及稳定条目   | 内部保留旧表名以降低迁移风险                |
| checkSessions   | planId/startedAt/status                           | 每次出发或返程核对           | 结果按 PlanEntry id 保存                    |
| activityItems   | activityId                                        | 旧重复行程条目               | 仅作迁移兼容，不再写入                      |
| checklists      | type/status                                       | 未接入正式路由的旧清单       | 后续迁移或删除                              |
| templates       | id                                                | 旧清单模板                   | 后续转为行程模板                            |

## items 物品档案 v3

| 字段                   | 类型          | 说明                                                         |
| ---------------------- | ------------- | ------------------------------------------------------------ |
| id                     | string        | 系统生成的唯一主键，不允许编辑                               |
| itemCode               | string        | `AT-` 开头的弱显示短编号                                     |
| modelVersion           | number        | 当前固定为 3                                                 |
| name                   | string        | 物品名称，必填                                               |
| category/subCategory   | string        | 标准分类与兼容子分类                                         |
| tags                   | string[]      | 去重后的自定义标签                                           |
| images                 | object[]      | 多图，含 id、url、caption、isCover、createdAt                |
| photo                  | string        | 当前封面图的兼容字段                                         |
| locationNodeId         | string        | 当前所在空间或容器                                           |
| homeLocationNodeId     | string        | 常驻/归位空间                                                |
| roomId/bagId           | string        | 旧页面兼容位置                                               |
| purchasePrice/currency | number/string | 购入价与币种                                                 |
| purchaseDate/channel   | string        | 购入时间与渠道                                               |
| valuation              | object        | 模式、手动金额、预留计算结果与计算时间                       |
| propertyGroups         | object[]      | 产品、财务、维护标准组和任意自定义组                         |
| notes                  | string        | 备注                                                         |
| status                 | string        | 兼容库存/借出/丢失等业务状态，不在快速添加页展示无效状态标签 |
| createdAt/updatedAt    | ISO string    | 创建和更新时间                                               |

## homeSections 首页分区

字段包括 `id`、稳定 `key`、名称、说明、图标、`builtIn`、排序和时间。默认分区为“我的包包、我的家、我的车库”；默认分区可改名但不可删除。

## spaceNodes 通用空间节点

| 字段             | 说明                               |
| ---------------- | ---------------------------------- |
| sectionId        | 所属首页分区                       |
| parentId         | 上级节点；为空表示分区下的根节点   |
| kind             | `space`、`area`、`container`       |
| mobility         | `fixed`、`mobile`、`none`          |
| name/description | 标题与说明                         |
| icon/images      | 头像图标和图片                     |
| spaceValue       | 用户录入的房屋、车辆或容器自身价值 |
| currency         | 当前默认 CNY                       |
| sortOrder        | 同级排序                           |

藏品价值不直接存入节点，而是从节点及全部后代物品的有效估值递归汇总，避免保存过期总数。

## spaceLayouts 空间布局

每个节点可以有多条布局记录。`placements` 保存直接下级节点的 `nodeId`、x/y、宽高和排序。布局用于表达相对位置，不作为建筑 CAD 数据。

## 备份

备份格式为 v3，覆盖上述 12 个 store，以及本地个人资料、旧空间数据、分类、自定义行程类型和物品页视图偏好。

- v1 备份：没有 `checkSessions` 和 v3 空间表；
- v2 备份：没有 v3 空间表；
- v3 备份：完整保存物品档案 v3、分区、空间树和布局。

恢复旧备份后会自动补齐 v3 默认分区、空间节点和物品字段。
