# 生物库存管理系统 - 生产环境部署指南

## 项目概述
这是一个完整的生物库存管理系统，包含以下组件：
- **后端API**: Django + Django REST Framework
- **前端应用**: React + TypeScript + Tailwind CSS
- **打印服务器**: Node.js DYMO打印服务

## 系统要求
- Python 3.8+
- Node.js 16+
- PostgreSQL 12+ (推荐) 或 SQLite
- DYMO打印机 (可选)

## 部署步骤

### 1. 后端部署

#### 1.1 环境准备
```bash
cd bio-inventory-backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

#### 1.2 安装依赖
```bash
pip install -r requirements.txt
```

#### 1.3 数据库配置
编辑 `core/settings.py`，配置数据库连接：

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'bio_inventory_db',
        'USER': 'your_username',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

#### 1.4 环境变量配置
创建 `.env` 文件：
```bash
SECRET_KEY=your_secret_key_here
DEBUG=False
ALLOWED_HOSTS=your_domain.com,localhost
DATABASE_URL=postgresql://user:password@localhost:5432/bio_inventory_db
```

#### 1.5 数据库迁移
```bash
python manage.py migrate
python manage.py collectstatic
```

#### 1.6 创建超级用户
```bash
python manage.py createsuperuser
```

#### 1.7 启动服务
```bash
# 开发环境
python manage.py runserver

# 生产环境 (使用 Gunicorn)
gunicorn core.wsgi:application --bind 0.0.0.0:8000
```

### 2. 前端部署

#### 2.1 环境准备
```bash
cd bio-inventory-frontend
npm install
```

#### 2.2 环境配置
创建 `.env` 文件：
```bash
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_PRINT_SERVER_URL=http://localhost:3001
```

#### 2.3 构建生产版本
```bash
npm run build
```

#### 2.4 部署构建文件
将 `build/` 目录中的文件部署到Web服务器（如Nginx、Apache）。

### 3. 打印服务器部署

#### 3.1 环境准备
```bash
cd dymo-print-server-nodejs
npm install
```

#### 3.2 配置DYMO打印机
1. 安装DYMO Connect Framework
2. 配置打印机设置
3. 测试打印机连接

#### 3.3 启动服务
```bash
node src/production_print_agent.js
```

## 生产环境配置

### Nginx配置示例
```nginx
server {
    listen 80;
    server_name your_domain.com;

    # 前端静态文件
    location / {
        root /path/to/bio-inventory-frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # 后端API代理
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 打印服务器代理
    location /print/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 系统服务配置

#### 后端服务 (systemd)
创建 `/etc/systemd/system/bio-inventory-backend.service`：
```ini
[Unit]
Description=Bio Inventory Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/bio-inventory-backend
Environment=PATH=/path/to/bio-inventory-backend/venv/bin
ExecStart=/path/to/bio-inventory-backend/venv/bin/gunicorn core.wsgi:application --bind 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

#### 打印服务器服务 (systemd)
创建 `/etc/systemd/system/bio-inventory-print.service`：
```ini
[Unit]
Description=Bio Inventory Print Server
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/dymo-print-server-nodejs
ExecStart=/usr/bin/node src/production_print_agent.js
Restart=always

[Install]
WantedBy=multi-user.target
```

### 启动服务
```bash
sudo systemctl enable bio-inventory-backend
sudo systemctl start bio-inventory-backend
sudo systemctl enable bio-inventory-print
sudo systemctl start bio-inventory-print
```

## 安全配置

### 1. 防火墙设置
```bash
# 只开放必要端口
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22
```

### 2. SSL证书配置
使用Let's Encrypt获取免费SSL证书：
```bash
sudo certbot --nginx -d your_domain.com
```

### 3. 数据库安全
- 使用强密码
- 限制数据库访问IP
- 定期备份数据

## 监控和维护

### 1. 日志监控
- 后端日志：`/var/log/bio-inventory-backend/`
- 前端日志：Nginx访问日志
- 打印服务器日志：`/var/log/bio-inventory-print/`

### 2. 备份策略
```bash
# 数据库备份
pg_dump bio_inventory_db > backup_$(date +%Y%m%d).sql

# 文件备份
tar -czf backup_$(date +%Y%m%d).tar.gz /path/to/bio-inventory-backend
```

### 3. 性能监控
- 使用htop监控系统资源
- 配置日志轮转
- 监控磁盘空间

## 故障排除

### 常见问题

1. **CORS错误**
   - 检查后端CORS配置
   - 确认前端API URL正确

2. **数据库连接失败**
   - 检查数据库服务状态
   - 验证连接参数

3. **打印功能异常**
   - 检查DYMO打印机连接
   - 验证打印服务器状态

4. **静态文件404**
   - 运行 `python manage.py collectstatic`
   - 检查Nginx配置

## 联系支持
如遇到问题，请联系开发团队或查看项目文档。 