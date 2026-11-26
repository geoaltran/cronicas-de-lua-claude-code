// Peças comuns do desenho em SVG: o documento (defs, CSS e animações) e utilidades.
import { ARTE } from './arte'

export const P = 958 // largura das camadas que dão a volta

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const r = (n: number) => Math.round(n)
export const mod = (a: number, b: number) => ((a % b) + b) % b

/** Sorteio repetível (mulberry32), para partículas sempre no mesmo lugar. */
export function sorteio(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let h2 = false
/** Poses alternativas (h2_*) no lugar das lua_* que existirem. */
export function usarH2(v: boolean): void {
  h2 = v
}
export const comH2 = (): boolean => h2
const nomeReal = (nome: string): string =>
  h2 && nome.startsWith('lua_') && ARTE[`h2_${nome.slice(4)}`] !== undefined ? `h2_${nome.slice(4)}` : nome

export const art = (nome: string) => {
  const a = ARTE[nome]
  if (a === undefined) {
    throw new Error(`arte sem nome: ${nome}`)
  }
  return a
}

/** [quadro, ms, dy]; quadro -1 = escondido. */
export type Q = readonly [number, number, number?]

/** Lua parada: respira (normal/respirando a cada 600 ms) e pisca. Aprovado. */
export const PARADA: readonly Q[] = [
  [0, 600], [1, 600], [0, 600], [1, 600], [0, 600], [1, 600], [0, 300], [2, 140], [0, 160],
]
/** Lua andando: 8 quadros de 110 ms, 1 px mais baixa nos quadros 2 e 6. Aprovado. */
export const ANDAR: readonly Q[] = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i, 110, i === 1 || i === 5 ? 1 : 0] as const)

export class Doc {
  css: string[] = []
  defs: string[] = []
  private ids = new Set<string>()
  private n = 0

  /** `pre` nos ids e classes: duas cenas (cenário e frente) cabem num SVG só sem trocar nomes. */
  private readonly pre: string
  constructor(pre = '') {
    this.pre = pre
  }

  /** Cada imagem entra uma vez só (em <defs>) e é reusada com <use>. */
  img(pedido: string): string {
    const nome = nomeReal(pedido)
    if (!this.ids.has(nome)) {
      const a = art(nome)
      this.defs.push(`<image id="${nome}" href="${a.u}" width="${a.w}" height="${a.h}"/>`)
      this.ids.add(nome)
    }
    return `#${nome}`
  }

  id(prefixo: string): string {
    this.n += 1
    return `${this.pre}${prefixo}${this.n}`
  }

  private quadros = new Map<string, string>()

  /** Uma animação CSS; quadros iguais são escritos uma vez só (só o atraso muda). */
  anim(quadros: string, ms: number, tempo: string, atrasoMs: number, repete: string): string {
    let k = this.quadros.get(quadros)
    if (k === undefined) {
      k = this.id('k')
      this.quadros.set(quadros, k)
      this.css.push(`@keyframes ${k}{${quadros}}`)
    }
    const c = this.id('a')
    this.css.push(`.${c}{animation:${k} ${r(ms)}ms ${tempo} ${r(atrasoMs)}ms ${repete}}`)
    return c
  }

  /** Sequência de quadros de uma tira (sprite sheet), recortada num quadro fw x fh. */
  tira(nome: string, x: number, y: number, fw: number, fh: number, qs: readonly Q[], relogioMs: number, repete = true): string {
    const href = this.img(nome)
    const pos = (q: Q) => `translate(${q[0] < 0 ? 4000 : -q[0] * fw}px,${q[2] ?? 0}px)`
    let corpo: string
    if (qs.length === 1) {
      const q = qs[0] as Q
      corpo = `<use href="${href}" style="transform:${pos(q)}"/>`
    } else {
      const total = qs.reduce((s, q) => s + q[1], 0)
      let t = 0
      const partes: string[] = []
      for (const q of qs) {
        partes.push(`${((t / total) * 100).toFixed(3)}%{transform:${pos(q)}}`)
        t += q[1]
      }
      partes.push(`100%{transform:${pos(qs[qs.length - 1] as Q)}}`)
      const atraso = repete ? -mod(relogioMs, total) : -Math.min(relogioMs, total)
      const k = this.anim(partes.join(''), total, 'step-end', atraso, repete ? 'infinite' : '1 both')
      corpo = `<use href="${href}" class="${k}"/>`
    }
    return `<svg x="${r(x)}" y="${r(y)}" width="${fw}" height="${fh}" viewBox="0 0 ${fw} ${fh}" overflow="hidden">${corpo}</svg>`
  }

