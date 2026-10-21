// Shop: buy and sell with the character's coins (2024 Player's Handbook prices).
// Buying adds the item (weapons also become an attack line), selling pays half the price.
// Players can shop while their sheet is still a draft, or when the DM opens the shop at the table.
import { html, useState, Modal, toast, failed } from './ui.js';
import { store, newId } from './data.js';
import { mod, profBonus } from './rules5e.js';
import { WEAPONS, MASTERY, canUseWeapon, attacksFor } from './classperks.js';
import { logAct, charActor } from './log.js';

const gp = n => Math.round(n * 100), sp = n => n * 10, cp = n => n;
const W = (n, p) => ({ n, p, cat: 'waffen' });
const WEAPON_LIST = [W('Club', sp(1)), W('Dagger', gp(2)), W('Greatclub', sp(2)), W('Handaxe', gp(5)), W('Javelin', sp(5)), W('Light Hammer', gp(2)), W('Mace', gp(5)), W('Quarterstaff', sp(2)),
  W('Sickle', gp(1)), W('Spear', gp(1)), W('Dart', cp(5)), W('Light Crossbow', gp(25)), W('Shortbow', gp(25)), W('Sling', sp(1)),
  W('Battleaxe', gp(10)), W('Flail', gp(10)), W('Glaive', gp(20)), W('Greataxe', gp(30)), W('Greatsword', gp(50)), W('Halberd', gp(20)), W('Longsword', gp(15)), W('Maul', gp(10)),
  W('Morningstar', gp(15)), W('Rapier', gp(25)), W('Scimitar', gp(25)), W('Shortsword', gp(10)), W('Trident', gp(5)), W('Warhammer', gp(15)), W('War Pick', gp(5)), W('Whip', gp(2)),
  W('Hand Crossbow', gp(75)), W('Heavy Crossbow', gp(50)), W('Longbow', gp(50))];
