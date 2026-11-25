"""FastAPI 진입점.

실행 (backend 폴더에서): uvicorn app.main:app --reload
API 문서: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import components

app = FastAPI(title="Gorosteel 유압 시스템 이상진단 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(components.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
