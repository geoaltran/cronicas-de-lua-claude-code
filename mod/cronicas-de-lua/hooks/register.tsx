import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit, Timer } from 'claude-code'

import type { Caminho, Chefao, Elite, Golpe, Hud, Jogo, Luta, Lutas, TipoTrofeu } from '../types'
import { LARGURA_MAX, LARGURA_MIN, type Alvo, balaoSolto, distancia, luar, medidaBalaoSolto, montar, nivelDe, regua } from './cena'
import { ELITE, ELITE_XP, ENTRA, JUNTA_MS, TIPOS_TROFEU, alvoDe, danoDe, lutaDaVez, marcos, nomeDoErro, papelDe, personagemDe, roteiro, tipoTrofeu } from './luta'
import { A_CADA, JORNADA, NOME_CHEFAO, QUEDA_MS, chefaoPeloNome, ferir, lerTarefas, novoChefao, paginasNoCiclo } from './chefao'

const PLUGIN = 'cronicas-de-lua'
/** O app desenha SVG de até 131.072 caracteres; uma margem para não arriscar. */
const LIMITE_SVG = 129_000

const JOGO0: Jogo = { xp: 0, paginas: 0, lutas: 0 }
const HUD0: Hud = { luz: null, mana: {}, mochila: null, jogo: JOGO0 }
const CAMINHO0: Caminho = { andando: false, desde: 0, dist0: 0 }
const LUTAS0: Lutas = { lista: [], vezes: {}, n: 0 }

// Mude a etiqueta quando o formato mudar: o valor antigo (que sobrevive ao
// recarregar o mod) passa a ser lido como o inicial.
const caminho = atom({ plugin: 'cronicas-de-lua', key: 'caminho' } as const, CAMINHO0, { shape: 'caminho-2' })
const lutas = atom({ plugin: 'cronicas-de-lua', key: 'lutas' } as const, LUTAS0, { shape: 'lutas-1' })
const turno = atom({ plugin: 'cronicas-de-lua', key: 'turno' } as const, false)
const hud = atom({ plugin: 'cronicas-de-lua', key: 'hud' } as const, HUD0, { shape: 'hud-1' })
const tique = atom({ plugin: 'cronicas-de-lua', key: 'tique' } as const, 0)
const confirma = atom({ plugin: 'cronicas-de-lua', key: 'confirma' } as const, false)
const chefao = atom({ plugin: 'cronicas-de-lua', key: 'chefao' } as const, null as Chefao | null, { shape: 'chefao-1' })
const ELITE0: Elite = { erros: {} }
const elite = atom({ plugin: 'cronicas-de-lua', key: 'elite' } as const, ELITE0, { shape: 'elite-1' })
/** Quantos erros de ações diferentes o elite lembra (os mais velhos saem). */
const ERROS_MAX = 20
/** Quantos troféus ficam guardados. */
const TROFEUS_MAX = 30

/** O chefão está de pé em cena (ainda não caiu). */
const dePe = (c: Chefao | null): c is Chefao => c !== null && c.caiu === undefined

/** Configuração da faixa, guardada entre sessões. */
type Ajustes = {
  escala: number
  pxColuna: number
  /** true: quadro interativo (balões no hover); false: imagem (só animação). */
  quadro: boolean
  /** Mostra os dois modos, um embaixo do outro, para comparar no app. */
  teste: boolean
  /** Mostra a régua de calibrar a largura embaixo da cena. */
  regua?: boolean
  /** Fase 4, prova técnica: áreas de hover e de clique do app por cima da cena. */
  prova?: boolean
  /** Altura de uma linha (célula) da faixa em px: as posições do app são em células. */
  pxLinha?: number
}
// 8,9 px por coluna: medido no app desktop (85 colunas = ~752 px), com uns px de folga
// 20 px por linha: medido no app desktop (print da prova técnica, 22/11/2026)
const AJUSTES0: Ajustes = { escala: 1, pxColuna: 8.9, quadro: false, teste: false, regua: false, prova: false, pxLinha: 20 }

type $ = EngineInterface

async function lerAjustes($: $): Promise<Ajustes> {
  const v = { ...((await $.store.get('ajustes')) as Partial<Ajustes> | undefined) }
  if (v.pxLinha === 18) {
    // 18 era o palpite da 1ª prova técnica, gravado junto com os ajustes; o medido é 20
    delete v.pxLinha
  }
  return { ...AJUSTES0, ...v }
}

function manaDe(limites: readonly SessionRateLimit[]): Hud['mana'] {
  const cinco = limites.find(l => l.kind === 'five_hour')
  const sete = limites.find(l => l.kind === 'seven_day')
  return {
    cinco: cinco?.percentUsed,
    cincoRenova: cinco?.resetsAt,
    sete: sete?.percentUsed,
    seteRenova: sete?.resetsAt,
  }
}

const mochilaDe = (c: SessionContextUsage): number | null => (c.percent === undefined ? null : c.percent)

async function salvarJogo($: $, jogo: Jogo): Promise<void> {
  await $.store.set('jogo', jogo)
}

async function ganharXp($: $, quanto: number): Promise<void> {
  let novo: Jogo = JOGO0
  await update($, hud, h => {
    novo = { ...h.jogo, xp: h.jogo.xp + quanto }
    return { ...h, jogo: novo }
  })
  await salvarJogo($, novo)
}

