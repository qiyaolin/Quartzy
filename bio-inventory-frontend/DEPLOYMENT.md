# Firebase 部署指南

这个文档说明如何将 Bio Inventory Frontend 部署到 Firebase Hosting。

## 前提条件

1. **Firebase CLI**: 确保已安装 Firebase CLI
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase 项目**: 需要一个已创建的 Firebase 项目

3. **项目配置**: 已完成 Firebase 项目初始化

## 部署步骤

### 1. 首次设置

1. **登录 Firebase**:
   ```bash
   npm run firebase:login
   ```

2. **更新项目ID**: 编辑 `.firebaserc` 文件，将 `your-firebase-project-id` 替换为实际的项目ID
   ```json
   {
     "projects": {
       "default": "your-actual-project-id"
     }
   }
   ```

3. **配置环境变量** (可选):
   - 复制 `.env.example` 为 `.env.production`
   - 填入生产环境的 API URL

### 2. 部署到生产环境

```bash
# 方法1: 使用 npm 脚本
npm run deploy

# 方法2: 使用部署脚本 (Linux/Mac)
./deploy.sh production

# 方法3: 手动部署
npm run build
firebase deploy --only hosting
```

### 3. 部署到预览环境

```bash
# 创建预览频道
npm run deploy:preview

# 或指定频道名称
firebase hosting:channel:deploy staging --expires 30d
```

## 配置说明

### firebase.json

主要配置项：
- `public: "build"`: 指定部署目录
- `rewrites`: 配置 SPA 路由重写
- `headers`: 设置缓存策略
- `cleanUrls`: 移除 URL 中的 .html 后缀

### 缓存策略

- **静态资源** (JS/CSS/图片): 1年缓存（文件名带内容哈希）
- **/index.html**: `no-cache, no-store, must-revalidate`（确保发布后立刻取最新入口）
- **其他 HTML/JSON**: `max-age=0, s-maxage=0`（每次到源站校验）

## 常用命令

```bash
# 登录
npm run firebase:login

# 查看项目列表
firebase projects:list

# 查看当前项目
firebase use

# 切换项目
firebase use your-project-id

# 查看托管站点
firebase hosting:sites:list

# 查看部署历史
firebase hosting:clone

# 回滚部署
firebase hosting:clone source-site-id target-site-id
```

## 环境变量

在 Firebase Hosting 中，环境变量需要在构建时注入：

1. 创建 `.env.production` 文件
2. 添加以 `REACT_APP_` 开头的变量
3. 在构建时自动读取

示例：
```bash
REACT_APP_API_BASE_URL=https://your-api.com
GENERATE_SOURCEMAP=false
```

## 故障排除

### 1. 构建失败
```bash
# 清理缓存重新构建
rm -rf build node_modules package-lock.json
npm install
npm run build
```

### 2. 部署失败
```bash
# 检查 Firebase CLI 版本
firebase --version

# 重新登录
firebase logout
firebase login

# 检查项目权限
firebase projects:list
```

### 3. 路由问题
确保 `firebase.json` 中配置了正确的 rewrites 规则。

### 4. 缓存问题
- 清理浏览器缓存
- 或者修改 `firebase.json` 中的缓存策略

## 自动化部署

可以配置 GitHub Actions 或其他 CI/CD 工具实现自动化部署：

```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: your-project-id
```

## 监控和分析

部署后，可以在 Firebase Console 中查看：
- 流量统计
- 性能指标
- 错误日志
- 用户分析

## 安全注意事项

1. **不要提交敏感信息**: `.env` 文件包含在 `.gitignore` 中
2. **使用 HTTPS**: Firebase Hosting 默认强制 HTTPS
3. **设置适当的缓存策略**: 避免缓存敏感内容
4. **定期更新依赖**: 保持安全性