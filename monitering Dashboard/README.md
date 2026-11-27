# Gorosteel

유압 시험장치의 구성품 상태를 비교하는 React 대시보드입니다. Figma Make 미리보기에서 실행되며 `pnpm build`로 프로덕션 번들을 만들 수 있습니다.

- `src/App.tsx`: 대시보드(`/`), 구성품 상태(`/equipment`), 센서 시계열(`/sensors`), 알림 센터(`/alerts`), 3D 모니터링(`/rig`) 및 가상 조기경보(`/simulation`) 라우트
- `src/SensorChart.tsx`: 센서·구간 선택과 키보드 탐색을 지원하는 시계열 차트
- `src/monitoring.ts`: 구성품·센서 정의, 상태 매핑과 가상 시나리오
- `src/RigMonitor.tsx`, `src/RigViewport.tsx`, `src/rig-model.ts`: 조작 가능한 3D 리그, 개별 구성품 단면과 상태 표시. 내부 형상과 구성품 ID는 설명을 위한 개념 모델이며 제조사 CAD가 아닙니다.

## 데이터와 모델

**실험 데이터**는 Helwig, Pignanelli, Schütze의 [Condition Monitoring of Hydraulic Systems](https://doi.org/10.24432/C5CW21) (UCI Machine Learning Repository, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))에서 발췌했습니다. 사이클 네 개의 원본 실험 라벨과 센서 여섯 채널의 1초 평균을 포함합니다. 상태 카드, 알림, 점검 순서는 실험 라벨을 사용합니다.

**AI 분류**는 실험 조건 조합이 겹치지 않도록 표시 사이클을 훈련에서 제외한 7-최근접 이웃 모델의 결과입니다. 구성품별로 온도, 냉각 효율, 압력, 유량 또는 모터 전력에서 특징을 추출합니다. 단일 사이클의 일치 개수는 모델 정확도를 나타내지 않습니다.

**조기경보 시뮬레이션**은 정상 실험 사이클의 신호에 인위적인 변화를 적용합니다. 가상 경보와 위험 시점은 시나리오에 설정되어 있으며 모델의 예측이나 실시간 설비 알림이 아닙니다.

샘플과 AI 예측을 다시 만들려면 [UCI 원본 ZIP](https://archive.ics.uci.edu/static/public/447/condition+monitoring+of+hydraulic+systems.zip)을 받은 뒤 `python scripts/prepare_uci.py <원본 ZIP 경로>`를 실행하세요.