/** Colunas do último desenho da faixa (para calibrar a largura com /cronicas largura). */
let ultimasColunas = 0

// Um só alarme para "o luar acabou": redesenha a faixa (desmaio).
let alarme: Timer | undefined

async function marcarFimDoLuar($: $, restanteMs: number): Promise<void> {
  alarme?.cancel()
  alarme = $.clock.after(Math.max(0, restanteMs) + 400, () => {
    void update($, tique, n => n + 1)
  })
}

// ---------------------------------------------------------------- lutas

/**
 * Uma ferramenta começou: entra na luta aberta, ou começa uma nova (agora, ou
 * logo depois da que está acabando). Devolve o número da luta.
 */
function entrar(s: Lutas, agora: number, tool: string, ch: Chefao | null = null, trofeu?: string, trofeuTipo?: TipoTrofeu): { s: Lutas; n: number; nova: Luta | null } {
  // as que já acabaram ficam na lista até revisar() tirá-las (e devolver o caminho à Lua)
  const vivas = s.lista.filter(l => (roteiro(l).fim ?? Infinity) > agora)
  const ult = vivas[vivas.length - 1]
  if (ult !== undefined && ult.fecha === undefined) {
    return { s: { ...s, lista: s.lista.map(l => (l.n === ult.n ? { ...l, ativas: l.ativas + 1 } : l)) }, n: ult.n, nova: null }
  }
  const papel = papelDe(tool)
  const t0 = ult === undefined ? agora : Math.max(agora, roteiro(ult).fim ?? agora)
  if (dePe(ch)) {
    // com o chefão em cena, a ferramenta vira um golpe nele
    const nova: Luta = { n: s.n + 1, papel, monstro: ch.nome, t0, ativas: 1, golpes: [], fixo: true }
    return { s: { ...s, lista: [...s.lista, nova], n: nova.n }, n: nova.n, nova }
  }
  if (trofeu !== undefined) {
    // um erro foi consertado: esta luta é o elite, com o nome do erro como troféu
    const nova: Luta = { n: s.n + 1, papel: 'elite', monstro: ELITE, t0, ativas: 1, golpes: [], trofeu, trofeuTipo: trofeuTipo ?? 'edicao' }
    return { s: { ...s, lista: [...s.lista, nova], n: nova.n }, n: nova.n, nova }
  }
  const vez = s.vezes[papel] ?? 0
  const nova: Luta = { n: s.n + 1, papel, monstro: personagemDe(papel, vez), t0, ativas: 1, golpes: [] }
  return { s: { lista: [...s.lista, nova], vezes: { ...s.vezes, [papel]: vez + 1 }, n: nova.n }, n: nova.n, nova }
}

function golpear(s: Lutas, n: number, g: Golpe): Lutas {
  return { ...s, lista: s.lista.map(l => (l.n === n ? { ...l, ativas: Math.max(0, l.ativas - 1), golpes: [...l.golpes, g] } : l)) }
}

/** Fecha as lutas sem ferramenta rodando: no instante dado, ou 1,5 s depois do último golpe. */
function decidir(s: Lutas, agora: number, ja: boolean): Lutas {
  return {
    ...s,
    lista: s.lista.map(l => {
      if (l.fecha !== undefined || l.ativas > 0 || l.golpes.length === 0) {
        return l
      }
      const ult = Math.max(...l.golpes.map(g => g.at))
      if (ja) {
        return { ...l, fecha: Math.max(ult, agora) }
      }
      return agora >= ult + JUNTA_MS ? { ...l, fecha: ult + JUNTA_MS } : l
    }),
  }
}

let alarmeLuta: Timer | undefined

/** Um chefão entra em cena (se não há outro): a Lua para quando ele chega. */
async function chamarChefao($: $, origem: Chefao['origem'], tarefas?: Chefao['tarefas'], escolhido?: string): Promise<boolean> {
  const agora = await $.clock.now()
  const [atual, estado, ls] = await Promise.all([read($, chefao), read($, hud), read($, lutas)])
  if (atual !== null) {
    return false
  }
  await update($, chefao, () => novoChefao(estado.jogo.paginas, origem, agora, tarefas, escolhido))
  if (lutaDaVez(ls.lista, agora) === undefined) {
    await update($, caminho, c => (c.andando ? { ...c, ate: agora + ENTRA } : c))
  }
  return true
}

/**
 * Tira vida do chefão. Se ele cai: a luta `n` (golpe no chefão) vira a final
 * (ele se desfaz nela), a página é recuperada e a Lua sobe de nível.
 */
async function ferirChefao($: $, vida: (c: Chefao) => number, n?: number): Promise<void> {
  const agora = await $.clock.now()
  let antes: Chefao | null = null
  let depois: Chefao | null = null
  await update($, chefao, c => {
    antes = c
    depois = dePe(c) ? ferir(c, vida(c), agora) : c
    return depois
  })
  const a = antes as Chefao | null
  const b = depois as Chefao | null
  if (a === null || b === null || a.caiu !== undefined || b.caiu === undefined) {
    return
  }
  if (n !== undefined) {
    await update($, lutas, s => ({ ...s, lista: s.lista.map(l => (l.n === n && l.fixo === true ? { ...l, final: true } : l)) }))
  }
  let jogo: Jogo = JOGO0
  await update($, hud, h => {
    const nv = nivelDe(h.jogo.xp)
    jogo = { ...h.jogo, paginas: h.jogo.paginas + 1, xp: h.jogo.xp + (nv.precisa - nv.dentro) }
    return { ...h, jogo }
  })
  await salvarJogo($, jogo)
}

