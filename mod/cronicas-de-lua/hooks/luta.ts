// Lutas comuns (Fase 2): cada ferramenta do Claude vira um monstro.
//
// O roteiro é uma função pura do estado da luta (quando começou, quando cada
// ferramenta voltou, quando se decidiu): dá os instantes de cada ataque,
// contra-ataque e do desfecho. O desenho transforma esse roteiro em animações
// CSS/SMIL com atrasos tirados do relógio, como o resto da cena, então um
// redesenho no meio da luta continua do mesmo ponto. Ritmo de previa_luta.py
// (quadros de 70 ms).
import { META } from './arte'
import { ANDAR, type Doc, PARADA, type Q, art, esc, mod, r, sorteio } from './base'
import type { Caminho, Golpe, Luta, TipoTrofeu } from '../types'
import { t } from './t'

/** Um quadro do roteiro (como em previa_luta.py). */
export const F = 70
/** O monstro entra pela direita enquanto a Lua ainda anda. */
export const ENTRA = 10 * F
/** "!" sobre a Lua, já parada. */
const EXCL = 8 * F
export const PRIMEIRO_ATAQUE = ENTRA + EXCL
/** Ataque: preparar 3, balançar 3, soltar 6 (a estrela sai), recuperar 6. */
const ATAQUE = 18 * F
const VOO_DE = 6 * F
const VOO_ATE = 14 * F
/** Depois de 2 quadros de "congelado" (pausa de impacto), o golpe. */
const IMPACTO = 16 * F
const CONTRA = 14 * F
/** Uma ferramenta nova até 1,5 s depois da última entra na mesma luta. */
export const JUNTA_MS = 1500
/** XP a mais por vencer um elite. */
export const ELITE_XP = 10
export const DESFAZ = 22 * F
const ATE_VITORIA = 12 * F
const VITORIA = 22 * F
const SAIDA = 8 * F
/** Elite: o troféu aparece no lugar do Golem (quando ele já quase sumiu)... */
const TROFEU_DE = 10 * F
/** ...fica parado no chão este tempo, para ser visto... */
export const TROFEU_MS = 3000
/** ...e se desfaz em pixels como o Golem. */
const TROFEU_ATE = TROFEU_DE + TROFEU_MS + DESFAZ

// ---------------------------------------------------------------- monstros

type Personagens = Record<string, { personagens: readonly { personagem: string }[] }>
const PAPEIS = META.monstros.monstros as unknown as Personagens
const CHEFOES = META.chefoes as unknown as Record<string, { espelhar: boolean; arena: string }>

const EDITAR = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit', 'TodoWrite', 'TaskCreate', 'TaskUpdate']
const TERMINAL = ['Bash', 'BashOutput', 'KillShell', 'KillBash', 'PowerShell', 'Monitor', 'TaskStop']
const WEB = ['WebSearch', 'WebFetch']
const SUBAGENTE = ['Agent', 'Task', 'SendMessage']

/** Que papel de monstro uma ferramenta chama (o resto: o mais próximo, ler). */
export function papelDe(tool: string): string {
  if (tool.startsWith('mcp__')) {
    return 'integracao'
  }
  if (EDITAR.includes(tool)) {
    return 'editar'
  }
  if (TERMINAL.includes(tool)) {
    return 'terminal'
  }
  if (WEB.includes(tool)) {
    return 'web'
  }
  if (SUBAGENTE.includes(tool)) {
    return 'subagente'
  }
  // Read, Glob, Grep, ToolSearch, Skill... e o que não tem papel próprio
  return 'ler'
}

/** O personagem da vez de um papel: quando há dois, eles se alternam a cada luta. */
export function personagemDe(papel: string, vez: number): string {
  const ps = (PAPEIS[papel] ?? PAPEIS['ler'])?.personagens ?? []
  return ps[vez % Math.max(1, ps.length)]?.personagem ?? 'vespera'
}

export type MonstroInfo = { w: number; h: number; espelhar: boolean; abreArena: boolean }

export function monstroInfo(nome: string): MonstroInfo {
  const a = art(`m_${nome}`)
  return { w: a.w, h: a.h, espelhar: CHEFOES[nome]?.espelhar ?? true, abreArena: a.h > META.monstros.janela_compacta_px }
}

// ---------------------------------------------------------------- elite

/** O monstro elite (erro consertado): sempre o Golem de Obsidiana. */
export const ELITE = 'golem_obsidiana'

/**
 * O alvo de uma ação, para reconhecer "a mesma ação" depois de um erro: o
 * comando no Bash, o arquivo no Edit/Write/Read, a URL no WebFetch. As outras
 * ferramentas não viram elite (null).
 */
export function alvoDe(tool: string, input: unknown): string | null {
  const i = (input ?? {}) as Record<string, unknown>
  const campo = tool === 'Bash' ? 'command' : tool === 'WebFetch' ? 'url' : ['Edit', 'Write', 'Read', 'MultiEdit', 'NotebookEdit'].includes(tool) ? (tool === 'NotebookEdit' ? 'notebook_path' : 'file_path') : null
  const v = campo === null ? undefined : i[campo]
  return typeof v === 'string' && v.trim() !== '' ? `${tool}|${v.trim()}` : null
}

