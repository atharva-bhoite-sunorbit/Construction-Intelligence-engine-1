import type * as T from 'three';

type Three = typeof import('three');
interface Site { cx: number; cz: number; minX: number; maxX: number; minZ: number; maxZ: number; span: number; tallest: number }

/** A small seeded random, so the surroundings look the same every time the view opens. */
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

/**
 * Trees, roads, neighbouring buildings, hoarding, hills and clouds around the site. Everything is drawn with a handful of
 * instanced meshes so it costs almost nothing. `drift` moves the clouds; call it every frame.
 */
export const buildScenery = (THREE: Three, site: Site, keep: <X extends { dispose: () => void }>(x: X) => X) => {
  const group = new THREE.Group();
  const rand = rng(41);
  const { cx, cz, minX, maxX, minZ, maxZ, span } = site;
  const hx = (maxX - minX) / 2 + 6, hz = (maxZ - minZ) / 2 + 6;     // the fenced site
  const road = 9;
  const ox = hx + 4 + road / 2, oz = hz + 4 + road / 2;               // road centre line
  const roadHalfX = ox + road / 2, roadHalfZ = oz + road / 2;         // outer edge of the road ring
  const box = (w: number, h: number, d: number) => keep(new THREE.BoxGeometry(w, h, d));
  const std = (color: number, rough = 0.9) => keep(new THREE.MeshStandardMaterial({ color, roughness: rough }));
  const put = (geo: T.BufferGeometry, mat: T.Material, x: number, y: number, z: number, rx = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(cx + x, y, cz + z); m.rotation.x = rx; m.receiveShadow = true; group.add(m); return m;
  };

  // the site pad, hoarding and a gate
  put(box(hx * 2, 0.06, hz * 2), std(0xd8d6cc), 0, 0.02, 0);
  const hoard = std(0xe8eef5, 0.7);
  const fence = (w: number, d: number, x: number, z: number) => { const m = put(box(w, 2.4, d), hoard, x, 1.2, z); m.castShadow = true; };
  fence(hx * 2, 0.25, 0, -hz); fence(hx * 2, 0.25, 0, hz); fence(0.25, hz * 2, -hx, 0); fence(0.25, hz * 2, hx, 0);
  put(box(0.5, 3.4, 0.5), std(0xf59e0b), -hx, 1.7, hz * 0.4);
  put(box(0.5, 3.4, 0.5), std(0xf59e0b), -hx, 1.7, hz * 0.4 + 7);

  // roads with a dashed centre line
  const tar = std(0x4b5563, 0.95);
  put(box(2 * roadHalfX, 0.08, road), tar, 0, 0.03, -oz); put(box(2 * roadHalfX, 0.08, road), tar, 0, 0.03, oz);
  put(box(road, 0.08, 2 * oz), tar, -ox, 0.03, 0); put(box(road, 0.08, 2 * oz), tar, ox, 0.03, 0);
  const dash = new THREE.InstancedMesh(box(3, 0.1, 0.35), keep(new THREE.MeshBasicMaterial({ color: 0xf8fafc })), 120);
  const dm = new THREE.Matrix4();
  let n = 0;
  for (let x = -roadHalfX + 3; x < roadHalfX - 3 && n < 110; x += 7) {
    dm.makeTranslation(cx + x, 0.1, cz - oz); dash.setMatrixAt(n++, dm);
    dm.makeTranslation(cx + x, 0.1, cz + oz); dash.setMatrixAt(n++, dm);
  }
  const dashZ = new THREE.InstancedMesh(box(0.35, 0.1, 3), dash.material, 80);
  let k = 0;
  for (let z = -oz + 3; z < oz - 3 && k < 78; z += 7) {
    dm.makeTranslation(cx - ox, 0.1, cz + z); dashZ.setMatrixAt(k++, dm);
    dm.makeTranslation(cx + ox, 0.1, cz + z); dashZ.setMatrixAt(k++, dm);
  }
  dash.count = n; dashZ.count = k;
  group.add(dash, dashZ);

  // the neighbourhood beyond the ring road
  const clearX = roadHalfX + 6, clearZ = roadHalfZ + 6;
  const inside = (x: number, z: number, px: number, pz: number) => Math.abs(x) < clearX + px && Math.abs(z) < clearZ + pz;
  const blocks: { x: number; z: number; w: number; d: number }[] = [];
  const palette = [0xe7dfd2, 0xd9d4cc, 0xcdd6dc, 0xe4cfc0, 0xd8dfd0, 0xc8c6d0];
  const houses = new THREE.InstancedMesh(box(1, 1, 1), std(0xffffff, 0.85), 70);
  houses.castShadow = true; houses.receiveShadow = true;
  const col = new THREE.Color();
  let hCount = 0;
  for (let tries = 0; tries < 400 && hCount < 70; tries++) {
    const x = (rand() - 0.5) * span * 7, z = (rand() - 0.5) * span * 7;
    const w = 12 + rand() * 16, d = 12 + rand() * 16, h = 9 + rand() * rand() * 40;
    if (inside(x, z, w / 2 + 2, d / 2 + 2)) continue;
    if (blocks.some((b) => Math.abs(b.x - x) < (b.w + w) / 2 + 4 && Math.abs(b.z - z) < (b.d + d) / 2 + 4)) continue;
    blocks.push({ x, z, w, d });
    dm.compose(new THREE.Vector3(cx + x, h / 2, cz + z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
    houses.setMatrixAt(hCount, dm);
    houses.setColorAt(hCount, col.setHex(palette[Math.floor(rand() * palette.length)]));
    hCount++;
  }
  houses.count = hCount;
  group.add(houses);

  // trees: along the road edges and in loose clusters, never on a road or building
  const trunkGeo = keep(new THREE.CylinderGeometry(0.28, 0.4, 3, 6));
  const crownGeo = keep(new THREE.IcosahedronGeometry(2.7, 1));
  const trunks = new THREE.InstancedMesh(trunkGeo, std(0x7c5a3c), 220);
  const crowns = new THREE.InstancedMesh(crownGeo, std(0xffffff, 0.8), 220);
  trunks.castShadow = crowns.castShadow = true;
  const greens = [0x4d7c4a, 0x5f8f4e, 0x3f6b3f, 0x6a9a56, 0x58844a];
  let tCount = 0;
  const plant = (x: number, z: number) => {
    if (tCount >= 220) return;
    if (blocks.some((b) => Math.abs(b.x - x) < b.w / 2 + 2 && Math.abs(b.z - z) < b.d / 2 + 2)) return;
    const onRoad = (Math.abs(Math.abs(x) - ox) < road / 2 + 1 && Math.abs(z) < roadHalfZ + 1) || (Math.abs(Math.abs(z) - oz) < road / 2 + 1 && Math.abs(x) < roadHalfX + 1);
    if (onRoad || (Math.abs(x) < hx + 1 && Math.abs(z) < hz + 1)) return;
    const s = 0.8 + rand() * 0.8;
    dm.compose(new THREE.Vector3(cx + x, 1.5 * s, cz + z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(tCount, dm);
    dm.compose(new THREE.Vector3(cx + x, 4.6 * s, cz + z), new THREE.Quaternion(), new THREE.Vector3(s, s * (0.9 + rand() * 0.3), s));
    crowns.setMatrixAt(tCount, dm);
    crowns.setColorAt(tCount, col.setHex(greens[Math.floor(rand() * greens.length)]));
    tCount++;
  };
  for (let x = -roadHalfX; x <= roadHalfX; x += 9) { plant(x, -roadHalfZ - 2.5); plant(x, roadHalfZ + 2.5); }
  for (let z = -roadHalfZ; z <= roadHalfZ; z += 9) { plant(-roadHalfX - 2.5, z); plant(roadHalfX + 2.5, z); }
  for (let i = 0; i < 600 && tCount < 220; i++) plant((rand() - 0.5) * span * 6.5, (rand() - 0.5) * span * 6.5);
  trunks.count = crowns.count = tCount;
  group.add(trunks, crowns);

  // hills on the horizon (the fog fades them)
  const hillMat = std(0x8aa890, 1);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4, r = span * (10 + rand() * 2.5), size = span * (1.6 + rand() * 1.6);
    const hill = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 20, 12)), hillMat);
    hill.scale.set(size * 1.6, size * (0.35 + rand() * 0.25), size * 1.3);
    hill.position.set(cx + Math.cos(a) * r, -size * 0.05, cz + Math.sin(a) * r);
    group.add(hill);
  }

  // clouds
  const clouds = new THREE.Group();
  const cloudMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, fog: false }));
  const puff = keep(new THREE.SphereGeometry(1, 12, 8));
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const p = new THREE.Mesh(puff, cloudMat);
      p.scale.set(span * (0.22 + rand() * 0.18), span * (0.08 + rand() * 0.05), span * (0.14 + rand() * 0.08));
      p.position.set((j - 2) * span * 0.2, rand() * span * 0.04, rand() * span * 0.08);
      c.add(p);
    }
    c.position.set(cx + (rand() - 0.5) * span * 8, Math.max(site.tallest, span) * 1.7 + rand() * span * 0.8, cz + (rand() - 0.5) * span * 8);
    clouds.add(c);
  }
  group.add(clouds);

  return { group, drift: (t: number) => { clouds.position.x = Math.sin(t * 0.00004) * span * 0.6; } };
};
