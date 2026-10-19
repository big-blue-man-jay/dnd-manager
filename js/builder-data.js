// Data for the guided character builder (D&D 2024, level 1). German explanations, English game terms.

// order = recommended Standard Array placement (15, 14, 13, 12, 10, 8)
export const CLASS_INFO = {
  Fighter:   { diff: 1, role: 'Nahkampf · Fernkampf', pitch: 'Meister aller Waffen und Rüstungen. Robust und zuverlässig, perfekt zum Einstieg.', play: 'Angreifen, mit Second Wind selbst heilen, ab Stufe 2 mit Action Surge einen Extra-Zug nehmen.',
    order: ['str', 'con', 'dex', 'wis', 'cha', 'int'], skills: [2, ['athletics', 'perception', 'intimidation', 'acrobatics', 'animal', 'history', 'insight', 'persuasion', 'survival']],
    armor: { name: 'Chain Mail', ac: () => 16 }, weapons: [{ name: 'Greatsword', die: '2d6', ab: 'str', note: 'slashing, heavy, two-handed' }], feats: 'Fighting Style, Second Wind, Weapon Mastery' },
  Barbarian: { diff: 1, role: 'Nahkampf · steckt viel ein', pitch: 'Wütende Kämpferin oder wütender Kämpfer. Schlägt mit purer Kraft zu und hält unglaublich viel aus.', play: 'Rage aktivieren, nach vorne stürmen, kräftig zuschlagen. Wenig zu merken, viel Spaß.',
    order: ['str', 'con', 'dex', 'wis', 'cha', 'int'], skills: [2, ['athletics', 'perception', 'intimidation', 'survival', 'animal', 'nature']],
    armor: { name: 'ohne Rüstung (Unarmored Defense)', ac: m => 10 + m.dex + m.con }, weapons: [{ name: 'Greataxe', die: '1d12', ab: 'str', note: 'slashing, heavy, two-handed' }], feats: 'Rage, Unarmored Defense, Weapon Mastery' },
  Rogue:     { diff: 1, role: 'Schleichen · Fallen · Schaden', pitch: 'Spezialist für alles Heimliche: schleicht, knackt Schlösser und trifft mit Sneak Attack richtig hart.', play: 'Aus dem Versteck zuschlagen, Fallen finden, im Gespräch tricksen.',
    order: ['dex', 'con', 'wis', 'int', 'cha', 'str'], skills: [4, ['stealth', 'perception', 'sleight', 'acrobatics', 'deception', 'insight', 'investigation', 'persuasion', 'athletics', 'intimidation']],
    armor: { name: 'Leather Armor', ac: m => 11 + m.dex }, weapons: [{ name: 'Shortsword', die: '1d6', ab: 'dex', note: 'piercing, finesse, light' }, { name: 'Shortbow', die: '1d6', ab: 'dex', note: 'piercing, 80/320 ft' }], feats: "Expertise, Sneak Attack (1d6), Thieves' Cant, Weapon Mastery" },
  Ranger:    { diff: 2, role: 'Fernkampf · Natur', pitch: 'Jägerin oder Jäger und Spurenleser, tödlich mit dem Bogen, mit etwas Naturmagie.', play: "Mit Hunter's Mark ein Ziel markieren, aus der Distanz schießen, Spuren lesen.",
    order: ['dex', 'wis', 'con', 'str', 'int', 'cha'], skills: [3, ['perception', 'stealth', 'survival', 'nature', 'animal', 'athletics', 'insight', 'investigation']],
    armor: { name: 'Studded Leather', ac: m => 12 + m.dex }, weapons: [{ name: 'Longbow', die: '1d8', ab: 'dex', note: 'piercing, 150/600 ft' }, { name: 'Shortsword', die: '1d6', ab: 'dex', note: 'piercing, finesse, light' }], feats: 'Spellcasting, Favored Enemy, Weapon Mastery' },
  Paladin:   { diff: 2, role: 'Nahkampf · Heilung · Schutz', pitch: 'Heiliger Ritter, gebunden an einen Eid. Schwere Rüstung, Schild und heilende Hände.', play: 'Vorne kämpfen, Verbündete mit Lay On Hands heilen, ab Stufe 2 mit Divine Smite zuschlagen.',
    order: ['str', 'cha', 'con', 'wis', 'dex', 'int'], skills: [2, ['athletics', 'persuasion', 'intimidation', 'insight', 'medicine', 'religion']],
    armor: { name: 'Chain Mail + Shield', ac: () => 18 }, weapons: [{ name: 'Longsword', die: '1d8', ab: 'str', note: 'slashing, versatile' }], feats: 'Lay On Hands, Spellcasting, Weapon Mastery' },
  Cleric:    { diff: 2, role: 'Heilung · Unterstützung', pitch: 'Diener einer Gottheit. Heilt die Gruppe und schützt sie mit göttlicher Macht.', play: 'Heilen, segnen, mit Streitkolben und Schild mitten im Geschehen stehen.',
    order: ['wis', 'con', 'str', 'dex', 'cha', 'int'], skills: [2, ['insight', 'medicine', 'persuasion', 'history', 'religion']],
    armor: { name: 'Chain Shirt + Shield', ac: m => 13 + Math.min(2, m.dex) + 2 }, weapons: [{ name: 'Mace', die: '1d6', ab: 'str', note: 'bludgeoning' }], feats: 'Spellcasting, Divine Order' },
  Monk:      { diff: 2, role: 'Nahkampf · flink', pitch: 'Kampfkünstler, der mit Fäusten und Tritten blitzschnell zuschlägt, ganz ohne Rüstung.', play: 'Viele schnelle Schläge, flink übers Feld, ab Stufe 2 Focus Points für Spezialtechniken.',
    order: ['dex', 'wis', 'con', 'str', 'cha', 'int'], skills: [2, ['acrobatics', 'stealth', 'athletics', 'insight', 'history', 'religion']],
    armor: { name: 'ohne Rüstung (Unarmored Defense)', ac: m => 10 + m.dex + m.wis }, weapons: [{ name: 'Unarmed Strike', die: '1d6', ab: 'dex', note: 'bludgeoning, Martial Arts' }, { name: 'Spear', die: '1d6', ab: 'dex', note: 'piercing, Monk weapon' }], feats: 'Martial Arts, Unarmored Defense' },
  Bard:      { diff: 2, role: 'Unterstützung · Magie · Reden', pitch: 'Musiker und Charmeur. Stärkt Freunde mit Magie und Worten, glänzt in jedem Gespräch.', play: 'Bardic Inspiration verteilen, heilen, Gegner verwirren, Leute um den Finger wickeln.',
    order: ['cha', 'dex', 'con', 'wis', 'int', 'str'], skills: [3, ['persuasion', 'deception', 'performance', 'insight', 'perception', 'stealth', 'acrobatics', 'arcana', 'history', 'intimidation', 'investigation', 'medicine', 'nature', 'religion', 'sleight', 'survival', 'animal', 'athletics']],
    armor: { name: 'Leather Armor', ac: m => 11 + m.dex }, weapons: [{ name: 'Dagger', die: '1d4', ab: 'dex', note: 'piercing, finesse, light, thrown 20/60 ft' }], feats: 'Bardic Inspiration, Spellcasting' },
  Warlock:   { diff: 2, role: 'Magie · Schaden', pitch: 'Hat einen Pakt mit einem mächtigen Wesen geschlossen und bekommt dafür unheimliche Kräfte.', play: 'Eldritch Blast schießen, Gegner verfluchen. Wenige Zauber, die sich schon bei einer Short Rest erholen.',
    order: ['cha', 'con', 'dex', 'wis', 'int', 'str'], skills: [2, ['deception', 'arcana', 'intimidation', 'investigation', 'history', 'nature', 'religion']],
    armor: { name: 'Leather Armor', ac: m => 11 + m.dex }, weapons: [{ name: 'Dagger', die: '1d4', ab: 'dex', note: 'piercing, finesse, light, thrown 20/60 ft' }], feats: 'Eldritch Invocations, Pact Magic' },
  Sorcerer:  { diff: 3, role: 'Magie · Schaden', pitch: 'Die Magie liegt dir im Blut. Weniger Zauber als ein Wizard, aber du kannst sie verbiegen.', play: 'Mächtige Zauber aus der Distanz, ab Stufe 2 Metamagic.',
    order: ['cha', 'con', 'dex', 'wis', 'int', 'str'], skills: [2, ['persuasion', 'arcana', 'deception', 'insight', 'intimidation', 'religion']],
    armor: { name: 'ohne Rüstung', ac: m => 10 + m.dex }, weapons: [{ name: 'Dagger', die: '1d4', ab: 'dex', note: 'piercing, finesse, light, thrown 20/60 ft' }], feats: 'Spellcasting, Innate Sorcery' },
  Druid:     { diff: 3, role: 'Magie · Natur · Heilung', pitch: 'Hüter der Natur. Wirkt Naturmagie und kann sich ab Stufe 2 in Tiere verwandeln.', play: 'Naturzauber wirken, heilen, Gegner festhalten, später Wild Shape.',
    order: ['wis', 'con', 'dex', 'int', 'cha', 'str'], skills: [2, ['perception', 'nature', 'animal', 'insight', 'medicine', 'arcana', 'religion', 'survival']],
    armor: { name: 'Leather Armor + Shield', ac: m => 11 + m.dex + 2 }, weapons: [{ name: 'Quarterstaff', die: '1d6', ab: 'str', note: 'bludgeoning, versatile' }], feats: 'Spellcasting, Druidic, Primal Order' },
  Wizard:    { diff: 3, role: 'Magie · vielseitig', pitch: 'Gelehrter Magier mit dem dicksten Zauberbuch. Zerbrechlich, aber für jede Lage gerüstet.', play: 'Jeden Tag die passenden Zauber vorbereiten und das Problem mit Köpfchen lösen.',
    order: ['int', 'con', 'dex', 'wis', 'cha', 'str'], skills: [2, ['arcana', 'investigation', 'history', 'insight', 'medicine', 'nature', 'religion']],
    armor: { name: 'ohne Rüstung', ac: m => 10 + m.dex }, weapons: [{ name: 'Quarterstaff', die: '1d6', ab: 'str', note: 'bludgeoning, versatile' }], feats: 'Spellcasting, Ritual Adept, Arcane Recovery' },
};
export const DIFF = ['', 'Einsteigerfreundlich', 'Etwas mehr zu merken', 'Für Tüftler'];

