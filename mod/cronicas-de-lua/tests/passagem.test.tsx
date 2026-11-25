import { expect, mock, test } from 'claude-code/testing'
import { fonteDaCena } from './cena'

const T0 = 1_800_000_000_000

test('passagem de fase: o chefão cai, a Lua sai no bioma velho, o novo clareia com o título e a faixa cabe no teto', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  // página 5 (Relojoeiro, Torre): ao cair, a jornada vai para a 7 (Sir Solis, Aurora)
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 5, lutas: 5 }, ajustes: {} })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'cronicas-de-lua', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as const)
  const cmd = (args: string) => $.command.run({ command: 'cronicas', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  await cmd('chefao')
  for (let i = 0; i < 3; i++) {
    await cmd('golpe')
  }
  // espera o chefão sair de cena; a passagem começa
  let viuSaida = false
  let viuTitulo = false
  let maior = 0
  for (let t = 0; t < 40000 && !viuTitulo; t += 250) {
    await clock.advance(250)
    const f = await fonteDaCena(ui)
    if (f.includes('id="b_torre_chao"') && f.includes('<rect width') && !f.includes('id="relojoeiro')) {
      viuSaida = viuSaida || f.includes('values="0 0;')
    }
    if (f.includes('PÁGINA 7 · AURORA')) {
      viuTitulo = true
      expect(f).toContain('id="b_aurora_chao"')
      maior = JSON.stringify(await ui.drawn()).length
    }
  }
  expect(viuSaida).toBe(true)
  expect(viuTitulo).toBe(true)
  expect(maior).toBeLessThan(240_000)
  // no fim, a cena volta ao normal (sem título) no bioma novo
  await clock.advance(9000)
  const f = await fonteDaCena(ui)
  expect(f).toContain('id="b_aurora_chao"')
  expect(f).not.toContain('PÁGINA 7')
  await ui.unmount()
})