/** Que troféu uma ação consertada dá (pela chave `ferramenta|alvo` de alvoDe). */
export function tipoTrofeu(chave: string): TipoTrofeu {
  const tool = chave.split('|')[0] ?? ''
  return tool === 'Bash' ? 'comando' : tool === 'Read' ? 'leitura' : tool === 'WebFetch' ? 'web' : 'edicao'
}

export const TIPOS_TROFEU: readonly TipoTrofeu[] = ['comando', 'edicao', 'leitura', 'web']

/** As letras que a Silkscreen embutida tem (o resto vira espaço). */
const LETRAS = /[^ -~áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÇ·–—…]/g
/** Até quantas letras o troféu mostra (a plaquinha cabe sobre o Golem). */
export const TROFEU_MAX = 24

/**
 * O nome do erro, curto, para o troféu: a primeira linha que diz alguma coisa
 * (pula "Exit code N", marcas como <tool_use_error> e o prefixo "Error:").
 */
export function nomeDoErro(texto: string | undefined): string {
  const linhas = (texto ?? '')
    .replace(/<\/?[a-z_]+>/gi, ' ')
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*(error|erro|fatal)\s*:\s*/i, '').trim())
    .filter(l => l !== '' && !/^exit code \d+$/i.test(l))
  let nome = (linhas[0] ?? t('luta.erro_misterioso')).replace(LETRAS, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
  if (nome === '') {
    nome = t('luta.erro_misterioso')
  }
  return nome.length > TROFEU_MAX ? `${nome.slice(0, TROFEU_MAX - 1).trimEnd()}…` : nome
}

// ---------------------------------------------------------------- sprite

/** Quanto dura cada quadro do giro da teia da Vespera. */
const TEIA_MS = 150

/**
 * O corpo de um monstro (sem posição nem espelho). A Vespera vem sem a teia
 * fixa, com as teias girando nos centros de `teia.json` (4 quadros).
 */
export function corpoMonstro(d: Doc, nome: string, agora: number): string {
  if (nome !== 'vespera') {
    return `<use href="${d.img(`m_${nome}`)}"/>`
  }
  const teia = META.teia as unknown as { centro_da_teia_no_png: readonly number[]; quadros_giro: number; teias_por_vista: Record<string, readonly (readonly number[])[]> }
  const centros = teia.teias_por_vista[CHEFOES['vespera']?.arena ?? 'vespera_02.png'] ?? []
  const [cx, cy] = teia.centro_da_teia_no_png as [number, number]
  const n = teia.quadros_giro
  const total = n * TEIA_MS
  // um quadro por vez: cada um aparece na sua fatia do ciclo (opacidade, para
  // não vazar quando o monstro está escondido por uma janela)
  const quadros = Array.from({ length: n }, (_, k) => {
    const de = ((k / n) * 100).toFixed(2)
    const ate = (((k + 1) / n) * 100).toFixed(2)
    const kf = k === 0 ? `0%{opacity:1}${ate}%{opacity:0}100%{opacity:0}` : `0%{opacity:0}${de}%{opacity:1}${ate}%{opacity:0}100%{opacity:0}`
    return d.anim(kf, total, 'step-end', -mod(agora, total), 'infinite')
  })
  let s = `<use href="${d.img('vespera_sem_teia')}"/>`
  centros.forEach(([x, y], j) => {
    // a segunda teia gira meio ciclo atrás da primeira
    const giro = quadros.map((_, k) => `<use href="${d.img(`teia_${k}`)}" class="${quadros[(k + 2 * j) % n]}"/>`).join('')
    s += `<g transform="translate(${(x as number) - cx},${(y as number) - cy})">${giro}</g>`
  })
  return s
}

/** Dano do golpe, tirado do tamanho do resultado (só para variar o número). */
export function danoDe(texto: string | undefined): number {
  return 5 + Math.round(Math.log2((texto?.length ?? 0) + 1) * 2)
}

// ---------------------------------------------------------------- roteiro

export type Ataque = { a: number; golpe: Golpe | null; canal: number | null }
export type Contra = { c: number; dano: number }
export type Desfecho = { tipo: 'vitoria' | 'fuga'; d: number }
export type Roteiro = {
  ataques: Ataque[]
  contras: Contra[]
  /** Quando a Lua fica livre depois do último golpe. */
  livre: number
  /** Ainda há ferramenta rodando: a Lua canaliza a partir de `livre`. */
  canalAberto: boolean
  desfecho: Desfecho | null
  /** Quando a luta acaba e a Lua volta a andar (desconhecido enquanto não se decide). */
  fim: number | null
  xp: number
  /**
   * Golpe no chefão de lista em que só o escudo apanhou (nenhuma tarefa
   * concluída, sem crítico): a luta termina sem comemoração, a Lua fica em
   * dúvida com o "?" azul.
   */
  defendida: boolean
}

