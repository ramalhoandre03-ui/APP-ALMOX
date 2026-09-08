/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SiteDailyReport, ShiftType, ProjectSite, PredefinedUniform } from '../types';
import { PREDEFINED_MATERIALS } from '../data';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Search, 
  SlidersHorizontal, 
  Eye, 
  Download, 
  TrendingUp, 
  PenTool, 
  Activity, 
  AlertTriangle, 
  Wrench, 
  Shirt, 
  Clock, 
  ArrowUpDown, 
  Calendar,
  X,
  Users,
  ClipboardList,
  Lock,
  Unlock,
  Settings,
  Trash2,
  Plus,
  RefreshCw,
  Info
} from 'lucide-react';

interface CentralPanelProps {
  reports: SiteDailyReport[];
  projectSites: ProjectSite[];
  onUpdateSites: (sites: ProjectSite[]) => void;
  predefinedUniforms: PredefinedUniform[];
  onUpdateUniforms: (uniforms: PredefinedUniform[]) => void;
  allowedPins: string[];
  onUpdatePins: (pins: string[]) => void;
  onResetReports: () => void;
  isSyncing: boolean;
  lastSynced: string | null;
  syncError: string | null;
  onManualSync: () => void;
}

export default function CentralPanel({ 
  reports, 
  projectSites, 
  onUpdateSites, 
  predefinedUniforms, 
  onUpdateUniforms,
  allowedPins,
  onUpdatePins,
  onResetReports,
  isSyncing,
  lastSynced,
  syncError,
  onManualSync
}: CentralPanelProps) {
  // Authorization State
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return localStorage.getItem('central_panel_authorized_v2') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Central Hub sub-tabs: 'reports' (default analytics) vs 'daily_results'
  const [centralView, setCentralView] = useState<'reports' | 'daily_results'>('reports');
  const [selectedDailySiteId, setSelectedDailySiteId] = useState<string>('');

  // Form state for adding new Project site options
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [newSiteClient, setNewSiteClient] = useState('');
  const [newSiteManager, setNewSiteManager] = useState('');
  const [siteFormError, setSiteFormError] = useState<string | null>(null);
  const [siteFormSuccess, setSiteFormSuccess] = useState(false);

  // Form state for adding new Uniform catalog options
  const [newUniformName, setNewUniformName] = useState('');
  const [newUniformSizes, setNewUniformSizes] = useState('P, M, G, GG'); // default placeholder sizes
  const [uniformFormError, setUniformFormError] = useState<string | null>(null);
  const [uniformFormSuccess, setUniformFormSuccess] = useState(false);

  // Filters State
  const [siteFilter, setSiteFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State for Viewing Report Details
  const [selectedReport, setSelectedReport] = useState<SiteDailyReport | null>(null);

  const [newPinCode, setNewPinCode] = useState('');
  const [pinFormError, setPinFormError] = useState<string | null>(null);
  const [pinFormSuccess, setPinFormSuccess] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (allowedPins.includes(passcode.trim())) {
      setIsAuthorized(true);
      setLoginError(false);
      localStorage.setItem('central_panel_authorized_v2', 'true');
    } else {
      setLoginError(true);
    }
  };

  const handleAddPinCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = newPinCode.trim();
    if (!cleanPin) {
      setPinFormError('O código PIN não pode estar em branco.');
      return;
    }
    if (cleanPin.length < 4) {
      setPinFormError('O código PIN deve ter ao menos 4 dígitos.');
      return;
    }
    if (allowedPins.includes(cleanPin)) {
      setPinFormError('Este PIN já está cadastrado.');
      return;
    }

    const updated = [...allowedPins, cleanPin];
    onUpdatePins(updated);
    setNewPinCode('');
    setPinFormError(null);
    setPinFormSuccess(true);
    setTimeout(() => setPinFormSuccess(false), 3000);
  };

  const handleDeletePinCode = (pinToDelete: string) => {
    if (allowedPins.length <= 1) {
      alert('Não é possível remover o último PIN de acesso para evitar o bloqueio completo do sistema.');
      return;
    }
    if (confirm(`Tem certeza que deseja remover o PIN "${pinToDelete}"? Esta pessoa perderá acesso ao painel.`)) {
      const updated = allowedPins.filter(p => p !== pinToDelete);
      onUpdatePins(updated);
    }
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    setPasscode('');
    localStorage.removeItem('central_panel_authorized_v2');
  };

  // CRUD for Frentes de Obra / Config
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
  };

  const handleDeleteProjectSite = (id: string) => {
    onUpdateSites(projectSites.filter(s => s.id !== id));
  };

  // CRUD for Predefined Uniform configurations
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
  };

  const handleDeleteUniformOption = (id: string) => {
    onUpdateUniforms(predefinedUniforms.filter(u => u.id !== id));
  };

  // Filter Logic
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesSite = !siteFilter || r.siteId === siteFilter;
      const matchesShift = !shiftFilter || r.shift === shiftFilter;
      const matchesDate = !dateFilter || r.date === dateFilter;
      const matchesQuery = !searchQuery || 
        r.storekeeperName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.siteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.fieldObservations && r.fieldObservations.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesSite && matchesShift && matchesDate && matchesQuery;
    });
  }, [reports, siteFilter, shiftFilter, dateFilter, searchQuery]);

  // Aggregate stats derived from filtered reports
  const stats = useMemo(() => {
    let totalEfetivo = 0;
    let operacional = 0;
    let administrativo = 0;

    // Critical Alerts array for low uniforms stock, etc.
    const localAlerts: Array<{ key: string; title: string; desc: string; type: 'uniform' | 'general' }> = [];

    // Accumulate occurrences that need central warehouse action
    const occurrencesList: Array<{ id: string; siteName: string; date: string; storekeeperName: string; text: string }> = [];

    filteredReports.forEach(r => {
      // Manpower totals list
      const op = r.manpower.operacional || 0;
      const adm = r.manpower.administrativo || 0;
      totalEfetivo += op + adm;
      operacional += op;
      administrativo += adm;

      // Daily Uniform depletion tracking
      r.uniforms.forEach(uni => {
        if (uni.quantity < 5) {
          localAlerts.push({
            key: `uni-${r.id}-${uni.itemId}-${uni.size}-${uni.condition || 'default'}`,
            title: `${r.siteName}`,
            desc: `Estoque crítico de "${uni.itemName}" (TAM: ${uni.size}${uni.condition ? ` / ${uni.condition}` : ''}): Restam apenas ${uni.quantity} unidades disponíveis.`,
            type: 'uniform'
          });
        }
      });

      // Field observations reporting tool
      if (r.fieldObservations && r.fieldObservations.trim()) {
        occurrencesList.push({
          id: r.id,
          siteName: r.siteName,
          date: r.date,
          storekeeperName: r.storekeeperName,
          text: r.fieldObservations
        });
      }
    });

    return {
      totalEfetivo,
      manpowerBreakdown: {
        'Efetivo Operacional': operacional,
        'Efetivo Administrativo': administrativo
      },
      occurrencesList,
      alerts: localAlerts
    };
  }, [filteredReports]);

  // UI Charts Config
  const manpowerChartData = useMemo(() => {
    return Object.entries(stats.manpowerBreakdown).map(([name, value]) => ({
      name,
      'Efetivo': value
    }));
  }, [stats]);

  // Export functions
  const handleExportCSV = () => {
    let csvContent = '\uFEFF';
    csvContent += 'ID;Frente de Obra;Data;Turno;Almoxarife;Efetivo Total;Item;Tamanho;Condicao;Quantidade;Ocorrencia\r\n';

    filteredReports.forEach(r => {
      const totEfet = (Object.values(r.manpower) as number[]).reduce((a, b) => a + b, 0);
      const cleanObs = r.fieldObservations ? r.fieldObservations.replace(/"/g, '""') : '';
      const shiftName = r.shift || '—';

      if (r.uniforms && r.uniforms.length > 0) {
        r.uniforms.forEach(u => {
          const conditionName = u.condition || 'Sem Higienização';
          csvContent += `${r.id};"${r.siteName}";${r.date};"${shiftName}";"${r.storekeeperName}";${totEfet};"${u.itemName}";"${u.size}";"${conditionName}";${u.quantity};"${cleanObs}"\r\n`;
        });
      } else {
        csvContent += `${r.id};"${r.siteName}";${r.date};"${shiftName}";"${r.storekeeperName}";${totEfet};"Nenhum Item";"—";"—";0;"${cleanObs}"\r\n`;
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `consolidado_almoxarifado_detalhado_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto my-12 px-4" id="login-container">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-lg p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>
          
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-100 shadow-inner">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900">Acesso Restrito</h2>
              <p className="text-xs text-slate-450 mt-1 font-sans">
                O Painel Central contém informações gerenciais sensíveis de frentes de obra. Por favor, autentique-se para continuar.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                CÓDIGO PIN DE ACESSO
              </label>
              <input
                id="login-passcode"
                type="password"
                maxLength={11}
                placeholder="••••"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full text-center bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-2xl py-3 px-4 font-bold text-lg tracking-widest text-slate-850 focus:outline-hidden transition-all"
              />
              {loginError && (
                <p className="text-rose-500 text-[10px] font-bold text-center mt-2 uppercase tracking-wide font-sans">
                  Código PIN incorreto. Tente novamente.
                </p>
              )}
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-2xl flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shadow-blue-100"
            >
              <Unlock className="w-4 h-4" />
              <span>DESBLOQUEAR PAINEL</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" id="central-panel-container">
      
      {/* Title block with premium info badge */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-3xl pointer-events-none"></div>
        <div>
          <span className="bg-blue-50 text-blue-600 border border-blue-100 font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 rounded-full inline-block">
            SISTEMA CENTRAL DE MONITORAMENTO
          </span>
          <h2 className="text-2xl font-display font-bold tracking-tight text-slate-900 mt-2">
            Painel Geral do Almoxarifado
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Dados de headcounts e ocorrências integrados pelas frentes de obras em tempo real.
          </p>
        </div>
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setCentralView('reports')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs ${
              centralView === 'reports'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>📊 Estatísticas</span>
          </button>

          <button
            type="button"
            onClick={() => setCentralView('daily_results')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs ${
              centralView === 'daily_results'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>📋 Resultados Diários por Obra</span>
          </button>

          {(centralView === 'reports' || centralView === 'daily_results') && (
            <button
              type="button"
              id="csv-general-export"
              onClick={handleExportCSV}
              disabled={filteredReports.length === 0}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm hover:translate-y-[-1px]"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Exportar CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear</span>
          </button>
        </div>
      </div>

      {centralView === 'daily_results' ? (
        <div className="space-y-6" id="central-daily-results-view">
          {/* Header block of daily results */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold uppercase tracking-widest text-[9px] px-2.5 py-1 rounded-full inline-block">
                  Acompanhamento Diário Cumulativo
                </span>
                <h3 className="text-xl font-display font-bold text-slate-900 tracking-tight">
                  Resultados e Histórico das Frentes de Obra
                </h3>
                <p className="text-xs text-slate-500 max-w-2xl font-sans leading-relaxed">
                  Consulte os relatórios diários de cada canteiro de obras cronologicamente. Este histórico é estritamente cumulativo: novas atualizações diárias são inseridas como novos registros no banco, preservando os boletins anteriores.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-black font-sans">Boletins Salvos</span>
                <p className="text-2xl font-display font-extrabold text-slate-900 font-mono">{reports.length}</p>
              </div>
            </div>
          </div>

          {/* Interactive Site Navigation Switcher Grid */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Selecione uma Frente de Obra para Filtrar:</label>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* Card option: All sites */}
              <button
                type="button"
                onClick={() => setSelectedDailySiteId('')}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all group cursor-pointer ${
                  selectedDailySiteId === ''
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-55'
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold leading-tight group-hover:underline">Todas as Frentes</h4>
                  <p className={`text-[10px] mt-1 ${selectedDailySiteId === '' ? 'text-blue-100' : 'text-slate-400'}`}>
                    Banco completo acumulado
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${selectedDailySiteId === '' ? 'bg-blue-500/50' : 'bg-slate-105 text-slate-700'}`}>
                    {reports.length} registros
                  </span>
                </div>
              </button>

              {/* Individual site options */}
              {projectSites.map(s => {
                const siteReportCount = reports.filter(r => r.siteId === s.id).length;
                const isSelected = selectedDailySiteId === s.id;

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedDailySiteId(s.id)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all group cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-105'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-55'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold leading-tight line-clamp-1 group-hover:underline">{s.name}</h4>
                      <p className={`text-[10px] mt-1 line-clamp-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {s.location} • Gerente: {s.managerName}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-blue-500/50' : 'bg-slate-105 text-slate-600'}`}>
                        {siteReportCount} registros
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table or Timeline details list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-slate-500">
                Linha do Tempo de Entregas ({
                  (selectedDailySiteId === '' ? reports : reports.filter(r => r.siteId === selectedDailySiteId)).length
                } boletins listados)
              </h4>
            </div>

            {(() => {
              const siteReports = selectedDailySiteId === ''
                ? reports
                : reports.filter(r => r.siteId === selectedDailySiteId);

              if (siteReports.length === 0) {
                return (
                  <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400">
                    <Calendar className="w-12 h-12 stroke-1 mx-auto mb-2 text-indigo-500 opacity-60" />
                    <p className="text-xs font-semibold">Nenhum lançamento diário de estoque ou headcount registrado para esta seleção.</p>
                    <p className="text-[10px] mt-1">Os almoxarifes receberão os boletins na central assim que enviarem seus dados.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {siteReports.map((r, reportIndex) => {
                    return (
                      <div
                        key={r.id || reportIndex}
                        className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-5 shadow-xs transition-all flex flex-col md:flex-row md:items-start justify-between gap-6 text-slate-805"
                      >
                        {/* Column 1: Date & Metadata info */}
                        <div className="md:w-1/4 space-y-3 flex-shrink-0">
                          <div>
                            <span className="font-mono text-emerald-700 text-xs font-extrabold bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1 inline-block">
                              Dia {r.date.split('-').reverse().join('/')}
                            </span>
                          </div>
                          
                          <div>
                            <p className="text-xs font-extrabold text-slate-900 leading-tight">{r.siteName}</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-sans">
                              Lançado e Validado via PIN
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="inline-block bg-slate-100 text-[10px] font-bold text-slate-600 py-0.5 px-2.5 rounded-md">
                              {r.shift || 'Sem Turno Registrado'}
                            </span>
                            <span className="inline-block bg-blue-50 text-[10px] text-blue-600 font-bold px-2 py-0.5 rounded-md">
                              Alm. {r.storekeeperName}
                            </span>
                          </div>
                        </div>

                        {/* Column 2: Data items summary */}
                        <div className="flex-grow space-y-4">
                          {/* Sub-headcounts breakdown */}
                          <div className="grid grid-cols-2 gap-3 max-w-sm">
                            <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-center">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Efetivo Operacional</span>
                              <strong className="text-slate-800 text-xs font-mono font-bold">{r.manpower.operacional || 0} pessoas</strong>
                            </div>
                            <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-center">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Efetivo Administrativo</span>
                              <strong className="text-slate-800 text-xs font-mono font-bold">{r.manpower.administrativo || 0} pessoas</strong>
                            </div>
                          </div>

                          {/* Uniform supply breakdown chips row */}
                          <div className="space-y-1.5">
                            <span className="block text-[9px] font-bold text-slate-450 uppercase tracking-widest">ESTOQUES REGISTRADOS NESTA DATA:</span>
                            {r.uniforms.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">Nenhum estoque de uniformes selecionado.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {r.uniforms.map((uni, idx) => (
                                  <div
                                    key={idx}
                                    className="px-2.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-150 text-[11px] flex items-center space-x-1.5"
                                  >
                                    <span className="font-bold text-slate-800">{uni.itemName}</span>
                                    <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded text-[9px] font-bold font-mono">TAM: {uni.size}</span>
                                    {uni.condition && (
                                      <span className={`px-1 rounded text-[9px] font-extrabold ${
                                        uni.condition === 'Higienizado' ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      }`}>
                                        {uni.condition.toUpperCase()}
                                      </span>
                                    )}
                                    <span className="font-bold font-mono text-blue-700 font-extrabold">{uni.quantity} un</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Observations field */}
                          {r.fieldObservations && r.fieldObservations.trim() && (
                            <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-[11px] text-amber-900 leading-relaxed italic pr-8 relative">
                              <span className="absolute right-3 top-3 text-amber-500 font-bold uppercase text-[9px] tracking-wider font-sans">Ocorrência</span>
                              "{r.fieldObservations}"
                            </div>
                          )}
                        </div>

                        {/* Column 3: Action view report button */}
                        <div className="flex items-center justify-end md:w-32 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedReport(r)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs transition-transform hover:-translate-y-px"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Completo</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards Section - Styled like discrete solid Bento slot blocks with different accent lines */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-5" id="kpi-cards-grid">
        
        {/* Metric Card 1 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center space-x-4 relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl group-hover:scale-105 transition-transform duration-300">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lançamentos Recebidos</p>
            <h4 className="text-2xl font-display font-bold text-slate-900 mt-0.5">{filteredReports.length}</h4>
            <p className="text-[9px] text-slate-400 mt-0.5">Frentes operacionais únicas</p>
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center space-x-4 relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl group-hover:scale-105 transition-transform duration-300">
            <Users className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Quantidade Total de Efetivo</p>
            <h4 className="text-2xl font-display font-bold text-slate-900 font-mono mt-0.5">{stats.totalEfetivo} <span className="text-xs font-sans text-slate-500 font-normal">colaboradores</span></h4>
            <p className="text-[9px] text-emerald-600 mt-0.5 font-semibold">Colaboradores ativos hoje</p>
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center space-x-4 relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="bg-indigo-50 text-indigo-700 p-3 rounded-2xl group-hover:scale-105 transition-transform duration-300">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reports de Ocorrência</p>
            <h4 className="text-2xl font-display font-bold text-slate-900 font-mono mt-0.5">{stats.occurrencesList.length} <span className="text-xs font-sans text-slate-500 font-normal">relatos</span></h4>
            <p className="text-[9px] text-indigo-600 mt-0.5 font-semibold">Ressalvas de campo</p>
          </div>
        </div>

      </div>

      {/* Grid: Search, Filters, and Alerts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="filter-section-wrapper">
        
        {/* Filters box (Left 3 cols) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-slate-700 flex items-center space-x-2 border-b border-slate-100 pb-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-500" />
            <span>Filtros do Sistema</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Buscar</label>
              <div className="relative">
                <input
                  id="search-input"
                  type="text"
                  placeholder="Buscar almoxarife ou ocorrência..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl py-2 pl-8 pr-3 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Frente de Trabalho</label>
              <select
                id="site-filter"
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-850 text-xs rounded-xl py-2 px-3 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white cursor-pointer"
              >
                <option value="">Todas as frentes</option>
                {projectSites.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data Efetiva</label>
              <input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl py-2 px-3 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Turno</label>
              <select
                id="shift-filter"
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-850 text-xs rounded-xl py-2 px-3 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white cursor-pointer"
              >
                <option value="">Todos os turnos</option>
                {Object.values(ShiftType).map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              id="clear-filters-btn"
              onClick={() => {
                setSiteFilter('');
                setShiftFilter('');
                setDateFilter('');
                setSearchQuery('');
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer mt-2"
            >
              Limpar Todos os Filtros
            </button>
          </div>
        </div>

        {/* Dynamic Bento Modules (Center 9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Feed de Ocorrências (Replaces original Materials chart) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
            <h4 className="font-display font-semibold text-xs text-slate-800 mb-4 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              <span>Relatos Recentes das Frentes de Obras</span>
            </h4>
            
            {stats.occurrencesList.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <PenTool className="w-10 h-10 mb-2 stroke-1 opacity-50 text-blue-500" />
                <p className="text-xs">Nenhum relato ou restrição reportada no momento.</p>
              </div>
            ) : (
              <div className="h-64 overflow-y-auto space-y-3 pr-1" id="occurrences-scr">
                {stats.occurrencesList.map((oc) => (
                  <div key={oc.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900">{oc.siteName}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{oc.date.split('-').reverse().join('/')}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed italic">
                      "{oc.text}"
                    </p>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 font-medium">— Alm. {oc.storekeeperName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>



        </div>

        {/* Deleted column content as requested */}

      </div>

      {/* Grid: submissions Logs Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden" id="submissions-log-table-block">
        
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h4 className="font-display font-semibold text-slate-800 text-sm">
              Histórico de Lançamentos ({filteredReports.length})
            </h4>
            <span className="text-xs text-slate-400">Verifique os boletins detalhados clicando no ícone do visualizador.</span>
          </div>
          
          <span className="text-xs font-mono text-slate-500 bg-white border border-slate-150 rounded-lg px-2.5 py-1 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Sincronizado</span>
          </span>
        </div>

        {filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar className="w-12 h-12 stroke-1 mx-auto mb-2 text-blue-500 opacity-60" />
            <p className="text-xs">Nenhum registro encontrado para esta pesquisa.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left" id="consolidated-logs-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[9px] text-slate-400 uppercase font-bold tracking-widest">
                  <th className="py-3 px-4">Frente de Obra</th>
                  <th className="py-3 px-4 text-center">Data</th>
                  <th className="py-3 px-4 text-center">Turno</th>
                  <th className="py-3 px-4">Almoxarife</th>
                  <th className="py-3 px-4 text-center">Efetivo Alocado</th>
                  <th className="py-3 px-4 text-center">Itens Uniforme</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredReports.map(r => {
                  const itemsCount = r.uniforms.reduce((acc, curr) => acc + curr.quantity, 0);
                  const totEfet = (Object.values(r.manpower) as number[]).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.siteName}</td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600">{r.date.split('-').reverse().join('/')}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-md">
                          {r.shift || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">{r.storekeeperName}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700 font-mono">{totEfet} pessoas</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-700 font-mono">{itemsCount} un</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          id={`view-details-${r.id}`}
                          onClick={() => setSelectedReport(r)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Visualizar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Modal / Sidebar for Individual Report Details */}
      {selectedReport && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto" id="report-details-modal text-slate-800">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-zoomIn flex flex-col my-8 border border-slate-200">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
              <div>
                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold uppercase tracking-widest text-[9px] px-2.5 py-0.5 rounded-full">
                  BOLETIM DE OBRAS CONSOLIDADO
                </span>
                <h3 className="font-display font-semibold text-base sm:text-lg mt-1">{selectedReport.siteName}</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Lançado por: {selectedReport.storekeeperName} em {new Date(selectedReport.submittedAt).toLocaleDateString()} às {new Date(selectedReport.submittedAt).toLocaleTimeString()}
                </p>
              </div>
              <button
                type="button"
                id="close-modal-btn"
                onClick={() => setSelectedReport(null)}
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal content area */}
            <div className="p-6 overflow-y-auto space-y-6 max-h-[500px]">
              
              {/* Row 1: Date, Shift and Total Personnel */}
              <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center items-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">DATA OPERACIONAL</span>
                  <span className="font-bold text-slate-800 text-sm mt-1">{selectedReport.date.split('-').reverse().join('/')}</span>
                </div>
                <div className="bg-blue-50/20 border border-blue-100/30 rounded-2xl p-4 flex flex-col justify-center items-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">TURNO REGISTRADO</span>
                  <span className="font-bold text-blue-600 text-sm mt-1">{selectedReport.shift || '——'}</span>
                </div>
                <div className="bg-emerald-50/20 border border-emerald-100/30 rounded-2xl p-4 flex flex-col justify-center items-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">EFETIVO DA OBRA</span>
                  <span className="font-bold text-emerald-600 text-sm mt-1 font-mono">
                    {(selectedReport.manpower.operacional || 0) + (selectedReport.manpower.administrativo || 0)} colaboradores
                  </span>
                </div>
              </div>

              {/* Grid: Broken down Manpower */}
              <div className="space-y-2">
                <h4 className="font-display font-semibold text-xs text-slate-500 uppercase tracking-widest flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>Distribuição de Quantitativos</span>
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  {([
                    { label: 'Efetivo Operacional', value: selectedReport.manpower.operacional || 0 },
                    { label: 'Efetivo Administrativo', value: selectedReport.manpower.administrativo || 0 }
                  ]).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-150 text-xs">
                      <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">{item.label}</span>
                      <span className="font-bold text-slate-800 font-mono">{item.value} colaboradores</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid: Uniforms on-site status */}
              <div className="space-y-2">
                <h4 className="font-display font-semibold text-xs text-slate-500 uppercase tracking-widest flex items-center space-x-1.5">
                  <Shirt className="w-4 h-4 text-blue-500" />
                  <span>Níveis de Estoque de Uniformes</span>
                </h4>
                {selectedReport.uniforms.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum estoque de uniforme cadastrado para esta frente.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedReport.uniforms.map((uni, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs shadow-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800">{uni.itemName}</p>
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-bold">TAM: {uni.size}</span>
                            {uni.condition && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                uni.condition === 'Higienizado' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>{uni.condition.toUpperCase()}</span>
                            )}
                          </div>
                        </div>
                        <span className={`font-bold font-mono text-xs px-2.5 py-1 rounded-lg ${
                          uni.quantity < 5 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-white border border-slate-200 text-slate-700'
                        }`}>
                          {uni.quantity} un
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Relato de Ocorrências (New report text box) */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest flex items-center space-x-1.5">
                  <ClipboardList className="w-4 h-4 text-indigo-500" />
                  <span>Ocorrências & Necessidades Reportadas</span>
                </h4>
                {(!selectedReport.fieldObservations || !selectedReport.fieldObservations.trim()) ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center italic">Não foram registradas ocorrências ou necessidades para esta data.</p>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs text-slate-800 leading-relaxed italic relative">
                    <span className="absolute -top-3 left-4 text-3xl font-serif text-slate-300 leading-none">“</span>
                    {selectedReport.fieldObservations}
                    <span className="absolute -bottom-6 right-4 text-3xl font-serif text-slate-300 leading-none">”</span>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50/50 p-4 border-t border-slate-150 flex items-center justify-end space-x-2">
              <button
                type="button"
                id="modal-pdf-report-print"
                onClick={() => window.print()}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Imprimir Boletim
              </button>
              <button
                type="button"
                id="close-modal-bottom-btn"
                onClick={() => setSelectedReport(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Fechar Painel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* COMPACT DETAILED PRINT-ONLY BOLETIM FOR PDF AND HIGH QUALITY PHYSICAL COPIES */}
      {selectedReport && (
        <div id="print-only-boletim" style={{ display: 'none' }}>
          {/* Header section */}
          <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '9px', fontWeight: '900', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CMPC ALMOXARIFADO DE OBRAS</span>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', marginTop: '2px', letterSpacing: '-0.025em' }}>BOLETIM DIÁRIO DE OBRA CONSOLIDADO</h1>
              <p style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>Código do Registro: {selectedReport.id}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'inline-block', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: '800', fontSize: '9px', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '4px' }}>
                Relatório de Campo
              </span>
              <p style={{ fontSize: '9px', color: '#94a3b8', marginTop: '6px' }}>Impresso em: {new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>

          {/* Grid section details */}
          <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', verticalAlign: 'top', width: '50%' }}>
                    <span style={{ display: 'block', fontSize: '9px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Frente de Obra / Canteiro</span>
                    <strong style={{ fontSize: '12px', color: '#0f172a' }}>{selectedReport.siteName}</strong>
                  </td>
                  <td style={{ padding: '6px 0', verticalAlign: 'top', width: '50%' }}>
                    <span style={{ display: 'block', fontSize: '9px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Almoxarife Responsável</span>
                    <strong style={{ fontSize: '12px', color: '#334155' }}>{selectedReport.storekeeperName}</strong>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0 0 0', verticalAlign: 'top' }}>
                    <span style={{ display: 'block', fontSize: '9px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Data do Boletim</span>
                    <strong style={{ fontSize: '12px', color: '#0f172a', fontFamily: 'monospace' }}>{selectedReport.date.split('-').reverse().join('/')}</strong>
                  </td>
                  <td style={{ padding: '6px 0 0 0', verticalAlign: 'top' }}>
                    <span style={{ display: 'block', fontSize: '9px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Turno Registrado</span>
                    <strong style={{ fontSize: '12px', color: '#2563eb' }}>{selectedReport.shift || 'Não Especificado'}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 1: Headcount */}
          <div className="print-avoid-break" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '10px', letterSpacing: '0.05em' }}>
              1. Resumo do Efetivo de Pessoal (Heacount)
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#334155', textTransform: 'uppercase', fontSize: '9px', fontWeight: '700' }}>Categoria de Mão de Obra</th>
                  <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#334155', textTransform: 'uppercase', fontSize: '9px', fontWeight: '700' }}>Quantitativo Presente</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'left', fontWeight: '500' }}>Efetivo Operacional</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: '700', fontFamily: 'monospace' }}>{selectedReport.manpower.operacional || 0} colaboradores</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'left', fontWeight: '500' }}>Efetivo Administrativo</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: '700', fontFamily: 'monospace' }}>{selectedReport.manpower.administrativo || 0} colaboradores</td>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc', fontWeight: '800' }}>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'left', color: '#0f172a' }}>Efetivo Consolidado Total</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#0f172a', fontFamily: 'monospace' }}>
                    {(selectedReport.manpower.operacional || 0) + (selectedReport.manpower.administrativo || 0)} colaboradores
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Uniform Inventory levels */}
          <div className="print-avoid-break" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '10px', letterSpacing: '0.05em' }}>
              2. Inventário Diário de Uniformes e Calçados
            </h2>
            {selectedReport.uniforms.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
                Nenhum estoque cadastrado para este boletim.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #cbd5e1' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    <th style={{ padding: '8px', textAlign: 'left', textTransform: 'uppercase', fontSize: '9px', fontWeight: '700', border: '1px solid #0f172a' }}>Item Cadastrado</th>
                    <th style={{ padding: '8px', textAlign: 'center', textTransform: 'uppercase', fontSize: '9px', fontWeight: '700', border: '1px solid #0f172a', width: '15%' }}>Tamanho</th>
                    <th style={{ padding: '8px', textAlign: 'center', textTransform: 'uppercase', fontSize: '9px', fontWeight: '700', border: '1px solid #0f172a', width: '25%' }}>Condição do Estoque</th>
                    <th style={{ padding: '8px', textAlign: 'right', textTransform: 'uppercase', fontSize: '9px', fontWeight: '700', border: '1px solid #0f172a', width: '20%' }}>Estoque Disponível</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReport.uniforms.map((uni, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '8px', fontWeight: '600', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>{uni.itemName}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', fontFamily: 'monospace', color: '#334155', borderRight: '1px solid #cbd5e1' }}>{uni.size}</td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '9px', 
                          fontWeight: '800', 
                          textTransform: 'uppercase',
                          backgroundColor: uni.condition === 'Higienizado' ? '#e0f2fe' : '#dcfce7',
                          color: uni.condition === 'Higienizado' ? '#0369a1' : '#15803d',
                          border: uni.condition === 'Higienizado' ? '1px solid #bae6fd' : '1px solid #bbf7d0'
                        }}>
                          {uni.condition || 'Higienizado'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', color: uni.quantity < 5 ? '#ef4444' : '#0f172a' }}>
                        {uni.quantity} un {uni.quantity < 5 ? '⚠️' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Section 3: Field observations */}
          <div className="print-avoid-break" style={{ marginBottom: '35px' }}>
            <h2 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '10px', letterSpacing: '0.05em' }}>
              3. Ocorrências & Necessidades do Turno
            </h2>
            <div style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', color: '#334155', lineHeight: '1.6', backgroundColor: '#f8fafc', whiteSpace: 'pre-wrap', minHeight: '80px' }}>
              {selectedReport.fieldObservations && selectedReport.fieldObservations.trim() 
                ? selectedReport.fieldObservations 
                : "Nenhuma ocorrência ou relato de irregularidade foi anotado para esta data."}
            </div>
          </div>

          {/* Signatures block */}
          <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '60px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #475569', width: '80%', margin: '0 auto 8px auto' }} />
              <strong style={{ display: 'block', fontSize: '10px', color: '#0f172a', textTransform: 'uppercase' }}>{selectedReport.storekeeperName}</strong>
              <span style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Almoxarife Responsável</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #475569', width: '80%', margin: '0 auto 8px auto' }} />
              <strong style={{ display: 'block', fontSize: '10px', color: '#0f172a', textTransform: 'uppercase' }}>Fiscal de Contrato / Supervisor</strong>
              <span style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Assinatura de Recebimento</span>
            </div>
          </div>

          {/* Slogan footnote */}
          <div style={{ textAlign: 'center', marginTop: '60px', borderTop: '1px solid #cbd5e1', paddingTop: '10px', fontSize: '8.5px', color: '#94a3b8', fontStyle: 'italic' }}>
            "A CMPC É NOSSA E O ALMOX É SEU" • Sistema Integrado de Gestão do Almoxarifado Central
          </div>
        </div>
      )}

    </div>
  );
}
