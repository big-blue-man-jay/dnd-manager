import { html, render, useState, useEffect, useMemo, useDoc, Medal, Logo, Pill, Empty, Spinner, HpBar, Modal, Field, toast, failed,
  applyTheme, useRoute, go, href, fmtDay, daysUntil, relDays, plural } from './ui.js';
import { store } from './data.js';
import { THEMES } from './rules5e.js';
import { ensureUser, createCampaign, joinCampaign, createExampleCampaign } from './ops.js';
import { CampaignPage, CampaignForm } from './campaign.js';
import { STATUS, CharCard, clsName, AcValue } from './cards.js';
import { importCampaign } from './backup.js';
import { CharacterPage, NewCharacter, DiceTray } from './character.js';


/* ---------- login ---------- */
function Login({ mode }) {
  const [busy, setBusy] = useState(false);
  const signIn = async () => { setBusy(true); try { await store.signIn(); } catch (e) { failed(e); } finally { setBusy(false); } };
  return html`<main class="login-wrap"><section class="login panel">
    <${Logo}/>
    <div class="login-head"><span class="label">DnD Manager</span><h1>Willkommen am Tisch</h1>
      <p class="muted">Charaktere, Würfel, Sitzungen und Geheimnisse deiner Kampagnen an einem Ort.</p></div>
    ${mode === 'firebase'
      ? html`<button class="btn primary big" onClick=${signIn} disabled=${busy}><span class="g">G</span> Mit Google anmelden</button>
          <p class="ro-note">Dein Google-Konto bestimmt, was du sehen und ändern darfst. Wir speichern nur deinen Namen.</p>`
      : html`<div class="demo-note"><b>Demo-Modus.</b> Firebase ist noch nicht eingerichtet, deshalb bleiben alle Daten nur in diesem Browser. Wähle ein Test-Konto:</div>
          <div class="people">${store.demoUsers().map(u => html`<button class="person" onClick=${() => store.demoSwitch(u.uid)}><span class="ava sm">${u.name[0]}</span><span class="pt"><b>${u.name}</b></span><span class="go" aria-hidden="true">→</span></button>`)}</div>`}
  </section></main>`;
}

/* ---------- top bar ---------- */
function TopBar({ user, mode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!e.target.closest('.menu-wrap')) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return html`<header class="appbar">
    <a class="brand" href="#/"><${Logo}/>DnD Manager</a>
    <div class="menu-wrap">
      <button class="user-btn" onClick=${() => setOpen(!open)} aria-expanded=${open}>${user.photo ? html`<img src=${user.photo} alt="" referrerpolicy="no-referrer"/>` : html`<span class="ava sm">${user.name[0]}</span>`}<span class="nm">${user.name}</span></button>
      ${open && html`<div class="menu" role="menu" onClick=${() => setOpen(false)}><div class="menu-who"><b>${user.name}</b><span class="sub">Angemeldet${mode === 'firebase' ? ' mit Google' : ''}</span></div>
        ${mode === 'demo' && html`<div class="menu-note">Demo-Modus</div>${store.demoUsers().filter(u => u.uid !== user.uid).map(u => html`<button onClick=${() => { store.demoSwitch(u.uid); go(); }}>Wechseln zu ${u.name}</button>`)}`}
        <button onClick=${() => { store.signOut(); go(); }}>Abmelden</button></div>`}
    </div></header>`;
}

/* ---------- start page ---------- */
function useMyCampaigns(user) {
  const me = useDoc(`users/${user.uid}`);
  const ids = me?.campaignIds || [];
  const [camps, setCamps] = useState({});
  const [chars, setChars] = useState({});
  const key = ids.join(',');
  useEffect(() => {
    const unsubs = [];
    setCamps(c => Object.fromEntries(Object.entries(c).filter(([k]) => ids.includes(k))));
    for (const cid of ids) {
      unsubs.push(store.watchDoc(`campaigns/${cid}`, d => setCamps(c => ({ ...c, [cid]: d })), () => setCamps(c => ({ ...c, [cid]: null }))));
      unsubs.push(store.watchCol(`campaigns/${cid}/characters`, [['ownerUid', '==', user.uid]], l => setChars(c => ({ ...c, [cid]: l })), () => setChars(c => ({ ...c, [cid]: [] }))));
    }
    return () => unsubs.forEach(u => u());
  }, [key]);
  const loading = me === undefined;
  const campaigns = ids.map(id => camps[id]).filter(Boolean);
  const myChars = Object.entries(chars).filter(([cid]) => ids.includes(cid)).flatMap(([cid, l]) => (l || []).map(c => ({ ...c, campaignId: cid })));
  return { loading, campaigns, myChars };
}

