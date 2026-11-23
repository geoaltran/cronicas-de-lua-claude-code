// Monta a faixa do jogo como um SVG animado (CSS + SMIL), sem script.
// Toda a animação contínua (parallax, passos, respiração, contagem do luar)
// roda no próprio SVG; o mod só redesenha quando o estado muda. Cada
// animação usa um atraso negativo calculado do relógio, então um redesenho
// continua exatamente de onde a cena estava (sem pulo).
import { FONTE, FONTE_LONGA, MARCA, META } from './arte'
import { ANDAR, Doc, P, PARADA, type Q, art, esc, mod, r, sorteio } from './base'
import type { Caminho, Chefao, Hud, Luta } from '../types'
import { desenharLuta } from './luta'
import { t as tx, tp } from './t'
import { barraNoLugar, chefaoEm, chefaoEmCena, fimDoChefao, paginaRecuperada, paginasNoCiclo, tingir } from './chefao'

/** px por segundo que o chão rola enquanto a Lua anda (5 px por quadro de 110 ms). */
export const VEL = 5 / 0.11
const PAD = 241 // (960 - 479 + 1) / 2, como em previa_cenario.py
const QW = 80
const PES_Q = 96
export const LARGURA_MIN = 508
export const LARGURA_MAX = 958

export type Modo = 'compacto' | 'chefao'

export type Vista = {
  agora: number
  /** Largura nativa da cena (px de arte). */
  W: number
  escala: number
  modo: Modo
  caminho: Caminho
  hud: Hud
  /** Mostrar os botões (fase 4): ficam no HUD quando cabem, senão no alto da cena. */
  botoes?: boolean
  /** Como cada botão está (aceso, cheio, desfraldado, aberto); sem isso, todos inativos. */
  estadoBotoes?: EstadoBotoes
  /**
   * Sem os balões dentro do SVG: no modo imagem eles nunca aparecem (o hover é
   * do app, com balões próprios), e só gastariam o limite de caracteres.
   */
  semBaloes?: boolean
  /**
   * Largura de uma célula de texto do app em px de arte: o HUD alinha as barras
   * a essa grade, para as áreas de mouse (posicionadas em células) caírem em
   * cima delas. Sem ela, o arranjo de antes.
   */
  celula?: number
  /** Tamanho da estrela LV em relação à moldura: 1 (mesma escala) ou 0.5. */
  estrela?: 1 | 0.5
  /** Frase do aviso de lua nova (para testar opções). */
  fraseLuaNova?: string
  /** Aviso de lua nova no meio da cena (padrão) ou no alto. */
  avisoNoMeio?: boolean
  /** A luta que está na tela (Fase 2). */
  luta?: Luta
  /** O chefão em cena (Fase 3). */
  chefao?: Chefao
  /** Como o chefão tinge a cena: tudo, de leve (padrão, escolha do usuário), ou só o fundo, mais forte. */
  tom?: 'fundo' | 'todo'
  /** Até quando desenhar as poses da Lua na luta (padrão: o próximo marco; a prévia usa Infinity). */
  horizonte?: number
  /** O SVG não coube: sem partículas e sem a tira de andar na luta. */
  economia?: boolean
  /** Sem a assinatura do autor (último recurso quando o SVG passa do limite do app). */
  semAssinatura?: boolean
  /** Um texto longo pode aparecer (balões visíveis ou aviso de lua nova): embute a Pixelify Sans. */
  textoLongo?: boolean
  /** Hora (ms) em que a tela de abertura começou; some sozinha em ABERTURA.fim. */
  abertura?: number
}

/**
 * Tela de abertura, dentro da faixa (mesma altura). Dois redesenhos, porque a
 * marca e a floresta juntas passariam do limite de caracteres do app:
 *   fase 1 (0 até fase2): céu noturno + a marca animada, que aparece, fica e some;
 *   fase 2 (fase2 até fim): a floresta clareia e a Lua chega andando pela esquerda.
 * Os tempos são do relógio: um redesenho no meio continua do ponto certo.
 */
export const ABERTURA = {
  /** a marca aparece (ms). */
  entra: 600,
  /** a marca começa a sumir e a noite fecha. */
  sai: 3400,
  /** fim da fase 1: redesenho com a floresta. */
  fase2: 4000,
  /** a floresta clareia em (ms, contados da fase 2). */
  clareia: 900,
  /** a Lua começa a andar (ms, contados da fase 2). */
  anda: 300,
  /** quanto ela anda até o lugar dela (px de arte). */
  distancia: 120,
} as const
/** Fim da abertura (ms): a Lua chegou ao lugar dela. */
export const FIM_ABERTURA = ABERTURA.fase2 + ABERTURA.anda + Math.ceil((ABERTURA.distancia / (5 / 0.11)) * 1000) + 200

export type FaseAbertura = { fase: 1 | 2; t: number }

/** Em que fase da abertura a cena está (t: ms desde o começo da fase), ou nada. */
export function faseAbertura(v: Pick<Vista, 'abertura' | 'agora'>): FaseAbertura | undefined {
  if (v.abertura === undefined) {
    return undefined
  }
  const e = v.agora - v.abertura
  if (e < 0 || e >= FIM_ABERTURA) {
    return undefined
  }
  return e < ABERTURA.fase2 ? { fase: 1, t: e } : { fase: 2, t: e - ABERTURA.fase2 }
}

const NOITE = '#0b0a20'
const seg = (ms: number) => `${r(ms) / 1000}s`

export const ALTURA_HUD = 48

export const JANELA: Record<Modo, { topo: number; fundoTopo: number }> = {
  compacto: { topo: 70, fundoTopo: 8 },
  chefao: { topo: 0, fundoTopo: 0 },
}

export function alturaCena(modo: Modo): number {
  return 226 - JANELA[modo].topo
}

export function distancia(c: Caminho, agora: number): number {
  const ate = Math.min(agora, c.ate ?? Infinity)
  return c.dist0 + (c.andando ? (Math.max(0, ate - c.desde) / 1000) * VEL : 0)
}

/** Se a Lua está andando agora (ela para sozinha em `ate`). */
export function andandoAgora(c: Caminho, agora: number): boolean {
  return c.andando && (c.ate === undefined || agora < c.ate)
}

/** XP para passar do nível n ao n+1. */
const precisa = (n: number) => 10 + 5 * (n - 1)

export function nivelDe(xp: number): { nivel: number; dentro: number; precisa: number } {
  let n = 1
  let resto = Math.max(0, Math.floor(xp))
  while (n < 9999 && resto >= precisa(n)) {
    resto -= precisa(n)
    n += 1
  }
  return { nivel: n, dentro: resto, precisa: precisa(n) }
}

export type Luar = { frac: number; restanteMs: number; temLuz: boolean; desmaiada: boolean }

export function luar(hud: Hud, agora: number): Luar {
  if (hud.luz === null) {
    return { frac: 0, restanteMs: 0, temLuz: false, desmaiada: false }
  }
  const restanteMs = Math.max(0, hud.luz.at + hud.luz.ttlMs - agora)
  return {
    frac: Math.min(1, restanteMs / hud.luz.ttlMs),
    restanteMs,
    temLuz: true,
    desmaiada: restanteMs === 0,
  }
}

// ---------------------------------------------------------------- cenário


