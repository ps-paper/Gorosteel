import * as T from "three";
import type { ComponentId, Severity } from "./monitoring";
import { severityColors } from "./severity-colors";
export { severityColors } from "./severity-colors";

type Point = [number, number, number];
type Material = T.MeshStandardMaterial;
export type RigView = "cutaway" | "overall" | "inside";

export const rigParts = {
  cooler: {
    code: "HX-01",
    role: "순환하는 작동유의 열을 외부 공기로 방출합니다.",
    parts: [
      { name: "열교환 핀", desc: "금속 핀이 공기와 접촉하는 면적을 넓혀 열을 방출합니다." },
      { name: "유로 튜브", desc: "작동유가 지나는 굽은 유로가 열을 핀에 전달합니다." },
      { name: "냉각 팬", desc: "팬이 코어 뒤에서 공기를 끌어당겨 냉각을 돕습니다." },
      { name: "열교환 코어", desc: "튜브와 핀으로 열이 전달되는 교육용 코어 구조입니다." },
    ],
  },
  valve: {
    code: "CV-02",
    role: "스풀의 위치에 따라 작동유가 흐르는 방향을 바꿉니다.",
    parts: [
      { name: "밸브 스풀", desc: "스풀이 좌우로 이동하며 밸브의 연결 유로를 전환합니다." },
      { name: "복귀 스프링", desc: "구동력이 사라지면 스풀을 기준 위치로 복귀시킵니다." },
      { name: "매니폴드 유로", desc: "공급·반환 포트와 작동 포트를 내부 통로로 연결합니다." },
    ],
  },
  pump: {
    code: "PU-03",
    role: "모터 구동력을 유압 에너지로 바꿔 작동유를 공급합니다.",
    parts: [
      {
        name: "구동 기어 / 종동 기어",
        desc: "맞물린 두 기어가 오일을 흡입해 하우징 벽을 따라 토출구로 이송합니다.",
      },
      {
        name: "로터와 구동축",
        desc: "로터가 발생시킨 회전력이 축을 통해 펌프의 구동 기어로 전달됩니다.",
      },
      { name: "스테이터 권선", desc: "고정된 권선이 회전자에 필요한 자기장을 형성합니다." },
      { name: "내부 누설 경로", desc: "고압측 오일이 저압측으로 되돌아가는 교육용 누설 경로입니다." },
      { name: "씰 인접부", desc: "내부 압력 손실과 연관된 씰 주변을 나타내는 개념 구조입니다." },
    ],
  },
  accumulator: {
    code: "AC-04",
    role: "압축 가스로 에너지를 저장하고 회로의 압력 변동을 완화합니다.",
    parts: [
      {
        name: "가스 블래더",
        desc: "질소가 든 탄성 주머니가 팽창하거나 압축되며 유압 에너지를 저장합니다.",
      },
      { name: "오일 챔버", desc: "블래더 바깥 공간으로 작동유가 들어오고 나갑니다." },
      { name: "압력 게이지 / 충전 밸브", desc: "게이지로 충전 상태를 읽고 상단 밸브로 블래더의 가스 압력을 설정합니다." },
    ],
  },
} as const;

export const degradationTargets: Record<ComponentId, Record<Severity, { labels: string[]; partIndices: number[] }>> = {
  cooler: {
    normal: { labels: [], partIndices: [] },
    caution: { labels: ["열교환 핀", "유로 튜브"], partIndices: [0, 1] },
    risk: { labels: ["열교환 핀", "유로 튜브", "열교환 코어"], partIndices: [0, 1, 3] },
  },
  valve: {
    normal: { labels: [], partIndices: [] },
    caution: { labels: ["밸브 스풀"], partIndices: [0] },
    risk: { labels: ["밸브 스풀", "매니폴드 유로"], partIndices: [0, 2] },
  },
  pump: {
    normal: { labels: [], partIndices: [] },
    caution: { labels: ["내부 누설 경로"], partIndices: [3] },
    risk: { labels: ["내부 누설 경로", "씰 인접부"], partIndices: [3, 4] },
  },
  accumulator: {
    normal: { labels: [], partIndices: [] },
    caution: { labels: ["압력 게이지", "가스 블래더"], partIndices: [2, 0] },
    risk: { labels: ["압력 게이지", "가스 블래더", "오일 챔버"], partIndices: [2, 0, 1] },
  },
};

function finish(color: string, metalness = 0.7, roughness = 0.29) {
  return new T.MeshStandardMaterial({ color, metalness, roughness });
}

const steel = finish("#a8b9ca", 0.78, 0.27);
const chrome = finish("#e2ebf6", 0.9, 0.2);
const dark = finish("#283647", 0.62, 0.38);
const rubber = finish("#171e29", 0.15, 0.65);
const brass = finish("#c3904b", 0.78, 0.27);
const copper = finish("#c6784a", 0.78, 0.31);
const frame = finish("#8c9db1", 0.76, 0.22);
const ocean = finish("#42b5ee", 0.46, 0.33);

