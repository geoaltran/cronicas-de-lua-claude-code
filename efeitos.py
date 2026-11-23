"""Efeitos de luta em pixel art (o mod posiciona e anima).

  projetil_4f      estrela mágica girando (o rastro é feito com faisca_4f)
  impacto_6f       explosão de estrelinhas no ponto do acerto
  canalizar_4f     círculo mágico aos pés da Lua (comando demorado)
  exclamacao       balão "!" do encontro
  digitos/         números de dano (branco) e de XP (dourado), com + e -
"""
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image
from scipy import ndimage as nd

RAIZ = Path(__file__).parent
SAIDA = RAIZ / "assets" / "efeitos"
CONTORNO = (28, 16, 40)
BRANCO, OURO, OURO2, LARANJA = (255, 252, 230), (254, 229, 75), (249, 166, 52), (240, 120, 60)
CIANO, LILAS = (150, 240, 255), (190, 150, 255)


def _tela(n):
    return np.zeros((n, n, 4), np.uint8)


def _p(t, x, y, c, a=255):
    n = t.shape[0]
    if 0 <= x < t.shape[1] and 0 <= y < n and (a == 255 or t[y, x, 3] < a):
        t[y, x] = (*c, a)


def _contorno(t):
    op = t[..., 3] >= 200
    borda = nd.binary_dilation(op, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)) & ~op
    borda &= t[..., 3] == 0
    t[borda] = (*CONTORNO, 255)


def projetil():
    """Estrela de 5 pontas simplificada, girando 45° entre quadros."""
    quadros = []
    for f in range(4):
        t = _tela(11)
        c = 5
        diag = f % 2 == 1
        _p(t, c, c, BRANCO)
        braços = ((1, 1), (-1, 1), (1, -1), (-1, -1)) if diag else ((1, 0), (-1, 0), (0, 1), (0, -1))
        for dx, dy in braços:
            for k in (1, 2, 3):
                _p(t, c + dx * k, c + dy * k, OURO if k < 3 else OURO2)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
            _p(t, c + dx, c + dy, OURO if (dx, dy) not in braços else OURO)
        _contorno(t)
        # brilho em volta
        for y in range(11):
            for x in range(11):
                d = math.hypot(x - c, y - c)
                if t[y, x, 3] == 0 and d < 5.5:
                    _p(t, x, y, (255, 236, 150), int(90 * (1 - d / 5.5)))
        quadros.append(t)
    return quadros


def impacto():
    """Explosão: clarão -> anel com raios -> estrelinhas se espalhando -> some."""
    n, c = 31, 15
    quadros = []
    for f in range(6):
        t = _tela(n)
        if f == 0:
            for y in range(n):
                for x in range(n):
                    d = math.hypot(x - c, y - c)
                    if d <= 3:
                        _p(t, x, y, BRANCO)
                    elif d <= 4.5:
                        _p(t, x, y, OURO)
        else:
            raio = 3 + f * 2
            # anel (só nos 3 primeiros quadros)
            if f <= 2:
                for a in range(0, 360, 6):
                    x = round(c + raio * math.cos(math.radians(a)))
                    y = round(c + raio * math.sin(math.radians(a)))
                    _p(t, x, y, BRANCO if f == 1 else OURO, 255 if f == 1 else 200)
            # estrelinhas em 8 direções, ficando menores
            tam = max(0, 3 - (f - 1) // 2)
            for k in range(8):
                ang = math.radians(k * 45 + (22 if f % 2 else 0))
                x = round(c + (raio + 1) * math.cos(ang))
                y = round(c + (raio + 1) * math.sin(ang))
                cor = (BRANCO, OURO, CIANO, OURO2)[k % 4] if f < 5 else OURO2
                al = 255 if f < 5 else 150
                _p(t, x, y, cor, al)
                for d in range(1, tam):
                    for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
                        _p(t, x + dx, y + dy, cor if d == 1 else OURO2, al if d == 1 else 180)
        quadros.append(t)
    return quadros


def canalizar():
    """Círculo mágico achatado aos pés, com runas girando."""
    W, H = 41, 11
    quadros = []
    for f in range(4):
        t = np.zeros((H, W, 4), np.uint8)
        cx, cy, rx, ry = 20, 5, 19, 4.5
        for a in range(0, 360, 3):
            x = round(cx + rx * math.cos(math.radians(a)))
            y = round(cy + ry * math.sin(math.radians(a)))
            _p(t, x, y, CIANO, 220)
        for a in range(0, 360, 5):
            x = round(cx + rx * 0.6 * math.cos(math.radians(a)))
            y = round(cy + ry * 0.6 * math.sin(math.radians(a)))
            _p(t, x, y, LILAS, 160)
        for k in range(6):  # runas girando
            a = math.radians(k * 60 + f * 15)
            x = round(cx + rx * 0.8 * math.cos(a))
            y = round(cy + ry * 0.8 * math.sin(a))
            _p(t, x, y, OURO)
            _p(t, x + 1, y, OURO2)
        quadros.append(t)
    return quadros


def exclamacao():
    t = np.zeros((14, 11, 4), np.uint8)
    for y in range(1, 10):
        for x in range(1, 10):
            if not ((x in (1, 9)) and (y in (1, 9))):
                t[y, x] = (*BRANCO, 255)
    for (x, y) in ((3, 10), (4, 10), (3, 11)):        # ponta do balão
        t[y, x] = (*BRANCO, 255)
    for y in range(2, 7):                              # o "!"
        t[y, 5] = (*(232, 72, 72), 255)
    t[8, 5] = (232, 72, 72, 255)
    op = t[..., 3] > 0
    borda = nd.binary_dilation(op) & ~op
    t[borda] = (*CONTORNO, 255)
    return t


AZUL_DUVIDA = (84, 120, 200)


def interrogacao():
    """Balão "?" azul (o mesmo balão do "!"): a Lua em dúvida quando o escudo do chefão defende."""
    t = exclamacao()
    t[(t[..., :3] == (232, 72, 72)).all(-1)] = (*BRANCO, 255)
    for (x, y) in ((4, 2), (5, 2), (6, 2), (3, 3), (7, 3), (7, 4), (6, 5), (5, 6), (5, 8)):
        t[y, x] = (*AZUL_DUVIDA, 255)
    return t


GOTA_AZUL, GOTA_SOMBRA = (150, 205, 245), (96, 150, 222)


def gota(w=9, h=14):
    """Gota de suor estilo mangá (9x14): ponta em cima, redonda embaixo, sombra e brilho."""
    W, H = w - 2, h - 2
    r = W / 2
    cx, cy = W / 2, H - r
    m = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W):
            px, py = x + .5, y + .5
            if (px - cx) ** 2 + (py - cy) ** 2 <= r * r:
                m[y, x] = True
            elif py < cy and abs(px - cx) <= r * (py / cy) ** 1.3:
                m[y, x] = True
    m = np.pad(m, 1)
    t = np.zeros(m.shape + (4,), np.uint8)
    t[m] = (*GOTA_AZUL, 255)
    for y, x in zip(*np.nonzero(m)):
        if (x - 1 - cx + .5) + (y - 1 - cy + .5) > r * 0.55:
            t[y, x] = (*GOTA_SOMBRA, 255)
    t[nd.binary_dilation(m) & ~m] = (*CONTORNO, 255)
    hy, hx = int(cy) + 1 - max(1, int(r * 0.4)), 1 + max(1, int(r * 0.45))
    t[hy, hx] = t[hy + 1, hx] = (*BRANCO, 255)
    if w >= 9:
        t[hy - 1, hx + 1] = (*BRANCO, 255)
    return t


