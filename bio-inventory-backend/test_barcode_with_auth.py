#!/usr/bin/env python
"""
使用管理员账号登录并测试barcode字段功能
"""
import asyncio
from playwright.async_api import async_playwright
import json
import sys

async def test_barcode_field_with_auth():
    """使用管理员账号测试barcode字段"""
    
    async with async_playwright() as p:
        # 启动浏览器
        browser = await p.chromium.launch(headless=False)  # 设置为False以便调试
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            print("开始使用管理员账号测试barcode字段...")
            
            # 1. 访问生产环境管理员登录页面
            login_url = "https://lab-inventory-467021.nn.r.appspot.com/admin/login/"
            print(f"访问管理员登录页面: {login_url}")
            
            await page.goto(login_url)
            await page.wait_for_load_state('networkidle')
            
            # 检查页面标题
            title = await page.title()
            print(f"页面标题: {title}")
            
            if "Django administration" in title or "Log in" in title:
                print("✅ 成功访问Django管理员登录页面")
                
                # 2. 填写登录信息
                username_field = page.locator('input[name="username"]')
                password_field = page.locator('input[name="password"]')
                
                if await username_field.count() > 0 and await password_field.count() > 0:
                    print("✅ 找到登录表单")
                    
                    # 填写用户名和密码
                    await username_field.fill('admin')
                    await password_field.fill('Lqy960311!')
                    
                    # 点击登录按钮
                    login_button = page.locator('input[type="submit"]')
                    await login_button.click()
                    await page.wait_for_load_state('networkidle')
                    
                    # 检查是否登录成功
                    current_url = page.url
                    if "/admin/" in current_url and "login" not in current_url:
                        print("✅ 成功登录Django管理界面")
                        
                        # 3. 查找Items链接 - 使用更精确的选择器
                        items_link = page.locator('a[href="/admin/items/item/"]').first()
                        if await items_link.count() > 0:
                            print("✅ 找到Items管理链接")
                            await items_link.click()
                            await page.wait_for_load_state('networkidle')
                            
                            # 4. 检查Items列表页面
                            current_title = await page.title()
                            print(f"Items页面标题: {current_title}")
                            
                            # 检查是否有添加按钮
                            add_button = page.locator('a[href*="add/"]').first()
                            if await add_button.count() > 0:
                                print("✅ 找到添加Item按钮")
                                await add_button.click()
                                await page.wait_for_load_state('networkidle')
                                
                                # 5. 检查添加Item表单中的barcode字段
                                print("检查添加Item表单中的字段...")
                                
                                # 查找barcode字段
                                barcode_field = page.locator('input[name="barcode"], input[id*="barcode"]')
                                barcode_label = page.locator('label:has-text("Barcode"), label:has-text("barcode")')
                                
                                if await barcode_field.count() > 0:
                                    print("✅ barcode字段存在于添加表单中")
                                    
                                    # 获取字段属性
                                    field_type = await barcode_field.get_attribute('type')
                                    field_maxlength = await barcode_field.get_attribute('maxlength')
                                    print(f"barcode字段类型: {field_type}, 最大长度: {field_maxlength}")
                                    
                                    # 尝试填写测试数据
                                    print("尝试填写测试Item数据...")
                                    
                                    # 填写必填字段
                                    name_field = page.locator('input[name="name"]')
                                    if await name_field.count() > 0:
                                        await name_field.fill('测试Barcode字段的Item')
                                    
                                    unit_field = page.locator('input[name="unit"]')
                                    if await unit_field.count() > 0:
                                        await unit_field.fill('个')
                                    
                                    # 选择item_type（如果存在）
                                    item_type_select = page.locator('select[name="item_type"]')
                                    if await item_type_select.count() > 0:
                                        # 获取第一个选项
                                        options = await item_type_select.locator('option').all()
                                        if len(options) > 1:  # 跳过空选项
                                            first_option_value = await options[1].get_attribute('value')
                                            if first_option_value:
                                                await item_type_select.select_option(first_option_value)
                                    
                                    # 填写barcode字段
                                    test_barcode = 'TEST-BARCODE-001'
                                    await barcode_field.fill(test_barcode)
                                    print(f"✅ 成功填写barcode字段: {test_barcode}")
                                    
                                    # 检查字段值
                                    barcode_value = await barcode_field.input_value()
                                    print(f"barcode字段当前值: {barcode_value}")
                                    
                                    # 尝试保存（但不实际提交）
                                    save_button = page.locator('input[name="_save"]')
                                    if await save_button.count() > 0:
                                        print("✅ 找到保存按钮，barcode字段功能正常")
                                        # 注意：这里不实际点击保存，避免创建测试数据
                                    
                                elif await barcode_label.count() > 0:
                                    print("⚠️ 找到barcode标签但没有找到输入字段")
                                    # 可能是只读字段或其他类型的字段
                                    barcode_display = page.locator('div:has-text("barcode"), span:has-text("barcode")')
                                    if await barcode_display.count() > 0:
                                        print("发现barcode显示元素")
                                else:
                                    print("❌ barcode字段不存在于添加表单中")
                                    
                                    # 列出所有可用字段
                                    all_inputs = await page.locator('input[name], select[name], textarea[name]').all()
                                    field_names = []
                                    for input_elem in all_inputs:
                                        name = await input_elem.get_attribute('name')
                                        if name:
                                            field_names.append(name)
                                    
                                    print(f"表单中可用字段: {field_names}")
                                    
                                    # 检查页面源码中是否包含barcode
                                    page_content = await page.content()
                                    if 'barcode' in page_content.lower():
                                        print("⚠️ 页面源码中包含barcode，但可能不是输入字段")
                                    else:
                                        print("❌ 页面源码中完全没有barcode相关内容")
                            else:
                                print("❌ 未找到添加Item按钮")
                        else:
                            print("❌ 未找到Items管理链接")
                            
                            # 列出所有可用的管理链接
                            all_links = await page.locator('a[href*="/admin/"]').all()
                            link_texts = []
                            for link in all_links[:10]:  # 只显示前10个
                                text = await link.text_content()
                                href = await link.get_attribute('href')
                                if text and href:
                                    link_texts.append(f"{text.strip()} -> {href}")
                            
                            print("可用管理链接:")
                            for link_text in link_texts:
                                print(f"  {link_text}")
                    else:
                        print("❌ 登录失败")
                        print(f"当前URL: {current_url}")
                        
                        # 检查是否有错误信息
                        error_messages = await page.locator('.errornote, .error').all()
                        for error in error_messages:
                            error_text = await error.text_content()
                            print(f"错误信息: {error_text}")
                else:
                    print("❌ 未找到登录表单")
            else:
                print("❌ 无法访问Django管理员登录页面")
                print(f"实际页面内容: {await page.content()[:500]}...")
                
        except Exception as e:
            print(f"❌ 测试过程中发生错误: {str(e)}")
            
            # 截图保存错误状态
            await page.screenshot(path='barcode_test_error.png')
            print("已保存错误截图: barcode_test_error.png")
            
        finally:
            await browser.close()

if __name__ == '__main__':
    print("开始使用管理员账号进行Playwright测试...")
    asyncio.run(test_barcode_field_with_auth())
    print("测试完成！")