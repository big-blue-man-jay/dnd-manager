// 3D dice throw. three.js loads on demand; without WebGL (or with the animation switched off)
// throwDice() resolves right away and the result just shows in the dice tray.

let THREE = null, loading = null;
export const loadThree = () => loading ||= import('../vendor/three.module.min.js').then(m => (THREE = m)).catch(() => null);

/* ---------- settings (per browser) ---------- */
const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
const reduced = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const diceSettings = {
  get anim() { return read('dndm-dice-anim', !reduced()); }, set anim(v) { write('dndm-dice-anim', v); },
  get sound() { return read('dndm-dice-sound', true); }, set sound(v) { write('dndm-dice-sound', v); },
};
export const canThrow = () => typeof window !== 'undefined' && !!window.WebGLRenderingContext && diceSettings.anim;

/* ---------- die models ---------- */
const S = 256; // texture cell size in px
const types = {};

// Group the triangles of a flat-faced solid into its polygon faces.
function facesFromGeometry(geo) {
  const p = (geo.index ? geo.toNonIndexed() : geo).attributes.position, V = THREE.Vector3, groups = [];
  for (let i = 0; i < p.count; i += 3) {
    const a = new V().fromBufferAttribute(p, i), b = new V().fromBufferAttribute(p, i + 1), c = new V().fromBufferAttribute(p, i + 2);
    const n = new V().subVectors(b, a).cross(new V().subVectors(c, a)).normalize();
    let g = groups.find(g => g.n.dot(n) > 0.999);
    if (!g) groups.push(g = { n, pts: [] });
    for (const v of [a, b, c]) if (!g.pts.some(q => q.distanceTo(v) < 1e-4)) g.pts.push(v);
  }
  return groups.map(g => sortAround(g.pts));
}
function sortAround(pts) {
  const c = pts.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
  if (n.dot(c) < 0) n.negate();
  const x = new THREE.Vector3().subVectors(pts[0], c).normalize(), y = new THREE.Vector3().crossVectors(n, x);
  return pts.slice().sort((a, b) => { const da = a.clone().sub(c), db = b.clone().sub(c); return Math.atan2(da.dot(y), da.dot(x)) - Math.atan2(db.dot(y), db.dot(x)); });
}

// d10: pentagonal trapezohedron, kites meeting at two tips.
function d10Faces() {
  const V = THREE.Vector3, r = 0.95, e = 0.105 * r, h = e * (2 / (1 - Math.cos(Math.PI / 5)) - 1);
  const ring = Array.from({ length: 10 }, (_, i) => new V(r * Math.cos(i * Math.PI / 5), i % 2 ? -e : e, r * Math.sin(i * Math.PI / 5)));
  const T = new V(0, h, 0), B = new V(0, -h, 0), R = i => ring[(i + 10) % 10], out = [];
  for (let k = 0; k < 5; k++) out.push(sortAround([T, R(2 * k), R(2 * k + 1), R(2 * k + 2)]), sortAround([B, R(2 * k + 1), R(2 * k + 2), R(2 * k + 3)]));
  return out;
}

const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const KINDS = {
  d4: { faces: () => facesFromGeometry(new THREE.TetrahedronGeometry(1.15)), texts: range(4, i => String(i + 1)), up: 'vertex' },
  d6: { faces: () => facesFromGeometry(new THREE.BoxGeometry(1.25, 1.25, 1.25)), texts: range(6, i => String(i + 1)), up: 'edge', pips: true },
  d8: { faces: () => facesFromGeometry(new THREE.OctahedronGeometry(1.08)), texts: range(8, i => String(i + 1)), up: 'vertex' },
  // texts[k] and texts[n-1-k] land on opposite faces, so d10 digits pair up to 9 like on real dice
  d10: { faces: d10Faces, texts: range(10, i => String(i)), up: 'far' },
  d10t: { faces: d10Faces, texts: range(10, i => (i ? String(i * 10) : '00')), up: 'far' },
  d12: { faces: () => facesFromGeometry(new THREE.DodecahedronGeometry(1.02)), texts: range(12, i => String(i + 1)), up: 'vertex' },
  d20: { faces: () => facesFromGeometry(new THREE.IcosahedronGeometry(1.1)), texts: range(20, i => String(i + 1)), up: 'vertex' },
};

