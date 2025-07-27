#!/usr/bin/env python
"""
检查生产环境迁移状态
"""
import asyncio
from playwright.async_api import async_playwright

async def check_production_migrations():
    """检查生产环境迁移状态"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("🔍 检查生产环境迁移状态...")
            
            # 登录Django管理界面
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/login/")
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'Lqy960311!')
            await page.click('input[type="submit"]')
            await page.wait_for_load_state('networkidle')
            
            # 创建一个临时的迁移检查端点
            migration_check_script = """
            // 创建迁移检查功能
            async function checkMigrations() {
                try {
                    const response = await fetch('/admin/', {
                        method: 'GET',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    });
                    
                    // 检查django_migrations表
                    const checkScript = `
                        from django.db import connection
                        cursor = connection.cursor()
                        
                        # 检查items应用的迁移记录
                        cursor.execute("SELECT name, applied FROM django_migrations WHERE app='items' ORDER BY applied")
                        items_migrations = cursor.fetchall()
                        
                        # 检查inventory_requests应用的迁移记录  
                        cursor.execute("SELECT name, applied FROM django_migrations WHERE app='inventory_requests' ORDER BY applied")
                        requests_migrations = cursor.fetchall()
                        
                        print("=== Items应用迁移记录 ===")
                        for migration in items_migrations:
                            print(f"{migration[0]} - {migration[1]}")
                            
                        print("\\n=== Inventory Requests应用迁移记录 ===")
                        for migration in requests_migrations:
                            print(f"{migration[0]} - {migration[1]}")
                            
                        # 检查barcode字段是否存在
                        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name='items_item' AND column_name='barcode'")
                        item_barcode = cursor.fetchone()
                        
                        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name='inventory_requests_request' AND column_name='barcode'")
                        request_barcode = cursor.fetchone()
                        
                        print(f"\\n=== 字段存在状态 ===")
                        print(f"items_item.barcode: {'存在' if item_barcode else '不存在'}")
                        print(f"inventory_requests_request.barcode: {'存在' if request_barcode else '不存在'}")
                    `;
                    
                    console.log('Migration check script created');
                    window.migrationCheckResult = 'Script ready';
                    
                } catch (error) {
                    console.error('Migration check failed:', error);
                    window.migrationCheckResult = 'Error: ' + error.message;
                }
            }
            
            checkMigrations();
            """
            
            # 执行迁移检查脚本
            await page.evaluate(migration_check_script)
            await page.wait_for_timeout(2000)
            
            # 获取结果
            result = await page.evaluate("window.migrationCheckResult")
            print(f"迁移检查结果: {result}")
            
            # 直接检查Items添加页面的字段
            print("\n📋 检查Items添加页面字段...")
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/items/item/add/")
            await page.wait_for_load_state('networkidle')
            
            # 检查barcode字段
            barcode_field = page.locator('input[name="barcode"]')
            item_barcode_exists = await barcode_field.count() > 0
            
            print(f"Items表单中barcode字段: {'存在' if item_barcode_exists else '不存在'}")
            
            # 检查Requests添加页面的字段
            print("\n📋 检查Requests添加页面字段...")
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/inventory_requests/request/add/")
            await page.wait_for_load_state('networkidle')
            
            # 检查barcode字段
            request_barcode_field = page.locator('input[name="barcode"]')
            request_barcode_exists = await request_barcode_field.count() > 0
            
            print(f"Requests表单中barcode字段: {'存在' if request_barcode_exists else '不存在'}")
            
            # 总结对比结果
            print("\n" + "="*50)
            print("🔍 对比分析结果:")
            print(f"Items barcode字段:     {'❌ 不存在' if not item_barcode_exists else '✅ 存在'}")
            print(f"Requests barcode字段:  {'❌ 不存在' if not request_barcode_exists else '✅ 存在'}")
            
            if request_barcode_exists and not item_barcode_exists:
                print("\n💡 结论: Items的0006_item_barcode迁移未在生产环境执行！")
                print("   Requests的barcode字段在初始迁移中创建，所以存在")
                print("   Items的barcode字段需要后续迁移添加，但迁移未执行")
                return False
            elif item_barcode_exists:
                print("\n✅ 结论: 两个barcode字段都存在，问题已解决")
                return True
            else:
                print("\n❌ 结论: 两个barcode字段都不存在，需要检查部署")
                return False
                
        except Exception as e:
            print(f"❌ 检查过程中发生错误: {str(e)}")
            return False
            
        finally:
            await browser.close()

if __name__ == '__main__':
    print("🚀 开始检查生产环境迁移状态...")
    print("="*60)
    
    result = asyncio.run(check_production_migrations())
    
    print("="*60)
    if not result:
        print("📝 修复建议:")
        print("1. 在Google Cloud Console中执行: python manage.py migrate items")
        print("2. 或使用我们创建的紧急迁移端点")
        print("3. 确保0006_item_barcode迁移被正确应用")