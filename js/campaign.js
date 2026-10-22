import { html, useState, useEffect, useMemo, useDoc, useCol, usePreview, PreviewBar, Medal, Pill, Empty, Spinner, HpBar, Modal, Field, DeleteButton, toast, failed,
  applyTheme, go, href, fmtDate, fmtDay, isoToday, daysUntil, relDays, plural, int, initials, ts } from './ui.js';
import { store, newId, union } from './data.js';
import { THEMES, CONDITIONS, levelForXp } from './rules5e.js';
import { STATUS, CharCard, clsName, AcValue } from './cards.js';
import { exportCampaign } from './backup.js';
import { importPrep } from './prep.js';
import { TurnHelpButton } from './help.js';
import { leaveCampaign, newJoinCode, createDummyCharacter, setActiveCampaign } from './ops.js';
import { withLook, WorldBox, worldPath } from './world.js';
import { ZeroCard } from './zero.js';

const TABS = [['uebersicht', 'Übersicht', '🏠'], ['gruppe', 'Gruppe', '👥'], ['sitzungen', 'Sitzungen', '📖'], ['quests', 'Quests', '🗺️'], ['npcs', 'NPCs', '🎭'], ['enthuellungen', 'Enthüllungen', '🤯'], ['notizen', 'Notizen', '📝'], ['einstellungen', 'Einstellungen', '⚙️']];
const QSTATUS = { active: 'Läuft', done: 'Erledigt', failed: 'Gescheitert' };
const ATT = { friendly: 'Freundlich', neutral: 'Neutral', hostile: 'Feindlich' };
const NSTAT = { alive: 'Lebt', missing: 'Vermisst', dead: 'Tot', unknown: 'Unbekannt' };
export const KINDS = { secret: 'Geheimnis', identity: 'Wahre Identität', item: 'Gegenstand', letter: 'Brief', place: 'Ort', vision: 'Vision', quest: 'Neue Quest', npc: 'Neue Bekanntschaft', world: 'Neue Welt' };
// Hidden quests live in the DM-only secrets collection (kind 'quest') until the DM unlocks them.
const SECRET_KINDS = Object.entries(KINDS).filter(([k]) => k !== 'quest' && k !== 'world'); // a world reveal comes from the world box in the settings
// The condition behind a reveal or unlock, so players can later see why something came to light.
const Reason = ({ label, text }) => text ? html`<p class="reason"><span class="label">${label}</span><span>${text}</span></p>` : null;

/* ---------- campaign form (create + settings) ---------- */
export function CampaignForm({ user, campaign = {}, onSave, onCancel }) {
  const [f, setF] = useState({ name: '', description: '', setting: '', status: 'active', theme: 'standard', dmName: user.name, started: isoToday(), nextDate: '', nextTime: '', nextPlace: '', ...campaign });
  const [busy, setBusy] = useState(false);
  const set = k => e => setF(f => ({ ...f, [k]: e.target.value }));
  const submit = async e => { e.preventDefault(); if (!f.name.trim()) { toast('Gib der Kampagne einen Namen.'); return; } setBusy(true);
    try { await onSave({ name: f.name.trim(), description: f.description, setting: f.setting.trim(), status: f.status, theme: f.theme, dmName: f.dmName.trim() || user.name, started: f.started, nextDate: f.nextDate, nextTime: f.nextTime, nextPlace: f.nextPlace.trim() }); }
    catch (x) { failed(x); } finally { setBusy(false); } };
  return html`<form class="form" onSubmit=${submit}>
    <div class="sec"><h3>Die Kampagne</h3><div class="g g3">
      <${Field} label="Name"><input id="c-name" value=${f.name} onInput=${set('name')} placeholder="Lost Mine of Phandelver"/></${Field}>
      <${Field} label="Status"><select id="c-status" value=${f.status} onChange=${set('status')}>${Object.entries(STATUS).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></${Field}>
      <${Field} label="Gestartet"><input id="c-started" type="date" value=${f.started} onInput=${set('started')}/></${Field}>
      <${Field} label="DM-Name (sichtbar)"><input id="c-dm" value=${f.dmName} onInput=${set('dmName')}/></${Field}>
      <${Field} label="Setting"><input id="c-setting" value=${f.setting} onInput=${set('setting')} placeholder="Forgotten Realms, Homebrew…"/></${Field}></div>
      <${Field} label="Worum geht's"><textarea id="c-desc" value=${f.description} onInput=${set('description')} placeholder="Ein, zwei Sätze: Ort, Aufhänger, großer Bösewicht"></textarea></${Field}></div>
    <div class="sec"><h3>Theme</h3><p class="ro-note">Die Farben der Kampagne für alle Spieler. Du kannst das Theme wechseln, wenn die Gruppe ein neues Gebiet betritt.</p>
      <div class="swatches">${Object.entries(THEMES).map(([k, t]) => html`<label class=${'swatch' + (f.theme === k ? ' on' : '')} style=${`--sw:${t.accent}`}><input type="radio" name="theme" value=${k} checked=${f.theme === k} onChange=${set('theme')}/><i></i>${t.name}</label>`)}</div></div>
    <div class="sec"><h3>Nächste Sitzung</h3><div class="g g3">
      <${Field} label="Datum"><input id="c-nd" type="date" value=${f.nextDate} onInput=${set('nextDate')}/></${Field}>
      <${Field} label="Uhrzeit"><input id="c-nt" type="time" value=${f.nextTime} onInput=${set('nextTime')}/></${Field}>
      <${Field} label="Ort"><input id="c-np" value=${f.nextPlace} onInput=${set('nextPlace')} placeholder="Bei Joel, Discord…"/></${Field}></div></div>
    <div class="foot"><button class="btn primary" disabled=${busy}>${campaign.id ? 'Speichern' : 'Kampagne erstellen'}</button>${onCancel && html`<button type="button" class="btn" onClick=${onCancel}>Abbrechen</button>`}</div>
  </form>`;
}

