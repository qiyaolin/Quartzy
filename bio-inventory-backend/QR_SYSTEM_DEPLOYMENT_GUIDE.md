# QR码签到/签出系统部署指南

## 概述

本文档介绍如何安全地将QR码签到/签出系统部署到生产环境，不会影响现有数据。

## 系统架构

### 云端环境
- **平台**: Google App Engine
- **数据库**: Cloud SQL (PostgreSQL)
- **域名**: lab-inventory-467021.nn.r.appspot.com

### 本地开发
- **数据库**: SQLite
- **主要用途**: 开发和测试

## 部署前检查

### 1. 确认当前系统状态
```bash
# 在云端App Engine环境运行
python fix_migrations.py
```

这个脚本会检查：
- ✅ 现有schedule表结构
- ✅ Equipment表QR相关字段状态
- ✅ QR系统相关表是否存在
- ✅ 迁移记录完整性

### 2. 预览迁移计划
```bash
# 安全的干运行模式，不会修改数据库
python manage.py migrate_qr_system_safe --dry-run
```

## 安全迁移步骤

### 步骤1: 执行安全迁移
```bash
# 在生产环境执行安全迁移
python manage.py migrate_qr_system_safe
```

此命令会：
1. 🔍 检查当前数据库状态
2. 🔧 安全添加Equipment表的QR字段
   - `qr_code` (VARCHAR(50), UNIQUE, NULL)
   - `current_user_id` (外键到auth_user)
   - `current_checkin_time` (TIMESTAMP, NULL)
   - `is_in_use` (BOOLEAN, DEFAULT FALSE)
3. 📋 创建新的QR相关表
   - `schedule_equipmentusagelog` (使用日志)
   - `schedule_waitingqueueentry` (等待队列)
4. 📝 更新Django迁移记录
5. ✅ 验证迁移结果

### 步骤2: 验证数据库结构
```bash
# 再次运行检查脚本确认迁移成功
python fix_migrations.py
```

### 步骤3: 测试基本功能
```bash
# 运行QR系统测试（如果可能）
python manage.py test_qr_system --cleanup
```

## 前端部署

### 1. 集成Equipment页面到路由
在主路由配置文件中添加：
```typescript
{
  path: "/equipment",
  element: <EquipmentPage />
}
```

### 2. 构建和部署前端
```bash
# 在frontend目录下
npm run build
firebase deploy
```

## API端点验证

部署完成后，验证以下API端点：

### 基础端点
- `GET /api/schedule/equipment/` - 获取设备列表
- `GET /api/schedule/equipment/{id}/` - 获取单个设备详情
- `GET /api/schedule/equipment/{id}/qr_code/` - 获取设备QR码

### QR扫码端点
- `POST /api/schedule/equipment/qr_checkin/` - QR扫码签到
- `POST /api/schedule/equipment/qr_checkout/` - QR扫码签出

### 监控端点
- `GET /api/schedule/equipment/{id}/current_status/` - 获取当前状态
- `GET /api/schedule/equipment/{id}/usage_logs/` - 获取使用日志

## 安全特性

### 数据库安全
- ✅ 非破坏性迁移：只添加字段，不修改现有数据
- ✅ 事务保护：所有迁移在事务中执行
- ✅ 回滚支持：迁移失败时自动回滚
- ✅ 重复执行安全：可以安全地多次运行迁移命令

### 应用安全
- ✅ 权限验证：所有API都需要用户认证
- ✅ QR码唯一性：防止QR码重复
- ✅ 冲突检测：防止重复签到
- ✅ 数据验证：严格的输入验证

## 功能测试清单

### 设备管理
- [ ] 创建带QR码的设备
- [ ] 查看QR码并打印
- [ ] 设备状态显示正确

### QR扫码功能
- [ ] 手机扫码签到成功
- [ ] 手机扫码签出成功
- [ ] 冲突检测工作正常
- [ ] 使用时长计算正确

### 通知系统
- [ ] 签到确认邮件
- [ ] 提前结束通知
- [ ] 等待队列通知

### 等待队列
- [ ] 排队功能正常
- [ ] 位置显示正确
- [ ] 自动过期处理

## 故障排除

### 迁移失败
如果迁移过程中出现错误：

1. **检查错误信息**
   ```bash
   # 查看详细错误
   python manage.py migrate_qr_system_safe --dry-run
   ```

2. **手动回滚**（如果需要）
   ```bash
   # 查看当前迁移状态
   python manage.py showmigrations schedule
   ```

3. **联系技术支持**
   提供错误日志和当前数据库状态信息

### API访问问题
1. 检查CORS配置
2. 验证Token认证
3. 确认API路由配置

### QR扫码问题
1. 检查摄像头权限
2. 验证QR码格式
3. 确认网络连接

## 维护建议

### 定期检查
- 每月运行 `python fix_migrations.py` 检查系统状态
- 监控使用日志表大小，必要时清理旧数据
- 检查等待队列表，清理过期条目

### 性能优化
- 定期分析数据库查询性能
- 监控API响应时间
- 考虑添加缓存机制

### 备份策略
- 确保Cloud SQL自动备份已启用
- 定期测试数据恢复流程
- 保留迁移脚本的备份

## 技术支持

如遇到问题，请联系技术团队并提供：
1. 错误日志
2. `python fix_migrations.py` 的输出
3. 当前数据库状态信息
4. 具体的错误重现步骤

---

**重要提醒**: 在生产环境执行任何迁移操作前，请确保已经做好数据库备份！