function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: Material, p: Point) {
  const object = new T.Mesh(geometry, material);
  object.position.set(...p);
  parent.add(object);
  return object;
}

function box(parent: T.Object3D, p: Point, [w, h, d]: Point, material = steel) {
  return mesh(parent, new T.BoxGeometry(w, h, d), material, p);
}

function cylinder(
  parent: T.Object3D,
  p: Point,
  r: number,
  h: number,
  material = steel,
  axis = "y",
  sides = 28,
  top = r,
) {
  const result = mesh(parent, new T.CylinderGeometry(top, r, h, sides), material, p);
  if (axis === "x") result.rotation.z = -Math.PI / 2;
  if (axis === "z") result.rotation.x = Math.PI / 2;
  return result;
}

function ball(parent: T.Object3D, p: Point, radii: Point, material: Material) {
  const result = mesh(parent, new T.SphereGeometry(1, 24, 16), material, p);
  result.scale.set(...radii);
  return result;
}

function pipe(parent: T.Object3D, points: Point[], r = 0.064, material = chrome) {
  const path = new T.CurvePath<T.Vector3>();
  const vertices = points.map((p) => new T.Vector3(...p));
  let start = vertices[0];
  for (let i = 1; i < vertices.length - 1; i++) {
    const middle = vertices[i];
    const depth = Math.min(
      0.22,
      middle.distanceTo(vertices[i - 1]) / 2,
      middle.distanceTo(vertices[i + 1]) / 2,
    );
    const before = middle.clone().lerp(vertices[i - 1], depth / middle.distanceTo(vertices[i - 1]));
    const after = middle.clone().lerp(vertices[i + 1], depth / middle.distanceTo(vertices[i + 1]));
    path.add(new T.LineCurve3(start, before));
    path.add(new T.QuadraticBezierCurve3(before, middle, after));
    start = after;
  }
  path.add(new T.LineCurve3(start, vertices[vertices.length - 1]));
  return mesh(
    parent,
    new T.TubeGeometry(path, Math.max(8, vertices.length * 7), r, 10, false),
    material,
    [0, 0, 0],
  );
}

function fasteners(parent: T.Object3D, x: number, y: number, z: number, dx: number, dy: number) {
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      cylinder(parent, [x + a * dx, y + b * dy, z], 0.073, 0.06, chrome, "z", 6);
}

function part(parent: T.Object3D, name: string, offset: Point = [0, 0, 0]) {
  const group = new T.Group();
  group.name = name;
  group.position.set(...offset);
  parent.add(group);
  return group;
}

function makeComponent(parent: T.Object3D, id: ComponentId, position: Point, pin: Point) {
  const root = part(parent, id, position);
  root.userData.componentId = id;
  return {
    root,
    position,
    pin: new T.Vector3(...pin),
    casing: part(root, "casing"),
    cut: part(root, "cutaway"),
    fixed: part(root, "fixed"),
    coat: finish("#526779", 0.67, 0.31),
    parts: rigParts[id].parts.map(({ name }, index) => {
      const detail = part(root, name);
      detail.userData.detailPartIndex = index;
      detail.userData.detailPartName = name;
      return detail;
    }),
  };
}

