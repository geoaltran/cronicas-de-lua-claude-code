import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import { URL_VERSAO, compararVersoes, versaoDeTeste, versaoDoJson, versaoNova } from '../hooks/atualizacao'

// 1.1.2: aviso de versão nova. Uma consulta por dia ao plugin.json público, sem
// nada da pessoa no pedido; desliga com /cronicas updates off; respeita
// CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC; nunca instala nada.

const T0 = 1_800_000_000_000
type On = Parameters<TestBody>[1]
type Dolar = Parameters<TestBody>[0]

test('versões: compara número a número e só aceita um número de versão', () => {
  expect(compararVersoes('1.10.0', '1.9.9')).toBeGreaterThan(0)
  expect(compararVersoes('1.1', '1.1.0')).toBe(0)
  expect(compararVersoes('1.1.1', '1.1.2')).toBeLessThan(0)
  expect(versaoDoJson('{"version":"1.2.0"}')).toBe('1.2.0')
  expect(versaoDoJson('{"version":"<script>"}')).toBeUndefined()
  expect(versaoDoJson('{"version":"1.2.0 abra este link"}')).toBeUndefined()
  expect(versaoDoJson('não é json')).toBeUndefined()
  expect(versaoNova('1.2.0', '1.1.1')).toBe('1.2.0')
  expect(versaoNova('1.1.1', '1.1.1')).toBeNull()
  expect(versaoNova(undefined, '1.1.1')).toBeNull()
  expect(versaoDeTeste('1.1.1')).toBe('1.1.2')
})

async function preparar($: Dolar, on: On, opc: { remota?: string; bloqueado?: boolean; store?: Record<string, unknown> } = {}) {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 2, lutas: 5 }, ...opc.store })
  const r = { pedidos: [] as { url: string; init?: unknown }[], avisos: [] as string[], paineis: [] as string[] }
  on('ui.open', (_, e) => {
    r.paineis = [...r.paineis, e.id]
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', (_, e) => {
    r.paineis = r.paineis.filter(p => p !== e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: r.paineis.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  on('ui.toast', (_, e) => {
    r.avisos.push(e.text)
    return { value: undefined }
  })
  on('fs.read', (_, e) => ({ value: e.path.endsWith('.claude-plugin/plugin.json') ? '{"name":"cronicas-de-lua","version":"1.1.1"}' : '' }))
  on('env.get', (_, e) => ({ value: e.name === 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC' && opc.bloqueado === true ? '1' : undefined }))
  on('http.fetch', (_, e) => {
    r.pedidos.push({ url: e.url, ...(e.init === undefined ? {} : { init: e.init }) })
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ name: 'cronicas-de-lua', version: opc.remota ?? '1.1.1' }) } }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(3100)
  const cmd = async (args: string) => (await $.command.run({ command: 'cronicas', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })) as { text?: string }
  return { clock, r, cmd }
}

test('versão nova: uma consulta no começo da sessão, sem nada da pessoa no pedido, e um aviso só', async ($, on) => {
  const { r, cmd } = await preparar($, on, { remota: '1.2.0' })
  expect(r.pedidos).toEqual([{ url: URL_VERSAO }])
  expect(r.avisos.filter(a => a.includes('1.2.0')).length).toBe(1)
  const t = (await cmd('updates')).text ?? ''
  expect(t).toContain('1.2.0')
  expect(t).toContain('/plugin update cronicas-de-lua@cronicas-de-lua')
  expect(t).toContain('claude plugin update cronicas-de-lua@cronicas-de-lua')
  // no mesmo dia, sem "check", não consulta de novo
  expect(r.pedidos.length).toBe(1)
  await cmd('updates check')
  expect(r.pedidos.length).toBe(2)
  // o aviso de canto não se repete para a mesma versão
  expect(r.avisos.filter(a => a.includes('1.2.0')).length).toBe(1)
})

test('em dia: nenhum aviso; a consulta seguinte só no outro dia', async ($, on) => {
  const { r, cmd, clock } = await preparar($, on, { store: { atualizacao: { dia: '2000-01-01' } } })
  expect(r.pedidos.length).toBe(1)
  expect(r.avisos.length).toBe(0)
  expect((await cmd('updates')).text ?? '').toContain('mais nova')
  await clock.advance(25 * 3600_000)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(3100)
  expect(r.pedidos.length).toBe(2)
})

test('desligado: nada de rede, nem com check; on liga e confere', async ($, on) => {
  const { r, cmd } = await preparar($, on, { remota: '1.2.0', store: { atualizacao: { desligada: true } } })
  expect(r.pedidos.length).toBe(0)
  expect((await cmd('updates check')).text ?? '').toContain('desligado')
  expect(r.pedidos.length).toBe(0)
  expect((await cmd('updates on')).text ?? '').toContain('1.2.0')
  expect(r.pedidos.length).toBe(1)
  await cmd('updates off')
  await cmd('updates check')
  expect(r.pedidos.length).toBe(1)
})

test('tráfego não essencial desligado no computador: o mod não consulta o GitHub', async ($, on) => {
  const { r, cmd } = await preparar($, on, { remota: '1.2.0', bloqueado: true })
  expect(r.pedidos.length).toBe(0)
  expect((await cmd('updates check')).text ?? '').toContain('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')
  expect(r.pedidos.length).toBe(0)
})

test('a estrelinha e o balão do Livro aparecem com versão nova (e o teste mostra sem rede)', async ($, on) => {
  const { cmd } = await preparar($, on)
  const FAIXA = { plugin: 'cronicas-de-lua', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 20, bodyColumns: 90, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as const
  const ui = await $.ui.mount(FAIXA)
  const antes = JSON.stringify(await ui.drawn())
  expect(antes).not.toContain('Versão nova 1')
  expect((await cmd('updates test')).text ?? '').toContain('1.1.2')
  const depois = JSON.stringify(await ui.drawn())
  expect(depois).toContain('Versão nova 1.1.2 (disponível)')
  await ui.unmount()
})

test('com versão nova, o Livro abre em Comandos, com a faixa dourada e o link do README', async ($, on) => {
  const { cmd, r } = await preparar($, on, { remota: '1.2.0' })
  const FAIXA = { plugin: 'cronicas-de-lua', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 20, bodyColumns: 90, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as const
  const faixa = await $.ui.mount(FAIXA)
  await faixa.press({ key: 'bt_livro' })
  expect(r.paineis).toContain('livro')
  const PANE = { plugin: 'cronicas-de-lua', component: 'Pane', requestId: 'livro', surface: 'desktop', props: { title: 'O Livro da Lua', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as const
  const livro = await $.ui.mount(PANE)
  const tudo = JSON.stringify(await livro.drawn())
  expect(tudo).toContain('README.pt-BR.md#comandos')
  expect(tudo).toContain('VERSÃO NOVA 1.2.0')
  await livro.unmount()
  await faixa.unmount()
  // sem versão nova (desligado), a página não tem a faixa
  await cmd('updates off')
})
