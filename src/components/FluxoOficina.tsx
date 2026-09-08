import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, UploadCloud, FileText, CheckCircle2, AlertTriangle, 
  RefreshCw, Archive, PackageCheck, Search, Filter, X, Calendar, 
  MapPin, Clock, ArrowRight, RotateCcw, Settings2, LayoutDashboard, Table as TableIcon, Pencil, Trash2, Plus, Truck,
  ChevronDown, ChevronRight, Tag
} from 'lucide-react';
import FluxoOficinaDashboard from './FluxoOficinaDashboard';
import { supabase } from '../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';

// Use a stable CDN for the worker to avoid Vite build/module resolution issues with .mjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface FluxoOficinaItem {
  id: string;
  tag: string;
  nm: string;
  descricao: string;
  st: string;
  quantidade?: number | null;
  oficina_destino?: string | null;
  id_rtd_ida: string;
  data_emissao_ida: string | null;
  data_entrada_oficina: string | null;
  status: string;
  data_inspecao: string | null;
  id_rtd_saida: string | null;
  data_saida_oficial: string | null;
  deposito_destino: string | null;
}

export default function FluxoOficina({ onBackToHub }: { onBackToHub: () => void }) {
  const [activeModuleView, setActiveModuleView] = useState<'dashboard' | 'tabela'>('dashboard');
  const [items, setItems] = useState<FluxoOficinaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Return Modal State
  const [modalRetorno, setModalRetorno] = useState<{
    isOpen: boolean;
    dataRetorno: string;
    qtdAprovada: number;
    qtdReprovada: number;
  }>({ 
    isOpen: false, 
    dataRetorno: new Date().toISOString().split('T')[0],
    qtdAprovada: 1,
    qtdReprovada: 0,
  });

  // Modal Registrar Saída Manual State
  const [isSaidaModalOpen, setIsSaidaModalOpen] = useState(false);
  const [saidaForm, setSaidaForm] = useState<{
    idRtdSaida: string;
    dataSaida: string;
    depositoDestino: string;
    itemQuantidades: Record<string, number>;
  }>({
    idRtdSaida: '',
    dataSaida: new Date().toISOString().split('T')[0],
    depositoDestino: '',
    itemQuantidades: {},
  });

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [locationFilter, setLocationFilter] = useState('Todos');
  const [dateTypeFilter, setDateTypeFilter] = useState<'ida' | 'inspecao' | 'saida'>('ida');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [groupBySt, setGroupBySt] = useState(true);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({});

  const toggleGroupExpand = (key: string) => {
    setExpandedGroupKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Modal de Erro / Rejeição de Arquivo State
  const [modalErro, setModalErro] = useState<{
    isOpen: boolean;
    titulo: string;
    mensagem: string;
  }>({ isOpen: false, titulo: '', mensagem: '' });

  // Importação Modal Preview
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItems, setPreviewItems] = useState<FluxoOficinaItem[]>([]);

  // Oficina Modal State for RTD Ida
  const [isSelectOficinaModalOpen, setIsSelectOficinaModalOpen] = useState(false);
  const [pendingIdaItems, setPendingIdaItems] = useState<FluxoOficinaItem[]>([]);
  const [stEncontradaNoDocumento, setStEncontradaNoDocumento] = useState<string>('');
  const [inputStManual, setInputStManual] = useState<string>('');
  const [selectedOficina, setSelectedOficina] = useState<string>('Eletrônica');

  // Modal Editar ST State (Individual e em Lote)
  const [isEditarStModalOpen, setIsEditarStModalOpen] = useState(false);
  const [targetStItemIds, setTargetStItemIds] = useState<string[]>([]);
  const [novaStInput, setNovaStInput] = useState<string>('');
  const [savingSt, setSavingSt] = useState<boolean>(false);

  // Modal Novo Item Manual / Lote State
  const [isNovoItemModalOpen, setIsNovoItemModalOpen] = useState(false);
  const [novoItemForm, setNovoItemForm] = useState({
    st: '',
    descricao: '',
    nm: '',
    tagFisica: '',
    quantidade: 1,
    oficinaDestino: 'Eletrônica',
    idRtdIda: '',
    dataEmissaoIda: new Date().toISOString().split('T')[0],
  });

  // Saida Modal State
  const [isConferenciaModalOpen, setIsConferenciaModalOpen] = useState(false);
  const [conferenciaData, setConferenciaData] = useState<{
    validas: FluxoOficinaItem[];
    invalidas: { tag: string; motivo: string }[];
    idRtdSaida: string;
    depositoDestino: string;
    dataSaidaIso: string;
  } | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fluxo_oficina')
        .select('*')
        .order('data_entrada_oficina', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Erro ao buscar fluxo_oficina:', err);
      if (err && typeof err === 'object' && 'code' in err && err.code === '42P01') {
        setDbError('A tabela fluxo_oficina não existe no Supabase. Execute o script SQL para criá-la.');
      } else {
        setDbError((err as any)?.message || 'Erro desconhecido ao conectar com o banco de dados.');
      }
    } finally {
      setLoading(false);
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const extrairDestinoBlindado = (textoDoPDF: string) => {
    try {
      const sanitizeString = (str: string | null | undefined): string => {
        if (!str) return '';
        return str.replace(/\s+/g, ' ').trim();
      };

      // 1. Unifica linhas e isola o trecho após "Depósito Destino"
      let txt = textoDoPDF.replace(/[\r\n\|]+/g, ' ');
      let aposDestino = txt.split(/Depósito Destino/i)[1] || txt;

      // 2. Guilhotina nos delimitadores de tabela
      let parteUtil = aposDestino.split(/Descrição|Siga|Item|NM Material|Valor|Total|\bUM\b|Quant|TAG:|RM:/i)[0];

      // 3. Remove lixo e referências à Origem/Oficina/Equipamentos
      let semOficina = parteUtil
        .replace(/70\s*OFICINA CENTRAL ALUMAR/gi, '')
        .replace(/OFICINA CENTRAL ALUMAR/gi, '')
        .replace(/OFICINA/gi, '')
        .replace(/CENTRAL/gi, '')
        .replace(/ALUMAR/gi, '')
        .replace(/\(\$\)/g, '')
        .replace(/Depósito Origem/gi, '')
        .replace(/EQUIPAMENTOS/gi, '')
        .replace(/\b\d{2}X\b/gi, '');

      // 4. Sanitiza espaços duplos
      let finalLimpo = sanitizeString(semOficina);

      // 5. Se for GER ALMOX
      if (/01\s*-\s*GER\s*ALMOX/i.test(textoDoPDF) || /GER ALMOX/i.test(finalLimpo)) {
        return '01 - GER ALMOX';
      }

      // 6. Aplicação de Regex de Destino (Ignora a parte da origem e captura a partir do número do CC de 3 dígitos)
      const regexDestinoEnd = /(?:50X\s+EQUIPAMENTOS\s+50X\s+)?(\d{3}\s+[A-Z0-9\s\-]+)$/i;
      const matchEnd = finalLimpo.match(regexDestinoEnd);
      if (matchEnd && matchEnd[1]) {
        return sanitizeString(matchEnd[1]);
      }

      // Padrão seguro para destino de obra: CC de 3 dígitos + nome da obra
      const regexCC3 = /(\d{3}\s+[A-Z0-9\s\-]+)/i;
      const matchCC3 = finalLimpo.match(regexCC3);
      if (matchCC3 && matchCC3[1]) {
        return sanitizeString(matchCC3[1]);
      }

      // Fallback para qualquer CC de 2 a 4 dígitos
      const matchObra = finalLimpo.match(/(\d{2,4}\s+[A-ZÀ-Ÿ0-9\s\-]+)/i);
      if (matchObra && matchObra[1]) {
        return sanitizeString(matchObra[1]);
      }

      return sanitizeString(finalLimpo) || 'DESTINO NÃO IDENTIFICADO';
    } catch(e) {
      return 'ERRO NA EXTRAÇÃO';
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Intercept and Parse PDF for RTD IDA (Refatorado com Método Split)
  const handleImportRtdIda = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    e.target.value = '';

    setLoading(true);
    try {
      const text = await extractTextFromPDF(file);
      
      // Validação de segurança lendo o texto BRUTO do PDF
      const isDestinoOficina = text.includes('70 OFICINA CENTRAL ALUMAR') || text.includes('OFICINA CENTRAL');

      if (!isDestinoOficina) {
        setModalErro({
          isOpen: true,
          titulo: 'Upload Rejeitado (Destino Inválido)',
          mensagem: 'Este documento não pode ser importado aqui. A RTD informada não tem como depósito destino a "70 OFICINA CENTRAL ALUMAR". Verifique o arquivo e tente novamente.'
        });
        setLoading(false);
        return;
      }

      // Se passou, o destino é obrigatoriamente a oficina. Não precisamos extrair, basta atribuir:
      const depositoDestino = '70 OFICINA CENTRAL ALUMAR';

      // 1. Extração do Cabeçalho
      const idRtdMatch = text.match(/(?:ID RTD|Nº Documento)[\s\S]*?(\d{4,6})/i);
      const idRtd = idRtdMatch ? idRtdMatch[1] : `RTD-${Math.floor(Math.random() * 10000)}`;

      const dataEmissaoMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      let dataEmissaoIso = new Date().toISOString();
      if (dataEmissaoMatch) {
        const [dia, mes, ano] = dataEmissaoMatch[1].split('/');
        dataEmissaoIso = new Date(`${ano}-${mes}-${dia}T12:00:00Z`).toISOString();
      }

      // 2. Extração dos Itens via Método Split para Suportar Documentos sem RM/ST
      const partes = text.split(/TAG:\s*/i);
      const novosItens: FluxoOficinaItem[] = [];
      let stEncontrada = '';

      for (let i = 1; i < partes.length; i++) {
        const blocoAtual = partes[i];
        const textoAnterior = partes[i - 1]; // Aqui reside o NM e a Descrição

        // Isola o item atual removendo sujeiras do anterior e evitando o próximo item
        const pedacoAnterior = textoAnterior.split(/RM:\s*\d+/i).pop() || textoAnterior;
        const pedacoAtual = blocoAtual.split(/\b\d{1,3}\s+\d{6}\b/)[0] || blocoAtual;
        const blocoItem = `${pedacoAnterior} TAG: ${pedacoAtual}`;
        
        // Transforma o bloco do item numa linha única para evitar problemas com \n e |
        const textoLimpo = blocoItem.replace(/[\n\r]/g, ' ').replace(/\|/g, ' ');

        let nmExtraido = 'N/A';
        let stFinal = '';
        let tagExtraida = `TAG-DESCONHECIDA-${i}`;
        let descricaoFinal = 'EQUIPAMENTO NÃO IDENTIFICADO';

        // 1. ST (RM): Busca especificamente a etiqueta "RM:"
        const matchRm = textoLimpo.match(/RM:\s*(\d+)/i);
        if (matchRm) stFinal = matchRm[1];

        if (stFinal && /^0+$/.test(stFinal)) {
          stFinal = '';
        }
        if (stFinal) stEncontrada = stFinal;

        // 2. TAG: Busca especificamente a etiqueta "TAG:"
        const matchTag = textoLimpo.match(/TAG:\s*([A-Z0-9-]+)/i);
        if (matchTag) tagExtraida = matchTag[1];

        // 3. NM: Os NMs de materiais geralmente têm 6 dígitos (ex: 231047). 
        // Evita os itens (1, 2) e RMs (7 dígitos). Pega o último NM antes da TAG.
        const matchesNm = textoLimpo.match(/\b(\d{6})\b/g);
        if (matchesNm) nmExtraido = matchesNm[matchesNm.length - 1];

        // 4. Descrição: Usa o NM encontrado como âncora inicial. 
        // Captura tudo entre o NM e a primeira ocorrência de TAG:, RM: ou UN.
        if (nmExtraido !== 'N/A') {
          // Cria uma regex dinâmica: /231047\s+(.*?)\s+(?:TAG:|RM:|UN\b)/i
          const regexDesc = new RegExp(`${nmExtraido}\\s+(.*?)\\s+(?:TAG:|RM:|UN\\b)`, 'i');
          const matchDesc = textoLimpo.match(regexDesc);
          
          if (matchDesc) {
            descricaoFinal = matchDesc[1].replace(/COR DO MÊS.*/i, '').replace(/NÃO APLICA/i, '').trim();
          }
        } else {
          // Fallback caso o NM não seja encontrado por algum motivo
          const matchDescFallback = textoLimpo.match(/([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9\s\/\-\.]*[A-ZÀ-Ÿ])\s*(?:TAG:|RM:|UN\b)/i);
          if (matchDescFallback) {
            descricaoFinal = matchDescFallback[1].replace(/COR DO MÊS.*/i, '').replace(/NÃO APLICA/i, '').trim();
          }
        }

        novosItens.push({
          id: crypto.randomUUID(),
          tag: tagExtraida,
          nm: nmExtraido,
          descricao: descricaoFinal,
          st: stFinal, // Pode vir vazio e ser complementado no Modal
          quantidade: 1,
          oficina_destino: 'Eletrônica',
          id_rtd_ida: idRtd,
          data_emissao_ida: dataEmissaoIso,
          data_entrada_oficina: new Date().toISOString(),
          status: 'Em Inspeção',
          data_inspecao: null,
          id_rtd_saida: null,
          data_saida_oficial: null,
          deposito_destino: null,
        });
      }

      if (novosItens.length === 0) {
        setModalErro({
          isOpen: true,
          titulo: 'Falha na Leitura do Arquivo',
          mensagem: 'Não foi possível encontrar nenhuma TAG ou equipamento válido neste PDF. Certifique-se de que é um documento de RTD legível.'
        });
        setLoading(false);
        return;
      }

      setPreviewItems(novosItens);
      setStEncontradaNoDocumento(stEncontrada);
      setInputStManual(stEncontrada);
      setShowPreviewModal(true);

    } catch (err) {
      console.error(err);
      setModalErro({
        isOpen: true,
        titulo: 'Erro ao Importar RTD de Ida',
        mensagem: 'Ocorreu uma falha ao processar a leitura do documento PDF. Verifique se o arquivo está legível ou no formato correto.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Funções de manipulação do Preview Modal
  const handleUpdatePreviewItem = (index: number, field: keyof FluxoOficinaItem, value: any) => {
    const newItems = [...previewItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setPreviewItems(newItems);
  };

  const handleRemovePreviewItem = (index: number) => {
    const newItems = [...previewItems];
    newItems.splice(index, 1);
    setPreviewItems(newItems);
  };

  const handleAddPreviewItem = () => {
    setPreviewItems([
      ...previewItems,
      {
        id: crypto.randomUUID(),
        tag: '',
        nm: '',
        descricao: '',
        st: stEncontradaNoDocumento || '', 
        quantidade: 1,
        oficina_destino: 'Eletrônica',
        id_rtd_ida: previewItems.length > 0 ? previewItems[0].id_rtd_ida : `RTD-${Math.floor(Math.random() * 10000)}`,
        data_emissao_ida: previewItems.length > 0 ? previewItems[0].data_emissao_ida : new Date().toISOString(),
        data_entrada_oficina: new Date().toISOString(),
        status: 'Em Inspeção',
        data_inspecao: null,
        id_rtd_saida: null,
        data_saida_oficial: null,
        deposito_destino: null,
      }
    ]);
  };

  const confirmarPreview = () => {
    if (previewItems.length === 0) return;
    setPendingIdaItems(previewItems);
    setSelectedOficina('Eletrônica');
    setShowPreviewModal(false);
    setIsSelectOficinaModalOpen(true);
  };

  // Confirmar Importação de Ida com Oficina e ST Final (Suporte a Lotes e Quantidade)
  const confirmarImportacaoIda = async () => {
    if (pendingIdaItems.length === 0) return;

    const stFinalGeral = stEncontradaNoDocumento || inputStManual.trim();

    setLoading(true);
    try {
      const itensFinais = pendingIdaItems.map(item => {
        const stItem = (item.st || stFinalGeral || '').trim();
        const quantidadeItem = Math.max(1, Number(item.quantidade) || 1);

        let tagItem = item.tag ? item.tag.trim() : '';
        const isTagSemFisica = !tagItem || tagItem.startsWith('TAG-DESCONHECIDA') || tagItem.startsWith('VIRTUAL-') || tagItem.startsWith('SEM-TAG');

        // Se for item sem TAG física (Lote), concatena LOTE-${ST}-${NM} ou timestamp para garantir unicidade
        if (isTagSemFisica) {
          const numeroST = (stItem && stItem.length > 0 && !/^0+$/.test(stItem)) ? stItem : item.id.slice(0, 8);
          const nmMat = (item.nm || '').trim();
          const timestampSuff = Date.now().toString().slice(-4) + Math.floor(Math.random() * 100).toString().padStart(2, '0');
          tagItem = (nmMat && nmMat !== 'N/A')
            ? `LOTE-${numeroST}-${nmMat}`
            : `LOTE-${numeroST}-${timestampSuff}`;
        }

        return {
          ...item,
          tag: tagItem,
          st: stItem,
          quantidade: quantidadeItem,
          oficina_destino: selectedOficina,
        };
      });

      const { error } = await supabase.from('fluxo_oficina').upsert(itensFinais);
      if (error) throw error;

      alert(`RTD IDA importada com sucesso para a Oficina ${selectedOficina}! ${itensFinais.length} registro(s) salvo(s).`);
      
      setIsSelectOficinaModalOpen(false);
      setPendingIdaItems([]);
      setInputStManual('');
      setStEncontradaNoDocumento('');
      fetchItems();
    } catch (err) {
      console.error(err);
      setModalErro({
        isOpen: true,
        titulo: 'Erro ao Salvar no Banco',
        mensagem: 'Ocorreu uma falha ao registrar os equipamentos da RTD no banco de dados.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler para Salvar Novo Item / Lote Manual
  const handleSaveNovoItem = async () => {
    if (!novoItemForm.descricao.trim()) {
      alert('Por favor, informe a descrição do equipamento.');
      return;
    }

    const stTrim = novoItemForm.st.trim();
    const tagInput = novoItemForm.tagFisica.trim();
    const nmMaterial = novoItemForm.nm.trim();
    const qtdNum = Math.max(1, Number(novoItemForm.quantidade) || 1);

    const numeroST = (stTrim && stTrim.length > 0 && !/^0+$/.test(stTrim))
      ? stTrim
      : Math.floor(100000 + Math.random() * 900000).toString();

    // Lógica de Gravação: se não tiver TAG física, compõe com NM ou timestamp para unicidade
    let tagFinal = tagInput;
    if (!tagFinal) {
      tagFinal = (nmMaterial && nmMaterial !== 'N/A')
        ? `LOTE-${numeroST}-${nmMaterial}`
        : `LOTE-${numeroST}-${Date.now().toString().slice(-4)}`;
    }

    const rtdIdaFinal = novoItemForm.idRtdIda.trim() || `RTD-${Math.floor(1000 + Math.random() * 9000)}`;
    const dataEmissaoIdaIso = novoItemForm.dataEmissaoIda
      ? new Date(`${novoItemForm.dataEmissaoIda}T12:00:00Z`).toISOString()
      : new Date().toISOString();

    setLoading(true);
    try {
      const novoRegistro: FluxoOficinaItem = {
        id: crypto.randomUUID(),
        tag: tagFinal,
        nm: novoItemForm.nm.trim() || 'N/A',
        descricao: novoItemForm.descricao.trim(),
        st: stTrim,
        quantidade: qtdNum,
        oficina_destino: novoItemForm.oficinaDestino,
        id_rtd_ida: rtdIdaFinal,
        data_emissao_ida: dataEmissaoIdaIso,
        data_entrada_oficina: new Date().toISOString(),
        status: 'Em Inspeção',
        data_inspecao: null,
        id_rtd_saida: null,
        data_saida_oficial: null,
        deposito_destino: null,
      };

      const { error } = await supabase.from('fluxo_oficina').insert([novoRegistro]);
      if (error) throw error;

      alert(`Equipamento / Lote registrado com sucesso! (${tagFinal} - Quantidade: ${qtdNum})`);
      setIsNovoItemModalOpen(false);
      setNovoItemForm({
        st: '',
        descricao: '',
        nm: '',
        tagFisica: '',
        quantidade: 1,
        oficinaDestino: 'Eletrônica',
        idRtdIda: '',
        dataEmissaoIda: new Date().toISOString().split('T')[0],
      });
      fetchItems();
    } catch (err: any) {
      console.error('Erro ao cadastrar novo item:', err);
      setModalErro({
        isOpen: true,
        titulo: 'Erro ao Cadastrar Item',
        mensagem: err?.message || 'Falha ao gravar o novo equipamento no banco de dados.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handlers para Edição de ST (Individual e em Lote)
  const handleOpenSingleStModal = (item: FluxoOficinaItem) => {
    setTargetStItemIds([item.id]);
    setNovaStInput(item.st && item.st !== '0' ? item.st : '');
    setIsEditarStModalOpen(true);
  };

  const handleOpenBulkStModal = () => {
    if (selectedItems.length === 0) return;
    
    // Filtra para garantir que não sobrescreva itens que já têm ST válida
    const pendentes = items.filter(
      item => selectedItems.includes(item.id) && (!item.st || item.st.trim() === '' || /^0+$/.test(item.st.trim()))
    );

    if (pendentes.length === 0) {
      alert('⚠️ Nenhum dos itens selecionados possui pendência de ST.');
      return;
    }

    setTargetStItemIds(pendentes.map(p => p.id));
    setNovaStInput('');
    setIsEditarStModalOpen(true);
  };

  const handleSalvarSt = async () => {
    if (targetStItemIds.length === 0) return;
    const stFormatada = novaStInput.trim();

    if (!stFormatada) {
      alert('⚠️ Por favor, digite o número da ST.');
      return;
    }

    setSavingSt(true);
    try {
      const { error } = await supabase
        .from('fluxo_oficina')
        .update({ st: stFormatada })
        .in('id', targetStItemIds);

      if (error) throw error;

      alert(
        targetStItemIds.length === 1
          ? 'ST atualizada com sucesso!'
          : `ST (${stFormatada}) atribuída com sucesso para ${targetStItemIds.length} equipamento(s)!`
      );

      setIsEditarStModalOpen(false);
      setTargetStItemIds([]);
      setNovaStInput('');
      if (targetStItemIds.length > 1) {
        setSelectedItems([]);
      }
      fetchItems();
    } catch (err) {
      console.error('Erro ao atualizar ST:', err);
      setModalErro({
        isOpen: true,
        titulo: 'Erro ao Salvar ST',
        mensagem: 'Ocorreu uma falha ao atualizar o número da ST no banco de dados.'
      });
    } finally {
      setSavingSt(false);
    }
  };

    // Parse RTD SAIDA
  const handleImportRtdSaida = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setLoading(true);
    try {
      const file = e.target.files[0];
      const text = await extractTextFromPDF(file);
      
      // Extração de Cabeçalho
      const idRtdMatch = text.match(/(?:ID RTD|Nº Documento)[\s\S]*?(\d{4,6})/i);
      const idRtdSaida = idRtdMatch ? idRtdMatch[1] : `RTD-${Math.floor(Math.random() * 10000)}`;

      const dataMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      let dataSaidaIso = new Date().toISOString();
      if (dataMatch) {
        const [dia, mes, ano] = dataMatch[1].split('/');
        dataSaidaIso = new Date(`${ano}-${mes}-${dia}T12:00:00Z`).toISOString();
      }

      // Extração do Depósito Destino
      const depositoDestino = extrairDestinoBlindado(text);

      // Extração de TODAS as TAGs do documento com o padrão TAG:\s*([A-Z0-9\-]+)
      const tagsExtraidas: string[] = [];
      const regexTags = /TAG:\s*([A-Z0-9\-]+)/gi;
      let match;
      while ((match = regexTags.exec(text)) !== null) {
        const tagCapturada = match[1].trim();
        if (tagCapturada && !tagsExtraidas.includes(tagCapturada)) {
          tagsExtraidas.push(tagCapturada);
        }
      }

      if (tagsExtraidas.length === 0) {
        setModalErro({
          isOpen: true,
          titulo: 'Falha na Leitura do Documento de Saída',
          mensagem: 'Nenhuma TAG no padrão "TAG: XXXX" foi encontrada neste documento de RTD de Saída. Certifique-se de que o arquivo enviado é uma RTD válida.'
        });
        setLoading(false);
        e.target.value = '';
        return;
      }

      // Cruzamento com o Banco de Dados (Bypass de Status: aceita qualquer status do item)
      const { data: itensBanco, error } = await supabase
        .from('fluxo_oficina')
        .select('*')
        .in('tag', tagsExtraidas);

      if (error) throw error;

      const validas: FluxoOficinaItem[] = [];
      const invalidas: { tag: string; motivo: string }[] = [];

      const itensEncontradosMap = new Map((itensBanco || []).map(i => [i.tag, i]));

      for (const tag of tagsExtraidas) {
        const item = itensEncontradosMap.get(tag);
        
        if (!item) {
          invalidas.push({ tag, motivo: 'Não encontrado no sistema' });
          continue;
        }

        // Bypass de Status: a realidade física da RTD tem precedência, aceita qualquer item existente
        validas.push(item);
      }

      setConferenciaData({
        validas,
        invalidas,
        idRtdSaida,
        depositoDestino,
        dataSaidaIso
      });
      setIsConferenciaModalOpen(true);
      
    } catch (err) {
      console.error(err);
      setModalErro({
        isOpen: true,
        titulo: 'Erro ao Processar RTD de Saída',
        mensagem: 'Ocorreu um erro inesperado durante a análise do documento de movimentação de saída.'
      });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const confirmarMobilizacao = async () => {
    if (!conferenciaData) return;
    
    setLoading(true);
    try {
      const statusSaida = conferenciaData.depositoDestino.includes('01 - GER ALMOX')
        ? 'Desmobilizado para SEDE'
        : 'MOBILIZADO';

      for (const item of conferenciaData.validas) {
        // Query de atualização sem cláusula restritiva .eq('status', 'DISPONÍVEL')
        const { error } = await supabase
          .from('fluxo_oficina')
          .update({
            id_rtd_saida: conferenciaData.idRtdSaida,
            data_saida_oficial: conferenciaData.dataSaidaIso,
            deposito_destino: conferenciaData.depositoDestino,
            status: statusSaida
          })
          .eq('tag', item.tag);

        if (error) throw error;
      }
      
      alert(`Sucesso! ${conferenciaData.validas.length} item(ns) movimentado(s) via RTD.`);
      setIsConferenciaModalOpen(false);
      setConferenciaData(null);
      fetchItems();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao confirmar mobilização: ${err?.message || 'Falha no banco de dados'}`);
      setLoading(false);
    }
  };

  const handleRegistrarRetorno = () => {
    if (selectedItems.length === 0) {
      alert("Selecione itens em inspeção para registrar o retorno.");
      return;
    }

    const selectedList = items.filter(
      item => selectedItems.includes(item.id) && item.status === 'Em Inspeção'
    );

    if (selectedList.length === 0) {
      alert("Nenhum dos itens selecionados está atualmente com status 'Em Inspeção'.");
      return;
    }

    const totalQtd = selectedList.reduce(
      (acc, item) => acc + (Number(item.quantidade) || 1),
      0
    );

    setModalRetorno({
      isOpen: true,
      dataRetorno: new Date().toISOString().split('T')[0],
      qtdAprovada: totalQtd,
      qtdReprovada: 0,
    });
  };

  const confirmRetorno = async () => {
    const selectedList = items.filter(
      item => selectedItems.includes(item.id) && item.status === 'Em Inspeção'
    );

    if (selectedList.length === 0) return;

    const totalQtd = selectedList.reduce(
      (acc, item) => acc + (Number(item.quantidade) || 1),
      0
    );

    const { dataRetorno, qtdAprovada, qtdReprovada } = modalRetorno;
    const sumInputs = qtdAprovada + qtdReprovada;

    if (sumInputs > totalQtd) {
      alert(`A soma das quantidades (${sumInputs}) excede a quantidade total (${totalQtd}).`);
      return;
    }

    if (sumInputs <= 0) {
      alert(`Informe ao menos 1 item aprovado ou reprovado/condenado para registrar o retorno.`);
      return;
    }

    setLoading(true);
    try {
      const dataFormatada = new Date(`${dataRetorno}T12:00:00Z`).toISOString();

      let remAprovada = qtdAprovada;
      let remReprovada = qtdReprovada;

      for (const item of selectedList) {
        const itemQty = Number(item.quantidade) || 1;

        const allocAprovada = Math.min(itemQty, remAprovada);
        remAprovada -= allocAprovada;

        const itemRemAfterApproved = itemQty - allocAprovada;
        const allocReprovada = Math.min(itemRemAfterApproved, remReprovada);
        remReprovada -= allocReprovada;

        const allocPendente = itemRemAfterApproved - allocReprovada;

        const baseTag = item.tag ? item.tag.trim() : `LOTE-${item.st || item.id.slice(0, 8)}`;

        if (allocPendente > 0) {
          // Mantém o registro original em 'Em Inspeção' com a quantidade pendente que continua na oficina
          const { error: errorUpdate } = await supabase
            .from('fluxo_oficina')
            .update({
              quantidade: allocPendente,
            })
            .eq('id', item.id);

          if (errorUpdate) throw errorUpdate;

          // Insere clone para os Aprovados (se houver)
          if (allocAprovada > 0) {
            const aprTag = baseTag.includes('-APR') ? `${baseTag}-1` : `${baseTag}-APR`;
            const { error: errorInsertApr } = await supabase
              .from('fluxo_oficina')
              .insert([{
                id: crypto.randomUUID(),
                tag: aprTag,
                nm: item.nm || 'N/A',
                descricao: item.descricao,
                st: item.st || '',
                quantidade: allocAprovada,
                oficina_destino: item.oficina_destino || 'Eletrônica',
                id_rtd_ida: item.id_rtd_ida || '',
                data_emissao_ida: item.data_emissao_ida,
                data_entrada_oficina: item.data_entrada_oficina,
                status: 'DISPONÍVEL',
                data_inspecao: dataFormatada,
                id_rtd_saida: null,
                data_saida_oficial: null,
                deposito_destino: null,
              }]);
            if (errorInsertApr) throw errorInsertApr;
          }

          // Insere clone para os Reprovados/Condenados (se houver)
          if (allocReprovada > 0) {
            const repTag = baseTag.includes('-REP') ? `${baseTag}-1` : `${baseTag}-REP`;
            const { error: errorInsertRep } = await supabase
              .from('fluxo_oficina')
              .insert([{
                id: crypto.randomUUID(),
                tag: repTag,
                nm: item.nm || 'N/A',
                descricao: item.descricao,
                st: item.st || '',
                quantidade: allocReprovada,
                oficina_destino: item.oficina_destino || 'Eletrônica',
                id_rtd_ida: item.id_rtd_ida || '',
                data_emissao_ida: item.data_emissao_ida,
                data_entrada_oficina: item.data_entrada_oficina,
                status: 'REPROVADO RETIDO',
                data_inspecao: dataFormatada,
                id_rtd_saida: null,
                data_saida_oficial: null,
                deposito_destino: null,
              }]);
            if (errorInsertRep) throw errorInsertRep;
          }
        } else if (allocAprovada > 0) {
          // Atualiza o registro original para 'DISPONÍVEL'
          const { error: errorUpdate } = await supabase
            .from('fluxo_oficina')
            .update({
              quantidade: allocAprovada,
              status: 'DISPONÍVEL',
              data_inspecao: dataFormatada,
            })
            .eq('id', item.id);

          if (errorUpdate) throw errorUpdate;

          // Insere clone para os Reprovados (se houver)
          if (allocReprovada > 0) {
            const repTag = baseTag.includes('-REP') ? `${baseTag}-1` : `${baseTag}-REP`;
            const { error: errorInsertRep } = await supabase
              .from('fluxo_oficina')
              .insert([{
                id: crypto.randomUUID(),
                tag: repTag,
                nm: item.nm || 'N/A',
                descricao: item.descricao,
                st: item.st || '',
                quantidade: allocReprovada,
                oficina_destino: item.oficina_destino || 'Eletrônica',
                id_rtd_ida: item.id_rtd_ida || '',
                data_emissao_ida: item.data_emissao_ida,
                data_entrada_oficina: item.data_entrada_oficina,
                status: 'REPROVADO RETIDO',
                data_inspecao: dataFormatada,
                id_rtd_saida: null,
                data_saida_oficial: null,
                deposito_destino: null,
              }]);
            if (errorInsertRep) throw errorInsertRep;
          }
        } else {
          // Atualiza o registro original para 'REPROVADO RETIDO'
          const { error: errorUpdate } = await supabase
            .from('fluxo_oficina')
            .update({
              quantidade: allocReprovada,
              status: 'REPROVADO RETIDO',
              data_inspecao: dataFormatada,
            })
            .eq('id', item.id);

          if (errorUpdate) throw errorUpdate;
        }
      }

      alert("Retorno de inspeção registrado com sucesso!");
      setModalRetorno({ ...modalRetorno, isOpen: false });
      setSelectedItems([]);
      fetchItems();
    } catch (err: any) {
      console.error('Erro ao registrar retorno:', err);
      setModalErro({
        isOpen: true,
        titulo: 'Erro ao Registrar Retorno',
        mensagem: err?.message || 'Falha ao processar retorno no banco de dados.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Abrir Modal de Saída Manual
  const handleAbrirModalSaida = () => {
    if (selectedItems.length === 0) {
      alert("Selecione pelo menos um equipamento na tabela para registrar a saída.");
      return;
    }

    const selectedList = items.filter(i => selectedItems.includes(i.id));

    if (selectedList.length === 0) {
      alert("Nenhum equipamento selecionado.");
      return;
    }

    const initialQtds: Record<string, number> = {};
    selectedList.forEach(item => {
      initialQtds[item.id] = Math.max(1, Number(item.quantidade) || 1);
    });

    const firstDestino = selectedList.find(i => i.deposito_destino)?.deposito_destino || '';

    setSaidaForm({
      idRtdSaida: `RTD-${Math.floor(1000 + Math.random() * 9000)}`,
      dataSaida: new Date().toISOString().split('T')[0],
      depositoDestino: firstDestino,
      itemQuantidades: initialQtds,
    });

    setIsSaidaModalOpen(true);
  };

  const handleUpdateQtdEnviar = (itemId: string, maxQty: number, valStr: string) => {
    const valNum = parseInt(valStr) || 1;
    const clamped = Math.min(maxQty, Math.max(1, valNum));
    setSaidaForm(prev => ({
      ...prev,
      itemQuantidades: {
        ...prev.itemQuantidades,
        [itemId]: clamped,
      },
    }));
  };

  // Confirmar Saída Manual (Com Desmembramento de Lotes no Supabase - Bypass de Status)
  const confirmSaidaManual = async () => {
    if (!saidaForm.idRtdSaida.trim()) {
      alert("Por favor, informe o Número da RTD de Saída.");
      return;
    }

    if (!saidaForm.depositoDestino.trim()) {
      alert("Por favor, informe a Obra / Frente de Trabalho (Destino).");
      return;
    }

    const selectedList = items.filter(i => selectedItems.includes(i.id));

    if (selectedList.length === 0) {
      alert("Nenhum item selecionado para saída.");
      return;
    }

    setLoading(true);
    try {
      const dataSaidaIso = new Date(`${saidaForm.dataSaida}T12:00:00Z`).toISOString();
      const rtdSaidaTrim = saidaForm.idRtdSaida.trim();
      const destinoTrim = saidaForm.depositoDestino.trim();

      for (const item of selectedList) {
        const qtdAtual = Math.max(1, Number(item.quantidade) || 1);
        const qtdEnviar = Math.min(qtdAtual, Math.max(1, Number(saidaForm.itemQuantidades[item.id]) || qtdAtual));

        if (qtdEnviar === qtdAtual) {
          // Transferência Total: UPDATE no registro original alterando status = 'MOBILIZADO', id_rtd_saida, data_saida_oficial e deposito_destino
          const { error } = await supabase
            .from('fluxo_oficina')
            .update({
              status: 'MOBILIZADO',
              id_rtd_saida: rtdSaidaTrim,
              data_saida_oficial: dataSaidaIso,
              deposito_destino: destinoTrim,
            })
            .eq('id', item.id);

          if (error) throw error;
        } else {
          // Transferência Parcial:
          // A) UPDATE no registro original, subtraindo a quantidade enviada
          const novaQtdRestante = qtdAtual - qtdEnviar;
          const { error: errorUpdate } = await supabase
            .from('fluxo_oficina')
            .update({
              quantidade: novaQtdRestante,
              status: item.status, // Mantém como 'DISPONÍVEL'
            })
            .eq('id', item.id);

          if (errorUpdate) throw errorUpdate;

          // B) INSERT de um novo registro (clonando os dados da TAG original)
          const clonedRecord: FluxoOficinaItem = {
            id: crypto.randomUUID(),
            tag: item.tag,
            nm: item.nm || 'N/A',
            descricao: item.descricao,
            st: item.st || '',
            quantidade: qtdEnviar,
            oficina_destino: item.oficina_destino || 'Eletrônica',
            id_rtd_ida: item.id_rtd_ida || '',
            data_emissao_ida: item.data_emissao_ida,
            data_entrada_oficina: item.data_entrada_oficina,
            data_inspecao: item.data_inspecao,
            status: 'MOBILIZADO',
            id_rtd_saida: rtdSaidaTrim,
            data_saida_oficial: dataSaidaIso,
            deposito_destino: destinoTrim,
          };

          const { error: errorInsert } = await supabase
            .from('fluxo_oficina')
            .insert([clonedRecord]);

          if (errorInsert) throw errorInsert;
        }
      }

      alert(`Saída registrada com sucesso para ${selectedList.length} equipamento(s) / lote(s)! (RTD: ${rtdSaidaTrim} | Destino: ${destinoTrim})`);
      setIsSaidaModalOpen(false);
      setSelectedItems([]);
      fetchItems();
    } catch (err: any) {
      console.error('Erro ao registrar saída:', err);
      setModalErro({
        isOpen: true,
        titulo: 'Erro ao Registrar Saída',
        mensagem: err?.message || 'Falha ao gravar saída de equipamentos no banco de dados.'
      });
    } finally {
      setLoading(false);
    }
  };

  const calcularSLA = (dataIda?: string | null, dataFim?: string | null, status?: string) => {
    if (!dataIda) return 0;
    const inicio = new Date(dataIda); // Usa a data do documento de Ida
    const fim = (status !== 'Em Inspeção' && dataFim) ? new Date(dataFim) : new Date(); // Se não tem atualização, usa hoje
    const diffTime = Math.abs(fim.getTime() - inicio.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  const getLocalizacaoAtual = (item: FluxoOficinaItem): string => {
    if (item.status === 'Em Inspeção') {
      return item.oficina_destino ? `Oficina (${item.oficina_destino})` : 'Oficina (Alumar)';
    }
    if (item.status.includes('Disponível') || item.status.includes('Reprovada')) {
      return 'Depósito 50x';
    }
    if (item.status.includes('Mobilizado')) {
      return item.deposito_destino || 'Obra Externa';
    }
    if (item.status.includes('Desmobilizado')) {
      return 'SEDE';
    }
    return item.deposito_destino || 'Central';
  };

  // Dynamic filter values
  const uniqueLocations = useMemo(() => {
    const locs = items
      .map(i => i.deposito_destino)
      .filter((loc): loc is string => Boolean(loc && loc.trim().length > 0));
    return Array.from(new Set(locs));
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Free text search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTag = item.tag?.toLowerCase().includes(term);
        const matchDesc = item.descricao?.toLowerCase().includes(term);
        const matchSt = item.st?.toLowerCase().includes(term);
        const matchNm = item.nm?.toLowerCase().includes(term);
        const matchIda = item.id_rtd_ida?.toLowerCase().includes(term);
        const matchSaida = item.id_rtd_saida?.toLowerCase().includes(term);
        if (!matchTag && !matchDesc && !matchSt && !matchNm && !matchIda && !matchSaida) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'Todos') {
        if (statusFilter === 'Em Inspeção' && item.status !== 'Em Inspeção') return false;
        if (statusFilter === 'Disponível para atendimento' && !item.status.includes('Disponível')) return false;
        if (statusFilter === 'Reprovada' && !item.status.includes('Reprovada')) return false;
        if (statusFilter === 'Mobilizado para Obra' && !item.status.includes('Mobilizado')) return false;
        if (statusFilter === 'Desmobilizado para SEDE' && !item.status.includes('Desmobilizado')) return false;
      }

      // Location Filter
      if (locationFilter !== 'Todos') {
        if (item.deposito_destino !== locationFilter) return false;
      }

      // Date Range Filter
      if (startDateFilter || endDateFilter) {
        let targetDateStr: string | null = null;
        if (dateTypeFilter === 'ida') targetDateStr = item.data_emissao_ida || item.data_entrada_oficina;
        else if (dateTypeFilter === 'inspecao') targetDateStr = item.data_inspecao;
        else if (dateTypeFilter === 'saida') targetDateStr = item.data_saida_oficial;

        if (!targetDateStr) return false;
        const itemDate = new Date(targetDateStr).getTime();

        if (startDateFilter) {
          const startMs = new Date(startDateFilter + 'T00:00:00').getTime();
          if (itemDate < startMs) return false;
        }
        if (endDateFilter) {
          const endMs = new Date(endDateFilter + 'T23:59:59').getTime();
          if (itemDate > endMs) return false;
        }
      }

      return true;
    });
  }, [items, searchTerm, statusFilter, locationFilter, dateTypeFilter, startDateFilter, endDateFilter]);

  // Grouped items by ST + Data de Ida (Agrupamento Dinâmico Master-Detail)
  const groupedByStItems = useMemo(() => {
    if (!groupBySt) return [];

    const map = filteredItems.reduce((acc, item) => {
      const hasSt = item.st && item.st.trim().length > 0 && !/^0+$/.test(item.st.trim());
      const stVal = hasSt ? item.st.trim() : 'Sem ST';
      
      const rawData = item.data_emissao_ida || item.data_entrada_oficina;
      const dataIdaKey = rawData ? rawData.split('T')[0] : 'Sem Data';

      const key = `${stVal}_${dataIdaKey}`;

      if (!acc[key]) {
        acc[key] = {
          key,
          stDisplay: hasSt ? item.st.trim() : null,
          dataEmissaoIda: rawData,
          items: [],
        };
      }
      acc[key].items.push(item);
      return acc;
    }, {} as Record<string, { key: string; stDisplay: string | null; dataEmissaoIda: string | null; items: FluxoOficinaItem[] }>);

    return Object.values(map).map(group => {
      const totalQuantity = group.items.reduce((sum, item) => sum + (Number(item.quantidade) || 1), 0);
      const firstItem = group.items[0];

      // Status Consolidado
      const statuses = Array.from(new Set(group.items.map(i => i.status)));
      const statusConsolidado = statuses.length === 1 ? statuses[0] : 'Status Misto';

      // Localização Consolidada
      const locations = Array.from(new Set(group.items.map(i => getLocalizacaoAtual(i))));
      const localizacaoConsolidada = locations.length === 1 ? locations[0] : 'Várias Localizações';

      // Descrição Consolidada
      const descriptions = Array.from(new Set(group.items.map(i => i.descricao).filter(Boolean)));
      const descricaoConsolidada = descriptions.join(' / ') || 'Sem descrição';

      // NM Consolidado
      const nms = Array.from(new Set(group.items.map(i => i.nm).filter(Boolean)));
      const nmConsolidado = nms.join(', ');

      // RTDs
      const rtdsIda = Array.from(new Set(group.items.map(i => i.id_rtd_ida).filter(Boolean))).join(', ');
      const rtdsSaida = Array.from(new Set(group.items.map(i => i.id_rtd_saida).filter(Boolean))).join(', ');

      return {
        key: group.key,
        stDisplay: group.stDisplay,
        dataEmissaoIda: group.dataEmissaoIda,
        items: group.items,
        totalQuantity,
        firstItem,
        statusConsolidado,
        localizacaoConsolidada,
        descricaoConsolidada,
        nmConsolidado,
        rtdsIda,
        rtdsSaida,
      };
    });
  }, [filteredItems, groupBySt]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('Todos');
    setLocationFilter('Todos');
    setDateTypeFilter('ida');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  const inInspectionCount = items.filter(i => i.status === 'Em Inspeção').length;
  const availableCount = items.filter(i => i.status && (i.status.toLowerCase().includes('disponív') || i.status.toLowerCase().includes('disponiv'))).length;
  const rejectedCount = items.filter(i => i.status && i.status.toLowerCase().includes('reprovad')).length;
  const dispatchedCount = items.filter(i => i.status && (i.status.toLowerCase().includes('mobiliz') || i.status === 'MOBILIZADO' || i.status.toLowerCase().includes('desmobiliz'))).length;

  const hasActiveFilters = Boolean(
    searchTerm || statusFilter !== 'Todos' || locationFilter !== 'Todos' || startDateFilter || endDateFilter
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBackToHub}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            title="Voltar ao Hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Fluxo de Oficina Central</h1>
            <p className="text-xs text-slate-500">Gestão, inspeção e disponibilidade de equipamentos Alumar</p>
          </div>

          {/* Abas de Navegação interna do Módulo */}
          <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 ml-2">
            <button
              onClick={() => setActiveModuleView('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all ${
                activeModuleView === 'dashboard'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard Gerencial</span>
            </button>
            <button
              onClick={() => setActiveModuleView('tabela')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all ${
                activeModuleView === 'tabela'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Gestão Tabela & RTDs</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Versão Mobile do Toggle */}
          <div className="flex sm:hidden items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full mb-1">
            <button
              onClick={() => setActiveModuleView('dashboard')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold text-xs ${
                activeModuleView === 'dashboard' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveModuleView('tabela')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold text-xs ${
                activeModuleView === 'tabela' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Tabela
            </button>
          </div>

          <button
            onClick={() => setIsNovoItemModalOpen(true)}
            className="flex items-center gap-2 bg-slate-800 text-white px-3.5 py-2 rounded-xl font-semibold text-xs hover:bg-slate-900 cursor-pointer shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            + NOVO ITEM / LOTE
          </button>
          <label className="flex items-center gap-2 bg-indigo-600 text-white px-3.5 py-2 rounded-xl font-semibold text-xs hover:bg-indigo-700 cursor-pointer shadow-2xs transition-colors">
            <UploadCloud className="w-4 h-4" />
            + IMPORTAR RTD IDA
            <input type="file" className="hidden" accept=".pdf" onChange={handleImportRtdIda} />
          </label>
          <label className="flex items-center gap-2 bg-teal-600 text-white px-3.5 py-2 rounded-xl font-semibold text-xs hover:bg-teal-700 cursor-pointer shadow-2xs transition-colors">
            <UploadCloud className="w-4 h-4" />
            + IMPORTAR RTD SAÍDA
            <input type="file" className="hidden" accept=".pdf" onChange={handleImportRtdSaida} />
          </label>
          <button
            onClick={handleAbrirModalSaida}
            disabled={selectedItems.length === 0}
            className="flex items-center gap-2 bg-emerald-600 text-white px-3.5 py-2 rounded-xl font-semibold text-xs hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
            title={selectedItems.length === 0 ? "Selecione equipamentos na tabela para registrar a saída" : "Registrar saída dos equipamentos selecionados"}
          >
            <Truck className="w-4 h-4" />
            REGISTRAR SAÍDA {selectedItems.length > 0 ? `(${selectedItems.length})` : ''}
          </button>
        </div>
      </header>

      <main className="flex-grow p-6 max-w-[1600px] mx-auto w-full space-y-6">
        {activeModuleView === 'dashboard' ? (
          <FluxoOficinaDashboard
            items={items}
            loading={loading}
            onRefresh={fetchItems}
            onSwitchToTable={() => setActiveModuleView('tabela')}
            onBackToHub={onBackToHub}
          />
        ) : (
          <>
        
        {dbError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-rose-950">Erro de Banco de Dados</h2>
                <p className="text-sm text-rose-800/80 mt-1 mb-4">{dbError}</p>
                <div className="bg-white/50 p-4 rounded-xl border border-rose-100 overflow-x-auto">
                  <pre className="text-xs font-mono text-slate-700">
{`CREATE TABLE fluxo_oficina (
  id UUID PRIMARY KEY,
  tag TEXT UNIQUE,
  nm TEXT,
  descricao TEXT,
  st TEXT,
  id_rtd_ida TEXT,
  data_emissao_ida TIMESTAMPTZ,
  data_entrada_oficina TIMESTAMPTZ,
  status TEXT,
  data_inspecao TIMESTAMPTZ,
  id_rtd_saida TEXT,
  data_saida_oficial TIMESTAMPTZ,
  deposito_destino TEXT
);`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-500" />
              Em Inspeção
            </div>
            <div className="text-3xl font-black text-slate-800">{inInspectionCount}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Disponíveis
            </div>
            <div className="text-3xl font-black text-slate-800">{availableCount}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Reprovados Retidos
            </div>
            <div className="text-3xl font-black text-slate-800">{rejectedCount}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
              <Archive className="w-4 h-4 text-blue-500" />
              Saídas
            </div>
            <div className="text-3xl font-black text-slate-800">{dispatchedCount}</div>
          </div>
        </div>

        {/* Componente <FilterBar/> */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <Filter className="w-4 h-4 text-indigo-600" />
              Filtros de Busca e Monitoramento
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-rose-600 font-bold hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar Filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Pesquisar por TAG, Descrição, NM, ST ou RTD..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown de Status */}
            <div className="lg:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium cursor-pointer"
              >
                <option value="Todos">Status: Todos</option>
                <option value="Em Inspeção">Em Inspeção</option>
                <option value="Disponível para atendimento">Disponível para atendimento</option>
                <option value="Reprovada">Reprovada na Inspeção</option>
                <option value="Mobilizado para Obra">Mobilizado para Obra</option>
                <option value="Desmobilizado para SEDE">Desmobilizado para SEDE</option>
              </select>
            </div>

            {/* Dropdown de Localização */}
            <div className="lg:col-span-3">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium cursor-pointer"
              >
                <option value="Todos">Localização Destino: Todos</option>
                {uniqueLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            {/* Seleção do Tipo de Data */}
            <div className="lg:col-span-2">
              <select
                value={dateTypeFilter}
                onChange={(e) => setDateTypeFilter(e.target.value as any)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 font-medium cursor-pointer"
              >
                <option value="ida">Data: Emissão Ida</option>
                <option value="inspecao">Data: Inspeção</option>
                <option value="saida">Data: Saída / Mobilização</option>
              </select>
            </div>
          </div>

          {/* Filtros de Intervalo de Data */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider shrink-0">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Período:
            </div>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-400">até</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Toolbar de Ações */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap justify-between items-center gap-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
            <span className="bg-slate-100 px-3 py-1 rounded-lg text-slate-800 font-bold text-xs">
              {groupBySt 
                ? `${groupedByStItems.length} grupo(s) por ST (${filteredItems.length} itens)` 
                : `${filteredItems.length} de ${items.length} itens exibidos`}
            </span>
            {selectedItems.length > 0 && (
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg font-bold text-xs">
                {selectedItems.length} selecionados
              </span>
            )}

            {/* Switch / Toggle "Agrupar por ST (Visão de Lote)" */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <button
                type="button"
                onClick={() => setGroupBySt(!groupBySt)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  groupBySt ? 'bg-blue-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={groupBySt}
                title="Alternar entre Visão Individual por TAG e Visão de Lote por ST"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    groupBySt ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span 
                onClick={() => setGroupBySt(!groupBySt)} 
                className={`text-xs font-bold cursor-pointer select-none ${
                  groupBySt ? 'text-blue-700' : 'text-slate-600'
                }`}
              >
                Agrupar por ST (Visão de Lote)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const pendingSelected = items.filter(
                item => selectedItems.includes(item.id) && (!item.st || item.st.trim() === '' || /^0+$/.test(item.st.trim()))
              ).length;

              return pendingSelected > 0 ? (
                <button
                  onClick={handleOpenBulkStModal}
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>ATRIBUIR ST EM LOTE ({pendingSelected})</span>
                </button>
              ) : null;
            })()}
            <button 
              onClick={handleRegistrarRetorno}
              disabled={selectedItems.length === 0}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              REGISTRAR RETORNO DA INSPEÇÃO
            </button>
            <label className="bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-teal-700 cursor-pointer transition-colors shadow-sm flex items-center gap-2">
              <UploadCloud className="w-4 h-4" />
              + IMPORTAR RTD SAÍDA
              <input type="file" className="hidden" accept=".pdf" onChange={handleImportRtdSaida} />
            </label>
            <button
              onClick={handleAbrirModalSaida}
              disabled={selectedItems.length === 0}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
            >
              <Truck className="w-4 h-4" />
              REGISTRAR SAÍDA {selectedItems.length > 0 ? `(${selectedItems.length})` : ''}
            </button>
          </div>
        </div>

        {/* Redesigned Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-black text-slate-500 tracking-wider">
                <tr>
                  <th className="px-5 py-4 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems(filteredItems.map(i => i.id));
                        } else {
                          setSelectedItems([]);
                        }
                      }}
                      checked={
                        filteredItems.length > 0 && 
                        filteredItems.every(i => selectedItems.includes(i.id))
                      }
                    />
                  </th>
                  <th className="px-5 py-4 w-52">Identificação</th>
                  <th className="px-5 py-4 max-w-xs">Equipamento</th>
                  <th className="px-5 py-4 w-52">Status & SLA</th>
                  <th className="px-5 py-4 w-60">Timeline (Datas & RTDs)</th>
                  <th className="px-5 py-4 w-48">Localização Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Carregando equipamentos...</td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      Nenhum equipamento encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : groupBySt ? (
                  /* Modo Planilha (Agrupamento Dinâmico Master-Detail por ST e Data de Ida) */
                  groupedByStItems.map((group) => {
                    const groupInInspection = group.items.filter(i => i.status === 'Em Inspeção');
                    const isAllGroupSelected = group.items.length > 0 && group.items.every(i => selectedItems.includes(i.id));
                    const isExpanded = !!expandedGroupKeys[group.key];

                    return (
                      <React.Fragment key={group.key}>
                        <tr 
                          className={`hover:bg-blue-50/40 transition-colors ${isAllGroupSelected ? 'bg-indigo-50/40' : ''}`}
                        >
                          {/* Checkbox em Lote */}
                          <td className="px-5 py-4">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              checked={isAllGroupSelected}
                              onChange={(e) => {
                                const groupItemIds = group.items.map(i => i.id);
                                if (e.target.checked) {
                                  setSelectedItems(prev => Array.from(new Set([...prev, ...groupItemIds])));
                                } else {
                                  setSelectedItems(prev => prev.filter(id => !groupItemIds.includes(id)));
                                }
                              }}
                            />
                          </td>

                          {/* Identificação: Chevron + ST + Badge Total QTD */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => toggleGroupExpand(group.key)}
                                className="p-1 hover:bg-slate-200/80 rounded-lg transition-colors text-slate-600 flex items-center gap-1 cursor-pointer"
                                title={isExpanded ? "Recolher itens do lote" : "Expandir itens do lote"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-indigo-600 font-bold" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-500" />
                                )}
                              </button>
                              <span 
                                onClick={() => toggleGroupExpand(group.key)}
                                className="font-bold text-slate-900 text-sm tracking-tight cursor-pointer hover:text-indigo-600 transition-colors"
                              >
                                {group.stDisplay ? `ST: ${group.stDisplay}` : 'Sem ST'}
                              </span>
                              <span className="inline-flex items-center gap-1 bg-indigo-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs">
                                Total: {group.totalQuantity} item(ns)
                              </span>
                            </div>
                            {group.nmConsolidado && (
                              <div className="text-xs text-slate-500 font-mono mt-1 pl-6">
                                NM: <strong className="text-slate-700">{group.nmConsolidado}</strong>
                              </div>
                            )}
                            {group.firstItem.oficina_destino && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 mt-1 ml-6">
                                Oficina: {group.firstItem.oficina_destino}
                              </span>
                            )}
                          </td>

                          {/* Equipamento (Descrição Consolidada) */}
                          <td className="px-5 py-4">
                            <div 
                              className="font-medium text-slate-800 text-xs line-clamp-2 leading-relaxed" 
                              title={group.descricaoConsolidada}
                            >
                              {group.descricaoConsolidada}
                            </div>
                          </td>

                          {/* Status & SLA Consolidado */}
                          <td className="px-5 py-4">
                            <div className="space-y-1.5">
                              <div>
                                {group.statusConsolidado === 'Status Misto' ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
                                      <RefreshCw className="w-3 h-3 text-purple-600" />
                                      Status Misto
                                    </span>
                                    <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5 flex-wrap">
                                      {(() => {
                                        const mob = group.items.filter(i => i.status && (i.status.toLowerCase().includes('mobiliz') || i.status === 'MOBILIZADO')).length;
                                        const insp = group.items.filter(i => i.status === 'Em Inspeção').length;
                                        const disp = group.items.filter(i => i.status && i.status.toLowerCase().includes('disponív')).length;
                                        const parts = [];
                                        if (mob > 0) parts.push(`${mob} Saído(s)`);
                                        if (insp > 0) parts.push(`${insp} Em Inspeção`);
                                        if (disp > 0) parts.push(`${disp} Disponível`);
                                        return parts.join(' • ');
                                      })()}
                                    </div>
                                  </div>
                                ) : (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border shadow-2xs ${
                                    group.statusConsolidado === 'Em Inspeção' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                    group.statusConsolidado.includes('Disponível') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                    group.statusConsolidado.includes('Reprovada') ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                    'bg-blue-50 text-blue-800 border-blue-200'
                                  }`}>
                                    {group.statusConsolidado === 'Em Inspeção' && <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />}
                                    {group.statusConsolidado.includes('Disponível') && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                    {group.statusConsolidado.includes('Reprovada') && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                                    {group.statusConsolidado.includes('Mobilizado') && <Archive className="w-3 h-3 text-blue-600" />}
                                    {group.statusConsolidado}
                                  </span>
                                )}
                              </div>

                              {group.statusConsolidado === 'Em Inspeção' && (
                                <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-100 w-fit">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>SLA: {calcularSLA(group.firstItem.data_emissao_ida, group.firstItem.data_inspecao, group.statusConsolidado)} dias</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Timeline (Data de Ida & RTDs) */}
                          <td className="px-5 py-4">
                            <div className="text-xs space-y-1 text-slate-600 font-sans">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-400 w-16 shrink-0">Data Ida:</span>
                                <span className="font-bold text-slate-900">{formatDate(group.dataEmissaoIda || group.firstItem.data_emissao_ida || group.firstItem.data_entrada_oficina)}</span>
                                {group.rtdsIda && (
                                  <span className="text-[10px] font-mono text-slate-400">({group.rtdsIda})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-400 w-16 shrink-0">Retorno:</span>
                                <span className="font-medium text-slate-700">{formatDate(group.firstItem.data_inspecao)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-400 w-16 shrink-0">Saída:</span>
                                <span className="font-medium text-slate-700">{formatDate(group.firstItem.data_saida_oficial)}</span>
                                {group.rtdsSaida && (
                                  <span className="text-[10px] font-mono text-slate-400">({group.rtdsSaida})</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Localização Atual Consolidada */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span 
                                className={`font-bold px-2.5 py-1 rounded-lg border inline-block whitespace-normal break-words text-center min-w-[120px] text-xs leading-tight ${
                                  group.localizacaoConsolidada === 'Várias Localizações'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-100 text-slate-800 border-slate-200'
                                }`} 
                                title={group.localizacaoConsolidada}
                              >
                                {group.localizacaoConsolidada}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Nível Detalhe (Expanded Content) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 border-b-2 border-indigo-200">
                            <td colSpan={6} className="px-4 py-3 sm:pl-10">
                              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                                <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-indigo-600" />
                                    <span>Itens Detalhados do Lote ST #{group.stDisplay || 'Sem ST'} ({group.items.length} registro(s))</span>
                                  </div>
                                  <span className="text-slate-500 font-mono text-[11px]">
                                    Data de Ida: <strong>{formatDate(group.dataEmissaoIda)}</strong>
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100">
                                    <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                                      <tr>
                                        <th className="px-3 py-2 w-8"></th>
                                        <th className="px-3 py-2">TAG Gerada</th>
                                        <th className="px-3 py-2">NM</th>
                                        <th className="px-3 py-2">Descrição do Material</th>
                                        <th className="px-3 py-2 text-center">Qtd</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Localização</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {group.items.map((childItem) => {
                                        const isEmInspecao = childItem.status === 'Em Inspeção';
                                        const isChildSelected = selectedItems.includes(childItem.id);
                                        return (
                                          <tr key={childItem.id} className={`hover:bg-indigo-50/30 transition-colors ${isChildSelected ? 'bg-indigo-50/40' : ''}`}>
                                            <td className="px-3 py-2.5">
                                              <input
                                                type="checkbox"
                                                checked={isChildSelected}
                                                onChange={(e) => {
                                                  if (e.target.checked) {
                                                    setSelectedItems(prev => [...prev, childItem.id]);
                                                  } else {
                                                    setSelectedItems(prev => prev.filter(id => id !== childItem.id));
                                                  }
                                                }}
                                                className="rounded border-slate-300 w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                              />
                                            </td>
                                            <td className="px-3 py-2.5 font-bold font-mono text-slate-900 text-xs">
                                              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                {childItem.tag}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2.5 font-mono text-slate-700 font-semibold">
                                              {childItem.nm || 'N/A'}
                                            </td>
                                            <td className="px-3 py-2.5 font-medium text-slate-800">
                                              {childItem.descricao || 'Sem descrição'}
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-bold text-indigo-600">
                                              <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-extrabold border border-blue-200">
                                                {childItem.quantidade || 1}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                                childItem.status === 'Em Inspeção' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                                childItem.status?.includes('Disponível') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                                childItem.status?.includes('Reprovada') ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                                'bg-blue-50 text-blue-800 border-blue-200'
                                              }`}>
                                                {childItem.status}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-slate-600 font-medium">
                                              {getLocalizacaoAtual(childItem)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  /* Modo Normal (Visão por TAG individual) */
                  filteredItems.map((item) => {
                  const isEmInspecao = item.status === 'Em Inspeção';
                  const localizacao = getLocalizacaoAtual(item);
                  const daysSla = calcularSLA(item.data_emissao_ida || item.data_entrada_oficina, item.data_inspecao, item.status);

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${selectedItems.includes(item.id) ? 'bg-indigo-50/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-5 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={selectedItems.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(prev => [...prev, item.id]);
                            } else {
                              setSelectedItems(prev => prev.filter(id => id !== item.id));
                            }
                          }}
                        />
                      </td>

                      {/* Identificação (TAG / NM / ST / QTD) */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm tracking-tight">{item.tag}</span>
                          {(item.quantidade && item.quantidade > 1) ? (
                            <span className="inline-flex items-center bg-blue-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-2xs">
                              QTD: {item.quantidade}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-slate-500 font-mono">
                            NM: <strong className="text-slate-700">{item.nm || 'N/A'}</strong>
                          </span>
                          {(!item.st || item.st.trim() === '' || /^0+$/.test(item.st.trim())) ? (
                            <button
                              onClick={() => handleOpenSingleStModal(item)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs"
                              title="Clique para cadastrar o número da ST"
                            >
                              <Pencil className="w-3 h-3 text-rose-500" />
                              <span>Inserir ST</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenSingleStModal(item)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                              title="Clique para editar o número da ST"
                            >
                              <span>ST: {item.st}</span>
                              <Pencil className="w-2.5 h-2.5 text-slate-400" />
                            </button>
                          )}
                          {item.oficina_destino && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Oficina: {item.oficina_destino}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Equipamento (Descrição) */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span 
                            className="font-medium text-slate-800 text-xs line-clamp-2 leading-relaxed" 
                            title={item.descricao}
                          >
                            {item.descricao || 'Sem descrição'}
                          </span>
                          {(item.quantidade && item.quantidade > 1) ? (
                            <span className="inline-flex items-center bg-blue-100 text-blue-800 border border-blue-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md shrink-0">
                              QTD: {item.quantidade}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Status & SLA */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          <div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border shadow-2xs ${
                              item.status === 'Em Inspeção' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              item.status.includes('Disponível') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              item.status.includes('Reprovada') ? 'bg-rose-50 text-rose-800 border-rose-200' :
                              'bg-blue-50 text-blue-800 border-blue-200'
                            }`}>
                              {item.status === 'Em Inspeção' && <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />}
                              {item.status.includes('Disponível') && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              {item.status.includes('Reprovada') && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                              {item.status.includes('Mobilizado') && <Archive className="w-3 h-3 text-blue-600" />}
                              {item.status}
                            </span>
                          </div>

                          {isEmInspecao && (
                            <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-100 w-fit">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>SLA: {calcularSLA(item.data_emissao_ida, item.data_inspecao, item.status)} dias</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Timeline (Datas & RTDs) */}
                      <td className="px-5 py-4">
                        <div className="text-xs space-y-1 text-slate-600 font-sans">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 w-16 shrink-0">Ida:</span>
                            <span className="font-semibold text-slate-800">{formatDate(item.data_emissao_ida || item.data_entrada_oficina)}</span>
                            {item.id_rtd_ida && (
                              <span className="text-[10px] font-mono text-slate-400">({item.id_rtd_ida})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 w-16 shrink-0">Retorno:</span>
                            <span className="font-medium text-slate-700">{formatDate(item.data_inspecao)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-400 w-16 shrink-0">Saída:</span>
                            <span className="font-medium text-slate-700">{formatDate(item.data_saida_oficial)}</span>
                            {item.id_rtd_saida && (
                              <span className="text-[10px] font-mono text-slate-400">({item.id_rtd_saida})</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Localização Atual */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block whitespace-normal break-words text-center min-w-[120px] text-xs leading-tight" title={localizacao}>
                            {localizacao}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>

      </>
        )}
      </main>

      {/* Modal Data Retorno */}
      {modalRetorno.isOpen && (() => {
        const selectedList = items.filter(
          item => selectedItems.includes(item.id) && item.status === 'Em Inspeção'
        );
        const totalQtd = selectedList.reduce(
          (acc, item) => acc + (Number(item.quantidade) || 1),
          0
        );
        const singleItem = selectedList.length === 1 ? selectedList[0] : null;
        const sumInputs = modalRetorno.qtdAprovada + modalRetorno.qtdReprovada;
        const qtdPendente = totalQtd - sumInputs;
        const isExceeded = sumInputs > totalQtd;
        const isZeroReturn = sumInputs === 0;
        const isValidReturn = !isExceeded && !isZeroReturn;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-600" />
                  Registrar Retorno de Inspeção
                </h3>
                <button
                  onClick={() => setModalRetorno({ ...modalRetorno, isOpen: false })}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Resumo do Registro Selecionado */}
                {singleItem ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">TAG: {singleItem.tag}</span>
                      <span className="bg-blue-100 text-blue-800 font-extrabold px-2.5 py-0.5 rounded-full text-xs">
                        QTD TOTAL: {totalQtd}
                      </span>
                    </div>
                    <div className="text-slate-600 font-medium">
                      <strong>Equipamento:</strong> {singleItem.descricao || 'N/A'}
                    </div>
                    {singleItem.st && (
                      <div className="text-slate-500 font-mono text-[11px]">
                        ST / RM: <strong>{singleItem.st}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      {selectedList.length} registro(s) selecionado(s) em inspeção
                    </span>
                    <span className="bg-blue-100 text-blue-800 font-extrabold px-2.5 py-0.5 rounded-full text-xs">
                      QTD TOTAL: {totalQtd}
                    </span>
                  </div>
                )}

                {/* Input Data do Retorno */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Data do Retorno (Físico)
                  </label>
                  <input
                    type="date"
                    value={modalRetorno.dataRetorno}
                    onChange={(e) => setModalRetorno({ ...modalRetorno, dataRetorno: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Grid de Inputs para Qtd Aprovada e Qtd Reprovada */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-1.5">
                    <label className="text-xs font-bold text-emerald-900 block">
                      Qtd Aprovada
                    </label>
                    <span className="text-[10px] text-emerald-700 font-medium block">
                      (Item disponível para uso)
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={totalQtd}
                      value={modalRetorno.qtdAprovada}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setModalRetorno({
                          ...modalRetorno,
                          qtdAprovada: Math.max(0, val),
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm font-black text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 space-y-1.5">
                    <label className="text-xs font-bold text-rose-900 block">
                      Qtd Condenada / Retida
                    </label>
                    <span className="text-[10px] text-rose-700 font-medium block">
                      (Item reprovado pela oficina)
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={totalQtd}
                      value={modalRetorno.qtdReprovada}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setModalRetorno({
                          ...modalRetorno,
                          qtdReprovada: Math.max(0, val),
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-sm font-black text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Validação de Soma */}
                {isExceeded ? (
                  <div className="bg-rose-100 border border-rose-300 text-rose-900 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      A soma das quantidades aprovadas e reprovadas ({sumInputs}) excede o total ({totalQtd}). Por favor, ajuste os valores.
                    </span>
                  </div>
                ) : isZeroReturn ? (
                  <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      Informe ao menos 1 item aprovado ou condenado para registrar o retorno.
                    </span>
                  </div>
                ) : null}

                <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-xl text-xs flex justify-around font-bold text-slate-700 text-center">
                  <div>Total: <span className="text-slate-900 font-extrabold">{totalQtd}</span></div>
                  <div>Aprovados: <span className="text-emerald-700 font-black">{modalRetorno.qtdAprovada}</span></div>
                  <div>Reprovados: <span className="text-rose-700 font-black">{modalRetorno.qtdReprovada}</span></div>
                  <div>Pendentes (Oficina): <span className="text-amber-700 font-black">{qtdPendente}</span></div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setModalRetorno({ ...modalRetorno, isOpen: false })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRetorno}
                  disabled={!isValidReturn || loading}
                  className="px-5 py-2 rounded-xl text-xs bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex items-center gap-2"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar Retorno
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Preview de Importação */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Revisão de Importação (RTD)
              </h3>
              <button 
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewItems([]);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              <div className="space-y-4">
                {previewItems.map((item, index) => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 relative group">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-1 rounded-lg">
                        Item {index + 1}
                      </span>
                      <button
                        onClick={() => handleRemovePreviewItem(index)}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        title="Remover Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">NM</label>
                        <input
                          type="text"
                          value={item.nm}
                          placeholder="Ex: 123456"
                          onChange={(e) => handleUpdatePreviewItem(index, 'nm', e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-mono text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">TAG Física (Opcional)</label>
                        <input
                          type="text"
                          value={item.tag}
                          placeholder="Vazio = Lote"
                          onChange={(e) => handleUpdatePreviewItem(index, 'tag', e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-mono text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ST (RM)</label>
                        <input
                          type="text"
                          value={item.st || ''}
                          placeholder="Ex: 9876543"
                          onChange={(e) => handleUpdatePreviewItem(index, 'st', e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-mono text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quantidade</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantidade ?? 1}
                          onChange={(e) => handleUpdatePreviewItem(index, 'quantidade', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-mono text-slate-900 font-bold"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição</label>
                        <input
                          type="text"
                          value={item.descricao}
                          placeholder="Descrição do equipamento..."
                          onChange={(e) => handleUpdatePreviewItem(index, 'descricao', e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <button
                onClick={handleAddPreviewItem}
                className="mt-6 flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold text-xs hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
              >
                <Plus className="w-4 h-4" />
                Adicionar Item Manualmente
              </button>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewItems([]);
                }}
                className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPreview}
                disabled={previewItems.length === 0}
                className="px-6 py-2 text-xs bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex items-center gap-2"
              >
                Confirmar Importação ({previewItems.length} itens)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Complemento RTD Ida (Seleção de Oficina & ST) */}
      {isSelectOficinaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-600" />
                Complemento de Dados da RTD ({pendingIdaItems.length} item(ns))
              </h3>
              <button 
                onClick={() => {
                  setIsSelectOficinaModalOpen(false);
                  setPendingIdaItems([]);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Campo Dinâmico de ST */}
              {!stEncontradaNoDocumento ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                  <label className="text-xs font-bold text-amber-900 block leading-snug">
                    A RTD não possui número de ST. Você pode inserir agora ou deixar em branco para preencher posteriormente.
                  </label>
                  <input
                    type="text"
                    value={inputStManual}
                    onChange={(e) => setInputStManual(e.target.value)}
                    placeholder="Ex: 12345678 (Opcional)"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 font-medium">
                  Número da ST detectado na RTD: <strong className="text-slate-900 font-mono text-sm">{stEncontradaNoDocumento}</strong>
                </div>
              )}

              {/* Seleção de Oficina Destino */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Selecione a Oficina de Destino:
                </label>
                <div className="space-y-2">
                  {['Eletrônica', 'Mecânica', '112Y'].map((oficina) => (
                    <label
                      key={oficina}
                      onClick={() => setSelectedOficina(oficina)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedOficina === oficina
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="text-xs font-semibold">{oficina}</span>
                      <input
                        type="radio"
                        name="oficina"
                        value={oficina}
                        checked={selectedOficina === oficina}
                        onChange={() => setSelectedOficina(oficina)}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsSelectOficinaModalOpen(false);
                  setPendingIdaItems([]);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarImportacaoIda}
                disabled={loading}
                className="px-5 py-2 text-xs bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex items-center gap-2"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Conferencia Modal */}
      {isConferenciaModalOpen && conferenciaData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Conferência de Expedição</h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-slate-600">
                  <span className="font-mono bg-white px-2 py-1 rounded border border-slate-200">{conferenciaData.idRtdSaida}</span>
                  <span>Destino: <strong>{conferenciaData.depositoDestino}</strong></span>
                </div>
              </div>
              <button 
                onClick={() => setIsConferenciaModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                ✕
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              {/* Alerta de 1 item válido */}
              {conferenciaData.validas.length === 1 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-amber-900">ATENÇÃO</h3>
                    <p className="text-amber-800 text-sm">Apenas 1 TAG deste documento está disponível para mobilização!</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Validas */}
                <div className="border border-emerald-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-200 flex items-center justify-between">
                    <h3 className="font-bold text-emerald-900">Itens Prontos para Saída</h3>
                    <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{conferenciaData.validas.length}</span>
                  </div>
                  <div className="p-4 bg-white flex-grow overflow-y-auto max-h-80 space-y-3">
                    {conferenciaData.validas.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">Nenhum item válido.</p>
                    ) : (
                      conferenciaData.validas.map(item => (
                        <div key={item.tag} className="flex items-center gap-3 p-3 rounded-lg border border-emerald-100 bg-emerald-50/30">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{item.tag}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{item.descricao}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Invalidas */}
                <div className="border border-rose-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="bg-rose-50 px-4 py-3 border-b border-rose-200 flex items-center justify-between">
                    <h3 className="font-bold text-rose-900">Bloqueados / Com Erro</h3>
                    <span className="bg-rose-200 text-rose-800 text-xs font-bold px-2 py-0.5 rounded-full">{conferenciaData.invalidas.length}</span>
                  </div>
                  <div className="p-4 bg-white flex-grow overflow-y-auto max-h-80 space-y-3">
                    {conferenciaData.invalidas.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">Nenhum item bloqueado.</p>
                    ) : (
                      conferenciaData.invalidas.map(inv => (
                        <div key={inv.tag} className="flex items-start gap-3 p-3 rounded-lg border border-rose-100 bg-rose-50/30">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{inv.tag}</div>
                            <div className="text-xs text-rose-600/80 mt-0.5">{inv.motivo}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsConferenciaModalOpen(false)}
                className="px-6 py-2.5 font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarMobilizacao}
                disabled={conferenciaData.validas.length === 0 || loading}
                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                CONFIRMAR MOBILIZAÇÃO DE {conferenciaData.validas.length} ITENS
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Modal Editar ST (Individual e em Lote) */}
      {isEditarStModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                {targetStItemIds.length === 1
                  ? 'Atribuir / Editar ST do Equipamento'
                  : `Atribuir ST para os [${targetStItemIds.length}] equipamentos selecionados`}
              </h3>
              <button
                onClick={() => {
                  setIsEditarStModalOpen(false);
                  setTargetStItemIds([]);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 font-medium">
                {targetStItemIds.length === 1
                  ? 'Informe o número da ST que será associada a este equipamento:'
                  : `Informe o número da ST que será aplicado em lote a todos os ${targetStItemIds.length} equipamentos selecionados:`}
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Número da ST <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={novaStInput}
                  onChange={(e) => setNovaStInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSalvarSt();
                  }}
                  placeholder="Ex: 12345678"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditarStModalOpen(false);
                  setTargetStItemIds([]);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarSt}
                disabled={savingSt || !novaStInput.trim()}
                className="px-5 py-2 text-xs bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex items-center gap-2"
              >
                {savingSt && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Salvar ST
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Item / Lote Manual */}
      {isNovoItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Cadastrar Novo Equipamento / Lote
              </h3>
              <button
                onClick={() => setIsNovoItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Número da ST (RM)
                  </label>
                  <input
                    type="text"
                    value={novoItemForm.st}
                    onChange={(e) => setNovoItemForm({ ...novoItemForm, st: e.target.value })}
                    placeholder="Ex: 8811073"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Quantidade <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={novoItemForm.quantidade}
                    onChange={(e) => setNovoItemForm({ ...novoItemForm, quantidade: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Descrição do Material / Equipamento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={novoItemForm.descricao}
                  onChange={(e) => setNovoItemForm({ ...novoItemForm, descricao: e.target.value })}
                  placeholder="Ex: Cinta de 2 Ton, Cabo de Aço, Furadeira..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    NM Material
                  </label>
                  <input
                    type="text"
                    value={novoItemForm.nm}
                    onChange={(e) => setNovoItemForm({ ...novoItemForm, nm: e.target.value })}
                    placeholder="Ex: 231047"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    TAG Física (Opcional)
                  </label>
                  <input
                    type="text"
                    value={novoItemForm.tagFisica}
                    onChange={(e) => setNovoItemForm({ ...novoItemForm, tagFisica: e.target.value })}
                    placeholder="Se em branco, vira LOTE-${ST}"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 leading-relaxed font-medium">
                💡 <strong>Dica de Rastreio em Lote:</strong> Deixando a TAG Física em branco, o sistema gerará automaticamente a TAG no padrão <code className="bg-blue-100 px-1 py-0.5 rounded font-mono font-bold">LOTE-{novoItemForm.st || '123456'}</code> com a quantidade especificada.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Oficina de Destino
                  </label>
                  <select
                    value={novoItemForm.oficinaDestino}
                    onChange={(e) => setNovoItemForm({ ...novoItemForm, oficinaDestino: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Eletrônica">Eletrônica</option>
                    <option value="Mecânica">Mecânica</option>
                    <option value="112Y">112Y</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nº RTD de Ida (Opcional)
                  </label>
                  <input
                    type="text"
                    value={novoItemForm.idRtdIda}
                    onChange={(e) => setNovoItemForm({ ...novoItemForm, idRtdIda: e.target.value })}
                    placeholder="Ex: RTD-8821"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Data de Ida <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={novoItemForm.dataEmissaoIda}
                    onChange={(e) => setNovoItemForm({ ...novoItemForm, dataEmissaoIda: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsNovoItemModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNovoItem}
                disabled={loading || !novoItemForm.descricao.trim()}
                className="px-5 py-2 text-xs bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex items-center gap-2"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Cadastrar Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Saída Manual de Equipamentos */}
      {isSaidaModalOpen && (() => {
        const selectedList = items.filter(
          item => selectedItems.includes(item.id)
        );

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
              {/* Header do Modal */}
              <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-600" />
                  Registrar Saída de Equipamentos
                </h3>
                <button
                  onClick={() => setIsSaidaModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                {/* Cabeçalho: Número da RTD, Data da Saída e Obra / Frente de Trabalho */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Número da RTD de Saída <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={saidaForm.idRtdSaida}
                      onChange={(e) => setSaidaForm(prev => ({ ...prev, idRtdSaida: e.target.value }))}
                      placeholder="Ex: RTD-8821"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Data da Saída <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={saidaForm.dataSaida}
                      onChange={(e) => setSaidaForm(prev => ({ ...prev, dataSaida: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Obra / Frente de Trabalho <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="obras-saida-list"
                      value={saidaForm.depositoDestino}
                      onChange={(e) => setSaidaForm(prev => ({ ...prev, depositoDestino: e.target.value }))}
                      placeholder="Ex: ALU CAL 31 SLZ 03-26"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <datalist id="obras-saida-list">
                      <option value="ALU CAL 31 SLZ 03-26" />
                      <option value="ALU CALC 2 SLZ 04-26" />
                      <option value="01 - GER ALMOX" />
                      <option value="02 - OBRAS EXTERNAS" />
                      {uniqueLocations.map(loc => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Lista de Itens Selecionados */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Itens Selecionados ({selectedList.length})
                    </h4>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Ajuste a quantidade a enviar para saídas parciais
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {selectedList.map(item => {
                      const qtdAtual = Math.max(1, Number(item.quantidade) || 1);
                      const qtdEnviar = saidaForm.itemQuantidades[item.id] ?? qtdAtual;

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 transition-colors"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs tracking-tight">{item.tag}</span>
                              {item.st && (
                                <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded border border-slate-200">
                                  ST: {item.st}
                                </span>
                              )}
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full">
                                Qtd. Atual: {qtdAtual}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium truncate" title={item.descricao}>
                              {item.descricao || 'Sem descrição'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                            <label className="text-xs font-bold text-slate-700 whitespace-nowrap pl-1">
                              Qtd. a Enviar:
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={qtdAtual}
                              value={qtdEnviar}
                              onChange={(e) => handleUpdateQtdEnviar(item.id, qtdAtual, e.target.value)}
                              className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer do Modal */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setIsSaidaModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmSaidaManual}
                  disabled={loading || selectedList.length === 0 || !saidaForm.idRtdSaida.trim() || !saidaForm.depositoDestino.trim()}
                  className="px-5 py-2 rounded-xl text-xs bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors flex items-center gap-2"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar Saída
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Rejeição de Arquivo / Erro */}
      {modalErro.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-200 space-y-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">
                {modalErro.titulo}
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {modalErro.mensagem}
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setModalErro({ ...modalErro, isOpen: false })}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors tracking-wider"
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
