"""Junta os textos do jogo (mod/cronicas-de-lua/idiomas/*.json) em hooks/idiomas.ts.

O módulo do mod só carrega código (.ts), não .json: por isso os textos, que
ficam num arquivo por idioma para quem traduz, viram um .ts gerado. Não edite
o idiomas.ts à mão: edite o .json e rode de novo.

Uso: python3 idiomas.py [pasta_do_mod]   (padrão: mod/cronicas-de-lua)

Cada .json é um objeto aninhado; as chaves viram "parte.sub.chave". Chaves que
começam com "_" são notas para quem traduz e não entram no jogo. Confere que
todo idioma tem as mesmas chaves e os mesmos marcadores {x} do padrão.
"""
import json
import re
import sys
from pathlib import Path

PADRAO = "pt-BR"
AQUI = Path(__file__).resolve().parent


def achatar(obj, prefixo=""):
    out = {}
    for k, v in obj.items():
        if k.startswith("_"):
            continue
        chave = f"{prefixo}{k}"
        if isinstance(v, dict):
            out.update(achatar(v, chave + "."))
        elif isinstance(v, str):
            out[chave] = v
        else:
            raise SystemExit(f"{chave}: valor precisa ser texto ou objeto")
    return out


def conferir_codigo(mod, base):
    """Toda chave usada no código (t/tx/tp('...') ou com ${...}) tem que existir no padrão."""
    uso = re.compile(r"\b(?:t|tx|tp)\((['`])([a-z_][\w.${}]*?)\1")
    faltam = []
    for arq in sorted((mod / "hooks").glob("*.ts*")):
        if arq.name in ("idiomas.ts", "arte.ts", "t.ts"):
            continue
        for _, chave in uso.findall(arq.read_text(encoding="utf-8")):
            if "${" in chave:
                padrao = re.compile("^" + re.sub(r"\\\$\\\{[^}]*\\\}", r"[\\w]+", re.escape(chave)) + r"(\.(um|outros))?$")
                ok = any(padrao.match(k) for k in base)
            else:
                ok = chave in base or f"{chave}.um" in base
            if not ok:
                faltam.append(f"{arq.name}: {chave}")
    if faltam:
        raise SystemExit("chaves usadas no código que não existem em " + PADRAO + ".json:\n  " + "\n  ".join(faltam))


def main():
    mod = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / "mod" / "cronicas-de-lua"
    pasta = mod / "idiomas"
    idiomas = {}
    for arq in sorted(pasta.glob("*.json")):
        idiomas[arq.stem] = achatar(json.loads(arq.read_text(encoding="utf-8")))
    if PADRAO not in idiomas:
        raise SystemExit(f"falta {pasta / (PADRAO + '.json')}")
    base = idiomas[PADRAO]
    marc = lambda s: sorted(set(re.findall(r"\{(\w+)\}", s)))
    for cod, txt in idiomas.items():
        if cod == PADRAO:
            continue
        faltam = [k for k in base if k not in txt]
        sobram = [k for k in txt if k not in base]
        difer = [k for k in base if k in txt and marc(base[k]) != marc(txt[k])]
        for nome, lista in (("faltam", faltam), ("sobram", sobram), ("marcadores diferentes", difer)):
            if lista:
                print(f"{cod}: {nome}: {', '.join(lista[:10])}{' ...' if len(lista) > 10 else ''}")
    conferir_codigo(mod, base)
    linhas = [
        "// GERADO por idiomas.py a partir de idiomas/*.json. Não edite à mão.",
        f"export const PADRAO = {json.dumps(PADRAO)}",
        "export const IDIOMAS: Record<string, Record<string, string>> = "
        + json.dumps(idiomas, ensure_ascii=False, indent=1),
        "",
    ]
    (mod / "hooks" / "idiomas.ts").write_text("\n".join(linhas), encoding="utf-8")
    print(f"idiomas.ts: {', '.join(f'{c} ({len(t)} textos)' for c, t in idiomas.items())}")


if __name__ == "__main__":
    main()
