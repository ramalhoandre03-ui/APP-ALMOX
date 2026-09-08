/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SiteDailyReport, 
  ProjectSite, 
  PredefinedUniform 
} from '../types';
import { 
  Shield, 
  Lock,
  Database, 
  RefreshCw, 
  Users, 
  FolderGit2, 
  Shirt, 
  Trash2, 
  Plus, 
  TrendingUp, 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  KeyRound, 
  Check,
  Calendar,
  X,
  User,
  AtSign,
  Search,
  Filter,
  UserCheck,
  UserX,
  RotateCw,
  Image,
  Tv,
  Download,
  FileJson,
  Eye,
  Copy,
  Layers,
  Camera,
  Boxes,
  DatabaseZap,
  Sparkles,
  Fingerprint
} from 'lucide-react';
import FaceOnboarding from './FaceOnboarding';
import { supabase } from '../lib/supabase';
import { syncHistoricoRecebimentos, SyncHistoricoResult } from '../utils/syncHistoricoRecebimentos';
import { HUB_MODULES, HubModule, HUB_MODULES_OFICIAIS, MODULOS_PERMISSOES_HUB, ModuloPermissaoConfig, verificarPermissaoModulo } from '../config/modules';

export { HUB_MODULES_OFICIAIS, MODULOS_PERMISSOES_HUB };

interface AdminPanelProps {
  onBackToHub: () => void;
  reports: SiteDailyReport[];
  projectSites: ProjectSite[];
  onUpdateSites: (sites: ProjectSite[]) => void;
  predefinedUniforms: PredefinedUniform[];
  onUpdateUniforms: (uniforms: PredefinedUniform[]) => void;
  allowedPins: string[];
  fullAllowedPins?: any[];
  onAddPin?: (pin: string, nome: string, usuario: string, cargo: string) => Promise<void>;
  onDeletePin?: (pin: string) => Promise<void>;
  onUpdatePins: (pins: string[]) => void;
  onResetReports: () => void;
  isSyncing: boolean;
  lastSynced: string | null;
  syncError: string | null;
  onManualSync: () => void;
}

interface WebLogEntry {
  type: 'click' | 'session_start' | 'hub_update' | string;
  destino?: string;
  url?: string;
  timestamp: string;
  usuario: string;
  nomeCompleto?: string;
  nomeUsuario?: string;
  pin?: string;
  itemName?: string;
  valAnterior?: string;
  valNovo?: string;
}

