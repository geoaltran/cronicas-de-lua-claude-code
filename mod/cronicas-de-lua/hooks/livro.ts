// O Livro da Lua (Fase 4, passo 4): o painel aberto pelo botão do livro.
//
// Quatro páginas, cada uma um SVG em modo imagem (como a faixa): Ficha (a Lua,
// nível, XP, páginas das Crônicas), Bestiário (os 10 chefões; os que ainda não
// caíram aparecem em silhueta), Troféus (a estante com os troféus dos elites;
// o nome do erro sai no balão do hover, com as áreas do app por cima) e
// Grimório (as ferramentas do Claude como feitiços, com quantas vezes saíram).
// Mapa da jornada (25/11/2026): os 9 biomas num caminho, os visitados em cor.
import { META } from './arte'
import { Doc, PARADA, art, esc, r } from './base'
import type { AbaDoLivro, Jogo, TipoTrofeu } from '../types'
import { type Alvo, biomaDaPagina, nivelDe, selo } from './cena'
import { cssFonteLivro, cssTexto, ehCJK, larguraCurta, quebrarPorLargura } from './fontes'
import { JORNADA, NOME_CHEFAO, chefaoEm, paginasNoCiclo, proximoChefao } from './chefao'
import { monstroInfo } from './luta'
import { t as tx, tp } from './t'

export const ABAS: readonly { id: AbaDoLivro; nome: string }[] = [
  { id: 'ficha', get nome() { return tx('livro.abas.ficha') } },
  { id: 'mapa', get nome() { return tx('livro.abas.mapa') } },
  { id: 'bestiario', get nome() { return tx('livro.abas.bestiario') } },
  { id: 'trofeus', get nome() { return tx('livro.abas.trofeus') } },
  { id: 'grimorio', get nome() { return tx('livro.abas.grimorio') } },
]

export type PaginaDoLivro = { svg: string; largura: number; altura: number; alvos: Alvo[]; alt: string }

/** Largura mínima de uma página, em px da arte (a estante tem 180, mais as margens). */
export const LARGURA_MIN = 192

const OURO = '#ffe27a'
const FUNDO = '#1d1433'
const LINHA = '#3a2f63'
/** Pixelify 10 px: largura média de uma letra, com folga (para quebrar as linhas). */
const PX_LETRA = 5.4
/** Silkscreen 12 px: largura de uma letra. */
const PX_LETRA_TITULO = 9

const ret = (x: number, y: number, w: number, h: number, cor: string) => (w > 0 && h > 0 ? `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${cor}"/>` : '')

/** Texto longo (Pixelify, com minúsculas). */
const texto = (x: number, y: number, s: string, extra = '', cor?: string) => `<text class="t l${extra}" x="${r(x)}" y="${r(y)}"${cor === undefined ? '' : ` style="fill:${cor}"`}>${esc(s)}</text>`
/** Título (Silkscreen, caixa alta). Em CJK a Fusion fica sempre em 12 px, o tamanho nativo (16 borraria). */
const titulo = (x: number, y: number, s: string, tam = 12, extra = '') => `<text class="t${extra}" x="${r(x)}" y="${r(y)}" style="font-size:${ehCJK() ? 12 : tam}px;fill:${OURO}">${esc(s.toUpperCase())}</text>`
/** Distância entre as linhas de texto: a Fusion (CJK) a 12 px precisa de 14; a Pixelify a 10 px, 12. */
const LH = () => (ehCJK() ? 14 : 12)

/**
 * O nome de um feitiço que cabe em `max` px: inteiro; senão a primeira palavra;
 * em CJK (sem espaço entre as palavras), cortado com "…".
 */
function nomeQueCabe(nome: string, max: number): string {
  const cabe = (s: string) => larguraCurta(s, PX_LETRA_TITULO) <= max
  if (cabe(nome)) {
    return nome
  }
  if (!ehCJK()) {
    return nome.split(' ')[0] ?? nome
  }
  const letras = [...nome]
  while (letras.length > 1 && !cabe(letras.join('') + '…')) {
    letras.pop()
  }
  return letras.join('') + '…'
}

