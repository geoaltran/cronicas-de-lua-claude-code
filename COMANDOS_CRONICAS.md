# ⌨️ As Crônicas de Lua: comandos

Todos os comandos do mod começam com **`/cronicas`** e são digitados na caixa de mensagem do Claude, como uma mensagem normal. A resposta aparece logo abaixo, só pra mim: o Claude não recebe nada nem gasta limite do plano com eles.

Os comandos servem pra três coisas: **ver como está a jornada**, **ajustar a faixa** na tela e **testar partes do jogo** sem esperar elas acontecerem sozinhas.

## 🌍 Nomes em inglês

Todo subcomando também tem um **nome em inglês**, que funciona em qualquer idioma do jogo (é o que os READMEs em outras línguas ensinam). O nome em português continua valendo. Maiúsculas não importam.

| Inglês | Português |
|---|---|
| `language` (`lang`) | `idioma` |
| `intro` | `abertura` |
| `scale` | `escala` |
| `ruler` | `regua` |
| `width` | `largura` (e `phone` além de `celular` no fim) |
| `column` | `coluna` |
| `image` · `frame` | `imagem` · `quadro` |
| `test` | `teste` |
| `line` | `linha` |
| `probe` | `prova` |
| `boss` (`boss list`) | `chefao` (`chefao lista`) |
| `hit` | `golpe` |
| `elite` | `elite` |
| `vigil` | `vigilia` |
| `new-moon` | `lua-nova` |
| `surfaces` | `superficies` |

## 📜 Ver a jornada

| Comando | O que faz |
|---|---|
| `/cronicas` | Mostra o resumo: nível da Lua, XP, páginas recuperadas (x/10), os últimos 5 troféus e os ajustes da faixa (escala, largura, modo). Também lista os outros comandos. |
| `/cronicas abertura` | Mostra agora a **tela de abertura** na faixa (uns 7 s): a marca "As Crônicas de Lua" animada no céu (a lua balança na corrente, as estrelas piscam, um reflexo passa no metal), a noite fecha, a floresta clareia e a Lua chega andando. **Um clique na cena pula.** Ela aparece sozinha na **primeira sessão do dia** e na **primeira sessão depois que você reinicia o app**. Também funciona como `/cronicas intro`. |
| `/cronicas abertura off` · `on` | Desliga (ou liga de novo) a abertura automática (primeira sessão do dia e depois de reiniciar o app). `/cronicas abertura` continua mostrando quando você pedir. Também aceita `desligar`/`ligar`. |

## 🌐 Idioma

| Comando | O que faz |
|---|---|
| `/cronicas language` | Mostra os 8 idiomas do jogo, cada um escrito no próprio idioma (English, Português, Español, Français, Deutsch, 中文, 日本語, 한국어), com o atual marcado (▸). Todos já traduzidos: inglês, português, espanhol, francês, alemão, chinês, japonês e coreano (`en`, `pt-BR`, `es`, `fr`, `de`, `zh-CN`, `ja`, `ko`). Também funciona como `/cronicas lang` ou `/cronicas idioma`. |
| `/cronicas language <idioma>` | Troca o idioma de todo o jogo e guarda a escolha para as próximas sessões. Aceita o código ou o nome: `pt-BR` ou `pt` ou `português`, `en`, `es`, `fr`, `de`, `zh`, `ja`, `ko`. Em chinês, japonês e coreano a faixa e o Livro usam a fonte pixel Fusion Pixel. |
| `/cronicas language auto` | Esquece a escolha e volta ao idioma do sistema (no Mac, o das preferências de idioma; sem tradução, inglês). Também aceita `sistema`. |

**O jogo fala os 8 idiomas**: inglês, português, espanhol, francês, alemão, chinês, japonês e coreano.

## 🖼️ Ajustar a faixa

