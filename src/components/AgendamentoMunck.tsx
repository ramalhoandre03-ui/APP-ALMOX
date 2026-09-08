import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Truck, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  DollarSign, 
  Activity, 
  ArrowLeft, 
  ShieldCheck, 
  FileText,
  Lock,
  Unlock,
  Wrench,
  Check,
  AlertCircle,
  Download,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Booking {
  id: string;
  solicitante: string;
  centroCusto: string;
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:MM
  horaFim: string; // HH:MM
  descricao: string;
  createdAt: string;
  status: 'pendente' | 'aprovado' | 'recusado';
  justificativa?: string;
  statusExecucao?: 'pendente' | 'realizada' | 'nao_realizada';
  veiculo?: 'Caminhão Munck' | 'Pickup Almoxarifado';
  whatsapp?: string;
  statusAgendamento?: string;
  justificativaMotorista?: string;
  incluido_por?: string;
  autorizado_por?: string;
  tipoDestino?: 'Interno (Alumar)' | 'Externo';
}

interface FleetStatus {
  id: string;
  veiculo: string;
  placa: string;
  statusVeiculo: 'Operante' | 'Em Manutenção';
  acessoArea: 'Liberado' | 'Bloqueado';
  treinamentoOperador: 'Válido' | 'Vencido' | 'N/A';
  treinamentoRigger: 'Válido' | 'Vencido' | 'N/A';
  acessorios: 'Completos' | 'Incompletos' | 'N/A';
}

interface AgendamentoMunckProps {
  onBackToHub: () => void;
}

