[English](README.md) · [Português](README.pt-BR.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch** · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center"><img src="previa_marca.svg" alt="Animiertes Logo der Chroniken von Lua" width="824"></p>

# 🌙 Die Chroniken von Lua · *As Crônicas de Lua*

Ein Pixel-Art-RPG-Mod für Claude Code. Jedes Tool ist ein Monster, dein Kontextfenster ist ein Rucksack, dein Nutzungslimit ist Mana, und Lua, eine kleine Mondmagierin, stellt sich ihnen allen, während Claude arbeitet. Bosskämpfe, XP, Level und ein Bestiarium. Technisch gesehen programmierst du immer noch.

![Lua kämpft gegen ein Monster, während Claude arbeitet](previa_luta.gif)

## Was ist das?
Ein Streifen direkt über dem Nachrichtenfeld. Während Claude arbeitet, wandert Lua durch 9 Biome mit Parallax-Effekt; jedes Mal, wenn Claude ein Tool benutzt, taucht ein Monster auf und sie kämpft dagegen. Hinter dem Spiel ist der Streifen ein ehrliches Dashboard deiner Sitzung: wie warm der Prompt-Cache noch ist, wie viel vom Limit deines Plans übrig ist und wie voll das Kontextfenster ist.

![Lua wandert durch den Wald](previa_caminhada.gif)

## Installation
Tippe in einer Claude-Code-Sitzung:

```text
/plugin install cronicas-de-lua --marketplace geoaltran/cronicas-de-lua-claude-code
```

Antworte mit `y`, um den Marketplace hinzuzufügen, und wähle dann einen Geltungsbereich. Der Streifen erscheint über dem Nachrichtenfeld.

Benötigt ein aktuelles Claude Code mit Mod-Unterstützung (gebaut und getestet mit 2.1.331).

Der Mod führt auf deinem Rechner nur zwei Befehle aus, die nur lesen: `ps` (um zu merken, wann die App neu gestartet wurde, fürs Intro) und unter macOS `defaults read -g AppleLanguages` (die Systemsprache).

**Updates.** Einmal am Tag, in der ersten Sitzung, liest der Mod außerdem die Versionsnummer, die in diesem Repository veröffentlicht ist (eine öffentliche Datei auf GitHub). Nichts über dich oder deine Gespräche wird gesendet, und nichts wird von selbst heruntergeladen oder installiert. Wenn eine neue Version da ist, bekommt der Buch-Knopf ein Sternchen und seine Sprechblase sagt es dir; zum Aktualisieren tippe `/plugin marketplace update cronicas-de-lua`, dann `/plugin update cronicas-de-lua@cronicas-de-lua`, und öffne eine neue Sitzung. `/cronicas updates off` schaltet die Prüfung aus (sie bleibt auch aus, wenn `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` gesetzt ist). Wenn Updates lieber von selbst kommen sollen: Claude Code hat eine eigene Option zum automatischen Aktualisieren von Marketplaces.

## Wo es läuft
| Oberfläche | Was du bekommst |
|---|---|
| **Claude-Desktop-App (Tab „Code“)** | Das ganze Spiel: animierte Szene, Tooltips beim Überfahren mit der Maus, klickbare Pixel-Art-Buttons, das Buch-Panel. |
| **VS Code** | Dieselbe animierte Szene; die Buttons stehen in einer Reihe darunter (VS Code kennt kein Hover innerhalb der Zeichnung). |
| **Terminal** | Eine kompakte Textversion mit farbigen Balken und Emojis. |
| **Mobile App** | Noch nicht: Die App zeichnet die Streifen von Mods derzeit nicht über Remote Control. |

## Die Balken
| Balken | Bedeutet |
|---|---|
| **Mondlicht** (blasses Gold) | Wie warm der Prompt-Cache noch ist (Zeit seit der letzten Antwort im Verhältnis zur Lebensdauer des Caches). Ein Mond am Himmel nimmt mit ihm ab. **Neumond** = Lua schläft ein und die nächste Nachricht kostet mehr (der Cache ist kalt). |
| **Sternenmana** | Was vom 5-Stunden-Limit deines Plans übrig ist (das 7-Tage-Limit steht im Tooltip). |
| **Rucksack** | Wie viel vom Kontextfenster belegt ist. Ab 80 % wackelt der Rucksack und schlägt vor, aufzuräumen (zu komprimieren). |
| **XP / Level** | Steigt, während du arbeitest. Alle 2 Level glänzen Luas Zauberstab und Gewand ein bisschen mehr. |

## Die Buttons
| Button | Macht |
|---|---|
| 🏮&nbsp;**Nachtwache** | Hält den Cache warm, indem sie kurz vor dem Erlöschen des Mondlichts eine winzige Nachricht schickt (höchstens 6-mal und nur, während du weg bist). **Standardmäßig aus: Sie verbraucht das Limit deines Plans.** |
| 🎒&nbsp;**Rucksack** | Bietet an, das Gespräch zu komprimieren (wie `/compact`), mit Bestätigung. |
| 🚩&nbsp;**Banner** | Bittet Claude um eine Zusammenfassung der Mission, damit du in einer neuen Sitzung weitermachen kannst. |
| 📖&nbsp;**Buch** | Öffnet Luas Buch: ihr Charakterblatt, die Reisekarte (die Biome, die sie schon besucht hat), das Bestiarium der besiegten Bosse, das Trophäenregal und das Grimoire (Claudes Tools als Zauber), dazu eine Befehle-Seite mit allen `/cronicas`-Befehlen und einem Link zu ihrer Erklärung hier. Wenn eine neue Version da ist, funkelt ein Sternchen am Buch und die Befehle-Seite zeigt, wie du aktualisierst. |

![Luas Buch: Charakterblatt, Reisekarte, Bestiarium, Trophäen und Grimoire](previa_livro.gif)

## Was im Spiel passiert
| Echtes Ereignis | Im Spiel |
|---|---|
| Leerlauf, zwischen Aufgaben | Lua wandert oder steht da, atmet und blinzelt |
| Ein Tool startet | Ein Monster erscheint, ein „!“ über Lua, sie wirft einen Stern |
| Das Tool klappt | Trefferpause, das Monster blitzt auf, weicht zurück und zerplatzt in Sterne; Schadenszahl |
| Ein langsames Tool | Lua kanalisiert mit einem magischen Kreis zu ihren Füßen |
| Das Tool schlägt fehl | Das Monster schlägt zurück; Lua blinkt rot (nur optisch) |
| Ein später behobener Fehler | Elite (Obsidiangolem); wenn er fällt, bleibt eine Trophäe fürs Regal |
| Eine Aufgabenliste wird erstellt, oder alle 12 Kämpfe | **Boss**: Leben in Blöcken, einer pro Aufgabe. Normale Treffer prallen an seinem **Schild** ab (Lua kratzt sich am Kopf ❓💧); eine erledigte Aufgabe räumt einen Block ab; die letzte ist ein **KRITISCHER** Treffer. Der Boss fällt mit einer wiedergefundenen Seite (x/10) und einem Levelaufstieg, und Lua zieht ins nächste Biom weiter |

![Kampf gegen Dame Penumbra: der Schild hält, eine Aufgabe nimmt einen Block, kritischer Treffer](previa_chefao_penumbra.gif)

![Kampf gegen den Uhrmacher im Uhrturm](previa_chefao_relojoeiro.gif)

![Kampf gegen den Obsidiangolem in den Ruinen](previa_chefao_golem.gif)

Monster nach Tool: Dateien lesen → Vespera · Code bearbeiten → Uhrmacher / Sir Solis · Terminal → Ignis · Web → Leviathan / Nébula · Integrationen (MCP) → Spiegelkönig · Subagenten → Klone der Dame Penumbra. Die Bosse kommen der Reihe nach, jeder mit einer Seite der Chroniken, bis zu Malakor, danach Neues Spiel+. Ab und zu (etwa jeder 4. normale Kampf) tritt stattdessen der Boss der aktuellen Seite auf, als Vorgeschmack auf das, was kommt.

## Die Biome
Lunária hat 9 Biome, eins für jeden Abschnitt der Reise, jedes zu seiner eigenen Tageszeit und mit eigenen Animationen: Wald (Vespera und Dame Penumbra), Ruinen (Obsidiangolem), Meer (Leviathan), Vulkan (Ignis), Uhrturm (Uhrmacher), Morgenrot (Sir Solis), Glasschloss (Spiegelkönig), Sternenhimmel (Nébula) und Finsternis (Malakor). Wellen und ein kreisender Leuchtturm, pulsierende Lava, Zahnräder, Sonnenstrahlen, Spiegelungen, die über die Spiegel huschen, Sternschnuppen und eigene Partikel an jedem Ort.

![Lua wandert durch die 9 Biome](previa_biomas.gif)

Wenn der Boss eines Bioms fällt, folgt der **Levelwechsel**: Lua geht über den Rand hinaus, der Bildschirm wird schwarz und sie betritt das nächste Biom, unter dem Seitentitel in Pixel-Art.

![Levelwechsel: von den Ruinen ans Meer, mit dem Seitentitel](previa_passagem.gif)

## Befehle
Tipp sie wie eine normale Nachricht in Claudes Eingabefeld. Die Antwort siehst nur du: Claude bekommt nichts davon mit und dein Plan-Limit wird nicht angetastet. Jeder Unterbefehl hört auch auf seinen portugiesischen Namen (`regua`, `largura`, `chefao`, `golpe`…).

| Befehl | Was er macht |
|---|---|
| <code>/cronicas</code> | Luas Übersicht: Level, XP, zurückgeholte Seiten (x/10), neueste Trophäen und die Einstellungen des Bands. Listet auch alle Befehle. |
| <code>/cronicas&nbsp;language&nbsp;[code]</code> | Zeigt die Sprachen des Spiels oder wechselt zu einer: `en`, `pt-BR`, `es`, `fr`, `de`, `zh`, `ja`, `ko` (`auto` geht zurück zur Systemsprache). |
| <code>/cronicas&nbsp;updates&nbsp;[check&#124;off&#124;on]</code> | Zeigt deine Version und ob es eine neue gibt, mit der Anleitung zum Aktualisieren. `check` prüft sofort; `off` / `on` schaltet die tägliche Prüfung aus oder ein. |
| <code>/cronicas&nbsp;ruler</code> | Zeigt ein Lineal unter der Szene, um das Band zu messen. Nochmal tippen blendet es aus. |
| <code>/cronicas&nbsp;width&nbsp;&lt;px&gt;</code> | Kalibriert die Breite mit der letzten ganzen Zahl am rechten Rand des Lineals (z. B. `/cronicas width 752`). |
| <code>/cronicas&nbsp;scale&nbsp;1&#124;2&#124;3</code> | Pixelgröße der Szene: 1x, 2x oder 3x. |
| <code>/cronicas&nbsp;intro</code> | Spielt das Intro jetzt ab (ein Klick überspringt es). `intro off` / `intro on` schaltet das automatische Intro (erste Sitzung des Tages) aus oder ein. |
| <code>/cronicas&nbsp;surfaces</code> | Sagt, wo diese Sitzung gerade gezeichnet wird (Desktop-App, VS Code, Terminal, Handy). |
| <code>/cronicas&nbsp;boss&nbsp;[name]</code> | Ruft den nächsten Boss der Reise oder einen bestimmten (`vespera`, `ignis`, `malakor`…); die Szene wechselt in sein Biom. `/cronicas boss list` ruft einen Aufgabenlisten-Boss mit Schild. |
| <code>/cronicas&nbsp;hit</code> | Trifft den Boss auf der Bühne; beim Aufgabenlisten-Boss erledigt er eine Aufgabe. Der letzte Treffer ist der kritische. |
| <code>/cronicas&nbsp;elite</code> | Der nächste normale Kampf wird zum Elite-Gegner (Obsidiangolem) mit einer Trophäe. |
| <code>/cronicas&nbsp;walk&nbsp;[Sekunden]</code> | Lua läuft ein paar Sekunden durch das aktuelle Biom (standardmäßig 8, bis 120), damit du die Ebenen in der Schleife scrollen siehst, und bleibt dann atmend stehen. |
| <code>/cronicas&nbsp;stage&nbsp;[Biom]</code> | Ein Levelwechsel nur zum Anschauen: Lua läuft hinaus, das nächste Biom (oder das genannte: `meer`, `vulkan`, `finsternis`…) blendet mit seinem Titel ein und sie läuft wieder herein. Es zählt keine Seite. |
| <code>/cronicas&nbsp;vigil</code> | Bringt das Mondlicht fast ans Ende, damit du die Nachtwache arbeiten siehst (mit brennender Laterne schickt sie eine echte, winzige Nachricht). |
| <code>/cronicas&nbsp;new-moon</code> | Simuliert den Neumond (kalter Cache) bis zu Claudes nächster Antwort. |

⚠️ Die Testbefehle (`boss`, `hit`, `elite`) zählen wirklich: Ein so besiegter Boss bringt auch eine Seite und ein Level.

Das Spiel spricht Englisch, Portugiesisch, Spanisch, Französisch, Deutsch, Chinesisch, Japanisch und Koreanisch (es folgt der Systemsprache; `/cronicas language` wechselt sie).

## Lizenz
- **Code** (Python-Skripte, `mod/`): **MIT**, siehe [`LICENSE`](LICENSE).
- **Grafik und Figuren** (alles in `assets/`, die im Mod eingebettete Grafik, die Sounds und die Vorschauen): **© 2026 George Altran (@geoaltran), [CC BY-NC 4.0](LICENSE-ART)**. Teile sie, remixe sie, mach Fan-Art: Nenne einfach **„Art by George Altran (@geoaltran)“** mit einem Link. **Keine kommerzielle Nutzung** ohne Erlaubnis; eine kommerzielle Lizenz gibt es auf Anfrage.
- **Schriften**: Silkscreen, Pixelify Sans und Fusion Pixel Font (Chinesisch, Japanisch, Koreanisch), **SIL Open Font License 1.1** (die Lizenzdateien liegen daneben).

Rechtlich verbindlich ist nur der englische Lizenztext. Alle Credits in [`CREDITS.md`](CREDITS.md).
