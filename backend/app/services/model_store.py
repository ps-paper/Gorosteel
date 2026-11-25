"""학습된 모델 불러오기.

ml/ 쪽에서 부품별 모델을 ml/models/{key}.joblib 로 저장하면 여기서 읽습니다.
"""
import joblib

from app.config import MODEL_DIR


def load_model(key: str):
    """부품 key(cooler, valve, pump, accumulator)의 모델. 아직 없으면 None."""
    path = MODEL_DIR / f"{key}.joblib"
    return joblib.load(path) if path.exists() else None
