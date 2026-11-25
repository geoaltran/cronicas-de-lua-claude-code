// Monta a faixa do jogo como um SVG animado (CSS + SMIL), sem script.
// Toda a animação contínua (parallax, passos, respiração, contagem do luar)
// roda no próprio SVG; o mod só redesenha quando o estado muda. Cada
// animação usa um atraso negativo calculado do relógio, então um redesenho
// continua exatamente de onde a cena estava (sem pulo).
import { MARCA, META } from './arte'
import { cssFonteLonga, cssTexto, ehCJK, larguraCurta, larguraLonga, quebrarPorLargura } from './fontes'
import { ANDAR, Doc, P, PARADA, type Q, art, esc, mod, r, sorteio } from './base'
import type { Caminho, Chefao, Hud, Luta, Passagem } from '../types'
import { desenharLuta } from './luta'
import { t as tx, tp } from './t'
import { barraNoLugar, chefaoEm, chefaoEmCena, fimDoChefao, paginaRecuperada, paginasNoCiclo, proximoChefao, tingir } from './chefao'

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
  /** Sem a Pixelify embutida (último recurso do limite: o aviso de lua nova usa a fonte do sistema). */
  semFonteLonga?: boolean
  /** Bioma à força (testes e prévia); sem isso, o da página da jornada. */
  bioma?: string
  /** A passagem de fase em andamento (o chefão do bioma caiu). */
  passagem?: Passagem
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

/**
 * Passagem de fase (aprovada pelo usuário em 24/11/2026), em dois redesenhos:
 *   sai (0 até saida): no bioma velho, o cenário para; a Lua apressa o passo
 *     até passar da borda direita e a tela escurece;
 *   entra (saida até o fim): o bioma novo clareia, o cartão de título aparece
 *     e a Lua chega andando pela esquerda (como na abertura).
 */
export const PASSAGEM = {
  /** a Lua anda até a borda (ms): a velocidade sai da largura da faixa. */
  anda: 4000,
  /** a tela escurece nos últimos ms da saída (ela já está passando da borda). */
  escurece: 800,
  /** fim da saída: redesenho no bioma novo. */
  saida: 4300,
  /** o bioma novo clareia em (ms, contados da entrada). */
  clareia: 900,
  /** o título aparece e some (ms, contados da entrada). */
  tituloEntra: 500,
  tituloSai: 3600,
  /** fim da entrada (a Lua já chegou e o título sumiu). */
  entrada: 4000,
} as const
/** Fim da passagem (ms, contados da queda do chefão). */
export const FIM_PASSAGEM = PASSAGEM.saida + PASSAGEM.entrada

export type FasePassagem = { fase: 'sai' | 'entra'; t: number; p: Passagem }

/** Em que fase da passagem a cena está (t: ms desde o começo da fase), ou nada. */
export function fasePassagem(v: Pick<Vista, 'passagem' | 'agora'>): FasePassagem | undefined {
  const p = v.passagem
  if (p === undefined) {
    return undefined
  }
  const e = v.agora - p.at
  if (e < 0 || e >= FIM_PASSAGEM) {
    return undefined
  }
  return e < PASSAGEM.saida ? { fase: 'sai', t: e, p } : { fase: 'entra', t: e - PASSAGEM.saida, p }
}

