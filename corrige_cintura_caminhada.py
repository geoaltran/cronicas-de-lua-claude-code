"""Fecha a faixa transparente entre a túnica e as pernas na caminhada da Lua.

O ajuste_braco_caminhada.py trocou o tronco do q7 e do q8; no q8 a túnica que
veio do q7 termina 1 linha mais acima e sobra uma linha vazia na cintura. Aqui
as pernas do quadro sobem 1 px só nessa linha (copiando a linha de baixo, nas
colunas que ficam sob a túnica). Os pés e o movimento não mudam.

Uso: .venv/bin/python corrige_cintura_caminhada.py            -> só prévias
     .venv/bin/python corrige_cintura_caminhada.py --aplicar  -> grava lua_andar_8f.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).parent
POSES = RAIZ / "assets" / "lua" / "poses"
QW = 80


def corrigir(a: np.ndarray) -> tuple[np.ndarray, list[str]]:
    a = a.copy()
    feito = []
    for q in range(8):
        f = a[:, q * QW:(q + 1) * QW]
        opaco = f[..., 3] > 0
        ys = np.nonzero(opaco.any(1))[0]
        for y in range(ys.min() + 1, ys.max()):
            if not opaco[y].any() and opaco[y - 1].any() and opaco[y + 1].any():
                cols = opaco[y - 1] & opaco[y + 1]
                f[y][cols] = f[y + 1][cols]
                feito.append(f"quadro {q + 1}: linha {y} preenchida em {int(cols.sum())} colunas")
    return a, feito


def xadrez(im: Image.Image) -> Image.Image:
    xa = np.indices((im.height, im.width)).sum(0) % 2
    f = Image.fromarray(np.where(xa[..., None] == 0, [255, 0, 255, 255], [255, 120, 255, 255]).astype(np.uint8))
    f.alpha_composite(im)
    return f


if __name__ == "__main__":
    atual = np.array(Image.open(POSES / "lua_andar_8f.png").convert("RGBA"))
    novo, feito = corrigir(atual)
    print("\n".join(feito) or "nada a corrigir")
    antes = Image.fromarray(atual)
    depois = Image.fromarray(novo)
    # prévia parada: o quadro 8 antes e depois, ampliado
    corte = (7 * QW + 15, 60, 7 * QW + 65, 96)
    a, d = xadrez(antes.crop(corte)), xadrez(depois.crop(corte))
    z = 10
    lado = Image.new("RGBA", (a.width * z * 2 + 30, a.height * z), (30, 30, 30, 255))
    lado.paste(a.resize((a.width * z, a.height * z), Image.NEAREST), (0, 0))
    lado.paste(d.resize((d.width * z, d.height * z), Image.NEAREST), (a.width * z + 30, 0))
    lado.save(RAIZ / "previa_cintura_q8.png")
    # prévia animada: a caminhada corrigida, 110 ms por quadro, 4x
    quadros = []
    for q in range(8):
        c = Image.new("RGBA", (QW, 100), (120, 200, 230, 255))
        c.alpha_composite(depois.crop((q * QW, 0, (q + 1) * QW, 100)), (0, 1 if q in (1, 5) else 0))
        quadros.append(c.resize((QW * 4, 400), Image.NEAREST).convert("RGB"))
    quadros[0].save(RAIZ / "previa_cintura_caminhada.gif", save_all=True, append_images=quadros[1:], duration=110, loop=0)
    print("prévias: previa_cintura_q8.png, previa_cintura_caminhada.gif")
    if "--aplicar" in sys.argv:
        depois.save(POSES / "lua_andar_8f.png")
        print("gravado:", POSES / "lua_andar_8f.png")