export const SPECIES_INFO = {
  Human:      { speed: 30, pitch: 'Anpassungsfähig und ehrgeizig. Bekommt einen zusätzlichen Skill und ein zusätzliches Origin Feat.', traits: 'Resourceful (Heroic Inspiration nach jeder Long Rest), Skillful (+1 Skill), Versatile (+1 Origin Feat)', extraSkill: 1 },
  Elf:        { speed: 30, pitch: 'Anmutig und wachsam, mit Feenblut. Schläft nicht, sondern meditiert.', traits: 'Darkvision, Elven Lineage, Fey Ancestry (Advantage gegen Charmed), Keen Senses, Trance' },
  Dwarf:      { speed: 30, pitch: 'Zäh und robust, sieht im Dunkeln sehr weit. Mehr Hit Points als andere.', traits: 'Darkvision 120 ft, Dwarven Resilience (Resistenz gegen Poison), Dwarven Toughness (+1 HP pro Stufe), Stonecunning', hpPerLevel: 1 },
  Halfling:   { speed: 30, pitch: 'Klein, mutig und unverschämt glücklich. Würfelt eine 1 einfach neu.', traits: 'Brave, Halfling Nimbleness, Luck (eine natürliche 1 neu würfeln), Naturally Stealthy' },
  Orc:        { speed: 30, pitch: 'Stark und ausdauernd. Steht wieder auf, wenn andere liegen bleiben.', traits: 'Adrenaline Rush, Darkvision 120 ft, Relentless Endurance (einmal pro Long Rest bei 0 HP auf 1 HP)' },
  Dragonborn: { speed: 30, pitch: 'Drachenblütig, mit einer Odemwaffe aus Feuer, Eis, Blitz, Säure oder Gift.', traits: 'Draconic Ancestry, Breath Weapon, Damage Resistance, Darkvision' },
  Tiefling:   { speed: 30, pitch: 'Mit höllischem Erbe: Hörner, Schwanz und ein bisschen Magie im Blut.', traits: 'Darkvision, Fiendish Legacy (Zauber und Resistenz), Otherworldly Presence' },
  Gnome:      { speed: 30, pitch: 'Klein, schlau und neugierig. Schwer mit Magie zu beeinflussen.', traits: 'Darkvision, Gnomish Cunning (Advantage auf INT-, WIS- und CHA-Saves), Gnomish Lineage' },
  Goliath:    { speed: 35, pitch: 'Riesenblut in den Adern. Groß, stark und schnell.', traits: 'Giant Ancestry, Large Form (ab Stufe 5), Powerful Build' },
  Aasimar:    { speed: 30, pitch: 'Ein Mensch mit himmlischem Funken. Kann heilen und leuchten.', traits: 'Celestial Resistance (Necrotic, Radiant), Darkvision, Healing Hands, Light Bearer' },
};

