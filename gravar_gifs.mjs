// Grava os GIFs do README a partir do próprio jogo: o mesmo SVG que o mod
// desenha na faixa (e as páginas do Livro), montado instante a instante com o
// código de mod/cronicas-de-lua/hooks, fotografado no Chrome sem janela com as
// animações pausadas, e juntado em GIF por montar_gif.py.
//
// Uso: node gravar_gifs.mjs [caminhada] [luta] [chefao_penumbra] [chefao_relojoeiro] [chefao_golem]
//      [livro] [biomas] [passagem]
//      (sem nomes: todos). Precisa do Google Chrome (ou CHROME=<caminho>) e da
//      .venv com Pillow. Grava previa_<nome>.gif na raiz do projeto.
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const RAIZ = import.meta.dirname
const HOOKS = join(RAIZ, 'mod', 'cronicas-de-lua', 'hooks')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PY = join(RAIZ, '.venv', 'bin', 'python')
const tmp = mkdtempSync(join(tmpdir(), 'cronicas-gif-'))
const sleep = ms => new Promise(r => setTimeout(r, ms))

// o código do mod roda direto no node (TypeScript sem tipos); só os imports ganham ".ts"
const cod = join(tmp, 'cod')
mkdirSync(cod)
for (const f of readdirSync(HOOKS)) {
  if (f.endsWith('.ts')) {
    writeFileSync(join(cod, f), readFileSync(join(HOOKS, f), 'utf8').replace(/from '\.\/([a-z]+)'/g, "from './$1.ts'"))
  }
}
const { usarIdioma } = await import(join(cod, 't.ts'))
usarIdioma(process.env.IDIOMA ?? 'en')
const { montar, distancia, nivelDe } = await import(join(cod, 'cena.ts'))
const { marcos, quandoAcerta } = await import(join(cod, 'luta.ts'))
const { critico, QUEDA_MS } = await import(join(cod, 'chefao.ts'))
const { paginaDoLivro } = await import(join(cod, 'livro.ts'))

// ---------------------------------------------------------------- Chrome pelo protocolo de depuração

async function abrirChrome() {
  const dados = join(tmp, 'chrome')
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${dados}`, 'about:blank'], { stdio: 'ignore' })
  let porta
  for (let i = 0; i < 150 && porta === undefined; i++) {
    await sleep(100)
    try {
      porta = readFileSync(join(dados, 'DevToolsActivePort'), 'utf8').split('\n')[0]
    } catch {}
  }
  const pg = (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find(t => t.type === 'page')
  const ws = new WebSocket(pg.webSocketDebuggerUrl)
  await new Promise(r => (ws.onopen = r))
  let id = 0
  const esperando = new Map()
  ws.onmessage = m => {
    const d = JSON.parse(m.data)
    const e = esperando.get(d.id)
    if (e !== undefined) {
      esperando.delete(d.id)
      d.error ? e[1](new Error(JSON.stringify(d.error))) : e[0](d.result)
    }
  }
  const cmd = (method, params = {}) => new Promise((ok, er) => {
    const i = ++id
    esperando.set(i, [ok, er])
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  return { cmd, fechar: () => { ws.close(); ch.kill() } }
}

/**
 * Fotografa um SVG com as animações paradas no instante em que ele foi montado,
 * mais `avanco` ms (para desenhos que não recebem o relógio, como o Livro).
 * O mesmo SVG do quadro anterior não é inserido de novo: só o tempo anda.
 */
let ultimo = null
async function foto(cmd, svg, w, h, arq, avanco = 0) {
  const novo = svg !== ultimo
  ultimo = svg
  const r = await cmd('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async () => {
      const quadro = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (${novo}) {
        document.body.innerHTML = ${novo ? JSON.stringify(svg) : "''"}
        // todo <svg> tem o seu relógio SMIL: pausa todos (só o primeiro deixava a Lua correr)
        for (const s of document.querySelectorAll('svg')) s.pauseAnimations?.()
        window.__anims = document.getAnimations()
        for (const a of window.__anims) a.pause()
        window.__base = window.__anims.map(a => Number(a.currentTime ?? 0))
        await document.fonts.ready
        // as imagens (data:) decodificam sem pressa: espera cada uma antes da foto
        window.__prontas ??= new Set()
        for (const el of document.querySelectorAll('image')) {
          const u = el.getAttribute('href')
          if (u !== null && !window.__prontas.has(u)) {
            const im = new Image()
            im.src = u
            await im.decode().catch(() => {})
            window.__prontas.add(u)
          }
        }
        await quadro()
        await new Promise(r => setTimeout(r, 25))
        await quadro()
      }
      window.__anims.forEach((a, i) => { a.currentTime = window.__base[i] + ${avanco} })
      for (const s of document.querySelectorAll('svg')) s.setCurrentTime?.(${avanco / 1000})
      await quadro()
      return 1
    })()`,
  })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  const { data } = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } })
  writeFileSync(arq, Buffer.from(data, 'base64'))
}

