# 生物库存管理系统 - 项目结构

## 目录结构
```
Quartzy/
├── README.md                           # 项目说明文档
├── DEPLOYMENT_GUIDE.md                 # 生产环境部署指南
├── PROJECT_STRUCTURE.md                # 项目结构说明（本文件）
├── .gitignore                          # Git忽略文件配置
├── CENTRALIZED_PRINTING_SETUP.md       # 集中式打印设置指南
├── package-lock.json                   # 根目录依赖锁定文件
├── bio-inventory-backend/              # Django后端API
│   ├── core/                           # Django核心配置
│   │   ├── settings.py                 # 项目设置
│   │   ├── urls.py                     # 主URL配置
│   │   ├── wsgi.py                     # WSGI配置
│   │   └── asgi.py                     # ASGI配置
│   ├── items/                          # 库存管理模块
│   │   ├── models.py                   # 库存数据模型
│   │   ├── views.py                    # 库存视图
│   │   ├── serializers.py              # 库存序列化器
│   │   ├── urls.py                     # 库存URL配置
│   │   └── migrations/                 # 数据库迁移文件
│   ├── inventory_requests/             # 请求管理模块
│   │   ├── models.py                   # 请求数据模型
│   │   ├── views.py                    # 请求视图
│   │   ├── serializers.py              # 请求序列化器
│   │   ├── urls.py                     # 请求URL配置
│   │   └── migrations/                 # 数据库迁移文件
│   ├── users/                          # 用户管理模块
│   │   ├── models.py                   # 用户数据模型
│   │   ├── views.py                    # 用户视图
│   │   ├── serializers.py              # 用户序列化器
│   │   ├── urls.py                     # 用户URL配置
│   │   └── migrations/                 # 数据库迁移文件
│   ├── funding/                        # 资金管理模块
│   │   ├── models.py                   # 资金数据模型
│   │   ├── views.py                    # 资金视图
│   │   ├── serializers.py              # 资金序列化器
│   │   ├── urls.py                     # 资金URL配置
│   │   └── migrations/                 # 数据库迁移文件
│   ├── notifications/                  # 通知系统模块
│   │   ├── models.py                   # 通知数据模型
│   │   ├── views.py                    # 通知视图
│   │   ├── serializers.py              # 通知序列化器
│   │   ├── services.py                 # 通知服务
│   │   ├── email_service.py            # 邮件服务
│   │   ├── urls.py                     # 通知URL配置
│   │   └── migrations/                 # 数据库迁移文件
│   ├── printing/                       # 打印管理模块
│   │   ├── models.py                   # 打印数据模型
│   │   ├── views.py                    # 打印视图
│   │   ├── serializers.py              # 打印序列化器
│   │   ├── urls.py                     # 打印URL配置
│   │   └── migrations/                 # 数据库迁移文件
│   ├── data_import_export/             # 数据导入导出模块
│   ├── static/                         # 静态文件
│   ├── manage.py                       # Django管理脚本
│   ├── requirements.txt                # Python依赖
│   ├── app.yaml                        # Google App Engine配置
│   ├── entrypoint.sh                   # 容器启动脚本
│   ├── entrypoint_fixed.sh             # 修复版启动脚本
│   ├── entrypoint_simple.sh            # 简化版启动脚本
│   ├── startup.py                      # 启动脚本
│   ├── .gcloudignore                   # Google Cloud忽略文件
│   └── .gitignore                      # Git忽略文件
├── bio-inventory-frontend/             # React前端应用
│   ├── src/                            # 源代码目录
│   │   ├── components/                 # React组件
│   │   │   ├── ui/                     # UI基础组件
│   │   │   ├── mobile/                 # 移动端组件
│   │   │   ├── funding/                # 资金管理组件
│   │   │   └── ...                     # 其他组件
│   │   ├── pages/                      # 页面组件
│   │   │   ├── mobile/                 # 移动端页面
│   │   │   └── ...                     # 其他页面
│   │   ├── modals/                     # 模态框组件
│   │   ├── contexts/                   # React上下文
│   │   ├── hooks/                      # 自定义Hooks
│   │   ├── services/                   # 服务层
│   │   ├── utils/                      # 工具函数
│   │   ├── config/                     # 配置文件
│   │   ├── styles/                     # 样式文件
│   │   ├── App.tsx                     # 主应用组件
│   │   ├── index.tsx                   # 应用入口
│   │   └── ...                         # 其他文件
│   ├── public/                         # 公共资源
│   ├── package.json                    # Node.js依赖配置
│   ├── package-lock.json               # 依赖锁定文件
│   ├── tailwind.config.js              # Tailwind CSS配置
│   ├── postcss.config.js               # PostCSS配置
│   ├── .gitignore                      # Git忽略文件
│   └── ...                             # 其他配置文件
└── dymo-print-server-nodejs/           # DYMO打印服务器
    ├── src/                            # 源代码目录
    │   ├── production_print_agent.js   # 生产环境打印代理
    │   ├── auto_print_template.html    # 自动打印模板
    │   ├── config_test.html            # 配置测试页面
    │   ├── dymo.connect.framework.js   # DYMO框架文件
    │   ├── label_template_parser.py    # 标签模板解析器
    │   ├── QRcode.label                # 二维码标签模板
    │   ├── sample.label                # 示例标签模板
    │   └── README.md                   # 打印服务器说明
    ├── start_print_agent.bat           # Windows启动脚本
    ├── README.md                       # 项目说明
    ├── DEPLOYMENT_GUIDE.md             # 部署指南
    ├── .gitignore                      # Git忽略文件
    └── node_modules/                   # Node.js依赖
```

