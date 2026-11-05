import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { criarServidor } from "../src/servidor.ts";

let gerados = 0;
const luisa = {
  estado: () => ({ atividade: "Aguardando", progresso: 0, painel: null, erro: null, atualizadoEm: null, proximo: "19:05" }),
  relatorios: () => [],
  gerarAgora: async () => { gerados++; },
};
let geradosRafael = 0;
const rafael = {
  estado: () => ({ atividade: "Aguardando", progresso: 0, painel: { ativos: 410, semPromocao: 25 }, erro: null, atualizadoEm: null, proximo: "12:00" }),
  relatorios: () => [],
  gerarAgora: async () => { geradosRafael++; },
};
const publico = mkdtempSync(join(tmpdir(), "publico-"));
writeFileSync(join(publico, "index.html"), "<h1>Escritorio</h1>");
const servidor = criarServidor({ agentes: { luisa, rafael }, publico, inscrever: () => () => {} });
let base = "";

before(async () => {
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => servidor.close());

test("a checagem de saúde responde", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test("a tela e os dados abrem sem login", async () => {
  assert.match(await (await fetch(`${base}/`)).text(), /Escritorio/);
  assert.equal((await fetch(`${base}/api/luisa`)).status, 200);
});

test("o site pede para não aparecer em buscadores", async () => {
  assert.match((await fetch(`${base}/`)).headers.get("x-robots-tag") ?? "", /noindex/);
});

test("gerar relatório exige o cabeçalho que outros sites não conseguem enviar", async () => {
  const antes = gerados;
  assert.equal((await fetch(`${base}/api/luisa/gerar`, { method: "POST" })).status, 403);
  assert.equal(gerados, antes);
  const r = await fetch(`${base}/api/luisa/gerar`, { method: "POST", headers: { "x-escritorio": "1" } });
  assert.equal(r.status, 202);
  assert.equal(gerados, antes + 1);
});

test("cada agente tem os seus dados e o seu botão", async () => {
  const dados = await (await fetch(`${base}/api/rafael`)).json() as { estado: { proximo: string } };
  assert.equal(dados.estado.proximo, "12:00");
  assert.equal((await fetch(`${base}/api/rafael/gerar`, { method: "POST" })).status, 403);
  const antesLuisa = gerados;
  const r = await fetch(`${base}/api/rafael/gerar`, { method: "POST", headers: { "x-escritorio": "1" } });
  assert.equal(r.status, 202);
  assert.equal(geradosRafael, 1);
  assert.equal(gerados, antesLuisa);
});

test("nome que não é de agente não abre nada", async () => {
  for (const nome of ["ninguem", "__proto__", "constructor"]) {
    assert.equal((await fetch(`${base}/api/${nome}`)).status, 404);
    assert.equal((await fetch(`${base}/api/${nome}/gerar`, { method: "POST", headers: { "x-escritorio": "1" } })).status, 405);
  }
});

test("não dá para sair da pasta pública pelo endereço", async () => {
  assert.equal((await fetch(`${base}/%2e%2e/%2e%2e/package.json`)).status, 404);
});