function buildType(kind) {
  if (types[kind]) return types[kind];
  const K = KINDS[kind], V = THREE.Vector3, polys = K.faces();
  const cols = Math.ceil(Math.sqrt(polys.length)), rows = Math.ceil(polys.length / cols);
  const faces = polys.map(verts => {
    const c = verts.reduce((s, v) => s.add(v), new V()).multiplyScalar(1 / verts.length);
    const n = new V().subVectors(verts[1], verts[0]).cross(new V().subVectors(verts[2], verts[0])).normalize();
    let upPt;
    if (K.up === 'edge') upPt = verts[0].clone().add(verts[1]).multiplyScalar(0.5);
    else if (K.up === 'far') upPt = verts.reduce((a, b) => (b.distanceTo(c) > a.distanceTo(c) + 1e-6 ? b : a));
    else upPt = verts[0];
    const u = upPt.clone().sub(c).projectOnPlane(n).normalize(), rgt = new V().crossVectors(u, n);
    const loc = verts.map(v => { const d = v.clone().sub(c); return [d.dot(rgt), d.dot(u)]; });
    const R = Math.max(...loc.map(([x, y]) => Math.hypot(x, y)));
    const inr = Math.min(...loc.map((a, i) => { const b = loc[(i + 1) % loc.length]; return Math.abs(a[0] * b[1] - a[1] * b[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]); }));
    const uv = loc.map(([x, y]) => [0.5 + x / (2 * R) * 0.97, 0.5 + y / (2 * R) * 0.97]);
    return { verts, c, n, u, upPt, uv, R, inr, dist: verts[0].dot(n), text: null };
  });
  // number the faces so opposite faces pair up like on real dice
  const T = K.texts; let k = 0;
  for (const f of faces) {
    if (f.text !== null) continue;
    const opp = faces.find(g => g !== f && g.text === null && g.n.dot(f.n) < -0.999);
    if (opp) { f.text = T[k]; opp.text = T[T.length - 1 - k]; k++; }
  }
  const left = T.filter(t => !faces.some(f => f.text === t)); // d4 has no opposite faces
  faces.forEach(f => { if (f.text === null) f.text = left.shift(); });
  // geometry: fan-triangulate each face, uv into its atlas cell
  const pos = [], uvs = [];
  faces.forEach((f, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const map = ([x, y]) => [(col + x) / cols, (rows - row - 1 + y) / rows];
    for (let j = 1; j < f.verts.length - 1; j++) for (const t of [0, j, j + 1]) { const v = f.verts[t]; pos.push(v.x, v.y, v.z); uvs.push(...map(f.uv[t])); }
    f.cell = [col, row];
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return (types[kind] = { kind, geo, faces, cols, rows, pips: !!K.pips, tex: {} });
}

function luminance(hex) { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }

function texture(type, hex, renderer) {
  if (type.tex[hex]) return type.tex[hex];
  const cv = document.createElement('canvas'); cv.width = type.cols * S; cv.height = type.rows * S;
  const g = cv.getContext('2d'), light = luminance(hex) > 0.42;
  const ink = light ? '#221d16' : '#ffffff', outline = light ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.45)';
  g.fillStyle = hex; g.fillRect(0, 0, cv.width, cv.height);
  for (const f of type.faces) {
    const [col, row] = f.cell, ox = col * S, oy = row * S, cx = ox + S / 2, cy = oy + S / 2;
    const pts = f.uv.map(([x, y]) => [ox + x * S, oy + (1 - y) * S]);
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    // soft sheen in the middle, darker toward the edges, a light bevel line along the rim
    const grad = g.createRadialGradient(cx, cy - S * 0.08, S * 0.04, cx, cy, S * 0.55);
    grad.addColorStop(0, 'rgba(255,255,255,.16)'); grad.addColorStop(0.7, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,0,.18)');
    path(); g.fillStyle = grad; g.fill();
    path(); g.lineJoin = 'round'; g.lineWidth = S * 0.07; g.strokeStyle = 'rgba(255,255,255,.20)'; g.stroke();
    path(); g.lineWidth = S * 0.022; g.strokeStyle = 'rgba(0,0,0,.38)'; g.stroke();
    const avail = (S / 2) * (f.inr / f.R) * 0.97;
    if (type.pips) {
      const n = +f.text, d = avail * 0.52, rad = avail * 0.15;
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
      for (const [x, y] of P) {
        g.beginPath(); g.arc(cx + x * d, cy + y * d, rad * (n === 1 ? 1.5 : 1), 0, Math.PI * 2);
        g.fillStyle = outline; g.fill(); g.beginPath(); g.arc(cx + x * d, cy + y * d + 1.5, rad * (n === 1 ? 1.5 : 1) * 0.86, 0, Math.PI * 2); g.fillStyle = ink; g.fill();
      }
      continue;
    }
    let fs = avail * (f.text.length > 1 ? 1.05 : 1.3);
    g.font = `700 ${fs}px Cinzel, Georgia, serif`;
    const w = g.measureText(f.text).width, maxW = avail * 1.62;
    if (w > maxW) { fs *= maxW / w; g.font = `700 ${fs}px Cinzel, Georgia, serif`; }
    const m = g.measureText(f.text), asc = m.actualBoundingBoxAscent || fs * 0.7, desc = m.actualBoundingBoxDescent || 0;
    const by = cy + (asc - desc) / 2;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.lineWidth = fs * 0.1; g.strokeStyle = outline; g.strokeText(f.text, cx, by);
    g.fillStyle = ink; g.fillText(f.text, cx, by);
    if (f.text === '6' || f.text === '9') g.fillRect(cx - fs * 0.22, by + fs * 0.1, fs * 0.44, fs * 0.07);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return (type.tex[hex] = t);
}

/* ---------- stage: one full-screen canvas, reused ---------- */
let st = null;
function stage() {
  if (st) return st;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const el = document.createElement('div'); el.className = 'dice-stage'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="dice-total"><span class="lbl"></span><b class="num"></b><span class="brk"></span><span class="flag"></span></div>';
  el.prepend(renderer.domElement);
  document.body.append(el);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a3a, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(5, 14, 7); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 }); key.shadow.radius = 4; key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.1); rim.position.set(-6, 5, -8); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const glow = new THREE.PointLight(0xffc640, 0, 7, 1.6); scene.add(glow);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);
  return (st = { renderer, el, scene, camera, glow, total: el.querySelector('.dice-total') });
}