/* ---------- data for one campaign ---------- */
export function useCampaign(cid, user) {
  const camp = useDoc(`campaigns/${cid}`);
  const ok = !!camp;
  const isDM = ok && camp.dmUid === user.uid;
  const base = ok ? `campaigns/${cid}` : null;
  const members = useCol(base && `${base}/members`);
  const chars = useCol(base && `${base}/characters`);
  const sessions = useCol(base && `${base}/sessions`);
  const quests = useCol(base && `${base}/quests`);
  const npcs = useCol(base && `${base}/npcs`);
  const journal = useCol(base && `${base}/journal`);
  const revAll = useCol(base && `${base}/revelations`, isDM ? [] : [['audience', '==', 'all']]);
  const revMine = useCol(base && !isDM ? `${base}/revelations` : null, [['audienceUids', 'array-contains', user.uid]]);
  const secrets = useCol(base && isDM ? `${base}/secrets` : null);
  const notes = useDoc(ok ? `users/${user.uid}/notes/${cid}` : null);
  const revelations = useMemo(() => { const m = new Map(); [...(revAll || []), ...(revMine || [])].forEach(r => m.set(r.id, r)); return [...m.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); }, [revAll, revMine]);
  return { camp, isDM, members: members || [], chars: (chars || []).map(c => withLook({ ...c, campaignId: cid }, camp)), sessions: (sessions || []).sort((a, b) => int(b.num) - int(a.num)),
    quests: (quests || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), npcs: (npcs || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    journal: journal || [], revelations, secrets: (secrets || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), notes };
}

/* ---------- page ---------- */
export function CampaignPage({ user, cid, tab }) {
  const d0 = useCampaign(cid, user);
  const [preview, setPreview] = usePreview(cid);
  const realDM = d0.isDM; const pv = realDM && preview;
  // In the preview the DM sees exactly what a player sees: no DM tools, no hidden secrets, only reveals meant for everyone.
  const d = pv ? { ...d0, isDM: false, secrets: [], revelations: d0.revelations.filter(r => r.audience === 'all') } : d0;
  const { camp, isDM } = d;
  const me = useDoc(`users/${user.uid}`);
  useEffect(() => { if (camp) applyTheme(camp.theme); }, [camp?.theme]);
  // older characters kept Armor Class on the public card: move it onto the private sheet
  const oldAc = realDM ? (d0.chars || []).filter(c => c.ac != null) : [];
  useEffect(() => { if (!oldAc.length) return;
    store.batch(oldAc.flatMap(c => [{ type: 'merge', path: `campaigns/${cid}/characters/${c.id}/sheet/main`, data: { ac: c.ac } }, { type: 'update', path: `campaigns/${cid}/characters/${c.id}`, data: { ac: null } }])).catch(() => {});
  }, [oldAc.map(c => c.id).join()]);
  if (camp === undefined) return html`<${Spinner}/>`;
  if (!camp) return html`<main class="page"><${Empty} title="Kampagne nicht gefunden" action=${html`<a class="btn" href="#/">Zur Startseite</a>`}>Entweder gibt es sie nicht mehr, oder du bist (noch) kein Mitglied. Tritt mit dem Code deines DMs bei.</${Empty}></main>`;
  const tabs = TABS.filter(([k]) => k !== 'einstellungen' || isDM);
  const t = tabs.some(([k]) => k === tab) ? tab : 'uebersicht';
  const myChar = d.chars.find(c => c.ownerUid === user.uid);
  const props = { ...d, user, cid, myChar, realDM, preview: pv, setPreview, isActive: me?.activeCampaign === cid };
  return html`<main class="page campaign">
    ${pv && html`<${PreviewBar} text="So sehen Spieler diese Kampagne. DM-Werkzeuge, vorbereitete Geheimnisse und deine Notizen sind ausgeblendet." onExit=${() => setPreview(false)}/>`}
    <${Hero} ...${props}/>
    <nav class="subnav" role="tablist" aria-label="Bereiche der Kampagne">${tabs.map(([k, l, e]) => html`<a role="tab" href=${href('c', cid, k)} aria-selected=${t === k}><span class="ico" aria-hidden="true">${e}</span><span class="tl">${l}</span>${k === 'enthuellungen' && d.revelations.length ? html`<span class="count">${d.revelations.length}</span>` : ''}</a>`)}</nav>
    <${{ uebersicht: Overview, gruppe: Party, sitzungen: Sessions, quests: Quests, npcs: Npcs, enthuellungen: Reveals, notizen: Notes, einstellungen: Settings }[t]} key=${t} ...${props}/>
    ${!isDM && !pv && html`<${RevealPopup} cid=${cid} items=${d.revelations}/>`}
  </main>`;
}

function Hero({ camp, isDM, realDM, preview, setPreview, sessions, chars, quests, cid, user, isActive }) {
  const active = chars.filter(c => (c.status || 'active') !== 'retired');
  const lv = active.map(c => c.level || 1); const avg = lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 0;
  const n = daysUntil(camp.nextDate); const next = n !== null && n >= 0;
  const aq = quests.filter(q => (q.status || 'active') === 'active').length;
  const setTheme = async e => { try { await store.update(`campaigns/${cid}`, { theme: e.target.value }); toast(`Theme: ${THEMES[e.target.value].name}`); } catch (x) { failed(x); } };
  return html`<section class="hero">
    <a class="link crumb" href="#/">← Alle Kampagnen</a>
    <div class="hero-top"><div class="hero-id">
      <div class="flag"><span class="label"><span class="ico" aria-hidden="true">🏰</span>Kampagne</span><${Pill} tone=${camp.status || 'active'}>${STATUS[camp.status || 'active']}</${Pill}>${isDM && html`<${Pill} tone="gild">DM-Ansicht</${Pill}>`}</div>
      <h1>${camp.name}</h1>${camp.description && html`<p class="lede">${camp.description}</p>`}
      <div class="hero-meta"><span>DM <b>${camp.dmName}</b></span>${camp.setting && html`<span>Setting <b>${camp.setting}</b></span>`}${camp.started && html`<span>Seit <b>${fmtDate(camp.started)}</b></span>`}</div>
      <div class="hero-help"><${TurnHelpButton} cls="btn small"/>${isActive ? html`<span class="pill gild">⭐ Aktive Kampagne</span>` : html`<button class="btn small" onClick=${async () => { try { await setActiveCampaign(user, cid); toast('Ist jetzt deine aktive Kampagne.'); } catch (x) { failed(x); } }}>⭐ Als aktive Kampagne festlegen</button>`}${isActive && html`<a class="btn small primary" href="#/spiel">🎲 Sitzung starten</a>`}</div></div>
      ${realDM && !preview && html`<div class="hero-tools"><label class="area-pick"><span class="label">Gebiet / Theme</span><select id="area" value=${camp.theme || 'standard'} onChange=${setTheme}>${Object.entries(THEMES).map(([k, t]) => html`<option value=${k}>${t.name}</option>`)}</select></label><button class="btn small" onClick=${() => setPreview(true)}>👀 Als Spieler ansehen</button></div>`}</div>
    <div class="metrics panel">
      <div class="metric"><span class="label"><span class="ico" aria-hidden="true">📖</span>Sitzungen</span><span class="v num">${sessions.length}</span><span class="s">${sessions.length ? 'gespielt' : 'noch keine'}</span></div>
      <div class="metric"><span class="label"><span class="ico" aria-hidden="true">⭐</span>Gruppenstufe</span><span class="v num">${lv.length ? (Number.isInteger(avg) ? avg : avg.toFixed(1)) : '–'}</span><span class="s">${plural(active.length, 'Held', 'Helden')}</span></div>
      <div class="metric"><span class="label"><span class="ico" aria-hidden="true">🗺️</span>Quests</span><span class="v num">${aq}</span><span class="s">laufen gerade</span></div>
      <div class="metric next"><span class="label"><span class="ico" aria-hidden="true">📅</span>Nächste Sitzung</span><span class="v">${next ? fmtDay(camp.nextDate) : 'Offen'}</span><span class="s">${next ? [camp.nextTime, relDays(n), camp.nextPlace].filter(Boolean).join(' · ') : isDM ? 'In den Einstellungen festlegen' : 'Der DM plant noch'}</span></div>
    </div></section>`;
}

/* ---------- overview ---------- */
function Overview(p) {
  const { sessions, chars, quests, npcs, revelations, isDM, myChar, cid, camp } = p;
  const last = sessions[0];
  return html`<div class="ov"><div class="ov-col">
    ${!p.preview && html`<${ZeroCard} cid=${cid} user=${p.user} isDM=${isDM} members=${p.members} chars=${chars}/>`}
    <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">📍</span>Wo wir aufgehört haben</h2>${last && html`<span class="sub">Sitzung ${last.num}${last.date ? ' · ' + fmtDate(last.date) : ''}</span>`}</div>
      ${last ? html`<p class="stopbig">${last.stop || 'Kein Haltepunkt notiert.'}</p>${last.recap && html`<div><span class="label"><span class="ico" aria-hidden="true">⏪</span>Letztes Mal</span><p class="muted">${last.recap}</p></div>`}
        <div class="actions"><a class="btn small" href=${href('c', cid, 'sitzungen')}>Alle Sitzungen</a></div>`
      : html`<p class="muted">Noch keine Sitzung eingetragen.${isDM ? ' Nach dem ersten Spieleabend trägst du hier ein, wo ihr stehen geblieben seid.' : ''}</p>`}</div>
    ${!isDM && !myChar && html`<div class="panel box cta"><h2><span class="ico" aria-hidden="true">🧙</span>Dein Charakter fehlt noch</h2><p class="muted">Erstelle deinen Helden für diese Kampagne. Dein DM schaut ihn sich danach an und gibt ihn frei.</p><div class="actions"><a class="btn primary" href=${href('c', cid, 'neu')}>Charakter erstellen</a><a class="btn" href="#/charaktere">Vorhandenen mitbringen</a></div></div>`}
    <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">👥</span>Die Gruppe</h2><a class="link" href=${href('c', cid, 'gruppe')}>Alle Karten</a></div>
      ${chars.length ? html`<div class="tablewrap"><table class="roster"><thead><tr><th>Charakter</th><th>Klasse</th><th>Hit Points</th><th class="r">AC</th><th>Zustände</th></tr></thead><tbody>
        ${chars.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => html`<tr onClick=${() => go('c', cid, 'char', c.id)}>
          <td><div class="who"><${Medal} cls=${c.cls} species=${c.species} look=${c.look} size="md"/><div><b>${c.name}</b><div class="sub">${c.ownerName || ''}</div></div></div></td>
          <td>${c.look ? c.look.cls : clsName(c)} ${c.level || 1}<div class="sub">${c.look ? c.look.species : c.species || ''}</div></td>
          <td class="hpcell"><span class="num">${c.hp ?? 0} / ${c.hpMax ?? 0}</span><${HpBar} hp=${c.hp || 0} max=${c.hpMax || 0}/></td>
          <td class="r num">${isDM || c.ownerUid === p.user.uid ? html`<${AcValue} c=${c} cid=${cid}/>` : html`<span class="muted" title="Nur für den Spieler und den DM sichtbar">–</span>`}</td>
          <td>${[...(c.conditions || []), c.exhaustion ? `Exhaustion ${c.exhaustion}` : ''].filter(Boolean).join(', ') || html`<span class="muted">–</span>`}</td></tr>`)}
      </tbody></table></div>` : html`<p class="muted">Noch keine Charaktere.</p>`}</div></div>
    <div class="ov-col">
      <${NextBox} camp=${camp} isDM=${isDM} cid=${cid}/>
      <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">🗺️</span>Laufende Quests</h2><a class="link" href=${href('c', cid, 'quests')}>Alle</a></div>
        ${quests.filter(q => (q.status || 'active') === 'active').slice(0, 5).map(q => html`<a class="mini" href=${href('c', cid, 'quests')}><div><div class="t">${q.title}</div><div class="d">${[q.giver && 'Von ' + q.giver, q.location].filter(Boolean).join(' · ')}</div></div>${q.reward && html`<span class="reward">${q.reward}</span>`}</a>`)}
        ${!quests.some(q => (q.status || 'active') === 'active') && html`<p class="muted">Keine offenen Quests.</p>`}</div>
      <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">🤯</span>Enthüllungen</h2><a class="link" href=${href('c', cid, 'enthuellungen')}>Alle</a></div>
        ${revelations.slice(0, 3).map(r => html`<a class="mini" href=${href('c', cid, 'enthuellungen')}><div><div class="t">${r.title}</div><div class="d">${KINDS[r.kind] || ''}</div></div></a>`)}
        ${!revelations.length && html`<p class="muted">Noch nichts enthüllt…</p>`}</div>
      <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">👋</span>Zuletzt getroffen</h2><a class="link" href=${href('c', cid, 'npcs')}>Alle NPCs</a></div>
        ${npcs.slice(0, 4).map(n => html`<a class="mini" href=${href('c', cid, 'npcs')}><span class=${'ava sm ' + (n.attitude || 'neutral') + (n.status === 'dead' ? ' dead' : '')}>${initials(n.name)}</span><div><div class="t">${n.name}</div><div class="d">${[n.role, n.location].filter(Boolean).join(' · ')}</div></div></a>`)}
        ${!npcs.length && html`<p class="muted">Noch niemand.</p>`}</div>
    </div></div>`;
}
function NextBox({ camp, isDM, cid }) {
  const n = daysUntil(camp.nextDate); const ok = n !== null && n >= 0;
  return html`<div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">📅</span>Nächste Sitzung</h2></div>
    ${ok ? html`<div class="next-big"><div class="cal"><span>${new Date(ts(camp.nextDate)).toLocaleDateString('de-DE', { month: 'short' })}</span><b class="num">${new Date(ts(camp.nextDate)).getDate()}</b></div>
      <div><div class="strong">${fmtDay(camp.nextDate)}${camp.nextTime ? ' · ' + camp.nextTime + ' Uhr' : ''}</div><div class="sub">${relDays(n)}${camp.nextPlace ? ' · ' + camp.nextPlace : ''}</div></div></div>`
    : html`<p class="muted">${isDM ? html`Noch kein Termin. <a class="link" href=${href('c', cid, 'einstellungen')}>Termin festlegen</a>` : 'Noch kein Termin.'}</p>`}</div>`;
}

