"""Monstros menores para as lutas comuns, sem borrar o pixel art.

Os chefões aprovados em assets/ foram ampliados a partir de um desenho menor
(Scale2x/Scale3x ou "vizinho", ver AMPLIAR em preparar_assets.py). Aqui
voltamos ao desenho original (desfazendo a ampliação) e ampliamos menos,
sempre em escala inteira. Não altera nada em assets/.

Uso: .venv/bin/python tamanho_monstros.py   -> previa_tamanhos.png
     .venv/bin/python tamanho_monstros.py 138  -> previa_tamanhos_luta.png (os da luta)
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

RAIZ = Path(__file__).parent
A = RAIZ / "assets"
AMPLIAR = {"vespera": 2, "ignis": 2, "leviata": 2, "golem_obsidiana": 2}  # malakor v3, relojoeiro v4 e nebula v2: sem ampliação


def original(nome: str, im: Image.Image) -> Image.Image:
    """Desfaz a ampliação: cada bloco f x f volta a ser 1 pixel (a cor que mais aparece no bloco)."""
    f = AMPLIAR.get(nome, 1)
    if f == 1:
        return im
    a = np.array(im.convert("RGBA"))
    h, w = a.shape[0] // f, a.shape[1] // f
    if f == 3:
        return Image.fromarray(a[1::3, 1::3][:h, :w].copy())  # o centro do Scale3x/vizinho é o pixel original
    v = a.view(np.uint32)[..., 0][: h * 2, : w * 2]
    blocos = np.stack([v[0::2, 0::2], v[0::2, 1::2], v[1::2, 0::2], v[1::2, 1::2]])
    conta = np.stack([(blocos == blocos[i]).sum(0) for i in range(4)])
    escolha = blocos[conta.argmax(0), np.arange(h)[:, None], np.arange(w)[None, :]]
    return Image.fromarray(escolha.view(np.uint8).reshape(h, w, 4))


def no_tamanho(nome: str, fator: int) -> Image.Image:
    info = json.loads((A / "chefoes" / "chefoes.json").read_text())[nome]
    im = Image.open(A / "chefoes" / nome / info["arena"]).convert("RGBA")
    o = original(nome, im)
    return o.resize((o.width * fator, o.height * fator), Image.NEAREST)


# Lutas comuns (pedido do usuário, 22/11/2026): a faixa tem altura fixa e o
# chão fica a 139 px do topo, então ninguém pode encostar a cabeça lá em cima.
# Malakor (chefe final, Fase 3): 126 px, opção A aprovada pelo usuário em 22/11/2026.
ALTURA_LUTA = {"golem_obsidiana": 110, "nebula": 126, "relojoeiro": 126, "leviata": 126, "malakor": 126}


# Malakor v3 (25/11/2026): 169 -> 126 px. O "vizinho" descarta 1 de cada 4 linhas
# e quebra o fio dos anéis; esta redução guarda as linhas finas.
REDUZIR_CONTRASTE = {"malakor", "relojoeiro", "nebula"}  # v3 e v4: desenhos grandes no pixel da Lua, reduzidos guardando as linhas finas


def reduzir_contraste(im, alvo_h):
    """Reduz pixel art preservando linhas finas: cada pixel novo cobre um bloco do
    original; o alfa vai pela maioria, e a cor é a do pixel opaco do bloco que
    mais se afasta da mediana do bloco (a linha fina ganha do miolo liso)."""
    a = np.array(im.convert("RGBA")).astype(int)
    H, W = a.shape[:2]
    s = H / alvo_h
    w = round(W / s)
    out = np.zeros((alvo_h, w, 4), np.uint8)
    for i in range(alvo_h):
        y0, y1 = int(i * s), max(int(i * s) + 1, int((i + 1) * s))
        for j in range(w):
            x0, x1 = int(j * s), max(int(j * s) + 1, int((j + 1) * s))
            b = a[y0:y1, x0:x1].reshape(-1, 4)
            op = b[b[:, 3] > 127]
            if len(op) * 2 < len(b) and len(op) < 2:
                continue
            if len(op) == 0:
                continue
            med = np.median(op[:, :3], axis=0)
            k = np.abs(op[:, :3] - med).sum(1).argmax()
            out[i, j] = op[k]
    return Image.fromarray(out)


def para_altura(nome: str, im: Image.Image, alvo: int) -> Image.Image:
    """O sprite de arena na altura `alvo`, pelo caminho mais limpo para o pixel art."""
    from preparar_assets import ampliar_pixelart

    o = original(nome, im)
    if alvo * 2 == o.height * 3:
        # 1,5x exato: Scale3x e depois metade (cada pixel do original vira 1 ou 2, por igual)
        g = ampliar_pixelart(o, 3)
        return g.resize((g.width // 2, g.height // 2), Image.NEAREST)
    if nome in REDUZIR_CONTRASTE:
        return reduzir_contraste(o, alvo)
    # o resto: reduz a versão aprovada (já ampliada) para a altura pedida
    w = round(im.width * alvo / im.height)
    return im.resize((w, alvo), Image.NEAREST)


def para_luta(nome: str) -> Image.Image:
    info = json.loads((A / "chefoes" / "chefoes.json").read_text())[nome]
    im = Image.open(A / "chefoes" / nome / info["arena"]).convert("RGBA")
    alvo = ALTURA_LUTA.get(nome)
    return im if alvo is None or alvo == im.height else para_altura(nome, im, alvo)


def previa_138():
    lua = Image.open(A / "lua" / "poses" / "lua_parada_3f.png").convert("RGBA").crop((0, 0, 80, 100))
    nomes = ["leviata", "ignis", "golem_obsidiana", "nebula", "relojoeiro"]
    sprites = [(n, para_luta(n)) for n in nomes]
    W = 10 + 90 + sum(m.width + 24 for _, m in sprites)
    H = 200
    tela = Image.new("RGBA", (W, H), (36, 34, 58, 255))
    d = ImageDraw.Draw(tela)
    chao = 170
    tela.alpha_composite(lua, (10, chao - 96))
    d.text((10, chao + 8), "Lua 83px", fill=(255, 240, 200, 255))
    x = 100
    for n, m in sprites:
        tela.alpha_composite(m, (x, chao - m.height))
        d.text((x, chao + 8), f"{n} {m.width}x{m.height}", fill=(255, 240, 200, 255))
        x += m.width + 24
    d.line((0, chao, W, chao), fill=(120, 110, 160, 255))
    tela = tela.resize((W * 3, H * 3), Image.NEAREST)
    tela.save(RAIZ / "previa_tamanhos_luta.png")
    print("previa_tamanhos_luta.png", tela.size)


if __name__ == "__main__" and __import__("sys").argv[1:] == ["138"]:
    previa_138()
elif __name__ == "__main__":
    lua = Image.open(A / "lua" / "poses" / "lua_parada_3f.png").convert("RGBA").crop((0, 0, 80, 100))
    casos = [("relojoeiro", [3, 2]), ("nebula", [2, 1]), ("leviata", [2, 1]), ("ignis", [2, 1]), ("vespera", [2, 1]), ("golem_obsidiana", [2, 1])]
    colunas = []
    for nome, fatores in casos:
        for f in fatores:
            colunas.append((nome, f, no_tamanho(nome, f)))
    W = sum(80 + m.width + 30 for _, _, m in colunas) + 20
    H = 230
    tela = Image.new("RGBA", (W, H), (36, 34, 58, 255))
    d = ImageDraw.Draw(tela)
    x = 10
    chao = 200
    for nome, f, m in colunas:
        tela.alpha_composite(lua, (x, chao - 96))
        tela.alpha_composite(m, (x + 82, chao - m.height))
        rot = f"{nome} {'atual' if f == AMPLIAR.get(nome, 1) else 'menor'} {m.height}px"
        d.text((x, chao + 8), rot, fill=(255, 240, 200, 255))
        d.line((x, chao, x + 80 + m.width, chao), fill=(120, 110, 160, 255))
        x += 80 + m.width + 30
    tela = tela.resize((W * 2, H * 2), Image.NEAREST)
    tela.save(RAIZ / "previa_tamanhos.png")
    print("previa_tamanhos.png", tela.size)
