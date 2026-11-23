import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

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

async function comecar($: Dolar, on: On, ferramentas: readonly Ferramenta[] = []) {
  const clock = mock.clock(on, { now: T0 })
  for (const [tool, ms, erro] of ferramentas) {
    ferramenta(on, clock, tool, ms, erro === true)
  }
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 2, lutas: 5 } })
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
  return { clock, ui, svg }
}

/** Uma ferramenta de mentira que responde depois de `ms`. */
function ferramenta(on: On, clock: ReturnType<typeof mock.clock>, tool: string, ms: number, erro = false) {
  // o nome vem de fora: para o tipo, qualquer uma das ferramentas serve
  on('tool.call', { tool: tool as 'Read' }, async () => {
    await clock.sleep(ms)
    return { result: 'feito', text: erro ? 'falhou: arquivo não encontrado' : 'conteúdo do arquivo', ...(erro ? { isError: true as const } : {}) }
  })
}

test('uma leitura chama a Vespera, a Lua ataca e vence; depois a luta some', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on, [['Read', 300]])
  expect(await svg()).not.toContain('id="m_')
  const chamada = $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  await clock.settle()
  const inicio = await svg()
  expect(inicio).toContain('id="vespera_sem_teia"')
  expect(inicio).toContain('id="exclamacao"')
  await clock.advance(300)
  await chamada
  // a estrela e o número de dano entram no desenho quando o ataque começa
  await clock.advance(1000)
  expect(await svg()).toContain('id="lua_ataque"')
  expect(await svg()).toContain('id="projetil"')
  // decide 1,5 s depois do golpe e mostra a vitória
  await clock.advance(1300)
  await clock.advance(900)
  expect(await svg()).toContain('id="lua_vitoria"')
  expect(await svg()).toContain('id="xp_X"')
  await clock.advance(3000)
  expect(await svg()).not.toContain('id="vespera_sem_teia"')
  await ui.unmount()
})

test('editar alterna Relojoeiro e Sir Solis a cada luta', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on, [['Edit', 100]])
  const vistos: string[] = []
  for (let i = 0; i < 3; i++) {
    const p = $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'a', new_string: 'b' })
    await clock.settle()
    const s = await svg()
    vistos.push(s.includes('id="m_relojoeiro"') ? 'relojoeiro' : s.includes('id="m_sir_solis"') ? 'sir_solis' : '?')
    await clock.advance(100)
    await p
    await clock.advance(8000)
  }
  expect(vistos).toEqual(['relojoeiro', 'sir_solis', 'relojoeiro'])
  await ui.unmount()
})

test('um erro vira contra-ataque: a Lua leva dano e o monstro vai embora', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on, [['Bash', 200, true]])
  const p = $.tool.call({ tool: 'Bash', command: 'false' })
  await clock.settle()
  expect(await svg()).toContain('id="m_ignis"')
  await clock.advance(200)
  await p
  await clock.advance(2700)
  const s = await svg()
  expect(s).toContain('id="lua_dano"')
  expect(s).not.toContain('id="lua_vitoria"')
  await clock.advance(5000)
  expect(await svg()).not.toContain('id="m_ignis"')
  await ui.unmount()
})

test('ferramentas em paralelo somam golpes no mesmo monstro', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on, [['Grep', 150], ['WebFetch', 400]])
  const a = $.tool.call({ tool: 'Grep', pattern: 'x' })
  const b = $.tool.call({ tool: 'WebFetch', url: 'https://example.com', prompt: 'resuma' })
  await clock.settle()
  const s = await svg()
  // um monstro só (o da primeira ferramenta), nada do Leviatã
  expect(s).toContain('id="vespera_sem_teia"')
  expect(s).not.toContain('id="m_leviata"')
  await clock.advance(400)
  await Promise.all([a, b])
  await ui.unmount()
})

test('demorou: a Lua canaliza enquanto a ferramenta roda', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on, [['Bash', 9000]])
  const p = $.tool.call({ tool: 'Bash', command: 'sleep 9' })
  await clock.settle()
  await clock.advance(3000)
  const s = await svg()
  expect(s).toContain('id="lua_canalizar"')
  expect(s).toContain('id="canalizar"')
  await clock.advance(6000)
  await p
  await ui.unmount()
})

test('em todo redesenho da luta o SVG cabe no limite do app', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on, [['WebSearch', 2600]])
  const p = $.tool.call({ tool: 'WebSearch', query: 'pixel art' })
  await clock.settle()
  let maior = (await svg()).length
  for (let t = 0; t < 12000; t += 70) {
    await clock.advance(70)
    maior = Math.max(maior, (await svg()).length)
  }
  await p
  expect(maior).toBeLessThan(131072)
  await ui.unmount()
})