function particula(d: Doc, nome: string, x: number, y: number, fasesMs: number, agora: number, ping = false): string {
  const a = art(`p_${nome}`)
  const q = a['q'] as number
  const ms = a['ms'] as number
  const seq: Q[] = ping ? [[0, ms], [1, ms], [2, ms], [3, ms], [2, ms], [1, ms]] : [[0, ms], [1, ms], [2, ms], [3, ms]]
  return d.tira(`p_${nome}`, x, y, q, q, seq, agora + fasesMs)
}

function cenario(d: Doc, v: Vista, dist: number, soCeu = false): string {
  const { W, modo, agora } = v
  const { topo, fundoTopo } = JANELA[modo]
  const x0 = Math.floor(480 - W / 2)
  const t = agora / 1000
  const andando = andandoAgora(v.caminho, agora)
  // a Lua vai parar sozinha (um monstro chegou): a rolagem para junto
  const para = andando && v.caminho.ate !== undefined ? v.caminho.ate - agora : undefined
  const emLuta = v.luta !== undefined
  const partes: string[] = []
  const cen = META.cenario.camadas

  // 1. fundo parado (céu, Lua do céu, castelo)
  partes.push(`<use href="${d.img('fundo')}" x="${-x0}" y="${-fundoTopo}"/>`)

  // Lua do céu minguando conforme o luar (cache) acaba
  partes.push(luaDoCeu(d, v, x0, fundoTopo))

  // estrelinhas cintilando, presas ao céu
  const rnd = sorteio(3)
  for (let i = 0; i < 7; i++) {
    const sx = 8 + Math.floor(rnd() * (W - 16))
    const sy = 3 + Math.floor(rnd() * 44)
    const fase = Math.floor(rnd() * 8) * 220
    const ms = 220
    const seq: Q[] = [[0, ms], [1, ms], [2, ms], [3, ms], [-1, ms * 4]]
    partes.push(d.tira('p_estrela', sx, sy, 7, 7, seq, agora + fase))
  }

  // 2. nuvens: parallax lento + vento
  const nv = cen[1] as { velocidade: number; vento_px_por_s: number }
  const nuv = art('nuvens')
  const yN = (nuv['oy'] as number) - fundoTopo
  const uN = d.img('nuvens')
  // o vento nunca para; o parallax da caminhada para com a Lua (dois rolos, um dentro do outro)
  const caminhada = d.rolo(
    `<use href="${uN}" x="0" y="${yN}"/><use href="${uN}" x="${P}" y="${yN}"/><use href="${uN}" x="${2 * P}" y="${yN}"/>`,
    x0 - PAD + dist * nv.velocidade,
    andando ? VEL * nv.velocidade : 0,
    para,
  )
  partes.push(d.rolo(caminhada, t * nv.vento_px_por_s, nv.vento_px_por_s))

  // 3. ilhas flutuantes: parallax + balanço
  const il = cen[2] as { readonly ilhas: readonly { arquivo: string; x: number; y: number }[]; velocidade: number; balanco_px: number }
  let ilhas = ''
  il.ilhas.forEach((ilha, k) => {
    const nome = ilha.arquivo.replace('.png', '')
    const base = mod(ilha.x - x0, P)
    const y = ilha.y - fundoTopo
    const u = d.img(nome)
    for (const dx of [0, P]) {
      ilhas += d.balanco(`<use href="${u}" x="${base + dx}" y="${y}"/>`, il.balanco_px, 3100, k * 1400, agora)
    }
  })
  partes.push(d.rolo(ilhas, dist * il.velocidade, andando ? VEL * il.velocidade : 0, para))
  if (soCeu) {
    // abertura, fase 1: só o céu (as árvores ficam para o redesenho seguinte)
    return partes.join('')
  }

  // 4. meio (árvores) com vaga-lumes e folhas caindo junto
  const md = cen[3] as { velocidade: number }
  const meio = art('meio')
  const yM = (meio['oy'] as number) - topo
  const uM = d.img('meio')
  let conteudoMeio = `<use href="${uM}" x="0" y="${yM}"/><use href="${uM}" x="${P}" y="${yM}"/>`
  const rv = sorteio(7)
  // na luta, menos partículas (sobra espaço no SVG para os efeitos)
  for (let i = 0; i < (v.economia === true ? 0 : emLuta ? 5 : 9); i++) {
    const vx = Math.floor(rv() * P)
    const vy = 130 + Math.floor(rv() * 55) - topo
    const fase = Math.floor(rv() * 3000)
    for (const dx of [0, P]) {
      conteudoMeio += d.balanco(particula(d, 'vagalume', vx + dx, vy, fase, agora, true), 2, 2600, fase, agora)
    }
  }
  const rf = sorteio(11)
  for (let i = 0; i < (v.economia === true ? 0 : emLuta ? 2 : 4); i++) {
    const fx = Math.floor(rf() * P)
    const fy = 110 + Math.floor(rf() * 30) - topo
    const queda = 209 - topo - fy - 6
    const dur = 5200 + Math.floor(rf() * 2400)
    const fase = Math.floor(rf() * dur)
    const k = d.anim(
      `0%{transform:translate(0px,0px);opacity:1}25%{transform:translate(-6px,${r(queda * 0.25)}px)}50%{transform:translate(-3px,${r(queda * 0.5)}px)}75%{transform:translate(-10px,${r(queda * 0.75)}px)}92%{opacity:1}100%{transform:translate(-8px,${queda}px);opacity:0}`,
      dur, `steps(${Math.max(8, r(queda / 2))})`, -mod(agora + fase, dur), 'infinite',
    )
    for (const dx of [0, P]) {
      conteudoMeio += `<g class="${k}">${particula(d, 'folha', fx + dx, fy, fase, agora)}</g>`
    }
  }
  partes.push(d.rolo(conteudoMeio, x0 - PAD + dist * md.velocidade, andando ? VEL * md.velocidade : 0, para))
  // chefão em cena: o fundo (céu, nuvens, ilhas, árvores) ganha o tom dele; o chão e os personagens não
  if (v.chefao !== undefined && fimDoChefao(v.chefao) > agora && v.tom === 'fundo') {
    partes.push(tingir(v.chefao, W, alturaCena(modo), 0.3))
  }

  // 5. chão da frente (onde a Lua pisa)
  const ch = art('chao')
  const yC = (ch['oy'] as number) - topo
  const uC = d.img('chao')
  partes.push(
    d.rolo(`<use href="${uC}" x="0" y="${yC}"/><use href="${uC}" x="${P}" y="${yC}"/>`, x0 - PAD + dist, andando ? VEL : 0, para),
  )
  return partes.join('')
}

function luaDoCeu(d: Doc, v: Vista, x0: number, fundoTopo: number): string {
  const lc = art('lua_ceu_cobre')
  const lx = (lc['x'] as number) - x0
  const ly = (lc['y'] as number) - fundoTopo
  const l = luar(v.hud, v.agora)
  // sem luz nenhuma ainda (sessão nova): a lua do céu fica como está
  if (!l.temLuz) {
    return ''
  }
  const cl = d.id('c')
  const w = lc.w
  // cobre da direita para a esquerda: começa cobrindo (1 - frac)
  const x1 = lx + w * l.frac
  const anima =
    l.restanteMs > 0
      ? `<animate attributeName="x" from="${x1.toFixed(1)}" to="${lx}" dur="${(l.restanteMs / 1000).toFixed(1)}s" fill="freeze"/>`
      : ''
  return (
    `<clipPath id="${cl}"><rect x="${l.restanteMs > 0 ? x1.toFixed(1) : lx}" y="${ly}" width="${w}" height="${lc.h}">${anima}</rect></clipPath>` +
    `<g clip-path="url(#${cl})"><use href="${d.img('lua_ceu_cobre')}" x="${lx}" y="${ly}"/></g>`
  )
}

