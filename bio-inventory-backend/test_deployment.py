#!/usr/bin/env python3
"""
部署后验证脚本
测试 App Engine 部署的各个端点是否正常工作
"""

import requests
import json
import sys

BASE_URL = "https://lab-inventory-467021.nn.r.appspot.com"

def test_endpoint(url, description, expected_status=200):
    """测试单个端点"""
    print(f"测试 {description}...")
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == expected_status:
            print(f"✅ {description} - 状态码: {response.status_code}")
            return True
        else:
            print(f"❌ {description} - 状态码: {response.status_code}")
            print(f"   响应内容: {response.text[:200]}...")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ {description} - 请求失败: {str(e)}")
        return False

def test_admin_login():
    """测试管理员登录"""
    print("测试管理员登录...")
    login_url = f"{BASE_URL}/admin/login/"
    try:
        response = requests.get(login_url, timeout=30)
        if response.status_code == 200 and "Django administration" in response.text:
            print("✅ 管理员登录页面可访问")
            return True
        else:
            print(f"❌ 管理员登录页面异常 - 状态码: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ 管理员登录页面请求失败: {str(e)}")
        return False

def main():
    """主测试函数"""
    print("开始验证 App Engine 部署...")
    print("=" * 50)
    
    tests = [
        (f"{BASE_URL}/health/", "健康检查端点"),
        (f"{BASE_URL}/ready/", "就绪检查端点"),
        (f"{BASE_URL}/admin/", "管理员页面"),
    ]
    
    results = []
    
    # 测试基本端点
    for url, description in tests:
        results.append(test_endpoint(url, description))
    
    # 测试管理员登录
    results.append(test_admin_login())
    
    print("=" * 50)
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"🎉 所有测试通过! ({passed}/{total})")
        sys.exit(0)
    else:
        print(f"⚠️  部分测试失败: {passed}/{total} 通过")
        sys.exit(1)

if __name__ == "__main__":
    main()