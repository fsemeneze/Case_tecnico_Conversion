#!/usr/bin/env python3
"""Diagnóstico e normalização da base `controle_entregas.csv`.

Objetivo (Fase 1 do case): medir o que está errado na planilha de forma
reprodutível, aplicar as regras de limpeza e gerar uma base normalizada que
servirá de entrada para a modelagem Postgres (Fase 2).

Uso:
    python analysis/diagnostico.py
    python analysis/diagnostico.py --csv dados/controle_entregas.csv --out analysis/out

Saídas (em `--out`):
    relatorio_diagnostico.md   relatório com os números do diagnóstico
    metricas.json              métricas em formato de máquina
    entregas_normalizadas.csv  base limpa, pronta para importação
    erros_qualidade.csv        um registro por problema encontrado (fila de revisão)
    mapa_status.csv            mapeamento status original -> fase normalizada

Premissas e regras de decisão estão em `docs/decisoes.md`.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable

# --------------------------------------------------------------------------
# Constantes de negócio
# --------------------------------------------------------------------------

# Campos de data: formatos aceitos -> (nome, exemplo)
EXCEL_EPOCH = date(1899, 12, 30)

MESES = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}

TIPOS_VALIDOS = ("Relatório", "Análise", "Conteúdo")

# Grafias de cliente que claramente representam a mesma empresa.
# O restante é agrupado pelo slug do nome (sem acento, minúsculo).
ALIASES_CLIENTE = {
    "loja alfa": "Loja Alfa",
    "loja alfa ltda": "Loja Alfa",
    "technova": "TechNova Software",
    "technova software": "TechNova Software",
    "grupo vertice saude": "Grupo Vértice Saúde",
    "vertice saude": "Grupo Vértice Saúde",
}

STATUS_MAP = {
    # produção
    "em producao": "em_producao",
    "em andamento": "em_producao",
    "fazendo": "em_producao",
    # espera
    "aguardando cliente": "aguardando_cliente",
    "com o cliente": "aguardando_aprovacao_entrega",
    "entrega em aprovacao": "aguardando_aprovacao_entrega",
    "aguardando aprovacao": "aguardando_aprovacao_entrega",
    # desvios
    "ajuste solicitado": "ajuste_solicitado",
    "voltou pra ajuste": "ajuste_solicitado",
    "cancelado": "cancelada",
    # entregue (declarado)
    "entregue": "entregue",
    "enviado": "entregue",
    # aprovado (declarado) — a decisão final é refinada pela coluna de aprovação
    "aprovado": "aprovada",
    "aprovado pelo cliente": "aprovada",
    "ok": "aprovada",
    "finalizado": "aprovada",
}

STATUS_APROVATORIOS = {"aprovada"}
STATUS_FINAIS = {"aprovada", "entregue", "cancelada"}

APROVACAO_MAP = {
    "sim": "aprovada",
    "s": "aprovada",
    "ok": "aprovada",
    "aprovado c/ ressalvas": "aprovada_com_ressalvas",
    "nao": "recusada",
    "nao se aplica": "nao_aplica",
    "n/a": "nao_aplica",
}

APROVACAO_APROVADA = {"aprovada", "aprovada_com_ressalvas"}

REVISOES_ESPECIAIS = {
    "duas": 2,
    "2x": 2,
}

SQUAD_ORDEM = ("Squad Azul", "Squad Verde", "Squad Laranja")

# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------


def slug(valor: str) -> str:
    """Minúsculas, sem acento, espaços colapsados."""
    if valor is None:
        return ""
    texto = unicodedata.normalize("NFKD", valor)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = texto.replace("-", " ").replace("_", " ")
    return re.sub(r"\s+", " ", texto).strip().lower()


def ler_csv(caminho: Path) -> list[dict[str, str]]:
    with caminho.open(encoding="utf-8-sig", newline="") as arquivo:
        return [dict(linha) for linha in csv.DictReader(arquivo)]


def escrever_csv(caminho: Path, linhas: Iterable[dict], colunas: list[str]) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with caminho.open("w", encoding="utf-8", newline="") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=colunas, extrasaction="ignore")
        escritor.writeheader()
        for linha in linhas:
            escritor.writerow(linha)


def parse_data(bruto: str, referencia: date | None) -> tuple[date | None, str]:
    """Interpreta os quatro formatos da base.

    Retorna (data, observacao). observacao vazia = formato reconhecido.
    Formatos: dd/mm/aaaa, ISO, serial do Excel, "dd/mmm" (ano inferido).
    """
    texto = (bruto or "").strip()
    if not texto:
        return None, "vazio"

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", texto):
        try:
            return date.fromisoformat(texto), ""
        except ValueError:
            return None, "iso_invalida"

    if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", texto):
        dia, mes, ano = (int(p) for p in texto.split("/"))
        try:
            return date(ano, mes, dia), ""
        except ValueError:
            return None, "data_invalida"

    if re.fullmatch(r"\d{5}", texto):
        serial = int(texto)
        if 30000 <= serial <= 60000:  # jan/1982 .. nov/2064
            return EXCEL_EPOCH + timedelta(days=serial), "serial_excel"

    if re.fullmatch(r"\d{1,2}/[A-Za-zÀ-ÿ]{3,4}(/\d{2,4})?", texto):
        partes = texto.split("/")
        dia = int(partes[0])
        mes = MESES.get(slug(partes[1])[:3])
        if not mes:
            return None, "mes_desconhecido"
        if len(partes) == 3:
            ano = int(partes[2])
            ano = ano + 2000 if ano < 100 else ano
            try:
                return date(ano, mes, dia), "texto_com_ano"
            except ValueError:
                return None, "data_invalida"
        if referencia is None:
            return None, "texto_sem_referencia"
        # Escolhe o ano que deixa a data mais próxima e não muito no passado.
        candidatos = []
        for ano in (referencia.year - 1, referencia.year, referencia.year + 1):
            try:
                candidato = date(ano, mes, dia)
            except ValueError:
                continue
            candidatos.append(candidato)
        if not candidatos:
            return None, "data_invalida"
        candidato = min(candidatos, key=lambda d: abs((d - referencia).days))
        return candidato, "texto_ano_inferido"

    return None, "formato_desconhecido"


def parse_aprovacao(bruto: str) -> tuple[str, str]:
    """Normaliza as colunas aprovado_planejamento / aprovado_entrega."""
    texto = slug(bruto)
    if not texto:
        return "nao_informado", "vazio"
    if texto in APROVACAO_MAP:
        return APROVACAO_MAP[texto], ""
    return "nao_informado", "valor_desconhecido"


def parse_revisoes(bruto: str) -> tuple[int | None, str]:
    # Atenção: não usar slug aqui — ele troca "-" por espaço e "-1" viraria 1.
    texto = (bruto or "").strip()
    if not texto:
        return None, "vazio"
    chave = texto.lower()
    if chave in REVISOES_ESPECIAIS:
        return REVISOES_ESPECIAIS[chave], "texto_convertido"
    if re.fullmatch(r"-?\d+", texto):
        numero = int(texto)
        if numero < 0:
            return None, "negativo"
        if numero > 10:
            return None, "outlier"
        return numero, ""
    return None, "texto_nao_numerico"


def subtipo_analise(titulo: str, tipo_slug: str) -> str:
    titulo_slug = slug(titulo)
    if "core web vitals" in titulo_slug:
        return "Core Web Vitals"
    if "backlink" in titulo_slug:
        return "Backlinks"
    if "indexacao" in titulo_slug:
        return "Indexação"
    if "concorrencia" in titulo_slug:
        return "Concorrência"
    if "mapeamento" in titulo_slug:
        return "Mapeamento de conteúdo"
    if "palavras chave" in titulo_slug:
        return "Palavras-chave"
    if tipo_slug == "auditoria":
        return "Auditoria técnica do site"
    return "Análise não especificada"


def classificar_tipo(tipo_bruto: str, titulo: str) -> tuple[str, str | None, str]:
    """Retorna (tipo, subtipo, origem). origem = 'declarado' | 'inferido'."""
    tipo_slug = slug(tipo_bruto)
    if not tipo_slug:
        titulo_slug = slug(titulo)
        if "relatorio" in titulo_slug:
            return "Relatório", None, "inferido"
        if "palavras chave" in titulo_slug:
            return "Análise", "Palavras-chave", "inferido"
        if titulo_slug.startswith("artigo"):
            return "Conteúdo", "Artigo", "inferido"
        return "Indefinido", None, "inferido"

    if "relat" in tipo_slug:
        return "Relatório", None, "declarado"
    if tipo_slug in {"artigo", "conteudo", "conteudo blog"}:
        return "Conteúdo", "Artigo", "declarado"
    if tipo_slug in {"analise", "analise tecnica", "auditoria"}:
        return "Análise", subtipo_analise(titulo, tipo_slug), "declarado"
    return "Indefinido", None, "inferido"


# --------------------------------------------------------------------------
# Normalização
# --------------------------------------------------------------------------


def canonizar_clientes(linhas: list[dict]) -> dict[str, str]:
    """Agrupa grafias e escolhe um nome canônico por grupo."""
    grupos: dict[str, Counter] = defaultdict(Counter)
    for linha in linhas:
        original = (linha.get("cliente") or "").strip()
        chave = slug(original)
        grupos[chave][original] += 1

    mapa: dict[str, str] = {}
    for chave, grafias in grupos.items():
        mapa[chave] = ALIASES_CLIENTE.get(chave) or grafias.most_common(1)[0][0]
    return mapa


def normalizar(linhas: list[dict]) -> tuple[list[dict], list[dict], dict]:
    mapa_clientes = canonizar_clientes(linhas)

    ids = Counter((l.get("id") or "").strip() for l in linhas)
    links = Counter(
        (l.get("link") or "").strip()
        for l in linhas
        if (l.get("link") or "").strip().startswith("http")
    )
    assinaturas = Counter(
        (
            slug(l.get("cliente") or ""),
            (l.get("titulo") or "").strip(),
            (l.get("data_solicitacao") or "").strip(),
            (l.get("data_entrega") or "").strip(),
        )
        for l in linhas
    )

    normalizadas: list[dict] = []
    erros: list[dict] = []
    mapa_status_uso: Counter = Counter()
    contadores: Counter = Counter()

    def registrar(linha_id: str, codigo: str, detalhe: str, severidade: str = "aviso") -> None:
        contadores[codigo] += 1
        erros.append(
            {
                "id": linha_id,
                "codigo": codigo,
                "severidade": severidade,
                "detalhe": detalhe,
            }
        )

    for linha in linhas:
        linha_id = (linha.get("id") or "").strip()
        cliente_original = (linha.get("cliente") or "").strip()
        cliente = mapa_clientes.get(slug(cliente_original), cliente_original)

        # Datas em três passos: primeiro as que têm ano explícito servem de âncora,
        # depois os textos curtos ("10/nov") inferem o ano pela data mais próxima.
        prevista_base, _ = parse_data(linha.get("data_prevista", ""), None)
        entrega_base, _ = parse_data(linha.get("data_entrega", ""), None)
        ancora = prevista_base or entrega_base
        solicitacao, obs_sol = parse_data(linha.get("data_solicitacao", ""), ancora)
        prevista, obs_prev = parse_data(linha.get("data_prevista", ""), solicitacao or ancora)
        entrega, obs_ent = parse_data(linha.get("data_entrega", ""), prevista or solicitacao)

        tipo, subtipo, origem_tipo = classificar_tipo(
            linha.get("tipo_entrega", ""), linha.get("titulo", "")
        )

        status_bruto = (linha.get("status") or "").strip()
        status_slug = slug(status_bruto)
        status = STATUS_MAP.get(status_slug, "indefinido")

        aprov_plan, obs_plan = parse_aprovacao(linha.get("aprovado_planejamento", ""))
        aprov_ent, obs_ent_aprov = parse_aprovacao(linha.get("aprovado_entrega", ""))

        # Premissa registrada: em relatório, planejamento vazio = não se aplica.
        if aprov_plan == "nao_informado" and tipo == "Relatório":
            aprov_plan = "nao_aplica"

        # O texto do status pode indicar aprovação sem a coluna estar preenchida.
        if status == "aprovada" and aprov_ent in APROVACAO_APROVADA:
            pass
        elif status == "aprovada":
            # "ok"/"aprovado" sem aprovação explícita: fica como entregue.
            status = "entregue"
            registrar(
                linha_id,
                "status_aprovado_sem_aprovacao",
                f"status '{status_bruto}' sem aprovação de entrega registrada",
            )

        if status in {"aguardando_aprovacao_entrega", "aguardando_cliente"} and aprov_ent in APROVACAO_APROVADA:
            registrar(
                linha_id,
                "aprovacao_contraditoria",
                f"status '{status_bruto}' com aprovação de entrega '{linha.get('aprovado_entrega','')}'",
            )

        revisoes, obs_rev = parse_revisoes(linha.get("num_revisoes", ""))

        dias_atraso = None
        if entrega and prevista:
            dias_atraso = (entrega - prevista).days

        flags: list[str] = []
        if ids[linha_id] > 1:
            flags.append("id_duplicado")
            registrar(linha_id, "id_duplicado", f"id aparece {ids[linha_id]}x na base", "critico")
        assinatura = (
            slug(linha.get("cliente") or ""),
            (linha.get("titulo") or "").strip(),
            (linha.get("data_solicitacao") or "").strip(),
            (linha.get("data_entrega") or "").strip(),
        )
        if assinaturas[assinatura] > 1:
            flags.append("possivel_duplicata")
            registrar(linha_id, "possivel_duplicata", "mesmo cliente, título e datas de outra linha", "critico")

        link = (linha.get("link") or "").strip()
        if link.startswith("http") and links[link] > 1:
            flags.append("link_repetido")
            registrar(linha_id, "link_repetido", f"link usado em {links[link]} linhas", "critico")
        if not link:
            flags.append("sem_link")
            registrar(linha_id, "sem_link", "entrega sem link de arquivo", "aviso")
        elif not link.startswith("http"):
            flags.append("link_textual")
            registrar(linha_id, "link_textual", f"link não é URL: '{link}'", "aviso")

        if cliente_original and slug(cliente_original) != slug(cliente):
            flags.append("cliente_grafia_variante")

        for campo, obs, valor in (
            ("data_solicitacao", obs_sol, linha.get("data_solicitacao", "")),
            ("data_prevista", obs_prev, linha.get("data_prevista", "")),
            ("data_entrega", obs_ent, linha.get("data_entrega", "")),
        ):
            if obs and obs != "vazio":
                flags.append(f"{campo}_{obs}")
                severidade = "critico" if "invalida" in obs else "aviso"
                registrar(linha_id, f"{campo}_{obs}", f"valor '{valor}'", severidade)

        if obs_rev:
            flags.append(f"revisoes_{obs_rev}")
            registrar(linha_id, f"revisoes_{obs_rev}", f"valor '{linha.get('num_revisoes','')}'")

        if status == "indefinido":
            flags.append("status_desconhecido")
            registrar(linha_id, "status_desconhecido", f"status '{status_bruto}'", "critico")

        if origem_tipo == "inferido":
            flags.append("tipo_inferido")
            registrar(linha_id, "tipo_inferido", f"tipo '{linha.get('tipo_entrega','')}' vazio ou inválido")

        if status in {"aprovada", "entregue"} and not entrega:
            flags.append("concluida_sem_data_entrega")
            registrar(linha_id, "concluida_sem_data_entrega", "estado final sem data de entrega", "critico")

        if entrega and solicitacao and entrega < solicitacao:
            flags.append("entrega_antes_solicitacao")
            registrar(linha_id, "entrega_antes_solicitacao", f"{entrega} < {solicitacao}", "critico")

        if entrega and entrega > date(2026, 10, 31):
            flags.append("entrega_fora_janela")
            registrar(linha_id, "entrega_fora_janela", f"data de entrega {entrega} após out/2026")

        if status == "cancelada" and link.startswith("http"):
            flags.append("cancelada_com_link")
            registrar(linha_id, "cancelada_com_link", "entrega cancelada mas com arquivo publicado")

        if obs_plan or obs_ent_aprov:
            if "valor_desconhecido" in (obs_plan, obs_ent_aprov):
                flags.append("aprovacao_valor_desconhecido")

        if aprov_ent in APROVACAO_APROVADA and status not in {"aprovada", "cancelada"}:
            flags.append("aprovacao_sem_status_final")

        mapa_status_uso[(status_bruto, status)] += 1

        normalizadas.append(
            {
                "legacy_id": linha_id,
                "cliente": cliente,
                "cliente_original": cliente_original,
                "tipo": tipo,
                "subtipo": subtipo or "",
                "titulo": (linha.get("titulo") or "").strip(),
                "squad": (linha.get("squad") or "").strip(),
                "responsavel": (linha.get("responsavel") or "").strip(),
                "data_solicitacao": solicitacao.isoformat() if solicitacao else "",
                "data_prevista": prevista.isoformat() if prevista else "",
                "data_entrega": entrega.isoformat() if entrega else "",
                "status_original": status_bruto,
                "status_normalizado": status,
                "aprovacao_planejamento": aprov_plan,
                "aprovacao_entrega": aprov_ent,
                "num_revisoes": "" if revisoes is None else revisoes,
                "link": link,
                "observacoes": (linha.get("observacoes") or "").strip(),
                "dias_atraso": "" if dias_atraso is None else dias_atraso,
                "flags": "|".join(sorted(set(flags))),
            }
        )

    metricas = {
        "contadores": dict(contadores),
        "ids_duplicados_distintos": sum(1 for v in ids.values() if v > 1),
        "links_repetidos_distintos": sum(1 for v in links.values() if v > 1),
        "mapa_status": [
            {"status_original": original, "status_normalizado": novo, "linhas": total}
            for (original, novo), total in sorted(mapa_status_uso.items(), key=lambda i: -i[1])
        ],
    }
    return normalizadas, erros, metricas


# --------------------------------------------------------------------------
# Métricas e relatório
# --------------------------------------------------------------------------


def calcular_metricas(linhas: list[dict], brutas: list[dict], extras: dict, erros: list[dict]) -> dict:
    total = len(linhas)
    hoje = date.today()

    def contar(campo: str) -> Counter:
        return Counter(l[campo] for l in linhas)

    comparaveis = [l for l in linhas if l["data_prevista"] and l["data_entrega"]]
    atrasadas = [l for l in comparaveis if l["dias_atraso"] != "" and int(l["dias_atraso"]) > 0]
    atrasos = sorted(int(l["dias_atraso"]) for l in atrasadas)

    faixas_atraso = [
        ("1 a 3 dias", lambda n: 1 <= n <= 3),
        ("4 a 7 dias", lambda n: 4 <= n <= 7),
        ("8 a 14 dias", lambda n: 8 <= n <= 14),
        ("15 a 30 dias", lambda n: 15 <= n <= 30),
        ("31+ dias", lambda n: n >= 31),
    ]
    distribuicao_atraso = {
        rotulo: sum(1 for n in atrasos if filtro(n)) for rotulo, filtro in faixas_atraso
    }

    abertas = [l for l in linhas if l["status_normalizado"] not in STATUS_FINAIS]
    em_atraso_agora = [
        l for l in abertas
        if l["data_prevista"] and date.fromisoformat(l["data_prevista"]) < hoje
    ]

    def taxa_atraso(grupo: list[dict]) -> str:
        if not grupo:
            return "—"
        return f"{len(grupo) / len(comparaveis) * 100:.1f}%"

    por_tipo = {}
    for tipo in TIPOS_VALIDOS + ("Indefinido",):
        do_tipo = [l for l in comparaveis if l["tipo"] == tipo]
        atrasadas_tipo = [l for l in do_tipo if l["dias_atraso"] != "" and int(l["dias_atraso"]) > 0]
        por_tipo[tipo] = {
            "entregas": sum(1 for l in linhas if l["tipo"] == tipo),
            "comparaveis": len(do_tipo),
            "atrasadas": len(atrasadas_tipo),
            "taxa": round(len(atrasadas_tipo) / len(do_tipo) * 100, 1) if do_tipo else None,
        }

    por_squad = {}
    for squad in SQUAD_ORDEM:
        do_squad = [l for l in comparaveis if l["squad"] == squad]
        atrasadas_squad = [l for l in do_squad if l["dias_atraso"] != "" and int(l["dias_atraso"]) > 0]
        por_squad[squad] = {
            "entregas": sum(1 for l in linhas if l["squad"] == squad),
            "comparaveis": len(do_squad),
            "atrasadas": len(atrasadas_squad),
            "taxa": round(len(atrasadas_squad) / len(do_squad) * 100, 1) if do_squad else None,
        }

    por_cliente: dict[str, dict] = {}
    for linha in linhas:
        dado = por_cliente.setdefault(linha["cliente"], {"entregas": 0, "comparaveis": 0, "atrasadas": 0})
        dado["entregas"] += 1
        if linha["data_prevista"] and linha["data_entrega"]:
            dado["comparaveis"] += 1
            if int(linha["dias_atraso"]) > 0:
                dado["atrasadas"] += 1
    clientes_ordenados = sorted(
        por_cliente.items(),
        key=lambda item: (-item[1]["atrasadas"], -item[1]["entregas"]),
    )

    observacoes = Counter()
    for linha in linhas:
        texto = slug(linha["observacoes"])
        if not texto:
            continue
        if "cancelad" in texto or "suspenso" in texto or "nao fazer" in texto:
            observacoes["cancelamento/suspensão"] += 1
        elif "reaberto" in texto or "reprovou" in texto or "refacao" in texto or "ajuste" in texto:
            observacoes["revisão/refação"] += 1
        elif "prazo renegociado" in texto:
            observacoes["prazo renegociado"] += 1
        elif "juridico" in texto:
            observacoes["revisão jurídica do cliente"] += 1
        elif "saiu" in texto:
            observacoes["pessoa saiu da empresa"] += 1
        elif "redistribuir" in texto:
            observacoes["pedido de redistribuição"] += 1
        elif "contrato" in texto:
            observacoes["regra contratual de prazo"] += 1
        else:
            observacoes["outra"] += 1

    datas = [d for l in linhas for d in (l["data_solicitacao"], l["data_entrega"]) if d]

    # Ciclo solicitação -> entrega
    ciclos = sorted(
        (date.fromisoformat(l["data_entrega"]) - date.fromisoformat(l["data_solicitacao"])).days
        for l in linhas
        if l["data_solicitacao"] and l["data_entrega"]
    )
    ciclo_por_tipo = {}
    for tipo in TIPOS_VALIDOS:
        do_tipo = sorted(
            (date.fromisoformat(l["data_entrega"]) - date.fromisoformat(l["data_solicitacao"])).days
            for l in linhas
            if l["tipo"] == tipo and l["data_solicitacao"] and l["data_entrega"]
        )
        ciclo_por_tipo[tipo] = {
            "amostra": len(do_tipo),
            "mediana_dias": do_tipo[len(do_tipo) // 2] if do_tipo else None,
        }

    # Revisões: distribuição e relação com atraso
    distribuicao_revisoes = Counter(
        l["num_revisoes"] for l in linhas if l["num_revisoes"] != ""
    )
    revisoes_atraso = {}
    for faixa, filtro in (
        ("0 revisões", lambda n: n == 0),
        ("1 revisão", lambda n: n == 1),
        ("2+ revisões", lambda n: n >= 2),
    ):
        do_faixa = [
            l for l in comparaveis
            if l["num_revisoes"] != "" and filtro(int(l["num_revisoes"]))
        ]
        atrasadas_faixa = [l for l in do_faixa if int(l["dias_atraso"]) > 0]
        revisoes_atraso[faixa] = {
            "comparaveis": len(do_faixa),
            "atrasadas": len(atrasadas_faixa),
            "taxa": round(len(atrasadas_faixa) / len(do_faixa) * 100, 1) if do_faixa else None,
        }

    fila_revisao = len({e["id"] for e in erros if e["severidade"] == "critico"})
    criticos = [e for e in erros if e["severidade"] == "critico"]
    qualidade = {
        "ocorrencias": len(erros),
        "linhas_distintas": len({e["id"] for e in erros}),
        "ocorrencias_criticas": len(criticos),
        "linhas_criticas": len({e["id"] for e in criticos}),
    }

    resumo_flags = Counter()
    for linha in linhas:
        for flag in filter(None, linha["flags"].split("|")):
            resumo_flags[flag] += 1

    return {
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
        "arquivo_origem": extras.get("arquivo", ""),
        "data_referencia": hoje.isoformat(),
        "total_linhas_origem": len(brutas),
        "total_linhas_normalizadas": total,
        "periodo": {"min": min(datas) if datas else "", "max": max(datas) if datas else ""},
        "clientes_brutos": len({(l.get("cliente") or "").strip() for l in brutas}),
        "clientes_canonicos": len({l["cliente"] for l in linhas}),
        "squads": dict(contar("squad")),
        "responsaveis": dict(contar("responsavel")),
        "tipos": dict(contar("tipo")),
        "subtipos_analise": dict(
            Counter(l["subtipo"] for l in linhas if l["tipo"] == "Análise")
        ),
        "status_normalizados": dict(contar("status_normalizado")),
        "aprovacao_planejamento": dict(contar("aprovacao_planejamento")),
        "aprovacao_entrega": dict(contar("aprovacao_entrega")),
        "atraso": {
            "comparaveis": len(comparaveis),
            "atrasadas": len(atrasadas),
            "taxa": round(len(atrasadas) / len(comparaveis) * 100, 1) if comparaveis else None,
            "dias_mediana": atrasos[len(atrasos) // 2] if atrasos else None,
            "dias_p90": atrasos[int(len(atrasos) * 0.9)] if atrasos else None,
            "dias_maximo": atrasos[-1] if atrasos else None,
            "sem_data_prevista": sum(1 for l in linhas if not l["data_prevista"]),
            "sem_data_entrega": sum(1 for l in linhas if not l["data_entrega"]),
            "abertas_em_atraso_hoje": len(em_atraso_agora),
            "distribuicao_faixas": distribuicao_atraso,
        },
        "por_tipo": por_tipo,
        "por_squad": por_squad,
        "top_clientes_atraso": [
            {"cliente": nome, **dados} for nome, dados in clientes_ordenados[:10]
        ],
        "observacoes": dict(observacoes),
        "flags": dict(resumo_flags.most_common()),
        "fila_revisao": fila_revisao,
        "qualidade": qualidade,
        "ids_duplicados_distintos": extras.get("ids_duplicados_distintos", 0),
        "links_repetidos_distintos": extras.get("links_repetidos_distintos", 0),
        "ciclo": {
            "amostra": len(ciclos),
            "mediana_dias": ciclos[len(ciclos) // 2] if ciclos else None,
            "p90_dias": ciclos[int(len(ciclos) * 0.9)] if ciclos else None,
            "por_tipo": ciclo_por_tipo,
        },
        "revisoes": {
            "distribuicao": dict(sorted(distribuicao_revisoes.items())),
            "por_faixa": revisoes_atraso,
        },
        "contadores_qualidade": extras.get("contadores", {}),
        "mapa_status": extras.get("mapa_status", []),
    }


def moeda(valor) -> str:
    return "—" if valor is None else str(valor).replace(".", ",")


def gerar_relatorio(metricas: dict) -> str:
    atraso = metricas["atraso"]
    flags = metricas["flags"]
    c = metricas["contadores_qualidade"]
    q = metricas["qualidade"]

    linhas_tipo = "\n".join(
        f"| {tipo} | {dados['entregas']} | {dados['comparaveis']} | {dados['atrasadas']} | {moeda(dados['taxa'])}% |"
        for tipo, dados in metricas["por_tipo"].items()
        if dados["entregas"] > 0
    )
    linhas_squad = "\n".join(
        f"| {squad} | {dados['entregas']} | {dados['comparaveis']} | {dados['atrasadas']} | {moeda(dados['taxa'])}% |"
        for squad, dados in metricas["por_squad"].items()
    )
    linhas_clientes = "\n".join(
        f"| {c_['cliente']} | {c_['entregas']} | {c_['atrasadas']} |"
        for c_ in metricas["top_clientes_atraso"]
    )
    linhas_status = "\n".join(
        f"| {s['status_original'] or '(vazio)'} | `{s['status_normalizado']}` | {s['linhas']} |"
        for s in metricas["mapa_status"]
    )
    linhas_obs = "\n".join(
        f"| {nome} | {total} |" for nome, total in metricas["observacoes"].items()
    )
    linhas_ciclo = "\n".join(
        f"| {tipo} | {dados['amostra']} | {moeda(dados['mediana_dias'])} |"
        for tipo, dados in metricas["ciclo"]["por_tipo"].items()
    )
    linhas_revisoes = "\n".join(
        f"| {faixa} | {dados['comparaveis']} | {dados['atrasadas']} | {moeda(dados['taxa'])}% |"
        for faixa, dados in metricas["revisoes"]["por_faixa"].items()
    )
    linhas_atraso_dist = "\n".join(
        f"| {faixa} | {total} |"
        for faixa, total in metricas["atraso"]["distribuicao_faixas"].items()
    )
    linhas_flags = "\n".join(
        f"| `{flag}` | {total} |" for flag, total in metricas["flags"].items()
    )

    return f"""# Diagnóstico dos dados — controle de entregas

