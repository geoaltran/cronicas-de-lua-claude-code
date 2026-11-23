"""Assinatura do autor em pixel art: "@geoaltran" (só o @, pedido do usuário).

Silkscreen 8 px (a fonte pixel do HUD), branca com contorno escuro de 1 px,
para ficar legível sobre o céu, o chão ou o painel. Grava
assets/ui/assinatura.png (só com --aplicar; sem ele, grava a prévia ampliada).
Usada na cena, na Ficha do Livro e nos GIFs do README.
"""
from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as nd

RAIZ = Path(__file__).parent
TEXTO = "@geoaltran"
BRANCO, CONTORNO = (255, 252, 230), (28, 16, 40)


def assinatura() -> Image.Image:
    fonte = ImageFont.truetype(str(RAIZ / "assets/fontes/silkscreen/Silkscreen-Regular.ttf"), 8)
    l, t, r, b = fonte.getbbox(TEXTO)
    im = Image.new("L", (r - l + 4, b - t + 4), 0)
    ImageDraw.Draw(im).text((2 - l, 2 - t), TEXTO, font=fonte, fill=255)
    m = np.array(im) > 127                      # sem suavização: pixel cheio ou vazio
    borda = nd.binary_dilation(m, structure=np.ones((3, 3), bool)) & ~m
    out = np.zeros(m.shape + (4,), np.uint8)
    out[borda] = (*CONTORNO, 255)
    out[m] = (*BRANCO, 255)
    ys, xs = np.nonzero(out[..., 3])
    return Image.fromarray(out[ys.min():ys.max() + 1, xs.min():xs.max() + 1])


if __name__ == "__main__":
    a = assinatura()
    if "--aplicar" in sys.argv:
        a.save(RAIZ / "assets/ui/assinatura.png")
        print("assets/ui/assinatura.png", a.size)
    else:
        a.resize((a.width * 6, a.height * 6), Image.NEAREST).save(RAIZ / "previa_faixa/assinatura.png")
        print("previa_faixa/assinatura.png", a.size)