/* ---------- party ---------- */
function Party({ chars, members, isDM, user, cid, camp, myChar }) {
  const addDummy = async () => { try { await createDummyCharacter(cid, chars); toast('Test-Mitspieler angelegt.'); } catch (x) { failed(x); } };
  const [leaving, setLeaving] = useState(false);
  return html`<section><div class="bar"><h2><span class="ico" aria-hidden="true">👥</span>Die Gruppe</h2><div class="actions">${isDM && html`<button class="btn" onClick=${addDummy} title="Ein Beispiel-Charakter, der einem erfundenen Mitspieler gehört">Test-Mitspieler anlegen</button>`}<a class="btn primary" href=${href('c', cid, 'neu')}>${isDM ? 'Charakter anlegen' : myChar ? 'Weiteren Charakter erstellen' : 'Charakter erstellen'}</a></div></div>
    ${chars.length ? html`<div class="grid cards">${chars.map(c => html`<${CharCard} c=${c}/>`)}</div>` : html`<${Empty} title="Noch keine Helden">${isDM ? 'Gib deinen Spielern den Beitrittscode. Sie erstellen ihre Charaktere dann selbst.' : 'Sei der Erste und erstelle deinen Charakter.'}</${Empty}>`}
    <p class="ro-note">Von anderen Charakteren siehst du Stufe und Hit Points. Den vollen Bogen sehen nur der Spieler selbst und der DM.</p>
    <div class="label group-label">Mitspieler</div>
    <div class="chips">${html`<span class="chip ic"><span class="ava xs">${initials(camp.dmName)}</span>${camp.dmName} (DM)</span>`}${members.map(m => html`<span class="chip ic"><span class="ava xs">${initials(m.name)}</span>${m.name}</span>`)}</div>
    ${!isDM && html`<div class="leave">${leaving ? html`<span class="confirm">Kampagne wirklich verlassen? Deine Charaktere bleiben beim DM. <button class="btn danger small" onClick=${async () => { try { await leaveCampaign(user, cid); go(); toast('Du hast die Kampagne verlassen.'); } catch (x) { failed(x); } }}>Verlassen</button><button class="btn small" onClick=${() => setLeaving(false)}>Bleiben</button></span>` : html`<button class="link quiet" onClick=${() => setLeaving(true)}>Kampagne verlassen</button>`}</div>`}
  </section>`;
}

/* ---------- sessions + journal ---------- */
function Sessions(p) {
  const { sessions, isDM, cid } = p;
  const [open, setOpen] = useState(null);
  const last = sessions[0];
  return html`<section>
    ${last && html`<div class="resume panel"><div class="when"><span class="label">Sitzung</span><b class="num">${last.num}</b></div><p><span class="label">Wo wir aufgehört haben</span><br/>${last.stop || last.title || '–'}</p></div>`}
    <div class="bar"><h2><span class="ico" aria-hidden="true">📖</span>Sitzungen</h2>${isDM && html`<button class="btn primary" onClick=${() => setOpen('new')}>Sitzung eintragen</button>`}</div>
    ${sessions.length ? html`<div class="sessions">${sessions.map(s => { const j = p.journal.filter(e => e.sessionId === s.id).length; const who = (s.present || []).map(id => p.chars.find(c => c.id === id)).filter(Boolean);
      return html`<article class="srow panel" role="button" tabindex="0" onClick=${() => setOpen(s.id)}>
        <div class="n num"><small>Sitzung</small>${s.num}</div>
        <div class="body"><h3>${s.title || 'Ohne Titel'}</h3><p>${s.recap || s.stop || ''}</p>${who.length ? html`<div class="chips">${who.map(c => html`<span class="chip ic"><${Medal} cls=${c.cls} species=${c.species} look=${c.look} size="sm"/>${c.name}</span>`)}</div>` : ''}</div>
        <div class="meta"><span>${fmtDate(s.date)}</span>${s.xp ? html`<span class="xp num">${int(s.xp).toLocaleString('de-DE')} XP</span>` : ''}${j ? html`<span>${plural(j, 'Tagebucheintrag', 'Tagebucheinträge')}</span>` : ''}</div></article>`; })}</div>`
    : html`<${Empty} title="Noch keine Sitzung">${isDM ? 'Trag nach jedem Spieleabend eine kurze Zusammenfassung ein, wo ihr aufgehört habt, Beute und XP.' : 'Nach dem ersten Spieleabend steht hier die Zusammenfassung. Du kannst dann dein eigenes Tagebuch dazu schreiben.'}</${Empty}>`}
    ${open && html`<${SessionModal} ...${p} sid=${open === 'new' ? null : open} onClose=${() => setOpen(null)}/>`}
  </section>`;
}

