"""Prévia da Fase 3: os 10 chefões na faixa fixa (156 px de cena, chão a 139 px do topo).

Usa os mesmos tamanhos das lutas comuns (tamanho_monstros.para_luta) e mostra
três opções de tamanho para o Malakor. Não altera nada em assets/.

Uso: .venv/bin/python previa_tamanhos_chefoes.py  -> previa_tamanhos_chefoes.png
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from tamanho_monstros import A, original, para_luta

RAIZ = Path(__file__).parent
CENA_H = 156          # altura da cena no modo compacto (226 - 70)
CHAO = 139            # linha dos pés, do topo da cena
FUNDO_TOPO = 8        # o fundo desce 62 px: recorte começa em y=8
JANELA_TOPO = 70
ORDEM = ["vespera", "dama_penumbra", "golem_obsidiana", "leviata", "ignis",
         "relojoeiro", "sir_solis", "rei_espelho", "nebula"]
NOMES = {"vespera": "Vespera", "dama_penumbra": "Dama Penumbra", "golem_obsidiana": "Golem",
         "leviata": "Leviatã", "ignis": "Ignis", "relojoeiro": "Relojoeiro", "sir_solis": "Sir Solis",
         "rei_espelho": "Rei Espelho", "nebula": "Nébula", "malakor": "Malakor"}
INFO = json.loads((A / "chefoes" / "chefoes.json").read_text())


def malakor(opcao: str) -> Image.Image:
    from preparar_assets import ampliar_pixelart
    im = Image.open(A / "chefoes" / "malakor" / INFO["malakor"]["arena"]).convert("RGBA")
    o = original("malakor", im)  # 92 x 90
    if opcao == "A":  # 126 px: reduz a versão aprovada (180 -> 126)
        return im.resize((round(im.width * 126 / im.height), 126), Image.NEAREST)
    if opcao == "B":  # 120 px: desenho original x 4/3
        return o.resize((round(o.width * 120 / o.height), 120), Image.NEAREST)
    g = ampliar_pixelart(o, 3)  # C: 135 px, 1,5x limpo (Scale3x e metade)
    return g.resize((g.width // 2, g.height // 2), Image.NEAREST)


def fundo_cena(w: int) -> Image.Image:
    pasta = A / "cenarios" / "floresta"
    tela = Image.new("RGBA", (w, CENA_H), (27, 24, 51, 255))
    fundo = Image.open(pasta / "fundo.png").convert("RGBA")
    x0 = (fundo.width - w) // 2
    tela.alpha_composite(fundo.crop((x0, FUNDO_TOPO, x0 + w, FUNDO_TOPO + CENA_H)))
    for nome in ("meio.png", "chao.png"):
        c = Image.open(pasta / nome).convert("RGBA")
        tela.alpha_composite(c.crop((0, JANELA_TOPO, w, JANELA_TOPO + CENA_H)))
    return tela


def quadro(nome: str, m: Image.Image, rotulo: str, espelhar: bool) -> Image.Image:
    lua = Image.open(A / "lua" / "poses" / "lua_parada_3f.png").convert("RGBA").crop((0, 0, 80, 100))
    if espelhar:
        m = m.transpose(Image.FLIP_LEFT_RIGHT)
    w = max(300, 20 + 80 + 40 + m.width + 16)
    tela = fundo_cena(w)
    tela.alpha_composite(lua, (14, CHAO - 96))
    mx = w - m.width - 14
    tela.alpha_composite(m, (mx, CHAO - m.height))
    d = ImageDraw.Draw(tela)
    fonte = ImageFont.truetype(str(next((A / "fontes" / "silkscreen").glob("*-Regular.ttf"))), 8)
    # barra de vida do chefão (proposta): no alto, entre a Lua e o chefão
    bx0, bx1 = 104, mx - 6
    if bx1 - bx0 < 60:
        bx0, bx1 = 96, 96 + 70
    d.rectangle((bx0, 14, bx1, 19), fill=(40, 20, 30, 255), outline=(232, 196, 110, 255))
    d.rectangle((bx0 + 1, 15, bx0 + 1 + int((bx1 - bx0 - 2) * 0.7), 18), fill=(214, 64, 76, 255))
    d.text((bx0, 3), NOMES[nome].upper(), fill=(255, 240, 200, 255), font=fonte)
    folga = CHAO - m.height
    d.text((4, CENA_H - 10), f"{rotulo} {m.width}x{m.height} · folga {folga}px", fill=(255, 246, 216, 255), font=fonte)
    return tela


def main():
    quadros = []
    for n in ORDEM:
        quadros.append(quadro(n, para_luta(n), NOMES[n], INFO[n].get("espelhar", False)))
    for op, txt in (("A", "Malakor A"), ("B", "Malakor B"), ("C", "Malakor C")):
        quadros.append(quadro("malakor", malakor(op), txt, INFO["malakor"].get("espelhar", False)))
    col = 3
    qw = max(q.width for q in quadros)
    linhas = (len(quadros) + col - 1) // col
    folha = Image.new("RGBA", (col * (qw + 6) + 6, linhas * (CENA_H + 6) + 6), (12, 10, 24, 255))
    for i, q in enumerate(quadros):
        folha.alpha_composite(q, (6 + (i % col) * (qw + 6), 6 + (i // col) * (CENA_H + 6)))
    folha = folha.resize((folha.width * 2, folha.height * 2), Image.NEAREST)
    folha.save(RAIZ / "previa_tamanhos_chefoes.png")
    print("previa_tamanhos_chefoes.png", folha.size)


if __name__ == "__main__":
    main()