// ac: base, dex: how much Dexterity counts (99 = all), kind: light / medium / heavy / shield
export const ARMOR = {
  'Padded Armor': { p: gp(5), ac: 11, dex: 99, kind: 'light', note: 'Leicht · Disadvantage auf Stealth' },
  'Leather Armor': { p: gp(10), ac: 11, dex: 99, kind: 'light', note: 'Leicht' },
  'Studded Leather Armor': { p: gp(45), ac: 12, dex: 99, kind: 'light', note: 'Leicht, die beste leichte Rüstung' },
  'Hide Armor': { p: gp(10), ac: 12, dex: 2, kind: 'medium', note: 'Mittel' },
  'Chain Shirt': { p: gp(50), ac: 13, dex: 2, kind: 'medium', note: 'Mittel' },
  'Scale Mail': { p: gp(50), ac: 14, dex: 2, kind: 'medium', note: 'Mittel · Disadvantage auf Stealth' },
  Breastplate: { p: gp(400), ac: 14, dex: 2, kind: 'medium', note: 'Mittel, leise' },
  'Half Plate Armor': { p: gp(750), ac: 15, dex: 2, kind: 'medium', note: 'Mittel · Disadvantage auf Stealth' },
  'Ring Mail': { p: gp(30), ac: 14, dex: 0, kind: 'heavy', note: 'Schwer · Disadvantage auf Stealth' },
  'Chain Mail': { p: gp(75), ac: 16, dex: 0, kind: 'heavy', note: 'Schwer · Strength 13 · Disadvantage auf Stealth' },
  'Splint Armor': { p: gp(200), ac: 17, dex: 0, kind: 'heavy', note: 'Schwer · Strength 15 · Disadvantage auf Stealth' },
  'Plate Armor': { p: gp(1500), ac: 18, dex: 0, kind: 'heavy', note: 'Schwer · Strength 15 · Disadvantage auf Stealth' },
  Shield: { p: gp(10), ac: 2, dex: 0, kind: 'shield', note: '+2 AC, braucht eine freie Hand' },
};
const KIND_DE = { light: 'leichte Rüstung', medium: 'mittlere Rüstung', heavy: 'schwere Rüstung', shield: 'Schilde' };
export function canWear(cls, kind, perks = {}) {
  if (kind === 'light') return !['Wizard', 'Sorcerer', 'Monk'].includes(cls);
  if (kind === 'medium') return ['Barbarian', 'Cleric', 'Fighter', 'Paladin', 'Ranger'].includes(cls) || perks.order === 'Warden';
  if (kind === 'heavy') return ['Fighter', 'Paladin'].includes(cls) || perks.order === 'Protector';
  if (kind === 'shield') return ['Barbarian', 'Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger'].includes(cls);
  return true;
}
const G = (n, p, cat, note, qty = 1) => ({ n, p, cat, note, qty });
const GEAR = [
  G('Potion of Healing', gp(50), 'heilung', 'Heilt 2d4+2 HP. Trinken ist eine Bonus Action, einem anderen einflößen eine Action.'),
  G("Healer's Kit", gp(5), 'heilung', '10 Anwendungen: einen Sterbenden ohne Wurf stabilisieren.'),
  G('Antitoxin', gp(50), 'heilung', '1 Stunde Advantage gegen Gift.'),
  G('Holy Water', gp(25), 'heilung', 'Werfen: 2d8 Radiant-Schaden gegen Untote und Fiends.'),
  G('Backpack', gp(2), 'abenteuer', 'Hier passt deine Ausrüstung hinein.'),
  G('Bedroll', gp(1), 'abenteuer', 'Zum Schlafen draußen.'),
  G('Rope (50 ft)', gp(1), 'abenteuer', 'Hanfseil zum Klettern und Fesseln.'),
  G('Torch', cp(1), 'abenteuer', '1 Stunde Licht: 20 ft hell, 20 ft dämmrig.'),
  G('Rations (1 Tag)', sp(5), 'abenteuer', 'Essen für einen Tag.'),
  G('Waterskin', sp(2), 'abenteuer', 'Wasser für einen Tag.'),
  G('Tinderbox', sp(5), 'abenteuer', 'Feuerstein und Zunder: in einer Action eine Fackel anzünden.'),
  G('Hooded Lantern', gp(5), 'abenteuer', 'Licht 30 ft hell, abdeckbar. Brennt 6 Stunden mit einer Flasche Öl.'),
  G('Oil (Flask)', sp(1), 'abenteuer', 'Lampenöl. Geworfen und angezündet: 5 Feuerschaden.'),
  G('Crowbar', gp(2), 'abenteuer', 'Advantage auf Strength-Würfe zum Aufhebeln.'),
  G('Grappling Hook', gp(2), 'abenteuer', 'Mit Seil: Mauern und Klippen hinauf.'),
  G("Climber's Kit", gp(25), 'abenteuer', 'Haken und Gurte: Du kannst nicht mehr als 25 ft abstürzen.'),
  G('Caltrops', gp(1), 'abenteuer', 'Krähenfüße auf den Boden streuen: Verfolger werden langsamer.'),
  G('Ball Bearings', gp(1), 'abenteuer', 'Kugeln auf den Boden: Wer drüberläuft, fällt vielleicht hin.'),
  G('Manacles', gp(2), 'abenteuer', 'Handschellen für Gefangene.'),
  G('Chain (10 ft)', gp(5), 'abenteuer', 'Kette, schwer zu zerbrechen.'),
  G('Lock', gp(10), 'abenteuer', 'Schloss mit Schlüssel.'),
  G('Hunting Trap', gp(5), 'abenteuer', 'Fangeisen: hält ein Tier oder einen Gegner fest.'),
  G('Mirror', gp(5), 'abenteuer', 'Kleiner Stahlspiegel, z. B. um Ecken schauen.'),
  G('Tent', gp(2), 'abenteuer', 'Zelt für zwei.'),
  G("Traveler's Clothes", gp(2), 'abenteuer', 'Robuste Reisekleidung.'),
  G('Fine Clothes', gp(15), 'abenteuer', 'Für Adelige, Bälle und Audienzen.'),
  G('Arrows', gp(1), 'munition', '20 Pfeile für Bögen.', 20),
  G('Bolts', gp(1), 'munition', '20 Bolzen für Armbrüste.', 20),
  G('Sling Bullets', cp(4), 'munition', '20 Kugeln für die Schleuder.', 20),
  G('Quiver', gp(1), 'munition', 'Köcher für 20 Pfeile.'),
  G('Spell Component Pouch', gp(25), 'magie', 'Beutel mit Zutaten: ersetzt Material-Komponenten ohne Preis.'),
  G('Arcane Focus (Crystal)', gp(10), 'magie', 'Fokus für Wizard, Sorcerer und Warlock.'),
  G('Holy Symbol', gp(5), 'magie', 'Fokus für Cleric und Paladin.'),
  G('Druidic Focus (Mistletoe)', gp(1), 'magie', 'Fokus für Druid und Ranger.'),
  G('Spellbook', gp(50), 'magie', 'Leeres Zauberbuch für Wizards.'),
  G("Thieves' Tools", gp(25), 'werkzeug', 'Schlösser knacken und Fallen entschärfen.'),
  G('Herbalism Kit', gp(5), 'werkzeug', 'Kräuter sammeln, Heiltränke brauen.'),
  G('Disguise Kit', gp(25), 'werkzeug', 'Schminke und Kostümteile zum Verkleiden.'),
  G("Cartographer's Tools", gp(15), 'werkzeug', 'Karten zeichnen.'),
  G('Musical Instrument (Lute)', gp(35), 'werkzeug', 'Laute für Bards und Gaukler.'),
  G('Gaming Set (Dice)', sp(1), 'werkzeug', 'Würfelspiel für die Taverne.'),
  G("Burglar's Pack", gp(16), 'pakete', 'Rucksack, Kugellager, Glöckchen, Kerzen, Brecheisen, Laterne, Öl, Rationen, Seil, Zunder, Wasserschlauch.'),
  G("Dungeoneer's Pack", gp(12), 'pakete', 'Rucksack, Kugellager, Brecheisen, Öl, Rationen, Seil, Zunder, Fackeln, Wasserschlauch.'),
  G("Explorer's Pack", gp(10), 'pakete', 'Rucksack, Schlafsack, Öl, Rationen, Seil, Zunder, Fackeln, Wasserschlauch.'),
  G("Priest's Pack", gp(33), 'pakete', 'Rucksack, Decke, Weihwasser, Lampe, Rationen, Robe, Zunder.'),
  G("Scholar's Pack", gp(40), 'pakete', 'Rucksack, Buch, Tinte, Feder, Lampe, Öl, Pergament, Zunder.'),
];
export const CATALOG = [
  ...WEAPON_LIST.map(w => ({ ...w, qty: 1, note: `${WEAPONS[w.n].die} · ${WEAPONS[w.n].note} · Mastery ${WEAPONS[w.n].m}` })),
  ...Object.entries(ARMOR).map(([n, a]) => ({ n, p: a.p, cat: 'ruestung', qty: 1, note: a.kind === 'shield' ? a.note : `AC ${a.ac}${a.dex === 99 ? ' + Dex' : a.dex ? ' + Dex (max 2)' : ''} · ${a.note}` })),
  ...GEAR,
];
const CATS = [['alle', 'Alles'], ['waffen', '⚔️ Waffen'], ['ruestung', '🛡️ Rüstung'], ['heilung', '🧪 Heilung'], ['abenteuer', '🎒 Abenteuer'], ['munition', '🏹 Munition'], ['magie', '✨ Magie'], ['werkzeug', '🔧 Werkzeug'], ['pakete', '📦 Pakete']];