/** Grava um GIF: `quadro(i)` devolve o SVG (e o tamanho) do quadro i; `ms` por quadro. */
async function gravar(cmd, nome, n, ms, quadro) {
  const pasta = join(tmp, nome)
  mkdirSync(pasta)
  let tam = null
  for (let i = 0; i < n; i++) {
    const q = quadro(i)
    if (tam === null || tam.w !== q.w || tam.h !== q.h) {
      tam = { w: q.w, h: q.h }
      await cmd('Emulation.setDeviceMetricsOverride', { width: q.w, height: q.h, deviceScaleFactor: 1, mobile: false })
    }
    await foto(cmd, q.svg, q.w, q.h, join(pasta, `${String(i).padStart(4, '0')}.png`), q.avanco ?? 0)
  }
  const saida = join(RAIZ, `previa_${nome}.gif`)
  execFileSync(PY, [join(RAIZ, 'montar_gif.py'), pasta, saida, String(ms)], { stdio: 'inherit' })
}

// ---------------------------------------------------------------- estado do jogo nos roteiros

const T = 1795000000000
const W = 560
const ESCALA = 2
const xpDoNivel = (alvo, mais = 0) => {
  let lo = 0
  let hi = 1e8
  while (lo < hi) {
    const m = Math.floor((lo + hi) / 2)
    if (nivelDe(m).nivel >= alvo) hi = m
    else lo = m + 1
  }
  return lo + mais
}
const hud = (agora, extra = {}) => ({
  luz: { at: agora - 17 * 60000, ttlMs: 3600000 },
  mana: { cinco: 31, cincoRenova: new Date(agora + 2 * 3600e3).toISOString(), sete: 58 },
  mochila: 42,
  jogo: { xp: xpDoNivel(12, 40), paginas: 3, lutas: 9 },
  ...extra,
})
const cena = (agora, v) => {
  const r = montar({ agora, W, escala: ESCALA, modo: 'compacto', celula: 8.8, botoes: true, semBaloes: true, textoLongo: false, hud: hud(agora), ...v })
  return { svg: r.svg, w: r.largura, h: r.altura }
}

/** Uma luta (o monstro entra em t0; cada golpe tem o instante do resultado). */
const luta = (papel, monstro, t0, golpes, extra = {}) => ({ n: 1, papel, monstro, t0, ativas: 0, golpes, fecha: Math.max(...golpes.map(g => g.at)) + 1500, ...extra })
/** Quando a luta termina de vez na tela (último marco do roteiro). */
const fimDa = l => Math.max(...marcos(l)) + 400

const ROTEIROS = {
  // a Lua anda pela floresta (passada de 8 quadros), para, respira e pisca
  caminhada: { ms: 55, seg: 9.9, cena: t => {
    const para = T + 5500
    const caminho = { andando: true, desde: T, dist0: 300, ate: para }
    return cena(t, { bioma: 'floresta', caminho: t < para ? caminho : { andando: false, desde: para, dist0: distancia(caminho, para) } })
  } },

  // luta comum: um comando demorado chama o Ignis (no Vulcão, o bioma dele); a Lua canaliza até o resultado e vence
  luta: (() => {
    const t0 = T + 1400
    const l = luta('terminal', 'ignis', t0, [{ at: t0 + 3600, ok: true, dano: 23 }])
    const fim = fimDa(l)
    const ida = { andando: true, desde: T - 2000, dist0: 300, ate: t0 + 700 }
    return { ms: 55, seg: (fim - T) / 1000 + 2.4, cena: t => {
      if (t < t0) return cena(t, { bioma: 'vulcao', caminho: ida })
      if (t < fim) return cena(t, { bioma: 'vulcao', caminho: ida, luta: l })
      return cena(t, { bioma: 'vulcao', caminho: { andando: true, desde: fim, dist0: distancia(ida, fim) }, hud: hud(t, { jogo: { xp: xpDoNivel(12, 42), paginas: 3, lutas: 10 } }) })
    } }
  })(),
}