/**
 * Põe a luta em dia: decide as que esperaram o bastante, tira as que acabaram
 * (a Lua volta a andar se o Claude ainda trabalha) e marca o próximo redesenho.
 */
async function revisar($: $, turnoAcabou = false): Promise<void> {
  const agora = await $.clock.now()
  let antes: Lutas = LUTAS0
  let depois: Lutas = LUTAS0
  await update($, lutas, s => {
    antes = s
    const dec = decidir(s, agora, turnoAcabou)
    depois = { ...dec, lista: dec.lista.filter(l => (roteiro(l).fim ?? Infinity) > agora) }
    return depois
  })
  // vitórias novas: as comuns contam lutas (o chefão vem a cada 12); os golpes
  // no chefão que veio pelas lutas tiram vida dele
  const ganhas = depois.lista.filter(l => l.fecha !== undefined && antes.lista.some(a => a.n === l.n && a.fecha === undefined) && roteiro(l).desfecho?.tipo === 'vitoria')
  const vitorias = ganhas.filter(l => l.fixo !== true).length
  if (vitorias > 0) {
    let jogo: Jogo = JOGO0
    await update($, hud, h => {
      jogo = { ...h.jogo, lutas: h.jogo.lutas + vitorias }
      return { ...h, jogo }
    })
    await salvarJogo($, jogo)
    if (Math.floor(jogo.lutas / A_CADA) > Math.floor((jogo.lutas - vitorias) / A_CADA)) {
      await chamarChefao($, 'lutas')
    }
  }
  const elites = ganhas.filter(l => l.trofeu !== undefined)
  if (elites.length > 0) {
    let jogo: Jogo = JOGO0
    await update($, hud, h => {
      const antes = h.jogo.trofeus ?? []
      const tiposAntes = antes.map((_, i) => h.jogo.trofeusTipos?.[i] ?? 'edicao')
      const trofeus = [...elites.map(l => l.trofeu as string), ...antes].slice(0, TROFEUS_MAX)
      const trofeusTipos = [...elites.map(l => l.trofeuTipo ?? 'edicao'), ...tiposAntes].slice(0, TROFEUS_MAX)
      jogo = { ...h.jogo, trofeus, trofeusTipos, xp: h.jogo.xp + ELITE_XP * elites.length }
      return { ...h, jogo }
    })
    await salvarJogo($, jogo)
  }
  for (const l of ganhas.filter(g => g.fixo === true)) {
    const ch = await read($, chefao)
    if (dePe(ch) && ch.origem === 'lutas') {
      await ferirChefao($, c => c.vida - 1, l.n)
    }
  }
  // a luta final se decidiu: o chefão cai quando ela termina de se desfazer
  const final = (await read($, lutas)).lista.find(l => l.final === true)
  const dz = final === undefined ? undefined : roteiro(final).desfecho?.d
  let ch = await read($, chefao)
  if (ch !== null && ch.caiu !== undefined && dz !== undefined && ch.caiu !== dz) {
    await update($, chefao, c => (c === null ? c : { ...c, caiu: dz }))
    ch = await read($, chefao)
  }
  if (ch !== null && ch.caiu !== undefined && final === undefined && agora >= ch.caiu + QUEDA_MS) {
    await update($, chefao, () => null)
    ch = null
  }
  const presente = dePe(ch)
  // a luta da vez acabou: a Lua retoma o caminho de onde parou
  const acabou = antes.lista.filter(l => !depois.lista.some(d => d.n === l.n))
  if (acabou.length > 0) {
    const fim = Math.max(...acabou.map(l => roteiro(l).fim ?? agora))
    const prox = depois.lista[0]
    const trabalhando = await read($, turno)
    await update($, caminho, c => {
      const d = distancia(c, fim)
      // com o chefão em cena, a Lua fica parada diante dele
      const base: Caminho = { andando: trabalhando && !presente, desde: fim, dist0: d }
      return prox !== undefined && trabalhando && !presente ? { ...base, ate: prox.t0 + ENTRA } : base
    })
  }
  // próximo instante que interessa
  const futuros: number[] = []
  for (const l of depois.lista) {
    futuros.push(...marcos(l))
    if (l.fecha === undefined && l.ativas === 0 && l.golpes.length > 0) {
      futuros.push(Math.max(...l.golpes.map(g => g.at)) + JUNTA_MS)
    }
  }
  if (ch !== null && ch.caiu !== undefined) {
    futuros.push(ch.caiu + QUEDA_MS + 50)
  }
  const prox = Math.min(...futuros.filter(t => t > agora))
  alarmeLuta?.cancel()
  alarmeLuta = undefined
  if (Number.isFinite(prox)) {
    alarmeLuta = $.clock.after(prox - agora + 20, () => {
      void update($, tique, n => n + 1).then(() => revisar($))
    })
  }
}

