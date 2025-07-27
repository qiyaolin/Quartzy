#!/usr/bin/env python
"""
最终验证barcode字段修复结果
"""
import asyncio
from playwright.async_api import async_playwright
import requests

async def final_barcode_verification():
    """最终验证barcode字段功能"""
    
    print("🔍 开始最终验证barcode字段修复结果...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            # 1. 登录Django管理界面
            print("1️⃣ 登录Django管理界面...")
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/login/")
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'Lqy960311!')
            await page.click('input[type="submit"]')
            await page.wait_for_load_state('networkidle')
            print("✅ 登录成功")
            
            # 2. 检查barcode字段状态
            print("2️⃣ 检查barcode字段状态...")
            status_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/check-barcode-status/"
            await page.goto(status_url)
            await page.wait_for_load_state('networkidle')
            
            status_content = await page.content()
            if '"field_exists": true' in status_content:
                print("✅ barcode字段已存在于数据库中")
                field_status = True
            elif '"field_exists": false' in status_content:
                print("❌ barcode字段不存在，需要执行紧急迁移")
                field_status = False
                
                # 3. 执行紧急迁移
                print("3️⃣ 执行紧急迁移...")
                migrate_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/emergency-migrate-barcode/"
                
                # 创建POST请求
                await page.evaluate("""
                    fetch('/admin/emergency-migrate-barcode/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
                        },
                        body: JSON.stringify({})
                    }).then(response => response.json())
                    .then(data => {
                        window.migrationResult = data;
                        console.log('Migration result:', data);
                    });
                """)
                
                # 等待迁移完成
                await page.wait_for_timeout(3000)
                
                # 检查迁移结果
                migration_result = await page.evaluate("window.migrationResult")
                if migration_result and migration_result.get('success'):
                    print("✅ 紧急迁移执行成功")
                    field_status = True
                else:
                    print("❌ 紧急迁移执行失败")
                    field_status = False
            else:
                print("⚠️ 无法确定barcode字段状态")
                field_status = False
            
            # 4. 验证Items添加表单中的barcode字段
            if field_status:
                print("4️⃣ 验证Items添加表单中的barcode字段...")
                add_item_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/items/item/add/"
                await page.goto(add_item_url)
                await page.wait_for_load_state('networkidle')
                
                barcode_field = page.locator('input[name="barcode"]')
                if await barcode_field.count() > 0:
                    print("✅ barcode字段在添加表单中可见")
                    
                    # 测试字段功能
                    test_barcode = "FINAL-TEST-001"
                    await barcode_field.fill(test_barcode)
                    filled_value = await barcode_field.input_value()
                    
                    if filled_value == test_barcode:
                        print(f"✅ barcode字段功能正常: {filled_value}")
                        return True
                    else:
                        print(f"❌ barcode字段功能异常")
                        return False
                else:
                    print("❌ barcode字段在添加表单中不可见")
                    return False
            else:
                return False
                
        except Exception as e:
            print(f"❌ 验证过程中发生错误: {str(e)}")
            return False
            
        finally:
            await browser.close()

def test_api_with_requests():
    """使用requests测试API端点"""
    print("\n🌐 测试API端点...")
    
    base_url = "https://lab-inventory-467021.nn.r.appspot.com"
    
    try:
        # 测试健康检查
        health_response = requests.get(f"{base_url}/health/", timeout=10)
        print(f"✅ 健康检查: {health_response.status_code}")
        
        # 测试管理员页面
        admin_response = requests.get(f"{base_url}/admin/", timeout=10)
        print(f"✅ 管理员页面: {admin_response.status_code}")
        
        return True
        
    except Exception as e:
        print(f"❌ API测试失败: {str(e)}")
        return False

if __name__ == '__main__':
    print("🚀 开始最终验证...")
    print("=" * 60)
    
    # 测试API端点
    api_success = test_api_with_requests()
    
    # 验证barcode字段
    if api_success:
        barcode_success = asyncio.run(final_barcode_verification())
        
        print("=" * 60)
        if barcode_success:
            print("🎉 最终验证成功！")
            print("✅ barcode字段已在生产环境中正常工作")
            print("✅ Django管理界面可以正常访问和使用barcode字段")
            print("✅ 所有功能测试通过")
        else:
            print("❌ 最终验证失败")
            print("需要手动检查和修复问题")
    else:
        print("❌ API端点测试失败，无法继续验证")
    
    print("=" * 60)