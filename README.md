# 生物库存管理系统 - 生产版本

## 项目概述
这是一个完整的生物库存管理系统，包含前端React应用和后端Django API。

## 部署模式说明（重要）
当前仓库仅维护本地部署流程（`start_local_server.bat` / `deploy_local_frontend.bat`）。
历史云端部署脚本（Firebase/GAE）已归档，不再作为当前运行方式。

## 目录结构
```
Quartzy/
├── bio-inventory-backend/     # Django后端API
├── bio-inventory-frontend/    # React前端应用
└── dymo-print-server-nodejs/  # DYMO打印服务器
```

## 快速开始

### 后端部署
1. 进入后端目录：`cd bio-inventory-backend`
2. 安装依赖：`pip install -r requirements.txt`
3. 配置数据库连接
4. 运行迁移：`python manage.py migrate`
5. 启动服务器：`python manage.py runserver`

### 前端部署
1. 进入前端目录：`cd bio-inventory-frontend`
2. 安装依赖：`npm install`
3. 构建生产版本：`npm run build`
4. 部署构建文件到Web服务器

### 打印服务器
1. 进入打印服务器目录：`cd dymo-print-server-nodejs`
2. 安装依赖：`pip install requests`
3. 配置DYMO打印机（编辑 `src/print_agent_config.json`）
4. 启动服务：`python src/production_print_agent.py`

## 本地 PostgreSQL 一键启动（推荐）

### 1. 首次初始化 PostgreSQL（Windows 本机服务）
使用 `psql` 执行以下 SQL（可按需修改用户名、密码、库名）：

```sql
CREATE USER cellstorage_user WITH PASSWORD 'your_password';
CREATE DATABASE inventory_db OWNER cellstorage_user;
GRANT ALL PRIVILEGES ON DATABASE inventory_db TO cellstorage_user;
```

### 2. 配置本地环境变量
在仓库根目录复制模板并填写真实值：

```bash
copy .env.local.example .env.local
```

关键变量：
- `USE_POSTGRES=True`
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_NAME=inventory_db`
- `DB_USER=cellstorage_user`
- `DB_PASS=<your_password>`

### 3. 一键启动全栈
在仓库根目录执行：

```bash
start_local_server.bat
```

脚本会按顺序执行：
1. 启动 DYMO 打印代理
2. 后端依赖安装 -> PostgreSQL 连通性检查 -> `migrate` -> `runserver`
3. 构建并启动 React 前端生产静态服务（`serve -s build`）

如果数据库连接失败，脚本会直接停止后端启动并输出明确错误，不会继续迁移。

## 本地对外发布前端（Cloudflare Tunnel）

当 `inventory.hayerlab.org` 通过 Cloudflare Tunnel 指向本机 `localhost:3000` 时，建议使用生产静态包而不是 `npm start` 开发包，以避免移动端缓存旧 `bundle.js`。

在仓库根目录执行：

```bash
deploy_local_frontend.bat
```

该脚本会自动：
1. 执行 `npm run build`
2. 释放并重启 `3000` 端口前端进程
3. 以 `npx serve -s build` 启动静态服务
4. 校验本地 `http://localhost:3000` 可访问

## 云端部署代码归档说明

为避免误定位与误操作，原 Firebase/GAE 云端部署相关文件已归档到：

`archive/legacy-cloud-deploy/bio-inventory-frontend/`
`archive/legacy-cloud-deploy/bio-inventory-backend/`

包括：
- 前端：
- `.firebaserc`
- `firebase.json`
- `deploy.sh`
- `DEPLOYMENT.md`
- 后端：
- `check_api_status.py`
- `entrypoint_fixed.sh`
- `entrypoint_minimal.sh`
- `entrypoint_safe.sh`
- `entrypoint_simple.sh`
- `QR_SYSTEM_DEPLOYMENT_GUIDE.md`

## 初始化采购请求数据（CSV）

已支持从根目录文件 `Hayer Lab's Order Requests.csv` 初始化本地数据库（Requests、RequestHistory、Items、Users、Vendors、ItemTypes、Funds）。

在 `bio-inventory-backend` 目录执行：

```bash
# 预演（不落库）
python manage.py import_hayer_order_requests --dry-run --reset --file "D:\Qiyao\250804_Quartzy\Quartzy\Hayer Lab's Order Requests.csv"

# 正式导入
python manage.py import_hayer_order_requests --execute --reset --file "D:\Qiyao\250804_Quartzy\Quartzy\Hayer Lab's Order Requests.csv"
```

说明：
- 默认不加 `--execute` 即为 dry-run。
- `--reset` 会先删除此前由该命令导入的数据（`REQCSV-*` / `ITMCSV-*`）。
- 自动创建历史用户时，统一临时密码为 `HayerTemp@2026`（建议导入后立即修改）。

## 初始化库存数据（`data.csv`）

已支持从仓库根目录 `data.csv` 导入库存到 `items_item`（支持 dry-run、多地点拆分、按名称+地点更新）。

在 `bio-inventory-backend` 目录执行：

```bash
# 预演（不落库，默认模式）
python manage.py import_inventory_csv --file "D:\Qiyao\250804_Quartzy\Quartzy\data.csv"

# 正式导入
python manage.py import_inventory_csv --execute --file "D:\Qiyao\250804_Quartzy\Quartzy\data.csv"
```

可选参数：
- `--owner <username>`：指定导入记录归属人。默认自动 `admin -> testuser` 回退。
- `--match-mode name+location`：同名同地点更新、同名不同地点保留多条实例。
- `--verbose`：输出每行 create/update 详情。

导入规则：
- `Available`：尽量提取数值写入 `quantity`，并保留原文到 `properties.available_raw`。
- `Location`：`A + B` 视为同物品多地点库存，自动拆成多条记录并平均分配数量。
- `ItemType`：按关键词自动分类（`Media/Chemical/Kit`），其余默认 `Consumable`。

## 主要功能
- 库存管理
- 请求管理
- 用户管理
- 资金管理
- 条码打印
- 移动端支持
- 通知系统

## 技术栈
- 后端：Django + Django REST Framework
- 前端：React + TypeScript + Tailwind CSS
- 数据库：PostgreSQL（推荐）
- 打印：DYMO Connect Framework

## 生产环境注意事项
1. 配置环境变量
2. 设置数据库连接
3. 配置CORS设置
4. 设置静态文件服务
5. 配置日志记录
6. 设置备份策略

## 支持
如有问题，请联系开发团队。
