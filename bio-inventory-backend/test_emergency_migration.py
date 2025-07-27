#!/usr/bin/env python
"""
测试紧急迁移端点功能
"""
import asyncio
from playwright.async_api import async_playwright
import requests
import json

async def test_emergency_migration_endpoint():
    """测试紧急迁移端点"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("开始测试紧急迁移端点...")
            
            # 1. 登录Django管理界面
            login_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/login/"
            await page.goto(login_url)
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'Lqy960311!')
            await page.click('input[type="submit"]')
            await page.wait_for_load_state('networkidle')
            
            print("✅ 成功登录管理界面")
            
            # 2. 首先检查barcode字段状态
            check_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/check-barcode-status/"
            await page.goto(check_url)
            await page.wait_for_load_state('networkidle')
            
            # 获取状态检查结果
            page_content = await page.content()
            print(f"Barcode状态检查结果: {page_content[:500]}...")
            
            if '"field_exists": false' in page_content:
                print("❌ 确认barcode字段不存在，需要执行迁移")
                
                # 3. 执行紧急迁移
                migrate_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/emergency-migrate-barcode/"
                
                # 使用POST请求执行迁移
                await page.goto(migrate_url, wait_until='networkidle')
                
                # 如果页面显示需要POST，我们需要创建一个表单
                if "POST method required" in await page.content():
                    # 创建并提交POST表单
                    await page.evaluate("""
                        const form = document.createElement('form');
                        form.method = 'POST';
                        form.action = '/admin/emergency-migrate-barcode/';
                        
                        // 添加CSRF token（如果需要）
                        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]');
                        if (csrfToken) {
                            const csrfInput = document.createElement('input');
                            csrfInput.type = 'hidden';
                            csrfInput.name = 'csrfmiddlewaretoken';
                            csrfInput.value = csrfToken.value;
                            form.appendChild(csrfInput);
                        }
                        
                        document.body.appendChild(form);
                        form.submit();
                    """)
                    
                    await page.wait_for_load_state('networkidle')
                
                # 检查迁移结果
                migration_result = await page.content()
                print(f"迁移执行结果: {migration_result[:500]}...")
                
                if '"success": true' in migration_result:
                    print("✅ 紧急迁移执行成功！")
                    
                    # 4. 再次检查状态确认
                    await page.goto(check_url)
                    await page.wait_for_load_state('networkidle')
                    
                    final_status = await page.content()
                    if '"field_exists": true' in final_status:
                        print("✅ 确认barcode字段已成功创建")
                        return True
                    else:
                        print("❌ 迁移后字段仍不存在")
                        return False
                else:
                    print("❌ 紧急迁移执行失败")
                    return False
                    
            elif '"field_exists": true' in page_content:
                print("✅ barcode字段已存在，无需迁移")
                return True
            else:
                print("⚠️ 无法确定barcode字段状态")
                return False
                
        except Exception as e:
            print(f"❌ 测试过程中发生错误: {str(e)}")
            await page.screenshot(path='emergency_migration_error.png')
            return False
            
        finally:
            await browser.close()

async def verify_barcode_functionality():
    """验证barcode字段功能"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("\n验证barcode字段功能...")
            
            # 登录
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/login/")
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'Lqy960311!')
            await page.click('input[type="submit"]')
            await page.wait_for_load_state('networkidle')
            
            # 访问Items添加页面
            add_item_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/items/item/add/"
            await page.goto(add_item_url)
            await page.wait_for_load_state('networkidle')
            
            # 检查barcode字段
            barcode_field = page.locator('input[name="barcode"]')
            if await barcode_field.count() > 0:
                print("✅ barcode字段在添加表单中可见")
                
                # 测试字段功能
                test_barcode = "EMERGENCY-TEST-001"
                await barcode_field.fill(test_barcode)
                
                filled_value = await barcode_field.input_value()
                if filled_value == test_barcode:
                    print(f"✅ barcode字段功能正常: {filled_value}")
                    return True
                else:
                    print(f"❌ barcode字段功能异常: 期望 {test_barcode}, 实际 {filled_value}")
                    return False
            else:
                print("❌ barcode字段在添加表单中不可见")
                return False
                
        except Exception as e:
            print(f"❌ 验证过程中发生错误: {str(e)}")
            return False
            
        finally:
            await browser.close()

if __name__ == '__main__':
    print("开始测试紧急迁移功能...")
    print("=" * 60)
    
    # 等待部署完成
    print("等待App Engine部署完成...")
    import time
    time.sleep(30)  # 等待30秒让部署完成
    
    # 执行紧急迁移测试
    migration_success = asyncio.run(test_emergency_migration_endpoint())
    
    if migration_success:
        # 验证字段功能
        functionality_success = asyncio.run(verify_barcode_functionality())
        
        if functionality_success:
            print("=" * 60)
            print("🎉 紧急迁移和功能验证全部成功！")
            print("barcode字段已在生产环境中正常工作")
        else:
            print("=" * 60)
            print("⚠️ 迁移成功但功能验证失败")
    else:
        print("=" * 60)
        print("❌ 紧急迁移失败")
        print("请检查服务器日志或手动执行SQL命令")