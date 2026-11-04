import assert from "node:assert/strict";
import { test } from "node:test";
import { contar, diaDeEnvio, montarRelatorio, proximoHorario, relatorioDevido, type Pacote } from "../src/luisa/contagem.ts";

const AGORA = new Date("2026-11-05T10:00:00-03:00");

function pacote(plataforma: Pacote["plataforma"], data_venda: string, limite_envio: string | null = null): Pacote {
  return { plataforma, pacote_id: "1", data_venda, limite_envio, logistica: null, situacao: null };
}

test("venda antes das 12:00 sai no mesmo dia", () => {
  assert.equal(diaDeEnvio("2026-11-04T11:59:00-03:00"), "2026-11-04");
});

test("venda às 12:00 em ponto já fica para o dia seguinte", () => {
  assert.equal(diaDeEnvio("2026-11-04T12:00:00-03:00"), "2026-11-05");
});

test("o dia seguinte vira o mês corretamente", () => {
  assert.equal(diaDeEnvio("2026-11-30T15:00:00-03:00"), "2026-12-01");
});

test("o corte usa o horário de Brasília, mesmo com outro fuso na data", () => {
  assert.equal(diaDeEnvio("2026-11-04T14:59:00+00:00"), "2026-11-04"); // 11:59 em Brasília
  assert.equal(diaDeEnvio("2026-11-04T15:00:00+00:00"), "2026-11-05"); // 12:00 em Brasília
});

test("separa atrasados, de hoje e próximos por plataforma", () => {
  const c = contar([
    pacote("shopee", "2026-11-03T10:00:00-03:00"),
    pacote("shopee", "2026-11-04T13:00:00-03:00"),
    pacote("shopee", "2026-11-05T09:00:00-03:00"),
    pacote("shopee", "2026-11-05T13:00:00-03:00"),
    pacote("mercado_livre", "2026-11-04T09:00:00-03:00"),
  ], AGORA);
  assert.deepEqual(
    { atrasados: c.shopee.atrasados, hoje: c.shopee.hoje, proximos: c.shopee.proximos },
    { atrasados: 1, hoje: 2, proximos: 1 },
  );
  assert.equal(c.mercado_livre.atrasados, 1);
});

test("conta quantos já venceram no prazo da própria plataforma", () => {
  const c = contar([
    pacote("shopee", "2026-11-03T10:00:00-03:00", "2026-11-05T09:59:00-03:00"),
    pacote("shopee", "2026-11-03T10:00:00-03:00", "2026-11-05T10:01:00-03:00"),
  ], AGORA);
  assert.equal(c.shopee.vencidosNaPlataforma, 1);
});

test("relatório da manhã mostra urgentes e o que sai hoje sem atraso", () => {
  const r = montarRelatorio("manha", {
    pacotes: [pacote("shopee", "2026-11-03T10:00:00-03:00"), pacote("mercado_livre", "2026-11-05T09:00:00-03:00")],
    erros: [],
  }, AGORA);
  assert.deepEqual(r.numeros, { urgentes: 1, enviarHoje: 1 });
  assert.match(r.texto, /Urgentes \(atrasados\): 1/);
  assert.match(r.texto, /Enviar ainda hoje, sem atraso: 1/);
});

test("relatório da noite mostra tudo o que ficou para trás", () => {
  const r = montarRelatorio("noite", {
    pacotes: [
      pacote("shopee", "2026-11-03T10:00:00-03:00"),
      pacote("shopee", "2026-11-05T09:00:00-03:00"),
      pacote("shopee", "2026-11-05T13:00:00-03:00"),
    ],
    erros: [],
  }, new Date("2026-11-05T19:30:00-03:00"));
  assert.deepEqual(r.numeros, { ficaramParaTras: 2 });
  assert.match(r.texto, /Ficaram para trás: 2/);
});

test("falha em uma plataforma vira aviso de relatório incompleto", () => {
  const r = montarRelatorio("manha", { pacotes: [], erros: ["shopee: fora do ar"] }, AGORA);
  assert.match(r.texto, /INCOMPLETO/);
  assert.deepEqual(r.avisos, ["shopee: fora do ar"]);
});

test("pacote sem data não some da conta", () => {
  const sem = { ...pacote("shopee", ""), data_venda: null };
  const r = montarRelatorio("manha", { pacotes: [sem], erros: [] }, AGORA);
  assert.deepEqual(r.numeros, { urgentes: 1, enviarHoje: 0 });
  assert.match(r.avisos.join(), /sem data/);
});

const horario = (h: string) => new Date(`2026-11-05T${h}:00-03:00`);

test("relatório da manhã fica devido a partir das 07:30", () => {
  assert.equal(relatorioDevido(horario("07:29"), new Set()), null);
  assert.equal(relatorioDevido(horario("07:30"), new Set()), "manha");
});

test("se o servidor reiniciou, a manhã ainda sai até o meio-dia", () => {
  assert.equal(relatorioDevido(horario("11:59"), new Set()), "manha");
  assert.equal(relatorioDevido(horario("12:00"), new Set()), null);
});

test("relatório da noite fica devido a partir das 19:05", () => {
  assert.equal(relatorioDevido(horario("19:04"), new Set()), null);
  assert.equal(relatorioDevido(horario("19:05"), new Set()), "noite");
});

test("relatório já feito no dia não repete", () => {
  assert.equal(relatorioDevido(horario("08:00"), new Set(["2026-11-05-manha"])), null);
  assert.equal(relatorioDevido(horario("20:00"), new Set(["2026-11-05-noite"])), null);
  assert.equal(relatorioDevido(horario("20:00"), new Set(["2026-11-04-noite"])), "noite");
});

test("o próximo horário muda ao longo do dia", () => {
  assert.equal(proximoHorario(horario("06:00")), "07:30");
  assert.equal(proximoHorario(horario("07:30")), "19:05");
  assert.equal(proximoHorario(horario("15:00")), "19:05");
  assert.equal(proximoHorario(horario("19:05")), "07:30");
});