// ---------------------------------------------------------------- Lua

function lua(d: Doc, v: Vista, desmaiada: boolean, naLuta?: { corpo: string; trilha: [number, string][] }): string {
  const pes = 209 - JANELA[v.modo].topo
  const x = 40
  const y = pes - PES_Q
  const { nivel } = nivelDe(v.hud.jogo.xp)
  let corpo: string
  const ab = faseAbertura(v)
  if (ab?.fase === 2) {
    // abertura: ela entra andando pela esquerda (o chão não rola) e para no lugar
    const anda = Math.ceil((ABERTURA.distancia / VEL) * 1000)
    const total = ABERTURA.anda + anda
    const tempo = `dur="${seg(total)}" begin="${seg(-ab.t)}" fill="freeze"`
    const k = (ABERTURA.anda / total).toFixed(3)
    corpo =
      `<g><animate attributeName="opacity" values="1;0" keyTimes="0;1" calcMode="discrete" ${tempo}/>` +
      `<g transform="translate(${-ABERTURA.distancia} 0)"><animateTransform attributeName="transform" type="translate" values="${-ABERTURA.distancia} 0;${-ABERTURA.distancia} 0;0 0" keyTimes="0;${k};1" ${tempo}/>` +
      `${d.tira('lua_andar', 0, 0, QW, 100, ANDAR, ab.t)}</g></g>` +
      `<g opacity="0"><animate attributeName="opacity" values="0;1" keyTimes="0;1" calcMode="discrete" ${tempo}/>` +
      `${d.tira('lua_parada', 0, 0, QW, 100, PARADA, v.agora)}</g>`
  } else if (desmaiada) {
    corpo = d.tira('lua_dano', 0, 0, QW, 100, [[1, 1]], 0)
  } else if (naLuta !== undefined) {
    corpo = d.pista(naLuta.trilha, v.agora, naLuta.corpo)
  } else if (andandoAgora(v.caminho, v.agora)) {
    corpo = d.tira('lua_andar', 0, 0, QW, 100, ANDAR, v.agora - v.caminho.desde)
  } else {
    corpo = d.tira('lua_parada', 0, 0, QW, 100, PARADA, v.agora)
  }
  // a cada 2 níveis a varinha e a roupa brilham um pouco mais
  const brilho = Math.min(6, Math.floor(nivel / 2))
  let filtro = ''
  if (brilho > 0) {
    const f = d.id('f')
    d.defs.push(
      `<filter id="${f}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="0.8" flood-color="#ffe27a" flood-opacity="${(0.12 + brilho * 0.1).toFixed(2)}"/></filter>`,
    )
    filtro = ` filter="url(#${f})"`
  }
  return `<g transform="translate(${x},${y})"${filtro}>${corpo}</g>`
}

// ---------------------------------------------------------------- HUD

export const CSS_TEXTO =
  // Silkscreen: grade de 8 px; 12 px = 1,5 px de tela por pixel da fonte (3 pixels físicos na Retina)
  `@font-face{font-family:'Silkscreen';src:url(${FONTE}) format('woff2')}` +
  ".t{font-family:'Silkscreen',ui-monospace,monospace;font-size:12px;fill:#fff6d8;stroke:#1d1433;stroke-width:2px;paint-order:stroke;text-rendering:optimizeSpeed}" +
  '.m{text-anchor:middle}.e{text-anchor:end}.n{fill:#e9d9ff}.b{font-size:12px}' +
  // textos longos (balões, aviso de lua nova): Pixelify Sans, com minúsculas
  ".l{font-family:'Pixelify Sans','Silkscreen',ui-monospace,monospace;font-weight:500;font-size:10px}"

/** A Pixelify Sans só entra no desenho quando um texto longo pode aparecer (economiza ~6 mil caracteres). */
export const CSS_FONTE_LONGA = `@font-face{font-family:'Pixelify Sans';src:url(${FONTE_LONGA}) format('woff2');font-weight:500}`

function texto(x: number, y: number, s: string, classe = 'm'): string {
  return `<text class="t ${classe}" x="${x}" y="${y}">${esc(s)}</text>`
}

/** Um texto que troca com o tempo (SMIL): [início s, fim s, texto]. */
type Trecho = [number, number, string]

function textoNoTempo(trechos: readonly Trecho[], desenha: (t: Trecho) => string): string {
  return trechos
    .map(t => {
      const fimAttr = Number.isFinite(t[1]) ? ` end="${t[1].toFixed(1)}s"` : ''
      return `<g visibility="hidden"><set attributeName="visibility" to="visible" begin="${t[0].toFixed(1)}s"${fimAttr}/>${desenha(t)}</g>`
    })
    .join('')
}

type Barra = {
  tipo: 'luz' | 'mana' | 'mochila' | 'xp'
  frac: number
  /** Nome da barra, na linha acima dela (Luz da Lua, Mana Estelar...). */
  nome: string
  /** Valor curto, à direita na mesma linha (41 min, 72%...). */
  valor: string
  /** O que aparece no balão ao passar o mouse: título e uma linha de explicação. */
  titulo: string
  explica: string
  /** Se a barra esvazia sozinha até 0 em `esvaziaMs` (o luar). */
  esvaziaMs?: number
  /** Valores que trocam com o tempo (a contagem do luar). */
  valores?: Trecho[]
  treme?: boolean
}

const PONTA = 20 // cada ponta ornamentada do trilho; o miolo entre elas é uniforme

/** Nome curto de cada barra, para quando o nome inteiro e o valor não cabem juntos. */
const nomeCurto = (tipo: Barra['tipo']): string => tx(`barras.${tipo}.curto`)

/** O trilho dourado com `largura` px: as duas pontas como são, o miolo repetido. */
function trilho(d: Doc, largura: number): string {
  const href = d.img('barra_trilho')
  const t = art('barra_trilho')
  const meio = largura - 2 * PONTA
  return (
    `<svg width="${PONTA}" height="${t.h}" overflow="hidden"><use href="${href}"/></svg>` +
    `<svg x="${PONTA}" width="${meio}" height="${t.h}" viewBox="110 0 1 ${t.h}" preserveAspectRatio="none"><use href="${href}"/></svg>` +
    `<svg x="${largura - PONTA}" width="${PONTA}" height="${t.h}" viewBox="${t.w - PONTA} 0 ${PONTA} ${t.h}"><use href="${href}"/></svg>`
  )
}

