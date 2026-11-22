"""Botões da barra lateral: Vigília, Estandarte, Livro e Mochila.

Cada botão tem um ícone de 24x24 em dois estados e uma moldura de 32x32 em
dois estados (inativo apagado, ativo dourado e aceso). As cores vêm da UI já
aprovada (molduras de nível, barras). O contorno escuro de 1 px é gerado
automaticamente em volta do desenho, como nos personagens.

Estados animados (o mod alterna os quadros):
  vigilia_ativo_3f.png     chama tremulando
  estandarte_ativo_3f.png  bandeira ondulando
"""
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

RAIZ = Path(__file__).parent
SAIDA = RAIZ / "assets" / "ui" / "botoes"
N = 24

# paleta (da UI e da Lua)
CONTORNO = (28, 16, 40)
OURO = {"claro": (254, 229, 75), "meio": (252, 197, 55), "escuro": (249, 166, 52), "sombra": (167, 84, 68)}
AZUL = {"claro": (89, 144, 218), "meio": (56, 96, 188), "escuro": (42, 65, 134), "noite": (26, 24, 48)}
BRONZE = {"claro": (224, 160, 80), "meio": (165, 101, 42), "escuro": (107, 63, 31)}
CREME = (254, 246, 207)
ROXO = {"claro": (140, 96, 220), "meio": (96, 60, 170), "escuro": (62, 36, 120)}
MARROM = {"claro": (196, 128, 72), "meio": (150, 88, 46), "escuro": (104, 58, 32)}


class Tela:
    def __init__(self, n=N):
        self.a = np.zeros((n, n, 4), np.uint8)
        self.n = n

    def p(self, x, y, cor, alfa=255):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.a[y, x] = (*cor, alfa)

    def ret(self, x0, y0, x1, y1, cor, alfa=255):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.p(x, y, cor, alfa)

    def linha(self, x0, y0, x1, y1, cor, alfa=255):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.p(x0, y0, cor, alfa)
            if x0 == x1 and y0 == y1:
                return
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def contorno(self):
        """Contorno escuro de 1 px em volta de tudo que é opaco (só onde está vazio)."""
        opaco = self.a[..., 3] >= 200
        borda = nd.binary_dilation(opaco, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)) & ~opaco
        borda &= self.a[..., 3] == 0
        self.a[borda] = (*CONTORNO, 255)

    def brilho(self, cx, cy, raio, cor, alfa_max):
        """Halo suave por trás (só em pixel vazio): alfa cai com a distância."""
        for y in range(self.n):
            for x in range(self.n):
                if self.a[y, x, 3]:
                    continue
                d = math.hypot(x - cx, y - cy)
                if d <= raio:
                    alfa = int(alfa_max * (1 - d / raio))
                    if alfa > 8:
                        self.p(x, y, cor, alfa)

    def img(self):
        return Image.fromarray(self.a.copy())


# ----------------------------------------------------------------- Vigília

