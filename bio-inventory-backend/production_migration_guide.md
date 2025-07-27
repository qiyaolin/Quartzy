# 生产环境Barcode字段迁移指南

## 问题描述
Item模型中的barcode字段在本地环境已正确创建，但生产环境(Google App Engine)中未应用相关迁移。

## 解决步骤

### 1. 确认当前状态
- ✅ 本地数据库：barcode字段已存在
- ✅ 迁移文件：0006_item_barcode.py已创建
- ✅ 应用部署：已部署到App Engine
- ❌ 生产数据库：barcode字段不存在

### 2. 手动执行生产环境迁移

#### 方法1：使用Google Cloud Console
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择项目：`lab-inventory-467021`
3. 进入 App Engine > 版本
4. 点击当前版本的"工具"按钮
5. 选择"在Cloud Shell中打开"

#### 方法2：使用Cloud Shell直接连接
1. 访问 [Cloud Shell](https://shell.cloud.google.com/)
2. 执行以下命令：

```bash
# 设置项目
gcloud config set project lab-inventory-467021

# 克隆代码库（如果需要）
# git clone YOUR_REPOSITORY_URL
# cd YOUR_PROJECT_DIRECTORY

# 安装依赖
pip install -r requirements.txt

# 设置环境变量
export DJANGO_SETTINGS_MODULE=core.settings

# 执行迁移
python manage.py migrate items --verbosity=2

# 验证迁移结果
python manage.py showmigrations items
```

### 3. 验证修复结果

执行以下Python脚本验证：

```python
# 运行验证脚本
python simple_barcode_test.py
```

预期结果：
- ✅ Items管理页面包含barcode字段
- ✅ API返回包含barcode字段

### 4. 如果Cloud Shell方法不可行

#### 使用Cloud SQL Proxy（推荐）
1. 在本地安装Cloud SQL Proxy
2. 连接到生产数据库
3. 直接执行迁移

```bash
# 下载Cloud SQL Proxy
curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud_sql_proxy

# 连接到生产数据库
./cloud_sql_proxy -instances=lab-inventory-467021:REGION:INSTANCE_NAME=tcp:5432

# 在另一个终端中执行迁移
DATABASES_DEFAULT_URL=postgresql://user:password@localhost:5432/dbname python manage.py migrate items
```

### 5. 紧急修复脚本

如果以上方法都不可行，可以创建一个临时的数据库修复端点：

```python
# 在views.py中添加临时修复端点
from django.http import JsonResponse
from django.db import connection

def emergency_add_barcode_field(request):
    if not request.user.is_superuser:
        return JsonResponse({'error': 'Unauthorized'}, status=403)
    
    with connection.cursor() as cursor:
        try:
            # 检查字段是否存在
            cursor.execute("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name='items_item' AND column_name='barcode'
            """)
            
            if not cursor.fetchone():
                # 添加barcode字段
                cursor.execute("""
                    ALTER TABLE items_item 
                    ADD COLUMN barcode VARCHAR(50) NULL UNIQUE
                """)
                return JsonResponse({'success': 'Barcode field added'})
            else:
                return JsonResponse({'info': 'Barcode field already exists'})
                
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
```

## 验证清单

- [ ] 生产环境健康检查通过
- [ ] Items管理页面可访问
- [ ] Items管理页面包含barcode字段
- [ ] 可以成功创建带barcode的Item
- [ ] API返回包含barcode字段
- [ ] Playwright测试通过

## 常见问题

### Q: 为什么本地有字段但生产环境没有？
A: App Engine部署时只部署代码，不会自动执行数据库迁移。

### Q: 如何避免类似问题？
A: 在部署流程中添加自动迁移步骤，或使用CI/CD管道。

### Q: 数据会丢失吗？
A: 不会，添加新字段是安全操作，不会影响现有数据。