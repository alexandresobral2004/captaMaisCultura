'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';
import type { FiltrosEditais } from '@/lib/editais/filtros';

interface FiltrosEditaisSidebarProps {
  filtros: FiltrosEditais;
  onChange: (filtros: FiltrosEditais) => void;
}

type ListaFiltro = 'areas' | 'tipos' | 'tiposEdital';

export function FiltrosEditaisSidebar({ filtros, onChange }: FiltrosEditaisSidebarProps) {
  const atualizar = (parcial: Partial<FiltrosEditais>) => onChange({ ...filtros, ...parcial });

  const alternar = (lista: ListaFiltro, valor: string) => {
    const atual = filtros[lista];
    atualizar({ [lista]: atual.includes(valor) ? atual.filter(v => v !== valor) : [...atual, valor] });
  };

  return (
  <div className="filters-sidebar" style={{ width: '280px', flexShrink: 0 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-sm">
            <Filter style={{ width: '1rem', height: '1rem' }} />
            <CardTitle style={{ fontSize: 'var(--font-size-lg)' }}>Filtros</CardTitle>
          </div>
        </CardHeader>
        <CardContent style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="filters-section">
            <label className="filters-section-title">Busca Rápida</label>
            <div style={{ position: 'relative' }}>
              <Search style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '0.875rem',
                height: '0.875rem',
                color: 'var(--color-gray-400)'
              }} />
              <Input
                type="text"
                placeholder="Palavra-chave..."
                value={filtros.busca}
                onChange={(e) => atualizar({ busca: e.target.value })}
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          <div className="filters-section">
            <label className="filters-section-title">Eixo</label>
            <div className="checkbox-group" role="radiogroup" aria-label="Eixo dos editais">
              {([
                ['todos', 'Todos'],
                ['Cultura', '🎭 Cultura'],
                ['Pesquisa', '🔬 TI e Pesquisa'],
              ] as const).map(([valor, rotulo]) => (
                <label key={valor} className="checkbox-item" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="eixo-editais"
                    checked={filtros.eixo === valor}
                    onChange={() => atualizar({ eixo: valor })}
                  />
                  {rotulo}
                </label>
              ))}
            </div>
          </div>

          <div className="filters-section">
            <label className="filters-section-title">Área de Interesse</label>
            <div className="checkbox-group">
              {["Saúde", "Educação", "Cultura", "Infraestrutura", "Esporte"].map(
                (area) => (
                  <label key={area} className="checkbox-item" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={filtros.areas.includes(area)}
                      onChange={() => alternar('areas', area)}
                    />
                    {area}
                  </label>
                )
              )}
            </div>
          </div>

          <div className="filters-section">
             <label className="filters-section-title">Tipo de Instituição</label>
             <div className="checkbox-group">
               {["Federal", "Estadual", "ONG", "Universidade"].map((tipo) => (
                 <label key={tipo} className="checkbox-item" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                   <input 
                     type="checkbox" 
                     checked={filtros.tipos.includes(tipo)}
                     onChange={() => alternar('tipos', tipo)}
                   />
                   {tipo}
                 </label>
               ))}
             </div>
           </div>

           <div className="filters-section">
             <label className="filters-section-title">Tipo de Edital</label>
             <div className="checkbox-group">
               {["Evento", "TI", "Pesquisa"].map((tipo) => (
                 <label key={tipo} className="checkbox-item" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                   <input 
                     type="checkbox" 
                     checked={filtros.tiposEdital.includes(tipo)}
                     onChange={() => alternar('tiposEdital', tipo)}
                   />
                   {tipo}
                 </label>
               ))}
             </div>
           </div>

           <div className="filters-section">
             <label className="filters-section-title">Ordenação</label>
             <div style={{ display: 'flex', gap: '0.5rem' }}>
               <Button 
                 variant={filtros.ordenacao === 'recentes' ? 'default' : 'outline'}
                 size="sm"
                 onClick={() => atualizar({ ordenacao: 'recentes' })}
                 style={{ flex: 1 }}
               >
                 Recentes
               </Button>
               <Button 
                 variant={filtros.ordenacao === 'antigos' ? 'default' : 'outline'}
                 size="sm"
                 onClick={() => atualizar({ ordenacao: 'antigos' })}
                 style={{ flex: 1 }}
               >
                 Antigos
               </Button>
             </div>
           </div>
           
           {(filtros.busca || filtros.areas.length > 0 || filtros.tipos.length > 0 || filtros.tiposEdital.length > 0) && (
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => atualizar({ busca: '', areas: [], tipos: [], tiposEdital: [] })}
               style={{ color: 'var(--color-danger)' }}
             >
               Limpar Filtros
             </Button>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