export function roteiro(l: Luta): Roteiro {
  const golpes = [...l.golpes].sort((a, b) => a.at - b.at)
  const ataques: Ataque[] = []
  const contras: Contra[] = []
  let livre = l.t0 + PRIMEIRO_ATAQUE
  const poe = (a: number, golpe: Golpe | null, canal: number | null) => {
    ataques.push({ a, golpe, canal })
    livre = a + ATAQUE
    if (golpe !== null && !golpe.ok) {
      contras.push({ c: livre, dano: 1 + (golpe.dano % 9) })
      livre += CONTRA
    }
  }
  // O primeiro ataque sai sempre; ele resolve a primeira ferramenta se ela
  // voltou antes de a estrela chegar ao monstro.
  let i = 0
  const g0 = golpes[0]
  if (g0 !== undefined && g0.at <= livre + VOO_ATE) {
    poe(livre, g0, null)
    i = 1
  } else {
    poe(livre, null, null)
  }
  // Cada resultado seguinte é um golpe; se ele demora, a Lua canaliza até lá.
  for (; i < golpes.length; i++) {
    const g = golpes[i] as Golpe
    if (g.at > livre) {
      poe(g.at, g, livre)
    } else {
      poe(livre, g, null)
    }
  }
  const canalAberto = l.ativas > 0
  const xp = golpes.filter(g => g.ok).length * 2 + (l.trofeu !== undefined ? ELITE_XP : 0)
  let desfecho: Desfecho | null = null
  let fim: number | null = null
  const ult = golpes[golpes.length - 1]
  if (!canalAberto && l.fecha !== undefined && ult !== undefined) {
    const d = Math.max(livre, l.fecha)
    if (ult.ok) {
      desfecho = { tipo: 'vitoria', d }
      fim = d + Math.max(ATE_VITORIA + VITORIA, l.trofeu !== undefined ? TROFEU_ATE : 0)
    } else {
      desfecho = { tipo: 'fuga', d }
      fim = d + SAIDA
    }
  }
  const defendida = desfecho?.tipo === 'vitoria' && l.fixo === true && l.final !== true &&
    golpes.some(g => g.escudo !== undefined) && !golpes.some(g => g.tarefa !== undefined || g.critico !== undefined)
  return { ataques, contras, livre, canalAberto, desfecho, fim, xp, defendida }
}

/** Quando a estrela do golpe que voltou em `at` acerta o monstro (o instante do impacto). */
export function quandoAcerta(l: Luta, at: number): number {
  const a = roteiro(l).ataques.find(x => x.golpe?.at === at)
  return a === undefined ? at : a.a + IMPACTO
}

/**
 * O golpe crítico de uma luta (o que derruba o chefão): o marcado pela lista
 * de tarefas, ou o último ataque da luta final. -1 se não há.
 */
export function ataqueCritico(l: Luta, rt: Roteiro = roteiro(l)): number {
  if (l.final !== true) {
    return -1
  }
  const k = rt.ataques.findIndex(a => a.golpe?.critico !== undefined)
  return k >= 0 ? k : rt.ataques.length - 1
}

/** A luta que está na tela agora (a primeira que ainda não acabou). */
export function lutaDaVez(lista: readonly Luta[], agora: number): Luta | undefined {
  return lista.find(l => (roteiro(l).fim ?? Infinity) > agora)
}

/**
 * Uma pose da Lua num trecho da luta. `entrada` é andar (ou parada, se ela não
 * vinha andando) enquanto o monstro chega.
 */
export type Pose = { de: number; ate: number; nome: 'entrada' | 'lua_parada' | 'lua_ataque' | 'lua_canalizar' | 'lua_dano' | 'lua_vitoria' | 'lua_duvida'; qs: readonly Q[]; desde: number; repete: boolean }

const QS_ATAQUE: Q[] = [[0, 3 * F], [1, 3 * F], [2, 6 * F], [3, 6 * F]]
const QS_CANAL: Q[] = [[0, 4 * F], [1, 4 * F]]
/** Dúvida (o escudo defendeu): coça a cabeça, "hmm", e de novo. */
const QS_DUVIDA: Q[] = [[0, 7 * F], [1, 7 * F]]
/** Onde a gota de suor fica no quadro da Lua (80x100): borda do rosto, ao lado do olho. */
const GOTA = [51, 28] as const

/** A Lua na luta, trecho a trecho, do começo ao fim (entre uma ação e outra, parada). */
export function posesDaLua(l: Luta, rt: Roteiro = roteiro(l)): Pose[] {
  const acoes: Pose[] = []
  for (const a of rt.ataques) {
    if (a.canal !== null) {
      acoes.push({ de: a.canal, ate: a.a, nome: 'lua_canalizar', qs: QS_CANAL, desde: a.canal, repete: true })
    }
    acoes.push({ de: a.a, ate: a.a + ATAQUE, nome: 'lua_ataque', qs: QS_ATAQUE, desde: a.a, repete: false })
  }
  for (const c of rt.contras) {
    acoes.push({ de: c.c + 4 * F, ate: c.c + CONTRA, nome: 'lua_dano', qs: [[0, 4 * F], [1, 6 * F]], desde: c.c + 4 * F, repete: false })
  }
  if (rt.canalAberto) {
    acoes.push({ de: rt.livre, ate: Infinity, nome: 'lua_canalizar', qs: QS_CANAL, desde: rt.livre, repete: true })
  }
  if (rt.desfecho?.tipo === 'vitoria') {
    const v = rt.desfecho.d + ATE_VITORIA
    acoes.push(rt.defendida
      ? { de: v, ate: v + VITORIA, nome: 'lua_duvida', qs: QS_DUVIDA, desde: v, repete: true }
      : { de: v, ate: v + VITORIA, nome: 'lua_vitoria', qs: [[0, 4 * F], [1, 18 * F]], desde: v, repete: false })
  }
  acoes.sort((a, b) => a.de - b.de)
  const ent = l.t0 + ENTRA
  const poses: Pose[] = [{ de: -Infinity, ate: ent, nome: 'entrada', qs: ANDAR, desde: 0, repete: true }]
  const parada = (de: number, ate: number): Pose => ({ de, ate, nome: 'lua_parada', qs: PARADA, desde: 0, repete: true })
  let t = ent
  for (const a of acoes) {
    if (a.de > t) {
      poses.push(parada(t, a.de))
    }
    poses.push(a)
    t = Math.max(t, a.ate)
  }
  if (t < Infinity) {
    poses.push(parada(t, Infinity))
  }
  return poses
}