function PainelAdminMunck({ onBackToHub }: AgendamentoMunckProps) {
  const { session: globalSession } = useAuth();
  // Current date
  const todayStr = new Date().toISOString().split('T')[0];
  
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [fleetList, setFleetList] = useState<FleetStatus[]>([]);

  // Loading & Export state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exportFilter, setExportFilter] = useState<'todas' | 'realizadas' | 'pendentes'>('todas');

  // Admin state (default: false)
  const [isAdmin, setIsAdmin] = useState(false);

  // Custom Admin Login Modal states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isAdminAuthLoading, setIsAdminAuthLoading] = useState(false);

  // Custom Justification Prompt Modal state
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptPlaceholder, setPromptPlaceholder] = useState('');
  const [promptValue, setPromptValue] = useState('');
  const [promptOnSubmit, setPromptOnSubmit] = useState<(val: string) => void>(() => () => {});

  const [munckView, setMunckView] = useState<'planejamento' | 'motorista'>('planejamento');

  // Form states
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formSolicitante, setFormSolicitante] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formCentroCusto, setFormCentroCusto] = useState('');
  const [formHoraInicio, setFormHoraInicio] = useState('07:20');
  const [formHoraFim, setFormHoraFim] = useState('08:00');
  const [formDescricao, setFormDescricao] = useState('');
  const [formVeiculo, setFormVeiculo] = useState<'Caminhão Munck' | 'Pickup Almoxarifado'>('Caminhão Munck');
  const [formTipoDestino, setFormTipoDestino] = useState<'Interno (Alumar)' | 'Externo'>('Interno (Alumar)');
  const [timelineVehicle, setTimelineVehicle] = useState<'Caminhão Munck' | 'Pickup Almoxarifado'>('Caminhão Munck');

  // Auto-sync timeline view vehicle with the selected form vehicle
  useEffect(() => {
    setTimelineVehicle(formVeiculo);
  }, [formVeiculo]);

  // Convert "HH:MM" to minutes for easier overlapping check
  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  // Determine weekday from chosen formDate (0 = Sunday, 1-5 = Weekday, 6 = Saturday)
  const formDayOfWeek = useMemo(() => {
    if (!formDate) return 1;
    const d = new Date(formDate + 'T12:00:00');
    return d.getDay();
  }, [formDate]);

  // Generate dynamic 20-minute start time options based on operational rules (starts at 07:20)
  const startTimeOptions = useMemo(() => {
    if (formDayOfWeek === 0) return []; // Sunday is blocked
    const options = [];
    const startMin = 7 * 60 + 20; // 07:20
    const maxEnd = formDayOfWeek === 6 ? 15 * 60 : 16 * 60; // 15:00 on Saturdays, 16:00 on Weekdays
    // Start times can go up to 20 minutes before the end of the shift
    for (let m = startMin; m < maxEnd; m += 20) {
      const h = Math.floor(m / 60);
      const mins = m % 60;
      options.push(`${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    }
    return options;
  }, [formDayOfWeek]);

  // Generate dynamic 20-minute end time options after the selected start time
  const endTimeOptions = useMemo(() => {
    if (formDayOfWeek === 0 || !formHoraInicio) return []; // Sunday or no start time is blocked
    const options = [];
    const startMin = timeToMinutes(formHoraInicio);
    const maxEnd = formDayOfWeek === 6 ? 15 * 60 : 16 * 60;
    // End times can go from startMin + 20 minutes up to the shift end
    for (let m = startMin + 20; m <= maxEnd; m += 20) {
      const h = Math.floor(m / 60);
      const mins = m % 60;
      options.push(`${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    }
    return options;
  }, [formDayOfWeek, formHoraInicio]);

  // Sync form times when formDate changes to ensure they are within the shift
  useEffect(() => {
    if (formDayOfWeek === 0) {
      setFormHoraInicio('');
      setFormHoraFim('');
      return;
    }
    const validStarts = startTimeOptions;
    if (validStarts.length > 0) {
      if (!validStarts.includes(formHoraInicio)) {
        setFormHoraInicio(validStarts[0]);
      }
    }
  }, [formDayOfWeek, startTimeOptions]);

  // Sync end time when start time changes
  useEffect(() => {
    const validEnds = endTimeOptions;
    if (validEnds.length > 0) {
      if (!validEnds.includes(formHoraFim)) {
        setFormHoraFim(validEnds[0]);
      }
    }
  }, [formHoraInicio, endTimeOptions]);

  // Calculate the 7 days of the currently selected week (starting on Monday)
  const daysOfWeek = useMemo(() => {
    const current = new Date(selectedDate + 'T12:00:00');
    const day = current.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const mondayOffset = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(current);
    monday.setDate(current.getDate() + mondayOffset);
    
    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateVal = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dateVal}`;
      
      list.push({
        dateStr,
        dayName: d.toLocaleDateString('pt-BR', { weekday: 'short' }), // e.g. "seg.", "ter."
        dayNum: d.getDate(),
        isSunday: d.getDay() === 0,
        isToday: dateStr === todayStr
      });
    }
    return list;
  }, [selectedDate]);
  
  // Alert message state
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load from Supabase on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        
        // 1. Fetch from munck_prontidao
        const { data: prontidaoData, error: prontidaoError } = await supabase
          .from('munck_prontidao')
          .select('*');

        let loadedFleet: FleetStatus[] = [];
        if (prontidaoData && prontidaoData.length > 0) {
          loadedFleet = prontidaoData.map((item: any) => ({
            id: item.id.toLowerCase(),
            veiculo: item.id.toLowerCase() === 'pickup' ? 'Pickup Almoxarifado' : 'Caminhão Munck',
            placa: item.placa || '',
            statusVeiculo: (item.mecanica || item.status_veiculo || 'Operante') as 'Operante' | 'Em Manutenção',
            acessoArea: (item.acesso_area || 'Liberado') as 'Liberado' | 'Bloqueado',
            treinamentoOperador: (item.treinamento_operador || 'Válido') as 'Válido' | 'Vencido' | 'N/A',
            treinamentoRigger: (item.treinamento_rigger || 'N/A') as 'Válido' | 'Vencido' | 'N/A',
            acessorios: (item.acessorios || 'N/A') as 'Completos' | 'Incompletos' | 'N/A',
          }));
        }

        // Sort so Caminhão Munck is always first
        loadedFleet.sort((a, b) => {
          if (a.id === 'munck') return -1;
          if (b.id === 'munck') return 1;
          return 0;
        });

        setFleetList(loadedFleet);

        // 2. Fetch from munck_agendamentos
        const { data: agendamentosData, error: agendamentosError } = await supabase
          .from('munck_agendamentos')
          .select('*');

        if (!agendamentosError && agendamentosData) {
          const loadedBookings: Booking[] = agendamentosData.map((b: any) => ({
            id: b.id,
            solicitante: b.solicitante,
            centroCusto: b.centro_custo,
            data: b.data,
            horaInicio: b.hora_inicio,
            horaFim: b.hora_fim,
            descricao: b.descricao,
            status: b.status_aprovacao as 'pendente' | 'aprovado' | 'recusado',
            statusExecucao: (b.status_execucao || 'pendente') as 'pendente' | 'realizada' | 'nao_realizada',
            justificativa: b.justificativa || undefined,
            createdAt: b.created_at || new Date().toISOString(),
            veiculo: b.veiculo || 'Caminhão Munck',
            whatsapp: b.whatsapp,
            statusAgendamento: b.status_agendamento || 'Aguardando Aprovação',
            justificativaMotorista: b.justificativa_motorista || undefined,
            incluido_por: b.incluido_por || undefined,
            autorizado_por: b.autorizado_por || undefined,
            tipoDestino: (b.tipo_destino || b.tipoDestino || 'Interno (Alumar)') as 'Interno (Alumar)' | 'Externo'
          }));
          setBookings(loadedBookings);
        } else {
          console.warn('Could not load agendamentos from Supabase:', agendamentosError);
          setBookings([]);
        }
      } catch (err) {
        console.error('Unexpected error loading initial data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadInitialData();
  }, []);

  // Monitor global session to set Admin state (only actual Administradores are admins)
  useEffect(() => {
    setIsAdmin(globalSession?.perfil === 'Administrador');
  }, [globalSession]);

  // Handle alert auto-dismissal
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => {
        setAlertMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  // Save fleet status to Supabase
  const saveFleetStatusToSupabase = async (updatedFleet: FleetStatus) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('munck_prontidao')
        .upsert({
          id: updatedFleet.id.toUpperCase(),
          placa: updatedFleet.placa,
          mecanica: updatedFleet.statusVeiculo,
          status_veiculo: updatedFleet.statusVeiculo,
          acesso_area: updatedFleet.acessoArea,
          treinamento_operador: updatedFleet.treinamentoOperador,
          treinamento_rigger: updatedFleet.treinamentoRigger,
          acessorios: updatedFleet.acessorios
        });
      if (error) {
        throw error;
      }
      setFleetList(prev => prev.map(f => f.id === updatedFleet.id ? updatedFleet : f));
    } catch (err: any) {
      console.error('Unexpected error saving fleet status:', err);
      setAlertMessage({ type: 'error', text: `Erro ao salvar prontidão da frota: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Update plate number when admin types
  const handleUpdatePlaca = async (vehicleId: string, newPlaca: string) => {
    const formatted = newPlaca.toUpperCase();
    const target = fleetList.find(f => f.id === vehicleId);
    if (!target) return;
    const updated = { ...target, placa: formatted };
    setFleetList(prev => prev.map(f => f.id === vehicleId ? updated : f));
    await saveFleetStatusToSupabase(updated);
  };

  // Toggle readiness checklist factors
  const toggleStatus = async (vehicleId: string, key: keyof Omit<FleetStatus, 'id' | 'veiculo' | 'placa'>) => {
    if (!isAdmin) {
      setAlertMessage({
        type: 'error',
        text: 'Acesso Restrito: Ative o Modo Administrador para editar a prontidão da frota.'
      });
      return;
    }

    const target = fleetList.find(f => f.id === vehicleId);
    if (!target) return;

    const current = target[key];
    if (current === 'N/A') return; // Cannot toggle N/A

    let updatedVal: string = '';
    if (key === 'statusVeiculo') {
      updatedVal = current === 'Operante' ? 'Em Manutenção' : 'Operante';
    } else if (key === 'acessoArea') {
      updatedVal = current === 'Liberado' ? 'Bloqueado' : 'Liberado';
    } else if (key === 'treinamentoOperador') {
      updatedVal = current === 'Válido' ? 'Vencido' : 'Válido';
    } else if (key === 'treinamentoRigger') {
      updatedVal = current === 'Válido' ? 'Vencido' : 'Válido';
    } else if (key === 'acessorios') {
      updatedVal = current === 'Completos' ? 'Incompletos' : 'Completos';
    }

    const updated = {
      ...target,
      [key]: updatedVal
    };
    await saveFleetStatusToSupabase(updated);
  };

  // Check if a start/end time falls strictly within the shift hours of Almoxarifado
  const isWithinOperationalHours = (dateStr: string, startTimeStr: string, endTimeStr: string) => {
    if (!dateStr || !startTimeStr || !endTimeStr) {
      return { valid: false, message: 'Dados de data ou hora incompletos.' };
    }
    const d = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = d.getDay(); // 0 = Sunday, 1-5 = Weekdays, 6 = Saturday

    if (dayOfWeek === 0) {
      return { 
        valid: false, 
        message: 'Fora do horário operacional: O Almoxarifado está fechado aos domingos.' 
      };
    }

    const startMin = timeToMinutes(startTimeStr);
    const endMin = timeToMinutes(endTimeStr);

    const minAllowed = timeToMinutes('07:20');
    const maxAllowed = dayOfWeek === 6 ? timeToMinutes('15:00') : timeToMinutes('16:00');

    if (startMin < minAllowed || endMin > maxAllowed || startMin >= endMin) {
      const limitStr = dayOfWeek === 6 ? '07:20 às 15:00' : '07:20 às 16:00';
      return {
        valid: false,
        message: `Fora do horário operacional do Almoxarifado: Para este dia o limite é das ${limitStr}.`
      };
    }

    return { valid: true };
  };

  // Check if a start time option is blocked by an approved booking on the chosen formDate or falls outside shift
  const isStartTimeOptionBlocked = (timeStr: string) => {
    const min = timeToMinutes(timeStr);

    // Also block if outside operational limits for formDate
    if (formDayOfWeek === 0) return true; // Sunday blocked
    const minAllowed = timeToMinutes('07:20');
    const maxAllowed = formDayOfWeek === 6 ? timeToMinutes('15:00') : timeToMinutes('16:00');
    if (min < minAllowed || min >= maxAllowed) return true;

    return bookings.some(b => {
      if (b.data !== formDate || b.status !== 'aprovado') return false;
      if (b.veiculo !== formVeiculo) return false;
      const bStart = timeToMinutes(b.horaInicio);
      const bEnd = timeToMinutes(b.horaFim);
      // Math: violates if tStart < bEnd + 30 and tEnd > bStart - 30 (assuming min booking is 20 min)
      return (min < bEnd + 30 && min + 20 > bStart - 30);
    });
  };

  // Check if an end time option is blocked or invalid based on formDate and selected start time or falls outside shift
  const isEndTimeOptionBlocked = (timeStr: string) => {
    const endMin = timeToMinutes(timeStr);
    const startMin = timeToMinutes(formHoraInicio);
    
    if (endMin <= startMin) return true; // Cannot end before or at start time

    // Also block if outside operational limits for formDate
    if (formDayOfWeek === 0) return true; // Sunday blocked
    const minAllowed = timeToMinutes('07:20');
    const maxAllowed = formDayOfWeek === 6 ? timeToMinutes('15:00') : timeToMinutes('16:00');
    if (endMin <= minAllowed || endMin > maxAllowed) return true;
    
    // Check if there is any approved booking on that date that overlaps with [formHoraInicio, timeStr] or violates the 30-min buffer
    return bookings.some(b => {
      if (b.data !== formDate || b.status !== 'aprovado') return false;
      if (b.veiculo !== formVeiculo) return false;
      const bStart = timeToMinutes(b.horaInicio);
      const bEnd = timeToMinutes(b.horaFim);
      // Math: violates if tStart < bEnd + 30 and tEnd > bStart - 30
      return (startMin < bEnd + 30 && endMin > bStart - 30);
    });
  };

  // Check if current form times violate the 30-minute safety buffer with any APPROVED booking on the chosen formDate
  const isBufferViolated = useMemo(() => {
    if (!formDate || !formHoraInicio || !formHoraFim) return false;
    const tStart = timeToMinutes(formHoraInicio);
    const tEnd = timeToMinutes(formHoraFim);
    if (tStart >= tEnd) return false;

    return bookings.some(b => {
      if (b.data !== formDate || b.status !== 'aprovado') return false;
      if (b.veiculo !== formVeiculo) return false;
      const bStart = timeToMinutes(b.horaInicio);
      const bEnd = timeToMinutes(b.horaFim);
      return (tStart < bEnd + 30 && tEnd > bStart - 30);
    });
  }, [bookings, formDate, formHoraInicio, formHoraFim, formVeiculo]);

  // Filter bookings for the selected date
  const filteredBookings = useMemo(() => {
    return bookings
      .filter(b => b.data === selectedDate)
      .sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));
  }, [bookings, selectedDate]);

  // Selected vehicle fleet data
  const selectedFleetVehicle = useMemo(() => {
    return fleetList.find(f => f.veiculo === formVeiculo);
  }, [fleetList, formVeiculo]);

  // Check if operator or rigger training is expired
  const isTreinamentoVencido = useMemo(() => {
    if (!selectedFleetVehicle) return false;
    return (
      selectedFleetVehicle.treinamentoOperador === 'Vencido' ||
      selectedFleetVehicle.treinamentoRigger === 'Vencido'
    );
  }, [selectedFleetVehicle]);

  // Hard Stop Rule: Training Expired AND Destination is Interno (Alumar)
  const isBloqueadoAlumar = useMemo(() => {
    return isTreinamentoVencido && formTipoDestino === 'Interno (Alumar)';
  }, [isTreinamentoVencido, formTipoDestino]);

  // Is truck completely ready / operante?
  const isTruckReady = useMemo(() => {
    const munck = fleetList.find(f => f.id === 'munck');
    if (!munck) return true;
    return (
      munck.statusVeiculo === 'Operante' &&
      munck.acessoArea === 'Liberado' &&
      munck.treinamentoOperador === 'Válido' &&
      munck.treinamentoRigger === 'Válido' &&
      munck.acessorios === 'Completos'
    );
  }, [fleetList]);

  // Is requested vehicle ready?
  const selectedVehicleReady = useMemo(() => {
    const target = selectedFleetVehicle;
    if (!target) return true;
    const isTrainingOk = formTipoDestino === 'Externo'
      ? true
      : ((target.treinamentoOperador === 'Válido' || target.treinamentoOperador === 'N/A') &&
         (target.treinamentoRigger === 'Válido' || target.treinamentoRigger === 'N/A'));

    return (
      target.statusVeiculo === 'Operante' &&
      target.acessoArea === 'Liberado' &&
      isTrainingOk &&
      (target.acessorios === 'Completos' || target.acessorios === 'N/A')
    );
  }, [selectedFleetVehicle, formTipoDestino]);

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digits = rawVal.replace(/\D/g, '');
    const limitedDigits = digits.slice(0, 11);
    
    if (limitedDigits.length === 0) {
      setFormWhatsapp('');
    } else if (limitedDigits.length <= 2) {
      setFormWhatsapp(`(${limitedDigits}`);
    } else if (limitedDigits.length <= 7) {
      setFormWhatsapp(`(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`);
    } else {
      setFormWhatsapp(`(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 7)}-${limitedDigits.slice(7)}`);
    }
  };

  // Handle Booking Creation
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBloqueadoAlumar) {
      setAlertMessage({ 
        type: 'error', 
        text: '⚠️ Bloqueio de Segurança: O treinamento do operador ou rigger está Vencido. Agendamentos com destino Interno (Alumar) estão bloqueados.' 
      });
      return;
    }

    if (!formSolicitante.trim()) {
      setAlertMessage({ type: 'error', text: 'Por favor, informe o nome do solicitante.' });
      return;
    }
    if (!formCentroCusto.trim()) {
      setAlertMessage({ type: 'error', text: 'Por favor, informe o Centro de Custo.' });
      return;
    }
    if (!formDescricao.trim()) {
      setAlertMessage({ type: 'error', text: 'Por favor, descreva a atividade de movimentação.' });
      return;
    }

    const tStart = timeToMinutes(formHoraInicio);
    const tEnd = timeToMinutes(formHoraFim);

    if (tStart >= tEnd) {
      setAlertMessage({ type: 'error', text: 'A hora de início deve ser anterior à hora de término.' });
      return;
    }

    // Validate shift operational hours (07:20 limits, Saturday limit 15:00, Weekday limit 16:00, Sunday closed)
    const opCheck = isWithinOperationalHours(formDate, formHoraInicio, formHoraFim);
    if (!opCheck.valid) {
      setAlertMessage({ type: 'error', text: opCheck.message });
      return;
    }

    // Check overlaps & safety buffer with existing APPROVED bookings on the formDate for the same vehicle
    const violatesBuffer = bookings.some(b => {
      if (b.data !== formDate || b.status !== 'aprovado') return false;
      if (b.veiculo !== formVeiculo) return false;
      const bStart = timeToMinutes(b.horaInicio);
      const bEnd = timeToMinutes(b.horaFim);
      // Math: violates if tStart < bEnd + 30 and tEnd > bStart - 30
      return (tStart < bEnd + 30 && tEnd > bStart - 30);
    });

    if (violatesBuffer) {
      setAlertMessage({ 
        type: 'error', 
        text: '⚠️ Intervalo obrigatório de 30 min para descanso da equipe entre atividades não respeitado.' 
      });
      return;
    }

    // Add new booking with status 'pendente'
    const newBooking: Booking = {
      id: 'munck-' + Date.now(),
      solicitante: formSolicitante.trim(),
      centroCusto: formCentroCusto.trim().toUpperCase(),
      data: formDate,
      horaInicio: formHoraInicio,
      horaFim: formHoraFim,
      descricao: formDescricao.trim(),
      createdAt: new Date().toISOString(),
      status: 'pendente',
      statusExecucao: 'pendente',
      veiculo: formVeiculo,
      whatsapp: formWhatsapp.trim(),
      statusAgendamento: 'Aguardando Aprovação',
      incluido_por: globalSession?.nome || globalSession?.email || 'N/D',
      tipoDestino: formTipoDestino
    };

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('munck_agendamentos')
        .insert({
          id: newBooking.id,
          solicitante: newBooking.solicitante,
          centro_custo: newBooking.centroCusto,
          data: newBooking.data,
          hora_inicio: newBooking.horaInicio,
          hora_fim: newBooking.horaFim,
          descricao: newBooking.descricao,
          status_aprovacao: newBooking.status,
          status_execucao: newBooking.statusExecucao || 'pendente',
          justificativa: '',
          created_at: newBooking.createdAt,
          veiculo: newBooking.veiculo,
          whatsapp: newBooking.whatsapp,
          status_agendamento: newBooking.statusAgendamento,
          incluido_por: newBooking.incluido_por,
          tipo_destino: newBooking.tipoDestino
        });

      if (error) {
        throw error;
      }

      setBookings(prev => [...prev, newBooking]);
      setAlertMessage({ type: 'success', text: 'Solicitação de agendamento enviada! Status: PENDENTE.' });
      
      // Clear form inputs only on success
      setFormSolicitante('');
      setFormWhatsapp('');
      setFormCentroCusto('');
      setFormDescricao('');
    } catch (err: any) {
      console.error('Unexpected error inserting booking:', err);
      setAlertMessage({ type: 'error', text: `Erro ao salvar agendamento: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete booking
  const handleDeleteBooking = async (id: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('munck_agendamentos')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setBookings(prev => prev.filter(b => b.id !== id));
      setAlertMessage({ type: 'success', text: 'Agendamento removido com sucesso!' });
    } catch (err: any) {
      console.error('Unexpected error deleting booking:', err);
      setAlertMessage({ type: 'error', text: `Erro ao excluir agendamento: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Update status_agendamento in database and state
  const handleUpdateStatusAgendamento = async (id: string, newStatus: string, reason?: string) => {
    setIsSaving(true);
    try {
      const updateData: any = { status_agendamento: newStatus };
      if (newStatus === 'Aprovado') {
        updateData.status_aprovacao = 'aprovado';
        updateData.status_execucao = 'pendente';
        updateData.autorizado_por = globalSession?.nome || globalSession?.email || 'N/D';
      } else if (newStatus === 'Recusado') {
        updateData.status_aprovacao = 'recusado';
        if (reason) {
          updateData.justificativa = reason;
        }
      } else if (newStatus === 'Executado') {
        updateData.status_execucao = 'realizada';
      } else if (newStatus === 'Não Executado') {
        updateData.status_execucao = 'nao_realizada';
        if (reason) {
          updateData.justificativa_motorista = reason;
        }
      }

      const { error } = await supabase
        .from('munck_agendamentos')
        .update(updateData)
        .eq('id', id);

      if (error) {
        throw error;
      }

      setBookings(prev => prev.map(b => {
        if (b.id === id) {
          const updated: Booking = { 
            ...b, 
            statusAgendamento: newStatus 
          };
          if (newStatus === 'Aprovado') {
            updated.status = 'aprovado';
            updated.statusExecucao = 'pendente';
            updated.autorizado_por = globalSession?.nome || globalSession?.email || 'N/D';
          } else if (newStatus === 'Recusado') {
            updated.status = 'recusado';
            if (reason) updated.justificativa = reason;
          } else if (newStatus === 'Executado') {
            updated.statusExecucao = 'realizada';
          } else if (newStatus === 'Não Executado') {
            updated.statusExecucao = 'nao_realizada';
            if (reason) updated.justificativaMotorista = reason;
          }
          return updated;
        }
        return b;
      }));

      setAlertMessage({ type: 'success', text: `Status atualizado para ${newStatus.toUpperCase()} com sucesso!` });
    } catch (err: any) {
      console.error('Error updating status_agendamento:', err);
      setAlertMessage({ type: 'error', text: `Erro ao atualizar status: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Approve booking
  const handleApproveBooking = async (id: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('munck_agendamentos')
        .update({ 
          status_aprovacao: 'aprovado', 
          status_execucao: 'pendente',
          status_agendamento: 'Aprovado',
          autorizado_por: globalSession?.nome || globalSession?.email || 'N/D'
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      setBookings(prev => prev.map(b => b.id === id ? { 
        ...b, 
        status: 'aprovado', 
        statusExecucao: 'pendente',
        statusAgendamento: 'Aprovado',
        autorizado_por: globalSession?.nome || globalSession?.email || 'N/D'
      } : b));
      setAlertMessage({ type: 'success', text: 'Agendamento aprovado com sucesso!' });
    } catch (err: any) {
      console.error('Unexpected error approving booking:', err);
      setAlertMessage({ type: 'error', text: `Erro ao aprovar agendamento: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Reject booking
  const handleRejectBooking = async (id: string) => {
    setPromptTitle('Recusar Agendamento');
    setPromptPlaceholder('Digite a justificativa para recusar este agendamento...');
    setPromptValue('');
    setPromptOnSubmit(() => async (reason: string) => {
      const cleanReason = reason.trim();
      if (!cleanReason) {
        setAlertMessage({ type: 'error', text: 'A justificativa de recusa é obrigatória.' });
        return;
      }

      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('munck_agendamentos')
          .update({ 
            status_aprovacao: 'recusado', 
            justificativa: cleanReason,
            status_agendamento: 'Recusado'
          })
          .eq('id', id);

        if (error) {
          throw error;
        }

        setBookings(prev => prev.map(b => b.id === id ? { 
          ...b, 
          status: 'recusado', 
          justificativa: cleanReason,
          statusAgendamento: 'Recusado'
        } : b));
        setAlertMessage({ type: 'success', text: 'Agendamento recusado com sucesso!' });
      } catch (err: any) {
        console.error('Unexpected error rejecting booking:', err);
        setAlertMessage({ type: 'error', text: `Erro ao recusar agendamento: ${err.message || err}` });
      } finally {
        setIsSaving(false);
      }
    });
    setShowPromptModal(true);
  };

  // Finalize booking as Realizada
  const handleMarkAsRealized = async (id: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('munck_agendamentos')
        .update({ status_execucao: 'realizada' })
        .eq('id', id);

      if (error) {
        throw error;
      }

      setBookings(prev => prev.map(b => b.id === id ? { ...b, statusExecucao: 'realizada' } : b));
      setAlertMessage({ type: 'success', text: 'Atividade marcada como REALIZADA com sucesso!' });
    } catch (err: any) {
      console.error('Unexpected error finalizing realized booking:', err);
      setAlertMessage({ type: 'error', text: `Erro ao finalizar agendamento: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Finalize booking as Não Realizada (Failed/Cancelled)
  const handleMarkAsNotRealized = async (id: string) => {
    setPromptTitle('Marcar Atividade como Não Realizada');
    setPromptPlaceholder('Digite a justificativa para a falha ou cancelamento da atividade...');
    setPromptValue('');
    setPromptOnSubmit(() => async (reason: string) => {
      const cleanReason = reason.trim();
      if (!cleanReason) {
        setAlertMessage({ type: 'error', text: 'A justificativa de falha é obrigatória.' });
        return;
      }

      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('munck_agendamentos')
          .update({ status_execucao: 'nao_realizada', justificativa: cleanReason })
          .eq('id', id);

        if (error) {
          throw error;
        }

        setBookings(prev => prev.map(b => b.id === id ? { ...b, statusExecucao: 'nao_realizada', justificativa: cleanReason } : b));
        setAlertMessage({ type: 'success', text: 'Atividade marcada como NÃO REALIZADA.' });
      } catch (err: any) {
        console.error('Unexpected error finalizing failed booking:', err);
        setAlertMessage({ type: 'error', text: `Erro ao registrar falha de agendamento: ${err.message || err}` });
      } finally {
        setIsSaving(false);
      }
    });
    setShowPromptModal(true);
  };

  // Export CSV Report
  const handleExportCSV = (filterType: 'todas' | 'realizadas' | 'pendentes') => {
    let listToExport = bookings;
    if (filterType === 'realizadas') {
      listToExport = bookings.filter(b => b.status === 'aprovado' && b.statusExecucao === 'realizada');
    } else if (filterType === 'pendentes') {
      listToExport = bookings.filter(b => b.status === 'pendente' || (b.status === 'aprovado' && (b.statusExecucao === 'pendente' || !b.statusExecucao)));
    }

    // Generate CSV content
    const headers = ['ID', 'Solicitante', 'Veículo', 'Tipo Destino', 'Centro de Custo', 'Data', 'Hora Inicio', 'Hora Fim', 'Descricao', 'Status Aprovacao', 'Status Execucao', 'Justificativa', 'Criado Em'];
    const rows = listToExport.map(b => [
      b.id,
      b.solicitante,
      b.veiculo || 'Caminhão Munck',
      b.tipoDestino || 'Interno (Alumar)',
      b.centroCusto,
      b.data,
      b.horaInicio,
      b.horaFim,
      b.descricao.replace(/"/g, '""'),
      b.status,
      b.statusExecucao || 'pendente',
      (b.justificativa || '').replace(/"/g, '""'),
      b.createdAt
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(row => row.map(val => `"${val}"`).join(';'))
    ].join('\n');

    // Create a blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_logistico_${filterType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setAlertMessage({
      type: 'success',
      text: `Relatório (${filterType}) exportado com sucesso!`
    });
  };

  // Generation of timeline segments with 20-minute granularity reflecting the operational shift
  const timelineHours = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = d.getDay(); // 0 = Sunday, 1-5 = Weekday, 6 = Saturday
    if (dayOfWeek === 0) return []; // Sunday is closed

    const slots = [];
    const startMin = 7 * 60 + 20; // 07:20
    const endMin = dayOfWeek === 6 ? 15 * 60 : 16 * 60; // 15:00 or 16:00

    for (let m = startMin; m < endMin; m += 20) {
      const h = Math.floor(m / 60);
      const mins = m % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
    }
    return slots;
  }, [selectedDate]);

  const handleSendWhatsapp = (b: Booking) => {
    const numeroLimpo = b.whatsapp ? b.whatsapp.replace(/\D/g, '') : '';
    const placaVeiculo = fleetList.find(v => v.veiculo === (b.veiculo || 'Caminhão Munck'))?.placa || '';
    const dateToParse = b.data.includes('T') ? b.data : `${b.data}T12:00:00`;

    const demanda = {
      data_agendamento: dateToParse,
      inicio: b.horaInicio,
      status_agendamento: b.statusAgendamento || 'Aprovado',
      descricao_trabalho: b.descricao,
      veiculo_solicitado: b.veiculo || '',
      placa: placaVeiculo,
      justificativa_motorista: b.justificativaMotorista
    };

    // 1. Formata a data e o status
    const dataFormatada = new Date(demanda.data_agendamento).toLocaleDateString('pt-BR');
    const status = demanda.status_agendamento.toUpperCase();

    // 2. Lógica Condicional Inteligente para o Rodapé
    let mensagemRodape = "✅ _Assim que a operação for concluída, você receberá uma mensagem de confirmação por aqui._";

    if (status === 'EXECUTADO') {
        mensagemRodape = "🏁 _Operação concluída com sucesso! O Almoxarifado agradece._";
    } else if (status === 'NÃO EXECUTADO') {
        // Se tiver a justificativa do motorista, ele inclui aqui
        const motivo = demanda.justificativa_motorista ? demanda.justificativa_motorista : "Não informado";
        mensagemRodape = `⚠️ _Atenção: A operação não pôde ser realizada. Motivo: ${motivo}_`;
    }

    // 3. Monta a string bruta
    const textoBruto = `*Notificação de Agendamento Logístico*\n\n` +
    `Olá! O seu agendamento logístico para o dia *${dataFormatada}* às *${demanda.inicio}* foi *${status}*.\n\n` +
    `*Detalhes da Atividade:*\n_${demanda.descricao_trabalho}_\n\n` +
    `*Veículo Escalado:*\n*${demanda.veiculo_solicitado || 'N/A'}* - Placa: *${demanda.placa || 'N/A'}*\n\n` +
    `${mensagemRodape}`;

    // 4. Codifica a string para URL
    const textoCodificado = encodeURIComponent(textoBruto);

    // 5. Monta a URL e abre a aba
    const urlFormatada = `https://wa.me/55${numeroLimpo}?text=${textoCodificado}`;
    window.open(urlFormatada, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col font-sans" id="munck-app-container">
      {/* Dynamic Save Overlay */}
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-slate-800"
          >
            <Activity className="w-4 h-4 text-sky-400 animate-spin" />
            <span>Sincronizando dados...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Header Block */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 md:px-12 sticky top-0 z-35">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToHub}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition duration-150 cursor-pointer"
              title="Voltar ao Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="border-l border-slate-300 pl-4 py-1">
              <h2 className="font-sans font-black text-base text-cmpc-purple tracking-tight leading-tight uppercase flex items-center gap-2">
                <Truck className="w-5 h-5 text-sky-500 animate-pulse" />
                Agendamento Logístico
              </h2>
              <p className="text-[10px] font-bold text-cmpc-gray uppercase tracking-wider leading-none mt-0.5">
                Gestão de Frota • CMPC Industrial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Export Report Button (Somente ADM) */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider hidden md:inline pl-1">Exportar:</span>
                <select
                  value={exportFilter}
                  onChange={(e) => setExportFilter(e.target.value as any)}
                  className="bg-transparent text-[11px] font-bold text-slate-700 outline-none border-none py-0.5 cursor-pointer pr-1"
                >
                  <option value="todas">Todas</option>
                  <option value="realizadas">Concluídas</option>
                  <option value="pendentes">Pendentes</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleExportCSV(exportFilter)}
                  className="bg-sky-600 hover:bg-sky-700 text-white rounded-full p-1.5 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  title="Exportar CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="text-[9px] uppercase font-black pr-1 hidden sm:inline">CSV</span>
                </button>
              </div>
            )}

            {/* Admin toggle lock */}
            {globalSession?.perfil === 'Administrador' && (
              <button
                type="button"
                onClick={() => {
                  if (isAdmin) {
                    setIsAdmin(false);
                    setAlertMessage({ type: 'success', text: 'Alterado para o Modo Visitante.' });
                  } else {
                    setIsAdmin(true);
                    setAlertMessage({ type: 'success', text: 'Retornou ao Modo Administrador.' });
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase transition-all duration-200 border cursor-pointer ${
                  isAdmin 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md hover:bg-emerald-700' 
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isAdmin ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Modo ADM</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Modo Leitura</span>
                  </>
                )}
              </button>
            )}

            <div className="text-right flex flex-col items-end justify-center shrink-0">
              <span className="text-xs font-bold text-slate-400 tracking-wider font-mono uppercase">Módulo Operacional</span>
              <span className="text-[10px] font-bold text-sky-600 uppercase font-sans">SGI-FROTA-01</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-6 py-8 w-full space-y-6">
        {/* Toast alert message */}
        <AnimatePresence>
          {alertMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between shadow-md ${
                alertMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {alertMessage.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{alertMessage.text}</span>
              </div>
              <button
                onClick={() => setAlertMessage(null)}
                className="text-xs font-bold uppercase tracking-wider ml-4 text-slate-400 hover:text-slate-600"
              >
                Fechar
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LOADING INDICATOR */}
        {isLoading && (
          <div className="p-12 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3">
            <Activity className="w-8 h-8 text-sky-500 animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando com o Banco de Dados...</p>
          </div>
        )}

        {/* View Switcher: Torre de Controle vs Visão Motorista */}
        {!isLoading && (
          <div className="flex bg-slate-100 p-1 rounded-2xl max-w-md mx-auto border border-slate-200" id="munck-view-switcher">
            <button
              type="button"
              onClick={() => setMunckView('planejamento')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                munckView === 'planejamento'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Torre de Controle
            </button>
            <button
              type="button"
              onClick={() => setMunckView('motorista')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                munckView === 'motorista'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Truck className="w-4 h-4" />
              Visão Motorista
            </button>
          </div>
        )}

        {/* 1. REFATORAÇÃO: PRONTIDÃO DA FROTA (LAYOUT MAP MULTIPLE VEHICLES) */}
        {!isLoading && munckView === 'motorista' && (
          <PainelMotorista isAdmin={isAdmin} />
        )}

        {!isLoading && munckView === 'planejamento' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className={`p-2 rounded-xl text-white ${isTruckReady ? 'bg-emerald-600' : 'bg-amber-500 animate-pulse'}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 leading-none">PRONTIDÃO DA FROTA LOGÍSTICA (SGI)</h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Status de segurança ativo para movimentação de frotas industriais
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {fleetList.map((vehicle) => {
                const isVehicleReady = 
                  vehicle.statusVeiculo === 'Operante' &&
                  vehicle.acessoArea === 'Liberado' &&
                  (vehicle.treinamentoOperador === 'Válido' || vehicle.treinamentoOperador === 'N/A') &&
                  (vehicle.treinamentoRigger === 'Válido' || vehicle.treinamentoRigger === 'N/A') &&
                  (vehicle.acessorios === 'Completos' || vehicle.acessorios === 'N/A');

                return (
                  <div key={vehicle.id} className="flex flex-col lg:flex-row items-center justify-between gap-4 p-3 bg-slate-50/50 rounded-xl border border-slate-150">
                    <div className="flex items-center gap-3 shrink-0 w-full lg:w-64">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isVehicleReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                      <div>
                        <span className="text-xs font-black text-slate-800 block">{vehicle.veiculo}</span>
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">SGI-CHECK • ID: {vehicle.id.toUpperCase()}</span>
                      </div>
                    </div>

                    {/* Grid with 6 items: Placa + 5 checklist items side-by-side */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 w-full flex-grow">
                      {/* Placa compact input */}
                      <div className="bg-white border border-slate-150 rounded-xl px-3 py-1.5 flex flex-col justify-between shadow-xs">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block">Placa</span>
                        <div className="relative flex items-center mt-0.5">
                          <input
                            type="text"
                            maxLength={8}
                            disabled={!isAdmin}
                            value={vehicle.placa}
                            onChange={(e) => handleUpdatePlaca(vehicle.id, e.target.value)}
                            className={`w-full text-xs font-mono font-black p-0 bg-transparent text-slate-800 outline-none border-b ${
                              isAdmin ? 'border-slate-200 focus:border-cmpc-purple' : 'border-transparent'
                            }`}
                          />
                          {!isAdmin && <Lock className="w-2.5 h-2.5 text-slate-400 ml-1 shrink-0" />}
                        </div>
                      </div>

                      {/* Mecânica */}
                      <button
                        type="button"
                        onClick={() => toggleStatus(vehicle.id, 'statusVeiculo')}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all shadow-xs ${
                          vehicle.statusVeiculo === 'Operante'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/60'
                            : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100/60'
                        } ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      >
                        <span className="text-[8px] font-black uppercase tracking-widest block opacity-70">Mecânica</span>
                        <span className="text-[10px] font-black mt-1 block truncate">
                          {vehicle.statusVeiculo}
                        </span>
                      </button>

                      {/* Crachá */}
                      <button
                        type="button"
                        onClick={() => toggleStatus(vehicle.id, 'acessoArea')}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all shadow-xs ${
                          vehicle.acessoArea === 'Liberado'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/60'
                            : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100/60'
                        } ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      >
                        <span className="text-[8px] font-black uppercase tracking-widest block opacity-70">Acesso à Área</span>
                        <span className="text-[10px] font-black mt-1 block truncate">
                          {vehicle.acessoArea}
                        </span>
                      </button>

                      {/* Treinamento Op */}
                      {vehicle.treinamentoOperador === 'N/A' ? (
                        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-100/70 text-slate-400 flex flex-col justify-between text-left shadow-xs">
                          <span className="text-[8px] font-black uppercase tracking-widest block opacity-50">Treinamento Op</span>
                          <span className="text-[10px] font-bold mt-1 block font-mono">N/A</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleStatus(vehicle.id, 'treinamentoOperador')}
                          className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all shadow-xs ${
                            vehicle.treinamentoOperador === 'Válido'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/60'
                              : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100/60'
                          } ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        >
                          <span className="text-[8px] font-black uppercase tracking-widest block opacity-70">Treinamento Op</span>
                          <span className="text-[10px] font-black mt-1 block truncate">
                            {vehicle.treinamentoOperador}
                          </span>
                        </button>
                      )}

                      {/* Sinaleiro */}
                      {vehicle.treinamentoRigger === 'N/A' ? (
                        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-100/70 text-slate-400 flex flex-col justify-between text-left shadow-xs">
                          <span className="text-[8px] font-black uppercase tracking-widest block opacity-50">Sinaleiro/Rigger</span>
                          <span className="text-[10px] font-bold mt-1 block font-mono">N/A</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleStatus(vehicle.id, 'treinamentoRigger')}
                          className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all shadow-xs ${
                            vehicle.treinamentoRigger === 'Válido'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/60'
                              : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100/60'
                          } ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        >
                          <span className="text-[8px] font-black uppercase tracking-widest block opacity-70">Sinaleiro/Rigger</span>
                          <span className="text-[10px] font-black mt-1 block truncate">
                            {vehicle.treinamentoRigger}
                          </span>
                        </button>
                      )}

                      {/* Acessórios */}
                      {vehicle.acessorios === 'N/A' ? (
                        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-100/70 text-slate-400 flex flex-col justify-between text-left shadow-xs">
                          <span className="text-[8px] font-black uppercase tracking-widest block opacity-50">Acessórios</span>
                          <span className="text-[10px] font-bold mt-1 block font-mono">N/A</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleStatus(vehicle.id, 'acessorios')}
                          className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all shadow-xs ${
                            vehicle.acessorios === 'Completos'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/60'
                              : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100/60'
                          } ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        >
                          <span className="text-[8px] font-black uppercase tracking-widest block opacity-70">Acessórios</span>
                          <span className="text-[10px] font-black mt-1 block truncate">
                            {vehicle.acessorios}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Split Grid Layout: Left Column = Form Card (4 cols), Right Column = Agenda/Timeline (8 cols) */}
        {!isLoading && munckView === 'planejamento' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: Request Form (4 cols) */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-sky-500" />
                  Novo Agendamento
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Preencha os dados de içamento e movimentação.
                </p>
              </div>

              {!selectedVehicleReady && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 items-start animate-pulse">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-800 leading-normal font-semibold">
                    Atenção: O veículo solicitado possui itens pendentes no checklist de prontidão. Certifique-se de validar antes do horário agendado.
                  </p>
                </div>
              )}

              <form onSubmit={handleCreateBooking} className="space-y-4">
                {/* Requested Vehicle Select */}
                <div className="space-y-1 font-sans">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Veículo Solicitado
                  </label>
                  <div className="relative">
                    <Truck className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                    <select
                      value={formVeiculo}
                      onChange={(e) => setFormVeiculo(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 appearance-none cursor-pointer"
                    >
                      <option value="Caminhão Munck">Caminhão Munck</option>
                      <option value="Pickup Almoxarifado">Pickup Almoxarifado</option>
                    </select>
                  </div>
                </div>

                {/* Tipo de Destino (Obrigatório) */}
                <div className="space-y-1 font-sans">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Tipo de Destino <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                    <select
                      value={formTipoDestino}
                      onChange={(e) => setFormTipoDestino(e.target.value as 'Interno (Alumar)' | 'Externo')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 appearance-none cursor-pointer"
                      required
                    >
                      <option value="Interno (Alumar)">Interno (Alumar)</option>
                      <option value="Externo">Externo</option>
                    </select>
                  </div>
                </div>

                {/* Requester Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Nome do Solicitante
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      value={formSolicitante}
                      onChange={(e) => setFormSolicitante(e.target.value)}
                      placeholder="Ex: Carlos Silva"
                      className="w-full text-xs pl-8.5 p-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-800 outline-none focus:border-cmpc-purple transition-all"
                    />
                  </div>
                </div>

                {/* WHATSAPP (CONFIRMAÇÃO) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    WhatsApp (Confirmação)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      value={formWhatsapp}
                      onChange={handleWhatsappChange}
                      placeholder="Ex: (98) 9XXXX-XXXX"
                      className="w-full text-xs pl-8.5 p-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-800 outline-none focus:border-cmpc-purple transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Cost Center */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Centro de Custo (CC)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      value={formCentroCusto}
                      onChange={(e) => setFormCentroCusto(e.target.value)}
                      placeholder="Ex: CC-4510"
                      className="w-full text-xs pl-8.5 p-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-800 outline-none focus:border-cmpc-purple transition-all"
                    />
                  </div>
                </div>

                {/* Date Picker for desired booking day */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Data do Agendamento
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-800 outline-none focus:border-cmpc-purple transition-all"
                  />
                </div>

                {/* DateTime Pickers */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Início
                    </label>
                    <div className="relative">
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
                      <select
                        value={formHoraInicio}
                        onChange={(e) => setFormHoraInicio(e.target.value)}
                        className="w-full text-xs pl-7 p-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-800 outline-none focus:border-cmpc-purple transition-all font-mono"
                      >
                        {formDayOfWeek === 0 ? (
                          <option value="">Domingo Fechado</option>
                        ) : startTimeOptions.length === 0 ? (
                          <option value="">Sem horários</option>
                        ) : (
                          startTimeOptions.map(opt => (
                            <option key={opt} value={opt} disabled={isStartTimeOptionBlocked(opt)}>
                              {opt} {isStartTimeOptionBlocked(opt) && ' (Bloqueado)'}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Término
                    </label>
                    <div className="relative">
                      <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
                      <select
                        value={formHoraFim}
                        onChange={(e) => setFormHoraFim(e.target.value)}
                        className="w-full text-xs pl-7 p-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-800 outline-none focus:border-cmpc-purple transition-all font-mono"
                      >
                        {formDayOfWeek === 0 ? (
                          <option value="">Domingo Fechado</option>
                        ) : endTimeOptions.length === 0 ? (
                          <option value="">Sem horários</option>
                        ) : (
                          endTimeOptions.map(opt => (
                            <option key={opt} value={opt} disabled={isEndTimeOptionBlocked(opt)}>
                              {opt} {isEndTimeOptionBlocked(opt) && ' (Bloqueado)'}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {isBufferViolated && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold p-3 rounded-xl leading-normal flex gap-1.5 items-start">
                    <span>⚠️ Intervalo obrigatório de 30 min para descanso da equipe entre atividades não respeitado.</span>
                  </div>
                )}

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Descrição do Trabalho
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    placeholder="Içamento, transporte, descarga, etc."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-800 outline-none focus:border-cmpc-purple transition-all"
                  />
                </div>

                {isBloqueadoAlumar && (
                  <div className="bg-red-50 border-2 border-red-300 text-red-900 text-xs font-bold p-3.5 rounded-2xl space-y-1.5 shadow-sm animate-pulse">
                    <div className="flex items-center gap-2 text-red-700 font-black uppercase text-[11px]">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Bloqueio de Segurança (Alumar)</span>
                    </div>
                    <p className="text-[11px] text-red-800 font-medium leading-relaxed">
                      O treinamento do operador e/ou rigger do veículo está com status <strong>Vencido</strong>. 
                      Agendamentos com destino <strong>Interno (Alumar)</strong> estão temporariamente <strong>bloqueados</strong> até a atualização dos treinamentos.
                    </p>
                    <p className="text-[10px] text-red-600 font-semibold italic">
                      💡 Para operações fora do site Alumar, altere o Tipo de Destino para "Externo".
                    </p>
                  </div>
                )}

                {/* Confirm Button */}
                <button
                  type="submit"
                  disabled={isBufferViolated || isBloqueadoAlumar}
                  className={`w-full py-2.5 text-white font-black text-xs uppercase tracking-wider rounded-xl transition duration-150 shadow-md flex items-center justify-center gap-1.5 ${
                    isBufferViolated || isBloqueadoAlumar
                      ? 'bg-slate-300 text-slate-500 border border-slate-300 cursor-not-allowed opacity-70 shadow-none'
                      : 'bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-700 hover:to-sky-600 cursor-pointer'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Confirmar Agendamento
                </button>
              </form>
            </div>

            {/* RIGHT COLUMN: Timeline & Bookings List (8 cols) */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-sky-500" />
                    Visualização da Agenda
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Controle de ocupação horária da frota.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Timeline Vehicle Tab Selectors */}
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setTimelineVehicle('Caminhão Munck')}
                      className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        timelineVehicle === 'Caminhão Munck'
                          ? 'bg-white text-slate-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 font-medium'
                      }`}
                    >
                      Caminhão Munck
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineVehicle('Pickup Almoxarifado')}
                      className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        timelineVehicle === 'Pickup Almoxarifado'
                          ? 'bg-white text-slate-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 font-medium'
                      }`}
                    >
                      Pickup Almoxarifado
                    </button>
                  </div>

                  {/* Date Picker Filter */}
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="text-xs p-2.5 font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:border-cmpc-purple"
                    />
                  </div>
                </div>
              </div>

              {/* Weekly Calendar Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Dias da Semana (Segunda a Sábado)
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {daysOfWeek.filter(d => !d.isSunday).map(day => {
                    const isSelected = day.dateStr === selectedDate;
                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(day.dateStr)}
                        className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-br from-sky-600 to-sky-500 text-white shadow-md transform scale-102 font-black'
                            : day.isToday
                            ? 'bg-sky-50 text-sky-700 border border-sky-100'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-transparent'
                        }`}
                      >
                        <span className="text-[8.5px] font-bold uppercase tracking-wider opacity-85">
                          {day.dayName.replace('.', '')}
                        </span>
                        <span className="text-xs font-black mt-0.5">
                          {day.dayNum}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timeline display */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                    Ocupação Horária ({selectedDate === todayStr ? 'Hoje' : selectedDate})
                  </span>
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full font-mono">
                    Intervalos de 20 min
                  </span>
                </div>
                
                {timelineHours.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center text-slate-400 font-sans space-y-1">
                    <p className="text-xs font-black uppercase tracking-wider text-rose-500">Almoxarifado Fechado</p>
                    <p className="text-[10px] text-slate-400">Não há operação nem agendamentos aos domingos.</p>
                  </div>
                ) : (
                  /* Modern visual grid / timeline of 20-minute slot pills */
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {timelineHours.map(hour => {
                      const hourNum = timeToMinutes(hour);
                      
                      // Find if there is an approved booking for this slot for the active timeline vehicle
                      const approvedBooking = filteredBookings.find(b => {
                        const start = timeToMinutes(b.horaInicio);
                        const end = timeToMinutes(b.horaFim);
                        const sameVehicle = (b.veiculo || 'Caminhão Munck') === timelineVehicle;
                        return sameVehicle && b.status === 'aprovado' && hourNum >= start && hourNum < end;
                      });

                      // Find if there is a pending booking for this slot for the active timeline vehicle
                      const pendingBooking = !approvedBooking && filteredBookings.find(b => {
                        const start = timeToMinutes(b.horaInicio);
                        const end = timeToMinutes(b.horaFim);
                        const sameVehicle = (b.veiculo || 'Caminhão Munck') === timelineVehicle;
                        return sameVehicle && b.status === 'pendente' && hourNum >= start && hourNum < end;
                      });

                      // Check if this slot falls within the 30-minute safety buffer of any approved booking of the same vehicle
                      const isBufferSlot = !approvedBooking && filteredBookings.some(b => {
                        if (b.status !== 'aprovado') return false;
                        if ((b.veiculo || 'Caminhão Munck') !== timelineVehicle) return false;
                        const start = timeToMinutes(b.horaInicio);
                        const end = timeToMinutes(b.horaFim);
                        return (hourNum < end + 30 && hourNum + 20 > start - 30);
                      });

                      const isUnclickable = !!approvedBooking || isBufferSlot || !!pendingBooking;

                      const isRealized = approvedBooking?.statusExecucao === 'realizada';
                      const isFailed = approvedBooking?.statusExecucao === 'nao_realizada';

                      return (
                        <button 
                          key={hour}
                          type="button"
                          disabled={isUnclickable}
                          onClick={() => {
                            if (!isUnclickable) {
                              setFormDate(selectedDate);
                              setFormHoraInicio(hour);
                            }
                          }}
                          title={
                            approvedBooking 
                              ? `${isRealized ? 'CONCLUÍDO' : isFailed ? 'NÃO REALIZADA / FALHA' : 'APROVADO / RESERVADO'}: ${approvedBooking.solicitante} (${approvedBooking.horaInicio} - ${approvedBooking.horaFim})` 
                              : isBufferSlot
                              ? '⚠️ Intervalo obrigatório de 30 min para descanso da equipe'
                              : pendingBooking 
                              ? `PENDENTE: ${pendingBooking.solicitante} (${pendingBooking.horaInicio} - ${pendingBooking.horaFim})` 
                              : 'Livre - Clique para selecionar horário'
                          }
                          className={`px-2 py-1 text-[9px] sm:text-[10px] font-mono rounded-lg transition-all duration-150 border flex items-center justify-center font-bold ${
                            approvedBooking 
                              ? isRealized
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs cursor-not-allowed' 
                                : isFailed
                                ? 'bg-rose-50 text-rose-800 border-rose-200 shadow-xs cursor-not-allowed'
                                : 'bg-slate-800 text-slate-100 border-slate-900 shadow-sm cursor-not-allowed' 
                              : isBufferSlot
                              ? 'bg-rose-50/50 text-rose-400 border-rose-200/50 line-through cursor-not-allowed'
                              : pendingBooking
                              ? 'bg-amber-50 text-amber-800 border-amber-200 border-dashed cursor-not-allowed'
                              : 'bg-slate-50 text-slate-500 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 border-slate-200/60 cursor-pointer'
                          }`}
                        >
                          {hour}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Listed Bookings */}
                <div className="pt-4 border-t border-slate-100 space-y-3.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Compromissos Agendados</span>

                  {filteredBookings.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 font-sans space-y-2">
                      <p className="text-xs font-bold uppercase">Nenhum agendamento para esta data</p>
                      <p className="text-[10px] text-slate-350">Use o formulário à esquerda para reservar o Munck.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredBookings.map((b) => (
                        <div 
                          key={b.id} 
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex flex-col gap-2 group relative overflow-hidden transition-all duration-150 hover:bg-white hover:border-sky-300"
                        >
                          {/* Left indicator bar */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            b.statusAgendamento === 'Não Executado'
                              ? 'bg-rose-600'
                              : b.status === 'aprovado' 
                              ? b.statusExecucao === 'realizada'
                                ? 'bg-emerald-600'
                                : b.statusExecucao === 'nao_realizada'
                                ? 'bg-rose-600'
                                : 'bg-emerald-400' 
                              : b.status === 'recusado' 
                              ? 'bg-rose-500' 
                              : 'bg-amber-500'
                          }`} />
                          
                          <div className="flex items-start justify-between gap-3 pl-1">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-[10px] font-black text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {b.horaInicio} - {b.horaFim}
                                </span>
                                <span className="text-[9px] font-black text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded-md uppercase">
                                  {b.centroCusto}
                                </span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border ${
                                  (b.veiculo || 'Caminhão Munck') === 'Pickup Almoxarifado'
                                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-sky-100 text-sky-800 border-sky-200'
                                }`}>
                                  {b.veiculo || 'Caminhão Munck'}
                                </span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border ${
                                  (b.tipoDestino || 'Interno (Alumar)') === 'Externo'
                                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}>
                                  Destino: {b.tipoDestino || 'Interno (Alumar)'}
                                </span>
                                
                                {/* Status Badge */}
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  b.statusAgendamento === 'Aprovado' 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                    : b.statusAgendamento === 'Recusado' 
                                    ? 'bg-rose-50 border-rose-200 text-rose-700' 
                                    : b.statusAgendamento === 'Executado'
                                    ? 'bg-sky-50 border-sky-200 text-sky-700'
                                    : b.statusAgendamento === 'Não Executado'
                                    ? 'bg-rose-100 border-rose-300 text-rose-700 font-extrabold'
                                    : 'bg-amber-50 border-amber-200 text-amber-700'
                                }`}>
                                  {b.statusAgendamento || 'Aguardando Aprovação'}
                                </span>

                                {/* Execution Status Badge */}
                                {b.status === 'aprovado' && (
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                    b.statusExecucao === 'realizada'
                                      ? 'bg-emerald-950 border-emerald-900 text-emerald-300'
                                      : b.statusExecucao === 'nao_realizada'
                                      ? 'bg-rose-100 border-rose-200 text-rose-700 font-extrabold'
                                      : 'bg-slate-100 border-slate-200 text-slate-600'
                                  }`}>
                                    {b.statusExecucao === 'realizada' 
                                      ? 'Realizada ✓' 
                                      : b.statusExecucao === 'nao_realizada' 
                                      ? 'Não Realizada ✗' 
                                      : 'Aguardando Execução'}
                                  </span>
                                )}
                              </div>

                              <h4 className="text-xs font-black text-slate-800 leading-tight mt-1.5 flex items-center gap-1.5 flex-wrap">
                                Solicitante: {b.solicitante}
                                {b.whatsapp && (
                                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5" />
                                    {b.whatsapp}
                                  </span>
                                )}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-sans mt-0.5 leading-normal">
                                {b.descricao}
                              </p>

                              {/* Justification display for rejected requests */}
                              {b.status === 'recusado' && b.justificativa && (
                                <p className="text-[10px] text-rose-600 bg-rose-50/50 border border-rose-100 p-2 rounded-lg font-sans mt-2 leading-relaxed">
                                  <strong>Justificativa da Recusa:</strong> {b.justificativa}
                                </p>
                              )}

                              {/* Justification display for failed execution */}
                              {b.status === 'aprovado' && b.statusExecucao === 'nao_realizada' && b.justificativa && (
                                <p className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-lg font-sans mt-2 leading-relaxed">
                                  <strong>Justificativa da Falha:</strong> {b.justificativa}
                                </p>
                              )}

                              {/* Alerta Visual para Não Executado */}
                              {b.statusAgendamento === 'Não Executado' && (
                                <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs font-semibold shadow-xs">
                                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                  <div className="space-y-1">
                                    <span className="font-extrabold uppercase tracking-wide block text-[10px] text-rose-750">⚠️ ALERTA: Serviço Não Executado pelo Motorista</span>
                                    {b.justificativaMotorista ? (
                                      <p className="text-slate-600 font-sans font-medium leading-relaxed">
                                        <strong className="text-rose-850 font-bold">Motivo do Imprevisto:</strong> "{b.justificativaMotorista}"
                                      </p>
                                    ) : (
                                      <p className="text-slate-400 italic">Nenhuma justificativa informada pelo motorista.</p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Audit footer info */}
                              <div className="text-xs text-slate-400 mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1">
                                <span>Solicitado por: {b.incluido_por || 'N/D'}</span>
                                {(b.status === 'aprovado' || b.statusAgendamento === 'Aprovado') && b.autorizado_por && (
                                  <span>| Autorizado por: {b.autorizado_por}</span>
                                )}
                              </div>
                            </div>

                            {/* Only Admin can delete bookings */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteBooking(b.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition-all shrink-0 cursor-pointer"
                                title="Remover Agendamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Approval/Rejection buttons for Admin when pending approval */}
                          {isAdmin && (b.statusAgendamento === 'Aguardando Aprovação' || (!b.statusAgendamento && b.status === 'pendente')) && (
                            <div className="flex items-center gap-2 mt-1.5 pt-2 border-t border-slate-100 pl-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateStatusAgendamento(b.id, 'Aprovado')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                              >
                                <Check className="w-3 h-3" />
                                ✅ Aprovar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectBooking(b.id)}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                              >
                                <XCircle className="w-3 h-3" />
                                ❌ Recusar
                              </button>
                            </div>
                          )}

                          {/* Action buttons for Admin when status is Aprovado */}
                          {isAdmin && b.statusAgendamento === 'Aprovado' && (
                            <div className="flex items-center gap-2 mt-1.5 pt-2 border-t border-slate-100 pl-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleUpdateStatusAgendamento(b.id, 'Executado')}
                                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                              >
                                <Check className="w-3 h-3" />
                                Baixar Execução
                              </button>
                              {b.whatsapp && (
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsapp(b)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-750 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                                >
                                  <Phone className="w-3 h-3" />
                                  📱 Avisar Solicitante
                                </button>
                              )}
                            </div>
                          )}

                          {/* Action buttons for Admin when status is Executado */}
                          {isAdmin && b.statusAgendamento === 'Executado' && (
                            <div className="flex items-center gap-2 mt-1.5 pt-2 border-t border-slate-100 pl-1 flex-wrap">
                              {b.whatsapp && (
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsapp(b)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-750 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                                >
                                  <Phone className="w-3 h-3" />
                                  📱 Avisar Conclusão ao Solicitante
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      {/* Admin Password Modal Overlay */}
      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 font-sans text-slate-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Modo Administrador</h3>
                    <p className="text-[10px] text-slate-400">Insira as credenciais do SGI</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setAdminError('');
                const emailClean = adminEmail.trim().toLowerCase();
                const passwordClean = adminPassword.trim();
                if (!emailClean || !passwordClean) {
                  setAdminError('Preencha todos os campos corporativos.');
                  return;
                }
                try {
                  setIsAdminAuthLoading(true);
                  const { data, error } = await supabase.auth.signInWithPassword({
                    email: emailClean,
                    password: passwordClean,
                  });
                  if (error) {
                    throw error;
                  }
                  setIsAdmin(true);
                  setShowAdminModal(false);
                  setAlertMessage({ type: 'success', text: 'Autenticado com sucesso via SGI!' });
                } catch (err: any) {
                  console.error('Erro na autenticação administrativa:', err);
                  let errMsg = err.message || 'Erro inesperado na autenticação.';
                  if (errMsg === 'Invalid login credentials' || errMsg.includes('Invalid login credentials')) {
                    errMsg = 'Credenciais inválidas ou sem permissão de administrador.';
                  }
                  setAdminError(errMsg);
                } finally {
                  setIsAdminAuthLoading(false);
                }
              }} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    <Mail className="w-3 h-3" /> E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    placeholder="nome.sobrenome@cmpc.com.br"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 outline-none focus:border-cmpc-purple transition-all font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Senha de Acesso
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 outline-none focus:border-cmpc-purple transition-all font-sans"
                  />
                </div>

                {adminError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{adminError}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isAdminAuthLoading}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-sky-600 hover:bg-sky-700 shadow-md cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isAdminAuthLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Acessar'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Justification/Reason Prompt Modal Overlay */}
      <AnimatePresence>
        {showPromptModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 font-sans text-slate-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">{promptTitle}</h3>
                    <p className="text-[10px] text-slate-400">Justificativa SGI obrigatória</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Descrição do Motivo
                </label>
                <textarea
                  placeholder={promptPlaceholder}
                  rows={3}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  autoFocus
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 outline-none focus:border-cmpc-purple transition-all font-sans resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!promptValue.trim()) {
                      setAlertMessage({ type: 'error', text: 'Você precisa digitar uma justificativa!' });
                      return;
                    }
                    promptOnSubmit(promptValue);
                    setShowPromptModal(false);
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-sky-600 hover:bg-sky-700 shadow-md cursor-pointer text-center"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

interface PainelMotoristaProps {
  isAdmin: boolean;
}

function PainelMotorista({ isAdmin }: PainelMotoristaProps) {
  const [motoristaBookings, setMotoristaBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showImprevistoModal, setShowImprevistoModal] = useState(false);
  const [selectedBookingForImprevisto, setSelectedBookingForImprevisto] = useState<Booking | null>(null);
  const [justificativaMotoristaInput, setJustificativaMotoristaInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => {
        setAlertMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  const fetchMotoristaBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('munck_agendamentos')
        .select('*')
        .eq('data', selectedDate)
        .in('status_agendamento', ['Aguardando Aprovação', 'Aprovado', 'Executado', 'Não Executado']);

      if (fetchErr) {
        throw fetchErr;
      }

      if (data) {
        const mapped: Booking[] = data.map((b: any) => ({
          id: b.id,
          solicitante: b.solicitante,
          centroCusto: b.centro_custo,
          data: b.data,
          horaInicio: b.hora_inicio,
          horaFim: b.hora_fim,
          descricao: b.descricao,
          status: b.status_aprovacao as 'pendente' | 'aprovado' | 'recusado',
          statusExecucao: (b.status_execucao || 'pendente') as 'pendente' | 'realizada' | 'nao_realizada',
          justificativa: b.justificativa || undefined,
          createdAt: b.created_at || new Date().toISOString(),
          veiculo: b.veiculo || 'Caminhão Munck',
          whatsapp: b.whatsapp,
          statusAgendamento: b.status_agendamento || 'Aguardando Aprovação',
          justificativaMotorista: b.justificativa_motorista || undefined,
          incluido_por: b.incluido_por || undefined,
          autorizado_por: b.autorizado_por || undefined
        }));

        // Ordenadas por hora de início
        mapped.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        setMotoristaBookings(mapped);
      }
    } catch (err: any) {
      console.error('Erro ao buscar agendamentos do motorista:', err);
      setError('Erro ao carregar a lista de serviços do dia.');
    } finally {
      setLoading(false);
    }
  };

  const handleConcluirTrabalho = async (bookingId: string) => {
    setIsSubmitting(true);
    try {
      const { error: updateErr } = await supabase
        .from('munck_agendamentos')
        .update({
          status_agendamento: 'Executado',
          status_execucao: 'realizada'
        })
        .eq('id', bookingId);

      if (updateErr) throw updateErr;

      setAlertMessage({ type: 'success', text: 'Trabalho concluído com sucesso!' });
      fetchMotoristaBookings();
    } catch (err: any) {
      console.error('Erro ao concluir trabalho:', err);
      setAlertMessage({ type: 'error', text: 'Erro ao salvar alteração. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAbrirImprevistoModal = (booking: Booking) => {
    setSelectedBookingForImprevisto(booking);
    setJustificativaMotoristaInput('');
    setShowImprevistoModal(true);
  };

  const handleEnviarImprevisto = async () => {
    if (!justificativaMotoristaInput.trim()) {
      setAlertMessage({ type: 'error', text: 'A justificativa é obrigatória.' });
      return;
    }
    if (!selectedBookingForImprevisto) return;

    setIsSubmitting(true);
    try {
      const { error: updateErr } = await supabase
        .from('munck_agendamentos')
        .update({
          status_agendamento: 'Não Executado',
          status_execucao: 'nao_realizada',
          justificativa_motorista: justificativaMotoristaInput.trim()
        })
        .eq('id', selectedBookingForImprevisto.id);

      if (updateErr) throw updateErr;

      setAlertMessage({ type: 'success', text: 'Imprevisto registrado e serviço marcado como Não Executado.' });
      setShowImprevistoModal(false);
      setSelectedBookingForImprevisto(null);
      setJustificativaMotoristaInput('');
      fetchMotoristaBookings();
    } catch (err: any) {
      console.error('Erro ao reportar imprevisto:', err);
      setAlertMessage({ type: 'error', text: 'Erro ao salvar alteração. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const adjustDate = (days: number) => {
    const current = new Date(selectedDate + 'T12:00:00'); // Prevent timezone offsets
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  useEffect(() => {
    fetchMotoristaBookings();

    // Sincronização em tempo real (Realtime) para atualizações instantâneas
    const channel = supabase
      .channel('munck_agendamentos_realtime_driver')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'munck_agendamentos'
        },
        () => {
          fetchMotoristaBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto" id="painel-motorista-container">
      {/* Alert Notifications for Driver Actions */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between shadow-md ${
              alertMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {alertMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{alertMessage.text}</span>
            </div>
            <button
              onClick={() => setAlertMessage(null)}
              className="text-xs font-bold uppercase tracking-wider ml-4 text-slate-400 hover:text-slate-600"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header compact do Painel */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-800">
        {/* Decorative ambient background */}
        <div className="absolute right-0 bottom-0 opacity-10">
          <Truck className="w-48 h-48 -mr-10 -mb-10 text-white" />
        </div>
        
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canal de Operação Diária</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight leading-none uppercase">
            Painel Operacional Munck
          </h2>
          <p className="text-xs text-slate-300 max-w-md font-sans leading-relaxed">
            Visão exclusiva do motorista para acompanhamento dos serviços agendados, aprovados e executados para a data selecionada.
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3 flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-400 font-mono flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              Hoje: {todayStr.split('-').reverse().join('/')}
            </span>
            <button
              onClick={fetchMotoristaBookings}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-200 cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Activity className="w-3 h-3 text-emerald-400" />
              Atualizar Painel
            </button>
          </div>
        </div>
      </div>

      {/* Seletor de Data com Controle de Avanço e Recuo */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4" id="driver-date-selector">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-sky-600" />
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block leading-none">Filtro de Programação</span>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mt-1">
              Data de Trabalho
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => adjustDate(-1)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer transition-colors"
            title="Dia Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-1 sm:flex-initial">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-40 text-xs font-black uppercase tracking-wider p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none focus:border-sky-500 transition-all font-mono text-center cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => adjustDate(1)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer transition-colors"
            title="Dia Seguinte"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
              selectedDate === todayStr
                ? 'bg-sky-50 border border-sky-200 text-sky-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Hoje
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3">
          <Activity className="w-8 h-8 text-sky-500 animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sincronizando tarefas...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-3xl text-center text-rose-800 space-y-3 shadow-xs">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-xs font-bold uppercase">{error}</p>
          <button
            onClick={fetchMotoristaBookings}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            Tentar Novamente
          </button>
        </div>
      ) : motoristaBookings.length === 0 ? (
        <div className="p-12 bg-white border border-dashed border-slate-200 rounded-3xl text-center text-slate-400 space-y-3 shadow-xs">
          <Truck className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-black uppercase text-slate-700">Nenhuma tarefa programada</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal">
            Não há demandas aprovadas, executadas ou aguardando aprovação agendadas para a data de {selectedDate.split('-').reverse().join('/')}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
              Fila de Serviços para {selectedDate.split('-').reverse().join('/')} ({motoristaBookings.length})
            </span>
          </div>

          <div className="space-y-4">
            {motoristaBookings.map((b, idx) => {
              const status = b.statusAgendamento || 'Aguardando Aprovação';
              const isAguardando = status === 'Aguardando Aprovação';
              const isAprovado = status === 'Aprovado';
              const isExecutado = status === 'Executado';
              const isNaoExecutado = status === 'Não Executado';

              let cardStyle = '';
              let barColor = '';
              if (isAguardando) {
                cardStyle = 'border-amber-200 border-dashed bg-amber-50/10 opacity-90 shadow-sm border-2';
                barColor = 'bg-amber-400 animate-pulse';
              } else if (isAprovado) {
                cardStyle = 'border-emerald-500/45 bg-emerald-50/5 shadow-md border-2 scale-[1.01]';
                barColor = 'bg-emerald-500 ring-2 ring-emerald-300';
              } else if (isExecutado) {
                cardStyle = 'border-slate-200 bg-slate-50/50 opacity-60';
                barColor = 'bg-slate-400';
              } else if (isNaoExecutado) {
                cardStyle = 'border-rose-200 bg-rose-50/30 opacity-75';
                barColor = 'bg-rose-500';
              }

              return (
                <div 
                  key={b.id} 
                  className={`bg-white rounded-3xl p-6 transition-all duration-200 relative overflow-hidden ${cardStyle}`}
                >
                  {/* Big timeline indicator number */}
                  <div className="absolute right-4 top-4 text-5xl font-black text-slate-100 select-none font-mono leading-none">
                    {String(idx + 1).padStart(2, '0')}
                  </div>

                  {/* Left indicator bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-2.5 ${barColor}`} />

                  <div className="space-y-4 relative z-10 pl-1">
                    {/* HORA GIGANTE */}
                    <div className="flex items-center gap-2.5">
                      <span className={`p-2.5 rounded-2xl border flex items-center justify-center shrink-0 ${
                        isAguardando 
                          ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' 
                          : isAprovado 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                          : isNaoExecutado
                          ? 'bg-rose-50 text-rose-600 border-rose-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <Clock className="w-5 h-5" />
                      </span>
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block leading-none">Horário do Trabalho</span>
                        <h3 className="text-2xl font-black text-slate-800 leading-none tracking-tight font-mono mt-1">
                          {b.horaInicio} - {b.horaFim}
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                      {/* CENTRO DE CUSTO */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Centro de Custo</span>
                        <div className="inline-block bg-slate-100 border border-slate-200 rounded-xl px-3 py-1 text-sm font-black text-slate-700 tracking-wide uppercase">
                          {b.centroCusto}
                        </div>
                      </div>

                      {/* STATUS ATUAL */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Status do Serviço</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          {isAguardando && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase px-3.5 py-1.5 rounded-2xl border bg-amber-100 border-amber-300 text-amber-900 shadow-sm">
                              <Clock className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
                              ⏳ Aguardando Aprovação
                            </span>
                          )}
                          {isAprovado && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase px-3.5 py-1.5 rounded-2xl border bg-emerald-500 border-emerald-600 text-white shadow-md animate-bounce">
                              <Truck className="w-4 h-4 text-white" />
                              🚚 Liberado (Aprovado)
                            </span>
                          )}
                          {isExecutado && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase px-3.5 py-1 rounded-2xl border bg-slate-100 border-slate-300 text-slate-600">
                              <CheckCircle className="w-4 h-4 text-slate-500" />
                              Concluído
                            </span>
                          )}
                          {isNaoExecutado && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase px-3.5 py-1 rounded-2xl border bg-rose-100 border-rose-300 text-rose-700 font-extrabold">
                              <XCircle className="w-4 h-4 text-rose-600" />
                              Não Executado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* DESCRIÇÃO DO TRABALHO GIGANTE */}
                    <div className="space-y-1 pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Descrição da Atividade</span>
                      <p className="text-sm sm:text-base font-bold text-slate-800 leading-relaxed bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                        {b.descricao}
                      </p>
                    </div>

                    {/* SOLICITANTE INFO */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1 font-semibold">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Solicitante: <strong className="text-slate-700">{b.solicitante}</strong>
                      </span>
                      {b.whatsapp && (
                        <span className="flex items-center gap-1 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          Contato: <span className="text-emerald-700 font-mono font-black">{b.whatsapp}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-semibold">
                        <Truck className="w-3.5 h-3.5 text-sky-500" />
                        Recurso: <span className="text-sky-700 font-bold">{b.veiculo || 'Caminhão Munck'}</span>
                      </span>
                    </div>

                    {/* Audit footer info */}
                    <div className="text-xs text-slate-400 mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1">
                      <span>Solicitado por: {b.incluido_por || 'N/D'}</span>
                      {(b.status === 'aprovado' || b.statusAgendamento === 'Aprovado') && b.autorizado_por && (
                        <span>| Autorizado por: {b.autorizado_por}</span>
                      )}
                    </div>

                    {/* Exibe justificativa do motorista se houver */}
                    {isNaoExecutado && b.justificativaMotorista && (
                      <div className="pt-3 border-t border-slate-100 mt-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Justificativa do Imprevisto</span>
                        <p className="text-xs font-bold text-rose-700 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 mt-1 italic leading-relaxed">
                          "{b.justificativaMotorista}"
                        </p>
                      </div>
                    )}

                    {/* Botões de Ação para o Motorista */}
                    {isAprovado && (
                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleConcluirTrabalho(b.id)}
                          className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4 text-white animate-pulse" />
                          ✅ Concluir Trabalho
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleAbrirImprevistoModal(b)}
                          className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md disabled:opacity-50"
                        >
                          <AlertCircle className="w-4 h-4 text-white" />
                          ⚠️ Reportar Imprevisto / Não Realizado
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE JUSTIFICATIVA DO MOTORISTA */}
      <AnimatePresence>
        {showImprevistoModal && selectedBookingForImprevisto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-3 border-b border-slate-150 pb-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                    Reportar Imprevisto
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 font-sans">
                    O serviço para <strong className="text-slate-600">{selectedBookingForImprevisto.solicitante}</strong> às <strong className="text-slate-600">{selectedBookingForImprevisto.horaInicio}</strong> será marcado como <strong className="text-rose-650">Não Executado</strong>.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Justificativa do Imprevisto
                </label>
                <textarea
                  rows={4}
                  required
                  value={justificativaMotoristaInput}
                  onChange={(e) => setJustificativaMotoristaInput(e.target.value)}
                  placeholder="Digite o motivo detalhado do imprevisto ou falha na execução..."
                  className="w-full text-xs p-3 rounded-2xl border border-slate-300 bg-slate-50/50 text-slate-800 outline-none focus:border-rose-500 transition-all font-sans leading-relaxed resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setShowImprevistoModal(false);
                    setSelectedBookingForImprevisto(null);
                    setJustificativaMotoristaInput('');
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer text-center disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleEnviarImprevisto}
                  className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-700 shadow-md cursor-pointer text-center disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PainelMotoristaMunckProps {
  onBackToHub: () => void;
}

function PainelMotoristaMunck({ onBackToHub }: PainelMotoristaMunckProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col font-sans" id="munck-app-container-driver">
      {/* Dynamic Header Block */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 md:px-12 sticky top-0 z-35">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToHub}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition duration-150 cursor-pointer"
              title="Voltar ao Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="border-l border-slate-300 pl-4 py-1">
              <h2 className="font-sans font-black text-base text-cmpc-purple tracking-tight leading-tight uppercase flex items-center gap-2">
                <Truck className="w-5 h-5 text-sky-500" />
                Painel do Motorista
              </h2>
              <p className="text-[10px] font-bold text-cmpc-gray uppercase tracking-wider leading-none mt-0.5">
                Módulo Munck • CMPC Industrial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right flex flex-col items-end justify-center shrink-0">
              <span className="text-xs font-bold text-slate-400 tracking-wider font-mono uppercase">Canal de Operação Diária</span>
              <span className="text-[10px] font-bold text-sky-600 uppercase font-sans">SGI-MOTORISTA-01</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-6 py-8 w-full space-y-6">
        <PainelMotorista isAdmin={false} />
      </main>
    </div>
  );
}

export default function AgendamentoMunck({ onBackToHub }: AgendamentoMunckProps) {
  const { session: globalSession } = useAuth();
  const perfilUsuario = globalSession?.perfil;

  if (perfilUsuario === 'OPERADOR/MOTORISTA') {
    return <PainelMotoristaMunck onBackToHub={onBackToHub} />;
  }

  // Fallback para Administrador e outros perfis de gestão autorizados
  return <PainelAdminMunck onBackToHub={onBackToHub} />;
}
