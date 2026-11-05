/** Garante uma tarefa por vez; uma falha vira aviso na tela e nova tentativa no próximo ciclo. */
export function criarFila(nome: string, aoFalhar: (erro: string) => void) {
  let ocupada = false;
  return async function emFila(tarefa: () => Promise<void>) {
    if (ocupada) return;
    ocupada = true;
    try {
      await tarefa();
    } catch (e) {
      const erro = (e as Error).message;
      console.error(`[${nome}] falha:`, erro);
      aoFalhar(erro);
    } finally {
      ocupada = false;
    }
  };
}
