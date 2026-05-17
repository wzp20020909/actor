from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from sqlalchemy.orm import Session
from utils import save_upload_file, extract_text_from_file
from llm import analyze_script_overview, extract_roles_from_script, extract_relationships_from_script, chat_with_script
from database import engine, get_db
import models

# 创建数据库表
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="剧本围读助手 API", version="1.0.0")

# 配置 CORS，允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 实际开发中请修改为前端的地址，如 "http://localhost:3000"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 简单的内存缓存（已废弃，改为数据库存储）
# SCRIPT_STORE = {}

class ChatRequest(BaseModel):
    project_id: int
    question: str

@app.get("/")
def read_root():
    return {"message": "Welcome to 剧本围读助手 API"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_script(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    try:
        # 1. 保存文件
        file_path = await save_upload_file(file)
        
        # 2. 提取文本内容
        extracted_text = extract_text_from_file(file_path)
        
        # 3. 使用 DeepSeek 大模型进行概览分析
        analysis_result = analyze_script_overview(extracted_text)
        
        # 4. 使用 DeepSeek 大模型提取角色列表 (返回 JSON)
        roles = extract_roles_from_script(extracted_text)
        
        # 5. 提取人物关系网络
        relationships = extract_relationships_from_script(extracted_text, roles)
        
        # 将解析结果存入数据库，实现持久化
        new_project = models.Project(
            filename=file.filename,
            text_content=extracted_text,
            overview=analysis_result,
            roles=roles,
            relationships=relationships
        )
        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        
        # 6. 返回解析结果 (截取前500个字符用于预览原文)
        preview_text = extracted_text[:500] + ("..." if len(extracted_text) > 500 else "")
        
        return {
            "status": "success",
            "project_id": new_project.id,
            "filename": file.filename,
            "message": "File parsed successfully",
            "preview": preview_text,
            "analysis_result": analysis_result,
            "roles": roles,
            "relationships": relationships,
            "total_length": len(extracted_text)
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects")
def get_projects(db: Session = Depends(get_db)):
    """获取所有历史剧本项目"""
    projects = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "filename": p.filename,
            "created_at": p.created_at
        }
        for p in projects
    ]

@app.get("/api/projects/{project_id}")
def get_project_detail(project_id: int, db: Session = Depends(get_db)):
    """获取指定历史剧本详情"""
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    
    preview_text = p.text_content[:500] + ("..." if len(p.text_content) > 500 else "")
    
    return {
        "status": "success",
        "project_id": p.id,
        "filename": p.filename,
        "preview": preview_text,
        "analysis_result": p.overview,
        "roles": p.roles,
        "relationships": p.relationships,
        "total_length": len(p.text_content)
    }

@app.post("/api/chat")
async def chat_api(req: ChatRequest, db: Session = Depends(get_db)):
    """
    处理用户的提问并结合剧本内容回答
    """
    p = db.query(models.Project).filter(models.Project.id == req.project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="未找到该剧本项目，请重新上传文件。")
    
    try:
        answer = chat_with_script(p.text_content, req.question)
        return {"status": "success", "answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
