# Gorosteel

유압 시험장치의 구성품 상태를 비교하는 React 대시보드입니다.

- `src/App.tsx`: 대시보드(`/`), 구성품 상태(`/equipment`), 센서 시계열(`/sensors`), 알림 센터(`/alerts`), 3D 모니터링(`/rig`) 및 가상 조기경보(`/simulation`) 라우트
- `src/SensorChart.tsx`: 센서·구간 선택과 키보드 탐색을 지원하는 시계열 차트
- `src/monitoring.ts`: 구성품·센서 정의, 상태 매핑과 가상 시나리오
- `src/RigMonitor.tsx`, `src/RigViewport.tsx`, `src/rig-model.ts`: 조작 가능한 3D 리그, 개별 구성품 단면과 상태 표시. 내부 형상과 구성품 ID는 설명을 위한 개념 모델이며 제조사 CAD가 아닙니다.

## 대시보드 실행 방법

### Figma Make에서 열기

Figma Make에서 이 프로젝트를 열었다면 **미리보기(Preview)** 패널을 누르세요. 개발 서버가 자동으로 실행되므로 바로 대시보드를 볼 수 있습니다.

### 내 컴퓨터에서 열기 (Windows)

**Node.js 22 설치하기 (처음 한 번만)**

1. [Node.js 22 공식 다운로드 목록](https://nodejs.org/download/release/latest-v22.x/)에서 `-x64.msi`로 끝나는 파일을 받으세요. ARM 기반 Windows PC라면 `-arm64.msi` 파일을 받으세요.
2. 받은 파일을 더블클릭하고 설치 화면에서 기본 설정 그대로 **Next → Install → Finish**를 누르세요. 중간에 사용 약관 동의 화면이 나오면 약관을 읽고 동의한 뒤 계속 진행하세요.
3. 열려 있던 VS Code나 명령 창을 닫았다가 다시 열고 `node -v`를 입력하세요. `v22.`로 시작하는 숫자가 나오면 설치가 끝난 것입니다.

**대시보드 열기**

`README.md`와 `package.json`이 들어 있는 `frontend` 폴더에서 아래 방법 중 하나로 명령 창을 여세요.

- **VS Code 터미널** — **파일 → 폴더 열기**에서 `frontend` 폴더를 선택한 뒤 **터미널 → 새 터미널**을 누르세요.
- **CMD(명령 프롬프트)** — 파일 탐색기에서 `frontend` 폴더를 열고 위쪽 주소 표시줄에 `cmd`를 입력한 뒤 Enter를 누르세요.
- **PowerShell** — 같은 주소 표시줄에 `powershell`을 입력하고 Enter를 누르세요.

1. **필요한 파일을 설치합니다.** 처음 한 번만 명령 창에서 `npm.cmd install`을 실행하세요.
2. **대시보드를 켭니다.** `npm.cmd run dev`를 입력하고 Enter를 누르세요.
3. **브라우저에서 엽니다.** 크롬이나 엣지에서 [http://localhost:8443/](http://localhost:8443/)을 여세요. 보는 동안 명령 창을 열어 두고, 다 봤으면 `Ctrl+C`를 누르세요.

8443 포트가 이미 사용 중이면 `npm.cmd run dev -- --port 8444`로 실행하고 [http://localhost:8444/](http://localhost:8444/)를 여세요.

### 프로덕션 빌드 미리보기

의존성을 설치한 상태에서 다음 명령을 실행한 뒤 터미널에 표시된 주소를 엽니다.

```cmd
npm.cmd run build
npm.cmd run preview
```

## 데이터와 모델

**실험 데이터**는 Helwig, Pignanelli, Schütze의 [Condition Monitoring of Hydraulic Systems](https://doi.org/10.24432/C5CW21) (UCI Machine Learning Repository, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))에서 발췌했습니다. 사이클 네 개의 원본 실험 라벨과 센서 여섯 채널의 1초 평균을 포함합니다. 상태 카드, 알림, 점검 순서는 실험 라벨을 사용합니다.

**AI 분류**는 실험 조건 조합이 겹치지 않도록 표시 사이클을 훈련에서 제외한 7-최근접 이웃 모델의 결과입니다. 구성품별로 온도, 냉각 효율, 압력, 유량 또는 모터 전력에서 특징을 추출합니다. 단일 사이클의 일치 개수는 모델 정확도를 나타내지 않습니다.

**조기경보 시뮬레이션**은 정상 실험 사이클의 신호에 인위적인 변화를 적용합니다. 가상 경보와 위험 시점은 시나리오에 설정되어 있으며 모델의 예측이나 실시간 설비 알림이 아닙니다.

샘플과 AI 예측을 다시 만들려면 [UCI 원본 ZIP](https://archive.ics.uci.edu/static/public/447/condition+monitoring+of+hydraulic+systems.zip)을 받은 뒤 `python scripts/prepare_uci.py <원본 ZIP 경로>`를 실행하세요.
