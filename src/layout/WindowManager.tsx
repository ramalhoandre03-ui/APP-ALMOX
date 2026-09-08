import React, { useState, useEffect } from 'react';
import { viewsImunesInatividade } from '../hooks/useLocation';
import HubLanding from '../components/HubLanding';
import MobilizacaoView from '../components/MobilizacaoView';
import InventoryPortal from '../components/InventoryPortal';
import ChecklistView from "../components/ChecklistView";
import RequisicoesPanel from '../components/RequisicoesPanel';
import AgendamentoMunck from '../components/AgendamentoMunck';
import ProcessadorMovimentacoes from '../components/ProcessadorMovimentacoes';
import FardamentoAdmissoes from '../components/FardamentoAdmissoes';
import OficinaEletrica from '../components/OficinaEletrica';
import ConsultaPedidos from '../components/ConsultaPedidos';
import GestaoExpedicao from '../components/GestaoExpedicao';
import MonitorCompras from '../components/MonitorCompras';
import DevolucaoAtivos from '../components/DevolucaoAtivos';
import OverhaulManager from '../components/OverhaulManager';
import MedicaoProprios from '../components/MedicaoProprios';
import FluxoOficina from '../components/FluxoOficina';
import ExtraHoursPanel from '../components/ExtraHoursPanel';
import FaceOnboarding from '../components/FaceOnboarding';
import AdminPanel from '../components/AdminPanel';

import Header from '../components/Header';
import StorekeeperPanel from '../components/StorekeeperPanel';
import CentralPanel from '../components/CentralPanel';

export type ViewType = 'HUB' | string;

export interface Tab {
  id: string;
  title: string;
  view: ViewType;
  props?: any;
}

const viewToPathMap: Record<string, string> = {
  'previsao-he': '/previsao-horas',
  'portal-inventario': '/inventario',
  'gestao-expedicao': '/expedicao',
  'central-fardamento': '/fardamentos-admissoes',
  'oficina-eletrica': '/oficina-eletrica',
  'CHECKLIST': '/inspecoes',
  'HUB': '/dashboard'
};