function barra(d: Doc, x: number, y: number, larguraBarra: number, b: Barra, agora: number, i: number): string {
  const ib = META.barra.interior
  const iw = larguraBarra - 2 * ib.x // interior encolhe junto com o trilho
  const frac = Math.max(0, Math.min(1, b.frac))
  const larg = r(iw * frac)
  const cl = d.id('c')
  const esv = b.esvaziaMs !== undefined && b.esvaziaMs > 0 && larg > 0
  const durS = esv ? (b.esvaziaMs as number) / 1000 : 0
  // esvazia de 1 em 1 px inteiro (calcMode discrete): andar em frações de pixel
  // faz o preenchimento e a gema tremerem com o desenho em pixel art
  const passos = Array.from({ length: larg + 1 }, (_, k) => larg - k)
  const animW = esv ? `<animate attributeName="width" values="${passos.join(';')}" calcMode="discrete" dur="${durS.toFixed(1)}s" fill="freeze"/>` : ''
  const gx = ib.x + larg - 14
  const animG = esv
    ? `<animateTransform attributeName="transform" type="translate" values="${passos.map(p => `${ib.x + p - 14} -1`).join(';')}" calcMode="discrete" dur="${durS.toFixed(1)}s" fill="freeze"/>`
    : ''
  // nome à esquerda e valor à direita, numa linha acima da barra
  // nome e valor das barras: maiores e em caixa alta (leitura melhor). Se não
  // couberem juntos na largura da barra, o nome encurta (LUZ, MANA...).
  // (o "lua nova" do fim da contagem não conta: nessa hora a faixa é redesenhada)
  const maiorValor = Math.max(...[b.valor, ...(b.valores ?? []).filter(t => Number.isFinite(t[1])).map(t => t[2])].map(v => larguraTexto(v)))
  const cabe = larguraTexto(b.nome) + 10 + maiorValor <= larguraBarra - 4
  const nome = texto(2, 8, (cabe ? b.nome : nomeCurto(b.tipo)).toUpperCase(), 'n b')
  const valor = (s: string) => texto(larguraBarra - 2, 8, s.toUpperCase(), 'e b')
  const textos = nome + (b.valores !== undefined ? textoNoTempo(b.valores, t => valor(t[2])) : valor(b.valor))
  let classe = ''
  if (b.treme === true) {
    classe = ` class="${d.anim('0%{transform:translateX(0)}25%{transform:translateX(1px)}50%{transform:translateX(0)}75%{transform:translateX(-1px)}100%{transform:translateX(0)}', 320, 'step-end', -mod(agora, 320), 'infinite')}"`
  }
  // o preenchimento é a mesma faixa de cor, só mais estreita (cada degrau de cor encolhe junto)
  const preench = `<svg x="${ib.x}" y="${ib.y}" width="${iw}" height="${ib.h}" viewBox="0 0 ${ib.w} ${ib.h}" preserveAspectRatio="none"><use href="${d.img(`barra_${b.tipo}`)}"/></svg>`
  return (
    `<g class="br br${i}" transform="translate(${x},${y})"><rect width="${larguraBarra}" height="34" fill="transparent"/><g${classe}>${textos}` +
    `<g transform="translate(0,10)">${trilho(d, larguraBarra)}` +
    `<clipPath id="${cl}"><rect x="${ib.x}" y="${ib.y}" width="${larg}" height="${ib.h}">${animW}</rect></clipPath>` +
    `<g clip-path="url(#${cl})">${preench}</g>` +
    (larg > 0 ? `<g transform="translate(${gx},-1)">${animG}<use href="${d.img('barra_gema')}"/></g>` : '') +
    `</g></g></g>`
  )
}

/** Selo de nível: a estrela "LV" em cima e a moldura com o número embaixo. */
export function selo(d: Doc, x: number, base: number, nivel: number, escalaEstrela: number): { svg: string; largura: number } {
  const s = String(Math.max(1, Math.min(9999, nivel)))
  const dig = Math.max(2, s.length) as 2 | 3 | 4
  const m = META.nivel.molduras[`${dig}dig`]
  const passo = META.nivel.digito.passo
  const tw = META.nivel.digito.w + (s.length - 1) * passo
  const dx = m.interior.x + Math.floor((m.interior.w - tw) / 2)
  const dy = m.interior.y + Math.floor((m.interior.h - META.nivel.digito.h) / 2)
  let digs = ''
  for (let i = 0; i < s.length; i++) {
    digs += `<use href="${d.img(`nivel_d${s[i]}`)}" x="${dx + i * passo}" y="${dy}"/>`
  }
  const est = art('nivel_estrela_lv')
  const ew = est.w * escalaEstrela
  const eh = est.h * escalaEstrela
  const largura = Math.max(m.w, Math.ceil(ew))
  const my = base - m.h
  const mx = x + Math.floor((largura - m.w) / 2)
  // a ponta de baixo da estrela encosta na pedra do topo da moldura
  const ey = my - eh + Math.round(4 * escalaEstrela) + 2
  const ex = x + (largura - ew) / 2
  return {
    svg:
      `<g><title>Nível ${s}</title>` +
      `<g transform="translate(${mx},${my})"><use href="${d.img(`nivel_${dig}`)}"/>${digs}</g>` +
      `<g transform="translate(${ex},${ey}) scale(${escalaEstrela})"><use href="${d.img('nivel_estrela_lv')}"/></g></g>`,
    largura,
  }
}

export const BOTOES = ['vigilia', 'mochila', 'estandarte', 'livro'] as const
export type NomeBotao = (typeof BOTOES)[number]

/** O estado de cada botão, como a cena o desenha. */
export type EstadoBotoes = {
  /** Vigília acesa, quantas mensagens já mandou e o máximo; `pisca`: quando a lanterna piscou. */
  vigilia: boolean
  envios: number
  maxEnvios: number
  pisca?: number
  /** Mochila cheia (contexto acima de 80%) ou sendo arrumada. */
  mochila: boolean
  estandarte: 'enrolado' | 'escrevendo' | 'pronto'
  livro: boolean
}

/** Nome e explicação do balão de cada botão, conforme o estado. Curtos: cabem numa linha. */
export function rotuloBotao(b: NomeBotao, e?: EstadoBotoes): [string, string] {
  switch (b) {
    case 'vigilia':
      return e?.vigilia === true
        ? [tx('botoes.vigilia.acesa'), tx('botoes.vigilia.acesa_explica', { envios: e.envios, max: e.maxEnvios })]
        : [tx('botoes.vigilia.nome'), tx('botoes.vigilia.explica')]
    case 'mochila':
      return e?.mochila === true ? [tx('botoes.mochila.cheia'), tx('botoes.mochila.cheia_explica')] : [tx('botoes.mochila.nome'), tx('botoes.mochila.explica')]
    case 'estandarte':
      return e?.estandarte === 'escrevendo'
        ? [tx('botoes.estandarte.nome'), tx('botoes.estandarte.escrevendo')]
        : e?.estandarte === 'pronto'
          ? [tx('botoes.estandarte.nome'), tx('botoes.estandarte.pronto')]
          : [tx('botoes.estandarte.nome'), tx('botoes.estandarte.explica')]
    case 'livro':
      return e?.livro === true ? [tx('botoes.livro.nome'), tx('botoes.livro.aberto_explica')] : [tx('botoes.livro.nome'), tx('botoes.livro.explica')]
  }
}

/** Quadros da chama da Vigília e da bandeira do Estandarte (160 ms, como na prévia). */
const QUADROS_BOTAO: readonly Q[] = [[0, 160], [1, 160], [2, 160]]
/** Quanto tempo a lanterna pisca depois de acender ou de mandar uma mensagem. */
export const PISCA_MS = 1600

