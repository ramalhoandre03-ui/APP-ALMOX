import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Wrench, 
  Plus, 
  Upload, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Search, 
  Filter, 
  ChevronLeft, 
  FileSpreadsheet, 
  X, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  ArrowLeft,
  Tag,
  Clock,
  Layers,
  FileText,
  User,
  Info,
  Check,
  Calculator,
  Download,
  ArrowLeftRight,
  Zap,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { ObraMedicao, ValorLocacao, MovimentacaoAtivo, ItemMedicaoCalculado } from '../types';
import { consolidarMedicaoMensal, formatCurrencyBRL, calcularDiasMedicao, generateMonthOptions, formatDateBR, sanitizeString, isSameCC } from '../utils/medicaoUtils';
import DashboardBIMedicao from './DashboardBIMedicao';

interface MedicaoPropriosProps {
  onBackToHub: () => void;
  initialTab?: 'obras' | 'bi';
}

export default function MedicaoProprios({ onBackToHub, initialTab }: MedicaoPropriosProps) {
  // Main Navigation State
  const [selectedObra, setSelectedObra] = useState<ObraMedicao | null>(null);
  const [activeTorreTab, setActiveTorreTab] = useState<'obras' | 'bi'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'bi') return 'bi';
      if (tabParam === 'obras') return 'obras';
    } catch (e) {
      console.error(e);
    }
    return initialTab || 'bi';
  });

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'bi') {
        setActiveTorreTab('bi');
      } else if (tabParam === 'obras') {
        setActiveTorreTab('obras');
      } else if (initialTab) {
        setActiveTorreTab(initialTab);
      }
    } catch (e) {
      if (initialTab) setActiveTorreTab(initialTab);
    }
  }, [initialTab]);

  const handleSwitchTab = (tab: 'obras' | 'bi') => {
    setActiveTorreTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url.toString());
    } catch (e) {
      console.error(e);
    }
  };

  // Core Data States
  const [obras, setObras] = useState<ObraMedicao[]>([]);
  const [valoresLocacao, setValoresLocacao] = useState<ValorLocacao[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoAtivo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reference Month State (Default: Current Year and Month YYYY-MM, e.g. "2026-08")
  const [mesAnoRef, setMesAnoRef] = useState<string>(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}`;
  });

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Hub Filters
  const [hubSearch, setHubSearch] = useState('');
  const [showInativas, setShowInativas] = useState(false);

  // Detail Filters
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilterPreco, setDetailFilterPreco] = useState<'TODOS' | 'FALTA_PRECO' | 'COM_PRECO'>('TODOS');

  // Modal States
  const [isNovaObraModalOpen, setIsNovaObraModalOpen] = useState(false);
  const [isEditObraModalOpen, setIsEditObraModalOpen] = useState(false);
  const [editingObra, setEditingObra] = useState<ObraMedicao | null>(null);
  const [isBaseValoresModalOpen, setIsBaseValoresModalOpen] = useState(false);
  const [isImportMobilizacaoModalOpen, setIsImportMobilizacaoModalOpen] = useState(false);
  const [isImportDesmobilizacaoModalOpen, setIsImportDesmobilizacaoModalOpen] = useState(false);
  const [isManualMovModalOpen, setIsManualMovModalOpen] = useState(false);

  // File & Filter States for Base de Valores
  const [selectedValoresFile, setSelectedValoresFile] = useState<File | null>(null);
  const [isImportingValores, setIsImportingValores] = useState(false);
  const [valoresSearch, setValoresSearch] = useState('');
  const valoresFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Temporary Import Classes Ref & State
  // TODO: DELETAR ESTE BOTÃO APÓS A CARGA DE CLASSES
  const [isImportingClasses, setIsImportingClasses] = useState(false);
  const classesFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // File & Importing states for Mobilização
  const [selectedMobFile, setSelectedMobFile] = useState<File | null>(null);
  const [isImportingMob, setIsImportingMob] = useState(false);
  const mobFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // File & Importing states for Desmobilização
  const [selectedDesmobFile, setSelectedDesmobFile] = useState<File | null>(null);
  const [isImportingDesmob, setIsImportingDesmob] = useState(false);
  const desmobFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // File & Importing states for Extrato Global ERP
  const [selectedGlobalFile, setSelectedGlobalFile] = useState<File | null>(null);
  const [isImportingGlobal, setIsImportingGlobal] = useState(false);
  const [isImportGlobalModalOpen, setIsImportGlobalModalOpen] = useState(false);
  const globalFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // File & Importing states for Reaproveitamento
  const [selectedReapFile, setSelectedReapFile] = useState<File | null>(null);
  const [isImportingReap, setIsImportingReap] = useState(false);
  const [isImportReaproveitamentoModalOpen, setIsImportReaproveitamentoModalOpen] = useState(false);
  const reapFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Quick Action Modal ("Inserir Valor") State
  const [quickValorItem, setQuickValorItem] = useState<{ cod_material: string; descricao: string } | null>(null);
  const [quickValorInput, setQuickValorInput] = useState<string>('');

  // Form States
  const [novaObraForm, setNovaObraForm] = useState({
    numero_cc: '',
    nome_obra: '',
    nome_gestor: '',
    data_inicio: new Date().toISOString().split('T')[0],
    status: true
  });

  const [editObraForm, setEditObraForm] = useState({
    id: '',
    numero_cc: '',
    nome_obra: '',
    nome_gestor: '',
    data_inicio: '',
    status: true
  });

  const [novoValorForm, setNovoValorForm] = useState({
    cod_material: '',
    descricao: '',
    valor_mensal: '',
    classe: ''
  });

  const [novaMovForm, setNovaMovForm] = useState({
    tag: '',
    cod_material: '',
    descricao: '',
    data_entrada: new Date().toISOString().split('T')[0],
    data_saida: ''
  });

  // Toast / Alert Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // -------------------------------------------------------------
  // INITIAL DATA FETCHING (Supabase with LocalStorage Fallback)
  // -------------------------------------------------------------
  const fetchObras = async () => {
    try {
      const { data: dbObras, error: errObras } = await supabase
        .from('obras_medicao')
        .select('*')
        .order('created_at', { ascending: false });

      if (!errObras && dbObras) {
        setObras(dbObras);
        localStorage.setItem('obras_medicao', JSON.stringify(dbObras));
      } else {
        const localObras = localStorage.getItem('obras_medicao');
        if (localObras) {
          setObras(JSON.parse(localObras));
        } else {
          setObras([]);
        }
      }
    } catch (error) {
      console.warn('Erro ao buscar obras do Supabase:', error);
    }
  };

  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      try {
        // 1. Obras
        await fetchObras();

        // 2. Valores Locação
        const { data: dbValores, error: errValores } = await supabase
          .from('valores_locacao')
          .select('*')
          .order('cod_material', { ascending: true });

        if (!errValores && dbValores) {
          setValoresLocacao(dbValores);
          localStorage.setItem('valores_locacao', JSON.stringify(dbValores));
        } else {
          const localValores = localStorage.getItem('valores_locacao');
          if (localValores) {
            setValoresLocacao(JSON.parse(localValores));
          } else {
            setValoresLocacao([]);
          }
        }

        // 3. Movimentações
        await fetchMovimentacoes();
      } catch (error) {
        console.warn('Fallback para armazenamento local:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllData();
  }, []);

  // -------------------------------------------------------------
  // HANDLERS FOR OBRAS (CRUD)
  // -------------------------------------------------------------
  const handleSaveNovaObra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaObraForm.numero_cc.trim() || !novaObraForm.nome_obra.trim()) {
      showToast('Preencha os campos obrigatórios (CC e Nome da Obra)', 'error');
      return;
    }

    const payload = {
      numero_cc: sanitizeString(novaObraForm.numero_cc).toUpperCase(),
      nome_obra: sanitizeString(novaObraForm.nome_obra),
      nome_gestor: sanitizeString(novaObraForm.nome_gestor) || 'Não Definido',
      data_inicio: novaObraForm.data_inicio || new Date().toISOString().split('T')[0],
      status: novaObraForm.status
    };

    console.log("Payload enviado ao Supabase (obras_medicao):", payload);

    try {
      const { data, error } = await supabase
        .from('obras_medicao')
        .insert([payload])
        .select();

      if (error) {
        console.error("Erro no Supabase:", error);
        showToast(`Erro ao cadastrar obra: ${error.message}`, 'error');
        return; // Interrompe a execução, não fecha o modal
      }

      console.log("Obra inserida com sucesso no Supabase:", data);
    } catch (err: any) {
      console.error("Exceção ao inserir obra no Supabase:", err);
      showToast(`Erro ao cadastrar obra: ${err?.message || 'Falha inesperada'}`, 'error');
      return; // Interrompe a execução, não fecha o modal
    }

    await fetchObras();

    setIsNovaObraModalOpen(false);
    setNovaObraForm({
      numero_cc: '',
      nome_obra: '',
      nome_gestor: '',
      data_inicio: new Date().toISOString().split('T')[0],
      status: true
    });
    showToast('Nova Obra cadastrada com sucesso!', 'success');
  };

  const handleOpenEditObra = (ob: ObraMedicao, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingObra(ob);
    setEditObraForm({
      id: ob.id,
      numero_cc: ob.numero_cc,
      nome_obra: ob.nome_obra,
      nome_gestor: ob.nome_gestor,
      data_inicio: ob.data_inicio,
      status: ob.status
    });
    setIsEditObraModalOpen(true);
  };

  const handleSaveEditObra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editObraForm.numero_cc.trim() || !editObraForm.nome_obra.trim()) {
      showToast('Preencha os campos obrigatórios (CC e Nome da Obra)', 'error');
      return;
    }

    const payload = {
      numero_cc: sanitizeString(editObraForm.numero_cc).toUpperCase(),
      nome_obra: sanitizeString(editObraForm.nome_obra),
      nome_gestor: sanitizeString(editObraForm.nome_gestor) || 'Não Definido',
      data_inicio: editObraForm.data_inicio || new Date().toISOString().split('T')[0],
      status: editObraForm.status
    };

    try {
      const { error } = await supabase
        .from('obras_medicao')
        .update(payload)
        .eq('id', editObraForm.id);

      if (error) {
        console.error("Erro no Supabase ao atualizar obra:", error);
        showToast(`Erro ao atualizar obra: ${error.message}`, 'error');
        return;
      }
    } catch (err: any) {
      console.error("Exceção ao atualizar obra no Supabase:", err);
      showToast(`Erro ao atualizar obra: ${err?.message || 'Falha inesperada'}`, 'error');
      return;
    }

    await fetchObras();
    setIsEditObraModalOpen(false);
    setEditingObra(null);
    showToast('Obra atualizada com sucesso!', 'success');
  };

  const handleToggleObraStatus = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedStatus = !currentStatus;

    try {
      await supabase.from('obras_medicao').update({ status: updatedStatus }).eq('id', id);
    } catch (err) {
      console.warn('Erro no Supabase update status:', err);
    }

    const updatedList = obras.map(o => o.id === id ? { ...o, status: updatedStatus } : o);
    setObras(updatedList);
    localStorage.setItem('obras_medicao', JSON.stringify(updatedList));

    showToast(`Status da obra atualizado para ${updatedStatus ? 'Ativa' : 'Inativa'}.`, 'info');
  };

  // -------------------------------------------------------------
  // HANDLER FOR QUICK ACTION: "INSERIR VALOR" (FALLBACK RULE)
  // -------------------------------------------------------------
  const handleSaveQuickValor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickValorItem) return;

    const valMensal = parseFloat(quickValorInput.replace(',', '.'));
    if (isNaN(valMensal) || valMensal <= 0) {
      showToast('Informe um valor mensal válido superior a R$ 0,00', 'error');
      return;
    }

    const valDiario = parseFloat((valMensal / 30).toFixed(2));

    const newValorObj: ValorLocacao = {
      cod_material: quickValorItem.cod_material,
      descricao: quickValorItem.descricao || 'Ativo sem descrição',
      valor_mensal: valMensal,
      valor_diario: valDiario,
      created_at: new Date().toISOString()
    };

    // 1. Persist to Supabase
    try {
      await supabase.from('valores_locacao').upsert([newValorObj], { onConflict: 'cod_material' });
    } catch (err) {
      console.warn('Erro ao salvar valor_locacao no Supabase:', err);
    }

    // 2. Update Local State & Storage
    const filtered = valoresLocacao.filter(v => String(v.cod_material).trim().toLowerCase() !== String(quickValorItem.cod_material).trim().toLowerCase());
    const updatedValores = [...filtered, newValorObj];
    setValoresLocacao(updatedValores);
    localStorage.setItem('valores_locacao', JSON.stringify(updatedValores));

    // 3. Reset and recalculate UI
    setQuickValorItem(null);
    setQuickValorInput('');
    showToast(`Preço do material ${newValorObj.cod_material} inserido com sucesso! A medição foi recalculada.`);
  };

  // -------------------------------------------------------------
  // HANDLERS FOR BASE DE VALORES (BULK/MANUAL)
  // -------------------------------------------------------------
  const fetchValoresLocacao = async () => {
    try {
      const { data, error } = await supabase
        .from('valores_locacao')
        .select('*')
        .order('cod_material', { ascending: true });

      if (!error && data) {
        setValoresLocacao(data);
        localStorage.setItem('valores_locacao', JSON.stringify(data));
      } else {
        const localValores = localStorage.getItem('valores_locacao');
        if (localValores) {
          setValoresLocacao(JSON.parse(localValores));
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar valores_locacao do Supabase:', err);
    }
  };

  useEffect(() => {
    if (isBaseValoresModalOpen) {
      fetchValoresLocacao();
    }
  }, [isBaseValoresModalOpen]);

  const handleSaveManualValorLocacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoValorForm.cod_material.trim() || !novoValorForm.valor_mensal) {
      showToast('Preencha o Código do Material e o Valor Mensal', 'error');
      return;
    }

    const valMensal = parseFloat(novoValorForm.valor_mensal.replace(',', '.'));
    if (isNaN(valMensal) || valMensal < 0) {
      showToast('Valor mensal inválido', 'error');
      return;
    }

    const valDiario = parseFloat((valMensal / 30).toFixed(2));

    const newValorObj: ValorLocacao = {
      cod_material: novoValorForm.cod_material.trim().toUpperCase(),
      descricao: novoValorForm.descricao.trim().toUpperCase() || 'SEM DESCRIÇÃO',
      valor_mensal: valMensal,
      valor_diario: valDiario,
      classe: novoValorForm.classe.trim().toUpperCase() || undefined,
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from('valores_locacao').upsert([newValorObj], { onConflict: 'cod_material' });
    } catch (err) {
      console.warn('Erro Supabase:', err);
    }

    const filtered = valoresLocacao.filter(v => v.cod_material !== newValorObj.cod_material);
    const updatedList = [...filtered, newValorObj];
    setValoresLocacao(updatedList);
    localStorage.setItem('valores_locacao', JSON.stringify(updatedList));

    setNovoValorForm({ cod_material: '', descricao: '', valor_mensal: '', classe: '' });
    showToast('Valor de locação adicionado/atualizado na base!');
  };

  const handleFileSelectBaseValores = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedValoresFile(file);
  };

  const parseMonetaryValue = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).trim();
    str = str.replace(/[R$\s]/g, '');
    if (!str) return 0;
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const extractRowValores = (row: any) => {
    const rowKeys = Object.keys(row);
    const getValByKeys = (possibleKeys: string[]) => {
      for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          return row[key];
        }
        const matchedKey = rowKeys.find(k => k.trim().toLowerCase() === key.trim().toLowerCase());
        if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
          return row[matchedKey];
        }
      }
      return '';
    };

    const codRaw = getValByKeys(['codMaterial', 'COD', 'cod_material', 'CODIGO', 'Cód. Material', 'Codigo']);
    const descRaw = getValByKeys(['DESCRIÇÃO', 'descricao', 'Descricao', 'DESCRIÇÃO ', 'DESCRICAO']);
    const mesRaw = getValByKeys(['MÊS ', 'VALOR ', 'MÊS', 'VALOR', 'valor_mensal', 'Valor Mensal', 'MES']);
    const diaRaw = getValByKeys(['DIA', 'DIA ', 'valor_diario', 'Valor Diário', 'Diária']);
    const classeRaw = getValByKeys(['classe', 'Classe', 'CLASSE', 'Classe de Equipamento']);

    const cod = String(codRaw).trim().toUpperCase();
    const desc = String(descRaw).trim().toUpperCase();
    const classe = String(classeRaw).trim().toUpperCase();
    let valM = parseMonetaryValue(mesRaw);
    let valD = parseMonetaryValue(diaRaw);

    if (valD <= 0 && valM > 0) {
      valD = parseFloat((valM / 30).toFixed(2));
    } else if (valM <= 0 && valD > 0) {
      valM = parseFloat((valD * 30).toFixed(2));
    }

    return { cod, desc, valM, valD, classe };
  };

  const handleImportPlanilhaBaseValores = async () => {
    if (!selectedValoresFile) {
      showToast('Selecione uma planilha (XLSX, XLS ou CSV) antes de clicar em Importar.', 'error');
      return;
    }

    setIsImportingValores(true);

    try {
      const buffer = await selectedValoresFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows || rows.length === 0) {
        showToast('A planilha selecionada está vazia ou sem dados válidos.', 'error');
        setIsImportingValores(false);
        return;
      }

      const novosValores: ValorLocacao[] = [];
      const seenCods = new Set<string>();

      rows.forEach(r => {
        const { cod, desc, valM, valD, classe } = extractRowValores(r);
        if (cod && !seenCods.has(cod) && (valM > 0 || valD > 0)) {
          seenCods.add(cod);
          novosValores.push({
            cod_material: cod,
            descricao: desc || 'EQUIPAMENTO/FERRAMENTA',
            valor_mensal: valM,
            valor_diario: valD,
            classe: classe || undefined,
            created_at: new Date().toISOString()
          });
        }
      });

      if (novosValores.length === 0) {
        showToast('Nenhuma linha com código (codMaterial/COD) e valor (MÊS/VALOR/DIA) válidos foi encontrada.', 'error');
        setIsImportingValores(false);
        return;
      }

      // Batch upsert into Supabase (chunks of 100)
      const chunkSize = 100;
      let hasError = false;

      for (let i = 0; i < novosValores.length; i += chunkSize) {
        const chunk = novosValores.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('valores_locacao')
          .upsert(chunk, { onConflict: 'cod_material' });

        if (error) {
          console.warn('Aviso Supabase batch upsert:', error);
          hasError = true;
        }
      }

      // Update backup local storage
      const mapa = new Map<string, ValorLocacao>();
      valoresLocacao.forEach(v => mapa.set(v.cod_material, v));
      novosValores.forEach(v => mapa.set(v.cod_material, v));
      const updatedList = Array.from(mapa.values());
      localStorage.setItem('valores_locacao', JSON.stringify(updatedList));

      // Re-fetch fresh table data directly from Supabase
      await fetchValoresLocacao();

      // Reset file selection state
      setSelectedValoresFile(null);
      if (valoresFileInputRef.current) {
        valoresFileInputRef.current.value = '';
      }

      if (hasError) {
        showToast(`${novosValores.length} itens processados e salvos! Tabela atualizada.`, 'info');
      } else {
        showToast(`${novosValores.length} valores de locação importados com sucesso na Base de Valores!`, 'success');
      }
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err);
      showToast(`Erro ao processar planilha: ${err?.message || 'Formato de arquivo inválido'}`, 'error');
    } finally {
      setIsImportingValores(false);
    }
  };

  // TODO: DELETAR ESTE BOTÃO APÓS A CARGA DE CLASSES
  const handleImportarClasses = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingClasses(true);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows || rows.length === 0) {
        showToast('A planilha selecionada está vazia.', 'error');
        return;
      }

      let updatedCount = 0;

      for (const row of rows) {
        const rawCod = row['Cód. Material'] ?? row['cod_material'] ?? row['COD MATERIAL'] ?? row['codMaterial'] ?? row['CODIGO'] ?? row['COD'];
        if (rawCod === undefined || rawCod === null || String(rawCod).trim() === '') continue;

        const codLimpo = String(rawCod).trim();
        const rawClasse = row['classe'] ?? row['Classe'] ?? row['CLASSE'] ?? row['Classe de Equipamento'];
        const classeVal = rawClasse !== undefined && rawClasse !== null ? String(rawClasse).trim() : '';

        if (codLimpo && classeVal) {
          const { error } = await supabase
            .from('valores_locacao')
            .update({ classe: classeVal })
            .eq('cod_material', codLimpo);

          if (!error) {
            updatedCount++;
          }
        }
      }

      await fetchValoresLocacao();
      showToast('Classes importadas com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao importar classes:', error);
      showToast(`Erro ao importar classes: ${error?.message || 'Erro desconhecido'}`, 'error');
    } finally {
      setIsImportingClasses(false);
      if (classesFileInputRef.current) {
        classesFileInputRef.current.value = '';
      }
    }
  };

  const filteredValoresLocacao = useMemo(() => {
    if (!valoresSearch.trim()) return valoresLocacao;
    const q = valoresSearch.toLowerCase().trim();
    return valoresLocacao.filter(
      v => v.cod_material.toLowerCase().includes(q) ||
           (v.descricao && v.descricao.toLowerCase().includes(q)) ||
           (v.classe && v.classe.toLowerCase().includes(q))
    );
  }, [valoresLocacao, valoresSearch]);

  // -------------------------------------------------------------
  // HANDLERS FOR MOBILIZAÇÃO / DESMOBILIZAÇÃO IMPORTS
  // -------------------------------------------------------------
  // Busca todas as movimentações sem o limite de 1000 linhas usando paginação
  const fetchAllMovimentacoesFromSupabase = async (): Promise<MovimentacaoAtivo[]> => {
    let allRows: MovimentacaoAtivo[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      try {
        const { data, error } = await supabase
          .from('movimentacoes_ativos')
          .select('*')
          .range(from, to);

        if (error) {
          console.error('Erro ao buscar página de movimentações:', error);
          break;
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data as MovimentacaoAtivo[]);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      } catch (err) {
        console.warn('Erro de conexão ao buscar movimentações:', err);
        break;
      }
    }
    return allRows;
  };

  const fetchMovimentacoes = async () => {
    try {
      const dbMovs = await fetchAllMovimentacoesFromSupabase();

      if (dbMovs && dbMovs.length > 0) {
        setMovimentacoes(dbMovs);
        localStorage.setItem('movimentacoes_ativos', JSON.stringify(dbMovs));
      } else {
        const localMovs = localStorage.getItem('movimentacoes_ativos');
        if (localMovs) {
          setMovimentacoes(JSON.parse(localMovs));
        } else {
          setMovimentacoes([]);
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar movimentações do Supabase:', err);
    }
  };

  const parseExcelDate = (val: any): string => {
    const fallback = new Date().toISOString().split('T')[0];
    if (val === undefined || val === null || val === '') {
      return fallback;
    }

    try {
      if (val instanceof Date) {
        if (!isNaN(val.getTime())) {
          const year = val.getFullYear();
          const month = String(val.getMonth() + 1).padStart(2, '0');
          const day = String(val.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }

      const numVal = typeof val === 'number' ? val : (typeof val === 'string' && !isNaN(Number(val)) && Number(val) > 30000 ? Number(val) : null);
      if (numVal !== null) {
        if (isNaN(numVal)) return fallback;
        const jsDate = new Date(Math.round((numVal - 25569) * 86400 * 1000));
        if (!isNaN(jsDate.getTime())) {
          const year = jsDate.getUTCFullYear();
          const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(jsDate.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }

      const str = String(val).trim();
      if (!str) return fallback;

      const dateOnlyStr = str.split(' ')[0].split('T')[0].trim();

      if (dateOnlyStr.includes('/') || (dateOnlyStr.includes('-') && dateOnlyStr.split('-')[0].length < 4)) {
        const parts = dateOnlyStr.split(/[\/\-]/);
        if (parts.length === 3) {
          let day = parts[0].padStart(2, '0');
          let month = parts[1].padStart(2, '0');
          let year = parts[2].trim();
          if (year.length === 2) year = `20${year}`;
          if (parseInt(month, 10) > 12) {
            const tmp = day;
            day = month;
            month = tmp;
          }
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      if (dateOnlyStr.includes('-') && dateOnlyStr.split('-')[0].length === 4) {
        return dateOnlyStr;
      }
    } catch (err) {
      console.warn('Erro ao converter data Excel:', val, err);
    }

    return fallback;
  };

  const extractRowMovimento = (row: any) => {
    const rowKeys = Object.keys(row);

    const getValByKeys = (possibleKeys: string[]) => {
      for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          return row[key];
        }
        const matchedKey = rowKeys.find(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === key.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
          return row[matchedKey];
        }
      }
      return '';
    };

    const tag = sanitizeString(getValByKeys(['Tag', 'TAG', 'Patrimônio', 'patrimonio', 'Ativo', 'Cód. Tag', 'Cod Tag', 'TAG/PATRIMONIO'])).toUpperCase();
    const codMaterial = sanitizeString(getValByKeys([
      'NM Material',
      'NM_MATERIAL',
      'codMaterial',
      'COD',
      'Codigo',
      'Cód. Material',
      'cod_material',
      'CODIGO',
      'Material',
      'Cód Material'
    ]));

    const descricao = sanitizeString(getValByKeys([
      'Descrição Material/Equipamento',
      'Descrição Material / Equipamento',
      'DESCRICAO MATERIAL/EQUIPAMENTO',
      'Descricao Material/Equipamento',
      'Descrição',
      'Descricao',
      'descricao',
      'DESCRIÇÃO',
      'Equipamento',
      'Material/Equipamento'
    ])).toUpperCase();

    // Mapeamento estrito para Dt Emissão (substituindo Dt Movimento)
    const dtEmissaoRaw = getValByKeys([
      'Dt Emissão',
      'Dt Emissao',
      'DT_EMISSAO',
      'Dt. Emissão',
      'Dt. Emissao',
      'Dt Emiss',
      'Dt. Emiss',
      'DT_EMISS',
      'Data Emissão',
      'Data Emissao',
      'DT EMISSAO',
      'DT EMISS',
      'DATA EMISSAO',
      'Data de Emissão',
      'Data de Emissao',
      'DATA DE EMISSAO',
      'Dt.Emissão',
      'Dt.Emissao',
      'Data Emiss',
      'DATA EMISS',
      'Data Entrada',
      'data_entrada',
      'Entrada'
    ]);

    const dataMovimento = parseExcelDate(dtEmissaoRaw);

    return { tag, codMaterial, descricao, dataMovimento };
  };

  const extractDepOrigDest = (row: any) => {
    const rowKeys = Object.keys(row || {});
    const getValByKeys = (keys: string[]) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
          return sanitizeString(row[key]);
        }
        const matchedKey = rowKeys.find(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === key.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
          return sanitizeString(row[matchedKey]);
        }
      }
      return '';
    };

    const origem = getValByKeys([
      'Dep Orig',
      'idDepositoOrigem',
      'DEP_ORIG',
      'id_deposito_origem',
      'Dep. Origem',
      'Deposito Origem',
      'Dep Origem',
      'Dep. Orig',
      'DepOrig'
    ]);

    const destino = getValByKeys([
      'Dep Dest',
      'idDepositoDestino',
      'DEP_DEST',
      'id_deposito_destino',
      'Dep. Destino',
      'Deposito Destino',
      'Dep Destino',
      'Dep. Dest',
      'DepDest'
    ]);

    return { origem, destino };
  };

  const handleSelectMobilizacaoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedMobFile(file);
  };

  const handleImportMobilizacaoPlanilha = async () => {
    if (!selectedObra) return;
    if (!selectedMobFile) {
      showToast('Selecione uma planilha (XLSX, XLS ou CSV) de Mobilização.', 'error');
      return;
    }

    setIsImportingMob(true);

    try {
      const buffer = await selectedMobFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Limpeza de "Linhas Fantasmas" do SheetJS
      const rows = rawRows.filter(r => {
        const { tag } = extractRowMovimento(r);
        return tag && tag.trim() !== '';
      });

      if (!rows || rows.length === 0) {
        showToast('A planilha selecionada está vazia ou não contém Tags válidas.', 'error');
        setIsImportingMob(false);
        return;
      }

      // Filtragem Inteligente de Linhas de Mobilização (Entradas: Destino = CC da Obra)
      const hasDepCols = rows.some(r => {
        const { origem, destino } = extractDepOrigDest(r);
        return origem !== '' || destino !== '';
      });

      const linhasEntrada = hasDepCols
        ? rows.filter(r => {
            const { destino } = extractDepOrigDest(r);
            return isSameCC(destino, selectedObra.numero_cc);
          })
        : rows;

      if (linhasEntrada.length === 0) {
        showToast('Nenhum registro de Entrada (Destino = CC) encontrado nesta planilha.', 'error');
        setIsImportingMob(false);
        return;
      }

      // Busca registros de ferramentas atualmente ativas no Supabase para a trava Anti-Duplicação
      const { data: ativosDbMob } = await supabase
        .from('movimentacoes_ativos')
        .select('obra_id, tag')
        .eq('obra_id', selectedObra.id)
        .is('data_saida', null);

      const ativosAtuaisMobSet = new Set<string>();
      if (ativosDbMob) {
        ativosDbMob.forEach(item => {
          if (item.tag) {
            ativosAtuaisMobSet.add(String(item.tag).trim().toUpperCase());
          }
        });
      }

      const novasMovs: any[] = [];
      linhasEntrada.forEach((r) => {
        const { tag, codMaterial, descricao, dataMovimento } = extractRowMovimento(r);

        const cleanTag = String(tag || '').trim().toUpperCase();
        if (cleanTag) {
          if (!ativosAtuaisMobSet.has(cleanTag)) {
            ativosAtuaisMobSet.add(cleanTag);
            novasMovs.push({
              obra_id: selectedObra.id,
              tag: cleanTag,
              cod_material: String(codMaterial || 'DIV-000').trim(),
              descricao: String(descricao || 'EQUIPAMENTO/FERRAMENTA').trim(),
              data_entrada: dataMovimento,
              data_saida: null
            });
          }
        }
      });

      if (novasMovs.length === 0) {
        showToast('Nenhum ativo com Tag válido foi encontrado na planilha.', 'error');
        setIsImportingMob(false);
        return;
      }

      console.log('Payload a ser enviado (Mobilização):', novasMovs);

      // Insert into Supabase in chunks with explicit error handling
      const chunkSize = 100;

      for (let i = 0; i < novasMovs.length; i += chunkSize) {
        const chunk = novasMovs.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('movimentacoes_ativos')
          .insert(chunk)
          .select();

        if (error) {
          console.error("Erro no Supabase (Mobilização):", error);
          showToast(`Erro no Supabase: ${error.message || error.details || 'Falha ao inserir registros'}`, 'error');
          setIsImportingMob(false);
          return; // Aborta o fluxo de sucesso!
        }
      }

      // Re-fetch fresh data directly from Supabase
      await fetchMovimentacoes();

      // Reset file input and close modal
      setSelectedMobFile(null);
      if (mobFileInputRef.current) {
        mobFileInputRef.current.value = '';
      }
      setIsImportMobilizacaoModalOpen(false);

      showToast(`${novasMovs.length} mobilizações (entradas) importadas com sucesso na obra ${selectedObra.numero_cc}!`, 'success');
    } catch (err: any) {
      console.error('Erro import mobilização:', err);
      showToast(`Erro ao processar planilha: ${err?.message || 'Arquivo inválido'}`, 'error');
    } finally {
      setIsImportingMob(false);
    }
  };

  const handleSelectDesmobilizacaoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedDesmobFile(file);
  };

  const handleImportDesmobilizacaoPlanilha = async () => {
    if (!selectedObra) return;
    if (!selectedDesmobFile) {
      showToast('Selecione uma planilha (XLSX, XLS ou CSV) de Desmobilização.', 'error');
      return;
    }

    setIsImportingDesmob(true);

    try {
      const buffer = await selectedDesmobFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // 1. Limpeza de "Linhas Fantasmas" do SheetJS (Apenas linhas com Tag preenchida)
      const linhasValidas = rawRows.filter(r => {
        const { tag } = extractRowMovimento(r);
        return tag && tag.trim() !== '';
      });

      if (!linhasValidas || linhasValidas.length === 0) {
        showToast('A planilha selecionada está vazia ou não contém Tags válidas.', 'error');
        setIsImportingDesmob(false);
        return;
      }

      // Filtragem Inteligente de Linhas de Desmobilização (Saídas: Origem = CC da Obra)
      const hasDepCols = linhasValidas.some(r => {
        const { origem, destino } = extractDepOrigDest(r);
        return origem !== '' || destino !== '';
      });

      const linhasSaida = hasDepCols
        ? linhasValidas.filter(r => {
            const { origem } = extractDepOrigDest(r);
            return isSameCC(origem, selectedObra.numero_cc);
          })
        : linhasValidas;

      if (linhasSaida.length === 0) {
        showToast('Nenhum registro de Saída (Origem = CC) encontrado nesta planilha.', 'error');
        setIsImportingDesmob(false);
        return;
      }

      let desmobilizadosCount = 0;
      let hasError = false;

      // 2 & 3. Loop sequencial sem State Updates e com try/catch isolado por linha
      for (const r of linhasSaida) {
        const { tag, dataMovimento } = extractRowMovimento(r);
        const cleanTag = tag ? tag.trim().toUpperCase() : '';
        const dataSaida = dataMovimento || new Date().toISOString().split('T')[0];

        if (cleanTag) {
          try {
            // Tenta atualizar primeiro os registros em aberto (data_saida é null)
            const { error: updateErr, data: updatedRows } = await supabase
              .from('movimentacoes_ativos')
              .update({ data_saida: dataSaida })
              .eq('tag', cleanTag)
              .eq('obra_id', selectedObra.id)
              .is('data_saida', null)
              .select();

            if (updateErr) {
              console.error(`Erro ao desmobilizar ativo no Supabase (Tag: ${cleanTag}, Obra: ${selectedObra.id}):`, updateErr);
              hasError = true;
            } else if (updatedRows && updatedRows.length > 0) {
              desmobilizadosCount += updatedRows.length;
            } else {
              // Fallback: tenta atualizar qualquer registro com aquela tag na obra
              const { error: errFallback, data: fallbackRows } = await supabase
                .from('movimentacoes_ativos')
                .update({ data_saida: dataSaida })
                .eq('tag', cleanTag)
                .eq('obra_id', selectedObra.id)
                .select();

              if (errFallback) {
                console.error(`Erro ao desmobilizar ativo fallback no Supabase (Tag: ${cleanTag}, Obra: ${selectedObra.id}):`, errFallback);
                hasError = true;
              } else if (fallbackRows && fallbackRows.length > 0) {
                desmobilizadosCount += fallbackRows.length;
              }
            }
          } catch (err) {
            console.error(`Exceção ao desmobilizar ativo (Tag: ${cleanTag}):`, err);
            hasError = true;
          }
        }
      }

      if (desmobilizadosCount === 0) {
        showToast('Nenhum ativo aberto para desmobilização nesta obra coincidiu com as Tags da planilha.', 'info');
      } else {
        if (hasError) {
          showToast(`${desmobilizadosCount} desmobilizações registradas com avisos!`, 'info');
        } else {
          showToast(`${desmobilizadosCount} desmobilizações (saídas) registradas com sucesso na obra!`, 'success');
        }
      }

      // Sync fresh data from Supabase
      await fetchMovimentacoes();

      // Reset file input and close modal
      setSelectedDesmobFile(null);
      if (desmobFileInputRef.current) {
        desmobFileInputRef.current.value = '';
      }
      setIsImportDesmobilizacaoModalOpen(false);
    } catch (err: any) {
      console.error('Erro import desmobilização:', err);
      showToast(`Erro ao processar planilha: ${err?.message || 'Arquivo inválido'}`, 'error');
    } finally {
      setIsImportingDesmob(false);
    }
  };

  // -------------------------------------------------------------
  // DASHBOARD GLOBAL CALCULATIONS & IMPORTADOR GLOBAL
  // -------------------------------------------------------------
  const globalCalculatedData = useMemo(() => {
    // 1. Array de IDs de obras ativas (status === true)
    const idsObrasAtivas = obras.filter(obra => obra.status === true).map(obra => obra.id);

    // 2. Contagem de movimentações no mês selecionado (entradas e saídas) APENAS para obras ativas
    const totalMovimentacoesMes = movimentacoes.filter(m => {
      if (!idsObrasAtivas.includes(m.obra_id)) return false;
      const entMes = m.data_entrada ? String(m.data_entrada).substring(0, 7) : '';
      const saiMes = m.data_saida ? String(m.data_saida).substring(0, 7) : '';
      return entMes === mesAnoRef || saiMes === mesAnoRef;
    }).length;

    let totalValorGlobal = 0;
    let obrasAtivasCount = 0;
    const itensSemPreco: Array<{
      id?: string;
      obra_id: string;
      nome_obra: string;
      numero_cc: string;
      Obra: string;
      Tag: string;
      'Cód. Material': string;
      Descrição: string;
    }> = [];

    const obrasMetricsMap = new Map<string, {
      countAtivos: number;
      countFaltaPreco: number;
      valorTotal: number;
    }>();

    obras.forEach(ob => {
      const movsObra = movimentacoes.filter(m => m.obra_id === ob.id);
      const medicao = consolidarMedicaoMensal(movsObra, valoresLocacao, mesAnoRef);
      const ativosNoMes = medicao.filter(i => i.inicio_medicao !== null);
      const countAtivos = ativosNoMes.length;
      const countFaltaPreco = ativosNoMes.filter(i => !i.tem_preco).length;
      const valorTotal = medicao.reduce((acc, i) => acc + i.valor_total_item, 0);

      // Apenas acumula para os indicadores globais se a obra estiver ativa (status === true)
      if (ob.status === true) {
        if (countAtivos > 0) {
          obrasAtivasCount += 1;
        }
        totalValorGlobal += valorTotal;

        // Popula itensSemPreco para obras ativas no mês selecionado
        ativosNoMes.forEach(item => {
          if (!item.tem_preco) {
            itensSemPreco.push({
              id: item.id,
              obra_id: ob.id,
              nome_obra: ob.nome_obra,
              numero_cc: ob.numero_cc || '',
              Obra: ob.numero_cc ? `${ob.numero_cc} - ${ob.nome_obra}` : ob.nome_obra,
              Tag: item.tag || '',
              'Cód. Material': item.cod_material || '',
              Descrição: item.descricao || ''
            });
          }
        });
      }

      obrasMetricsMap.set(ob.id, {
        countAtivos,
        countFaltaPreco,
        valorTotal
      });
    });

    return {
      totalValorGlobal,
      obrasAtivasCount,
      totalObrasAtivas: idsObrasAtivas.length,
      totalMovimentacoesMes,
      obrasMetricsMap,
      itensSemPreco
    };
  }, [obras, movimentacoes, valoresLocacao, mesAnoRef]);

  const handleSelectGlobalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedGlobalFile(file);
  };

  const handleSelectReapFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedReapFile(file);
  };

  const handleImportExtratoGlobalERP = async () => {
    if (!selectedGlobalFile) {
      showToast('Selecione uma planilha do ERP (.xlsx, .xls ou .csv) antes de importar.', 'error');
      return;
    }

    setIsImportingGlobal(true);
    console.log('1. Iniciando leitura da planilha global ERP...');

    try {
      const buffer = await selectedGlobalFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      console.log(`Linhas brutas lidas da planilha: ${rawRows.length}`);

      // 1. Limpeza de "Linhas Fantasmas"
      const rows = rawRows.filter(r => {
        const { tag } = extractRowMovimento(r);
        return tag && tag.trim() !== '';
      });

      console.log(`Linhas válidas com Tag: ${rows.length}`);

      if (!rows || rows.length === 0) {
        showToast('A planilha selecionada está vazia ou não contém Tags válidas.', 'error');
        return;
      }

      // 2. Buscar lista de Obras do Supabase para ter os IDs e numero_cc atualizados
      const { data: dbObras, error: errFetchObras } = await supabase.from('obras_medicao').select('*');
      if (errFetchObras) {
        console.error('Erro ao buscar obras do Supabase:', errFetchObras);
      }
      let listaObras = dbObras && dbObras.length > 0 ? dbObras : [...obras];

      // Busca registros de ferramentas atualmente ativas no Supabase (data_saida IS NULL) para a trava Anti-Duplicação
      const { data: ativosDb } = await supabase
        .from('movimentacoes_ativos')
        .select('obra_id, tag')
        .is('data_saida', null);

      const ativosAtuaisSet = new Set<string>();
      if (ativosDb) {
        ativosDb.forEach(item => {
          if (item.tag && item.obra_id) {
            ativosAtuaisSet.add(`${String(item.tag).trim().toUpperCase()}-${item.obra_id}`);
          }
        });
      }

      // Auto-Criação de Obras Inexistentes com Desduplicação Estrita (Map)
      const ccsEncontradosMap = new Map<string, string>(); // keyNorm -> ccOriginal

      rows.forEach(r => {
        const { origem, destino } = extractDepOrigDest(r);
        const rawDepDest = r['Dep Dest'] || r['DEP DEST'] || r['idDepositoDestino'] || destino || '';
        const rawDepOrig = r['Dep Orig'] || r['DEP ORIG'] || r['idDepositoOrigem'] || origem || '';

        const ccDest = sanitizeString(rawDepDest).toUpperCase();
        const ccOrig = sanitizeString(rawDepOrig).toUpperCase();

        if (ccDest) {
          const keyNorm = ccDest.replace(/^0+/, '');
          if (keyNorm && !ccsEncontradosMap.has(keyNorm)) {
            ccsEncontradosMap.set(keyNorm, ccDest);
          }
        }
        if (ccOrig) {
          const keyNorm = ccOrig.replace(/^0+/, '');
          if (keyNorm && !ccsEncontradosMap.has(keyNorm)) {
            ccsEncontradosMap.set(keyNorm, ccOrig);
          }
        }
      });

      // Desduplicação contra obras existentes
      const obrasParaCriarMap = new Map<string, any>(); // keyNorm -> object to insert

      ccsEncontradosMap.forEach((ccOriginal, keyNorm) => {
        const ccClean = sanitizeString(ccOriginal);
        const jaExiste = listaObras.some(ob => {
          const obNumCC = sanitizeString(ob.numero_cc);
          const obNome = sanitizeString(ob.nome_obra);
          if (obNumCC && isSameCC(obNumCC, ccClean)) return true;
          if (obNome && (isSameCC(obNome, ccClean) || obNome.toUpperCase() === ccClean.toUpperCase())) return true;
          return false;
        });

        if (!jaExiste && !obrasParaCriarMap.has(keyNorm)) {
          obrasParaCriarMap.set(keyNorm, {
            numero_cc: ccClean,
            nome_obra: sanitizeString(`OBRA CC ${ccClean}`),
            nome_gestor: 'MIGRAÇÃO AUTOMÁTICA',
            data_inicio: new Date().toISOString().split('T')[0],
            status: true
          });
        }
      });

      const obrasParaCriar = Array.from(obrasParaCriarMap.values());
      console.log(`2. Obras desduplicadas e validadas. Novas obras a criar: ${obrasParaCriar.length}`);

      if (obrasParaCriar.length > 0) {
        const { error: errNovaObra } = await supabase
          .from('obras_medicao')
          .insert(obrasParaCriar);

        if (errNovaObra) {
          console.error('Erro ao auto-criar obras no Importador Global:', errNovaObra);
        } else {
          const { data: reFetchedObras } = await supabase.from('obras_medicao').select('*');
          if (reFetchedObras && reFetchedObras.length > 0) {
            listaObras = reFetchedObras;
          }
          await fetchObras();
        }
      }

      // Hash Map das Obras para O(1) Lookup
      const mapaObras: Record<string, string> = {};
      listaObras.forEach(obra => {
        if (obra.numero_cc) {
          const ccLimpo = sanitizeString(obra.numero_cc).toUpperCase();
          if (ccLimpo) {
            mapaObras[ccLimpo] = obra.id;

            const ccSemZeros = ccLimpo.replace(/^0+/, '');
            if (ccSemZeros && !mapaObras[ccSemZeros]) {
              mapaObras[ccSemZeros] = obra.id;
            }
          }
        }
        if (obra.nome_obra) {
          const nomeLimpo = sanitizeString(obra.nome_obra).toUpperCase();
          if (nomeLimpo && !mapaObras[nomeLimpo]) {
            mapaObras[nomeLimpo] = obra.id;
          }
        }
      });

      const novasEntradas: any[] = [];
      const listaSaidas: { obra_id: string; tag: string; data_saida: string }[] = [];

      // Classificação O(N)
      for (const r of rows) {
        const { tag, codMaterial, descricao, dataMovimento } = extractRowMovimento(r);
        const cleanTag = tag ? sanitizeString(tag).toUpperCase() : '';
        if (!cleanTag) continue;

        const { origem, destino } = extractDepOrigDest(r);

        const rawDepDest = r['Dep Dest'] || r['DEP DEST'] || r['idDepositoDestino'] || destino || '';
        const rawDepOrig = r['Dep Orig'] || r['DEP ORIG'] || r['idDepositoOrigem'] || origem || '';

        const ccDestino = sanitizeString(rawDepDest).toUpperCase();
        const ccOrigem = sanitizeString(rawDepOrig).toUpperCase();

        const dataFormatted = dataMovimento || new Date().toISOString().split('T')[0];

        // Entrada (Mobilização)
        if (ccDestino) {
          const ccDestinoSemZeros = ccDestino.replace(/^0+/, '');
          const obraIdDestino = mapaObras[ccDestino] || (ccDestinoSemZeros ? mapaObras[ccDestinoSemZeros] : undefined);

          if (obraIdDestino) {
            const keyAtivo = `${cleanTag}-${obraIdDestino}`;
            // Trava Anti-Duplicação: Se a tag já está com data_saida NULL nesta obra (no banco ou na planilha), descarte a linha
            if (!ativosAtuaisSet.has(keyAtivo)) {
              ativosAtuaisSet.add(keyAtivo);
              novasEntradas.push({
                obra_id: obraIdDestino,
                tag: cleanTag,
                cod_material: codMaterial ? String(codMaterial).trim().toUpperCase() : 'SEM_COD',
                descricao: descricao ? String(descricao).trim().toUpperCase() : 'EQUIPAMENTO/FERRAMENTA',
                data_entrada: dataFormatted,
                data_saida: null
              });
            } else {
              console.log(`[Anti-Duplicação] Tag ${cleanTag} já ativa na obra ${obraIdDestino}. Registro ignorado.`);
            }
          }
        }

        // Saída (Desmobilização)
        if (ccOrigem) {
          const ccOrigemSemZeros = ccOrigem.replace(/^0+/, '');
          const obraIdOrigem = mapaObras[ccOrigem] || (ccOrigemSemZeros ? mapaObras[ccOrigemSemZeros] : undefined);

          if (obraIdOrigem) {
            listaSaidas.push({
              obra_id: obraIdOrigem,
              tag: cleanTag,
              data_saida: dataFormatted
            });
          }
        }
      }

      console.log(`Total de Entradas identificadas: ${novasEntradas.length}`);
      console.log(`Total de Saídas identificadas: ${listaSaidas.length}`);

      if (novasEntradas.length === 0 && listaSaidas.length === 0) {
        showToast('Nenhum registro com Dep. Origem ou Dep. Destino correspondente aos CCs das obras cadastradas foi encontrado no extrato.', 'error');
        return;
      }

      let entradasCount = 0;
      let saidasCount = 0;

      // 3. Inserção das Entradas em Lotes (Chunks de 100)
      if (novasEntradas.length > 0) {
        console.log(`3. Inserindo ${novasEntradas.length} entradas em lotes...`);
        const chunkSize = 100;
        for (let i = 0; i < novasEntradas.length; i += chunkSize) {
          const chunk = novasEntradas.slice(i, i + chunkSize);
          const { error, data } = await supabase.from('movimentacoes_ativos').insert(chunk).select();
          if (!error && data) {
            entradasCount += data.length;
          } else if (error) {
            console.error(`Erro ao inserir lote de entradas (${i} a ${i + chunk.length}):`, error);
          }
        }
        console.log(`3. Finalizada inserção de entradas. Registradas: ${entradasCount}`);
      }

      // 4. Atualização Otimizada das Saídas (Agrupamento por obra_id + data_saida em lotes de tags)
      if (listaSaidas.length > 0) {
        console.log(`4. Atualizando ${listaSaidas.length} saídas em lotes otimizados...`);

        const gruposSaida = new Map<string, { obra_id: string; data_saida: string; tags: Set<string> }>();

        for (const s of listaSaidas) {
          const key = `${s.obra_id}___${s.data_saida}`;
          if (!gruposSaida.has(key)) {
            gruposSaida.set(key, { obra_id: s.obra_id, data_saida: s.data_saida, tags: new Set() });
          }
          gruposSaida.get(key)!.tags.add(s.tag);
        }

        for (const group of gruposSaida.values()) {
          const tagList = Array.from(group.tags);
          const tagChunkSize = 100;

          for (let j = 0; j < tagList.length; j += tagChunkSize) {
            const chunkTags = tagList.slice(j, j + tagChunkSize);

            // Atualiza registros com data_saida IS NULL
            const { error: errUpdateNull, data: updatedNullRows } = await supabase
              .from('movimentacoes_ativos')
              .update({ data_saida: group.data_saida })
              .eq('obra_id', group.obra_id)
              .in('tag', chunkTags)
              .is('data_saida', null)
              .select();

            if (!errUpdateNull && updatedNullRows) {
              saidasCount += updatedNullRows.length;
            }

            // Fallback se restou alguma tag que precise de update sem IS NULL
            const tagsAtualizadas = new Set(updatedNullRows?.map(r => r.tag) || []);
            const tagsRestantes = chunkTags.filter(t => !tagsAtualizadas.has(t));

            if (tagsRestantes.length > 0) {
              const { error: errFallback, data: fallbackRows } = await supabase
                .from('movimentacoes_ativos')
                .update({ data_saida: group.data_saida })
                .eq('obra_id', group.obra_id)
                .in('tag', tagsRestantes)
                .select();

              if (!errFallback && fallbackRows) {
                saidasCount += fallbackRows.length;
              }
            }
          }
        }

        console.log(`4. Finalizada atualização de saídas. Atualizadas: ${saidasCount}`);
      }

      // 5. Sincronizar estado do frontend
      console.log('5. Sincronizando dados com o banco...');
      await fetchMovimentacoes();

      showToast(`Processamento concluído: ${entradasCount} entrada(s) registrada(s) e ${saidasCount} saída(s) carimbada(s) nas obras.`, 'success');
      setIsImportGlobalModalOpen(false);
      setSelectedGlobalFile(null);
      if (globalFileInputRef.current) {
        globalFileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Erro na importação global:', error);
      showToast(`Falha no processamento global: ${error?.message || 'Erro desconhecido'}`, 'error');
    } finally {
      setIsImportingGlobal(false);
    }
  };

  // Helper para buscar valor de colunas de forma insensível a maiúsculas/minúsculas e acentos
  const getRowValue = (r: any, candidateKeys: string[]): any => {
    for (const k of candidateKeys) {
      if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
        return r[k];
      }
    }
    const rowKeys = Object.keys(r);
    for (const cand of candidateKeys) {
      const candNorm = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      const foundKey = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === candNorm);
      if (foundKey && r[foundKey] !== undefined && r[foundKey] !== null && String(r[foundKey]).trim() !== '') {
        return r[foundKey];
      }
    }
    return '';
  };

  // Helper para converter string de valor em número
  const parseNumberVal = (raw: any): number => {
    if (typeof raw === 'number') return raw;
    if (!raw) return 0;
    let str = String(raw).replace(/R\$\s?/gi, '').trim();
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const val = parseFloat(str);
    return isNaN(val) ? 0 : val;
  };

  // Handler do Importador de Reaproveitamento
  const handleImportReaproveitamentoPlanilha = async () => {
    if (!selectedReapFile) {
      showToast('Selecione uma planilha de Reaproveitamento (.xlsx ou .xls) antes de importar.', 'error');
      return;
    }

    setIsImportingReap(true);

    try {
      const buffer = await selectedReapFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        showToast('A planilha selecionada está vazia.', 'error');
        setIsImportingReap(false);
        return;
      }

      // 1. Buscar Obras cadastradas no banco de dados
      const { data: dbObras } = await supabase.from('obras_medicao').select('*');
      let listaObras = dbObras && dbObras.length > 0 ? dbObras : [...obras];

      // Mapeamento de Centros de Custo na planilha
      const ccsEncontradosMap = new Map<string, string>(); // normCC -> rawCC

      rawRows.forEach(r => {
        const rawCC = getRowValue(r, ['CENTRO DE CUSTO', 'Centro de Custo', 'Centro Custo', 'CC', 'cc']);
        const ccStr = sanitizeString(rawCC).toUpperCase();
        if (ccStr) {
          const norm = ccStr.replace(/^0+/, '');
          if (norm && !ccsEncontradosMap.has(norm)) {
            ccsEncontradosMap.set(norm, ccStr);
          }
        }
      });

      // 2. Auto-Criação de Obras Inexistentes no banco
      const novasObrasCriadas: any[] = [];
      for (const [normCC, rawCC] of ccsEncontradosMap.entries()) {
        const ccClean = sanitizeString(rawCC);
        const jaExiste = listaObras.some(ob => {
          const obNumCC = sanitizeString(ob.numero_cc);
          const obNome = sanitizeString(ob.nome_obra);
          if (obNumCC && isSameCC(obNumCC, ccClean)) return true;
          if (obNome && (isSameCC(obNome, ccClean) || obNome.toUpperCase() === ccClean.toUpperCase())) return true;
          return false;
        });

        if (!jaExiste) {
          const novaObraObj = {
            numero_cc: ccClean,
            nome_obra: sanitizeString(`Obra ${ccClean}`),
            nome_gestor: 'NÃO INFORMADO',
            data_inicio: new Date().toISOString().split('T')[0],
            status: true
          };

          const { data: createdObra, error: errCreate } = await supabase
            .from('obras_medicao')
            .insert(novaObraObj)
            .select()
            .single();

          if (!errCreate && createdObra) {
            novasObrasCriadas.push(createdObra);
            listaObras.push(createdObra);
          }
        }
      }

      // 3. Mapear linhas para o formato de inserção no Supabase
      const insertPayload: any[] = [];

      rawRows.forEach(r => {
        const rawRm = getRowValue(r, ['Nr. RM', 'NR. RM', 'Nr RM', 'Nº RM', 'RM', 'rm']);
        const rawCC = getRowValue(r, ['CENTRO DE CUSTO', 'Centro de Custo', 'Centro Custo', 'CC', 'cc']);
        const rawEmissao = getRowValue(r, ['Data de emissão', 'DATA DE EMISSÃO', 'Data de Emissao', 'Data Emissão', 'Data']);
        const rawCodItem = getRowValue(r, ['Código do item', 'CÓDIGO DO ITEM', 'Código Item', 'Cod. Item', 'Cod Item', 'Codigo Item']);
        const rawDesc = getRowValue(r, ['Descrição do item', 'DESCRIÇÃO DO ITEM', 'Descrição Item', 'Descrição', 'Descricao']);
        const rawQtd = getRowValue(r, ['Quantidade solicitada', 'QUANTIDADE SOLICITADA', 'Qtd Solicitada', 'Quantidade', 'Qtd']);
        const rawValor = getRowValue(r, ['VALOR DE REAPROVEITAMENTO', 'Valor de Reaproveitamento', 'Valor Reaproveitamento', 'VALOR', 'Valor']);

        const ccStr = sanitizeString(rawCC);
        if (!ccStr) return;

        // Identifica obra correspondente
        const obraCorrespondente = listaObras.find(ob => {
          const obNumCC = sanitizeString(ob.numero_cc);
          const obNome = sanitizeString(ob.nome_obra);
          if (obNumCC && isSameCC(obNumCC, ccStr)) return true;
          if (obNome && (isSameCC(obNome, ccStr) || obNome.toUpperCase() === ccStr.toUpperCase())) return true;
          return false;
        });

        if (!obraCorrespondente) return;

        const rmStr = sanitizeString(rawRm || 'SEM-RM');
        const codStr = sanitizeString(rawCodItem || 'DIV-000');
        const tagGen = `REAP-${rmStr}-${codStr}`;
        const dataEmissaoFormatted = parseExcelDate(rawEmissao);
        const valorReap = parseNumberVal(rawValor);
        const quantidade = parseNumberVal(rawQtd) || 1;
        const descricaoItem = sanitizeString(rawDesc || 'ITEM DE REAPROVEITAMENTO');

        insertPayload.push({
          obra_id: obraCorrespondente.id,
          tag: tagGen,
          cod_material: codStr,
          descricao: descricaoItem,
          data_entrada: dataEmissaoFormatted,
          data_saida: dataEmissaoFormatted, // Obrigatório ser igual à entrada para isolar o faturamento no mês da RM
          modalidade: 'REAPROVEITAMENTO',
          valor_reaproveitamento: valorReap,
          quantidade: quantidade,
          rm_referencia: rmStr
        });
      });

      if (insertPayload.length === 0) {
        showToast('Nenhum item válido encontrado na planilha.', 'error');
        setIsImportingReap(false);
        return;
      }

      // Inserção em lotes no Supabase
      const chunkSize = 100;
      let successCount = 0;

      for (let i = 0; i < insertPayload.length; i += chunkSize) {
        const chunk = insertPayload.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('movimentacoes_ativos')
          .insert(chunk)
          .select();

        if (error) {
          console.error('Erro ao inserir reaproveitamento no Supabase:', error);
          showToast(`Erro ao salvar no banco: ${error.message}`, 'error');
          setIsImportingReap(false);
          return;
        }
        if (data) {
          successCount += data.length;
        }
      }

      // Atualizar dados do frontend
      await fetchObras();
      await fetchMovimentacoes();

      setSelectedReapFile(null);
      if (reapFileInputRef.current) {
        reapFileInputRef.current.value = '';
      }
      setIsImportReaproveitamentoModalOpen(false);

      showToast(`${successCount} item(ns) de Reaproveitamento importado(s) com sucesso! ${novasObrasCriadas.length > 0 ? `(${novasObrasCriadas.length} obra(s) nova(s) criada(s))` : ''}`, 'success');
    } catch (err: any) {
      console.error('Erro na importação de reaproveitamento:', err);
      showToast(`Erro ao processar planilha: ${err?.message || 'Arquivo inválido'}`, 'error');
    } finally {
      setIsImportingReap(false);
    }
  };

  // -------------------------------------------------------------
  // CARGA INICIAL RETROATIVA (MIGRAÇÃO DE DADOS HISTÓRICOS)
  // -------------------------------------------------------------
  const parseNullableDate = (val: any): string | null => {
    if (val === null || val === undefined || val === '') return null;
    const res = parseExcelDate(val);
    return res || null;
  };

  const handleDeleteObra = async (obraId: string, nomeObra: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmou = window.confirm(
      `Tem certeza que deseja excluir a obra "${nomeObra}"? Esta ação apagará todo o histórico de movimentações atrelado a ela e não pode ser desfeita.`
    );

    if (!confirmou) return;

    try {
      // 1. Tenta deletar primeiramente as movimentações atreladas à obra para prevenir falhas de Foreign Key sem CASCADE
      const { error: errMov } = await supabase
        .from('movimentacoes_ativos')
        .delete()
        .eq('obra_id', obraId);

      if (errMov) {
        console.warn('Aviso/Erro ao excluir movimentações da obra:', errMov);
      }

      // 2. Executa a exclusão da obra no Supabase
      const { error } = await supabase.from('obras_medicao').delete().eq('id', obraId);

      if (error) {
        console.error('Erro de Foreign Key / Permissão no Supabase:', error);
        showToast(`Erro ao excluir obra (Chave Estrangeira/Permissão): ${error.message}`, 'error');
        return;
      }

      showToast(`Obra "${nomeObra}" excluída com sucesso!`, 'success');

      // 3. Atualização de estado local e refetching
      setObras(prev => prev.filter(o => o.id !== obraId));
      await fetchObras();
      await fetchMovimentacoes();
    } catch (err: any) {
      console.error('Erro ao excluir obra:', err);
      showToast(`Falha ao excluir a obra: ${err?.message || 'Erro de conexão/permissão'}`, 'error');
    }
  };



  const handleExportRelatorioGlobal = () => {
    const obrasAtivas = obras.filter(o => o.status === true);
    if (!obrasAtivas || obrasAtivas.length === 0) {
      showToast('Nenhuma obra ativa cadastrada para exportação.', 'error');
      return;
    }

    const exportData: any[] = [];

    obrasAtivas.forEach(obra => {
      const movsObra = movimentacoes.filter(m => m.obra_id === obra.id);
      const medicaoObra = consolidarMedicaoMensal(movsObra, valoresLocacao, mesAnoRef);

      const itensMes = medicaoObra.filter(item => {
        const entMes = item.data_entrada ? String(item.data_entrada).substring(0, 7) : '';
        const saiMes = item.data_saida ? String(item.data_saida).substring(0, 7) : '';
        return item.dias_medidos > 0 || entMes === mesAnoRef || saiMes === mesAnoRef || (!item.data_saida && entMes <= mesAnoRef);
      });

      itensMes.forEach(item => {
        const isReap = item.modalidade === 'REAPROVEITAMENTO';
        const dias = isReap ? 'Taxa Única' : (item.dias_medidos || 0);
        const valorDiaria = isReap ? '-' : (item.valor_diario || 0);
        const valorTotal = item.valor_total_item || 0;
        const nomeObraCC = obra.numero_cc ? `${obra.numero_cc} - ${obra.nome_obra}` : obra.nome_obra;

        exportData.push({
          'Obra (Centro de Custo)': nomeObraCC,
          'Modalidade': item.modalidade || 'LOCACAO',
          'Tag / Patrimônio': item.tag || '',
          'Cód. Material': item.cod_material || '',
          'Descrição': item.descricao || '',
          'Classe': item.classe || 'Sem Classe',
          'Dt. Entrada': formatDateBR(item.data_entrada),
          'Dt. Saída': item.data_saida ? formatDateBR(item.data_saida) : '',
          'Início Medição': formatDateBR(item.inicio_medicao),
          'Fim Medição': formatDateBR(item.fim_medicao),
          'Dias Medidos': dias,
          'Valor Diária (R$)': valorDiaria,
          'Valor Total do Item (R$)': valorTotal
        });
      });
    });

    if (exportData.length === 0) {
      showToast(`Nenhum ativo ou medição encontrada para o mês de referência ${mesAnoRef}.`, 'info');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Medição Consolidada');
    XLSX.writeFile(workbook, `Medicao_Global_${mesAnoRef}.xlsx`);
    showToast('Relatório Consolidado Global exportado com sucesso!', 'success');
  };

  const handleExportPendenciasPreco = (itens: any[]) => {
    if (!itens || itens.length === 0) {
      showToast('Nenhuma pendência de preço encontrada.', 'info');
      return;
    }

    const dataToExport = itens.map(item => ({
      'Obra': item.Obra || item.nome_obra || '',
      'Tag': item.Tag || item.tag || '',
      'Cód. Material': item['Cód. Material'] || item.cod_material || '',
      'Descrição': item.Descrição || item.descricao || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pendências de Preço');

    const parts = mesAnoRef.split('-');
    const formattedDate = parts.length === 2 ? `${parts[1]}_${parts[0]}` : mesAnoRef.replace('-', '_');

    XLSX.writeFile(workbook, `Alerta_SemPreco_${formattedDate}.xlsx`);
    showToast('Relatório de pendências de preço baixado com sucesso!', 'success');
  };

  const handleSaveManualMovimentacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObra) return;
    if (!novaMovForm.tag.trim() || !novaMovForm.cod_material.trim()) {
      showToast('Preencha a Tag e o Código do Material', 'error');
      return;
    }

    const newMov: MovimentacaoAtivo = {
      id: `mov-manual-${Date.now()}`,
      obra_id: selectedObra.id,
      tag: novaMovForm.tag.trim().toUpperCase(),
      cod_material: novaMovForm.cod_material.trim().toUpperCase(),
      descricao: novaMovForm.descricao.trim().toUpperCase() || 'EQUIPAMENTO/FERRAMENTA',
      data_entrada: novaMovForm.data_entrada,
      data_saida: novaMovForm.data_saida || null,
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from('movimentacoes_ativos').insert([newMov]);
    } catch (err) {
      console.warn('Erro Supabase insert manual mov:', err);
    }

    const updated = [...movimentacoes, newMov];
    setMovimentacoes(updated);
    localStorage.setItem('movimentacoes_ativos', JSON.stringify(updated));

    setIsManualMovModalOpen(false);
    setNovaMovForm({
      tag: '',
      cod_material: '',
      descricao: '',
      data_entrada: new Date().toISOString().split('T')[0],
      data_saida: ''
    });
    showToast('Ativo adicionado com sucesso!');
  };

  const handleDeleteMovimentacao = async (movId: string) => {
    if (!window.confirm('Tem certeza que deseja remover esta movimentação?')) return;

    try {
      await supabase.from('movimentacoes_ativos').delete().eq('id', movId);
    } catch (err) {
      console.warn('Erro Supabase delete mov:', err);
    }

    const updated = movimentacoes.filter(m => m.id !== movId);
    setMovimentacoes(updated);
    localStorage.setItem('movimentacoes_ativos', JSON.stringify(updated));
    showToast('Movimentação removida.', 'info');
  };

  // -------------------------------------------------------------
  // COMPUTED CALCULATIONS FOR SELECTED OBRA & REFERENCE MONTH
  // -------------------------------------------------------------
  const movimentacoesObra = useMemo(() => {
    if (!selectedObra) return [];
    return movimentacoes.filter(m => m.obra_id === selectedObra.id);
  }, [movimentacoes, selectedObra]);

  const medicaoConsolidada = useMemo(() => {
    if (!selectedObra) return [];
    return consolidarMedicaoMensal(movimentacoesObra, valoresLocacao, mesAnoRef);
  }, [movimentacoesObra, valoresLocacao, mesAnoRef, selectedObra]);

  const medicaoFiltrada = useMemo(() => {
    return medicaoConsolidada.filter(item => {
      // O item deve ter estado alocado na obra durante o mês de referência
      if (!item.inicio_medicao) return false;

      if (detailSearch.trim()) {
        const q = detailSearch.toLowerCase();
        const matchTag = item.tag.toLowerCase().includes(q);
        const matchCod = item.cod_material.toLowerCase().includes(q);
        const matchDesc = item.descricao.toLowerCase().includes(q);
        if (!matchTag && !matchCod && !matchDesc) return false;
      }

      if (detailFilterPreco === 'FALTA_PRECO' && item.tem_preco) return false;
      if (detailFilterPreco === 'COM_PRECO' && !item.tem_preco) return false;

      return true;
    });
  }, [medicaoConsolidada, detailSearch, detailFilterPreco]);

  // Financial KPIs for the Month
  const totalMedidoMes = useMemo(() => {
    return medicaoConsolidada.reduce((acc, item) => acc + item.valor_total_item, 0);
  }, [medicaoConsolidada]);

  const countAtivosMedidos = useMemo(() => {
    return medicaoConsolidada.filter(i => i.inicio_medicao !== null).length;
  }, [medicaoConsolidada]);

  const countFaltaPreco = useMemo(() => {
    return medicaoConsolidada.filter(i => i.inicio_medicao !== null && !i.tem_preco).length;
  }, [medicaoConsolidada]);

  // Obras Ativas e Inativas com filtro de busca para o Hub
  const obrasAtivas = useMemo(() => {
    return obras.filter(ob => {
      if (!ob.status) return false;
      if (hubSearch.trim()) {
        const q = hubSearch.toLowerCase();
        const mCC = ob.numero_cc.toLowerCase().includes(q);
        const mNome = ob.nome_obra.toLowerCase().includes(q);
        const mGestor = ob.nome_gestor.toLowerCase().includes(q);
        if (!mCC && !mNome && !mGestor) return false;
      }
      return true;
    });
  }, [obras, hubSearch]);

  const obrasInativas = useMemo(() => {
    return obras.filter(ob => {
      if (ob.status) return false;
      if (hubSearch.trim()) {
        const q = hubSearch.toLowerCase();
        const mCC = ob.numero_cc.toLowerCase().includes(q);
        const mNome = ob.nome_obra.toLowerCase().includes(q);
        const mGestor = ob.nome_gestor.toLowerCase().includes(q);
        if (!mCC && !mNome && !mGestor) return false;
      }
      return true;
    });
  }, [obras, hubSearch]);

  // Export Measurement Spreadsheet
  const handleExportSpreadsheet = () => {
    if (!selectedObra || medicaoFiltrada.length === 0) {
      showToast('Nenhum item para exportar no período selecionado', 'error');
      return;
    }

    const dataToExport = medicaoFiltrada.map(item => {
      const isReap = item.modalidade === 'REAPROVEITAMENTO';
      return {
        'Obra / CC': `${selectedObra.numero_cc} - ${selectedObra.nome_obra}`,
        'Modalidade': item.modalidade || 'LOCACAO',
        'Mês Referência': mesAnoRef,
        'Tag / Patrimônio': item.tag,
        'Cód. Material': item.cod_material,
        'Descrição do Ativo': item.descricao,
        'Classe': item.classe || 'Sem Classe',
        'Data Entrada': formatDateBR(item.data_entrada),
        'Data Saída': item.data_saida ? formatDateBR(item.data_saida) : 'Alocado (Aberto)',
        'Início Medição': formatDateBR(item.inicio_medicao),
        'Fim Medição': formatDateBR(item.fim_medicao),
        'Dias Medidos no Mês': isReap ? 'Taxa Única' : item.dias_medidos,
        'Valor Diária (R$)': isReap ? '-' : item.valor_diario,
        'Valor Mensal (R$)': isReap ? '-' : item.valor_mensal,
        'Valor Total Item (R$)': item.valor_total_item,
        'Status Preço': isReap ? 'COBRANÇA ÚNICA' : (item.tem_preco ? 'OK' : 'FALTA PREÇO')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Medicao_${selectedObra.numero_cc}`);
    XLSX.writeFile(workbook, `Medicao_Proprios_${selectedObra.numero_cc}_${mesAnoRef}.xlsx`);
    showToast('Planilha de medição baixada com sucesso!');
  };

  // Export list of items without price (pending prices)
  const exportarItensSemPreco = () => {
    if (!selectedObra) return;

    // Filter items in current obra that don't have price registered
    const semPreco = medicaoConsolidada.filter(item => !item.tem_preco || (item.valor_mensal === 0 && item.valor_diario === 0));

    if (semPreco.length === 0) {
      showToast('Nenhum item sem preço cadastrado encontrado na obra.', 'info');
      return;
    }

    // Deduplicate by cod_material
    const mapaUnicos = new Map<string, { cod: string; descricao: string }>();
    semPreco.forEach(item => {
      const codClean = String(item.cod_material || '').trim();
      if (codClean && !mapaUnicos.has(codClean.toUpperCase())) {
        mapaUnicos.set(codClean.toUpperCase(), {
          cod: codClean,
          descricao: item.descricao || ''
        });
      }
    });

    const dados = Array.from(mapaUnicos.values()).map(i => ({
      'COD': i.cod,
      'DESCRIÇÃO': i.descricao,
      'VALOR MENSAL': ''
    }));

    if (dados.length === 0) {
      showToast('Nenhum item com código válido sem preço foi encontrado.', 'info');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens_Sem_Preco');

    const nomeObraSanitizado = selectedObra.nome_obra.replace(/[\/\\?%*:|"<>]/g, '_').trim();
    XLSX.writeFile(workbook, `PENDENTES_PRECO_${nomeObraSanitizado}.xlsx`);

    showToast(`${dados.length} item(ns) sem preço exportado(s) com sucesso!`, 'success');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-3 sm:p-6 space-y-6">
      
      {/* Toast Notification Container */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs font-bold ${
              toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-800'
                : toast.type === 'info'
                ? 'bg-blue-950/90 text-blue-200 border-blue-800'
                : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER PRINCIPAL DO MÓDULO */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={selectedObra ? () => setSelectedObra(null) : onBackToHub}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 transition-all cursor-pointer group active:scale-95"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Gestão de Frotas & Ativos
              </span>
              {selectedObra && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedObra.numero_cc}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-amber-400" />
              <span>{selectedObra ? selectedObra.nome_obra : 'Torre de Controle — Medição de Próprios'}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {selectedObra 
                ? `Gestor: ${selectedObra.nome_gestor} • Início: ${selectedObra.data_inicio}`
                : 'Painel Consolidado de Custos de Locação e Ativos Alocados em Obras'}
            </p>
          </div>
        </div>

        {/* Dynamic Action Buttons on Header */}
        {!selectedObra ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor Mês/Ano Global */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <select
                value={mesAnoRef}
                onChange={(e) => setMesAnoRef(e.target.value)}
                className="bg-transparent text-xs font-bold text-amber-400 focus:outline-none cursor-pointer font-mono"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100 font-sans">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportRelatorioGlobal}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 text-xs font-bold rounded-2xl transition-all cursor-pointer shadow active:scale-95"
              title="Exportar Relatório Consolidado do Mês em Excel"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar Relatório Consolidado</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportGlobalModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 text-xs font-bold rounded-2xl transition-all cursor-pointer shadow"
              title="Importar Extrato Global em Lote do ERP"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              <span>Importar Extrato ERP</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBaseValoresModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-2xl transition-all cursor-pointer shadow"
            >
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span>Base de Valores ({valoresLocacao.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNovaObraModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg hover:shadow-amber-500/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Obra</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportMobilizacaoModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold rounded-xl transition-all cursor-pointer"
              title="Importar planilha de Entrada"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Mobilização</span>
            </button>
            <button
              type="button"
              onClick={() => setIsImportDesmobilizacaoModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 text-xs font-bold rounded-xl transition-all cursor-pointer"
              title="Importar planilha de Saída"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Desmobilização</span>
            </button>
            <button
              type="button"
              onClick={() => setIsManualMovModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 text-slate-950 font-black text-xs rounded-xl transition-all shadow cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Ativo</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DASHBOARD GLOBAL (TORRE DE CONTROLE) */}
      {/* ========================================================================= */}
      {!selectedObra && (
        <div className="space-y-6">
          {/* NAVEGAÇÃO DE ABAS DA TORRE DE CONTROLE (OBRAS VS BI) */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSwitchTab('obras')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTorreTab === 'obras'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Lista & Gestão de Obras ({obrasAtivas.length})</span>
              </button>
              
              <button
                type="button"
                onClick={() => handleSwitchTab('bi')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTorreTab === 'bi'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard de BI & Analytics</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  VISUAL
                </span>
              </button>
            </div>

            <div className="text-xs text-slate-400 font-mono font-bold px-3 py-1 bg-slate-950 rounded-xl border border-slate-800">
              {activeTorreTab === 'bi' ? 'Visão Consolidada de Métricas' : 'Visão Operacional de Contratos'}
            </div>
          </div>

          {activeTorreTab === 'bi' ? (
            <DashboardBIMedicao 
              obras={obras}
              movimentacoes={movimentacoes}
              valoresLocacao={valoresLocacao}
              mesAnoRef={mesAnoRef}
              onMesAnoRefChange={(newMes) => setMesAnoRef(newMes)}
              onBackToObras={() => handleSwitchTab('obras')}
              onRefreshData={async () => {
                setIsLoading(true);
                await fetchObras();
                await fetchValoresLocacao();
                await fetchMovimentacoes();
                setIsLoading(false);
              }}
              isLoading={isLoading}
            />
          ) : (
            <>
              {/* CARDS DE INDICADORES GERENCIAIS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* CARD 1: QUANTIDADE DE MOVIMENTAÇÕES */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Quantidade de Movimentações
                </span>
                <span className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                  <ArrowLeftRight className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4">
                <h2 className="text-3xl font-black text-white font-mono tracking-tight">
                  {globalCalculatedData.totalMovimentacoesMes}
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Entradas e saídas de frotas registradas no mês selecionado
                </p>
              </div>
            </div>

            {/* CARD 2: OBRAS ATIVAS IDENTIFICADAS */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Obras Ativas Identificadas
                </span>
                <span className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                  <Building2 className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4">
                <h2 className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                  {globalCalculatedData.obrasAtivasCount} <span className="text-sm text-slate-400 font-sans font-normal">/ {globalCalculatedData.totalObrasAtivas}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Obras com equipamentos alocados no mês de referência
                </p>
              </div>
            </div>

            {/* CARD 3: VALOR TOTAL DA MEDIÇÃO */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-28 h-28 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Valor Total da Medição (R$)
                </span>
                <span className="p-2.5 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20">
                  <DollarSign className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4">
                <h2 className="text-3xl font-black text-sky-400 font-mono tracking-tight">
                  {formatCurrencyBRL(globalCalculatedData.totalValorGlobal)}
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Valor total consolidado de faturamento no período
                </p>
              </div>
            </div>

            {/* CARD 4: ALERTA FINANCEIRO DE PREÇOS FALTANTES */}
            {globalCalculatedData.itensSemPreco.length === 0 ? (
              /* ESTADO SEGURO */
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Status de Preços
                  </span>
                  <span className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-4">
                  <h2 className="text-base font-black text-emerald-400 tracking-tight flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    Preços de Locação: Todos OK
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    Todos os equipamentos movimentados no mês possuem preço de diária cadastrado.
                  </p>
                </div>
              </div>
            ) : (
              /* ESTADO DE ALERTA */
              <div className="bg-rose-950/40 border-2 border-rose-500/60 rounded-3xl p-5 shadow-2xl shadow-rose-950/40 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                    Alerta Financeiro
                  </span>
                  <span className="p-2.5 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/40">
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                </div>
                <div className="mt-3">
                  <h2 className="text-sm font-black text-rose-300 tracking-tight leading-snug">
                    ⚠️ Alerta Financeiro: <span className="text-white font-mono font-black underline">{globalCalculatedData.itensSemPreco.length}</span> {globalCalculatedData.itensSemPreco.length === 1 ? 'item' : 'itens'} sem preço cadastrado
                  </h2>
                  <p className="text-[11px] text-rose-200/80 mt-1 font-medium">
                    Equipamentos movimentados no mês sem valor de diária.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleExportPendenciasPreco(globalCalculatedData.itensSemPreco)}
                  className="mt-3 w-full py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Relatório de Pendências</span>
                </button>
              </div>
            )}
          </div>

          {/* BANNER DE IMPORTAÇÃO INTELIGENTE DO ERP E REAPROVEITAMENTO */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Importador Inteligente Global & Reaproveitamento</span>
              </div>
              <h3 className="text-base font-black text-white">
                Roteamento Automático de Extrato & Vendas em Lote
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Suba o extrato do ERP contendo mobilizações/desmobilizações ou importe planilhas de <strong className="text-emerald-400 font-bold">Reaproveitamento (Cobrança Única)</strong> com criação automática de obras.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsImportReaproveitamentoModalOpen(true)}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg hover:shadow-emerald-500/20 cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>♻️ Importar Reaproveitamento</span>
              </button>
              <button
                type="button"
                onClick={() => setIsImportGlobalModalOpen(true)}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg hover:shadow-amber-500/20 cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Importar Extrato Global ERP</span>
              </button>
            </div>
          </div>

          {/* BARRA DE FILTRO E BUSCA */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                placeholder="Buscar por CC, Obra ou Gestor..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                {obrasAtivas.length} Obra(s) Ativa(s)
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 border border-slate-700 text-xs font-bold">
                {obrasInativas.length} Inativa(s)
              </span>
            </div>
          </div>

          {/* LISTAGEM DE OBRAS */}
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2 animate-pulse">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
              <span>Carregando Obras e Base de Dados...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SEÇÃO 1: GRID DE OBRAS ATIVAS (DESTAQUE VISUAL) */}
              {obrasAtivas.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
                  <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
                  <h3 className="text-xs font-black uppercase text-slate-300">Nenhuma Obra Ativa Encontrada</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {hubSearch ? 'Nenhuma obra ativa corresponde aos termos digitados.' : 'Não há obras com status Ativo cadastradas no momento.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNovaObraModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 font-black text-xs rounded-xl hover:bg-amber-400 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Nova Obra</span>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <span>Obras Ativas em Operação ({obrasAtivas.length})</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {obrasAtivas.map((ob) => {
                      const metrics = globalCalculatedData.obrasMetricsMap.get(ob.id);
                      const countAtivos = metrics?.countAtivos || 0;
                      const countFaltaPreco = metrics?.countFaltaPreco || 0;
                      const valorTotal = metrics?.valorTotal || 0;

                      return (
                        <motion.div
                          key={ob.id}
                          whileHover={{ y: -3 }}
                          onClick={() => setSelectedObra(ob)}
                          className={`relative rounded-3xl bg-slate-900/90 p-6 flex flex-col justify-between transition-all cursor-pointer group shadow-xl ${
                            countFaltaPreco > 0 
                              ? 'border-2 border-rose-500/60 hover:border-rose-400 shadow-rose-950/20' 
                              : 'border border-emerald-500/30 hover:border-emerald-400 hover:shadow-emerald-500/10'
                          }`}
                        >
                          {/* Top CC & Status Pill + Action Buttons */}
                          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-mono font-black">
                                {ob.numero_cc}
                              </span>

                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ATIVA
                              </span>

                              {countFaltaPreco > 0 && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1 animate-pulse" title={`${countFaltaPreco} equipamento(s) sem preço cadastrado`}>
                                  <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                                  <span>⚠️ Pendências de Preço</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">

                              <button
                                type="button"
                                onClick={(e) => handleOpenEditObra(ob, e)}
                                className="p-1.5 bg-amber-500/10 hover:bg-amber-500/30 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded-xl transition-all cursor-pointer group/edit"
                                title="Editar Obra"
                              >
                                <Edit3 className="w-3.5 h-3.5 group-hover/edit:scale-110 transition-transform" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleDeleteObra(ob.id, ob.nome_obra, e)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 rounded-xl transition-all cursor-pointer group/del"
                                title="Excluir Obra"
                              >
                                <Trash2 className="w-3.5 h-3.5 group-hover/del:scale-110 transition-transform" />
                              </button>
                            </div>
                          </div>

                          {/* Obra Title & Details */}
                          <div className="space-y-2 mb-6">
                            <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors line-clamp-2">
                              {ob.nome_obra}
                            </h3>
                            <div className="text-xs text-slate-400 space-y-1 font-medium">
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-slate-500" />
                                <span>Gestor: <strong className="text-slate-200">{ob.nome_gestor}</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                <span>Início: <strong className="text-slate-200">{ob.data_inicio}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Metric Badges for the Month */}
                          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 mb-4 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Ativos Medidos ({mesAnoRef}):</span>
                              <strong className="text-white font-mono">{countAtivos} item(ns)</strong>
                            </div>
                            
                            {countFaltaPreco > 0 && (
                              <div className="flex items-center justify-between text-rose-400 font-medium">
                                <span className="flex items-center gap-1 text-[11px]">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  Sem Preço Cadastrado:
                                </span>
                                <span className="px-1.5 py-0.5 bg-rose-500/20 border border-rose-500/30 rounded-md font-mono font-bold text-[10px]">
                                  {countFaltaPreco} pendência(s)
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-slate-300 font-bold">
                              <span>Medição do Mês:</span>
                              <strong className="text-amber-400 font-mono text-sm">{formatCurrencyBRL(valorTotal)}</strong>
                            </div>
                          </div>

                          {/* Card Footer Info */}
                          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Wrench className="w-4 h-4 text-amber-400" />
                              <span>Ver detalhes</span>
                            </div>
                            <span className="text-amber-400 font-black text-xs group-hover:underline flex items-center gap-1">
                              Acessar Medição →
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SEÇÃO 2: ACCORDION DE OBRAS INATIVAS / HISTÓRICAS */}
              {obrasInativas.length > 0 && (
                <div className="pt-4 border-t border-slate-800/80 space-y-4">
                  <button
                    type="button"
                    onClick={() => setShowInativas(!showInativas)}
                    className="w-full flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 rounded-2xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2 bg-slate-800 rounded-xl text-slate-400 group-hover:text-amber-400 transition-colors">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <div className="text-left">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-amber-400 transition-colors">
                          Ver Obras Inativas / Históricas ({obrasInativas.length})
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {showInativas ? 'Clique para ocultar as obras inativas' : 'Clique para expandir a lista de obras concluídas ou arquivadas'}
                        </p>
                      </div>
                    </div>
                    <span className="p-2 bg-slate-800 rounded-xl text-slate-400 group-hover:text-amber-400 transition-colors">
                      {showInativas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {showInativas && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
                      {obrasInativas.map((ob) => {
                        const metrics = globalCalculatedData.obrasMetricsMap.get(ob.id);
                        const countAtivos = metrics?.countAtivos || 0;
                        const countFaltaPreco = metrics?.countFaltaPreco || 0;
                        const valorTotal = metrics?.valorTotal || 0;

                        return (
                          <motion.div
                            key={ob.id}
                            whileHover={{ y: -3 }}
                            onClick={() => setSelectedObra(ob)}
                            className="relative rounded-3xl border border-slate-800/60 bg-slate-950/60 opacity-60 hover:opacity-90 hover:border-slate-700 p-6 flex flex-col justify-between transition-all cursor-pointer group shadow-xl"
                          >
                            {/* Top CC & Status Pill + Action Buttons */}
                            <div className="flex items-center justify-between mb-4">
                              <span className="px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl text-xs font-mono font-bold">
                                {ob.numero_cc}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                                  INATIVA
                                </span>

                                <button
                                  type="button"
                                  onClick={(e) => handleOpenEditObra(ob, e)}
                                  className="p-1.5 bg-amber-500/10 hover:bg-amber-500/30 text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded-xl transition-all cursor-pointer group/edit"
                                  title="Editar Obra"
                                >
                                  <Edit3 className="w-3.5 h-3.5 group-hover/edit:scale-110 transition-transform" />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteObra(ob.id, ob.nome_obra, e)}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 rounded-xl transition-all cursor-pointer group/del"
                                  title="Excluir Obra"
                                >
                                  <Trash2 className="w-3.5 h-3.5 group-hover/del:scale-110 transition-transform" />
                                </button>
                              </div>
                            </div>

                            {/* Obra Title & Details */}
                            <div className="space-y-2 mb-6">
                              <h3 className="text-base font-black text-slate-300 group-hover:text-amber-400 transition-colors line-clamp-2">
                                {ob.nome_obra}
                              </h3>
                              <div className="text-xs text-slate-500 space-y-1 font-medium">
                                <div className="flex items-center gap-2">
                                  <User className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Gestor: <strong className="text-slate-400">{ob.nome_gestor}</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-3.5 h-3.5 text-slate-600" />
                                  <span>Início: <strong className="text-slate-400">{ob.data_inicio}</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Metric Badges for the Month */}
                            <div className="bg-slate-950/80 border border-slate-900 rounded-2xl p-3 mb-4 space-y-2 text-xs">
                              <div className="flex items-center justify-between text-slate-500">
                                <span>Ativos Medidos ({mesAnoRef}):</span>
                                <strong className="text-slate-300 font-mono">{countAtivos} item(ns)</strong>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-900 pt-2 text-slate-400 font-bold">
                                <span>Medição do Mês:</span>
                                <strong className="text-slate-300 font-mono text-sm">{formatCurrencyBRL(valorTotal)}</strong>
                              </div>
                            </div>

                            {/* Card Footer Info */}
                            <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Wrench className="w-4 h-4 text-slate-500" />
                                <span>Ver detalhes</span>
                              </div>
                              <span className="text-slate-400 font-bold text-xs group-hover:underline flex items-center gap-1">
                                Acessar Medição →
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DETALHE DA OBRA E MEDIÇÃO MENSAL */}
      {/* ========================================================================= */}
      {selectedObra && (
        <div className="space-y-6">
          
          {/* CONTROLE MÊS DE REFERÊNCIA & METRICS BANNER */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6">
            
            {/* Seletor Mês/Ano */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <span className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                <Calendar className="w-5 h-5" />
              </span>
              <div className="w-full sm:w-auto">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Mês de Referência da Medição
                </label>
                <div className="mt-1">
                  <select
                    value={mesAnoRef}
                    onChange={(e) => setMesAnoRef(e.target.value)}
                    className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {monthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100 font-sans">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Totalizadores Financeiros em Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
              {/* Total Financeiro */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Custo Total Medido (Mês)
                </span>
                <span className="text-lg font-black text-amber-400 block">
                  {formatCurrencyBRL(totalMedidoMes)}
                </span>
              </div>

              {/* Ativos Medidos */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Ativos Medidos no Mês
                </span>
                <span className="text-lg font-black text-white block">
                  {countAtivosMedidos} item(ns)
                </span>
              </div>

              {/* Falta Preço Alert */}
              <div className={`border rounded-2xl p-4 space-y-1 ${
                countFaltaPreco > 0 
                  ? 'bg-rose-950/30 border-rose-800/80 text-rose-300' 
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider block">
                    Sem Preço Cadastrado
                  </span>
                  {countFaltaPreco > 0 && (
                    <button
                      type="button"
                      onClick={exportarItensSemPreco}
                      className="flex items-center gap-1 text-[11px] font-bold text-rose-300 hover:text-rose-100 underline decoration-rose-400/50 hover:decoration-rose-200 transition-all cursor-pointer"
                      title="Baixar lista em Excel de itens sem preço"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar Lista</span>
                    </button>
                  )}
                </div>
                <span className={`text-lg font-black block ${countFaltaPreco > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                  {countFaltaPreco > 0 ? `⚠️ ${countFaltaPreco} pendente(s)` : '✅ Todos OK'}
                </span>
              </div>
            </div>
          </div>

          {/* TABELA CONSOLIDADA DE MEDIÇÃO */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            
            {/* Table Filters & Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    placeholder="Filtrar Tag, Código ou Descrição..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <select
                  value={detailFilterPreco}
                  onChange={(e) => setDetailFilterPreco(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="TODOS">Todos os Preços</option>
                  <option value="FALTA_PRECO">⚠️ Apenas Sem Preço</option>
                  <option value="COM_PRECO">✅ Apenas Com Preço</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleExportSpreadsheet}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar Excel</span>
                </button>
              </div>
            </div>

            {/* Table Element */}
            {medicaoFiltrada.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs italic space-y-2">
                <p>Nenhuma movimentação registrada nesta obra no mês de referência ({mesAnoRef}).</p>
                <p className="not-italic text-[11px] text-amber-400 font-bold">
                  Dica: Utilize os botões no topo para Importar Mobilização ou Adicionar Ativos.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">Tag / Patrimônio</th>
                      <th className="py-3 px-3">Cód. Material</th>
                      <th className="py-3 px-3">Descrição do Ativo</th>
                      <th className="py-3 px-3">Classe</th>
                      <th className="py-3 px-3">Dt. Entrada</th>
                      <th className="py-3 px-3">Dt. Saída</th>
                      <th className="py-3 px-3">Início Med.</th>
                      <th className="py-3 px-3">Fim Med.</th>
                      <th className="py-3 px-3 text-center">Dias Medidos</th>
                      <th className="py-3 px-3 text-right">Diária (R$)</th>
                      <th className="py-3 px-3 text-right">Mensal (R$)</th>
                      <th className="py-3 px-3 text-right">Total Item (R$)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {medicaoFiltrada.map((item) => {
                      const isReap = item.modalidade === 'REAPROVEITAMENTO';
                      return (
                        <tr 
                          key={item.id}
                          className={`transition-colors ${
                            isReap
                              ? 'bg-emerald-950/30 hover:bg-emerald-950/40 border-l-4 border-l-emerald-500'
                              : !item.tem_preco
                              ? 'bg-rose-950/20 hover:bg-rose-950/30'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-black text-amber-400">
                            {item.tag}
                            {isReap && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                ♻️ REAP
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {item.cod_material}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-200 max-w-xs truncate" title={item.descricao}>
                            {item.descricao}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {item.classe && item.classe.trim() ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isReap ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60' : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}>
                                {item.classe}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800/80 text-slate-400 border border-slate-700/60">
                                Sem Classe
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {formatDateBR(item.data_entrada)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            {item.data_saida ? (
                              <span className="text-slate-300">{formatDateBR(item.data_saida)}</span>
                            ) : (
                              <span className="text-emerald-400 font-bold italic">Alocado</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                            {formatDateBR(item.inicio_medicao)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                            {formatDateBR(item.fim_medicao)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isReap ? (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg font-mono font-bold text-[10px]">
                                Taxa Única
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg font-mono font-bold">
                                {item.dias_medidos} d
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {isReap ? '-' : item.tem_preco ? formatCurrencyBRL(item.valor_diario) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {isReap ? '-' : item.tem_preco ? formatCurrencyBRL(item.valor_mensal) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400">
                            {formatCurrencyBRL(item.valor_total_item)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isReap ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                COBRANÇA ÚNICA
                              </span>
                            ) : item.tem_preco ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                OK
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                                Falta Preço
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {!item.tem_preco && !isReap && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickValorItem({
                                      cod_material: item.cod_material,
                                      descricao: item.descricao
                                    });
                                    setQuickValorInput('');
                                  }}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black rounded-lg transition-all shadow cursor-pointer active:scale-95"
                                  title="Inserir preço para este material"
                                >
                                  Inserir Valor
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteMovimentacao(item.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Excluir movimentação"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGRA DE NEGÓCIO - FAST ACTION "INSERIR VALOR" */}
      {/* ========================================================================= */}
      {quickValorItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <DollarSign className="w-4 h-4" />
                </span>
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Inserir Valor de Locação (Ativo Sem Preço)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickValorItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3.5 space-y-1 text-xs">
              <div className="text-slate-400">
                Código: <strong className="text-amber-400 font-mono">{quickValorItem.cod_material}</strong>
              </div>
              <div className="text-slate-200 font-medium">
                {quickValorItem.descricao}
              </div>
            </div>

            <form onSubmit={handleSaveQuickValor} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-slate-400">
                  Valor Mensal da Locação (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="Ex: 3000.00"
                  value={quickValorInput}
                  onChange={(e) => setQuickValorInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm font-bold focus:outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-500 block">
                  O valor diário será calculado automaticamente como <strong>Valor Mensal / 30</strong>.
                </span>
              </div>

              {quickValorInput && !isNaN(parseFloat(quickValorInput)) && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center justify-between">
                  <span>Diária Estimada:</span>
                  <strong className="font-mono">{formatCurrencyBRL(parseFloat(quickValorInput) / 30)}</strong>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuickValorItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow cursor-pointer"
                >
                  Salvar e Recalcular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVA OBRA */}
      {/* ========================================================================= */}
      {isNovaObraModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Cadastrar Nova Obra (Centro de Custo)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNovaObraModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNovaObra} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Número do CC *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: CC-1048"
                    value={novaObraForm.numero_cc}
                    onChange={(e) => setNovaObraForm({ ...novaObraForm, numero_cc: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    required
                    value={novaObraForm.data_inicio}
                    onChange={(e) => setNovaObraForm({ ...novaObraForm, data_inicio: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Nome da Obra *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Obra de Expansão Linha Verde - Vale"
                  value={novaObraForm.nome_obra}
                  onChange={(e) => setNovaObraForm({ ...novaObraForm, nome_obra: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Gestor Responsável
                </label>
                <input
                  type="text"
                  placeholder="Ex: Eng. Marcio Santos"
                  value={novaObraForm.nome_gestor}
                  onChange={(e) => setNovaObraForm({ ...novaObraForm, nome_gestor: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="obra-status-check"
                  checked={novaObraForm.status}
                  onChange={(e) => setNovaObraForm({ ...novaObraForm, status: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="obra-status-check" className="text-xs font-bold text-slate-300 cursor-pointer">
                  Obra Ativa (Exibir no Hub e permitir medições)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNovaObraModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
                >
                  Salvar Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR OBRA (CENTRO DE CUSTO) */}
      {/* ========================================================================= */}
      {isEditObraModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Editar Obra (Centro de Custo)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditObraModalOpen(false);
                  setEditingObra(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditObra} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Número do CC *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: CC-1048"
                    value={editObraForm.numero_cc}
                    onChange={(e) => setEditObraForm({ ...editObraForm, numero_cc: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={editObraForm.data_inicio}
                    onChange={(e) => setEditObraForm({ ...editObraForm, data_inicio: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Nome da Obra *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Obra Residencial Horizon"
                  value={editObraForm.nome_obra}
                  onChange={(e) => setEditObraForm({ ...editObraForm, nome_obra: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Gestor Responsável
                </label>
                <input
                  type="text"
                  placeholder="Ex: Eng. Marcio Santos"
                  value={editObraForm.nome_gestor}
                  onChange={(e) => setEditObraForm({ ...editObraForm, nome_gestor: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-obra-status-check"
                  checked={editObraForm.status}
                  onChange={(e) => setEditObraForm({ ...editObraForm, status: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="edit-obra-status-check" className="text-xs font-bold text-slate-300 cursor-pointer">
                  Obra Ativa (Exibir no Hub e permitir medições)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditObraModalOpen(false);
                    setEditingObra(null);
                  }}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BASE DE VALORES DE LOCAÇÃO */}
      {/* ========================================================================= */}
      {isBaseValoresModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Base de Valores de Locação de Materiais
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBaseValoresModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Import Planilha de Valores */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                  Upload em Lote (Planilha XLS / XLSX / CSV)
                </span>
                <span className="text-[9px] font-mono uppercase bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Supabase Database Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                A planilha deve conter as colunas: <strong className="text-amber-300 font-mono">codMaterial</strong> (ou <strong className="text-amber-300 font-mono">COD</strong>), <strong className="text-amber-300 font-mono">DESCRIÇÃO</strong>, <strong className="text-amber-300 font-mono">MÊS </strong> (ou <strong className="text-amber-300 font-mono">VALOR </strong>) e <strong className="text-amber-300 font-mono">DIA</strong>.
              </p>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <input
                  ref={valoresFileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileSelectBaseValores}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleImportPlanilhaBaseValores}
                  disabled={!selectedValoresFile || isImportingValores}
                  className="px-4 py-2.5 bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shadow transition-all"
                >
                  {isImportingValores ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Importar Planilha
                    </>
                  )}
                </button>
              </div>

              {selectedValoresFile && (
                <div className="flex items-center gap-2 pt-1 text-amber-400 text-xs font-mono">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Arquivo pronto: <strong>{selectedValoresFile.name}</strong></span>
                </div>
              )}

              {/* TODO: DELETAR ESTE BOTÃO APÓS A CARGA DE CLASSES */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <input
                  ref={classesFileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImportarClasses}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => classesFileInputRef.current?.click()}
                  disabled={isImportingClasses}
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40 transition-all border border-purple-400/40 active:scale-95"
                >
                  {isImportingClasses ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Carregando... Atualizando banco</span>
                    </>
                  ) : (
                    <>
                      <span>🛠️ [TEMP] Injetar Classes (Excel)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inserção Manual Rápida */}
            <form onSubmit={handleSaveManualValorLocacao} className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
              <input
                type="text"
                placeholder="Cód. Material"
                value={novoValorForm.cod_material}
                onChange={(e) => setNovoValorForm({ ...novoValorForm, cod_material: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <input
                type="text"
                placeholder="Descrição"
                value={novoValorForm.descricao}
                onChange={(e) => setNovoValorForm({ ...novoValorForm, descricao: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-400 sm:col-span-1"
              />
              <input
                type="text"
                placeholder="Classe"
                value={novoValorForm.classe}
                onChange={(e) => setNovoValorForm({ ...novoValorForm, classe: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Valor Mensal (R$)"
                value={novoValorForm.valor_mensal}
                onChange={(e) => setNovoValorForm({ ...novoValorForm, valor_mensal: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-amber-500 text-slate-950 font-black text-xs rounded-xl hover:bg-amber-400 cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Item
              </button>
            </form>

            {/* Header com Filtro e Contador de Preços */}
            <div className="space-y-2 pt-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Itens Cadastrados na Base ({filteredValoresLocacao.length} de {valoresLocacao.length})
                </span>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar por código, descrição ou classe..."
                      value={valoresSearch}
                      onChange={(e) => setValoresSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchValoresLocacao}
                    title="Atualizar dados do banco"
                    className="p-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tabela de Preços Cadastrados */}
              <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl custom-scrollbar">
                {filteredValoresLocacao.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <DollarSign className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-bold">
                      Nenhum valor cadastrado. Faça a importação da planilha para popular a base.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-black sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Cód. Material</th>
                        <th className="p-2.5">Descrição</th>
                        <th className="p-2.5">Classe</th>
                        <th className="p-2.5 text-right">Valor Mensal (R$)</th>
                        <th className="p-2.5 text-right">Diária Estimada (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredValoresLocacao.map((v) => (
                        <tr key={v.cod_material} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-2.5 font-mono font-bold text-amber-400">{v.cod_material}</td>
                          <td className="p-2.5 text-slate-300 font-sans">{v.descricao}</td>
                          <td className="p-2.5 text-slate-400 font-mono text-[11px] font-medium">{v.classe || '-'}</td>
                          <td className="p-2.5 text-right font-mono text-white font-bold">{formatCurrencyBRL(v.valor_mensal)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-400 font-bold">{formatCurrencyBRL(v.valor_diario)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPORTAR MOBILIZAÇÃO (ENTRADA) */}
      {/* ========================================================================= */}
      {isImportMobilizacaoModalOpen && selectedObra && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Importar Mobilização (Entradas na Obra)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportMobilizacaoModalOpen(false);
                  setSelectedMobFile(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Carregue a planilha em Excel do ERP contendo as colunas: <strong className="text-emerald-300 font-mono">Tag</strong>, <strong className="text-emerald-300 font-mono">NM Material</strong>, <strong className="text-emerald-300 font-mono">Descrição Material/Equipamento</strong> e <strong className="text-emerald-300 font-mono">Dt Movimento</strong>.
            </p>

            <div className="space-y-3 pt-1">
              <input
                ref={mobFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleSelectMobilizacaoFile}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />

              {selectedMobFile && (
                <div className="flex items-center gap-2 p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-emerald-400 text-xs font-mono">
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span className="truncate">Arquivo selecionado: <strong>{selectedMobFile.name}</strong></span>
                </div>
              )}

              <button
                type="button"
                onClick={handleImportMobilizacaoPlanilha}
                disabled={!selectedMobFile || isImportingMob}
                className="w-full py-3 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow transition-all"
              >
                {isImportingMob ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando Entradas no Supabase...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar Planilha de Mobilização
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPORTAR DESMOBILIZAÇÃO (SAÍDA) */}
      {/* ========================================================================= */}
      {isImportDesmobilizacaoModalOpen && selectedObra && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-rose-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Importar Desmobilização (Saídas de Ativos)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportDesmobilizacaoModalOpen(false);
                  setSelectedDesmobFile(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Carregue a planilha do ERP contendo as colunas: <strong className="text-rose-300 font-mono">Tag</strong>, <strong className="text-rose-300 font-mono">NM Material</strong>, <strong className="text-rose-300 font-mono">Descrição Material/Equipamento</strong> e <strong className="text-rose-300 font-mono">Dt Movimento</strong>. O sistema irá atualizar a <strong className="text-white">data de saída</strong> no registro ativo desta obra.
            </p>

            <div className="space-y-3 pt-1">
              <input
                ref={desmobFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleSelectDesmobilizacaoFile}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />

              {selectedDesmobFile && (
                <div className="flex items-center gap-2 p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-400 text-xs font-mono">
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  <span className="truncate">Arquivo selecionado: <strong>{selectedDesmobFile.name}</strong></span>
                </div>
              )}

              <button
                type="button"
                onClick={handleImportDesmobilizacaoPlanilha}
                disabled={!selectedDesmobFile || isImportingDesmob}
                className="w-full py-3 bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-rose-400 disabled:opacity-40 disabled:hover:bg-rose-500 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow transition-all"
              >
                {isImportingDesmob ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Registrando Saídas no Supabase...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importar Planilha de Desmobilização
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR MOVIMENTAÇÃO MANUAL */}
      {/* ========================================================================= */}
      {isManualMovModalOpen && selectedObra && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Cadastrar Ativo Manualmente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsManualMovModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualMovimentacao} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tag / Patrimônio *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: CMP-101"
                  value={novaMovForm.tag}
                  onChange={(e) => setNovaMovForm({ ...novaMovForm, tag: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Cód. Material *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: FER-001"
                  value={novaMovForm.cod_material}
                  onChange={(e) => setNovaMovForm({ ...novaMovForm, cod_material: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Compressor de Ar 250 CFM"
                  value={novaMovForm.descricao}
                  onChange={(e) => setNovaMovForm({ ...novaMovForm, descricao: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data Entrada *</label>
                  <input
                    type="date"
                    required
                    value={novaMovForm.data_entrada}
                    onChange={(e) => setNovaMovForm({ ...novaMovForm, data_entrada: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Data Saída (Opcional)</label>
                  <input
                    type="date"
                    value={novaMovForm.data_saida}
                    onChange={(e) => setNovaMovForm({ ...novaMovForm, data_saida: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsManualMovModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPORTAR PLANILHA DE REAPROVEITAMENTO */}
      {/* ========================================================================= */}
      {isImportReaproveitamentoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Importar Planilha de Reaproveitamento
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportReaproveitamentoModalOpen(false);
                  setSelectedReapFile(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Suba a planilha Excel (<span className="font-mono text-emerald-400 font-bold">.xls / .xlsx</span>) de reaproveitamento. O sistema verifica a coluna <strong className="text-white font-bold font-mono">CENTRO DE CUSTO</strong>, cria automaticamente as Obras que ainda não existirem no banco, e lança os itens como <strong className="text-emerald-400 font-bold">Cobrança Única / Taxa Única</strong>.
            </p>

            <div className="space-y-3 pt-1">
              <input
                ref={reapFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleSelectReapFile}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-emerald-950/60 file:text-emerald-200 hover:file:bg-emerald-900 cursor-pointer border border-slate-800 rounded-xl"
              />

              {selectedReapFile && (
                <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs font-mono">
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="truncate">Planilha Selecionada: <strong>{selectedReapFile.name}</strong></span>
                </div>
              )}

              <button
                type="button"
                onClick={handleImportReaproveitamentoPlanilha}
                disabled={!selectedReapFile || isImportingReap}
                className="w-full py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
              >
                {isImportingReap ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando Reaproveitamentos...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Processar e Importar Reaproveitamentos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPORTAR EXTRATO GLOBAL DO ERP */}
      {/* ========================================================================= */}
      {isImportGlobalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-wider">
                  Importar Extrato Global ERP (Todas as Obras)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportGlobalModalOpen(false);
                  setSelectedGlobalFile(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              O sistema lê o arquivo do ERP, identifica automaticamente se a movimentação é de <strong className="text-emerald-400 font-mono">Entrada (Mobilização)</strong> ou <strong className="text-rose-400 font-mono">Saída (Desmobilização)</strong> através dos Centros de Custo de Origem/Destino e distribui os lançamentos para todas as Obras cadastradas.
            </p>

            <div className="space-y-3 pt-1">
              <input
                ref={globalFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleSelectGlobalFile}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />

              {selectedGlobalFile && (
                <div className="flex items-center gap-2 p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-300 text-xs font-mono">
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-amber-400" />
                  <span className="truncate">Extrato Selecionado: <strong>{selectedGlobalFile.name}</strong></span>
                </div>
              )}

              <button
                type="button"
                onClick={handleImportExtratoGlobalERP}
                disabled={!selectedGlobalFile || isImportingGlobal}
                className="w-full py-3 bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
              >
                {isImportingGlobal ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando Roteamento Global ERP...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Processar Extrato Global ERP
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
