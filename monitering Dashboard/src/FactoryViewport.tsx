import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { Icon } from "./Icons";
import { sensors, statusText } from "./monitoring";
import type { RigData, RigId, Severity } from "./monitoring";
import { ProvenanceTag, TermHelp } from "./ContextHelp";
import { severityColors } from "./severity-colors";
import { createRig, degradationTargets, rigParts } from "./rig-model";
import type { ComponentId } from "./monitoring";

type Renderer = T.WebGLRenderer | SVGRenderer;
type RigObject = { data: RigData; root: T.Group; fan: T.Group; statusLamp: T.Mesh };

const metal = (color: string, roughness = 0.58) =>
  new T.MeshStandardMaterial({ color, metalness: 0.48, roughness });

function addBox(
  parent: T.Object3D,
  material: T.Material,
  position: T.Vector3Tuple,
  size: T.Vector3Tuple,
) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent: T.Object3D,
  material: T.Material,
  position: T.Vector3Tuple,
  radius: number,
  height: number,
  rotationX = 0,
) {
  const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, height, 16), material);
  mesh.position.set(...position);
  mesh.rotation.x = rotationX;
  parent.add(mesh);
  return mesh;
}

function addTubeRun(
  parent: T.Object3D,
  points: T.Vector3Tuple[],
  radius: number,
  material: T.Material,
) {
  const curve = new T.CatmullRomCurve3(points.map((point) => new T.Vector3(...point)));
  const mesh = new T.Mesh(new T.TubeGeometry(curve, 28, radius, 8, false), material);
  parent.add(mesh);
  return mesh;
}

