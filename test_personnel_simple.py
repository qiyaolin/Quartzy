import os
import sys
import django

# 设置Django环境
sys.path.append('bio-inventory-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from funding.models import Fund, PersonnelExpense
from rest_framework.authtoken.models import Token
import requests
import json

def test_personnel_expense_direct():
    """
    直接测试Personnel Expense功能
    """
    print("🧪 开始直接测试Personnel Expense功能...")
    
    # 1. 创建或获取测试用户
    print("1️⃣ 创建测试用户和Token...")
    try:
        user, created = User.objects.get_or_create(
            username='testuser',
            defaults={
                'email': 'test@example.com',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            user.set_password('testpass123')
            user.save()
            print(f"✅ 创建新用户: {user.username}")
        else:
            print(f"ℹ️ 使用现有用户: {user.username}")
        
        # 创建或获取Token
        token, created = Token.objects.get_or_create(user=user)
        print(f"✅ Token: {token.key[:20]}...")
        
    except Exception as e:
        print(f"❌ 创建用户失败: {e}")
        return
    
    # 2. 创建测试Fund
    print("2️⃣ 创建测试Fund...")
    try:
        fund, created = Fund.objects.get_or_create(
            name="测试基金",
            defaults={
                'description': "用于测试Personnel Expense的基金",
                'total_budget': 100000.00,
                'funding_source': "测试来源",
                'principal_investigator': "测试PI",
                'created_by': user
            }
        )
        if created:
            print(f"✅ 创建新Fund: {fund.name} (ID: {fund.id})")
        else:
            print(f"ℹ️ 使用现有Fund: {fund.name} (ID: {fund.id})")
    except Exception as e:
        print(f"❌ 创建Fund失败: {e}")
        return
    
    # 3. 测试API端点
    print("3️⃣ 测试Personnel Expense API...")
    base_url = "http://127.0.0.1:8000"
    headers = {
        'Authorization': f'Token {token.key}',
        'Content-Type': 'application/json'
    }
    
    # 测试GET请求
    try:
        get_response = requests.get(f"{base_url}/api/personnel-expenses/", headers=headers)
        print(f"GET响应状态: {get_response.status_code}")
        if get_response.status_code == 200:
            data = get_response.json()
            print(f"✅ 成功获取Personnel Expenses列表，数量: {len(data.get('results', data))}")
        else:
            print(f"❌ GET请求失败: {get_response.text}")
    except Exception as e:
        print(f"❌ GET请求出错: {e}")
    
    # 测试POST请求
    print("4️⃣ 测试创建Personnel Expense...")
    test_data = {
        "fund_id": fund.id,
        "employee_name": "张三",
        "expense_type": "salary",
        "amount": "8000.00",
        "expense_date": "2024-01-15",
        "description": "2024年1月薪资",
        "reference_number": "SAL-2024-001"
    }
    
    print(f"发送数据: {json.dumps(test_data, indent=2, ensure_ascii=False)}")
    
    try:
        post_response = requests.post(
            f"{base_url}/api/personnel-expenses/",
            headers=headers,
            json=test_data
        )
        
        print(f"POST响应状态: {post_response.status_code}")
        print(f"POST响应内容: {post_response.text}")
        
        if post_response.status_code == 201:
            print("✅ 成功创建Personnel Expense")
            created_data = post_response.json()
            print(f"创建的ID: {created_data.get('id')}")
            
            # 验证数据库中的记录
            try:
                expense = PersonnelExpense.objects.get(id=created_data.get('id'))
                print(f"✅ 数据库验证成功:")
                print(f"   员工姓名: {expense.employee_name}")
                print(f"   金额: {expense.amount}")
                print(f"   类型: {expense.expense_type}")
                print(f"   基金: {expense.fund.name}")
            except PersonnelExpense.DoesNotExist:
                print("❌ 数据库中未找到创建的记录")
                
        elif post_response.status_code == 400:
            print("❌ 数据验证失败")
            try:
                error_data = post_response.json()
                print("验证错误详情:")
                for field, errors in error_data.items():
                    print(f"  {field}: {errors}")
            except:
                print("无法解析错误响应")
        else:
            print(f"❌ 创建失败，状态码: {post_response.status_code}")
            
    except Exception as e:
        print(f"❌ POST请求出错: {e}")
    
    # 5. 验证最终结果
    print("5️⃣ 最终验证...")
    try:
        final_count = PersonnelExpense.objects.count()
        print(f"✅ 数据库中Personnel Expense总数: {final_count}")
        
        if final_count > 0:
            latest = PersonnelExpense.objects.latest('created_at')
            print(f"最新记录: {latest.employee_name} - {latest.amount}")
    except Exception as e:
        print(f"❌ 最终验证出错: {e}")

if __name__ == "__main__":
    test_personnel_expense_direct()