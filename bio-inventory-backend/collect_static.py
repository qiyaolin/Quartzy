#!/usr/bin/env python
"""
静态文件收集脚本 - 确保Django admin样式正确收集
"""
import os
import django
from django.core.management import execute_from_command_line

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def collect_static_files():
    """收集静态文件并验证"""
    print("🚀 开始收集静态文件...")
    
    try:
        # 清理并收集静态文件
        execute_from_command_line(['manage.py', 'collectstatic', '--noinput', '--clear'])
        print("✅ 静态文件收集成功")
        
        # 检查关键的admin文件
        from django.conf import settings
        static_root = settings.STATIC_ROOT
        
        # 检查admin CSS文件
        admin_css_path = static_root / 'admin' / 'css' / 'base.css'
        if admin_css_path.exists():
            print(f"✅ Django admin CSS文件存在: {admin_css_path}")
        else:
            print(f"❌ Django admin CSS文件缺失: {admin_css_path}")
        
        # 检查staticfiles目录内容
        if static_root.exists():
            files = list(static_root.glob('**/*'))
            print(f"📊 收集的静态文件总数: {len(files)}")
            
            # 列出主要目录
            for item in static_root.iterdir():
                if item.is_dir():
                    file_count = len(list(item.glob('**/*')))
                    print(f"  📁 {item.name}: {file_count} 文件")
        else:
            print("❌ staticfiles目录不存在")
            
    except Exception as e:
        print(f"❌ 静态文件收集失败: {e}")

if __name__ == '__main__':
    collect_static_files()