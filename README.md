# Gorosteel

**유압 시스템 4대 핵심 부품 통합 이상진단 및 정비 의사결정 시스템**

압력·유량·온도·진동 신호로 유압 시스템의 냉각기, 밸브, 펌프, 축압기 상태를 각각 분류하고, 대시보드에서 설비별 점검 우선순위를 보여 줍니다.

- 핵심 기술: RandomForest, 상태별 F1·재현율 평가, React 대시보드
- 제철소 맥락: 포스코 광양 3연주 유압설비 이상감지 사례. 연주 세그먼트, 압연 AGC 실린더
- 분석 기준: [docs/G-1.md](docs/G-1.md) (강의 지식 베이스). 분석 도구와 판단 원칙은 G-1을 따르고, 강의에서 다루지 않은 기법은 "강의 밖"으로 표시합니다.

---

## 1. 폴더 구성

```
Gorosteel/
├─ frontend/            React 대시보드 (Vite)
│  └─ src/
│     ├─ api/           백엔드 호출 함수
│     ├─ components/    화면 조각 (부품 카드 등)
│     └─ App.jsx        메인 화면
├─ backend/             FastAPI 서버
│  └─ app/
│     ├─ main.py        서버 진입점
│     ├─ config.py      경로·설정
│     ├─ routers/       API 엔드포인트
│     ├─ schemas/       요청·응답 형식
│     └─ services/      모델 불러오기 등 처리 로직
├─ ml/                  데이터 분석·모델 학습
│  ├─ make_csv.py       원본 → 분석용 CSV 변환
│  ├─ notebooks/        EDA·학습 노트북
│  └─ models/           학습된 모델 저장 (git 제외)
├─ data/
│  ├─ raw/              UCI 원본 (git 제외, 약 600MB)
│  └─ processed/        분석용 CSV
└─ docs/                G-1, 진행 요약
```

| 경로 | 내용 | git |
| --- | --- | --- |
| `data/raw/` | **원본 데이터** (정제 전). 센서별 txt 17개, 라벨 `profile.txt`, 설명서 2개 | 제외 (3절 명령으로 받기) |
| `data/processed/hyd_cycles.csv` | **메인 분석 데이터.** 1행 = 1사이클 (2,205행 × 74열) | 포함 |
| `data/processed/hyd_sensors.csv` | 센서 사전과 품질 메모 | 포함 |
| `data/processed/hyd_1hz.csv` | 1초 단위 시계열 (132,300행). 파형을 볼 때만 사용 | 제외 (스크립트로 생성) |
| `ml/make_csv.py` | 원본 → 분석용 CSV 변환 스크립트 | 포함 |
| `docs/G-1.md` | 강의 지식 베이스 (분석 원칙의 기준 문서) | 포함 |
| `docs/프로젝트_진행요약.md` | 주제 선정 경위와 진행 기록 | 포함 |

## 역할 분담

| 영역 | 폴더 | 할 일 안내 |
| --- | --- | --- |
| 데이터 분석·모델 | `ml/`, `data/` | 이 README의 4~6절 |
| 백엔드 | `backend/` | [backend/README.md](backend/README.md) |
| 프론트엔드 | `frontend/` | [frontend/README.md](frontend/README.md) |

세 영역은 두 가지 약속으로 이어집니다. 담당자끼리 먼저 맞춰 주세요.

- **ML → 백엔드**: 모델을 `ml/models/{cooler|valve|pump|accumulator}.joblib`으로 저장합니다. 입력 컬럼은 `hyd_cycles.csv`에서 라벨을 뺀 특징입니다.
- **백엔드 → 프론트엔드**: API 경로와 응답 형식입니다. 초안은 [backend/README.md](backend/README.md)에 있습니다.

## 빠른 시작

처음 한 번은 각 폴더의 패키지를 설치합니다. 가상환경(`python -m venv .venv`)을 쓰는 것을 권장합니다.

```bash
# 1) 백엔드 (터미널 1)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload          # http://localhost:8000/docs 에서 API 확인

# 2) 프론트엔드 (터미널 2)
cd frontend
npm install
npm run dev                            # http://localhost:5173

# 3) 분석·학습
pip install -r ml/requirements.txt
jupyter notebook ml/notebooks
```

프론트엔드가 `/api`로 보내는 요청은 개발 서버가 백엔드(8000번 포트)로 전달합니다. 화면에 "백엔드: 연결됨"이 보이면 둘이 제대로 이어진 것입니다.

---

## 2. 데이터: UCI Condition Monitoring of Hydraulic Systems

