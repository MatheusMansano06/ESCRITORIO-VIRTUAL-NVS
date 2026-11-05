import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RelatorioBase } from "./luisa/contagem.ts";

export type Relatorio = RelatorioBase & { id: string; manual: boolean; resumo: string | null; tokens: number };
export type Armazem<T = Relatorio> = {
  listar: () => T[];
  feitos: () => Set<string>;
  salvar: (relatorio: T) => void;
};

const LIMITE = 120;

// ponytail: um arquivo JSON basta para poucos relatórios por dia; trocar por banco quando houver muitos agentes.
export function criarArmazem<T extends { id: string; manual: boolean } = Relatorio>(pasta: string, nome = "relatorios.json"): Armazem<T> {
  mkdirSync(pasta, { recursive: true });
  const arquivo = join(pasta, nome);
  let lista: T[] = [];
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
    salvar(relatorio: T) {
      lista = [relatorio, ...lista].slice(0, LIMITE);
      const temporario = `${arquivo}.tmp`;  // gravação atômica: uma queda no meio não perde o histórico
      writeFileSync(temporario, JSON.stringify(lista));
      renameSync(temporario, arquivo);
    },
  };
}
