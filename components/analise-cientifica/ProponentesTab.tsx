'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, UserPlus, ExternalLink } from 'lucide-react';

export interface Pesquisador {
  nome: string;
  cpf: string;
  titulacao: string;
  vinculo: string;
  funcao: string;
  lattes: string;
}

const PROPONENTE_VAZIO: Pesquisador = {
  nome: '',
  cpf: '',
  titulacao: 'Doutorado',
  vinculo: '',
  funcao: 'Coordenador',
  lattes: '',
};

interface ProponentesTabProps {
  proponentes: Pesquisador[];
  onChange: (proponentes: Pesquisador[]) => void;
}

export function ProponentesTab({ proponentes, onChange }: ProponentesTabProps) {
  const [novoProponente, setNovoProponente] = useState<Pesquisador>(PROPONENTE_VAZIO);

  const adicionar = () => {
    if (!novoProponente.nome || !novoProponente.cpf) return;
    onChange([...proponentes, novoProponente]);
    setNovoProponente({ ...PROPONENTE_VAZIO, funcao: 'Pesquisador' });
  };

  const remover = (index: number) => {
    onChange(proponentes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      
      {/* Form de Cadastro */}
      <Card className="shadow-sm rounded-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-500" />
            <CardTitle className="text-base font-bold">Cadastrar Novo Pesquisador Proponente</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Nome Completo</label>
              <Input
                placeholder="Nome do pesquisador..."
                value={novoProponente.nome}
                onChange={(e) => setNovoProponente({ ...novoProponente, nome: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">CPF</label>
              <Input
                placeholder="000.000.000-00"
                value={novoProponente.cpf}
                onChange={(e) => setNovoProponente({ ...novoProponente, cpf: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Titulação Máxima</label>
              <select
                value={novoProponente.titulacao}
                onChange={(e) => setNovoProponente({ ...novoProponente, titulacao: e.target.value })}
                className="w-full flex h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="Graduação">Graduação</option>
                <option value="Especialização">Especialização</option>
                <option value="Mestrado">Mestrado</option>
                <option value="Doutorado">Doutorado</option>
                <option value="Pós-Doutorado">Pós-Doutorado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Vínculo Institucional</label>
              <Input
                placeholder="Ex: USP, UNICAMP, UFMG..."
                value={novoProponente.vinculo}
                onChange={(e) => setNovoProponente({ ...novoProponente, vinculo: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Função no Projeto</label>
              <select
                value={novoProponente.funcao}
                onChange={(e) => setNovoProponente({ ...novoProponente, funcao: e.target.value })}
                className="w-full flex h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="Coordenador">Coordenador Geral</option>
                <option value="Pesquisador Principal">Pesquisador Principal</option>
                <option value="Pesquisador Associado">Pesquisador Associado</option>
                <option value="Bolsista">Bolsista</option>
                <option value="Técnico de Apoio">Técnico de Apoio</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Link Currículo Lattes</label>
              <Input
                placeholder="http://lattes.cnpq.br/..."
                value={novoProponente.lattes}
                onChange={(e) => setNovoProponente({ ...novoProponente, lattes: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={adicionar} className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border-0">
              <Plus className="w-4 h-4" />
              Adicionar Pesquisador
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Proponentes Cadastrados */}
      <Card className="shadow-sm rounded-2xl border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold">Pesquisadores Proponentes Cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {proponentes.length === 0 ? (
            <p className="text-sm text-slate-500 italic p-8 text-center bg-slate-50 dark:bg-slate-900/10 rounded-b-2xl">
              Nenhum proponente cadastrado para a capa do PDF.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
                <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-6 py-3">Nome</th>
                    <th className="px-6 py-3">CPF</th>
                    <th className="px-6 py-3">Titulação</th>
                    <th className="px-6 py-3">Vínculo</th>
                    <th className="px-6 py-3">Função</th>
                    <th className="px-6 py-3">Lattes</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {proponentes.map((p, idx) => (
                    <tr key={idx} className="border-b dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{p.nome}</td>
                      <td className="px-6 py-4">{p.cpf}</td>
                      <td className="px-6 py-4">{p.titulacao}</td>
                      <td className="px-6 py-4">{p.vinculo}</td>
                      <td className="px-6 py-4">
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-350 border-0 rounded-lg">
                          {p.funcao}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {p.lattes ? (
                          <a href={p.lattes} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline">
                            Lattes <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remover(idx)}
                          className="text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
