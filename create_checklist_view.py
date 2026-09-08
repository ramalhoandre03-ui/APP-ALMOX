import os

content = """import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ClipboardCheck, Search, Filter, Calendar, Users, Settings, Tool, Plus,
  FileText, Trash2, Printer, ShieldCheck, AlertTriangle, XOctagon, CheckCircle2, ChevronDown, PenTool, X, Upload
} from 'lucide-react';
import { formatarObservacoes, getChecklistPhotos, parseNewFields } from '../utils/checklistHelpers';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function ChecklistView() {
  const { session } = useAuth();
  const [checklistsSalvos, setChecklistsSalvos] = useState<any[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);
  const [selectedChecklistForView, setSelectedChecklistForView] = useState<any>(null);
  const [printChecklist, setPrintChecklist] = useState<any>(null);
  
  // Dashboard Metrics
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroObra, setFiltroObra] = useState<string>('');
  const [filtroBusca, setFiltroBusca] = useState<string>('');
  
  // New Checklist Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
  const [chkTagEquipamento, setChkTagEquipamento] = useState('');
  const [chkCentroCusto, setChkCentroCusto] = useState('');
  const [chkDescricaoItem, setChkDescricaoItem] = useState('');
  const [chkFornecedor, setChkFornecedor] = useState('');
  const [chkQuantidade, setChkQuantidade] = useState<number | ''>('');
  const [chkUnidadeMedida, setChkUnidadeMedida] = useState('UN');
  const [eletricistaResponsavel, setEletricistaResponsavel] = useState(() => session?.nome || session?.user?.email?.split('@')[0] || '');
  const [caboAlimentacao, setCaboAlimentacao] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [plugueConectores, setPlugueConectores] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [carcacaEstrutura, setCarcacaEstrutura] = useState<'Conforme' | 'Não Conforme'>('Conforme');
  const [comandosEmergencia, setComandosEmergencia] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [painelDigital, setPainelDigital] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [continuidadeAterramento, setContinuidadeAterramento] = useState<'Conforme' | 'Não Conforme'>('Conforme');
  const [resistenciaAquecimento, setResistenciaAquecimento] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [statusLiberacao, setStatusLiberacao] = useState<'LIBERADO PARA OPERAÇÃO' | 'LIBERADO COM RESTRIÇÃO' | 'REPROVADO / MANUTENÇÃO' | ''>('');
  const [observacoesTecnicas, setObservacoesTecnicas] = useState('');
  
  const [motivoInspecao, setMotivoInspecao] = useState('MOBILIZAÇÃO');
  const [extintor, setExtintor] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [bateria, setBateria] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [tensaoEquipamento, setTensaoEquipamento] = useState('NÃO SE APLICA');
  const [fotosSelecionadas, setFotosSelecionadas] = useState<File[]>([]);

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    setIsLoadingChecklists(true);
    try {
      const { data, error } = await supabase
        .from('checklists_eletrica')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Erro ao buscar checklists_eletrica:', error);
      } else if (data) {
        setChecklistsSalvos(data);
      }
    } catch (err) {
      console.error('Falha na comunicação com checklists_eletrica:', err);
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  const handleSaveChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chkDescricaoItem.trim()) return toast.error('Preencha a Descrição do Item!');
    if (chkQuantidade === '' || Number(chkQuantidade) <= 0) return toast.error('Quantidade válida necessária!');
    if (!chkUnidadeMedida) return toast.error('Unidade de Medida necessária!');
    if (!eletricistaResponsavel.trim()) return toast.error('Eletricista Responsável necessário!');
    if (!caboAlimentacao || !plugueConectores || !carcacaEstrutura || !comandosEmergencia || !painelDigital || !continuidadeAterramento || !resistenciaAquecimento) {
      return toast.error('Responda a todos os itens do checklist!');
    }
    if (!statusLiberacao) return toast.error('Selecione o parecer técnico final!');
    
    // Trava de Validação OBRIGATÓRIA: Mínimo 2 fotos de evidência
    if (fotosSelecionadas.length < 2) return toast.error('Obrigatório anexar pelo menos 2 fotos de evidência do equipamento.');

    setIsSavingChecklist(true);

    const fotosUrls: string[] = [];
    try {
      for (let i = 0; i < fotosSelecionadas.length; i++) {
        const file = fotosSelecionadas[i];
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${cleanName}`;
        const filePath = `evidencias/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('checklists_fotos')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('checklists_fotos')
          .getPublicUrl(filePath);

        fotosUrls.push(publicUrl);
      }
    } catch (uploadErr: any) {
      setIsSavingChecklist(false);
      toast.error(`Erro no envio das fotos: ${uploadErr.message || uploadErr}`);
      return;
    }

    try {
      const checklistPayload = {
        tag_equipamento: chkTagEquipamento.trim() || null,
        descricao_item: chkDescricaoItem.trim(),
        fornecedor: chkFornecedor.trim() || null,
        quantidade: Number(chkQuantidade),
        unidade_medida: chkUnidadeMedida,
        eletricista_responsavel: eletricistaResponsavel.trim(),
        cabo_alimentacao: caboAlimentacao,
        plugue_conectores: plugueConectores,
        carcaca_estrutura: carcacaEstrutura,
        comandos_emergencia: comandosEmergencia,
        painel_digital: painelDigital,
        continuidade_aterramento: continuidadeAterramento,
        resistencia_aquecimento: resistenciaAquecimento,
        status_liberacao: statusLiberacao,
        observacoes_tecnicas: observacoesTecnicas.trim(),
        created_at: new Date().toISOString(),
        motivo_inspecao: motivoInspecao,
        extintor: extintor,
        bateria: bateria,
        tensao_equipamento: tensaoEquipamento,
        centro_de_custo: chkCentroCusto.trim() || null,
        fotos_evidencia: fotosUrls
      };

      const { error } = await supabase.from('checklists_eletrica').insert(checklistPayload);

      if (error && error.message && (error.message.includes('column') || error.message.includes('not exist') || error.message.includes('invalid field'))) {
        const serializedDetails = `[Motivo: ${motivoInspecao} | Extintor: ${extintor} | Bateria: ${bateria} | Tensão: ${tensaoEquipamento}]${chkCentroCusto.trim() ? ` [Centro de Custo: ${chkCentroCusto.trim()}]` : ''}${fotosUrls.length > 0 ? ` [Fotos: ${fotosUrls.join(', ')}]` : ''}`;
        const updatedObs = observacoesTecnicas.trim() ? `${observacoesTecnicas.trim()} ${serializedDetails}` : serializedDetails;
        
        const fallbackPayload = {
          tag_equipamento: chkTagEquipamento.trim() || null,
          descricao_item: chkDescricaoItem.trim(),
          fornecedor: chkFornecedor.trim() || null,
          quantidade: Number(chkQuantidade),
          unidade_medida: chkUnidadeMedida,
          eletricista_responsavel: eletricistaResponsavel.trim(),
          cabo_alimentacao: caboAlimentacao,
          plugue_conectores: plugueConectores,
          carcaca_estrutura: carcacaEstrutura,
          comandos_emergencia: comandosEmergencia,
          painel_digital: painelDigital,
          continuidade_aterramento: continuidadeAterramento,
          resistencia_aquecimento: resistenciaAquecimento,
          status_liberacao: statusLiberacao,
          observacoes_tecnicas: updatedObs,
          created_at: new Date().toISOString(),
          fotos_evidencia: fotosUrls
        };
        const { error: fallbackError } = await supabase.from('checklists_eletrica').insert(fallbackPayload);
        if (fallbackError) throw fallbackError;
      } else if (error) {
        throw error;
      }

      toast.success('Checklist digital gravado com sucesso!');
      
      // Limpa os campos
      setChkTagEquipamento(''); setChkCentroCusto(''); setChkDescricaoItem(''); setChkFornecedor('');
      setChkQuantidade(''); setChkUnidadeMedida('UN');
      setCaboAlimentacao('Conforme'); setPlugueConectores('Conforme'); setCarcacaEstrutura('Conforme');
      setComandosEmergencia('Conforme'); setPainelDigital('Conforme'); setContinuidadeAterramento('Conforme'); setResistenciaAquecimento('Conforme');
      setStatusLiberacao(''); setObservacoesTecnicas(''); setFotosSelecionadas([]);
      setIsModalOpen(false);
      
      fetchChecklists();
    } catch (err: any) {
      console.error('Erro na gravação do checklist:', err);
      toast.error(`Falha ao registrar checklist: ${err.message || err}`);
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const handlePrintChecklist = (chk: any) => {
    setPrintChecklist(chk);
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          window.print();
        } else {
          alert('A impressão falhou. Abra a aplicação numa nova aba.');
        }
      } catch (err) {
        alert('A impressão falhou. Abra a aplicação numa nova aba.');
      }
    }, 250);
  };

  const handleDeleteChecklist = async (id: string) => {
    if (window.confirm('Tem certeza que deseja EXCLUIR este registro de checklist?')) {
      try {
        const { error } = await supabase.from('checklists_eletrica').delete().eq('id', id);
        if (error) throw error;
        toast.success('Checklist excluído com sucesso!');
        fetchChecklists();
        if (selectedChecklistForView?.id === id) setSelectedChecklistForView(null);
      } catch (err: any) {
        toast.error(`Erro ao excluir checklist: ${err.message || err}`);
      }
    }
  };

  // Filtragem
  const checklistsFiltrados = useMemo(() => {
    let list = [...checklistsSalvos];
    if (filtroStatus && filtroStatus !== 'todos') {
      list = list.filter(c => {
        if (filtroStatus === 'liberado') return c.status_liberacao === 'LIBERADO PARA OPERAÇÃO';
        if (filtroStatus === 'restricao') return c.status_liberacao === 'LIBERADO COM RESTRIÇÃO';
        if (filtroStatus === 'reprovado') return c.status_liberacao === 'REPROVADO / MANUTENÇÃO';
        return true;
      });
    }
    if (filtroObra) {
      list = list.filter(c => {
        const p = parseNewFields(c);
        return p.centro_de_custo?.toLowerCase().includes(filtroObra.toLowerCase());
      });
    }
    if (filtroBusca) {
      const t = filtroBusca.toLowerCase();
      list = list.filter(c => 
        c.tag_equipamento?.toLowerCase().includes(t) || 
        c.descricao_item?.toLowerCase().includes(t) || 
        c.eletricista_responsavel?.toLowerCase().includes(t)
      );
    }
    return list;
  }, [checklistsSalvos, filtroStatus, filtroObra, filtroBusca]);

  const stats = useMemo(() => {
    return {
      total: checklistsFiltrados.length,
      liberados: checklistsFiltrados.filter(c => c.status_liberacao === 'LIBERADO PARA OPERAÇÃO').length,
      restricao: checklistsFiltrados.filter(c => c.status_liberacao === 'LIBERADO COM RESTRIÇÃO').length,
      reprovados: checklistsFiltrados.filter(c => c.status_liberacao === 'REPROVADO / MANUTENÇÃO').length,
    };
  }, [checklistsFiltrados]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-auto">
      {/* HEADER PRINCIPAL */}
      <div className="bg-slate-900 border-b border-slate-800 p-6 shadow-sm z-10 sticky top-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center border border-amber-500/30">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">Gestão de Checklists & Inspeções</h1>
              <p className="text-slate-400 text-xs font-semibold mt-1">
                Auditoria, Laudos e Histórico de Conformidade de Equipamentos
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" /> Nova Inspeção
          </button>
        </div>
      </div>

      {/* DASHBOARD INDICATORS */}
      <div className="p-6 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{stats.total}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Inspeções</div>
            </div>
          </div>
          <div className="bg-slate-900 border border-emerald-900/50 p-5 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-400">{stats.liberados}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600/70">Aprovados</div>
            </div>
          </div>
          <div className="bg-slate-900 border border-amber-900/50 p-5 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-amber-400">{stats.restricao}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-600/70">Com Ressalvas</div>
            </div>
          </div>
          <div className="bg-slate-900 border border-rose-900/50 p-5 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center">
              <XOctagon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-rose-400">{stats.reprovados}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-600/70">Reprovados / Manutenção</div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTROS & TABELA */}
      <div className="p-6 pt-4 flex-1 flex flex-col">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex-1 flex flex-col shadow-xl">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar tag, descrição, inspetor..."
                value={filtroBusca}
                onChange={e => setFiltroBusca(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="relative min-w-[150px]">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por Obra..."
                value={filtroObra}
                onChange={e => setFiltroObra(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-4 py-2.5 focus:border-amber-500 focus:outline-none appearance-none"
            >
              <option value="todos">Todos os Status</option>
              <option value="liberado">Liberados</option>
              <option value="restricao">Com Restrição</option>
              <option value="reprovado">Reprovados</option>
            </select>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-wider text-slate-500">Data</th>
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-wider text-slate-500">TAG / Equipamento</th>
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-wider text-slate-500">Obra / CC</th>
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-wider text-slate-500">Inspetor</th>
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-wider text-slate-500">Status</th>
                  <th className="py-3 px-4 font-black uppercase text-[10px] tracking-wider text-slate-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoadingChecklists ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500 text-sm font-bold">Carregando checklists...</td></tr>
                ) : checklistsFiltrados.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500 text-sm font-bold">Nenhum registro encontrado.</td></tr>
                ) : (
                  checklistsFiltrados.map((chk: any) => {
                    const parsed = parseNewFields(chk);
                    return (
                      <tr key={chk.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {chk.created_at ? new Date(chk.created_at).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-200">{chk.descricao_item}</div>
                          <div className="text-[10px] text-amber-500/80 font-mono mt-0.5 uppercase">{chk.tag_equipamento || 'S/T'}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-semibold">{parsed.centro_de_custo || '-'}</td>
                        <td className="py-3 px-4 text-slate-400 font-semibold">{chk.eletricista_responsavel || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                            chk.status_liberacao === 'LIBERADO PARA OPERAÇÃO' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : chk.status_liberacao === 'LIBERADO COM RESTRIÇÃO'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {chk.status_liberacao || 'PENDENTE'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setSelectedChecklistForView(chk)} className="p-1.5 text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors" title="Visualizar Detalhes">
                              <Search className="w-4 h-4" />
                            </button>
                            <button onClick={() => handlePrintChecklist(chk)} className="p-1.5 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors" title="Imprimir Laudo PDF">
                              <Printer className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteChecklist(chk.id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors" title="Excluir">
                              <Trash2 className="w-4 h-4" />
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
      </div>

      {/* VIEW MODAL - DETALHES DO CHECKLIST */}
      {selectedChecklistForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Ficha Detalhada de Inspeção
              </h2>
              <button onClick={() => setSelectedChecklistForView(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">TAG do Equipamento</span>
                    <strong className="text-slate-200">{selectedChecklistForView.tag_equipamento || 'S/T'}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Motivo</span>
                    <strong className="text-slate-200">{parseNewFields(selectedChecklistForView).motivo_inspecao || 'MOBILIZAÇÃO'}</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Descrição</span>
                    <strong className="text-slate-200">{selectedChecklistForView.descricao_item}</strong>
                  </div>
               </div>

               {/* Respostas */}
               <div>
                 <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 mb-3">Respostas da Inspeção</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                    {[
                      { l: 'Cabo de Alimentação', v: selectedChecklistForView.cabo_alimentacao },
                      { l: 'Plugues e Conectores', v: selectedChecklistForView.plugue_conectores },
                      { l: 'Carcaça/Estrutura', v: selectedChecklistForView.carcaca_estrutura },
                      { l: 'Comandos de Emergência', v: selectedChecklistForView.comandos_emergencia },
                      { l: 'Painel Digital', v: selectedChecklistForView.painel_digital },
                      { l: 'Aterramento', v: selectedChecklistForView.continuidade_aterramento },
                      { l: 'Aquecimento', v: selectedChecklistForView.resistencia_aquecimento },
                    ].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                        <span className="text-slate-400">{item.l}</span>
                        <span className={`font-bold uppercase text-[10px] ${item.v === 'Conforme' ? 'text-emerald-400' : 'text-rose-400'}`}>{item.v}</span>
                      </div>
                    ))}
                 </div>
               </div>

               {/* Fotos */}
               {getChecklistPhotos(selectedChecklistForView).length > 0 && (
                 <div>
                   <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 mb-3">Evidências</h3>
                   <div className="flex gap-3 overflow-x-auto pb-2">
                     {getChecklistPhotos(selectedChecklistForView).map((url, idx) => (
                       <img key={idx} src={url} alt={`Evidência ${idx+1}`} className="w-32 h-32 object-cover rounded-xl border border-slate-800 flex-shrink-0" />
                     ))}
                   </div>
                 </div>
               )}
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-950">
              <button onClick={() => handlePrintChecklist(selectedChecklistForView)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Printer className="w-4 h-4" /> Gerar Laudo PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" />
                Nova Inspeção de Equipamento
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form id="new-checklist-form" onSubmit={handleSaveChecklist} className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
                      TAG do Equipamento <span className="text-slate-500 font-normal">(Opcional)</span>
                    </label>
                    <input type="text" value={chkTagEquipamento} onChange={e => setChkTagEquipamento(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Centro de Custo / Obra</label>
                    <input type="text" value={chkCentroCusto} onChange={e => setChkCentroCusto(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Descrição do Item <span className="text-rose-500">*</span></label>
                    <input type="text" value={chkDescricaoItem} onChange={e => setChkDescricaoItem(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Quantidade <span className="text-rose-500">*</span></label>
                      <input type="number" min="1" value={chkQuantidade} onChange={e => setChkQuantidade(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Unidade <span className="text-rose-500">*</span></label>
                      <select value={chkUnidadeMedida} onChange={e => setChkUnidadeMedida(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none">
                        <option value="UN">UN - Unidade</option>
                        <option value="PC">PC - Peça</option>
                        <option value="CJ">CJ - Conjunto</option>
                      </select>
                    </div>
                  </div>
              </div>

              <div className="border-t border-slate-800 pt-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-4">Critérios de Avaliação Técnica</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Cabo de Alimentação', state: caboAlimentacao, setter: setCaboAlimentacao },
                    { label: 'Plugues e Conectores', state: plugueConectores, setter: setPlugueConectores },
                    { label: 'Carcaça e Estrutura', state: carcacaEstrutura, setter: setCarcacaEstrutura },
                    { label: 'Comandos de Emergência', state: comandosEmergencia, setter: setComandosEmergencia },
                    { label: 'Painel Digital', state: painelDigital, setter: setPainelDigital },
                    { label: 'Aterramento', state: continuidadeAterramento, setter: setContinuidadeAterramento },
                    { label: 'Aquecimento', state: resistenciaAquecimento, setter: setResistenciaAquecimento },
                  ].map((item, idx) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">{item.label}</span>
                      <select value={item.state} onChange={e => item.setter(e.target.value as any)} className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-amber-500">
                        <option value="Conforme">Conforme</option>
                        <option value="Não Conforme">Não Conforme</option>
                        <option value="N.A.">N.A.</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-4">Fotos e Evidências <span className="text-rose-500">* (Mín. 2)</span></h3>
                <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center hover:bg-slate-800/30 transition-colors">
                  <input type="file" multiple accept="image/*" onChange={e => setFotosSelecionadas(Array.from(e.target.files || []))} className="hidden" id="fotos-upload" />
                  <label htmlFor="fotos-upload" className="cursor-pointer flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-amber-500 hover:text-amber-400">Clique para anexar</span>
                      <span className="text-slate-400 text-sm ml-1">ou arraste os arquivos</span>
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-black">Fotos Selecionadas: {fotosSelecionadas.length}</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-6">
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Parecer Técnico Final <span className="text-rose-500">*</span></label>
                <select value={statusLiberacao} onChange={e => setStatusLiberacao(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none mb-4">
                  <option value="">Selecione o parecer...</option>
                  <option value="LIBERADO PARA OPERAÇÃO">LIBERADO PARA OPERAÇÃO (Verde)</option>
                  <option value="LIBERADO COM RESTRIÇÃO">LIBERADO COM RESTRIÇÃO (Amarelo)</option>
                  <option value="REPROVADO / MANUTENÇÃO">REPROVADO / MANUTENÇÃO (Vermelho)</option>
                </select>

                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Observações / Ressalvas</label>
                <textarea rows={3} value={observacoesTecnicas} onChange={e => setObservacoesTecnicas(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none resize-none" placeholder="Detalhes técnicos adicionais..."></textarea>
              </div>

            </form>
            <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-950">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button form="new-checklist-form" type="submit" disabled={isSavingChecklist} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2">
                {isSavingChecklist ? 'Gravando...' : 'Salvar Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE AREA (Hidden normally) */}
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #printable-laudo, #printable-laudo * { visibility: visible; }
            #printable-laudo { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; }
          }
        `}
      </style>
      {printChecklist && (
        <div id="printable-laudo" className="hidden bg-white text-black p-8 font-sans w-full max-w-4xl mx-auto border border-slate-300 rounded-lg">
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block leading-none">LAUDO TÉCNICO DE INSPEÇÃO</span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 uppercase">Gestão de Equipamentos</h1>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-500 uppercase">
              <div>SINC REALTIME ATIVO</div>
              <div>Data: {printChecklist?.created_at ? new Date(printChecklist.created_at).toLocaleString('pt-BR') : '-'}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
            <div><span className="block text-[9px] font-black uppercase text-slate-500">TAG do Equipamento</span><strong className="text-sm text-slate-900 font-bold">{printChecklist?.tag_equipamento || 'S/T'}</strong></div>
            <div><span className="block text-[9px] font-black uppercase text-slate-500">Descrição do Item</span><strong className="text-sm text-slate-900 font-bold">{printChecklist?.descricao_item}</strong></div>
            <div><span className="block text-[9px] font-black uppercase text-slate-500">Eletricista / Inspetor</span><strong className="text-sm text-slate-900 font-bold">{printChecklist?.eletricista_responsavel}</strong></div>
            <div><span className="block text-[9px] font-black uppercase text-slate-500">Motivo</span><strong className="text-sm text-slate-900 font-bold">{parseNewFields(printChecklist).motivo_inspecao || 'Inspeção Regular'}</strong></div>
            <div><span className="block text-[9px] font-black uppercase text-slate-500">Centro de Custo</span><strong className="text-sm text-slate-900 font-bold">{parseNewFields(printChecklist).centro_de_custo || 'N/A'}</strong></div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">Inspeção Visual e Física</h3>
            <table className="w-full text-left text-xs border-collapse">
              <tbody className="divide-y divide-slate-100">
                <tr><td className="py-2">Cabo de Alimentação</td><td className="py-2 text-right font-bold">{printChecklist.cabo_alimentacao}</td></tr>
                <tr><td className="py-2">Plugues e Conectores</td><td className="py-2 text-right font-bold">{printChecklist.plugue_conectores}</td></tr>
                <tr><td className="py-2">Carcaça e Estrutura</td><td className="py-2 text-right font-bold">{printChecklist.carcaca_estrutura}</td></tr>
                <tr><td className="py-2">Comandos de Emergência</td><td className="py-2 text-right font-bold">{printChecklist.comandos_emergencia}</td></tr>
                <tr><td className="py-2">Painel Digital</td><td className="py-2 text-right font-bold">{printChecklist.painel_digital}</td></tr>
                <tr><td className="py-2">Aterramento</td><td className="py-2 text-right font-bold">{printChecklist.continuidade_aterramento}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-100 border-2 border-slate-300 rounded-xl flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-slate-600">PARECER TÉCNICO FINAL</span>
            <span className="text-lg font-black uppercase tracking-wider text-slate-900">{printChecklist.status_liberacao}</span>
          </div>
        </div>
      )}

    </div>
  );
}
