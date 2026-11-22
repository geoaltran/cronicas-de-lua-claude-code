# ⌨️ As Crônicas de Lua: comandos

Todos os comandos do mod começam com **`/cronicas`** e são digitados na caixa de mensagem do Claude, como uma mensagem normal. A resposta aparece logo abaixo, só pra mim: o Claude não recebe nada nem gasta limite do plano com eles.

Os comandos servem pra três coisas: **ver como está a jornada**, **ajustar a faixa** na tela e **testar partes do jogo** sem esperar elas acontecerem sozinhas.

## 📜 Ver a jornada

| Comando | O que faz |
|---|---|
| `/cronicas` | Mostra o resumo: nível da Lua, XP, páginas recuperadas (x/10), os últimos 5 troféus e os ajustes da faixa (escala, largura, modo). Também lista os outros comandos. |

## 🖼️ Ajustar a faixa

| Comando | O que faz |
|---|---|
| `/cronicas escala 1` · `2` · `3` | Tamanho do pixel da cena: 1x, 2x ou 3x. |
| `/cronicas regua` | Liga uma régua embaixo da cena pra medir a largura da faixa. Digite de novo pra desligar. |
| `/cronicas largura <px>` | Calibra a largura com o número que a régua mostrou inteiro na borda direita (ex.: `/cronicas largura 752`). A cena passa a acompanhar a largura da faixa e a régua desliga sozinha. |
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
| `/cronicas chefao` | Chama o **próximo chefão da jornada**, com 3 de vida. |
| `/cronicas chefao <nome>` | Chama **um chefão específico**, com 3 de vida. Aceita o nome com ou sem acento, ou só o começo: `vespera`, `dama`, `golem`, `leviata`, `ignis`, `relojoeiro`, `sir solis`, `rei espelho`, `nebula`, `malakor`. |
| `/cronicas golpe` | Tira 1 de vida do chefão em cena. No último golpe ele cai: se desfaz em pixels, sobe "+PÁGINA x/10" e a Lua ganha um nível. |
| `/cronicas elite` | A **próxima luta comum** vira o elite (Golem de Obsidiana). Quando ele cai, o troféu aparece grande no lugar dele por uns segundos. Cada vez que você roda, vem um troféu diferente: 🔥 taça (comando), ⚙️ engrenagem (edição), 🌙 lua (leitura), 🪐 orbe (web). Depois de rodar, peça ao Claude qualquer coisa que use uma ferramenta (ler um arquivo, por exemplo). |
| `/cronicas lua-nova` | Simula a **lua nova** (cache da conversa frio): a Lua desmaia e aparece o aviso de que a próxima mensagem sai mais cara. Volta ao normal na próxima resposta do Claude. |

> 💡 Só um chefão fica em cena por vez. Se já houver um, `/cronicas chefao` avisa e não chama outro: derrote o atual com `/cronicas golpe`.

## 🔧 Provas técnicas (desenvolvimento)

| Comando | O que faz |
|---|---|
| `/cronicas prova` | Liga a **prova técnica da Fase 4** (balões e botões no app). As áreas de mouse ganham borda (sobre as 4 barras e o selo de nível: a borda acende e surge o balão em pixel art), e os 4 ícones de botão aparecem na cena, cada um com uma área clicável marcada com "•" por cima, num bloco contínuo (o clique mostra um aviso; o mouse em cima mostra o balão do botão). Digite de novo para desligar. |

## 🔘 Botão abaixo da cena

| Botão | O que faz |
|---|---|
| 🌙 **Nova conversa** | Aparece na lua nova. Pede confirmação e limpa a conversa (`/clear`), pra começar com o cache novo. |

---
*Última atualização: 22/11/2026 (Fase 4 em andamento: `/cronicas prova` e `/cronicas linha`).*
