import { getAllEditais, saveEdital, deleteEdital } from '@/lib/db/editais-store';
import { db } from '@/lib/database/db';
import { editais as editaisTable } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';

async function testCategoriaArea() {
  console.log('--- INICIANDO TESTE DE CATEGORIA AREA ---');

  // 1. Listar editais originais
  const todosEditais = await getAllEditais(true);
  console.log(`Total de editais no banco (ativos/inativos/fechados): ${todosEditais.length}`);

  const editaisCultura = await getAllEditais(true, 'Cultura');
  console.log(`Editais de Cultura: ${editaisCultura.length}`);

  const editaisPesquisa = await getAllEditais(true, 'Pesquisa');
  console.log(`Editais de Pesquisa: ${editaisPesquisa.length}`);

  // Garantir que a soma é menor ou igual ao total (ou igual)
  console.log(`Validação de contagem básica: ${editaisCultura.length} (Cultura) + ${editaisPesquisa.length} (Pesquisa) = ${editaisCultura.length + editaisPesquisa.length}`);

  // 2. Criar um novo edital de teste
  const testId = `test-edital-${Date.now()}`;
  console.log(`\nCriando edital de teste com ID: ${testId}`);

  const novoEdital = await saveEdital({
    id: testId,
    titulo: 'Edital de Teste Categoria Área',
    orgao: 'MCTI / CNPq',
    valor: 'R$ 1.500.000,00',
    dataLimite: '2026-12-31',
    status: 'Aberto',
    descricao: 'Este é um edital de teste para categoria de área.',
    link: 'https://example.com/edital-teste',
    categoriaArea: 'Pesquisa',
  });

  console.log(`Edital criado com sucesso! Categoria no banco: ${novoEdital.categoriaArea}`);
  if (novoEdital.categoriaArea !== 'Pesquisa') {
    throw new Error(`Erro: Categoria deveria ser 'Pesquisa', mas retornou '${novoEdital.categoriaArea}'`);
  }

  // 3. Verificar se ele aparece na listagem de Pesquisa e não de Cultura
  const pesquisaList = await getAllEditais(true, 'Pesquisa');
  const editalPesquisaEncontrado = pesquisaList.some(e => e.id === testId);
  console.log(`Aparece na lista de Pesquisa? ${editalPesquisaEncontrado ? '✅ Sim' : '❌ Não'}`);

  const culturaList = await getAllEditais(true, 'Cultura');
  const editalCulturaEncontrado = culturaList.some(e => e.id === testId);
  console.log(`Aparece na lista de Cultura? ${editalCulturaEncontrado ? '❌ Sim (Erro)' : '✅ Não'}`);

  if (!editalPesquisaEncontrado || editalCulturaEncontrado) {
    throw new Error('Falha no filtro de categoria de área na listagem!');
  }

  // 4. Atualizar a categoria para 'Cultura'
  console.log(`\nAtualizando categoria do edital de teste para 'Cultura'...`);
  const editalAtualizado = await saveEdital({
    id: testId,
    categoriaArea: 'Cultura',
  });

  console.log(`Edital atualizado com sucesso! Categoria no banco: ${editalAtualizado.categoriaArea}`);
  if (editalAtualizado.categoriaArea !== 'Cultura') {
    throw new Error(`Erro: Categoria deveria ser 'Cultura', mas retornou '${editalAtualizado.categoriaArea}'`);
  }

  // 5. Verificar se agora aparece na listagem de Cultura e não de Pesquisa
  const pesquisaList2 = await getAllEditais(true, 'Pesquisa');
  const editalPesquisaEncontrado2 = pesquisaList2.some(e => e.id === testId);
  console.log(`Aparece na lista de Pesquisa? ${editalPesquisaEncontrado2 ? '❌ Sim (Erro)' : '✅ Não'}`);

  const culturaList2 = await getAllEditais(true, 'Cultura');
  const editalCulturaEncontrado2 = culturaList2.some(e => e.id === testId);
  console.log(`Aparece na lista de Cultura? ${editalCulturaEncontrado2 ? '✅ Sim' : '❌ Não'}`);

  if (editalPesquisaEncontrado2 || !editalCulturaEncontrado2) {
    throw new Error('Falha no filtro de categoria de área na listagem após atualização!');
  }

  // 6. Deletar o edital de teste
  console.log(`\nDeletando edital de teste...`);
  const deletado = await deleteEdital(testId);
  console.log(`Deletado? ${deletado ? '✅ Sim' : '❌ Não'}`);

  // Limpar do banco permanentemente para não poluir
  await db.delete(editaisTable).where(eq(editaisTable.id, testId));
  console.log('Edital de teste removido fisicamente do banco de dados.');

  console.log('\n--- TODOS OS TESTES PASSARAM COM SUCESSO! ---');
}

testCategoriaArea().catch(error => {
  console.error('❌ Erro no teste:', error);
  process.exit(1);
});
