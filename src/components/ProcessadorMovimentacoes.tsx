import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  Upload, 
  Play, 
  Download, 
  Trash2, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Database,
  RefreshCw,
  Search,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  HelpCircle,
  Clock,
  DollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ProcessadorMovimentacoesProps {
  onBackToHub: () => void;
}

// Key data structure interfaces
interface Asset {
  tag: string;
  status: 'Ativo' | 'Devolvido' | string;
  dataInicio: string;
  dataFim: string;
  depositoDestino: string;
  documento: string;
  documentoRetorno?: string;
  classe: string;
  descricao: string;
  um: string;
  valorUnitario: number;
  codMaterial?: string;
  originalStatus?: string; // For visual diffing
  source: 'base' | 'novo';
  rawRow?: Record<string, any>;
  diasCobranca?: number;
  valorDiario?: number;
  valorTotalCobranca?: number;
}

interface Movement {
  tag: string;
  data: string;
  motivo: string;
  depositoDestino: string;
  documento: string;
  rawRowIndex: number;
  descricao?: string;
  classe?: string;
  usuario?: string;
}

interface Classification {
  tag: string;
  classe: string;
  descricao: string;
  um: string;
}

interface PriceUpdate {
  tag: string;
  valorUnitario: number;
}

export default function ProcessadorMovimentacoes({ onBackToHub }: ProcessadorMovimentacoesProps) {
  // Local state for loaded files raw JSON data
  const [movimentacoesData, setMovimentacoesData] = useState<Movement[] | null>(null);
  const [baseDadosData, setBaseDadosData] = useState<Asset[] | null>(null);
  const [classificacoesData, setClassificacoesData] = useState<Classification[] | null>(null);
  const [atualizacoesData, setAtualizacoesData] = useState<PriceUpdate[] | null>(null);
  const [valoresMedicaoData, setValoresMedicaoData] = useState<Record<string, number> | null>(null);

  // File tracking states for UI indicators
  const [filesStatus, setFilesStatus] = useState({
    movimentacoes: { name: '', loaded: false, count: 0 },
    baseDados: { name: '', loaded: false, count: 0 },
    classificacao: { name: '', loaded: false, count: 0, isOptional: true },
    atualizacao: { name: '', loaded: false, count: 0, isOptional: true },
    valoresMedicao: { name: '', loaded: false, count: 0, isOptional: true }
  });

  // Processing results state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedAssets, setProcessedAssets] = useState<Asset[] | null>(null);
  const [originalAssetsMap, setOriginalAssetsMap] = useState<Record<string, Asset>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'Ativo' | 'Devolvido' | 'novo'>('todos');
  const [extendParados, setExtendParados] = useState(false);
  const [discardedMovements, setDiscardedMovements] = useState<{ row: any; reason: string }[]>([]);

  // Dashboard Stats
  const [stats, setStats] = useState({
    totalRead: 0,
    validTags: 0,
    mobilizacoesNovas: 0,
    mobilizacoesAtualizadas: 0,
    desmobilizacoes: 0,
    periodoAnalise: 'Não identificado'
  });

  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Auto dismiss alert
  useEffect(() => {
    if (alert) {
      const t = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(t);
    }
  }, [alert]);

  // Helper to parse dates robustly
  const parseExcelDate = (val: any): string => {
    if (!val) return '';
    
    // If it's already a string in standard date format (YYYY-MM-DD)
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return val;
    }
    
    // If it's DD/MM/YYYY or similar
    if (typeof val === 'string' && val.includes('/')) {
      const parts = val.split('/');
      if (parts.length === 3) {
        // Assume DD/MM/YYYY
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year; // handle 2-digit years
        return `${year}-${month}-${day}`;
      }
    }

    // If it's DD-MM-YYYY or similar
    if (typeof val === 'string' && val.includes('-') && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const parts = val.split('-');
      if (parts.length === 3) {
        // If the third part has 4 digits, assume DD-MM-YYYY
        if (parts[2].trim().length === 4) {
          let day = parts[0].trim().padStart(2, '0');
          let month = parts[1].trim().padStart(2, '0');
          let year = parts[2].trim();
          return `${year}-${month}-${day}`;
        }
      }
    }

    // If it's a SheetJS serial number or float
    if (typeof val === 'number') {
      try {
        const dateObj = new Date((val - 25569) * 86400 * 1000);
        if (dateObj && !isNaN(dateObj.getTime())) {
          // Add timezone offset correction
          const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
          const correctedDate = new Date(dateObj.getTime() + userTimezoneOffset);
          const y = correctedDate.getFullYear();
          const m = String(correctedDate.getMonth() + 1).padStart(2, '0');
          const d = String(correctedDate.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      } catch (e) {}
    }

    // Try parsing as standard date
    try {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch (e) {}

    return String(val);
  };

  // Helper to normalize keys to lowercase and alphanumeric
  const normalizeKey = (key: string): string => {
    return key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]/g, ''); // alphanumeric only
  };

  // Helper to universally normalize strings (remove accents, trim, uppercase)
  const normalizeStr = (str: any): string => {
    if (str === null || str === undefined) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .trim()
      .toUpperCase();
  };

  // Process a loaded sheet to match our targets
  const processWorkbookSheets = (workbook: XLSX.WorkBook, filename: string) => {
    let matchedAny = false;

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
      if (rawData.length === 0) return;

      const normalizedSheetName = normalizeKey(sheetName);
      const normalizedFilename = normalizeKey(filename);

      // Determine which bucket this sheet belongs to
      // Priority 1: Specific sheet names
      // Priority 2: File name substring match if single sheet
      let bucket: 'movimentacoes' | 'baseDados' | 'classificacao' | 'atualizacao' | 'valoresMedicao' | null = null;

      if (normalizedSheetName.includes('movimentacao') || normalizedSheetName.includes('movimentacoes') || normalizedSheetName.includes('movimento') || normalizedSheetName === 'mov') {
        bucket = 'movimentacoes';
      } else if (normalizedSheetName.includes('basedados') || (normalizedSheetName.includes('base') && !normalizedSheetName.includes('valores') && !normalizedSheetName.includes('atualizac'))) {
        bucket = 'baseDados';
      } else if (normalizedSheetName.includes('classificacao') || normalizedSheetName.includes('classificacoes')) {
        bucket = 'classificacao';
      } else if (normalizedSheetName.includes('atualizacao') || normalizedSheetName.includes('atualizacoes')) {
        bucket = 'atualizacao';
      } else if (normalizedSheetName.includes('valores') || normalizedSheetName.includes('medicao')) {
        bucket = 'valoresMedicao';
      } else {
        // Fallback to filename matching
        if (normalizedFilename.includes('movimentacao') || normalizedFilename.includes('movimentacoes') || normalizedFilename.includes('movimento') || normalizedFilename.includes('mov')) {
          bucket = 'movimentacoes';
        } else if (normalizedFilename.includes('basedados') || (normalizedFilename.includes('base') && !normalizedFilename.includes('valores') && !normalizedFilename.includes('atualizac')) || normalizedFilename.includes('bd')) {
          bucket = 'baseDados';
        } else if (normalizedFilename.includes('classificacao') || normalizedFilename.includes('classificacoes') || normalizedFilename.includes('class')) {
          bucket = 'classificacao';
        } else if (normalizedFilename.includes('atualizacao') || normalizedFilename.includes('atualizacoes') || normalizedFilename.includes('preco')) {
          bucket = 'atualizacao';
        } else if (normalizedFilename.includes('valores') || normalizedFilename.includes('medicao') || normalizedFilename.includes('valor')) {
          bucket = 'valoresMedicao';
        }
      }

      // Final fallback: Column-based auto-detection if still not matched
      if (!bucket && rawData.length > 0) {
        const firstRow = rawData[0];
        const rowKeys = Object.keys(firstRow);
        const hasTag = rowKeys.some(k => k.toUpperCase().includes('TAG'));
        
        const hasMotivo = rowKeys.some(k => {
          const norm = normalizeKey(k);
          return norm.includes('motivo') || norm.includes('operacao') || norm.includes('tipo') || norm.includes('movimentacao');
        });
        
        const hasStatus = rowKeys.some(k => normalizeKey(k).includes('status') || normalizeKey(k).includes('situacao'));
        const hasClasse = rowKeys.some(k => normalizeKey(k).includes('classe') || normalizeKey(k).includes('grupo'));
        const hasDescricao = rowKeys.some(k => normalizeKey(k).includes('descricao') || normalizeKey(k).includes('atrib') || normalizeKey(k).includes('nome') || normalizeKey(k).includes('equipamento'));
        const hasValor = rowKeys.some(k => normalizeKey(k).includes('valor') || normalizeKey(k).includes('preco'));
        const hasDia = rowKeys.some(k => normalizeKey(k) === 'dia' || normalizeKey(k) === 'vlrdia');

        if (hasTag && hasMotivo) {
          bucket = 'movimentacoes';
        } else if (hasTag && hasStatus) {
          bucket = 'baseDados';
        } else if (hasClasse && hasDescricao && !hasStatus) {
          bucket = 'classificacao';
        } else if (hasTag && hasValor) {
          bucket = 'atualizacao';
        } else if (hasDia) {
          bucket = 'valoresMedicao';
        }
      }

      if (!bucket) return;

      matchedAny = true;

      // Now map and validate based on the detected bucket
      if (bucket === 'movimentacoes') {
        const mapped: Movement[] = rawData.map((row, idx) => {
          const keys = Object.keys(row);
          // Find tag key
          const tagKey = keys.find(k => normalizeStr(k).includes('TAG'));
          
          const dateKey = keys.find(k => {
            const norm = normalizeStr(k);
            return norm === 'DATA' || norm === 'DT' || norm === 'DATAMOVIMENTACAO' || norm.includes('DT MOVIMENTO') || norm.includes('DATA MOVIMENTACAO') || norm.includes('DATA MOVIMENTO') || norm.includes('DT EMISSAO');
          }) || keys.find(k => {
            const norm = normalizeStr(k);
            return (norm.includes('DATA') || norm.includes('DT')) && !norm.includes('INICIO') && !norm.includes('FIM') && !norm.includes('RETORNO');
          });

          const motivoKey = keys.find(k => {
            const norm = normalizeStr(k);
            return norm === 'MOTIVO' || norm === 'OPERACAO' || norm === 'TIPO' || norm.includes('MOTIVO') || norm.includes('OPERACAO') || norm.includes('TIPO') || norm.includes('EVENTO') || norm.includes('MOVIMENTACAO');
          });

          const depKey = keys.find(k => {
            const norm = normalizeStr(k);
            return norm.includes('DEPOSITO') || norm.includes('DESTINO') || norm.includes('LOCAL') || norm.includes('OBRA') || norm.includes('FILIAL') || norm.includes('ORIGEM');
          });

          const docKey = keys.find(k => {
            const norm = normalizeStr(k);
            return norm.includes('DOCUMENTO') || norm === 'DOC' || norm.includes('NF') || norm.includes('NOTA') || norm.includes('REG');
          });

          const userKey = keys.find(k => normalizeStr(k).includes('USER') || normalizeStr(k).includes('USUARIO'));

          const tagValue = normalizeStr(row[tagKey || '']);
          const motivoValue = normalizeStr(row[motivoKey || '']);

          const descKey = keys.find(k => normalizeStr(k).includes('DESCRI'));
          const classKey = keys.find(k => normalizeStr(k).includes('CLASSE') || normalizeStr(k).includes('FAMILIA') || normalizeStr(k).includes('GRUPO'));

          return {
            tag: tagValue,
            data: parseExcelDate(row[dateKey || ''] || row['Data'] || row['data']),
            motivo: motivoValue,
            depositoDestino: String(row[depKey || ''] || '').trim(),
            documento: String(row[docKey || ''] || '').trim(),
            descricao: descKey ? String(row[descKey] || '').trim() : '',
            classe: classKey ? String(row[classKey] || '').trim() : '',
            usuario: userKey ? String(row[userKey] || '').trim() : '',
            rawRowIndex: idx + 2
          };
        });

        setMovimentacoesData(mapped);
        setFilesStatus(prev => ({
          ...prev,
          movimentacoes: { name: `${filename} (${sheetName})`, loaded: true, count: mapped.length }
        }));
      } else if (bucket === 'baseDados') {
        const mapped: Asset[] = rawData.map((row) => {
          const keys = Object.keys(row);
          const tagKey = keys.find(k => normalizeStr(k).includes('TAG'));
          const statusKey = keys.find(k => normalizeStr(k).includes('STATUS') || normalizeStr(k).includes('SITUACAO'));
          const startKey = keys.find(k => normalizeStr(k).includes('DATA INICIO') || normalizeStr(k).includes('DATA_INICIO') || normalizeStr(k).includes('DT INI') || normalizeStr(k).includes('INICIO') || normalizeStr(k).includes('DATAINICIO') || normalizeStr(k).includes('INIC') || normalizeStr(k) === 'DT. INICIAL');
          const endKey = keys.find(k => normalizeStr(k).includes('DATA FIM') || normalizeStr(k).includes('DATA_FIM') || normalizeStr(k).includes('DT FIM') || normalizeStr(k).includes('FIM') || normalizeStr(k).includes('DATAFIM') || normalizeStr(k) === 'DT. FINAL');
          const depKey = keys.find(k => normalizeStr(k).includes('DEPOSITO') || normalizeStr(k).includes('DESTINO') || normalizeStr(k).includes('LOCAL') || normalizeStr(k).includes('OBRA') || normalizeStr(k) === 'DESCRICAODEPOSITODEST');
          const docKey = keys.find(k => normalizeStr(k) === 'DOCUMENTO' || normalizeStr(k) === 'DOC' || normalizeStr(k).includes('DOCUMENTO') || normalizeStr(k).includes('NF') || normalizeStr(k).includes('NOTA') || normalizeStr(k).includes('REG') || normalizeStr(k) === 'NºDOCUMENTO');
          const docRetKey = keys.find(k => normalizeStr(k).includes('RETORNO') || normalizeStr(k).includes('DOC RET') || normalizeStr(k).includes('DOCUMENTORETORNO') || normalizeStr(k) === 'DOC. DE RETORNO');
          const classKey = keys.find(k => normalizeStr(k).includes('CLASSE') || normalizeStr(k).includes('GRUPO'));
          const descKey = keys.find(k => normalizeStr(k).includes('DESCRICAO') || normalizeStr(k).includes('NOME') || normalizeStr(k).includes('EQUIPAMENTO') || normalizeStr(k).includes('ATRIB') || normalizeStr(k) === 'DESCRICAOMATERIAL');
          const umKey = keys.find(k => normalizeStr(k) === 'UM' || normalizeStr(k).includes('UNIDADE') || normalizeStr(k) === 'UN' || normalizeStr(k) === 'IDUM');
          const valKey = keys.find(k => normalizeStr(k).includes('VALOR') || normalizeStr(k).includes('PRECO') || normalizeStr(k).includes('UNITARIO') || normalizeStr(k) === 'VALORUN');
          const codMatKey = keys.find(k => normalizeStr(k).includes('CODMATERIAL') || (normalizeStr(k).includes('COD') && normalizeStr(k).includes('MAT')));

          const tagValue = normalizeStr(row[tagKey || '']);

          return {
            tag: tagValue,
            status: String(row[statusKey || ''] || 'Ativo').trim(),
            dataInicio: parseExcelDate(row[startKey || ''] || ''),
            dataFim: parseExcelDate(row[endKey || ''] || ''),
            depositoDestino: String(row[depKey || ''] || '').trim(),
            documento: String(row[docKey || ''] || '').trim(),
            documentoRetorno: String(row[docRetKey || ''] || '').trim(),
            classe: String(row[classKey || ''] || '').trim(),
            descricao: String(row[descKey || ''] || '').trim(),
            um: String(row[umKey || ''] || 'UN').trim(),
            valorUnitario: Number(row[valKey || ''] || 0),
            codMaterial: String(row[codMatKey || ''] || '').trim(),
            source: 'base',
            rawRow: row
          };
        });

        setBaseDadosData(mapped);
        setFilesStatus(prev => ({
          ...prev,
          baseDados: { name: `${filename} (${sheetName})`, loaded: true, count: mapped.length }
        }));
      } else if (bucket === 'classificacao') {
        const mapped: Classification[] = rawData.map((row) => {
          const keys = Object.keys(row);
          const tagKey = keys.find(k => normalizeStr(k).includes('TAG'));
          const classKey = keys.find(k => normalizeStr(k).includes('FAMILIA') || normalizeStr(k).includes('CLASSE')) || keys.find(k => normalizeStr(k).includes('GRUPO'));
          const descKey = keys.find(k => normalizeStr(k).includes('DESCRI')) || keys.find(k => normalizeStr(k).includes('NOME') || normalizeStr(k).includes('EQUIPAMENTO') || normalizeStr(k).includes('ATRIB'));
          const umKey = keys.find(k => normalizeStr(k) === 'UM' || normalizeStr(k).includes('UNIDADE') || normalizeStr(k) === 'UN');

          const tagValue = normalizeStr(row[tagKey || '']);

          return {
            tag: tagValue,
            classe: classKey ? String(row[classKey] || '').trim() : '',
            descricao: descKey ? String(row[descKey] || '').trim() : '',
            um: String(row[umKey || ''] || 'UN').trim()
          };
        });

        setClassificacoesData(mapped);
        setFilesStatus(prev => ({
          ...prev,
          classificacao: { name: `${filename} (${sheetName})`, loaded: true, count: mapped.length, isOptional: true }
        }));
      } else if (bucket === 'atualizacao') {
        const mapped: PriceUpdate[] = rawData.map((row) => {
          const keys = Object.keys(row);
          const tagKey = keys.find(k => normalizeStr(k).includes('TAG') || normalizeStr(k).includes('COD') || normalizeStr(k).includes('MATERIAL'));
          const valKey = keys.find(k => normalizeStr(k).includes('VALOR') || normalizeStr(k).includes('PRECO') || normalizeStr(k).includes('UNITARIO') || normalizeStr(k) === 'VALORUN');

          const tagValue = normalizeStr(row[tagKey || '']);

          return {
            tag: tagValue,
            valorUnitario: Number(row[valKey || ''] || 0)
          };
        });

        setAtualizacoesData(mapped);
        setFilesStatus(prev => ({
          ...prev,
          atualizacao: { name: `${filename} (${sheetName})`, loaded: true, count: mapped.length, isOptional: true }
        }));
      } else if (bucket === 'valoresMedicao') {
        const mappedValores: Record<string, number> = {};
        rawData.forEach((row) => {
          const keys = Object.keys(row);
          const codKey = keys.find(k => {
            const norm = normalizeStr(k);
            return norm.includes('CODMATERIAL') || norm === 'COD' || norm.includes('CODIGO') || norm === 'COD_MATERIAL' || norm === 'MATERIAL';
          });
          const diaKey = keys.find(k => {
            const norm = normalizeStr(k);
            return norm === 'DIA' || norm === 'VLR DIA' || norm === 'VALOR DIA' || norm === 'VLR_DIA' || norm === 'DIARIO' || norm.includes('DIA');
          });
          if (codKey && diaKey) {
            const codValue = String(row[codKey]).trim().toUpperCase();
            const diaValue = Number(row[diaKey] || 0);
            mappedValores[codValue] = diaValue;
          }
        });
        setValoresMedicaoData(mappedValores);
        setFilesStatus(prev => ({
          ...prev,
          valoresMedicao: { name: `${filename} (${sheetName})`, loaded: true, count: Object.keys(mappedValores).length, isOptional: true }
        }));
      }
    });

    return matchedAny;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let totalMatched = 0;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target?.result;
        if (!data) return;

        try {
          const workbook = XLSX.read(data, { type: 'array' });
          const matched = processWorkbookSheets(workbook, file.name);
          if (matched) {
            totalMatched++;
          }
        } catch (err) {
          console.error("Erro ao ler arquivo:", err);
          setAlert({ type: 'error', text: `Falha ao interpretar o arquivo ${file.name}.` });
        }
      };
      reader.readAsArrayBuffer(file);
    });

    setAlert({ type: 'success', text: `Arquivos carregados e mapeados para processamento.` });
  };

  // Drag over handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Drag leave handler
  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    let totalMatched = 0;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target?.result;
        if (!data) return;

        try {
          const workbook = XLSX.read(data, { type: 'array' });
          const matched = processWorkbookSheets(workbook, file.name);
          if (matched) {
            totalMatched++;
          }
        } catch (err) {
          console.error("Erro ao ler arquivo dropado:", err);
        }
      };
      reader.readAsArrayBuffer(file);
    });

    setAlert({ type: 'success', text: `Arquivos dropados e catalogados com sucesso.` });
  };

  // Load Demo Data for Quick Testing
  const handleLoadDemoData = () => {
    // 1. BASE DE DADOS DEMO
    const demoBase: Asset[] = [
      { tag: 'CMPC-001', status: 'Ativo', dataInicio: '2026-05-01', dataFim: '2026-05-31', depositoDestino: 'Almoxarifado Central', documento: 'DOC-101', classe: 'Equipamento', descricao: 'Caminhão Munck Ford', um: 'UN', valorUnitario: 150000, source: 'base' },
      { tag: 'CMR-002', status: 'Devolvido', dataInicio: '2026-05-10', dataFim: '2026-05-20', depositoDestino: 'Frente de Obra A', documento: 'DOC-102', classe: 'Ferramenta', descricao: 'Gerador Elétrico Toyama', um: 'UN', valorUnitario: 45000, source: 'base' },
      { tag: 'CPMC-003', status: 'Ativo', dataInicio: '2026-05-01', dataFim: '2026-05-31', depositoDestino: 'Oficina Central', documento: 'DOC-103', classe: 'Estrutura', descricao: 'Andaime Metálico 2m', um: 'M2', valorUnitario: 120, source: 'base' },
      { tag: 'COMAR-999', status: 'Ativo', dataInicio: '2026-05-01', dataFim: '2026-05-31', depositoDestino: 'Frente de Obra B', documento: 'DOC-104', classe: 'Equipamento', descricao: 'Pá Carregadora', um: 'UN', valorUnitario: 280000, source: 'base' },
    ];

    // 2. MOVIMENTAÇÕES DEMO (June 2026)
    const demoMovs: Movement[] = [
      { tag: 'CMPC-001', data: '2026-06-15', motivo: 'Desmobilização', depositoDestino: 'Almoxarifado Central', documento: 'DOC-201', rawRowIndex: 2 },
      { tag: 'CMR-002', data: '2026-06-05', motivo: 'Mobilização', depositoDestino: 'Frente de Obra B', documento: 'DOC-202', rawRowIndex: 3 },
      { tag: 'CPMC-004', data: '2026-06-10', motivo: 'Mobilização', depositoDestino: 'Frente de Obra A', documento: 'DOC-203', rawRowIndex: 4 }, // New Tag!
      { tag: 'COMAR-005', data: '2026-06-12', motivo: 'Mobilização', depositoDestino: 'Frente de Obra B', documento: 'DOC-204', rawRowIndex: 5 }, // New Tag!
      { tag: 'INVALID-99', data: '2026-06-18', motivo: 'Mobilização', depositoDestino: 'Frente CMPC', documento: 'DOC-205', rawRowIndex: 6 }, // Invalid Tag (won't start with correct prefixes)
      { tag: 'CMR-002', data: '2026-06-25', motivo: 'Desmobilização', depositoDestino: 'Almoxarifado Central', documento: 'DOC-206', rawRowIndex: 7 }, // Mobilized then Desmobilized in same month
    ];

    // 3. CLASSIFICAÇÃO DEMO
    const demoClass: Classification[] = [
      { tag: 'CPMC-004', classe: 'Equipamento', descricao: 'Compressor de Ar Chicago', um: 'UN' },
      { tag: 'COMAR-005', classe: 'Ferramenta', descricao: 'Furadeira Industrial Bosch', um: 'UN' }
    ];

    // 4. ATUALIZAÇÃO DEMO
    const demoUpdates: PriceUpdate[] = [
      { tag: 'CPMC-004', valorUnitario: 8500 },
      { tag: 'COMAR-005', valorUnitario: 1200 }
    ];

    const demoValoresMedicao: Record<string, number> = {
      'CMPC-001': 15,
      'CMR-002': 25,
      'CPMC-003': 35,
      'CPMC-004': 45,
      'COMAR-005': 8
    };

    setBaseDadosData(demoBase);
    setMovimentacoesData(demoMovs);
    setClassificacoesData(demoClass);
    setAtualizacoesData(demoUpdates);
    setValoresMedicaoData(demoValoresMedicao);

    setFilesStatus({
      movimentacoes: { name: 'movimentacoes_demo.xlsx', loaded: true, count: demoMovs.length },
      baseDados: { name: 'base_dados_demo.xlsx', loaded: true, count: demoBase.length },
      classificacao: { name: 'classificacao_demo.xlsx', loaded: true, count: demoClass.length, isOptional: true },
      atualizacao: { name: 'atualizacao_demo.xlsx', loaded: true, count: demoUpdates.length, isOptional: true },
      valoresMedicao: { name: 'valores_medicao_demo.xlsx', loaded: true, count: 5, isOptional: true }
    });

    setAlert({ type: 'info', text: 'Dados de demonstração carregados com sucesso. Clique em Processar.' });
  };

  const handleClearAll = () => {
    setMovimentacoesData(null);
    setBaseDadosData(null);
    setClassificacoesData(null);
    setAtualizacoesData(null);
    setValoresMedicaoData(null);
    setProcessedAssets(null);
    setFilesStatus({
      movimentacoes: { name: '', loaded: false, count: 0 },
      baseDados: { name: '', loaded: false, count: 0 },
      classificacao: { name: '', loaded: false, count: 0, isOptional: true },
      atualizacao: { name: '', loaded: false, count: 0, isOptional: true },
      valoresMedicao: { name: '', loaded: false, count: 0, isOptional: true }
    });
    setAlert({ type: 'info', text: 'Todos os arquivos foram limpos.' });
  };

  // MAIN RUN ENGINE (The business rules)
  const handleProcessData = () => {
    if (!movimentacoesData || movimentacoesData.length === 0) {
      setAlert({ type: 'error', text: 'O arquivo de MOVIMENTAÇÃO é obrigatório.' });
      return;
    }
    if (!baseDadosData) {
      setAlert({ type: 'error', text: 'O arquivo de BASE DE DADOS é obrigatório.' });
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      try {
        // 1. Filter and Clean incoming movements
        // Valid TAG prefixes: CMPC, CMR, CPMC, CMCP, COMAR
        const validPrefixes = ['CMPC', 'CMR', 'CPMC', 'CMCP', 'COMAR'];
        
        const validMovements = movimentacoesData.filter(m => {
          const tagValue = normalizeStr(m.tag);
          const motivoValue = normalizeStr(m.motivo);

          // Ignore blanks
          if (!tagValue || !motivoValue || !m.data) return false;
          
          const isTagValid = validPrefixes.some(prefix => tagValue.startsWith(prefix));
          const isMotivoValid = motivoValue === 'MOBILIZACAO' || 
                                motivoValue === 'DESMOBILIZACAO' || 
                                motivoValue.includes('MOBILIZACAO') || 
                                motivoValue.includes('DESMOBILIZACAO') || 
                                motivoValue.includes('DESMOB') || 
                                motivoValue.includes('MOBIL') || 
                                motivoValue.includes('DEVOL') || 
                                motivoValue.includes('RETORN') || 
                                motivoValue.includes('SAIDA');
          
          return isTagValid && isMotivoValid;
        });

        // Debug logs (hidden)
        const json = movimentacoesData;
        const validRows = validMovements;
        console.log('Total lido:', json.length, 'Validas:', validRows.length);

        if (validMovements.length === 0) {
          throw new Error('Nenhuma movimentação válida com TAGs iniciadas por CMPC, CMR, CPMC, CMCP ou COMAR foi encontrada.');
        }

        // 2. Determine analyzed month and year (from first valid movement date)
        const firstValidDate = validMovements[0].data;
        const parsedDate = new Date(firstValidDate);
        let year = 2026;
        let month = 5; // June (0-indexed represents month-1, let's look at numbers)

        if (!isNaN(parsedDate.getTime())) {
          year = parsedDate.getFullYear();
          month = parsedDate.getMonth(); // 0-11
        }

        // Calculate 1st and last day of month
        const firstDayStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDayOfAnalyzedMonth = new Date(year, month + 1, 0).getDate();
        const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfAnalyzedMonth).padStart(2, '0')}`;

        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthLabel = `${monthNames[month]} de ${year}`;

        // 3. Save original assets state by TAG for visual comparisons
        const origMap: Record<string, Asset> = {};
        baseDadosData.forEach(asset => {
          origMap[asset.tag.toUpperCase()] = { ...asset };
        });
        setOriginalAssetsMap(origMap);

        // 4. Copy initial base assets to work on (in-memory)
        // Keyed by TAG for fast updates
        const finalAssetsMap: Record<string, Asset> = {};
        baseDadosData.forEach(asset => {
          finalAssetsMap[asset.tag.toUpperCase()] = { 
            ...asset, 
            originalStatus: asset.status,
            source: 'base' 
          };
        });

        // Parse optional lookups
        const classMap: Record<string, Classification> = {};
        if (classificacoesData) {
          classificacoesData.forEach(c => {
            classMap[c.tag.toUpperCase()] = c;
          });
        }

        const priceMap: Record<string, PriceUpdate> = {};
        if (atualizacoesData) {
          atualizacoesData.forEach(p => {
            priceMap[p.tag.toUpperCase()] = p;
          });
        }

        // Sort movements chronologically to preserve real history sequence
        const sortedMovements = [...validMovements].sort((a, b) => {
          return new Date(a.data).getTime() - new Date(b.data).getTime();
        });

        // Statistics counters
        let newMobilizationsCount = 0;
        let updatedMobilizationsCount = 0;
        let desmobilizationsCount = 0;

        // 5. Execute core business logic
        sortedMovements.forEach((mov) => {
          const tagUpper = normalizeStr(mov.tag);
          const motivoUpper = normalizeStr(mov.motivo);

          // Identify if Desmobilização or Mobilização
          const isDesmob = motivoUpper.includes('DESMOB') || 
                            motivoUpper.includes('DEVOL') || 
                            motivoUpper.includes('RETORN') || 
                            motivoUpper.includes('SAIDA');

          const existsInBase = !!finalAssetsMap[tagUpper];

          if (isDesmob) {
            // Lógica de DESMOBILIZAÇÃO
            if (existsInBase) {
              finalAssetsMap[tagUpper] = {
                ...finalAssetsMap[tagUpper],
                status: 'Devolvido',
                dataFim: mov.data, // exact date of desmobilização
                documentoRetorno: mov.documento
              };
              desmobilizationsCount++;
            }
          } else {
            // Lógica de MOBILIZAÇÃO
            if (existsInBase) {
              // TAG already exists: Update status, periods, and destination/doc
              finalAssetsMap[tagUpper] = {
                ...finalAssetsMap[tagUpper],
                status: 'Ativo',
                dataInicio: firstDayStr, // 1st day of month
                dataFim: lastDayStr, // last day of month
                depositoDestino: mov.depositoDestino,
                documento: mov.documento
              };
              updatedMobilizationsCount++;
            } else {
              // TAG is New: Create the record crossing lookups
              const classification = classMap[tagUpper];
              const priceUpdate = priceMap[tagUpper];

              const deduceClasseFromTag = (tagStr: string): string => {
                const t = normalizeStr(tagStr);
                if (t.startsWith('CMPC')) return 'Equipamento';
                if (t.startsWith('CMR')) return 'Ferramenta';
                if (t.startsWith('CPMC')) return 'Estrutura';
                if (t.startsWith('CMCP')) return 'Equipamento';
                if (t.startsWith('COMAR')) return 'Equipamento';
                return 'A Classificar';
              };

              const descValue = (classification?.descricao || mov.descricao || '').trim() || 'Ativo Novo';
              const classValue = (classification?.classe || mov.classe || '').trim() || deduceClasseFromTag(mov.tag);

              finalAssetsMap[tagUpper] = {
                tag: mov.tag,
                status: 'Ativo',
                dataInicio: firstDayStr, // 1st day of month
                dataFim: lastDayStr, // last day of month
                depositoDestino: mov.depositoDestino,
                documento: mov.documento,
                classe: classValue,
                descricao: descValue,
                um: classification?.um || 'UN',
                valorUnitario: priceUpdate?.valorUnitario || 0,
                originalStatus: 'Inexistente',
                source: 'novo'
              };
              newMobilizationsCount++;
            }
          }
        });

        // 5.5. Post-process to extend validity of stationary assets (ativos parados) and calculate billing/medicao values
        const tagsWithMovements = new Set(validMovements.map(m => normalizeStr(m.tag)));

        Object.keys(finalAssetsMap).forEach(tag => {
          const asset = finalAssetsMap[tag];
          
          // Extension of stationary active assets
          if (asset.source === 'base' && !tagsWithMovements.has(tag)) {
            if (asset.status === 'Ativo') {
              if (extendParados) {
                asset.dataInicio = firstDayStr;
                asset.dataFim = lastDayStr;
              }
            }
          }

          // Calculate billing days, daily value, and total value
          if (asset.status === 'Ativo' || asset.status === 'Devolvido') {
            const codUpper = String(asset.codMaterial || '').trim().toUpperCase();
            let vDiario = 0;
            if (valoresMedicaoData && valoresMedicaoData[codUpper] !== undefined) {
              vDiario = valoresMedicaoData[codUpper];
            } else {
              // Fallback to unit value divided by 30
              vDiario = asset.valorUnitario ? asset.valorUnitario / 30 : 0;
            }

            asset.valorDiario = vDiario;

            if (asset.dataInicio && asset.dataFim) {
              const start = new Date(asset.dataInicio);
              const end = new Date(asset.dataFim);
              
              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const firstOfMonth = new Date(firstDayStr);
                const lastOfMonth = new Date(lastDayStr);

                const calcStart = start < firstOfMonth ? firstOfMonth : start;
                const calcEnd = end > lastOfMonth ? lastOfMonth : end;

                if (calcStart <= calcEnd) {
                  const diffTime = Math.abs(calcEnd.getTime() - calcStart.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                  asset.diasCobranca = diffDays;
                  asset.valorTotalCobranca = diffDays * vDiario;
                } else {
                  asset.diasCobranca = 0;
                  asset.valorTotalCobranca = 0;
                }
              } else {
                asset.diasCobranca = 0;
                asset.valorTotalCobranca = 0;
              }
            } else {
              asset.diasCobranca = 0;
              asset.valorTotalCobranca = 0;
            }
          } else {
            asset.diasCobranca = 0;
            asset.valorDiario = 0;
            asset.valorTotalCobranca = 0;
          }
        });

        // 6. Output compilation
        const resultsArray = Object.values(finalAssetsMap);
        setProcessedAssets(resultsArray);

        setStats({
          totalRead: movimentacoesData.length,
          validTags: validMovements.length,
          mobilizacoesNovas: newMobilizationsCount,
          mobilizacoesAtualizadas: updatedMobilizationsCount,
          desmobilizacoes: desmobilizationsCount,
          periodoAnalise: monthLabel
        });

        setAlert({ type: 'success', text: `Processamento concluído com sucesso. ${validMovements.length} movimentações processadas.` });
      } catch (err: any) {
        console.error("Erro ao processar dados:", err);
        setAlert({ type: 'error', text: err.message || 'Erro durante o motor de processamento.' });
      } finally {
        setIsProcessing(false);
      }
    }, 1000);
  };

  // Convert processed data to Semicolon and BOM CSV and download
  const handleExportCSV = () => {
    if (!processedAssets || processedAssets.length === 0) return;

    try {
      const headers = [
        'TAG',
        'Cód. Material',
        'Status',
        'Data Início',
        'Data Fim',
        'Depósito Destino',
        'Documento',
        'Documento Retorno',
        'Classe',
        'Descrição',
        'UM',
        'Valor Unitário',
        'Valor Diária',
        'Dias de Cobrança',
        'Valor Total Cobrança'
      ];

      const rows = processedAssets.map(asset => [
        asset.tag || '',
        asset.codMaterial || '',
        asset.status || '',
        asset.dataInicio || '',
        asset.dataFim || '',
        asset.depositoDestino || '',
        asset.documento || '',
        asset.documentoRetorno || '',
        asset.classe || '',
        asset.descricao || '',
        asset.um || '',
        asset.valorUnitario !== undefined ? String(asset.valorUnitario) : '0',
        asset.valorDiario !== undefined ? String(asset.valorDiario) : '0',
        asset.diasCobranca !== undefined ? String(asset.diasCobranca) : '0',
        asset.valorTotalCobranca !== undefined ? String(asset.valorTotalCobranca) : '0'
      ]);

      const csvContent = [headers.join(';')]
        .concat(rows.map(row => row.map(val => {
          const str = String(val).replace(/"/g, '""');
          return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
        }).join(';')))
        .join('\r\n');

      // Prepend BOM for Excel compatibility with accents
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'Base_Medicao_Atualizada.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setAlert({ type: 'success', text: 'Base de Medição Atualizada exportada com sucesso!' });
    } catch (e) {
      console.error(e);
      setAlert({ type: 'error', text: 'Erro ao gerar arquivo de exportação.' });
    }
  };

  // Filter processed items
  const filteredAssets = (processedAssets || []).filter(asset => {
    const orig = originalAssetsMap[asset.tag.toUpperCase()];
    
    // Status filter
    if (statusFilter === 'Ativo' && asset.status !== 'Ativo') return false;
    if (statusFilter === 'Devolvido' && asset.status !== 'Devolvido') return false;
    if (statusFilter === 'novo' && asset.source !== 'novo') return false;

    // Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchTag = asset.tag.toLowerCase().includes(term);
      const matchDesc = asset.descricao.toLowerCase().includes(term);
      const matchDep = asset.depositoDestino.toLowerCase().includes(term);
      const matchDoc = asset.documento.toLowerCase().includes(term);
      return matchTag || matchDesc || matchDep || matchDoc;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans" id="processor-container">
      {/* Top Banner decoration */}
      <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 animate-pulse" />

      {/* Main Header */}
      <header className="bg-slate-950/80 border-b border-slate-800/80 py-5 px-6 md:px-12 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBackToHub}
              className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-455 hover:text-white rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center"
              title="Voltar ao Hub"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="border-l border-slate-800 pl-4 py-1">
              <h2 className="font-sans font-black text-sm text-violet-400 tracking-wider leading-tight uppercase flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-400" />
                Processador de Movimentações em Cache
              </h2>
              <p className="text-[10px] font-bold text-slate-455 uppercase tracking-wider leading-none mt-1 font-mono">
                MÓDULO EXCLUSIVO DE ADMINISTRAÇÃO E CONVENÇÃO DE DADOS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-500 bg-slate-900/60 border border-slate-800 px-3.5 py-1.5 rounded-full uppercase tracking-widest leading-none font-mono flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              Mês Completo Cache-Only
            </span>
          </div>
        </div>
      </header>

      {/* Alert Center */}
      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
          >
            <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-2xl backdrop-blur-md ${
              alert.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' 
                : alert.type === 'error' 
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-300' 
                : 'bg-indigo-950/90 border-indigo-500/30 text-indigo-300'
            }`}>
              {alert.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : alert.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              ) : (
                <Info className="w-5 h-5 text-indigo-400 shrink-0" />
              )}
              <div className="text-xs font-semibold leading-relaxed">
                {alert.text}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow max-w-7xl mx-auto px-6 py-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Controls, upload and guides */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Main Info Card */}
          <div className="bg-slate-950 border border-slate-850 rounded-[24px] p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 bg-violet-600/5 blur-3xl rounded-full" />
            <h3 className="text-sm font-black text-slate-200 tracking-wider uppercase mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Regras e Diretrizes do Motor
            </h3>
            <ul className="space-y-3.5 text-[11px] text-slate-400 font-sans leading-relaxed">
              <li className="flex gap-2.5 items-start">
                <ChevronRight className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                <span><strong>Filtro de TAG:</strong> Só processa ativos cujas TAGs iniciem com <strong>CMPC, CMR, CPMC, CMCP ou COMAR</strong>.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <ChevronRight className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                <span><strong>Mobilização Ativo Existente:</strong> Atualiza para <strong>Ativo</strong> do 1º ao último dia do mês, atualizando depósito/documento.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <ChevronRight className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                <span><strong>Mobilização Ativo Novo:</strong> Cria o registro cruzando <strong>Classificação</strong> (opcional) e <strong>Atualização de Preço</strong> (opcional).</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <ChevronRight className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                <span><strong>Desmobilização:</strong> Atualiza status para <strong>Devolvido</strong> com a data exata da desmobilização e grava o doc de retorno.</span>
              </li>
              <li className="flex gap-2.5 items-start text-indigo-300">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><strong>Segurança Cache:</strong> Nenhum dado é salvo no servidor ou banco. Tudo roda em memória com segurança local de rede.</span>
              </li>
            </ul>
          </div>

          {/* Files Input Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-slate-950 border border-dashed rounded-[24px] p-8 text-center transition-all relative ${
              isDragging 
                ? 'border-violet-500 bg-violet-950/20' 
                : 'border-slate-800 hover:border-slate-700 bg-slate-950 hover:bg-slate-950/80'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".csv, .xlsx, .xls"
              className="hidden"
            />
            
            <div className="flex flex-col items-center justify-center space-y-3.5">
              <div className="p-4 bg-slate-900 border border-slate-850 rounded-2xl text-slate-500">
                <Upload className="w-7 h-7 text-slate-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Upload de Arquivos</h4>
                <p className="text-[10px] text-slate-455 mt-1 font-medium max-w-xs mx-auto leading-relaxed">
                  Arraste e solte até 4 planilhas (.xlsx, .xls ou .csv) ou clique abaixo para selecioná-los.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-750 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs"
                >
                  Selecionar Arquivos
                </button>
                
                <button
                  type="button"
                  onClick={handleLoadDemoData}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Carregar Demonstração
                </button>
              </div>
            </div>
          </div>

          {/* Upload Status Grid Checklist */}
          <div className="bg-slate-950 border border-slate-850 rounded-[24px] p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
              <h4 className="text-[11px] font-black uppercase text-slate-300 tracking-wider">Integridade dos Arquivos</h4>
              {(movimentacoesData || baseDadosData) && (
                <button
                  onClick={handleClearAll}
                  className="text-[9px] font-bold text-slate-500 hover:text-rose-400 uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Limpar tudo
                </button>
              )}
            </div>

            <div className="space-y-3">
              {/* File 1: MOVIMENTAÇÕES */}
              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-850 rounded-xl">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1.5 rounded-lg ${filesStatus.movimentacoes.loaded ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-850 text-slate-550'}`}>
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-200">MOVIMENTAÇÃO</div>
                    <div className="text-[8.5px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                      {filesStatus.movimentacoes.loaded ? filesStatus.movimentacoes.name : 'Pendente de upload'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {filesStatus.movimentacoes.loaded ? (
                    <span className="text-[9.5px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-900/30 font-mono">
                      {filesStatus.movimentacoes.count} lidos
                    </span>
                  ) : (
                    <span className="text-[9.5px] font-extrabold text-amber-500 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-900/20 uppercase tracking-widest">
                      Obrigatório
                    </span>
                  )}
                </div>
              </div>

              {/* File 2: BASE DE DADOS */}
              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-850 rounded-xl">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1.5 rounded-lg ${filesStatus.baseDados.loaded ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-850 text-slate-550'}`}>
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-200">BASE DE DADOS</div>
                    <div className="text-[8.5px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                      {filesStatus.baseDados.loaded ? filesStatus.baseDados.name : 'Pendente de upload'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {filesStatus.baseDados.loaded ? (
                    <span className="text-[9.5px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-900/30 font-mono">
                      {filesStatus.baseDados.count} lidos
                    </span>
                  ) : (
                    <span className="text-[9.5px] font-extrabold text-amber-500 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-900/20 uppercase tracking-widest">
                      Obrigatório
                    </span>
                  )}
                </div>
              </div>

              {/* File 3: CLASSIFICAÇÃO */}
              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-850 rounded-xl opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1.5 rounded-lg ${filesStatus.classificacao.loaded ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-850 text-slate-550'}`}>
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-200">CLASSIFICAÇÃO</div>
                    <div className="text-[8.5px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                      {filesStatus.classificacao.loaded ? filesStatus.classificacao.name : 'Opcional (Uso p/ novos)'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {filesStatus.classificacao.loaded ? (
                    <span className="text-[9.5px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-900/30 font-mono">
                      {filesStatus.classificacao.count} lidos
                    </span>
                  ) : (
                    <span className="text-[9.5px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 uppercase tracking-widest">
                      Opcional
                    </span>
                  )}
                </div>
              </div>

              {/* File 4: ATUALIZAÇÃO */}
              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-850 rounded-xl opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1.5 rounded-lg ${filesStatus.atualizacao.loaded ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-850 text-slate-550'}`}>
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-200">ATUALIZAÇÃO</div>
                    <div className="text-[8.5px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                      {filesStatus.atualizacao.loaded ? filesStatus.atualizacao.name : 'Opcional (Preços p/ novos)'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {filesStatus.atualizacao.loaded ? (
                    <span className="text-[9.5px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-900/30 font-mono">
                      {filesStatus.atualizacao.count} lidos
                    </span>
                  ) : (
                    <span className="text-[9.5px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 uppercase tracking-widest">
                      Opcional
                    </span>
                  )}
                </div>
              </div>

              {/* File 5: VALORES DE MEDIÇÃO */}
              <div className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-850 rounded-xl opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-1.5 rounded-lg ${filesStatus.valoresMedicao.loaded ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-850 text-slate-550'}`}>
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-200">VALORES DE MEDIÇÃO</div>
                    <div className="text-[8.5px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                      {filesStatus.valoresMedicao.loaded ? filesStatus.valoresMedicao.name : 'Opcional (Tabela de diárias)'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {filesStatus.valoresMedicao.loaded ? (
                    <span className="text-[9.5px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-900/30 font-mono">
                      {filesStatus.valoresMedicao.count} lidos
                    </span>
                  ) : (
                    <span className="text-[9.5px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 uppercase tracking-widest">
                      Opcional
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Run process button */}
            <button
              onClick={handleProcessData}
              disabled={isProcessing || !filesStatus.movimentacoes.loaded || !filesStatus.baseDados.loaded}
              className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                filesStatus.movimentacoes.loaded && filesStatus.baseDados.loaded
                  ? 'bg-violet-600 hover:bg-violet-700 text-white border border-violet-600 active:scale-98'
                  : 'bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Processar Movimentações</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Results Dashboard */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Dashboard Summary (Conditional Render after Processing) */}
          {processedAssets ? (
            <div className="space-y-6">
              
              {/* Period and Counters Header */}
              <div className="bg-slate-950 border border-slate-850 rounded-[28px] p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 bg-indigo-500/5 blur-3xl rounded-full" />
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-850 mb-5">
                  <div>
                    <span className="text-[9px] font-black uppercase bg-violet-950 text-violet-300 border border-violet-850 px-2.5 py-1 rounded-md tracking-wider">
                      Resumo Operacional de Competência
                    </span>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight mt-1.5 font-sans">
                      Período de Medição: {stats.periodoAnalise}
                    </h3>
                  </div>
                  
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider rounded-2xl transition-all cursor-pointer shadow-lg active:scale-98 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar Base Atualizada</span>
                  </button>
                </div>

                {/* Counters Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 text-center">
                    <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Registros Lidos</span>
                    <div className="text-2xl font-black text-slate-200 mt-1 font-mono">{stats.totalRead}</div>
                    <span className="text-[8.5px] text-slate-500 mt-0.5 block">Total de linhas</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 text-center">
                    <span className="text-[9px] font-black uppercase text-violet-400 tracking-wider">TAGs Válidas</span>
                    <div className="text-2xl font-black text-violet-400 mt-1 font-mono">{stats.validTags}</div>
                    <span className="text-[8.5px] text-slate-500 mt-0.5 block">Prefixos homologados</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 text-center relative overflow-hidden">
                    <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">Mobilizações</span>
                    <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                      {stats.mobilizacoesNovas + stats.mobilizacoesAtualizadas}
                    </div>
                    <span className="text-[8.5px] text-slate-450 mt-0.5 block font-sans">
                      <strong className="text-slate-300">{stats.mobilizacoesNovas}</strong> novas • <strong className="text-slate-300">{stats.mobilizacoesAtualizadas}</strong> at.
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 text-center">
                    <span className="text-[9px] font-black uppercase text-amber-500 tracking-wider">Desmobilizações</span>
                    <div className="text-2xl font-black text-amber-500 mt-1 font-mono">{stats.desmobilizacoes}</div>
                    <span className="text-[8.5px] text-slate-500 mt-0.5 block">Status Devolvido</span>
                  </div>
                </div>

              </div>

              {/* Table Preview and filters */}
              <div className="bg-slate-950 border border-slate-850 rounded-[28px] overflow-hidden shadow-xl flex flex-col">
                
                {/* Filters zone */}
                <div className="p-5 border-b border-slate-850/80 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center space-x-2 w-full md:max-w-md">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 flex items-center space-x-2 w-full">
                      <Search className="w-4 h-4 text-slate-500 shrink-0" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por TAG, descrição, depósito, doc..."
                        className="bg-transparent border-none text-xs text-slate-200 w-full outline-none placeholder:text-slate-550"
                      />
                    </div>
                  </div>

                  {/* Status pills */}
                  <div className="flex items-center space-x-2 shrink-0 overflow-x-auto w-full md:w-auto justify-end">
                    <button
                      onClick={() => setStatusFilter('todos')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                        statusFilter === 'todos'
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      Todos ({processedAssets.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('Ativo')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                        statusFilter === 'Ativo'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      Ativos ({processedAssets.filter(a => a.status === 'Ativo').length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('Devolvido')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                        statusFilter === 'Devolvido'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      Devolvidos ({processedAssets.filter(a => a.status === 'Devolvido').length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('novo')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                        statusFilter === 'novo'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      Novos ({processedAssets.filter(a => a.source === 'novo').length})
                    </button>
                  </div>
                </div>

                {/* Table elements */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-850 text-[10px] font-black uppercase text-slate-455 tracking-wider">
                        <th className="py-4 px-5">TAG Ativo</th>
                        <th className="py-4 px-4">Status Atual</th>
                        <th className="py-4 px-4">Origem</th>
                        <th className="py-4 px-4">Data Início / Fim</th>
                        <th className="py-4 px-4">Destino / Doc</th>
                        <th className="py-4 px-4">Classe & Descrição</th>
                        <th className="py-4 px-4 text-right">Diária (Apoio)</th>
                        <th className="py-4 px-4 text-center">Dias Cobrança</th>
                        <th className="py-4 px-5 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-xs text-slate-300 font-sans">
                      {filteredAssets.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">
                            Nenhum registro encontrado correspondente aos filtros.
                          </td>
                        </tr>
                      ) : (
                        filteredAssets.map((asset) => {
                          const isNew = asset.source === 'novo';
                          const wasDevolvido = asset.originalStatus === 'Devolvido';
                          const isDevolvidoNow = asset.status === 'Devolvido';
                          
                          // Style changes for status
                          let statusBadge = '';
                          if (isDevolvidoNow) {
                            statusBadge = 'bg-amber-950 text-amber-400 border border-amber-900/30';
                          } else {
                            statusBadge = 'bg-emerald-950 text-emerald-400 border border-emerald-900/30';
                          }

                          return (
                            <tr key={asset.tag} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-4 px-5 font-bold font-mono text-slate-100 flex items-center gap-1.5">
                                {asset.tag}
                              </td>
                              
                              <td className="py-4 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${statusBadge}`}>
                                  {asset.status}
                                </span>
                              </td>

                              <td className="py-4 px-4">
                                {isNew ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-950 text-blue-400 border border-blue-900/30">
                                    Novo Ativo
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-455 font-bold font-sans">
                                    Base Existente
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-4 font-mono text-[10px] leading-relaxed">
                                <div>Início: <span className="text-slate-200">{asset.dataInicio || '---'}</span></div>
                                <div>Fim: <span className="text-slate-200">{asset.dataFim || '---'}</span></div>
                              </td>

                              <td className="py-4 px-4 leading-relaxed max-w-[150px]">
                                <div className="truncate font-semibold text-slate-200" title={asset.depositoDestino}>
                                  {asset.depositoDestino || '---'}
                                </div>
                                <div className="text-[10px] text-slate-455 font-mono">
                                  {isDevolvidoNow ? (
                                    <span>Ret: <strong className="text-amber-500">{asset.documentoRetorno || '---'}</strong></span>
                                  ) : (
                                    <span>Doc: <strong className="text-violet-400">{asset.documento || '---'}</strong></span>
                                  )}
                                </div>
                              </td>

                              <td className="py-4 px-4 leading-relaxed max-w-[200px]">
                                <div className="text-[10px] font-bold text-violet-400">{asset.classe || '---'}</div>
                                <div className="text-slate-200 truncate" title={asset.descricao}>{asset.descricao || '---'}</div>
                                <div className="text-[9px] text-slate-500 font-mono">Cod: {asset.codMaterial || '---'}</div>
                              </td>

                              <td className="py-4 px-4 text-right font-mono font-bold text-slate-200">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(asset.valorDiario || 0)}
                              </td>

                              <td className="py-4 px-4 text-center font-mono font-extrabold text-violet-400">
                                {asset.diasCobranca || 0} dias
                              </td>

                              <td className="py-4 px-5 text-right font-mono font-black text-emerald-400">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(asset.valorTotalCobranca || 0)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Info summary row */}
                <div className="p-4 bg-slate-900 border-t border-slate-850 text-[10px] font-mono text-slate-455 flex justify-between items-center">
                  <span>Visualizando {filteredAssets.length} de {processedAssets.length} registros processados</span>
                  <span>Competência de Dados: {stats.periodoAnalise}</span>
                </div>

              </div>

            </div>
          ) : (
            /* Blank state before processing */
            <div className="bg-slate-950 border border-slate-850 rounded-[32px] p-12 text-center flex flex-col items-center justify-center min-h-[450px]">
              <div className="p-6 bg-slate-900 border border-slate-850 text-slate-500 rounded-full mb-5">
                <FileSpreadsheet className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-black text-slate-200 uppercase tracking-wider font-sans">
                Aguardando Processamento de Dados
              </h3>
              <p className="text-xs text-slate-455 mt-2.5 max-w-md mx-auto leading-relaxed font-sans">
                Selecione ou carregue as planilhas correspondentes no menu ao lado. O motor de processamento lerá e tratará as movimentações do mês unicamente na memória.
              </p>
              <div className="mt-8 flex gap-3 flex-wrap justify-center">
                <div className="flex items-center space-x-2 text-[10.5px] font-bold text-slate-500 bg-slate-900 px-4 py-2 border border-slate-850 rounded-2xl font-mono">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>CMPC & CMR Prefixos</span>
                </div>
                <div className="flex items-center space-x-2 text-[10.5px] font-bold text-slate-500 bg-slate-900 px-4 py-2 border border-slate-850 rounded-2xl font-mono">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Tratamento de Re-Mobilizações</span>
                </div>
                <div className="flex items-center space-x-2 text-[10.5px] font-bold text-slate-500 bg-slate-900 px-4 py-2 border border-slate-850 rounded-2xl font-mono">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Cruzamento de Classes e Preços</span>
                </div>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* Discreed Footer */}
      <footer className="bg-slate-950 border-t border-slate-850 py-5 text-[10px] text-slate-550 mt-12" id="processor-footer">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-1.5 uppercase font-black font-mono">
            <Database className="w-4 h-4 text-violet-500" />
            <span>Processador de Competência Mensal em Cache • CMPC Industrial 2026</span>
          </div>
          <div>
            <span>Execução Segura em Memória Local • Sem Gravação no Banco de Dados</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
