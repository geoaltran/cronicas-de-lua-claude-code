import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const FAIXA = {
  plugin: 'cronicas-de-lua',
  component: 'AbovePrompt',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 90,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const T0 = 1_800_000_000_000
const LIMITE = 129_000
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as const

type On = Parameters<TestBody>[1]
type Dolar = Parameters<TestBody>[0]

async function comecar($: Dolar, on: On, guardado: Record<string, unknown> = {}) {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 2, lutas: 5 }, ...guardado })
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

test('primeira sessão do dia: a marca no céu, depois a floresta e a Lua chegando; tudo cabe no limite', async ($, on) => {
  const { clock, ui, svg } = await comecar($, on)
  // fase 1: céu + marca animada (máscara do metal), sem árvores e sem a Lua
  const f1 = await svg()
  expect(f1).toContain('id="mc-metal"')
  // (2 páginas: a jornada está nas Ruínas, o bioma do Golem)
  expect(f1).not.toMatch(/id="(b_[a-z_]+_)?meio"/)
  expect(f1).not.toContain('id="lua_parada"')
  expect(f1.length).toBeLessThan(LIMITE)
  // fase 2: o cenário da página atual clareia e a Lua entra andando
  await clock.advance(4100)
  const f2 = await svg()
  expect(f2).not.toContain('id="mc-metal"')
  expect(f2).toContain('id="b_ruinas_meio"')
  expect(f2).toContain('id="lua_andar"')
  expect(f2.length).toBeLessThan(LIMITE)
  // depois: a cena de sempre, a Lua parada no lugar dela
  await clock.advance(4000)
  const f3 = await svg()
  expect(f3).not.toContain('id="lua_andar"')
  expect(f3).toContain('id="lua_parada"')
  await ui.unmount()
})

test('a abertura não repete no mesmo dia; /cronicas abertura mostra de novo; off desliga', async ($, on) => {
  const d = new Date(T0)
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const { clock, ui, svg } = await comecar($, on, { aberturaDia: dia })
  expect(await svg()).not.toContain('id="mc-metal"')
  const r = await $.command.run({ command: 'cronicas', args: 'abertura', ...CMD })
  expect(JSON.stringify(r)).toContain('Abertura')
  await clock.settle()
  expect(await svg()).toContain('id="mc-metal"')
  const off = await $.command.run({ command: 'cronicas', args: 'abertura off', ...CMD })
  expect(JSON.stringify(off)).toContain('desligada')
  await ui.unmount()
})
