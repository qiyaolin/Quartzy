# Schedule模块独立开发策略

## 现状分析

经过详细分析发现：

1. **0730_v1稳定分支** - 也使用了`.tsx`扩展名导入
2. **0803-sche-sys_new分支** - 同样的导入风格，但添加了Schedule功能
3. **问题根源** - 这种导入风格需要特定的构建配置才能工作

## 根本问题

当前项目的所有分支都使用了相同的TypeScript导入风格，但React的构建工具对于扩展名有严格要求。这不是Schedule模块导致的问题，而是整个项目的构建配置问题。

## 解决方案

### 方案1：全局修复导入问题（推荐）
```bash
# 回到Schedule分支
git checkout 0803-sche-sys_new

# 运行全面的导入清理
node fix_imports_compatible.js

# 测试构建
npm run build
```

### 方案2：Schedule独立开发
基于0730_v1分支创建Schedule功能：

```bash
# 基于稳定分支创建Schedule开发分支
git checkout 0730_v1
git checkout -b schedule-independent-dev

# 修复导入问题
node fix_imports_compatible.js

# 添加Schedule功能文件
# - 使用JavaScript/JSX而不是TypeScript
# - 完全独立的组件和API
# - 通过环境变量控制启用/禁用
```

### 方案3：渐进式集成
1. 首先修复0730_v1的构建问题
2. 验证所有现有功能正常工作
3. 然后逐步添加Schedule功能

### Schedule模块独立设计

```javascript
// src/config/features.js
export const FEATURES = {
  SCHEDULE_MODULE: process.env.REACT_APP_ENABLE_SCHEDULE === 'true'
};

// src/components/schedule/index.js
export { default as ScheduleCalendar } from './ScheduleCalendar';
export { default as EventModal } from './EventModal';
export { default as EquipmentBooking } from './EquipmentBooking';

// 在路由中条件加载
import { FEATURES } from '../config/features';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/inventory" element={<InventoryPage />} />
    <Route path="/requests" element={<RequestsPage />} />
    {FEATURES.SCHEDULE_MODULE && (
      <Route path="/schedule" element={<SchedulePage />} />
    )}
  </Routes>
);
```

## 立即行动计划

1. **确认问题范围** - 验证0730_v1分支确实是您认为的稳定版本
2. **选择解决方案** - 根据您的需求选择上述三个方案之一
3. **实施修复** - 系统性地解决导入问题
4. **验证功能** - 确保现有功能不受影响
5. **独立开发Schedule** - 在稳定基础上添加Schedule功能

## 建议

基于您的需求，我建议：
1. 首先修复0730_v1分支的构建问题
2. 在此基础上创建Schedule独立开发分支
3. 使用JavaScript/JSX开发Schedule功能，避免TypeScript复杂性
4. 通过配置控制Schedule功能的启用/禁用

这样可以确保：
- 现有功能完全不受影响
- Schedule功能完全独立
- 可以灵活控制新功能的部署