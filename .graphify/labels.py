# -*- coding: utf-8 -*-
"""Guarda e reaplica os nomes das comunidades do grafo do graphify.

O graphify escreve o grafo em graphify-out/, que fica fora do git. Uma
re-extracao completa reagrupa as comunidades e devolve todo mundo para
"Community N". Este script versiona os nomes curados em .graphify/labels.json
e sabe reaplica-los depois.

Os IDs de comunidade NAO sao estaveis entre extracoes, entao o casamento e
feito por sobreposicao de membros: cada nome guarda uma amostra dos nos que
estavam na comunidade, e a reaplicacao escolhe a comunidade nova com maior
sobreposicao.

    python .graphify/labels.py salvar    # grafo  -> .graphify/labels.json
    python .graphify/labels.py aplicar   # labels -> grafo + GRAPH_REPORT.md

Sem dependencias. Qualquer Python 3.8+ serve; o que vem com o graphify tambem:
    %APPDATA%\\uv\\tools\\graphifyy\\Scripts\\python.exe .graphify/labels.py aplicar
"""
import json, re, sys, collections
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
OUT = RAIZ / 'graphify-out'
GRAFO = OUT / 'graph.json'
RELATORIO = OUT / 'GRAPH_REPORT.md'
ROTULOS_RUNTIME = OUT / '.graphify_labels.json'
ROTULOS_VERSIONADOS = RAIZ / '.graphify' / 'labels.json'

TAMANHO_AMOSTRA = 12          # nos guardados por comunidade, para o casamento
SOBREPOSICAO_MINIMA = 0.25    # fracao da amostra que precisa bater


def hash32(texto):
    """FNV-1a 32 bits. So para encurtar o ID do no na amostra."""
    h = 0x811c9dc5
    for b in texto.encode('utf-8'):
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return format(h, '08x')


def carregar_grafo():
    if not GRAFO.exists():
        sys.exit('grafo nao encontrado em {} - rode `graphify extract . --code-only` antes.'.format(GRAFO))
    return json.loads(GRAFO.read_text(encoding='utf-8'))


def comunidades_do_grafo(grafo):
    """{id_comunidade: {'nome': str, 'nos': [id...], 'arquivo': str}}"""
    por_id = collections.defaultdict(lambda: {'nome': None, 'nos': [], 'arquivos': collections.Counter()})
    for n in grafo['nodes']:
        c = n.get('community')
        if c is None:
            continue
        reg = por_id[c]
        reg['nos'].append(n['id'])
        reg['arquivos'][n.get('source_file') or '?'] += 1
        if reg['nome'] is None:
            reg['nome'] = n.get('community_name')
    return por_id


def salvar():
    grafo = carregar_grafo()
    por_id = comunidades_do_grafo(grafo)
    registros = []
    sem_nome = 0
    for cid, reg in sorted(por_id.items(), key=lambda kv: -len(kv[1]['nos'])):
        nome = reg['nome'] or ''
        if not nome or re.fullmatch(r'Community \d+', nome):
            sem_nome += 1
            continue
        # amostra deterministica: os nos com maior grau viriam primeiro se o
        # grafo trouxesse grau; na falta disso, ordem alfabetica estavel.
        amostra = sorted(reg['nos'])[:TAMANHO_AMOSTRA]
        registros.append({
            'nome': nome,
            'idNaExtracao': cid,
            'tamanho': len(reg['nos']),
            'arquivoDominante': reg['arquivos'].most_common(1)[0][0],
            'amostra': [hash32(i) for i in amostra],
        })
    ROTULOS_VERSIONADOS.parent.mkdir(exist_ok=True)
    ROTULOS_VERSIONADOS.write_text(json.dumps({
        'versao': 1,
        'observacao': 'Nomes curados das comunidades. Reaplique com: python .graphify/labels.py aplicar',
        'comunidades': registros,
    }, ensure_ascii=False, indent=1), encoding='utf-8')
    print('salvos {} nomes em {}'.format(len(registros), ROTULOS_VERSIONADOS.relative_to(RAIZ)))
    if sem_nome:
        print('  ({} comunidades sem nome curado foram ignoradas)'.format(sem_nome))


def aplicar():
    if not ROTULOS_VERSIONADOS.exists():
        sys.exit('{} nao existe - rode `salvar` primeiro.'.format(ROTULOS_VERSIONADOS))
    guardado = json.loads(ROTULOS_VERSIONADOS.read_text(encoding='utf-8'))
    grafo = carregar_grafo()
    por_id = comunidades_do_grafo(grafo)

    # hashes atuais por comunidade
    atuais = {cid: {hash32(i) for i in reg['nos']} for cid, reg in por_id.items()}

    # casa cada nome guardado com a comunidade de maior sobreposicao, um para um
    candidatos = []
    for reg in guardado['comunidades']:
        amostra = set(reg['amostra'])
        if not amostra:
            continue
        for cid, hashes in atuais.items():
            score = len(amostra & hashes) / len(amostra)
            if score >= SOBREPOSICAO_MINIMA:
                candidatos.append((score, reg['nome'], cid))
    candidatos.sort(key=lambda t: -t[0])

    nomes = {}
    nomes_usados = set()
    for score, nome, cid in candidatos:
        if cid in nomes or nome in nomes_usados:
            continue
        nomes[cid] = nome
        nomes_usados.add(nome)

    # 1. nos do grafo
    for n in grafo['nodes']:
        c = n.get('community')
        if c in nomes:
            n['community_name'] = nomes[c]
    GRAFO.write_text(json.dumps(grafo, ensure_ascii=False), encoding='utf-8')

    # 2. arquivo de rotulos que o visualizador le
    ROTULOS_RUNTIME.write_text(
        json.dumps({str(k): v for k, v in sorted(nomes.items())}, ensure_ascii=False, indent=1),
        encoding='utf-8')

    # 3. relatorio
    trocas = 0
    if RELATORIO.exists():
        texto = RELATORIO.read_text(encoding='utf-8')
        texto, trocas = re.subn(r'\bCommunity (\d+)\b',
                                lambda m: nomes.get(int(m.group(1)), m.group(0)), texto)
        texto = re.sub(r'^### (.+?) - "\1"$', r'### \1', texto, flags=re.M)
        RELATORIO.write_text(texto, encoding='utf-8')

    total = len(por_id)
    print('comunidades no grafo: {} | nomeadas: {} | sem nome: {}'.format(
        total, len(nomes), total - len(nomes)))
    print('substituicoes no relatorio:', trocas)
    if total - len(nomes):
        print('  As sem nome ficam como "Community N" - o agrupamento mudou o bastante')
        print('  para a amostra guardada nao bater. Nomeie a mao e rode `salvar` de novo.')


if __name__ == '__main__':
    modo = sys.argv[1] if len(sys.argv) > 1 else ''
    if modo == 'salvar':
        salvar()
    elif modo == 'aplicar':
        aplicar()
    else:
        sys.exit('uso: python .graphify/labels.py [salvar|aplicar]')