function SessionModal({ sid, sessions, chars, journal, isDM, cid, user, onClose }) {
  const isNew = !sid;
  const s0 = isNew ? { num: (sessions[0] ? int(sessions[0].num) : 0) + 1, date: isoToday(), present: chars.filter(c => c.status !== 'retired').map(c => c.id), xp: 0 } : sessions.find(x => x.id === sid);
  const [f, setF] = useState({ title: '', stop: '', recap: '', loot: '', ...s0 });
  const [busy, setBusy] = useState(false);
  if (!s0) return null;
  const set = k => e => setF(f => ({ ...f, [k]: e.target.value }));
  const save = async e => { e.preventDefault(); setBusy(true);
    const data = { num: int(f.num, 1), date: f.date, title: f.title.trim(), stop: f.stop, recap: f.recap, loot: f.loot, xp: int(f.xp, 0), present: f.present || [], xpApplied: !!s0.xpApplied, createdAt: s0.createdAt || Date.now() };
    try { await store.set(`campaigns/${cid}/sessions/${sid || newId()}`, data); toast(isNew ? `Sitzung ${data.num} eingetragen.` : 'Gespeichert.'); onClose(); } catch (x) { failed(x); } finally { setBusy(false); } };
  const applyXp = async () => {
    const amt = int(s0.xp, 0); const who = chars.filter(c => (s0.present || []).includes(c.id));
    try { await store.batch([...who.map(c => ({ type: 'update', path: `campaigns/${cid}/characters/${c.id}`, data: { xp: int(c.xp, 0) + amt, updatedAt: Date.now() } })), { type: 'update', path: `campaigns/${cid}/sessions/${sid}`, data: { xpApplied: true } }]);
      toast(`${amt.toLocaleString('de-DE')} XP an ${plural(who.length, 'Charakter', 'Charaktere')} verteilt.`); } catch (x) { failed(x); } };
  const entries = journal.filter(j => j.sessionId === sid).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return html`<${Modal} wide title=${isNew ? 'Neue Sitzung' : `Sitzung ${s0.num}${s0.title ? ': ' + s0.title : ''}`} eyebrow=${isNew ? 'Sitzung eintragen' : fmtDate(s0.date)} onClose=${onClose}>
    ${isDM ? html`<form class="form" onSubmit=${save}>
      <div class="g g3"><${Field} label="Nummer"><input id="s-num" type="number" min="1" value=${f.num} onInput=${set('num')}/></${Field}><${Field} label="Datum"><input id="s-date" type="date" value=${f.date} onInput=${set('date')}/></${Field}><${Field} label="Titel"><input id="s-title" value=${f.title} onInput=${set('title')} placeholder="Der Hinterhalt der Goblins"/></${Field}></div>
      <${Field} label="Wo wir aufgehört haben"><textarea id="s-stop" class="gild-edge" value=${f.stop} onInput=${set('stop')} placeholder="Der genaue Moment, an dem ihr pausiert habt. Steht nächstes Mal ganz oben."></textarea></${Field}>
      <${Field} label="Was passiert ist"><textarea id="s-recap" value=${f.recap} onInput=${set('recap')} placeholder="Kurze Zusammenfassung: Orte, Kämpfe, Entscheidungen"></textarea></${Field}>
      <div class="g g3"><${Field} label="Beute & Belohnungen"><textarea id="s-loot" value=${f.loot} onInput=${set('loot')}></textarea></${Field}><${Field} label="XP pro Charakter"><input id="s-xp" type="number" min="0" value=${f.xp} onInput=${set('xp')}/></${Field}></div>
      <div class="sec"><span class="label">Wer war dabei</span><div class="whoset">${chars.map(c => html`<label><input type="checkbox" checked=${(f.present || []).includes(c.id)} onChange=${e => setF(f => ({ ...f, present: e.target.checked ? [...(f.present || []), c.id] : (f.present || []).filter(x => x !== c.id) }))}/> ${c.name}</label>`)}</div></div>
      ${!isNew && int(s0.xp, 0) > 0 && (s0.xpApplied ? html`<p class="ro-note">Die XP dieser Sitzung wurden schon verteilt.</p>` : html`<div><button type="button" class="btn" onClick=${applyXp}>${int(s0.xp).toLocaleString('de-DE')} XP an alle Anwesenden verteilen</button></div>`)}
      <div class="foot"><button class="btn primary" disabled=${busy}>${isNew ? 'Eintragen' : 'Speichern'}</button><button type="button" class="btn" onClick=${onClose}>Abbrechen</button><span class="spacer"></span>
        ${!isNew && html`<${DeleteButton} question="Diese Sitzung löschen?" onConfirm=${async () => { try { await store.remove(`campaigns/${cid}/sessions/${sid}`); onClose(); toast('Sitzung gelöscht.'); } catch (x) { failed(x); } }}/>`}</div>
    </form>` : html`<div class="readout">
      ${s0.stop && html`<div><span class="label">Wo wir aufgehört haben</span><p class="stopbig">${s0.stop}</p></div>`}
      ${s0.recap && html`<div><span class="label">Was passiert ist</span><p>${s0.recap}</p></div>`}
      ${s0.loot && html`<div><span class="label">Beute & Belohnungen</span><p>${s0.loot}</p></div>`}
      ${s0.xp ? html`<div><span class="label">XP</span><p class="xp">${int(s0.xp).toLocaleString('de-DE')} pro Charakter</p></div>` : ''}</div>`}
    ${!isNew && html`<${Journal} entries=${entries} sid=${sid} cid=${cid} user=${user} chars=${chars} isDM=${isDM}/>`}
  </${Modal}>`;
}

function Journal({ entries, sid, cid, user, chars, isDM }) {
  const mine = chars.filter(c => c.ownerUid === user.uid);
  const [text, setText] = useState(''); const [ch, setCh] = useState(mine[0]?.id || ''); const [busy, setBusy] = useState(false);
  const add = async e => { e.preventDefault(); if (!text.trim()) return; setBusy(true); const c = chars.find(x => x.id === ch);
    try { await store.set(`campaigns/${cid}/journal/${newId()}`, { sessionId: sid, authorUid: user.uid, authorName: user.name, charId: c?.id || '', charName: c?.name || '', text: text.trim(), createdAt: Date.now() }); setText(''); toast('Tagebucheintrag gespeichert.'); }
    catch (x) { failed(x); } finally { setBusy(false); } };
  return html`<div class="journal"><h3 class="sec-h">Tagebuch der Gruppe</h3>
    ${entries.length ? entries.map(j => html`<article class="entry"><div class="entry-head"><b>${j.charName || j.authorName}</b><span class="sub">${j.charName ? 'von ' + j.authorName : ''}</span>
      ${(j.authorUid === user.uid || isDM) && html`<button class="link quiet small" onClick=${async () => { try { await store.remove(`campaigns/${cid}/journal/${j.id}`); } catch (x) { failed(x); } }}>Löschen</button>`}</div><p>${j.text}</p></article>`)
      : html`<p class="muted">Noch keine Einträge. Schreib auf, wie dein Charakter die Sitzung erlebt hat.</p>`}
    <form class="form" onSubmit=${add}>
      ${mine.length > 1 && html`<${Field} label="Als"><select id="j-char" value=${ch} onChange=${e => setCh(e.target.value)}>${mine.map(c => html`<option value=${c.id}>${c.name}</option>`)}</select></${Field}>`}
      <${Field} label=${mine.length ? `Eintrag${mine.length === 1 ? ' als ' + mine[0].name : ''}` : 'Eintrag'}><textarea id="j-text" value=${text} onInput=${e => setText(e.target.value)} placeholder="Heute haben wir…"></textarea></${Field}>
      <div><button class="btn" disabled=${busy || !text.trim()}>Eintrag hinzufügen</button></div></form></div>`;
}

