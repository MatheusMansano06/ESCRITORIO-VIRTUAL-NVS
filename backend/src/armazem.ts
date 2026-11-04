import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RelatorioBase } from "./luisa/contagem.ts";

export type Relatorio = RelatorioBase & { id: string; manual: boolean; resumo: string | null; tokens: number };
export type Armazem = ReturnType<typeof criarArmazem>;

const LIMITE = 120;

// ponytail: um arquivo JSON basta para poucos relatórios por dia; trocar por banco quando houver muitos agentes.
export function criarArmazem(pasta: string) {
  mkdirSync(pasta, { recursive: true });
  const arquivo = join(pasta, "relatorios.json");
  let lista: Relatorio[] = [];
  if (existsSync(arquivo)) {
    try {
      lista = JSON.parse(readFileSync(arquivo, "utf8"));
    } catch {  // não sobrescreve o que não conseguiu ler
      console.error("[armazem] arquivo corrompido, guardado à parte");
      renameSync(arquivo, `${arquivo}.corrompido`);
    }
  }
  return {
    listar: () => lista,
    feitos: () => new Set(lista.filter((r) => !r.manual).map((r) => r.id)),
    salvar(relatorio: Relatorio) {
      lista = [relatorio, ...lista].slice(0, LIMITE);
      const temporario = `${arquivo}.tmp`;  // gravação atômica: uma queda no meio não perde o histórico
      writeFileSync(temporario, JSON.stringify(lista));
      renameSync(temporario, arquivo);
    },
  };
}
