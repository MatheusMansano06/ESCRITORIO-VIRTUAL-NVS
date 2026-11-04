import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { criarServidor } from "../src/servidor.ts";

const SENHA = "senha-de-teste";
const entrar = { authorization: `Basic ${Buffer.from(`nvs:${SENHA}`).toString("base64")}` };
let gerados = 0;
const luisa = {
  estado: () => ({ atividade: "Aguardando", painel: null, erro: null, atualizadoEm: null }),
  relatorios: () => [],
  gerarAgora: async () => { gerados++; },
};
const publico = mkdtempSync(join(tmpdir(), "publico-"));
writeFileSync(join(publico, "index.html"), "<h1>Escritorio</h1>");
const servidor = criarServidor({ senha: SENHA, luisa, publico, inscrever: () => () => {} });
let base = "";

before(async () => {
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => servidor.close());

test("a checagem de saúde responde sem senha e sem dados", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test("sem senha, a tela não abre e o navegador pede login", async () => {
  const r = await fetch(`${base}/`);
  assert.equal(r.status, 401);
  assert.match(r.headers.get("www-authenticate") ?? "", /Basic/);
});

test("com senha errada, os dados não abrem", async () => {
  const errada = `Basic ${Buffer.from("nvs:errada").toString("base64")}`;
  assert.equal((await fetch(`${base}/api/luisa`, { headers: { authorization: errada } })).status, 401);
});

test("com a senha certa, abre a tela e os dados", async () => {
  assert.match(await (await fetch(`${base}/`, { headers: entrar })).text(), /Escritorio/);
  assert.equal((await fetch(`${base}/api/luisa`, { headers: entrar })).status, 200);
});

test("sem senha configurada, ninguém entra", async () => {
  const fechado = criarServidor({ senha: "", luisa, publico, inscrever: () => () => {} });
  await new Promise<void>((ok) => fechado.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${(fechado.address() as AddressInfo).port}/`;
  const vazio = `Basic ${Buffer.from("nvs:").toString("base64")}`;
  assert.equal((await fetch(url, { headers: { authorization: vazio } })).status, 401);
  fechado.close();
});

test("gerar relatório exige o cabeçalho que outros sites não conseguem enviar", async () => {
  const antes = gerados;
  assert.equal((await fetch(`${base}/api/luisa/gerar`, { method: "POST", headers: entrar })).status, 403);
  assert.equal(gerados, antes);
  const r = await fetch(`${base}/api/luisa/gerar`, { method: "POST", headers: { ...entrar, "x-escritorio": "1" } });
  assert.equal(r.status, 202);
  assert.equal(gerados, antes + 1);
});

test("não dá para sair da pasta pública pelo endereço", async () => {
  const r = await fetch(`${base}/%2e%2e/%2e%2e/package.json`, { headers: entrar });
  assert.equal(r.status, 404);
});