/* ---------- quests ---------- */
function Quests({ quests, secrets, isDM, cid, members }) {
  const [open, setOpen] = useState(null); const [unlock, setUnlock] = useState(null);
  const hidden = isDM ? secrets.filter(s => s.kind === 'quest' && !s.revealedAt) : [];
  const toggle = async q => { try { await store.update(`campaigns/${cid}/quests/${q.id}`, { status: (q.status || 'active') === 'active' ? 'done' : 'active' }); } catch (x) { failed(x); } };
  return html`<section><div class="bar"><h2><span class="ico" aria-hidden="true">🗺️</span>Quest-Log</h2>${isDM && html`<button class="btn primary" onClick=${() => setOpen('new')}>Neue Quest</button>`}</div>
    ${!quests.length && !hidden.length ? html`<${Empty} title="Noch keine Quests">${isDM ? 'Halte fest, welche Aufträge und Rätsel die Gruppe verfolgt: wer sie vergeben hat, wohin sie führen, was sie einbringen. Quests, die erst später auftauchen sollen, kannst du versteckt vorbereiten.' : 'Der DM hat noch keine Quests eingetragen.'}</${Empty}>` : ''}
    ${hidden.length ? html`<div class="label group-label"><span class="ico" aria-hidden="true">🔒</span>Versteckt vorbereitet · ${hidden.length}</div>
      <p class="ro-note">Nur du siehst diese Quests. Mit „Freischalten“ landen sie bei allen im Quest-Log, mit einem Pop-up und dem Grund, warum sie jetzt auftauchen.</p>
      <div class="grid reveals">${hidden.map(s => html`<article class="rcard panel sealed"><span class="label">Versteckte Quest</span><h3>${s.title}</h3>${s.quest?.description && html`<p class="muted clamp">${s.quest.description}</p>`}
        <${Reason} label="Bedingung" text=${s.condition}/>
        <div class="actions"><button class="btn primary small" onClick=${() => setUnlock(s)}>Freischalten</button><button class="btn small" onClick=${() => setOpen('h:' + s.id)}>Bearbeiten</button></div></article>`)}</div>` : ''}
    ${Object.entries(QSTATUS).map(([k, l]) => { const g = quests.filter(q => (q.status || 'active') === k); return g.length ? html`<div class="label group-label">${l} · ${g.length}</div><div class="panel quests">${g.map(q => html`
      <div class=${'qrow' + (k === 'active' ? '' : ' done')} onClick=${() => setOpen(q.id)}>
        <button class=${'qmark ' + k} disabled=${!isDM} aria-label=${k === 'active' ? 'Als erledigt markieren' : 'Wieder öffnen'} onClick=${e => { e.stopPropagation(); toggle(q); }}>${k === 'done' ? '✓' : k === 'failed' ? '✕' : ''}</button>
        <div class="body"><h3>${q.title}</h3>${q.description && html`<p class="d">${q.description}</p>`}<div class="meta">${q.giver && html`<span>Von ${q.giver}</span>`}${q.location && html`<span>${q.location}</span>`}${q.unlockedBecause && html`<span class="unlocked">🔓 ${q.unlockedBecause}</span>`}</div></div>
        ${q.reward ? html`<span class="reward">${q.reward}</span>` : html`<span></span>`}</div>`)}</div>` : null; })}
    ${open && html`<${QuestModal} q=${open === 'new' || open.startsWith('h:') ? null : quests.find(x => x.id === open)} hq=${open.startsWith('h:') ? secrets.find(x => 'h:' + x.id === open) : null} isDM=${isDM} cid=${cid} onClose=${() => setOpen(null)}/>`}
    ${unlock && html`<${RevealModal} s=${unlock} cid=${cid} members=${members} onClose=${() => setUnlock(null)}/>`}
  </section>`;
}
// q: a quest the players can see; hq: a hidden quest, stored as a DM-only secret until unlocked.
function QuestModal({ q, hq, isDM, cid, onClose }) {
  const start = hq ? { ...(hq.quest || {}), title: hq.title, condition: hq.condition || '', hidden: true } : { ...(q || {}), hidden: false };
  const [f, setF] = useState({ title: '', status: 'active', giver: '', location: '', reward: '', description: '', notes: '', condition: '', ...start });
  const set = k => e => setF(f => ({ ...f, [k]: e.target.value }));
  const save = async e => { e.preventDefault(); if (!f.title.trim()) return toast('Gib der Quest einen Namen.');
    const d = { title: f.title.trim(), giver: f.giver.trim(), location: f.location.trim(), reward: f.reward.trim(), description: f.description, notes: f.notes };
    try {
      if (f.hidden) {
        const ops = [{ type: 'set', path: `campaigns/${cid}/secrets/${hq?.id || newId()}`, data: { kind: 'quest', title: d.title, body: d.description, condition: f.condition.trim(), quest: d, revealedAt: 0, createdAt: hq?.createdAt || Date.now() } }];
        if (q) ops.push({ type: 'delete', path: `campaigns/${cid}/quests/${q.id}` }); // a visible quest is hidden again
        await store.batch(ops); toast(q ? 'Quest versteckt. Die Spieler sehen sie nicht mehr.' : hq ? 'Gespeichert.' : 'Quest versteckt vorbereitet.');
      } else await store.set(`campaigns/${cid}/quests/${q?.id || newId()}`, { ...d, status: f.status, unlockedBecause: q?.unlockedBecause || '', unlockedAt: q?.unlockedAt || 0, createdAt: q?.createdAt || Date.now() }), toast(q ? 'Gespeichert.' : 'Quest hinzugefügt.');
      onClose(); } catch (x) { failed(x); } };
  return html`<${Modal} title=${f.title || 'Neue Quest'} eyebrow=${f.hidden ? 'Versteckte Quest' : 'Quest'} onClose=${onClose}><form class="form" onSubmit=${save}>
    ${isDM && html`<label class="checkline"><input type="checkbox" checked=${f.hidden} disabled=${!!hq} onChange=${e => setF(f => ({ ...f, hidden: e.target.checked }))}/>
      <span><b>Versteckt vorbereiten</b><span class="sub">${hq ? 'Schalte die Quest über „Freischalten“ im Quest-Log frei, sobald die Bedingung eintritt.' : 'Die Spieler sehen die Quest erst, wenn du sie freischaltest.'}</span></span></label>`}
    <fieldset disabled=${!isDM}>
    <div class="g g3"><${Field} label="Quest"><input id="q-title" value=${f.title} onInput=${set('title')} placeholder="Finde Gundren Rockseeker"/></${Field}>
      ${!f.hidden && html`<${Field} label="Status"><select id="q-status" value=${f.status} onChange=${set('status')}>${Object.entries(QSTATUS).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></${Field}>`}
      <${Field} label="Vergeben von"><input id="q-giver" value=${f.giver} onInput=${set('giver')}/></${Field}><${Field} label="Führt nach"><input id="q-loc" value=${f.location} onInput=${set('location')}/></${Field}>
      <${Field} label="Belohnung"><input id="q-reward" value=${f.reward} onInput=${set('reward')} placeholder="50 gp pro Person"/></${Field}></div>
    ${f.hidden && html`<${Field} label="Bedingung zum Freischalten"><input id="q-cond" value=${f.condition} onInput=${set('condition')} placeholder="Wenn die Gruppe den Goblin-Überfall überlebt"/></${Field}>
      <p class="ro-note">Beim Freischalten sehen die Spieler die Bedingung als Grund, warum die Quest auftaucht. Du kannst sie dann noch anpassen.</p>`}
    ${!f.hidden && q?.unlockedBecause && html`<${Reason} label="Freigeschaltet, weil" text=${q.unlockedBecause}/>`}
    <${Field} label="Was die Gruppe weiß"><textarea id="q-desc" value=${f.description} onInput=${set('description')}></textarea></${Field}>
    <${Field} label="Fortschritt"><textarea id="q-notes" value=${f.notes} onInput=${set('notes')}></textarea></${Field}></fieldset>
    ${isDM ? html`<div class="foot"><button class="btn primary">Speichern</button><button type="button" class="btn" onClick=${onClose}>Abbrechen</button><span class="spacer"></span>${(q || hq) && html`<${DeleteButton} question="Quest löschen?" onConfirm=${async () => { await store.remove(hq ? `campaigns/${cid}/secrets/${hq.id}` : `campaigns/${cid}/quests/${q.id}`); onClose(); }}/>`}</div>` : html`<p class="ro-note">Nur der DM kann Quests ändern.</p>`}
  </form></${Modal}>`;
}

/* ---------- npcs ---------- */
function Npcs({ npcs, isDM, cid, sessions, secrets = [], members = [] }) {
  const [meet, setMeet] = useState(null);
  const hidden = isDM ? secrets.filter(s => s.kind === 'npc' && !s.revealedAt) : [];
  const [open, setOpen] = useState(null); const [q, setQ] = useState(''); const [att, setAtt] = useState('all');
  const list = npcs.filter(n => (att === 'all' || (n.attitude || 'neutral') === att) && (!q || [n.name, n.role, n.location, n.notes].join(' ').toLowerCase().includes(q.toLowerCase())));
  return html`<section><div class="bar"><h2><span class="ico" aria-hidden="true">🎭</span>NPCs</h2>${isDM && html`<button class="btn primary" onClick=${() => setOpen('new')}>Neuer NPC</button>`}</div>
    ${!npcs.length ? html`<${Empty} title="Noch niemand getroffen">${isDM ? 'Halte fest, wen die Gruppe trifft: Rolle, Ort, Haltung zur Gruppe, lebendig oder nicht.' : 'Der DM hat noch keine NPCs eingetragen.'}</${Empty}>` : html`
    <div class="filters"><input id="npc-q" type="search" placeholder="Name, Rolle oder Ort suchen" value=${q} onInput=${e => setQ(e.target.value)}/>
      <div class="seg">${[['all', 'Alle'], ...Object.entries(ATT)].map(([k, l]) => html`<button aria-pressed=${att === k} onClick=${() => setAtt(k)}>${l}</button>`)}</div></div>
    ${list.length ? html`<div class="grid npcs">${list.map(n => html`<article class="npc panel" role="button" tabindex="0" onClick=${() => setOpen(n.id)}>
      <div class="head"><span class=${'ava ' + (n.attitude || 'neutral') + (n.status === 'dead' ? ' dead' : '')}>${initials(n.name)}</span><div class="who"><h3>${n.name}</h3><div class="sub">${[n.role, n.location].filter(Boolean).join(' · ')}</div></div></div>
      ${n.notes && html`<p class="notes">${n.notes}</p>`}
      <div class="foot2"><div class="chips"><${Pill} tone=${n.attitude || 'neutral'}>${ATT[n.attitude || 'neutral']}</${Pill}>${(n.status || 'alive') !== 'alive' && html`<${Pill} tone=${n.status}>${NSTAT[n.status]}</${Pill}>`}</div>${n.firstMet && html`<span>Seit Sitzung ${n.firstMet}</span>`}</div></article>`)}</div>` : html`<p class="muted">Niemand passt zur Suche.</p>`}`}
    ${hidden.length > 0 && html`<div class="panel box"><div class="box-head"><h2>🤫 Noch nicht getroffen · ${hidden.length}</h2><span class="sub">Nur du siehst sie</span></div>
      <ul class="seal-list">${hidden.map(s => html`<li><span><b>${s.title}</b><small>${[s.npc?.role, s.condition && 'wenn: ' + s.condition].filter(Boolean).join(' · ')}</small></span><button class="btn small" onClick=${() => setMeet(s)}>Vorstellen</button></li>`)}</ul></div>`}
    ${meet && html`<${MeetModal} s=${meet} cid=${cid} onClose=${() => setMeet(null)}/>`}
    ${open && html`<${NpcModal} n=${open === 'new' ? null : npcs.find(x => x.id === open)} isDM=${isDM} cid=${cid} next=${sessions[0]?.num || ''} onClose=${() => setOpen(null)}/>`}
  </section>`;
}
function NpcModal({ n, isDM, cid, next, onClose }) {
  const [f, setF] = useState({ name: '', role: '', location: '', attitude: 'neutral', status: 'alive', firstMet: next, notes: '', ...(n || {}) });
  const set = k => e => setF(f => ({ ...f, [k]: e.target.value }));
  const save = async e => { e.preventDefault(); if (!f.name.trim()) return toast('Gib dem NPC einen Namen.');
    try { await store.set(`campaigns/${cid}/npcs/${n?.id || newId()}`, { name: f.name.trim(), role: f.role.trim(), location: f.location.trim(), attitude: f.attitude, status: f.status, firstMet: String(f.firstMet || ''), notes: f.notes, createdAt: n?.createdAt || Date.now() }); toast(n ? 'Gespeichert.' : `${f.name} hinzugefügt.`); onClose(); } catch (x) { failed(x); } };
  return html`<${Modal} title=${f.name || 'Neuer NPC'} eyebrow="NPC" lead=${html`<span class=${'ava ' + f.attitude}>${initials(f.name)}</span>`} onClose=${onClose}><form class="form" onSubmit=${save}><fieldset disabled=${!isDM}>
    <div class="g g3"><${Field} label="Name"><input id="n-name" value=${f.name} onInput=${set('name')}/></${Field}><${Field} label="Wer ist das"><input id="n-role" value=${f.role} onInput=${set('role')} placeholder="Wirt"/></${Field}>
      <${Field} label="Wo zu finden"><input id="n-loc" value=${f.location} onInput=${set('location')}/></${Field}>
      <${Field} label="Haltung zur Gruppe"><select id="n-att" value=${f.attitude} onChange=${set('attitude')}>${Object.entries(ATT).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></${Field}>
      <${Field} label="Status"><select id="n-stat" value=${f.status} onChange=${set('status')}>${Object.entries(NSTAT).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></${Field}>
      <${Field} label="Zuerst getroffen (Sitzung)"><input id="n-first" type="number" min="1" value=${f.firstMet} onInput=${set('firstMet')}/></${Field}></div>
    <${Field} label="Was die Gruppe weiß"><textarea id="n-notes" value=${f.notes} onInput=${set('notes')} placeholder="Aussehen, Stimme, was sie wollen, was sie erzählt haben"></textarea></${Field}></fieldset>
    ${isDM ? html`<p class="ro-note">Alles hier sehen auch die Spieler. Geheimes gehört in die DM-Notizen oder in eine vorbereitete Enthüllung.</p><div class="foot"><button class="btn primary">Speichern</button><button type="button" class="btn" onClick=${onClose}>Abbrechen</button><span class="spacer"></span>${n && html`<${DeleteButton} question="NPC löschen?" onConfirm=${async () => { await store.remove(`campaigns/${cid}/npcs/${n.id}`); onClose(); }}/>`}</div>` : ''}
  </form></${Modal}>`;
}

/* ---------- reveals ---------- */
function Reveals({ revelations, secrets, isDM, cid, members }) {
  const [open, setOpen] = useState(null); const [reveal, setReveal] = useState(null);
  // Taking back an unlocked quest removes it from the quest log and hides it again.
  const delRev = async r => { try { await store.batch([{ type: 'delete', path: `campaigns/${cid}/revelations/${r.id}` },
      ...(r.questId ? [{ type: 'delete', path: `campaigns/${cid}/quests/${r.questId}` }] : []),
      ...(r.secretId && secrets.some(s => s.id === r.secretId) ? [{ type: 'update', path: `campaigns/${cid}/secrets/${r.secretId}`, data: { revealedAt: 0, questId: null } }] : [])]);
    toast(r.questId ? 'Zurückgenommen. Die Quest ist wieder versteckt.' : 'Enthüllung zurückgenommen.'); } catch (x) { failed(x); } };
  const sealed = secrets.filter(s => !s.revealedAt && s.kind !== 'quest' && s.kind !== 'npc'); // hidden quests are managed in the quest log
  return html`<section>
    ${isDM && html`<div class="bar"><h2><span class="ico" aria-hidden="true">🤫</span>Vorbereitete Geheimnisse</h2><button class="btn primary" onClick=${() => setOpen('new')}>Geheimnis vorbereiten</button></div>
      <p class="ro-note">Nur du siehst diese Karten. Mit „Enthüllen“ erscheinen sie auf den Bildschirmen der Spieler, für alle oder nur für ausgewählte. Versteckte Quests findest du im Quest-Log.</p>
      ${sealed.length ? html`<div class="grid reveals">${sealed.map(s => html`<article class="rcard panel sealed"><span class="label">${KINDS[s.kind] || 'Geheimnis'}</span><h3>${s.title}</h3><p class="muted clamp">${s.body}</p>
        <${Reason} label="Bedingung" text=${s.condition}/>
        <div class="actions"><button class="btn primary small" onClick=${() => setReveal(s)}>Enthüllen</button><button class="btn small" onClick=${() => setOpen(s.id)}>Bearbeiten</button></div></article>`)}</div>`
      : html`<${Empty}>Noch nichts vorbereitet. Schreib vor der Sitzung auf, was die Spieler später entdecken sollen: die wahre Identität eines NPCs, einen verfluchten Gegenstand, einen Brief.</${Empty}>`}`}
    <div class="bar"><h2>${isDM ? 'Bereits enthüllt' : 'Enthüllungen'}</h2></div>
    ${revelations.length ? html`<div class="grid reveals">${revelations.map(r => html`<article class="rcard panel"><span class="label">${KINDS[r.kind] || 'Geheimnis'} · ${new Date(r.createdAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span><h3>${r.title}</h3><p class="pre">${r.body}</p>
      <${Reason} label=${r.kind === 'quest' ? 'Freigeschaltet, weil' : 'Aufgedeckt, weil'} text=${r.reason}/>
      ${isDM && html`<div class="foot2"><span class="sub">${r.audience === 'all' ? 'Für alle' : 'Für ' + (r.audienceUids || []).map(u => members.find(m => m.uid === u)?.name || '?').join(', ')}</span><button class="link quiet small" onClick=${() => delRev(r)}>Zurücknehmen</button></div>`}</article>`)}</div>`
      : html`<p class="muted">${isDM ? 'Noch nichts enthüllt.' : 'Noch nichts enthüllt. Wenn der DM ein Geheimnis lüftet, erscheint es hier.'}</p>`}
    ${open && html`<${SecretModal} s=${open === 'new' ? null : secrets.find(x => x.id === open)} cid=${cid} onClose=${() => setOpen(null)}/>`}
    ${reveal && html`<${RevealModal} s=${reveal} cid=${cid} members=${members} onClose=${() => setReveal(null)}/>`}
  </section>`;
}
function SecretModal({ s, cid, onClose }) {
  const [f, setF] = useState({ title: '', kind: 'secret', body: '', condition: '', ...(s || {}) });
  const set = k => e => setF(f => ({ ...f, [k]: e.target.value }));
  const save = async e => { e.preventDefault(); if (!f.title.trim()) return toast('Gib dem Geheimnis einen Titel.');
    try { await store.set(`campaigns/${cid}/secrets/${s?.id || newId()}`, { title: f.title.trim(), kind: f.kind, body: f.body, condition: f.condition.trim(), revealedAt: s?.revealedAt || 0, createdAt: s?.createdAt || Date.now() }); onClose(); toast('Geheimnis gespeichert.'); } catch (x) { failed(x); } };
  return html`<${Modal} title=${f.title || 'Neues Geheimnis'} eyebrow="Nur für dich, bis du es enthüllst" onClose=${onClose}><form class="form" onSubmit=${save}>
    <div class="g g3"><${Field} label="Titel (sehen die Spieler)"><input id="sec-title" value=${f.title} onInput=${set('title')} placeholder="Der Wirt ist ein Doppelgänger"/></${Field}>
      <${Field} label="Art"><select id="sec-kind" value=${f.kind} onChange=${set('kind')}>${SECRET_KINDS.map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></${Field}></div>
    <${Field} label="Text der Enthüllung"><textarea id="sec-body" class="tall" value=${f.body} onInput=${set('body')} placeholder="Was die Spieler lesen, wenn du es enthüllst."></textarea></${Field}>
    <${Field} label="Bedingung zum Aufdecken"><input id="sec-cond" value=${f.condition} onInput=${set('condition')} placeholder="Wenn die Gruppe die Goblins durchsucht"/></${Field}>
    <p class="ro-note">Beim Enthüllen sehen die Spieler die Bedingung als Grund, warum das jetzt herauskommt. Du kannst sie dann noch anpassen.</p>
    <div class="foot"><button class="btn primary">Speichern</button><button type="button" class="btn" onClick=${onClose}>Abbrechen</button><span class="spacer"></span>${s && html`<${DeleteButton} question="Geheimnis löschen?" onConfirm=${async () => { await store.remove(`campaigns/${cid}/secrets/${s.id}`); onClose(); }}/>`}</div>
  </form></${Modal}>`;
}
export function RevealModal({ s, cid, members, onClose }) {
  if (s.kind === 'npc') return html`<${MeetModal} s=${s} cid=${cid} onClose=${onClose}/>`;
  const isQ = s.kind === 'quest'; // a hidden quest goes to everyone's quest log, so it is always for all players
  const [who, setWho] = useState('all'); const [sel, setSel] = useState([]); const [busy, setBusy] = useState(false); const [reason, setReason] = useState(s.condition || '');
  const go2 = async () => { if (!isQ && who === 'some' && !sel.length) return toast('Wähle mindestens einen Spieler.'); setBusy(true);
    try { const now = Date.now(), r = reason.trim(), aud = isQ ? 'all' : who, questId = isQ ? newId() : null;
      await store.batch([
        ...(isQ ? [{ type: 'set', path: `campaigns/${cid}/quests/${questId}`, data: { giver: '', location: '', reward: '', description: '', notes: '', ...(s.quest || {}), title: s.title, status: 'active', unlockedBecause: r, unlockedAt: now, createdAt: now } }] : []),
        { type: 'set', path: `campaigns/${cid}/revelations/${newId()}`, data: { title: s.title, kind: s.kind, body: isQ ? (s.quest?.description || '') : s.body, reason: r, audience: aud, audienceUids: aud === 'some' ? sel : [], secretId: s.id, questId, createdAt: now } },
        { type: 'update', path: `campaigns/${cid}/secrets/${s.id}`, data: { revealedAt: now, questId } }]);
      toast(isQ ? 'Quest freigeschaltet!' : 'Enthüllt!'); onClose(); } catch (x) { failed(x); } finally { setBusy(false); } };
  return html`<${Modal} title=${s.title} eyebrow=${isQ ? 'Quest freischalten' : 'Enthüllen'} onClose=${onClose}><div class="form">
    ${!isQ && html`<div class="seg big"><button aria-pressed=${who === 'all'} onClick=${() => setWho('all')}>Für alle</button><button aria-pressed=${who === 'some'} onClick=${() => setWho('some')}>Nur für bestimmte Spieler</button></div>
    ${who === 'some' && html`<div class="whoset">${members.map(m => html`<label><input type="checkbox" checked=${sel.includes(m.uid)} onChange=${e => setSel(e.target.checked ? [...sel, m.uid] : sel.filter(x => x !== m.uid))}/> ${m.name}</label>`)}${!members.length && html`<p class="muted">Noch keine Spieler beigetreten.</p>`}</div>`}`}
    <${Field} label=${isQ ? 'Warum taucht die Quest jetzt auf? (sehen die Spieler)' : 'Warum kommt das jetzt heraus? (sehen die Spieler)'}><input id="rev-reason" value=${reason} onInput=${e => setReason(e.target.value)} placeholder="Ihr habt den Brief beim Goblin gefunden"/></${Field}>
    <p class="ro-note">${isQ ? 'Die Quest erscheint sofort bei allen im Quest-Log, dazu ein Pop-up mit dem Grund.' : 'Die Karte erscheint sofort als Pop-up auf den Bildschirmen und bleibt danach unter „Enthüllungen“, zusammen mit dem Grund.'}</p>
    <div class="foot"><button class="btn primary" disabled=${busy} onClick=${go2}>${isQ ? 'Jetzt freischalten' : 'Jetzt enthüllen'}</button><button class="btn" onClick=${onClose}>Abbrechen</button></div></div></${Modal}>`;
}
export function RevealPopup({ cid, items }) {
  const KEY = 'dndm-seen-' + cid;
  // First visit: everything revealed before now counts as seen; only new reveals pop up.
  const [seen, setSeen] = useState(() => { let v = 0; try { v = int(localStorage.getItem(KEY), 0); if (!v) { v = Date.now(); localStorage.setItem(KEY, v); } } catch (e) { v = Date.now(); } return v; });
  const fresh = items.filter(r => (r.createdAt || 0) > seen).sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!fresh) return null;
  const done = () => { setSeen(fresh.createdAt); try { localStorage.setItem(KEY, fresh.createdAt); } catch (e) {} };
  return html`<div class="scrim reveal-scrim" onClick=${done}></div><div class="reveal-pop" role="dialog" aria-modal="true" aria-label="Enthüllung">
    <span class="label">${fresh.kind === 'quest' ? 'Neue Quest' : `${KINDS[fresh.kind] || 'Geheimnis'} enthüllt`}</span><h2>${fresh.title}</h2><p class="pre">${fresh.body}</p>
    <${Reason} label=${fresh.kind === 'quest' ? 'Freigeschaltet, weil' : 'Aufgedeckt, weil'} text=${fresh.reason}/>
    <button class="btn primary" onClick=${done}>Weiter</button></div>`;
}