/**
 * Instantes em que o mod redesenha a luta. Cada desenho só leva a arte da
 * Lua até o próximo marco (o SVG tem limite de tamanho), então todo começo de
 * pose é um marco.
 */
export function marcos(l: Luta): number[] {
  const rt = roteiro(l)
  const m = [l.t0]
  for (const p of posesDaLua(l, rt)) {
    if (Number.isFinite(p.de)) {
      m.push(p.de)
    }
  }
  if (rt.desfecho !== null) {
    m.push(rt.desfecho.d)
    if (rt.desfecho.tipo === 'vitoria' && l.trofeu !== undefined) {
      m.push(rt.desfecho.d + TROFEU_DE, rt.desfecho.d + TROFEU_DE + TROFEU_MS)
    }
  }
  if (rt.fim !== null) {
    m.push(rt.fim)
  }
  return m
}

// ---------------------------------------------------------------- desenho

export type Palco = {
  W: number
  /** Linha dos pés na cena. */
  pes: number
  agora: number
  caminho: Caminho
  /** Até quando desenhar as poses da Lua (padrão: o próximo marco). */
  horizonte?: number
  /** Sem a tira de andar na entrada (quando o SVG não cabe). */
  economia?: boolean
}

/** Deslocamentos quadro a quadro somados (recuo, tremor, investida...). */
type Efeito = { de: number; dx: readonly number[]; fica?: boolean }

function trilhaX(efs: readonly Efeito[], eixo: 'X' | 'Y' = 'X'): [number, string][] {
  const tempos = new Set<number>()
  for (const e of efs) {
    for (let k = 0; k <= e.dx.length; k++) {
      tempos.add(e.de + k * F)
    }
  }
  const valor = (t: number) => {
    let v = 0
    for (const e of efs) {
      const k = Math.floor((t - e.de) / F)
      if (k >= 0 && k < e.dx.length) {
        v += e.dx[k] as number
      } else if (k >= e.dx.length && e.fica === true) {
        v += e.dx[e.dx.length - 1] as number
      }
    }
    return v
  }
  return [...tempos].sort((a, b) => a - b).map(t => [t, `translate${eixo}(${valor(t)}px)`])
}

/** Um sprite numa cor só, ou tingido (o piscar de quando leva golpe). */
function tinta(d: Doc, id: string, cor: readonly [number, number, number], forca: number): string {
  const k = 1 - forca
  const [cr, cg, cb] = cor.map(c => ((c / 255) * forca).toFixed(3))
  return d.filtro(id, `<feColorMatrix type="matrix" values="${k} 0 0 0 ${cr} 0 ${k} 0 0 ${cg} 0 0 ${k} 0 ${cb} 0 0 0 1 0"/>`)
}

/** Números em pixel art (dígitos da arte, 4 px de passo), em escala 2 (ou a pedida). */
function numero(d: Doc, txt: string, cor: 'dano' | 'xp', esc = 2): { svg: string; w: number } {
  const nome = (c: string) => (c === '-' ? 'menos' : c === '+' ? 'mais' : c)
  let s = ''
  for (let i = 0; i < txt.length; i++) {
    s += `<use href="${d.img(`${cor}_${nome(txt[i] as string)}`)}" x="${i * 4}"/>`
  }
  const w = 4 * (txt.length - 1) + 5
  return { svg: `<g transform="scale(${esc})">${s}</g>`, w: w * esc }
}

/** Sobe `px` por quadro durante `n` quadros a partir de `de`. */
function subindo(de: number, n: number, px: number): [number, string][] {
  return Array.from({ length: n }, (_, k) => [de + k * F, `translateY(${-k * px}px)`] as [number, string])
}

/** Tremor da cena inteira no golpe crítico (deslocamentos quadro a quadro). */
const TREMOR: readonly (readonly [number, number])[] = [[3, 1], [-3, -1], [2, -2], [-2, 2], [2, 1], [-1, -1], [1, 0], [0, 0]]

export type DesenhoLuta = { monstro: string; luaCorpo: string; luaTrilha: [number, string][]; efeitos: string; tremor: [number, string][] }

