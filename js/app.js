import { html, render, useState, useEffect, useMemo, useDoc, Medal, Logo, Pill, Empty, Spinner, HpBar, Modal, Field, toast, failed,
  applyTheme, useRoute, go, href, fmtDay, daysUntil, relDays, plural } from './ui.js';
import { store } from './data.js';
import { THEMES } from './rules5e.js';
import { ensureUser, createCampaign, joinCampaign, createExampleCampaign, libId, ensureLibrary, assignToCampaign } from './ops.js';
import { SessionPage } from './session.js';
import { TableScreen } from './table.js';
import { diceSettings } from './dice3d.js';
import { CampaignPage, CampaignForm } from './campaign.js';
import { STATUS, CharCard, clsName, AcValue } from './cards.js';
import { getLook, setLook } from './ui.js';
import { importCampaign } from './backup.js';
import { CharacterPage, NewCharacter, DiceTray } from './character.js';


/* ---------- login ---------- */
function Login({ mode }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const signIn = async () => { setBusy(true); setErr(''); try { await store.signIn(); } catch (e) { if (e.friendly) setErr(e.message); else failed(e); } finally { setBusy(false); } };
  // Links opened from WhatsApp, Instagram & co. open in a built-in browser where Google sign-in fails.
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Snapchat|TikTok|musical_ly|Line\/|Telegram|GSA\/|; wv\)/i.test(navigator.userAgent);
  return html`<main class="login-wrap"><section class="login panel">
    <${Logo}/>
    <div class="login-head"><span class="label">DnD Manager</span><h1>Willkommen am Tisch</h1>
      <p class="muted">Charaktere, Würfel, Sitzungen und Geheimnisse deiner Kampagnen an einem Ort.</p></div>
    ${mode === 'firebase'
      ? html`${inApp && html`<div class="login-warn"><b>Bitte im richtigen Browser öffnen.</b> Du hast die Seite aus einer App heraus geöffnet, dort klappt die Google-Anmeldung oft nicht. Tippe auf <b>⋯</b> oder das Teilen-Symbol und wähle <b>„In Safari öffnen“</b> bzw. <b>„Im Browser öffnen“</b>.</div>`}
          <button class="btn primary big" onClick=${signIn} disabled=${busy}><span class="g">G</span> Mit Google anmelden</button>
          ${err && html`<div class="login-warn" role="alert">${err}</div>`}
          <p class="ro-note">Dein Google-Konto bestimmt, was du sehen und ändern darfst. Wir speichern nur deinen Namen.</p>`
      : html`<div class="demo-note"><b>Demo-Modus.</b> Firebase ist noch nicht eingerichtet, deshalb bleiben alle Daten nur in diesem Browser. Wähle ein Test-Konto:</div>
          <div class="people">${store.demoUsers().map(u => html`<button class="person" onClick=${() => store.demoSwitch(u.uid)}><span class="ava sm">${u.name[0]}</span><span class="pt"><b>${u.name}</b></span><span class="go" aria-hidden="true">→</span></button>`)}</div>`}
  </section></main>`;
}

/* ---------- top bar ---------- */
function TopBar({ user }) {
  return html`<header class="appbar">
    <a class="brand" href="#/"><${Logo}/>DnD Manager</a>
    <a class="user-btn" href="#/einstellungen" aria-label="Einstellungen">${user.photo ? html`<img src=${user.photo} alt="" referrerpolicy="no-referrer"/>` : html`<span class="ava sm">${user.name[0]}</span>`}<span class="nm">${user.name}</span></a>
  </header>`;
}

/* ---------- bottom navigation: the five chapters of the app ---------- */
const NAV = [['kampagnen', '🏰', 'Kampagnen'], ['charaktere', '🧙', 'Charaktere'], ['aktiv', '⭐', 'Aktiv'], ['spiel', '🎲', 'Spieltisch'], ['einstellungen', '⚙️', 'Einstellungen']];
function BottomNav({ cur }) {
  return html`<nav class="bottomnav" aria-label="Hauptmenü">${NAV.map(([k, e, l]) => html`<a href=${'#/' + k} aria-current=${cur === k ? 'page' : undefined}><span class="bn-ico" aria-hidden="true">${e}</span><span class="bn-t">${l}</span></a>`)}</nav>`;
}