function makeCooler(parent: T.Object3D) {
  const m = makeComponent(parent, "cooler", [-3.37, 2.66, 0.61], [-0.24, 0.26, 1.07]);
  const [fins, tubes, fan, core] = m.parts;
  // The dark rear backing plate belongs to the removable casing, not the exposed internals.
  // Keeping it in `fixed` leaves a solid slab in front of the cutaway view.
  box(m.casing, [0, 0, -0.31], [2.31, 2.4, 0.2], dark);
  for (const x of [-1.18, 1.18]) {
    box(m.fixed, [x, 0, 0.03], [0.18, 2.66, 0.74], m.coat);
    cylinder(m.fixed, [x, 1.43, -0.15], 0.14, 0.42, brass, "y", 8);
    cylinder(m.fixed, [x, -1.42, -0.15], 0.14, 0.34, chrome, "y", 8);
  }
  for (const y of [-1.26, 1.26]) {
    box(m.fixed, [0, y, 0.03], [2.56, 0.17, 0.74], steel);
    box(m.fixed, [0, y, 0.37], [2.33, 0.06, 0.03], chrome);
  }
  const coreMaterial = finish("#64b8d4", 0.24, 0.44);
  coreMaterial.userData.coolerCore = true;
  coreMaterial.emissive.set("#3a9dbd");
  coreMaterial.emissiveIntensity = 0.16;
  box(core, [0, 0, -0.12], [1.88, 2.08, 0.27], coreMaterial);
  for (let row = 0; row < 8; row++)
    box(core, [0, -0.84 + row * 0.24, 0.035], [1.98, 0.035, 0.035], chrome);
  fasteners(m.fixed, 0, 0, 0.46, 1.18, 1.17);
  box(m.casing, [0, 0, 0.28], [2.13, 2.31, 0.19], dark);
  for (let i = 0; i < 29; i++) {
    box(m.casing, [0, -1.1 + i * 0.079, 0.42], [2.12, 0.022, 0.1], i % 5 === 0 ? steel : chrome);
    box(fins, [-0.61, -1.04 + i * 0.074, 0.29], [0.86, 0.022, 0.34], i % 5 === 0 ? steel : frame);
  }
  const fouling = part(fins, "educational-fouling-cues");
  fouling.userData.foulingCues = true;
  const foulingMaterial = finish("#b87538", 0.12, 0.8);
  foulingMaterial.emissive.set("#7b351c");
  for (let i = 0; i < 12; i++) {
    const cue = box(fouling, [-0.61 + (i % 3) * 0.23, -1.0 + Math.floor(i / 3) * 0.49, 0.475], [0.16, 0.12, 0.025], foulingMaterial);
    cue.name = "conceptual-fin-fouling";
  }
  for (const x of [-0.99, -0.23, 0.38, 0.97])
    box(m.casing, [x, 0, 0.465], [0.026, 2.24, 0.032], frame);
  const bends: Point[] = [];
  for (let row = 0; row < 7; row++) {
    const y = 0.9 - row * 0.3;
    const side = row % 2 ? -1 : 1;
    bends.push([-0.98 * side, y, 0.13], [0.96 * side, y, 0.13]);
  }
  const flowMaterial = finish("#48b7e5", 0.18, 0.34);
  flowMaterial.userData.coolerFlow = true;
  flowMaterial.emissive.set("#1688bb");
  flowMaterial.emissiveIntensity = 0.5;
  const flowTube = pipe(tubes, bends, 0.049, flowMaterial);
  flowTube.name = "coolant-flow-tube";
  cylinder(fan, [0.48, 0, -0.2], 0.71, 0.07, steel, "z");
  cylinder(fan, [0.48, 0, -0.14], 0.63, 0.07, rubber, "z");
  cylinder(fan, [0.48, 0, -0.064], 0.18, 0.12, chrome, "z");
  for (let i = 0; i < 7; i++) {
    const vane = part(fan, "vane", [0.48, 0, -0.005]);
    vane.rotation.z = (i * Math.PI * 2) / 7;
    box(vane, [0.32, 0.07, 0], [0.44, 0.16, 0.047], steel).rotation.z = 0.42;
  }
  return m;
}

function makeValve(parent: T.Object3D) {
  const m = makeComponent(parent, "valve", [-0.22, 2.8, 0.21], [-0.09, 0.43, 0.98]);
  const [spool, springs, ports] = m.parts;
  box(m.casing, [0, 0, 0], [2.18, 0.84, 0.76], m.coat);
  box(m.casing, [0, 0, 0.4], [2.03, 0.65, 0.09], steel);
  fasteners(m.casing, 0, 0, 0.47, 0.88, 0.24);
  box(m.cut, [0, -0.32, 0], [2.18, 0.19, 0.78], m.coat);
  box(m.cut, [0, 0.32, -0.19], [2.18, 0.19, 0.41], m.coat);
  box(m.cut, [0, 0, -0.33], [2.18, 0.67, 0.2], m.coat);
  for (const x of [-1.2, 1.2]) {
    cylinder(m.fixed, [x, 0, 0], 0.27, 0.25, chrome, "x", 8);
    cylinder(m.fixed, [x * 1.29, 0, 0], 0.23, 0.4, dark, "x", 8);
    box(m.fixed, [x * 1.29, 0.27, 0], [0.29, 0.16, 0.25], m.coat);
  }
  for (const x of [-0.68, -0.26, 0.29, 0.76]) {
    cylinder(m.fixed, [x, 0.52, -0.07], 0.108, 0.26, brass, "y", 8);
    cylinder(m.fixed, [x, -0.51, -0.07], 0.108, 0.24, chrome, "y", 8);
    cylinder(ports, [x, 0.16, -0.015], 0.067, 0.49, ocean, "y", 16);
    cylinder(ports, [x, -0.22, -0.02], 0.066, 0.32, ocean, "y", 16);
  }
  cylinder(spool, [0, -0.04, 0.17], 0.088, 1.67, chrome, "x");
  for (const x of [-0.59, -0.19, 0.28, 0.63])
    cylinder(spool, [x, -0.04, 0.17], 0.158, 0.15, brass, "x");
  for (const a of [-1, 1]) {
    const helix = Array.from({ length: 81 }, (_, i) => {
      const t = i / 80;
      return new T.Vector3(
        a * (0.78 + t * 0.28),
        -0.04 + Math.cos(t * 8 * Math.PI) * 0.137,
        0.17 + Math.sin(t * 8 * Math.PI) * 0.137,
      );
    });
    mesh(
      springs,
      new T.TubeGeometry(new T.CatmullRomCurve3(helix), 76, 0.017, 7, false),
      chrome,
      [0, 0, 0],
    );
  }
  return m;
}

