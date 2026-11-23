"""Empacota a arte aprovada (assets/) para o mod do Claude Code.

Não altera nada em assets/. Só lê, recorta as partes que aparecem na faixa
(sem mudar nenhum pixel), regrava em PNG com paleta (sem perdas) e escreve
hooks/arte.ts no mod, com cada imagem como data URI + medidas.

Uso:  .venv/bin/python construir_mod.py [pasta_do_mod]
"""
import base64
import io
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).parent
A = RAIZ / "assets"
MOD_PADRAO = RAIZ / "mod" / "cronicas-de-lua"  # cópia de trabalho do mod, dentro do projeto


def png_sem_perdas(im: Image.Image) -> bytes:
    """PNG com paleta quando cabe em 256 cores (idêntico pixel a pixel)."""
    im = im.convert("RGBA")
    a = np.array(im)
    flat = a.reshape(-1, 4)
    cores, inv = np.unique(flat, axis=0, return_inverse=True)
    melhor = None
    if len(cores) <= 256:
        p = Image.fromarray(inv.reshape(a.shape[:2]).astype(np.uint8))
        p.putpalette([int(v) for c in cores for v in c[:3]] + [0] * (3 * (256 - len(cores))))
        b = io.BytesIO()
        p.save(b, "PNG", optimize=True, transparency=bytes(int(c[3]) for c in cores))
        melhor = b.getvalue()
        # conferência: tem que voltar igualzinho
        volta = np.array(Image.open(io.BytesIO(melhor)).convert("RGBA"))
        m = a[..., 3] > 0
        assert (volta[m] == a[m]).all() and (volta[..., 3] == a[..., 3]).all()
    b = io.BytesIO()
    im.save(b, "PNG", optimize=True)
    if melhor is None or len(b.getvalue()) < len(melhor):
        melhor = b.getvalue()
    return melhor


ARTE = {}


def guarda(nome, im, **extra):
    dados = png_sem_perdas(im)
    ARTE[nome] = {"u": "data:image/png;base64," + base64.b64encode(dados).decode(), "w": im.width, "h": im.height, **extra}


def abre(p):
    return Image.open(p).convert("RGBA")


def linhas_visiveis(im):
    a = np.array(im)[..., 3].max(1)
    ys = np.where(a > 0)[0]
    return int(ys.min()), int(ys.max()) + 1


def cenario():
    cen = A / "cenarios" / "floresta"
    meta = json.loads((cen / "cenario.json").read_text())
    fundo = abre(cen / "fundo.png")
    # janela usada: chefão 0..226; compacto 8..164 (desce 62). Guardamos 0..226.
    guarda("fundo", fundo.crop((0, 0, fundo.width, 226)), oy=0)
    for nome in ("nuvens", "meio", "chao"):
        im = abre(cen / f"{nome}.png")
        y0, y1 = linhas_visiveis(im)
        y1 = min(y1, 226)
        guarda(nome, im.crop((0, y0, im.width, y1)), oy=y0)
    for i in (1, 2):
        guarda(f"ilha_{i}", abre(cen / f"ilha_{i}.png"))
    # Lua do céu: só os pixels da lua crescente, trocados pela cor do céu da
    # mesma linha. O mod cobre a lua com isto aos poucos (lua minguando).
    a = np.array(fundo)
    claro = (a[..., 0] > 200) & (a[..., 1] > 230) & (a[..., 2] > 200)
    reg = np.zeros_like(claro)
    reg[20:170, 420:580] = True
    lua = claro & reg
    ys, xs = np.where(lua)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    cob = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    for y in range(y0, y1):
        ceu = a[y, 300]  # coluna de céu limpo, longe da lua e do castelo
        for x in range(x0, x1):
            if lua[y, x]:
                cob[y - y0, x - x0] = ceu
    guarda("lua_ceu_cobre", Image.fromarray(cob), x=int(x0), y=int(y0))
    return meta


# poses guardadas em assets/ mas fora do jogo (alternativa não escolhida)
POSES_FORA = {"triste"}


def lua():
    poses = json.loads((A / "lua" / "poses" / "poses.json").read_text())
    for nome, q in poses["quadros"].items():
        if nome in POSES_FORA:
            continue
        guarda(f"lua_{nome}", abre(A / "lua" / "poses" / q["arquivo"]), n=q["n"])
    return poses


