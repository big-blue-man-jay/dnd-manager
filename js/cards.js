import { html, Medal, HpBar, go } from './ui.js';
import { DICE_COLORS } from './rules5e.js';

export const STATUS = { active: 'Aktiv', paused: 'Pausiert', finished: 'Beendet' };
export const clsName = c => (c.cls === 'Homebrew' ? c.clsCustom || 'Homebrew' : c.cls);
export const diceOf = c => (DICE_COLORS.find(d => d.key === c.diceColor) || {}).hex;

export function CharCard({ c, camp, showCamp, onOpen }) {
  const open = onOpen || (() => go('c', c.campaignId, 'char', c.id));
  return html`<article class="card panel" role="button" tabindex="0" onClick=${open} onKeyDown=${e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}>
    <div class="nc-head"><${Medal} cls=${c.cls} species=${c.species}/><div class="nc-id"><h3>${c.name || 'Unbenannt'}</h3>
      <div class="sub">Stufe ${c.level || 1} · ${[c.species, clsName(c)].filter(Boolean).join(' ')}</div>
      <div class="sub">${showCamp ? camp?.name || '' : c.ownerName ? 'Gespielt von ' + c.ownerName : ''}</div></div>
      ${diceOf(c) && html`<span class="dice-dot" style=${`--dc:${diceOf(c)}`} title="Würfelfarbe"></span>`}</div>
    <div class="hprow"><span class="label">Hit Points</span><span class="num"><b>${c.hp ?? 0}</b> / ${c.hpMax ?? 0}${c.tempHp ? html` <span class="xp">+${c.tempHp}</span>` : ''}</span></div>
    <${HpBar} hp=${c.hp || 0} max=${c.hpMax || 0}/>
    ${(c.conditions?.length || c.exhaustion) ? html`<div class="chips">${(c.conditions || []).map(x => html`<span class="chip cond">${x}</span>`)}${c.exhaustion ? html`<span class="chip cond">Exhaustion ${c.exhaustion}</span>` : ''}</div>` : ''}
  </article>`;
}