/** Ferramentas de lista de tarefas: chamam o chefão, ou tiram vida dele a cada tarefa concluída. */
async function lista($: $, tool: string, input: unknown, n: number): Promise<void> {
  const ch = await read($, chefao)
  const doChefao = dePe(ch) && ch.origem === 'lista' ? ch.tarefas : null
  const t = lerTarefas(tool, input, doChefao)
  if (t === null) {
    return
  }
  if (doChefao === null) {
    if (ch === null && t.total > t.feitas) {
      await chamarChefao($, 'lista', t)
    }
    return
  }
  // tarefas novas na lista: o chefão ganha vida (sem golpe)
  await update($, chefao, c => (dePe(c) ? { ...c, tarefas: t, vidaMax: Math.max(c.vidaMax, t.total), vida: Math.max(c.vida, Math.min(t.total - t.feitas, Math.max(c.vidaMax, t.total))) } : c))
  await ferirChefao($, () => t.total - t.feitas, n)
}

/**
 * Elite: guarda o erro de cada ação (ferramenta + alvo); quando a mesma ação
 * dá certo, o nome do erro vira o troféu da próxima luta comum.
 */
async function lembrarErro($: $, tool: string, input: unknown, ok: boolean, texto: string | undefined): Promise<void> {
  const alvo = alvoDe(tool, input)
  if (alvo === null) {
    return
  }
  await update($, elite, el => {
    const erros = { ...el.erros }
    if (!ok) {
      delete erros[alvo]
      erros[alvo] = nomeDoErro(texto)
      const chaves = Object.keys(erros)
      for (const k of chaves.slice(0, Math.max(0, chaves.length - ERROS_MAX))) {
        delete erros[k]
      }
      return { ...el, erros }
    }
    const nome = erros[alvo]
    if (nome === undefined) {
      return el
    }
    delete erros[alvo]
    return { erros, proximo: nome, proximoTipo: tipoTrofeu(alvo) }
  })
}

/**
 * Áreas de mouse do próprio app por cima da cena (o SVG em modo imagem não tem
 * hover): um Box com `key` em cada alvo (barra, selo), posicionado em células
 * (colunas x linhas), com o balão pixel art escondido que o hover revela, logo
 * acima do alvo e centrado nele. `visivel` desenha a borda (prova técnica).
 */
/**
 * Uma célula de texto da faixa no app mede 8,8 px, e as células começam onde a
 * cena começa (medido pelas bordas das áreas no print da 3ª prova, 22/11/2026;
 * o `pxColuna` da largura da cena tem folga e não serve aqui).
 */
const PX_CELULA = 8.8
const DESLOC_CENA = 0

/** Posição na faixa em células (colunas x linhas), a partir de px da arte. */
function celulas(a: Ajustes) {
  const pxL = a.pxLinha ?? 20
  return {
    pxL,
    col: (px: number) => Math.round((px * a.escala + DESLOC_CENA) / PX_CELULA),
    lin: (px: number) => Math.round((px * a.escala) / pxL),
    larg: (px: number) => Math.ceil(px / PX_CELULA),
  }
}

/** Os elementos do desktop (o único que tem Svg). */
type Elementos = Extract<ReturnType<$['ui']['resolve']>, { Svg: unknown }>


/** O grupo de hover (`scope`) que liga a área de mouse de um alvo ao balão dele. */
const grupo = (t: Alvo) => `cronicas_${t.id}`

/**
 * O balão de um alvo, solto na cena (não dentro da área: o app ignora posição
 * negativa, e o balão saía da cena pela direita). Escondido; acende com o grupo
 * do alvo. Fica acima do alvo, centrado nele, e sempre dentro da cena,
 * contando o cartão que o app põe em volta.
 */
function balaoDoAlvo(els: Elementos, a: Ajustes, colunas: number, W: number, t: Alvo) {
  const { Box, Svg } = els
  const { pxL, col, lin, larg } = celulas(a)
  const m = medidaBalaoSolto(t.titulo, t.explica, a.escala, W)
  const largura = larg(m.w)
  const cena = Math.min(colunas, Math.floor((W * a.escala) / PX_CELULA))
  const left = Math.max(0, Math.min(cena - largura, col(t.x + t.w / 2) - Math.round(largura / 2)))
  // logo acima do alvo; a ponta aponta para o meio dele, onde quer que o balão tenha parado
  const top = Math.max(0, lin(t.y) - Math.ceil(m.h / pxL))
  const b = balaoSolto(t.titulo, t.explica, a.escala, W, (t.x + t.w / 2) * a.escala - left * PX_CELULA)
  return (
    <Box key={`bl_${t.id}`} position="absolute" top={top} left={left} display="none" hover={{ scope: grupo(t), display: 'flex' }}>
      <Svg source={b.svg} height={b.altura} alt={`${t.titulo}: ${t.explica.replace(/\n/g, ' ')}`} />
    </Box>
  )
}

/**
 * Áreas de mouse por cima da cena (barras e selo) e os balões delas. Cada área
 * é um Box vazio do tamanho do alvo, em células, no grupo de hover do alvo.
 * `visivel` desenha a borda (prova técnica).
 */