def efeitos():
    fx = json.loads((A / "efeitos" / "efeitos.json").read_text())
    for nome in ("projetil", "impacto", "canalizar"):
        guarda(nome, abre(A / "efeitos" / fx[nome]["arquivo"]), n=fx[nome]["quadros"], ms=fx[nome]["ms_por_quadro"])
    # assinatura do autor (assinatura.py): na cena, na Ficha do Livro e nos GIFs
    guarda("assinatura", abre(A / "ui" / "assinatura.png"))
    guarda("exclamacao", abre(A / "efeitos" / "exclamacao.png"))
    # "?" azul: a Lua em dúvida quando o escudo do chefão defende
    guarda("interrogacao", abre(A / "efeitos" / "interrogacao.png"))
    # gota de suor estilo mangá, ao lado do olho, junto com o "?"
    guarda("gota", abre(A / "efeitos" / "gota.png"))
    # escudo do chefão (golpe comum defendido): aparece, bloqueia, some
    guarda("escudo", abre(A / "efeitos" / fx["escudo"]["arquivo"]), n=fx["escudo"]["quadros"], ms=fx["escudo"]["ms_por_quadro"])
    for cor in ("dano", "xp"):
        for c in list("0123456789") + ["mais", "menos", "X", "P"]:
            guarda(f"{cor}_{c}", abre(A / "efeitos" / "digitos" / f"{cor}_{c}.png"))
    part = json.loads((A / "particulas" / "particulas.json").read_text())
    for nome, p in part.items():
        guarda(f"p_{nome}", abre(A / "particulas" / p["arquivo"]), n=p["quadros"], ms=p["ms_por_quadro"], q=p["quadro_px"])
    return fx


def ui():
    u = A / "ui"
    guarda("barra_trilho", abre(u / "barra_trilho.png"))
    guarda("barra_gema", abre(u / "barra_gema.png"))
    for b in ("luz", "mana", "mochila", "xp"):
        guarda(f"barra_{b}", abre(u / f"barra_preench_{b}.png"))
    for d in (2, 3, 4):
        guarda(f"nivel_{d}", abre(u / "nivel" / f"moldura_{d}dig.png"))
    for d in range(10):
        guarda(f"nivel_d{d}", abre(u / "nivel" / f"digito_{d}.png"))
    guarda("nivel_estrela", abre(u / "nivel_estrela.png"))
    guarda("nivel_estrela_lv", abre(u / "nivel_estrela_lv.png"))
    bt = u / "botoes"
    for f in sorted(bt.glob("*.png")):
        guarda("bt_" + f.stem, abre(f))
    # troféus do elite (trofeus.py), no tamanho nativo: aparecem quando ele cai.
    for f in sorted((u / "trofeus").glob("trofeu_*_grande.png")):
        guarda(f.stem, abre(f))
    # o Livro (Fase 4): a estante e os ícones pequenos dos troféus (aprovados)
    guarda("estante", abre(u / "trofeus" / "estante.png"))
    for tipo in ("comando", "edicao", "leitura", "web"):
        guarda(f"trofeu_{tipo}", abre(u / "trofeus" / f"trofeu_{tipo}.png"))


def monstros():
    chefoes = json.loads((A / "chefoes" / "chefoes.json").read_text())
    from tamanho_monstros import para_luta

    for nome, c in chefoes.items():
        # sprite da luta: Golem e Relojoeiro com 110 px, Nébula e Leviatã com 126 (faixa de altura fixa)
        guarda(f"m_{nome}", para_luta(nome))
        guarda(f"f_{nome}", abre(A / "chefoes" / nome / c["frente"]))
    teia = A / "chefoes" / "vespera" / "teia"
    guarda("vespera_sem_teia", abre(teia / "vespera_02_sem_teia.png"))
    for i in range(4):
        guarda(f"teia_{i}", abre(teia / f"teia_giro_{i}.png"))
    return chefoes