- 출처: ZeMA gGmbH 유압 실험 장치 (Helwig 외, 2015), CC BY 4.0. https://archive.ics.uci.edu/dataset/447
- 실험 장치가 **60초짜리 부하 사이클을 2,205번 반복**하면서, 네 부품의 상태를 일부러 바꿔 가며 측정한 데이터입니다.
- 시간이 지나면서 실제로 고장 난 기록이 아니라 **설계된 실험**입니다. 그래서 남은 수명(RUL)을 예측하기보다 **부품별 상태 등급을 분류**하는 문제로 다룹니다.

### 센서 17개

| 센서 | 물리량 | 단위 | 샘플링 | 사이클당 값 수 |
| --- | --- | --- | --- | --- |
| PS1~PS6 | 압력 | bar | 100Hz | 6,000 |
| EPS1 | 모터 전력 | W | 100Hz | 6,000 |
| FS1, FS2 | 유량 | l/min | 10Hz | 600 |
| TS1~TS4 | 온도 | °C | 1Hz | 60 |
| VS1 | 진동 | mm/s | 1Hz | 60 |
| CE | 냉각 효율 (가상 센서) | % | 1Hz | 60 |
| CP | 냉각 동력 (가상 센서) | kW | 1Hz | 60 |
| SE | 효율 계수 | % | 1Hz | 60 |

### 라벨 (`profile.txt`, 우리가 맞혀야 할 정답)

| 부품 | 컬럼 | 상태 등급: 정상 → 고장 직전 (사이클 수) | 원 논문 기준 난이도 |
| --- | --- | --- | --- |
| 냉각기 | `cooler_pct` | 100 (741) → 20 (732) → 3 (732) % | 쉬움 |
| 밸브 응답 | `valve_pct` | 100 (1125) → 90 (360) → 80 (360) → 73 (360) % | 쉬움 |
| 펌프 내부 누유 | `pump_leak` | 0 (1221) → 1 (492) → 2 (492) | 어려움 |
| 축압기 압력 | `accumulator_bar` | 130 (599) → 115 (399) → 100 (399) → 90 (808) bar | 가장 어려움 |

- `stable_flag`: 0이면 운전이 안정된 상태이고, 1이면 아직 안정되지 않았을 수 있는 상태입니다 (756사이클, 34%).
- 네 부품의 상태 조합 144가지(3×4×3×4)가 모두 들어 있습니다.

---

## 3. 왜 `make_csv.py`가 필요한가

`data/raw/`는 **정제되지 않은 원본**이라 바로 분석할 수 없습니다.

- 센서 하나가 파일 하나이고, 각 파일은 **행 = 사이클, 열 = 그 사이클 안의 시점**인 행렬입니다. 예를 들어 PS1은 2,205 × 6,000입니다.
- 센서마다 샘플링 속도가 달라 열 수가 6,000 / 600 / 60으로 제각각입니다. 그래서 표 하나로 바로 합칠 수 없습니다.
- RandomForest 같은 모델은 **1행 = 1사이클** 형태의 표가 필요합니다.

`make_csv.py`가 하는 일은 세 가지입니다.

1. **구조 변환**: 17개 행렬을 사이클 단위 표(`hyd_cycles.csv`)와 1초 단위 시계열(`hyd_1hz.csv`)로 합칩니다.
2. **품질 처리**: 원본에서 찾은 함정을 처리합니다 (4절).
3. **특징 추출**: 센서마다 사이클 동안의 평균·표준편차·최솟값·최댓값을 계산합니다.

### 실행 방법

저장소 루트에서 실행합니다.

```bash
pip install numpy pandas
python ml/make_csv.py data/raw data/processed
```

몇 분 걸립니다. 원본이 없으면 아래 명령으로 받아 `data/raw/` 폴더에 압축을 풉니다.

```bash
curl -L -o hydraulic.zip "https://archive.ics.uci.edu/static/public/447/condition+monitoring+of+hydraulic+systems.zip"
```

---

## 4. 원본 데이터의 함정 (꼭 읽어 주세요)

공식 설명은 "결측값 없음"이지만, 원본을 직접 점검해 보면(2026-11-25) 아래 문제가 있습니다. `make_csv.py`가 이미 처리했으니, CSV를 쓸 때 **의미만 알고 있으면 됩니다.**