def _lanterna(t, acesa, fase=0):
    # alça (argola)
    for (x, y) in ((11, 1), (12, 1), (10, 2), (13, 2), (10, 3), (13, 3), (11, 4), (12, 4)):
        t.p(x, y, BRONZE["meio"])
    t.p(11, 1, BRONZE["claro"])
    # tampa em trapézio
    t.ret(10, 5, 13, 5, BRONZE["meio"])
    t.ret(9, 6, 14, 6, BRONZE["meio"])
    t.ret(8, 7, 15, 7, BRONZE["escuro"])
    t.p(10, 5, BRONZE["claro"]); t.p(9, 6, BRONZE["claro"]); t.p(10, 6, BRONZE["claro"])
    # vidro
    if acesa:
        vidro, vidro2 = (255, 207, 106), (255, 236, 170)
    else:
        vidro, vidro2 = (42, 53, 80), (66, 82, 112)
    t.ret(9, 8, 14, 17, vidro)
    # reflexo diagonal no vidro
    for k in range(4):
        t.p(10, 9 + k, vidro2)
    t.p(11, 9, vidro2)
    # colunas da armação
    t.ret(8, 8, 8, 17, BRONZE["meio"])
    t.ret(15, 8, 15, 17, BRONZE["escuro"])
    t.p(8, 8, BRONZE["claro"])
    # pavio
    t.p(11, 16, (58, 42, 42)); t.p(12, 16, (58, 42, 42))
    t.ret(10, 17, 13, 17, BRONZE["escuro"])
    if acesa:
        # chama em gota, tremula conforme a fase
        dx = (0, 1, 0)[fase % 3]
        alto = (0, 0, -1)[fase % 3]
        chama = [
            (11 + dx, 10 + alto, (232, 87, 42)),
            (11, 11 + alto, (255, 160, 48)), (12, 11 + alto, (232, 87, 42)),
            (11, 12, (255, 224, 102)), (12, 12, (255, 160, 48)),
            (10, 13, (255, 160, 48)), (11, 13, (255, 251, 224)), (12, 13, (255, 224, 102)), (13, 13, (255, 160, 48)),
            (10, 14, (255, 160, 48)), (11, 14, (255, 251, 224)), (12, 14, (255, 251, 224)), (13, 14, (255, 160, 48)),
            (11, 15, (255, 224, 102)), (12, 15, (255, 224, 102)),
        ]
        for x, y, c in chama:
            t.p(x, y, c)
    # base
    t.ret(7, 18, 16, 18, BRONZE["meio"])
    t.ret(8, 19, 15, 19, BRONZE["escuro"])
    t.ret(9, 20, 10, 20, BRONZE["escuro"]); t.ret(13, 20, 14, 20, BRONZE["escuro"])
    t.p(7, 18, BRONZE["claro"]); t.p(8, 18, BRONZE["claro"])


def vigilia(acesa, fase=0):
    t = Tela()
    _lanterna(t, acesa, fase)
    t.contorno()
    if acesa:
        # halo quente + raios curtos
        t.brilho(11.5, 12.5, 11, (255, 184, 74), 95)
        for (x, y) in ((3, 12), (4, 12), (20, 12), (19, 12), (5, 6), (18, 6), (5, 19), (18, 19)):
            if not t.a[y, x, 3] or t.a[y, x, 3] < 200:
                t.p(x, y, (255, 214, 122), 170)
    else:
        # fio de fumaça subindo da tampa
        fumaca = [(15, 5, 150), (16, 4, 150), (16, 3, 120), (17, 2, 110), (17, 1, 80), (16, 0, 60)]
        for x, y, al in fumaca:
            if not t.a[y, x, 3]:
                t.p(x, y, (150, 150, 176), al)
    return t.img()


# ---------------------------------------------------------------- Estandarte

def _mastro(t):
    t.ret(5, 3, 6, 22, MARROM["meio"])
    t.ret(5, 3, 5, 22, MARROM["claro"])
    # ponta dourada (lua crescente pequena no topo)
    t.p(5, 1, OURO["meio"]); t.p(6, 1, OURO["claro"]); t.p(5, 2, OURO["escuro"]); t.p(6, 2, OURO["meio"])
    t.p(4, 0, OURO["claro"])