function gear(parent: T.Object3D, x: number, y: number, z: number, material: Material) {
  const shape = new T.Shape();
  for (let t = 0; t < 48; t++) {
    const r = t % 4 === 0 || t % 4 === 3 ? 0.195 : 0.237;
    const a = ((t + 1) / 48) * Math.PI * 2;
    if (!t) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  mesh(
    parent,
    new T.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 1,
    }),
    material,
    [x, y, z],
  );
  cylinder(parent, [x, y, z + 0.15], 0.083, 0.08, dark, "z", 16);
}

function makePump(parent: T.Object3D) {
  const m = makeComponent(parent, "pump", [1.1, 1.1, 1.24], [0.35, 0.04, 0.95]);
  const [gears, shaft, windings, leakDetail, sealDetail] = m.parts;
  const leakMaterial = finish("#f0a43b", 0.12, 0.42);
  leakMaterial.emissive.set("#f0a43b");
  leakMaterial.emissiveIntensity = 0.8;
  const leakPath = pipe(leakDetail, [[-0.42, -0.28, 0.5], [-0.42, -0.08, 0.5], [-0.12, 0.15, 0.5], [0.4, 0.15, 0.5]], 0.035, leakMaterial);
  leakPath.name = "conceptual-internal-leak-path";
  leakDetail.userData.leakPath = leakPath;
  const severeLeakMaterial = finish("#ef5261", 0.08, 0.35);
  severeLeakMaterial.emissive.set("#ef344a");
  const severeLeak = pipe(leakDetail, [[-0.45, -0.38, 0.53], [-0.3, -0.12, 0.53], [0.02, 0.22, 0.53], [0.48, 0.22, 0.53]], 0.062, severeLeakMaterial);
  severeLeak.name = "conceptual-severe-internal-leak-path";
  leakDetail.userData.severeLeakPath = severeLeak;
  const sealMaterial = finish("#e9a64c", 0.15, 0.5);
  sealMaterial.emissive.set("#b56b32");
  const sealZone = mesh(sealDetail, new T.TorusGeometry(0.29, 0.035, 8, 32), sealMaterial, [0.45, 0, 0.54]);
  sealZone.rotation.y = Math.PI / 2;
  sealZone.name = "conceptual-seal-adjacent-zone";
  sealDetail.userData.sealZone = sealZone;
  box(m.fixed, [0.36, -0.67, 0], [1.92, 0.14, 1.32], dark);
  for (const x of [-0.38, 1.02]) {
    box(m.fixed, [x, -0.49, 0], [0.25, 0.31, 1.06], m.coat);
    for (const z of [-0.49, 0.49]) cylinder(m.fixed, [x, -0.57, z], 0.072, 0.09, chrome, "y", 6);
  }
  cylinder(m.casing, [0.45, 0, 0], 0.6, 1.53, m.coat, "x");
  cylinder(m.casing, [1.24, 0, 0], 0.62, 0.22, m.coat, "x", 32, 0.53);
  cylinder(m.fixed, [-0.42, 0, 0], 0.58, 0.14, steel, "x");
  cylinder(m.fixed, [-0.64, 0, 0], 0.24, 0.34, chrome, "x");
  cylinder(m.fixed, [-1.69, 0, 0], 0.18, 0.26, chrome, "x");
  box(m.fixed, [-1.03, 0.07, -0.05], [0.9, 0.81, 0.55], m.coat);
  box(m.casing, [-1.03, 0.07, 0.3], [0.87, 0.77, 0.23], steel);
  fasteners(m.casing, -1.03, 0.07, 0.44, 0.34, 0.3);
  cylinder(m.fixed, [-1.12, 0.57, -0.03], 0.13, 0.27, brass, "y", 8);
  cylinder(m.fixed, [-1.19, -0.4, -0.04], 0.13, 0.23, chrome, "y", 8);
  for (let i = 0; i < 22; i++) {
    const angle = (i * Math.PI * 2) / 22;
    const rib = box(
      m.casing,
      [0.45, Math.cos(angle) * 0.62, Math.sin(angle) * 0.62],
      [1.43, 0.14, 0.043],
      m.coat,
    );
    rib.rotation.x = angle;
    if (Math.sin(angle) < 0.12) {
      const backRib = box(
        m.cut,
        [0.45, Math.cos(angle) * 0.62, Math.sin(angle) * 0.62],
        [1.43, 0.14, 0.043],
        m.coat,
      );
      backRib.rotation.x = angle;
    }
  }
  const halfShell = mesh(
    m.cut,
    new T.CylinderGeometry(0.59, 0.59, 1.53, 40, 1, true, Math.PI / 2, Math.PI),
    m.coat,
    [0.45, 0, 0],
  );
  halfShell.rotation.z = -Math.PI / 2;
  box(m.casing, [0.49, 0.64, -0.09], [0.74, 0.25, 0.59], m.coat);
  box(m.casing, [0.49, 0.79, -0.09], [0.79, 0.07, 0.63], dark);
  gear(gears, -1.23, 0.08, 0.29, brass);
  gear(gears, -0.82, 0.105, 0.29, chrome);
  cylinder(shaft, [0.23, 0, 0.01], 0.084, 2.92, chrome, "x");
  cylinder(shaft, [0.48, 0, 0.01], 0.26, 1.23, steel, "x");
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10;
    box(
      shaft,
      [0.48, Math.cos(a) * 0.26, Math.sin(a) * 0.26],
      [1.23, 0.036, 0.038],
      copper,
    ).rotation.x = a;
  }
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 8 + (Math.PI * 1.45 * i) / 11;
    const y = Math.cos(a) * 0.43;
    const z = -Math.sin(a) * 0.43;
    pipe(
      windings,
      [
        [-0.15, y, z],
        [0.96, y, z],
        [1.07, y * 1.18, z * 1.18],
        [0, y * 1.18, z * 1.18],
      ],
      0.028,
      copper,
    );
  }
  return m;
}

