[English](README.md) · **Português** · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

<p align="center"><img src="previa_marca.svg" alt="Marca animada de As Crônicas de Lua" width="824"></p>

# 🌙 As Crônicas de Lua

Um mod de RPG em pixel art para o Claude Code. Cada ferramenta é um monstro, a janela de contexto é uma mochila, o limite do plano é mana, e a Lua, uma pequena maga da lua, enfrenta todos enquanto o Claude trabalha. Chefões, XP, níveis e um bestiário. Tecnicamente, você continua programando.

![A Lua lutando com um monstro enquanto o Claude trabalha](previa_luta.gif)

## O que é
Uma faixa logo acima da caixa de mensagem. Enquanto o Claude trabalha, a Lua atravessa 9 biomas em parallax; cada vez que o Claude usa uma ferramenta, um monstro aparece e ela luta. Por trás do jogo, a faixa é um painel honesto da sua sessão: o quanto o cache da conversa ainda está quente, quanto resta do limite do plano e o quanto a janela de contexto já encheu.

![A Lua andando pela floresta](previa_caminhada.gif)

## Instalar
Numa sessão do Claude Code, digite:

```text
/plugin install cronicas-de-lua --marketplace geoaltran/cronicas-de-lua-claude-code
```

Responda `y` para adicionar o marketplace e escolha onde instalar. A faixa aparece acima da caixa de mensagem.

Precisa de um Claude Code recente, com suporte a mods (feito e testado na 2.1.331).

O mod roda só dois comandos de leitura na sua máquina: `ps` (para saber quando o app reiniciou, por causa da abertura) e, no macOS, `defaults read -g AppleLanguages` (o idioma do sistema).

**Atualizações.** Uma vez por dia, na primeira sessão, o mod também lê o número da versão publicada neste repositório (um arquivo público no GitHub). Nada sobre você ou suas conversas é enviado, e nada é baixado nem instalado sozinho. Quando sai uma versão nova, o botão do Livro ganha uma estrelinha e o balão dele avisa; para atualizar, digite `/plugin marketplace update cronicas-de-lua`, depois `/plugin update cronicas-de-lua@cronicas-de-lua`, e abra uma sessão nova. `/cronicas updates off` desliga a conferência (ela também fica desligada com `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`). Se preferir que as atualizações cheguem sozinhas, o Claude Code tem uma opção própria de atualização automática dos marketplaces.

## Onde funciona
| Lugar | O que aparece |
|---|---|
| **App desktop do Claude (aba Code)** | O jogo completo: cena animada, balões no hover, botões em pixel art clicáveis, o painel do Livro. |
| **VS Code** | A mesma cena animada; os botões ficam numa linha embaixo (o VS Code não tem hover dentro do desenho). |
| **Terminal** | Uma versão compacta em texto, com barras coloridas e emojis. |
| **App do celular** | Ainda não: hoje o app não desenha a faixa dos mods pelo Remote Control. |

## As barras
| Barra | Significa |
|---|---|
| **Luz da Lua** (dourado pálido) | O quanto o cache da conversa ainda está quente (tempo desde a última resposta x a duração do cache). Uma lua no céu mingua junto. **Lua nova** = a Lua adormece e a próxima mensagem sai mais cara (o cache esfriou). |
| **Mana Estelar** | O que resta do limite de 5 h do plano (o de 7 dias no balão). |
| **Mochila** | Quanto da janela de contexto já foi usado. Acima de 80% a mochila treme e sugere arrumar (compactar). |
| **XP / Nível** | Sobe com o uso. A cada 2 níveis a varinha e a roupa da Lua brilham um pouco mais. |

