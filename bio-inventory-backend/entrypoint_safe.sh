#!/bin/bash

# 安全启动脚本 - 修复迁移冲突和格式问题
set -e

echo "🚀 启动 Django 应用（安全模式）..."

# 基本环境检查
echo "📋 基本环境信息:"
echo "GAE_ENV: ${GAE_ENV:-未设置}"
echo "DEBUG: ${DEBUG:-未设置}"
python --version

# 验证Python模块
echo "🔍 验证核心模块..."
python -c "import django; print(f'Django: {django.get_version()}')" || echo "Django导入失败"
python -c "import rest_framework; print('DRF可用')" || echo "DRF导入失败"

# 智能迁移修复
echo "🔄 处理数据库迁移..."
python fix_migrations.py || echo "迁移修复跳过"

# 运行迁移（使用安全模式）
python manage.py migrate --fake-initial || echo "初始迁移跳过"
python manage.py migrate || echo "迁移跳过"

# 创建超级用户
echo "👤 创建管理员用户..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth.models import User
username = 'admin'
password = os.environ.get('ADMIN_PASSWORD', '111111')
try:
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username, 'admin@example.com', password)
        print(f'创建超级用户: {username}')
    else:
        print(f'超级用户已存在: {username}')
except Exception as e:
    print(f'超级用户创建跳过: {e}')
" || echo "用户创建跳过"

# 检查静态文件
echo "📦 检查静态文件..."
if [ -d "staticfiles/admin" ]; then
    echo "静态文件目录已存在"
    ls -la staticfiles/ | head -5
else
    echo "静态文件目录不存在"
fi

# 验证应用配置
echo "🔍 验证Django应用配置..."
python manage.py check || echo "配置检查发现问题"

echo "🌐 启动 Gunicorn 服务器..."
exec gunicorn --bind :$PORT --workers 1 --threads 4 --timeout 30 core.wsgi:application