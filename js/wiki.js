// Wiki: every term and abbreviation a new group meets in a campaign, explained in German (D&D 2024 rules).
// Game terms stay English like in the rest of the app; each entry can carry a German translation and an example.
import { html, useState, useEffect, useMemo } from './ui.js';
import { ABILITIES, SKILLS, CONDITIONS, EXHAUSTION_DESC } from './rules5e.js';
import { ABILITY_DESC, SKILL_DESC } from './builder-data.js';
import { TurnSheet } from './help.js';

// e: entry. t: term, a: abbreviation, de: German, d: explanation, x: example
const e = (t, d, o = {}) => ({ t, d, ...o });

const SECTIONS = [
  { id: 'wuerfel', icon: '🎲', title: 'Würfel & Würfe', intro: 'Fast alles in D&D läuft auf einen Wurf mit dem d20 hinaus: würfeln, Bonus dazu, mit einer Zielzahl vergleichen.', entries: [
    e('Würfel', 'Die Zahl nach dem d sagt, wie viele Seiten der Würfel hat: d4, d6, d8, d10, d12, d20. Ein d100 sind zwei d10 (Zehner und Einer).', { a: 'd4 … d20, d100' }),
    e('Würfelformel', 'Die Zahl vor dem d sagt, wie viele Würfel, die Zahl dahinter, was dazukommt. Alles zusammenzählen.', { a: 'XdY+Z', x: '2d6+3: zwei sechsseitige Würfel plus 3, also 5 bis 15.' }),
    e('d20 Test', 'Oberbegriff für die drei wichtigsten Würfe: Ability Check, Saving Throw und Attack Roll. Immer d20 + Bonus gegen eine Zielzahl.', { de: 'd20-Wurf' }),
    e('Ability Check', 'Du versuchst etwas, dessen Ausgang unsicher ist: klettern, lügen, ein Schloss knacken. d20 + Attributs-Modifier (+ Proficiency Bonus, wenn du im passenden Skill geübt bist) gegen den DC.', { de: 'Probe / Fertigkeitswurf', a: 'Check', x: 'Wisdom (Perception) Check, um die Falle zu bemerken.' }),
    e('Saving Throw', 'Du wehrst dich gegen etwas, das dir passiert: Gift, ein Zauber, eine Explosion. d20 + Modifier (+ Proficiency Bonus, wenn deine Klasse in diesem Save geübt ist) gegen den DC.', { de: 'Rettungswurf', a: 'Save, ST', x: 'Dexterity Save gegen Burning Hands: Geschafft heißt halber Schaden.' }),
    e('Attack Roll', 'Ein Angriff mit Waffe oder Zauber. d20 + Angriffsbonus gegen die Armor Class des Ziels. Gleich oder höher trifft.', { de: 'Angriffswurf', a: 'Atk' }),
    e('Difficulty Class', 'Die Zielzahl, die ein Check oder Save erreichen muss. Der DM legt sie fest oder ein Zauber gibt sie vor.', { de: 'Schwierigkeitsgrad', a: 'DC', x: 'Sehr leicht 5 · Leicht 10 · Mittel 15 · Schwer 20 · Sehr schwer 25 · Fast unmöglich 30' }),
    e('Modifier', 'Der Bonus, der aus einem Attributswert kommt: (Wert − 10) ÷ 2, abgerundet. Wert 10–11 ergibt +0, 14–15 ergibt +2, 8–9 ergibt −1.', { de: 'Modifikator', a: 'Mod' }),
    e('Proficiency Bonus', 'Bonus für alles, worin du geübt bist: Skills, Saves, Waffen, Zauber. +2 auf Stufe 1 bis 4, +3 ab Stufe 5, +4 ab 9, +5 ab 13, +6 ab 17.', { de: 'Übungsbonus', a: 'PB, Prof' }),
    e('Proficiency', 'Du bist in etwas geübt und bekommst dafür deinen Proficiency Bonus auf den Wurf.', { de: 'Übung / Geübtheit' }),
    e('Expertise', 'Doppelter Proficiency Bonus in einem Skill. Haben z. B. Rogues und Bards.', { de: 'Expertise', x: 'Stufe 1 mit Expertise: +4 statt +2.' }),
    e('Advantage', 'Zwei d20 würfeln, den höheren nehmen. Kommt z. B. von Hilfe, einem überraschten Gegner oder einem Zauber.', { de: 'Vorteil', a: 'Adv' }),
    e('Disadvantage', 'Zwei d20 würfeln, den niedrigeren nehmen. Kommt z. B. von Dunkelheit, Gift oder einem Angriff auf große Entfernung. Hast du beides, heben sie sich auf: ein normaler Wurf.', { de: 'Nachteil', a: 'Dis' }),
    e('Natural 20', 'Eine 20 auf dem Würfel selbst, ohne Bonus. Beim Angriff ein Critical Hit: trifft immer, Schadenswürfel doppelt. Bei Checks und Saves zählt sie nach den Regeln nur als 20, viele DMs belohnen sie trotzdem.', { de: 'Natürliche 20', a: 'Nat 20, Krit' }),
    e('Natural 1', 'Eine 1 auf dem Würfel selbst. Ein Angriff verfehlt immer. Bei Checks und Saves zählt sie nach den Regeln nur als 1.', { de: 'Natürliche 1', a: 'Nat 1' }),
    e('Passive Score', 'Wenn niemand würfelt, z. B. ob eine Falle bemerkt wird: 10 + alle Boni des Skills. Mit Advantage +5, mit Disadvantage −5.', { de: 'Passiver Wert', a: 'PP (Passive Perception)', x: 'Passive Perception 13: Alles mit DC 13 oder weniger bemerkst du von selbst.' }),
    e('Heroic Inspiration', 'Vom DM für gutes Rollenspiel vergeben, manche Species haben sie jeden Tag. Damit darfst du einen Würfel sofort neu würfeln und das neue Ergebnis nehmen.', { de: 'Heldenhafte Inspiration', a: 'Inspiration' }),
    e('Contest', 'Zwei würfeln gegeneinander, der höhere gewinnt. Bei Gleichstand bleibt alles, wie es war.', { de: 'Kräftemessen', x: 'Jemand schleicht (Stealth) gegen jemanden, der aufpasst (Perception).' }),
    e('Group Check', 'Alle würfeln dasselbe. Schafft es mindestens die Hälfte, gilt es für die ganze Gruppe als geschafft.', { de: 'Gruppenprobe' }),
  ] },
  { id: 'werte', icon: '📊', title: 'Charakterwerte', intro: 'Was auf dem Charakterbogen steht und wofür es gut ist.', entries: [
    ...ABILITIES.map(a => e(a.name, ABILITY_DESC[a.key], { a: a.short })),
    e('Ability Score', 'Die sechs Grundwerte, meist zwischen 8 und 20. Wichtig ist am Tisch fast immer der Modifier, der daraus folgt.', { de: 'Attributswert' }),
    e('Hit Points', 'Lebenspunkte. Schaden zieht sie ab, Heilung füllt sie bis zum Maximum. Bei 0 fällst du um.', { de: 'Trefferpunkte', a: 'HP, TP' }),
    e('Temporary Hit Points', 'Ein Puffer, der vor den echten HP verbraucht wird. Stapeln sich nicht (du behältst den höheren Wert) und verschwinden nach einem Long Rest.', { de: 'Temporäre Trefferpunkte', a: 'Temp HP, THP' }),
    e('Armor Class', 'Wie schwer du zu treffen bist. Ein Angriff muss diese Zahl erreichen. Kommt aus Rüstung, Schild und Dexterity.', { de: 'Rüstungsklasse', a: 'AC, RK', x: 'Leder 11 + Dex · Kettenhemd 16 · Schild +2' }),
    e('Speed', 'Wie weit du dich pro Zug bewegen kannst, meist 30 ft (6 Felder auf der Karte).', { de: 'Bewegungsrate' }),
    e('Initiative', 'Bestimmt die Reihenfolge im Kampf: d20 + Dexterity Modifier.', { a: 'Init' }),
    e('Hit Dice', 'Ein Würfel pro Stufe, Größe je nach Klasse (d6 bis d12). In einem Short Rest kannst du sie ausgeben, um dich zu heilen: Würfel + Constitution Modifier.', { de: 'Trefferwürfel', a: 'HD' }),
    e('Level', 'Deine Stufe, 1 bis 20. Mit jeder Stufe mehr HP und neue Fähigkeiten.', { de: 'Stufe', a: 'Lvl' }),
    e('Experience Points', 'Erfahrungspunkte, die der DM für Kämpfe, gelöste Rätsel und erreichte Ziele vergibt. Ab 300 XP Stufe 2, ab 900 XP Stufe 3, ab 2.700 XP Stufe 4.', { de: 'Erfahrungspunkte', a: 'XP, EP' }),
    e('Class', 'Was dein Charakter kann: Fighter, Wizard, Rogue und so weiter. Bestimmt HP, Fähigkeiten und Zauber.', { de: 'Klasse' }),
    e('Subclass', 'Eine Spezialisierung innerhalb der Klasse, meist ab Stufe 3, z. B. Champion beim Fighter.', { de: 'Unterklasse' }),
    e('Species', 'Dein Volk: Human, Elf, Dwarf und so weiter. Gibt angeborene Fähigkeiten wie Darkvision. Hieß früher „Race“.', { de: 'Spezies / Volk' }),
    e('Background', 'Was du vor dem Abenteuer gemacht hast. Gibt dir +2/+1 oder +1/+1/+1 auf drei Attribute, zwei Skills, ein Werkzeug und einen Origin Feat.', { de: 'Hintergrund' }),
    e('Feat', 'Eine besondere Fähigkeit. Einen bekommst du vom Background, weitere auf bestimmten Stufen.', { de: 'Talent' }),
    e('Ability Score Improvement', 'Ein Feat auf Stufe 4, 8, 12, 16 und 19: +2 auf ein Attribut oder +1 auf zwei.', { de: 'Attributsverbesserung', a: 'ASI' }),
    e('Alignment', 'Die moralische Grundhaltung, z. B. Chaotic Good. Eine Orientierung fürs Rollenspiel, keine feste Regel.', { de: 'Gesinnung' }),
    e('Skill', 'Eine Fertigkeit wie Stealth oder Persuasion. Jede gehört zu einem Attribut. Unten im Abschnitt „Skills“ stehen alle.', { de: 'Fertigkeit' }),
  ] },
  { id: 'skills', icon: '🎯', title: 'Skills', intro: 'Wofür man welchen Skill würfelt. In Klammern das Attribut, aus dem der Bonus kommt.',
    entries: SKILLS.map(k => e(k.name, SKILL_DESC[k.key] || '', { a: k.ab.toUpperCase() })) },
  { id: 'kampf', icon: '⚔️', title: 'Kampf', intro: 'Wie ein Kampf abläuft und was die Begriffe dabei heißen. Den Ablauf eines Zuges findest du unter „Dein Zug“.', entries: [
    e('Round', 'Jeder kommt einmal dran, dann beginnt die nächste Runde. Etwa 6 Sekunden in der Spielwelt.', { de: 'Runde' }),
    e('Turn', 'Dein Zug in der Runde: Bewegung, eine Action und eventuell eine Bonus Action.', { de: 'Zug' }),
    e('Surprise', 'Wer überrascht wird, würfelt Initiative mit Disadvantage.', { de: 'Überraschung' }),
    e('Action', 'Die Hauptsache in deinem Zug, z. B. Attack, Magic, Dash. Eine pro Zug.', { de: 'Aktion' }),
    e('Bonus Action', 'Eine zusätzliche schnelle Handlung, nur wenn ein Feature oder Zauber sie erlaubt. Höchstens eine pro Zug.', { de: 'Bonusaktion', a: 'BA' }),
    e('Reaction', 'Eine Antwort auf einen Auslöser, auch im Zug von anderen. Eine pro Runde.', { de: 'Reaktion' }),
    e('Melee Attack', 'Nahkampfangriff gegen ein Ziel in deiner Reichweite, meist 5 ft.', { de: 'Nahkampfangriff' }),
    e('Ranged Attack', 'Fernkampfangriff. Waffen haben zwei Reichweiten, z. B. 80/320: bis 80 ft normal, bis 320 ft mit Disadvantage. Steht ein Gegner direkt neben dir, hast du ebenfalls Disadvantage.', { de: 'Fernkampfangriff' }),
    e('Reach', 'Wie weit du im Nahkampf angreifen kannst. Normal 5 ft (ein Feld), mit Reach-Waffen 10 ft.', { de: 'Reichweite' }),
    e('Opportunity Attack', 'Verlässt ein Gegner freiwillig deine Reichweite, darfst du ihn mit deiner Reaction einmal angreifen. Disengage, Teleport oder gestoßen werden lösen keinen aus.', { de: 'Gelegenheitsangriff', a: 'OA, AoO' }),
    e('Critical Hit', 'Eine natürliche 20 beim Angriff: trifft immer, alle Schadenswürfel werden doppelt gewürfelt, der Bonus nur einmal.', { de: 'Kritischer Treffer', a: 'Crit', x: 'Schwert 1d8+3 wird zu 2d8+3.' }),
    e('Damage Types', 'Jeder Schaden hat eine Art: Acid, Bludgeoning, Cold, Fire, Force, Lightning, Necrotic, Piercing, Poison, Psychic, Radiant, Slashing, Thunder.', { de: 'Schadensarten' }),
    e('Resistance', 'Schaden dieser Art wird halbiert (abgerundet).', { de: 'Resistenz' }),
    e('Vulnerability', 'Schaden dieser Art wird verdoppelt.', { de: 'Verwundbarkeit' }),
    e('Immunity', 'Schaden dieser Art oder ein Zustand wirkt gar nicht.', { de: 'Immunität' }),
    e('Cover', 'Deckung hinter Mauern, Bäumen oder anderen Wesen. Half Cover: +2 auf AC und Dex Saves. Three-Quarters Cover: +5. Total Cover: Du kannst nicht direkt anvisiert werden.', { de: 'Deckung' }),
    e('Difficult Terrain', 'Gestrüpp, Schutt, tiefer Schnee: Jeder Fuß Bewegung kostet einen extra. Ein Feld kostet also 10 ft statt 5.', { de: 'Schwieriges Gelände' }),
    e('Unarmed Strike', 'Schlag, Tritt, Kopfnuss: 1 + Strength Modifier Schaden. Damit kannst du auch packen (Grapple) oder stoßen (Shove).', { de: 'Waffenloser Angriff' }),
    e('Grapple', 'Statt Schaden packst du ein Ziel: Es macht einen Strength- oder Dexterity Save gegen DC 8 + dein Strength Modifier + Proficiency Bonus. Scheitert es, ist es Grappled.', { de: 'Packen' }),
    e('Shove', 'Statt Schaden stößt du ein Ziel 5 ft weg oder wirfst es um (Prone). Gleicher Save wie beim Grapple.', { de: 'Stoßen' }),
    e('Two-Weapon Fighting', 'Mit einer Light-Waffe in jeder Hand: Nach dem Angriff mit der einen darfst du mit der anderen als Bonus Action angreifen, ohne Modifier auf den Schaden.', { de: 'Kampf mit zwei Waffen' }),
    e('Death Saving Throw', 'Bei 0 HP würfelst du zu Beginn jedes Zuges einen d20: 10 oder mehr ist ein Erfolg. 3 Erfolge: stabil. 3 Fehlschläge: tot. Natürliche 20: sofort 1 HP. Natürliche 1: zwei Fehlschläge. Schaden bei 0 HP: ein Fehlschlag.', { de: 'Todesrettungswurf', a: 'Death Save' }),
    e('Stabilize', 'Ein bewusstloser Verbündeter hört auf zu sterben: Help Action mit Wisdom (Medicine), DC 10, oder jede Heilung.', { de: 'Stabilisieren' }),
    e('Massive Damage', 'Bleibt nach dem Fall auf 0 HP noch so viel Schaden übrig wie deine maximalen HP, stirbst du sofort.', { de: 'Massiver Schaden' }),
    e('Challenge Rating', 'Wie gefährlich ein Monster ist. Eine Gruppe von vier Stufe-1-Charakteren schafft gut Monster bis CR 1/2, einzeln auch CR 1.', { de: 'Herausforderungsgrad', a: 'CR, HG' }),
    e('Stat Block', 'Der Steckbrief eines Monsters: AC, HP, Speed, Attribute, Angriffe und Fähigkeiten.', { de: 'Werteblock' }),
    e('Multiattack', 'Ein Monster greift mit einer Action mehrmals an.', { de: 'Mehrfachangriff' }),
    e('Extra Attack', 'Ab Stufe 5 greifen Kampfklassen mit der Attack Action zweimal an.', { de: 'Zusätzlicher Angriff' }),
  ] },
  { id: 'magie', icon: '✨', title: 'Magie', intro: 'Was die Begriffe auf einer Zauberkarte bedeuten.', entries: [
    e('Spell', 'Ein Zauber. Wirken kostet meist eine Magic Action und, außer bei Cantrips, einen Spell Slot.', { de: 'Zauber' }),
    e('Cantrip', 'Ein Zauber der Stufe 0. Kostet keinen Slot, beliebig oft. Wird auf Stufe 5, 11 und 17 stärker.', { de: 'Zaubertrick' }),
    e('Spell Level', 'Wie mächtig ein Zauber ist, 1 bis 9. Hat nichts mit deiner Charakterstufe zu tun.', { de: 'Zaubergrad' }),
    e('Spell Slot', 'Deine Zauberenergie. Ein Zauber der Stufe 1 braucht einen Slot der Stufe 1 oder höher. Nach einem Long Rest sind alle wieder da.', { de: 'Zauberplatz', a: 'Slot' }),
    e('Upcasting', 'Einen Zauber mit einem höheren Slot wirken. Viele werden dadurch stärker, z. B. mehr Schaden oder mehr Ziele.', { de: 'Höher wirken' }),
    e('Pact Magic', 'Die Magie des Warlocks: wenige Slots, immer auf der höchsten Stufe, und sie kommen schon nach einem Short Rest zurück.', { de: 'Paktmagie' }),
    e('Spellcasting Ability', 'Das Attribut, mit dem du zauberst: Intelligence (Wizard), Wisdom (Cleric, Druid, Ranger) oder Charisma (Bard, Paladin, Sorcerer, Warlock).', { de: 'Zauberattribut' }),
    e('Spell Save DC', 'Die Zahl, die ein Ziel mit seinem Save gegen deinen Zauber schaffen muss: 8 + Proficiency Bonus + Zauber-Modifier.', { de: 'Zauber-SG', a: 'Spell DC' }),
    e('Spell Attack', 'Dein Bonus bei Zaubern mit Angriffswurf, z. B. Fire Bolt: Proficiency Bonus + Zauber-Modifier.', { de: 'Zauberangriff' }),
    e('Concentration', 'Manche Zauber halten nur, solange du dich konzentrierst. Nur ein solcher Zauber gleichzeitig. Nimmst du Schaden: Constitution Save, DC 10 oder halber Schaden, je nachdem was höher ist (höchstens DC 30). Bei 0 HP oder Incapacitated endet er.', { de: 'Konzentration', a: 'Conc, K' }),
    e('Casting Time', 'Wie lange das Wirken dauert: Action, Bonus Action, Reaction oder Minuten.', { de: 'Zeitaufwand' }),
    e('Duration', 'Wie lange der Zauber wirkt: sofort (Instantaneous), Runden, Minuten oder Stunden.', { de: 'Wirkungsdauer' }),
    e('Range', 'Wie weit der Zauber reicht. Self heißt: von dir aus, Touch: Berührung.', { de: 'Reichweite' }),
    e('Components', 'Was du zum Zaubern brauchst: V (Verbal) sprechen, S (Somatic) gestikulieren, M (Material) ein Gegenstand. Ein Arcane Focus oder Holy Symbol ersetzt Materialien ohne Preis.', { de: 'Komponenten', a: 'V, S, M' }),
    e('Ritual', 'Zauber mit dem Tag Ritual kannst du ohne Slot wirken, wenn du dir 10 Minuten mehr Zeit nimmst.', { de: 'Ritual' }),
    e('Area of Effect', 'Der Zauber trifft eine Fläche statt eines Ziels: Cone (Kegel), Cube (Würfel), Cylinder (Zylinder), Emanation (um dich herum), Line (Linie), Sphere (Kugel).', { de: 'Wirkungsbereich', a: 'AoE' }),
    e('Prepared Spells', 'Die Zauber, die du gerade wirken kannst. Viele Klassen dürfen nach einem Long Rest tauschen.', { de: 'Vorbereitete Zauber' }),
    e('Spellbook', 'Das Buch des Wizards mit allen Zaubern, die er kennt.', { de: 'Zauberbuch' }),
    e('Ein Slot pro Zug', 'Pro Zug darfst du nur einen Zauber mit Spell Slot wirken. Ein Cantrip zusätzlich geht.', { de: 'Regel 2024' }),
  ] },
  { id: 'zustaende', icon: '🩹', title: 'Zustände', intro: 'Conditions: Was mit einem Charakter los ist. In der App unter „Zustände“ einstellbar.', entries: [
    ...CONDITIONS.map(c => e(c.name, c.desc)),
    e('Exhaustion', EXHAUSTION_DESC, { de: 'Erschöpfung' }),
  ] },
  { id: 'erkunden', icon: '🏕️', title: 'Rasten & Erkunden', intro: 'Alles außerhalb des Kampfes: Pausen, Licht, Verstecken, Reisen.', entries: [
    e('Short Rest', 'Eine Stunde Pause. Du kannst Hit Dice ausgeben, um dich zu heilen. Manche Fähigkeiten und die Slots des Warlocks kommen zurück.', { de: 'Kurze Rast' }),
    e('Long Rest', 'Mindestens 8 Stunden, davon 6 Schlaf. Danach: alle HP, alle Spell Slots, alle Hit Dice, Exhaustion −1. Höchstens einer pro Tag.', { de: 'Lange Rast' }),
    e('Darkvision', 'Im Dunkeln siehst du bis zur angegebenen Entfernung wie im Dämmerlicht, aber nur in Grautönen.', { de: 'Dunkelsicht' }),
    e('Light', 'Hell: normale Sicht. Dämmerlicht (Dim Light): Disadvantage auf Perception mit den Augen. Dunkelheit: Du bist praktisch Blinded.', { de: 'Licht' }),
    e('Hide', 'Eine Action: Dexterity (Stealth) gegen DC 15. Geht nur, wenn dich niemand sieht. Geschafft heißt: du bist Invisible, bis du Lärm machst, angreifst oder gesehen wirst.', { de: 'Verstecken' }),
    e('Falling', '1d6 Bludgeoning Schaden pro 10 ft, höchstens 20d6. Danach liegst du Prone.', { de: 'Fallen' }),
    e('Jumping', 'Weitsprung mit Anlauf: so viele Fuß wie dein Strength-Wert. Hochsprung: 3 + Strength Modifier Fuß.', { de: 'Springen' }),
    e('Carrying', 'Du kannst etwa Strength × 15 Pfund tragen.', { de: 'Tragen' }),
    e('Tools', 'Werkzeuge wie Thieves’ Tools oder Herbalism Kit. Bist du geübt, kommt dein Proficiency Bonus auf den Check.', { de: 'Werkzeuge' }),
    e('Gold Pieces', 'Währung: 1 gp = 10 sp = 100 cp. Platin (pp) ist 10 gp wert, Elektrum (ep) 5 sp.', { de: 'Goldmünzen', a: 'gp, sp, cp, ep, pp' }),
    e('Feet', 'Entfernungen stehen in Fuß. 5 ft sind ungefähr 1,5 m und ein Feld auf der Karte.', { de: 'Fuß', a: 'ft' }),
  ] },
  { id: 'tisch', icon: '🗣️', title: 'Am Tisch & Abkürzungen', intro: 'Wörter, die man in Runden, Videos und Foren ständig hört.', entries: [
    e('Dungeon Master', 'Leitet das Spiel: beschreibt die Welt, spielt alle NPCs und Monster, entscheidet Regelfragen.', { de: 'Spielleiter', a: 'DM, GM, SL' }),
    e('Player Character', 'Ein Charakter, den ein Spieler spielt.', { de: 'Spielercharakter', a: 'PC, SC' }),
    e('Non-Player Character', 'Jede Figur, die der DM spielt: Wirt, Händler, Bösewicht.', { de: 'Nichtspielercharakter', a: 'NPC, NSC' }),
    e('Party', 'Die Gruppe der Spielercharaktere.', { de: 'Gruppe' }),
    e('Big Bad Evil Guy', 'Der Hauptschurke der Kampagne.', { a: 'BBEG' }),
    e('Total Party Kill', 'Die ganze Gruppe stirbt.', { a: 'TPK' }),
    e('Campaign', 'Eine zusammenhängende Geschichte über viele Abende.', { de: 'Kampagne' }),
    e('Session', 'Ein Spielabend.', { de: 'Sitzung' }),
    e('One-Shot', 'Ein Abenteuer, das an einem Abend fertig wird.', {}),
    e('Session Zero', 'Ein Abend vor dem Start: Charaktere bauen, Erwartungen klären, Grenzen absprechen.', { de: 'Sitzung null' }),
    e('Lines & Veils', 'Sicherheitswerkzeug. Lines: Themen, die gar nicht vorkommen. Veils: Themen, die nur angedeutet und ausgeblendet werden.', { de: 'Grenzen & Schleier' }),
    e('X-Card', 'Eine Karte auf dem Tisch. Tippt jemand darauf, wird die Szene ohne Erklärung geändert.', {}),
    e('Encounter', 'Eine Begegnung: ein Kampf, ein Gespräch, eine Falle oder ein Rätsel.', { de: 'Begegnung' }),
    e('Loot', 'Beute: Gold, Ausrüstung, magische Gegenstände.', { de: 'Beute' }),
    e('Homebrew', 'Selbst ausgedachte Regeln, Monster oder Gegenstände.', { de: 'Eigenbau' }),
    e('House Rule', 'Eine Regel, die eure Gruppe anders macht als das Buch.', { de: 'Hausregel' }),
    e('Rules as Written', 'Was genau im Regelbuch steht. Rules as Intended (RAI): was wohl gemeint war.', { a: 'RAW, RAI' }),
    e('Rule of Cool', 'Ist es cool genug, erlaubt der DM es auch, wenn die Regeln es nicht ganz hergeben.', {}),
    e('Metagaming', 'Wissen nutzen, das nur der Spieler hat, nicht der Charakter. Gilt als unfair.', { x: '„Ich weiß, dass Trolle Feuer hassen.“ Dein Charakter hat noch nie einen Troll gesehen.' }),
    e('In Character', 'Als dein Charakter sprechen. Out of Character (OOC): als du selbst.', { a: 'IC, OOC' }),
    e('Railroading', 'Der DM zwingt die Gruppe auf einen festen Weg.', {}),
    e('Sandbox', 'Offene Welt, die Gruppe entscheidet selbst, wohin sie geht.', {}),
    e('Murderhobo', 'Spitzname für Charaktere, die alles angreifen und alles mitnehmen.', {}),
    e('Min-Maxing', 'Einen Charakter so bauen, dass er in einer Sache extrem stark ist.', {}),
    e('Player’s Handbook', 'Das Spielerhandbuch mit allen Regeln für Charaktere.', { a: 'PHB' }),
    e('Dungeon Master’s Guide', 'Das Buch für Spielleiter.', { a: 'DMG' }),
    e('Monster Manual', 'Das Monsterbuch.', { a: 'MM' }),
    e('System Reference Document', 'Die kostenlosen Grundregeln von D&D. Version 5.2 gehört zu den Regeln von 2024.', { a: 'SRD' }),
  ] },
];

