// Shared UI building blocks (Preact + htm, no build step).
import { html, render, useState, useEffect, useMemo, useRef, useCallback } from '../vendor/preact-htm.js';
import { store } from './data.js';
import { D20, HUE, THEMES, SPECIES_EMOJI, CLASS_EMOJI } from './rules5e.js';
export { html, render, useState, useEffect, useMemo, useRef, useCallback };

/* ---------- data hooks ---------- */
export function useDoc(path) {
  const [d, setD] = useState(undefined);
  useEffect(() => {
    if (!path) { setD(null); return; }
    setD(undefined);
    return store.watchDoc(path, setD, e => { console.warn(path, e); setD(null); });
  }, [path]);
  return d;
}
export function useCol(path, filters) {
  const key = JSON.stringify(filters || []);
  const [d, setD] = useState(undefined);
  useEffect(() => {
    if (!path) { setD([]); return; }
    setD(undefined);
    return store.watchCol(path, filters || [], setD, e => { console.warn(path, e); setD([]); });
  }, [path, key]);
  return d;
}

/* ---------- formatting ---------- */
const DATE_OPTS = { day: 'numeric', month: 'short', year: 'numeric' };
export const ts = d => { if (!d) return 0; const t = Date.parse(d + 'T12:00:00'); return isNaN(t) ? 0 : t; };
export const fmtDate = d => (ts(d) ? new Date(ts(d)).toLocaleDateString('de-DE', DATE_OPTS) : '');
export const fmtDay = d => (ts(d) ? new Date(ts(d)).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : '');
export const isoToday = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
export const daysUntil = d => (ts(d) ? Math.round((ts(d) - ts(isoToday())) / 864e5) : null);
export const relDays = n => (n === 0 ? 'heute' : n === 1 ? 'morgen' : n > 1 ? `in ${n} Tagen` : n === -1 ? 'gestern' : `vor ${-n} Tagen`);
export const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

/* ---------- small components ---------- */
export function Medal({ cls, species, size = '' }) {
  // Big emoji = species, small badge = class. Small sizes show the species only.
  const sp = SPECIES_EMOJI[species]; const cl = CLASS_EMOJI[cls] || '🎲';
  const badge = sp && (size === '' || size === 'lg');
  return html`<span class=${'med ' + size} style=${`--h:${HUE[cls] ?? 220}`} role="img" aria-label=${[species, cls].filter(Boolean).join(' ') || 'Charakter'}>
    <span class="emo" aria-hidden="true">${sp || cl}</span>
    ${badge && html`<span class="med-badge" title=${cls}><span class="emo" aria-hidden="true">${cl}</span></span>`}</span>`;
}
export const Logo = () => html`<svg class="logo" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: D20 }}></svg>`;
export const Pill = ({ tone = '', children }) => html`<span class=${'pill ' + tone}>${children}</span>`;
export const Empty = ({ title, children, action }) => html`<div class="empty">${title && html`<h3>${title}</h3>`}<p>${children}</p>${action}</div>`;
export const Spinner = ({ label = 'Lädt…' }) => html`<div class="loading" role="status">${label}</div>`;

export function HpBar({ hp, max }) {
  const pct = max ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  const tone = !max ? '' : hp / max <= 0.25 ? 'low' : hp / max <= 0.5 ? 'mid' : '';
  return html`<div class=${'hpbar ' + tone}><i style=${`width:${pct}%`}></i></div>`;
}

/* ---------- modal sheet ---------- */
export function Modal({ title, eyebrow, onClose, children, wide, lead }) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    const k = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    const f = ref.current?.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button.primary');
    f?.focus();
    return () => { document.removeEventListener('keydown', k); prev?.focus?.(); };
  }, []);
  return html`<div class="scrim" onClick=${onClose}></div>
    <div class=${'sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" ref=${ref}>
      <div class="sheet-head"><div class="who-line">${lead}<div>${eyebrow && html`<span class="label">${eyebrow}</span>`}<h2>${title}</h2></div></div>
        <button class="x" onClick=${onClose} aria-label="Schließen">×</button></div>
      ${children}
    </div>`;
}

/* ---------- confirm-in-place delete ---------- */
export function DeleteButton({ label = 'Löschen', question, onConfirm }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ask) return html`<button type="button" class="btn danger" onClick=${() => setAsk(true)}>${label}</button>`;
  return html`<span class="confirm">${question} <button type="button" class="btn danger small" disabled=${busy} onClick=${async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>Löschen</button>
    <button type="button" class="btn small" onClick=${() => setAsk(false)}>Behalten</button></span>`;
}

/* ---------- form fields ---------- */
export const Field = ({ label, children, wide, hint }) => html`<label class=${'f' + (wide ? ' wide' : '')}><span>${label}</span>${children}${hint && html`<small class="hint">${hint}</small>`}</label>`;

/* ---------- toast ---------- */
export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
}
export function failed(e) {
  console.error(e);
  const code = e?.code || '';
  toast(code.includes('permission') ? 'Dafür hast du keine Berechtigung.' : code.includes('unavailable') ? 'Keine Verbindung. Versuch es gleich nochmal.' : 'Speichern hat nicht geklappt. Versuch es nochmal.');
}

/* ---------- campaign theme ---------- */
export function applyTheme(key) {
  const t = THEMES[key] || THEMES.standard;
  const r = document.documentElement.style;
  r.setProperty('--theme-accent', t.accent); r.setProperty('--theme-accent-dark', t.accentDark);
  r.setProperty('--theme-tint', t.tint); r.setProperty('--theme-tint-dark', t.tintDark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.accent);
}

/* ---------- routing (hash based, works on GitHub Pages) ---------- */
export function useRoute() {
  const get = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [r, setR] = useState(get());
  useEffect(() => { const f = () => { setR(get()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
export const go = (...parts) => { location.hash = '#/' + parts.map(encodeURIComponent).join('/'); };
export const href = (...parts) => '#/' + parts.map(encodeURIComponent).join('/');

/* ---------- dice bus: any component can ask the dice tray to roll ---------- */
export const requestRoll = detail => dispatchEvent(new CustomEvent('dndm-roll', { detail }));

/* ---------- "see it as a player" preview (per browser tab, per campaign) ---------- */
const PKEY = 'dndm-preview';
export function usePreview(cid) {
  const read = () => { try { return sessionStorage.getItem(PKEY) === cid; } catch (e) { return false; } };
  const [on, setOn] = useState(read);
  useEffect(() => { const f = () => setOn(read()); addEventListener('dndm-preview', f); setOn(read()); return () => removeEventListener('dndm-preview', f); }, [cid]);
  const set = v => { try { v ? sessionStorage.setItem(PKEY, cid) : sessionStorage.removeItem(PKEY); } catch (e) {} dispatchEvent(new CustomEvent('dndm-preview')); };
  return [on, set];
}
export const PreviewBar = ({ text, onExit }) => html`<div class="preview-bar" role="status"><span><b>Spieler-Vorschau.</b> ${text}</span><button class="btn small" onClick=${onExit}>Vorschau beenden</button></div>`;
