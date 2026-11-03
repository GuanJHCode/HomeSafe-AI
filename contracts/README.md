# 契约
唯一模型源：reference/homesafe_core/models.py。修改后运行scripts/generate_contracts.py。
domain.schema.json和frontend/domain.ts用于核心数据；http/openapi.json是延期HTTP兼容设计，非首版必实现接口清单。
V6新增setup_items、PlacementIssue、resolved_unknown、change_kinds与静态资产路径。
JSON契约不代替几何校验。浏览器固定消息协议见docs/03-backend-contracts.md；不允许任意Python代码。
