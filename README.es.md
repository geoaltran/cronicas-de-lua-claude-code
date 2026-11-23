[English](README.md) · [Português](README.pt-BR.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center"><img src="previa_marca.svg" alt="Logo animado de Las Crónicas de Lua" width="824"></p>

# 🌙 Las Crónicas de Lua · *As Crônicas de Lua*

Un mod RPG en pixel art para Claude Code. Cada herramienta es un monstruo, tu ventana de contexto es una mochila, tu límite de uso es maná, y Lua, una pequeña maga lunar, se enfrenta a todos mientras Claude trabaja. Jefes, XP, niveles y un bestiario. Técnicamente, sigues programando.

![Lua luchando contra un monstruo mientras Claude trabaja](previa_luta.gif)

## Qué es
Una franja justo encima de la caja de mensajes. Mientras Claude trabaja, Lua camina por un bosque en parallax; cada vez que Claude usa una herramienta, aparece un monstruo y ella lo combate. Detrás del juego, la franja es un panel honesto de tu sesión: qué tan caliente sigue la caché del prompt, cuánto queda del límite de tu plan y qué tan llena está la ventana de contexto.

![Lua caminando por el bosque](previa_caminhada.gif)

## Instalación
En una sesión de Claude Code, escribe:

```text
/plugin install cronicas-de-lua --marketplace geoaltran/cronicas-de-lua-claude-code
```

Responde `y` para añadir el marketplace y elige un alcance. La franja aparece encima de la caja de mensajes.

Requiere un Claude Code reciente con soporte para mods (creado y probado en la 2.1.330).

El mod ejecuta solo dos comandos de lectura en tu equipo: `ps` (para saber cuándo se reinició la app, por la introducción) y, en macOS, `defaults read -g AppleLanguages` (el idioma del sistema).

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
| **Luz de Luna** (dorado pálido) | Qué tan caliente sigue la caché del prompt (tiempo desde la última respuesta frente a la vida de la caché). Una luna en el cielo mengua con ella. **Luna nueva** = Lua se desmaya y el próximo mensaje cuesta más (la caché está fría). |
| **Maná Estelar** | Lo que queda del límite de 5 horas de tu plan (el de 7 días, en el globo de ayuda). |
| **Mochila** | Cuánto de la ventana de contexto está en uso. Por encima del 80 %, la mochila tiembla y sugiere ordenarla (compactar). |
| **XP / Nivel** | Sube mientras trabajas. Cada 2 niveles, la varita y la ropa de Lua brillan un poco más. |

## Los botones
| Botón | Hace |
|---|---|
| 🏮 **Vigilia** | Mantiene la caché caliente enviando un mensaje cortito justo antes de que se apague la luz de luna (como mucho 6 veces, y solo mientras no estás). **Apagada por defecto: gasta el límite de tu plan.** |
| 🎒 **Mochila** | Ofrece compactar la conversación (como `/compact`), con confirmación. |
| 🚩 **Estandarte** | Pide a Claude un resumen de la misión para continuar en una sesión nueva. |
| 📖 **Libro** | Abre el Libro de Lua: su ficha, el bestiario de jefes derrotados, la estantería de trofeos y el grimorio (las herramientas de Claude como hechizos). |

## Qué pasa en el juego
| Evento real | En el juego |
|---|---|
| Inactivo, entre tareas | Lua camina, o se queda quieta respirando y parpadeando |
| Empieza una herramienta | Entra un monstruo, aparece un "!" sobre Lua y ella lanza una estrella |
| La herramienta sale bien | Pausa de impacto, el monstruo parpadea, retrocede y estalla en estrellas; número de daño |
| Una herramienta lenta | Lua canaliza con un círculo mágico a sus pies |
| La herramienta falla | El monstruo contraataca; Lua parpadea en rojo (solo visual) |
| Un error corregido después | Élite (Gólem de Obsidiana); al caer deja un trofeo para la estantería |
| Se crea una lista de tareas, o cada 12 combates | **Jefe**: vida en bloques, uno por tarea. Los golpes normales rebotan en su **escudo** (Lua se rasca la cabeza ❓💧); una tarea terminada tumba un bloque; la última es un golpe **CRÍTICO**. El jefe cae con una página recuperada (x/10) y una subida de nivel |

![Un combate contra un jefe](previa_chefao.gif)

Monstruos por herramienta: leer archivos → Vespera · editar código → Relojero / Sir Solis · terminal → Ignis · web → Leviatán / Nébula · integraciones (MCP) → Rey Espejo · subagentes → clones de Dama Penumbra. Los jefes llegan en orden, una página de las Crónicas cada uno, hasta Malakor, y luego Nueva Partida+.

## Comandos
`/cronicas` muestra el resumen de Lua. Los más útiles: `/cronicas ruler` y `/cronicas width <px>` (calibrar el ancho), `/cronicas boss` y `/cronicas hit` (probar un combate contra un jefe), `/cronicas surfaces` (dónde se está dibujando la sesión), `/cronicas language` (elegir el idioma del juego). El juego habla inglés, portugués, español, francés, alemán, chino, japonés y coreano (sigue el idioma del sistema; `/cronicas language` lo cambia).

## Licencia
- **Código** (scripts de Python, `mod/`): **MIT**, ver [`LICENSE`](LICENSE).
- **Arte y personajes** (todo lo que hay en `assets/`, el arte incrustado en el mod, los sonidos y las previsualizaciones): **© 2026 George Altran (@geoaltran), [CC BY-NC 4.0](LICENSE-ART)**. Compártelo, haz remixes, haz fan art: solo da el crédito **"Art by George Altran (@geoaltran)"** con un enlace. **Sin uso comercial** sin autorización; hay licencia comercial bajo consulta.
- **Fuentes**: Silkscreen, Pixelify Sans y Fusion Pixel Font (chino, japonés y coreano), **SIL Open Font License 1.1** (las licencias están junto a ellas).

El texto legal válido es el de la licencia en inglés. Créditos completos en [`CREDITS.md`](CREDITS.md).
