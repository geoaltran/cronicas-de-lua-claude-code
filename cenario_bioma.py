"""Biomas novos: camadas de parallax a partir de UMA ilustração, separando por faixas.

O cenario.py foi feito sob medida para a floresta (reconhece céu e grama pela
cor). Os biomas novos seguem um molde de faixas horizontais (prompt_biomas.md),
então aqui a separação é por linhas, com poucos ajustes por bioma:

  fundo   tudo acima do horizonte (céu, lua, nuvens grandes, marco distante);
          parado. O que ficava atrás das ilhas e dos objetos altos do meio é
          completado com a linha (céu e nuvem são quase horizontais).
  nuvens  nuvens soltas que podem rolar (opcional: tempestade fica parada)
  ilhas   2 sprites soltos, achados dentro de caixas
  meio    do horizonte até o chão, OPACO (o mar, o campo...), mais objetos
          altos que passam do horizonte (mastros, colunas...)
  chao    a faixa da frente onde a Lua pisa, mais o que está na beira dela
          (grade do píer etc.)
  reflexo (opcional) pedaço brilhante do meio que tem de ficar parado sob a
          lua do céu (reflexo da lua no mar); sai do meio e vira sprite.

A faixa é sempre compacta: janela y 70..226 e as camadas de trás (fundo,
nuvens, ilhas) descem 62 px. Mesmo formato de saída da floresta
(assets/cenarios/<bioma>/), mais `lua_ceu` no cenario.json.

Uso: .venv/bin/python cenario_bioma.py mar [--previa]
     (grava em previa_faixa/biomas/<bioma>/; só com --aplicar vai para assets/)
"""
import json
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from scipy.cluster.vq import kmeans2

import preparar_assets as pa
from cenario import VELOCIDADE, alargar_fundo, espelhar_emendavel, preencher_linhas, rgba

RAIZ = Path(__file__).parent
BRUTOS = RAIZ / "assets-brutos" / "cenarios"
W, H = 479, 268
PES = 209
JANELA = (70, 226)
VEL_LONGE = 0.3  # mar ao longe: entre as ilhas (0,2) e o meio (0,5)
DESCE = 62

BIOMAS = {
    "aurora": {
        "arquivo": "aurora.jpeg",
        "placa": "aurora_placa.jpeg",
        "chefao": "sir_solis",
        "cores": 48,
        "lua_fixa": True,
        "estrelas": 0,             # amanhecer: sem estrelas
        "horizonte": 150,          # o campo de trigo começa aqui
        "chao": 200,               # a estrada de terra
        "lua": (220, 24, 258, 60),
        "lua_y_tela": 76,          # a lua desce para dentro da faixa
        "centro_x": (200, 440),
        "ilhas": [(130, 58, 168, 100), (318, 94, 346, 124)],
        "ilha_por_linha": True,
        "ilhas_y": [80, 100],
        "desce": 0,                # sol, raios e muralhas na posição original
        "subir_chao": 5,           # a Lua anda no meio da estrada de terra
        "longe_contorno": (140, 176),  # o campo começa na linha dos morros (muralhas e sol parados)
        "dif_fraco": 30,           # girassóis e bandeiras inteiros (histerese), sem puxar o trigo
        "dif_fraco_alto": (178, 40),  # acima da linha 178, histerese mais rígida (bandeirinhas do campo)
        "macico_abaixo_horizonte": False,  # o preenchimento maciço é das pedras do vulcão
        "fora_objetos": [(372, 112, 418, 150)],  # a rachadura do sol (a placa redesenhou)
        "longe_ate": 186,          # árvores, pedras e bandeirinhas distantes ficam no campo ao longe
        # a árvore do morro da esquerda, a árvore grande e a lápide pequena: campo ao longe
        "longe_caixas": [(0, 132, 32, 172), (145, 148, 178, 192), (199, 173, 210, 185)],
        "chao_caixas": [(330, 186, 353, 201)],  # a pedra da beira da estrada vai com o chão
        "longe_bruto_caixas": [(450, 147, 470, 170)],  # bandeirinha distante da direita
        "nuvens_ate": 90,          # nuvens rosadas do alto
        "nuvens_desce": 52,        # descem para dentro da faixa (camada própria, com vento)
        "sol_brilho": (382, 140, 38),   # centro e raio do sol: halo pulsando e raios brilhando
        "bandeiras": [(397, 156, 422, 175), (433, 153, 457, 176)],  # pano das bandeiras (mastro à esquerda)
    },
    "torre": {
        # v2 (24/11/2026): cidade à noite, torre do relógio ao centro,
        # plataformas de engrenagem flutuando e casas na frente
        "arquivo": "torre.jpeg",
        "placa": "torre_placa.jpeg",
        "grade": (5.73, 5.73),     # a detecção automática errava (4,0 e 4,58)
        "chefao": "relojoeiro",
        "cores": 48,
        "lua_fixa": True,
        "estrelas": 14,            # céu aberto à noite
        "horizonte": 198,          # cidade ao longe e a torre ficam paradas no fundo
        "chao": 221,               # passarela
        "grade_latao": 200,        # grade de latão: só as barras vão com o chão
        "subir_chao": 21,          # a Lua anda no meio da passarela
        "lua": (106, 20, 144, 58),
        "centro_x": (96, 276),     # lua + torre aparecem uma vez só no fundo largo
        "ilhas": [(92, 74, 168, 128), (312, 74, 388, 128)],
        "ilha_por_linha": True,
        "ilhas_y": [28, 38],       # no alto da faixa, acima dos telhados
        "desce": 48,               # a lua e o mostrador da torre entram na faixa
        # ponteiros animados no mostrador da torre (coordenadas no fundo.png):
        # centro, raio limpo (apaga os ponteiros desenhados), minuto, hora
        "relogio": {"centro": (481, 71), "limpa": 7.5, "minuto": 8, "hora": 5,
                    "mostrador": (249, 222, 171), "ponteiro": (123, 96, 87)},
        # fumaça das chaminés (topo da chaminé no meio.png; gruda no topo mais perto),
        # nos tons da fumaça que estava desenhada; o vento leva para a direita
        # só algumas chaminés soltam fumaça (pedido do usuário)
        "fumaca_chamines": [(46, 86), (331, 139), (440, 78)],
        "fumaca_cores": ((199, 207, 234), (143, 162, 192)),
        "relogio_brilho": True,    # halo do mostrador pulsando devagar
        "lanternas_ilhas": True,   # lanterna das plataformas com halo pulsando
        # prédios da cidade ao longe sobem para aparecer acima das casas do meio;
        # a torre (colunas torre_x no fundo.png) não sai do lugar
        "subir_cidade": {"px": 28, "linhas": (93, 175), "torre_x": (458, 504)},
        # nuvens tiradas do fundo pelo usuário viram camada própria (rola com vento),
        # recortadas do fundo_referencia.png, passando atrás da torre
        "nuvens_do_ref": {"ate": 100, "fora": [(100, 15, 150, 60), (200, 0, 285, 100)]},
    },
    "castelo_vidro": {
        # dia claro: terraço de vidro, castelo ao longe no mar de nuvens
        "arquivo": "castelo_vidro.jpeg",
        "placa": "castelo_vidro_placa.jpeg",
        "chefao": "rei_espelho",
        "cores": 48,
        "lua_fixa": True,
        "estrelas": 0,             # dia: sem estrelas
        "horizonte": 170,          # o mar de nuvens ao pé do castelo
        "chao": 181,               # o piso de vidro
        "descer_cena": 12,         # piso, objetos e mar de nuvens descem: a Lua pisa no meio dos ladrilhos
        "chao_da_placa": True,     # piso sem os reflexos (não acompanhariam os objetos)
        "lua": (214, 8, 264, 56),
        "centro_x": (180, 300),    # lua + castelo aparecem uma vez só no fundo largo
        "ilhas": [(130, 42, 164, 92), (322, 90, 348, 132)],  # os cristais flutuando
        "ilha_por_linha": True,
        "ilhas_y": [24, 34],
        "desce": 62,
        "nuvens_ate": 78,          # nuvens brancas do alto rolam com vento (acima da faixa clara)
        "nuvens_desce": 62,
        "nuvens_por_ceu": True,    # recorte pela cor do céu da linha (com a sombra azul)
        "nuvens_fora": [(176, 40, 304, 78)],  # pontas das torres do castelo
        # espelhos e cristais de pé: inteiros até o piso (a placa quase repete o vidro)
        "cheios": [(71, 130, 96, 188), (111, 130, 137, 188), (306, 134, 332, 188), (376, 130, 402, 188),
                   (174, 127, 184, 188), (289, 146, 300, 188)],
        # reflexo de luz passando (faixa diagonal clara) nos espelhos e cristais
        # (caixas no meio.png ANTES do descer_cena) e nos cristais flutuando;
        # faíscas piscando no piso
        "vidro_brilho": {
            "caixas": [(71, 130, 96, 188), (111, 130, 137, 188), (306, 134, 332, 188), (376, 130, 402, 188),
                       (174, 127, 184, 188), (289, 146, 300, 188), (56, 91, 73, 115), (402, 91, 419, 115),
                       (193, 151, 204, 164), (275, 151, 286, 164)],
            "ilhas": True,
            "faiscas_chao": 12,
            # estrelinhas piscando nos cristais (caixas no meio, antes do descer_cena)
            "estrelinhas": [(56, 91, 73, 115), (402, 91, 419, 115), (174, 127, 184, 150),
                            (289, 146, 300, 165), (193, 151, 204, 164), (275, 151, 286, 164)],
            "chao_y": (196, 214),
        },
    },
    "ceu_estelar": {
        # noite profunda: nebulosa, mar de nuvens com arcos e pedras, ponte de pedra
        "arquivo": "ceu_estelar.jpeg",
        "placa": "ceu_estelar_placa.jpeg",
        "chefao": "nebula",
        "cores": 48,
        "lua_fixa": True,
        "estrelas": 14,
        "horizonte": 117,          # o mar de nuvens começa aqui
        "chao": 205,               # a ponte de pedra (e as pontes de luz)
        "lua": (212, 22, 268, 78),
        "centro_x": (200, 280),
        "ilhas": [(115, 72, 157, 132), (313, 79, 356, 151)],
        "ilha_por_linha": True,
        "ilhas_y": [40, 46],
        "desce": 48,               # a lua cabe inteira acima do mar de nuvens
        "ilhas_na_frente": True,   # as ilhas na frente do mar de nuvens (longe)
        # placa só do céu (prompt "Céu Estelar: placa do céu"): fundo limpo e
        # nuvens soltas rolando; enquanto não existir, o fundo vem da placa
        "ceu": "ceu_estelar_ceu.jpeg",
        "nuvens_ate": 76,          # nuvens soltas do céu (a beira do mar de nuvens fica no longe)
        "subir_chao": 10,          # a ponte sobe: a Lua anda sobre ela e as pontes de luz aparecem
        # cristais em cima da ponte (estão na placa, acima do chão): vão com o chão
        "chao_cristais": [(18, 186, 46, 206), (326, 184, 352, 206)],
        "ceu_fx": {
            # pontes de energia (caixa no bruto, antes do subir_chao) e a cor da luz
            "pontes": [((48, 207, 134, 226), (90, 235, 225)), ((350, 207, 435, 226), (235, 190, 245))],
            "pedestal": (297, 181),    # a estrela em cima da pedra (no meio): halo pulsando
            "cadentes": 5,             # estrelas cadentes (cores das pontes, tamanhos e tempos sorteados)
            "lua_brilho": (165, 150, 255),  # halo azul-arroxeado pulsando em volta da lua
            "raios_ponte": 12,         # raios de luz correndo nas pontes (estilo ponte arco-íris)
        },
    },
    "eclipse": {
        # dia virando noite: eclipse total, planície rachada, brilho âmbar no horizonte
        "arquivo": "eclipse.jpeg",
        "placa": "eclipse_placa.jpeg",
        "chefao": "malakor",
        "cores": 48,
        "lua_fixa": True,
        "estrelas": 12,
        "estrelas_ate": 60,
        "estrelas_ceu_todo": True,  # o céu é um degradê em faixas (não há um tom só)
        "horizonte": 169,          # a planície da placa começa aqui
        "chao": 211,               # a laje de pedra rachada da frente
        "subir_chao": 9,           # a Lua pisa no meio da laje, não na beirada
        "subir_longe": 8,          # a planície ao longe sobe (aparece mais entre o entulho e o céu)
        "lua": (210, 18, 272, 82),  # caixa do eclipse (anel + halo)
        "centro_x": (200, 280),
        "ilhas": [(124, 76, 182, 152), (306, 82, 366, 166)],  # coluna em ruína e engrenagem
        "ilha_por_linha": True,
        "ilha_pedacos": True,      # os cacos que caem das ilhas vão junto
        # a engrenagem (ilha 2) gira em volta do espelho, que fica parado; os
        # cacos de baixo caem aos poucos; o espelho ganha um reflexo passando
        "engrenagem": {"ilha": 2, "simetria": 4},
        "desce": 0,                # o céu já vem refeito na altura da faixa (ceu_sintetico)
        "longe_contorno": (160, 182),  # a planície começa na linha real dos morros
        "planicie_bruto": True,    # a planície do bruto (marrom) não é objeto: ali aparece a placa
        "macico_abaixo_horizonte": False,  # o entulho já vem inteiro abaixo da planície
        # pináculos distantes no horizonte (silhuetas marrons): vão com a planície ao longe
        "pinaculos": [(84, 138, 112, 173), (204, 140, 220, 173), (268, 140, 297, 173)],
        "nuvens_ate": 92,          # nuvens de fumaça (rolam com vento)
        "nuvens_desce": 38,
        "nuvens_por_ceu": True,
        "nuvens_fora": [(196, 4, 286, 96)],  # o halo do eclipse não é nuvem
        "nuvens_min_alt": 4,       # risquinhos de 1-3 linhas são emendas das faixas do céu
        "nuvens_min_px": 40,       # fiapos pequenos (pareciam morcegos passando)
        # o céu inteiro (169 linhas) não cabe nas ~99 linhas de céu da faixa:
        # degradê refeito com as faixas de cor da placa, comprimido (o alto,
        # escuro, encolhe mais; o âmbar do horizonte quase não encolhe); o
        # eclipse vira peça separada, com o halo transparente
        "ceu_sintetico": {
            "amostra_x": (170, 200),
            "mapa": [(20, 70), (115, 118), (169, 161)],   # (linha no bruto, linha no fundo); 161 = horizonte com a planície subida
            "eclipse_raio": 40,
        },
        "lua_y_tela": 64,          # topo do eclipse (com halo) na tela: centro ~26 px abaixo do alto da faixa
        "eclipse_fx": {
            "coroa": (255, 226, 170),   # halo da coroa respirando
            "brasas": 22,               # brasas e cinzas subindo das rachaduras
            "rachaduras": (235, 150, 255),  # brilho violeta correndo pelas rachaduras
        },
    },
    "vulcao": {
        "arquivo": "vulcao.jpeg",
        "placa": "vulcao_placa.jpeg",
        "chefao": "ignis",
        "cores": 48,
        "lua_fixa": True,
        "horizonte": 160,          # o campo de lava começa aqui
        "chao": 205,               # faixa de rocha da frente
        "subir_chao": 4,           # a Lua pisa um pouco mais para dentro do chão, não na beirada
        "lua": (214, 26, 264, 74),
        "centro_x": (130, 350),
        "ilhas": [(124, 52, 168, 112), (310, 84, 356, 134)],
        "ilhas_y": [34, 42],
        "desce": 42,               # a lua cabe inteira acima do vulcão
        # o vulcão: parado, com a base um pouco abaixo da linha do campo
        "marco": (120, 100, 360, 166),
        "marco_base_tela": 168,
        "estrelas_ate": 70,        # estrelas descem pelo céu todo
        "estrelas_ceu_todo": True,
        "estrela_cor": "vermelha", # no lugar das azuis
        "vulcao_fx": True,         # brilho pulsando, lava no ar e fumaça na cratera
        "fumaca_chao": 8,          # fumaças saindo do chão do campo ao longe (espalhadas)
        "lava_brilho": True,       # lava do chão e do campo pulsando, com onda de calor
        "ilha_por_linha": True,    # céu laranja parecido com a lava das ilhas: recorte linha a linha
        # pontas de galho (coordenadas no meio.png) de onde sai fumaça
        "fumaca_galhos": [(68, 116), (196, 158), (322, 146), (408, 106)],  # uma por árvore
    },
    "ruinas": {
        "arquivo": "ruinas.jpeg",
        "chefao": "golem_obsidiana",
        "lua_fixa": True,          # a lua não mingua (usuário: minguando fica estranho)
        "subir_chao": 7,           # a Lua pisa no meio das pedras, não na beirada
        # fundo pintado pelo usuário (templo e morros no fundo): desce menos
        # que os 62 px padrão, para o templo e os morros aparecerem acima das ruínas
        "desce": 34,
        "cores": 48,
        "chao": 204,               # topo do caminho de pedra
        "meio_topo": 98,           # colunas e arcos mais altos começam aqui
        "ceu_refeito_folga": 16,   # céu refeito a partir da linha 82 (abaixo da lua)
        # retângulos de céu limpo (amostra das cores do céu em cada altura)
        "ceu_caixas": [(172, 98, 200, 140), (282, 98, 302, 148), (118, 130, 145, 150),
                       (88, 98, 100, 140), (374, 98, 392, 110)],
        "opaco_desde": 168,        # arbustos e grama de trás: meio inteiro
        "lua": (214, 18, 266, 70),
        "centro_x": (196, 284),
        "ilhas": [(114, 62, 170, 130), (300, 60, 370, 140)],
        "nuvens_ate": 80,
        # na faixa baixa (desce 62) as ilhas ficariam atrás das ruínas: sobem
        "ilhas_y": [40, 50],       # na tela: ilha 2 mais longe do topo
        "ilhas_escala": [1, 1],    # 0,8 distorceu (pixel art só aguenta escala inteira); menor = repintar
        # o templo ao longe: sprite parado, logo abaixo da lua na faixa baixa
        "marco": (200, 100, 282, 168),
        "marco_base": 160,
        "marco_y_tela": 128,
        "morros": (150, 140, 340, 190),  # morros e torrinhas na névoa, junto do templo
        "ceu_puxa": 40,            # o rosa do horizonte sobe (aparece nas janelas do templo)
    },
    "mar": {
        "arquivo": "mar.jpeg",
        "chefao": "leviata",
        "cores": 48,
        "horizonte": 132,          # primeira linha do mar
        "chao": 202,               # primeira linha das tábuas do píer
        "beira": (176, 202),       # grade do píer (postes e corda): cinza-marrom
        # pedras apoiadas nas tábuas: vão inteiras com o chão
        "sobre_chao": [(48, 184, 114, 208), (352, 184, 408, 208), (318, 198, 342, 208)],
        "lua_fixa": True,          # lua cheia sempre inteira (escolha do usuário): não mingua
        "subir_chao": 6,           # píer mais alto: a Lua pisa no meio das tábuas
        "placa": "mar_placa.jpeg",  # mesma cena sem barcos, pedras, ondas e reflexo
        "reflexo_crista": 164,     # sob a lua, objetos só daqui para baixo
        "inteiros": [(28, 132, 95, 192)],  # a onda grande da esquerda
        "lua": (196, 18, 284, 102),
        "marco": (262, 106, 288, 133),   # o farol no horizonte
        "marco_dx": 0,             # na frente da lua (testado à direita: some no céu escuro)
        "farol_giro": True,        # luz rotativa no topo do farol
        # amarelo-quente (escolha do usuário): se separa do creme da lua
        "facho_cor": ((255, 205, 95), (255, 228, 140)),
        "lampada_cor": (255, 236, 160),
        "centro_x": (176, 304),    # lua + farol: aparecem uma vez só no fundo largo
        "ilhas": [(128, 52, 178, 102), (304, 76, 352, 114)],
        # na faixa compacta (desce 62) as ilhas cairiam no horizonte: sobem
        "ilhas_y": [22, 30],
        # objetos do meio que passam do horizonte (mastros): caixas
        "altos": [(90, 100, 165, 133), (350, 100, 425, 133)],
        "reflexo": (180, 132, 300, 167),
        "nuvens_rolam": False,     # tempestade emoldura a lua e fica parada
    },
}