Gerado automaticamente por `analysis/diagnostico.py` em {metricas['gerado_em']}.
Arquivo de origem: `{metricas['arquivo_origem']}`.
Data de referência para "em atraso hoje": **{metricas['data_referencia']}**.

## 1. Visão geral

| Indicador | Valor |
| :--- | ---: |
| Linhas na base | {metricas['total_linhas_origem']} |
| Linhas normalizadas | {metricas['total_linhas_normalizadas']} |
| Período das datas (solicitação e entrega) | {metricas['periodo']['min']} a {metricas['periodo']['max']} |
| Grafias de cliente | {metricas['clientes_brutos']} |
| Clientes após normalização | {metricas['clientes_canonicos']} |
| Squads | {len(metricas['squads'])} |
| Responsáveis | {len(metricas['responsaveis'])} |

## 2. Atraso — a dor principal

| Indicador | Valor |
| :--- | ---: |
| Entregas com prazo e data de entrega (comparáveis) | {atraso['comparaveis']} |
| Entregas após o prazo | {atraso['atrasadas']} |
| **Taxa de atraso** | **{moeda(atraso['taxa'])}%** |
| Mediana dos dias de atraso | {moeda(atraso['dias_mediana'])} |
| P90 dos dias de atraso | {moeda(atraso['dias_p90'])} |
| Atraso máximo | {moeda(atraso['dias_maximo'])} |
| Entregas sem data prevista | {atraso['sem_data_prevista']} |
| Entregas sem data de entrega | {atraso['sem_data_entrega']} |
| Entregas abertas com prazo vencido hoje | {atraso['abertas_em_atraso_hoje']} |

