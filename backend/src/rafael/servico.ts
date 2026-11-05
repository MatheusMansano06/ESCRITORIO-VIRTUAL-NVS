import type { Armazem } from "../armazem.ts";
import { criarFila } from "../fila.ts";
import { emBrasilia } from "../luisa/contagem.ts";

const INTERVALO_MANUAL_MS = 5 * 60_000; // o site é aberto: evita consultar centenas de anúncios a cada clique
const HORARIOS = [  // a janela larga cobre um reinício do servidor
  { tipo: "07:00", de: 7 * 60, ate: 12 * 60 },
  { tipo: "12:00", de: 12 * 60, ate: 16 * 60 },
  { tipo: "16:00", de: 16 * 60, ate: 19 * 60 + 30 },
];

export type LeituraAnuncios = {
  gerado_em: string;
  total_ativos: number;
  anuncios: { sku: string | null; mlb: string }[];
  erros: string[];
};

export type RelatorioRafael = {
  id: string;
  tipo: string;
  dia: string;
  geradoEm: string;
  manual: boolean;
  ativos: number;
  semPromocao: number;
  resumo: string;
  texto: string;
  tokens: number;
};

type Dependencias = {
  lerAnuncios: () => Promise<LeituraAnuncios>;
  armazem: Armazem<RelatorioRafael>;
  agora?: () => Date;
  aoMudar?: () => void;
};

function minutosDoDia(agora: Date): number {
  const { hora, minuto } = emBrasilia(agora);
  return hora * 60 + minuto;
}

export function horarioDevido(agora: Date, feitos: Set<string>): string | null {
  const minutos = minutosDoDia(agora);
  const horario = HORARIOS.find((h) => minutos >= h.de && minutos < h.ate);
  return horario && !feitos.has(`${emBrasilia(agora).dia}-${horario.tipo}`) ? horario.tipo : null;
}

export function proximoHorario(agora: Date): string {
  const minutos = minutosDoDia(agora);
  return (HORARIOS.find((h) => minutos < h.de) ?? HORARIOS[0]).tipo;
}

function montarRelatorio(tipo: string, manual: boolean, leitura: LeituraAnuncios, agora: Date): RelatorioRafael {
  const { dia } = emBrasilia(agora);
  const { anuncios, total_ativos: ativos, erros } = leitura;
  const aviso = erros.length ? ` INCOMPLETO: ${erros.join("; ")}` : "";
  return {
    id: manual ? `${dia}-manual-${agora.getTime()}` : `${dia}-${tipo}`,
    tipo,
    dia,
    geradoEm: agora.toISOString(),
    manual,
    ativos,
    semPromocao: anuncios.length,
    resumo: `${anuncios.length} ${anuncios.length === 1 ? "anúncio" : "anúncios"} sem promoção, de ${ativos} ativos.${aviso}`,
    texto: ["SKU\tMLB", ...anuncios.map((a) => `${a.sku || "sem SKU"}\t${a.mlb}`)].join("\n"),  // a tabulação separa as colunas ao colar numa planilha
    tokens: 0,
  };
}

export function criarRafael({ lerAnuncios, armazem, agora = () => new Date(), aoMudar }: Dependencias) {
  const andamento = { atividade: "Aguardando", progresso: 0, erro: null as string | null };
  let ultimoManual = -Infinity;

  function mudar(parcial: Partial<typeof andamento>) {
    Object.assign(andamento, parcial);
    aoMudar?.();
  }

  const emFila = criarFila("rafael", (erro) => mudar({ atividade: "Não consegui consultar. Vou tentar de novo.", progresso: 0, erro }));

  async function produzir(tipo: string, manual: boolean) {
    mudar({ atividade: "Olhando os anúncios do Mercado Livre", progresso: 35 });
    const leitura = await lerAnuncios();
    if (!leitura.total_ativos && leitura.erros.length) throw new Error(leitura.erros[0]);  // sem leitura não há relatório: lista vazia pareceria "tudo certo"
    armazem.salvar(montarRelatorio(tipo, manual, leitura, agora()));
    mudar({ atividade: "Relatório pronto", progresso: 100, erro: leitura.erros[0] ?? null });
  }

  return {
    estado() {
      const ultimo = armazem.listar()[0];
      return {
        ...andamento,
        painel: ultimo ? { ativos: ultimo.ativos, semPromocao: ultimo.semPromocao } : null,
        atualizadoEm: ultimo?.geradoEm ?? null,
        proximo: proximoHorario(agora()),
      };
    },
    relatorios: () => armazem.listar(),

    /** Roda a cada minuto: gera o relatório do horário, se ainda faltar. */
    tick: () => emFila(async () => {
      const tipo = horarioDevido(agora(), armazem.feitos());
      if (tipo) await produzir(tipo, false);
    }),

    async gerarAgora() {
      if (agora().getTime() - ultimoManual < INTERVALO_MANUAL_MS) return;
      ultimoManual = agora().getTime();
      await emFila(() => produzir("manual", true));
    },
  };
}