/* ---------- shared data: my campaigns, my characters, the active campaign ---------- */
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
  const all = ids.map(id => camps[id]).filter(Boolean);
  const campaigns = all.filter(c => !c.library);
  const myChars = Object.entries(chars).filter(([cid]) => ids.includes(cid)).flatMap(([cid, l]) => (l || []).map(c => ({ ...c, campaignId: cid })));
  const order = { active: 0, paused: 1, finished: 2 };
  const fallback = [...campaigns].filter(c => (c.status || 'active') === 'active').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const active = campaigns.find(c => c.id === me?.activeCampaign) || fallback || null;
  return { loading, me, campaigns, myChars, active, order };
}

/* ---------- 🏰 campaigns ---------- */
function CampaignsPage({ user, data }) {
  useEffect(() => applyTheme('standard'), []);
  const { loading, campaigns, myChars, active, order } = data;
  const [modal, setModal] = useState(null);
  const example = async () => { try { const cid = await createExampleCampaign(user); toast('Beispielkampagne angelegt.'); go('c', cid); } catch (x) { failed(x); } };
  const camps = [...campaigns].sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0) || (b.createdAt || 0) - (a.createdAt || 0));
  if (loading) return html`<${Spinner}/>`;
  return html`<main class="page">
    <section class="greet"><span class="label">Willkommen zurück, ${user.name.split(' ')[0]}</span><h1>Kampagnen</h1></section>
    <div class="actions"><button class="btn" onClick=${() => setModal('join')}>🔑 Mit Code beitreten</button><button class="btn primary" onClick=${() => setModal('create')}>➕ Neue Kampagne</button></div>
    ${!camps.length ? html`<${Empty} title="Noch keine Kampagne" action=${html`<button class="btn" onClick=${example}>Beispielkampagne zum Ausprobieren anlegen</button>`}>Als Spieler: Lass dir vom DM den Beitrittscode geben. Als DM: Erstelle eine neue Kampagne, du wirst automatisch ihr Dungeon Master.</${Empty}>`
      : ['active', 'paused', 'finished'].map(st => { const g = camps.filter(c => (c.status || 'active') === st); return g.length ? html`<section><div class="label group-label">${st === 'active' ? '⚔️ Laufend' : st === 'paused' ? '⏸️ Pausiert' : '🏁 Beendet'}</div><div class="grid camps">${g.map(c => html`<${CampCard} c=${c} user=${user} active=${active?.id === c.id} mine=${myChars.filter(x => x.campaignId === c.id)}/>`)}</div></section>` : null; })}
    ${modal === 'join' && html`<${JoinModal} user=${user} onClose=${() => setModal(null)}/>`}
    ${modal === 'create' && html`<${Modal} title="Neue Kampagne" eyebrow="Du wirst Dungeon Master" onClose=${() => setModal(null)}>
      <${CampaignForm} user=${user} onSave=${async data => { const cid = await createCampaign(user, data); setModal(null); toast(`${data.name} beginnt.`); go('c', cid); }} onCancel=${() => setModal(null)}/>
      <div class="restore"><span class="muted">Oder eine gespeicherte Kampagne wiederherstellen:</span><${RestoreButton} user=${user} onDone=${() => setModal(null)}/></div></${Modal}>`}
  </main>`;
}
const RestoreButton = ({ user, onDone }) => html`<label class="btn small">💾 Sicherung laden<input type="file" accept=".json,application/json" hidden onChange=${async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  try { const cid = await importCampaign(user, f); onDone?.(); toast('Kampagne wiederhergestellt. Schick deinen Spielern den neuen Code.'); go('c', cid); } catch (x) { x.friendly ? toast(x.message) : failed(x); } }}/></label>`;

