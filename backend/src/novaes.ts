/** Pergunta ao Sistema Novaes, que guarda as conexões com os canais. Este projeto nunca vê essas chaves. */
export function criarLeitorNovaes<T>(url: string, chave: string, caminho: string, limiteMs: number) {
  return async function ler(): Promise<T> {
    if (!url || !chave) throw new Error("NOVAES_URL ou AGENTES_API_KEY não configurada");
    const resposta = await fetch(`${url}/api/agentes/${caminho}`, {
      headers: { "x-chave-agentes": chave },
      signal: AbortSignal.timeout(limiteMs),
    });
    if (!resposta.ok) throw new Error(`Sistema Novaes respondeu ${resposta.status}`);
    return resposta.json() as Promise<T>;
  };
}
