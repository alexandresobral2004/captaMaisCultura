'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatarDataBr } from '@/lib/utils/formatar-data';
import { X, FileUp, CheckCircle, XCircle } from 'lucide-react';

interface UploadPdfModalProps {
  aberto: boolean;
  onFechar: () => void;
  /** Chamado após um upload bem-sucedido, para recarregar a lista. */
  onProcessado: () => void;
}

export function UploadPdfModal({ aberto, onFechar, onProcessado }: UploadPdfModalProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [orgao, setOrgao] = useState('');
  const [categoria, setCategoria] = useState('Cultura');

  const fechar = () => {
    setUploadResult(null);
    setUploadProgress(0);
    setSelectedFile(null);
    setTitulo('');
    setOrgao('');
    onFechar();
  };

  const concluir = () => {
    fechar();
    onProcessado();
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      if (titulo) formData.append('titulo', titulo);
      if (orgao) formData.append('orgao', orgao);
      formData.append('categoriaArea', categoria);

      setUploadProgress(30);
      const res = await fetch('/api/v1/editais/upload-pdf', { method: 'POST', body: formData });
      setUploadProgress(80);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Erro ao processar upload');
      }

      setUploadProgress(100);
      setUploadResult(data.data);
      onProcessado();
    } catch (error: any) {
      setUploadResult({
        erros: [error.message || 'Erro desconhecido'],
        titulo: selectedFile.name,
        tecnologiaFoco: 'N/A',
        scoreRelevancia: 0,
        confiancaIA: 0,
      });
    } finally {
      setUploading(false);
    }
  };

  if (!aberto) return null;

  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FileUp className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Upload de Edital</h3>
                <p className="text-xs text-slate-400">Envie um PDF para análise automática</p>
              </div>
            </div>
            <button aria-label="Fechar"
              onClick={fechar}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {!uploadResult ? (
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* Drop zone */}
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${selectedFile ? 'border-green-500/50 bg-green-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'}`}>
                    <FileUp className={`w-12 h-12 mx-auto mb-3 ${selectedFile ? 'text-green-400' : 'text-slate-500'}`} />
                    {selectedFile ? (
                      <>
                        <p className="text-green-400 font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <p className="text-slate-300 font-medium">Arraste o PDF aqui ou clique</p>
                        <p className="text-xs text-slate-500 mt-1">Máximo 50MB</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Campos */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Título (opcional)</label>
                    <Input
                      id="upload-titulo"
                      placeholder="Deixe vazio para usar o nome do arquivo"
                      className="bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Órgão (opcional)</label>
                    <Input
                      id="upload-orgao"
                      placeholder="Ex: FINEP, CNPq, CAPES"
                      className="bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Área / Categoria</label>
                    <select
                      id="upload-categoria"
                      className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="Cultura">🎭 Cultura</option>
                      <option value="Pesquisa">🔬 Pesquisa e Tecnologia</option>
                      <option value="Esporte">⚽ Esporte</option>
                      <option value="Infraestrutura">🚧 Infraestrutura</option>
                      <option value="Outros">📁 Outros</option>
                    </select>
                  </div>
                </div>

                {/* Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 text-center">
                      Processando PDF... {uploadProgress}%
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fechar}
                    disabled={uploading}
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white border-none"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analisando...
                      </span>
                    ) : (
                      'Analisar'
                    )}
                  </Button>
                </div>
              </form>
            ) : uploadResult.erros && uploadResult.erros.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">Erro no processamento</span>
                  </div>
                  {uploadResult.erros.map((erro: string, i: number) => (
                    <p key={i} className="text-sm text-red-300/80">{erro}</p>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadResult(null);
                      setUploadProgress(0);
                      setSelectedFile(null);
                    }}
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Tentar Novamente
                  </Button>
                  <Button
                    onClick={concluir}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white border-none"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100">Edital processado!</p>
                      <p className="text-xs text-slate-400">Análise por IA concluída</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-700/50">
                      <span className="text-slate-400">Título</span>
                      <span className="text-slate-200 font-medium truncate max-w-[200px]">{uploadResult.titulo}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-700/50">
                      <span className="text-slate-400">Tecnologia</span>
                      <span className="text-blue-400">{uploadResult.tecnologiaFoco}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-700/50">
                      <span className="text-slate-400">Nota da IA</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-green-400"
                            style={{ width: `${uploadResult.scoreRelevancia}%` }}
                          />
                        </div>
                        <span className="text-slate-200">{uploadResult.scoreRelevancia}</span>
                      </div>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Confiança</span>
                      <span className="text-green-400">{uploadResult.confiancaIA}%</span>
                    </div>
                  </div>

                  {uploadResult.prazoVencido && (
                    <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
                      Este edital está vencido{uploadResult.dataLimite ? ` (prazo: ${formatarDataBr(uploadResult.dataLimite)})` : ''}.
                      Editais vencidos ficam fora da lista de editais abertos, então ele não vai aparecer lá.
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={fechar}
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Fechar
                  </Button>
                  <Button
                    onClick={concluir}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white border-none"
                  >
                    Ver na Lista
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