// a hidden NPC: meeting them puts them into the NPC list everyone sees
function MeetModal({ s, cid, onClose }) {
  const [busy, setBusy] = useState(false); const n = s.npc || {};
  const meet = async () => { setBusy(true);
    try { const now = Date.now(), last = await store.getCol(`campaigns/${cid}/sessions`).catch(() => []);
      const num = String(Math.max(0, ...last.map(x => int(x.num, 0))) + 1);
      await store.batch([{ type: 'set', path: `campaigns/${cid}/npcs/${newId()}`, data: { name: s.title, role: n.role || '', location: n.location || '', attitude: n.attitude || 'neutral', status: 'alive', firstMet: num, notes: n.notes || s.body || '', createdAt: now } },
        { type: 'update', path: `campaigns/${cid}/secrets/${s.id}`, data: { revealedAt: now } }]);
      toast(`${s.title} steht jetzt in der NPC-Liste.`); onClose(); } catch (x) { failed(x); } finally { setBusy(false); } };
  return html`<${Modal} title=${s.title} eyebrow="NPC vorstellen" onClose=${onClose}><div class="form">
    <p>${[n.role, n.location].filter(Boolean).join(' · ')}</p>${(n.notes || s.body) && html`<p class="muted pre">${n.notes || s.body}</p>`}
    <p class="ro-note">Die Gruppe trifft diese Figur gerade. Sie erscheint mit diesem Text in der NPC-Liste aller Spieler.</p>
    <div class="foot"><button class="btn primary" disabled=${busy} onClick=${meet}>Jetzt vorstellen</button><button class="btn" onClick=${onClose}>Abbrechen</button></div></div></${Modal}>`;
}