def estandarte(ativo, fase=0):
    t = Tela()
    _mastro(t)
    if not ativo:
        # bandeira enrolada no mastro, amarrada com cordão dourado
        for y in range(4, 16):
            larg = 3 if 6 <= y <= 13 else 2
            for x in range(7, 7 + larg):
                cor = AZUL["escuro"] if (x + y) % 3 == 0 else AZUL["meio"]
                t.p(x, y, cor)
        for y in range(5, 15, 3):  # dobras
            t.p(7, y, AZUL["noite"]); t.p(8, y + 1, AZUL["noite"])
        t.ret(7, 10, 9, 10, OURO["meio"]); t.p(9, 11, OURO["escuro"]); t.p(10, 11, OURO["escuro"])
        t.p(8, 16, AZUL["escuro"])  # ponta solta
    else:
        # bandeira desfraldada, ondulando, com cauda de andorinha
        for x in range(7, 21):
            u = (x - 7) / 13
            onda = math.sin(u * math.pi * 1.6 + fase * 2.1)
            topo = 3 + round(onda * 1.2 + u * 1.0)
            base = 13 + round(onda * 1.2 + u * 1.0)
            for y in range(topo, base + 1):
                if x >= 18 and abs(y - (topo + base) / 2) < (x - 17) * 0.9:
                    continue  # recorte em V da cauda
                luz = math.cos(u * math.pi * 1.6 + fase * 2.1)
                cor = AZUL["claro"] if luz > 0.45 else (AZUL["escuro"] if luz < -0.45 else AZUL["meio"])
                t.p(x, y, cor)
            t.p(x, base, OURO["escuro"])  # barra dourada embaixo
        # emblema: lua crescente dourada
        cx, cy = 12, 8 + round(math.sin(0.4 * math.pi * 1.6 + fase * 2.1) * 1.2 + 0.4)
        for (dx, dy) in ((0, -2), (-1, -1), (-1, 0), (-1, 1), (0, 2), (1, 2), (1, -2), (0, -1), (0, 1)):
            t.p(cx + dx, cy + dy, OURO["claro"] if dx < 0 else OURO["meio"])
    t.contorno()
    return t.img()


# --------------------------------------------------------------------- Livro

def livro(aberto):
    t = Tela()
    if not aberto:
        # fechado, de pé, em 3/4: capa roxa, lombada, páginas na lateral
        t.ret(6, 3, 17, 20, ROXO["meio"])
        t.ret(5, 3, 6, 20, ROXO["escuro"])                 # lombada
        t.ret(7, 4, 7, 19, ROXO["claro"])                  # luz na borda
        t.ret(18, 4, 18, 20, CREME)                        # páginas
        for y in range(5, 20, 2):
            t.p(18, y, (220, 205, 160))
        # cantoneiras douradas
        for (x, y) in ((16, 3), (17, 3), (17, 4), (16, 20), (17, 20), (17, 19)):
            t.p(x, y, OURO["meio"])
        # lua crescente na capa
        for (x, y) in ((11, 8), (10, 9), (10, 10), (10, 11), (11, 12), (12, 12), (12, 8)):
            t.p(x, y, OURO["claro"])
        t.p(11, 9, OURO["escuro"]); t.p(11, 11, OURO["escuro"])
        # fecho com cadeado
        t.ret(16, 11, 19, 12, OURO["escuro"])
        t.ret(19, 10, 20, 13, OURO["meio"])
        t.p(19, 10, OURO["claro"]); t.p(20, 12, (58, 42, 42))
        t.contorno()
    else:
        # aberto, visto de frente, páginas com runas brilhando
        t.ret(2, 10, 21, 19, ROXO["meio"])                 # capa por baixo
        t.ret(2, 19, 21, 19, ROXO["escuro"])
        for x in range(3, 21):                             # páginas curvas
            curva = 1 if x in (3, 4, 19, 20) else (0 if x not in (11, 12) else 2)
            for y in range(8 + curva, 18):
                t.p(x, y, CREME)
        t.ret(11, 10, 12, 18, (220, 205, 160))             # dobra central
        for y in range(9, 18):
            t.p(11, y, (200, 180, 130))
        # linhas de texto/runa
        for y in (11, 13, 15):
            t.ret(5, y, 9, y, ROXO["claro"]); t.ret(14, y, 18, y, ROXO["claro"])
        t.p(6, 12, OURO["escuro"]); t.p(16, 14, OURO["escuro"])
        t.contorno()
        # magia subindo: estrelas e brilho
        t.brilho(11.5, 9, 10, (190, 150, 255), 80)
        for (x, y, c) in ((8, 4, OURO["claro"]), (15, 3, (150, 240, 255)), (12, 1, OURO["claro"]),
                          (5, 6, (150, 240, 255)), (18, 6, OURO["claro"])):
            t.p(x, y, c)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if not t.a[y + dy, x + dx, 3] or t.a[y + dy, x + dx, 3] < 200:
                    t.p(x + dx, y + dy, c, 140)
    return t.img()


