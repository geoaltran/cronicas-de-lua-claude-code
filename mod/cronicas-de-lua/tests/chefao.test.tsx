import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import { chefaoPeloNome, novoChefao } from '../hooks/chefao'

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
  mock.store(on, { jogo })
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(FAIXA)
  const svg = async () => {
    const no = await ui.find({ type: 'Svg' })
    return String((no as { props?: { source?: string } })?.props?.source ?? '')
  }
  const alt = async () => {
    const no = await ui.find({ type: 'Svg' })
    return String((no as { props?: { alt?: string } })?.props?.alt ?? '')
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
    maior = Math.max(maior, (await svg()).length)
  }
  await p
  expect(maior).toBeLessThan(131072)
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