/* ---------- 🧙 characters: grouped by campaign, plus the ones without a campaign ---------- */
function CharactersPage({ user, data }) {
  useEffect(() => applyTheme('standard'), []);
  const { loading, me, campaigns, myChars } = data;
  const [busy, setBusy] = useState(false);
  if (loading) return html`<${Spinner}/>`;
  const lib = libId(user.uid);
  const campById = Object.fromEntries(campaigns.map(c => [c.id, c]));
  const recent = [...myChars].filter(c => c.campaignId !== lib).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0];
  const loose = myChars.filter(c => c.campaignId === lib);
  const neu = async () => { setBusy(true); try { await ensureLibrary(user, me); go('charaktere', 'neu'); } catch (x) { failed(x); } finally { setBusy(false); } };
  const assign = async (c, cid) => { if (!cid) return; try { const id = await assignToCampaign(user, c, cid); toast(`${c.name} ist jetzt in ${campById[cid]?.name}. Dein DM gibt den Bogen frei.`); go('c', cid, 'char', id); } catch (x) { failed(x); } };
  return html`<main class="page">
    <section class="greet"><h1>Charaktere</h1><p class="muted">Alle deine Helden, sortiert nach Kampagne. Neue Charaktere kannst du auch ohne Kampagne bauen und später mitbringen.</p></section>
    <div class="actions"><button class="btn primary" disabled=${busy} onClick=${neu}>➕ Neuer Charakter</button></div>
    ${recent && html`<${FeatureCard} c=${recent} camp=${campById[recent.campaignId]}/>`}
    ${campaigns.map(cp => { const list = myChars.filter(c => c.campaignId === cp.id); return list.length ? html`<section><div class="label group-label"><a href=${href('c', cp.id)}>🏰 ${cp.name}</a></div><div class="grid cards">${list.map(c => html`<${CharCard} c=${c} camp=${cp}/>`)}</div></section>` : null; })}
    <section><div class="label group-label">📦 Ohne Kampagne</div>
      ${loose.length ? html`<div class="grid cards">${loose.map(c => html`<div class="loose"><${CharCard} c=${c}/>
        <label class="assign"><span class="label">Zu Kampagne hinzufügen</span><select value="" onChange=${e => assign(c, e.target.value)}><option value="">Kampagne wählen …</option>${campaigns.filter(cp => (cp.status || 'active') !== 'finished').map(cp => html`<option value=${cp.id}>${cp.name}</option>`)}</select></label></div>`)}</div>`
        : html`<p class="muted">Hier landen Charaktere, die du ohne Kampagne erstellst. Praktisch, um schon mal vorzubauen.</p>`}</section>
    ${!myChars.length && html`<${Empty} title="Noch kein Charakter">Erstelle deinen ersten Helden mit „Neuer Charakter“. Der Ersteller führt dich Schritt für Schritt durch.</${Empty}>`}
  </main>`;
}

/* ---------- ⚙️ settings ---------- */
function SettingsPage({ user, mode }) {
  useEffect(() => applyTheme('standard'), []);
  const [look, setLookS] = useState(getLook());
  const [dice, setDice] = useState({ anim: diceSettings.anim, sound: diceSettings.sound });
  const toggle = k => { diceSettings[k] = !dice[k]; setDice({ ...dice, [k]: !dice[k] }); };
  return html`<main class="page narrow settings-page">
    <section class="greet"><h1>Einstellungen</h1></section>
    <section class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">👤</span>Konto</h2></div>
      <div class="who-row">${user.photo ? html`<img class="ava" src=${user.photo} alt="" referrerpolicy="no-referrer"/>` : html`<span class="ava">${user.name[0]}</span>`}<div><b>${user.name}</b><div class="sub">${mode === 'firebase' ? 'Angemeldet mit Google' : 'Demo-Modus: Daten nur in diesem Browser'}</div></div></div>
      ${mode === 'demo' && html`<div class="actions">${store.demoUsers().filter(u => u.uid !== user.uid).map(u => html`<button class="btn small" onClick=${() => { store.demoSwitch(u.uid); go(); }}>Wechseln zu ${u.name}</button>`)}</div>`}
      <div><button class="btn" onClick=${() => { store.signOut(); go(); }}>🚪 Abmelden</button></div></section>
    <section class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">🎨</span>Darstellung</h2></div>
      <div class="seg wide">${[['light', '☀️ Hell'], ['dark', '🌙 Dunkel'], ['auto', '🖥️ Wie das Gerät']].map(([k, l]) => html`<button aria-pressed=${look === k} onClick=${() => { setLook(k); setLookS(k); }}>${l}</button>`)}</div>
      <p class="ro-note">Hell ist ein warmes Pergament-Weiß, Dunkel ein tiefes Nachtblau. Jede Kampagne färbt die Akzente in ihrem Theme.</p></section>
    <section class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">🎲</span>Würfel</h2></div>
      <label class="switch"><input type="checkbox" checked=${dice.anim} onChange=${() => toggle('anim')}/><span><b>3D-Wurf</b><small>Würfel fliegen über den Bildschirm. Aus = Ergebnis sofort.</small></span></label>
      <label class="switch"><input type="checkbox" checked=${dice.sound} onChange=${() => toggle('sound')}/><span><b>Ton</b><small>Klackern beim Aufprall, Fanfare bei einer natürlichen 20.</small></span></label></section>
    <section class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">💾</span>Sicherung</h2></div>
      <p class="ro-note">Sicherungen lädst du als DM in der Kampagne unter Einstellungen herunter. Hier stellst du eine wieder her, sie wird als neue Kampagne angelegt.</p>
      <div><${RestoreButton} user=${user}/></div></section>
    <section class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">📱</span>Als App installieren</h2></div>
      <p class="ro-note">iPhone: Teilen → Zum Home-Bildschirm. Android: Menü → App installieren. Mac (Safari): Ablage → Zum Dock hinzufügen.</p></section>
  </main>`;
}