# -------------------------------------------------------------------- Mochila

def mochila(cheia):
    t = Tela()
    larg = 2 if cheia else 0
    x0, x1 = 6 - larg // 2, 17 + larg // 2
    y0 = 7 if cheia else 8
    t.ret(x0, y0, x1, 20, MARROM["meio"])
    t.ret(x0, y0, x0, 20, MARROM["claro"])
    t.ret(x1, y0, x1, 20, MARROM["escuro"])
    t.ret(x0 + 1, 20, x1 - 1, 20, MARROM["escuro"])
    # alça de cima
    for (x, y) in ((10, y0 - 2), (11, y0 - 3), (12, y0 - 3), (13, y0 - 2)):
        t.p(x, y, MARROM["escuro"])
    t.p(10, y0 - 1, MARROM["escuro"]); t.p(13, y0 - 1, MARROM["escuro"])
    # aba com fivela dourada
    t.ret(x0, y0, x1, y0 + 5, MARROM["claro"] if not cheia else MARROM["meio"])
    t.ret(x0 + 1, y0 + 5, x1 - 1, y0 + 5, MARROM["escuro"])
    t.ret(11, y0 + 5, 12, y0 + 7, OURO["meio"]); t.p(11, y0 + 5, OURO["claro"])
    # bolso da frente
    t.ret(8, 15, 15, 18, MARROM["escuro"]); t.ret(9, 15, 14, 15, MARROM["claro"])
    if cheia:
        # itens saindo pela aba: pergaminho, poção e a ponta da varinha
        t.ret(7, 2, 8, 6, CREME); t.p(7, 2, (220, 205, 160)); t.p(8, 6, (220, 205, 160))
        t.ret(15, 3, 16, 6, (232, 87, 120)); t.p(15, 2, (180, 180, 200)); t.p(16, 2, (180, 180, 200))
        t.p(15, 4, (255, 170, 200))
        t.linha(18, 1, 16, 5, MARROM["escuro"])
        t.p(18, 1, OURO["claro"])
        # costura forçando
        for x in range(x0 + 2, x1 - 1, 3):
            t.p(x, 13, MARROM["claro"])
    t.contorno()
    if cheia:
        # alerta: brilho laranja leve
        t.brilho(11.5, 13, 12, (255, 150, 60), 60)
    return t.img()


# ------------------------------------------------------------------ Molduras

def moldura(ativa):
    n = 32
    t = Tela(n)
    if ativa:
        borda, luz, sombra, fundo = OURO["meio"], OURO["claro"], OURO["sombra"], (36, 32, 74)
    else:
        borda, luz, sombra, fundo = (110, 96, 80), (140, 126, 104), (70, 58, 56), (22, 20, 40)
    t.ret(2, 2, n - 3, n - 3, fundo)
    t.ret(1, 2, 1, n - 3, borda); t.ret(n - 2, 2, n - 2, n - 3, sombra)
    t.ret(2, 1, n - 3, 1, luz); t.ret(2, n - 2, n - 3, n - 2, sombra)
    t.ret(2, 2, n - 3, 2, borda); t.ret(2, 2, 2, n - 3, borda)
    # cantos chanfrados
    for (x, y) in ((1, 1), (n - 2, 1), (1, n - 2), (n - 2, n - 2)):
        t.p(x, y, borda)
    t.contorno()
    if ativa:
        # brilho interno e gemas nos cantos, como nas molduras de nível
        for k in range(3, n - 3):
            for (x, y) in ((k, 3), (3, k)):
                if t.a[y, x, :3].tolist() == list(fundo):
                    t.p(x, y, (90, 70, 150))
        for (x, y) in ((1, 1), (n - 2, 1), (1, n - 2), (n - 2, n - 2)):
            t.p(x, y, (150, 240, 255))
    return t.img()


def compor(mold, icone):
    out = mold.copy()
    out.alpha_composite(icone, (4, 4))
    return out