  /**
   * Uma camada que dá a volta: `conteudo` tem cópias em 0 e 958. Com `paraEmMs`,
   * a rolagem para sozinha daqui a tanto tempo (a Lua parou para lutar), sem
   * precisar redesenhar: o número de voltas da animação é fracionário.
   */
  rolo(conteudo: string, desloc: number, pxPorS: number, paraEmMs?: number): string {
    const o = mod(desloc, P)
    if (pxPorS <= 0 || (paraEmMs !== undefined && paraEmMs <= 0)) {
      return `<g style="transform:translateX(${-r(o)}px)">${conteudo}</g>`
    }
    const dur = (P / pxPorS) * 1000
    const voltas = paraEmMs === undefined ? 'infinite' : `${(o / P + paraEmMs / dur).toFixed(5)} forwards`
    const k = this.anim(`from{transform:translateX(0)}to{transform:translateX(-${P}px)}`, dur, `steps(${P})`, -(o / P) * dur, voltas)
    return `<g class="${k}">${conteudo}</g>`
  }

  /**
   * Mostra `conteudo` só entre `de` e `ate` (ms no relógio, `ate` pode ser
   * Infinity). Antes e depois fica escondido. Vazio se a janela já passou.
   */
  janela(de: number, ate: number, agora: number, conteudo: string): string {
    if (ate <= agora || ate <= de || conteudo === '') {
      return ''
    }
    if (de <= agora && ate === Infinity) {
      return conteudo
    }
    // um começo no passado (ou -Infinity) vale como "agora": só o fim importa
    de = Math.max(de, agora - 1)
    const dur = ate === Infinity ? 1e9 : ate - de
    const k = this.anim('0%,100%{visibility:visible}', dur, 'step-end', de - agora, '1 none')
    return `<g class="${k}" visibility="hidden">${conteudo}</g>`
  }

  /**
   * Uma trilha quadro a quadro: em cada instante (ms no relógio) o `transform`
   * dado, segurando até o próximo. Antes do primeiro fica no primeiro, depois do
   * último fica no último.
   */
  pista(pts: readonly (readonly [number, string])[], agora: number, conteudo: string): string {
    if (pts.length === 0 || conteudo === '') {
      return conteudo
    }
    const [t0, tr0] = pts[0] as readonly [number, string]
    const [t1, tr1] = pts[pts.length - 1] as readonly [number, string]
    if (pts.length === 1 || t1 <= t0) {
      return `<g style="transform:${tr0}">${conteudo}</g>`
    }
    if (t1 <= agora) {
      return `<g style="transform:${tr1}">${conteudo}</g>`
    }
    const dur = t1 - t0
    const quadros = pts.map(([t, tr]) => `${(((t - t0) / dur) * 100).toFixed(3)}%{transform:${tr}}`).join('')
    const k = this.anim(quadros, dur, 'step-end', t0 - agora, '1 both')
    return `<g class="${k}">${conteudo}</g>`
  }

  private filtros = new Set<string>()

  /** Um filtro em <defs>, escrito uma vez só. */
  filtro(id: string, corpo: string): string {
    if (!this.filtros.has(id)) {
      this.filtros.add(id)
      this.defs.push(`<filter id="${id}" color-interpolation-filters="sRGB" x="-5%" y="-5%" width="110%" height="110%">${corpo}</filter>`)
    }
    return `url(#${id})`
  }

  /** Sobe e desce devagar (balanço de ilhas e vaga-lumes), em px inteiros. */
  balanco(conteudo: string, amp: number, ms: number, faseMs: number, agora: number): string {
    const passos = [0, -1, -2, -1, 0, 1, 2, 1].map(v => Math.max(-amp, Math.min(amp, v)))
    const quadros = passos.map((v, i) => `${(i * 12.5).toFixed(1)}%{transform:translateY(${v}px)}`).join('') + `100%{transform:translateY(0px)}`
    const k = this.anim(quadros, ms, 'step-end', -mod(agora + faseMs, ms), 'infinite')
    return `<g class="${k}">${conteudo}</g>`
  }
}

