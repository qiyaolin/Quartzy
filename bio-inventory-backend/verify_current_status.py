#!/usr/bin/env python
"""
验证当前生产环境Item添加页面的Barcode字段状态
"""
import asyncio
from playwright.async_api import async_playwright

async def verify_item_barcode_field():
    """验证Item添加页面的Barcode字段"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("🔍 验证生产环境Item添加页面的Barcode字段状态...")
            
            # 登录
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/login/")
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'Lqy960311!')
            await page.click('input[type="submit"]')
            await page.wait_for_load_state('networkidle')
            print("✅ 登录成功")
            
            # 访问Item添加页面
            print("📋 访问Item添加页面...")
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/items/item/add/")
            await page.wait_for_load_state('networkidle')
            
            # 截图保存当前状态
            await page.screenshot(path='item_add_page_current.png')
            print("📸 已保存Item添加页面截图: item_add_page_current.png")
            
            # 检查Barcode字段
            barcode_field = page.locator('input[name="barcode"]')
            barcode_label = page.locator('label:has-text("Barcode"), label:has-text("barcode")')
            
            barcode_field_exists = await barcode_field.count() > 0
            barcode_label_exists = await barcode_label.count() > 0
            
            print(f"Item Barcode输入字段: {'✅ 存在' if barcode_field_exists else '❌ 不存在'}")
            print(f"Item Barcode标签: {'✅ 存在' if barcode_label_exists else '❌ 不存在'}")
            
            # 列出所有可用字段
            all_inputs = await page.locator('input[name], select[name], textarea[name]').all()
            field_names = []
            for input_elem in all_inputs:
                name = await input_elem.get_attribute('name')
                if name:
                    field_names.append(name)
            
            print(f"Item表单中所有字段: {field_names}")
            
            # 对比：访问Request添加页面
            print("\n📋 对比：访问Request添加页面...")
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/inventory_requests/request/add/")
            await page.wait_for_load_state('networkidle')
            
            # 截图保存Request页面
            await page.screenshot(path='request_add_page_current.png')
            print("📸 已保存Request添加页面截图: request_add_page_current.png")
            
            # 检查Request的Barcode字段
            request_barcode_field = page.locator('input[name="barcode"]')
            request_barcode_label = page.locator('label:has-text("Barcode"), label:has-text("barcode")')
            
            request_barcode_field_exists = await request_barcode_field.count() > 0
            request_barcode_label_exists = await request_barcode_label.count() > 0
            
            print(f"Request Barcode输入字段: {'✅ 存在' if request_barcode_field_exists else '❌ 不存在'}")
            print(f"Request Barcode标签: {'✅ 存在' if request_barcode_label_exists else '❌ 不存在'}")
            
            # 列出Request表单的所有字段
            request_inputs = await page.locator('input[name], select[name], textarea[name]').all()
            request_field_names = []
            for input_elem in request_inputs:
                name = await input_elem.get_attribute('name')
                if name:
                    request_field_names.append(name)
            
            print(f"Request表单中所有字段: {request_field_names}")
            
            # 总结对比结果
            print("\n" + "="*60)
            print("🔍 对比验证结果:")
            print(f"Item Barcode字段:     {'❌ 确认不存在' if not barcode_field_exists else '✅ 存在'}")
            print(f"Request Barcode字段:  {'❌ 不存在' if not request_barcode_field_exists else '✅ 确认存在'}")
            
            if request_barcode_field_exists and not barcode_field_exists:
                print("\n💡 结论确认:")
                print("✅ Request的Barcode字段正常工作（在初始迁移中创建）")
                print("❌ Item的Barcode字段确实不存在（后续迁移未执行）")
                print("🔧 需要采用和Request相同的方式：在初始迁移中就包含Barcode字段")
                return False
            else:
                return True
                
        except Exception as e:
            print(f"❌ 验证过程中发生错误: {str(e)}")
            await page.screenshot(path='verification_error.png')
            return False
            
        finally:
            await browser.close()

if __name__ == '__main__':
    print("🚀 开始验证当前生产环境状态...")
    print("="*60)
    
    result = asyncio.run(verify_item_barcode_field())
    
    print("="*60)
    if not result:
        print("❌ 验证确认：Item的Barcode字段在生产环境中不存在")
        print("\n📝 修复方案:")
        print("1. 修改Item模型的初始迁移，在0001_initial.py中就包含barcode字段")
        print("2. 清空现有的App Engine数据")
        print("3. 重新部署全新的App Engine服务器")
        print("4. 这样Item和Request的barcode字段都会在初始创建时就存在")
    else:
        print("✅ Item的Barcode字段已存在，问题已解决")