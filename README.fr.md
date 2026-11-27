[English](README.md) · [Português](README.pt-BR.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center"><img src="previa_marca.svg" alt="Logo animé des Chroniques de Lua" width="824"></p>

# 🌙 Les Chroniques de Lua · *As Crônicas de Lua*

<p align="center"><b>Claude Code, mais c'est un RPG.</b><br>Chaque outil est un monstre. Ta liste de tâches est un combat de boss. Techniquement, tu codes toujours.</p>

<p align="center">
  <a href="https://github.com/geoaltran/cronicas-de-lua-claude-code/blob/main/CHANGELOG.md"><img alt="version" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fgeoaltran%2Fcronicas-de-lua-claude-code%2Fmain%2Fmod%2Fcronicas-de-lua%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&color=f2c45a"></a>
  <a href="https://github.com/geoaltran/cronicas-de-lua-claude-code/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/geoaltran/cronicas-de-lua-claude-code?style=flat&color=6e5ac8"></a>
  <img alt="code: MIT" src="https://img.shields.io/badge/code-MIT-3b82f6">
  <img alt="art: CC BY-NC 4.0" src="https://img.shields.io/badge/art-CC%20BY--NC%204.0-d97757">
  <img alt="8 languages" src="https://img.shields.io/badge/languages-8-8a6a3a">
</p>

<p align="center"><a href="#installation">Installer</a> · <a href="#commandes">Commandes</a> · <a href="CHANGELOG.md">Changelog</a> · <a href="https://github.com/geoaltran/cronicas-de-lua-claude-code/issues/new?title=Idea:%20">Proposer un boss ou un biome</a> · <a href="https://github.com/geoaltran/cronicas-de-lua-claude-code/issues/new?title=Bug:%20">Signaler un bug</a></p>

![Lua porte un coup critique à l'Horloger](previa_chefao_relojoeiro.gif)

Lua est une petite mage lunaire qui vit juste au-dessus de ta zone de message. Quand Claude lit des fichiers, elle affronte une Vespera ; quand il modifie du code, l'Horloger arrive ; une longue commande la fait canaliser un sort, et un outil qui échoue la repousse. Crée une liste de tâches et un boss apparaît : chaque tâche terminée brise un bloc de sa vie, et la dernière est un **coup critique**. Une petite aventure pour les minutes où tu attends Claude.

- **Chaque outil est un combat** : lire, modifier, le terminal, le web, MCP et les sous-agents amènent chacun leur monstre.
- **Les listes de tâches sont des combats de boss** : 10 boss avec une vie en blocs, un bouclier et un coup critique.
- **9 biomes en parallaxe** : un par boss, d'une mer sous la pleine lune à un volcan et une éclipse.
- **Un HUD honnête** : le clair de lune est ton cache de prompt, le mana ta limite d'abonnement, le sac à dos ta fenêtre de contexte.
- **XP, niveaux et le Livre de Lua** : bestiaire, étagère à trophées (les erreurs corrigées deviennent des trophées) et un grimoire des outils de Claude.
- **8 langues** : English, Português, Español, Français, Deutsch, 中文, 日本語, 한국어.

## C'est quoi
Une bande juste au-dessus de la zone de message. Pendant que Claude travaille, Lua traverse 9 biomes en parallaxe ; chaque fois que Claude utilise un outil, un monstre surgit et elle le combat. Derrière le jeu, la bande est un tableau de bord honnête de ta session : à quel point le cache du prompt est encore chaud, ce qu'il reste de la limite de ton forfait et à quel point la fenêtre de contexte est remplie.

![Lua combat un monstre pendant que Claude travaille](previa_luta.gif)

## Installation
Dans une session Claude Code, tape :

```text
/plugin install cronicas-de-lua --marketplace geoaltran/cronicas-de-lua-claude-code
```

Réponds `y` pour ajouter la marketplace, puis choisis une portée. La bande apparaît au-dessus de la zone de message.

Nécessite une version récente de Claude Code compatible avec les mods (créé et testé sur la 2.1.331).

Le mod lance seulement deux commandes en lecture seule sur votre machine : `ps` (pour savoir quand l'app a redémarré, à cause de l'intro) et, sur macOS, `defaults read -g AppleLanguages` (la langue du système).

**Mises à jour.** Une fois par jour, à la première session, le mod lit aussi le numéro de la version publiée dans ce dépôt (un fichier public sur GitHub). Rien sur vous ni sur vos conversations n'est envoyé, et rien n'est téléchargé ni installé tout seul. Quand une nouvelle version sort, le bouton du Livre affiche une petite étoile et sa bulle vous prévient ; pour mettre à jour, tapez `/plugin marketplace update cronicas-de-lua`, puis `/plugin update cronicas-de-lua@cronicas-de-lua` (dans l'app de bureau, où `/plugin` ouvre seulement la fenêtre des plugins, lancez dans le Terminal `claude plugin marketplace update cronicas-de-lua` puis `claude plugin update cronicas-de-lua@cronicas-de-lua`), et ouvrez une nouvelle session. `/cronicas updates off` désactive la vérification (elle reste aussi désactivée avec `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`). Si vous préférez que les mises à jour arrivent toutes seules, Claude Code a sa propre option de mise à jour automatique des marketplaces.

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
| 📖&nbsp;**Livre** | Ouvre le Livre de Lua : sa fiche, la carte du voyage (les biomes déjà visités), le bestiaire des boss vaincus, l'étagère à trophées et le grimoire (les outils de Claude en guise de sorts), plus une page Commandes avec toutes les commandes `/cronicas` et un lien vers leur explication ici. Quand une nouvelle version sort, une petite étoile brille sur le Livre et la page Commandes indique comment mettre à jour. |

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

Monstres par outil : lire des fichiers → Vespera · modifier du code → Horloger / Sir Solis · terminal → Ignis · web → Léviathan / Nébula · intégrations (MCP) → Roi Miroir · sous-agents → clones de la Dame Pénombre. Les boss arrivent dans l'ordre, une page des Chroniques chacun, jusqu'à Malakor, puis Nouvelle partie+. De temps en temps (environ 1 combat ordinaire sur 4), c'est le boss de la page en cours qui entre, un avant-goût de la suite.

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
| <code>/cronicas&nbsp;updates&nbsp;[check&#124;off&#124;on]</code> | Affiche votre version et s'il en existe une nouvelle, avec la marche à suivre. `check` vérifie maintenant ; `off` / `on` désactive ou active la vérification quotidienne. |
| <code>/cronicas&nbsp;ruler</code> | Affiche une règle sous la scène pour mesurer le bandeau. Retape-la pour la cacher. |
| <code>/cronicas&nbsp;width&nbsp;&lt;px&gt;</code> | Calibre la largeur avec le dernier nombre entier au bord droit de la règle (ex. `/cronicas width 752`). |
| <code>/cronicas&nbsp;scale&nbsp;1&#124;2&#124;3</code> | Taille du pixel de la scène : 1x, 2x ou 3x. |
| <code>/cronicas&nbsp;intro</code> | Joue l’ouverture maintenant (un clic la passe). `intro off` / `intro on` coupe ou rallume l’ouverture automatique (première session du jour). |
| <code>/cronicas&nbsp;surfaces</code> | Indique où cette session est dessinée (app de bureau, VS Code, terminal, téléphone). |
| <code>/cronicas&nbsp;boss&nbsp;[name]</code> | Appelle le prochain boss du voyage, ou celui de ton choix (`vespera`, `ignis`, `malakor`…), et la scène passe dans son biome. `/cronicas boss list` appelle un boss à liste de tâches, avec bouclier. |
| <code>/cronicas&nbsp;hit</code> | Frappe le boss en scène ; contre un boss à liste, termine une tâche. Le dernier coup est le critique. |
| <code>/cronicas&nbsp;elite</code> | Le prochain combat ordinaire sera l’élite (Golem d’Obsidienne) avec un trophée. |
| <code>/cronicas&nbsp;walk&nbsp;[secondes]</code> | Lua marche quelques secondes dans le biome actuel (8 par défaut, jusqu’à 120) pour voir les couches défiler en boucle, puis s’arrête en respirant. |
| <code>/cronicas&nbsp;stage&nbsp;[biome]</code> | Un changement de niveau juste pour le décor : Lua sort en marchant, le biome suivant (ou celui demandé : `mer`, `volcan`, `eclipse`…) apparaît avec son titre et elle revient. Aucune page n’est comptée. |
| <code>/cronicas&nbsp;vigil</code> | Amène le clair de lune presque à sa fin pour voir la Veille à l’œuvre (lanterne allumée, elle envoie un vrai petit message). |
| <code>/cronicas&nbsp;new-moon</code> | Simule la nouvelle lune (cache froid) jusqu’à la prochaine réponse de Claude. |

⚠️ Les commandes de test (`boss`, `hit`, `elite`) comptent pour de vrai : un boss vaincu ainsi rend aussi une page et un niveau.

Le jeu parle anglais, portugais, espagnol, français, allemand, chinois, japonais et coréen (il suit la langue du système ; `/cronicas language` la change).

## Licence
- **Code** (scripts Python, `mod/`) : **MIT**, voir [`LICENSE`](LICENSE).
- **Art et personnages** (tout ce qui se trouve dans `assets/`, l'art intégré au mod, les sons et les aperçus) : **© 2026 George Altran (@geoaltran), [CC BY-NC 4.0](LICENSE-ART)**. Partage-le, remixe-le, fais du fan art : il suffit de créditer **« Art by George Altran (@geoaltran) »** avec un lien. **Pas d'usage commercial** sans autorisation ; une licence commerciale est disponible sur demande.
- **Polices** : Silkscreen, Pixelify Sans et Fusion Pixel Font (chinois, japonais et coréen), **SIL Open Font License 1.1** (les licences sont à côté d'elles).

Seul le texte juridique de la licence en anglais fait foi. Crédits complets dans [`CREDITS.md`](CREDITS.md).