// search for the lookup box on the Spieltisch: exact abbreviations first ("AC"), then words anywhere
export function searchWiki(q, limit = 6) {
  const ql = norm(q.trim()); if (!ql) return [];
  const all = SECTIONS.flatMap(sec => sec.entries.map(x => ({ ...x, icon: sec.icon, sec: sec.title })));
  const abbrOf = x => (x.a || '').split(',').map(v => norm(v.replace(/\s*\(.*\)/, '').trim()));
  const score = x => (abbrOf(x).includes(ql) ? 0 : norm(x.t) === ql || norm(x.de) === ql ? 1 : norm(x.t).startsWith(ql) || norm(x.de).startsWith(ql) ? 2
    : [x.t, x.de, x.a].some(v => norm(v).includes(ql)) ? 3 : [x.d, x.x].some(v => norm(v).includes(ql)) ? 4 : 9);
  const found = all.map(x => [score(x), x]).filter(([n]) => n < 9).sort((m, n) => m[0] - n[0]);
  const best = found.some(([n]) => n === 0) ? found.filter(([n]) => n === 0) : found; // "AC" means Armor Class, not every word with "ac"
  return best.slice(0, limit).map(([, x]) => x);
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function WikiPage({ section }) {
  const [q, setQ] = useState('');
  const ql = norm(q.trim());
  useEffect(() => { if (section) setTimeout(() => document.getElementById('w-' + section)?.scrollIntoView({ block: 'start' }), 50); }, [section]);
  const abbrs = useMemo(() => { const seen = new Map();
    for (const sec of SECTIONS) if (sec.id !== 'skills') for (const x of sec.entries) if (x.a && !/…|XdY/.test(x.a))
      for (const a of x.a.split(',').map(v => v.replace(/\s*\(.*\)/, '').trim())) if (a && a.length <= 6 && !seen.has(a)) seen.set(a, x.t);
    return [...seen].map(([a, t]) => ({ a, t })).sort((m, n) => m.a.localeCompare(n.a, 'de')); }, []);
  const abbrOf = x => (x.a || '').split(',').map(v => norm(v.replace(/\s*\(.*\)/, '').trim()));
  const exact = ql && SECTIONS.some(sec => sec.entries.some(x => abbrOf(x).includes(ql))); // "AC" finds Armor Class, not every word with "ac"
  const hit = x => !ql || (exact ? abbrOf(x).includes(ql) : [x.t, x.a, x.de, x.d, x.x].some(v => norm(v).includes(ql)));
  const shown = SECTIONS.map(s => ({ ...s, entries: s.entries.filter(hit) })).filter(s => s.entries.length);
  const turnHit = !ql || !exact && ['dein zug', 'action', 'bonus action', 'reaction', 'bewegung', 'dash', 'dodge', 'disengage', 'help', 'hide', 'ready', 'search', 'study', 'utilize', 'influence', 'magic', 'attack'].some(w => w.includes(ql) || ql.includes(w));
  return html`<main class="page wiki"><a class="link crumb" href="#/spiel">← Spieltisch</a>
    <section class="hero"><div class="hero-id"><span class="label">📖 Wiki</span><h1>Begriffe & Regeln</h1>
      <p class="lede">Alles, was am Tisch an Wörtern und Abkürzungen fällt, kurz auf Deutsch erklärt. Nach den Regeln von 2024.</p></div></section>
    <div class="wiki-search"><input type="search" value=${q} onInput=${e => setQ(e.target.value)} placeholder="Suchen: AC, Concentration, Vorteil, Prone …" aria-label="Wiki durchsuchen"/></div>
    ${!ql && html`<nav class="wiki-toc" aria-label="Abschnitte"><a href="#/wiki/zug">🧭 Dein Zug</a>${SECTIONS.map(s => html`<a href=${'#/wiki/' + s.id}>${s.icon} ${s.title}</a>`)}</nav>
      <details class="panel box wiki-abbr" open=${innerWidth > 700}><summary><h2>Abkürzungen auf einen Blick</h2><span class="sub">${abbrs.length}</span></summary>
        <div class="abbr-chips">${abbrs.map(x => html`<button class="abbr" onClick=${() => setQ(x.a)} title=${x.t}><b>${x.a}</b><span>${x.t}</span></button>`)}</div></details>`}
    ${turnHit && html`<section class="panel box wiki-sec" id="w-zug"><div class="box-head"><h2>🧭 Dein Zug</h2><span class="sub">Spickzettel für den Kampf</span></div><${TurnSheet}/></section>`}
    ${shown.map(s => html`<section class="panel box wiki-sec" id=${'w-' + s.id}><div class="box-head"><h2>${s.icon} ${s.title}</h2></div>
      ${!ql && s.intro && html`<p class="muted">${s.intro}</p>`}
      <dl class="wiki-list">${s.entries.map(x => html`<div class="w-entry"><dt><b>${x.t}</b>${x.a && html`<span class="w-abbr">${x.a}</span>`}${x.de && html`<span class="w-de">${x.de}</span>`}</dt>
        <dd>${x.d}${x.x && html`<span class="w-ex">${x.x}</span>`}</dd></div>`)}</dl></section>`)}
    ${ql && !shown.length && !turnHit && html`<p class="muted">Nichts gefunden zu „${q}“. Frag im Zweifel einfach deinen DM.</p>`}
  </main>`;
}
