import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Truck, 
  FileText, 
  Building2, 
  Calendar, 
  X, 
  Tag, 
  Package, 
  Clock, 
  AlertTriangle,
  Check,
  Filter,
  Download,
  ExternalLink,
  Sliders,
  BarChart3
} from 'lucide-react';
import { DevolucaoAtivo, DevolucaoEtapa } from '../types';
import { supabase } from '../lib/supabase';
import { 
  db, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc 
} from '../lib/firebase';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface DevolucaoAtivosProps {
  onBackToHub: () => void;
  isTVMode?: boolean;
}

const ETAPAS_ORDEM: DevolucaoEtapa[] = [
  'Remessa criada',
  'Emissão doc',
  'Em transferência',
  'Em rota de entrega',
  'Entrega realizada'
];

const formatDateBR = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    const match = String(dateStr).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return match[0];
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
};

export const isItemDelivered = (item: DevolucaoAtivo): boolean => {
  if (item.entrega_concluida === true || item.entregaConcluida === true) return true;
  if (item.etapa_atual === 5 || item.etapa_atual === '5') return true;
  if (item.etapaAtual === 'Entrega realizada' || item.etapa_atual === 'Entrega realizada') return true;
  return false;
};

export const getItemEtapaNum = (item: DevolucaoAtivo): number => {
  if (item.entrega_concluida === true || item.entregaConcluida === true) return 5;
  if (typeof item.etapa_atual === 'number' && item.etapa_atual >= 1 && item.etapa_atual <= 5) return item.etapa_atual;
  if (typeof item.etapa_atual === 'string') {
    const num = parseInt(item.etapa_atual, 10);
    if (!isNaN(num) && num >= 1 && num <= 5) return num;
  }
  if (item.etapaAtual) {
    const idx = ETAPAS_ORDEM.indexOf(item.etapaAtual);
    if (idx >= 0) return idx + 1;
  }
  return 1;
};

const calculateTransitDays = (item: DevolucaoAtivo): { days: number; isDelivered: boolean } => {
  const isDelivered = isItemDelivered(item);
  const startStr = item.criado_em || item.criadoEm || (item as any).created_at;

  if (!startStr) {
    return { days: 0, isDelivered };
  }

  const parseDate = (val: string | Date | undefined): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    const match = String(val).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (match) {
      const [_, day, month, year, hour = '00', minute = '00'] = match;
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
    }
    return null;
  };

  const startDate = parseDate(startStr);
  
  let endDate: Date | null = null;
  if (isDelivered) {
    const endStr = (item as any).data_entrega || (item as any).dataEntrega || item.data_evento_transportadora || item.data_ultima_atualizacao || item.dataUltimaAtualizacao || item.atualizado_em || item.atualizadoEm;
    endDate = endStr ? parseDate(endStr) : new Date();
  } else {
    endDate = new Date();
  }

  if (!startDate || !endDate) {
    return { days: 0, isDelivered };
  }

  const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return { days, isDelivered };
};

