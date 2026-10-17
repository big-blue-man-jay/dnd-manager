// One small data API for the whole app.
// With a Firebase config in js/config.js it talks to Firestore + Google sign-in.
// Without one it runs in demo mode: data stays in this browser and you can switch between test users.
import { firebaseConfig } from './config.js';

const UNION = '__union__', REMOVE = '__remove__';
export const union = (...v) => ({ [UNION]: v });
export const arrRemove = (...v) => ({ [REMOVE]: v });
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let impl;
export const store = {
  get mode() { return impl?.mode; },
  init: async () => { impl = firebaseConfig && firebaseConfig.apiKey ? await firebaseImpl() : demoImpl(); return impl.mode; },
  onUser: cb => impl.onUser(cb),
  signIn: () => impl.signIn(),
  signOut: () => impl.signOut(),
  demoUsers: () => impl.demoUsers?.() || [],
  demoSwitch: uid => impl.demoSwitch?.(uid),
  demoReset: () => impl.demoReset?.(),
  get: path => impl.get(path),
  watchDoc: (path, cb, err) => impl.watchDoc(path, cb, err),
  watchCol: (path, filters, cb, err) => impl.watchCol(path, filters || [], cb, err),
  set: (path, data) => impl.batch([{ type: 'set', path, data }]),
  merge: (path, data) => impl.batch([{ type: 'merge', path, data }]),
  update: (path, data) => impl.batch([{ type: 'update', path, data }]),
  remove: path => impl.batch([{ type: 'delete', path }]),
  batch: ops => impl.batch(ops),
};

/* ---------------- Firebase ---------------- */
async function firebaseImpl() {
  const V = '10.14.1';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const conv = v => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (UNION in v) return F.arrayUnion(...v[UNION]);
      if (REMOVE in v) return F.arrayRemove(...v[REMOVE]);
    }
    return v;
  };
  const prep = d => Object.fromEntries(Object.entries(d || {}).map(([k, v]) => [k, conv(v)]));
  const snapDoc = s => (s.exists() ? { id: s.id, ...s.data() } : null);
  return {
    mode: 'firebase',
    onUser: cb => A.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, name: u.displayName || u.email || 'Abenteurer', photo: u.photoURL || '' } : null)),
    signIn: async () => {
      const p = new A.GoogleAuthProvider();
      try { await A.signInWithPopup(auth, p); }
      catch (e) { if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await A.signInWithRedirect(auth, p); else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e; }
    },
    signOut: () => A.signOut(auth),
    get: async path => snapDoc(await F.getDoc(F.doc(db, path))),
    watchDoc: (path, cb, err) => F.onSnapshot(F.doc(db, path), s => cb(snapDoc(s)), e => err?.(e)),
    watchCol: (path, filters, cb, err) => {
      let q = F.collection(db, path);
      if (filters.length) q = F.query(q, ...filters.map(([f, op, v]) => F.where(f, op, v)));
      return F.onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => err?.(e));
    },
    batch: async ops => {
      const b = F.writeBatch(db);
      for (const o of ops) {
        const r = F.doc(db, o.path);
        if (o.type === 'set') b.set(r, prep(o.data));
        else if (o.type === 'merge') b.set(r, prep(o.data), { merge: true });
        else if (o.type === 'update') b.update(r, prep(o.data));
        else if (o.type === 'delete') b.delete(r);
      }
      await b.commit();
    },
  };
}

/* ---------------- Demo (this browser only) ---------------- */
function demoImpl() {
  const KEY = 'dndm-demo-v1', UKEY = 'dndm-demo-user';
  const USERS = [
    { uid: 'demo-dm', name: 'Joel (Demo)', photo: '' },
    { uid: 'demo-ben', name: 'Ben (Demo)', photo: '' },
    { uid: 'demo-lea', name: 'Lea (Demo)', photo: '' },
  ];
  let docs = {};
  try { docs = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { docs = {}; }
  let uid = null;
  try { uid = localStorage.getItem(UKEY); } catch (e) {}
  const userListeners = new Set(), docListeners = new Set();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(docs)); } catch (e) {} };
  const me = () => USERS.find(u => u.uid === uid) || null;
  const emitUser = () => userListeners.forEach(cb => cb(me()));
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const segs = p => p.split('/').filter(Boolean);
  const inCol = (path, col) => { const a = segs(path), b = segs(col); return a.length === b.length + 1 && b.every((s, i) => s === a[i]); };
  const match = (d, [f, op, v]) => {
    const x = d[f];
    if (op === '==') return x === v;
    if (op === '!=') return x !== v;
    if (op === 'array-contains') return Array.isArray(x) && x.includes(v);
    if (op === 'in') return v.includes(x);
    return true;
  };
  const apply = (cur, data) => {
    const out = { ...cur };
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && UNION in v) out[k] = [...new Set([...(out[k] || []), ...v[UNION]])];
      else if (v && typeof v === 'object' && !Array.isArray(v) && REMOVE in v) out[k] = (out[k] || []).filter(x => !v[REMOVE].includes(x));
      else out[k] = clone(v);
    }
    return out;
  };
  const notify = () => setTimeout(() => docListeners.forEach(l => l()), 0);
  return {
    mode: 'demo',
    demoUsers: () => USERS,
    demoSwitch: u => { uid = u; try { u ? localStorage.setItem(UKEY, u) : localStorage.removeItem(UKEY); } catch (e) {} emitUser(); },
    demoReset: () => { docs = {}; save(); notify(); },
    onUser: cb => { userListeners.add(cb); setTimeout(() => cb(me()), 0); return () => userListeners.delete(cb); },
    signIn: async () => { /* the login screen shows the demo user picker instead */ },
    signOut: async () => { uid = null; try { localStorage.removeItem(UKEY); } catch (e) {} emitUser(); },
    get: async path => (docs[path] ? { id: segs(path).at(-1), ...clone(docs[path]) } : null),
    watchDoc: (path, cb) => {
      let last;
      const l = () => { const s = JSON.stringify(docs[path] ?? null); if (s !== last) { last = s; cb(docs[path] ? { id: segs(path).at(-1), ...clone(docs[path]) } : null); } };
      docListeners.add(l); setTimeout(l, 0);
      return () => docListeners.delete(l);
    },
    watchCol: (col, filters, cb) => {
      let last;
      const l = () => {
        const list = Object.keys(docs).filter(p => inCol(p, col)).map(p => ({ id: segs(p).at(-1), ...clone(docs[p]) })).filter(d => filters.every(f => match(d, f)));
        const s = JSON.stringify(list);
        if (s !== last) { last = s; cb(list); }
      };
      docListeners.add(l); setTimeout(l, 0);
      return () => docListeners.delete(l);
    },
    batch: async ops => {
      for (const o of ops) {
        if (o.type === 'set') docs[o.path] = apply({}, o.data);
        else if (o.type === 'merge') docs[o.path] = apply(docs[o.path] || {}, o.data);
        else if (o.type === 'update') { if (!docs[o.path]) throw Object.assign(new Error('not-found'), { code: 'not-found' }); docs[o.path] = apply(docs[o.path], o.data); }
        else if (o.type === 'delete') delete docs[o.path];
      }
      save(); notify();
    },
  };
}
