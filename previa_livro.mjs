// Prévia do Livro da Lua (Fase 4, passo 4) no navegador, sem o app.
// Desenha as 4 páginas (Ficha, Bestiário, Troféus, Grimório) com um jogo no
// começo e outro adiantado, e escreve previa_faixa/livro.html (abrir pelo
// servidor da prévia em /livro.html). Uso: node previa_livro.mjs [pasta_do_mod]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = process.argv[2]
const MOD = arg !== undefined && !arg.startsWith('--') ? arg : join(import.meta.dirname, 'mod', 'cronicas-de-lua')
const SAIDA = join(import.meta.dirname, 'previa_faixa')
const COD = join(SAIDA, '_cod')
mkdirSync(COD, { recursive: true })
for (const f of ['cena.ts', 'arte.ts', 'base.ts', 'luta.ts', 'chefao.ts', 'livro.ts']) {
  writeFileSync(join(COD, f), readFileSync(join(MOD, 'hooks', f), 'utf8').replace(/from '\.\/(arte|base|luta|cena|chefao|livro)'/g, "from './$1.ts'"))
}
const { paginaDoLivro, ABAS } = await import(join(COD, 'livro.ts'))

const tipos = ['comando', 'edicao', 'leitura', 'web']
const erros = ['COMMAND NOT FOUND: PYHTON', 'STRING TO REPLACE NOT F…', 'FILE DOES NOT EXIST', 'REQUEST FAILED WITH STATU…', 'ENOENT', 'MODULE NOT FOUND']
const jogos = {
  'começo da jornada (2 páginas, 1 troféu)': { xp: 137, paginas: 2, lutas: 5, trofeus: ['COMMAND NOT FOUND: PYHTON'], trofeusTipos: ['comando'], feiticos: { ler: 14, editar: 6, terminal: 3 } },
  'jornada adiantada (Novo Jogo+, 18 troféus)': {
    xp: 4321, paginas: 12, lutas: 250,
    trofeus: Array.from({ length: 18 }, (_, i) => erros[i % erros.length]),
    trofeusTipos: Array.from({ length: 18 }, (_, i) => tipos[i % 4]),
    feiticos: { ler: 912, editar: 420, terminal: 77, web: 12, integracao: 3, subagente: 1 },
  },
}
// larguras do painel: 70 colunas (~616 px, escala 2) e 45 colunas (~396 px, escala 2: a página encolhe para 198 px)
const larguras = [[890, 2], [616, 2], [396, 2]]
let html = '<!doctype html><meta charset="utf-8"><title>Livro da Lua</title><style>body{background:#15121f;color:#eee;font:14px system-ui;margin:16px}h2{font-weight:600;margin:28px 0 8px}h3{font-weight:500;margin:14px 0 6px}.l{display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap}img{image-rendering:pixelated}</style>'
html += '<h1 style="font-weight:600">O Livro da Lua: prévia das 4 páginas</h1>'
let n = 0
for (const [nome, jogo] of Object.entries(jogos)) {
  html += `<h2>${nome}</h2>`
  for (const aba of ABAS) {
    html += `<h3>${aba.nome}</h3><div class="l">`
    for (const [px, escala] of larguras) {
      const p = paginaDoLivro(aba.id, jogo, Math.floor(px / escala), escala)
      const arq = `livro${n++}.svg`
      writeFileSync(join(SAIDA, arq), p.svg)
      html += `<div><small style="opacity:.6">painel de ${px} px, escala ${escala}x · ${p.svg.length} de 131072 caracteres</small><br><img src="${arq}" width="${p.largura}" height="${p.altura}"></div>`
      console.log(String(p.svg.length).padStart(7), nome, aba.nome, px)
    }
    html += '</div>'
  }
}
writeFileSync(join(SAIDA, 'livro.html'), html)
console.log('prévia em', join(SAIDA, 'livro.html'))