### Distribuição do atraso (dias)

| Faixa | Entregas |
| :--- | ---: |
{linhas_atraso_dist}

### Por tipo de entrega

| Tipo | Entregas | Comparáveis | Atrasadas | Taxa |
| :--- | ---: | ---: | ---: | ---: |
{linhas_tipo}

### Por squad

| Squad | Entregas | Comparáveis | Atrasadas | Taxa |
| :--- | ---: | ---: | ---: | ---: |
{linhas_squad}

### Clientes com mais entregas atrasadas

| Cliente | Entregas | Atrasadas |
| :--- | ---: | ---: |
{linhas_clientes}

## 3. Ciclo de entrega e revisões

| Indicador | Valor |
| :--- | ---: |
| Entregas com data de solicitação e de entrega | {metricas['ciclo']['amostra']} |
| Mediana do ciclo (dias) | {moeda(metricas['ciclo']['mediana_dias'])} |
| P90 do ciclo (dias) | {moeda(metricas['ciclo']['p90_dias'])} |

| Tipo | Amostra | Mediana do ciclo (dias) |
| :--- | ---: | ---: |
{linhas_ciclo}

Distribuição do número de revisões: {json.dumps(metricas['revisoes']['distribuicao'], ensure_ascii=False)}

| Faixa de revisões | Comparáveis | Atrasadas | Taxa de atraso |
| :--- | ---: | ---: | ---: |
{linhas_revisoes}

