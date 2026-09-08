import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import { 
  ClipboardCheck, Search, Filter, Calendar, Users, Settings, Plus,
  FileText, Trash2, Printer, ShieldCheck, AlertTriangle, XOctagon, CheckCircle2, ChevronDown, PenTool, X, Upload, Fingerprint
} from 'lucide-react';
import { formatarObservacoes, getChecklistPhotos, parseNewFields } from '../utils/checklistHelpers';
import { useAuth } from '../context/AuthContext';
import CompanyLogo from './CompanyLogo';
import FaceValidationModal from './FaceValidationModal';
import SignaturePad from 'react-signature-canvas';

const getStatusCategory = (statusRaw?: string): 'aprovados' | 'ressalvas' | 'devolucao' | 'reprovados' | 'outros' => {
  const st = (statusRaw || '').toUpperCase().trim();
  if (!st) return 'outros';
  if (
    st.includes('RESTRIÇÃO') ||
    st.includes('RESTRICAO') ||
    st.includes('RESSALVA') ||
    st.includes('ATENÇÃO') ||
    st.includes('ATENCAO') ||
    st.includes('AVARIA')
  ) {
    return 'ressalvas';
  }
  if (
    st.includes('DEVOLUÇÃO') ||
    st.includes('DEVOLUCAO')
  ) {
    return 'devolucao';
  }
  if (
    st.includes('REPROVADO') ||
    st.includes('MANUTENÇÃO') ||
    st.includes('MANUTENCAO') ||
    st.includes('PARALISADO') ||
    st.includes('BLOQUEADO') ||
    st.includes('NÃO CONFORME') ||
    st.includes('NAO CONFORME') ||
    st.includes('REPROVADA')
  ) {
    return 'reprovados';
  }
  if (
    st.includes('LIBERADO') ||
    st.includes('APROVADO') ||
    st.includes('DISPONÍVEL') ||
    st.includes('DISPONIVEL') ||
    st.includes('CONFORME') ||
    st.includes('OPERAÇÃO') ||
    st.includes('OPERACAO')
  ) {
    return 'aprovados';
  }
  return 'outros';
};