function areasDeHover(els: Elementos, a: Ajustes, colunas: number, W: number, alvos: readonly Alvo[], visivel: boolean) {
  const { Box } = els
  const { col, lin } = celulas(a)
  const deBarra = alvos.filter(t => !t.id.startsWith('botao_'))
  const areas = deBarra.map(t => {
    const left = col(t.x)
    const top = lin(t.y)
    // as duas bordas arredondadas para a célula mais próxima: vizinhas não se sobrepõem
    const tam = { width: Math.max(2, col(t.x + t.w) - left), height: Math.max(1, lin(t.y + t.h) - top) }
    return visivel ? (
      <Box key={`pv_${t.id}`} position="absolute" top={top} left={left} {...tam} borderStyle="single" borderColor="gray" hover={{ scope: grupo(t), borderColor: 'yellow' }} />
    ) : (
      <Box key={`hv_${t.id}`} position="absolute" top={top} left={left} {...tam} hover={{ scope: grupo(t) }} />
    )
  })
  // os balões depois das áreas: ficam por cima
  return [...areas, ...deBarra.map(t => balaoDoAlvo(els, a, colunas, W, t))]
}

/**
 * Fase 4, prova técnica: as áreas de hover com borda (para ver onde caem) e os
 * 4 ícones de botão na cena, cada um com um botão do app de rótulo invisível
 * por cima (clique = aviso) e o balão do botão no hover.
 */
