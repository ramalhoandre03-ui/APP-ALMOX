/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SiteDailyReport, 
  ShiftType, 
  ManpowerCount, 
  UniformStock, 
  EquipmentStatus, 
  MaterialConsumption,
  ProjectSite,
  PredefinedUniform
} from '../types';
import { 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  AlertCircle, 
  Users, 
  Shirt, 
  Wrench, 
  Flame, 
  Info, 
  RotateCcw,
  ClipboardList,
  History,
  Clock,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

const DRAFT_STORAGE_KEY = 'cmpc_storekeeper_draft';

interface StorekeeperDraft {
  selectedSiteId: string;
  reportDate: string;
  storekeeperName: string;
  reportShift: ShiftType;
  manpower: ManpowerCount;
  quantities: Record<string, number>;
  fieldObservations: string;
  savedAt: string;
}

interface StorekeeperPanelProps {
  onAddReport: (report: SiteDailyReport) => void;
  projectSites: ProjectSite[];
  predefinedUniforms: PredefinedUniform[];
}

export default function StorekeeperPanel({ onAddReport, projectSites, predefinedUniforms }: StorekeeperPanelProps) {
  // Report Header State
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [storekeeperName, setStorekeeperName] = useState('');
  const [reportShift, setReportShift] = useState<ShiftType>(ShiftType.TURNO_A);

  // Step 1: Manpower State (Plain quantities, shift-free)
  const [manpower, setManpower] = useState<ManpowerCount>({
    operacional: 0,
    administrativo: 0,
  });

  // Step 2: Uniform State (Dynamic grid by key: itemId_size_condition)
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Step 4: Field reporting tool for storekeepers (incidents, structural or staff constraints)
  const [fieldObservations, setFieldObservations] = useState('');

  // Status and Validation Feedbacks
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Auto-save & Restore State
  const [pendingDraft, setPendingDraft] = useState<StorekeeperDraft | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string | null>(null);
  const [restoredToast, setRestoredToast] = useState(false);

  // Keep latest form state in a ref for safe interval execution without stale closures
  const formStateRef = useRef({
    selectedSiteId,
    reportDate,
    storekeeperName,
    reportShift,
    manpower,
    quantities,
    fieldObservations
  });

  useEffect(() => {
    formStateRef.current = {
      selectedSiteId,
      reportDate,
      storekeeperName,
      reportShift,
      manpower,
      quantities,
      fieldObservations
    };
  }, [selectedSiteId, reportDate, storekeeperName, reportShift, manpower, quantities, fieldObservations]);

  // Initial check on mount: check if there is an unsaved draft in localStorage and prompt user
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const draft: StorekeeperDraft = JSON.parse(saved);
        const hasContent = 
          Boolean(draft.selectedSiteId) ||
          Boolean(draft.storekeeperName?.trim()) ||
          Boolean(draft.fieldObservations?.trim()) ||
          (draft.manpower?.operacional || 0) > 0 ||
          (draft.manpower?.administrativo || 0) > 0 ||
          (draft.quantities && Object.values(draft.quantities).some(v => Number(v) > 0));

        if (hasContent) {
          setPendingDraft(draft);
          setShowRestorePrompt(true);
        }
      }
    } catch (e) {
      console.warn('Erro ao ler rascunho de preenchimento:', e);
    }
  }, []);

  // Periodic Auto-Save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const cur = formStateRef.current;
      const hasContent = 
        Boolean(cur.selectedSiteId) ||
        Boolean(cur.storekeeperName?.trim()) ||
        Boolean(cur.fieldObservations?.trim()) ||
        (cur.manpower?.operacional || 0) > 0 ||
        (cur.manpower?.administrativo || 0) > 0 ||
        (cur.quantities && Object.values(cur.quantities).some(v => Number(v) > 0));

      if (hasContent) {
        const draft: StorekeeperDraft = {
          selectedSiteId: cur.selectedSiteId,
          reportDate: cur.reportDate,
          storekeeperName: cur.storekeeperName,
          reportShift: cur.reportShift,
          manpower: cur.manpower,
          quantities: cur.quantities,
          fieldObservations: cur.fieldObservations,
          savedAt: new Date().toISOString()
        };

        try {
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
          const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastAutoSavedTime(timeStr);
        } catch (e) {
          console.warn('Erro ao salvar rascunho automático:', e);
        }
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle restoring draft data
  const handleRestoreDraft = () => {
    if (!pendingDraft) return;

    if (pendingDraft.selectedSiteId) setSelectedSiteId(pendingDraft.selectedSiteId);
    if (pendingDraft.reportDate) setReportDate(pendingDraft.reportDate);
    if (pendingDraft.storekeeperName) setStorekeeperName(pendingDraft.storekeeperName);
    if (pendingDraft.reportShift) setReportShift(pendingDraft.reportShift);
    if (pendingDraft.manpower) setManpower(pendingDraft.manpower);
    if (pendingDraft.quantities) setQuantities(pendingDraft.quantities);
    if (pendingDraft.fieldObservations) setFieldObservations(pendingDraft.fieldObservations);

    if (pendingDraft.savedAt) {
      const savedDate = new Date(pendingDraft.savedAt);
      setLastAutoSavedTime(savedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }

    setShowRestorePrompt(false);
    setRestoredToast(true);
    setTimeout(() => setRestoredToast(false), 4000);
  };

  // Handle discarding draft data
  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setPendingDraft(null);
    setShowRestorePrompt(false);
    setLastAutoSavedTime(null);
  };

  // Helper for in-place grid input updates
  const handleQtyChange = (itemId: string, size: string, condition: 'Novo' | 'Higienizado' | 'N/A', qty: number) => {
    const key = `${itemId}_${size}_${condition}`;
    setQuantities(prev => ({
      ...prev,
      [key]: Math.max(0, qty)
    }));
  };

  // Helper to determine if an item is a shirt or pants (for Novo/Higienizado options)
  const isShirtOrPantsItem = (name: string): boolean => {
    const norm = name.toLowerCase();
    return (
      norm.includes('camisa') ||
      norm.includes('calça') ||
      norm.includes('calca') ||
      norm.includes('camiseta') ||
      norm.includes('jaleco')
    );
  };

  // Handle Manpower Changes
  const handleManpowerChange = (field: keyof ManpowerCount, val: number) => {
    const nonNegativeVal = Math.max(0, val);
    setManpower(prev => ({
      ...prev,
      [field]: nonNegativeVal
    }));
  };

  // Totalized values of workers
  const totalEfetivo = (Object.values(manpower) as number[]).reduce((a, b) => a + b, 0);

  // Form Reset
  const handleResetForm = () => {
    setSelectedSiteId('');
    setStorekeeperName('');
    setReportDate(new Date().toISOString().split('T')[0]);
    setReportShift(ShiftType.TURNO_A);
    setFieldObservations('');
    setManpower({
      operacional: 0,
      administrativo: 0,
    });
    
    // Clear all uniform quantities
    setQuantities({});
    setSubmitError(null);
    setSubmitSuccess(false);

    // Clear saved draft
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setPendingDraft(null);
    setShowRestorePrompt(false);
    setLastAutoSavedTime(null);
  };

  // Form Submitting and Strict Validations
  const handleFormSubmit = () => {
    setSubmitError(null);

    // 1. Basic Field Validations
    if (!selectedSiteId) {
      setSubmitError('Selecione a Frente de Obra / Unidade.');
      return;
    }
    if (!storekeeperName.trim()) {
      setSubmitError('Por favor, informe seu nome como Almoxarife Responsável.');
      return;
    }

    // 2. Worker Count Validation
    if (totalEfetivo === 0) {
      setSubmitError('O efetivo da obra não pode estar completamente zerado.');
      return;
    }

    // Capture site metadata
    const selectedSite = projectSites.find(site => site.id === selectedSiteId);
    if (!selectedSite) return;

    // Compile non-zero uniforms from the quantities record state
    const nonZeroUniforms: UniformStock[] = [];
    Object.entries(quantities).forEach(([key, val]) => {
      const qty = Number(val);
      if (qty > 0) {
        const [itemId, size, condition] = key.split('_');
        const matched = predefinedUniforms.find(u => u.id === itemId);
        if (matched) {
          nonZeroUniforms.push({
            itemId,
            itemName: matched.name,
            size,
            quantity: qty,
            condition: condition === 'N/A' ? undefined : (condition as 'Novo' | 'Higienizado')
          });
        }
      }
    });

    // Consolidate complete schema according to the standard interfaces
    const newReport: SiteDailyReport = {
      id: `rep-${Date.now()}`,
      siteId: selectedSite.id,
      siteName: selectedSite.name,
      date: reportDate,
      shift: reportShift,
      storekeeperName: storekeeperName.trim(),
      manpower,
      uniforms: nonZeroUniforms,
      equipments: [],
      materialsConsumed: [],
      submittedAt: new Date().toISOString(),
      fieldObservations: fieldObservations.trim()
    };

    // Trigger report callback
    onAddReport(newReport);

    // Clear auto-saved draft upon successful submission
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setPendingDraft(null);
    setShowRestorePrompt(false);
    setLastAutoSavedTime(null);
    
    // Set success indicator
    setSubmitSuccess(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="storekeeper-panel-container">
      
      {/* Bento Collage Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute right-0 top-0 opacity-10 translate-y-4 translate-x-4 pointer-events-none select-none">
          <ClipboardList className="w-96 h-96 text-blue-500" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-blue-500/30">
              FRENTE DE CAMPO • PORTAL ATIVO
            </span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>AUTO-SAVE (30S)</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight mt-3 text-white">
            Lançamento Diário de Obra
          </h2>
          <p className="mt-2 text-slate-400 font-sans text-xs sm:text-sm leading-relaxed">
            Área de preenchimento obrigatório para Almoxarifes de Campo. Registre o efetivo presente, a disponibilidade de uniformes e envie o consumo real diretamente à gerência central.
          </p>
        </div>
        <div className="relative z-10 flex-shrink-0 bg-white/5 border border-white/10 rounded-2xl p-4 text-center md:text-right min-w-[200px]">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">STATUS DA SINCRONIZAÇÃO</span>
          <div className="flex items-center justify-center md:justify-end gap-2 mt-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold font-mono text-emerald-400">SALVAMENTO LOCAL</span>
          </div>
          <p className="text-[10px] text-slate-300 font-mono mt-1.5">
            {lastAutoSavedTime ? (
              <span className="text-emerald-400 font-medium flex items-center justify-center md:justify-end gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Salvo às {lastAutoSavedTime}</span>
              </span>
            ) : (
              <span className="text-slate-400">A cada 30s automaticamente</span>
            )}
          </p>
          <p className="text-[9px] text-slate-500 mt-1">v4.2.0 • Proteção contra recarregamento</p>
        </div>
      </div>

      {/* Restore Draft Prompt Banner */}
      <AnimatePresence>
        {showRestorePrompt && pendingDraft && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md relative overflow-hidden"
            id="restore-draft-prompt-banner"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3.5 bg-amber-500/20 text-amber-500 rounded-2xl border border-amber-500/30 shrink-0 mt-0.5 md:mt-0 shadow-xs">
                  <History className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Rascunho Não Finalizado Encontrado
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Salvo em {new Date(pendingDraft.savedAt).toLocaleDateString('pt-BR')} às {new Date(pendingDraft.savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Deseja recuperar os dados do seu preenchimento anterior?
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                    Frente: <strong className="text-slate-900 dark:text-slate-200">{projectSites.find(p => p.id === pendingDraft.selectedSiteId)?.name || pendingDraft.selectedSiteId || 'Não selecionada'}</strong>
                    {pendingDraft.storekeeperName ? ` • Almoxarife: ${pendingDraft.storekeeperName}` : ''}
                    {pendingDraft.manpower ? ` • Efetivo: ${(pendingDraft.manpower.operacional || 0) + (pendingDraft.manpower.administrativo || 0)} colaboradores` : ''}
                    {pendingDraft.quantities ? ` • ${Object.values(pendingDraft.quantities).reduce((a, b) => a + Number(b), 0)} itens de uniforme informados` : ''}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto justify-end shrink-0">
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  id="btn-discard-draft"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Descartar Rascunho</span>
                </button>
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black tracking-wide transition-all shadow-md shadow-amber-500/25 hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
                  id="btn-restore-draft"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Restaurar Dados</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restored Toast notification */}
      <AnimatePresence>
        {restoredToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 rounded-2xl p-4 flex items-center justify-between shadow-md"
            id="restored-toast-banner"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-300">
                Rascunho restaurado com sucesso! Todos os campos foram preenchidos com seus dados salvos.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRestoredToast(false)}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-bold px-2 py-1 cursor-pointer"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Success Overlay Modal */}
      <AnimatePresence>
        {submitSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="success-submit-modal-overlay">
            {/* Backdrop with blurring & overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleResetForm}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden"
              id="success-submit-modal"
            >
              {/* Decorative backgrounds */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-8 -mt-8 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl -ml-8 -mb-8 pointer-events-none" />

              <div className="flex flex-col items-center text-center space-y-6 relative z-10">
                {/* Glowing Success Badge */}
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                  <div className="relative bg-emerald-500 text-slate-950 p-4 rounded-full shadow-lg shadow-emerald-500/20 border border-emerald-300/30 flex items-center justify-center">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-display font-black tracking-tight text-emerald-400">
                    Dados encaminhados ao almoxarifado central com sucesso!
                  </h3>
                </div>

                {/* Subtitle / customized slogan quote of gratitude */}
                <div className="bg-slate-950/80 border border-slate-850 rounded-2xl p-5 shadow-inner">
                  <p className="text-slate-300 text-xs sm:text-sm font-sans leading-relaxed">
                    Obrigado por contribuir para uma gestão mais eficiente do nosso setor, você faz parte de todo avanço que temos, a <strong className="text-white">CMPC É NOSSA E O ALMOX É SEU !</strong>
                  </p>
                </div>

                {/* Divider */}
                <div className="w-full border-t border-slate-800 pt-2" />

                {/* Action button */}
                <button
                  type="button"
                  id="confirm-success-modal-btn"
                  onClick={handleResetForm}
                  className="w-full py-3.5 px-6 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-emerald-500/10 cursor-pointer"
                >
                  Confirmar e Fechar Lançamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {submitError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3 shadow-xs animate-shake">
          <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-rose-800 text-xs uppercase tracking-wider">Inconsistência de Dados Bloqueada</h4>
            <p className="text-rose-700 text-xs mt-1 leading-relaxed">{submitError}</p>
          </div>
        </div>
      )}

      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Grid: Site Metadata & Manpower Grid (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Credenciais & Turno */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PASSO 01</span>
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center space-x-2 mt-1 border-b border-slate-100 pb-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full inline-block"></span>
                <span>Credenciais do Posto</span>
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Frente de Obra / Unidade
                </label>
                <select
                  id="site-selector"
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl py-2 px-3 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">Selecione mapeamento de campo...</option>
                  {projectSites.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.location})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Data Operacional
                  </label>
                  <input
                    id="date-picker"
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl py-2 px-2.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Turno
                  </label>
                  <select
                    id="shift-selector"
                    value={reportShift}
                    onChange={(e) => setReportShift(e.target.value as ShiftType)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-850 text-xs font-semibold rounded-xl py-2 px-2.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
                  >
                    {Object.values(ShiftType).map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Almoxarife Responsável
                </label>
                <input
                  id="storekeeper-input"
                  type="text"
                  placeholder="Ex: Pedro Henrique Souza"
                  value={storekeeperName}
                  onChange={(e) => setStorekeeperName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl py-2.5 px-3 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Efetivo de Trabalho */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PASSO 02</span>
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center space-x-2 mt-1 border-b border-slate-100 pb-2">
                <Users className="h-4.5 w-4.5 text-blue-600" />
                <span>Efetivo de Trabalho</span>
              </h3>
              <p className="text-slate-400 text-[10px] mt-1 leading-relaxed font-sans">
                Insira os quantitativos do canteiro. O total do canteiro é calculado automaticamente.
              </p>
            </div>

            {/* EFETIVO TOTAL DO CANTEIRO - HIGHLIGHTED PROMINENTLY */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">
                EFETIVO TOTAL DO CANTEIRO
              </span>
              <span className="text-3xl font-display font-black text-slate-900 font-mono">
                {totalEfetivo} <span className="text-sm font-sans font-normal text-slate-500">colaboradores</span>
              </span>
            </div>

            <div className="space-y-4">
              {([
                { key: 'operacional', label: 'Efetivo Operacional' },
                { key: 'administrativo', label: 'Efetivo Administrativo' }
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-1.5 bg-slate-50 border border-slate-150 p-3.5 rounded-2xl transition-all hover:bg-slate-100/30">
                  <span className="text-slate-700 font-bold text-xs uppercase tracking-wider block">{label}</span>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-450 text-[10px] font-sans">Total de terceirizados e próprios</span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        id={`dec-${key}`}
                        onClick={() => handleManpowerChange(key, manpower[key] - 1)}
                        className="w-8 h-8 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold flex items-center justify-center shadow-xs transition-colors focus:outline-hidden cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        id={`mp-${key}`}
                        type="number"
                        min="0"
                        value={manpower[key]}
                        onChange={(e) => handleManpowerChange(key, parseInt(e.target.value) || 0)}
                        className="w-12 text-center bg-transparent font-black text-slate-800 text-sm py-1 font-mono focus:outline-hidden"
                      />
                      <button
                        type="button"
                        id={`inc-${key}`}
                        onClick={() => handleManpowerChange(key, manpower[key] + 1)}
                        className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center shadow-xs transition-colors focus:outline-hidden cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Grid: Uniforms, Equipments & Consumables (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Card 3: Uniform Inventory (High Contrast Styled Bento) */}
          <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 shadow-md space-y-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">PASSO 03</span>
              <div className="flex justify-between items-center mt-1 border-b border-slate-800 pb-2">
                <h3 className="font-display font-semibold text-white text-base flex items-center space-x-2">
                  <Shirt className="h-4.5 w-4.5 text-blue-400" />
                  <span>Estoque de Uniformes na Frente</span>
                </h3>
                <span className="text-[9px] bg-green-500/20 text-green-400 px-2.5 py-0.5 rounded-full font-bold">ATIVA</span>
              </div>
              <p className="text-slate-400 text-[10px] mt-1.5 leading-relaxed font-sans">
                Informe as quantidades diretamente nas grades correspondentes a cada item do catálogo.
              </p>
            </div>

            {/* Dynamic Grid Matrix of Uniforms */}
            <div className="space-y-6 pt-2">
              {predefinedUniforms.map((u) => {
                const requiresCondition = isShirtOrPantsItem(u.name);
                
                return (
                  <div key={u.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4.5 space-y-4">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <h4 className="text-xs font-bold text-slate-200 tracking-tight flex items-center gap-1.5">
                        <span className="text-base">{requiresCondition ? '👔' : '🥾'}</span>
                        <span>{u.name}</span>
                      </h4>
                      <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">
                        {u.sizes.length} tamanhos mapeados
                      </span>
                    </div>

                    {requiresCondition ? (
                      <div className="space-y-4">
                        {/* NOVO ROW */}
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            <span className="text-[10px] font-bold text-emerald-450 uppercase tracking-wider">Novos</span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {u.sizes.map((size) => {
                              const qtyKey = `${u.id}_${size}_Novo`;
                              const currentQty = quantities[qtyKey] || 0;
                              return (
                                <div key={size} className="bg-slate-900 border border-slate-800/80 rounded-xl p-2 flex flex-col items-center">
                                  <span className="text-[9px] font-bold text-slate-400 pb-1 font-mono">TAM {size}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={currentQty === 0 ? '' : currentQty}
                                    onChange={(e) => handleQtyChange(u.id, size, 'Novo', parseInt(e.target.value) || 0)}
                                    className="w-full text-center bg-slate-950 text-white font-extrabold text-xs py-1 rounded-lg border border-slate-800 focus:outline-hidden focus:border-blue-400 font-mono"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* HIGIENIZADO ROW */}
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>
                            <span className="text-[10px] font-bold text-sky-450 uppercase tracking-wider">Higienizados</span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {u.sizes.map((size) => {
                              const qtyKey = `${u.id}_${size}_Higienizado`;
                              const currentQty = quantities[qtyKey] || 0;
                              return (
                                <div key={size} className="bg-slate-900 border border-slate-800/80 rounded-xl p-2 flex flex-col items-center">
                                  <span className="text-[9px] font-bold text-slate-400 pb-1 font-mono">TAM {size}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={currentQty === 0 ? '' : currentQty}
                                    onChange={(e) => handleQtyChange(u.id, size, 'Higienizado', parseInt(e.target.value) || 0)}
                                    className="w-full text-center bg-slate-950 text-white font-extrabold text-xs py-1 rounded-lg border border-slate-800 focus:outline-hidden focus:border-blue-400 font-mono"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* SINGLE ROW (Botas, etc. sem higienização) */
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                          <span className="text-[10px] font-bold text-amber-450 uppercase tracking-wider">Estoque (Sem Higienização)</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {u.sizes.map((size) => {
                            const qtyKey = `${u.id}_${size}_N/A`;
                            const currentQty = quantities[qtyKey] || 0;
                            return (
                              <div key={size} className="bg-slate-900 border border-slate-800/80 rounded-xl p-2 flex flex-col items-center">
                                <span className="text-[9px] font-bold text-slate-400 pb-1 font-mono">TAM {size}</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={currentQty === 0 ? '' : currentQty}
                                  onChange={(e) => handleQtyChange(u.id, size, 'N/A', parseInt(e.target.value) || 0)}
                                  className="w-full text-center bg-slate-950 text-white font-extrabold text-xs py-1 rounded-lg border border-slate-800 focus:outline-hidden focus:border-blue-400 font-mono"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totalizer info block */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex justify-between items-center text-[11px] font-sans">
              <span className="text-slate-400">Totalizadores de Lançamento:</span>
              <span className="text-white font-bold font-mono">
                {Object.values(quantities).reduce((a: number, b: number) => a + Number(b), 0)} unidades informadas
              </span>
            </div>
          </div>

          {/* Card 4: Report / Observações de Campo (Relatório de Ocorrências e Necessidades) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PASSO 04</span>
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center space-x-2 mt-1 border-b border-slate-100 pb-2">
                <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
                <span>Ocorrências & Necessidades de Campo</span>
              </h3>
              <p className="text-slate-400 text-[10px] mt-1.5 leading-relaxed font-sans">
                Utilize este canal de report para sinalizar falta de reposições do almoxarifado, ou qualquer dificuldade fática enfrentada na obra (estrutural, comportamentos, etc.).
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Relatório de Report do Almoxarife
              </label>
              <textarea
                id="field-observations-input"
                name="fieldObservations"
                rows={4}
                value={fieldObservations}
                onChange={(e) => setFieldObservations(e.target.value)}
                placeholder="Exemplo: Solicito reposição urgente de botas tamanho 41. Tivemos uma restrição de organização no container de apoio. Alguns colaboradores questionaram a entrega do calçado jeans."
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs font-medium rounded-xl p-3 h-32 resize-none focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
              />
              <div className="flex justify-between items-center text-[9px] text-slate-400 pt-0.5">
                <span>Registros de apoio e caneta do almoxarife.</span>
                <span className="font-mono text-slate-500">{fieldObservations.length} chars</span>
              </div>
            </div>
          </div>

          {/* Action Footer Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/50">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-sans">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {lastAutoSavedTime ? (
                <span>Auto-save ativo • Último backup salvo às <strong className="text-slate-700 font-mono">{lastAutoSavedTime}</strong></span>
              ) : (
                <span>Auto-save ativo (a cada 30 segundos)</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                id="btn-reset-form"
                onClick={handleResetForm}
                className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Formulário</span>
              </button>
              <button
                type="button"
                id="btn-submit-report"
                onClick={handleFormSubmit}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-blue-200 hover:shadow-lg cursor-pointer"
              >
                <Save className="w-4 h-4 text-white animate-pulse" />
                <span>ENVIAR DADOS AO CENTRAL</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
