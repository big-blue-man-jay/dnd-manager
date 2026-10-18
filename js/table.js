// Table screen: a tablet in the middle of the table that everyone can see. Display only, nothing secret:
// story mode shows the place, the mood and the party; in a fight (or when the DM switches to it) the map.
// Fresh reveals for the whole group pop up big. Everything updates live from the DM's laptop.
import { html, useState, useEffect, Medal, Spinner, HpBar, Empty, applyTheme, go } from './ui.js';
import { useCampaign, KINDS } from './campaign.js';
import { BattleMap } from './map.js';
import { TurnStrip } from './session.js';

export function TableScreen({ user, cid }) {
  const { camp, chars, revelations, isDM } = useCampaign(cid, user);
  const [full, setFull] = useState(!!document.fullscreenElement);
  const [now, setNow] = useState(Date.now());
  const [seen, setSeen] = useState(0);
  useEffect(() => { if (camp) applyTheme(camp.theme); }, [camp?.theme]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  // keep the tablet awake while this screen is open
  useEffect(() => { let lock = null; const get = () => navigator.wakeLock?.request('screen').then(l => { lock = l; }).catch(() => {});
    get(); const vis = () => { if (document.visibilityState === 'visible') get(); }; document.addEventListener('visibilitychange', vis);
    const fs = () => setFull(!!(document.fullscreenElement || document.webkitFullscreenElement)); document.addEventListener('fullscreenchange', fs); document.addEventListener('webkitfullscreenchange', fs);
    return () => { lock?.release?.().catch(() => {}); document.removeEventListener('visibilitychange', vis); document.removeEventListener('fullscreenchange', fs); document.removeEventListener('webkitfullscreenchange', fs); }; }, []);
  const goFull = () => { const el = document.documentElement; try { (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {}); } catch (e) { /* the screen still fills the window */ } };
  const leave = () => { const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen)?.call(d)?.catch?.(() => {}); go('spiel'); };

  if (camp === undefined) return html`<${Spinner}/>`;
  if (!camp) return html`<main class="page"><${Empty} title="Keine aktive Kampagne">Wähle zuerst unter 🏰 Kampagnen die Kampagne, die ihr spielt.</${Empty}></main>`;
  const t = camp.table || {}, cb = camp.combat || null;
  const showMap = !!cb || t.show === 'map';
  // a reveal for everyone from the last 90 seconds is shown big until someone taps it away
  const fresh = revelations.filter(r => r.audience === 'all' && r.createdAt > now - 90000 && r.createdAt > seen).sort((a, b) => b.createdAt - a.createdAt)[0];

  return html`<div class=${'tablescreen' + (showMap ? ' map' : ' story')}>
    <div class="tsc-bar">
      ${showMap && cb ? html`<${TurnStrip} cb=${cb} chars=${chars} big/>` : showMap ? html`<span class="tsc-title">${t.place || camp.name}</span>` : html`<span></span>`}
      <span class="tsc-ctl">${!full && html`<button class="tsc-btn" onClick=${goFull} title="Vollbild">⛶</button>`}<button class="tsc-btn" onClick=${leave} aria-label="Tischbildschirm verlassen" title="Zurück">✕</button></span></div>
    ${showMap ? html`<${BattleMap} cid=${cid} camp=${camp} chars=${chars} isDM=${isDM} user=${user} display/>`
      : html`<div class="tsc-scene">
          <span class="label">${camp.name}</span>
          <h1>${t.place || 'Willkommen am Tisch'}</h1>
          ${t.mood ? html`<p class="tsc-mood">${t.mood}</p>` : !t.place && html`<p class="tsc-mood muted">Der DM setzt hier gleich die erste Szene.</p>`}
        </div>
        <div class="tsc-party">${chars.map(c => html`<div class=${'tsc-pc' + ((c.hp ?? 0) <= 0 ? ' down' : '')}>
            <${Medal} cls=${c.cls} species=${c.species} size="lg"/>
            <div class="tsc-pc-body"><b>${c.name}</b><span class="num">${c.hp ?? 0} / ${c.hpMax ?? 0} HP${c.tempHp ? ` +${c.tempHp}` : ''}</span><${HpBar} hp=${c.hp || 0} max=${c.hpMax || 0}/>
              ${(c.conc || (c.conditions || []).length || c.exhaustion) ? html`<div class="chips">${c.conc && html`<span class="chip conc">🧠 ${c.conc}</span>`}${(c.conditions || []).map(x => html`<span class="chip cond">${x}</span>`)}${c.exhaustion ? html`<span class="chip cond">Exhaustion ${c.exhaustion}</span>` : ''}</div>` : ''}</div></div>`)}</div>`}
    ${fresh && html`<div class="tsc-reveal" role="dialog" aria-label="Enthüllung" onClick=${() => setSeen(fresh.createdAt)}>
      <div class="tsc-rcard"><span class="label">${fresh.kind === 'quest' ? 'Neue Quest' : `${KINDS[fresh.kind] || 'Geheimnis'} enthüllt`}</span><h2>${fresh.title}</h2><p class="pre">${fresh.body}</p>
        ${fresh.reason && html`<p class="muted">${fresh.kind === 'quest' ? 'Freigeschaltet, weil' : 'Aufgedeckt, weil'}: ${fresh.reason}</p>`}</div></div>`}
  </div>`;
}