export default function WindowManager(props: any) {
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'tab-root', title: 'Hub Central', view: 'HUB' }]);
  const [activeTab, setActiveTab] = useState<string>('tab-root');

  // Used for 'uniformes-efetivo' legacy internal state
  const [activeView, setActiveView] = useState<'storekeeper' | 'central'>('storekeeper');

  const currentTab = tabs.find(t => t.id === activeTab);
  const isCurrentTabImmune = currentTab ? viewsImunesInatividade.includes(currentTab.view) : false;

  // Sincroniza a URL e dispara eventos de rota quando a aba ativa muda
  useEffect(() => {
    if (currentTab) {
      const targetPath = viewToPathMap[currentTab.view] || (currentTab.view === 'HUB' ? '/dashboard' : `/app/${currentTab.view}`);
      try {
        if (window.location.pathname !== targetPath) {
          window.history.replaceState({}, '', targetPath);
          window.dispatchEvent(new Event('locationchange'));
        }
      } catch {}
    }
  }, [activeTab, currentTab]);

  const openTab = (view: ViewType, title: string, additionalProps?: any) => {
    // Optional: check if tab already exists to avoid duplicates, but user prompt says create new id
    const newId = `tab-${Math.random().toString(36).substring(2, 9)}`;
    setTabs([...tabs, { id: newId, title, view, props: additionalProps }]);
    setActiveTab(newId);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return; // Proteção: nunca fecha a última aba
    
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTab === id) {
      setActiveTab(newTabs[newTabs.length - 1].id);
    }
  };

  const renderView = (tab: Tab) => {
    switch(tab.view) {
      case 'HUB':
        return <HubLanding 
                 onSelectApp={() => {}} 
                 onOpenApp={openTab} 
                 reportCount={props.reports?.length || 0} 
                 allowedPins={props.allowedPins} 
               />;
      case 'portal-inventario':
        return <InventoryPortal onBackToHub={() => {}} allowedPins={props.allowedPins} fullAllowedPins={props.fullAllowedPins} />;
      case 'atendimento-requisicoes':
        return <RequisicoesPanel onBackToHub={() => {}} allowedPins={props.allowedPins} fullAllowedPins={props.fullAllowedPins} />;
      case 'agendamento-munck':
        return <AgendamentoMunck onBackToHub={() => {}} />;
      case 'processar-movimentacoes':
        return <ProcessadorMovimentacoes onBackToHub={() => {}} />;
      case 'central-fardamento':
        return <FardamentoAdmissoes onBackToHub={() => {}} allowedPins={props.allowedPins} fullAllowedPins={props.fullAllowedPins} />;
      case 'CHECKLIST':
        return <ChecklistView />;
      case 'oficina-eletrica':
        return <OficinaEletrica onBackToHub={() => {}} />;
      case 'consulta-pedidos':
        return <ConsultaPedidos onBackToHub={() => {}} />;
      case 'gestao-expedicao':
        return <GestaoExpedicao onBackToHub={() => {}} />;
      case 'monitor-compras':
        return (
          <div className="min-h-screen bg-slate-950 p-3 sm:p-6 lg:p-8 flex flex-col w-full">
            <MonitorCompras onClose={() => {}} variant="standalone" className="w-full" />
          </div>
        );
      case 'devolucao-ativos':
        return <DevolucaoAtivos onBackToHub={() => {}} />;
      case 'overhaul-2026':
        return <OverhaulManager onBackToHub={() => {}} onNavigateApp={props.handleNavigateApp} />;
      case 'medicao-proprios':
        return <MedicaoProprios onBackToHub={() => {}} initialTab={props.medicaoTab} />;
      case 'mobilizacao-bi':
      case 'abastecimento-mobilizacoes':
      case 'MOBILIZACAO':
        return <MobilizacaoView onBackToHub={() => {}} {...tab.props} />;
      case 'fluxo-oficina':
        return <FluxoOficina onBackToHub={() => {}} />;
      case 'previsao-he':
        return <ExtraHoursPanel onBackToHub={() => {}} allowedPins={props.allowedPins} />;
      case 'biometria-facial':
        return <FaceOnboarding onBack={() => {}} />;
      case 'admin':
        return <AdminPanel
          onBackToHub={() => {}}
          reports={props.reports}
          projectSites={props.projectSites}
          onUpdateSites={props.onUpdateSites}
          predefinedUniforms={props.predefinedUniforms}
          onUpdateUniforms={props.onUpdateUniforms}
          allowedPins={props.allowedPins}
          fullAllowedPins={props.fullAllowedPins}
          onAddPin={props.onAddPin}
          onDeletePin={props.onDeletePin}
          onUpdatePins={props.onUpdatePins}
          onResetReports={props.onResetReports}
          isSyncing={props.isSyncing}
          lastSynced={props.lastSynced}
          syncError={props.syncError}
          onManualSync={props.onManualSync}
        />;
      case 'uniformes-efetivo':
        return (
          <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col font-sans h-full overflow-y-auto">
            <Header 
              activeView={activeView} 
              setActiveView={setActiveView} 
              reportCount={props.reports?.length || 0} 
              onBackToHub={() => {}}
            />
            <main className="flex-grow">
              {activeView === 'storekeeper' ? (
                <StorekeeperPanel 
                  onAddReport={props.handleAddNewReport} 
                  projectSites={props.projectSites} 
                  predefinedUniforms={props.predefinedUniforms} 
                />
              ) : (
                <CentralPanel 
                  reports={props.reports} 
                  projectSites={props.projectSites}
                  onUpdateSites={props.onUpdateSites}
                  predefinedUniforms={props.predefinedUniforms}
                  onUpdateUniforms={props.onUpdateUniforms}
                  allowedPins={props.allowedPins}
                  onUpdatePins={props.onUpdatePins}
                  onResetReports={props.onResetReports}
                  isSyncing={props.isSyncing}
                  lastSynced={props.lastSynced}
                  syncError={props.syncError}
                  onManualSync={props.onManualSync}
                />
              )}
            </main>
          </div>
        );
      default:
        return <div className="p-12 text-slate-500 font-medium text-center">Módulo não encontrado ou em construção...</div>;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 font-sans">
      
      {/* BARRA DE ABAS (Estilo Navegador Moderno) */}
      <div className="flex bg-slate-200 border-b border-slate-300 px-2 pt-2 gap-1 overflow-x-auto hide-scrollbar select-none shadow-sm z-20">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex items-center px-4 py-2 min-w-[160px] max-w-[240px] cursor-pointer rounded-t-lg border transition-all ${
              activeTab === tab.id 
                ? 'bg-white border-slate-300 border-b-white text-indigo-800 z-10 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]' 
                : 'bg-slate-200 border-transparent text-slate-500 hover:bg-slate-300/60 hover:text-slate-700 border-b-slate-300'
            }`}
            style={{ marginBottom: activeTab === tab.id ? '-1px' : '0' }}
          >
            {/* Bolinha de status da aba */}
            <div className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${activeTab === tab.id ? 'bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]' : 'bg-slate-400'}`}></div>
            
            <span className="truncate flex-1 text-sm font-semibold">{tab.title}</span>
            
            {/* Botão de Fechar Aba */}
            {tabs.length > 1 && (
              <button 
                onClick={(e) => closeTab(tab.id, e)} 
                className={`ml-2 rounded-full w-5 h-5 flex items-center justify-center transition-all ${
                  activeTab === tab.id 
                    ? 'text-slate-400 hover:bg-slate-100 hover:text-red-500' 
                    : 'text-transparent group-hover:text-slate-400 hover:bg-slate-300 hover:text-red-500'
                }`}
                title="Fechar Aba"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        
        {/* Botão de Nova Aba */}
        <button 
          onClick={() => openTab('HUB', 'Nova Janela')} 
          className="ml-1 mb-1 px-3 py-1 text-slate-500 hover:text-indigo-700 hover:bg-slate-300/60 rounded-md transition-colors font-bold flex items-center justify-center text-lg"
          title="Nova Aba"
        >
          +
        </button>
      </div>

      {/* Marcador DOM para detecção de tela operacional imune à inatividade */}
      {isCurrentTabImmune && (
        <div 
          id="active-immune-module-flag" 
          data-immune-module="true" 
          data-module-name={currentTab?.title}
          className="hidden" 
          style={{ display: 'none' }} 
        />
      )}

      {/* ÁREA DE CONTEÚDO (Scroll Corrigido) */}
      <div className="flex-1 w-full bg-white overflow-y-auto">
        {tabs.map(tab => (
          <div 
            key={tab.id} 
            className="w-full min-h-full"
            style={{ display: activeTab === tab.id ? 'block' : 'none' }}
          >
            {renderView(tab)}
          </div>
        ))}
      </div>
      
    </div>
  );
}
