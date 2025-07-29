import pandas as pd
import json
from datetime import datetime
import sys

def analyze_excel_file(file_path):
    """分析Excel文件的结构和数据问题"""
    
    print("=== Excel文件导入失败分析报告 ===\n")
    
    try:
        # 读取Excel文件
        df = pd.read_excel(file_path)
        print(f"✓ 成功读取Excel文件: {file_path}")
        print(f"✓ 文件包含 {len(df)} 行数据，{len(df.columns)} 列")
        print(f"✓ 列名: {list(df.columns)}\n")
        
        # 显示前几行数据
        print("=== 前5行数据预览 ===")
        print(df.head().to_string())
        print("\n")
        
        # 数据类型分析
        print("=== 数据类型分析 ===")
        print(df.dtypes.to_string())
        print("\n")
        
        # 检查空值
        print("=== 空值检查 ===")
        null_counts = df.isnull().sum()
        print(null_counts[null_counts > 0].to_string())
        print("\n")
        
        # 根据Request模型检查字段匹配
        required_fields = {
            'item_name': 'CharField(max_length=255) - 必填',
            'requested_by': 'ForeignKey(User) - 必填',
            'unit_price': 'DecimalField - 必填',
            'quantity': 'PositiveIntegerField - 默认1',
            'status': 'CharField - 默认NEW'
        }
        
        optional_fields = {
            'item_type': 'ForeignKey(ItemType) - 可选',
            'vendor': 'ForeignKey(Vendor) - 可选', 
            'catalog_number': 'CharField(max_length=100) - 可选',
            'url': 'URLField - 可选',
            'unit_size': 'CharField(max_length=100) - 可选',
            'fund_id': 'IntegerField - 可选',
            'barcode': 'CharField(max_length=50) - 自动生成',
            'notes': 'TextField - 可选'
        }
        
        print("=== 字段匹配分析 ===")
        excel_columns = [col.lower().replace(' ', '_') for col in df.columns]
        
        print("必填字段检查:")
        for field, description in required_fields.items():
            if field in excel_columns or any(field in col for col in excel_columns):
                print(f"✓ {field}: {description}")
            else:
                print(f"✗ 缺失必填字段: {field} - {description}")
        
        print("\n可选字段检查:")
        for field, description in optional_fields.items():
            if field in excel_columns or any(field in col for col in excel_columns):
                print(f"✓ {field}: {description}")
            else:
                print(f"- 未找到可选字段: {field}")
        
        print("\nExcel中的未识别列:")
        model_fields = list(required_fields.keys()) + list(optional_fields.keys())
        for col in df.columns:
            col_normalized = col.lower().replace(' ', '_')
            if not any(field in col_normalized for field in model_fields):
                print(f"? 未识别的列: {col}")
        
        # 数据验证
        print("\n=== 数据验证问题 ===")
        
        # 检查数值字段
        numeric_issues = []
        if 'unit_price' in df.columns:
            try:
                pd.to_numeric(df['unit_price'], errors='coerce')
                null_prices = df['unit_price'].isnull().sum()
                if null_prices > 0:
                    numeric_issues.append(f"unit_price字段有{null_prices}个无效数值")
            except:
                numeric_issues.append("unit_price字段格式错误")
        
        if 'quantity' in df.columns:
            try:
                quantities = pd.to_numeric(df['quantity'], errors='coerce')
                negative_qty = (quantities < 0).sum()
                if negative_qty > 0:
                    numeric_issues.append(f"quantity字段有{negative_qty}个负数值")
            except:
                numeric_issues.append("quantity字段格式错误")
        
        for issue in numeric_issues:
            print(f"✗ {issue}")
        
        # 检查外键字段
        fk_issues = []
        if 'requested_by' in df.columns:
            unique_users = df['requested_by'].nunique()
            print(f"- requested_by字段包含{unique_users}个不同用户")
        
        if 'vendor' in df.columns:
            unique_vendors = df['vendor'].nunique()
            print(f"- vendor字段包含{unique_vendors}个不同供应商")
        
        # 生成修复建议
        print("\n=== 修复建议 ===")
        suggestions = []
        
        if 'item_name' not in excel_columns:
            suggestions.append("1. 添加item_name列（必填字段）")
        
        if 'requested_by' not in excel_columns:
            suggestions.append("2. 添加requested_by列，需要是有效的用户ID或用户名")
        
        if 'unit_price' not in excel_columns:
            suggestions.append("3. 添加unit_price列，必须是有效的数字格式")
        
        if numeric_issues:
            suggestions.append("4. 修复数值字段的格式问题")
        
        suggestions.append("5. 确保所有外键字段引用的记录在数据库中存在")
        suggestions.append("6. 检查字符字段是否超过最大长度限制")
        
        for suggestion in suggestions:
            print(suggestion)
        
        return True
        
    except Exception as e:
        print(f"✗ 读取Excel文件失败: {str(e)}")
        return False

if __name__ == "__main__":
    file_path = "requests-export-2025-07-29.xlsx"
    analyze_excel_file(file_path)