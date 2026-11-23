import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { alvoDe, nomeDoErro, tipoTrofeu } from '../hooks/luta'

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
type Dolar = Parameters<TestBody>[0]
const chamar = ($: Dolar, input: Record<string, unknown>) => $.tool.call(input as never)

test('o nome do erro fica curto e legível; o alvo reconhece a mesma ação', () => {
  expect(nomeDoErro('<tool_use_error>String to replace not found in file.</tool_use_error>')).toBe('STRING TO REPLACE NOT F…')
  expect(['Bash|ls', 'Edit|/a', 'Write|/a', 'Read|/a', 'WebFetch|http://x'].map(tipoTrofeu)).toEqual(['comando', 'edicao', 'edicao', 'leitura', 'web'])
  expect(nomeDoErro('Exit code 1\nnpm ERR! missing script: build')).toBe('NPM ERR! MISSING SCRIPT…')
  expect(nomeDoErro('Error: ENOENT')).toBe('ENOENT')
  expect(nomeDoErro('')).toBe('ERRO MISTERIOSO')
  expect(alvoDe('Bash', { command: 'npm test' })).toBe('Bash|npm test')
  expect(alvoDe('Edit', { file_path: '/a.ts' })).toBe('Edit|/a.ts')
  expect(alvoDe('WebFetch', { url: 'https://x' })).toBe('WebFetch|https://x')
  expect(alvoDe('Grep', { pattern: 'x' })).toBe(null)
})

test('erro consertado: a mesma ação dá certo e a próxima luta é o Golem com o troféu', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let edits = 0
  on('tool.call', { tool: 'Edit' }, async () => {
    edits += 1
    await clock.sleep(100)
    return edits === 1 ? { result: 'x', text: 'String to replace not found in file.', isError: true as const } : { result: 'ok', text: 'feito' }
  })
  on('tool.call', { tool: 'Read' }, async () => {
    await clock.sleep(100)
    return { result: 'ok', text: 'conteúdo' }
  })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 0, paginas: 1, lutas: 0 } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 1000, percent: 1 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(FAIXA)
  const svg = async () => String(((await ui.find({ type: 'Svg' })) as { props?: { source?: string } })?.props?.source ?? '')
  const usar = async (input: Record<string, unknown>) => {
    const p = chamar($, input)
    await clock.advance(150)
    await p
    await clock.advance(9000)
  }
  // erro, depois a mesma edição dá certo (essa luta ainda é comum)
  await usar({ tool: 'Edit', file_path: '/a.ts', old_string: 'a', new_string: 'b' })
  await usar({ tool: 'Edit', file_path: '/a.ts', old_string: 'a', new_string: 'b' })
  // a próxima luta é o elite
  const p = chamar($, { tool: 'Read', file_path: '/b.ts' })
  await clock.advance(1500)
  expect(await svg()).toContain('id="m_golem_obsidiana"')
  // o troféu só aparece quando ele cai; o nome do erro não aparece na faixa (vai para o Livro)
  expect(await svg()).not.toContain('trofeu_')
  expect(await svg()).not.toContain('STRING TO REPLACE')
  await clock.advance(50)
  await p
  await clock.advance(1700)
  expect(await svg()).toContain('+TROFÉU')
  // grande, no lugar do Golem: a engrenagem (o erro foi numa edição)
  expect(await svg()).toContain('id="trofeu_edicao_grande"')
  await clock.advance(9000)
  // o troféu fica guardado entre sessões, e a luta seguinte volta ao normal
  const resumo = (await $.command.run({ command: 'cronicas', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 90 } })) as { text?: string }
  expect(String(resumo?.text ?? '')).toContain('Troféus: STRING TO REPLACE NOT F…')
  const q = chamar($, { tool: 'Read', file_path: '/c.ts' })
  await clock.advance(1500)
  expect(await svg()).not.toContain('id="m_golem_obsidiana"')
  await clock.advance(50)
  await q
  await ui.unmount()
})

test('a teia da Vespera gira (4 quadros) e cabe no limite', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  on('tool.call', { tool: 'Read' }, async () => {
    await clock.sleep(2600)
    return { result: 'ok', text: 'conteúdo' }
  })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 0, paginas: 0, lutas: 0 } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 1000, percent: 1 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount(FAIXA)
  const svg = async () => String(((await ui.find({ type: 'Svg' })) as { props?: { source?: string } })?.props?.source ?? '')
  const p = chamar($, { tool: 'Read', file_path: '/a' })
  let maior = 0
  let viuTeia = false
  for (let t = 0; t < 12000; t += 70) {
    await clock.advance(70)
    const s = await svg()
    maior = Math.max(maior, s.length)
    viuTeia ||= ['teia_0', 'teia_1', 'teia_2', 'teia_3'].every(k => s.includes(`id="${k}"`)) && s.includes('id="vespera_sem_teia"')
  }
  await p
  expect(viuTeia).toBe(true)
  expect(maior).toBeLessThan(131072)
  await ui.unmount()
})
