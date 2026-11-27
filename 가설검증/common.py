"""가설검증 노트북 공통 함수.

모든 노트북이 맨 처음 `from common import *`로 불러 씁니다.
검정 자체(scipy·statsmodels 호출)는 각 노트북에 그대로 보이게 두고,
여기에는 데이터 읽기, 반복되는 계산, 그림 설정만 모았습니다.
"""
from pathlib import Path
import itertools
import json
import warnings

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from statsmodels.stats.multitest import multipletests
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.graphics.tsaplots import plot_acf

warnings.filterwarnings("ignore")

# ── 그림 설정 ───────────────────────────────────────
plt.rcParams["font.family"] = "Malgun Gothic"      # macOS는 "AppleGothic"
plt.rcParams["axes.unicode_minus"] = False
plt.rcParams["figure.dpi"] = 100

# ── 경로·상수 ──────────────────────────────────────
ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "data" / "processed").exists())
RAW, PROC = ROOT / "data" / "raw", ROOT / "data" / "processed"
RESULTS = Path(__file__).resolve().parent / "results"
RESULTS.mkdir(exist_ok=True)

ALPHA = 0.05          # 유의수준 (미리 고정)
SEED = 42
BLOCK = 50            # 자기상관 대응용 블록 크기 (사이클)
COMP = {"cooler_pct": "냉각기(%)", "valve_pct": "밸브(%)", "pump_leak": "펌프 누설", "accumulator_bar": "축압기(bar)"}
LABELS = list(COMP) + ["stable_flag"]


def load_cycles():
    """사이클 단위 표 (2,205행). 특징 + 정답 5개"""
    return pd.read_csv(PROC / "hyd_cycles.csv")


_raw_cache = {}
def raw(name):
    """원본 고주파 신호 (사이클 × 샘플). 100 Hz 센서면 6,000열. data/raw에 각자 내려받아 둬야 함"""
    if name not in _raw_cache:
        _raw_cache[name] = pd.read_csv(RAW / f"{name}.txt", sep="\t", header=None).values
    return _raw_cache[name]


def features(cyc):
    return [c for c in cyc.columns if c not in LABELS + ["cycle"]]


# ── 효과 크기 해석 ─────────────────────────────────
def size_label(v, kind="eps2"):
    """효과 크기를 말로. eps2/eta2: 0.01 작음, 0.06 중간, 0.14 큼 / V·D: 0.1 작음, 0.3 중간, 0.5 큼"""
    if v is None or np.isnan(v):
        return "-"
    cut = {"eps2": (0.01, 0.06, 0.14), "eta2": (0.01, 0.06, 0.14), "V": (0.1, 0.3, 0.5), "D": (0.1, 0.3, 0.5)}[kind]
    return "매우 작음" if v < cut[0] else "작음" if v < cut[1] else "중간" if v < cut[2] else "큼"


# ── 검정 도우미 ────────────────────────────────────
def kruskal_test(x, g):
    """Kruskal-Wallis + 효과 크기 ε² = H / (n − 1)"""
    d = pd.DataFrame({"x": np.asarray(x, float), "g": np.asarray(g)}).dropna()
    groups = [v["x"].values for _, v in d.groupby("g")]
    H, p = stats.kruskal(*groups)
    eps2 = H / (len(d) - 1)
    return dict(H=H, df=len(groups) - 1, p=p, eps2=eps2, n=len(d))


def dunn_test(x, g):
    """Dunn 사후검정 (순위 기반, 동점 보정) + Holm 보정. 어느 그룹끼리 다른지"""
    d = pd.DataFrame({"x": np.asarray(x, float), "g": np.asarray(g)}).dropna()
    d["r"] = stats.rankdata(d["x"]); N = len(d)
    _, cnt = np.unique(d["x"], return_counts=True)
    tie = (cnt ** 3 - cnt).sum() / (12 * (N - 1))
    m = d.groupby("g")["r"].agg(["mean", "size"])
    rows = []
    for a, b in itertools.combinations(m.index, 2):
        se = np.sqrt((N * (N + 1) / 12 - tie) * (1 / m.loc[a, "size"] + 1 / m.loc[b, "size"]))
        z = (m.loc[a, "mean"] - m.loc[b, "mean"]) / se
        rows.append(dict(쌍=f"{a} vs {b}", z=z, p=2 * stats.norm.sf(abs(z))))
    out = pd.DataFrame(rows)
    out["p_holm"] = multipletests(out["p"], method="holm")[1]
    out["유의"] = np.where(out["p_holm"] < ALPHA, "예", "아니오")
    return out


