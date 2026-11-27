import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { Icon } from "./Icons";
import { sensors, statusText } from "./monitoring";
import type { RigData, RigId, Severity } from "./monitoring";
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

function createMachine(scene: T.Scene, data: RigData, position: T.Vector3Tuple): RigObject {
  const root = new T.Group();
  root.position.set(...position);
  root.userData.rigId = data.rigId;
  scene.add(root);

  const chassis = metal("#50647c");
  const lightMetal = metal("#c3d0dc", 0.4);
  const darkMetal = metal("#2a394c", 0.72);
  const blue = metal("#4385c7", 0.42);
  const glass = new T.MeshStandardMaterial({ color: "#a9d5e8", roughness: 0.3, metalness: 0.12 });
  const accent = new T.MeshStandardMaterial({
    color: severityColors[data.overallSeverity],
    emissive: severityColors[data.overallSeverity],
    emissiveIntensity: 0.55,
    roughness: 0.3,
  });

  // Raised factory pallet and four frame posts.
  addBox(root, darkMetal, [0, 0.16, 0], [4.9, 0.3, 3.1]);
  addBox(root, accent, [0, 0.34, 0], [4.35, 0.075, 2.62]);
  for (const x of [-2.05, 2.05])
    for (const z of [-1.18, 1.18]) addBox(root, lightMetal, [x, 1.55, z], [0.14, 2.35, 0.14]);
  addBox(root, chassis, [0, 2.76, 0], [4.45, 0.18, 2.75]);
  addBox(root, lightMetal, [-1.44, 1.28, 0], [1.02, 1.52, 1.38]);
  addBox(root, glass, [-1.44, 1.34, 0.71], [0.78, 0.88, 0.035]);
  addBox(root, blue, [0.04, 0.91, -0.22], [1.55, 0.72, 1.24]);

  // Pump motor, cooling fan and pipe runs give each station a distinct 3D silhouette.
  addCylinder(root, chassis, [0.93, 0.94, 0.02], 0.48, 1.02, Math.PI / 2);
  addCylinder(root, lightMetal, [1.47, 0.94, 0.02], 0.34, 0.14, Math.PI / 2);
  const fan = new T.Group();
  fan.position.set(1.57, 0.94, 0.02);
  root.add(fan);
  addCylinder(fan, accent, [0, 0, 0], 0.09, 0.07, Math.PI / 2);
  for (let blade = 0; blade < 4; blade++) {
    const vane = addBox(fan, darkMetal, [0, 0, 0.02], [0.1, 0.48, 0.07]);
    vane.rotation.z = (Math.PI / 2) * blade;
  }
  addCylinder(root, blue, [1.89, 1.62, 0.56], 0.34, 1.4);
  addCylinder(root, lightMetal, [1.89, 2.35, 0.56], 0.37, 0.12);

  // Cooler fins, valve block and connecting pipes.
  addBox(root, chassis, [-0.13, 1.68, -0.8], [0.88, 1.05, 0.58]);
  for (let fin = 0; fin < 7; fin++)
    addBox(root, lightMetal, [-0.48 + fin * 0.115, 1.68, -0.49], [0.045, 0.91, 0.08]);
  addBox(root, blue, [0.22, 0.68, 0.86], [0.66, 0.42, 0.44]);
  for (const x of [-0.62, 0.52]) {
    const pipe = addCylinder(root, lightMetal, [x, 1.72, 0.7], 0.055, 1.15);
    pipe.rotation.z = Math.PI / 2;
  }
  const statusLamp = new T.Mesh(new T.SphereGeometry(0.14, 12, 10), accent);
  statusLamp.position.set(-1.9, 2.94, 0.92);
  root.add(statusLamp);
  return { data, root, fan, statusLamp };
}

