import { z } from 'zod';

export const WhitelistSchema = z.object({
  tecnologia: z.array(z.string()),
  contexto_institucional: z.array(z.string()),
  contexto_geral: z.array(z.string())
});

export type WhitelistData = z.infer<typeof WhitelistSchema>;

export const BlacklistSchema = z.object({
  blacklist: z.array(z.string()),
  excecoes: z.record(z.string(), z.array(z.string()))
});

export type BlacklistData = z.infer<typeof BlacklistSchema>;

export const RegraInferenciaTecnologiaSchema = z.object({
  categoria: z.string(),
  palavras: z.array(z.string())
});

export const RegraInferenciaTipoSchema = z.object({
  tipo: z.string(),
  palavras: z.array(z.string())
});

export const CategoriasSchema = z.object({
  normalizacaoTecnologia: z.record(z.string(), z.string()),
  normalizacaoTipo: z.record(z.string(), z.string()),
  regrasInferenciaTecnologia: z.array(RegraInferenciaTecnologiaSchema),
  regrasInferenciaTipo: z.array(RegraInferenciaTipoSchema)
});

export type CategoriasData = z.infer<typeof CategoriasSchema>;
