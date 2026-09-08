import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shirt,
  Activity, 
  ArrowRight, 
  ExternalLink, 
  BarChart3, 
  Wrench, 
  Database, 
  ShieldAlert,
  Shield,
  Layers,
  Network,
  FileText,
  Settings,
  X,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock,
  Eye,
  ClipboardList, ClipboardCheck,
  FileSpreadsheet,
  Truck,
  LogOut,
  Search,
  Zap,
  Megaphone,
  Calculator,
  PackageSearch,
  Fingerprint
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import ChangelogModal from './ChangelogModal';
import RastreioPedidoCompra from './RastreioPedidoCompra';
import NetworkStatusIndicator from './NetworkStatusIndicator';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { HUB_MODULES, HubModule, verificarPermissaoModulo } from '../config/modules';
import { 
  isFirebaseConfigured, 
  runFirestoreDiagnostics, 
  logHubEvent, 
  subscribeToLiveStats,
  db,
  onSnapshot,
  collection,
  query,
  where
} from '../lib/firebase';

function getModuleIcon(iconName: string) {
  switch (iconName) {
    case 'Activity': return <Activity className="w-5.5 h-5.5" />;
    case 'BarChart3': return <BarChart3 className="w-5.5 h-5.5" />;
    case 'FileText': return <FileText className="w-5.5 h-5.5" />;
    case 'ClipboardCheck': return <ClipboardCheck className="w-5.5 h-5.5" />;
    case 'ClipboardList': return <ClipboardList className="w-5.5 h-5.5" />;
    case 'FileSpreadsheet': return <FileSpreadsheet className="w-5.5 h-5.5" />;
    case 'Truck': return <Truck className="w-5.5 h-5.5" />;
    case 'Search': return <Search className="w-5.5 h-5.5" />;
    case 'PackageSearch': return <PackageSearch className="w-5.5 h-5.5" />;
    case 'Shirt': return <Shirt className="w-5.5 h-5.5" />;
    case 'Zap': return <Zap className="w-5.5 h-5.5" />;
    case 'Settings': return <Settings className="w-5.5 h-5.5" />;
    case 'Calculator': return <Calculator className="w-5.5 h-5.5" />;
    case 'ShieldAlert': return <ShieldAlert className="w-5.5 h-5.5" />;
    case 'Fingerprint': return <Fingerprint className="w-5.5 h-5.5" />;
    default: return <Layers className="w-5.5 h-5.5" />;
  }
}

function getModuleColorStyles(themeColor?: string) {
  switch (themeColor) {
    case 'indigo':
      return {
        hoverBorder: 'hover:border-indigo-500',
        accentBg: 'bg-indigo-500',
        iconText: 'text-indigo-500',
        groupHoverBg: 'group-hover:bg-indigo-500',
        groupHoverBorder: 'group-hover:border-indigo-500',
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-700',
        badgeBorder: 'border-indigo-100',
        hoverTitle: 'group-hover:text-indigo-500'
      };
    case 'sky':
      return {
        hoverBorder: 'hover:border-sky-500',
        accentBg: 'bg-sky-500',
        iconText: 'text-sky-500',
        groupHoverBg: 'group-hover:bg-sky-500',
        groupHoverBorder: 'group-hover:border-sky-500',
        badgeBg: 'bg-sky-50',
        badgeText: 'text-sky-700',
        badgeBorder: 'border-sky-100',
        hoverTitle: 'group-hover:text-sky-500'
      };
    case 'amber':
      return {
        hoverBorder: 'hover:border-amber-500',
        accentBg: 'bg-amber-500',
        iconText: 'text-amber-600',
        groupHoverBg: 'group-hover:bg-amber-500',
        groupHoverBorder: 'group-hover:border-amber-500',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-700',
        badgeBorder: 'border-amber-100',
        hoverTitle: 'group-hover:text-amber-600'
      };
    case 'emerald':
      return {
        hoverBorder: 'hover:border-emerald-500',
        accentBg: 'bg-emerald-500',
        iconText: 'text-emerald-500',
        groupHoverBg: 'group-hover:bg-emerald-500',
        groupHoverBorder: 'group-hover:border-emerald-500',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-100',
        hoverTitle: 'group-hover:text-emerald-500'
      };
    case 'violet':
      return {
        hoverBorder: 'hover:border-violet-600',
        accentBg: 'bg-violet-600',
        iconText: 'text-violet-600',
        groupHoverBg: 'group-hover:bg-violet-600',
        groupHoverBorder: 'group-hover:border-violet-600',
        badgeBg: 'bg-violet-50',
        badgeText: 'text-violet-700',
        badgeBorder: 'border-violet-100',
        hoverTitle: 'group-hover:text-violet-600'
      };
    case 'purple':
    default:
      return {
        hoverBorder: 'hover:border-cmpc-purple',
        accentBg: 'bg-cmpc-purple',
        iconText: 'text-cmpc-purple',
        groupHoverBg: 'group-hover:bg-cmpc-purple',
        groupHoverBorder: 'group-hover:border-cmpc-purple',
        badgeBg: 'bg-slate-50',
        badgeText: 'text-cmpc-gray',
        badgeBorder: 'border-slate-200',
        hoverTitle: 'group-hover:text-cmpc-purple'
      };
  }
}