/** O texto do cartão: "PÁGINA 6 · TORRE DO RELÓGIO" (no idioma do jogo). */
export function tituloDaPassagem(p: Passagem): string {
  return tx('chefao.passagem', { pagina: p.pagina, bioma: tx(`chefao.biomas.${p.para}`) }).toLocaleUpperCase()
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

// ---------------------------------------------------------------- biomas

/**
 * Partículas de cada bioma (no lugar dos vaga-lumes da floresta; aprovado em
 * 24/11/2026), feitas no código em pixels de 1 ou 2 px: `sobe` (brasas,
 * cristais), `cai` devagar balançando (poeira, pólen, poeira de estrela) ou
 * `pisca` no lugar (brilhos em cruz na água e no vidro). `y` é a faixa de
 * altura onde nascem (y da arte, como o chão em 209); `dur`, o ciclo (ms).
 */
type ParticulaBioma = {
  jeito: 'sobe' | 'cai' | 'pisca'
  cores: readonly string[]
  n: number
  y: readonly [number, number]
  dur: readonly [number, number]
  alt?: number
  /** Tamanhos sorteados: 1 ponto, 2 quadradinho, 3 cruz pequena, 4 cruz grande. */
  tamanhos: readonly number[]
  /** Sombra de 1 px (embaixo, à direita) para destacar num cenário da mesma cor. */
  sombra?: string
}
const PARTICULAS_BIOMA: Record<string, ParticulaBioma> = {
  ruinas: { jeito: 'sobe', cores: ['#c9a6ff', '#efe0ff', '#9c7bff'], n: 7, y: [160, 200], dur: [5000, 8000], alt: 50, tamanhos: [2, 2, 1] },
  mar: { jeito: 'pisca', cores: ['#ffffff', '#cfefff'], n: 9, y: [150, 188], dur: [2200, 4200], tamanhos: [1, 3, 3] },
  vulcao: { jeito: 'sobe', cores: ['#ffab40', '#ff7043', '#ffe082'], n: 13, y: [178, 205], dur: [2800, 4600], alt: 70, tamanhos: [2, 2, 2, 1] },
  // (ajustes do usuário, 25/11/2026: mais poeira e de tamanhos variados na Torre;
  // pétalas com contraste na Aurora; mais brilhos e maiores no Castelo; mais
  // estrelas e de tamanhos variados no Céu Estelar)
  torre: { jeito: 'cai', cores: ['#ffd27a', '#e0b060', '#fff0c0'], n: 12, y: [80, 140], dur: [7000, 10000], tamanhos: [1, 2, 2, 3] },
  aurora: { jeito: 'cai', cores: ['#ffffff', '#ff9eb5', '#fff3d6'], n: 10, y: [80, 140], dur: [6500, 9500], tamanhos: [2, 2, 3], sombra: '#8a5a2b' },
  castelo_vidro: { jeito: 'pisca', cores: ['#ffffff', '#b3e5fc', '#ffffff'], n: 16, y: [95, 200], dur: [2000, 4000], tamanhos: [1, 3, 3, 4], sombra: '#4a9fd4' },
  ceu_estelar: { jeito: 'cai', cores: ['#fff59d', '#e1d5ff', '#ffffff'], n: 16, y: [75, 150], dur: [6000, 9000], tamanhos: [1, 1, 2, 3, 4] },
  eclipse: { jeito: 'sobe', cores: ['#b388ff', '#ff8a65', '#ffcc80'], n: 8, y: [178, 205], dur: [3200, 5200], alt: 60, tamanhos: [2, 2, 1] },
}

/**
 * Estrelas cadentes (fase B) nos céus escuros: de vez em quando um risco
 * dourado cruza o alto da cena, descendo para a esquerda, e some. Parado na
 * tela (o céu não rola). Cada uma tem o seu ciclo; o resto do tempo, nada.
 */
function estrelasCadentes(d: Doc, W: number, agora: number, quantas: number, lua?: readonly [number, number, number, number]): string {
  const rnd = sorteio(29)
  let s = ''
  for (let i = 0; i < quantas; i++) {
    const dur = 7000 + Math.floor(rnd() * 6000)
    let x = 60 + Math.floor(rnd() * Math.max(40, W - 120))
    const y = 4 + Math.floor(rnd() * 22)
    // o risco vai de (x, y) até (x - 56, y + 28), com o rastro 10 px à direita:
    // se passar pela lua (com 4 px de folga), nasce do lado dela
    if (lua !== undefined) {
      const [lx0, ly0, lx1, ly1] = lua
      if (x + 10 >= lx0 - 4 && x - 56 <= lx1 + 4 && y + 28 >= ly0 - 4 && y - 4 <= ly1 + 4) {
        x = lx1 + 64 <= W - 10 ? lx1 + 64 : Math.max(60, lx0 - 18)
      }
    }
    const fase = Math.floor(rnd() * dur)
    const voa = 0.09 // fração do ciclo em que ela cruza (~0,6 a 1,2 s)
    // cabeça branca e o rastro subindo para a direita, cada vez mais apagado
    const rastro = [1, 0.8, 0.55, 0.35, 0.2]
      .map((o, j) => `<rect x="${x + j * 2}" y="${y - j}" width="2" height="1" fill="${j === 0 ? '#ffffff' : '#fff3c4'}" opacity="${o}"/>`)
      .join('')
    const k = d.anim(
      `0%{transform:translate(0px,0px);opacity:0}1%{opacity:1}${(voa * 100 * 0.7).toFixed(1)}%{opacity:1}${(voa * 100).toFixed(1)}%{transform:translate(-56px,28px);opacity:0}100%{transform:translate(-56px,28px);opacity:0}`,
      dur,
      'linear',
      -mod(agora + fase, dur),
      'infinite',
    )
    s += `<g class="${k}" opacity="0">${rastro}</g>`
  }
  return s
}

/**
 * A caixa da lua no fundo.png de cada bioma (x, y, largura, altura; do
 * `lua_ceu` dos cenario.json): as estrelas cadentes não passam por cima dela.
 */
const LUA_CEU: Record<string, readonly [number, number, number, number]> = {
  aurora: [461, 24, 38, 36],
  castelo_vidro: [455, 8, 50, 48],
  ceu_estelar: [453, 22, 56, 56],
  eclipse: [451, 18, 62, 64],
  mar: [437, 18, 88, 84],
  ruinas: [455, 18, 52, 52],
  torre: [347, 20, 38, 38],
  vulcao: [455, 26, 50, 48],
}

/**
 * A coroa do eclipse pulsando (fase B): dois anéis de luz em volta do anel da
 * lua, que acendem e apagam devagar, fora de compasso. Atrás do sprite da lua.
 */
function coroaDoEclipse(d: Doc, cx: number, cy: number, raio: number, agora: number): string {
  const anel = (rr: number, larg: number, cor: string, de: number, ate: number, ms: number, fase: number) => {
    const k = d.anim(`0%{opacity:${de}}50%{opacity:${ate}}100%{opacity:${de}}`, ms, 'ease-in-out', -mod(agora + fase, ms), 'infinite')
    return `<circle class="${k}" cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${cor}" stroke-width="${larg}" opacity="${de}"/>`
  }
  return anel(raio + 2, 2, '#ffd08a', 0.25, 0.75, 2600, 0) + anel(raio + 5, 2, '#ff9e57', 0.1, 0.45, 3400, 900)
}

/**
 * Vapor nas chaminés (fase B): o topo de cada chaminé no meio.png do bioma
 * (x, y; medidos pelos picos estreitos da silhueta). Cada uma solta baforadas
 * que sobem com o vento e somem; rolam junto com o meio.
 */
const CHAMINES: Record<string, readonly (readonly [number, number])[]> = {
  // 6 chaminés (usuário, 25/11/2026): as 3 da prévia (46,86), (331,139), (440,78)
  // e mais 3 que equilibram a outra metade; conferidas sobre o meio.png
  torre: [[47, 86], [331, 138], [440, 78], [516, 81], [625, 138], [910, 86]],
}

function vapor(d: Doc, nome: string, dy: number, agora: number, porChamine: number): string {
  const lista = CHAMINES[nome]
  if (lista === undefined || porChamine <= 0) {
    return ''
  }
  const ms = 2600
  const quadros = '0%{transform:translate(0px,0px);opacity:0}15%{opacity:0.7}55%{transform:translate(3px,-9px);opacity:0.5}100%{transform:translate(7px,-17px);opacity:0}'
  // (as chaminés se dividem em 3 turmas, cada turma com a sua fase: poucas
  // animações e o tufo escrito uma vez, com a cópia da volta num <use>)
  const TURMAS = 3
  let s = ''
  for (let j = 0; j < porChamine; j++) {
    for (let g = 0; g < TURMAS; g++) {
      let tufos = ''
      lista.forEach(([cx, top], i) => {
        if (i % TURMAS === g) {
          const y = top + dy - 3
          // um tufo de 4 x 4 com os cantos cortados, cinza-azulado
          tufos += `<path d="M${cx - 1} ${y - 2}h2v1h1v2h-1v1h-2v-1h-1v-2h1z"/>`
        }
      })
      if (tufos === '') {
        continue
      }
      const id = d.id('vp')
      const k = d.anim(quadros, ms, 'steps(17)', -mod(agora + (g * ms) / TURMAS / porChamine + (j * ms) / porChamine, ms), 'infinite')
      // os dois tons da fumaça da prévia (199,207,234) e (143,162,192), uma turma de cada
      s += `<g class="${k}" opacity="0" fill="${g % 2 === 0 ? '#c7cfea' : '#8fa2c0'}"><g id="${id}">${tufos}</g><use href="#${id}" x="${P}"/></g>`
    }
  }
  return s
}

/**
 * Halo do sol pulsando (fase B, como na prévia do cenario_bioma.py, "sol_brilho"):
 * centro (x no fundo.png largo, y da arte) e raio do disco. Três anéis de luz
 * por cima do sol, cada um no seu ritmo.
 */
const SOL: Record<string, readonly [number, number, number]> = {
  // (382, 140, 38) na arte de 479 px + a margem do fundo largo (241)
  aurora: [623, 140, 38],
}

function haloDoSol(d: Doc, nome: string, x0: number, topo: number, agora: number): string {
  const sol = SOL[nome]
  if (sol === undefined) {
    return ''
  }
  const [sx, sy, sr] = sol
  const cx = sx - x0
  const cy = sy - topo
  return (
    // (mais forte que na prévia: no app, no céu amarelo, a luz fraca sumia; usuário, 25/11/2026)
    [[24, 0.22, 4200], [15, 0.3, 5300], [7, 0.4, 6100]] as const
  )
    .map(([dr, a, ms], i) => {
      const k = d.anim(`0%{opacity:${(a * 0.25).toFixed(3)}}50%{opacity:${a.toFixed(3)}}100%{opacity:${(a * 0.25).toFixed(3)}}`, ms, 'ease-in-out', -mod(agora + i * 1400, ms), 'infinite')
      return `<circle class="${k}" cx="${cx}" cy="${cy}" r="${sr + dr}" fill="#fffbe6" opacity="${a}"/>`
    })
    .join('')
}

/**
 * A lanterna de cada ilha flutuante com halo pulsando (fase B, prévia
 * "lanternas_ilhas"): onde ela fica no sprite da ilha (os pixels da cor
 * 249,222,171). O halo vai dentro do balanço da ilha.
 */
const LANTERNAS: Record<string, readonly (readonly [number, number])[]> = {
  torre: [[62, 11], [61, 11]],
}

function haloDaLanterna(d: Doc, x: number, y: number, k: number, agora: number): string {
  const ms = 3300
  // (mais forte que na prévia: luz fraca some na faixa do app)
  const c = d.anim('0%{opacity:0.3}50%{opacity:1}100%{opacity:0.3}', ms, 'ease-in-out', -mod(agora + k * 1100, ms), 'infinite')
  return `<g class="${c}">${([[9, 0.16], [6, 0.26], [4, 0.4]] as const).map(([rr, a]) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="#ffd68c" opacity="${a}"/>`).join('')}</g>`
}

/**
 * Reflexo correndo no vidro (fase B, prévia "vidro_brilho" do Castelo): uma
 * faixa de luz diagonal atravessa o vidro de cada espelho, cada um no seu
 * tempo, recortada pelo retângulo do vidro. Caixas no
 * meio.png (x0, y0, x1, y1) já com o `descer_cena` (12); a outra metade do meio
 * é espelhada (x -> 957 - x). Rola com o meio.
 */
const VIDRO: Record<string, readonly (readonly [number, number, number, number])[]> = {
  // só o vidro dos 4 espelhos (usuário, 25/11/2026: nada na moldura, nas colunas
  // nem nos cristais); medido pela cor azul-clara do vidro, 1 px dentro da moldura
  castelo_vidro: [[76, 153, 92, 193], [116, 150, 133, 193], [312, 156, 329, 192], [382, 153, 399, 193]],
}

function reflexoNoVidro(d: Doc, nome: string, topo: number, agora: number): string {
  const lista = VIDRO[nome]
  if (lista === undefined) {
    return ''
  }
  const ms = 5300
  const rnd = sorteio(11)
  let s = ''
  const caixas = lista.flatMap(([x0, y0, x1, y1]) => [[x0, y0, x1, y1], [957 - x1, y0, 957 - x0, y1]] as const)
  for (const [x0, y0a, x1, y1a] of caixas) {
    const y0 = y0a - topo
    const y1 = y1a - topo
    const h = y1 - y0
    const anda = x1 - x0 + h / 2 + 12
    const id = d.id('vd')
    const cp = d.id('vc')
    // a faixa: miolo claro (3 px) e borda mais fraca (7 px), inclinada como na prévia
    // (usuário, 25/11/2026: a 90% ficou forte demais; miolo 55%, borda 28%)
    const faixa = (larg: number, op: number) =>
      `<polygon points="${x0 - 6 - larg / 2},${y1} ${x0 - 6 + larg / 2},${y1} ${x0 - 6 + larg / 2 - h / 2},${y0} ${x0 - 6 - larg / 2 - h / 2},${y0}" fill="#ffffff" opacity="${op}"/>`
    // passa em 30% do ciclo; no resto, parada fora da peça
    const k = d.anim(`0%{transform:translateX(0px)}30%{transform:translateX(${r(anda)}px)}100%{transform:translateX(${r(anda)}px)}`, ms, 'linear', -mod(agora + rnd() * ms, ms), 'infinite')
    s +=
      `<clipPath id="${cp}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${h}"/></clipPath>` +
      `<g id="${id}" clip-path="url(#${cp})"><g class="${k}">${faixa(7, 0.28)}${faixa(3, 0.55)}</g></g><use href="#${id}" x="${P}"/>`
  }
  return s
}

/**
 * Mar (fase B): o reflexo da lua tremendo mais vivo. Tracinhos claros de 1 px
 * de altura acendem e apagam depressa dentro da coluna do reflexo (larga no
 * horizonte, estreita embaixo). Parado na tela, entre o longe e o meio (as
 * pedras e os barcos passam na frente). `cx`, `y0`, `y1` já na tela.
 */
function brilhosDoReflexo(d: Doc, cx: number, y0: number, y1: number, agora: number, quantos: number): string {
  const rnd = sorteio(29)
  let s = ''
  for (let i = 0; i < quantos; i++) {
    const f = rnd()
    const y = Math.floor(y0 + f * (y1 - y0 - 1))
    const meia = 38 - f * 26
    const w = Math.max(2, Math.round((6 - f * 4) * (0.6 + rnd() * 0.6)))
    const x = Math.round(cx + (rnd() * 2 - 1) * meia - w / 2)
    const ms = 700 + Math.floor(rnd() * 900)
    // poucos desenhos de animação, reaproveitados (cada regra nova pesa no teto da faixa)
    const liga = [12, 34, 56][Math.floor(rnd() * 3)] ?? 12
    const dura = [20, 30][i % 2] ?? 20
    const cor = i % 3 === 0 ? '#fffbe6' : '#f3e9b8'
    const k = d.anim(`0%{opacity:0}${liga}%{opacity:1}${liga + dura}%{opacity:0}100%{opacity:0}`, ms, 'step-end', -mod(agora + rnd() * ms, ms), 'infinite')
    s += `<rect class='${k}' x='${x}' y='${y}' width='${w}' height='1' fill='${cor}'/>`
  }
  return s
}

/**
 * Mar (fase B): cristas das ondas subindo e descendo. Uma cópia só da espuma
 * clara do próprio meio (filtro que deixa passar os pixels claros) sobe 1–2 px
 * e volta, cada onda no seu tempo. Caixas no meio.png (x0, y0, x1, y1), com
 * folga de 3 px em cima; a outra metade do meio é espelhada (x -> 957 - x).
 * `meio` é o conteúdo da camada (uma volta, 0..958). Rola com o meio.
 */
const CRISTAS: Record<string, readonly (readonly [number, number, number, number])[]> = {
  mar: [[30, 140, 96, 166], [165, 168, 228, 183], [236, 158, 296, 183], [338, 157, 412, 177], [425, 168, 479, 187]],
}

/**
 * A metade esquerda (0..479) desenhada uma vez, a direita espelhada com um
 * <use> (como o próprio meio), e as duas de novo em +958 (a camada dá a volta).
 * Os dois lados ficam no mesmo compasso; quase nunca estão os dois na tela.
 */
function metadeEspelhada(d: Doc, metade: string): string {
  const me = d.id('mh')
  const a = d.id('ma')
  return `<g id='${a}'><g id='${me}'>${metade}</g><use href='#${me}' transform='translate(${P},0) scale(-1,1)'/></g><use href='#${a}' x='${P}'/>`
}

function cristasDasOndas(d: Doc, nome: string, meio: string, topo: number, agora: number): string {
  const lista = CRISTAS[nome]
  if (lista === undefined) {
    return ''
  }
  const fl = d.id('ef')
  const mid = d.id('em')
  // alfa = só os pixels claros (média acima de ~0,62), nas cores da arte (clareada, a espuma toda ficava branca demais)
  d.defs.push(
    `<filter id='${fl}' x='0' y='0' width='1' height='1' color-interpolation-filters='sRGB'><feColorMatrix type='matrix' values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 10 10 10 0 -18.6'/></filter>` +
      `<g id='${mid}' filter='url(#${fl})'>${meio}</g>`,
  )
  const rnd = sorteio(31)
  let s = ''
  for (const [x0, y0, x1, y1] of lista) {
    const cp = d.id('cc')
    const ms = 1500 + Math.floor(rnd() * 900)
    const k = d.anim('0%{transform:translateY(0px)}25%{transform:translateY(-1px)}50%{transform:translateY(-2px)}75%{transform:translateY(-1px)}100%{transform:translateY(0px)}', ms, 'step-end', -mod(agora + rnd() * ms, ms), 'infinite')
    s += `<clipPath id='${cp}'><rect x='${x0}' y='${y0 - topo}' width='${x1 - x0}' height='${y1 - y0}'/></clipPath><g clip-path='url(#${cp})'><use href='#${mid}' class='${k}'/></g>`
  }
  return metadeEspelhada(d, s)
}

