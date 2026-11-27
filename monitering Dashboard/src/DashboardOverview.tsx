import { useState } from "react";
import { Icon } from "./Icons";
import { SensorChart } from "./SensorChart";
import { sensors, sourceUrl, statusText } from "./monitoring";
import type { ComponentId, RigData, RigId, SensorId, Severity } from "./monitoring";
import { TermHelp } from "./ContextHelp";

const formatCycle = (cycle: number) => String(cycle).padStart(4, "0");
const sensorOrder = ["PS1", "FS1", "TS1", "VS1"] as const;

function StatusBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`ops-status ${severity}`}>
      <i aria-hidden="true" />
      {statusText[severity]}
    </span>
  );
}

function Metric({
  label,
  value,
  unit,
  icon,
  tone = "blue",
  detail,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: "layers" | "alert" | "activity" | "pump" | "cooler";
  tone?: "blue" | "risk" | "caution" | "normal" | "violet";
  detail?: string;
}) {
  return (
    <div className={`ops-metric ${tone}`}>
      <div className="ops-metric-label">
        <Icon name={icon} size={18} />
        <span>{label}</span>
      </div>
      <p className="ops-metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </p>
      {detail && <span className="ops-metric-detail">{detail}</span>}
    </div>
  );
}

export function DashboardOverview({
  rigs,
  onRig,
  onAlerts,
  onComponent,
}: {
  rigs: RigData[];
  onRig: (id: RigId) => void;
  onAlerts: () => void;
  onComponent: (id: ComponentId, cycleId: number) => void;
}) {
  const [selectedRigId, setSelectedRigId] = useState<RigId>(
    () => rigs.find(({ overallSeverity }) => overallSeverity === "risk")?.rigId ?? rigs[0]?.rigId ?? "HYD-01",
  );
  const [selectedSensor, setSelectedSensor] = useState<SensorId>("PS1");
  const selectedRig = rigs.find(({ rigId }) => rigId === selectedRigId) ?? rigs[0];
  if (!selectedRig) return null;

  const counts = {
    risk: rigs.filter(({ overallSeverity }) => overallSeverity === "risk").length,
    caution: rigs.filter(({ overallSeverity }) => overallSeverity === "caution").length,
    normal: rigs.filter(({ overallSeverity }) => overallSeverity === "normal").length,
  };
  const alertCount = rigs.reduce(
    (sum, rig) => sum + rig.components.filter(({ severity }) => severity !== "normal").length,
    0,
  );
  const attention = selectedRig.priority.filter(({ severity }) => severity !== "normal");
  const eventRows = rigs
    .flatMap((rig) =>
      rig.components
        .filter(({ severity }) => severity !== "normal")
        .map((item) => ({ rig, item })),
    )
    .sort(
      (a, b) =>
        ({ risk: 0, caution: 1, normal: 2 })[a.item.severity] -
        ({ risk: 0, caution: 1, normal: 2 })[b.item.severity],
    )
    .slice(0, 5);

  function latest(sensorId: (typeof sensorOrder)[number]) {
    const sensor = sensors[sensorId];
    return selectedRig.series[sensorId].at(-1)?.toFixed(sensor.decimals) ?? "—";
  }

  return (
    <div className="page-content home-content ops-overview">
      <section className="ops-summary" aria-label="설비 현황 요약">
        <div className="ops-equipment-brief">
          <span className="ops-equipment-mark" aria-hidden="true">
            <Icon name="cube" size={28} />
          </span>
          <div className="ops-brief-copy">
            <h2>유압 설비군 <span>/ UCI 실험 데이터</span></h2>
            <dl>
              <div><dt>가상 설비</dt><dd>4대 · HYD-01~04</dd></div>
              <div><dt>선택 설비</dt><dd>{selectedRig.rigId} · Cycle {formatCycle(selectedRig.cycleId)}</dd></div>
              <div><dt>데이터 구분</dt><dd>60초 실험 사이클</dd></div>
            </dl>
          </div>
          <a className="ops-source-link" href={sourceUrl} target="_blank" rel="noreferrer">
            UCI 출처 <Icon name="external" size={14} />
          </a>
        </div>
        <div className="ops-metrics" aria-label="핵심 지표">
          <Metric label="전체 설비" value={rigs.length} unit="대" icon="layers" />
          <Metric label="위험 설비" value={counts.risk} unit="대" icon="alert" tone="risk" />
          <Metric label="주의 설비" value={counts.caution} unit="대" icon="alert" tone="caution" />
          <Metric label="정상 설비" value={counts.normal} unit="대" icon="layers" tone="normal" />
          <Metric label="비정상 라벨" value={alertCount} unit="건" icon="activity" tone="violet" detail="4개 배정 사이클 합계" />
          <Metric label="시스템 압력 · PS1" value={latest("PS1")} unit="bar" icon="pump" detail={selectedRig.rigId} />
          <Metric label="유량 · FS1" value={latest("FS1")} unit="L/min" icon="activity" detail={selectedRig.rigId} />
          <Metric label="오일 온도 · TS1" value={latest("TS1")} unit="°C" icon="cooler" detail={selectedRig.rigId} />
        </div>
      </section>

      <div className="ops-grid ops-analysis-grid">
        <SensorChart
          series={selectedRig.series}
          sensor={selectedSensor}
          onSensor={setSelectedSensor}
          cycle={selectedRig.cycleId}
          title="센서 변화 추이"
          subtitle={`${selectedRig.rigId} · Cycle ${formatCycle(selectedRig.cycleId)} · 60초 실험 구간`}
          availableSensors={[...sensorOrder]}
        />
        <section className="panel ops-panel ops-diagnosis" aria-labelledby="ops-diagnosis-title">
          <div className="ops-panel-heading">
            <div>
              <h2 id="ops-diagnosis-title">이상 상태 분석 및 점검 근거</h2>
              <p>{selectedRig.rigId} · 실험 라벨과 관련 센서 측정값</p>
            </div>
            <TermHelp term="실험 라벨">
              UCI 시험장치에 설정된 상태입니다. 실제 현장의 고장 원인이나 손상 위치를 확정하지 않습니다.
            </TermHelp>
          </div>
          <ol className="ops-diagnosis-list">
            {attention.map((item) => {
              const sensor = sensors[item.sensor];
              const value = selectedRig.series[item.sensor].at(-1);
              return (
                <li key={item.id}>
                  <button className="ops-diagnosis-row" onClick={() => onComponent(item.id, selectedRig.cycleId)}>
                    <span className={`ops-diagnosis-rank ${item.severity}`}>
                      <Icon name={item.id} size={18} />
                    </span>
                    <span className="ops-diagnosis-copy">
                      <strong>{item.name}</strong>
                      <small>{item.description} · {item.action}</small>
                      <span>{sensor.name} ({item.sensor}) <b>{value?.toFixed(sensor.decimals)} {sensor.unit}</b></span>
                    </span>
                    <StatusBadge severity={item.severity} />
                    <Icon name="right" size={16} />
                  </button>
                </li>
              );
            })}
          </ol>
          {!attention.length && <p className="ops-empty">이 Cycle에는 주의 또는 위험 라벨이 없습니다.</p>}
          <p className="ops-panel-footnote">상태 등급은 해당 Cycle의 UCI 구성품 라벨 기준입니다.</p>
        </section>
      </div>

      <div className="ops-grid ops-record-grid">
        <section className="panel ops-panel ops-events" aria-labelledby="ops-events-title">
          <div className="ops-panel-heading">
            <div>
              <h2 id="ops-events-title">현재 실험 상태 알림</h2>
              <p>4개 가상 설비에 배정된 사이클의 비정상 구성품 라벨</p>
            </div>
            <button className="ops-text-link" onClick={onAlerts}>알림 센터 <Icon name="forward" size={15} /></button>
          </div>
          <p className="ops-data-note">UCI 샘플에는 상태 변화 시각 이력이 없어 실제 발생 시각 대신 Cycle 번호를 표시합니다.</p>
          <div className="ops-table-wrap" role="region" tabIndex={0} aria-label="표를 좌우로 이동하여 추가 열 확인">
            <table className="ops-table">
              <thead><tr><th>실험 사이클</th><th>설비</th><th>구성품</th><th>실험 상태</th><th>등급</th></tr></thead>
              <tbody>
                {eventRows.map(({ rig, item }) => (
                  <tr key={`${rig.rigId}-${item.id}`}>
                    <td>Cycle {formatCycle(rig.cycleId)}</td>
                    <td><button className="ops-table-link" onClick={() => onRig(rig.rigId)}>{rig.rigId}</button></td>
                    <td><strong>{item.name}</strong><small>{item.description}</small></td>
                    <td>{item.severity === "normal" ? "정기 상태" : item.action}</td>
                    <td><StatusBadge severity={item.severity} /></td>
                  </tr>
                ))}
                {!eventRows.length && <tr><td colSpan={5}>현재 배정된 샘플에 비정상 라벨이 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel ops-panel ops-rig-panel" aria-labelledby="ops-rig-title">
          <div className="ops-panel-heading">
            <div>
              <h2 id="ops-rig-title">설비별 상태 및 주요 센서값</h2>
              <p>각 가상 설비에 배정된 UCI 실험 사이클</p>
            </div>
            <TermHelp term="실험 센서값">
              수치는 실제 유압 시험장치에서 측정된 UCI 데이터이며, IoT 연결 상태나 현장 실시간 값이 아닙니다.
            </TermHelp>
          </div>
          <div className="ops-table-wrap" role="region" tabIndex={0} aria-label="표를 좌우로 이동하여 추가 열 확인">
            <table className="ops-table ops-rig-table">
              <thead><tr><th>설비</th><th>상태</th><th>압력<br />PS1</th><th>유량<br />FS1</th><th>온도<br />TS1</th><th>진동<br />VS1</th><th><span className="sr-only">상세</span></th></tr></thead>
              <tbody>
                {rigs.map((rig) => (
                  <tr key={rig.rigId} className={rig.rigId === selectedRigId ? "selected" : ""}>
                    <td><button className="ops-table-link" aria-pressed={rig.rigId === selectedRigId} onClick={() => setSelectedRigId(rig.rigId)}>{rig.rigId}</button><small>Cycle {formatCycle(rig.cycleId)}</small></td>
                    <td><StatusBadge severity={rig.overallSeverity} /></td>
                    {sensorOrder.map((sensorId) => {
                      const sensor = sensors[sensorId];
                      const value = rig.series[sensorId].at(-1);
                      return <td className="ops-number" key={sensorId}>{value?.toFixed(sensor.decimals)} <small>{sensor.unit}</small></td>;
                    })}
                    <td><button className="ops-open-rig" onClick={() => onRig(rig.rigId)} aria-label={`${rig.rigId} 3D 상세 보기`}><Icon name="right" size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ops-panel-footnote">행을 선택하면 상단 센서 추이와 핵심 측정값이 해당 설비로 전환됩니다.</p>
        </section>
      </div>
    </div>
  );
}