const SEED_DEVOLUCOES: DevolucaoAtivo[] = [
  {
    id: 'dev-seed-1',
    tagEquipamento: 'MUNK-0042',
    descricaoItem: 'Caminhão Munck 10 Toneladas',
    fornecedorDestino: 'Global Munck Locações S/A',
    cnpjDestino: '12.345.678/0001-99',
    numeroNF: '10432',
    etapaAtual: 'Em transferência',
    criadoEm: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    atualizadoEm: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'dev-seed-2',
    tagEquipamento: 'GER-0089',
    descricaoItem: 'Gerador de Energia 150kVA',
    fornecedorDestino: 'Sotreq Caterpillar',
    cnpjDestino: '98.765.432/0001-00',
    numeroNF: '00984',
    etapaAtual: 'Remessa criada',
    criadoEm: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    atualizadoEm: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'dev-seed-3',
    tagEquipamento: 'COMP-0211',
    descricaoItem: 'Compressor de Ar Industrial',
    fornecedorDestino: 'Atlas Copco Brasil Ltda',
    cnpjDestino: '45.678.901/0003-22',
    numeroNF: '45391',
    etapaAtual: 'Entrega realizada',
    criadoEm: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    atualizadoEm: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export default function DevolucaoAtivos({ onBackToHub, isTVMode = false }: DevolucaoAtivosProps) {
  const [devolucoes, setDevolucoes] = useState<DevolucaoAtivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingMessage, setSyncingMessage] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [useSupabase, setUseSupabase] = useState(true);
  
  // Tabs Navigation
  const [activeTab, setActiveTab] = useState<'automated' | 'manual' | 'dashboard'>(isTVMode ? 'dashboard' : 'automated');

  // Batch action and export states
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [batchSyncProgress, setBatchSyncProgress] = useState('');
  const [exportingReport, setExportingReport] = useState(false);

  // Form states
  const [itemsList, setItemsList] = useState<Array<{ tag: string; descricao: string }>>([
    { tag: '', descricao: '' }
  ]);
  const [tagInput, setTagInput] = useState('');
  const [descricaoInput, setDescricaoInput] = useState('');
  const [fornecedorInput, setFornecedorInput] = useState('');
  const [cnpjInput, setCnpjInput] = useState('');
  const [nfInput, setNfInput] = useState('');
  const [transportadoraInput, setTransportadoraInput] = useState<string>('Global Cargo');
  const [showCustomTransport, setShowCustomTransport] = useState(false);
  const [customTransportadoraInput, setCustomTransportadoraInput] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Fetch / Sync with Supabase (Pure real-trip with no mock/local fallback overrides)
  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('devolucoes_ativos')
        .select('*');

      if (error) {
        throw error;
      }

      if (data) {
        const parsed: DevolucaoAtivo[] = data.map((row: any) => {
          const tag = row.tag_equipamento || row.tagEquipamento || '';
          const desc = row.descricao_item || row.descricaoItem || '';
          const fornecedor = row.fornecedor_destino || row.fornecedorDestino || '';
          const cnpj = row.cnpj_destino || row.cnpjDestino || '';
          const nf = row.numero_nf || row.nota_fiscal || row.numeroNF || '';
          const criado = row.criado_em || row.criadoEm || new Date().toISOString();
          const atualizado = row.data_ultima_atualizacao || row.atualizado_em || row.dataUltimaAtualizacao || row.atualizadoEm || new Date().toISOString();
          const statusT = row.status_texto || row.statusTexto || '';
          
          const isConcluida = Boolean(row.entrega_concluida ?? row.entregaConcluida);
          const etapaNumRaw = row.etapa_atual ?? row.etapaAtual;
          let etapaNum = etapaNumRaw;
          let etapaStr: DevolucaoEtapa = 'Remessa criada';

          if (isConcluida) {
            etapaNum = 5;
            etapaStr = 'Entrega realizada';
          } else if (typeof etapaNumRaw === 'number') {
            if (etapaNumRaw >= 1 && etapaNumRaw <= 5) etapaStr = ETAPAS_ORDEM[etapaNumRaw - 1];
          } else if (typeof etapaNumRaw === 'string') {
            const num = parseInt(etapaNumRaw, 10);
            if (!isNaN(num) && num >= 1 && num <= 5) {
              etapaStr = ETAPAS_ORDEM[num - 1];
            } else if (ETAPAS_ORDEM.includes(etapaNumRaw as DevolucaoEtapa)) {
              etapaStr = etapaNumRaw as DevolucaoEtapa;
            }
          }

          let parsedItens: Array<{ tag: string; descricao: string }> = [];
          if (row.itens) {
            if (Array.isArray(row.itens)) {
              parsedItens = row.itens;
            } else if (typeof row.itens === 'string') {
              try {
                parsedItens = JSON.parse(row.itens);
              } catch (_) {}
            }
          }
          if (!parsedItens || parsedItens.length === 0) {
            parsedItens = [{ tag, descricao: desc }];
          }

          return {
            id: row.id?.toString() || Math.random().toString(),
            tagEquipamento: tag,
            tag_equipamento: tag,
            descricaoItem: desc,
            descricao_item: desc,
            fornecedorDestino: fornecedor,
            fornecedor_destino: fornecedor,
            cnpjDestino: cnpj,
            cnpj_destino: cnpj,
            numeroNF: nf,
            numero_nf: nf,
            nota_fiscal: nf,
            entrega_concluida: isConcluida,
            entregaConcluida: isConcluida,
            etapa_atual: etapaNum,
            etapaAtual: etapaStr,
            criadoEm: criado,
            criado_em: criado,
            atualizadoEm: atualizado,
            atualizado_em: atualizado,
            statusTexto: statusT,
            status_texto: statusT,
            dataUltimaAtualizacao: atualizado,
            data_ultima_atualizacao: atualizado,
            data_evento_transportadora: row.data_evento_transportadora || '',
            data_previsao_entrega: row.data_previsao_entrega || '',
            dataPrevisaoEntrega: row.data_previsao_entrega || '',
            itens: parsedItens,
            transportadora: row.transportadora || 'Global Cargo'
          };
        });

        // Sort chronologically (newest first)
        parsed.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
        setDevolucoes(parsed);
        setUseSupabase(true);
      }
    } catch (err: any) {
      console.error("Erro ao carregar dados do Supabase:", err);
      showToast("Falha ao carregar dados do Supabase: " + (err.message || err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Tickle / Force Reset de Atividade para Modo TV a cada 5 minutos (300.000 ms)
  useEffect(() => {
    if (!isTVMode) return;

    const timer = setInterval(() => {
      const event = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: window.innerWidth / 2,
        clientY: window.innerHeight / 2
      });
      document.body.dispatchEvent(event);
      console.log("Atividade forçada para Modo TV (mousemove)");
    }, 300000);

    return () => {
      clearInterval(timer);
    };
  }, [isTVMode]);

  // Backup to localStorage for safety
  useEffect(() => {
    if (devolucoes.length > 0) {
      localStorage.setItem('industrial_reverse_logistics_backup', JSON.stringify(devolucoes));
    }
  }, [devolucoes]);

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
  };

  // Real integration with tracking API
  const handleSimulateUpdate = async (id: string, currentEtapa: DevolucaoEtapa) => {
    if (syncingId) return;

    const item = devolucoes.find(d => d.id === id);
    if (!item) return;

    setSyncingId(id);
    setSyncingMessage('Consultando API de Rastreio em tempo real...');

    try {
      // 1. HTTP POST request to proxy API route
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch('/api/rastrear-global', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.access_token || ''}`
        },
        body: JSON.stringify({
          cnpj: item.cnpjDestino,
          nf: item.numeroNF
        })
      });

      if (!response.ok) {
        throw new Error(`Erro de rede ou servidor: Código ${response.status}`);
      }

      const data = await response.json();
      console.log("Resposta da API:", data);

      // 2. Strict Validation
      if (data.sucesso === true) {
        const etapaNum = typeof data.etapa === 'number' ? data.etapa : parseInt(data.etapa, 10);
        const statusTexto = data.status || '';
        const dataReal = data.data_real || '';
        const nextEtapa = ETAPAS_ORDEM[etapaNum - 1] || 'Remessa criada';
        const updatedTime = new Date().toISOString();
 
        // 3. Update Supabase table devolucoes_ativos
        if (useSupabase) {
          const { error } = await supabase
            .from('devolucoes_ativos')
            .update({
              etapa_atual: etapaNum,
              status_texto: statusTexto,
              data_ultima_atualizacao: updatedTime,
              data_evento_transportadora: dataReal,
              data_previsao_entrega: data.previsao || ''
            })
            .eq('id', id);
 
          if (error) {
            throw error;
          }
        } else {
          // Fallback to local storage or Firestore
          await setDoc(doc(db, 'devolucoes', id), {
            ...item,
            etapaAtual: nextEtapa,
            statusTexto,
            dataUltimaAtualizacao: updatedTime,
            atualizadoEm: updatedTime,
            data_evento_transportadora: dataReal,
            data_previsao_entrega: data.previsao || ''
          }, { merge: true });
        }
 
        // Force state update so Stepper reflects the real data
        setDevolucoes(prev => prev.map(d => 
          d.id === id 
            ? { 
                ...d, 
                etapaAtual: nextEtapa, 
                statusTexto, 
                dataUltimaAtualizacao: updatedTime, 
                atualizadoEm: updatedTime,
                data_evento_transportadora: dataReal,
                data_previsao_entrega: data.previsao || '',
                dataPrevisaoEntrega: data.previsao || ''
              } 
            : d
        ));

        showToast("Rastreio atualizado com sucesso!", 'success');
      } else {
        // If API returns sucesso === false, display error Toast (red) with data.erro
        const errorMessage = data.erro || 'Falha ao buscar dados de rastreio.';
        showToast(errorMessage, 'error');
      }
    } catch (err: any) {
      console.error("Erro na integração real com a API de Rastreio:", err);
      showToast(err.message || "Erro de conexão com o servidor de rastreio.", 'error');
    } finally {
      setSyncingId(null);
      setSyncingMessage('');
      setLoading(false);
    }
  };

  // 1.5 ATUALIZAÇÃO MANUAL DE ETAPAS (Aba 2 - Outras Transportadoras)
  const handleManualStepChange = async (id: string, newStepNum: number) => {
    if (newStepNum < 1 || newStepNum > 5) return;
    const nextEtapa = ETAPAS_ORDEM[newStepNum - 1];
    const updatedTime = new Date().toISOString();
    const isCompleted = newStepNum === 5;
    
    let statusTexto = 'Status atualizado manualmente.';
    if (newStepNum === 1) statusTexto = 'Remessa registrada para coleta.';
    if (newStepNum === 2) statusTexto = 'Documentação emitida e mercadoria liberada.';
    if (newStepNum === 3) statusTexto = 'Em trânsito para o destino final.';
    if (newStepNum === 4) statusTexto = 'Saiu para entrega ao destinatário.';
    if (newStepNum === 5) statusTexto = 'Mercadoria entregue e protocolo assinado.';

    try {
      if (useSupabase) {
        const { error } = await supabase
          .from('devolucoes_ativos')
          .update({
            etapa_atual: newStepNum,
            entrega_concluida: isCompleted,
            status_texto: statusTexto,
            data_ultima_atualizacao: updatedTime
          })
          .eq('id', id);

        if (error) throw error;
      } else {
        await setDoc(doc(db, 'devolucoes', id), {
          etapaAtual: nextEtapa,
          entrega_concluida: isCompleted,
          statusTexto: statusTexto,
          dataUltimaAtualizacao: updatedTime,
          atualizadoEm: updatedTime
        }, { merge: true });
      }

      // Force state update
      setDevolucoes(prev => prev.map(d => 
        d.id === id 
          ? { 
              ...d, 
              etapa_atual: newStepNum,
              etapaAtual: nextEtapa, 
              entrega_concluida: isCompleted,
              entregaConcluida: isCompleted,
              statusTexto, 
              status_texto: statusTexto,
              dataUltimaAtualizacao: updatedTime, 
              atualizadoEm: updatedTime
            } 
          : d
      ));

      showToast(`Status do ativo atualizado para "${nextEtapa}" com sucesso!`, 'success');
    } catch (err: any) {
      console.error("Erro ao atualizar status manual:", err);
      showToast(`Erro ao atualizar status: ${err.message || err}`, 'error');
    }
  };

  // 1.6 TOGGLE MANUAL DE CONCLUSÃO DA ENTREGA (ETAPA 5)
  const handleToggleEntregaConcluida = async (id: string, currentStatus?: boolean) => {
    const newStatus = !currentStatus;
    const updatedTime = new Date().toISOString();
    const nextEtapa = newStatus ? 'Entrega realizada' : 'Remessa criada';
    const etapaNum = newStatus ? 5 : 1;
    const statusTexto = newStatus 
      ? 'Entrega manual concluída e confirmada.' 
      : 'Remessa reaberta / Em andamento.';

    try {
      if (useSupabase) {
        const { error } = await supabase
          .from('devolucoes_ativos')
          .update({
            entrega_concluida: newStatus,
            etapa_atual: etapaNum,
            status_texto: statusTexto,
            data_ultima_atualizacao: updatedTime
          })
          .eq('id', id);

        if (error) {
          console.warn("Erro no update completo, tentando apenas entrega_concluida:", error);
          const { error: fallbackError } = await supabase
            .from('devolucoes_ativos')
            .update({
              entrega_concluida: newStatus
            })
            .eq('id', id);
          if (fallbackError) throw fallbackError;
        }
      } else {
        await setDoc(doc(db, 'devolucoes', id), {
          entrega_concluida: newStatus,
          etapaAtual: nextEtapa,
          statusTexto: statusTexto,
          dataUltimaAtualizacao: updatedTime,
          atualizadoEm: updatedTime
        }, { merge: true });
      }

      setDevolucoes(prev => prev.map(d => 
        d.id === id 
          ? { 
              ...d, 
              entrega_concluida: newStatus,
              entregaConcluida: newStatus,
              etapa_atual: etapaNum,
              etapaAtual: nextEtapa, 
              statusTexto: statusTexto, 
              status_texto: statusTexto,
              dataUltimaAtualizacao: updatedTime, 
              atualizadoEm: updatedTime
            } 
          : d
      ));

      showToast(newStatus ? 'Entrega marcada como CONCLUÍDA (Etapa 5)!' : 'Entrega reaberta (Etapa 1).', 'success');
    } catch (err: any) {
      console.error("Erro ao alternar status de conclusão da entrega:", err);
      showToast(`Erro ao atualizar status: ${err.message || err}`, 'error');
    }
  };

  // 1. ATUALIZAR TODOS (Sincronização em Lote com Throttling de 1.5s)
  const handleBatchUpdate = async () => {
    if (isBatchSyncing || syncingId) return;
    if (devolucoes.length === 0) {
      showToast("Nenhum card ativo para atualizar.", 'info');
      return;
    }

    setIsBatchSyncing(true);
    let successCount = 0;
    let failCount = 0;

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token || '';

    try {
      let index = 0;
      // Loop for...of que percorre todos os cards ativos
      for (const item of devolucoes) {
        index++;
        setBatchSyncProgress(`Atualizando ${index} de ${devolucoes.length}...`);

        try {
          const response = await fetch('/api/rastrear-global', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              cnpj: item.cnpjDestino,
              nf: item.numeroNF
            })
          });

          if (!response.ok) {
            throw new Error(`Erro HTTP: Código ${response.status}`);
          }

          const data = await response.json();

          if (data.sucesso === true) {
            const etapaNum = typeof data.etapa === 'number' ? data.etapa : parseInt(data.etapa, 10);
            const statusTexto = data.status || '';
            const dataReal = data.data_real || '';
            const nextEtapa = ETAPAS_ORDEM[etapaNum - 1] || 'Remessa criada';
            const updatedTime = new Date().toISOString();

            if (useSupabase) {
              const { error } = await supabase
                .from('devolucoes_ativos')
                .update({
                  etapa_atual: etapaNum,
                  status_texto: statusTexto,
                  data_ultima_atualizacao: updatedTime,
                  data_evento_transportadora: dataReal,
                  data_previsao_entrega: data.previsao || ''
                })
                .eq('id', item.id);

              if (error) throw error;
            } else {
              await setDoc(doc(db, 'devolucoes', item.id), {
                ...item,
                etapaAtual: nextEtapa,
                statusTexto,
                dataUltimaAtualizacao: updatedTime,
                atualizadoEm: updatedTime,
                data_evento_transportadora: dataReal,
                data_previsao_entrega: data.previsao || ''
              }, { merge: true });
            }

            // Atualiza no estado local para feedback imediato
            setDevolucoes(prev => prev.map(d => 
              d.id === item.id 
                ? { 
                    ...d, 
                    etapaAtual: nextEtapa, 
                    statusTexto, 
                    dataUltimaAtualizacao: updatedTime, 
                    atualizadoEm: updatedTime,
                    data_evento_transportadora: dataReal,
                    data_previsao_entrega: data.previsao || '',
                    dataPrevisaoEntrega: data.previsao || ''
                  } 
                : d
            ));
            successCount++;
          } else {
            failCount++;
            console.warn(`Falha de sincronização na API para o item ${item.tagEquipamento}: ${data.erro}`);
          }
        } catch (itemErr: any) {
          failCount++;
          console.error(`Erro ao sincronizar item ${item.tagEquipamento}:`, itemErr);
        }

        // Atraso proposital obrigatório de 1.5 segundos para evitar bloqueio por Rate Limit
        if (index < devolucoes.length) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Recarrega todos os dados mais recentes do banco
      await loadData();
      showToast(`Sincronização em lote concluída! Sucessos: ${successCount}, Falhas: ${failCount}`, 'success');
    } catch (err: any) {
      console.error("Erro na atualização em lote:", err);
      showToast("Erro durante a atualização em lote dos ativos.", 'error');
    } finally {
      setIsBatchSyncing(false);
      setBatchSyncProgress('');
    }
  };

  // 2. BAIXAR RELATÓRIO (Exportação de Dados no formato CSV)
  const handleDownloadReport = async () => {
    if (exportingReport) return;
    setExportingReport(true);
    
    try {
      // Força a busca dos dados mais recentes da tabela devolucoes_ativos
      const { data, error } = await supabase
        .from('devolucoes_ativos')
        .select('*');

      if (error) throw error;
      if (!data || data.length === 0) {
        showToast("Nenhum dado encontrado para exportação.", 'info');
        return;
      }

      // Definir cabeçalhos do arquivo CSV
      const headers = [
        'ID',
        'TAG Principal',
        'Descricao Principal',
        'Fornecedor Destino',
        'CNPJ Destino',
        'Numero NF',
        'Etapa Atual (Codigo)',
        'Etapa Atual (Texto)',
        'Status do Rastreio',
        'Ultima Atualizacao',
        'Data Evento Transportadora',
        'Itens Detalhados',
        'Criado Em'
      ];

      // Função de escape para garantir conformidade do CSV
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return '';
        let str = '';
        if (typeof val === 'object') {
          if (Array.isArray(val)) {
            // Converte a lista de itens JSONB para uma string limpa sem quebrar as colunas do CSV
            str = val.map(it => `[${it.tag || ''}]: ${it.descricao || ''}`).join(' | ');
          } else {
            str = JSON.stringify(val);
          }
        } else {
          str = String(val);
        }

        // Duplica as aspas internas para escape correto
        const escaped = str.replace(/"/g, '""');
        // Adiciona aspas se houver caracteres especiais que necessitem de escape
        if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('\r') || escaped.includes('"')) {
          return `"${escaped}"`;
        }
        return escaped;
      };

      // Mapeia todas as linhas
      const rows = data.map((row: any) => {
        const tag = row.tag_equipamento || '';
        const desc = row.descricao_item || '';
        const fornecedor = row.fornecedor_destino || '';
        const cnpj = row.cnpj_destino || '';
        const nf = row.numero_nf || row.nota_fiscal || '';
        const etapaNum = row.etapa_atual || 1;
        const statusT = row.status_texto || '';
        const atualizado = row.data_ultima_atualizacao || '';
        const dataEvento = row.data_evento_transportadora || '';
        const criado = row.criado_em || '';

        let etapaStr = 'Remessa criada';
        if (typeof etapaNum === 'number' && etapaNum >= 1 && etapaNum <= 5) {
          etapaStr = ETAPAS_ORDEM[etapaNum - 1];
        }

        // Resolve os itens detalhados (JSONB)
        let parsedItens: Array<{ tag: string; descricao: string }> = [];
        if (row.itens) {
          if (Array.isArray(row.itens)) {
            parsedItens = row.itens;
          } else if (typeof row.itens === 'string') {
            try {
              parsedItens = JSON.parse(row.itens);
            } catch (_) {}
          }
        }
        if (!parsedItens || parsedItens.length === 0) {
          parsedItens = [{ tag, descricao: desc }];
        }

        return [
          row.id || '',
          tag,
          desc,
          fornecedor,
          cnpj,
          nf,
          etapaNum,
          etapaStr,
          statusT,
          atualizado,
          dataEvento,
          parsedItens,
          criado
        ];
      });

      // Monta o conteúdo CSV completo
      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(escapeCSV).join(','))
      ].join('\r\n');

      // Cria Blob com BOM UTF-8 para correta codificação de acentos no Excel
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { 
        type: 'text/csv;charset=utf-8;' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'relatorio_logistica_reversa.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("Relatório de Logística baixado com sucesso!", 'success');
    } catch (err: any) {
      console.error("Erro ao baixar relatório:", err);
      showToast(err.message || "Erro de exportação do relatório.", 'error');
    } finally {
      setExportingReport(false);
    }
  };

  // CNPJ mask helper
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.slice(0, 14);
    
    // Apply CNPJ mask: 99.999.999/9999-99
    if (value.length > 12) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    } else if (value.length > 8) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
    }
    
    setCnpjInput(value);
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    // Validate multi-items list
    if (itemsList.length === 0) {
      errors.items = 'Adicione pelo menos um item para devolução.';
    } else {
      itemsList.forEach((it, idx) => {
        if (!it.tag.trim()) {
          errors[`item_${idx}_tag`] = 'A TAG é obrigatória.';
        }
        if (!it.descricao.trim()) {
          errors[`item_${idx}_descricao`] = 'A descrição é obrigatória.';
        }
      });
    }

    if (!fornecedorInput.trim()) errors.fornecedor = 'O fornecedor de destino é obrigatório.';
    if (!cnpjInput.trim()) {
      errors.cnpj = 'O CNPJ de destino é obrigatório.';
    } else if (cnpjInput.replace(/\D/g, '').length !== 14) {
      errors.cnpj = 'O CNPJ deve conter exatamente 14 dígitos.';
    }
    if (!nfInput.trim()) errors.nf = 'O número da Nota Fiscal é obrigatório.';

    if (transportadoraInput === 'Outras') {
      if (!customTransportadoraInput.trim()) {
        errors.transportadoraCustom = 'O nome da transportadora é obrigatório.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    try {
      const nowString = new Date().toISOString();
      const firstTag = itemsList[0]?.tag.trim().toUpperCase() || '';
      const firstDesc = itemsList[0]?.descricao.trim() || '';
      const mappedItems = itemsList.map(it => ({
        tag: it.tag.trim().toUpperCase(),
        descricao: it.descricao.trim()
      }));

      const finalTransportadora = transportadoraInput === 'Global Cargo'
        ? 'Global Cargo'
        : customTransportadoraInput.trim();

      const insertPayload = {
        tag_equipamento: firstTag,
        descricao_item: firstDesc,
        fornecedor_destino: fornecedorInput.trim(),
        cnpj_destino: cnpjInput.trim(),
        numero_nf: nfInput.trim(),
        etapa_atual: 1,
        status_texto: finalTransportadora === 'Global Cargo' 
          ? "Remessa criada na transportadora. Aguardando coleta."
          : `Remessa registrada para controle manual (${finalTransportadora}). Etapa inicial: Remessa criada.`,
        data_ultima_atualizacao: nowString,
        criado_em: nowString,
        atualizado_em: nowString,
        itens: mappedItems,
        transportadora: finalTransportadora
      };

      const { error } = await supabase
        .from('devolucoes_ativos')
        .insert([insertPayload]);

      if (error) {
        throw error;
      }

      // CRÍTICO: Após o .insert() retornar sucesso, chame imediatamente a função de leitura para recarregar a lista diretamente do banco
      await loadData();

      showToast(`Devolução registrada com sucesso (${finalTransportadora})!`, 'success');
      
      // Se registrou uma manual, vamos navegar automaticamente para a aba de manuais para que o usuário veja o item criado
      if (finalTransportadora !== 'Global Cargo') {
        setActiveTab('manual');
      } else {
        setActiveTab('automated');
      }
      
      // Reset form & close modal
      setItemsList([{ tag: '', descricao: '' }]);
      setTagInput('');
      setDescricaoInput('');
      setFornecedorInput('');
      setCnpjInput('');
      setNfInput('');
      setTransportadoraInput('Global Cargo');
      setCustomTransportadoraInput('');
      setShowCustomTransport(false);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar devolução no Supabase:", err);
      showToast(`Falha ao registrar devolução no banco de dados: ${err.message || err}`, 'error');
    }
  };

  // Delete option for clean management
  const handleDeleteDevolucao = async (id: string, tag: string) => {
    if (window.confirm(`Tem certeza de que deseja remover o rastreio do ativo ${tag}?`)) {
      try {
        if (useSupabase) {
          const { error } = await supabase
            .from('devolucoes_ativos')
            .delete()
            .eq('id', id);

          if (error) {
            throw error;
          }
          setDevolucoes(prev => prev.filter(item => item.id !== id));
        } else {
          await deleteDoc(doc(db, 'devolucoes', id));
        }
        showToast(`Rastreio do ativo ${tag} removido com sucesso.`, 'info');
      } catch (err) {
        console.warn("Could not delete from remote. Deleting locally:", err);
        setDevolucoes(prev => prev.filter(item => item.id !== id));
        showToast(`Rastreio do ativo ${tag} removido localmente.`, 'info');
      }
    }
  };

  // Filters logic
  const filteredDevolucoes = devolucoes.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      item.tagEquipamento.toLowerCase().includes(query) ||
      (item.descricaoItem && item.descricaoItem.toLowerCase().includes(query)) ||
      item.fornecedorDestino.toLowerCase().includes(query) ||
      item.numeroNF.toLowerCase().includes(query) ||
      item.cnpjDestino.includes(query);

    const stepNum = getItemEtapaNum(item);
    const stepName = ETAPAS_ORDEM[stepNum - 1];
    const matchesStatus = statusFilter === 'all' || item.etapaAtual === statusFilter || stepName === statusFilter;

    // Filter by active tab (automated or manual)
    const matchesTab = activeTab === 'manual'
      ? item.transportadora !== 'Global Cargo'
      : item.transportadora === 'Global Cargo';

    return matchesSearch && matchesStatus && matchesTab;
  });

  // KPI Calculations
  const totalCount = devolucoes.length;
  const inTransitCount = devolucoes.filter(d => !isItemDelivered(d)).length;
  const deliveredCount = devolucoes.filter(d => isItemDelivered(d)).length;
  const completionRate = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0;

  // Advanced BI & Lead Time calculations
  const calculateLeadTime = (item: DevolucaoAtivo) => {
    const startStr = item.criado_em || item.criadoEm;
    const endStr = item.data_evento_transportadora || item.data_ultima_atualizacao || item.dataUltimaAtualizacao || item.atualizado_em || item.atualizadoEm;
    if (!startStr || !endStr) return 0;

    try {
      const parseDate = (str: string) => {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d;
        const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
        if (match) {
          const [_, day, month, year, hour = '00', minute = '00'] = match;
          return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
        }
        return null;
      };

      const startDate = parseDate(startStr);
      const endDate = parseDate(endStr);
      if (!startDate || !endDate) return 0;

      const diffMs = endDate.getTime() - startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays > 0 ? diffDays : 0;
    } catch (e) {
      return 0;
    }
  };

  const entreguesSucesso = devolucoes.filter(d => isItemDelivered(d));

  const emTransito = devolucoes.filter(d => {
    const step = getItemEtapaNum(d);
    return step > 1 && step < 5;
  });

  const leadTimes = entreguesSucesso.map(calculateLeadTime).filter(lt => lt > 0);
  const avgLeadTime = leadTimes.length > 0
    ? parseFloat((leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length).toFixed(1))
    : 0.0;

  // Stuck/Risco calculation: etapa between 2 and 4 and last update is more than 5 days ago
  const now = new Date();
  const ativosEmRisco = devolucoes.filter(d => {
    const step = getItemEtapaNum(d);
    if (step > 1 && step < 5) {
      const dateToCheckStr = d.data_ultima_atualizacao || d.atualizado_em || d.criado_em || d.criadoEm;
      if (!dateToCheckStr) return false;
      try {
        const parseDate = (str: string) => {
          const d = new Date(str);
          if (!isNaN(d.getTime())) return d;
          const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
          if (match) {
            const [_, day, month, year] = match;
            return new Date(`${year}-${month}-${day}`);
          }
          return null;
        };
        const d = parseDate(dateToCheckStr);
        if (!d) return false;
        const diffMs = now.getTime() - d.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays > 5;
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  // 1. Data processing for Status Distribution Donut Chart
  const statusCounts = [0, 0, 0, 0, 0];
  devolucoes.forEach(d => {
    const step = getItemEtapaNum(d);
    statusCounts[step - 1]++;
  });

  const statusData = [
    { name: 'Remessa Criada', value: statusCounts[0], color: '#94a3b8' },
    { name: 'Emissão Doc', value: statusCounts[1], color: '#38bdf8' },
    { name: 'Em Transferência', value: statusCounts[2], color: '#3b82f6' },
    { name: 'Em Rota', value: statusCounts[3], color: '#eab308' },
    { name: 'Entregue', value: statusCounts[4], color: '#10b981' }
  ];

  // 2. Data grouping for Carrier Performance Bar Chart
  const gcItems = devolucoes.filter(d => d.transportadora === 'Global Cargo');
  const manualItems = devolucoes.filter(d => d.transportadora !== 'Global Cargo');

  const gcDelivered = gcItems.filter(d => isItemDelivered(d));
  const gcLeadTimes = gcDelivered.map(calculateLeadTime).filter(lt => lt > 0);
  const gcAvgLt = gcLeadTimes.length > 0
    ? parseFloat((gcLeadTimes.reduce((sum, lt) => sum + lt, 0) / gcLeadTimes.length).toFixed(1))
    : 0.0;

  const manualDelivered = manualItems.filter(d => isItemDelivered(d));
  const manualLeadTimes = manualDelivered.map(calculateLeadTime).filter(lt => lt > 0);
  const manualAvgLt = manualLeadTimes.length > 0
    ? parseFloat((manualLeadTimes.reduce((sum, lt) => sum + lt, 0) / manualLeadTimes.length).toFixed(1))
    : 0.0;

  const carrierData = [
    {
      name: 'Global Cargo',
      'Volume de Envios': gcItems.length,
      'Lead Time Médio (Dias)': gcAvgLt
    },
    {
      name: 'Outras (Manual)',
      'Volume de Envios': manualItems.length,
      'Lead Time Médio (Dias)': manualAvgLt
    }
  ];

  // Custom Formatter
  const formatLastUpdate = (isoString: string) => {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} às ${hours}:${minutes}`;
  };

  const isDark = isTVMode;
  const cardBg = isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800';
  const textTitle = isDark ? 'text-white' : 'text-slate-800';
  const textLabel = isDark ? 'text-slate-300' : 'text-slate-500';
  const textMuted = isDark ? 'text-slate-450' : 'text-slate-400';
  const subBg = isDark ? 'bg-slate-950/60 border-slate-850' : 'bg-slate-50 border-slate-100';
  const iconBg = isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500';

  return (
    <div className={`min-h-screen ${isTVMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'} flex flex-col font-sans relative`} id={isTVMode ? "active-tv-mode-flag" : "devolucoes-ativos-container"}>
      
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[100] max-w-sm w-full bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-2xl p-4 flex items-start gap-3"
          >
            <div className={`p-1.5 rounded-xl shrink-0 ${
              toastMessage.type === 'success' ? 'bg-blue-500/20 text-blue-400' :
              toastMessage.type === 'info' ? 'bg-sky-500/20 text-sky-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div className="flex-1 space-y-1">
              <span className="font-extrabold uppercase tracking-widest text-[9px] text-slate-400 block">Notificação Logística</span>
              <p className="text-xs text-slate-200 font-semibold leading-relaxed">
                {toastMessage.text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Batch Syncing Loader Overlay */}
      <AnimatePresence>
        {isBatchSyncing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="bg-white rounded-[32px] p-8 max-w-sm w-full border border-slate-100 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl mb-4 border border-amber-100">
                <RefreshCw className="w-10 h-10 animate-spin" />
              </div>
              <h3 className="font-sans font-black text-slate-900 text-base uppercase tracking-tight">
                Sincronização em Lote
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                Consultando a API oficial da Global Cargo para todos os ativos em processo de logística reversa.
              </p>
              
              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full mt-5 overflow-hidden border border-slate-200">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-300"
                  style={{ 
                    width: `${devolucoes.length > 0 ? (parseInt(batchSyncProgress.match(/\d+/)?.[0] || '0', 10) / devolucoes.length) * 100 : 0}%` 
                  }} 
                />
              </div>

              <p className="text-xs text-amber-700 font-mono font-black mt-4 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl animate-pulse">
                {batchSyncProgress}
              </p>

              <p className="text-[9.5px] text-slate-400 font-bold mt-3 uppercase tracking-wider">
                Atraso de 1.5s ativo para evitar Rate Limit
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative top bar */}
      {!isTVMode && <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500" />}

      {/* Header and Back bar */}
      {!isTVMode && (
        <header className="bg-white border-b border-slate-200 py-5 px-6 sm:px-8 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            
            <div className="flex items-center space-x-4">
              <button
                onClick={onBackToHub}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                title="Voltar ao Painel Principal"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="border-l border-slate-200 pl-4">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase mt-0.5">
                  Devolução de Ativos
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
              
              {/* Botão Baixar Relatório */}
              <button
                onClick={handleDownloadReport}
                disabled={exportingReport}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shrink-0"
                title="Baixar Relatório em Excel/CSV"
              >
                <Download className={`w-4 h-4 ${exportingReport ? 'animate-bounce' : ''}`} />
                <span>
                  <span className="hidden sm:inline">Baixar Relatório</span>
                  <span className="sm:hidden">Relatório</span>
                </span>
              </button>

              {/* Botão Atualizar Todos */}
              <button
                onClick={handleBatchUpdate}
                disabled={isBatchSyncing || syncingId !== null}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-500 shrink-0"
                title="Atualizar Todos os Rastreamentos (Throttling de 1.5s)"
              >
                <RefreshCw className={`w-4 h-4 ${isBatchSyncing ? 'animate-spin' : ''}`} />
                <span>
                  <span className="hidden sm:inline">Atualizar Todos</span>
                  <span className="sm:hidden">Atualizar</span>
                </span>
              </button>

              {/* Botão Registrar Devolução */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>
                  <span className="hidden sm:inline">Registrar Devolução</span>
                  <span className="sm:hidden">Registrar</span>
                </span>
              </button>
            </div>

          </div>
        </header>
      )}

      {/* Main Content Dashboard */}
      <main className={`w-full ${isTVMode ? 'px-4 py-2 flex flex-col justify-between overflow-hidden gap-3 min-h-0 flex-1 h-full max-h-screen' : 'flex-grow max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-8'}`}>
        
        {/* KPI Panel */}
        {!isTVMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="devolucoes-kpi-panel">
            
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Devoluções Ativas</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 block">{totalCount}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Em Transferência</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 block">{inTransitCount}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Entregas Realizadas</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 block">{deliveredCount}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center space-x-4">
              <div className="p-3 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
                <div className="text-sky-600 text-lg font-black">{completionRate}%</div>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Taxa de Conclusão</span>
                <div className="w-32 bg-slate-100 h-2 rounded-full mt-2 overflow-hidden border border-slate-200">
                  <div className="bg-sky-500 h-full rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tabs Component Selector */}
        {!isTVMode && (
          <div className="flex border-b border-slate-200 gap-1 overflow-x-auto shrink-0 pb-px" id="devolucoes-tabs">
            <button
              type="button"
              onClick={() => setActiveTab('automated')}
              className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'automated'
                  ? 'border-blue-600 text-blue-600 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600 font-semibold'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Global Cargo (Automated)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'manual'
                  ? 'border-blue-600 text-blue-600 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600 font-semibold'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Outras Transportadoras (Manual)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600 font-semibold'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard BI (KPIs)</span>
            </button>
          </div>
        )}

        {activeTab === 'dashboard' ? (
          <div className={`w-full animate-in fade-in duration-300 ${isTVMode ? 'flex-1 min-h-0 flex flex-col justify-between gap-3 overflow-hidden' : 'space-y-6'}`} id="dashboard-bi-real">
            
            {/* KPI Cards Grid */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${isTVMode ? 'gap-3 shrink-0' : 'gap-6'} w-full`}>
              
              {/* Card 1: Volume Total */}
              <div className={`${cardBg} border rounded-[20px] ${isTVMode ? 'p-3.5' : 'p-6'} shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300`} id="kpi-card-total">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Métrica Logística</span>
                  <div className={`p-2 rounded-lg ${isTVMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Volume Total</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className={`text-3xl font-black tracking-tight ${isTVMode ? 'text-white' : 'text-slate-800'}`}>{totalCount}</span>
                    <span className="text-xs text-slate-400 font-semibold">Itens</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-2">Total de devoluções registradas na base.</p>
                </div>
              </div>

              {/* Card 2: Taxa de Conclusão */}
              <div className={`${cardBg} border rounded-[20px] ${isTVMode ? 'p-3.5' : 'p-6'} shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300`} id="kpi-card-completion">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Status Final</span>
                  <div className={`p-2 rounded-lg ${isTVMode ? 'bg-emerald-950/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-450 block uppercase">Taxa de Conclusão</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className={`text-3xl font-black tracking-tight ${isTVMode ? 'text-white' : 'text-slate-800'}`}>{completionRate}%</span>
                    <span className="text-xs text-slate-450 font-medium">({deliveredCount} / {totalCount})</span>
                  </div>
                  <div className={`w-full h-2 rounded-full mt-3 overflow-hidden border ${isTVMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200/50'}`}>
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
                  </div>
                </div>
              </div>

              {/* Card 3: Lead Time Médio */}
              <div className={`${cardBg} border rounded-[20px] ${isTVMode ? 'p-3.5' : 'p-6'} shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300`} id="kpi-card-leadtime">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Eficiência de Entrega</span>
                  <div className={`p-2 rounded-lg ${isTVMode ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-450 block uppercase">Lead Time Médio</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-3xl font-black tracking-tight ${isTVMode ? 'text-white' : 'text-slate-800'}`}>{avgLeadTime}</span>
                    <span className="text-xs text-slate-400 font-semibold">Dias</span>
                  </div>
                  <p className="text-[10px] text-slate-450 font-semibold mt-2">Tempo médio de ponta a ponta.</p>
                </div>
              </div>

              {/* Card 4: Ativos em Risco */}
              <div className={`border rounded-[20px] ${isTVMode ? 'p-3.5' : 'p-6'} shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-300 ${
                ativosEmRisco.length > 0 
                  ? (isTVMode ? 'bg-rose-950/50 border-rose-900/60 text-rose-300' : 'bg-rose-50/20 border-rose-250 text-slate-800') 
                  : cardBg
              }`} id="kpi-card-risk">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Alerta Operacional</span>
                  <div className={`p-2 rounded-lg ${
                    ativosEmRisco.length > 0 
                      ? (isTVMode ? 'bg-rose-900/40 text-rose-400' : 'bg-rose-100 text-rose-600') 
                      : (isTVMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${ativosEmRisco.length > 0 ? 'animate-pulse' : ''}`} />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-450 block uppercase font-sans">Ativos em Risco</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className={`text-3xl font-black tracking-tight ${ativosEmRisco.length > 0 ? 'text-rose-500' : (isTVMode ? 'text-white' : 'text-slate-800')}`}>
                      {ativosEmRisco.length}
                    </span>
                    <span className="text-xs text-slate-450 font-semibold">Itens</span>
                  </div>
                  <p className="text-[10px] text-slate-450 font-semibold mt-2">Travados entre etapa 2 e 4 há mais de 5 dias.</p>
                </div>
              </div>

            </div>

            {/* Charts Visual Split */}
            <div className={`grid grid-cols-1 lg:grid-cols-2 ${isTVMode ? 'gap-3 flex-1 min-h-0' : 'gap-6'} w-full`}>
              
              {/* Coluna Esquerda: Status Distribution */}
              <div className={`${cardBg} border rounded-[20px] ${isTVMode ? 'p-3.5 flex-1 min-h-0' : 'p-6'} shadow-xs flex flex-col justify-between`} id="chart-card-status">
                <div className={`flex items-center justify-between mb-4 border-b ${isTVMode ? 'border-slate-800' : 'border-slate-100'} pb-3`}>
                  <div>
                    <h3 className={`font-sans font-black uppercase tracking-tight text-sm ${isTVMode ? 'text-white' : 'text-slate-800'}`}>Distribuição de Status</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Proporção exata de itens em cada etapa da logística reversa.</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Total: {totalCount}</span>
                </div>

                {totalCount === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <Package className="w-8 h-8 mb-2 stroke-1" />
                    <span>Nenhum dado registrado para exibir</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center flex-1">
                    {/* Donut Chart Container */}
                    <div className={`${isTVMode ? 'h-[160px]' : 'h-[240px]'} w-full flex items-center justify-center relative`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={isTVMode ? 35 : 55}
                            outerRadius={isTVMode ? 50 : 75}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1e293b', 
                              border: 'none', 
                              borderRadius: '12px', 
                              color: '#fff', 
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                            formatter={(value: any) => [`${value} itens`, 'Quantidade']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      
                      {/* Center Absolute Badge */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className={`text-2xl font-black leading-none ${isTVMode ? 'text-white' : 'text-slate-700'}`}>{completionRate}%</span>
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider mt-1">Concluído</span>
                      </div>
                    </div>

                    {/* Donut Legend Tables */}
                    <div className="flex flex-col justify-center space-y-3 pr-2">
                      {statusData.map((item, index) => {
                        const pct = totalCount > 0 ? Math.round((item.value / totalCount) * 100) : 0;
                        return (
                          <div key={index} className={`flex items-center justify-between text-[11px] font-semibold border-b ${isTVMode ? 'border-slate-800/60 text-slate-300' : 'border-slate-50 text-slate-600'} pb-1.5 last:border-0 last:pb-0`}>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="truncate max-w-[120px]">{item.name}</span>
                            </div>
                            <span className={`font-mono font-black shrink-0 ${isTVMode ? 'text-white' : 'text-slate-800'}`}>
                              {item.value} <span className="text-slate-400 font-medium">({pct}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Coluna Direita: Carrier Performance */}
              <div className={`${cardBg} border rounded-[28px] p-6 shadow-xs flex flex-col`} id="chart-card-carriers">
                <div className={`flex items-center justify-between mb-4 border-b ${isTVMode ? 'border-slate-800' : 'border-slate-100'} pb-3`}>
                  <div>
                    <h3 className={`font-sans font-black uppercase tracking-tight text-sm ${isTVMode ? 'text-white' : 'text-slate-800'}`}>Performance por Transportadora</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Comparativo de volumetria e eficiência de entrega (Lead Time médio).</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Global x Manual</span>
                </div>

                {totalCount === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <Truck className="w-8 h-8 mb-2 stroke-1" />
                    <span>Nenhum dado registrado para exibir</span>
                  </div>
                ) : (
                  <div className="flex-1 w-full flex flex-col justify-between">
                    <div className={`${isTVMode ? 'h-[160px]' : 'h-[240px]'} w-full mt-2`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={carrierData}
                          margin={{ top: 15, right: 10, left: -10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={isTVMode ? "#1e293b" : "#f8fafc"} vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            fontWeight={700} 
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            fontWeight={700} 
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1e293b', 
                              border: 'none', 
                              borderRadius: '12px', 
                              color: '#fff', 
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            height={32} 
                            iconSize={10}
                            wrapperStyle={{ fontSize: '10px', fontWeight: 700, color: isTVMode ? '#f8fafc' : '#475569' }} 
                          />
                          <Bar name="Volume de Envios" dataKey="Volume de Envios" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28} />
                          <Bar name="Lead Time Médio (Dias)" dataKey="Lead Time Médio (Dias)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Simple summary comparison table */}
                    <div className={`grid grid-cols-2 gap-4 mt-4 rounded-2xl p-3.5 border ${isTVMode ? 'bg-slate-950/40 border-slate-800/80' : 'bg-slate-50 border-slate-100'}`}>
                      <div className={`text-center border-r ${isTVMode ? 'border-slate-800' : 'border-slate-200'} last:border-0 pr-2`}>
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Líder Operacional</span>
                        <span className={`text-xs font-bold block mt-1 ${isTVMode ? 'text-white' : 'text-slate-800'}`}>Global Cargo</span>
                        <span className="text-[10px] text-blue-500 font-extrabold mt-0.5 block">{gcItems.length} Itens • {gcAvgLt}d Lead Time</span>
                      </div>
                      <div className="text-center pr-2">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Outros Operadores</span>
                        <span className={`text-xs font-bold block mt-1 ${isTVMode ? 'text-white' : 'text-slate-800'}`}>Controle Manual</span>
                        <span className="text-[10px] text-emerald-500 font-extrabold mt-0.5 block">{manualItems.length} Itens • {manualAvgLt}d Lead Time</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          /* Normal return grids */
          <>
            {/* Filters and Search Zone */}
            <div className="bg-white border border-slate-200 rounded-[24px] p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Search bar */}
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por TAG, NF ou Fornecedor..."
                  className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-700"
                />
                {searchQuery && (
                  <button 
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Quick status filters */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto w-full md:w-auto">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-2 hidden lg:inline-block flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Filtrar:
                </span>
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'Remessa criada', label: 'Criadas' },
                  { id: 'Em transferência', label: 'Em Trânsito' },
                  { id: 'Entrega realizada', label: 'Entregues' }
                ].map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      statusFilter === f.id
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

            </div>

            {/* Loading Spinner */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-xs font-black uppercase text-slate-400 tracking-widest animate-pulse">
                  Consultando base de dados...
                </p>
              </div>
            ) : devolucoes.filter(item => activeTab === 'manual' ? item.transportadora !== 'Global Cargo' : item.transportadora === 'Global Cargo').length === 0 ? (
              /* Empty State when no items in database for this specific transport type */
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-16 text-center max-w-xl mx-auto space-y-4 shadow-sm w-full" id="empty-state-ativos">
                <div className="inline-flex p-4 bg-blue-50 text-blue-500 rounded-full">
                  <Package className="w-10 h-10 animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-sans font-black text-slate-800 uppercase tracking-tight text-lg">Sem Pendências</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto font-medium">
                    Nenhum equipamento em processo de devolução nesta categoria no momento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
                >
                  + Registrar Primeira Devolução
                </button>
              </div>
            ) : filteredDevolucoes.length === 0 ? (
              /* Empty search result state */
              <div className="bg-white border border-dashed border-slate-250 rounded-[32px] p-12 text-center max-w-md mx-auto space-y-3 shadow-sm w-full">
                <div className="inline-flex p-3 bg-slate-100 text-slate-400 rounded-full">
                  <Search className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-500 font-semibold">Nenhum resultado corresponde à sua busca.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  Limpar Filtros
                </button>
              </div>
            ) : (
              /* Active Returns Grid - 3 columns requested: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full" id="devolucoes-cards-grid">
                {filteredDevolucoes.map((item) => {
                  const isSyncingThis = syncingId === item.id;
                  const isManualCard = item.transportadora !== 'Global Cargo';

                  // Lógica de cálculo da etapa atual com prioridade máxima para entrega_concluida
                  let etapaAtiva = 1; // Default: Remessa Criada

                  if (item.entrega_concluida === true || item.entregaConcluida === true) {
                    etapaAtiva = 5; // Força a última etapa se o usuário marcou como concluído
                  } else if (typeof item.etapa_atual === 'number' && item.etapa_atual >= 1 && item.etapa_atual <= 5) {
                    etapaAtiva = item.etapa_atual;
                  } else if (item.etapaAtual) {
                    const idx = ETAPAS_ORDEM.indexOf(item.etapaAtual);
                    etapaAtiva = idx >= 0 ? idx + 1 : 1;
                  }

                  const isDelivered = etapaAtiva === 5 || item.entrega_concluida === true || item.entregaConcluida === true;
                  const { days } = calculateTransitDays(item);

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white border border-slate-200 hover:border-blue-300 rounded-[28px] p-5 shadow-xs hover:shadow-md transition-all duration-300 flex flex-row gap-4 relative overflow-hidden group min-h-[350px]"
                    >
                      {/* Decorative side accent color bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${
                        isDelivered ? 'bg-emerald-500' : 'bg-blue-600'
                      }`} />

                      {/* COLUMN 1: VERTICAL STEPPER ON THE LEFT */}
                      <div className="w-[120px] shrink-0 flex flex-col justify-between py-1 relative border-r border-slate-100 pr-3" id={`stepper-container-${item.id}`}>
                        
                        {/* Previsão de entrega inline inside stepper if available */}
                        {(item.data_previsao_entrega || item.dataPrevisaoEntrega) ? (
                          <div className="mb-2 text-[8px] font-black uppercase text-sky-600 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded-md text-center">
                            Previsão: {item.data_previsao_entrega || item.dataPrevisaoEntrega}
                          </div>
                        ) : (
                          <div className="text-[8px] font-black uppercase text-slate-400 text-center mb-2">
                            Etapa Atual
                          </div>
                        )}

                        <div className="flex flex-col space-y-4 pl-1 relative flex-grow justify-center">
                          {/* Vertical connector line */}
                          <div className="absolute left-[9px] top-3 bottom-3 w-[1.5px] bg-slate-100" />
                          
                          {/* Active indicator colored line */}
                          <div 
                            className={`absolute left-[9px] top-3 w-[1.5px] transition-all duration-500 ${isDelivered ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ 
                              height: `${Math.max(0, ((etapaAtiva - 1) / (ETAPAS_ORDEM.length - 1)) * 82)}%` 
                            }} 
                          />

                          {ETAPAS_ORDEM.map((etapa, idx) => {
                            const stepNum = idx + 1;
                            const isCompletedOrActive = stepNum <= etapaAtiva;
                            const isActive = stepNum === etapaAtiva;

                            return (
                              <div 
                                key={etapa} 
                                onClick={() => isManualCard && handleManualStepChange(item.id, idx + 1)}
                                className={`flex items-start gap-2 relative ${
                                  isManualCard 
                                    ? 'cursor-pointer hover:bg-slate-50 rounded-lg p-0.5 -m-0.5 transition-all group/step' 
                                    : ''
                                }`}
                                title={isManualCard ? `Mudar status manualmente para: ${etapa}` : undefined}
                              >
                                
                                {/* Circle badge - CLICKABLE/CURSOR-POINTER */}
                                <div 
                                  className={`w-4.5 h-4.5 rounded-full flex items-center justify-center transition-all duration-300 border font-mono text-[8px] font-black z-10 shrink-0 cursor-pointer ${
                                    isDelivered
                                      ? isActive
                                        ? 'bg-emerald-600 border-emerald-600 text-white ring-4 ring-emerald-50'
                                        : isCompletedOrActive 
                                          ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                                          : 'bg-white border-slate-200 text-slate-400'
                                      : isActive 
                                        ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-50'
                                        : isCompletedOrActive 
                                          ? 'bg-blue-50 border-blue-300 text-blue-600'
                                          : 'bg-white border-slate-200 text-slate-400'
                                  } ${isManualCard ? 'group-hover/step:border-blue-400 group-hover/step:text-blue-500' : ''}`}
                                >
                                  {isCompletedOrActive && !isActive ? (
                                    <Check className={`w-2 h-2 ${isDelivered ? 'text-emerald-600' : 'text-blue-600'} stroke-[3.5]`} />
                                  ) : isActive && isDelivered ? (
                                    <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />
                                  ) : (
                                    stepNum
                                  )}
                                </div>

                                {/* Stage detail text */}
                                <div className="min-w-0 flex flex-col justify-center">
                                  <span 
                                    className={`text-[8.5px] font-black uppercase tracking-wide leading-tight break-words ${
                                      isDelivered
                                        ? isActive
                                          ? 'text-emerald-700 font-black'
                                          : isCompletedOrActive ? 'text-emerald-900/80 font-bold' : 'text-slate-400'
                                        : isActive 
                                          ? 'text-blue-600 font-black'
                                          : isCompletedOrActive ? 'text-slate-700' : 'text-slate-400'
                                    } ${isManualCard ? 'group-hover/step:text-blue-600' : ''}`}
                                  >
                                    {etapa}
                                  </span>
                                  {/* Data Inicial de Envio / Remessa Criada */}
                                  {idx === 0 && (item.criado_em || item.criadoEm || (item as any).created_at) && (
                                    <span className="text-[7.5px] font-bold text-slate-500 font-mono mt-0.5 block truncate max-w-[80px]" title={item.criado_em || item.criadoEm}>
                                      {formatDateBR(item.criado_em || item.criadoEm || (item as any).created_at)}
                                    </span>
                                  )}
                                  {/* Última atualização para etapas posteriores */}
                                  {isActive && idx !== 0 && (
                                    <span className={`text-[7.5px] font-bold font-mono mt-0.5 block truncate max-w-[80px] ${isDelivered ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                                      {isDelivered && (item.entrega_concluida || item.entregaConcluida)
                                        ? "Entregue"
                                        : item.data_evento_transportadora ? item.data_evento_transportadora : "Registrado"}
                                    </span>
                                  )}
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* COLUMN 2: DETAILS & CONTROLS ON THE RIGHT */}
                      <div className="flex-grow flex flex-col justify-between min-w-0 pl-1">
                        
                        {/* Header Info */}
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            
                            {/* Supplier name and NF badge */}
                            <div className="min-w-0 flex-grow">
                              <h3 className="font-sans font-black text-slate-900 text-sm tracking-tight leading-snug truncate" title={item.fornecedor_destino || item.fornecedorDestino}>
                                {item.fornecedor_destino || item.fornecedorDestino}
                              </h3>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <span className="text-[9px] text-slate-500 font-black font-mono uppercase bg-slate-100 border border-slate-200/50 px-1.5 py-0.5 rounded-md inline-block">
                                  NF: {item.nota_fiscal || item.numero_nf || item.numeroNF}
                                </span>
                                {isManualCard && (
                                  <span className="text-[9px] text-amber-600 font-black font-sans uppercase bg-amber-50 border border-amber-150 px-1.5 py-0.5 rounded-md inline-block" title={item.transportadora}>
                                    {item.transportadora || 'Manual'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right action controls */}
                            <div className="flex items-center space-x-1 shrink-0">
                              {/* Quick Toggle Concluir Entrega */}
                              <button
                                type="button"
                                onClick={() => handleToggleEntregaConcluida(item.id, item.entrega_concluida ?? item.entregaConcluida)}
                                className={`p-1.5 border rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                                  isDelivered
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100'
                                    : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-300 text-slate-400 hover:text-emerald-600'
                                }`}
                                title={isDelivered ? 'Desmarcar entrega concluída (reabrir)' : 'Marcar entrega como CONCLUÍDA'}
                              >
                                <CheckCircle2 className={`w-3.5 h-3.5 ${isDelivered ? 'text-emerald-600 fill-emerald-100' : ''}`} />
                              </button>

                              {/* Sync action button: HIDDEN FOR MANUAL CARDS */}
                              {!isManualCard && (
                                <button
                                  type="button"
                                  onClick={() => handleSimulateUpdate(item.id, item.etapaAtual)}
                                  disabled={isSyncingThis}
                                  className={`p-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-250 text-slate-500 hover:text-blue-600 rounded-lg transition-all cursor-pointer ${
                                    isSyncingThis ? 'cursor-not-allowed text-blue-600 bg-blue-50' : ''
                                  }`}
                                  title={isDelivered ? 'Reiniciar rastreamento' : 'Sincronizar com Global Cargo'}
                                >
                                  <RefreshCw className={`w-3 h-3 ${isSyncingThis ? 'animate-spin' : ''}`} />
                                </button>
                              )}

                              {/* Link Externo for Global Cargo */}
                              {!isManualCard && (
                                <a
                                  href={`https://globalcargo.eslcloud.com.br/recipient_tracking?utf8=%E2%9C%93&document_from=brazil&document=${(item.cnpj_destino || item.cnpjDestino || '').replace(/\D/g, '')}&number=${(item.numero_nf || item.numeroNF || item.nota_fiscal || '').replace(/\D/g, '')}&number_type=invoice_number`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-250 text-slate-500 hover:text-sky-600 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                  title="Ver no site da transportadora"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}

                              {/* Delete Track element option */}
                              <button
                                type="button"
                                onClick={() => handleDeleteDevolucao(item.id, item.tag_equipamento || item.tagEquipamento || '')}
                                className="p-1.5 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                                title="Remover rastreio de ativo"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>

                          </div>

                          {/* Item description list container */}
                          <div className="my-2.5 bg-slate-50/70 rounded-2xl p-2.5 border border-slate-100 flex-grow">
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block mb-1">Itens Enviados</span>
                            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                              {(item.itens || []).map((it, idx) => (
                                <div key={idx} className="flex items-start justify-between text-[10px] py-0.5 border-b border-slate-100/40 last:border-0 gap-2">
                                  <span className="font-mono font-black text-blue-600 bg-blue-50 border border-blue-100 px-1 py-0.2 rounded text-[8px] uppercase shrink-0">
                                    {it.tag}
                                  </span>
                                  <span className="text-slate-600 font-semibold truncate text-right flex-grow" title={it.descricao}>
                                    {it.descricao}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Fiscal metadata (CNPJ) & Lead Time Badge / Toggle */}
                          <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-150/40 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">CNPJ Destino</span>
                              <span className="font-mono text-[9.5px] font-semibold text-slate-600 block mt-0.5">{item.cnpj_destino || item.cnpjDestino}</span>
                            </div>

                            {/* Tag Visual do Lead Time (Dias em Trânsito) ou Badge Entregue */}
                            {isDelivered ? (
                              <button
                                type="button"
                                onClick={() => handleToggleEntregaConcluida(item.id, item.entrega_concluida ?? item.entregaConcluida)}
                                className="text-[9.5px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-200/80 inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
                                title="Clique para desmarcar entrega concluída"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Entregue</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleEntregaConcluida(item.id, item.entrega_concluida ?? item.entregaConcluida)}
                                className="text-[9.5px] font-bold bg-blue-100 text-blue-800 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 px-2.5 py-1 rounded-lg border border-blue-200/60 inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-all group/transit"
                                title="Clique para marcar como Entregue"
                              >
                                <span className="group-hover/transit:hidden">⏱️ Em trânsito há: {days} {days === 1 ? 'dia' : 'dias'}</span>
                                <span className="hidden group-hover/transit:inline-flex items-center gap-1 text-emerald-700">
                                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                  Marcar como Entregue
                                </span>
                              </button>
                            )}
                          </div>

                        </div>

                        {/* Manual control buttons if manual card */}
                        {isManualCard && (
                          <div className="mt-3 pt-2 border-t border-slate-150/40 flex flex-col gap-1.5 shrink-0">
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                disabled={etapaAtiva <= 1}
                                onClick={() => handleManualStepChange(item.id, etapaAtiva - 1)}
                                className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-100 text-slate-600 border border-slate-200 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed text-center"
                              >
                                ← Voltar
                              </button>
                              <button
                                type="button"
                                disabled={etapaAtiva >= 5}
                                onClick={() => handleManualStepChange(item.id, etapaAtiva + 1)}
                                className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 disabled:bg-slate-50 disabled:text-slate-300 disabled:border-slate-100 text-blue-600 border border-blue-200 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed text-center"
                              >
                                Avançar Etapa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleEntregaConcluida(item.id, item.entrega_concluida ?? item.entregaConcluida)}
                                className={`px-2.5 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                  isDelivered
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-xs'
                                }`}
                                title={isDelivered ? 'Reabrir entrega' : 'Finalizar e marcar como entregue'}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{isDelivered ? 'Concluído' : 'Concluir'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Status text details banner */}
                        {!isManualCard && item.statusTexto && (
                          <div className="mt-2 text-[8px] font-bold text-slate-400 font-sans italic truncate">
                            Status: {item.statusTexto}
                          </div>
                        )}

                      </div>

                      {/* Simulated loading overlay */}
                      <AnimatePresence>
                        {isSyncingThis && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white/95 backdrop-blur-2xs z-30 flex flex-col items-center justify-center p-6 text-center"
                          >
                            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Sincronizando Global Cargo</h4>
                            <p className="text-[10px] text-blue-600 font-mono font-bold mt-1.5 animate-pulse">
                              {syncingMessage}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </main>

      {/* Footer explaining operational details */}
      <footer className="bg-slate-900 text-slate-500 border-t border-slate-800 py-6 mt-12 w-full shrink-0" id="devolucoes-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-end">
          <p className="text-xs font-medium text-slate-500">
            Desenvolvido por André Ramalho | Sistema de Controle Operacional
          </p>
        </div>
      </footer>

      {/* NEW RETURN MODAL DIALOG */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" id="nova-devolucao-modal">
            
            {/* Dark glass backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
            />

            {/* Modal Body Container */}
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', duration: 0.4 }}
                className="relative transform overflow-hidden rounded-[32px] bg-white p-6 sm:p-8 text-left shadow-2xl transition-all w-full max-w-lg border border-slate-100"
              >
                
                {/* Close Button */}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="absolute right-5 top-5 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Modal Header */}
                <div className="mb-6">
                  <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider font-mono bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 inline-block">
                    Novo Ativo para Logística Reversa
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase mt-2">
                    Iniciar Nova Devolução
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium font-sans">
                    Insira as informações do ativo locado para emissão do manifesto de rastreamento com a transportadora.
                  </p>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Lista Dinâmica de Itens */}
                  <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Lista de Itens para Devolução <span className="text-rose-500">*</span>
                      </span>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {itemsList.map((item, idx) => (
                        <div key={idx} className="flex gap-3 items-start bg-white p-3 rounded-xl border border-slate-100 shadow-3xs relative group/item">
                          
                          {/* TAG Input */}
                          <div className="flex-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                              TAG {idx + 1}
                            </label>
                            <input
                              type="text"
                              value={item.tag}
                              onChange={(e) => {
                                const newList = [...itemsList];
                                newList[idx].tag = e.target.value;
                                setItemsList(newList);
                                if (formErrors[`item_${idx}_tag`]) {
                                  setFormErrors(prev => {
                                    const next = { ...prev };
                                    delete next[`item_${idx}_tag`];
                                    return next;
                                  });
                                }
                              }}
                              placeholder="Ex: MUNK-0042"
                              className={`w-full text-xs px-3 py-2 bg-slate-50 border rounded-lg outline-none focus:bg-white focus:ring-1 transition-all font-mono font-bold uppercase ${
                                formErrors[`item_${idx}_tag`]
                                  ? 'border-rose-300 focus:ring-rose-500/20'
                                  : 'border-slate-200 focus:ring-blue-500/20'
                              }`}
                            />
                            {formErrors[`item_${idx}_tag`] && (
                              <p className="text-[9px] text-rose-500 font-bold mt-0.5">
                                {formErrors[`item_${idx}_tag`]}
                              </p>
                            )}
                          </div>

                          {/* Descrição Input */}
                          <div className="flex-[2]">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                              Descrição {idx + 1}
                            </label>
                            <input
                              type="text"
                              value={item.descricao}
                              onChange={(e) => {
                                const newList = [...itemsList];
                                newList[idx].descricao = e.target.value;
                                setItemsList(newList);
                                if (formErrors[`item_${idx}_descricao`]) {
                                  setFormErrors(prev => {
                                    const next = { ...prev };
                                    delete next[`item_${idx}_descricao`];
                                    return next;
                                  });
                                }
                              }}
                              placeholder="Ex: Caminhão Munck 10 Ton"
                              className={`w-full text-xs px-3 py-2 bg-slate-50 border rounded-lg outline-none focus:bg-white focus:ring-1 transition-all font-sans font-bold ${
                                formErrors[`item_${idx}_descricao`]
                                  ? 'border-rose-300 focus:ring-rose-500/20'
                                  : 'border-slate-200 focus:ring-blue-500/20'
                              }`}
                            />
                            {formErrors[`item_${idx}_descricao`] && (
                              <p className="text-[9px] text-rose-500 font-bold mt-0.5">
                                {formErrors[`item_${idx}_descricao`]}
                              </p>
                            )}
                          </div>

                          {/* Delete Item Button */}
                          {itemsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setItemsList(itemsList.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-600 border border-slate-200 rounded-lg transition-all self-end mb-[2px]"
                              title="Remover este item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      ))}
                    </div>

                    {/* "+ Adicionar Item" Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setItemsList([...itemsList, { tag: '', descricao: '' }]);
                      }}
                      className="w-full py-2 bg-white hover:bg-slate-55 border border-dashed border-slate-200 hover:border-blue-300 text-[10px] font-black uppercase text-blue-600 tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      <span>+ Adicionar Item</span>
                    </button>
                    
                    {formErrors.items && (
                      <p className="text-[10px] text-rose-600 font-bold mt-1">
                        ⚠️ {formErrors.items}
                      </p>
                    )}
                  </div>

                  {/* Destination Supplier */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                      Fornecedor Destino <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={fornecedorInput}
                        onChange={(e) => {
                          setFornecedorInput(e.target.value);
                          if (formErrors.fornecedor) setFormErrors(prev => ({ ...prev, fornecedor: '' }));
                        }}
                        placeholder="Ex: Sotreq Caterpillar S/A"
                        className={`w-full text-xs pl-10 pr-4 py-3 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-2 transition-all font-sans font-bold ${
                          formErrors.fornecedor 
                            ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' 
                            : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                        }`}
                      />
                    </div>
                    {formErrors.fornecedor && (
                      <p className="text-[10px] text-rose-600 font-bold mt-1 font-sans">
                        ⚠️ {formErrors.fornecedor}
                      </p>
                    )}
                  </div>

                  {/* Transportadora Select */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                      Método de Envio / Transportadora <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={transportadoraInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTransportadoraInput(val);
                        setShowCustomTransport(val === 'Outras');
                        if (formErrors.transportadoraCustom) {
                          setFormErrors(prev => ({ ...prev, transportadoraCustom: '' }));
                        }
                      }}
                      className="w-full text-xs px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans font-bold"
                    >
                      <option value="Global Cargo">Global Cargo (Automated API Tracking)</option>
                      <option value="Outras">Outras (Manual Stepper Control)</option>
                    </select>
                  </div>

                  {/* Input Condicional para Transportadora Personalizada */}
                  {showCustomTransport && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                        Nome da Transportadora (Ex: Braspress, Correios) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={customTransportadoraInput}
                          onChange={(e) => {
                            setCustomTransportadoraInput(e.target.value);
                            if (formErrors.transportadoraCustom) {
                              setFormErrors(prev => ({ ...prev, transportadoraCustom: '' }));
                            }
                          }}
                          placeholder="Ex: Braspress, Correios"
                          className={`w-full text-xs pl-10 pr-4 py-3 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-2 transition-all font-sans font-bold ${
                            formErrors.transportadoraCustom 
                              ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' 
                              : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                          }`}
                          required
                        />
                      </div>
                      {formErrors.transportadoraCustom && (
                        <p className="text-[10px] text-rose-600 font-bold mt-1 font-sans">
                          ⚠️ {formErrors.transportadoraCustom}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Grid row for CNPJ and NF */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* CNPJ */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                        CNPJ do Destino <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={cnpjInput}
                        onChange={(e) => {
                          handleCnpjChange(e);
                          if (formErrors.cnpj) setFormErrors(prev => ({ ...prev, cnpj: '' }));
                        }}
                        placeholder="00.000.000/0000-00"
                        className={`w-full text-xs px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-2 transition-all font-mono font-bold ${
                          formErrors.cnpj 
                            ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' 
                            : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                        }`}
                      />
                      {formErrors.cnpj && (
                        <p className="text-[10px] text-rose-600 font-bold mt-1 font-sans">
                          ⚠️ {formErrors.cnpj}
                        </p>
                      )}
                    </div>

                    {/* NF Number */}
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                        Número da NF <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={nfInput}
                          onChange={(e) => {
                            setNfInput(e.target.value.replace(/\D/g, ''));
                            if (formErrors.nf) setFormErrors(prev => ({ ...prev, nf: '' }));
                          }}
                          placeholder="Ex: 10432"
                          className={`w-full text-xs pl-10 pr-4 py-3 bg-slate-50 border rounded-xl outline-none focus:bg-white focus:ring-2 transition-all font-mono font-bold ${
                            formErrors.nf 
                              ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' 
                              : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                          }`}
                        />
                      </div>
                      {formErrors.nf && (
                        <p className="text-[10px] text-rose-600 font-bold mt-1 font-sans">
                          ⚠️ {formErrors.nf}
                        </p>
                      )}
                    </div>

                  </div>

                  {/* Buttons row */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-750 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
                    >
                      Confirmar Envio
                    </button>
                  </div>

                </form>

              </motion.div>
            </div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
