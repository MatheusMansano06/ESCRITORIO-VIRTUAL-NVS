import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { criarArmazem } from "../src/armazem.ts";
import { criarRafael, horarioDevido, proximoHorario, type LeituraAnuncios, type RelatorioRafael } from "../src/rafael/servico.ts";

const pasta = () => mkdtempSync(join(tmpdir(), "rafael-"));
const em = (hora: string) => new Date(`2026-11-05T${hora}:00-03:00`);
const LEITURA: LeituraAnuncios = {
  gerado_em: "2026-11-05T07:00:00-03:00",
  total_ativos: 410,
  anuncios: [{ sku: "SKU-1", mlb: "MLB1" }, { sku: null, mlb: "MLB2" }],
  erros: [],
};

function rafael(extra: Partial<Parameters<typeof criarRafael>[0]> = {}, hora = "07:10") {
  return criarRafael({
    lerAnuncios: async () => LEITURA,
    armazem: criarArmazem<RelatorioRafael>(pasta(), "rafael.json"),
    agora: () => em(hora),
    ...extra,
  });
}

test("cada relatório tem a sua janela no dia", () => {
  const nada = new Set<string>();
  assert.equal(horarioDevido(em("06:59"), nada), null);
  assert.equal(horarioDevido(em("07:00"), nada), "07:00");
  assert.equal(horarioDevido(em("11:59"), nada), "07:00");
  assert.equal(horarioDevido(em("12:00"), nada), "12:00");
  assert.equal(horarioDevido(em("16:00"), nada), "16:00");
  assert.equal(horarioDevido(em("19:29"), nada), "16:00");
  assert.equal(horarioDevido(em("19:30"), nada), null);
});

test("horário já feito hoje não é devido de novo", () => {
  assert.equal(horarioDevido(em("07:10"), new Set(["2026-11-05-07:00"])), null);
  assert.equal(horarioDevido(em("12:10"), new Set(["2026-11-05-07:00"])), "12:00");
});

test("mostra o próximo horário", () => {
  assert.equal(proximoHorario(em("06:00")), "07:00");
  assert.equal(proximoHorario(em("07:40")), "12:00");
  assert.equal(proximoHorario(em("12:30")), "16:00");
  assert.equal(proximoHorario(em("16:30")), "07:00");
});

test("gera o relatório só com SKU e MLB", async () => {
  const r = rafael();
  await r.tick();
  const [relatorio] = r.relatorios();
  assert.equal(relatorio.id, "2026-11-05-07:00");
  assert.equal(relatorio.resumo, "2 anúncios sem promoção, de 410 ativos.");
  assert.equal(relatorio.texto, "SKU\tMLB\nSKU-1\tMLB1\nsem SKU\tMLB2");
  assert.equal(relatorio.tokens, 0);
  assert.deepEqual(r.estado().painel, { ativos: 410, semPromocao: 2 });
  assert.equal(r.estado().proximo, "12:00");
});

test("não repete o relatório do mesmo horário", async () => {
  let leituras = 0;
  const r = rafael({ lerAnuncios: async () => { leituras++; return LEITURA; } });
  await r.tick();
  await r.tick();
  assert.equal(leituras, 1);
  assert.equal(r.relatorios().length, 1);
});

test("fora do horário não consulta o Mercado Livre", async () => {
  let leituras = 0;
  const r = rafael({ lerAnuncios: async () => { leituras++; return LEITURA; } }, "21:00");
  await r.tick();
  assert.equal(leituras, 0);
});

test("anúncio sem resposta deixa o relatório marcado como incompleto", async () => {
  const r = rafael({ lerAnuncios: async () => ({ ...LEITURA, erros: ["mercado_livre: 3 anúncio(s) sem resposta"] }) });
  await r.tick();
  assert.match(r.relatorios()[0].resumo, /INCOMPLETO: mercado_livre: 3 anúncio\(s\) sem resposta/);
  assert.equal(r.estado().erro, "mercado_livre: 3 anúncio(s) sem resposta");
});

test("sem autorização não diz que está tudo certo e tenta de novo", async () => {
  let vezes = 0;
  const r = rafael({
    lerAnuncios: async () => (++vezes === 1
      ? { ...LEITURA, total_ativos: 0, anuncios: [], erros: ["mercado_livre: sem autorização"] }
      : LEITURA),
  });
  await r.tick();
  assert.equal(r.relatorios().length, 0);
  assert.equal(r.estado().erro, "mercado_livre: sem autorização");
  await r.tick();
  assert.equal(r.relatorios().length, 1);
  assert.equal(r.estado().erro, null);
});

test("falha na consulta vira aviso e não derruba o agente", async () => {
  const r = rafael({ lerAnuncios: async () => { throw new Error("Sistema Novaes respondeu 502"); } });
  await r.tick();
  assert.equal(r.estado().erro, "Sistema Novaes respondeu 502");
  assert.equal(r.estado().progresso, 0);
});

test("relatório na hora é limitado e não ocupa o lugar do relatório do horário", async () => {
  let leituras = 0;
  const r = rafael({ lerAnuncios: async () => { leituras++; return LEITURA; } });
  await r.gerarAgora();
  await r.gerarAgora();
  assert.equal(leituras, 1);
  assert.equal(r.relatorios()[0].manual, true);
  await r.tick();
  assert.equal(leituras, 2);
  assert.equal(r.relatorios()[0].id, "2026-11-05-07:00");
});

test("o histórico do Rafael fica em arquivo próprio e continua depois de reiniciar", async () => {
  const dir = pasta();
  const r = rafael({ armazem: criarArmazem<RelatorioRafael>(dir, "rafael.json") });
  await r.tick();
  assert.equal(criarArmazem(dir).listar().length, 0);
  const depois = rafael({ armazem: criarArmazem<RelatorioRafael>(dir, "rafael.json") });
  assert.deepEqual(depois.estado().painel, { ativos: 410, semPromocao: 2 });
});
