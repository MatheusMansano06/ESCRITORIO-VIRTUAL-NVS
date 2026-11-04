import type { Leitura } from "./luisa/contagem.ts";

/** Pergunta ao Sistema Novaes, que guarda as conexões com os canais. Este projeto nunca vê essas chaves. */
export function criarLeitorNovaes(url: string, chave: string) {
  return async function lerPendentes(): Promise<Leitura> {
    if (!url || !chave) throw new Error("NOVAES_URL ou AGENTES_API_KEY não configurada");
    const resposta = await fetch(`${url}/api/agentes/envios-pendentes`, {
      headers: { "x-chave-agentes": chave },
      signal: AbortSignal.timeout(170_000),
    });
    if (!resposta.ok) throw new Error(`Sistema Novaes respondeu ${resposta.status}`);
    return resposta.json() as Promise<Leitura>;
  };
}
