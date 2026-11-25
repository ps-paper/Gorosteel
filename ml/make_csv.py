"""UCI 유압 시스템 데이터(원본 행렬 txt) → 분석용 CSV.

실행 (저장소 루트에서): python ml/make_csv.py data/raw data/processed
결과:
  hyd_cycles.csv  사이클(60초) 1행: 센서별 mean/std/min/max + FS1_sat_n + 라벨 (2205행)
  hyd_1hz.csv     사이클×초 1행: 17개 센서를 1Hz로 평균 (2205×60 = 132,300행)
  hyd_sensors.csv 센서 사전 (+ 품질 메모)

원본 점검(2026-11-25)에서 찾은 함정과 처리:
  PS4  1,238사이클이 60초 내내 0 (위장 결측). 냉각기 3%·20% 구간에만 있어 그대로 두면
       냉각기 라벨 누수가 생김 → 전부 0인 사이클만 NaN. 정상 사이클 안의 0은 그대로 둠.
  SE   모든 사이클의 1~8초가 0 (값이 아직 계산되지 않은 구간으로 보임) → NaN, 통계는 나머지 52초로 계산.
  FS1  최댓값 20.479가 1,002사이클에서 반복 (포화 후보) → 값은 그대로 두고
       사이클별 포화 샘플 수 FS1_sat_n을 따로 기록. FS1_max는 신뢰하지 않음.
"""
import os
import sys
import warnings

import numpy as np
import pandas as pd

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

SENSORS = {  # 이름: (물리량, 단위, Hz)
    "PS1": ("압력", "bar", 100), "PS2": ("압력", "bar", 100), "PS3": ("압력", "bar", 100),
    "PS4": ("압력", "bar", 100), "PS5": ("압력", "bar", 100), "PS6": ("압력", "bar", 100),
    "EPS1": ("모터 전력", "W", 100), "FS1": ("유량", "l/min", 10), "FS2": ("유량", "l/min", 10),
    "TS1": ("온도", "°C", 1), "TS2": ("온도", "°C", 1), "TS3": ("온도", "°C", 1), "TS4": ("온도", "°C", 1),
    "VS1": ("진동", "mm/s", 1), "CE": ("냉각 효율(가상)", "%", 1), "CP": ("냉각 동력(가상)", "kW", 1),
    "SE": ("효율 계수", "%", 1),
}
NOTES = {
    "PS4": "1,238사이클 전부 0(위장 결측) → NaN. 냉각기 3%·20% 구간에만 있음(누수 주의)",
    "FS1": "최댓값 20.479 반복(포화 후보, 약 9.5초 부근) → FS1_sat_n 기록, FS1_max 신뢰 낮음",
    "SE": "매 사이클 1~8초가 0 → NaN, 통계는 나머지 52초",
    "CE": "가상 센서(파생값). 냉각기 등급과 거의 그대로 대응",
    "CP": "가상 센서(파생값)",
}
FS1_SAT = 20.479

labels = pd.read_csv(os.path.join(RAW, "profile.txt"), sep="\t", header=None,
                     names=["cooler_pct", "valve_pct", "pump_leak", "accumulator_bar", "stable_flag"])
labels.index.name = "cycle"

feats, onehz = {}, {}
for name, (_, _, hz) in SENSORS.items():
    m = np.loadtxt(os.path.join(RAW, f"{name}.txt"))  # (2205, 60*hz)
    if name == "PS4":
        dead = (m == 0).all(1)
        m[dead] = np.nan
        print(f"PS4: 전부 0인 사이클 {dead.sum()}개 → NaN", flush=True)
    elif name == "SE":
        head = m[:, 1:9]  # view: 수정하면 m에 반영됨
        print(f"SE: 1~8초의 0 {(head == 0).sum()}개 → NaN", flush=True)
        head[head == 0] = np.nan
    elif name == "FS1":
        feats["FS1_sat_n"] = np.isclose(m, FS1_SAT).sum(1)
    with warnings.catch_warnings():  # PS4 전부 NaN 사이클의 경고 무시 (결과는 NaN)
        warnings.simplefilter("ignore", RuntimeWarning)
        feats[f"{name}_mean"] = np.nanmean(m, 1)
        feats[f"{name}_std"] = np.nanstd(m, 1)
        feats[f"{name}_min"] = np.nanmin(m, 1)
        feats[f"{name}_max"] = np.nanmax(m, 1)
        onehz[name] = np.nanmean(m.reshape(m.shape[0], 60, hz), 2).ravel()  # 1초 평균
    print(f"{name}: {m.shape}", flush=True)

cyc = pd.DataFrame(feats, index=labels.index).join(labels)
cyc.to_csv(os.path.join(OUT, "hyd_cycles.csv"), float_format="%.5g")

n = len(labels)
ts = pd.DataFrame(onehz)
ts.insert(0, "second", np.tile(np.arange(60), n))
ts.insert(0, "cycle", np.repeat(np.arange(n), 60))
ts = ts.merge(labels.reset_index(), on="cycle")
ts.to_csv(os.path.join(OUT, "hyd_1hz.csv"), index=False, float_format="%.5g")

pd.DataFrame([(k, *v, NOTES.get(k, "")) for k, v in SENSORS.items()],
             columns=["sensor", "quantity", "unit", "sampling_hz", "note"]).to_csv(
    os.path.join(OUT, "hyd_sensors.csv"), index=False, encoding="utf-8-sig")
print("saved", cyc.shape, ts.shape)
