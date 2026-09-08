import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Wrench, 
  Plus, 
  Check, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  AlertTriangle, 
  Calendar, 
  User, 
  Users,
  Clock, 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter, 
  FileSpreadsheet,
  AlertCircle,
  Play,
  Save,
  Send,
  X,
  Hammer,
  ClipboardList,
  Eye,
  Printer,
  Camera,
  Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Define TS Interfaces according to the requested data schema
export interface TimelineEvent {
  timestamp: string;
  user: string;
  action: string;
  details?: string;
}

export interface OficinaEletricaDemanda {
  id: string;
  tipo_demanda: 'Semanal' | 'Avulsa';
  categoria_atividade: 'SERVIÇO' | 'FABRICAÇÃO' | 'MANUTENÇÃO';
  tipo_manutencao?: 'Preventiva' | 'Corretiva' | 'Adaptação' | null;
  nome_item?: string;
  descricao: string;
  quantidade: number;
  prazo_original: string; // YYYY-MM-DD
  prazo_atual: string; // YYYY-MM-DD
  status: 'Rascunho' | 'Sem atendimento' | 'Em andamento' | 'Executado' | 'CONCLUÍDO' | 'FINALIZADO' | 'Cancelado' | 'CANCELADO' | 'PARCIALMENTE ATRIBUÍDO' | 'TOTALMENTE ATRIBUÍDO' | 'PARCIALMENTE DISTRIBUÍDO' | 'TOTALMENTE DISTRIBUÍDO';
  executor_nome?: string;
  co_realizadores?: string[];
  justificativa_cancelamento?: string;
  historico_timeline: TimelineEvent[];
  sub_atribuicoes?: any[];
  created_at: string;
}

interface OficinaEletricaProps {
  onBackToHub: () => void;
}

const listaEletricistas = ['JOSÉ PAULO', 'LEOMAR', 'SEBASTIÃO', 'MARCELO'];

const parseSubAtribuicoes = (dem: any): any[] => {
  if (dem && Array.isArray(dem.sub_atribuicoes)) {
    return dem.sub_atribuicoes;
  }
  if (dem && typeof dem.sub_atribuicoes === 'string') {
    try {
      return JSON.parse(dem.sub_atribuicoes);
    } catch (e) {}
  }
  // Fallback to timeline
  if (dem && Array.isArray(dem.historico_timeline)) {
    const subEvent = dem.historico_timeline.find((e: any) => e.action === 'SubAtribuicoesState' && Array.isArray(e.sub_atribuicoes));
    if (subEvent) {
      return subEvent.sub_atribuicoes;
    }
  }
  return [];
};

const getCoRealizadores = (dem: any): string[] => {
  if (dem && Array.isArray(dem.co_realizadores)) {
    return dem.co_realizadores;
  }
  // Fallback to searching the timeline
  if (dem && Array.isArray(dem.historico_timeline)) {
    const startEvent = [...dem.historico_timeline]
      .reverse()
      .find((e: any) => e.co_realizadores && Array.isArray(e.co_realizadores));
    if (startEvent) {
      return startEvent.co_realizadores;
    }
  }
  return [];
};

const formatDateToBR = (dateStr: string | null | undefined) => {
  if (!dateStr) return 'N/A';
  try {
    // If the input format is YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      const date = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
      return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }
    // If it is already ISO string (e.g. created_at or completedDate), use local date with UTC safety or standard locale format
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('pt-BR');
  } catch (e) {
    return dateStr;
  }
};

