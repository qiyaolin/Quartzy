import pandas as pd
import numpy as np

def detailed_analysis():
    """详细分析Excel文件的实际数据结构"""
    
    print("=== 详细Excel文件结构分析 ===\n")
    
    # 读取Excel文件，跳过可能的标题行
    df_raw = pd.read_excel("requests-export-2025-07-29.xlsx")
    
    print("原始文件结构:")
    print(f"总行数: {len(df_raw)}")
    print(f"总列数: {len(df_raw.columns)}")
    print("\n前10行内容:")
    for i in range(min(10, len(df_raw))):
        print(f"第{i+1}行: {df_raw.iloc[i].tolist()}")
    
    # 尝试找到实际的数据表头
    print("\n=== 寻找实际数据表头 ===")
    header_row = None
    for i in range(len(df_raw)):
        row_values = df_raw.iloc[i].dropna().tolist()
        if len(row_values) > 5:  # 假设表头至少有5列
            # 检查是否包含常见的字段名
            row_str = ' '.join([str(v).lower() for v in row_values])
            if any(keyword in row_str for keyword in ['request', 'item', 'name', 'price', 'quantity', 'status']):
                header_row = i
                print(f"找到可能的表头在第{i+1}行: {row_values}")
                break
    
    if header_row is not None:
        # 重新读取，使用找到的表头行
        df_data = pd.read_excel("requests-export-2025-07-29.xlsx", header=header_row)
        print(f"\n使用第{header_row+1}行作为表头重新解析:")
        print(f"列名: {list(df_data.columns)}")
        print(f"数据行数: {len(df_data)}")
        
        # 显示实际数据
        print("\n前5行实际数据:")
        print(df_data.head().to_string())
        
        # 分析字段映射
        print("\n=== 字段映射分析 ===")
        columns = [str(col).lower().strip() for col in df_data.columns]
        
        # Request模型必填字段映射
        field_mapping = {
            'item_name': ['item', 'name', 'item_name', 'product', 'material'],
            'requested_by': ['requested_by', 'requester', 'user', 'requested by', '申请人'],
            'unit_price': ['price', 'unit_price', 'cost', 'unit price', '单价', '价格'],
            'quantity': ['quantity', 'qty', 'amount', '数量'],
            'status': ['status', 'state', '状态'],
            'vendor': ['vendor', 'supplier', 'company', '供应商'],
            'catalog_number': ['catalog', 'catalog_number', 'part_number', '目录号'],
            'url': ['url', 'link', 'website'],
            'unit_size': ['unit_size', 'size', 'package', '规格'],
            'notes': ['notes', 'comment', 'remark', '备注', '说明']
        }
        
        found_mappings = {}
        for field, keywords in field_mapping.items():
            for col in columns:
                if any(keyword in col for keyword in keywords):
                    found_mappings[field] = col
                    break
        
        print("找到的字段映射:")
        for field, col in found_mappings.items():
            print(f"  {field} -> {col}")
        
        print("\n缺失的必填字段:")
        required_fields = ['item_name', 'requested_by', 'unit_price']
        for field in required_fields:
            if field not in found_mappings:
                print(f"  ✗ {field}")
        
        # 数据质量检查
        print("\n=== 数据质量检查 ===")
        if found_mappings:
            for field, col_name in found_mappings.items():
                if col_name in df_data.columns:
                    series = df_data[col_name]
                    null_count = series.isnull().sum()
                    total_count = len(series)
                    print(f"{field} ({col_name}): {total_count - null_count}/{total_count} 有效值")
                    
                    # 显示一些示例值
                    valid_values = series.dropna().head(3).tolist()
                    if valid_values:
                        print(f"  示例值: {valid_values}")
    
    else:
        print("未找到明确的数据表头，文件可能是报告格式而非数据表格式")
        
        # 尝试查找包含实际数据的区域
        print("\n=== 搜索数据区域 ===")
        for i in range(len(df_raw)):
            row = df_raw.iloc[i]
            non_null_count = row.count()
            if non_null_count >= 3:  # 至少3个非空值
                print(f"第{i+1}行有{non_null_count}个非空值: {row.dropna().tolist()}")

if __name__ == "__main__":
    detailed_analysis()