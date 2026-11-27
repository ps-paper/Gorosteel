import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
import "./rig.css";
import { SelectControl, SensorChart } from "./SensorChart";
import {
  cycles,
  getComponents,
  loadRigData,
  prioritize,
  scenarios,
  simulate,
  sourceUrl,
  statusText,
} from "./monitoring";
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
          <h2 id="priority-title">점검 우선순위</h2>
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
          <h2 id="ai-title">{scenario ? "조기경보 분석" : "AI 이상 상태 분류"}</h2>
          <p>
            {scenario ? "시나리오에서 설정한 경보 시점" : "센서 기반 k-NN 예측과 실험 라벨 비교"}
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
  openDetail: (detail: ComponentId) => void;
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
    <Suspense fallback={<div className="panel rig-loading">공장 3D 장면 불러오는 중…</div>}>
      <FactoryViewport rigs={rigs} onSelect={goToRig} selectedId={rigId as RigId | undefined} onOverview={() => goTo("rig")} />
    </Suspense>
  );
}

function DashboardHome() {
  const { components, pathFor, scenario } = useOutletContext<PageContext>();
  return (
    <div className="page-content home-content">
      <section className="home-hero">
        <div>
          <span className="home-hero-kicker">
            <Icon name="cube" size={15} /> UCI HYDRAULIC TEST RIG / 01
          </span>
          <h2>공장 안의 4개 설비를 3D로 확인하세요</h2>
          <p>공장 전체 장면에서 설비를 선택하고 구성품별 점검 상태와 내부 부품을 살펴보세요.</p>
          <NavLink to={pathFor("rig")} className="primary-button">
            설비 3D 모니터링 열기 <Icon name="forward" size={18} />
          </NavLink>
        </div>
        <svg className="hero-blueprint" viewBox="0 0 390 212" fill="none" aria-hidden="true">
          <path d="m37 76 204-56 112 52-203 57L37 76Zm0 0v77l113 44m0-68v68l203-58V72M241 20v73m-91 104 203-58M37 153l204-60 112 46" />
          <path d="m84 80 71 31 60-17v59l-60 17-71-27V80Zm71 31v59m-71-90 60-17 71 31m-111 3 36 15m-36-1 36 15m-36-1 36 15m-36-1 36 15" />
          <path d="M253 103c0-13 13-24 30-24s30 11 30 24v39c0 13-13 24-30 24s-30-11-30-24v-39Zm0 0c0 13 13 23 30 23s30-10 30-23m-30-24V59m0 107v15m-68-56 38-12" />
          <circle cx="174" cy="131" r="5" />
          <circle cx="283" cy="112" r="5" />
          <circle cx="94" cy="113" r="5" />
        </svg>
      </section>
      <section className="home-status" aria-label="상태 요약">
        <div className="section-heading">
          <div className="section-title">
            <h2>구성품 상태 요약</h2>
            <span className="section-counter">{scenario ? "가상" : "실험 라벨"}</span>
          </div>
          <NavLink className="text-link" to={pathFor("equipment")}>
            전체 구성품 <Icon name="forward" size={15} />
          </NavLink>
        </div>
        <div className="home-stat-grid">
          {(["risk", "caution", "normal"] as const).map((severity) => {
            const group = components.filter((item) => item.severity === severity);
            return (
              <div key={severity} className="panel home-stat">
                <Badge severity={severity} />
                <p>
                  {group.length}
                  <small>개</small>
                </p>
                <span>
                  {group.length ? group.map((item) => item.name).join(" · ") : "해당 구성품 없음"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="home-links" aria-label="바로 가기">
        <div className="section-heading">
          <div className="section-title">
            <h2>바로 가기</h2>
          </div>
        </div>
        <div className="home-stat-grid">
          {navigation
            .filter(({ id }) => id !== "overview" && id !== "rig")
            .map((entry) => (
              <NavLink className="panel home-link" key={entry.id} to={pathFor(entry.id)}>
                <span className="home-link-icon">
                  <Asset name={entry.icon as "components" | "chart" | "alerts"} />
                </span>
                <span>
                  <strong>{entry.name}</strong>
                  <small>{entry.description}</small>
                </span>
                <Icon name="right" size={17} />
              </NavLink>
            ))}
        </div>
      </section>
    </div>
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
      />
    </Suspense>
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
  const alerts = components.filter(({ severity }) => severity !== "normal").length;
  const selected = components.find(({ id }) => id === detail);
  const predictedItem = predicted.find(({ id }) => id === detail);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    setFilter("all");
  }, [mode]);

  function pathFor(target: Section, source = mode) {
    if (target === "simulation") return "/simulation";
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
      <Sidebar pathFor={pathFor} alerts={alerts} openInfo={() => setDetail("info")} />
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{page?.name ?? "조기경보 시뮬레이션"}</h1>
            <p>
              {page?.description ?? "가상 고장이 진행될 때의 신호와 조기경보 시점을 비교하세요."}
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
          <div className="workspace-source">
            <span className={`source-pill ${scenario ? "simulated" : ""}`}>
              {scenario ? <Icon name="flask" size={14} /> : <i />}
              {scenario ? "가상 데이터" : "UCI 실험 데이터"}
            </span>
            {!scenario && !rigRoute && (
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
              openDetail: setDetail,
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
        <Modal title="데이터 안내" onClose={() => setDetail(null)}>
          <p>
            실험 데이터 진단은 UCI의 <em>Condition Monitoring of Hydraulic Systems</em>에 공개된
            60초 사이클의 일부를 사용합니다. 그래프는 센서 값을 1초 단위로 평균한 결과이고, 상태
            카드와 알림은 UCI가 제공한 실험 라벨 기준입니다.
          </p>
          <p>
            AI 분류는 표시된 사이클과 실험 조건 조합이 같은 샘플을 훈련에서 제외한 탐색용 k-NN
            모델의 예측입니다. 실제 설비 경보나 모델 성능 검증을 대신하지 않습니다.
          </p>
          <p>
            조기경보 시뮬레이션은 정상 사이클의 신호에 가상 변화를 적용합니다. 경보 및 위험 시점은
            시나리오 설정값입니다.
          </p>
          <a className="text-link" href={sourceUrl} target="_blank" rel="noreferrer">
            UCI 데이터셋 열기 <Icon name="external" size={16} />
          </a>
        </Modal>
      )}
      {selected && (
        <Modal title={`${selected.name} 상세 상태`} onClose={() => setDetail(null)}>
          <div className="detail-summary">
            <span className={`component-icon tone-${selected.tone}`}>
              <Icon name={selected.id} size={22} />
            </span>
            <div>
              <strong>{selected.description}</strong>
              <span>
                {scenario ? "가상 시나리오" : `Cycle ${formatCycle(cycleId)} · UCI 실험 라벨`}
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
