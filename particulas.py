"""Partículas em pixel art para dar vida à arena (o mod anima e posiciona).

Cada arquivo é uma tira horizontal de 4 quadros do mesmo tamanho (_4f).
  estrela   cintila no céu
  vagalume  pisca e flutua perto das árvores
  faisca    sai da ponta da varinha da Lua
  folha     cai das árvores girando
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image

SAIDA = Path(__file__).parent / "assets" / "particulas"


def _q(n):
    return [np.zeros((n, n, 4), np.uint8) for _ in range(4)]


def _p(img, x, y, cor, a=255):
    img[y, x] = (*cor, a)


def estrela():
    q = _q(7)
    branco, ouro, ouro2 = (255, 252, 230), (255, 236, 150), (250, 210, 110)
    _p(q[0], 3, 3, ouro, 170)
    for f in (q[1], q[3]):
        _p(f, 3, 3, branco)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            _p(f, 3 + dx, 3 + dy, ouro, 200)
    f = q[2]
    _p(f, 3, 3, branco)
    for d in (1, 2):
        for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            _p(f, 3 + dx, 3 + dy, ouro if d == 1 else ouro2, 255 if d == 1 else 150)
    for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        _p(f, 3 + dx, 3 + dy, ouro2, 110)
    return q


def vagalume():
    q = _q(5)
    luz, brilho = (240, 255, 140), (200, 255, 120)
    _p(q[0], 2, 2, luz, 140)
    for f in (q[1], q[3]):
        _p(f, 2, 2, luz)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            _p(f, 2 + dx, 2 + dy, brilho, 80)
    f = q[2]
    _p(f, 2, 2, (255, 255, 220))
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx or dy:
                _p(f, 2 + dx, 2 + dy, luz, 130)
    for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
        _p(f, 2 + dx, 2 + dy, brilho, 60)
    return q


def faisca():
    q = _q(5)
    branco, ouro, laranja = (255, 255, 235), (255, 220, 110), (240, 170, 70)
    _p(q[0], 2, 2, branco)
    f = q[1]
    _p(f, 2, 2, branco)
    for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        _p(f, 2 + dx, 2 + dy, ouro)
    f = q[2]
    _p(f, 2, 2, branco)
    for d in (1, 2):
        for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            _p(f, 2 + dx, 2 + dy, ouro if d == 1 else laranja, 255 if d == 1 else 160)
    _p(q[3], 2, 2, laranja, 180)
    return q


def folha():
    q = _q(5)
    clara, escura = (110, 210, 90), (50, 150, 70)
    formas = [
        [(1, 2), (2, 2), (3, 2), (2, 1)],         # deitada
        [(1, 3), (2, 2), (3, 1), (2, 3)],         # inclinada
        [(2, 1), (2, 2), (2, 3), (3, 2)],         # de pé
        [(1, 1), (2, 2), (3, 3), (2, 1)],         # inclinada para o outro lado
    ]
    for f, forma in zip(q, formas):
        for i, (x, y) in enumerate(forma):
            _p(f, x, y, escura if i == len(forma) - 1 else clara)
    return q


def tira(quadros):
    n = quadros[0].shape[1]
    return Image.fromarray(np.concatenate(quadros, axis=1)), n


def gerar():
    SAIDA.mkdir(parents=True, exist_ok=True)
    meta = {}
    for nome, fn, ms in (("estrela", estrela, 220), ("vagalume", vagalume, 180),
                         ("faisca", faisca, 80), ("folha", folha, 160)):
        im, n = tira(fn())
        im.save(SAIDA / f"{nome}_4f.png")
        meta[nome] = {"arquivo": f"{nome}_4f.png", "quadro_px": n, "quadros": 4, "ms_por_quadro": ms}
    (SAIDA / "particulas.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    return meta


if __name__ == "__main__":
    print(gerar())