export const FEATS = {
  Alert: 'Proficiency Bonus auf Initiative, und du kannst die Initiative mit einem Verbündeten tauschen.',
  Crafter: 'Drei Sätze Handwerkszeug, 20 % Rabatt auf normale Gegenstände, schnelles Herstellen.',
  Healer: "Mit einem Healer's Kit Verbündete besser heilen.",
  Lucky: 'Glückspunkte: Advantage für dich oder Disadvantage für einen Angreifer.',
  'Magic Initiate': 'Zwei Cantrips und ein Zauber der 1. Stufe aus einer anderen Liste.',
  Musician: 'Drei Instrumente. Nach einer Rast gibst du Verbündeten Heroic Inspiration.',
  'Savage Attacker': 'Einmal pro Zug Waffenschaden doppelt würfeln und das bessere Ergebnis nehmen.',
  Skilled: 'Drei zusätzliche Skills oder Werkzeuge nach Wahl.',
  'Tavern Brawler': 'Stärkere Faustschläge, improvisierte Waffen, Gegner wegschubsen.',
  Tough: '+2 Hit Points pro Stufe.',
};

// ability scores the background can raise, origin feat, 2 skills, tool (2024 Player's Handbook)
export const BACKGROUNDS = {
  Acolyte:     { abs: ['int', 'wis', 'cha'], feat: 'Magic Initiate', featNote: 'Cleric', skills: ['insight', 'religion'], tool: "Calligrapher's Supplies", pitch: 'Hat im Tempel gedient und kennt Rituale und Gebete.' },
  Artisan:     { abs: ['str', 'dex', 'int'], feat: 'Crafter', skills: ['investigation', 'persuasion'], tool: "Artisan's Tools nach Wahl", pitch: 'Kommt aus einer Werkstatt: Schmied, Schreiner, Juwelier …' },
  Charlatan:   { abs: ['dex', 'con', 'cha'], feat: 'Skilled', skills: ['deception', 'sleight'], tool: 'Forgery Kit', pitch: 'Betrüger mit tausend Gesichtern und gefälschten Papieren.' },
  Criminal:    { abs: ['dex', 'con', 'int'], feat: 'Alert', skills: ['sleight', 'stealth'], tool: "Thieves' Tools", pitch: 'Hat sich als Dieb, Einbrecher oder Schmuggler durchgeschlagen.' },
  Entertainer: { abs: ['str', 'dex', 'cha'], feat: 'Musician', skills: ['acrobatics', 'performance'], tool: 'Musikinstrument nach Wahl', pitch: 'Gaukler, Musiker oder Schauspieler, immer auf der Bühne.' },
  Farmer:      { abs: ['str', 'con', 'wis'], feat: 'Tough', skills: ['animal', 'nature'], tool: "Carpenter's Tools", pitch: 'Vom Bauernhof, harte Arbeit und frühes Aufstehen gewohnt.' },
  Guard:       { abs: ['str', 'int', 'wis'], feat: 'Alert', skills: ['athletics', 'perception'], tool: 'Spielset nach Wahl', pitch: 'Hat Stadttore und Mauern bewacht. Nichts entgeht dir.' },
  Guide:       { abs: ['dex', 'con', 'wis'], feat: 'Magic Initiate', featNote: 'Druid', skills: ['stealth', 'survival'], tool: "Cartographer's Tools", pitch: 'Führer durch Wildnis und Berge, kennt jeden Pfad.' },
  Hermit:      { abs: ['con', 'wis', 'cha'], feat: 'Healer', skills: ['medicine', 'religion'], tool: 'Herbalism Kit', pitch: 'Hat lange zurückgezogen in der Einsamkeit gelebt.' },
  Merchant:    { abs: ['con', 'int', 'cha'], feat: 'Lucky', skills: ['animal', 'persuasion'], tool: "Navigator's Tools", pitch: 'Händler, der den Wert jeder Sache kennt.' },
  Noble:       { abs: ['str', 'int', 'cha'], feat: 'Skilled', skills: ['history', 'persuasion'], tool: 'Spielset nach Wahl', pitch: 'Aus adligem Haus, mit Manieren und Verbindungen.' },
  Sage:        { abs: ['con', 'int', 'wis'], feat: 'Magic Initiate', featNote: 'Wizard', skills: ['arcana', 'history'], tool: "Calligrapher's Supplies", pitch: 'Gelehrter, der Jahre in Bibliotheken verbracht hat.' },
  Sailor:      { abs: ['str', 'dex', 'wis'], feat: 'Tavern Brawler', skills: ['acrobatics', 'perception'], tool: "Navigator's Tools", pitch: 'Hat auf Schiffen gearbeitet und jeden Hafen gesehen.' },
  Scribe:      { abs: ['dex', 'int', 'wis'], feat: 'Skilled', skills: ['investigation', 'perception'], tool: "Calligrapher's Supplies", pitch: 'Schreiber und Kopist, dem kein Detail entgeht.' },
  Soldier:     { abs: ['str', 'dex', 'con'], feat: 'Savage Attacker', skills: ['athletics', 'intimidation'], tool: 'Spielset nach Wahl', pitch: 'Hat in einer Armee gedient und Schlachten überlebt.' },
  Wayfarer:    { abs: ['dex', 'wis', 'cha'], feat: 'Lucky', skills: ['insight', 'stealth'], tool: "Thieves' Tools", pitch: 'Auf der Straße aufgewachsen, schlägt sich überall durch.' },
};

