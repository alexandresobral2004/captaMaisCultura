/**
 * Processa os itens com no máximo `limite` tarefas em andamento ao mesmo tempo.
 * Antes de iniciar cada item, consulta `deveParar`: se for verdadeiro, não inicia mais nada
 * (as que já estão em andamento terminam). Uma falha em uma tarefa é isolada e não interrompe as demais.
 */
export async function executarComLimite<T>(
  itens: readonly T[],
  limite: number,
  tarefa: (item: T) => Promise<void>,
  deveParar: () => boolean = () => false,
): Promise<void> {
  let proximo = 0;

  const trabalhador = async (): Promise<void> => {
    while (proximo < itens.length && !deveParar()) {
      const item = itens[proximo++];
      try {
        await tarefa(item);
      } catch {
        // Falha isolada: quem chama registra o erro dentro da tarefa
      }
    }
  };

  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, () => trabalhador());
  await Promise.all(trabalhadores);
}
