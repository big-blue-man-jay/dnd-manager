# DnD Manager

Web-App für unsere D&D-Runde (Regeln 2024): Charakterbögen, Würfel, Sitzungen, Quests, NPCs, Enthüllungen und private DM-Notizen. Läuft auf GitHub Pages, Daten und Login über Firebase (Google-Konto).

## Was drin ist

- **Anmeldung mit Google.** Wer eine Kampagne erstellt, ist ihr DM. Spieler treten mit einem 6-stelligen Code bei.
- **Charakterbogen 2024:** Abilities, Saves, Skills mit Expertise, Angriffe, Spellcasting mit Slots, Ressourcen mit Short/Long Rest, Conditions (offiziell + eigene des DMs), Exhaustion, Death Saves, Inventar, Münzen, Attunement.
- **Entwurf → Freigabe:** Spieler bauen ihren Charakter selbst. Gibt der DM den Bogen frei, ändern Spieler nur noch Live-Werte (HP, Slots, Inventar …). Stufenaufstieg geht per XP.
- **Würfel:** antippen auf dem Bogen würfelt mit dem richtigen Bonus, mit Vorteil/Nachteil. Jeder Charakter hat seine eigene Würfelfarbe.
- **Kampagne:** Übersicht, Gruppe, Sitzungen mit Tagebuch der Spieler, Quest-Log, NPCs, Enthüllungen („OHH“-Momente), private Notizen, Themes pro Gebiet.
- **Sicherheit:** `firestore.rules` sorgt dafür, dass Spieler nur Namenskarten anderer sehen, DM-Geheimnisse wirklich geheim bleiben und Notizen privat sind.

## Ausprobieren ohne Firebase

Solange in `js/config.js` `firebaseConfig = null` steht, läuft die App im **Demo-Modus**: drei Test-Konten, Daten nur im eigenen Browser.

## Einrichten (einmalig, ca. 15 Minuten)

1. **Firebase-Projekt:** [console.firebase.google.com](https://console.firebase.google.com) → *Projekt hinzufügen* → Name z. B. `dnd-manager` → Google Analytics ausschalten → erstellen.
2. **Web-App registrieren:** In der Projektübersicht auf das `</>`-Symbol → Spitzname `dnd-manager` → *App registrieren*. Firebase zeigt ein `firebaseConfig`-Objekt. Das kommt in `js/config.js`.
3. **Google-Anmeldung:** *Build → Authentication → Jetzt starten → Google* aktivieren, Support-E-Mail wählen, speichern.
   Danach unter *Authentication → Einstellungen → Autorisierte Domains* `big-blue-man-jay.github.io` hinzufügen.
4. **Datenbank:** *Build → Firestore Database → Datenbank erstellen* → Standort `eur3 (europe-west)` → *Im Produktionsmodus starten*.
   Dann Tab *Regeln* öffnen, alles ersetzen durch den Inhalt von `firestore.rules`, *Veröffentlichen*.
5. **GitHub Pages:** Im Repo *Settings → Pages → Source: Deploy from a branch → Branch `main` / `(root)`* → *Save*. Nach 1–2 Minuten läuft die App unter `https://big-blue-man-jay.github.io/dnd-manager/`.

## Aufs Handy

Seite im Browser öffnen → *Teilen → Zum Home-Bildschirm* (iPhone) bzw. *Menü → App installieren* (Android).

## Technik

Kein Build-Schritt: reines HTML/CSS/JavaScript-Module, [Preact](https://preactjs.com) + [htm](https://github.com/developit/htm) liegen in `vendor/`. Firebase JS SDK 10 wird von gstatic.com geladen.

| Datei | Inhalt |
| --- | --- |
| `js/app.js` | Start, Login, Startseite, Kampagne erstellen/beitreten |
| `js/campaign.js` | Kampagnenseiten |
| `js/character.js` | Charakterbogen, Erstellung, Würfel |
| `js/rules5e.js` | Regeltabellen 2024 (Klassen, Skills, XP, Spell Slots, Conditions), Themes, Würfelfarben |
| `js/data.js` | Firebase- bzw. Demo-Datenzugriff |
| `firestore.rules` | Berechtigungen in der Datenbank |
