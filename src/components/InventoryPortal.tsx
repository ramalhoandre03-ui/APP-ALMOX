import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import * as faceapi from 'face-api.js';
import { 
  ClipboardList, 
  Plus, 
  Check, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  FileSpreadsheet, 
  Printer, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Clock, 
  BarChart3, 
  Search, 
  FileText, 
  RefreshCw, 
  X, 
  Signature, 
  RotateCcw,
  UserCheck,
  Package,
  Layers,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  CheckSquare,
  AlertCircle,
  UploadCloud,
  Trash2,
  Edit2,
  ShieldAlert,
  Camera,
  CameraOff,
  Scan,
  Sparkles,
  Eye,
  Fingerprint,
  KeyRound,
  ShieldQuestion
} from 'lucide-react';
import { 
  logHubEvent, 
  generateAutoId
} from '../lib/firebase';
import { supabase } from '../lib/supabase';

const deleteField = () => undefined;

// Helper function to map internal role names to user-friendly Spanish/Portuguese names as requested by the user
const formatCargo = (cargo: string | undefined): string => {
  if (!cargo) return '';
  const c = cargo.trim();
  if (c === 'Almoxarife' || c === 'almoxarife' || c === 'agente de contagem' || c === 'Agente de contagem' || c === 'AGENTE_CONTAGEM') {
    return 'Agente de Contagem';
  }
  if (c === 'Coordenador' || c === 'coordenador' || c === 'controlador' || c === 'Agente de controladoria de inventário' || c === 'agente de controladoria de inventário' || c === 'AGENTE_CONTROLADORIA') {
    return 'Agente de Controladoria de Inventário';
  }
  if (c === 'Auditor' || c === 'auditor') {
    return 'Auditor de Estoque';
  }
  return cargo;
};


// Catalog of default CMPC Warehouse items
const DEFAULT_CMPC_CATALOG = [
  { codigo: 'UNI-001', descricao: 'Camisa Polo de Uniforme Azul CMPC', unidade: 'UN', valorUnitario: 45.00 },
  { codigo: 'UNI-002', descricao: 'Calça de Brim Cinza CMPC c/ Refletivo', unidade: 'UN', valorUnitario: 65.00 },
  { codigo: 'UNI-003', descricao: 'Camiseta Básica de uniformes Cinza', unidade: 'UN', valorUnitario: 25.00 },
  { codigo: 'OUT-101', descricao: 'Mina Bota de Segurança c/ Biqueira de Aço', unidade: 'PR', valorUnitario: 140.00 },
  { codigo: 'OUT-102', descricao: 'Óculos de Proteção Incolor CMPC', unidade: 'UN', valorUnitario: 12.50 },
  { codigo: 'OUT-103', descricao: 'Luva de Raspa para Soldador Cano Longo', unidade: 'PR', valorUnitario: 35.00 },
  { codigo: 'OUT-104', descricao: 'Capacete de Proteção aba frontal CMPC', unidade: 'UN', valorUnitario: 42.00 },
  { codigo: 'EQU-301', descricao: 'Furadeira de Impacto Profissional Bosch', unidade: 'UN', valorUnitario: 480.00 },
  { codigo: 'EQU-302', descricao: 'Esmerilhadeira Angular DeWalt 5\"', unidade: 'UN', valorUnitario: 520.00 },
  { codigo: 'MAT-501', descricao: 'Eletrodo Revestido Siderúrgico E7018', unidade: 'KG', valorUnitario: 38.00 },
  { codigo: 'MAT-502', descricao: 'Fita Isolante de Alta Fusão 3M S-20', unidade: 'RL', valorUnitario: 18.20 }
];

interface Inventory {
  id: string;
  referencia?: string;
  tipo: 'Geral' | 'Parcial' | 'Cíclico' | 'Eventual' | 'Transferência de responsabilidade';
  data: string;
  responsavel: string;
  status: string;
  totalItens: number;
  itensContados: number;
  progresso: number;
  createdAt: string;
  atribuicoes?: { grupoId: string; almoxarifeId: string; almoxarifeNome: string; status?: string; finalizadaPor?: string; timestampFinalizada?: string; revisadaPor?: string; timestampRevisada?: string }[];
  dataInicialPeriodo?: string;
  dataFinalPeriodo?: string;
  observacoes?: string;
  coordenadorSaindo?: string;
  coordenadorAssumindo?: string;
  solicitadoPor?: string;
  itens?: any[];
  contagens?: any[];
  edicoes_pos_conclusao?: any[];
  alteracoes_responsavel?: any[];
  reaberturas_autorizadas?: any[];
  closingReport?: any;
}

interface InventoryItem {
  id: string;
  inventarioId: string;
  codigo: string;
  codigoAlternativo?: string;
  descricao: string;
  unidade: string;
  statusContagem: 'Pendente' | 'Contagem 1' | 'Contagem 2' | 'Contagem 3' | 'Contagem Final' | 'Sucesso' | 'Divergente';
  contagemAtualAtiva: number; // 1, 2, 3, or 4 (consensus)
  saldoSistema?: number;
  desvioQtd?: number;
  desvioValor?: number;
  valorUnitario: number;
  statusDivergencia?: 'Aprovado' | 'Investigar' | 'Ajustado' | 'Aguarda ajuste no MEGA' | 'Pendente — Ajustar no próximo inventário geral';
  resultadoInvestigacao?: string;
  planoAcao?: string;
  contagem1?: number;
  contagem2?: number;
  contagem3?: number;
  contagemFinal?: number;
  contadorUltimo?: string;
  timestampUltimo?: string;
  grupo?: string;
  contador1Id?: string;
  contador1Nome?: string;
  contador2Id?: string;
  contador2Nome?: string;
  contador3Id?: string;
  contador3Nome?: string;
  contadorFinal1Id?: string;
  contadorFinal1Nome?: string;
  contadorFinal2Id?: string;
  contadorFinal2Nome?: string;
  almoxarifeAtribuidoId?: string;
  almoxarifeAtribuidoNome?: string;
  statusTratativa?: string;
  cadastradoManualmente?: boolean;
  suspeito?: boolean;
}

interface CountRecord {
  id: string;
  itemInventarioId: string;
  inventarioId: string;
  numeroContagem: number;
  quantidade: number;
  contador: string;
  timestamp: string;
  cargo: string;
  grupoEstoque?: string;
  contadorId?: string;
  registradoPor?: string;
  metodo?: string;
  suspeito?: boolean;
  auditKey?: string;
}

interface OfflineCount {
  id: string;
  itemId: string;
  inventarioId: string;
  contagemAtualAtiva: number;
  valueCounted: number;
  contadorNome: string;
  contadorId: string;
  cargo: string;
  grupoEstoque: string;
  timestamp: string;
  secondAlmoxarifeId?: string;
  secondAlmoxarifePin?: string;
  registradoPor?: string;
  metodo?: string;
  auditKey?: string;
}

interface ClosingReport {
  id: string;
  inventarioId: string;
  dataFechamento: string;
  tipo: string;
  totalItens: number;
  valorTotalDivergencias: number;
  acuracidade: number;
  assertividade: number;
  assinadoPor: string;
  cargoResponsavel: string;
  dataAssinatura: string;
  observacoes?: string;
  dataInicialPeriodo?: string;
  dataFinalPeriodo?: string;
  resumoExecutivo?: any;
}

interface UserProfile {
  id?: string | number;
  nome: string;
  usuario: string;
  cargo: 'Coordenador' | 'Almoxarife' | 'Auditor' | 'AGENTE_CONTAGEM' | 'AGENTE_CONTROLADORIA' | string;
  pin: string;
  perfil?: string;
  auditKey?: string;
}

interface DecisionResult {
  nextRound: number | null;                // 1, 2, 3, 4, or null
  isConcluido: boolean;                    // true if we should end/close the item
  confirmedValue: number | null;           // the accepted physical value, if concluded
  isDivergent: boolean;                    // true if divergence exists
  isPersistentDivergencia: boolean;        // true if round 4 done with no repetition
  rodadaConfirmacao: number | null;        // the round number that confirmed it
  reason: string;
}

function calcularDecisaoCMPC(
  sys: number,
  c1: number | undefined,
  c2: number | undefined,
  c3: number | undefined,
  cf: number | undefined
): DecisionResult {
  if (c1 === undefined) {
    return {
      nextRound: 1,
      isConcluido: false,
      confirmedValue: null,
      isDivergent: false,
      isPersistentDivergencia: false,
      rodadaConfirmacao: null,
      reason: "Contagem 1 pendente"
    };
  }

  if (c2 === undefined) {
    if (Math.abs(c1 - sys) <= 0.001) {
      return {
        nextRound: null,
        isConcluido: true,
        confirmedValue: c1,
        isDivergent: false,
        isPersistentDivergencia: false,
        rodadaConfirmacao: 1,
        reason: "Contagem 1 igual ao sistema (sem divergência)"
      };
    } else {
      return {
        nextRound: 2,
        isConcluido: false,
        confirmedValue: null,
        isDivergent: true,
        isPersistentDivergencia: false,
        rodadaConfirmacao: null,
        reason: "Contagem 1 diverge do sistema. Abre Contagem 2"
      };
    }
  }

  if (c3 === undefined) {
    if (Math.abs(c2 - c1) <= 0.001) {
      return {
        nextRound: null,
        isConcluido: true,
        confirmedValue: c2,
        isDivergent: true,
        isPersistentDivergencia: false,
        rodadaConfirmacao: 2,
        reason: "Contagem 2 igual à Contagem 1 (confirmado por repetição)"
      };
    } else if (Math.abs(c2 - sys) <= 0.001) {
      return {
        nextRound: 3,
        isConcluido: false,
        confirmedValue: null,
        isDivergent: true,
        isPersistentDivergencia: false,
        rodadaConfirmacao: null,
        reason: "Contagem 2 igual ao sistema. Abre Contagem 3"
      };
    } else {
      return {
        nextRound: 3,
        isConcluido: false,
        confirmedValue: null,
        isDivergent: true,
        isPersistentDivergencia: false,
        rodadaConfirmacao: null,
        reason: "Contagem 2 diverge de tudo. Abre Contagem 3"
      };
    }
  }

  if (cf === undefined) {
    if (Math.abs(c3 - c1) <= 0.001 || Math.abs(c3 - c2) <= 0.001) {
      return {
        nextRound: null,
        isConcluido: true,
        confirmedValue: c3,
        isDivergent: true,
        isPersistentDivergencia: false,
        rodadaConfirmacao: 3,
        reason: "Contagem 3 igual a uma contagem anterior (confirmado por repetição)"
      };
    } else if (Math.abs(c3 - sys) <= 0.001) {
      return {
        nextRound: 4,
        isConcluido: false,
        confirmedValue: null,
        isDivergent: true,
        isPersistentDivergencia: false,
        rodadaConfirmacao: null,
        reason: "Contagem 3 igual ao sistema. Abre Contagem Final conjunta"
      };
    } else {
      return {
        nextRound: 4,
        isConcluido: false,
        confirmedValue: null,
        isDivergent: true,
        isPersistentDivergencia: false,
        rodadaConfirmacao: null,
        reason: "Contagem 3 diverge de tudo. Abre Contagem Final conjunta"
      };
    }
  }

  const anyRepetition = Math.abs(cf - c1) <= 0.001 || Math.abs(cf - c2) <= 0.001 || Math.abs(cf - c3) <= 0.001;
  if (anyRepetition) {
    return {
      nextRound: null,
      isConcluido: true,
      confirmedValue: cf,
      isDivergent: true,
      isPersistentDivergencia: false,
      rodadaConfirmacao: 4,
      reason: "Contagem Final igual a uma contagem anterior (confirmado por repetição)"
    };
  } else if (Math.abs(cf - sys) <= 0.001) {
    return {
      nextRound: null,
      isConcluido: true,
      confirmedValue: cf,
      isDivergent: false,
      isPersistentDivergencia: false,
      rodadaConfirmacao: 4,
      reason: "Contagem Final igual ao sistema (sem divergência)"
    };
  } else {
    return {
      nextRound: null,
      isConcluido: true,
      confirmedValue: cf,
      isDivergent: true,
      isPersistentDivergencia: true,
      rodadaConfirmacao: null,
      reason: "Divergência Persistente: nenhum número se repetiu nas contagens"
    };
  }
}

function obterValorRepetidoCMPC(item: InventoryItem): { valor: number; rodadaConfirmacao: number } | null {
  const { contagem1: c1, contagem2: c2, contagem3: c3, contagemFinal: cf } = item;
  if (c1 !== undefined && c2 !== undefined && Math.abs(c2 - c1) <= 0.001) {
    return { valor: c2, rodadaConfirmacao: 2 };
  }
  if (c3 !== undefined) {
    if (c1 !== undefined && Math.abs(c3 - c1) <= 0.001) {
      return { valor: c3, rodadaConfirmacao: 3 };
    }
    if (c2 !== undefined && Math.abs(c3 - c2) <= 0.001) {
      return { valor: c3, rodadaConfirmacao: 3 };
    }
  }
  if (cf !== undefined) {
    if (c1 !== undefined && Math.abs(cf - c1) <= 0.001) {
      return { valor: cf, rodadaConfirmacao: 4 };
    }
    if (c2 !== undefined && Math.abs(cf - c2) <= 0.001) {
      return { valor: cf, rodadaConfirmacao: 4 };
    }
    if (c3 !== undefined && Math.abs(cf - c3) <= 0.001) {
      return { valor: cf, rodadaConfirmacao: 4 };
    }
  }
  return null;
}

function CustomAgentDropdown({ value, onChange, options, placeholder = "Selecione o Agente..." }: {
  value: string;
  onChange: (val: string) => void;
  options: any[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedAgent = options.find(a => String(a.pin) === String(value));

  const getInitials = (name: string) => {
    if (!name) return 'AG';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="relative font-sans text-left w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-xs font-bold p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] flex items-center justify-between gap-2 text-slate-800 cursor-pointer shadow-3xs"
      >
        <div className="flex items-center gap-2.5 truncate">
          {selectedAgent ? (
            <>
              <div className="w-7 h-7 rounded-full bg-[#3a2573] text-white flex items-center justify-center text-[10px] font-black shrink-0">
                {getInitials(selectedAgent.nome)}
              </div>
              <div className="truncate text-left">
                <span className="block truncate">{selectedAgent.nome}</span>
                <span className="block text-[9px] text-slate-400 font-mono font-normal">PIN: {selectedAgent.pin}</span>
              </div>
            </>
          ) : (
            <span className="text-slate-400 font-semibold">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedAgent?.temBiometria && (
            <span title="Biometria Ativa" className="text-emerald-500 inline-flex items-center">
              <Scan className="w-4 h-4" />
            </span>
          )}
          <span className="text-slate-400 text-xs">▼</span>
        </div>
      </button>

      {isOpen && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 py-1">
          <li
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-400 flex items-center gap-2"
          >
            <span>-- Não Atribuído / Limpar --</span>
          </li>
          {options.map((agent) => {
            const isSelected = String(agent.pin) === String(value);
            return (
              <li
                key={agent.pin}
                onClick={() => {
                  onChange(agent.pin);
                  setIsOpen(false);
                }}
                className={`px-3 py-2.5 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                  isSelected ? 'bg-indigo-50/80 font-bold text-[#3a2573]' : 'text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-3xs">
                    {getInitials(agent.nome)}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold text-slate-800 truncate">{agent.nome}</p>
                    <p className="text-[9px] text-slate-400 font-mono">PIN: {agent.pin} {agent.cargo ? `• ${agent.cargo}` : ''}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {agent.temBiometria ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200" title="Biometria Ativa">
                      <Scan className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Biometria Ativa</span>
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400 font-semibold bg-slate-100 px-2.5 py-1 rounded-full">
                      Sem Biometria
                    </span>
                  )}
                  {isSelected && <Check className="w-4 h-4 text-[#3a2573]" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface InventoryPortalProps {
  onBackToHub: () => void;
  allowedPins: string[];
  fullAllowedPins?: any[];
}

export default function InventoryPortal({ onBackToHub, allowedPins, fullAllowedPins = [] }: InventoryPortalProps) {
  // ============================================================================
  // ORDEM 1: CRIAR O ESTADO DE TRAVA LOCAL (BIOMETRIA SECUNDÁRIA OBRIGATÓRIA)
  // ============================================================================
  const [biometriaInventarioValidada, setBiometriaInventarioValidada] = useState(false);
  const [agenteContagem, setAgenteContagem] = useState<any | null>(null);

  // Profiles authentication state - local ao componente e revalidado a cada montagem
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // ============================================================================
  // ESTADOS DE AUTENTICAÇÃO BIOMÉTRICA EXCLUSIVA (FACE-API.JS + RBAC + AUDITORIA)
  // ============================================================================
  const [usuarioReconhecido, setUsuarioReconhecido] = useState<any | null>(null);
  const [cargosPermitidos, setCargosPermitidos] = useState<string[]>([]);
  const [cargoSelecionado, setCargoSelecionado] = useState<string>('');

  // Estados de Fallback de Senha (Plano B)
  const [usarSenha, setUsarSenha] = useState(false);
  const [credenciais, setCredenciais] = useState({ email: '', senha: '' });
  const [loadingSenha, setLoadingSenha] = useState(false);

  // Modelos neurais e base facial de descritores
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [usersWithBio, setUsersWithBio] = useState<any[]>([]);
  const [facesCadastradas, setFacesCadastradas] = useState<number>(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  // Câmera e Scanner Facial
  const bioVideoRef = useRef<HTMLVideoElement | null>(null);
  const bioCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bioStreamRef = useRef<MediaStream | null>(null);
  const bioAnimFrameRef = useRef<number | null>(null);
  const [isBioCameraActive, setIsBioCameraActive] = useState(false);
  const [bioCameraError, setBioCameraError] = useState<string | null>(null);

  // Prova de Vida Ativa (Head Yaw Estimation / Rotação Lateral)
  const [isAlive, setIsAlive] = useState(false);
  const [currentYawRatio, setCurrentYawRatio] = useState<number>(1.0);
  const [detectedFacesCount, setDetectedFacesCount] = useState<number>(0);

  const [authNome, setAuthNome] = useState('');
  const [authUsuario, setAuthUsuario] = useState('');
  const [authCargo, setAuthCargo] = useState<'Coordenador' | 'Almoxarife' | 'Auditor'>('Almoxarife');
  const [authPin, setAuthPin] = useState('');
  const [authError, setAuthError] = useState('');

  // Estados para primeiro acesso obrigatorio de almoxarifes
  const [firstAccessUser, setFirstAccessUser] = useState<any | null>(null);
  const [firstAccessNewPin, setFirstAccessNewPin] = useState('');
  const [firstAccessConfirmPin, setFirstAccessConfirmPin] = useState('');
  const [firstAccessError, setFirstAccessError] = useState('');

  // Firestore Sync State
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [rawInventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [allCounts, setAllCounts] = useState<CountRecord[]>([]);
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [optimisticCounted, setOptimisticCounted] = useState<{ [itemId: string]: number }>({});

  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineCount[]>(() => {
    try {
      const saved = localStorage.getItem('cmpc_offline_counts_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const getAugmentedInventoryItems = (items: InventoryItem[], queue: OfflineCount[]) => {
    if (!queue || queue.length === 0) return items;
    return items.map(item => {
      const pendingForThisItem = queue.filter(q => q.itemId === item.id && q.inventarioId === selectedInventory?.id);
      if (pendingForThisItem.length === 0) return item;

      const newItem = { ...item };
      pendingForThisItem.forEach(q => {
        if (q.contagemAtualAtiva === 1) {
          newItem.contagem1 = q.valueCounted;
          newItem.contador1Id = q.contadorId;
          newItem.contador1Nome = q.contadorNome;
          newItem.statusContagem = 'Contagem 1';
        } else if (q.contagemAtualAtiva === 2) {
          newItem.contagem2 = q.valueCounted;
          newItem.contador2Id = q.contadorId;
          newItem.contador2Nome = q.contadorNome;
          newItem.statusContagem = 'Contagem 2';
        } else if (q.contagemAtualAtiva === 3) {
          newItem.contagem3 = q.valueCounted;
          newItem.contador3Id = q.contadorId;
          newItem.contador3Nome = q.contadorNome;
          newItem.statusContagem = 'Contagem 3';
        } else if (q.contagemAtualAtiva === 4) {
          newItem.contagemFinal = q.valueCounted;
          newItem.statusContagem = 'Contagem Final';
          newItem.contadorFinal1Id = q.contadorId;
          newItem.contadorFinal1Nome = q.contadorNome;
          if (q.secondAlmoxarifeId) {
            newItem.contadorFinal2Id = q.secondAlmoxarifeId;
            newItem.contadorFinal2Nome = q.secondAlmoxarifeId;
          }
        }
        newItem.contadorUltimo = q.contadorNome;
        newItem.timestampUltimo = q.timestamp;
      });
      return newItem;
    });
  };

  const inventoryItems = getAugmentedInventoryItems(rawInventoryItems, offlineQueue);

  const saveInventoryToSupabase = async (inv: Inventory) => {
    // Save to local cache
    const updatedInventories = inventories.map(i => i.id === inv.id ? inv : i);
    setInventories(updatedInventories);
    try {
      localStorage.setItem('cmpc_inventarios_cache', JSON.stringify(updatedInventories));
    } catch (e) {
      console.error('Error caching inventories:', e);
    }

    const { error } = await supabase
      .from('inventarios')
      .upsert({
        id: inv.id,
        payload: inv
      });

    if (error) {
      console.error('Error saving inventory to Supabase:', error);
      throw error;
    }
  };

  const saveUsersToSupabase = async (updatedUsers: any[]) => {
    setUsuarios(updatedUsers);
    try {
      localStorage.setItem('cmpc_usuarios_cache', JSON.stringify(updatedUsers));
    } catch (e) {
      console.error('Error caching users:', e);
    }
    const { error } = await supabase
      .from('inventarios')
      .upsert({
        id: 'global_config',
        payload: { usuarios: updatedUsers }
      });
    if (error) {
      console.error('Error saving users to Supabase:', error);
      throw error;
    }
  };

  const updateSingleInventoryItem = async (itemId: string, updates: Partial<InventoryItem>) => {
    if (!selectedInventory) return;
    
    // Find the item in our list
    const currentItens = [...(selectedInventory.itens || [])];
    const idx = currentItens.findIndex((i: any) => i.id === itemId);
    if (idx !== -1) {
      const nextItem = { ...currentItens[idx], ...updates };
      // Delete any keys whose values are undefined
      Object.keys(updates).forEach(key => {
        const val = updates[key as keyof typeof updates];
        if (val === undefined) {
          delete (nextItem as any)[key];
        } else {
          (nextItem as any)[key] = val;
        }
      });
      currentItens[idx] = nextItem;

      const updatedInv = { ...selectedInventory, itens: currentItens };
      setSelectedInventory(updatedInv);
      currentItens.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));
      setInventoryItems(currentItens);
      await saveInventoryToSupabase(updatedInv);
    }
  };

  const registerManualInventoryItem = async (inventoryId: string, newItem: any) => {
    const inv = inventories.find(i => i.id === inventoryId);
    if (!inv) {
      throw new Error('Inventário não encontrado.');
    }

    const alreadyExists = (inv.itens || []).some((i: any) => i.codigo.trim().toUpperCase() === newItem.codigo.trim().toUpperCase());
    if (alreadyExists) {
      return; // Already exists, skipped
    }

    const currentItens = [...(inv.itens || [])];
    currentItens.push(newItem);

    const updatedInv = {
      ...inv,
      itens: currentItens,
      totalItens: (inv.totalItens || 0) + 1
    };

    if (selectedInventory?.id === inventoryId) {
      setSelectedInventory(updatedInv);
      currentItens.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));
      setInventoryItems(currentItens);
    }
    await saveInventoryToSupabase(updatedInv);
  };

  // States for inventory delete with PIN authorization
  const [deletingInventoryId, setDeletingInventoryId] = useState<string | null>(null);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Helper calculating if an Almoxarife has already recorded counts for a given item in previous rounds
  const hasAlmoxarifeCountedItemPreviously = (itemId: string, currentRound: number) => {
    if (!userProfile) return false;
    
    // Bypass if the coordinator explicitly assigned this item to the current almoxarife
    const item = inventoryItems.find(i => i.id === itemId);
    if (item && item.almoxarifeAtribuidoId === userProfile.pin) {
      return false;
    }
    
    // Check in-memory sync'd counts
    const hasPriorCount = allCounts.some(c => 
      c.itemInventarioId === itemId && 
      c.inventarioId === selectedInventory?.id &&
      (c.contadorId === userProfile.pin || c.contador === userProfile.nome) &&
      c.numeroContagem < currentRound
    );
    if (hasPriorCount) return true;

    // Check item fields directly as fallback
    if (item) {
      if (currentRound > 1 && (item.contador1Id === userProfile.pin || item.contador1Nome === userProfile.nome)) return true;
      if (currentRound > 2 && (item.contador2Id === userProfile.pin || item.contador2Nome === userProfile.nome)) return true;
      if (currentRound > 3 && (item.contador3Id === userProfile.pin || item.contador3Nome === userProfile.nome)) return true;
    }

    return false;
  };

  // Layout navigation state
  const [currentTab, setCurrentTab] = useState<'ativos' | 'criar' | 'acompanhamento' | 'revisar' | 'consolidar' | 'fechamento' | 'historico'>('ativos');

  // Coordenador Review state managers
  const [selectedReviewGroup, setSelectedReviewGroup] = useState<string | null>(null);
  const [reviewSystemBalances, setReviewSystemBalances] = useState<{ [itemId: string]: string }>({});
  const [reviewAssignments, setReviewAssignments] = useState<{ [itemId: string]: string }>({});
  const [reviewLaudoText, setReviewLaudoText] = useState<{ [itemId: string]: string }>({});
  const [reviewPlanoText, setReviewPlanoText] = useState<{ [itemId: string]: string }>({});

  // Contagem Final support
  const [secondAlmoxarifeId, setSecondAlmoxarifeId] = useState<{ [itemId: string]: string }>({});
  const [secondAlmoxarifePin, setSecondAlmoxarifePin] = useState<{ [itemId: string]: string }>({});

  // Post-conclusion edits states
  const [showTreatedInConsolidacao, setShowTreatedInConsolidacao] = useState(false);
  const [postConclusionEdits, setPostConclusionEdits] = useState<any[]>([]);
  const [editingPostConclusionItem, setEditingPostConclusionItem] = useState<InventoryItem | null>(null);
  const [editingPostConclusionFicha, setEditingPostConclusionFicha] = useState<string>('');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [justificationInput, setJustificationInput] = useState('');
  const [newCountInput, setNewCountInput] = useState('');
  const [postConclusionError, setPostConclusionError] = useState('');
  const [submittingPostConclusion, setSubmittingPostConclusion] = useState(false);

  // Helper calculating writable statuses for any Almoxarife (Access Control)
  const isItemWritableForAlmoxarife = (item: InventoryItem) => {
    if (userProfile?.cargo !== 'Almoxarife') return false;
    if (!selectedInventory) return false;
    
    const groupName = item.grupo || 'Grupo Geral';
    const attrib = (selectedInventory.atribuicoes || []).find((a: any) => a.grupoId === groupName);
    const status = attrib?.status || 'Aberta';

    // If the overall Ficha is closed or awaiting coordinator review, it's locked
    const isSheetLocked = status === 'Aguardando Coordenador' || status === 'Concluída';
    if (isSheetLocked) return false;

    // If explicitly assigned to this storekeeper (reopened/reassigned/recontagem), they can count it immediately
    if (item.almoxarifeAtribuidoId === userProfile?.pin) {
      return true;
    }

    // 1. Contagem 1
    if (item.contagemAtualAtiva === 1) {
      const isOwner = attrib && (item.almoxarifeAtribuidoId ? item.almoxarifeAtribuidoId === userProfile.pin : attrib.almoxarifeId === userProfile.pin);
      return isOwner && (status === 'Aberta' || status === 'Em contagem' || status === 'Em recontagem');
    }

    // 2. Contagem 2, 3, 4 (Recount)
    if (item.contagemAtualAtiva > 1) {
      const isAssigned = item.almoxarifeAtribuidoId === userProfile.pin;
      return isAssigned && (status === 'Em recontagem' || status === 'Em contagem');
    }

    return false;
  };

  // Helper calculating which stock groups apply to currently logged-in Almoxarife
  const getAlmoxarifeGroups = () => {
    if (!selectedInventory) return [];
    const groupsSet = new Set<string>();
    
    // 1. Groups where user is assigned for Contagem 1
    const attribs = selectedInventory.atribuicoes || [];
    attribs.forEach((a: any) => {
      if (a.almoxarifeId === userProfile?.pin) {
        groupsSet.add(a.grupoId);
      }
    });
    
    // 2. Groups where user is individually assigned for Re-counting or reopened Contagem 1 (or any round)
    inventoryItems.forEach((item) => {
      if (item.almoxarifeAtribuidoId === userProfile?.pin) {
        groupsSet.add(item.grupo || 'Grupo Geral');
      }
    });
    
    return Array.from(groupsSet).sort();
  };

  // Helper checking if Almoxarife still has pending counts in a group
  const isFichaGroupCountPending = (groupName: string) => {
    if (!selectedInventory) return false;
    const targetItems = inventoryItems.filter(item => {
      if ((item.grupo || 'Grupo Geral') !== groupName) return false;
      
      // If explicitly assigned to this user, check if we need to count it for the current active round
      if (item.almoxarifeAtribuidoId === userProfile?.pin) {
        if (optimisticCounted[item.id] !== undefined) return false;
        if (item.contagemAtualAtiva === 1 && item.contagem1 === undefined) return true;
        if (item.contagemAtualAtiva === 2 && item.contagem2 === undefined) return true;
        if (item.contagemAtualAtiva === 3 && item.contagem3 === undefined) return true;
        if (item.contagemAtualAtiva === 4 && item.contagemFinal === undefined) return true;
        return false;
      }

      const attrib = (selectedInventory.atribuicoes || []).find((a: any) => a.grupoId === groupName);
      const isOwner = attrib && attrib.almoxarifeId === userProfile?.pin;
      
      if (item.contagemAtualAtiva === 1 && isOwner) {
        // If assigned to someone else, bypass
        if (item.almoxarifeAtribuidoId && item.almoxarifeAtribuidoId !== userProfile?.pin) return false;
        if (optimisticCounted[item.id] !== undefined) return false;
        return item.contagem1 === undefined;
      }
      
      if (item.contagemAtualAtiva > 1 && item.almoxarifeAtribuidoId === userProfile?.pin) {
        const hasCountedPrev = hasAlmoxarifeCountedItemPreviously(item.id, item.contagemAtualAtiva);
        if (hasCountedPrev) return false;

        if (optimisticCounted[item.id] !== undefined) return false;
        if (item.contagemAtualAtiva === 2 && item.contagem2 === undefined) return true;
        if (item.contagemAtualAtiva === 3 && item.contagem3 === undefined) return true;
        if (item.contagemAtualAtiva === 4 && item.contagemFinal === undefined) return true;
      }
      
      return false;
    });
    
    return targetItems.length > 0;
  };

  // New inventory formulate state
  const [newInvTipo, setNewInvTipo] = useState<'Geral' | 'Parcial' | 'Cíclico' | 'Eventual' | 'Transferência de responsabilidade'>('Geral');
  const [newInvResponsavel, setNewInvResponsavel] = useState('');
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<string[]>(DEFAULT_CMPC_CATALOG.map(i => i.codigo));
  const [newInvDataInicio, setNewInvDataInicio] = useState('');
  const [newInvDataFim, setNewInvDataFim] = useState('');
  const [manualCodesInput, setManualCodesInput] = useState('');
  const [importedMoves, setImportedMoves] = useState<{ codigo: string; dataMov: string }[]>([]);
  const [movesFileName, setMovesFileName] = useState('');
  const [closingObservations, setClosingObservations] = useState('');
  const [customItems, setCustomItems] = useState<{ codigo: string; descricao: string; unidade: string; valorUnitario: number; grupo?: string; saldoSistema?: number; cadastradoManualmente?: boolean }[]>([]);
  const [customCod, setCustomCod] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customUni, setCustomUni] = useState('UN');
  const [customVal, setCustomVal] = useState(1);
  const [creationLoading, setCreationLoading] = useState(false);

  // States for the newly added Manual Items Registration system (invalid stock codes)
  const [isManualRegModalOpen, setIsManualRegModalOpen] = useState(false);
  const [unregisteredCodesQueue, setUnregisteredCodesQueue] = useState<string[]>([]);
  const [manualRegCode, setManualRegCode] = useState('');
  const [manualRegDesc, setManualRegDesc] = useState('');
  const [manualRegClass, setManualRegClass] = useState('');
  const [manualRegCustomClass, setManualRegCustomClass] = useState('');
  const [manualRegUnit, setManualRegUnit] = useState('UN');
  const [manualRegValueUnitario, setManualRegValueUnitario] = useState('');
  const [showCustomClassInput, setShowCustomClassInput] = useState(false);

  // States for HTML Stock Baseline Import
  const [importedItems, setImportedItems] = useState<{
    codigo: string;
    codigoAlternativo?: string;
    descricao: string;
    unidade: string;
    saldoSistema: number;
    valorUnitario: number;
    grupo?: string;
  }[]>([]);
  const [importFileName, setImportedFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [useImportedBaseline, setUseImportedBaseline] = useState(true);

  // Grouped assignments states for new tracking requirements
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string; pin: string; cargo: string }[]>([]);
  const [groupAssignments, setGroupAssignments] = useState<{ [grupoId: string]: { almoxarifeId: string; almoxarifeNome: string } }>({});
  const [selectedFichaGroup, setSelectedFichaGroup] = useState<string | null>(null);

  // Requirement 1 & 5: Creator wizard steps and Partial Scope state variables
  const [creationStep, setCreationStep] = useState<number>(1);
  const [itemSelectMethod, setItemSelectMethod] = useState<'movimentacoes' | 'manualmente'>('manualmente');
  const [selectedInScopeItems, setSelectedInScopeItems] = useState<Record<string, boolean>>({});
  const [outgoingCoordinator, setOutgoingCoordinator] = useState('');
  const [incomingCoordinator, setIncomingCoordinator] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [movesFileError, setMovesFileError] = useState('');

  // Requirement 3: Responsible alteration log lists and modals
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignGroup, setReassignGroup] = useState('');
  const [reassignNewPin, setReassignNewPin] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignError, setReassignError] = useState('');
  const [reassignLogs, setReassignLogs] = useState<any[]>([]);

  // Requirement 4: Sheet unlock checklists, logs and modals
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockGroup, setUnlockGroup] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockJustification, setUnlockJustification] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [reopenLogs, setReopenLogs] = useState<any[]>([]);

  // States for reopening specific count rounds (CMPC requirement)
  const [reopenCountModalOpen, setReopenCountModalOpen] = useState(false);
  const [reopenCountItem, setReopenCountItem] = useState<InventoryItem | null>(null);
  const [reopenCountRound, setReopenCountRound] = useState<number | null>(null);
  const [reopenCountVal, setReopenCountVal] = useState<number | undefined>(undefined);
  const [reopenCountContador, setReopenCountContador] = useState<string | undefined>('');
  const [reopenCountContadorId, setReopenCountContadorId] = useState<string | undefined>('');
  const [reopenPin, setReopenPin] = useState('');
  const [reopenJustification, setReopenJustification] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [reopenActionType, setReopenActionType] = useState<'recount' | 'direct_edit'>('recount');
  const [reopenNewValue, setReopenNewValue] = useState<string>('');

  // Multi-item bulk assignment state
  const [selectedItemsForBulk, setSelectedItemsForBulk] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState<string>('');
  const [bulkAssignLoading, setBulkAssignLoading] = useState(false);

  // State para armazenar as contagens vindas do Supabase (inventario_contagens)
  const [contagensRealizadas, setContagensRealizadas] = useState<any[]>([]);

  // State para armazenar o snapshot imutável de consolidação final (inventario_consolidacao_final)
  const [consolidatedSnapshot, setConsolidatedSnapshot] = useState<any[] | null>(null);

  // Reset bulk selections when the selected sheet group changes
  useEffect(() => {
    setSelectedItemsForBulk([]);
    setBulkAssignee('');
  }, [selectedReviewGroup]);

  // Predefined CMPC Almoxarifes for quick dropdown values
  const PREDEFINED_ALMOXARIFES = [
    { id: '1011', nome: 'IVANILDO SANTOS RABELO', pin: '1011', cargo: 'Almoxarife' },
    { id: '2841', nome: 'ALINE PINHEIRO LEAL', pin: '2841', cargo: 'Almoxarife' },
    { id: '1012', nome: 'FABIO JOSE PEREIRA DE OLIVEIRA', pin: '1012', cargo: 'Almoxarife' },
    { id: '1013', nome: 'ERECIAS SILVA DIAS', pin: '1013', cargo: 'Almoxarife' },
    { id: '1014', nome: 'WIDERLEY VIEIRA DA SILVA', pin: '1014', cargo: 'Almoxarife' },
    { id: '1015', nome: 'JOSE SANTANA BARBOSA', pin: '1015', cargo: 'Almoxarife' },
    { id: '1016', nome: 'JORGE LUIS FERREIRA MENDES', pin: '1016', cargo: 'Almoxarife' },
    { id: '1017', nome: 'ALEX SANDRO SILVA DE OLIVEIRA', pin: '1017', cargo: 'Auxiliar' },
    { id: '1018', nome: 'THAYS SILVA LISBOA', pin: '1018', cargo: 'Auxiliar' },
    { id: '1019', nome: 'EDUARDO NUNES DOS SANTOS JUNIOR', pin: '1019', cargo: 'Auxiliar' }
  ];

  // Lista de Agentes de Contagem com Biometria Facial Cadastrada e PINs (Supabase)
  const [listaAgentes, setListaAgentes] = useState<any[]>([]);

  const carregarAgentesDisponiveis = useCallback(async () => {
    try {
      // 1. Pega usuários com biometria facial cadastrada na tabela usuarios
      const { data: rostos, error: erroRostos } = await supabase
        .from('usuarios')
        .select('id, id_biometria_vinculada, nome, face_descriptor, face_cadastrado_em');

      if (erroRostos) {
        console.warn('Aviso ao carregar rostos do Supabase:', erroRostos);
      }

      // 2. Pega todos os registros de permissão e PINs na tabela usuarios_permissoes
      const { data: permissoes, error: erroPermissoes } = await supabase
        .from('usuarios_permissoes')
        .select('id, pin, nome, cargo, face_cadastrado_em');

      if (erroPermissoes) {
        console.warn('Aviso ao carregar permissoes do Supabase:', erroPermissoes);
      }

      // 3. Front-end Join robusto: Cruza Nome, PIN e Status da Biometria
      const agentesMap = new Map();

      // Mapear por PINs e Permissões
      (permissoes || []).forEach((p: any) => {
        if (p.pin) {
          const vinculadoRosto = (rostos || []).find((r: any) => 
            String(r.id_biometria_vinculada) === String(p.id) || 
            String(r.id) === String(p.id) ||
            (r.nome && p.nome && r.nome.trim().toUpperCase() === p.nome.trim().toUpperCase())
          );
          const temBio = !!(
            (vinculadoRosto && (vinculadoRosto.face_descriptor || vinculadoRosto.face_cadastrado_em)) || 
            p.face_cadastrado_em
          );

          agentesMap.set(String(p.pin), {
            id: p.id || p.pin,
            pin: String(p.pin),
            nome: p.nome || vinculadoRosto?.nome || 'Agente CMPC',
            cargo: p.cargo || 'Almoxarife',
            temBiometria: temBio,
            faceCadastradoEm: p.face_cadastrado_em || vinculadoRosto?.face_cadastrado_em || null,
            statusBio: temBio ? '🟢 Rosto Cadastrado (Biometria Ativa)' : '⚪ Sem Biometria'
          });
        }
      });

      // Incluir rostos cadastrados que tenham ID ou vínculo compatível com PIN
      (rostos || []).forEach((r: any) => {
        const pinFallback = r.id_biometria_vinculada && String(r.id_biometria_vinculada).length <= 6 
          ? String(r.id_biometria_vinculada) 
          : (r.id && String(r.id).length <= 6 ? String(r.id) : null);

        if (pinFallback && !agentesMap.has(pinFallback)) {
          const temBio = !!(r.face_descriptor || r.face_cadastrado_em);
          agentesMap.set(pinFallback, {
            id: r.id || r.id_biometria_vinculada,
            pin: pinFallback,
            nome: r.nome || 'Agente CMPC',
            cargo: 'Almoxarife',
            temBiometria: temBio,
            faceCadastradoEm: r.face_cadastrado_em || null,
            statusBio: temBio ? '🟢 Rosto Cadastrado (Biometria Ativa)' : '⚪ Sem Biometria'
          });
        }
      });

      let resultadoFinal = Array.from(agentesMap.values());

      if (resultadoFinal.length === 0) {
        resultadoFinal = PREDEFINED_ALMOXARIFES.map(p => ({
          ...p,
          temBiometria: false,
          statusBio: '⚪ Predefinido'
        }));
      }

      resultadoFinal.sort((a: any, b: any) => a.nome.localeCompare(b.nome));
      setListaAgentes(resultadoFinal);

    } catch (err) {
      console.error("Erro ao cruzar biometria com PINs reais:", err);
      setListaAgentes(PREDEFINED_ALMOXARIFES.map(p => ({
        ...p,
        temBiometria: false,
        statusBio: '⚪ Predefinido'
      })));
    }
  }, []);

  useEffect(() => {
    carregarAgentesDisponiveis();
  }, [carregarAgentesDisponiveis]);

  // Helper function to resolve merged list of almoxarifes
  const getMergedAlmoxarifes = () => {
    if (listaAgentes.length > 0) {
      return listaAgentes;
    }
    const list = [...PREDEFINED_ALMOXARIFES.map(p => ({ ...p, temBiometria: false, statusBio: '⚪ Predefinido' }))];
    usuarios.forEach((u) => {
      if (u.cargo !== 'Coordenador' && u.cargo !== 'Auditor' && !list.some((p) => p.pin === u.pin)) {
        list.push({ id: u.pin, nome: u.nome, pin: u.pin, cargo: u.cargo || 'Almoxarife', temBiometria: false, statusBio: '⚪ Sistema' });
      }
    });
    return list;
  };

  // Helper to retrieve stock group for any given inventory items
  const getItemGrupo = (item: any) => {
    if (item.grupo) return item.grupo;
    const cod = (item.codigo || '').toUpperCase();
    if (cod.startsWith('UNI')) return 'Uniformes';
    if (cod.startsWith('EQU')) return 'Equipamentos e Máquinas';
    if (cod.startsWith('MAT')) return 'Acessórios e Conexões';
    if (cod.startsWith('OUT')) return 'Consumíveis e EPIs';
    return 'Grupo Geral';
  };

  // Helper to calculate total items, counted progress dynamically for each group
  const getGroupMetrics = (groupName: string) => {
    const gItems = inventoryItems.filter(i => (i.grupo || 'Grupo Geral') === groupName);
    const total = gItems.length;
    const counted = gItems.filter(i => i.statusContagem !== 'Pendente').length;
    const progress = total > 0 ? Math.round((counted / total) * 105) : 0;
    const cappedProgress = progress > 100 ? 100 : progress; // Safe capping
    return { total, counted, progress: cappedProgress };
  };

  // Helper to check for inactive / idle groups for more than 15 minutes (Requirement 3)
  const getGroupIdleStatus = (groupName: string) => {
    if (!selectedInventory) return { isIdle: false, text: '' };
    
    const groupCounts = allCounts
      .filter((c: any) => c.inventarioId === selectedInventory.id && c.grupoEstoque === groupName)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (groupCounts.length === 0) {
      const createdSecs = new Date(selectedInventory.createdAt).getTime();
      const diffMs = Date.now() - createdSecs;
      const minSinceStart = Math.floor(diffMs / 60000);
      if (minSinceStart >= 15) {
        return { isIdle: true, text: `Alerta: Grupo sem nenhuma contagem registrada há ${minSinceStart} minutos desde o início.` };
      }
      return { isIdle: false, text: '' };
    }

    const latestTime = new Date(groupCounts[0].timestamp).getTime();
    const inactiveMs = Date.now() - latestTime;
    const inactiveMin = Math.floor(inactiveMs / 60000);
    if (inactiveMin >= 15) {
      return { isIdle: true, text: `Alerta: Grupo paralisado há ${inactiveMin} minutos. Última contagem às ${new Date(latestTime).toLocaleTimeString('pt-BR')}` };
    }
    return { isIdle: false, text: '' };
  };

  // Memoized planned items that will be included in the inventory creation scope
  const plannedItems = React.useMemo(() => {
    let items: { codigo: string; descricao: string; unidade: string; valorUnitario: number; saldoSistema?: number; grupo?: string; cadastradoManualmente?: boolean }[] = [];
    if (importedItems.length > 0 && useImportedBaseline) {
      items = [...importedItems, ...customItems];
    } else {
      DEFAULT_CMPC_CATALOG.forEach(catalogItem => {
        if (selectedCatalogItems.includes(catalogItem.codigo)) {
          items.push(catalogItem);
        }
      });
      items.push(...customItems);
    }

    const hasManualCodes = (newInvTipo === 'Parcial' || newInvTipo === 'Cíclico') && manualCodesInput.trim() !== '';

    // Apply manual codes input (one per line or comma/semicolon-separated)
    if (hasManualCodes) {
      const codes = manualCodesInput
        .split(/[\n,;]+/)
        .map(c => c.trim().toUpperCase())
        .filter(c => c !== '');
        
      if (codes.length > 0) {
        const manualItems: typeof items = [];
        codes.forEach(code => {
          const existing = items.find(i => i.codigo.toUpperCase() === code);
          if (existing) {
            manualItems.push(existing);
          } else {
            // Find in customItems (it should be there since we register it)
            const cust = customItems.find(i => i.codigo.toUpperCase() === code);
            if (cust) {
              manualItems.push(cust);
            } else {
              // Fallback just in case, or we trigger verification modal
              manualItems.push({
                codigo: code,
                descricao: `ITEM MANUAL DESCONHECIDO (CÓD. ${code})`,
                unidade: 'UN',
                saldoSistema: 0,
                valorUnitario: 0,
                grupo: 'CMPC MANUAL - SALDO ZERO'
              });
            }
          }
        });
        items = manualItems;
      }
    }

    // Apply movement report filtering if available, ONLY if manualCodesInput is empty (they shouldn't be applied together)
    if ((newInvTipo === 'Parcial' || newInvTipo === 'Cíclico') && importedMoves.length > 0 && !hasManualCodes) {
      const cellDateHelper = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        const clean = dateStr.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
          return new Date(clean.slice(0, 10));
        }
        const matchBr = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
        if (matchBr) {
          let day = parseInt(matchBr[1], 10);
          let month = parseInt(matchBr[2], 10) - 1;
          let year = parseInt(matchBr[3], 10);
          if (year < 100) year += 2000;
          return new Date(year, month, day);
        }
        const p = Date.parse(clean);
        return isNaN(p) ? null : new Date(p);
      };

      const inRange = (dStr: string) => {
        const cellD = cellDateHelper(dStr);
        if (!cellD) return false;
        const targetStart = newInvDataInicio ? new Date(newInvDataInicio + 'T00:00:00') : null;
        const targetEnd = newInvDataFim ? new Date(newInvDataFim + 'T23:59:59') : null;
        if (targetStart && cellD < targetStart) return false;
        if (targetEnd && cellD > targetEnd) return false;
        return true;
      };

      const movedCodes = new Set(
        importedMoves
          .filter(m => inRange(m.dataMov))
          .map(m => m.codigo.trim().toUpperCase())
      );

      // Keep items that exist in movedCodes, but make sure to also include registered customItems
      items = items.filter(i => movedCodes.has(i.codigo.toUpperCase()));
    }

    // Final foolproof deduplication by code: each code should only exist once in the planned scope
    const deduplicatedResults: typeof items = [];
    const seenCodes = new Set<string>();
    items.forEach(i => {
      const codeUpper = i.codigo.trim().toUpperCase();
      if (!seenCodes.has(codeUpper)) {
        seenCodes.add(codeUpper);
        deduplicatedResults.push(i);
      }
    });

    return deduplicatedResults;
  }, [importedItems, useImportedBaseline, selectedCatalogItems, customItems, newInvTipo, manualCodesInput, importedMoves, newInvDataInicio, newInvDataFim]);

  // Memoized list of invalid manual codes that were not found in the baseline base stock
  const invalidCodes = React.useMemo(() => {
    if ((newInvTipo !== 'Parcial' && newInvTipo !== 'Cíclico') || manualCodesInput.trim() === '') {
      return [];
    }
    const codes = manualCodesInput
      .split(/[\n,;]+/)
      .map(c => c.trim().toUpperCase())
      .filter(c => c !== '');
      
    let baseList: { codigo: string }[] = [];
    if (importedItems.length > 0 && useImportedBaseline) {
      baseList = [...importedItems, ...customItems];
    } else {
      baseList = [...DEFAULT_CMPC_CATALOG, ...customItems];
    }
    
    const validSet = new Set(baseList.map(item => item.codigo.toUpperCase()));
    return codes.filter(code => !validSet.has(code));
  }, [importedItems, useImportedBaseline, customItems, newInvTipo, manualCodesInput]);

  // Memoized parsed manual codes with duplicate analysis for visual feedback in real-time
  const parsedManualCodes = React.useMemo(() => {
    if (manualCodesInput.trim() === '') return [];
    const codes = manualCodesInput
      .split(/[\n,;]+/)
      .map(c => c.trim().toUpperCase())
      .filter(c => c !== '');
      
    const seen = new Set<string>();
    return codes.map(code => {
      let isDuplicated = false;
      if (seen.has(code)) {
        isDuplicated = true;
      } else {
        seen.add(code);
      }
      return {
        code,
        isDuplicated
      };
    });
  }, [manualCodesInput]);

  // Memoized identified stock groups derived from the active baseline scope
  const identifiedGroups = React.useMemo(() => {
    const groupsMap: { [groupName: string]: number } = {};
    plannedItems.forEach(item => {
      const gn = getItemGrupo(item);
      groupsMap[gn] = (groupsMap[gn] || 0) + 1;
    });
    return Object.keys(groupsMap).map(name => ({
      name,
      count: groupsMap[name]
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [plannedItems]);

  // HTML Parser Helper for SGI Stock Spreadsheet
  const parseHtmlStockFile = (htmlText: string) => {
    try {
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(htmlText, 'text/html');
      const rows = Array.from(htmlDoc.querySelectorAll('table tr'));
      
      let headerRowIndex = -1;
      let colMap = {
        codigo: 2,
        descricao: 4,
        unidade: 6,
        saldoSistema: 7,
        valorUnitario: 8,
        grupo: 5 // Default index between Descrição and Unidade in standard report
      };

      // Search for header row containing key columns
      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const tds = rows[r].querySelectorAll('td, th');
        let hasKeywords = false;
        tds.forEach((td) => {
          const txt = (td.textContent || '').trim().toLowerCase();
          if (txt.includes('descri') || txt.includes('unid') || txt.includes('saldo') || txt.includes('código') || txt.includes('codigo')) {
            hasKeywords = true;
          }
        });

        if (hasKeywords) {
          headerRowIndex = r;
          tds.forEach((td, colIdx) => {
            const txt = (td.textContent || '').trim().toLowerCase();
            if (txt === 'código' || txt === 'codigo' || txt === 'cod' || txt === 'cód' || txt === 'cód.') {
              colMap.codigo = colIdx;
            } else if (txt.includes('descri')) {
              colMap.descricao = colIdx;
            } else if (txt.includes('unid')) {
              colMap.unidade = colIdx;
            } else if (txt.includes('saldo') || txt.includes('qtd') || txt.includes('quant')) {
              colMap.saldoSistema = colIdx;
            } else if (txt.includes('valor unit') || txt.includes('val. unit') || (txt.includes('val') && txt.includes('unit'))) {
              colMap.valorUnitario = colIdx;
            } else if (txt.includes('grupo') || txt.includes('classe') || txt.includes('família') || txt.includes('familia') || txt.includes('categoria')) {
              colMap.grupo = colIdx;
            }
          });
          break;
        }
      }

      const list: {
        codigo: string;
        descricao: string;
        unidade: string;
        saldoSistema: number;
        valorUnitario: number;
        grupo?: string;
      }[] = [];

      rows.forEach((row, idx) => {
        // Skip header index and any rows before it
        if (idx <= headerRowIndex) return;

        const tds = row.querySelectorAll('td');
        const maxIdxNeeded = Math.max(colMap.codigo, colMap.descricao, colMap.unidade, colMap.saldoSistema, colMap.valorUnitario, colMap.grupo);
        if (tds.length >= maxIdxNeeded + 1) {
          const getCleanText = (td: HTMLTableCellElement) => {
            if (!td) return '';
            const div = td.querySelector('.cell');
            const text = div ? div.textContent : td.textContent;
            return text ? text.trim() : '';
          };

          const codigo = getCleanText(tds[colMap.codigo]);
          const descricao = getCleanText(tds[colMap.descricao]);
          const unidade = getCleanText(tds[colMap.unidade]);
          const qtdStr = getCleanText(tds[colMap.saldoSistema]);
          const valUnitStr = getCleanText(tds[colMap.valorUnitario]);
          const grupo = getCleanText(tds[colMap.grupo]);

          // Filter out header, blanks or footer row
          if (!codigo || isNaN(Number(codigo)) || !descricao) {
            return;
          }

          // Format parser for Brazilian currency/number format: dots are thousands, comma is decimal
          const parseBrazilianQty = (vStr: string): number => {
            if (!vStr) return 0;
            const stripped = vStr.replace(/\s/g, '');
            const dotsRemoved = stripped.replace(/\./g, '');
            const commasReplaced = dotsRemoved.replace(/,/g, '.');
            const parsed = parseFloat(commasReplaced);
            return isNaN(parsed) ? 0 : parsed;
          };

          list.push({
            codigo: codigo,
            descricao: descricao,
            unidade: unidade || 'UN',
            saldoSistema: parseBrazilianQty(qtdStr),
            valorUnitario: parseBrazilianQty(valUnitStr),
            grupo: grupo || 'Grupo Geral'
          });
        }
      });

      return list;
    } catch (e) {
      console.error('Error during DOM stock file parsing: ', e);
      return [];
    }
  };

  const parseExcelStockFile = (arrayBuffer: ArrayBuffer) => {
    try {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      
      let headerRowIndex = -1;
      let colMap = {
        codigo: 0,
        codigoAlternativo: -1,
        descricao: 1,
        unidade: 2,
        saldoSistema: 3,
        valorUnitario: 4,
        grupo: 5
      };

      for (let r = 0; r < Math.min(rows.length, 12); r++) {
        const row = rows[r];
        if (Array.isArray(row)) {
          let hasKeywords = false;
          row.forEach((cell) => {
            const txt = String(cell || '').trim().toLowerCase();
            if (txt.includes('descri') || txt.includes('unid') || txt.includes('saldo') || txt.includes('código') || txt.includes('codigo')) {
              hasKeywords = true;
            }
          });
          if (hasKeywords) {
            headerRowIndex = r;
            row.forEach((cell, cellIdx) => {
              const txt = String(cell || '').trim().toLowerCase();
              if (txt === 'código alternativo' || txt === 'codigo alternativo' || txt.includes('alternativo') || txt === 'alt') {
                colMap.codigoAlternativo = cellIdx;
              } else if (txt === 'código do item' || txt === 'codigo do item' || txt === 'código' || txt === 'codigo' || txt === 'cod' || txt === 'cód' || txt === 'cód.' || txt === 'material') {
                colMap.codigo = cellIdx;
              } else if (txt.includes('descri')) {
                colMap.descricao = cellIdx;
              } else if (txt.includes('unid')) {
                colMap.unidade = cellIdx;
              } else if (txt.includes('saldo') || txt.includes('qtd') || txt.includes('quant')) {
                colMap.saldoSistema = cellIdx;
              } else if (txt.includes('valor unit') || txt.includes('val. unit') || (txt.includes('val') && txt.includes('unit'))) {
                colMap.valorUnitario = cellIdx;
              } else if (txt.includes('grupo') || txt.includes('classe') || txt.includes('família') || txt.includes('categoria')) {
                colMap.grupo = cellIdx;
              }
            });
            break;
          }
        }
      }

      const list: {
        codigo: string;
        codigoAlternativo?: string;
        descricao: string;
        unidade: string;
        saldoSistema: number;
        valorUnitario: number;
        grupo?: string;
      }[] = [];

      rows.forEach((row, idx) => {
        if (idx <= headerRowIndex) return;
        if (Array.isArray(row)) {
          const codigo = String(row[colMap.codigo] || '').trim();
          const codigoAlternativo = colMap.codigoAlternativo !== -1 ? String(row[colMap.codigoAlternativo] || '').trim() : '';
          const descricao = String(row[colMap.descricao] || '').trim();
          const unidade = String(row[colMap.unidade] || 'UN').trim();
          
          const rawQ = row[colMap.saldoSistema];
          let qtdVal = 0;
          if (rawQ !== undefined && rawQ !== null) {
            qtdVal = typeof rawQ === 'number' ? rawQ : parseFloat(String(rawQ).replace(/\./g, '').replace(/,/g, '.')) || 0;
          }

          const rawV = row[colMap.valorUnitario];
          let priceVal = 0;
          if (rawV !== undefined && rawV !== null) {
            priceVal = typeof rawV === 'number' ? rawV : parseFloat(String(rawV).replace(/\./g, '').replace(/,/g, '.')) || 0;
          }

          const grupo = String(row[colMap.grupo] || 'Grupo Geral').trim();

          if (codigo && !isNaN(Number(codigo)) && descricao) {
            list.push({
              codigo,
              codigoAlternativo,
              descricao,
              unidade,
              saldoSistema: qtdVal,
              valorUnitario: priceVal,
              grupo
            });
          }
        }
      });
      return list;
    } catch (e) {
      console.error("Error parsing Excel stock file", e);
      return [];
    }
  };

  const parseExcelMovementFile = (arrayBuffer: ArrayBuffer) => {
    try {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      let headerRowIndex = -1;
      let colMap = {
        codigo: 0,
        dataMov: 1
      };

      for (let r = 0; r < Math.min(rows.length, 15); r++) {
        const row = rows[r];
        if (Array.isArray(row)) {
          let foundCode = false;
          let foundDate = false;
          row.forEach((cell, cellIdx) => {
            const txt = String(cell || '').trim().toLowerCase();
            if (txt === 'código' || txt === 'codigo' || txt === 'cod' || txt === 'cód' || txt === 'cód.' || txt === 'material' || txt === 'item') {
              colMap.codigo = cellIdx;
              foundCode = true;
            } else if (txt.includes('data') || txt.includes('lanç') || txt.includes('mov') || txt.includes('periodo')) {
              colMap.dataMov = cellIdx;
              foundDate = true;
            }
          });
          if (foundCode && foundDate) {
            headerRowIndex = r;
            break;
          }
        }
      }

      const list: { codigo: string; dataMov: string }[] = [];
      rows.forEach((row, idx) => {
        if (idx <= headerRowIndex) return;
        if (Array.isArray(row)) {
          const codigo = String(row[colMap.codigo] || '').trim();
          const rawDate = row[colMap.dataMov];
          let dataMovStr = '';
          if (rawDate !== undefined && rawDate !== null) {
            if (typeof rawDate === 'number') {
              try {
                const dateObj = XLSX.SSF.parse_date_code(rawDate);
                dataMovStr = `${dateObj.d}/${dateObj.m}/${dateObj.y}`;
              } catch (e) {
                dataMovStr = String(rawDate).trim();
              }
            } else {
              dataMovStr = String(rawDate).trim();
            }
          }

          if (codigo && dataMovStr) {
            list.push({ codigo, dataMov: dataMovStr });
          }
        }
      });
      return list;
    } catch (e) {
      console.error("Error parsing Excel movement file", e);
      return [];
    }
  };

  const parseHtmlMovementFile = (htmlText: string) => {
    try {
      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(htmlText, 'text/html');
      const rows = Array.from(htmlDoc.querySelectorAll('table tr'));
      
      let headerRowIndex = -1;
      let colMap = {
        codigo: -1,
        dataMov: -1
      };

      for (let r = 0; r < Math.min(rows.length, 15); r++) {
        const tds = rows[r].querySelectorAll('td, th');
        let foundCode = false;
        let foundDate = false;
        tds.forEach((td, colIdx) => {
          const txt = (td.textContent || '').trim().toLowerCase();
          if (txt === 'código' || txt === 'codigo' || txt === 'cod' || txt === 'cód' || txt === 'cód.' || txt === 'material' || txt === 'item') {
            colMap.codigo = colIdx;
            foundCode = true;
          } else if (txt.includes('data') || txt.includes('lanç') || txt.includes('mov') || txt.includes('periodo')) {
            colMap.dataMov = colIdx;
            foundDate = true;
          }
        });
        if (foundCode && foundDate) {
          headerRowIndex = r;
          break;
        }
      }

      if (colMap.codigo === -1) colMap.codigo = 0;
      if (colMap.dataMov === -1) colMap.dataMov = 1;

      const list: { codigo: string; dataMov: string }[] = [];
      rows.forEach((row, idx) => {
        if (idx <= headerRowIndex) return;
        const tds = row.querySelectorAll('td');
        if (tds.length >= Math.max(colMap.codigo, colMap.dataMov) + 1) {
          const getCleanText = (td: HTMLTableCellElement) => {
            if (!td) return '';
            const div = td.querySelector('.cell');
            const text = div ? div.textContent : td.textContent;
            return text ? text.trim() : '';
          };

          const codigo = getCleanText(tds[colMap.codigo]);
          const dataMov = getCleanText(tds[colMap.dataMov]);

          if (codigo && dataMov) {
            list.push({ codigo, dataMov });
          }
        }
      });
      return list;
    } catch (e) {
      console.error('Error parsing movement HTML: ', e);
      return [];
    }
  };

  const handleMovesFileImport = (file: File) => {
    if (!file) return;
    setMovesFileError('');
    if (!newInvDataInicio || !newInvDataFim) {
      setMovesFileError('Por favor, defina a Data Inicial e Final do período de referência primeiro.');
      return;
    }
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isHtml = file.name.endsWith('.html') || file.name.endsWith('.htm');

    if (!isExcel && !isHtml) {
      setMovesFileError('Selecione apenas arquivos (.html, .htm, .xlsx, .xls) de movimentações.');
      return;
    }

    const reader = new FileReader();
    if (isExcel) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const parsedList = parseExcelMovementFile(data);
          if (parsedList.length === 0) {
            setMovesFileError('Nenhum registro de movimentação válido foi identificado no arquivo Excel.');
            return;
          }
          
          // Deduplicate items on import by code
          const seenMoves = new Set<string>();
          const uniqueMoves: typeof parsedList = [];
          let duplicateMovesCount = 0;
          parsedList.forEach(m => {
            const code = m.codigo.trim().toUpperCase();
            if (seenMoves.has(code)) {
              duplicateMovesCount++;
            } else {
              seenMoves.add(code);
              uniqueMoves.push(m);
            }
          });

          setImportedMoves(uniqueMoves);
          setMovesFileName(file.name);
          setMovesFileError('');
          checkMovesFileUnregisteredCodes(uniqueMoves);
          
          triggerToast(`📥 Relatório de Movimentações Excel carregado: ${uniqueMoves.length} itens importados — ${duplicateMovesCount} duplicatas ignoradas`);
        } catch (err: any) {
          setMovesFileError(`Erro ao ler arquivo de movimentações Excel: ${err.message || err}`);
        }
      };
      reader.onerror = () => setMovesFileError('Erro ao ler arquivo.');
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsedList = parseHtmlMovementFile(text);
          if (parsedList.length === 0) {
            setMovesFileError('Nenhum registro de movimentação válido foi identificado no arquivo HTML.');
            return;
          }
          
          // Deduplicate items on import by code
          const seenMoves = new Set<string>();
          const uniqueMoves: typeof parsedList = [];
          let duplicateMovesCount = 0;
          parsedList.forEach(m => {
            const code = m.codigo.trim().toUpperCase();
            if (seenMoves.has(code)) {
              duplicateMovesCount++;
            } else {
              seenMoves.add(code);
              uniqueMoves.push(m);
            }
          });

          setImportedMoves(uniqueMoves);
          setMovesFileName(file.name);
          setMovesFileError('');
          checkMovesFileUnregisteredCodes(uniqueMoves);
          
          triggerToast(`📥 Relatório de Movimentações HTML carregado: ${uniqueMoves.length} itens importados — ${duplicateMovesCount} duplicatas ignoradas`);
        } catch (err: any) {
          setMovesFileError(`Erro ao ler arquivo de movimentações HTML: ${err.message || err}`);
        }
      };
      reader.onerror = () => setMovesFileError('Erro ao ler arquivo.');
      reader.readAsText(file);
    }
  };

  // Helper to check manual codes and start registration queue
  const checkUnregisteredCodes = (sourceText: string) => {
    const codes = sourceText
      .split(/[\n,;]+/)
      .map(c => c.trim().toUpperCase())
      .filter(c => c !== '');
      
    if (codes.length === 0) return;
    
    const baseList = importedItems.length > 0 && useImportedBaseline ? importedItems : DEFAULT_CMPC_CATALOG;
    const validSet = new Set([...baseList, ...customItems].map(item => item.codigo.toUpperCase()));
    
    const invalid = codes.filter(code => !validSet.has(code));
    if (invalid.length > 0) {
      setUnregisteredCodesQueue(invalid);
      setManualRegCode(invalid[0]);
      setManualRegDesc('');
      setManualRegValueUnitario('');
      const defaultGrp = (importedItems.length > 0 && useImportedBaseline) 
        ? (importedItems[0]?.grupo || 'Grupo Geral') 
        : 'Grupo Geral';
      setManualRegClass(defaultGrp);
      setShowCustomClassInput(false);
      setManualRegCustomClass('');
      setIsManualRegModalOpen(true);
    }
  };

  // Helper to check moves file and registration queue
  const checkMovesFileUnregisteredCodes = (moves: any[]) => {
    if (!newInvDataInicio || !newInvDataFim) return;
    const targetStart = new Date(newInvDataInicio + 'T00:00:00');
    const targetEnd = new Date(newInvDataFim + 'T23:59:59');
    
    const cellDateHelper = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      const clean = dateStr.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
        return new Date(clean.slice(0, 10));
      }
      const matchBr = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (matchBr) {
        let d = parseInt(matchBr[1], 10);
        let m = parseInt(matchBr[2], 10) - 1;
        let y = parseInt(matchBr[3], 10);
        if (y < 100) y += 2000;
        return new Date(y, m, d);
      }
      const p = Date.parse(clean);
      return isNaN(p) ? null : new Date(p);
    };

    const inRangeMoves = moves.filter(m => {
      const cellD = cellDateHelper(m.dataMov);
      return cellD && cellD >= targetStart && cellD <= targetEnd;
    });

    const uniqueInPeriodCodes = Array.from(new Set(inRangeMoves.map(m => m.codigo.trim().toUpperCase())));
    
    const baseList = importedItems.length > 0 && useImportedBaseline ? importedItems : DEFAULT_CMPC_CATALOG;
    const validSet = new Set([...baseList, ...customItems].map(item => item.codigo.toUpperCase()));
    
    const invalid = uniqueInPeriodCodes.filter(code => !validSet.has(code));
    if (invalid.length > 0) {
      setUnregisteredCodesQueue(invalid);
      setManualRegCode(invalid[0]);
      setManualRegDesc('');
      setManualRegValueUnitario('');
      const defaultGrp = (importedItems.length > 0 && useImportedBaseline) 
        ? (importedItems[0]?.grupo || 'Grupo Geral') 
        : 'Grupo Geral';
      setManualRegClass(defaultGrp);
      setShowCustomClassInput(false);
      setManualRegCustomClass('');
      setIsManualRegModalOpen(true);
    }
  };

  // Submit and confirm manual unregistered item
  const handleConfirmManualRegistration = async () => {
    const finalGroup = showCustomClassInput ? manualRegCustomClass.trim() : manualRegClass;
    const itemDesc = manualRegDesc.trim().toUpperCase();
    const itemUnit = manualRegUnit;
    const itemValue = Number(manualRegValueUnitario) || 0;
    
    if (selectedInventory) {
      // 1. ACTIVE ONGOING INVENTORY CONTEXT
      setCreationLoading(true);
      try {
        const alreadyExists = inventoryItems.some(i => i.codigo.trim().toUpperCase() === manualRegCode.trim().toUpperCase());
        if (alreadyExists) {
          triggerToast(`✓ Material ${manualRegCode} já consta no inventário ativo (usando existente).`);
        } else {
          const newItemDoc = {
            id: `${selectedInventory.id}_${manualRegCode.trim().toUpperCase()}`,
            inventarioId: selectedInventory.id,
            codigo: manualRegCode,
            descricao: itemDesc,
            unidade: itemUnit,
            valorUnitario: itemValue,
            grupo: finalGroup,
            saldoSistema: 0,
            statusContagem: 'Pendente',
            contagemAtualAtiva: 1,
            resultadoInvestigacao: '',
            planoAcao: '',
            incluidoNoEscopo: true,
            cadastradoManualmente: true
          };
          await registerManualInventoryItem(selectedInventory.id, newItemDoc);
          
          // Update Inventory doc in Firestore with class checking
          const hasFicha = selectedInventory.atribuicoes?.some(attr => attr.grupoId === finalGroup);
          let updatedAssigns = [...(selectedInventory.atribuicoes || [])];
          if (!hasFicha) {
            updatedAssigns.push({
              grupoId: finalGroup,
              almoxarifeId: userProfile.cargo === 'Almoxarife' ? userProfile.pin : '', 
              almoxarifeNome: userProfile.cargo === 'Almoxarife' ? userProfile.nome : 'Não atribuído'
            });
          }
          
          const updatedInv = {
            ...selectedInventory,
            atribuicoes: updatedAssigns,
            totalItens: (selectedInventory.totalItens || 0) + 1
          };
          setSelectedInventory(updatedInv);
          await saveInventoryToSupabase(updatedInv);
          
          triggerToast(`✓ Material ${manualRegCode} registrado com sucesso na ficha ${finalGroup}!`);
        }
      } catch (err: any) {
        console.error('Error adding manual item: ', err);
        alert('Erro ao registrar material no Supabase: ' + (err.message || err));
      } finally {
        setCreationLoading(false);
      }
    } else {
      // 2. FORMULATION WIZARD CONTEXT
      setCustomItems(prev => [
        ...prev,
        {
          codigo: manualRegCode,
          descricao: itemDesc,
          unidade: itemUnit,
          valorUnitario: itemValue,
          grupo: finalGroup,
          saldoSistema: 0,
          cadastradoManualmente: true
        }
      ]);
      triggerToast(`✓ Material ${manualRegCode} registrado nos itens customizados para a ficha ${finalGroup}.`);
    }
    
    // Dequeue registered item
    const nextQueue = unregisteredCodesQueue.filter(c => c !== manualRegCode);
    setUnregisteredCodesQueue(nextQueue);
    if (nextQueue.length > 0) {
      setManualRegCode(nextQueue[0]);
      setManualRegDesc('');
      setManualRegValueUnitario('');
      const defaultGrp = nextQueue[0].startsWith('UNI') ? 'Uniformes' : nextQueue[0].startsWith('EQU') ? 'Equipamentos e Máquinas' : nextQueue[0].startsWith('MAT') ? 'Acessórios e Conexões' : nextQueue[0].startsWith('OUT') ? 'Consumíveis e EPIs' : 'Grupo Geral';
      setManualRegClass(defaultGrp);
      setShowCustomClassInput(false);
      setManualRegCustomClass('');
    } else {
      setIsManualRegModalOpen(false);
    }
  };

  const handleFileImport = (file: File) => {
    if (!file) return;
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isHtml = file.name.endsWith('.html') || file.name.endsWith('.htm');

    if (!isExcel && !isHtml) {
      alert('Selecione apenas arquivos (.html, .htm, .xlsx, .xls) de estoque.');
      return;
    }

    const reader = new FileReader();
    if (isExcel) {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const items = parseExcelStockFile(data);
        if (items.length === 0) {
          alert('Nenhum item do estoque foi identificado na planilha Excel.');
          return;
        }

        const seenCodes = new Set<string>();
        const uniqueItems: typeof items = [];
        let duplicatesCount = 0;
        items.forEach(item => {
          const code = item.codigo.trim().toUpperCase();
          if (seenCodes.has(code)) {
            duplicatesCount++;
          } else {
            seenCodes.add(code);
            uniqueItems.push(item);
          }
        });

        // Alphabetical sort by description
        uniqueItems.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));

        setImportedItems(uniqueItems);
        setImportedFileName(file.name);
        setUseImportedBaseline(true);
        triggerToast(`📥 Relatório de Estoque Excel carregado: ${uniqueItems.length} itens importados — ${duplicatesCount} duplicatas ignoradas`);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const items = parseHtmlStockFile(text);
        if (items.length === 0) {
          alert('Nenhum item do estoque foi identificado no relatório HTML.');
          return;
        }

        const seenCodes = new Set<string>();
        const uniqueItems: typeof items = [];
        let duplicatesCount = 0;
        items.forEach(item => {
          const code = item.codigo.trim().toUpperCase();
          if (seenCodes.has(code)) {
            duplicatesCount++;
          } else {
            seenCodes.add(code);
            uniqueItems.push(item);
          }
        });

        // Alphabetical sort by description
        uniqueItems.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));

        setImportedItems(uniqueItems);
        setImportedFileName(file.name);
        setUseImportedBaseline(true);
        triggerToast(`📥 Relatório de Estoque HTML carregado: ${uniqueItems.length} itens importados — ${duplicatesCount} duplicatas ignoradas`);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileImport(files[0]);
    }
  };

  // Operators active counters state
  const [liveActiveConferentes, setLiveActiveConferentes] = useState<{ nome: string; cargo: string; ultimoItem: string; timestamp: Date }[]>([]);

  // Closure Form state
  const [closingName, setClosingName] = useState('');
  const [closingCargo, setClosingCargo] = useState('');
  const [closingDate, setClosingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSigning, setIsSigning] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Auto notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('inventarios')
        .select('*')
        .neq('id', 'global_config');

      if (error) throw error;

      if (data) {
        const loadedInventories: Inventory[] = [];

        data.forEach((row: any) => {
          if (row.payload) {
            loadedInventories.push(row.payload as Inventory);
          }
        });

        loadedInventories.sort((a, b) => {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        setInventories(loadedInventories);
        localStorage.setItem('cmpc_inventarios_cache', JSON.stringify(loadedInventories));

        setSelectedInventory(prevSelected => {
          if (prevSelected) {
            const freshSelected = loadedInventories.find(i => i.id === prevSelected.id);
            if (freshSelected) {
              return freshSelected;
            }
          }
          return prevSelected;
        });
      }
    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
      try {
        const cachedInv = localStorage.getItem('cmpc_inventarios_cache');
        if (cachedInv) setInventories(JSON.parse(cachedInv));
      } catch (cacheErr) {
        console.error('Error loading caches:', cacheErr);
      }
    }
  }, []);

  // Sync derived counts
  useEffect(() => {
    const list = inventories.flatMap(inv => inv.contagens || []);
    setAllCounts(list);
    try {
      localStorage.setItem('cmpc_contagens_cache', JSON.stringify(list));
    } catch (e) {
      console.error('Error saving contagens cache:', e);
    }
  }, [inventories]);

  // 1. Periodic polling to keep state updated from Supabase
  useEffect(() => {
    try {
      const cachedInv = localStorage.getItem('cmpc_inventarios_cache');
      const cachedUsers = localStorage.getItem('cmpc_usuarios_cache');
      if (cachedInv) setInventories(JSON.parse(cachedInv));
      if (cachedUsers) setUsuarios(JSON.parse(cachedUsers));
    } catch (e) {
      console.error('Error loading initial caches:', e);
    }

    fetchData();
  }, []);

  // 2. Load inventory items on active selection
  useEffect(() => {
    setOptimisticCounted({});
    if (!selectedInventory) {
      setInventoryItems([]);
      setPostConclusionEdits([]);
      setReassignLogs([]);
      setReopenLogs([]);
      return;
    }

    const items = selectedInventory.itens || [];
    // Sort alphabetically by item description
    const sortedItems = [...items].sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));

    setInventoryItems(sortedItems);
    setPostConclusionEdits(selectedInventory.edicoes_pos_conclusao || []);
    setReassignLogs(selectedInventory.alteracoes_responsavel || []);
    setReopenLogs(selectedInventory.reaberturas_autorizadas || []);
  }, [selectedInventory]);

  // Carregamento e Bloqueio de Recálculo: se o inventário estiver com status CONCLUÍDO / Encerrado,
  // busca o snapshot estático imutável na tabela inventario_consolidacao_final
  useEffect(() => {
    const fetchConsolidatedSnapshot = async () => {
      if (!selectedInventory) {
        setConsolidatedSnapshot(null);
        return;
      }

      const st = (selectedInventory.status || '').toUpperCase();
      const isConcluido = st === 'ENCERRADO' || st === 'CONCLUÍDO' || st === 'CONCLUIDO' || st === 'FINALIZADO';

      if (isConcluido) {
        const invRef = selectedInventory.id || selectedInventory.referencia;
        try {
          const { data, error } = await supabase
            .from('inventario_consolidacao_final')
            .select('dados_consolidados')
            .eq('inventario_ref', invRef)
            .maybeSingle();

          if (!error && data?.dados_consolidados && Array.isArray(data.dados_consolidados)) {
            setConsolidatedSnapshot(data.dados_consolidados);
          } else {
            setConsolidatedSnapshot(null);
          }
        } catch (err) {
          console.error('Erro ao buscar snapshot de consolidação final:', err);
          setConsolidatedSnapshot(null);
        }
      } else {
        setConsolidatedSnapshot(null);
      }
    };

    fetchConsolidatedSnapshot();
  }, [selectedInventory?.id, selectedInventory?.status]);

  // 1. Busca de Dados no Supabase para a Tela de Revisão de Fichas (Controladoria)
  useEffect(() => {
    const carregarContagens = async () => {
      const invRef = selectedInventory?.referencia || selectedInventory?.id;
      if (!invRef) return;
      const { data, error } = await supabase
        .from('inventario_contagens')
        .select('*')
        .eq('inventario_ref', invRef);
      
      if (!error && data) {
        setContagensRealizadas(data);
      }
    };
    if (selectedInventory?.id || selectedInventory?.referencia) {
      carregarContagens();
    }
  }, [selectedInventory?.id, selectedInventory?.referencia, selectedReviewGroup, currentTab]);

  // Resgate e Inicialização de Dados da tabela 'inventario_contagens'
  useEffect(() => {
    if (!selectedInventory || !selectedFichaGroup) return;

    const fetchFichaContagens = async () => {
      try {
        const inventarioRef = selectedInventory.referencia || selectedInventory.id;
        const { data, error } = await supabase
          .from('inventario_contagens')
          .select('*')
          .eq('inventario_ref', inventarioRef)
          .eq('ficha_grupo', selectedFichaGroup);

        if (error) {
          console.error('Erro ao buscar inventario_contagens do Supabase:', error);
          return;
        }

        if (data && data.length > 0) {
          const fetchedOptimistic: { [itemId: string]: number } = {};
          const fetchedQuantities: { [itemId: string]: string } = {};

          data.forEach((row: any) => {
            const matchedItem = (inventoryItems.length > 0 ? inventoryItems : selectedInventory.itens || []).find(
              (it: InventoryItem) => (it.codigo === row.codigo_item || it.id === row.codigo_item)
            );

            if (matchedItem) {
              fetchedOptimistic[matchedItem.id] = Number(row.quantidade);
              fetchedQuantities[matchedItem.id] = String(row.quantidade);
            }
          });

          if (Object.keys(fetchedOptimistic).length > 0) {
            setOptimisticCounted(prev => ({ ...prev, ...fetchedOptimistic }));
            setActiveQuantities(prev => ({ ...fetchedQuantities, ...prev }));
          }
        }
      } catch (err) {
        console.error('Erro ao carregar contagens salvas:', err);
      }
    };

    fetchFichaContagens();
  }, [selectedInventory?.id, selectedInventory?.referencia, selectedFichaGroup, inventoryItems]);

  // 1. Supabase Realtime Subscription para Monitoramento e Atribuições (Coordenador & Agente)
  useEffect(() => {
    const channelFichas = supabase
      .channel('mudancas-fichas-agente')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'inventarios',
        },
        (payload) => {
          console.log("🔄 Ficha/Inventário alterado em tempo real!", payload);
          fetchData(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelFichas);
    };
  }, [fetchData]);

  // 1.1 Supabase Realtime Subscription para Progresso de Contagens (Admin)
  useEffect(() => {
    if (!selectedInventory) return;
    const invRef = selectedInventory.referencia || selectedInventory.id;

    const channelProgresso = supabase
      .channel(`mudancas-progresso-admin-${invRef}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventario_contagens',
          filter: `inventario_ref=eq.${invRef}`
        },
        (payload) => {
          console.log("📈 Contagem avançou em tempo real!", payload);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelProgresso);
    };
  }, [selectedInventory?.id, selectedInventory?.referencia, fetchData]);

  // 2. Supabase Realtime Subscription para Atualização Instantânea da Ficha de Contagem (Agente)
  useEffect(() => {
    if (!selectedInventory || !selectedFichaGroup) return;
    const invRef = selectedInventory.referencia || selectedInventory.id;

    const subscription = supabase
      .channel(`ficha-contagem-realtime-${invRef}-${selectedFichaGroup}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventario_contagens',
          filter: `inventario_ref=eq.${invRef}`
        },
        (payload) => {
          console.log('[Realtime Agente] Evento recebido na ficha:', payload);
          if (payload.new && (payload.new as any).ficha_grupo === selectedFichaGroup) {
            const row = payload.new as any;
            const matchedItem = (inventoryItems.length > 0 ? inventoryItems : selectedInventory.itens || []).find(
              (it: InventoryItem) => (it.codigo === row.codigo_item || it.id === row.codigo_item)
            );

            if (matchedItem) {
              setOptimisticCounted(prev => ({
                ...prev,
                [matchedItem.id]: Number(row.quantidade)
              }));
              setActiveQuantities(prev => ({
                ...prev,
                [matchedItem.id]: String(row.quantidade)
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedInventory?.id, selectedInventory?.referencia, selectedFichaGroup, inventoryItems]);

  // Check and flag suspicious items with "0 por Pendente"
  useEffect(() => {
    if (!selectedInventory || inventoryItems.length === 0) return;

    const checkSuspiciousItems = async () => {
      for (const item of inventoryItems) {
        // Evaluate if this item has any count of 0 with no operator / Pendente operator
        const isSusp1 = item.contagem1 === 0 && (!item.contador1Nome || item.contador1Nome.trim() === '' || item.contador1Nome === 'Pendente');
        const isSusp2 = item.contagem2 === 0 && (!item.contador2Nome || item.contador2Nome.trim() === '' || item.contador2Nome === 'Pendente');
        const isSusp3 = item.contagem3 === 0 && (!item.contador3Nome || item.contador3Nome.trim() === '' || item.contador3Nome === 'Pendente');
        const isSuspFinal = item.contagemFinal === 0 && (!item.contadorFinal1Nome || item.contadorFinal1Nome.trim() === '' || item.contadorFinal1Nome === 'Pendente');

        if ((isSusp1 || isSusp2 || isSusp3 || isSuspFinal) && !item.suspeito) {
          try {
            await updateSingleInventoryItem(item.id, { suspeito: true });
            console.log(`[CMPC SGI] Item ${item.codigo} marcado como suspeito devido a contagem automática/vazia detectada.`);
          } catch (e) {
            console.error(e);
          }
        }
      }
    };

    checkSuspiciousItems();
  }, [inventoryItems, selectedInventory]);

  // Handle Toast Notifications
  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const toast = {
    success: (msg: string) => triggerToast(msg, 'success'),
    error: (msg: string) => triggerToast(msg, 'error')
  };

  // ============================================================================
  // CARREGAMENTO DOS MODELOS NEURAIS FACE-API.JS
  // ============================================================================
  useEffect(() => {
    if (userProfile) return;

    let isMounted = true;
    const carregarModelos = async () => {
      setIsLoadingModels(true);
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        if (isMounted) {
          setModelsLoaded(true);
          setIsLoadingModels(false);
        }
      } catch (err: any) {
        console.error('[InventoryPortal] Erro ao carregar modelos neurais face-api:', err);
        if (isMounted) {
          setBiometricError('Falha ao carregar modelos de inteligência visual facial.');
          setIsLoadingModels(false);
        }
      }
    };

    carregarModelos();
    return () => {
      isMounted = false;
    };
  }, [userProfile]);

  // ============================================================================
  // CARREGAMENTO DOS DESCRITORES FACIAIS DO SUPABASE (TABELA USUARIOS COM VÍNCULO)
  // ============================================================================
  const carregarBaseBiometrica = useCallback(async () => {
    setLoadingUsers(true);
    setBiometricError(null);
    try {
      const { data: baseRostos, error } = await supabase
        .from('usuarios')
        .select('id, nome, face_descriptor, id_biometria_vinculada')
        .not('face_descriptor', 'is', null)
        .not('id_biometria_vinculada', 'is', null);

      if (error) {
        console.warn('[InventoryPortal] Erro ao carregar base de usuarios:', error);
        throw error;
      }

      if (!baseRostos || baseRostos.length === 0) {
        console.warn("Nenhum usuário com biometria vinculada foi encontrado.");
        setUsersWithBio([]);
        setFacesCadastradas(0);
        setFaceMatcher(null);
        setLoadingUsers(false);
        return;
      }

      const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];
      const formattedUsers: any[] = [];

      baseRostos.forEach((user: any) => {
        try {
          const rawDescriptor = user.face_descriptor;
          if (!rawDescriptor) return;

          let descriptorData = typeof rawDescriptor === 'string'
            ? JSON.parse(rawDescriptor)
            : rawDescriptor;

          let cleanValues: number[] = [];
          if (descriptorData && typeof descriptorData === 'object' && !Array.isArray(descriptorData)) {
            cleanValues = Object.values(descriptorData).map(Number);
          } else if (Array.isArray(descriptorData)) {
            cleanValues = descriptorData.map(Number);
          }

          if (cleanValues.length > 0) {
            const float32Array = new Float32Array(cleanValues);
            const labelData = JSON.stringify({ 
              nome: user.nome || 'Colaborador', 
              idAcesso: user.id_biometria_vinculada 
            });

            labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(labelData, [float32Array]));
            formattedUsers.push({
              id: user.id,
              nome: user.nome,
              idAcesso: user.id_biometria_vinculada,
              face_descriptor: cleanValues,
              parsedDescriptor: float32Array
            });
          }
        } catch (convErr) {
          console.error('[InventoryPortal] Erro ao converter descritor de:', user.nome, convErr);
        }
      });

      if (labeledDescriptors.length > 0) {
        const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        setFaceMatcher(matcher);
      } else {
        setFaceMatcher(null);
      }

      setFacesCadastradas(baseRostos.length);
      setUsersWithBio(formattedUsers);
      setLoadingUsers(false);
    } catch (err: any) {
      console.error("Erro ao carregar base biométrica:", err);
      setLoadingUsers(false);
      setBiometricError('Erro ao consultar banco de dados biométrico.');
    }
  }, []);

  // Dispara busca inicial na montagem
  useEffect(() => {
    if (!userProfile) {
      carregarBaseBiometrica();
    }
  }, [userProfile, carregarBaseBiometrica]);

  // ============================================================================
  // CONTROLE DO FLUXO DA WEBCAM (PADRÃO ONBOARDING)
  // ============================================================================
  const stopBioCamera = useCallback(() => {
    if (bioAnimFrameRef.current) {
      cancelAnimationFrame(bioAnimFrameRef.current);
      bioAnimFrameRef.current = null;
    }
    if (bioStreamRef.current) {
      bioStreamRef.current.getTracks().forEach(t => t.stop());
      bioStreamRef.current = null;
    }
    if (bioVideoRef.current) {
      bioVideoRef.current.srcObject = null;
    }
    setIsBioCameraActive(false);
    setDetectedFacesCount(0);
  }, []);

  const startBioCamera = useCallback(async () => {
    setBioCameraError(null);
    setBiometricError(null);
    setIsAlive(false);
    setCurrentYawRatio(1.0);

    // ORDEM 2: Garante a execução da busca biométrica antes ou durante a ativação da câmera
    carregarBaseBiometrica();

    try {
      if (bioStreamRef.current) {
        bioStreamRef.current.getTracks().forEach(t => t.stop());
        bioStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      bioStreamRef.current = stream;

      if (bioVideoRef.current) {
        bioVideoRef.current.srcObject = stream;
        await bioVideoRef.current.play();
        setIsBioCameraActive(true);
      }
    } catch (err: any) {
      console.error('[InventoryPortal] Erro ao acessar webcam:', err);
      let msg = 'Erro ao inicializar a câmera. Verifique as permissões do navegador.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permissão de acesso à câmera negada. Habilite a câmera nas configurações do navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Nenhuma câmera de vídeo foi detectada no dispositivo.';
      }
      setBioCameraError(msg);
      setIsBioCameraActive(false);
    }
  }, [carregarBaseBiometrica]);

  // Inicialização automática da câmera ao carregar os modelos e não estar autenticado
  useEffect(() => {
    if (!biometriaInventarioValidada && modelsLoaded && !isBioCameraActive && !bioCameraError && !usuarioReconhecido && !usarSenha) {
      startBioCamera();
    }
  }, [biometriaInventarioValidada, modelsLoaded, isBioCameraActive, bioCameraError, usuarioReconhecido, startBioCamera, usarSenha]);

  // ORDEM 3: GARANTIR O RESET DA TRAVA AO DESMONTAR O COMPONENTE
  useEffect(() => {
    return () => {
      setBiometriaInventarioValidada(false);
      setAgenteContagem(null);
      setUserProfile(null);
      stopBioCamera();
    };
  }, [stopBioCamera]);

  // ============================================================================
  // REGRAS DE RBAC AO RECONHECER FACIALMENTE (ORDEM 4)
  // ============================================================================
  const handleReconhecimentoSucesso = useCallback(async (dadosUsuario: any) => {
    let finalUser = dadosUsuario;
    if (dadosUsuario.idAcesso) {
      try {
        const { data: dadosAcesso } = await supabase
          .from('usuarios_permissoes')
          .select('*')
          .eq('id', dadosUsuario.idAcesso)
          .single();
        if (dadosAcesso) {
          finalUser = { ...dadosUsuario, ...dadosAcesso };
        }
      } catch (err) {
        console.warn('Erro ao carregar permissoes adicionais:', err);
      }
    }
    setUsuarioReconhecido(finalUser);
    
    // Regras de negócio solicitadas pelo cliente:
    const perfilStr = (finalUser.perfil || '').toUpperCase().trim();
    if (perfilStr === 'ADMINISTRADOR' || perfilStr === 'ADMIN' || perfilStr === 'ADMIN MASTER') {
      setCargosPermitidos(['AGENTE_CONTAGEM', 'AGENTE_CONTROLADORIA']);
      setCargoSelecionado('AGENTE_CONTAGEM');
    } else if (
      perfilStr === 'ALMOXARIFADO' || 
      perfilStr === 'ALMOXARIFADO (PADRÃO)' || 
      perfilStr === 'ALMOXARIFE' || 
      perfilStr === 'RH'
    ) {
      setCargosPermitidos(['AGENTE_CONTAGEM']);
      setCargoSelecionado('AGENTE_CONTAGEM');
    } else {
      setCargosPermitidos([]); // Sem acesso
      setCargoSelecionado('');
    }
  }, []);

  // Reiniciar Scanner para outro colaborador
  const handleReiniciarScanner = useCallback(() => {
    setUsuarioReconhecido(null);
    setCargosPermitidos([]);
    setCargoSelecionado('');
    setIsAlive(false);
    setCurrentYawRatio(1.0);
    setUsarSenha(false);
    startBioCamera();
  }, [startBioCamera]);

  // ============================================================================
  // ORDEM 2: LÓGICA DE AUTENTICAÇÃO TRADICIONAL (FALLBACK E-MAIL E SENHA)
  // ============================================================================
  const handleLoginPorSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSenha(true);

    try {
      // 1. Valida a senha usando o Auth nativo do Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: credenciais.email.trim(),
        password: credenciais.senha,
      });

      if (authError) throw authError;

      // 2. Busca as permissões do usuário logado na tabela RBAC
      let dadosAcesso: any = null;
      const { data: directAcesso } = await supabase
        .from('usuarios_permissoes')
        .select('*')
        .eq('email', credenciais.email.trim())
        .maybeSingle();

      if (directAcesso) {
        dadosAcesso = directAcesso;
      } else {
        const { data: fallbackAcesso } = await supabase
          .from('usuarios_permissoes')
          .select('*')
          .ilike('email', credenciais.email.trim())
          .maybeSingle();

        if (fallbackAcesso) {
          dadosAcesso = fallbackAcesso;
        } else if (authData?.user?.id) {
          const { data: byId } = await supabase
            .from('usuarios_permissoes')
            .select('*')
            .or(`user_id.eq.${authData.user.id},id.eq.${authData.user.id}`)
            .maybeSingle();
          if (byId) dadosAcesso = byId;
        }
      }

      if (!dadosAcesso) throw new Error("Usuário não encontrado na base de permissões.");

      // 3. Sucesso! Chama o callback que avança a tela (a mesma que a biometria usa)
      // Passamos os dados de acesso para ele renderizar a tela de "Agente de Contagem / Controladoria"
      await handleReconhecimentoSucesso({
        idAcesso: dadosAcesso.id,
        id: dadosAcesso.id,
        nome: dadosAcesso.nome,
        perfil: dadosAcesso.perfil,
        email: dadosAcesso.email,
        usuario: dadosAcesso.usuario || dadosAcesso.email,
        ...dadosAcesso
      });

      setUsarSenha(false);

    } catch (err: any) {
      alert("Erro ao entrar: E-mail ou senha incorretos.");
      console.error(err);
    } finally {
      setLoadingSenha(false);
    }
  };

  // ============================================================================
  // LOOP DE RECONHECIMENTO FACIAL AO VIVO + PROVA DE VIDA (HEAD YAW ESTIMATION & MATCHER 0.6)
  // ============================================================================
  useEffect(() => {
    if (userProfile || !isBioCameraActive || !modelsLoaded || usuarioReconhecido) {
      return;
    }

    let isRunning = true;

    const detectAndMatch = async () => {
      if (!isRunning || !bioVideoRef.current || !bioCanvasRef.current) return;

      const video = bioVideoRef.current;
      const canvas = bioCanvasRef.current;

      if (video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
        bioAnimFrameRef.current = requestAnimationFrame(detectAndMatch);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bioAnimFrameRef.current = requestAnimationFrame(detectAndMatch);
        return;
      }

      try {
        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5
        });

        const detection = await faceapi
          .detectSingleFace(video, options)
          .withFaceLandmarks()
          .withFaceDescriptor();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          setDetectedFacesCount(1);
          const box = detection.detection.box;

          // Cálculo de Yaw Ratio para Prova de Vida (Anti-Spoofing por Rotação Lateral da Cabeça)
          if (detection.landmarks) {
            const leftEye = detection.landmarks.getLeftEye();
            const rightEye = detection.landmarks.getRightEye();
            const nose = detection.landmarks.getNose();

            // Captura os eixos X dos pontos extremos
            const leftEyeCornerX = leftEye[0].x; 
            const rightEyeCornerX = rightEye[3].x; 
            const noseTipX = nose[3].x; 

            // Calcula a distância horizontal da ponta do nariz para cada olho
            const distLeft = Math.abs(noseTipX - leftEyeCornerX);
            const distRight = Math.abs(rightEyeCornerX - noseTipX);

            // Calcula a razão de rotação (Yaw Ratio)
            const yawRatio = distRight > 0 ? distLeft / distRight : 1.0;
            setCurrentYawRatio(Number(yawRatio.toFixed(2)));

            // LÓGICA ANTI-SPOOFING: Se o rosto estiver perfeitamente de frente, a razão é ~1.0.
            // Se virar para a direita ou esquerda, a razão dispara para cima de 1.6 ou cai para menos de 0.6.
            if (yawRatio > 1.6 || yawRatio < 0.6) {
              setIsAlive(true);
              // Prova de vida confirmada! Permite que o FaceMatcher prossiga
            }
          }

          // Busca Biometria com FaceMatcher (Tolerância 0.6)
          let bestMatchUser: any = null;
          let matchDistance = 1.0;

          if (faceMatcher && detection.descriptor) {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            if (bestMatch && bestMatch.label !== 'unknown' && bestMatch.distance <= 0.6) {
              try {
                const parsed = JSON.parse(bestMatch.label);
                bestMatchUser = parsed;
                matchDistance = bestMatch.distance;
              } catch {
                const found = usersWithBio.find(
                  u => u.nome === bestMatch.label || String(u.id) === bestMatch.label
                );
                if (found) {
                  bestMatchUser = found;
                  matchDistance = bestMatch.distance;
                }
              }
            }
          }

          // Fallback por distância euclidiana direta
          if (!bestMatchUser && usersWithBio.length > 0 && detection.descriptor) {
            for (const u of usersWithBio) {
              const targetDesc = u.parsedDescriptor || (u.face_descriptor ? new Float32Array(u.face_descriptor) : null);
              if (targetDesc) {
                const dist = faceapi.euclideanDistance(detection.descriptor, targetDesc);
                if (dist <= 0.6 && dist < matchDistance) {
                  bestMatchUser = u;
                  matchDistance = dist;
                }
              }
            }
          }

          if (bestMatchUser && matchDistance <= 0.6) {
            const confidence = Math.round(Math.max(0, (1 - matchDistance)) * 100);

            // Caixa verde / ciano
            ctx.strokeStyle = isAlive ? '#10b981' : '#38bdf8';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            const label = `Identificado: ${bestMatchUser.nome} (${confidence}%)`;
            ctx.fillStyle = isAlive ? '#10b981' : '#0284c7';
            ctx.fillRect(box.x, Math.max(0, box.y - 24), ctx.measureText(label).width + 16, 22);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillText(label, box.x + 8, Math.max(15, box.y - 8));

            // Reconhecimento validado com sucesso!
            if (isAlive) {
              const matchedUser = {
                id: bestMatchUser.id,
                nome: bestMatchUser.nome,
                idAcesso: bestMatchUser.idAcesso || bestMatchUser.id_biometria_vinculada || bestMatchUser.id,
                cargo: bestMatchUser.cargo || 'Almoxarife',
                perfil: bestMatchUser.perfil || 'ALMOXARIFADO',
                email: bestMatchUser.email || '',
                pin: bestMatchUser.pin,
                confidence: confidence,
                distance: Number(matchDistance.toFixed(3))
              };

              handleReconhecimentoSucesso(matchedUser);
              return;
            }
          } else {
            // Caixa amarela não identificado
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            const label = 'Rosto não cadastrado';
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(box.x, Math.max(0, box.y - 24), ctx.measureText(label).width + 16, 22);
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillText(label, box.x + 8, Math.max(15, box.y - 8));
          }
        } else {
          setDetectedFacesCount(0);
        }
      } catch (loopErr) {
        console.error('Erro no loop de detecção facial:', loopErr);
      }

      if (isRunning) {
        bioAnimFrameRef.current = requestAnimationFrame(detectAndMatch);
      }
    };

    bioAnimFrameRef.current = requestAnimationFrame(detectAndMatch);

    return () => {
      isRunning = false;
      if (bioAnimFrameRef.current) {
        cancelAnimationFrame(bioAnimFrameRef.current);
        bioAnimFrameRef.current = null;
      }
    };
  }, [userProfile, isBioCameraActive, modelsLoaded, usuarioReconhecido, faceMatcher, usersWithBio, isAlive, handleReconhecimentoSucesso]);

  // ============================================================================
  // ORDEM 3: AUTENTICAÇÃO COM CHAVE DE RASTREABILIDADE (HASH / AUDITORIA)
  // ============================================================================
  const handleAutenticar = (cargo: string) => {
    if (!usuarioReconhecido || !cargosPermitidos.includes(cargo)) return;

    // Cria uma chave de sessão simples combinando ID, cargo e timestamp
    const auditKey = btoa(`${usuarioReconhecido.id}-${cargo}-${Date.now()}`);

    // Salva no contexto global ou Storage para ser enviado em cada bip de material
    sessionStorage.setItem('inventory_audit_key', auditKey);
    sessionStorage.setItem('inventory_active_user', JSON.stringify(usuarioReconhecido));

    const finalCargoDisplay = cargo === 'AGENTE_CONTROLADORIA' ? 'Coordenador' : 'Almoxarife';
    const finalProfile: UserProfile = {
      id: usuarioReconhecido.id,
      nome: usuarioReconhecido.nome,
      usuario: usuarioReconhecido.usuario || usuarioReconhecido.email || `agente.${usuarioReconhecido.id}`,
      cargo: finalCargoDisplay,
      pin: String(usuarioReconhecido.pin || usuarioReconhecido.id),
      perfil: usuarioReconhecido.perfil,
      auditKey: auditKey
    };

    setAgenteContagem(usuarioReconhecido);
    setBiometriaInventarioValidada(true);
    setUserProfile(finalProfile);
    localStorage.setItem('cmpc_pin_user_profile', JSON.stringify(finalProfile));

    stopBioCamera();

    logHubEvent({
      type: 'session_start',
      destino: `Portal de Inventários - Biometria Facial [${cargo}]`,
      url: `/inventario/biometria/${cargo}`,
      nomeCompleto: usuarioReconhecido.nome,
      nomeUsuario: finalProfile.usuario,
      pin: finalProfile.pin
    });

    triggerToast(`Sessão Biométrica Ativa: Bem-vindo, ${usuarioReconhecido.nome}!`);
  };

  // Profile Login handle (Legado/Compatibilidade)
  const handleProfileLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const pinDigitado = authPin.trim();

    if (!pinDigitado) {
      const msg = 'Por favor, informe seu PIN de acesso.';
      setAuthError(msg);
      triggerToast(msg, 'error');
      return;
    }

    try {
      // Busca oficial na tabela usuarios_pins do Supabase
      const { data, error } = await supabase
        .from('usuarios_pins')
        .select('*')
        .eq('pin', pinDigitado)
        .single();

      if (error || !data) {
        console.error('PIN não localizado em usuarios_pins:', error);

        // Backup de PINs master/emergência caso a tabela ainda não possua o registro master
        const hardcodedAdmins: Record<string, { nome: string; usuario: string; cargo: string }> = {
          '04632076376': { nome: 'André Ramalho - Administrador Geral', usuario: 'ramalho.andre', cargo: 'Coordenador' },
          '300623': { nome: 'Equipe de Almoxarifado Principal', usuario: 'almox.principal', cargo: 'Almoxarife' },
          '00410482021': { nome: 'Planejamento e Fiscalização CMPC Industrial', usuario: 'planejamento.cmpc', cargo: 'Coordenador' },
          '1903': { nome: 'Controle de Auditoria Externa SGI', usuario: 'auditoria.sgi', cargo: 'Auditor' }
        };

        const backup = hardcodedAdmins[pinDigitado];
        if (!backup) {
          const errMsg = 'PIN de Acesso incorreto ou não cadastrado no sistema.';
          setAuthError(errMsg);
          triggerToast(errMsg, 'error');
          return;
        }

        const profile: UserProfile = {
          nome: backup.nome,
          usuario: backup.usuario,
          cargo: authCargo || (backup.cargo as any),
          pin: pinDigitado
        };

        setUserProfile(profile);
        localStorage.setItem('cmpc_pin_user_profile', JSON.stringify(profile));
        triggerToast(`Sessão ativa: Bem-vindo, ${profile.nome}!`);
        return;
      }

      // Agente/Usuário localizado com sucesso na tabela usuarios_pins
      const finalNome = data.nome_completo || data.nome || 'Agente';
      const finalUsuario = data.nome_usuario || data.usuario || `agente.${pinDigitado}`;
      const finalCargo = data.cargo || authCargo || 'Almoxarife';

      const profile: UserProfile = {
        nome: finalNome,
        usuario: finalUsuario,
        cargo: finalCargo,
        pin: pinDigitado
      };

      setUserProfile(profile);
      localStorage.setItem('cmpc_pin_user_profile', JSON.stringify(profile));

      logHubEvent({
        type: 'session_start',
        destino: `Portal de Inventários - Perfil ${profile.cargo}`,
        url: `/inventario/login/${profile.cargo}`,
        nomeCompleto: profile.nome,
        nomeUsuario: profile.usuario,
        pin: profile.pin
      });

      triggerToast(`Sessão ativa: Bem-vindo, ${finalNome}!`);
    } catch (err: any) {
      console.error('Erro na validação do PIN via Supabase:', err);
      const errMsg = 'Erro na validação de credencial PIN.';
      setAuthError(errMsg);
      triggerToast(errMsg, 'error');
    }
  };

  // Handler para configurar o PIN próprio no primeiro acesso
  const handleSetupFirstAccessPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFirstAccessError('');

    if (!firstAccessUser) return;

    const newPin = firstAccessNewPin.trim();
    const confirmPin = firstAccessConfirmPin.trim();

    if (newPin.length < 6) {
      setFirstAccessError('O novo PIN deve ter no mínimo 6 dígitos (apenas números).');
      return;
    }

    if (newPin !== confirmPin) {
      setFirstAccessError('A confirmação do PIN não confere.');
      return;
    }

    if (newPin === '1234') {
      setFirstAccessError('O novo PIN não pode ser igual ao PIN temporário 1234.');
      return;
    }

    try {
      // 1. Definição do novo PIN e primeiroAcesso: false localmente e logado
      try {
        await logHubEvent({
          type: 'first_access_pin_defined',
          itemName: 'Definição de PIN Próprio',
          valAnterior: '1234 (temporário)',
          valNovo: 'Definido',
          usuario: firstAccessUser.usuario,
          pin: newPin,
          nomeCompleto: firstAccessUser.nome,
          nomeUsuario: firstAccessUser.usuario
        });
      } catch (e) {}

      // 2. Entrar automaticamente no portal a partir de agora
      const profile: UserProfile = {
        nome: firstAccessUser.nome,
        usuario: firstAccessUser.usuario,
        cargo: firstAccessUser.cargo,
        pin: newPin
      };

      // Gravar usuário na tabela de usuários ativos
      const nextUser = {
        id: newPin,
        nome: firstAccessUser.nome,
        usuario: firstAccessUser.usuario,
        pin: newPin,
        cargo: firstAccessUser.cargo,
        timestamp: new Date().toISOString()
      };
      const updatedUsers = [...usuarios.filter(u => u.pin !== newPin), nextUser];
      await saveUsersToSupabase(updatedUsers);

      setUserProfile(profile);
      localStorage.setItem('cmpc_pin_user_profile', JSON.stringify(profile));
      setFirstAccessUser(null);
      setFirstAccessNewPin('');
      setFirstAccessConfirmPin('');

      triggerToast(`Novo PIN ativado com sucesso! Bem-vindo, ${profile.nome}!`);
    } catch (err: any) {
      setFirstAccessError(err.message || 'Erro ao salvar seu PIN de acesso próprio.');
    }
  };

  // Profile logout
  const handleLogout = () => {
    localStorage.removeItem('cmpc_pin_user_profile');
    sessionStorage.removeItem('inventory_audit_key');
    sessionStorage.removeItem('inventory_active_user');
    setBiometriaInventarioValidada(false);
    setAgenteContagem(null);
    setUserProfile(null);
    setSelectedInventory(null);
    setUsuarioReconhecido(null);
    setCargosPermitidos([]);
    setCargoSelecionado('');
    setIsAlive(false);
    setCurrentYawRatio(1.0);
  };

  // Add Custom Items to pending inventory creation list
  const handleAddCustomItem = () => {
    if (!customCod.trim() || !customDesc.trim()) {
      alert('Preencha código e descrição do item.');
      return;
    }
    const exists = DEFAULT_CMPC_CATALOG.some(i => i.codigo === customCod.trim()) || 
                   customItems.some(i => i.codigo === customCod.trim());
    if (exists) {
      alert('Código de item já cadastrado.');
      return;
    }

    setCustomItems([
      ...customItems,
      {
        codigo: customCod.trim().toUpperCase(),
        descricao: customDesc.trim(),
        unidade: customUni,
        valorUnitario: Number(customVal) || 0
      }
    ]);
    setCustomCod('');
    setCustomDesc('');
  };

  // Add checklist items automatically
  const toggleCatalogSelect = (codigo: string) => {
    if (selectedCatalogItems.includes(codigo)) {
      setSelectedCatalogItems(selectedCatalogItems.filter(c => c !== codigo));
    } else {
      setSelectedCatalogItems([...selectedCatalogItems, codigo]);
    }
  };

  // Delete Inventory (No PIN verification needed)
  const handleConfirmDeleteInventory = async (inv: Inventory) => {
    try {
      // Delete the inventory row from Supabase
      const { error } = await supabase
        .from('inventarios')
        .delete()
        .eq('id', inv.id);
      
      if (error) {
        throw error;
      }

      // Sync local state
      const updatedInventories = inventories.filter(i => i.id !== inv.id);
      setInventories(updatedInventories);
      try {
        localStorage.setItem('cmpc_inventarios_cache', JSON.stringify(updatedInventories));
      } catch (e) {
        console.error('Error caching inventories:', e);
      }

      // Trigger log
      logHubEvent({
        type: 'inventory_delete',
        destino: `Exclusão de Inventário ID: ${inv.id} (${inv.tipo} - ${inv.data})`,
        url: `/inventario/excluir/${inv.id}`,
        nomeCompleto: userProfile?.nome || 'Operador',
        nomeUsuario: userProfile?.usuario || 'portal.usuario',
        pin: userProfile?.pin || 'N/A'
      });

      // Clear selection if it was the selected one
      if (selectedInventory?.id === inv.id) {
        setSelectedInventory(null);
      }

      triggerToast(`Inventário ${inv.tipo} de ${inv.data} foi excluído permanentemente.`);
      setDeletingInventoryId(null);
      setDeletePinInput('');
      setDeleteError('');
    } catch (err: any) {
      console.error('Error deleting inventory:', err);
      setDeleteError('Erro ao excluir no Supabase. Verifique sua conexão.');
    }
  };

  // Create Inventory on Firestore
  const handleCreateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    if ((newInvTipo === 'Parcial' || newInvTipo === 'Cíclico') && (!newInvDataInicio || !newInvDataFim)) {
      alert('Por favor, informe a Data Inicial e Data Final do período de referência para o inventário.');
      return;
    }

    const itemsToCount = [...plannedItems];

    if (itemsToCount.length === 0) {
      alert('Por favor, selecione, crie ou importe ao menos 1 item para contar.');
      return;
    }

    // Filter list to count only selected in-scope items for progress counting
    const activeInScopeItems = itemsToCount.filter(
      item => newInvTipo !== 'Parcial' || selectedInScopeItems[item.codigo] !== false
    );

    if (activeInScopeItems.length === 0) {
      alert('Por favor, selecione ao menos 1 item com escopo ATIVO para contagem no Inventário Parcial.');
      return;
    }

    setCreationLoading(true);
    try {
      // 1. If creating a general inventory, check and notify about any pending adjustments from previous parciais
      if (newInvTipo === 'Geral') {
        try {
          const pendingItemsList: string[] = [];
          inventories.forEach(inv => {
            if (inv.itens) {
              inv.itens.forEach((item: any) => {
                if (item.statusDivergencia === 'Pendente — Ajustar no próximo inventário geral') {
                  pendingItemsList.push(item.codigo);
                }
              });
            }
          });

          if (pendingItemsList.length > 0) {
            const pendingCount = pendingItemsList.length;
            const pendingDetails = pendingItemsList.join(', ');
            
            // Notify the supplies management automatically
            await logHubEvent({
              type: 'hub_update',
              itemName: 'Notificação SGI: Gerência de Suprimentos Notificada',
              valAnterior: 'Nenhuma pendência recente',
              valNovo: `CMPC-PRO-0093: Identificadas ${pendingCount} divergências pendentes do inventário parcial anterior integradas para ajuste. Materiais: ${pendingDetails}`
            });
            
            triggerToast(`📢 SGI Alerta: Gerência de Suprimentos notificada de ${pendingCount} pendências do inventário parcial.`);
          }
        } catch (error) {
          console.error("Error checking pending partial items: ", error);
        }
      }

      // 2. Save Inventory meta header
      const arrayAtribuicoes = identifiedGroups.map(grp => {
        const assign = groupAssignments[grp.name];
        return {
          grupoId: grp.name,
          almoxarifeId: assign ? assign.almoxarifeId : '',
          almoxarifeNome: assign ? assign.almoxarifeNome : 'Não atribuído'
        };
      });

      const newInvId = generateAutoId();
      const activeInventory: Inventory = {
        id: newInvId,
        tipo: newInvTipo,
        data: new Date().toISOString().split('T')[0],
        responsavel: newInvResponsavel || userProfile.nome,
        status: 'Aberto',
        totalItens: activeInScopeItems.length,
        itensContados: 0,
        progresso: 0,
        createdAt: new Date().toISOString(),
        atribuicoes: arrayAtribuicoes
      };

      if (newInvTipo === 'Parcial' || newInvTipo === 'Cíclico' || newInvTipo === 'Geral' || newInvTipo === 'Eventual') {
        activeInventory.dataInicialPeriodo = newInvDataInicio;
        activeInventory.dataFinalPeriodo = newInvDataFim;
      }

      if (newInvTipo === 'Transferência de responsabilidade') {
        activeInventory.coordenadorSaindo = outgoingCoordinator;
        activeInventory.coordenadorAssumindo = incomingCoordinator;
      }

      if (newInvTipo === 'Eventual') {
        activeInventory.solicitadoPor = requestedBy;
      }

      // 3. Save each inventory item
      const chunkedItens: any[] = [];
      const seenCodes = new Set<string>();

      for (const item of itemsToCount) {
        const itemCode = item.codigo.trim().toUpperCase();
        if (seenCodes.has(itemCode)) {
          continue;
        }
        seenCodes.add(itemCode);

        const itemGrupo = item.grupo || getItemGrupo(item);
        const isInScope = newInvTipo !== 'Parcial' || selectedInScopeItems[item.codigo] !== false;

        const invItem: any = {
          id: `${newInvId}_${itemCode}`,
          inventarioId: newInvId,
          codigo: item.codigo,
          codigoAlternativo: (item as any).codigoAlternativo || '',
          descricao: item.descricao,
          unidade: item.unidade,
          statusContagem: isInScope ? 'Pendente' : 'Excluído',
          contagemAtualAtiva: 1,
          valorUnitario: item.valorUnitario,
          resultadoInvestigacao: '',
          planoAcao: '',
          grupo: itemGrupo,
          incluidoNoEscopo: isInScope
        };
        if (item.cadastradoManualmente) {
          invItem.cadastradoManualmente = true;
        }
        if (item.saldoSistema !== undefined) {
          invItem.saldoSistema = item.saldoSistema;
        } else if (item.cadastradoManualmente) {
          invItem.saldoSistema = 0;
        }
        chunkedItens.push(invItem);
      }

      const finalInventoryHeader: any = {
        ...activeInventory,
        itens: chunkedItens
      };

      const novoInventario = finalInventoryHeader;
      const { error } = await supabase.from('inventarios').upsert({ id: novoInventario.id, payload: novoInventario });
      if (error) {
        toast.error('Erro ao salvar no Supabase: ' + error.message);
        throw error;
      }

      // Synchronize with local react states
      const exists = inventories.some(i => i.id === novoInventario.id);
      const updatedInventories = exists
        ? inventories.map(i => i.id === novoInventario.id ? novoInventario : i)
        : [...inventories, novoInventario];
      setInventories(updatedInventories);
      try {
        localStorage.setItem('cmpc_inventarios_cache', JSON.stringify(updatedInventories));
      } catch (e) {
        console.error('Error caching inventories:', e);
      }

      await logHubEvent({
        type: 'hub_update',
        itemName: `Novo Inventário ${newInvTipo} Criado`,
        valAnterior: 'Inexistente',
        valNovo: JSON.stringify(activeInventory)
      });

      // Reset Create Form state
      setCustomItems([]);
      setNewInvResponsavel('');
      setSelectedCatalogItems(DEFAULT_CMPC_CATALOG.map(i => i.codigo));
      setImportedItems([]);
      setImportedFileName('');
      setNewInvDataInicio('');
      setNewInvDataFim('');
      setManualCodesInput('');
      setImportedMoves([]);
      setMovesFileName('');
      setGroupAssignments({}); // Reset assignments
      setSelectedInScopeItems({}); // Reset scope selections
      setOutgoingCoordinator('');
      setIncomingCoordinator('');
      setRequestedBy('');
      setMovesFileError('');
      setCreationStep(1); // Back to wizard step 1
      triggerToast('Inventário de estoque registrado e publicado com sucesso!');
      setCurrentTab('ativos');
    } catch (err: any) {
      console.error("Error creating inventory", err);
      toast.error('Erro ao criar inventário no Supabase: ' + (err.message || err));
    } finally {
      setCreationLoading(false);
    }
  };

  // Save Operator Stock Count
  const [activeQuantities, setActiveQuantities] = useState<{ [itemId: string]: string }>({});
  const [manuallyTyped, setManuallyTyped] = useState<{ [itemId: string]: boolean }>({});
  const [submittingCountId, setSubmittingCountId] = useState<string | null>(null);

  // Re-assign a stock group during an ongoing inventory (Requirement 3)
  const handleReassignGroup = async (groupName: string, selectedPin: string) => {
    setReassignGroup(groupName);
    setReassignNewPin(selectedPin);
    setReassignReason('');
    setReassignError('');
    setIsReassignModalOpen(true);
  };

  const submitReassignGroup = async () => {
    if (!selectedInventory) return;
    if (reassignReason.trim().length < 20) {
      setReassignError('A justificativa de segurança deve conter no mínimo 20 caracteres.');
      return;
    }
    setCreationLoading(true);
    try {
      const mergedAlmoxarifes = getMergedAlmoxarifes();
      const targetAlmox = listaAgentes.find(a => a.pin === reassignNewPin) || mergedAlmoxarifes.find(a => a.pin === reassignNewPin);
      
      const currentAttribs = selectedInventory.atribuicoes || [];
      const updatedAttribs = [...currentAttribs];
      
      const existingIdx = updatedAttribs.findIndex(a => a.grupoId === reassignGroup);
      const anteriorAlmoxNome = existingIdx >= 0 ? updatedAttribs[existingIdx].almoxarifeNome : 'Nenhum';

      if (existingIdx >= 0) {
        updatedAttribs[existingIdx] = {
          ...updatedAttribs[existingIdx],
          almoxarifeId: reassignNewPin,
          almoxarifeNome: targetAlmox ? targetAlmox.nome : 'Não atribuído'
        };
      } else {
        updatedAttribs.push({
          grupoId: reassignGroup,
          almoxarifeId: reassignNewPin,
          almoxarifeNome: targetAlmox ? targetAlmox.nome : 'Não atribuído'
        });
      }
      
      const newLog = {
        id: generateAutoId(),
        inventarioId: selectedInventory.id,
        fichaId: reassignGroup,
        contadorAnterior: anteriorAlmoxNome,
        novoContador: targetAlmox ? targetAlmox.nome : 'Não atribuído',
        motivo: reassignReason,
        alteradoPor: userProfile?.nome || 'Coordenador',
        timestamp: new Date().toISOString()
      };

      const updatedInv = {
        ...selectedInventory,
        atribuicoes: updatedAttribs,
        alteracoes_responsavel: [...(selectedInventory.alteracoes_responsavel || []), newLog]
      };

      setSelectedInventory(updatedInv);
      await saveInventoryToSupabase(updatedInv);

      // Audit Trail integration
      await logHubEvent({
        type: 'status_change',
        itemName: `Troca de Atribuição Ficha ${reassignGroup}`,
        valAnterior: anteriorAlmoxNome,
        valNovo: targetAlmox ? targetAlmox.nome : 'Não atribuído'
      });

      triggerToast(`Ficha ${reassignGroup} reatribuída com sucesso para ${targetAlmox ? targetAlmox.nome : 'Não atribuído'}`);
      
      setIsReassignModalOpen(false);
      setReassignGroup('');
      setReassignNewPin('');
      setReassignReason('');
      setReassignError('');
    } catch (err: any) {
      console.error("Erro ao reatribuir grupo", err);
      setReassignError("Erro ao salvar reatribuição no Supabase: " + (err.message || err));
    } finally {
      setCreationLoading(false);
    }
  };

  const submitReopenFicha = async () => {
    if (!selectedInventory) return;
    if (unlockJustification.trim().length < 20) {
      setUnlockError('A justificativa de segurança deve conter no mínimo 20 caracteres.');
      return;
    }

    // Identify if PIN is an admin PIN (Coordenador / Gerente / Administrador) in fullAllowedPins OR hardcoded backups
    const isAdminPin = fullAllowedPins.some(ap => ap.pin === unlockPin && (
      (ap.cargo || '').toLowerCase().includes('coordenador') || 
      (ap.cargo || '').toLowerCase().includes('gerente') || 
      (ap.cargo || '').toLowerCase().includes('administrador') || 
      ap.nivelAcesso === 'Coordenador' || 
      ap.nivelAcesso === 'Administrador'
    )) || unlockPin === '121288' || unlockPin === '991122';

    if (!isAdminPin) {
      setUnlockError('PIN de Administrador inválido ou sem privilégios de coordenação.');
      return;
    }

    setCreationLoading(true);
    try {
      // 1. Update the fiche status back to 'Aguardando Coordenador'
      const currentAttribs = selectedInventory.atribuicoes || [];
      const updatedAttribs = currentAttribs.map((a: any) => {
        if (a.grupoId === unlockGroup) {
          return {
            ...a,
            status: 'Aguardando Coordenador'
          };
        }
        return a;
      });

      const newLog = {
        id: generateAutoId(),
        inventarioId: selectedInventory.id,
        fichaId: unlockGroup,
        pin: unlockPin,
        justificativa: unlockJustification,
        timestamp: new Date().toISOString(),
        acao: 'reabertura_ficha'
      };

      const updatedInv = {
        ...selectedInventory,
        atribuicoes: updatedAttribs,
        reaberturas_autorizadas: [...(selectedInventory.reaberturas_autorizadas || []), newLog]
      };

      setSelectedInventory(updatedInv);
      await saveInventoryToSupabase(updatedInv);

      // 3. Audit Trail Event
      await logHubEvent({
        type: 'status_change',
        itemName: `Reabertura de Ficha ${unlockGroup}`,
        valAnterior: 'Concluída',
        valNovo: 'Aguardando Coordenador'
      });

      setSelectedInventory({
        ...selectedInventory,
        atribuicoes: updatedAttribs
      });

      // Immediately enter the review screen for this group!
      setSelectedReviewGroup(unlockGroup);
      const balPre: { [key: string]: string } = {};
      inventoryItems.forEach(item => {
        if ((item.grupo || 'Grupo Geral') === unlockGroup && item.saldoSistema !== undefined) {
          balPre[item.id] = item.saldoSistema.toString();
        }
      });
      setReviewSystemBalances(prev => ({ ...prev, ...balPre }));

      triggerToast(`Ficha ${unlockGroup} reaberta com sucesso.`);
      setIsUnlockModalOpen(false);
      setUnlockGroup('');
      setUnlockPin('');
      setUnlockJustification('');
      setUnlockError('');
    } catch (err: any) {
      console.error(err);
      setUnlockError("Erro ao registrar reabertura no Supabase: " + (err.message || err));
    } finally {
      setCreationLoading(false);
    }
  };

  const isSuspiciousItem = (item: InventoryItem) => {
    const isSusp1 = item.contagem1 === 0 && (!item.contador1Nome || item.contador1Nome.trim() === '' || item.contador1Nome.toLowerCase().includes('pendente'));
    const isSusp2 = item.contagem2 === 0 && (!item.contador2Nome || item.contador2Nome.trim() === '' || item.contador2Nome.toLowerCase().includes('pendente'));
    const isSusp3 = item.contagem3 === 0 && (!item.contador3Nome || item.contador3Nome.trim() === '' || item.contador3Nome.toLowerCase().includes('pendente'));
    const isSuspFinal = item.contagemFinal === 0 && (!item.contadorFinal1Nome || item.contadorFinal1Nome.trim() === '' || item.contadorFinal1Nome.toLowerCase().includes('pendente'));
    
    return isSusp1 || isSusp2 || isSusp3 || isSuspFinal || !!item.suspeito;
  };

  const iniciarReabertura = (
    item: InventoryItem, 
    round: number, 
    value: number | undefined, 
    operatorName: string | undefined, 
    operatorPin: string | undefined
  ) => {
    setReopenCountItem(item);
    setReopenCountRound(round);
    setReopenCountVal(value);
    setReopenCountContador(operatorName);
    setReopenCountContadorId(operatorPin);
    
    setReopenPin('');
    setReopenJustification('');
    setReopenError('');
    setReopenActionType('recount');
    setReopenNewValue('');
    setReopenCountModalOpen(true);
  };

  const executeReopenCount = async () => {
    if (!reopenCountItem || reopenCountRound === null || !selectedInventory) return;

    // 1. PIN Check for Coordinators
    const matched = (fullAllowedPins || []).find((p: any) => p.pin === reopenPin);
    const isCoord = (matched && (
      (matched.cargo || '').toLowerCase().includes('coordenador') || 
      (matched.cargo || '').toLowerCase().includes('gerente') || 
      (matched.cargo || '').toLowerCase().includes('administrador') || 
      matched.nivelAcesso === 'Coordenador' || 
      matched.nivelAcesso === 'Administrador'
    )) || reopenPin === '121288' || reopenPin === '991122';

    if (!isCoord) {
      setReopenError('PIN de Coordenador inválido.');
      return;
    }

    // 2. Justification minimum 20 characters unless it is a suspicious count with 0 and Pendente operator
    const isSusp = reopenCountVal === 0 && (reopenCountContador || '').toLowerCase().includes('pendente');
    if (!isSusp && reopenJustification.trim().length < 20) {
      setReopenError('A justificativa é obrigatória e deve conter pelo menos 20 caracteres.');
      return;
    }

    if (reopenActionType === 'direct_edit') {
      if (reopenNewValue.trim() === '' || isNaN(Number(reopenNewValue)) || Number(reopenNewValue) < 0) {
        setReopenError('Digite uma nova quantidade válida (maior ou igual a 0).');
        return;
      }
    }

    setCreationLoading(true);
    try {
      if (reopenActionType === 'direct_edit') {
        const newValueNum = Number(reopenNewValue);
        const updates: any = {};
        
        if (reopenCountRound === 1) {
          updates.contagem1 = newValueNum;
          updates.contagem1EditadaCoordenador = true;
          updates.contagem1Original = reopenCountVal !== undefined ? reopenCountVal : 0;
          updates.contador1Nome = userProfile?.nome || 'Coordenador SGI';
        } else if (reopenCountRound === 2) {
          updates.contagem2 = newValueNum;
          updates.contagem2EditadaCoordenador = true;
          updates.contagem2Original = reopenCountVal !== undefined ? reopenCountVal : 0;
          updates.contador2Nome = userProfile?.nome || 'Coordenador SGI';
        } else if (reopenCountRound === 3) {
          updates.contagem3 = newValueNum;
          updates.contagem3EditadaCoordenador = true;
          updates.contagem3Original = reopenCountVal !== undefined ? reopenCountVal : 0;
          updates.contador3Nome = userProfile?.nome || 'Coordenador SGI';
        } else if (reopenCountRound === 4) {
          updates.contagemFinal = newValueNum;
          updates.contagemFinalEditadaCoordenador = true;
          updates.contagemFinalOriginal = reopenCountVal !== undefined ? reopenCountVal : 0;
          updates.contadorFinal1Nome = userProfile?.nome || 'Coordenador SGI';
        }

        await updateSingleInventoryItem(reopenCountItem.id, updates);

        const newLog = {
          id: generateAutoId(),
          inventarioId: selectedInventory.id,
          itemId: reopenCountItem.id,
          itemCodigo: reopenCountItem.codigo,
          rodada: reopenCountRound,
          acao: 'edicao_direta_admin',
          pin: reopenPin,
          justificativa: reopenJustification,
          timestamp: new Date().toISOString(),
          valorAnterior: reopenCountVal !== undefined ? reopenCountVal : 0,
          valorNovo: newValueNum
        };
        const updatedInv = {
          ...selectedInventory,
          reaberturas_autorizadas: [...(selectedInventory.reaberturas_autorizadas || []), newLog]
        };
        setSelectedInventory(updatedInv);
        await saveInventoryToSupabase(updatedInv);
      } else {
        const updates: any = {};
        updates.contagemAtualAtiva = reopenCountRound;

        if (reopenCountRound === 1) {
          updates.contagem1 = deleteField();
          updates.contador1Id = deleteField();
          updates.contador1Nome = deleteField();
          
          updates.contagem2 = deleteField();
          updates.contador2Id = deleteField();
          updates.contador2Nome = deleteField();

          updates.contagem3 = deleteField();
          updates.contador3Id = deleteField();
          updates.contador3Nome = deleteField();

          updates.contagemFinal = deleteField();
          updates.contadorFinal1Id = deleteField();
          updates.contadorFinal1Nome = deleteField();
          updates.contadorFinal2Id = deleteField();
          updates.contadorFinal2Nome = deleteField();

          updates.statusContagem = 'Pendente';
          updates.almoxarifeAtribuidoId = deleteField();
          updates.almoxarifeAtribuidoNome = deleteField();
        }
        else if (reopenCountRound === 2) {
          updates.contagem2 = deleteField();
          updates.contador2Id = deleteField();
          updates.contador2Nome = deleteField();

          updates.contagem3 = deleteField();
          updates.contador3Id = deleteField();
          updates.contador3Nome = deleteField();

          updates.contagemFinal = deleteField();
          updates.contadorFinal1Id = deleteField();
          updates.contadorFinal1Nome = deleteField();
          updates.contadorFinal2Id = deleteField();
          updates.contadorFinal2Nome = deleteField();

          updates.statusContagem = 'Contagem 1';
          updates.almoxarifeAtribuidoId = deleteField();
          updates.almoxarifeAtribuidoNome = deleteField();
        }
        else if (reopenCountRound === 3) {
          updates.contagem3 = deleteField();
          updates.contador3Id = deleteField();
          updates.contador3Nome = deleteField();

          updates.contagemFinal = deleteField();
          updates.contadorFinal1Id = deleteField();
          updates.contadorFinal1Nome = deleteField();
          updates.contadorFinal2Id = deleteField();
          updates.contadorFinal2Nome = deleteField();

          updates.statusContagem = 'Contagem 2';
          updates.almoxarifeAtribuidoId = deleteField();
          updates.almoxarifeAtribuidoNome = deleteField();
        }
        else if (reopenCountRound === 4) {
          updates.contagemFinal = deleteField();
          updates.contadorFinal1Id = deleteField();
          updates.contadorFinal1Nome = deleteField();
          updates.contadorFinal2Id = deleteField();
          updates.contadorFinal2Nome = deleteField();

          updates.statusContagem = 'Contagem 3';
          updates.almoxarifeAtribuidoId = deleteField();
          updates.almoxarifeAtribuidoNome = deleteField();
        }

        if (isSusp) {
          updates.suspeito = false;
        }

        await updateSingleInventoryItem(reopenCountItem.id, updates);

        const newLog = {
          id: generateAutoId(),
          inventarioId: selectedInventory.id,
          itemId: reopenCountItem.id,
          itemCodigo: reopenCountItem.codigo,
          rodada: reopenCountRound,
          acao: 'reabertura_contagem',
          pin: reopenPin,
          justificativa: isSusp ? 'Estorno de valor de preenchimento automático (0 por Pendente)' : reopenJustification,
          timestamp: new Date().toISOString(),
          contadorAnterior: reopenCountContador || 'Pendente',
          valorAnterior: reopenCountVal !== undefined ? reopenCountVal : 0
        };

        // Also reset whole Ficha attribution status back to "Em contagem" (or "Em recontagem") to allow immediate recounts
        const groupName = reopenCountItem.grupo || 'Grupo Geral';
        const updatedAttribs = (selectedInventory.atribuicoes || []).map((a: any) => {
          if (a.grupoId === groupName) {
            return {
              ...a,
              status: reopenCountRound === 1 ? 'Em contagem' : 'Em recontagem'
            };
          }
          return a;
        });

        const updatedInv = {
          ...selectedInventory,
          atribuicoes: updatedAttribs,
          reaberturas_autorizadas: [...(selectedInventory.reaberturas_autorizadas || []), newLog]
        };

        setSelectedInventory(updatedInv);
        await saveInventoryToSupabase(updatedInv);
      }

      // Close modal & reset state
      setReopenCountModalOpen(false);
      setReopenCountItem(null);
      setReopenCountRound(null);
      setReopenPin('');
      setReopenJustification('');
      setReopenError('');
      setReopenNewValue('');

      triggerToast(reopenActionType === 'direct_edit' ? 'Contagem editada diretamente com sucesso.' : 'Contagem reaberta com sucesso no SGI.');
    } catch (e) {
      console.error(e);
      setReopenError('Erro ao reabrir contagem: ' + e);
    } finally {
      setCreationLoading(false);
    }
  };

  const executeBulkAssignRecontagem = async () => {
    if (selectedItemsForBulk.length === 0) {
      triggerToast('Nenhum item selecionado para atribuição em lote.');
      return;
    }
    if (!bulkAssignee) {
      triggerToast('Selecione um Agente de Contagem para a atribuição.');
      return;
    }
    if (!selectedInventory) return;

    const selectedAlmoxName = getMergedAlmoxarifes().find(a => a.pin === bulkAssignee)?.nome || 'Almoxarife';

    setBulkAssignLoading(true);
    try {
      const batchTimestamp = new Date().toISOString();
      const attribsToSave: any = { ...reviewAssignments };

      // Update each item document in Firestore
      for (const itemId of selectedItemsForBulk) {
        const item = inventoryItems.find(i => i.id === itemId);
        if (!item) continue;

        const updates: any = {
          almoxarifeAtribuidoId: bulkAssignee,
          almoxarifeAtribuidoNome: selectedAlmoxName,
          statusContagem: item.contagemAtualAtiva === 1 ? 'Pendente' : 'Aguardando recontagem',
          atribuidoTimestamp: batchTimestamp
        };
        await updateSingleInventoryItem(itemId, updates);
        attribsToSave[itemId] = bulkAssignee;
      }

      setReviewAssignments(prev => ({ ...prev, ...attribsToSave }));

      const groupName = selectedReviewGroup || 'Grupo Geral';
      const updatedAttribs = (selectedInventory.atribuicoes || []).map((a: any) => {
        if (a.grupoId === groupName) {
          return {
            ...a,
            status: 'Em recontagem'
          };
        }
        return a;
      });

      const updatedInv = {
        ...selectedInventory,
        atribuicoes: updatedAttribs
      };

      setSelectedInventory(updatedInv);
      await saveInventoryToSupabase(updatedInv);

      triggerToast(`Atribuição em lote concluída para ${selectedItemsForBulk.length} itens.`);
      setSelectedItemsForBulk([]);
      setBulkAssignee('');
    } catch (err) {
      console.error('Batch assignment error:', err);
      triggerToast('Erro na atribuição em lote: ' + err);
    } finally {
      setBulkAssignLoading(false);
    }
  };

  const handleConfirmCount = async (item: InventoryItem) => {
    if (!userProfile || !selectedInventory) return;
    const qtyStr = activeQuantities[item.id];
    
    // Safety check: ensure the value was manualy typed by verifying a non-empty string was provided
    if (qtyStr === undefined || qtyStr === null || qtyStr.trim() === '') {
      alert('Aviso SGI CMPC: Digite a quantidade aferida antes de confirmar a contagem.');
      return;
    }

    // Require manually typed validation to prevent automated/autofilled fraud
    if (!manuallyTyped[item.id]) {
      alert('Bloqueio SGI CMPC: Digitação manual obrigatória. Detecção de preenchimento automático. Digite a quantidade fisicamente aferida.');
      return;
    }

    if (isNaN(Number(qtyStr)) || Number(qtyStr) < 0) {
      alert('Informe uma quantidade válida igual ou superior a zero.');
      return;
    }

    const valueCounted = Number(qtyStr);

    // 1. Block duplicate counts by the same operator (unless Coordinator explicitly assigned/authorized them)
    if (item.contagemAtualAtiva === 2) {
      if (item.contador1Id === userProfile.pin && item.almoxarifeAtribuidoId !== userProfile.pin) {
        alert('Bloqueio CMPC-PRO-0093: O mesmo almoxarife não pode realizar a Contagem 1 e a Contagem 2 do mesmo item.');
        return;
      }
    } else if (item.contagemAtualAtiva === 3) {
      if ((item.contador1Id === userProfile.pin || item.contador2Id === userProfile.pin) && item.almoxarifeAtribuidoId !== userProfile.pin) {
        alert('Bloqueio CMPC-PRO-0093: O mesmo almoxarife não pode participar de múltiplas rodadas de contagem para o mesmo item.');
        return;
      }
    } else if (item.contagemAtualAtiva === 4) {
      // Handle Dual-Operator Confirmation for Final Count
      const secId = secondAlmoxarifeId[item.id];
      const secPin = secondAlmoxarifePin[item.id];

      if (!secId) {
        alert('Contagem Final exige validação conjunta de dois almoxarifes. Selecione o segundo conferente.');
        return;
      }
      if (!secPin) {
        alert('Informe o PIN de Segurança do segundo conferente para autorizar a contagem conjunta.');
        return;
      }

      const mergedAlmoxarifes = getMergedAlmoxarifes();
      const secAlmox = mergedAlmoxarifes.find(a => a.pin === secId);
      if (!secAlmox) {
        alert('Segundo conferente não encontrado no sistema.');
        return;
      }
      if (secPin !== secAlmox.pin) {
        alert('PIN do segundo conferente incorreto. Acesso Negado.');
        return;
      }

      // Check differences
      if (userProfile.pin === secAlmox.pin) {
        alert('A contagem final conjunta deve ser realizada por dois almoxarifes diferentes.');
        return;
      }

      // Block previous counters for both
      const previousPins = [item.contador1Id, item.contador2Id, item.contador3Id].filter(Boolean);
      if (previousPins.includes(userProfile.pin)) {
        alert(`O conferente ativo (${userProfile.nome}) já participou de uma das rodadas anteriores e está bloqueado.`);
        return;
      }
      if (previousPins.includes(secAlmox.pin)) {
        alert(`O segundo conferente (${secAlmox.nome}) já participou de uma das rodadas anteriores e está bloqueado.`);
        return;
      }
    }

    setSubmittingCountId(item.id);

    try {
      // 1. Prepara o payload
      const payload = {
        inventario_ref: String(selectedInventory?.id || selectedInventory?.referencia || 'ID_NAO_ENCONTRADO'),
        ficha_grupo: String(item.grupo || selectedFichaGroup || 'FICHA_NAO_ENCONTRADA'),
        codigo_item: item.codigo,
        fase_contagem: item.contagemAtualAtiva || 1,
        quantidade: Number(valueCounted),
        agente_nome: userProfile?.nome || 'Agente Desconhecido',
        agente_pin: userProfile?.pin || '0000'
      };

      console.log("Enviando payload para Supabase:", payload);

      // 2. Dispara pro Supabase
      const { data, error } = await supabase
        .from('inventario_contagens')
        .upsert(payload, { onConflict: 'inventario_ref, codigo_item, fase_contagem' })
        .select(); // Exige o retorno do dado inserido para confirmar

      // 3. Valida o erro
      if (error) {
        console.error("Erro crítico do Supabase:", error);
        triggerToast(`Erro ao salvar no banco: ${error.message}`);
        return; // ABORTA AQUI, NÃO ATUALIZA A UI
      }

      // 4. Só atualiza a UI e mostra sucesso se o Supabase confirmou
      console.log("Salvo com sucesso:", data);
      triggerToast(`Contagem salva: ${valueCounted} ${item.unidade}`);

      // Optimistic set for instant visual feedback on confirmation click
      setOptimisticCounted(prev => ({
        ...prev,
        [item.id]: valueCounted
      }));

      // 2. Save primary log under 'contagens'
      const newCountId = generateAutoId();
      const countRec: CountRecord = {
        id: newCountId,
        itemInventarioId: item.id,
        inventarioId: selectedInventory.id,
        numeroContagem: item.contagemAtualAtiva,
        quantidade: valueCounted,
        contador: userProfile.nome,
        contadorId: userProfile.pin,
        timestamp: new Date().toISOString(),
        cargo: userProfile.cargo,
        grupoEstoque: item.grupo || 'Grupo Geral',
        registradoPor: 'usuario',
        metodo: 'manual'
      };

      const nextContagens = [...(selectedInventory.contagens || []), countRec];

      // If Contagem Final, also save a log for the second operator
      if (item.contagemAtualAtiva === 4) {
        const secId = secondAlmoxarifeId[item.id];
        const mergedAlmoxarifes = getMergedAlmoxarifes();
        const secAlmox = mergedAlmoxarifes.find(a => a.pin === secId)!;

        const secondCountRec = {
          id: generateAutoId(),
          itemInventarioId: item.id,
          inventarioId: selectedInventory.id,
          numeroContagem: 4,
          quantidade: valueCounted,
          contador: secAlmox.nome,
          contadorId: secAlmox.pin,
          timestamp: new Date().toISOString(),
          cargo: 'Almoxarife',
          grupoEstoque: item.grupo || 'Grupo Geral',
          registradoPor: 'usuario',
          metodo: 'manual'
        };
        nextContagens.push(secondCountRec);
      }

      // 3. Formulate update on the item
      const nextUpdate: Partial<InventoryItem> = {
        contadorUltimo: userProfile.nome,
        timestampUltimo: new Date().toISOString(),
      };

      if (item.contagemAtualAtiva === 1) {
        nextUpdate.contagem1 = valueCounted;
        nextUpdate.contador1Id = userProfile.pin;
        nextUpdate.contador1Nome = userProfile.nome;
        nextUpdate.statusContagem = 'Contagem 1';
      } else if (item.contagemAtualAtiva === 2) {
        nextUpdate.contagem2 = valueCounted;
        nextUpdate.contador2Id = userProfile.pin;
        nextUpdate.contador2Nome = userProfile.nome;
        nextUpdate.statusContagem = 'Contagem 2';
      } else if (item.contagemAtualAtiva === 3) {
        nextUpdate.contagem3 = valueCounted;
        nextUpdate.contador3Id = userProfile.pin;
        nextUpdate.contador3Nome = userProfile.nome;
        nextUpdate.statusContagem = 'Contagem 3';
      } else {
        nextUpdate.contagemFinal = valueCounted;
        const secId = secondAlmoxarifeId[item.id];
        const mergedAlmoxarifes = getMergedAlmoxarifes();
        const secAlmox = mergedAlmoxarifes.find(a => a.pin === secId)!;
        
        nextUpdate.contadorFinal1Id = userProfile.pin;
        nextUpdate.contadorFinal1Nome = userProfile.nome;
        nextUpdate.contadorFinal2Id = secAlmox.pin;
        nextUpdate.contadorFinal2Nome = secAlmox.nome;
        nextUpdate.statusContagem = 'Contagem Final';
      }

      // Update in our item list
      const currentItens = [...(selectedInventory.itens || [])];
      const idx = currentItens.findIndex((i: any) => i.id === item.id);
      if (idx !== -1) {
        currentItens[idx] = { ...currentItens[idx], ...nextUpdate };
      }

      // 4. Update the assignment status to 'Em contagem' if it is 'Aberta' or undefined
      const groupName = item.grupo || 'Grupo Geral';
      let updatedAttribs = [...(selectedInventory.atribuicoes || [])];
      const attrib = updatedAttribs.find((a: any) => a.grupoId === groupName);
      if (attrib && (attrib.status === 'Aberta' || attrib.status === undefined)) {
        updatedAttribs = updatedAttribs.map((a: any) => {
          if (a.grupoId === groupName) {
            return { ...a, status: 'Em contagem' };
          }
          return a;
        });
      }

      const updatedInv = {
        ...selectedInventory,
        itens: currentItens,
        contagens: nextContagens,
        atribuicoes: updatedAttribs
      };

      setSelectedInventory(updatedInv);
      currentItens.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));
      setInventoryItems(currentItens);
      await saveInventoryToSupabase(updatedInv);

      // Reset inputs
      const updatedInputs = { ...activeQuantities };
      delete updatedInputs[item.id];
      setActiveQuantities(updatedInputs);

      const updatedTyped = { ...manuallyTyped };
      delete updatedTyped[item.id];
      setManuallyTyped(updatedTyped);

      // For Contagem Final inputs
      if (item.contagemAtualAtiva === 4) {
        const updSecId = { ...secondAlmoxarifeId };
        delete updSecId[item.id];
        setSecondAlmoxarifeId(updSecId);

        const updSecPin = { ...secondAlmoxarifePin };
        delete updSecPin[item.id];
        setSecondAlmoxarifePin(updSecPin);
      }

      await updateOverallInventoryProgress(selectedInventory.id);

      logHubEvent({
        type: 'commerce' as any,
        itemName: `Contagem ${item.contagemAtualAtiva} ${item.codigo}`,
        valAnterior: `Pendente`,
        valNovo: `Aferido: ${valueCounted} ${item.unidade} por ${userProfile.nome}`
      } as any);

    } catch (err: any) {
      console.error("Erro na função de confirmar:", err);
      
      const isOfflineErr = !navigator.onLine || 
        (err && err.message && (
          err.message.includes('offline') || 
          err.message.includes('network') || 
          err.message.includes('Failed to get document') ||
          err.message.includes('Unavailable')
        ));
      
      if (isOfflineErr) {
        const secId = secondAlmoxarifeId[item.id] || '';
        const secPin = secondAlmoxarifePin[item.id] || '';

        const offlineItem: OfflineCount = {
          id: generateAutoId ? generateAutoId() : Math.random().toString(36).substring(2, 11),
          itemId: item.id,
          inventarioId: selectedInventory.id,
          contagemAtualAtiva: item.contagemAtualAtiva,
          valueCounted: valueCounted,
          contadorNome: userProfile.nome,
          contadorId: userProfile.pin,
          cargo: userProfile.cargo,
          grupoEstoque: item.grupo || 'Grupo Geral',
          timestamp: new Date().toISOString(),
          secondAlmoxarifeId: secId,
          secondAlmoxarifePin: secPin,
          registradoPor: 'usuario',
          metodo: 'manual'
        };

        const updatedQueue = [...offlineQueue, offlineItem];
        localStorage.setItem('cmpc_offline_counts_queue', JSON.stringify(updatedQueue));
        setOfflineQueue(updatedQueue);

        // Optimistically set value counted so the UI instantly updates
        setOptimisticCounted(prev => ({
          ...prev,
          [item.id]: valueCounted
        }));

        // Reset inputs
        const updatedInputs = { ...activeQuantities };
        delete updatedInputs[item.id];
        setActiveQuantities(updatedInputs);

        const updatedTyped = { ...manuallyTyped };
        delete updatedTyped[item.id];
        setManuallyTyped(updatedTyped);

        // For Contagem Final inputs
        if (item.contagemAtualAtiva === 4) {
          const updSecId = { ...secondAlmoxarifeId };
          delete updSecId[item.id];
          setSecondAlmoxarifeId(updSecId);

          const updSecPin = { ...secondAlmoxarifePin };
          delete updSecPin[item.id];
          setSecondAlmoxarifePin(updSecPin);
        }

        triggerToast(`[Modo Offline] Contagem do item ${item.codigo} salva localmente (${valueCounted} ${item.unidade}).`);
      } else {
        triggerToast("Falha inesperada ao processar contagem: " + (err?.message || err));
      }
    } finally {
      setSubmittingCountId(null);
    }
  };

  // Helper calculating specific operator statistics for double-blind sheets
  const getAlmoxarifeGroupMetrics = (groupName: string) => {
    if (!selectedInventory) return { total: 0, counted: 0, progress: 0 };
    const items = inventoryItems.filter(item => {
      if ((item.grupo || 'Grupo Geral') !== groupName) return false;
      const attrib = (selectedInventory.atribuicoes || []).find((a: any) => a.grupoId === groupName);
      const isOwner = attrib && attrib.almoxarifeId === userProfile?.pin;
      
      if (item.contagemAtualAtiva === 1 && isOwner) return true;
      if (item.contagemAtualAtiva > 1 && item.almoxarifeAtribuidoId === userProfile?.pin) {
        // BUG 2 check: if counted in previous rounds, exclude it
        const hasCountedPrev = hasAlmoxarifeCountedItemPreviously(item.id, item.contagemAtualAtiva);
        if (hasCountedPrev) return false;
        return true;
      }
      return false;
    });
    
    const total = items.length;
    const counted = items.filter(item => {
      if (optimisticCounted[item.id] !== undefined) return true;
      if (item.contagemAtualAtiva === 1) return item.contagem1 !== undefined;
      if (item.contagemAtualAtiva === 2) return item.contagem2 !== undefined;
      if (item.contagemAtualAtiva === 3) return item.contagem3 !== undefined;
      if (item.contagemAtualAtiva === 4) return item.contagemFinal !== undefined;
      return false;
    }).length;
    
    const progress = total > 0 ? Math.round((counted / total) * 100) : 0;
    return { total, counted, progress };
  };

  // Triggers sheet status change to "Aguardando Coordenador" and locks it
  const handleFinalizeFicha = async (groupName: string) => {
    if (!selectedInventory) return;
    try {
      const updatedAttribs = (selectedInventory.atribuicoes || []).map((a: any) => {
        if (a.grupoId === groupName) {
          return {
            ...a,
            status: 'Aguardando Coordenador',
            finalizadaPor: userProfile?.nome || '',
            timestampFinalizada: new Date().toISOString()
          };
        }
        return a;
      });

      const updatedInv = {
        ...selectedInventory,
        atribuicoes: updatedAttribs
      };

      setSelectedInventory(updatedInv);
      await saveInventoryToSupabase(updatedInv);

      setSelectedFichaGroup(null);
      triggerToast(`Ficha [${groupName}] finalizada com sucesso! Aguardando revisão do Coordenador.`);
      
      logHubEvent({
        type: 'status_change' as any,
        itemName: `Ficha ${groupName} Finalizada`,
        valAnterior: 'Em contagem',
        valNovo: 'Aguardando Coordenador'
      } as any);

    } catch (err) {
      console.error("Erro ao finalizar ficha", err);
      alert("Erro ao salvar no Supabase: " + err);
    }
  };

  // Recalculates total inventory counted percentage and progression stats
  const updateOverallInventoryProgress = async (invId: string) => {
    try {
      const inv = inventories.find(i => i.id === invId) || selectedInventory;
      if (!inv || !inv.itens) return;

      let countOfAll = 0;
      let countOfCounted = 0;

      inv.itens.forEach((item: any) => {
        if (item.statusContagem !== 'Excluído') {
          countOfAll++;
          if (item.contagem1 !== undefined) {
            countOfCounted++;
          }
        }
      });

      if (countOfAll > 0) {
        const pct = Math.round((countOfCounted / countOfAll) * 100);
        const updatedInv = {
          ...inv,
          itensContados: countOfCounted,
          progresso: pct,
          status: pct === 0 ? 'Aberto' : pct === 100 ? 'Aguardando aprovação' : 'Em andamento'
        };
        await saveInventoryToSupabase(updatedInv);
      }
    } catch (err) {
      console.error("Error updating statistics", err);
    }
  };

  // Synchronizes a single offline count to Firestore/Supabase
  const syncSingleCount = async (q: OfflineCount) => {
    const invId = q.inventarioId;
    let targetInv = inventories.find(i => i.id === invId);
    if (!targetInv) {
      const { data, error } = await supabase
        .from('inventarios')
        .select('*')
        .eq('id', invId);
      if (error || !data || data.length === 0) return;
      targetInv = { id: data[0].id, ...data[0].payload };
    }

    const countRec: CountRecord = {
      id: generateAutoId(),
      itemInventarioId: q.itemId,
      inventarioId: q.inventarioId,
      numeroContagem: q.contagemAtualAtiva,
      quantidade: q.valueCounted,
      contador: q.contadorNome,
      contadorId: q.contadorId,
      timestamp: q.timestamp,
      cargo: q.cargo,
      grupoEstoque: q.grupoEstoque,
      registradoPor: q.registradoPor || 'usuario',
      metodo: q.metodo || 'manual'
    };

    const nextContagens = [...(targetInv.contagens || []), countRec];

    if (q.contagemAtualAtiva === 4 && q.secondAlmoxarifeId) {
      const secondCountRec = {
        id: generateAutoId(),
        itemInventarioId: q.itemId,
        inventarioId: q.inventarioId,
        numeroContagem: 4,
        quantidade: q.valueCounted,
        contador: q.secondAlmoxarifeId,
        contadorId: q.secondAlmoxarifeId,
        timestamp: q.timestamp,
        cargo: 'Almoxarife',
        grupoEstoque: q.grupoEstoque,
        registradoPor: q.registradoPor || 'usuario',
        metodo: q.metodo || 'manual'
      };
      nextContagens.push(secondCountRec);
    }

    // 3. Formulate update on the item
    const nextUpdate: Partial<InventoryItem> = {
      contadorUltimo: q.contadorNome,
      timestampUltimo: q.timestamp,
    };

    if (q.contagemAtualAtiva === 1) {
      nextUpdate.contagem1 = q.valueCounted;
      nextUpdate.contador1Id = q.contadorId;
      nextUpdate.contador1Nome = q.contadorNome;
      nextUpdate.statusContagem = 'Contagem 1';
    } else if (q.contagemAtualAtiva === 2) {
      nextUpdate.contagem2 = q.valueCounted;
      nextUpdate.contador2Id = q.contadorId;
      nextUpdate.contador2Nome = q.contadorNome;
      nextUpdate.statusContagem = 'Contagem 2';
    } else if (q.contagemAtualAtiva === 3) {
      nextUpdate.contagem3 = q.valueCounted;
      nextUpdate.contador3Id = q.contadorId;
      nextUpdate.contador3Nome = q.contadorNome;
      nextUpdate.statusContagem = 'Contagem 3';
    } else {
      nextUpdate.contagemFinal = q.valueCounted;
      nextUpdate.contadorFinal1Id = q.contadorId;
      nextUpdate.contadorFinal1Nome = q.contadorNome;
      nextUpdate.contadorFinal2Id = q.secondAlmoxarifeId || '';
      nextUpdate.contadorFinal2Nome = q.secondAlmoxarifeId || '';
      nextUpdate.statusContagem = 'Contagem Final';
    }

    const currentItens = [...(targetInv.itens || [])];
    const idx = currentItens.findIndex((i: any) => i.id === q.itemId);
    if (idx !== -1) {
      currentItens[idx] = { ...currentItens[idx], ...nextUpdate };
    }

    // Update assignment status of that group to 'Em contagem'
    const groupName = q.grupoEstoque || 'Grupo Geral';
    let updatedAttribs = [...(targetInv.atribuicoes || [])];
    const attrib = updatedAttribs.find((a: any) => a.grupoId === groupName);
    if (attrib && (attrib.status === 'Aberta' || attrib.status === undefined)) {
      updatedAttribs = updatedAttribs.map((a: any) => {
        if (a.grupoId === groupName) {
          return { ...a, status: 'Em contagem' };
        }
        return a;
      });
    }

    const updatedInv = {
      ...targetInv,
      itens: currentItens,
      contagens: nextContagens,
      atribuicoes: updatedAttribs
    };

    if (selectedInventory && selectedInventory.id === invId) {
      setSelectedInventory(updatedInv);
      const sortedItens = [...currentItens].sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));
      setInventoryItems(sortedItens);
    }

    await saveInventoryToSupabase(updatedInv);
  };

  // Triggers synchronization of all pending offline counts in the queue
  const triggerSyncOfflineQueue = async () => {
    // Read direct from localStorage to reflect the freshest values
    let latestQueue: OfflineCount[] = [];
    try {
      const saved = localStorage.getItem('cmpc_offline_counts_queue');
      latestQueue = saved ? JSON.parse(saved) : [];
    } catch {
      return;
    }

    if (latestQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);

    let remainingQueue = [...latestQueue];
    let successCount = 0;

    for (const qItem of latestQueue) {
      try {
        await syncSingleCount(qItem);
        remainingQueue = remainingQueue.filter(item => item.id !== qItem.id);
        successCount++;
      } catch (err) {
        console.error('Failed to sync offline item:', qItem, err);
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break; // Connection lost again, stop processing
        }
      }
    }

    localStorage.setItem('cmpc_offline_counts_queue', JSON.stringify(remainingQueue));
    setOfflineQueue(remainingQueue);
    setIsSyncing(false);

    if (successCount > 0) {
      triggerToast(`📢 Sincronização automática: ${successCount} contagem(s) enviadas com sucesso para a nuvem!`);
      if (selectedInventory) {
        await updateOverallInventoryProgress(selectedInventory.id);
      }
    }
  };

  // Network connection manager effect hook
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      triggerToast('🟢 Conexão restabelecida! Sincronizando dados pendentes com SGI CMPC...');
      triggerSyncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      triggerToast('⚠️ Você está offline. O sistema continuará gravando contagens localmente de forma segura.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial auto-sync check if online
    if (navigator.onLine) {
      const saved = localStorage.getItem('cmpc_offline_counts_queue');
      if (saved && JSON.parse(saved).length > 0) {
        triggerSyncOfflineQueue();
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineQueue, selectedInventory]);

  // Real-time Storekeepers active list builder (calculating last 15 mins inactive triggers)
  useEffect(() => {
    if (!selectedInventory || allCounts.length === 0) return;

    // Filter counts belonging to current inventory
    const relevantCounts = allCounts.filter(c => c.inventarioId === selectedInventory.id);
    
    // Group by operator name
    const grouped: { [nome: string]: { cargo: string; ultimoItem: string; timestamp: string } } = {};
    relevantCounts.forEach(c => {
      const activeObj = grouped[c.contador];
      if (!activeObj || new Date(c.timestamp).getTime() > new Date(activeObj.timestamp).getTime()) {
        const matchedItem = inventoryItems.find(i => i.id === c.itemInventarioId);
        grouped[c.contador] = {
          cargo: c.cargo || 'Almoxarife',
          ultimoItem: matchedItem ? `${matchedItem.codigo} - ${matchedItem.descricao}` : 'Item Desconhecido',
          timestamp: c.timestamp
        };
      }
    });

    const list = Object.keys(grouped).map(name => ({
      nome: name,
      cargo: grouped[name].cargo,
      ultimoItem: grouped[name].ultimoItem,
      timestamp: new Date(grouped[name].timestamp)
    }));

    setLiveActiveConferentes(list);
  }, [allCounts, selectedInventory, inventoryItems]);

  // Save System Ledger Balance for item (Coordinator only)
  const [editingBal, setEditingBal] = useState<{ [itemId: string]: string }>({});
  const [editingInvestigacao, setEditingInvestigacao] = useState<{ [itemId: string]: string }>({});
  const [editingPlano, setEditingPlano] = useState<{ [itemId: string]: string }>({});

  const handleSaveConsolidadoItem = async (item: InventoryItem) => {
    const balVal = editingBal[item.id] !== undefined ? editingBal[item.id] : (item.saldoSistema?.toString() || '');
    const invText = editingInvestigacao[item.id] !== undefined ? editingInvestigacao[item.id] : (item.resultadoInvestigacao || '');
    const planText = editingPlano[item.id] !== undefined ? editingPlano[item.id] : (item.planoAcao || '');

    if (balVal.trim() === '' || isNaN(Number(balVal))) {
      alert('Insira um saldo de sistema numérico válido.');
      return;
    }

    const nBal = Number(balVal);
    // Find the actual final quantity counted
    // Order of priority: contagemFinal -> contagem3 -> contagem2 -> contagem1
    let qCounted = 0;
    if (item.contagemFinal !== undefined) qCounted = item.contagemFinal;
    else if (item.contagem3 !== undefined) qCounted = item.contagem3;
    else if (item.contagem2 !== undefined) qCounted = item.contagem2;
    else if (item.contagem1 !== undefined) qCounted = item.contagem1;

    const desvioQ = qCounted - nBal;
    const desvioVal = desvioQ * item.valorUnitario;

    const hasDivergencia = Math.abs(desvioQ) > 0.001;

    let targetDivergenciaStatus: 'Aprovado' | 'Investigar' | 'Ajustado' | 'Aguarda ajuste no MEGA' | 'Pendente — Ajustar no próximo inventário geral' = 'Aprovado';
    if (hasDivergencia) {
      targetDivergenciaStatus = item.statusDivergencia || 'Investigar';
    }

    const updates: Partial<InventoryItem> = {
      saldoSistema: nBal,
      desvioQtd: desvioQ,
      desvioValor: desvioVal,
      resultadoInvestigacao: invText,
      planoAcao: planText,
      statusDivergencia: targetDivergenciaStatus,
      statusTratativa: 'TRATADA'
    };

    const dec = calcularDecisaoCMPC(nBal, item.contagem1, item.contagem2, item.contagem3, item.contagemFinal);
    if (!dec.isConcluido) {
      updates.contagemAtualAtiva = dec.nextRound !== null ? dec.nextRound : 2;
      updates.statusContagem = 'Divergente';
    } else {
      updates.statusContagem = 'Sucesso';
      if (dec.isDivergent) {
        updates.statusDivergencia = 'Investigar';
      } else {
        updates.statusDivergencia = 'Aprovado';
      }
    }

    try {
      await updateSingleInventoryItem(item.id, updates);
      triggerToast(`Consolidação salva para ${item.codigo}. Desvio: ${desvioQ} ${item.unidade}`);
    } catch (err) {
      alert('Erro ao salvar item consolidado: ' + err);
    }
  };

  // Flag action "Aguarda ajuste no MEGA" / Investigate toggle
  const handleUpdateDivergenciaFlag = async (
    item: InventoryItem, 
    newFlag: 'Aprovado' | 'Investigar' | 'Ajustado' | 'Aguarda ajuste no MEGA' | 'Pendente — Ajustar no próximo inventário geral'
  ) => {
    try {
      await updateSingleInventoryItem(item.id, {
        statusDivergencia: newFlag
      });
      triggerToast(`Item ${item.codigo} marcado como: ${newFlag}`);
    } catch (e) {
      alert(e);
    }
  };

  const handleConfirmPostConclusionEdit = async () => {
    if (!editingPostConclusionItem) return;
    
    const cleanPin = adminPinInput.trim();
    const cleanJustification = justificationInput.trim();
    const cleanNewCount = newCountInput.trim();

    if (cleanNewCount === '' || isNaN(Number(cleanNewCount))) {
      setPostConclusionError('Insira uma quantidade válida.');
      return;
    }

    // Validate Admin PIN
    const matched = fullAllowedPins.find((p: any) => p.pin === cleanPin);
    const isHardcodedBackup = cleanPin === '1903' || cleanPin === '300623' || cleanPin === '04632076376' || cleanPin === '00410482021';
    const isAdminAndValid = isHardcodedBackup || (matched && (matched.cargo === 'Coordenador' || matched.cargo === 'Auditor'));

    if (!isAdminAndValid) {
      setPostConclusionError('PIN de Administrador inválido ou sem privilégios de coordenação.');
      return;
    }

    // Validate Justification minimum length (20 chars)
    if (cleanJustification.length < 25) { // min 20 is required, so 25 is safe or let's use exact 20 as requested "mínimo 20 caracteres"
      setPostConclusionError('A justificativa de segurança deve conter no mínimo 20 caracteres.');
      return;
    }

    setSubmittingPostConclusion(true);
    try {
      const timestamp = new Date().toISOString();
      const newQty = Number(cleanNewCount);

      // Determine which round is active to update it correctly
      const roundToUpdate = editingPostConclusionItem.contagemAtualAtiva || 1;
      const itemUpdates: any = {};
      if (roundToUpdate === 1) {
        itemUpdates.contagem1 = newQty;
      } else if (roundToUpdate === 2) {
        itemUpdates.contagem2 = newQty;
      } else if (roundToUpdate === 3) {
        itemUpdates.contagem3 = newQty;
      } else {
        itemUpdates.contagemFinal = newQty;
      }

      // Recalculate divergence metrics if system balance exists
      if (editingPostConclusionItem.saldoSistema !== undefined) {
        const diff = newQty - editingPostConclusionItem.saldoSistema;
        itemUpdates.desvioQtd = diff;
        itemUpdates.desvioValor = diff * editingPostConclusionItem.valorUnitario;
      }

      // Update item in our local array
      const currentItens = [...(selectedInventory.itens || [])];
      const idx = currentItens.findIndex((i: any) => i.id === editingPostConclusionItem.id);
      if (idx !== -1) {
        currentItens[idx] = { ...currentItens[idx], ...itemUpdates };
      }

      const newLog = {
        id: generateAutoId(),
        acao: "edicao_pos_conclusao",
        pin: cleanPin,
        justificativa: cleanJustification,
        timestamp,
        itemId: editingPostConclusionItem.id,
        fichaId: editingPostConclusionFicha, // groupName
        codigo: editingPostConclusionItem.codigo,
        descricao: editingPostConclusionItem.descricao,
        inventarioId: selectedInventory.id,
        operadorNome: matched?.nome || 'Administrador SGI',
        newCount: newQty
      };

      const updatedInv = {
        ...selectedInventory,
        itens: currentItens,
        edicoes_pos_conclusao: [...(selectedInventory.edicoes_pos_conclusao || []), newLog]
      };

      setSelectedInventory(updatedInv);
      currentItens.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));
      setInventoryItems(currentItens);
      await saveInventoryToSupabase(updatedInv);

      // Trigger Success Notifications
      triggerToast(`Alteração pós-conclusão registrada para o item ${editingPostConclusionItem.codigo}!`);
      setEditingPostConclusionItem(null);
    } catch (err) {
      console.error(err);
      setPostConclusionError('Falha de escrita no Supabase: ' + err);
    } finally {
      setSubmittingPostConclusion(false);
    }
  };

  // Fast Bulk pre-population of balance
  const handleBulkSimulateSystemBalance = async () => {
    if (!window.confirm('Deseja preencher automaticamente o saldo do sistema com valores de teste para consolidação?')) return;
    try {
      for (const item of inventoryItems) {
        let qCounted = 0;
        if (item.contagemFinal !== undefined) qCounted = item.contagemFinal;
        else if (item.contagem3 !== undefined) qCounted = item.contagem3;
        else if (item.contagem2 !== undefined) qCounted = item.contagem2;
        else if (item.contagem1 !== undefined) qCounted = item.contagem1;

        // Introduce subtle random divergence
        const simulatedInLieu = Math.random() > 0.6 ? qCounted + (Math.random() > 0.5 ? 2 : -1) : qCounted;
        const desvioQ = qCounted - simulatedInLieu;
        const desvioVal = desvioQ * item.valorUnitario;

        const up: Partial<InventoryItem> = {
          saldoSistema: simulatedInLieu,
          desvioQtd: desvioQ,
          desvioValor: desvioVal,
          statusDivergencia: desvioQ !== 0 ? 'Investigar' : 'Aprovado'
        };
        await updateSingleInventoryItem(item.id, up);
      }
      triggerToast('Saldos do sistema preenchidos em lote.');
    } catch (e) {
      alert(e);
    }
  };

  // DIGITAL SIGNATURE & ENDING PROCESS
  const [digitalSignConfirmed, setDigitalSignConfirmed] = useState(false);
  const [showExecutiveSummary, setShowExecutiveSummary] = useState(false);
  const [printJob, setPrintJob] = useState<{ type: 'single' | 'all'; groupName?: string } | null>(null);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintJob(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const triggerPrintSingle = (groupName: string) => {
    setPrintJob({ type: 'single', groupName });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const triggerPrintAll = () => {
    setPrintJob({ type: 'all' });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleFinalSignClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventory) return;
    if (!closingName.trim() || !closingCargo.trim()) {
      alert('Informe o nome completo e o cargo do responsável pela assinatura.');
      return;
    }

    setIsSigning(true);
    try {
      const summaryMetrics = calculateClosingMetrics();

      // Compute expanded executive summary metrics for Firestore storage
      const relevantCounts = allCounts.filter(c => c.inventarioId === selectedInventory.id);
      const relevantTimestamps = relevantCounts.map(c => new Date(c.timestamp).getTime()).filter(t => !isNaN(t));
      let minT = 0;
      let maxT = 0;
      let elapsedMs = 0;
      if (relevantTimestamps.length > 0) {
        minT = Math.min(...relevantTimestamps);
        maxT = Math.max(...relevantTimestamps);
        elapsedMs = maxT - minT;
      }

      let tempoTotalText = "Sem lançamentos de contagem";
      if (elapsedMs > 0) {
        const h = Math.floor(elapsedMs / 3600000);
        const m = Math.floor((elapsedMs % 3600000) / 60000);
        if (h > 0) {
          tempoTotalText = `${h}h ${m}min`;
        } else {
          tempoTotalText = `${m} min`;
        }
      } else if (relevantTimestamps.length === 1) {
        tempoTotalText = "1 min (Contagem única)";
      }

      const totalFichas = (selectedInventory.atribuicoes || []).length;
      const concluídasFichas = (selectedInventory.atribuicoes || []).filter((a: any) => a.status === 'Concluída').length;
      const totalItensContados = inventoryItems.filter(i => i.contagem1 !== undefined || i.contagem2 !== undefined || i.contagem3 !== undefined || i.contagemFinal !== undefined).length;
      
      const perfectItens = summaryMetrics.perfectItens;
      const deviationItens = summaryMetrics.itemsWithDeviation;
      const valueDivergence = summaryMetrics.valorDivergenciaAbs;
      
      const totalTreated = inventoryItems.filter(item => {
        const qCounted = item.contagemFinal !== undefined ? item.contagemFinal : (item.contagem3 !== undefined ? item.contagem3 : (item.contagem2 !== undefined ? item.contagem2 : (item.contagem1 !== undefined ? item.contagem1 : 0)));
        const ledger = item.saldoSistema || 0;
        return Math.abs(qCounted - ledger) > 0.001 && item.statusTratativa === 'TRATADA';
      }).length;

      const totalMEGA = inventoryItems.filter(item => {
        const qCounted = item.contagemFinal !== undefined ? item.contagemFinal : (item.contagem3 !== undefined ? item.contagem3 : (item.contagem2 !== undefined ? item.contagem2 : (item.contagem1 !== undefined ? item.contagem1 : 0)));
        const ledger = item.saldoSistema || 0;
        return Math.abs(qCounted - ledger) > 0.001 && item.statusDivergencia === 'Aguarda ajuste no MEGA';
      }).length;

      const manualCounted = inventoryItems.filter(i => i.cadastradoManualmente).length;
      const reassignsCount = reassignLogs.filter(log => log.inventarioId === selectedInventory.id).length;
      const reopensCount = reopenLogs.filter(log => log.inventarioId === selectedInventory.id).length;

      const totalCountedVal = inventoryItems.reduce((acc, item) => {
        let actualCountedVal = 0;
        if (item.contagemFinal !== undefined) actualCountedVal = item.contagemFinal;
        else if (item.contagem3 !== undefined) actualCountedVal = item.contagem3;
        else if (item.contagem2 !== undefined) actualCountedVal = item.contagem2;
        else if (item.contagem1 !== undefined) actualCountedVal = item.contagem1;
        return acc + (actualCountedVal * (item.valorUnitario || 0));
      }, 0);

      const acuracidadeEstoque = totalItensContados > 0 ? Number(((perfectItens / totalItensContados) * 100).toFixed(1)) : 100;
      const assertividadeEstoque = totalCountedVal > 0 ? Number((Math.max(0, 1 - (valueDivergence / totalCountedVal)) * 100).toFixed(1)) : 100;

      const resumoExecutivoData = {
        tipoInventario: selectedInventory.tipo,
        dataInventario: selectedInventory.data || new Date().toISOString().split('T')[0],
        responsavelInventario: selectedInventory.responsavel || '',
        totalFichas,
        fichasConcluidas: concluídasFichas,
        totalItensContados,
        itensSemDivergencia: perfectItens,
        itensComDivergencia: deviationItens,
        valorTotalDivergencia: valueDivergence,
        itensComDivergenciaTratada: totalTreated,
        itensComDivergenciaMEGA: totalMEGA,
        itensCadastradosManualmente: manualCounted,
        acuracidadeEstoque: `${acuracidadeEstoque}%`,
        assertividadeEstoque: `${assertividadeEstoque}%`,
        valorTotalEstoque: totalCountedVal,
        tempoTotalInventario: tempoTotalText,
        alteracoesResponsavel: reassignsCount,
        reaberturasAutorizadas: reopensCount
      };

      // 1. Create closed report document
      const reportId = generateAutoId();
      const clRep: ClosingReport = {
        id: reportId,
        inventarioId: selectedInventory.id,
        dataFechamento: new Date().toISOString().split('T')[0],
        tipo: selectedInventory.tipo,
        totalItens: selectedInventory.totalItens,
        valorTotalDivergencias: summaryMetrics.valorDivergenciaAbs,
        acuracidade: summaryMetrics.acuracidade,
        assertividade: summaryMetrics.assertividade,
        assinadoPor: closingName.trim(),
        cargoResponsavel: closingCargo.trim(),
        dataAssinatura: closingDate,
        observacoes: closingObservations.trim(),
        dataInicialPeriodo: selectedInventory.dataInicialPeriodo || '',
        dataFinalPeriodo: selectedInventory.dataFinalPeriodo || '',
        resumoExecutivo: resumoExecutivoData
      };

      const updatedInv = {
        ...selectedInventory,
        status: 'Encerrado',
        itensContados: selectedInventory.totalItens, // lock as 100%
        observacoes: closingObservations.trim(),
        closingReport: clRep
      };

      setSelectedInventory(updatedInv);
      await saveInventoryToSupabase(updatedInv);

      // PROMPT 3: GRAVAÇÃO DO SNAPSHOT FINAL DE CONSOLIDAÇÃO EM inventario_consolidacao_final
      const arrayDeSaldosFinais = inventoryItems.map(item => {
        let actualCountedVal = 0;
        if (item.contagemFinal !== undefined) actualCountedVal = item.contagemFinal;
        else if (item.contagem3 !== undefined) actualCountedVal = item.contagem3;
        else if (item.contagem2 !== undefined) actualCountedVal = item.contagem2;
        else if (item.contagem1 !== undefined) actualCountedVal = item.contagem1;

        const ledgerVal = item.saldoSistema || 0;
        const desvio = actualCountedVal - ledgerVal;

        return {
          id: item.id || `${selectedInventory.id}_${item.codigo}`,
          codigo: item.codigo,
          descricao: item.descricao,
          unidade: item.unidade,
          grupo: item.grupo,
          saldoSistema: ledgerVal,
          contagem1: item.contagem1,
          contagem2: item.contagem2,
          contagem3: item.contagem3,
          contagemFinal: item.contagemFinal,
          quantidadeConsolidada: actualCountedVal,
          desvio: desvio,
          valorUnitario: item.valorUnitario || 0,
          valorDivergencia: desvio * (item.valorUnitario || 0),
          statusContagem: item.statusContagem || 'Sucesso',
          statusTratativa: item.statusTratativa || '',
          statusDivergencia: item.statusDivergencia || '',
          resultadoInvestigacao: item.resultadoInvestigacao || '',
          planoAcao: item.planoAcao || ''
        };
      });

      const fechadoPorNome = userProfile?.nome || closingName.trim();

      const { error: snapshotError } = await supabase
        .from('inventario_consolidacao_final')
        .insert({
          inventario_ref: selectedInventory.id,
          dados_consolidados: arrayDeSaldosFinais,
          fechado_por: fechadoPorNome
        });

      if (snapshotError) {
        console.error('Erro ao gravar snapshot em inventario_consolidacao_final:', snapshotError);
      } else {
        console.log('Snapshot imutável gravado em inventario_consolidacao_final com sucesso!');
      }

      await logHubEvent({
        type: 'hub_update',
        itemName: `Relatório de Fechamento Emitido: ${selectedInventory.tipo}`,
        valAnterior: 'Aguardando aprovação',
        valNovo: `Inventário encerrado e bloqueado sob assinatura de ${closingName} (${closingCargo})`
      });

      triggerToast('🔒 Inventário encerrado solenemente! Assinatura guardada no Supabase de forma imutável.');
      
      // Clear observations state
      setClosingObservations('');
      setCurrentTab('acompanhamento');

    } catch (err) {
      console.error(err);
      alert('Falha ao registrar assinatura no Supabase: ' + err);
    } finally {
      setIsSigning(false);
    }
  };

  // Calculation formulas for stocks reports
  const calculateClosingMetrics = () => {
    let itemsCount = 0;
    let perfectMatchCount = 0;
    let totalValueDivergence = 0;
    let totalLedgerValue = 0;
    let absoluteQtyDivergence = 0;

    inventoryItems.forEach(item => {
      itemsCount++;
      const ledgerVal = item.saldoSistema || 0;
      const unitCost = item.valorUnitario || 0;
      totalLedgerValue += ledgerVal * unitCost;

      let actualCountedVal = 0;
      if (item.contagemFinal !== undefined) actualCountedVal = item.contagemFinal;
      else if (item.contagem3 !== undefined) actualCountedVal = item.contagem3;
      else if (item.contagem2 !== undefined) actualCountedVal = item.contagem2;
      else if (item.contagem1 !== undefined) actualCountedVal = item.contagem1;

      const deviation = actualCountedVal - ledgerVal;
      absoluteQtyDivergence += Math.abs(deviation);

      if (Math.abs(deviation) < 0.001) {
        perfectMatchCount++;
      } else {
        totalValueDivergence += Math.abs(deviation * unitCost);
      }
    });

    const assertividade = itemsCount > 0 ? Number(((perfectMatchCount / itemsCount) * 100).toFixed(1)) : 100;
    
    // Acuracidade can represent financial accuracy or volume accuracy
    // Volume base: % acuracidade = (1 - Abs(Sum(dev)) / Sum(sistema)) * 100
    let acuracidade = 100;
    if (totalLedgerValue > 0) {
      acuracidade = Number((Math.max(0, 1 - (totalValueDivergence / totalLedgerValue)) * 100).toFixed(1));
    } else if (itemsCount > 0 && perfectMatchCount < itemsCount) {
      acuracidade = assertividade;
    }

    return {
      totalItens: itemsCount,
      perfectItens: perfectMatchCount,
      itemsWithDeviation: itemsCount - perfectMatchCount,
      valorDivergenciaAbs: totalValueDivergence,
      valorTotalEstoqueSistema: totalLedgerValue,
      assertividade,
      acuracidade
    };
  };

  // Copy copyable Excel format data to clipboard
  const handleCopyExcelGridToClipboard = () => {
    let text = "CÓDIGO\tDESCRIÇÃO\tUNIDADE\tGRUPO DE ESTOQUE\tVALOR UNITÁRIO\tCONTAGEM 1\tCONTAGEM 2\tCONTAGEM 3\tCONTAGEM FINAL\tSALDO SISTEMA\tDESVIO QTD\tDESVIO VALOR\tSTATUS DIVERGÊNCIA\tINVESTIGAÇÃO/OBSERVAÇÃO\tPLANO DE AÇÃO\n";
    inventoryItems.forEach(item => {
      let qCounted = 0;
      if (item.contagemFinal !== undefined) qCounted = item.contagemFinal;
      else if (item.contagem3 !== undefined) qCounted = item.contagem3;
      else if (item.contagem2 !== undefined) qCounted = item.contagem2;
      else if (item.contagem1 !== undefined) qCounted = item.contagem1;

      text += `${item.codigo}\t${item.descricao}\t${item.unidade}\t${item.grupo || 'Geral'}\tR$ ${item.valorUnitario?.toFixed(2)}\t${item.contagem1 !== undefined ? item.contagem1 : '-'}\t${item.contagem2 !== undefined ? item.contagem2 : '-'}\t${item.contagem3 !== undefined ? item.contagem3 : '-'}\t${item.contagemFinal !== undefined ? item.contagemFinal : '-'}\t${item.saldoSistema !== undefined ? item.saldoSistema : '-'}\t${item.desvioQtd !== undefined ? item.desvioQtd : '-'}\tR$ ${item.desvioValor !== undefined ? item.desvioValor?.toFixed(2) : '-'}\t${item.statusDivergencia || '-'}\t${item.resultadoInvestigacao || '-'}\t${item.planoAcao || '-'}\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      triggerToast('📋 Tabela de itens copiada para colar facilmente no Excel!');
    }).catch(err => {
      alert('Falha ao copiar tabela: ' + err);
    });
  };

  // Helper calculating real-time activity delay since last log
  const getIdleMinutes = (timestamp: Date) => {
    const diffMs = Date.now() - timestamp.getTime();
    return Math.floor(diffMs / (1000 * 60));
  };

  // Search logic for items checklist
  const filteredInventoryItems = inventoryItems.filter(item => {
    const raw = `${item.codigo} ${item.descricao} ${item.statusContagem}`.toLowerCase();
    return raw.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans print:bg-white print:p-0 text-slate-900" id="cmpc-inventory-portal">
      
      {/* CMPC Brand Ribbon top */}
      <div className="h-2 w-full bg-gradient-to-r from-[#3a2573] via-emerald-600 to-[#3a2573]" />

      {/* Header controls element: print-hidden */}
      <header className="bg-slate-900 text-white py-4 px-6 md:px-8 border-b border-slate-800 shadow-md print:hidden" id="inventory-header">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <button
              onClick={onBackToHub}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-350 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Hub</span>
            </button>
            <div className="border-l border-slate-750 pl-3">
              <h1 className="text-sm font-black tracking-widest text-[#a855f7] flex items-center gap-1.5 uppercase leading-none">
                <ClipboardList className="w-5 h-5 text-[#c084fc]" />
                <span>Portal de Inventário CMPC</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                Norma Operacional CMPC-PRO-0093 • SGI
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {/* Connection Status & Offline Queue Indicator */}
            <div className="flex items-center space-x-2 mr-1">
              {!isOnline ? (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-bold text-amber-300 bg-amber-950/60 border border-amber-800 rounded-lg animate-pulse shadow-sm shadow-amber-900/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span className="uppercase text-[9px] tracking-wider">Modo Offline</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="uppercase text-[9px] tracking-wider">Modo Online</span>
                </div>
              )}

              {offlineQueue.length > 0 && (
                <button
                  onClick={triggerSyncOfflineQueue}
                  disabled={isSyncing}
                  className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-extrabold rounded-lg border shadow-sm transition-all uppercase text-[9px] tracking-wider ${
                    isSyncing
                      ? 'bg-purple-950/40 text-purple-400 border-purple-900 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500'
                  }`}
                  title={`${offlineQueue.length} contagens pendentes de sincronização. Clique para tentar sincronizar agora.`}
                >
                  <UploadCloud className={`w-3 h-3 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>Sincronizar ({offlineQueue.length})</span>
                </button>
              )}
            </div>

            {userProfile && (
              <div className="flex items-center space-x-3 bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-slate-300">
                <div className="bg-[#3a2573]/50 p-1 rounded-lg">
                  <UserCheck className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-200 leading-none">{userProfile.nome}</p>
                  <p className="text-[9px] font-black uppercase text-purple-300 tracking-wider mt-0.5">{formatCargo(userProfile.cargo)}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 text-slate-400 hover:text-rose-450 hover:bg-slate-700/40 rounded transition-colors ml-2"
                  title="Trocar de perfil"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating notification Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 border text-xs font-bold py-3.5 px-6 rounded-2xl shadow-2xl z-[100] flex items-center gap-2 max-w-sm font-sans ${
              toastType === 'error'
                ? 'bg-rose-950 border-rose-800 text-rose-100'
                : 'bg-slate-900 border-[#3a2573] text-purple-100'
            }`}
          >
            <div className={`p-1 rounded-lg shrink-0 ${
              toastType === 'error' ? 'bg-rose-800 text-rose-200' : 'bg-[#3a2573] text-purple-200'
            }`}>
              {toastType === 'error' ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* If USER INACTIVE or LOCAL BIOMETRIC LOCK ACTIVE inside Portal CMPC, display Biometric Face Authentication + RBAC */}
      {(!biometriaInventarioValidada || !userProfile) ? (
        <main className="flex-grow max-w-xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-[32px] p-6 sm:p-8 shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#3a2573] via-purple-600 to-emerald-500" />
            
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex p-4 bg-purple-50 text-[#3a2573] border border-purple-100 rounded-2xl mb-3 shadow-xs">
                <Scan className="w-8 h-8 text-[#3a2573]" />
              </div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                Autenticação Biométrica Facial
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                Conforme norma de segurança e auditoria CMPC-PRO-0093, o acesso ao Portal de Inventário exige validação biométrica individual a cada abertura de tela.
              </p>
            </div>

            {/* ERROR BANNER IF BIOMETRIC OR CAMERA FAILED */}
            {(biometricError || bioCameraError) && (
              <div className="mb-5 bg-rose-50 border border-rose-200 p-4 rounded-2xl text-xs text-rose-800 font-bold flex flex-col gap-2">
                <div className="flex items-center gap-2 text-rose-900 font-black uppercase text-[11px]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Falha no Scanner Facial</span>
                </div>
                <p>{biometricError || bioCameraError}</p>
                <button
                  type="button"
                  onClick={handleReiniciarScanner}
                  className="mt-1 self-start px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Tentar Novamente</span>
                </button>
              </div>
            )}

            {/* VIEWPORT / CAMERA / SCANNER SECTION OU FORMULÁRIO DE FALLBACK (PLANO B) */}
            {!usuarioReconhecido ? (
              !usarSenha ? (
                <div className="space-y-4">
                  <div className="relative w-full max-w-sm mx-auto aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-inner flex items-center justify-center">
                    <video
                      ref={bioVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover -scale-x-100"
                    />
                    <canvas
                      ref={bioCanvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100"
                    />

                    {/* Overlays / Scanning animation */}
                    {isLoadingModels || loadingUsers ? (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-4 text-center">
                        <RefreshCw className="w-7 h-7 text-purple-400 animate-spin" />
                        <p className="text-xs font-bold text-slate-200">
                          {isLoadingModels ? 'Carregando modelos neurais...' : 'Sincronizando base biométrica...'}
                        </p>
                      </div>
                    ) : !isBioCameraActive && !bioCameraError ? (
                      <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <Camera className="w-8 h-8 text-slate-400" />
                        <button
                          type="button"
                          onClick={startBioCamera}
                          className="px-4 py-2 bg-[#3a2573] hover:bg-[#2e1d5c] text-white text-xs font-black uppercase rounded-xl tracking-wider transition-colors cursor-pointer"
                        >
                          Ativar Câmera
                        </button>
                      </div>
                    ) : null}

                    {/* Liveness / Yaw Badge */}
                    {isBioCameraActive && !isLoadingModels && (
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-bold text-white px-2.5 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-white/10">
                        <div className="flex items-center gap-1.5">
                          <Eye className={`w-3.5 h-3.5 ${isAlive ? 'text-emerald-400' : 'text-amber-400'}`} />
                          <span>
                            {isAlive ? 'Prova de Vida OK ✓' : 'Movimente o rosto levemente para um dos lados'}
                          </span>
                        </div>
                        <span className="font-mono text-slate-300">
                          {facesCadastradas} faces cadastradas
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-[11px] text-slate-600 font-medium space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-800 font-black uppercase text-[10px]">
                      <Sparkles className="w-3.5 h-3.5 text-[#3a2573]" />
                      <span>Instruções de Escaneamento</span>
                    </div>
                    <p>• Mantenha o rosto centralizado em local bem iluminado.</p>
                    <p>• Movimente o rosto levemente para um dos lados para confirmação da prova de vida (anti-spoofing).</p>
                  </div>

                  {/* Botão de Fallback (onde o cliente marcou de vermelho) */}
                  <div className="flex justify-center pt-1">
                    <button 
                      type="button"
                      onClick={() => {
                        // Importante: Pare as tracks de vídeo ao mudar para o modo de senha para desligar a luz da webcam
                        if (bioVideoRef.current && bioVideoRef.current.srcObject) {
                          const stream = bioVideoRef.current.srcObject as MediaStream;
                          stream.getTracks().forEach(track => track.stop());
                        }
                        stopBioCamera();
                        setUsarSenha(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline text-xs flex items-center gap-1.5 cursor-pointer py-1.5 px-3 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Estou com problemas na câmera. Entrar com Senha.</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLoginPorSenha} className="flex flex-col gap-4 w-full max-w-sm mx-auto mt-2">
                  <div className="text-center mb-1">
                    <div className="inline-flex p-3 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-2xl mb-2 shadow-xs">
                      <KeyRound className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-slate-800 font-bold text-lg">Acesso Manual</h3>
                    <p className="text-slate-500 text-xs">Insira suas credenciais do Almoxarifado para liberar o Inventário.</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase text-slate-700 tracking-wider">E-mail</label>
                    <input 
                      type="email" 
                      placeholder="Seu E-mail" 
                      required
                      className="w-full p-3 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                      value={credenciais.email}
                      onChange={e => setCredenciais({...credenciais, email: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase text-slate-700 tracking-wider">Senha</label>
                    <input 
                      type="password" 
                      placeholder="Sua Senha" 
                      required
                      className="w-full p-3 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                      value={credenciais.senha}
                      onChange={e => setCredenciais({...credenciais, senha: e.target.value})}
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={loadingSenha}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 rounded-xl mt-2 text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
                  >
                    {loadingSenha ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Validando...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Autenticar</span>
                      </>
                    )}
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => {
                      setUsarSenha(false);
                      startBioCamera();
                    }}
                    className="mt-1 text-slate-500 text-xs font-semibold hover:underline flex items-center justify-center gap-1.5 cursor-pointer py-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Voltar para Leitura Facial</span>
                  </button>
                </form>
              )
            ) : (
              /* RECOGNIZED USER PROFILE & RBAC ROLE SELECTION FORM */
              <div className="space-y-5 animate-fade-in">
                
                {/* Recognized Colaborador Banner in Emerald/Green */}
                <div className="bg-emerald-50 border-2 border-emerald-400 p-4 rounded-2xl text-emerald-950 flex flex-col gap-1.5 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-800 font-black uppercase text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Colaborador Reconhecido</span>
                  </div>
                  <div className="text-lg font-extrabold text-emerald-700 tracking-tight">
                    {usuarioReconhecido.nome}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-emerald-800 mt-1">
                    <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-mono">
                      ID: #{usuarioReconhecido.id}
                    </span>
                    <span>•</span>
                    <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md">
                      Perfil Base: {usuarioReconhecido.perfil || 'ALMOXARIFADO'}
                    </span>
                    {usuarioReconhecido.confidence && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700">
                          Confiança: {usuarioReconhecido.confidence}%
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* RBAC ROLE SELECTION */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600 tracking-wider mb-2 font-sans">
                    Selecione o Cargo Operacional para esta Sessão:
                  </label>

                  {cargosPermitidos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* AGENTE DE CONTAGEM */}
                      <button
                        type="button"
                        onClick={() => setCargoSelecionado('AGENTE_CONTAGEM')}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          cargoSelecionado === 'AGENTE_CONTAGEM'
                            ? 'border-[#3a2573] bg-purple-50/70 ring-2 ring-[#3a2573]/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-xs text-slate-800 uppercase tracking-tight">
                              Agente de Contagem
                            </span>
                            {cargoSelecionado === 'AGENTE_CONTAGEM' && (
                              <Check className="w-4 h-4 text-[#3a2573]" />
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-500 font-medium leading-tight">
                            Lançamentos de contagens físicas 1, 2, 3 e bipagem de estoque.
                          </p>
                        </div>
                        <span className="mt-3 text-[9.5px] font-black uppercase text-purple-700 bg-purple-100/70 self-start px-2 py-0.5 rounded-md">
                          Disponível
                        </span>
                      </button>

                      {/* AGENTE DE CONTROLADORIA */}
                      {cargosPermitidos.includes('AGENTE_CONTROLADORIA') ? (
                        <button
                          type="button"
                          onClick={() => setCargoSelecionado('AGENTE_CONTROLADORIA')}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            cargoSelecionado === 'AGENTE_CONTROLADORIA'
                              ? 'border-[#3a2573] bg-purple-50/70 ring-2 ring-[#3a2573]/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-black text-xs text-slate-800 uppercase tracking-tight">
                                Agente de Controladoria
                              </span>
                              {cargoSelecionado === 'AGENTE_CONTROLADORIA' && (
                                <Check className="w-4 h-4 text-[#3a2573]" />
                              )}
                            </div>
                            <p className="text-[10.5px] text-slate-500 font-medium leading-tight">
                              Abertura, fechamentos, auditorias e conciliação executiva.
                            </p>
                          </div>
                          <span className="mt-3 text-[9.5px] font-black uppercase text-purple-700 bg-purple-100/70 self-start px-2 py-0.5 rounded-md">
                            Perfil Admin
                          </span>
                        </button>
                      ) : (
                        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 opacity-60 flex flex-col justify-between cursor-not-allowed">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-black text-xs text-slate-500 uppercase tracking-tight">
                                Agente de Controladoria
                              </span>
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <p className="text-[10.5px] text-slate-400 font-medium leading-tight">
                              Abertura, fechamentos e auditorias regulatórias.
                            </p>
                          </div>
                          <span className="mt-3 text-[9px] font-black uppercase text-slate-500 bg-slate-200 self-start px-2 py-0.5 rounded-md">
                            Requer Administrador
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-rose-800 text-xs font-semibold leading-relaxed">
                      ⚠️ <strong>Acesso Não Autorizado:</strong> O perfil cadastrado (<strong className="font-black">{usuarioReconhecido.perfil || 'Não Definido'}</strong>) não possui permissões operacionais para acesso ao Portal de Inventário. Contate a administração do sistema.
                    </div>
                  )}
                </div>

                {/* Audit Key Information Note */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center gap-2 text-[10.5px] text-slate-600 font-medium">
                  <Fingerprint className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    Será gerada uma <strong>chave de auditoria criptografada</strong> (Hash Base64) vinculada às suas bipagens.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleReiniciarScanner}
                    className="sm:w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-black uppercase tracking-wider py-3.5 rounded-xl transition-all cursor-pointer border border-slate-200 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Outro Rosto</span>
                  </button>

                  <button
                    type="button"
                    disabled={!cargoSelecionado || !cargosPermitidos.includes(cargoSelecionado)}
                    onClick={() => handleAutenticar(cargoSelecionado)}
                    className="flex-grow bg-[#3a2573] hover:bg-[#2b1b58] disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-black uppercase tracking-wider py-3.5 rounded-xl shadow-md transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Autenticar e Entrar no Portal</span>
                  </button>
                </div>

              </div>
            )}

            {/* Cancel and return to Hub */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center">
              <button
                type="button"
                onClick={onBackToHub}
                className="text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer py-1.5 px-3.5 rounded-xl hover:bg-slate-100"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cancelar e Voltar ao Menu Principal</span>
              </button>
            </div>
          </motion.div>
        </main>
      ) : (
        /* If Authenticated, show core inventory interface */
        <main className="flex-grow max-w-7xl mx-auto w-full px-4 md:px-8 py-6 flex flex-col lg:flex-row gap-6 print:p-0 print:gap-0">
          
          {/* Main Left column: Nav Tree, Active Inventories list */}
          <div className="w-full lg:w-80 shrink-0 space-y-5 print:hidden">
            
            {/* Quick module menu */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs whitespace-normal">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-3">Navegação</h3>
              
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('ativos');
                    setSelectedInventory(null);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    currentTab === 'ativos' && !selectedInventory
                      ? 'bg-[#3a2573] text-white font-bold'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <ClipboardList className="w-4 h-4" />
                    <span>Inventários Cadastrados</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {inventories.length}
                  </span>
                </button>

                {userProfile.cargo === 'Coordenador' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTab('criar');
                      setSelectedInventory(null);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      currentTab === 'criar'
                        ? 'bg-[#3a2573] text-white font-bold'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Iniciar Novo Inventário</span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* List of Recent Inventories selection */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs whitespace-normal max-h-[460px] overflow-y-auto">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-2.5">Realizar Seleção</h3>
              
              {inventories.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-1 opacity-40" />
                  <p className="text-[10.5px] font-semibold uppercase font-sans">Nenhum inventário ativo</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inventories.map((inv) => {
                    const isSelected = selectedInventory?.id === inv.id;

                    if (deletingInventoryId === inv.id) {
                      return (
                        <div
                          key={inv.id}
                          onClick={(e) => e.stopPropagation()}
                          className="p-3.5 rounded-2xl border border-rose-300 bg-rose-50 text-left transition-all space-y-3.5 shadow-sm"
                        >
                          <div className="flex items-center gap-1.5 justify-center text-rose-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-wider block">Confirmar Exclusão</span>
                          </div>
                          
                          <p className="text-[11px] text-slate-700 font-semibold text-center leading-tight">
                            Excluir permanentemente: <strong className="text-slate-950 block mt-0.5">{inv.tipo} ({inv.data})</strong>
                          </p>
                          
                          {deleteError && (
                            <p className="text-[10px] text-rose-700 font-bold text-center leading-tight bg-rose-100 p-2 rounded-lg">
                              {deleteError}
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingInventoryId(null);
                                setDeletePinInput('');
                                setDeleteError('');
                              }}
                              className="py-2 text-[10px] font-black uppercase tracking-wider rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-705 text-center transition-all cursor-pointer border border-slate-300 font-sans"
                            >
                              Voltar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteInventory(inv)}
                              className="py-2 text-[10px] font-black uppercase tracking-wider rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-center shadow-3xs transition-all cursor-pointer font-sans"
                            >
                              Confirmar
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={inv.id}
                        onClick={() => {
                          setSelectedInventory(inv);
                          setCurrentTab(userProfile.cargo === 'Almoxarife' ? 'ativos' : 'acompanhamento');
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-[#3a2573] bg-[#3a2573]/5' 
                            : 'border-slate-100 bg-white hover:bg-slate-50/80 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[8.5px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            inv.tipo === 'Parcial' || inv.tipo === 'Cíclico'
                              ? 'bg-purple-600 text-white border-purple-700 shadow-3xs'
                              : 'bg-[#3a2573]/5 text-[#3a2573] border-purple-150'
                          }`}>
                            {inv.tipo}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                              inv.status === 'Encerrado' 
                                ? 'bg-slate-200 text-slate-700 border border-slate-350' 
                                : inv.status === 'Aguardando aprovação'
                                ? 'bg-amber-100 text-amber-800 border border-amber-250 animate-pulse'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-250'
                            }`}>
                              {inv.status}
                            </span>
                            
                            {(inv.status === 'Aberto' || inv.status === 'Em andamento') && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingInventoryId(inv.id);
                                  setDeletePinInput('');
                                  setDeleteError('');
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50"
                                title="Excluir este inventário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <h4 className="text-[12px] font-bold text-slate-800 mt-2.5 leading-snug">
                          {inv.tipo} ({inv.data})
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase leading-none">
                          Resp: {inv.responsavel}
                        </p>
 
                        {/* Progression bar */}
                        <div className="mt-2.5">
                          <div className="flex justify-between items-center text-[9px] font-black text-slate-550 mb-1">
                            <span>Progresso contadoras:</span>
                            <span>{inv.progresso}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all font-bold" 
                              style={{ width: `${inv.progresso}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Core Content pane */}
          <div className="flex-grow bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-xs content-box min-h-[600px] print:border-none print:shadow-none print:p-0">
            
            {/* 1. NO INVENTORY SELECTED SCREEN */}
            {!selectedInventory && currentTab !== 'criar' && (
              <div className="h-full flex flex-col justify-center items-center text-center py-16 px-4">
                <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl text-slate-400 mb-4 animate-pulse">
                  <ClipboardList className="w-12 h-12" />
                </div>
                <h3 className="text-xl font-bold uppercase tracking-tight text-slate-800">Selecione um Inventário CMPC</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
                  Para começar as contagens ou consolidar desvios funcionais, clique em um dos inventários cadastrados na barra lateral esquerda, ou crie uma nova partida.
                </p>
                {userProfile.cargo === 'Coordenador' && (
                  <button
                    onClick={() => setCurrentTab('criar')}
                    className="mt-6 bg-[#3a2573] hover:bg-[#2b1b58] text-white text-xs font-black uppercase tracking-wider px-5 py-3 rounded-xl shadow-md cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Iniciar Nova Partida</span>
                  </button>
                )}
              </div>
            )}

            {/* 2. FORMULATE INVENTORY CREATION PAGE (Coordenador only) */}
            {currentTab === 'criar' && userProfile.cargo === 'Coordenador' && (() => {
              // Compute dynamic wizard steps
              const getWizardSteps = () => {
                const list = [
                  { id: 1, title: 'Base de Estoque' },
                  { id: 2, title: 'Tipo e Responsável' }
                ];

                if (newInvTipo === 'Transferência de responsabilidade') {
                  list.push({ id: 3, title: 'Coordenadores' });
                } else if (newInvTipo === 'Geral') {
                  list.push({ id: 3, title: 'Período' });
                } else if (newInvTipo === 'Parcial' || newInvTipo === 'Cíclico') {
                  list.push({ id: 3, title: 'Período' });
                  list.push({ id: 4, title: 'Itens a Contar' });
                } else if (newInvTipo === 'Eventual') {
                  list.push({ id: 3, title: 'Período' });
                  list.push({ id: 4, title: 'Itens a Contar' });
                }
                return list;
              };

              const wizardSteps = getWizardSteps();
              const totalSteps = wizardSteps.length;

              // Force clamping when step is out of bounds
              if (creationStep > totalSteps) {
                setCreationStep(totalSteps);
              }

              const renderGroupAssignments = () => {
                return (
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                        <Layers className="w-5 h-5 text-[#3a2573]" />
                        <span>Distribuição e Atribuição de Fichas por Grupo</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        O sistema agrupou os materiais do escopo. Atribua cada ficha a um almoxarife para a contagem campo.
                      </p>
                    </div>

                    {identifiedGroups.length === 0 ? (
                      <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-center text-[10.5px] font-bold text-slate-400 uppercase">
                        Nenhum material de estoque selecionado no escopo para agrupamento.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {identifiedGroups.map((grp) => {
                          const assignedUser = groupAssignments[grp.name];
                          const mergedAlmoxarifes = getMergedAlmoxarifes();

                          return (
                            <div key={grp.name} className="p-4 bg-slate-50/50 border border-slate-200 rounded-2xl shadow-3xs flex flex-col justify-between gap-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="text-[11.5px] font-black text-slate-800 uppercase tracking-tight">{grp.name}</h4>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{grp.count} {grp.count === 1 ? 'item identificado' : 'itens identificados'}</p>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                                  assignedUser 
                                    ? 'bg-[#3a2573]/5 border-[#3a2573]/20 text-[#3a2573]' 
                                    : 'bg-slate-100 border-slate-200 text-slate-500'
                                }`}>
                                  {assignedUser ? 'Atribuído' : 'Não atribuído'}
                                </span>
                              </div>

                              <div>
                                <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                  Agente de Contagem Responsável
                                </label>
                                <select
                                  value={assignedUser?.almoxarifeId || ''}
                                  onChange={(e) => {
                                    const selectedPin = e.target.value;
                                    if (!selectedPin) {
                                      const updated = { ...groupAssignments };
                                      delete updated[grp.name];
                                      setGroupAssignments(updated);
                                    } else {
                                      const found = mergedAlmoxarifes.find(a => a.pin === selectedPin);
                                      setGroupAssignments({
                                        ...groupAssignments,
                                        [grp.name]: {
                                          almoxarifeId: selectedPin,
                                          almoxarifeNome: found ? found.nome : 'Desconhecido'
                                        }
                                      });
                                    }
                                  }}
                                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] text-slate-850 font-bold"
                                >
                                  <option value="">-- Não Atribuído --</option>
                                  {mergedAlmoxarifes.map(a => (
                                    <option key={a.pin} value={a.pin}>
                                      {a.nome} (PIN: {a.pin})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              };

              const renderScopeSummary = () => {
                return (
                  plannedItems.length > 0 && (
                    <div className="bg-gradient-to-br from-slate-900 to-[#1e133a] text-white rounded-3xl p-5 border border-slate-800 shadow-sm space-y-3.5 select-none animate-fade-in">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5.5 h-5.5 text-purple-400 shrink-0" />
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-purple-300">Resumo de Escopo SGI CMPC (CMPC-PRO-0093)</h4>
                          <p className="text-[10px] text-purple-200 font-medium">Confirme o pré-fechamento do escopo antes de enviar para o banco de dados.</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                          <span className="text-[9px] uppercase font-black tracking-widest text-[#c084fc] block">Qtd Total Itens</span>
                          <span className="text-lg font-black font-mono mt-0.5 block">{plannedItems.length}</span>
                        </div>
                        
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                          <span className="text-[9px] uppercase font-black tracking-widest text-[#c084fc] block">Grupos de Estoque</span>
                          <span className="text-lg font-black font-mono mt-0.5 block">{identifiedGroups.length}</span>
                        </div>
                        
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 col-span-2 sm:col-span-1">
                          <span className="text-[9px] uppercase font-black tracking-widest text-[#c084fc] block">Validação Reguladora</span>
                          <span className="text-[11px] font-black uppercase text-emerald-400 mt-1 block">Aprovado SGI</span>
                        </div>
                      </div>

                      <div className="text-[10.5px] text-purple-100 bg-white/5 p-3 rounded-2xl border border-white/5 font-semibold">
                        <strong className="text-purple-300">Grupos Identificados:</strong> {
                          identifiedGroups.map(g => `${g.name} (${g.count})`).join(', ') || 'Nenhum'
                        }
                      </div>

                      <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/5">
                        <div className="bg-white/10 px-3.5 py-2 text-[9px] font-black uppercase text-purple-300 tracking-wider font-sans border-b border-white/10 flex justify-between">
                          <span>Materiais incluídos no escopo ({plannedItems.length})</span>
                          <span>Filtro em tempo real</span>
                        </div>
                        <div className="divide-y divide-white/5 max-h-[180px] overflow-y-auto">
                          {plannedItems.map((item, idx) => (
                            <div key={idx} className="p-3 text-[10px] sm:text-[10.5px] flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p className="font-bold text-white truncate">{item.codigo} - {item.descricao}</p>
                                <p className="text-[9px] text-[#c084fc] font-bold uppercase mt-0.5">
                                  Unidade: {item.unidade} • {item.grupo || getItemGrupo(item)}
                                </p>
                              </div>
                              <div className="text-right shrink-0 font-mono">
                                <span className="font-black text-emerald-400">Saldo: {item.saldoSistema !== undefined ? item.saldoSistema : 0} {item.unidade}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                );
              };

              const handleSubmitWizard = () => {
                if (newInvTipo === 'Transferência de responsabilidade') {
                  if (!outgoingCoordinator.trim() || !incomingCoordinator.trim()) {
                    alert('Por favor, informe o Coordenador que está saindo e o Coordenador que está assumindo.');
                    return;
                  }
                } else {
                  if (!newInvDataInicio || !newInvDataFim) {
                    alert('Por favor, informe a Data Inicial e Final do período de referência.');
                    return;
                  }
                }

                if (newInvTipo === 'Eventual') {
                  if (!requestedBy.trim()) {
                    alert('Por favor, informe quem solicitou o inventário eventual.');
                    return;
                  }
                }

                // Call handleCreateInventory using empty mock event
                handleCreateInventory({ preventDefault: () => {} } as any);
              };

              return (
                <div className="space-y-6">
                  {/* Header title */}
                  <div>
                    <h2 className="text-lg font-black text-slate-850 uppercase tracking-tight">Formulação de Inventário CMPC-PRO-0093</h2>
                    <p className="text-xs text-slate-500 mt-1">Siga o assistente de etapas sequenciais para configurar a nova partida.</p>
                  </div>

                  {/* Dynamic Visual Progress Indicator at the Top */}
                  <div className="bg-slate-50 border border-slate-150 rounded-3xl p-5 mb-8 max-w-2xl mx-auto shadow-3xs select-none font-sans">
                    <div className="flex items-center justify-between relative">
                      {/* Background connective line */}
                      <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200 z-0 rounded" />
                      
                      {/* Dynamic active connecting line */}
                      <div 
                        className="absolute top-4 left-4 h-0.5 bg-[#3a2573] z-0 rounded transition-all duration-500 ease-out"
                        style={{ width: `${((creationStep - 1) / (totalSteps - 1 || 1)) * 100}%` }}
                      />

                      {wizardSteps.map((step, idx) => {
                        const stepNum = idx + 1;
                        const isPast = stepNum < creationStep;
                        const isActive = stepNum === creationStep;

                        return (
                          <div key={step.id} className="flex flex-col items-center z-10 relative shrink-0">
                            <button
                              type="button"
                              disabled={stepNum > creationStep && importedItems.length === 0}
                              onClick={() => {
                                // Only allow clicking steps up to creationStep or if step is smaller
                                if (stepNum < creationStep || (stepNum === 2 && importedItems.length > 0) || (stepNum > 2 && importedItems.length > 0)) {
                                  setCreationStep(stepNum);
                                }
                              }}
                              className={`w-8.5 h-8.5 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${
                                isPast 
                                  ? 'bg-[#3a2573] border-[#3a2573] text-white shadow-xs hover:bg-[#2b1b58]' 
                                  : isActive 
                                    ? 'bg-white border-[#3a2573] text-[#3a2573] ring-4 ring-[#3a2573]/12 font-black' 
                                    : 'bg-white border-slate-250 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {isPast ? '✓' : stepNum}
                            </button>
                            <span 
                              className={`text-[9.5px] uppercase tracking-wider font-extrabold mt-2 px-1 max-w-[95px] text-center truncate ${
                                isActive ? 'text-[#3a2573] font-black' : isPast ? 'text-slate-700' : 'text-slate-450'
                              }`}
                            >
                              {step.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 1: BASE DE ESTOQUE (100% Fullscreen Screen Mode) */}
                  {creationStep === 1 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-3xs space-y-4">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
                            Passo 1 de {totalSteps} — Carregue a base de estoque atual
                          </h3>
                          <p className="text-xs text-slate-450 font-semibold mt-1">
                            Selecione ou arraste o arquivo HTML ou Excel do estoque atualizado emitido pelo SGI/ERP MEGA para prosseguir.
                          </p>
                        </div>

                        {importedItems.length === 0 ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                              isDragging 
                                ? 'border-[#3a2573] bg-[#3a2573]/5' 
                                : 'border-slate-200 hover:border-[#3a2573]/40 bg-slate-50/50'
                            }`}
                            onClick={() => {
                              const input = document.getElementById('sgi-html-file-upload-step');
                              if (input) input.click();
                            }}
                          >
                            <input
                              id="sgi-html-file-upload-step"
                              type="file"
                              accept=".html,.htm,.xlsx,.xls"
                              className="hidden"
                              onChange={(e) => {
                                const files = e.target.files;
                                if (files && files.length > 0) {
                                  handleFileImport(files[0]);
                                }
                              }}
                            />
                            <UploadCloud className="w-12 h-12 text-[#3a2573]/80 mb-3.5 animate-bounce" />
                            <span className="text-xs font-extrabold text-slate-700">Arrastar relatório HTML ou Excel de estoque aqui ou clicar para navegar</span>
                            <span className="text-[10px] text-slate-400 font-semibold mt-1">Formatos aceitos: Relatório SGI de saldo atual de estoque (.html, .xlsx, .xls)</span>
                          </div>
                        ) : (
                          <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4.5 space-y-4 animate-fade-in">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-start space-x-3">
                                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                                  <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 tracking-tight truncate max-w-sm sm:max-w-md">
                                    {importFileName}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-bold text-slate-500 mt-0.5">
                                    <span className="bg-emerald-150 text-emerald-800 px-2 py-0.5 rounded-full">
                                      ✓ {importedItems.length} materiais de estoque extraídos
                                    </span>
                                    <span>•</span>
                                    <span>Custo Estimado: <strong className="text-[#3a2573]">R$ {
                                      importedItems.reduce((acc, curr) => acc + (curr.saldoSistema * curr.valorUnitario), 0)
                                        .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    }</strong></span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setImportedItems([]);
                                  setImportedFileName('');
                                  triggerToast('🗑️ Baseline de estoque removido.');
                                }}
                                className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-100 hover:border-rose-200 rounded-xl transition-colors cursor-pointer"
                                title="Remover baseline"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Sample Preview List inside Step 1 */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white/80">
                              <div className="bg-slate-100 px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 tracking-wider flex justify-between border-b border-slate-200">
                                <span>Amostra técnica de materiais importados</span>
                                <span>Visualizando 4 de {importedItems.length}</span>
                              </div>
                              <div className="divide-y divide-slate-100 max-h-[150px] overflow-y-auto">
                                {importedItems.slice(0, 4).map((item, idx) => (
                                  <div key={idx} className="p-2.5 text-[10.5px] flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-700 truncate">{item.codigo} - {item.descricao}</p>
                                      <p className="text-[9.5px] text-slate-400 font-semibold uppercase mt-0.5">Unidade: {item.unidade} • Valor Unitário: R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="font-bold text-[#3a2573] font-mono">{item.saldoSistema} {item.unidade}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions Step 1 */}
                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentTab('ativos');
                            setSelectedInventory(null);
                          }}
                          className="px-5 py-3 text-xs font-black uppercase tracking-widest text-[#3a2573] border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={importedItems.length === 0}
                          onClick={() => setCreationStep(2)}
                          className={`px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl shadow-md min-w-[120px] transition-all flex items-center justify-center gap-1.5 ${
                            importedItems.length > 0 
                              ? 'bg-[#3a2573] hover:bg-[#2b1b58] text-white cursor-pointer' 
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                          }`}
                        >
                          <span>Avançar</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: TIPO E RESPONSÁVEL */}
                  {creationStep === 2 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-5">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
                            Passo 2 de {totalSteps} — Defina o tipo de inventário
                          </h3>
                          <p className="text-xs text-slate-450 font-semibold mt-1">
                            Especifique o propósito regulatório e designe o agente de controle responsável pela partida.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                              Tipo de Inventário SGI
                            </label>
                            <select
                              value={newInvTipo}
                              onChange={(e) => {
                                setNewInvTipo(e.target.value as any);
                                setMovesFileError('');
                              }}
                              className="w-full text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 transition-all font-bold cursor-pointer"
                            >
                              <option value="Geral">Inventário Geral (CMPC-FOR-0243)</option>
                              <option value="Parcial">Inventário Parcial (CMPC-FOR-0244)</option>
                              <option value="Cíclico">Inventário Cíclico periódico</option>
                              <option value="Eventual">Inventário Eventual auditoria</option>
                              <option value="Transferência de responsabilidade">Transferência de Responsabilidade SGI</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                              Agente de Controladoria de Inventário Responsável
                            </label>
                            <input
                              type="text"
                              required
                              placeholder={userProfile.nome}
                              value={newInvResponsavel}
                              onChange={(e) => setNewInvResponsavel(e.target.value)}
                              className="w-full text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 transition-all font-bold"
                            />
                          </div>
                        </div>

                        {/* Helper advisory banner based on selected type */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-2.5 font-sans">
                          <AlertCircle className="w-5 h-5 text-[#3a2573] shrink-0 mt-0.5" />
                          <div className="text-[11px] text-slate-650 leading-relaxed font-semibold">
                            {newInvTipo === 'Geral' && (
                              <span><strong>INVENTÁRIO GERAL:</strong> Abrange 100% dos itens carregados no baseline de estoque físico. Exige definição de período de referência e distribuição completa de fichas.</span>
                            )}
                            {newInvTipo === 'Parcial' && (
                              <span><strong>INVENTÁRIO PARCIAL:</strong> Permite escolher materiais específicos para a partida. O filtro de movimentações auxiliará a isolar itens movimentados de forma automatizada no período de referência.</span>
                            )}
                            {newInvTipo === 'Cíclico' && (
                              <span><strong>INVENTÁRIO CÍCLICO:</strong> Projetado para contagens recorrentes por amostragem. Permite carregar movimentações ou listar códigos específicos para aferição dirigida.</span>
                            )}
                            {newInvTipo === 'Eventual' && (
                              <span><strong>INVENTÁRIO EVENTUAL:</strong> Realizado por solicitações específicas de auditorias externas ou gerência executiva. Inclui campo mandatório para identificar a entidade solicitante.</span>
                            )}
                            {newInvTipo === 'Transferência de responsabilidade' && (
                              <span><strong>TRANSFERÊNCIA DE RESPONSABILIDADE:</strong> Lavrado na passagem de gestão de almoxarifados ou cargos de coordenação técnica do SGI. Solicita agentes saindo e assumindo.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions Step 2 */}
                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setCreationStep(1)}
                          className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newInvResponsavel.trim()) {
                              setNewInvResponsavel(userProfile.nome);
                            }
                            setCreationStep(3);
                          }}
                          className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-[#3a2573] hover:bg-[#2b1b58] text-white rounded-xl shadow-md min-w-[120px] cursor-pointer"
                        >
                          Avançar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: PERÍODO OU COORDENADORES */}
                  {creationStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <h3 className="text-sm font-black uppercase text-slate-850 tracking-wider">
                          {newInvTipo === 'Transferência de responsabilidade' 
                            ? `Passo 3 de 3 — Defina os Coordenadores`
                            : `Passo 3 de ${totalSteps} — Defina o período de referência`}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          {newInvTipo === 'Transferência de responsabilidade'
                            ? "Complete as informações de transferência de custódia e distribua os grupos antes de confirmar."
                            : "Determine as datas operacionais que delimitam as amostragens e relatórios fiscais do SGI."}
                        </p>
                      </div>

                      {newInvTipo === 'Transferência de responsabilidade' ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                                Coordenador de Estoques que está Saindo
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Digite o nome completo do coordenador saindo..."
                                value={outgoingCoordinator}
                                onChange={(e) => setOutgoingCoordinator(e.target.value)}
                                className="w-full text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 transition-all font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                                Coordenador de Estoques que está Assumindo
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Digite o nome completo do coordenador assumindo..."
                                value={incomingCoordinator}
                                onChange={(e) => setIncomingCoordinator(e.target.value)}
                                className="w-full text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 transition-all font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider mb-1.5 font-sans">
                              Data Inicial do Período de Referência SGI
                            </label>
                            <input
                              type="date"
                              required
                              value={newInvDataInicio}
                              onChange={(e) => setNewInvDataInicio(e.target.value)}
                              className="w-full text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 font-bold cursor-pointer font-sans"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider mb-1.5 font-sans">
                              Data Final do Período de Referência SGI
                            </label>
                            <input
                              type="date"
                              required
                              value={newInvDataFim}
                              onChange={(e) => setNewInvDataFim(e.target.value)}
                              className="w-full text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 font-bold cursor-pointer font-sans"
                            />
                          </div>
                        </div>
                      )}

                      {/* If Step 3 is the final step (i.e. Geral or Transferência), also show group assignments and summary! */}
                      {totalSteps === 3 && (
                        <>
                          {renderGroupAssignments()}
                          {renderScopeSummary()}
                        </>
                      )}

                      {/* Footer Actions Step 3 */}
                      <div className="flex justify-end gap-3.5 pt-4">
                        <button
                          type="button"
                          onClick={() => setCreationStep(2)}
                          className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                        >
                          Voltar
                        </button>
                        {totalSteps === 3 ? (
                          <button
                            type="button"
                            onClick={handleSubmitWizard}
                            disabled={creationLoading}
                            className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md min-w-[150px] flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {creationLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                            <span>Criar Inventário</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!newInvDataInicio || !newInvDataFim) {
                                alert('Por favor, defina a Data Inicial e Final do período de referência.');
                                return;
                              }
                              setCreationStep(4);
                            }}
                            className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-[#3a2573] hover:bg-[#2b1b58] text-white rounded-xl shadow-md min-w-[120px] cursor-pointer"
                          >
                            Avançar
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* STEP 4: SELEÇÃO DE ITENS / ITENS A CONTAR (Only Parcial, Cíclico, Eventual) */}
                  {creationStep === 4 && (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <h3 className="text-sm font-black uppercase text-slate-850 tracking-wider">
                          Passo 4 de 4 — Como deseja definir os itens em escopo?
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                          Escolha um método para carregar os códigos fiscais do inventário corrente.
                        </p>
                      </div>

                      {/* Eventual-only Solicitor field */}
                      {newInvTipo === 'Eventual' && (
                        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-3xs animate-fade-in font-sans">
                          <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider mb-1.5">
                            Solicitado por (Auditoria / Órgão Regulador / Gerência Geral) <strong className="text-rose-600">*</strong>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Identifique quem ou qual auditoria solicitou este inventário eventual..."
                            value={requestedBy}
                            onChange={(e) => setRequestedBy(e.target.value)}
                            className="w-full text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 font-bold"
                          />
                        </div>
                      )}

                      {/* Choice Buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 select-none font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setItemSelectMethod('movimentacoes');
                            setMovesFileError('');
                          }}
                          className={`p-6 border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                            itemSelectMethod === 'movimentacoes'
                              ? 'border-[#3a2573] bg-[#3a2573]/5 text-[#3a2573] font-black ring-2 ring-[#3a2573]/10'
                              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 text-slate-655'
                          }`}
                        >
                          <span className="text-2xl mb-1">📁</span>
                          <span className="text-xs uppercase tracking-wider font-extrabold">Importar arquivo de movimentações</span>
                          <span className="text-[10px] opacity-75 font-semibold text-center leading-normal max-w-[240px]">
                            Carregar o relatório de movimentações MEGA para filtrar automaticamente itens modificados no período.
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setItemSelectMethod('manualmente');
                            setMovesFileError('');
                          }}
                          className={`p-6 border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                            itemSelectMethod === 'manualmente'
                              ? 'border-[#3a2573] bg-[#3a2573]/5 text-[#3a2573] font-black ring-2 ring-[#3a2573]/10'
                              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 text-slate-655'
                          }`}
                        >
                          <span className="text-2xl mb-1">✏️</span>
                          <span className="text-xs uppercase tracking-wider font-extrabold">Informar códigos manualmente</span>
                          <span className="text-[10px] opacity-75 font-semibold text-center leading-normal max-w-[240px]">
                            Digitar uma lista específica de códigos de materiais do almoxarifado direto.
                          </span>
                        </button>
                      </div>

                      {/* Conditional Sources Panel and Errors */}
                      {itemSelectMethod === 'movimentacoes' ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-3xs animate-fade-in font-sans">
                          <label className="block text-[10px] font-black uppercase text-purple-700 tracking-wider">
                            Relatório de Movimentações MEGA (HTML ou Excel)
                          </label>
                          <p className="text-[10px] text-slate-450 font-bold uppercase leading-normal">
                            Comparado dinamicamente com as datas: <strong>{newInvDataInicio}</strong> até <strong>{newInvDataFim}</strong>
                          </p>

                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => document.getElementById('sgi-moves-file-upload-step')?.click()}
                              className="bg-white hover:bg-[#3a2573]/5 text-[#3a2573] border border-slate-300 text-[10.5px] font-black uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer inline-flex items-center gap-1.5 shadow-3xs transition-all"
                            >
                              <UploadCloud className="w-4 h-4 text-[#3a2573]" />
                              <span>Selecionar Arquivo de Movimentações</span>
                            </button>
                            
                            <input
                              id="sgi-moves-file-upload-step"
                              type="file"
                              accept=".html,.htm,.xlsx,.xls"
                              className="hidden"
                              onChange={(e) => {
                                const files = e.target.files;
                                if (files && files.length > 0) {
                                  handleMovesFileImport(files[0]);
                                }
                              }}
                            />

                            {movesFileName ? (
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-1">
                                ✓ {movesFileName} ({importedMoves.length} linhas)
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-slate-400 font-bold uppercase italic border border-slate-150 rounded px-2 py-1.5 bg-slate-50">Nenhum arquivo carregado</span>
                            )}
                          </div>

                          {movesFileError && (
                            <div className="bg-rose-50 border border-rose-150 rounded-2xl p-4.5 space-y-3 animate-fade-in text-sans">
                              <p className="text-[11px] font-extrabold text-rose-700 leading-normal flex items-start gap-1.5">
                                <span>⚠️</span>
                                <span>Erro de Processamento: {movesFileError}</span>
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setItemSelectMethod('manualmente');
                                  setMovesFileError('');
                                }}
                                className="px-3.5 py-2 bg-white text-rose-700 hover:bg-rose-100 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-3xs border border-rose-200"
                              >
                                Prefiro informar códigos manualmente
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3.5 shadow-3xs animate-fade-in font-sans">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-[#3a2573] tracking-wider mb-1">
                              Digite Códigos Diretos do Almoxarifado
                            </label>
                            <p className="text-[10px] text-slate-450 font-semibold mb-2">
                              Coloque os códigos (um por linha, separados por vírgula ou ponto-e-vírgula). Itens desconhecidos serão incluídos com saldo zero.
                            </p>
                            <textarea
                              value={manualCodesInput}
                              onChange={(e) => setManualCodesInput(e.target.value)}
                              onBlur={() => checkUnregisteredCodes(manualCodesInput)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                                  checkUnregisteredCodes(manualCodesInput);
                                }
                              }}
                              placeholder="Ex:&#10;MAT-101&#10;UNI-502&#10;OUT-403"
                              className="w-full text-xs p-3 bg-slate-50 border border-slate-300 outline-none focus:border-[#3a2573] rounded-xl font-mono text-slate-800 min-h-[90px]"
                            />
                            {parsedManualCodes.length > 0 && (
                              <div className="mt-2 text-[11px] font-semibold text-slate-500 font-sans">
                                <p className="mb-1.5 uppercase tracking-wider text-[9px] font-black text-slate-400">Itens digitados:</p>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-50 border border-slate-150 rounded-xl">
                                  {parsedManualCodes.map((item, idx) => {
                                    if (item.isDuplicated) {
                                      return (
                                        <span
                                          key={idx}
                                          title="⚠️ Código já incluído — será ignorado"
                                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-150 text-amber-801 border border-amber-300 rounded-lg cursor-help transition-all relative group"
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                          <span className="font-mono font-bold text-[10px]">{item.code}</span>
                                          
                                          {/* Custom Interactive Floating Tooltip */}
                                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-amber-950 text-white text-[9.5px] font-bold rounded shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
                                            ⚠️ Código já incluído — será ignorado
                                          </span>
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-805 border border-emerald-200 rounded-lg font-mono font-bold text-[10px]"
                                        >
                                          <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                          {item.code}
                                        </span>
                                      );
                                    }
                                  })}
                                </div>
                              </div>
                            )}
                            {invalidCodes.length > 0 && (
                              <div className="mt-2.5 p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 animate-fade-in font-sans">
                                <p className="text-[10.5px] font-black text-amber-900 leading-none">
                                  ⚠️ Fichas com itens sem registro atualizados na base ({invalidCodes.length} encontrados)
                                </p>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {invalidCodes.map(code => (
                                    <p key={code} className="text-[10px] font-extrabold text-amber-805 flex items-center gap-1.5 leading-tight">
                                      <span>• Código: {code} (Saldo zero)</span>
                                    </p>
                                  ))}
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => checkUnregisteredCodes(manualCodesInput)}
                                  className="w-full px-3.5 py-2 bg-amber-650 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-3xs cursor-pointer transition-all inline-flex items-center justify-center gap-1.5 border border-amber-500"
                                >
                                  ✏️ Cadastrar itens não encontrados sequencialmente
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Step 4 shows the Group assignments lists and Scope summary before creating */}
                      {renderGroupAssignments()}
                      {renderScopeSummary()}

                      {/* Footer Actions Step 4 */}
                      <div className="flex justify-end gap-3.5 pt-4">
                        <button
                          type="button"
                          onClick={() => setCreationStep(3)}
                          className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitWizard}
                          disabled={creationLoading}
                          className="px-6 py-3 text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md min-w-[150px] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {creationLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                          <span>Criar Inventário</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 3. ACTIVE SELECTED INVENTORY SUBPANE CONTROLS */}
            {selectedInventory && (
              <div className="space-y-6">
                
                {/* Inventory top contextual ribbon */}
                <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:pb-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-900 text-[#c084fc] border border-slate-700">
                        {selectedInventory.tipo}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        selectedInventory.status === 'Encerrado' 
                          ? 'bg-slate-200 text-slate-700 border border-slate-350' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-250 animate-pulse'
                      }`}>
                        {selectedInventory.status}
                      </span>
                    </div>

                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mt-2 flex items-center gap-1.5">
                      <span>Ref: {selectedInventory.tipo} do Estoque</span>
                      <span className="text-slate-400 font-normal">({selectedInventory.data})</span>
                    </h2>
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                      Agente de Controladoria de Inventário Responsável: {selectedInventory.responsavel}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 print:hidden">
                    {/* Role tabs for supervisor / coordinator / almoxarife / auditor */}
                    {(userProfile.cargo === 'Coordenador' || userProfile.cargo === 'Auditor') && (
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                        {[
                          { id: 'acompanhamento', label: 'Monitoramento', icon: BarChart3 },
                          ...(userProfile.cargo === 'Coordenador' ? [
                            { id: 'revisar', label: 'Revisão de Fichas', icon: ShieldCheck },
                            { id: 'consolidar', label: 'Consolidação', icon: Layers }
                          ] : []),
                          { id: 'fechamento', label: 'Fechamento CMPC', icon: FileText }
                        ].map((tab) => {
                          const IconComp = tab.icon;
                          const isActive = currentTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setCurrentTab(tab.id as any)}
                              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                isActive 
                                  ? 'bg-white text-[#3a2573] shadow-3xs font-black' 
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <IconComp className="w-3.5 h-3.5" />
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {userProfile.cargo === 'Almoxarife' && (
                      <button
                        type="button"
                        onClick={() => setCurrentTab('ativos')}
                        className="flex items-center space-x-1.5 px-4 py-2 text-xs font-black bg-[#3a2573] text-white rounded-xl shadow-sm cursor-pointer"
                      >
                        <ClipboardList className="w-4 h-4" />
                        <span>Ficha de Contagem</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3A. TRACKER / MONITOR MONITORING DASHBOARD (REAL-TIME SNAPSHOT) */}
                {currentTab === 'acompanhamento' && (
                  <div className="space-y-6">
                    
                    {/* Bento Grid Analytics header */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 text-center">
                        <Package className="w-5 h-5 text-[#3a2573] mx-auto mb-1.5" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total de Itens</p>
                        <p className="text-2xl font-black text-slate-800 font-mono mt-1">{selectedInventory.totalItens}</p>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 text-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Itens Contados (1ª)</p>
                        <p className="text-2xl font-black text-emerald-600 font-mono mt-1">{selectedInventory.itensContados}</p>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 text-center">
                        <AlertTriangle className="w-5 h-5 text-rose-500 mx-auto mb-1.5" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Itens Divergentes</p>
                        <p className="text-2xl font-black text-rose-600 font-mono mt-1">
                          {inventoryItems.filter(i => i.statusContagem === 'Divergente' || i.statusDivergencia === 'Investigar').length}
                        </p>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 text-center select-none">
                        <TrendingUp className="w-5 h-5 text-indigo-500 mx-auto mb-1.5" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assertividade</p>
                        <p className="text-2xl font-black text-indigo-600 font-mono mt-1">{calculateClosingMetrics().assertividade}%</p>
                      </div>
                    </div>

                    {/* Progress slider bar header */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
                        <span>Acompanhamento Operacional do Inventário</span>
                        <span>{selectedInventory.progresso}% Concluído</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                        <div 
                          className="h-full bg-gradient-to-r from-[#3a2573] to-emerald-500 transition-all font-black duration-700" 
                          style={{ width: `${selectedInventory.progresso}%` }}
                        />
                      </div>
                    </div>

                    {/* 3A.2 PAINEL DO COORDENADOR: VISÃO GERAL DE FICHA E ATRIBUIÇÕES POR GRUPO (Requirement 3) */}
                    <div className="bg-white border border-slate-200 rounded-[28px] p-5 space-y-4 shadow-3xs">
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                          <Layers className="w-5 h-5 text-[#3a2573]" />
                          <span>Monitoramento e Reatribuição de Fichas/Grupos</span>
                        </h4>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          Visualize o progresso de cada ficha/grupo e reatribua responsáveis em tempo real durante o inventário.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(() => {
                          const uniqueGroupsMap: Record<string, boolean> = {};
                          inventoryItems.forEach(i => {
                            uniqueGroupsMap[i.grupo || 'Grupo Geral'] = true;
                          });
                          const uniqueGroups = Object.keys(uniqueGroupsMap).sort();

                          if (uniqueGroups.length === 0) {
                            return (
                              <p className="text-xs text-slate-400 font-bold col-span-2 text-center py-4 uppercase">
                                Nenhum grupo de estoque identificado neste inventário.
                              </p>
                            );
                          }

                          return uniqueGroups.map(groupName => {
                            const metrics = getGroupMetrics(groupName);
                            const attrib = (selectedInventory.atribuicoes || []).find((a: any) => a.grupoId === groupName);
                            const currentAlmoxarifeId = attrib ? attrib.almoxarifeId : '';
                            const mergedAlmoxarifes = getMergedAlmoxarifes();
                            const idleAlert = getGroupIdleStatus(groupName);

                            return (
                              <div key={groupName} className={`p-4 rounded-2xl border transition-all ${
                                idleAlert.isIdle 
                                  ? 'bg-rose-50/20 border-rose-300' 
                                  : 'bg-slate-50/40 border-slate-200'
                              }`}>
                                <div className="flex justify-between items-start gap-2 mb-3">
                                  <div>
                                    <h5 className="text-[12.5px] font-black text-[#3a2573] uppercase tracking-tight">{groupName}</h5>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                                      Progresso: {metrics.counted} de {metrics.total} itens ({metrics.progress}%)
                                    </p>
                                  </div>
                                  <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                    metrics.progress === 100 
                                      ? 'bg-emerald-50 border-emerald-150 text-emerald-700 font-black' 
                                      : 'bg-indigo-50 border-indigo-150 text-indigo-700'
                                  }`}>
                                    {metrics.progress === 100 ? 'Concluído' : 'Aberto'}
                                  </span>
                                </div>

                                {/* Custom individual progress bar */}
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-205/40 mb-4">
                                  <div 
                                    className="h-full bg-gradient-to-r from-[#3a2573]/80 to-emerald-500 transition-all duration-350"
                                    style={{ width: `${metrics.progress}%` }}
                                  />
                                </div>

                                {/* Re-assign dropdown select */}
                                <div className="mt-3.5 space-y-2.5">
                                  <div>
                                    <label className="block text-[8.5px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                      Agente de Contagem Responsável (Reatribuição)
                                    </label>
                                    <select
                                      value={currentAlmoxarifeId}
                                      onChange={(e) => handleReassignGroup(groupName, e.target.value)}
                                      className="w-full text-xs p-2 bg-white border border-slate-255 rounded-xl outline-none text-slate-855 font-bold focus:border-[#3a2573]"
                                    >
                                      <option value="">-- Não Atribuído --</option>
                                      {listaAgentes.map(agente => (
                                        // IMPORTANTE: Retornando ao value original que o sistema espera para o vínculo
                                        <option key={agente.pin} value={agente.pin}>
                                          {agente.nome} (PIN: {agente.pin})
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Idle and inactive alerts (Requirement 3) */}
                                  {idleAlert.isIdle && (
                                    <div className="flex items-start gap-1.5 p-2 bg-rose-50 border border-rose-150 rounded-xl text-[9.5px] text-rose-700 font-bold animate-pulse leading-snug">
                                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                                      <span>{idleAlert.text}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Active storekeepers monitoring + Discrepancies hotspot */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      
                      {/* Active Operator Status Box */}
                      <div className="bg-slate-50/70 border border-slate-200 rounded-[28px] p-5">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-[#3a2573]" />
                            <span>Conferentes no Campo (Tempo Real)</span>
                          </h4>
                          <span className="text-[9px] bg-indigo-100 font-black uppercase text-indigo-800 px-2.5 py-0.5 rounded-full">
                            LOG Ativo
                          </span>
                        </div>

                        {liveActiveConferentes.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white">
                            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                            <p className="text-[11px] font-bold uppercase font-sans">Nenhuma contagem registrada nesta sessão</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {liveActiveConferentes.map((conf, index) => {
                              const idleMin = getIdleMinutes(conf.timestamp);
                              const isIdleWarning = idleMin >= 15;
                              return (
                                <div key={index} className="bg-white border border-slate-200 p-4 rounded-2xl flex items-start justify-between gap-3 shadow-3xs">
                                  <div>
                                    <h5 className="text-[12px] font-black text-[#3a2573]">{conf.nome}</h5>
                                    <p className="text-[9px] text-[#5e718d] font-bold uppercase tracking-wider mt-0.5">Operacional • {conf.cargo}</p>
                                    <p className="text-slate-500 select-none text-[11px] mt-2.5 leading-tight font-medium">
                                      Último Item: <span className="font-bold text-slate-800">{conf.ultimoItem}</span>
                                    </p>
                                  </div>
                                  
                                  <div className="text-right flex flex-col items-end shrink-0">
                                    <span className="text-[10px] font-mono text-slate-450">Há {idleMin} min</span>
                                    {isIdleWarning ? (
                                      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 text-[8.5px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-150 rounded-lg animate-pulse">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        <span>Inativo &gt; 15m</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 text-[8.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-lg">
                                        <span>Ativo</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Hotspots of Stock Divergence (Count 2, 3 triggered) */}
                      <div className="bg-slate-50/70 border border-slate-200 rounded-[28px] p-5">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            <span>Gargalos & Divergências de Estoque</span>
                          </h4>
                          <span className="text-[10px] text-rose-650 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                            Foco SGI
                          </span>
                        </div>

                        {inventoryItems.filter(i => i.contagemAtualAtiva > 1).length === 0 ? (
                          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white">
                            <CheckCircle2 className="w-8 h-8 text-slate-350 mx-auto mb-1" />
                            <p className="text-[11px] font-bold uppercase font-sans">Sem divergência crítica identificada até o momento</p>
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                            {inventoryItems.filter(i => i.contagemAtualAtiva > 1).map((item) => (
                              <div key={item.id} className="bg-white border-l-4 border-rose-500 border-y border-r border-slate-200 p-3.5 rounded-r-2xl shadow-3xs flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <h5 className="text-[12px] font-black text-rose-600 leading-tight flex items-center gap-1.5">
                                    <span>{item.codigo}</span>
                                    <span className="text-[9px] px-2 py-0.5 uppercase bg-rose-50 text-slate-500 rounded-full font-bold">
                                      Escalada em Contagem {item.contagemAtualAtiva}
                                    </span>
                                  </h5>
                                  <p className="text-[10.5px] font-medium text-slate-550 mt-1 uppercase leading-none">{item.descricao}</p>
                                </div>

                                <div className="text-center shrink-0">
                                  <p className="text-[10.5px] font-black text-rose-600 font-sans leading-none uppercase">Investigar</p>
                                  <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase leading-none">Un: {item.unidade}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Live Progress Checklist for Administrator */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-5">
                      <div className="flex justify-between items-center mb-4 flex-col sm:flex-row gap-3">
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Acompanhamento dos Itens em Foco</h4>
                        <div className="relative max-w-xs w-full">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <Search className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            placeholder="Buscar item..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl pl-9 outline-none focus:border-[#3a2573]"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-semibold text-slate-700 min-w-[600px] border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-wider">
                              <th className="py-3 px-4">Código</th>
                              <th className="py-3 px-4">Descrição</th>
                              <th className="py-3 px-4">Grupo</th>
                              <th className="py-3 px-4">Un.</th>
                              <th className="py-3 px-4 text-center">Contagem 1</th>
                              <th className="py-3 px-4 text-center">Contagem 2</th>
                              <th className="py-3 px-4 text-center">Contagem 3</th>
                              <th className="py-3 px-4 text-center">Contagem Final</th>
                              <th className="py-3 px-4 text-right">Status do Item</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInventoryItems.map((item) => (
                              <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/55">
                                <td className="py-3 px-4 font-bold text-[#3a2573] font-mono">{item.codigo}</td>
                                <td className="py-3 px-4 uppercase text-[11px] text-slate-600 font-medium">{item.descricao}</td>
                                <td className="py-3 px-4 uppercase text-[10.5px] text-slate-500 font-bold">{item.grupo || 'Geral'}</td>
                                <td className="py-3 px-4 uppercase text-[10.5px] text-slate-400 font-bold">{item.unidade}</td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-slate-650">{item.contagem1 !== undefined ? item.contagem1 : '-'}</td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-slate-650">{item.contagem2 !== undefined ? item.contagem2 : '-'}</td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-slate-650">{item.contagem3 !== undefined ? item.contagem3 : '-'}</td>
                                <td className="py-3 px-4 text-center font-mono font-bold text-slate-650">{item.contagemFinal !== undefined ? item.contagemFinal : '-'}</td>
                                <td className="py-3 px-4 text-right">
                                  <span className={`inline-block text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    item.statusContagem === 'Sucesso' 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                      : item.statusContagem === 'Divergente'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-150 animate-pulse'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                  }`}>
                                    {item.statusContagem}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3B. DOUBLE-BLIND OPERATOR INVENTORY COUNT TAB (Almoxarife style) */}
                {currentTab === 'ativos' && userProfile.cargo === 'Almoxarife' && (
                  <div className="space-y-6">
                    
                    {selectedFichaGroup === null ? (
                      // 1. CHOOSE WHICH FICHA GROUP TO COUNT (Requirement 2)
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-lg font-black text-[#3a2573] uppercase tracking-tight">Minhas Fichas de Contagem</h2>
                          <p className="text-xs text-slate-500 mt-1">
                            Abaixo estão as fichas de estoque associadas a você. Selecione uma para realizar as aferições físicas duplo-cegas.
                          </p>
                        </div>
                        {(selectedInventory.tipo === 'Parcial' || selectedInventory.tipo === 'Cíclico') && (
                          <div className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-4.5 flex items-start gap-3 select-none text-slate-850 shadow-3xs">
                            <span className="text-xl">⚠️</span>
                            <div>
                              <h4 className="text-[11px] font-black text-purple-900 uppercase tracking-wider">Inventário Parcial / Cíclico SGI em Andamento</h4>
                              <p className="text-xs text-purple-700 font-bold mt-0.5 leading-relaxed">
                                Almoxarifado em operação regular — atendimentos e fornecimento de materiais continuam normalmente neste período.
                              </p>
                            </div>
                          </div>
                        )}
 
                        {/* Progression bar for whole inventory */}
                        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
                            <span>Progresso Geral do Inventário</span>
                            <span>{selectedInventory.progresso}% Concluído</span>
                          </div>
                          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                            <div 
                              className="h-full bg-gradient-to-r from-[#3a2573] to-emerald-500 transition-all duration-500 font-black" 
                              style={{ width: `${selectedInventory.progresso}%` }}
                            />
                          </div>
                        </div>
 
                        {/* Fichas Group Cards List */}
                        {(() => {
                          const almoxGroups = getAlmoxarifeGroups();
 
                          if (almoxGroups.length === 0) {
                            return (
                              <div className="text-center py-12 bg-slate-50/50 border border-dashed border-slate-200 rounded-[28px]">
                                <Users className="w-10 h-10 text-slate-350 mx-auto mb-2.5" />
                                <h4 className="text-xs font-black uppercase text-slate-700">Nenhuma ficha alocada</h4>
                                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto font-semibold uppercase leading-tight">
                                  Você não é o agente de contagem responsável ou não possui itens atribuídos nesta fase de contagem para nenhum grupo.
                                </p>
                              </div>
                            );
                          }
 
                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {almoxGroups.map((groupName: string) => {
                                const attr = (selectedInventory.atribuicoes || []).find(
                                  (a: any) => a.grupoId === groupName
                                );
                                const metrics = getAlmoxarifeGroupMetrics(groupName);
                                const status = attr?.status || 'Aberta';

                                // Map descriptive badges
                                let statusColor = 'border-l-[#3a2573] bg-white';
                                let statusLabel = 'Em Aberto';
                                if (status === 'Aguardando Coordenador') {
                                  statusColor = 'border-l-amber-500 bg-amber-50/5';
                                  statusLabel = 'Aguardando Revisão';
                                } else if (status === 'Em recontagem') {
                                  statusColor = 'border-l-rose-500 bg-rose-50/5';
                                  statusLabel = 'Recontagem Solicitada';
                                } else if (status === 'Concluída') {
                                  statusColor = 'border-l-emerald-500 bg-emerald-50/5';
                                  statusLabel = '✅ Concluída';
                                }

                                return (
                                  <div 
                                    key={groupName}
                                    onClick={() => setSelectedFichaGroup(groupName)}
                                    className={`border-l-4 border-y border-r border-slate-200/85 hover:border-slate-300 p-5 rounded-r-3xl shadow-3xs hover:shadow-2xs transition-all cursor-pointer flex flex-col justify-between group ${statusColor}`}
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div>
                                        <div className="flex items-center gap-1.5 text-[#3a2573]">
                                          <Layers className="w-4 h-4 shrink-0" />
                                          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Ficha de Estoque</span>
                                          <span className="text-[8.5px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                                            {statusLabel}
                                          </span>
                                        </div>
                                        <h4 className="text-sm font-black text-slate-800 uppercase mt-2.5 group-hover:text-[#3a2573] transition-colors">{groupName}</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                                          {metrics.counted} de {metrics.total} {metrics.total === 1 ? 'item contado' : 'itens contados'}
                                        </p>
                                      </div>
                                      <span className="text-[10.5px] font-mono font-bold text-[#3a2573] bg-purple-50 px-2.5 py-1 rounded-xl shrink-0">
                                        {metrics.progress}%
                                      </span>
                                    </div>
 
                                    <div className="mt-5 space-y-2">
                                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/30">
                                        <div 
                                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-550 transition-all duration-350"
                                          style={{ width: `${metrics.progress}%` }}
                                        />
                                      </div>
                                      <div className="flex justify-end pt-1">
                                        <span className="text-[9.5px] font-black uppercase text-[#3a2573] tracking-widest flex items-center gap-1">
                                          {status === 'Aguardando Coordenador' || status === 'Concluída' ? (
                                            <>
                                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                                              <span className="text-slate-400">Visualizar Registros</span>
                                            </>
                                          ) : (
                                            <>
                                              <span>Iniciar Escaneamento</span>
                                              <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      // 2. ACTIVE DETAILED FICHA LIST INSIDE OPENED GROUP (Requirement 2)
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <button
                            type="button"
                            onClick={() => setSelectedFichaGroup(null)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-150 border border-slate-205 text-[#3a2573] text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 self-start cursor-pointer shadow-3xs"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Voltar para Fichas</span>
                          </button>
 
                          <div className="text-right sm:text-left">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#3a2573] bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                              Ficha Ativa: {selectedFichaGroup}
                            </span>
                          </div>
                        </div>
 
                        {/* Progression bar for selected active grupo */}
                        {(() => {
                          const metrics = getAlmoxarifeGroupMetrics(selectedFichaGroup);
                          return (
                            <div className="bg-white border border-slate-205 rounded-3xl p-5 shadow-3xs">
                              <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
                                <span>Status de Contagem da Ficha [{selectedFichaGroup}]</span>
                                <span>{metrics.counted} de {metrics.total} itens ({metrics.progress}%)</span>
                              </div>
                              <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-150">
                                <div 
                                  className="h-full bg-gradient-to-r from-purple-500 to-emerald-550 transition-all duration-350"
                                  style={{ width: `${metrics.progress}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
 
                        {/* Search in active group */}
                        <div className="flex flex-col sm:flex-row gap-3.5 justify-between items-center">
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider font-sans">Aferição e Escaneamento nos Almoxarifados</h4>
                          <div className="relative w-full sm:max-w-xs font-sans">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <Search className="w-4 h-4" />
                            </span>
                            <input
                              type="text"
                              placeholder="Pesquisar por descrição ou código..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchQuery.trim() !== '') {
                                  // If search query is exactly a code and not found, open the registration modal!
                                  const searchCode = searchQuery.trim().toUpperCase();
                                  const existsInBase = inventoryItems.some(item => item.codigo.toUpperCase() === searchCode);
                                  if (!existsInBase) {
                                    setUnregisteredCodesQueue([searchCode]);
                                    setManualRegCode(searchCode);
                                    setManualRegDesc('');
                                    setManualRegValueUnitario('');
                                    setManualRegClass(selectedFichaGroup || 'Grupo Geral');
                                    setShowCustomClassInput(false);
                                    setManualRegCustomClass('');
                                    setIsManualRegModalOpen(true);
                                  }
                                }
                              }}
                              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl pl-9 outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 font-bold"
                            />
                          </div>
                        </div>

                        {/* Grouped items checklist rendering */}
                        <div className="space-y-3.5">
                          {(() => {
                            // Filter only items in this group that this Almoxarife belongs to
                            const groupFilteredItems = filteredInventoryItems.filter(item => {
                              if ((item.grupo || 'Grupo Geral') !== selectedFichaGroup) return false;
                              
                              // If specifically re-assigned (individually assigned) to this storekeeper (e.g., reopened or recount reassignments)
                              if (item.almoxarifeAtribuidoId === userProfile?.pin) {
                                return true;
                              }

                              const attrib = (selectedInventory.atribuicoes || []).find((a: any) => a.grupoId === selectedFichaGroup);
                              const isOwner = attrib && attrib.almoxarifeId === userProfile?.pin;
                              
                              if (item.contagemAtualAtiva === 1 && isOwner) {
                                // If specifically assigned to some OTHER storekeeper, do not display
                                if (item.almoxarifeAtribuidoId && item.almoxarifeAtribuidoId !== userProfile?.pin) {
                                  return false;
                                }
                                return true;
                              }
                              
                              if (item.contagemAtualAtiva > 1 && item.almoxarifeAtribuidoId === userProfile?.pin) {
                                return true;
                              }
                              return false;
                            });

                            if (groupFilteredItems.length === 0) {
                              return (
                                <div className="text-center py-12 bg-white border border-slate-200 rounded-[28px] text-slate-400">
                                  <Package className="w-10 h-10 mx-auto mb-1 opacity-50" />
                                  <p className="text-xs font-bold uppercase">Nenhum item disponível para você nesta ficha — aguarde atribuição do Agente de Controladoria de Inventário</p>
                                </div>
                              );
                            }

                            // Retrieve general status of the ficha
                            const activeAttrib = (selectedInventory.atribuicoes || []).find(
                              (a: any) => a.grupoId === selectedFichaGroup
                            );
                            const isSheetLocked = activeAttrib && (
                              activeAttrib.status === 'Aguardando Coordenador' || 
                              activeAttrib.status === 'Concluída'
                            );

                            return groupFilteredItems.map((item) => {
                              // Retrieve already recorded count for this operator, fallback to optimistic
                              let savedCountVal: number | undefined = optimisticCounted[item.id];
                              if (savedCountVal === undefined) {
                                if (item.contagemAtualAtiva === 1) savedCountVal = item.contagem1;
                                else if (item.contagemAtualAtiva === 2) savedCountVal = item.contagem2;
                                else if (item.contagemAtualAtiva === 3) savedCountVal = item.contagem3;
                                else if (item.contagemAtualAtiva === 4) savedCountVal = item.contagemFinal;
                              }

                              const isWritable = isItemWritableForAlmoxarife(item) && !isSheetLocked && savedCountVal === undefined;

                              return (
                                <div key={item.id} className={`p-4.5 rounded-[22px] shadow-3xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all border ${
                                  isWritable ? 'bg-white border-slate-205 hover:border-slate-300' : 'bg-slate-50/50 border-slate-200/80 text-slate-500'
                                }`}>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        item.statusContagem === 'Sucesso' 
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                          : 'bg-indigo-50 text-indigo-700 border border-indigo-150'
                                      }`}>
                                        Fase: Contagem {item.contagemAtualAtiva}
                                      </span>
                                      {savedCountVal !== undefined && (
                                        <span className="inline-flex items-center gap-0.5 text-emerald-600 text-[10px] font-bold">
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Aferido</span>
                                        </span>
                                      )}
                                    </div>
                                    
                                    <h5 className="text-[13px] font-black text-slate-800 mt-2 flex flex-wrap items-center gap-1.5 uppercase leading-none">
                                      <span className="font-mono text-[#3a2573] bg-slate-50 px-2 py-0.5 border border-slate-150 rounded-lg">
                                        Cód: {item.codigo}{item.codigoAlternativo ? ` | Alt: ${item.codigoAlternativo}` : ''}
                                      </span>
                                      <span>—</span>
                                      <span>{item.descricao}</span>
                                    </h5>

                                    {item.cadastradoManualmente && (
                                      <p className="mt-2 text-left">
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                                          ⚠️ Item sem registro em estoque — Saldo: 0
                                        </span>
                                      </p>
                                    )}

                                    <p className="text-[10px] text-slate-450 mt-1.5 font-bold uppercase leading-none">
                                      Unidade do Sistema CMPC: {item.unidade}
                                    </p>
                                  </div>

                                  {/* Counting Confirmation Sector */}
                                  <div className="flex flex-col md:flex-row items-end md:items-center gap-3 w-full md:w-auto shrink-0 justify-end">
                                    {isWritable ? (
                                      <div className="flex flex-col items-end gap-2 w-full">
                                        {/* Dual verification fields for Round 4 */}
                                        {item.contagemAtualAtiva === 4 && (
                                          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/25 space-y-2 w-full md:max-w-xs text-left mb-1">
                                            <p className="text-[10px] text-amber-800 font-extrabold uppercase">
                                              ⚠️ Requer Segundo Conferente para Contagem Final
                                            </p>
                                            <div className="space-y-1">
                                              <select
                                                value={secondAlmoxarifeId[item.id] || ''}
                                                onChange={(e) => setSecondAlmoxarifeId({ ...secondAlmoxarifeId, [item.id]: e.target.value })}
                                                className="w-full text-[10px] p-2 bg-white border border-[#3a2573]/20 rounded-lg font-bold text-slate-705 outline-none"
                                              >
                                                <option value="">Selecione o Conferente...</option>
                                                {getMergedAlmoxarifes().filter(almox => almox.pin !== userProfile.pin).map(almox => (
                                                  <option key={almox.pin} value={almox.pin}>{almox.nome}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div className="space-y-1">
                                              <input
                                                type="password"
                                                maxLength={11}
                                                placeholder="PIN de Segurança do 2º Conferente"
                                                value={secondAlmoxarifePin[item.id] || ''}
                                                onChange={(e) => setSecondAlmoxarifePin({ ...secondAlmoxarifePin, [item.id]: e.target.value })}
                                                className="w-full text-[10px] p-2 bg-white border border-[#3a2573]/20 rounded-lg text-center font-mono font-bold text-slate-800 outline-none"
                                              />
                                            </div>
                                          </div>
                                        )}

                                        <div className="flex gap-1.5 justify-end w-full">
                                          <input
                                            type="number"
                                            min="0"
                                            required
                                            placeholder="Qtd."
                                            value={activeQuantities[item.id] || ''}
                                            onChange={(e) => {
                                              setActiveQuantities({ ...activeQuantities, [item.id]: e.target.value });
                                              setManuallyTyped({ ...manuallyTyped, [item.id]: true });
                                            }}
                                            className="w-20 text-xs p-2.5 bg-slate-50 border border-slate-350 rounded-xl text-center font-mono font-bold text-slate-850 focus:bg-white focus:border-[#3a2573]"
                                          />
                                          <button
                                            onClick={() => handleConfirmCount(item)}
                                            disabled={submittingCountId === item.id}
                                            className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-3xs flex items-center justify-center shrink-0 cursor-pointer"
                                          >
                                            {submittingCountId === item.id ? (
                                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <span>Confirmar</span>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-right">
                                        {(() => {
                                          const isFichaCompleted = (selectedInventory?.atribuicoes || []).find(
                                            (a: any) => a.grupoId === (item.grupo || 'Grupo Geral')
                                          )?.status === 'Concluída';

                                          return savedCountVal !== undefined ? (
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <input
                                                type="number"
                                                disabled
                                                value={savedCountVal}
                                                className="w-20 text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-center font-mono font-bold text-slate-400"
                                              />
                                              <div className="bg-emerald-50 text-emerald-700 border border-emerald-150 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1">
                                                <span>✅ Aferido</span>
                                              </div>
                                              {isFichaCompleted && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEditingPostConclusionItem(item);
                                                    setEditingPostConclusionFicha(item.grupo || 'Grupo Geral');
                                                    setAdminPinInput('');
                                                    setJustificationInput('');
                                                    setNewCountInput(savedCountVal !== undefined ? savedCountVal.toString() : '');
                                                    setPostConclusionError('');
                                                  }}
                                                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs flex items-center gap-1 shrink-0"
                                                >
                                                  <Edit2 className="w-3.5 h-3.5" />
                                                  <span>Editar</span>
                                                </button>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1.5">
                                              <div className="bg-slate-100 text-slate-400 border border-slate-200 px-3.5 py-2 rounded-xl text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                <Lock className="w-3.5 h-3.5" />
                                                <span>Concluído / Bloqueado</span>
                                              </div>
                                              {isFichaCompleted && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEditingPostConclusionItem(item);
                                                    setEditingPostConclusionFicha(item.grupo || 'Grupo Geral');
                                                    setAdminPinInput('');
                                                    setJustificationInput('');
                                                    setNewCountInput('0');
                                                    setPostConclusionError('');
                                                  }}
                                                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs flex items-center gap-1 shrink-0"
                                                >
                                                  <Edit2 className="w-3.5 h-3.5" />
                                                  <span>Editar</span>
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                  </div>
                                );
                              });
                            })()}
                        </div>

                        {/* Finalize Ficha Button - Displays once all user assignments are fully counted */}
                        {(() => {
                          const hasPendingVal = isFichaGroupCountPending(selectedFichaGroup);
                          const activeAttribObj = (selectedInventory.atribuicoes || []).find(
                            (a: any) => a.grupoId === selectedFichaGroup
                          );
                          const canFinalize = !hasPendingVal && activeAttribObj && (
                            activeAttribObj.status === 'Aberta' || 
                            activeAttribObj.status === 'Em contagem' || 
                            activeAttribObj.status === 'Em recontagem'
                          );

                          if (!canFinalize) return null;

                          return (
                            <div className="bg-white border border-slate-205 p-6 rounded-3xl shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                              <div className="text-center sm:text-left text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                                <p className="text-emerald-700 font-black">Preenchimento de todos os itens concluído!</p>
                                <p className="mt-0.5">Ao finalizar, os dados serão fechados e enviados para validação do Agente de Controladoria de Inventário.</p>
                              </div>

                              <button
                                onClick={() => handleFinalizeFicha(selectedFichaGroup)}
                                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                              >
                                <CheckSquare className="w-4 h-4" />
                                <span>Finalizar Ficha de Estoque</span>
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
 
                  </div>
                )}

                {/* 3B+C. REVISAR TAB (Coordenador reviews Fichas and schedules recount cycles) */}
                {currentTab === 'revisar' && userProfile.cargo === 'Coordenador' && (
                  <div className="space-y-6">
                    {selectedReviewGroup === null ? (
                      // 1. Grid of Fichas to Review
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-purple-50/25 p-5 border border-purple-150/50 rounded-3xl">
                          <div>
                            <h3 className="text-sm font-black text-[#3a2573] uppercase tracking-tight">Revisão de Fichas de Contagem</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                              Monitore a finalização das fichas pelos almoxarifes, lance saldos do sistema, identifique divergências e determine recontagens imediatamente.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={triggerPrintAll}
                            className="px-5 py-3 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-650 hover:to-indigo-750 text-white font-extrabold uppercase tracking-wider text-[10px] rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
                          >
                            <Printer className="w-4 h-4" />
                            <span>🖨️ Imprimir Todas as Fichas</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(() => {
                            const availableGroups = (Array.from(new Set(inventoryItems.map(i => i.grupo || 'Grupo Geral'))).sort()) as string[];
                            if (availableGroups.length === 0) {
                              return (
                                <div className="col-span-2 text-center py-12 bg-white border border-slate-200 rounded-[28px]">
                                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                  <p className="text-xs font-bold uppercase text-slate-400">Nenhum grupo de estoque identificado neste inventário</p>
                                </div>
                              );
                            }

                            return availableGroups.map(groupName => {
                              const attrib = (selectedInventory.atribuicoes || []).find((a: any) => a.grupoId === groupName);
                              const status = attrib?.status || 'Aberta';
                              const metrics = getGroupMetrics(groupName);

                              // Color schemas for statuses
                              let statusBadge = 'bg-slate-100 text-slate-600 border border-slate-200';
                              let statusText = 'Pendente';
                              if (status === 'Em contagem') {
                                statusBadge = 'bg-indigo-50 text-indigo-700 border border-indigo-200';
                                statusText = 'Em Contagem';
                              } else if (status === 'Aguardando Coordenador') {
                                statusBadge = 'bg-rose-50 text-rose-700 border border-rose-250 animate-pulse';
                                statusText = '⚠️ Aguarda Revisão';
                              } else if (status === 'Em recontagem') {
                                statusBadge = 'bg-cyan-50 text-cyan-700 border border-cyan-200';
                                statusText = 'Fase de Recontagem';
                              } else if (status === 'Concluída') {
                                statusBadge = 'bg-emerald-50 text-emerald-700 border border-emerald-250';
                                statusText = '✅ Concluída';
                              }

                              return (
                                <div 
                                  key={groupName}
                                  className="bg-white border border-slate-205 p-5 rounded-[24px] shadow-3xs flex flex-col justify-between hover:shadow-2xs hover:border-slate-300 transition-all"
                                >
                                  <div>
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black uppercase text-[#3a2573] tracking-wider leading-none">Ficha</span>
                                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${statusBadge}`}>
                                            {statusText}
                                          </span>
                                        </div>
                                        <h4 className="text-sm font-black text-slate-800 uppercase mt-2.5">{groupName}</h4>
                                      </div>
                                      
                                      <span className="text-[10.5px] font-mono font-bold text-[#3a2573] bg-purple-50 px-2.5 py-1 rounded-xl shrink-0">
                                        {metrics.progress}%
                                      </span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-bold uppercase">
                                      <div>Agente de Contagem original: <span className="text-slate-700 block font-black">{attrib?.almoxarifeNome || 'Não Alocado'}</span></div>
                                      {(attrib as any)?.finalizadaPor && (
                                        <div>Finalizada por: <span className="text-slate-700 block font-black">{(attrib as any).finalizadaPor}</span></div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-5 space-y-3 pt-3 border-t border-slate-100">
                                    <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-150">
                                      <div 
                                        className="h-full bg-gradient-to-r from-purple-500 to-emerald-550" 
                                        style={{ width: `${metrics.progress}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-black gap-2">
                                      <span>{metrics.counted} de {metrics.total} itens</span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => triggerPrintSingle(groupName)}
                                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-[#3a2573] border border-slate-205 rounded-xl font-extrabold uppercase transition-colors cursor-pointer flex items-center gap-1"
                                          title="Imprimir Ficha de Contagem"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                          <span>🖨️ Imprimir</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (status === 'Concluída') {
                                              setUnlockGroup(groupName);
                                              setUnlockPin('');
                                              setUnlockJustification('');
                                              setUnlockError('');
                                              setIsUnlockModalOpen(true);
                                            } else {
                                              setSelectedReviewGroup(groupName);
                                              // prefill system balances from database
                                              const balPre: { [key: string]: string } = {};
                                              inventoryItems.forEach(item => {
                                                if ((item.grupo || 'Grupo Geral') === groupName && item.saldoSistema !== undefined) {
                                                  balPre[item.id] = item.saldoSistema.toString();
                                                }
                                              });
                                              setReviewSystemBalances(prev => ({ ...prev, ...balPre }));
                                            }
                                          }}
                                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer ${
                                            status === 'Aguardando Coordenador' 
                                              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-3xs' 
                                              : status === 'Concluída'
                                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-3xs'
                                              : 'bg-slate-100 hover:bg-slate-200 text-[#3a2573] border border-slate-205'
                                          }`}
                                        >
                                          {status === 'Concluída' ? 'Reativar / Reabrir' : 'Revisar e Conciliar'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    ) : (
                      // 2. Specific Ficha Review Screen
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <button
                            type="button"
                            onClick={() => setSelectedReviewGroup(null)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-150 border border-slate-205 text-[#3a2573] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 self-start cursor-pointer shadow-3xs"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Voltar para Fichas</span>
                          </button>

                          <div className="text-right sm:text-left">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#3a2573] bg-purple-50 px-3.5 py-1.5 rounded-full border border-purple-150">
                              Revisando Ficha: {selectedReviewGroup}
                            </span>
                          </div>
                        </div>

                         {/* Items comparison block */}
                        <div className="space-y-4">
                          {(() => {
                            const isReviewFichaConcluded = (selectedInventory?.atribuicoes || []).find(
                              (a: any) => a.grupoId === selectedReviewGroup
                            )?.status === 'Concluída';

                            const groupItems = inventoryItems.filter(
                              item => (item.grupo || 'Grupo Geral') === selectedReviewGroup
                            );

                            if (groupItems.length === 0) {
                              return (
                                <div className="text-center py-10 bg-white border border-slate-150 rounded-2xl text-slate-450 uppercase font-black text-xs">
                                  Nenhum item localizado para este grupo de estoque
                                </div>
                              );
                            }

                            // Items that are divergent or non-concluded and need recount assignment
                            const itemsRequiringCount = groupItems.filter(item => {
                              const ledgerBalanceStr = reviewSystemBalances[item.id] !== undefined 
                                ? reviewSystemBalances[item.id] 
                                : (item.saldoSistema?.toString() || '');
                              const ledgerBalance = ledgerBalanceStr !== '' ? Number(ledgerBalanceStr) : NaN;
                              const decDecision = !isNaN(ledgerBalance)
                                ? calcularDecisaoCMPC(ledgerBalance, item.contagem1, item.contagem2, item.contagem3, item.contagemFinal)
                                : null;
                              return decDecision ? !decDecision.isConcluido : (item.statusContagem !== 'Sucesso');
                            });

                            const allDivergentSelected = itemsRequiringCount.length > 0 && itemsRequiringCount.every(item => selectedItemsForBulk.includes(item.id));

                            return (
                              <div className="space-y-4">
                                {itemsRequiringCount.length > 0 && !isReviewFichaConcluded && (
                                  <div className="bg-purple-900/[0.04] border border-[#3a2573]/20 p-5 rounded-[26px] space-y-4 shadow-3xs">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                      <div>
                                        <h4 className="text-xs font-black uppercase text-[#3a2573] tracking-wider flex items-center gap-2">
                                          <span>📋 Atribuição de Recontagem em Lote</span>
                                          <span className="text-[9px] bg-[#3a2573] text-white font-bold px-2 py-0.5 rounded-full select-none">
                                            {selectedItemsForBulk.length} de {itemsRequiringCount.length} selecionados
                                          </span>
                                        </h4>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">
                                          Selecione os itens abaixo para reatribuir em lote a um único Agente de Contagem.
                                        </p>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (allDivergentSelected) {
                                              setSelectedItemsForBulk([]);
                                            } else {
                                              setSelectedItemsForBulk(itemsRequiringCount.map(item => item.id));
                                            }
                                          }}
                                          className="px-3 py-2 bg-white border border-[#3a2573]/20 hover:bg-slate-50 text-[#3a2573] text-[9px] font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-3xs"
                                        >
                                          {allDivergentSelected ? '🗹 Desmarcar Todos' : '🗹 Selecionar Todos Divergentes'}
                                        </button>
                                      </div>
                                    </div>

                                    {selectedItemsForBulk.length > 0 && (
                                      <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-3xs animate-fadeIn">
                                        <div className="w-full sm:flex-1">
                                          <select
                                            value={bulkAssignee}
                                            onChange={(e) => setBulkAssignee(e.target.value)}
                                            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:border-[#3a2573] focus:bg-white"
                                          >
                                            <option value="">Atribuir Recontagem em Lote para...</option>
                                            {getMergedAlmoxarifes().map(almox => (
                                              <option key={almox.pin} value={almox.pin}>{almox.nome}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={bulkAssignLoading || !bulkAssignee}
                                          onClick={executeBulkAssignRecontagem}
                                          className="w-full sm:w-auto px-5 py-3 bg-[#3a2573] hover:bg-[#2e1d5c] disabled:bg-slate-250 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-3xs cursor-pointer flex items-center justify-center gap-2 font-bold"
                                        >
                                          {bulkAssignLoading ? (
                                            <>
                                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                              <span>Gravando...</span>
                                            </>
                                          ) : (
                                            <span>Confirmar Atribuição em Lote ({selectedItemsForBulk.length})</span>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {groupItems.map(item => {
                              // Identify reported count for the current active round
                              let reportedValue: number | undefined = undefined;
                              let lastOperator = '';
                              if (item.contagemAtualAtiva === 1) {
                                if (item.contagem1 !== undefined) {
                                  reportedValue = item.contagem1;
                                  lastOperator = item.contador1Nome || 'Pendente';
                                }
                              } else if (item.contagemAtualAtiva === 2) {
                                if (item.contagem2 !== undefined) {
                                  reportedValue = item.contagem2;
                                  lastOperator = item.contador2Nome || 'Pendente';
                                }
                              } else if (item.contagemAtualAtiva === 3) {
                                if (item.contagem3 !== undefined) {
                                  reportedValue = item.contagem3;
                                  lastOperator = item.contador3Nome || 'Pendente';
                                }
                              } else {
                                if (item.contagemFinal !== undefined) {
                                  reportedValue = item.contagemFinal;
                                  lastOperator = `${item.contadorFinal1Nome || 'Pendente'} & ${item.contadorFinal2Nome || ''}`;
                                }
                              }

                              // Interceptação e Binding de Dados no JSX (Supabase)
                              const contagemDoItem = contagensRealizadas.find(c => 
                                (c.codigo_item === item.codigo || c.codigo_item === item.id) && 
                                Number(c.fase_contagem) === (item.contagemAtualAtiva || 1)
                              ) || contagensRealizadas.find(c => (c.codigo_item === item.codigo || c.codigo_item === item.id));

                              const qtdFisica = contagemDoItem ? Number(contagemDoItem.quantidade) : (reportedValue !== undefined ? reportedValue : null);
                              const agenteNome = contagemDoItem?.agente_nome || lastOperator;

                              const ledgerBalanceStr = reviewSystemBalances[item.id] !== undefined 
                                ? reviewSystemBalances[item.id] 
                                : (item.saldoSistema?.toString() || '');
                                
                              const ledgerBalance = ledgerBalanceStr !== '' ? Number(ledgerBalanceStr) : NaN;
                              const saldoSistema = !isNaN(ledgerBalance) ? ledgerBalance : Number(item.saldoSistema || 0);

                              const desvio = qtdFisica !== null ? qtdFisica - saldoSistema : null;

                              const decDecision = !isNaN(ledgerBalance)
                                ? calcularDecisaoCMPC(ledgerBalance, item.contagem1, item.contagem2, item.contagem3, item.contagemFinal)
                                : null;

                              const isDivergent = decDecision ? decDecision.isDivergent : false;
                              const isConcluido = decDecision ? decDecision.isConcluido : (item.statusContagem === 'Sucesso');

                              // Filter available Almoxarifes for recounting, eliminating former counters (Blocking Rule)
                              const blockedOperatorPins = [item.contador1Id, item.contador2Id, item.contador3Id].filter(Boolean);
                              const availableReconters = getMergedAlmoxarifes().filter(
                                almox => !blockedOperatorPins.includes(almox.pin)
                              );

                              return (
                                <div 
                                  key={item.id} 
                                  className={`bg-white border p-5 rounded-[24px] shadow-3xs hover:shadow-2xs transition-all ${
                                    !isConcluido
                                      ? 'border-amber-250 bg-amber-50/5'
                                      : isDivergent 
                                      ? 'border-rose-250 bg-rose-50/15' 
                                      : 'border-emerald-200 bg-emerald-50/5'
                                  }`}
                                >
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Column 1: Info */}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {!isConcluido && !isReviewFichaConcluded && (
                                          <input
                                            type="checkbox"
                                            checked={selectedItemsForBulk.includes(item.id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedItemsForBulk(prev => [...prev, item.id]);
                                              } else {
                                                setSelectedItemsForBulk(prev => prev.filter(id => id !== item.id));
                                              }
                                            }}
                                            className="w-4 h-4 cursor-pointer accent-[#3a2573] border-slate-350 rounded transition-all mr-1.5 focus:ring-[#3a2573]"
                                            title="Selecionar para atribuição em lote"
                                          />
                                        )}
                                        <span className="font-mono text-[10px] font-black text-[#3a2573] bg-slate-100 px-2.5 py-0.5 border border-slate-200 rounded-lg">
                                          Cód: {item.codigo}{item.codigoAlternativo ? ` | Alt: ${item.codigoAlternativo}` : ''}
                                        </span>
                                        <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-150">
                                          Rodada de Contagem: {item.contagemAtualAtiva}
                                        </span>
                                        {isConcluido ? (
                                          <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-150">
                                            Concluído
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-150 animate-pulse">
                                            Recontagem Necessária (Rodada {decDecision?.nextRound})
                                          </span>
                                        )}
                                      </div>

                                      <h5 className="text-[13px] font-black text-slate-800 mt-2 uppercase">{item.descricao}</h5>
                                      
                                      {isSuspiciousItem(item) && (
                                        <p className="mt-1.5 flex items-center gap-2 flex-wrap animate-pulse">
                                          <span className="inline-flex items-center gap-1.5 text-[9.5px]/[14px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-300 px-2.5 py-1.5 rounded-xl shadow-xs">
                                            ⚠️ Contagem suspeita — valor automático detectado
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              let suspiciousRound = 1;
                                              let suspiciousValue = 0;
                                              let suspiciousOperator = '';
                                              if (item.contagem1 === 0 && (!item.contador1Nome || item.contador1Nome.toLowerCase().includes('pendente'))) {
                                                suspiciousRound = 1;
                                                suspiciousValue = item.contagem1;
                                                suspiciousOperator = item.contador1Nome || '';
                                              } else if (item.contagem2 === 0 && (!item.contador2Nome || item.contador2Nome.toLowerCase().includes('pendente'))) {
                                                suspiciousRound = 2;
                                                suspiciousValue = item.contagem2;
                                                suspiciousOperator = item.contador2Nome || '';
                                              } else if (item.contagem3 === 0 && (!item.contador3Nome || item.contador3Nome.toLowerCase().includes('pendente'))) {
                                                suspiciousRound = 3;
                                                suspiciousValue = item.contagem3;
                                                suspiciousOperator = item.contador3Nome || '';
                                              } else if (item.contagemFinal === 0 && (!item.contadorFinal1Nome || item.contadorFinal1Nome.toLowerCase().includes('pendente'))) {
                                                suspiciousRound = 4;
                                                suspiciousValue = item.contagemFinal;
                                                suspiciousOperator = item.contadorFinal1Nome || '';
                                              }
                                              
                                              iniciarReabertura(item, suspiciousRound, suspiciousValue, suspiciousOperator, '');
                                            }}
                                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[8.5px] font-black uppercase rounded-lg shadow-sm border border-rose-700 cursor-pointer"
                                          >
                                            ✏️ Estornar Valor Automático
                                          </button>
                                        </p>
                                      )}

                                      {item.suspeito && !isSuspiciousItem(item) && (
                                        <p className="mt-1.5">
                                          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
                                            ⚠️ CONTROLE DE FRAUDE CMPC: Esta contagem foi classificada como SUSPEITA de preenchimento automático. REVISÃO MANUAL OBRIGATÓRIA.
                                          </span>
                                        </p>
                                      )}

                                      <div className="mt-3.5 space-y-1.5 text-[10px] text-slate-500 font-bold uppercase">
                                        <p>Unidade do Sistema: <span className="text-slate-700 font-black">{item.unidade}</span></p>
                                        <div className="text-sm my-1">
                                          <span className="text-gray-500 font-semibold">ÚLTIMA AFERIÇÃO FÍSICA: </span>
                                          {qtdFisica !== null ? (
                                            <span className="text-blue-700 font-bold">{qtdFisica} UN (por {agenteNome || 'Agente'})</span>
                                          ) : (
                                            <span className="text-gray-400 font-bold">NÃO AFERIDO</span>
                                          )}
                                        </div>
                                        
                                        {/* History of rounds tracker */}
                                        <div className="bg-slate-50/60 p-2.5 rounded-xl flex flex-wrap items-center gap-3.5 pt-1 mt-2 text-[9.5px]">
                                          {item.contagem1 !== undefined && (
                                            <div className="flex items-center gap-1">
                                              <span>1ª Contagem: <span className="text-slate-700 font-black">{item.contagem1}</span> ({item.contador1Nome})</span>
                                              <button
                                                type="button"
                                                title="✏️ Reabrir esta contagem"
                                                onClick={() => iniciarReabertura(item, 1, item.contagem1, item.contador1Nome, item.contador1Id)}
                                                className="text-slate-450 hover:text-rose-600 font-mono transition-transform duration-205 active:scale-95 ml-1 select-none pr-1 cursor-pointer font-bold shrink-0 text-[10px]"
                                              >
                                                ✏️
                                              </button>
                                            </div>
                                          )}
                                          {item.contagem2 !== undefined && (
                                            <div className="border-l border-slate-200 pl-3 flex items-center gap-1">
                                              <span>2ª Contagem: <span className="text-slate-700 font-black">{item.contagem2}</span> ({item.contador2Nome})</span>
                                              <button
                                                type="button"
                                                title="✏️ Reabrir esta contagem"
                                                onClick={() => iniciarReabertura(item, 2, item.contagem2, item.contador2Nome, item.contador2Id)}
                                                className="text-slate-450 hover:text-rose-600 font-mono transition-transform duration-205 active:scale-95 ml-1 select-none pr-1 cursor-pointer font-bold shrink-0 text-[10px]"
                                              >
                                                ✏️
                                              </button>
                                            </div>
                                          )}
                                          {item.contagem3 !== undefined && (
                                            <div className="border-l border-slate-200 pl-3 flex items-center gap-1">
                                              <span>3ª Contagem: <span className="text-slate-700 font-black">{item.contagem3}</span> ({item.contador3Nome})</span>
                                              <button
                                                type="button"
                                                title="✏️ Reabrir esta contagem"
                                                onClick={() => iniciarReabertura(item, 3, item.contagem3, item.contador3Nome, item.contador3Id)}
                                                className="text-slate-450 hover:text-rose-600 font-mono transition-transform duration-205 active:scale-95 ml-1 select-none pr-1 cursor-pointer font-bold shrink-0 text-[10px]"
                                              >
                                                ✏️
                                              </button>
                                            </div>
                                          )}
                                          {item.contagemFinal !== undefined && (
                                            <div className="border-l border-slate-200 pl-3 flex items-center gap-1">
                                              <span>Contagem Final: <span className="text-slate-700 font-black">{item.contagemFinal}</span> (Conjunta)</span>
                                              <button
                                                type="button"
                                                title="✏️ Reabrir esta contagem"
                                                onClick={() => iniciarReabertura(item, 4, item.contagemFinal, 'Conjunta / Final', item.contadorFinal1Id)}
                                                className="text-slate-450 hover:text-rose-600 font-mono transition-transform duration-205 active:scale-95 ml-1 select-none pr-1 cursor-pointer font-bold shrink-0 text-[10px]"
                                              >
                                                ✏️
                                              </button>
                                            </div>
                                          )}
                                        </div>

                                        {/* Highlight CMPC confirmation by repetition */}
                                        {decDecision && decDecision.isConcluido && decDecision.rodadaConfirmacao !== null && decDecision.rodadaConfirmacao > 1 && (
                                          <div className="mt-2 text-[#059669] bg-emerald-50 border border-emerald-150 p-2 rounded-xl flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
                                            <span>
                                              <strong>✅ Confirmado por Repetição de Valor:</strong> {decDecision.confirmedValue} {item.unidade} na {decDecision.rodadaConfirmacao}ª rodada.
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Column 2: Inputs & Calculations */}
                                    <div className="flex flex-col gap-3 min-w-[240px] md:w-80 shrink-0">
                                      {/* System Balance input */}
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wide block">Saldo Fiscal do Sistema (MEGA):</label>
                                        <input
                                          type="number"
                                          placeholder="Aguardando saldo"
                                          disabled={true}
                                          value={ledgerBalanceStr}
                                          className="w-full text-xs p-2 bg-slate-100 border border-slate-300 rounded-xl font-mono font-black text-slate-800 outline-none select-none cursor-not-allowed"
                                        />
                                      </div>

                                      {/* Disparity outcome visualizer */}
                                      <div className={`p-2.5 rounded-xl text-[10px] font-bold uppercase flex justify-between items-center ${
                                        qtdFisica === null 
                                          ? 'bg-slate-50 text-slate-500 border border-slate-200' 
                                          : desvio === 0 
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                          : 'bg-rose-50 text-rose-700 border border-rose-150'
                                      }`}>
                                        <span>Status / Desvio da Decisão:</span>
                                        <span className="font-mono font-black text-xs text-right">
                                          {qtdFisica === null ? (
                                            <span className="text-gray-500 font-bold">Aguardando contagem...</span>
                                          ) : desvio === 0 ? (
                                            <span className="text-green-600 font-bold">DIFERENÇA ZERO (OK)</span>
                                          ) : (
                                            <span className="text-red-600 font-bold">DESVIO: {desvio !== null && desvio > 0 ? `+${desvio}` : desvio} UN</span>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Escalation planning for persistent divergence lines */}
                                  {decDecision && !decDecision.isConcluido && (
                                    <div className="mt-4 pt-4 border-t border-dashed border-slate-200/60 space-y-3">
                                      <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/50 space-y-3">
                                        <h6 className="text-[11px] font-black text-[#3a2573] uppercase tracking-wider flex items-center gap-1">
                                          <AlertCircle className="w-4 h-4 text-[#a855f7]" />
                                          <span>Sinalização de Recontagem — Rodada {decDecision.nextRound}</span>
                                        </h6>
                                        <p className="text-[10px] text-slate-500 font-semibold uppercase leading-tight">
                                          O procedimento CMPC-PRO-0093 exige recontagem por um Agente de Contagem diferente de todas as rodadas passadas.
                                        </p>

                                        <div className="space-y-1 w-full max-w-sm mt-2">
                                          <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-wide block">Atribuir Recontagem {decDecision.nextRound} para:</label>
                                          <select
                                            value={reviewAssignments[item.id] || ''}
                                            onChange={(e) => setReviewAssignments({ ...reviewAssignments, [item.id]: e.target.value })}
                                            className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 focus:border-[#3a2573] outline-none"
                                          >
                                            <option value="">Selecione o Agente de Contagem...</option>
                                            {availableReconters.map(almox => (
                                              <option key={almox.pin} value={almox.pin}>{almox.nome}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {decDecision && decDecision.isPersistentDivergencia && (
                                    <div className="mt-4 pt-4 border-t border-dashed border-slate-200/60 space-y-3">
                                      {/* Round 4 Divergência Persistente: Investigative fields */}
                                      <div className="bg-amber-50/10 p-3.5 rounded-2xl border border-amber-200/50 space-y-3">
                                        <h6 className="text-[11px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                          <span>⚠️ Divergência Persistente — Investigação Necessária (Final)</span>
                                        </h6>
                                        <p className="text-[10px] text-amber-600/90 font-semibold uppercase leading-tight">
                                          Este item obteve divergências mesmo após recontagens sucessivas físicas e a Contagem Final em dupla. Digite a justificativa oficial e plano corretivo.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                          <div className="space-y-1">
                                            <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-wide block">Laudo e Resultado da Investigação Física:</label>
                                            <textarea
                                              rows={3}
                                              placeholder="Descreva o motivo encontrado para a divergência física..."
                                              value={reviewLaudoText[item.id] || ''}
                                              onChange={(e) => setReviewLaudoText({ ...reviewLaudoText, [item.id]: e.target.value })}
                                              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-semibold outline-none focus:border-[#3a2573]"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-wide block">Plano de Ação Corretiva do Estoque:</label>
                                            <textarea
                                              rows={3}
                                              placeholder="Descreva o plano de saneamento ou acerto fiscal exigido..."
                                              value={reviewPlanoText[item.id] || ''}
                                              onChange={(e) => setReviewPlanoText({ ...reviewPlanoText, [item.id]: e.target.value })}
                                              className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl font-semibold outline-none focus:border-[#3a2573]"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                        {/* Confirmation trigger */}
                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-205 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                          <div className="text-[11px] text-slate-500 font-bold uppercase tracking-tight text-center sm:text-left">
                            <p>Ao salvar, o sistema atualizará os saldos no banco de dados.</p>
                            <p className="text-[#3a2573] mt-1 font-black">As pendências selecionadas serão re-distribuídas ou consolidadas.</p>
                          </div>

                          <button
                            onClick={async () => {
                              // Perform transactional updates in Firebase
                              const groupItems = inventoryItems.filter(
                                item => (item.grupo || 'Grupo Geral') === selectedReviewGroup
                              );

                              // Validate system ledger balances inputs and CMPC flow
                              for (const item of groupItems) {
                                const balVal = reviewSystemBalances[item.id] !== undefined 
                                  ? reviewSystemBalances[item.id] 
                                  : (item.saldoSistema?.toString() || '');
                                  
                                if (balVal === undefined || balVal.trim() === '' || isNaN(Number(balVal))) {
                                  alert(`Insira um saldo do sistema válido para o item [${item.codigo}].`);
                                  return;
                                }

                                const ledgerBal = Number(balVal);
                                const dec = calcularDecisaoCMPC(ledgerBal, item.contagem1, item.contagem2, item.contagem3, item.contagemFinal);

                                if (!dec.isConcluido) {
                                  if (!reviewAssignments[item.id]) {
                                    alert(`Para o item divergente [${item.codigo}], você deve selecionar o Agente de Contagem para realizar a Contagem ${dec.nextRound}.`);
                                    return;
                                  }
                                } else if (dec.isPersistentDivergencia) {
                                  if (!reviewLaudoText[item.id]?.trim()) {
                                    alert(`O item [${item.codigo}] tem divergência persistente após Contagem Final. Descreva o Laudo de Investigação Física.`);
                                    return;
                                  }
                                  if (!reviewPlanoText[item.id]?.trim()) {
                                    alert(`O item [${item.codigo}] tem divergência persistente após Contagem Final. Descreva o Plano de Ação.`);
                                    return;
                                  }
                                }
                              }

                              setCreationLoading(true);
                              try {
                                let hasRecountsScheduled = false;

                                for (const item of groupItems) {
                                  const balVal = reviewSystemBalances[item.id] !== undefined
                                    ? Number(reviewSystemBalances[item.id])
                                    : (item.saldoSistema || 0);

                                  const dec = calcularDecisaoCMPC(balVal, item.contagem1, item.contagem2, item.contagem3, item.contagemFinal);


                                  if (dec.isConcluido) {
                                    const diff = (dec.confirmedValue || 0) - balVal;
                                    const updateData: any = {
                                      saldoSistema: balVal,
                                      desvioQtd: diff,
                                      desvioValor: diff * item.valorUnitario,
                                      statusContagem: 'Sucesso'
                                    };

                                    // If physical divergence is confirmed by repetition, register it on the item
                                    if (dec.isDivergent && dec.rodadaConfirmacao !== null && dec.rodadaConfirmacao !== 1) {
                                      updateData.registroConfirmacao = {
                                        itemId: item.id,
                                        saldoFisico: dec.confirmedValue,
                                        saldoSistema: balVal,
                                        divergencia: diff,
                                        rodadaConfirmacao: dec.rodadaConfirmacao,
                                        timestamp: new Date().toISOString()
                                      };
                                    }

                                    if (dec.isPersistentDivergencia) {
                                      updateData.resultadoInvestigacao = reviewLaudoText[item.id] || '';
                                      updateData.planoAcao = reviewPlanoText[item.id] || '';
                                      updateData.statusDivergencia = 'Investigar';
                                    } else if (dec.isDivergent) {
                                      updateData.statusDivergencia = 'Investigar';
                                    } else {
                                      updateData.statusDivergencia = 'Aprovado';
                                    }

                                    await updateSingleInventoryItem(item.id, updateData);
                                  } else {
                                    const nextOperatorPin = reviewAssignments[item.id];
                                    const mergedAlmoxarifes = getMergedAlmoxarifes();
                                    const matchedAlmox = mergedAlmoxarifes.find(a => a.pin === nextOperatorPin)!;

                                    hasRecountsScheduled = true;
                                    await updateSingleInventoryItem(item.id, {
                                      saldoSistema: balVal,
                                      contagemAtualAtiva: dec.nextRound,
                                      almoxarifeAtribuidoId: matchedAlmox.pin,
                                      almoxarifeAtribuidoNome: matchedAlmox.nome,
                                      statusContagem: 'Divergente'
                                    });
                                  }
                                }

                                // Update entire Group / Ficha Status in Main Inventory Document
                                const updatedAttribs = (selectedInventory.atribuicoes || []).map((a: any) => {
                                  if (a.grupoId === selectedReviewGroup) {
                                    return {
                                      ...a,
                                      status: hasRecountsScheduled ? 'Em recontagem' : 'Concluída',
                                      revisadaPor: userProfile.nome,
                                      timestampRevisada: new Date().toISOString()
                                    };
                                  }
                                  return a;
                                });

                                const updatedInv = { ...selectedInventory, atribuicoes: updatedAttribs };
                                await saveInventoryToSupabase(updatedInv);
                                setSelectedInventory(updatedInv);




                                await updateOverallInventoryProgress(selectedInventory.id);
                                setSelectedReviewGroup(null);
                                triggerToast(`Revisão da Ficha [${selectedReviewGroup}] registrada com sucesso!`);

                                logHubEvent({
                                  type: 'status_change' as any,
                                  itemName: `Revisão de Ficha ${selectedReviewGroup}`,
                                  valAnterior: 'Aguardando Coordenador',
                                  valNovo: hasRecountsScheduled ? 'Em recontagem' : 'Concluída'
                                } as any);

                              } catch (err) {
                                console.error(err);
                                toast.error("Falha ao salvar no Supabase: " + (err instanceof Error ? err.message : String(err)));
                              } finally {
                                setCreationLoading(false);
                              }
                            }}
                            disabled={creationLoading}
                            className="px-6 py-3 bg-[#3a2573] hover:bg-indigo-950 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-1.5 self-center shrink-0 cursor-pointer"
                          >
                            {creationLoading ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Salvar Revisão de Ficha</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3C. CONSOLIDAR TAB (Coordinator sets system balance and registers investigacao) */}
                {currentTab === 'consolidar' && userProfile.cargo === 'Coordenador' && (
                  <div className="space-y-6">
                    {((selectedInventory?.status === 'Encerrado' || selectedInventory?.status === 'CONCLUÍDO' || selectedInventory?.status === 'Concluído' || selectedInventory?.status === 'Finalizado') && consolidatedSnapshot && consolidatedSnapshot.length > 0) && (
                      <div className="bg-indigo-900 text-white p-4 rounded-3xl border border-indigo-700 flex items-center justify-between shadow-md font-sans">
                        <div className="flex items-center space-x-3 text-left">
                          <div className="p-2.5 bg-indigo-700 rounded-2xl">
                            <Lock className="w-5 h-5 text-indigo-200" />
                          </div>
                          <div>
                            <h5 className="text-xs font-black uppercase tracking-wider text-indigo-100">
                              CONSOLIDAÇÃO CONGELADA (SNAPSHOT CMPC SGI)
                            </h5>
                            <p className="text-[11px] text-indigo-200 font-medium leading-tight mt-0.5">
                              Inventário encerrado e assinado. Exibindo dados estáticos imutáveis carregados da tabela <code className="font-mono text-emerald-300">inventario_consolidacao_final</code>. Recálculo em tempo de execução bloqueado.
                            </p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0">
                          🔒 Snapshot Imutável
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Consolidação e Apuração de Variações de Estoque</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-none">
                          Preencha o saldo fiscal/sistema do MEGA e avalie planos de ação para divergências.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleBulkSimulateSystemBalance}
                          className="px-4 py-2 text-[10px] font-black uppercase tracking-wider bg-purple-55 text-cmpc-purple border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors cursor-pointer"
                        >
                          Simular Saldos do Sistema
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyExcelGridToClipboard}
                          className="px-4 py-2 text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-150 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>Copiar para Excel</span>
                        </button>
                      </div>
                    </div>

                    {(() => {
                      const sourceList = (
                        (selectedInventory?.status === 'Encerrado' || selectedInventory?.status === 'CONCLUÍDO' || selectedInventory?.status === 'Concluído' || selectedInventory?.status === 'Finalizado') && 
                        consolidatedSnapshot && 
                        consolidatedSnapshot.length > 0
                      ) ? consolidatedSnapshot : inventoryItems;

                      // Items with divergence are where physical count differs from system balance, or they have been treated
                      const itemsWithDivergenceTotal = sourceList.filter((item) => {
                        let qCounted = 0;
                        if (item.quantidadeConsolidada !== undefined) qCounted = item.quantidadeConsolidada;
                        else if (item.contagemFinal !== undefined) qCounted = item.contagemFinal;
                        else if (item.contagem3 !== undefined) qCounted = item.contagem3;
                        else if (item.contagem2 !== undefined) qCounted = item.contagem2;
                        else if (item.contagem1 !== undefined) qCounted = item.contagem1;

                        const ledger = item.saldoSistema || 0;
                        return Math.abs(qCounted - ledger) > 0.001 || item.statusTratativa === 'TRATADA';
                      });

                      const totalDivergences = itemsWithDivergenceTotal.length;
                      const totalTreated = itemsWithDivergenceTotal.filter(item => item.statusTratativa === 'TRATADA').length;
                      const totalPending = totalDivergences - totalTreated;

                      // Filter using the search queries too if typed
                      const itemsToShow = itemsWithDivergenceTotal.filter((item) => {
                        const raw = `${item.codigo} ${item.descricao} ${item.statusContagem}`.toLowerCase();
                        if (!raw.includes(searchQuery.toLowerCase())) return false;

                        // Show pending by default, show treated if the filter is toggled
                        if (item.statusTratativa === 'TRATADA') {
                          return showTreatedInConsolidacao;
                        }
                        return true;
                      });

                      return (
                        <div className="space-y-4">
                          {/* Counter header widget */}
                          <div className="bg-white p-4 rounded-3xl border border-slate-205 flex flex-col md:flex-row items-center justify-between gap-4 shadow-3xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-3.5 py-1.5 bg-rose-50 text-rose-700 rounded-full border border-rose-150 text-[10px] font-black uppercase tracking-wider">
                                {totalDivergences} itens com divergência
                              </span>
                              <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-150 text-[10px] font-black uppercase tracking-wider">
                                {totalTreated} tratados
                              </span>
                              <span className="px-3.5 py-1.5 bg-amber-50 text-amber-700 rounded-full border border-amber-150 text-[10px] font-black uppercase tracking-wider">
                                {totalPending} pendentes
                              </span>

                              {totalPending === 0 && totalDivergences > 0 && (
                                <span className="bg-emerald-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-3xs">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Conclatado final do SGI</span>
                                </span>
                              )}
                            </div>

                            {totalPending === 0 && totalDivergences > 0 && (
                              <div className="bg-emerald-50 text-emerald-850 border border-emerald-250 p-2.5 px-4 rounded-xl text-[10.5px] font-black flex items-center gap-1.5 uppercase tracking-tight">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Todas as divergências foram tratadas — pronto para fechamento</span>
                              </div>
                            )}

                            <div>
                              <label className="flex items-center space-x-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={showTreatedInConsolidacao}
                                  onChange={(e) => setShowTreatedInConsolidacao(e.target.checked)}
                                  className="w-4 h-4 text-[#3a2573] focus:ring-[#3a2573] border-slate-300 rounded cursor-pointer"
                                />
                                <span>Exibir Itens já Tratados ({totalTreated})</span>
                              </label>
                            </div>
                          </div>

                          {itemsToShow.length === 0 ? (
                            <div className="text-center py-12 bg-white border border-slate-205 rounded-3xl p-6 shadow-3xs uppercase font-black text-xs text-slate-400">
                              {totalPending === 0 && totalDivergences > 0 
                                ? "✅ Todas as divergências deste inventário já foram tratadas!" 
                                : "Nenhum item pendente de tratamento localizado."}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {itemsToShow.map((item) => {
                                let qCounted = 0;
                                if (item.contagemFinal !== undefined) qCounted = item.contagemFinal;
                                else if (item.contagem3 !== undefined) qCounted = item.contagem3;
                                else if (item.contagem2 !== undefined) qCounted = item.contagem2;
                                else if (item.contagem1 !== undefined) qCounted = item.contagem1;

                                const diff = item.desvioQtd !== undefined ? item.desvioQtd : (qCounted - (item.saldoSistema || 0));
                                const hasDiff = Math.abs(diff) > 0.001;
                                const isItemTreated = item.statusTratativa === 'TRATADA';

                                return (
                                  <div key={item.id} className={`bg-white border rounded-[26px] p-5 shadow-3xs space-y-4 transition-all relative ${
                                    isItemTreated 
                                      ? 'border-emerald-300 bg-emerald-50/10 opacity-90' 
                                      : 'border-rose-300 bg-rose-50/20'
                                  }`}>
                                    {isItemTreated && (
                                      <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 z-10">
                                        <Lock className="w-3 h-3 text-emerald-600" />
                                        <span>✅ TRATADA e Bloqueada</span>
                                      </div>
                                    )}

                                    {/* Item summary info */}
                                    <div className="flex justify-between items-start flex-col sm:flex-row gap-3 pr-24">
                                      <div>
                                        <span className="font-mono font-bold text-[#3a2573] text-xs bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl">
                                          {item.codigo}
                                        </span>
                                        <h5 className="text-[13px] font-black text-slate-800 uppercase mt-2.5 leading-none">
                                          {item.descricao}
                                        </h5>
                                        <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase leading-none">
                                          Un. Físico: {item.unidade} (Custo Unitário: R$ {item.valorUnitario.toFixed(2)})
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                          item.contagem1 === undefined 
                                            ? 'bg-slate-100 text-slate-600 border border-slate-200' 
                                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        }`}>
                                          Contagem: {qCounted} {item.unidade}
                                        </span>
                                        
                                        {hasDiff && (
                                          <span className="text-[9px] font-black uppercase px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-750 rounded-full">
                                            🚨 Desvio: {diff} {item.unidade}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Consolidation values formulation */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                      <div>
                                        <label className="block text-[9.5px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                          Saldo Ledger Sistema (MEGA)
                                        </label>
                                        <input
                                          type="number"
                                          disabled={true}
                                          placeholder="Aguardando saldo"
                                          value={editingBal[item.id] !== undefined ? editingBal[item.id] : (item.saldoSistema?.toString() || '')}
                                          className="w-full text-xs p-2.5 bg-slate-100 border border-slate-300 rounded-xl font-mono text-center font-black text-slate-800 cursor-not-allowed select-none"
                                        />
                                      </div>

                                      <div className="md:col-span-2">
                                        <label className="block text-[9.5px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                          Laudo e Resultado da Investigação Física (Quem investigou, causa)
                                        </label>
                                        <input
                                          type="text"
                                          disabled={isItemTreated}
                                          placeholder="Ex: Divergência por recebimento não lançado..."
                                          value={editingInvestigacao[item.id] !== undefined ? editingInvestigacao[item.id] : (item.resultadoInvestigacao || '')}
                                          onChange={(e) => setEditingInvestigacao({ ...editingInvestigacao, [item.id]: e.target.value })}
                                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold disabled:bg-slate-100 disabled:opacity-75"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[9.5px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                          Plano de Ação Corretiva
                                        </label>
                                        <input
                                          type="text"
                                          disabled={isItemTreated}
                                          placeholder="Ex: Emitir NF para o fornecedor..."
                                          value={editingPlano[item.id] !== undefined ? editingPlano[item.id] : (item.planoAcao || '')}
                                          onChange={(e) => setEditingPlano({ ...editingPlano, [item.id]: e.target.value })}
                                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold disabled:bg-slate-100 disabled:opacity-75"
                                        />
                                      </div>
                                    </div>

                                    {/* Action selector bottom card */}
                                    <div className="flex flex-wrap items-center justify-between gap-3.5 pt-2 border-t border-slate-100">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tratativa SGI:</span>
                                        
                                        {(['Aprovado', 'Investigar', 'Aguarda ajuste no MEGA', 'Pendente — Ajustar no próximo inventário geral'] as const).map((flag) => (
                                          <button
                                            key={flag}
                                            type="button"
                                            disabled={isItemTreated}
                                            onClick={() => handleUpdateDivergenciaFlag(item, flag)}
                                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                              item.statusDivergencia === flag
                                                ? flag === 'Pendente — Ajustar no próximo inventário geral'
                                                  ? 'bg-rose-600 border-rose-600 text-white font-bold'
                                                  : 'bg-[#3a2573] border-[#3a2573] text-white font-bold'
                                                : flag === 'Pendente — Ajustar no próximo inventário geral'
                                                  ? 'bg-rose-50/60 border-rose-200 text-rose-700 hover:bg-rose-100'
                                                  : 'bg-white border-slate-205 text-slate-500 hover:bg-slate-50'
                                            }`}
                                          >
                                            {flag}
                                          </button>
                                        ))}
                                      </div>

                                      <button
                                        type="button"
                                        disabled={isItemTreated}
                                        onClick={() => handleSaveConsolidadoItem(item)}
                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl shadow-xs transition-all ${
                                          isItemTreated 
                                            ? 'bg-emerald-600 text-white cursor-not-allowed opacity-90' 
                                            : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                                        }`}
                                      >
                                        {isItemTreated ? '✅ TRATADA' : 'Salvar Tratativa'}
                                      </button>
                                    </div>

                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 3D. HIGH-FIDELITY CLOSING REPORT CMPC-FOR-0243 / CMPC-FOR-0244 (Signatures and lockdown) */}
                {currentTab === 'fechamento' && (userProfile.cargo === 'Coordenador' || userProfile.cargo === 'Auditor') && (
                  <div className="space-y-6">
                    
                    {/* Official printed representation form area */}
                    <div className="bg-white border-2 border-slate-300 p-6 md:p-8 rounded-[24px] max-w-4xl mx-auto shadow-md font-serif text-slate-950/90 relative print:border-none print:shadow-none print:p-0" id="official-cmpc-form-view">
                      
                      {/* Document stamp indicator */}
                      <div className="absolute top-4 right-4 text-slate-500 font-mono text-[9px] font-bold text-right print:top-2 print:right-2">
                        {selectedInventory.tipo === 'Parcial' || selectedInventory.tipo === 'Cíclico' ? 'Formulário CMPC-FOR-0244' : 'Formulário CMPC-FOR-0243'}
                      </div>

                      {/* Header Layout */}
                      <div className="flex items-center justify-between pb-4 border-b border-black md:flex-row flex-col gap-3">
                        <div className="text-center md:text-left">
                          <h3 className="font-sans font-black tracking-widest text-[#2b1b58] text-base leading-none uppercase">CMPC</h3>
                          <p className="font-sans text-[9px] font-black text-slate-500 uppercase tracking-wider mt-1.5 leading-none">CMPC Industrial</p>
                        </div>
                        <div className="text-center md:text-right border-t border-black md:border-none pt-2 md:pt-0">
                          <h3 className="font-sans font-black text-xs uppercase tracking-widest text-slate-800">
                            RELATÓRIO EMITIDO DE FECHAMENTO FISCAL DE INVENTÁRIO ({selectedInventory.tipo})
                          </h3>
                          <p className="font-sans text-[9px] text-slate-500 mt-1 font-bold">Unidade Industrial São Luís - MA | Almoxarifados</p>
                        </div>
                      </div>

                      {/* Info Sector Table */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 font-sans text-[11px] py-4 border-b border-black">
                        <div>
                          <p className="text-[9px] uppercase font-black text-slate-400">DATA FECHAMENTO</p>
                          <p className="font-semibold text-slate-850 mt-0.5">{new Date().toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-black text-slate-400">TIPO DE AUDITORIA</p>
                          <p className="font-semibold text-slate-850 mt-0.5 uppercase">{selectedInventory.tipo}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-black text-slate-400">COORDENADOR SGI</p>
                          <p className="font-semibold text-slate-850 mt-0.5">{selectedInventory.responsavel}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-black text-slate-400">STATUS OPERACIONAL</p>
                          <p className="font-semibold text-slate-850 mt-0.5 uppercase">{selectedInventory.status}</p>
                        </div>
                      </div>

                      {selectedInventory.tipo === 'Parcial' || selectedInventory.tipo === 'Cíclico' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-sans text-[11px] py-3.5 border-b border-black bg-purple-50/25 px-2.5 rounded-lg my-1.5">
                          <div>
                            <p className="text-[9px] uppercase font-black text-purple-700">PERÍODO INICIAL DO INVENTÁRIO (CMPC-PRO-0093)</p>
                            <p className="font-extrabold text-slate-850 mt-0.5">
                              {selectedInventory.dataInicialPeriodo 
                                ? new Date(selectedInventory.dataInicialPeriodo + 'T12:00:00').toLocaleDateString('pt-BR') 
                                : 'Não Informado'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-black text-purple-700">PERÍODO FINAL DO INVENTÁRIO (CMPC-PRO-0093)</p>
                            <p className="font-extrabold text-slate-850 mt-0.5">
                              {selectedInventory.dataFinalPeriodo 
                                ? new Date(selectedInventory.dataFinalPeriodo + 'T12:00:00').toLocaleDateString('pt-BR') 
                                : 'Não Informado'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-black text-purple-700">DIRETRIZ PROCEDIMENTO REGULADOR</p>
                            <p className="font-extrabold text-slate-850 mt-0.5">CMPC-FOR-0244 - Auditoria de Divergências</p>
                          </div>
                        </div>
                      ) : null}

                      {/* Summary Metrics */}
                      <div className="py-6 border-b border-black whitespace-normal font-sans">
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-4">I. QUADRO RESUMO E PERCENTUAIS DE EFICIÊNCIA DE ESTOQUE</h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100/80">
                            <span className="text-[9px] font-black uppercase text-emerald-800 block pb-1">TOTAL CONFERIDO</span>
                            <span className="text-xl font-black text-emerald-950 font-mono">{calculateClosingMetrics().totalItens}</span>
                          </div>

                          <div className="bg-blue-50/45 p-3.5 rounded-xl border border-blue-100/80">
                            <span className="text-[9px] font-black uppercase text-blue-800 block pb-1">EM CONFORMIDADE</span>
                            <span className="text-xl font-black text-blue-950 font-mono">{calculateClosingMetrics().perfectItens}</span>
                          </div>

                          <div className="bg-rose-50/45 p-3.5 rounded-xl border border-rose-100/80">
                            <span className="text-[9px] font-black uppercase text-rose-800 block pb-1">COM DIVERGÊNCIA</span>
                            <span className="text-xl font-black text-rose-950 font-mono">{calculateClosingMetrics().itemsWithDeviation}</span>
                          </div>

                          <div className="bg-purple-50/45 p-3.5 rounded-xl border border-purple-100/80">
                            <span className="text-[9px] font-black uppercase text-purple-800 block pb-1">ACURACIDADE AUDITORIA</span>
                            <span className="text-xl font-black text-[#3a2573] font-mono">{calculateClosingMetrics().acuracidade}%</span>
                          </div>
                        </div>

                        <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <span className="text-slate-500 font-bold block">Valor fiscal total do Ledger de sistema:</span>
                            <span className="font-black text-slate-850 font-mono">R$ {calculateClosingMetrics().valorTotalEstoqueSistema?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-slate-500 font-bold block">Variação e desvio financeiro absoluto apurado:</span>
                            <span className="font-black text-rose-700 font-mono">R$ {calculateClosingMetrics().valorDivergenciaAbs?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Formal list of inventory items details */}
                      <div className="py-6 font-sans">
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-4">II. EXTRATO DE ITEM DETALHADO E PLANOS DE INVESTIGAÇÃO</h4>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[10.5px] border-collapse min-w-[650px]">
                            <thead>
                              <tr className="bg-slate-900 text-white border-b border-black font-bold uppercase tracking-wider">
                                <th className="py-2.5 px-3">CÓD.</th>
                                <th className="py-2.5 px-3">DESCRIÇÃO</th>
                                <th className="py-2.5 px-3 text-center">UN.</th>
                                <th className="py-2.5 px-2 text-center">FÍSICO</th>
                                <th className="py-2.5 px-2 text-center">SISTEMA</th>
                                <th className="py-2.5 px-2 text-center">DESVIO QTD</th>
                                <th className="py-2.5 px-3 text-right">DESVIO VALOR (R$)</th>
                                <th className="py-2.5 px-3 text-right">MIGRAÇÃO MEGA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inventoryItems.filter((i) => !i.cadastradoManualmente).map((item) => {
                                let qCounted = 0;
                                if (item.contagemFinal !== undefined) qCounted = item.contagemFinal;
                                else if (item.contagem3 !== undefined) qCounted = item.contagem3;
                                else if (item.contagem2 !== undefined) qCounted = item.contagem2;
                                else if (item.contagem1 !== undefined) qCounted = item.contagem1;

                                const ledger = item.saldoSistema || 0;
                                const diff = item.desvioQtd !== undefined ? item.desvioQtd : (qCounted - ledger);
                                const diffVal = item.desvioValor !== undefined ? item.desvioValor : (diff * item.valorUnitario);

                                return (
                                  <tr key={item.id} className="border-b border-slate-205 py-2 hover:bg-slate-50/70">
                                    <td className="py-2.5 px-3 font-bold text-slate-800 font-mono">{item.codigo}</td>
                                    <td className="py-2.5 px-3 lowercase text-slate-700 font-medium">
                                      <div>{item.descricao}</div>
                                      {item.resultadoInvestigacao && (
                                        <div className="text-[9px] text-indigo-700 font-mono mt-0.5">↳ Investigação: {item.resultadoInvestigacao}</div>
                                      )}
                                      {item.planoAcao && (
                                        <div className="text-[9px] text-emerald-700 font-mono">↳ Plano: {item.planoAcao}</div>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-center uppercase text-slate-400 font-bold">{item.unidade}</td>
                                    <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-705">{qCounted}</td>
                                    <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-500">{item.saldoSistema !== undefined ? item.saldoSistema : '-'}</td>
                                    <td className={`py-2.5 px-2 text-center font-mono font-bold ${diff !== 0 ? 'text-rose-600' : 'text-slate-700'}`}>{diff}</td>
                                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${diffVal !== 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                                      R$ {diffVal.toFixed(2)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <span className="text-[8.5px] font-black uppercase text-slate-600">
                                        {item.statusDivergencia || 'Pendente'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* ITENS CADASTRADOS MANUALMENTE POR AUSÊNCIA NA BASE */}
                      {inventoryItems.some(i => i.cadastradoManualmente) && (
                        <div className="border-t-2 border-black pt-4 font-sans mt-4">
                          <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider mb-3">
                            Itens cadastrados manualmente por ausência na base
                          </h4>
                          <div className="overflow-x-auto border border-amber-200 rounded-xl bg-amber-50/10 p-3">
                            <table className="w-full text-left text-[10px] border-collapse min-w-[650px]">
                              <thead>
                                <tr className="border-b border-amber-300 text-amber-800 font-extrabold uppercase">
                                  <th className="py-2 px-2 font-mono">CÓD.</th>
                                  <th className="py-2 px-2">DESCRIÇÃO</th>
                                  <th className="py-2 px-2 text-center">UN.</th>
                                  <th className="py-2 px-2 text-center">FÍSICO</th>
                                  <th className="py-2 px-2 text-center">SISTEMA</th>
                                  <th className="py-2 px-2 text-right">VALOR UNITÁRIO (R$)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inventoryItems.filter(i => i.cadastradoManualmente).map((item) => {
                                  let qCounted = 0;
                                  if (item.contagemFinal !== undefined) qCounted = item.contagemFinal;
                                  else if (item.contagem3 !== undefined) qCounted = item.contagem3;
                                  else if (item.contagem2 !== undefined) qCounted = item.contagem2;
                                  else if (item.contagem1 !== undefined) qCounted = item.contagem1;
                                  
                                  return (
                                    <tr key={item.id} className="border-b border-amber-100 text-slate-800">
                                      <td className="py-2.5 px-2 font-bold font-mono text-amber-900">{item.codigo}</td>
                                      <td className="py-2.5 px-2">{item.descricao}</td>
                                      <td className="py-2.5 px-2 text-center uppercase text-slate-500 font-bold">{item.unidade}</td>
                                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-705">{qCounted}</td>
                                      <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-600">0 (Fixo)</td>
                                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-700">R$ {(item.valorUnitario || 0).toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* ALTERAÇÕES PÓS-CONCLUSÃO DE FICHAS */}
                      {postConclusionEdits.length > 0 && (
                        <div className="border-t border-black pt-4 font-sans mt-4">
                          <h4 className="text-[10.5px] font-black uppercase text-slate-800 tracking-wider mb-2">Alterações Pós-Conclusão</h4>
                          <div className="overflow-x-auto border border-slate-205 rounded-xl bg-slate-50/45 p-3">
                            <table className="w-full text-left text-[9.5px]">
                              <thead>
                                <tr className="border-b border-slate-300 text-slate-500 font-extrabold uppercase">
                                  <th className="pb-1 px-2">Data/Hora</th>
                                  <th className="pb-1 px-2">Item</th>
                                  <th className="pb-1 px-2">Ficha (Grupo)</th>
                                  <th className="pb-1 px-2 text-center">Novo Físico</th>
                                  <th className="pb-1 px-2">Autorizador (PIN)</th>
                                  <th className="pb-1 px-2 w-1/3">Justificativa Obrigatória de Segurança</th>
                                </tr>
                              </thead>
                              <tbody>
                                {postConclusionEdits.map((edit) => (
                                  <tr key={edit.id} className="border-b border-slate-200/60 text-slate-705">
                                    <td className="py-2 px-2 font-mono whitespace-nowrap">{new Date(edit.timestamp).toLocaleString('pt-BR')}</td>
                                    <td className="py-2 px-2 font-bold font-mono">
                                      {edit.codigo} <span className="font-normal font-sans text-slate-500">({edit.descricao})</span>
                                    </td>
                                    <td className="py-2 px-2 font-semibold uppercase">{edit.fichaId || 'N/A'}</td>
                                    <td className="py-2 px-2 text-center font-mono font-bold text-[#3a2573]">{edit.newCount}</td>
                                    <td className="py-2 px-2 whitespace-nowrap font-semibold">
                                      {edit.operadorNome || 'Coordenador'} <span className="text-slate-400 font-mono">(*{edit.pin?.slice(-2)})</span>
                                    </td>
                                    <td className="py-2 px-2 italic text-rose-850 font-medium leading-snug">
                                      &ldquo;{edit.justificativa}&rdquo;
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* ALTERAÇÕES DE RESPONSÁVEL (Requirement 3) */}
                      {(() => {
                        const filteredAlteracoes = reassignLogs.filter(log => log.inventarioId === selectedInventory.id);
                        if (filteredAlteracoes.length === 0) return null;
                        return (
                          <div className="border-t border-black pt-4 font-sans mt-4">
                            <h4 className="text-[10.5px] font-black uppercase text-slate-800 tracking-wider mb-2">Alterações de Responsável</h4>
                            <div className="overflow-x-auto border border-slate-205 rounded-xl bg-slate-50/45 p-3">
                              <table className="w-full text-left text-[9.5px]">
                                <thead>
                                  <tr className="border-b border-slate-300 text-slate-500 font-extrabold uppercase">
                                    <th className="pb-1 px-2">Data/Hora</th>
                                    <th className="pb-1 px-2">Ficha (Grupo)</th>
                                    <th className="pb-1 px-2">Contador Anterior</th>
                                    <th className="pb-1 px-2">Novo Contador</th>
                                    <th className="pb-1 px-2">Alterado Por</th>
                                    <th className="pb-1 px-2 w-1/3">Motivo / Justificativa de Segurança</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredAlteracoes.map((log) => (
                                    <tr key={log.id} className="border-b border-slate-200/60 text-slate-705">
                                      <td className="py-2 px-2 font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                                      <td className="py-2 px-2 font-bold uppercase">{log.fichaId}</td>
                                      <td className="py-2 px-2 font-semibold text-slate-500">{log.contadorAnterior}</td>
                                      <td className="py-2 px-2 font-black text-[#3a2573]">{log.novoContador}</td>
                                      <td className="py-2 px-2 font-semibold">{log.alteradoPor}</td>
                                      <td className="py-2 px-2 italic text-[#5e718d] font-medium leading-snug">
                                        &ldquo;{log.motivo}&rdquo;
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      {/* REABERTURAS AUTORIZADAS (Requirement 4) */}
                      {(() => {
                        const filteredReaberturas = reopenLogs.filter(log => log.inventarioId === selectedInventory.id);
                        if (filteredReaberturas.length === 0) return null;
                        return (
                          <div className="border-t border-black pt-4 font-sans mt-4">
                            <h4 className="text-[10.5px] font-black uppercase text-slate-800 tracking-wider mb-2">Reaberturas Autorizadas</h4>
                            <div className="overflow-x-auto border border-slate-205 rounded-xl bg-slate-50/45 p-3">
                              <table className="w-full text-left text-[9.5px]">
                                <thead>
                                  <tr className="border-b border-slate-300 text-slate-500 font-extrabold uppercase">
                                    <th className="pb-1 px-2">Data/Hora</th>
                                    <th className="pb-1 px-2">Ficha (Grupo)</th>
                                    <th className="pb-1 px-2">Autorizador (PIN)</th>
                                    <th className="pb-1 px-2 w-1/2">Justificativa Gerencial Obrigatória</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredReaberturas.map((log) => (
                                    <tr key={log.id} className="border-b border-slate-200/60 text-slate-705">
                                      <td className="py-2 px-2 font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                                      <td className="py-2 px-2 font-bold uppercase">{log.fichaId}</td>
                                      <td className="py-2 px-2 font-semibold font-mono text-[#3a2573]">(*{log.pin?.slice(-2)})</td>
                                      <td className="py-2 px-2 italic text-rose-850 font-medium leading-snug">
                                        &ldquo;{log.justificativa}&rdquo;
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      {/* III. CORRESPONDING NOTES & OBSERVATIONS GROUP */}
                      <div className="border-t border-black pt-4 font-sans mt-4">
                        <h4 className="text-[10.5px] font-black uppercase text-slate-800 tracking-wider mb-2">III. OBSERVAÇÕES E NOTAS DA GERÊNCIA SGI (CMPC-FOR-0244)</h4>
                        {selectedInventory.status === 'Encerrado' ? (
                          <div className="text-[11px] text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-h-[44px] italic whitespace-pre-wrap font-serif leading-relaxed">
                            {selectedInventory.observacoes || 'Nenhuma observação reportada pelo comitê de auditoria sgi.'}
                          </div>
                        ) : (
                          <div className="text-[11px] text-purple-700 bg-purple-50/40 p-3.5 rounded-xl border border-purple-150 min-h-[44px] italic leading-relaxed">
                            {closingObservations ? closingObservations : 'Escreva as observações no formulário de fechamento no painel inferior para fixá-las neste relatório impresso.'}
                          </div>
                        )}
                      </div>

                      {/* Final legal liability terms and digital signatures layout */}
                      <div className="border-t-2 border-black pt-6 font-sans">
                        <p className="text-[10px] text-slate-500 leading-normal mb-8">
                          Declaramos para os devidos fins de auditoria que os materiais listados sob esta planilha fisíca de estoque foram auditados, contados e validados em lote de forma conforme à norma CMPC-PRO-0093, mantendo rastreabilidade e imutabilidade registradas na nuvem corporativa.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                          <div className="flex flex-col items-center">
                            <div className="w-64 border-b border-black py-4 font-mono text-[10.5px] text-slate-700">
                              {selectedInventory.status === 'Encerrado' ? (
                                <div className="text-emerald-700 flex flex-col items-center">
                                  <span className="font-bold tracking-widest text-[9px] bg-emerald-50 px-2 py-0.5 border border-emerald-200 rounded">ASSINADO DIGITALMENTE</span>
                                  <span className="font-sans font-extrabold text-[12px] uppercase mt-2">{selectedInventory.responsavel}</span>
                                </div>
                              ) : (
                                <span className="opacity-0">-</span>
                              )}
                            </div>
                            <p className="text-[9.5px] font-black uppercase mt-1">Agente de Controladoria de Inventário</p>
                          </div>

                          <div className="flex flex-col items-center">
                            <div className="w-64 border-b border-black py-4 font-mono text-[10.5px] text-slate-700">
                              {selectedInventory.status === 'Encerrado' ? (
                                <div className="text-emerald-700 flex flex-col items-center">
                                  <span className="font-bold tracking-widest text-[9px] bg-emerald-50 px-2 py-0.5 border border-emerald-200 rounded">ASSINADO DIGITALMENTE</span>
                                  <span className="font-sans font-extrabold text-[12px] uppercase mt-2">Validação Fiscal / Controladoria</span>
                                </div>
                              ) : (
                                <span className="opacity-0">-</span>
                              )}
                            </div>
                            <p className="text-[9.5px] font-black uppercase mt-1">Validador / Controler Adjunco</p>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Signature Input Action (Only show if not locked/closed) */}
                    {selectedInventory.status !== 'Encerrado' ? (
                      userProfile.cargo === 'Coordenador' ? (
                        !showExecutiveSummary ? (
                          <div className="bg-[#3a2573]/5 border border-[#3a2573]/20 p-8 rounded-[28px] max-w-4xl mx-auto space-y-5 text-center shadow-xs">
                            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto text-[#3a2573]">
                              <FileText className="w-6 h-6 animate-pulse" />
                            </div>
                            <div className="max-w-md mx-auto space-y-1.5">
                              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">RESUMO EXECUTIVO PRÉ-FECHAMENTO</h4>
                              <p className="text-[11px] font-medium text-slate-500 leading-normal">
                                Para liberar a assinatura eletrônica e o encerramento definitivo do inventário sob regras da SGI CMPC (CMPC-PRO-0093), o Coordenador deve analisar de forma mandatória o Resumo Executivo na tela seguinte.
                              </p>
                            </div>
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowExecutiveSummary(true);
                                  window.scrollTo({ top: 400, behavior: 'smooth' });
                                }}
                                className="px-6 py-3.5 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-650 hover:to-indigo-750 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                              >
                                <span>📊 Analisar Resumo Executivo Pré-Fechamento</span>
                                <ArrowRight className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white border-2 border-indigo-150 p-6 md:p-8 rounded-[28px] max-w-4xl mx-auto space-y-6 shadow-lg">
                            {/* Executive Summary stats panel */}
                            <div className="border-b border-slate-100 pb-4">
                              <div className="flex items-center gap-2">
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-150 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">SGI CMPC • Relatório Geral</span>
                                <span className="text-slate-400 font-mono text-[9px] font-semibold">CMPC-PRO-0093</span>
                              </div>
                              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mt-1">SGI - Resumo Executivo de Inventário</h3>
                              <p className="text-[11px] text-slate-500 font-medium">Balanço geral consolidado do inventário regulador antes do encerramento permanente.</p>
                            </div>

                            {(() => {
                              const summaryMetrics = calculateClosingMetrics();

                              // Compute time total
                              const relevantCounts = allCounts.filter(c => c.inventarioId === selectedInventory.id);
                              const relevantTimestamps = relevantCounts.map(c => new Date(c.timestamp).getTime()).filter(t => !isNaN(t));
                              let minT = 0;
                              let maxT = 0;
                              let elapsedMs = 0;
                              if (relevantTimestamps.length > 0) {
                                minT = Math.min(...relevantTimestamps);
                                maxT = Math.max(...relevantTimestamps);
                                elapsedMs = maxT - minT;
                              }

                              let tempoTotalText = "Sem lançamentos";
                              if (elapsedMs > 0) {
                                const h = Math.floor(elapsedMs / 3600000);
                                const m = Math.floor((elapsedMs % 3600000) / 60000);
                                if (h > 0) {
                                  tempoTotalText = `${h}h ${m}min`;
                                } else {
                                  tempoTotalText = `${m} min`;
                                }
                              } else if (relevantTimestamps.length === 1) {
                                tempoTotalText = "1 min (Contagem única)";
                              }

                              const totalFichas = (selectedInventory.atribuicoes || []).length;
                              const concluídasFichas = (selectedInventory.atribuicoes || []).filter((a: any) => a.status === 'Concluída').length;
                              const totalItensContados = inventoryItems.filter(i => i.contagem1 !== undefined || i.contagem2 !== undefined || i.contagem3 !== undefined || i.contagemFinal !== undefined).length;
                              
                              const perfectItens = summaryMetrics.perfectItens;
                              const deviationItens = summaryMetrics.itemsWithDeviation;
                              const valueDivergenciaVal = summaryMetrics.valorDivergenciaAbs;
                              
                              const totalTreated = inventoryItems.filter(item => {
                                const qCounted = item.contagemFinal !== undefined ? item.contagemFinal : (item.contagem3 !== undefined ? item.contagem3 : (item.contagem2 !== undefined ? item.contagem2 : (item.contagem1 !== undefined ? item.contagem1 : 0)));
                                const ledger = item.saldoSistema || 0;
                                return Math.abs(qCounted - ledger) > 0.001 && item.statusTratativa === 'TRATADA';
                              }).length;

                              const totalMEGA = inventoryItems.filter(item => {
                                const qCounted = item.contagemFinal !== undefined ? item.contagemFinal : (item.contagem3 !== undefined ? item.contagem3 : (item.contagem2 !== undefined ? item.contagem2 : (item.contagem1 !== undefined ? item.contagem1 : 0)));
                                const ledger = item.saldoSistema || 0;
                                return Math.abs(qCounted - ledger) > 0.001 && item.statusDivergencia === 'Aguarda ajuste no MEGA';
                              }).length;

                              const manualCounted = inventoryItems.filter(i => i.cadastradoManualmente).length;
                              const reassignsCount = reassignLogs.filter(log => log.inventarioId === selectedInventory.id).length;
                              const reopensCount = reopenLogs.filter(log => log.inventarioId === selectedInventory.id).length;

                              const acuracidadeEstoque = totalItensContados > 0 ? Number(((perfectItens / totalItensContados) * 100).toFixed(1)) : 100;
                              const totalCountedVal = inventoryItems.reduce((acc, item) => {
                                let actualCountedVal = 0;
                                if (item.contagemFinal !== undefined) actualCountedVal = item.contagemFinal;
                                else if (item.contagem3 !== undefined) actualCountedVal = item.contagem3;
                                else if (item.contagem2 !== undefined) actualCountedVal = item.contagem2;
                                else if (item.contagem1 !== undefined) actualCountedVal = item.contagem1;
                                return acc + (actualCountedVal * (item.valorUnitario || 0));
                              }, 0);
                              const assertividadeEstoque = totalCountedVal > 0 ? Number((Math.max(0, 1 - (valueDivergenciaVal / totalCountedVal)) * 100).toFixed(1)) : 100;

                              return (
                                <div className="space-y-4 font-sans text-left">
                                  {/* Grid representation */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    {/* Card 1: Identificação */}
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between space-y-2">
                                      <span className="text-[7.5px] font-black text-slate-400 block uppercase leading-none tracking-widest">Identificação Geral</span>
                                      <div className="space-y-1 mt-1 text-[11px] font-bold text-slate-800 leading-normal">
                                        <p>Tipo: <span className="text-slate-600 block uppercase font-black text-[10px]">{selectedInventory.tipo}</span></p>
                                        <p className="pt-0.5">Data: <span className="text-slate-600 block text-[10px]">{selectedInventory.data ? new Date(selectedInventory.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</span></p>
                                        <p className="pt-0.5">Responsável: <span className="text-slate-600 block text-[10px] leading-tight truncate">{selectedInventory.responsavel}</span></p>
                                      </div>
                                    </div>

                                    {/* Card 2: Progresso */}
                                    <div className="bg-purple-50/45 border border-purple-100 p-4 rounded-2xl flex flex-col justify-between space-y-2">
                                      <span className="text-[7.5px] font-black text-purple-400 block uppercase leading-none tracking-widest">Fichas e Contagens</span>
                                      <div className="space-y-1.5 mt-1 text-[10.5px] font-bold text-slate-705 leading-tight">
                                        <p>Fichas: <span className="text-[#3a2573] font-black block text-[11px]">{concluídasFichas} concluídas / {totalFichas} total</span></p>
                                        <p>Itens Contados: <span className="text-[#3a2573] font-black block text-[11px]">{totalItensContados} contados</span></p>
                                        <p>Itens Manuais: <span className="text-[#3a2573] font-black block text-[11px]">{manualCounted} novos</span></p>
                                      </div>
                                    </div>

                                    {/* Card 3: Divergências */}
                                    <div className="bg-rose-50/30 border border-rose-100 p-4 rounded-2xl flex flex-col justify-between space-y-2">
                                      <span className="text-[7.5px] font-black text-rose-500 block uppercase leading-none tracking-widest">Divergências</span>
                                      <div className="space-y-1 mt-1 text-[10.5px] font-bold leading-tight text-slate-705">
                                        <p>Divergência Zero: <span className="text-emerald-700 font-extrabold block">✅ {perfectItens} (verde)</span></p>
                                        <p>Com Divergência: <span className="text-rose-700 font-extrabold block">🔴 {deviationItens} (vermelho)</span></p>
                                        <p>Tratadas: <span className="text-emerald-750 font-extrabold block">✅ {totalTreated} tratados</span></p>
                                        <p>Ajuste no MEGA: <span className="text-orange-600 font-extrabold block">⚠️ {totalMEGA} (laranja)</span></p>
                                      </div>
                                    </div>

                                    {/* Card 4: Qualidade */}
                                    <div className="bg-emerald-50/20 border border-emerald-100 p-4 rounded-2xl flex flex-col justify-between space-y-2">
                                      <span className="text-[7.5px] font-black text-emerald-500 block uppercase leading-none tracking-widest">Precisão Estoque</span>
                                      <div className="space-y-1.5 mt-1 text-[10.5px] font-bold text-slate-705 leading-tight">
                                        <p>Acuracidade: <span className="text-emerald-750 font-black block text-[13px]">{acuracidadeEstoque}%</span></p>
                                        <p>Assertividade: <span className="text-emerald-750 font-black block text-[13px]">{assertividadeEstoque}%</span></p>
                                        <p>Estoque Físico: <span className="text-slate-600 font-black block text-[10.5px] font-mono">R$ {totalCountedVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Bottom Details Horizontal Block */}
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 border border-slate-150 p-4 rounded-2xl text-[11px] leading-relaxed font-bold text-slate-650">
                                    <div>
                                      ⏱️ Tempo Total do Inventário:
                                      <span className="block text-slate-850 font-black font-mono text-[11.5px]">{tempoTotalText}</span>
                                    </div>
                                    <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4">
                                      🔄 Alterações de Responsável:
                                      <span className="block text-slate-850 font-black text-[11.5px]">{reassignsCount} registradas</span>
                                    </div>
                                    <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4">
                                      🔓 Reaberturas Autorizadas:
                                      <span className="block text-slate-850 font-black text-[11.5px]">{reopensCount} autorizadas</span>
                                    </div>
                                    <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4 text-rose-700">
                                      🔴 Total em Divergência:
                                      <span className="block font-black font-mono text-[11.5px]">R$ {valueDivergenciaVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Complete the form underneath the stats panel */}
                            <form onSubmit={handleFinalSignClosure} className="space-y-4 pt-4 border-t border-slate-100">
                              <h4 className="text-[10.5px] font-black uppercase text-[#3a2573] tracking-wider leading-none text-left">Assinar Termo de Fechamento Definitivo</h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                                <div>
                                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                    Nome Completo Assinante
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={closingName}
                                    onChange={(e) => setClosingName(e.target.value)}
                                    placeholder="Seu nome da credencial..."
                                    className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                    Cargo Funcional
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={closingCargo}
                                    onChange={(e) => setClosingCargo(e.target.value)}
                                    placeholder="Ex: Agente de Controladoria de Inventário"
                                    className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                    Data Assinatura
                                  </label>
                                  <input
                                    type="date"
                                    required
                                    value={closingDate}
                                    onChange={(e) => setClosingDate(e.target.value)}
                                    className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1.5 text-left">
                                <label className="block text-[10px] font-black uppercase text-slate-550 tracking-wider">
                                  Observações e Notas Finais de Auditoria SGI CMPC (CMPC-FOR-0244)
                                </label>
                                <textarea
                                  value={closingObservations}
                                  onChange={(e) => setClosingObservations(e.target.value)}
                                  placeholder="Digite observações finais para fixá-las neste relatório..."
                                  className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none focus:border-[#3a2573] h-20 placeholder-slate-400"
                                />
                              </div>

                              {(() => {
                                const untreatPendingCount = inventoryItems.filter((item) => {
                                  let qCounted = 0;
                                  if (item.contagemFinal !== undefined) qCounted = item.contagemFinal;
                                  else if (item.contagem3 !== undefined) qCounted = item.contagem3;
                                  else if (item.contagem2 !== undefined) qCounted = item.contagem2;
                                  else if (item.contagem1 !== undefined) qCounted = item.contagem1;

                                  const ledger = item.saldoSistema || 0;
                                  const hasDiff = Math.abs(qCounted - ledger) > 0.001;
                                  return hasDiff && item.statusTratativa !== 'TRATADA';
                                }).length;

                                const hasUntreatedDivergences = untreatPendingCount > 0;

                                return (
                                  <>
                                    {hasUntreatedDivergences ? (
                                      <div className="bg-rose-50 p-4 border border-rose-250 rounded-2xl flex items-start gap-3 text-left">
                                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
                                        <p className="text-[10.5px] text-rose-800 leading-normal font-sans font-extrabold uppercase tracking-tight">
                                          ⚠️ BLOQUEADO: Existem {untreatPendingCount} divergências pendentes de tratativa na aba Consolidação antes de assinar.
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="bg-amber-50 p-4 border border-amber-150 rounded-2xl flex items-start gap-3 text-left">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <p className="text-[10.5px] text-amber-700 leading-normal font-sans font-medium">
                                          ⚠️ ATENÇÃO: Ao assinar, o inventário será marcado como <span className="font-extrabold uppercase">&quot;Encerrado&quot;</span> de forma definitiva e imutável nas bases SGI CMPC.
                                        </p>
                                      </div>
                                    )}

                                    <div className="flex justify-between items-center pt-3 border-t border-slate-100 gap-4">
                                      <button
                                        type="button"
                                        onClick={() => setShowExecutiveSummary(false)}
                                        className="px-5 py-3 text-xs font-black bg-slate-100 hover:bg-slate-200 text-[#3a2573] border border-slate-205 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-3xs transition-colors"
                                      >
                                        <ArrowLeft className="w-4 h-4" />
                                        <span>⬅️ Voltar e Revisar</span>
                                      </button>

                                      <button
                                        type="submit"
                                        disabled={isSigning || hasUntreatedDivergences}
                                        className="px-6 py-3.5 text-xs font-black bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl shadow-md cursor-pointer disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shrink-0"
                                      >
                                        {isSigning ? (
                                          <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : hasUntreatedDivergences ? (
                                          <span>Pendências SGI pendentes</span>
                                        ) : (
                                          <span>✅ Confirmar e Assinar Fechamento</span>
                                        )}
                                      </button>
                                    </div>
                                  </>
                                );
                              })()}
                            </form>
                          </div>
                        )
                      ) : (
                        <div className="bg-amber-50 border border-amber-250 p-5 rounded-3xl max-w-4xl mx-auto flex items-center justify-between col-span-full">
                          <div className="flex items-center space-x-3 text-left">
                            <div className="p-3 bg-amber-600 text-white rounded-2xl animate-pulse">
                              <Clock className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">DRAFT / AGUARDANDO ASSINATURA</h4>
                              <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5">
                                Apenas o Agente de Controladoria de Inventário SGI CMPC possui permissão formal de conformidade para assinar e encerrar o inventário.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-5 py-3 text-xs font-black bg-white border border-slate-350 rounded-xl flex items-center gap-1.5 hover:bg-slate-50"
                          >
                            <Printer className="w-4 h-4 text-slate-500" />
                            <span>Visualizar Impressão</span>
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-3xl max-w-4xl mx-auto flex items-center justify-between col-span-full">
                        <div className="flex items-center space-x-3 text-left">
                          <div className="p-3 bg-[#3a2573] text-white rounded-2xl">
                            <Lock className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">DOCUMENTO ENCERADO E PROTEGIDO</h4>
                            <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5">
                              Este relatório de inventário já se encontra assinado eletronicamente e bloqueado para auditorias de sistema.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-5 py-3 text-xs font-black bg-white border border-slate-350 rounded-xl flex items-center gap-1.5 hover:bg-slate-50"
                        >
                          <Printer className="w-4 h-4 text-slate-500" />
                          <span>Imprimir / Salvar PDF</span>
                        </button>
                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

          </div>

        </main>
      )}

      {/* OVERLAY DIALOG: MANUAL REGISTER ITEMS FOR MISSING baseline / stock registries */}
      {isManualRegModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-[26px] border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
              <div>
                <span className="text-[9px] font-black uppercase bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2.5 py-1 rounded-md mb-1 inline-block">
                  ⚠️ Cadastro Manual de Item
                </span>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Material sem Registro em Estoque
                </h3>
              </div>
              <button 
                onClick={() => {
                  const nextQueue = unregisteredCodesQueue.filter(c => c !== manualRegCode);
                  setUnregisteredCodesQueue(nextQueue);
                  if (nextQueue.length > 0) {
                    setManualRegCode(nextQueue[0]);
                    setManualRegDesc('');
                    setManualRegValueUnitario('');
                    const defaultGrp = (importedItems.length > 0 && useImportedBaseline) 
                      ? (importedItems[0]?.grupo || 'Grupo Geral') 
                      : 'Grupo Geral';
                    setManualRegClass(defaultGrp);
                    setShowCustomClassInput(false);
                    setManualRegCustomClass('');
                  } else {
                    setIsManualRegModalOpen(false);
                  }
                }} 
                className="text-slate-400 hover:text-slate-655 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                O código <strong>{manualRegCode}</strong> não está presente na base de estoque oficial. Preencha os dados abaixo para integrá-lo ao SGI CMPC conforme norma <strong>CMPC-PRO-0093</strong>.
              </p>

              {/* CODE input (Read-only) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Código de Material (Registro Fiscal)</label>
                <input 
                  type="text" 
                  value={manualRegCode} 
                  readOnly 
                  className="w-full text-xs font-mono font-bold p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-600 cursor-not-allowed select-none"
                />
              </div>

              {/* DESC input (Required) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Descrição / Nome do Item <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: VÁLVULA DE RETENÇÃO 2 POLEGADAS" 
                  value={manualRegDesc}
                  onChange={(e) => setManualRegDesc(e.target.value.toUpperCase())}
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800"
                />
              </div>

              {/* CLASS / GROUP SELECT */}
              <div className="space-y-1 font-sans">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Ficha de Estoque / Classe <span className="text-rose-500">*</span></label>
                <select 
                  value={showCustomClassInput ? "OUTRO" : manualRegClass}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "OUTRO") {
                      setShowCustomClassInput(true);
                      setManualRegCustomClass('');
                    } else {
                      setShowCustomClassInput(false);
                      setManualRegClass(value);
                    }
                  }}
                  className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-850"
                >
                  <option value="" disabled>Selecione uma Classe existente...</option>
                  {(selectedInventory 
                    ? Array.from(new Set(inventoryItems.map(i => i.grupo || 'Grupo Geral'))).sort()
                    : Array.from(new Set((importedItems.length > 0 && useImportedBaseline ? importedItems : DEFAULT_CMPC_CATALOG).map(i => (i as any).grupo || getItemGrupo(i)))).sort()
                  ).map((grp) => (
                    <option key={grp} value={grp}>{grp}</option>
                  ))}
                  <option value="OUTRO" className="font-extrabold text-[#3a2573]">+ Criar nova classe / grupo...</option>
                </select>
              </div>

              {/* CUSTOM CLASS INPUT */}
              {showCustomClassInput && (
                <div className="space-y-1 animate-fade-in font-sans">
                  <label className="block text-[10px] font-black uppercase text-violet-750 tracking-wider">Escreva o Nome do Novo Grupo / Ficha <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Ferragens e Tubulações" 
                    value={manualRegCustomClass}
                    onChange={(e) => setManualRegCustomClass(e.target.value)}
                    className="w-full text-xs font-bold p-3 bg-violet-50/50 border border-violet-200 rounded-xl outline-none focus:border-[#3a2573] text-slate-800"
                  />
                  <p className="text-[9px] text-[#3a2573] font-bold">✓ Um novo card / ficha de contagem será criado para agrupar este material.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                {/* UNIT DROP DOWN */}
                <div className="space-y-1 font-sans">
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Unidade <span className="text-rose-500">*</span></label>
                  <select 
                    value={manualRegUnit}
                    onChange={(e) => setManualRegUnit(e.target.value)}
                    className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] text-slate-850"
                  >
                    {['UN', 'KG', 'L', 'M', 'CX', 'PC', 'M2', 'M3', 'PCT', 'RL', 'FD', 'GL'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {/* UNIT VALUE */}
                <div className="space-y-1 font-sans">
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Valor Unitário (Opcional)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    placeholder="R$ 0.00" 
                    value={manualRegValueUnitario}
                    onChange={(e) => setManualRegValueUnitario(e.target.value)}
                    className="w-full text-xs font-mono font-bold p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* SYSTEM BALANCE (0, READONLY/LOCKED) */}
              <div className="space-y-1 font-sans">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">Saldo Atual de Sistema (Ledger)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value="0 (Fixo)" 
                    readOnly 
                    className="w-full text-xs font-mono font-bold p-3 bg-orange-50 text-orange-850 border border-orange-200 rounded-xl select-none cursor-not-allowed"
                  />
                  <span className="absolute right-3.5 top-3.5 text-[8.5px] font-black uppercase text-orange-700 bg-orange-100 rounded px-1.5 py-0.5 leading-none">
                    Ausente na Base
                  </span>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-3 pt-3">
              <button 
                type="button" 
                onClick={() => {
                  const nextQueue = unregisteredCodesQueue.filter(c => c !== manualRegCode);
                  setUnregisteredCodesQueue(nextQueue);
                  if (nextQueue.length > 0) {
                    setManualRegCode(nextQueue[0]);
                    setManualRegDesc('');
                    setManualRegValueUnitario('');
                    const defaultGrp = (importedItems.length > 0 && useImportedBaseline) 
                      ? (importedItems[0]?.grupo || 'Grupo Geral') 
                      : 'Grupo Geral';
                    setManualRegClass(defaultGrp);
                    setShowCustomClassInput(false);
                    setManualRegCustomClass('');
                  } else {
                    setIsManualRegModalOpen(false);
                  }
                }} 
                className="px-4.5 py-2.5 text-[10.5px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 border border-slate-205 rounded-xl cursor-pointer"
              >
                Pular / Cancelar
              </button>
              <button 
                type="button" 
                onClick={async () => {
                  if (!manualRegDesc.trim()) {
                    alert('Por favor, informe a descrição do material.');
                    return;
                  }
                  const finalGp = showCustomClassInput ? manualRegCustomClass.trim() : manualRegClass;
                  if (!finalGp) {
                    alert('Por favor, informe a classe ou grupo de estoque.');
                    return;
                  }
                  try {
                    await handleConfirmManualRegistration();
                  } catch (e: any) {
                    alert(`Erro ao registrar: ${e.message || e}`);
                  }
                }}
                className="px-5 py-2.5 text-[10.5px] font-black uppercase tracking-wider bg-[#3a2573] hover:bg-[#2b1b58] text-white rounded-xl shadow-md cursor-pointer"
              >
                Confirmar e Integrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY DIALOG: REASSIGN GROUP / FICHA */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-55 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Justificar Troca de Atribuição SGI</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Grupo/Ficha: {reassignGroup}</p>
              </div>
              <button onClick={() => setIsReassignModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-[10.5px] text-slate-600 leading-normal">
                Conforme diretriz de integridade e controle de inventário <strong>CMPC-PRO-0093</strong>, a substituição ou realocação de supervisor contador de uma ficha exige uma justificativa de segurança auditável de no mínimo 20 caracteres.
              </p>

              <div>
                <label className="block text-[8.5px] font-black uppercase text-purple-700 tracking-wider mb-1">
                  Justificativa Operacional (Mínimo 20 caracteres)
                </label>
                <textarea
                  required
                  rows={3}
                  value={reassignReason}
                  onChange={(e) => {
                    setReassignReason(e.target.value);
                    setReassignError('');
                  }}
                  placeholder="Descreva detalhadamente o motivo da realocação..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 font-semibold"
                />
              </div>

              {reassignError && (
                <p className="text-[10px] font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-150">
                  {reassignError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-705 bg-white hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitReassignGroup}
                className="px-5 py-2 bg-[#3a2573] hover:bg-indigo-950 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow cursor-pointer"
              >
                Salvar Troca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY DIALOG: REOPEN FINISHED FICHA */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Autorização: Reabertura de Ficha Concluída</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Grupo/Ficha: {unlockGroup}</p>
              </div>
              <button onClick={() => setIsUnlockModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-[10.5px] text-slate-600 leading-normal">
                Esta ficha já foi finalizada e dada como <strong>Concluída</strong>. Para autorizar novas readequações físicas e conciliações, é necessária validação com PIN do Coordenador Geral + justificativa.
              </p>

              <div>
                <label className="block text-[8.5px] font-black uppercase text-purple-700 tracking-wider mb-1">
                  PIN de Administrador / Autorizador
                </label>
                <input
                  type="password"
                  maxLength={11}
                  value={unlockPin}
                  onChange={(e) => {
                    setUnlockPin(e.target.value.replace(/\D/g, ''));
                    setUnlockError('');
                  }}
                  placeholder="Digite PIN supervisor..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-400 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 font-mono tracking-widest text-center font-black"
                />
              </div>

              <div>
                <label className="block text-[8.5px] font-black uppercase text-purple-700 tracking-wider mb-1">
                  Justificativa de Reabertura (Mínimo 20 caracteres)
                </label>
                <textarea
                  required
                  rows={3}
                  value={unlockJustification}
                  onChange={(e) => {
                    setUnlockJustification(e.target.value);
                    setUnlockError('');
                  }}
                  placeholder="Justifique o motivo de reabertura da ficha concluída..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 font-semibold"
                />
              </div>

              {unlockError && (
                <p className="text-[10px] font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-150">
                  {unlockError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsUnlockModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-705 bg-white hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitReopenFicha}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow cursor-pointer"
              >
                Destravar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY DIALOG: REOPEN SPECIFIC COUNT ROUND */}
      {reopenCountModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-purple-250 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    {isSuspiciousItem(reopenCountItem!) ? 'Estornar Valor Automático' : 'Ajustar Contagem (Coordenador)'}
                  </h3>
                  <p className="text-[9.5px] text-slate-500 font-bold uppercase mt-0.5">
                    {reopenCountItem?.codigo} — {reopenCountItem?.descricao?.substring(0, 48)}...
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReopenCountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 transition-colors"
                id="btn-close-reopen-count-modal"
              >
                ✕
              </button>
            </div>

            {/* Segmented Control Mode Switcher */}
            {!isSuspiciousItem(reopenCountItem!) && (
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setReopenActionType('recount');
                    setReopenError('');
                  }}
                  className={`flex-1 py-1.5 text-center rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    reopenActionType === 'recount' ? 'bg-[#3a2573] text-white shadow-3xs' : 'text-slate-650 hover:text-slate-800'
                  }`}
                >
                  🔄 Solicitar Recontagem
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReopenActionType('direct_edit');
                    setReopenError('');
                  }}
                  className={`flex-1 py-1.5 text-center rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    reopenActionType === 'direct_edit' ? 'bg-[#3a2573] text-white shadow-3xs' : 'text-slate-650 hover:text-slate-800'
                  }`}
                >
                  ✏️ Edição Direta
                </button>
              </div>
            )}

            <div className="border border-slate-205 p-3 rounded-2xl bg-slate-50/50 space-y-2 text-[10.5px]">
              <div className="flex justify-between font-mono text-[10px] text-slate-700 font-black uppercase">
                <span>Rodada: {reopenCountRound}ª Rodada</span>
                <span>Anterior: {reopenCountVal} {reopenCountItem?.unidade}</span>
              </div>
              <div className="text-[9px] leading-tight text-slate-500 font-semibold uppercase">
                Operador Original: {reopenCountContador || 'Desconhecido'}
              </div>
            </div>

            {reopenActionType === 'direct_edit' ? (
              <div className="space-y-3 p-3.5 bg-purple-50/30 rounded-2xl border border-purple-150 animate-fadeIn">
                <label className="block text-[8.5px] font-black uppercase text-[#3a2573] tracking-wider">
                  Nova Quantidade Correta ({reopenCountItem?.unidade})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Digite a quantidade correta para substituir..."
                  value={reopenNewValue}
                  onChange={(e) => setReopenNewValue(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-full text-xs p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] font-mono text-center font-black text-slate-800"
                />
                <p className="text-[8.5px] text-slate-500 font-bold uppercase leading-normal">
                  Este valor substituirá o valor original no histórico com a marcação de edição pelo Coordenador.
                </p>
              </div>
            ) : (
              <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-100/55 text-[10px] text-rose-955 leading-snug">
                <p className="font-semibold uppercase">
                  O valor atual será descartado e o status passará a "Aguardando recontagem". O item retornará para a lista do almoxarife que o coordenador reatribuir.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[8.5px] font-black uppercase text-[#3a2573] tracking-wider mb-1">
                  PIN de Confirmação do Coordenador
                </label>
                <input
                  type="password"
                  maxLength={11}
                  id="reopen-pin-input"
                  value={reopenPin}
                  onChange={(e) => {
                    setReopenPin(e.target.value.replace(/\D/g, ''));
                    setReopenError('');
                  }}
                  placeholder="Digite o PIN do Coordenador para autorizar..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 font-mono tracking-widest text-center font-black"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[8.5px] font-black uppercase text-[#3a2573] tracking-wider">
                    Justificativa de Ajuste (Exigência SGI)
                  </label>
                  {reopenJustification.length < 20 && !isSuspiciousItem(reopenCountItem!) && (
                    <span className="text-[8px] font-bold text-rose-500 uppercase bg-rose-50 px-1.5 py-0.5 rounded">
                      Faltam {20 - reopenJustification.length} caracteres
                    </span>
                  )}
                </div>
                <textarea
                  required
                  rows={2}
                  id="reopen-justification-input"
                  value={reopenJustification}
                  onChange={(e) => {
                    setReopenJustification(e.target.value);
                    setReopenError('');
                  }}
                  placeholder={
                    isSuspiciousItem(reopenCountItem!)
                      ? 'Preenchimento automático do sistema detectado. Justificativa simplificada válida.'
                      : 'Justifique detalhadamente o motivo para este acerto/recontagem de estoque...'
                  }
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#3a2573] focus:bg-white text-slate-800 font-semibold"
                />
              </div>

              {reopenError && (
                <div className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-150 p-3 rounded-xl animate-shake">
                  ⚠️ {reopenError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReopenCountModalOpen(false)}
                className="px-4 py-2.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-reopen-count"
                onClick={executeReopenCount}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer flex items-center gap-1.5 font-bold"
              >
                <span>{reopenActionType === 'direct_edit' ? 'Salvar Edição Direta' : 'Confirmar Reabertura'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXQUISITE PRINT JOB RENDERER TARGETED BY CSS @MEDIA PRINT */}
      {printJob && (
        <div id="cmpc-print-area" className="hidden print:block font-sans text-slate-900 bg-white min-h-screen p-0">
          <style>{`
            @media print {
              body {
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              #cmpc-inventory-portal {
                display: block !important;
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              #cmpc-inventory-portal > *:not(#cmpc-print-area) {
                display: none !important;
              }
              #cmpc-print-area {
                display: block !important;
                visibility: visible !important;
                position: relative !important;
                width: 100% !important;
                background-color: white !important;
              }
              #cmpc-print-area * {
                visibility: visible !important;
              }
              .print-page-break {
                page-break-after: always !important;
                break-after: page !important;
              }
              @page {
                size: A4 portrait;
                margin: 15mm;
              }
            }
          `}</style>
          
          {(() => {
            const isItemConcluidoHelper = (item: any) => {
              const nBal = item.saldoSistema !== undefined ? Number(item.saldoSistema) : 0;
              const dec = calcularDecisaoCMPC(nBal, item.contagem1, item.contagem2, item.contagem3, item.contagemFinal);
              return dec.isConcluido;
            };

            const groupsToPrint = printJob.type === 'single' && printJob.groupName
              ? [printJob.groupName]
              : (Array.from(new Set(inventoryItems.map(i => i.grupo || 'Grupo Geral'))).sort() as string[]);

            const pagesToPrint = groupsToPrint.flatMap((groupName) => {
              const attrib = (selectedInventory?.atribuicoes || []).find((a: any) => a.grupoId === groupName);
              const groupItems = inventoryItems
                .filter(item => (item.grupo || 'Grupo Geral') === groupName)
                .sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''));

              // Find which rounds have pending items in this group
              const activeRoundsWithPending = [1, 2, 3, 4].filter(round => {
                const pendingInRound = groupItems.filter(item => {
                  if (item.contagemAtualAtiva !== round) return false;
                  if (round === 1) return item.contagem1 === undefined;
                  if (round === 2) return item.contagem2 === undefined;
                  if (round === 3) return item.contagem3 === undefined;
                  if (round === 4) return item.contagemFinal === undefined;
                  return false;
                });
                return pendingInRound.length > 0;
              });

              // If there are no pending items in any round, default to round 1
              const roundsToRender = activeRoundsWithPending.length > 0 ? activeRoundsWithPending : [1];

              return roundsToRender.map(round => {
                const roundPendingItems = groupItems.filter(item => {
                  if (item.contagemAtualAtiva !== round) return false;
                  if (round === 1) return item.contagem1 === undefined;
                  if (round === 2) return item.contagem2 === undefined;
                  if (round === 3) return item.contagem3 === undefined;
                  if (round === 4) return item.contagemFinal === undefined;
                  return false;
                });

                const uniqueAssigneeNames = Array.from(new Set(
                  roundPendingItems
                    .map(item => item.almoxarifeAtribuidoNome)
                    .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
                ));

                const roundStorekeeper = uniqueAssigneeNames.length > 0 
                  ? uniqueAssigneeNames.join(', ')
                  : (attrib?.almoxarifeNome || 'Não Alocado');

                const completedOrOtherItems = groupItems.filter(item => {
                  const isPendingInCurrentRound = item.contagemAtualAtiva === round && (
                    (round === 1 && item.contagem1 === undefined) ||
                    (round === 2 && item.contagem2 === undefined) ||
                    (round === 3 && item.contagem3 === undefined) ||
                    (round === 4 && item.contagemFinal === undefined)
                  );
                  return !isPendingInCurrentRound;
                });

                return {
                  groupName,
                  round,
                  attrib,
                  roundStorekeeper,
                  roundPendingItems,
                  completedOrOtherItems,
                };
              });
            });

            return pagesToPrint.map(({ groupName, round, attrib, roundStorekeeper, roundPendingItems, completedOrOtherItems }, pIndex) => {
              const formattedRound = round === 4 ? 'FINAL' : round;
              const printDateStr = new Date().toLocaleString('pt-BR');

              return (
                <div key={`${groupName}-round-${round}`} className={`p-4 ${pIndex < pagesToPrint.length - 1 ? 'print-page-break' : ''}`}>
                  {/* Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
                    <div>
                      <h2 className="text-xl font-extrabold tracking-wider text-slate-900 leading-none">CMPC</h2>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-1">Industrial</p>
                    </div>
                    <div className="text-right">
                      <h1 className="text-xs font-black uppercase tracking-widest text-[#3a2573]">Ficha de Contagem — CMPC-PRO-0093</h1>
                      <p className="text-[8px] text-rose-600 mt-1 font-black uppercase tracking-wider">
                        RODADA DE CONTAGEM: {formattedRound}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Card Info */}
                  <div className="grid grid-cols-4 gap-2 mb-4 border border-slate-355 rounded-lg p-3 text-[10px] leading-tight bg-slate-50/50">
                    <div>
                      <span className="text-[7px] font-black text-slate-400 block uppercase">DATA DO INVENTÁRIO</span>
                      <span className="font-bold text-slate-800">
                        {selectedInventory?.data 
                          ? new Date(selectedInventory.data + 'T12:00:00').toLocaleDateString('pt-BR') 
                          : new Date().toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[7px] font-black text-slate-400 block uppercase">RODADA & PENDÊNCIA</span>
                      <span className="font-extrabold text-rose-700 uppercase">
                        RODADA {formattedRound} ({roundPendingItems.length} {roundPendingItems.length === 1 ? 'item' : 'itens'} a contar)
                      </span>
                    </div>
                    <div>
                      <span className="text-[7px] font-black text-slate-400 block uppercase">FICHA / GRUPO</span>
                      <span className="font-extrabold text-slate-855 uppercase">{groupName}</span>
                    </div>
                    <div>
                      <span className="text-[7px] font-black text-slate-400 block uppercase">ALMOXARIFE ATRIBUÍDO</span>
                      <span className="font-extrabold text-[#3a2573]">{roundStorekeeper}</span>
                    </div>
                  </div>

                  {/* Printing Date & Guidelines */}
                  <div className="flex justify-between items-center text-[7.5px] text-slate-450 uppercase font-bold tracking-wider mb-2.5 px-1">
                    <span>Data de Impressão: {printDateStr}</span>
                    <span className="text-rose-600 animate-pulse">Digite apenas quantidades inteiras aferidas fisicamente</span>
                  </div>

                  {/* Items List Table */}
                  <table className="w-full text-left text-[9px] border-collapse border border-slate-355">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-355 text-slate-800 font-extrabold uppercase">
                        <th className="py-1.5 px-2 border-r border-slate-355 w-8 text-center text-[7.5px]">Nº</th>
                        <th className="py-1.5 px-2 border-r border-slate-355 w-24 text-[7.5px]">Código</th>
                        <th className="py-1.5 px-3 border-r border-slate-355 text-[7.5px]">Descrição do Material</th>
                        <th className="py-1.5 px-2 border-r border-slate-355 w-10 text-center text-[7.5px]">Un.</th>
                        <th className={`py-1.5 px-1 border-r border-slate-355 w-16 text-center text-[7.3px] ${round === 1 ? 'bg-amber-100 font-black text-rose-700' : ''}`}>
                          {round === 1 ? 'C1 (Preencher)' : 'Contagem 1'}
                        </th>
                        <th className={`py-1.5 px-1 border-r border-slate-355 w-16 text-center text-[7.3px] ${round === 2 ? 'bg-amber-100 font-black text-rose-700' : ''}`}>
                          {round === 2 ? 'C2 (Preencher)' : 'Contagem 2'}
                        </th>
                        <th className={`py-1.5 px-1 border-r border-slate-355 w-16 text-center text-[7.3px] ${round === 3 ? 'bg-amber-100 font-black text-rose-700' : ''}`}>
                          {round === 3 ? 'C3 (Preencher)' : 'Contagem 3'}
                        </th>
                        <th className={`py-1.5 px-1 w-20 text-center text-[7.3px] ${round === 4 ? 'bg-amber-100 font-black text-rose-700' : ''}`}>
                          {round === 4 ? 'C. Final (Preencher)' : 'Cont. Final'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundPendingItems.map((item, index) => (
                        <tr key={item.id} className="border-b border-slate-355">
                          <td className="py-2 px-2 border-r border-slate-355 font-bold text-center text-slate-500">{index + 1}</td>
                          <td className="py-2 px-2 border-r border-slate-355 font-bold font-mono text-slate-800">
                            Cód: {item.codigo}{item.codigoAlternativo ? ` | Alt: ${item.codigoAlternativo}` : ''}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-355 font-medium text-slate-700">{item.descricao}</td>
                          <td className="py-2 px-2 border-r border-slate-355 text-center uppercase font-black text-slate-400">{item.unidade}</td>
                          
                          {/* Contagem 1 Cell */}
                          <td className="py-2 px-1 border-r border-slate-355 text-center font-mono font-bold text-slate-800">
                            {round > 1 && item.contagem1 !== undefined ? item.contagem1 : ''}
                          </td>
                          
                          {/* Contagem 2 Cell */}
                          <td className="py-2 px-1 border-r border-slate-355 text-center font-mono font-bold text-slate-800">
                            {round > 2 && item.contagem2 !== undefined ? item.contagem2 : ''}
                          </td>
                          
                          {/* Contagem 3 Cell */}
                          <td className="py-2 px-1 border-r border-slate-355 text-center font-mono font-bold text-slate-800">
                            {round > 3 && item.contagem3 !== undefined ? item.contagem3 : ''}
                          </td>
                          
                          {/* Contagem Final Cell */}
                          <td className="py-2 px-1 text-center font-mono font-bold text-slate-800">
                            {round > 4 && item.contagemFinal !== undefined ? item.contagemFinal : ''}
                          </td>
                        </tr>
                      ))}
                      {/* Generates blank rows if pending list is empty or small */}
                      {roundPendingItems.length < 5 && Array.from({ length: Math.max(1, 5 - roundPendingItems.length) }).map((_, bIdx) => (
                        <tr key={`blank-${bIdx}`} className="border-b border-slate-355">
                          <td className="py-3.5 border-r border-slate-355"></td>
                          <td className="py-3.5 border-r border-slate-355"></td>
                          <td className="py-3.5 border-r border-slate-355 italic text-slate-300 px-3">Espaço reservado para anotação em campo de novos itens...</td>
                          <td className="py-3.5 border-r border-slate-355"></td>
                          <td className="py-3.5 border-r border-slate-355"></td>
                          <td className="py-3.5 border-r border-slate-355"></td>
                          <td className="py-3.5 border-r border-slate-355"></td>
                          <td className="py-3.5"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* OPTIONAL COMPLETED ITEMS REFERENCE BLOCK */}
                  {completedOrOtherItems.length > 0 && (
                    <div className="mt-5 border border-slate-205 rounded-xl p-3 bg-slate-50/20">
                      <h4 className="text-[8.5px] font-black uppercase tracking-wider text-slate-500 border-b border-dashed border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
                        <span>📋 Itens já concluídos / processados (Apenas referência, sem campos de contagem)</span>
                        <span className="text-slate-400 font-mono font-bold">{completedOrOtherItems.length} itens</span>
                      </h4>
                      <table className="w-full text-left text-[8px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-extrabold uppercase">
                            <th className="py-0.5 px-1 w-6 text-center">Nº</th>
                            <th className="py-0.5 px-1 w-20 font-mono">Código</th>
                            <th className="py-0.5 px-2">Descrição do Material</th>
                            <th className="py-0.5 px-1 w-8 text-center">Un.</th>
                            <th className="py-0.5 px-0.5 text-center w-12">C1</th>
                            <th className="py-0.5 px-0.5 text-center w-12">C2</th>
                            <th className="py-0.5 px-0.5 text-center w-12">C3</th>
                            <th className="py-0.5 px-0.5 text-center w-12">C.Fin</th>
                            <th className="py-0.5 px-1 text-center w-16">Situação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedOrOtherItems.map((item, index) => {
                            const isConcl = isItemConcluidoHelper(item);
                            return (
                              <tr key={`completed-${item.id}`} className="border-b border-slate-100 text-slate-500">
                                <td className="py-1 px-1 text-center font-bold text-slate-400">{index + 1}</td>
                                <td className="py-1 px-1 font-bold font-mono text-slate-650">
                                  Cód: {item.codigo}{item.codigoAlternativo ? ` | Alt: ${item.codigoAlternativo}` : ''}
                                </td>
                                <td className="py-1 px-2 text-slate-600 font-medium truncate max-w-sm">{item.descricao}</td>
                                <td className="py-1 px-1 text-center uppercase text-slate-400 font-mono">{item.unidade}</td>
                                <td className="py-1 px-0.5 text-center font-mono">{item.contagem1 !== undefined ? item.contagem1 : '-'}</td>
                                <td className="py-1 px-0.5 text-center font-mono">{item.contagem2 !== undefined ? item.contagem2 : '-'}</td>
                                <td className="py-1 px-0.5 text-center font-mono">{item.contagem3 !== undefined ? item.contagem3 : '-'}</td>
                                <td className="py-1 px-0.5 text-center font-mono">{item.contagemFinal !== undefined ? item.contagemFinal : '-'}</td>
                                <td className="py-1 px-1 text-center">
                                  <span className={`inline-block text-[7px] font-black uppercase px-1 py-0.5 rounded leading-none ${
                                    isConcl ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-blue-700 bg-blue-50 border border-blue-200'
                                  }`}>
                                    {isConcl ? 'Concluído' : 'Processando'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Observations Block */}
                  <div className="mt-4 border border-slate-300 rounded-lg p-2 md:p-2.5 text-[9px] leading-tight">
                    <span className="text-[7px] font-black text-slate-400 block uppercase mb-1">OBSERVAÇÕES E ANOTAÇÕES EM CAMPO</span>
                    <div className="h-8 text-slate-300 italic text-[8.5px]">Espaço livre reservado para observações ou registro de anomalias pelo almoxarife...</div>
                  </div>

                  {/* Signatures Area */}
                  <div className="mt-6 grid grid-cols-2 gap-8 text-center text-[9px] leading-tight">
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-48 border-b border-slate-400 h-5"></div>
                      <p className="font-extrabold text-slate-500 uppercase text-[6.5px] mt-1 tracking-wider">Assinatura Almoxarife (Contador)</p>
                    </div>
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-48 border-b border-slate-400 h-5"></div>
                      <p className="font-extrabold text-slate-500 uppercase text-[6.5px] mt-1 tracking-wider">Assinatura Coordenador / Auditor SGI</p>
                    </div>
                  </div>

                  {/* Footer credit */}
                  <div className="mt-6 pt-2 border-t border-slate-200 flex justify-between items-center text-[7px] text-slate-400 uppercase tracking-widest font-mono">
                    <span>CMPC Industrial • SGI CMPC-PRO-0093</span>
                    <span>Desenvolvido por André Ramalho</span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Corporate signature footer status */}
      <footer className="bg-slate-100 border-t border-slate-200 mt-12 py-5 text-center text-[10.5px] text-slate-400 print:hidden" id="portal-footer">
        <div>CMPC Industrial Control System SGI • CMPC-PRO-0093 Registered Portal</div>
        <div className="mt-1 text-[10px] text-slate-350">Desenvolvido por André Ramalho</div>
      </footer>
    </div>
  );
}