function provaTecnica($: $, els: Elementos, colunas: number, W: number, a: Ajustes, cena: unknown, alvos: readonly Alvo[]) {
  const { Box, Button, Text } = els
  const { pxL, lin } = celulas(a)
  const areas = areasDeHover(els, a, colunas, W, alvos, true)
  // Áreas dos ícones: um bloco contínuo, sem vão. Cada área começa na coluna à
  // esquerda do ícone e vai até a próxima; a última, até o fim do último ícone.
  // O botão do app usa fonte proporcional ("•" ≈ 6,5 px + ~14 px de recuo): o
  // rótulo tem os pontos que enchem a área. Uma linha por botão (o app ignora
  // quebra no rótulo): dois empilhados cobrem as 2 linhas do ícone.
  const icones = ['vigilia', 'mochila', 'estandarte', 'livro'].map(b => alvos.find(x => x.id === `botao_${b}`)).filter((t): t is Alvo => t !== undefined)
  const inicio = (t: Alvo) => Math.floor((t.x * a.escala) / PX_CELULA)
  const botao = (t: Alvo, i: number) => {
    const nome = t.titulo
    const left = inicio(t)
    const prox = icones[i + 1]
    const fim = prox !== undefined ? inicio(prox) : Math.ceil(((t.x + t.w) * a.escala) / PX_CELULA)
    const largura = Math.max(2, fim - left)
    const pontos = Math.max(2, Math.round((largura * PX_CELULA - 14) / 6.5))
    const aperta = () => $.ui.toast(`Prova: o clique no ${nome} funcionou.`)
    return (
      <Box key={`pb_${t.id}`} position="absolute" top={lin(t.y)} left={left} width={largura} height={2} flexDirection="column" hover={{ scope: grupo(t) }}>
        <Button key={`pv_${t.id}`} plain label={'•'.repeat(pontos)} onPress={aperta} />
        <Button key={`pv2_${t.id}`} plain label={'•'.repeat(pontos)} onPress={aperta} />
      </Box>
    )
  }
  const botoes = ['vigilia', 'mochila', 'estandarte', 'livro'].map(b => `botao_${b}`)
  return (
    <Box flexDirection="column">
      <Box position="relative">
        {cena as never}
        {areas}
        {icones.map(botao)}
        {alvos.filter(t => botoes.includes(t.id)).map(t => balaoDoAlvo(els, a, colunas, W, t))}
      </Box>
      <Text dimColor>{`Prova técnica: ${colunas} colunas, ${PX_CELULA} px por coluna, ${pxL} px por linha. /cronicas prova desliga.`}</Text>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const salvo = (await $.store.get('jogo')) as Partial<Jogo> | undefined
    const uso = await $.session.usage()
    await update($, hud, h => ({
      ...h,
      jogo: { ...JOGO0, ...(salvo ?? {}) },
      mana: uso.rateLimits.length > 0 ? manaDe(uso.rateLimits) : h.mana,
      mochila: mochilaDe(uso.context) ?? h.mochila,
    }))
    await revisar($)
    await $.command.register({
      name: 'cronicas',
      description: 'As Crônicas de Lua: jornada, ajustes da faixa e testes (chefão, elite, lua nova)',
      argumentHint: 'escala 2 | largura 690 | regua | quadro | imagem | teste | lua-nova | chefao [nome] | golpe | elite',
    })
    return next(e)
  })

  on('command.run', { command: 'cronicas' }, async ($, e) => {
    const [chave, valor] = String(e.args ?? '').trim().split(/\s+/)
    const a = await lerAjustes($)
    const n = Number(valor)
    if (chave === 'escala' && (n === 1 || n === 2 || n === 3)) {
      a.escala = n
    } else if (chave === 'coluna' && n >= 4 && n <= 20) {
      a.pxColuna = n
    } else if (chave === 'largura' && n >= 300 && n <= 4000) {
      // a régua mostrou a largura da faixa em px: daí sai o px por coluna
      if (ultimasColunas <= 0) {
        return { text: 'Ainda não sei quantas colunas a faixa tem: espere ela aparecer e tente de novo.' }
      }
      // uns px a mais: desenho mais largo que a faixa é cortado à direita (sem
      // distorcer); mais estreito, o app pode esticar a imagem
      a.pxColuna = Math.round(((n + 4) / ultimasColunas) * 100) / 100
      a.regua = false
    } else if (chave === 'quadro' || chave === 'imagem') {
      a.quadro = chave === 'quadro'
      a.teste = false
    } else if (chave === 'teste') {
      a.teste = !a.teste
    } else if (chave === 'prova') {
      a.prova = a.prova !== true
      await $.store.set('ajustes', a)
      await update($, tique, t => t + 1)
      return {
        text: a.prova
          ? 'Prova técnica ligada. (1) As áreas de mouse ganham borda: passe o mouse nas barras e no selo de nível (a borda acende e o balão aparece). (2) Os 4 ícones de botão aparecem na cena, com uma área clicável invisível por cima: clique em cada um (aparece um aviso) e passe o mouse (aparece o balão do botão). /cronicas prova de novo desliga.'
          : 'Prova técnica desligada.',
      }
    } else if (chave === 'linha' && n >= 8 && n <= 40) {
      // altura de uma linha da faixa em px (medida com a régua vertical da prova)
      a.pxLinha = n
    } else if (chave === 'regua' || chave === 'régua') {
      a.regua = a.regua !== true
      await $.store.set('ajustes', a)
      await update($, tique, t => t + 1)
      return {
        text: a.regua
          ? 'Régua ligada embaixo da cena. Diga qual é o último número que aparece inteiro na borda direita. /cronicas regua de novo desliga.'
          : 'Régua desligada.',
      }
    } else if (chave === 'chefao' || chave === 'chefão') {
      // para ver o chefão sem lista de tarefas: 3 de vida, /cronicas golpe tira 1.
      // Com um nome (/cronicas chefao relojoeiro), chama esse; sem, o próximo da jornada.
      const pedido = String(e.args ?? '').trim().split(/\s+/).slice(1).join(' ')
      const escolhido = chefaoPeloNome(pedido)
      if (pedido !== '' && escolhido === undefined) {
        return { text: `Não conheço o chefão "${pedido}". Use um destes: ${JORNADA.map(n => NOME_CHEFAO[n] ?? n).join(', ')}.` }
      }
      const veio = await chamarChefao($, 'lutas', undefined, escolhido)
      await revisar($)
      const ch = await read($, chefao)
      return { text: veio && ch !== null ? `${NOME_CHEFAO[ch.nome] ?? ch.nome} entrou em cena (página ${ch.pagina}/10). Use /cronicas golpe para tirar vida.` : 'Já há um chefão em cena.' }
    } else if (chave === 'golpe') {
      const ch = await read($, chefao)
      if (!dePe(ch)) {
        return { text: 'Não há chefão em cena. /cronicas chefao chama um.' }
      }
      await ferirChefao($, c => c.vida - 1)
      await revisar($)
      const depois = await read($, chefao)
      return { text: depois?.caiu !== undefined ? `${NOME_CHEFAO[ch.nome] ?? ch.nome} caiu! Página ${ch.pagina}/10 recuperada.` : `Golpe! Vida ${depois?.vida ?? 0}/${depois?.vidaMax ?? 0}.` }
    } else if (chave === 'elite') {
      // para ver o elite sem esperar um erro de verdade: a próxima ferramenta chama o Golem
      // cada teste traz o próximo dos 4 troféus, para ver todos
      const ja = (await read($, hud)).jogo.trofeus?.length ?? 0
      const tipo = TIPOS_TROFEU[ja % TIPOS_TROFEU.length] ?? 'edicao'
      const exemplo: Record<TipoTrofeu, string> = {
        comando: 'Error: command not found: pyhton',
        edicao: 'Error: String to replace not found in file.',
        leitura: 'Error: File does not exist.',
        web: 'Error: Request failed with status code 404',
      }
      await update($, elite, el => ({ ...el, proximo: nomeDoErro(exemplo[tipo]), proximoTipo: tipo }))
      const nomes: Record<TipoTrofeu, string> = { comando: 'taça com chama (comando)', edicao: 'engrenagem (edição)', leitura: 'lua crescente (leitura)', web: 'orbe (web)' }
      return { text: `A próxima luta comum será o elite (Golem de Obsidiana) trazendo o troféu ${nomes[tipo]}. Rode de novo depois para ver o próximo tipo.` }
    } else if (chave === 'lua-nova') {
      // só para ver o aviso: a próxima resposta acende o luar de novo
      const agora = await $.clock.now()
      await update($, hud, h => ({ ...h, luz: { at: agora - (h.luz?.ttlMs ?? 3_600_000) - 1000, ttlMs: h.luz?.ttlMs ?? 3_600_000 } }))
      return { text: 'Lua nova simulada: o aviso aparece na faixa até a próxima resposta.' }
    } else {
      const atual = await read($, hud)
      const nv = nivelDe(atual.jogo.xp)
      return {
        text: `As Crônicas de Lua: escala ${a.escala}x, ${a.pxColuna} px por coluna, modo ${a.quadro ? 'quadro' : 'imagem'}. Nível ${nv.nivel}, ${atual.jogo.xp} XP, ${paginasNoCiclo(atual.jogo.paginas)}/10 páginas.\nUse /cronicas escala 1|2|3, /cronicas regua e /cronicas largura <px> (calibra a largura), /cronicas quadro|imagem, /cronicas teste (compara os dois) /cronicas lua-nova (simula o cache frio) ou /cronicas chefao [nome] e /cronicas golpe (testa o chefão) ou /cronicas elite (a próxima luta é o elite).${(atual.jogo.trofeus ?? []).length > 0 ? `\nTroféus: ${(atual.jogo.trofeus ?? []).slice(0, 5).join(' · ')}` : ''}`,
      }
    }
    await $.store.set('ajustes', a)
    await update($, tique, t => t + 1)
    if (chave === 'linha') {
      return { text: `Altura da linha: ${n} px. As áreas de mouse foram recalculadas.` }
    }
    if (chave === 'largura') {
      return { text: `Largura calibrada: ${n} px em ${ultimasColunas} colunas = ${a.pxColuna} px por coluna. A cena agora acompanha a largura da faixa (régua desligada).` }
    }
    return {
      text: a.teste
        ? 'Teste ligado: a faixa aparece duas vezes, A (quadro interativo) e B (imagem). /cronicas teste de novo desliga.'
        : `Faixa ajustada: escala ${a.escala}x, ${a.pxColuna} px por coluna, modo ${a.quadro ? 'quadro (balões no hover)' : 'imagem'}.`,
    }
  })

  // /clear começa uma conversa nova: não há cache para perder nem contexto na mochila.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, hud, h => ({ ...h, luz: null, mochila: null }))
      await update($, confirma, () => false)
    }
    return next(e)
  })

  // Mana e Mochila: o engine avisa quando os números mudam.
  on('session.measure', async ($, e, next) => {
    await update($, hud, h => ({
      ...h,
      mana: e.rateLimits.length > 0 ? manaDe(e.rateLimits) : h.mana,
      mochila: mochilaDe(e.context) ?? h.mochila,
    }))
    return next(e)
  })

  // A Lua anda enquanto o Claude trabalha e para quando ele termina
  // (numa luta, ela só volta a andar quando a luta acaba).
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const agora = await $.clock.now()
      await update($, turno, () => true)
      const emLuta = lutaDaVez((await read($, lutas)).lista, agora) !== undefined || dePe(await read($, chefao))
      if (!emLuta) {
        await update($, caminho, c => (c.andando && c.ate === undefined ? c : { andando: true, desde: agora, dist0: distancia(c, agora) }))
      }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    if (e.agentId === undefined) {
      const agora = await $.clock.now()
      await update($, turno, () => false)
      const emLuta = lutaDaVez((await read($, lutas)).lista, agora) !== undefined
      if (!emLuta) {
        await update($, caminho, c => (c.andando ? { andando: false, desde: agora, dist0: distancia(c, agora) } : c))
      }
      // a última ferramenta do turno decide a luta na hora
      await revisar($, true)
      await ganharXp($, 1)
    }
    return res
  })

  // Luz da Lua: cada pedido ao modelo reacende o cache por 5 min ou 1 h.
  on('turn.step', async function* ($, e, next) {
    const at = await $.clock.now()
    const resposta = yield* next(e)
    if (e.agentId === undefined && resposta.usage !== null) {
      const u = resposta.usage
      const antes = (await read($, hud)).luz
      let ttlMs = antes?.ttlMs ?? 3_600_000
      if ((u.ephemeral_1h_input_tokens ?? 0) > 0) {
        ttlMs = 3_600_000
      } else if ((u.ephemeral_5m_input_tokens ?? 0) > 0) {
        ttlMs = 300_000
      }
      const usouCache = u.cache_read_input_tokens + u.cache_creation_input_tokens > 0
      if (usouCache) {
        await update($, hud, h => ({ ...h, luz: { at, ttlMs } }))
        await marcarFimDoLuar($, at + ttlMs - (await $.clock.now()))
      }
    }
    return resposta
  })

  // Cada ferramenta do Claude é uma luta: o monstro entra quando ela começa e
  // leva o golpe (ou contra-ataca, se deu erro) quando ela volta.
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) {
      // as ferramentas de dentro de um subagente não chamam monstro (o próprio Agent já é a luta)
      const res = await next(e)
      if (res.deny === undefined && res.isError !== true) {
        await ganharXp($, 2)
      }
      return res
    }
    const agora = await $.clock.now()
    let n = 0
    let nova: Luta | null = null
    const ch0 = await read($, chefao)
    const el0 = await read($, elite)
    await update($, lutas, s => {
      const r = entrar(s, agora, e.tool, ch0, el0.proximo, el0.proximoTipo)
      n = r.n
      nova = r.nova
      return r.s
    })
    if ((nova as Luta | null)?.trofeu !== undefined) {
      await update($, elite, el => ({ erros: el.erros }))
    }
    // começou agora: a Lua para quando o monstro chegar
    const comeco = nova as Luta | null
    if (comeco !== null && comeco.t0 <= agora) {
      await update($, caminho, c => (c.andando ? { ...c, ate: comeco.t0 + ENTRA } : c))
    }
    await revisar($)
    let ok = false
    let texto: string | undefined
    try {
      const res = await next(e)
      ok = res.deny === undefined && res.isError !== true
      texto = res.deny ?? res.text
      return res
    } finally {
      const fim = await $.clock.now()
      await update($, lutas, s => golpear(s, n, { at: fim, ok, dano: danoDe(texto) }))
      await lembrarErro($, e.tool, e, ok, texto)
      if (ok) {
        await lista($, e.tool, e, n)
      }
      await revisar($)
      if (ok) {
        await ganharXp($, 2)
      }
    }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.surface !== 'desktop') {
      return next(e)
    }
    const { Box, Button, Svg, Text } = $.ui.resolve(e)
    await read($, tique)
    const [c, estado, agora, a, confirmando, ls] = await Promise.all([
      read($, caminho),
      read($, hud),
      $.clock.now(),
      lerAjustes($),
      read($, confirma),
      read($, lutas),
    ])
    const ch = await read($, chefao)
    ultimasColunas = e.props.bodyColumns
    // a cena acompanha a largura da faixa (colunas x px por coluna, calibrado pela régua)
    const W = Math.max(LARGURA_MIN, Math.min(LARGURA_MAX, Math.floor((e.props.bodyColumns * a.pxColuna) / a.escala)))
    const luta = lutaDaVez(ls.lista, agora)
    // a faixa tem sempre a mesma altura (pedido do usuário): todo monstro cabe nela
    const modo = 'compacto'
    // a Pixelify (textos longos) só entra quando os balões podem aparecer (modo quadro)
    const textoLongo = a.quadro || a.teste
    const vista = { agora, W, escala: a.escala, celula: PX_CELULA / a.escala, modo, caminho: c, hud: estado, textoLongo, ...(a.prova === true ? { botoes: true } : {}), ...(luta === undefined ? {} : { luta }), ...(ch === null ? {} : { chefao: ch }) } as const
    const montada = montar(vista)
    let { svg } = montada
    const { altura, alvos } = montada
    if (svg.length > LIMITE_SVG) {
      // não coube: sem partículas e sem a tira de andar na luta
      svg = montar({ ...vista, economia: true }).svg
    }
    // altura fixa: se a cena passar da largura da faixa, o app corta a sobra à
    // direita (preserveAspectRatio slice) em vez de encolher o desenho
    const nv = nivelDe(estado.jogo.xp)
    const cansada = luar(estado, agora).desmaiada
    const alt = `As Crônicas de Lua: a Lua ${cansada ? 'está cansada (lua nova, cache frio)' : dePe(ch) ? `enfrenta o chefão ${NOME_CHEFAO[ch.nome] ?? ch.nome} (${ch.vida}/${ch.vidaMax} de vida)` : luta !== undefined ? 'luta com um monstro' : c.andando ? 'anda pela floresta' : 'descansa'}; nível ${nv.nivel}.`
    const cena = a.teste ? (
      <Box flexDirection="column" gap={1}>
        <Text key="ta">A: quadro interativo (balões no hover)</Text>
        <Svg key="sa" source={svg} isInteractive height={altura} alt={alt} />
        <Text key="tb">B: imagem (sem balões)</Text>
        <Svg key="sb" source={svg} height={altura} alt={alt} />
      </Box>
    ) : a.quadro ? (
      <Svg source={svg} isInteractive height={altura} alt={alt} />
    ) : (
      <Box position="relative">
        <Svg source={svg} height={altura} alt={alt} />
        {areasDeHover($.ui.resolve(e) as Elementos, a, e.props.bodyColumns, W, alvos, false)}
      </Box>
    )
    if (a.prova === true) {
      return provaTecnica($, $.ui.resolve(e) as Elementos, e.props.bodyColumns, W, a, <Svg source={svg} height={altura} alt={alt} />, alvos)
    }
    if (a.regua === true) {
      return (
        <Box flexDirection="column" gap={1}>
          {cena}
          <Svg key="regua" source={regua(e.props.bodyColumns, a.pxColuna)} height={44} alt="Régua de calibrar a largura da faixa" />
        </Box>
      )
    }
    if (!cansada) {
      return cena
    }
    // Lua nova: a chamada para ação é um botão de verdade logo abaixo da cena.
    const acoes = confirmando ? (
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text>A conversa atual sai da tela (volta com /resume).</Text>
        <Button
          key="sim"
          variant="primary"
          onPress={async () => {
            await update($, confirma, () => false)
            await $.command.run({ command: 'clear' })
          }}
        >
          Começar
        </Button>
        <Button key="nao" onPress={() => update($, confirma, () => false)}>
          Ficar nesta
        </Button>
      </Box>
    ) : (
      <Box flexDirection="row" gap={1} alignItems="center">
        <Button key="nova" variant="primary" onPress={() => update($, confirma, () => true)}>
          🌙 Nova conversa
        </Button>
        <Text dimColor>ou continue aqui: só a próxima mensagem custa mais.</Text>
      </Box>
    )
    return (
      <Box flexDirection="column" gap={1}>
        {cena}
        {acoes}
      </Box>
    )
  })
}

