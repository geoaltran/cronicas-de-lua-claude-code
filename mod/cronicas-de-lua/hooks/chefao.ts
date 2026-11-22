// Chefões (Fase 3): jornada, vida pela lista de tarefas e o desenho do chefão
// em cena (entrada, golpe, queda), da barra de vida e da página recuperada.
//
// A faixa não cresce: o chefão luta na mesma cena das lutas comuns, no mesmo
// lugar do monstro. Enquanto ele está em cena, cada ferramenta do Claude vira
// um golpe nele (luta `fixo`), mas a vida só cai com tarefa concluída.
import { type Doc, esc, r } from './base'
import type { Chefao } from '../types'
import { DESFAZ, F, corpoMonstro, desfazer, monstroInfo } from './luta'

/** A ordem da jornada: uma página das Crônicas por chefão. */
export const JORNADA = ['vespera', 'dama_penumbra', 'golem_obsidiana', 'leviata', 'ignis', 'relojoeiro', 'sir_solis', 'rei_espelho', 'nebula', 'malakor'] as const

export const NOME_CHEFAO: Record<string, string> = {
  vespera: 'Vespera',
  dama_penumbra: 'Dama Penumbra',
  golem_obsidiana: 'Golem de Obsidiana',
  leviata: 'Leviatã',
  ignis: 'Ignis',
  relojoeiro: 'Relojoeiro',
  sir_solis: 'Sir Solis',
  rei_espelho: 'Rei Espelho',
  nebula: 'Nébula',
  malakor: 'Malakor',
}

/** O tom que tinge a cena durante a luta de cada chefão. */
const TOM: Record<string, string> = {
  vespera: '#6b3fa8',
  dama_penumbra: '#5a2a7e',
  golem_obsidiana: '#2c3150',
  leviata: '#1b6f8a',
  ignis: '#c4502a',
  relojoeiro: '#a5793a',
  sir_solis: '#d6a12e',
  rei_espelho: '#7fa6d6',
  nebula: '#3f2378',
  malakor: '#24103e',
}

/** Sem lista de tarefas, o chefão vem a cada tantas vitórias comuns. */
export const A_CADA = 12
/** Vida do chefão que veio pelas lutas (sem lista): cada vitória tira 1. */
export const VIDA_SEM_LISTA = 3
/** Quanto a queda fica na tela (desfaz em pixels + página recuperada). */
export const QUEDA_MS = 3600

/** O chefão que guarda a próxima página (depois do Malakor, a jornada recomeça: Novo Jogo+). */
export function proximoChefao(paginas: number): { nome: string; pagina: number } {
  const i = ((paginas % 10) + 10) % 10
  return { nome: JORNADA[i] as string, pagina: i + 1 }
}

/** O chefão pelo nome digitado ("relojoeiro", "Sir Solis", "dama"...), ou undefined. */
export function chefaoPeloNome(texto: string): string | undefined {
  const limpa = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, '')
  const q = limpa(texto)
  if (q === '') {
    return undefined
  }
  return JORNADA.find(n => limpa(n).startsWith(q) || limpa(NOME_CHEFAO[n] ?? '').startsWith(q))
}

/** Páginas no ciclo atual (10/10 fica até a primeira página do Novo Jogo+). */
export function paginasNoCiclo(p: number): number {
  return p <= 0 ? 0 : ((p - 1) % 10) + 1
}

/** Quantas vitórias faltam para o próximo chefão (sem lista). */
export function chefaoEm(lutas: number): number {
  return A_CADA - (lutas % A_CADA)
}

// ---------------------------------------------------------------- lista de tarefas

type Tarefas = Chefao['tarefas']
type Item = { status?: unknown }

const contar = (itens: readonly Item[]): Tarefas => ({ total: itens.length, feitas: itens.filter(i => i?.status === 'completed').length })

/**
 * O que uma ferramenta fez com a lista de tarefas: a lista nova (total e
 * concluídas), ou null se ela não mexe em lista. `atual` é a lista do chefão.
 */
export function lerTarefas(tool: string, input: unknown, atual: Tarefas | null): Tarefas | null {
  const i = (input ?? {}) as Record<string, unknown>
  if (tool === 'TodoWrite' && Array.isArray(i['todos'])) {
    return contar(i['todos'] as Item[])
  }
  if (tool === 'mcp__ccd_turn__update_plan') {
    if (Array.isArray(i['items'])) {
      return contar(i['items'] as Item[])
    }
    if (atual === null) {
      return null
    }
    let feitas = atual.feitas
    if (i['advance'] === true) {
      feitas += 1
    }
    if (Array.isArray(i['done'])) {
      feitas += i['done'].length
    }
    return { total: atual.total, feitas: Math.min(atual.total, feitas) }
  }
  if (tool === 'mcp__ccd_turn__wrap_up') {
    // o fechamento do app marca a lista inteira como feita
    return atual === null ? null : { total: atual.total, feitas: atual.total }
  }
  if (tool === 'TaskCreate') {
    const t = atual ?? { total: 0, feitas: 0 }
    return { total: t.total + 1, feitas: t.feitas }
  }
  if (tool === 'TaskUpdate' && atual !== null && i['status'] === 'completed') {
    return { total: atual.total, feitas: Math.min(atual.total, atual.feitas + 1) }
  }
  return null
}

