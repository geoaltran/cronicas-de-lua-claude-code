// Prévia dos biomas no mod (o mesmo SVG que a faixa desenha), com o tamanho de
// cada SVG: o app recusa acima de 131.072 caracteres (o mod tenta caber em 129.000).
// Uso: node previa_biomas.mjs [--servir PORTA]
// Escreve previa_faixa/biomas_mod.html (fora do git).
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MOD = join(import.meta.dirname, 'mod', 'cronicas-de-lua')
const SAIDA = join(import.meta.dirname, 'previa_faixa')
const COD = join(SAIDA, '_cod_biomas')
mkdirSync(COD, { recursive: true })

function montarTudo() {
  for (const f of ['cena.ts', 'arte.ts', 'base.ts', 'luta.ts', 'chefao.ts', 'fontes.ts', 't.ts', 'idiomas.ts'].filter(f => existsSync(join(MOD, 'hooks', f)))) {
    writeFileSync(join(COD, f), readFileSync(join(MOD, 'hooks', f), 'utf8').replace(/from '\.\/(arte|base|luta|cena|chefao|t|idiomas|fontes)'/g, "from './$1.ts'"))
  }
}

const comoImg = svg => `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`

async function gerar() {
  montarTudo()
  const v = Date.now()
  const { montar } = await import(join(COD, 'cena.ts') + `?v=${v}`)
  const agora = Date.now()
  const hud = {
    luz: { at: agora - 19 * 60000, ttlMs: 3600000 },
    mana: { cinco: 28, cincoRenova: new Date(agora + 2 * 3600e3).toISOString(), sete: 61 },
    mochila: 35,
    jogo: { xp: 137, paginas: 2, lutas: 5 },
  }
  const parada = { andando: false, desde: agora, dist0: 500 }
  const t0 = agora
  const luta = (papel, monstro, golpes, extra = {}) => ({ n: 1, papel, monstro, t0, ativas: 0, golpes, fecha: Math.max(...golpes.map(g => g.at)) + 1500, ...extra })
  const chefe = (nome, pagina, extra = {}) => ({ nome, pagina, origem: 'lista', t0: agora, bloco: 1, vidaMax: 3, vida: 3, tarefas: { total: 3, feitas: 0 }, ...extra })
  const estados = {
    andando: { caminho: { andando: true, desde: agora - 5000, dist0: 300 } },
    parada: { caminho: parada },
    'luta web (Nébula)': { luta: luta('web', 'nebula', [{ at: t0 + 900, ok: true, dano: 31 }]) },
    'começo de luta (pior caso)': { luta: { n: 2, papel: 'web', monstro: 'leviata', t0, ativas: 1, golpes: [] } },
    'chefão + golpe final (Malakor)': { chefao: chefe('malakor', 10, { t0: agora - 9000, vida: 0, golpe: { at: t0 + 300, antes: 1 }, caiu: t0 + 300 + 1260 + 1500 }), luta: luta('integracao', 'malakor', [{ at: t0 + 300, ok: true, dano: 9 }], { fixo: true, final: true }) },
    'elite (Golem)': { luta: luta('elite', 'golem_obsidiana', [{ at: t0 + 300, ok: true, dano: 21 }], { trofeu: 'STRING TO REPLACE NOT F…' }) },
  }
  const biomas = ['floresta', 'ruinas', 'mar', 'vulcao', 'torre', 'aurora', 'castelo_vidro', 'ceu_estelar', 'eclipse']
  let html = '<!doctype html><meta charset="utf-8"><title>Biomas no mod</title><style>body{background:#1b1730;color:#eee;font:14px system-ui;margin:16px}h2{margin:22px 0 6px}.c{margin:6px 0 14px}.t{color:#b9b0e0}.x{color:#ff7b7b;font-weight:bold}</style>'
  const linhas = []
  for (const b of biomas) {
    html += `<h2>${b}</h2>`
    let max = 0
    for (const [nome, e] of Object.entries(estados)) {
      const vista = { agora, W: 760, escala: 1, modo: 'compacto', caminho: parada, hud, botoes: true, bioma: b, ...e }
      const { svg } = montar(vista)
      max = Math.max(max, svg.length)
      const passa = svg.length > 129000
      if (nome === 'andando' || nome === 'luta web (Nébula)' || passa) {
        html += `<div class="t">${nome}: <span class="${passa ? 'x' : ''}">${(svg.length / 1000).toFixed(1)} mil</span></div><div class="c">${comoImg(svg)}</div>`
      } else {
        html += `<div class="t">${nome}: <span class="${passa ? 'x' : ''}">${(svg.length / 1000).toFixed(1)} mil</span></div>`
      }
    }
    linhas.push(`${b.padEnd(14)} maior SVG ${(max / 1000).toFixed(1)} mil${max > 129000 ? '  << PASSA DO LIMITE' : ''}`)
  }
  writeFileSync(join(SAIDA, 'biomas_mod.html'), html)
  console.log(linhas.join('\n'))
  return html
}

