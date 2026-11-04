import type { Armazem, Relatorio } from "../armazem.ts";
import { contar, emBrasilia, emHorarioComercial, montarRelatorio, proximoHorario, relatorioDevido, type Contagem, type Leitura, type RelatorioBase, type TipoRelatorio } from "./contagem.ts";
import type { Resumo } from "./resumo.ts";

const PAINEL_MINUTOS = 15;
const INTERVALO_MANUAL_MS = 5 * 60_000; // o site é aberto: evita gastar o plano com cliques repetidos

export type EstadoLuisa = {
  atividade: string;
  progresso: number;
  painel: Contagem | null;
  erro: string | null;
  atualizadoEm: string | null;
};

type Dependencias = {
  lerPendentes: () => Promise<Leitura>;
  escreverResumo: (relatorio: RelatorioBase) => Promise<Resumo | null>;
  armazem: Armazem;
  agora?: () => Date;
  aoMudar?: (estado: EstadoLuisa) => void;
};

export function criarLuisa({ lerPendentes, escreverResumo, armazem, agora = () => new Date(), aoMudar }: Dependencias) {
  const estado: EstadoLuisa = { atividade: "Aguardando", progresso: 0, painel: null, erro: null, atualizadoEm: null };
  let ocupada = false;
  let ultimoManual = -Infinity;

  function mudar(parcial: Partial<EstadoLuisa>) {
    Object.assign(estado, parcial);
    aoMudar?.({ ...estado });
  }

  async function ler(): Promise<Leitura> {
    mudar({ atividade: "Consultando Mercado Livre e Shopee", progresso: 35 });
    const leitura = await lerPendentes();
    mudar({ painel: contar(leitura.pacotes, agora()), atualizadoEm: agora().toISOString(), erro: leitura.erros[0] ?? null });
    return leitura;
  }

  async function produzir(tipo: TipoRelatorio, manual: boolean) {
    const leitura = await ler();
    const base = montarRelatorio(tipo, leitura, agora());
    mudar({ atividade: "Escrevendo o relatório", progresso: 75 });
    let resumo: Resumo | null = null;
    try {
      resumo = await escreverResumo(base);
    } catch (e) {  // sem a IA o relatório sai só com os números
      console.error("[luisa] resumo falhou:", (e as Error).message);
    }
    const id = manual ? `${base.dia}-${tipo}-manual-${agora().getTime()}` : `${base.dia}-${tipo}`;
    const relatorio: Relatorio = { ...base, id, manual, resumo: resumo?.texto ?? null, tokens: resumo?.tokens ?? 0 };
    armazem.salvar(relatorio);
    mudar({ atividade: "Relatório pronto", progresso: 100 });
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
      mudar({ atividade: "Não consegui consultar. Vou tentar de novo.", progresso: 0, erro });
    } finally {
      ocupada = false;
    }
  }

  function painelVencido(): boolean {
    if (!estado.atualizadoEm) return true;
    return agora().getTime() - new Date(estado.atualizadoEm).getTime() >= PAINEL_MINUTOS * 60_000;
  }

  return {
    estado: () => ({ ...estado, proximo: proximoHorario(agora()) }),
    relatorios: () => armazem.listar(),

    /** Roda a cada minuto: gera o relatório do horário ou mantém o painel atualizado. */
    tick: () => emFila(async () => {
      const devido = relatorioDevido(agora(), armazem.feitos());
      if (devido) return produzir(devido, false);
      if (emHorarioComercial(agora()) && painelVencido()) {
        await ler();
        mudar({ atividade: "Aguardando o próximo relatório", progresso: 0 });
      }
    }),

    async gerarAgora() {
      if (agora().getTime() - ultimoManual < INTERVALO_MANUAL_MS) return;
      ultimoManual = agora().getTime();
      await emFila(() => produzir(emBrasilia(agora()).hora < 12 ? "manha" : "noite", true));
    },
  };
}