| Comando | O que faz |
|---|---|
| `/cronicas escala 1` · `2` · `3` | Tamanho do pixel da cena: 1x, 2x ou 3x. |
| `/cronicas regua` | Liga uma régua embaixo da cena pra medir a largura da faixa. Digite de novo pra desligar. |
| `/cronicas largura <px> [vscode\|celular\|desktop]` | Calibra a largura com o número que a régua mostrou inteiro na borda direita (ex.: `/cronicas largura 752`). A cena passa a acompanhar a largura da faixa e a régua desliga sozinha. **Cada lugar tem a sua calibração** (app, VS Code, celular); sem o nome no fim, vale o lugar onde a faixa apareceu por último. |
| `/cronicas coluna <px>` | Ajuste fino: quantos pixels mede cada coluna de texto da faixa (de 4 a 20; o padrão é 8,9). Normalmente não precisa: use a régua e a largura. |
| `/cronicas imagem` | Modo **imagem** (o padrão): mostra toda a arte e as animações, e os balões de explicação aparecem ao passar o mouse nas barras e no selo de nível. |
| `/cronicas quadro` | Modo **quadro** (antigo): balões feitos dentro do desenho, mas no app esse modo não mostra as imagens. Só para testes. |
| `/cronicas teste` | Mostra a faixa duas vezes, uma em cada modo, pra comparar. Digite de novo pra desligar. |
| `/cronicas linha <px>` | Altura de uma linha de texto da faixa em px (de 8 a 40; o padrão é 20, medido no app). As áreas de mouse e de clique por cima da cena são posicionadas em linhas e colunas, então esta medida acerta a altura delas. Só mude se os balões aparecerem deslocados na vertical. |

### 📏 Como calibrar a largura (passo a passo)
1. `/cronicas regua`
2. Veja qual é o último número que aparece **inteiro** na borda direita da régua.
3. `/cronicas largura <esse número>`

## 🧪 Testar o jogo

Estes comandos fazem acontecer na hora o que normalmente depende do trabalho do Claude. ⚠️ **Eles contam de verdade:** um chefão derrotado pelo teste também recupera página e sobe nível, e um elite de teste também dá troféu e XP.

| Comando | O que faz |
|---|---|
| `/cronicas chefao` | Chama o **próximo chefão da jornada**, com 3 de vida. A cena vai para o **bioma** dele; quando ele cai, a passagem de fase leva a Lua ao bioma da página seguinte. |
| `/cronicas chefao <nome>` | Chama **um chefão específico**, com 3 de vida. Aceita o nome com ou sem acento, só o começo, ou o começo de qualquer palavra do nome (`solis`, `espelho`, `obsidiana`): `vespera`, `dama`, `golem`, `leviata`, `ignis`, `relojoeiro`, `sir solis`, `rei espelho`, `nebula`, `malakor`. |
| `/cronicas chefao lista` | Chama um **chefão de lista de tarefas** (de mentira), com 3 tarefas: a vida vem em blocos, um por tarefa. Enquanto ele está em cena, cada ferramenta que o Claude usa bate no **escudo** e tira só um pouquinho (número pequeno cinza; às vezes 0). Também aceita o número de tarefas e o nome: `/cronicas chefao lista 5 relojoeiro`. |
| `/cronicas golpe` | Uma **luta de verdade** contra o chefão em cena, como se o Claude tivesse usado uma ferramenta: a Lua ataca, o chefão pisca branco, recua e treme, e sai o número de dano. Cada golpe é uma luta (vários seguidos entram na fila). Num chefão comum, tira 1 de vida. Num chefão de lista, **conclui uma tarefa**: a vida desce até o fim do bloco. O golpe que derruba é **CRÍTICO** (número grande dourado, a cena treme); ele se desfaz em pixels, sobe "+PÁGINA x/10" e a Lua ganha um nível. |
| `/cronicas elite` | A **próxima luta comum** vira o elite (Golem de Obsidiana). Quando ele cai, o troféu aparece grande no lugar dele por uns segundos. Cada vez que você roda, vem um troféu diferente: 🔥 taça (comando), ⚙️ engrenagem (edição), 🌙 lua (leitura), 🪐 orbe (web). Depois de rodar, peça ao Claude qualquer coisa que use uma ferramenta (ler um arquivo, por exemplo). |
| `/cronicas vigilia` | Deixa o **luar a 10 s** da hora em que a Vigília age, pra ver ela funcionando sem esperar quase uma hora. Com a lanterna acesa, a Lua manda a mensagem curtinha 10 s depois (a lanterna pisca e toca o som). ⚠️ Essa mensagem é de verdade: o Claude responde e gasta um pouquinho do limite. Também funciona como `/cronicas vigília`. |
| `/cronicas lua-nova` | Simula a **lua nova** (cache da conversa frio): a Lua desmaia e aparece o aviso de que a próxima mensagem sai mais cara. Volta ao normal na próxima resposta do Claude. |