/* ---------- notes ---------- */
function Notes({ notes, isDM, cid, user, preview }) {
  if (preview) return html`<section><div class="bar"><h2><span class="ico" aria-hidden="true">📝</span>Meine Notizen</h2></div><${Empty}>Hier schreiben Spieler private Notizen, die nur sie selbst sehen. In der Vorschau ausgeblendet.</${Empty}></section>`;
  const [f, setF] = useState(null);
  const cur = f || { text: '', secrets: '', prep: '', ideas: '', ...(notes || {}) };
  const set = k => e => setF({ ...cur, [k]: e.target.value });
  const save = async e => { e.preventDefault(); const { id, ...data } = cur; try { await store.set(`users/${user.uid}/notes/${cid}`, { ...data, updatedAt: Date.now() }); setF(null); toast('Notizen gespeichert.'); } catch (x) { failed(x); } };
  if (notes === undefined) return html`<${Spinner}/>`;
  return html`<section><div class="bar"><h2>${isDM ? 'DM-Notizen' : 'Meine Notizen'}</h2></div>
    <form class="panel box notesbox" onSubmit=${save}>
      <div class="lockline">Privat für dein Konto. Niemand sonst kann diese Notizen lesen${isDM ? ', auch keine Spieler' : ', auch nicht der DM'}.</div>
      ${isDM ? html`<${Field} label="Geheimnisse & das große Ganze"><textarea id="dm-secrets" value=${cur.secrets} onInput=${set('secrets')} placeholder="Was wirklich vor sich geht: der Plan des Bösewichts, versteckte Motive"></textarea></${Field}>
        <${Field} label="Vorbereitung nächste Sitzung"><textarea id="dm-prep" value=${cur.prep} onInput=${set('prep')} placeholder="Begegnungen, NPC-Stimmen, Karten, Beute"></textarea></${Field}>
        <${Field} label="Ideen & Aufhänger"><textarea id="dm-ideas" value=${cur.ideas} onInput=${set('ideas')} placeholder="Lose Ideen, Hintergründe der Spieler, die später wichtig werden"></textarea></${Field}>`
      : html`<${Field} label="Notizen"><textarea id="my-notes" class="tall" value=${cur.text} onInput=${set('text')} placeholder="Verdachtsmomente, Namen, Pläne deines Charakters…"></textarea></${Field}>`}
      <div class="foot"><button class="btn primary" disabled=${!f}>Speichern</button>${notes?.updatedAt && html`<span class="sub">Zuletzt gespeichert ${new Date(notes.updatedAt).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>`}${f && html`<span class="sub">Ungespeicherte Änderungen</span>`}</div>
    </form></section>`;
}

/* ---------- settings (DM) ---------- */
function Settings(p) {
  const { camp, cid, user, members, chars } = p;
  const [cond, setCond] = useState({ name: '', desc: '' });
  const [busyExp, setBusyExp] = useState(false);
  const custom = camp.customConditions || [];
  const saveCamp = async data => { await store.update(`campaigns/${cid}`, data); if (data.name !== camp.name && camp.joinCode) await store.update(`joinCodes/${camp.joinCode}`, { campaignName: data.name }).catch(() => {}); toast('Gespeichert.'); };
  const addCond = async e => { e.preventDefault(); if (!cond.name.trim()) return; try { await store.update(`campaigns/${cid}`, { customConditions: [...custom, { name: cond.name.trim(), desc: cond.desc.trim() }] }); setCond({ name: '', desc: '' }); } catch (x) { failed(x); } };
  const delCond = async i => { try { await store.update(`campaigns/${cid}`, { customConditions: custom.filter((_, j) => j !== i) }); } catch (x) { failed(x); } };
  const copy = async () => { try { await navigator.clipboard.writeText(camp.joinCode); toast('Code kopiert.'); } catch (e) { toast('Code: ' + camp.joinCode); } };
  const kick = async m => { try { await store.remove(`campaigns/${cid}/members/${m.uid}`); toast(`${m.name} entfernt.`); } catch (x) { failed(x); } };
  const deleteAll = async () => {
    const base = `campaigns/${cid}`; const ops = [];
    for (const k of ['map', 'log', 'loot', 'zero']) for (const m of await store.getCol(`${base}/${k}`).catch(() => [])) ops.push({ type: 'delete', path: `${base}/${k}/${m.id}` });
    for (const c of chars) { ops.push({ type: 'delete', path: `${base}/characters/${c.id}/sheet/main` }, { type: 'delete', path: `${base}/characters/${c.id}` }); }
    for (const [k, list] of [['sessions', p.sessions], ['quests', p.quests], ['npcs', p.npcs], ['journal', p.journal], ['secrets', p.secrets], ['revelations', p.revelations], ['members', members.map(m => ({ id: m.uid }))]]) for (const x of list) ops.push({ type: 'delete', path: `${base}/${k}/${x.id}` });
    try { for (let i = 0; i < ops.length; i += 400) await store.batch(ops.slice(i, i + 400));
      await store.batch([{ type: 'delete', path: `joinCodes/${camp.joinCode}` }, { type: 'delete', path: base }, { type: 'delete', path: `users/${user.uid}/notes/${cid}` }, { type: 'delete', path: `users/${user.uid}/notes/${cid}__scenes` }, { type: 'delete', path: worldPath(user.uid, cid) }]);
      go(); toast('Kampagne gelöscht.'); } catch (x) { failed(x); } };
  return html`<section class="settings">
    <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">🔑</span>Beitrittscode</h2></div>
      <div class="codebox"><span class="code num">${camp.joinCode}</span><button class="btn" onClick=${copy}>Kopieren</button><button class="btn" onClick=${async () => { try { await newJoinCode(camp); toast('Neuer Code erstellt. Der alte gilt nicht mehr.'); } catch (x) { failed(x); } }}>Neuen Code erstellen</button></div>
      <p class="ro-note">Schick den Code deinen Spielern. Sie melden sich an, tippen „Mit Code beitreten“ und erstellen ihren Charakter.</p>
      <div class="label">Mitspieler · ${members.length}</div>
      ${members.length ? html`<div class="mini-list">${members.map(m => html`<div class="mini static"><span class="ava sm">${initials(m.name)}</span><div><div class="t">${m.name}</div><div class="d">${chars.filter(c => c.ownerUid === m.uid).map(c => c.name).join(', ') || 'Noch kein Charakter'}</div></div><${DeleteButton} label="Entfernen" question=${`${m.name} entfernen?`} onConfirm=${() => kick(m)}/></div>`)}</div>` : html`<p class="muted">Noch niemand beigetreten.</p>`}</div>
    <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">🌀</span>Eigene Zustände</h2></div>
      <p class="ro-note">Zusätzlich zu den offiziellen Conditions. Du kannst sie Charakteren im Bogen zuweisen.</p>
      ${custom.map((c, i) => html`<div class="mini static"><div><div class="t">${c.name}</div><div class="d">${c.desc}</div></div><button class="link quiet small" onClick=${() => delCond(i)}>Entfernen</button></div>`)}
      <form class="form inline-form cond-form" onSubmit=${addCond}><${Field} label="Name"><input id="cc-name" value=${cond.name} onInput=${e => setCond({ ...cond, name: e.target.value })} placeholder="Verflucht"/></${Field}><${Field} label="Wirkung"><input id="cc-desc" value=${cond.desc} onInput=${e => setCond({ ...cond, desc: e.target.value })} placeholder="−1 auf alle Saving Throws bis zum Long Rest"/></${Field}><button class="btn">Hinzufügen</button></form></div>
    <${WorldBox} camp=${camp} cid=${cid} user=${user} chars=${chars} members=${members}/>
    <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">✏️</span>Kampagne bearbeiten</h2></div><${CampaignForm} user=${user} campaign=${camp} onSave=${saveCamp}/></div>
    <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">💾</span>Sicherung</h2></div>
      <p class="ro-note">Lädt die ganze Kampagne als Datei herunter: Charaktere mit Bögen, Sitzungen, Tagebuch, Quests, NPCs, Geheimnisse, Enthüllungen und deine DM-Notizen. Mach das alle paar Sitzungen. Wiederherstellen geht auf der Startseite unter „Neue Kampagne“.</p>
      <div><button class="btn" disabled=${busyExp} onClick=${async () => { setBusyExp(true); try { const n = await exportCampaign(cid, user); toast('Gespeichert: ' + n); } catch (x) { failed(x); } finally { setBusyExp(false); } }}>${busyExp ? 'Wird gespeichert …' : 'Sicherung herunterladen'}</button></div></div>
    <div class="panel box"><div class="box-head"><h2><span class="ico" aria-hidden="true">📦</span>Vorbereitung importieren</h2></div>
      <p class="ro-note">Lädt vorbereitetes Material aus einer Datei in diese Kampagne: Karten-Szenen, Orte fürs Tablet, Beute, Enthüllungen, versteckte Quests und NPCs, DM-Notizen. Alles bleibt versteckt, bis du es am Spieltisch zeigst. Doppelt importieren schadet nicht.</p>
      <div><label class="btn">📦 Datei auswählen<input type="file" accept=".json,application/json" hidden onChange=${async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
        try { const n = await importPrep(user, cid, f); toast(`Importiert: ${n.scenes} Szenen, ${n.places} Orte, ${n.loot} Beute, ${n.secrets} Geheimnisse, Quests und NPCs${n.world ? `, Welt „${n.world}“` : ''}${n.updated ? '. Ablaufplan auf die neue Version aktualisiert' : ''}.`); } catch (x) { x.friendly ? toast(x.message) : failed(x); } }}/></label></div></div>
    <div class="panel box danger-zone"><div class="box-head"><h2><span class="ico" aria-hidden="true">🗑️</span>Kampagne löschen</h2></div><p class="muted">Löscht die Kampagne mit allen Charakteren, Sitzungen, Quests, NPCs und Enthüllungen. Das lässt sich nicht rückgängig machen.</p>
      <div><${DeleteButton} label="Kampagne löschen" question=${`${camp.name} endgültig löschen?`} onConfirm=${deleteAll}/></div></div>
  </section>`;
}
