import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { validarComOpenAI } from '../lib/filtros-ti/openai-classifier';
import { cacheValidacao } from '../lib/filtros-ti/cache';

vi.mock('axios');

describe('OpenAI Classifier (Filtro TI)', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'mock-key';
    cacheValidacao.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('deve retornar erro de autenticação se a chave da API não estiver configurada', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await validarComOpenAI('Título do edital', 'Descrição do edital');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.erroTipo).toBe('auth');
      expect(result.mensagem).toContain('OPENAI_API_KEY não configurada');
    }
  });

  it('deve classificar com sucesso se a API retornar JSON válido', async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                válido: true,
                tecnologia: 'IA & Machine Learning',
                tipo: 'Plataforma',
                score: 85,
                confiança: 90,
                razão: 'Foco claro em IA e Machine Learning'
              })
            }
          }
        ]
      }
    };

    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    const result = await validarComOpenAI('Edital IA', 'Desenvolvimento de plataforma de IA');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.válido).toBe(true);
      expect(result.tecnologia).toBe('IA & Machine Learning');
      expect(result.categoria).toBe('IA & Machine Learning');
      expect(result.tipo).toBe('Plataforma');
      expect(result.tipoFerramenta).toBe('Plataforma');
      expect(result.score).toBe(85);
      expect(result.confianca).toBe(90);
      expect(result.confiança).toBe(90);
      expect(result.razão).toBe('Foco claro em IA e Machine Learning');
    }
  });

  it('deve tratar erro de parse se o conteúdo retornado não tiver JSON válido', async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: 'Isso não é um JSON'
            }
          }
        ]
      }
    };

    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    const result = await validarComOpenAI('Edital IA', 'Desenvolvimento de plataforma de IA');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.erroTipo).toBe('parse');
      expect(result.mensagem).toMatch(/sem JSON no conteúdo|JSON inválido retornado/);
    }
  });

  it('deve tratar erro 429 como rate limit', async () => {
    const error429 = {
      name: 'AxiosError',
      message: 'Request failed with status code 429',
      isAxiosError: true,
      response: {
        status: 429,
        data: 'Rate limit exceeded'
      }
    };

    vi.mocked(axios.post).mockRejectedValueOnce(error429);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const result = await validarComOpenAI('Edital IA', 'Desenvolvimento de plataforma de IA');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.erroTipo).toBe('rate_limit');
      expect(result.mensagem).toBe('Request failed with status code 429');
    }
  });

  it('deve tratar erro 401 como erro de autenticação', async () => {
    const error401 = {
      name: 'AxiosError',
      message: 'Request failed with status code 401',
      isAxiosError: true,
      response: {
        status: 401,
        data: 'Unauthorized access'
      }
    };

    vi.mocked(axios.post).mockRejectedValueOnce(error401);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const result = await validarComOpenAI('Edital IA', 'Desenvolvimento de plataforma de IA');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.erroTipo).toBe('auth');
      expect(result.mensagem).toBe('Request failed with status code 401');
    }
  });

  it('deve tratar erro de timeout abortado', async () => {
    const abortError = {
      name: 'AbortError',
      message: 'The user aborted a request.'
    };

    vi.mocked(axios.post).mockRejectedValueOnce(abortError);

    const result = await validarComOpenAI('Edital IA', 'Desenvolvimento de plataforma de IA');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.erroTipo).toBe('timeout');
      expect(result.mensagem).toContain('OpenAI API request timed out');
    }
  });
});