## 核心功能模块

### 1. 库存管理 (items/)
- 库存项目的增删改查
- 条码生成和管理
- 库存状态跟踪
- 过期提醒功能

### 2. 请求管理 (inventory_requests/)
- 库存请求的创建和处理
- 请求状态跟踪
- 审批流程
- 请求历史记录

### 3. 用户管理 (users/)
- 用户注册和认证
- 权限管理
- 用户角色分配
- 用户信息管理

### 4. 资金管理 (funding/)
- 资金账户管理
- 交易记录
- 预算分配
- 财务报告

### 5. 通知系统 (notifications/)
- 邮件通知
- 系统消息
- 提醒功能
- 通知历史

### 6. 打印管理 (printing/)
- 标签打印
- 打印模板管理
- 打印历史
- 打印机配置

## 技术栈

### 后端技术
- **框架**: Django 4.x + Django REST Framework
- **数据库**: PostgreSQL (推荐) / SQLite
- **认证**: Django内置认证系统
- **API**: RESTful API设计
- **部署**: Google App Engine / Docker

### 前端技术
- **框架**: React 18.x + TypeScript
- **样式**: Tailwind CSS
- **状态管理**: React Context + Hooks
- **路由**: React Router
- **构建工具**: Create React App
- **移动端**: 响应式设计 + PWA

### 打印服务
- **运行时**: Node.js
- **打印框架**: DYMO Connect Framework
- **通信**: HTTP API
- **部署**: 独立服务

## 开发环境要求

### 系统要求
- Python 3.8+
- Node.js 16+
- Git
- 现代浏览器

### 开发工具推荐
- VS Code / PyCharm
- Postman / Insomnia (API测试)
- pgAdmin / DBeaver (数据库管理)

## 部署架构

### 生产环境架构
```
[用户浏览器] 
    ↓
[Nginx反向代理]
    ↓
[React前端应用] ←→ [Django后端API] ←→ [PostgreSQL数据库]
    ↓
[DYMO打印服务器] ←→ [DYMO打印机]
```

### 容器化部署
- 后端: Docker + Google App Engine
- 前端: 静态文件托管
- 打印服务: 独立容器
- 数据库: 云数据库服务

## 安全考虑

### 认证和授权
- JWT Token认证
- 基于角色的权限控制
- API访问限制

### 数据安全
- 数据库连接加密
- 敏感数据加密存储
- 定期数据备份

### 网络安全
- HTTPS强制
- CORS配置
- 防火墙设置

## 监控和维护

### 日志管理
- 应用日志
- 错误日志
- 访问日志
- 性能监控

### 备份策略
- 数据库定期备份
- 文件系统备份
- 配置备份

### 性能优化
- 数据库查询优化
- 前端资源压缩
- 缓存策略
- CDN加速

## 扩展性

### 水平扩展
- 负载均衡
- 数据库读写分离
- 微服务架构

### 功能扩展
- 插件系统
- API版本管理
- 第三方集成

## 支持文档

- [README.md](README.md) - 项目概述和快速开始
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 详细部署指南
- [CENTRALIZED_PRINTING_SETUP.md](CENTRALIZED_PRINTING_SETUP.md) - 打印功能配置
- 各模块内的README文件 - 模块特定说明 