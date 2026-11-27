import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { Icon } from "./Icons";
import { createRig, severityColors } from "./rig-model";
import type { RigView } from "./rig-model";
import { statusText } from "./monitoring";
import type { ComponentId, ComponentState, Severity } from "./monitoring";

const views = [
  { id: "cutaway", label: "3D 구조 (단면)", icon: "cut" },
  { id: "overall", label: "전체 보기", icon: "cube" },
  { id: "inside", label: "내부 구조", icon: "layers" },
] as const;

type ViewerProps = {
  items: ComponentState[];
  selected: ComponentId;
  view: RigView;
  activePart: number;
  onSelect: (id: ComponentId) => void;
  onView: (view: RigView) => void;
  onEquipment: () => void;
};

type Controls = {
  zoom: (direction: number) => void;
  reset: () => void;
};

function addStage(scene: T.Scene, vector: boolean) {
  const grid = new T.GridHelper(54, 54, 0x6880a0, 0x517193);
  grid.position.y = -0.18;
  grid.material.transparent = true;
  grid.material.opacity = 0.15;
  scene.add(grid);
  const center = new T.Vector3(0, 5, 0);
  const sky = new T.HemisphereLight(0xe4edff, 0x354258, 2);
  scene.add(sky, new T.AmbientLight(vector ? 0x808ea8 : 0xcbdcf4, 0.31));
  for (const [x, y, z, tint, strength] of [
    [4, 8, 6, 0xe1edff, 3.1],
    [-5, 3, 2, 0xa3c9ff, 1.3],
    [2, 4, -6, 0xc4ddff, 2.2],
  ]) {
    const light = new T.DirectionalLight(tint, strength * (vector ? 0.27 : 1));
    light.position.copy(center).add(new T.Vector3(x, y, z));
    scene.add(light);
  }
  const resolution = 64;
  const pixels = new Uint8Array(resolution * resolution * 4);
  for (let y = 0; y < resolution; y++)
    for (let x = 0; x < resolution; x++) {
      const r = Math.hypot((x / (resolution - 1)) * 2 - 1, (y / (resolution - 1)) * 2 - 1);
      pixels[(x + y * resolution) * 4 + 3] = Math.round(Math.max(0, 1 - r) ** 1.5 * 195);
    }
  const texture = new T.DataTexture(pixels, resolution, resolution);
  texture.needsUpdate = true;
  texture.magFilter = T.LinearFilter;
  const shadow = new T.Mesh(
    new T.PlaneGeometry(17, 9),
    new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.16;
  scene.add(shadow);
  return { shadow, texture };
}

export function RigViewport(props: ViewerProps) {
  const { items, selected, view, onSelect, onView, onEquipment } = props;
  const rendererHost = useRef<HTMLDivElement>(null);
  const markers = useRef<Partial<Record<ComponentId, HTMLButtonElement | null>>>({});
  const controlsRef = useRef<Controls | null>(null);
  const requestDraw = useRef<(() => void) | null>(null);
  const current = useRef(props);
  current.current = props;
  const [renderMode, setRenderMode] = useState<"webgl" | "vector" | "unavailable">("webgl");
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const [rotating, setRotating] = useState(false);
  const rotation = useRef(false);
  rotation.current = rotating;
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const node = rendererHost.current;
    if (!node) return;
    let renderer: T.WebGLRenderer | SVGRenderer;
    let vector = false;
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", { antialias: true, alpha: true });
      if (!context) throw new Error("WebGL2 is unavailable");
      renderer = new T.WebGLRenderer({
        canvas,
        context,
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.setClearColor(0x000000, 0);
      setRenderMode("webgl");
    } catch {
      try {
        renderer = new SVGRenderer();
        renderer.setPrecision(1);
        renderer.setQuality("low");
        vector = true;
        setRenderMode("vector");
      } catch {
        setRenderMode("unavailable");
        return;
      }
    }
    renderer.domElement.setAttribute("aria-hidden", "true");
    node.appendChild(renderer.domElement);
    const scene = new T.Scene();
    const rig = createRig(scene);
    const { shadow, texture } = addStage(scene, vector);
    // Use a transparent surface in WebGL; the SVG renderer shades the same geometry as a compatibility view.
    shadow.visible = !vector;
    let environment: T.WebGLRenderTarget | undefined;
    if (renderer instanceof T.WebGLRenderer) {
      const studio = new RoomEnvironment();
      const pmrem = new T.PMREMGenerator(renderer);
      environment = pmrem.fromScene(studio, 0.045);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.88;
      studio.dispose();
      pmrem.dispose();
    }
    const camera = new T.OrthographicCamera(-8, 8, 5, -5, 0.1, 150);
    const controls = new OrbitControls(camera, node);
    controls.enableDamping = !vector && !reducedMotion.current;
    controls.dampingFactor = 0.095;
    controls.enablePan = true;
    controls.minZoom = 0.68;
    controls.maxZoom = 2.45;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.autoRotateSpeed = 1.4;
    const projected = new T.Vector3();
    const spherical = new T.Spherical();
    let width = 1;
    let height = 1;
    let last: ViewerProps | undefined;
    let dirty = true;
    let lastDraw = 0;
    let frame = 0;
    let renderingFailed = false;

    function fit() {
      const aspect = width / height;
      const inside = current.current.view === "inside";
      const span = inside ? Math.max(4.45, 5.1 / aspect) : Math.max(7.15, 12.95 / aspect);
      camera.left = (-span * aspect) / 2;
      camera.right = (span * aspect) / 2;
      camera.top = span / 2;
      camera.bottom = -span / 2;
      camera.updateProjectionMatrix();
    }

    const reset = () => {
      const inside = current.current.view === "inside";
      if (inside) camera.position.set(4.4, 3.6, 10);
      else camera.position.set(8.9, 6.9, 17.4);
      controls.target.set(0, inside ? 1.94 : 2.18, 0);
      camera.zoom = 1;
      fit();
      controls.update();
      dirty = true;
    };
    const zoom = (direction: number) => {
      camera.zoom = T.MathUtils.clamp(
        camera.zoom * (direction > 0 ? 1.17 : 1 / 1.17),
        controls.minZoom,
        controls.maxZoom,
      );
      camera.updateProjectionMatrix();
      dirty = true;
    };
    controlsRef.current = { zoom, reset };
    requestDraw.current = () => {
      dirty = true;
    };
    const resize = new ResizeObserver(() => {
      if (!node.clientWidth || !node.clientHeight) return;
      width = node.clientWidth;
      height = node.clientHeight;
      renderer.setSize(width, height);
      fit();
      dirty = true;
    });
    resize.observe(node);
    controls.addEventListener("change", () => {
      dirty = true;
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "+" || event.key === "=") zoom(1);
      else if (event.key === "-") zoom(-1);
      else if (event.key === "Home") reset();
      else if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)) {
        spherical.setFromVector3(camera.position.clone().sub(controls.target));
        if (event.key === "ArrowLeft") spherical.theta -= 0.13;
        if (event.key === "ArrowRight") spherical.theta += 0.13;
        if (event.key === "ArrowUp") spherical.phi = Math.max(0.16, spherical.phi - 0.1);
        if (event.key === "ArrowDown")
          spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + 0.1);
        camera.position.setFromSpherical(spherical).add(controls.target);
        controls.update();
      } else return;
      event.preventDefault();
    }
    node.addEventListener("keydown", onKey);
    reset();

    function draw(now: number) {
      if (renderingFailed) return;
      frame = requestAnimationFrame(draw);
      const next = current.current;
      if (
        !last ||
        next.items !== last.items ||
        next.view !== last.view ||
        next.selected !== last.selected ||
        next.activePart !== last.activePart
      ) {
        const states = Object.fromEntries(
          next.items.map(({ id, severity }) => [id, severity]),
        ) as Record<ComponentId, Severity>;
        rig.update(next.view, next.selected, next.activePart, states);
        if (
          !last ||
          next.view !== last.view ||
          (next.view === "inside" && next.selected !== last.selected)
        )
          reset();
        last = next;
        dirty = true;
      }
      controls.autoRotate = rotation.current;
      controls.update();
      if (!dirty || (vector && now - lastDraw < 90)) return;
      dirty = false;
      lastDraw = now;
      try {
        renderer.render(scene, camera);
      } catch {
        renderingFailed = true;
        setRotating(false);
        setRenderMode("unavailable");
        return;
      }
      if (next.view === "inside") return;
      for (const { id } of next.items) {
        const marker = markers.current[id];
        if (!marker) continue;
        const model = rig.components[id];
        projected.copy(model.pin).applyMatrix4(model.root.matrixWorld).project(camera);
        marker.style.left = `${(projected.x + 1) * 50}%`;
        marker.style.top = `${(1 - projected.y) * 50}%`;
        const inFrame = Math.abs(projected.x) < 0.98 && Math.abs(projected.y) < 0.9;
        marker.style.visibility = inFrame ? "visible" : "hidden";
      }
    }
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      node.removeEventListener("keydown", onKey);
      const geometries = new Set<T.BufferGeometry>();
      const materials = new Set<T.Material>();
      scene.traverse((object) => {
        if (object instanceof T.Mesh || object instanceof T.Line) {
          geometries.add(object.geometry);
          for (const item of Array.isArray(object.material) ? object.material : [object.material])
            materials.add(item);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      environment?.dispose();
      texture.dispose();
      if (renderer instanceof T.WebGLRenderer) renderer.dispose();
      renderer.domElement.remove();
      controlsRef.current = null;
      requestDraw.current = null;
    };
  }, [rendererAttempt]);

  useEffect(() => {
    requestDraw.current?.();
  }, [rotating]);

  useEffect(() => {
    if (!expanded) return;
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [expanded]);

  return (
    <div className="rig-stage-slot">
      <section
        className={`rig-stage ${expanded ? "rig-expanded" : ""}`}
        aria-label="유압 시험장치 3D 뷰어"
      >
        <div
          className="rig-canvas"
          ref={rendererHost}
          tabIndex={0}
          aria-label="3D 모델. 드래그 또는 화살표로 회전, 더하기와 빼기로 확대 및 축소, Home 키로 초기화"
        />
        <div className="rig-toolbar">
          <div className="rig-view-tabs" aria-label="3D 보기 모드">
            {views.map(({ id, label, icon }) => (
              <button key={id} aria-pressed={view === id} onClick={() => onView(id)}>
                <Icon name={icon} size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="rig-toolbar-actions">
            <button
              className="rig-control"
              aria-pressed={rotating}
              onClick={() => setRotating(!rotating)}
              aria-label={rotating ? "자동 회전 정지" : "360도 자동 회전"}
              title={rotating ? "자동 회전 정지" : "360도 자동 회전"}
            >
              <Icon name={rotating ? "pause" : "rotate"} size={17} />
              <span>{rotating ? "회전 정지" : "360° 회전"}</span>
            </button>
            <button
              className="rig-control rig-control-icon"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "전체 화면 닫기" : "전체 화면"}
              title={expanded ? "전체 화면 닫기" : "전체 화면"}
            >
              <Icon name={expanded ? "shrink" : "expand"} size={18} />
            </button>
          </div>
        </div>
        <div className="rig-zoom" aria-label="3D 카메라 도구">
          <button onClick={() => controlsRef.current?.zoom(1)} title="확대" aria-label="확대">
            <Icon name="zoomIn" size={18} />
          </button>
          <button onClick={() => controlsRef.current?.zoom(-1)} title="축소" aria-label="축소">
            <Icon name="zoomOut" size={18} />
          </button>
          <button
            onClick={() => controlsRef.current?.reset()}
            title="초기 시점"
            aria-label="초기 시점"
          >
            <Icon name="target" size={18} />
          </button>
        </div>
        {view !== "inside" &&
          items.map((item) => (
            <button
              className={`rig-marker ${selected === item.id ? "rig-marker-active" : ""}`}
              key={item.id}
              ref={(element) => {
                markers.current[item.id] = element;
              }}
              style={{ "--rig-accent": severityColors[item.severity] } as CSSProperties}
              onClick={() => onSelect(item.id)}
              aria-pressed={selected === item.id}
              aria-label={`${item.name}, ${statusText[item.severity]}`}
            >
              <span className="rig-marker-label">
                <Icon name={item.id} size={14} />
                {item.name}
              </span>
              <i />
            </button>
          ))}
        {renderMode === "unavailable" && (
          <div className="rig-unavailable" role="alert">
            <strong>3D 설비 화면을 불러오지 못했습니다.</strong>
            <span>재시도하거나 구성품 상태 목록에서 진단 결과를 확인하세요.</span>
            <div>
              <button
                className="primary-button"
                onClick={() => setRendererAttempt((attempt) => attempt + 1)}
              >
                3D 화면 재시도
              </button>
              <button className="secondary-button" onClick={onEquipment}>
                구성품 상태 목록 보기
              </button>
            </div>
          </div>
        )}
        <div className="rig-stage-footer">
          <span className="rig-model-label">
            <Icon name="cube" size={13} /> {renderMode === "vector" ? "호환 모드" : "3D 구조 모델"}
          </span>
          <span className="rig-drag-hint">
            <Icon name="mouse" size={14} /> 드래그하여 회전 · 스크롤하여 확대
          </span>
          <span className="rig-axis">
            <span>X</span>
            <span>Y</span>
            <span>Z</span>
          </span>
        </div>
      </section>
    </div>
  );
}