export default function AdminPanel({
  onBackToHub,
  reports,
  projectSites,
  onUpdateSites,
  predefinedUniforms,
  onUpdateUniforms,
  allowedPins,
  fullAllowedPins = [],
  onAddPin,
  onDeletePin,
  onUpdatePins,
  onResetReports,
  isSyncing,
  lastSynced,
  syncError,
  onManualSync
}: AdminPanelProps) {
  // Navigation sub-tabs inside Admin Panel
  const [activeTab, setActiveTab] = useState<'stats' | 'pins' | 'sites' | 'uniforms' | 'logs' | 'maintenance' | 'users' | 'permissoes_hub' | 'modulos_sistema' | 'tv_config' | 'auditoria_lgpd' | 'identidade_visual' | 'fotos_mobilizacao' | 'biometria_facial'>('stats');

  // Fotos de Mobilização (Supabase Storage) state
  const [obraFotoAdmin, setObraFotoAdmin] = useState<string>('');
  const [selectedFotoFile, setSelectedFotoFile] = useState<File | null>(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);
  const [isUploadingFotoAdmin, setIsUploadingFotoAdmin] = useState(false);
  const [fotoUploadSuccess, setFotoUploadSuccess] = useState<string | null>(null);
  const [fotoUploadError, setFotoUploadError] = useState<string | null>(null);
  const [adminFotoList, setAdminFotoList] = useState<Array<{ name: string; url: string; created_at?: string }>>([]);
  const [isLoadingAdminFotos, setIsLoadingAdminFotos] = useState(false);
  const [obrasDisponiveis, setObrasDisponiveis] = useState<string[]>([]);

  // Cadastro Central de Módulos (Master List) State & Config derivado de HUB_MODULES (SSOT)
  const modulosMaster = HUB_MODULES.map(m => m.titulo);

  // Identidade Visual / Logo Custom State
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(() => {
    return localStorage.getItem('sidebar_logo_url');
  });
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoUploadSuccess, setLogoUploadSuccess] = useState(false);

  // LGPD Sensitive Logs State
  interface SensitiveLog {
    id?: string | number;
    usuario_email: string;
    acao: 'VISUALIZOU_CPF' | 'COPIOU_CPF' | string;
    alvo_nome: string;
    modulo: string;
    created_at: string;
  }
  const [sensitiveLogs, setSensitiveLogs] = useState<SensitiveLog[]>([]);
  const [isLoadingSensitiveLogs, setIsLoadingSensitiveLogs] = useState(false);
  const [sensitiveLogsError, setSensitiveLogsError] = useState<string | null>(null);
  const [sensitiveSearch, setSensitiveSearch] = useState('');

  // TV Ticker custom state
  const [tvTickerMsg, setTvTickerMsg] = useState<string>('');
  const [isLoadingTvTicker, setIsLoadingTvTicker] = useState(false);
  const [tvTickerError, setTvTickerError] = useState<string | null>(null);
  const [tvTickerUsingFallback, setTvTickerUsingFallback] = useState(false);

  // Sincronização e Enriquecimento de Histórico de Recebimentos State
  const [isSyncingHistorico, setIsSyncingHistorico] = useState(false);
  const [syncHistoricoProgress, setSyncHistoricoProgress] = useState<{ msg: string; pct: number } | null>(null);
  const [syncHistoricoResult, setSyncHistoricoResult] = useState<SyncHistoricoResult | null>(null);
  const [syncHistoricoError, setSyncHistoricoError] = useState<string | null>(null);
  const [showSyncDetailsModal, setShowSyncDetailsModal] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch available Obras dynamically from Supabase relatorios_mobilizacao
  useEffect(() => {
    const fetchObrasForPhotos = async () => {
      try {
        const { data: rows } = await supabase
          .from('relatorios_mobilizacao')
          .select('obra_selecionada, nome_arquivo');
        
        const setObras = new Set<string>();
        const IGNORED = ['TODAS AS OBRAS', 'TODAS AS OBRAS', 'TODAS', 'TODAS', 'TODAS AS OBRAS (VISÃO CONSOLIDADA)'];
        
        if (rows) {
          rows.forEach(r => {
            if (r.nome_arquivo) {
              const val = String(r.nome_arquivo).trim();
              if (val && !IGNORED.includes(val.toUpperCase())) {
                setObras.add(val);
              }
            }
            if (r.obra_selecionada) {
              const val = String(r.obra_selecionada).trim();
              if (val && !IGNORED.includes(val.toUpperCase())) {
                setObras.add(val);
              }
            }
          });
        }
        const list = Array.from(setObras).sort();
        setObrasDisponiveis(list);
      } catch (err) {
        console.warn('Erro ao buscar obras para fotos:', err);
      }
    };
    fetchObrasForPhotos();
  }, []);

  // Fetch photos for selected Obra in Admin
  const fetchAdminFotos = async (obraName: string) => {
    if (!obraName) {
      setAdminFotoList([]);
      return;
    }
    setIsLoadingAdminFotos(true);
    try {
      const targetFolder = obraName.trim();
      const { data: files, error } = await supabase.storage
        .from('fotos_mobilizacao')
        .list(targetFolder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (!error && files && files.length > 0) {
        const valid = files.filter(f => f.name && f.name !== '.emptyFolderPlaceholder' && !f.name.startsWith('.'));
        const urls = valid.map(f => {
          const path = `${targetFolder}/${f.name}`;
          const { data: pData } = supabase.storage
            .from('fotos_mobilizacao')
            .getPublicUrl(path);
          return {
            name: f.name,
            url: pData.publicUrl,
            created_at: f.created_at
          };
        });
        setAdminFotoList(urls);
      } else {
        setAdminFotoList([]);
      }
    } catch (err) {
      console.warn('Erro ao carregar fotos:', err);
      setAdminFotoList([]);
    } finally {
      setIsLoadingAdminFotos(false);
    }
  };

  useEffect(() => {
    setAdminFotoList([]);
    if (activeTab === 'fotos_mobilizacao' && obraFotoAdmin) {
      fetchAdminFotos(obraFotoAdmin);
    }
  }, [activeTab, obraFotoAdmin]);

  const handleSelectFotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFotoUploadError('Por favor, selecione um arquivo de imagem válido (.png, .jpg, .jpeg).');
        return;
      }
      setSelectedFotoFile(file);
      setFotoPreviewUrl(URL.createObjectURL(file));
      setFotoUploadError(null);
      setFotoUploadSuccess(null);
    }
  };

  const handleUploadFotoAdmin = async () => {
    if (!selectedFotoFile) {
      setFotoUploadError('Selecione uma foto (.png, .jpg ou .jpeg) para upload.');
      return;
    }
    if (!obraFotoAdmin.trim()) {
      setFotoUploadError('Selecione ou informe o nome da Obra para esta foto.');
      return;
    }

    setIsUploadingFotoAdmin(true);
    setFotoUploadError(null);
    setFotoUploadSuccess(null);

    try {
      const targetFolder = obraFotoAdmin.trim();
      const fileExt = selectedFotoFile.name.split('.').pop() || 'jpg';
      const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${targetFolder}/${cleanFileName}`;

      const { error } = await supabase.storage
        .from('fotos_mobilizacao')
        .upload(filePath, selectedFotoFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Erro no upload de foto para o Supabase Storage:', error);
        setFotoUploadError(`Erro no Supabase Storage: ${error.message}.`);
      } else {
        setFotoUploadSuccess(`Foto enviada com sucesso para a obra "${targetFolder}"!`);
        setSelectedFotoFile(null);
        setFotoPreviewUrl(null);
        fetchAdminFotos(targetFolder);
      }
    } catch (err: any) {
      console.error('Exceção no upload:', err);
      setFotoUploadError(`Erro inesperado: ${err.message || 'Falha de conexão'}`);
    } finally {
      setIsUploadingFotoAdmin(false);
    }
  };

  const handleDeleteAdminFoto = async (fotoName: string) => {
    if (!confirm(`Deseja realmente remover a foto "${fotoName}"?`)) return;
    try {
      const targetFolder = obraFotoAdmin.trim();
      const filePath = `${targetFolder}/${fotoName}`;
      
      const { error } = await supabase.storage.from('fotos_mobilizacao').remove([filePath]);

      if (error) {
        showToast(`Erro ao remover foto: ${error.message}`, 'error');
      } else {
        showToast('Foto removida com sucesso!', 'success');
        fetchAdminFotos(targetFolder);
      }
    } catch (err: any) {
      showToast(`Erro ao remover foto: ${err.message}`, 'error');
    }
  };

  // Gestão de Usuários (RBAC) states
  interface PermissaoHub {
    perfil: string;
    acesso_checklist?: boolean;
    acesso_fluxo_oficina?: boolean;
    acesso_mobilizacao?: boolean;
    acesso_horas?: boolean;
    acesso_inventario?: boolean;
    acesso_requisicoes?: boolean;
    acesso_munck?: boolean;
    acesso_consulta_pedido?: boolean;
    acesso_rastreio_rm?: boolean;
    acesso_expedicao?: boolean;
    acesso_devolucao_ativos?: boolean;
    acesso_fardamento?: boolean;
    acesso_oficina?: boolean;
    acesso_kpi?: boolean;
    acesso_medicao?: boolean;
    acesso_biometria?: boolean;
    [key: string]: any;
  }
  const [permissoesHub, setPermissoesHub] = useState<PermissaoHub[]>([]);
  const [isLoadingPermissoesHub, setIsLoadingPermissoesHub] = useState(false);
  const [permissoesHubError, setPermissoesHubError] = useState<string | null>(null);
  const [newPerfilName, setNewPerfilName] = useState('');
  const [isCreatingPerfil, setIsCreatingPerfil] = useState(false);
  const [perfisDisponiveis, setPerfisDisponiveis] = useState<string[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // Estados para o Modal de Vínculo Biométrico (id_biometria_vinculada)
  const [modalVinculoAberto, setModalVinculoAberto] = useState(false);
  const [usuarioParaVincular, setUsuarioParaVincular] = useState<any | null>(null);
  const [listaBiometrias, setListaBiometrias] = useState<any[]>([]);
  const [isLoadingBiometrias, setIsLoadingBiometrias] = useState(false);

  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Backup e Exportação de Dados Operacionais (JSON)
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const [
        recebimentosRes,
        requisicoesRes,
        fardamentosRes,
        oficinaRes,
        checklistsRes
      ] = await Promise.all([
        supabase.from('recebimentos_itens').select('*'),
        supabase.from('requisicoes').select('*'),
        supabase.from('admissoes_fardamento').select('*'),
        supabase.from('oficina_eletrica').select('*'),
        supabase.from('checklists_eletrica').select('*')
      ]);

      const dados = {
        dataExportacao: new Date().toISOString(),
        recebimentos: recebimentosRes.data || [],
        requisicoes: requisicoesRes.data || [],
        fardamentos: fardamentosRes.data || [],
        oficina: oficinaRes.data || [],
        checklists: checklistsRes.data || []
      };

      const jsonContent = JSON.stringify(dados, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'backup_almoxarifado_dados.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Download do backup de dados (JSON) iniciado com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro ao exportar backup de dados:', err);
      showToast('Erro ao exportar backup de dados: ' + (err.message || 'Falha na comunicação com o banco'), 'error');
    } finally {
      setIsExporting(false);
    }
  };



  // Live Server Logs state
  const [accessLogs, setAccessLogs] = useState<WebLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Forms states
  // Pins
  const [localAllowedPins, setLocalAllowedPins] = useState<string[]>(allowedPins);
  const [localFullAllowedPins, setLocalFullAllowedPins] = useState<any[]>(fullAllowedPins);
  const [usuariosPinsList, setUsuariosPinsList] = useState<any[]>([]);
  const [newPinCode, setNewPinCode] = useState('');
  const [newPinNome, setNewPinNome] = useState('');
  const [newPinUsuario, setNewPinUsuario] = useState('');
  const [newPinCargo, setNewPinCargo] = useState<'Almoxarife' | 'Coordenador' | 'Auditor' | 'Auxiliar' | 'Operador'>('Almoxarife');
  const [pinFormError, setPinFormError] = useState<string | null>(null);
  const [pinFormSuccess, setPinFormSuccess] = useState(false);

  // Carregar lista de "PINS AUTORIZADOS E LICENCIADOS" diretamente fazendo um SELECT * FROM usuarios_pins
  const fetchUsuariosPins = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios_pins')
        .select('*');

      if (!error && data) {
        setUsuariosPinsList(data);
        if (data.length > 0) {
          const pins = data.map((u: any) => u.pin);
          setLocalAllowedPins(pins);
          setLocalFullAllowedPins(data.map((u: any) => ({
            id: u.pin,
            pin: u.pin,
            nome: u.nome_completo || u.nome,
            usuario: u.nome_usuario || u.usuario,
            cargo: u.cargo,
            ativo: u.ativo !== false
          })));
        }
      } else if (error) {
        console.error('Erro ao buscar usuarios_pins:', error);
      }
    } catch (err) {
      console.error('Falha ao carregar usuarios_pins:', err);
    }
  };

  useEffect(() => {
    fetchUsuariosPins();
  }, []);

  // Sites
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [newSiteClient, setNewSiteClient] = useState('');
  const [newSiteManager, setNewSiteManager] = useState('');
  const [siteFormError, setSiteFormError] = useState<string | null>(null);
  const [siteFormSuccess, setSiteFormSuccess] = useState(false);

  // Uniforms
  const [newUniformName, setNewUniformName] = useState('');
  const [newUniformSizes, setNewUniformSizes] = useState('P, M, G, GG');
  const [uniformFormError, setUniformFormError] = useState<string | null>(null);
  const [uniformFormSuccess, setUniformFormSuccess] = useState(false);

  // Double confirmation for history wipe
  const [wipeConfirmStep, setWipeConfirmStep] = useState(0);

  // Fetch users from usuarios_permissoes with JOIN to usuarios (Tabela 1 <-> Tabela 2)
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      // 1. Tenta o join reverso direto no Supabase
      let { data, error } = await supabase
        .from('usuarios_permissoes')
        .select('*, biometria_vinculada:usuarios(id)')
        .order('nome', { ascending: true });

      // Fallback gracioso caso a relação explícita no PostgREST não esteja nomeada
      if (error || !data) {
        const { data: permData, error: permErr } = await supabase
          .from('usuarios_permissoes')
          .select('*')
          .order('nome', { ascending: true });

        if (permErr) throw permErr;

        // Busca quais IDs de usuarios_permissoes estão vinculados na tabela usuarios
        const { data: usuariosBio } = await supabase
          .from('usuarios')
          .select('id, id_biometria_vinculada')
          .not('id_biometria_vinculada', 'is', null);

        const linkedIdsSet = new Set((usuariosBio || []).map(u => String(u.id_biometria_vinculada)));

        data = (permData || []).map(u => ({
          ...u,
          biometria_vinculada: linkedIdsSet.has(String(u.id)) ? [{ id: u.id }] : []
        }));
      }

      setUsersList(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err);
      setUsersError(err.message || 'Erro ao carregar lista de usuários.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const carregarUsuarios = fetchUsers;

  // Busca os registros com vetor facial cadastrado na Tabela 1 (usuarios / colaboradores)
  const carregarBiometriasDisponiveis = async () => {
    setIsLoadingBiometrias(true);
    try {
      let resultData: any[] = [];
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, cargo, face_descriptor, id_biometria_vinculada')
        .not('face_descriptor', 'is', null)
        .order('nome', { ascending: true });

      if (!error && data && data.length > 0) {
        resultData = data;
      } else {
        const { data: fallbackColab } = await supabase
          .from('colaboradores')
          .select('id, nome, cargo, face_descriptor')
          .not('face_descriptor', 'is', null)
          .order('nome', { ascending: true });
        if (fallbackColab && fallbackColab.length > 0) {
          resultData = fallbackColab;
        }
      }

      setListaBiometrias(resultData);
    } catch (err) {
      console.error("Erro ao carregar biometrias:", err);
    } finally {
      setIsLoadingBiometrias(false);
    }
  };

  // ORDEM 3: UPDATE NA TABELA 1 (usuarios), gravando o id do usuarioRBACSelecionado
  const handleSalvarVinculo = async (idFaceNaTabela1: any) => {
    if (!usuarioParaVincular) return;
    try {
      const { error } = await supabase
        .from('usuarios') // Atualiza a Tabela 1
        .update({ id_biometria_vinculada: usuarioParaVincular.id }) // Grava o ID da Tabela 2
        .eq('id', idFaceNaTabela1); // Onde o ID for o da face escolhida na lista do modal

      if (error) throw error;

      alert("Biometria vinculada com sucesso!");
      setModalVinculoAberto(false);
      carregarUsuarios(); // Recarrega a tabela para o botão ficar verde
    } catch (err) {
      console.error("Erro ao vincular biometria:", err);
      alert("Erro ao salvar o vínculo.");
    }
  };

  // Change user profile role
  const handleUpdateProfile = async (userId: string, email: string, newPerfil: string) => {
    try {
      let query = supabase.from('usuarios_permissoes').update({ perfil: newPerfil });
      if (userId && userId.length > 10) {
        query = query.eq('id', userId);
      } else {
        query = query.eq('email', email);
      }
      const { error } = await query;
      if (error) throw error;
      
      // Update local state
      setUsersList(prev => prev.map(u => (u.id === userId || u.email === email) ? { ...u, perfil: newPerfil } : u));
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      alert('Erro ao atualizar perfil do usuário: ' + err.message);
    }
  };

  // Change user status (Aprovar / Bloquear)
  const handleUpdateStatus = async (userId: string, email: string, newStatus: 'Aprovado' | 'Bloqueado' | 'Pendente') => {
    try {
      let query = supabase.from('usuarios_permissoes').update({ 
        status_acesso: newStatus
      });
      if (userId && userId.length > 10) {
        query = query.eq('id', userId);
      } else {
        query = query.eq('email', email);
      }
      const { error } = await query;
      if (error) throw error;
      
      // Update local state
      setUsersList(prev => prev.map(u => (u.id === userId || u.email === email) ? { ...u, status_acesso: newStatus } : u));
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      alert('Erro ao atualizar status do usuário: ' + err.message);
    }
  };

  const fetchPerfisDisponiveis = async () => {
    try {
      const { data, error } = await supabase
        .from('permissoes_hub')
        .select('perfil')
        .order('perfil', { ascending: true });
      if (error) throw error;
      if (data) {
        setPerfisDisponiveis(data.map(p => p.perfil));
      }
    } catch (err: any) {
      console.warn('Aviso ao buscar perfis disponíveis:', err?.message || err);
    }
  };

  const getPermissionValue = (item: any, moduloOuColunaId: string): boolean => {
    if (!item) return false;
    const perfilNorm = (item.perfil || '').toString().trim().toLowerCase();
    if (perfilNorm === 'administrador' || perfilNorm === 'admin master' || perfilNorm === 'admin') {
      return true;
    }

    // 1. Acesso direto pela coluna flat
    if (item[moduloOuColunaId] !== undefined && item[moduloOuColunaId] !== null) {
      return !!item[moduloOuColunaId];
    }

    // 2. Mapeamento para coluna flat caso receba id de rota / módulo legado
    return verificarPermissaoModulo(item.perfil, moduloOuColunaId, item);
  };

  const handleTogglePermission = async (
    perfilAlvo: string,
    colunaDoModulo: string,
    novoEstadoBooleano: boolean
  ) => {
    const isMasterAdmin = perfilAlvo.toLowerCase() === 'administrador' || perfilAlvo.toLowerCase() === 'admin master' || perfilAlvo.toLowerCase() === 'admin';
    if (isMasterAdmin) {
      return;
    }

    // 1. Atualização Otimista no estado local (UI)
    setPermissoesHub(prev => prev.map(p => {
      if (p.perfil !== perfilAlvo) return p;
      return {
        ...p,
        [colunaDoModulo]: novoEstadoBooleano
      };
    }));

    try {
      // 2. Atualização dinâmica da coluna específica no Supabase (Flat Schema)
      const { error } = await supabase
        .from('permissoes_hub')
        .update({ [colunaDoModulo]: novoEstadoBooleano })
        .eq('perfil', perfilAlvo);

      if (error) throw error;

      // 3. Atualiza caches de persistência local para carregamento instantâneo
      setPermissoesHub(current => {
        try {
          localStorage.setItem('cmpc_permissoes_hub_all', JSON.stringify(current));
          const perfilKey = perfilAlvo.toLowerCase().trim();
          const targetRow = current.find(p => p.perfil === perfilAlvo);
          if (targetRow) {
            localStorage.setItem(`cmpc_permissoes_hub_${perfilKey}`, JSON.stringify(targetRow));
          }
        } catch (e) {}
        return current;
      });
    } catch (err: any) {
      console.error("Erro ao atualizar permissão:", err);
      // Rollback no estado local em caso de erro
      setPermissoesHub(prev => prev.map(p => {
        if (p.perfil !== perfilAlvo) return p;
        return {
          ...p,
          [colunaDoModulo]: !novoEstadoBooleano
        };
      }));
      alert('Erro ao atualizar permissão: ' + (err.message || 'Falha na conexão com o banco de dados'));
    }
  };

  const fetchPermissoesHub = async () => {
    setIsLoadingPermissoesHub(true);
    setPermissoesHubError(null);
    try {
      const { data, error } = await supabase
        .from('permissoes_hub')
        .select('*')
        .order('perfil', { ascending: true });
        
      if (error) throw error;
      if (data) {
        setPermissoesHub(data);
        setPerfisDisponiveis(data.map(p => p.perfil));
        try {
          localStorage.setItem('cmpc_permissoes_hub_all', JSON.stringify(data));
        } catch {}
      }
    } catch (err: any) {
      console.warn('Aviso ao buscar permissões do HUB:', err?.message || err);
      setPermissoesHubError(err?.message || 'Erro ao carregar matriz de permissões');
      try {
        const cached = localStorage.getItem('cmpc_permissoes_hub_all');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPermissoesHub(parsed);
            setPerfisDisponiveis(parsed.map((p: any) => p.perfil));
          }
        }
      } catch {}
    } finally {
      setIsLoadingPermissoesHub(false);
    }
  };

  const handleCreatePerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPerfilName.trim()) return;

    setIsCreatingPerfil(true);
    try {
      const nomePerfil = newPerfilName.trim();
      
      const exists = permissoesHub.some(p => p.perfil.toLowerCase() === nomePerfil.toLowerCase());
      if (exists) {
        alert(`O perfil "${nomePerfil}" já existe na matriz.`);
        setIsCreatingPerfil(false);
        return;
      }

      const { error } = await supabase
        .from('permissoes_hub')
        .insert([{ 
          perfil: nomePerfil,
          acesso_checklist: false,
          acesso_fluxo_oficina: false,
          acesso_mobilizacao: false,
          acesso_horas: false,
          acesso_inventario: false,
          acesso_requisicoes: false,
          acesso_munck: false,
          acesso_consulta_pedido: false,
          acesso_rastreio_rm: false,
          acesso_expedicao: false,
          acesso_devolucao_ativos: false,
          acesso_fardamento: false,
          acesso_oficina: false,
          acesso_kpi: false,
          acesso_medicao: false,
          acesso_biometria: false
        }]);

      if (error) throw error;

      setNewPerfilName('');
      alert(`Perfil "${nomePerfil}" criado com sucesso!`);
      await fetchPermissoesHub();
    } catch (err: any) {
      console.error('Erro ao criar perfil:', err);
      alert('Erro ao criar perfil no banco: ' + err.message);
    } finally {
      setIsCreatingPerfil(false);
    }
  };

  const handleDeletePerfil = async (perfil: string) => {
    const isMasterAdmin = perfil.toLowerCase() === 'administrador' || perfil.toLowerCase() === 'admin' || perfil.toLowerCase() === 'admin master';
    if (isMasterAdmin) {
      alert('A exclusão deste perfil master é estritamente proibida.');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o perfil "${perfil}"? Usuários com este perfil perderão o acesso.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('permissoes_hub')
        .delete()
        .eq('perfil', perfil);

      if (error) throw error;

      alert(`Perfil "${perfil}" excluído com sucesso!`);
      await fetchPermissoesHub();
    } catch (err: any) {
      console.error('Erro ao excluir perfil:', err);
      alert('Erro ao excluir perfil: ' + err.message);
    }
  };

  const fetchTvTicker = async () => {
    setIsLoadingTvTicker(true);
    setTvTickerError(null);
    try {
      const { data, error } = await supabase
        .from('configuracoes_tv')
        .select('mensagem_ticker')
        .eq('id', 'ticker')
        .maybeSingle();
      
      if (error) {
        console.warn('configuracoes_tv table might not exist yet, falling back to localStorage:', error);
        setTvTickerUsingFallback(true);
        const localVal = localStorage.getItem('tv_ticker_message') || '[DEVOLUÇÃO DE ATIVOS] BI operacional atualizado em tempo real. • [DASHBOARD ADMISSÕES] registros ativos carregados para a Parada Geral de 2026. • [DILIGENCIAMENTO RMs] Sincronização automatizada ativa com o robô integrador.';
        setTvTickerMsg(localVal);
      } else if (data) {
        setTvTickerMsg(data.mensagem_ticker || '');
        setTvTickerUsingFallback(false);
      } else {
        // Table exists but no record, put default
        const defaultVal = '[DEVOLUÇÃO DE ATIVOS] BI operacional atualizado em tempo real. • [DASHBOARD ADMISSÕES] registros ativos carregados para a Parada Geral de 2026. • [DILIGENCIAMENTO RMs] Sincronização automatizada ativa com o robô integrador.';
        setTvTickerMsg(defaultVal);
        setTvTickerUsingFallback(false);
      }
    } catch (err: any) {
      console.error('Error fetching TV ticker:', err);
      setTvTickerUsingFallback(true);
      const localVal = localStorage.getItem('tv_ticker_message') || '[DEVOLUÇÃO DE ATIVOS] BI operacional atualizado em tempo real. • [DASHBOARD ADMISSÕES] registros ativos carregados para a Parada Geral de 2026. • [DILIGENCIAMENTO RMs] Sincronização automatizada ativa com o robô integrador.';
      setTvTickerMsg(localVal);
    } finally {
      setIsLoadingTvTicker(false);
    }
  };

  const handleSaveTvTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingTvTicker(true);
    setTvTickerError(null);
    try {
      const { error } = await supabase
        .from('configuracoes_tv')
        .upsert([{ id: 'ticker', mensagem_ticker: tvTickerMsg }]);
      
      if (error) {
        console.warn('Failed to save to supabase configuracoes_tv table:', error);
        localStorage.setItem('tv_ticker_message', tvTickerMsg);
        setTvTickerUsingFallback(true);
        showToast('Mensagem salva localmente no navegador (Tabela do banco não encontrada)', 'info');
      } else {
        localStorage.setItem('tv_ticker_message', tvTickerMsg);
        setTvTickerUsingFallback(false);
        showToast('Letreiro da TV atualizado no banco de dados com sucesso!', 'success');
      }
    } catch (err: any) {
      console.error('Error saving TV ticker:', err);
      localStorage.setItem('tv_ticker_message', tvTickerMsg);
      setTvTickerUsingFallback(true);
      showToast('Salvo no navegador. Crie a tabela configuracoes_tv no console Supabase.', 'info');
    } finally {
      setIsLoadingTvTicker(false);
    }
  };

  const fetchSensitiveLogs = async () => {
    setIsLoadingSensitiveLogs(true);
    setSensitiveLogsError(null);
    try {
      const { data, error } = await supabase
        .from('logs_acesso_sensivel')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) {
        console.error('Erro ao consultar logs_acesso_sensivel:', error);
        setSensitiveLogsError(error.message);
      } else if (data) {
        setSensitiveLogs(data);
      }
    } catch (err: any) {
      console.error('Erro ao buscar logs sensíveis:', err);
      setSensitiveLogsError(err.message || 'Falha ao conectar com o banco de dados.');
    } finally {
      setIsLoadingSensitiveLogs(false);
    }
  };

  // Logo Identidade Visual handlers
  const fetchLogoUrl = async () => {
    try {
      const { data } = await supabase
        .from('configuracoes_sistema')
        .select('logo_url')
        .eq('id', 'geral')
        .maybeSingle();

      if (data && (data as any).logo_url) {
        const url = (data as any).logo_url;
        setCurrentLogoUrl(url);
        localStorage.setItem('sidebar_logo_url', url);
        return;
      }
    } catch (err) {
      console.warn('Erro ao consultar logo em configuracoes_sistema:', err);
    }

    try {
      const { data } = await supabase
        .from('configuracao_sistema')
        .select('logo_url')
        .eq('id', 'geral')
        .maybeSingle();

      if (data && (data as any).logo_url) {
        const url = (data as any).logo_url;
        setCurrentLogoUrl(url);
        localStorage.setItem('sidebar_logo_url', url);
      }
    } catch (_) {}
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setLogoUploadError(null);
    setLogoUploadSuccess(false);

    try {
      // 1. Upload file to Supabase storage bucket assets
      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload('logo_almox.png', file, { upsert: true });

      if (uploadError) {
        console.warn('Erro no upload para bucket assets:', uploadError);
        throw uploadError;
      }

      // 2. Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('assets')
        .getPublicUrl('logo_almox.png');

      const rawPublicUrl = publicUrlData.publicUrl;
      const publicUrl = `${rawPublicUrl}?t=${Date.now()}`;

      // 3. Save Public URL to configuracoes_sistema table
      const { error: dbError } = await supabase
        .from('configuracoes_sistema')
        .upsert([
          {
            id: 'geral',
            logo_url: publicUrl,
            updated_at: new Date().toISOString()
          }
        ]);

      if (dbError) {
        console.warn('Aviso ao salvar na tabela configuracoes_sistema:', dbError);
      }

      // Fallback save to configuracao_sistema table
      try {
        await supabase
          .from('configuracao_sistema')
          .upsert([
            {
              id: 'geral',
              logo_url: publicUrl,
              updated_at: new Date().toISOString()
            }
          ]);
      } catch (_) {}

      localStorage.setItem('sidebar_logo_url', publicUrl);
      setCurrentLogoUrl(publicUrl);
      setLogoUploadSuccess(true);
      showToast('Logo do menu atualizada com sucesso!', 'success');
    } catch (err: any) {
      console.error('Erro no upload da logo:', err);
      setLogoUploadError(err.message || 'Erro ao realizar upload do arquivo para o bucket assets.');
      showToast('Erro ao atualizar logo: ' + (err.message || 'Falha no upload'), 'error');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Tem certeza que deseja remover a logo customizada do menu lateral?')) return;
    setIsUploadingLogo(true);
    try {
      await supabase
        .from('configuracoes_sistema')
        .upsert([{ id: 'geral', logo_url: null, updated_at: new Date().toISOString() }]);
      try {
        await supabase
          .from('configuracao_sistema')
          .upsert([{ id: 'geral', logo_url: null, updated_at: new Date().toISOString() }]);
      } catch (_) {}
      localStorage.removeItem('sidebar_logo_url');
      setCurrentLogoUrl(null);
      showToast('Logo removida com sucesso.', 'info');
    } catch (err: any) {
      console.error('Erro ao remover logo:', err);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
      fetchPerfisDisponiveis();
    } else if (activeTab === 'permissoes_hub' || activeTab === 'modulos_sistema') {
      fetchPermissoesHub();
    } else if (activeTab === 'tv_config') {
      fetchTvTicker();
    } else if (activeTab === 'auditoria_lgpd') {
      fetchSensitiveLogs();
    } else if (activeTab === 'identidade_visual') {
      fetchLogoUrl();
    }
  }, [activeTab]);

  // Load backend server logs and check Firestore connection
  const loadSystemLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        // Sort newest first
        if (Array.isArray(data)) {
          const sorted = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setAccessLogs(sorted);
        }
      }
    } catch (e) {
      console.warn('Erro ao requisitar logs do servidor:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCheckConnection = async () => {
    setIsCheckingConnection(true);
    try {
      await fetchUsers();
    } catch (_) {}
    setIsCheckingConnection(false);
  };

  useEffect(() => {
    loadSystemLogs();
    fetchUsers();
    fetchPermissoesHub();
    fetchTvTicker();
    fetchLogoUrl();
  }, []);

  // Compute filtered users list
  const filteredUsers = useMemo(() => {
    if (!userSearch) return usersList;
    const query = userSearch.toLowerCase();
    return usersList.filter(u => 
      (u.nome?.toLowerCase() || '').includes(query) ||
      (u.email?.toLowerCase() || '').includes(query) ||
      (u.perfil?.toLowerCase() || '').includes(query) ||
      (u.status_acesso?.toLowerCase() || '').includes(query)
    );
  }, [usersList, userSearch]);

  // Compute stats in real-time based on actual server logs
  const usageStats = useMemo(() => {
    const totalAcessos = accessLogs.length;

    // Filters logs of type click (representing launch of modules)
    const clicksOnly = accessLogs.filter(l => l.type === 'click');

    // Módulos mais acessados
    const moduleCounts: Record<string, number> = {};
    clicksOnly.forEach(l => {
      const dest = l.destino || 'Desconhecido';
      moduleCounts[dest] = (moduleCounts[dest] || 0) + 1;
    });

    const sortedModules = Object.entries(moduleCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Filter accesses today
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const acessosHoje = accessLogs.filter(l => {
      return l.timestamp && l.timestamp.startsWith(todayStr);
    }).length;

    // Filter accesses this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);
    const acessosSemana = accessLogs.filter(l => {
      return l.timestamp && new Date(l.timestamp) >= oneWeekAgo;
    }).length;

    return {
      totalAcessos,
      acessosHoje,
      acessosSemana,
      topModules: sortedModules
    };
  }, [accessLogs]);

  // Handle PIN methods
  const handleAddPinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCargo = newPinCargo;
    const isAlmox = cleanCargo === 'Almoxarife';
    const cleanPin = isAlmox && !newPinCode.trim() ? '1234' : newPinCode.trim();
    const cleanNome = newPinNome.trim();
    const cleanUsuario = newPinUsuario.trim().toLowerCase();

    if (!cleanPin) {
      setPinFormError('O código PIN não pode estar em branco.');
      return;
    }
    if (cleanPin.length < 3) {
      setPinFormError('O código PIN deve ter ao menos 3 dígitos.');
      return;
    }
    if (!cleanNome) {
      setPinFormError('O Nome Completo é obrigatório para identificação de logs.');
      return;
    }
    if (!cleanUsuario) {
      setPinFormError('O Nome de Usuário é obrigatório para auditoria.');
      return;
    }

    try {
      // Payload esperado: { nome_completo, nome_usuario, pin, cargo, ativo: true }
      const payload = {
        nome_completo: cleanNome,
        nome_usuario: cleanUsuario,
        pin: cleanPin,
        cargo: cleanCargo,
        ativo: true
      };

      console.log("Enviando payload para usuarios_pins:", payload);

      const { data, error } = await supabase
        .from('usuarios_pins')
        .upsert(payload, { onConflict: 'pin' })
        .select();

      if (error) {
        console.error('Erro no Supabase (usuarios_pins):', error);
        setPinFormError(`Erro ao gravar no Supabase: ${error.message}`);
        return;
      }

      console.log('PIN salvo com sucesso em usuarios_pins:', data);

      if (onAddPin) {
        await onAddPin(cleanPin, cleanNome, cleanUsuario, cleanCargo).catch(console.warn);
      }

      await fetchUsuariosPins();

      setNewPinCode('');
      setNewPinNome('');
      setNewPinUsuario('');
      setNewPinCargo('Almoxarife');
      setPinFormError(null);
      setPinFormSuccess(true);
      setTimeout(() => setPinFormSuccess(false), 3000);
      setTimeout(loadSystemLogs, 1000);
    } catch (err: any) {
      setPinFormError(err.message || 'Erro ao gravar PIN no Supabase.');
    }
  };

  const handleDeletePinCode = async (pinToDelete: string) => {
    if (localAllowedPins.length <= 1) {
      alert('Não é possível remover o último PIN de acesso para evitar o bloqueio completo do sistema.');
      return;
    }
    if (confirm(`Tem certeza que deseja remover o PIN "${pinToDelete}"? Esta pessoa perderá acesso ao painel.`)) {
      try {
        const { error } = await supabase
          .from('usuarios_pins')
          .delete()
          .eq('pin', pinToDelete);

        if (error) {
          console.error('Erro ao remover do Supabase:', error);
        }

        if (onDeletePin) {
          await onDeletePin(pinToDelete).catch(console.warn);
        }

        await fetchUsuariosPins();
        setTimeout(loadSystemLogs, 1000);
      } catch (err: any) {
        alert(err.message || 'Erro ao remover PIN do banco.');
      }
    }
  };

  // Handle Frentes de Obra methods
  const handleAddProjectSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) {
      setSiteFormError('Nome da frente de obra é obrigatório.');
      return;
    }
    const cleanName = newSiteName.trim();
    const isDuplicate = projectSites.some(s => s.name.toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
      setSiteFormError('Esta frente de obra já está cadastrada.');
      return;
    }

    const newId = `site-${Date.now()}`;
    const newSite: ProjectSite = {
      id: newId,
      name: cleanName,
      location: newSiteLocation.trim() || '—',
      clientCompany: newSiteClient.trim() || '—',
      managerName: newSiteManager.trim() || '—'
    };

    onUpdateSites([...projectSites, newSite]);
    setNewSiteName('');
    setNewSiteLocation('');
    setNewSiteClient('');
    setNewSiteManager('');
    setSiteFormError(null);
    setSiteFormSuccess(true);
    setTimeout(() => setSiteFormSuccess(false), 3000);
    setTimeout(loadSystemLogs, 1000);
  };

  const handleDeleteProjectSite = (id: string) => {
    if (confirm('Tem certeza que deseja remover esta frente de obra?')) {
      onUpdateSites(projectSites.filter(s => s.id !== id));
      setTimeout(loadSystemLogs, 1000);
    }
  };

  // Handle Uniform Catalog methods
  const handleAddUniformOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniformName.trim()) {
      setUniformFormError('Nome do item de uniforme é obrigatório.');
      return;
    }
    const cleanName = newUniformName.trim();
    const isDuplicate = predefinedUniforms.some(u => u.name.toLowerCase() === cleanName.toLowerCase());
    if (isDuplicate) {
      setUniformFormError('Este item de uniforme já está no catálogo.');
      return;
    }

    const sizeArray = newUniformSizes
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sizeArray.length === 0) {
      setUniformFormError('Por favor, informe ao menos um tamanho (ex: P, M, G).');
      return;
    }

    const newId = `uni-${Date.now()}`;
    const newUniform: PredefinedUniform = {
      id: newId,
      name: cleanName,
      sizes: sizeArray
    };

    onUpdateUniforms([...predefinedUniforms, newUniform]);
    setNewUniformName('');
    setNewUniformSizes('P, M, G, GG');
    setUniformFormError(null);
    setUniformFormSuccess(true);
    setTimeout(() => setUniformFormSuccess(false), 3000);
    setTimeout(loadSystemLogs, 1000);
  };

  const handleDeleteUniformOption = (id: string) => {
    if (confirm('Tem certeza que deseja remover este item de uniforme do catálogo?')) {
      onUpdateUniforms(predefinedUniforms.filter(u => u.id !== id));
      setTimeout(loadSystemLogs, 1000);
    }
  };

  // Unified Double Confirmation History Clear
  const handleWipeHistory = () => {
    if (wipeConfirmStep === 0) {
      setWipeConfirmStep(1);
    } else if (wipeConfirmStep === 1) {
      onResetReports();
      setWipeConfirmStep(2);
      alert('Banco de lançamentos locais e históricos zerado permanentemente!');
      setTimeout(() => setWipeConfirmStep(0), 4000);
      setTimeout(loadSystemLogs, 1000);
    }
  };

  // Convert English event keys to Portuguese actions
  const getFriendlyAction = (log: WebLogEntry) => {
    if (log.type === 'click') {
      return `Acessou o módulo: ${log.destino || 'Visualizador'}`;
    }
    if (log.type === 'session_start') {
      return 'Iniciou sessão no sistema';
    }
    if (log.type === 'hub_update') {
      return `Atualização - ${log.itemName || 'Geral'}`;
    }
    return log.type;
  };

  // Handler para Executar Sincronização e Enriquecimento de Histórico de Recebimentos
  const handleExecutarSyncHistorico = async (forceAll: boolean = false) => {
    setIsSyncingHistorico(true);
    setSyncHistoricoError(null);
    setSyncHistoricoResult(null);
    setSyncHistoricoProgress({ msg: 'Iniciando rotina de enriquecimento...', pct: 5 });

    try {
      const result = await syncHistoricoRecebimentos({
        forceAll,
        onProgress: (msg, pct) => {
          setSyncHistoricoProgress({ msg, pct });
        }
      });

      setSyncHistoricoResult(result);
      if (!result.success && result.erros.length > 0) {
        setSyncHistoricoError(result.erros.join('; '));
        showToast('A sincronização finalizou com alguns erros.', 'error');
      } else {
        showToast(`Histórico sincronizado com sucesso! ${result.totalAtualizados} registros enriquecidos.`, 'success');
      }
      setTimeout(loadSystemLogs, 1000);
    } catch (err: any) {
      setSyncHistoricoError(err.message || 'Falha ao sincronizar dados legados.');
      showToast('Falha na sincronização do histórico.', 'error');
    } finally {
      setIsSyncingHistorico(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="admin-panel-root">
      
      {/* Top Banner decoration */}
      <div className="h-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500 w-full" />

      {/* Admin Panel Header */}
      <header className="bg-slate-900 border-b border-slate-800/80 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <button
              onClick={onBackToHub}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-slate-700"
              title="Voltar ao Hub"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-violet-950 text-violet-400 border border-violet-800/80 rounded-2xl">
                <Shield className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm font-black font-sans uppercase tracking-widest text-[#f8fafc]">
                  Painel de Administração do Sistema
                </h1>
                <p className="text-[10px] text-slate-400 font-sans tracking-wide">
                  CMPC Industrial • Área restrita de infraestrutura e segurança
                </p>
              </div>
            </div>
          </div>

          {/* Sinc Status Badge & Backup Action */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isExporting}
              className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-violet-600 hover:bg-violet-500 text-white border border-violet-500/80 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm shadow-violet-950/40"
              title="Baixar backup consolidado dos dados do banco em JSON"
            >
              {isExporting ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isExporting ? 'Exportando...' : 'Baixar Backup (JSON)'}</span>
            </button>

            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              title="Sincronizar dados locais e em nuvem"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Forçar Sincronização</span>
            </button>

            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-sans bg-violet-950/40 text-violet-400 border-violet-800/50">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span>Supabase Conectado</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Command Workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-wider pl-1 pb-2 border-b border-slate-800 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-violet-500" />
              Navegação do Sistema
            </h3>
            
            <nav className="flex flex-col space-y-1.5">
              <button
                onClick={() => setActiveTab('stats')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'stats'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Estatísticas de Uso</span>
              </button>

              <button
                onClick={() => setActiveTab('pins')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'pins'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Gerenciar PINs</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span>Gestão de Usuários</span>
              </button>

              <button
                onClick={() => setActiveTab('modulos_sistema')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'modulos_sistema'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0 text-violet-400" />
                <span>Módulos do Sistema</span>
              </button>

              <button
                onClick={() => setActiveTab('permissoes_hub')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'permissoes_hub'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span>Permissões do HUB</span>
              </button>

              <button
                onClick={() => setActiveTab('sites')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'sites'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <FolderGit2 className="w-4 h-4 shrink-0" />
                <span>Gerenciar Frentes de Obra</span>
              </button>

              <button
                onClick={() => setActiveTab('uniforms')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'uniforms'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Shirt className="w-4 h-4 shrink-0" />
                <span>Catálogo de Uniformes</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>Log de Acessos</span>
              </button>

              <button
                onClick={() => setActiveTab('auditoria_lgpd')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'auditoria_lgpd'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Eye className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Auditoria LGPD (CPFs)</span>
              </button>

              <button
                onClick={() => setActiveTab('tv_config')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'tv_config'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Tv className="w-4 h-4 shrink-0" />
                <span>Letreiro da TV</span>
              </button>

              <button
                onClick={() => setActiveTab('identidade_visual')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'identidade_visual'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Image className="w-4 h-4 shrink-0" />
                <span>Identidade Visual</span>
              </button>

              <button
                onClick={() => setActiveTab('fotos_mobilizacao')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'fotos_mobilizacao'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Camera className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Álbum de Mobilização</span>
              </button>

              <button
                onClick={() => setActiveTab('biometria_facial')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'biometria_facial'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60'
                    : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <Fingerprint className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Biometria Facial (IA)</span>
              </button>

              <button
                onClick={() => setActiveTab('maintenance')}
                className={`w-full text-left px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'maintenance'
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/60'
                    : 'text-slate-300 hover:bg-slate-805 hover:text-white'
                }`}
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Limpeza de Histórico</span>
              </button>
            </nav>
          </div>

          {/* Quick Fire Status Sidebar Panel */}
          <div className="bg-slate-900 border border-slate-850 rounded-3xl p-5 space-y-4 text-xs">
            <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-wider pl-1 pb-1 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-violet-500" />
              Status de Infraestrutura
            </h4>
            
            <div className="space-y-3 font-mono text-[11px] text-slate-300 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div className="flex justify-between border-b border-slate-850 pb-1.5">
                <span className="text-slate-500">Banco de Dados:</span>
                <span className="text-violet-400 font-bold">PostgreSQL</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-1.5">
                <span className="text-slate-500">Plataforma:</span>
                <span className="text-slate-300">Supabase Cloud</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-1.5">
                <span className="text-slate-500">Uptime SGBD:</span>
                <span className="text-emerald-400 font-bold">100% (Cloud)</span>
              </div>
              <div className="flex justify-between pb-0.5">
                <span className="text-slate-500">Autenticação:</span>
                <span className="text-emerald-400">Ativa (MFA/RBAC)</span>
              </div>
            </div>
            
            <button
              onClick={handleCheckConnection}
              disabled={isCheckingConnection}
              className="w-full py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingConnection ? 'animate-spin' : ''}`} />
              <span>Verificar Conexão</span>
            </button>
          </div>
        </div>

        {/* Workspace Display Area */}
        <div className="lg:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* STATS VIEW */}
            {activeTab === 'stats' && (
              <motion.div
                key="stats-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Stats Dashboard Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Acessos Registrados Hoje</span>
                    <p className="text-3xl font-display font-black text-violet-400 mt-2 font-mono">{usageStats.acessosHoje}</p>
                    <span className="text-[9px] text-slate-500 mt-2">Atualizado instantaneamente</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Últimos 7 Dias</span>
                    <p className="text-3xl font-display font-black text-indigo-400 mt-2 font-mono">{usageStats.acessosSemana}</p>
                    <span className="text-[9px] text-slate-500 mt-2">Consolidado em base</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider">Lançamentos Inventariados</span>
                    <p className="text-3xl font-display font-black text-emerald-450 mt-2 font-mono">{reports.length}</p>
                    <span className="text-[9px] text-slate-500 mt-2">Histórico corporativo total</span>
                  </div>
                </div>

                {/* Most accessed systems list */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                  <h3 className="text-sm font-black font-sans uppercase tracking-wider pb-3 border-b border-slate-800 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#a3b8cc]" />
                    <span>Módulos Mais Acessados do Portal v2</span>
                  </h3>

                  {usageStats.topModules.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4">Nenhum evento registrado hoje nas bases de dados ainda.</p>
                  ) : (
                    <div className="space-y-3.5">
                      {usageStats.topModules.map((m, idx) => {
                        return (
                          <div key={m.name} className="flex items-center justify-between p-3.5 bg-slate-950/50 rounded-2xl border border-slate-850">
                            <div className="flex items-center space-x-3">
                              <span className="text-xs font-mono font-bold text-slate-500">#{idx + 1}</span>
                              <span className="text-xs font-bold text-slate-200">{m.name}</span>
                            </div>
                            <span className="text-xs font-mono font-bold bg-violet-950 text-violet-400 border border-violet-800 px-2.5 py-0.5 rounded-full">
                              {m.count} {m.count === 1 ? 'acesso' : 'acessos'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Info Card */}
                <div className="bg-indigo-950/30 border border-indigo-900/60 text-indigo-200 p-5 rounded-3xl text-xs space-y-2">
                  <h4 className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    Auditoria de Conformidade Ativa
                  </h4>
                  <p className="leading-relaxed">
                    A infraestrutura do Portal CMPC realiza o inventário absoluto de todas as chamadas de API, alterações do catálogo e submissões operacionais de almoxarifados. O rastreamento de acessos garante a segurança de dados de operários.
                  </p>
                </div>
              </motion.div>
            )}

            {/* PINS MANAGEMENT */}
            {activeTab === 'pins' && (
              <motion.div
                key="pins-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800">
                      Controle e Segurança de PINs de Acesso
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed font-sans">
                      Autorize novos PINs para operadores do portal. Usuários listados abaixo possuem privilégios de submissão e visualizações administrativas das frentes de obra.
                    </p>
                  </div>

                  {/* Add PIN Form */}
                  <form onSubmit={handleAddPinCode} className="bg-slate-950 border border-slate-850 p-5 rounded-3xl space-y-4">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Autorizar Novo Acesso</span>
                    
                    {pinFormError && (
                      <p className="text-xs text-rose-450 font-bold font-sans">⚠️ {pinFormError}</p>
                    )}
                    {pinFormSuccess && (
                      <p className="text-xs text-emerald-400 font-bold font-sans">✓ Código PIN autorizado com sucesso em nuvem!</p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                          Cargo / Função do PIN
                        </label>
                        <select
                          required
                          value={newPinCargo}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            setNewPinCargo(val);
                            if (val === 'Almoxarife') {
                              setNewPinCode('1234');
                            } else {
                              if (newPinCode === '1234') setNewPinCode('');
                            }
                          }}
                          className="w-full text-xs p-3 bg-slate-900 border border-slate-800 rounded-xl font-sans text-slate-200 outline-none focus:border-violet-600 transition-all cursor-pointer h-10"
                        >
                          <option value="Almoxarife">Almoxarife</option>
                          <option value="Coordenador">Coordenador</option>
                          <option value="Auditor">Auditor</option>
                          <option value="Auxiliar">Auxiliar</option>
                          <option value="Operador">Operador</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                          Código PIN {newPinCargo === 'Almoxarife' && '(Temporário)'}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            maxLength={11}
                            disabled={newPinCargo === 'Almoxarife'}
                            value={newPinCargo === 'Almoxarife' ? '1234' : newPinCode}
                            onChange={(e) => setNewPinCode(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                            placeholder={newPinCargo === 'Almoxarife' ? '1234' : 'Ex: 00410482021'}
                            className="w-full text-xs p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600 pl-3 pr-10 disabled:opacity-50 disabled:cursor-not-allowed h-10"
                          />
                          <KeyRound className="absolute right-3 top-3 w-4 h-4 text-slate-600 pointer-events-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                          Nome Completo
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={newPinNome}
                            onChange={(e) => setNewPinNome(e.target.value)}
                            placeholder="Ex: André Ramalho"
                            className="w-full text-xs p-3 bg-slate-900 border border-slate-800 rounded-xl font-sans text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600 pl-3 pr-10 h-10"
                          />
                          <User className="absolute right-3 top-3 w-4 h-4 text-slate-600 pointer-events-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5">
                          Nome de Usuário
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={newPinUsuario}
                            onChange={(e) => setNewPinUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                            placeholder="Ex: ramalho.andre"
                            className="w-full text-xs p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600 pl-3 pr-10 h-10"
                          />
                          <AtSign className="absolute right-3 top-3 w-4 h-4 text-slate-600 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center shrink-0 gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Autorizar e Gravar PIN</span>
                      </button>
                    </div>
                  </form>

                  {/* List of PINs */}
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block pl-1">PINs Autorizados e Licenciados ({localAllowedPins.length})</span>
                    {localAllowedPins.map(pin => {
                      const isMaster = pin === '04632076376';
                      const pinDetails = localFullAllowedPins?.find(p => p.pin === pin) || {
                        nome: isMaster ? 'André Ramalho - Administrador Geral' : pin === '00410482021' ? 'Planejamento e Fiscalização CMPC' : pin === '300623' ? 'Equipe de Almoxarifado Principal' : 'Legado/Agente de Contagem S/N',
                        usuario: isMaster ? 'ramalho.andre' : pin === '00410482021' ? 'planejamento.cmpc' : pin === '300623' ? 'almox.principal' : 'almox.legado'
                      };

                      return (
                        <div key={pin} className="flex justify-between items-center bg-slate-950/60 p-4 rounded-2xl border border-slate-850 transition-all hover:bg-slate-905">
                          <div className="flex items-center space-x-3.5">
                            <KeyRound className="w-4 h-4 text-slate-500 shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-slate-200">{pin}</span>
                                {isMaster && (
                                  <span className="text-[8px] bg-violet-950 text-violet-400 border border-violet-850 rounded-sm font-semibold px-1.5 font-sans">MASTER ADMIN</span>
                                )}
                                {pinDetails.primeiroAcesso === true ? (
                                  <span className="text-[8px] bg-amber-950/40 text-amber-500 border border-amber-900 px-1.5 py-0.5 rounded-sm font-bold font-sans uppercase">⚠️ Aguardando primeiro acesso</span>
                                ) : (
                                  <span className="text-[8px] bg-emerald-950/40 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded-sm font-bold font-sans uppercase">✅ Ativo</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                <span className="font-semibold text-slate-300">{pinDetails.nome}</span>
                                <span className="mx-1.5">|</span>
                                <span className="font-mono">@{pinDetails.usuario}</span>
                                {pinDetails.cargo && (
                                  <>
                                    <span className="mx-1.5">•</span>
                                    <span className="text-slate-500 text-[9px] font-sans uppercase font-bold">{pinDetails.cargo}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {!isMaster && (
                            <button
                              type="button"
                              onClick={() => handleDeletePinCode(pin)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-colors cursor-pointer"
                              title="Revogar Acesso"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>
              </motion.div>
            )}

            {/* SITES MANAGEMENT */}
            {activeTab === 'sites' && (
              <motion.div
                key="sites-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800">
                      Gerenciamento Geral de Frentes de Obra
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed font-sans">
                      Inclua, altere ou remova as unidades ativas para lançamentos de boletins operacionais diários de efetivo e ferramentas de almoxarifado.
                    </p>
                  </div>

                  {/* Add Site Form */}
                  <form onSubmit={handleAddProjectSite} className="bg-slate-950 border border-slate-850 p-5 rounded-3xl space-y-3.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Nova Frente de Obra Industrial</span>
                    
                    {siteFormError && (
                      <p className="text-xs text-rose-450 font-bold font-sans">⚠️ {siteFormError}</p>
                    )}
                    {siteFormSuccess && (
                      <p className="text-xs text-emerald-400 font-bold font-sans">✓ Frente de Obra adicionada e registrada em nuvem!</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Nome / Identificação *</label>
                        <input
                          type="text"
                          required
                          value={newSiteName}
                          onChange={(e) => setNewSiteName(e.target.value)}
                          placeholder="Polo Petroquímico Camaçari"
                          className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Localidade (Cidade - UF)</label>
                        <input
                          type="text"
                          value={newSiteLocation}
                          onChange={(e) => setNewSiteLocation(e.target.value)}
                          placeholder="Camaçari - BA"
                          className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Empresa Contratante</label>
                        <input
                          type="text"
                          value={newSiteClient}
                          onChange={(e) => setNewSiteClient(e.target.value)}
                          placeholder="Braskem S.A."
                          className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Eng. Gestor Responsável</label>
                        <input
                          type="text"
                          value={newSiteManager}
                          onChange={(e) => setNewSiteManager(e.target.value)}
                          placeholder="Eng. Fernando Costa"
                          className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Registrar Unidade Industrial</span>
                    </button>
                  </form>

                  {/* List of sites */}
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block pl-1">Frentes Catalogadas ({projectSites.length})</span>
                    {projectSites.length === 0 ? (
                      <p className="text-slate-400 text-xs italic p-4">Nenhuma frente de trabalho mapeada no momento.</p>
                    ) : (
                      projectSites.map(s => {
                        return (
                          <div key={s.id} className="flex justify-between items-center bg-slate-950/60 p-4 rounded-2xl border border-slate-850 transition-all hover:bg-slate-905">
                            <div>
                              <h4 className="text-xs font-bold text-slate-200">{s.name}</h4>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                <span className="text-[8px] font-mono font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded-sm">LOCAL: {s.location}</span>
                                <span className="text-[8px] font-mono font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded-sm">CONTRATO: {s.clientCompany}</span>
                                <span className="text-[8px] font-mono font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded-sm">GESTÃO: {s.managerName}</span>
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => handleDeleteProjectSite(s.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-colors cursor-pointer"
                              title="Remover Unidade"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {/* UNIFORMS CATALOG */}
            {activeTab === 'uniforms' && (
              <motion.div
                key="uniforms-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800">
                      Catálogo de Uniformes Homologados
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed font-sans">
                      Adicione itens e grade de tamanhos autorizados pela segurança do trabalho corporativa para auditoria de estoques de canteiros.
                    </p>
                  </div>

                  {/* Add Uniform Form */}
                  <form onSubmit={handleAddUniformOption} className="bg-slate-950 border border-slate-850 p-5 rounded-3xl space-y-3.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Novo Item do Catálogo</span>
                    
                    {uniformFormError && (
                      <p className="text-xs text-rose-450 font-bold font-sans">⚠️ {uniformFormError}</p>
                    )}
                    {uniformFormSuccess && (
                      <p className="text-xs text-emerald-400 font-bold font-sans">✓ Material adicionado com sucesso ao portfólio!</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Nome do Item de Vestuário *</label>
                        <input
                          type="text"
                          required
                          value={newUniformName}
                          onChange={(e) => setNewUniformName(e.target.value)}
                          placeholder="Ex: Jaleco Brim Antiestática Cinza"
                          className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">Grade de Tamanhos (separados por vírgula) *</label>
                        <input
                          type="text"
                          required
                          value={newUniformSizes}
                          onChange={(e) => setNewUniformSizes(e.target.value)}
                          placeholder="Ex: P, M, G, GG, XG"
                          className="w-full text-xs p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Cadastrar Material ao CMPC Portfólio</span>
                    </button>
                  </form>

                  {/* List of uniforms */}
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block pl-1">Materiais Cadastrados ({predefinedUniforms.length})</span>
                    {predefinedUniforms.length === 0 ? (
                      <p className="text-slate-400 text-xs italic p-4">Nenhum uniforme cadastrado no catálogo.</p>
                    ) : (
                      predefinedUniforms.map(uni => {
                        return (
                          <div key={uni.id} className="flex justify-between items-center bg-slate-950/60 p-4 rounded-2xl border border-slate-850 transition-all hover:bg-slate-905">
                            <div>
                              <h4 className="text-xs font-bold text-slate-200">{uni.name}</h4>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {uni.sizes.map(sz => (
                                  <span key={sz} className="bg-slate-900 border border-slate-800 text-[9px] font-bold text-slate-400 px-2 py-0.5 rounded-sm font-mono">{sz}</span>
                                ))}
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => handleDeleteUniformOption(uni.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-colors cursor-pointer"
                              title="Remover do Catálogo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {/* GERENCIAR BANNER VIEW REMOVED */}

            {/* LOGS TABLE VIEW */}
            {activeTab === 'logs' && (
              <motion.div
                key="logs-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200">
                        Histórico Geral de Transações e logs
                      </h3>
                      <p className="text-slate-400 text-[11px] mt-1 font-sans">
                        Filtragem em tempo real sobre acessos ao Hub de sistemas e alterações da base do almoxarifado.
                      </p>
                    </div>

                    <button
                      onClick={loadSystemLogs}
                      disabled={isLoadingLogs}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-750 text-[10px] font-bold tracking-wider uppercase rounded-lg border border-slate-700 inline-flex items-center gap-1 leading-none.5 cursor-pointer disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                      <span>Atualizar logs</span>
                    </button>
                  </div>

                  {/* Logs Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950/85 text-slate-400 border-b border-slate-850 font-sans text-[10.5px] uppercase font-bold tracking-wide">
                          <th className="p-4">Quem / PIN</th>
                          <th className="p-4">Estágio - Data / Hora</th>
                          <th className="p-4">Módulo afetado</th>
                          <th className="p-4">Ação executada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 whitespace-nowrap">
                        {accessLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-slate-500 italic font-sans">
                              Nenhum log registrado na base do servidor ainda.
                            </td>
                          </tr>
                        ) : (
                          accessLogs.map((log, idx) => {
                            const isClick = log.type === 'click';
                            const isUpdate = log.type === 'hub_update';
                            
                            return (
                              <tr key={idx} className="hover:bg-slate-905 transition-colors font-mono text-[11.5px]">
                                <td className="p-4 text-slate-300">
                                  {log.nomeCompleto ? (
                                    <div className="font-sans text-left">
                                      <div className="font-bold text-slate-200 leading-tight">{log.nomeCompleto}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">@{log.nomeUsuario} • {log.pin}</div>
                                    </div>
                                  ) : (
                                    <div className="font-sans font-bold text-slate-400 text-left">
                                      {log.usuario || 'Anônimo'}
                                    </div>
                                  )}
                                </td>
                                <td className="p-4 text-slate-400 font-sans">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '—'}
                                </td>
                                <td className="p-4 font-sans text-slate-350">
                                  {log.destino || log.itemName || 'Geral'}
                                </td>
                                <td className="p-4 whitespace-normal text-slate-200 font-sans">
                                  <div className="max-w-md">
                                    <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-sm mr-2 ${
                                      isClick ? 'bg-indigo-950 text-indigo-400 border border-indigo-900/50' :
                                      isUpdate ? 'bg-amber-950 text-amber-400 border border-amber-900/50' :
                                      'bg-slate-850 text-slate-300'
                                    }`}>
                                      {log.type}
                                    </span>
                                    <span>
                                      {getFriendlyAction(log)}
                                    </span>
                                    {log.valAnterior && (
                                      <div className="text-[10px] text-slate-500 mt-1 truncate">
                                        Anterior: {log.valAnterior.slice(0, 50)}...
                                      </div>
                                    )}
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
              </motion.div>
            )}

            {/* AUDITORIA DE DADOS SENSÍVEIS (LGPD) VIEW */}
            {activeTab === 'auditoria_lgpd' && (
              <motion.div
                key="auditoria-lgpd-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                          <Shield className="w-5 h-5" />
                        </div>
                        <h3 className="text-base font-black uppercase tracking-wider text-white">
                          Auditoria de Acesso a Dados Sensíveis (LGPD)
                        </h3>
                      </div>
                      <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                        Registro imutável em tempo real de revelações e cópias de CPFs realizadas no sistema por operadores.
                      </p>
                    </div>

                    <button
                      onClick={fetchSensitiveLogs}
                      disabled={isLoadingSensitiveLogs}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold tracking-wider uppercase rounded-xl shadow-lg shadow-amber-950/40 inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 shrink-0 self-start md:self-auto"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingSensitiveLogs ? 'animate-spin' : ''}`} />
                      <span>Atualizar Logs</span>
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total de Eventos Auditados</span>
                      <span className="text-2xl font-black text-white mt-1">{sensitiveLogs.length}</span>
                    </div>

                    <div className="bg-slate-950 border border-indigo-900/30 p-4 rounded-2xl flex flex-col">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> Visualizações
                      </span>
                      <span className="text-2xl font-black text-indigo-300 mt-1">
                        {sensitiveLogs.filter(l => l.acao === 'VISUALIZOU_CPF' || l.acao === 'VISUALIZACAO_CPF_SENSIVEL').length}
                      </span>
                    </div>

                    <div className="bg-slate-950 border border-emerald-900/30 p-4 rounded-2xl flex flex-col">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Copy className="w-3.5 h-3.5" /> Cópias Realizadas
                      </span>
                      <span className="text-2xl font-black text-emerald-300 mt-1">
                        {sensitiveLogs.filter(l => l.acao === 'COPIOU_CPF').length}
                      </span>
                    </div>
                  </div>

                  {/* Search filter */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filtrar logs por operador, ação ou colaborador alvo..."
                      value={sensitiveSearch}
                      onChange={(e) => setSensitiveSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {sensitiveLogsError && (
                    <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
                      ⚠️ Erro ao carregar logs: {sensitiveLogsError}
                    </div>
                  )}

                  {/* Logs Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-black tracking-wider">
                          <th className="p-4">Data / Hora</th>
                          <th className="p-4">Operador (E-mail)</th>
                          <th className="p-4">Ação Realizada</th>
                          <th className="p-4">Colaborador Alvo</th>
                          <th className="p-4">Módulo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {sensitiveLogs.filter(log => {
                          if (!sensitiveSearch.trim()) return true;
                          const q = sensitiveSearch.toLowerCase();
                          return (
                            (log.usuario_email || '').toLowerCase().includes(q) ||
                            (log.alvo_nome || '').toLowerCase().includes(q) ||
                            (log.acao || '').toLowerCase().includes(q) ||
                            (log.modulo || '').toLowerCase().includes(q)
                          );
                        }).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500 italic font-sans text-xs">
                              {isLoadingSensitiveLogs ? 'Carregando registros de auditoria...' : 'Nenhum log de acesso a dados sensíveis encontrado.'}
                            </td>
                          </tr>
                        ) : (
                          sensitiveLogs
                            .filter(log => {
                              if (!sensitiveSearch.trim()) return true;
                              const q = sensitiveSearch.toLowerCase();
                              return (
                                (log.usuario_email || '').toLowerCase().includes(q) ||
                                (log.alvo_nome || '').toLowerCase().includes(q) ||
                                (log.acao || '').toLowerCase().includes(q) ||
                                (log.modulo || '').toLowerCase().includes(q)
                              );
                            })
                            .map((log, idx) => {
                              const isVisualizou = log.acao === 'VISUALIZOU_CPF';
                              const formattedDate = log.created_at
                                ? new Date(log.created_at).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })
                                : '—';

                              return (
                                <tr key={log.id || idx} className="hover:bg-slate-900/80 transition-colors text-xs font-sans">
                                  <td className="p-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                                    {formattedDate}
                                  </td>
                                  <td className="p-4 font-mono text-slate-200 font-bold">
                                    {log.usuario_email || 'Anônimo'}
                                  </td>
                                  <td className="p-4 whitespace-nowrap">
                                    {isVisualizou ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                                        <Eye className="w-3 h-3 text-indigo-400" /> VISUALIZOU CPF
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                                        <Copy className="w-3 h-3 text-emerald-400" /> COPIOU CPF
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-4 font-bold text-white uppercase">
                                    {log.alvo_nome || 'N/A'}
                                  </td>
                                  <td className="p-4 text-slate-400 font-mono text-[11px]">
                                    {log.modulo || 'Fardamento/Admissões'}
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* GESTÃO DE USUÁRIOS (RBAC) VIEW */}
            {activeTab === 'users' && (
              <motion.div
                key="users-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  
                  {/* Tab Header with Refresh button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200">
                        Gestão de Usuários e Controle de Acesso (RBAC)
                      </h3>
                      <p className="text-slate-400 text-[11px] mt-1 font-sans">
                        Gerencie permissões de acesso ao Hub do Almoxarifado. Aprove ou bloqueie usuários e altere perfis.
                      </p>
                    </div>

                    <button
                      onClick={fetchUsers}
                      disabled={isLoadingUsers}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-750 text-[10px] font-bold tracking-wider uppercase rounded-lg border border-slate-700 inline-flex items-center gap-1 leading-none.5 cursor-pointer disabled:opacity-40 select-none self-start sm:self-auto"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                      <span>Atualizar Lista</span>
                    </button>
                  </div>

                  {/* Search and counters */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                    <div className="relative flex-grow">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar usuários por nome, e-mail ou perfil..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-805 text-slate-100 placeholder:text-slate-500 text-xs rounded-xl focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-850 px-3.5 py-2.5 rounded-xl self-start md:self-auto">
                      <span>Total cadastrados:</span>
                      <span className="font-bold text-slate-200">{usersList.length}</span>
                      <span className="text-slate-600">|</span>
                      <span>Filtrados:</span>
                      <span className="font-bold text-violet-400">{filteredUsers.length}</span>
                    </div>
                  </div>

                  {/* Error display */}
                  {usersError && (
                    <div className="p-4 bg-rose-950/35 border border-rose-900/40 text-rose-200 text-xs rounded-2xl flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
                      <span>{usersError}</span>
                    </div>
                  )}

                  {/* Users Table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950/85 text-slate-400 border-b border-slate-850 font-sans text-[10.5px] uppercase font-bold tracking-wide">
                          <th className="p-4">Colaborador</th>
                          <th className="p-4">E-mail</th>
                          <th className="p-4">Perfil / Nível</th>
                          <th className="p-4">Status Acesso</th>
                          <th className="p-4 text-right">Ações Rápidas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingUsers ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <RotateCw className="w-6 h-6 animate-spin text-violet-500" />
                                <span className="font-mono text-[10px] uppercase tracking-wider">Carregando usuários do Supabase...</span>
                              </div>
                            </td>
                          </tr>
                        ) : filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                              Nenhum usuário correspondente encontrado.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => {
                            const statusColor = 
                              user.status_acesso === 'Aprovado'
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50'
                                : user.status_acesso === 'Bloqueado'
                                ? 'bg-rose-950/40 text-rose-400 border-rose-900/50'
                                : 'bg-amber-950/40 text-amber-400 border-amber-900/50';

                            return (
                              <tr key={user.id} className="border-b border-slate-850/60 hover:bg-slate-850/20 text-slate-300 transition-colors">
                                <td className="p-4 font-bold text-slate-100">
                                  {user.nome || 'Sem Nome'}
                                </td>
                                <td className="p-4 text-slate-400">
                                  {user.email}
                                </td>
                                <td className="p-4">
                                  <select
                                    value={user.perfil || 'Operação'}
                                    onChange={(e) => handleUpdateProfile(user.id, user.email, e.target.value)}
                                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2 py-1 rounded-lg focus:outline-none focus:border-violet-500 cursor-pointer"
                                  >
                                    {perfisDisponiveis.length > 0 ? (
                                      <>
                                        {perfisDisponiveis.map((p) => (
                                          <option key={p} value={p}>
                                            {p}
                                          </option>
                                        ))}
                                        {user.perfil && !perfisDisponiveis.includes(user.perfil) && (
                                          <option value={user.perfil}>{user.perfil}</option>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <option value="Administrador">Administrador</option>
                                        <option value="Almoxarifado">Almoxarifado</option>
                                        <option value="Operação">Operação</option>
                                        <option value="RH">RH</option>
                                        {user.perfil && !['Administrador', 'Almoxarifado', 'Operação', 'RH'].includes(user.perfil) && (
                                          <option value={user.perfil}>{user.perfil}</option>
                                        )}
                                      </>
                                    )}
                                  </select>
                                </td>
                                <td className="p-4">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border ${statusColor}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      user.status_acesso === 'Aprovado'
                                        ? 'bg-emerald-400'
                                        : user.status_acesso === 'Bloqueado'
                                        ? 'bg-rose-400'
                                        : 'bg-amber-400'
                                    }`} />
                                    <span>{user.status_acesso || 'Pendente'}</span>
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {user.status_acesso !== 'Aprovado' && (
                                      <button
                                        onClick={() => handleUpdateStatus(user.id, user.email, 'Aprovado')}
                                        className="p-1.5 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-900/40 rounded-lg hover:text-white transition-all cursor-pointer text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                        title="Aprovar Acesso"
                                      >
                                        <UserCheck className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Aprovar</span>
                                      </button>
                                    )}
                                    {user.status_acesso !== 'Bloqueado' && (
                                      <button
                                        onClick={() => handleUpdateStatus(user.id, user.email, 'Bloqueado')}
                                        className="p-1.5 bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-900/40 rounded-lg hover:text-white transition-all cursor-pointer text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                        title="Bloquear Acesso"
                                      >
                                        <UserX className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Bloquear</span>
                                      </button>
                                    )}
                                    {(() => {
                                      // Verifica se o JOIN trouxe algum registro vinculado
                                      const temBiometria = Array.isArray(user.biometria_vinculada)
                                        ? user.biometria_vinculada.length > 0
                                        : Boolean(user.biometria_vinculada);

                                      return temBiometria ? (
                                        <button 
                                          onClick={() => {
                                            setUsuarioParaVincular(user);
                                            carregarBiometriasDisponiveis();
                                            setModalVinculoAberto(true);
                                          }}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold px-3 py-1 rounded ml-2 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                                        >
                                          ✓ Face Vinculada (Alterar)
                                        </button>
                                      ) : (
                                        <button 
                                          onClick={() => {
                                            setUsuarioParaVincular(user);
                                            carregarBiometriasDisponiveis();
                                            setModalVinculoAberto(true);
                                          }}
                                          className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] uppercase font-bold px-3 py-1 rounded ml-2 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                                        >
                                          Vincular Biometria
                                        </button>
                                      );
                                    })()}
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
              </motion.div>
            )}

            {/* GERENCIADOR CENTRAL DE MÓDULOS VIEW */}
            {activeTab === 'modulos_sistema' && (
              <motion.div
                key="modulos-sistema-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-violet-400" />
                        GERENCIADOR DE MÓDULOS (MASTER LIST)
                      </h3>
                      <p className="text-slate-400 text-[11px] mt-1 font-sans">
                        Lista estática oficial dos {HUB_MODULES_OFICIAIS.length} módulos e cards do HUB CMPC. Lista read-only baseada no código.
                      </p>
                    </div>

                    <span className="px-3 py-1.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px] font-bold uppercase tracking-wider rounded-xl font-mono">
                      {HUB_MODULES_OFICIAIS.length} Módulos Oficiais
                    </span>
                  </div>

                  {/* Renderização Estática da Master List */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Módulos Oficiais do Sistema (Read-Only)</h4>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {HUB_MODULES_OFICIAIS.map((mod) => (
                        <span key={mod.id} className="bg-slate-800 border border-slate-700 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          {mod.titulo}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-start gap-3">
                    <Shield className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-400 space-y-1">
                      <h4 className="font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                        Política RBAC Default Deny (Fonte Única da Verdade)
                      </h4>
                      <p>
                        Os módulos acima são sincronizados diretamente com os cartões visíveis na página inicial do HUB e alimentam dinamicamente a matriz de permissões. Novos módulos são protegidos por padrão.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* MATRIZ DE PERMISSÕES DO HUB VIEW */}
            {activeTab === 'permissoes_hub' && (
              <motion.div
                key="permissoes-hub-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  
                  {/* Tab Header with Refresh button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-violet-500" />
                        Permissões do HUB e Matriz de Acessos (RBAC - Default Deny)
                      </h3>
                      <p className="text-slate-400 text-[11px] mt-1 font-sans">
                        Gerencie quais perfis de usuários têm acesso aos {HUB_MODULES.length} módulos do HUB em tempo real.
                      </p>
                    </div>

                    <button
                      onClick={fetchPermissoesHub}
                      disabled={isLoadingPermissoesHub}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-750 text-[10px] font-bold tracking-wider uppercase rounded-lg border border-slate-700 inline-flex items-center gap-1 leading-none cursor-pointer disabled:opacity-40 select-none self-start sm:self-auto"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isLoadingPermissoesHub ? 'animate-spin' : ''}`} />
                      <span>Atualizar Matriz</span>
                    </button>
                  </div>

                  {permissoesHubError && (
                    <div className="bg-rose-950/40 border border-rose-900/30 text-rose-400 text-xs px-4 py-3 rounded-2xl flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{permissoesHubError}</span>
                    </div>
                  )}

                  {/* Formulário de Criação de Novo Perfil */}
                  <form onSubmit={handleCreatePerfil} className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Novo Perfil de Acesso
                      </label>
                      <input
                        type="text"
                        value={newPerfilName}
                        onChange={(e) => setNewPerfilName(e.target.value)}
                        placeholder="Nome do novo perfil (ex: Coordenador)"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-xs"
                        disabled={isCreatingPerfil}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newPerfilName.trim() || isCreatingPerfil}
                      className="h-[38px] px-5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white disabled:text-slate-500 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {isCreatingPerfil ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>Criar Perfil</span>
                    </button>
                  </form>

                  {isLoadingPermissoesHub && permissoesHub.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-xs gap-3 font-medium uppercase tracking-wider">
                      <RotateCw className="w-8 h-8 text-violet-500 animate-spin" />
                      <span>Carregando matriz de permissões...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {permissoesHub.map((item) => {
                        const isMasterAdmin = item.perfil.toLowerCase() === 'administrador' || item.perfil.toLowerCase() === 'admin master' || item.perfil.toLowerCase() === 'admin';
                        
                        return (
                          <div 
                            key={item.perfil}
                            className="bg-slate-950/70 border border-slate-850 rounded-2xl p-5 space-y-4 shadow-xl"
                          >
                            <div className="flex justify-between items-center pb-3 border-b border-slate-850">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black font-sans uppercase tracking-wider text-slate-200">
                                  Perfil: {item.perfil}
                                </h4>
                                {isMasterAdmin && (
                                  <span className="px-1.5 py-0.5 bg-violet-950/60 text-violet-400 border border-violet-800/30 text-[8px] font-black uppercase tracking-wider rounded-md">
                                    Master (Acesso Total)
                                  </span>
                                )}
                              </div>
                              
                              {!isMasterAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePerfil(item.perfil)}
                                  className="p-1.5 bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-900/40 rounded-lg hover:text-white transition-all cursor-pointer"
                                  title={`Excluir perfil ${item.perfil}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {MODULOS_PERMISSOES_HUB.map((modulo) => {
                                const valor = getPermissionValue(item, modulo.columnName);
                                return (
                                  <div 
                                    key={modulo.id}
                                    className="flex items-center justify-between p-3 bg-slate-900/45 rounded-xl border border-slate-850/60 hover:border-slate-800 transition-all gap-3"
                                  >
                                    <div className="flex flex-col min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-medium text-slate-200 leading-tight">
                                          {modulo.titulo}
                                        </span>
                                        {modulo.badge && (
                                          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700/60 text-[8px] font-bold uppercase rounded tracking-wider">
                                            {modulo.badge}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[9px] font-mono text-indigo-400/80 truncate mt-0.5">
                                        coluna: {modulo.columnName}
                                      </span>
                                    </div>
                                    
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePermission(item.perfil, modulo.columnName, !valor)}
                                      disabled={isMasterAdmin}
                                      className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors shrink-0 ${
                                        valor ? 'bg-emerald-500' : 'bg-slate-800'
                                      } ${isMasterAdmin ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    >
                                      <div
                                        className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
                                          valor ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-2xl flex items-start gap-3">
                    <Shield className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-400 space-y-1">
                      <h4 className="font-bold text-slate-300 uppercase text-[10px] tracking-wider">Políticas de Segurança do HUB</h4>
                      <p>
                        As alterações feitas acima entram em vigor instantaneamente para todos os utilizadores do perfil selecionado.
                      </p>
                      <p className="text-[10px] text-slate-550">
                        * O perfil <strong>Administrador</strong> possui direitos Master permanentes, e por razões de segurança, os seus privilégios de administrador não podem ser alterados ou revogados nesta tabela.
                      </p>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* MAINTENANCE / WIPE REST VIEW */}
            {activeTab === 'maintenance' && (
              <motion.div
                key="maintenance-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800">
                      Manutenção, Backup e Limpeza de Histórico
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed font-sans">
                      Gerencie backups de segurança de todas as tabelas operacionais do Supabase ou execute a limpeza de lançamentos para novos ciclos de testes CMPC.
                    </p>
                  </div>

                  {/* Sincronização e Enriquecimento de Histórico de Recebimentos Card */}
                  <div className="bg-slate-950 border border-amber-500/30 p-6 rounded-3xl space-y-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                      <div className="flex items-start gap-3.5">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30 shrink-0">
                          <DatabaseZap className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider">
                              Sincronização e Enriquecimento de Histórico de Recebimentos
                            </h4>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider">
                              Legado BI • Shadow Balance
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed font-sans max-w-2xl">
                            Analisa os registros legados em <code className="text-amber-300 font-mono">recebimentos_itens</code> sem comprador ou valor unitário, cruza com o catálogo oficial de <code className="text-amber-300 font-mono">pedidos_compras_bi</code> e calcula automaticamente o <code className="text-amber-300 font-mono">valor_total_item</code> via <span className="text-slate-200 font-bold">upsert em lotes</span>.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-auto">
                        <button
                          type="button"
                          onClick={() => handleExecutarSyncHistorico(false)}
                          disabled={isSyncingHistorico}
                          className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-amber-950/60"
                        >
                          {isSyncingHistorico ? (
                            <>
                              <RotateCw className="w-4 h-4 animate-spin" />
                              <span>Sincronizando Histórico...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Sincronizar Histórico</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Realtime Feedback */}
                    {isSyncingHistorico && syncHistoricoProgress && (
                      <div className="p-4 bg-slate-900/90 rounded-2xl border border-amber-500/20 space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-amber-400 font-bold">{syncHistoricoProgress.msg}</span>
                          <span className="text-slate-300 font-bold">{syncHistoricoProgress.pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                            style={{ width: `${syncHistoricoProgress.pct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Error Banner */}
                    {syncHistoricoError && (
                      <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-xs text-rose-300 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-bold">Falha no processamento:</strong>
                          <span>{syncHistoricoError}</span>
                        </div>
                      </div>
                    )}

                    {/* Result Summary Metrics */}
                    {syncHistoricoResult && (
                      <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                              Resultado da Sincronização de Histórico
                            </span>
                          </div>
                          {syncHistoricoResult.detalhes && (
                            <button
                              type="button"
                              onClick={() => setShowSyncDetailsModal(true)}
                              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                            >
                              Ver Registros Detalhados
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-500 font-sans block uppercase">Total Verificado</span>
                            <span className="text-sm font-black text-slate-200">{syncHistoricoResult.totalVerificados} itens</span>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-amber-400 font-sans block uppercase">Legados Pendentes</span>
                            <span className="text-sm font-black text-amber-300">{syncHistoricoResult.totalSemCompradorOuValor} itens</span>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-xl border border-emerald-900/40 bg-emerald-950/10">
                            <span className="text-[10px] text-emerald-400 font-sans block uppercase">Enriquecidos & Salvos</span>
                            <span className="text-sm font-black text-emerald-400">{syncHistoricoResult.totalAtualizados} itens</span>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-500 font-sans block uppercase">Sem Correspondência BI</span>
                            <span className="text-sm font-black text-slate-400">{syncHistoricoResult.totalNaoEncontradosNoBI} itens</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Backup e Exportação Card */}
                  <div className="bg-slate-950 border border-violet-900/50 p-6 rounded-3xl space-y-4 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="p-3 bg-violet-950/80 text-violet-400 rounded-2xl border border-violet-800/80 shrink-0">
                          <FileJson className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                            Exportação e Backup Consolidado de Dados (JSON)
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans max-w-2xl">
                            Exporte uma cópia completa de segurança contendo todos os dados operacionais salvos nas tabelas do Supabase (<code className="text-violet-300 font-mono">recebimentos_itens</code>, <code className="text-violet-300 font-mono">requisicoes</code>, <code className="text-violet-300 font-mono">admissoes_fardamento</code>, <code className="text-violet-300 font-mono">oficina_eletrica</code> e <code className="text-violet-300 font-mono">checklists_eletrica</code>) diretamente para um arquivo local.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportBackup}
                        disabled={isExporting}
                        className="px-6 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-950/60 shrink-0 self-start sm:self-auto"
                      >
                        {isExporting ? (
                          <>
                            <RotateCw className="w-4 h-4 animate-spin" />
                            <span>Exportando Dados...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Baixar Backup de Dados (JSON)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone panel */}
                  <div className="bg-rose-950/20 border border-rose-900/40 p-6 rounded-3xl space-y-5">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-950 text-rose-455 rounded-xl border border-rose-800/60 shrink-0">
                        <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">Zona de Extrema Criticidade</h4>
                        <p className="text-[11px] text-rose-200 mt-1 leading-relaxed font-sans">
                          Executar a limpeza de dados redefinirá a base operacional do servidor. Todos os horários de operários e vestuário de frentes inseridas serão permanentemente deletados.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-850 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500">Boletins operacionais atualmente salvos:</span>
                      <span className="font-bold text-slate-100">{reports.length} relatórios</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleWipeHistory}
                        className={`px-5 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                          wipeConfirmStep === 1 
                            ? 'bg-rose-500 text-white hover:bg-rose-600 animate-bounce' 
                            : 'bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900/60'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>
                          {wipeConfirmStep === 0 && "Limpar Todos os Lançamentos"}
                          {wipeConfirmStep === 1 && "Sim, desejo EXCLUIR permanentemente!"}
                          {wipeConfirmStep === 2 && "Operação concluída com sucesso"}
                        </span>
                      </button>

                      {wipeConfirmStep === 1 && (
                        <button
                          type="button"
                          onClick={() => setWipeConfirmStep(0)}
                          className="px-4 py-3 bg-slate-800 hover:bg-slate-705 text-slate-300 text-xs font-bold uppercase rounded-xl border border-slate-700"
                        >
                          Cancelar Limpeza
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TV CONFIG VIEW */}
            {activeTab === 'tv_config' && (
              <motion.div
                key="tv-config-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800">
                      Gerenciamento Dinâmico do Letreiro (Ticker) do Modo TV
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed font-sans">
                      Edite a mensagem em movimento que é exibida na parte inferior da tela no Modo TV. Os dados são sincronizados em tempo real no banco de dados Supabase.
                    </p>
                  </div>

                  <form onSubmit={handleSaveTvTicker} className="bg-slate-950 border border-slate-850 p-6 rounded-3xl space-y-4">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Mensagem do Letreiro</span>
                    
                    {tvTickerError && (
                      <p className="text-xs text-rose-455 font-bold font-sans">⚠️ {tvTickerError}</p>
                    )}

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Texto do Letreiro (Use " • " para separar notícias)
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={tvTickerMsg}
                        onChange={(e) => setTvTickerMsg(e.target.value)}
                        placeholder="Ex: [DEVOLUÇÃO DE ATIVOS] BI operacional atualizado em tempo real. • [DASHBOARD ADMISSÕES] registros ativos carregados..."
                        className="w-full text-xs p-4 bg-slate-900 border border-slate-800 rounded-2xl font-mono text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600 resize-none leading-relaxed"
                      />
                      <div className="flex justify-between items-center text-[10px] text-slate-505 font-mono">
                        <span>Caracteres: {tvTickerMsg.length}</span>
                        {tvTickerUsingFallback && (
                          <span className="text-amber-500 font-bold">⚠️ Usando armazenamento local temporário</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isLoadingTvTicker}
                        className="px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center shrink-0 gap-1.5"
                      >
                        {isLoadingTvTicker ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Salvar Letreiro</span>
                      </button>
                    </div>
                  </form>

                  {/* SQL Helper if table is missing or as a helper */}
                  <div className="bg-indigo-950/20 border border-indigo-900/40 p-6 rounded-3xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/60 shrink-0">
                        <Database className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-indigo-300 uppercase tracking-wider">Configuração da Tabela no Supabase</h4>
                        <p className="text-[11px] text-indigo-200 mt-1 leading-relaxed font-sans">
                          Para garantir a sincronização entre todos os monitores e computadores da planta, certifique-se de que a tabela correspondente existe no seu banco Supabase. Caso não exista, execute o script SQL abaixo no seu painel do Supabase:
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <pre className="bg-slate-950 border border-slate-850 p-4 rounded-2xl text-[10px] font-mono text-indigo-200 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
{`CREATE TABLE IF NOT EXISTS configuracoes_tv (
  id TEXT PRIMARY KEY,
  mensagem_ticker TEXT
);

-- Insere o registro inicial se não existir
INSERT INTO configuracoes_tv (id, mensagem_ticker)
VALUES ('ticker', '[DEVOLUÇÃO DE ATIVOS] BI operacional atualizado em tempo real. • [DASHBOARD ADMISSÕES] registros ativos carregados para a Parada Geral de 2026. • [DILIGENCIAMENTO RMs] Sincronização automatizada ativa com o robô integrador.')
ON CONFLICT (id) DO NOTHING;`}
                      </pre>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* IDENTIDADE VISUAL VIEW */}
            {activeTab === 'identidade_visual' && (
              <motion.div
                key="identidade-visual-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <Image className="w-4 h-4 text-violet-400" />
                      Identidade Visual
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed font-sans">
                      Gerencie a logo corporativa exibida na sidebar do menu lateral de Mobilizações. O arquivo será enviado para o bucket público <code className="text-violet-300 font-mono font-bold">assets</code> do Supabase e a URL será armazenada na tabela <code className="text-violet-300 font-mono font-bold">configuracoes_sistema</code>.
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-6 rounded-3xl space-y-6">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Logo do Menu</span>

                    {logoUploadError && (
                      <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{logoUploadError}</span>
                      </div>
                    )}

                    {logoUploadSuccess && (
                      <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Logo do menu enviada para o bucket e atualizada com sucesso!</span>
                      </div>
                    )}

                    {/* Preview Section */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pré-visualização Atual</span>
                      {currentLogoUrl ? (
                        <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex flex-col items-center gap-3 w-full max-w-sm">
                          <img
                            src={currentLogoUrl}
                            alt="Logo do Menu Lateral"
                            className="w-40 max-h-28 object-contain mx-auto"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="text-[11px] text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer flex items-center gap-1.5 pt-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover Logo</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-6 border border-dashed border-slate-800 rounded-2xl text-xs text-slate-500 italic max-w-sm w-full">
                          Nenhuma logo customizada salva no banco.
                        </div>
                      )}
                    </div>

                    {/* File Input Upload */}
                    <div className="space-y-3">
                      <label className="block text-[11px] font-black uppercase text-slate-300 tracking-wider">
                        Upload de Logo para o Menu (Aceita image/*)
                      </label>
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                          className="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-violet-600 file:text-white hover:file:bg-violet-500 cursor-pointer disabled:opacity-50"
                        />
                        {isUploadingLogo && (
                          <div className="flex items-center gap-2 text-violet-400 text-xs font-bold animate-pulse shrink-0">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Enviando para o Supabase Storage...</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-sans">
                        O arquivo é enviado ao bucket <code className="text-violet-300 font-mono">assets</code> usando a chamada <code className="text-violet-300 font-mono">supabase.storage.from('assets').upload('logo_almox.png', file, &#123; upsert: true &#125;)</code>. A Public URL é gerada com <code className="text-violet-300 font-mono">getPublicUrl</code> e persistida no banco.
                      </p>
                    </div>
                  </div>

                  {/* SQL Helper Table script */}
                  <div className="bg-indigo-950/20 border border-indigo-900/40 p-6 rounded-3xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/60 shrink-0">
                        <Database className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-indigo-300 uppercase tracking-wider">Estrutura de Tabela Recomendada no Supabase</h4>
                        <p className="text-[11px] text-indigo-200 mt-1 leading-relaxed font-sans">
                          Caso a tabela <code className="text-violet-300 font-mono">configuracoes_sistema</code> ainda não tenha sido criada no seu projeto Supabase, você pode executar o comando SQL abaixo no SQL Editor do Supabase:
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <pre className="bg-slate-950 border border-slate-850 p-4 rounded-2xl text-[10px] font-mono text-indigo-200 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
{`CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  id TEXT PRIMARY KEY,
  logo_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registra a chave inicial se não existir
INSERT INTO configuracoes_sistema (id, logo_url)
VALUES ('geral', NULL)
ON CONFLICT (id) DO NOTHING;`}
                      </pre>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* FOTOS DE MOBILIZAÇÃO STORAGE VIEW */}
            {activeTab === 'fotos_mobilizacao' && (
              <motion.div
                key="fotos-mobilizacao-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-black font-sans uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-800 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-400" />
                      Álbum de Registros de Mobilização (Supabase Storage)
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed font-sans">
                      Envie fotos e registros de campo para o bucket <code className="text-amber-400 font-mono font-bold">fotos_mobilizacao</code> do Supabase Storage. As fotos serão armazenadas na pasta correspondente a cada Obra (<code className="text-amber-400 font-mono font-bold">fotos_mobilizacao/[nome_da_obra]/...</code>) e exibidas na barra lateral do painel de Mobilizações.
                    </p>
                  </div>

                  {/* Upload Form Box */}
                  <div className="bg-slate-950 border border-slate-850 p-6 rounded-3xl space-y-5">
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest block">
                      Cadastrar / Enviar Nova Foto
                    </span>

                    {fotoUploadError && (
                      <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{fotoUploadError}</span>
                      </div>
                    )}

                    {fotoUploadSuccess && (
                      <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{fotoUploadSuccess}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Select/Input Obra */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          1. Selecione a Obra / Arquivo
                        </label>
                        <select
                          value={obraFotoAdmin}
                          onChange={(e) => setObraFotoAdmin(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400 transition-colors cursor-pointer"
                        >
                          <option value="" disabled className="bg-slate-950 text-slate-500 font-bold">
                            Selecione uma obra...
                          </option>
                          {obrasDisponiveis.map((ob) => (
                            <option key={ob} value={ob} className="bg-slate-950 text-white font-bold">
                              {ob}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={obraFotoAdmin}
                          onChange={(e) => setObraFotoAdmin(e.target.value)}
                          placeholder="Ou digite o nome personalizado da obra..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-medium focus:outline-none focus:border-amber-400 transition-colors placeholder:text-slate-600"
                        />
                      </div>

                      {/* File Upload Selector */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          2. Escolha o arquivo (.png, .jpg, .jpeg)
                        </label>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={handleSelectFotoFile}
                          disabled={isUploadingFotoAdmin}
                          className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Preview thumbnail */}
                    {fotoPreviewUrl && (
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-4">
                        <img
                          src={fotoPreviewUrl}
                          alt="Pré-visualização"
                          className="w-20 h-20 object-cover rounded-xl border border-slate-700 shrink-0"
                        />
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-white block">
                            {selectedFotoFile?.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {(selectedFotoFile?.size ? (selectedFotoFile.size / 1024).toFixed(1) : 0)} KB • {selectedFotoFile?.type}
                          </span>
                          <span className="text-[10px] text-amber-400 font-bold block">
                            Destino: fotos_mobilizacao/{obraFotoAdmin}/...
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleUploadFotoAdmin}
                        disabled={isUploadingFotoAdmin || !selectedFotoFile}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 active:scale-95 disabled:cursor-not-allowed"
                      >
                        {isUploadingFotoAdmin ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Enviando foto ao Supabase...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4" />
                            <span>Fazer Upload da Foto</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Gallery of Uploaded Photos for Active Obra */}
                  <div className="bg-slate-950 border border-slate-850 p-6 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">
                          Fotos Salvas na Obra: <span className="text-amber-400">{obraFotoAdmin || 'Nenhuma selecionada'}</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {adminFotoList.length} foto(s) encontrada(s) no bucket.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchAdminFotos(obraFotoAdmin)}
                        className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        title="Atualizar lista"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdminFotos ? 'animate-spin' : ''}`} />
                        <span>Atualizar</span>
                      </button>
                    </div>

                    {isLoadingAdminFotos ? (
                      <div className="py-8 text-center text-amber-400 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Carregando fotos do bucket Supabase Storage...</span>
                      </div>
                    ) : adminFotoList.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs italic">
                        Nenhuma foto salva ainda para a obra "{obraFotoAdmin}". Faça o primeiro upload acima!
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {adminFotoList.map((foto, idx) => (
                          <div
                            key={foto.name || idx}
                            className="group relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md transition-all hover:border-amber-400"
                          >
                            <img
                              src={foto.url}
                              alt={foto.name}
                              className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="p-2 bg-slate-950/90 border-t border-slate-850 flex items-center justify-between">
                              <span className="text-[9px] font-mono text-slate-400 truncate max-w-[100px]" title={foto.name}>
                                {foto.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAdminFoto(foto.name)}
                                className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Excluir foto do bucket"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB: BIOMETRIA FACIAL (FACE-API.JS) */}
            {activeTab === 'biometria_facial' && (
              <motion.div
                key="biometria_facial"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <FaceOnboarding />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </main>

      {/* SUCCESS/INFO TOAST NOTIFICATION CONTAINER */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-2xl text-white font-sans animate-bounce shadow-violet-950/20">
          <div className={`p-1.5 rounded-full ${toast.type === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-450'}`}>
            {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest block text-slate-400">Notificação</span>
            <span className="text-[10.5px] font-bold tracking-wide text-slate-200">{toast.message}</span>
          </div>
        </div>
      )}

      {/* MODAL DE VÍNCULO BIOMÉTRICO */}
      {modalVinculoAberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-full max-w-[420px] shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-indigo-400" />
                <span>Vincular Biometria - {usuarioParaVincular?.nome}</span>
              </h3>
              <button 
                onClick={() => setModalVinculoAberto(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-slate-400 mb-4">
              Selecione o cadastro facial correspondente a este usuário:
            </p>
            
            <div className="max-h-60 overflow-y-auto mb-4 space-y-2 pr-1">
              {isLoadingBiometrias ? (
                <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-2 font-mono">
                  <RotateCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Carregando biometrias...</span>
                </div>
              ) : listaBiometrias.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                  Nenhuma biometria com vetor facial encontrada.
                </div>
              ) : (
                listaBiometrias.map(bio => (
                  <div key={bio.id} className="flex justify-between items-center bg-slate-800 p-2.5 mb-2 rounded border border-slate-700 hover:border-indigo-500/50 transition-colors">
                    <div>
                      <p className="text-white text-sm font-bold">{bio.nome}</p>
                      <p className="text-slate-400 text-xs">{bio.cargo || 'Colaborador'}</p>
                    </div>
                    <button 
                      onClick={() => handleSalvarVinculo(bio.id)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-2.5 py-1 rounded cursor-pointer font-bold transition-colors"
                    >
                      Selecionar
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <button 
              onClick={() => setModalVinculoAberto(false)}
              className="w-full border border-slate-600 text-slate-300 py-2 rounded hover:bg-slate-800 transition-colors cursor-pointer text-xs font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Admin Panel Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-5 mt-10 text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 font-sans">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-violet-500" />
            <span className="font-bold">Painel Administrador do Sistema | CMPC Corporate Security</span>
          </div>
          <div className="flex flex-col sm:items-end gap-1">
            <div className="text-[10px] text-slate-500">Desenvolvido por André Ramalho</div>
            <div className="flex items-center space-x-1.5 font-mono text-[10px]">
              <span>UTC Clock: 2026-06-08 21:02</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
