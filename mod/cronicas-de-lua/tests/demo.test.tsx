import { expect, mock, test } from 'claude-code/testing'

const T0 = 1_800_000_000_000

test('/cronicas demo: os chefões vêm sozinhos, cada um cai com o crítico, e demo stop para', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 0, lutas: 5 }, ajustes: {} })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const cmd = (args: string) => $.command.run({ command: 'cronicas', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })
  const r = await cmd('demo')
  expect(String(r.text)).toContain('9 biomas')
  // cada chefão que cai recupera uma página: o resumo do /cronicas mostra x/10
  const paginas = async () => Number(/(\d+)\/10/.exec(String((await cmd('')).text))?.[1] ?? -1)
  let t = 0
  for (; t < 120_000 && (await paginas()) < 2; t += 1000) {
    await clock.advance(1000)
  }
  // os dois primeiros (Vespera na floresta, Golem nas ruínas) em menos de 1 min e meio
  expect(await paginas()).toBe(2)
  expect(t).toBeLessThan(90_000)
  expect(String((await cmd('demo stop')).text)).toContain('parada')
  // parada, nenhum chefão novo aparece
  await clock.advance(60_000)
  expect(await paginas()).toBe(2)
  expect(String((await cmd('demo stop')).text)).toContain('Não há')
})
