[English](README.md) · [Português](README.pt-BR.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center"><img src="previa_marca.svg" alt="Logo animé des Chroniques de Lua" width="824"></p>

# 🌙 Les Chroniques de Lua · *As Crônicas de Lua*

Un mod RPG en pixel art pour Claude Code. Chaque outil est un monstre, ta fenêtre de contexte est un sac à dos, ta limite d'utilisation est du mana, et Lua, une petite mage lunaire, les affronte tous pendant que Claude travaille. Boss, XP, niveaux et bestiaire. Techniquement, tu es toujours en train de coder.

![Lua combat un monstre pendant que Claude travaille](previa_luta.gif)

## C'est quoi
Une bande juste au-dessus de la zone de message. Pendant que Claude travaille, Lua traverse 9 biomes en parallaxe ; chaque fois que Claude utilise un outil, un monstre surgit et elle le combat. Derrière le jeu, la bande est un tableau de bord honnête de ta session : à quel point le cache du prompt est encore chaud, ce qu'il reste de la limite de ton forfait et à quel point la fenêtre de contexte est remplie.

![Lua se promène dans la forêt](previa_caminhada.gif)

## Installation
Dans une session Claude Code, tape :

```text
/plugin install cronicas-de-lua --marketplace geoaltran/cronicas-de-lua-claude-code
```

Réponds `y` pour ajouter la marketplace, puis choisis une portée. La bande apparaît au-dessus de la zone de message.

Nécessite une version récente de Claude Code compatible avec les mods (créé et testé sur la 2.1.331).

Le mod lance seulement deux commandes en lecture seule sur votre machine : `ps` (pour savoir quand l'app a redémarré, à cause de l'intro) et, sur macOS, `defaults read -g AppleLanguages` (la langue du système).

## Où ça tourne
| Surface | Ce que tu obtiens |
|---|---|
| **App de bureau Claude (onglet Code)** | Le jeu complet : scène animée, infobulles au survol, boutons en pixel art cliquables, le panneau du Livre. |
| **VS Code** | La même scène animée ; les boutons sont sur une ligne en dessous (VS Code ne gère pas le survol dans le dessin). |
| **Terminal** | Une version compacte en texte, avec des barres colorées et des emojis. |
| **App mobile** | Pas encore : l'app ne dessine pas les bandes des mods via Remote Control pour l'instant. |

## Les barres
| Barre | Signification |
|---|---|
| **Clair de Lune** (or pâle) | À quel point le cache du prompt est encore chaud (temps depuis la dernière réponse par rapport à la durée de vie du cache). Une lune dans le ciel décroît avec lui. **Nouvelle lune** = Lua s'endort et le prochain message coûte plus cher (le cache est froid). |
| **Mana Stellaire** | Ce qu'il reste de la limite de 5 heures de ton forfait (celle de 7 jours dans l'infobulle). |
| **Sac à dos** | La part de la fenêtre de contexte déjà utilisée. Au-delà de 80 %, le sac tremble et propose de faire du rangement (compacter). |
| **XP / Niveau** | Monte à mesure que tu travailles. Tous les 2 niveaux, la baguette et la tenue de Lua brillent un peu plus. |

## Les boutons
| Bouton | Fait |
|---|---|
| 🏮&nbsp;**Veille** | Garde le cache au chaud en envoyant un tout petit message juste avant que le clair de lune s'éteigne (6 fois au maximum, et seulement pendant ton absence). **Éteinte par défaut : elle consomme la limite de ton forfait.** |
| 🎒&nbsp;**Sac&nbsp;à&nbsp;dos** | Propose de compacter la conversation (comme `/compact`), avec confirmation. |
| 🚩&nbsp;**Étendard** | Demande à Claude un résumé de la mission pour continuer dans une nouvelle session. |
| 📖&nbsp;**Livre** | Ouvre le Livre de Lua : sa fiche, la carte du voyage (les biomes déjà visités), le bestiaire des boss vaincus, l'étagère à trophées et le grimoire (les outils de Claude en guise de sorts). |

![Le Livre de Lua : fiche, carte du voyage, bestiaire, trophées et grimoire](previa_livro.gif)

