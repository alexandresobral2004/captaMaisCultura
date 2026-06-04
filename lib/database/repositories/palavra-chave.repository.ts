import { eq } from 'drizzle-orm';
import { palavrasChave } from '../schema';
import { BaseRepository } from './base.repository';

export class PalavraChaveRepository extends BaseRepository {
  async findByEditalId(editalId: string) {
    return this.database
      .select()
      .from(palavrasChave)
      .where(eq(palavrasChave.editalId, editalId));
  }

  async createOrUpdate(editalId: string, palavras: string[]) {
    // Deletar existentes
    await this.database
      .delete(palavrasChave)
      .where(eq(palavrasChave.editalId, editalId));

    // Inserir novas
    if (palavras.length > 0) {
      await this.database.insert(palavrasChave).values(
        palavras.map((palavra) => ({
          editalId,
          palavra,
          frequencia: 1,
        }))
      );
    }
  }

  async delete(editalId: string) {
    await this.database
      .delete(palavrasChave)
      .where(eq(palavrasChave.editalId, editalId));
  }
}
