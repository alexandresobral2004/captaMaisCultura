import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { UsuarioRepository, CreateUsuarioDTO } from '../repositories/usuario.repository';

export interface CadastroDTO {
  nome: string;
  email: string;
  password: string;
  confirmarPassword: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

const SALT_ROUNDS = 10;

export class UsuarioService {
  private repo: UsuarioRepository;

  constructor() {
    this.repo = new UsuarioRepository();
  }

  async cadastrar(data: CadastroDTO) {
    if (data.password !== data.confirmarPassword) {
      throw new Error('Senhas nao coincidem');
    }

    if (data.password.length < 6) {
      throw new Error('Senha deve ter no minimo 6 caracteres');
    }

    if (!data.email || !data.email.includes('@')) {
      throw new Error('Email invalido');
    }

    const existente = await this.repo.findByEmail(data.email);
    if (existente) {
      throw new Error('Email ja cadastrado');
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    const usuario = await this.repo.create({
      id: uuid(),
      nome: data.nome,
      email: data.email,
      password: hashedPassword,
      role: 'leitor',
      status: 'ativo',
    });

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      status: usuario.status,
      criadoEm: usuario.criadoEm,
    };
  }

  async login(data: LoginDTO) {
    if (!data.email || !data.password) {
      throw new Error('Email e senha sao obrigatorios');
    }

    const usuario = await this.repo.findByEmail(data.email);
    if (!usuario) {
      throw new Error('Credenciais invalidas');
    }

    if (usuario.status === 'inativo') {
      throw new Error('Conta desativada');
    }

    const senhaValida = await bcrypt.compare(data.password, usuario.password);
    if (!senhaValida) {
      throw new Error('Credenciais invalidas');
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      status: usuario.status,
    };
  }

  async listar() {
    return this.repo.findAll();
  }

  async buscarPorId(id: string) {
    const usuario = await this.repo.findById(id);
    if (!usuario) return null;

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      status: usuario.status,
      criadoEm: usuario.criadoEm,
      atualizadoEm: usuario.atualizadoEm,
    };
  }

  async atualizar(id: string, data: { nome?: string; email?: string; role?: string; status?: string }) {
    const existente = await this.repo.findById(id);
    if (!existente) {
      throw new Error('Usuario nao encontrado');
    }

    if (data.email && data.email !== existente.email) {
      const emailExiste = await this.repo.findByEmail(data.email);
      if (emailExiste) {
        throw new Error('Email ja cadastrado');
      }
    }

    const atualizado = await this.repo.update(id, {
      nome: data.nome,
      email: data.email,
      role: data.role as any,
      status: data.status as any,
    });

    return {
      id: atualizado.id,
      nome: atualizado.nome,
      email: atualizado.email,
      role: atualizado.role,
      status: atualizado.status,
      atualizadoEm: atualizado.atualizadoEm,
    };
  }

  async atualizarSenha(id: string, novaSenha: string) {
    const existente = await this.repo.findById(id);
    if (!existente) {
      throw new Error('Usuario nao encontrado');
    }

    if (novaSenha.length < 6) {
      throw new Error('Senha deve ter no minimo 6 caracteres');
    }

    const hashedPassword = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await this.repo.update(id, { password: hashedPassword });

    return { message: 'Senha atualizada com sucesso' };
  }

  async deletar(id: string) {
    const existente = await this.repo.findById(id);
    if (!existente) {
      throw new Error('Usuario nao encontrado');
    }

    await this.repo.delete(id);
    return { message: 'Usuario removido com sucesso' };
  }
}