function vesselSkin(parent: T.Object3D, material: Material, half: boolean) {
  const profile = [
    [0.1, -1.39],
    [0.27, -1.35],
    [0.48, -1.23],
    [0.61, -1.05],
    [0.66, -0.86],
    [0.66, 0.87],
    [0.62, 1.05],
    [0.51, 1.2],
    [0.32, 1.32],
    [0.1, 1.36],
  ].map(([x, y]) => new T.Vector2(x, y));
  return mesh(
    parent,
    new T.LatheGeometry(profile, 48, half ? Math.PI / 2 : 0, half ? Math.PI : Math.PI * 2),
    material,
    [0, 0, 0],
  );
}

function makeAccumulator(parent: T.Object3D) {
  const m = makeComponent(parent, "accumulator", [3.84, 2.8, -0.4], [0.16, 0.27, 0.96]);
  const [bladder, oil, charge] = m.parts;
  const shell = m.coat.clone();
  shell.side = T.DoubleSide;
  vesselSkin(m.casing, m.coat, false);
  vesselSkin(m.cut, shell, true);
  m.cut.userData.shell = shell;
  for (const y of [-0.84, 0.8]) cylinder(m.fixed, [0, y, 0], 0.671, 0.06, steel, "y", 40);
  cylinder(m.fixed, [0, -1.42, 0], 0.24, 0.2, chrome, "y", 8);
  cylinder(m.fixed, [0, -1.58, 0], 0.12, 0.24, brass, "y", 8);
  for (const parent of [charge, m.casing]) {
    cylinder(parent, [0, 1.46, 0], 0.15, 0.24, brass, "y", 8);
    cylinder(parent, [0, 1.62, 0], 0.1, 0.14, steel, "y", 12);
  }
  cylinder(charge, [0.48, 0.76, 0.57], 0.23, 0.09, dark, "z", 24);
  cylinder(charge, [0.48, 0.76, 0.625], 0.19, 0.025, finish("#eaf4fa", 0.12, 0.3), "z", 24);
  for (let mark = 0; mark < 7; mark++) {
    const angle = -Math.PI * 0.78 + (Math.PI * 1.56 * mark) / 6;
    const tick = box(charge, [0.48 + Math.sin(angle) * 0.145, 0.76 + Math.cos(angle) * 0.145, 0.645], [0.014, 0.045, 0.012], brass);
    tick.rotation.z = -angle;
  }
  const gaugeNeedle = box(charge, [0.48, 0.82, 0.654], [0.014, 0.12, 0.015], finish(severityColors.normal, 0.12, 0.3));
  gaugeNeedle.name = "pressure-gauge-needle";
  charge.userData.gaugeNeedle = gaugeNeedle;
  ball(bladder, [0, 0.39, 0], [0.49, 0.83, 0.48], finish("#b78bed", 0.18, 0.37));
  cylinder(bladder, [0, 1.1, 0], 0.13, 0.35, rubber, "y", 18);
  const fluid = ocean.clone();
  fluid.transparent = true;
  fluid.opacity = 0.65;
  cylinder(oil, [0, -0.8, 0], 0.52, 0.57, fluid, "y", 32);
  cylinder(oil, [0, -0.49, 0], 0.525, 0.025, ocean, "y", 32);
  return m;
}

