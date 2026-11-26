// As fontes embutidas nos desenhos (SVG) e a largura dos textos.
//
// Idiomas latinos: Silkscreen 12 px nas barras e títulos (caixa alta) e
// Pixelify Sans 10 px nos textos longos. Chinês, japonês e coreano (opção A,
// escolhida pelo usuário em 23/11/2026): a Fusion Pixel 12 px entra no lugar
// das duas, em três recortes por idioma (cena, balões, Livro; construir_mod.py),
// porque a cena mais pesada tem pouca folga. O CSS lista as famílias em
// sequência: a letra que falta num recorte cai no seguinte que estiver embutido.
import { FONTE, FONTE_LONGA, FONTES_CJK } from './arte'
import { idioma } from './t'

/** Os recortes da Fusion Pixel do idioma atual, ou undefined fora do chinês, japonês e coreano. */
export const fusion = () => FONTES_CJK[idioma()]

/** Se o idioma atual escreve com letras CJK (largura e quebra de linha diferentes). */
export const ehCJK = () => fusion() !== undefined

const face = (familia: string, url: string, extra = '') => `@font-face{font-family:'${familia}';src:url(${url}) format('woff2')${extra}}`

/** A lista de famílias dos textos curtos (barras, títulos, nome do chefão). */
export const familiaCurta = () => (ehCJK() ? "'Fusion','Fusion Longa',ui-monospace,monospace" : "'Silkscreen',ui-monospace,monospace")

/**
 * Classes de texto da cena (.t curto com contorno, .l longo) com a fonte curta
 * embutida. `semCurta`: sem a Silkscreen (os balões só escrevem na Pixelify; a
 * árvore da faixa inteira tem teto no app e são 9 balões). No CJK a Fusion fica.
 */
export function cssTexto(semCurta = false): string {
  const f = fusion()
  return (
    // Silkscreen: grade de 8 px; 12 px = 1,5 px de tela por pixel da fonte. Fusion: 12 px = 1 para 1.
    (f === undefined ? (semCurta ? '' : face('Silkscreen', FONTE)) : face('Fusion', f.cena)) +
    `.t{font-family:${familiaCurta()};font-size:12px;fill:#fff6d8;stroke:#1d1433;stroke-width:2px;paint-order:stroke;text-rendering:optimizeSpeed}` +
    '.m{text-anchor:middle}.e{text-anchor:end}.n{fill:#e9d9ff}.b{font-size:12px}.b8{font-size:8px}' +
    // textos longos (balões, aviso de lua nova): Pixelify Sans, com minúsculas; ou a Fusion, sempre em 12 px
    (f === undefined
      ? ".l{font-family:'Pixelify Sans','Silkscreen',ui-monospace,monospace;font-weight:500;font-size:10px}"
      : ".l{font-family:'Fusion Longa','Fusion',sans-serif;font-weight:400;font-size:12px}")
  )
}

/** A fonte dos textos longos dos balões e da lua nova (só entra quando eles podem aparecer). */
export function cssFonteLonga(): string {
  const f = fusion()
  return f === undefined ? face('Pixelify Sans', FONTE_LONGA, ';font-weight:500') : face('Fusion Longa', f.baloes)
}

/** A fonte dos textos do Livro (títulos e textos longos). */
export function cssFonteLivro(): string {
  const f = fusion()
  return f === undefined ? cssFonteLonga() : face('Fusion Longa', f.livro)
}

/** Letra larga (CJK, kana, hangul, sinais de largura inteira): 12 px na Fusion. */
const larga = (c: number) => c >= 0x2e80 && !(c >= 0xff61 && c <= 0xffdc)

/** Sílaba ou letra do hangul (coreano). */
const hangul = (c: number) => (c >= 0xac00 && c <= 0xd7af) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f)

/** Largura de um texto pela regra de cada letra. */
function medir(s: string, latina: (ch: string) => number): number {
  let w = 0
  for (const ch of s) {
    w += larga(ch.codePointAt(0) ?? 0) ? 12 : latina(ch)
  }
  return Math.ceil(w)
}

/**
 * Largura de um texto curto a 12 px (barras, títulos): Silkscreen 9 px por letra
 * (0,75 em); Fusion 12 nas letras CJK, 8 nas maiúsculas latinas, 6 no resto (medido).
 */
export const larguraCurta = (s: string, pxLatina = 9) =>
  ehCJK() ? medir(s, ch => (ch >= 'A' && ch <= 'Z' ? 8 : 6)) : Math.ceil([...s].length * pxLatina)

/** Largura de um texto longo: Pixelify 10 px ~5,4 por letra (com folga); Fusion 12 px como acima. */
export const larguraLonga = (s: string, pxLatina = 5.4) =>
  ehCJK() ? medir(s, ch => (ch >= 'A' && ch <= 'Z' ? 8 : 6)) : Math.ceil([...s].length * pxLatina)

// ---------------------------------------------------------------- quebra de linha CJK

/** Pontuação que não pode começar linha (gruda na letra de antes). */
const FECHA = '、。，．！？：；）」』】〉》ー…・%!?,.:;)]'
/** Pontuação que não pode terminar linha (gruda na letra de depois). */
const ABRE = '（「『【〈《(['

/**
 * Os pedaços de um texto entre os quais a linha pode quebrar: palavras latinas
 * inteiras (com o espaço de antes no começo) e cada letra CJK sozinha, que em
 * chinês e japonês não tem espaço entre as palavras. A pontuação fica grudada.
 */
export function pedacos(s: string): string[] {
  const out: string[] = []
  let espaco = false
  for (const ch of s) {
    if (ch === ' ' || ch === '\n' || ch === '\t') {
      espaco = out.length > 0
      continue
    }
    const ult = out.length - 1
    const antes = ult >= 0 ? ([...out[ult] ?? ''].at(-1) ?? '') : ''
    const c = ch.codePointAt(0) ?? 0
    const a = antes.codePointAt(0) ?? 0
    // palavra: letras latinas seguidas, ou hangul seguido (o coreano quebra nos espaços, como o latim)
    const palavra = antes !== '' && ((!larga(c) && !larga(a)) || (hangul(c) && hangul(a)))
    if (ult >= 0 && !espaco && (FECHA.includes(ch) || ABRE.includes(antes) || palavra)) {
      out[ult] += ch
    } else {
      out.push((espaco ? ' ' : '') + ch)
    }
    espaco = false
  }
  return out
}

/** Quebra um texto em linhas de até `max` px, pela largura medida (chinês, japonês, coreano). */
export function quebrarPorLargura(s: string, max: number, medida: (s: string) => number = larguraLonga): string[] {
  const linhas: string[] = []
  let atual = ''
  for (const p of pedacos(s)) {
    if (atual === '') {
      atual = p.trimStart()
    } else if (medida(atual + p) <= max) {
      atual += p
    } else {
      linhas.push(atual)
      atual = p.trimStart()
    }
  }
  if (atual !== '') {
    linhas.push(atual)
  }
  return linhas
}
