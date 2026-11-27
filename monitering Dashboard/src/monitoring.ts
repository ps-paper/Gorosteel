import samples from "./uci-samples.json";

export const sourceUrl =
  "https://archive.ics.uci.edu/dataset/447/condition+monitoring+of+hydraulic+systems";

export const equipment = [
  {
    id: "cooler",
    name: "냉각기",
    english: "Cooler",
    metric: "냉각 효율 등급",
    unit: "%",
    sensor: "TS1",
    baseline: 100,
    caution: 20,
    action: "냉각 팬 및 열교환기 확인",
    tone: "blue",
    order: 2,
  },
  {
    id: "valve",
    name: "밸브",
    english: "Valve",
    metric: "전환 성능 등급",
    unit: "%",
    sensor: "PS2",
    baseline: 100,
    caution: 90,
    action: "밸브 전환 응답 점검",
    tone: "purple",
    order: 1,
  },
  {
    id: "pump",
    name: "펌프",
    english: "Pump",
    metric: "내부 누설 등급",
    unit: "단계",
    sensor: "PS1",
    baseline: 0,
    caution: 1,
    action: "내부 누설 및 씰 상태 확인",
    tone: "amber",
    order: 0,
  },
  {
    id: "accumulator",
    name: "축압기",
    english: "Accumulator",
    metric: "충전 압력 등급",
    unit: "bar",
    sensor: "PS1",
    baseline: 130,
    caution: 115,
    action: "충전 압력 확인",
    tone: "green",
    order: 3,
  },
] as const;

export const sensors = {
  PS1: { name: "시스템 압력", unit: "bar", decimals: 1 },
  PS2: { name: "라인 압력", unit: "bar", decimals: 1 },
  FS1: { name: "유량", unit: "L/min", decimals: 2 },
  TS1: { name: "오일 온도", unit: "°C", decimals: 2 },
  VS1: { name: "진동", unit: "mm/s", decimals: 2 },
  CE: { name: "냉각 효율", unit: "%", decimals: 1 },
} as const;

export type SensorId = keyof typeof sensors;
export type ComponentId = (typeof equipment)[number]["id"];
export type Severity = "normal" | "caution" | "risk";
export type Mode = "measured" | "simulation";
export type Series = Record<SensorId, number[]>;

export const cycles = samples;
export const statusText: Record<Severity, string> = {
  normal: "정상",
  caution: "주의",
  risk: "위험",
};

const statusRank: Record<Severity, number> = { risk: 0, caution: 1, normal: 2 };
const conditionText: Record<ComponentId, Record<number, string>> = {
  cooler: { 100: "정상 냉각 효율", 20: "냉각 효율 저하", 3: "냉각 기능 심각 저하" },
  valve: {
    100: "정상 전환 응답",
    90: "전환 응답 지연",
    80: "전환 응답 심각 지연",
    73: "전환 기능 심각 저하",
  },
  pump: { 0: "내부 누설 없음", 1: "경미한 내부 누설", 2: "심각한 내부 누설" },
  accumulator: {
    130: "정상 충전 압력",
    115: "충전 압력 저하",
    100: "충전 압력 심각 저하",
    90: "축압 기능 심각 저하",
  },
};

export function classify(item: (typeof equipment)[number], value: number): Severity {
  return value === item.baseline ? "normal" : value === item.caution ? "caution" : "risk";
}

export function getComponents(values: number[]) {
  return equipment.map((item, index) => ({
    ...item,
    value: values[index],
    severity: classify(item, values[index]),
    description: conditionText[item.id][values[index]],
  }));
}

export type ComponentState = ReturnType<typeof getComponents>[number];

export function prioritize(components: ComponentState[]) {
  return [...components].sort(
    (a, b) => statusRank[a.severity] - statusRank[b.severity] || a.order - b.order,
  );
}

export type RigId = "HYD-01" | "HYD-02" | "HYD-03" | "HYD-04";
export type RigData = {
  rigId: RigId;
  rigName: string;
  cycleId: number;
  components: ComponentState[];
  overallSeverity: Severity;
  sourceMode: "uci-demo";
  series: Series;
  priority: ComponentState[];
};

const rigSeed: Array<{ rigId: RigId; rigName: string; cycleId: number }> = [
  { rigId: "HYD-01", rigName: "유압 설비 1호기", cycleId: 1788 },
  { rigId: "HYD-02", rigName: "유압 설비 2호기", cycleId: 1056 },
  { rigId: "HYD-03", rigName: "유압 설비 3호기", cycleId: 1696 },
  { rigId: "HYD-04", rigName: "유압 설비 4호기", cycleId: 1839 },
];

export function loadRigData(cycleOverrides: Partial<Record<RigId, number>> = {}): RigData[] {
  return rigSeed.map((seed) => {
    const cycleId = cycleOverrides[seed.rigId] ?? seed.cycleId;
    const cycle = cycles.find((sample) => sample.id === cycleId) ?? cycles[0];
    const components = getComponents(cycle.labels);
    return {
      ...seed,
      cycleId: cycle.id,
      components,
      overallSeverity: components.reduce<Severity>(
        (highest, item) =>
          ({ risk: 0, caution: 1, normal: 2 })[item.severity] <
          { risk: 0, caution: 1, normal: 2 }[highest]
            ? item.severity
            : highest,
        "normal",
      ),
      sourceMode: "uci-demo",
      series: cycle.series,
      priority: prioritize(components),
    };
  });
}

export const scenarios = [
  {
    id: "leak",
    name: "펌프 내부 누설",
    subtitle: "압력 하락과 유량 저하로 누설이 진행되는 가상 상황입니다.",
    primary: "pump",
    sensor: "PS1",
    onset: 30,
    warning: 40,
    risk: 51,
    labels: [100, 100, 2, 115],
    deltas: { PS1: -31, PS2: -24, FS1: -2.2, TS1: 0.6, VS1: 0.28, CE: -1.3 },
  },
  {
    id: "heat",
    name: "냉각 효율 저하",
    subtitle: "냉각 성능이 떨어지면서 오일 온도가 상승하는 가상 상황입니다.",
    primary: "cooler",
    sensor: "TS1",
    onset: 24,
    warning: 36,
    risk: 48,
    labels: [3, 100, 0, 115],
    deltas: { PS1: -5, PS2: -3, FS1: -0.3, TS1: 8, VS1: 0.06, CE: -14 },
  },
  {
    id: "charge",
    name: "축압기 압력 손실",
    subtitle: "충전 압력 손실로 압력 변동이 커지는 가상 상황입니다.",
    primary: "accumulator",
    sensor: "PS1",
    onset: 22,
    warning: 34,
    risk: 46,
    labels: [100, 80, 0, 90],
    deltas: { PS1: -21, PS2: -16, FS1: -1.4, TS1: 0.3, VS1: 0.17, CE: -0.4 },
  },
] as const;

export type Scenario = (typeof scenarios)[number];

export function simulate(scenario: Scenario): Series {
  const baseline = cycles[2].series;
  return Object.fromEntries(
    (Object.keys(sensors) as SensorId[]).map((sensor) => [
      sensor,
      baseline[sensor].map((value, t) => {
        const progress = Math.max(0, (t - scenario.onset) / (59 - scenario.onset));
        return Math.max(0, value + scenario.deltas[sensor] * progress ** 1.3);
      }),
    ]),
  ) as Series;
}
