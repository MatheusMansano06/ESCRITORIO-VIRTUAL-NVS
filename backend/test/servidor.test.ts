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
const publico = mkdtempSync(join(tmpdir(), "publico-"));
writeFileSync(join(publico, "index.html"), "<h1>Escritorio</h1>");
const servidor = criarServidor({ luisa, publico, inscrever: () => () => {} });
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

test("não dá para sair da pasta pública pelo endereço", async () => {
  assert.equal((await fetch(`${base}/%2e%2e/%2e%2e/package.json`)).status, 404);
});