/* ---------- ⭐ / 🎲 without an active campaign ---------- */
const NoActive = ({ what }) => html`<main class="page"><${Empty} title="Keine aktive Kampagne" action=${html`<a class="btn primary" href="#/kampagnen">🏰 Zu den Kampagnen</a>`}>${what} Öffne eine Kampagne und tippe auf „⭐ Als aktive Kampagne festlegen“.</${Empty}></main>`;

function FeatureCard({ c, camp }) {
  const n = camp ? daysUntil(camp.nextDate) : null;
  return html`<article class="feature panel">
    <div class="feat-main">
      <div class="flag"><span class="most">Zuletzt gespielt</span><span class="label">${camp?.name || ''}</span>${!c.locked && html`<${Pill} tone="warn">Entwurf</${Pill}>`}</div>
      <div class="feat-name"><${Medal} cls=${c.cls} species=${c.species} size="lg"/><div class="nc-id"><h3>${c.name}</h3><div class="sub">Stufe ${c.level || 1} · ${[c.species, clsName(c), c.subclass && `(${c.subclass})`].filter(Boolean).join(' ')}</div></div></div>
      <div class="statline"><div class="stat ac"><span class="label"><span class="ico" aria-hidden="true">🛡️</span>AC</span><b class="num"><${AcValue} c=${c}/></b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">⭐</span>Stufe</span><b class="num">${c.level || 1}</b></div><div class="stat"><span class="label"><span class="ico" aria-hidden="true">👟</span>Speed</span><b class="num">${c.speed || 30}</b></div><div class="stat"><span class="label">XP</span><b class="num">${(c.xp || 0).toLocaleString('de-DE')}</b></div></div>
      <div><div class="hprow"><span class="label"><span class="ico" aria-hidden="true">❤️</span>Hit Points</span><span class="num"><b>${c.hp ?? 0}</b> / ${c.hpMax ?? 0}</span></div><${HpBar} hp=${c.hp || 0} max=${c.hpMax || 0}/></div>
      <div class="actions"><a class="btn primary" href=${href('c', c.campaignId, 'char', c.id)}>Charakterbogen öffnen</a><a class="btn" href=${href('c', c.campaignId)}>Zur Kampagne</a></div>
    </div>
    <aside class="feat-side">
      ${n !== null && n >= 0 && html`<div><span class="label"><span class="ico" aria-hidden="true">📅</span>Nächste Sitzung</span><p><b>${fmtDay(camp.nextDate)}${camp.nextTime ? ' · ' + camp.nextTime : ''}</b> <span class="muted">${relDays(n)}</span></p></div>`}
      <div><span class="label"><span class="ico" aria-hidden="true">🏰</span>Kampagne</span><p>${camp?.name}</p>${camp?.description && html`<p class="muted small">${camp.description}</p>`}</div>
    </aside></article>`;
}

