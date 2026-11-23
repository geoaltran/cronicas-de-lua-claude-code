// Prévia da faixa do mod no navegador, sem precisar do app.
// Gera a cena (o mesmo SVG que o mod desenha) em alguns estados e escreve
// previa_faixa/index.html. Uso: node previa_faixa.mjs [pasta_do_mod]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = process.argv[2]
const MOD = arg !== undefined && !arg.startsWith('--') ? arg : join(import.meta.dirname, 'mod', 'cronicas-de-lua')
const SAIDA = join(import.meta.dirname, 'previa_faixa')
const COD = join(SAIDA, '_cod')
mkdirSync(COD, { recursive: true })
for (const f of ['cena.ts', 'arte.ts', 'base.ts', 'luta.ts', 'chefao.ts']) {
  writeFileSync(join(COD, f), readFileSync(join(MOD, 'hooks', f), 'utf8').replace(/from '\.\/(arte|base|luta|cena|chefao)'/g, "from './$1.ts'"))
}
const { montar } = await import(join(COD, 'cena.ts'))
const { monstroInfo, marcos } = await import(join(COD, 'luta.ts'))

const agora = Date.now()
const hud = {
  luz: { at: agora - 19 * 60000, ttlMs: 3600000 },
  mana: { cinco: 28, cincoRenova: new Date(agora + 2 * 3600e3).toISOString(), sete: 61 },
  mochila: 35,
  jogo: { xp: 137, paginas: 2, lutas: 5 },
}
const parada = { andando: false, desde: agora, dist0: 500 }
const cansada = { ...hud, luz: { at: agora - 3.7e6, ttlMs: 3.6e6 }, mochila: 86 }
const casos = {
  'Faixa larga: botões à direita no HUD, balões ao passar o mouse nos botões e nas barras': { W: 760, botoes: true, estrela: 0.5, caminho: parada, hud },
    'Faixa estreita: botões no alto da cena, balão por baixo; mochila cheia, nível 39': { W: 560, botoes: true, estrela: 0.5, caminho: parada, hud: { ...hud, mochila: 86, jogo: { xp: 4000, paginas: 3, lutas: 9 } } },
  'andando (Claude trabalhando)': { caminho: { andando: true, desde: agora - 5000, dist0: 300 }, hud },
  'parada (ocioso)': { caminho: parada, hud },
  'Lua nova (cache frio), aviso no meio da cena': { W: 760, botoes: true, caminho: parada, hud: cansada, cta: true },
  'sessão nova': { caminho: { andando: false, desde: 0, dist0: 0 }, hud: { luz: null, mana: {}, mochila: null, jogo: { xp: 0, paginas: 0, lutas: 0 } } },
}