/**
 * Chefão de lista (3 tarefas, blocos de 10): o golpe comum bate no escudo (a Lua
 * coça a cabeça), uma tarefa concluída derruba um bloco e a última é o crítico;
 * ele cai, a página volta e a Lua sobe de nível.
 */
function chefaoDeLista(nome, papel, pagina) {
  const parada = { andando: false, desde: T - 20000, dist0: 500 }
  const base = { nome, pagina, origem: 'lista', t0: T - 9000, bloco: 10, vidaMax: 30, vida: 30, tarefas: { total: 3, feitas: 0 } }
  const segs = []
  let s = T + 600
  // 1) ferramenta comum: o escudo segura e tira só 2
  const l1 = luta(papel, nome, s, [{ at: s + 300, ok: true, dano: 14, escudo: 2 }], { fixo: true })
  segs.push({ de: s, ate: fimDa(l1), luta: l1, chefao: { ...base, vida: 28, golpe: { at: quandoAcerta(l1, s + 300), antes: 30 } } })
  // 2) tarefa concluída: a vida desce até o fim do bloco
  s = fimDa(l1) + 500
  const l2 = luta(papel, nome, s, [{ at: s + 300, ok: true, dano: 9, tarefa: 8 }], { fixo: true })
  segs.push({ de: s, ate: fimDa(l2), luta: l2, chefao: { ...base, vida: 20, golpe: { at: quandoAcerta(l2, s + 300), antes: 28 }, tarefas: { total: 3, feitas: 1 } } })
  // 3) as duas últimas tarefas de uma vez: golpe crítico, ele cai
  s = fimDa(l2) + 500
  const l3 = luta(papel, nome, s, [{ at: s + 300, ok: true, dano: 9, critico: critico(20, 9) }], { fixo: true, final: true })
  const acerto = quandoAcerta(l3, s + 300)
  const caiu = acerto + 1500
  segs.push({ de: s, ate: caiu + QUEDA_MS + 1200, luta: l3, chefao: { ...base, vida: 0, golpe: { at: acerto, antes: 20 }, caiu, tarefas: { total: 3, feitas: 3 } } })
  const fim = segs.at(-1).ate
  return { ms: 55, seg: (fim - T) / 1000, cena: t => {
    const g = segs.find(x => t >= x.de && t < x.ate)
    const antes = segs.filter(x => x.ate <= t).at(-1)
    const ch = g?.chefao ?? { ...(antes?.chefao ?? base), golpe: undefined }
    const v = { caminho: parada, chefao: ch }
    // ele caiu: página recuperada e um nível a mais na HUD
    if (t >= caiu) v.hud = hud(t, { jogo: { xp: xpDoNivel(13, 4), paginas: pagina, lutas: 10 } })
    if (g !== undefined && t < fimDa(g.luta)) v.luta = g.luta
    return cena(t, v)
  } }
}
ROTEIROS.chefao_penumbra = chefaoDeLista('dama_penumbra', 'subagente', 2)
ROTEIROS.chefao_relojoeiro = chefaoDeLista('relojoeiro', 'editar', 6)
ROTEIROS.chefao_golem = chefaoDeLista('golem_obsidiana', 'terminal', 3)

// os 9 biomas: a Lua andando, um pouco em cada um (corte seco de um para o outro)
const BIOMAS = ['floresta', 'ruinas', 'mar', 'vulcao', 'torre', 'aurora', 'castelo_vidro', 'ceu_estelar', 'eclipse']
const POR_BIOMA = Number(process.env.POR_BIOMA ?? 1.65)
// 110 ms: o mesmo ritmo da passada da Lua (e o GIF fica abaixo de ~6 MB)
ROTEIROS.biomas = { ms: 110, seg: BIOMAS.length * POR_BIOMA, cena: t => {
  const k = Math.min(BIOMAS.length - 1, Math.floor((t - T) / 1000 / POR_BIOMA))
  return cena(t, { bioma: BIOMAS[k], caminho: { andando: true, desde: T - 4000, dist0: 300 + k * 900 } })
} }