/** Um ícone de botão: aceso/animado conforme o estado; a lanterna pisca depois de cada envio. */
function iconeBotao(d: Doc, b: NomeBotao, bx: number, y: number, e: EstadoBotoes | undefined, agora: number): string {
  const anima = (b === 'vigilia' && e?.vigilia === true) || (b === 'estandarte' && e?.estandarte === 'escrevendo')
  let corpo: string
  if (anima) {
    corpo = `<use href="${d.img('bt_moldura_ativo')}" x="${bx}" y="${y}"/>` + d.tira(`bt_${b}_ativo_3f`, bx + 4, y + 4, 24, 24, QUADROS_BOTAO, agora)
  } else {
    const ativo = b === 'mochila' ? e?.mochila === true : b === 'estandarte' ? e?.estandarte === 'pronto' : b === 'livro' ? e?.livro === true : false
    corpo = `<use href="${d.img(`bt_botao_${b}_${ativo ? 'ativo' : 'inativo'}`)}" x="${bx}" y="${y}"/>`
  }
  const desde = b === 'vigilia' && e?.pisca !== undefined ? agora - e.pisca : Infinity
  if (desde >= 0 && desde < PISCA_MS) {
    // 4 clarões de 200 ms em 1,6 s, uma vez só (o atraso negativo continua de onde estava)
    const k = d.anim('0%,25%,50%,75%{filter:brightness(2.2)}12.5%,37.5%,62.5%,87.5%,100%{filter:none}', PISCA_MS, 'step-end', -desde, '1 both')
    corpo = `<g class="${k}">${corpo}</g>`
  }
  return corpo
}
const PASSO_BOTAO = 38 // 32 px de botão + 6 de vão, igual entre todos
export const LARGURA_BOTOES = PASSO_BOTAO * 3 + 32

/** Largura aproximada de um texto na Silkscreen a 12 px (0,75 em por letra): barras. */
const larguraTexto = (s: string) => Math.ceil(s.length * 9)
/** Largura de um texto na Pixelify Sans a 10 px (balões): ~5 px por letra, medido; 5,4 dá folga. */
const PX_LETRA_LONGA = 5.4
const larguraLonga = (s: string) => Math.ceil(s.length * PX_LETRA_LONGA)
/** Letras por linha no balão (padrão; o balão solto usa o que cabe em 80% da cena). */
const LETRAS_BALAO = 34

/**
 * As linhas do texto de um balão: tudo numa linha só enquanto couber em `max`
 * letras; passou disso, quebra entre palavras (de preferência depois de um
 * ponto, onde o texto tem "\n") e o balão cresce na altura.
 */
export function linhasDoBalao(texto: string, max = LETRAS_BALAO): string[] {
  const corrido = texto.replace(/\s*\n\s*/g, ' ').trim()
  if (corrido.length <= max) {
    return [corrido]
  }
  // não coube: junta frases inteiras (separadas por "\n") enquanto couberem;
  // só uma frase maior que a linha quebra entre palavras
  const linhas: string[] = []
  let atual = ''
  const poe = (pedaco: string) => {
    if (atual === '') {
      atual = pedaco
    } else if ((atual + ' ' + pedaco).length <= max) {
      atual = `${atual} ${pedaco}`
    } else {
      linhas.push(atual)
      atual = pedaco
    }
  }
  for (const frase of texto.split('\n').map(f => f.trim()).filter(f => f !== '')) {
    if (frase.length <= max) {
      poe(frase)
      continue
    }
    for (const palavra of frase.split(' ').filter(p => p !== '')) {
      poe(palavra)
    }
  }
  if (atual !== '') {
    linhas.push(atual)
  }
  return linhas
}

/** Tamanho do balão (sem a ponta): o texto quebra em linhas e ele cresce na altura. */
function medidaBalao(nome: string, desc: string, max = LETRAS_BALAO): { w: number; h: number; linhas: string[] } {
  const linhas = linhasDoBalao(desc, max)
  const w = Math.max(larguraLonga(nome), ...linhas.map(larguraLonga)) + 14
  return { w, h: 12 * (1 + linhas.length) + 5, linhas }
}

/** Balão de fala em pixel art, com a ponta apontando para (cx, ponta). */
function balao(cx: number, ponta: number, acima: boolean, nome: string, desc: string, W: number, max = LETRAS_BALAO): string {
  const { w, h, linhas } = medidaBalao(nome, desc, max)
  const x = Math.max(2, Math.min(W - w - 2, Math.round(cx - w / 2)))
  const y = acima ? ponta - 4 - h : ponta + 4
  const borda = '#f2c14e'
  const fundo = '#2a2050'
  // retângulo de cantos "cortados" em pixel + ponta de 4 px
  const corpo =
    `<rect x="${x + 1}" y="${y}" width="${w - 2}" height="${h}" fill="${borda}"/>` +
    `<rect x="${x}" y="${y + 1}" width="${w}" height="${h - 2}" fill="${borda}"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="${fundo}"/>`
  const pt = Math.round(cx)
  const ponteira = acima
    ? `<rect x="${pt - 3}" y="${y + h - 1}" width="6" height="2" fill="${fundo}"/><rect x="${pt - 4}" y="${y + h - 1}" width="1" height="2" fill="${borda}"/><rect x="${pt + 3}" y="${y + h - 1}" width="1" height="2" fill="${borda}"/>` +
      `<rect x="${pt - 2}" y="${y + h + 1}" width="4" height="1" fill="${fundo}"/><rect x="${pt - 3}" y="${y + h + 1}" width="1" height="1" fill="${borda}"/><rect x="${pt + 2}" y="${y + h + 1}" width="1" height="1" fill="${borda}"/>` +
      `<rect x="${pt - 1}" y="${y + h + 2}" width="2" height="1" fill="${borda}"/>`
    : `<rect x="${pt - 3}" y="${y - 1}" width="6" height="2" fill="${fundo}"/><rect x="${pt - 4}" y="${y - 1}" width="1" height="2" fill="${borda}"/><rect x="${pt + 3}" y="${y - 1}" width="1" height="2" fill="${borda}"/>` +
      `<rect x="${pt - 2}" y="${y - 2}" width="4" height="1" fill="${fundo}"/><rect x="${pt - 3}" y="${y - 2}" width="1" height="1" fill="${borda}"/><rect x="${pt + 2}" y="${y - 2}" width="1" height="1" fill="${borda}"/>` +
      `<rect x="${pt - 1}" y="${y - 3}" width="2" height="1" fill="${borda}"/>`
  return (
    `<g class="bb">${corpo}${ponteira}` +
    `<text class="t n l" x="${x + 7}" y="${y + 12}" style="fill:#ffe27a">${esc(nome)}</text>` +
    linhas.map((l, i) => `<text class="t n l" x="${x + 7}" y="${y + 24 + 12 * i}">${esc(l)}</text>`).join('') +
    '</g>'
  )
}

/**
 * Os quatro botões lado a lado, alinhados à direita em `xDireita`. O nome e o
 * que o botão faz aparecem num balão de fala ao passar o mouse (por cima quando
 * os botões estão no HUD, por baixo quando estão no alto da cena).
 */
function botoes(d: Doc, xDireita: number, y: number, balaoAcima: boolean, W: number, e?: EstadoBotoes, agora = 0, comBaloes = true): string {
  const x0 = xDireita - LARGURA_BOTOES
  const icones: string[] = []
  const baloes: string[] = []
  BOTOES.forEach((b, i) => {
    const bx = x0 + i * PASSO_BOTAO
    const [nome, desc] = rotuloBotao(b, e)
    const k = `bt${i}`
    icones.push(`<g class="bt ${k}"><rect x="${bx}" y="${y}" width="32" height="32" fill="transparent"/>${iconeBotao(d, b, bx, y, e, agora)}</g>`)
    if (comBaloes) {
      baloes.push(`<g class="bl ${k}">${balao(bx + 16, balaoAcima ? y : y + 32, balaoAcima, nome, desc, W)}</g>`)
    }
  })
  // os balões vêm depois dos ícones para ficarem por cima de tudo
  return icones.join('') + baloes.join('')
}