function Home({ user }) {
  useEffect(() => applyTheme('standard'), []);
  const { loading, campaigns, myChars } = useMyCampaigns(user);
  const [modal, setModal] = useState(null);
  const example = async () => { try { const cid = await createExampleCampaign(user); toast('Beispielkampagne angelegt.'); go('c', cid); } catch (x) { failed(x); } };
  const sorted = [...myChars].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  const campById = Object.fromEntries(campaigns.map(c => [c.id, c]));
  const order = { active: 0, paused: 1, finished: 2 };
  const camps = [...campaigns].sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0) || (b.createdAt || 0) - (a.createdAt || 0));
  if (loading) return html`<${Spinner}/>`;
  return html`<main class="page">
    <section class="greet"><span class="label">Willkommen zurück</span><h1>${user.name}</h1></section>
    <section><div class="bar"><h2>Deine Charaktere</h2></div>
      ${sorted.length ? html`<${FeatureCard} c=${sorted[0]} camp=${campById[sorted[0].campaignId]}/>
        ${sorted.length > 1 && html`<div class="label group-label">Weitere Charaktere</div><div class="grid cards">${sorted.slice(1).map(c => html`<${CharCard} c=${c} camp=${campById[c.campaignId]} showCamp/>`)}</div>`}`
      : html`<${Empty} title="Noch kein Charakter">Tritt einer Kampagne mit dem Code deines DMs bei und erstelle dort deinen Charakter.</${Empty}>`}
    </section>
    <section><div class="bar"><h2>Kampagnen</h2><div class="actions">
      <button class="btn" onClick=${() => setModal('join')}>Mit Code beitreten</button>
      <button class="btn primary" onClick=${() => setModal('create')}>Neue Kampagne</button></div></div>
      ${!camps.length ? html`<${Empty} title="Noch keine Kampagne" action=${html`<button class="btn" onClick=${example}>Beispielkampagne zum Ausprobieren anlegen</button>`}>Als Spieler: Lass dir vom DM den Beitrittscode geben. Als DM: Erstelle eine neue Kampagne, du wirst automatisch ihr Dungeon Master.</${Empty}>`
        : ['active', 'paused', 'finished'].map(st => { const g = camps.filter(c => (c.status || 'active') === st); return g.length ? html`<div class="label group-label">${st === 'active' ? 'Aktive Kampagnen' : STATUS[st]}</div><div class="grid camps">${g.map(c => html`<${CampCard} c=${c} user=${user} mine=${myChars.filter(x => x.campaignId === c.id)}/>`)}</div>` : null; })}
    </section>
    ${modal === 'join' && html`<${JoinModal} user=${user} onClose=${() => setModal(null)}/>`}
    ${modal === 'create' && html`<${Modal} title="Neue Kampagne" eyebrow="Du wirst Dungeon Master" onClose=${() => setModal(null)}>
      <${CampaignForm} user=${user} onSave=${async data => { const cid = await createCampaign(user, data); setModal(null); toast(`${data.name} beginnt.`); go('c', cid); }} onCancel=${() => setModal(null)}/>
      <div class="restore"><span class="muted">Oder eine gespeicherte Kampagne wiederherstellen:</span>
        <label class="btn small">Sicherung laden<input type="file" accept=".json,application/json" hidden onChange=${async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
          try { const cid = await importCampaign(user, f); setModal(null); toast('Kampagne wiederhergestellt. Schick deinen Spielern den neuen Code.'); go('c', cid); } catch (x) { x.friendly ? toast(x.message) : failed(x); } }}/></label></div></${Modal}>`}
  </main>`;
}

function FeatureCard({ c, camp }) {
  const n = camp ? daysUntil(camp.nextDate) : null;
  return html`<article class="feature panel">
    <div class="feat-main">
      <div class="flag"><span class="most">Zuletzt gespielt</span><span class="label">${camp?.name || ''}</span>${!c.locked && html`<${Pill} tone="warn">Entwurf</${Pill}>`}</div>
      <div class="feat-name"><${Medal} cls=${c.cls} species=${c.species} size="lg"/><div class="nc-id"><h3>${c.name}</h3><div class="sub">Stufe ${c.level || 1} · ${[c.species, clsName(c), c.subclass && `(${c.subclass})`].filter(Boolean).join(' ')}</div></div></div>
      <div class="statline"><div class="stat ac"><span class="label">AC</span><b class="num"><${AcValue} c=${c}/></b></div><div class="stat"><span class="label">Stufe</span><b class="num">${c.level || 1}</b></div><div class="stat"><span class="label">Speed</span><b class="num">${c.speed || 30}</b></div><div class="stat"><span class="label">XP</span><b class="num">${(c.xp || 0).toLocaleString('de-DE')}</b></div></div>
      <div><div class="hprow"><span class="label">Hit Points</span><span class="num"><b>${c.hp ?? 0}</b> / ${c.hpMax ?? 0}</span></div><${HpBar} hp=${c.hp || 0} max=${c.hpMax || 0}/></div>
      <div class="actions"><a class="btn primary" href=${href('c', c.campaignId, 'char', c.id)}>Charakterbogen öffnen</a><a class="btn" href=${href('c', c.campaignId)}>Zur Kampagne</a></div>
    </div>
    <aside class="feat-side">
      ${n !== null && n >= 0 && html`<div><span class="label">Nächste Sitzung</span><p><b>${fmtDay(camp.nextDate)}${camp.nextTime ? ' · ' + camp.nextTime : ''}</b> <span class="muted">${relDays(n)}</span></p></div>`}
      <div><span class="label">Kampagne</span><p>${camp?.name}</p>${camp?.description && html`<p class="muted small">${camp.description}</p>`}</div>
    </aside></article>`;
}

