import React, { useEffect, useRef, useState } from 'react';
import { buildScenery } from './scenery';
import type { BuildingData, BuildingLevel, BuildingWing } from '../../types';

interface Props {
  data: BuildingData;
  onSelectLevel: (level: BuildingLevel, wing: BuildingWing) => void;
  height?: number;
}

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const shortDate = (iso?: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
/** How the floors stand against the plan today: the highest floor the plan says should be finished vs the floors actually done. */
const againstPlan = (w: BuildingWing) => {
  const today = todayIso();
  const structure = w.levels.filter((l) => l.kind !== 'foundation');
  const planned = structure.filter((l) => l.end_date && l.end_date.slice(0, 10) <= today).length;
  const done = structure.filter((l) => l.state === 'DONE').length;
  return { planned, done, diff: done - planned };
};

const STATE_TEXT = { DONE: 'done', IN_PROGRESS: 'in progress', NOT_STARTED: 'not started' } as const;

/**
 * Each tower is a stack of floors. A finished floor is solid green; a floor being built is filled from the bottom up
 * to its progress; a floor not started is a faint outline; a late floor has a red outline.
 * three.js is loaded on demand so the rest of the app stays light.
 */
export const BuildingView: React.FC<Props> = ({ data, onSelectLevel, height = 440 }) => {
  const mount = useRef<HTMLDivElement>(null);
  const select = useRef(onSelectLevel);
  select.current = onSelectLevel;
  const reset = useRef<() => void>(() => undefined);
  const focusOn = useRef<(target: string) => void>(() => undefined);
  const showUnbuilt = useRef<(on: boolean) => void>(() => undefined);
  const [scenery, setScenery] = useState(true);
  const sceneryRef = useRef(true);
  sceneryRef.current = scenery;
  const sceneryOn = useRef<(on: boolean) => void>(() => undefined);
  const [unbuilt, setUnbuilt] = useState(true);
  const unbuiltRef = useRef(true);
  unbuiltRef.current = unbuilt;
  const [active, setActive] = useState(false);
  const [focused, setFocused] = useState('all');
  // the camera survives a redraw (e.g. while the what-if slider moves) as long as it is the same building
  const camMem = useRef<{ sig: string; pos: number[]; target: number[] } | null>(null);
  const signature = data.wings.map((w) => `${w.name}:${w.levels.length}`).join('|');
  const [selected, setSelected] = useState<{ wing: BuildingWing; level: BuildingLevel } | null>(null);
  const [showPlan, setShowPlan] = useState(true);
  const showPlanRef = useRef(true);
  showPlanRef.current = showPlan;
  const planLines = useRef<(on: boolean) => void>(() => undefined);
  const mark = useRef<(shellOf: BuildingLevel | null, wing?: BuildingWing) => void>(() => undefined);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => undefined as void;
    (async () => {
      try {
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const host = mount.current;
        if (disposed || !host) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 4000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        host.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('aria-hidden', 'true');

        scene.add(new THREE.HemisphereLight(0xcfe4ff, 0xb9b2a4, 1.05));
        const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.bias = -0.0005;
        scene.add(sun, sun.target);

        // framing
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, tallest = 0;
        data.wings.forEach((w) => {
          [...w.footprint, ...(w.podium_footprint ?? w.footprint)].forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, -y); maxZ = Math.max(maxZ, -y); });
          tallest = Math.max(tallest, w.levels.filter((l) => l.kind !== 'foundation').length * w.floor_height);
        });
        const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
        const span = Math.max(maxX - minX, maxZ - minZ, tallest, 30);

        const pickables: import('three').Object3D[] = [];
        const planObjs: import('three').Object3D[] = [];
        const shellOf = new Map<BuildingLevel, import('three').Mesh>();
        setSelected(null);
        const ghosts: import('three').Object3D[] = [];
        const wingInfo: { name: string; x0: number; x1: number; z0: number; z1: number; builtTop: number }[] = [];
        const disposables: { dispose: () => void }[] = [];
        const keep = <T extends { dispose: () => void }>(x: T): T => { disposables.push(x); return x; };

        // sky, haze and a ground the towers cast shadows on
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 4; skyCanvas.height = 256;
        const sg = skyCanvas.getContext('2d');
        if (sg) {
          const grad = sg.createLinearGradient(0, 0, 0, 256);
          grad.addColorStop(0, '#7fb2e5'); grad.addColorStop(0.6, '#cfe3f4'); grad.addColorStop(1, '#eef1ee');
          sg.fillStyle = grad; sg.fillRect(0, 0, 4, 256);
        }
        const sky = keep(new THREE.CanvasTexture(skyCanvas));
        sky.colorSpace = THREE.SRGBColorSpace;
        scene.background = sky;
        scene.fog = new THREE.Fog(0xdde8ef, span * 5, span * 18);
        const ground = new THREE.Mesh(keep(new THREE.CircleGeometry(span * 14, 64)), keep(new THREE.MeshStandardMaterial({ color: 0xaebf9b, roughness: 1 })));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(cx, -0.03, cz);
        ground.receiveShadow = true;
        scene.add(ground);
        const grid = new THREE.GridHelper(Math.ceil((span * 2.4) / 10) * 10, 24, 0xb9bfb3, 0xc4c9bd);
        grid.position.set(cx, -0.02, cz);
        (grid.material as import('three').Material).opacity = 0.45;
        (grid.material as import('three').Material).transparent = true;
        scene.add(grid);
        const world = buildScenery(THREE, { cx, cz, minX, maxX, minZ, maxZ, span, tallest }, keep);
        scene.add(world.group);
        world.group.visible = sceneryRef.current;
        grid.visible = !sceneryRef.current;
        sceneryOn.current = (on) => { world.group.visible = on; grid.visible = !on; };
        sun.position.set(cx - span * 0.9, span * 1.6, cz + span * 1.1);
        sun.target.position.set(cx, 0, cz);
        const sc = sun.shadow.camera;
        sc.left = -span * 1.4; sc.right = span * 1.4; sc.top = span * 1.4; sc.bottom = -span * 1.4; sc.near = 1; sc.far = span * 6;
        sc.updateProjectionMatrix();

        // a facade: pale wall with a window in every bay (UVs of an extrusion are in metres, so one tile = one bay x one storey)
        const facade = (wall: string, glassTop: string, glassBottom: string, storey: number) => {
          const c = document.createElement('canvas');
          c.width = 128; c.height = 128;
          const k = c.getContext('2d');
          if (k) {
            k.fillStyle = wall; k.fillRect(0, 0, 128, 128);
            const gr = k.createLinearGradient(0, 22, 0, 100);
            gr.addColorStop(0, glassTop); gr.addColorStop(1, glassBottom);
            k.fillStyle = gr; k.fillRect(10, 24, 108, 66);
            k.fillStyle = 'rgba(255,255,255,0.35)'; k.fillRect(10, 24, 108, 5);
            k.fillStyle = 'rgba(0,0,0,0.18)'; k.fillRect(10, 90, 108, 4);
            k.fillRect(63, 24, 2, 66);
          }
          const t = keep(new THREE.CanvasTexture(c));
          t.colorSpace = THREE.SRGBColorSpace;
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(1 / 3.2, 1 / (storey * 0.92));
          t.anisotropy = 4;
          return t;
        };

        data.wings.forEach((wing) => {
          // the tower outline for the floors, the (possibly wider) podium outline for foundation, stilt and podium levels
          const mx = wing.footprint.reduce((n, p) => n + p[0], 0) / wing.footprint.length;
          const my = wing.footprint.reduce((n, p) => n + p[1], 0) / wing.footprint.length;
          const towerShape = new THREE.Shape(wing.footprint.map(([x, y]) => new THREE.Vector2(x - mx, y - my)));
          const podiumShape = new THREE.Shape((wing.podium_footprint ?? wing.footprint).map(([x, y]) => new THREE.Vector2(x - mx, y - my)));
          const group = new THREE.Group();
          group.position.set(mx, 0, -my);
          scene.add(group);

          // a name tag above the tower so there is no doubt which is which
          const tag = document.createElement('canvas');
          tag.width = 256; tag.height = 96;
          const g = tag.getContext('2d');
          if (g) {
            g.fillStyle = 'rgba(15,23,42,0.88)';
            g.beginPath(); g.roundRect(8, 8, 240, 80, 18); g.fill();
            g.fillStyle = '#ffffff'; g.font = '600 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(wing.name.replace('Tower ', 'Tower '), 128, 50);
          }
          const tagTex = keep(new THREE.CanvasTexture(tag));
          const sprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tagTex, depthTest: false, transparent: true })));
          const towerHeight = wing.levels.filter((l) => l.kind !== 'foundation').length * wing.floor_height;
          sprite.scale.set(16, 6, 1);
          sprite.position.set(0, towerHeight + 6, 0);
          group.add(sprite);

          const doneFacade = facade('#8fc7a3', '#2f5f73', '#7fa9b8', wing.floor_height);
          const doneStone = facade('#9fb9a8', '#566b66', '#8a9d98', wing.floor_height);
          const progressFacade = facade('#7aa2ee', '#2b4a80', '#6f8fc4', wing.floor_height);

          let base = 0;
          let builtTop = 0;
          const pts = [...wing.footprint, ...(wing.podium_footprint ?? wing.footprint)];
          wingInfo.push({
            name: wing.name,
            x0: Math.min(...pts.map((q) => q[0])), x1: Math.max(...pts.map((q) => q[0])),
            z0: Math.min(...pts.map((q) => -q[1])), z1: Math.max(...pts.map((q) => -q[1])),
            builtTop: 0,
          });
          const info = wingInfo[wingInfo.length - 1];
          const today = todayIso();
          const labelSprite = (text: string, scale: [number, number], pos: [number, number, number], bg = 'rgba(15,23,42,0.75)') => {
            const cv = document.createElement('canvas');
            cv.width = 128; cv.height = 64;
            const k = cv.getContext('2d');
            if (k) {
              k.fillStyle = bg; k.beginPath(); k.roundRect(4, 8, 120, 48, 14); k.fill();
              k.fillStyle = '#fff'; k.font = '600 34px sans-serif'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(text, 64, 33);
            }
            const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(new THREE.CanvasTexture(cv)), transparent: true })));
            sp.scale.set(scale[0], scale[1], 1);
            sp.position.set(...pos);
            group.add(sp);
            return sp;
          };
          let plannedTop = -1;
          let plannedShape: import('three').Shape | null = null;
          wing.levels.forEach((level) => {
            const h = level.kind === 'foundation' ? wing.floor_height * 0.9 : wing.floor_height;
            const y0 = level.kind === 'foundation' ? -h : base;
            if (level.kind !== 'foundation') base += h;
            const depth = h * 0.92;
            const shape = ['foundation', 'stilt', 'podium'].includes(level.kind) ? podiumShape : towerShape;
            const shellGeo = keep(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }));
            shellGeo.rotateX(-Math.PI / 2);
            const solid = level.state === 'DONE';
            const isPodium = ['foundation', 'stilt', 'podium'].includes(level.kind);
            let shellMat: import('three').Material | import('three').Material[];
            if (solid) {
              const wallTex = isPodium ? doneStone : doneFacade;
              const roof = keep(new THREE.MeshStandardMaterial({ color: 0xd9ddd6, roughness: 0.9 }));
              shellMat = [roof, keep(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.55, metalness: 0.08 }))];
            } else {
              const lateOpen = level.late;
              shellMat = keep(new THREE.MeshBasicMaterial({ color: lateOpen ? 0xef4444 : level.state === 'IN_PROGRESS' ? 0x60a5fa : 0x94a3b8, transparent: true, opacity: lateOpen ? 0.32 : level.state === 'IN_PROGRESS' ? 0.18 : 0.13, depthWrite: false }));
            }
            const shell = new THREE.Mesh(shellGeo, shellMat);
            if (level.state !== 'NOT_STARTED' && level.kind !== 'foundation') { builtTop = Math.max(builtTop, base); info.builtTop = builtTop; }
            shellOf.set(level, shell);
            if (level.kind !== 'foundation' && level.end_date && level.end_date.slice(0, 10) <= today) { plannedTop = base; plannedShape = shape; }
            if (level.kind === 'floor') {
              const num = parseInt(level.label.replace(/\D+/g, ''), 10);
              if (num > 0 && num % 5 === 0) labelSprite(String(num), [2.6, 1.3], [info.x0 - mx - 1.6, y0 + h * 0.5, 0]);
            }
            shell.castShadow = solid;
            shell.receiveShadow = solid;
            shell.position.y = y0;
            shell.userData = { wing, level };
            group.add(shell);
            pickables.push(shell);

            if (level.state === 'IN_PROGRESS') {
              const fillDepth = Math.max(depth * (level.progress_percent / 100), 0.15);
              const fillGeo = keep(new THREE.ExtrudeGeometry(shape, { depth: fillDepth, bevelEnabled: false }));
              fillGeo.rotateX(-Math.PI / 2);
              const fill = new THREE.Mesh(fillGeo, [keep(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.95 })), keep(new THREE.MeshStandardMaterial({ map: progressFacade, roughness: 0.7 }))]);
              fill.castShadow = true;
              fill.receiveShadow = true;
              fill.position.y = y0;
              fill.scale.set(0.985, 1, 0.985);
              group.add(fill);
            }
            const edgeColor = level.late && level.state !== 'DONE' ? 0xef4444 : level.state === 'DONE' ? 0x14532d : level.state === 'IN_PROGRESS' ? 0x1d4ed8 : 0x7f8da3;
            const edges = new THREE.LineSegments(keep(new THREE.EdgesGeometry(shellGeo)), keep(new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: level.state === 'NOT_STARTED' && !level.late ? 0.5 : 1 })));
            edges.position.y = y0;
            group.add(edges);
            if (level.state === 'NOT_STARTED') { ghosts.push(shell, edges); }
            // the concrete floor plate, so built floors read as stacked storeys
            if (level.state !== 'NOT_STARTED' && level.kind !== 'foundation') {
              const plateGeo = keep(new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: false }));
              plateGeo.rotateX(-Math.PI / 2);
              const plate = new THREE.Mesh(plateGeo, keep(new THREE.MeshStandardMaterial({ color: 0xe6e7e2, roughness: 0.9 })));
              plate.position.y = y0 + depth - 0.1;
              plate.scale.set(1.012, 1, 1.012);
              plate.castShadow = true;
              plate.receiveShadow = true;
              group.add(plate);
            }
          });

          // the crown: when the top floor is done the fins rise past the roof and fold in, as in the renders
          // where the plan says this tower should be today
          if (plannedTop >= 0 && plannedShape) {
            const planGeo = keep(new THREE.ExtrudeGeometry(plannedShape, { depth: 0.18, bevelEnabled: false }));
            planGeo.rotateX(-Math.PI / 2);
            const plan = new THREE.Mesh(planGeo, keep(new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.18, depthWrite: false })));
            plan.position.y = plannedTop + wing.floor_height * 0.92;
            plan.scale.set(1.04, 1, 1.04);
            const planEdge = new THREE.LineSegments(keep(new THREE.EdgesGeometry(planGeo)), keep(new THREE.LineBasicMaterial({ color: 0xd97706 })));
            planEdge.position.copy(plan.position); planEdge.scale.copy(plan.scale);
            const tagPlan = labelSprite('Plan today', [5.2, 2.6], [info.x1 - mx + 3.4, plan.position.y + 1, 0], 'rgba(217,119,6,0.92)');
            group.add(plan, planEdge);
            planObjs.push(plan, planEdge, tagPlan);
          }

          // a tower crane over the floor being built
          if (wing.levels.some((l) => l.state === 'IN_PROGRESS')) {
            const yel = keep(new THREE.MeshStandardMaterial({ color: 0xf5b301, roughness: 0.6 }));
            const dark = keep(new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.8 }));
            const mastH = builtTop + wing.floor_height * 3;
            const crane = new THREE.Group();
            const add = (w: number, hh: number, d: number, x: number, y: number, z: number, mat = yel) => {
              const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, hh, d)), mat);
              m.position.set(x, y, z); m.castShadow = true; crane.add(m);
            };
            add(0.9, mastH, 0.9, 0, mastH / 2, 0);
            add(24, 0.7, 0.9, 7, mastH + 0.4, 0);
            add(7, 0.7, 0.9, -9.5, mastH + 0.4, 0, yel);
            add(2.4, 2, 1.6, -11.5, mastH - 0.8, 0, dark);
            add(1.6, 1.6, 1.6, 0.6, mastH + 1.4, 0, dark);
            add(0.12, 6, 0.12, 14, mastH - 3, 0, dark);
            crane.position.set(info.x1 - mx + 2.2, 0, 6);
            group.add(crane);
          }
        });

        // the picked floor lights up
        const lit = new THREE.Group();
        scene.add(lit);
        const litFill = keep(new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        const litLine = keep(new THREE.LineBasicMaterial({ color: 0xca8a04 }));
        mark.current = (level) => {
          lit.clear();
          const sh = level ? shellOf.get(level) : undefined;
          if (!sh) return;
          const at = sh.getWorldPosition(new THREE.Vector3());
          const body = new THREE.Mesh(sh.geometry, litFill);
          const outline = new THREE.LineSegments(keep(new THREE.EdgesGeometry(sh.geometry)), litLine);
          [body, outline].forEach((o) => { o.position.copy(at); o.scale.set(1.03, 1.0, 1.03); lit.add(o); });
        };
        planLines.current = (on) => { planObjs.forEach((o) => { o.visible = on; }); };
        planLines.current(showPlanRef.current);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI * 0.49;
        // the page keeps its scroll: the wheel only zooms (and touch only turns) once the view has been clicked
        let isActive = false;
        const activate = (on: boolean) => {
          isActive = on;
          controls.enableZoom = on;
          renderer.domElement.style.touchAction = on ? 'none' : 'pan-y';
          setActive(on);
        };
        activate(false);
        const outside = (ev: PointerEvent) => { if (!host.contains(ev.target as Node)) activate(false); };
        const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') activate(false); };
        window.addEventListener('pointerdown', outside);
        window.addEventListener('keydown', onKey);
        const home = () => {
          // fit the whole building (a bounding sphere) in view, seen from a raised corner
          const center = new THREE.Vector3(cx, tallest * 0.5, cz);
          const radius = Math.hypot((maxX - minX) / 2, (tallest + 14) / 2, (maxZ - minZ) / 2);
          const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.0;
          controls.target.copy(center);
          // seen from the west: the north end of the plan (Tower A) is on the left, the south end (Tower B) on the right
          camera.position.copy(center).add(new THREE.Vector3(-1.0, 0.36, 0.55).normalize().multiplyScalar(distance));
          controls.update();
        };
        // fly the camera to look at a box: a point, how far, and the viewing direction
        const dir = new THREE.Vector3(-1.0, 0.36, 0.55).normalize();
        let fly = 0;
        const lookAt = (center: import('three').Vector3, radius: number) => {
          const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.0;
          const toTarget = center.clone();
          const toPos = center.clone().add(dir.clone().multiplyScalar(distance));
          const fromTarget = controls.target.clone();
          const fromPos = camera.position.clone();
          const t0 = performance.now();
          cancelAnimationFrame(fly);
          const step = (now: number) => {
            const k = Math.min(1, (now - t0) / 450);
            const e = 1 - Math.pow(1 - k, 3);
            controls.target.lerpVectors(fromTarget, toTarget, e);
            camera.position.lerpVectors(fromPos, toPos, e);
            if (k < 1) fly = requestAnimationFrame(step);
          };
          fly = requestAnimationFrame(step);
        };
        focusOn.current = (target: string) => {
          if (target === 'all') {
            lookAt(new THREE.Vector3(cx, tallest * 0.5, cz), Math.hypot((maxX - minX) / 2, (tallest + 14) / 2, (maxZ - minZ) / 2));
            return;
          }
          const list = target === 'built' ? wingInfo : wingInfo.filter((w) => w.name === target);
          if (list.length === 0) return;
          const x0 = Math.min(...list.map((w) => w.x0)), x1 = Math.max(...list.map((w) => w.x1));
          const z0 = Math.min(...list.map((w) => w.z0)), z1 = Math.max(...list.map((w) => w.z1));
          const top = Math.max(...list.map((w) => w.builtTop), 6);
          // a tower is shown with a few floors of headroom above what is built; the whole podium is always in view
          const shownTop = target === 'built' ? top + 10 : top + 10;
          lookAt(new THREE.Vector3((x0 + x1) / 2, shownTop * 0.45, (z0 + z1) / 2), Math.max(Math.hypot((x1 - x0) / 2, shownTop / 2, (z1 - z0) / 2), 14));
        };
        showUnbuilt.current = (on: boolean) => { ghosts.forEach((o) => { o.visible = on; }); };
        showUnbuilt.current(unbuiltRef.current);
        reset.current = () => { setFocused('all'); focusOn.current('all'); };
        home();
        if (camMem.current && camMem.current.sig === signature) {
          camera.position.fromArray(camMem.current.pos);
          controls.target.fromArray(camMem.current.target);
          controls.update();
        }

        const size = () => {
          const w = host.clientWidth || 600;
          renderer.setSize(w, height, false);
          renderer.domElement.style.width = '100%';
          renderer.domElement.style.height = `${height}px`;
          camera.aspect = w / height;
          camera.updateProjectionMatrix();
        };
        size();
        const ro = new ResizeObserver(size);
        ro.observe(host);

        const ray = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const hit = (ev: PointerEvent) => {
          const r = renderer.domElement.getBoundingClientRect();
          ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
          ray.setFromCamera(ndc, camera);
          return ray.intersectObjects(pickables.filter((o) => o.visible), false)[0];
        };
        let down: { x: number; y: number } | null = null;
        const onMove = (ev: PointerEvent) => {
          const h = hit(ev);
          renderer.domElement.style.cursor = h ? 'pointer' : 'grab';
          if (h) {
            const { wing, level } = h.object.userData as { wing: BuildingWing; level: BuildingLevel };
            const r = host.getBoundingClientRect();
            setTip({ x: ev.clientX - r.left, y: ev.clientY - r.top, text: `${wing.name} · ${level.label}: ${STATE_TEXT[level.state]}${level.state === 'IN_PROGRESS' ? ` ${Math.round(level.progress_percent)}%` : ''}${level.late && level.state !== 'DONE' ? ', late' : ''}` });
          } else setTip(null);
        };
        const onDown = (ev: PointerEvent) => { down = { x: ev.clientX, y: ev.clientY }; if (!isActive) activate(true); };
        const onUp = (ev: PointerEvent) => {
          if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) { down = null; return; }
          down = null;
          const h = hit(ev);
          if (h) { const { wing, level } = h.object.userData as { wing: BuildingWing; level: BuildingLevel }; setSelected({ wing, level }); mark.current(level, wing); }
          else { setSelected(null); mark.current(null); }
        };
        const onLeave = () => { setTip(null); if (isActive) activate(false); };
        renderer.domElement.addEventListener('pointermove', onMove);
        renderer.domElement.addEventListener('pointerdown', onDown);
        renderer.domElement.addEventListener('pointerup', onUp);
        renderer.domElement.addEventListener('pointerleave', onLeave);

        let raf = 0;
        const loop = (now = 0) => { world.drift(now); controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
        loop();

        cleanup = () => {
          camMem.current = { sig: signature, pos: camera.position.toArray(), target: controls.target.toArray() };
          cancelAnimationFrame(raf);
          cancelAnimationFrame(fly);
          window.removeEventListener('pointerdown', outside);
          window.removeEventListener('keydown', onKey);
          ro.disconnect();
          controls.dispose();
          renderer.domElement.removeEventListener('pointermove', onMove);
          renderer.domElement.removeEventListener('pointerdown', onDown);
          renderer.domElement.removeEventListener('pointerup', onUp);
          renderer.domElement.removeEventListener('pointerleave', onLeave);
          disposables.forEach((d) => d.dispose());
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (err) {
        console.error('3D view unavailable', err);
        if (!disposed) setFailed(true);
      }
    })();
    return () => { disposed = true; cleanup(); };
  }, [data, height]);

  if (failed) {
    return <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">The 3D view needs WebGL, which this browser does not offer. The list below shows the same progress.</p>;
  }
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-slate-100" style={{ height }}>
      <div ref={mount} className="h-full w-full" />
      {tip && <div className="pointer-events-none absolute z-10 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow" style={{ left: tip.x + 12, top: tip.y - 8 }}>{tip.text}</div>}
      <div className="absolute left-3 top-3 flex max-w-[calc(100%-6rem)] flex-wrap items-center gap-1.5 text-xs">
        {[{ id: 'all', label: 'Whole building' }, { id: 'built', label: 'Built part' }, ...data.wings.map((w) => ({ id: w.name, label: w.name }))].map((b) => (
          <button key={b.id} onClick={() => { setFocused(b.id); focusOn.current(b.id); }}
            className={`rounded-lg border px-2.5 py-1 font-medium shadow-sm ${focused === b.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white/90 text-slate-700 hover:bg-white'}`}>{b.label}</button>
        ))}
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 px-2.5 py-1 font-medium text-slate-700 shadow-sm">
          <input type="checkbox" checked={scenery} onChange={(e) => { setScenery(e.target.checked); sceneryOn.current(e.target.checked); }} />
          Surroundings
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 px-2.5 py-1 font-medium text-slate-700 shadow-sm">
          <input type="checkbox" checked={unbuilt} onChange={(e) => { setUnbuilt(e.target.checked); showUnbuilt.current(e.target.checked); }} />
          Show floors not started
        </label>
      </div>
      <div className="absolute right-3 top-3 hidden w-60 flex-col items-stretch gap-2 text-xs md:flex">
        <button onClick={() => reset.current()} className="self-end rounded-lg border border-slate-300 bg-white/90 px-3 py-1 font-medium text-slate-700 shadow-sm hover:bg-white">Reset view</button>
        <section className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm" aria-label="Against plan">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Against the plan today</h3>
            <label className="flex cursor-pointer items-center gap-1 text-slate-600"><input type="checkbox" checked={showPlan} onChange={(e) => { setShowPlan(e.target.checked); planLines.current(e.target.checked); }} />line</label>
          </div>
          <ul className="space-y-1">
            {data.wings.map((w) => {
              const p = againstPlan(w);
              return (
                <li key={w.name} className="flex items-baseline justify-between gap-2">
                  <span className="text-slate-700">{w.name}</span>
                  <span className={`font-medium ${p.diff < 0 ? 'text-rose-700' : p.diff > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {p.done} done · plan {p.planned}{p.diff < 0 ? ` (${-p.diff} behind)` : p.diff > 0 ? ` (${p.diff} ahead)` : ' (on plan)'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        {selected && (
          <section className="rounded-xl border border-amber-300 bg-white/95 p-3 shadow-sm" aria-label="Selected floor">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-slate-500">{selected.wing.name}</p>
                <h3 className="text-sm font-semibold text-slate-900">{selected.level.label}</h3>
              </div>
              <button aria-label="Clear selection" onClick={() => { setSelected(null); mark.current(null); }} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <p className="mt-1 text-slate-700">
              {STATE_TEXT[selected.level.state][0].toUpperCase() + STATE_TEXT[selected.level.state].slice(1)}
              {selected.level.state === 'IN_PROGRESS' ? ` · ${Math.round(selected.level.progress_percent)}%` : ''}
              {selected.level.late && selected.level.state !== 'DONE' ? ' · late' : ''}
            </p>
            {selected.level.start_date && <p className="text-slate-500">{shortDate(selected.level.start_date)} to {shortDate(selected.level.end_date)}</p>}
            {selected.level.activity_ids.length > 0 && (
              <button onClick={() => select.current(selected.level, selected.wing)} className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700">Open details</button>
            )}
          </section>
        )}
      </div>
      <p className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-slate-600">
        {active ? 'Scroll zooms the view. Move away or press Esc to scroll the page.' : 'Click the view to zoom with the wheel. Until then the page scrolls.'}
      </p>
      <ul className="absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-600" aria-label="Legend">
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-green-600" />Done</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-blue-600" />In progress (filled to its %)</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-slate-400 bg-slate-100" />Not started</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border-2 border-red-500" />Late</li>
      </ul>
    </div>
  );
};
