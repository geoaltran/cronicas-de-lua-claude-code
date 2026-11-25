[English](README.md) · [Português](README.pt-BR.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **中文** · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center"><img src="previa_marca.svg" alt="Lua 编年史动态标志" width="824"></p>

# 🌙 Lua 编年史 · *As Crônicas de Lua*

一款为 Claude Code 打造的像素风 RPG 模组。每次工具调用都是一只怪物，上下文窗口是你的背包，用量限额是你的法力，而小小的月之法师 Lua 会在 Claude 干活的时候把它们一一打倒。有 Boss 战、经验值、等级，还有怪物图鉴。严格来说，你仍然在写代码。

![Claude 工作时，Lua 正在和怪物战斗](previa_luta.gif)

## 这是什么
一条横幅，就在输入框正上方。Claude 工作时，Lua 会走过 9 个视差滚动的生物群系；Claude 每用一次工具，就会冒出一只怪物，她便上前迎战。在游戏背后，这条横幅如实反映着你的会话状态：提示词缓存还有多"热"、套餐限额还剩多少、上下文窗口已经装了多满。

![Lua 在森林里漫步](previa_caminhada.gif)

## 安装
在 Claude Code 会话中输入：

```text
/plugin install cronicas-de-lua --marketplace geoaltran/cronicas-de-lua-claude-code
```

输入 `y` 添加该插件市场，然后选择安装范围。横幅会出现在输入框上方。

需要支持模组的较新版本 Claude Code（基于 2.1.331 开发和测试）。

本模组只会在你的电脑上运行两个只读命令：`ps`（用于判断应用是否重启，以显示开场动画），以及在 macOS 上运行 `defaults read -g AppleLanguages`（读取系统语言）。

## 在哪里运行
| 界面 | 效果 |
|---|---|
| **Claude 桌面应用（Code 标签页）** | 完整游戏：动画场景、鼠标悬停提示、可点击的像素按钮，以及"书"面板。 |
| **VS Code** | 同样的动画场景；按钮排成一行放在下方（VS Code 不支持在画面内悬停）。 |
| **终端** | 紧凑的文字版，带彩色进度条和表情符号。 |
| **手机应用** | 暂不支持：目前应用还不会通过 Remote Control 绘制模组横幅。 |

## 状态条
| 状态条 | 含义 |
|---|---|
| **月光**（淡金色） | 提示词缓存还有多"热"（距上次回复的时间与缓存有效期之比）。天上的月亮会随之亏缺。**新月** = Lua 睡着了，下一条消息会更贵（缓存已冷）。 |
| **星辰法力** | 套餐 5 小时限额的剩余量（7 天限额显示在悬停提示里）。 |
| **背包** | 上下文窗口的已用比例。超过 80% 时背包会抖动，提醒你整理一下（压缩对话）。 |
| **经验值 / 等级** | 随着你的工作不断增长。每升 2 级，Lua 的法杖和服装就会更闪亮一点。 |

## 按钮
| 按钮 | 作用 |
|---|---|
| 🏮&nbsp;**守夜** | 在月光熄灭前发送一条很短的消息，让缓存保持温热（最多 6 次，且只在你离开时进行）。**默认关闭：它会消耗你的套餐限额。** |
| 🎒&nbsp;**背包** | 提议压缩对话（类似 `/compact`），需要确认。 |
| 🚩&nbsp;**旗帜** | 请 Claude 写一份任务总结，方便你在新会话中继续。 |
| 📖&nbsp;**书** | 打开 Lua 之书：她的角色卡、旅程地图（她去过的生物群系）、已击败 Boss 的图鉴、奖杯架，以及魔导书（把 Claude 的工具当作咒语）。 |

![Lua 之书：角色卡、旅程地图、图鉴、奖杯和魔导书](previa_livro.gif)

## 游戏里会发生什么
| 真实事件 | 游戏中 |
|---|---|
| 空闲、任务之间 | Lua 四处走动，或站着呼吸、眨眼 |
| 工具开始运行 | 怪物登场，Lua 头上冒出"!"，她施放一颗星星 |
| 工具运行成功 | 命中停顿，怪物闪白、后退、炸成星星；跳出伤害数字 |
| 工具运行较慢 | Lua 脚下浮现魔法阵，开始引导施法 |
| 工具运行失败 | 怪物反击；Lua 闪红（仅为视觉效果） |
| 之后修复的错误 | 精英怪（黑曜石魔像）；它倒下后会留下一座奖杯放上奖杯架 |
| 创建任务清单时，或每打 12 场 | **Boss**：血量分块，每个任务一块。普通攻击会被它的**护盾**弹开（Lua 挠挠头 ❓💧）；完成一个任务就打掉一块；最后一击是**暴击**。Boss 倒下后，你会找回一页编年史（x/10）并升一级，Lua 随后前往下一个生物群系 |

![与半影夫人的 Boss 战：护盾挡住攻击，完成任务打掉一块血，最后暴击](previa_chefao_penumbra.gif)

![在钟楼与钟表匠的 Boss 战](previa_chefao_relojoeiro.gif)

![在遗迹与黑曜石魔像的 Boss 战](previa_chefao_golem.gif)

各工具对应的怪物：读取文件 → Vespera · 编辑代码 → 钟表匠 / Sir Solis · 终端 → Ignis · 网页 → 利维坦 / Nébula · 外部集成（MCP）→ 镜之王 · 子代理 → 半影夫人的分身。Boss 按顺序登场，每个对应编年史中的一页，直到 Malakor，之后进入"新游戏+"。

## 生物群系
Lunária 有 9 个生物群系，旅程的每一段各有一个，每个都处在一天中的不同时刻，也各有自己的动画：森林（Vespera 和半影夫人）、遗迹（黑曜石魔像）、大海（利维坦）、火山（Ignis）、钟楼（钟表匠）、黎明（Sir Solis）、玻璃城堡（镜之王）、星空（Nébula）和日食（Malakor）。海浪与旋转的灯塔、脉动的熔岩、转动的齿轮、阳光、在镜面上流动的反光、流星，还有每个地方独有的粒子。

![Lua 走过 9 个生物群系](previa_biomas.gif)

某个生物群系的 Boss 倒下后，就进入**换关**：Lua 走出画面边缘，屏幕渐暗，然后她走进下一个生物群系，像素风的页码标题随之出现。

![换关：从遗迹到大海，出现页码标题](previa_passagem.gif)

## 命令
像普通消息一样在 Claude 的输入框里输入即可。回复只有你能看到：Claude 收不到任何内容，也不会消耗套餐限额。每个子命令也接受葡萄牙语名字（`regua`、`largura`、`chefao`、`golpe`…）。

| 命令 | 作用 |
|---|---|
| <code>/cronicas</code> | Lua 的概况：等级、经验值、找回的书页（x/10）、最新的奖杯和横幅设置。也会列出所有命令。 |
| <code>/cronicas&nbsp;language&nbsp;[code]</code> | 列出游戏语言或切换到其中一种：`en`、`pt-BR`、`es`、`fr`、`de`、`zh`、`ja`、`ko`（`auto` 回到系统语言）。 |
| <code>/cronicas&nbsp;ruler</code> | 在画面下方显示标尺，用来测量横幅。再输入一次即可隐藏。 |
| <code>/cronicas&nbsp;width&nbsp;&lt;px&gt;</code> | 用标尺右边缘最后一个完整的数字校准宽度（例如 `/cronicas width 752`）。 |
| <code>/cronicas&nbsp;scale&nbsp;1&#124;2&#124;3</code> | 画面的像素大小：1x、2x 或 3x。 |
| <code>/cronicas&nbsp;intro</code> | 立即播放开场动画（点击即可跳过）。`intro off` / `intro on` 关闭或打开自动播放（每天的第一个会话）。 |
| <code>/cronicas&nbsp;surfaces</code> | 显示这个会话正在哪里绘制（桌面应用、VS Code、终端、手机）。 |
| <code>/cronicas&nbsp;boss&nbsp;[name]</code> | 召唤旅程中的下一个 Boss，或指定的 Boss（`vespera`、`ignis`、`malakor`…），场景会切换到它的生物群系。`/cronicas boss list` 召唤带护盾的任务清单 Boss。 |
| <code>/cronicas&nbsp;hit</code> | 攻击场上的 Boss；面对任务清单 Boss 时完成一个任务。最后一击是暴击。 |
| <code>/cronicas&nbsp;elite</code> | 下一场普通战斗变成带着奖杯的精英（黑曜石魔像）。 |
| <code>/cronicas&nbsp;vigil</code> | 让月光快要耗尽，好看看守夜如何工作（灯笼点亮时，它会真的发出一条很短的消息）。 |
| <code>/cronicas&nbsp;new-moon</code> | 模拟新月（缓存变冷），直到 Claude 下一次回复。 |

⚠️ 测试命令（`boss`、`hit`、`elite`）是真的算数的：这样打败的 Boss 也会带来书页和等级。

游戏支持英语、葡萄牙语、西班牙语、法语、德语、中文、日语和韩语（默认跟随系统语言，可用 `/cronicas language` 切换）。

## 许可
- **代码**（Python 脚本、`mod/`）：**MIT**，见 [`LICENSE`](LICENSE)。
- **美术与角色**（`assets/` 中的全部内容、模组内嵌的美术、音效和预览图）：**© 2026 George Altran (@geoaltran)，[CC BY-NC 4.0](LICENSE-ART)**。欢迎分享、二次创作和同人创作，只需注明 **"Art by George Altran (@geoaltran)"** 并附上链接。**未经授权不得用于商业用途**；商业授权可另行洽谈。
- **字体**：Silkscreen、Pixelify Sans 和 Fusion Pixel Font（中文、日语、韩语），**SIL Open Font License 1.1**（许可证文件与字体放在一起）。

具有法律效力的是英文版许可文本。完整致谢见 [`CREDITS.md`](CREDITS.md)。