/** Um chefão novo entrando em cena. */
export function novoChefao(paginas: number, origem: Chefao['origem'], t0: number, tarefas: Tarefas = { total: 0, feitas: 0 }, escolhido?: string): Chefao {
  const i = escolhido === undefined ? -1 : (JORNADA as readonly string[]).indexOf(escolhido)
  const { nome, pagina } = i >= 0 ? { nome: escolhido as string, pagina: i + 1 } : proximoChefao(paginas)
  const vidaMax = origem === 'lista' ? Math.max(1, tarefas.total) : VIDA_SEM_LISTA
  const vida = origem === 'lista' ? Math.max(1, tarefas.total - tarefas.feitas) : VIDA_SEM_LISTA
  return { nome, pagina, origem, t0, vidaMax, vida, tarefas }
}

/** Tira vida (ou acerta pela lista). Na vida 0 ele cai. */
export function ferir(c: Chefao, vida: number, agora: number): Chefao {
  const v = Math.max(0, Math.min(c.vidaMax, vida))
  if (v >= c.vida || c.caiu !== undefined) {
    return c
  }
  return { ...c, vida: v, golpe: { at: agora, antes: c.vida }, ...(v === 0 ? { caiu: agora } : {}) }
}

// ---------------------------------------------------------------- desenho

export type PalcoChefao = { W: number; H: number; pes: number; agora: number }

/** Onde o chefão fica (o mesmo lugar do monstro nas lutas). */
export function lugar(c: Chefao, W: number, pes: number): { mx: number; my: number; w: number; h: number } {
  const mi = monstroInfo(c.nome)
  return { mx: W - 90 - mi.w, my: pes - mi.h, w: mi.w, h: mi.h }
}

/** Cena tingida no tom do chefão (atrás dos personagens). */
export function tingir(c: Chefao, W: number, H: number, forca: number): string {
  return `<rect width="${W}" height="${H}" fill="${TOM[c.nome] ?? '#3a2a6a'}" opacity="${forca}"/>`
}

/** Até quando o chefão aparece. */
export function fimDoChefao(c: Chefao): number {
  return c.caiu === undefined ? Infinity : c.caiu + QUEDA_MS
}

/** O chefão parado em cena (fora das lutas): entra pela direita, respira, pisca no golpe, cai em pixels. */
export function chefaoEmCena(d: Doc, c: Chefao, p: PalcoChefao): string {
  const { W, pes, agora } = p
  const { mx, my, w } = lugar(c, W, pes)
  const mi = monstroInfo(c.nome)
  const corpo0 = corpoMonstro(d, c.nome, agora)
  const vira = mi.espelhar ? ` transform="translate(${w},0) scale(-1,1)"` : ''
  const sprite = (filtro?: string) => `<g${vira}>${filtro !== undefined ? `<g filter="${filtro}">${corpo0}</g>` : corpo0}</g>`
  const longe = W + 4 - mx
  const entrada: [number, string][] = Array.from({ length: 11 }, (_, k) => [c.t0 + k * F, `translateX(${r(longe * (1 - k / 10))}px)`])
  const respira = d.anim('0%{transform:translateY(0)}50%{transform:translateY(-1px)}100%{transform:translateY(0)}', 16 * F, 'step-end', -(agora % (16 * F)), 'infinite')
  const cai = c.caiu ?? Infinity
  let corpo = d.janela(-Infinity, cai, agora, `<g class="${respira}">${sprite()}</g>`)
  if (c.golpe !== undefined && c.golpe.at + 4 * F > agora) {
    const branco = d.filtro('fb', '<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/>')
    corpo += d.janela(c.golpe.at, Math.min(cai, c.golpe.at + 2 * F), agora, sprite(branco))
  }
  if (c.caiu !== undefined && c.caiu + DESFAZ > agora) {
    corpo += d.janela(c.caiu, c.caiu + DESFAZ, agora, sprite(desfazer(d, 900 + c.pagina, c.caiu, agora)))
  }
  return `<g transform="translate(${mx},${my})">${d.pista(entrada, agora, corpo)}</g>`
}

