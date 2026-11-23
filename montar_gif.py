"""Junta os quadros PNG de gravar_gifs.mjs num GIF (pixel art: paleta por quadro, sem pontilhado).

Uso: .venv/bin/python montar_gif.py <pasta_dos_quadros> <saida.gif> <ms_por_quadro>
Quadros de tamanhos diferentes (páginas do Livro) ficam centrados no maior, sobre o fundo escuro.
"""
import sys
from pathlib import Path

from PIL import Image

FUNDO = (29, 20, 51)  # o roxo-escuro das molduras do jogo


def main():
    pasta, saida, ms = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
    arqs = sorted(pasta.glob("*.png"))
    quadros = [Image.open(a).convert("RGB") for a in arqs]
    w = max(q.width for q in quadros)
    h = max(q.height for q in quadros)
    iguais = []
    for q in quadros:
        if q.size != (w, h):
            tela = Image.new("RGB", (w, h), FUNDO)
            tela.paste(q, ((w - q.width) // 2, (h - q.height) // 2))
            q = tela
        iguais.append(q)
    # uma paleta só para o GIF inteiro (de uma amostra dos quadros): pixel igual fica igual
    # de um quadro para o outro, e o GIF guarda só o pedaço que mudou
    amostra = iguais[:: max(1, len(iguais) // 16)]
    mosaico = Image.new("RGB", (w, h * len(amostra)))
    for i, q in enumerate(amostra):
        mosaico.paste(q, (0, i * h))
    paleta = mosaico.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    prontos = [q.quantize(palette=paleta, dither=Image.Dither.NONE) for q in iguais]
    prontos[0].save(saida, save_all=True, append_images=prontos[1:], duration=ms, loop=0, optimize=True)
    print(f"{saida.name}: {w}x{h}, {len(prontos)} quadros, {saida.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
