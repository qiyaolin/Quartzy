#!/bin/bash

# Firebase 部署脚本
# 使用方法: ./deploy.sh [环境]
# 环境选项: staging, production (默认: production)

set -e

ENVIRONMENT=${1:-production}

echo "🚀 开始部署到 Firebase Hosting ($ENVIRONMENT)..."

# 检查是否已登录 Firebase
if ! firebase projects:list >/dev/null 2>&1; then
    echo "❌ 请先登录 Firebase CLI: npm run firebase:login"
    exit 1
fi

# 构建项目
echo "📦 构建 React 应用..."
if [ "$ENVIRONMENT" = "production" ]; then
    npm run build
else
    REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL_STAGING} npm run build
fi

# 检查构建是否成功
if [ ! -d "build" ]; then
    echo "❌ 构建失败，build 目录不存在"
    exit 1
fi

# 部署到 Firebase
echo "🔥 部署到 Firebase Hosting..."
if [ "$ENVIRONMENT" = "staging" ]; then
    firebase hosting:channel:deploy staging --expires 30d
else
    firebase deploy --only hosting
fi

echo "✅ 部署完成！"
echo "🌐 访问你的应用: https://your-project-id.web.app"