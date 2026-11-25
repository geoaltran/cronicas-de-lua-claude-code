import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import { PONTOS_POR_TAREFA, chefaoPeloNome, crescer, critico, defesa, ferir, novoChefao, vidaEmTarefas } from '../hooks/chefao'
import { CORTE, LIMITE_APP, altDaCena, fonteDaCena, medida } from './cena'

const FAIXA = {
  plugin: 'cronicas-de-lua',
  component: 'AbovePrompt',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: true,
    maxRows: 20,
    bodyColumns: 90,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const T0 = 1_800_000_000_000

type On = Parameters<TestBody>[1]
type Dolar = Parameters<TestBody>[0]

type Ferramenta = readonly [tool: string, ms: number, erro?: boolean]

async function comecar($: Dolar, on: On, ferramentas: readonly Ferramenta[] = [], jogo = { xp: 137, paginas: 2, lutas: 5 }) {
  const clock = mock.clock(on, { now: T0 })
  for (const [tool, ms, erro] of ferramentas) {
    ferramenta(on, clock, tool, ms, erro === true)
  }
  mock.store(on, { idioma: 'pt-BR', jogo })
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(FAIXA)
  const svg = async () => {
    return fonteDaCena(ui)
  }
  const alt = async () => {
    return altDaCena(ui)
  }
  return { clock, ui, svg, alt }
}

/** Uma ferramenta de mentira que responde depois de `ms`. */
function ferramenta(on: On, clock: ReturnType<typeof mock.clock>, tool: string, ms: number, erro = false) {
  // o nome vem de fora: para o tipo, qualquer uma das ferramentas serve
  on('tool.call', { tool: tool as 'Read' }, async () => {
    await clock.sleep(ms)
    return { result: 'feito', text: erro ? 'falhou: arquivo não encontrado' : 'conteúdo do arquivo', ...(erro ? { isError: true as const } : {}) }
  })
}


const PLANO = 'mcp__ccd_turn__update_plan'
const FECHO = 'mcp__ccd_turn__wrap_up'
const itens = (feitas: number, total: number) => Array.from({ length: total }, (_, i) => ({ content: `passo ${i + 1}`, status: i < feitas ? 'completed' : 'pending' }))
// ferramentas de fora da lista de tipos: a chamada vai sem tipo próprio
const chamar = ($: Dolar, input: Record<string, unknown>) => $.tool.call(input as never)
/** Usa uma ferramenta até ela voltar (o relógio anda o tempo dela). */
async function usar($: Dolar, clock: { advance(ms: number): Promise<void> }, input: Record<string, unknown>, ms = 120) {
  const p = chamar($, input)
  await clock.advance(ms)
  await p
}

test('uma lista de tarefas chama o chefão da jornada; cada tarefa feita tira vida; na última ele cai', async ($, on) => {
  const { clock, ui, svg, alt } = await comecar($, on, [[PLANO, 50], [FECHO, 50], ['Read', 50]])
  // páginas 2: o próximo da jornada é o Golem de Obsidiana (página 3)
  await usar($, clock, { tool: PLANO, items: itens(0, 3) })
  await clock.advance(6000)
  expect(await svg()).toContain('id="m_golem_obsidiana"')
  expect(await svg()).toContain('GOLEM DE OBSIDIANA')
  expect(await alt()).toContain('3/3')
  // uma ferramenta durante o chefão vira golpe nele (nada de Vespera)
  const p = chamar($, { tool: 'Read', file_path: '/a' })
  await clock.settle()
  expect(await svg()).not.toContain('id="vespera_sem_teia"')
  expect(await svg()).toContain('id="m_golem_obsidiana"')
  await clock.advance(60)
  await p
  await clock.advance(6000)
  // tarefa concluída: vida 2/3
  await usar($, clock, { tool: PLANO, advance: true })
  expect(await alt()).toContain('2/3')
  await clock.advance(6000)
  // o fechamento conclui tudo: ele cai, a página volta e a Lua sobe de nível
  const nivel = async () => Number(/nível (\d+)/.exec(await alt())?.[1] ?? 0)
  const antes = await nivel()
  await usar($, clock, { tool: FECHO, recap: 'pronto' })
  await clock.advance(3000)
  expect(await svg()).toContain('PÁGINA 3/10')
  await clock.advance(10000)
  // a Lua sobe um nível inteiro ao derrotar o chefão
  expect(await nivel()).toBe(antes + 1)
  await clock.advance(10000)
  expect(await svg()).not.toContain('id="m_golem_obsidiana"')
  expect(await svg()).not.toContain('GOLEM DE OBSIDIANA')
  await ui.unmount()
})

test('a 12a vitória comum chama o chefão; sem lista, cada vitória tira 1 de 3', async ($, on) => {
  const { clock, ui, svg, alt } = await comecar($, on, [['Read', 100]], { xp: 0, paginas: 0, lutas: 11 })
  await usar($, clock, { tool: 'Read', file_path: '/a' })
  await clock.advance(8000)
  expect(await svg()).toContain('id="vespera_sem_teia"')
  expect(await svg()).toContain('VESPERA')
  expect(await alt()).toContain('3/3')
  await usar($, clock, { tool: 'Read', file_path: '/b' })
  await clock.advance(8000)
  expect(await alt()).toContain('2/3')
  await ui.unmount()
})

test('depois do Malakor a jornada recomeça (Novo Jogo+)', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on, [[PLANO, 50], [FECHO, 50]], { xp: 0, paginas: 9, lutas: 0 })
  await usar($, clock, { tool: PLANO, items: itens(0, 1) })
  await clock.advance(6000)
  expect(await svg()).toContain('id="m_malakor"')
  await usar($, clock, { tool: FECHO, recap: 'fim' })
  await clock.advance(3000)
  expect(await svg()).toContain('NOVO JOGO+')
  await clock.advance(10000)
  // a próxima lista chama a Vespera de novo
  await usar($, clock, { tool: PLANO, items: itens(0, 2) })
  await clock.advance(6000)
  expect(await svg()).toContain('id="vespera_sem_teia"')
  await ui.unmount()
})

