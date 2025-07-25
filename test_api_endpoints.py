import requests
import json
import os
import sys
import django

# 设置Django环境
sys.path.append('bio-inventory-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def test_personnel_expense_api():
    """
    测试Personnel Expense API端点
    Sequential thinking approach to identify the root cause
    """
    
    base_url = "http://127.0.0.1:8000"
    
    print("🧪 开始测试Personnel Expense API端点...")
    
    # 1. 测试登录获取token
    print("1️⃣ 测试用户认证...")
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        # 尝试获取token
        auth_response = requests.post(f"{base_url}/api/login/", data=login_data)
        print(f"认证响应状态: {auth_response.status_code}")
        
        if auth_response.status_code == 200:
            token = auth_response.json().get('token')
            print(f"✅ 获取到token: {token[:20]}...")
        else:
            print(f"❌ 认证失败: {auth_response.text}")
            # 尝试创建用户
            print("尝试创建测试用户...")
            from django.contrib.auth.models import User
            try:
                user, created = User.objects.get_or_create(
                    username='admin',
                    defaults={'is_staff': True, 'is_superuser': True}
                )
                if created:
                    user.set_password('admin123')
                    user.save()
                    print("✅ 创建测试用户成功")
                else:
                    print("ℹ️ 用户已存在")
                    
                # 重新尝试认证
                auth_response = requests.post(f"{base_url}/api/login/", data=login_data)
                if auth_response.status_code == 200:
                    token = auth_response.json().get('token')
                    print(f"✅ 重新获取到token: {token[:20]}...")
                else:
                    print(f"❌ 重新认证仍然失败: {auth_response.text}")
                    return
            except Exception as e:
                print(f"❌ 创建用户失败: {e}")
                return
            
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请确保Django服务器正在运行")
        return
    except Exception as e:
        print(f"❌ 认证过程出错: {e}")
        return
    
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }
    
    # 2. 测试获取funds列表
    print("2️⃣ 测试获取funds列表...")
    try:
        funds_response = requests.get(f"{base_url}/api/funds/", headers=headers)
        print(f"Funds API响应状态: {funds_response.status_code}")
        
        if funds_response.status_code == 200:
            funds_data = funds_response.json()
            print(f"✅ 获取到 {len(funds_data.get('results', funds_data))} 个funds")
            funds = funds_data.get('results', funds_data)
            if funds:
                first_fund_id = funds[0]['id']
                print(f"使用第一个fund ID: {first_fund_id}")
            else:
                print("❌ 没有可用的funds，尝试创建测试fund...")
                # 创建测试fund
                from funding.models import Fund
                from django.contrib.auth.models import User
                user = User.objects.get(username='admin')
                test_fund = Fund.objects.create(
                    name="测试基金",
                    description="用于测试的基金",
                    total_budget=100000.00,
                    funding_source="测试来源",
                    principal_investigator="测试PI",
                    created_by=user
                )
                first_fund_id = test_fund.id
                print(f"✅ 创建测试fund，ID: {first_fund_id}")
        else:
            print(f"❌ 获取funds失败: {funds_response.text}")
            return
    except Exception as e:
        print(f"❌ 获取funds出错: {e}")
        return
    
    # 3. 测试获取personnel expenses列表
    print("3️⃣ 测试获取personnel expenses列表...")
    try:
        personnel_response = requests.get(f"{base_url}/api/personnel-expenses/", headers=headers)
        print(f"Personnel Expenses API响应状态: {personnel_response.status_code}")
        
        if personnel_response.status_code == 200:
            personnel_data = personnel_response.json()
            print(f"✅ 获取到 {len(personnel_data.get('results', personnel_data))} 个personnel expenses")
        else:
            print(f"❌ 获取personnel expenses失败: {personnel_response.text}")
            return
    except Exception as e:
        print(f"❌ 获取personnel expenses出错: {e}")
        return
    
    # 4. 测试创建personnel expense
    print("4️⃣ 测试创建personnel expense...")
    
    test_expense_data = {
        "fund_id": first_fund_id,
        "employee_name": "测试员工",
        "expense_type": "salary",
        "amount": "5000.00",
        "expense_date": "2024-01-15",
        "description": "测试薪资支出",
        "reference_number": "TEST-001"
    }
    
    print(f"发送数据: {json.dumps(test_expense_data, indent=2)}")
    
    try:
        create_response = requests.post(
            f"{base_url}/api/personnel-expenses/",
            headers=headers,
            json=test_expense_data
        )
        
        print(f"创建Personnel Expense响应状态: {create_response.status_code}")
        print(f"响应内容: {create_response.text}")
        
        if create_response.status_code == 201:
            print("✅ 成功创建personnel expense")
            created_expense = create_response.json()
            print(f"创建的expense ID: {created_expense.get('id')}")
        elif create_response.status_code == 400:
            print("❌ 请求数据验证失败")
            try:
                error_data = create_response.json()
                print("验证错误详情:")
                for field, errors in error_data.items():
                    print(f"  {field}: {errors}")
            except:
                print(f"无法解析错误响应: {create_response.text}")
        else:
            print(f"❌ 创建失败，状态码: {create_response.status_code}")
            print(f"错误内容: {create_response.text}")
            
    except Exception as e:
        print(f"❌ 创建personnel expense出错: {e}")
    
    # 5. 再次获取personnel expenses列表验证
    print("5️⃣ 验证创建结果...")
    try:
        verify_response = requests.get(f"{base_url}/api/personnel-expenses/", headers=headers)
        if verify_response.status_code == 200:
            verify_data = verify_response.json()
            count = len(verify_data.get('results', verify_data))
            print(f"✅ 验证完成，现在有 {count} 个personnel expenses")
        else:
            print(f"❌ 验证失败: {verify_response.text}")
    except Exception as e:
        print(f"❌ 验证出错: {e}")

if __name__ == "__main__":
    test_personnel_expense_api()