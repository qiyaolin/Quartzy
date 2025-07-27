#!/usr/bin/env python
"""
简单的barcode字段测试脚本
"""
import requests
import json

def test_production_api():
    """测试生产环境API"""
    base_url = "https://lab-inventory-467021.nn.r.appspot.com"
    
    print("测试生产环境API...")
    
    # 1. 健康检查
    try:
        health_response = requests.get(f"{base_url}/health/", timeout=30)
        print(f"✅ 健康检查: {health_response.status_code}")
    except Exception as e:
        print(f"❌ 健康检查失败: {e}")
    
    # 2. 管理员页面
    try:
        admin_response = requests.get(f"{base_url}/admin/", timeout=30)
        print(f"✅ 管理员页面: {admin_response.status_code}")
        
        if admin_response.status_code == 200:
            # 检查页面内容是否包含Items链接
            if "items" in admin_response.text.lower():
                print("✅ 管理员页面包含items链接")
            else:
                print("⚠️ 管理员页面可能不包含items链接")
                
    except Exception as e:
        print(f"❌ 管理员页面测试失败: {e}")
    
    # 3. 尝试访问Items API
    try:
        items_response = requests.get(f"{base_url}/api/items/", timeout=30)
        print(f"Items API状态: {items_response.status_code}")
        
        if items_response.status_code == 200:
            data = items_response.json()
            print(f"✅ API返回数据，项目数量: {len(data.get('results', []))}")
            
            if data.get('results'):
                first_item = data['results'][0]
                if 'barcode' in first_item:
                    print(f"✅ API包含barcode字段: {first_item.get('barcode')}")
                else:
                    print("❌ API不包含barcode字段")
                    print(f"可用字段: {list(first_item.keys())}")
        elif items_response.status_code == 401:
            print("⚠️ API需要认证")
        elif items_response.status_code == 404:
            print("❌ API端点不存在")
        else:
            print(f"❌ API异常状态: {items_response.status_code}")
            
    except Exception as e:
        print(f"❌ Items API测试失败: {e}")

def test_admin_items_page():
    """测试管理员Items页面"""
    print("\n测试管理员Items页面...")
    
    base_url = "https://lab-inventory-467021.nn.r.appspot.com"
    
    try:
        # 直接访问Items管理页面
        items_admin_url = f"{base_url}/admin/items/item/"
        response = requests.get(items_admin_url, timeout=30)
        
        print(f"Items管理页面状态: {response.status_code}")
        
        if response.status_code == 200:
            # 检查页面是否包含barcode相关内容
            content = response.text.lower()
            if "barcode" in content:
                print("✅ Items管理页面包含barcode字段")
            else:
                print("❌ Items管理页面不包含barcode字段")
                
            # 检查是否有添加按钮
            if "add item" in content or "添加" in content:
                print("✅ 找到添加Item按钮")
            else:
                print("⚠️ 未找到添加Item按钮")
                
        elif response.status_code == 302:
            print("⚠️ 需要登录才能访问Items管理页面")
        else:
            print(f"❌ Items管理页面异常: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Items管理页面测试失败: {e}")

if __name__ == '__main__':
    print("开始简单的barcode字段测试...")
    print("=" * 50)
    
    test_production_api()
    test_admin_items_page()
    
    print("=" * 50)
    print("测试完成！")
    
    print("\n建议的下一步:")
    print("1. 确认Google App Engine部署完成")
    print("2. 在Google Cloud Console中手动执行数据库迁移")
    print("3. 重新运行此测试验证结果")