/** Quebra um texto em linhas que cabem em `max` px (pelas palavras). */
export function quebrar(s: string, max: number, pxLetra = PX_LETRA): string[] {
  if (ehCJK()) {
    return quebrarPorLargura(s, max)
  }
  const cabe = Math.max(6, Math.floor(max / pxLetra))
  const linhas: string[] = []
  let atual = ''
  for (const p of s.split(/\s+/)) {
    const tenta = atual === '' ? p : `${atual} ${p}`
    if (tenta.length <= cabe || atual === '') {
      atual = tenta
    } else {
      linhas.push(atual)
      atual = p
    }
  }
  if (atual !== '') {
    linhas.push(atual)
  }
  return linhas
}

/** A moldura da página: fundo escuro, contorno dourado com cantos em pixel. */
function moldura(W: number, H: number): string {
  return (
    ret(2, 2, W - 4, H - 4, FUNDO) +
    ret(4, 0, W - 8, 2, '#f7cf4a') +
    ret(4, H - 2, W - 8, 2, '#de8e2c') +
    ret(0, 4, 2, H - 8, '#f7cf4a') +
    ret(W - 2, 4, 2, H - 8, '#de8e2c') +
    ret(2, 2, 2, 2, '#f7cf4a') +
    ret(W - 4, 2, 2, 2, '#f7cf4a') +
    ret(2, H - 4, 2, 2, '#de8e2c') +
    ret(W - 4, H - 4, 2, 2, '#de8e2c') +
    ret(5, 5, W - 10, 1, LINHA) +
    ret(5, H - 6, W - 10, 1, LINHA)
  )
}

/** Cabeçalho: título no meio e uma linha de subtítulo. */
function cabecalho(W: number, nome: string, sub: string): { svg: string; y: number } {
  let s = titulo(W / 2, 24, nome, 16, ' m')
  let y = 40
  for (const l of quebrar(sub, W - 24)) {
    s += texto(W / 2, y, l, ' m', '#e9d9ff')
    y += ehCJK() ? 14 : 13
  }
  return { svg: s + ret(12, y - 4, W - 24, 1, LINHA), y: y + 8 }
}

// ---------------------------------------------------------------- Ficha

/** As 10 páginas das Crônicas: as recuperadas em pergaminho, as que faltam só o contorno. */
function paginas(x: number, y: number, n: number): string {
  let s = ''
  for (let i = 0; i < 10; i++) {
    const px = x + i * 14
    if (i < n) {
      s += ret(px, y, 10, 13, '#8a5a2b') + ret(px + 1, y + 1, 8, 11, '#f3dfa8') + ret(px + 2, y + 4, 6, 1, '#c9a46a') + ret(px + 2, y + 7, 5, 1, '#c9a46a')
    } else {
      s += ret(px, y, 10, 1, LINHA) + ret(px, y + 12, 10, 1, LINHA) + ret(px, y, 1, 13, LINHA) + ret(px + 9, y, 1, 13, LINHA)
    }
  }
  return s
}

/** Onde a Lua está no quadro de 80 x 100 da pose parada (medido no PNG). */
const LUA_X0 = 14
const LUA_X1 = 71
const LUA_Y0 = 13
const LUA_PES = 96

/** A altura do selo de nível (moldura + estrela), como `selo` o monta. */
function alturaDoSelo(nivel: number, escalaEstrela: number): number {
  const dig = Math.max(2, String(Math.max(1, Math.min(9999, nivel))).length)
  const m = (META.nivel.molduras as unknown as Record<string, { h: number }>)[`${dig}dig`]
  const est = art('nivel_estrela_lv')
  return (m?.h ?? 36) + est.h * escalaEstrela - Math.round(4 * escalaEstrela) - 2
}

