import { useState } from "react";
import type { CSSProperties } from "react";
import { Icon } from "./Icons";
import { prioritize, sensors, statusText } from "./monitoring";
import type { ComponentState, RigId, SensorId, Series, Severity } from "./monitoring";
import { RigViewport } from "./RigViewport";
import { rigParts, severityColors, degradationTargets } from "./rig-model";
import type { RigView } from "./rig-model";
import { ProvenanceTag, TermHelp } from "./ContextHelp";
import "./rig.css";

function RigStatus({ item }: { item: ComponentState }) {
  return (
    <span className={`rig-status ${item.severity}`}>
      <i />
      {statusText[item.severity]}
    </span>
  );
}

export default function RigMonitor({
  items,
  series,
  virtual,
  onSensor,
  onEquipment,
  rigId,
  rigName,
  cycleId,
  overallSeverity,
  onFactory,
}: {
  items: ComponentState[];
  series: Series;
  virtual: boolean;
  onSensor: (sensor: SensorId) => void;
  onEquipment: () => void;
  rigId: RigId;
  rigName: string;
  cycleId: number;
  overallSeverity: Severity;
  onFactory: () => void;
}) {
  const [selectedId, setSelectedId] = useState(() => prioritize(items)[0].id);
  const [view, setView] = useState<RigView>("cutaway");
  const [activePart, setActivePart] = useState(0);
  const selected = items.find((item) => item.id === selectedId)!;
  const detail = rigParts[selectedId];
  const degraded = degradationTargets[selectedId][selected.severity];
  const sensor = sensors[selected.sensor];
  const value = series[selected.sensor].at(-1)?.toFixed(sensor.decimals);
  const inside = view === "inside";
  const attention = prioritize(items).filter((item) => item.severity !== "normal");

  function select(id: typeof selectedId) {
    setSelectedId(id);
    setActivePart(0);
  }

  return (
    <div className="rig-view">
      <div className="rig-section-title">
        <div>
          <h2>{rigName} 내부 구조</h2>
          <div className="rig-detail-overall">
            <span className={`rig-status ${overallSeverity}`}>
              <i />
              {statusText[overallSeverity]}
            </span>
            <small>종합 상태</small>
          </div>
        </div>
        <div className="rig-legend" aria-label="상태 색상 범례">
          {(["risk", "caution", "normal"] as const).map((severity) => (
            <span key={severity}>
              <i style={{ background: severityColors[severity] }} />
              {statusText[severity]}
            </span>
          ))}
        </div>
      </div>
      <div className="rig-detail-actions">
        <div className="provenance-row">
          <ProvenanceTag kind={virtual ? "simulation" : "uci"} />
          <ProvenanceTag kind="virtual" />
          <ProvenanceTag kind={virtual ? "education" : "label"} />
          <span>
            {rigId} · Cycle {cycleId}
          </span>
        </div>
        <button className="primary-button" onClick={onFactory}>
          <Icon name="back" size={16} /> 전체 공장 보기로 돌아가기
        </button>
      </div>
      <div className="rig-layout">
        <RigViewport
          items={items}
          selected={selectedId}
          view={view}
          activePart={activePart}
          onSelect={select}
          onView={setView}
          onEquipment={onEquipment}
        />
        <aside className="rig-inspector" aria-label="3D 구성품 상세">
          <section className="panel rig-select">
            <div className="rig-panel-title">
              <h3>구성품 선택</h3>
              <span>04 COMPONENTS</span>
            </div>
            <div className="rig-select-list">
              {items.map((item) => (
                <button
                  className="rig-select-row"
                  key={item.id}
                  aria-pressed={item.id === selectedId}
                  onClick={() => select(item.id)}
                >
                  <Icon name={item.id} size={18} />
                  <strong>{item.name}</strong>
                  <RigStatus item={item} />
                  <Icon name="right" size={14} />
                </button>
              ))}
            </div>
          </section>
          <section className="panel rig-detail">
            <div className="rig-detail-header">
              <span
                className="rig-detail-symbol"
                style={{ "--rig-accent": severityColors[selected.severity] } as CSSProperties}
              >
                <Icon name={selected.id} size={21} />
              </span>
              <div>
                <span>
                  {detail.code} / {selected.english}
                </span>
                <h3>{selected.name}</h3>
              </div>
              <RigStatus item={selected} />
            </div>
            <div className="rig-inspector-tabs" aria-label="구성품 상세 탭">
              <button
                aria-pressed={!inside}
                onClick={() => {
                  if (inside) setView("cutaway");
                }}
              >
                상세 정보
              </button>
              <button aria-pressed={inside} onClick={() => setView("inside")}>
                내부 부품
              </button>
            </div>
            {inside ? (
              <div className="rig-part-panel">
                <div className="rig-part-list" aria-label={`${selected.name} 내부 부품`}>
                  {detail.parts.map((part, index) => (
                    <button
                      key={part.name}
                      aria-pressed={index === activePart}
                      onClick={() => setActivePart(index)}
                    >
                      <span>0{index + 1}</span>
                      {part.name}
                      <Icon name="target" size={14} />
                    </button>
                  ))}
                </div>
                <div className="rig-part-explanation">
                  <strong>{detail.parts[activePart].name}</strong>
                  <p>{detail.role}</p>
                  <p>{detail.parts[activePart].desc}</p>
                  <span>
                    선택 부품은 3D 모델에서 강조됩니다. 위치와 열화 표시는 교육용 개념 모델입니다.
                  </span>
                </div>
              </div>
            ) : (
              <div className="rig-detail-body">
                <dl>
                  <div>
                    <dt>
                      <TermHelp term={virtual ? "시나리오 상태" : "UCI 실험 라벨"}>
                        {virtual
                          ? "정상 실험 사이클에 가상 변화를 적용한 교육용 상태입니다."
                          : "실제 유압 시험장치 실험 중 기록된 구성품 상태입니다. 실제 현장 고장이나 손상 위치를 뜻하지 않습니다."}
                      </TermHelp>
                    </dt>
                    <dd>
                      {virtual
                        ? statusText[selected.severity]
                        : `${selected.value} ${selected.unit} · ${statusText[selected.severity]}`}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {virtual ? "시뮬레이션 신호" : "UCI 실험 센서값"} · {sensor.name}
                    </dt>
                    <dd>
                      {value} {sensor.unit}
                    </dd>
                  </div>
                </dl>
                <div className={`rig-diagnosis ${selected.severity}`}>
                  <strong>실험 상태 해석 · 교육용 안내</strong>
                  <p>
                    {selected.severity === "normal"
                      ? "이 사이클의 실험 라벨은 기준 상태입니다. 다른 사이클과 센서 변화를 비교하세요."
                      : selected.severity === "caution"
                        ? `${selected.name}의 실험 라벨이 주의 상태입니다. 연결 센서와 다른 사이클을 비교해 보세요.`
                        : `${selected.name}의 실험 라벨이 위험 상태로 분류되었습니다. 교육용 점검 순서에서 먼저 확인하세요.`}{" "}
                    실제 현장 진단이나 원인 확정은 아닙니다.
                  </p>
                  <span>
                    {virtual ? "교육용 확인 항목" : "권장 확인"}:{" "}
                    {selected.severity === "normal" ? "정기 상태 비교" : selected.action}
                  </span>
                </div>
                <details className="rig-degradation-note">
                  <summary>교육용 열화 표현</summary>
                  <TermHelp term="열화">
                    구성품의 성능이나 상태 저하를 가리킵니다. 강조 부위는 실험 라벨에 연결한 교육용
                    메커니즘 예시이지, 실제 손상 위치 측정값이 아닙니다.
                  </TermHelp>
                  <p>
                    {degraded.labels.length
                      ? degraded.labels.join(" · ")
                      : "이 실험 라벨에서 강조하는 열화 부위가 없습니다."}
                  </p>
                </details>
                <button className="rig-detail-link" onClick={() => setView("inside")}>
                  <Icon name="layers" size={15} /> 내부 구조 보기 <Icon name="right" size={14} />
                </button>
                <button className="rig-detail-link" onClick={() => onSensor(selected.sensor)}>
                  <Icon name="chart" size={15} /> 관련 센서 그래프 보기{" "}
                  <Icon name="right" size={14} />
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
      <section className="panel rig-priority-panel">
        <div className="rig-panel-title">
          <h3>점검 우선순위</h3>
          <span>{rigId} · 실험 라벨 기준</span>
        </div>
        {attention.length ? (
          <ol className="rig-priority-list">
            {attention.map((item, index) => (
              <li key={item.id}>
                <span className={`rank ${item.severity}`}>0{index + 1}</span>
                <strong>{item.name}</strong>
                <small>{item.action}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">현재 사이클에는 주의 또는 위험 라벨이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
