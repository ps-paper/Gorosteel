"""4대 부품 정보 API.

TODO: 모델 학습 후 부품별 상태 예측(/predict)과 점검 우선순위(/priority) 엔드포인트 추가.
"""
from fastapi import APIRouter

from app.schemas.component import Component, Grade

router = APIRouter(tags=["components"])

# UCI 데이터셋 profile.txt 기준 (data/raw/description.txt)
COMPONENTS = [
    Component(key="cooler", name="냉각기", label_column="cooler_pct", unit="%", grades=[
        Grade(value=100, meaning="정상 효율"), Grade(value=20, meaning="효율 저하"),
        Grade(value=3, meaning="고장 직전")]),
    Component(key="valve", name="밸브", label_column="valve_pct", unit="%", grades=[
        Grade(value=100, meaning="정상 응답"), Grade(value=90, meaning="약간 지연"),
        Grade(value=80, meaning="심한 지연"), Grade(value=73, meaning="고장 직전")]),
    Component(key="pump", name="펌프", label_column="pump_leak", unit="등급", grades=[
        Grade(value=0, meaning="누유 없음"), Grade(value=1, meaning="약한 누유"),
        Grade(value=2, meaning="심한 누유")]),
    Component(key="accumulator", name="축압기", label_column="accumulator_bar", unit="bar", grades=[
        Grade(value=130, meaning="정상 압력"), Grade(value=115, meaning="약간 저하"),
        Grade(value=100, meaning="심한 저하"), Grade(value=90, meaning="고장 직전")]),
]


@router.get("/components", response_model=list[Component])
def list_components():
    return COMPONENTS
