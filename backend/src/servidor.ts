import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json",
};
const SEGURANCA = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
  "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net; frame-ancestors 'none'",
};

type LuisaNaTela = {
  estado: () => unknown;
  relatorios: () => unknown[];
  gerarAgora: () => Promise<void>;
};

type Opcoes = {
  luisa: LuisaNaTela;
  publico: string;
  inscrever: (enviar: (dados: unknown) => void) => () => void;
};

function json(res: ServerResponse, status: number, dados: unknown) {
  res.writeHead(status, { ...SEGURANCA, "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(dados));
}

function arquivoPublico(res: ServerResponse, publico: string, caminho: string) {
  const raiz = resolve(publico);
  let alvo: string;
  try {
    alvo = resolve(join(raiz, decodeURIComponent(caminho === "/" ? "/index.html" : caminho)));
  } catch {
    return json(res, 400, { erro: "endereço inválido" });
  }
  if (!alvo.startsWith(raiz + sep) || !existsSync(alvo) || !statSync(alvo).isFile()) return json(res, 404, { erro: "não encontrado" });
  res.writeHead(200, { ...SEGURANCA, "content-type": TIPOS[extname(alvo)] ?? "application/octet-stream", "cache-control": "no-cache" });
  createReadStream(alvo).pipe(res);
}

function eventos(req: IncomingMessage, res: ServerResponse, inscrever: Opcoes["inscrever"]) {
  res.writeHead(200, { ...SEGURANCA, "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
  res.write(": ligado\n\n");
  const sair = inscrever((dados) => res.write(`event: luisa\ndata: ${JSON.stringify(dados)}\n\n`));
  const pulso = setInterval(() => res.write(": pulso\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(pulso);
    sair();
  });
}

export function criarServidor({ luisa, publico, inscrever }: Opcoes) {
  return createServer((req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://local");
    if (req.method === "GET" && pathname === "/health") return json(res, 200, { ok: true });

    if (req.method === "GET" && pathname === "/api/luisa") {
      return json(res, 200, { estado: luisa.estado(), relatorios: luisa.relatorios().slice(0, 20) });
    }
    if (req.method === "GET" && pathname === "/api/eventos") return eventos(req, res, inscrever);
    if (req.method === "POST" && pathname === "/api/luisa/gerar") {
      // Outro site aberto no navegador não consegue enviar este cabeçalho (CSRF).
      if (req.headers["x-escritorio"] !== "1") return json(res, 403, { erro: "pedido recusado" });
      luisa.gerarAgora().catch((e) => console.error("[luisa] gerar:", (e as Error).message));
      return json(res, 202, { ok: true });
    }
    if (req.method === "GET") return arquivoPublico(res, publico, pathname);
    return json(res, 405, { erro: "método não permitido" });
  });
}
