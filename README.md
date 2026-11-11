# Amel WGS Atlas

Apis mellifera 全基因组群体遗传学数据门户（React + FastAPI），可直接推送到 GitHub 并在 Render 用 Docker 部署。

## 目录结构

```text
amel-wgs-portal/
├── backend/          # FastAPI
├── frontend/         # React + Vite
├── data/             # 可进 Git 的数据资产（约 18MB）
├── data-large/       # 可选大文件（默认 gitignore）
├── Dockerfile
├── render.yaml
└── requirements.txt
```

## 本地运行

```bash
# 后端
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000

# 前端（另开终端）
cd frontend
npm install
npm run dev
```

开发前端：http://127.0.0.1:5173  
生产一体服务（先 build 前端）：

```bash
cd frontend && npm install && npm run build && cd ..
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

然后打开 http://127.0.0.1:8000

## 推送到 GitHub

```bash
cd amel-wgs-portal
git init
git add .
git commit -m "Initial Amel WGS Atlas deploy package"
git branch -M main
git remote add origin https://github.com/<YOUR_USER>/<YOUR_REPO>.git
git push -u origin main
```

### 关于大文件

- 完整变异库：`data/variants_index.db`（约 543MB，**Git LFS**）
- 克隆仓库前请安装并启用 LFS：`git lfs install && git lfs pull`
- Render Docker 部署会检出 LFS 文件；若构建报 pointer 过小，检查该服务是否开启 Git LFS

## Render 部署

1. GitHub 建好仓库并 push 本目录内容  
2. Render → **New** → **Web Service** → 连接该仓库  
3. 选择 **Docker**（已提供 `Dockerfile` + `render.yaml`）  
4. 创建后访问 `https://<your-service>.onrender.com`

或用 Blueprint：

```bash
# 在 Render Dashboard 选择 New → Blueprint，指向本仓库的 render.yaml
```

### 注意

- Render 免费实例会休眠，冷启动较慢  
- 免费内存有限；当前默认包（不含 543MB DB）更适合免费套餐  
- 不要提交 `frontend/node_modules`、`.venv`、`data-large/`

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `ASSETS_DIR` | `./data` | 数据目录 |
| `STATIC_DIR` | `./frontend/dist` | 前端构建产物 |
| `PORT` | `8000` | 服务端口（Render 会自动注入） |