/* ---------- sound: short synthesized clacks ---------- */
let ac = null;
function clack(at, strength, sources) {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime + at, len = 0.06;
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 5);
    const src = ac.createBufferSource(); src.buffer = buf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600 + Math.random() * 2200; bp.Q.value = 1.4;
    const gn = ac.createGain(); gn.gain.value = 0.55 * strength;
    src.connect(bp).connect(gn).connect(ac.destination); src.start(t);
    const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.35 * strength, t + 0.005); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og).connect(ac.destination); o.start(t); o.stop(t + 0.12);
    sources.push(src, o);
  } catch (e) {}
}

/* ---------- which dice to show for a roll ---------- */
function diceFor(r) {
  const out = [];
  for (const p of r.parts) {
    if (!p.sides) continue;
    p.rolls.forEach((v, i) => {
      const isD20 = r.nat !== null && p.sides === 20;
      if (p.sides === 100) { const u = v % 10, t = v === 100 ? 0 : v - u; out.push({ kind: 'd10t', text: t ? String(t) : '00' }, { kind: 'd10', text: String(u) }); }
      else if (p.sides === 10) out.push({ kind: 'd10', text: String(v % 10) });
      else if (KINDS['d' + p.sides]) out.push({ kind: 'd' + p.sides, text: String(v), crit: isD20 && i === 0 && r.crit, fumble: isD20 && i === 0 && r.fumble });
    });
    if (r.dropped !== null && p.sides === 20) out.push({ kind: 'd20', text: String(r.dropped), dropped: true });
  }
  return out.slice(0, 24);
}

