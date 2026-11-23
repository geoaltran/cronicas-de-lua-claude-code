import { expect, mock, test } from 'claude-code/testing'

const FAIXA = {
  plugin: 'cronicas-de-lua',
  component: 'AbovePrompt',
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

test('no desktop a faixa desenha a cena em SVG, com a Lua parada', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on, { jogo: { xp: 137, paginas: 2, lutas: 5 } })
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  const fonte = String((svg as { props?: { source?: string } })?.props?.source ?? '')
  expect(fonte.length).toBeLessThan(131072)
  expect(fonte).toContain('72%')
  expect(fonte).toContain('35%')
  expect(fonte).toContain('Nível 7')
  // balões no hover (Fase 4): uma área do app sobre cada barra e sobre o selo
  for (const k of ['barra_luz', 'barra_mana', 'barra_mochila', 'barra_xp', 'selo']) {
    expect(await ui.find({ type: 'Box', key: `hv_${k}` })).toBeDefined()
  }
  await ui.unmount()
})



test('na lua nova a faixa mostra o aviso e pede confirmação antes do /clear', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on)
  const rodados: string[] = []
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  on('command.run', { command: 'clear' }, (_, e) => {
    rodados.push(e.command)
    return { text: '' }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'cronicas', args: 'lua-nova', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } })

  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(String((svg as { props?: { source?: string } })?.props?.source ?? '')).toContain('se cansou')
  await ui.press({ key: 'nova' })
  expect(rodados).toEqual([])
  await ui.press({ key: 'sim' })
  expect(rodados).toEqual(['clear'])
  await ui.unmount()
})

test('prova técnica (Fase 4): áreas de hover com borda e botões invisíveis sobre os 4 ícones', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on, { jogo: { xp: 137, paginas: 2, lutas: 5 } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'cronicas', args: 'prova', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } })
  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  for (const b of ['luz', 'mana', 'mochila', 'xp']) {
    expect(await ui.find({ type: 'Box', key: `pv_barra_${b}` })).toBeDefined()
  }
  for (const b of ['vigilia', 'mochila', 'estandarte', 'livro']) {
    expect(await ui.find({ type: 'Button', key: `pv_botao_${b}` })).toBeDefined()
  }
  // na prova o clique faz a ação de verdade (a Mochila pede confirmação embaixo da cena)
  await ui.press({ key: 'pv_botao_mochila' })
  expect(await ui.find({ type: 'Button', key: 'mochila_sim' })).toBeDefined()
  // o balão é um SVG pixel art com o texto da barra
  const baloes = (await ui.findAll({ type: 'Svg' })).map(s => String((s as { props?: { source?: string } }).props?.source ?? ''))
  expect(baloes.some(f => f.includes('Mana Estelar') && f.includes('72% livre'))).toBe(true)
  await $.command.run({ command: 'cronicas', args: 'prova', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } })
  expect(await ui.find({ type: 'Button', key: 'pv_botao_livro' })).toBeUndefined()
  await ui.unmount()
})

test('o palpite antigo de 18 px por linha, gravado nos ajustes, vira o medido (20)', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on, { jogo: { xp: 137, paginas: 2, lutas: 5 }, ajustes: { escala: 1, pxColuna: 8.89, quadro: false, teste: false, prova: true, pxLinha: 18 } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...FAIXA, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /20 px por linha/ })).toBeDefined()
  await ui.unmount()
})