def _grade(arquivo, s_fixo=None):
    rgb = np.asarray(Image.open(BRUTOS / arquivo).convert("RGB"))
    m = np.ones(rgb.shape[:2], bool)
    # tamanho do pixel fixo (todos os biomas têm 2752 px / 480 = 5,73); a
    # detecção automática às vezes acha um submúltiplo (4,0 na torre)
    cor, _ = pa.reamostrar(rgb, m, pa.detectar_grid(rgb, m, s_fixo=s_fixo))
    # mesmo tamanho da floresta (a grade dá 480x267)
    cor = cor[:H, :W]
    if cor.shape[0] < H:
        cor = np.concatenate([cor, np.repeat(cor[-1:], H - cor.shape[0], 0)])
    return cor


def _na_paleta(cor, pal):
    px = cor.reshape(-1, 1, 3).astype(int)
    i = np.abs(px - pal[None].astype(int)).sum(-1).argmin(-1)
    return pal[i].reshape(cor.shape)


def nativo(cfg, paleta=None):
    """Ilustração na grade nativa, numa paleta limpa (k-means). Com `paleta`,
    usa a mesma de outra imagem (a placa usa a do bruto)."""
    cor = _grade(cfg["arquivo"], cfg.get("grade"))
    if paleta is not None:
        return _na_paleta(cor, paleta)
    px = cor.reshape(-1, 3).astype(float)
    pal, rot = kmeans2(px, cfg["cores"], minit="++", seed=7, iter=30)
    pal = np.clip(pal.round(), 0, 255).astype(np.uint8)
    return pal[rot].reshape(cor.shape)


def paleta_de(a):
    return np.unique(a.reshape(-1, 3), axis=0)


def reflexo_rajadas(cores, cx, y0, y1, larg0, larg1, seed):
    """Reflexo da lua desenhado: rajadas deitadas (tracinhos de tamanhos
    diferentes), mais largas e densas no horizonte, se desfazendo para baixo.
    Sem borda quadrada; cada `seed` dá um tremor diferente."""
    rnd = random.Random(seed)
    alt = y1 - y0
    im = np.zeros((alt, W, 4), np.uint8)
    for k in range(alt):
        f = k / max(alt - 1, 1)
        meia = larg0 * (1 - f) + larg1 * f
        if k % 2 and f > 0.35:
            continue  # embaixo as linhas rareiam
        dens = 0.85 - 0.6 * f
        x = cx - meia + rnd.uniform(-3, 3)
        while x < cx + meia:
            comp = rnd.randint(2, 4 + int(10 * (1 - f)))
            if rnd.random() < dens:
                # mais claro no meio, mais apagado nas pontas
                d = abs(x + comp / 2 - cx) / max(meia, 1)
                nivel = 0 if d < 0.35 else (1 if d < 0.7 else 2)
                if f > 0.6:
                    nivel = min(2, nivel + 1)
                c = cores[nivel]
                xa, xb = int(max(x, 0)), int(min(x + comp, W))
                im[k, xa:xb, :3] = c
                im[k, xa:xb, 3] = 255
            x += comp + rnd.randint(1, 3 + int(5 * f))
    return Image.fromarray(im)


def marrom(a):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return r > b + 4


def caixa(x0, y0, x1, y1):
    m = np.zeros((H, W), bool)
    m[y0:y1, x0:x1] = True
    return m


def ilha(a, x0, y0, x1, y1):
    """Na caixa, é ilha o que não se parece com as cores da borda (céu, nuvem)."""
    cx = caixa(x0, y0, x1, y1)
    borda = cx & ~nd.binary_erosion(cx)
    cores = np.unique(a[borda], axis=0).astype(int)
    dif = np.abs(a.astype(int)[:, :, None, :] - cores[None, None]).sum(-1).min(-1)
    obj = nd.binary_fill_holes(nd.binary_closing(cx & (dif > 30), iterations=1))
    rot, n = nd.label(obj)
    if n > 1:
        tam = nd.sum(obj, rot, range(1, n + 1))
        obj = rot == (np.argmax(tam) + 1)
    return obj


def _corridas(m):
    """Comprimento da corrida de True que passa por cada pixel, na linha."""
    out = np.zeros(m.shape, int)
    for y in range(m.shape[0]):
        rot, n = nd.label(m[y])
        if n:
            tam = np.bincount(rot)
            out[y] = np.where(rot > 0, tam[rot], 0)
    return out


def remendar_fino(img, buraco):
    """Furos finos (corda, poste): completa na direção curta do furo. Corda
    deitada copia de cima/baixo; poste em pé copia dos lados. O mar é feito de
    listras deitadas, então nada vira listra comprida."""
    h = _corridas(buraco)
    v = _corridas(buraco.T).T
    pela_linha = preencher_linhas(img, buraco)
    pela_coluna = preencher_linhas(img.transpose(1, 0, 2), buraco.T).transpose(1, 0, 2)
    out = img.copy()
    out[buraco] = np.where((h <= v)[..., None], pela_linha, pela_coluna)[buraco]
    return out


def remendar_textura(img, buraco, evitar, caixa_xy, dy_max=24):
    """Furo grande no mar: cada linha do furo recebe um trecho de mar limpo
    (sem espuma, pedra, casco) da mesma linha ou de uma linha um pouco acima,
    deslocado para o lado. O mar é feito de listras deitadas, então isso
    mantém as ondinhas sem repetir objetos."""
    x0, y0, x1, y1 = caixa_xy
    ruim_total = evitar | buraco
    soma = img.astype(float).sum(2)
    out = img.copy()
    for y, a0, a1 in [(y, x0 + sl.start, x0 + sl.stop)
                      for y in range(y0, y1)
                      for (sl,) in nd.find_objects(nd.label(buraco[y, x0:x1])[0]) or []]:
        w = a1 - a0
        # brilho do mar em volta do furo, nesta linha: a origem tem de bater
        viz = np.r_[soma[y, max(a0 - 12, 0):a0], soma[y, a1:a1 + 12]]
        alvo = viz.mean() if len(viz) else soma[y].mean()
        melhor = None
        for dy in range(0, dy_max + 1):
            yo = y - dy
            if yo < 0:
                break
            acum = np.concatenate([[0], np.cumsum(ruim_total[yo].astype(int))])
            jan = acum[w:] - acum[:-w]
            acs = np.concatenate([[0], np.cumsum(soma[yo])])
            media = (acs[w:] - acs[:-w]) / w
            custo = jan * 1000.0 + np.abs(media - alvo) + dy * 2
            if dy == 0:
                xx = np.arange(len(custo))
                custo[np.abs(xx - a0) < w + 1] = np.inf
            x = int(np.argmin(custo))
            if melhor is None or custo[x] < melhor[0]:
                melhor = (custo[x], yo, x)
        _, yo, xo = melhor
        cols = np.arange(w)
        out[y, a0 + cols] = out[yo, xo + cols] if yo != y else img[yo, xo + cols]
    return out


def ondinhas(img, area, mar, seed=5):
    """Risquinhos claros deitados (pequenas ondas) sobre o mar liso: em linhas
    alternadas, tracinhos de 3 a 7 px no tom do mar um pouco mais claro."""
    rnd = random.Random(seed)
    out = img.copy()
    soma = img.astype(int).sum(2)
    ys = np.unique(np.nonzero(area)[0])
    for y in ys:
        if y % 2:
            continue
        cores = img[y][mar[y]]
        if not len(cores):
            continue
        base = soma[y][mar[y]]
        # tom claro: a cor de mar mais clara que aparece bastante na linha
        uni, n = np.unique(cores, axis=0, return_counts=True)
        s_uni = uni.astype(int).sum(1)
        mediana = np.median(base)
        claras = [(c, k) for c, k, sm in zip(uni, n, s_uni) if sm > mediana + 20]
        if not claras:
            continue
        clara = max(claras, key=lambda ck: ck[1])[0]
        xs = np.nonzero(area[y])[0]
        x = xs.min() + rnd.randrange(0, 12)
        while x < xs.max():
            comp = rnd.randrange(3, 8)
            for k in range(comp):
                if x + k <= xs.max() and area[y, x + k]:
                    out[y, x + k] = clara
            x += comp + rnd.randrange(10, 26)
    return out


def ilha_por_linha(a, x0, y0, x1, y1, folga=14, tol=30, pedacos=False):
    """Ilha contra céu em degradê com cores parecidas com as dela (vulcão: céu
    laranja x rachaduras de lava): o céu de cada linha é amostrado dos dois
    lados da caixa, na mesma linha; é ilha o que não se parece com ele.
    Com `pedacos`, os cacos soltos perto da ilha (pedrinhas e pingos que caem
    dela) vão junto."""
    H_, W_, _ = a.shape
    ai = a.astype(int)
    obj = np.zeros((H_, W_), bool)
    for y in range(y0, y1):
        lados = np.concatenate([ai[y, max(x0 - folga, 0):x0], ai[y, x1:min(x1 + folga, W_)]])
        cores = np.unique(lados, axis=0)
        dif = np.abs(ai[y, x0:x1][:, None, :] - cores[None]).sum(-1).min(-1)
        obj[y, x0:x1] = dif > tol
    obj = nd.binary_fill_holes(nd.binary_closing(obj, iterations=1))
    rot, n = nd.label(obj)
    if n > 1:
        tam = nd.sum(obj, rot, range(1, n + 1))
        corpo = rot == (np.argmax(tam) + 1)
        if pedacos:
            perto = nd.binary_dilation(corpo, iterations=14)
            obj = corpo | np.isin(rot, [i + 1 for i, t in enumerate(tam)
                                        if t >= 3 and perto[rot == i + 1].any()])
        else:
            obj = corpo
    return obj


def ceu_sintetico(a, pl, cfg, tirar):
    """Céu refeito para caber na faixa: as faixas de cor da placa (degradê em
    degraus), com as linhas remapeadas por `mapa` (pares linha do bruto ->
    linha do fundo); as estrelinhas da placa vão para a linha nova. O eclipse
    sai do céu e vira peça: anel e disco opacos, halo com transparência
    (calculada contra a cor do céu da linha), para assentar em qualquer tom."""
    c = cfg["ceu_sintetico"]
    hz = cfg["horizonte"]
    xa, xb = c["amostra_x"]
    modas = np.array([np.unique(pl[y, xa:xb], axis=0, return_counts=True) for y in range(H)], dtype=object)
    moda = np.array([u[n.argmax()] for (u, n) in modas]).astype(np.uint8)
    origs = np.array([p[0] for p in c["mapa"]], float)
    novos = np.array([p[1] for p in c["mapa"]], float)
    fundo = np.zeros((H, W, 3), np.uint8)
    for yn in range(H):
        yo = int(round(np.interp(yn, novos, origs))) if yn < hz else hz - 1
        fundo[yn] = moda[min(yo, hz - 1)]
    # eclipse: centro e raio do anel (pixels bem claros da caixa)
    lx0, ly0, lx1, ly1 = cfg["lua"]
    ai = a.astype(int)
    anel = np.zeros((H, W), bool)
    anel[ly0:ly1, lx0:lx1] = ai[ly0:ly1, lx0:lx1].sum(2) > 500
    ys, xs = np.nonzero(anel)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    r_anel = np.hypot(xs - cx, ys - cy).max()
    R = c["eclipse_raio"]
    yy_, xx_ = np.mgrid[0:H, 0:W]
    dist = np.hypot(xx_ - cx, yy_ - cy)
    # estrelinhas da placa (pontos claros pequenos no céu limpo) na linha nova
    ceu = (yy_ < hz) & ~nd.binary_dilation(tirar, iterations=3) & (dist > R + 4)
    claro = ceu & ((pl.astype(int).sum(2) - moda[:, None, :].astype(int).sum(2)) > 60)
    rot, n = nd.label(claro, structure=np.ones((3, 3), bool))
    for i, sl in enumerate(nd.find_objects(rot), 1):
        comp = rot == i
        if comp.sum() > 6:
            continue
        for (y, x) in zip(*np.nonzero(comp)):
            yn = int(round(np.interp(y, origs, novos)))
            if 0 <= yn < hz:
                fundo[yn, x] = pl[y, x]
    # peça do eclipse: o céu de cada linha é a cor mais comum da linha no bruto
    # (fora da caixa); halo = mistura do céu com a luz, alfa em 6 degraus
    x0e, y0e = int(np.floor(cx - R)), int(np.floor(cy - R))
    lado = 2 * R + 2
    sp = np.zeros((lado, lado, 4), np.uint8)
    luz = np.array([255, 236, 205], float)
    lum = lambda v: v[..., 0] * 0.3 + v[..., 1] * 0.55 + v[..., 2] * 0.15
    for j in range(lado):
        y = y0e + j
        if not 0 <= y < H:
            continue
        fora = np.r_[ai[y, :lx0 - 4], ai[y, lx1 + 4:]]
        u, n_ = np.unique(fora, axis=0, return_counts=True)
        s = u[n_.argmax()].astype(float)
        for i in range(lado):
            x = x0e + i
            if not 0 <= x < W or dist[y, x] > R:
                continue
            p = ai[y, x].astype(float)
            if dist[y, x] <= r_anel + 0.5:
                sp[j, i, :3], sp[j, i, 3] = p, 255
                continue
            al = (lum(p) - lum(s)) / max(lum(luz) - lum(s), 1)
            al = np.floor(np.clip(al, 0, 1) * 6 + 0.5) / 6
            if al < 0.1:
                continue
            cor = np.clip((p - (1 - al) * s) / al, 0, 255)
            sp[j, i, :3], sp[j, i, 3] = cor, int(round(al * 255))
    ys_, xs_ = np.nonzero(sp[..., 3])
    sp = sp[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]
    eclipse = {"sprite": Image.fromarray(sp), "x": x0e + int(xs_.min()), "y": y0e + int(ys_.min()),
               "centro": (cx, cy), "raio_anel": float(r_anel)}
    return fundo, eclipse


def girar_pixelart(im, centro, graus):
    """Gira pixel art sem borrar (à la RotSprite): amplia 8x com Scale2x três
    vezes, gira por vizinho mais próximo em volta do centro e volta para a
    grade original pegando o pixel do meio de cada bloco 8x8."""
    g = im
    for _ in range(3):
        g = pa.ampliar_pixelart(g, 2)
    cx, cy = centro
    g = g.rotate(graus, resample=Image.NEAREST, center=((cx + 0.5) * 8, (cy + 0.5) * 8))
    a = np.array(g)[4::8, 4::8]
    return Image.fromarray(np.ascontiguousarray(a))