function createMachine(scene: T.Scene, data: RigData, position: T.Vector3Tuple): RigObject {
  const root = new T.Group();
  root.position.set(...position);
  root.userData.rigId = data.rigId;
  scene.add(root);

  const chassis = metal("#65717a", 0.42);
  chassis.metalness = 0.68;
  const lightMetal = metal("#aeb8bd", 0.3);
  lightMetal.metalness = 0.78;
  const darkMetal = metal("#30383d", 0.68);
  const blue = metal("#536f82", 0.38);
  const glass = new T.MeshStandardMaterial({ color: "#50616b", roughness: 0.34, metalness: 0.3 });
  const statusTone: Record<Severity, string> = {
    normal: "#648575",
    caution: "#a78a50",
    risk: "#98585a",
  };
  const stateMaterial = new T.MeshStandardMaterial({
    color: statusTone[data.overallSeverity],
    emissive: statusTone[data.overallSeverity],
    emissiveIntensity: 0.06,
    roughness: 0.48,
  });
  const pilotMaterial = stateMaterial.clone();
  pilotMaterial.emissiveIntensity = 0.16;

  // A compact skid, machine frame, control cabinet and hydraulic power unit.
  addBox(root, darkMetal, [0, 0.15, 0], [4.9, 0.25, 3.1]);
  for (const z of [-1.36, 1.36]) addBox(root, chassis, [0, 0.3, z], [4.72, 0.18, 0.18]);
  for (const x of [-2.22, 0, 2.22]) addBox(root, chassis, [x, 0.3, 0], [0.18, 0.18, 2.68]);
  const foot = metal("#20272b", 0.82);
  for (const x of [-2.19, 2.19])
    for (const z of [-1.34, 1.34]) {
      addBox(root, foot, [x, -0.02, z], [0.48, 0.12, 0.42]);
      addBox(root, lightMetal, [x, 0.33, z], [0.28, 0.08, 0.27]);
    }
  // Status is limited to a narrow edge strip and small pilot lamps.
  addBox(root, darkMetal, [0, 0.3, -1.48], [4.12, 0.036, 0.035]);
  addBox(root, stateMaterial, [0, 0.3, 1.48], [2.55, 0.036, 0.035]);

  // Welded equipment frame with cross rails and small gusset plates.
  for (const x of [-2.05, 2.05])
    for (const z of [-1.18, 1.18]) {
      addBox(root, lightMetal, [x, 1.55, z], [0.16, 2.35, 0.16]);
      addBox(root, darkMetal, [x, 0.48, z], [0.25, 0.18, 0.25]);
    }
  addBox(root, chassis, [0, 2.76, 0], [4.45, 0.2, 2.75]);
  addBox(root, chassis, [-1.44, 1.28, 0], [1.02, 1.52, 1.38]);
  addBox(root, glass, [-1.44, 1.34, 0.704], [0.78, 0.88, 0.035]);

  // Recessed cabinet face, display, switches, vents and door hardware.
  const cabinetFace = metal("#252f35", 0.54);
  const screenMaterial = metal("#73848b", 0.24);
  addBox(root, cabinetFace, [-1.44, 1.4, 0.728], [0.65, 0.78, 0.025]);
  addBox(root, screenMaterial, [-1.44, 1.62, 0.749], [0.42, 0.2, 0.012]);
  addBox(root, darkMetal, [-1.44, 1.39, 0.75], [0.48, 0.036, 0.014]);
  const pilotMaterials = [
    new T.MeshStandardMaterial({ color: "#78a28e", emissive: "#47735e", emissiveIntensity: 0.08 }),
    new T.MeshStandardMaterial({ color: "#b59a61", emissive: "#79623a", emissiveIntensity: 0.08 }),
    new T.MeshStandardMaterial({ color: "#a96a68", emissive: "#713b3a", emissiveIntensity: 0.08 }),
  ];
  for (let index = 0; index < 3; index++) {
    const lamp = addCylinder(
      root,
      pilotMaterials[index],
      [-1.6 + index * 0.16, 1.18, 0.755],
      0.043,
      0.025,
      Math.PI / 2,
    );
    lamp.name = "cabinet-pilot-" + (index + 1);
  }
  for (let index = 0; index < 6; index++)
    addBox(root, darkMetal, [-1.44, 0.83 + index * 0.075, 0.712], [0.38, 0.022, 0.018]);
  addBox(root, lightMetal, [-0.98, 1.38, 0.738], [0.035, 0.32, 0.035]);
  for (const y of [0.73, 1.98]) addCylinder(root, lightMetal, [-1.84, y, 0.15], 0.045, 0.12);

  // Motor shell, cooling ribs, terminal box and coupling.
  const motorBody = addCylinder(root, blue, [0.88, 0.94, 0.02], 0.48, 1.18);
  motorBody.rotation.z = Math.PI / 2;
  for (const x of [0.42, 1.33]) {
    const rib = addCylinder(root, chassis, [x, 0.94, 0.02], 0.49, 0.07);
    rib.rotation.z = Math.PI / 2;
  }
  const motorCap = addCylinder(root, lightMetal, [1.52, 0.94, 0.02], 0.34, 0.16);
  motorCap.rotation.z = Math.PI / 2;
  const motorHub = addCylinder(root, darkMetal, [1.62, 0.94, 0.02], 0.13, 0.12);
  motorHub.rotation.z = Math.PI / 2;
  addBox(root, darkMetal, [0.72, 1.42, -0.08], [0.48, 0.24, 0.42]);
  addBox(root, lightMetal, [0.72, 1.43, 0.14], [0.32, 0.12, 0.025]);

  // Pump casing and serviceable end flange.
  addBox(root, blue, [0.04, 0.91, -0.22], [1.55, 0.72, 1.24]);
  addBox(root, chassis, [0.04, 0.91, 0.42], [1.2, 0.55, 0.12]);
  for (const x of [-0.42, 0.5])
    for (const y of [0.71, 1.11]) {
      const bolt = addCylinder(root, lightMetal, [x, y, 0.505], 0.047, 0.035, Math.PI / 2);
    }
  const pumpOutlet = addCylinder(root, lightMetal, [0.46, 1.35, 0.3], 0.13, 0.2);
  pumpOutlet.rotation.x = Math.PI / 2;
  const pumpGauge = addCylinder(root, darkMetal, [0.46, 1.48, 0.42], 0.16, 0.06, Math.PI / 2);
  addCylinder(root, lightMetal, [0.46, 1.48, 0.462], 0.12, 0.016, Math.PI / 2);
  addBox(root, darkMetal, [0.46, 1.52, 0.474], [0.012, 0.13, 0.012]);

  // Vertical pressure vessel with head bands, charging fitting and a local gauge.
  const fan = new T.Group();
  fan.position.set(1.57, 0.94, 0.02);
  root.add(fan);
  addCylinder(fan, darkMetal, [0, 0, 0], 0.09, 0.07, Math.PI / 2);
  for (let blade = 0; blade < 4; blade++) {
    const vane = addBox(fan, darkMetal, [0, 0, 0.02], [0.1, 0.48, 0.07]);
    vane.rotation.z = (Math.PI / 2) * blade;
  }
  addCylinder(root, blue, [1.89, 1.62, 0.56], 0.34, 1.4);
  for (const y of [0.94, 1.32, 1.9, 2.3])
    addCylinder(root, chassis, [1.89, y, 0.56], y === 0.94 || y === 2.3 ? 0.37 : 0.355, 0.055);
  addCylinder(root, lightMetal, [1.89, 2.35, 0.56], 0.37, 0.12);
  addCylinder(root, darkMetal, [1.89, 2.46, 0.56], 0.12, 0.12);
  addCylinder(root, lightMetal, [1.89, 2.56, 0.56], 0.075, 0.1);
  const vesselGauge = addCylinder(root, darkMetal, [1.89, 1.74, 0.925], 0.16, 0.07, Math.PI / 2);
  const gaugeFace = addCylinder(root, lightMetal, [1.89, 1.74, 0.973], 0.125, 0.018, Math.PI / 2);
  const gaugeNeedle = addBox(root, darkMetal, [1.89, 1.79, 0.989], [0.016, 0.1, 0.014]);
  gaugeNeedle.rotation.z = -0.42;
  addCylinder(root, lightMetal, [1.89, 2.44, 0.56], 0.045, 0.12);
  addBox(root, darkMetal, [1.89, 2.51, 0.56], [0.16, 0.06, 0.16]);

  // Cooler core, manifold and steel tube runs.
  addBox(root, chassis, [-0.13, 1.68, -0.8], [0.88, 1.05, 0.58]);
  for (let fin = 0; fin < 7; fin++)
    addBox(root, lightMetal, [-0.48 + fin * 0.115, 1.68, -0.49], [0.045, 0.91, 0.08]);
  addBox(root, blue, [0.22, 0.68, 0.86], [0.72, 0.48, 0.5]);
  addBox(root, chassis, [0.22, 0.68, 1.115], [0.54, 0.29, 0.035]);
  for (const x of [-0.13, 0.57]) {
    const port = addCylinder(root, lightMetal, [x, 0.68, 1.13], 0.09, 0.08, Math.PI / 2);
  }
  for (const x of [-0.62, 0.52]) {
    const pipe = addCylinder(root, lightMetal, [x, 1.72, 0.7], 0.075, 1.15);
    pipe.rotation.z = Math.PI / 2;
  }
  const pipeMaterial = metal("#89969a", 0.35);
  pipeMaterial.metalness = 0.72;
  addTubeRun(
    root,
    [
      [0.48, 1.45, 0.57],
      [0.8, 1.7, 0.57],
      [1.52, 1.7, 0.57],
      [1.72, 2.16, 0.57],
      [1.89, 2.16, 0.57],
    ],
    0.065,
    pipeMaterial,
  );
  addTubeRun(
    root,
    [
      [1.89, 1.12, 0.56],
      [1.55, 1.08, 0.56],
      [1.12, 0.82, 0.56],
      [0.5, 0.82, 0.56],
      [0.3, 1.2, 0.56],
    ],
    0.052,
    pipeMaterial,
  );
  const hoseMaterial = metal("#22292d", 0.8);
  addTubeRun(
    root,
    [
      [-0.92, 1.02, 0.48],
      [-0.82, 1.42, 0.64],
      [-0.3, 1.48, 0.64],
      [0.12, 1.15, 0.64],
    ],
    0.055,
    hoseMaterial,
  );
  for (const x of [-0.66, 0.56]) {
    const connector = addCylinder(root, lightMetal, [x, 1.72, 0.7], 0.11, 0.1, Math.PI / 2);
  }

  const statusLamp = new T.Mesh(new T.SphereGeometry(0.12, 12, 10), pilotMaterial);
  statusLamp.position.set(-1.9, 2.94, 0.92);
  root.add(statusLamp);
  return { data, root, fan, statusLamp };
}

