/**
 * Aviso de versão nova (1.1.2). Uma vez por dia, na primeira sessão, o mod lê o
 * número da versão no plugin.json PÚBLICO do repositório no GitHub e compara
 * com o da versão instalada. Se houver uma mais nova, o botão do Livro ganha uma
 * estrelinha e o balão dele avisa; nada é baixado nem instalado: quem atualiza
 * é a pessoa, com o comando do próprio Claude Code.
 *
 * Privacidade: o pedido é um GET simples, sem cabeçalhos, cookies nem dados da
 * pessoa ou da sessão (o GitHub vê só o endereço de rede, como em qualquer
 * acesso). Passa pelo Claude Code, então respeita a política de rede da
 * empresa; não sai nada com CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ligado.
 * Desliga com `/cronicas updates off`. Da resposta só se aproveita um número
 * de versão validado (nenhum texto vindo de fora aparece na tela).
 */

/** O plugin.json público do mod (só leitura). */
export const URL_VERSAO = 'https://raw.githubusercontent.com/geoaltran/cronicas-de-lua-claude-code/main/mod/cronicas-de-lua/.claude-plugin/plugin.json'

/** Os dois comandos do Claude Code que atualizam (catálogo, depois o mod). */
export const CMD_CATALOGO = '/plugin marketplace update cronicas-de-lua'
export const CMD_ATUALIZAR = '/plugin update cronicas-de-lua@cronicas-de-lua'

/** O que fica guardado entre sessões (no `$.store`, chave 'atualizacao'). */
export type Atualizacao = {
  /** true: a pessoa desligou o aviso (o mod não consulta o GitHub). */
  desligada?: boolean
  /** Dia (AAAA-MM-DD, hora local) da última consulta. */
  dia?: string
  /** A versão publicada que a última consulta achou. */
  remota?: string
  /** A versão nova que já ganhou o aviso de canto (uma vez por versão). */
  avisada?: string
}

const FORMATO = /^\d{1,4}(\.\d{1,4}){0,3}$/

/** Só um número de versão (1.2.0); qualquer outra coisa vira undefined. */
export function versaoValida(v: unknown): string | undefined {
  return typeof v === 'string' && FORMATO.test(v.trim()) ? v.trim() : undefined
}

/** A versão de um plugin.json (texto), validada. */
export function versaoDoJson(texto: string): string | undefined {
  try {
    const j = JSON.parse(texto) as { version?: unknown } | null
    return versaoValida(j?.version)
  } catch {
    return undefined
  }
}

/** Compara duas versões número a número: >0 se `a` é mais nova que `b`. */
export function compararVersoes(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) {
      return d
    }
  }
  return 0
}

/** A versão nova, se a publicada passa da instalada; senão null. */
export function versaoNova(remota: string | undefined, local: string | undefined): string | null {
  return remota !== undefined && local !== undefined && compararVersoes(remota, local) > 0 ? remota : null
}

/** A próxima versão de mentira (para `/cronicas updates test`): sobe o último número. */
export function versaoDeTeste(local: string | undefined): string {
  const p = (versaoValida(local) ?? '1.0.0').split('.').map(Number)
  p[p.length - 1] = (p[p.length - 1] ?? 0) + 1
  return p.join('.')
}
