import React, { useEffect, useState, useRef } from 'react';
import { 
  UserPlus, 
  FileText, 
  Check, 
  Mail, 
  Search, 
  Users, 
  ArrowLeft, 
  ChevronRight, 
  Sparkles, 
  CheckSquare, 
  AlertTriangle,
  RefreshCw,
  Layers,
  CheckCircle,
  CheckCircle2,
  Pencil,
  Trash2,
  UserCheck,
  Lock,
  X,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { AdmissionRecord } from './FardamentoAdmissoes';
import CpfMaskedView from './CpfMaskedView';
import { supabase } from '../lib/supabase';

export function mascararCpfLgpd(cpfRaw: string): string {
  if (!cpfRaw || cpfRaw.trim() === '' || cpfRaw.trim() === 'S/N' || cpfRaw.trim() === 'N/A') return '***.***.***-**';
  const clean = cpfRaw.replace(/\D/g, '');
  if (clean.length === 11) {
    return `***.***.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  }
  if (clean.length >= 6) {
    return `***.***.${clean.slice(-5, -2)}-${clean.slice(-2)}`;
  }
  return '***.***.***-**';
}

interface LoteAdmissaoColaborador {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  obra: string;
  status: 'pendente' | 'concluido';
  tamanho_camisa?: string;
  tamanho_calca?: string;
  tamanho_bota?: string;
  tipo_camisa?: string;
  tipo_calca?: string;
  tipo_bota?: string;
}

interface RhPendentesFlowProps {
  admissions: AdmissionRecord[];
  filteredAdmissions: AdmissionRecord[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleRegisterAdmission: (e: React.FormEvent) => void;
  handleCpfChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRequestRM: (record: AdmissionRecord) => void;
  handleUpdateStatus: (id: string, newStatus: AdmissionRecord['status']) => void;
  handleOpenKitChecklist: (record: AdmissionRecord) => void;
  handleStartEdit: (record: AdmissionRecord) => void;
  handleDeleteAdmission: (id: string, name: string) => void;
  selectedBatchIds: string[];
  setSelectedBatchIds: (ids: string[]) => void;
  setShowBatchModal: (show: boolean) => void;
  editingRecord: AdmissionRecord | null;
  setEditingRecord: (rec: AdmissionRecord | null) => void;
  nome: string;
  setNome: (val: string) => void;
  cpf: string;
  setCpf: (val: string) => void;
  dataAgendamento: string;
  setDataAgendamento: (val: string) => void;
  cargo: string;
  setCargo: (val: string) => void;
  obra: string;
  setObra: (val: string) => void;
  tipoCamisa: string;
  setTipoCamisa: (val: string) => void;
  tamanhoCamisa: string;
  setTamanhoCamisa: (val: string) => void;
  tipoCalca: string;
  setTipoCalca: (val: string) => void;
  tamanhoCalca: string;
  setTamanhoCalca: (val: string) => void;
  tipoBota: string;
  setTipoBota: (val: string) => void;
  tamanhoBota: string;
  setTamanhoBota: (val: string) => void;
  kitGerado: string[];
  setKitGerado: (kit: string[]) => void;
  kitCompilado: boolean;
  setKitCompilado: (val: boolean) => void;
  trocaItems: any;
  setTrocaItems: (items: any) => void;
  tipoRequisicao: 'Admissão' | 'Troca';
  setTipoRequisicao: (val: 'Admissão' | 'Troca') => void;
  isRetroactiveDate: boolean;
  compileKit: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  session: any;
  usingFallback: boolean;
  setUsingFallback: (val: boolean) => void;
  saveAdmissionsToPersistence: (list: AdmissionRecord[]) => Promise<void>;
  setAdmissions: (list: AdmissionRecord[]) => void;
  emailTecnico: string;
  setEmailTecnico: (val: string) => void;
  rhFlowMode: 'menu' | 'manual_admissao' | 'manual_troca' | 'lote_excel';
  setRhFlowMode: (mode: 'menu' | 'manual_admissao' | 'manual_troca' | 'lote_excel') => void;
  loteAdmissao: LoteAdmissaoColaborador[];
  setLoteAdmissao: (lote: LoteAdmissaoColaborador[]) => void;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  dataAgendamentoLote: string;
  setDataAgendamentoLote: (date: string) => void;
  handleExcelUpload: (file: File) => void;
  handleSaveAndNext: () => void;
  handleConcluirLote: () => void;
  formatDateBR: (dateStr: string) => string;
  isDateToday: (dateStr: string) => boolean;
}

export const RhPendentesFlow: React.FC<RhPendentesFlowProps> = ({
  admissions,
  filteredAdmissions,
  searchQuery,
  setSearchQuery,
  handleRegisterAdmission,
  handleCpfChange,
  handleRequestRM,
  handleUpdateStatus,
  handleOpenKitChecklist,
  handleStartEdit,
  handleDeleteAdmission,
  selectedBatchIds,
  setSelectedBatchIds,
  setShowBatchModal,
  editingRecord,
  setEditingRecord,
  nome,
  setNome,
  cpf,
  setCpf,
  dataAgendamento,
  setDataAgendamento,
  cargo,
  setCargo,
  obra,
  setObra,
  tipoCamisa,
  setTipoCamisa,
  tamanhoCamisa,
  setTamanhoCamisa,
  tipoCalca,
  setTipoCalca,
  tamanhoCalca,
  setTamanhoCalca,
  tipoBota,
  setTipoBota,
  tamanhoBota,
  setTamanhoBota,
  kitGerado,
  setKitGerado,
  kitCompilado,
  setKitCompilado,
  trocaItems,
  setTrocaItems,
  tipoRequisicao,
  setTipoRequisicao,
  isRetroactiveDate,
  compileKit,
  showToast,
  session,
  usingFallback,
  setUsingFallback,
  saveAdmissionsToPersistence,
  setAdmissions,
  rhFlowMode,
  setRhFlowMode,
  loteAdmissao,
  setLoteAdmissao,
  selectedIndex,
  setSelectedIndex,
  dataAgendamentoLote,
  setDataAgendamentoLote,
  handleExcelUpload,
  handleSaveAndNext,
  handleConcluirLote,
  formatDateBR,
  isDateToday,
  emailTecnico,
  setEmailTecnico
}) => {
  const selectedColab = loteAdmissao[selectedIndex] || null;

  const [queueTab, setQueueTab] = useState<'fila' | 'outros'>('fila');
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([]);

  // Autocomplete / Searchable Colaboradores list for Troca / Reposição de Fardamento
  const [colaboradoresList, setColaboradoresList] = useState<{ id: string; nome: string; cpf: string; cargo: string; obra: string; }[]>([]);
  const [isLoadingColaboradores, setIsLoadingColaboradores] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isColaboradorSelectedFromDb, setIsColaboradorSelectedFromDb] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch colaboradores do Supabase para a busca
  const fetchColaboradores = async () => {
    setIsLoadingColaboradores(true);
    try {
      const { data, error } = await supabase
        .from('admissoes_fardamento')
        .select('id, nome, cpf, cargo, obra')
        .order('nome', { ascending: true });

      const uniqueMap = new Map<string, { id: string; nome: string; cpf: string; cargo: string; obra: string; }>();

      if (!error && data) {
        data.forEach((item: any) => {
          if (item.nome && item.nome.trim()) {
            const key = (item.cpf || item.nome).trim().toLowerCase();
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, {
                id: item.id || crypto.randomUUID(),
                nome: item.nome.trim(),
                cpf: item.cpf ? item.cpf.trim() : '',
                cargo: item.cargo ? item.cargo.trim() : '',
                obra: item.obra ? item.obra.trim() : ''
              });
            }
          }
        });
      }

      // Merge local admissions prop to guarantee instant responsiveness
      (admissions || []).forEach((item: any) => {
        if (item.nome && item.nome.trim()) {
          const key = (item.cpf || item.nome).trim().toLowerCase();
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, {
              id: item.id || crypto.randomUUID(),
              nome: item.nome.trim(),
              cpf: item.cpf ? item.cpf.trim() : '',
              cargo: item.cargo ? item.cargo.trim() : '',
              obra: item.obra ? item.obra.trim() : ''
            });
          }
        }
      });

      setColaboradoresList(Array.from(uniqueMap.values()));
    } catch (err) {
      console.warn("Erro ao buscar colaboradores para fardamento:", err);
    } finally {
      setIsLoadingColaboradores(false);
    }
  };

  useEffect(() => {
    fetchColaboradores();
  }, [admissions]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When editing record changes, set selection flag if values exist
  useEffect(() => {
    if (editingRecord) {
      setIsColaboradorSelectedFromDb(true);
    }
  }, [editingRecord]);

  const handleSelectColaborador = (colab: { nome: string; cpf: string; cargo: string; obra: string; }) => {
    // Seta os dados no formulário, forçando e garantindo o repasse da obra
    setNome(colab.nome || '');
    setCpf(colab.cpf || '');
    setCargo(colab.cargo || '');
    setObra(colab.obra ? colab.obra.trim() : (obra || ''));
    setIsColaboradorSelectedFromDb(true);
    setIsDropdownOpen(false);
    if (showToast) {
      showToast(`Colaborador ${colab.nome} selecionado! CPF, Cargo e Obra preenchidos automaticamente.`, 'success');
    }
  };

  const handleClearSelectedColaborador = () => {
    setNome('');
    setCpf('');
    setCargo('');
    setObra('');
    setIsColaboradorSelectedFromDb(false);
    setIsDropdownOpen(true);
  };

  // Filter list by typed name or CPF
  const filteredColaboradores = colaboradoresList.filter(colab => {
    if (!nome.trim()) return true;
    const query = nome.toLowerCase().trim();
    const cleanCpfQuery = query.replace(/\D/g, '');
    const cleanColabCpf = (colab.cpf || '').replace(/\D/g, '');
    return (
      colab.nome.toLowerCase().includes(query) ||
      (cleanCpfQuery.length > 2 && cleanColabCpf.includes(cleanCpfQuery))
    );
  });

  const handleGenerateBatch = () => {
    // 1. Pega apenas os colaboradores que foram selecionados na tabela
    const colaboradoresSelecionados = admissions.filter(colab => selectedQueueIds.includes(colab.id));

    if (colaboradoresSelecionados.length === 0) {
      alert("Selecione pelo menos um colaborador para gerar o lote.");
      return;
    }

    // 2. Extrai as obras únicas usando um Set
    const obrasUnicas = new Set(colaboradoresSelecionados.map(colab => (colab.obra || '').trim()));

    // 3. Bloqueia a operação se houver mais de uma obra
    if (obrasUnicas.size > 1) {
      alert("OPERAÇÃO BLOQUEADA: Você selecionou colaboradores de obras diferentes. A regra de negócio exige que um lote/RM contenha apenas colaboradores do mesmo centro de custo.");
      return; // Interrompe a execução aqui
    }

    // 4. Se passou pela validação, continua o fluxo normal (abre modal, etc)
    setSelectedBatchIds(selectedQueueIds);
    setShowBatchModal(true);
  };

  const [loteCamisaSize, setLoteCamisaSize] = useState('3');
  const [loteCalcaSize, setLoteCalcaSize] = useState('40');
  const [loteBotaSize, setLoteBotaSize] = useState('40');
  const [loteCamisaType, setLoteCamisaType] = useState('Brim Cinza');
  const [loteCalcaType, setLoteCalcaType] = useState('Jeans');
  const [loteBotaType, setLoteBotaType] = useState('Anti Torção');

  useEffect(() => {
    if (selectedColab) {
      setLoteCamisaSize(selectedColab.tamanho_camisa || '3');
      setLoteCalcaSize(selectedColab.tamanho_calca || '40');
      setLoteBotaSize(selectedColab.tamanho_bota || '40');
      setLoteCamisaType(selectedColab.tipo_camisa || 'Brim Cinza');
      setLoteCalcaType(selectedColab.tipo_calca || 'Jeans');
      setLoteBotaType(selectedColab.tipo_bota || 'Anti Torção');
    }
  }, [selectedIndex, loteAdmissao]);

  const innerSaveAndNext = () => {
    if (!selectedColab) return;

    const updatedLote = loteAdmissao.map((colab, idx) => {
      if (idx === selectedIndex) {
        return {
          ...colab,
          tamanho_camisa: loteCamisaSize,
          tamanho_calca: loteCalcaSize,
          tamanho_bota: loteBotaSize,
          tipo_camisa: loteCamisaType,
          tipo_calca: loteCalcaType,
          tipo_bota: loteBotaType,
          status: 'concluido' as const
        };
      }
      return colab;
    });

    setLoteAdmissao(updatedLote);
    showToast(`Dados de ${selectedColab.nome} salvos!`);

    const nextPendenteIdx = updatedLote.findIndex((colab, idx) => idx > selectedIndex && colab.status === 'pendente');
    if (nextPendenteIdx !== -1) {
      setSelectedIndex(nextPendenteIdx);
    } else {
      const firstPendenteIdx = updatedLote.findIndex(colab => colab.status === 'pendente');
      if (firstPendenteIdx !== -1) {
        setSelectedIndex(firstPendenteIdx);
      } else {
        showToast('Todos os colaboradores do lote foram configurados! Pronto para gravar no sistema.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {rhFlowMode === 'lote_excel' ? (
        loteAdmissao.length === 0 ? (
          /* Drag and Drop Container */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-850 pb-4">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h2 className="text-sm font-black uppercase text-white tracking-wider">Importar Lote de Admissão via Excel</h2>
              </div>
              <button
                onClick={() => setRhFlowMode('menu')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border border-slate-700/50"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
                Siga o layout padrão de colunas para importação correta. O sistema irá extrair automaticamente:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['Nome', 'CPF', 'Obra', 'Função'].map(f => (
                  <div key={f} className="bg-slate-950 border border-slate-850 rounded-xl p-3 text-center">
                    <span className="text-xs font-mono font-bold text-indigo-400">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Drag and Drop Container */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                  handleExcelUpload(file);
                } else {
                  showToast('Por favor, envie um arquivo Excel (.xlsx ou .xls)', 'error');
                }
              }}
              className="border-2 border-dashed border-slate-850 hover:border-indigo-500/50 bg-slate-950/40 rounded-3xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group"
              onClick={() => document.getElementById('excel-file-input')?.click()}
            >
              <input
                type="file"
                id="excel-file-input"
                className="hidden"
                accept=".xlsx, .xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExcelUpload(file);
                }}
              />
              <div className="p-4 bg-slate-900 rounded-full text-indigo-400 group-hover:bg-indigo-650 group-hover:text-white transition-colors duration-200">
                <Layers className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-wider">Arraste seu arquivo Excel (.xlsx) aqui</p>
                <p className="text-[10px] text-slate-500 uppercase mt-1">ou clique para procurar no seu computador</p>
              </div>
            </div>
          </div>
        ) : (
          /* Mestre-Detalhe Hybrid Layout */
          <div className="space-y-6 animate-fade-in">
            {/* Top batch control bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Fluxo de Importação em Lote</span>
                  <h2 className="text-sm font-black uppercase text-white mt-0.5">
                    Configurando {loteAdmissao.length} colaboradores importados
                  </h2>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                <div className="space-y-1 w-full sm:w-auto">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Data do Agendamento *</label>
                  <input
                    type="date"
                    value={dataAgendamentoLote}
                    onChange={(e) => setDataAgendamentoLote(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono w-full sm:w-44"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (window.confirm("Deseja realmente descartar este lote importado?")) {
                        setLoteAdmissao([]);
                        setSelectedIndex(0);
                        setRhFlowMode('menu');
                        showToast('Lote descartado.');
                      }
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center w-full sm:w-auto border border-slate-700/50"
                  >
                    Descartar
                  </button>

                  <button
                    disabled={!loteAdmissao.every(colab => colab.status === 'concluido')}
                    onClick={handleConcluirLote}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all w-full sm:w-auto shadow-lg ${
                      loteAdmissao.every(colab => colab.status === 'concluido')
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-600/10'
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Gravar Lote no Sistema
                  </button>
                </div>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
              {/* Left column (30% - List of employees) */}
              <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col h-[520px]">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-3 px-2">Colaboradores no Lote</span>
                <div className="flex-grow overflow-y-auto pr-1 space-y-2.5 scrollbar-thin">
                  {loteAdmissao.map((colab, idx) => (
                    <button
                      key={colab.id}
                      onClick={() => setSelectedIndex(idx)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                        selectedIndex === idx
                          ? 'bg-indigo-950/60 border-indigo-500/40 text-white shadow-md'
                          : 'bg-slate-950/40 border-slate-850 hover:bg-slate-950 hover:border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {colab.status === 'concluido' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-700 shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black uppercase truncate">{colab.nome}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5 truncate">{colab.cargo}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right column (70% - Focus card) */}
              {selectedColab && (
                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between h-[520px] animate-fade-in">
                  <div className="space-y-6">
                    {/* Employee Info Header */}
                    <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Colaborador em Foco</span>
                        <h3 className="text-base font-black text-white uppercase tracking-tight mt-0.5">{selectedColab.nome}</h3>
                        <div className="text-[10px] text-slate-400 font-mono mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1">CPF: <strong className="text-slate-200"><CpfMaskedView cpf={selectedColab.cpf || ''} alvoNome={selectedColab.nome} /></strong></span>
                          <span>FUNÇÃO: <strong className="text-slate-200">{selectedColab.cargo || 'Não informado'}</strong></span>
                          <span>OBRA: <strong className="text-slate-200">{selectedColab.obra || 'Não informado'}</strong></span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                        selectedColab.status === 'concluido'
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                          : 'bg-amber-950/60 text-amber-400 border-amber-800/40'
                      }`}>
                        {selectedColab.status === 'concluido' ? 'FARDAMENTO DEFINIDO' : 'DEFINIÇÃO PENDENTE'}
                      </span>
                    </div>

                    {/* Sizes Selection Dropdowns */}
                    <div className="space-y-4">
                      <span className="text-[11px] font-black uppercase text-indigo-400 tracking-wider block border-b border-slate-850 pb-2">Selecione os Tamanhos</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Camisa */}
                        <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-850">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Camisa Brim</label>
                          <div className="space-y-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Tipo</label>
                              <select
                                value={loteCamisaType}
                                onChange={(e) => setLoteCamisaType(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                              >
                                <option value="Brim Cinza">Brim Cinza (Proteção Química)</option>
                                <option value="Brim Azul Marinho">Brim Azul Marinho</option>
                                <option value="Anti Chama">Anti Chama</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Tamanho</label>
                              <select
                                value={loteCamisaSize}
                                onChange={(e) => setLoteCamisaSize(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none cursor-pointer"
                              >
                                {['2', '3', '4', '5', '6', '7', '8', '9'].map(sz => (
                                  <option key={sz} value={sz}>{sz}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Calça */}
                        <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-850">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Calça</label>
                          <div className="space-y-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Tipo</label>
                              <select
                                value={loteCalcaType}
                                onChange={(e) => setLoteCalcaType(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                              >
                                <option value="Jeans">Jeans</option>
                                <option value="Brim Cinza">Brim Cinza</option>
                                <option value="Anti Chama">Anti Chama</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Tamanho</label>
                              <select
                                value={loteCalcaSize}
                                onChange={(e) => setLoteCalcaSize(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none cursor-pointer"
                              >
                                {['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '60'].map(sz => (
                                  <option key={sz} value={sz}>{sz}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Bota */}
                        <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-850">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Bota</label>
                          <div className="space-y-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Tipo</label>
                              <select
                                value={loteBotaType}
                                onChange={(e) => setLoteBotaType(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                              >
                                <option value="Anti Torção">Anti Torção</option>
                                <option value="Eletricista">Eletricista</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Tamanho</label>
                              <select
                                value={loteBotaSize}
                                onChange={(e) => setLoteBotaSize(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none cursor-pointer"
                              >
                                {Array.from({ length: 13 }, (_, i) => String(35 + i)).map(sz => (
                                  <option key={sz} value={sz}>{sz}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save and Next Button */}
                  <div className="pt-4 border-t border-slate-850 flex justify-end">
                    <button
                      onClick={innerSaveAndNext}
                      className="px-6 py-3 bg-indigo-650 hover:bg-indigo-550 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-650/10 cursor-pointer"
                    >
                      Salvar e Avançar <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        /* Menu or Manual Forms */
        <div className="space-y-6">
          {rhFlowMode === 'menu' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              {/* Card 1: Nova Admissão Manual */}
              <button
                onClick={() => {
                  setRhFlowMode('manual_admissao');
                  setTipoRequisicao('Admissão');
                }}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-8 text-center transition-all duration-200 cursor-pointer shadow-xl group flex flex-col items-center justify-between min-h-[200px]"
              >
                <div className="p-4 bg-indigo-950 rounded-2xl text-indigo-400 group-hover:bg-indigo-650 group-hover:text-white transition-colors duration-200">
                  <UserPlus className="w-8 h-8" />
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-black uppercase text-white tracking-wider">Nova Admissão Manual</h3>
                  <p className="text-[11px] text-slate-450 mt-1 uppercase tracking-tight leading-relaxed">
                    Cadastrar colaborador individualmente com emissão de kit de fardamento completo.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-4 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  Iniciar cadastro <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>

              {/* Card 2: Registrar Troca de Fardamento */}
              <button
                onClick={() => {
                  setRhFlowMode('manual_troca');
                  setTipoRequisicao('Troca');
                }}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-8 text-center transition-all duration-200 cursor-pointer shadow-xl group flex flex-col items-center justify-between min-h-[200px]"
              >
                <div className="p-4 bg-indigo-950 rounded-2xl text-indigo-400 group-hover:bg-indigo-650 group-hover:text-white transition-colors duration-200">
                  <RefreshCw className="w-8 h-8" />
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-black uppercase text-white tracking-wider">Troca / Reposição</h3>
                  <p className="text-[11px] text-slate-450 mt-1 uppercase tracking-tight leading-relaxed">
                    Registrar troca ou reposição parcial de itens específicos de fardamento.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-4 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  Registrar troca <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>

              {/* Card 3: Importar Lote de Admissão (Excel) */}
              <button
                onClick={() => {
                  setRhFlowMode('lote_excel');
                }}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-8 text-center transition-all duration-200 cursor-pointer shadow-xl group flex flex-col items-center justify-between min-h-[200px]"
              >
                <div className="p-4 bg-indigo-950 rounded-2xl text-indigo-400 group-hover:bg-indigo-650 group-hover:text-white transition-colors duration-200">
                  <Layers className="w-8 h-8" />
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-black uppercase text-white tracking-wider">Importação em Lote</h3>
                  <p className="text-[11px] text-slate-450 mt-1 uppercase tracking-tight leading-relaxed">
                    Carregar lista de admissões via Excel e configurar tamanhos em fluxo inteligente.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-4 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  Importar Excel <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>
          ) : null}

          {/* Grid layout containing manual forms on Left and List of registered admissions on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel: Form (rendered only if rhFlowMode is 'manual_admissao' or 'manual_troca') */}
            {(rhFlowMode === 'manual_admissao' || rhFlowMode === 'manual_troca') ? (
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between animate-fade-in">
                <div>
                  <div id="new-admission-form-header" className="flex items-center justify-between mb-4 border-b border-slate-850 pb-3">
                    <div className="flex items-center gap-2">
                      {tipoRequisicao === 'Admissão' ? <UserPlus className="w-5 h-5 text-indigo-400" /> : <RefreshCw className="w-5 h-5 text-indigo-400" />}
                      <h2 className="text-sm font-black uppercase text-white tracking-wider">
                        {editingRecord ? 'Editar Cadastro' : tipoRequisicao === 'Admissão' ? 'Nova Admissão' : 'Registrar Troca'}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRhFlowMode('menu');
                        if (editingRecord) {
                          setEditingRecord(null);
                          setNome('');
                          setCpf('');
                          setCargo('');
                          setObra('');
                          setDataAgendamento('');
                          setEmailTecnico('');
                          setKitGerado([]);
                          setKitCompilado(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border border-slate-700/50"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                    </button>
                  </div>

                  <form onSubmit={handleRegisterAdmission} className="space-y-4">
                    {/* Tipo de Requisicao Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tipo de Requisição *</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setTipoRequisicao('Admissão');
                            setRhFlowMode('manual_admissao');
                          }}
                          className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                            tipoRequisicao === 'Admissão'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                          }`}
                        >
                          Admissão (Kit Completo)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTipoRequisicao('Troca');
                            setRhFlowMode('manual_troca');
                          }}
                          className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center ${
                            tipoRequisicao === 'Troca'
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                          }`}
                        >
                          Troca / Reposição
                        </button>
                      </div>
                    </div>

                    {/* Basic Info with Searchable Autocomplete */}
                    <div className="space-y-1.5" ref={dropdownRef}>
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span>Nome Completo do Colaborador *</span>
                          {tipoRequisicao === 'Troca' && (
                            <span className="text-[9px] bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 px-1.5 py-0.5 rounded font-mono font-bold">
                              🔍 Busca RH
                            </span>
                          )}
                        </label>

                        {isColaboradorSelectedFromDb && (
                          <button
                            type="button"
                            onClick={handleClearSelectedColaborador}
                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 cursor-pointer"
                            title="Trocar colaborador selecionado"
                          >
                            <RefreshCw className="w-3 h-3" /> Alterar Seleção
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder={tipoRequisicao === 'Troca' ? "Digite nome ou CPF para buscar colaborador..." : "EX: ANDRÉ RAMALHO SOUZA"}
                          value={nome}
                          onChange={(e) => {
                            setNome(e.target.value);
                            setIsDropdownOpen(true);
                            if (isColaboradorSelectedFromDb) {
                              setIsColaboradorSelectedFromDb(false);
                            }
                          }}
                          onFocus={() => {
                            if (tipoRequisicao === 'Troca') {
                              setIsDropdownOpen(true);
                            }
                          }}
                          className={`w-full bg-slate-950 border rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                            isColaboradorSelectedFromDb
                              ? 'border-indigo-600/60 bg-indigo-950/20 text-indigo-100 font-semibold'
                              : 'border-slate-800'
                          }`}
                        />
                        <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

                        {isColaboradorSelectedFromDb ? (
                          <button
                            type="button"
                            onClick={handleClearSelectedColaborador}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                            title="Limpar seleção do colaborador"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                        )}

                        {/* Autocomplete Dropdown */}
                        {isDropdownOpen && (tipoRequisicao === 'Troca' || nome.trim().length > 1) && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl p-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 animate-fade-in">
                            <div className="px-2 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <span className="flex items-center gap-1.5">
                                <Users className="w-3 h-3 text-indigo-400" /> Colaboradores no Mestre RH ({filteredColaboradores.length})
                              </span>
                              {isLoadingColaboradores && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
                            </div>

                            {isLoadingColaboradores && colaboradoresList.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Carregando base de colaboradores...
                              </div>
                            ) : filteredColaboradores.length === 0 ? (
                              <div className="p-3 text-center text-xs text-slate-400 italic">
                                Nenhum colaborador cadastrado encontrado com "{nome}". Você pode prosseguir e digitar manualmente.
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {filteredColaboradores.slice(0, 20).map((colab) => (
                                  <button
                                    type="button"
                                    key={colab.id}
                                    onClick={() => handleSelectColaborador(colab)}
                                    className="w-full text-left p-2.5 hover:bg-indigo-950/50 rounded-xl transition-colors flex items-center justify-between group border border-transparent hover:border-indigo-800/40 cursor-pointer"
                                  >
                                    <div className="space-y-0.5">
                                      <span className="font-bold text-xs text-slate-100 group-hover:text-indigo-300 block">
                                        {colab.nome}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block font-mono">
                                        {colab.cargo || 'Cargo não informado'} • {colab.obra || 'Obra não informada'}
                                      </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-[10px] font-mono text-indigo-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 block">
                                        CPF: {colab.cpf ? mascararCpfLgpd(colab.cpf) : 'S/N'}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {isColaboradorSelectedFromDb && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg mt-1">
                          <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>Colaborador localizado no banco! Dados de CPF, Cargo e Obra vinculados automaticamente.</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* CPF */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CPF *</label>
                          {(isColaboradorSelectedFromDb || tipoRequisicao === 'Troca') && (
                            <span className="text-[9px] text-amber-400 font-bold flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Read-Only
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="000.000.000-00"
                          value={(isColaboradorSelectedFromDb || tipoRequisicao === 'Troca') && cpf ? mascararCpfLgpd(cpf) : cpf}
                          onChange={handleCpfChange}
                          readOnly={isColaboradorSelectedFromDb || tipoRequisicao === 'Troca'}
                          maxLength={14}
                          className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono transition-all ${
                            isColaboradorSelectedFromDb || tipoRequisicao === 'Troca'
                              ? 'bg-slate-900/90 text-slate-300 border-slate-800 cursor-not-allowed font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600'
                          }`}
                        />
                      </div>

                      {/* Data Agendamento - SEMPRE LIVRE PARA EDIÇÃO */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Agendamento *</label>
                        <input
                          type="date"
                          required
                          value={dataAgendamento}
                          onChange={(e) => setDataAgendamento(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                        />
                        {isRetroactiveDate && (
                          <p className="text-rose-500 text-[10px] font-semibold mt-1">
                            ⚠️ Aviso: Você está selecionando uma data retroativa.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Cargo */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cargo *</label>
                          {(isColaboradorSelectedFromDb || tipoRequisicao === 'Troca') && (
                            <span className="text-[9px] text-amber-400 font-bold flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Read-Only
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="EX: ELETRICISTA / TST"
                          value={cargo}
                          onChange={(e) => setCargo(e.target.value)}
                          readOnly={isColaboradorSelectedFromDb || tipoRequisicao === 'Troca'}
                          className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                            isColaboradorSelectedFromDb || tipoRequisicao === 'Troca'
                              ? 'bg-slate-900/90 text-slate-300 border-slate-800 cursor-not-allowed font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600'
                          }`}
                        />
                      </div>

                      {/* Obra / Frente de Trabalho */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Obra / Frente *</label>
                          {tipoRequisicao === 'Troca' && (
                            <span className="text-[9px] text-amber-400 font-bold flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Read-Only
                            </span>
                          )}
                        </div>
                        {tipoRequisicao === 'Troca' ? (
                          <input
                            type="text"
                            readOnly
                            className="w-full bg-slate-900/90 text-slate-400 border border-slate-800 cursor-not-allowed font-medium rounded-xl px-4 py-2.5 text-xs transition-all uppercase"
                            value={obra}
                          />
                        ) : (
                          <input
                            type="text"
                            required
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all uppercase font-medium"
                            placeholder="Ex: ALU MO 21-22 SLZ 06-26"
                            value={obra}
                            onChange={(e) => setObra(e.target.value.toUpperCase())}
                          />
                        )}
                      </div>
                    </div>

                    {tipoRequisicao === 'Admissão' ? (
                      <div className="border-t border-slate-850 pt-4 mt-4 space-y-4">
                        <span className="text-[11px] font-black uppercase text-indigo-400 tracking-wider block font-sans">Fardamento e Tamanhos (Catálogo CMPC)</span>
                        
                        {/* Camisa */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Camisa</label>
                            <select
                              value={tipoCamisa}
                              onChange={(e) => setTipoCamisa(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                            >
                              <option value="Brim Cinza">Brim Cinza (Proteção Química)</option>
                              <option value="Brim Azul Marinho">Brim Azul Marinho</option>
                              <option value="Anti Chama">Anti Chama</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tamanho da Camisa</label>
                            <select
                              value={tamanhoCamisa}
                              onChange={(e) => setTamanhoCamisa(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer font-mono"
                            >
                              {['2', '3', '4', '5', '6', '7', '8', '9'].map(sz => (
                                                  <option key={sz} value={sz}>{sz}</option>
                                                ))}
                            </select>
                          </div>
                        </div>

                        {/* Calça */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Calça</label>
                            <select
                              value={tipoCalca}
                              onChange={(e) => setTipoCalca(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                            >
                              <option value="Jeans">Jeans</option>
                              <option value="Brim Cinza">Brim Cinza</option>
                              <option value="Anti Chama">Anti Chama</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tamanho da Calça</label>
                            <select
                              value={tamanhoCalca}
                              onChange={(e) => setTamanhoCalca(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer font-mono"
                            >
                              {['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '60'].map(sz => (
                                                  <option key={sz} value={sz}>{sz}</option>
                                                ))}
                            </select>
                          </div>
                        </div>

                        {/* Bota */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Bota</label>
                            <select
                              value={tipoBota}
                              onChange={(e) => setTipoBota(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                            >
                              <option value="Anti Torção">Anti Torção</option>
                              <option value="Eletricista">Eletricista</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tamanho da Bota</label>
                            <select
                              value={tamanhoBota}
                              onChange={(e) => setTamanhoBota(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none cursor-pointer font-mono"
                            >
                              {Array.from({ length: 13 }, (_, i) => String(35 + i)).map(sz => (
                                                  <option key={sz} value={sz}>{sz}</option>
                                                ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-slate-850 pt-4 mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        <span className="text-[11px] font-black uppercase text-indigo-400 tracking-wider block font-sans">Itens para Troca/Reposição</span>
                        
                        {/* Camisa */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                            <input
                              type="checkbox"
                              checked={trocaItems.camisa.checked}
                              onChange={(e) => setTrocaItems({
                                ...trocaItems,
                                camisa: { ...trocaItems.camisa, checked: e.target.checked }
                              })}
                              className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Camisa Brim</span>
                          </label>
                          {trocaItems.camisa.checked && (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                                <select
                                  value={trocaItems.camisa.tipo}
                                  onChange={(e) => setTrocaItems({
                                    ...trocaItems,
                                    camisa: { ...trocaItems.camisa, tipo: e.target.value }
                                  })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  <option value="Brim Cinza">Cinza</option>
                                  <option value="Brim Azul Marinho">Azul Marinho</option>
                                  <option value="Anti Chama">Anti Chama</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tamanho</label>
                                <select
                                  value={trocaItems.camisa.tamanho}
                                  onChange={(e) => setTrocaItems({
                                    ...trocaItems,
                                    camisa: { ...trocaItems.camisa, tamanho: e.target.value }
                                  })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 font-mono focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  {['2', '3', '4', '5', '6', '7', '8', '9'].map(sz => (
                                                    <option key={sz} value={sz}>{sz}</option>
                                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Qtd</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={trocaItems.camisa.qtd}
                                  onChange={(e) => setTrocaItems({
                                    ...trocaItems,
                                    camisa: { ...trocaItems.camisa, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) }
                                  })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Calça */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                            <input
                              type="checkbox"
                              checked={trocaItems.calca.checked}
                              onChange={(e) => setTrocaItems({
                                ...trocaItems,
                                calca: { ...trocaItems.calca, checked: e.target.checked }
                              })}
                              className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Calça</span>
                          </label>
                          {trocaItems.calca.checked && (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                                <select
                                  value={trocaItems.calca.tipo}
                                  onChange={(e) => setTrocaItems({
                                    ...trocaItems,
                                    calca: { ...trocaItems.calca, tipo: e.target.value }
                                  })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  <option value="Jeans">Jeans</option>
                                  <option value="Brim Cinza">Cinza</option>
                                  <option value="Anti Chama">Anti Chama</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tamanho</label>
                                <select
                                  value={trocaItems.calca.tamanho}
                                  onChange={(e) => setTrocaItems({
                                    ...trocaItems,
                                    calca: { ...trocaItems.calca, tamanho: e.target.value }
                                  })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 font-mono focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  {['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '60'].map(sz => (
                                                    <option key={sz} value={sz}>{sz}</option>
                                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Qtd</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={trocaItems.calca.qtd}
                                  onChange={(e) => setTrocaItems({
                                    ...trocaItems,
                                    calca: { ...trocaItems.calca, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) }
                                  })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bota */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                            <input
                              type="checkbox"
                              checked={trocaItems.bota.checked}
                              onChange={(e) => setTrocaItems({
                                ...trocaItems,
                                bota: { ...trocaItems.bota, checked: e.target.checked }
                              })}
                              className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Bota de Segurança</span>
                          </label>
                          {trocaItems.bota.checked && (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                                <select
                                  value={trocaItems.bota.tipo}
                                  onChange={(e) => setTrocaItems({
                                    ...trocaItems,
                                    bota: { ...trocaItems.bota, tipo: e.target.value }
                                  })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  <option value="Anti Torção">Anti Torção</option>
                                  <option value="Eletricista">Eletricista</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Tamanho</label>
                                <select
                                  value={trocaItems.bota.tamanho}
                                  onChange={(e) => setTrocaItems({
                                    ...trocaItems,
                                    bota: { ...trocaItems.bota, tamanho: e.target.value }
                                  })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-100 font-mono focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                  {Array.from({ length: 13 }, (_, i) => String(35 + i)).map(sz => (
                                                  <option key={sz} value={sz}>{sz}</option>
                                                ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Qtd</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={trocaItems.bota.qtd}
                                  onChange={(e) => setTrocaItems({
                                    ...trocaItems,
                                    bota: { ...trocaItems.bota, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) }
                                  })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Outros EPCs / EPIs */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-3">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-850 pb-1">Outros EPIs & Acessórios</span>
                          
                          {[
                            { key: 'capuz', label: 'Capuz com Proteção Química (Cód 12779)' },
                            { key: 'oculos', label: 'Óculos Ampla Visão (Cód 7328)' },
                            { key: 'abafador', label: 'Protetor Auditivo Concha (Cód 14288)' },
                            { key: 'capaceteAmarelo', label: 'Capacete Amarelo (Cód 7253)' },
                            { key: 'capaceteVerde', label: 'Capacete Verde (Cód 7261)' },
                            { key: 'jugular', label: 'Jugular (Cód 7285)' },
                            { key: 'facialVGard', label: 'Protetor Facial V-Gard (Cód 14188)' },
                            { key: 'facial3M', label: 'Protetor Facial 3M V2C (Cód 7338)' },
                          ].map(({ key, label }) => {
                            const item = trocaItems[key as keyof typeof trocaItems] as { checked: boolean; qtd: number };
                            return (
                              <div key={key} className="flex items-center justify-between gap-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-slate-100 select-none">
                                  <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={(e) => setTrocaItems({
                                      ...trocaItems,
                                      [key]: { ...item, checked: e.target.checked }
                                    })}
                                    className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span>{label}</span>
                                </label>
                                {item.checked && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-slate-500 uppercase">Qtd:</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={10}
                                      value={item.qtd}
                                      onChange={(e) => setTrocaItems({
                                        ...trocaItems,
                                        [key]: { ...item, qtd: Math.max(1, parseInt(e.target.value, 10) || 1) }
                                      })}
                                      className="w-12 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-center text-xs text-slate-100 focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action buttons and live generated kit preview */}
                    <div className="space-y-4 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (!cargo.trim()) {
                            showToast('Por favor, informe o cargo antes de gerar o kit.', 'error');
                            return;
                          }
                          const compiled = compileKit(
                            cargo,
                            tipoCamisa,
                            tamanhoCamisa,
                            tipoCalca,
                            tamanhoCalca,
                            tipoBota,
                            tamanhoBota
                          );
                          setKitGerado(compiled);
                          setKitCompilado(true);
                          showToast('Kit gerado com sucesso! Pronto para solicitação de RM.');
                        }}
                        className="w-full py-2.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 hover:text-white border border-indigo-900/40 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer duration-150"
                      >
                        <Sparkles className="w-4 h-4" />
                        Gerar Kit SGI (Compilar ERP)
                      </button>

                      {kitCompilado && kitGerado.length > 0 ? (
                        <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-2xl p-4 animate-fade-in">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                            <CheckSquare className="w-3.5 h-3.5" />
                            KIT COMPILADO COM SUCESSO (CÓDIGOS ERP)
                          </span>
                          <div className="space-y-1 font-mono text-[10px] text-slate-300">
                            {kitGerado.map((epi, idx) => (
                              <div key={idx} className="flex items-start gap-2 py-0.5 border-b border-indigo-950/20 last:border-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                                <span>{epi}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-950/60 border border-slate-850 rounded-2xl p-4 text-center py-6 text-slate-500 text-[11px] font-medium leading-relaxed">
                          <AlertTriangle className="w-5 h-5 text-amber-500/80 mx-auto mb-2" />
                          Preencha o cargo e selecione os tamanhos, então clique em <strong className="text-indigo-400 font-bold uppercase">"Gerar Kit SGI"</strong> para compilar os códigos do catálogo real.
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 mt-6">
                      {editingRecord && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRecord(null);
                            setNome('');
                            setCpf('');
                            setCargo('');
                            setObra('');
                            setDataAgendamento('');
                            setEmailTecnico('');
                            setKitGerado([]);
                            setKitCompilado(false);
                            showToast('Edição cancelada.');
                            setRhFlowMode('menu');
                          }}
                          className="flex-grow py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center border border-slate-700/50"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="submit"
                        className="flex-[2] py-3 bg-indigo-650 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        {editingRecord ? '💾 Salvar Alterações' : '💾 Salvar e Adicionar à Fila'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            {/* Right Panel: List (rendered if rhFlowMode is 'menu' (12 cols) or 'manual_admissao'/'manual_troca' (7 cols)) */}
            <div className={`${(rhFlowMode === 'manual_admissao' || rhFlowMode === 'manual_troca') ? 'lg:col-span-7' : 'lg:col-span-12'} flex flex-col gap-4 animate-fade-in`}>
              {/* Filters bar */}
              <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center gap-4">
                <div className="relative w-full md:flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar colaborador por nome, CPF, cargo, obra..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Tabs for Right Panel */}
              <div className="flex border-b border-slate-850 gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => setQueueTab('fila')}
                  className={`pb-2.5 px-2 text-xs font-black uppercase tracking-wider relative transition-all cursor-pointer ${
                    queueTab === 'fila' ? 'text-indigo-400 font-black' : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  📦 Admissões Aguardando Lote
                  {queueTab === 'fila' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-indigo-950 text-indigo-400 text-[10px]">
                    {filteredAdmissions.filter(item => item.status === 'Aguardando Lote' || item.status === 'Aguardando RM' || item.status_lote === 'Aguardando Lote').length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQueueTab('outros')}
                  className={`pb-2.5 px-2 text-xs font-black uppercase tracking-wider relative transition-all cursor-pointer ${
                    queueTab === 'outros' ? 'text-indigo-400 font-black' : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  📋 Grade de Fichas Detalhadas
                  {queueTab === 'outros' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </button>
              </div>

              {queueTab === 'fila' ? (
                /* Fila de Admissões (Tabela com Caixa de Seleção) */
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-xl flex flex-col gap-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        Selecione Colaboradores para Lote
                      </h3>
                      <p className="text-[10px] text-slate-400 uppercase mt-0.5">
                        Importante: Só podem fazer parte do mesmo lote cadastros da mesma Obra e com a mesma Data de Agendamento.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={selectedQueueIds.length === 0}
                      onClick={handleGenerateBatch}
                      className={`py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                        selectedQueueIds.length > 0
                          ? 'bg-indigo-650 hover:bg-indigo-550 text-white shadow-indigo-600/25 border border-indigo-500/35'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-750'
                      }`}
                    >
                      📦 Gerar Lote e Emitir Tabela de RM
                      {selectedQueueIds.length > 0 && (
                        <span className="bg-indigo-800 px-1.5 py-0.5 rounded text-[9px] font-black">
                          {selectedQueueIds.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Table wrapper */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-850 bg-slate-950/40">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-850">
                          <th className="py-3 px-4 w-12 text-center">
                            <input
                              type="checkbox"
                              checked={
                                filteredAdmissions.filter(item => item.status === 'Aguardando Lote' || item.status === 'Aguardando RM' || item.status_lote === 'Aguardando Lote').length > 0 &&
                                filteredAdmissions.filter(item => item.status === 'Aguardando Lote' || item.status === 'Aguardando RM' || item.status_lote === 'Aguardando Lote').every(rec => selectedQueueIds.includes(rec.id))
                              }
                              onChange={(e) => {
                                const activeQueue = filteredAdmissions.filter(item => item.status === 'Aguardando Lote' || item.status === 'Aguardando RM' || item.status_lote === 'Aguardando Lote');
                                if (e.target.checked) {
                                  setSelectedQueueIds(activeQueue.map(rec => rec.id));
                                } else {
                                  setSelectedQueueIds([]);
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                            />
                          </th>
                          <th className="py-3 px-4">Nome</th>
                          <th className="py-3 px-4">CPF</th>
                          <th className="py-3 px-4">Obra</th>
                          <th className="py-3 px-4">Cargo</th>
                          <th className="py-3 px-4">Data de Agendamento</th>
                          <th className="py-3 px-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-xs text-slate-300">
                        {filteredAdmissions.filter(item => item.status === 'Aguardando Lote' || item.status === 'Aguardando RM' || item.status_lote === 'Aguardando Lote').length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-500 uppercase font-bold text-[11px]">
                              <Users className="w-8 h-8 text-slate-800 mx-auto mb-2 animate-pulse" />
                              Nenhuma admissão aguardando lote no momento.
                            </td>
                          </tr>
                        ) : (
                          filteredAdmissions.filter(item => item.status === 'Aguardando Lote' || item.status === 'Aguardando RM' || item.status_lote === 'Aguardando Lote').map((record) => {
                            const isChecked = selectedQueueIds.includes(record.id);
                            return (
                              <tr
                                key={record.id}
                                className={`transition-colors hover:bg-slate-900/50 ${
                                  isChecked ? 'bg-indigo-950/10 hover:bg-indigo-950/15' : ''
                                }`}
                              >
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedQueueIds(selectedQueueIds.filter(id => id !== record.id));
                                      } else {
                                        setSelectedQueueIds([...selectedQueueIds, record.id]);
                                      }
                                    }}
                                    className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-3 px-4 font-black text-white">{record.nome}</td>
                                <td className="py-3 px-4 font-mono text-slate-400"><CpfMaskedView cpf={record.cpf} alvoNome={record.nome} /></td>
                                <td className="py-3 px-4 font-bold text-indigo-300">{record.obra}</td>
                                <td className="py-3 px-4 text-slate-400">{record.cargo}</td>
                                <td className="py-3 px-4 font-mono text-slate-400">
                                  {formatDateBR(record.data_agendamento)}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleOpenKitChecklist(record)}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition duration-150 cursor-pointer border border-slate-750"
                                      title="Ver Ficha / Kit"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleStartEdit(record)}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-350 rounded-lg transition duration-150 cursor-pointer border border-slate-750"
                                      title="Editar"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAdmission(record.id, record.nome)}
                                      className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-rose-500 hover:text-rose-400 rounded-lg transition duration-150 cursor-pointer border border-slate-750"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Original Card List Grid */
                <div className="space-y-4 max-h-[640px] overflow-y-auto scrollbar-none pr-1">
                  {filteredAdmissions.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 p-16 rounded-3xl text-center text-slate-500 text-xs shadow-xl">
                      <Users className="w-10 h-10 text-slate-700 mx-auto mb-3 animate-pulse" />
                      <span className="uppercase font-bold tracking-wider">Nenhuma admissão pendente para gerar lote.</span>
                    </div>
                  ) : (
                    filteredAdmissions.map((record) => {
                      const today = isDateToday(record.data_agendamento);
                      return (
                        <div 
                          key={record.id}
                          className={`bg-slate-900 border rounded-3xl p-5 shadow-lg flex flex-col justify-between transition-colors duration-150 ${
                            today && record.status !== 'Fardado'
                              ? 'border-rose-500/40 bg-rose-950/5' 
                              : 'border-slate-800 hover:border-slate-750'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-white">{record.nome}</span>
                                {today && record.status !== 'Fardado' && (
                                  <span className="bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                                    FARDAMENTO HOJE
                                  </span>
                                )}
                              </div>
                              
                              <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1 font-mono">
                                <span className="flex items-center gap-1">CPF: <strong className="text-slate-200"><CpfMaskedView cpf={record.cpf} alvoNome={record.nome} /></strong></span>
                                <span>CARGO: <strong className="text-slate-200">{record.cargo}</strong></span>
                                <span>OBRA: <strong className="text-slate-200">{record.obra}</strong></span>
                                {record.numero_rm && (
                                  <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded">RM Nº: {record.numero_rm}</span>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center">
                              <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                record.status === 'Fardado'
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/40'
                                  : record.status === 'Agendado'
                                  ? 'bg-violet-950/80 text-violet-400 border-violet-800/40'
                                  : (record.status === 'RM Solicitada' || record.status === 'Aguardando Número RM')
                                  ? 'bg-blue-950/80 text-blue-400 border-blue-800/40'
                                  : 'bg-amber-950/80 text-amber-400 border-amber-800/40'
                              }`}>
                                {record.status}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="text-[10px] text-slate-500 font-mono">
                              Agendamento: <strong className="text-slate-300">{formatDateBR(record.data_agendamento)}</strong>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Mailto / Solicitar Abertura de RM Trigger */}
                              {record.status === 'Aguardando RM' && (
                                <button
                                  onClick={() => handleRequestRM(record)}
                                  className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  Solicitar Abertura de RM
                                </button>
                              )}

                              {(record.status === 'RM Solicitada' || record.status === 'Aguardando Número RM') && (
                                <button
                                  onClick={() => handleUpdateStatus(record.id, 'Agendado')}
                                  className="px-3.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-800/40"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Aprovar RM (Marcar Agendado)
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenKitChecklist(record)}
                                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700/30"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Ver Ficha / Kit
                              </button>

                              <button
                                onClick={() => handleStartEdit(record)}
                                className="p-2 bg-slate-800 hover:bg-slate-750 text-indigo-400 hover:text-indigo-350 rounded-xl transition duration-150 cursor-pointer border border-slate-700/30"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteAdmission(record.id, record.nome)}
                                className="p-2 bg-slate-800 hover:bg-rose-950/60 text-rose-500 hover:text-rose-400 rounded-xl transition duration-150 cursor-pointer border border-slate-700/30"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
