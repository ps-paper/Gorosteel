"""경로와 공통 설정. 경로는 저장소 루트 기준으로 계산합니다."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "processed"
MODEL_DIR = ROOT / "ml" / "models"

CYCLES_CSV = DATA_DIR / "hyd_cycles.csv"

# 프론트엔드 개발 서버(Vite) 주소
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
