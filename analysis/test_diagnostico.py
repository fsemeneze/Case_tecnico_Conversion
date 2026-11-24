"""Testes do diagnóstico (Fase 1).

Rodar:
    python -m unittest discover -s analysis -v
"""

from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import diagnostico as d  # noqa: E402


class TestDatas(unittest.TestCase):
    def test_dd_mm_aaaa(self):
        self.assertEqual(d.parse_data("10/11/2025", None)[0], date(2025, 11, 10))

    def test_iso(self):
        self.assertEqual(d.parse_data("2025-11-10", None)[0], date(2025, 11, 10))

    def test_serial_excel(self):
        # 45971 = 10/11/2025 na base 1899-12-30
        self.assertEqual(d.parse_data("45971", None)[0], date(2025, 11, 10))

    def test_texto_sem_ano_infere_pela_referencia(self):
        self.assertEqual(d.parse_data("10/nov", date(2025, 11, 1))[0], date(2025, 11, 10))

    def test_texto_sem_referencia_nao_inventa_data(self):
        data, obs = d.parse_data("10/nov", None)
        self.assertIsNone(data)
        self.assertEqual(obs, "texto_sem_referencia")

    def test_data_impossivel(self):
        self.assertIsNone(d.parse_data("31/02/2025", None)[0])

    def test_vazio(self):
        self.assertEqual(d.parse_data("", None), (None, "vazio"))


class TestAprovacoesERevisoes(unittest.TestCase):
    def test_variacoes_de_sim(self):
        for valor in ("Sim", "sim", "S", "ok", " SIM "):
            self.assertEqual(d.parse_aprovacao(valor)[0], "aprovada", valor)

    def test_ressalvas(self):
        self.assertEqual(
            d.parse_aprovacao("aprovado c/ ressalvas")[0], "aprovada_com_ressalvas"
        )

    def test_nao_aplica(self):
        self.assertEqual(d.parse_aprovacao("não se aplica")[0], "nao_aplica")
        self.assertEqual(d.parse_aprovacao("N/A")[0], "nao_aplica")

    def test_revisoes_texto(self):
        self.assertEqual(d.parse_revisoes("duas"), (2, "texto_convertido"))
        self.assertEqual(d.parse_revisoes("2x"), (2, "texto_convertido"))

    def test_revisoes_outlier_e_negativo(self):
        self.assertIsNone(d.parse_revisoes("99")[0])
        self.assertIsNone(d.parse_revisoes("-1")[0])

    def test_revisoes_ambiguas(self):
        self.assertIsNone(d.parse_revisoes("1 ou 2")[0])


class TestTipos(unittest.TestCase):
    def test_relatorio_com_grafias(self):
        for tipo in ("Relatório", "Relatorio", "relatório mensal"):
            self.assertEqual(d.classificar_tipo(tipo, "Relatório mensal 11/2025")[0], "Relatório")

    def test_conteudo_e_artigo(self):
        self.assertEqual(d.classificar_tipo("conteúdo blog", "Artigo: X")[:2], ("Conteúdo", "Artigo"))

    def test_analise_tecnica_usa_subtipo_do_titulo(self):
        self.assertEqual(
            d.classificar_tipo("Auditoria", "Análise de Core Web Vitals")[:2],
            ("Análise", "Core Web Vitals"),
        )

    def test_tipo_vazio_inferido_pelo_titulo(self):
        self.assertEqual(
            d.classificar_tipo("", "Pesquisa de palavras-chave")[:2],
            ("Análise", "Palavras-chave"),
        )


class TestBaseReal(unittest.TestCase):
    """Garante que o normalizador não perde linha nem cria status desconhecido."""

    @classmethod
    def setUpClass(cls):
        raiz = Path(__file__).resolve().parent.parent
        cls.brutas = d.ler_csv(raiz / "dados" / "controle_entregas.csv")
        cls.normalizadas, cls.erros, _ = d.normalizar(cls.brutas)

    def test_nenhuma_linha_perdida(self):
        self.assertEqual(len(self.normalizadas), len(self.brutas))
        self.assertEqual(len(self.brutas), 1007)

    def test_todos_os_clientes_canonicos(self):
        self.assertEqual(len({l["cliente"] for l in self.normalizadas}), 25)

    def test_nenhum_status_desconhecido(self):
        desconhecidos = [l for l in self.normalizadas if l["status_normalizado"] == "indefinido"]
        self.assertEqual(desconhecidos, [])

    def test_tipo_sempre_valido(self):
        invalidos = [l for l in self.normalizadas if l["tipo"] not in d.TIPOS_VALIDOS]
        self.assertEqual(invalidos, [])

    def test_revisoes_nao_negativas(self):
        ruins = [l for l in self.normalizadas if l["num_revisoes"] and int(l["num_revisoes"]) < 0]
        self.assertEqual(ruins, [])


if __name__ == "__main__":
    unittest.main()