## Ce qui se passe dans le jeu
| Événement réel | Dans le jeu |
|---|---|
| Au repos, entre deux tâches | Lua marche, ou reste immobile, respire et cligne des yeux |
| Un outil démarre | Un monstre entre, un « ! » au-dessus de Lua, elle lance une étoile |
| L'outil réussit | Pause d'impact, le monstre clignote, recule et éclate en étoiles ; chiffre de dégâts |
| Un outil lent | Lua canalise avec un cercle magique à ses pieds |
| L'outil échoue | Le monstre contre-attaque ; Lua clignote en rouge (purement visuel) |
| Une erreur corrigée plus tard | Élite (Golem d'Obsidienne) ; en tombant, il laisse un trophée pour l'étagère |
| Une liste de tâches est créée, ou tous les 12 combats | **Boss** : vie en blocs, un par tâche. Les coups ordinaires rebondissent sur son **bouclier** (Lua se gratte la tête ❓💧) ; une tâche terminée fait tomber un bloc ; la dernière est un coup **CRITIQUE**. Le boss tombe avec une page retrouvée (x/10) et un niveau en plus, puis Lua passe au biome suivant |

![Combat contre Dame Pénombre : le bouclier tient, une tâche fait tomber un bloc, coup critique](previa_chefao_penumbra.gif)

![Combat contre l'Horloger dans la Tour de l'Horloge](previa_chefao_relojoeiro.gif)

![Combat contre le Golem d'Obsidienne dans les Ruines](previa_chefao_golem.gif)

Monstres par outil : lire des fichiers → Vespera · modifier du code → Horloger / Sir Solis · terminal → Ignis · web → Léviathan / Nébula · intégrations (MCP) → Roi Miroir · sous-agents → clones de la Dame Pénombre. Les boss arrivent dans l'ordre, une page des Chroniques chacun, jusqu'à Malakor, puis Nouvelle partie+.

## Les biomes
Lunária compte 9 biomes, un par étape du voyage, chacun à son heure de la journée et avec ses propres animations : Forêt (Vespera et Dame Pénombre), Ruines (Golem d'Obsidienne), Mer (Léviathan), Volcan (Ignis), Tour de l'Horloge (Horloger), Aurore (Sir Solis), Château de Verre (Roi Miroir), Ciel Étoilé (Nébula) et Éclipse (Malakor). Des vagues et un phare qui tourne, de la lave qui palpite, des engrenages, des rayons de soleil, des reflets qui filent sur les miroirs, des étoiles filantes et des particules propres à chaque lieu.

![Lua traversant les 9 biomes](previa_biomas.gif)

Quand le boss d'un biome tombe, vient la **transition** : Lua sort en marchant par le bord, l'écran passe au noir et elle entre dans le biome suivant, sous le titre de la page en pixel art.

![Transition : des Ruines à la Mer, avec le titre de la page](previa_passagem.gif)

## Commandes
Tape-les dans la zone de message de Claude, comme un message normal. La réponse n’apparaît que pour toi : Claude ne reçoit rien et la limite du forfait n’est pas entamée. Chaque sous-commande répond aussi à son nom portugais (`regua`, `largura`, `chefao`, `golpe`…).

| Commande | Ce qu’elle fait |
|---|---|
| <code>/cronicas</code> | Résumé de Lua : niveau, XP, pages retrouvées (x/10), derniers trophées et réglages du bandeau. Elle liste aussi toutes les commandes. |
| <code>/cronicas&nbsp;language&nbsp;[code]</code> | Affiche les langues du jeu ou passe à l’une d’elles : `en`, `pt-BR`, `es`, `fr`, `de`, `zh`, `ja`, `ko` (`auto` revient à la langue du système). |
| <code>/cronicas&nbsp;ruler</code> | Affiche une règle sous la scène pour mesurer le bandeau. Retape-la pour la cacher. |
| <code>/cronicas&nbsp;width&nbsp;&lt;px&gt;</code> | Calibre la largeur avec le dernier nombre entier au bord droit de la règle (ex. `/cronicas width 752`). |
| <code>/cronicas&nbsp;scale&nbsp;1&#124;2&#124;3</code> | Taille du pixel de la scène : 1x, 2x ou 3x. |
| <code>/cronicas&nbsp;intro</code> | Joue l’ouverture maintenant (un clic la passe). `intro off` / `intro on` coupe ou rallume l’ouverture automatique (première session du jour). |
| <code>/cronicas&nbsp;surfaces</code> | Indique où cette session est dessinée (app de bureau, VS Code, terminal, téléphone). |
| <code>/cronicas&nbsp;boss&nbsp;[name]</code> | Appelle le prochain boss du voyage, ou celui de ton choix (`vespera`, `ignis`, `malakor`…), et la scène passe dans son biome. `/cronicas boss list` appelle un boss à liste de tâches, avec bouclier. |
| <code>/cronicas&nbsp;hit</code> | Frappe le boss en scène ; contre un boss à liste, termine une tâche. Le dernier coup est le critique. |
| <code>/cronicas&nbsp;elite</code> | Le prochain combat ordinaire sera l’élite (Golem d’Obsidienne) avec un trophée. |
| <code>/cronicas&nbsp;vigil</code> | Amène le clair de lune presque à sa fin pour voir la Veille à l’œuvre (lanterne allumée, elle envoie un vrai petit message). |
| <code>/cronicas&nbsp;new-moon</code> | Simule la nouvelle lune (cache froid) jusqu’à la prochaine réponse de Claude. |

⚠️ Les commandes de test (`boss`, `hit`, `elite`) comptent pour de vrai : un boss vaincu ainsi rend aussi une page et un niveau.

Le jeu parle anglais, portugais, espagnol, français, allemand, chinois, japonais et coréen (il suit la langue du système ; `/cronicas language` la change).

## Licence
- **Code** (scripts Python, `mod/`) : **MIT**, voir [`LICENSE`](LICENSE).
- **Art et personnages** (tout ce qui se trouve dans `assets/`, l'art intégré au mod, les sons et les aperçus) : **© 2026 George Altran (@geoaltran), [CC BY-NC 4.0](LICENSE-ART)**. Partage-le, remixe-le, fais du fan art : il suffit de créditer **« Art by George Altran (@geoaltran) »** avec un lien. **Pas d'usage commercial** sans autorisation ; une licence commerciale est disponible sur demande.
- **Polices** : Silkscreen, Pixelify Sans et Fusion Pixel Font (chinois, japonais et coréen), **SIL Open Font License 1.1** (les licences sont à côté d'elles).

Seul le texte juridique de la licence en anglais fait foi. Crédits complets dans [`CREDITS.md`](CREDITS.md).