test('com o chefão em cena todo redesenho cabe no limite do app', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on, [[PLANO, 50], ['WebSearch', 2600]], { xp: 0, paginas: 8, lutas: 0 })
  await usar($, clock, { tool: PLANO, items: itens(0, 4) })
  await clock.advance(6000)
  const p = chamar($, { tool: 'WebSearch', query: 'x' })
  let maior = 0
  for (let t = 0; t < 12000; t += 70) {
    await clock.advance(70)
    maior = Math.max(maior, medida(await svg()))
  }
  await p
  expect(maior).toBeLessThan(LIMITE_APP)
  await ui.unmount()
})

test('/cronicas chefao <nome> chama um chefão escolhido (para testar)', () => {
  expect(chefaoPeloNome('relojoeiro')).toBe('relojoeiro')
  expect(chefaoPeloNome('Sir Solis')).toBe('sir_solis')
  expect(chefaoPeloNome('dama')).toBe('dama_penumbra')
  expect(chefaoPeloNome('nébula')).toBe('nebula')
  expect(chefaoPeloNome('xyz')).toBeUndefined()
  const c = novoChefao(7, 'lutas', 0, undefined, 'relojoeiro')
  expect([c.nome, c.pagina, c.vida]).toEqual(['relojoeiro', 6, 3])
  expect(novoChefao(7, 'lutas', 0).nome).toBe('rei_espelho')
})

/** Avança o relógio de 70 em 70 ms e diz se algum desenho no caminho teve o texto. */
async function apareceu(clock: { advance(ms: number): Promise<void> }, svg: () => Promise<string>, texto: string, ms: number): Promise<{ viu: boolean; maior: number }> {
  let viu = false
  let maior = 0
  for (let t = 0; t < ms; t += 70) {
    await clock.advance(70)
    const s = await svg()
    maior = Math.max(maior, medida(s))
    viu = viu || s.includes(texto)
  }
  return { viu, maior }
}

test('chefão de lista: vida em blocos; o golpe comum tira pouco e nunca passa da metade do bloco', () => {
  const c = novoChefao(0, 'lista', 0, { total: 5, feitas: 0 })
  expect([c.bloco, c.vida, c.vidaMax]).toEqual([PONTOS_POR_TAREFA, 50, 50])
  expect(vidaEmTarefas(c)).toEqual({ resta: 5, total: 5 })
  // golpes seguidos: 1 ou 2 por vez, até a metade do bloco; depois o escudo segura tudo (0)
  let x = c
  const tirados: number[] = []
  for (let k = 0; k < 8; k++) {
    const t = defesa(x, k)
    tirados.push(t)
    x = ferir(x, x.vida - t, 0)
  }
  expect(tirados.every(t => t >= 0 && t <= 2)).toBe(true)
  expect(x.vida).toBe(45)
  expect(defesa(x, 3)).toBe(0)
  expect(vidaEmTarefas(x).resta).toBe(5)
  // os golpes sozinhos nunca derrubam: no último bloco também sobra vida
  let u = novoChefao(0, 'lista', 0, { total: 1, feitas: 0 })
  for (let k = 0; k < 20; k++) {
    u = ferir(u, u.vida - defesa(u, k), 0)
  }
  expect(u.vida).toBeGreaterThan(0)
  expect(u.caiu).toBeUndefined()
})

