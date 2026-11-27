# Changelog

What changed in each version of The Chronicles of Lua. To update, run `/plugin marketplace update cronicas-de-lua` and then `/plugin update cronicas-de-lua@cronicas-de-lua`; in the desktop app, where `/plugin` only opens the plugins window, run `claude plugin marketplace update cronicas-de-lua` and `claude plugin update cronicas-de-lua@cronicas-de-lua` in the Terminal (`/cronicas updates` shows the same).

## 1.1.5 · 2026-11-27
- **Fix:** `/cronicas updates` now also shows how to update from the Terminal (`claude plugin marketplace update cronicas-de-lua`, then `claude plugin update cronicas-de-lua@cronicas-de-lua`). In the desktop app, `/plugin` only opens the plugins window and doesn't update.

## 1.1.4 · 2026-11-27
- **Fix:** the Moonlight countdown ("57 MIN") no longer blinks during fights. Each redraw of the scene used to hide the number for a frame.

## 1.1.3 · 2026-11-26
- **Narrow bands look cleaner.** The bars switch to a smaller pixel font and the buttons shrink to sit beside them; on very narrow bands the small buttons move into the scene, bottom right, so they never cover the characters' heads. Their tooltips now open above them and point at the right button.
- **Fix:** after a boss falls, the old biome no longer flickers into the next one before the stage transition.
- **Fix:** if a boss shows up while Lua is out for a walk, she stops together with the scenery instead of walking in place.

## 1.1.2 · 2026-11-25
- **New version notice:** once a day the mod checks the published version and shows a little star on the Book when an update is out (`/cronicas updates`).
- **Commands page** in Lua's Book, listing every `/cronicas` command.

## 1.1.1 · 2026-11-25
- Common fights now show a preview of the next boss.
- `/cronicas walk` (a stroll through the current biome) and `/cronicas stage` (jump to the next biome, or a named one).

## 1.1.0 · 2026-11-25
- **9 parallax biomes**, one per boss, each at its own time of day and with its own animations (falling stars, the eclipse corona, the lighthouse, lava, gears and more).
- **Stage transitions** with the page title when a boss falls, and a **journey map** in the Book.
- Redrawn bosses (Clockmaker, Nebula, Golem, Vespera, Malakor) at Lua's pixel size.
- READMEs and GIFs refreshed in all 8 languages.

## 1.0.2 · 2026-11-24
- Progress adds up across sessions, the fight pulses with the real work, and Lua falls asleep when the moonlight runs out.

## 1.0.1 · 2026-11-24
- XP depends on the size of the victory.

## 1.0.0 · 2026-11-23
- First release: Lua, monsters for every kind of tool call, boss fights for to-do lists, the HUD (moonlight, star mana, backpack, XP), the four buttons, Lua's Book, and the game in 8 languages.