export function desenharLuta(d: Doc, l: Luta, p: Palco): DesenhoLuta {
  const rt = roteiro(l)
  const { W, pes, agora } = p
  const mi = monstroInfo(l.monstro)
  const mx = W - 90 - mi.w
  const my = pes - mi.h
  const lx = 40
  const ly = pes - 96
  const centro = lx + 40
  const cabeca = ly + 96 - 83
  const ax = mx + Math.floor(mi.w / 3)
  const ay = pes - Math.floor(mi.h / 2)
  const ent = l.t0 + ENTRA
  const fim = rt.fim ?? Infinity
  // o que começa depois do próximo marco fica para o próximo desenho
  const horizonte = p.horizonte ?? Math.min(...marcos(l).filter(t => t > agora), Infinity)
  const cabe = (t: number) => t <= horizonte
  const branco = d.filtro('fb', '<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/>')

  // ------------------------------------------------ monstro
  const longe = W + 4 - mx
  // golpe no chefão: ele já está em cena, não entra nem foge
  const fixo = l.fixo === true
  const desfaz = rt.desfecho?.tipo === 'vitoria' && (!fixo || l.final === true)
  const kc = ataqueCritico(l, rt)
  const efs: Efeito[] = fixo ? [] : [{ de: l.t0, dx: Array.from({ length: 10 }, (_, k) => r(longe * (1 - k / 10))) }]
  rt.ataques.forEach((a, k) => {
    const i = a.a + IMPACTO
    if (a.golpe?.escudo !== undefined) {
      // defendeu: só um tranco curto
      efs.push({ de: i, dx: [2, 1, -1, 1, 0] })
    } else {
      // crítico: recuo maior
      const forte = k === kc ? 12 : 6
      efs.push({ de: i, dx: Array.from({ length: forte + 2 }, (_, q) => Math.max(0, forte - q) + (q % 2 === 1 ? 1 : -1)) })
    }
  })
  for (const c of rt.contras) {
    efs.push({ de: c.c, dx: [0, -6, -14, -22, -24, -20, -14, -8, -3, 0] })
  }
  if (rt.desfecho?.tipo === 'fuga' && !fixo) {
    efs.push({ de: rt.desfecho.d, dx: Array.from({ length: 8 }, (_, k) => r(((k + 1) / 8) * longe)), fica: true })
  }
  const corpo0 = corpoMonstro(d, l.monstro, agora)
  const vira = mi.espelhar ? ` transform="translate(${mi.w},0) scale(-1,1)"` : ''
  const sprite = (filtro?: string) => `<g${vira}>${filtro !== undefined ? `<g filter="${filtro}">${corpo0}</g>` : corpo0}</g>`
  const fimNormal = desfaz && rt.desfecho !== null ? rt.desfecho.d : fim
  const respira = d.anim('0%{transform:translateY(0)}50%{transform:translateY(-1px)}100%{transform:translateY(0)}', 16 * F, 'step-end', -(agora % (16 * F)), 'infinite')
  let corpoM = d.janela(l.t0, fimNormal, agora, `<g class="${respira}">${sprite()}</g>`)
  const vermelho = tinta(d, 'fv', [255, 80, 80], 0.45)
  rt.ataques.forEach((a, k) => {
    const i = a.a + IMPACTO
    if (a.golpe?.escudo !== undefined) {
      // o escudo segura: só um lampejo branco curto, sem vermelho
      corpoM += d.janela(i, i + F, agora, sprite(branco))
    } else if (k === kc) {
      // crítico: pausa de impacto maior (fica branco mais tempo) e vermelho depois
      corpoM += d.janela(i - 3 * F, i + 3 * F, agora, sprite(branco))
      corpoM += d.janela(i + 3 * F, i + 6 * F, agora, sprite(vermelho))
    } else {
      corpoM += d.janela(i - 2 * F, i + F, agora, sprite(branco))
      corpoM += d.janela(i + F, i + 3 * F, agora, sprite(vermelho))
    }
  })
  let poeira = ''
  if (desfaz && rt.desfecho !== null && rt.desfecho.d + DESFAZ > agora && cabe(rt.desfecho.d)) {
    const dz = rt.desfecho.d
    corpoM += d.janela(dz, dz + DESFAZ, agora, d.pista(subindo(dz, 11, 1).map(([t, tr], k) => [t + k * F, tr]), agora, sprite(desfazer(d, l.n, dz, agora))))
    // estrelinhas e faíscas subindo de dentro do monstro
    const rnd = sorteio(l.n * 31 + 7)
    for (let j = 0; j < 6; j++) {
      const fx = mx + Math.floor(rnd() * (mi.w - 6))
      const fy = my + Math.floor(rnd() * (mi.h - 6))
      const vx = Math.floor(rnd() * 5) - 2
      const de = dz + j * 2 * F
      const pts: [number, string][] = Array.from({ length: 7 }, (_, k) => [de + k * 3 * F, `translate(${vx * k}px,${-4 * k}px)`])
      const nome = j % 2 === 0 ? 'p_faisca' : 'p_estrela'
      const q = (art(nome)['q'] as number) ?? 5
      const ms = (art(nome)['ms'] as number) ?? 80
      poeira += d.janela(de, de + DESFAZ - j * F, agora, d.pista(pts, agora, d.tira(nome, fx, fy, q, q, [[0, ms], [1, ms], [2, ms], [3, ms]], agora)))
    }
  }
  // elite: o troféu (desenho do tipo da ação consertada) só aparece quando ele cai
  const placa = ''
  const trofeu = l.trofeu !== undefined ? `trofeu_${l.trofeuTipo ?? 'edicao'}_grande` : null
  const monstro = `<g transform="translate(${mx},${my})">${d.pista(trilhaX(efs), agora, corpoM + placa)}</g>` + poeira

  // ------------------------------------------------ Lua
  // Só as poses que começam antes do próximo marco (o mod redesenha nele);
  // se o redesenho atrasar, ela fica parada respirando até lá.
  const poses = posesDaLua(l, rt)
  const c = p.caminho
  const andava = c.andando && c.ate !== undefined && p.economia !== true
  let luaCorpo = ''
  let coberto = -Infinity
  for (const ps of poses) {
    if (ps.ate <= agora || ps.de >= horizonte) {
      continue
    }
    let corpo: string
    if (ps.nome === 'entrada') {
      corpo = andava ? d.tira('lua_andar', 0, 0, 80, 100, ANDAR, agora - c.desde) : d.tira('lua_parada', 0, 0, 80, 100, PARADA, agora)
    } else {
      corpo = d.tira(ps.nome, 0, 0, 80, 100, ps.qs, agora - ps.desde, ps.repete)
    }
    if (ps.nome === 'lua_canalizar') {
      // círculo mágico girando aos pés (atrás da Lua)
      corpo = d.tira('canalizar', 20, 88, 41, 11, [[0, 120], [1, 120], [2, 120], [3, 120]], agora - ps.desde) + corpo
    }
    luaCorpo += d.janela(ps.de, ps.ate, agora, corpo)
    coberto = ps.ate
  }
  if (coberto < Infinity) {
    luaCorpo += d.janela(Math.max(coberto, -Infinity), Infinity, agora, d.tira('lua_parada', 0, 0, 80, 100, PARADA, agora))
  }
  // piscar vermelho/branco quando leva o contra-ataque
  const verm = tinta(d, 'fl', [255, 60, 60], 0.55)
  const luaEfs: Efeito[] = []
  for (const cc of rt.contras) {
    const b = cc.c + 4 * F
    if (b + 3 * F > agora) {
      const q0 = (f: string) => `<g filter="${f}">${d.tira('lua_dano', 0, 0, 80, 100, [[0, 1]], 0)}</g>`
      luaCorpo += d.janela(b, b + F, agora, q0(branco)) + d.janela(b + F, b + 2 * F, agora, q0(verm)) + d.janela(b + 2 * F, b + 3 * F, agora, q0(branco))
    }
    luaEfs.push({ de: b, dx: [-4, -3, -2, -1, 0, 0, 0, 0] })
  }

  // ------------------------------------------------ efeitos
  let efeitos = ''
  // "!" sobre a Lua: um pulinho nos 2 primeiros quadros
  const ex = d.img('exclamacao')
  efeitos += d.janela(ent, ent + 2 * F, agora, `<use href="${ex}" x="${centro - 5}" y="${cabeca - 20}"/>`)
  efeitos += d.janela(ent + 2 * F, ent + EXCL, agora, `<use href="${ex}" x="${centro - 5}" y="${cabeca - 18}"/>`)
  const sx = lx + 79
  const sy = ly + 53
  rt.ataques.forEach((a, n) => {
    const i = a.a + IMPACTO
    // estrela em arco até o monstro, com faíscas no rastro
    if (a.a + VOO_ATE + 3 * F > agora && cabe(a.a)) {
      const pts: [number, string][] = Array.from({ length: 8 }, (_, k) => {
        const f = k / 8
        const x = sx + (ax - sx) * f
        const y = sy + (ay - sy) * f - 10 * Math.sin(Math.PI * f)
        return [a.a + VOO_DE + k * F, `translate(${r(x)}px,${r(y)}px)`] as [number, string]
      })
      for (const j of [2, 1]) {
        const pj = pts.map(([tt, tr]) => [tt + j * F, tr] as [number, string])
        efeitos += d.janela(a.a + VOO_DE + j * F, a.a + VOO_ATE + j * F, agora, d.pista(pj, agora, d.tira('p_faisca', -2 - j, -2, 5, 5, [[0, 80], [1, 80], [2, 80], [3, 80]], agora)))
      }
      efeitos += d.janela(a.a + VOO_DE, a.a + VOO_ATE, agora, d.pista(pts, agora, d.tira('projetil', -5, -5, 11, 11, [[0, 60], [1, 60], [2, 60], [3, 60]], agora)))
    }
    const g = a.golpe
    const depoisDoCritico = kc >= 0 && n > kc
    if (g?.escudo !== undefined) {
      // golpe comum no chefão de lista: o escudo aparece no ponto do impacto,
      // solta 3 faíscas, e o número sai pequeno e cinza (às vezes 0)
      if (i + 12 * F > agora && cabe(a.a)) {
        const ms = (art('escudo')['ms'] as readonly number[] | undefined) ?? [90, 120, 120]
        const qs: Q[] = ms.map((m, q) => [q, m] as Q)
        const dur = ms.reduce((t, m) => t + m, 0)
        efeitos += d.janela(i, i + dur, agora, d.tira('escudo', ax - 24, ay - 19, 35, 38, qs, agora - i, false))
        for (let j = 0; j < 3; j++) {
          const pts: [number, string][] = Array.from({ length: 5 }, (_, q) => [i + q * F, `translate(${ax - 24 - q * (2 + j)}px,${ay - 12 + j * 10 + (j - 1) * q * 2}px)`])
          efeitos += d.janela(i + F, i + 6 * F, agora, d.pista(pts, agora, d.tira('p_faisca', -2, -2, 5, 5, [[0, 80], [1, 80], [2, 80], [3, 80]], agora)))
        }
        const num = numero(d, g.escudo > 0 ? `-${g.escudo}` : '0', 'dano', 1)
        // cinza: escurece só o branco (o contorno escuro dos dígitos continua escuro)
        const cinza = d.filtro('fc', '<feColorMatrix type="matrix" values="0.66 0 0 0 0 0 0.66 0 0 0 0 0 0.74 0 0 0 0 0 1 0"/>')
        const ny = Math.max(my - 4, 30)
        efeitos += d.janela(i + F, i + 12 * F, agora, `<g transform="translate(${r(mx + mi.w / 2 - num.w / 2)},${ny})" filter="${cinza}">${d.pista(subindo(i + F, 11, 1), agora, num.svg)}</g>`)
      }
    } else if (n === kc) {
      // golpe crítico: explosão, número grande dourado e "CRÍTICO!" em vermelho (escolha do usuário) (estrelas em volta passavam do limite na Vespera)
      if (i + 22 * F > agora && cabe(a.a)) {
        efeitos += d.janela(i, i + 6 * 55, agora, d.tira('impacto', ax - 15, ay - 15, 31, 31, [0, 1, 2, 3, 4, 5].map(q => [q, 55] as const), agora - i, false))
        const valor = g?.critico ?? critico1(g?.dano ?? 0)
        const num = numero(d, `-${valor}`, 'xp', 3)
        const cx = r(Math.min(Math.max(mx + mi.w / 2, num.w / 2 + 4), W - num.w / 2 - 4))
        const ny = Math.max(ay - 16, 44)
        const txt = `<text class="t m" x="${cx}" y="${ny - 6}" style="font-size:16px;fill:#ff3b4e">${esc(t('luta.critico'))}</text>`
        efeitos += d.janela(i + 2 * F, i + 22 * F, agora, d.pista(subindo(i + 2 * F, 20, 1), agora, txt + `<g transform="translate(${r(cx - num.w / 2)},${ny})">${num.svg}</g>`))
      }
    } else if (i + 14 * F > agora && cabe(a.a)) {
      // explosão + número de dano subindo (depois do crítico, só a explosão)
      efeitos += d.janela(i, i + 6 * 55, agora, d.tira('impacto', ax - 15, ay - 15, 31, 31, [0, 1, 2, 3, 4, 5].map(q => [q, 55] as const), agora - i, false))
      if ((g === null || g.ok) && !depoisDoCritico) {
        const dano = g?.tarefa ?? g?.dano ?? 3 + ((l.t0 + n) % 7)
        const num = numero(d, `-${dano}`, 'dano')
        // sobe 26 px: começa baixo o bastante para não sair pelo topo da faixa
        const ny = Math.max(my - 6, 30)
        efeitos += d.janela(i, i + 14 * F, agora, `<g transform="translate(${r(mx + mi.w / 2 - num.w / 2)},${ny})">${d.pista(subindo(i, 14, 2), agora, num.svg)}</g>`)
      }
    }
  })
  // contra-ataque: número vermelho sobre a Lua (só visual)
  const nv = tinta(d, 'fn', [232, 72, 72], 0.85)
  for (const cc of rt.contras) {
    const b = cc.c + 4 * F
    if (b + 12 * F > agora && cabe(b)) {
      const num = numero(d, `-${cc.dano}`, 'dano')
      efeitos += d.janela(b, b + 12 * F, agora, `<g transform="translate(${centro - 6},${cabeca - 10})" filter="${nv}">${d.pista(subindo(b, 12, 2), agora, num.svg)}</g>`)
    }
  }
  // vitória: "+XP" dourado e estrelinhas em volta da Lua
  if (rt.defendida && rt.desfecho !== null) {
    // o escudo defendeu: "?" azul sobre a cabeça, com um pulinho como o "!"
    const v = rt.desfecho.d + ATE_VITORIA
    if (v + VITORIA > agora && cabe(v)) {
      const qq = d.img('interrogacao')
      efeitos += d.janela(v, v + 2 * F, agora, `<use href="${qq}" x="${centro - 5}" y="${cabeca - 20}"/>`)
      efeitos += d.janela(v + 2 * F, v + VITORIA - 2 * F, agora, `<use href="${qq}" x="${centro - 5}" y="${cabeca - 18}"/>`)
      // gota de suor (mangá) na borda do rosto, ao lado do olho: escorre 1 px
      // no ritmo dos quadros da dúvida
      const gt = d.img('gota')
      for (let k = 0, t = v; t < v + VITORIA; k++, t += QS_DUVIDA[0]![1]) {
        efeitos += d.janela(t, Math.min(t + QS_DUVIDA[0]![1], v + VITORIA), agora, `<use href="${gt}" x="${lx + GOTA[0]}" y="${ly + GOTA[1] + (k % 2)}"/>`)
      }
    }
  } else if (rt.desfecho?.tipo === 'vitoria') {
    const v = rt.desfecho.d + ATE_VITORIA
    if (v + 18 * F > agora && cabe(v)) {
      const num = numero(d, `+${rt.xp}XP`, 'xp')
      efeitos += d.janela(v, v + 18 * F, agora, `<g transform="translate(${centro - num.w / 2},${cabeca - 22})">${d.pista(subindo(v, 18, 1), agora, num.svg)}</g>`)
      for (let j = 0; j < 4; j++) {
        const pts: [number, string][] = Array.from({ length: 9 }, (_, k) => {
          const ang = (2 * k) / 3 + (j * Math.PI) / 2
          return [v + 2 * k * F, `translate(${centro + r(30 * Math.cos(ang)) - 3}px,${cabeca + 30 + r(16 * Math.sin(ang))}px)`] as [number, string]
        })
        efeitos += d.janela(v, v + 18 * F, agora, d.pista(pts, agora, d.tira('p_estrela', 0, 0, 7, 7, [[0, 220], [1, 220], [2, 220], [3, 220]], agora + j * 220)))
      }
    }
  }
  if (trofeu !== null && rt.desfecho?.tipo === 'vitoria') {
    // o Golem se desfaz e o troféu (tamanho nativo) fica no lugar dele, no chão:
    // cai 6 px piscando branco, quica, brilha um tempo e se desfaz em pixels
    const t1 = rt.desfecho.d + TROFEU_DE
    const t2 = t1 + TROFEU_MS
    if (rt.desfecho.d + TROFEU_ATE > agora && cabe(t1)) {
      const tw = art(trofeu)['w'] as number
      const th = art(trofeu)['h'] as number
      const gx = r(mx + mi.w / 2 - tw / 2)
      const gy = pes - th
      const fig = `<use href="${d.img(trofeu)}" x="${gx}" y="${gy}"/>`
      const pts: [number, string][] = [
        [t1, 'translate(0px,-6px)'],
        [t1 + F, 'translate(0px,-3px)'],
        [t1 + 2 * F, 'translate(0px,0px)'],
        [t1 + 3 * F, 'translate(0px,-1px)'],
        [t1 + 4 * F, 'translate(0px,0px)'],
      ]
      let corpoT = d.janela(t1, t1 + 2 * F, agora, `<g filter="${branco}">${fig}</g>`)
      corpoT += d.janela(t1 + 2 * F, t2, agora, fig)
      if (t2 + DESFAZ > agora && cabe(t2)) {
        corpoT += d.janela(t2, t2 + DESFAZ, agora, `<g filter="${desfazer(d, l.n + 5000, t2, agora)}">${fig}</g>`)
      }
      efeitos += d.janela(t1, t2 + DESFAZ, agora, d.pista(pts, agora, corpoT))
      // "+TROFÉU" sobre ele e estrelinhas piscando em volta
      const txt = `<text class="t m" x="${r(mx + mi.w / 2)}" y="${gy - 8}" style="fill:#ffe27a">${esc(t('luta.trofeu'))}</text>`
      efeitos += d.janela(t1 + 2 * F, t2, agora, d.pista(subindo(t1 + 2 * F, 4, 1), agora, txt))
      const cantos: [number, number][] = [[-10, 6], [tw + 3, 14], [-6, th - 22], [tw - 1, th - 30]]
      cantos.forEach(([ex, ey], j) => {
        efeitos += d.janela(t1 + (2 + j) * F, t2, agora, d.tira('p_estrela', gx + ex, gy + ey, 7, 7, [[0, 180], [1, 180], [2, 180], [3, 180]], agora + j * 260))
      })
    }
  }
  // a cena treme no golpe crítico
  const ac = rt.ataques[kc]
  const tremor: [number, string][] = []
  if (ac !== undefined) {
    const i = ac.a + IMPACTO
    if (i + TREMOR.length * F > agora && cabe(ac.a)) {
      TREMOR.forEach(([x, y], q) => tremor.push([i + q * F, `translate(${x}px,${y}px)`]))
      tremor.unshift([i - F, 'translate(0px,0px)'])
    }
  }
  return { monstro, luaCorpo, luaTrilha: trilhaX(luaEfs), efeitos, tremor }
}