/**
 * Mar (fase B): espuma batendo nas pedras e nos naufrágios. De tempos em
 * tempos sobe um respingo (gotinhas brancas e azul-claras num arco, com um
 * clarão na base) e cai de volta. Pontos no meio.png (x, y, lado: -1 esquerda,
 * 1 direita); a outra metade é espelhada. Rola com o meio.
 */
const ESPUMA: Record<string, readonly (readonly [number, number, number])[]> = {
  mar: [[103, 168, -1], [131, 176, 1], [298, 160, -1], [341, 161, 1], [374, 169, -1], [426, 178, 1]],
}

/** As gotinhas de um respingo: [para o lado, para cima] (lado da pedra = +). */
const GOTAS: readonly (readonly [number, number])[] = [[2, 9], [4, 6], [-1, 7], [5, 4]]

function espumaNasPedras(d: Doc, nome: string, topo: number, agora: number): string {
  const lista = ESPUMA[nome]
  if (lista === undefined) {
    return ''
  }
  const rnd = sorteio(37)
  let s = ''
  for (const [px, py, lado] of lista) {
    const ms = 2200 + Math.floor(rnd() * 1600)
    const atraso = -mod(agora + rnd() * ms, ms)
    const y = py - topo - 1
    // clarão na base: acende no começo do respingo
    const kc = d.anim('0%{opacity:0.95}8%{opacity:0.7}16%{opacity:0}100%{opacity:0}', ms, 'step-end', atraso, 'infinite')
    s += `<rect class='${kc}' x='${px - 2}' y='${y}' width='5' height='2' fill='#eef8ff'/>`
    GOTAS.forEach(([vai0, sobe], i) => {
      const vai = vai0 * lado
      // arco em passos: sobe rápido, para no alto, cai e some (só ~30% do ciclo); o
      // desenho de cada gota é o mesmo em todas as pedras (só o atraso muda)
      const p = (a: number, b: number) => `transform:translate(${r(a)}px,${r(b)}px)`
      const kq = d.anim(
        `0%{${p(0, 0)};opacity:1}6%{${p(vai * 0.4, -sobe * 0.7)}}12%{${p(vai * 0.7, -sobe)}}18%{${p(vai * 0.9, -sobe * 0.8)}}` +
          `24%{${p(vai, -sobe * 0.35)};opacity:1}30%{${p(vai * 1.1, 1)};opacity:0}100%{${p(0, 0)};opacity:0}`,
        ms,
        'step-end',
        atraso,
        'infinite',
      )
      s += `<rect class='${kq}' x='${px}' y='${y}' width='${i === 0 ? 2 : 1}' height='1' fill='${i % 2 === 0 ? '#fff' : '#bfe3f7'}'/>`
    })
  }
  return metadeEspelhada(d, s)
}

