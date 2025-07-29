import pandas as pd
import requests
import json
from datetime import datetime

def fix_excel_for_import():
    """修复Excel文件使其符合导入要求"""
    
    print("🔧 开始修复Excel文件...")
    
    # 读取原始文件，跳过摘要部分
    df = pd.read_excel("requests-export-2025-07-29.xlsx", header=12)
    
    # 设置正确的列名
    df.columns = [
        'Request ID', 'Item Name', 'Catalog Number', 'Quantity', 
        'Unit Size', 'Unit Price', 'Total Cost', 'Vendor', 
        'Requested By', 'Status', 'Request Date', 'URL', 
        'Barcode', 'Fund', 'Notes'
    ]
    
    # 移除空行
    df = df.dropna(subset=['Item Name'])
    
    print(f"✓ 读取到 {len(df)} 条有效记录")
    
    # 数据清理和转换
    print("🧹 清理数据...")
    
    # 1. 清理Unit Price字段
    df['Unit Price'] = df['Unit Price'].astype(str).str.replace('$', '').str.replace(',', '')
    df['Unit Price'] = pd.to_numeric(df['Unit Price'], errors='coerce')
    
    # 2. 设置默认状态为NEW（导入时应该是新请求）
    df['Status'] = 'NEW'
    
    # 3. 转换日期格式
    df['Request Date'] = pd.to_datetime(df['Request Date'], errors='coerce')
    
    # 4. 清理数量字段
    df['Quantity'] = pd.to_numeric(df['Quantity'], errors='coerce').fillna(1)
    
    print("✓ 数据清理完成")
    
    # 创建符合Django模型的数据结构
    print("🔄 转换为Django模型格式...")
    
    fixed_data = []
    for _, row in df.iterrows():
        record = {
            'item_name': row['Item Name'],
            'catalog_number': row['Catalog Number'] if pd.notna(row['Catalog Number']) else '',
            'quantity': int(row['Quantity']) if pd.notna(row['Quantity']) else 1,
            'unit_size': row['Unit Size'] if pd.notna(row['Unit Size']) else '',
            'unit_price': float(row['Unit Price']) if pd.notna(row['Unit Price']) else 0.0,
            'vendor_name': row['Vendor'] if pd.notna(row['Vendor']) else '',  # 需要转换为vendor_id
            'requested_by_name': row['Requested By'] if pd.notna(row['Requested By']) else '',  # 需要转换为user_id
            'status': 'NEW',
            'url': row['URL'] if pd.notna(row['URL']) else '',
            'notes': row['Notes'] if pd.notna(row['Notes']) else '',
            'original_barcode': row['Barcode'] if pd.notna(row['Barcode']) else '',
            'fund_id': row['Fund'] if pd.notna(row['Fund']) else None
        }
        fixed_data.append(record)
    
    # 保存修复后的数据
    fixed_df = pd.DataFrame(fixed_data)
    
    # 保存为新的Excel文件
    output_file = "requests-import-fixed.xlsx"
    fixed_df.to_excel(output_file, index=False)
    print(f"✓ 修复后的文件已保存为: {output_file}")
    
    # 显示修复后的数据预览
    print("\n📋 修复后的数据预览:")
    print(fixed_df.head().to_string())
    
    print(f"\n📊 修复统计:")
    print(f"   • 总记录数: {len(fixed_df)}")
    print(f"   • 有效item_name: {fixed_df['item_name'].notna().sum()}")
    print(f"   • 有效unit_price: {fixed_df['unit_price'].notna().sum()}")
    print(f"   • 有效requested_by_name: {fixed_df['requested_by_name'].notna().sum()}")
    
    # 检查需要解决的外键问题
    print(f"\n⚠️  需要手动解决的问题:")
    unique_users = fixed_df['requested_by_name'].dropna().unique()
    unique_vendors = fixed_df['vendor_name'].dropna().unique()
    
    print(f"   • 需要转换的用户名 ({len(unique_users)}个):")
    for user in unique_users:
        print(f"     - {user}")
    
    print(f"   • 需要转换的供应商名 ({len(unique_vendors)}个):")
    for vendor in unique_vendors:
        print(f"     - {vendor}")
    
    print(f"\n💡 下一步操作:")
    print(f"   1. 在Django admin中查找对应的User ID和Vendor ID")
    print(f"   2. 手动替换requested_by_name和vendor_name为对应的ID")
    print(f"   3. 或者创建API接口自动转换这些名称为ID")
    print(f"   4. 重新导入修复后的文件")
    
    return output_file

if __name__ == "__main__":
    fix_excel_for_import()