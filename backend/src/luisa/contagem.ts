/** Regras da Luisa em código comum: os números nunca dependem da IA. */

export type Plataforma = "mercado_livre" | "shopee";
export type TipoRelatorio = "manha" | "noite";

export type Pacote = {
  plataforma: Plataforma;
  pacote_id: string;
  data_venda: string | null;
  limite_envio: string | null;
  logistica: string | null;
  situacao: string | null;
};

export type Leitura = { pacotes: Pacote[]; erros: string[] };

export type ContagemPlataforma = {
  atrasados: number;
  hoje: number;
  proximos: number;
  semData: number;
  vencidosNaPlataforma: number;
};

export type Contagem = Record<Plataforma, ContagemPlataforma>;

export type RelatorioBase = {
  tipo: TipoRelatorio;
  dia: string;
  geradoEm: string;
  numeros: Record<string, number>;
  plataformas: Contagem;
  texto: string;
  avisos: string[];
};

const NOMES: Record<Plataforma, string> = { mercado_livre: "Mercado Livre", shopee: "Shopee" };
const HORA_DE_CORTE = 12;
const MANHA = { de: 7 * 60 + 30, ate: 12 * 60 };
const NOITE = { de: 19 * 60 + 5, ate: 24 * 60 };

const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function emBrasilia(data: Date): { dia: string; hora: number; minuto: number } {
  const p = Object.fromEntries(formato.formatToParts(data).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour), minuto: Number(p.minute) };
}

function diaSeguinte(dia: string): string {
  return emBrasilia(new Date(new Date(`${dia}T12:00:00-03:00`).getTime() + 86_400_000)).dia;
}

/** Venda antes das 12:00 sai no mesmo dia; a partir das 12:00, no dia seguinte. */
export function diaDeEnvio(dataVenda: string): string {
  const { dia, hora } = emBrasilia(new Date(dataVenda));
  return hora < HORA_DE_CORTE ? dia : diaSeguinte(dia);
}

function contagemVazia(): ContagemPlataforma {
  return { atrasados: 0, hoje: 0, proximos: 0, semData: 0, vencidosNaPlataforma: 0 };
}

export function contar(pacotes: Pacote[], agora: Date): Contagem {
  const hoje = emBrasilia(agora).dia;
  const total: Contagem = { mercado_livre: contagemVazia(), shopee: contagemVazia() };
  for (const p of pacotes) {
    const c = total[p.plataforma];
    if (!c) continue;
    if (p.limite_envio && new Date(p.limite_envio) < agora) c.vencidosNaPlataforma++;
    if (!p.data_venda) {  // sem data vai como urgente: melhor conferir do que sumir da conta
      c.semData++;
      c.atrasados++;
      continue;
    }
    const dia = diaDeEnvio(p.data_venda);
    if (dia < hoje) c.atrasados++;
    else if (dia === hoje) c.hoje++;
    else c.proximos++;
  }
  return total;
}

function porPlataforma(c: Contagem, campo: (x: ContagemPlataforma) => number): string {
  return `  ${NOMES.mercado_livre}: ${campo(c.mercado_livre)} | ${NOMES.shopee}: ${campo(c.shopee)}`;
}

export function montarRelatorio(tipo: TipoRelatorio, leitura: Leitura, agora: Date): RelatorioBase {
  const plataformas = contar(leitura.pacotes, agora);
  const { mercado_livre: ml, shopee } = plataformas;
  const atrasados = ml.atrasados + shopee.atrasados;
  const hoje = ml.hoje + shopee.hoje;
  const semData = ml.semData + shopee.semData;
  const avisos = [...leitura.erros];
  if (semData) avisos.push(`${semData} pacote(s) sem data de venda contados como urgentes`);

  const linhas: string[] = [];
  if (leitura.erros.length) linhas.push("RELATÓRIO INCOMPLETO: uma das consultas falhou.");
  let numeros: Record<string, number>;
  if (tipo === "manha") {
    numeros = { urgentes: atrasados, enviarHoje: hoje };
    linhas.push(`Urgentes (atrasados): ${atrasados}`, porPlataforma(plataformas, (x) => x.atrasados));
    linhas.push(`Enviar ainda hoje, sem atraso: ${hoje}`, porPlataforma(plataformas, (x) => x.hoje));
  } else {
    numeros = { ficaramParaTras: atrasados + hoje };
    linhas.push(`Ficaram para trás: ${atrasados + hoje}`, porPlataforma(plataformas, (x) => x.atrasados + x.hoje));
    linhas.push(`  De dias anteriores: ${atrasados} | De hoje: ${hoje}`);
  }
  if (shopee.vencidosNaPlataforma) linhas.push(`Já vencidos no prazo da Shopee: ${shopee.vencidosNaPlataforma}`);
  if (ml.vencidosNaPlataforma) linhas.push(`Já vencidos no prazo do Mercado Livre: ${ml.vencidosNaPlataforma}`);

  return {
    tipo,
    dia: emBrasilia(agora).dia,
    geradoEm: agora.toISOString(),
    numeros,
    plataformas,
    texto: linhas.join("\n"),
    avisos,
  };
}

export function proximoHorario(agora: Date): string {
  const { hora, minuto } = emBrasilia(agora);
  const minutos = hora * 60 + minuto;
  if (minutos < MANHA.de) return "07:30";
  return minutos < NOITE.de ? "19:05" : "07:30";
}

/** Qual relatório do horário ainda falta hoje. A janela larga cobre um reinício do servidor. */
export function relatorioDevido(agora: Date, feitos: Set<string>): TipoRelatorio | null {
  const { dia, hora, minuto } = emBrasilia(agora);
  const minutos = hora * 60 + minuto;
  if (minutos >= MANHA.de && minutos < MANHA.ate && !feitos.has(`${dia}-manha`)) return "manha";
  if (minutos >= NOITE.de && minutos < NOITE.ate && !feitos.has(`${dia}-noite`)) return "noite";
  return null;
}
