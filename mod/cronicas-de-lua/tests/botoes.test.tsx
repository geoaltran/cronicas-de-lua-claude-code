import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { VIGILIA_MAX, msgVigilia, pedidoResumo } from '../hooks/register'

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
type Dolar = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } } as const

/** Prepara a sessão e guarda o que o mod pediu ao app: mensagens, sons, avisos, compactações, painéis. */
async function preparar($: Dolar, on: On) {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on, { jogo: { xp: 137, paginas: 2, lutas: 5 } })
  const r = { enviados: [] as string[], sons: [] as string[], avisos: [] as string[], compactou: 0, abertos: [] as string[], fechados: [] as string[] }
  let paineis: string[] = []
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  on('prompt.submit', (_, e) => {
    r.enviados.push(e.text)
    return { text: e.text }
  })
  on('audio.play', (_, e) => {
    r.sons.push((e.clip as { asset: string }).asset)
    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    r.avisos.push(e.text)
    return { value: undefined }
  })
  on('session.compact', () => {
    r.compactou += 1
    return { messages: [{ role: 'assistant' as const, text: 'resumo', toolUses: [] }] }
  })
  on('ui.open', (_, e) => {
    r.abertos.push(e.id)
    paineis = [...paineis, e.id]
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', (_, e) => {
    r.fechados.push(e.id)
    paineis = paineis.filter(p => p !== e.id)
    return { value: undefined }
  })
  on('turn.complete', () => ({ text: 'ok' }))
  on('ui.panes', () => ({ value: paineis.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  return { clock, r }
}

const fonteDe = async (ui: { find: (q: { type: 'Svg' }) => Promise<unknown> }) => String(((await ui.find({ type: 'Svg' })) as { props?: { source?: string } })?.props?.source ?? '')

test('os 4 botões aparecem sempre, com rótulo invisível e balão no hover', async ($, on) => {
  await preparar($, on)
  const ui = await $.ui.mount(FAIXA)
  for (const b of ['vigilia', 'mochila', 'estandarte', 'livro']) {
    const bt = (await ui.find({ type: 'Button', key: `bt_${b}` })) as { props?: { label?: string } } | undefined
    expect(bt).toBeDefined()
    // o rótulo só tem caracteres que não desenham nada (espaço de algarismo + word joiner)
    expect(/^\u2060\u2007+\u2060$/.test(bt?.props?.label ?? '')).toBe(true)
    expect(await ui.find({ type: 'Button', key: `bt2_${b}` })).toBeDefined()
    expect(await ui.find({ type: 'Box', key: `bl_botao_${b}` })).toBeDefined()
  }
  expect(await fonteDe(ui)).toContain('bt_botao_vigilia_inativo')
  await ui.unmount()
})

test('Vigília: acende com aviso de custo e som; manda a mensagem perto do fim do luar; apaga sozinha depois de 6', async ($, on) => {
  const { clock, r } = await preparar($, on)
  const ui = await $.ui.mount(FAIXA)
  await ui.press({ key: 'bt_vigilia' })
  expect(r.avisos.some(a => a.includes('Vigília acesa') && a.includes('limite'))).toBe(true)
  expect(r.sons).toEqual(['sons/vigilia.wav'])
  expect(await fonteDe(ui)).toContain('bt_vigilia_ativo_3f')
  for (let i = 1; i <= VIGILIA_MAX; i++) {
    await $.command.run({ command: 'cronicas', args: 'vigilia', ...CMD })
    await clock.advance(9_000)
    expect(r.enviados.length).toBe(i - 1)
    await clock.advance(1_500)
    expect(r.enviados.length).toBe(i)
  }
  expect(r.enviados.every(t => t === msgVigilia())).toBe(true)
  await clock.advance(1_000)
  expect(r.avisos.some(a => a.includes('apagou sozinha'))).toBe(true)
  expect(r.sons[r.sons.length - 1]).toBe('sons/apagou.wav')
  expect(await fonteDe(ui)).toContain('bt_botao_vigilia_inativo')
  // apagada, não manda mais nada
  await $.command.run({ command: 'cronicas', args: 'vigilia', ...CMD })
  await clock.advance(20_000)
  expect(r.enviados.length).toBe(VIGILIA_MAX)
  await ui.unmount()
})

test('Vigília apagada pelo clique não manda mensagem', async ($, on) => {
  const { clock, r } = await preparar($, on)
  const ui = await $.ui.mount(FAIXA)
  await ui.press({ key: 'bt_vigilia' })
  await ui.press({ key: 'bt2_vigilia' })
  expect(r.avisos[r.avisos.length - 1]).toContain('apagada')
  await $.command.run({ command: 'cronicas', args: 'vigilia', ...CMD })
  await clock.advance(20_000)
  expect(r.enviados).toEqual([])
  await ui.unmount()
})

test('Mochila: pede confirmação e só então compacta', async ($, on) => {
  const { r } = await preparar($, on)
  const ui = await $.ui.mount(FAIXA)
  await ui.press({ key: 'bt_mochila' })
  expect(r.compactou).toBe(0)
  expect(await fonteDe(ui)).toContain('bt_botao_mochila_ativo')
  await ui.press({ key: 'mochila_nao' })
  expect(await ui.find({ type: 'Button', key: 'mochila_sim' })).toBeUndefined()
  await ui.press({ key: 'bt_mochila' })
  await ui.press({ key: 'mochila_sim' })
  expect(r.compactou).toBe(1)
  expect(r.avisos.some(a => a.includes('Mochila arrumada'))).toBe(true)
  expect(await ui.find({ type: 'Button', key: 'mochila_sim' })).toBeUndefined()
  await ui.unmount()
})

test('Estandarte: pede o resumo, a bandeira ondula e no fim oferece a conversa nova', async ($, on) => {
  const { r } = await preparar($, on)
  const ui = await $.ui.mount(FAIXA)
  await ui.press({ key: 'bt_estandarte' })
  expect(r.enviados).toEqual([pedidoResumo()])
  expect(await fonteDe(ui)).toContain('bt_estandarte_ativo_3f')
  await $.turn.complete({ turnId: 't1', answer: 'ok', text: 'ok', reason: 'end_turn' } as never)
  expect(await fonteDe(ui)).toContain('bt_botao_estandarte_ativo')
  expect(await ui.find({ type: 'Button', key: 'est_nova' })).toBeDefined()
  await ui.press({ key: 'est_nova' })
  expect(await ui.find({ type: 'Button', key: 'sim' })).toBeDefined()
  await ui.unmount()
})

test('Livro: o clique abre e fecha o painel', async ($, on) => {
  const { r } = await preparar($, on)
  const ui = await $.ui.mount(FAIXA)
  await ui.press({ key: 'bt_livro' })
  expect(r.abertos).toEqual(['livro'])
  expect(await fonteDe(ui)).toContain('bt_botao_livro_ativo')
  await ui.press({ key: 'bt_livro' })
  expect(r.fechados).toEqual(['livro'])
  expect(await fonteDe(ui)).toContain('bt_botao_livro_inativo')
  await ui.unmount()
})
