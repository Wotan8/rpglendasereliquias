#!/usr/bin/env python3
"""Markdown -> PDF para os changelogs de Lendas & Relicarias.

Subconjunto proposital de Markdown, que e tudo que um changelog precisa:

    # H1   ## H2   ### H3
    - bullet          (aninha com dois espacos)
    | tabela | ... |  (linha seguinte de --- e ignorada)
    > destaque
    ---               (linha horizontal)
    **negrito** e `codigo` dentro de qualquer texto
    [+] adicionado / [-] removido / [~] alterado  (fundo verde/vermelho/amarelo;
        vale no inicio de paragrafo, de bullet e de celula de tabela)
    [TOC]             (sumario clicavel com todos os ## do documento)

Uso:  python md2pdf.py entrada.md saida.pdf
"""
import re
import sys
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, HRFlowable, ListFlowable,
                                ListItem, PageTemplate, Paragraph, Spacer, Table,
                                TableStyle)

TINTA = colors.HexColor("#1a1a1a")
FRACA = colors.HexColor("#6b6b6b")
REALCE = colors.HexColor("#8b1e1e")   # vermelho-sangue, a cor da casa
LINHA = colors.HexColor("#d8d4cc")
FUNDO = colors.HexColor("#f4f1ea")
FUNDO_ADD = colors.HexColor("#ddefdd")   # verde: entrou no sistema
FUNDO_REM = colors.HexColor("#f6dcdc")   # vermelho: saiu do sistema
FUNDO_ALT = colors.HexColor("#faf0d0")   # amarelo: mudou de forma

MARCAS = {"[+]": ("add", FUNDO_ADD), "[-]": ("rem", FUNDO_REM), "[~]": ("alt", FUNDO_ALT)}


def marca(txt):
    """Devolve (sufixo_do_estilo, cor, texto sem o marcador) ou (None, None, txt)."""
    for m, (suf, cor) in MARCAS.items():
        if txt.startswith(m):
            return suf, cor, txt[len(m):].strip()
    return None, None, txt

def _est(nome, **kw):
    # Densidade calibrada para um changelog de rodada caber em 2 paginas.
    base = dict(fontName="Helvetica", fontSize=9.2, leading=12.6, textColor=TINTA,
                alignment=TA_LEFT, spaceAfter=4)
    base.update(kw)
    return ParagraphStyle(nome, **base)

ESTILOS = {
    "h1": _est("h1", fontName="Helvetica-Bold", fontSize=19, leading=23,
               textColor=REALCE, spaceAfter=3, spaceBefore=0),
    "h2": _est("h2", fontName="Helvetica-Bold", fontSize=13, leading=17,
               spaceBefore=11, spaceAfter=4),
    "h3": _est("h3", fontName="Helvetica-Bold", fontSize=10.5, leading=14,
               textColor=REALCE, spaceBefore=7, spaceAfter=3),
    "p": _est("p"),
    "li": _est("li", spaceAfter=2.5),
    "quote": _est("quote", leftIndent=8, borderPadding=6, backColor=FUNDO,
                  textColor=TINTA, spaceBefore=4, spaceAfter=7),
    "celula": _est("celula", fontSize=8.5, leading=11.5, spaceAfter=0),
    "cabecalho": _est("cabecalho", fontSize=8.5, leading=11.5, spaceAfter=0,
                      fontName="Helvetica-Bold"),
    "rodape": _est("rodape", fontSize=7.5, textColor=FRACA),
    "toc": _est("toc", fontSize=9.2, leading=13.5, spaceAfter=1.5),
}
for _suf, _cor in (("add", FUNDO_ADD), ("rem", FUNDO_REM), ("alt", FUNDO_ALT)):
    ESTILOS["p_" + _suf] = _est("p_" + _suf, backColor=_cor, borderPadding=3,
                                spaceBefore=2, spaceAfter=6)
    ESTILOS["li_" + _suf] = _est("li_" + _suf, backColor=_cor, borderPadding=2,
                                 spaceAfter=4)


# As fontes base do PDF (Helvetica/Courier) so cobrem WinAnsi. Caractere fora
# disso nao da erro: some, silenciosamente. Foi assim que um changelog inteiro
# saiu com "Reacao + pericia  1" no lugar de "- 1". Tudo passa por aqui.
TRADUCAO = {
    "−": "-",    # menos matematico
    "≥": ">=", "≤": "<=", "≠": "!=", "≈": "~",
    "→": "->", "←": "<-", "⇒": "=>",
    "′": "'", "″": '"',
    "≤": "<=", "±": "+/-",
    "⌈": "", "⌉": "", "⌊": "", "⌋": "",   # tetos e pisos
    "•": "-", "✓": "ok", "✗": "x", "⚠": "!",
    " ": " ", " ": " ", " ": " ",               # espacos exoticos
}


