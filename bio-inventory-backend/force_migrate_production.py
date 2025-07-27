#!/usr/bin/env python
"""
强制在生产环境应用barcode字段迁移
"""
import subprocess
import sys
import os

def check_gcloud_auth():
    """检查gcloud认证状态"""
    try:
        result = subprocess.run(['gcloud', 'auth', 'list'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ gcloud已认证")
            return True
        else:
            print("❌ gcloud未认证，请先运行: gcloud auth login")
            return False
    except FileNotFoundError:
        print("❌ gcloud CLI未安装")
        return False

def deploy_and_migrate():
    """部署应用并执行迁移"""
    print("开始部署并执行迁移...")
    
    # 1. 检查认证
    if not check_gcloud_auth():
        return False
    
    # 2. 设置项目
    project_id = "lab-inventory-467021"
    subprocess.run(['gcloud', 'config', 'set', 'project', project_id])
    print(f"✅ 设置项目: {project_id}")
    
    # 3. 部署应用
    print("部署应用到App Engine...")
    deploy_result = subprocess.run(['gcloud', 'app', 'deploy', '--quiet'], 
                                 capture_output=True, text=True)
    
    if deploy_result.returncode == 0:
        print("✅ 应用部署成功")
    else:
        print(f"❌ 应用部署失败: {deploy_result.stderr}")
        return False
    
    # 4. 执行数据库迁移
    print("执行数据库迁移...")
    
    # 方法1: 通过Cloud Run执行迁移
    migrate_commands = [
        "python manage.py migrate --verbosity=2",
        "python manage.py migrate items --verbosity=2",
        "python manage.py migrate items 0006 --verbosity=2"
    ]
    
    for cmd in migrate_commands:
        print(f"执行: {cmd}")
        # 注意：App Engine不支持直接SSH，需要通过其他方式
        # 这里提供手动执行的命令
        print(f"请在Google Cloud Console中手动执行: {cmd}")
    
    print("\n✅ 部署完成！")
    print("请在Google Cloud Console的App Engine > 版本中确认新版本已部署")
    print("然后在Cloud Shell中执行迁移命令")
    
    return True

def create_migration_script():
    """创建可在Cloud Shell中执行的迁移脚本"""
    script_content = """#!/bin/bash
# 在Google Cloud Shell中执行此脚本

echo "开始执行Django迁移..."

# 设置项目
gcloud config set project lab-inventory-467021

# 克隆代码（如果需要）
# git clone YOUR_REPO_URL
# cd YOUR_REPO_NAME

# 安装依赖
pip install -r requirements.txt

# 执行迁移
echo "执行数据库迁移..."
python manage.py migrate --verbosity=2

echo "执行items应用迁移..."
python manage.py migrate items --verbosity=2

echo "检查迁移状态..."
python manage.py showmigrations items

echo "迁移完成！"
"""
    
    with open('cloud_shell_migrate.sh', 'w') as f:
        f.write(script_content)
    
    print("✅ 已创建cloud_shell_migrate.sh脚本")
    print("请将此脚本上传到Google Cloud Shell并执行")

if __name__ == '__main__':
    if deploy_and_migrate():
        create_migration_script()
        print("\n下一步:")
        print("1. 访问 https://console.cloud.google.com/appengine")
        print("2. 确认新版本已部署")
        print("3. 在Cloud Shell中执行迁移脚本")
        print("4. 运行Playwright测试验证结果")
    else:
        print("❌ 部署失败")
        sys.exit(1)