## 4. Qualidade dos dados

| Problema | Ocorrências |
| :--- | ---: |
| IDs duplicados | {c.get('id_duplicado', 0)} linhas ({metricas['ids_duplicados_distintos']} IDs distintos) |
| Possíveis duplicatas (cliente + título + datas) | {c.get('possivel_duplicata', 0)} linhas |
| Links repetidos | {c.get('link_repetido', 0)} linhas ({metricas['links_repetidos_distintos']} links distintos) |
| Sem link de arquivo | {c.get('sem_link', 0)} |
| Link textual ("no e-mail", "ver drive", "pasta do cliente") | {c.get('link_textual', 0)} |
| Status desconhecido | {c.get('status_desconhecido', 0)} |
| Tipo inferido (vazio ou inválido) | {c.get('tipo_inferido', 0)} |
| Concluída sem data de entrega | {c.get('concluida_sem_data_entrega', 0)} |
| Entrega antes da solicitação | {c.get('entrega_antes_solicitacao', 0)} |
| Entrega fora da janela (após out/2026) | {c.get('entrega_fora_janela', 0)} |
| Cancelada com arquivo publicado | {c.get('cancelada_com_link', 0)} |
| Status "aprovado" sem aprovação registrada | {c.get('status_aprovado_sem_aprovacao', 0)} |
| Aprovação contraditória com o status | {c.get('aprovacao_contraditoria', 0)} |
| **Linhas em fila de revisão (algum problema crítico)** | **{metricas['fila_revisao']}** |