// lutas (Fase 2): desenhadas no instante em que o monstro aparece, com o futuro já
// conhecido, então a luta inteira toca sozinha no quadro (botão "repetir")
const t0 = agora
const andandoAte = { andando: true, desde: agora - 3000, dist0: 300, ate: t0 + 700 }
const luta = (papel, monstro, golpes, extra = {}) => ({ n: 1, papel, monstro, t0, ativas: 0, golpes, fecha: Math.max(...golpes.map(g => g.at)) + 1500, ...extra })
Object.assign(casos, {
  'LUTA · ler arquivo (Vespera): resultado rápido, vitória': { luta: luta('ler', 'vespera', [{ at: t0 + 300, ok: true, dano: 17 }]) },
  'LUTA · comando demorado (Ignis): canaliza até o resultado, vitória': { luta: luta('terminal', 'ignis', [{ at: t0 + 5200, ok: true, dano: 23 }]) },
  'LUTA · edição com erro (Relojoeiro): contra-ataque, o monstro vai embora': { luta: luta('editar', 'relojoeiro', [{ at: t0 + 400, ok: false, dano: 12 }]) },
  'LUTA · duas leituras em paralelo (Sir Solis): dois golpes no mesmo monstro': { luta: luta('editar', 'sir_solis', [{ at: t0 + 200, ok: true, dano: 11 }, { at: t0 + 260, ok: true, dano: 19 }]) },
  'LUTA · pesquisa na web (Nébula, 126 px)': { luta: luta('web', 'nebula', [{ at: t0 + 900, ok: true, dano: 31 }]) },
  'LUTA · começo, resultado ainda desconhecido (pior caso de tamanho)': { luta: { n: 2, papel: 'web', monstro: 'leviata', t0, ativas: 1, golpes: [] } },
  'LUTA · ferramenta ainda rodando, Lua canalizando': { agora: t0 + 3200, luta: { n: 3, papel: 'integracao', monstro: 'rei_espelho', t0, ativas: 1, golpes: [] }, caminho: { ...andandoAte, ate: t0 + 700 } },
})
// chefões (Fase 3): na mesma faixa, barra de vida no alto, cena tingida
const chefe = (nome, pagina, extra = {}) => ({ nome, pagina, origem: 'lista', t0: agora, bloco: 1, vidaMax: 3, vida: 3, tarefas: { total: 3, feitas: 0 }, ...extra })
Object.assign(casos, {
  'CHEFÃO · lista de tarefas criada: o Golem entra (vida 3/3)': { W: 760, caminho: parada, hud, chefao: chefe('golem_obsidiana', 3) },
  'CHEFÃO · tarefa concluída: Leviatã perde vida (rastro escuro na barra)': { W: 760, caminho: parada, hud, chefao: chefe('leviata', 4, { t0: agora - 5000, vidaMax: 4, vida: 2, golpe: { at: agora + 600, antes: 3 } }) },
  'CHEFÃO · ferramenta durante o chefão vira golpe (Relojoeiro)': { chefao: chefe('relojoeiro', 6, { t0: agora - 9000, vida: 2 }), luta: luta('editar', 'relojoeiro', [{ at: t0 + 300, ok: true, dano: 14 }], { fixo: true }) },
  'CHEFÃO · golpe final: Malakor se desfaz, página 10/10 e Novo Jogo+': { chefao: chefe('malakor', 10, { t0: agora - 9000, vida: 0, golpe: { at: t0 + 300, antes: 1 }, caiu: t0 + 300 + 1260 + 1500 }), luta: luta('integracao', 'malakor', [{ at: t0 + 300, ok: true, dano: 9 }], { fixo: true, final: true }) },
})
// elite e teia da Vespera (Fase 3, 4ª sessão)
Object.assign(casos, {
  'ELITE · erro consertado: Golem com o troféu, vitória e +TROFÉU': { luta: luta('elite', 'golem_obsidiana', [{ at: t0 + 300, ok: true, dano: 21 }], { trofeu: 'STRING TO REPLACE NOT F…' }) },
  'ELITE · troféu curto (Bash)': { luta: luta('elite', 'golem_obsidiana', [{ at: t0 + 2600, ok: true, dano: 15 }], { trofeu: 'ENOENT' }) },
  'TEIA · Vespera chefão, teias girando (vida 2/3)': { W: 760, caminho: parada, hud, chefao: chefe('vespera', 1, { t0: agora - 5000, vida: 2 }) },
  'TEIA · Vespera na luta comum, vitória (teia some junto nos pixels)': { luta: luta('ler', 'vespera', [{ at: t0 + 300, ok: true, dano: 17 }]) },
})
// chefão híbrido (7ª sessão): vida em blocos de 10 por tarefa, escudo no golpe comum, crítico no final
const acerto = t0 + 1260 + 1120 // primeiro ataque + impacto
const hib = (nome, pagina, tarefas, extra = {}) => chefe(nome, pagina, { t0: agora - 9000, bloco: 10, vidaMax: tarefas * 10, vida: tarefas * 10, tarefas: { total: tarefas, feitas: 0 }, ...extra })
Object.assign(casos, {
  'HÍBRIDO · golpe comum: o escudo segura e tira só 2 (Relojoeiro, 5 tarefas)': { chefao: hib('relojoeiro', 6, 5, { vida: 48, golpe: { at: acerto, antes: 50 } }), luta: luta('editar', 'relojoeiro', [{ at: t0 + 300, ok: true, dano: 14, escudo: 2 }], { fixo: true }) },
  'HÍBRIDO · o escudo segura tudo: 0 (Ignis, metade do bloco já foi)': { chefao: hib('ignis', 5, 3, { vida: 25 }), luta: luta('terminal', 'ignis', [{ at: t0 + 300, ok: true, dano: 7, escudo: 0 }], { fixo: true }) },
  'HÍBRIDO · tarefa concluída: a vida desce até o fim do bloco (Leviatã)': { chefao: hib('leviata', 4, 4, { vida: 30, golpe: { at: acerto, antes: 35 }, tarefas: { total: 4, feitas: 1 } }), luta: luta('integracao', 'leviata', [{ at: t0 + 300, ok: true, dano: 9, tarefa: 5 }], { fixo: true }) },
  'HÍBRIDO · golpe final CRÍTICO (Vespera, última tarefa)': { chefao: hib('vespera', 1, 3, { vida: 0, golpe: { at: acerto, antes: 5 }, caiu: t0 + 300 + 1260 + 1500, tarefas: { total: 3, feitas: 3 } }), luta: luta('integracao', 'vespera', [{ at: t0 + 300, ok: true, dano: 9, critico: 54 }], { fixo: true, final: true }) },
  'HÍBRIDO · CRÍTICO enorme: a lista acabou cedo (Nébula, 5 tarefas de uma vez)': { chefao: hib('nebula', 9, 5, { vida: 0, golpe: { at: acerto, antes: 50 }, caiu: t0 + 300 + 1260 + 1500, tarefas: { total: 5, feitas: 5 } }), luta: luta('integracao', 'nebula', [{ at: t0 + 300, ok: true, dano: 9, critico: 459 }], { fixo: true, final: true }) },
  'HÍBRIDO · chefão das 12 lutas: último golpe também é crítico (Golem)': { chefao: chefe('golem_obsidiana', 3, { origem: 'lutas', t0: agora - 9000, vida: 0, golpe: { at: acerto, antes: 1 }, caiu: t0 + 300 + 1260 + 1500 }), luta: luta('editar', 'golem_obsidiana', [{ at: t0 + 300, ok: true, dano: 13 }], { fixo: true, final: true }) },
})
// tela de abertura (9ª sessão): fase 1 (marca no céu) e fase 2 (floresta e a Lua chegando)
Object.assign(casos, {
  'ABERTURA · fase 1: a marca no céu noturno (aparece, fica e some)': { W: 760, botoes: true, caminho: parada, hud, abertura: agora, textoLongo: false },
  'ABERTURA · fase 2: a floresta clareia e a Lua chega andando': { W: 760, botoes: true, caminho: parada, hud, abertura: agora - 4000, textoLongo: false },
})
if (process.argv.includes('--novos')) {
  for (const k of Object.keys(casos)) if (!/^ABERTURA/.test(k)) delete casos[k]
}
// tom da cena: os 10 chefões, antes (tudo de leve) e depois (só o fundo, mais forte)
const JORNADA = [['vespera', 'Vespera'], ['dama_penumbra', 'Dama Penumbra'], ['golem_obsidiana', 'Golem'], ['leviata', 'Leviatã'], ['ignis', 'Ignis'], ['relojoeiro', 'Relojoeiro'], ['sir_solis', 'Sir Solis'], ['rei_espelho', 'Rei Espelho'], ['nebula', 'Nébula'], ['malakor', 'Malakor']]
const soTom = process.argv.includes('--tom')
if (soTom) {
  for (const k of Object.keys(casos)) delete casos[k]
}
if (!process.argv.includes('--novos')) JORNADA.forEach(([id, nome], i) => {
  const ch = chefe(id, i + 1, { t0: agora - 5000, vida: 2 })
  casos[`TOM · ${nome} · ANTES (tudo, de leve)`] = { W: 760, caminho: parada, hud, tom: 'todo', chefao: ch }
  casos[`TOM · ${nome} · DEPOIS (só o fundo, mais forte)`] = { W: 760, caminho: parada, hud, tom: 'fundo', chefao: ch }
})
for (const v of Object.values(casos)) {
  if (v.luta !== undefined) {
    v.caminho ??= andandoAte
    v.hud ??= hud
    v.W ??= 760
    // no app os botões aparecem sempre (Fase 4): o pior caso tem a lanterna e a bandeira animadas
    v.botoes ??= true
    v.estadoBotoes ??= { vigilia: true, envios: 2, maxEnvios: 6, pisca: agora - 200, mochila: false, estandarte: 'escrevendo', livro: true }
    v.celula ??= 8.8
    v.semBaloes ??= true
    v.modo = 'compacto' // a faixa tem sempre a mesma altura
  }
}