function CampCard({ c, user, mine }) {
  const isDM = c.dmUid === user.uid; const st = c.status || 'active'; const n = daysUntil(c.nextDate);
  return html`<a class=${'camp-card panel ' + st} href=${href('c', c.id)} style=${`--ca:${(THEMES[c.theme] || THEMES.standard).accent}`}>
    <div class="top"><h3>${c.name}</h3><div class="pills">${isDM && html`<${Pill} tone="gild">Du bist DM</${Pill}>`}<${Pill} tone=${st}>${STATUS[st]}</${Pill}></div></div>
    ${c.description && html`<p class="desc">${c.description}</p>`}
    ${mine.length ? html`<div class="chips">${mine.map(x => html`<span class="chip ic"><${Medal} cls=${x.cls} species=${x.species} size="sm"/>${x.name} · Stufe ${x.level || 1}</span>`)}</div>` : ''}
    <div class="meta">${st === 'active' && n !== null && n >= 0 ? html`<span>Nächste Sitzung <b>${fmtDay(c.nextDate)}</b> (${relDays(n)})</span>` : html`<span>${c.setting || 'Kein Termin geplant'}</span>`}<span>DM: ${c.dmName}</span></div>
  </a>`;
}

function JoinModal({ user, onClose }) {
  const [code, setCode] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async e => { e.preventDefault(); setBusy(true); setErr('');
    try { const cid = await joinCampaign(user, code); onClose(); toast('Willkommen in der Kampagne!'); go('c', cid); }
    catch (x) { x.friendly ? setErr(x.message) : failed(x); } finally { setBusy(false); } };
  return html`<${Modal} title="Kampagne beitreten" eyebrow="Beitrittscode" onClose=${onClose}>
    <form onSubmit=${submit} class="form">
      <${Field} label="Code von deinem DM"><input id="joinCode" class="code-input" value=${code} onInput=${e => setCode(e.target.value.toUpperCase())} maxlength="8" placeholder="K7QX2M" autocomplete="off"/></${Field}>
      ${err && html`<p class="err">${err}</p>`}
      <div class="foot"><button class="btn primary" disabled=${busy}>Beitreten</button><button type="button" class="btn" onClick=${onClose}>Abbrechen</button></div>
    </form></${Modal}>`;
}

/* ---------- app ---------- */
function App({ mode }) {
  const [user, setUser] = useState(undefined);
  const route = useRoute();
  useEffect(() => store.onUser(u => { setUser(u); if (u) ensureUser(u).catch(e => console.warn(e)); }), []);
  if (user === undefined) return html`<${Spinner} label="DnD Manager startet…"/>`;
  if (!user) return html`<${Login} mode=${mode}/>`;
  let view;
  if (route[0] === 'c' && route[1]) {
    const cid = route[1];
    if (route[2] === 'char' && route[3]) view = html`<${CharacterPage} key=${route[3]} user=${user} cid=${cid} chId=${route[3]}/>`;
    else if (route[2] === 'neu') view = html`<${NewCharacter} user=${user} cid=${cid}/>`;
    else view = html`<${CampaignPage} key=${cid} user=${user} cid=${cid} tab=${route[2] || 'uebersicht'}/>`;
  } else view = html`<${Home} user=${user}/>`;
  return html`<${TopBar} user=${user} mode=${mode}/>${mode === 'demo' && html`<div class="demo-bar">Demo-Modus: Daten bleiben nur in diesem Browser.</div>`}${view}<${DiceTray}/>`;
}

store.init().then(mode => render(html`<${App} mode=${mode}/>`, document.getElementById('app')))
  .catch(e => { console.error(e); document.getElementById('app').innerHTML = '<p class="boot-error">DnD Manager konnte nicht starten. Prüfe die Firebase-Einstellungen in js/config.js.</p>'; });

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