/* ---------- money ---------- */
const VAL = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
export const worth = c => Object.entries(VAL).reduce((t, [k, v]) => t + (c[k] || 0) * v, 0);
export const price = n => (n >= 100 && n % 100 === 0 ? `${n / 100} gp` : n >= 100 ? `${(n / 100).toFixed(2).replace('.', ',')} gp` : n >= 10 && n % 10 === 0 ? `${n / 10} sp` : `${n} cp`);
// pay from small coins up; break a bigger coin when needed and give change in gp, sp, cp
export function pay(coins, amount) {
  const c = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...coins };
  if (worth(c) < amount) return null;
  let need = amount;
  for (const [k, v] of [['cp', 1], ['sp', 10], ['ep', 50], ['gp', 100], ['pp', 1000]]) { const use = Math.min(c[k], Math.floor(need / v)); c[k] -= use; need -= use * v; }
  if (need > 0) {
    const [k, v] = [['sp', 10], ['ep', 50], ['gp', 100], ['pp', 1000]].find(([k2, v2]) => c[k2] > 0 && v2 >= need) || [];
    if (!k) return null;
    c[k] -= 1; let change = v - need;
    for (const [k2, v2] of [['gp', 100], ['sp', 10], ['cp', 1]]) { const n = Math.floor(change / v2); c[k2] += n; change -= n * v2; }
  }
  return c;
}
export function receive(coins, amount) {
  const c = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...coins }; let a = amount;
  for (const [k, v] of [['gp', 100], ['sp', 10], ['cp', 1]]) { const n = Math.floor(a / v); c[k] += n; a -= n * v; }
  return c;
}
const show = c => [['pp', 'pp'], ['gp', 'gp'], ['ep', 'ep'], ['sp', 'sp'], ['cp', 'cp']].filter(([k]) => c[k]).map(([k, l]) => `${c[k]} ${l}`).join(' · ') || '0 gp';

