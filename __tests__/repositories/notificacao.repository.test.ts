import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../lib/database/db';
import { notificacoes } from '../../lib/database/schema';
import {
  salvarNotificacao,
  listarNotificacoes,
  contarNaoLidas,
  marcarNotificacaoLida,
  existeNotificacao,
  type Notificacao,
} from '../../lib/database/repositories/notificacao.repository';
import { uniqueId } from '../helpers';

function notificacao(overrides: Partial<Notificacao> = {}): Notificacao {
  return {
    id: uniqueId('notif'),
    tipo: 'editais_novos',
    titulo: 'Novos editais',
    descricao: 'Encontrados editais aguardando revisão.',
    quantidade: 3,
    link: '/editais?tab=review',
    lida: false,
    urgencia: 'alta',
    criadoEm: new Date('2026-10-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('repositório de notificações (banco)', () => {
  beforeEach(async () => {
    await db.delete(notificacoes);
  });

  it('salva uma notificação e a devolve com os campos e a data como Date', async () => {
    const original = notificacao({ titulo: 'Teste de gravação' });
    await salvarNotificacao(original);

    const [lida] = await listarNotificacoes({});
    expect(lida).toMatchObject({
      id: original.id,
      tipo: 'editais_novos',
      titulo: 'Teste de gravação',
      quantidade: 3,
      link: '/editais?tab=review',
      lida: false,
      urgencia: 'alta',
    });
    expect(lida.criadoEm).toBeInstanceOf(Date);
    expect(lida.criadoEm.toISOString()).toBe('2026-10-01T10:00:00.000Z');
  });

  it('não duplica quando o mesmo id é salvo de novo', async () => {
    const id = uniqueId('alerta');
    await salvarNotificacao(notificacao({ id }));
    await salvarNotificacao(notificacao({ id, titulo: 'Outro texto' }));

    const todas = await listarNotificacoes({});
    expect(todas).toHaveLength(1);
    expect(todas[0].titulo).toBe('Novos editais');
  });

  it('filtra por lida e por tipo', async () => {
    const naoLida = notificacao({ tipo: 'editais_novos' });
    const lida = notificacao({ tipo: 'erro_analise', lida: true });
    await salvarNotificacao(naoLida);
    await salvarNotificacao(lida);

    const naoLidas = await listarNotificacoes({ lida: false });
    expect(naoLidas.map((n) => n.id)).toEqual([naoLida.id]);

    const doTipo = await listarNotificacoes({ tipo: 'erro_analise' });
    expect(doTipo.map((n) => n.id)).toEqual([lida.id]);
  });

  it('lista da mais recente para a mais antiga e respeita o limite', async () => {
    await salvarNotificacao(notificacao({ titulo: 'antiga', criadoEm: new Date('2026-10-01T00:00:00.000Z') }));
    await salvarNotificacao(notificacao({ titulo: 'recente', criadoEm: new Date('2026-10-03T00:00:00.000Z') }));
    await salvarNotificacao(notificacao({ titulo: 'meio', criadoEm: new Date('2026-10-02T00:00:00.000Z') }));

    const duas = await listarNotificacoes({ limite: 2 });
    expect(duas.map((n) => n.titulo)).toEqual(['recente', 'meio']);
  });

  it('conta as não lidas, sem depender do filtro de listagem', async () => {
    await salvarNotificacao(notificacao());
    await salvarNotificacao(notificacao());
    await salvarNotificacao(notificacao({ lida: true }));

    expect(await contarNaoLidas()).toBe(2);
  });

  it('marca como lida e tira da contagem; id inexistente não falha', async () => {
    const n = notificacao();
    await salvarNotificacao(n);

    await marcarNotificacaoLida(n.id);
    await marcarNotificacaoLida('nao-existe');

    expect(await contarNaoLidas()).toBe(0);
    const [depois] = await listarNotificacoes({ lida: true });
    expect(depois.id).toBe(n.id);
  });

  it('informa se um id já existe', async () => {
    const n = notificacao();
    expect(await existeNotificacao(n.id)).toBe(false);

    await salvarNotificacao(n);
    expect(await existeNotificacao(n.id)).toBe(true);
  });
});
