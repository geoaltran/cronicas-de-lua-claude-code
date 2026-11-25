[English](README.md) · [Português](README.pt-BR.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center"><img src="previa_marca.svg" alt="Logo animado de Las Crónicas de Lua" width="824"></p>

# 🌙 Las Crónicas de Lua · *As Crônicas de Lua*

Un mod RPG en pixel art para Claude Code. Cada herramienta es un monstruo, tu ventana de contexto es una mochila, tu límite de uso es maná, y Lua, una pequeña maga lunar, se enfrenta a todos mientras Claude trabaja. Jefes, XP, niveles y un bestiario. Técnicamente, sigues programando.

![Lua luchando contra un monstruo mientras Claude trabaja](previa_luta.gif)

## Qué es
Una franja justo encima de la caja de mensajes. Mientras Claude trabaja, Lua recorre 9 biomas en parallax; cada vez que Claude usa una herramienta, aparece un monstruo y ella lo combate. Detrás del juego, la franja es un panel honesto de tu sesión: qué tan caliente sigue la caché del prompt, cuánto queda del límite de tu plan y qué tan llena está la ventana de contexto.

![Lua caminando por el bosque](previa_caminhada.gif)

## Instalación
En una sesión de Claude Code, escribe:

```text
/plugin install cronicas-de-lua --marketplace geoaltran/cronicas-de-lua-claude-code
```

Responde `y` para añadir el marketplace y elige un alcance. La franja aparece encima de la caja de mensajes.

Requiere un Claude Code reciente con soporte para mods (creado y probado en la 2.1.331).

El mod ejecuta solo dos comandos de lectura en tu equipo: `ps` (para saber cuándo se reinició la app, por la introducción) y, en macOS, `defaults read -g AppleLanguages` (el idioma del sistema).

**Actualizaciones.** Una vez al día, en la primera sesión, el mod también lee el número de la versión publicada en este repositorio (un archivo público en GitHub). No se envía nada sobre ti ni sobre tus conversaciones, y nada se descarga ni se instala solo. Cuando sale una versión nueva, el botón del Libro muestra una estrellita y su globo te avisa; para actualizar, escribe `/plugin marketplace update cronicas-de-lua`, después `/plugin update cronicas-de-lua@cronicas-de-lua`, y abre una sesión nueva. `/cronicas updates off` desactiva la comprobación (también queda desactivada con `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`). Si prefieres que las actualizaciones lleguen solas, Claude Code tiene su propia opción de actualización automática de los marketplaces.

## Dónde funciona
| Superficie | Qué obtienes |
|---|---|
| **App de escritorio de Claude (pestaña Code)** | El juego completo: escena animada, globos de ayuda al pasar el ratón, botones en pixel art clicables, el panel del Libro. |
| **VS Code** | La misma escena animada; los botones van en una fila debajo (VS Code no tiene hover dentro del dibujo). |
| **Terminal** | Una versión compacta en texto, con barras de colores y emojis. |
| **App móvil** | Todavía no: hoy la app no dibuja las franjas de los mods por Remote Control. |

## Las barras
| Barra | Significa |
|---|---|
| **Luz de Luna** (dorado pálido) | Qué tan caliente sigue la caché del prompt (tiempo desde la última respuesta frente a la vida de la caché). Una luna en el cielo mengua con ella. **Luna nueva** = Lua se queda dormida y el próximo mensaje cuesta más (la caché está fría). |
| **Maná Estelar** | Lo que queda del límite de 5 horas de tu plan (el de 7 días, en el globo de ayuda). |
| **Mochila** | Cuánto de la ventana de contexto está en uso. Por encima del 80 %, la mochila tiembla y sugiere ordenarla (compactar). |
| **XP / Nivel** | Sube mientras trabajas. Cada 2 niveles, la varita y la ropa de Lua brillan un poco más. |

## Los botones
| Botón | Hace |
|---|---|
| 🏮&nbsp;**Vigilia** | Mantiene la caché caliente enviando un mensaje cortito justo antes de que se apague la luz de luna (como mucho 6 veces, y solo mientras no estás). **Apagada por defecto: gasta el límite de tu plan.** |
| 🎒&nbsp;**Mochila** | Ofrece compactar la conversación (como `/compact`), con confirmación. |
| 🚩&nbsp;**Estandarte** | Pide a Claude un resumen de la misión para continuar en una sesión nueva. |
| 📖&nbsp;**Libro** | Abre el Libro de Lua: su ficha, el mapa del viaje (los biomas que ha visitado), el bestiario de jefes derrotados, la estantería de trofeos y el grimorio (las herramientas de Claude como hechizos), además de una página de Comandos con todos los comandos de `/cronicas` y un enlace a su explicación aquí. Cuando sale una versión nueva, una estrellita brilla en el Libro y la página de Comandos muestra cómo actualizar. |

![El Libro de Lua: ficha, mapa del viaje, bestiario, trofeos y grimorio](previa_livro.gif)

## Qué pasa en el juego
| Evento real | En el juego |
|---|---|
| Inactivo, entre tareas | Lua camina, o se queda quieta respirando y parpadeando |
| Empieza una herramienta | Entra un monstruo, aparece un "!" sobre Lua y ella lanza una estrella |
| La herramienta sale bien | Pausa de impacto, el monstruo parpadea, retrocede y estalla en estrellas; número de daño |
| Una herramienta lenta | Lua canaliza con un círculo mágico a sus pies |
| La herramienta falla | El monstruo contraataca; Lua parpadea en rojo (solo visual) |
| Un error corregido después | Élite (Gólem de Obsidiana); al caer deja un trofeo para la estantería |
| Se crea una lista de tareas, o cada 12 combates | **Jefe**: vida en bloques, uno por tarea. Los golpes normales rebotan en su **escudo** (Lua se rasca la cabeza ❓💧); una tarea terminada tumba un bloque; la última es un golpe **CRÍTICO**. El jefe cae con una página recuperada (x/10) y una subida de nivel, y Lua sigue hacia el bioma siguiente |

![Combate contra Dama Penumbra: el escudo aguanta, una tarea tumba un bloque, golpe crítico](previa_chefao_penumbra.gif)

![Combate contra el Relojero en la Torre del Reloj](previa_chefao_relojoeiro.gif)

![Combate contra el Gólem de Obsidiana en las Ruinas](previa_chefao_golem.gif)

Monstruos por herramienta: leer archivos → Vespera · editar código → Relojero / Sir Solis · terminal → Ignis · web → Leviatán / Nébula · integraciones (MCP) → Rey Espejo · subagentes → clones de Dama Penumbra. Los jefes llegan en orden, una página de las Crónicas cada uno, hasta Malakor, y luego Nueva Partida+. De vez en cuando (más o menos 1 combate normal de cada 4) entra el jefe de la página actual, un adelanto de lo que viene.

## Los biomas
Lunária tiene 9 biomas, uno por cada tramo del viaje, cada uno a su hora del día y con sus propias animaciones: Bosque (Vespera y Dama Penumbra), Ruinas (Gólem de Obsidiana), Mar (Leviatán), Volcán (Ignis), Torre del Reloj (Relojero), Aurora (Sir Solis), Castillo de Cristal (Rey Espejo), Cielo Estrellado (Nébula) y Eclipse (Malakor). Olas y un faro que gira, lava que palpita, engranajes, rayos de sol, reflejos que corren por los espejos, estrellas fugaces y partículas propias en cada lugar.

![Lua recorriendo los 9 biomas](previa_biomas.gif)

Cuando cae el jefe de un bioma, llega el **cambio de fase**: Lua sale caminando por el borde, la pantalla se funde a negro y ella entra en el bioma siguiente, bajo el título de la página en pixel art.

![Cambio de fase: de las Ruinas al Mar, con el título de la página](previa_passagem.gif)

## Comandos
Escríbelos en la caja de mensajes de Claude, como un mensaje normal. La respuesta aparece solo para ti: Claude no recibe nada y no se gasta el límite del plan. Cada subcomando también responde a su nombre en portugués (`regua`, `largura`, `chefao`, `golpe`…).

| Comando | Qué hace |
|---|---|
| <code>/cronicas</code> | Resumen de Lua: nivel, XP, páginas recuperadas (x/10), últimos trofeos y los ajustes de la franja. También lista todos los comandos. |
| <code>/cronicas&nbsp;language&nbsp;[code]</code> | Muestra los idiomas del juego o cambia a uno: `en`, `pt-BR`, `es`, `fr`, `de`, `zh`, `ja`, `ko` (`auto` vuelve al idioma del sistema). |
| <code>/cronicas&nbsp;updates&nbsp;[check&#124;off&#124;on]</code> | Muestra tu versión y si salió una nueva, con cómo actualizar. `check` comprueba ahora; `off` / `on` desactiva o activa la comprobación diaria. |
| <code>/cronicas&nbsp;ruler</code> | Muestra una regla bajo la escena para medir la franja. Escríbelo de nuevo para ocultarla. |
| <code>/cronicas&nbsp;width&nbsp;&lt;px&gt;</code> | Calibra el ancho con el último número entero en el borde derecho de la regla (p. ej. `/cronicas width 752`). |
| <code>/cronicas&nbsp;scale&nbsp;1&#124;2&#124;3</code> | Tamaño del píxel de la escena: 1x, 2x o 3x. |
| <code>/cronicas&nbsp;intro</code> | Reproduce la apertura ahora (un clic la salta). `intro off` / `intro on` apaga o enciende la automática (primera sesión del día). |
| <code>/cronicas&nbsp;surfaces</code> | Dice dónde se está dibujando esta sesión (app de escritorio, VS Code, terminal, móvil). |
| <code>/cronicas&nbsp;boss&nbsp;[name]</code> | Llama al próximo jefe del viaje, o a uno elegido (`vespera`, `ignis`, `malakor`…), y la escena pasa a su bioma. `/cronicas boss list` llama a un jefe de lista de tareas, con escudo. |
| <code>/cronicas&nbsp;hit</code> | Golpea al jefe en escena; contra un jefe de lista, completa una tarea. El último golpe es el crítico. |
| <code>/cronicas&nbsp;elite</code> | El próximo combate normal será la élite (Gólem de Obsidiana) con un trofeo. |
| <code>/cronicas&nbsp;walk&nbsp;[segundos]</code> | Lua camina unos segundos por el bioma actual (8 por defecto, hasta 120) para ver cómo ruedan las capas en bucle, y luego se detiene respirando. |
| <code>/cronicas&nbsp;stage&nbsp;[bioma]</code> | Un cambio de fase solo para mirar: Lua sale caminando, el siguiente bioma (o el que pidas: `mar`, `volcan`, `eclipse`…) aparece con su título y ella vuelve a entrar. No cuenta página. |
| <code>/cronicas&nbsp;vigil</code> | Deja la luz de luna casi al final para ver la Vigilia en acción (con el farol encendido, envía un mensajito de verdad). |
| <code>/cronicas&nbsp;new-moon</code> | Simula la luna nueva (caché fría) hasta la próxima respuesta de Claude. |

⚠️ Los comandos de prueba (`boss`, `hit`, `elite`) cuentan de verdad: un jefe derrotado así también devuelve página y nivel.

El juego habla inglés, portugués, español, francés, alemán, chino, japonés y coreano (sigue el idioma del sistema; `/cronicas language` lo cambia).

## Licencia
- **Código** (scripts de Python, `mod/`): **MIT**, ver [`LICENSE`](LICENSE).
- **Arte y personajes** (todo lo que hay en `assets/`, el arte incrustado en el mod, los sonidos y las previsualizaciones): **© 2026 George Altran (@geoaltran), [CC BY-NC 4.0](LICENSE-ART)**. Compártelo, haz remixes, haz fan art: solo da el crédito **"Art by George Altran (@geoaltran)"** con un enlace. **Sin uso comercial** sin autorización; hay licencia comercial bajo consulta.
- **Fuentes**: Silkscreen, Pixelify Sans y Fusion Pixel Font (chino, japonés y coreano), **SIL Open Font License 1.1** (las licencias están junto a ellas).

El texto legal válido es el de la licencia en inglés. Créditos completos en [`CREDITS.md`](CREDITS.md).
