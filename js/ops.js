// Write operations shared by several screens. Paths and fields mirror firestore.rules.
import { store, union, arrRemove, newId } from './data.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export async function ensureUser(user) {
  await store.merge(`users/${user.uid}`, { name: user.name });
}

export async function createCampaign(user, data) {
  const cid = newId();
  let code = makeCode();
  for (let i = 0; i < 5 && (await store.get(`joinCodes/${code}`)); i++) code = makeCode();
  await store.batch([
    { type: 'set', path: `campaigns/${cid}`, data: { ...data, dmUid: user.uid, dmName: data.dmName || user.name, joinCode: code, createdAt: Date.now() } },
    { type: 'set', path: `joinCodes/${code}`, data: { campaignId: cid, campaignName: data.name, dmUid: user.uid } },
    { type: 'merge', path: `users/${user.uid}`, data: { name: user.name, campaignIds: union(cid) } },
  ]);
  return cid;
}

export async function joinCampaign(user, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) throw Object.assign(new Error('Der Code hat 6 Zeichen.'), { friendly: true });
  const jc = await store.get(`joinCodes/${code}`);
  if (!jc) throw Object.assign(new Error('Diesen Code gibt es nicht. Frag deinen DM nochmal.'), { friendly: true });
  const cid = jc.campaignId;
  const ops = [{ type: 'merge', path: `users/${user.uid}`, data: { name: user.name, campaignIds: union(cid) } }];
  if (jc.dmUid !== user.uid) ops.unshift({ type: 'set', path: `campaigns/${cid}/members/${user.uid}`, data: { uid: user.uid, name: user.name, code, joinedAt: Date.now() } });
  await store.batch(ops);
  return cid;
}

export async function leaveCampaign(user, cid) {
  await store.batch([
    { type: 'delete', path: `campaigns/${cid}/members/${user.uid}` },
    { type: 'merge', path: `users/${user.uid}`, data: { campaignIds: arrRemove(cid) } },
  ]);
}

export async function newJoinCode(campaign) {
  let code = makeCode();
  for (let i = 0; i < 5 && (await store.get(`joinCodes/${code}`)); i++) code = makeCode();
  const ops = [
    { type: 'set', path: `joinCodes/${code}`, data: { campaignId: campaign.id, campaignName: campaign.name, dmUid: campaign.dmUid } },
    { type: 'update', path: `campaigns/${campaign.id}`, data: { joinCode: code } },
  ];
  if (campaign.joinCode) ops.push({ type: 'delete', path: `joinCodes/${campaign.joinCode}` });
  await store.batch(ops);
  return code;
}