/** O crítico do chefão sem lista (1 de vida antes do golpe final). */
function critico1(dano: number): number {
  return 9 + (dano % 9)
}

/**
 * O monstro se desfaz em pixels: um ruído decide a ordem em que cada pixel
 * some, e um limite que sobe com o tempo (SMIL) vai apagando, mais claro.
 */
export function desfazer(d: Doc, n: number, de: number, agora: number): string {
  const id = `fz${n}`
  const durS = DESFAZ / 1000
  const iniS = (de - agora) / 1000
  const A = -4
  const B = -26
  let intercept = A
  let anim = ''
  if (iniS >= 0) {
    anim = `<animate attributeName="intercept" from="${A}" to="${B}" begin="${iniS.toFixed(2)}s" dur="${durS}s" fill="freeze"/>`
  } else {
    const p = Math.min(1, -iniS / durS)
    intercept = A + (B - A) * p
    if (p < 1) {
      anim = `<animate attributeName="intercept" from="${intercept.toFixed(2)}" to="${B}" begin="0s" dur="${(durS * (1 - p)).toFixed(2)}s" fill="freeze"/>`
    }
  }
  return d.filtro(
    id,
    `<feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="1" seed="${n % 97}" result="ru"/>` +
      `<feColorMatrix in="ru" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="al"/>` +
      `<feComponentTransfer in="al" result="ma"><feFuncA type="linear" slope="30" intercept="${intercept.toFixed(2)}">${anim}</feFuncA></feComponentTransfer>` +
      `<feComposite in="SourceGraphic" in2="ma" operator="in" result="so"/>` +
      `<feColorMatrix in="so" type="matrix" values="1 0 0 0 0.22 0 1 0 0 0.22 0 0 1 0 0.3 0 0 0 1 0"/>`,
  )
}