export const ABILITY_DESC = {
  str: 'Kraft: Nahkampf mit schweren Waffen, klettern, schieben, tragen.',
  dex: 'Geschick: Fernkampf, leichte Waffen, ausweichen, schleichen. Erhöht oft die Armor Class.',
  con: 'Ausdauer: mehr Hit Points, Konzentration auf Zauber halten.',
  int: 'Verstand: Wissen und Logik, Magie des Wizards.',
  wis: 'Weisheit: Wahrnehmung und Bauchgefühl, Magie von Cleric, Druid und Ranger.',
  cha: 'Ausstrahlung: überzeugen, lügen, Magie von Bard, Sorcerer, Warlock und Paladin.',
};

export const SKILL_DESC = {
  acrobatics: 'Balancieren, Saltos, sich aus Griffen winden', animal: 'Tiere beruhigen, reiten, lenken', arcana: 'Wissen über Magie und magische Wesen',
  athletics: 'Klettern, springen, schwimmen, ringen', deception: 'Lügen und täuschen', history: 'Wissen über Geschichte, Kriege und Königreiche',
  insight: 'Merken, ob jemand lügt oder was er fühlt', intimidation: 'Einschüchtern und drohen', investigation: 'Hinweise finden und kombinieren',
  medicine: 'Wunden versorgen, Krankheiten erkennen', nature: 'Wissen über Pflanzen, Tiere und Wetter', perception: 'Dinge bemerken: Geräusche, versteckte Gegner',
  performance: 'Musik, Tanz, Schauspiel', persuasion: 'Überzeugen und verhandeln', religion: 'Wissen über Götter, Rituale und Untote',
  sleight: 'Taschendiebstahl und Fingerfertigkeit', stealth: 'Schleichen und verstecken', survival: 'Spuren lesen, jagen, den Weg finden',
};

