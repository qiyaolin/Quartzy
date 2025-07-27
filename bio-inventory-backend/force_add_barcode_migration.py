#!/usr/bin/env python
"""
强制创建并应用barcode字段迁移
"""
import os
import django
from django.conf import settings
from django.core.management import execute_from_command_line

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def create_barcode_migration():
    """创建barcode字段迁移"""
    print("🔧 创建barcode字段迁移...")
    
    # 创建迁移文件内容
    migration_content = '''# Generated manually to add barcode field to Item model
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('items', '0005_remove_financial_type_if_exists'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='barcode',
            field=models.CharField(blank=True, help_text='Unique barcode for this item', max_length=50, null=True, unique=True),
        ),
    ]
'''
    
    # 写入迁移文件
    migration_file = 'bio-inventory-backend/items/migrations/0007_add_barcode_field_final.py'
    with open(migration_file, 'w', encoding='utf-8') as f:
        f.write(migration_content)
    
    print(f"✅ 创建迁移文件: {migration_file}")
    return True

def deploy_with_migration():
    """部署并应用迁移"""
    print("🚀 开始部署并应用迁移...")
    
    # 1. 创建迁移
    if not create_barcode_migration():
        return False
    
    # 2. 本地测试迁移
    print("📋 本地测试迁移...")
    try:
        execute_from_command_line(['manage.py', 'migrate', 'items'])
        print("✅ 本地迁移成功")
    except Exception as e:
        print(f"❌ 本地迁移失败: {e}")
        return False
    
    # 3. 部署到App Engine
    print("🌐 部署到App Engine...")
    import subprocess
    
    try:
        result = subprocess.run(['gcloud', 'app', 'deploy', '--quiet'], 
                              capture_output=True, text=True, cwd='.')
        
        if result.returncode == 0:
            print("✅ App Engine部署成功")
        else:
            print(f"❌ App Engine部署失败: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ 部署异常: {e}")
        return False
    
    print("✅ 部署完成！")
    return True

if __name__ == '__main__':
    print("🎯 强制添加Item模型Barcode字段")
    print("="*50)
    
    if deploy_with_migration():
        print("\n🎉 迁移和部署完成！")
        print("📝 下一步:")
        print("1. 等待App Engine部署完成（约1-2分钟）")
        print("2. 运行验证脚本确认barcode字段已添加")
        print("3. 使用Playwright测试功能")
    else:
        print("\n❌ 迁移或部署失败")