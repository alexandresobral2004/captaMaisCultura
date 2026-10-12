'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Phone, Mail, MapPin, UserCircle, Plus, Sparkles } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { DadosProponente } from './dados-proponente';

interface DadosProponenteFormProps {
  dadosProponente: DadosProponente;
  setDadosProponente: Dispatch<SetStateAction<DadosProponente>>;
  logoPreview: string | null;
  logoDescricao: string;
  setLogoDescricao: (valor: string) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoverLogo: () => void;
}

export function DadosProponenteForm({
  dadosProponente,
  setDadosProponente,
  logoPreview,
  logoDescricao,
  setLogoDescricao,
  onLogoUpload: handleLogoUpload,
  onRemoverLogo: handleRemoverLogo,
}: DadosProponenteFormProps) {
  // Dados Proponente handlers
  const handleAddTelefone = () => {
    setDadosProponente(prev => ({
      ...prev,
      telefones: [...prev.telefones, { tipo: 'Fixo', uf: '', ddd: '', numero: '', divulgar: true }]
    }));
  };

  const handleRemoveTelefone = (index: number) => {
    setDadosProponente(prev => ({
      ...prev,
      telefones: prev.telefones.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateTelefone = (index: number, field: string, value: any) => {
    setDadosProponente(prev => ({
      ...prev,
      telefones: prev.telefones.map((t, i) => i === index ? { ...t, [field]: value } : t)
    }));
  };

  const handleAddEmail = () => {
    setDadosProponente(prev => ({
      ...prev,
      emails: [...prev.emails, { tipo: 'Principal', email: '' }]
    }));
  };

  const handleRemoveEmail = (index: number) => {
    setDadosProponente(prev => ({
      ...prev,
      emails: prev.emails.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateEmail = (index: number, field: string, value: string) => {
    setDadosProponente(prev => ({
      ...prev,
      emails: prev.emails.map((e, i) => i === index ? { ...e, [field]: value } : e)
    }));
  };

  const handleAddDirigente = () => {
    setDadosProponente(prev => ({
      ...prev,
      dirigentes: [...prev.dirigentes, { cpf: '', nome: '' }]
    }));
  };

  const handleRemoveDirigente = (index: number) => {
    setDadosProponente(prev => ({
      ...prev,
      dirigentes: prev.dirigentes.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateDirigente = (index: number, field: string, value: string) => {
    setDadosProponente(prev => ({
      ...prev,
      dirigentes: prev.dirigentes.map((d, i) => i === index ? { ...d, [field]: value } : d)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Logo Upload Section */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Logo da Instituição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {logoPreview ? (
              <div className="relative">
                <img src={logoPreview} alt="Logo preview" className="w-32 h-32 object-contain border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-950" />
                <button aria-label="Remover logo"
                  onClick={handleRemoverLogo}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-blue-400 transition-colors bg-slate-50 dark:bg-slate-900">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs text-slate-500">Upload</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </label>
            )}
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descrição da Logo</label>
              <Input
                value={logoDescricao}
                onChange={(e) => setLogoDescricao(e.target.value)}
                placeholder="Ex: Logo oficial da instituição..."
                className="bg-white dark:bg-slate-950"
              />
              {!logoPreview && (
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">Selecionar Imagem</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identificação */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <UserCircle className="w-4 h-4" />
            Identificação do Proponente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">CNPJ/CPF</label>
              <Input
                value={dadosProponente.cnpjCpf}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, cnpjCpf: e.target.value }))}
                placeholder="00.000.000/0000-00"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Nome do Proponente</label>
              <Input
                value={dadosProponente.nomeProponente}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, nomeProponente: e.target.value }))}
                placeholder="Nome completo ou razão social"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Tipo de Pessoa</label>
              <select
                value={dadosProponente.tipoPessoa}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, tipoPessoa: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-950 text-sm"
              >
                <option value="fisica">Pessoa Física</option>
                <option value="juridica">Pessoa Jurídica</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Endereço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Logradouro</label>
              <Input
                value={dadosProponente.logradouro}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, logradouro: e.target.value }))}
                placeholder="Rua, número, complemento"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Cidade</label>
              <Input
                value={dadosProponente.cidade}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, cidade: e.target.value }))}
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">UF</label>
                <Input
                  value={dadosProponente.uf}
                  onChange={(e) => setDadosProponente(prev => ({ ...prev, uf: e.target.value }))}
                  placeholder="SP"
                  maxLength={2}
                  className="bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">CEP</label>
                <Input
                  value={dadosProponente.cep}
                  onChange={(e) => setDadosProponente(prev => ({ ...prev, cep: e.target.value }))}
                  placeholder="00000-000"
                  className="bg-white dark:bg-slate-950"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telefones */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Telefone(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dadosProponente.telefones.map((tel, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-end p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-lg">
                <div className="w-24">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Tipo</label>
                  <select
                    value={tel.tipo}
                    onChange={(e) => handleUpdateTelefone(i, 'tipo', e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-950 text-xs"
                  >
                    <option value="Fixo">Fixo</option>
                    <option value="Celular">Celular</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                </div>
                <div className="w-12">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">UF</label>
                  <Input value={tel.uf} onChange={(e) => handleUpdateTelefone(i, 'uf', e.target.value)} maxLength={2} className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <div className="w-12">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">DDD</label>
                  <Input value={tel.ddd} onChange={(e) => handleUpdateTelefone(i, 'ddd', e.target.value)} maxLength={2} className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Número</label>
                  <Input value={tel.numero} onChange={(e) => handleUpdateTelefone(i, 'numero', e.target.value)} className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Divulgar</label>
                  <input
                    type="checkbox"
                    checked={tel.divulgar}
                    onChange={(e) => handleUpdateTelefone(i, 'divulgar', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveTelefone(i)} className="h-8 w-8 p-0 text-red-500">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddTelefone} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Telefone
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* E-mails */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            E-mail(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dadosProponente.emails.map((email, i) => (
              <div key={i} className="flex gap-2 items-end p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-lg">
                <div className="w-32">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Tipo</label>
                  <select
                    value={email.tipo}
                    onChange={(e) => handleUpdateEmail(i, 'tipo', e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-950 text-xs"
                  >
                    <option value="Principal">Principal</option>
                    <option value="Secundário">Secundário</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">E-mail</label>
                  <Input value={email.email} onChange={(e) => handleUpdateEmail(i, 'email', e.target.value)} type="email" placeholder="email@exemplo.com" className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveEmail(i)} className="h-8 w-8 p-0 text-red-500">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddEmail} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar E-mail
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Natureza */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">Natureza do Proponente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Natureza</label>
              <Input
                value={dadosProponente.natureza}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, natureza: e.target.value }))}
                placeholder="Ex: Associação, Fundação"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Esfera</label>
              <Input
                value={dadosProponente.esfera}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, esfera: e.target.value }))}
                placeholder="Ex: Federal, Estadual, Municipal"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Administração</label>
              <Input
                value={dadosProponente.administracao}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, administracao: e.target.value }))}
                placeholder="Ex: Direta, Indireta"
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Fins Lucrativos</label>
              <select
                value={dadosProponente.finsLucrativos}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, finsLucrativos: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-950 text-sm"
              >
                <option value="">Selecione</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dirigentes */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <UserCircle className="w-4 h-4" />
            Dirigentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dadosProponente.dirigentes.map((dir, i) => (
              <div key={i} className="flex gap-2 items-end p-3 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-lg">
                <div className="w-40">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">CPF</label>
                  <Input value={dir.cpf} onChange={(e) => handleUpdateDirigente(i, 'cpf', e.target.value)} placeholder="000.000.000-00" className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Nome</label>
                  <Input value={dir.nome} onChange={(e) => handleUpdateDirigente(i, 'nome', e.target.value)} className="bg-white dark:bg-slate-950 text-xs" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveDirigente(i)} className="h-8 w-8 p-0 text-red-500">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddDirigente} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Dirigente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contexto de IA */}
      <Card className="bg-white/60 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Contexto para Inteligência Artificial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Histórico do Proponente</label>
              <Textarea
                value={dadosProponente.historico}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, historico: e.target.value }))}
                placeholder="Descreva o histórico de atuação do proponente na área cultural..."
                className="min-h-[100px] bg-white dark:bg-slate-950 resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Projetos Anteriores</label>
              <Textarea
                value={dadosProponente.projetosAnteriores}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, projetosAnteriores: e.target.value }))}
                placeholder="Liste projetos anteriores relevantes (um por linha)..."
                className="min-h-[100px] bg-white dark:bg-slate-950 resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Capacidade Técnica</label>
              <Textarea
                value={dadosProponente.capacidadeTecnica}
                onChange={(e) => setDadosProponente(prev => ({ ...prev, capacidadeTecnica: e.target.value }))}
                placeholder="Descreva a capacidade técnica e equipe disponível..."
                className="min-h-[100px] bg-white dark:bg-slate-950 resize-y"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