/**
 * Mar (fase B, prévia `facho` com `farol_giro`): a luz do farol girando. Uma
 * volta a cada 18 s: o facho deitado cresce para um lado, encolhe, some atrás
 * da torre e cresce para o outro; a ponta some em 5 degraus; a lâmpada acende
 * mais quando a luz aponta para nós. Amarelo-quente (`facho_cor`,
 * `lampada_cor`, escolha do usuário), mais forte que na prévia (no app a luz
 * fraca some). `lx`, `ly`: a lâmpada, já na tela.
 */
const FAROL: Record<string, readonly [number, number]> = {
  mar: [9, 3], // a lâmpada no marco.png (os dois pixels acesos)
}

function luzDoFarol(d: Doc, lx: number, ly: number, agora: number): string {
  const ms = 18000
  const n = 36
  let giro = ''
  let lamp2 = ''
  let lamp3 = ''
  for (let i = 0; i <= n; i++) {
    const ang = (i / n) * 2 * Math.PI
    const lado = Math.cos(ang)
    const frente = Math.sin(ang)
    const ve = frente > -0.2 && 46 * Math.abs(lado) > 3
    const sx = Math.abs(lado) < 0.07 ? (lado < 0 ? -0.07 : 0.07) : lado
    const sy = (3 + 5 * Math.abs(lado)) / 8
    const op = ve ? (70 + 50 * Math.max(frente, 0)) / 120 : 0
    const pc = ((i / n) * 100).toFixed(2)
    giro += `${pc}%{transform:scale(${sx.toFixed(3)},${sy.toFixed(3)});opacity:${op.toFixed(2)}}`
    lamp2 += `${pc}%{opacity:${frente > 0 ? 1 : 0}}`
    lamp3 += `${pc}%{opacity:${frente > 0.7 ? 1 : 0}}`
  }
  const atraso = -mod(agora, ms)
  const kg = d.anim(giro, ms, 'linear', atraso, 'infinite')
  const k2 = d.anim(lamp2, ms, 'step-end', atraso, 'infinite')
  const k3 = d.anim(lamp3, ms, 'step-end', atraso, 'infinite')
  // a ponta some aos poucos: degraus de transparência pela distância à lâmpada
  const gr = d.id('fg')
  const degraus: [number, number][] = [[0.15, 1], [0.35, 0.8], [0.55, 0.6], [0.75, 0.4], [0.95, 0.2]]
  let stops = ''
  let de = 0
  for (const [ate, o] of degraus) {
    stops += `<stop offset='${de}' stop-color='#fff' stop-opacity='${o}'/><stop offset='${ate}' stop-color='#fff' stop-opacity='${o}'/>`
    de = ate
  }
  stops += `<stop offset='${de}' stop-color='#fff' stop-opacity='0'/>`
  const mk = d.id('fm')
  d.defs.push(
    `<linearGradient id='${gr}' gradientUnits='userSpaceOnUse' x1='0' y1='0' x2='46' y2='0'>${stops}</linearGradient>` +
      `<mask id='${mk}' maskUnits='userSpaceOnUse' x='-1' y='-9' width='48' height='18'><rect x='-1' y='-9' width='48' height='18' fill='url(#${gr})'/></mask>`,
  )
  // facho: por fora 60% e o miolo 85% de frente (na prévia 47% e 67%)
  const facho =
    `<g mask='url(#${mk})' shape-rendering='crispEdges'>` +
    `<polygon points='0,-1 46,-8 46,8 0,1' fill='#ffcd5f' opacity='0.6'/>` +
    `<polygon points='0,0 23,-2.8 23,2.8' fill='#ffe48c' opacity='0.85'/></g>`
  // lâmpada: 3x3 sempre; um disco de pixel maior quando a luz vem para a frente
  const q = (a: number, b: number, w: number, hh: number) => `<rect x='${lx + a}' y='${ly + b}' width='${w}' height='${hh}' fill='#ffeca0'/>`
  const lampada =
    `<g opacity='0.95'>${q(-1, -1, 3, 3)}<g class='${k2}'>${q(-2, -1, 5, 3)}${q(-1, -2, 3, 5)}</g>` +
    `<g opacity='0.7'><g class='${k3}'>${q(-3, -1, 7, 3)}${q(-1, -3, 3, 7)}${q(-2, -2, 5, 5)}</g></g></g>`
  return `<g transform='translate(${lx},${ly})'><g class='${kg}'>${facho}</g></g>${lampada}`
}

/** Uma partícula em pixel: ponto, quadradinho, cruz pequena ou cruz grande (com o miolo cheio). */
function formaParticula(x: number, y: number, tam: number, cor: string): string {
  const q = (a: number, b: number, w: number, h: number) => `<rect x="${a}" y="${b}" width="${w}" height="${h}" fill="${cor}"/>`
  if (tam <= 1) {
    return q(x, y, 1, 1)
  }
  if (tam === 2) {
    return q(x, y, 2, 2)
  }
  if (tam === 3) {
    return q(x, y - 1, 1, 3) + q(x - 1, y, 3, 1)
  }
  return q(x, y - 2, 1, 5) + q(x - 2, y, 5, 1) + q(x - 1, y - 1, 3, 3)
}

/**
 * As partículas do bioma em [0, 958) e a cópia seguinte (a camada dá a volta),
 * para rolar junto com o meio. `quantas`: menos na luta, nenhuma na economia.
 */
function particulasDoBioma(d: Doc, nome: string, topo: number, agora: number, quantas: number): string {
  const pb = PARTICULAS_BIOMA[nome]
  if (pb === undefined || quantas <= 0) {
    return ''
  }
  const rnd = sorteio(17 + nome.length)
  let s = ''
  for (let i = 0; i < quantas; i++) {
    const x = Math.floor(rnd() * P)
    const y = pb.y[0] + Math.floor(rnd() * (pb.y[1] - pb.y[0])) - topo
    const dur = pb.dur[0] + Math.floor(rnd() * (pb.dur[1] - pb.dur[0]))
    const fase = Math.floor(rnd() * dur)
    const cor = pb.cores[i % pb.cores.length] ?? '#ffffff'
    const tam = pb.tamanhos[Math.floor(rnd() * pb.tamanhos.length)] ?? 2
    const forma = (pb.sombra === undefined ? '' : formaParticula(x + 1, y + 1, tam, pb.sombra)) + formaParticula(x, y, tam, cor)
    let quadros: string
    let passos: number
    let corpo: string
    if (pb.jeito === 'pisca') {
      // um brilho que acende de vez em quando
      const liga = 55 + Math.floor(rnd() * 20)
      quadros = `0%{opacity:0}${liga}%{opacity:1}${liga + 6}%{opacity:0.6}${liga + 12}%{opacity:0}100%{opacity:0}`
      passos = 1
      corpo = forma
    } else {
      const sobe = pb.jeito === 'sobe'
      const alt = sobe ? (pb.alt ?? 50) + Math.floor(rnd() * 20) : 209 - 14 - y - topo
      const dy = sobe ? -alt : alt
      const b1 = Math.floor(rnd() * 7) - 3
      const b2 = Math.floor(rnd() * 9) - 4
      quadros =
        `0%{transform:translate(0px,0px);opacity:0}12%{opacity:1}` +
        `33%{transform:translate(${b1}px,${r(dy / 3)}px)}66%{transform:translate(${b2}px,${r((2 * dy) / 3)}px)}` +
        `85%{opacity:1}100%{transform:translate(${b1 + b2}px,${dy}px);opacity:0}`
      passos = Math.max(6, r(Math.abs(dy) / 3))
      corpo = forma
    }
    const k = d.anim(quadros, dur, `steps(${passos})`, -mod(agora + fase, dur), 'infinite')
    s += `<g class="${k}">${corpo}<g transform="translate(${P} 0)">${corpo}</g></g>`
  }
  return s
}

type CamadaBioma = { oy: number; desce: number; repete: 'espelho' | 'repete' | 'inteira'; vel: number; remendos: number; vento?: number }
type IlhaBioma = { x: number; y: number }
export type Bioma = {
  desce: number
  fundo_oy: number
  /** Laterais do fundo largo: [x no fundo, x no centro, largura, espelhada]. */
  fundo_tiras: readonly (readonly [number, number, number, boolean])[]
  fundo_sobras: number
  /** Céu escuro no alto da faixa (o nome do chefão vai claro). */
  ceu_escuro: boolean
  camadas: Partial<Record<'nuvens' | 'longe' | 'meio' | 'chao', CamadaBioma>>
  ilhas: readonly IlhaBioma[]
  ilhas_vel: number
  balanco: number
  ilhas_na_frente: boolean
  estrelas: readonly (readonly [number, number, number, number])[]
  estrela_cor: string
  marco?: { x: number; y_tela: number }
  lua?: { x: number; y_tela: number; eclipse?: { centro: readonly [number, number]; raio_anel: number } }
  reflexo?: { x: number; y: number; n: number; ms: number }
  torre?: { x: number; y: number }
  relogio?: { centro: readonly [number, number]; minuto: number; hora: number; cor: readonly [number, number, number] }
}
const BIOMAS = (META as unknown as { biomas: { biomas: Record<string, Bioma>; do_chefao: Record<string, string> } }).biomas