export const CSS_BOTOES =
  '.bt{cursor:pointer}.bt:hover use{filter:brightness(1.18)}.bl{visibility:hidden;pointer-events:none}' +
  ['bt', 'br'].flatMap(c => [0, 1, 2, 3].map(i => `.${c}${i}:hover~.bl.${c}${i}`)).join(',') +
  '{visibility:visible}'

const hora = (iso?: string) => {
  if (iso === undefined) {
    return ''
  }
  const dt = new Date(iso)
  return Number.isNaN(dt.getTime()) ? '' : `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

const VAO = 6
/** Vão entre a última barra e o primeiro botão. */
const VAO_BOTOES = 26
const BARRA_MIN = 112

type Arranjo = { botoes: 'hud' | 'cena' | 'nenhum'; larguraBarra: number; x0: number; seloX: number; passo?: number }

/** Onde começa a barra i (na grade, o passo pode ser fracionário: arredonda para o px). */
const xBarra = (a: Arranjo, i: number) => Math.round(a.x0 + i * (a.passo ?? a.larguraBarra + VAO))

function arranjar(v: Vista, larguraSelo: number): Arranjo {
  const a = arranjoLivre(v, larguraSelo)
  const c = v.celula
  if (c === undefined || c <= 0) {
    return a
  }
  // na grade: cada barra começa numa célula e o passo entre elas é um número
  // inteiro de células (a barra encolhe uns px para isso)
  const x0 = Math.round(Math.round(a.x0 / c) * c)
  const passo = Math.floor((a.larguraBarra + VAO) / c) * c
  return { ...a, x0, larguraBarra: Math.floor(passo - VAO), passo }
}

function arranjoLivre(v: Vista, larguraSelo: number): Arranjo {
  const x0 = 3 + larguraSelo + VAO
  const larguraCom = (livre: number) => Math.floor((livre - 3 * VAO) / 4)
  if (v.botoes === true) {
    const noHud = larguraCom(v.W - x0 - LARGURA_BOTOES - 4 - VAO_BOTOES)
    if (noHud >= BARRA_MIN) {
      return { botoes: 'hud', larguraBarra: Math.min(220, noHud), x0, seloX: 3 }
    }
    return { botoes: 'cena', larguraBarra: Math.min(220, larguraCom(v.W - x0 - 4)), x0, seloX: 3 }
  }
  return { botoes: 'nenhum', larguraBarra: Math.min(220, larguraCom(v.W - x0 - 4)), x0, seloX: 3 }
}

/** Um alvo de mouse no HUD (px de arte): barra, selo ou botão, com o texto do balão. */
export type Alvo = { id: string; x: number; y: number; w: number; h: number; titulo: string; explica: string }

function hud(d: Doc, v: Vista, y0: number): { svg: string; botoesNaCena: boolean; alvos: Alvo[] } {
  const { hud: h, agora } = v
  const l = luar(h, agora)
  const n = nivelDe(h.jogo.xp)
  const partes: string[] = [`<rect x="0" y="${y0}" width="${v.W}" height="${ALTURA_HUD}" fill="#1b1833"/>`]
  partes.push(`<rect x="0" y="${y0}" width="${v.W}" height="1" fill="#3a2f63"/>`)

  const valores: Trecho[] = []
  let luz: Barra
  if (!l.temLuz) {
    luz = { tipo: 'luz', frac: 0, nome: tx('barras.luz.nome'), valor: '—', titulo: tx('barras.luz.nome'), explica: tx('barras.luz.sem_luz') }
  } else if (l.desmaiada) {
    luz = { tipo: 'luz', frac: 0, nome: tx('barras.luz.nome'), valor: tx('barras.luz.lua_nova'), titulo: tx('barras.luz.titulo_lua_nova'), explica: tx('barras.luz.lua_nova_explica') }
  } else {
    const restS = l.restanteMs / 1000
    const mins = Math.ceil(restS / 60)
    for (let m = mins; m >= 1; m--) {
      valores.push([Math.max(0, restS - m * 60), restS - (m - 1) * 60, tx('barras.luz.minutos', { n: m })])
    }
    valores.push([restS, Infinity, tx('barras.luz.lua_nova')])
    luz = {
      tipo: 'luz',
      frac: l.frac,
      nome: tx('barras.luz.nome'),
      valor: '',
      titulo: tx('barras.luz.nome'),
      explica: tx('barras.luz.explica', { min: Math.round((h.luz?.ttlMs ?? 0) / 60000) }),
      esvaziaMs: l.restanteMs,
      valores,
    }
  }

  const m = h.mana
  const mana: Barra = {
    tipo: 'mana',
    frac: m.cinco === undefined ? 1 : (100 - m.cinco) / 100,
    nome: tx('barras.mana.nome'),
    valor: m.cinco === undefined ? '—' : `${Math.round(100 - m.cinco)}%`,
    titulo: tx('barras.mana.nome'),
    explica:
      m.cinco === undefined
        ? tx('barras.mana.sem_dado')
        : tx('barras.mana.explica', { livre: Math.round(100 - m.cinco) }) +
          (m.cincoRenova ? tx('barras.mana.renova', { hora: hora(m.cincoRenova) }) : '') +
          (m.sete !== undefined ? tx('barras.mana.sete_dias', { livre: Math.round(100 - m.sete) }) : ''),
  }

  const moch = h.mochila
  const cheia = moch !== null && moch > 80
  const mochila: Barra = {
    tipo: 'mochila',
    frac: (moch ?? 0) / 100,
    nome: cheia ? tx('barras.mochila.nome_cheia') : tx('barras.mochila.nome'), // a barra treme e o balão diz para arrumar
    valor: moch === null ? '0%' : `${Math.round(moch)}%`,
    titulo: tx('barras.mochila.nome'),
    explica: cheia
      ? tx('barras.mochila.cheia_explica', { pct: Math.round(moch) })
      : tx('barras.mochila.explica'),
    treme: cheia,
  }

  const xp: Barra = {
    tipo: 'xp',
    frac: n.dentro / n.precisa,
    nome: tx('barras.xp.nome'),
    valor: `${n.dentro}/${n.precisa}`,
    titulo: tx('barras.xp.titulo', { nivel: n.nivel }),
    explica: tx('barras.xp.explica', { faltam: n.precisa - n.dentro, proximo: n.nivel + 1, paginas: paginasNoCiclo(h.jogo.paginas) }) + `\n${sobreChefao(v.chefao, h.jogo.lutas)}`,
  }

  const sl = selo(d, 0, 0, n.nivel, v.estrela ?? 0.5)
  const a = arranjar(v, sl.largura)
  const by = y0 + Math.floor((ALTURA_HUD - 34) / 2)
  const barras = [luz, mana, mochila, xp]
  const alvos: Alvo[] = []
  barras.forEach((b, i) => {
    partes.push(barra(d, xBarra(a, i), by, a.larguraBarra, b, agora, i))
    // a área vai até o começo da próxima (na grade: 15 células inteiras)
    alvos.push({ id: `barra_${b.tipo}`, x: xBarra(a, i), y: by, w: (a.passo ?? a.larguraBarra + VAO) - 1, h: 34, titulo: b.titulo, explica: b.explica })
  })
  // o selo vem antes dos botões: os balões precisam ficar por cima de tudo
  partes.push(selo(d, a.seloX, y0 + ALTURA_HUD - 3, n.nivel, v.estrela ?? 0.5).svg)
  alvos.push({
    id: 'selo',
    x: a.seloX,
    y: y0,
    w: sl.largura,
    h: ALTURA_HUD - 4,
    titulo: tx('barras.selo.titulo', { nivel: n.nivel }),
    explica: tx('barras.selo.explica', { xp: h.jogo.xp, paginas: paginasNoCiclo(h.jogo.paginas), lutas: h.jogo.lutas }),
  })
  const yb = a.botoes === 'hud' ? y0 + Math.floor((ALTURA_HUD - 32) / 2) : 4
  if (a.botoes === 'hud') {
    partes.push(botoes(d, v.W - 4, yb, true, v.W, v.estadoBotoes, agora, v.semBaloes !== true))
  }
  if (a.botoes !== 'nenhum') {
    BOTOES.forEach((b, i) => {
      const [nome, desc] = rotuloBotao(b, v.estadoBotoes)
      alvos.push({ id: `botao_${b}`, x: v.W - 4 - LARGURA_BOTOES + i * PASSO_BOTAO, y: yb, w: 32, h: 32, titulo: nome, explica: desc })
    })
  }
  // balões das barras: por último, para ficarem por cima de tudo (até da cena)
  if (v.semBaloes !== true) {
    barras.forEach((b, i) => {
      const cx = xBarra(a, i) + a.larguraBarra / 2
      partes.push(`<g class="bl br${i}">${balao(cx, by, true, b.titulo, b.explica, v.W)}</g>`)
    })
  }
  return { svg: partes.join(''), botoesNaCena: a.botoes === 'cena', alvos }
}

/**
 * Um balão de fala sozinho, como SVG inteiro (pixel art, Pixelify nos textos):
 * para aparecer fora da cena, num Box do app que o hover revela.
 */
/** O balão solto (hover no app), desenhado no tamanho da tela: letra de 14 px e "pixels" de 2 px. */
const BT = { letra: 14, linha: 17, px: 2, pad: 10, ponta: 6, pxLetra: 7.6 }

/** Tamanho do balão solto: uma linha só enquanto couber em 80% da cena; depois quebra entre frases. */
export function medidaBalaoSolto(nome: string, desc: string, escala: number, larguraCena: number): { w: number; h: number; linhas: string[] } {
  const max = Math.max(16, Math.floor((larguraCena * escala * 0.8 - 2 * BT.pad) / BT.pxLetra))
  const linhas = linhasDoBalao(desc, max)
  const texto = Math.ceil(Math.max(nome.length, ...linhas.map(l => l.length)) * BT.pxLetra)
  const w = texto + 2 * BT.pad
  const corpo = 2 * BT.px + 6 + BT.linha * (1 + linhas.length) + 2
  return { w, h: corpo + BT.ponta, linhas }
}

/**
 * O balão solto como SVG inteiro, com a ponta em `pontaX` (px a partir da
 * esquerda do balão): a ponta aponta para o alvo de onde o balão sai.
 */
export function balaoSolto(nome: string, desc: string, escala: number, larguraCena: number, pontaX?: number): { svg: string; largura: number; altura: number } {
  const { w, h, linhas } = medidaBalaoSolto(nome, desc, escala, larguraCena)
  const p = BT.px
  const hc = h - BT.ponta // altura do corpo
  const borda = '#f2c14e'
  const fundo = '#2a2050'
  // corpo com os cantos "cortados" em pixel (2 px)
  let r =
    `<rect x="${p}" y="0" width="${w - 2 * p}" height="${hc}" fill="${borda}"/>` +
    `<rect x="0" y="${p}" width="${w}" height="${hc - 2 * p}" fill="${borda}"/>` +
    `<rect x="${p}" y="${p}" width="${w - 2 * p}" height="${hc - 2 * p}" fill="${fundo}"/>`
  // ponta de 3 degraus de 2 px, apontando para baixo, em pontaX
  const cx = Math.max(4 * p + 2, Math.min(w - 4 * p - 2, Math.round(pontaX ?? w / 2)))
  const x = cx - cx % p
  r +=
    `<rect x="${x - 3 * p}" y="${hc - p}" width="${6 * p}" height="${p}" fill="${fundo}"/>` +
    `<rect x="${x - 4 * p}" y="${hc - p}" width="${p}" height="${2 * p}" fill="${borda}"/><rect x="${x + 3 * p}" y="${hc - p}" width="${p}" height="${2 * p}" fill="${borda}"/>` +
    `<rect x="${x - 3 * p}" y="${hc}" width="${6 * p}" height="${p}" fill="${fundo}"/>` +
    `<rect x="${x - 3 * p}" y="${hc + p}" width="${p}" height="${p}" fill="${borda}"/><rect x="${x + 2 * p}" y="${hc + p}" width="${p}" height="${p}" fill="${borda}"/>` +
    `<rect x="${x - 2 * p}" y="${hc + p}" width="${4 * p}" height="${p}" fill="${fundo}"/>` +
    `<rect x="${x - 2 * p}" y="${hc + 2 * p}" width="${4 * p}" height="${p}" fill="${borda}"/>`
  const base = p + 4 + BT.linha - 3
  const estilo = `font-size:${BT.letra}px`
  r += `<text class="t n l" x="${BT.pad}" y="${base}" style="${estilo};fill:#ffe27a">${esc(nome)}</text>`
  linhas.forEach((l, i) => {
    r += `<text class="t n l" x="${BT.pad}" y="${base + BT.linha * (i + 1)}" style="${estilo}">${esc(l)}</text>`
  })
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">` +
    `<style>${CSS_TEXTO}${CSS_FONTE_LONGA}</style>${r}</svg>`
  return { svg, largura: w, altura: h }
}