function ficha(d: Doc, j: Jogo, W: number): { corpo: string; H: number; alt: string } {
  const n = nivelDe(j.xp)
  const cab = cabecalho(W, tx('livro.ficha.titulo'), tx('livro.ficha.subtitulo'))
  let s = cab.svg
  // A Lua em 2x à esquerda e o selo à direita dela, em 2x quando cabe (senão
  // com a estrela no tamanho cheio): pedido do usuário. Os dados ficam à
  // direita do bloco quando sobra espaço (painel largo), senão embaixo.
  const ox = 12 - LUA_X0 * 2
  const oy = cab.y + 2 - LUA_Y0 * 2
  s += `<g transform="translate(${ox},${oy}) scale(2)">${d.tira('lua_parada', 0, 0, 80, 100, PARADA, 0)}</g>`
  const dir = 12 + (LUA_X1 - LUA_X0 + 1) * 2
  const meio = oy + (LUA_Y0 + LUA_PES) // meio do corpo, em 2x
  const sobra = W - 12 - dir - 6
  const grande = selo(d, 0, 0, n.nivel, 0.5)
  const g2 = grande.largura * 2
  const sl1 = grande.largura * 2 <= sobra ? null : selo(d, 0, 0, n.nivel, 1)
  const larguraSelo = sl1 === null ? g2 : sl1.largura
  const aoLado = W - (dir + 6 + larguraSelo + 16) - 14 >= 180
  const sx = aoLado ? dir + 6 : dir + 6 + Math.max(0, Math.floor((sobra - larguraSelo) / 2))
  if (sl1 === null) {
    s += `<g transform="translate(${sx},${r(meio + (alturaDoSelo(n.nivel, 0.5) * 2) / 2)}) scale(2)">${grande.svg}</g>`
  } else {
    s += `<g transform="translate(${sx},${r(meio + alturaDoSelo(n.nivel, 1) / 2)})">${sl1.svg}</g>`
  }
  const sb = oy + LUA_PES * 2
  const colX = aoLado ? dir + 6 + larguraSelo + 16 : 16
  let ty = aoLado ? cab.y + 12 : sb + 18
  const prox = proximoChefao(j.paginas)
  const trofeus = (j.trofeus ?? []).length
  const linhas: [string, string][] = [
    [tx('livro.ficha.nivel'), tx('livro.ficha.nivel_valor', { nivel: n.nivel, xp: j.xp })],
    [tx('livro.ficha.proximo_nivel'), tx('livro.ficha.proximo_nivel_valor', { faltam: n.precisa - n.dentro })],
    [tx('livro.ficha.lutas'), String(j.lutas)],
    [tx('livro.ficha.chefoes'), String(j.paginas)],
    [tx('livro.ficha.trofeus'), String(trofeus)],
    [tx('livro.ficha.proximo_chefao'), tp('livro.ficha.proximo_chefao_valor', chefaoEm(j.lutas), { nome: NOME_CHEFAO[prox.nome] ?? prox.nome })],
  ]
  const larg = W - colX - 14
  for (const [k, v] of linhas) {
    s += texto(colX, ty, k, '', '#cdbdf0')
    ty += LH()
    for (const l of quebrar(v, larg)) {
      s += texto(colX, ty, l)
      ty += LH()
    }
    ty += 5
  }
  // páginas das Crônicas, embaixo, na largura toda
  const py = Math.max(ty, sb + 14) + 6
  const ciclo = paginasNoCiclo(j.paginas)
  let pl = py
  for (const l of quebrar(tx(j.paginas >= 10 ? 'livro.ficha.paginas_novo_jogo' : 'livro.ficha.paginas', { ciclo }), W - 32)) {
    s += texto(16, pl, l, '', '#cdbdf0')
    pl += LH()
  }
  s += paginas(16, pl - 6, ciclo)
  const H = pl + 20
  return { corpo: s, H, alt: tx('livro.ficha.alt', { nivel: n.nivel, xp: j.xp, lutas: j.lutas, chefoes: j.paginas, trofeus, ciclo }) }
}

// ---------------------------------------------------------------- Bestiário

const CELULA_W = 136
const CELULA_SPRITE = 128

/** Um chefão já foi derrotado (na jornada atual, ou em qualquer, depois do primeiro Novo Jogo+). */
export function derrotado(paginasTotal: number, i: number): boolean {
  return paginasTotal >= 10 || i < paginasTotal
}

