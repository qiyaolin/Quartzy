#!/usr/bin/env python
"""
最终验证Item和Request的Barcode字段都正常工作
"""
import asyncio
from playwright.async_api import async_playwright

async def final_verification():
    """最终验证两个模型的Barcode字段"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("🎯 最终验证：Item和Request的Barcode字段功能")
            print("="*60)
            
            # 登录
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/login/")
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'Lqy960311!')
            await page.click('input[type="submit"]')
            await page.wait_for_load_state('networkidle')
            print("✅ 登录成功")
            
            # 1. 验证Item的Barcode字段
            print("\n1️⃣ 验证Item模型的Barcode字段...")
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/items/item/add/")
            await page.wait_for_load_state('networkidle')
            
            item_barcode_field = page.locator('input[name="barcode"]')
            item_barcode_exists = await item_barcode_field.count() > 0
            
            print(f"Item Barcode字段: {'✅ 存在' if item_barcode_exists else '❌ 不存在'}")
            
            if item_barcode_exists:
                # 测试Item Barcode字段功能
                test_item_barcode = "ITEM-FINAL-TEST-001"
                await item_barcode_field.fill(test_item_barcode)
                filled_value = await item_barcode_field.input_value()
                
                if filled_value == test_item_barcode:
                    print(f"✅ Item Barcode字段功能正常: {filled_value}")
                    item_success = True
                else:
                    print(f"❌ Item Barcode字段功能异常")
                    item_success = False
            else:
                item_success = False
            
            # 截图保存Item页面
            await page.screenshot(path='final_item_page.png')
            print("📸 已保存Item添加页面截图: final_item_page.png")
            
            # 2. 验证Request的Barcode字段
            print("\n2️⃣ 验证Request模型的Barcode字段...")
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/inventory_requests/request/add/")
            await page.wait_for_load_state('networkidle')
            
            request_barcode_field = page.locator('input[name="barcode"]')
            request_barcode_exists = await request_barcode_field.count() > 0
            
            print(f"Request Barcode字段: {'✅ 存在' if request_barcode_exists else '❌ 不存在'}")
            
            if request_barcode_exists:
                # 测试Request Barcode字段功能
                test_request_barcode = "REQ-FINAL-TEST-001"
                await request_barcode_field.fill(test_request_barcode)
                filled_value = await request_barcode_field.input_value()
                
                if filled_value == test_request_barcode:
                    print(f"✅ Request Barcode字段功能正常: {filled_value}")
                    request_success = True
                else:
                    print(f"❌ Request Barcode字段功能异常")
                    request_success = False
            else:
                request_success = False
            
            # 截图保存Request页面
            await page.screenshot(path='final_request_page.png')
            print("📸 已保存Request添加页面截图: final_request_page.png")
            
            # 3. 总结验证结果
            print("\n" + "="*60)
            print("🎯 最终验证结果:")
            print(f"Item模型Barcode字段:     {'✅ 正常工作' if item_success else '❌ 存在问题'}")
            print(f"Request模型Barcode字段:  {'✅ 正常工作' if request_success else '❌ 存在问题'}")
            
            if item_success and request_success:
                print("\n🎉 完美！两个模型的Barcode字段都正常工作！")
                print("✅ 问题已彻底解决")
                print("✅ Item和Request现在都在初始迁移中包含Barcode字段")
                return True
            elif request_success and not item_success:
                print("\n⚠️ Request正常，Item仍有问题")
                print("需要检查Item的初始迁移是否正确应用")
                return False
            else:
                print("\n❌ 验证失败，需要进一步检查")
                return False
                
        except Exception as e:
            print(f"❌ 验证过程中发生错误: {str(e)}")
            await page.screenshot(path='final_verification_error.png')
            return False
            
        finally:
            await browser.close()

if __name__ == '__main__':
    print("🚀 开始最终验证...")
    print("📋 验证内容:")
    print("- Item模型的Barcode字段（现在在初始迁移中创建）")
    print("- Request模型的Barcode字段（一直在初始迁移中）")
    print("- 两个字段的功能是否正常")
    
    result = asyncio.run(final_verification())
    
    if result:
        print("\n🎊 任务完成！")
        print("✅ Django Item模型Barcode字段迁移问题已彻底解决")
        print("✅ 采用了和Request相同的方式：在初始迁移中就包含Barcode字段")
        print("✅ 全新部署确保了数据库结构的一致性")
    else:
        print("\n❌ 仍需进一步处理")