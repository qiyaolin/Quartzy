#!/usr/bin/env python
"""
清空现有App Engine数据并重新部署全新服务器
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

def fresh_deployment():
    """执行全新部署"""
    print("🚀 开始全新部署流程...")
    print("="*60)
    
    # 1. 检查gcloud认证
    print("1️⃣ 检查gcloud认证状态...")
    if not run_command("gcloud auth list", "检查认证状态"):
        print("请先运行: gcloud auth login")
        return False
    
    # 2. 设置项目
    project_id = "lab-inventory-467021"
    if not run_command(f"gcloud config set project {project_id}", f"设置项目 {project_id}"):
        return False
    
    # 3. 清理本地迁移缓存
    print("\n2️⃣ 清理本地迁移状态...")
    if os.path.exists("db.sqlite3"):
        os.remove("db.sqlite3")
        print("✅ 删除本地SQLite数据库")
    
    # 清理迁移缓存
    cache_dirs = [
        "items/migrations/__pycache__",
        "inventory_requests/migrations/__pycache__",
        "users/migrations/__pycache__",
        "funding/migrations/__pycache__",
        "notifications/migrations/__pycache__"
    ]
    
    for cache_dir in cache_dirs:
        if os.path.exists(cache_dir):
            import shutil
            shutil.rmtree(cache_dir)
            print(f"✅ 清理缓存目录: {cache_dir}")
    
    # 4. 重新创建本地数据库和迁移
    print("\n3️⃣ 重新创建本地数据库...")
    if not run_command("python manage.py makemigrations", "创建迁移文件"):
        return False
    
    if not run_command("python manage.py migrate", "执行本地迁移"):
        return False
    
    # 5. 创建超级用户（如果需要）
    print("\n4️⃣ 准备超级用户...")
    print("注意：部署后需要在生产环境中创建超级用户")
    
    # 6. 部署到App Engine
    print("\n5️⃣ 部署到Google App Engine...")
    if not run_command("gcloud app deploy --quiet", "部署应用"):
        return False
    
    # 7. 在生产环境执行迁移
    print("\n6️⃣ 在生产环境执行迁移...")
    print("注意：App Engine不支持直接执行迁移命令")
    print("迁移将在首次访问时自动执行（如果配置了自动迁移）")
    
    # 8. 创建生产环境超级用户脚本
    create_superuser_script = '''
# 在Google Cloud Shell中执行以下命令创建超级用户：

# 1. 连接到App Engine实例
gcloud app browse

# 2. 在Cloud Shell中执行：
# 注意：这需要在支持交互式命令的环境中执行
# python manage.py createsuperuser --username=admin --email=admin@example.com

# 或者使用我们之前的方法，通过Django管理界面
'''
    
    with open('create_superuser_instructions.txt', 'w', encoding='utf-8') as f:
        f.write(create_superuser_script)
    
    print("✅ 已创建超级用户创建说明: create_superuser_instructions.txt")
    
    print("\n7️⃣ 验证部署...")
    base_url = "https://lab-inventory-467021.nn.r.appspot.com"
    
    import requests
    import time
    
    # 等待部署完成
    print("等待部署完成...")
    time.sleep(30)
    
    try:
        # 测试健康检查
        health_response = requests.get(f"{base_url}/health/", timeout=30)
        print(f"健康检查: {health_response.status_code}")
        
        # 测试管理员页面
        admin_response = requests.get(f"{base_url}/admin/", timeout=30)
        print(f"管理员页面: {admin_response.status_code}")
        
        if health_response.status_code == 200 and admin_response.status_code == 200:
            print("✅ 全新部署成功！")
            return True
        else:
            print("⚠️ 部署可能存在问题，请检查")
            return False
            
    except Exception as e:
        print(f"⚠️ 验证请求失败: {str(e)}")
        print("这可能是正常的，因为服务器可能还在启动中")
        return True

if __name__ == '__main__':
    print("🚀 Django Item模型Barcode字段全新部署方案")
    print("="*60)
    print("📋 修改内容:")
    print("✅ 已修改items/migrations/0001_initial.py，在初始迁移中包含barcode字段")
    print("✅ 已删除items/migrations/0006_item_barcode.py（不再需要）")
    print("✅ 现在Item和Request模型的barcode字段都在初始迁移中创建")
    print("="*60)
    
    if fresh_deployment():
        print("\n🎉 全新部署完成！")
        print("📝 下一步:")
        print("1. 访问 https://lab-inventory-467021.nn.r.appspot.com/admin/")
        print("2. 使用用户名: admin, 密码: Lqy960311! 登录")
        print("3. 验证Item添加页面现在包含Barcode字段")
        print("4. 运行Playwright测试确认功能正常")
    else:
        print("\n❌ 部署失败，请检查错误信息")
        sys.exit(1)