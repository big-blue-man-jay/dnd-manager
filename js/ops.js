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