BOTOES = {
    "vigilia": ("Vigília", ("apagada", "acesa"), vigilia),
    "estandarte": ("Estandarte", ("enrolado", "desfraldado"), estandarte),
    "livro": ("Livro", ("fechado", "aberto"), livro),
    "mochila": ("Mochila", ("leve", "cheia"), mochila),
}


def gerar(escala=6):
    SAIDA.mkdir(parents=True, exist_ok=True)
    mold = {False: moldura(False), True: moldura(True)}
    mold[False].save(SAIDA / "moldura_inativo.png")
    mold[True].save(SAIDA / "moldura_ativo.png")
    meta = {"icone_px": N, "moldura_px": 32, "icone_na_moldura": [4, 4], "botoes": {}}
    linhas = []
    for chave, (rotulo, estados, fn) in BOTOES.items():
        ims = {}
        for ativo in (False, True):
            ic = fn(ativo)
            nome = f"{chave}_{'ativo' if ativo else 'inativo'}.png"
            ic.save(SAIDA / nome)
            compor(mold[ativo], ic).save(SAIDA / f"botao_{nome}")
            ims[ativo] = ic
        meta["botoes"][chave] = {"rotulo": rotulo, "inativo": estados[0], "ativo": estados[1]}
        linhas.append((rotulo, estados, ims))
    # quadros animados dos estados ativos
    for chave, fn in (("vigilia", lambda f: vigilia(True, f)), ("estandarte", lambda f: estandarte(True, f))):
        tira = Image.new("RGBA", (N * 3, N))
        for f in range(3):
            tira.paste(fn(f), (f * N, 0))
        tira.save(SAIDA / f"{chave}_ativo_3f.png")
        meta["botoes"][chave]["animacao"] = f"{chave}_ativo_3f.png"
    (SAIDA / "botoes.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    previa(linhas, mold, escala)


def _fonte(tam):
    from PIL import ImageFont
    for f in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf",
              "/Library/Fonts/Arial Unicode.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(f, tam)
        except OSError:
            continue
    return ImageFont.load_default()


def previa(linhas, mold, escala):
    """Só para validar: no mod os rótulos usam a pixel font do jogo."""
    cel = 32 * escala
    gap, rot_h = 28, 56
    W = gap + len(linhas) * (cel * 2 + gap * 2) + gap
    H = gap + cel + rot_h + gap
    tela = Image.new("RGBA", (W, H), (20, 18, 40, 255))
    d = ImageDraw.Draw(tela)
    f1, f2 = _fonte(18), _fonte(15)
    x = gap
    for rotulo, estados, ims in linhas:
        for ativo in (False, True):
            b = compor(mold[ativo], ims[ativo]).resize((cel, cel), Image.NEAREST)
            tela.alpha_composite(b, (x, gap))
            cor = (255, 226, 120, 255) if ativo else (150, 140, 180, 255)
            d.text((x + 4, gap + cel + 8), rotulo.upper(), fill=(235, 225, 255, 255), font=f1)
            d.text((x + 4, gap + cel + 32), ("ativo: " if ativo else "inativo: ") + estados[ativo], fill=cor, font=f2)
            x += cel + gap // 2
        x += gap
    tela.save(RAIZ / "previa_botoes.png")
    # animação dos estados ativos (chama e bandeira) em GIF
    quadros = []
    for f in range(6):
        q = Image.new("RGBA", (cel * 2 + gap * 3, cel + gap * 2), (20, 18, 40, 255))
        for k, fn in enumerate((lambda i: vigilia(True, i), lambda i: estandarte(True, i))):
            b = compor(mold[True], fn(f % 3)).resize((cel, cel), Image.NEAREST)
            q.alpha_composite(b, (gap + k * (cel + gap), gap))
        quadros.append(q.convert("RGB"))
    quadros[0].save(RAIZ / "previa_botoes_animados.gif", save_all=True, append_images=quadros[1:],
                    duration=160, loop=0)


if __name__ == "__main__":
    gerar()
