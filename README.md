# 生物库存管理系统 - 生产版本

## 项目概述
这是一个完整的生物库存管理系统，包含前端React应用和后端Django API。

## 目录结构
```
Quartzy/
├── bio-inventory-backend/     # Django后端API
├── bio-inventory-frontend/    # React前端应用
└── dymo-print-server-nodejs/  # DYMO打印服务器
```

## 快速开始

### 后端部署
1. 进入后端目录：`cd bio-inventory-backend`
2. 安装依赖：`pip install -r requirements.txt`
3. 配置数据库连接
4. 运行迁移：`python manage.py migrate`
5. 启动服务器：`python manage.py runserver`

### 前端部署
1. 进入前端目录：`cd bio-inventory-frontend`
2. 安装依赖：`npm install`
3. 构建生产版本：`npm run build`
4. 部署构建文件到Web服务器

### 打印服务器
1. 进入打印服务器目录：`cd dymo-print-server-nodejs`
2. 安装依赖：`npm install`
3. 配置DYMO打印机
4. 启动服务：`node src/production_print_agent.js`

## 主要功能
- 库存管理
- 请求管理
- 用户管理
- 资金管理
- 条码打印
- 移动端支持
- 通知系统

## 技术栈
- 后端：Django + Django REST Framework
- 前端：React + TypeScript + Tailwind CSS
- 数据库：PostgreSQL（推荐）
- 打印：DYMO Connect Framework

## 生产环境注意事项
1. 配置环境变量
2. 设置数据库连接
3. 配置CORS设置
4. 设置静态文件服务
5. 配置日志记录
6. 设置备份策略

## 支持
如有问题，请联系开发团队。
