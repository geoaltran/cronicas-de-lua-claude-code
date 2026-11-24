import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'
import { nivelDe } from '../hooks/cena'

// 1.0.2: o estado da faixa (barras, luta, caminho, chefão) é de cada sessão
// ($.state); só o progresso (XP, páginas, lutas, troféus) é compartilhado
// ($.store). E a luta não depende só do alarme de cada marco.

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

const TERMINAL = { ...FAIXA, surface: 'terminal', props: { ...FAIXA.props, bodyColumns: 120 } } as const

type On = Parameters<TestBody>[1]
type Dolar = Parameters<TestBody>[0]

/** Um $.store em memória que o teste também mexe (como outra sessão faria). */
function loja(on: On, inicio: Record<string, unknown>) {
  const m = new Map<string, unknown>(Object.entries(inicio))
  on('store.get', (_, e) => ({ value: m.get(e.key) }))
  on('store.set', (_, e) => {
    m.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    m.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...m.keys()] }))
  return m
}

function base(on: On, percent = 35) {
  on('session.usage', () => ({
    value: { startedAt: 0, context: { window: 200000, tokens: 70000, percent }, rateLimits: [{ kind: 'five_hour', percentUsed: 28 }] },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'cronicas' } }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
}

function leitura(on: On, clock: ReturnType<typeof mock.clock>, ms: number) {
  on('tool.call', { tool: 'Read' }, async () => {
    await clock.sleep(ms)
    return { result: 'feito', text: 'conteúdo do arquivo' }
  })
}

async function faixa($: Dolar) {
  const ui = await $.ui.mount(FAIXA)
  const svg = async () => {
    const no = await ui.find({ type: 'Svg' })
    return String((no as { props?: { source?: string } })?.props?.source ?? '')
  }
  return { ui, svg }
}

test('o XP que outra sessão ganhou não se perde quando esta sessão ganha o dela', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  leitura(on, clock, 300)
  const m = loja(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 2, lutas: 5 } })
  base(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: false })
  // outra sessão aberta ganhou XP e uma luta enquanto esta esperava
  m.set('jogo', { xp: 500, paginas: 2, lutas: 6 })
  const chamada = $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  await clock.advance(300)
  await chamada
  await clock.advance(5000)
  const jogo = m.get('jogo') as { xp: number; lutas: number }
  // 500 da outra sessão + 2 da leitura (antes: 137 + 2, e as 500 sumiam)
  expect(jogo.xp).toBe(502)
  // a vitória desta sessão soma à luta da outra
  expect(jogo.lutas).toBe(7)
})

test('o começo do turno traz para a faixa o progresso de outra sessão', async ($, on) => {
  mock.clock(on, { now: T0 })
  const m = loja(on, { idioma: 'pt-BR', jogo: { xp: 10, paginas: 0, lutas: 0 } })
  base(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: false })
  const ui = await $.ui.mount(TERMINAL)
  const nv = (xp: number) => new RegExp(`Nv ${nivelDe(xp).nivel}\\b`)
  expect(await ui.find({ type: 'Text', text: nv(10) })).toBeDefined()
  m.set('jogo', { xp: 4000, paginas: 3, lutas: 40 })
  await $.turn.start({ text: 'oi', turnId: 't1' } as never)
  expect(await ui.find({ type: 'Text', text: nv(4000) })).toBeDefined()
  await ui.unmount()
})

/**
 * Um relógio de mentira que, como o app depois de uma recarga do mod, recusa
 * todo alarme avulso ($.clock.after) e só deixa passar sleep e every.
 */
function relogioSemAlarmes(on: On, now: number) {
  let agora = now
  const esperas: { at: number; ok: () => void }[] = []
  const esperar = (ms: number) => new Promise<void>(ok => esperas.push({ at: agora + ms, ok }))
  const assentar = async () => {
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 0))
    }
  }
  on('clock.now', () => ({ value: agora }))
  on('clock.sleep', async (_, e) => {
    await esperar(e.ms)
    return { value: undefined }
  })
  on('clock.every', async (_, e) => {
    await esperar(Math.max(1, e.ms))
    return { value: undefined }
  })
  on('clock.after', () => ({ deny: 'sem alarmes' }))
  return {
    sleep: esperar,
    async advance(ms: number) {
      const alvo = agora + ms
      await assentar()
      for (;;) {
        esperas.sort((a, b) => a.at - b.at)
        const prox = esperas[0]
        if (prox === undefined || prox.at > alvo) {
          break
        }
        esperas.shift()
        agora = prox.at
        prox.ok()
        await assentar()
      }
      agora = alvo
      await assentar()
    },
  }
}

test('alarme do marco perdido: o pulso redesenha e a Lua ataca assim mesmo', async ($, on) => {
  const clock = relogioSemAlarmes(on, T0)
  on('tool.call', { tool: 'Read' }, async () => {
    await clock.sleep(300)
    return { result: 'feito', text: 'conteúdo do arquivo' }
  })
  loja(on, { idioma: 'pt-BR', jogo: { xp: 137, paginas: 2, lutas: 5 } })
  base(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: false })
  const { ui, svg } = await faixa($)
  const chamada = $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  await clock.advance(300)
  await chamada
  const vistos = new Set<string>()
  for (let t = 0; t < 8000; t += 250) {
    await clock.advance(250)
    const s = await svg()
    for (const pose of ['lua_ataque', 'lua_vitoria']) {
      if (s.includes(`id="${pose}"`)) {
        vistos.add(pose)
      }
    }
  }
  expect([...vistos].sort()).toEqual(['lua_ataque', 'lua_vitoria'])
  // e a luta acaba (o monstro sai da cena)
  expect(await svg()).not.toContain('id="vespera_sem_teia"')
  await ui.unmount()
})

test('instalado no meio da sessão (sem session.start): o primeiro turno carrega o progresso e o idioma', async ($, on) => {
  mock.clock(on, { now: T0 })
  loja(on, { idioma: 'pt-BR', jogo: { xp: 321, paginas: 4, lutas: 9 } })
  base(on, 62)
  // nenhum session.start
  await $.turn.start({ text: 'oi', turnId: 't1' } as never)
  const ui = await $.ui.mount(TERMINAL)
  expect(await ui.find({ type: 'Text', text: new RegExp(`Nv ${nivelDe(321).nivel}\\b`) })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /62%/ })).toBeDefined()
  await ui.unmount()
})
