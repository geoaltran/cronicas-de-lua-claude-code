"""Opções de cor para a barra Luz da Lua (prévia; não altera assets/).

Uso: .venv/bin/python previa_cores_luz.py  -> previa_cores_luz.png
A escolhida entra em PREENCHIMENTOS["luz"] de preparar_assets.py.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

from preparar_assets import PREENCHIMENTOS, gerar_preenchimento

RAIZ = Path(__file__).parent
UI = RAIZ / "assets" / "ui"

OPCOES = {
    "atual (azul)": PREENCHIMENTOS["luz"],
    "A · prata lunar": ["#4a4f6e", "#6b7396", "#9aa3c4", "#c8cfe6", "#e8ecf8", "#ffffff"],
    "B · prata que esquenta (brilho da lua)": ["#565a7c", "#8489ab", "#b9bdd4", "#e2e1d8", "#f7f0cf", "#fffbe8"],
    "C · marfim / creme": ["#6e6a5e", "#9a9480", "#c9c2a6", "#e6e0c8", "#f6f2e2", "#fffdf6"],
    "D · dourado palido": ["#8a6a2a", "#b8913a", "#e0bb55", "#f5d98a", "#fcefc0", "#fffbe8"],
    "E · perolado (lilas claro)": ["#6a5f8f", "#9288b8", "#bdb4dc", "#ddd6f0", "#f2eefb", "#ffffff"],
}

if __name__ == "__main__":
    meta = json.loads((UI / "barra.json").read_text())
    i = meta["interior"]
    trilho = Image.open(UI / "barra_trilho.png").convert("RGBA")
    gema = Image.open(UI / "barra_gema.png").convert("RGBA")
    mana = Image.open(UI / "barra_preench_mana.png").convert("RGBA")

    def barra(preench, frac):
        t = Image.new("RGBA", (trilho.width + 8, trilho.height + 4), (27, 24, 51, 255))
        t.alpha_composite(trilho, (0, 2))
        w = round(i["w"] * frac)
        t.alpha_composite(preench.crop((0, 0, w, i["h"])), (i["x"], i["y"] + 2))
        t.alpha_composite(gema, (i["x"] + w - 14, 1))
        return t

    linhas = []
    for nome, cores in OPCOES.items():
        luz = gerar_preenchimento(cores, i["w"], i["h"])
        linha = Image.new("RGBA", (trilho.width * 2 + 40, trilho.height + 22), (27, 24, 51, 255))
        ImageDraw.Draw(linha).text((4, 2), nome, fill=(255, 240, 200, 255))
        linha.alpha_composite(barra(luz, 0.8), (4, 16))
        linha.alpha_composite(barra(mana, 0.6), (trilho.width + 24, 16))
        linhas.append(linha)
    H = sum(l.height for l in linhas)
    tela = Image.new("RGBA", (linhas[0].width, H), (27, 24, 51, 255))
    y = 0
    for l in linhas:
        tela.alpha_composite(l, (0, y))
        y += l.height
    tela = tela.resize((tela.width * 3, tela.height * 3), Image.NEAREST)
    tela.save(RAIZ / "previa_cores_luz.png")
    print("previa_cores_luz.png", tela.size)
