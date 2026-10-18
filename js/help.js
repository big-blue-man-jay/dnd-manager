// "Dein Zug" cheat sheet: what a character can do on their turn (D&D 2024 Free Rules, "Playing the Game").
import { html, useState, Modal } from './ui.js';

export const TURN = [
  ['Bewegung', 'Bis zu deiner Speed (meist 30 ft = 6 Felder). Du kannst sie aufteilen, z. B. vor und nach deiner Action.', '15 ft laufen, angreifen, 15 ft zurück'],
  ['Eine Action', 'Das Wichtigste in deinem Zug. Eine aus der Liste unten.', 'Angreifen, Zauber wirken, Dash'],
  ['Bonus Action', 'Nur wenn ein Feature, ein Zauber oder eine Regel dir eine gibt. Höchstens eine pro Zug.', 'Cunning Action (Rogue), Healing Word'],
  ['Reaction', 'Eine pro Runde, als Antwort auf einen Auslöser, auch im Zug von anderen. Danach erst wieder ab deinem nächsten Zug.', 'Opportunity Attack, Shield'],
  ['Eine kleine Interaktion', 'Gratis während Bewegung oder Action. Für eine zweite brauchst du die Utilize-Action.', 'Schwert ziehen, Tür öffnen'],
  ['Kurz sprechen', 'Ein paar Worte oder Gesten sind gratis. Längeres Überzeugen kostet eine Action.', '„Hinter dir!“'],
];

export const ACTIONS = [
  ['Attack', 'Mit einer Waffe oder einem Unarmed Strike angreifen.'],
  ['Dash', 'Zusätzliche Bewegung in Höhe deiner Speed für diesen Zug.'],
  ['Disengage', 'Deine Bewegung löst in diesem Zug keine Opportunity Attacks aus.'],
  ['Dodge', 'Bis zu deinem nächsten Zug: Angriffe gegen dich mit Disadvantage, deine Dexterity Saves mit Advantage.'],
  ['Help', 'Einem Verbündeten bei einem Ability Check oder Angriff helfen, oder Erste Hilfe leisten.'],
  ['Hide', 'Dexterity (Stealth) Check, um dich zu verstecken.'],
  ['Influence', 'Charisma (Deception, Intimidation, Performance, Persuasion) oder Wisdom (Animal Handling) Check, um die Haltung eines Wesens zu ändern.'],
  ['Magic', 'Einen Zauber wirken, ein magisches Item oder ein magisches Feature benutzen.'],
  ['Ready', 'Eine Action vorbereiten, die du auslöst, wenn etwas Bestimmtes passiert („Wenn er durch die Tür kommt, schieße ich“).'],
  ['Search', 'Wisdom (Insight, Medicine, Perception, Survival) Check, um etwas zu bemerken oder zu finden.'],
  ['Study', 'Intelligence (Arcana, History, Investigation, Nature, Religion) Check, um etwas zu erkennen oder zu verstehen.'],
  ['Utilize', 'Einen nicht-magischen Gegenstand benutzen.'],
];

export const NOTES = [
  ['Initiative', 'Zu Beginn würfeln alle einen Dexterity Check (d20 + Dex). Von hoch nach niedrig, die Reihenfolge bleibt den ganzen Kampf. Wer überrascht wird, würfelt mit Disadvantage.'],
  ['Runde', 'Jeder ist einmal dran, dann beginnt die nächste Runde. Eine Runde sind etwa 6 Sekunden.'],
  ['Angriff', 'd20 + Angriffsbonus. Erreicht oder übertrifft das die Armor Class des Ziels, triffst du und würfelst Schaden. Natürliche 20: Schadenswürfel doppelt. Natürliche 1: daneben.'],
  ['Opportunity Attack', 'Verlässt ein Gegner deine Reichweite, darfst du ihn mit deiner Reaction einmal im Nahkampf angreifen. Mit Disengage passiert dir das nicht.'],
  ['0 Hit Points', 'Du wirst bewusstlos und machst in jedem Zug einen Death Saving Throw: 10 oder mehr ist ein Erfolg. 3 Erfolge: stabil. 3 Fehlschläge: tot. Jede Heilung weckt dich sofort auf.'],
  ['Unsicher?', 'Sag einfach, was dein Charakter tun will. Der DM sagt dir, welche Action oder welcher Wurf passt.'],
];

// the sheet itself, used in the pop-up and in the wiki
export function TurnSheet() {
  return html`<div class="turnhelp">
      <p class="muted">In deinem Zug hast du <b>Bewegung</b> und <b>eine Action</b>, in beliebiger Reihenfolge. Dazu kommen manchmal eine <b>Bonus Action</b> und einmal pro Runde eine <b>Reaction</b>.</p>
      <div class="tablewrap"><table class="th-table"><thead><tr><th>Was</th><th>Wie viel</th><th>Beispiel</th></tr></thead>
        <tbody>${TURN.map(([a, b, c]) => html`<tr><th scope="row">${a}</th><td>${b}</td><td class="muted">${c}</td></tr>`)}</tbody></table></div>
      <h3>Die Actions</h3>
      <dl class="th-actions">${ACTIONS.map(([a, b]) => html`<div><dt>${a}</dt><dd>${b}</dd></div>`)}</dl>
      <h3>Gut zu wissen</h3>
      <dl class="th-notes">${NOTES.map(([a, b]) => html`<div><dt>${a}</dt><dd>${b}</dd></div>`)}</dl>
      <p class="th-src">Nach den offiziellen Regeln 2024 (D&D Free Rules, „Playing the Game“).</p>
    </div>`;
}
export function TurnHelp({ onClose }) {
  return html`<${Modal} title="Dein Zug im Kampf" eyebrow="Spickzettel" wide onClose=${onClose}><${TurnSheet}/>
    <p class="muted small-note">Alle Begriffe und Abkürzungen findest du im <a href="#/wiki" onClick=${onClose}>📖 Wiki</a>.</p></${Modal}>`;
}

export function TurnHelpButton({ cls = 'btn' }) {
  const [open, setOpen] = useState(false);
  return html`<button class=${cls} onClick=${() => setOpen(true)} aria-haspopup="dialog"><span class="ico" aria-hidden="true">🧭</span> Dein Zug</button>${open && html`<${TurnHelp} onClose=${() => setOpen(false)}/>`}`;
}
