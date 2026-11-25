import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import { fonteDaCena } from './cena'

const T0 = 1_800_000_000_000

async function comecar($: Parameters<TestBody>[0], on: Parameters<TestBody>[1]) {
  const clock = mock.clock(on, { now: T0 })
  // página 3 (Golem): a cena está nas Ruínas
  mock.store(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 2, lutas: 5 }, ajustes: {} })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent: 35 }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'cronicas-de-lua', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 20 }, view: {} } } as const)
  const cmd = async (args: string) => (await $.command.run({ command: 'cronicas', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })) as { text?: string }
  return { clock, ui, cmd }
}

test('/cronicas passear: a Lua anda uns segundos e depois para, respirando', async ($, on) => {
  const { clock, ui, cmd } = await comecar($, on)
  await clock.advance(10000)
  expect(await fonteDaCena(ui)).toContain('id="lua_parada"')
  const r = await cmd('walk 5')
  expect(r.text).toContain('5 s')
  await clock.advance(1000)
  expect(await fonteDaCena(ui)).toContain('id="lua_andar"')
  await clock.advance(5000)
  const f = await fonteDaCena(ui)
  expect(f).toContain('id="lua_parada"')
  expect(f).not.toContain('id="lua_andar"')
  await ui.unmount()
})

test('/cronicas fase: passagem para o próximo bioma sem contar página; fica lá até o chefão', async ($, on) => {
  const { clock, ui, cmd } = await comecar($, on)
  await clock.advance(10000)
  expect(await fonteDaCena(ui)).toContain('id="b_ruinas_chao"')
  const r = await cmd('fase')
  expect(r.text).toContain('Ruínas → Mar')
  let viuTitulo = false
  for (let t = 0; t < 12000 && !viuTitulo; t += 250) {
    await clock.advance(250)
    viuTitulo = (await fonteDaCena(ui)).includes('PÁGINA 4 · MAR')
  }
  expect(viuTitulo).toBe(true)
  await clock.advance(9000)
  let f = await fonteDaCena(ui)
  expect(f).toContain('id="b_mar_chao"')
  expect(f).not.toContain('PÁGINA 4')
  // com o nome: vai direto para o bioma pedido
  expect((await cmd('fase eclip')).text).toContain('Mar → Eclipse')
  await clock.advance(15000)
  expect(await fonteDaCena(ui)).toContain('id="b_eclipse_chao"')
  // o nome em inglês vale em qualquer idioma
  expect((await cmd('stage volcano')).text).toContain('Eclipse → Vulcão')
  await clock.advance(15000)
  expect(await fonteDaCena(ui)).toContain('id="b_vulcao_chao"')
  expect((await cmd('fase xyz')).text).toContain('Não conheço')
  // não contou página: o chefão que vem é o da página 3, e o bioma vai com ele
  await cmd('chefao')
  await clock.advance(3000)
  f = await fonteDaCena(ui)
  expect(f).toContain('id="b_ruinas_chao"')
  expect((await cmd('fase')).text).toContain('chefão em cena')
  await ui.unmount()
})
