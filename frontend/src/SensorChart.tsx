import { useId, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { Asset, Icon } from "./Icons";
import { sensors } from "./monitoring";
import type { Scenario, SensorId, Series } from "./monitoring";

export function SelectControl({
  value,
  onChange,
  label,
  children,
}: {
  value: string | number;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="select-control">
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <Icon name="chevron" size={15} />
    </span>
  );
}

const ranges = [15, 30, 60] as const;
type Range = (typeof ranges)[number];
const width = 800;
const height = 220;

function scale(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max * 0.1 || 1;
  const raw = (span * 1.15) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= raw)! * magnitude;
  const low = Math.max(0, Math.floor((min - span * 0.1) / step) * step);
  const high = Math.ceil((max + span * 0.1) / step) * step;
  const levels = Math.round((high - low) / step);
  return {
    low,
    high,
    ticks: Array.from({ length: levels + 1 }, (_, index) => high - step * index),
  };
}

export function SensorChart({
  series,
  sensor,
  onSensor,
  cycle,
  scenario,
  title = "센서 시계열",
  subtitle,
  availableSensors,
}: {
  series: Series;
  sensor: SensorId;
  onSensor: (sensor: SensorId) => void;
  cycle: number;
  scenario?: Scenario;
  title?: string;
  subtitle?: string;
  availableSensors?: SensorId[];
}) {
  const [range, setRange] = useState<Range>(60);
  const [point, setPoint] = useState<number | null>(null);
  const [showTip, setShowTip] = useState(false);
  const gradient = useId();
  const { name, unit, decimals } = sensors[sensor];
  const sensorOptions = availableSensors ?? (Object.keys(sensors) as SensorId[]);
  const start = 60 - range;
  const values = series[sensor].slice(start);
  const { low, high, ticks } = scale(values);
  const x = (index: number) => (index / range) * width;
  const y = (value: number) => ((high - value) / (high - low)) * height;
  const dots = values.map((value, index) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`);
  const line = `M ${dots.join(" L ")}`;
  const area = `${line} L ${x(values.length - 1)},${height} L 0,${height} Z`;
  const active = Math.min(point ?? Math.floor(range / 2), values.length - 1);
  const px = (x(active) / width) * 100;
  const py = (y(values[active]) / height) * 100;
  const time = start + active;
  const markers =
    range === 60
      ? [0, 10, 20, 30, 40, 50, 60]
      : range === 30
        ? [0, 5, 10, 15, 20, 25, 30]
        : [0, 3, 6, 9, 12, 15];
  const warning = scenario && scenario.warning >= start ? scenario.warning - start : undefined;
  const pointStyles = {
    "--point-x": `${px}%`,
    "--point-y": `${py}%`,
  } as CSSProperties;

  function inspect(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPoint(
      Math.max(
        0,
        Math.min(range - 1, Math.round(((event.clientX - bounds.left) / bounds.width) * range)),
      ),
    );
    setShowTip(true);
  }

  return (
    <section
      className={`panel sensor-panel ${scenario ? "sensor-sim" : ""}`}
      id="sensors"
      aria-labelledby="sensors-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="sensors-title">{title}</h2>
          <p>{subtitle ?? (scenario ? "시나리오에서 생성한 가상 신호" : "선택한 사이클의 센서 측정값")}</p>
        </div>
        <SelectControl
          label="센서 선택"
          value={sensor}
          onChange={(value) => {
            onSensor(value as SensorId);
            setPoint(null);
            setShowTip(false);
          }}
        >
          {sensorOptions.map((id) => (
            <option key={id} value={id}>
              {id} · {sensors[id].name}
            </option>
          ))}
        </SelectControl>
      </div>
      <div className="sensor-reading">
        <div>
          <p className="sensor-label">
            <span />
            {name} <span className="sensor-label-divider">/</span> {sensor}
          </p>
          <p className="reading-value">
            {values.at(-1)!.toFixed(decimals)} <span>{unit}</span>
          </p>
        </div>
        <div className="range-selector" aria-label="표시 구간">
          {ranges.map((seconds) => (
            <button
              key={seconds}
              aria-pressed={range === seconds}
              className={range === seconds ? "selected" : ""}
              onClick={() => {
                setRange(seconds);
                setPoint(null);
                setShowTip(false);
              }}
            >
              {seconds}초
            </button>
          ))}
        </div>
      </div>

      <div className="chart-layout">
        <span className="y-unit">{unit}</span>
        <div className="y-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ top: `${(y(tick) / height) * 100}%` }}>
              {Number(tick.toFixed(3))}
            </span>
          ))}
        </div>
        <div
          className="chart-plot"
          style={pointStyles}
          tabIndex={0}
          aria-label={`${name} 그래프. 좌우 화살표로 초별 값을 확인할 수 있습니다.`}
          onPointerMove={inspect}
          onPointerDown={inspect}
          onPointerLeave={() => {
            setPoint(null);
            setShowTip(false);
          }}
          onFocus={() => setShowTip(true)}
          onBlur={() => setShowTip(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setShowTip(false);
              return;
            }
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            setShowTip(true);
            if (event.key === "Home") setPoint(0);
            else if (event.key === "End") setPoint(range - 1);
            else
              setPoint(
                Math.max(0, Math.min(range - 1, active + (event.key === "ArrowRight" ? 1 : -1))),
              );
          }}
        >
          <svg
            className="chart-svg"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity=".18" />
                <stop offset="100%" stopColor="currentColor" stopOpacity=".015" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <line
                className="gridline"
                key={tick}
                x1="0"
                y1={y(tick)}
                x2={width}
                y2={y(tick)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {warning !== undefined && (
              <>
                <rect
                  x={x(warning)}
                  y="0"
                  width={width - x(warning)}
                  height={height}
                  fill="currentColor"
                  opacity=".06"
                />
                <line
                  x1={x(warning)}
                  x2={x(warning)}
                  y1="0"
                  y2={height}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  opacity=".55"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
            <path fill={`url(#${gradient})`} d={area} />
            <path
              d={line}
              stroke="currentColor"
              fill="none"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {showTip && (
            <>
              <span className="chart-crosshair" aria-hidden="true" />
              <span className="chart-point" aria-hidden="true" />
              <div className={`chart-tooltip ${py < 40 ? "tooltip-below" : ""}`} aria-hidden="true">
                <Asset name="tooltip" className="tooltip-background" />
                <div className="tooltip-content">
                  <span>사이클 경과 · {time}초</span>
                  <div>
                    <i />
                    {sensor}{" "}
                    <strong>
                      {values[active].toFixed(decimals)} {unit}
                    </strong>
                  </div>
                </div>
              </div>
              <output className="sr-only" aria-live="polite">
                {time}초: {values[active].toFixed(decimals)} {unit}
              </output>
            </>
          )}
        </div>
        <div className="x-axis" aria-hidden="true">
          {markers.map((marker) => (
            <span key={marker} style={{ left: `${(marker / range) * 100}%` }}>
              {start + marker}초
            </span>
          ))}
        </div>
      </div>
      <div className="chart-footer">
        <span>
          <i />
          {scenario ? "가상 센서 신호" : "실측 센서 신호"}
        </span>
        <span>
          {scenario
            ? `가상 경보 ${scenario.warning}초`
            : `Cycle ${String(cycle).padStart(4, "0")} · 1초 단위 평균`}
        </span>
      </div>
    </section>
  );
}
