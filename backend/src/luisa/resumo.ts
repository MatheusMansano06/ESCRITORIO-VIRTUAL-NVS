import { readFileSync } from "node:fs";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { RelatorioBase } from "./contagem.ts";

const MODELO = "claude-haiku-5-5";
const INSTRUCOES = readFileSync(new URL("../../../agentes/luisa.md", import.meta.url), "utf8");
const LIMITE_MS = 90_000;

type Resultado = { subtype: string; is_error?: boolean; result?: string };

/** Falha do Claude pode chegar como "success" com is_error; esse texto nunca pode ir para o relatório. */
export function textoDoResultado(mensagem: Resultado): string | null {
  if (mensagem.subtype !== "success" || mensagem.is_error) throw new Error(mensagem.result ?? mensagem.subtype);
  return (mensagem.result ?? "").trim().slice(0, 500) || null;
}

/** O Haiku só escreve a frase de abertura. Recebe apenas números, sem ferramentas nem dados de clientes. */
export async function escreverResumo(relatorio: RelatorioBase): Promise<string | null> {
  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), LIMITE_MS);
  try {
    const dados = { tipo: relatorio.tipo, numeros: relatorio.numeros, plataformas: relatorio.plataformas, incompleto: relatorio.avisos.length > 0 };
    for await (const mensagem of query({
      prompt: JSON.stringify(dados),
      options: { model: MODELO, systemPrompt: INSTRUCOES, tools: [], maxTurns: 1, settingSources: [], persistSession: false, abortController: parar },
    })) {
      if (mensagem.type === "result") return textoDoResultado(mensagem);
    }
    return null;
  } finally {
    clearTimeout(relogio);
  }
}
