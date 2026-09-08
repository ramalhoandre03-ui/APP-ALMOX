import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  ChevronLeft, 
  ArrowRight, 
  Search, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  CheckSquare, 
  Square, 
  Database,
  FileSpreadsheet,
  AlertCircle,
  Code2
} from 'lucide-react';

export interface ObraStats {
  totalItens: number;
  totalSolicitado: number;
  totalMobilizado?: number;
  totalDisponivel?: number;
  totalCompras?: number;
  totalTriagem?: number;
}

interface SelecaoObrasViewProps {
  obras: string[];
  obrasSelecionadasIniciais: string[];
  isLoading: boolean;
  dashboardMode: 'manual' | 'autonomous';
  statsPorObra?: Record<string, ObraStats>;
  dadosBrutosNomes?: string[];
  onConfirmar: (obrasSelecionadas: string[]) => void;
  onVoltar: () => void;
  onRefresh?: () => Promise<void> | void;
}

export default function SelecaoObrasView({
  obras,
  obrasSelecionadasIniciais,
  isLoading,
  dashboardMode,
  statsPorObra = {},
  dadosBrutosNomes = [],
  onConfirmar,
  onVoltar,
  onRefresh
}: SelecaoObrasViewProps) {
  // Injeção de força bruta absoluta para D1A garantida na renderização
  const obrasDisponiveis = useMemo(() => {
    let list = [...obras];
    if (!list.some(obra => (typeof obra === 'string' ? obra : '').includes('D1A'))) {
      list.unshift('ALU D1A CALC 3 SLZ 08-26');
    }
    return list;
  }, [obras]);

  // Local state for temporary multi-selection
  const [selecionadas, setSelecionadas] = useState<string[]>(() => {
    if (obrasSelecionadasIniciais && obrasSelecionadasIniciais.length > 0) {
      const valid = obrasSelecionadasIniciais.filter(o => obrasDisponiveis.includes(o));
      if (valid.length > 0) return valid;
    }
    // By default, if nothing was selected yet, select all available obras
    return obrasDisponiveis.length > 0 ? [...obrasDisponiveis] : [];
  });

  const [busca, setBusca] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sincroniza e sanitiza a lista de selecionadas sempre que a lista de obras disponíveis mudar
  React.useEffect(() => {
    if (obrasDisponiveis.length > 0) {
      setSelecionadas(prev => {
        const validPrev = prev.filter(o => obrasDisponiveis.includes(o));
        if (validPrev.length === 0 || validPrev.length > obrasDisponiveis.length) {
          return [...obrasDisponiveis];
        }
        return validPrev;
      });
    }
  }, [obrasDisponiveis]);

  // Validador de localStorage para limpar cache corrompido
  React.useEffect(() => {
    const saved = localStorage.getItem('obrasSelecionadas');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && obrasDisponiveis.length > 0 && parsed.length > obrasDisponiveis.length) {
          console.warn('Cache corrompido detectado. Limpando seleções.');
          localStorage.removeItem('obrasSelecionadas');
          setSelecionadas([...obrasDisponiveis]);
        }
      } catch (e) {
        localStorage.removeItem('obrasSelecionadas');
      }
    }
  }, [obrasDisponiveis]);

  // Filtered obras according to search query
  const obrasFiltradas = useMemo(() => {
    if (!busca.trim()) return obrasDisponiveis;
    const term = busca.toLowerCase().trim();
    return obrasDisponiveis.filter(o => o.toLowerCase().includes(term));
  }, [obrasDisponiveis, busca]);

  const toggleObra = (obra: string) => {
    setSelecionadas(prev => {
      if (prev.includes(obra)) {
        return prev.filter(item => item !== obra);
      } else {
        return [...prev, obra];
      }
    });
  };

  const selecionarTodas = () => {
    setSelecionadas([...obrasDisponiveis]);
  };

  const limparSelecao = () => {
    setSelecionadas([]);
  };

  const handleAvancar = () => {
    if (selecionadas.length === 0) return;
    onConfirmar(selecionadas);
  };

  const handleRefreshClick = async () => {
    if (!onRefresh || isLoading || isRefreshing) return;
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const isAnyLoading = isLoading || isRefreshing;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-black overflow-y-auto" id="selecao-obras-screen">
      
      {/* Top Header Navbar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onVoltar}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 rounded-xl transition-all cursor-pointer shadow-sm hover:border-slate-600"
            title="Voltar para a seleção de fonte"
            id="btn-voltar-selecao-obras"
          >
            <ChevronLeft className="w-5 h-5 text-amber-400" />
          </button>
          
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black uppercase text-white tracking-wide">
                Seleção de Obras e Frentes
              </h1>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                dashboardMode === 'autonomous' 
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
              }`}>
                {dashboardMode === 'autonomous' ? 'Modo Live (Supabase)' : 'Modo Manual'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold">
              Passo 2 de 3: Escolha quais obras deseja monitorar no Dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {onRefresh && (
            <button
              onClick={handleRefreshClick}
              disabled={isAnyLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-xl transition-all cursor-pointer shadow-sm"
              title="Recarregar dados do banco"
              id="btn-atualizar-obras-header"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnyLoading ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
              <span className="hidden sm:inline">{isAnyLoading ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          )}

          <button
            onClick={handleAvancar}
            disabled={selecionadas.length === 0}
            className={`flex items-center gap-2 px-4 py-2 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg cursor-pointer ${
              selecionadas.length > 0
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 active:scale-95 shadow-amber-500/10'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
            id="btn-avancar-dashboard"
          >
            <span>Acessar Dashboard ({selecionadas.length})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col space-y-6">
        
        {/* Loading State */}
        {isLoading && obrasDisponiveis.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-md w-full space-y-4 shadow-2xl">
              <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                <Building2 className="w-7 h-7 text-amber-400 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Sincronizando obras ativas...
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Carregando requisições, pedidos de compra e frentes de mobilização ativas no banco de dados.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Obras Selection Content */
          <div className="space-y-6 animate-fade-in">
            
            {/* Header and Controls */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  Obras Disponíveis ({obrasDisponiveis.length})
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Selecione as obras que deseja acompanhar simultaneamente no painel em abas.
                </p>
              </div>

              {/* Actions, Search & Debug */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Filtrar obra..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors font-medium"
                  />
                </div>

                <button
                  onClick={selecionarTodas}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Selecionar todas as obras"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Todas</span>
                </button>

                <button
                  onClick={limparSelecao}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Limpar seleção"
                >
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>

                <button
                  onClick={() => setShowDebug(prev => !prev)}
                  className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    showDebug
                      ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-400 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                  }`}
                  title="Exibir dados brutos da busca e payload de depuração"
                  id="btn-debug-json"
                >
                  <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Debug JSON</span>
                </button>
              </div>
            </div>

            {/* Badges / Stats Ribbon */}
            <div className="flex items-center justify-between text-xs px-1 text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
                <strong className="text-white font-bold">{selecionadas.length}</strong> de <strong className="text-slate-300">{obrasDisponiveis.length}</strong> obras selecionadas
              </span>
              <span className="text-[11px] text-slate-500">
                Clique nos cards para alternar a seleção
              </span>
            </div>

            {/* Grid of Interactive Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {obrasFiltradas.map((obra) => {
                const isSelected = selecionadas.includes(obra);

                return (
                  <div
                    key={obra}
                    onClick={() => toggleObra(obra)}
                    className={`group relative rounded-2xl p-4.5 border-2 transition-all duration-200 cursor-pointer select-none flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30 transform scale-[1.01]'
                        : 'bg-slate-900/60 hover:bg-slate-850/80 border-slate-800/80 hover:border-slate-700 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div>
                      {/* Top status indicator & Checkbox */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-xl transition-colors ${
                            isSelected 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Obra / Centro de Custo
                          </span>
                        </div>

                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'border-2 border-slate-600 group-hover:border-slate-500 bg-slate-950'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                        </div>
                      </div>

                      {/* Obra Name */}
                      <h3 className={`text-sm font-black tracking-tight leading-snug break-words transition-colors ${
                        isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'
                      }`}>
                        {obra}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Debug JSON Viewer Panel */}
            {showDebug && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 font-mono text-xs overflow-auto max-h-72 space-y-4 text-green-400 shadow-2xl animate-fade-in" id="panel-debug-json">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-200">
                  <div className="flex items-center gap-2 font-bold">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span>DEBUG JSON: Auditoria de Obras e Payload Bruto</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Brutos Únicos: <strong className="text-emerald-400">{dadosBrutosNomes.length}</strong> | Alimentando Cards: <strong className="text-amber-400">{obrasDisponiveis.length}</strong>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-slate-400 font-bold text-[11px]">
                    // 1. Nomes originais ÚNICOS mapeados diretamente do Supabase (sem passar pela Roseta):
                  </div>
                  <pre className="text-emerald-300 bg-slate-950/90 p-3 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {JSON.stringify(dadosBrutosNomes, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="text-slate-400 font-bold text-[11px]">
                    // 2. Array final `obrasDisponiveis` que está alimentando os cards:
                  </div>
                  <pre className="text-emerald-400 bg-slate-950/90 p-3 rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {JSON.stringify(obrasDisponiveis, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Bottom floating CTA on mobile / desktop footer */}
            <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={onVoltar}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all cursor-pointer text-center"
              >
                ← Voltar para Seleção de Fonte
              </button>

              <button
                onClick={handleAvancar}
                disabled={selecionadas.length === 0}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-xl cursor-pointer ${
                  selecionadas.length > 0
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 active:scale-95 shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
                id="btn-avancar-dashboard-bottom"
              >
                <span>Acessar Dashboard ({selecionadas.length} {selecionadas.length === 1 ? 'Obra' : 'Obras'})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-800/60 py-3.5 px-6 text-center text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-6xl mx-auto w-full gap-2">
        <span>CMPC Industrial • Sistema Integrado de Gestão de Almoxarifado</span>
        <span className="font-mono text-slate-400">Ambiente de Inteligência de Mobilizações • Overhaul 2026</span>
      </footer>

    </div>
  );
}
