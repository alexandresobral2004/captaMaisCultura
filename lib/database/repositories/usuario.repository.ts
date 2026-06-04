import { eq } from 'drizzle-orm';
import { usuarios } from '../schema';
import { BaseRepository } from './base.repository';

export interface CreateUsuarioDTO {
  id: string;
  nome: string;
  email: string;
  password: string;
  role?: 'admin' | 'editor' | 'leitor';
  status?: 'ativo' | 'inativo';
}

export interface UpdateUsuarioDTO {
  nome?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'editor' | 'leitor';
  status?: 'ativo' | 'inativo';
}

export class UsuarioRepository extends BaseRepository {
  async findAll() {
    return this.database
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        role: usuarios.role,
        status: usuarios.status,
        criadoEm: usuarios.criadoEm,
        atualizadoEm: usuarios.atualizadoEm,
      })
      .from(usuarios)
      .orderBy(usuarios.criadoEm);
  }

  async findById(id: string) {
    const result = await this.database
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByEmail(email: string) {
    const result = await this.database
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, email))
      .limit(1);

    return result[0] || null;
  }

  async create(data: CreateUsuarioDTO) {
    const result = await this.database
      .insert(usuarios)
      .values({
        id: data.id,
        nome: data.nome,
        email: data.email,
        password: data.password,
        role: data.role || 'leitor',
        status: data.status || 'ativo',
      })
      .returning();

    return result[0];
  }

  async update(id: string, data: UpdateUsuarioDTO) {
    const updateData: any = { atualizadoEm: new Date().toISOString() };

    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.password !== undefined) updateData.password = data.password;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status;

    const result = await this.database
      .update(usuarios)
      .set(updateData)
      .where(eq(usuarios.id, id))
      .returning();

    return result[0];
  }

  async delete(id: string) {
    await this.database.delete(usuarios).where(eq(usuarios.id, id));
  }
}