/**
 * O bioma da cena: o do chefão em cena; sem chefão, o da página da jornada
 * (o próximo chefão). Vespera e Dama Penumbra ficam na floresta.
 */
export function biomaDe(v: Pick<Vista, 'bioma' | 'chefao' | 'agora' | 'hud'>): string {
  if (v.bioma !== undefined) {
    return v.bioma in BIOMAS.biomas ? v.bioma : 'floresta'
  }
  const nome = v.chefao !== undefined && fimDoChefao(v.chefao) > v.agora ? v.chefao.nome : proximoChefao(v.hud.jogo.paginas).nome
  return BIOMAS.do_chefao[nome] ?? 'floresta'
}

/** O bioma de uma página da jornada (0 = a primeira, Vespera). */
export function biomaDaPagina(i: number): string {
  return BIOMAS.do_chefao[proximoChefao(i).nome] ?? 'floresta'
}

/** Se o alto da cena é escuro (noite): textos por cima dele vão claros. */
export function ceuEscuro(bioma: string): boolean {
  return BIOMAS.biomas[bioma]?.ceu_escuro ?? false
}

/** Uma camada que dá a volta (958 px): meia largura + a outra metade espelhada ou repetida, e os remendos. */
function camadaBioma(d: Doc, nome: string, c: CamadaBioma, y: number, copias: number): string {
  const u = d.img(nome)
  const rem: string[] = []
  for (let j = 0; j < c.remendos; j++) {
    const a = art(`${nome}_r${j}`)
    rem.push(`<use href="${d.img(`${nome}_r${j}`)}" x="${a['x'] as number}" y="${y + (a['y'] as number)}"/>`)
  }
  let s = ''
  for (let k = 0; k < copias; k++) {
    const dx = k * P
    if (c.repete === 'inteira') {
      s += `<use href="${u}" x="${dx}" y="${y}"/>`
    } else if (c.repete === 'repete') {
      s += `<use href="${u}" x="${dx}" y="${y}"/><use href="${u}" x="${dx + P / 2}" y="${y}"/>`
    } else {
      s += `<use href="${u}" x="${dx}" y="${y}"/><use href="${u}" transform="translate(${dx + P},0) scale(-1,1)" y="${y}"/>`
    }
    if (rem.length > 0) {
      s += `<g transform="translate(${dx},0)">${rem.join('')}</g>`
    }
  }
  return s
}

const COR_ESTRELA: Record<string, string> = { azul: 'p_estrela_azul', vermelha: 'p_estrela_vermelha' }

function cenarioBioma(d: Doc, v: Vista, dist: number, soCeu: boolean, nome: string): string {
  const b = BIOMAS.biomas[nome] as Bioma
  const pre = `b_${nome}_`
  const { W, agora } = v
  const topo = JANELA.compacto.topo
  const fT = topo - b.desce // linha do fundo no alto da faixa
  const x0 = Math.floor(480 - W / 2)
  const t = agora / 1000
  const andando = andandoAgora(v.caminho, agora)
  const para = andando && v.caminho.ate !== undefined ? v.caminho.ate - agora : undefined
  const rolo = (conteudo: string, vel: number, base = x0 - PAD) => d.rolo(conteudo, base + dist * vel, andando ? VEL * vel : 0, para)
  const partes: string[] = []

  // 1. fundo parado (céu, lua, o que fica longe de verdade): o centro e, dos
  // lados, tiras do próprio centro (o vai-e-volta do fundo largo)
  partes.push(fundoBioma(d, b, pre, x0, W, b.fundo_oy - fT))
  partes.push(haloDoSol(d, nome, x0, topo, agora))
  if (b.lua !== undefined) {
    const ec = b.lua.eclipse
    if (ec !== undefined) {
      partes.push(coroaDoEclipse(d, b.lua.x - x0 + ec.centro[0], b.lua.y_tela - topo + ec.centro[1], ec.raio_anel, agora))
    }
    partes.push(`<use href="${d.img(pre + 'lua')}" x="${b.lua.x - x0}" y="${b.lua.y_tela - topo}"/>`)
  }
  // estrelas cintilando, só no céu limpo (posições do cenario_bioma.py)
  for (const [sx, sy, fase, cor] of b.estrelas) {
    const x = sx - x0
    if (x < -8 || x > W) {
      continue
    }
    const ms = 220
    const seq: Q[] = [[0, ms], [1, ms], [2, ms], [3, ms], [-1, ms * 4]]
    const tira = cor === 1 ? COR_ESTRELA[b.estrela_cor] ?? 'p_estrela_azul' : 'p_estrela'
    partes.push(d.tira(tira, x, sy, 7, 7, seq, agora + fase * 440))
  }
  // estrelas cadentes nos céus escuros (menos na luta, nenhuma na economia)
  if (b.ceu_escuro && v.economia !== true) {
    const lc = LUA_CEU[nome]
    const caixa = lc === undefined ? undefined : ([lc[0] - x0, lc[1] - fT, lc[0] + lc[2] - x0, lc[1] + lc[3] - fT] as const)
    partes.push(estrelasCadentes(d, W, agora, v.luta !== undefined ? 1 : 2, caixa))
  }
  // marco: parado, de pé no horizonte (farol, vulcão)
  if (b.marco !== undefined) {
    partes.push(`<use href="${d.img(pre + 'marco')}" x="${b.marco.x - x0}" y="${b.marco.y_tela - topo}"/>`)
    // luz girando no farol (antes das ilhas: elas passam na frente do facho)
    const lp = FAROL[nome]
    if (lp !== undefined && v.economia !== true) {
      partes.push(luzDoFarol(d, b.marco.x - x0 + lp[0], b.marco.y_tela - topo + lp[1], agora))
    }
  }
  // 2. nuvens: parallax lento + vento (cada bioma desce as nuvens do seu jeito)
  const nv = b.camadas.nuvens
  if (nv !== undefined) {
    const yN = nv.oy - (topo - nv.desce)
    const caminhada = rolo(camadaBioma(d, pre + 'nuvens', nv, yN, 3), nv.vel)
    partes.push(d.rolo(caminhada, t * (nv.vento ?? 2), nv.vento ?? 2))
  }
  // a torre do relógio passa na frente das nuvens
  if (b.torre !== undefined) {
    partes.push(`<use href="${d.img(pre + 'torre')}" x="${b.torre.x - x0}" y="${b.torre.y - fT}"/>`)
  }
  if (b.relogio !== undefined) {
    partes.push(ponteiros(d, b.relogio, b.relogio.centro[0] - x0, b.relogio.centro[1] - fT, agora))
  }
  // 3. ilhas flutuantes: parallax + balanço
  let ilhas = ''
  b.ilhas.forEach((ilha, k) => {
    const base = mod(ilha.x - x0, P)
    const u = d.img(`${pre}ilha_${k + 1}`)
    const lt = LANTERNAS[nome]?.[k]
    for (const dx of [0, P]) {
      const halo = lt === undefined || v.economia === true ? '' : haloDaLanterna(d, base + dx + lt[0], ilha.y - fT + lt[1], k, agora)
      ilhas += d.balanco(`<use href="${u}" x="${base + dx}" y="${ilha.y - fT}"/>${halo}`, b.balanco, 3100, k * 1400, agora)
    }
  })
  const camIlhas = d.rolo(ilhas, dist * b.ilhas_vel, andando ? VEL * b.ilhas_vel : 0, para)
  if (!b.ilhas_na_frente) {
    partes.push(camIlhas)
  }
  if (soCeu) {
    return partes.join('')
  }
  // 4. longe (campo, mar, planície da placa)
  const lg = b.camadas.longe
  if (lg !== undefined) {
    partes.push(rolo(camadaBioma(d, pre + 'longe', lg, lg.oy - topo, 2), lg.vel))
  }
  if (b.ilhas_na_frente) {
    partes.push(camIlhas)
  }
  // reflexo da lua no mar: parado sob a lua, entre o longe e o meio; os quadros se alternam
  if (b.reflexo !== undefined) {
    const rf = b.reflexo
    for (let j = 0; j < rf.n; j++) {
      const de = (j / rf.n) * 100
      const ate = ((j + 1) / rf.n) * 100
      const k = d.anim(`0%{opacity:0}${de.toFixed(2)}%{opacity:1}${ate.toFixed(2)}%{opacity:0}100%{opacity:0}`, rf.ms * rf.n, 'step-end', -mod(agora, rf.ms * rf.n), 'infinite')
      partes.push(`<g class="${k}"><use href="${d.img(`${pre}reflexo_${j}`)}" x="${rf.x + PAD - x0}" y="${rf.y - topo}"/></g>`)
    }
    // brilhos tremendo no reflexo (menos na luta, nenhum na economia)
    if (v.economia !== true) {
      const a0 = art(`${pre}reflexo_0`)
      partes.push(brilhosDoReflexo(d, rf.x + PAD - x0 + (a0.w as number) / 2, rf.y - topo, rf.y - topo + (a0.h as number), agora, v.luta !== undefined ? 8 : 14))
    }
  }
  // 5. meio
  const md = b.camadas.meio
  if (md !== undefined) {
    partes.push(rolo(camadaBioma(d, pre + 'meio', md, md.oy - topo, 2), md.vel))
    // Mar: cristas das ondas subindo e espuma batendo nas pedras (rolam com o meio; nada na economia)
    if (v.economia !== true && (CRISTAS[nome] !== undefined || ESPUMA[nome] !== undefined)) {
      partes.push(rolo(cristasDasOndas(d, nome, camadaBioma(d, pre + 'meio', md, md.oy - topo, 1), topo, agora) + espumaNasPedras(d, nome, topo, agora), md.vel))
    }
  }
  // reflexo correndo no vidro (Castelo), rola com o meio; nada na economia
  if (md !== undefined && VIDRO[nome] !== undefined && v.economia !== true) {
    partes.push(rolo(reflexoNoVidro(d, nome, topo, agora), md.vel))
  }
  // vapor nas chaminés (rola com o meio; menos na luta, nenhum na economia)
  if (md !== undefined && CHAMINES[nome] !== undefined && v.economia !== true) {
    // (as chaminés estão em y do meio.png inteiro, como o chão em 209: só tirar o topo da janela)
    partes.push(rolo(vapor(d, nome, -topo, agora, v.luta !== undefined ? 1 : 2), md.vel))
  }
  // partículas do bioma: no ar, na altura do meio (rolam com ele); menos na luta
  const nPart = PARTICULAS_BIOMA[nome]?.n ?? 0
  const part = particulasDoBioma(d, nome, topo, agora, v.economia === true ? 0 : v.luta !== undefined ? Math.ceil(nPart / 2) : nPart)
  if (part !== '') {
    partes.push(rolo(part, md?.vel ?? 0.5))
  }
  if (v.chefao !== undefined && fimDoChefao(v.chefao) > agora && v.tom === 'fundo') {
    partes.push(tingir(v.chefao, W, alturaCena(v.modo), 0.3))
  }
  // 6. chão da frente
  const ch = b.camadas.chao
  if (ch !== undefined) {
    partes.push(rolo(camadaBioma(d, pre + 'chao', ch, ch.oy - topo, 2), ch.vel))
  }
  return partes.join('')
}

