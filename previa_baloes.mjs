// Prévia dos balões de hover (Fase 4): node previa_baloes.mjs [pasta_do_mod]
// Gera previa_faixa/baloes.html (abrir pelo servidor da prévia: /baloes.html).
// A ponta de cada balão alterna entre esquerda, direita e meio.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MOD = process.argv[2] ?? join(import.meta.dirname, 'mod', 'cronicas-de-lua')
const SAIDA = join(import.meta.dirname, 'previa_faixa')
const COD = join(SAIDA, '_cod')
mkdirSync(COD, { recursive: true })
for (const f of ['cena.ts', 'arte.ts', 'base.ts', 'luta.ts', 'chefao.ts']) {
  writeFileSync(join(COD, f), readFileSync(join(MOD, 'hooks', f), 'utf8').replace(/from '\.\/(arte|base|luta|cena|chefao)'/g, "from './$1.ts'"))
}
const { balaoSolto } = await import(join(COD, 'cena.ts'))
const casos = [
  ['Luz da Lua', 'Cache da conversa.\nDura 60 min após cada resposta.'],
  ['Mana Estelar', 'Limite do plano: 67% livre.\nRenova às 18:50 (5 h).\n7 dias: 54% livre.'],
  ['Mochila', 'Quanto da conversa já foi usado\n(o contexto).'],
  ['Mochila', 'Conversa quase cheia (86%).\nHora de arrumar (compactar).'],
  ['XP · nível 31', 'Faltam 141 XP para o nível 32.\nPáginas 7/10.\nChefão em 4 lutas.'],
  ['Nível 31', '4870 XP no total.\nPáginas 7/10 · 58 lutas.'],
  ['Vigília', 'Mantém o cache aceso.\nGasta um pouco do limite.'],
  ['Estandarte', 'Resumo da missão\npara a próxima sessão.'],
  ['Luz da Lua · lua nova', 'Cache frio.\nA próxima mensagem sai mais cara.'],
]
let html = '<body style="background:#1b1833;display:flex;flex-direction:column;align-items:flex-start;gap:16px;padding:16px">'
casos.forEach(([n, d], i) => {
  const b = balaoSolto(n, d, 1, 755, [20, 9999, undefined][i % 3])
  html += `<img src="data:image/svg+xml;base64,${Buffer.from(b.svg).toString('base64')}" width="${b.largura}" height="${b.altura}">`
})
writeFileSync(join(SAIDA, 'baloes.html'), html + '</body>')
console.log('prévia em', join(SAIDA, 'baloes.html'))