Ocorrências contam registros de problema; linhas contam entregas distintas.
São {q['ocorrencias']} ocorrências em {q['linhas_distintas']} linhas;
{q['ocorrencias_criticas']} ocorrências críticas em {q['linhas_criticas']} linhas.

### Todos os códigos de qualidade encontrados

| Código | Linhas |
| :--- | ---: |
{linhas_flags}

## 5. Status: como a planilha fala e como o app passa a falar

A coluna `status` mistura fase de produção, espera e aprovação. O mapeamento abaixo
separa as duas dimensões (fase + aprovação). A lista completa está em `mapa_status.csv`.

| Status original | Fase normalizada | Linhas |
| :--- | :--- | ---: |
{linhas_status}

Aprovação de planejamento após normalização:
{json.dumps(metricas['aprovacao_planejamento'], ensure_ascii=False, indent=2)}

Aprovação de entrega após normalização:
{json.dumps(metricas['aprovacao_entrega'], ensure_ascii=False, indent=2)}

## 6. Tipos e subtipos

- Tipos normalizados: {json.dumps(metricas['tipos'], ensure_ascii=False)}
- Subtipos de Análise: {json.dumps(metricas['subtipos_analise'], ensure_ascii=False)}

## 7. Observações livres

{len(metricas['observacoes'])} categorias identificadas; as demais linhas não têm observação.