// Barra de vida no estilo da referência do usuário: moldura dourada com
// pontas, vermelho em dois tons, rastro escuro do dano recente, fundo escuro.
const O = '#1c0f16'
const G1 = '#f7cf4a'
const G2 = '#de8e2c'
const VAZIO = '#22121b'
const R1 = '#f2405a'
const R2 = '#c21e4f'
const D1 = '#c62a3e'
const D2 = '#94173e'

const ret = (x: number, y: number, w: number, h: number, cor: string) => (w > 0 && h > 0 ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cor}"/>` : '')

function ponta(x: number, y: number): string {
  // carretel da referência: 6 x 14, botão em cima e embaixo, pescoço estreito no meio
  return (
    ret(x + 1, y - 3, 4, 14, O) +
    ret(x, y - 2, 6, 4, O) +
    ret(x, y + 6, 6, 4, O) +
    ret(x + 1, y - 2, 4, 4, G1) +
    ret(x + 2, y + 2, 2, 2, G1) +
    ret(x + 2, y + 4, 2, 2, G2) +
    ret(x + 1, y + 6, 4, 4, G2) +
    ret(x + 2, y - 2, 2, 1, '#fff1a8') +
    ret(x + 1, y + 1, 4, 1, '#c9862a') +
    ret(x + 1, y + 9, 4, 1, '#a8641f')
  )
}

/** A barra (com o nome em cima, Silkscreen preta) a `y` do topo, de `x` a `x + w`. */
export function barraDeVida(d: Doc, c: Chefao, x: number, y: number, w: number, agora: number): string {
  const ix = x + 5
  const iw = w - 10
  const larg = (v: number) => r((iw * Math.max(0, v)) / Math.max(1, c.vidaMax))
  const fw = larg(c.vida)
  let s =
    // 8 px: contorno, ouro, vermelho (2 claros + 2 escuros), ouro, contorno
    ret(x + 2, y, w - 4, 8, O) +
    ret(x + 2, y + 1, w - 4, 1, G1) +
    ret(x + 2, y + 6, w - 4, 1, G2) +
    ret(ix, y + 2, iw, 4, VAZIO) +
    ret(ix, y + 2, fw, 2, R1) +
    ret(ix, y + 4, fw, 2, R2)
  // rastro do golpe: o pedaço que acabou de sair fica escuro por um instante
  if (c.golpe !== undefined && c.golpe.at + 1200 > agora) {
    const aw = larg(c.golpe.antes) - fw
    s += d.janela(c.golpe.at, c.golpe.at + 1200, agora, ret(ix + fw, y + 2, aw, 2, D1) + ret(ix + fw, y + 4, aw, 2, D2))
  }
  s += ponta(x - 1, y) + ponta(x + w - 5, y)
  const nome = (NOME_CHEFAO[c.nome] ?? c.nome).toUpperCase()
  s += `<text x="${x + 3}" y="${y - 4}" style="font-family:'Silkscreen',ui-monospace,monospace;font-size:12px;fill:${O}">${esc(nome)}</text>`
  return `<g>${s}</g>`
}

/** Onde a barra vai: à esquerda do chefão, no alto da cena. */
export function barraNoLugar(d: Doc, c: Chefao, p: PalcoChefao): string {
  const { mx } = lugar(c, p.W, p.pes)
  const w = Math.max(80, Math.min(160, mx - 14))
  const x = Math.max(8, mx - 2 - w)
  return d.janela(-Infinity, c.caiu === undefined ? Infinity : c.caiu + DESFAZ, p.agora, barraDeVida(d, c, x, 17, w, p.agora))
}

/** "+PÁGINA 3/10" (e "NOVO JOGO+" depois do Malakor), subindo devagar no meio da cena. */
export function paginaRecuperada(d: Doc, c: Chefao, p: PalcoChefao): string {
  if (c.caiu === undefined || c.caiu + QUEDA_MS <= p.agora) {
    return ''
  }
  const de = c.caiu + 6 * F
  const cx = Math.floor(p.W / 2)
  const linhas = [`+PÁGINA ${c.pagina}/10`]
  if (c.pagina === 10) {
    linhas.push('NOVO JOGO+')
  }
  const txt = linhas.map((l, i) => `<text class="t m" x="${cx}" y="${44 + i * 16}" style="fill:#ffe27a">${esc(l)}</text>`).join('')
  const sobe: [number, string][] = Array.from({ length: 8 }, (_, k) => [de + k * 2 * F, `translateY(${-k}px)`])
  return d.janela(de, c.caiu + QUEDA_MS, p.agora, d.pista(sobe, p.agora, txt))
}
