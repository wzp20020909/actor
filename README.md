# 剧本围读助手

剧本围读助手是一款面向演员、剧组、表演培训机构的AI辅助工具，旨在帮助用户在前期剧本围读阶段更高效地理解剧本、分析角色、梳理人物关系，从而提升表演准备的效率和质量。

## 目录结构

*   `frontend/`: React + TypeScript 前端项目
    *   框架：React (Create React App)
    *   UI 库：Ant Design
    *   图表库：ECharts
    *   网络请求：Axios
*   `backend/`: Python + FastAPI 后端项目
    *   框架：FastAPI
    *   服务器：Uvicorn
    *   依赖管理：requirements.txt

## 快速开始

### 前端

```bash
cd frontend
npm install
npm start
```
前端默认运行在 `http://localhost:3000`

### 后端

```bash
cd backend
python -m venv venv
# 激活虚拟环境 (Windows)
.\venv\Scripts\activate
# 激活虚拟环境 (macOS/Linux)
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```
后端 API 默认运行在 `http://127.0.0.1:8000`，您可以访问 `http://127.0.0.1:8000/docs` 查看自动生成的 Swagger API 文档。
