#!/usr/bin/env python
"""
简单的健康检查脚本，用于诊断App Engine部署问题
"""
import os
import sys
import django
from django.conf import settings

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

def check_django_setup():
    """检查Django设置"""
    try:
        django.setup()
        print("✅ Django设置成功")
        return True
    except Exception as e:
        print(f"❌ Django设置失败: {e}")
        return False

def check_database_connection():
    """检查数据库连接"""
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            if result:
                print("✅ 数据库连接成功")
                return True
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return False

def check_environment_variables():
    """检查关键环境变量"""
    print("🔍 检查环境变量:")
    required_vars = ['SECRET_KEY', 'DB_USER', 'DB_PASS', 'DB_NAME', 'INSTANCE_CONNECTION_NAME']
    
    all_present = True
    for var in required_vars:
        value = os.environ.get(var)
        if value:
            print(f"✅ {var}: {'*' * min(len(value), 10)}")
        else:
            print(f"❌ {var}: 未设置")
            all_present = False
    
    return all_present

def check_app_engine_environment():
    """检查App Engine环境"""
    gae_env = os.environ.get('GAE_ENV', '')
    if gae_env.startswith('standard'):
        print(f"✅ App Engine标准环境: {gae_env}")
        return True
    else:
        print(f"ℹ️ 非App Engine环境: {gae_env or '本地环境'}")
        return False

def main():
    print("🏥 Django应用健康检查")
    print("=" * 50)
    
    checks = [
        ("环境变量检查", check_environment_variables),
        ("App Engine环境检查", check_app_engine_environment),
        ("Django设置检查", check_django_setup),
        ("数据库连接检查", check_database_connection),
    ]
    
    results = []
    for name, check_func in checks:
        print(f"\n📋 {name}...")
        try:
            result = check_func()
            results.append(result)
        except Exception as e:
            print(f"❌ {name}失败: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    if all(results):
        print("🎉 所有检查通过！应用应该可以正常运行")
        return 0
    else:
        print("⚠️ 发现问题，请检查上述错误信息")
        return 1

if __name__ == '__main__':
    sys.exit(main())