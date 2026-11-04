import type { Armazem, Relatorio } from "../armazem.ts";
import { contar, emBrasilia, montarRelatorio, relatorioDevido, type Contagem, type Leitura, type RelatorioBase, type TipoRelatorio } from "./contagem.ts";

const PAINEL_MINUTOS = 15;

export type EstadoLuisa = {
  atividade: string;
  painel: Contagem | null;
  erro: string | null;
  atualizadoEm: string | null;
};

type Dependencias = {
  lerPendentes: () => Promise<Leitura>;
  escreverResumo: (relatorio: RelatorioBase) => Promise<string | null>;
  armazem: Armazem;
  agora?: () => Date;
  aoMudar?: (estado: EstadoLuisa) => void;
};

export function criarLuisa({ lerPendentes, escreverResumo, armazem, agora = () => new Date(), aoMudar }: Dependencias) {
  const estado: EstadoLuisa = { atividade: "Aguardando", painel: null, erro: null, atualizadoEm: null };
  let ocupada = false;

  function mudar(parcial: Partial<EstadoLuisa>) {
    Object.assign(estado, parcial);
    aoMudar?.({ ...estado });
  }

  async function ler(): Promise<Leitura> {
    mudar({ atividade: "Consultando Mercado Livre e Shopee" });
    const leitura = await lerPendentes();
    mudar({ painel: contar(leitura.pacotes, agora()), atualizadoEm: agora().toISOString(), erro: leitura.erros[0] ?? null });
    return leitura;
  }

  async function produzir(tipo: TipoRelatorio, manual: boolean) {
    const leitura = await ler();
    const base = montarRelatorio(tipo, leitura, agora());
    mudar({ atividade: "Escrevendo o relatório" });
    let resumo: string | null = null;
    try {
      resumo = await escreverResumo(base);
    } catch (e) {  // sem a IA o relatório sai só com os números
      console.error("[luisa] resumo falhou:", (e as Error).message);
    }
    const id = manual ? `${base.dia}-${tipo}-manual-${agora().getTime()}` : `${base.dia}-${tipo}`;
    const relatorio: Relatorio = { ...base, id, manual, resumo };
    armazem.salvar(relatorio);
    mudar({ atividade: "Relatório pronto" });
  }

  /** Garante uma tarefa por vez; uma falha vira aviso na tela e nova tentativa no próximo ciclo. */
  async function emFila(tarefa: () => Promise<void>) {
    if (ocupada) return;
    ocupada = true;
    try {
      await tarefa();
    } catch (e) {
      const erro = (e as Error).message;
      console.error("[luisa] falha:", erro);
      mudar({ atividade: "Não consegui consultar. Vou tentar de novo.", erro });
    } finally {
      ocupada = false;
    }
  }

  function painelVencido(): boolean {
    if (!estado.atualizadoEm) return true;
    return agora().getTime() - new Date(estado.atualizadoEm).getTime() >= PAINEL_MINUTOS * 60_000;
  }

  return {
    estado: () => ({ ...estado }),
    relatorios: () => armazem.listar(),

    /** Roda a cada minuto: gera o relatório do horário ou mantém o painel atualizado. */
    tick: () => emFila(async () => {
      const devido = relatorioDevido(agora(), armazem.feitos());
      if (devido) return produzir(devido, false);
      if (painelVencido()) {
        await ler();
        mudar({ atividade: "Aguardando o próximo relatório" });
      }
    }),

    gerarAgora: () => emFila(() => produzir(emBrasilia(agora()).hora < 12 ? "manha" : "noite", true)),
  };
}