function bestiario(d: Doc, j: Jogo, W: number): { corpo: string; H: number; alt: string } {
  const vistos = JORNADA.filter((_, i) => derrotado(j.paginas, i)).length
  const cab = cabecalho(W, tx('livro.bestiario.titulo'), vistos === 10 ? tx('livro.bestiario.todos') : tx('livro.bestiario.vistos', { vistos }))
  let s = cab.svg
  const cols = Math.max(1, Math.min(5, Math.floor((W - 12) / CELULA_W)))
  const x0 = Math.floor((W - cols * CELULA_W) / 2)
  const sombra = d.filtro('sil', '<feColorMatrix type="matrix" values="0 0 0 0 0.17 0 0 0 0 0.13 0 0 0 0 0.3 0 0 0 1 0"/>')
  JORNADA.forEach((nome, i) => {
    const cx = x0 + (i % cols) * CELULA_W + CELULA_W / 2
    const top = cab.y + Math.floor(i / cols) * (CELULA_SPRITE + 34)
    const mi = monstroInfo(nome)
    const vira = mi.espelhar ? ` transform="translate(${mi.w},0) scale(-1,1)"` : ''
    const viu = derrotado(j.paginas, i)
    const corpo = `<use href="${d.img(`m_${nome}`)}"/>`
    s += `<g transform="translate(${r(cx - mi.w / 2)},${top + CELULA_SPRITE - mi.h})"><g${vira}>${viu ? corpo : `<g filter="${sombra}">${corpo}</g>`}</g></g>`
    // chão de cada um
    s += ret(cx - 40, top + CELULA_SPRITE, 80, 1, LINHA)
    s += viu ? texto(cx, top + CELULA_SPRITE + 13, NOME_CHEFAO[nome] ?? nome, ' m', OURO) : texto(cx, top + CELULA_SPRITE + 13, '???', ' m', '#8f80b8')
    s += texto(cx, top + CELULA_SPRITE + 25, tx('livro.bestiario.pagina', { n: i + 1 }), ' m', '#8f80b8')
    if (!viu) {
      s += titulo(cx, top + CELULA_SPRITE / 2 + 18, '?', 16, ' m')
    }
  })
  const linhas = Math.ceil(JORNADA.length / cols)
  const H = cab.y + linhas * (CELULA_SPRITE + 34) + 6
  const nomes = JORNADA.filter((_, i) => derrotado(j.paginas, i)).map(n => NOME_CHEFAO[n] ?? n)
  return { corpo: s, H, alt: tx(nomes.length > 0 ? 'livro.bestiario.alt_nomes' : 'livro.bestiario.alt', { vistos, nomes: nomes.join(', ') }) }
}

// ---------------------------------------------------------------- Mapa da jornada

/**
 * Os ícones dos biomas, 12 x 12 em pixel (2 px de arte cada), feitos no código:
 * sem imagem nova (o Svg do Livro tem teto). Cada letra é uma cor; "." é vazio.
 */