/* ---------- the throw ---------- */
let current = null;
export function cancelThrow() { current?.finish(true); }

export async function throwDice(r, hex, label) {
  cancelThrow();
  if (!canThrow() || !r) return;
  const dice = diceFor(r);
  if (!dice.length) return;
  // first throw: wait briefly for three.js, otherwise skip the animation this time
  if (!THREE) { await Promise.race([loadThree(), new Promise(res => setTimeout(res, 1800))]); if (!THREE) return; }
  try { await Promise.race([document.fonts?.load('700 64px Cinzel'), new Promise(res => setTimeout(res, 300))]); } catch (e) {}
  const s = stage();
  if (!s) return;
  return new Promise(resolve => run(s, dice, r, hex, label, resolve));
}

function run(s, dice, r, hex, label, resolve) {
  const { renderer, el, scene, camera, glow, total } = s, V = THREE.Vector3;
  const W = innerWidth, H = innerHeight, aspect = W / H;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(W, H, false);

  // scale and layout
  const n = dice.length, sc = n <= 4 ? 1 : Math.max(0.5, Math.sqrt(4 / n));
  const center = new V(0, 0, 0.9), rest = [];
  const spread = 1.15 * Math.sqrt(n) * sc + 0.3, minD = 2.15 * sc;
  for (let i = 0; i < n; i++) {
    let p, tries = 0;
    do { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * spread; p = new V(center.x + Math.cos(a) * d * 1.25, 0, center.z + Math.sin(a) * d * 0.8); }
    while (rest.some(q => q.distanceTo(p) < minD) && ++tries < 200);
    rest.push(p);
  }
  // camera far enough that the cluster fits on narrow phones too
  const elev = 58 * Math.PI / 180, tanH = Math.tan(camera.fov * Math.PI / 360);
  const dist = Math.max(15, (spread * 1.25 + 2.4 * sc) / (tanH * aspect), (spread + 3) / tanH);
  camera.aspect = aspect; camera.updateProjectionMatrix();
  const camBase = new V(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
  camera.position.copy(camBase); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const camUp = new V().setFromMatrixColumn(camera.matrixWorld, 1);

  // entry point: just below the bottom edge of the screen, from the right where the dice button is
  const ray = new THREE.Raycaster(), entry = (sx, y) => { ray.setFromCamera({ x: sx, y: -1.25 }, camera); const o = ray.ray.origin, d = ray.ray.direction, t = (y - o.y) / d.y; return o.clone().addScaledVector(d, t); };

  const sounds = s.sounds = [], meshes = [];
  const yawCam = (Math.random() - 0.5) * 0.5;
  let tEnd = 0, firstImpact = Infinity;
  const IMP = [0.3, 0.55, 0.73, 0.86], PEAK = [1.5, 0.62, 0.22], VOL = [1, 0.55, 0.3, 0.15];
  dice.forEach((d, i) => {
    const type = buildType(d.kind), face = type.faces.find(f => f.text === d.text) || type.faces[0];
    const mat = new THREE.MeshPhysicalMaterial({ map: texture(type, hex, renderer), roughness: 0.34, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.18, flatShading: true, transparent: !!d.dropped });
    const mesh = new THREE.Mesh(type.geo, mat); mesh.castShadow = true; mesh.scale.setScalar(sc); scene.add(mesh);
    // final orientation: rolled face up (d4: rolled face toward the viewer), number upright
    const yaw = yawCam + (Math.random() - 0.5) * 0.6;
    let ln, lu, wn, wu, restH;
    if (d.kind === 'd4') {
      const b = type.faces.find(g => !g.verts.some(v => v.distanceTo(face.upPt) < 1e-4)) || type.faces[0];
      ln = b.n; lu = face.n.clone().projectOnPlane(b.n).normalize(); wn = new V(0, -1, 0); wu = new V(Math.sin(yaw), 0, Math.cos(yaw)); restH = b.dist * sc;
    } else {
      // rolled face up, tipped most of the way toward the viewer so it reads as the front face
      ln = face.n; lu = face.u;
      wn = new V(0, 1, 0).lerp(camBase.clone().sub(rest[i]).normalize(), 0.8).normalize();
      wu = camUp.clone().projectOnPlane(wn).normalize().applyAxisAngle(wn, yaw - yawCam);
    }
    const L = new THREE.Matrix4().makeBasis(ln, lu, new V().crossVectors(ln, lu)), Wm = new THREE.Matrix4().makeBasis(wn, wu, new V().crossVectors(wn, wu));
    const qF = new THREE.Quaternion().setFromRotationMatrix(Wm.multiply(L.invert()));
    if (restH === undefined) restH = sc * Math.max(...type.faces.flatMap(f => f.verts.map(v => -v.clone().applyQuaternion(qF).y))); // lowest corner on the table
    const start = entry(0.25 + Math.random() * 0.7, 2.4 * sc + restH);
    const dir = new V(rest[i].x - start.x, 0, rest[i].z - start.z), travel = dir.length(); dir.normalize();
    const axis = new V().crossVectors(new V(0, 1, 0), dir).add(new V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.5)).normalize();
    const spin = travel / (0.9 * sc) * 1.15 + Math.PI * (1 + Math.random());
    const delay = i * 0.055 + Math.random() * 0.05, dur = 1.25 + Math.random() * 0.3;
    tEnd = Math.max(tEnd, delay + dur); firstImpact = Math.min(firstImpact, delay + IMP[0] * dur);
    if (diceSettings.sound) IMP.forEach((u, k) => clack(delay + u * dur + Math.random() * 0.02, VOL[k] * (n > 6 ? 0.6 : 1), sounds));
    meshes.push({ d, mesh, mat, start, rest: rest[i], restH, qF, axis, spin, delay, dur, sc });
  });

  el.classList.remove('settled', 'crit', 'fumble', 'out');
  total.querySelector('.lbl').textContent = label || '';
  total.querySelector('.num').textContent = r.total;
  total.querySelector('.brk').textContent = r.parts.length > 1 || r.dropped !== null || r.parts.some(p => p.rolls?.length > 1) ? breakdown(r) : '';
  total.querySelector('.flag').textContent = r.crit ? 'Natürliche 20!' : r.fumble ? 'Natürliche 1' : '';
  el.style.setProperty('--dc', hex);
  el.classList.add('on');

  const q = new THREE.Quaternion(), qs = new THREE.Quaternion();
  const shakeAmp = 0.1 + Math.min(0.25, n * 0.04);
  let t0 = performance.now(), settled = false, raf = 0, done = false, hold = 0;
  const frame = now => {
    const t = (now - t0) / 1000;
    for (const m of meshes) {
      const u = Math.min(1, Math.max(0, (t - m.delay) / m.dur)), e = 1 - Math.pow(1 - u, 2.4);
      const p = m.mesh.position.lerpVectors(m.start, m.rest, e);
      let y = m.restH;
      if (u < IMP[0]) y += 2.4 * m.sc * (1 - (u / IMP[0]) ** 2);
      else for (let k = 0; k < PEAK.length; k++) if (u >= IMP[k] && u < IMP[k + 1]) { const v = (u - IMP[k]) / (IMP[k + 1] - IMP[k]); y += PEAK[k] * m.sc * 4 * v * (1 - v); }
      p.y = y;
      qs.setFromAxisAngle(m.axis, m.spin * (1 - Math.pow(1 - u, 2.6)) - m.spin);
      m.mesh.quaternion.multiplyQuaternions(qs, m.qF);
      m.mesh.visible = t >= m.delay;
    }
    // camera shake on the first hit
    const ts = t - firstImpact;
    camera.position.copy(camBase);
    if (ts > 0 && ts < 0.5) { const a = shakeAmp * Math.exp(-ts * 9); camera.position.x += Math.sin(ts * 95) * a; camera.position.y += Math.cos(ts * 80) * a * 0.6; }
    camera.lookAt(0, 0, 0);
    if (!settled && t >= tEnd) { settled = true; onSettle(); hold = t + (r.crit || r.fumble ? 2.1 : 1.35); }
    if (settled) {
      for (const m of meshes) {
        if (m.d.dropped) { m.mat.opacity = Math.max(0.28, m.mat.opacity - 0.04); }
        if (m.d.crit) m.mat.emissiveIntensity = 0.35 + 0.25 * Math.sin((t - tEnd) * 7);
      }
      if (glow.intensity) glow.intensity = (r.crit ? 26 : 8) * (1 + 0.38 * Math.sin((t - tEnd) * 7));
      if (t > hold) return finish();
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const onSettle = () => {
    el.classList.add('settled');
    const hero = meshes.find(m => m.d.crit || m.d.fumble);
    if (hero) {
      el.classList.add(hero.d.crit ? 'crit' : 'fumble');
      if (hero.d.crit) { hero.mat.emissive.set(0xffb020); glow.color.set(0xffc640); glow.intensity = 26; }
      else { hero.mat.color.set(0x9a4040); glow.color.set(0xff2020); glow.intensity = 8; } // a natural 1 goes dark and blood-red
      glow.position.set(hero.mesh.position.x, 2.2 * hero.sc, hero.mesh.position.z);
    }
    if (diceSettings.sound && (r.crit || r.fumble)) chime(r.crit);
  };
  const finish = (immediate) => {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey); el.removeEventListener('pointerdown', skip);
    for (const src of sounds) { try { src.stop(); } catch (e) {} }
    if (current === ctl) current = null;
    el.classList.add('out');
    const clean = () => {
      for (const m of meshes) { scene.remove(m.mesh); m.mat.dispose(); }
      if (current) return; // a new throw already owns the stage
      el.classList.remove('on', 'out', 'settled', 'crit', 'fumble');
      glow.intensity = 0; renderer.clear();
    };
    if (immediate) clean(); else setTimeout(clean, 320);
    resolve();
  };
  const skip = e => { e.preventDefault(); finish(); };
  const onKey = e => { if (['Escape', 'Enter', ' '].includes(e.key)) skip(e); };
  el.addEventListener('pointerdown', skip); addEventListener('keydown', onKey);
  const ctl = { finish };
  current = ctl;
  raf = requestAnimationFrame(frame);
}

function chime(good) {
  try {
    const t = ac.currentTime + 0.02, notes = good ? [523.25, 659.25, 783.99, 1046.5] : [220, 207.65, 196, 155.56];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = good ? 'triangle' : 'sawtooth';
      o.frequency.value = f; const s = t + i * (good ? 0.07 : 0.11);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(good ? 0.12 : 0.05, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + (good ? 0.9 : 0.6));
      o.connect(g).connect(ac.destination); o.start(s); o.stop(s + 1);
    });
  } catch (e) {}
}

function breakdown(r) {
  const parts = r.parts.map((p, i) => {
    if (p.flat !== undefined) return (p.flat >= 0 ? (i ? '+ ' : '') + p.flat : '− ' + Math.abs(p.flat));
    return (p.sign < 0 ? '− ' : i ? '+ ' : '') + `[${p.rolls.join(', ')}]`;
  }).join(' ');
  const mode = r.dropped !== null ? ` · ${r.mode === 'adv' ? 'Vorteil' : 'Nachteil'}, verworfen ${r.dropped}` : '';
  return parts + mode;
}