| Categoria | Linhas |
| :--- | ---: |
{linhas_obs}

## 8. Conclusões para o produto

1. **Atraso não é medível hoje**: {moeda(atraso['taxa'])}% das entregas comparáveis
   passaram do prazo. O app precisa calcular atraso a partir de `data_prevista` e
   `data_entrega`, e tratar "em aberto com prazo vencido" como estado próprio.
2. **Status não responde "onde está a entrega"**: são {len(metricas['mapa_status'])} valores
   distintos de status para {len(set(s['status_normalizado'] for s in metricas['mapa_status']))} fases reais.
   A separação entre fase e aprovação é o que permite rastrear o processo.
3. **A base tem duplicidade real**: {metricas['ids_duplicados_distintos']} IDs repetidos
   ({c.get('id_duplicado', 0)} linhas) e {c.get('possivel_duplicata', 0)} linhas com assinatura
   idêntica. Nada pode ser apagado sem revisão; a importação precisa de uma fila de revisão.
4. **Cliente não é uma dimensão confiável sem normalização**: {metricas['clientes_brutos']}
   grafias para {metricas['clientes_canonicos']} clientes.
5. **O cliente não tem visibilidade**: não existe status voltado ao cliente nem registro
   de aprovação com autor e data. O fluxo de aprovação por link resolve isso.
