#!/usr/bin/env python
"""
快速检查部署状态和barcode字段
"""
import requests
import time

def check_deployment_status():
    """检查部署状态"""
    print("🔍 检查App Engine部署状态...")
    
    base_url = "https://lab-inventory-467021.nn.r.appspot.com"
    
    # 等待部署完成
    for i in range(6):  # 最多等待3分钟
        try:
            print(f"尝试 {i+1}/6...")
            
            # 检查健康状态
            health_response = requests.get(f"{base_url}/health/", timeout=10)
            admin_response = requests.get(f"{base_url}/admin/", timeout=10)
            
            if health_response.status_code == 200 and admin_response.status_code == 200:
                print("✅ App Engine部署成功，服务正常运行")
                return True
            else:
                print(f"⏳ 服务还在启动中... (健康检查: {health_response.status_code}, 管理页面: {admin_response.status_code})")
                
        except Exception as e:
            print(f"⏳ 连接中... ({str(e)[:50]})")
        
        if i < 5:  # 不是最后一次尝试
            time.sleep(30)  # 等待30秒
    
    print("⚠️ 部署可能还在进行中，请稍后手动检查")
    return False

if __name__ == '__main__':
    print("🚀 快速检查部署状态...")
    print("="*50)
    
    if check_deployment_status():
        print("\n📝 下一步:")
        print("1. 运行 python final_barcode_verification.py 验证barcode字段")
        print("2. 访问 https://lab-inventory-467021.nn.r.appspot.com/admin/items/item/add/")
        print("3. 确认Item添加表单中包含Barcode字段")
    else:
        print("\n⏳ 请等待部署完成后再次检查")