const ICONES: Record<string, { c: Record<string, string>; g: readonly string[] }> = {
  floresta: {
    c: { G: '#4caf50', g: '#2e7d32', T: '#7a4a2a' },
    g: ['....GGGG....', '..GGGGGGGG..', '.GGgGGGGgGG.', 'GGGGGGgGGGGG', 'GGgGGGGGGgGG', '.GGGGgGGGGG.', '..GGGGGGGG..', '.....TT.....', '.....TT.....', '.....TT.....', '....TTTT....', '............'],
  },
  ruinas: {
    c: { S: '#a8a29e', s: '#78716c', c: '#b388ff', C: '#efe0ff' },
    g: ['............', '.SSS....SSS.', '.SsS....SsS.', '.SsS....SsS.', '.SsS..c.SsS.', '.SsS.ccc.sS.', '.SsS.cCc.SS.', '.SsS.ccc....', '.SsS..c..SS.', '.SsS....SsS.', 'SSSSSSSSSSSS', '............'],
  },
  mar: {
    c: { W: '#e3f2fd', b: '#64b5f6', B: '#1e5aa8', Y: '#fff3b0' },
    g: ['.........YY.', '........YYYY', '........YYYY', '.........YY.', '............', '..WW....WW..', '.WbbW..WbbW.', 'WbBBbWWbBBbW', 'BBBBBBBBBBBB', 'bBBBbBBBBbBB', 'BBbBBBBbBBBB', '............'],
  },
  vulcao: {
    c: { R: '#ff7043', r: '#ffab40', o: '#ffcc80', d: '#5d4037' },
    g: ['.....oo.....', '....o..o....', '.....RR.....', '....rRRr....', '....dRRd....', '...ddrrdd...', '...dddddd...', '..dddrdddd..', '..ddddddrd..', '.dddddddddd.', 'dddrdddddddd', '............'],
  },
  torre: {
    c: { A: '#a1887f', T: '#6d4c41', w: '#fff3cd', k: '#3e2723', t: '#4e342e' },
    g: ['.....AA.....', '....AAAA....', '....TTTT....', '...TwwwwT...', '...TwkwwT...', '...TwwkwT...', '...TwwwwT...', '....TTTT....', '....TtTT....', '....TTtT....', '...TTTTTT...', '............'],
  },
  aurora: {
    c: { S: '#ffd54f', y: '#ffe082', h: '#c58b3a', H: '#e6b35a' },
    g: ['............', '..y..y..y...', '...y.y.y....', '....SSS.....', '.y.SSSSS.y..', '..SSSSSSS...', 'hhhhhhhhhhhh', 'HHHHHHHHHHHH', 'hHHHHhHHHHHh', 'HHHhHHHHHhHH', '............', '............'],
  },
  castelo_vidro: {
    c: { c: '#4fc3f7', C: '#b3e5fc', w: '#ffffff', d: '#0277bd' },
    g: ['.c........c.', '.cc..cc..cc.', '.cC..CC..Cc.', '.cC.cCCc.Cc.', '.cCccCCccCc.', '.cCCCCCCCCc.', '.cCCwCCwCCc.', '.cCCCCCCCCc.', '.cCCCddCCCc.', '.cCCCddCCCc.', 'cccccccccccc', '............'],
  },
  ceu_estelar: {
    c: { S: '#fff59d', s: '#b39ddb' },
    g: ['.s.......s..', '....S.......', '...SSS...s..', '....S.......', '.s......S...', '.......SSS..', '..s.....S...', '.....s......', '.S.........s', 'SSS..s......', '.S......s...', '............'],
  },
  eclipse: {
    c: { o: '#ffb74d', K: '#120c26' },
    g: ['....oooo....', '..oo....oo..', '.o..KKKK..o.', '.o.KKKKKK.o.', 'o.KKKKKKKK.o', 'o.KKKKKKKK.o', 'o.KKKKKKKK.o', 'o.KKKKKKKK.o', '.o.KKKKKK.o.', '.o..KKKK..o.', '..oo....oo..', '....oooo....'],
  },
}

/** Um ícone de bioma em (x, y), 24 x 24; `silhueta` pinta tudo de uma cor só. */
function icone(nome: string, x: number, y: number, silhueta?: string): string {
  const ic = ICONES[nome] ?? ICONES['floresta']
  if (ic === undefined) {
    return ''
  }
  let s = ''
  ic.g.forEach((linha, j) => {
    // pedaços seguidos da mesma cor viram um retângulo só
    let i = 0
    while (i < linha.length) {
      const ch = linha[i] as string
      let k = i
      while (k < linha.length && linha[k] === ch) {
        k++
      }
      if (ch !== '.') {
        s += ret(x + i * 2, y + j * 2, (k - i) * 2, 2, silhueta ?? ic.c[ch] ?? '#ffffff')
      }
      i = k
    }
  })
  return s
}

/** Os biomas na ordem da jornada, com as páginas de cada um (0 a 9). */
function biomasDaJornada(): { nome: string; paginas: number[] }[] {
  const lista: { nome: string; paginas: number[] }[] = []
  for (let i = 0; i < 10; i++) {
    const b = biomaDaPagina(i)
    const ultimo = lista[lista.length - 1]
    if (ultimo !== undefined && ultimo.nome === b) {
      ultimo.paginas.push(i)
    } else {
      lista.push({ nome: b, paginas: [i] })
    }
  }
  return lista
}

const MAPA_CW = 92
const MAPA_PLACA = 32