function enclosure(parent: T.Object3D) {
  const base = part(parent, "machine-frame");
  const transparent = part(base, "enclosure");
  box(base, [0, 0.27, 0], [10.64, 0.32, 4.2], steel);
  box(base, [0, 0.47, 0], [10.45, 0.1, 4.02], frame);
  box(base, [-2.86, 0.8, -0.37], [4.07, 0.57, 2.22], dark);
  box(base, [-2.86, 1.11, -0.37], [4.2, 0.08, 2.31], steel);
  box(base, [-2.86, 0.78, 0.77], [3.72, 0.26, 0.025], frame);
  const grille = part(base, "reservoir-grille", [-3.37, 0.81, 0.797]);
  for (let i = 0; i < 13; i++) box(grille, [-1.14 + i * 0.16, 0, 0], [0.095, 0.13, 0.018], dark);
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      cylinder(base, [a * 4.86, 0.074, b * 1.8], 0.29, 0.14, rubber, "y", 24);
      cylinder(base, [a * 4.86, 0.16, b * 1.8], 0.18, 0.1, chrome);
    }
  const glass = new T.MeshStandardMaterial({
    color: "#8daed8",
    metalness: 0.22,
    roughness: 0.11,
    transparent: true,
    opacity: 0.095,
    depthWrite: false,
    side: T.DoubleSide,
  });
  for (const x of [-5.14, 0.25, 5.14])
    for (const z of [-1.96, 1.96]) {
      const post = z < 0 ? base : transparent;
      box(post, [x, 2.43, z], [0.103, 3.94, 0.103], frame);
      box(post, [x, 2.43, z + 0.059], [0.022, 3.71, 0.018], chrome);
      for (const y of [0.65, 2.35, 4.27]) {
        box(post, [x, y, z], [0.2, 0.14, 0.17], dark);
        cylinder(post, [x, y, z + 0.096], 0.043, 0.024, chrome, "z", 6);
      }
    }
  for (const z of [-1.96, 1.96]) {
    box(z < 0 ? base : transparent, [0, 4.44, z], [10.38, 0.11, 0.11], frame);
    box(base, [0, 0.56, z], [10.44, 0.11, 0.1], frame);
  }
  for (const x of [-5.14, 0.25, 5.14]) box(base, [x, 4.44, 0], [0.11, 0.11, 3.92], frame);
  box(transparent, [0, 2.46, 1.97], [10.26, 3.8, 0.016], glass);
  box(transparent, [0, 4.45, 0], [10.24, 0.014, 3.9], glass);
  box(base, [0, 2.46, -1.97], [10.26, 3.8, 0.016], glass);
  for (const x of [-5.14, 5.14]) box(transparent, [x, 2.44, 0], [0.016, 3.78, 3.94], glass);
  return { base, transparent };
}