interface HubLandingProps {
  onSelectApp: (app: 'uniformes-efetivo' | 'mobilizacao-bi' | 'abastecimento-mobilizacoes' | 'previsao-he' | 'admin' | 'portal-inventario' | 'atendimento-requisicoes' | 'agendamento-munck' | 'processar-movimentacoes' | 'central-fardamento' | 'oficina-eletrica' | 'consulta-pedidos' | 'devolucao-ativos' | 'overhaul-2026' | 'fluxo-oficina' | 'medicao-proprios' | 'gestao-expedicao' | 'monitor-compras' | 'biometria-facial') => void;
  onOpenApp?: (view: string, title: string) => void;
  reportCount: number;
  allowedPins?: string[];
}

export default function HubLanding({ onSelectApp, onOpenApp, reportCount, allowedPins = ['04632076376'] }: HubLandingProps) {
  const { session, logout } = useAuth();
  const [showChangelogModal, setShowChangelogModal] = useState(false);

  const [permissoesRow, setPermissoesRow] = useState<any>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (!session?.perfil) return;
      setIsLoadingPermissions(true);
      
      const perfilKey = session.perfil.toLowerCase().trim();
      const cacheKey = `cmpc_permissoes_hub_${perfilKey}`;
      
      // Load cached permissions immediately for offline/resilient start
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed) setPermissoesRow(parsed);
        }
      } catch (e) {}

      try {
        const { data, error } = await supabase
          .from('permissoes_hub')
          .select('*')
          .eq('perfil', session.perfil)
          .maybeSingle();

        if (error) {
          console.warn('Aviso ao buscar permissões do HUB para o perfil (utilizando fallback):', error.message || error);
        } else if (data) {
          setPermissoesRow(data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch (e) {}
        }
      } catch (err: any) {
        console.warn('Falha de rede ao carregar permissões do HUB:', err?.message || err);
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    fetchUserPermissions();
  }, [session?.perfil]);

  const [munckBookingsCount, setMunckBookingsCount] = useState(0);
  const [munckStatus, setMunckStatus] = useState('Operante');

  useEffect(() => {
    // Load Munck status and bookings
    const savedBookings = localStorage.getItem('cmpc_munck_bookings');
    if (savedBookings) {
      try {
        const parsed = JSON.parse(savedBookings);
        const todayStr = '2026-07-01';
        const todayBookings = parsed.filter((b: any) => b.data === todayStr);
        setMunckBookingsCount(todayBookings.length);
      } catch (e) {}
    } else {
      setMunckBookingsCount(2); // default seed count
    }

    const savedStatus = localStorage.getItem('cmpc_munck_fleet_status');
    if (savedStatus) {
      try {
        const parsed = JSON.parse(savedStatus);
        if (parsed.statusVeiculo) {
          setMunckStatus(parsed.statusVeiculo);
        }
      } catch (e) {}
    }
  }, []);

  const [diagnosticResult, setDiagnosticResult] = useState<string>('Inicializando diagnóstico...');
  const [diagnosticSuccess, setDiagnosticSuccess] = useState<boolean | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  
  const [liveStats, setLiveStats] = useState<{ lastUpdate: string | null; lastAccess: string | null; error: boolean }>({
    lastUpdate: null,
    lastAccess: null,
    error: false
  });

  // Dedicated Admin PIN Authentication states
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  // PWA setup states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [treatingRmCount, setTreatingRmCount] = useState<number>(0);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (isFirebaseConfigured() && db) {
      try {
        // Query only RMs that are likely in non-terminal active statuses to minimize document read counts
        // Standard single field 'where in' queries are fully supported without composite indexes.
        const qActive = query(
          collection(db, 'requisicoes'),
          where('status', 'in', ['Pendente', 'Em Atendimento', 'Aguardando aprovação', 'Alterada pelo Solicitante', 'Reaproveitamento Confirmado'])
        );
        const unsub = onSnapshot(qActive, (snapshot) => {
          const uniqueRMs = new Set<string>();
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data && data.rmNumber) {
              uniqueRMs.add(data.rmNumber);
            }
          });
          const size = uniqueRMs.size;
          setTreatingRmCount(size);
          localStorage.setItem('hub_treating_rm_count', String(size));
        }, (error) => {
          console.warn("Erro ao sincronizar RMs em tempo real no Hub (usando cache):", error);
          const cached = localStorage.getItem('hub_treating_rm_count');
          if (cached !== null) {
            setTreatingRmCount(Number(cached));
          }
        });
        return () => unsub();
      } catch (err) {
        console.warn("Falha ao registrar onSnapshot de RMs no Hub (usando cache):", err);
        const cached = localStorage.getItem('hub_treating_rm_count');
        if (cached !== null) {
          setTreatingRmCount(Number(cached));
        }
      }
    } else {
      const cached = localStorage.getItem('hub_treating_rm_count');
      if (cached !== null) {
        setTreatingRmCount(Number(cached));
      }
    }
  }, []);

  useEffect(() => {
    // Check if running in standalone mode (already installed or from mobile homescreen)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         ('standalone' in window.navigator && (window.navigator as any).standalone === true);
    setIsInstalled(isStandalone);

    // Detect if client is iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Listen to native beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI to notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);

    // Listen to post-installation transition
    const handleAppInstalled = () => {
      console.log('App was successfully installed');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };
    
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as any);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }
    // Show the native prompting box
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    // We can't reuse the event, discard it
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const handleAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (allowedPins.includes(adminPinInput)) {
      setShowAdminAuthModal(false);
      setAdminPinInput('');
      setAdminPinError('');
      if (onOpenApp) {
        onOpenApp('admin', 'Painel Admin');
      } else {
        onSelectApp('admin');
      }
    } else {
      setAdminPinError('PIN de Administrador inválido. Tente novamente.');
    }
  };

  const runDiagnostics = async () => {
    setIsDiagnosticRunning(true);
    const res = await runFirestoreDiagnostics();
    setDiagnosticResult(res.message);
    setDiagnosticSuccess(res.success);
    setIsDiagnosticRunning(false);
    if (res.success) {
      setLiveStats(prev => ({
        ...prev,
        error: false
      }));
    }
  };

  useEffect(() => {
    // 1. Run Diagnostic immediately on load
    runDiagnostics();

    // 2. Keep real-time snapshot sync of lastUpdate / lastAccess
    const unsubscribe = subscribeToLiveStats((stats) => {
      setLiveStats(stats);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 3. SOBRE OS LINKS — direct and non-blocking navigation for Hub Cards
  const handleLaunchSystem = (
    appName: 'uniformes-efetivo' | 'mobilizacao-bi' | 'previsao-he' | 'portal-inventario' | 'atendimento-requisicoes' | 'agendamento-munck' | 'processar-movimentacoes' | 'central-fardamento' | 'oficina-eletrica' | 'consulta-pedidos' | 'devolucao-ativos' | 'overhaul-2026' | 'fluxo-oficina' | 'medicao-proprios' | 'gestao-expedicao' | 'monitor-compras', 
    displayName: string, 
    pUrl: string
  ) => {
    // 1. Immediately launch app view on first click
    if (onOpenApp) {
      onOpenApp(appName, displayName);
    } else {
      onSelectApp(appName);
    }

    // 2. Log click in non-blocking background promise
    logHubEvent({
      type: 'click',
      destino: displayName,
      url: pUrl
    }).catch(e => {
      console.warn('Logging click failed silently:', e);
    });
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (allowedPins.includes(pinInput)) {
      setIsPinUnlocked(true);
      setPinError('');
    } else {
      setPinError('PIN de Administrador inválido. Tente novamente.');
    }
  };

  const handleLockAdmin = () => {
    setIsPinUnlocked(false);
    setPinInput('');
  };

  return (
    <div className="min-h-screen bg-white text-slate-700 flex flex-col font-sans overflow-x-hidden" id="hub-container">
      {/* Dynamic Elegant Toast Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[100] max-w-sm w-full bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl p-4 flex items-start gap-3"
          >
            <div className="p-1.5 bg-amber-500/15 text-amber-500 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <span className="font-extrabold uppercase tracking-widest text-[9px] text-amber-400 block">AVISO DO SISTEMA</span>
              <p className="text-xs text-slate-300 font-sans font-semibold leading-relaxed">
                {toastMessage}
              </p>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Decoration */}
      <div className="h-1.5 w-full bg-gradient-to-r from-cmpc-purple via-cmpc-gray to-cmpc-purple" />
      
      {/* Hub Top Bar Header */}
      <header className="bg-white border-b border-slate-200/80 shadow-2xs py-4 px-6 md:px-12 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <CompanyLogo height={44} />
            <div className="border-l border-slate-300 pl-4 py-1">
              <h2 className="font-sans font-black text-sm text-cmpc-purple tracking-tight leading-tight uppercase">
                Portal de Sistemas CMPC Industrial
              </h2>
              <p className="text-[9px] font-bold text-cmpc-gray uppercase tracking-wider leading-none mt-0.5">
                Almoxarifado • Corporativo
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button 
              onClick={() => setShowChangelogModal(true)}
              className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-full text-xs font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-200 transition-colors cursor-pointer"
            >
              <Megaphone className="w-4 h-4" />
              <span>Novidades</span>
            </button>

            <NetworkStatusIndicator />

            {session && (
              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 pl-3 pr-2 py-1.5 rounded-full text-xs">
                <div className="text-right">
                  <div className="font-bold text-slate-800 leading-tight">{session.nome}</div>
                  <div className="text-[9px] text-violet-600 font-extrabold uppercase tracking-wider">{session.perfil}</div>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-full transition-colors cursor-pointer"
                  title="Sair da Conta"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 flex flex-col justify-center items-center w-full overflow-x-hidden">
        
        {/* Title Section */}
        <div className="text-center max-w-3xl mb-14">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3.5 py-1 rounded-full text-cmpc-purple text-[10px] font-black uppercase tracking-wider mb-4"
          >
            <Layers className="w-3.5 h-3.5 text-cmpc-purple" />
            <span>Ecossistema Digital CMPC Industrial</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl md:text-4xl lg:text-5.5xl font-black text-cmpc-purple tracking-tight font-sans uppercase leading-tight"
            id="hub-title"
          >
            PORTAL DE GESTÃO INTEGRADA - ALMOXARIFADO CMPC INDUSTRIAL
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-cmpc-gray text-sm leading-relaxed mt-4 max-w-2xl mx-auto font-medium"
            id="hub-subtitle"
          >
            Selecione uma das plataformas operacionais abaixo para iniciar o registro de dados diários, análises de frentes ou controle de fluxos de oficina.
          </motion.p>
        </div>

        {/* Columns Systems Grid */}
        {HUB_MODULES
          .filter(m => m.id !== 'admin')
          .filter(modulo => {
            const perfil = session?.perfil?.toLowerCase().trim();
            if (perfil === 'administrador' || perfil === 'admin' || perfil === 'admin master') {
              return true;
            }

            // Bind direto com a coluna da tabela permissoes_hub
            if (permissoesRow && modulo.chaveAcesso && permissoesRow[modulo.chaveAcesso] !== undefined && permissoesRow[modulo.chaveAcesso] !== null) {
              return !!permissoesRow[modulo.chaveAcesso];
            }

            return verificarPermissaoModulo(session?.perfil, modulo.id, permissoesRow);
          }).length === 0 ? (
            <div className="text-center py-16 px-6 bg-slate-50 border border-slate-200 rounded-3xl max-w-lg mx-auto w-full">
              <Shield className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 uppercase">Nenhum Módulo Liberado</h3>
              <p className="text-xs text-slate-500 mt-1">
                O seu perfil ({session?.perfil || 'Não identificado'}) ainda não possui permissões ativas configuradas no Painel de Acessos. Solicite liberação ao Administrador do Sistema.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full items-stretch" id="hub-cards-grid">
              {HUB_MODULES
                .filter(m => m.id !== 'admin')
                .filter(modulo => {
                  const perfil = session?.perfil?.toLowerCase().trim();
                  if (perfil === 'administrador' || perfil === 'admin' || perfil === 'admin master') {
                    return true;
                  }

                  // Bind direto com a coluna da tabela permissoes_hub
                  if (permissoesRow && modulo.chaveAcesso && permissoesRow[modulo.chaveAcesso] !== undefined && permissoesRow[modulo.chaveAcesso] !== null) {
                    return !!permissoesRow[modulo.chaveAcesso];
                  }

                  return verificarPermissaoModulo(session?.perfil, modulo.id, permissoesRow);
                })
                .map((modulo, index) => {
            // Tratamento dinâmico de valores de quickInfo
            let quickInfoVal = modulo.quickInfoValue;
            if (modulo.id === 'atendimento-requisicoes') {
              quickInfoVal = `${treatingRmCount} ${treatingRmCount === 1 ? 'RM EM TRATAMENTO' : 'RMs EM TRATAMENTO'}`;
            } else if (modulo.id === 'agendamento-munck') {
              quickInfoVal = `${munckBookingsCount} ${munckBookingsCount === 1 ? 'Agendamento Hoje' : 'Agendamentos Hoje'}`;
            }

            const colorStyles = getModuleColorStyles(modulo.themeColor);

            return (
              <motion.div
                key={modulo.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: Math.min(0.05 * index, 0.4) }}
                onClick={() => handleLaunchSystem(modulo.id as any, modulo.titulo, modulo.path)}
                className={`bg-white border border-slate-200 rounded-[32px] p-6 shadow-xs flex flex-col justify-between ${colorStyles.hoverBorder} hover:shadow-lg transition-all duration-300 group cursor-pointer relative overflow-hidden text-slate-800 w-full`}
                id={`card-${modulo.id}`}
              >
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${colorStyles.accentBg} opacity-0 group-hover:opacity-100 transition-opacity`} />
                
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div className={`bg-slate-50 ${colorStyles.iconText} border border-slate-150 p-3.5 rounded-2xl ${colorStyles.groupHoverBg} group-hover:text-white ${colorStyles.groupHoverBorder} transition-all duration-300 shadow-3xs`}>
                      {getModuleIcon(modulo.iconName)}
                    </div>
                    <span className={`text-[8px] font-black uppercase tracking-wider ${colorStyles.badgeBg} ${colorStyles.badgeText} px-2.5 py-0.5 rounded-full border ${colorStyles.badgeBorder} shadow-3xs font-mono`}>
                      {modulo.badge}
                    </span>
                  </div>

                  <h3 className={`text-lg font-bold tracking-tight text-[#1e293b] ${colorStyles.hoverTitle} transition-colors`}>
                    {modulo.titulo}
                  </h3>
                  <p className="text-[11px] text-[#5e718d] leading-relaxed mt-2.5 font-sans">
                    {modulo.descricao}
                  </p>

                  {modulo.quickInfoLabel && (
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-455">
                      <span>{modulo.quickInfoLabel}:</span>
                      <span className={`${colorStyles.iconText} font-bold uppercase text-[9px] flex items-center gap-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colorStyles.accentBg} animate-pulse inline-block`} />
                        {quickInfoVal}
                      </span>
                    </div>
                  )}
                </div>

                <div className={`mt-6 flex items-center justify-between text-xs font-bold ${colorStyles.iconText} group-hover:translate-x-1.5 transition-transform`}>
                  <span>Acessar Painel</span>
                  <div className="flex items-center space-x-1">
                    <ArrowRight className={`w-4 h-4 ${colorStyles.iconText}`} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      </main>

      {/* Corporate Info Footer */}
      <footer className="bg-cmpc-gray text-slate-300 border-t border-slate-700 py-6 text-xs" id="hub-footer">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-slate-400 font-semibold text-[10px] uppercase tracking-wider">
            <Database className="w-4 h-4 text-cmpc-purple" />
            <span>Rede de Ativos Integrada • CMPC Industrial 2026</span>
          </div>
          <div className="flex items-center space-x-4">
            {/* Discreet System Admin Access Button */}
            {verificarPermissaoModulo(session?.perfil, 'admin', permissoesRow) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (session?.perfil === 'Administrador') {
                      if (onOpenApp) {
                        onOpenApp('admin', 'Painel Admin');
                      } else {
                        onSelectApp('admin');
                      }
                    } else {
                      setShowAdminAuthModal(true);
                    }
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                  title="Acessar Área Administrativa"
                >
                  <span>⚙️ Painel Admin</span>
                </button>
                <span>•</span>
              </>
            )}
            <span className="text-[10px] text-slate-400">Desenvolvido por André Ramalho</span>
            <span>•</span>
            <div className="flex items-center space-x-1 text-[10px]">
              <Network className="w-3.5 h-3.5 text-[#a3b8cc]" />
              <span>Conexão Encriptada Corporativa</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Admin PIN Authentication Overlay Dialog */}
      {showAdminAuthModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[24px] overflow-hidden shadow-2xl relative">
            <button
              onClick={() => {
                setShowAdminAuthModal(false);
                setAdminPinInput('');
                setAdminPinError('');
              }}
              className="absolute top-4 right-4 p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 text-center space-y-4">
              <div className="inline-flex p-3 bg-violet-950 border border-violet-850/80 text-violet-400 rounded-full">
                <Lock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-widest font-sans">Acesso Administrador</h4>
                <p className="text-[10.5px] text-slate-400 mt-1 leading-relaxed">
                  Esta plataforma é de uso restrito do supervisor de segurança e infraestrutura CMPC Industrial. Insira PIN do Administrador.
                </p>
              </div>

              <form onSubmit={handleAdminPinSubmit} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <input
                    type="password"
                    required
                    maxLength={11}
                    value={adminPinInput}
                    onChange={(e) => {
                      setAdminPinInput(e.target.value);
                      setAdminPinError('');
                    }}
                    placeholder="Insira PIN de Segurança"
                    className="w-full text-xs p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-center text-slate-200 outline-none focus:border-violet-600 transition-all placeholder:text-slate-600 tracking-widest"
                  />
                  {adminPinError && (
                    <p className="text-[10px] text-rose-450 font-bold bg-rose-955/20 border border-rose-909/30 p-2 rounded-lg inline-block font-sans">
                      ⚠️ {adminPinError}
                    </p>
                  )}
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminAuthModal(false);
                      setAdminPinInput('');
                      setAdminPinError('');
                    }}
                    className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-755 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    Confirmar Código
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PWA Floating Installation Banner */}
      {!isInstalled && !isBannerDismissed && (isInstallable || isIOS) && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 bg-slate-900 text-white border border-violet-500/30 rounded-2xl p-4.5 shadow-2xl z-45 flex flex-col space-y-3 font-sans"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl shadow-inner text-white flex-shrink-0">
                {isIOS ? (
                  <svg className="w-5 h-5 text-violet-200" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75V2.25m0 0l-5.25 5.25M12 2.25l5.25 5.25M19.5 12h-15" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                  <span>Portal CMPC Industrial no Celular</span>
                  <span className="text-[10px] bg-violet-900/50 text-violet-300 px-1.5 py-0.5 rounded font-black tracking-normal uppercase">Instalar</span>
                </h4>
                <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed">
                  {isIOS 
                    ? 'Adicione à sua tela de início para funcionamento offline completo.'
                    : 'Instale o aplicativo para carregar frentes e emitir relatórios offline.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsBannerDismissed(true)}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer flex-shrink-0"
              aria-label="Ignorar instalação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Trigger */}
          {isIOS ? (
            <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-xl flex items-start space-x-2 text-[10.5px]">
              <span className="text-[14px] leading-none select-none">📲</span>
              <p className="text-slate-350 leading-normal font-medium">
                Para instalar no iPhone, toque no botão de <span className="font-bold text-violet-400">Compartilhar</span> <svg className="w-3.5 h-3.5 inline-block mx-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V1.5"></path></svg> no menu do Safari e selecione <span className="font-bold text-violet-400">"Adicionar à Tela de Início"</span>.
              </p>
            </div>
          ) : (
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setIsBannerDismissed(true)}
                className="w-1/3 py-2 bg-slate-800 hover:bg-slate-755 text-slate-350 hover:text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer text-center"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-2/3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <span>Instalar</span>
                <span className="text-sm">📲</span>
              </button>
            </div>
          )}
        </motion.div>
      )}

      {showChangelogModal && (
        <ChangelogModal 
          onClose={() => setShowChangelogModal(false)}
          isAdmin={session?.perfil === 'Administrador' || session?.perfil === 'ADMIN'}
        />
      )}
    </div>
  );
}
