import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { criarArmazem } from "../src/armazem.ts";
import { textoDoResultado } from "../src/luisa/resumo.ts";
import { criarLuisa } from "../src/luisa/servico.ts";
import type { Leitura } from "../src/luisa/contagem.ts";

const pasta = () => mkdtempSync(join(tmpdir(), "escritorio-"));
const LEITURA: Leitura = {
  pacotes: [{ plataforma: "shopee", pacote_id: "1", data_venda: "2026-11-03T10:00:00-03:00", limite_envio: null, logistica: null, situacao: null }],
  erros: [],
};

function luisa(extra: Partial<Parameters<typeof criarLuisa>[0]> = {}, agora = "2026-11-05T07:40:00-03:00") {
  return criarLuisa({
    lerPendentes: async () => LEITURA,
    escreverResumo: async () => "Bom dia, há um pacote urgente.",
    armazem: criarArmazem(pasta()),
    agora: () => new Date(agora),
    ...extra,
  });
}

test("mensagem de erro do Claude nunca vira resumo do relatório", () => {
  const erro = { type: "result", subtype: "success", is_error: true, result: "Failed to authenticate" };
  assert.throws(() => textoDoResultado(erro), /Failed to authenticate/);
});

test("resposta boa do Claude vira o resumo", () => {
  assert.equal(textoDoResultado({ type: "result", subtype: "success", is_error: false, result: " Bom dia. " }), "Bom dia.");
});

test("no horário, gera o relatório da manhã uma vez só", async () => {
  const l = luisa();
  await l.tick();
  await l.tick();
  assert.equal(l.relatorios().length, 1);
  assert.equal(l.relatorios()[0].id, "2026-11-05-manha");
  assert.equal(l.relatorios()[0].resumo, "Bom dia, há um pacote urgente.");
});

test("fora do horário, só atualiza o painel", async () => {
  const l = luisa({}, "2026-11-05T15:00:00-03:00");
  await l.tick();
  assert.equal(l.relatorios().length, 0);
  assert.equal(l.estado().painel?.shopee.atrasados, 1);
});

test("se a IA falhar, o relatório sai mesmo assim com os números", async () => {
  const l = luisa({ escreverResumo: async () => { throw new Error("limite do plano"); } });
  await l.tick();
  assert.equal(l.relatorios()[0].resumo, null);
  assert.deepEqual(l.relatorios()[0].numeros, { urgentes: 1, enviarHoje: 0 });
});

test("se a leitura falhar, avisa e tenta de novo no próximo ciclo", async () => {
  let falhar = true;
  const l = luisa({ lerPendentes: async () => { if (falhar) throw new Error("502"); return LEITURA; } });
  await l.tick();
  assert.equal(l.relatorios().length, 0);
  assert.match(l.estado().erro ?? "", /502/);
  falhar = false;
  await l.tick();
  assert.equal(l.relatorios().length, 1);
  assert.equal(l.estado().erro, null);
});

test("dois ciclos ao mesmo tempo não geram dois relatórios", async () => {
  const l = luisa();
  await Promise.all([l.tick(), l.tick()]);
  assert.equal(l.relatorios().length, 1);
});

test("relatório manual não impede o relatório do horário", async () => {
  const l = luisa();
  await l.gerarAgora();
  await l.tick();
  assert.deepEqual(l.relatorios().map((r) => r.manual), [false, true]);
});

test("avisa a tela a cada mudança de atividade", async () => {
  const atividades: string[] = [];
  const l = luisa({ aoMudar: (e) => atividades.push(e.atividade) });
  await l.tick();
  assert.ok(atividades.includes("Consultando Mercado Livre e Shopee"));
  assert.equal(atividades.at(-1), "Relatório pronto");
});

test("os relatórios continuam lá depois de reiniciar", async () => {
  const p = pasta();
  await luisa({ armazem: criarArmazem(p) }).tick();
  assert.equal(criarArmazem(p).listar().length, 1);
});

test("arquivo corrompido não derruba o servidor e é guardado", () => {
  const p = pasta();
  writeFileSync(join(p, "relatorios.json"), "{quebrado");
  assert.deepEqual(criarArmazem(p).listar(), []);
  assert.equal(readFileSync(join(p, "relatorios.json.corrompido"), "utf8"), "{quebrado");
});
