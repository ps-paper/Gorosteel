"""Extract dashboard samples and fit a small exploratory k-NN classifier.

Usage: python scripts/prepare_uci.py path/to/uci-hydraulic-systems.zip
"""

import json
import math
import statistics
import sys
import zipfile
from pathlib import Path


CYCLES = (1696, 1056, 1788, 1839)
CHANNELS = {"PS1": 100, "PS2": 100, "FS1": 10, "TS1": 1, "VS1": 1, "CE": 1, "EPS1": 100}
MODELS = (
    ("TS1", "CE"),
    ("PS2.switch", "FS1.switch"),
    ("PS1.steady", "FS1.steady", "EPS1.steady"),
    ("PS1.switch", "PS2.switch", "EPS1.switch"),
)


def extract_features(values, rate):
    seconds = [sum(values[t : t + rate]) / rate for t in range(0, len(values), rate)]
    step = max(rate // 10, 1)
    intervals = (0, 2, 7, 8, 9, 19, 20, 29, 30, 39, 40, 49, 50)
    return seconds, {
        "full": [statistics.mean(seconds), min(seconds), max(seconds)],
        "steady": [seconds[t] for t in (12, 18, 23, 27, 33, 37, 43, 47, 53, 58)],
        "switch": [
            sum(values[t : t + step]) / step
            for s in intervals
            for t in range(s * rate, (s + 1) * rate, step)
        ],
    }


def predict(features, profiles, targets, index):
    train = [
        i for i, profile in profiles.items()
        if profile[:4] not in targets and profile[4] == 0
    ]
    columns = list(zip(*(features[i] for i in train)))
    means = [statistics.mean(column) for column in columns]
    scales = [max(statistics.pstdev(column), 0.01) for column in columns]

    def normalize(row):
        return [(value - mean) / scale for value, mean, scale in zip(row, means, scales)]

    normalized = {i: normalize(features[i]) for i in train}
    result = {}
    for cycle in CYCLES:
        sample = normalize(features[cycle])
        neighbors = sorted(train, key=lambda i: math.dist(sample, normalized[i]))[:7]
        result[cycle] = statistics.mode(profiles[i][index] for i in neighbors)
    return result


def main():
    series = {i: {} for i in CYCLES}
    with zipfile.ZipFile(sys.argv[1]) as archive:
        profiles = {
            i: tuple(map(int, line.split()))
            for i, line in enumerate(archive.read("profile.txt").splitlines(), 1)
        }
        eligible = {i for i, p in profiles.items() if p[4] == 0} | set(CYCLES)
        features = {i: {} for i in eligible}
        for sensor, rate in CHANNELS.items():
            with archive.open(f"{sensor}.txt") as source:
                for i, line in enumerate(source, 1):
                    if i not in eligible:
                        continue
                    seconds, parts = extract_features(list(map(float, line.split())), rate)
                    features[i][sensor] = parts["full"]
                    for name in ("steady", "switch"):
                        features[i][f"{sensor}.{name}"] = parts[name]
                    if i in CYCLES and sensor != "EPS1":
                        series[i][sensor] = [round(value, 3) for value in seconds]

    targets = {profiles[i][:4] for i in CYCLES}
    predictions = []
    for j, names in enumerate(MODELS):
        samples = {i: [v for name in names for v in row[name]] for i, row in features.items()}
        predictions.append(predict(samples, profiles, targets, j))
    result = [
        {
            "id": i,
            "labels": profiles[i][:4],
            "predicted": [p[i] for p in predictions],
            "series": series[i],
        }
        for i in CYCLES
    ]
    path = Path(__file__).resolve().parents[1] / "src" / "uci-samples.json"
    path.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    for cycle in result:
        print(cycle["id"], cycle["labels"], cycle["predicted"])


if __name__ == "__main__":
    main()