# dígitos 3x5 (desenhados à mão), ampliados para traço de 1 px com contorno
DIG = {
    "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"],
    "2": ["###", "..#", "###", "#..", "###"], "3": ["###", "..#", ".##", "..#", "###"],
    "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "###", "..#", "###"],
    "6": ["###", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."],
    "8": ["###", "#.#", "###", "#.#", "###"], "9": ["###", "#.#", "###", "..#", "###"],
    "+": ["...", ".#.", "###", ".#.", "..."], "-": ["...", "...", "###", "...", "..."],
    "X": ["#.#", "#.#", ".#.", "#.#", "#.#"], "P": ["##.", "#.#", "##.", "#..", "#.."],
}


def digito(ch, cor):
    g = np.array([[c == "#" for c in l] for l in DIG[ch]])
    g = np.pad(g, 1)
    t = np.zeros(g.shape + (4,), np.uint8)
    t[g] = (*cor, 255)
    borda = nd.binary_dilation(g, structure=np.ones((3, 3), bool)) & ~g
    t[borda] = (*CONTORNO, 255)
    return t


def tira(quadros):
    return Image.fromarray(np.concatenate(quadros, axis=1))


def gerar():
    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "digitos").mkdir(exist_ok=True)
    meta = {}
    for nome, qs, ms in (("projetil", projetil(), 60), ("impacto", impacto(), 55), ("canalizar", canalizar(), 120)):
        tira(qs).save(SAIDA / f"{nome}_{len(qs)}f.png")
        meta[nome] = {"arquivo": f"{nome}_{len(qs)}f.png", "quadro": [qs[0].shape[1], qs[0].shape[0]],
                      "quadros": len(qs), "ms_por_quadro": ms}
    Image.fromarray(exclamacao()).save(SAIDA / "exclamacao.png")
    meta["exclamacao"] = {"arquivo": "exclamacao.png"}
    for ch in DIG:
        nome = {"+": "mais", "-": "menos"}.get(ch, ch)
        Image.fromarray(digito(ch, BRANCO)).save(SAIDA / "digitos" / f"dano_{nome}.png")
        Image.fromarray(digito(ch, OURO)).save(SAIDA / "digitos" / f"xp_{nome}.png")
    meta["digitos"] = {"pasta": "digitos", "dano": "dano_<c>.png (branco)", "xp": "xp_<c>.png (dourado)",
                       "caracteres": "0-9, mais, menos, X, P", "tamanho": [5, 7], "passo": 4}
    (SAIDA / "efeitos.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    return meta


def texto(s, tipo="dano"):
    """Monta um número (ex.: '-12', '+5XP') a partir dos dígitos."""
    ims = [Image.open(SAIDA / "digitos" / f"{tipo}_{ {'+': 'mais', '-': 'menos'}.get(c, c)}.png") for c in s]
    out = Image.new("RGBA", (4 * len(ims) + 1, 7))
    for i, im in enumerate(ims):
        out.alpha_composite(im, (i * 4, 0))
    return out


if __name__ == "__main__":
    import sys
    SOLTOS = {"interrogacao": interrogacao, "gota": gota}
    if sys.argv[1:] and set(sys.argv[1:]) <= set(SOLTOS):
        # só os efeitos pedidos (não regera os outros nem o efeitos.json)
        for nome in sys.argv[1:]:
            Image.fromarray(SOLTOS[nome]()).save(SAIDA / f"{nome}.png")
            print(f"assets/efeitos/{nome}.png")
    else:
        print(json.dumps(gerar(), indent=1, ensure_ascii=False))
