// Textos do jogo por idioma. Os textos ficam em idiomas/<idioma>.json (um
// arquivo por idioma); idiomas.py os junta em hooks/idiomas.ts, porque o
// módulo do mod só carrega código. Aqui: t(chave, valores) e tp (plurais).
//
// Marcadores: "{nome}" no texto é trocado por valores.nome. Plural: tp('x', n)
// usa a chave "x.um" quando n é 1 e "x.outros" nos outros casos.
import { IDIOMAS, PADRAO } from './idiomas'

let atual: string = PADRAO

/** O idioma em uso. */
export function idioma(): string {
  return atual
}

/** Troca o idioma (se não houver tradução, fica o padrão). */
export function usarIdioma(cod: string): void {
  atual = IDIOMAS[cod] !== undefined ? cod : PADRAO
}

/** Os idiomas do jogo, cada um escrito no próprio idioma (a lista do /cronicas language). */
export const LINGUAS: readonly { cod: string; nome: string }[] = [
  { cod: 'en', nome: 'English' },
  { cod: 'pt-BR', nome: 'Português' },
  { cod: 'es', nome: 'Español' },
  { cod: 'fr', nome: 'Français' },
  { cod: 'de', nome: 'Deutsch' },
  { cod: 'zh-CN', nome: '中文' },
  { cod: 'ja', nome: '日本語' },
  { cod: 'ko', nome: '한국어' },
]

/** Se o idioma já tem tradução. */
export function temTraducao(cod: string): boolean {
  return IDIOMAS[cod] !== undefined
}

/** O nome do idioma no próprio idioma ("Português"), ou o código. */
export function nomeDaLingua(cod: string): string {
  return LINGUAS.find(l => l.cod === cod)?.nome ?? cod
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * O código do idioma pelo que foi digitado ou pela variável do sistema:
 * "pt", "pt-br", "pt_BR.UTF-8", "portugues", "English", "zh", "日本語"...
 * Undefined se não for nenhum dos 8.
 */
export function codigoDe(texto: string | undefined): string | undefined {
  const x = sem((texto ?? '').trim()).replace(/\..*$/, '').replace(/_/g, '-')
  if (x === '' || x === 'c' || x === 'posix') {
    return undefined
  }
  const porNome = LINGUAS.find(l => sem(l.nome) === x || sem(l.cod) === x)
  if (porNome !== undefined) {
    return porNome.cod
  }
  // só a língua ("pt", "zh"), ou língua com outra região ("pt-PT", "es-MX")
  const base = x.split('-')[0]
  return LINGUAS.find(l => sem(l.cod).split('-')[0] === base)?.cod
}

/** O idioma do sistema (LANG...), se tiver tradução; senão inglês. */
export function idiomaDoSistema(vars: readonly (string | undefined)[]): string {
  for (const v of vars) {
    const cod = codigoDe(v)
    if (cod !== undefined) {
      return temTraducao(cod) ? cod : 'en'
    }
  }
  return 'en'
}

/** Todas as chaves do idioma padrão (para os testes). */
export function chaves(): string[] {
  return Object.keys(IDIOMAS[PADRAO] ?? {})
}

type Valores = Record<string, string | number>

/** O texto da chave no idioma em uso (ou no padrão, se faltar), com os marcadores trocados. */
export function t(chave: string, v?: Valores): string {
  const s = IDIOMAS[atual]?.[chave] ?? IDIOMAS[PADRAO]?.[chave] ?? chave
  return v === undefined ? s : s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))
}

/** Plural: "chave.um" quando n é 1, "chave.outros" senão; {n} vira o número. */
export function tp(chave: string, n: number, v?: Valores): string {
  return t(`${chave}.${n === 1 ? 'um' : 'outros'}`, { n, ...v })
}