def winansi(txt):
    """Troca o que a fonte base nao desenha. Sem isso o caractere some sem avisar."""
    for de, para in TRADUCAO.items():
        txt = txt.replace(de, para)
    saida = []
    for ch in txt:
        try:
            ch.encode("cp1252")
            saida.append(ch)
        except UnicodeEncodeError:
            saida.append("")          # emoji e afins: fora do PDF
    return "".join(saida)


def inline(txt):
    """**negrito**, *italico*, `codigo` -> marcacao do reportlab."""
    txt = winansi(txt)
    txt = (txt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    txt = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", txt)
    txt = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"<i>\1</i>", txt)
    txt = re.sub(r"`(.+?)`", r'<font face="Courier" size="8.5">\1</font>', txt)
    return txt


def celulas(linha):
    return [c.strip() for c in linha.strip().strip("|").split("|")]


def tabela(linhas):
    cab, *corpo = linhas
    dados = [[Paragraph(inline(c), ESTILOS["cabecalho"]) for c in celulas(cab)]]
    fundos = []
    for i, l in enumerate(corpo, start=1):
        linha_par = []
        for j, c in enumerate(celulas(l)):
            _, cor, texto = marca(c)
            if cor is not None:
                fundos.append(("BACKGROUND", (j, i), (j, i), cor))
            linha_par.append(Paragraph(inline(texto), ESTILOS["celula"]))
        dados.append(linha_par)
    n = max(len(l) for l in dados)
    dados = [l + [""] * (n - len(l)) for l in dados]
    largura = (A4[0] - 36 * mm) / n
    t = Table(dados, colWidths=[largura] * n, hAlign="LEFT", repeatRows=1)
    t.setStyle(TableStyle(fundos + [
        ("BACKGROUND", (0, 0), (-1, 0), FUNDO),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, REALCE),
        ("LINEBELOW", (0, 1), (-1, -2), 0.25, LINHA),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def construir(md):
    fluxo, buffer_tabela, buffer_lista = [], [], []
    h2s = [l.strip()[3:] for l in md.splitlines() if l.strip().startswith("## ")]
    n_h2 = 0

    def fechar_tabela():
        if buffer_tabela:
            fluxo.extend([tabela(buffer_tabela), Spacer(1, 7)])
            buffer_tabela.clear()

    def item_lista(t):
        suf, _, texto = marca(t)
        estilo = ESTILOS["li_" + suf] if suf else ESTILOS["li"]
        return ListItem(Paragraph(inline(texto), estilo), leftIndent=12)

    def fechar_lista():
        if buffer_lista:
            fluxo.append(ListFlowable(
                [item_lista(t) for t in buffer_lista],
                bulletType="bullet", bulletFontSize=6, bulletOffsetY=1,
                start="•", leftIndent=12, spaceAfter=6))
            buffer_lista.clear()

    def fechar():
        fechar_tabela()
        fechar_lista()

    for bruta in md.splitlines():
        linha = bruta.rstrip()
        nu = linha.strip()

        if nu.startswith("|"):
            fechar_lista()
            if not re.fullmatch(r"\|[\s:|-]+\|?", nu):   # pula o separador ---
                buffer_tabela.append(nu)
            continue
        fechar_tabela()

        if not nu:
            fechar_lista()
            continue
        if nu.startswith("- "):
            buffer_lista.append(nu[2:])
            continue
        fechar_lista()

        if nu.startswith("### "):
            fluxo.append(Paragraph(inline(nu[4:]), ESTILOS["h3"]))
        elif nu.startswith("## "):
            fluxo.append(Paragraph('<a name="h2_%d"/>' % n_h2 + inline(nu[3:]),
                                   ESTILOS["h2"]))
            n_h2 += 1
        elif nu.startswith("# "):
            fluxo.append(Paragraph(inline(nu[2:]), ESTILOS["h1"]))
        elif nu == "[TOC]":
            for i, titulo in enumerate(h2s):
                fluxo.append(Paragraph(
                    '<a href="#h2_%d" color="#8b1e1e"><u>%s</u></a>' % (i, inline(titulo)),
                    ESTILOS["toc"]))
            fluxo.append(Spacer(1, 6))
        elif nu.startswith("> "):
            fluxo.append(Paragraph(inline(nu[2:]), ESTILOS["quote"]))
        elif set(nu) <= {"-", "*", "_"} and len(nu) >= 3:
            fluxo.append(HRFlowable(width="100%", thickness=0.6, color=LINHA,
                                    spaceBefore=8, spaceAfter=8))
        else:
            suf, _, texto = marca(nu)
            estilo = ESTILOS["p_" + suf] if suf else ESTILOS["p"]
            fluxo.append(Paragraph(inline(texto), estilo))

    fechar()
    return fluxo


def numerar(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(FRACA)
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, str(canvas.getPageNumber()))
    canvas.drawString(18 * mm, 12 * mm, doc.rodape)
    canvas.setStrokeColor(LINHA)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 16 * mm, A4[0] - 18 * mm, 16 * mm)
    canvas.restoreState()


def gerar(md_path, pdf_path, rodape="Lendas & Reliquias"):
    md = open(md_path, encoding="utf-8").read()
    doc = BaseDocTemplate(pdf_path, pagesize=A4,
                          leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=16 * mm, bottomMargin=20 * mm,
                          title=md.splitlines()[0].lstrip("# ").strip() if md else "Changelog",
                          author="Lendas & Reliquias")
    doc.rodape = rodape
    quadro = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="corpo")
    doc.addPageTemplates([PageTemplate(id="pad", frames=[quadro], onPage=numerar)])
    doc.build(construir(md))
    return pdf_path


