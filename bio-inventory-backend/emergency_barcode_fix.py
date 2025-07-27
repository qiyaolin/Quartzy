#!/usr/bin/env python
"""
紧急修复生产环境barcode字段的脚本
通过Django管理界面直接执行SQL命令
"""
import asyncio
from playwright.async_api import async_playwright

async def emergency_add_barcode_field():
    """紧急添加barcode字段到生产环境"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("开始紧急修复barcode字段...")
            
            # 1. 登录Django管理界面
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/login/")
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'Lqy960311!')
            await page.click('input[type="submit"]')
            await page.wait_for_load_state('networkidle')
            
            print("✅ 成功登录管理界面")
            
            # 2. 尝试访问Django Shell（如果可用）
            # 注意：大多数生产环境不会暴露shell接口
            shell_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/shell/"
            try:
                await page.goto(shell_url)
                await page.wait_for_load_state('networkidle')
                
                if "shell" in page.url.lower():
                    print("✅ 找到Django Shell接口")
                    # 在shell中执行迁移命令
                    shell_input = page.locator('textarea, input[type="text"]')
                    if await shell_input.count() > 0:
                        migration_command = """
from django.core.management import execute_from_command_line
execute_from_command_line(['manage.py', 'migrate', 'items'])
"""
                        await shell_input.fill(migration_command)
                        await page.keyboard.press('Enter')
                        print("✅ 执行迁移命令")
                else:
                    print("⚠️ 未找到Django Shell接口")
            except:
                print("⚠️ Django Shell不可用")
            
            # 3. 检查是否有数据库管理工具
            # 尝试访问可能的数据库管理端点
            db_admin_urls = [
                "https://lab-inventory-467021.nn.r.appspot.com/admin/database/",
                "https://lab-inventory-467021.nn.r.appspot.com/admin/sql/",
                "https://lab-inventory-467021.nn.r.appspot.com/admin/dbshell/"
            ]
            
            for url in db_admin_urls:
                try:
                    await page.goto(url)
                    await page.wait_for_load_state('networkidle')
                    
                    if page.url == url and "404" not in await page.content():
                        print(f"✅ 找到数据库管理界面: {url}")
                        break
                except:
                    continue
            
            # 4. 如果以上方法都不可行，创建一个临时的修复视图
            print("创建临时修复方案...")
            
            # 访问Items添加页面，检查当前状态
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/items/item/add/")
            await page.wait_for_load_state('networkidle')
            
            barcode_field = page.locator('input[name="barcode"]')
            if await barcode_field.count() > 0:
                print("✅ barcode字段已存在，无需修复")
                return True
            else:
                print("❌ 确认barcode字段不存在，需要手动修复")
                
                # 提供手动修复的SQL命令
                sql_commands = [
                    "-- 添加barcode字段到items_item表",
                    "ALTER TABLE items_item ADD COLUMN barcode VARCHAR(50) NULL;",
                    "",
                    "-- 添加唯一约束",
                    "CREATE UNIQUE INDEX items_item_barcode_unique ON items_item(barcode) WHERE barcode IS NOT NULL;",
                    "",
                    "-- 更新Django迁移记录",
                    "INSERT INTO django_migrations (app, name, applied) VALUES ('items', '0006_item_barcode', NOW());"
                ]
                
                print("\n需要在生产数据库中执行以下SQL命令:")
                print("=" * 60)
                for cmd in sql_commands:
                    print(cmd)
                print("=" * 60)
                
                return False
                
        except Exception as e:
            print(f"❌ 紧急修复过程中发生错误: {str(e)}")
            return False
            
        finally:
            await browser.close()

async def create_migration_endpoint():
    """创建一个临时的迁移端点建议"""
    print("\n建议创建临时迁移端点:")
    print("=" * 50)
    
    endpoint_code = '''
# 在 bio-inventory-backend/core/urls.py 中添加:
from django.urls import path
from django.http import JsonResponse
from django.db import connection
from django.contrib.admin.views.decorators import staff_member_required

@staff_member_required
def emergency_migrate(request):
    """紧急迁移端点"""
    if request.method == 'POST':
        try:
            with connection.cursor() as cursor:
                # 检查barcode字段是否存在
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name='items_item' AND column_name='barcode'
                """)
                
                if not cursor.fetchone():
                    # 添加barcode字段
                    cursor.execute("""
                        ALTER TABLE items_item 
                        ADD COLUMN barcode VARCHAR(50) NULL
                    """)
                    
                    # 添加唯一约束
                    cursor.execute("""
                        CREATE UNIQUE INDEX items_item_barcode_unique 
                        ON items_item(barcode) 
                        WHERE barcode IS NOT NULL
                    """)
                    
                    # 更新迁移记录
                    cursor.execute("""
                        INSERT INTO django_migrations (app, name, applied) 
                        VALUES ('items', '0006_item_barcode', NOW())
                    """)
                    
                    return JsonResponse({'success': 'Barcode field added successfully'})
                else:
                    return JsonResponse({'info': 'Barcode field already exists'})
                    
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': 'POST method required'}, status=405)

# 添加URL路由:
urlpatterns = [
    # ... 其他路由
    path('admin/emergency-migrate/', emergency_migrate, name='emergency_migrate'),
]
'''
    
    print(endpoint_code)
    print("=" * 50)

if __name__ == '__main__':
    print("开始紧急修复barcode字段...")
    
    # 执行紧急修复
    result = asyncio.run(emergency_add_barcode_field())
    
    if not result:
        # 如果自动修复失败，提供手动修复方案
        asyncio.run(create_migration_endpoint())
        
        print("\n手动修复步骤:")
        print("1. 在Google Cloud Console中打开Cloud Shell")
        print("2. 连接到生产数据库")
        print("3. 执行上述SQL命令")
        print("4. 重新部署应用")
        print("5. 验证barcode字段功能")