function addFloor(scene: T.Scene) {
  const floor = new T.Mesh(
    new T.PlaneGeometry(38, 26),
    new T.MeshStandardMaterial({ color: "#e9eef4", roughness: 0.92, metalness: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.08;
  scene.add(floor);
  const grid = new T.GridHelper(38, 38, 0x8da2b8, 0xc7d2de);
  grid.position.y = -0.065;
  (grid.material as T.Material).transparent = true;
  (grid.material as T.Material).opacity = 0.54;
  scene.add(grid);

  const lineMaterial = new T.LineBasicMaterial({
    color: 0x8fb2cf,
    transparent: true,
    opacity: 0.8,
  });
  for (const [x, z] of [
    [-8.9, -4.4],
    [2.9, -4.4],
    [-2.9, 4.4],
    [8.9, 4.4],
  ]) {
    const points = [
      new T.Vector3(x - 2.7, -0.045, z - 2.1),
      new T.Vector3(x + 2.7, -0.045, z - 2.1),
      new T.Vector3(x + 2.7, -0.045, z + 2.1),
      new T.Vector3(x - 2.7, -0.045, z + 2.1),
    ];
    const outline = new T.LineLoop(new T.BufferGeometry().setFromPoints(points), lineMaterial);
    scene.add(outline);
  }
  const frame = metal("#91a4b7", 0.42);
  const wall = new T.MeshStandardMaterial({ color: "#d7e2ec", roughness: 0.82, transparent: true, opacity: 0.32 });
  for (const x of [-17, 0, 17]) {
    addBox(scene, frame, [x, 5.3, -12.5], [0.22, 10.6, 0.22]);
    addBox(scene, frame, [x, 10.5, -6.2], [0.2, 0.2, 12.6]);
  }
  addBox(scene, wall, [0, 4.3, -12.8], [34, 8.5, 0.12]);
  for (const x of [-11, -4, 4, 11]) {
    const fixture = new T.Mesh(new T.BoxGeometry(2.8, 0.08, 0.46), new T.MeshStandardMaterial({ color: "#fff4c8", emissive: "#ffe4a0", emissiveIntensity: 0.65 }));
    fixture.position.set(x, 9.5, 0);
    scene.add(fixture);
  }
  const safety = new T.MeshStandardMaterial({ color: "#efb84e", roughness: 0.7 });
  for (const x of [-1.15, 1.15]) addBox(scene, safety, [x, -0.025, 0], [0.075, 0.018, 22]);
  const aisle = new T.MeshStandardMaterial({ color: "#d9e5ed", roughness: 0.9 });
  addBox(scene, aisle, [0, -0.04, 0], [2.45, 0.025, 22]);
}

export function FactoryViewport({
  rigs,
  onSelect,
  selectedId,
  onOverview,
}: {
  rigs: RigData[];
  onSelect: (id: RigId) => void;
  selectedId?: RigId;
  onOverview: () => void;
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
  const current = useRef({ rigs, onSelect, selectedId, onOverview, step, activePart, internalPart, subpartFocused });
  current.current = { rigs, onSelect, selectedId, onOverview, step, activePart, internalPart, subpartFocused };
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
    scene.background = new T.Color("#eef3f8");
    scene.add(new T.HemisphereLight(0xf5f9ff, 0x64748a, 2.2));
    const keyLight = new T.DirectionalLight(0xffffff, 2.7);
    keyLight.position.set(-8, 15, 11);
    scene.add(keyLight);
    const fillLight = new T.DirectionalLight(0x9bc9ff, 1.1);
    fillLight.position.set(10, 8, -9);
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
    camera.position.set(16.5, 20.5, 27);
    camera.lookAt(0, 0.6, 0);
    const controls = new OrbitControls(camera, node);
    controls.enableDamping = !vector;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.6, 0);
    controls.minDistance = 5.2;
    controls.maxDistance = 43;
    controls.maxPolarAngle = Math.PI * 0.48;
    let width = 1;
    let height = 1;
    let frame = 0;
    let down: { x: number; y: number } | undefined;
    let cameraMove: { from: T.Vector3; to: T.Vector3; targetFrom: T.Vector3; targetTo: T.Vector3; started: number } | undefined;
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
      const focusObject = internalIndex === undefined ? component.root : component.parts[internalIndex];
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
      while (detailTarget && detailTarget.userData.detailPartIndex === undefined) detailTarget = detailTarget.parent;
      const partIndex = typeof detailTarget?.userData.detailPartIndex === "number" ? detailTarget.userData.detailPartIndex as number : 0;
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
          const states = Object.fromEntries(active.components.map(({ id, severity }) => [id, severity])) as Record<ComponentId, Severity>;
          detailedRig.update("inside", selectedPart.current, partIndex, states, Boolean(detailTarget));
          const preset = componentCamera(selectedPart.current, detailTarget ? partIndex : undefined);
          cameraMove = { from: camera.position.clone(), to: preset.position, targetFrom: controls.target.clone(), targetTo: preset.target, started: performance.now() };
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
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const componentRoots = Object.values(detailedRig.components).map(({ root }) => root);
      const hit = raycaster.intersectObjects(collectVisibleMeshes(componentRoots), false)[0]?.object;
      let component: T.Object3D | null = hit ?? null;
      let detailTarget: T.Object3D | null = hit ?? null;
      while (detailTarget && detailTarget.userData.detailPartName === undefined) detailTarget = detailTarget.parent;
      setHoveredDetailName(detailTarget?.userData.detailPartName as string | undefined ?? null);
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
      frame = requestAnimationFrame(draw);
      const active = current.current.rigs.find((rig) => rig.rigId === current.current.selectedId);
      if (active && active.rigId !== focusedId) {
        focusedId = active.rigId;
        focusedPart = undefined;
        focusedSubpart = false;
        setStep("rig");
        const index = current.current.rigs.findIndex((rig) => rig.rigId === active.rigId);
        if (hiddenMachineIndex !== undefined && hiddenMachineIndex !== index) machines[hiddenMachineIndex].root.visible = true;
        machines[index].root.visible = false;
        hiddenMachineIndex = index;
        const [x, , z] = positions[index];
        detailedRig.root.position.set(x, 0, z);
        detailedRig.root.visible = true;
        detailedRig.update("cutaway", selectedPart.current, 0, Object.fromEntries(active.components.map(({ id, severity }) => [id, severity])) as Record<ComponentId, Severity>);
        cameraMove = { from: camera.position.clone(), to: new T.Vector3(x + 6.8, 5.3, z + 7.5), targetFrom: controls.target.clone(), targetTo: new T.Vector3(x, 1.25, z), started: now };
        controls.minDistance = 5.2;
        controls.maxDistance = 16;
      } else if (
        active && focusedId === active.rigId &&
        (current.current.step === "component" || current.current.step === "subpart") &&
        (current.current.activePart !== focusedPart || current.current.internalPart !== focusedInternalPart || current.current.subpartFocused !== focusedSubpart || current.current.step !== focusedStep)
      ) {
        const componentChanged = current.current.activePart !== focusedPart;
        const internalViewChanged = current.current.internalPart !== focusedInternalPart || current.current.subpartFocused !== focusedSubpart || current.current.step !== focusedStep;
        focusedPart = current.current.activePart;
        focusedInternalPart = current.current.internalPart;
        focusedSubpart = current.current.subpartFocused;
        focusedStep = current.current.step;
        detailedRig.update("inside", focusedPart, focusedInternalPart, Object.fromEntries(active.components.map(({ id, severity }) => [id, severity])) as Record<ComponentId, Severity>, focusedSubpart);
        if (componentChanged || internalViewChanged) {
          const focusSubpart = current.current.step === "subpart" && focusedSubpart ? focusedInternalPart : undefined;
          const preset = componentCamera(focusedPart, focusSubpart);
          cameraMove = { from: camera.position.clone(), to: preset.position, targetFrom: controls.target.clone(), targetTo: preset.target, started: now };
          controls.minDistance = 1.05;
          controls.maxDistance = 11;
          controls.minDistance = 1.2;
          controls.maxDistance = 11;
        }
      } else if (active && focusedId === active.rigId && current.current.step === "rig" && focusedPart) {
        focusedPart = undefined;
        focusedSubpart = false;
        focusedStep = undefined;
        detailedRig.update("cutaway", current.current.activePart, 0, Object.fromEntries(active.components.map(({ id, severity }) => [id, severity])) as Record<ComponentId, Severity>);
        const x = detailedRig.root.position.x;
        const z = detailedRig.root.position.z;
        cameraMove = { from: camera.position.clone(), to: new T.Vector3(x + 6.8, 5.3, z + 7.5), targetFrom: controls.target.clone(), targetTo: new T.Vector3(x, 1.25, z), started: now };
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
        cameraMove = { from: camera.position.clone(), to: new T.Vector3(16.5, 20.5, 27), targetFrom: controls.target.clone(), targetTo: new T.Vector3(0, 0.6, 0), started: now };
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
      const componentFocus = Boolean(active && (current.current.step === "component" || current.current.step === "subpart"));
      const selectedIndex = active ? current.current.rigs.findIndex((rig) => rig.rigId === active.rigId) : -1;
      machines.forEach((machine, index) => {
        machine.root.visible = !active || (!componentFocus && index !== selectedIndex);
        const tag = labels.current[machine.data.rigId];
        if (tag) tag.style.display = componentFocus ? "none" : "";
      });
      if (!reducedMotion) {
        for (const machine of machines) {
          machine.fan.rotation.z = now * 0.0019;
          const material = machine.statusLamp.material as T.MeshStandardMaterial;
          material.emissiveIntensity = 0.38 + (Math.sin(now * 0.0025) + 1) * 0.18;
        }
        if (active && (current.current.step === "component" || current.current.step === "subpart")) {
          const state = active.components.find((item) => item.id === current.current.activePart);
          if (state) detailedRig.animate(now, current.current.activePart, state.severity);
        }
      }
      controls.update();
      renderer.render(scene, camera);
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
  }, []);

  const attentionCount = (rig: RigData) =>
    rig.components.filter((item) => item.severity !== "normal").length;
  const focusedRig = rigs.find((rig) => rig.rigId === selectedId);
  const focusedPart = focusedRig?.components.find((item) => item.id === activePart);
  const partDetails = focusedPart ? rigParts[focusedPart.id].parts : [];
  const degradedTargets = focusedPart ? degradationTargets[focusedPart.id][focusedPart.severity] : undefined;
  const activeDetail = partDetails[Math.min(internalPart, partDetails.length - 1)];
  const focusedSensor = focusedPart ? sensors[focusedPart.sensor] : undefined;
  const sensorValue = focusedPart && focusedSensor
    ? focusedRig?.series[focusedPart.sensor].at(-1)?.toFixed(focusedSensor.decimals)
    : undefined;
  const priority = focusedRig && focusedPart
    ? focusedRig.priority.findIndex((item) => item.id === focusedPart.id) + 1
    : undefined;

  return (
    <section className="factory-view" aria-label="공장 내부 3D 설비 배치">
      <div className="factory-heading">
        <div>
          <span className="rig-eyebrow">GOROSTEEL / FACTORY FLOOR</span>
          <h2>공장 전체 3D 모니터링</h2>
          <p>설비를 선택하면 같은 공장 공간에서 카메라가 이동하고 내부 구성품이 나타납니다.</p>
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
        <Icon name="info" size={16} /> 가상 다중 설비 시연 / UCI 실험 사이클을 설비 4대에 배정한
        교육용 화면
      </div>
      <div className="factory-stage-wrap">
        {focusedRig && <div style={{ position: "absolute", zIndex: 5, top: 14, left: 14, display: "flex", alignItems: "center", gap: 8, maxWidth: "calc(100% - 24px)", flexWrap: "wrap" }}>
          <span className="panel" style={{ padding: "9px 12px", fontSize: 12 }}>공장 전체 &gt; {focusedRig.rigId}{focusedPart && step !== "rig" ? ` > ${focusedPart.name}` : ""}{step === "subpart" && activeDetail ? ` > ${activeDetail.name}` : ""}</span>
          {(step === "component" || step === "subpart") && <button className="primary-button" onClick={() => setStep("rig")}>설비 전체 보기</button>}
          <button className="primary-button" onClick={onOverview}>전체 공장 보기</button>
        </div>}
        <div
          className="factory-stage"
          ref={host}
          aria-label="마우스로 공장을 회전하고 확대할 수 있습니다. 설비를 클릭해 같은 공간에서 확대합니다."
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
            aria-label={`${rig.rigId} ${rig.rigName}, ${statusText[rig.overallSeverity]}, 카메라 확대`}
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
        {focusedRig && <aside className="panel" style={{ position: "absolute", zIndex: 4, right: 16, top: 16, width: 286, maxHeight: "calc(100% - 32px)", overflow: "auto", padding: 16 }}>
          <span className="rig-eyebrow">{focusedRig.rigId} · CYCLE {focusedRig.cycleId}</span>
          <h3 style={{ margin: "8px 0" }}>{step === "component" && focusedPart ? focusedPart.name : `${focusedRig.rigName} 구성품`}</h3>
          {step === "rig" && <div style={{ display: "grid", gap: 6 }}>{focusedRig.components.map((item) => <button key={item.id} className="rig-select-row" aria-pressed={activePart === item.id} onClick={() => { selectedPart.current = item.id; setActivePart(item.id); setInternalPart(0); setSubpartFocused(false); setStep("component"); }}><strong>{item.name}</strong><span className={`rig-status ${item.severity}`}><i />{statusText[item.severity]}</span></button>)}</div>}
          {(step === "component" || step === "subpart") && focusedPart && <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}><strong style={{ fontSize: 12 }}>현재 상태</strong><span className={`rig-status ${focusedPart.severity}`}><i />{statusText[focusedPart.severity]}</span></div>
            <div style={{ marginTop: 10, padding: "9px 10px", borderRadius: 8, background: focusedPart.severity === "risk" ? "#fff1f1" : focusedPart.severity === "caution" ? "#fff8e8" : "#f2f6f9", fontSize: 12, lineHeight: 1.55 }}>
              <strong>열화 부위</strong>
              {degradedTargets?.labels.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {degradedTargets.labels.map((label, index) => <button key={label} type="button" onClick={() => { const partIndex = degradedTargets.partIndices[index]; if (partIndex !== undefined) { setInternalPart(partIndex); setSubpartFocused(true); setStep("subpart"); } }} style={{ minHeight: 28, padding: "4px 8px", borderRadius: 6, border: `1px solid ${focusedPart.severity === "risk" ? "#e6a0a4" : "#e8cf8d"}`, background: "white", color: "#26374a", fontSize: 11, lineHeight: 1.3, cursor: "pointer" }}>{label}</button>)}
              </div> : <span style={{ marginLeft: 8, color: "#607184" }}>없음 · 정상 상태</span>}
            </div>
            <p style={{ fontSize: 12, fontWeight: 650, margin: "12px 0 6px" }}>내부 세부 부품</p>
            <div style={{ display: "grid", gap: 6, margin: "8px 0" }}>{partDetails.map((part, index) => { const degraded = degradedTargets?.partIndices.includes(index); return <button key={part.name} className="rig-select-row" aria-pressed={internalPart === index && step === "subpart"} onClick={() => { setInternalPart(index); setSubpartFocused(true); setStep("subpart"); }} style={{ boxSizing: "border-box", width: "100%", minHeight: 40, padding: "8px 10px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "center", gap: 8, lineHeight: 1.3 }}><strong style={{ minWidth: 0, textAlign: "left", overflowWrap: "anywhere" }}>{part.name}</strong>{degraded && <span style={{ color: focusedPart.severity === "risk" ? "#bf3542" : "#9b6b11", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>열화</span>}<span style={{ whiteSpace: "nowrap", fontSize: 11 }}>{internalPart === index && subpartFocused && step === "subpart" ? "선택됨" : "선택"}</span></button>; })}</div>
            <button className="text-link" aria-pressed={step === "component" && !subpartFocused} onClick={() => { setSubpartFocused(false); setStep("component"); }} style={{ minHeight: 34, lineHeight: 1.3 }}>전체 내부 구조 표시</button>
            <p style={{ fontSize: 12, color: "#536579" }}>{activeDetail?.desc}</p>
            <dl style={{ fontSize: 12, lineHeight: 1.7 }}>
              <div><dt>UCI 실험 라벨</dt><dd>{focusedPart.value} {focusedPart.unit} · {statusText[focusedPart.severity]}</dd></div>
              <div><dt>관련 센서 · 최근값</dt><dd>{focusedSensor?.name} ({focusedPart.sensor}) · {sensorValue} {focusedSensor?.unit}</dd></div>
              <div><dt>예상 영향</dt><dd>{focusedPart.description}</dd></div>
              <div><dt>권장 점검</dt><dd>{focusedPart.action}</dd></div>
              <div><dt>설비 내 점검 순위</dt><dd>{priority} / 4</dd></div>
            </dl>
            <p style={{ padding: 10, borderRadius: 8, background: "#f3f7fa", fontSize: 11, lineHeight: 1.5, color: "#536579" }}>
              {focusedPart.id === "cooler"
                ? `냉각기 시연: ${focusedPart.severity === "normal" ? "안정적인 흐름과 열교환" : focusedPart.severity === "caution" ? "흐름과 열교환 저하 징후" : "흐름 저하와 열교환 경고 강조"}를 색과 팬 동작으로 표현합니다.`
                : "선택 상태에 맞춰 내부 움직임과 강조 색을 표시합니다."} 실제 손상 형상이나 측정되지 않은 열화량을 의미하지 않는 교육용 개념 시각화입니다.
            </p>
            <p style={{ fontSize: 11, color: "#536579" }}>3D 강조는 UCI 실험 상태를 바탕으로 한 교육용 개념 시각화이며, 실제 손상 형상 측정 결과가 아닙니다. 실제 손상 치수나 건강 지수는 표시하지 않습니다.</p>
            <button className="primary-button" onClick={() => setStep("rig")}>구성품에서 뒤로</button>
          </>}
          {step === "rig" && focusedPart && <p style={{ marginTop: 12, fontSize: 12, color: "#536579" }}>{focusedPart.metric}: {focusedPart.value} {focusedPart.unit}<br />권장 점검: {focusedPart.action}</p>}
        </aside>}
        {hoveredPart && step !== "factory" && <span className="panel" style={{ position: "absolute", zIndex: 6, left: "50%", bottom: 44, transform: "translateX(-50%)", padding: "8px 12px" }}>{focusedRig?.components.find((item) => item.id === hoveredPart)?.name}{hoveredDetailName ? ` · ${hoveredDetailName}` : step === "rig" ? " · 클릭하여 내부 보기" : ""}</span>}
        {renderMode === "unavailable" && (
          <div className="factory-fallback">이 환경에서는 3D 화면을 시작할 수 없습니다.</div>
        )}
        <div className="factory-hint">
          <Icon name="mouse" size={15} /> 드래그하여 회전 · 휠로 확대 · 설비를 클릭해 상세 보기
        </div>
        <span className="factory-render-mode">
          {renderMode === "vector" ? "호환 모드" : "실시간 3D 장면"}
        </span>
      </div>
    </section>
  );
}
