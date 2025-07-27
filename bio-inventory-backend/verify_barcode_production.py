#!/usr/bin/env python
"""
验证生产环境barcode字段状态的简化脚本
"""
import asyncio
from playwright.async_api import async_playwright

async def quick_barcode_check():
    """快速检查生产环境barcode字段"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("快速检查生产环境barcode字段状态...")
            
            # 1. 登录
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/login/")
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'Lqy960311!')
            await page.click('input[type="submit"]')
            await page.wait_for_load_state('networkidle')
            
            # 2. 直接访问Items添加页面
            add_item_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/items/item/add/"
            await page.goto(add_item_url)
            await page.wait_for_load_state('networkidle')
            
            # 3. 检查barcode字段
            barcode_field = page.locator('input[name="barcode"]')
            barcode_exists = await barcode_field.count() > 0
            
            if barcode_exists:
                print("✅ 生产环境中barcode字段存在！")
                
                # 获取字段属性
                field_type = await barcode_field.get_attribute('type')
                field_maxlength = await barcode_field.get_attribute('maxlength')
                field_required = await barcode_field.get_attribute('required')
                
                print(f"字段类型: {field_type}")
                print(f"最大长度: {field_maxlength}")
                print(f"是否必填: {'是' if field_required else '否'}")
                
                # 测试字段功能
                test_barcode = "TEST-VERIFY-001"
                await barcode_field.fill(test_barcode)
                filled_value = await barcode_field.input_value()
                
                if filled_value == test_barcode:
                    print(f"✅ barcode字段功能正常，测试值: {filled_value}")
                else:
                    print(f"⚠️ barcode字段值异常，期望: {test_barcode}, 实际: {filled_value}")
                
                return True
            else:
                print("❌ 生产环境中barcode字段不存在")
                
                # 列出所有字段
                all_fields = await page.locator('input[name], select[name], textarea[name]').all()
                field_names = []
                for field in all_fields:
                    name = await field.get_attribute('name')
                    if name:
                        field_names.append(name)
                
                print(f"可用字段: {field_names}")
                return False
                
        except Exception as e:
            print(f"❌ 检查过程中发生错误: {str(e)}")
            return False
            
        finally:
            await browser.close()

async def check_migration_status():
    """检查迁移状态"""
    print("\n检查迁移状态...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            # 登录
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/login/")
            await page.fill('input[name="username"]', 'admin')
            await page.fill('input[name="password"]', 'Lqy960311!')
            await page.click('input[type="submit"]')
            await page.wait_for_load_state('networkidle')
            
            # 访问Items列表页面
            await page.goto("https://lab-inventory-467021.nn.r.appspot.com/admin/items/item/")
            await page.wait_for_load_state('networkidle')
            
            # 检查列表页面是否显示barcode列
            page_content = await page.content()
            if 'barcode' in page_content.lower():
                print("✅ Items列表页面包含barcode相关内容")
            else:
                print("❌ Items列表页面不包含barcode相关内容")
            
            # 检查是否有现有的Items
            item_rows = await page.locator('table tbody tr').count()
            print(f"现有Items数量: {item_rows}")
            
        except Exception as e:
            print(f"❌ 迁移状态检查失败: {str(e)}")
            
        finally:
            await browser.close()

if __name__ == '__main__':
    print("开始验证生产环境barcode字段...")
    print("=" * 50)
    
    # 运行快速检查
    result = asyncio.run(quick_barcode_check())
    
    # 检查迁移状态
    asyncio.run(check_migration_status())
    
    print("=" * 50)
    if result:
        print("🎉 验证成功！barcode字段在生产环境中正常工作")
    else:
        print("❌ 验证失败！需要执行数据库迁移")
        print("\n建议的修复步骤:")
        print("1. 在Google Cloud Console中执行: python manage.py migrate items")
        print("2. 或者使用紧急修复脚本添加字段")