> 💡 Só um chefão fica em cena por vez. Se já houver um, `/cronicas chefao` avisa e não chama outro: derrote o atual com `/cronicas golpe`.

## 🔧 Provas técnicas (desenvolvimento)

| Comando | O que faz |
|---|---|
| `/cronicas prova` | Liga a **prova técnica da Fase 4** (balões e botões no app). As áreas de mouse ganham borda (sobre as 4 barras e o selo de nível: a borda acende e surge o balão em pixel art), e a área clicável de cada um dos 4 botões aparece marcada com "•", num bloco contínuo (o clique faz a ação de verdade do botão; o mouse em cima mostra o balão). Serve pra ver onde as áreas caem. Digite de novo para desligar. |

## 🔘 Os 4 botões do HUD (à direita das barras)

Clique direto no ícone em pixel art. Passando o mouse, aparece o balão com o que ele faz.

| Botão | O que faz |
|---|---|
| 🏮 **Vigília** (🔥 acesa) | Começa **apagada**. Clicando, acende (a chama tremula, toca um som e aparece o aviso do custo). Acesa, quando o luar está pra acabar (5 min antes no cache de 1 h; 1 min antes no de 5 min) e o Claude está parado, a Lua manda uma mensagem curtinha pra manter o cache quente; a lanterna pisca e toca o som. **No máximo 6 mensagens** por vez que é acesa; depois ela apaga sozinha e avisa (com outro som). Clique de novo pra apagar. ⚠️ Cada mensagem gasta um pouco do limite do plano. Vale só pra conversa atual. |
| 🎒 **Mochila** | Arruma a conversa (compacta o contexto, como o `/compact`). Pede confirmação embaixo da cena: **Arrumar a mochila** ou **Agora não**. Fica cheia (ícone e barra tremendo) acima de 80%. Só funciona com o Claude parado. |
| 🚩 **Estandarte** | Pede ao Claude o **resumo da missão** pra continuar numa sessão nova (o `PROXIMA_SESSAO.md`). A bandeira ondula enquanto ele escreve; no fim, aparece **🌙 Nova conversa** (ou **Fechar**). Só funciona com o Claude parado. |
| 📖 **Livro** | Abre e fecha o painel do Livro, ao lado da conversa, com 5 abas: **Ficha** (a Lua, nível, XP, lutas, chefões, troféus e as páginas das Crônicas), **Mapa** (o mapa da jornada: os 9 biomas num caminho, os visitados em cor, e uma lua onde a Lua está), **Bestiário** (os 10 chefões; os que ainda não caíram ficam em silhueta), **Troféus** (a estante com os troféus dos elites; passe o mouse para ler o nome do erro) e **Grimório** (as ferramentas do Claude como feitiços, com quantas vezes cada uma foi usada). |

## 🔘 Botões abaixo da cena

| Botão | O que faz |
|---|---|
| 🌙 **Nova conversa** | Aparece na lua nova e depois do resumo do Estandarte. Pede confirmação e limpa a conversa (`/clear`), pra começar com o cache novo. |
| **Arrumar a mochila** / **Agora não** | Aparecem depois do clique na Mochila. |

---
*Última atualização: 25/11/2026 (`/cronicas chefao` leva a cena ao bioma do chefão; acha o chefão por qualquer palavra do nome).*
