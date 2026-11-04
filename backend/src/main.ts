import { fileURLToPath } from "node:url";
import { criarArmazem } from "./armazem.ts";
import { escreverResumo } from "./luisa/resumo.ts";
import { criarLuisa } from "./luisa/servico.ts";
import { criarLeitorNovaes } from "./novaes.ts";
import { criarServidor } from "./servidor.ts";

const CICLO_MS = 60_000;
const ouvintes = new Set<(dados: unknown) => void>();

const luisa = criarLuisa({
  lerPendentes: criarLeitorNovaes(process.env.NOVAES_URL ?? "", process.env.AGENTES_API_KEY ?? ""),
  escreverResumo,
  armazem: criarArmazem(process.env.DATA_DIR ?? "data"),
  aoMudar: () => {
    const dados = { estado: luisa.estado(), relatorios: luisa.relatorios().slice(0, 20) };
    for (const enviar of ouvintes) enviar(dados);
  },
});

const servidor = criarServidor({
  senha: process.env.ESCRITORIO_SENHA ?? "",
  luisa,
  publico: fileURLToPath(new URL("../../frontend/public", import.meta.url)),
  inscrever(enviar) {
    ouvintes.add(enviar);
    return () => ouvintes.delete(enviar);
  },
});

process.on("unhandledRejection", (e) => console.error("[escritorio] erro:", e));

const porta = Number(process.env.PORT ?? 3000);
servidor.listen(porta, () => {
  console.log(`[escritorio] no ar na porta ${porta}`);
  if (!process.env.ESCRITORIO_SENHA) console.error("[escritorio] ESCRITORIO_SENHA vazia: ninguém consegue entrar");
  void luisa.tick();
  setInterval(() => void luisa.tick(), CICLO_MS);
});
