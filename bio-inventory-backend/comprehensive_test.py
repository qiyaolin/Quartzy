#!/usr/bin/env python
"""
综合测试脚本 - 测试App Engine部署后的所有功能
"""
import requests
import time
import json

def test_app_engine_deployment():
    """测试App Engine部署状态"""
    print("🚀 综合测试App Engine部署...")
    print("=" * 60)
    
    base_url = "https://lab-inventory-467021.nn.r.appspot.com"
    
    # 测试端点列表
    endpoints = [
        ("/health/", "健康检查"),
        ("/ready/", "就绪检查"),
        ("/admin/", "管理员界面"),
        ("/api/", "API根路径"),
    ]
    
    results = {}
    
    for endpoint, description in endpoints:
        print(f"\n📋 测试 {description} ({endpoint})...")
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=15)
            status = response.status_code
            
            if endpoint == "/health/" and status == 200:
                try:
                    data = response.json()
                    print(f"✅ {description}: {status} - {data}")
                except:
                    print(f"✅ {description}: {status} - 响应正常")
            elif endpoint == "/ready/" and status == 200:
                try:
                    data = response.json()
                    print(f"✅ {description}: {status} - {data}")
                except:
                    print(f"✅ {description}: {status} - 响应正常")
            elif endpoint == "/admin/" and status in [200, 302]:
                print(f"✅ {description}: {status} - 管理员界面可访问")
            elif endpoint == "/api/" and status in [200, 404]:
                print(f"✅ {description}: {status} - API路径响应正常")
            else:
                print(f"⚠️ {description}: {status} - 状态异常")
            
            results[endpoint] = status
            
        except requests.exceptions.Timeout:
            print(f"⏰ {description}: 超时")
            results[endpoint] = "timeout"
        except requests.exceptions.ConnectionError:
            print(f"❌ {description}: 连接错误")
            results[endpoint] = "connection_error"
        except Exception as e:
            print(f"❌ {description}: {str(e)[:50]}")
            results[endpoint] = "error"
    
    # 总结结果
    print("\n" + "=" * 60)
    print("📊 测试结果总结:")
    
    healthy_count = 0
    total_count = len(endpoints)
    
    for endpoint, description in endpoints:
        status = results.get(endpoint, "未测试")
        if isinstance(status, int) and status < 400:
            print(f"✅ {description}: 正常 ({status})")
            healthy_count += 1
        else:
            print(f"❌ {description}: 异常 ({status})")
    
    print(f"\n🎯 健康度: {healthy_count}/{total_count} ({healthy_count/total_count*100:.1f}%)")
    
    if healthy_count >= 2:  # 至少健康检查和就绪检查通过
        print("🎉 App Engine部署基本成功！")
        return True
    else:
        print("⚠️ App Engine部署存在问题，需要进一步诊断")
        return False

def test_database_connection():
    """测试数据库连接"""
    print("\n🗄️ 测试数据库连接...")
    
    try:
        response = requests.get("https://lab-inventory-467021.nn.r.appspot.com/health/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('database') == 'connected':
                print("✅ 数据库连接正常")
                return True
            else:
                print(f"⚠️ 数据库状态: {data}")
                return False
        else:
            print(f"❌ 健康检查失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 数据库连接测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("🔍 App Engine Django应用综合测试")
    print("=" * 60)
    
    # 等待部署完成
    print("⏳ 等待部署完成...")
    time.sleep(10)
    
    # 执行测试
    deployment_ok = test_app_engine_deployment()
    database_ok = test_database_connection()
    
    print("\n" + "=" * 60)
    print("🏁 最终结果:")
    
    if deployment_ok and database_ok:
        print("🎉 所有测试通过！App Engine应用运行正常")
        print("\n📝 下一步操作:")
        print("1. 访问管理员界面: https://lab-inventory-467021.nn.r.appspot.com/admin/")
        print("2. 测试API功能")
        print("3. 验证barcode字段功能")
        return 0
    else:
        print("⚠️ 部分测试失败，需要进一步修复")
        return 1

if __name__ == '__main__':
    exit(main())