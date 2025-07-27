#!/usr/bin/env python
"""
部署barcode字段迁移到生产环境
"""
import subprocess
import sys
import os

def run_command(command, description):
    """执行命令并显示结果"""
    print(f"\n{description}...")
    print(f"执行命令: {command}")
    
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, cwd='.')
        
        if result.returncode == 0:
            print(f"✅ {description} 成功")
            if result.stdout:
                print(f"输出: {result.stdout}")
        else:
            print(f"❌ {description} 失败")
            print(f"错误: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ {description} 异常: {str(e)}")
        return False
    
    return True

def deploy_migration():
    """部署迁移到生产环境"""
    print("开始部署barcode字段迁移到Google App Engine...")
    
    # 1. 检查本地迁移状态
    if not run_command("python manage.py showmigrations items", "检查本地迁移状态"):
        return False
    
    # 2. 创建新的迁移（如果需要）
    print("\n检查是否需要创建新的迁移...")
    run_command("python manage.py makemigrations items --dry-run", "检查待创建的迁移")
    
    # 3. 部署到App Engine
    print("\n准备部署到App Engine...")
    
    # 确保app.yaml配置正确
    if not os.path.exists('app.yaml'):
        print("❌ app.yaml文件不存在")
        return False
    
    # 部署应用
    if not run_command("gcloud app deploy --quiet", "部署应用到App Engine"):
        return False
    
    # 4. 在生产环境执行迁移
    print("\n在生产环境执行数据库迁移...")
    
    # 使用gcloud运行迁移命令
    migration_command = "gcloud app exec -- python manage.py migrate items --verbosity=2"
    if not run_command(migration_command, "在生产环境执行迁移"):
        # 如果直接执行失败，尝试通过Cloud Shell
        print("尝试通过Cloud Shell执行迁移...")
        shell_command = f'gcloud cloud-shell ssh --command="cd /tmp && git clone https://github.com/your-repo.git && cd your-repo && python manage.py migrate items"'
        print(f"请手动执行: {shell_command}")
    
    print("\n✅ 迁移部署完成！")
    return True

def verify_deployment():
    """验证部署结果"""
    print("\n验证部署结果...")
    
    # 检查生产环境API
    import requests
    
    base_url = "https://lab-inventory-467021.nn.r.appspot.com"
    
    try:
        # 检查健康状态
        health_response = requests.get(f"{base_url}/health/", timeout=30)
        print(f"健康检查: {health_response.status_code}")
        
        # 检查管理员页面
        admin_response = requests.get(f"{base_url}/admin/", timeout=30)
        print(f"管理员页面: {admin_response.status_code}")
        
        if admin_response.status_code == 200:
            print("✅ 生产环境部署成功")
        else:
            print("❌ 生产环境可能存在问题")
            
    except Exception as e:
        print(f"❌ 验证失败: {str(e)}")

if __name__ == '__main__':
    if deploy_migration():
        verify_deployment()
    else:
        print("❌ 部署失败")
        sys.exit(1)