test('tarefa concluída desce até o fim do bloco; tarefa nova dá um bloco; crítico maior quando sobra mais vida', () => {
  const c = ferir(novoChefao(0, 'lista', 0, { total: 3, feitas: 0 }), 27, 0)
  // concluiu uma: desce até 2 blocos (20), com o rastro a partir de 27
  const d = ferir(c, 20, 100, 400)
  expect([d.vida, d.golpe?.antes, d.golpe?.at]).toEqual([20, 27, 400])
  // a lista ganhou uma tarefa pendente: +1 bloco, sem golpe
  const e = crescer({ ...d, tarefas: { total: 3, feitas: 1 } }, { total: 4, feitas: 1 })
  expect([e.vida, e.vidaMax, vidaEmTarefas(e).resta]).toEqual([30, 40, 3])
  // o crítico cresce com a vida que sobrou (terminar cedo dá um número enorme)
  expect(critico(50, 4)).toBeGreaterThan(critico(10, 4))
  expect(critico(10, 4)).toBeGreaterThan(critico(1, 4))
})

test('no chefão de lista a ferramenta bate no escudo e a vida não cai de bloco; o fechamento é um golpe crítico', async ($, on) => {
  const { clock, ui, svg, alt } = await comecar($, on, [[PLANO, 50], [FECHO, 50], ['Read', 50]], { xp: 0, paginas: 0, lutas: 0 })
  await usar($, clock, { tool: PLANO, items: itens(0, 2) })
  await clock.advance(6000)
  expect(await alt()).toContain('2/2')
  // golpe comum: o escudo aparece e a vida continua no mesmo bloco
  const p = chamar($, { tool: 'Read', file_path: '/a' })
  await clock.advance(60)
  await p
  const escudo = await apareceu(clock, svg, 'id="escudo"', 4000)
  expect(escudo.viu).toBe(true)
  expect(escudo.maior).toBeLessThan(LIMITE_APP)
  // o escudo defendeu: a Lua não comemora; fica em dúvida com o "?" azul
  let viuDuvida = false
  let viuPergunta = false
  let viuPulo = false
  let viuGota = false
  for (let t = 0; t < 4000; t += 70) {
    await clock.advance(70)
    const s = await svg()
    viuDuvida = viuDuvida || s.includes('id="lua_duvida"')
    viuPergunta = viuPergunta || s.includes('id="interrogacao"')
    viuGota = viuGota || s.includes('id="gota"')
    viuPulo = viuPulo || s.includes('id="lua_vitoria"')
  }
  expect(viuDuvida).toBe(true)
  expect(viuPergunta).toBe(true)
  expect(viuGota).toBe(true)
  expect(viuPulo).toBe(false)
  expect(await alt()).toContain('2/2')
  // tarefa concluída: um bloco a menos
  await usar($, clock, { tool: PLANO, advance: true })
  expect(await alt()).toContain('1/2')
  await clock.advance(6000)
  // o fechamento derruba com um crítico (número dourado e a cena tremendo)
  await usar($, clock, { tool: FECHO, recap: 'pronto' })
  const crit = await apareceu(clock, svg, 'CRÍTICO!', 3200)
  expect(crit.viu).toBe(true)
  expect(crit.maior).toBeLessThan(LIMITE_APP)
  expect(await svg()).toContain('PÁGINA 1/10')
  await ui.unmount()
})

test('o chefão das 12 lutas continua igual (3 de vida, sem escudo) e o último golpe também é crítico', async ($, on) => {
  const { clock, ui, svg, alt } = await comecar($, on, [['Read', 100]], { xp: 0, paginas: 0, lutas: 0 })
  await $.command.run({ command: 'cronicas', args: 'chefao', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } })
  await clock.advance(3000)
  expect(await alt()).toContain('3/3')
  let viuEscudo = false
  let viuCritico = false
  let viuDuvida = false
  for (const f of ['/a', '/b', '/c']) {
    const p = chamar($, { tool: 'Read', file_path: f })
    await clock.advance(100)
    await p
    for (let t = 0; t < 8000; t += 70) {
      await clock.advance(70)
      const s = await svg()
      viuEscudo = viuEscudo || s.includes('id="escudo"')
      viuCritico = viuCritico || s.includes('CRÍTICO!')
      viuDuvida = viuDuvida || s.includes('id="lua_duvida"')
    }
  }
  expect(viuEscudo).toBe(false)
  expect(viuDuvida).toBe(false)
  expect(viuCritico).toBe(true)
  await ui.unmount()
})