function mapa(j: Jogo, W: number): { corpo: string; H: number; alt: string } {
  const biomas = biomasDaJornada()
  // a página da vez (0 a 9) e se a jornada já deu a volta (Novo Jogo+: tudo visitado)
  const agora = ((j.paginas % 10) + 10) % 10
  const volta = j.paginas >= 10
  const atual = biomas.findIndex(b => b.paginas.includes(agora))
  const nomeB = (b: string) => tx(`chefao.biomas.${b}`)
  const aqui = nomeB(biomas[atual]?.nome ?? 'floresta')
  const cab = cabecalho(W, tx('livro.mapa.titulo'), tx(volta ? 'livro.mapa.sub_todos' : 'livro.mapa.sub', { pagina: agora + 1, bioma: aqui }))
  let s = cab.svg
  const cols = Math.max(1, Math.min(5, Math.floor((W - 16) / MAPA_CW)))
  const x0 = Math.floor((W - cols * MAPA_CW) / 2)
  const nomes = biomas.map(b => quebrar(nomeB(b.nome), MAPA_CW - 6))
  const linhasNome = Math.max(1, ...nomes.map(n => n.length))
  const CH = MAPA_PLACA + 14 + LH() * (linhasNome + 1) + 12
  // centro da placa de cada bioma: as linhas vão e voltam (zigue-zague)
  const centro = (k: number) => {
    const lin = Math.floor(k / cols)
    const col = lin % 2 === 0 ? k % cols : cols - 1 - (k % cols)
    return { x: x0 + col * MAPA_CW + MAPA_CW / 2, y: cab.y + 10 + lin * CH + MAPA_PLACA / 2 }
  }
  const visitado = (k: number) => volta || k <= atual
  // o caminho: tracinhos entre as placas, dourados até onde a Lua chegou
  for (let k = 0; k + 1 < biomas.length; k++) {
    const a = centro(k)
    const b = centro(k + 1)
    const cor = visitado(k + 1) ? '#c9a46a' : LINHA
    if (a.y === b.y) {
      const de = Math.min(a.x, b.x) + MAPA_PLACA / 2 + 4
      const ate = Math.max(a.x, b.x) - MAPA_PLACA / 2 - 4
      for (let x = de; x + 4 <= ate; x += 8) {
        s += ret(x, a.y - 1, 4, 2, cor)
      }
    } else {
      // na ponta da linha: desce pela lateral da placa
      const lado = a.x + (a.x > W / 2 ? MAPA_PLACA / 2 + 6 : -MAPA_PLACA / 2 - 8)
      for (let y = a.y; y + 4 <= b.y; y += 8) {
        s += ret(lado, y, 2, 4, cor)
      }
    }
  }
  biomas.forEach((b, k) => {
    const c = centro(k)
    const px = c.x - MAPA_PLACA / 2
    const py = c.y - MAPA_PLACA / 2
    const viu = visitado(k)
    const borda = k === atual ? OURO : viu ? '#c9a46a' : LINHA
    // a placa com os cantos cortados em pixel
    s += ret(px + 2, py, MAPA_PLACA - 4, MAPA_PLACA, borda) + ret(px, py + 2, MAPA_PLACA, MAPA_PLACA - 4, borda) + ret(px + 2, py + 2, MAPA_PLACA - 4, MAPA_PLACA - 4, '#2a2050')
    s += icone(b.nome, px + 4, py + 4, viu ? undefined : '#3a2f63')
    if (!viu) {
      s += titulo(c.x, c.y + 6, '?', 16, ' m')
    }
    if (k === atual) {
      // a Lua está aqui: uma luazinha dourada sobre a placa
      // (crescente de 9 x 9, com a ponta de cima e a de baixo afinando)
      const lua = ['..ooo....', '.oooo....', 'oooo.....', 'ooo......', 'ooo......', 'ooo......', 'oooo.....', '.oooo....', '..ooo....']
      lua.forEach((l, jj) => {
        const a = l.indexOf('o')
        const b = l.lastIndexOf('o')
        s += ret(c.x - 4 + a, py - 13 + jj, b - a + 1, 1, jj === 0 || jj === 8 ? '#f2c14e' : OURO)
      })
    }
    let y = py + MAPA_PLACA + 14
    for (const l of viu ? (nomes[k] ?? []) : ['???']) {
      s += texto(c.x, y, l, ' m', viu ? OURO : '#8f80b8')
      y += LH()
    }
    const pg = b.paginas
    const de = (pg[0] ?? 0) + 1
    const ate = (pg[pg.length - 1] ?? 0) + 1
    s += texto(c.x, y, de === ate ? tx('livro.bestiario.pagina', { n: de }) : tx('livro.mapa.paginas', { de, ate }), ' m', '#8f80b8')
  })
  const linhas = Math.ceil(biomas.length / cols)
  const H = cab.y + 10 + linhas * CH
  const vistos = biomas.filter((_, k) => visitado(k)).length
  return { corpo: s, H, alt: tx('livro.mapa.alt', { visitados: vistos, bioma: aqui }) }
}