// A filled-in example campaign to click around in. The signed-in user becomes its DM.
export async function createExampleCampaign(user) {
  const day = n => { const t = new Date(Date.now() + n * 864e5); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const cid = await createCampaign(user, {
    name: 'Die Mine von Phandelver (Beispiel)', status: 'active', theme: 'wald', setting: 'Forgotten Realms', dmName: user.name,
    description: 'Eine Eskorte nach Phandalin wird zur Jagd nach einem verschwundenen Zwerg. Beispielkampagne zum Ausprobieren, lösch sie einfach, wenn du fertig bist.',
    started: day(-7), nextDate: day(7), nextTime: '18:00', nextPlace: 'Bei Joel', example: true,
    customConditions: [{ name: 'Verflucht', desc: '−1 auf alle Saving Throws bis zum nächsten Long Rest.' }],
  });
  const base = `campaigns/${cid}`, now = Date.now(), ch = newId(), s1 = newId(), sec = newId();
  await store.batch([
    { type: 'set', path: `${base}/characters/${ch}`, data: { ownerUid: user.uid, ownerName: user.name, name: 'Thorn Ashvale', species: 'Elf', cls: 'Ranger', clsCustom: '', hitDie: 10, subclass: '', level: 2, xp: 450,
      ac: 14, speed: 35, hpMax: 20, hp: 13, tempHp: 0, conditions: [], exhaustion: 0, diceColor: 'moss', locked: true, createdAt: now - 6e5, updatedAt: now - 6e5 } },
    { type: 'set', path: `${base}/characters/${ch}/sheet/main`, data: { ownerUid: user.uid, abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 }, saveProf: ['str', 'dex'],
      skills: { perception: 1, stealth: 2, survival: 1, nature: 1 }, background: 'Outlander', alignment: 'Chaotic Good', languages: 'Common, Elvish · Light/Medium Armor, Shields, Martial Weapons',
      features: 'Favored Enemy (Hunter\'s Mark), Weapon Mastery, Fighting Style: Archery, Deft Explorer', notes: 'Jagt die Goblins, die den Hof der Familie niedergebrannt haben.',
      attacks: [{ id: newId(), name: 'Longbow', bonus: 7, damage: '1d8+3', note: 'piercing, 150/600 ft' }, { id: newId(), name: 'Shortsword', bonus: 5, damage: '1d6+3', note: 'piercing, finesse, light' }],
      spells: [{ id: newId(), name: "Hunter's Mark", level: 1, prepared: true, note: 'Bonus Action, Concentration' }, { id: newId(), name: 'Cure Wounds', level: 1, prepared: true, note: '' }],
      slotsUsed: [1, 0, 0, 0, 0, 0, 0, 0, 0], slotsOverride: null, resources: [], hitDiceUsed: 0, deathSaves: { ok: 0, fail: 0 }, inspiration: true,
      inventory: [{ id: newId(), name: 'Arrows', qty: 17, note: 'von 20', attuned: false }, { id: newId(), name: 'Potion of Healing', qty: 1, note: '2d4+2', attuned: false }, { id: newId(), name: 'Silbernes Medaillon', qty: 1, note: 'von den Goblins, öffnet sich nicht', attuned: false }],
      coins: { pp: 0, gp: 23, ep: 0, sp: 8, cp: 14 }, spellAbility: '', updatedAt: now } },
    { type: 'set', path: `${base}/sessions/${s1}`, data: { num: 1, date: day(-7), title: 'Der Hinterhalt', stop: 'Die Gruppe steht vor einer Höhle hinter dem Wasserfall. Drinnen flackert Fackellicht, und jemand streitet auf Goblinisch.',
      recap: 'In Phandalin angeheuert, um einen Wagen zu begleiten. Auf dem Triboar Trail von vier Goblins überfallen. Thorn wurde von zwei Pfeilen getroffen, aber die Gruppe hat gewonnen und ist den Spuren in den Wald gefolgt.',
      loot: '14 gp und ein silbernes Medaillon (Thorn hat es genommen).', xp: 150, present: [ch], xpApplied: true, createdAt: now - 5e5 } },
    { type: 'set', path: `${base}/journal/${newId()}`, data: { sessionId: s1, authorUid: user.uid, authorName: user.name, charId: ch, charName: 'Thorn Ashvale', text: 'Zwei Pfeile in der Schulter. Das Medaillon hat einer der Goblins fallen lassen. Warum trägt ein Goblin Silber mit einem Familienwappen?', createdAt: now - 4e5 } },
    { type: 'set', path: `${base}/quests/${newId()}`, data: { title: 'Finde Gundren Rockseeker', status: 'active', giver: 'Sildar Hallwinter', location: 'Höhle hinter dem Wasserfall', reward: '10 gp pro Person', description: 'Der Zwerg, der die Gruppe angeheuert hat, ist seit dem Überfall verschwunden.', notes: '', createdAt: now - 3e5 } },
    { type: 'set', path: `${base}/quests/${newId()}`, data: { title: 'Bring den Wagen nach Phandalin', status: 'done', giver: 'Gundren Rockseeker', location: "Barthen's Provisions", reward: '10 gp pro Person', description: 'Vorräte sicher nach Phandalin bringen.', notes: 'Nach dem Überfall abgeliefert.', createdAt: now - 6e5 } },
    { type: 'set', path: `${base}/npcs/${newId()}`, data: { name: 'Gundren Rockseeker', role: 'Zwergischer Prospektor', location: 'Verschwunden', attitude: 'friendly', status: 'missing', firstMet: '1', notes: 'Hat die Gruppe angeheuert. Redete aufgeregt von einer großen Entdeckung, wollte aber nichts verraten.', createdAt: now - 6e5 } },
    { type: 'set', path: `${base}/npcs/${newId()}`, data: { name: 'Klarg', role: 'Bugbear, Anführer der Goblins', location: 'Goblin-Höhle', attitude: 'hostile', status: 'alive', firstMet: '1', notes: 'Bisher nur Gerüchte. Die Goblins scheinen Angst vor ihm zu haben.', createdAt: now - 2e5 } },
    { type: 'set', path: `${base}/secrets/${sec}`, data: { title: 'Das Medaillon gehört Sildar', kind: 'item', body: 'Das Wappen auf dem Medaillon ist das der Familie Hallwinter. Sildar hat es vor Jahren seiner Schwester geschenkt, die seitdem als vermisst gilt.', revealedAt: 0, createdAt: now - 1e5 } },
    { type: 'set', path: `${base}/revelations/${newId()}`, data: { title: 'Der Weg ist markiert', kind: 'place', body: 'Auf den Bäumen am Trail finden sich frische Kerben: Jemand hat den Goblins den Weg zum Hinterhalt gezeigt.', audience: 'all', audienceUids: [], createdAt: now - 3e5 } },
    { type: 'set', path: `users/${user.uid}/notes/${cid}`, data: { secrets: 'Glasstaff (Iarno) steckt hinter den Redbrands. Er arbeitet für den Black Spider.', prep: 'Höhle: Wolfszwinger, Wasserfalle, Klarg in der Höhle oben.', ideas: 'Thorns Familie: Hatten die Goblins einen Auftraggeber?', updatedAt: now } },
  ]);
  return cid;
}
