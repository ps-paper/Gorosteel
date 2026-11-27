import { Component, lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  createBrowserRouter,
  Navigate,
  NavLink,
  Outlet,
  RouterProvider,
  useLocation,
  useMatches,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router";
import { Asset, Icon } from "./Icons";
import { DashboardOverview } from "./DashboardOverview";
import "./rig.css";
import { SelectControl, SensorChart } from "./SensorChart";
import {
  cycles,
  getComponents,
  loadRigData,
  prioritize,
  scenarios,
  simulate,
  sensors,
  sourceUrl,
  statusText,
} from "./monitoring";
import { ProvenanceTag, TermHelp } from "./ContextHelp";
import type {
  ComponentId,
  ComponentState,
  Mode,
  Scenario,
  SensorId,
  Series,
  Severity,
  RigData,
  RigId,
} from "./monitoring";

const RigMonitor = lazy(() => import("./RigMonitor"));
const FactoryViewport = lazy(() =>
  import("./FactoryViewport").then((module) => ({ default: module.FactoryViewport })),
);

const navigation = [
  {
    id: "overview",
    name: "대시보드",
    path: "/",
    icon: "home",
    description: "유압 시험장치의 운영 상태와 주요 점검 항목을 한눈에 확인하세요.",
  },
  {
    id: "rig",
    name: "설비 3D 모니터링",
    path: "/rig",
    icon: "cube",
    description: "리그를 회전하고 구성품을 선택해 상태와 내부 부품을 확인하세요.",
  },
  {
    id: "equipment",
    name: "구성품 상태",
    path: "/equipment",
    icon: "components",
    description: "구성품별 실험 등급, AI 분류와 권장 점검 순서를 확인하세요.",
  },
  {
    id: "sensors",
    name: "센서 시계열",
    path: "/sensors",
    icon: "chart",
    description: "센서를 선택하고 사이클 안에서 측정값 변화를 살펴보세요.",
  },
  {
    id: "alerts",
    name: "알림 센터",
    path: "/alerts",
    icon: "alerts",
    description: "정상·주의·위험 등급으로 분류된 구성품 상태 기록입니다.",
  },
] as const;

type Section = (typeof navigation)[number]["id"] | "simulation" | "rigDetail";
type AlertFilter = "all" | Severity;
const filters = ["all", "risk", "caution", "normal"] as const;
const formatCycle = (cycle: number) => String(cycle).padStart(4, "0");

class ThreeDErrorBoundary extends Component<
  { children: React.ReactNode; onEquipment: () => void },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  retry = () => this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));

  render() {
    if (this.state.failed) {
      return (
        <section className="viewer-error" role="alert">
          <div>
            <h2>3D 설비 화면을 불러오지 못했습니다</h2>
            <p>재시도하거나 구성품 상태 목록에서 진단 결과를 확인할 수 있습니다.</p>
          </div>
          <div className="viewer-error-actions">
            <button className="primary-button" onClick={this.retry}>
              3D 화면 재시도
            </button>
            <button className="secondary-button" onClick={this.props.onEquipment}>
              구성품 상태 목록 보기
            </button>
          </div>
        </section>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}

function Badge({ severity }: { severity: Severity }) {
  return (
    <span className={`status-badge ${severity}`}>
      <i />
      {statusText[severity]}
    </span>
  );
}

function Sidebar({
  pathFor,
  alerts,
  openInfo,
}: {
  pathFor: (section: Section) => string;
  alerts: number;
  openInfo: () => void;
}) {
  return (
    <aside className="sidebar">
      <NavLink className="brand" to={pathFor("overview")} aria-label="Gorosteel 대시보드">
        <Asset name="logo" />
        <span>Gorosteel</span>
      </NavLink>
      <p className="sidebar-caption">AI EQUIPMENT MONITORING</p>
      <nav className="side-navigation" aria-label="주 메뉴">
        <div className="nav-group">
          <p className="nav-label">모니터링</p>
          {navigation.map(({ id, name, icon }) => (
            <NavLink
              key={id}
              className={({ isActive }) => `nav-item ${isActive ? "nav-active" : ""}`}
              to={pathFor(id)}
              end={id !== "rig"}
              title={name}
            >
              {icon === "cube" ? <Icon name="cube" size={21} /> : <Asset name={icon} />}
              <span>{name}</span>
              {id === "alerts" && alerts > 0 && <small className="nav-count">{alerts}</small>}
            </NavLink>
          ))}
        </div>
        <div className="nav-group analysis-navigation">
          <p className="nav-label">분석 도구</p>
          <NavLink
            className={({ isActive }) => `nav-item ${isActive ? "nav-active" : ""}`}
            to={pathFor("simulation")}
            title="조기경보 시뮬레이션"
          >
            <span className="nav-layered-icon">
              <Asset name="shield" />
              <Asset name="shieldCheck" className="shield-check" />
            </span>
            <span>조기경보 시뮬레이션</span>
          </NavLink>
        </div>
      </nav>
      <div className="sidebar-footer">
        <div className="device-label">
          <span className="device-icon">
            <Icon name="activity" size={16} />
          </span>
          <div>
            <strong>유압 시험장치</strong>
            <span>UCI Hydraulic Systems</span>
          </div>
        </div>
        <button className="nav-item footer-link" onClick={openInfo} title="데이터 안내">
          <Asset name="settings" />
          <span>데이터 안내</span>
        </button>
      </div>
    </aside>
  );
}

function ComponentCard({ item, onOpen }: { item: ComponentState; onOpen: () => void }) {
  return (
    <button
      className="panel component-card"
      onClick={onOpen}
      aria-label={`${item.name}, ${statusText[item.severity]}, 상세 보기`}
    >
      <div className="component-card-top">
        <span className={`component-icon tone-${item.tone}`}>
          <Icon name={item.id} size={21} />
        </span>
        <Badge severity={item.severity} />
      </div>
      <div className="component-name">
        <h3>{item.name}</h3>
        <span>{item.english}</span>
      </div>
      <div className="component-card-bottom">
        <div>
          <span className="metric-label">{item.metric}</span>
          <p>
            {item.value}
            <small>{item.unit}</small>
          </p>
        </div>
        <span className="detail-chevron">
          <Asset name="arrow" />
        </span>
      </div>
    </button>
  );
}

function PriorityPanel({
  items,
  onItem,
  onAlerts,
  scenario,
}: {
  items: ComponentState[];
  onItem: (id: ComponentId) => void;
  onAlerts: () => void;
  scenario?: Scenario;
}) {
  const prioritized = prioritize(items);
  const attention = prioritized.filter((item) => item.severity !== "normal");
  return (
    <section className="panel priority-panel" aria-labelledby="priority-title">
      <div className="panel-heading">
        <div>
          <h2 id="priority-title">
            <TermHelp term="점검 우선순위">
              실험 라벨에 따라 구성품을 정렬한 교육용 확인 순서입니다. 현장 운전 위험도를 대신하지
              않습니다.
            </TermHelp>
          </h2>
          <p>{scenario ? "가상 시나리오의 점검 순서" : "현재 상태에 따른 권장 점검 순서"}</p>
        </div>
        <span className="priority-count">{attention.length}건 점검</span>
      </div>
      <ol className="priority-list">
        {prioritized.map((item, index) => (
          <li key={item.id}>
            <button className="priority-row" onClick={() => onItem(item.id)}>
              <span className={`rank ${item.severity}`}>{String(index + 1).padStart(2, "0")}</span>
              <span className="priority-copy">
                <strong>{item.name}</strong>
                <span>{item.severity === "normal" ? "정기 점검 유지" : item.action}</span>
              </span>
              <Badge severity={item.severity} />
            </button>
          </li>
        ))}
      </ol>
      <div className="priority-footer">
        <span>
          <Icon name="info" size={15} /> 위험 → 주의 → 정상
        </span>
        <button className="text-link" onClick={onAlerts}>
          알림 보기 <Icon name="forward" size={15} />
        </button>
      </div>
    </section>
  );
}

function AlertPanel({
  items,
  filter,
  setFilter,
  onItem,
  scenario,
  cycle,
}: {
  items: ComponentState[];
  filter: AlertFilter;
  setFilter: (filter: AlertFilter) => void;
  onItem: (id: ComponentId) => void;
  scenario?: Scenario;
  cycle: number;
}) {
  const sorted = prioritize(items);
  const visible = filter === "all" ? sorted : sorted.filter((item) => item.severity === filter);
  return (
    <section className="panel events-panel" id="alerts" aria-labelledby="alerts-title">
      <div className="panel-heading">
        <div>
          <h2 id="alerts-title">상태 알림</h2>
          <p>
            {scenario
              ? "가상 경보 기록 · 실제 설비 알림 아님"
              : "선택한 사이클의 구성품별 상태 기록"}
          </p>
        </div>
        <Icon name="filter" size={18} />
      </div>
      <div className="alert-filters" aria-label="알림 등급 필터">
        {filters.map((value) => (
          <button
            key={value}
            className={value === filter ? "selected" : ""}
            aria-pressed={value === filter}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "전체" : statusText[value]}
          </button>
        ))}
      </div>
      {visible.length ? (
        <ul className="events-list">
          {visible.map((item) => (
            <li key={item.id}>
              <button onClick={() => onItem(item.id)} className="event-row">
                <span className={`event-icon ${item.severity}`}>
                  <Asset name="circle" className="event-circle" />
                  {item.severity === "normal" ? (
                    <Asset name="check" />
                  ) : (
                    <Icon name="alert" size={18} />
                  )}
                </span>
                <span className="event-copy">
                  <strong>
                    {item.name} · {item.description}
                  </strong>
                  <span>
                    {scenario
                      ? item.id === scenario.primary
                        ? `가상 조기경보 ${scenario.warning}초 · 위험 도달 ${scenario.risk}초`
                        : "가상 시나리오 종료 상태"
                      : `Cycle ${formatCycle(cycle)} · UCI 실험 라벨`}
                  </span>
                </span>
                <Badge severity={item.severity} />
                <Icon name="right" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">이 등급의 알림이 없습니다.</p>
      )}
    </section>
  );
}

function ClassificationPanel({
  measured,
  predicted,
  scenario,
  onItem,
}: {
  measured: ComponentState[];
  predicted: ComponentState[];
  scenario?: Scenario;
  onItem: (id: ComponentId) => void;
}) {
  const matches = predicted.filter((item, index) => item.value === measured[index].value).length;
  return (
    <section className="panel classification-panel" aria-labelledby="ai-title">
      <div className="panel-heading">
        <div>
          <h2 id="ai-title">{scenario ? "조기경보 분석" : "AI 상태 분류"}</h2>
          <p>
            {scenario ? (
              "시나리오에서 설정한 경보 시점"
            ) : (
              <>
                <TermHelp term="7-최근접 이웃(k-NN)">
                  센서 특징이 가까운 실험 사이클 7개의 상태 라벨을 다수결로 분류한 탐색용
                  예측입니다. 표시 사이클과 같은 조건의 샘플은 학습에서 제외하며, 이 화면의 일치
                  수는 모델 정확도가 아닙니다.
                </TermHelp>{" "}
                예측과{" "}
                <TermHelp term="실험 라벨">
                  실험 중 시험장치에 설정된 구성품 상태입니다. 실제 현장 진단이나 손상 위치 측정값은
                  아닙니다.
                </TermHelp>{" "}
                비교
              </>
            )}
          </p>
        </div>
        <span className={scenario ? "tag simulated" : "tag model-tag"}>
          {scenario ? "가상" : "k-NN"}
        </span>
      </div>
      {scenario ? (
        <div className="lead-time">
          <div className="lead-value">
            <Icon name="clock" size={22} />
            <strong>
              {scenario.risk - scenario.warning}
              <small>초</small>
            </strong>
            <span>가상 사전 경보</span>
          </div>
          <dl>
            <div>
              <dt>조기경보</dt>
              <dd>{scenario.warning}초</dd>
            </div>
            <div>
              <dt>위험 도달</dt>
              <dd>{scenario.risk}초</dd>
            </div>
          </dl>
          <p>가상 설정값이며 실제 고장 예측 시간을 의미하지 않습니다.</p>
        </div>
      ) : (
        <>
          <div className="model-columns">
            <span>구성품</span>
            <span>AI 분류</span>
            <span>실험 라벨</span>
          </div>
          <ul className="model-list">
            {predicted.map((item, index) => (
              <li key={item.id}>
                <button className="model-columns model-row" onClick={() => onItem(item.id)}>
                  <span>{item.name}</span>
                  <Badge severity={item.severity} />
                  <Badge severity={measured[index].severity} />
                </button>
              </li>
            ))}
          </ul>
          <p className="model-note">
            <Icon name="info" size={15} />이 사이클에서 {matches}/4개 등급 일치 · 탐색용 모델
          </p>
        </>
      )}
    </section>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      onClose={onClose}
      aria-labelledby="modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      <div className="modal-inner">
        <div className="panel-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={() => dialog.current?.close()} aria-label="닫기">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

type PageContext = {
  mode: Mode;
  cycleId: number;
  scenario?: Scenario;
  scenarioId: Scenario["id"];
  series: Series;
  components: ComponentState[];
  predicted: ComponentState[];
  sensor: SensorId;
  setSensor: (sensor: SensorId) => void;
  filter: AlertFilter;
  setFilter: (filter: AlertFilter) => void;
  openDetail: (detail: ComponentId, cycleId?: number) => void;
  showSensor: (sensor: SensorId) => void;
  pathFor: (section: Section) => string;
  goTo: (section: Section) => void;
  rigs: RigData[];
  rig?: RigData;
  goToRig: (id: RigId) => void;
};

function RigOverview() {
  const { rigs, goToRig, goTo } = useOutletContext<PageContext>();
  const { rigId } = useParams();
  return (
    <ThreeDErrorBoundary onEquipment={() => goTo("equipment")}>
      <Suspense
        fallback={
          <div className="panel rig-loading" role="status">
            공장 3D 장면 불러오는 중…
          </div>
        }
      >
        <FactoryViewport
          rigs={rigs}
          onSelect={goToRig}
          selectedId={rigId as RigId | undefined}
          onOverview={() => goTo("rig")}
          onEquipment={() => goTo("equipment")}
        />
      </Suspense>
    </ThreeDErrorBoundary>
  );
}

function SensorSnapshot({ series, rigLabel }: { series: Series; rigLabel: string }) {
  const entries = Object.entries(sensors) as [SensorId, (typeof sensors)[SensorId]][];
  return (
    <section className="sensor-snapshot" aria-labelledby="sensor-snapshot-title">
      <div className="section-heading">
        <div>
          <h3 id="sensor-snapshot-title">주요 센서값</h3>
          <p>{rigLabel} · 60초 사이클 마지막 샘플 · 직전 초 대비</p>
        </div>
        <TermHelp term="실험 센서값">
          실제 유압 시험장치에서 기록한 UCI 실험값입니다. 공장 실시간 수집값이 아닙니다.
        </TermHelp>
      </div>
      <dl className="sensor-snapshot-grid">
        {entries.map(([id, sensor]) => {
          const values = series[id];
          const latest = values.at(-1) ?? 0;
          const previous = values.at(-2) ?? latest;
          const delta = latest - previous;
          const unchanged = Math.abs(delta) < 0.5 * 10 ** -sensor.decimals;
          return (
            <div className="sensor-snapshot-row" key={id}>
              <dt>
                <span>{sensor.name}</span>
                <small>{id}</small>
              </dt>
              <dd>
                <strong>
                  {latest.toFixed(sensor.decimals)} <small>{sensor.unit}</small>
                </strong>
                <span>
                  {unchanged
                    ? "직전 초와 동일"
                    : `직전 초 대비 ${delta > 0 ? "+" : ""}${delta.toFixed(sensor.decimals)} ${sensor.unit}`}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function DashboardHome() {
  const { components, pathFor, scenario, rigs, series, goToRig, goTo, openDetail } =
    useOutletContext<PageContext>();
  if (scenario) {
    const ordered = prioritize(components);
    const primary = ordered.find((item) => item.severity !== "normal") ?? ordered[0];
    return (
      <div className="page-content home-content">
        <section className="home-hero home-hero-compact">
          <div>
            <h2>가상 시나리오 상태</h2>
            <p>{scenario.subtitle} 실제 설비 데이터나 고장 예측이 아닙니다.</p>
            <div className="provenance-row">
              <ProvenanceTag kind="simulation" />
              <ProvenanceTag kind="education" />
            </div>
          </div>
          <NavLink to={pathFor("simulation")} className="primary-button">
            시나리오와 그래프 보기 <Icon name="forward" size={18} />
          </NavLink>
        </section>
        <div className="dashboard-overview-grid simulation-overview-grid">
          <section className="overview-section" aria-labelledby="simulation-priority-title">
            <div className="section-heading">
              <div>
                <h3 id="simulation-priority-title">우선 확인할 구성품</h3>
                <p>시나리오 설정에 따른 교육용 상태입니다.</p>
              </div>
              <Badge severity={primary.severity} />
            </div>
            <div className="scenario-focus">
              <strong>{primary.name}</strong>
              <span>{primary.description}</span>
              <p>권장 확인: {primary.action}</p>
            </div>
          </section>
          <SensorSnapshot series={series} rigLabel="가상 시나리오" />
        </div>
      </div>
    );
  }

  return (
    <DashboardOverview
      rigs={rigs}
      onRig={goToRig}
      onAlerts={() => goTo("alerts")}
      onComponent={(id, sourceCycle) => openDetail(id, sourceCycle)}
    />
  );
}

function EquipmentPage() {
  const { components, predicted, scenario, openDetail, goTo } = useOutletContext<PageContext>();
  return (
    <div className="page-content">
      <section aria-label="구성품별 상태">
        <div className="section-heading">
          <div className="section-title">
            <h2>구성품별 상태</h2>
            <span className="section-counter">4개 구성품</span>
          </div>
        </div>
        <div className="component-grid">
          {components.map((item) => (
            <ComponentCard item={item} key={item.id} onOpen={() => openDetail(item.id)} />
          ))}
        </div>
      </section>
      <div className="dashboard-grid equipment-analysis">
        <PriorityPanel
          items={components}
          onItem={openDetail}
          onAlerts={() => goTo("alerts")}
          scenario={scenario}
        />
        <ClassificationPanel
          measured={components}
          predicted={predicted}
          scenario={scenario}
          onItem={openDetail}
        />
      </div>
    </div>
  );
}

function SensorPage() {
  const { mode, cycleId, scenarioId, scenario, series, sensor, setSensor } =
    useOutletContext<PageContext>();
  return (
    <div className="page-content sensor-page">
      <SensorChart
        key={`${mode}-${cycleId}-${scenarioId}`}
        series={series}
        sensor={sensor}
        onSensor={setSensor}
        cycle={cycleId}
        scenario={scenario}
      />
    </div>
  );
}

function AlertsPage() {
  const { components, filter, setFilter, openDetail, cycleId, scenario } =
    useOutletContext<PageContext>();
  return (
    <div className="page-content alerts-page">
      <AlertPanel
        items={components}
        filter={filter}
        setFilter={setFilter}
        onItem={openDetail}
        cycle={cycleId}
        scenario={scenario}
      />
    </div>
  );
}

function SimulationPage() {
  const { components, predicted, scenario, openDetail } = useOutletContext<PageContext>();
  return (
    <>
      <SensorPage />
      <div className="page-content">
        <ClassificationPanel
          measured={components}
          predicted={predicted}
          scenario={scenario}
          onItem={openDetail}
        />
      </div>
    </>
  );
}

function RigPage() {
  const { components, series, scenario, showSensor, rig, goTo } = useOutletContext<PageContext>();
  if (!rig) return <Navigate to="/rig" replace />;
  return (
    <ThreeDErrorBoundary onEquipment={() => goTo("equipment")}>
      <Suspense
        fallback={
          <div className="panel rig-loading" role="status">
            3D 구조 모델 불러오는 중…
          </div>
        }
      >
        <RigMonitor
          items={components}
          series={series}
          rigId={rig.rigId}
          rigName={rig.rigName}
          cycleId={rig.cycleId}
          overallSeverity={rig.overallSeverity}
          onFactory={() => goTo("rig")}
          virtual={Boolean(scenario)}
          onSensor={showSensor}
          onEquipment={() => goTo("equipment")}
        />
      </Suspense>
    </ThreeDErrorBoundary>
  );
}

function Workspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const matches = useMatches();
  const section = matches[matches.length - 1].id as Section;
  const mode: Mode =
    section === "simulation" || new URLSearchParams(location.search).get("source") === "simulation"
      ? "simulation"
      : "measured";
  const page =
    navigation.find(({ id }) => id === section) ??
    (section === "rigDetail" ? navigation.find(({ id }) => id === "rig") : undefined);
  const [cycleId, setCycleId] = useState(cycles[0].id);
  const [scenarioId, setScenarioId] = useState<Scenario["id"]>(scenarios[0].id);
  const [sensor, setSensor] = useState<SensorId>("PS1");
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [detail, setDetail] = useState<ComponentId | "info" | null>(null);
  const [detailCycleId, setDetailCycleId] = useState<number | null>(null);
  const rigs = loadRigData();
  const rig = rigs.find((item) => item.rigId === params.rigId);
  const rigRoute = section === "rigDetail";

  const cycle =
    rigRoute && rig
      ? cycles.find(({ id }) => id === rig.cycleId)!
      : cycles.find(({ id }) => id === cycleId)!;
  const scenario =
    mode === "simulation" ? scenarios.find(({ id }) => id === scenarioId)! : undefined;
  const series = scenario ? simulate(scenario) : cycle.series;
  const components =
    rigRoute && rig
      ? rig.components
      : getComponents(scenario ? [...scenario.labels] : cycle.labels);
  const predicted = getComponents(cycle.predicted);
  const alerts =
    section === "overview" && mode === "measured"
      ? rigs.reduce(
          (count, item) => count + item.components.filter(({ severity }) => severity !== "normal").length,
          0,
        )
      : components.filter(({ severity }) => severity !== "normal").length;
  const detailCycle = detailCycleId === null ? undefined : cycles.find(({ id }) => id === detailCycleId);
  const detailComponents = detailCycle ? getComponents(detailCycle.labels) : components;
  const selected = detailComponents.find(({ id }) => id === detail);
  const detailPredicted = detailCycle ? getComponents(detailCycle.predicted) : predicted;
  const predictedItem = detailPredicted.find(({ id }) => id === detail);

  function openDetail(id: ComponentId | "info", sourceCycle?: number) {
    setDetailCycleId(sourceCycle ?? null);
    setDetail(id);
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    setFilter("all");
  }, [mode]);

  function pathFor(target: Section, source = mode) {
    if (target === "simulation") return "/simulation";
    if (target === "rig") return "/rig";
    const path = navigation.find(({ id }) => id === target)!.path;
    return `${path}${source === "simulation" ? "?source=simulation" : ""}`;
  }

  function goTo(target: Section) {
    void navigate(target === "rig" ? "/rig" : pathFor(target));
  }

  function goToRig(id: RigId) {
    void navigate(`/rig/${id}`);
  }

  function showSensor(next: SensorId) {
    setSensor(next);
    goTo("sensors");
  }

  function switchMode(next: Mode, target = section) {
    if (next === mode && target === section) return;
    const destination =
      target === "rig" || target === "rigDetail"
        ? "overview"
        : next === "measured" && target === "simulation"
          ? "overview"
          : target;
    setSensor(
      next === "simulation" ? scenarios.find(({ id }) => id === scenarioId)!.sensor : "PS1",
    );
    void navigate(pathFor(destination, next));
  }

  return (
    <div className={`dashboard ${section === "rig" || rigRoute ? "dashboard-rig" : ""}`}>
      <Sidebar pathFor={pathFor} alerts={alerts} openInfo={() => openDetail("info")} />
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <h1>
              {section === "overview" && !scenario ? "가상 유압 설비 상태" : (page?.name ?? "조기경보 시뮬레이션")}
            </h1>
            <p>
              {section === "overview" && !scenario
                ? "UCI 유압 시험 데이터를 기반으로 4개 가상 설비의 상태를 확인하고, 이상 징후와 점검 우선순위를 분석합니다."
                : (page?.description ?? "가상 고장이 진행될 때의 신호와 조기경보 시점을 비교하세요.")}
            </p>
          </div>
          <div className="header-actions">
            <button
              className={`primary-button ${scenario ? "simulation-action" : ""}`}
              onClick={() =>
                switchMode(scenario ? "measured" : "simulation", scenario ? section : "simulation")
              }
            >
              {scenario ? "실험 데이터 보기" : "시뮬레이션 실행"}
              {scenario ? <Icon name="back" size={19} /> : <Asset name="plus" />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label={`알림 센터, 주의 및 위험 ${alerts}건`}
              onClick={() => goTo("alerts")}
            >
              <Asset name="notification" />
              {alerts > 0 && <i />}
            </button>
            <div className="profile">
              <Asset name="avatar" />
              <div>
                <strong>설비 관리자</strong>
                <span>Maintenance</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mode-bar workspace-mode">
          <div className="mode-tabs" aria-label="데이터 모드">
            <button
              className={mode === "measured" ? "active" : ""}
              aria-pressed={mode === "measured"}
              onClick={() => switchMode("measured")}
            >
              <Icon name="database" size={17} />
              실험 데이터 진단
            </button>
            <button
              className={mode === "simulation" ? "active simulation-tab" : ""}
              aria-pressed={mode === "simulation"}
              onClick={() => switchMode("simulation")}
            >
              <Icon name="flask" size={18} />
              조기경보 시뮬레이션
            </button>
          </div>
          <div className="workspace-source" aria-label="데이터 구분">
            <div className="provenance-row workspace-provenance">
              {scenario ? (
                <>
                  <ProvenanceTag kind="simulation" />
                  <ProvenanceTag kind="education" />
                </>
              ) : (
                <>
                  <ProvenanceTag kind="uci" />
                  {section === "rig" || rigRoute ? <ProvenanceTag kind="virtual" /> : null}
                  <ProvenanceTag kind="label" />
                </>
              )}
            </div>
            {!scenario && !rigRoute && section !== "overview" && (
              <SelectControl
                label="실험 사이클 선택"
                value={cycleId}
                onChange={(id) => {
                  setCycleId(Number(id));
                  setFilter("all");
                }}
              >
                {cycles.map(({ id }) => (
                  <option value={id} key={id}>
                    Cycle {formatCycle(id)}
                  </option>
                ))}
              </SelectControl>
            )}
          </div>
        </div>

        {scenario && (
          <div className="simulation-notice">
            <span className="simulation-icon">
              <Icon name="flask" size={21} />
            </span>
            <div>
              <strong>가상 조기경보 시뮬레이션</strong>
              <p>{scenario.subtitle} 실제 설비 경보가 아닙니다.</p>
            </div>
            <SelectControl
              label="고장 시나리오"
              value={scenarioId}
              onChange={(value) => {
                const next = scenarios.find(({ id }) => id === value)!;
                setScenarioId(next.id);
                setSensor(next.sensor);
                setFilter("all");
              }}
            >
              {scenarios.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </SelectControl>
          </div>
        )}

        <Outlet
          context={
            {
              mode,
              cycleId,
              scenario,
              scenarioId,
              series,
              components,
              predicted,
              sensor,
              setSensor,
              filter,
              setFilter,
              openDetail,
              showSensor,
              pathFor,
              goTo,
              rigs,
              rig,
              goToRig,
            } satisfies PageContext
          }
        />

        <footer className="workspace-footer">
          <span>
            Gorosteel <i /> 설비 상태 모니터링
          </span>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            UCI 데이터셋 원본 <Icon name="external" size={14} />
          </a>
        </footer>
      </main>
      {detail === "info" && (
        <Modal title="데이터 안내" onClose={() => { setDetail(null); setDetailCycleId(null); }}>
          <p>
            원본 <em>Condition Monitoring of Hydraulic Systems</em> 데이터에는 2,205개 운전 사이클이
            있습니다. 현재 프로젝트에는 그중 시연용 사이클 4개가 포함되어 있으며, 각 60초 사이클의
            여섯 센서 채널을 1초 단위로 평균해 표시합니다.
          </p>
          <p>
            상태 카드와 알림은 UCI 실험 라벨입니다. AI 상태 분류는 센서 특징과 가까운 7개 실험
            사이클의 라벨을 다수결로 고른 탐색용 k-NN 예측이며, 표시 사이클과 같은 조건의 샘플을
            학습에서 제외합니다. 두 결과는 별도로 표시하며, 일치 개수는 모델 정확도나 실제 설비
            경보를 의미하지 않습니다.
          </p>
          <p>
            HYD-01~HYD-04는 UCI 실험 사이클을 배정한 가상 설비입니다. 공장 3D 화면은 설비와 내부
            구조를 설명하는 개념 모델이며, 실제 현장 네 대의 설비나 측정된 손상 위치·치수·건강
            지수를 나타내지 않습니다. 조기경보 시뮬레이션은 기준 사이클에 가상 변화를 적용하며, 경보
            시점은 시나리오 설정값입니다.
          </p>
          <a className="text-link" href={sourceUrl} target="_blank" rel="noreferrer">
            UCI 데이터셋 열기 <Icon name="external" size={16} />
          </a>
        </Modal>
      )}
      {selected && (
        <Modal title={`${selected.name} 상세 상태`} onClose={() => { setDetail(null); setDetailCycleId(null); }}>
          <div className="detail-summary">
            <span className={`component-icon tone-${selected.tone}`}>
              <Icon name={selected.id} size={22} />
            </span>
            <div>
              <strong>{selected.description}</strong>
              <span>
                {scenario
                  ? "가상 시나리오"
                  : `Cycle ${formatCycle(detailCycle?.id ?? cycleId)} · UCI 실험 라벨`}
              </span>
            </div>
            <Badge severity={selected.severity} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>{selected.metric}</dt>
              <dd>
                {selected.value} {selected.unit}
              </dd>
            </div>
            {!scenario && predictedItem && (
              <div>
                <dt>AI 예측 등급</dt>
                <dd>
                  {predictedItem.value} {selected.unit} <Badge severity={predictedItem.severity} />
                </dd>
              </div>
            )}
            <div>
              <dt>권장 작업</dt>
              <dd>{selected.severity === "normal" ? "정기 점검 유지" : selected.action}</dd>
            </div>
          </dl>
          <button
            className="primary-button"
            onClick={() => {
              setDetail(null);
              if (detailCycle) setCycleId(detailCycle.id);
              setDetailCycleId(null);
              showSensor(selected.sensor);
            }}
          >
            관련 센서 보기 <Icon name="forward" size={18} />
          </button>
        </Modal>
      )}
    </div>
  );
}

const router = createBrowserRouter([
  {
    Component: Workspace,
    children: [
      { index: true, id: "overview", Component: DashboardHome },
      { path: "rig", id: "rig", Component: RigOverview },
      { path: "rig/:rigId", id: "rigDetail", Component: RigOverview },
      { path: "equipment", id: "equipment", Component: EquipmentPage },
      { path: "sensors", id: "sensors", Component: SensorPage },
      { path: "alerts", id: "alerts", Component: AlertsPage },
      { path: "simulation", id: "simulation", Component: SimulationPage },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