// ---------------------------------------------------------------- Troféus

export const NOME_TROFEU = {} as Record<TipoTrofeu, string>
for (const k of ['comando', 'edicao', 'leitura', 'web'] as const) {
  Object.defineProperty(NOME_TROFEU, k, { get: () => tx(`livro.trofeus.nome.${k}`), enumerable: true })
}

/** Quantos troféus cabem na estante (3 prateleiras de 5). */
export const VAGAS = 15

function trofeus(d: Doc, j: Jogo, W: number): { corpo: string; H: number; alt: string; alvos: Alvo[] } {
  const lista = j.trofeus ?? []
  const cab = cabecalho(W, tx('livro.trofeus.titulo'), lista.length === 0 ? tx('livro.trofeus.vazio') : tx('livro.trofeus.subtitulo'))
  let s = cab.svg
  const est = META.trofeus as unknown as { estante: { vagas: readonly (readonly (readonly [number, number])[])[] } }
  const vagas = est.estante.vagas.flat()
  const ex = Math.floor((W - 180) / 2)
  const ey = cab.y
  s += `<use href="${d.img('estante')}" x="${ex}" y="${ey}"/>`
  const alvos: Alvo[] = []
  lista.slice(0, VAGAS).forEach((nome, k) => {
    const tipo = j.trofeusTipos?.[k] ?? 'edicao'
    const a = art(`trofeu_${tipo}`)
    const [vx, vy] = vagas[k] ?? [0, 0]
    const x = ex + vx - Math.floor(a.w / 2)
    const y = ey + vy - a.h
    s += `<use href="${d.img(`trofeu_${tipo}`)}" x="${x}" y="${y}"/>`
    alvos.push({ id: `trofeu_${k}`, x, y, w: a.w, h: a.h, titulo: NOME_TROFEU[tipo], explica: tx('livro.trofeus.explica', { nome }) })
  })
  let y = ey + 148 + 16
  const resumo = lista.length === 0 ? tx('livro.trofeus.estante_vazia') : lista.length > VAGAS ? tx('livro.trofeus.estante_cheia', { n: lista.length, vagas: VAGAS }) : tp('livro.trofeus.estante', lista.length)
  for (const l of quebrar(resumo, W - 24)) {
    s += texto(W / 2, y, l, ' m', '#cdbdf0')
    y += LH()
  }
  return { corpo: s, H: y + 6, alt: tx('livro.trofeus.alt', { lista: lista.length === 0 ? tx('livro.trofeus.nenhum') : lista.slice(0, VAGAS).join(' · ') }), alvos }
}

// ---------------------------------------------------------------- Grimório

type Feitico = { papel: string; nome: string; desc: string; icone: string }

/** As ferramentas do Claude, por papel de monstro, como feitiços da Lua. */
export const FEITICOS: readonly Feitico[] = [
  feitico('ler', 'trofeu_leitura'),
  feitico('editar', 'trofeu_edicao'),
  feitico('terminal', 'trofeu_comando'),
  feitico('web', 'trofeu_web'),
  feitico('integracao', 'projetil'),
  feitico('subagente', 'canalizar'),
]

/** Um feitiço com nome e descrição no idioma em uso (livro.grimorio.<papel>). */
function feitico(papel: Feitico['papel'], icone: Feitico['icone']): Feitico {
  return {
    papel,
    icone,
    get nome() { return tx(`livro.grimorio.${papel}.nome`) },
    get desc() { return tx(`livro.grimorio.${papel}.desc`) },
  }
}