// comparação: quadro 0 do GIF aprovado (cenario_bioma.py) x o mesmo trecho no mod (W 560, escala 2)
async function comparar() {
  montarTudo()
  const { montar } = await import(join(COD, 'cena.ts') + `?v=${Date.now()}`)
  const agora = Date.now()
  const hud = { luz: { at: agora - 19 * 60000, ttlMs: 3600000 }, mana: { cinco: 28 }, mochila: 35, jogo: { xp: 137, paginas: 2, lutas: 5 } }
  let html = '<!doctype html><meta charset="utf-8"><style>body{background:#1b1730;color:#eee;font:14px system-ui;margin:8px}img,svg{display:block;margin:2px 0}</style>'
  for (const b of ['ruinas', 'mar', 'vulcao', 'torre', 'aurora', 'castelo_vidro', 'ceu_estelar', 'eclipse']) {
    const png = readFileSync(join(SAIDA, 'biomas', `_q0_${b}.png`)).toString('base64')
    const { svg } = montar({ agora, W: 560, escala: 2, modo: 'compacto', caminho: { andando: false, desde: agora, dist0: 0 }, hud, bioma: b })
    html += `<h3 id="${b}">${b}</h3><img src="data:image/png;base64,${png}">${comoImg(svg)}`
  }
  return html
}

// cada bioma com o chefão dele em cena (nome e barra de vida no alto)
async function chefoes() {
  montarTudo()
  const { montar } = await import(join(COD, 'cena.ts') + `?v=${Date.now()}`)
  const agora = Date.now()
  const hud = { luz: { at: agora - 19 * 60000, ttlMs: 3600000 }, mana: { cinco: 28 }, mochila: 35, jogo: { xp: 137, paginas: 2, lutas: 5 } }
  let html = '<!doctype html><meta charset="utf-8"><style>body{background:#1b1730;color:#eee;font:14px system-ui;margin:8px}img{display:block;margin:2px 0 10px}</style>'
  const pares = [['vespera', 1], ['golem_obsidiana', 3], ['leviata', 4], ['ignis', 5], ['relojoeiro', 6], ['sir_solis', 7], ['rei_espelho', 8], ['nebula', 9], ['malakor', 10]]
  for (const [nome, pagina] of pares) {
    const chefao = { nome, pagina, origem: 'lutas', t0: agora - 9000, bloco: 1, vidaMax: 3, vida: 2, tarefas: { total: 0, feitas: 0 } }
    const { svg } = montar({ agora, W: 560, escala: 2, modo: 'compacto', caminho: { andando: false, desde: agora, dist0: 0 }, hud, chefao })
    html += `<div>${nome}</div>${comoImg(svg)}`
  }
  return html
}

const i = process.argv.indexOf('--servir')
if (i >= 0) {
  const porta = Number(process.argv[i + 1] ?? 8773)
  createServer(async (q, s) => {
    try {
      const html = q.url?.startsWith('/comparar') ? await comparar() : q.url?.startsWith('/chefoes') ? await chefoes() : await gerar()
      s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      s.end(html)
    } catch (e) {
      s.writeHead(500)
      s.end(String(e?.stack ?? e))
    }
  }).listen(porta)
  console.log(`prévia em http://localhost:${porta}`)
} else {
  await gerar()
}