"""


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnóstico da base de entregas")
    raiz = Path(__file__).resolve().parent.parent
    parser.add_argument("--csv", type=Path, default=raiz / "dados" / "controle_entregas.csv")
    parser.add_argument("--out", type=Path, default=raiz / "analysis" / "out")
    parser.add_argument("--reporte", type=Path, default=raiz / "analysis" / "out" / "relatorio_diagnostico.md")
    args = parser.parse_args()

    if not args.csv.exists():
        print(f"Arquivo não encontrado: {args.csv}")
        return 1

    brutas = ler_csv(args.csv)
    normalizadas, erros, extras = normalizar(brutas)
    extras["arquivo"] = (
        str(args.csv.relative_to(raiz)).replace("\\", "/")
        if args.csv.is_relative_to(raiz)
        else str(args.csv).replace("\\", "/")
    )
    metricas = calcular_metricas(normalizadas, brutas, extras, erros)

    args.out.mkdir(parents=True, exist_ok=True)

    colunas = [
        "legacy_id", "cliente", "cliente_original", "tipo", "subtipo", "titulo",
        "squad", "responsavel", "data_solicitacao", "data_prevista", "data_entrega",
        "status_original", "status_normalizado", "aprovacao_planejamento",
        "aprovacao_entrega", "num_revisoes", "link", "observacoes", "dias_atraso", "flags",
    ]
    escrever_csv(args.out / "entregas_normalizadas.csv", normalizadas, colunas)
    escrever_csv(args.out / "erros_qualidade.csv", erros, ["id", "codigo", "severidade", "detalhe"])
    escrever_csv(
        args.out / "mapa_status.csv",
        metricas["mapa_status"],
        ["status_original", "status_normalizado", "linhas"],
    )
    (args.out / "metricas.json").write_text(
        json.dumps(metricas, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    args.reporte.parent.mkdir(parents=True, exist_ok=True)
    args.reporte.write_text(gerar_relatorio(metricas), encoding="utf-8")

    print(f"Linhas lidas: {len(brutas)}")
    print(f"Linhas normalizadas: {len(normalizadas)}")
    print(f"Problemas registrados: {len(erros)}")
    print(f"Taxa de atraso: {metricas['atraso']['taxa']}% ({metricas['atraso']['atrasadas']}/{metricas['atraso']['comparaveis']})")
    print(f"CSVs em: {args.out}")
    print(f"Relatório em: {args.reporte}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