function addFloor(scene: T.Scene) {
  const floor = new T.Mesh(
    new T.PlaneGeometry(120, 210),
    new T.MeshStandardMaterial({ color: "#454c50", roughness: 0.48, metalness: 0.18 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.08, -55);
  floor.receiveShadow = true;
  scene.add(floor);

  const bayLine = new T.LineBasicMaterial({ color: 0xa09064, transparent: true, opacity: 0.72 });
  const bays: Array<{ x: number; z: number; label: string }> = [
    { x: -8.9, z: -4.4, label: "HYD TEST ZONE A" },
    { x: 2.9, z: -4.4, label: "HYD TEST ZONE B" },
    { x: -2.9, z: 4.4, label: "HYD TEST ZONE C" },
    { x: 8.9, z: 4.4, label: "HYD TEST ZONE D" },
  ];
  for (const { x, z, label } of bays) {
    const points = [
      new T.Vector3(x - 2.7, -0.073, z - 2.1),
      new T.Vector3(x + 2.7, -0.073, z - 2.1),
      new T.Vector3(x + 2.7, -0.073, z + 2.1),
      new T.Vector3(x - 2.7, -0.073, z + 2.1),
    ];
    const outline = new T.LineLoop(new T.BufferGeometry().setFromPoints(points), bayLine);
    scene.add(outline);

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = "600 58px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#c3b88f";
      context.fillText(label, canvas.width / 2, canvas.height / 2);
      const map = new T.CanvasTexture(canvas);
      map.colorSpace = T.SRGBColorSpace;
      const labelMaterial = new T.MeshBasicMaterial({
        map,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        side: T.DoubleSide,
      });
      const floorLabel = new T.Mesh(new T.PlaneGeometry(3.3, 0.55), labelMaterial);
      floorLabel.rotation.x = -Math.PI / 2;
      floorLabel.position.set(x, -0.07, z + 1.66);
      scene.add(floorLabel);
    }
  }

  const safetyPaint = new T.MeshStandardMaterial({
    color: "#a38b54",
    roughness: 0.76,
    metalness: 0.02,
  });
  for (const x of [-1.22, 1.22]) addBox(scene, safetyPaint, [x, -0.076, 0], [0.075, 0.008, 22]);
  const aisle = new T.MeshStandardMaterial({ color: "#373e42", roughness: 0.65, metalness: 0.12 });
  addBox(scene, aisle, [0, -0.074, 0], [2.35, 0.012, 22]);
}

export function FactoryViewport({
  rigs,
  onSelect,
  selectedId,
  onOverview,
  onEquipment,
}: {
  rigs: RigData[];
  onSelect: (id: RigId) => void;
  selectedId?: RigId;
  onOverview: () => void;
  onEquipment: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<Partial<Record<RigId, HTMLButtonElement | null>>>({});
  const selectedPart = useRef<ComponentId>("pump");
  const [step, setStep] = useState<"factory" | "rig" | "component" | "subpart">("factory");
  const [activePart, setActivePart] = useState<ComponentId>("pump");
  const [internalPart, setInternalPart] = useState(0);
  const [subpartFocused, setSubpartFocused] = useState(false);
  const [hoveredPart, setHoveredPart] = useState<ComponentId | null>(null);
  const [hoveredDetailName, setHoveredDetailName] = useState<string | null>(null);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const current = useRef({
    rigs,
    onSelect,
    selectedId,
    onOverview,
    step,
    activePart,
    internalPart,
    subpartFocused,
  });
  current.current = {
    rigs,
    onSelect,
    selectedId,
    onOverview,
    step,
    activePart,
    internalPart,
    subpartFocused,
  };
  const [renderMode, setRenderMode] = useState<"webgl" | "vector" | "unavailable">("webgl");

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const hostNode = node;
    let renderer: Renderer;
    let vector = false;
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", { antialias: true, alpha: false });
      if (!context) throw new Error("WebGL2 unavailable");
      renderer = new T.WebGLRenderer({ canvas, context, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      setRenderMode("webgl");
    } catch {
      try {
        renderer = new SVGRenderer();
        renderer.setQuality("low");
        renderer.setPrecision(1);
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
    scene.background = new T.Color("#383f42");
    scene.fog = new T.Fog("#383f42", 46, 100);
    scene.add(new T.HemisphereLight(0xe7e5df, 0x474c4e, 1.8));
    const keyLight = new T.DirectionalLight(0xfff6e8, 2.35);
    keyLight.position.set(-9, 17, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(512, 512);
    keyLight.shadow.camera.left = -25;
    keyLight.shadow.camera.right = 25;
    keyLight.shadow.camera.top = 24;
    keyLight.shadow.camera.bottom = -24;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 55;
    keyLight.shadow.bias = -0.00025;
    keyLight.shadow.normalBias = 0.025;
    keyLight.shadow.radius = 4;
    scene.add(keyLight);
    const fillLight = new T.DirectionalLight(0xb7c6ca, 0.88);
    fillLight.position.set(10, 9, -8);
    scene.add(fillLight);
    addFloor(scene);

    const positions: T.Vector3Tuple[] = [
      [-8.9, 0, -4.4],
      [2.9, 0, -4.4],
      [-2.9, 0, 4.4],
      [8.9, 0, 4.4],
    ];
    const machines = current.current.rigs.map((rig, index) =>
      createMachine(scene, rig, positions[index]),
    );
    const detailedRig = createRig(scene);
    detailedRig.root.visible = false;
    detailedRig.root.scale.setScalar(0.39);
    scene.traverse((object) => {
      if (object instanceof T.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    function collectVisibleMeshes(roots: T.Object3D[]) {
      const meshes: T.Mesh[] = [];
      for (const root of roots) {
        root.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          for (let parent: T.Object3D | null = object; parent; parent = parent.parent) {
            if (!parent.visible) return;
          }
          meshes.push(object);
        });
      }
      return meshes;
    }
    const camera = new T.PerspectiveCamera(38, 1, 0.1, 120);
    camera.position.set(16.5, 14.2, 24);
    camera.lookAt(0, 0.65, 0);
    const controls = new OrbitControls(camera, node);
    controls.enableDamping = !vector;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.65, 0);
    controls.minDistance = 5.2;
    controls.maxDistance = 43;
    controls.maxPolarAngle = Math.PI * 0.48;
    let width = 1;
    let height = 1;
    let frame = 0;
    let renderingFailed = false;
    let down: { x: number; y: number } | undefined;
    let cameraMove:
      | {
          from: T.Vector3;
          to: T.Vector3;
          targetFrom: T.Vector3;
          targetTo: T.Vector3;
          started: number;
        }
      | undefined;
    let focusedId: RigId | undefined;
    let focusedPart: ComponentId | undefined;
    let focusedInternalPart = 0;
    let focusedSubpart = false;
    let focusedStep: "component" | "subpart" | undefined;
    let hoverPart: ComponentId | undefined;
    let hiddenMachineIndex: number | undefined;
    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    const projected = new T.Vector3();
    const focusPresets: Record<ComponentId, { direction: T.Vector3Tuple; minDistance: number }> = {
      cooler: { direction: [0.5, 0.24, 1], minDistance: 2.05 },
      valve: { direction: [-1, 0.16, 0.62], minDistance: 2.15 },
      pump: { direction: [-1, 0.38, 0.5], minDistance: 2.75 },
      accumulator: { direction: [1, 0.58, 0.42], minDistance: 3.05 },
    };
    function componentCamera(componentId: ComponentId, internalIndex?: number) {
      const preset = focusPresets[componentId];
      const component = detailedRig.components[componentId];
      const focusObject =
        internalIndex === undefined ? component.root : component.parts[internalIndex];
      focusObject.updateWorldMatrix(true, true);
      const bounds = new T.Box3().setFromObject(focusObject);
      const center = bounds.getCenter(new T.Vector3());
      const size = bounds.getSize(new T.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z, 0.2);
      const fitDistance = (maxDimension * 0.62) / Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      const minDistance = internalIndex === undefined ? preset.minDistance : 1.2;
      const distance = Math.max(minDistance, fitDistance);
      const direction = new T.Vector3(...preset.direction).normalize();
      return {
        position: center.clone().addScaledVector(direction, distance),
        target: center,
      };
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = new ResizeObserver(() => {
      if (!node.clientWidth || !node.clientHeight) return;
      width = node.clientWidth;
      height = node.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(node);

    function onPointerDown(event: PointerEvent) {
      down = { x: event.clientX, y: event.clientY };
    }
    function onPointerUp(event: PointerEvent) {
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) {
        down = undefined;
        return;
      }
      down = undefined;
      const bounds = hostNode.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hitTargets = focusedId
        ? Object.values(detailedRig.components).map(({ root }) => root)
        : machines.map(({ root }) => root);
      const hit = raycaster.intersectObjects(collectVisibleMeshes(hitTargets), false)[0]?.object;
      let target: T.Object3D | null = hit ?? null;
      let component: T.Object3D | null = hit ?? null;
      let detailTarget: T.Object3D | null = hit ?? null;
      while (detailTarget && detailTarget.userData.detailPartIndex === undefined)
        detailTarget = detailTarget.parent;
      const partIndex =
        typeof detailTarget?.userData.detailPartIndex === "number"
          ? (detailTarget.userData.detailPartIndex as number)
          : 0;
      while (component && !component.userData.componentId) component = component.parent;
      if (component?.userData.componentId) {
        selectedPart.current = component.userData.componentId as ComponentId;
        setActivePart(selectedPart.current);
        setInternalPart(partIndex);
        setSubpartFocused(Boolean(detailTarget));
        const nextStep = detailTarget ? "subpart" : "component";
        setStep(nextStep);
        const active = current.current.rigs.find((rig) => rig.rigId === focusedId);
        if (active) {
          const states = Object.fromEntries(
            active.components.map(({ id, severity }) => [id, severity]),
          ) as Record<ComponentId, Severity>;
          detailedRig.update(
            "inside",
            selectedPart.current,
            partIndex,
            states,
            Boolean(detailTarget),
          );
          const preset = componentCamera(
            selectedPart.current,
            detailTarget ? partIndex : undefined,
          );
          cameraMove = {
            from: camera.position.clone(),
            to: preset.position,
            targetFrom: controls.target.clone(),
            targetTo: preset.target,
            started: performance.now(),
          };
          controls.minDistance = 1.05;
          controls.maxDistance = 11;
          focusedPart = selectedPart.current;
          focusedInternalPart = partIndex;
          focusedSubpart = Boolean(detailTarget);
          focusedStep = nextStep;
        }
        return;
      }
      while (target && !target.userData.rigId) target = target.parent;
      if (target?.userData.rigId) current.current.onSelect(target.userData.rigId as RigId);
    }
    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointerup", onPointerUp);
    function onPointerMove(event: PointerEvent) {
      if (!focusedId) return;
      const bounds = hostNode.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const componentRoots = Object.values(detailedRig.components).map(({ root }) => root);
      const hit = raycaster.intersectObjects(collectVisibleMeshes(componentRoots), false)[0]
        ?.object;
      let component: T.Object3D | null = hit ?? null;
      let detailTarget: T.Object3D | null = hit ?? null;
      while (detailTarget && detailTarget.userData.detailPartName === undefined)
        detailTarget = detailTarget.parent;
      setHoveredDetailName((detailTarget?.userData.detailPartName as string | undefined) ?? null);
      while (component && !component.userData.componentId) component = component.parent;
      const id = component?.userData.componentId as ComponentId | undefined;
      if (id !== hoverPart) {
        if (hoverPart) detailedRig.components[hoverPart].root.scale.setScalar(1);
        if (id) detailedRig.components[id].root.scale.setScalar(1.035);
        hoverPart = id;
      }
      setHoveredPart(id ?? null);
      hostNode.style.cursor = id ? "pointer" : "grab";
    }
    node.addEventListener("pointermove", onPointerMove);
    function onPointerLeave() {
      if (hoverPart) detailedRig.components[hoverPart].root.scale.setScalar(1);
      hoverPart = undefined;
      setHoveredPart(null);
      setHoveredDetailName(null);
      hostNode.style.cursor = "";
    }
    node.addEventListener("pointerleave", onPointerLeave);

    function draw(now: number) {
      if (renderingFailed) return;
      frame = requestAnimationFrame(draw);
      const active = current.current.rigs.find((rig) => rig.rigId === current.current.selectedId);
      if (active && active.rigId !== focusedId) {
        focusedId = active.rigId;
        focusedPart = undefined;
        focusedSubpart = false;
        setStep("rig");
        const index = current.current.rigs.findIndex((rig) => rig.rigId === active.rigId);
        if (hiddenMachineIndex !== undefined && hiddenMachineIndex !== index)
          machines[hiddenMachineIndex].root.visible = true;
        machines[index].root.visible = false;
        hiddenMachineIndex = index;
        const [x, , z] = positions[index];
        detailedRig.root.position.set(x, 0, z);
        detailedRig.root.visible = true;
        detailedRig.update(
          "cutaway",
          selectedPart.current,
          0,
          Object.fromEntries(active.components.map(({ id, severity }) => [id, severity])) as Record<
            ComponentId,
            Severity
          >,
        );
        cameraMove = {
          from: camera.position.clone(),
          to: new T.Vector3(x + 6.8, 5.3, z + 7.5),
          targetFrom: controls.target.clone(),
          targetTo: new T.Vector3(x, 1.25, z),
          started: now,
        };
        controls.minDistance = 5.2;
        controls.maxDistance = 16;
      } else if (
        active &&
        focusedId === active.rigId &&
        (current.current.step === "component" || current.current.step === "subpart") &&
        (current.current.activePart !== focusedPart ||
          current.current.internalPart !== focusedInternalPart ||
          current.current.subpartFocused !== focusedSubpart ||
          current.current.step !== focusedStep)
      ) {
        const componentChanged = current.current.activePart !== focusedPart;
        const internalViewChanged =
          current.current.internalPart !== focusedInternalPart ||
          current.current.subpartFocused !== focusedSubpart ||
          current.current.step !== focusedStep;
        focusedPart = current.current.activePart;
        focusedInternalPart = current.current.internalPart;
        focusedSubpart = current.current.subpartFocused;
        focusedStep = current.current.step;
        detailedRig.update(
          "inside",
          focusedPart,
          focusedInternalPart,
          Object.fromEntries(active.components.map(({ id, severity }) => [id, severity])) as Record<
            ComponentId,
            Severity
          >,
          focusedSubpart,
        );
        if (componentChanged || internalViewChanged) {
          const focusSubpart =
            current.current.step === "subpart" && focusedSubpart ? focusedInternalPart : undefined;
          const preset = componentCamera(focusedPart, focusSubpart);
          cameraMove = {
            from: camera.position.clone(),
            to: preset.position,
            targetFrom: controls.target.clone(),
            targetTo: preset.target,
            started: now,
          };
          controls.minDistance = 1.05;
          controls.maxDistance = 11;
          controls.minDistance = 1.2;
          controls.maxDistance = 11;
        }
      } else if (
        active &&
        focusedId === active.rigId &&
        current.current.step === "rig" &&
        focusedPart
      ) {
        focusedPart = undefined;
        focusedSubpart = false;
        focusedStep = undefined;
        detailedRig.update(
          "cutaway",
          current.current.activePart,
          0,
          Object.fromEntries(active.components.map(({ id, severity }) => [id, severity])) as Record<
            ComponentId,
            Severity
          >,
        );
        const x = detailedRig.root.position.x;
        const z = detailedRig.root.position.z;
        cameraMove = {
          from: camera.position.clone(),
          to: new T.Vector3(x + 6.8, 5.3, z + 7.5),
          targetFrom: controls.target.clone(),
          targetTo: new T.Vector3(x, 1.25, z),
          started: now,
        };
        controls.minDistance = 5.2;
        controls.maxDistance = 16;
      } else if (!active && focusedId) {
        focusedId = undefined;
        focusedPart = undefined;
        focusedStep = undefined;
        focusedInternalPart = 0;
        setStep("factory");
        if (hiddenMachineIndex !== undefined) machines[hiddenMachineIndex].root.visible = true;
        hiddenMachineIndex = undefined;
        detailedRig.root.visible = false;
        cameraMove = {
          from: camera.position.clone(),
          to: new T.Vector3(16.5, 14.2, 24),
          targetFrom: controls.target.clone(),
          targetTo: new T.Vector3(0, 0.65, 0),
          started: now,
        };
        controls.minDistance = 16;
        controls.maxDistance = 43;
      }
      if (cameraMove) {
        const t0 = Math.min(1, (now - cameraMove.started) / 1250);
        const t = t0 * t0 * (3 - 2 * t0);
        camera.position.lerpVectors(cameraMove.from, cameraMove.to, t);
        controls.target.lerpVectors(cameraMove.targetFrom, cameraMove.targetTo, t);
        if (t0 === 1) cameraMove = undefined;
      }
      const componentFocus = Boolean(
        active && (current.current.step === "component" || current.current.step === "subpart"),
      );
      const selectedIndex = active
        ? current.current.rigs.findIndex((rig) => rig.rigId === active.rigId)
        : -1;
      machines.forEach((machine, index) => {
        machine.root.visible = !active || (!componentFocus && index !== selectedIndex);
        const tag = labels.current[machine.data.rigId];
        if (tag) tag.style.display = componentFocus ? "none" : "";
      });
      if (!reducedMotion) {
        for (const machine of machines) {
          machine.fan.rotation.z = now * 0.0019;
          const material = machine.statusLamp.material as T.MeshStandardMaterial;
          material.emissiveIntensity = 0.14 + (Math.sin(now * 0.0025) + 1) * 0.035;
        }
        if (
          active &&
          (current.current.step === "component" || current.current.step === "subpart")
        ) {
          const state = active.components.find((item) => item.id === current.current.activePart);
          if (state) detailedRig.animate(now, current.current.activePart, state.severity);
        }
      }
      controls.update();
      try {
        renderer.render(scene, camera);
      } catch {
        renderingFailed = true;
        setRenderMode("unavailable");
        return;
      }
      for (const machine of machines) {
        const tag = labels.current[machine.data.rigId];
        if (!tag) continue;
        projected.set(0, 3.65, 0).applyMatrix4(machine.root.matrixWorld).project(camera);
        tag.style.left = `${(projected.x + 1) * 50}%`;
        tag.style.top = `${(1 - projected.y) * 50}%`;
        tag.style.visibility =
          Math.abs(projected.x) < 0.97 && Math.abs(projected.y) < 0.95 ? "visible" : "hidden";
      }
    }
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointerup", onPointerUp);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerleave", onPointerLeave);
      node.style.cursor = "";
      const geometries = new Set<T.BufferGeometry>();
      const materials = new Set<T.Material>();
      scene.traverse((object) => {
        if (object instanceof T.Mesh || object instanceof T.Line || object instanceof T.LineLoop) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      if (renderer instanceof T.WebGLRenderer) renderer.dispose();
      renderer.domElement.remove();
    };
  }, [rendererAttempt]);

  const attentionCount = (rig: RigData) =>
    rig.components.filter((item) => item.severity !== "normal").length;
  const focusedRig = rigs.find((rig) => rig.rigId === selectedId);
  const focusedPart = focusedRig?.components.find((item) => item.id === activePart);
  const partDetails = focusedPart ? rigParts[focusedPart.id].parts : [];
  const degradedTargets = focusedPart
    ? degradationTargets[focusedPart.id][focusedPart.severity]
    : undefined;
  const activeDetail = partDetails[Math.min(internalPart, partDetails.length - 1)];
  const focusedSensor = focusedPart ? sensors[focusedPart.sensor] : undefined;
  const sensorValue =
    focusedPart && focusedSensor
      ? focusedRig?.series[focusedPart.sensor].at(-1)?.toFixed(focusedSensor.decimals)
      : undefined;
  const priority =
    focusedRig && focusedPart
      ? focusedRig.priority.findIndex((item) => item.id === focusedPart.id) + 1
      : undefined;
  const priorityItem = focusedRig?.priority.find((item) => item.severity !== "normal");

  function selectComponent(id: ComponentId) {
    selectedPart.current = id;
    setActivePart(id);
    setInternalPart(0);
    setSubpartFocused(false);
    setStep("component");
  }

  function selectInternalPart(index: number) {
    setInternalPart(index);
    setSubpartFocused(true);
    setStep("subpart");
  }

  return (
    <section className="factory-view" aria-label="공장 내부 3D 설비 배치">
      <div className="factory-heading">
        <div>
          <h2>공장 전체 3D 모니터링</h2>
          <p>설비를 선택해 상태를 확인하고, 구성품과 내부 부품으로 이동합니다.</p>
        </div>
        <div className="rig-legend" aria-label="상태 범례">
          {(["risk", "caution", "normal"] as const).map((severity) => (
            <span key={severity}>
              <i style={{ background: severityColors[severity] }} />
              {statusText[severity]}
            </span>
          ))}
        </div>
      </div>
      <div className="factory-notice">
        <ProvenanceTag kind="uci" />
        <ProvenanceTag kind="virtual" />
        <TermHelp term="이 화면 안내">
          네 개 설비는 UCI 유압 시험장치 사이클을 나눠 배정한 교육용 가상 설비입니다. 현장 실시간
          수집값이 아닙니다.
        </TermHelp>
      </div>
      {focusedRig && (
        <nav className="factory-breadcrumb" aria-label="3D 설비 탐색 위치">
          <button onClick={onOverview}>공장 전체</button>
          <span aria-hidden="true">/</span>
          <button onClick={() => setStep("rig")} aria-current={step === "rig" ? "step" : undefined}>
            {focusedRig.rigId}
          </button>
          {focusedPart && (
            <>
              <span aria-hidden="true">/</span>
              <button
                onClick={() => setStep("component")}
                aria-current={step === "component" ? "step" : undefined}
              >
                {focusedPart.name}
              </button>
            </>
          )}
          {step === "subpart" && activeDetail && (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="step">{activeDetail.name}</span>
            </>
          )}
        </nav>
      )}
      <div className={`factory-explorer ${focusedRig ? "has-inspector" : ""}`}>
        <div className="factory-stage-wrap">
          <div
            className="factory-stage"
            ref={host}
            aria-label="공장 3D 모델. 설비 목록과 구성품 목록은 키보드로도 선택할 수 있습니다."
          />
          {rigs.map((rig) => (
            <button
              key={rig.rigId}
              className="factory-rig-tag"
              ref={(element) => {
                labels.current[rig.rigId] = element;
              }}
              style={{ "--factory-status": severityColors[rig.overallSeverity] } as CSSProperties}
              onClick={() => onSelect(rig.rigId)}
              aria-label={`${rig.rigId} ${rig.rigName}, ${statusText[rig.overallSeverity]}, 이상 구성품 ${attentionCount(rig)}개, Cycle ${rig.cycleId}, 선택해 확대`}
            >
              <span className="factory-tag-top">
                <strong>{rig.rigId}</strong>
                <i />
                {statusText[rig.overallSeverity]}
              </span>
              <span className="factory-tag-name">{rig.rigName}</span>
              <small>
                이상 구성품 {attentionCount(rig)}개 · Cycle {rig.cycleId}
              </small>
            </button>
          ))}
          {hoveredPart && step !== "factory" && (
            <span className="factory-hover-label">
              {focusedRig?.components.find((item) => item.id === hoveredPart)?.name}
              {hoveredDetailName
                ? ` · ${hoveredDetailName}`
                : step === "rig"
                  ? " · 클릭해 내부 보기"
                  : ""}
            </span>
          )}
          {renderMode === "unavailable" && (
            <div className="factory-fallback" role="alert">
              <strong>3D 설비 화면을 불러오지 못했습니다.</strong>
              <span>재시도하거나 2D 상태 목록에서 진단 결과를 확인하세요.</span>
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
          <div className="factory-hint">
            <Icon name="mouse" size={15} /> 드래그·휠로 탐색 · 설비 라벨은 Tab과 Enter로 선택
          </div>
          <span className="factory-render-mode">
            {renderMode === "vector"
              ? "호환 렌더러"
              : renderMode === "unavailable"
                ? "3D 사용 불가"
                : "UCI 사이클 기반 개념 모델"}
          </span>
        </div>
        {focusedRig && (
          <aside
            className="factory-inspector"
            aria-label={`${focusedRig.rigId} ${focusedRig.rigName} 상세`}
          >
            <div className="factory-inspector-heading">
              <div>
                <h3>
                  {step === "rig"
                    ? focusedRig.rigName
                    : step === "component"
                      ? focusedPart?.name
                      : activeDetail?.name}
                </h3>
                <p>
                  {focusedRig.rigId} · Cycle {String(focusedRig.cycleId).padStart(4, "0")}
                </p>
              </div>
              <span className={`rig-status ${focusedRig.overallSeverity}`}>
                <i />
                {statusText[focusedRig.overallSeverity]}
              </span>
            </div>
            {step === "rig" && (
              <>
                <p className="factory-inspector-lede">
                  구성품 상태를 선택해 센서 근거와 점검 권고를 확인하세요.
                </p>
                <ul className="factory-component-list">
                  {focusedRig.components.map((item) => (
                    <li key={item.id}>
                      <button
                        className="factory-component-option"
                        aria-pressed={activePart === item.id}
                        onClick={() => selectComponent(item.id)}
                      >
                        <span>{item.name}</span>
                        <span className={`rig-status ${item.severity}`}>
                          <i />
                          {statusText[item.severity]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {priorityItem && (
                  <div className="factory-priority-note">
                    <strong>먼저 확인</strong>
                    <span>
                      {priorityItem.name} · {priorityItem.action}
                    </span>
                  </div>
                )}
                <details className="factory-sensor-disclosure">
                  <summary>센서 6개 요약 보기</summary>
                  <dl>
                    {(
                      Object.entries(sensors) as [
                        keyof typeof sensors,
                        (typeof sensors)[keyof typeof sensors],
                      ][]
                    ).map(([id, sensor]) => (
                      <div key={id}>
                        <dt>
                          {sensor.name} <small>{id}</small>
                        </dt>
                        <dd>
                          {focusedRig.series[id].at(-1)?.toFixed(sensor.decimals)} {sensor.unit}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <small>60초 UCI 실험 사이클의 마지막 샘플</small>
                </details>
              </>
            )}
            {step === "component" && focusedPart && (
              <>
                <div className="factory-state-line">
                  <span className={`rig-status ${focusedPart.severity}`}>
                    <i />
                    {statusText[focusedPart.severity]}
                  </span>
                  <span>
                    {focusedPart.metric}: {focusedPart.value} {focusedPart.unit}
                  </span>
                </div>
                <dl className="factory-evidence-list">
                  <div>
                    <dt>
                      <TermHelp term="실험 라벨">
                        UCI 시험 중 기록된 구성품 상태입니다. 물리적 마모 위치를 측정한 값은
                        아닙니다.
                      </TermHelp>
                    </dt>
                    <dd>{focusedPart.description}</dd>
                  </div>
                  <div>
                    <dt>관련 센서 · 사이클 마지막 값</dt>
                    <dd>
                      {focusedSensor?.name} ({focusedPart.sensor}) · {sensorValue}{" "}
                      {focusedSensor?.unit}
                    </dd>
                  </div>
                  <div>
                    <dt>권장 점검</dt>
                    <dd>{focusedPart.action}</dd>
                  </div>
                  <div>
                    <dt>설비 내 정렬 순위</dt>
                    <dd>
                      {priority} / {focusedRig.components.length}
                    </dd>
                  </div>
                </dl>
                <details className="factory-education-note">
                  <summary>교육용 열화 표현</summary>
                  <TermHelp term="열화">
                    구성품의 성능이나 상태 저하를 가리킵니다. 강조 부위는 실험 라벨에 연결한 교육용
                    메커니즘 예시이지, 실제 손상 위치 측정값이 아닙니다.
                  </TermHelp>
                  <p>
                    {degradedTargets?.labels.length
                      ? `이 상태에서 3D로 강조하는 예시: ${degradedTargets.labels.join(" · ")}`
                      : "현재 실험 라벨에서 교육용으로 강조할 열화 부위가 없습니다."}
                  </p>
                </details>
                <button
                  className="primary-button factory-next-action"
                  onClick={() => setStep("subpart")}
                >
                  내부 부품과 구조 보기 <Icon name="forward" size={16} />
                </button>
                <button className="factory-secondary-action" onClick={() => setStep("rig")}>
                  다른 구성품 선택
                </button>
              </>
            )}
            {step === "subpart" && focusedPart && activeDetail && (
              <>
                <p className="factory-inspector-lede">
                  선택 부품을 3D 모델에서 확대해 표시합니다. 위치와 열화 표시는 교육용 개념
                  모델입니다.
                </p>
                <div className="factory-selected-part">
                  <strong>{activeDetail.name}</strong>
                  <span>{activeDetail.desc}</span>
                  <span
                    className={
                      degradedTargets?.partIndices.includes(internalPart)
                        ? `part-condition ${focusedPart.severity}`
                        : "part-condition neutral"
                    }
                  >
                    {degradedTargets?.partIndices.includes(internalPart)
                      ? "교육용 열화 표현"
                      : "구조 설명"}
                  </span>
                </div>
                <p className="factory-list-label">내부 부품 선택</p>
                <ul className="factory-part-list">
                  {partDetails.map((part, index) => {
                    const degraded = degradedTargets?.partIndices.includes(index) ?? false;
                    return (
                      <li key={part.name}>
                        <button
                          className="factory-part-option"
                          aria-pressed={internalPart === index && step === "subpart"}
                          onClick={() => selectInternalPart(index)}
                        >
                          <span>{part.name}</span>
                          <small>{degraded ? "열화 예시" : "구조"}</small>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <dl className="factory-evidence-list factory-subpart-evidence">
                  <div>
                    <dt>구성품 상태</dt>
                    <dd>
                      {focusedPart.name} · {statusText[focusedPart.severity]}
                    </dd>
                  </div>
                  <div>
                    <dt>관련 센서값</dt>
                    <dd>
                      {focusedSensor?.name} · {sensorValue} {focusedSensor?.unit}
                    </dd>
                  </div>
                  <div>
                    <dt>권장 점검</dt>
                    <dd>{focusedPart.action}</dd>
                  </div>
                </dl>
                <details className="factory-education-note">
                  <summary>상태 해석 안내</summary>
                  <p>
                    {focusedPart.description} 이 설명은 실험 라벨을 바탕으로 한 교육용 안내이며
                    원인을 확정하지 않습니다.
                  </p>
                </details>
                <button className="factory-secondary-action" onClick={() => setStep("component")}>
                  구성품 상세로 돌아가기
                </button>
              </>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