const tons = []
let html = '<!doctype html><meta charset="utf-8"><title>Prévia da faixa</title><body style="background:#24222e;color:#ddd;font:13px system-ui;margin:16px">'
html += '<h2 style="font-weight:500">As Crônicas de Lua: prévia da faixa (escala 2x, reduzida para caber; passe o mouse nos botões)</h2>'
let i = 0
for (const [nome, v] of Object.entries(casos)) {
  // fora das lutas a prévia mostra os balões (passe o mouse), então embute a fonte dos textos longos
  const { svg, largura, altura } = montar({ agora, W: 560, escala: 2, modo: 'compacto', textoLongo: !v.luta, ...v, ...(v.luta ? { horizonte: Infinity } : {}) })
  // tamanho de verdade: o mod redesenha em cada marco da luta; vale o maior
  let maior = svg.length
  let qual = ''
  if (v.luta) {
    const a0 = v.agora ?? agora
    for (const t of [a0, ...marcos(v.luta).filter(t => t > a0)]) {
      const n = montar({ W: 560, escala: 2, modo: 'compacto', ...v, agora: t + 1 }).svg.length
      if (n >= maior || qual === '') {
        maior = qual === '' ? n : Math.max(maior, n)
        qual = `+${Math.round(t - t0)} ms`
      }
    }
  }
  const arq = `cena${i++}.svg`
  writeFileSync(join(SAIDA, arq), svg)
  if (nome.startsWith('TOM · ')) {
    tons.push({ nome: nome.split(' · ')[1], antes: nome.includes('ANTES'), arq })
  }
  html += `<h3 style="font-weight:500">${nome} <small style="opacity:.6">(${v.luta ? `maior redesenho ${maior} de 131072 caracteres, em ${qual}` : `${svg.length} de 131072 caracteres`})</small>${v.luta ? ` <button onclick="const f=this.closest('h3').nextElementSibling.firstChild;f.contentWindow.location.reload()">repetir</button>` : ''}</h3>`
  console.log(String(v.luta ? maior : svg.length).padStart(7), nome)
  html += `<div class="caixa" data-w="${largura}" data-h="${altura}"><iframe src="${arq}" width="${largura}" height="${altura}"></iframe></div>`
  if (v.cta) {
    // simulação aproximada: no app estes são botões do próprio app, logo abaixo da cena
    html += `<div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button style="font:13px system-ui;padding:4px 10px;border-radius:6px;border:0;background:#d97757;color:#fff">🌙 Nova conversa</button><span style="opacity:.6">ou continue aqui: só a próxima mensagem custa mais.</span></div><small style="opacity:.5">(botão simulado; no app ele tem o visual dos botões do próprio app)</small>`
  }
}
html += `<style>.caixa{position:relative;overflow:hidden}.caixa iframe{border:0;position:absolute;left:0;top:0;transform-origin:0 0}</style>
<script>
function encaixa(){for(const c of document.querySelectorAll('.caixa')){const w=+c.dataset.w,h=+c.dataset.h,k=Math.min(1,(document.body.clientWidth)/w);c.style.width=w*k+'px';c.style.height=h*k+'px';c.firstChild.style.transform='scale('+k+')'}}
addEventListener('resize',encaixa);encaixa()
</script>`
writeFileSync(join(SAIDA, 'index.html'), html)
// tom.html: os 10 chefões lado a lado, antes | depois (a cena inteira, escala 1)
let tom = '<!doctype html><meta charset="utf-8"><title>Tom da cena: antes e depois</title><body style="background:#24222e;color:#ddd;font:13px system-ui;margin:12px">'
tom += '<h2 style="font-weight:500;margin:4px 0 10px">Tom da cena com o chefão · <b>ANTES</b>: tudo tingido de leve (0,16) · <b>DEPOIS</b>: só o fundo, mais forte (0,3)</h2>'
tom += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 12px">'
for (const t of tons.filter(t => t.antes)) {
  const d = tons.find(x => x.nome === t.nome && !x.antes)
  for (const [x, rot] of [[t, 'ANTES'], [d, 'DEPOIS']]) {
    tom += `<figure style="margin:0"><figcaption style="margin-bottom:3px">${t.nome} · ${rot}</figcaption><img src="${x.arq}" style="width:100%;image-rendering:pixelated;display:block"></figure>`
  }
}
writeFileSync(join(SAIDA, 'tom.html'), tom + '</div>')
console.log(`prévia em ${SAIDA}/index.html`)

// --servir [porta]: serve a pasta da prévia em http://127.0.0.1:<porta>
const s = process.argv.indexOf('--servir')
if (s !== -1) {
  const { createServer } = await import('node:http')
  const porta = Number(process.env.PORT ?? process.argv[s + 1] ?? 8765)
  const tipos = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml' }
  createServer((req, res) => {
    const nome = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '') || 'index.html'
    if (nome.includes('..') || nome.includes('/')) {
      res.writeHead(404).end()
      return
    }
    try {
      const dados = readFileSync(join(SAIDA, nome))
      res.writeHead(200, { 'content-type': tipos[nome.slice(nome.lastIndexOf('.'))] ?? 'application/octet-stream' }).end(dados)
    } catch {
      res.writeHead(404).end()
    }
  }).listen(porta, '127.0.0.1', () => console.log(`servindo em http://127.0.0.1:${porta}`))
}
