# 解决 Django 自动化迁移中的 'relation already exists' 错误

## Core Features

- 创建幂等的数据库迁移

- 在迁移中条件性地创建数据库索引

- 解决部署过程中因数据库状态不一致导致的错误

## Tech Stack

{
  "Backend": {
    "language": "Python",
    "framework": "Django",
    "database": "PostgreSQL",
    "solution": "使用 Django 的 `migrations.RunPython` 操作执行原生 SQL (`CREATE INDEX CONCURRENTLY IF NOT EXISTS`)，以确保迁移脚本在索引已存在时不会失败，从而保证自动化部署的顺利进行。"
  }
}

## Design

这是一个后端代码修复任务，不涉及用户界面设计。

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[ ] 在与问题相关的 Django 应用（例如 `schedule`）中创建一个新的空迁移文件，并为其指定一个描述性的名称，例如 `fix_existing_index`。

[ ] 编辑新生成的迁移文件，导入 `migrations` 模块。

[ ] 定义一个前向迁移函数，该函数接收 `apps` 和 `schema_editor` 参数，并使用 `schema_editor.execute()` 执行原生 SQL 命令 `CREATE INDEX CONCURRENTLY IF NOT EXISTS "schedule_eq_user_id_e03600_idx" ON "your_table_name" ("user_id");`。

[ ] 定义一个后向（回滚）迁移函数，用于撤销操作。该函数将执行 `DROP INDEX IF EXISTS "schedule_eq_user_id_e03600_idx";`。

[ ] 在迁移文件的 `operations` 列表中，使用 `migrations.RunPython()` 操作，将定义好的前向和后向函数作为参数传入。

[ ] 将新的迁移文件提交到代码仓库，并触发 Google Cloud App Engine 的自动化部署流程。迁移系统将执行此修复脚本，安全地跳过已存在的索引，完成部署。
