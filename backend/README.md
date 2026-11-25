# 백엔드 (FastAPI)

학습된 모델로 부품 상태를 예측하고, 그 결과를 프론트엔드 대시보드에 API로 전달하는 서버입니다.

## 실행

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- API 문서(자동 생성): http://localhost:8000/docs
- 프론트엔드 개발 서버(5173번 포트)의 요청은 CORS로 허용되어 있습니다 (`app/config.py`).

## 지금 만들어진 것

| 파일 | 내용 |
| --- | --- |
| `app/main.py` | 서버 진입점, CORS 설정, `GET /api/health` |
| `app/config.py` | 데이터·모델 경로 (`data/processed/`, `ml/models/`) |
| `app/routers/components.py` | `GET /api/components`: 4부품의 이름, 라벨 컬럼, 등급 정의 |
| `app/schemas/component.py` | 위 응답 형식 (Pydantic) |
| `app/services/model_store.py` | `load_model(key)`: `ml/models/{key}.joblib`을 읽음. 파일이 없으면 None |

## 할 일

1. **API 명세 확정**: 아래 초안을 프론트엔드·ML 담당과 맞춰서 확정합니다.
2. **진단 API**: 모델로 4부품 상태를 예측해 돌려줍니다.
3. **점검 우선순위 API**: 부품별 예측 결과로 점검 순서를 매깁니다. 계산 방식은 팀이 정해야 합니다 (예: 고장 직전 등급 확률 × 부품 중요도).
4. **데이터 제공 API** (필요하면): 대시보드에서 보여 줄 사이클 목록이나 센서 값을 제공합니다.
5. **오류 처리**: 모델 파일이 없을 때나 사이클 번호가 범위 밖일 때 알기 쉬운 메시지를 돌려줍니다.

## API 초안 (팀 합의 필요)

실제 현장처럼 실시간 센서가 들어오지 않습니다. 그래서 데모에서는 **데이터셋의 사이클 하나를 골라 "지금 들어온 측정값"으로 보고 진단하는 방식**을 제안합니다.

| 메서드 | 경로 | 내용 | 상태 |
| --- | --- | --- | --- |
| GET | `/api/health` | 서버 상태 | 완료 |
| GET | `/api/components` | 부품별 등급 정의 | 완료 |
| GET | `/api/cycles` | 고를 수 있는 사이클 번호 목록 (안정 구간만 등) | 초안 |
| GET | `/api/cycles/{cycle}/diagnosis` | 해당 사이클의 4부품 예측 등급과 확률 | 초안 |
| GET | `/api/cycles/{cycle}/priority` | 해당 사이클의 부품별 점검 우선순위 | 초안 |

진단 응답 예시 (초안):

```json
{
  "cycle": 1500,
  "results": [
    {"key": "pump", "predicted": 2, "meaning": "심한 누유", "probabilities": {"0": 0.05, "1": 0.15, "2": 0.80}},
    {"key": "cooler", "predicted": 100, "meaning": "정상 효율", "probabilities": {"3": 0.0, "20": 0.01, "100": 0.99}}
  ]
}
```

## ML 담당과의 약속

- 모델 파일: `ml/models/{key}.joblib` (`key` = `cooler`, `valve`, `pump`, `accumulator`)
- 입력: `data/processed/hyd_cycles.csv`에서 라벨 5개 컬럼을 뺀 특징 컬럼입니다. ML 담당이 학습에 쓴 컬럼 목록을 모델과 함께 저장하기로 맞추면 안전합니다 (예: scikit-learn Pipeline으로 저장).
- 데이터 함정(PS4 결측, FS1 포화 등)은 루트 [README](../README.md) 4절을 참고합니다.
