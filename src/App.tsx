/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import Header from './components/Header';
import StorekeeperPanel from './components/StorekeeperPanel';
import CentralPanel from './components/CentralPanel';
import HubLanding from './components/HubLanding';
import MobilizacaoPanel from './components/MobilizacaoPanel';
import MobilizacaoView from './components/MobilizacaoView';
import FluxoOficina from "./components/FluxoOficina";
import ExtraHoursPanel from './components/ExtraHoursPanel';
import AdminPanel from './components/AdminPanel';
import InventoryPortal from './components/InventoryPortal';
import RequisicoesPanel from './components/RequisicoesPanel';
import AgendamentoMunck from './components/AgendamentoMunck';
import LoginGatekeeper from './components/LoginGatekeeper';
import TelaEspera from './components/TelaEspera';
import WarehouseLoader from './components/WarehouseLoader';
import ProcessadorMovimentacoes from './components/ProcessadorMovimentacoes';
import FardamentoAdmissoes from './components/FardamentoAdmissoes';
import OficinaEletrica from './components/OficinaEletrica';
import ConsultaPedidos from './components/ConsultaPedidos';
import GestaoExpedicao from './components/GestaoExpedicao';
import MonitorCompras from './components/MonitorCompras';
import DevolucaoAtivos from './components/DevolucaoAtivos';
import OverhaulManager from './components/OverhaulManager';
import MedicaoProprios from './components/MedicaoProprios';
import FaceOnboarding from './components/FaceOnboarding';
import EquipeOnlineWidget from './components/EquipeOnlineWidget';
import { useAuth } from './context/AuthContext';
import { SiteDailyReport, ProjectSite, PredefinedUniform } from './types';
import { SEED_REPORTS, PROJECT_SITES, PREDEFINED_UNIFORMS } from './data';
import { Shield, Database, CheckCircle, Radio } from 'lucide-react';
import { logHubEvent, db, isFirebaseConfigured, collection, onSnapshot, doc, setDoc, deleteDoc, getDocs } from './lib/firebase';
import WindowManager from './layout/WindowManager';

