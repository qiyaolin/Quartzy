#!/bin/bash

# 设置错误时退出
set -e

echo "🚀 启动 Django 应用..."

# 检查环境变量
echo "📋 环境信息:"
echo "GAE_ENV: ${GAE_ENV:-未设置}"
echo "DEBUG: ${DEBUG:-未设置}"

# 创建打印应用迁移文件
echo "📝 创建打印应用迁移文件..."
python manage.py makemigrations printing --noinput || echo "打印迁移创建跳过或失败"

# 运行数据库迁移（安全模式）
echo "🔄 运行数据库迁移..."
python manage.py migrate --noinput --fake-initial || echo "迁移跳过或失败"

# 确保打印应用迁移被应用
echo "🖨️ 应用打印功能迁移..."
python manage.py migrate printing --noinput || echo "打印迁移跳过或失败"

# 创建超级用户（如果不存在）
echo "👤 创建管理员用户..."
python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth.models import User
username = 'admin'
email = 'admin@example.com'
password = os.environ.get('ADMIN_PASSWORD', 'admin123')
try:
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username, email, password)
        print(f'✅ 创建超级用户: {username}')
    else:
        print(f'ℹ️ 超级用户 {username} 已存在')
except Exception as e:
    print(f'⚠️ 超级用户创建跳过: {e}')
" || echo "超级用户创建跳过"

# 创建打印服务器用户和Token
echo "🖨️ 设置打印服务器认证..."
python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

# 创建打印服务器用户
username = 'print_server'
email = 'print@lab.com'
password = 'print_server_password_2024'

try:
    user, created = User.objects.get_or_create(
        username=username,
        defaults={'email': email, 'is_staff': True}
    )
    if created:
        user.set_password(password)
        user.save()
        print(f'✅ 创建打印服务器用户: {username}')
    else:
        print(f'ℹ️ 打印服务器用户 {username} 已存在')
    
    # 创建或获取Token
    token, created = Token.objects.get_or_create(user=user)
    if created:
        print(f'✅ 创建打印服务器Token: {token.key}')
    else:
        print(f'ℹ️ 打印服务器Token已存在: {token.key}')
        
    # 输出Token到日志（生产环境应通过更安全的方式管理）
    print(f'📋 打印服务器API Token: {token.key}')
    
except Exception as e:
    print(f'⚠️ 打印服务器设置跳过: {e}')
" || echo "打印服务器设置跳过"

echo "🌐 启动 Gunicorn 服务器..."
exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 core.wsgi:application