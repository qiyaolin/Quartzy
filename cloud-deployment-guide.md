# 云端部署指南

## 📋 部署清单

### ✅ 已完成：
- [x] 本地代码已提交到Git仓库
- [x] 代码已推送到远程仓库 (GitHub)

### 🚀 需要在云端执行的步骤：

## 步骤一：后端部署（优先级：高）

### 1. 连接到云端服务器
```bash
# 使用SSH连接到您的云端服务器
ssh your-username@your-server-ip
```

### 2. 拉取最新代码
```bash
cd /path/to/your/project/Quartzy
git pull origin 0726_Successful_set_up_on_cloud
```

### 3. 应用数据库迁移（重要！）
```bash
cd bio-inventory-backend
python manage.py migrate

# 应该看到类似输出：
# Running migrations:
#   Applying items.0006_item_barcode... OK
#   Applying inventory_requests.0003_request_is_archived... OK
#   Applying inventory_requests.0004_remove_request_is_archived... OK
```

### 4. 重启后端服务
```bash
# 根据您的部署方式选择：

# 如果使用 systemd:
sudo systemctl restart your-django-service

# 如果使用 Docker:
docker-compose restart backend

# 如果使用 gunicorn:
sudo pkill -HUP gunicorn

# 如果使用开发服务器:
python manage.py runserver 0.0.0.0:8000
```

## 步骤二：前端部署

### 1. 安装新的依赖包
```bash
cd bio-inventory-frontend
npm install

# 新安装的包：
# - @zxing/library
# - @zxing/browser
```

### 2. 构建前端
```bash
npm run build
```

### 3. 部署静态文件
```bash
# 根据您的前端部署方式：

# 如果使用 nginx:
sudo cp -r build/* /var/www/html/
sudo systemctl reload nginx

# 如果使用其他静态文件服务器，请复制 build 目录内容到相应位置
```

## 🔍 验证部署

### 1. 检查后端API
```bash
# 测试新的条形码出库API
curl -X POST http://your-domain/api/items/checkout_by_barcode/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Token your-token" \
  -d '{"barcode": "test-barcode"}'
```

### 2. 检查前端功能
- [ ] 访问网站，确认界面正常加载
- [ ] 测试移动端响应式布局
- [ ] 测试条形码扫描功能（需要HTTPS）
- [ ] 测试侧边栏在移动端的显示和隐藏

### 3. 测试新功能
- [ ] "Scan for Checkout" 按钮正常工作
- [ ] 相机权限请求正常
- [ ] 条形码扫描后能正确识别物品
- [ ] 出库功能正常工作

## ⚠️ 重要注意事项

### 1. HTTPS要求
条形码扫描功能需要HTTPS才能访问相机，请确保：
- [ ] 网站已启用HTTPS
- [ ] SSL证书有效

### 2. 权限设置
确保用户有相应权限：
- [ ] 访问相机的浏览器权限
- [ ] 调用出库API的用户权限

### 3. 浏览器兼容性
条形码扫描支持的浏览器：
- [ ] Chrome (推荐)
- [ ] Firefox
- [ ] Safari (iOS 14.3+)
- [ ] Edge

## 🐛 故障排除

### 如果相机无法访问：
1. 检查网站是否使用HTTPS
2. 检查浏览器权限设置
3. 检查设备是否有可用的摄像头

### 如果出库API失败：
1. 检查数据库迁移是否成功应用
2. 检查Item模型是否有barcode字段
3. 检查API权限设置

### 如果移动端布局异常：
1. 清除浏览器缓存
2. 检查CSS文件是否正确加载
3. 检查Tailwind配置是否正确

## 📞 联系支持
如果遇到问题，请查看：
- `checkout-implementation-summary.md` - 详细实现说明
- `mobile-responsive-testing.md` - 移动端测试指南