function CampCard({ c, user, mine, active }) {
  const isDM = c.dmUid === user.uid; const st = c.status || 'active'; const n = daysUntil(c.nextDate);
  return html`<a class=${'camp-card panel ' + st} href=${href('c', c.id)} style=${`--ca:${(THEMES[c.theme] || THEMES.standard).accent}`}>
    <div class="top"><h3>${c.name}</h3><div class="pills">${active && html`<${Pill} tone="gild">⭐ Aktiv</${Pill}>`}${isDM && html`<${Pill} tone="gild">Du bist DM</${Pill}>`}<${Pill} tone=${st}>${STATUS[st]}</${Pill}></div></div>
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
  return html`<${Shell} user=${user} mode=${mode} route=${route}/>`;
}

function Shell({ user, mode, route }) {
  const data = useMyCampaigns(user);
  const lib = libId(user.uid), act = data.active?.id;
  let view, cur;
  const [r0, r1, r2, r3] = route;
  if (r0 === 'c' && r1) {
    if (r2 === 'char' && r3) { view = html`<${CharacterPage} key=${r3} user=${user} cid=${r1} chId=${r3}/>`; cur = r1 === lib || !act || r1 !== act ? 'charaktere' : 'aktiv'; }
    else if (r2 === 'neu') { view = html`<${NewCharacter} user=${user} cid=${r1}/>`; cur = r1 === lib ? 'charaktere' : r1 === act ? 'aktiv' : 'kampagnen'; }
    else if (r1 === lib) { view = html`<${CharactersPage} user=${user} data=${data}/>`; cur = 'charaktere'; }
    else { view = html`<${CampaignPage} key=${r1} user=${user} cid=${r1} tab=${r2 || 'uebersicht'}/>`; cur = r1 === act ? 'aktiv' : 'kampagnen'; }
  } else if (r0 === 'charaktere') {
    cur = 'charaktere';
    view = r1 === 'neu' ? html`<${NewCharacter} user=${user} cid=${lib}/>` : html`<${CharactersPage} user=${user} data=${data}/>`;
  } else if (r0 === 'aktiv' || (!r0 && act)) {
    cur = 'aktiv';
    view = data.loading ? html`<${Spinner}/>` : act ? html`<${CampaignPage} key=${act} user=${user} cid=${act} tab=${r1 || 'uebersicht'}/>` : html`<${NoActive} what="Hier erscheint die Kampagne, die ihr gerade spielt."/>`;
  } else if (r0 === 'spiel') {
    cur = 'spiel';
    view = data.loading ? html`<${Spinner}/>` : act ? html`<${SessionPage} key=${act} user=${user} cid=${act}/>` : html`<${NoActive} what="Der Spielabend-Bildschirm gehört immer zur aktiven Kampagne."/>`;
  } else if (r0 === 'tisch') {
    // table screen for the tablet: no app chrome, no dice, just what everyone may see
    return data.loading ? html`<${Spinner}/>` : act ? html`<${TableScreen} key=${act} user=${user} cid=${act}/>` : html`<${NoActive} what="Der Tischbildschirm zeigt immer die aktive Kampagne."/>`;
  } else if (r0 === 'einstellungen') { cur = 'einstellungen'; view = html`<${SettingsPage} user=${user} mode=${mode}/>`; }
  else { cur = 'kampagnen'; view = data.loading ? html`<${Spinner}/>` : html`<${CampaignsPage} user=${user} data=${data}/>`; }
  return html`<${TopBar} user=${user}/>${mode === 'demo' && html`<div class="demo-bar">Demo-Modus: Daten bleiben nur in diesem Browser.</div>`}${view}<${DiceTray}/><${BottomNav} cur=${cur}/>`;
}

store.init().then(mode => render(html`<${App} mode=${mode}/>`, document.getElementById('app')))
  .catch(e => { console.error(e); document.getElementById('app').innerHTML = '<p class="boot-error">DnD Manager konnte nicht starten. Prüfe die Firebase-Einstellungen in js/config.js.</p>'; });

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
