#!/usr/bin/env python
"""
使用Playwright测试barcode字段功能
"""
import asyncio
from playwright.async_api import async_playwright
import json
import sys

async def test_barcode_field():
    """测试barcode字段的创建和访问"""
    
    async with async_playwright() as p:
        # 启动浏览器
        browser = await p.chromium.launch(headless=False)  # 设置为False以便调试
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("开始测试barcode字段...")
            
            # 1. 访问生产环境管理员页面
            admin_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/"
            print(f"访问管理员页面: {admin_url}")
            
            await page.goto(admin_url)
            await page.wait_for_load_state('networkidle')
            
            # 检查页面标题
            title = await page.title()
            print(f"页面标题: {title}")
            
            if "Django administration" in title:
                print("✅ 成功访问Django管理员页面")
                
                # 2. 查找Items链接
                items_link = page.locator('a[href*="items/item/"]')
                if await items_link.count() > 0:
                    print("✅ 找到Items管理链接")
                    await items_link.click()
                    await page.wait_for_load_state('networkidle')
                    
                    # 3. 检查是否可以添加新项目
                    add_link = page.locator('a[href*="add/"]')
                    if await add_link.count() > 0:
                        print("✅ 找到添加项目链接")
                        await add_link.click()
                        await page.wait_for_load_state('networkidle')
                        
                        # 4. 检查barcode字段是否存在
                        barcode_field = page.locator('input[name="barcode"], input[id*="barcode"]')
                        if await barcode_field.count() > 0:
                            print("✅ barcode字段存在于添加表单中")
                            
                            # 5. 尝试填写表单测试barcode字段
                            await page.fill('input[name="name"]', 'Test Item for Barcode')
                            await page.fill('input[name="unit"]', 'pieces')
                            
                            # 填写barcode字段
                            await barcode_field.fill('TEST-BARCODE-001')
                            print("✅ 成功填写barcode字段")
                            
                            # 检查字段值
                            barcode_value = await barcode_field.input_value()
                            print(f"barcode字段值: {barcode_value}")
                            
                        else:
                            print("❌ barcode字段不存在于添加表单中")
                            
                            # 列出所有可用字段
                            all_inputs = await page.locator('input').all()
                            field_names = []
                            for input_elem in all_inputs:
                                name = await input_elem.get_attribute('name')
                                if name:
                                    field_names.append(name)
                            
                            print(f"可用字段: {field_names}")
                    else:
                        print("❌ 未找到添加项目链接")
                else:
                    print("❌ 未找到Items管理链接")
                    
                    # 列出所有可用的管理链接
                    all_links = await page.locator('a').all()
                    link_texts = []
                    for link in all_links:
                        text = await link.text_content()
                        href = await link.get_attribute('href')
                        if text and href:
                            link_texts.append(f"{text} -> {href}")
                    
                    print("可用管理链接:")
                    for link_text in link_texts[:10]:  # 只显示前10个
                        print(f"  {link_text}")
            else:
                print("❌ 无法访问Django管理员页面")
                print(f"实际页面内容: {await page.content()[:500]}...")
                
        except Exception as e:
            print(f"❌ 测试过程中发生错误: {str(e)}")
            
            # 截图保存错误状态
            await page.screenshot(path='error_screenshot.png')
            print("已保存错误截图: error_screenshot.png")
            
        finally:
            await browser.close()

async def test_api_barcode_field():
    """测试API中的barcode字段"""
    print("\n测试API中的barcode字段...")
    
    import aiohttp
    
    async with aiohttp.ClientSession() as session:
        try:
            # 测试健康检查
            async with session.get('https://lab-inventory-467021.nn.r.appspot.com/health/') as response:
                print(f"健康检查状态: {response.status}")
                
            # 测试Items API（可能需要认证）
            async with session.get('https://lab-inventory-467021.nn.r.appspot.com/api/items/') as response:
                print(f"Items API状态: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    if data.get('results'):
                        first_item = data['results'][0]
                        if 'barcode' in first_item:
                            print("✅ API返回包含barcode字段")
                            print(f"示例barcode: {first_item.get('barcode')}")
                        else:
                            print("❌ API返回不包含barcode字段")
                            print(f"可用字段: {list(first_item.keys())}")
                elif response.status == 401:
                    print("⚠️ API需要认证，无法直接测试字段")
                    
        except Exception as e:
            print(f"❌ API测试失败: {str(e)}")

if __name__ == '__main__':
    print("开始Playwright测试...")
    
    # 首先测试API
    asyncio.run(test_api_barcode_field())
    
    # 然后测试Web界面
    asyncio.run(test_barcode_field())
    
    print("测试完成！")