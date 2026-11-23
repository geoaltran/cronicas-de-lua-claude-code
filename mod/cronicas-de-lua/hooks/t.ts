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
