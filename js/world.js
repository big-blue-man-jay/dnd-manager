// World translation. Players build ordinary characters with the rules from the Player's Handbook. The DM keeps a
// world file that says what each species, class and background is called in the campaign's true setting.
// Until the DM reveals it, the file lives only in the DM's private notes, so nobody can peek. After the reveal,
// every card, sheet, table view and map token shows the world's names. Rules and numbers stay the same.
import { html, useState, useDoc, Modal, Field, DeleteButton, Pill, Medal, toast, failed } from './ui.js';
import { store, newId } from './data.js';

const fail = msg => Object.assign(new Error(msg), { friendly: true });
const str = v => (typeof v === 'string' ? v.trim() : '');
const clsOf = c => (c.cls === 'Homebrew' ? c.clsCustom || 'Homebrew' : c.cls);
export const worldPath = (uid, cid) => `users/${uid}/notes/${cid}__world`;

// the world everyone sees, or null while nothing is revealed
export const worldOf = camp => (camp?.worldRevealed && camp.world) || null;

// One character's names in a world. Per-character changes by the DM win over the file's defaults.
export function lookIn(w, c, bg = '') {
  if (!w || !c) return null;
  const o = w.chars?.[c.id] || {}, sp = w.species?.[c.species] || {}, cl = w.classes?.[c.cls] || {};
  const b = (bg && w.backgrounds?.[bg]) || {};
  const picked = o.species && Object.values(w.species || {}).find(x => x.name === o.species);
  return { species: o.species || sp.name || c.species || '', cls: o.cls || cl.name || clsOf(c), bg: o.bg || b.name || bg || '',
    emoji: (picked ? picked.emoji : sp.emoji) || '', clsEmoji: cl.emoji || '' };
}
// c.look is set by useCampaign; pass bg (from the sheet) when the background matters
export function lookOf(c, camp, bg) {
  if (!c) return null;
  if (bg === undefined && c.look !== undefined) return c.look;
  return lookIn(worldOf(camp), c, bg || '');
}
// Not enumerable, so it never ends up in a save or a copy of the character.
export function withLook(c, camp) {
  Object.defineProperty(c, 'look', { value: lookIn(worldOf(camp), c), enumerable: false, configurable: true });
  return c;
}
// A weapon, armour or item in the world's words ("Chain Mail + Shield" is translated part by part); '' when unknown
export function itemIn(w, name) {
  const map = w?.weapons; if (!map || !name) return '';
  const one = n => { const k = Object.keys(map).find(x => x.toLowerCase() === n.trim().toLowerCase()); return k ? map[k].name : ''; };
  const direct = one(name); if (direct) return direct;
  if (!name.includes(' + ')) return '';
  const parts = name.split(' + '), out = parts.map(p => one(p) || p.trim());
  return out.some((p, i) => p !== parts[i].trim()) ? out.join(' + ') : '';
}
export const itemName = (camp, name) => itemIn(worldOf(camp), name);
// rules words the world renames, e.g. spellSlots, hitDice, shortRest, gp
export const term = (camp, key, fallback) => worldOf(camp)?.terms?.[key] || fallback;
const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];
export const coinsOf = camp => worldOf(camp)?.coins || COINS;

// "Human Warlock (Fiend Patron)", or the world's names once revealed
export const kindLine = (c, look, sub = true) => [look ? look.species : c.species, look ? look.cls : clsOf(c), sub && c.subclass && `(${c.subclass})`].filter(Boolean).join(' ');

/* ---------- the world file ---------- */
function entries(map) {
  const out = {};
  for (const [k, v] of Object.entries(map && typeof map === 'object' ? map : {})) {
    const e = typeof v === 'string' ? { name: v } : v || {};
    const name = str(e.name); if (!name) continue;
    out[k] = { name };
    for (const f of ['emoji', 'home', 'note']) if (str(e[f])) out[k][f] = str(e[f]);
  }
  return out;
}
const TERMS = ['spellSlots', 'spellSlot', 'pactSlots', 'hitDice', 'hitDie', 'shortRest', 'longRest', 'gp'];
export function cleanWorld(w) {
  const name = str(w?.name);
  if (!name) throw fail('Die Welt-Datei braucht einen Namen.');
  const terms = Object.fromEntries(TERMS.filter(k => str(w.terms?.[k])).map(k => [k, str(w.terms[k])]));
  const coins = Array.isArray(w.coins) ? w.coins.filter(c => COINS.includes(c)) : [];
  return { id: str(w.id) || name.toLowerCase(), name, setting: str(w.setting), revealTitle: str(w.revealTitle), intro: str(w.intro),
    species: entries(w.species), classes: entries(w.classes), backgrounds: entries(w.backgrounds), weapons: entries(w.weapons), terms,
    ...(coins.length ? { coins } : {}) };
}
// a world file ({ type: 'dndm-world', … }) or a prep pack with a "world" inside
export async function readWorldFile(file) {
  let d; try { d = JSON.parse(await file.text()); } catch (e) { d = null; }
  const w = d?.type === 'dndm-world' ? d : d?.type === 'dndm-prep' && d.world ? d.world : null;
  if (!w) throw fail('Das ist keine Welt-Datei für den DnD Manager.');
  return cleanWorld(w);
}