// ---------------------------------------------------------------- lua nova

/** Aviso grande, em duas linhas, num painel no alto da cena quando o cache esfria. */
export const fraseLuaNova = (): string => tx('lua_nova.frase')

/** Aviso grande, em duas linhas, num painel sobre a cena quando o cache esfria. */
function avisoLuaNova(W: number, H: number, frase: string, noMeio: boolean): string {
  const l2 = tx('lua_nova.linha2')
  const emoji = 15 // largura do 🌙 a 15 px
  const vao = 8 // espaço entre a lua e a frase
  const w1 = Math.ceil(frase.length * 8.4) // Pixelify Sans a 15 px
  const linha1 = emoji + vao + w1
  const w = Math.min(W - 8, Math.max(linha1, Math.ceil(l2.length * 6.9)) + 28)
  const h = 44
  const x = Math.round((W - w) / 2)
  // no meio: centrado na altura da cena inteira, do topo até a borda de baixo
  const y = noMeio ? Math.round((H - h) / 2) : 8
  const borda = '#f2c14e'
  const fundo = '#2a2050'
  const x1 = Math.round(W / 2 - linha1 / 2)
  return (
    `<g><rect x="${x + 1}" y="${y}" width="${w - 2}" height="${h}" fill="${borda}"/>` +
    `<rect x="${x}" y="${y + 1}" width="${w}" height="${h - 2}" fill="${borda}"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="${fundo}" opacity="0.94"/>` +
    `<text x="${x1}" y="${y + 19}" style="font-size:14px">🌙</text>` +
    `<text class="t n l" x="${x1 + emoji + vao}" y="${y + 19}" style="font-size:15px;fill:#ffe27a">${esc(frase)}</text>` +
    `<text class="t m l" x="${W / 2}" y="${y + 35}" style="font-size:12px">${esc(l2)}</text></g>`
  )
}