function fundoBioma(d: Doc, b: Bioma, pre: string, x0: number, W: number, y: number): string {
  const nome = pre + 'fundo'
  const c = art(nome)
  const u = d.img(nome)
  const cx = c['x'] as number
  let s = `<use href="${u}" x="${cx - x0}" y="${y}"/>`
  for (const [dest, src, n, espelho] of b.fundo_tiras) {
    if (dest + n <= x0 || dest >= x0 + W) {
      continue
    }
    const tira = `<svg x="0" y="${y}" width="${n}" height="${c.h}" viewBox="${src} 0 ${n} ${c.h}"><use href="${u}"/></svg>`
    s += espelho
      ? `<g transform="translate(${dest - x0 + n},0) scale(-1,1)">${tira}</g>`
      : `<g transform="translate(${dest - x0},0)">${tira}</g>`
  }
  for (let j = 0; j < b.fundo_sobras; j++) {
    const a = art(`${nome}_s${j}`)
    const sx = a['x'] as number
    if (sx + a.w <= x0 || sx >= x0 + W) {
      continue
    }
    s += `<use href="${d.img(`${nome}_s${j}`)}" x="${sx - x0}" y="${y}"/>`
  }
  return s
}

/** Ponteiros do relógio da torre (10h10 por enquanto; girar fica para as animações de detalhe). */
/**
 * Os ponteiros do relógio da torre andando (fase B, como na prévia: "relógio
 * mágico do Relojoeiro", o tempo corre rápido): o minuto anda um tique de 6°
 * a cada 330 ms (uma volta em ~20 s); a hora, 1/12 disso.
 */
const TIQUE_MS = 330

function ponteiros(d: Doc, rel: NonNullable<Bioma['relogio']>, cx: number, cy: number, agora: number): string {
  const cor = `rgb(${rel.cor.join(',')})`
  const ox = cx + 0.5
  const oy = cy + 0.5
  const ponteiro = (de: number, comp: number, volta: number, passos: number) => {
    const k = d.anim(`from{transform:rotate(${de}deg)}to{transform:rotate(${de + 360}deg)}`, volta, `steps(${passos})`, -mod(agora, volta), 'infinite')
    return `<line class="${k}" style="transform-origin:${ox}px ${oy}px" x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy - comp}" stroke="${cor}" stroke-width="1"/>`
  }
  return ponteiro(300, rel.hora, TIQUE_MS * 720, 720) + ponteiro(0, rel.minuto, TIQUE_MS * 60, 60) + `<rect x="${cx}" y="${cy}" width="1" height="1" fill="${cor}"/>`
}