export default function OficinaEletrica({ onBackToHub }: OficinaEletricaProps) {
  const { session } = useAuth();
  
  // 1. STATE & PERSISTENCE
  const [demandas, setDemandas] = useState<OficinaEletricaDemanda[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<'admin' | 'gestao' | 'executor' | 'checklist'>('admin');

  // CHECKLIST DIGITAL STATES
  const [devolucoesAtivos, setDevolucoesAtivos] = useState<any[]>([]);
  const [isLoadingAtivos, setIsLoadingAtivos] = useState(false);
  const [checklistsSalvos, setChecklistsSalvos] = useState<any[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);

  // Manual Inputs for Checklist
  const [chkTagEquipamento, setChkTagEquipamento] = useState('');
  const [chkCentroCusto, setChkCentroCusto] = useState('');
  const [chkDescricaoItem, setChkDescricaoItem] = useState('');
  const [chkFornecedor, setChkFornecedor] = useState('');
  const [chkQuantidade, setChkQuantidade] = useState<number | ''>('');
  const [chkUnidadeMedida, setChkUnidadeMedida] = useState('UN');
  const [eletricistaResponsavel, setEletricistaResponsavel] = useState(() => {
    return session?.nome || '';
  });
  const [caboAlimentacao, setCaboAlimentacao] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [plugueConectores, setPlugueConectores] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [carcacaEstrutura, setCarcacaEstrutura] = useState<'Conforme' | 'Não Conforme'>('Conforme');
  const [comandosEmergencia, setComandosEmergencia] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [painelDigital, setPainelDigital] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [continuidadeAterramento, setContinuidadeAterramento] = useState<'Conforme' | 'Não Conforme'>('Conforme');
  const [resistenciaAquecimento, setResistenciaAquecimento] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  
  // New States
  const [motivoInspecao, setMotivoInspecao] = useState<'MOBILIZAÇÃO' | 'DESMOBILIZAÇÃO'>('MOBILIZAÇÃO');
  const [extintor, setExtintor] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [bateria, setBateria] = useState<'Conforme' | 'Não Conforme' | 'N.A.'>('Conforme');
  const [tensaoEquipamento, setTensaoEquipamento] = useState('');

  const [statusLiberacao, setStatusLiberacao] = useState<'LIBERADO PARA OPERAÇÃO' | 'LIBERADO COM RESTRIÇÃO' | 'BLOQUEADO / NECESSITA MANUTENÇÃO' | 'DISPONÍVEL PARA A OPERAÇÃO' | 'DISPONÍVEL PARA DEVOLVER'>('DISPONÍVEL PARA A OPERAÇÃO');
  const [observacoesTecnicas, setObservacoesTecnicas] = useState('');
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
  const [selectedChecklistForView, setSelectedChecklistForView] = useState<any | null>(null);
  const [printChecklist, setPrintChecklist] = useState<any | null>(null);

  // Evidências Fotográficas States & Helpers
  const [fotosSelecionadas, setFotosSelecionadas] = useState<File[]>([]);
  const [fotosPreviews, setFotosPreviews] = useState<string[]>([]);
  const [selectedPhotosModal, setSelectedPhotosModal] = useState<{ title: string; photos: string[] } | null>(null);
  const [expandedPhotoUrl, setExpandedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const urls = fotosSelecionadas.map(file => URL.createObjectURL(file));
    setFotosPreviews(urls);
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [fotosSelecionadas]);

  const handlePhotosSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFotosSelecionadas(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setFotosSelecionadas(prev => prev.filter((_, i) => i !== index));
  };

  const getChecklistPhotos = (chk: any): string[] => {
    if (!chk) return [];
    if (Array.isArray(chk?.fotos_evidencia) && chk.fotos_evidencia.length > 0) {
      return chk.fotos_evidencia;
    }
    if (typeof chk?.fotos_evidencia === 'string') {
      try {
        const parsed = JSON.parse(chk.fotos_evidencia);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        if (chk.fotos_evidencia.startsWith('http')) {
          return chk.fotos_evidencia.split(',').map((s: string) => s.trim());
        }
      }
    }
    if (chk?.observacoes_tecnicas && typeof chk.observacoes_tecnicas === 'string') {
      const match = chk.observacoes_tecnicas.match(/\[Fotos:\s*([^\]]+)\]/);
      if (match && match[1]) {
        return match[1].split(',').map((s: string) => s.trim()).filter((s: string) => s.startsWith('http'));
      }
    }
    return [];
  };

  // Automatic Status Logic based on Motivo da Inspeção
  useEffect(() => {
    if (motivoInspecao === 'MOBILIZAÇÃO') {
      setStatusLiberacao('DISPONÍVEL PARA A OPERAÇÃO');
    } else if (motivoInspecao === 'DESMOBILIZAÇÃO') {
      setStatusLiberacao('DISPONÍVEL PARA DEVOLVER');
    }
  }, [motivoInspecao]);

  const parseNewFields = (chk: any) => {
    const data = {
      motivo_inspecao: chk?.motivo_inspecao || '',
      extintor: chk?.extintor || '',
      bateria: chk?.bateria || '',
      tensao_equipamento: chk?.tensao_equipamento || '',
      centro_de_custo: chk?.centro_de_custo || ''
    };

    // If not present in direct keys, try parsing from observacoes_tecnicas
    if (!data.motivo_inspecao && chk?.observacoes_tecnicas) {
      const match = chk.observacoes_tecnicas.match(/\[Motivo: (.*?) \| Extintor: (.*?) \| Bateria: (.*?) \| Tensão: (.*?)\]/);
      if (match) {
        data.motivo_inspecao = match[1];
        data.extintor = match[2];
        data.bateria = match[3];
        data.tensao_equipamento = match[4];
      }
    }

    if (!data.centro_de_custo && chk?.observacoes_tecnicas) {
      const matchCC = chk.observacoes_tecnicas.match(/\[Centro de Custo: (.*?)\]/);
      if (matchCC) {
        data.centro_de_custo = matchCC[1];
      }
    }

    return data;
  };

  const formatarObservacoes = (obsCrua: string | undefined | null) => {
    if (!obsCrua || typeof obsCrua !== 'string') return { texto: '', fotos: [] };

    // Extrai tudo que está após "[Fotos:" até o final da string (ou fechamento de colchete)
    const fotosMatch = obsCrua.match(/\[Fotos:\s*(.*?)\]/i) || obsCrua.match(/\[Fotos:\s*(.*)/i);
    let fotos: string[] = [];
    if (fotosMatch && fotosMatch[1]) {
      // Separa as URLs por vírgula e limpa os espaços
      fotos = fotosMatch[1]
        .replace(/\]$/, '')
        .split(',')
        .map(url => url.trim())
        .filter(url => url.startsWith('http'));
    }

    // Remove metadados serializados como [Fotos:...], [Motivo:...], [Centro de Custo:...]
    let textoLimpo = obsCrua
      .replace(/\[Fotos:.*?\]/gi, '')
      .replace(/\[Motivo:.*?\]/gi, '')
      .replace(/\[Centro de Custo:.*?\]/gi, '')
      .trim();

    return { texto: textoLimpo, fotos };
  };

  const handlePrintChecklist = (chk: any) => {
    setPrintChecklist(chk);
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
          window.print();
        } else {
          alert('A impressão está bloqueada neste ambiente de visualização. Por favor, abra a aplicação numa nova aba para imprimir.');
        }
      } catch (err) {
        console.error('Falha ao acionar a impressão do navegador:', err);
        alert('A impressão falhou ou está bloqueada neste ambiente de visualização. Por favor, abra a aplicação numa nova aba para imprimir.');
      }
    }, 250);
  };

  const fetchDevolucoesAtivos = async () => {
    setIsLoadingAtivos(true);
    try {
      const { data, error } = await supabase
        .from('devolucoes_ativos')
        .select('*');
      if (error) {
        console.error('Erro ao buscar devolucoes_ativos:', error);
      } else if (data) {
        setDevolucoesAtivos(data);
      }
    } catch (err) {
      console.error('Falha na comunicação com Supabase devolucoes_ativos:', err);
    } finally {
      setIsLoadingAtivos(false);
    }
  };

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
    if (!chkDescricaoItem.trim()) {
      showToast('Por favor, preencha a Descrição do Item!', 'error');
      return;
    }
    if (chkQuantidade === '' || Number(chkQuantidade) <= 0) {
      showToast('Por favor, informe uma Quantidade válida e maior que zero!', 'error');
      return;
    }
    if (!chkUnidadeMedida) {
      showToast('Por favor, selecione ou informe a Unidade de Medida!', 'error');
      return;
    }
    if (!eletricistaResponsavel.trim()) {
      showToast('Por favor, preencha o Eletricista Responsável!', 'error');
      return;
    }
    if (!caboAlimentacao || !plugueConectores || !carcacaEstrutura || !comandosEmergencia || !painelDigital || !continuidadeAterramento || !resistenciaAquecimento) {
      showToast('Por favor, responda a todos os itens do checklist!', 'error');
      return;
    }
    if (!statusLiberacao) {
      showToast('Por favor, selecione o parecer técnico final!', 'error');
      return;
    }

    // Trava de Validação OBRIGATÓRIA: Mínimo 2 fotos de evidência
    if (fotosSelecionadas.length < 2) {
      showToast('Obrigatório anexar pelo menos 2 fotos de evidência do equipamento.', 'error');
      return;
    }

    setIsSavingChecklist(true);

    // Upload das evidências fotográficas para o Supabase Storage (bucket: checklists_fotos)
    const fotosUrls: string[] = [];
    try {
      for (let i = 0; i < fotosSelecionadas.length; i++) {
        const file = fotosSelecionadas[i];
        const fileExt = file.name.split('.').pop() || 'jpg';
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${cleanName}`;
        const filePath = `evidencias/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('checklists_fotos')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Erro no upload da foto:', uploadError);
          throw new Error(`Falha ao fazer upload da foto ${file.name}: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('checklists_fotos')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          fotosUrls.push(publicUrlData.publicUrl);
        }
      }
    } catch (uploadErr: any) {
      setIsSavingChecklist(false);
      showToast(`Erro no envio das fotos de evidência: ${uploadErr.message || uploadErr}`, 'error');
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
        // New fields
        motivo_inspecao: motivoInspecao,
        extintor: extintor,
        bateria: bateria,
        tensao_equipamento: tensaoEquipamento,
        centro_de_custo: chkCentroCusto.trim() || null,
        fotos_evidencia: fotosUrls
      };

      let insertError;
      const { error } = await supabase
        .from('checklists_eletrica')
        .insert(checklistPayload);
      insertError = error;

      if (error && error.message && (error.message.includes('column') || error.message.includes('not exist') || error.message.includes('invalid field'))) {
        // Fallback: serialize new fields into observations and try without them
        const serializedDetails = `[Motivo: ${motivoInspecao} | Extintor: ${extintor} | Bateria: ${bateria} | Tensão: ${tensaoEquipamento}]${chkCentroCusto.trim() ? ` [Centro de Custo: ${chkCentroCusto.trim()}]` : ''}${fotosUrls.length > 0 ? ` [Fotos: ${fotosUrls.join(', ')}]` : ''}`;
        const updatedObs = observacoesTecnicas.trim() 
          ? `${observacoesTecnicas.trim()} ${serializedDetails}`
          : serializedDetails;
        
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

        const { error: fallbackError } = await supabase
          .from('checklists_eletrica')
          .insert(fallbackPayload);
        insertError = fallbackError;
      }

      if (insertError) {
        throw insertError;
      }

      // Business logic: if final status is "BLOQUEADO" or matching maintenance, change the status_texto of devolucoes_ativos to "Manutenção Interna Elétrica" for matched TAG
      if ((statusLiberacao.startsWith('BLOQUEADO') || statusLiberacao === 'DISPONÍVEL PARA DEVOLVER') && chkTagEquipamento.trim()) {
        const { data: matchedAtivos, error: searchError } = await supabase
          .from('devolucoes_ativos')
          .select('id')
          .ilike('tag_equipamento', chkTagEquipamento.trim());

        if (matchedAtivos && matchedAtivos.length > 0) {
          const idsToUpdate = matchedAtivos.map(item => item.id);
          const { error: updateError } = await supabase
            .from('devolucoes_ativos')
            .update({ status_texto: 'Manutenção Interna Elétrica' })
            .in('id', idsToUpdate);

          if (updateError) {
            console.error('Erro ao atualizar status_texto:', updateError);
          }
        }
      }

      showToast('Checklist gravado com sucesso!', 'success');

      // Reset form fields
      setChkTagEquipamento('');
      setChkCentroCusto('');
      setChkDescricaoItem('');
      setChkFornecedor('');
      setChkQuantidade('');
      setChkUnidadeMedida('UN');
      setEletricistaResponsavel(session?.nome || '');
      setCaboAlimentacao('Conforme');
      setPlugueConectores('Conforme');
      setCarcacaEstrutura('Conforme');
      setComandosEmergencia('Conforme');
      setPainelDigital('Conforme');
      setContinuidadeAterramento('Conforme');
      setResistenciaAquecimento('Conforme');
      
      // Reset new states
      setMotivoInspecao('MOBILIZAÇÃO');
      setExtintor('Conforme');
      setBateria('Conforme');
      setTensaoEquipamento('');
      setStatusLiberacao('DISPONÍVEL PARA A OPERAÇÃO');
      setObservacoesTecnicas('');
      setFotosSelecionadas([]);

      // Reload
      fetchChecklists();
      fetchDevolucoesAtivos();
    } catch (err: any) {
      console.error('Erro ao salvar checklist:', err);
      showToast(`Erro ao salvar checklist: ${err.message || err}`, 'error');
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const renderQuestion = (
    id: string,
    title: string,
    improvement: string,
    value: string,
    onChange: (val: any) => void,
    options: string[] = ['Conforme', 'Não Conforme', 'N.A.']
  ) => {
    return (
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-2xl space-y-3 shadow-xs hover:border-slate-800 transition" id={`question-${id}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-black uppercase text-slate-200 tracking-wide">{title}</h4>
            <p className="text-[10px] text-slate-500 uppercase mt-0.5 font-bold">💡 Melhoria: {improvement}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {options.map((option) => {
            const isSelected = value === option;
            let colorClass = '';
            if (option === 'Conforme' || option === 'CO2') {
              colorClass = isSelected
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/15'
                : 'bg-slate-950 text-emerald-400 border-emerald-950 hover:bg-emerald-950/20';
            } else if (option === 'Não Conforme' || option === 'PQS') {
              colorClass = isSelected
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-900/15'
                : 'bg-slate-950 text-rose-400 border-rose-950 hover:bg-rose-950/20';
            } else if (option === 'ÁGUA') {
              colorClass = isSelected
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/15'
                : 'bg-slate-950 text-blue-400 border-blue-950 hover:bg-blue-950/20';
            } else {
              colorClass = isSelected
                ? 'bg-slate-700 text-white border-slate-600'
                : 'bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900';
            }
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer ${colorClass}`}
                id={`option-${id}-${option.replace(' ', '-').toLowerCase()}`}
              >
                {option === 'Conforme' && '✅ '}
                {option === 'Não Conforme' && '❌ '}
                {option === 'N.A.' && '⚪ '}
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // RBAC Setup: Initialize tab to 'executor' if profile is exactly 'ELETRICISTA'
  useEffect(() => {
    if (session?.perfil === 'ELETRICISTA') {
      setActiveTab('executor');
    }
  }, [session]);

  // Toasts
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Current Date Helper for verification
  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Check if a date has expired
  const isExpired = (dueDate: string) => {
    return todayStr > dueDate;
  };

  // Calculation of active days in progress from timeline
  const getDaysInProgress = (demanda: OficinaEletricaDemanda) => {
    const startEvent = demanda.historico_timeline?.find(t => t.action === 'Início de Atividade' || t.action === 'Alteração de Prazo (Aceite)');
    const start = startEvent ? new Date(startEvent.timestamp) : new Date(demanda.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getCompletedAtDate = (demanda: OficinaEletricaDemanda) => {
    const compEvent = demanda.historico_timeline?.find(t => t.action === 'Atividade Concluída');
    return compEvent ? compEvent.timestamp : demanda.created_at;
  };

  // 2. SUPABASE FETCH & REALTIME CHANNEL
  const fetchDemandas = async () => {
    try {
      const { data, error } = await supabase
        .from('oficina_eletrica')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar demandas da Oficina Elétrica:', error);
        showToast(`Erro ao carregar demandas da oficina: ${error.message} (${error.code})`, 'error');
      } else if (data) {
        // Parse historico_timeline if stored as string, though PostgREST usually parses jsonb automatically
        const formatted: OficinaEletricaDemanda[] = data.map((item: any) => ({
          ...item,
          historico_timeline: typeof item.historico_timeline === 'string'
            ? JSON.parse(item.historico_timeline)
            : (item.historico_timeline || []),
          sub_atribuicoes: typeof item.sub_atribuicoes === 'string'
            ? JSON.parse(item.sub_atribuicoes)
            : (item.sub_atribuicoes || [])
        }));
        setDemandas(formatted);
      }
    } catch (err) {
      console.error('Falha na comunicação com Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandas();
    fetchDevolucoesAtivos();
    fetchChecklists();

    // Set up Realtime listener for strict, instant reactive synchronization
    const channel = supabase
      .channel('oficina_eletrica_realtime_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'oficina_eletrica'
        },
        () => {
          fetchDemandas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ==========================================
  // ABA 1: STATE & HANDLERS (ADMIN / CRIAÇÃO)
  // ==========================================
  const [tipoDemanda, setTipoDemanda] = useState<'Semanal' | 'Avulsa'>('Semanal');
  const [categoriaAtividade, setCategoriaAtividade] = useState<'SERVIÇO' | 'FABRICAÇÃO' | 'MANUTENÇÃO'>('SERVIÇO');
  const [tipoManutencao, setTipoManutencao] = useState<'Preventiva' | 'Corretiva' | 'Adaptação' | null>(null);
  const [descricao, setDescricao] = useState('');
  const [nomeItem, setNomeItem] = useState('');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [prazo, setPrazo] = useState(todayStr);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (categoriaAtividade !== 'MANUTENÇÃO') {
      setTipoManutencao(null);
    }
  }, [categoriaAtividade]);

  const handleSaveDemanda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeItem.trim()) {
      showToast('O campo Nome do Item / Equipamento é obrigatório!', 'error');
      return;
    }
    if (!descricao.trim()) {
      showToast('O campo Descrição detalhada é obrigatório!', 'error');
      return;
    }
    if (quantidade <= 0) {
      showToast('A quantidade deve ser maior que zero!', 'error');
      return;
    }
    if (!prazo) {
      showToast('Defina o prazo final da atividade!', 'error');
      return;
    }
    if (categoriaAtividade === 'MANUTENÇÃO' && !tipoManutencao) {
      showToast('Por favor, selecione o Tipo de Manutenção!', 'error');
      return;
    }

    const userName = session?.nome || 'Usuário do Planejamento';

    if (editingId) {
      // Edit mode
      const targetDem = demandas.find(d => d.id === editingId);
      if (!targetDem) return;

      const updatedTimeline = [
        ...targetDem.historico_timeline,
        {
          timestamp: new Date().toISOString(),
          user: userName,
          action: 'Alteração no Planejamento',
          details: `Serviço editado no rascunho. Novo prazo original: ${prazo}. Categoria: ${categoriaAtividade}${tipoManutencao ? ` (${tipoManutencao})` : ''}.`
        }
      ];

      const { error } = await supabase
        .from('oficina_eletrica')
        .update({
          tipo_demanda: tipoDemanda,
          categoria_atividade: categoriaAtividade,
          tipo_manutencao: tipoManutencao,
          nome_item: nomeItem.trim(),
          descricao: descricao.trim(),
          quantidade,
          prazo_original: prazo,
          prazo_atual: prazo,
          historico_timeline: updatedTimeline
        })
        .eq('id', editingId);

      if (error) {
        console.error('Erro ao atualizar no Supabase:', error);
        showToast(`Erro ao atualizar rascunho de demanda: ${error.message} (${error.code})`, 'error');
      } else {
        showToast('Rascunho de demanda updated with success!', 'success');
        setEditingId(null);
        setNomeItem('');
        setDescricao('');
        setQuantidade(1);
        setPrazo(todayStr);
        setCategoriaAtividade('SERVIÇO');
        setTipoManutencao(null);
        setTipoDemanda('Semanal');
        fetchDemandas();
      }
    } else {
      // Create new Demanda
      const newId = crypto.randomUUID();
      const newDemanda = {
        id: newId,
        tipo_demanda: tipoDemanda,
        categoria_atividade: categoriaAtividade,
        tipo_manutencao: tipoManutencao,
        nome_item: nomeItem.trim(),
        descricao: descricao.trim(),
        quantidade,
        prazo_original: prazo,
        prazo_atual: prazo,
        status: 'Rascunho' as const,
        historico_timeline: [
          {
            timestamp: new Date().toISOString(),
            user: userName,
            action: 'Criação da Demanda',
            details: `Demandas de oficina criadas com status de Rascunho.`
          }
        ],
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('oficina_eletrica')
        .insert(newDemanda);

      if (error) {
        console.error('Erro ao inserir no Supabase:', error);
        showToast(`Erro ao cadastrar nova demanda no banco: ${error.message} (${error.code})`, 'error');
      } else {
        showToast('Rascunho de demanda criado com sucesso!', 'success');
        setNomeItem('');
        setDescricao('');
        setQuantidade(1);
        setPrazo(todayStr);
        setCategoriaAtividade('SERVIÇO');
        setTipoManutencao(null);
        setTipoDemanda('Semanal');
        fetchDemandas();
      }
    }
  };

  const handleStartEdit = (dem: OficinaEletricaDemanda) => {
    setEditingId(dem.id);
    setTipoDemanda(dem.tipo_demanda);
    setCategoriaAtividade(dem.categoria_atividade || 'SERVIÇO');
    setTipoManutencao(dem.tipo_manutencao || null);
    setNomeItem(dem.nome_item || '');
    setDescricao(dem.descricao);
    setQuantidade(dem.quantidade);
    setPrazo(dem.prazo_atual);
    showToast(`Carregado para edição.`);
  };

  const handleDeleteDemanda = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o rascunho?`)) {
      const { error } = await supabase
        .from('oficina_eletrica')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir no Supabase:', error);
        showToast(`Erro ao remover rascunho do banco: ${error.message} (${error.code})`, 'error');
      } else {
        showToast('Demanda excluída com sucesso!', 'info');
        if (editingId === id) {
          setEditingId(null);
          setNomeItem('');
          setDescricao('');
          setQuantidade(1);
          setPrazo(todayStr);
          setCategoriaAtividade('SERVIÇO');
          setTipoManutencao(null);
        }
        fetchDemandas();
      }
    }
  };

  const handleLiberarDemanda = async (id: string) => {
    const userName = session?.nome || 'Usuário do Planejamento';
    const targetDem = demandas.find(d => d.id === id);
    if (!targetDem) return;

    const updatedTimeline = [
      ...targetDem.historico_timeline,
      {
        timestamp: new Date().toISOString(),
        user: userName,
        action: 'Liberação para Oficina',
        details: 'Demanda liberada do rascunho para a fila da Oficina Elétrica.'
      }
    ];

    const { error } = await supabase
      .from('oficina_eletrica')
      .update({
        status: 'Sem atendimento',
        historico_timeline: updatedTimeline
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao liberar demanda:', error);
      showToast(`Erro ao liberar para atendimento: ${error.message} (${error.code})`, 'error');
    } else {
      showToast('Demanda liberada com sucesso! Agora visível na Gestão e no Executor.', 'success');
      fetchDemandas();
    }
  };

  // ==========================================
  // ABA 2: STATE & HANDLERS (GESTÃO / KANBAN)
  // ==========================================
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimelineDemanda, setSelectedTimelineDemanda] = useState<OficinaEletricaDemanda | null>(null);

  // Filter demands for Kanban Grid (only show non-draft ones)
  const nonDraftDemandas = useMemo(() => {
    return demandas.filter(d => {
      const s = d.status ? d.status.trim().toUpperCase() : '';
      return s !== 'RASCUNHO';
    });
  }, [demandas]);

  const filteredKanbanDemandas = useMemo(() => {
    if (!searchQuery.trim()) return nonDraftDemandas;
    const queryLower = searchQuery.toLowerCase();
    return nonDraftDemandas.filter(d => 
      d.descricao.toLowerCase().includes(queryLower) || 
      (d.executor_nome && d.executor_nome.toLowerCase().includes(queryLower)) ||
      d.tipo_demanda.toLowerCase().includes(queryLower) ||
      (d.categoria_atividade && d.categoria_atividade.toLowerCase().includes(queryLower))
    );
  }, [nonDraftDemandas, searchQuery]);

  // Group columns for Kanban
  const kanbanColumns = useMemo(() => {
    const semAtendimento: OficinaEletricaDemanda[] = [];
    const emAndamento: OficinaEletricaDemanda[] = [];
    const executado: OficinaEletricaDemanda[] = [];
    const cancelado: OficinaEletricaDemanda[] = [];

    filteredKanbanDemandas.forEach(d => {
      const s = d.status ? d.status.trim().toUpperCase() : '';
      if (
        s === 'EM ANDAMENTO' || 
        s === 'PARCIALMENTE ATRIBUÍDO' || 
        s === 'TOTALMENTE ATRIBUÍDO' ||
        s === 'PARCIALMENTE DISTRIBUÍDO' || 
        s === 'TOTALMENTE DISTRIBUÍDO'
      ) {
        emAndamento.push(d);
      } else if (s === 'EXECUTADO' || s === 'CONCLUÍDO') {
        executado.push(d);
      } else if (s === 'CANCELADO') {
        cancelado.push(d);
      } else {
        semAtendimento.push(d);
      }
    });

    return {
      'Sem atendimento': semAtendimento,
      'Em andamento': emAndamento,
      'Executado': executado,
      'Cancelado': cancelado
    };
  }, [filteredKanbanDemandas]);

  // Cancel demand action
  const handleCancelDemanda = async (id: string) => {
    const justificativa = window.prompt("Digite uma justificativa obrigatória para o cancelamento:");
    if (justificativa === null) return; // user cancelled prompt
    if (!justificativa.trim()) {
      showToast("Justificativa de cancelamento é obrigatória!", "error");
      return;
    }

    const userName = session?.nome || 'Gestor de Oficina';
    const targetDem = demandas.find(d => d.id === id);
    if (!targetDem) return;

    const updatedTimeline = [
      ...targetDem.historico_timeline,
      {
        timestamp: new Date().toISOString(),
        user: userName,
        action: 'Cancelamento de Demanda',
        details: `Justificativa: ${justificativa.trim()}`
      }
    ];

    const { error } = await supabase
      .from('oficina_eletrica')
      .update({
        status: 'CANCELADO',
        justificativa_cancelamento: justificativa.trim(),
        historico_timeline: updatedTimeline
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao cancelar:', error);
      showToast(`Erro ao salvar cancelamento: ${error.message} (${error.code})`, 'error');
    } else {
      setDemandas(prev => prev.map(d => 
        d.id === id 
          ? { 
              ...d, 
              status: 'CANCELADO', 
              justificativa_cancelamento: justificativa.trim(),
              historico_timeline: updatedTimeline
            } 
          : d
      ));
      showToast("Demanda cancelada com sucesso!", "info");
      fetchDemandas();
    }
  };

  // Re-open/Restore to Queue
  const handleRestoreDemanda = async (id: string) => {
    const userName = session?.nome || 'Gestor de Oficina';
    const targetDem = demandas.find(d => d.id === id);
    if (!targetDem) return;

    const updatedTimeline = [
      ...targetDem.historico_timeline,
      {
        timestamp: new Date().toISOString(),
        user: userName,
        action: 'Reabertura de Demanda',
        details: `Reiniciado o status de atendimento da demanda.`
      }
    ];

    const { error } = await supabase
      .from('oficina_eletrica')
      .update({
        status: 'Sem atendimento',
        executor_nome: null,
        historico_timeline: updatedTimeline
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao restaurar:', error);
      showToast(`Erro ao reativar demanda: ${error.message} (${error.code})`, 'error');
    } else {
      showToast("Demanda restaurada para fila de espera!", "success");
      fetchDemandas();
    }
  };

  // ==========================================
  // ABA 3: STATE & HANDLERS (EXECUTOR APP)
  // ==========================================
  const [executorNameInput, setExecutorNameInput] = useState(() => {
    const initialName = session?.nome || '';
    const upperName = initialName.toUpperCase();
    return listaEletricistas.includes(upperName) ? upperName : '';
  });
  const [executorSubTab, setExecutorSubTab] = useState<'fila' | 'produtividade'>('fila');
  
  // Modais de Executor
  const [activeAcceptModal, setActiveAcceptModal] = useState<OficinaEletricaDemanda | null>(null);
  const [coRealizadores, setCoRealizadores] = useState<string[]>([]);
  const [activeDelayModal, setActiveDelayModal] = useState<OficinaEletricaDemanda | null>(null);
  
  // Reprogram states for active demands
  const [activeReprogramModal, setActiveReprogramModal] = useState<OficinaEletricaDemanda | null>(null);
  const [reprogramDate, setReprogramDate] = useState('');
  const [reprogramJustification, setReprogramJustification] = useState('');

  // Suggest values inside acceptance modal
  const [suggestNewDateFlag, setSuggestNewDateFlag] = useState(false);
  const [suggestedDate, setSuggestedDate] = useState('');
  const [suggestedJustification, setSuggestedJustification] = useState('');

  // Values inside delay justification modal (forced for delayed cards)
  const [delayNewDate, setDelayNewDate] = useState('');
  const [delayJustification, setDelayJustification] = useState('');
  const [delayedTargetAction, setDelayedTargetAction] = useState<{ type: 'start' | 'complete'; record: OficinaEletricaDemanda } | null>(null);

  // New States for Aceite e Distribuição de OS (Mestre View)
  const [activeAceiteDistribuicaoModal, setActiveAceiteDistribuicaoModal] = useState<OficinaEletricaDemanda | null>(null);
  const [concordaPrazo, setConcordaPrazo] = useState<boolean>(true);
  const [novoPrazoSugerido, setNovoPrazoSugerido] = useState<string>('');
  const [novaSubQtd, setNovaSubQtd] = useState<number | ''>('');
  const [subEletricistaResponsavel, setSubEletricistaResponsavel] = useState<string>('');
  const [subCoRealizadores, setSubCoRealizadores] = useState<string[]>([]);
  const [subDescricaoPapeis, setSubDescricaoPapeis] = useState<string>('');
  const [expandedFractionsId, setExpandedFractionsId] = useState<string | null>(null);

  // States for demand cancellation (Electrician View)
  const [cancelTargetDemanda, setCancelTargetDemanda] = useState<OficinaEletricaDemanda | null>(null);
  const [cancelJustification, setCancelJustification] = useState<string>('');
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);

  const handleOpenCancelarModal = (dem: OficinaEletricaDemanda) => {
    setCancelTargetDemanda(dem);
    setCancelJustification('');
  };

  const handleConfirmCancelarDemanda = async () => {
    if (!cancelTargetDemanda) return;
    if (!cancelJustification.trim()) {
      showToast("Por favor, insira uma justificativa para o cancelamento.", "error");
      return;
    }

    setCancelLoading(true);
    const userName = session?.nome || 'Eletricista Executor';

    const updatedTimeline = [
      ...(cancelTargetDemanda.historico_timeline || []),
      {
        timestamp: new Date().toISOString(),
        user: userName,
        action: 'Cancelamento',
        details: `Demanda cancelada. Motivo: ${cancelJustification.trim()}`
      }
    ];

    try {
      const { error } = await supabase
        .from('oficina_eletrica')
        .update({
          status: 'CANCELADO',
          justificativa_cancelamento: cancelJustification.trim(),
          data_cancelamento: new Date().toISOString(),
          historico_timeline: updatedTimeline
        })
        .eq('id', cancelTargetDemanda.id);

      if (error) {
        throw error;
      }

      setDemandas(prev => prev.map(d => 
        d.id === cancelTargetDemanda.id 
          ? { 
              ...d, 
              status: 'CANCELADO', 
              justificativa_cancelamento: cancelJustification.trim(),
              historico_timeline: updatedTimeline,
              data_cancelamento: new Date().toISOString()
            } 
          : d
      ));

      showToast("Demanda cancelada com sucesso", "success");
      setCancelTargetDemanda(null);
      setCancelJustification('');
      fetchDemandas();
    } catch (err: any) {
      console.error('Erro ao cancelar demanda:', err);
      showToast(`Erro ao cancelar demanda: ${err.message || err}`, 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  // Filter queue for Executor Tab
  const executorQueue = useMemo(() => {
    return demandas.filter(d => 
      d.status !== 'Rascunho' &&
      d.status !== 'CONCLUÍDO' &&
      d.status !== 'FINALIZADO' &&
      d.status !== 'Cancelado'
    );
  }, [demandas]);

  // Start activity flow
  const handleTriggerStartActivity = (dem: OficinaEletricaDemanda) => {
    if (!executorNameInput.trim()) {
      showToast("Por favor, selecione o Eletricista antes de iniciar!", "error");
      return;
    }

    // Show date agreement modal
    setSuggestNewDateFlag(false);
    setSuggestedDate(dem.prazo_atual);
    setSuggestedJustification('');
    setCoRealizadores(getCoRealizadores(dem));
    setActiveAcceptModal(dem);
  };

  const handleOpenAceiteDistribuicaoModal = (dem: OficinaEletricaDemanda) => {
    const currentSubs = parseSubAtribuicoes(dem);
    const somaAtribuidas = currentSubs.reduce((acc, s) => acc + s.quantidade, 0);
    const saldoPendente = dem.quantidade - somaAtribuidas;

    setActiveAceiteDistribuicaoModal(dem);
    setConcordaPrazo(true);
    setNovoPrazoSugerido(dem.prazo_atual);
    setNovaSubQtd(saldoPendente > 0 ? saldoPendente : '');
    setSubEletricistaResponsavel('');
    setSubCoRealizadores([]);
    setSubDescricaoPapeis('');
  };

  const handleSaveSubAtribuicao = async () => {
    if (!activeAceiteDistribuicaoModal) return;
    const dem = activeAceiteDistribuicaoModal;

    if (!novaSubQtd || Number(novaSubQtd) <= 0) {
      showToast("Por favor, informe uma quantidade válida maior que zero!", "error");
      return;
    }

    if (!subEletricistaResponsavel) {
      showToast("Por favor, selecione o Eletricista Responsável!", "error");
      return;
    }

    if (!subDescricaoPapeis.trim()) {
      showToast("Por favor, descreva os papéis/funções desta atribuição!", "error");
      return;
    }

    const currentSubs = parseSubAtribuicoes(dem);
    const somaAtribuidas = currentSubs.reduce((acc, s) => acc + s.quantidade, 0);
    const saldoPendente = dem.quantidade - somaAtribuidas;

    if (Number(novaSubQtd) > saldoPendente) {
      showToast(`A quantidade informada (${novaSubQtd}) excede o saldo pendente de distribuição (${saldoPendente})!`, "error");
      return;
    }

    const novaSub = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      quantidade: Number(novaSubQtd),
      eletricista_responsavel: subEletricistaResponsavel,
      co_realizadores: subCoRealizadores,
      descricao_papeis: subDescricaoPapeis,
      created_at: new Date().toISOString()
    };

    const updatedSubs = [...currentSubs, novaSub];
    const novaSomaAtribuidas = updatedSubs.reduce((acc, s) => acc + s.quantidade, 0);
    const novoSaldoPendente = dem.quantidade - novaSomaAtribuidas;

    let novoStatus = dem.status;
    if (novoSaldoPendente > 0) {
      novoStatus = 'PARCIALMENTE DISTRIBUÍDO';
    } else if (novoSaldoPendente === 0) {
      novoStatus = 'TOTALMENTE DISTRIBUÍDO';
    }

    const timelineEvent: TimelineEvent = {
      action: 'Atribuição Parcial',
      user: 'MESTRE',
      timestamp: new Date().toISOString(),
      details: `Sub-atribuição de ${novaSub.quantidade} unidades para ${subEletricistaResponsavel}. Apoio: ${subCoRealizadores.join(', ') || 'Nenhum'}. Papéis: ${subDescricaoPapeis}`
    };

    const stateSyncEvent: TimelineEvent = {
      action: 'SubAtribuicoesState',
      user: 'SISTEMA',
      timestamp: new Date().toISOString(),
      details: JSON.stringify(updatedSubs)
    };

    const updatedTimeline = [...(dem.historico_timeline || []), timelineEvent, stateSyncEvent];

    // If deadline was updated
    let finalPrazo = dem.prazo_atual;
    if (!concordaPrazo && novoPrazoSugerido) {
      finalPrazo = novoPrazoSugerido;
      updatedTimeline.push({
        action: 'Prazo Repactuado',
        user: 'MESTRE',
        timestamp: new Date().toISOString(),
        details: `Prazo alterado para ${formatDateToBR(novoPrazoSugerido)}`
      });
    }

    const payload: any = {
      status: novoStatus,
      prazo_atual: finalPrazo,
      historico_timeline: updatedTimeline,
      sub_atribuicoes: updatedSubs
    };

    let { error } = await supabase
      .from('oficina_eletrica')
      .update(payload)
      .eq('id', dem.id);

    if (error && (error.message.includes('column') || error.message.includes('not exist') || error.message.includes('invalid field'))) {
      const fallbackPayload = {
        status: novoStatus,
        prazo_atual: finalPrazo,
        historico_timeline: updatedTimeline
      };
      const { error: fallbackError } = await supabase
        .from('oficina_eletrica')
        .update(fallbackPayload)
        .eq('id', dem.id);
      error = fallbackError;
    }

    if (error) {
      showToast(`Erro ao salvar sub-atribuição: ${error.message}`, 'error');
    } else {
      showToast('Atribuição parcial salva com sucesso!', 'success');
      fetchDemandas();
      setActiveAceiteDistribuicaoModal(null);
    }
  };

  const handleDeleteSubAtribuicao = async (dem: OficinaEletricaDemanda, subId: string) => {
    const currentSubs = parseSubAtribuicoes(dem);
    const updatedSubs = currentSubs.filter((s: any) => s.id !== subId);
    const somaAtribuidas = updatedSubs.reduce((acc: number, s: any) => acc + s.quantidade, 0);
    const totalQtd = dem.quantidade;
    const saldoPendente = totalQtd - somaAtribuidas;

    let novoStatus = dem.status;
    if (somaAtribuidas === 0) {
      novoStatus = 'Sem atendimento';
    } else if (saldoPendente > 0) {
      novoStatus = 'PARCIALMENTE DISTRIBUÍDO';
    } else {
      novoStatus = 'TOTALMENTE DISTRIBUÍDO';
    }

    const timelineEvent: TimelineEvent = {
      action: 'Sub-atribuição Removida',
      user: 'MESTRE',
      timestamp: new Date().toISOString(),
      details: `Sub-atribuição removida pelo mestre.`
    };

    const stateSyncEvent: TimelineEvent = {
      action: 'SubAtribuicoesState',
      user: 'SISTEMA',
      timestamp: new Date().toISOString(),
      details: JSON.stringify(updatedSubs)
    };

    const updatedTimeline = [...(dem.historico_timeline || []), timelineEvent, stateSyncEvent];

    const payload: any = {
      status: novoStatus,
      historico_timeline: updatedTimeline,
      sub_atribuicoes: updatedSubs
    };

    let { error } = await supabase
      .from('oficina_eletrica')
      .update(payload)
      .eq('id', dem.id);

    if (error && (error.message.includes('column') || error.message.includes('not exist') || error.message.includes('invalid field'))) {
      const fallbackPayload = {
        status: novoStatus,
        historico_timeline: updatedTimeline
      };
      const { error: fallbackError } = await supabase
        .from('oficina_eletrica')
        .update(fallbackPayload)
        .eq('id', dem.id);
      error = fallbackError;
    }

    if (error) {
      showToast(`Erro ao remover sub-atribuição: ${error.message}`, 'error');
    } else {
      showToast('Sub-atribuição removida com sucesso!', 'success');
      fetchDemandas();
      // Update local modal state if open
      if (activeAceiteDistribuicaoModal && activeAceiteDistribuicaoModal.id === dem.id) {
        setActiveAceiteDistribuicaoModal({
          ...activeAceiteDistribuicaoModal,
          status: novoStatus as any,
          historico_timeline: updatedTimeline,
          sub_atribuicoes: updatedSubs
        });
        // Also update sub states to reflect free quantity
        const freeQtd = totalQtd - somaAtribuidas;
        setNovaSubQtd(freeQtd > 0 ? freeQtd : '');
      }
    }
  };

  // Robust helper to update a demand, storing co_realizadores within the timeline
  const updateDemandWithCoRealizadores = async (
    demId: string,
    payload: any,
    coRealizadoresList: string[]
  ) => {
    // We store co_realizadores strictly inside the historico_timeline JSON array
    // so we don't attempt to write to a non-existent table column.
    const { error } = await supabase
      .from('oficina_eletrica')
      .update(payload)
      .eq('id', demId);

    return error;
  };

  // Handle direct agreement
  const handleConfirmDirectAccept = async (dem: OficinaEletricaDemanda) => {
    const execName = executorNameInput.trim();
    if (!execName) {
      showToast("Por favor, selecione o Eletricista!", "error");
      return;
    }

    const helpersText = coRealizadores.length > 0 ? ` [Equipe de Apoio: ${coRealizadores.join(', ')}]` : '';
    const updatedTimeline = [
      ...dem.historico_timeline,
      {
        timestamp: new Date().toISOString(),
        user: execName,
        action: 'Início de Atividade',
        details: `Atividade iniciada. Prazo aceito pelo executor.${helpersText}`,
        data: new Date().toISOString(),
        evento: 'Atividade iniciada. Prazo aceito pelo executor.',
        co_realizadores: coRealizadores // Store in timeline for backup parsing
      }
    ];

    const payload = {
      status: 'Em andamento',
      executor_nome: execName,
      historico_timeline: updatedTimeline
    };

    const error = await updateDemandWithCoRealizadores(dem.id, payload, coRealizadores);

    if (error) {
      console.error('Erro ao iniciar atividade:', error);
      showToast(`Erro ao registrar início de atividade: ${error.message} (${error.code})`, 'error');
    } else {
      showToast(`Atividade iniciada por ${execName}!`, "success");
      setActiveAcceptModal(null);
      fetchDemandas();
    }
  };

  // Handle suggest new date on acceptance
  const handleSaveSuggestNewDate = async (dem: OficinaEletricaDemanda) => {
    const execName = executorNameInput.trim();
    if (!execName) {
      showToast("Por favor, selecione o Eletricista!", "error");
      return;
    }
    if (!suggestedDate) {
      showToast("Insira a nova data sugerida!", "error");
      return;
    }
    if (!suggestedJustification.trim()) {
      showToast("A justificativa é obrigatória para sugerir um novo prazo!", "error");
      return;
    }

    const helpersText = coRealizadores.length > 0 ? ` [Equipe de Apoio: ${coRealizadores.join(', ')}]` : '';
    const updatedTimeline = [
      ...dem.historico_timeline,
      {
        timestamp: new Date().toISOString(),
        user: execName,
        action: 'Alteração de Prazo (Aceite)',
        details: `Prazo alterado para ${suggestedDate}. Motivo: ${suggestedJustification.trim()}.${helpersText}`,
        data: new Date().toISOString(),
        evento: `Prazo alterado para ${suggestedDate}. Motivo: ${suggestedJustification.trim()}`,
        co_realizadores: coRealizadores // Store in timeline for backup parsing
      }
    ];

    const payload = {
      status: 'Em andamento',
      executor_nome: execName,
      prazo_atual: suggestedDate,
      historico_timeline: updatedTimeline
    };

    const error = await updateDemandWithCoRealizadores(dem.id, payload, coRealizadores);

    if (error) {
      console.error('Erro ao repactuar prazo:', error);
      showToast(`Erro ao atualizar repactuação de prazo: ${error.message} (${error.code})`, 'error');
    } else {
      showToast(`Atividade iniciada com repactuação de prazo!`, "success");
      setActiveAcceptModal(null);
      fetchDemandas();
    }
  };

  // Handle Concluir Serviço for active demands
  const handleCompleteService = async (dem: OficinaEletricaDemanda) => {
    const execName = executorNameInput.trim() || dem.executor_nome || 'Executor';
    if (!execName) {
      showToast("Preencha o seu nome de Executor!", "error");
      return;
    }

    const updatedTimeline = [
      ...dem.historico_timeline,
      {
        timestamp: new Date().toISOString(),
        user: execName,
        action: 'Atividade Concluída',
        details: 'Serviço concluído com sucesso.',
        data: new Date().toISOString(),
        evento: 'Serviço concluído com sucesso.'
      }
    ];

    const { error } = await supabase
      .from('oficina_eletrica')
      .update({
        status: 'CONCLUÍDO',
        historico_timeline: updatedTimeline
      })
      .eq('id', dem.id);

    if (error) {
      console.error('Erro ao concluir:', error);
      showToast(`Erro ao concluir demanda: ${error.message} (${error.code})`, 'error');
    } else {
      showToast("Serviço concluído com sucesso!", "success");
      fetchDemandas();
    }
  };

  // Handle Reprogramar / Justificar Atraso for active demands
  const handleSaveReprogram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReprogramModal) return;
    if (!reprogramDate) {
      showToast("Defina uma nova data de previsão!", "error");
      return;
    }
    if (!reprogramJustification.trim()) {
      showToast("A justificativa é obrigatória!", "error");
      return;
    }

    const execName = executorNameInput.trim() || activeReprogramModal.executor_nome || 'Executor';
    const updatedTimeline = [
      ...activeReprogramModal.historico_timeline,
      {
        timestamp: new Date().toISOString(),
        user: execName,
        action: 'Reprogramação de Atividade',
        details: `Prazo reprogramado para ${reprogramDate}. Motivo: ${reprogramJustification.trim()}`,
        data: new Date().toISOString(),
        evento: `Prazo reprogramado para ${reprogramDate}. Motivo: ${reprogramJustification.trim()}`
      }
    ];

    const { error } = await supabase
      .from('oficina_eletrica')
      .update({
        prazo_atual: reprogramDate,
        historico_timeline: updatedTimeline
      })
      .eq('id', activeReprogramModal.id);

    if (error) {
      console.error('Erro ao reprogramar:', error);
      showToast(`Erro ao salvar reprogramação: ${error.message} (${error.code})`, 'error');
    } else {
      showToast("Prazo reprogramado com sucesso!", "success");
      setActiveReprogramModal(null);
      setReprogramDate('');
      setReprogramJustification('');
      fetchDemandas();
    }
  };

  // Resolve delay modal
  const handleSaveDelayJustification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayNewDate) {
      showToast("Defina uma nova data de previsão!", "error");
      return;
    }
    if (!delayJustification.trim()) {
      showToast("A justificativa de atraso é obrigatória!", "error");
      return;
    }
    if (delayNewDate <= todayStr) {
      showToast("A nova data de previsão deve ser futura (maior que hoje)!", "error");
      return;
    }

    if (!delayedTargetAction) return;

    const execName = executorNameInput.trim() || 'Executor';
    const { type, record } = delayedTargetAction;

    const oldPrazo = record.prazo_atual;
    const isStart = type === 'start';

    const updatedTimeline = [
      ...record.historico_timeline,
      {
        timestamp: new Date().toISOString(),
        user: execName,
        action: 'Justificativa de Atraso',
        details: `Atraso registrado! Prazo antigo: ${oldPrazo} -> Novo Prazo repactuado: ${delayNewDate}. Justificativa: ${delayJustification.trim()}`
      }
    ];

    const updatePayload: any = {
      prazo_atual: delayNewDate,
      historico_timeline: updatedTimeline
    };

    if (isStart) {
      updatePayload.status = 'Em andamento';
      updatePayload.executor_nome = execName;
    } else if (type === 'complete') {
      updatePayload.status = 'CONCLUÍDO';
    }

    const { error } = await supabase
      .from('oficina_eletrica')
      .update(updatePayload)
      .eq('id', record.id);

    if (error) {
      console.error('Erro ao salvar atraso:', error);
      showToast(`Erro ao salvar justificativa de atraso: ${error.message} (${error.code})`, 'error');
    } else {
      showToast("Justificativa de atraso salva e novo prazo atualizado!", "success");
      setActiveDelayModal(null);
      setDelayedTargetAction(null);
      fetchDemandas();
    }
  };

  // Handle finalize activity
  const handleTriggerCompleteActivity = async (dem: OficinaEletricaDemanda) => {
    const execName = executorNameInput.trim() || dem.executor_nome || 'Executor';

    // Check if delayed before letting them complete
    if (isExpired(dem.prazo_atual)) {
      setDelayedTargetAction({ type: 'complete', record: dem });
      setDelayNewDate(dem.prazo_atual);
      setDelayJustification('');
      setActiveDelayModal(dem);
      return;
    }

    const updatedTimeline = [
      ...dem.historico_timeline,
      {
        timestamp: new Date().toISOString(),
        user: execName,
        action: 'Atividade Concluída',
        details: `Atividade finalizada e entregue com sucesso.`
      }
    ];

    const { error } = await supabase
      .from('oficina_eletrica')
      .update({
        status: 'CONCLUÍDO',
        historico_timeline: updatedTimeline
      })
      .eq('id', dem.id);

    if (error) {
      console.error('Erro ao concluir:', error);
      showToast(`Erro ao concluir demanda: ${error.message} (${error.code})`, 'error');
    } else {
      showToast("Parabéns! Atividade marcada como concluída.", "success");
      fetchDemandas();
    }
  };

  // Excel Export Simulation with UTF-8 BOM encoding for correct accents in Microsoft Excel
  const handleExportToExcelSim = () => {
    let csvContent = "ID;Tipo Demanda;Categoria;Descricao detalhada;Quantidade;Prazo Original;Prazo Atual;Status;Executor;Timeline Completa\n";
    
    demandas.forEach(d => {
      const timelineStr = d.historico_timeline.map(t => `[${t.timestamp.substring(0, 10)}] ${t.user}: ${t.action} - ${t.details || ''}`).join(' | ');
      const categoryLabel = d.categoria_atividade === 'MANUTENÇÃO' && d.tipo_manutencao
        ? `MANUTENÇÃO (${d.tipo_manutencao})`
        : (d.categoria_atividade || 'SERVIÇO');

      const row = [
        d.id,
        d.tipo_demanda,
        categoryLabel,
        `"${d.descricao.replace(/"/g, '""')}"`,
        d.quantidade,
        d.prazo_original,
        d.prazo_atual,
        d.status,
        d.executor_nome || 'N/A',
        `"${timelineStr.replace(/"/g, '""')}"`
      ].join(';');
      csvContent += row + "\n";
    });

    // Add Byte Order Mark (BOM) for Excel UTF-8 compliance
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `oficina_eletrica_relatorio_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast("Relatório gerado em formato CSV estruturado para Excel!", "success");
  };

  // 3. STATS/KPIS FOR THE TOP BAR
  const kpiStats = useMemo(() => {
    let totalSemAtendimento = 0;
    let totalEmAndamento = 0;
    let totalExecutado = 0;

    demandas.forEach(d => {
      const s = d.status ? d.status.trim().toUpperCase() : '';
      if (s === 'RASCUNHO') {
        return; // Ignore drafts
      }
      if (
        s === 'EM ANDAMENTO' || 
        s === 'PARCIALMENTE ATRIBUÍDO' || 
        s === 'TOTALMENTE ATRIBUÍDO' ||
        s === 'PARCIALMENTE DISTRIBUÍDO' || 
        s === 'TOTALMENTE DISTRIBUÍDO'
      ) {
        totalEmAndamento++;
      } else if (s === 'EXECUTADO' || s === 'CONCLUÍDO') {
        totalExecutado++;
      } else if (s === 'CANCELADO') {
        // Do not count cancelled in Sem Atendimento/Em Andamento/Executado
      } else {
        totalSemAtendimento++;
      }
    });

    return {
      semAtendimento: totalSemAtendimento,
      emAndamento: totalEmAndamento,
      executado: totalExecutado
    };
  }, [demandas]);

  return (
    <>
      <style type="text/css">
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-laudo, #printable-laudo * {
              visibility: visible !important;
            }
            #printable-laudo {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 20px !important;
              box-shadow: none !important;
            }
          }
        `}
      </style>

      {/* Printable Area - visible only when printing */}
      {printChecklist ? (() => {
        const parsedPrint = parseNewFields(printChecklist);
        return (
          <div id="printable-laudo" className="hidden bg-white text-black p-8 font-sans w-full max-w-4xl mx-auto border border-slate-300 rounded-lg">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block leading-none">LAUDO TÉCNICO DE INSPEÇÃO</span>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 uppercase">
                  Oficina Elétrica & Manutenção
                </h1>
              </div>
              <div className="text-right text-[10px] font-mono text-slate-500 uppercase">
                <div>SINC REALTIME ATIVO</div>
                <div>Data: {printChecklist?.created_at ? new Date(printChecklist.created_at).toLocaleString('pt-BR') : 'Data não informada'}</div>
              </div>
            </div>

            {/* Details Section */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-500">TAG do Equipamento</span>
                <strong className="text-sm text-slate-900 font-bold">{printChecklist?.tag_equipamento || 'S/T (Sem Tag)'}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-500">Fornecedor</span>
                <strong className="text-sm text-slate-900 font-bold">{printChecklist?.fornecedor || 'Não Especificado'}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-500">Quantidade / Unidade</span>
                <strong className="text-sm text-slate-900 font-bold">{printChecklist?.quantidade ?? 0} {printChecklist?.unidade_medida || 'UN'}</strong>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="block text-[9px] font-black uppercase text-slate-500">Descrição do Item</span>
                <strong className="text-sm text-slate-900 font-bold">{printChecklist?.descricao_item || 'Não Especificada'}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-500">Motivo da Inspeção</span>
                <strong className="text-sm text-slate-900 font-bold uppercase">{parsedPrint.motivo_inspecao || 'MOBILIZAÇÃO'}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-500">Tensão do Equipamento</span>
                <strong className="text-sm text-slate-900 font-bold uppercase">{parsedPrint.tensao_equipamento || 'Não informada'}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-500">Eletricista Responsável</span>
                <strong className="text-sm text-slate-900 font-bold">{printChecklist?.eletricista_responsavel || 'Técnico não informado'}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-black uppercase text-slate-500">Centro de Custo / Obra</span>
                <strong className="text-sm text-slate-900 font-bold uppercase">{parsedPrint.centro_de_custo || 'Não informado'}</strong>
              </div>
            </div>

            {/* Questions Grid */}
            <div className="space-y-6">
              {/* Section 1 */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                  Seção 1: Inspeção Visual e Física
                </h3>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                      <th className="py-1.5 font-black">Item de Inspeção</th>
                      <th className="py-1.5 font-black text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2">Cabo de Alimentação</td>
                      <td className={`py-2 text-right font-bold ${printChecklist?.cabo_alimentacao === 'Conforme' ? 'text-emerald-700' : 'text-rose-700'}`}>{printChecklist?.cabo_alimentacao || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Plugues e Conectores</td>
                      <td className={`py-2 text-right font-bold ${printChecklist?.plugue_conectores === 'Conforme' ? 'text-emerald-700' : 'text-rose-700'}`}>{printChecklist?.plugue_conectores || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Carcaça e Estrutura Física</td>
                      <td className={`py-2 text-right font-bold ${printChecklist?.carcaca_estrutura === 'Conforme' ? 'text-emerald-700' : 'text-rose-700'}`}>{printChecklist?.carcaca_estrutura || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Extintor</td>
                      <td className={`py-2 text-right font-bold ${parsedPrint.extintor === 'Conforme' ? 'text-emerald-700' : 'text-rose-700'}`}>{parsedPrint.extintor || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Bateria</td>
                      <td className={`py-2 text-right font-bold ${parsedPrint.bateria === 'Conforme' ? 'text-emerald-700' : 'text-rose-700'}`}>{parsedPrint.bateria || 'N/A'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            {/* Section 2 */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Seção 2: Testes Elétricos e Segurança
              </h3>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                    <th className="py-1.5 font-black">Item de Inspeção</th>
                    <th className="py-1.5 font-black text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2">Comandos de Emergência</td>
                    <td className={`py-2 text-right font-bold ${printChecklist?.comandos_emergencia === 'Conforme' ? 'text-emerald-700' : 'text-rose-700'}`}>{printChecklist?.comandos_emergencia || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Painel Digital e Indicadores/LEDs</td>
                    <td className={`py-2 text-right font-bold ${printChecklist?.painel_digital === 'Conforme' ? 'text-emerald-700' : 'text-rose-700'}`}>{printChecklist?.painel_digital || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Continuidade do Aterramento</td>
                    <td className={`py-2 text-right font-bold ${printChecklist?.continuidade_aterramento === 'Conforme' ? 'text-emerald-700' : 'text-rose-700'}`}>{printChecklist?.continuidade_aterramento || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td className="py-2">Resistência de Aquecimento</td>
                    <td className={`py-2 text-right font-bold ${printChecklist?.resistencia_aquecimento === 'Conforme' ? 'text-emerald-700' : 'text-rose-700'}`}>{printChecklist?.resistencia_aquecimento || 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2">
                Seção 3: Parecer Técnico Final
              </h3>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-slate-600 font-medium">Status de Liberação do Ativo:</span>
                <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase border ${
                  printChecklist?.status_liberacao === 'LIBERADO PARA OPERAÇÃO'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : printChecklist?.status_liberacao === 'LIBERADO COM RESTRIÇÃO'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {printChecklist?.status_liberacao || 'NÃO AVALIADO'}
                </span>
              </div>
              {(() => {
                const { texto, fotos } = formatarObservacoes(printChecklist?.observacoes_tecnicas);
                if (!texto && fotos.length === 0) return null;
                return (
                  <div className="border-t border-slate-200 pt-2 text-[10px] space-y-2">
                    {texto && (
                      <div className="text-xs text-slate-700 italic">
                        <strong>Observações Técnicas / Defeitos Constatados:</strong> "{texto}"
                      </div>
                    )}
                    {fotos.length > 0 && (
                      <div className="pt-1">
                        <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Evidências Anexadas:</span>
                        <div className="flex flex-wrap gap-2 print:flex print:flex-wrap print:gap-2 print:mt-2 break-inside-avoid">
                          {fotos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" className="block cursor-pointer">
                              <img src={url} alt={`Evidência ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-slate-300 shadow-xs" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Evidências Fotográficas - Relatório Impresso */}
            {(() => {
              const printPhotos = getChecklistPhotos(printChecklist);
              if (!printPhotos || printPhotos.length === 0) return null;
              return (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4 break-inside-avoid print:break-inside-avoid">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-3 flex items-center justify-between">
                    <span>EVIDÊNCIAS FOTOGRÁFICAS</span>
                    <span className="text-[10px] font-normal text-slate-500 font-mono">({printPhotos.length} anexo{printPhotos.length > 1 ? 's' : ''})</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {printPhotos.map((photoUrl: string, idx: number) => (
                      <div key={idx} className="border border-slate-300 rounded-lg overflow-hidden bg-white p-1.5 text-center shadow-xs break-inside-avoid print:break-inside-avoid">
                        <img 
                          src={photoUrl} 
                          alt={`Evidência Fotográfica ${idx + 1}`} 
                          className="w-full max-h-56 object-contain rounded-md mx-auto"
                        />
                        <span className="block text-[9px] font-mono text-slate-600 mt-1 uppercase font-bold">
                          Evidência #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Signature Block */}
          <div className="mt-20 text-center max-w-xs mx-auto">
            <div className="border-b border-slate-900 mb-2"></div>
            <span className="text-xs font-bold block text-slate-900 uppercase">
              Assinatura do Técnico Responsável: {printChecklist?.eletricista_responsavel || 'Técnico não informado'}
            </span>
          </div>
        </div>
        );
      })() : null}

      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative border border-slate-100 shadow-sm print:hidden" id="oficina-eletrica-wrapper">
      
      {/* Dynamic Toast Element */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-4 right-4 z-[100] px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-black uppercase tracking-wider border ${
              toast.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : toast.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
            {toast.type === 'info' && <Clock className="w-5 h-5 text-indigo-600" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER BAR */}
      <div className="bg-white border-b border-slate-200/80 py-4 px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Back button and title */}
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <button
              onClick={onBackToHub}
              className="flex items-center space-x-1 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition duration-150 cursor-pointer border border-slate-200/80"
              id="oficina-back-btn"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>HUB</span>
            </button>
            <div className="border-l border-slate-200 pl-4 flex items-center gap-2.5">
              <div className="bg-amber-500/10 text-amber-600 border border-amber-500/20 p-2.5 rounded-xl">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-amber-600 block leading-none">Gestão de Ativos</span>
                <h1 className="text-sm font-black tracking-tight text-slate-900 mt-0.5 uppercase">
                  Oficina Elétrica & Manutenção
                </h1>
              </div>
            </div>
          </div>

          {/* Quick interactive parameters */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={handleExportToExcelSim}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden md:block" />
            <div className="bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600">
              SINC REALTIME: <span className="text-emerald-600 font-bold animate-pulse">● ATIVO</span>
            </div>
          </div>

        </div>
      </div>

      {/* CORE NAVIGATION TABS */}
      <div className="bg-white border-b border-slate-200 px-6 py-2">
        <div className="max-w-7xl mx-auto flex space-x-1">
          {session?.perfil !== 'ELETRICISTA' && (
            <>
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'admin' 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Wrench className="w-4 h-4" />
                <span>1. Planejamento (Admin)</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px]">
                  {demandas.filter(d => (d.status ? d.status.trim().toUpperCase() : '') === 'RASCUNHO').length}
                </span>
              </button>
              
              <button
                onClick={() => setActiveTab('gestao')}
                className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'gestao' 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>2. Gestão / Acompanhamento</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px]">
                  {demandas.filter(d => (d.status ? d.status.trim().toUpperCase() : '') !== 'RASCUNHO').length}
                </span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('executor')}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'executor' 
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <User className="w-4 h-4" />
            <span>3. Visão do Executor (Eletricista)</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px]">
              {executorQueue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'checklist' 
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            id="tab-checklist"
          >
            <ClipboardList className="w-4 h-4" />
            <span>4. Checklist Digital</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px]">
              {checklistsSalvos.length}
            </span>
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6">
        
        {/* ========================================== */}
        {/* ABA 1: ADMIN (PLANEJAMENTO E AVULSAS CRIAÇÃO) */}
        {/* ========================================== */}
        {activeTab === 'admin' && session?.perfil !== 'ELETRICISTA' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            
            {/* Left Column: Uni Form Creation */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl h-fit">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                <Plus className="w-5 h-5 text-amber-500" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  {editingId ? 'Editar Demanda' : 'Cadastrar Nova Demanda'}
                </h2>
              </div>

              <form onSubmit={handleSaveDemanda} className="space-y-4">
                {/* Tipo de Demanda */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Tipo de Demanda</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoDemanda('Semanal')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase transition-all border ${
                        tipoDemanda === 'Semanal' 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500' 
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      📅 Semanal
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoDemanda('Avulsa')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase transition-all border ${
                        tipoDemanda === 'Avulsa' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500' 
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      🚨 Avulsa (Emergencial)
                    </button>
                  </div>
                </div>

                {/* Categoria da Atividade (Radio Group style) */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Categoria da Atividade</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['SERVIÇO', 'FABRICAÇÃO', 'MANUTENÇÃO'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoriaAtividade(cat)}
                        className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase transition-all border text-center ${
                          categoriaAtividade === cat
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {categoriaAtividade === 'MANUTENÇÃO' && (
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
                      Tipo de Manutenção <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Preventiva', 'Corretiva', 'Adaptação'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setTipoManutencao(opt)}
                          className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase transition-all border text-center ${
                            tipoManutencao === opt
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nome do Item / Equipamento (Título da OS) */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">
                    Nome do Item / Equipamento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nomeItem}
                    onChange={(e) => setNomeItem(e.target.value)}
                    placeholder="Ex: Gerador 50kVA, Bomba Submersa, Extensão Elétrica..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition duration-150"
                  />
                </div>

                {/* Descrição Detalhada (Textarea) */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Descrição Detalhada do Serviço (Escopo da Atividade)</label>
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Descreva o escopo técnico do que será executado neste item (ex: rebobinar bobina, substituir rolamento, reinstalar fiação...)."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition duration-150"
                  />
                </div>

                {/* Quantidade & Prazo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Quantidade (Ativos)</label>
                    <input
                      type="number"
                      value={quantidade}
                      onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                      min={1}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Prazo Estimado</label>
                    <input
                      type="date"
                      value={prazo}
                      onChange={(e) => setPrazo(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 transition duration-150"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setNomeItem('');
                        setDescricao('');
                        setQuantidade(1);
                        setPrazo(todayStr);
                        setCategoriaAtividade('SERVIÇO');
                        setTipoDemanda('Semanal');
                      }}
                      className="flex-1 py-2.5 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-[2] py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingId ? 'Salvar Edição' : 'Salvar no Rascunho'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Pre-acompanhamento Rascunho Table */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-amber-500" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Pré-Acompanhamento (Rascunho / Validação)
                  </h2>
                </div>
                <span className="bg-slate-950 border border-slate-850 px-2.5 py-1 rounded-xl text-[10px] font-mono text-slate-400 uppercase font-black">
                  Controle Interno
                </span>
              </div>

              {isLoading ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  <Clock className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-3" />
                  <span className="uppercase font-black tracking-wider block">Carregando demandas da nuvem...</span>
                </div>
              ) : demandas.filter(d => (d.status ? d.status.trim().toUpperCase() : '') === 'RASCUNHO').length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  <Wrench className="w-12 h-12 text-slate-800 mx-auto mb-3 animate-pulse" />
                  <span className="uppercase font-black tracking-wider block">Nenhum rascunho de demanda cadastrado.</span>
                  <p className="text-[10px] text-slate-600 mt-1 uppercase">Preencha o formulário ao lado para iniciar o planejamento.</p>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[520px] overflow-y-auto pr-1">
                  {demandas.filter(d => (d.status ? d.status.trim().toUpperCase() : '') === 'RASCUNHO').map((dem) => (
                    <div 
                      key={dem.id}
                      className="bg-slate-950 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-750 transition duration-150"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1 w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                              dem.tipo_demanda === 'Avulsa' 
                                ? 'bg-rose-950 text-rose-400 border-rose-800/40' 
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}>
                              {dem.tipo_demanda}
                            </span>
                            <span className="bg-slate-900 text-amber-400 text-[8px] px-1.5 py-0.5 rounded font-black border border-amber-500/20 uppercase">
                              {dem.categoria_atividade || 'SERVIÇO'}{dem.categoria_atividade === 'MANUTENÇÃO' && dem.tipo_manutencao ? ` (${dem.tipo_manutencao})` : ''}
                            </span>
                          </div>
                          
                          {dem.nome_item && (
                            <h4 className="text-xs font-black uppercase text-amber-500 mt-1.5 tracking-wider">
                              📦 {dem.nome_item}
                            </h4>
                          )}
                          <p className="text-xs font-bold text-slate-200 mt-1 whitespace-pre-wrap">{dem.descricao}</p>
                          
                          <div className="text-[10px] text-slate-450 font-mono flex flex-wrap gap-x-4 pt-1 border-t border-slate-900 mt-2">
                            <span>QUANTIDADE: <strong className="text-slate-300">{dem.quantidade}</strong></span>
                            <span>PRAZO DE ENTREGA: <strong className="text-slate-300">{formatDateToBR(dem.prazo_atual)}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(dem)}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-amber-500 rounded-lg border border-slate-800 transition cursor-pointer"
                            title="Editar Rascunho"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDemanda(dem.id, dem.descricao)}
                            className="p-1.5 bg-slate-900 hover:bg-rose-950/40 text-rose-500 rounded-lg border border-slate-800 transition cursor-pointer"
                            title="Excluir Rascunho"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-900 flex justify-between items-center">
                        <span className="text-[9px] font-mono text-slate-500 uppercase">Status: Rascunho</span>
                        <button
                          onClick={() => handleLiberarDemanda(dem.id)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Liberar para Oficina</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================== */}
        {/* ABA 2: GESTÃO (KANBAN BOARD & TIMELINE) */}
        {/* ========================================== */}
        {activeTab === 'gestao' && session?.perfil !== 'ELETRICISTA' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* INDICADORES DE TOPO (KPI CARDS) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="oficina-kpi-topo">
              {/* Card 1: Sem Atendimento */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Fila de Espera</span>
                  <h3 className="text-sm font-bold text-slate-800">Sem Atendimento</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-slate-800 font-mono">{kpiStats.semAtendimento}</span>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-500">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Card 2: Em Andamento */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block">Manutenções Ativas</span>
                  <h3 className="text-sm font-bold text-slate-800">Em Andamento</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-slate-800 font-mono">{kpiStats.emAndamento}</span>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-600">
                    <Hammer className="w-5 h-5 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Card 3: Executados */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block">OS Concluídas</span>
                  <h3 className="text-sm font-bold text-slate-800">Executado</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-slate-800 font-mono">{kpiStats.executado}</span>
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-emerald-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar demanda por serviço, categoria ou executor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500 uppercase">
                <span>Total Liberado: <strong>{nonDraftDemandas.length}</strong></span>
                <span>•</span>
                <span>Filtrados: <strong>{filteredKanbanDemandas.length}</strong></span>
              </div>
            </div>

            {/* Kanban Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Column 1: Sem atendimento */}
              <div className="bg-slate-50 rounded-3xl border border-slate-200 p-4 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Sem Atendimento</h3>
                  </div>
                  <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono">
                    {kanbanColumns['Sem atendimento'].length}
                  </span>
                </div>

                <div className="space-y-3 flex-grow overflow-y-auto max-h-[600px] scrollbar-none">
                  {isLoading ? (
                    <div className="py-12 text-center text-[10px] text-slate-400 font-mono uppercase">Carregando...</div>
                  ) : kanbanColumns['Sem atendimento'].length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-slate-500 font-black uppercase">
                      Nenhuma demanda na fila
                    </div>
                  ) : (
                    kanbanColumns['Sem atendimento'].map(dem => (
                      <div
                        key={dem.id}
                        onClick={() => setSelectedTimelineDemanda(dem)}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-blue-400 hover:shadow transition duration-150 cursor-pointer space-y-3 relative group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {dem.tipo_demanda === 'Avulsa' && (
                              <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-rose-200">
                                🔴 AVULSA
                              </span>
                            )}
                            <span className="bg-blue-50 text-blue-600 text-[8px] px-1.5 py-0.5 rounded border border-blue-100 uppercase font-black">
                              {dem.categoria_atividade || 'SERVIÇO'}{dem.categoria_atividade === 'MANUTENÇÃO' && dem.tipo_manutencao ? ` (${dem.tipo_manutencao})` : ''}
                            </span>
                          </div>
                          {dem.nome_item && (
                            <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
                              📦 {dem.nome_item}
                            </h4>
                          )}
                          <p className="text-[11px] font-black text-slate-800 group-hover:text-blue-600 transition whitespace-pre-wrap line-clamp-3">
                            {dem.descricao}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-1">
                            PRAZO: <span className="text-slate-700 font-bold">{formatDateToBR(dem.prazo_atual)}</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[9px] font-mono text-slate-500">
                          <span>Qtd: {dem.quantidade}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelDemanda(dem.id);
                            }}
                            className="text-rose-600 hover:text-rose-500 font-black uppercase tracking-wider cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: Em andamento */}
              <div className="bg-slate-50 rounded-3xl border border-slate-200 p-4 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Em Andamento</h3>
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono">
                    {kanbanColumns['Em andamento'].length}
                  </span>
                </div>

                <div className="space-y-3 flex-grow overflow-y-auto max-h-[600px] scrollbar-none">
                  {kanbanColumns['Em andamento'].length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-slate-500 font-black uppercase">
                      Sem atividades ativas
                    </div>
                  ) : (
                    kanbanColumns['Em andamento'].map(dem => {
                      const expired = isExpired(dem.prazo_atual);
                      const daysActive = getDaysInProgress(dem);
                      return (
                        <div
                          key={dem.id}
                          onClick={() => setSelectedTimelineDemanda(dem)}
                          className={`rounded-2xl p-4 shadow-sm transition duration-150 cursor-pointer space-y-3 relative group border ${
                            expired 
                              ? 'bg-rose-50 border-rose-200 hover:border-rose-400' 
                              : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {dem.tipo_demanda === 'Avulsa' && (
                                <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-rose-200">
                                  🔴 AVULSA
                                </span>
                              )}
                              {expired && (
                                <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-rose-200 uppercase tracking-widest animate-pulse">
                                  ⚠️ ATRASADO
                                </span>
                              )}
                              <span className="bg-blue-50 text-blue-600 text-[8px] px-1.5 py-0.5 rounded border border-blue-100 uppercase font-black">
                                {dem.categoria_atividade || 'SERVIÇO'}{dem.categoria_atividade === 'MANUTENÇÃO' && dem.tipo_manutencao ? ` (${dem.tipo_manutencao})` : ''}
                              </span>
                            </div>
                            {dem.nome_item && (
                              <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-wider">
                                📦 {dem.nome_item}
                              </h4>
                            )}
                            <p className="text-[11px] font-black text-slate-800 group-hover:text-blue-600 transition whitespace-pre-wrap line-clamp-3">
                              {dem.descricao}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              PRAZO: <span className={`${expired ? 'text-rose-600 font-black' : 'text-slate-700'}`}>{formatDateToBR(dem.prazo_atual)}</span>
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>Exec: <strong className="text-slate-700 uppercase">{dem.executor_nome}</strong></span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[9px] font-mono text-slate-500">
                            <span className="bg-amber-50 px-1.5 py-0.5 rounded text-amber-750 font-bold border border-amber-100">
                              ⌛ {daysActive}d em andamento
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelDemanda(dem.id);
                              }}
                              className="text-rose-600 hover:text-rose-500 font-black uppercase tracking-wider cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Column 3: Executado */}
              <div className="bg-slate-50 rounded-3xl border border-slate-200 p-4 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Executado</h3>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono">
                    {kanbanColumns['Executado'].length}
                  </span>
                </div>

                <div className="space-y-3 flex-grow overflow-y-auto max-h-[600px] scrollbar-none">
                  {kanbanColumns['Executado'].length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-slate-500 font-black uppercase">
                      Sem tarefas executadas
                    </div>
                  ) : (
                    kanbanColumns['Executado'].map(dem => {
                      const completedDate = getCompletedAtDate(dem);
                      return (
                        <div
                          key={dem.id}
                          onClick={() => setSelectedTimelineDemanda(dem)}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-400 transition duration-150 cursor-pointer space-y-3 relative group opacity-90 hover:opacity-100"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {dem.tipo_demanda === 'Avulsa' && (
                                <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-rose-200">
                                  🔴 AVULSA
                                </span>
                              )}
                              <span className="bg-emerald-50 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded border border-emerald-200 uppercase font-black">
                                {dem.categoria_atividade || 'SERVIÇO'}{dem.categoria_atividade === 'MANUTENÇÃO' && dem.tipo_manutencao ? ` (${dem.tipo_manutencao})` : ''}
                              </span>
                            </div>
                            {dem.nome_item && (
                              <h4 className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
                                📦 {dem.nome_item}
                              </h4>
                            )}
                            <p className="text-[11px] font-bold text-slate-500 group-hover:text-emerald-600 transition line-through decoration-slate-200 whitespace-pre-wrap line-clamp-2">
                              {dem.descricao}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              CONCLUÍDO EM: <span className="text-slate-600">{formatDateToBR(completedDate)}</span>
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              POR: <span className="text-slate-700 font-bold uppercase">{dem.executor_nome}</span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[9px] font-mono text-emerald-600">
                            <span className="flex items-center gap-1 font-black">
                              <CheckCircle className="w-3.5 h-3.5" />
                              CONCLUÍDO
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Column 4: Cancelado */}
              <div className="bg-slate-50 rounded-3xl border border-slate-200 p-4 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Cancelado</h3>
                  </div>
                  <span className="bg-rose-100 text-rose-750 text-[10px] px-2 py-0.5 rounded-full font-bold font-mono">
                    {kanbanColumns['Cancelado'].length}
                  </span>
                </div>

                <div className="space-y-3 flex-grow overflow-y-auto max-h-[600px] scrollbar-none">
                  {kanbanColumns['Cancelado'].length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-slate-500 font-black uppercase">
                      Nenhum cancelamento
                    </div>
                  ) : (
                    kanbanColumns['Cancelado'].map(dem => (
                      <div
                        key={dem.id}
                        onClick={() => setSelectedTimelineDemanda(dem)}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-rose-450 transition duration-150 cursor-pointer space-y-3 relative group opacity-80 hover:opacity-100"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {dem.tipo_demanda === 'Avulsa' && (
                              <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-rose-200">
                                🔴 AVULSA
                              </span>
                            )}
                            <span className="bg-rose-50 text-rose-600 text-[8px] px-1.5 py-0.5 rounded border border-rose-200 uppercase font-black">
                              {dem.categoria_atividade || 'SERVIÇO'}{dem.categoria_atividade === 'MANUTENÇÃO' && dem.tipo_manutencao ? ` (${dem.tipo_manutencao})` : ''}
                            </span>
                          </div>
                          {dem.nome_item && (
                            <h4 className="text-[10px] font-black uppercase text-rose-600 tracking-wider">
                              📦 {dem.nome_item}
                            </h4>
                          )}
                          <p className="text-[11px] font-bold text-slate-400 group-hover:text-rose-600 transition line-through decoration-slate-200 whitespace-pre-wrap line-clamp-2">
                            {dem.descricao}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            MOTIVO: <span className="text-rose-600 font-bold">{dem.justificativa_cancelamento?.substring(0, 30)}...</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[9px] font-mono text-rose-600">
                          <span className="flex items-center gap-1 font-bold">
                            <XCircle className="w-3.5 h-3.5" />
                            CANCELADO
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreDemanda(dem.id);
                            }}
                            className="bg-white hover:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[9px] font-black uppercase text-slate-600 hover:text-slate-800 cursor-pointer shadow-sm"
                          >
                            Reativar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================== */}
        {/* ABA 3: EXECUTOR (TELA MOBILE-FRIENDLY DO ELETRICISTA) */}
        {/* ========================================== */}
        {activeTab === 'executor' && (
          <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
            {/* List queue */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Fila Ativa de Atendimento</h3>
                <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300">
                  {executorQueue.length} Serviços
                </span>
              </div>

                  {executorQueue.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center text-slate-500 text-xs shadow-xl">
                      <CheckCircle className="w-10 h-10 text-emerald-500/80 mx-auto mb-3" />
                      <span className="uppercase font-black tracking-wider block">Nenhum serviço liberado para execução!</span>
                      <p className="text-[10px] text-slate-600 mt-1 uppercase">Todas as demandas da Oficina Elétrica estão concluídas ou em planejamento.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {executorQueue.map((dem) => {
                        const expired = isExpired(dem.prazo_atual);
                        const subs = parseSubAtribuicoes(dem);
                        const somaAtribuidas = subs.reduce((acc: number, s: any) => acc + s.quantidade, 0);
                        const saldoPendente = dem.quantidade - somaAtribuidas;
                        const isExpanded = expandedFractionsId === dem.id;
                        
                        return (
                          <div
                            key={dem.id}
                            onClick={() => {
                              setExpandedFractionsId(prev => prev === dem.id ? null : dem.id);
                            }}
                            className={`border rounded-3xl p-5 shadow-lg transition duration-150 flex flex-col justify-between cursor-pointer hover:border-amber-500/50 hover:shadow-xl ${
                              expired 
                                ? 'bg-[#1e1114] border-red-600 border-2' 
                                : dem.status === 'PARCIALMENTE DISTRIBUÍDO' || dem.status === 'PARCIALMENTE ATRIBUÍDO'
                                ? 'bg-[#0f172a] border-indigo-500/40'
                                : 'bg-[#0f172a] border-slate-800'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                    dem.tipo_demanda === 'Avulsa'
                                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                                      : 'bg-slate-950 text-slate-300 border-slate-850'
                                  }`}>
                                    {dem.tipo_demanda}
                                  </span>
                                  
                                  {dem.tipo_demanda === 'Avulsa' && (
                                    <span className="bg-red-950/90 text-red-300 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-850 animate-pulse">
                                      🔴 AVULSA
                                    </span>
                                  )}
                                  
                                  {expired && (
                                    <span className="bg-rose-950 text-rose-300 text-[8px] font-black px-1.5 py-0.5 rounded border border-rose-800 uppercase tracking-widest animate-pulse">
                                      ⚠️ ATRASADO
                                    </span>
                                  )}

                                  <span className="bg-slate-950 text-amber-400 text-[8px] px-1.5 py-0.5 rounded border border-amber-500/20 uppercase font-black">
                                    {dem.categoria_atividade || 'SERVIÇO'}{dem.categoria_atividade === 'MANUTENÇÃO' && dem.tipo_manutencao ? ` (${dem.tipo_manutencao})` : ''}
                                  </span>
                                </div>

                                <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                                  dem.status === 'PARCIALMENTE DISTRIBUÍDO' || dem.status === 'PARCIALMENTE ATRIBUÍDO'
                                    ? 'bg-indigo-950/90 text-indigo-300 border-indigo-800/40 animate-pulse'
                                    : 'bg-slate-950/80 text-slate-300 border-slate-850'
                                }`}>
                                  {dem.status}
                                </span>
                              </div>

                              {dem.nome_item && (
                                <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                                  📦 {dem.nome_item}
                                </h3>
                              )}
                              <h4 className="text-sm font-black text-white leading-snug whitespace-pre-wrap">{dem.descricao}</h4>
                              
                              <div className="text-[10px] text-slate-300 font-mono grid grid-cols-2 gap-y-1.5 pt-2 border-t border-slate-800 mt-3">
                                <span>QTD TOTAL: <strong className="text-white font-black">{dem.quantidade}</strong></span>
                                <span>CRIADO EM: <strong className="text-slate-200 font-bold">{formatDateToBR(dem.created_at)}</strong></span>
                                <span>PRAZO LIMITE: <strong className={`${expired ? 'text-rose-300 font-black underline' : 'text-slate-200 font-bold'}`}>{formatDateToBR(dem.prazo_atual)}</strong></span>
                                <span>SALDO RESTANTE: <strong className={`font-black ${saldoPendente > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>{saldoPendente} un</strong></span>
                              </div>

                              {subs.length > 0 && (
                                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1">
                                  <span className="block text-[9px] font-black uppercase text-slate-400">Atribuições Realizadas ({subs.length}):</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {subs.map((s: any) => (
                                      <span key={s.id} className="bg-slate-950 border border-slate-850 text-[9px] text-slate-200 px-2.5 py-1 rounded-xl flex items-center gap-1 font-mono">
                                        👤 {s.eletricista_responsavel} ({s.quantidade} un)
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Inner fractions list (Ver Equipes Atribuídas) */}
                            {isExpanded && (
                              <div className="mt-4 p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-3 animate-fade-in text-xs" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Frações Distribuídas</span>
                                  <span className="bg-slate-900 px-2 py-0.5 rounded font-mono font-bold text-amber-400 text-[10px]">
                                    {somaAtribuidas} / {dem.quantidade} Unidades
                                  </span>
                                </div>
                                {subs.length === 0 ? (
                                  <p className="text-[10px] text-slate-500 uppercase font-black text-center py-2">Nenhuma equipe atribuída ainda.</p>
                                ) : (
                                  <div className="space-y-2.5">
                                    {subs.map((sub: any) => (
                                      <div key={sub.id} className="bg-slate-900/60 p-3 rounded-xl border border-slate-850/60 space-y-1">
                                        <div className="flex justify-between items-center">
                                          <span className="text-white font-black uppercase text-[11px]">👤 {sub.eletricista_responsavel}</span>
                                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                                            {sub.quantidade} unidades
                                          </span>
                                        </div>
                                        {sub.co_realizadores && sub.co_realizadores.length > 0 && (
                                          <p className="text-[10px] text-slate-400 uppercase">
                                            Equipe Apoio: <strong className="text-slate-300">{sub.co_realizadores.join(', ')}</strong>
                                          </p>
                                        )}
                                        <div className="text-[10px] text-slate-300 pt-1.5 border-t border-slate-850/40">
                                          <span className="text-[8px] font-black uppercase text-slate-500 block">Papéis:</span>
                                          <p className="font-medium whitespace-pre-wrap mt-0.5">{sub.descricao_papeis}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Operational Flow Action Buttons */}
                            <div className="mt-5 pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTimelineDemanda(dem);
                                  }}
                                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 text-slate-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <Clock className="w-3 h-3 text-slate-300" />
                                  <span>Timeline</span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedFractionsId(prev => prev === dem.id ? null : dem.id);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer border ${
                                    saldoPendente === 0
                                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30 font-black shadow-md'
                                      : 'bg-slate-950 hover:bg-slate-800 border-slate-850 text-slate-300 hover:text-white'
                                  }`}
                                >
                                  <Users className="w-3 h-3 text-slate-300" />
                                  <span>Ver Equipes Atribuídas</span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenCancelarModal(dem);
                                  }}
                                  className="px-3 py-1.5 bg-transparent hover:bg-rose-950/20 border border-red-500 hover:border-red-400 text-red-500 hover:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Cancelar Demanda</span>
                                </button>
                              </div>

                              {saldoPendente > 0 ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAceiteDistribuicaoModal(dem);
                                  }}
                                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition shadow-lg cursor-pointer"
                                >
                                  <span>🛠️ DISTRIBUIR OS (FRACIONAR)</span>
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCompleteService(dem);
                                  }}
                                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition shadow-lg cursor-pointer"
                                >
                                  <Check className="w-4 h-4 text-white" />
                                  <span>Concluir Serviço</span>
                                </button>
                              )}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top summary header banner */}
            <div className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">
                    Operação e Bancada
                  </span>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Checklist Eletrônico Digital
                  </h2>
                </div>
                <p className="text-[11px] text-slate-600 uppercase font-semibold">
                  Selecione o ativo retornado e realize a inspeção física e testes elétricos de segurança antes de liberar o equipamento.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600">
                  ESTADO: <span className="text-emerald-600 font-bold animate-pulse">● CONECTADO</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* FORM COMPONENT */}
              <form onSubmit={handleSaveChecklist} className="lg:col-span-7 space-y-6 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm" id="checklist-digital-form">
                
                {/* Cabeçalho do formulário */}
                <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-amber-500" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Formulário de Entrada</h3>
                  </div>
                  <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-[9px] font-mono text-slate-500 font-bold uppercase">
                    Etapa Obrigatória
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* TAG do Equipamento (Opcional) */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                      TAG do Equipamento <span className="text-slate-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={chkTagEquipamento}
                      onChange={(e) => setChkTagEquipamento(e.target.value)}
                      placeholder="Ex: MAQ-104"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500 placeholder-slate-400"
                    />
                  </div>

                  {/* Fornecedor (Opcional) */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                      Fornecedor <span className="text-slate-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={chkFornecedor}
                      onChange={(e) => setChkFornecedor(e.target.value)}
                      placeholder="Ex: Bosch, DeWalt"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500 placeholder-slate-400"
                    />
                  </div>

                  {/* Descrição do Item (Obrigatório) */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                      Descrição do Item <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={chkDescricaoItem}
                      onChange={(e) => setChkDescricaoItem(e.target.value)}
                      required
                      placeholder="Ex: Furadeira de Impacto Industrial 1/2"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500 placeholder-slate-400"
                    />
                  </div>

                  {/* Quantidade (Obrigatório) */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                      Quantidade <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={chkQuantidade}
                      onChange={(e) => setChkQuantidade(e.target.value === '' ? '' : Number(e.target.value))}
                      required
                      min="1"
                      placeholder="Ex: 1"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500 placeholder-slate-400"
                    />
                  </div>

                  {/* Unidade de Medida (Obrigatório) */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                      Unidade de Medida <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={chkUnidadeMedida}
                      onChange={(e) => setChkUnidadeMedida(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="UN">UN (Unidade)</option>
                      <option value="PC">PC (Peça)</option>
                      <option value="KG">KG (Quilograma)</option>
                      <option value="M">M (Metro)</option>
                      <option value="CJ">CJ (Conjunto)</option>
                    </select>
                  </div>

                  {/* Eletricista Responsável */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                      Eletricista Responsável <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={eletricistaResponsavel}
                      onChange={(e) => setEletricistaResponsavel(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="">Selecione o Eletricista...</option>
                      {listaEletricistas.map((eletricista) => (
                        <option key={eletricista} value={eletricista}>
                          {eletricista}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Centro de Custo / Obra (Solicitante) */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                      CENTRO DE CUSTO / OBRA (SOLICITANTE)
                    </label>
                    <input
                      type="text"
                      value={chkCentroCusto}
                      onChange={(e) => setChkCentroCusto(e.target.value)}
                      placeholder="Ex: Manutenção Civil, Parada 01, Setor de Utilidades..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500 placeholder-slate-400"
                    />
                  </div>
                </div>

                {/* MOTIVO DA INSPEÇÃO E TENSÃO DO EQUIPAMENTO */}
                <div className="bg-slate-900 border border-slate-850 p-5 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <span className="text-sm">📋</span>
                    <h4 className="text-xs font-black uppercase tracking-widest text-white">Contexto de Movimentação e Tensão</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Motivo da Inspeção */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-wider">
                        Motivo da Inspeção <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="motivoInspecao"
                            value="MOBILIZAÇÃO"
                            checked={motivoInspecao === 'MOBILIZAÇÃO'}
                            onChange={() => setMotivoInspecao('MOBILIZAÇÃO')}
                            className="text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-800"
                          />
                          <span>MOBILIZAÇÃO</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="motivoInspecao"
                            value="DESMOBILIZAÇÃO"
                            checked={motivoInspecao === 'DESMOBILIZAÇÃO'}
                            onChange={() => setMotivoInspecao('DESMOBILIZAÇÃO')}
                            className="text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-800"
                          />
                          <span>DESMOBILIZAÇÃO</span>
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-2">
                        Status Automático: <span className="text-amber-400">{statusLiberacao}</span>
                      </p>
                    </div>

                    {/* Tensão do Equipamento */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-wider">
                        Tensão do Equipamento <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={tensaoEquipamento}
                        onChange={(e) => setTensaoEquipamento(e.target.value)}
                        placeholder="Ex: 220V, 380V, Bivolt"
                        required
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-600"
                      />
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 1: INSPEÇÃO VISUAL E FÍSICA */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="text-xs">🔌</span>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Seção 1: Inspeção Visual e Física</h4>
                  </div>
                  {renderQuestion(
                    'cabo_alimentacao',
                    'Cabo de Alimentação',
                    'Validar se há emendas expostas ou cortes no isolamento.',
                    caboAlimentacao,
                    setCaboAlimentacao,
                    ['Conforme', 'Não Conforme', 'N.A.']
                  )}
                  {renderQuestion(
                    'plugue_conectores',
                    'Plugue e Conectores',
                    'Verificar pinos tortos, quebrados ou carcaça do plugue rachada.',
                    plugueConectores,
                    setPlugueConectores,
                    ['Conforme', 'Não Conforme', 'N.A.']
                  )}
                  {renderQuestion(
                    'carcaca_estrutura',
                    'Carcaça e Estrutura Física',
                    'Verificar trincas, parafusos soltos ou pontos de corrosão estrutural.',
                    carcacaEstrutura,
                    setCarcacaEstrutura,
                    ['Conforme', 'Não Conforme']
                  )}
                  {renderQuestion(
                    'extintor',
                    'Extintor',
                    '',
                    extintor,
                    setExtintor,
                    ['Conforme', 'Não Conforme', 'N.A.']
                  )}
                  {renderQuestion(
                    'bateria',
                    'Bateria',
                    'Inspecionar oxidação dos terminais, nível de eletrólito e fixação.',
                    bateria,
                    setBateria,
                    ['Conforme', 'Não Conforme', 'N.A.']
                  )}
                </div>

                {/* SEÇÃO 2: TESTES ELÉTRICOS E SEGURANÇA */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="text-xs">⚡</span>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Seção 2: Testes Elétricos e Segurança</h4>
                  </div>
                  {renderQuestion(
                    'comandos_emergencia',
                    'Comandos e Botão de Emergência',
                    'Garantir que o desligamento mecânico imediato está funcional.',
                    comandosEmergencia,
                    setComandosEmergencia,
                    ['Conforme', 'Não Conforme', 'N.A.']
                  )}
                  {renderQuestion(
                    'painel_digital',
                    'Painel Digital e Indicadores/LEDs',
                    'Verificar legibilidade de displays e acionamento de light de alerta.',
                    painelDigital,
                    setPainelDigital,
                    ['Conforme', 'Não Conforme', 'N.A.']
                  )}
                  {renderQuestion(
                    'continuidade_aterramento',
                    'Continuidade de Aterramento',
                    'Teste ativo na carcaça para eliminar riscos de choque ao operador.',
                    continuidadeAterramento,
                    setContinuidadeAterramento,
                    ['Conforme', 'Não Conforme']
                  )}
                  {renderQuestion(
                    'resistencia_aquecimento',
                    'Resistência / Sistema de Aquecimento',
                    'Teste de curva de temperatura para equipamentos de termofusão.',
                    resistenciaAquecimento,
                    setResistenciaAquecimento,
                    ['Conforme', 'Não Conforme', 'N.A.']
                  )}
                </div>

                {/* SEÇÃO 3: PARECER TÉCNICO FINAL */}
                <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="text-xs">📋</span>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Seção 3: Parecer Técnico Final</h4>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-wider">
                      Status de Liberação do Ativo
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setStatusLiberacao('LIBERADO PARA OPERAÇÃO')}
                        className={`py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          statusLiberacao === 'LIBERADO PARA OPERAÇÃO'
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-950/20'
                            : 'bg-white border-slate-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                        id="status-liberacao-operacao"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Liberado</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusLiberacao('LIBERADO COM RESTRIÇÃO')}
                        className={`py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          statusLiberacao === 'LIBERADO COM RESTRIÇÃO'
                            ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-950/20'
                            : 'bg-white border-slate-200 text-amber-600 hover:bg-amber-50'
                        }`}
                        id="status-liberacao-restricao"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Lib. c/ Restrição</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusLiberacao('BLOQUEADO / NECESSITA MANUTENÇÃO')}
                        className={`py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          statusLiberacao === 'BLOQUEADO / NECESSITA MANUTENÇÃO'
                            ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-950/20'
                            : 'bg-white border-slate-200 text-rose-600 hover:bg-rose-50'
                        }`}
                        id="status-liberacao-bloqueado"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Bloqueado</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                      Observações Técnicas / Defeitos Constatados
                    </label>
                    <textarea
                      rows={4}
                      value={observacoesTecnicas}
                      onChange={(e) => setObservacoesTecnicas(e.target.value)}
                      placeholder="Relate detalhadamente quaisquer desvios, ajustes ou defeitos identificados..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* EVIDÊNCIAS FOTOGRÁFICAS (MÍNIMO 2) */}
                <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <Camera className="w-4 h-4 text-amber-500" />
                        <span>EVIDÊNCIAS FOTOGRÁFICAS (MÍNIMO 2)</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Tire ou selecione pelo menos 2 fotos do equipamento para comprovar o estado antes do salvamento.
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider self-start sm:self-auto ${
                      fotosSelecionadas.length >= 2 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {fotosSelecionadas.length} / 2 Fotos
                    </span>
                  </div>

                  <div className="space-y-3">
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 rounded-2xl cursor-pointer transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-6 h-6 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
                        <p className="text-xs font-bold text-slate-700">
                          Clique ou toque para anexar/tirar fotos
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          (Suporta seleção múltipla e câmera do dispositivo)
                        </p>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        capture="environment" 
                        onChange={handlePhotosSelect} 
                        className="hidden" 
                        id="input-fotos-evidencia"
                      />
                    </label>

                    {/* Miniaturas (Previews) */}
                    {fotosPreviews.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        {fotosPreviews.map((previewUrl, idx) => (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-square shadow-xs">
                            <img 
                              src={previewUrl} 
                              alt={`Evidência ${idx + 1}`} 
                              className="w-full h-full object-cover group-hover:opacity-90 transition"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(idx)}
                              className="absolute top-1.5 right-1.5 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md transition cursor-pointer"
                              title="Remover foto"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-slate-950/80 text-white text-[9px] font-mono rounded font-bold">
                              #{idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingChecklist}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer"
                  id="btn-save-checklist"
                >
                  {isSavingChecklist ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Gravando Checklist...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Checklist Digital</span>
                    </>
                  )}
                </button>
              </form>

              {/* RECENT SUBMISSIONS COMPONENT (Right Column) */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Últimas Vistorias</h3>
                  </div>
                  <span className="bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded text-[9px] font-mono text-slate-600">
                    {Array.isArray(checklistsSalvos) ? checklistsSalvos.length : 0} Registros
                  </span>
                </div>

                {isLoadingChecklists ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="uppercase font-bold">Carregando histórico...</span>
                  </div>
                ) : (!checklistsSalvos || checklistsSalvos.length === 0) ? (
                  <div className="py-16 text-center text-slate-500 text-xs">
                    <ClipboardList className="w-10 h-10 text-slate-800 mx-auto mb-3 animate-pulse" />
                    <span className="uppercase font-bold">Nenhum checklist registrado</span>
                    <p className="text-[10px] text-slate-600 uppercase mt-1">Realize a primeira inspeção ao lado para popular o histórico.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
                    {Array.isArray(checklistsSalvos) && checklistsSalvos.length > 0 && checklistsSalvos.map((chk: any) => {
                      const isBloqueado = chk?.status_liberacao?.startsWith('BLOQUEADO');
                      const isRestricao = chk?.status_liberacao?.includes('RESTRIÇÃO');
                      let statusBadge = '';
                      if (isBloqueado) statusBadge = 'bg-rose-950 text-rose-400 border-rose-900/40';
                      else if (isRestricao) statusBadge = 'bg-amber-950/60 text-amber-400 border-amber-900/30';
                      else statusBadge = 'bg-emerald-950 text-emerald-400 border-emerald-900/40';

                      const parsed = parseNewFields(chk);

                      return (
                        <div
                          key={chk?.id || chk?.created_at || Math.random()}
                          className="bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition rounded-2xl p-4 space-y-2.5"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-mono text-slate-500 font-black block">TAG: <strong className="text-slate-900 text-xs">{chk?.tag_equipamento || 'S/T (Sem Tag)'}</strong></span>
                              <div className="text-[11px] font-bold text-slate-800 leading-snug">
                                <span className="text-[9px] font-extrabold text-slate-500 uppercase mr-1">EQUIPAMENTO:</span>
                                <span className="text-slate-900">{chk?.descricao_item || chk?.descricao || chk?.item_descricao || 'Equipamento não especificado'}</span>
                              </div>
                              <span className="text-[9px] text-slate-500 uppercase block mt-0.5">Resp: <strong className="text-slate-700 font-semibold">{chk?.eletricista_responsavel || 'Não informado'}</strong></span>
                              {parsed.centro_de_custo && (
                                <span className="text-[9px] text-slate-500 uppercase block mt-0.5">Obra/CC: <strong className="text-amber-700 font-bold">{parsed.centro_de_custo}</strong></span>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0 ${statusBadge}`}>
                              {chk?.status_liberacao || 'NÃO AVALIADO'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] font-mono border-t border-slate-200/80 pt-2 text-slate-500 uppercase">
                            <span>🔌 Cabo: <strong className={chk?.cabo_alimentacao === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}>{chk?.cabo_alimentacao || 'N/A'}</strong></span>
                            <span>🔌 Plugue: <strong className={chk?.plugue_conectores === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}>{chk?.plugue_conectores || 'N/A'}</strong></span>
                            <span>🔌 Carcaça: <strong className={chk?.carcaca_estrutura === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}>{chk?.carcaca_estrutura || 'N/A'}</strong></span>
                            <span>⚡ Comandos: <strong className={chk?.comandos_emergencia === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}>{chk?.comandos_emergencia || 'N/A'}</strong></span>
                            <span>⚡ Painel: <strong className={chk?.painel_digital === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}>{chk?.painel_digital || 'N/A'}</strong></span>
                            <span>⚡ Aterram: <strong className={chk?.continuidade_aterramento === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}>{chk?.continuidade_aterramento || 'N/A'}</strong></span>
                            <span className="col-span-2">🔥 Resistência: <strong className={chk?.resistencia_aquecimento === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}>{chk?.resistencia_aquecimento || 'N/A'}</strong></span>
                          </div>

                          {(() => {
                            const { texto } = formatarObservacoes(chk?.observacoes_tecnicas);
                            if (!texto) return null;
                            return (
                              <div className="bg-white p-2 rounded-xl border border-slate-200 text-[9px] text-slate-600 italic">
                                "{texto}"
                              </div>
                            );
                          })()}

                          <div className="flex justify-between items-center pt-2.5 border-t border-slate-200/60 mt-1">
                            <span className="text-[9px] text-slate-400 font-mono">
                              {chk?.created_at ? new Date(chk.created_at).toLocaleString('pt-BR') : 'Data não informada'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {getChecklistPhotos(chk).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPhotosModal({
                                    title: `TAG: ${chk?.tag_equipamento || 'S/T'} • ${chk?.descricao_item || chk?.descricao || 'Equipamento'}`,
                                    photos: getChecklistPhotos(chk)
                                  })}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                                  title="Ver Fotos de Evidência"
                                >
                                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Fotos ({getChecklistPhotos(chk).length})</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedChecklistForView(chk)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                                title="Visualizar Laudo"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-600" />
                                <span>Abrir</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintChecklist(chk)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                                title="Imprimir Laudo"
                              >
                                <Printer className="w-3.5 h-3.5 text-slate-600" />
                                <span>Imprimir</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>

      {/* ========================================== */}
      {/* TIMELINE HISTORICO MODAL                   */}
      {/* ========================================== */}
      <AnimatePresence>
        {selectedTimelineDemanda && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="bg-slate-950 py-4 px-6 border-b border-slate-850 flex justify-between items-center">
                <div className="flex items-center space-x-2.5 text-amber-500">
                  <Clock className="w-5 h-5" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Timeline & Log da Atividade</h3>
                </div>
                <button
                  onClick={() => setSelectedTimelineDemanda(null)}
                  className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body details */}
              <div className="p-6 overflow-y-auto max-h-[480px] space-y-5">
                <div className="bg-slate-950/65 p-4 rounded-2xl border border-slate-850 space-y-2">
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                      selectedTimelineDemanda.tipo_demanda === 'Avulsa'
                        ? 'bg-rose-950 text-rose-400 border-rose-800'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}>
                      {selectedTimelineDemanda.tipo_demanda}
                    </span>
                    <span className="bg-slate-900 text-amber-450 text-[8px] px-1.5 py-0.5 rounded border border-amber-500/20 uppercase font-black">
                      {selectedTimelineDemanda.categoria_atividade || 'SERVIÇO'}{selectedTimelineDemanda.categoria_atividade === 'MANUTENÇÃO' && selectedTimelineDemanda.tipo_manutencao ? ` (${selectedTimelineDemanda.tipo_manutencao})` : ''}
                    </span>
                  </div>
                  {selectedTimelineDemanda.nome_item && (
                    <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                      📦 {selectedTimelineDemanda.nome_item}
                    </h3>
                  )}
                  <h4 className="text-sm font-black text-white whitespace-pre-wrap leading-relaxed">{selectedTimelineDemanda.descricao}</h4>
                  <div className="text-[10px] text-slate-400 font-mono space-y-1 pt-1.5 border-t border-slate-900 mt-2">
                    <p>QUANTIDADE: <strong className="text-slate-200">{selectedTimelineDemanda.quantidade}</strong></p>
                    <p>STATUS ATUAL: <strong className="text-amber-400 uppercase">{selectedTimelineDemanda.status}</strong></p>
                    <p>PRAZO ORIGINAL: <strong className="text-slate-300">{formatDateToBR(selectedTimelineDemanda.prazo_original)}</strong></p>
                    <p>PRAZO REPACTUADO: <strong className="text-slate-300">{formatDateToBR(selectedTimelineDemanda.prazo_atual)}</strong></p>
                    {selectedTimelineDemanda.executor_nome && (
                      <p>EXECUTOR ASSOC: <strong className="text-emerald-400 uppercase">{selectedTimelineDemanda.executor_nome}</strong></p>
                    )}
                  </div>
                </div>

                {/* Timeline flow */}
                <div className="space-y-4">
                  <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Histórico de Eventos Encadeados</h5>
                  
                  <div className="relative border-l-2 border-slate-800 ml-3 pl-5 space-y-5 py-1">
                    {selectedTimelineDemanda.historico_timeline?.map((event, idx) => (
                      <div key={idx} className="relative">
                        {/* Dot indicator */}
                        <span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-slate-900" />
                        
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {new Date(event.timestamp).toLocaleString('pt-BR')}
                          </span>
                          <strong className="text-xs text-white uppercase block leading-tight">
                            {event.action}
                          </strong>
                          <span className="text-[10px] text-slate-400 uppercase block">
                            Por: <strong className="text-slate-300">{event.user}</strong>
                          </span>
                          {event.details && (
                            <p className="text-[10px] text-slate-400 bg-slate-950/40 p-2 rounded-xl border border-slate-850/30 mt-1 italic leading-normal">
                              {event.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-950 p-4 border-t border-slate-850 flex justify-end">
                <button
                  onClick={() => setSelectedTimelineDemanda(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* NOVO MODAL: ACEITE E DISTRIBUIÇÃO DE OS (VISÃO DO MESTRE) */}
      {/* ======================================================== */}
      <AnimatePresence>
        {activeAceiteDistribuicaoModal && (() => {
          const dem = activeAceiteDistribuicaoModal;
          const subs = parseSubAtribuicoes(dem);
          const somaAtribuidas = subs.reduce((acc: number, s: any) => acc + s.quantidade, 0);
          const saldoPendente = dem.quantidade - somaAtribuidas;
          const osNumber = `OS-${dem.id.substring(0, 6).toUpperCase()}`;

          return (
            <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0f172a] border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col my-8"
              >
                {/* Header */}
                <div className="bg-slate-950 py-4 px-6 border-b border-slate-850 flex justify-between items-center">
                  <div className="flex items-center space-x-2.5">
                    <div className="bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20 text-amber-500">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">PCP • Oficina Elétrica</h3>
                      <h2 className="text-sm font-black text-white uppercase">Aceite e Distribuição de OS</h2>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveAceiteDistribuicaoModal(null)}
                    className="p-1.5 text-slate-400 hover:text-white transition rounded-xl hover:bg-slate-850"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] scrollbar-thin">
                  {/* OS Identity Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
                    <div className="text-center sm:text-left">
                      <span className="text-[9px] text-slate-500 uppercase font-black block">Número da OS</span>
                      <strong className="text-sm text-amber-400 font-mono block mt-0.5">{osNumber}</strong>
                    </div>
                    <div className="text-center sm:text-left">
                      <span className="text-[9px] text-slate-500 uppercase font-black block">Quantidade Solicitada</span>
                      <strong className="text-sm text-white block mt-0.5">{dem.quantidade} unidades</strong>
                    </div>
                    <div className="text-center sm:text-left">
                      <span className="text-[9px] text-slate-500 uppercase font-black block">Status Atual</span>
                      <span className="inline-block bg-slate-900 border border-slate-800 text-slate-300 text-[10px] px-2.5 py-0.5 rounded-lg uppercase font-black mt-1">
                        {dem.status}
                      </span>
                    </div>
                  </div>

                  {/* Item / Equipamento */}
                  {dem.nome_item && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Item / Equipamento</span>
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-white text-xs font-black uppercase">
                        📦 {dem.nome_item}
                      </div>
                    </div>
                  )}

                  {/* Demanda Descrição */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Descrição do Serviço</span>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                      {dem.descricao}
                    </div>
                  </div>

                  {/* 1. Aceite de Prazo */}
                  <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-white uppercase">Aceite do Prazo Solicitado</h4>
                        <p className="text-[10px] text-slate-400 uppercase">Prazo estipulado: <strong className="text-slate-200">{formatDateToBR(dem.prazo_atual)}</strong></p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConcordaPrazo(!concordaPrazo)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition border cursor-pointer ${
                          concordaPrazo
                            ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-rose-600/20 text-rose-400 border-rose-500/40'
                        }`}
                      >
                        {concordaPrazo ? '✓ Concorda com o Prazo' : '✗ Repactuar Prazo'}
                      </button>
                    </div>

                    {!concordaPrazo && (
                      <div className="grid grid-cols-1 gap-3 pt-3 border-t border-slate-850/60 animate-fade-in">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Nova Data Sugerida pelo Mestre</label>
                          <input
                            type="date"
                            value={novoPrazoSugerido}
                            onChange={(e) => setNovoPrazoSugerido(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Sub-atribuições já realizadas */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Sub-Atribuições / Distribuição Realizada</h4>
                      <span className="text-[10px] font-mono font-black text-slate-400">
                        {somaAtribuidas} / {dem.quantidade} ATRIBUÍDOS
                      </span>
                    </div>

                    {subs.length === 0 ? (
                      <div className="bg-slate-950/20 border border-slate-850 border-dashed rounded-2xl py-6 text-center text-slate-500 text-[10px] uppercase font-bold">
                        Nenhum fracionamento realizado ainda nesta OS.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {subs.map((s: any) => (
                          <div key={s.id} className="bg-slate-950 border border-slate-850 p-3.5 rounded-xl flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-900 border border-slate-800 text-slate-200 text-[10px] px-2 py-0.5 rounded-md font-bold font-mono">
                                  {s.quantidade} unidades
                                </span>
                                <span className="text-xs text-white font-black uppercase">
                                  👤 {s.eletricista_responsavel}
                                </span>
                              </div>
                              {s.co_realizadores && s.co_realizadores.length > 0 && (
                                <p className="text-[10px] text-slate-400 uppercase">
                                  Apoio: <strong className="text-slate-300">{s.co_realizadores.join(', ')}</strong>
                                </p>
                              )}
                              <div className="text-[11px] text-slate-300 bg-slate-900/40 p-2 rounded-lg border border-slate-900 font-medium">
                                <span className="text-[9px] font-black uppercase block text-slate-500 mb-0.5">Descrição de Papéis</span>
                                {s.descricao_papeis}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteSubAtribuicao(dem, s.id)}
                              className="p-1.5 bg-rose-950/50 hover:bg-rose-900/50 text-rose-400 hover:text-rose-300 border border-rose-900/40 rounded-xl transition cursor-pointer"
                              title="Excluir atribuição"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Formulário de nova Atribuição Parcial */}
                  <div className="border-t border-slate-850/60 pt-5 space-y-4">
                    <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850">
                      <div>
                        <span className="block text-[9px] text-slate-500 uppercase font-black">Saldo Disponível</span>
                        <strong className="text-sm text-amber-400 font-black">{saldoPendente} unidades restantes</strong>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                        saldoPendente === 0
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                          : 'bg-amber-950 text-amber-400 border border-amber-800/40 animate-pulse'
                      }`}>
                        {saldoPendente === 0 ? 'Totalmente Delegado' : 'Aguardando Atribuição'}
                      </span>
                    </div>

                    {saldoPendente > 0 && (
                      <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850 space-y-4">
                        <h4 className="text-xs font-black text-white uppercase tracking-wider border-b border-slate-850 pb-2">Nova Atribuição / Delegar Lote</h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Quantidade deste Lote</label>
                            <input
                              type="number"
                              min={1}
                              max={saldoPendente}
                              value={novaSubQtd}
                              onChange={(e) => setNovaSubQtd(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                            <p className="text-[9px] text-slate-500 uppercase mt-1 font-semibold">Máximo de {saldoPendente} unidades</p>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Eletricista Executor Responsável</label>
                            <select
                              value={subEletricistaResponsavel}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSubEletricistaResponsavel(val);
                                setSubCoRealizadores(prev => prev.filter(n => n !== val));
                              }}
                              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                            >
                              <option value="" className="bg-slate-950 text-slate-500">Selecione o Eletricista...</option>
                              {listaEletricistas.map((eletricista) => (
                                <option key={eletricista} value={eletricista} className="bg-slate-950 text-white">
                                  {eletricista}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Co-realizadores */}
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Apoio / Co-realizadores (Opcional)</label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {listaEletricistas
                              .filter(name => name !== subEletricistaResponsavel)
                              .map((helperName) => {
                                const isSelected = subCoRealizadores.includes(helperName);
                                return (
                                  <button
                                    key={helperName}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setSubCoRealizadores(prev => prev.filter(name => name !== helperName));
                                      } else {
                                        setSubCoRealizadores(prev => [...prev, helperName]);
                                      }
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition border cursor-pointer ${
                                      isSelected
                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                        : 'bg-slate-950 text-slate-400 border-slate-850 hover:border-slate-800'
                                    }`}
                                  >
                                    {helperName}
                                  </button>
                                );
                              })}
                            {listaEletricistas.filter(name => name !== subEletricistaResponsavel).length === 0 && (
                              <p className="text-[10px] text-slate-500 italic">Selecione o Responsável para liberar ajudantes.</p>
                            )}
                          </div>
                        </div>

                        {/* Descrição de papéis */}
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Papel / O que cada um vai fazer? <span className="text-rose-500">*</span></label>
                          <textarea
                            rows={3}
                            placeholder="Ex: Zé corta os fios, Marcelo passa estanho. Descreva detalhadamente a divisão de tarefas."
                            value={subDescricaoPapeis}
                            onChange={(e) => setSubDescricaoPapeis(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {/* Botão Salvar Lote */}
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={handleSaveSubAtribuicao}
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Gravar Atribuição Parcial</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-950 p-4 border-t border-slate-850 flex justify-end gap-2">
                  <button
                    onClick={() => setActiveAceiteDistribuicaoModal(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer border border-slate-850"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ========================================== */}
      {/* MODAL 1: CONTRATO DE ACEITE DE PRAZO       */}
      {/* ========================================== */}
      <AnimatePresence>
        {activeAcceptModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="bg-slate-950 py-4 px-6 border-b border-slate-850 flex justify-between items-center">
                <div className="flex items-center space-x-2.5 text-amber-500">
                  <Calendar className="w-5 h-5" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Contrato de Prazo da OS</h3>
                </div>
                <button
                  onClick={() => setActiveAcceptModal(null)}
                  className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850 text-center">
                  <span className="text-[10px] text-slate-450 uppercase tracking-widest block">Prazo Estabelecido</span>
                  <span className="text-2xl font-black text-amber-400 font-mono block mt-1">
                    {formatDateToBR(activeAcceptModal.prazo_atual)}
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-300 leading-relaxed text-center">
                    Você concorda em executar a demanda "{activeAcceptModal.descricao?.substring(0, 50)}..." dentro do prazo estipulado de <strong className="text-white">{formatDateToBR(activeAcceptModal.prazo_atual)}</strong>?
                  </p>
                </div>

                {/* Atribuição Fields */}
                <div className="space-y-4 pt-4 border-t border-slate-850">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Eletricista Responsável Principal</label>
                    <select
                      value={executorNameInput}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setExecutorNameInput(newName);
                        setCoRealizadores(prev => prev.filter(h => h !== newName));
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="" className="bg-slate-950 text-slate-500">Selecione o Eletricista...</option>
                      {listaEletricistas.map((eletricista) => (
                        <option key={eletricista} value={eletricista} className="bg-slate-950 text-slate-100">
                          {eletricista}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Equipe de Apoio (Ajudantes / Co-realizadores)</label>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {listaEletricistas
                        .filter(name => name !== executorNameInput)
                        .map((helperName) => {
                          const isSelected = coRealizadores.includes(helperName);
                          return (
                            <button
                              key={helperName}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setCoRealizadores(prev => prev.filter(name => name !== helperName));
                                } else {
                                  setCoRealizadores(prev => [...prev, helperName]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition border ${
                                isSelected
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              {helperName}
                            </button>
                          );
                        })}
                      {listaEletricistas.filter(name => name !== executorNameInput).length === 0 && (
                        <p className="text-[10px] text-slate-500 italic">Selecione o Responsável para ver ajudantes disponíveis.</p>
                      )}
                    </div>
                  </div>
                </div>

                {suggestNewDateFlag && (
                  <div className="space-y-3 pt-3 border-t border-slate-850 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Nova Data Sugerida</label>
                      <input
                        type="date"
                        value={suggestedDate}
                        onChange={(e) => setSuggestedDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Justificativa da Repactuação (Obrigatória)</label>
                      <textarea
                        rows={3}
                        placeholder="Descreva o motivo técnico pelo qual o prazo atual não é viável..."
                        value={suggestedJustification}
                        onChange={(e) => setSuggestedJustification(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="bg-slate-950 p-4 border-t border-slate-850 flex gap-2">
                {!suggestNewDateFlag ? (
                  <>
                    <button
                      onClick={() => setSuggestNewDateFlag(true)}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-amber-500 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border border-slate-850 text-center"
                    >
                      Não, sugerir novo prazo
                    </button>
                    <button
                      onClick={() => handleConfirmDirectAccept(activeAcceptModal)}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-650/10"
                    >
                      <Check className="w-4 h-4" />
                      <span>Sim, concordo</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setSuggestNewDateFlag(false)}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border border-slate-850 text-center"
                    >
                      Voltar ao Contrato
                    </button>
                    <button
                      onClick={() => handleSaveSuggestNewDate(activeAcceptModal)}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
                    >
                      <Save className="w-4 h-4" />
                      <span>Salvar Repactuação</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* MODAL 2: JUSTIFICATIVA DE ATRASO (BLOQUEANTE) */}
      {/* ========================================== */}
      <AnimatePresence>
        {activeDelayModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-rose-500/50 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="bg-rose-950/40 py-4 px-6 border-b border-rose-900/40 flex justify-between items-center text-rose-500">
                <div className="flex items-center space-x-2.5">
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-rose-400">Ação Bloqueada: OS Atrasada!</h3>
                </div>
              </div>

              <form onSubmit={handleSaveDelayJustification} className="p-6 space-y-4">
                <div className="bg-rose-950/10 border border-rose-900/30 p-4 rounded-2xl space-y-2">
                  <p className="text-xs text-rose-300 leading-relaxed font-semibold uppercase">
                    Aviso operacional crítico:
                  </p>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    O prazo estipulado para a atividade era <strong className="text-white">{formatDateToBR(activeDelayModal.prazo_atual)}</strong>, que já expirou. 
                    Para continuar, o sistema exige uma justificativa de atraso para fins de auditoria interna e a repactuação de um novo prazo.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Nova Previsão de Entrega (Futura)</label>
                    <input
                      type="date"
                      value={delayNewDate}
                      onChange={(e) => setDelayNewDate(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Justificativa de Atraso (Textarea Obrigatório)</label>
                    <textarea
                      rows={4}
                      placeholder="Descreva detalhadamente o motivo do atraso e o plano de ação..."
                      value={delayJustification}
                      onChange={(e) => setDelayJustification(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDelayModal(null);
                      setDelayedTargetAction(null);
                    }}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border border-slate-850 text-center"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/20"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Justificativa</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* MODAL 3: REPROGRAMAR / JUSTIFICAR ATRASO   */}
      {/* ========================================== */}
      <AnimatePresence>
        {activeReprogramModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-amber-500/50 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="bg-slate-950 py-4 px-6 border-b border-slate-850 flex justify-between items-center text-amber-500">
                <div className="flex items-center space-x-2.5">
                  <Calendar className="w-5 h-5" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Reprogramar / Justificar Prazo</h3>
                </div>
                <button
                  onClick={() => {
                    setActiveReprogramModal(null);
                    setReprogramDate('');
                    setReprogramJustification('');
                  }}
                  className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveReprogram} className="p-6 space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-1.5">
                  <p className="text-xs text-amber-400 leading-relaxed font-semibold uppercase">
                    Repactuação Operacional:
                  </p>
                  <p className="text-[11px] text-slate-300 leading-normal">
                    Você está alterando o prazo limite da OS "{activeReprogramModal.descricao?.substring(0, 50)}...".
                    Defina a nova data de previsão de entrega e justifique detalhadamente a necessidade desta alteração.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Nova Previsão de Entrega</label>
                    <input
                      type="date"
                      value={reprogramDate}
                      onChange={(e) => setReprogramDate(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">Justificativa de Reprogramação (Obrigatória)</label>
                    <textarea
                      rows={4}
                      placeholder="Explique os fatores técnicos ou logísticos que motivaram esta reprogramação..."
                      value={reprogramJustification}
                      onChange={(e) => setReprogramJustification(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReprogramModal(null);
                      setReprogramDate('');
                      setReprogramJustification('');
                    }}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border border-slate-850 text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/15"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Alteração</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* VIEW LAUDO TÉCNICO MODAL                   */}
      {/* ========================================== */}
      <AnimatePresence>
        {selectedChecklistForView ? (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-800"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 py-4 px-6 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center space-x-2.5">
                  <div className="bg-amber-500/10 text-amber-600 p-2 rounded-xl border border-amber-500/20">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-black tracking-widest text-amber-600 block leading-none">Visualização de Registro</span>
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 mt-0.5">Laudo Técnico de Inspeção</h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedChecklistForView(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-750 transition rounded-lg hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body / Laudo Content */}
              <div className="p-6 overflow-y-auto space-y-6 text-xs">
                {(() => {
                  const parsedView = parseNewFields(selectedChecklistForView);
                  return (
                    <>
                      {/* Meta details card */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                        <div>
                          <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">TAG do Equipamento</span>
                          <strong className="text-slate-850 font-bold">{selectedChecklistForView?.tag_equipamento || 'S/T (Sem Tag)'}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Fornecedor</span>
                          <strong className="text-slate-850 font-bold">{selectedChecklistForView?.fornecedor || 'Não especificado'}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Quantidade</span>
                          <strong className="text-slate-850 font-bold">{selectedChecklistForView?.quantidade ?? 0} {selectedChecklistForView?.unidade_medida || 'UN'}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Data da Inspeção</span>
                          <strong className="text-slate-850 font-bold">{selectedChecklistForView?.created_at ? new Date(selectedChecklistForView.created_at).toLocaleString('pt-BR') : 'Data não informada'}</strong>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Descrição do Item</span>
                          <strong className="text-slate-850 font-bold">{selectedChecklistForView?.descricao_item || 'Não especificado'}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Motivo da Inspeção</span>
                          <strong className="text-slate-850 font-bold uppercase">{parsedView.motivo_inspecao || 'MOBILIZAÇÃO'}</strong>
                        </div>
                        <div>
                          <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Tensão do Equipamento</span>
                          <strong className="text-slate-850 font-bold uppercase">{parsedView.tensao_equipamento || 'Não informada'}</strong>
                        </div>
                        <div className="sm:col-span-1 md:col-span-2">
                          <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Eletricista Responsável</span>
                          <strong className="text-slate-850 font-bold">{selectedChecklistForView?.eletricista_responsavel || 'Técnico não informado'}</strong>
                        </div>
                        <div className="sm:col-span-1 md:col-span-2">
                          <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Centro de Custo / Obra (Solicitante)</span>
                          <strong className="text-slate-850 font-bold uppercase">{parsedView.centro_de_custo || 'Não informado'}</strong>
                        </div>
                      </div>

                      {/* Section 1: Visual and Physical */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-150 pb-1.5">
                          <span className="text-sm">🔌</span>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Seção 1: Inspeção Visual e Física</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Cabo de Alimentação</span>
                            <span className={`text-xs font-black uppercase tracking-wider mt-1.5 ${selectedChecklistForView?.cabo_alimentacao === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {selectedChecklistForView?.cabo_alimentacao || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Plugues e Conectores</span>
                            <span className={`text-xs font-black uppercase tracking-wider mt-1.5 ${selectedChecklistForView?.plugue_conectores === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {selectedChecklistForView?.plugue_conectores || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Carcaça e Estrutura</span>
                            <span className={`text-xs font-black uppercase tracking-wider mt-1.5 ${selectedChecklistForView?.carcaca_estrutura === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {selectedChecklistForView?.carcaca_estrutura || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Extintor</span>
                            <span className={`text-xs font-black uppercase tracking-wider mt-1.5 ${parsedView.extintor === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {parsedView.extintor || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex flex-col justify-between">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Bateria</span>
                            <span className={`text-xs font-black uppercase tracking-wider mt-1.5 ${parsedView.bateria === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {parsedView.bateria || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Section 2: Electrical and Safety */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-150 pb-1.5">
                    <span className="text-sm">⚡</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Seção 2: Testes Elétricos e Segurança</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Comandos de Emergência</span>
                      <span className={`text-xs font-black uppercase tracking-wider ${selectedChecklistForView?.comandos_emergencia === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {selectedChecklistForView?.comandos_emergencia || 'N/A'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Painel Digital e LEDs</span>
                      <span className={`text-xs font-black uppercase tracking-wider ${selectedChecklistForView?.painel_digital === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {selectedChecklistForView?.painel_digital || 'N/A'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Continuidade de Aterramento</span>
                      <span className={`text-xs font-black uppercase tracking-wider ${selectedChecklistForView?.continuidade_aterramento === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {selectedChecklistForView?.continuidade_aterramento || 'N/A'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Resistência de Aquecimento</span>
                      <span className={`text-xs font-black uppercase tracking-wider ${selectedChecklistForView?.resistencia_aquecimento === 'Conforme' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {selectedChecklistForView?.resistencia_aquecimento || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Parecer Técnico */}
                <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                    <span className="text-sm">📋</span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Seção 3: Parecer Técnico Final</h4>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Status de Liberação:</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                      selectedChecklistForView?.status_liberacao === 'LIBERADO PARA OPERAÇÃO'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : selectedChecklistForView?.status_liberacao === 'LIBERADO COM RESTRIÇÃO'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {selectedChecklistForView?.status_liberacao || 'NÃO AVALIADO'}
                    </span>
                  </div>
                  {(() => {
                    const { texto, fotos } = formatarObservacoes(selectedChecklistForView?.observacoes_tecnicas);
                    if (!texto && fotos.length === 0) return null;
                    return (
                      <div className="border-t border-slate-200 pt-2.5 mt-2 space-y-2">
                        <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Observações Técnicas / Defeitos Constatados</span>
                        {texto && (
                          <p className="text-xs text-slate-700 italic bg-white p-3 rounded-xl border border-slate-150 leading-relaxed">
                            "{texto}"
                          </p>
                        )}
                        {fotos.length > 0 && (
                          <div className="pt-1">
                            <span className="block text-[9px] font-black uppercase text-slate-500 mb-1.5">Fotos da Observação:</span>
                            <div className="flex flex-wrap gap-2 print:flex print:flex-wrap print:gap-2 print:mt-4 break-inside-avoid">
                              {fotos.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="block cursor-pointer hover:opacity-90 transition-opacity">
                                  <img src={url} alt={`Foto ${i + 1}`} className="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-xs" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Seção 4: Evidências Fotográficas */}
                {getChecklistPhotos(selectedChecklistForView).length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                      <Camera className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Evidências Fotográficas Anexadas ({getChecklistPhotos(selectedChecklistForView).length})</h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {getChecklistPhotos(selectedChecklistForView).map((photoUrl, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-xs group cursor-pointer" onClick={() => setExpandedPhotoUrl(photoUrl)}>
                          <img 
                            src={photoUrl} 
                            alt={`Evidência ${idx + 1}`} 
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field of Signature */}
                <div className="pt-8 border-t border-slate-200 flex flex-col items-center justify-center text-center">
                  <div className="w-64 border-b border-slate-400 mb-1"></div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Assinatura do Técnico Responsável</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5">{selectedChecklistForView?.eletricista_responsavel || 'Técnico não informado'}</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedChecklistForView(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition border border-slate-200 cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintChecklist(selectedChecklistForView)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-amber-500/15 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Laudo</span>
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* ========================================== */}
      {/* MODAL DE JUSTIFICATIVA DE CANCELAMENTO      */}
      {/* ========================================== */}
      <AnimatePresence>
        {cancelTargetDemanda && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col text-slate-100"
            >
              {/* Modal Header */}
              <div className="bg-slate-950 py-4 px-6 border-b border-slate-850 flex justify-between items-center">
                <div className="flex items-center space-x-2.5 text-red-500">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">Motivo do Cancelamento</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelTargetDemanda(null)}
                  className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold font-mono">Demanda Selecionada</span>
                  <span className="text-sm font-black text-white block mt-1 leading-snug">
                    {cancelTargetDemanda.nome_item ? `[${cancelTargetDemanda.nome_item}] ` : ''}{cancelTargetDemanda.descricao}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Justificativa do Cancelamento <span className="text-red-500 font-bold">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={cancelJustification}
                    onChange={(e) => setCancelJustification(e.target.value)}
                    placeholder="Descreva detalhadamente o motivo pelo qual este serviço está sendo cancelado..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                  />
                  <p className="text-[10px] text-slate-500 uppercase font-medium">A justificativa é obrigatória para rastreabilidade e auditoria.</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-950/45 px-6 py-4 border-t border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCancelTargetDemanda(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition border border-slate-850 cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={cancelLoading || !cancelJustification.trim()}
                  onClick={handleConfirmCancelarDemanda}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/15 cursor-pointer"
                >
                  {cancelLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* MODAL DE GALERIA DE FOTOS DE EVIDÊNCIA      */}
      {/* ========================================== */}
      <AnimatePresence>
        {selectedPhotosModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-800"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">Evidências Fotográficas</h3>
                    <p className="text-[11px] text-slate-300 font-bold truncate max-w-md">{selectedPhotosModal.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPhotosModal(null)}
                  className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedPhotosModal.photos.map((photoUrl, idx) => (
                    <div key={idx} className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative group">
                      <img 
                        src={photoUrl} 
                        alt={`Evidência ${idx + 1}`}
                        className="w-full h-64 object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() => setExpandedPhotoUrl(photoUrl)}
                      />
                      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center bg-slate-950/80 backdrop-blur-xs px-3 py-1.5 rounded-xl text-[10px] text-white font-mono">
                        <span>Foto #{idx + 1}</span>
                        <a 
                          href={photoUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-1 font-sans font-bold"
                        >
                          <Eye className="w-3 h-3" /> Ampliar
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedPhotosModal(null)}
                  className="px-5 py-2.5 bg-[#3a2573] hover:bg-[#2b1b58] text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-md"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL FOTO FULLSCREEN */}
      <AnimatePresence>
        {expandedPhotoUrl && (
          <div 
            className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
            onClick={() => setExpandedPhotoUrl(null)}
          >
            <div className="relative max-w-5xl max-h-[95vh] flex items-center justify-center">
              <img 
                src={expandedPhotoUrl} 
                alt="Foto Ampliada" 
                className="max-w-full max-h-[90vh] object-contain rounded-2xl border border-slate-700 shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setExpandedPhotoUrl(null)}
                className="absolute -top-12 right-0 text-white bg-slate-800 hover:bg-slate-700 p-2.5 rounded-full cursor-pointer transition shadow-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  </>
);
}