test('/cronicas chefao troca o chefão em cena (e o bioma vai junto); no céu escuro o nome fica claro', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on)
  const cmd = (args: string) => $.command.run({ command: 'cronicas', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } })
  await cmd('chefao golem')
  await clock.advance(3000)
  expect(await svg()).toContain('id="b_ruinas_chao"')
  const r = await cmd('chefao malakor')
  expect(JSON.stringify(r)).toContain('Malakor')
  await clock.advance(3000)
  const f = await svg()
  expect(f).toContain('id="b_eclipse_chao"')
  expect(f).not.toContain('id="b_ruinas_chao"')
  expect(f).toContain('fill:#fbe6a2') // nome claro, com contorno, no céu do eclipse
  await cmd('chefao sir solis')
  await clock.advance(3000)
  const g = await svg()
  expect(g).toContain('id="b_aurora_chao"')
  expect(g).not.toContain('fill:#fbe6a2') // céu claro: o nome escuro de sempre
  await ui.unmount()
})

test('modo quadro (balões e fonte longa no SVG): Relojoeiro e Ignis trocam o bioma e cabem no limite', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 2, lutas: 5 }, ajustes: { quadro: true } })
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...FAIXA, props: { ...FAIXA.props, bodyColumns: 120 } })
  const svg = async () => await fonteDaCena(ui)
  const cmd = (args: string) => $.command.run({ command: 'cronicas', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  for (const [nome, bioma] of [['relojoeiro', 'torre'], ['ignis', 'vulcao'], ['golem', 'ruinas'], ['relojoeiro', 'torre']] as const) {
    await cmd(`chefao ${nome}`)
    for (const passo of [100, 1500, 3000]) {
      await clock.advance(passo)
      const f = await svg()
      expect(f).toContain(`id="b_${bioma}_chao"`)
      // no modo quadro a cena é um Svg só (interativo): vale o limite documentado
      expect(f.split(CORTE).length).toBe(1)
      expect(f.length).toBeLessThan(131072)
    }
  }
  await ui.unmount()
})

test('desktop: cenário e frente em dois Svg; Relojoeiro e Ignis trocam o bioma e cada Svg cabe no teto codificado', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 2, lutas: 5 }, ajustes: {} })
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...FAIXA, props: { ...FAIXA.props, bodyColumns: 120 } })
  const svg = async () => await fonteDaCena(ui)
  const cmd = (args: string) => $.command.run({ command: 'cronicas', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  for (const [nome, bioma] of [['relojoeiro', 'torre'], ['ignis', 'vulcao'], ['golem', 'ruinas'], ['relojoeiro', 'torre']] as const) {
    await cmd(`chefao ${nome}`)
    for (const passo of [100, 1500, 3000]) {
      await clock.advance(passo)
      const f = await svg()
      const [fundo, frente] = f.split(CORTE)
      expect(frente).toBeDefined()
      expect(fundo).toContain(`id="b_${bioma}_chao"`)
      expect(frente).not.toContain(`id="b_${bioma}_chao"`)
      expect(medida(f)).toBeLessThan(LIMITE_APP)
    }
  }
  await ui.unmount()
})

test('/cronicas golpe é uma luta de verdade: a Lua ataca, o chefão leva o impacto, e o que derruba é crítico', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on, [], { xp: 0, paginas: 9, lutas: 0 })
  const cmd = (args: string) => $.command.run({ command: 'cronicas', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } })
  await cmd('chefao malakor')
  await clock.advance(3000)
  const textos: string[] = []
  let ataques = 0
  let impactos = 0
  let viuCritico = false
  for (let i = 0; i < 3; i++) {
    textos.push(JSON.stringify(await cmd('golpe')))
    let atacou = false
    let impacto = false
    for (let t = 0; t < 6000; t += 70) {
      await clock.advance(70)
      const s = await svg()
      atacou = atacou || s.includes('id="lua_ataque"')
      impacto = impacto || s.includes('impacto')
      viuCritico = viuCritico || s.includes('CRÍTICO!')
    }
    ataques += atacou ? 1 : 0
    impactos += impacto ? 1 : 0
  }
  expect(textos[0]).toContain('Vida 2/3')
  expect(textos[1]).toContain('Vida 1/3')
  expect(textos[2]).toContain('Malakor caiu')
  expect(ataques).toBe(3)
  expect(impactos).toBe(3)
  expect(viuCritico).toBe(true)
  await ui.unmount()
})