## Os botões
| Botão | Faz |
|---|---|
| 🏮&nbsp;**Vigília** | Mantém o cache quente mandando uma mensagem curtinha pouco antes de o luar acabar (no máximo 6 vezes, só enquanto você está fora). **Começa desligada: gasta o limite do plano.** |
| 🎒&nbsp;**Mochila** | Oferece compactar a conversa (como o `/compact`), com confirmação. |
| 🚩&nbsp;**Estandarte** | Pede ao Claude um resumo da missão para continuar numa sessão nova. |
| 📖&nbsp;**Livro** | Abre o Livro da Lua: a ficha dela, o mapa da jornada (os biomas visitados), o bestiário dos chefões derrotados, a estante de troféus e o grimório (as ferramentas do Claude como feitiços), mais uma página de Comandos com todos os comandos do `/cronicas` e um link para a explicação deles aqui. Quando sai uma versão nova, uma estrelinha brilha no Livro e a página de Comandos mostra como atualizar. |

![O Livro da Lua: ficha, mapa da jornada, bestiário, troféus e grimório](previa_livro.gif)

## O que acontece no jogo
| Evento real | No jogo |
|---|---|
| Ocioso, entre tarefas | A Lua anda, ou fica parada respirando e piscando |
| Uma ferramenta começa | Um monstro entra, "!" sobre a Lua, ela lança uma estrela |
| A ferramenta dá certo | Pausa de impacto, o monstro pisca, recua e explode em estrelinhas; número de dano |
| Ferramenta demorada | A Lua canaliza com um círculo mágico aos pés |
| A ferramenta dá erro | O monstro contra-ataca; a Lua pisca vermelho (só visual) |
| Um erro consertado depois | Elite (Golem de Obsidiana); quando cai, deixa um troféu para a estante |
| Lista de tarefas criada, ou a cada 12 lutas | **Chefão**: vida em blocos, um por tarefa. Golpes comuns batem no **escudo** (a Lua coça a cabeça ❓💧); tarefa concluída derruba um bloco; a última é o golpe **CRÍTICO**. O chefão cai com uma página recuperada (x/10) e um nível a mais, e a Lua segue para o bioma seguinte |

![Luta contra a Dama Penumbra: o escudo segura, uma tarefa derruba um bloco, golpe crítico](previa_chefao_penumbra.gif)

![Luta contra o Relojoeiro na Torre do Relógio](previa_chefao_relojoeiro.gif)

![Luta contra o Golem de Obsidiana nas Ruínas](previa_chefao_golem.gif)

Monstros por ferramenta: ler arquivos → Vespera · editar código → Relojoeiro / Sir Solis · terminal → Ignis · web → Leviatã / Nébula · integrações (MCP) → Rei Espelho · subagentes → clones da Dama Penumbra. Os chefões vêm em ordem, uma página das Crônicas cada, até o Malakor; depois, Novo Jogo+. De vez em quando (mais ou menos 1 luta comum em 4), quem entra é o chefão da página atual, uma prévia do que vem.

## Os biomas
Lunária tem 9 biomas, um para cada parte da jornada, cada um num horário do dia e com animações próprias: Floresta (Vespera e Dama Penumbra), Ruínas (Golem), Mar (Leviatã), Vulcão (Ignis), Torre do Relógio (Relojoeiro), Aurora (Sir Solis), Castelo de Vidro (Rei Espelho), Céu Estelar (Nébula) e Eclipse (Malakor). Ondas e um farol girando, lava pulsando, engrenagens, raios de sol, reflexos nos espelhos, estrelas cadentes, partículas próprias de cada lugar.

![A Lua passando pelos 9 biomas](previa_biomas.gif)

Quando o chefão de um bioma cai, vem a **passagem de fase**: a Lua sai andando pela borda, a tela escurece e ela entra no bioma seguinte, com o título da página em pixel.

![Passagem de fase: das Ruínas para o Mar, com o título da página](previa_passagem.gif)

## Comandos
Digite na caixa de mensagem do Claude, como uma mensagem normal. A resposta aparece só para você: o Claude não recebe nada e o limite do plano não é gasto. Os nomes em inglês (`language`, `ruler`, `width`, `boss`, `hit`…) também funcionam. A lista completa, com os comandos técnicos, está em [`COMANDOS_CRONICAS.md`](COMANDOS_CRONICAS.md).