function cenario(d: Doc, v: Vista, dist: number, soCeu = false): string {
  const bioma = biomaDe(v)
  if (bioma !== 'floresta') {
    return cenarioBioma(d, v, dist, soCeu, bioma)
  }
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

/** Lua dormindo (lua nova): respira devagar, quadro largo (100 px) um pouco
 * à esquerda do quadro comum. Os Zs saem da cabeça, sobem balançando de pixel
 * em pixel, dobram de tamanho no meio do caminho e somem. */
const DORMINDO: readonly Q[] = [[0, 1400], [1, 1400]]
const DQW = 100
const DESCE_DORMINDO = 3
const Z_MS = 3000
// caminho de cada Z (px inteiros, para não borrar): sobe 21 e balança
const Z_PASSOS: readonly [number, number][] = [
  [0, 0], [1, -2], [2, -4], [2, -6], [1, -8], [0, -10], [0, -12], [1, -14], [2, -16], [2, -18], [1, -20], [1, -21],
]
// Z de 4x4 células; a sombra escura vai 1 célula para baixo e para a direita
const Z_CELULAS = ['XXXX', '..X.', '.X..', 'XXXX']

function zPixel(): string {
  const rects = (cor: string, o: number) =>
    Z_CELULAS.flatMap((l, y) => [...l].map((c, x) => (c === 'X' ? `<rect x="${x + o}" y="${y + o}" width="1" height="1" fill="${cor}"/>` : ''))).join('')
  return `<g shape-rendering="crispEdges">${rects('#1b1833', 1)}${rects('#dfe8ff', 0)}</g>`
}

function dormindo(d: Doc, agora: number): string {
  // desce DESCE_DORMINDO px: no quadro ela apoia 1-2 px acima dos pés e parecia flutuar
  return d.tira('lua_dormindo', -10, DESCE_DORMINDO, DQW, 100, DORMINDO, agora)
}

/** Os Zs vão por cima do escurecimento da lua nova (senão somem no escuro). */
function zsDormindo(d: Doc, v: Vista): string {
  const agora = v.agora
  const n = Z_PASSOS.length
  const anda = Z_PASSOS.map(([x, y], i) => `${((i / n) * 100).toFixed(2)}%{transform:translate(${x}px,${y}px)}`).join('') + `100%{transform:translate(${Z_PASSOS[n - 1]![0]}px,${Z_PASSOS[n - 1]![1]}px)}`
  const some = '0%{opacity:0}8%{opacity:1}70%{opacity:1}100%{opacity:0}'
  // pequeno (1 px por célula) até a metade, depois 2 px por célula; cresce a partir do canto de baixo
  const cresce = '0%{transform:translate(0,0) scale(1)}45%{transform:translate(0,-4px) scale(2)}100%{transform:translate(0,-4px) scale(2)}'
  const zs: string[] = []
  for (let i = 0; i < 3; i++) {
    const atraso = -mod(agora + (i * Z_MS) / 3, Z_MS)
    const a = d.anim(anda, Z_MS, 'step-end', atraso, 'infinite')
    const o = d.anim(some, Z_MS, 'linear', atraso, 'infinite')
    const c = d.anim(cresce, Z_MS, 'step-end', atraso, 'infinite')
    zs.push(`<g class="${o}"><g class="${a}"><g class="${c}">${zPixel()}</g></g></g>`)
  }
  // a cabeça fica no alto, à esquerda do quadro: os Zs nascem logo acima do rosto
  // (mesma origem da Lua em lua(): x 40, pés na linha 96 do quadro)
  const y = 209 - JANELA[v.modo].topo - PES_Q
  return `<g transform="translate(${40 + 34} ${y + 34 + DESCE_DORMINDO})">${zs.join('')}</g>`
}

function lua(d: Doc, v: Vista, desmaiada: boolean, naLuta?: { corpo: string; trilha: [number, string][] }): string {
  const pes = 209 - JANELA[v.modo].topo
  const x = 40
  const y = pes - PES_Q
  const { nivel } = nivelDe(v.hud.jogo.xp)
  let corpo: string
  const ab = faseAbertura(v)
  const ps = fasePassagem(v)
  // chegando pela esquerda: na abertura (fase 2) e na entrada da passagem
  const chega = ab?.fase === 2 ? ab.t : ps?.fase === 'entra' ? ps.t : undefined
  // (um redesenho depois do fim de uma animação desenha o estado final direto:
  // o Chrome não segura o fill="freeze" de uma animação que acabou antes de a
  // imagem abrir)
  const andaChega = Math.ceil((ABERTURA.distancia / VEL) * 1000) + ABERTURA.anda
  if (ps?.fase === 'sai' && ps.t >= PASSAGEM.anda) {
    // já passou da borda
    corpo = ''
  } else if (chega !== undefined && chega >= andaChega) {
    // já chegou
    corpo = d.tira('lua_parada', 0, 0, QW, 100, PARADA, v.agora)
  } else if (ps?.fase === 'sai') {
    // passagem: o chão parou; ela apressa o passo até passar da borda direita
    // (os quadros acompanham a pressa até 2,4x; depois ela corre um pouco solta)
    const dx = v.W - x + 6
    const vel = Math.max(VEL, dx / (PASSAGEM.anda / 1000))
    const fr = Math.max(45, Math.round((110 * VEL) / vel))
    const tempo = `dur="${seg(PASSAGEM.anda)}" begin="${seg(-ps.t)}" fill="freeze"`
    corpo =
      `<g><animateTransform attributeName="transform" type="translate" values="0 0;${dx} 0" ${tempo}/>` +
      `${d.tira('lua_andar', 0, 0, QW, 100, ANDAR.map(q => [q[0], fr, q[2]] as const), ps.t)}</g>`
  } else if (chega !== undefined) {
    // ela entra andando pela esquerda (o chão não rola) e para no lugar
    const anda = Math.ceil((ABERTURA.distancia / VEL) * 1000)
    const total = ABERTURA.anda + anda
    const tempo = `dur="${seg(total)}" begin="${seg(-chega)}" fill="freeze"`
    const k = (ABERTURA.anda / total).toFixed(3)
    corpo =
      `<g><animate attributeName="opacity" values="1;0" keyTimes="0;1" calcMode="discrete" ${tempo}/>` +
      `<g transform="translate(${-ABERTURA.distancia} 0)"><animateTransform attributeName="transform" type="translate" values="${-ABERTURA.distancia} 0;${-ABERTURA.distancia} 0;0 0" keyTimes="0;${k};1" ${tempo}/>` +
      `${d.tira('lua_andar', 0, 0, QW, 100, ANDAR, chega)}</g></g>` +
      `<g opacity="0"><animate attributeName="opacity" values="0;1" keyTimes="0;1" calcMode="discrete" ${tempo}/>` +
      `${d.tira('lua_parada', 0, 0, QW, 100, PARADA, v.agora)}</g>`
  } else if (desmaiada) {
    corpo = dormindo(d, v.agora)
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
  const maiorValor = Math.max(...[b.valor, ...(b.valores ?? []).filter(t => Number.isFinite(t[1])).map(t => t[2])].map(v => larguraCurta(v)))
  const cabe = larguraCurta(b.nome) + 10 + maiorValor <= larguraBarra - 4
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

/** Letras por linha no balão (padrão; o balão solto usa o que cabe em 80% da cena). */
const LETRAS_BALAO = 34

/**
 * As linhas do texto de um balão: tudo numa linha só enquanto couber em `max`
 * letras; passou disso, quebra entre palavras (de preferência depois de um
 * ponto, onde o texto tem "\n") e o balão cresce na altura.
 */
export function linhasDoBalao(texto: string, max = LETRAS_BALAO, pxLetra = 5.4): string[] {
  if (ehCJK()) {
    return linhasCJK(texto, max * pxLetra)
  }
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

/**
 * O mesmo em chinês, japonês e coreano, pela largura em px: frases inteiras
 * (separadas por "\n") enquanto couberem juntas; uma frase maior que a linha
 * quebra entre letras (sem começar linha com pontuação).
 */
function linhasCJK(texto: string, maxPx: number): string[] {
  const frases = texto.split('\n').map(f => f.trim()).filter(f => f !== '')
  // em CJK as frases se juntam sem espaço; em coreano (que tem espaços) com espaço
  const junta = (a: string, b: string) => (/[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef]$/.test(a) ? a + b : `${a} ${b}`)
  const corrido = frases.reduce((a, b) => (a === '' ? b : junta(a, b)), '')
  if (larguraLonga(corrido) <= maxPx) {
    return [corrido]
  }
  const linhas: string[] = []
  let atual = ''
  for (const frase of frases) {
    for (const pedaco of larguraLonga(frase) <= maxPx ? [frase] : quebrarPorLargura(frase, maxPx)) {
      if (atual === '') {
        atual = pedaco
      } else if (larguraLonga(junta(atual, pedaco)) <= maxPx) {
        atual = junta(atual, pedaco)
      } else {
        linhas.push(atual)
        atual = pedaco
      }
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
  const w = Math.max(larguraLonga(nome), ...linhas.map(l => larguraLonga(l))) + 14
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
  const linhas = linhasDoBalao(desc, max, BT.pxLetra)
  // CJK: a Fusion em 12 px (o tamanho nativo dela; 14 px borraria)
  const texto = ehCJK() ? Math.max(larguraLonga(nome), ...linhas.map(l => larguraLonga(l))) : Math.ceil(Math.max(nome.length, ...linhas.map(l => l.length)) * BT.pxLetra)
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
  const estilo = `font-size:${ehCJK() ? 12 : BT.letra}px`
  r += `<text class="t n l" x="${BT.pad}" y="${base}" style="${estilo};fill:#ffe27a">${esc(nome)}</text>`
  linhas.forEach((l, i) => {
    r += `<text class="t n l" x="${BT.pad}" y="${base + BT.linha * (i + 1)}" style="${estilo}">${esc(l)}</text>`
  })
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">` +
    `<style>${cssTexto(true)}${cssFonteLonga()}</style>${r}</svg>`
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
  // Pixelify Sans a 15 e 12 px; em CJK as duas linhas na Fusion a 12 px (o tamanho nativo dela)
  const cjk = ehCJK()
  const w1 = cjk ? larguraLonga(frase) : Math.ceil(frase.length * 8.4)
  const linha1 = emoji + vao + w1
  const w = Math.min(W - 8, Math.max(linha1, cjk ? larguraLonga(l2) : Math.ceil(l2.length * 6.9)) + 28)
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
    `<text class="t n l" x="${x1 + emoji + vao}" y="${y + 19}" style="font-size:${cjk ? 12 : 15}px;fill:#ffe27a">${esc(frase)}</text>` +
    `<text class="t m l" x="${W / 2}" y="${y + 35}" style="font-size:12px">${esc(l2)}</text></g>`
  )
}

// ---------------------------------------------------------------- tudo junto

/** A última frase do balão do XP: quando vem o próximo chefão, ou quando cai o que está em cena. */
function sobreChefao(c: Chefao | undefined, lutas: number): string {
  if (c === undefined || c.caiu !== undefined) {
    return tp('barras.xp.chefao_em', chefaoEm(lutas))
  }
  if (c.origem === 'lista') {
    const t = c.tarefas
    return tx('barras.xp.chefao_lista', { feitas: Math.min(t.feitas, t.total), total: t.total })
  }
  return tp('barras.xp.chefao_vida', c.vida)
}

/**
 * O cartão de título da passagem: uma fita em pixel (dourada, com as pontas
 * cortadas atrás) no alto da cena, com "PÁGINA 6 · TORRE DO RELÓGIO".
 * Aparece e some sozinho (tempos da entrada).
 */
function cartaoDeTitulo(W: number, texto: string, t: number): string {
  const cjk = ehCJK()
  const letra = cjk ? 12 : 16
  const larg = cjk ? larguraCurta(texto) : Math.ceil([...texto].length * 12)
  const w = Math.min(W - 40, larg + 28)
  const h = 24
  const x = Math.round((W - w) / 2)
  const y = 22
  const borda = '#f2c14e'
  const fundo = '#2a2050'
  const ponta = '#8a5a1c'
  // as pontas da fita, atrás do corpo, com o corte em V
  const pontas =
    `<polygon points="${x + 6},${y + 6} ${x - 14},${y + 6} ${x - 8},${y + 6 + h / 2} ${x - 14},${y + 6 + h} ${x + 6},${y + 6 + h}" fill="${ponta}"/>` +
    `<polygon points="${x + w - 6},${y + 6} ${x + w + 14},${y + 6} ${x + w + 8},${y + 6 + h / 2} ${x + w + 14},${y + 6 + h} ${x + w - 6},${y + 6 + h}" fill="${ponta}"/>`
  const corpo =
    `<rect x="${x + 2}" y="${y}" width="${w - 4}" height="${h}" fill="${borda}"/>` +
    `<rect x="${x}" y="${y + 2}" width="${w}" height="${h - 4}" fill="${borda}"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" fill="${fundo}"/>`
  const P_ = PASSAGEM
  const kt = (ms: number) => (ms / P_.entrada).toFixed(3)
  return (
    `<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${kt(P_.tituloEntra)};${kt(P_.tituloEntra + 300)};${kt(P_.tituloSai)};${kt(P_.tituloSai + 300)};1" dur="${seg(P_.entrada)}" begin="${seg(-t)}" fill="freeze"/>` +
    pontas +
    corpo +
    `<text class="t m" x="${W / 2}" y="${y + h / 2 + (cjk ? 4 : 6)}" style="font-size:${letra}px;fill:#ffe27a">${esc(texto)}</text></g>`
  )
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

/** O SVG por fora: tamanho na tela, recorte e o pixel nítido. */
function envelope(v: Vista, Ht: number, estilo: string, defs: string, corpo: string): string {
  const s = v.escala
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${v.W * s}" height="${Ht * s}" viewBox="0 0 ${v.W} ${Ht}" preserveAspectRatio="xMinYMin slice" shape-rendering="crispEdges">` +
    `<style>svg,image,use{image-rendering:crisp-edges;image-rendering:pixelated}${estilo}</style>` +
    `<defs>${defs}</defs>${corpo}</svg>`
  )
}

/** Tamanho que conta no app: o SVG vira endereço (data:), e o teto vale para ele codificado. */
export const tamanhoNoApp = (svg: string): number => encodeURIComponent(svg).length

/**
 * A cena em três formas: `svg` (tudo num só, para o editor e o celular) e, para
 * o app desktop, `fundo` (só o cenário) e `frente` (personagens, efeitos, HUD,
 * botões, assinatura, fundo transparente), desenhados um sobre o outro. O app
 * recusa um SVG acima de ~124 mil codificado; separados, cada um cabe com folga.
 * Os dois tiram o tempo do mesmo relógio (atrasos negativos): ficam em sincronia.
 */
export function montar(v: Vista): { svg: string; fundo: string; frente: string; largura: number; altura: number; alvos: Alvo[] } {
  const ps = fasePassagem(v)
  if (ps !== undefined) {
    // passagem: o bioma de cada metade e o chão parado (a Lua anda sozinha)
    v = { ...v, bioma: ps.fase === 'sai' ? ps.p.de : ps.p.para, caminho: { andando: false, desde: v.agora, dist0: distancia(v.caminho, v.agora) } }
  }
  const d = new Doc()
  const dc = new Doc('c') // o cenário: ids próprios para caber junto no SVG único
  const H = alturaCena(v.modo)
  const dist = distancia(v.caminho, v.agora)
  const l = luar(v.hud, v.agora)
  const ab = faseAbertura(v)
  const corpo: string[] = []
  const atras = cenario(dc, v, dist, ab?.fase === 1)
  if (ab?.fase === 1) {
    corpo.push(marcaNoCeu(v.W, H, ab.t))
  }
  const pes = 209 - JANELA[v.modo].topo
  const ch = v.chefao !== undefined && fimDoChefao(v.chefao) > v.agora ? v.chefao : undefined
  const palco = { W: v.W, H, pes, agora: v.agora, nomeClaro: ceuEscuro(biomaDe(v)) }
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
  if (ps?.fase === 'sai') {
    // a tela escurece enquanto ela passa da borda
    const k = ((PASSAGEM.saida - PASSAGEM.escurece) / PASSAGEM.saida).toFixed(3)
    corpo.push(`<rect width="${v.W}" height="${H}" fill="${NOITE}" opacity="0"><animate attributeName="opacity" values="0;0;1" keyTimes="0;${k};1" dur="${seg(PASSAGEM.saida)}" begin="${seg(-ps.t)}" fill="freeze"/></rect>`)
  } else if (ps?.fase === 'entra') {
    // o bioma novo clareia e o título aparece
    corpo.push(`<rect width="${v.W}" height="${H}" fill="${NOITE}" opacity="0"><animate attributeName="opacity" values="1;0" dur="${seg(PASSAGEM.clareia)}" begin="${seg(-ps.t)}" fill="freeze"/></rect>`)
    corpo.push(cartaoDeTitulo(v.W, tituloDaPassagem(ps.p), ps.t))
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
    if (faseAbertura(v) === undefined) {
      corpo.push(zsDormindo(d, v))
    }
    corpo.push(avisoLuaNova(v.W, H, v.fraseLuaNova ?? fraseLuaNova(), v.avisoNoMeio ?? true))
  }
  const hd = hud(d, v, H)
  if (hd.botoesNaCena) {
    corpo.push(botoes(d, v.W - 4, 4, false, v.W, v.estadoBotoes, v.agora, v.semBaloes !== true))
  }
  // golpe crítico: a cena inteira treme (o HUD fica parado); o cenário treme
  // junto, no SVG dele, com a mesma trilha
  const treme = lt !== undefined && lt.tremor.length > 0 ? lt.tremor : undefined
  const frenteCena = corpo.join('')
  // assinatura do autor (pedido do usuário): discreta no canto de cima à
  // esquerda, fora do tremor; vai junto em todo print da faixa
  const assinatura = v.semAssinatura !== true ? `<use href="${d.img('assinatura')}" x="4" y="4" opacity="0.72"/>` : ''
  const abre = `<svg x="0" y="0" width="${v.W}" height="${H}" overflow="hidden">`
  const Ht = H + ALTURA_HUD
  const estiloFrente = `${ab?.fase === 1 ? MARCA.css : ''}${cssTexto()}${v.semFonteLonga !== true && (v.textoLongo === true || l.desmaiada) ? cssFonteLonga() : ''}${CSS_BOTOES}`
  // a mesma trilha de tremor embrulha a frente (e, no SVG único, a cena toda);
  // o cenário separado ganha a dele (classes do cenário)
  const [antes, depois] = treme === undefined ? ['', ''] : (d.pista(treme, v.agora, '\u0000').split('\u0000') as [string, string])
  const atrasTreme = treme === undefined ? atras : dc.pista(treme, v.agora, atras)
  const cssC = dc.css.join('')
  const cssF = d.css.join('')
  // o SVG único: o cenário e a frente tremem juntos, como antes
  const unico = envelope(v, Ht, estiloFrente + cssC + cssF, [...new Set([...dc.defs, ...d.defs])].join(''), abre + antes + atras + frenteCena + depois + assinatura + '</svg>' + hd.svg)
  const fundo = envelope(v, Ht, cssC, dc.defs.join(''), abre + atrasTreme + '</svg>')
  const frente = envelope(v, Ht, estiloFrente + cssF, d.defs.join(''), abre + antes + frenteCena + depois + assinatura + '</svg>' + hd.svg)
  return { svg: unico, fundo, frente, largura: v.W * v.escala, altura: Ht * v.escala, alvos: hd.alvos }
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