def separar_engrenagem(sp, eg, saida, i):
    """Ilha da engrenagem com o espelho enfiado: separa o espelho (parado), a
    engrenagem (gira; o pedaço escondido atrás do espelho é completado pela
    simetria da própria engrenagem) e os cacos de baixo (caem aos poucos)."""
    a = np.array(sp.convert("RGBA"))
    h, w = a.shape[:2]
    ai = a.astype(int)
    op = a[..., 3] > 0
    yy, xx = np.mgrid[0:h, 0:w]
    # vidro: lilás e branco; o espelho = vidro + 2 px de moldura em volta
    vidro = op & (((ai[..., 2] > 150) & (ai[..., :3].sum(2) > 420) & (ai[..., 2] >= ai[..., 0]))
                  | (ai[..., :3].sum(2) > 600))   # o brilho branco do vidro
    esp = nd.binary_dilation(vidro, iterations=2) & op
    n_sim = eg.get("simetria", 4)

    def rot_coord(cx, cy, k):
        ang = 2 * math.pi * k / n_sim
        dx, dy = xx - cx, yy - cy
        rx = np.rint(cx + dx * math.cos(ang) - dy * math.sin(ang)).astype(int)
        ry = np.rint(cy + dx * math.sin(ang) + dy * math.cos(ang)).astype(int)
        return rx, ry

    # centro: o que melhor casa a engrenagem com ela mesma girada (simetria)
    corpo = op & ~esp
    melhor = None
    for cy2 in range(2 * (h // 2 - 8), 2 * (h // 2 + 4)):
        for cx2 in range(2 * (w // 2 - 4), 2 * (w // 2 + 4)):
            cx, cy = cx2 / 2, cy2 / 2
            rx, ry = rot_coord(cx, cy, 1)
            ok = (rx >= 0) & (rx < w) & (ry >= 0) & (ry < h)
            vis = ok & ~esp & ~np.where(ok, esp[ry.clip(0, h - 1), rx.clip(0, w - 1)], True)
            igual = (corpo == np.where(ok, corpo[ry.clip(0, h - 1), rx.clip(0, w - 1)], False)) & vis
            nota = igual.sum() / max(vis.sum(), 1)
            if melhor is None or nota > melhor[0]:
                melhor = (nota, cx, cy)
    _, cx, cy = melhor
    dist = np.hypot(xx - cx, yy - cy)
    # raio dos dentes: o pixel opaco mais longe na metade de cima (sem cacos nem espelho)
    # raio dos dentes: os dentes da esquerda e da direita, na altura do centro
    R = float(dist[corpo & (np.abs(yy - cy) <= 8)].max()) + 0.5
    disco = dist <= R
    # a ponta do espelho que passa da engrenagem (em cima) é do espelho
    esp |= op & ~disco & (yy < cy)
    # cabeça dos pingos: o escuro na borda da engrenagem ligado aos cacos de
    # fora; sai da engrenagem (não gira junto) e cai com o caco
    fora = op & ~esp & ~disco & (yy > cy)
    escuro = op & (ai[..., :3].sum(2) < 150) & disco & (dist > R - 8) & (yy > cy)
    # só nas colunas de cada pingo (o contorno escuro da engrenagem também é
    # escuro e encosta nos pingos: sem isso caía junto)
    cols = np.zeros((h, w), bool)
    rf_, nf_ = nd.label(fora, structure=np.ones((3, 3), bool))
    for sl in nd.find_objects(rf_):
        cols[:, sl[1].start:sl[1].stop] = True
    escuro &= cols & (dist > R - 6)
    rot_, n_ = nd.label(escuro | fora, structure=np.ones((3, 3), bool))
    cabeca = escuro & np.isin(rot_, np.unique(rot_[fora & (rot_ > 0)]))
    eng = np.zeros_like(a)
    eng[disco & ~esp & ~cabeca] = a[disco & ~esp & ~cabeca]
    # atrás do espelho (e sob os pingos): o pixel equivalente nas outras
    # posições da simetria
    falta = disco & (esp | cabeca)
    for k in range(1, n_sim):
        rx, ry = rot_coord(cx, cy, k)
        ok = falta & (rx >= 0) & (rx < w) & (ry >= 0) & (ry < h)
        ok &= ~esp[ry.clip(0, h - 1), rx.clip(0, w - 1)]
        ok &= ~cabeca[ry.clip(0, h - 1), rx.clip(0, w - 1)]
        eng[ok] = a[ry[ok], rx[ok]]
        falta &= ~ok
    # o que sobrou (o miolo: o centro gira sobre si mesmo): a cor mais comum
    # da engrenagem na mesma distância do centro
    vis = disco & ~esp & ~cabeca & ~falta
    for (y, x) in zip(*np.nonzero(falta)):
        anel_ = vis & (np.abs(dist - dist[y, x]) < 0.75)
        if anel_.any():
            u_, k_ = np.unique(a[anel_].reshape(-1, 4), axis=0, return_counts=True)
            eng[y, x] = u_[k_.argmax()]
    cacos = (op & ~esp & ~disco) | cabeca
    espelho = np.zeros_like(a)
    espelho[esp] = a[esp]
    rot_, n_ = nd.label(cacos, structure=np.ones((3, 3), bool))
    lista = []
    for j, sl in enumerate(nd.find_objects(rot_), 1):
        lista.append({"x": sl[1].start, "y": sl[0].start, "w": sl[1].stop - sl[1].start, "h": sl[0].stop - sl[0].start})
    cac = np.zeros_like(a)
    cac[cacos] = a[cacos]
    Image.fromarray(eng).save(saida / f"ilha_{i}_engrenagem.png")
    Image.fromarray(espelho).save(saida / f"ilha_{i}_espelho.png")
    Image.fromarray(cac).save(saida / f"ilha_{i}_cacos.png")
    print("engrenagem: centro", (cx, cy), "raio", round(R, 1), "cacos", len(lista), "nota", round(melhor[0], 3))
    return {"engrenagem": f"ilha_{i}_engrenagem.png", "espelho": f"ilha_{i}_espelho.png",
            "cacos": f"ilha_{i}_cacos.png", "centro": [cx, cy], "raio": round(R, 1), "pecas": lista,
            "obs": "a engrenagem gira em volta do centro; o espelho fica parado; os cacos caem aos poucos"}


def montar(nome, cfg, saida):
    a = nativo(cfg)
    yy = np.arange(H)[:, None] * np.ones((1, W), int)
    hz, ch = cfg["horizonte"], cfg["chao"]

    # chão: tábuas para baixo + a grade marrom na beira
    b0, b1 = cfg["beira"]
    r_, g_, b_ = (a[..., i].astype(int) for i in range(3))
    tabuas = yy >= ch
    # grade: cinza-marrom (o mar é azul: b bem maior que r), ligada às tábuas
    grade = (yy >= b0) & (yy < ch) & (b_ - r_ < 17) & (g_ - r_ < 9)
    # contorno escuro dos postes e da corda vai junto (1 px em volta); ele
    # também liga o topo do poste ao resto, então entra antes da ligação
    escuro = (a.max(2) < 30) & (yy >= b0) & (yy < ch)
    grade |= nd.binary_dilation(grade, iterations=1) & escuro
    rot, n = nd.label(grade | tabuas)
    grade &= rot == rot[H - 1, 0]
    # vãos de 1 px dentro dos postes (brilho com cor de mar)
    faixa = (yy >= b0) & (yy < ch)
    grade |= nd.binary_closing(grade, structure=np.ones((1, 3), bool)) & faixa
    grade |= nd.binary_closing(grade, structure=np.ones((3, 1), bool)) & faixa
    chao = tabuas | grade
    # furinhos (brilho no poste): só buracos pequenos; o mar sob a corda fica
    buracos = nd.binary_fill_holes(chao) & ~chao
    rot, n = nd.label(buracos)
    if n:
        tam = nd.sum(buracos, rot, range(1, n + 1))
        chao |= np.isin(rot, [i + 1 for i, t in enumerate(tam) if t <= 4])
    # pedras sobre o píer: na caixa, o que não tem as cores do mar das bordas
    # de cima e dos lados (como as ilhas); fica a peça grande, sem furos
    pedras = []
    for (x0, y0, x1, y1) in cfg.get("sobre_chao", []):
        cx = caixa(x0, y0, min(x1, W), min(y1, ch))
        borda = cx & ~nd.binary_erosion(cx)
        borda[min(y1, ch) - 1, :] = False
        cores = np.unique(a[borda & ~chao], axis=0).astype(int)
        dif = np.abs(a.astype(int)[:, :, None, :] - cores[None, None]).sum(-1).min(-1)
        pedra = cx & (dif > 12) & ~chao
        pedra = nd.binary_closing(pedra, iterations=1) & cx
        rot, n = nd.label(pedra)
        if n:
            tam = nd.sum(pedra, rot, range(1, n + 1))
            pedra = np.isin(rot, [i + 1 for i, t in enumerate(tam) if t >= 20])
        # pedra é maciça: de cada coluna, do primeiro pixel até as tábuas
        cols = np.nonzero(pedra.any(0))[0]
        for x in cols:
            pedra[np.argmax(pedra[:, x]):ch, x] = True
        pedra &= cx
        chao |= pedra
        pedras.append((pedra, (x0, y0, min(x1, W), min(y1, ch))))

    soma = a.astype(int).sum(2)
    r_, g_, b_ = (a[..., i].astype(int) for i in range(3))
    mar = (b_ - r_ > 25) & (soma > 120) & (soma < 330)

    # PLACA: a mesma cena sem os objetos do meio (prompt "Placa limpa").
    # Objeto = o que difere do bruto; mar ao longe = a placa.
    pcfg = dict(cfg, arquivo=cfg["placa"])
    pl = nativo(pcfg, paleta_de(a))
    dif = np.abs(a.astype(int) - pl.astype(int)).sum(2)
    # só o que não é água azul entra direto; o corpo das ondas (água cercada
    # de espuma) entra depois, fechando furos pequenos
    obj = (dif > 45) & ~chao & ~mar
    zona_y0 = hz - 30  # mastros sobem acima do horizonte
    obj &= (yy >= zona_y0) & (yy < ch)
    for bx in cfg.get("fora_objetos", []):   # nuvem/ilha que a placa mexeu
        obj &= ~caixa(*bx)
    # sob a lua, o que difere da placa é o reflexo e a textura da água: ali só
    # conta o que não é água (espuma, pedra, madeira)
    rcx = caixa(*cfg["reflexo"])
    refl = rcx & ((r_ > b_ + 10) | mar)
    obj &= ~refl
    # brilhos do reflexo são riscos de 1 px de altura; espuma é mancha
    dentro = obj & rcx
    obj = (obj & ~rcx) | nd.binary_opening(dentro, structure=np.ones((2, 2), bool))
    obj = nd.binary_closing(obj, iterations=1) & ~refl & ~chao
    # objeto de verdade tem espuma, pedra ou madeira (não-água); manchas de
    # textura do mar que só diferem da placa ficam de fora
    rot, n = nd.label(obj)
    if n:
        forte = nd.sum(~mar, rot, range(1, n + 1))
        obj = np.isin(rot, [i + 1 for i, f in enumerate(forte) if f >= 12])
    # corpo das ondas: água bem mais clara que a placa, colada na espuma
    psoma0 = pl.astype(int).sum(2)
    face = mar & (soma - psoma0 > 40) & nd.binary_dilation(obj, iterations=6) & ~chao & ~refl
    obj |= face
    # o contorno escuro em volta dos objetos vai junto; furos fechados; a
    # corda/poste do chão que corta uma onda não deixa risco vazio nela
    obj |= nd.binary_dilation(obj, iterations=1) & (dif > 25) & ~mar
    obj = nd.binary_closing(obj, structure=np.ones((5, 1), bool)) & (yy < ch)
    # furos pequenos fecham (corpo da onda); mar grande cercado fica de fora
    buracos = nd.binary_fill_holes(obj) & ~obj
    rot, n = nd.label(buracos)
    if n:
        tam = nd.sum(buracos, rot, range(1, n + 1))
        obj |= np.isin(rot, [i + 1 for i, t in enumerate(tam) if t <= 160])
    # objetos que têm de sair inteiros (a onda grande: a água por baixo da
    # crista não é cercada de espuma, então fecha tudo dentro do contorno)
    for bx in cfg.get("inteiros", []):
        cx = caixa(*bx)
        dentro = nd.binary_closing(obj & cx, iterations=4) & cx
        dentro = nd.binary_fill_holes(dentro)
        # a base da onda é maciça: de cada coluna, do primeiro pixel até o
        # fundo da caixa (atrás da grade do píer)
        x0b, y0b, x1b, y1b = bx
        for x in np.nonzero(dentro.any(0))[0]:
            dentro[np.argmax(dentro[:, x]):y1b, x] = True
        obj |= dentro & cx & ~chao
    # respingos soltos acima do horizonte ficam no fundo (parados)
    rot, n = nd.label(obj)
    if n:
        for i, sl in enumerate(nd.find_objects(rot), 1):
            comp = rot == i
            if sl[0].stop <= hz + 1 and comp.sum() < 60:
                obj &= ~comp
    # sob a lua, acima da crista da onda, é tudo reflexo/água
    obj &= ~(rcx & (yy < cfg.get("reflexo_crista", ch)))
    meio = obj
    cor_meio = a.copy()
    sob_chao = meio & chao
    cor_meio = remendar_fino(cor_meio, sob_chao)

    # mastros acima do horizonte também saem do fundo
    altos = meio & (yy < hz)

    # mar ao longe: a placa, opaca do horizonte para baixo; sem o reflexo
    # fraco que a placa ainda tem e sem a grade/pedras do chão
    longe = yy >= hz
    cor_longe = pl.copy()
    lin = np.array([np.median(soma[y]) for y in range(H)])[:, None]
    psoma = pl.astype(int).sum(2)
    rx0, ry0, rx1, ry1 = cfg["reflexo"]
    tira = caixa(rx0 - 10, hz, rx1 + 10, ry1 + 6) & (psoma > np.array(
        [np.median(psoma[y][(yy[y] >= hz)]) for y in range(H)])[:, None] + 40)
    tira = nd.binary_dilation(tira, iterations=1) & longe
    tira |= nd.binary_dilation(chao, iterations=1) & longe & (yy < ch)
    pmar = (pl[..., 2].astype(int) - pl[..., 0] > 25)
    cor_longe = remendar_textura(cor_longe, tira, ~pmar | tira, (0, hz, W, ch))
    cor_longe = ondinhas(cor_longe, tira & caixa(rx0 - 10, hz, rx1 + 10, ry1 + 6), pmar)

    # reflexo desenhado: cores do reflexo original (claro, médio, apagado)
    r = caixa(*cfg["reflexo"])
    br = r & (r_ > b_ + 10) & (r_ > 110)
    uni, cnt = np.unique(a[br], axis=0, return_counts=True)
    ordem = np.argsort(-uni.astype(int).sum(1))
    claras = uni[ordem]
    cores = [claras[0], claras[len(claras) // 2], claras[-1]]
    lx0, ly0, lx1, ly1 = cfg["lua"]
    cx = (lx0 + lx1) / 2
    raio = (lx1 - lx0) / 2
    reflexos = [reflexo_rajadas(cores, cx, hz, ry1, raio * 0.95, raio * 0.25, s_) for s_ in (11, 12, 13)]
    reflexo = (reflexos, 0, hz)

    # marco distante (farol): no fundo ele desceria 62 px e sumiria atrás do
    # mar; vira sprite parado, de pé na linha do horizonte
    marco = None
    if cfg.get("marco"):
        # silhueta escura sobre o céu (com a luz acesa dentro)
        cxm = caixa(*cfg["marco"]) & (yy < hz)
        obj_m = cxm & (soma < 205)
        obj_m = nd.binary_fill_holes(obj_m | (cxm & (soma > 500)) & nd.binary_dilation(obj_m, iterations=1))
        ys, xs = np.nonzero(obj_m)
        marco = (rgba(a, obj_m).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)),
                 int(xs.min()), int(ys.min()))

    # ilhas
    ilhas, ilhas_m = [], np.zeros((H, W), bool)
    for bx in cfg["ilhas"]:
        obj_i = ilha(a, *bx)
        ilhas_m |= obj_i
        ys, xs = np.nonzero(obj_i)
        ilhas.append((rgba(a, obj_i).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)),
                      int(xs.min()), int(ys.min())))

    # fundo: acima do horizonte, sem ilhas nem mastros (completa pela linha)
    base = preencher_linhas(a, ilhas_m | nd.binary_dilation(altos, iterations=1) & (yy < hz))
    base[hz:] = base[hz - 1]  # abaixo do horizonte o fundo nunca aparece

    nuvens = np.zeros((H, W), bool)  # tempestade: fica no fundo, parada
    chao_im = rgba(a, chao)
    sobe = cfg.get("subir_chao", 0)
    if sobe:
        c = np.array(chao_im)
        c = np.concatenate([c[sobe:], np.repeat(c[-1:], sobe, 0)])
        chao_im = Image.fromarray(c)

    fundo_ref = rgba(base, np.ones((H, W), bool))
    largo, pad = alargar_fundo(fundo_ref, 960, cfg["centro_x"])

    nuvens = np.zeros((H, W), bool)  # tempestade: fica no fundo, parada
    chao_im = rgba(a, chao)
    sobe = cfg.get("subir_chao", 0)
    if sobe:
        c = np.array(chao_im)
        c = np.concatenate([c[sobe:], np.repeat(c[-1:], sobe, 0)])
        chao_im = Image.fromarray(c)
    camadas = {"nuvens": rgba(a, nuvens), "longe": rgba(cor_longe, longe),
               "meio": rgba(cor_meio, meio), "chao": chao_im}

    saida.mkdir(parents=True, exist_ok=True)
    fundo_ref.save(saida / "fundo_referencia.png")
    largo.save(saida / "fundo.png")
    for k, im in camadas.items():
        # camada pintada à mão pelo usuário (<camada>_editado.png) vale mais
        # que a gerada: nunca é sobrescrita
        editada = saida / f"{k}_editado.png"
        if editada.exists():
            Image.open(editada).save(saida / f"{k}.png")
            continue
        espelhar_emendavel(im).save(saida / f"{k}.png")
    info_ilhas = []
    for i, (sp, x, y) in enumerate(ilhas, 1):
        sp.save(saida / f"ilha_{i}.png")
        y = cfg.get("ilhas_y", [y] * 9)[i - 1] if "ilhas_y" in cfg else y
        info_ilhas.append({"arquivo": f"ilha_{i}.png", "x": x + pad, "y": y})
    lx0, ly0, lx1, ly1 = cfg["lua"]
    meta = {
        "tamanho_nativo": [W, H],
        "pes_dos_personagens_y": PES,
        "horizonte_y": hz,
        "lua_ceu": {"x": lx0 + pad, "y": ly0, "w": lx1 - lx0, "h": ly1 - ly0,
                    "obs": "caixa da lua no fundo.png (para a lua minguar)"},
        "camadas": [
            {"arquivo": "fundo.png", "velocidade": VELOCIDADE["fundo"], "rola": False,
             "obs": "parado e centralizado; a ilustração original fica no meio"},
            {"arquivo": "nuvens.png", "velocidade": VELOCIDADE["nuvens"], "rola": True,
             "vento_px_por_s": 2, "vazia": not nuvens.any()},
            {"ilhas": info_ilhas, "velocidade": VELOCIDADE["ilhas"], "balanco_px": 2,
             "obs": "coordenadas no fundo.png; sobem e descem devagar"},
            {"arquivo": "longe.png", "velocidade": VEL_LONGE, "rola": True,
             "obs": "mar ao longe (água calma), entre as ilhas e o meio; o reflexo fica em cima dele"},
            {"arquivo": "meio.png", "velocidade": VELOCIDADE["meio"], "rola": True},
            {"arquivo": "chao.png", "velocidade": VELOCIDADE["chao"], "rola": True},
        ],
        "velocidade_1": "px por px que a Lua anda",
        "modos": {"compacto": {"janela_y": list(JANELA), "camadas_de_tras_descem": DESCE}},
    }
    if marco is not None:
        sp, x, y = marco
        sp.save(saida / "marco.png")
        meta["marco"] = {"arquivo": "marco.png", "x": x + pad + cfg.get("marco_dx", 0), "y_tela": y,
                         "obs": "x no fundo.png; y já na tela (não desce): de pé no horizonte, parado"}
    if reflexo is not None:
        sps, x, y = reflexo
        arqs = []
        for i, sp in enumerate(sps):
            sp.save(saida / f"reflexo_{i}.png")
            arqs.append(f"reflexo_{i}.png")
        meta["reflexo"] = {"arquivos": arqs, "x": x, "y": y, "ms": 330,
                           "obs": "parado na tela (não rola nem desce), entre o longe e o meio; "
                                  "os quadros se alternam (tremor do luar na água)"}
    (saida / "cenario.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    return meta


def montar_ceu(nome, cfg, saida):
    """Bioma sem placa, com objetos do meio (colunas, arcos, árvores) contra o
    céu: é fundo a cor que aparece no céu daquela altura (amostras em colunas
    livres); o resto, ligado ao chão, é meio."""
    a = nativo(cfg)
    yy = np.arange(H)[:, None] * np.ones((1, W), int)
    xx = np.arange(W)[None, :] * np.ones((H, 1), int)
    ch = cfg["chao"]
    soma = a.astype(int).sum(2)
    chao = yy >= ch

    # cores do céu por linha (com folga de ±5 linhas), das colunas livres
    amostra = np.zeros((H, W), bool)
    for bx in cfg["ceu_caixas"]:
        amostra |= caixa(*bx)
    linhas_am = np.nonzero(amostra.any(1))[0]
    ceu = np.zeros((H, W), bool)
    ai = a.astype(int)
    # da `opaco_desde` para baixo (arbustos e grama de trás) é tudo meio
    for y in range(cfg["meio_topo"], cfg["opaco_desde"]):
        perto = linhas_am[np.abs(linhas_am - y) <= 5]
        if not len(perto):
            perto = linhas_am[np.abs(linhas_am - y) == np.abs(linhas_am - y).min()]
        cores = np.unique(np.concatenate([a[yy_][amostra[yy_]] for yy_ in perto]), axis=0).astype(int)
        dif = np.abs(ai[y][:, None, :] - cores[None]).sum(-1).min(-1)
        ceu[y] = dif <= cfg.get("tol_ceu", 18)
    ceu[:cfg["meio_topo"]] = True
    cores_am = np.unique(a[amostra], axis=0).astype(int)
    ceu_amostra_exata = np.abs(ai[:, :, None, :] - cores_am[None, None]).sum(-1).min(-1) == 0
    obj = ~ceu & (yy >= cfg["meio_topo"]) & ~chao
    # marco (templo ao longe) não é meio: vira sprite parado
    mbox = caixa(*cfg["marco"]) if cfg.get("marco") else np.zeros((H, W), bool)
    obj_m = mbox & ~ceu & ~chao
    obj &= ~(mbox & (yy < cfg["marco_base"]))
    obj = nd.binary_opening(obj, iterations=1) | (obj & nd.binary_dilation(nd.binary_opening(obj, iterations=1), iterations=1))
    # fica o que se liga ao chão (colunas, arbustos); fiapos soltos saem
    rot, n = nd.label(obj | chao)
    obj &= rot == rot[H - 1, 0]
    buracos = nd.binary_fill_holes(obj | chao) & ~(obj | chao)
    rot, n = nd.label(buracos)
    if n:
        tam = nd.sum(buracos, rot, range(1, n + 1))
        obj |= np.isin(rot, [i + 1 for i, t in enumerate(tam) if t <= 12])
    meio = obj

    # nuvens: manchas claras rosadas no alto, inteiras e fora da lua
    lx0, ly0, lx1, ly1 = cfg["lua"]
    r_, g_, b_ = (ai[..., i] for i in range(3))
    clara = (soma > cfg.get("nuvem_soma", 470)) & (r_ > g_ + 15) & (yy < cfg["nuvens_ate"])
    clara &= ~caixa(lx0 - 4, ly0 - 4, lx1 + 4, ly1 + 4)
    rot, n = nd.label(nd.binary_closing(clara, iterations=1))
    nuvens = np.zeros((H, W), bool)
    for i, sl in enumerate(nd.find_objects(rot), 1):
        comp = rot == i
        if comp.sum() >= 30 and sl[0].stop <= cfg["nuvens_ate"]:
            nuvens |= nd.binary_dilation(comp, iterations=1) & (yy < cfg["nuvens_ate"] + 2)

    # ilhas
    ilhas, ilhas_m = [], np.zeros((H, W), bool)
    for bx in cfg["ilhas"]:
        oi = ilha(a, *bx)
        ilhas_m |= oi
        ys, xs = np.nonzero(oi)
        ilhas.append((rgba(a, oi).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)),
                      int(xs.min()), int(ys.min())))

    # o que é ilha não é meio (raízes penduradas descem até a altura das ruínas)
    meio &= ~nd.binary_dilation(ilhas_m, iterations=1)

    # marco: o templo ao longe, recortado contra o céu
    marco = None
    if cfg.get("marco"):
        om = nd.binary_fill_holes(nd.binary_closing(obj_m & (yy < cfg["marco_base"]), iterations=1))
        rot, n = nd.label(om)
        if n > 1:
            tam = nd.sum(om, rot, range(1, n + 1))
            om = rot == (np.argmax(tam) + 1)
        ys, xs = np.nonzero(om)
        o_xy = (int(xs.min()), int(ys.min()))     # onde o templo começa (para o _editado)
        # morros e torrinhas ao longe com a mesma névoa do templo: vão juntos
        if cfg.get("morros"):
            pal = np.unique(a[om], axis=0).astype(int)
            difm = np.abs(ai[:, :, None, :] - pal[None, None]).sum(-1).min(-1)
            # névoa: mesmas cores do templo, longe das pedras e arbustos do meio
            r_m, g_m, b_m = (ai[..., i] for i in range(3))
            lilas = (b_m > g_m + 12) & (r_m > g_m + 8) & (soma > 300) & (soma < 500)
            # pedra e arbusto de verdade: o que não é lilás nem céu
            solido = ~lilas & ~ceu & (yy >= cfg["meio_topo"]) & ~chao
            longe_do_meio = ~nd.binary_dilation(solido, iterations=2)
            morros = caixa(*cfg["morros"]) & lilas & ~(ceu_amostra_exata & (yy < 150)) & longe_do_meio
            morros = nd.binary_closing(morros, iterations=1) & caixa(*cfg["morros"])
            rot, n = nd.label(morros)
            if n:
                tam = nd.sum(morros, rot, range(1, n + 1))
                morros = np.isin(rot, [i + 1 for i, t in enumerate(tam) if t >= 15])
            om = om | morros
            meio &= ~morros
        ys, xs = np.nonzero(om)
        marco = (rgba(a, om).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)),
                 int(xs.min()), int(ys.min()), om, o_xy)

    # fundo: céu completo (sem nuvens, ilhas, templo e meio), pela linha
    tira = nuvens | ilhas_m | meio | chao | (marco[3] if marco else False)
    base = preencher_linhas(a, nd.binary_dilation(tira, iterations=1))
    # da altura das ruínas para baixo o céu é refeito inteiro, linha a linha,
    # com a cor mais comum do céu limpo naquela altura (sem restos de contorno)
    y_ref = cfg["meio_topo"] - cfg.get("ceu_refeito_folga", 8)
    puxa = cfg.get("ceu_puxa", 0)  # o claro do horizonte sobe (aparece atrás do templo)
    for y in range(y_ref, H):
        yo = y + int(round(puxa * min(max((y - y_ref) / 24, 0), 1)))
        perto = linhas_am[np.abs(linhas_am - yo) == np.abs(linhas_am - yo).min()]
        px = np.concatenate([a[yy_][amostra[yy_]] for yy_ in perto])
        cores, n = np.unique(px, axis=0, return_counts=True)
        linha = np.broadcast_to(cores[n.argmax()], (W, 3)).copy()
        base[y] = linha  # a lua e o templo não descem até aqui
    fundo_ref = rgba(base, np.ones((H, W), bool))
    largo, pad = alargar_fundo(fundo_ref, 960, cfg["centro_x"])

    # pés das colunas (pedra cinza que desce do meio para a beirada do chão):
    # no chão, viram pedra do caminho; no meio, ficam atrás do chão que subiu
    sobe = cfg.get("subir_chao", 0)
    cor_chao = a.copy()
    if sobe:
        r_, g_, b_ = (ai[..., i] for i in range(3))
        cinza = (np.abs(r_ - g_) < 18) & (b_ - r_ < 30) & (soma > 230) & ~(g_ > r_ + 8)
        pes_col = np.zeros(W, bool)
        for y in range(ch - 4, ch):
            pes_col |= meio[y] & cinza[y]
        pes_col = nd.binary_dilation(pes_col, iterations=2)
        faixa_pe = (yy >= ch) & (yy < ch + sobe + 3) & pes_col[None, :]
        cor_chao = remendar_textura(cor_chao, faixa_pe, faixa_pe | ~chao, (0, ch, W, ch + sobe + 3), dy_max=0)
    chao_im = rgba(cor_chao, chao)
    if sobe:
        c = np.array(chao_im)
        c = np.concatenate([c[sobe:], np.repeat(c[-1:], sobe, 0)])
        chao_im = Image.fromarray(c)
    camadas = {"nuvens": rgba(a, nuvens), "meio": rgba(a, meio), "chao": chao_im}
    saida.mkdir(parents=True, exist_ok=True)
    fundo_ref.save(saida / "fundo_referencia.png")
    # fundo pintado pelo usuário (já com o templo e os morros): vale ele, e o
    # marco separado deixa de existir
    fundo_pintado = (saida / "fundo_editado.png").exists()
    if fundo_pintado:
        Image.open(saida / "fundo_editado.png").save(saida / "fundo.png")
        marco = None
    else:
        largo.save(saida / "fundo.png")
    for k, im in camadas.items():
        editada = saida / f"{k}_editado.png"
        if editada.exists():
            Image.open(editada).save(saida / f"{k}.png")
            continue
        espelhar_emendavel(im).save(saida / f"{k}.png")
    info_ilhas = []
    for i, (sp, x, y) in enumerate(ilhas, 1):
        ed = saida / f"ilha_{i}_editado.png"
        im_i = Image.open(ed).convert("RGBA") if ed.exists() else sp
        esc = cfg.get("ilhas_escala", [1] * 9)[i - 1]
        if esc != 1:
            # menor sem borrar: vizinho mais próximo (o arquivo do usuário não muda)
            im_i = im_i.resize((round(im_i.width * esc), round(im_i.height * esc)), Image.NEAREST)
        im_i.save(saida / f"ilha_{i}.png")
        y = cfg["ilhas_y"][i - 1] if "ilhas_y" in cfg else y
        info_ilhas.append({"arquivo": f"ilha_{i}.png", "x": x + pad, "y": y})
    meta = {
        "tamanho_nativo": [W, H],
        "pes_dos_personagens_y": PES,
        "lua_ceu": {"x": lx0 + pad, "y": ly0, "w": lx1 - lx0, "h": ly1 - ly0,
                    "obs": "caixa da lua no fundo.png (para a lua minguar)"},
        "camadas": [
            {"arquivo": "fundo.png", "velocidade": VELOCIDADE["fundo"], "rola": False},
            {"arquivo": "nuvens.png", "velocidade": VELOCIDADE["nuvens"], "rola": True,
             "vento_px_por_s": 2, "vazia": not nuvens.any()},
            {"ilhas": info_ilhas, "velocidade": VELOCIDADE["ilhas"], "balanco_px": 2},
            {"arquivo": "meio.png", "velocidade": VELOCIDADE["meio"], "rola": True},
            {"arquivo": "chao.png", "velocidade": VELOCIDADE["chao"], "rola": True},
        ],
        "velocidade_1": "px por px que a Lua anda",
        "modos": {"compacto": {"janela_y": list(JANELA), "camadas_de_tras_descem": cfg.get("desce", DESCE)}},
    }
    if marco is not None:
        sp, x, y, _, (ox, oy) = marco
        if (saida / "marco_editado.png").exists():
            # o templo pintado pelo usuário vai por cima, no lugar dele
            sp = sp.copy()
            ed = Image.open(saida / "marco_editado.png").convert("RGBA")
            sp.paste(ed, (ox - x, oy - y), ed)
        sp.save(saida / "marco.png")
        meta["marco"] = {"arquivo": "marco.png", "x": x + pad, "y_tela": cfg.get("marco_y_tela", y) + (y - oy),
                         "obs": "x no fundo.png; y já na tela (não desce): parado, atrás do meio"}
    (saida / "cenario.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    return meta


def subir_cidade(arq, c):
    """Sobe os prédios da cidade ao longe (pixels escuros: azul < 100, a névoa
    é mais azul) para aparecerem acima das casas do meio. A névoa fica onde
    está e as colunas da torre não mudam (posição e tamanho aprovados)."""
    im = Image.open(arq).convert("RGBA")
    a = np.array(im)
    novo = a.copy()
    y0, y1 = c["linhas"]
    tx0, tx1 = c["torre_x"]
    dy = c["px"]
    pred = np.zeros(a.shape[:2], bool)
    pred[y0:y1] = a[y0:y1, :, 2] < 100
    pred[:, tx0:tx1 + 1] = False
    ys, xs = np.nonzero(pred)
    # de cima para baixo: o que é mais baixo (mais perto do chão) cobre o resto
    ordem = np.argsort(ys)
    novo[ys[ordem] - dy, xs[ordem]] = a[ys[ordem], xs[ordem]]
    Image.fromarray(novo).save(arq)


def nuvens_do_ref(ref, c):
    """Nuvens soltas do céu (claras, com o contorno) recortadas do fundo de
    referência, repetidas duas vezes (958 px, sem espelho) para rolarem."""
    a = np.array(ref.convert("RGBA"))
    H, W = a.shape[:2]
    clara = (a[..., :3].astype(int).sum(2) > 450)
    clara[c["ate"]:] = False
    for (x0, y0, x1, y1) in c["fora"]:
        clara[y0:y1, x0:x1] = False
    m = nd.binary_dilation(clara, iterations=1)
    m[c["ate"]:] = False
    um = np.zeros_like(a)
    um[m] = a[m]
    um[m, 3] = 255
    dupla = Image.new("RGBA", (W * 2, H))
    dupla.paste(Image.fromarray(um), (0, 0))
    dupla.paste(Image.fromarray(um), (W, 0))
    return dupla


def montar_placa(nome, cfg, saida):
    """Bioma com placa limpa e sem píer nem reflexo (vulcão, aurora...):
    meio = o que difere da placa (árvores, pedras, fumaça), em qualquer
    altura; longe = a placa do horizonte para baixo (opaca); fundo = céu sem
    os objetos; marco = o pico/castelo do horizonte, parado."""
    a = nativo(cfg)
    pl = nativo(dict(cfg, arquivo=cfg["placa"]), paleta_de(a))
    yy = np.arange(H)[:, None] * np.ones((1, W), int)
    hz, ch = cfg["horizonte"], cfg["chao"]
    soma = a.astype(int).sum(2)
    chao = yy >= ch
    # grade de latão na beira da passarela (torre): vai inteira com o chão
    grade = np.zeros((H, W), bool)
    if cfg.get("grade_latao"):
        b0 = cfg["grade_latao"]
        ai_ = a.astype(int)
        faixa = (yy >= b0) & (yy < ch)
        grade = faixa & (ai_[..., 0] > ai_[..., 2] + 25) & (soma > 180)
        grade |= nd.binary_dilation(grade, iterations=1) & faixa & (a.max(2) < 30)
        rot, n = nd.label(grade | chao)
        grade &= rot == rot[H - 1, 0]
        chao = chao | grade
    dif = np.abs(a.astype(int) - pl.astype(int)).sum(2)

    # ilhas (não são objeto do meio)
    ilhas, ilhas_m = [], np.zeros((H, W), bool)
    for bx in cfg["ilhas"]:
        oi = (ilha_por_linha(a, *bx, pedacos=cfg.get("ilha_pedacos", False)) if cfg.get("ilha_por_linha")
              else ilha(a, *bx))
        ilhas_m |= oi
        ys, xs = np.nonzero(oi)
        ilhas.append((rgba(a, oi).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)),
                      int(xs.min()), int(ys.min())))

    obj = (dif > cfg.get("dif_obj", 60)) & ~chao & ~nd.binary_dilation(ilhas_m, iterations=2)
    for bx in cfg.get("fora_objetos", []):   # o que a placa mexeu e não é objeto (rachadura do sol)
        obj &= ~caixa(*bx)
    if cfg.get("dif_fraco"):
        # histerese: partes que diferem pouco da placa (pétala amarela sobre
        # trigo amarelo, bandeira laranja) entram se estiverem ligadas a uma
        # parte que difere muito (o miolo escuro, o mastro)
        limiar = np.full((H, 1), cfg["dif_fraco"])
        if cfg.get("dif_fraco_alto"):
            # mais alto (lá no campo) a regra é mais rígida: as bandeirinhas
            # distantes não se grudam nos girassóis pelo trigo
            y_l, v_l = cfg["dif_fraco_alto"]
            limiar[:y_l] = v_l
        fraco = (dif > limiar) & ~chao & ~nd.binary_dilation(ilhas_m, iterations=2)
        rot, n = nd.label(fraco | obj, structure=np.ones((3, 3), bool))
        obj = np.isin(rot, np.unique(rot[obj & (rot > 0)]))
        for bx in cfg.get("fora_objetos", []):
            obj &= ~caixa(*bx)
    obj = nd.binary_opening(obj, iterations=1) | (obj & nd.binary_dilation(nd.binary_opening(obj, iterations=1), iterations=1))
    obj |= nd.binary_dilation(obj, iterations=1) & (dif > 25) & ~chao
    # pilares escuros sobre campo escuro diferem pouco da placa: junta os
    # pedaços na vertical (o pilar volta inteiro, sem cacos flutuando)
    obj |= nd.binary_closing(obj, structure=np.ones((9, 1), bool)) & (dif > 12) & ~chao
    obj = nd.binary_closing(obj, structure=np.ones((5, 1), bool)) & ~chao
    rot, n = nd.label(obj)
    if n:
        tam = nd.sum(obj, rot, range(1, n + 1))
        obj = np.isin(rot, [i + 1 for i, t in enumerate(tam) if t >= cfg.get("obj_min", 60)])
    # galhos finos contra o céu: no céu qualquer diferença da placa é objeto
    # (a abertura acima apagava os galhos de 1 px)
    ceu_obj = (dif > 40) & (yy < hz) & ~nd.binary_dilation(ilhas_m, iterations=2)
    rot, n = nd.label(ceu_obj | obj, structure=np.ones((3, 3), bool))
    ligados = np.unique(rot[obj & (rot > 0)])
    obj |= ceu_obj & np.isin(rot, ligados)
    # pedras e troncos são maciços do horizonte para baixo: em cada coluna com
    # objeto, do primeiro pixel até o chão (a lava entre as rachaduras da
    # pedra é igual na placa e virava furo)
    if cfg.get("macico_abaixo_horizonte", True):
        baixo = obj & (yy >= hz)
        for x in np.nonzero(baixo.any(0))[0]:
            ys_ = np.nonzero(baixo[:, x])[0]
            # entre o primeiro e o último pixel de objeto da coluna (não até o
            # chão: isso fazia blocos retos de lava)
            obj[ys_.min():ys_.max() + 1, x] = True
    if cfg.get("planicie_bruto"):
        # a planície do bruto (marrom, sem brilho) entre as pedras não é objeto:
        # ali aparece a planície da placa, ao longe (as pedras são violeta ou
        # pretas; o vão fechado entre pedras volta logo abaixo, com as pedras)
        # (no céu, as faixas âmbar e o pináculo marrom também não são objeto)
        ai_ = a.astype(int)
        marrom_ = ai_[..., 0] > ai_[..., 2]
        plano = marrom_ & (soma < 260) & (yy >= hz) & (yy < ch)
        # só a planície que vem do horizonte (ligada às primeiras linhas); um
        # pixel marrom perdido no meio do entulho é do entulho
        rot, n = nd.label(plano)
        plano = np.isin(rot, np.unique(rot[hz:hz + 4][rot[hz:hz + 4] > 0]))
        # abaixo da planície, o entulho é inteiro (chão violeta + pedras): sem
        # isso o recorte abria cantos retos entre o chão do entulho e as pedras
        fundo_pl = np.full(W, hz)
        for x in range(W):
            ys_ = np.nonzero(plano[:, x])[0]
            if len(ys_):
                fundo_pl[x] = ys_.max() + 1
        obj |= (yy >= fundo_pl[None, :]) & (yy < ch)
        obj &= ~plano
        obj &= ~(marrom_ & (soma < 330) & (yy < hz))
    buracos = nd.binary_fill_holes(obj) & ~obj
    rot, n = nd.label(buracos)
    if n:
        tam = nd.sum(buracos, rot, range(1, n + 1))
        obj |= np.isin(rot, [i + 1 for i, t in enumerate(tam) if t <= 200])
    # cacos soltos no céu (pedaço de galho ou pilar sem tronco): saem
    rot, n = nd.label(obj, structure=np.ones((3, 3), bool))
    for i, sl in enumerate(nd.find_objects(rot), 1):
        comp = rot == i
        if sl[0].stop <= hz + 2 and comp.sum() < cfg.get("caco_max", 120):
            obj &= ~comp
    # objetos pequenos e distantes (árvores e pedras lá no campo, com o pé acima
    # de `longe_ate`) ficam no campo ao longe, não no meio
    para_longe = np.zeros((H, W), bool)
    if cfg.get("longe_ate"):
        rot, n = nd.label(obj, structure=np.ones((3, 3), bool))
        for i_, sl in enumerate(nd.find_objects(rot), 1):
            if sl[0].stop <= cfg["longe_ate"]:
                para_longe |= rot == i_
        # caixas de coisas distantes grudadas em algo do meio (a árvore lá no
        # morro da esquerda encostava nos girassóis pelo trigo)
        for bx in cfg.get("longe_caixas", []):
            cx_ = caixa(*bx) & obj
            para_longe |= cx_
        # coisas distantes que a placa tirou e o recorte não pegou (bandeirinha
        # da direita): o que difere da placa na caixa volta para o campo
        for bx in cfg.get("longe_bruto_caixas", []):
            para_longe |= caixa(*bx) & (dif > 20) & ~obj  # sem roubar a bandeira da frente
        obj &= ~para_longe
    # pináculos distantes (silhuetas no horizonte): só os pixels acima da linha
    # da planície do bruto, que diferem do céu da placa; vão com a planície
    pin_total = np.zeros((H, W), bool)
    for (bx0, by0, bx1, by1) in cfg.get("pinaculos", []):
        pin = caixa(bx0, by0, bx1, min(by1, hz + 1)) & (dif > 15) & ~obj
        ai_ = a.astype(int)
        pin &= (ai_.sum(2) < 260) & (ai_[..., 0] >= ai_[..., 2])   # marrom escuro, não brasa
        # só o que nasce no horizonte (as emendas das faixas do céu ficam de fora)
        rot_, n_ = nd.label(pin)
        pin = np.isin(rot_, np.unique(rot_[hz - 2:hz + 1][rot_[hz - 2:hz + 1] > 0]))
        para_longe |= pin
        pin_total |= pin
    # objetos de vidro que a placa quase repete (o pé dos espelhos, o cristal
    # translúcido): em cada coluna da caixa, do 1º pixel de objeto até o chão
    for (bx0, by0, bx1, by1) in cfg.get("cheios", []):
        for x in range(bx0, bx1):
            ys_ = np.nonzero(obj[by0:min(by1, ch), x])[0]
            if len(ys_):
                obj[by0 + ys_.min():min(by1, ch), x] = True
    # objetos da beira da estrada que passam a fazer parte do chão (a pedra)
    para_chao = np.zeros((H, W), bool)
    for bx in cfg.get("chao_caixas", []):
        para_chao |= caixa(*bx) & obj
    obj &= ~para_chao
    chao = chao | para_chao
    meio = obj

    # marco: o pico ao longe, da placa (limpa), escuro contra o céu claro
    marco = None
    if cfg.get("marco"):
        psoma = pl.astype(int).sum(2)
        cxm = caixa(*cfg["marco"]) & (yy < hz)
        om = cxm & (psoma < cfg.get("marco_soma", 260))
        om = nd.binary_fill_holes(nd.binary_closing(om, iterations=1)) & cxm
        rot, n = nd.label(om)
        if n > 1:
            tam = nd.sum(om, rot, range(1, n + 1))
            om = rot == (np.argmax(tam) + 1)
        ys, xs = np.nonzero(om)
        marco = (rgba(pl, om).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)),
                 int(xs.min()), int(ys.min()))

    # fundo: céu sem objetos, ilhas e marco, completado pela linha
    tira = meio | ilhas_m | (yy >= hz)
    # o céu da placa já está limpo (sem fumaça, árvores, pilares): só tira as ilhas
    # a caixa inteira de cada ilha sai do céu (os pingos de lava que escorrem
    # dela ficavam como sujeira escura)
    tira_ilhas = np.zeros((H, W), bool)
    for bx in cfg["ilhas"]:
        tira_ilhas |= caixa(*bx)
    # céu/parede de cima: da placa (limpa) ou do bruto, quando a placa mexeu
    # em algo que devia ficar (a lua da torre saiu manchada na placa)
    base = preencher_linhas(a if cfg.get("fundo_do_bruto") else pl, tira_ilhas & (yy < hz))
    # abaixo do horizonte o fundo nunca aparece (o campo cobre): em vez de
    # repetir a última linha (que tem os morros escuros e faz blocos),
    # cada linha vira a cor mais comum do céu logo acima
    if not cfg.get("longe_contorno"):
        cores, n = np.unique(base[hz - 14:hz - 8].reshape(-1, 3), axis=0, return_counts=True)
        base[hz:] = cores[n.argmax()]  # só abaixo do horizonte (acima ficavam faixas lisas)
    if marco is not None:
        # sem o pico no fundo (ele é o marco): céu da linha
        mm = np.zeros((H, W), bool)
        sp, mx, my = marco
        mm[my:my + sp.height, mx:mx + sp.width] = np.array(sp)[..., 3] > 0
        base = preencher_linhas(base, nd.binary_dilation(mm, iterations=1))
    # lua como peça separada (quando o fundo não desce, ela ficaria acima da
    # faixa): recortada do céu e posta mais baixo na tela
    lua_sp = None
    if cfg.get("lua_y_tela") is not None and not cfg.get("ceu_sintetico"):
        lx0, ly0, lx1, ly1 = cfg["lua"]
        cxl = caixa(lx0, ly0, lx1, ly1)
        ol = ilha_por_linha(a, lx0, ly0, lx1, ly1, folga=10, tol=40)
        ys, xs = np.nonzero(ol)
        lua_sp = (rgba(a, ol).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)), int(xs.min()))
        base = preencher_linhas(base, nd.binary_dilation(ol, iterations=1))
    fundo_ref = rgba(base, np.ones((H, W), bool))
    largo, pad = alargar_fundo(fundo_ref, 960, cfg["centro_x"])

    longe = (yy >= hz) & ~chao
    if cfg.get("longe_contorno"):
        # o campo ao longe começa na linha real dos morros, coluna a coluna:
        # a primeira linha com cor só de campo (as muralhas, a névoa e o sol
        # têm outras cores e ficam paradas no fundo)
        y_ini, y_fim = cfg["longe_contorno"]
        def paleta(r0, r1):
            u, n_ = np.unique(pl[r0:r1].reshape(-1, 3), axis=0, return_counts=True)
            return {tuple(int(v) for v in c): k for c, k in zip(u, n_)}
        cima, campo = paleta(y_ini - 30, y_ini), paleta(ch - 30, ch - 2)
        so_campo = np.array([c for c, k in campo.items() if k >= 40 and cima.get(c, 0) < 60])
        e_campo = (np.abs(pl.astype(int)[:, :, None, :] - so_campo[None, None]).sum(-1).min(-1) == 0)
        contorno = np.full(W, y_fim)
        for x in range(W):
            for y in range(y_ini, y_fim):
                if e_campo[y, x] and e_campo[y + 1, x] and e_campo[y + 2, x]:
                    contorno[x] = y
                    break
        # ponto fora da curva (um pixel solto) não pode abrir um dente
        from scipy.ndimage import median_filter
        bruto_c = median_filter(contorno, size=3, mode="nearest")
        # mediana larga: tapa os buracos da estrada (cor clara, que não é só de
        # campo) e corta as pontas do sol; morrinhos de até 4 px ficam
        largo_c = median_filter(bruto_c, size=15, mode="nearest")
        contorno = np.where((bruto_c < largo_c) & (largo_c - bruto_c <= 4), bruto_c, largo_c)
        longe = (yy >= contorno[None, :]) & ~chao
    cristais_chao = np.zeros((H, W), bool)
    for bx in cfg.get("chao_cristais", []):
        ai_ = a.astype(int)
        sc_ = ai_.sum(2)
        cb_ = caixa(*bx) & (yy < ch)
        m_ = cb_ & ((sc_ > 380) | (ai_[..., 1] > 150))
        m_ |= nd.binary_dilation(m_, iterations=1) & cb_ & (sc_ < 230)
        cristais_chao |= m_
    chao = chao | cristais_chao
    sobe = cfg.get("subir_chao", 0)
    # piso de vidro: os reflexos dos objetos andariam com o chão (1,0) e os
    # objetos com o meio (0,5); o piso vem da placa, sem reflexos
    chao_im = rgba(pl if cfg.get("chao_da_placa") else a, chao)
    if sobe:
        c = np.array(chao_im)
        c = np.concatenate([c[sobe:], np.repeat(c[-1:], sobe, 0)])
        chao_im = Image.fromarray(c)
    nuvens = np.zeros((H, W), bool)
    if cfg.get("ceu") and (BRUTOS / cfg["ceu"]).exists():
        # placa só do céu (sem nuvens, ilhas, nem chão): vira o fundo inteiro;
        # as nuvens soltas = o que difere dela acima do horizonte (rolam com vento)
        ce = nativo(dict(cfg, arquivo=cfg["ceu"]), paleta_de(a))
        dif_c = np.abs(a.astype(int) - ce.astype(int)).sum(2)
        lx0, ly0, lx1, ly1 = cfg["lua"]
        lim_n = cfg.get("nuvens_ate", hz)   # só as nuvens do céu (não a beira do mar de nuvens)
        nv = (dif_c > cfg.get("dif_nuvem", 60)) & (yy < lim_n) & ~nd.binary_dilation(ilhas_m, iterations=2)
        nv &= ~caixa(lx0 - 3, ly0 - 3, lx1 + 3, ly1 + 3)
        nv = nd.binary_closing(nv, iterations=1) & (yy < lim_n)
        nv = nd.binary_fill_holes(nv)
        rot, n = nd.label(nv)
        if n:
            tam = nd.sum(nv, rot, range(1, n + 1))
            nv = np.isin(rot, [i_ + 1 for i_, t_ in enumerate(tam) if t_ >= 40])  # sem fiapos soltos
        nv |= nd.binary_dilation(nv, iterations=1) & (dif_c > 25) & (yy < lim_n + 1)
        nuvens = nv
        fundo_ref = rgba(ce, np.ones((H, W), bool))
        largo, pad = alargar_fundo(fundo_ref, 960, cfg["centro_x"])
    if cfg.get("nuvens_desce") is not None:
        # nuvens rosadas do alto: camada própria, mais baixa (o fundo não desce)
        ai_ = a.astype(int)
        r_, g_, b_ = ai_[..., 0], ai_[..., 1], ai_[..., 2]
        nv = (yy < cfg["nuvens_ate"]) & (r_ > 220) & (b_ > g_ - 30) & (b_ > 150)
        if cfg.get("nuvens_por_ceu"):
            # nuvem = tudo que não é a cor do céu da linha (pega a sombra azul
            # da nuvem, que o limiar de claro deixava no fundo)
            nv = np.zeros((H, W), bool)
            for y in range(cfg["nuvens_ate"]):
                u_, n_ = np.unique(ai_[y], axis=0, return_counts=True)
                ceu_y = u_[n_.argmax()]
                nv[y] = np.abs(ai_[y] - ceu_y).sum(1) > 10
            for bx in cfg.get("nuvens_fora", []):
                nv &= ~caixa(*bx)
        # cor que ocupa boa parte da linha é faixa do céu, não nuvem
        for y in (range(cfg["nuvens_ate"]) if not cfg.get("nuvens_por_ceu") else []):
            u_, n_ = np.unique(ai_[y], axis=0, return_counts=True)
            for c_, k_ in zip(u_, n_):
                if k_ > W * 0.25:
                    nv[y] &= ~(np.abs(ai_[y] - c_).sum(1) == 0)
        lx0, ly0, lx1, ly1 = cfg["lua"]
        nv &= ~caixa(lx0 - 3, ly0 - 3, lx1 + 3, ly1 + 3)
        if cfg.get("nuvens_por_ceu"):
            # só os pixels do cristal saem (a caixa inteira cortava a nuvem do lado)
            nv &= ~nd.binary_dilation(ilhas_m, iterations=2)
        else:
            for bx in cfg["ilhas"]:
                nv &= ~caixa(*bx)
        nv = nd.binary_closing(nv, iterations=1) & (yy < cfg["nuvens_ate"])
        if cfg.get("nuvens_por_ceu"):
            nv = nd.binary_fill_holes(nv)
        rot, n = nd.label(nv)
        if n:
            tam = nd.sum(nv, rot, range(1, n + 1))
            nv = np.isin(rot, [i_ + 1 for i_, t_ in enumerate(tam) if t_ >= 15])
        if cfg.get("nuvens_min_alt"):
            rot, n = nd.label(nv)
            for i_, sl in enumerate(nd.find_objects(rot), 1):
                if (sl[0].stop - sl[0].start < cfg["nuvens_min_alt"]
                        or (rot[sl] == i_).sum() < cfg.get("nuvens_min_px", 0)):
                    nv &= rot != i_
        # o fechamento morfológico come a 1ª e a última coluna: a nuvem cortada
        # na borda ganhava um risco de céu na emenda
        nv[:, 0] |= nv[:, 1]
        nv[:, W - 1] |= nv[:, W - 2]
        nuvens = nv
        # o céu atrás delas: a cor da linha
        fundo_sem = preencher_linhas(np.array(fundo_ref)[..., :3], nd.binary_dilation(nv, iterations=1))
        fundo_ref = rgba(fundo_sem, np.ones((H, W), bool))
        largo, pad = alargar_fundo(fundo_ref, 960, cfg["centro_x"])
    eclipse = None
    if cfg.get("ceu_sintetico"):
        fundo_arr, eclipse = ceu_sintetico(a, pl, cfg, nuvens | ilhas_m)
        fundo_ref = rgba(fundo_arr, np.ones((H, W), bool))
        largo, pad = alargar_fundo(fundo_ref, 960, cfg["centro_x"])
        lua_sp = (eclipse["sprite"], eclipse["x"])
    pl_longe = remendar_fino(pl, nd.binary_dilation(grade, iterations=1) & (yy >= hz)) if grade.any() else pl
    if cristais_chao.any():
        # os cristais saem do mar de nuvens (foram para o chão)
        pl_longe = remendar_fino(pl_longe, nd.binary_dilation(cristais_chao, iterations=1))
    if para_longe.any():
        pl_longe = pl_longe.copy()
        pl_longe[para_longe] = a[para_longe]
        # pináculos apoiados na planície: cada coluna desce, na cor do pé do
        # pináculo, até a primeira linha da planície da placa (flutuavam uns px)
        for x in np.nonzero(pin_total.any(0))[0]:
            yb = int(np.nonzero(pin_total[:, x])[0].max())
            y = yb + 1
            while y < ch and not longe[y, x]:
                pl_longe[y, x] = a[yb, x]
                para_longe[y, x] = True
                y += 1
        longe |= para_longe
    camadas = {"nuvens": rgba(a, nuvens),
               "longe": rgba(pl_longe, longe | ((yy >= ch - 2) & (yy < ch + 10)) if cfg.get("longe_contorno")
                             else longe | ((yy >= hz) & (yy < ch + 10))),
               "meio": rgba(a, meio), "chao": chao_im}
    if cfg.get("subir_longe"):
        # planície ao longe mais alta (pináculos juntos); embaixo repete a última linha
        s_ = cfg["subir_longe"]
        c_ = np.array(camadas["longe"])
        camadas["longe"] = Image.fromarray(np.concatenate([c_[s_:], np.repeat(c_[-1:], s_, 0)]))
    if cfg.get("descer_cena"):
        # piso mais baixo: o campo ao longe, os objetos e o chão descem juntos
        # (os objetos continuam apoiados no piso); céu, lua e ilhas ficam
        d_ = cfg["descer_cena"]
        for k_ in ("longe", "meio", "chao"):
            c_ = np.array(camadas[k_])
            camadas[k_] = Image.fromarray(np.concatenate([np.zeros_like(c_[:d_]), c_[:-d_]]))
    saida.mkdir(parents=True, exist_ok=True)
    fundo_ref.save(saida / "fundo_referencia.png")
    if (saida / "fundo_editado.png").exists():
        Image.open(saida / "fundo_editado.png").save(saida / "fundo.png")
    else:
        largo.save(saida / "fundo.png")
    if cfg.get("subir_cidade"):
        subir_cidade(saida / "fundo.png", cfg["subir_cidade"])
    if cfg.get("nuvens_do_ref"):
        camadas["nuvens"] = nuvens_do_ref(fundo_ref, cfg["nuvens_do_ref"])
    for k, im in camadas.items():
        editada = saida / f"{k}_editado.png"
        if editada.exists():
            Image.open(editada).save(saida / f"{k}.png")
            continue
        if k == "nuvens" and cfg.get("nuvens_do_ref"):
            im.save(saida / f"{k}.png")  # já vem repetida (958 px)
            continue
        if k == "nuvens" and cfg.get("nuvens_desce") is not None:
            # nuvens: original repetido (sem espelho). No espelho, a nuvem
            # cortada na borda virava duas metades com um risco no meio; assim
            # a da direita encosta na da esquerda e forma uma nuvem só
            dupla = Image.new("RGBA", (im.width * 2, im.height))
            dupla.paste(im, (0, 0))
            dupla.paste(im, (im.width, 0))
            dupla.save(saida / f"{k}.png")
            continue
        espelhar_emendavel(im).save(saida / f"{k}.png")
    info_ilhas = []
    for i, (sp, x, y) in enumerate(ilhas, 1):
        ed = saida / f"ilha_{i}_editado.png"
        (Image.open(ed) if ed.exists() else sp).save(saida / f"ilha_{i}.png")
        y = cfg["ilhas_y"][i - 1] if "ilhas_y" in cfg else y
        info_ilhas.append({"arquivo": f"ilha_{i}.png", "x": x + pad, "y": y})
        eg = cfg.get("engrenagem")
        if eg and eg["ilha"] == i:
            info_ilhas[-1]["engrenagem"] = separar_engrenagem(Image.open(saida / f"ilha_{i}.png"), eg, saida, i)
    lx0, ly0, lx1, ly1 = cfg["lua"]
    meta = {
        "tamanho_nativo": [W, H],
        "pes_dos_personagens_y": PES,
        "horizonte_y": hz,
        "lua_ceu": {"x": lx0 + pad, "y": ly0, "w": lx1 - lx0, "h": ly1 - ly0},
        "camadas": [
            {"arquivo": "fundo.png", "velocidade": VELOCIDADE["fundo"], "rola": False},
            {"arquivo": "nuvens.png", "velocidade": VELOCIDADE["nuvens"], "rola": True,
             "vento_px_por_s": 2, "vazia": not (nuvens.any() or cfg.get("nuvens_do_ref")),
             "desce": cfg.get("nuvens_desce", cfg.get("desce", DESCE))},
            {"ilhas": info_ilhas, "velocidade": VELOCIDADE["ilhas"], "balanco_px": 2},
            {"arquivo": "longe.png", "velocidade": VEL_LONGE, "rola": True,
             "obs": "campo ao longe (da placa), entre o marco e o meio"},
            {"arquivo": "meio.png", "velocidade": VELOCIDADE["meio"], "rola": True},
            {"arquivo": "chao.png", "velocidade": VELOCIDADE["chao"], "rola": True},
        ],
        "velocidade_1": "px por px que a Lua anda",
        "modos": {"compacto": {"janela_y": list(JANELA), "camadas_de_tras_descem": cfg.get("desce", DESCE)}},
    }
    if lua_sp is not None:
        lua_sp[0].save(saida / "lua.png")
        meta["lua_sprite"] = {"arquivo": "lua.png", "x": lua_sp[1] + pad, "y_tela": cfg["lua_y_tela"],
                              "obs": "lua parada na tela (o fundo não desce neste bioma)"}
        if eclipse is not None:
            ex_, ey_ = eclipse["centro"]
            meta["lua_sprite"]["eclipse"] = {"centro": [round(ex_ - eclipse["x"], 1), round(ey_ - eclipse["y"], 1)],
                                             "raio_anel": round(eclipse["raio_anel"], 1),
                                             "obs": "centro relativo ao sprite; a coroa pulsa em volta do anel"}
    if marco is not None:
        sp, x, y = marco
        ed = saida / "marco_editado.png"
        (Image.open(ed) if ed.exists() else sp).save(saida / "marco.png")
        meta["marco"] = {"arquivo": "marco.png", "x": x + pad,
                         "y_tela": cfg.get("marco_base_tela", hz) - sp.height,
                         "obs": "parado, de pé no horizonte (na tela)"}
    (saida / "cenario.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    return meta


# ------------------------------------------------------------------ prévia

def _quadro(tira, i):
    n = tira.height
    return tira.crop((i * n, 0, i * n + n, n))


def _rolar(tela, camada, desloc, y0, y1, largura, dy=0):
    w = camada.width
    x = -(int(round(desloc)) % w)
    faixa = camada.crop((0, y0, w, y1))
    while x < largura:
        tela.alpha_composite(faixa, (x, dy))
        x += w


def previa(nome, cfg, pasta, destino, largura=560, quadros=64, andar_px=5, escala=2, ms=110):
    """Faixa compacta: a Lua anda (mesma velocidade do mod: 5 px a cada
    110 ms) e o cenário rola. Se o bioma deixar, a lua do céu mingua."""
    A = RAIZ / "assets"
    meta = json.loads((pasta / "cenario.json").read_text())
    cam = {c.get("arquivo", "ilhas"): c for c in meta["camadas"]}
    img = {k: Image.open(pasta / k).convert("RGBA") for k in ("fundo.png", "nuvens.png", "longe.png", "meio.png", "chao.png")
           if (pasta / k).exists()}
    ilhas = [(Image.open(pasta / i["arquivo"]).convert("RGBA"), i["x"], i["y"]) for i in cam["ilhas"]["ilhas"]]
    # engrenagem girando (Eclipse): peças separadas da ilha
    eng_k, eng = None, None
    for k_, i_ in enumerate(cam["ilhas"]["ilhas"]):
        if i_.get("engrenagem"):
            e_ = i_["engrenagem"]
            eng_k = k_
            eng = {"roda": Image.open(pasta / e_["engrenagem"]).convert("RGBA"),
                   "espelho": np.array(Image.open(pasta / e_["espelho"]).convert("RGBA")),
                   "cacos": np.array(Image.open(pasta / e_["cacos"]).convert("RGBA")),
                   "centro": e_["centro"], "pecas": e_["pecas"]}
    estrela = Image.open(A / "particulas" / "estrela_4f.png").convert("RGBA")
    # estrela azul: o mesmo brilho, puxado para azul-claro
    ea = np.array(estrela).astype(int)
    lum = ea[..., :3].mean(2)
    ea[..., 0] = np.clip(lum * 0.55, 0, 255)
    ea[..., 1] = np.clip(lum * 0.8, 0, 255)
    ea[..., 2] = np.clip(lum * 1.15 + 20, 0, 255)
    estrela_azul = Image.fromarray(ea.astype(np.uint8))
    if cfg.get("estrela_cor") == "vermelha":
        ea = np.array(estrela).astype(int)
        lum = ea[..., :3].mean(2)
        ea[..., 0] = np.clip(lum * 1.1 + 30, 0, 255)
        ea[..., 1] = np.clip(lum * 0.45, 0, 255)
        ea[..., 2] = np.clip(lum * 0.35, 0, 255)
        estrela_azul = Image.fromarray(ea.astype(np.uint8))
    # Lua andando: 8 quadros 80x100, pés na linha 96, +1 px nos quadros 2 e 6
    andar = Image.open(A / "lua" / "poses" / "lua_andar_8f.png").convert("RGBA")
    passos = [andar.crop((i * 80, 0, i * 80 + 80, 100)) for i in range(8)]
    pad = (img["fundo.png"].width - W + 1) // 2
    x0 = img["fundo.png"].width // 2 - largura // 2
    fy0, fy1 = JANELA
    alt = fy1 - fy0
    pes = PES - fy0
    rnd = random.Random(3)
    # estrelas só no céu limpo: fora da lua, do halo e das nuvens (o pedaço
    # de 9x9 do fundo, como aparece na faixa, tem de ser céu escuro e liso);
    # uma em cada três é azul
    DESCE = meta["modos"]["compacto"]["camadas_de_tras_descem"]
    fvis = np.array(Image.open(pasta / "fundo.png").convert("RGB"))[fy0 - DESCE:fy1 - DESCE, x0:x0 + largura].astype(int)
    fs = fvis.sum(2)
    # cor do céu: logo acima da lua, no centro (as nuvens são mais claras)
    ceu_escuro = np.percentile(fs[:12], 10)
    lc0 = meta["lua_ceu"]
    estrelas = []
    tent = 0
    while len(estrelas) < cfg.get("estrelas", 12) and tent < 4000:
        tent += 1
        sx, sy = rnd.randrange(4, largura - 11), rnd.randrange(1, cfg.get("estrelas_ate", 52))
        bloco = fs[sy:sy + 9, sx:sx + 9]
        perto_lua = (lc0["x"] - 22 - x0 <= sx <= lc0["x"] + lc0["w"] + 22 - x0)
        if perto_lua or (np.abs(bloco - ceu_escuro).max() > 10 if not cfg.get("estrelas_ceu_todo")
                         else bloco.max() - bloco.min() > 16):
            continue
        if any(abs(sx - ex) < 22 and abs(sy - ey) < 14 for ex, ey, _, _ in estrelas):
            continue
        estrelas.append((sx, sy, rnd.randrange(4), len(estrelas) % 3 == 2))
    # lua do céu: os pixels claros da caixa; a parte "apagada" vira a cor do
    # céu logo fora do disco (o halo), da direita para a esquerda
    fundo = img["fundo.png"]
    fa = np.array(fundo)
    lc = meta["lua_ceu"]
    lx, ly, lw, lh = lc["x"], lc["y"], lc["w"], lc["h"]
    reg = fa[ly:ly + lh, lx:lx + lw, :3].astype(int)
    disco = reg.sum(2) > 420
    disco = nd.binary_fill_holes(nd.binary_closing(disco, iterations=2))
    ys, xs = np.nonzero(disco)
    cobre = np.zeros((lh, lw, 4), np.uint8)
    for y in np.unique(ys):
        linha = np.nonzero(disco[y])[0]
        # cor do céu fora do halo, na mesma linha: a parte apagada fica escura
        fora = fa[ly + y, lx + linha.min() - 18, :3]
        cobre[y, linha, :3] = fora
        cobre[y, linha, 3] = 255
    cobre = Image.fromarray(cobre)
    xs_min, xs_max = (xs.min(), xs.max() + 1) if len(xs) else (0, 0)
    lua_spr = Image.open(pasta / meta["lua_sprite"]["arquivo"]).convert("RGBA") if meta.get("lua_sprite") else None
    mc = meta.get("marco")
    marco_sp = Image.open(pasta / mc["arquivo"]).convert("RGBA") if mc else None
    # lâmpada do farol: os pixels acesos do sprite
    lampada = None
    if marco_sp is not None:
        ma = np.array(marco_sp).astype(int)
        acesos = np.argwhere((ma[..., :3].sum(2) > 500) & (ma[..., 3] > 0))
        if len(acesos):
            lampada = (float(acesos[:, 1].mean()), float(acesos[:, 0].mean()))

    def facho(t, lx_, ly_, ciclo=18):
        """Luz rotativa: um facho deitado que cresce para um lado, encolhe,
        some atrás da torre e cresce para o outro; a lâmpada pisca forte
        quando o facho aponta para a frente (no meio do giro)."""
        cam = Image.new("RGBA", (largura, alt))
        d = ImageDraw.Draw(cam)
        f = (t % ciclo) / ciclo                      # 0..1, uma volta
        ang = f * 2 * math.pi
        lado = math.cos(ang)                         # +1 direita, -1 esquerda
        frente = math.sin(ang)                       # >0: apontando para nós
        comp = 46 * abs(lado)
        if frente > -0.2 and comp > 3:
            ab = 3 + 5 * abs(lado)                   # abre no fim
            xf = lx_ + lado * comp
            c1, c2 = cfg.get("facho_cor", ((255, 246, 200), (255, 252, 225)))
            cor = (*c1, int(70 + 50 * max(frente, 0)))
            d.polygon([(lx_, ly_ - 1), (xf, ly_ - ab), (xf, ly_ + ab), (lx_, ly_ + 1)], fill=cor)
            cor2 = (*c2, int(110 + 60 * max(frente, 0)))
            d.polygon([(lx_, ly_), (lx_ + lado * comp * 0.5, ly_ - ab * 0.35),
                       (lx_ + lado * comp * 0.5, ly_ + ab * 0.35)], fill=cor2)
            # a ponta some aos poucos (degraus, como pixel art): o alfa cai
            # de acordo com a distância à lâmpada
            arr = np.array(cam)
            xs_ = np.arange(largura)[None, :].astype(float)
            dist = np.abs(xs_ - lx_) / max(comp, 1)
            fade = np.clip(1.15 - dist, 0, 1)
            fade = np.floor(fade * 5) / 5
            arr[..., 3] = (arr[..., 3] * fade).astype(np.uint8)
            cam = Image.fromarray(arr)
            d = ImageDraw.Draw(cam)
        # brilho da lâmpada
        r = 1 + (2 if frente > 0.7 else 1 if frente > 0 else 0)
        d.ellipse([lx_ - r, ly_ - r, lx_ + r, ly_ + r], fill=(*cfg.get("lampada_cor", (255, 250, 215)), 230))
        return cam

    # ---- efeitos do vulcão (prévia; no mod viram animação de detalhe) ----
    cratera = None
    if cfg.get("vulcao_fx") and marco_sp is not None:
        mal = np.array(marco_sp)[..., 3]
        topo = int(np.nonzero(mal.any(1))[0][0])
        xs_t = np.nonzero(mal[topo + 1])[0]
        cratera = (mc["x"] - x0 + int(xs_t.mean()), mc["y_tela"] - fy0 + topo)

    def brilho_cratera(t, cx_, cy_):
        """Aura laranja sobre a cratera, pulsando de forma irregular (soma de
        senos fora de fase): anéis em degraus, como pixel art."""
        cam = Image.new("RGBA", (largura, alt))
        d = ImageDraw.Draw(cam)
        f = 0.55 + 0.25 * math.sin(t * 0.9) + 0.15 * math.sin(t * 2.3 + 1) + 0.1 * math.sin(t * 5.1 + 2)
        for k, (rx, ry, a_) in enumerate(((26, 13, 40), (18, 9, 60), (11, 6, 90), (5, 3, 140))):
            r = 0.75 + 0.35 * f
            d.ellipse([cx_ - rx * r, cy_ - ry * r, cx_ + rx * r, cy_ + ry * r],
                      fill=(255, 120 + 30 * k, 40 + 20 * k, int(a_ * (0.6 + 0.6 * f))))
        return cam

    # cor do ar: o céu (fundo, como aparece na faixa) na altura de cada fumaça
    fa_vis = np.array(fundo.convert("RGB"))[fy0 - DESCE:fy1 - DESCE, x0:x0 + largura].astype(int)
    def cor_do_ar(y_tela):
        y_ = int(min(max(y_tela, 0), fa_vis.shape[0] - 1))
        cores_, n_ = np.unique(fa_vis[y_], axis=0, return_counts=True)
        return tuple(int(v) for v in cores_[n_.argmax()])
    cor_ar_cr = cor_do_ar((cratera[1] - 25) if cratera else 40)
    cor_ar_ch = cor_do_ar(80)
    # brilho da lava (chão e campo ao longe): máscara dos pixels de lava da camada
    def mascara_lava(im):
        a_ = np.array(im).astype(int)
        return (a_[..., 3] > 0) & (a_[..., 0] > 190) & (a_[..., 1] > 70) & (a_[..., 2] < 120)
    lava_masc = ({k: mascara_lava(img[k]) for k in ("chao.png", "longe.png", "meio.png") if k in img}
                 if cfg.get("lava_brilho") else {})

    def brilho_lava(k, t):
        """Pulsar lento + onda de calor que corre pelas rachaduras: os pixels de
        lava clareiam em sequência (não piscam todos juntos)."""
        m_ = lava_masc[k]
        hh, ww = m_.shape
        xs_ = np.arange(ww)[None, :]
        ys_ = np.arange(hh)[:, None]
        pulso = 0.5 + 0.5 * math.sin(t * 0.22)
        onda = np.sin(xs_ * 0.07 + ys_ * 0.15 - t * 0.45)
        forca = np.clip((onda - 0.55) / 0.45, 0, 1) * 0.8 + 0.25 * pulso
        out = np.zeros((hh, ww, 4), np.uint8)
        out[..., 0] = 255
        out[..., 1] = 225
        out[..., 2] = 130
        out[..., 3] = (m_ * forca * 150).astype(np.uint8)
        return Image.fromarray(out)

    # ---- sol da aurora: halo pulsando e raios com uma onda de luz para fora ----
    sol = cfg.get("sol_brilho")
    if sol:
        sx_c, sy_c, sr = sol
        fa_ = np.array(fundo.convert("RGB")).astype(int)
        hh_, ww_ = fa_.shape[:2]
        yy_s, xx_s = np.mgrid[0:hh_, 0:ww_]
        dist_s = np.hypot(xx_s - (sx_c + pad), yy_s - sy_c)
        moda_l = np.array([np.unique(fa_[y].reshape(-1, 3), axis=0, return_counts=True) for y in range(hh_)], dtype=object)
        raio_m = np.zeros((hh_, ww_), bool)
        for y in range(hh_):
            u_, n_ = moda_l[y]
            mc_ = u_[n_.argmax()]
            raio_m[y] = (np.abs(fa_[y] - mc_).sum(1) > 0) & (fa_[y][:, 2] < 150) & (fa_[y][:, 0] > 240)
        # só os raios do céu (as torres claras das muralhas ficam de fora)
        raio_m &= (dist_s > sr + 2) & (dist_s < sr + 100) & (yy_s < cfg.get("raios_ate", sy_c - 25))

    def brilho_sol(t):
        cam = Image.new("RGBA", (largura, alt))
        d = ImageDraw.Draw(cam)
        cx_, cy_ = sx_c + pad - x0, sy_c - fy0 + DESCE
        f = 0.5 + 0.3 * math.sin(t * 0.25) + 0.2 * math.sin(t * 0.61 + 1)
        for k, (dr, a_) in enumerate(((22, 28), (14, 40), (7, 60))):
            r = sr + dr * (0.8 + 0.4 * f)
            d.ellipse([cx_ - r, cy_ - r, cx_ + r, cy_ + r], fill=(255, 240, 170, int(a_ * (0.5 + 0.7 * f))))
        # raios: a luz corre do sol para fora
        onda = 0.5 + 0.5 * np.sin(dist_s * 0.12 - t * 0.5)
        al = (raio_m * np.clip(onda - 0.3, 0, 1) * 200).astype(np.uint8)
        lay = np.zeros((hh_, ww_, 4), np.uint8)
        lay[..., 0], lay[..., 1], lay[..., 2], lay[..., 3] = 255, 252, 215, al
        recorte = Image.fromarray(lay).crop((x0, fy0 - DESCE, x0 + largura, fy1 - DESCE))
        cam.alpha_composite(recorte)
        return cam

    # ---- bandeiras balançando: o pano ondula, preso ao mastro ----
    bandeiras = cfg.get("bandeiras", [])
    meio_base = np.array(img["meio.png"]) if bandeiras else None

    vb = cfg.get("vidro_brilho")
    if vb:
        d_c = cfg.get("descer_cena", 0)
        meio_a0 = np.array(img["meio.png"])
        caixas_v = []
        for (bx0, by0, bx1, by1) in vb["caixas"]:
            by0, by1 = by0 + d_c, by1 + d_c
            caixas_v.append((bx0, by0, bx1, by1, False))
            caixas_v.append((957 - bx1, by0, 957 - bx0, by1, True))   # a metade espelhada
        rnd_v = random.Random(11)
        fases_v = [rnd_v.uniform(0, 48) for _ in caixas_v]
        eb = np.array(estrela).astype(int)
        lum_b = eb[..., :3].max(2)
        eb[..., 0] = np.clip(lum_b * 0.9 + 25, 0, 255)
        eb[..., 1] = np.clip(lum_b * 0.95 + 20, 0, 255)
        eb[..., 2] = 255
        estrela_branca = Image.fromarray(eb.astype(np.uint8))
        rnd_f = random.Random(12)
        faiscas = [(rnd_f.randrange(0, 958), rnd_f.randrange(*vb["chao_y"]), rnd_f.randrange(0, 30))
                   for _ in range(vb.get("faiscas_chao", 0))]

    def pontos_claros(arr, bx0, by0, bx1, by1, n, rnd_):
        """n pixels claros do cristal dentro da caixa (onde a estrelinha acende)."""
        bl = arr[by0:by1, bx0:bx1]
        ys_, xs_ = np.nonzero((bl[..., 3] > 0) & (bl[..., :3].astype(int).sum(2) > 600))
        if not len(ys_):
            return []
        return [(int(xs_[j] + bx0), int(ys_[j] + by0)) for j in rnd_.sample(range(len(ys_)), min(n, len(ys_)))]

    if vb:
        rnd_e = random.Random(13)
        estrelinhas = []
        for (bx0, by0, bx1, by1) in vb.get("estrelinhas", []):
            by0, by1 = by0 + d_c, by1 + d_c
            for (ex, ey) in pontos_claros(meio_a0, bx0, by0, bx1, by1, 2, rnd_e):
                estrelinhas.append((ex, ey, rnd_e.randrange(0, 36)))
                estrelinhas.append((957 - ex, ey, rnd_e.randrange(0, 36)))   # metade espelhada
        estrelinhas_ilhas = [[(ex, ey, rnd_e.randrange(0, 36)) for (ex, ey) in
                              pontos_claros(np.array(sp), 0, 0, sp.width, sp.height, 2, rnd_e)]
                             for (sp, _, _) in ilhas]

    def brilho_4_pontas(braco):
        """Brilho de cristal em pixel art: cruz de 4 pontas (braço de n px),
        miolo branco, braços azul-claro e contorno azul para aparecer no vidro."""
        n_ = 2 * braco + 3
        c_ = n_ // 2
        m_ = np.zeros((n_, n_), np.uint8)   # 0 nada, 1 contorno, 2 braço, 3 miolo
        for d_ in range(-braco, braco + 1):
            m_[c_, c_ + d_] = m_[c_ + d_, c_] = 2
        m_[c_, c_] = 3
        if braco >= 2:
            for (dy_, dx_) in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                m_[c_ + dy_, c_ + dx_] = 3
        cont = nd.binary_dilation(m_ > 0) & (m_ == 0)
        m_[cont] = 1
        cores_ = {1: (96, 150, 220, 255), 2: (200, 235, 255, 255), 3: (255, 255, 255, 255)}
        a_ = np.zeros((n_, n_, 4), np.uint8)
        for v_, cor_ in cores_.items():
            a_[m_ == v_] = cor_
        return Image.fromarray(a_)

    quadros_brilho = [brilho_4_pontas(b_) for b_ in (0, 1, 3, 1)]

    def estrelar(cam_, pontos, t):
        for (ex, ey, fs_) in pontos:
            k = (t + fs_) % 36
            if k < 4:
                q = quadros_brilho[k]
                cam_.alpha_composite(q, (ex - q.width // 2, ey - q.height // 2))

    cf = cfg.get("ceu_fx")
    if cf:
        sobe_c = cfg.get("subir_chao", 0)
        rnd_c = random.Random(21)

        def cristais_de(arr):
            """Pixels de cristal (ciano/branco claros) e um ponto de brilho por
            cristal (componente), com fase sorteada."""
            ai_ = arr.astype(int)
            m_ = (ai_[..., 3] > 0) & (ai_[..., 1] > 165) & (ai_[..., 2] > 165) & (ai_[..., 0] < ai_[..., 1] + 10)
            rot_, n_ = nd.label(nd.binary_dilation(m_, iterations=1))
            pontos_, comp_ = [], []
            for i_, sl in enumerate(nd.find_objects(rot_), 1):
                cm = (rot_ == i_) & m_
                if cm.sum() < 3:
                    continue
                ys_, xs_ = np.nonzero(cm)
                j = int(np.argmin(ys_))           # perto da ponta de cima
                pontos_.append((int(xs_[j]), int(ys_[j]), rnd_c.randrange(0, 40)))
                comp_.append((cm, rnd_c.uniform(0, 2 * math.pi)))
            return pontos_, comp_
        meio_c0 = np.array(img["meio.png"])
        chao_c0 = np.array(img["chao.png"])
        pts_meio, comp_meio = cristais_de(meio_c0)
        pts_chao, comp_chao = cristais_de(chao_c0)
        # pontes de energia: caixas no chão (subiu), também na metade espelhada
        pontes = []
        for ((bx0, by0, bx1, by1), cor_p) in cf.get("pontes", []):
            by0, by1 = by0 - sobe_c, by1 - sobe_c
            for (xa, xb) in ((bx0, bx1), (957 - bx1, 957 - bx0)):
                bl = chao_c0[by0:by1, xa:xb].astype(int)
                mp = (bl[..., 3] > 0) & (bl[..., :3].sum(2) > 330)
                pontes.append((xa, by0, xb, by1, mp, cor_p, rnd_c.uniform(0, 40)))
        # cada estrela cadente com ciclo, tamanho e cor próprios (cores das pontes)
        cores_cad = [c_ for (_, c_) in cf.get("pontes", [])] or [(170, 235, 255)]
        cadentes = [(rnd_c.randrange(0, 90), rnd_c.randrange(38, 95), rnd_c.choice((10, 14, 20, 26)),
                     cores_cad[j % len(cores_cad)]) for j in range(cf.get("cadentes", 0))]
        # raios das pontes: cada um numa linha da ponte, com cor, tamanho e
        # velocidade sorteados (vão e voltam? não: correm sempre no mesmo sentido)
        paletas_p = {}
        raios_p = []
        for ip, (xa, ya, xb, yb, mp, cor_p, fase) in enumerate(pontes):
            linhas_ = [y_ for y_ in range(mp.shape[0]) if mp[y_].sum() > (xb - xa) * 0.5]
            base_ = np.array(cor_p, float)
            tons_ = [tuple(int(v) for v in np.clip(base_ * f_ + a_, 0, 255))
                     for (f_, a_) in ((1.0, 40), (0.85, 70), (1.0, 90), (0.7, 20))]
            tons_.append((255, 255, 255))
            for _ in range(cf.get("raios_ponte", 0)):
                if linhas_:
                    raios_p.append((ip, rnd_c.choice(linhas_), rnd_c.uniform(4, 8), rnd_c.randrange(6, 16),
                                    rnd_c.choice(tons_), rnd_c.uniform(0, 200), rnd_c.choice((-1, 1)) if False else 1))
        brilho_c = [brilho_4_pontas(b_) for b_ in (0, 1, 3, 1)]

    # ---- eclipse: coroa respirando, rachaduras violeta, brasas e cinzas subindo ----
    ef = cfg.get("eclipse_fx")
    if ef:
        ls_ = meta["lua_sprite"]
        ec_ = ls_["eclipse"]
        ecx = ls_["x"] + ec_["centro"][0] - x0
        ecy = ls_["y_tela"] + ec_["centro"][1] - fy0
        er = ec_["raio_anel"]
        rnd_e2 = random.Random(31)
        # proeminências: labaredinhas de luz que dão a volta no anel devagar
        # (duas, em lados opostos, uma mais lenta que a outra)
        proeminencias = [(0.0, 96, 1), (math.pi, 140, -1)]

        def mascara_racha(im):
            a_ = np.array(im).astype(int)
            r_, g_, b_ = a_[..., 0], a_[..., 1], a_[..., 2]
            return (a_[..., 3] > 0) & (b_ > 150) & (r_ > 110) & (b_ > g_ + 50)
        racha_masc = {k: mascara_racha(img[k]) for k in ("chao.png", "longe.png", "meio.png") if k in img}
        # brasas nascem nas rachaduras e nas fagulhas do entulho (meio), nas duas metades
        meio_e = np.array(img["meio.png"]).astype(int)
        fonte_m = racha_masc["meio.png"] | ((meio_e[..., 3] > 0) & (meio_e[..., 0] > 180) & (meio_e[..., 2] < 140))
        fys, fxs = np.nonzero(fonte_m)
        brasas = []
        for j in range(ef.get("brasas", 0)):
            i_ = rnd_e2.randrange(len(fxs))
            cinza = j % 3 == 2                    # 1 em 3 é cinza escura (sobe devagar)
            cor_ = ((70, 48, 84) if cinza else
                    rnd_e2.choice([(255, 176, 90), (255, 120, 60), (226, 150, 255), (255, 214, 140)]))
            brasas.append((int(fxs[i_]), int(fys[i_]), rnd_e2.uniform(0, 60), rnd_e2.uniform(30, 52),
                           0.35 if cinza else rnd_e2.uniform(0.6, 1.0), cor_, cinza, rnd_e2.uniform(0, 6.3)))

    def coroa(t):
        """Coroa do eclipse respirando (~4,4 s): anéis em degraus da luz em
        volta do anel (o disco escuro fica como está) e duas proeminências
        (labaredinhas creme de 2-3 px) correndo em volta do anel."""
        cam_ = Image.new("RGBA", (largura, alt))
        d_ = ImageDraw.Draw(cam_)
        f = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 40)
        cor_ = ef["coroa"]
        for (dr, a_) in ((15, 14), (10, 24), (6, 40), (3, 60)):
            rr = er + dr + round(2 * f)
            d_.ellipse([ecx - rr, ecy - rr, ecx + rr, ecy + rr], fill=(*cor_, int(a_ * (0.3 + 0.7 * f))))
        for (ang0, periodo, sentido) in proeminencias:
            ang = ang0 + sentido * t * 2 * math.pi / periodo
            # base larga colada no anel, ponta fina para fora (degraus)
            for (dr, meia, a_) in ((1, 0.16, 255), (2, 0.11, 230), (3, 0.06, 170), (4, 0.02, 110)):
                for k in range(-6, 7):
                    da = k / 6 * meia
                    x_ = ecx + math.cos(ang + da) * (er + dr)
                    y_ = ecy + math.sin(ang + da) * (er + dr)
                    d_.point([(round(x_), round(y_))], fill=(255, 238, 200, a_))
        d_.ellipse([ecx - er, ecy - er, ecx + er, ecy + er], fill=(0, 0, 0, 0))
        return cam_

    def brilho_racha(k, t):
        """Rachaduras violeta: pulso lento + onda de luz correndo por elas."""
        m_ = racha_masc[k]
        hh, ww = m_.shape
        xs_ = np.arange(ww)[None, :]
        ys_ = np.arange(hh)[:, None]
        pulso = 0.5 + 0.5 * math.sin(t * 0.2)
        onda = np.sin(xs_ * 0.06 - ys_ * 0.1 - t * 0.4)
        forca = np.clip((onda - 0.5) / 0.5, 0, 1) * 0.85 + 0.25 * pulso
        out = np.zeros((hh, ww, 4), np.uint8)
        out[..., 0], out[..., 1], out[..., 2] = 255, 222, 255
        out[..., 3] = (m_ * forca * 150).astype(np.uint8)
        return Image.fromarray(out)

    def brasas_subindo(t, desl):
        """Brasas (laranja e violeta, 1 px) e cinzas (escuras, 2 px) saindo do
        entulho: sobem balançando, levadas de leve para a direita, e apagam."""
        cam_ = Image.new("RGBA", (largura, alt))
        px_ = cam_.load()
        for (bx_, by_, fase, vida, vel_, cor_, cinza, osc) in brasas:
            idade = (t + fase) % (vida + 20)
            if idade > vida:
                continue
            for gx in (bx_,):   # o meio já tem as duas metades (958 px)
                sx_ = (gx - desl) % 958 + 0.25 * idade + math.sin(idade / 4 + osc) * 1.5
                sy_ = by_ - fy0 - idade * vel_
                a_ = int(255 * min(1, (vida - idade) / (vida * 0.35)))
                pts = ((0, 0), (1, 0)) if cinza else ((0, 0),)
                for (dx_, dy_) in pts:
                    xi, yi = int(sx_) + dx_, int(sy_) + dy_
                    if 0 <= xi < largura and 0 <= yi < alt:
                        px_[xi, yi] = (*cor_, a_)
        return cam_

    def pulsar_cristais(arr, comps, t):
        for (cm, fase) in comps:
            f = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 28 + fase)
            c_ = arr[..., :3].astype(float)
            c_[cm] = c_[cm] * (1 - 0.35 * f) + np.array([210, 255, 250]) * 0.35 * f
            arr[..., :3] = c_.astype(np.uint8)

    def brilhar(cam_, pontos, t, ciclo=40):
        for (ex, ey, fs_) in pontos:
            k = (t + fs_) % ciclo
            if k < 4:
                q = brilho_c[k]
                cam_.alpha_composite(q, (ex - q.width // 2, ey - q.height // 2))

    def meio_ceu(t):
        arr = meio_c0.copy()
        pulsar_cristais(arr, comp_meio, t)
        cam_ = Image.fromarray(arr)
        if cf.get("pedestal"):
            # halo da estrela do pedestal (as duas metades)
            px_, py_ = cf["pedestal"]
            f = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 30)
            for cx_ in (px_, 957 - px_):
                halo = Image.new("RGBA", cam_.size)
                dh = ImageDraw.Draw(halo)
                for (r_, a_h) in ((10, 24), (8, 40), (6, 60)):
                    rr = r_ + round(2 * f)
                    dh.ellipse([cx_ - rr, py_ - rr, cx_ + rr, py_ + rr], fill=(150, 255, 240, int(a_h * (0.3 + 0.7 * f))))
                cam_.alpha_composite(halo)
        brilhar(cam_, pts_meio, t)
        return cam_

    def chao_ceu(t):
        arr = chao_c0.copy()
        pulsar_cristais(arr, comp_chao, t)
        for (xa, ya, xb, yb, mp, cor_p, fase) in pontes:
            bl = arr[ya:yb, xa:xb]
            c_ = bl[..., :3].astype(float)
            # luz pulsando na cor da ponte
            f = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 24 + fase)
            c_[mp] = c_[mp] * (1 - 0.3 * f) + np.array(cor_p) * 0.3 * f + 25 * f
            # reflexo passando ao longo da ponte (faixa clara inclinada)
            k = (t + fase) % 36
            pos = k / 14 * ((xb - xa) + 16) - 8
            ys_, xs_ = np.mgrid[0:yb - ya, 0:xb - xa]
            u = xs_ + ys_ * 0.4
            for larg_, f_ in ((3.5, 0.35), (1.5, 0.7)):
                mm = mp & (np.abs(u - pos) < larg_)
                c_[mm] = c_[mm] * (1 - f_) + 255 * f_
            # raios de luz correndo pela ponte (cabeça clara, rastro que some)
            for (ip, ry, vel_, comp_r, cor_r, fase_r, _) in raios_p:
                if pontes[ip][0] != xa:
                    continue
                larg_ = xb - xa
                hx = int((t * vel_ + fase_r) % (larg_ + comp_r * 2)) - comp_r
                for i_ in range(comp_r):
                    x_ = hx - i_
                    if 0 <= x_ < larg_ and mp[ry, x_]:
                        f_ = 0.9 * (1 - i_ / comp_r)
                        c_[ry, x_] = c_[ry, x_] * (1 - f_) + np.array(cor_r) * f_
            bl[..., :3] = np.clip(c_, 0, 255).astype(np.uint8)
        cam_ = Image.fromarray(arr)
        brilhar(cam_, pts_chao, t, ciclo=34)
        return cam_

    def brilho_lua(t):
        """Halo azul-arroxeado em degraus em volta do disco da lua, respirando
        devagar (~4 s); o disco fica como está."""
        cam_ = Image.new("RGBA", (largura, alt))
        d_ = ImageDraw.Draw(cam_)
        lc_ = meta["lua_ceu"]
        cx_ = lc_["x"] + lc_["w"] / 2 - x0
        cy_ = lc_["y"] + lc_["h"] / 2 - fy0 + DESCE
        r0 = min(lc_["w"], lc_["h"]) / 2
        f = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 36)
        for (dr, a_) in ((12, 16), (8, 28), (4, 44)):
            rr = r0 + dr + round(2 * f)
            d_.ellipse([cx_ - rr, cy_ - rr, cx_ + rr, cy_ + rr], fill=(*cf["lua_brilho"], int(a_ * (0.35 + 0.65 * f))))
        d_.ellipse([cx_ - r0, cy_ - r0, cx_ + r0, cy_ + r0], fill=(0, 0, 0, 0))
        return cam_

    def estrelas_cadentes(t):
        """Risco claro com rastro azul-ciano descendo na diagonal; cada uma
        aparece em um lugar sorteado a cada passagem."""
        cam_ = Image.new("RGBA", (largura, alt))
        d_ = ImageDraw.Draw(cam_)
        for j, (fase, ciclo_, comp_, cor_c) in enumerate(cadentes):
            k = (t + fase) % ciclo_
            dura = 6 + comp_ // 6           # as grandes duram mais
            if k >= dura:
                continue
            volta = (t + fase) // ciclo_
            rr = random.Random(volta * 31 + j)
            sx_, sy_ = rr.randrange(40, largura - 40), rr.randrange(2, 30)
            dirx = -1 if rr.random() < 0.5 else 1
            vel_ = 4 + comp_ / 8
            hx, hy = sx_ + dirx * k * vel_, sy_ + k * vel_ / 2
            some = 1 if k < dura - 2 else (dura - k) / 2
            clara = tuple(min(255, int(c_ * 0.6 + 110)) for c_ in cor_c)
            for i_ in range(comp_):
                tx, ty = hx - dirx * i_ * 1.0, hy - i_ * 0.5
                a_ = int(255 * (1 - i_ / comp_) * some)
                cor_ = (255, 255, 255) if i_ < 2 else clara if i_ < comp_ // 3 else cor_c
                d_.point([(round(tx), round(ty))], fill=(*cor_, a_))
                if comp_ >= 20 and i_ < comp_ // 3:  # as grandes têm rastro mais grosso
                    d_.point([(round(tx), round(ty) + 1)], fill=(*cor_, a_ // 2))
            cab = ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)) if comp_ >= 14 else ((0, 0),)
            for (ox, oy) in cab:
                d_.point([(round(hx) + ox, round(hy) + oy)], fill=(255, 255, 255, int(255 * some)))
        return cam_

    def faixa_luz(arr, bx0, by0, bx1, by1, t, fase, espelho=False, periodo=48):
        """Faixa diagonal clara atravessando a caixa (reflexo de luz passando
        no vidro), só nos pixels claros do objeto (o contorno escuro fica)."""
        larg_c, alt_c = bx1 - bx0, by1 - by0
        k = (t + fase) % periodo
        curso = larg_c + alt_c * 0.5 + 8
        pos = k / 18 * curso - 4          # passa em ~18 quadros e descansa o resto
        if pos > curso:
            return
        ys_, xs_ = np.mgrid[by0:by1, bx0:bx1]
        u = (xs_ - bx0) if not espelho else (bx1 - 1 - xs_)
        u = u + (by1 - ys_) * 0.5
        bloco = arr[by0:by1, bx0:bx1]
        claro = (bloco[..., 3] > 0) & (bloco[..., :3].astype(int).sum(2) > 520)
        nucleo = claro & (np.abs(u - pos) < 1.5)
        borda = claro & (np.abs(u - pos) >= 1.5) & (np.abs(u - pos) < 3)
        for m_, f_ in ((borda, 0.45), (nucleo, 0.85)):
            c_ = bloco[..., :3].astype(float)
            c_[m_] = c_[m_] * (1 - f_) + 255 * f_
            bloco[..., :3] = c_.astype(np.uint8)

    def meio_vidro(t):
        arr = meio_a0.copy()
        for (bx0, by0, bx1, by1, esp), fase in zip(caixas_v, fases_v):
            faixa_luz(arr, bx0, by0, bx1, by1, t, fase, esp)
        cam_ = Image.fromarray(arr)
        estrelar(cam_, estrelinhas, t)
        return cam_

    def chao_vidro(t):
        """Faíscas de estrela piscando no piso (presas ao chão: rolam com ele)."""
        cam_ = img["chao.png"].copy()
        for (fx_, fy_, fs_) in faiscas:
            k = (t + fs_) % 30
            if k < 4:
                q = _quadro(estrela_branca, k)
                cam_.alpha_composite(q, (fx_ - q.width // 2, fy_ - q.height // 2))
        return cam_

    def meio_com_vento(t):
        m_ = meio_base.copy()
        wm = m_.shape[1]
        for (bx0, by0, bx1, by1) in bandeiras:
            for metade in (0, 1):
                if metade == 0:
                    cols = range(bx0, bx1)
                    def xo(x): return x
                else:
                    cols = range(wm - bx1, wm - bx0)
                    def xo(x): return wm - 1 - x
                pano = meio_base[by0 - 3:by1 + 3, min(cols):max(cols) + 1].copy()
                m_[by0 - 3:by1 + 3, min(cols):max(cols) + 1] = 0
                for j, x in enumerate(cols):
                    d_mastro = abs(xo(x) - bx0)          # distância do mastro
                    amp = 2.2 * d_mastro / max(bx1 - bx0, 1)
                    dy = int(round(amp * math.sin(t * 0.55 - d_mastro * 0.45)))
                    colp = pano[:, j]
                    m_[by0 - 3:by1 + 3, x] = np.roll(colp, dy, axis=0)
        return Image.fromarray(m_)

    rnd_fx = random.Random(9)
    lavas = [(rnd_fx.uniform(0, quadros), rnd_fx.uniform(-1.6, 1.6), rnd_fx.uniform(2.2, 3.6),
              rnd_fx.choice([(255, 200, 70), (255, 140, 40), (255, 90, 30)])) for _ in range(26)]

    def lava_no_ar(t, cx_, cy_):
        """Gotas de lava estourando da cratera em arco (gravidade), apagando."""
        cam = Image.new("RGBA", (largura, alt))
        px_ = cam.load()
        for (nasc, vx, vy, cor) in lavas:
            idade = (t * 0.8 - nasc) % 22  # um pouco mais lenta
            if idade > 14:
                continue
            x_ = cx_ + vx * idade
            y_ = cy_ - vy * idade + 0.28 * idade * idade
            a_ = int(255 * (1 - idade / 15))
            for dx_, dy_ in ((0, 0), (1, 0), (0, 1)) if idade < 5 else ((0, 0),):
                xi, yi = int(x_) + dx_, int(y_) + dy_
                if 0 <= xi < largura and 0 <= yi < alt:
                    px_[xi, yi] = (*cor, a_)
        return cam

    fumacas_cr = [(rnd_fx.uniform(0, 40), rnd_fx.uniform(-0.35, 0.35)) for _ in range(6)]

    def fumaca(t, cx_, cy_, lista, ciclo=40, sobe=0.7, cor=None, tam=1.0, espaco=0.8, vel=1.0, vento=0.0,
               nevoa=0.0, cor_ar=(150, 60, 50), fuso=False, cores=None):
        """Fumaça no estilo da arte: bolhas opacas em pixel art (sem
        transparência), cor clara com a sombra mais escura embaixo e à
        direita, nas cores da fumaça desenhada no cenário. Cada bolha sobe,
        cresce e no fim encolhe até sumir (em vez de ficar transparente)."""
        clara, escura = cores or ((143, 113, 99), (107, 76, 70))
        # perspectiva atmosférica: longe, a fumaça puxa para a cor do ar e
        # perde contraste (nevoa 0 = perto, 1 = some no céu)
        mistura = lambda c: tuple(int(round(c[i] * (1 - nevoa) + cor_ar[i] * nevoa)) for i in range(3))
        clara, escura = mistura(clara), mistura(escura)
        cam = Image.new("RGBA", (largura, alt))
        d = ImageDraw.Draw(cam)
        bolhas = []
        for (nasc, deriva) in lista:
            for k in range(3):  # cada sopro são 3 bolhas juntas (cacho)
                # vel < 1: mais lenta (planos mais ao fundo andam mais devagar)
                idade = (t * vel - nasc - k * 3) % ciclo
                f = idade / ciclo
                if fuso:
                    # começa bem pequena, engorda pouco no meio e afina de novo no alto
                    r = (0.6 + 2.6 * math.sin(math.pi * f)) * tam
                else:
                    r = (2 + idade * 0.16) * tam * (1 if f < 0.7 else max(0.0, (1 - f) / 0.3))
                if r < 1:
                    continue
                # o vento leva o topo: deslocamento cresce com a altura e balança
                x_ = (cx_ + deriva * idade + math.sin(idade / 5 + nasc + k) * 1.5 + (k - 1) * r * espaco
                      + vento * 14 * f * f + math.sin(t * 0.18 + nasc) * 2.5 * f * abs(vento))
                y_ = cy_ - idade * sobe + (k % 2) * r * 0.5 * espaco / 0.8
                bolhas.append((y_, x_, r))
        # de trás (mais alto) para a frente, sombra primeiro
        for (y_, x_, r) in sorted(bolhas):
            d.ellipse([round(x_ - r + 1), round(y_ - r + 1), round(x_ + r + 1), round(y_ + r + 1)], fill=(*escura, 255))
        for (y_, x_, r) in sorted(bolhas):
            d.ellipse([round(x_ - r), round(y_ - r), round(x_ + r - 1), round(y_ + r - 1)], fill=(*clara, 255))
        return cam

    rnd_g = random.Random(6)
    # sopros espaçados por igual no ciclo: a fumaça vira uma coluna contínua
    # uma por árvore, cada uma de um jeito: tamanho, espaço e número de sopros sorteados
    # cada ponto gruda na ponta de galho mais próxima do meio.png (pixel opaco
    # com transparência logo acima), para a brasa ficar em cima do galho
    meio_a = np.array(img["meio.png"])[..., 3] > 0
    topo_galho = meio_a & ~np.vstack([np.zeros((1, meio_a.shape[1]), bool), meio_a[:-1]])

    def grudar(gx, gy, raio=14):
        y0_, y1_ = max(gy - raio, 0), gy + raio
        x0_, x1_ = max(gx - raio, 0), gx + raio
        ys_, xs_ = np.nonzero(topo_galho[y0_:y1_, x0_:x1_])
        if not len(ys_):
            return gx, gy
        d_ = (ys_ + y0_ - gy) ** 2 + (xs_ + x0_ - gx) ** 2
        j = int(np.argmin(d_))
        return int(xs_[j] + x0_), int(ys_[j] + y0_)

    fontes_galho = []
    for (gx, gy) in [grudar(*g_) for g_ in cfg.get("fumaca_galhos", [])]:
        nsop = rnd_g.randint(2, 4)             # menos densa
        fontes_galho.append((gx, gy, [(j * 44 / nsop + rnd_g.uniform(0, 3), rnd_g.uniform(-0.15, 0.15))
                                      for j in range(nsop)],
                             rnd_g.uniform(0.4, 0.85), rnd_g.uniform(1.1, 1.8)))

    fontes_cham = []
    for (gx, gy) in [grudar(*g_, raio=6) for g_ in cfg.get("fumaca_chamines", [])]:
        nsop = rnd_g.randint(6, 8)             # coluna contínua saindo da boca
        fontes_cham.append((gx, gy, [(j * 36 / nsop + rnd_g.uniform(0, 1.5), rnd_g.uniform(0.02, 0.08))
                                     for j in range(nsop)],
                            rnd_g.uniform(0.6, 0.75), rnd_g.uniform(0.45, 0.6), rnd_g.uniform(0.7, 1.0)))
        print("chaminé", (gx, gy))

    # ponteiros do relógio da torre: apaga os desenhados e gira os novos
    rel = cfg.get("relogio")
    if rel:
        fa_ = fundo.load()
        rcx, rcy = rel["centro"]
        lim = rel["limpa"]
        for yy in range(int(rcy - lim) - 1, int(rcy + lim) + 2):
            for xx in range(int(rcx - lim) - 1, int(rcx + lim) + 2):
                if (xx - rcx) ** 2 + (yy - rcy) ** 2 <= lim * lim:
                    fa_[xx, yy] = (*rel["mostrador"], 255)

    # torre na frente das nuvens: pixels da torre (caixa em volta das
    # colunas da torre, tudo que não é a cor do céu)
    torre_sp = None
    if cfg.get("nuvens_do_ref") and cfg.get("subir_cidade"):
        tx0, tx1 = cfg["subir_cidade"]["torre_x"]
        fa0 = np.array(fundo)
        caixa_ = fa0[:cfg["subir_cidade"]["linhas"][0], tx0 - 14:tx1 + 15].copy()
        cs, ns = np.unique(fa0[:12, :, :3].reshape(-1, 3), axis=0, return_counts=True)
        ceu = cs[np.argsort(-ns)[:3]]
        e_ceu = np.zeros(caixa_.shape[:2], bool)
        for c_ in ceu:
            e_ceu |= (np.abs(caixa_[..., :3].astype(int) - c_).sum(2) <= 3)
        caixa_[e_ceu, 3] = 0
        torre_sp = (Image.fromarray(caixa_), tx0 - 14)

    def brilho_relogio(t):
        """Halo do mostrador respirando devagar (~4 s): anéis em degraus, sem
        cobrir o mostrador; o mostrador clareia um pouco junto."""
        cam_ = Image.new("RGBA", (largura, alt))
        d_ = ImageDraw.Draw(cam_)
        cx_, cy_ = rel["centro"][0] - x0, rel["centro"][1] - fy0 + DESCE
        f = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 36)
        for (r_, a_) in ((26, 18), (23, 30), (20, 44)):
            rr = r_ + round(2 * f)
            d_.ellipse([cx_ - rr, cy_ - rr, cx_ + rr, cy_ + rr], fill=(255, 214, 140, int(a_ * (0.35 + 0.65 * f))))
        # tira o miolo (o mostrador fica com a cor dele)
        d_.ellipse([cx_ - 17, cy_ - 17, cx_ + 17, cy_ + 17], fill=(0, 0, 0, 0))
        ar = np.array(cam_)
        # mostrador: pixels da cor do mostrador clareiam com o pulso
        fa1 = np.array(fundo)
        y0_, x0_ = rel["centro"][1] - 18, rel["centro"][0] - 18
        bloco = fa1[y0_:y0_ + 37, x0_:x0_ + 37, :3].astype(int)
        mt = (np.abs(bloco - np.array(rel["mostrador"])).sum(2) <= 6)
        ty, tx_ = cy_ - 18, cx_ - 18
        ys_, xs_ = np.nonzero(mt)
        ar[ys_ + ty, xs_ + tx_] = (255, 240, 205, int(110 * f))
        return Image.fromarray(ar)

    def ponteiros(t):
        """Minuto anda um tique (6°) a cada 3 quadros; a hora anda 1/12 disso.
        Na prévia o tempo corre rápido (relógio mágico do Relojoeiro)."""
        cam_ = Image.new("RGBA", (largura, alt))
        d_ = ImageDraw.Draw(cam_)
        cx_, cy_ = rel["centro"][0] - x0, rel["centro"][1] - fy0 + DESCE
        tique = t // 3
        ang_m = math.radians(tique * 6)
        ang_h = math.radians(300 + tique * 0.5)  # começa perto das 10h
        for ang, comp in ((ang_h, rel["hora"]), (ang_m, rel["minuto"])):
            ex, ey = cx_ + math.sin(ang) * comp, cy_ - math.cos(ang) * comp
            d_.line([(cx_, cy_), (round(ex), round(ey))], fill=(*rel["ponteiro"], 255), width=1)
        d_.point([(cx_, cy_)], fill=(*rel["ponteiro"], 255))
        return cam_

    # fumaça saindo do chão do campo ao longe: pontos presos ao longe (rolam com ele)
    rnd_ch = random.Random(4)
    # espalhadas por igual na volta inteira (958 px): sempre há fumaça dos dois lados
    n_ch = max(cfg.get("fumaca_chao", 0), 1)
    fontes_ch = []
    for i in range(cfg.get("fumaca_chao", 0)):
        ciclo_i = rnd_ch.uniform(50, 92)       # umas mais altas, outras mais baixas
        nsop = rnd_ch.randint(5, 8)
        fontes_ch.append((int(i * 958 / n_ch + rnd_ch.randrange(-25, 25)) % 958, rnd_ch.randrange(170, 192),
                          [(j * ciclo_i / nsop + rnd_ch.uniform(0, 3), rnd_ch.uniform(-0.06, 0.1)) for j in range(nsop)],
                          ciclo_i, rnd_ch.uniform(1.1, 1.9), rnd_ch.uniform(-1.0, 1.0)))

    rf = meta.get("reflexo")
    reflexos = [Image.open(pasta / f).convert("RGBA") for f in rf["arquivos"]] if rf else []
    frames = []
    for t in range(quadros):
        andou = t * andar_px
        tela = Image.new("RGBA", (largura, alt))
        tela.alpha_composite(fundo.crop((x0, fy0 - DESCE, x0 + largura, fy1 - DESCE)))
        if lua_spr is not None:
            tela.alpha_composite(lua_spr, (meta["lua_sprite"]["x"] - x0, meta["lua_sprite"]["y_tela"] - fy0))
        if ef:
            tela.alpha_composite(coroa(t))
        # lua minguando: cobre de xs_max até a fração
        frac = 1 - t / (quadros - 1)
        corte = int(round(xs_min + (xs_max - xs_min) * frac))
        if corte < xs_max and not cfg.get("lua_fixa"):
            pedaco = cobre.crop((corte, 0, lw, lh))
            tela.alpha_composite(pedaco, (lx - x0 + corte, ly - fy0 + DESCE))
        if cf and cf.get("lua_brilho"):
            tela.alpha_composite(brilho_lua(t))
        if cf and cf.get("cadentes"):
            tela.alpha_composite(estrelas_cadentes(t))
        if rel and cfg.get("relogio_brilho") and torre_sp is None:
            tela.alpha_composite(brilho_relogio(t))
        if rel and not cfg.get("nuvens_do_ref"):
            tela.alpha_composite(ponteiros(t))
        for (sx, sy, fase, azul) in estrelas:
            k = (t // 3 + fase) % 8
            if k < 4:
                tela.alpha_composite(_quadro(estrela_azul if azul else estrela, k), (sx, sy))
        if cratera is not None:
            tela.alpha_composite(brilho_cratera(t, *cratera))
        if marco_sp is not None:
            mx, my = mc["x"] - x0, mc["y_tela"] - fy0
            tela.alpha_composite(marco_sp, (mx, my))
        if cratera is not None:
            # bolhas menores e mais espaçadas na cratera (pedido do usuário)
            # bolhas menores e espaçadas (aprovado na rodada anterior)
            tela.alpha_composite(fumaca(t, cratera[0], cratera[1] - 2, fumacas_cr, tam=0.7, espaco=1.5,
                                        vel=0.4, vento=0.4, nevoa=0.45, cor_ar=cor_ar_cr))  # bem longe
            tela.alpha_composite(lava_no_ar(t, *cratera))
            if cfg.get("farol_giro") and lampada is not None:
                tela.alpha_composite(facho(t, mx + lampada[0], my + lampada[1]))
        # nuvens: parallax lento + vento (descem com o fundo)
        if not cam["nuvens.png"].get("vazia", True):
            dn = cam["nuvens.png"].get("desce", DESCE)
            _rolar(tela, img["nuvens.png"], x0 - pad + andou * 0.15 + t * ms / 1000 * 2,
                   fy0 - dn, fy1 - dn, largura)
        if torre_sp is not None:
            # a torre passa na frente das nuvens (com o halo e os ponteiros)
            tela.alpha_composite(torre_sp[0], (torre_sp[1] - x0, -(fy0 - DESCE)))
            if cfg.get("relogio_brilho"):
                tela.alpha_composite(brilho_relogio(t))
            tela.alpha_composite(ponteiros(t))
        # ilhas na frente do farol e do facho (estão mais perto); numa camada
        # própria para poder ir na frente do longe (Céu Estelar)
        cam_il = Image.new("RGBA", (largura, alt))
        for k, (sp, ix, iy) in enumerate(ilhas):
            bal = round(2 * math.sin(t / 7 + k * 2))
            if eng is not None and k == eng_k:
                # a engrenagem dá uma volta a cada 64 quadros (~7 s), o espelho
                # fica parado com um reflexo passando, os cacos caem um de cada vez
                folga_b = 34
                quadro_e = Image.new("RGBA", (sp.width, sp.height + folga_b))
                quadro_e.alpha_composite(girar_pixelart(eng["roda"], eng["centro"], -t * 360 / 64))
                ar_e = eng["espelho"].copy()
                faixa_luz(ar_e, 0, 0, ar_e.shape[1], ar_e.shape[0], t, 10, periodo=44)
                quadro_e.alpha_composite(Image.fromarray(ar_e))
                for j_, pc in enumerate(eng["pecas"]):
                    ciclo_c = 56
                    idade = (t + j_ * 14) % ciclo_c
                    pedaco = Image.fromarray(eng["cacos"][pc["y"]:pc["y"] + pc["h"], pc["x"]:pc["x"] + pc["w"]].copy())
                    if idade < 30:      # cai acelerando e apaga no fim
                        dy_c = int(0.035 * idade * idade)
                        al = 1.0 if idade < 20 else (30 - idade) / 10
                    elif idade < 44:    # sumido
                        continue
                    else:               # reaparece no lugar, acendendo
                        dy_c, al = 0, (idade - 44) / 12
                    pa_ = np.array(pedaco)
                    pa_[..., 3] = (pa_[..., 3] * al).astype(np.uint8)
                    quadro_e.alpha_composite(Image.fromarray(pa_), (pc["x"], pc["y"] + dy_c))
                cam_il.alpha_composite(quadro_e, (int(ix - x0 - andou * 0.2), iy - fy0 + DESCE + bal))
            elif vb and vb.get("ilhas"):
                ar_i = np.array(sp)
                faixa_luz(ar_i, 0, 0, sp.width, sp.height, t, 20 + k * 17)
                sp_b = Image.fromarray(ar_i)
                # a estrelinha pode sair da borda do cristal: desenha numa folga
                folga = Image.new("RGBA", (sp.width + 12, sp.height + 12))
                folga.alpha_composite(sp_b, (6, 6))
                estrelar(folga, [(ex + 6, ey + 6, fs_) for (ex, ey, fs_) in estrelinhas_ilhas[k]], t)
                cam_il.alpha_composite(folga, (int(ix - x0 - andou * 0.2) - 6, iy - fy0 + DESCE + bal - 6))
            else:
                cam_il.alpha_composite(sp, (int(ix - x0 - andou * 0.2), iy - fy0 + DESCE + bal))
            if cfg.get("lanternas_ilhas"):
                # halo da lanterna (pixels mais claros da ilha) pulsando devagar,
                # cada plataforma num tempo; vai junto com o balanço
                if not hasattr(sp, "_lanterna"):
                    a_ = np.array(sp).astype(int)
                    m_ = (a_[..., 3] > 0) & (np.abs(a_[..., :3] - (249, 222, 171)).sum(2) <= 6)
                    ys_, xs_ = np.nonzero(m_)
                    sp._lanterna = (float(xs_.mean()), float(ys_.mean())) if len(xs_) else None
                if sp._lanterna:
                    f = 0.5 + 0.5 * math.sin(t * 2 * math.pi / 30 + k * 2.1)
                    hx = int(ix - x0 - andou * 0.2) + sp._lanterna[0]
                    hy = iy - fy0 + DESCE + bal + sp._lanterna[1]
                    halo = Image.new("RGBA", (largura, alt))
                    dh = ImageDraw.Draw(halo)
                    for (r_, a_h) in ((8, 26), (6, 40), (4, 60)):
                        rr = r_ + round(1.5 * f)
                        dh.ellipse([hx - rr, hy - rr, hx + rr, hy + rr],
                                   fill=(255, 214, 140, int(a_h * (0.3 + 0.7 * f))))
                    cam_il.alpha_composite(halo)
        if not cfg.get("ilhas_na_frente"):
            tela.alpha_composite(cam_il)
        if sol:
            tela.alpha_composite(brilho_sol(t))
        if "longe.png" in img:
            _rolar(tela, img["longe.png"], x0 - pad + andou * VEL_LONGE, fy0, fy1, largura)
            if "longe.png" in lava_masc:
                _rolar(tela, brilho_lava("longe.png", t), x0 - pad + andou * VEL_LONGE, fy0, fy1, largura)
            if ef:
                _rolar(tela, brilho_racha("longe.png", t), x0 - pad + andou * VEL_LONGE, fy0, fy1, largura)
            desl_l = x0 - pad + andou * VEL_LONGE
            for (fx_, fy_, lista, ciclo_i, esp_i, vento_i) in fontes_ch:
                sx_ = (fx_ - desl_l) % 958
                if -20 < sx_ < largura + 20:
                    # sobem mais alto (ciclo mais longo e mais rápido)
                    tela.alpha_composite(fumaca(t, sx_, fy_ - fy0, lista, ciclo=ciclo_i, sobe=1.0, tam=0.55,
                                                espaco=esp_i, vel=0.6, vento=vento_i, nevoa=0.25,
                                                cor_ar=cor_ar_ch))
        if cfg.get("ilhas_na_frente"):
            tela.alpha_composite(cam_il)   # na frente do mar de nuvens, atrás do meio
        if reflexos:
            # parado sob a lua, por baixo das ondas, pedras e barcos; os
            # quadros se alternam (prova do tremor, detalhe futuro)
            sp = reflexos[(t * ms // rf["ms"]) % len(reflexos)]
            tela.alpha_composite(sp, (rf["x"] + pad - x0, rf["y"] - fy0))
        _rolar(tela, meio_com_vento(t) if bandeiras else meio_vidro(t) if vb else meio_ceu(t) if cf else img["meio.png"],
               x0 - pad + andou * 0.5, fy0, fy1, largura)
        if "meio.png" in lava_masc:  # rachaduras de lava das pedras do meio
            _rolar(tela, brilho_lava("meio.png", t), x0 - pad + andou * 0.5, fy0, fy1, largura)
        if ef:
            _rolar(tela, brilho_racha("meio.png", t), x0 - pad + andou * 0.5, fy0, fy1, largura)
            tela.alpha_composite(brasas_subindo(t, x0 - pad + andou * 0.5))
        # fumaça saindo das pontas dos galhos (presas ao meio: rolam com ele)
        desl_m = x0 - pad + andou * 0.5
        for (gx, gy, lista, tam_g, esp_g) in fontes_galho:
            for vol in (0, 479):  # o meio tem duas metades (original + espelho)
                gx_ = gx if vol == 0 else 958 - 1 - gx
                sx_ = (gx_ - desl_m) % 958
                if -20 < sx_ < largura + 20:
                    tela.alpha_composite(fumaca(t, sx_, gy - fy0, lista, ciclo=44, sobe=0.75, tam=tam_g,
                                                espaco=esp_g, vel=0.6, vento=0.5, fuso=True))
                    # brasa na ponta do galho: pixels acesos pulsando com a onda de calor
                    q_ = 0.5 + 0.5 * math.sin(t * 0.35 + gx * 0.05)
                    cor_b = (255, int(120 + 110 * q_), int(40 + 60 * q_), 255)
                    brasa = Image.new("RGBA", (3, 2))
                    bp = brasa.load()
                    for (bx_, by_) in ((1, 0), (0, 1), (1, 1), (2, 1)):
                        bp[bx_, by_] = cor_b if (bx_, by_) != (1, 0) or q_ > 0.4 else (255, 90, 30, 255)
                    tela.alpha_composite(brasa, (int(sx_) - 1, int(gy - fy0) - 1))
        for (gx, gy, lista, tam_c, esp_c, vento_c) in fontes_cham:
            for vol in (0, 479):
                gx_ = gx if vol == 0 else 958 - 1 - gx
                sx_ = (gx_ - desl_m) % 958
                if -30 < sx_ < largura + 30:
                    # sobe e vai deitando para a direita (vento crescente com a altura)
                    tela.alpha_composite(fumaca(t, sx_, gy - fy0 - 1, lista, ciclo=36, sobe=0.55, tam=tam_c,
                                                espaco=esp_c, vel=0.55, vento=vento_c, fuso=True,
                                                cores=cfg["fumaca_cores"]))
        _rolar(tela, chao_vidro(t) if vb else chao_ceu(t) if cf else img["chao.png"], x0 - pad + andou * 1.0, fy0, fy1, largura)
        if "chao.png" in lava_masc:
            _rolar(tela, brilho_lava("chao.png", t), x0 - pad + andou * 1.0, fy0, fy1, largura)
        if ef:
            _rolar(tela, brilho_racha("chao.png", t), x0 - pad + andou * 1.0, fy0, fy1, largura)
        q = t % 8
        tela.alpha_composite(passos[q], (60, pes - 96 + (1 if q in (1, 5) else 0)))
        frames.append(tela.resize((largura * escala, alt * escala), Image.NEAREST).convert("RGB"))
    destino.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(destino, save_all=True, append_images=frames[1:], duration=ms, loop=0, optimize=True)
    # quadro parado em tamanho cheio (ilustração inteira, para conferir as camadas)
    return frames


# ------------------------------------------------------------------ mod

# biomas aprovados que vão para o mod (página da jornada -> bioma em cena.ts)
APROVADOS = ["ruinas", "mar", "vulcao", "torre", "aurora", "castelo_vidro", "ceu_estelar", "eclipse"]


def estrelas_do_ceu(fundo, cfg, desce, n, seed=3):
    """Estrelas cintilando só no céu limpo (o mesmo teste da prévia, na largura
    inteira do fundo): [x no fundo, y na tela, fase, cor]. cor 0 = branca, 1 =
    a outra (azul, ou vermelha no vulcão), uma em cada três."""
    fs = np.array(fundo.convert("RGB")).astype(int).sum(2)
    y0 = JANELA[0] - desce
    vis = fs[max(y0, 0):JANELA[1] - desce]
    ceu_escuro = np.percentile(vis[:12], 10)
    lc = (cfg["lua"][0] + (fundo.width - W + 1) // 2, cfg["lua"][2] + (fundo.width - W + 1) // 2)
    rnd = random.Random(seed)
    out, tent = [], 0
    while len(out) < n and tent < 8000:
        tent += 1
        sx, sy = rnd.randrange(4, fundo.width - 11), rnd.randrange(1, cfg.get("estrelas_ate", 52))
        bloco = vis[sy:sy + 9, sx:sx + 9]
        if bloco.shape != (9, 9) or lc[0] - 22 <= sx <= lc[1] + 22:
            continue
        if (np.abs(bloco - ceu_escuro).max() > 10 if not cfg.get("estrelas_ceu_todo")
                else bloco.max() - bloco.min() > 16):
            continue
        if any(abs(sx - ex) < 22 and abs(sy - ey) < 14 for ex, ey, _, _ in out):
            continue
        out.append((sx, sy, rnd.randrange(4), 1 if len(out) % 3 == 2 else 0))
    return out


def exportar_mod(nome):
    """Leva o bioma aprovado (a pasta da prévia, com os *_editado já aplicados)
    para assets/cenarios/<bioma>/ e grava no cenario.json o que antes só a
    prévia sabia: estrelas no céu limpo, ordem das ilhas, relógio e torre na
    frente das nuvens (Torre), cor das estrelas. Não regera nenhuma camada."""
    import shutil
    cfg = BIOMAS[nome]
    origem = RAIZ / "previa_faixa" / "biomas" / nome
    destino = RAIZ / "assets" / "cenarios" / nome
    destino.mkdir(parents=True, exist_ok=True)
    for f in origem.glob("*.png"):
        if f.name.startswith("_") or "_editado" in f.name or f.name == "fundo_referencia.png":
            continue
        shutil.copy2(f, destino / f.name)
    meta = json.loads((origem / "cenario.json").read_text())
    desce = meta["modos"]["compacto"]["camadas_de_tras_descem"]
    fundo = Image.open(destino / "fundo.png").convert("RGBA")
    pad = (fundo.width - W + 1) // 2
    extra = {"lua_fixa": bool(cfg.get("lua_fixa")), "ilhas_na_frente": bool(cfg.get("ilhas_na_frente"))}
    # floresta: 7 estrelas numa faixa de 560 px; aqui a largura inteira do fundo
    n_est = cfg.get("estrelas", 12)
    extra["estrelas"] = [list(e) for e in estrelas_do_ceu(fundo, cfg, desce, int(round(n_est * 960 / 560)))] if n_est else []
    extra["estrela_cor"] = cfg.get("estrela_cor", "azul")
    rel = cfg.get("relogio")
    if rel:
        # mostrador limpo (os ponteiros desenhados saem; o mod desenha os dele)
        fa_ = fundo.load()
        rcx, rcy = rel["centro"]
        lim = rel["limpa"]
        for yy in range(int(rcy - lim) - 1, int(rcy + lim) + 2):
            for xx in range(int(rcx - lim) - 1, int(rcx + lim) + 2):
                if (xx - rcx) ** 2 + (yy - rcy) ** 2 <= lim * lim:
                    fa_[xx, yy] = (*rel["mostrador"], 255)
        fundo.save(destino / "fundo.png")
        extra["relogio"] = {"centro": list(rel["centro"]), "minuto": rel["minuto"], "hora": rel["hora"],
                            "cor": list(rel["ponteiro"]), "obs": "centro no fundo.png"}
        if cfg.get("nuvens_do_ref") and cfg.get("subir_cidade"):
            # a torre na frente das nuvens: pixels da torre (tudo que não é céu)
            tx0, tx1 = cfg["subir_cidade"]["torre_x"]
            fa0 = np.array(fundo)
            caixa_ = fa0[:cfg["subir_cidade"]["linhas"][0], tx0 - 14:tx1 + 15].copy()
            cs, ns = np.unique(fa0[:12, :, :3].reshape(-1, 3), axis=0, return_counts=True)
            e_ceu = np.zeros(caixa_.shape[:2], bool)
            for c_ in cs[np.argsort(-ns)[:3]]:
                e_ceu |= (np.abs(caixa_[..., :3].astype(int) - c_).sum(2) <= 3)
            caixa_[e_ceu, 3] = 0
            Image.fromarray(caixa_).save(destino / "torre.png")
            extra["torre"] = {"arquivo": "torre.png", "x": tx0 - 14, "y": 0,
                              "obs": "x e y no fundo.png; desenhada depois das nuvens"}
    meta["mod"] = extra
    (destino / "cenario.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    print(nome, "->", destino.relative_to(RAIZ), "estrelas", len(extra["estrelas"]),
          "relogio" if rel else "", "torre" if "torre" in extra else "")


if __name__ == "__main__":
    nome = sys.argv[1]
    if "--mod" in sys.argv:
        for n_ in (APROVADOS if nome == "todos" else [nome]):
            exportar_mod(n_)
        sys.exit(0)
    cfg = BIOMAS[nome]
    aplicar = "--aplicar" in sys.argv
    pasta = (RAIZ / "assets" / "cenarios" / nome) if aplicar else (RAIZ / "previa_faixa" / "biomas" / nome)
    fn = montar_ceu if "placa" not in cfg else (montar if cfg.get("reflexo") else montar_placa)
    meta = fn(nome, cfg, pasta)
    print(nome, "camadas em", pasta.relative_to(RAIZ))
    if "--previa" in sys.argv:
        previa(nome, cfg, pasta, RAIZ / "previa_faixa" / "biomas" / f"previa_{nome}_caminhada.gif")
        print("prévia: previa_faixa/biomas/previa_" + nome + "_caminhada.gif")