LETRAS = "".join(chr(c) for c in range(0x20, 0x7F)) + "áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÇ·–—…ªº°"
# espanhol, francês e alemão (etapa d da tradução)
LETRAS += "¡¿ñÑèëîïûùÿœæÈËÎÏÛÙŸŒÆäößÄÖÜ«»’"


def _woff2(f, letras: str = LETRAS) -> str:
    from fontTools import subset

    op = subset.Options()
    op.flavor = "woff2"
    op.layout_features = ["kern"]
    op.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    s = subset.Subsetter(op)
    s.populate(text=letras)
    s.subset(f)
    b = io.BytesIO()
    f.flavor = "woff2"
    f.save(b)
    return "data:font/woff2;base64," + base64.b64encode(b.getvalue()).decode()


def fonte(mod: Path) -> str:
    """Silkscreen (OFL) só com as letras do jogo, em WOFF2: barras (textos curtos).

    Escolhida pelo usuário em 22/11/2026 no lugar da Pixelify Sans nas barras (o
    Z, o 7 e o 8 da Pixelify dificultavam a leitura). Grade de 8 px: 8, 12 ou 16 px.
    """
    from fontTools.ttLib import TTFont

    (mod / "fontes").mkdir(exist_ok=True)
    (mod / "fontes" / "OFL.txt").write_bytes((A / "fontes" / "silkscreen" / "OFL.txt").read_bytes())
    return _woff2(TTFont(A / "fontes" / "silkscreen" / "Silkscreen-Regular.ttf"))


def fonte_longa(mod: Path) -> str:
    """Pixelify Sans (OFL), peso 500: textos longos (balões, aviso de lua nova).

    Tem minúsculas de verdade; em frase longa lê melhor que a Silkscreen.
    """
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    (mod / "fontes" / "OFL-PixelifySans.txt").write_bytes((A / "fontes" / "OFL.txt").read_bytes())
    return _woff2(instancer.instantiateVariableFont(TTFont(A / "fontes" / "PixelifySans[wght].ttf"), {"wght": 500}))


# Chinês, japonês e coreano (opção A, escolhida pelo usuário em 23/11/2026): a
# Fusion Pixel 12 px (OFL) entra NO LUGAR da Silkscreen e da Pixelify nesses
# idiomas. Três recortes por idioma, cada um com ASCII + as letras dos textos
# que aparecem naquele desenho (o orçamento da cena é apertado):
#   cena   barras, chefão, luta (o que a faixa desenha sempre)
#   baloes balões do hover e aviso de lua nova (só no modo quadro / lua nova)
#   livro  o Livro inteiro (títulos e textos)
# Na cena o CSS lista as famílias em sequência; a letra que falta numa cai na seguinte.
FUSION = {"zh-CN": "zh_hans", "ja": "ja", "ko": "ko"}
ASCII = LETRAS  # ASCII e os acentos latinos (nomes de erro no troféu, Nébula)
CENA_CHAVES = re.compile(r"^(chefoes|chefao|luta)\.|^barras\.[a-z]+\.(nome|nome_cheia|curto|minutos|lua_nova)$")
BALOES_CHAVES = re.compile(r"^(barras|botoes|lua_nova|chefoes)\.")
LIVRO_CHAVES = re.compile(r"^(livro|chefoes|luta)\.")


def _achatar(obj, prefixo=""):
    for k, v in obj.items():
        if k.startswith("_"):
            continue
        if isinstance(v, dict):
            yield from _achatar(v, f"{prefixo}{k}.")
        else:
            yield f"{prefixo}{k}", v


