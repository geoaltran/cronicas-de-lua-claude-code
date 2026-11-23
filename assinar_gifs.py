"""Põe a assinatura (@geoaltran) no canto de cima à esquerda dos GIFs do README.

Os originais sem assinatura ficam em previa_faixa/gif_sem_assinatura/ (fora do
git); o script sempre parte deles, então rodar de novo não assina duas vezes.
Uso: .venv/bin/python assinar_gifs.py
"""
from pathlib import Path
import shutil
from PIL import Image, ImageSequence

RAIZ = Path(__file__).parent
ORIG = RAIZ / "previa_faixa" / "gif_sem_assinatura"
# Os GIFs do README (luta, caminhada, chefões, Livro) agora saem de gravar_gifs.mjs, gravados
# do próprio jogo, que já desenha a assinatura na cena e no pé do Livro: não entram aqui.
# Use esta lista só para um GIF novo feito por fora do jogo.
GIFS: dict[str, int] = {}   # nome -> escala da prévia
OPACIDADE = 0.72


def assinar(nome: str, escala: int) -> None:
    orig = ORIG / nome
    if not orig.exists():
        shutil.copy2(RAIZ / nome, orig)
    sig = Image.open(RAIZ / "assets/ui/assinatura.png").convert("RGBA")
    sig = sig.resize((sig.width * escala, sig.height * escala), Image.NEAREST)
    a = sig.getchannel("A").point(lambda v: int(v * OPACIDADE))
    sig.putalpha(a)
    im = Image.open(orig)
    quadros, tempos = [], []
    for q in ImageSequence.Iterator(im):
        f = q.convert("RGBA")
        f.alpha_composite(sig, (4 * escala, 4 * escala))
        quadros.append(f.convert("RGB"))
        tempos.append(q.info.get("duration", im.info.get("duration", 80)))
    quadros[0].save(RAIZ / nome, save_all=True, append_images=quadros[1:], duration=tempos, loop=0, optimize=False)
    print(nome, len(quadros), "quadros")


if __name__ == "__main__":
    for nome, escala in GIFS.items():
        assinar(nome, escala)