// ============================================================================
// GLOBAL COMPONENT ERROR BOUNDARY IN APP SGI
// ============================================================================
export interface ErrorBoundaryProps {
  children?: ReactNode;
  fallbackMessage?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary em App.tsx detectou erro fatal:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-2xl w-full p-8 border-2 border-red-500/30 bg-slate-950 rounded-3xl m-4 text-center space-y-6 shadow-2xl">
            <div className="inline-flex p-4 bg-red-400/10 rounded-full text-red-400 ring-4 ring-red-400/10">
              <svg className="w-10 h-10 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black uppercase tracking-wider text-red-400">
                Ops! Ocorreu um Erro de Renderização
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                {this.props.fallbackMessage || 'Houve uma falha inesperada ao atualizar a interface deste painel de controle (pode haver dados com formatos incompatíveis vindos do banco).'}
              </p>
            </div>
            {this.state.error && (
              <pre className="text-xs bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-left overflow-auto border border-slate-800 max-h-64">
                {this.state.error.toString() + "\n" + this.state.error.stack}
              </pre>
            )}
            <div className="pt-2 flex justify-center gap-4">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition duration-150 shadow-lg cursor-pointer"
              >
                Recarregar Página Completa
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.hash = '';
                  window.location.reload();
                }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition duration-150 cursor-pointer"
              >
                Voltar ao Menu Principal (HUB)
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentApp, setCurrentApp] = useState<'hub' | 'uniformes-efetivo' | 'mobilizacao-bi' | 'abastecimento-mobilizacoes' | 'fluxo-oficina' | 'previsao-he' | 'admin' | 'portal-inventario' | 'atendimento-requisicoes' | 'agendamento-munck' | 'processar-movimentacoes' | 'central-fardamento' | 'oficina-eletrica' | 'consulta-pedidos' | 'gestao-expedicao' | 'monitor-compras' | 'devolucao-ativos' | 'overhaul-2026' | 'medicao-proprios' | 'biometria-facial'>('hub');
  const [medicaoTab, setMedicaoTab] = useState<'obras' | 'bi'>('bi');
  const [activeView, setActiveView] = useState<'storekeeper' | 'central'>('storekeeper');
  
  const handleNavigateApp = (app: string, tab?: string) => {
    if (tab) {
      setMedicaoTab(tab as 'obras' | 'bi');
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.pushState({}, '', url.toString());
      } catch (e) {
        console.error('Erro ao atualizar parâmetros da URL:', e);
      }
    }
    setCurrentApp(app as any);
  };
  
  // Custom SPA Routing State / Route Guards
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
  // Dynamic Project Sites State (Initialized with defaults)
  const [projectSites, setProjectSites] = useState<ProjectSite[]>(() => {
    const saved = localStorage.getItem('industrial_warehouse_sites_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error('Falha ao restaurar frentes:', err);
      }
    }
    return PROJECT_SITES;
  });

  // Dynamic Uniform Options State (Initialized with defaults)
  const [predefinedUniforms, setPredefinedUniforms] = useState<PredefinedUniform[]>(() => {
    const saved = localStorage.getItem('industrial_warehouse_uniforms_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error('Falha ao restaurar catálogo de uniformes:', err);
      }
    }
    return PREDEFINED_UNIFORMS;
  });

  // Local Database simulation for Reports
  const [reports, setReports] = useState<SiteDailyReport[]>(() => {
    const saved = localStorage.getItem('industrial_warehouse_reports_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error('Falha ao restaurar relatórios:', err);
      }
    }
    return [];
  });

  // Dynamic list of authorized PINs
  const [allowedPins, setAllowedPins] = useState<string[]>(() => {
    const saved = localStorage.getItem('central_panel_pins_list');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {}
    }
    return ['04632076376', '300623', '00410482021'];
  });

  const [fullAllowedPins, setFullAllowedPins] = useState<any[]>([]);

  // Sincronização em tempo real dos PINs cadastrados diretamente no Firestore
  useEffect(() => {
    const defaultPins = [
      {
        id: '04632076376',
        pin: '04632076376',
        nome: 'André Ramalho - Administrador Geral',
        usuario: 'ramalho.andre',
        cargo: 'Coordenador',
        timestamp: new Date().toISOString()
      },
      {
        id: '300623',
        pin: '300623',
        nome: 'Equipe de Almoxarifado Principal',
        usuario: 'almox.principal',
        cargo: 'Almoxarife',
        timestamp: new Date().toISOString()
      },
      {
        id: '00410482021',
        pin: '00410482021',
        nome: 'Planejamento e Fiscalização CMPC Industrial',
        usuario: 'planejamento.cmpc',
        cargo: 'Coordenador',
        timestamp: new Date().toISOString()
      },
      {
        id: '1903',
        pin: '1903',
        nome: 'Controle de Auditoria Externa SGI',
        usuario: 'auditoria.sgi',
        cargo: 'Auditor',
        timestamp: new Date().toISOString()
      },
      {
        id: '1011',
        pin: '1011',
        nome: 'IVANILDO SANTOS RABELO',
        usuario: 'ivanildo.rabelo',
        cargo: 'Almoxarife',
        timestamp: new Date().toISOString()
      },
      {
        id: '2841',
        pin: '2841',
        nome: 'ALINE PINHEIRO LEAL',
        usuario: 'aline.leal',
        cargo: 'Almoxarife',
        timestamp: new Date().toISOString()
      },
      {
        id: '1012',
        pin: '1012',
        nome: 'FABIO JOSE PEREIRA DE OLIVEIRA',
        usuario: 'fabio.oliveira',
        cargo: 'Almoxarife',
        timestamp: new Date().toISOString()
      },
      {
        id: '1013',
        pin: '1013',
        nome: 'ERECIAS SILVA DIAS',
        usuario: 'erecias.dias',
        cargo: 'Almoxarife',
        timestamp: new Date().toISOString()
      },
      {
        id: '1014',
        pin: '1014',
        nome: 'WIDERLEY VIEIRA DA SILVA',
        usuario: 'widerley.silva',
        cargo: 'Almoxarife',
        timestamp: new Date().toISOString()
      },
      {
        id: '1015',
        pin: '1015',
        nome: 'JOSE SANTANA BARBOSA',
        usuario: 'jose.barbosa',
        cargo: 'Almoxarife',
        timestamp: new Date().toISOString()
      },
      {
        id: '1016',
        pin: '1016',
        nome: 'JORGE LUIS FERREIRA MENDES',
        usuario: 'jorge.mendes',
        cargo: 'Almoxarife',
        timestamp: new Date().toISOString()
      },
      {
        id: '1017',
        pin: '1017',
        nome: 'ALEX SANDRO SILVA DE OLIVEIRA',
        usuario: 'alex.sandro',
        cargo: 'Auxiliar',
        timestamp: new Date().toISOString()
      },
      {
        id: '1018',
        pin: '1018',
        nome: 'THAYS SILVA LISBOA',
        usuario: 'thays.lisboa',
        cargo: 'Auxiliar',
        timestamp: new Date().toISOString()
      },
      {
        id: '1019',
        pin: '1019',
        nome: 'EDUARDO NUNES DOS SANTOS JUNIOR',
        usuario: 'eduardo.junior',
        cargo: 'Auxiliar',
        timestamp: new Date().toISOString()
      }
    ];

    const loadFallbackPins = () => {
      const savedListStr = localStorage.getItem('central_panel_pins_list');
      const savedFullPinsStr = localStorage.getItem('central_panel_full_pins_list');

      if (savedListStr && savedFullPinsStr) {
        try {
          setAllowedPins(JSON.parse(savedListStr));
          setFullAllowedPins(JSON.parse(savedFullPinsStr));
          return;
        } catch (_) {}
      }

      // Se falhar ou estiver vazio, usa os padrões hardcoded
      const sortedList = defaultPins.map(p => p.pin).sort((a, b) => {
        if (a === '04632076376') return -1;
        if (b === '04632076376') return 1;
        return 0;
      });
      const sortedFullPins = [...defaultPins].sort((a, b) => {
        if (a.pin === '04632076376') return -1;
        if (b.pin === '04632076376') return 1;
        return 0;
      });
      setAllowedPins(sortedList);
      setFullAllowedPins(sortedFullPins);
    };

    if (isFirebaseConfigured() && db) {
      const unsub = onSnapshot(collection(db, 'allowed_pins'), (snapshot) => {
        const pinsList: string[] = [];
        const fullPins: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.pin) {
            pinsList.push(data.pin);
            fullPins.push(data);
          }
        });
        
        if (pinsList.length === 0) {
          // Inicializar PINs padrão se a coleção estiver limpa no Firestore
          defaultPins.forEach(item => {
            setDoc(doc(db, 'allowed_pins', item.id), item).catch(err => {
              console.error("Erro ao inicializar PIN:", err);
            });
          });
          // Força carregar locais enquanto inicializa
          loadFallbackPins();
        } else {
          // Ordenar PINs para que o master admin (04632076376) fique sempre em primeiro e remover filtros limitadores
          const sortedList = [...pinsList].sort((a, b) => {
            if (a === '04632076376') return -1;
            if (b === '04632076376') return 1;
            return 0;
          });
          const sortedFullPins = [...fullPins].sort((a, b) => {
            if (a.pin === '04632076376') return -1;
            if (b.pin === '04632076376') return 1;
            return 0;
          });
          setAllowedPins(sortedList);
          setFullAllowedPins(sortedFullPins);
          localStorage.setItem('central_panel_pins_list', JSON.stringify(sortedList));
          localStorage.setItem('central_panel_full_pins_list', JSON.stringify(sortedFullPins));
        }
      }, (err) => {
        console.warn('Error listening to allowed_pins (using local cache fallback):', err);
        loadFallbackPins();
      });
      return () => unsub();
    } else {
      loadFallbackPins();
    }
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Sync pull from backend
  const pullFromServer = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const res = await fetch('/api/sync');
      if (!res.ok) throw new Error('Não foi possível conectar com a nuvem.');
      const data = await res.json();
      
      if (data) {
        // Robust recovery for Project Sites
        const localSitesJson = localStorage.getItem('industrial_warehouse_sites_v2');
        let localSites: ProjectSite[] = [];
        if (localSitesJson) {
          try {
            localSites = JSON.parse(localSitesJson);
          } catch (e) {}
        }
        
        if (Array.isArray(data.projectSites)) {
          // If server returned default/empty sites, but local has customized/more sites, prioritize local
          if (localSites.length > data.projectSites.length) {
            setProjectSites(localSites);
          } else {
            setProjectSites(data.projectSites);
          }
        }

        // Robust recovery for Predefined Uniforms catalog
        const localUniformsJson = localStorage.getItem('industrial_warehouse_uniforms_v2');
        let localUniforms: PredefinedUniform[] = [];
        if (localUniformsJson) {
          try {
            localUniforms = JSON.parse(localUniformsJson);
          } catch (e) {}
        }

        if (Array.isArray(data.predefinedUniforms)) {
          if (localUniforms.length > data.predefinedUniforms.length) {
            setPredefinedUniforms(localUniforms);
          } else {
            setPredefinedUniforms(data.predefinedUniforms);
          }
        }

        if (Array.isArray(data.reports)) {
          // Robust synchronization: Load client-side local backup to merge with server data.
          const localReportsJson = localStorage.getItem('industrial_warehouse_reports_v2');
          let localReports: SiteDailyReport[] = [];
          if (localReportsJson) {
            try {
              localReports = JSON.parse(localReportsJson);
            } catch (e) {}
          }

          // Merge by distinct ID to prevent duplicates and keep all records safe
          const mergedMap = new Map<string, SiteDailyReport>();
          
          // 1. Add all local records
          localReports.forEach(r => {
            if (r && r.id) mergedMap.set(r.id, r);
          });
          
          // 2. Add server records (overwrites with latest server truth if there's any conflict, keeping both sets)
          data.reports.forEach((r: SiteDailyReport) => {
            if (r && r.id) mergedMap.set(r.id, r);
          });

          const mergedReports = Array.from(mergedMap.values());
          
          // Sort chronologically (newest first)
          mergedReports.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return b.submittedAt.localeCompare(a.submittedAt);
          });

          setReports(mergedReports);

          // If local storage had records that the server is missing (e.g., container was redeployed/reset),
          // push the merged list back to the server to resurrect the database.
          if (mergedReports.length > data.reports.length) {
            fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectSites: localSites.length > (data.projectSites?.length || 0) ? localSites : data.projectSites,
                predefinedUniforms: localUniforms.length > (data.predefinedUniforms?.length || 0) ? localUniforms : data.predefinedUniforms,
                reports: mergedReports,
                allowedPins: data.allowedPins || allowedPins
              })
            }).catch(err => console.error('Erro ao harmonizar dados com o servidor:', err));
          }
        }
        if (Array.isArray(data.allowedPins) && data.allowedPins.length > 0) {
          setAllowedPins(data.allowedPins);
        }
        setLastSynced(new Date().toLocaleTimeString());
        setSyncError(null);
      }
    } catch (err: any) {
      console.warn('Erro na sincronização:', err);
      if (!silent) setSyncError('Falha ao conectar com o servidor central.');
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  // Sync push to backend
  const pushToServer = async (
    sitesToSync = projectSites,
    uniformsToSync = predefinedUniforms,
    reportsToSync = reports,
    pinsToSync = allowedPins
  ) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSites: sitesToSync,
          predefinedUniforms: uniformsToSync,
          reports: reportsToSync,
          allowedPins: pinsToSync
        })
      });
      if (!res.ok) throw new Error('Falha ao atualizar dados na nuvem.');
      const data = await res.json();
      if (data && data.success) {
        setLastSynced(new Date().toLocaleTimeString());
        setSyncError(null);
      }
    } catch (err: any) {
      console.error('Erro de sincronização ao enviar para o servidor:', err);
      setSyncError('Erro ao publicar os dados no banco central.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Run initial pull on mount (silent so startup delays don't show false error)
  useEffect(() => {
    pullFromServer(true);
  }, []);

  // Update localStorage mirrors on state mutations
  useEffect(() => {
    localStorage.setItem('industrial_warehouse_sites_v2', JSON.stringify(projectSites));
  }, [projectSites]);

  useEffect(() => {
    localStorage.setItem('industrial_warehouse_uniforms_v2', JSON.stringify(predefinedUniforms));
  }, [predefinedUniforms]);

  useEffect(() => {
    localStorage.setItem('industrial_warehouse_reports_v2', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem('central_panel_pins_list', JSON.stringify(allowedPins));
  }, [allowedPins]);

  // Handler update methods used by components
  const handleUpdateSites = async (newSites: ProjectSite[]) => {
    const valAnterior = JSON.stringify(projectSites);
    setProjectSites(newSites);
    await pushToServer(newSites, predefinedUniforms, reports, allowedPins);
    try {
      await logHubEvent({
        type: 'hub_update',
        itemName: 'Sites de Projeto',
        valAnterior,
        valNovo: JSON.stringify(newSites)
      });
    } catch (e) {}
  };

  const handleUpdateUniforms = async (newUniforms: PredefinedUniform[]) => {
    const valAnterior = JSON.stringify(predefinedUniforms);
    setPredefinedUniforms(newUniforms);
    await pushToServer(projectSites, newUniforms, reports, allowedPins);
    try {
      await logHubEvent({
        type: 'hub_update',
        itemName: 'Catálogo de Uniformes',
        valAnterior,
        valNovo: JSON.stringify(newUniforms)
      });
    } catch(e) {}
  };

  const handleUpdatePins = async (newPins: string[]) => {
    const valAnterior = JSON.stringify(allowedPins);
    setAllowedPins(newPins);
    await pushToServer(projectSites, predefinedUniforms, reports, newPins);
    try {
      await logHubEvent({
        type: 'hub_update',
        itemName: 'PINs Autorizados',
        valAnterior,
        valNovo: JSON.stringify(newPins)
      });
    } catch(e){}
  };

  const handleResetAllReports = async () => {
    const valAnterior = `${reports.length} relatórios`;
    setReports([]);
    await pushToServer(projectSites, predefinedUniforms, [], allowedPins);
    try {
      await logHubEvent({
        type: 'hub_update',
        itemName: 'Exclusão Geral de Relatórios de Almoxarifado',
        valAnterior,
        valNovo: 'Nenhum relatório (base de dados resetada)'
      });
    } catch(e){}
  };

  // Handler for adding new site storekeeper reports into database
  const handleAddNewReport = async (newReport: SiteDailyReport) => {
    const valAnterior = `${reports.length} relatórios`;
    const updatedReports = [newReport, ...reports];
    setReports(updatedReports);
    await pushToServer(projectSites, predefinedUniforms, updatedReports, allowedPins);
    try {
      await logHubEvent({
        type: 'hub_update',
        itemName: 'Novo Relatório Diário de Obra',
        valAnterior,
        valNovo: `${updatedReports.length} relatórios (Adicionado ID: ${newReport.id} para ${newReport.siteName})`
      });
    } catch(e){}
  };

  const { session, isLoading: isAuthLoading } = useAuth();

  // Route Guard / Redirect logic
  useEffect(() => {
    if (!isAuthLoading) {
      if (!session) {
        // Redireciona usuários não logados acessando /dashboard ou rotas internas para /login
        if (window.location.pathname !== '/login') {
          window.history.replaceState({}, '', '/login');
          setPath('/login');
        }
      } else {
        // Redireciona usuários logados que tentam acessar /login ou raiz para /dashboard
        if (window.location.pathname === '/login' || window.location.pathname === '/') {
          window.history.replaceState({}, '', '/dashboard');
          setPath('/dashboard');
        }
      }
    }
  }, [session, isAuthLoading]);

  if (isAuthLoading) {
    return <WarehouseLoader />;
  }

  if (!session) {
    return <LoginGatekeeper />;
  }

  if (session.status !== 'Aprovado') {
    return <TelaEspera />;
  }

  return (
    <>
      <WindowManager 
        reports={reports}
        projectSites={projectSites}
        predefinedUniforms={predefinedUniforms}
        allowedPins={allowedPins}
        fullAllowedPins={fullAllowedPins}
        onUpdateSites={handleUpdateSites}
        onUpdateUniforms={handleUpdateUniforms}
        onUpdatePins={handleUpdatePins}
        onResetReports={handleResetAllReports}
        isSyncing={isSyncing}
        lastSynced={lastSynced}
        syncError={syncError}
        onManualSync={() => pullFromServer()}
        handleAddNewReport={handleAddNewReport}
        handleNavigateApp={handleNavigateApp}
        medicaoTab={medicaoTab}
        onAddPin={async (pin: string, nome: string, usuario: string, cargo = 'Almoxarife') => {
          if (isFirebaseConfigured() && db) {
            const docId = usuario.trim().toLowerCase();
            const isAlmoxarife = cargo === 'Almoxarife';
            const finalPin = isAlmoxarife ? '1234' : pin;

            await setDoc(doc(db, 'allowed_pins', docId), {
              id: docId,
              pin: finalPin,
              nome,
              usuario: docId,
              cargo,
              primeiroAcesso: isAlmoxarife, // Ativa primeiro acesso apenas para almoxarifes
              timestamp: new Date().toISOString()
            });

            const newPins = [...allowedPins];
            if (!newPins.includes(finalPin)) {
              newPins.push(finalPin);
            }
            await pushToServer(projectSites, predefinedUniforms, reports, newPins);
          }
        }}
        onDeletePin={async (pinToDelete: string) => {
          if (isFirebaseConfigured() && db) {
            // Deletar o documento correspondente ao PIN ou ID de usuário
            // Tenta deletar usando o doc id como o PIN
            await deleteDoc(doc(db, 'allowed_pins', pinToDelete));
            
            // Também busca qualquer documento que tenha este pin associado ou usuario associado e remove
            const snapshot = await getDocs(collection(db, 'allowed_pins'));
            snapshot.forEach(async (docSnap) => {
              const data = docSnap.data();
              if (docSnap.id === pinToDelete || data.pin === pinToDelete || data.usuario === pinToDelete) {
                await deleteDoc(doc(db, 'allowed_pins', docSnap.id));
              }
            });

            const newPins = allowedPins.filter(p => p !== pinToDelete);
            await pushToServer(projectSites, predefinedUniforms, reports, newPins);
          }
        }}
      />
      <EquipeOnlineWidget />
    </>
  );
}
