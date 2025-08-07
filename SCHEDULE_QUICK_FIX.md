# Schedule模块快速修复指南

## 🔴 最紧急修复（立即执行）

### 1. 修复API路由配置问题

**文件：** `bio-inventory-backend/schedule/urls.py`

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

# 基础功能路由
router.register(r'events', views.EventViewSet, basename='event')
router.register(r'equipment', views.EquipmentViewSet, basename='equipment')
router.register(r'bookings', views.BookingViewSet, basename='booking')

# 会议管理路由
router.register(r'meetings', views.MeetingInstanceViewSet, basename='meeting')
router.register(r'meeting-config', views.MeetingConfigurationViewSet, basename='meeting-config')
router.register(r'presenters', views.PresenterViewSet, basename='presenter')

# 任务管理路由  
router.register(r'task-templates', views.TaskTemplateViewSet, basename='task-template')
router.register(r'periodic-tasks', views.PeriodicTaskInstanceViewSet, basename='periodic-task')

urlpatterns = [
    path('', include(router.urls)),
    path('calendar-events/', views.CalendarEventsView.as_view(), name='calendar-events'),
]
```

**文件：** `bio-inventory-backend/core/urls.py`

在urlpatterns中添加：
```python
path('api/schedule/', include('schedule.urls')),
```

### 2. 修复序列化器导入问题

**文件：** `bio-inventory-backend/schedule/serializers.py`

添加缺失的序列化器（如果没有）：
```python
from rest_framework import serializers
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
```

### 3. 创建初始化命令

**创建目录：** `bio-inventory-backend/schedule/management/commands/`

**创建文件：** `bio-inventory-backend/schedule/management/commands/init_schedule_data.py`

```python
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from schedule.models import Equipment, MeetingConfiguration

class Command(BaseCommand):
    help = 'Initialize schedule module data'
    
    def handle(self, *args, **options):
        # 创建测试设备
        equipment_list = [
            Equipment(name='Microscope 1', location='Room 201', is_bookable=True),
            Equipment(name='Microscope 2', location='Room 201', is_bookable=True),
            Equipment(name='BSC-1', location='Cell Culture', requires_qr_checkin=True, is_bookable=False),
            Equipment(name='BSC-2', location='Cell Culture', requires_qr_checkin=True, is_bookable=False),
        ]
        
        for eq in equipment_list:
            if not Equipment.objects.filter(name=eq.name).exists():
                eq.save()
                if eq.requires_qr_checkin:
                    # QR码会自动生成
                    pass
        
        # 创建会议配置
        if not MeetingConfiguration.objects.exists():
            admin = User.objects.filter(is_superuser=True).first()
            if admin:
                MeetingConfiguration.objects.create(
                    day_of_week=1,
                    start_time='10:00',
                    location='Conference Room',
                    created_by=admin
                )
        
        self.stdout.write(self.style.SUCCESS('Schedule data initialized'))
```

## 🟡 前端修复

### 1. 修复API端点配置

**文件：** `bio-inventory-frontend/src/config/api.ts`

确保包含：
```typescript
export const API_ENDPOINTS = {
    // ... 其他端点
    SCHEDULES: 'schedule/events/',
    EQUIPMENT: 'schedule/equipment/',
    BOOKINGS: 'schedule/bookings/',
    MEETINGS: 'schedule/meetings/',
    TASK_TEMPLATES: 'schedule/task-templates/',
    PERIODIC_TASKS: 'schedule/periodic-tasks/',
};
```

### 2. 修复组件导入错误

**文件：** `bio-inventory-frontend/src/pages/SchedulePage.tsx`

修改导入语句（去掉.tsx/.ts扩展名）：
```typescript
import { AuthContext } from '../components/AuthContext';
import { scheduleApi } from '../services/scheduleApi';
import ScheduleFormModal from '../modals/ScheduleFormModal';
// 其他导入...
```

## 🟢 执行步骤

### 后端执行：
```bash
cd bio-inventory-backend

# 1. 运行迁移
python manage.py makemigrations schedule
python manage.py migrate

# 2. 初始化数据
python manage.py init_schedule_data

# 3. 创建超级用户（如果没有）
python manage.py createsuperuser

# 4. 启动服务器
python manage.py runserver
```

### 前端执行：
```bash
cd bio-inventory-frontend

# 1. 安装依赖（如果需要）
npm install

# 2. 启动开发服务器
npm start
```

## ✅ 验证检查清单

1. **后端API测试**
   - 访问: `http://localhost:8000/api/schedule/events/`
   - 应返回空数组或事件列表，而不是404

2. **前端页面测试**
   - 访问: `http://localhost:3000/schedule`
   - 页面应正常加载，无控制台错误

3. **功能测试**
   - [ ] 日历视图正常显示
   - [ ] 设备列表正常加载
   - [ ] 可以创建新事件
   - [ ] QR码可以生成和显示

## 🔧 常见问题处理

### 问题1: CORS错误
在 `settings.py` 添加：
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]
```

### 问题2: Token认证失败
确保已登录并获取Token：
```javascript
// 在浏览器控制台检查
localStorage.getItem('authToken')
```

### 问题3: 数据库表不存在
```bash
python manage.py makemigrations schedule --empty
python manage.py makemigrations schedule
python manage.py migrate schedule
```

## 📝 备注

完成以上步骤后，Schedule模块的基础功能应该可以正常工作。如需进一步优化，请参考完整的优化方案文档。