// AC with this armor (and a shield, if the character carries one)
export function acWith(armorName, s, shield) {
  const a = ARMOR[armorName]; const dex = mod((s.abilities || {}).dex || 10);
  return a.ac + Math.min(a.dex, dex) + (shield ? 2 : 0);
}
const perksOf = s => ({ order: /Protector/.test(s.features || '') ? 'Protector' : /Warden/.test(s.features || '') ? 'Warden' : '' });

/* ---------- UI ---------- */
export function ShopButton({ ctx, cls = 'btn small' }) {
  const [open, setOpen] = useState(false);
  return html`<button class=${cls} onClick=${() => setOpen(true)}>🛒 Laden</button>${open && html`<${ShopModal} ctx=${ctx} onClose=${() => setOpen(false)}/>`}`;
}
export const shopAllowed = ctx => ctx.isDM || ctx.coreOk || !!ctx.camp?.table?.shop;

function ShopModal({ ctx, onClose }) {
  const { c, s, cid, chId, camp, user, coreOk } = ctx;
  const [tab, setTab] = useState('kaufen'); const [cat, setCat] = useState('alle'); const [q, setQ] = useState(''); const [busy, setBusy] = useState(false);
  const coins = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, ...(s.coins || {}) }, have = worth(coins);
  const inv = s.inventory || [], perks = perksOf(s);
  const hasShield = inv.some(i => i.name === 'Shield' && (i.qty ?? 1) > 0);
  const path = `campaigns/${cid}/characters/${chId}/sheet/main`;
  const actor = charActor(camp, c, cid, user);
  const ql = q.trim().toLowerCase();
  const list = CATALOG.filter(x => (cat === 'alle' || x.cat === cat) && (!ql || `${x.n} ${x.note}`.toLowerCase().includes(ql)));
  const warn = x => { if (x.cat === 'waffen' && !canUseWeapon(c.cls, x.n, perks)) return `${c.cls} ist darin nicht geübt: kein Proficiency Bonus beim Angriff.`;
    if (x.cat === 'ruestung' && !canWear(c.cls, ARMOR[x.n].kind, perks)) return `${c.cls} kann keine ${KIND_DE[ARMOR[x.n].kind]} tragen: Disadvantage auf alles und kein Zaubern.`; return ''; };

  const buy = async x => {
    const next = pay(coins, x.p); if (!next) return toast(`Zu wenig Geld: ${x.n} kostet ${price(x.p)}, du hast ${show(coins)}.`);
    setBusy(true);
    const ex = inv.find(i => i.name === x.n);
    const inventory = ex ? inv.map(i => (i === ex ? { ...i, qty: (i.qty ?? 1) + x.qty } : i)) : [...inv, { id: newId(), name: x.n, qty: x.qty, note: x.cat === 'waffen' ? WEAPONS[x.n].note : x.note, attuned: false }];
    const data = { coins: next, inventory, updatedAt: Date.now() }; let msg = `${x.n} gekauft.`;
    if (x.cat === 'waffen' && !(s.attacks || []).some(a => a.name === x.n)) {
      // masteries chosen in the builder stand in the features text: "Weapon Mastery: Dagger (Nick), Rapier (Vex) – …"
      const mastery = ((/Weapon Mastery: ([^–\n]*)/.exec(s.features || '') || [])[1] || '').split(',').map(t => t.replace(/\(.*\)/, '').trim()).filter(Boolean);
      const style = (/Fighting Style: (Archery|Dueling)/.exec(s.features || '') || [])[1] || '';
      const [a] = attacksFor(c.cls, [x.n], s.abilities || {}, { mastery, style }, c.level || 1);
      if (!canUseWeapon(c.cls, x.n, perks)) a.bonus -= profBonus(c.level || 1);
      data.attacks = [...(s.attacks || []), a]; msg += ' Steht jetzt bei deinen Angriffen.';
    }
    if (x.cat === 'ruestung') {
      const a = ARMOR[x.n];
      const curArmor = Object.keys(ARMOR).filter(n => n !== 'Shield' && inv.some(i => i.name === n)).sort((p, r) => ARMOR[r].ac - ARMOR[p].ac)[0];
      const newAc = a.kind === 'shield' ? (hasShield ? s.ac : (s.ac || 10) + 2) : acWith(x.n, s, hasShield);
      if (coreOk && (a.kind === 'shield' || !curArmor || newAc > (s.ac || 0))) { data.ac = newAc; msg += ` Neue AC: ${newAc}.`; }
      else if (newAc !== s.ac) msg += ` Damit wäre deine AC ${newAc}. ${coreOk ? 'Trag sie im Bogen ein, wenn du sie anziehst.' : 'Sag es deinem DM, er trägt sie ein.'}`;
    }
    try { await store.merge(path, data); logAct(actor, `kauft ${x.qty > 1 ? x.qty + '× ' : ''}${x.n} für ${price(x.p)}`); toast(msg); } catch (e) { failed(e); } finally { setBusy(false); }
  };
  const sellable = inv.map(i => ({ i, x: CATALOG.find(x => x.n === i.name) })).filter(({ i, x }) => x && (i.qty ?? 1) > 0);
  const sell = async ({ i, x }) => {
    const back = Math.floor(x.p / 2), left = (i.qty ?? 1) - x.qty;
    if (x.qty > 1 && (i.qty ?? 1) < x.qty) return toast(`Verkauft wird nur im Bündel: ${x.qty} Stück.`);
    setBusy(true);
    const inventory = left > 0 ? inv.map(y => (y === i ? { ...y, qty: left } : y)) : inv.filter(y => y !== i);
    const data = { coins: receive(coins, back), inventory, updatedAt: Date.now() };
    if (left <= 0 && x.cat === 'waffen') data.attacks = (s.attacks || []).filter(a => a.name !== x.n);
    try { await store.merge(path, data); logAct(actor, `verkauft ${x.qty > 1 ? x.qty + '× ' : ''}${x.n} für ${price(back)}`); toast(`${x.n} verkauft für ${price(back)}.`); } catch (e) { failed(e); } finally { setBusy(false); }
  };

  return html`<${Modal} title="Laden" eyebrow=${c.name} wide onClose=${onClose}>
    <div class="shop">
      <div class="shop-top"><div class="shop-wallet"><span class="label">Dein Geld</span><b>💰 ${show(coins)}</b></div>
        <span class="seg small">${[['kaufen', 'Kaufen'], ['verkaufen', 'Verkaufen']].map(([k, l]) => html`<button type="button" aria-pressed=${tab === k} onClick=${() => setTab(k)}>${l}</button>`)}</span></div>
      <p class="muted small-note">${tab === 'kaufen' ? 'Preise aus dem Player\'s Handbook. Dein DM kann Preise im Spiel anders ansetzen, dann zählt sein Wort. 1 gp = 10 sp = 100 cp.' : 'Händler zahlen die Hälfte des Ladenpreises. Magische und selbst eingetragene Gegenstände verkaufst du direkt beim DM.'}</p>
      ${tab === 'kaufen' ? html`
        <input type="search" placeholder="Suchen, z. B. Trank, Seil, Bogen" value=${q} onInput=${e => setQ(e.target.value)} aria-label="Im Laden suchen"/>
        <div class="shop-cats">${CATS.map(([k, l]) => html`<button type="button" class=${'chip-btn' + (cat === k ? ' on' : '')} onClick=${() => setCat(k)}>${l}</button>`)}</div>
        <div class="shop-list">${list.map(x => { const w = warn(x), afford = have >= x.p, own = inv.find(i => i.name === x.n);
          return html`<div class=${'shop-row' + (afford ? '' : ' poor')}><div class="shop-name"><b>${x.qty > 1 ? `${x.n} (${x.qty})` : x.n}</b>${own && html` <span class="ch-tag">hast du ${own.qty ?? 1}×</span>`}<small>${x.note}</small>${w && html`<small class="shop-warn">⚠️ ${w}</small>`}</div>
            <span class="shop-price num">${price(x.p)}</span><button class="btn small primary" disabled=${busy || !afford} onClick=${() => buy(x)}>Kaufen</button></div>`; })}
          ${!list.length && html`<p class="muted">Nichts gefunden.</p>`}</div>`
      : html`<div class="shop-list">${sellable.map(r => html`<div class="shop-row"><div class="shop-name"><b>${r.i.name}</b> <span class="ch-tag">${r.i.qty ?? 1}×</span><small>${r.x.qty > 1 ? `Verkauf im Bündel zu ${r.x.qty} Stück` : r.x.note}</small></div>
          <span class="shop-price num">${price(Math.floor(r.x.p / 2))}</span><button class="btn small" disabled=${busy} onClick=${() => sell(r)}>Verkaufen</button></div>`)}
          ${!sellable.length && html`<p class="muted">Nichts im Rucksack, das ein normaler Händler kauft.</p>`}</div>`}
    </div></${Modal}>`;
}