| 센서 | 발견한 문제 | 처리 | 분석할 때 주의 |
| --- | --- | --- | --- |
| **PS4** | 1,238사이클(56%)에서 60초 내내 0. 이 사이클은 **냉각기 3%·20% 구간에만** 있고 100% 구간에는 하나도 없음 | 전부 0인 사이클만 NaN으로 바꿈 | 그대로 두면 모델이 "PS4=0이면 냉각기 불량"이라는 엉뚱한 규칙을 배움(**정답 누수**). 냉각기 모델에서는 PS4를 빼는 것을 우선 검토 |
| **FS1** | 최댓값 20.479가 1,002사이클에서 똑같이 반복되고, 거의 모두 약 9.5초 부근에서 나옴. 센서 측정 한계에 걸린 **포화**로 의심 | 값은 그대로 두고 포화 횟수를 `FS1_sat_n`에 기록 | `FS1_max`는 실제 최댓값이 아닐 수 있으니 신뢰하지 않음 |
| **SE** | 모든 사이클의 1~8초가 0. 측정값이 아니라 계산이 아직 시작되지 않은 구간으로 보임 | NaN으로 바꾸고 나머지 52초로 통계 계산 | 처리 전에는 `SE_min`이 항상 0이었고 평균도 55.3으로 낮게 나왔음 (처리 후 63.8) |
| **CE, CP** | 실제 센서가 아니라 다른 값으로 계산한 **가상 센서**. CE 평균이 냉각기 등급에 따라 19.6 / 27.2 / 46.9로 거의 그대로 갈림 | 처리 없음 | 냉각기 분류가 너무 쉽게 나오는 이유. 결과를 해석할 때 이 점을 함께 적기 |

### 그 밖에 알아 둘 구조

- **안정 플래그**: 냉각기 등급이 바뀐 직후 211사이클은 `stable_flag`=1입니다. 이 사이클을 빼면 1,449사이클이 남습니다.
- **정상 기준선**: 네 부품이 **모두 정상**인 사이클은 21개뿐이고, 그중 안정 상태는 10개입니다. 그래서 정상 기준선은 부품별로 잡습니다.
- **사이클 순서**: 냉각기 등급은 사이클 순서대로 3개 블록(0~731번은 3%, 732~1463번은 20%, 1464번부터는 100%)으로만 바뀝니다. 학습·평가 데이터를 나눌 때 이 순서 효과를 점검합니다.

---

## 5. `hyd_cycles.csv` 컬럼 설명

| 컬럼 | 의미 |
| --- | --- |
| `cycle` | 사이클 번호 (0~2204) |
| `{센서}_mean` / `_std` / `_min` / `_max` | 해당 사이클 60초 동안 센서 값의 평균·표준편차·최솟값·최댓값. 예: `PS1_mean` |
| `FS1_sat_n` | FS1이 포화값(20.479)을 찍은 샘플 수 |
| `cooler_pct`, `valve_pct`, `pump_leak`, `accumulator_bar` | 부품별 상태 등급 (정답) |
| `stable_flag` | 0은 안정, 1은 미안정 |

라벨 5개 컬럼은 모델 입력(X)에 **절대 넣지 않습니다** (정답 누수).

```python
import pandas as pd
df = pd.read_csv("data/processed/hyd_cycles.csv", index_col="cycle")
labels = ["cooler_pct", "valve_pct", "pump_leak", "accumulator_bar", "stable_flag"]
X = df.drop(columns=labels)
y = df["pump_leak"]   # 분석할 부품 하나를 고름
```

---

## 6. 분석 순서 (G-1 기준)

1. 구조 확인과 센서 카드 작성
2. 안정 플래그로 구간 선별, 사이클 순서 확인
3. 탐색적 분석: 등급별 분포(boxplot), 상관(heatmap)
4. 이상 탐지: 부품별 정상 기준선에 Z-score, IsolationForest
5. 상태 분류: RandomForest, `train_test_split(stratify=y)`, 누수 방지
6. 평가: 혼동행렬, 상태별 F1·재현율(`classification_report`), 임계값 조정, 비용 판단
7. 대시보드: 부품별 상태와 점검 우선순위 표시 (React, 강의 밖)

강의는 이진 분류(고장 임박 = 1)만 다뤘습니다. 이 프로젝트는 부품마다 3~4등급을 나누는 다중 분류입니다. 강의 흐름 그대로 가려면 "고장 직전 등급 = 1"로 이진 라벨을 만들어 시작할 수 있습니다.

---

## 7. 참고 자료

- UCI 데이터셋: https://archive.ics.uci.edu/dataset/447/condition+monitoring+of+hydraulic+systems
- 원 논문: Helwig, Pignanelli, Schütze, "Condition Monitoring of a Complex Hydraulic System Using Multivariate Statistics", I2MTC 2015, doi:10.1109/I2MTC.2015.7151267
- 포스코 광양 예지정비 (3연주 유압설비 이상감지): https://www.namdonews.com/news/articleView.html?idxno=925192