def holm(pvals):
    return multipletests(list(pvals), method="holm")[1]


def assumption_table(x, g):
    """그룹별 정규성(D'Agostino K²) + 전체 등분산(Levene, 중앙값 기준)"""
    d = pd.DataFrame({"x": np.asarray(x, float), "g": np.asarray(g)}).dropna()
    rows = []
    for k, v in d.groupby("g"):
        k2, p = stats.normaltest(v["x"])
        rows.append(dict(그룹=k, n=len(v), 왜도=stats.skew(v["x"]), K2=k2, 정규성_p=p,
                         정규분포="예" if p >= ALPHA else "아니오"))
    lev = stats.levene(*[v["x"].values for _, v in d.groupby("g")], center="median")
    return pd.DataFrame(rows), dict(W=lev.statistic, p=lev.pvalue, 등분산="예" if lev.pvalue >= ALPHA else "아니오")


def cramers_v(tab):
    chi2, p, dof, exp = stats.chi2_contingency(tab)
    V = np.sqrt(chi2 / (tab.values.sum() * (min(tab.shape) - 1)))
    return dict(chi2=chi2, df=dof, p=p, V=V, min_expected=exp.min())


def block_means(cyc, f, c, size=BLOCK):
    """연속 size사이클 블록 × 상태별 평균 (자기상관을 줄인 데이터)"""
    return cyc.assign(block=cyc["cycle"] // size).groupby(["block", c], as_index=False)[f].mean()


# ── 정상성 ─────────────────────────────────────────
def stationarity(cyc, cols, diff=True):
    """ADF(H0: 비정상) + KPSS(H0: 정상)를 함께 보고 판정.
    KPSS p는 프로그램이 0.01~0.10 사이만 계산하므로 경계값(0.01, 0.10)이 나오면 '이하/이상'으로 읽음"""
    rows = []
    for f in cols:
        series = [("원값", cyc[f])] + ([("1차 차분", cyc[f].diff())] if diff else [])
        for nm, x in series:
            x = x.dropna()
            if x.nunique() < 3:
                continue
            a, k = adfuller(x)[1], kpss(x, regression="c", nlags="auto")[1]
            v = ("정상" if a < ALPHA and k >= ALPHA else "비정상" if a >= ALPHA and k < ALPHA
                 else "추세·구조변화(둘 다 기각)" if a < ALPHA else "판단 불가(둘 다 기각 못 함)")
            rows.append(dict(특징=f, 계열=nm, ADF_p=a, KPSS_p=k, 판정=v))
    return pd.DataFrame(rows)


def acf_plot(series, title, lags=50, ax=None):
    if ax is None:
        _, ax = plt.subplots(figsize=(8, 2.8))
    plot_acf(pd.Series(series).dropna(), lags=lags, ax=ax, title=title)
    ax.set_xlabel("시차 (사이클)")
    return ax


# ── 결과 저장 (99번 노트북이 모아서 최종표를 만듦) ───────────
def save_result(hid, **kw):
    def conv(o):
        if isinstance(o, (np.floating, np.integer)):
            return o.item()
        return str(o)
    (RESULTS / f"{hid}.json").write_text(json.dumps(kw, ensure_ascii=False, indent=1, default=conv), encoding="utf-8")
    print(f"저장: results/{hid}.json")


def verdict_table(rows):
    """최종 판정 표 출력용"""
    df = pd.DataFrame(rows)
    return df.style.format(precision=4) if hasattr(df, "style") else df