def fontes_cjk(mod: Path) -> dict:
    """Os recortes da Fusion para cada idioma CJK que já tem tradução."""
    from fontTools.ttLib import TTFont

    pasta = A / "fontes" / "fusion-pixel"
    out = {}
    for idioma, variante in FUSION.items():
        arq = mod / "idiomas" / f"{idioma}.json"
        if not arq.exists():
            continue
        textos = dict(_achatar(json.loads(arq.read_text(encoding="utf-8"))))
        def letras(chaves):
            # sem os marcadores {x}, que viram números ou nomes
            s = "".join(re.sub(r"\{[a-z_]+\}", "", v) for k, v in textos.items() if chaves.match(k))
            return ASCII + "".join(sorted(set(s) - set(ASCII) - {"\n"}))
        fonte_arq = pasta / f"fusion-pixel-12px-proportional-{variante}.otf.woff2"
        out[idioma] = {parte: _woff2(TTFont(fonte_arq), letras(ch))
                       for parte, ch in (("cena", CENA_CHAVES), ("baloes", BALOES_CHAVES), ("livro", LIVRO_CHAVES))}
        print(f"Fusion {idioma}: " + " · ".join(f"{p} {len(v) / 1000:.1f} mil" for p, v in out[idioma].items()))
    if out:
        (mod / "fontes" / "OFL-FusionPixel.txt").write_bytes((pasta / "OFL.txt").read_bytes())
        for sub in (pasta / "LICENSES").iterdir():
            if sub.is_dir():
                for lic in sub.iterdir():
                    if lic.is_file():
                        (mod / "fontes" / f"OFL-{sub.name}.txt").write_bytes(lic.read_bytes())
    return out


def marca():
    """A marca animada da abertura (assets/marca/animacao/, via marca_svg.py)."""
    import marca_svg  # aqui dentro: marca_svg importa este arquivo
    return marca_svg.fragmento(inicio_reflexo=1.1)


def main():
    mod = Path(sys.argv[1]) if len(sys.argv) > 1 else MOD_PADRAO
    meta = {
        "cenario": cenario(),
        "poses": lua(),
        "efeitos": efeitos(),
        "chefoes": monstros(),
        "monstros": json.loads((A / "monstros" / "monstros.json").read_text()),
        "barra": json.loads((A / "ui" / "barra.json").read_text()),
        "nivel": json.loads((A / "ui" / "nivel" / "nivel.json").read_text()),
        "teia": json.loads((A / "chefoes" / "vespera" / "teia" / "teia.json").read_text()),
        "trofeus": json.loads((A / "ui" / "trofeus" / "trofeus.json").read_text()),
    }
    ui()
    linhas = [
        "// Gerado por construir_mod.py a partir de assets/ (arte aprovada). Não edite à mão.",
        "// Arte e personagens: (c) 2026 George Altran (@geoaltran), CC BY-NC 4.0, sem uso comercial sem autorização (LICENSE-ART).",
        "// Fonte: Silkscreen, (c) 2001 The Silkscreen Project Authors, SIL Open Font License 1.1 (fontes/OFL.txt).",
        "// Fonte dos textos longos: Pixelify Sans, (c) 2021 The Pixelify Sans Project Authors, SIL Open Font License 1.1 (fontes/OFL-PixelifySans.txt).",
        "// Fonte do chinês, japonês e coreano: Fusion Pixel Font, (c) TakWolf, SIL Open Font License 1.1 (fontes/OFL-FusionPixel.txt; inclui Ark Pixel, Cubic 11 e Galmuri, licenças em fontes/OFL-*.txt).",
        "export type Arte = { u: string; w: number; h: number; [k: string]: unknown }",
        f"export const FONTE = {json.dumps(fonte(mod))}",
        f"export const FONTE_LONGA = {json.dumps(fonte_longa(mod))}",
        "// Fusion Pixel por idioma (zh-CN, ja, ko): recortes da cena, dos balões e do Livro.",
        f"export const FONTES_CJK: Record<string, {{ cena: string; baloes: string; livro: string }}> = {json.dumps(fontes_cjk(mod))}",
        f"export const META = {json.dumps(meta, ensure_ascii=False)} as const",
        "// Marca animada (marca_svg.py): miolo em px nativos + CSS; usada na tela de abertura.",
        f"export const MARCA = {json.dumps(marca())} as const",
        "export const ARTE: Record<string, Arte> = {",
    ]
    for k, v in ARTE.items():
        linhas.append(f"  {json.dumps(k)}: {json.dumps(v)},")
    linhas.append("}")
    destino = mod / "hooks" / "arte.ts"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(linhas) + "\n")
    tam = sorted(((len(v["u"]), k) for k, v in ARTE.items()), reverse=True)
    print(f"{destino}: {destino.stat().st_size // 1024} KB, {len(ARTE)} imagens")
    for n, k in tam[:14]:
        print(f"  {n:7d}  {k}")


if __name__ == "__main__":
    main()
