import { fileURLToPath } from "node:url";
import { criarArmazem } from "./armazem.ts";
import type { Leitura } from "./luisa/contagem.ts";
import { escreverResumo } from "./luisa/resumo.ts";
import { criarLuisa } from "./luisa/servico.ts";
import { criarLeitorNovaes } from "./novaes.ts";
import { criarRafael, type LeituraAnuncios, type RelatorioRafael } from "./rafael/servico.ts";
import { criarServidor, retrato } from "./servidor.ts";

const CICLO_MS = 60_000;
const NOVAES_URL = process.env.NOVAES_URL ?? "";
const CHAVE = process.env.AGENTES_API_KEY ?? "";
const DADOS = process.env.DATA_DIR ?? "data";
const ouvintes = new Set<(nome: string, dados: unknown) => void>();

const agentes = {
  luisa: criarLuisa({
    lerPendentes: criarLeitorNovaes<Leitura>(NOVAES_URL, CHAVE, "envios-pendentes", 170_000),
    escreverResumo,
    armazem: criarArmazem(DADOS),
    aoMudar: () => avisar("luisa"),
  }),
  rafael: criarRafael({
    lerAnuncios: criarLeitorNovaes<LeituraAnuncios>(NOVAES_URL, CHAVE, "anuncios-sem-promocao", 280_000),
    armazem: criarArmazem<RelatorioRafael>(DADOS, "rafael.json"),
    aoMudar: () => avisar("rafael"),
  }),
};

function avisar(nome: keyof typeof agentes) {
  const dados = retrato(agentes[nome]);
  for (const enviar of ouvintes) enviar(nome, dados);
}

const servidor = criarServidor({
  agentes,
  publico: fileURLToPath(new URL("../../frontend/public", import.meta.url)),
  inscrever(enviar) {
    ouvintes.add(enviar);
    return () => ouvintes.delete(enviar);
  },
});

process.on("unhandledRejection", (e) => console.error("[escritorio] erro:", e));

function trabalhar() {
  for (const agente of Object.values(agentes)) void agente.tick();
}

const porta = Number(process.env.PORT ?? 3000);
servidor.listen(porta, () => {
  console.log(`[escritorio] no ar na porta ${porta}`);
  trabalhar();
  setInterval(trabalhar, CICLO_MS);
});
