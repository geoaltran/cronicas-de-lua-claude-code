import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { paginaDoLivro } from '../hooks/livro'
import type { AbaDoLivro, Jogo, TipoTrofeu } from '../types'

const PANE = {
  plugin: 'cronicas-de-lua',
  component: 'Pane',
  requestId: 'livro',
  surface: 'desktop',
  props: { title: 'O Livro da Lua', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

type Dolar = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]

const CHEIO: Jogo = {
  xp: 4321,
  paginas: 12,
  lutas: 250,
  trofeus: Array.from({ length: 30 }, (_, i) => `ERRO NUMERO ${i} DE TESTE COMPRIDO`),
  trofeusTipos: Array.from({ length: 30 }, (_, i) => (['comando', 'edicao', 'leitura', 'web'] as const)[i % 4] as TipoTrofeu),
  feiticos: { ler: 900, editar: 420, terminal: 77, web: 12, integracao: 3, subagente: 1 },
}

async function preparar($: Dolar, on: On, jogo: Jogo) {
  // os ganchos de teste antes do primeiro uso de $
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok', text: 'ok' }))
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on, { jogo })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

const fonte = async (ui: { find: (q: { type: 'Svg' }) => Promise<unknown> }) => String(((await ui.find({ type: 'Svg' })) as { props?: { source?: string } })?.props?.source ?? '')

test('cada aba do Livro cabe no limite do app, larga ou estreita, com o jogo cheio', () => {
  for (const aba of ['ficha', 'bestiario', 'trofeus', 'grimorio'] as AbaDoLivro[]) {
    for (const [W, escala] of [[200, 1], [300, 2], [700, 1]] as const) {
      const p = paginaDoLivro(aba, CHEIO, W, escala)
      expect(p.svg.length).toBeLessThan(131072)
      expect(p.altura).toBeGreaterThan(0)
    }
  }
  // a estante mostra os 15 mais novos, cada um com balão
  expect(paginaDoLivro('trofeus', CHEIO, 300, 2).alvos.length).toBe(15)
})

test('o Livro abre na Ficha; as abas trocam a página; a estante tem balão no hover de cada troféu', async ($, on) => {
  await preparar($, on, { xp: 137, paginas: 2, lutas: 5, trofeus: ['COMMAND NOT FOUND'], trofeusTipos: ['comando'], feiticos: { ler: 4 } })
  const ui = await $.ui.mount(PANE)
  expect(await fonte(ui)).toContain('id="lua_parada"')
  for (const k of ['aba_ficha', 'aba_bestiario', 'aba_trofeus', 'aba_grimorio']) {
    expect(await ui.find({ type: 'Button', key: k })).toBeDefined()
  }
  await ui.press({ key: 'aba_bestiario' })
  const best = await fonte(ui)
  // derrotados: Vespera e Dama; os outros em silhueta
  expect(best).toContain('Vespera')
  expect(best).toContain('id="m_malakor"')
  expect(best).toContain('filter="url(#sil')
  await ui.press({ key: 'aba_trofeus' })
  expect(await fonte(ui)).toContain('id="estante"')
  expect(await ui.find({ type: 'Box', key: 'bl_trofeu_0' })).toBeDefined()
  await ui.press({ key: 'aba_grimorio' })
  expect(await fonte(ui)).toContain('4×')
  await ui.unmount()
})

test('cada ferramenta que dá certo conta um feitiço no Grimório', async ($, on) => {
  await preparar($, on, { xp: 0, paginas: 0, lutas: 0 })
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await $.tool.call({ tool: 'Bash', command: 'pwd' } as never)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'aba_grimorio' })
  expect(await fonte(ui)).toContain('2×')
  await ui.unmount()
})