export function createRig(scene: T.Scene) {
  const root = part(scene, "hydraulic-rig");
  const { base, transparent } = enclosure(root);
  const pipes = part(root, "hydraulic-lines");
  const paths: Array<[Point[], number, Material]> = [
    [
      [
        [-4.55, 4.12, 0.46],
        [-4.55, 4.25, -0.94],
        [-1.76, 4.25, -0.94],
        [-1.76, 3.65, -0.94],
        [-0.9, 3.65, -0.94],
        [-0.9, 3.35, 0.14],
      ],
      0.077,
      chrome,
    ],
    [
      [
        [-2.2, 4.12, 0.46],
        [-2.2, 3.94, -1.18],
        [1.1, 3.94, -1.18],
        [1.1, 3.6, -0.54],
        [0.07, 3.52, -0.54],
        [0.07, 3.35, 0.14],
      ],
      0.074,
      rubber,
    ],
    [
      [
        [-4.55, 1.15, 0.46],
        [-4.55, 0.76, 0.44],
        [-4.55, 0.76, -0.72],
        [1.88, 0.76, -0.72],
        [1.88, 1.07, 1.17],
      ],
      0.081,
      steel,
    ],
    [
      [
        [0.54, 2.31, 0.14],
        [0.54, 1.72, 0.14],
        [3.84, 1.72, 0.14],
        [3.84, 1.11, -0.4],
      ],
      0.074,
      chrome,
    ],
    [
      [
        [-0.91, 2.31, 0.14],
        [-0.91, 1.6, 0.14],
        [-1.58, 1.6, 0.14],
        [-1.58, 1.56, 1.17],
        [-0.02, 1.65, 1.21],
      ],
      0.058,
      chrome,
    ],
    [
      [
        [-0.49, 2.31, 0.14],
        [-0.49, 2.14, -0.62],
        [2.58, 2.14, -0.62],
        [2.58, 0.91, -0.62],
        [2.58, 0.91, 1.2],
      ],
      0.057,
      rubber,
    ],
    [
      [
        [0.54, 3.35, 0.14],
        [0.54, 3.63, 0.14],
        [2.72, 3.63, 0.14],
        [2.72, 2.28, 0.14],
        [4.7, 2.28, 0.14],
        [4.7, 0.57, 0.14],
      ],
      0.057,
      steel,
    ],
    [
      [
        [-2.2, 1.18, 0.45],
        [-2.2, 1.36, -0.2],
        [-1.63, 1.36, -0.2],
        [-1.63, 2.03, -0.2],
        [-1.27, 2.03, -0.2],
      ],
      0.057,
      brass,
    ],
  ];
  for (const [points, radius, material] of paths) pipe(pipes, points, radius, material);
  for (const p of [
    [-3.38, 4.25, -0.94],
    [1.51, 1.72, 0.14],
    [2.66, 1.72, 0.14],
    [-0.37, 3.63, 0.14],
    [3.91, 2.28, 0.14],
  ] as Point[]) {
    cylinder(pipes, p, 0.104, 0.195, brass, "x", 8);
  }
  cylinder(pipes, [2.15, 3.22, 0.25], 0.27, 0.13, steel, "z");
  cylinder(pipes, [2.15, 3.22, 0.334], 0.23, 0.032, finish("#edf3f6", 0.05, 0.45), "z");
  box(pipes, [2.15, 3.25, 0.362], [0.018, 0.27, 0.022], dark).rotation.z = -0.72;
  pipe(
    pipes,
    [
      [2.15, 2.98, 0.25],
      [2.15, 2.32, 0.25],
      [2.63, 2.32, 0.25],
    ],
    0.044,
    brass,
  );
  const components = {
    cooler: makeCooler(root),
    valve: makeValve(root),
    pump: makePump(root),
    accumulator: makeAccumulator(root),
  };
  for (const model of Object.values(components)) {
    for (const partGroup of model.parts) {
      partGroup.traverse((object) => {
        if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
        const material = (object.material as Material).clone();
        material.userData.originalColor = material.color.getHex();
        material.userData.originalEmissive = material.emissive.getHex();
        material.userData.originalEmissiveIntensity = material.emissiveIntensity;
        material.userData.originalOpacity = material.opacity;
        material.userData.originalTransparent = material.transparent;
        material.userData.originalDepthWrite = material.depthWrite;
        object.material = material;
      });
    }
  }
  const bounds = new T.BoxHelper(components.pump.root, 0x7da9ff);
  bounds.visible = false;
  const outline = bounds.material as T.LineBasicMaterial;
  outline.transparent = true;
  outline.opacity = 0.66;
  scene.add(bounds);

  function update(
    view: RigView,
    selected: ComponentId,
    activePart: number,
    states: Record<ComponentId, Severity>,
    highlightSubpart = false,
  ) {
    const inside = view === "inside";
    const open = view !== "overall";
    base.visible = !inside;
    transparent.visible = !open;
    pipes.visible = !inside;
    for (const [key, model] of Object.entries(components)) {
      const id = key as ComponentId;
      model.root.visible = !inside || id === selected;
      model.root.position.set(...(inside ? ([0, 1.87, 0] as Point) : model.position));
      model.fixed.visible = !inside;
      model.casing.visible = !open;
      model.cut.visible = open;
      const targets = degradationTargets[id][states[id]];
      const targetIndices = new Set(targets.partIndices);
      const emphasizeInternals = inside && (highlightSubpart || states[id] !== "normal");
      for (const [index, component] of model.parts.entries()) {
        component.visible = open && !(id === "cooler" && component === model.parts[0] && !inside);
        const selectedSubpart = id === selected && highlightSubpart && index === activePart;
        const degradationTarget = targetIndices.has(index);
        component.traverse((object) => {
          if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
          const material = object.material as Material;
          material.color.setHex(material.userData.originalColor as number);
          material.emissive.setHex(material.userData.originalEmissive as number);
          material.emissiveIntensity = material.userData.originalEmissiveIntensity as number;
          material.opacity = material.userData.originalOpacity as number;
          material.transparent = material.userData.originalTransparent as boolean;
          material.depthWrite = material.userData.originalDepthWrite as boolean;
          if (emphasizeInternals && !selectedSubpart && !degradationTarget) {
            material.color.set("#72a9d5");
            material.emissive.set("#276a9d");
            material.emissiveIntensity = 0.09;
            material.opacity = 0.48;
            material.transparent = true;
            material.depthWrite = false;
          } else if (emphasizeInternals && degradationTarget && !selectedSubpart) {
            material.emissive.set(states[id] === "risk" ? severityColors.risk : "#e6a83b");
            material.emissiveIntensity = states[id] === "risk" ? 0.5 : 0.26;
          }
          material.needsUpdate = true;
        });
      }
      const color = new T.Color(severityColors[states[id]]);
      model.coat.color.set("#8191a4").lerp(color, id === selected ? 0.78 : 0.48);
      model.coat.emissive.copy(color);
      model.coat.emissiveIntensity = id === selected ? 0.22 : 0.11;
      const xrayCase = inside && id === "pump";
      model.coat.transparent = xrayCase;
      model.coat.opacity = xrayCase ? 0.2 : 1;
      model.coat.depthWrite = !xrayCase;
      model.coat.needsUpdate = true;
      if (model.cut.userData.shell)
        (model.cut.userData.shell as Material).copy(model.coat).side = T.DoubleSide;
      if (id === "pump" && model.parts[3].userData.leakPath) {
        const leak = model.parts[3].userData.leakPath as T.Mesh;
        leak.visible = open && states.pump !== "normal";
        const material = leak.material as Material;
        material.color.setHex(material.userData.originalColor as number);
        material.emissive.set(states.pump === "risk" ? "#ef5261" : "#f0a43b");
        material.emissiveIntensity = states.pump === "risk" ? 1.2 : 0.65;
        const severeLeak = model.parts[3].userData.severeLeakPath as T.Mesh;
        severeLeak.visible = open && states.pump === "risk";
        (severeLeak.material as Material).emissiveIntensity = 1.5;
        model.parts[3].visible = open && states.pump !== "normal";
        model.parts[4].visible = open && states.pump === "risk";
      }
      if (id === "cooler") {
        const fouling = model.parts[0].getObjectByName("educational-fouling-cues");
        if (fouling) {
          const count = states.cooler === "risk" ? 12 : states.cooler === "caution" ? 4 : 0;
          fouling.children.forEach((cue, index) => { cue.visible = index < count; });
          ((fouling.children[0] as T.Mesh).material as Material).emissiveIntensity = states.cooler === "risk" ? 0.75 : 0.24;
        }
        const core = model.parts[3];
        core.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          const material = object.material as Material;
          if (material.userData.coolerCore) {
            const coreColor = states.cooler === "risk" ? "#e97856" : states.cooler === "caution" ? "#e6b34f" : "#64b8d4";
            material.color.setHex(material.userData.originalColor as number);
            material.emissive.set(coreColor);
            material.emissiveIntensity = states.cooler === "risk" ? 0.72 : states.cooler === "caution" ? 0.4 : 0.16;
          }
          if (material.userData.coolerFlow) {
            const flowColor = states.cooler === "risk" ? "#ee604f" : states.cooler === "caution" ? "#e8a94b" : "#48b7e5";
            material.color.setHex(material.userData.originalColor as number);
            material.emissive.set(flowColor);
            material.emissiveIntensity = states.cooler === "risk" ? 1.35 : states.cooler === "caution" ? 0.52 : 0.28;
          }
        });
      }
      if (id === "accumulator" && model.parts[2].userData.gaugeNeedle) {
        const needle = model.parts[2].userData.gaugeNeedle as T.Mesh;
        const needleMaterial = needle.material as Material;
        needleMaterial.color.setHex(needleMaterial.userData.originalColor as number);
        needleMaterial.emissive.set(states.accumulator === "risk" ? severityColors.risk : states.accumulator === "caution" ? "#e6a83b" : severityColors.normal);
        needleMaterial.emissiveIntensity = states.accumulator === "risk" ? 0.85 : states.accumulator === "caution" ? 0.42 : 0.12;
        needle.rotation.z = states.accumulator === "risk" ? -0.98 : states.accumulator === "caution" ? -0.12 : 0.58;
      }
    }
    root.updateMatrixWorld(true);
    bounds.visible = inside && highlightSubpart;
    if (inside) {
      outline.color.set(severityColors[states[selected]]);
      bounds.setFromObject(components[selected].parts[activePart]);
    }
  }
  function animate(now: number, selected: ComponentId, severity: Severity) {
    const model = components[selected];
    const speed = severity === "normal" ? 1 : severity === "caution" ? 0.58 : 0.2;
    if (selected === "valve") {
      const phase = Math.sin(now * 0.002 * speed);
      const stuck = severity === "risk" && Math.sin(now * 0.00045) > -0.48;
      model.parts[0].position.x = stuck ? 0.3 : phase * (severity === "normal" ? 0.12 : severity === "caution" ? 0.09 : 0.04);
      model.parts[1].scale.x = severity === "risk" ? 1.34 : severity === "caution" ? 1.14 : 1;
    } else if (selected === "pump") {
      model.parts[0].rotation.x = now * 0.0014 * speed;
      model.coat.emissiveIntensity = severity === "risk" ? 0.35 + (Math.sin(now * 0.008) + 1) * 0.11 : severity === "caution" ? 0.2 : 0.08;
    } else if (selected === "cooler") {
      model.parts[2].rotation.z = now * 0.0018 * speed;
      model.parts[1].children.forEach((object) => {
        if (object instanceof T.Mesh) {
          const material = object.material as Material;
          material.emissiveIntensity = severity === "risk" ? 0.95 + (Math.sin(now * 0.004) + 1) * 0.38 : severity === "caution" ? 0.38 : 0.68;
        }
      });
      model.coat.emissiveIntensity = severity === "risk" ? 0.3 : severity === "caution" ? 0.16 : 0.06;
    } else {
      const change = severity === "normal" ? 0 : severity === "caution" ? 0.14 : 0.32;
      model.parts[0].scale.y = 1 - change + Math.sin(now * 0.001) * change * 0.12;
      model.parts[1].position.y = severity === "normal" ? 0 : severity === "caution" ? 0.12 : 0.31;
      model.coat.emissiveIntensity = severity === "risk" ? 0.3 : severity === "caution" ? 0.16 : 0.06;
    }
  }
  return { root, components, update, animate, bounds };
}