def _autoteste():
    """Roda com: python md2pdf.py --autoteste"""
    import tempfile, os
    amostra = ("# Titulo\n\n## Secao\n\nTexto com **negrito** e `codigo`.\n\n"
               "- um\n- dois\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> nota\n\n---\n\nfim\n")
    d = tempfile.mkdtemp()
    m, p = os.path.join(d, "t.md"), os.path.join(d, "t.pdf")
    open(m, "w", encoding="utf-8").write(amostra)
    gerar(m, p)
    assert os.path.getsize(p) > 1500, "PDF saiu pequeno demais para ter conteudo"
    fluxo = construir(amostra)
    tipos = [type(f).__name__ for f in fluxo]
    assert "Table" in tipos, f"tabela nao virou Table: {tipos}"
    assert "ListFlowable" in tipos, f"lista nao virou ListFlowable: {tipos}"
    assert tipos.count("Paragraph") >= 4, f"poucos paragrafos: {tipos}"
    assert "<b>negrito</b>" in inline("**negrito**")
    assert celulas("| a | b |") == ["a", "b"]
    # O bug que motivou a funcao: menos matematico e emoji sumiam calados.
    assert winansi("Defesa − 1") == "Defesa - 1", winansi("Defesa − 1")
    assert winansi("Graus ≥ Defesa") == "Graus >= Defesa"
    assert winansi("dano 🗡️ alto") == "dano  alto"
    assert winansi("meia — travessão · ponto") == "meia — travessão · ponto"
    for f in construir("- Defesa − 1\n\n| A − B |\n|---|\n| c ≥ d |\n"):
        assert "−" not in repr(f) and "≥" not in repr(f), f"passou glifo cru: {f}"
    # Marcadores de cor: paragrafo, bullet e celula, mais o sumario clicavel.
    assert marca("[+] entrou") == ("add", FUNDO_ADD, "entrou")
    assert marca("[-] saiu")[1] == FUNDO_REM
    assert marca("[~] mudou")[1] == FUNDO_ALT
    assert marca("nada") == (None, None, "nada")
    md_cor = ("# T\n\n[TOC]\n\n## Sec A\n\n[+] entrou\n\n[-] saiu\n\n"
              "- [~] mudou em lista\n\n| A | B |\n|---|---|\n| [+] verde | comum |\n")
    fluxo_cor = construir(md_cor)
    reprs = " ".join(repr(f) for f in fluxo_cor)
    assert 'href="#h2_0"' in reprs, "TOC sem link para o h2"
    assert 'name="h2_0"' in reprs, "h2 sem ancora"
    ps = [f for f in fluxo_cor if type(f).__name__ == "Paragraph"]
    fundos_p = {getattr(f.style, "backColor", None) for f in ps}
    assert FUNDO_ADD in fundos_p and FUNDO_REM in fundos_p, f"paragrafo sem fundo de cor: {fundos_p}"
    tab = [f for f in fluxo_cor if type(f).__name__ == "Table"][0]
    assert any(c[0] == "BACKGROUND" and c[-1] == FUNDO_ADD for c in tab._bkgrndcmds), \
        f"celula [+] sem fundo verde: {tab._bkgrndcmds}"
    m_cor, p_cor = os.path.join(d, "cor.md"), os.path.join(d, "cor.pdf")
    open(m_cor, "w", encoding="utf-8").write(md_cor)
    gerar(m_cor, p_cor)
    assert os.path.getsize(p_cor) > 1500
    print("autoteste ok ->", p)


if __name__ == "__main__":
    if "--autoteste" in sys.argv:
        _autoteste()
    elif len(sys.argv) >= 3:
        print(gerar(sys.argv[1], sys.argv[2], *sys.argv[3:4]))
    else:
        print(__doc__)
        sys.exit(1)