// suggested level 1 spells: [cantrip count, spell count, cantrips, level 1 spells]; the first ones are preselected
const S = (name, note) => ({ name, note });
export const SPELLS = {
  Bard: [2, 4, [S('Vicious Mockery', 'Magische Beleidigung: psychischer Schaden, Ziel greift schlechter an'), S('Minor Illusion', 'Ein Geräusch oder kleines Trugbild erschaffen'), S('Prestidigitation', 'Kleine Zaubertricks: säubern, wärmen, Funken')],
    [S('Healing Word', 'Heilt einen Verbündeten auf Entfernung, als Bonus Action'), S('Dissonant Whispers', 'Psychischer Schaden, das Ziel muss vor dir fliehen'), S('Charm Person', 'Ein Humanoider hält dich für einen Freund'), S('Faerie Fire', 'Gegner leuchten, Angriffe gegen sie mit Advantage'), S('Thunderwave', 'Donnerwelle, die Gegner wegstößt')]],
  Cleric: [3, 4, [S('Sacred Flame', 'Heiliges Feuer von oben, Dexterity Save'), S('Guidance', '+1d4 auf einen Ability Check eines Verbündeten'), S('Thaumaturgy', 'Kleine göttliche Wunder: Donnerstimme, flackernde Flammen'), S('Light', 'Lässt einen Gegenstand leuchten wie eine Fackel')],
    [S('Cure Wounds', 'Heilt per Berührung'), S('Healing Word', 'Heilt auf Entfernung, als Bonus Action'), S('Bless', 'Bis zu drei Verbündete: +1d4 auf Angriffe und Saves'), S('Guiding Bolt', 'Lichtblitz mit viel Schaden, nächster Angriff auf das Ziel mit Advantage'), S('Shield of Faith', '+2 Armor Class für einen Verbündeten')]],
  Druid: [2, 4, [S('Produce Flame', 'Flamme in der Hand: Licht oder Feuerwurf'), S('Guidance', '+1d4 auf einen Ability Check eines Verbündeten'), S('Shillelagh', 'Dein Stab wird magisch und trifft härter')],
    [S('Cure Wounds', 'Heilt per Berührung'), S('Entangle', 'Ranken halten Gegner in einem Bereich fest'), S('Healing Word', 'Heilt auf Entfernung, als Bonus Action'), S('Thunderwave', 'Donnerwelle, die Gegner wegstößt'), S('Faerie Fire', 'Gegner leuchten, Angriffe gegen sie mit Advantage')]],
  Sorcerer: [4, 2, [S('Fire Bolt', 'Feuergeschoss auf große Entfernung'), S('Mage Hand', 'Schwebende Geisterhand trägt kleine Dinge'), S('Light', 'Lässt einen Gegenstand leuchten'), S('Prestidigitation', 'Kleine Zaubertricks'), S('Shocking Grasp', 'Blitz per Berührung, Ziel verliert seine Reaction')],
    [S('Magic Missile', 'Drei Geschosse, die immer treffen'), S('Shield', 'Reaction: +5 Armor Class bis zu deinem nächsten Zug'), S('Burning Hands', 'Flammenkegel vor dir'), S('Sleep', 'Lässt Gegner einschlafen')]],
  Warlock: [2, 2, [S('Eldritch Blast', 'Strahl aus Kraftenergie, dein Standardangriff'), S('Minor Illusion', 'Ein Geräusch oder kleines Trugbild erschaffen'), S('Mage Hand', 'Schwebende Geisterhand trägt kleine Dinge')],
    [S('Hex', 'Verflucht ein Ziel: Extra-Schaden bei jedem Treffer'), S('Armor of Agathys', 'Eisige Hülle: Temp HP, Angreifer bekommen Kälteschaden'), S('Charm Person', 'Ein Humanoider hält dich für einen Freund')]],
  Wizard: [3, 4, [S('Fire Bolt', 'Feuergeschoss auf große Entfernung'), S('Mage Hand', 'Schwebende Geisterhand trägt kleine Dinge'), S('Light', 'Lässt einen Gegenstand leuchten'), S('Minor Illusion', 'Ein Geräusch oder kleines Trugbild erschaffen')],
    [S('Magic Missile', 'Drei Geschosse, die immer treffen'), S('Shield', 'Reaction: +5 Armor Class bis zu deinem nächsten Zug'), S('Sleep', 'Lässt Gegner einschlafen'), S('Mage Armor', 'Magische Rüstung: AC 13 + DEX ohne echte Rüstung'), S('Detect Magic', 'Spürt Magie in der Nähe auf'), S('Find Familiar', 'Ein magischer Tiergefährte als Späher')]],
  Paladin: [0, 2, [], [S('Bless', 'Bis zu drei Verbündete: +1d4 auf Angriffe und Saves'), S('Divine Smite', 'Nach einem Treffer: zusätzlicher Strahlenschaden'), S('Cure Wounds', 'Heilt per Berührung'), S('Shield of Faith', '+2 Armor Class für einen Verbündeten')]],
  Ranger: [0, 2, [], [S('Cure Wounds', 'Heilt per Berührung'), S('Goodberry', 'Zehn magische Beeren, die je 1 HP heilen'), S('Ensnaring Strike', 'Dein nächster Treffer fesselt das Ziel mit Ranken')]],
};
// attack-roll cantrips that become an attack line on the sheet
export const SPELL_ATTACKS = { 'Fire Bolt': ['1d10', 'fire, 120 ft'], 'Eldritch Blast': ['1d10', 'force, 120 ft'], 'Produce Flame': ['1d8', 'fire, 60 ft'], 'Shocking Grasp': ['1d8', 'lightning, Berührung'] };

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// species traits, each explained in plain words (2024 Player's Handbook)
const DV = ['Darkvision', 'Du siehst im Dunkeln bis 60 ft wie im Dämmerlicht, aber nur in Graustufen.'];
const DV120 = ['Darkvision (120 ft)', 'Du siehst im Dunkeln doppelt so weit wie andere: 120 ft wie im Dämmerlicht.'];
export const TRAITS = {
  Human: [['Resourceful', 'Nach jeder Long Rest bekommst du Heroic Inspiration: Damit darfst du einmal einen Wurf wiederholen.'], ['Skillful', 'Ein zusätzlicher Skill deiner Wahl.'], ['Versatile', 'Ein zusätzliches Origin Feat. Sucht es gemeinsam mit dem DM aus.']],
  Elf: [DV, ['Elven Lineage', 'Deine Elfen-Linie (Drow, High Elf oder Wood Elf) gibt dir einen kleinen Zauber oder schnellere Beine.'], ['Fey Ancestry', 'Advantage gegen Charmed: Dich kann man schwer bezaubern.'], ['Keen Senses', 'Ein Skill nach Wahl: Insight, Perception oder Survival.'], ['Trance', 'Du schläfst nicht. 4 Stunden Meditation reichen für eine Long Rest.']],
  Dwarf: [DV120, ['Dwarven Resilience', 'Gift macht dir nur halben Schaden, und du wirst seltener vergiftet.'], ['Dwarven Toughness', '+1 Hit Point pro Stufe. Zwerge halten mehr aus.'], ['Stonecunning', 'Du kannst kurz Bewegungen durch Stein spüren (Tremorsense).']],
  Halfling: [['Brave', 'Advantage gegen Frightened: Angst macht dir weniger aus.'], ['Halfling Nimbleness', 'Du kannst durch den Platz von größeren Wesen hindurchlaufen.'], ['Luck', 'Würfelst du eine natürliche 1 auf dem d20, darfst du neu würfeln.'], ['Naturally Stealthy', 'Du kannst dich sogar hinter größeren Wesen verstecken.']],
  Orc: [['Adrenaline Rush', 'Als Bonus Action rennen (Dash) und dabei Temp HP bekommen.'], DV120, ['Relentless Endurance', 'Einmal pro Long Rest: Statt auf 0 HP zu fallen, bleibst du mit 1 HP stehen.']],
  Dragonborn: [['Draconic Ancestry', 'Du stammst von einer Drachenart ab. Sie bestimmt dein Element: Feuer, Kälte, Blitz, Säure oder Gift.'], ['Breath Weapon', 'Deine Odemwaffe: ein Kegel oder eine Linie aus deinem Element, die mehrere Gegner trifft.'], ['Damage Resistance', 'Schaden von deinem Element halbiert sich.'], DV],
  Tiefling: [DV, ['Fiendish Legacy', 'Dein höllisches Erbe gibt dir einen Cantrip, später weitere Zauber, und eine Resistenz.'], ['Otherworldly Presence', 'Du kannst Thaumaturgy wirken: kleine unheimliche Effekte wie eine dröhnende Stimme.']],
  Gnome: [DV, ['Gnomish Cunning', 'Advantage auf Intelligence-, Wisdom- und Charisma-Saves. Das schützt sehr gut gegen Magie.'], ['Gnomish Lineage', 'Forest Gnome (mit kleinen Tieren sprechen, Illusionen) oder Rock Gnome (kleine Uhrwerk-Spielereien bauen).']],
  Goliath: [['Giant Ancestry', 'Eine Riesenkraft je nach Abstammung (z. B. Feuer, Frost, Stein), mehrmals pro Long Rest.'], ['Large Form', 'Ab Stufe 5 kannst du kurz riesig werden.'], ['Powerful Build', 'Du trägst mehr als andere und kommst leichter aus Griffen frei.']],
  Aasimar: [['Celestial Resistance', 'Necrotic- und Radiant-Schaden halbiert sich.'], DV, ['Healing Hands', 'Einmal pro Long Rest heilst du jemanden per Berührung.'], ['Light Bearer', 'Du kannst den Cantrip Light wirken.']],
};
export const DIE_NOTE = { 6: 'd6: wenige Hit Points, lieber auf Abstand bleiben', 8: 'd8: durchschnittlich viele Hit Points', 10: 'd10: viele Hit Points', 12: 'd12: die meisten Hit Points' };