function grimorio(d: Doc, j: Jogo, W: number): { corpo: string; H: number; alt: string } {
  const cab = cabecalho(W, tx('livro.grimorio.titulo'), tx('livro.grimorio.subtitulo'))
  let s = cab.svg
  let y = cab.y
  const usos = j.feiticos ?? {}
  for (const f of FEITICOS) {
    // ícone numa moldurinha de 44 x 32 (centro em x = 34)
    s += ret(12, y, 44, 32, '#271c45') + ret(12, y, 44, 1, LINHA) + ret(12, y + 31, 44, 1, LINHA)
    const a = art(f.icone)
    if (f.icone === 'projetil') {
      // a estrela do feitiço girando, em 2x
      s += `<g transform="translate(23,${y + 5}) scale(2)">${d.tira('projetil', 0, 0, 11, 11, [[0, 90], [1, 90], [2, 90], [3, 90]], 0)}</g>`
    } else if (f.icone === 'canalizar') {
      // o círculo mágico de canalizar, girando
      s += d.tira('canalizar', 14, y + 11, 41, 11, [[0, 120], [1, 120], [2, 120], [3, 120]], 0)
    } else {
      s += `<use href="${d.img(f.icone)}" x="${34 - Math.floor(a.w / 2)}" y="${y + 2 + Math.floor((28 - a.h) / 2)}"/>`
    }
    const n = usos[f.papel] ?? 0
    const conta = `${n}×`
    s += `<text class="t e" x="${W - 14}" y="${y + 11}" style="fill:${OURO}">${esc(conta)}</text>`
    const nomeMax = W - 64 - 14 - larguraCurta(conta, PX_LETRA_TITULO) - 6
    s += titulo(64, y + 11, nomeQueCabe(f.nome, nomeMax))
    let ly = y + 24
    for (const l of quebrar(f.desc, W - 64 - 14)) {
      s += texto(64, ly, l, '', '#e9d9ff')
      ly += LH()
    }
    y = Math.max(y + 38, ly + 4)
  }
  const total = Object.values(usos).reduce((t, v) => t + v, 0)
  s += texto(W / 2, y + 6, tp('livro.grimorio.total', total), ' m', '#cdbdf0')
  return { corpo: s, H: y + 18, alt: tx('livro.grimorio.alt', { lista: FEITICOS.map(f => tp('livro.grimorio.alt_item', usos[f.papel] ?? 0, { nome: f.nome })).join(', ') }) }
}

// ---------------------------------------------------------------- tudo junto

/**
 * Uma página do Livro, `W` px de arte de largura, desenhada em `escala`.
 * As áreas de hover (troféus) vêm em px da arte, como os alvos da faixa.
 */
export function paginaDoLivro(aba: AbaDoLivro, j: Jogo, W0: number, escala: number): PaginaDoLivro {
  const W = Math.max(LARGURA_MIN, Math.floor(W0))
  const d = new Doc()
  let p: { corpo: string; H: number; alt: string; alvos?: Alvo[] }
  if (aba === 'mapa') {
    p = mapa(j, W)
  } else if (aba === 'bestiario') {
    p = bestiario(d, j, W)
  } else if (aba === 'trofeus') {
    p = trofeus(d, j, W)
  } else if (aba === 'grimorio') {
    p = grimorio(d, j, W)
  } else {
    p = ficha(d, j, W)
  }
  // créditos (pedido do usuário): a assinatura do autor no pé de toda página, à direita
  const aw = (art('assinatura')['w'] as number) ?? 59
  const H = p.H + 12
  const assinatura = `<use href="${d.img('assinatura')}" x="${W - 14 - aw}" y="${H - 19}" opacity="0.85"/>`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * escala}" height="${H * escala}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">` +
    `<style>svg,image,use{image-rendering:crisp-edges;image-rendering:pixelated}${cssTexto()}${cssFonteLivro()}${d.css.join('')}</style>` +
    `<defs>${d.defs.join('')}</defs>` +
    moldura(W, H) +
    p.corpo +
    assinatura +
    `</svg>`
  return { svg, largura: W * escala, altura: H * escala, alvos: p.alvos ?? [], alt: tx('livro.alt', { alt: p.alt }) }
}