/* ---------- DM box in the campaign settings ---------- */
const names = map => [...new Set(Object.values(map || {}).map(x => x.name))];

export function WorldBox({ camp, cid, user, chars, members = [] }) {
  const priv = useDoc(worldPath(user.uid, cid));
  const [busy, setBusy] = useState(false); const [reveal, setReveal] = useState(false); const [edit, setEdit] = useState(null);
  const on = !!camp.worldRevealed, w0 = priv?.world || null;
  // after the reveal the campaign holds the live copy, including changes made since
  const w = w0 && { ...w0, chars: (on ? camp.world?.chars : priv.chars) || {} };
  const list = chars.filter(c => (c.status || 'active') !== 'retired');

  const load = async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true);
    try { const world = await readWorldFile(f), keep = w?.chars || {};
      await store.batch([{ type: 'set', path: worldPath(user.uid, cid), data: { world, chars: keep, updatedAt: Date.now() } },
        ...(on ? [{ type: 'update', path: `campaigns/${cid}`, data: { world: { ...world, chars: keep } } }] : [])]);
      toast(`Welt „${world.name}“ geladen.${on ? ' Alle sehen die neuen Namen.' : ' Nur du siehst sie, bis du sie enthüllst.'}`);
    } catch (x) { x.friendly ? toast(x.message) : failed(x); } finally { setBusy(false); } };
  const undo = async () => { setBusy(true);
    try { await store.batch([{ type: 'update', path: `campaigns/${cid}`, data: { world: null, worldRevealed: false, worldRevealedAt: 0, worldRevelationId: null,
          ...(camp.worldPrevSetting != null ? { setting: camp.worldPrevSetting, worldPrevSetting: null } : {}) } },
        ...(camp.worldRevelationId ? [{ type: 'delete', path: `campaigns/${cid}/revelations/${camp.worldRevelationId}` }] : [])]);
      toast('Zurückgenommen. Alle sehen wieder die normalen Namen.'); } catch (x) { failed(x); } finally { setBusy(false); } };
  const remove = async () => { try { await store.remove(worldPath(user.uid, cid)); toast('Welt-Datei entfernt.'); } catch (x) { failed(x); } };
  const pick = label => html`<label class=${'btn' + (busy ? ' disabled' : '')}>${label}<input type="file" accept=".json,application/json" hidden disabled=${busy} onChange=${load}/></label>`;

  return html`<div class="panel box world-box"><div class="box-head"><h2><span class="ico" aria-hidden="true">🎭</span>Welt-Übersetzung</h2>
      ${w && html`<${Pill} tone=${on ? 'active' : 'gild'}>${on ? 'Enthüllt' : 'Geheim vorbereitet'}</${Pill}>`}</div>
    ${priv === undefined ? html`<p class="muted">Lädt…</p>` : !w ? html`
      <p class="ro-note">Deine Spieler bauen ganz normale Charaktere. Eine Welt-Datei sagt, wie jede Species, Klasse und jeder Background in der wahren Welt eurer Kampagne heißt. Bis du auf „Welt enthüllen“ tippst, liegt sie nur in deinen privaten Notizen. Danach sehen alle die neuen Namen: auf den Karten, im Bogen, am Spieltisch, auf dem Tablet und auf der Karte. Regeln und Werte bleiben gleich.</p>
      <div>${pick('🗺️ Welt-Datei laden')}</div>` : html`
      <p class="world-name"><b>${w.name}</b><span class="muted"> · ${on ? `enthüllt am ${new Date(camp.worldRevealedAt || Date.now()).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'nur du siehst diese Übersetzung'}</span></p>
      ${list.length ? html`<div class="tablewrap"><table class="roster world-table"><thead><tr><th>Charakter</th><th>Bisher</th><th>In ${w.name}</th><th></th></tr></thead><tbody>
          ${list.map(c => html`<${WorldRow} key=${c.id} c=${c} cid=${cid} w=${w} onEdit=${() => setEdit(c)}/>`)}</tbody></table></div>`
        : html`<p class="muted">Noch keine Charaktere. Sobald deine Spieler ihre Helden gebaut haben, siehst du hier, wer sie in ${w.name} sind.</p>`}
      <p class="ro-note">${on ? 'Alle sehen jetzt diese Namen. Änderungen pro Charakter wirken sofort.'
        : members.length ? `Tippe auf einen Charakter, um ihm einen anderen Namen zu geben als die Datei vorschlägt. Beim Enthüllen bekommen alle ein Pop-up mit ihrer neuen Identität${w.setting ? `, und das Setting der Kampagne wird zu „${w.setting}“` : ''}.`
        : `Noch ist niemand beigetreten. Schalte die Welt ruhig gleich ein: Dann legst du Charaktere direkt mit den Namen aus ${w.name} an, und deine Spieler sehen sie erst, wenn sie mit dem Code beitreten.`}</p>
      <div class="actions">${on ? html`<button class="btn" disabled=${busy} onClick=${undo}>Enthüllung zurücknehmen</button>`
          : html`<button class="btn primary" disabled=${busy} onClick=${() => setReveal(true)}>${members.length ? '🎭 Welt enthüllen' : '🎭 Welt einschalten'}</button>`}
        ${pick('Andere Datei laden')}
        ${!on && html`<span class="spacer"></span><${DeleteButton} label="Entfernen" question="Welt-Datei entfernen?" onConfirm=${remove}/>`}</div>`}
    ${reveal && html`<${RevealWorld} camp=${camp} cid=${cid} w=${w} chars=${list} members=${members} onClose=${() => setReveal(false)}/>`}
    ${edit && html`<${CharWorldModal} c=${edit} cid=${cid} user=${user} camp=${camp} w=${w} onClose=${() => setEdit(null)}/>`}
  </div>`;
}

function WorldRow({ c, cid, w, onEdit }) {
  const s = useDoc(`campaigns/${cid}/characters/${c.id}/sheet/main`); const bg = s?.background || '';
  const l = lookIn(w, c, bg), own = !!w.chars?.[c.id];
  return html`<tr onClick=${onEdit}>
    <td><div class="who"><${Medal} cls=${c.cls} species=${c.species} look=${l} size="md"/><div><b>${c.name}</b><div class="sub">${c.ownerName || ''}</div></div></div></td>
    <td>${kindLine(c, null, false)}<div class="sub">${bg || '–'}</div></td>
    <td><b>${l.species} · ${l.cls}</b><div class="sub">${l.bg || '–'}${own ? ' · angepasst' : ''}</div></td>
    <td class="r"><button class="link small" onClick=${e => { e.stopPropagation(); onEdit(); }}>Anpassen</button></td></tr>`;
}

// the DM gives one character other names than the file suggests (e.g. a second Elf from another folk)
function CharWorldModal({ c, cid, user, camp, w, onClose }) {
  const s = useDoc(`campaigns/${cid}/characters/${c.id}/sheet/main`); const bg = s?.background || '';
  const def = lookIn({ ...w, chars: {} }, c, bg), cur = w.chars?.[c.id] || {};
  const [f, setF] = useState({ species: cur.species || '', cls: cur.cls || '', bg: cur.bg || '' });
  const [busy, setBusy] = useState(false);
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const save = async e => { e.preventDefault(); setBusy(true);
    const o = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    const chars = { ...(w.chars || {}) }; if (Object.keys(o).length) chars[c.id] = o; else delete chars[c.id];
    try { await store.batch([{ type: 'update', path: worldPath(user.uid, cid), data: { chars, updatedAt: Date.now() } },
        ...(camp.worldRevealed ? [{ type: 'update', path: `campaigns/${cid}`, data: { world: { ...(camp.world || w), chars } } }] : [])]);
      toast(`Gespeichert: ${c.name}.`); onClose(); } catch (x) { failed(x); } finally { setBusy(false); } };
  const prev = lookIn({ ...w, chars: { [c.id]: Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim())) } }, c, bg);
  const opts = (id, map) => html`<datalist id=${id}>${names(map).map(n => html`<option value=${n}></option>`)}</datalist>`;
  return html`<${Modal} title=${c.name} eyebrow=${`In ${w.name}`} lead=${html`<${Medal} cls=${c.cls} species=${c.species} look=${prev} size="lg"/>`} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      <p class="muted">Leer lassen heißt: der Vorschlag aus der Welt-Datei. Die Felder schlagen die Namen aus der Datei vor, du kannst aber auch etwas Eigenes schreiben.</p>
      <div class="g g3">
        <${Field} label=${`Species · bisher ${c.species || '–'}`}><input id="w-sp" list="w-sp-l" value=${f.species} onInput=${set('species')} placeholder=${def.species}/></${Field}>
        <${Field} label=${`Klasse · bisher ${clsOf(c)}`}><input id="w-cls" list="w-cls-l" value=${f.cls} onInput=${set('cls')} placeholder=${def.cls}/></${Field}>
        <${Field} label=${`Background · bisher ${bg || '–'}`}><input id="w-bg" list="w-bg-l" value=${f.bg} onInput=${set('bg')} placeholder=${def.bg || 'Kein Background'}/></${Field}></div>
      ${opts('w-sp-l', w.species)}${opts('w-cls-l', w.classes)}${opts('w-bg-l', w.backgrounds)}
      <p class="world-prev"><span class="label">So heißt ${c.name}</span><b>${[prev.species, prev.cls, prev.bg].filter(Boolean).join(' · ')}</b></p>
      <div class="foot"><button class="btn primary" disabled=${busy}>Speichern</button><button type="button" class="btn" onClick=${onClose}>Abbrechen</button></div>
    </form></${Modal}>`;
}

// the big moment: everyone switches to the world's names and gets a pop-up with their new identity
function RevealWorld({ camp, cid, w, chars, members, onClose }) {
  const [pop, setPop] = useState(members.length > 0);
  const [title, setTitle] = useState(w.revealTitle || `Willkommen in ${w.name}`);
  const [intro, setIntro] = useState(w.intro || '');
  const [busy, setBusy] = useState(false);
  const go2 = async () => { setBusy(true);
    try { const now = Date.now();
      const sheets = await Promise.all(chars.map(c => store.get(`campaigns/${cid}/characters/${c.id}/sheet/main`).catch(() => null)));
      const lines = chars.map((c, i) => { const l = lookIn(w, c, sheets[i]?.background || ''); return `${c.name}: ${[l.species, l.cls, l.bg].filter(Boolean).join(' · ')}`; });
      const rid = pop ? newId() : null;
      await store.batch([
        { type: 'update', path: `campaigns/${cid}`, data: { world: w, worldRevealed: true, worldRevealedAt: now, worldRevelationId: rid,
          ...(w.setting && w.setting !== camp.setting ? { setting: w.setting, worldPrevSetting: camp.setting || '' } : {}) } },
        ...(pop ? [{ type: 'set', path: `campaigns/${cid}/revelations/${rid}`, data: { title: title.trim() || w.name, kind: 'world', body: [intro.trim(), lines.join('\n')].filter(Boolean).join('\n\n'),
          reason: '', audience: 'all', audienceUids: [], secretId: null, questId: null, createdAt: now } }] : [])]);
      toast(members.length ? `${w.name} ist enthüllt!` : `${w.name} ist eingeschaltet.`); onClose(); } catch (x) { failed(x); } finally { setBusy(false); } };
  return html`<${Modal} title=${`${w.name} ${members.length ? 'enthüllen' : 'einschalten'}`} eyebrow="Welt-Übersetzung" onClose=${onClose}><div class="form">
    <p>${members.length ? `Ab jetzt zeigt die App bei allen die Namen aus ${w.name}: ${members.length === 1 ? 'dein Spieler sieht' : 'deine Spieler sehen'} ihre neue Species, Klasse und ihren Background auf Karten, Bögen, Spieltisch und Tablet.`
      : `Ab jetzt nutzt die Kampagne überall die Namen aus ${w.name}, auch im Builder, wenn du Charaktere anlegst. Noch ist niemand beigetreten, also sieht es außer dir keiner.`}${w.setting ? ` Das Setting der Kampagne wird zu „${w.setting}“.` : ''}</p>
    <label class="checkline"><input type="checkbox" checked=${pop} onChange=${e => setPop(e.target.checked)}/>
      <span><b>Pop-up für alle</b><span class="sub">Erscheint auf jedem Handy und groß auf dem Tablet, mit deinem Text und darunter jedem Charakter mit seiner neuen Identität.</span></span></label>
    ${pop && html`<${Field} label="Überschrift"><input id="wr-title" value=${title} onInput=${e => setTitle(e.target.value)}/></${Field}>
      <${Field} label="Dein Text (optional)"><textarea id="wr-intro" value=${intro} onInput=${e => setIntro(e.target.value)} placeholder="Ein paar Sätze, die du vorliest, während die Musik läuft."></textarea></${Field}>`}
    <p class="ro-note">Lässt sich in den Einstellungen wieder zurücknehmen.</p>
    <div class="foot"><button class="btn primary" disabled=${busy} onClick=${go2}>${busy ? 'Einen Moment …' : members.length ? 'Jetzt enthüllen' : 'Jetzt einschalten'}</button><button class="btn" onClick=${onClose}>Abbrechen</button></div></div></${Modal}>`;
}