// ---------------------------------------------------------------- tudo junto

/** A última frase do balão do XP: quando vem o próximo chefão, ou quando cai o que está em cena. */
function sobreChefao(c: Chefao | undefined, lutas: number): string {
  if (c === undefined || c.caiu !== undefined) {
    return tx('barras.xp.chefao_em', { n: chefaoEm(lutas) })
  }
  if (c.origem === 'lista') {
    const t = c.tarefas
    return tx('barras.xp.chefao_lista', { feitas: Math.min(t.feitas, t.total), total: t.total })
  }
  return tp('barras.xp.chefao_vida', c.vida)
}

/** Abertura, fase 1: a marca no meio do céu, aparecendo e sumindo; a noite fecha no fim. */
function marcaNoCeu(W: number, H: number, t: number): string {
  const x = Math.round((W - MARCA.w) / 2)
  const y = Math.round((H - MARCA.h) / 2)
  const f = ABERTURA.fase2
  const kt = (ms: number) => (ms / f).toFixed(3)
  const tempo = `dur="${seg(f)}" begin="${seg(-t)}" fill="freeze"`
  return (
    // o céu escurece um pouco para a marca saltar; no fim, a noite fecha de vez
    `<rect width="${W}" height="${H}" fill="${NOITE}" opacity="0.65"><animate attributeName="opacity" values="0.65;0.65;1" keyTimes="0;${kt(ABERTURA.sai)};1" ${tempo}/></rect>` +
    `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;${kt(ABERTURA.entra)};${kt(ABERTURA.sai)};${kt(f - 250)};1" ${tempo}/>` +
    `<g transform="translate(${x} ${y})">${MARCA.svg}</g></g>`
  )
}

export function montar(v: Vista): { svg: string; largura: number; altura: number; alvos: Alvo[] } {
  const d = new Doc()
  const H = alturaCena(v.modo)
  const dist = distancia(v.caminho, v.agora)
  const l = luar(v.hud, v.agora)
  const ab = faseAbertura(v)
  const corpo: string[] = []
  corpo.push(`<svg x="0" y="0" width="${v.W}" height="${H}" overflow="hidden">`)
  corpo.push(cenario(d, v, dist, ab?.fase === 1))
  if (ab?.fase === 1) {
    corpo.push(marcaNoCeu(v.W, H, ab.t))
  }
  const pes = 209 - JANELA[v.modo].topo
  const ch = v.chefao !== undefined && fimDoChefao(v.chefao) > v.agora ? v.chefao : undefined
  const palco = { W: v.W, H, pes, agora: v.agora }
  if (ch !== undefined && (v.tom ?? 'todo') === 'todo') {
    corpo.push(tingir(ch, v.W, H, 0.16))
  }
  const lt = ab === undefined && v.luta !== undefined && !l.desmaiada ? desenharLuta(d, v.luta, { W: v.W, pes: 209 - JANELA[v.modo].topo, agora: v.agora, caminho: v.caminho, ...(v.horizonte === undefined ? {} : { horizonte: v.horizonte }), ...(v.economia === undefined ? {} : { economia: v.economia }) }) : undefined
  if (lt !== undefined) {
    corpo.push(lt.monstro)
  } else if (ch !== undefined && !l.desmaiada) {
    corpo.push(chefaoEmCena(d, ch, palco))
  }
  if (ab?.fase !== 1) {
    corpo.push(lua(d, v, l.desmaiada, lt === undefined ? undefined : { corpo: lt.luaCorpo, trilha: lt.luaTrilha }))
  }
  if (ab?.fase === 2) {
    // a noite da fase 1 abre e mostra a floresta
    corpo.push(`<rect width="${v.W}" height="${H}" fill="${NOITE}" opacity="0"><animate attributeName="opacity" values="1;0" dur="${seg(ABERTURA.clareia)}" begin="${seg(-ab.t)}" fill="freeze"/></rect>`)
  }
  if (lt !== undefined) {
    corpo.push(lt.efeitos)
  }
  if (ch !== undefined && !l.desmaiada) {
    corpo.push(barraNoLugar(d, ch, palco))
    corpo.push(paginaRecuperada(d, ch, palco))
  }
  if (l.desmaiada) {
    corpo.push(`<rect width="${v.W}" height="${H}" fill="#140f2e" opacity="0.38"/>`)
    corpo.push(avisoLuaNova(v.W, H, v.fraseLuaNova ?? fraseLuaNova(), v.avisoNoMeio ?? true))
  }
  const hd = hud(d, v, H)
  if (hd.botoesNaCena) {
    corpo.push(botoes(d, v.W - 4, 4, false, v.W, v.estadoBotoes, v.agora, v.semBaloes !== true))
  }
  if (lt !== undefined && lt.tremor.length > 0) {
    // golpe crítico: a cena inteira treme (o HUD fica parado)
    const cena = corpo.splice(1).join('')
    corpo.push(d.pista(lt.tremor, v.agora, cena))
  }
  // assinatura do autor (pedido do usuário): discreta no canto de cima à
  // esquerda, fora do tremor; vai junto em todo print da faixa
  if (v.semAssinatura !== true) {
    corpo.push(`<use href="${d.img('assinatura')}" x="4" y="4" opacity="0.72"/>`)
  }
  corpo.push('</svg>')
  corpo.push(hd.svg)
  const Ht = H + ALTURA_HUD
  const s = v.escala
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${v.W * s}" height="${Ht * s}" viewBox="0 0 ${v.W} ${Ht}" preserveAspectRatio="xMinYMin slice" shape-rendering="crispEdges">` +
    `<style>svg,image,use{image-rendering:crisp-edges;image-rendering:pixelated}${ab?.fase === 1 ? MARCA.css : ''}${CSS_TEXTO}${v.textoLongo === true || l.desmaiada ? CSS_FONTE_LONGA : ''}${CSS_BOTOES}${d.css.join('')}</style>` +
    `<defs>${d.defs.join('')}</defs>` +
    corpo.join('') +
    `</svg>`
  return { svg, largura: v.W * s, altura: Ht * s, alvos: hd.alvos }
}


// ---------------------------------------------------------------- régua

/**
 * Régua para calibrar a largura da faixa no app: marcas a cada 10 px e números
 * a cada 100 px, em pixels da tela (sem escala). Quem olha diz até que número
 * aparece na borda direita; com isso e as colunas, sai o px por coluna.
 */
export function regua(colunas: number, pxColuna: number): string {
  const L = 3000
  const A = 44
  let marcas = ''
  for (let x = 0; x <= L; x += 10) {
    const alto = x % 100 === 0 ? 16 : x % 50 === 0 ? 10 : 6
    marcas += `<rect x="${x}" y="${A - alto}" width="1" height="${alto}" fill="#ffe27a"/>`
    if (x % 100 === 0 && x > 0) {
      marcas += `<text x="${x - 2}" y="${A - 18}" text-anchor="end" font-size="13" font-family="monospace" fill="#fff6d8">${x}</text>`
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}" viewBox="0 0 ${L} ${A}" preserveAspectRatio="xMinYMid slice">` +
    `<rect width="${L}" height="${A}" fill="#1b1833"/>${marcas}` +
    `<text x="6" y="14" font-size="13" font-family="monospace" fill="#9be7ff">colunas: ${colunas} · hoje ${pxColuna} px/coluna = ${Math.round(colunas * pxColuna)} px</text></svg>`
  )
}
