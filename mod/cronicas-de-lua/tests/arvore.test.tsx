import { expect, mock, test } from 'claude-code/testing'

// Prova no app (25/11/2026): o desktop recusa a faixa inteira (cena + balões do
// hover) acima de ~262 mil caracteres (256 KiB?) e fica no desenho anterior.
// Relojoeiro e Ignis passavam (264–267 mil) quando cada balão levava duas fontes.
const T0 = 1_800_000_000_000
const TETO_ARVORE = 240_000

test('a faixa inteira (cena e balões) fica abaixo do teto do app, com os chefões mais pesados (120 colunas, a mais larga)', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 2, lutas: 5 }, ajustes: {} })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const cmd = (args: string) => $.command.run({ command: 'cronicas', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  for (const cols of [120]) {
    const ui = await $.ui.mount({ plugin: 'cronicas-de-lua', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 20, bodyColumns: cols, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as const)
    for (const nome of ['relojoeiro', 'ignis']) {
      await cmd(`chefao ${nome}`)
      await clock.advance(1500)
      expect(JSON.stringify(await ui.drawn()).length).toBeLessThan(TETO_ARVORE)
    }
    await ui.unmount()
  }
})