export default function ChecklistView() {
  const { session } = useAuth();
  const [checklistsSalvos, setChecklistsSalvos] = useState<any[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);
  const [selectedChecklistForView, setSelectedChecklistForView] = useState<any>(null);
  const [laudoAtivoParaImpressao, setLaudoAtivoParaImpressao] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    return localStorage.getItem('sidebar_logo_url') || '';
  });

  // ORDEM 2: TRANSFORMAR O DICIONÁRIO EM ESTADO (STATE)
  const [dicionarioCategorias, setDicionarioCategorias] = useState<Record<string, string[]>>({
    "PADRÃO (GERAL)": ["Cabo de Alimentação", "Plugues e Conectores", "Carcaça e Estrutura", "Comandos de Emergência", "Painel Digital", "Aterramento", "Aquecimento"],
    "MARTELETE PNEUMÁTICO": ["Carcaça e Estrutura", "Empunhadeira ou Alça", "Acionamento/Gatilho", "Engate rápido de Ar", "Mola de Pressão", "Cabo de Alimentação", "Teste de Operação", "Trava da Ponteira"],
    "MÁQUINA DE SOLDA": ["Cabos de Solda", "Garra Negativa", "Porta Eletrodo", "Painel de Regulagem", "Cooler de Refrigeração"],
    "ESQUADREJADEIRA": [
      "Extensor Mesa Fixa",
      "Varão Paralelo Fixo 1150mm",
      "Volante Inclinação da Serra 45º",
      "Chassi",
      "Painel Eletrônico",
      "Volante Elevação Serra",
      "Pé Intermediário",
      "Pé de Apoio do Varão",
      "Varão 4200mm",
      "Paralelo Móvel",
      "Mesa Móvel",
      "Meia Esquadria",
      "Protetor de Serra",
      "Paralelo Fixo com Travamento",
      "Mesa Fixa",
      "Cantoneira de Travamento Paralelo",
      "Plug Industrial 63A 380V"
    ]
  });

  // Tenta carregar a logo oficial do Supabase
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data: storageData } = supabase.storage.from('assets').getPublicUrl('logo_almox.png');
        if (storageData?.publicUrl) {
          setLogoUrl(storageData.publicUrl);
        } else {
          const { data: dbData } = await supabase
            .from('configuracoes_sistema')
            .select('logo_url')
            .eq('id', 'geral')
            .maybeSingle();
          if (dbData?.logo_url) {
            setLogoUrl(dbData.logo_url);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar logo para impressão:', err);
      }
    };
    fetchLogo();
  }, []);
  
  // Dashboard Metrics
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroObra, setFiltroObra] = useState<string>('');
  const [filtroBusca, setFiltroBusca] = useState<string>('');
  
  // New Checklist Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  // ORDEM 2: ESTADO DO FORMULÁRIO COM CATEGORIA_EQUIPAMENTO, MODELO, FORNECEDOR E CRITÉRIOS DINÂMICOS
  const [formData, setFormData] = useState({
    tag_equipamento: '',
    centro_de_custo: '',
    descricao_item: '',
    categoria_equipamento: 'PADRÃO (GERAL)',
    modelo: '',
    fornecedor: '',
    quantidade: '' as number | '',
    unidade_medida: 'UN',
    eletricista_responsavel: '',
    status_liberacao: '' as 'LIBERADO PARA OPERAÇÃO' | 'LIBERADO COM RESTRIÇÃO' | 'LIBERADO PARA DEVOLUÇÃO' | 'REPROVADO / MANUTENÇÃO' | '',
    observacoes_tecnicas: '',
    motivo_inspecao: 'MOBILIZAÇÃO',
    extintor: 'Conforme' as 'Conforme' | 'Não Conforme' | 'N.A.',
    bateria: 'Conforme' as 'Conforme' | 'Não Conforme' | 'N.A.',
    tensao_equipamento: 'NÃO SE APLICA',
    criterios: {} as Record<string, string>
  });

  const [fotosSelecionadas, setFotosSelecionadas] = useState<File[]>([]);

  // ORDEM 1: CRIAR OS ESTADOS DE ASSINATURA (BIOMETRIA OU MANUAL)
  const [modoAssinatura, setModoAssinatura] = useState<'biometria' | 'manual' | null>(null);
  const [dadosAssinatura, setDadosAssinatura] = useState<{
    tipo: 'biometria' | 'manual';
    nomeValidacao: string;
    assinaturaBase64?: string;
    biometriaConfianca?: number;
  } | null>(null);
  const sigPadRef = useRef<any>(null);

  // ORDEM 3: CRIAR A FUNÇÃO DE NOVA CATEGORIA
  const handleNovaCategoria = () => {
    const novaCat = window.prompt("Digite o nome da nova Categoria de Equipamento (ex: GERADOR):");
    if (novaCat && novaCat.trim() !== "") {
      const nomeFormatado = novaCat.trim().toUpperCase();
      if (!dicionarioCategorias[nomeFormatado]) {
        // Cria a nova categoria com um checklist padrão básico para iniciar
        setDicionarioCategorias(prev => ({
          ...prev,
          [nomeFormatado]: ["Carcaça e Estrutura", "Teste de Operação", "Condições Gerais"]
        }));
        // Auto-seleciona a nova categoria no formulário
        setFormData(prev => ({ ...prev, categoria_equipamento: nomeFormatado, criterios: {} }));
      } else {
        alert("Esta categoria já existe!");
      }
    }
  };

  useEffect(() => {
    if (session) {
      setFormData(prev => ({
        ...prev,
        eletricista_responsavel: prev.eletricista_responsavel || session?.nome || session?.user?.email?.split('@')[0] || ''
      }));
    }
  }, [session]);

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
    
    // Validação estrita de campos obrigatórios
    if (
      !formData.centro_de_custo.trim() || 
      !formData.descricao_item.trim() || 
      formData.quantidade === '' || 
      Number(formData.quantidade) <= 0 || 
      !formData.unidade_medida || 
      !formData.status_liberacao
    ) {
      alert("Por favor, preencha todos os campos obrigatórios (marcados com *). Apenas a TAG é opcional.");
      return;
    }

    if (!formData.modelo.trim()) {
      alert("Por favor, informe o Modelo do equipamento.");
      return;
    }

    if (!formData.fornecedor.trim()) {
      alert("Por favor, informe o Fornecedor / Marca do equipamento.");
      return;
    }

    const resp = formData.eletricista_responsavel.trim() || session?.nome || session?.user?.email?.split('@')[0] || '';
    if (!resp) {
      alert("Responsável técnico / eletricista necessário!");
      return;
    }

    // Validar se todos os critérios da categoria selecionada foram preenchidos
    const listaCriterios = dicionarioCategorias[formData.categoria_equipamento || "PADRÃO (GERAL)"] || dicionarioCategorias["PADRÃO (GERAL)"] || [];
    const criterioFaltante = listaCriterios.find(crit => !formData.criterios?.[crit]);
    if (criterioFaltante) {
      alert(`O critério "${criterioFaltante}" precisa ser avaliado.`);
      return;
    }
    
    // Trava de Validação OBRIGATÓRIA: Mínimo 2 fotos de evidência
    if (fotosSelecionadas.length < 2) {
      alert('Obrigatório anexar pelo menos 2 fotos de evidência do equipamento.');
      return;
    }

    // Trava de Validação OBRIGATÓRIA: Autenticação / Assinatura da Inspeção
    if (!dadosAssinatura) {
      alert('Obrigatório autenticar a inspeção com Biometria Facial ou Assinatura Manual antes de salvar.');
      return;
    }

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
      alert(`Erro no envio das fotos: ${uploadErr.message || uploadErr}`);
      return;
    }

    try {
      const checklistPayload: any = {
        tag_equipamento: formData.tag_equipamento.trim() || null,
        descricao_item: formData.descricao_item.trim(),
        categoria_equipamento: formData.categoria_equipamento || "PADRÃO (GERAL)",
        modelo: formData.modelo.trim() || null,
        fornecedor: formData.fornecedor.trim() || null,
        quantidade: Number(formData.quantidade),
        unidade_medida: formData.unidade_medida,
        eletricista_responsavel: dadosAssinatura.nomeValidacao || resp,
        status_liberacao: formData.status_liberacao,
        observacoes_tecnicas: formData.observacoes_tecnicas.trim(),
        created_at: new Date().toISOString(),
        motivo_inspecao: formData.motivo_inspecao,
        extintor: formData.extintor,
        bateria: formData.bateria,
        tensao_equipamento: formData.tensao_equipamento,
        centro_de_custo: formData.centro_de_custo.trim() || null,
        fotos_evidencia: fotosUrls,
        respostas: formData.criterios,
        criterios: formData.criterios,
        tipo_assinatura: dadosAssinatura.tipo,
        nome_validador: dadosAssinatura.nomeValidacao,
        assinatura_base64: dadosAssinatura.tipo === 'manual' ? (dadosAssinatura.assinaturaBase64 || null) : null,
        biometria_validada: dadosAssinatura.tipo === 'biometria',
        biometria_confianca: dadosAssinatura.biometriaConfianca || null,
        // Retrocompatibilidade caso colunas específicas de critérios existam no schema
        cabo_alimentacao: formData.criterios["Cabo de Alimentação"] || formData.criterios["Cabos de Solda"] || "N.A.",
        plugue_conectores: formData.criterios["Plugues e Conectores"] || formData.criterios["Engate Rápido de Ar"] || "N.A.",
        carcaca_estrutura: formData.criterios["Carcaça e Estrutura"] || formData.criterios["Empunhadeira ou Alça"] || "Conforme",
        comandos_emergencia: formData.criterios["Comandos de Emergência"] || formData.criterios["Acionamento / Gatilho"] || "N.A.",
        painel_digital: formData.criterios["Painel Digital"] || formData.criterios["Painel de Regulagem"] || "N.A.",
        continuidade_aterramento: formData.criterios["Aterramento"] || formData.criterios["Garra Negativa"] || "Conforme",
        resistencia_aquecimento: formData.criterios["Aquecimento"] || formData.criterios["Cooler de Refrigeração"] || "N.A."
      };

      const { error } = await supabase.from('checklists_eletrica').insert(checklistPayload);

      if (error && error.message && (error.message.includes('column') || error.message.includes('not exist') || error.message.includes('invalid field'))) {
        const serializedDetails = `[Motivo: ${formData.motivo_inspecao} | Extintor: ${formData.extintor} | Bateria: ${formData.bateria} | Tensão: ${formData.tensao_equipamento}] [Categoria: ${formData.categoria_equipamento} | Modelo: ${formData.modelo} | Fornecedor: ${formData.fornecedor}]${formData.centro_de_custo.trim() ? ` [Centro de Custo: ${formData.centro_de_custo.trim()}]` : ''} [Critérios: ${JSON.stringify(formData.criterios)}] [Assinatura: ${dadosAssinatura.tipo} | Validador: ${dadosAssinatura.nomeValidacao}${dadosAssinatura.biometriaConfianca ? ` | Confiança: ${dadosAssinatura.biometriaConfianca}%` : ''}]${dadosAssinatura.assinaturaBase64 ? ` [AssinaturaBase64: ${dadosAssinatura.assinaturaBase64}]` : ''}${fotosUrls.length > 0 ? ` [Fotos: ${fotosUrls.join(', ')}]` : ''}`;
        const updatedObs = formData.observacoes_tecnicas.trim() ? `${formData.observacoes_tecnicas.trim()} ${serializedDetails}` : serializedDetails;
        
        const fallbackPayload: any = {
          tag_equipamento: formData.tag_equipamento.trim() || null,
          descricao_item: formData.descricao_item.trim(),
          fornecedor: formData.fornecedor.trim() || null,
          quantidade: Number(formData.quantidade),
          unidade_medida: formData.unidade_medida,
          eletricista_responsavel: dadosAssinatura.nomeValidacao || resp,
          status_liberacao: formData.status_liberacao,
          observacoes_tecnicas: updatedObs,
          created_at: new Date().toISOString(),
          fotos_evidencia: fotosUrls,
          tipo_assinatura: dadosAssinatura.tipo,
          nome_validador: dadosAssinatura.nomeValidacao,
          cabo_alimentacao: formData.criterios["Cabo de Alimentação"] || formData.criterios["Cabos de Solda"] || "N.A.",
          plugue_conectores: formData.criterios["Plugues e Conectores"] || formData.criterios["Engate Rápido de Ar"] || "N.A.",
          carcaca_estrutura: formData.criterios["Carcaça e Estrutura"] || formData.criterios["Empunhadeira ou Alça"] || "Conforme",
          comandos_emergencia: formData.criterios["Comandos de Emergência"] || formData.criterios["Acionamento / Gatilho"] || "N.A.",
          painel_digital: formData.criterios["Painel Digital"] || formData.criterios["Painel de Regulagem"] || "N.A.",
          continuidade_aterramento: formData.criterios["Aterramento"] || formData.criterios["Garra Negativa"] || "Conforme",
          resistencia_aquecimento: formData.criterios["Aquecimento"] || formData.criterios["Cooler de Refrigeração"] || "N.A."
        };
        const { error: fallbackError } = await supabase.from('checklists_eletrica').insert(fallbackPayload);
        if (fallbackError) throw fallbackError;
      } else if (error) {
        throw error;
      }

      alert('Checklist digital gravado com sucesso!');
      
      // Limpa os campos
      setFormData({
        tag_equipamento: '',
        centro_de_custo: '',
        descricao_item: '',
        categoria_equipamento: 'PADRÃO (GERAL)',
        modelo: '',
        fornecedor: '',
        quantidade: '',
        unidade_medida: 'UN',
        eletricista_responsavel: session?.nome || session?.user?.email?.split('@')[0] || '',
        status_liberacao: '',
        observacoes_tecnicas: '',
        motivo_inspecao: 'MOBILIZAÇÃO',
        extintor: 'Conforme',
        bateria: 'Conforme',
        tensao_equipamento: 'NÃO SE APLICA',
        criterios: {}
      });
      setFotosSelecionadas([]);
      setModoAssinatura(null);
      setDadosAssinatura(null);
      setIsModalOpen(false);
      
      fetchChecklists();
    } catch (err: any) {
      console.error('Erro na gravação do checklist:', err);
      alert(`Falha ao registrar checklist: ${err.message || err}`);
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const [isGerandoPdf, setIsGerandoPdf] = useState(false);

  const handleBaixarPdf = async () => {
    if (!laudoAtivoParaImpressao) return;
    setIsGerandoPdf(true);

    try {
      // Oculta os botões do modal na hora do print
      const botoes = document.getElementById('botoes-modal-print');
      if (botoes) botoes.style.display = 'none';

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Função auxiliar para capturar seções separadas e evitar o corte de fotos
      const capturarSecao = async (idElemento: string, isNovaPagina: boolean) => {
        const elemento = document.getElementById(idElemento);
        if (!elemento) return;

        const clone = elemento.cloneNode(true) as HTMLElement;
        clone.style.width = '794px'; // Largura A4 padrão
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.backgroundColor = 'white';
        clone.style.padding = '40px'; 
        
        // Tratamento de CORS para as Imagens (Supabase Storage)
        const imagens = clone.getElementsByTagName('img');
        for (let i = 0; i < imagens.length; i++) {
          if (imagens[i].src && imagens[i].src.startsWith('http')) {
            imagens[i].crossOrigin = "anonymous";
            imagens[i].src = imagens[i].src.split('?')[0] + '?bypass=' + new Date().getTime();
          }
        }

        document.body.appendChild(clone);
        await new Promise(resolve => setTimeout(resolve, 600));

        const canvas = await html2canvas(clone, { 
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#ffffff' 
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const contentHeight = (canvas.height * pdfWidth) / canvas.width;
        
        if (isNovaPagina) pdf.addPage();

        let position = 0;
        let heightLeft = contentHeight;
        
        // Adiciona a imagem no PDF
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, contentHeight);
        heightLeft -= pageHeight;

        // Se a seção (ex: tabela) for gigante, mantém a fatia de segurança
        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, contentHeight);
          heightLeft -= pageHeight;
        }
        
        if (document.body.contains(clone)) {
          document.body.removeChild(clone);
        }
      };

      // 1. Gera a Página 1 (Capa, Dados e Tabela)
      await capturarSecao('laudo-parte-1', false);
      
      // 2. Gera a Página 2 (Fotos e Assinaturas, sempre em folha nova)
      await capturarSecao('laudo-parte-2', true);

      pdf.save(`Laudo_Inspecao_${laudoAtivoParaImpressao.tag || laudoAtivoParaImpressao.tag_equipamento || laudoAtivoParaImpressao.equipamento || 'Equipamento'}.pdf`);

    } catch (error) {
      console.error("Erro ao gerar PDF: ", error);
      alert("Falha na geração do PDF. Tente novamente.");
    } finally {
      const botoes = document.getElementById('botoes-modal-print');
      if (botoes) botoes.style.display = 'flex';
      setIsGerandoPdf(false);
    }
  };

  const handlePrintChecklist = (chk: any) => {
    setLaudoAtivoParaImpressao(chk);
  };

  const handleDeleteChecklist = async (id: string) => {
    if (window.confirm('Tem certeza que deseja EXCLUIR este registro de checklist?')) {
      try {
        const { error } = await supabase.from('checklists_eletrica').delete().eq('id', id);
        if (error) throw error;
        alert('Checklist excluído com sucesso!');
        fetchChecklists();
        if (selectedChecklistForView?.id === id) setSelectedChecklistForView(null);
      } catch (err: any) {
        alert(`Erro ao excluir checklist: ${err.message || err}`);
      }
    }
  };

  // Filtragem
  const checklistsFiltrados = useMemo(() => {
    let list = [...checklistsSalvos];
    if (filtroStatus && filtroStatus !== 'todos') {
      list = list.filter(c => {
        const cat = getStatusCategory(c.status_liberacao || c.status);
        if (filtroStatus === 'liberado' || filtroStatus === 'aprovados') return cat === 'aprovados';
        if (filtroStatus === 'restricao' || filtroStatus === 'ressalvas') return cat === 'ressalvas';
        if (filtroStatus === 'devolucao') return cat === 'devolucao';
        if (filtroStatus === 'reprovado' || filtroStatus === 'reprovados') return cat === 'reprovados' || cat === 'outros';
        return true;
      });
    }
    if (filtroObra) {
      list = list.filter(c => {
        const p = parseNewFields(c);
        const obraStr = `${p.centro_de_custo || ''} ${c.obra || ''} ${c.centro_custo || ''}`.toLowerCase();
        return obraStr.includes(filtroObra.toLowerCase());
      });
    }
    if (filtroBusca) {
      const t = filtroBusca.toLowerCase();
      list = list.filter(c => 
        (c.tag_equipamento || c.tag || '').toLowerCase().includes(t) || 
        (c.descricao_item || c.equipamento || '').toLowerCase().includes(t) || 
        (c.eletricista_responsavel || c.inspetor || c.avaliador || '').toLowerCase().includes(t)
      );
    }
    return list;
  }, [checklistsSalvos, filtroStatus, filtroObra, filtroBusca]);

  const stats = useMemo(() => {
    return checklistsFiltrados.reduce(
      (acc, curr) => {
        acc.total++;
        const category = getStatusCategory(curr.status_liberacao || curr.status);
        if (category === 'aprovados') {
          acc.liberados++;
        } else if (category === 'ressalvas') {
          acc.restricao++;
        } else {
          // Reprovados e outros entram aqui para garantir soma exata de 100%
          acc.reprovados++;
        }
        return acc;
      },
      { total: 0, liberados: 0, restricao: 0, reprovados: 0 }
    );
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
            onClick={() => {
              setModoAssinatura(null);
              setDadosAssinatura(null);
              setIsModalOpen(true);
            }}
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
              <option value="devolucao">Devolução</option>
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
                                : chk.status_liberacao === 'LIBERADO PARA DEVOLUÇÃO'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
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
      {selectedChecklistForView && (() => {
        const parsedData = parseNewFields(selectedChecklistForView);
        const criteriosMap = Object.keys(parsedData.criterios || {}).length > 0
          ? Object.entries(parsedData.criterios).map(([l, v]) => ({ l, v: v as string }))
          : [
              { l: 'Cabo de Alimentação', v: selectedChecklistForView.cabo_alimentacao },
              { l: 'Plugues e Conectores', v: selectedChecklistForView.plugue_conectores },
              { l: 'Carcaça/Estrutura', v: selectedChecklistForView.carcaca_estrutura },
              { l: 'Comandos de Emergência', v: selectedChecklistForView.comandos_emergencia },
              { l: 'Painel Digital', v: selectedChecklistForView.painel_digital },
              { l: 'Aterramento', v: selectedChecklistForView.continuidade_aterramento },
              { l: 'Aquecimento', v: selectedChecklistForView.resistencia_aquecimento },
            ].filter(i => i.v !== undefined && i.v !== null);

        return (
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
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Categoria</span>
                      <strong className="text-amber-400">{parsedData.categoria_equipamento || selectedChecklistForView.categoria_equipamento || 'PADRÃO (GERAL)'}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Modelo</span>
                      <strong className="text-slate-200">{parsedData.modelo || selectedChecklistForView.modelo || '-'}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Fornecedor / Marca</span>
                      <strong className="text-slate-200">{parsedData.fornecedor || selectedChecklistForView.fornecedor || '-'}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Motivo</span>
                      <strong className="text-slate-200">{parsedData.motivo_inspecao || 'MOBILIZAÇÃO'}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Obra / Centro de Custo</span>
                      <strong className="text-slate-200">{parsedData.centro_de_custo || '-'}</strong>
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-1">Descrição</span>
                      <strong className="text-slate-200">{selectedChecklistForView.descricao_item}</strong>
                    </div>
                 </div>

                 {/* Respostas */}
                 <div>
                   <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 mb-3">Critérios de Avaliação Técnica</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                      {criteriosMap.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-slate-800/50 pb-1">
                          <span className="text-slate-300 font-medium">{item.l}</span>
                          <span className={`font-bold uppercase text-[10px] ${item.v === 'Conforme' ? 'text-emerald-400' : item.v === 'Não Conforme' ? 'text-rose-400' : 'text-slate-400'}`}>{item.v}</span>
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

                 {/* ORDEM 5: RENDERIZAÇÃO DO RESULTADO (VISUALIZAÇÃO / DETALHES DA INSPEÇÃO) */}
                 <div className="mt-8 border-t border-slate-800 pt-4 flex flex-col items-center justify-center">
                   {(parsedData.tipo_assinatura === 'biometria' || selectedChecklistForView.tipo_assinatura === 'biometria') ? (
                     <div className="text-center p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-2xl w-full max-w-md">
                       <span className="block text-emerald-400 font-bold text-base mb-1 flex items-center justify-center gap-1.5">
                         <ShieldCheck className="w-5 h-5 text-emerald-400" />
                         ✓ Autenticação Digital
                       </span>
                       <p className="text-slate-300 text-xs">
                         Validado via biometria facial por <strong className="text-white">{parsedData.nome_validador || selectedChecklistForView.nome_validador || selectedChecklistForView.eletricista_responsavel}</strong>
                       </p>
                       {(parsedData.biometria_confianca || selectedChecklistForView.biometria_confianca) && (
                         <span className="text-[10px] text-emerald-400/80 font-mono block mt-1">
                           Confiança facial: {parsedData.biometria_confianca || selectedChecklistForView.biometria_confianca}%
                         </span>
                       )}
                     </div>
                   ) : (parsedData.assinatura_base64 || selectedChecklistForView.assinatura_base64) ? (
                     <div className="text-center flex flex-col items-center">
                       <div className="bg-white/5 border border-slate-800 rounded-xl p-2 mb-2">
                         <img 
                           src={parsedData.assinatura_base64 || selectedChecklistForView.assinatura_base64} 
                           alt="Assinatura" 
                           className="h-16 filter invert object-contain max-w-[240px]" 
                         />
                       </div>
                       <div className="w-64 border-t border-slate-700 mx-auto pt-1"></div>
                       <p className="text-slate-200 font-bold text-xs">
                         {parsedData.nome_validador || selectedChecklistForView.nome_validador || selectedChecklistForView.eletricista_responsavel}
                       </p>
                       <span className="text-[10px] text-slate-500 uppercase tracking-widest block mt-0.5">
                         Assinatura Manual em Tela
                       </span>
                     </div>
                   ) : (
                     <div className="text-center">
                       <div className="w-64 border-t border-slate-700 mx-auto pt-2"></div>
                       <p className="text-slate-200 font-bold text-xs">
                         {selectedChecklistForView.eletricista_responsavel || selectedChecklistForView.inspetor || 'Responsável Técnico'}
                       </p>
                       <span className="text-[10px] text-slate-500 uppercase tracking-widest block mt-0.5">
                         Responsável Técnico
                       </span>
                     </div>
                   )}
                 </div>
              </div>
              <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-950">
                <button onClick={() => handlePrintChecklist(selectedChecklistForView)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Printer className="w-4 h-4" /> Gerar Laudo PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
              
              {/* NOVOS CAMPOS NO CABEÇALHO DO FORMULÁRIO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-gray-400 mb-1">CATEGORIA DO EQUIPAMENTO *</label>
                  <div className="flex gap-2">
                    <select 
                      required
                      className="bg-slate-900 border border-slate-700 text-white p-2 rounded flex-1"
                      value={formData.categoria_equipamento || "PADRÃO (GERAL)"}
                      onChange={(e) => setFormData({ ...formData, categoria_equipamento: e.target.value, criterios: {} })}
                    >
                      {Object.keys(dicionarioCategorias).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={handleNovaCategoria}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm font-bold shadow-md transition-colors"
                      title="Cadastrar nova categoria"
                    >
                      + Nova
                    </button>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-gray-400 mb-1">MODELO *</label>
                  <input required type="text" className="bg-slate-900 border border-slate-700 text-white p-2 rounded" value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} placeholder="Ex: D25133K" />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-gray-400 mb-1">FORNECEDOR / MARCA *</label>
                  <input required type="text" className="bg-slate-900 border border-slate-700 text-white p-2 rounded" value={formData.fornecedor} onChange={e => setFormData({...formData, fornecedor: e.target.value})} placeholder="Ex: DeWalt, Bosch..." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
                      TAG do Equipamento <span className="text-slate-500 font-normal lowercase">(opcional)</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: TAG-1029 (Opcional)"
                      value={formData.tag_equipamento} 
                      onChange={e => setFormData({...formData, tag_equipamento: e.target.value})} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
                      Obra / Centro de Custo <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Obra A - CC 1020"
                      value={formData.centro_de_custo} 
                      onChange={e => setFormData({...formData, centro_de_custo: e.target.value})} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none" 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
                      Descrição do Item <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Furadeira de Impacto Industrial"
                      value={formData.descricao_item} 
                      onChange={e => setFormData({...formData, descricao_item: e.target.value})} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:col-span-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
                        Quantidade <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        required
                        type="number" 
                        min="1" 
                        value={formData.quantidade} 
                        onChange={e => setFormData({...formData, quantidade: e.target.value === '' ? '' : Number(e.target.value)})} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
                        Unidade <span className="text-rose-500">*</span>
                      </label>
                      <select 
                        required
                        value={formData.unidade_medida} 
                        onChange={e => setFormData({...formData, unidade_medida: e.target.value})} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                      >
                        <option value="UN">UN - Unidade</option>
                        <option value="PC">PC - Peça</option>
                        <option value="CJ">CJ - Conjunto</option>
                      </select>
                    </div>
                  </div>
              </div>

              {/* ORDEM 3: RENDERIZAÇÃO DINÂMICA DO GRID DE CRITÉRIOS */}
              <div className="mb-6 border-t border-slate-800 pt-6">
                <h3 className="text-sm font-bold text-red-500 mb-3 uppercase">Critérios de Avaliação Técnica * (Obrigatório)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(dicionarioCategorias[formData.categoria_equipamento || "PADRÃO (GERAL)"] || dicionarioCategorias["PADRÃO (GERAL)"] || []).map((criterio) => (
                    <div key={criterio} className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded">
                      <span className="text-sm font-bold text-white">{criterio}</span>
                      <select 
                        required
                        className="bg-slate-800 border border-slate-700 text-white p-1 rounded text-sm w-32"
                        value={formData.criterios?.[criterio] || ""}
                        onChange={(e) => setFormData({
                          ...formData,
                          criterios: { ...formData.criterios, [criterio]: e.target.value }
                        })}
                      >
                        <option value="" disabled>Selecione</option>
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
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">
                  Parecer Técnico Final <span className="text-rose-500">*</span>
                </label>
                <select 
                  required 
                  value={formData.status_liberacao} 
                  onChange={e => setFormData({ ...formData, status_liberacao: e.target.value as any })} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none mb-4"
                >
                  <option value="" disabled>Selecione o parecer...</option>
                  <option value="LIBERADO PARA OPERAÇÃO">LIBERADO PARA OPERAÇÃO (Verde)</option>
                  <option value="LIBERADO COM RESTRIÇÃO">LIBERADO COM RESTRIÇÃO (Amarelo)</option>
                  <option value="LIBERADO PARA DEVOLUÇÃO">LIBERADO PARA DEVOLUÇÃO (Azul)</option>
                  <option value="REPROVADO / MANUTENÇÃO">REPROVADO / MANUTENÇÃO (Vermelho)</option>
                </select>

                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-wider">Observações / Ressalvas</label>
                <textarea rows={3} value={formData.observacoes_tecnicas} onChange={e => setFormData({ ...formData, observacoes_tecnicas: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none resize-none" placeholder="Detalhes técnicos adicionais..."></textarea>
              </div>

              {/* ORDEM 2: LÓGICA DE ESCOLHA NA INTERFACE / VALIDAÇÃO E ASSINATURA */}
              <div className="border-t border-slate-800 pt-6">
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-wider">
                  Validação e Assinatura Técnica <span className="text-rose-500">*</span>
                </label>

                {/* Escolha inicial do método quando nenhum foi realizado e nenhum modal está ativo */}
                {modoAssinatura === null && !dadosAssinatura && (
                  <div className="flex flex-col gap-4 p-5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center">
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Como deseja validar esta inspeção?</h4>
                      <p className="text-xs text-slate-400">Selecione o método de autenticação do responsável técnico</p>
                    </div>
                    <div className="flex flex-wrap gap-4 justify-center">
                      <button 
                        type="button"
                        onClick={() => setModoAssinatura('biometria')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-950/40"
                      >
                        <Fingerprint className="w-5 h-5 text-emerald-300" />
                        Validar com Biometria Facial
                      </button>
                      <button 
                        type="button"
                        onClick={() => setModoAssinatura('manual')}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 cursor-pointer transition-all hover:border-amber-500/40"
                      >
                        <PenTool className="w-5 h-5 text-amber-400" />
                        Assinatura Manual (Tela)
                      </button>
                    </div>
                  </div>
                )}

                {/* Feedback quando a assinatura já foi realizada */}
                {dadosAssinatura && modoAssinatura === null && (
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {dadosAssinatura.tipo === 'biometria' ? (
                        <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0">
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                      ) : (
                        <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
                          <PenTool className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <span className="block text-xs font-black uppercase tracking-wider text-emerald-400">
                          {dadosAssinatura.tipo === 'biometria' ? '✓ Autenticação Digital (Biometria Facial)' : '✓ Assinatura Manual Confirmada'}
                        </span>
                        <p className="text-xs text-slate-300">
                          Validado por: <strong className="text-white">{dadosAssinatura.nomeValidacao}</strong>
                          {dadosAssinatura.biometriaConfianca ? ` • Grau de Confiança: ${dadosAssinatura.biometriaConfianca}%` : ''}
                        </p>
                        {dadosAssinatura.tipo === 'manual' && dadosAssinatura.assinaturaBase64 && (
                          <div className="mt-2 bg-white/10 rounded-lg p-1.5 inline-block border border-slate-700">
                            <img 
                              src={dadosAssinatura.assinaturaBase64} 
                              alt="Assinatura" 
                              className="h-10 filter invert object-contain" 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDadosAssinatura(null);
                        setModoAssinatura(null);
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      Alterar / Refazer
                    </button>
                  </div>
                )}

                {/* ORDEM 4: FLUXO MANUAL (CANVAS) */}
                {modoAssinatura === 'manual' && (
                  <div className="flex flex-col items-center gap-4 p-5 bg-slate-950/90 rounded-2xl border border-slate-800">
                    <div className="text-center">
                      <h4 className="text-sm font-bold text-white mb-1">Assinatura Manual na Tela</h4>
                      <p className="text-slate-400 text-xs">Desenhe sua assinatura com o dedo, stylus ou mouse no quadro abaixo:</p>
                    </div>
                    <div className="bg-white rounded-xl border-2 border-slate-400 overflow-hidden shadow-inner touch-none">
                      <SignaturePad 
                        ref={sigPadRef} 
                        penColor="black"
                        canvasProps={{ 
                          width: 420, 
                          height: 160, 
                          className: 'sigCanvas max-w-full' 
                        }} 
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button 
                        type="button" 
                        onClick={() => sigPadRef.current?.clear()} 
                        className="text-slate-400 hover:text-white text-xs font-bold px-3 py-2 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Limpar
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setModoAssinatura(null)} 
                        className="text-slate-400 hover:text-rose-400 text-xs font-bold px-3 py-2 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
                            alert('Por favor, desenhe sua assinatura no quadro antes de confirmar.');
                            return;
                          }
                          const base64 = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
                          setDadosAssinatura({
                            tipo: 'manual',
                            assinaturaBase64: base64,
                            nomeValidacao: session?.nome || formData.eletricista_responsavel || session?.user?.email?.split('@')[0] || 'Inspetor Técnico'
                          });
                          setModoAssinatura(null);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-md cursor-pointer"
                      >
                        Confirmar Assinatura
                      </button>
                    </div>
                  </div>
                )}
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

      {/* ORDEM 3: FLUXO BIOMÉTRICO MODAL */}
      {modoAssinatura === 'biometria' && (
        <FaceValidationModal 
          isOpen={true}
          onSuccess={(usuarioReconhecido) => {
            setDadosAssinatura({
              tipo: 'biometria',
              nomeValidacao: usuarioReconhecido.nome,
              biometriaConfianca: usuarioReconhecido.confidence
            });
            setModoAssinatura(null);
          }}
          onClose={() => setModoAssinatura(null)}
          title="Validação Biométrica da Inspeção"
          subtitle="Identificação facial com prova de vida do inspetor responsável"
          actionLabel="Homologar Inspeção"
          itemDescription={formData.descricao_item || 'Inspeção de Equipamento'}
          orderNumber={formData.tag_equipamento || 'CHECKLIST'}
        />
      )}

      {/* MODAL DE IMPRESSÃO ISOLADO */}
      {laudoAtivoParaImpressao && (() => {
        const parsedLaudo = parseNewFields(laudoAtivoParaImpressao);
        const criteriosLaudo = Object.keys(parsedLaudo.criterios || {}).length > 0
          ? Object.entries(parsedLaudo.criterios).map(([label, val]) => ({ label, val: val as string }))
          : [
              { label: 'Cabo de Alimentação', val: laudoAtivoParaImpressao.cabo_alimentacao },
              { label: 'Plugues e Conectores', val: laudoAtivoParaImpressao.plugue_conectores },
              { label: 'Carcaça e Estrutura', val: laudoAtivoParaImpressao.carcaca_estrutura },
              { label: 'Comandos de Emergência', val: laudoAtivoParaImpressao.comandos_emergencia },
              { label: 'Painel Digital / Instrumentação', val: laudoAtivoParaImpressao.painel_digital },
              { label: 'Continuidade de Aterramento', val: laudoAtivoParaImpressao.continuidade_aterramento },
              { label: 'Resistência / Aquecimento', val: laudoAtivoParaImpressao.resistencia_aquecimento },
              { label: 'Extintor de Incêndio', val: parsedLaudo.extintor || 'N.A.' },
              { label: 'Bateria / Tensão', val: parsedLaudo.bateria || 'N.A.' },
            ].filter(item => item.val !== undefined && item.val !== null);

        return (
          <div id="print-area" className="fixed inset-0 z-[9999] bg-white text-slate-900 overflow-y-auto print:absolute print:inset-0 print:m-0 print:p-0 print:bg-white print:text-black">
            <div className="p-4 sm:p-8 max-w-4xl mx-auto flex flex-col min-h-screen">
              {/* Barra de Ações do Modal */}
              <div id="botoes-modal-print" className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                <h2 className="text-2xl font-black">Visualização do Laudo</h2>
                <div className="flex gap-4">
                  <button 
                    onClick={handleBaixarPdf} 
                    disabled={isGerandoPdf}
                    className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-indigo-700 disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {isGerandoPdf ? 'Gerando...' : '📥 Baixar PDF'}
                  </button>
                  <button 
                    onClick={() => setLaudoAtivoParaImpressao(null)} 
                    className="bg-red-100 text-red-600 px-6 py-2 rounded font-bold hover:bg-red-200 cursor-pointer transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              {/* CORPO DO LAUDO (Visível no Print) */}
              <div className="flex-1 bg-white" id="corpo-laudo">
                {/* PARTE 1: Cabeçalho, Dados de Identificação, Tabela de Conformidade, Parecer e Observações */}
                <div id="laudo-parte-1" className="bg-white">
                  {/* CABEÇALHO DO LAUDO (Visível no Print) */}
                  <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6">
                    {/* Esquerda: Logo + Títulos */}
                    <div className="flex items-center gap-6">
                      {/* Badge escuro forçado para destacar a logo branca (Garante a impressão da cor de fundo) */}
                      <div 
                        className="rounded-md p-2 flex items-center justify-center shrink-0" 
                        style={{ backgroundColor: '#0f172a', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', width: '140px', height: '60px' }}
                      >
                        {logoUrl ? (
                          <img 
                            src={logoUrl}
                            alt="CMPC Logo" 
                            className="max-h-full max-w-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <CompanyLogo height={36} className="shrink-0" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Laudo Técnico de Inspeção & Conformidade
                        </span>
                        <h1 className="text-2xl font-black uppercase text-gray-900 leading-none mb-1">
                          Gestão de Equipamentos e Qualidade
                        </h1>
                        <span className="text-xs font-medium text-slate-600">
                          Sistema de Gestão Integrada • CMPC
                        </span>
                      </div>
                    </div>

                    {/* Direita: Auditoria e Data */}
                    <div className="text-right flex flex-col justify-end">
                      <span className="text-[10px] font-bold text-gray-800 uppercase tracking-widest mb-1">
                        Auditoria Registrada
                      </span>
                      <span className="text-sm text-gray-600 font-mono">
                        Data: {laudoAtivoParaImpressao.created_at ? new Date(laudoAtivoParaImpressao.created_at).toLocaleDateString('pt-BR') : laudoAtivoParaImpressao.data || laudoAtivoParaImpressao.data_inspecao || new Date().toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Informações Gerais do Equipamento */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">TAG / Patrimônio</span>
                      <strong className="text-sm text-indigo-900 font-bold font-mono">
                        {laudoAtivoParaImpressao.tag_equipamento || laudoAtivoParaImpressao.tag || 'S/T'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Categoria</span>
                      <strong className="text-xs text-amber-700 font-bold">
                        {parsedLaudo.categoria_equipamento || laudoAtivoParaImpressao.categoria_equipamento || 'PADRÃO (GERAL)'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Modelo</span>
                      <strong className="text-xs text-slate-900 font-bold">
                        {parsedLaudo.modelo || laudoAtivoParaImpressao.modelo || '-'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Fornecedor / Marca</span>
                      <strong className="text-xs text-slate-900 font-bold">
                        {parsedLaudo.fornecedor || laudoAtivoParaImpressao.fornecedor || '-'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Descrição do Item</span>
                      <strong className="text-sm text-slate-900 font-bold">
                        {laudoAtivoParaImpressao.descricao_item || laudoAtivoParaImpressao.equipamento || '-'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Inspetor / Eletricista</span>
                      <strong className="text-sm text-slate-900 font-bold">
                        {laudoAtivoParaImpressao.eletricista_responsavel || laudoAtivoParaImpressao.inspetor || laudoAtivoParaImpressao.avaliador || '-'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Obra / Centro de Custo</span>
                      <strong className="text-xs text-slate-900 font-semibold">
                        {parsedLaudo.centro_de_custo || laudoAtivoParaImpressao.obra || laudoAtivoParaImpressao.centro_custo || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Motivo da Inspeção</span>
                      <strong className="text-xs text-slate-900 font-semibold">
                        {parsedLaudo.motivo_inspecao || 'MOBILIZAÇÃO'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Quantidade / Unidade</span>
                      <strong className="text-xs text-slate-900 font-semibold">
                        {laudoAtivoParaImpressao.quantidade ? `${laudoAtivoParaImpressao.quantidade} ${laudoAtivoParaImpressao.unidade_medida || 'UN'}` : '1 UN'}
                      </strong>
                    </div>
                  </div>

                  {/* Tabela de Itens Inspecionados */}
                  <div className="mb-6">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-2 mb-3">
                      Itens Inspecionados & Conformidade Técnica
                    </h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="py-2.5 px-4 font-black uppercase text-[10px] text-slate-700">Item Avaliado</th>
                            <th className="py-2.5 px-4 font-black uppercase text-[10px] text-slate-700 text-right">Resultado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {criteriosLaudo.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="py-2 px-4 font-semibold text-slate-800">{item.label}</td>
                              <td className="py-2 px-4 text-right">
                                <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${
                                  item.val === 'Conforme'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.val === 'Não Conforme'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {item.val}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Parecer Técnico */}
                  <div className="mb-6">
                    <p className="text-xs font-black text-slate-500 uppercase mb-2 tracking-wider">Parecer Técnico Final / Status</p>
                    <div className={`p-4 rounded-xl border-2 font-black text-lg text-center uppercase tracking-wider ${
                      getStatusCategory(laudoAtivoParaImpressao.status_liberacao || laudoAtivoParaImpressao.status) === 'aprovados'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : getStatusCategory(laudoAtivoParaImpressao.status_liberacao || laudoAtivoParaImpressao.status) === 'ressalvas'
                          ? 'bg-amber-50 border-amber-500 text-amber-800'
                          : getStatusCategory(laudoAtivoParaImpressao.status_liberacao || laudoAtivoParaImpressao.status) === 'devolucao'
                            ? 'bg-blue-50 border-blue-500 text-blue-800'
                            : 'bg-rose-50 border-rose-500 text-rose-800'
                    }`}>
                      {laudoAtivoParaImpressao.status_liberacao || laudoAtivoParaImpressao.status || 'PENDENTE'}
                    </div>
                  </div>

                  {/* Observações e Ressalvas */}
                  {formatarObservacoes(laudoAtivoParaImpressao.observacoes_tecnicas).texto && (
                    <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-500 mb-1 tracking-wider">Observações / Recomendações Técnicas</p>
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {formatarObservacoes(laudoAtivoParaImpressao.observacoes_tecnicas).texto}
                      </p>
                    </div>
                  )}

                  {/* JSON de respostas customizadas caso existam */}
                  {laudoAtivoParaImpressao.respostas && typeof laudoAtivoParaImpressao.respostas !== 'object' && (
                    <div className="mb-6">
                      <p className="text-xs font-black uppercase text-slate-700 mb-2 border-b border-slate-200 pb-1">Itens Inspecionados Detalhados</p>
                      <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
                        {typeof laudoAtivoParaImpressao.respostas === 'string' ? laudoAtivoParaImpressao.respostas : JSON.stringify(laudoAtivoParaImpressao.respostas, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* PARTE 2: Evidências Fotográficas e Assinatura/Rodapé */}
                <div id="laudo-parte-2" className="bg-white">
                  {/* Fotos / Evidências Fotográficas */}
                  {getChecklistPhotos(laudoAtivoParaImpressao).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-2 mb-3">
                        Evidências Fotográficas da Inspeção
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {getChecklistPhotos(laudoAtivoParaImpressao).map((url, idx) => (
                          <div key={idx} className="border border-slate-300 rounded-lg overflow-hidden bg-slate-100">
                            <img
                              src={url}
                              alt={`Evidência ${idx + 1}`}
                              className="w-full h-36 object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="p-1 text-center text-[9px] font-mono text-slate-500 font-bold bg-white border-t border-slate-200">
                              Foto {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rodapé / Assinatura do Inspetor */}
                  <div className="mt-8 pt-8 flex justify-between items-end border-t-2 border-slate-900">
                    <div className="text-[10px] text-slate-500 font-semibold max-w-sm">
                      Documento gerado após análise técnica. Autenticidade garantida por assinatura digital interna.
                    </div>
                    {(parsedLaudo.tipo_assinatura === 'biometria' || laudoAtivoParaImpressao.tipo_assinatura === 'biometria') ? (
                      <div className="text-center p-3 bg-emerald-50 border border-emerald-600/40 rounded-xl min-w-[240px]">
                        <span className="block text-emerald-900 font-black text-xs uppercase tracking-wider mb-0.5">
                          ✓ Autenticação Digital Biométrica
                        </span>
                        <p className="text-[11px] text-slate-800 font-medium">
                          Homologado via biometria facial por <strong className="text-slate-950">{parsedLaudo.nome_validador || laudoAtivoParaImpressao.nome_validador || laudoAtivoParaImpressao.eletricista_responsavel}</strong>
                        </p>
                        {(parsedLaudo.biometria_confianca || laudoAtivoParaImpressao.biometria_confianca) && (
                          <span className="text-[9px] text-emerald-800 font-mono block mt-0.5">
                            Grau de Confiança: {parsedLaudo.biometria_confianca || laudoAtivoParaImpressao.biometria_confianca}%
                          </span>
                        )}
                      </div>
                    ) : (parsedLaudo.assinatura_base64 || laudoAtivoParaImpressao.assinatura_base64) ? (
                      <div className="w-64 text-center">
                        <img 
                          src={parsedLaudo.assinatura_base64 || laudoAtivoParaImpressao.assinatura_base64} 
                          alt="Assinatura Manual" 
                          className="h-14 max-w-[200px] object-contain mx-auto mb-1" 
                        />
                        <div className="border-t border-slate-900 pt-1 text-xs font-bold text-slate-900 uppercase">
                          {parsedLaudo.nome_validador || laudoAtivoParaImpressao.nome_validador || laudoAtivoParaImpressao.eletricista_responsavel}
                        </div>
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block mt-0.5">
                          Assinatura Manual (Tela) • Responsável Técnico
                        </span>
                      </div>
                    ) : (
                      <div className="w-64 text-center">
                        <div className="border-t border-slate-900 pt-2 text-xs font-bold text-slate-900 uppercase">
                          {laudoAtivoParaImpressao.eletricista_responsavel || laudoAtivoParaImpressao.inspetor || laudoAtivoParaImpressao.avaliador || 'Assinatura do Inspetor'}
                        </div>
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest block mt-0.5">
                          Responsável Técnico
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