| Comando | O que faz |
|---|---|
| <code>/cronicas</code> | Resumo da Lua: nível, XP, páginas recuperadas (x/10), últimos troféus e os ajustes da faixa. Também lista todos os comandos. |
| <code>/cronicas&nbsp;idioma&nbsp;[código]</code> | Mostra os idiomas do jogo ou troca para um: `en`, `pt-BR`, `es`, `fr`, `de`, `zh`, `ja`, `ko` (`auto` volta ao idioma do sistema). |
| <code>/cronicas&nbsp;updates&nbsp;[check&#124;off&#124;on]</code> | Mostra a sua versão e se saiu uma nova, com o jeito de atualizar. `check` confere agora; `off` / `on` desliga ou liga a conferência diária. Também `atualizacao`. |
| <code>/cronicas&nbsp;regua</code> | Mostra uma régua embaixo da cena para medir a faixa. Digite de novo para esconder. |
| <code>/cronicas&nbsp;largura&nbsp;&lt;px&gt;</code> | Calibra a largura com o último número inteiro na borda direita da régua (ex.: `/cronicas largura 752`). |
| <code>/cronicas&nbsp;escala&nbsp;1&#124;2&#124;3</code> | Tamanho do pixel da cena: 1x, 2x ou 3x. |
| <code>/cronicas&nbsp;abertura</code> | Mostra a abertura agora (um clique pula). `abertura off` / `abertura on` desliga ou liga a automática (primeira sessão do dia). |
| <code>/cronicas&nbsp;superficies</code> | Diz onde esta sessão está sendo desenhada (app, VS Code, terminal, celular). |
| <code>/cronicas&nbsp;chefao&nbsp;[nome]</code> | Chama o próximo chefão da jornada, ou um escolhido (`vespera`, `dama`, `relojoeiro`…), e a cena vai para o bioma dele. `/cronicas chefao lista` chama um chefão de lista de tarefas, com escudo. |
| <code>/cronicas&nbsp;golpe</code> | Golpeia o chefão em cena; no chefão de lista, conclui uma tarefa. O último golpe é o crítico. |
| <code>/cronicas&nbsp;elite</code> | A próxima luta comum vira o elite (Golem de Obsidiana) com um troféu. |
| <code>/cronicas&nbsp;passear&nbsp;[segundos]</code> | A Lua anda uns segundos pelo bioma em que está (8 por padrão, até 120), para ver as camadas rolando em laço, e depois para respirando. Também `walk`. |
| <code>/cronicas&nbsp;fase&nbsp;[bioma]</code> | Passagem de fase só para ver: a Lua sai andando, o próximo bioma (ou o pedido: `mar`, `vulcao`, `eclipse`…) clareia com o título e ela entra de novo. Não conta página. Também `stage`. |
| <code>/cronicas&nbsp;vigilia</code> | Deixa o luar perto do fim para ver a Vigília funcionando (com a lanterna acesa, ela manda uma mensagem curtinha de verdade). |
| <code>/cronicas&nbsp;lua-nova</code> | Simula a lua nova (cache frio) até a próxima resposta do Claude. |

⚠️ Os comandos de teste (`chefao`, `golpe`, `elite`) contam de verdade: um chefão derrotado assim também devolve página e nível.

O jogo fala inglês, português, espanhol, francês, alemão, chinês, japonês e coreano (segue o idioma do sistema; `/cronicas idioma` troca).

## Licença
- **Código** (scripts Python, `mod/`): **MIT**, ver [`LICENSE`](LICENSE).
- **Arte e personagens** (tudo em `assets/`, a arte embutida no mod, os sons e as prévias): **© 2026 George Altran (@geoaltran), [CC BY-NC 4.0](LICENSE-ART)**. Compartilhe, faça remix, fan art: só dê o crédito **"Arte de George Altran (@geoaltran)"** com o link. **Uso comercial só com autorização**; licença comercial sob consulta. O texto legal que vale é o da Creative Commons, em inglês.
- **Fontes**: Silkscreen, Pixelify Sans e Fusion Pixel Font (chinês, japonês e coreano), **SIL Open Font License 1.1** (as licenças ficam junto delas).

Créditos completos em [`CREDITS.md`](CREDITS.md).