// passagem de fase: o Golem caiu nas Ruínas; a Lua sai andando, escurece, o título
// "PAGE 4 · SEA" aparece e ela entra no Mar
ROTEIROS.passagem = (() => {
  const at = T + 900
  const p = { at, de: 'ruinas', para: 'mar', pagina: 4 }
  const fimP = at + 4300 + 4000
  const parada = { andando: false, desde: T - 20000, dist0: 500 }
  const fases = {}
  // 40 ms por quadro: na saída a passada da Lua troca a cada 45 ms e, a 55 ms, o GIF pulava passadas
  return { ms: Number(process.env.PASSAGEM_MS ?? 40), seg: (fimP - T) / 1000 + 1.8, cena: t => {
    if (t < at) return cena(t, { bioma: 'ruinas', caminho: parada })
    if (t < fimP) {
      // como no app: uma cena por fase (saída e entrada), só o relógio anda. Remontar a
      // cena a cada quadro fazia a Lua ir e voltar (o Chrome não repõe o SMIL no ponto certo)
      const inicio = t < at + 4300 ? at : at + 4300
      const base = (fases[inicio] ??= cena(inicio, { caminho: parada, passagem: p }))
      return { ...base, avanco: t - inicio }
    }
    return cena(t, { caminho: { andando: true, desde: fimP, dist0: 0 } })
  } }
})()

// o Livro: ficha, bestiário, troféus (de tipos diferentes) e grimório, uma página de cada vez
const JOGO_LIVRO = {
  xp: xpDoNivel(14, 70),
  paginas: 4,
  lutas: 52,
  trofeus: ['ENOENT: NO SUCH FILE', 'COMMAND NOT FOUND', 'STRING NOT FOUND', '404 NOT FOUND', 'PERMISSION DENIED', 'EXIT CODE 1', 'FILE NOT READ YET', 'TIMEOUT', 'SYNTAXERROR'],
  trofeusTipos: ['leitura', 'comando', 'edicao', 'web', 'comando', 'edicao', 'leitura', 'web', 'edicao'],
  feiticos: { ler: 48, editar: 31, terminal: 19, web: 7, integracao: 3, subagente: 2 },
}
const LARGURA_LIVRO = Number(process.env.LARGURA_LIVRO ?? 700)
const ALTURA_LIVRO = Number(process.env.ALTURA_LIVRO ?? 0)
ROTEIROS.livro = (() => {
  const abas = ['ficha', 'mapa', 'bestiario', 'trofeus', 'grimorio']
  const porAba = 3.2
  const paginas = {}
  return { ms: 55, seg: abas.length * porAba, cena: t => {
    const aba = abas[Math.min(abas.length - 1, Math.floor((t - T) / 1000 / porAba))]
    // a página do Livro anima a partir de quando abre: o mesmo desenho, com o tempo andando
    const p = paginas[aba] ??= paginaDoLivro(aba, JOGO_LIVRO, LARGURA_LIVRO, 2)
    const desde = T + abas.indexOf(aba) * porAba * 1000
    return { svg: p.svg, w: Math.round(p.largura), h: ALTURA_LIVRO || Math.round(p.altura), avanco: t - desde }
  } }
})()

// ---------------------------------------------------------------- grava

const pedidos = process.argv.slice(2).filter(a => !a.startsWith('-'))
const { cmd, fechar } = await abrirChrome()
try {
  await cmd('Page.enable')
  await cmd('Runtime.evaluate', { expression: "document.documentElement.style.background='#000';document.body.style.margin='0'" })
  for (const [nome, r] of Object.entries(ROTEIROS)) {
    if (pedidos.length > 0 && !pedidos.includes(nome)) continue
    const n = Math.round((r.seg * 1000) / r.ms)
    const t1 = Date.now()
    await gravar(cmd, nome, n, r.ms, i => r.cena(T + i * r.ms))
    console.log(`${nome}: ${n} quadros em ${((Date.now() - t1) / 1000).toFixed(1)} s`)
  }
} finally {
  fechar()
  if (process.env.GUARDAR === undefined) rmSync(tmp, { recursive: true, force: true })
  else console.log(`quadros em ${tmp}`)
}
