import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

// Fase 5: a faixa fora do app desktop. VS Code e celular desenham a mesma
// cena em Svg (sem hover: os botões viram uma linha de botões do app); o
// terminal desenha a faixa em texto, com emojis.

type Dolar = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]
type Sup = 'desktop' | 'vscode' | 'mobile' | 'terminal'

const faixa = (surface: Sup) =>
  ({
    plugin: 'cronicas-de-lua',
    component: 'AbovePrompt',
    surface,
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 20, bodyColumns: 60, scroll: { offset: 0, bodyRows: 20 }, view: {} },
  }) as const

const livro = (surface: Sup) =>
  ({
    plugin: 'cronicas-de-lua',
    component: 'Pane',
    requestId: 'livro',
    surface,
    props: { title: 'O Livro da Lua', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
  }) as const

async function preparar($: Dolar, on: On) {
  mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on, { jogo: { xp: 137, paginas: 2, lutas: 5, trofeus: ['COMMAND NOT FOUND'], trofeusTipos: ['comando'] } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  on('ui.toast', () => ({ value: undefined }))
  on('audio.play', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

type No = { props?: Record<string, unknown> } | undefined
const props = async (ui: { find: (q: { type: string; key?: string }) => Promise<unknown> }, type: string, key?: string) =>
  ((await ui.find(key === undefined ? { type } : { type, key })) as No)?.props

for (const sup of ['vscode', 'mobile'] as const) {
  test(`${sup}: a cena em Svg sem altura fixa, sem áreas de hover, com os 4 botões numa linha`, async ($, on) => {
    await preparar($, on)
    const ui = await $.ui.mount(faixa(sup))
    const svg = await props(ui, 'Svg')
    expect(String(svg?.['source'] ?? '')).toContain('<svg')
    expect(String(svg?.['source'] ?? '').length).toBeLessThan(131072)
    // sem height: se a cena passar da largura, o editor encolhe a imagem (não corta)
    expect(svg?.['height']).toBeUndefined()
    // nada dos botões invisíveis nem dos balões do desktop
    expect(await ui.find({ type: 'Button', key: 'bt_vigilia' })).toBeUndefined()
    expect(await ui.find({ type: 'Box', key: 'bl_botao_vigilia' })).toBeUndefined()
    for (const b of ['vigilia', 'mochila', 'estandarte', 'livro']) {
      expect(await ui.find({ type: 'Button', key: `lb_${b}` })).toBeDefined()
    }
    expect((await props(ui, 'Button', 'lb_vigilia'))?.['label']).toBe('Vigília')
    // apertar acende a Vigília (e o botão mostra os envios)
    await ui.press({ key: 'lb_vigilia' })
    expect((await props(ui, 'Button', 'lb_vigilia'))?.['label']).toBe('Vigília acesa (0/6)')
    if (sup === 'mobile') {
      // celular: variante C. Aceso: contorno na cor do Claude e o ícone preenchido
      expect((await props(ui, 'Box', 'lc_vigilia'))?.['borderColor']).toBe('#D97757')
      const icones = (await ui.findAll({ type: 'Svg' })).map(n => String((n as No)?.props?.['source'] ?? ''))
      // a cena + os 4 ícones; só o da Vigília (aceso) vem preenchido na cor do Claude
      expect(icones.length).toBe(5)
      expect(icones.filter(x => x.includes('fill="#D97757"')).length).toBe(1)
      expect((await props(ui, 'Box', 'lc_mochila'))?.['borderColor']).toBe('#3a3a3a')
    } else {
      // VS Code: variante A, só os chips (sem caixa nem ícone ao lado)
      expect(await ui.find({ type: 'Box', key: 'lc_vigilia' })).toBeUndefined()
      expect((await ui.findAll({ type: 'Svg' })).length).toBe(1)
    }
    // a Mochila pede confirmação, como no desktop
    await ui.press({ key: 'lb_mochila' })
    expect(await ui.find({ type: 'Button', key: 'mochila_sim' })).toBeDefined()
    await ui.unmount()
  })

  test(`${sup}: o Livro desenha as páginas em Svg, sem as áreas de hover da estante`, async ($, on) => {
    await preparar($, on)
    const ui = await $.ui.mount(livro(sup))
    expect(String((await props(ui, 'Svg'))?.['source'] ?? '')).toContain('id="lua_parada"')
    await ui.press({ key: 'aba_trofeus' })
    expect(String((await props(ui, 'Svg'))?.['source'] ?? '')).toContain('estante')
    expect((await props(ui, 'Svg'))?.['height']).toBeUndefined()
    expect(await ui.find({ type: 'Box', key: 'bl_trofeu_0' })).toBeUndefined()
    await ui.unmount()
  })
}

test('desktop continua com os botões sobre os ícones (sem a linha de botões)', async ($, on) => {
  await preparar($, on)
  const ui = await $.ui.mount(faixa('desktop'))
  expect(await ui.find({ type: 'Button', key: 'bt_vigilia' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'lb_vigilia' })).toBeUndefined()
  await ui.unmount()
})

test('terminal: a faixa em texto (HUD + o que a Lua faz) e os botões; chefão com a vida em barra', async ($, on) => {
  await preparar($, on)
  const ui = await $.ui.mount(faixa('terminal'))
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Nv \d+/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /MOCHILA|🎒/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /chefão em \d+ lutas?/ })).toBeDefined()
  for (const b of ['vigilia', 'mochila', 'estandarte', 'livro']) {
    expect(await ui.find({ type: 'Button', key: `lb_${b}` })).toBeDefined()
  }
  await $.command.run({ command: 'cronicas', args: 'chefao ignis', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } })
  expect(await ui.find({ type: 'Text', text: /👑 IGNIS/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /▰▰▰/ })).toBeDefined()
  await ui.unmount()
})
