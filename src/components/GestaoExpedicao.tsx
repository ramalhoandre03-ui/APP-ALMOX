import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Truck,
  PackageCheck,
  ClipboardCheck,
  Search,
  Filter,
  CheckSquare,
  Square,
  RefreshCw,
  ArrowLeft,
  FileText,
  Printer,
  Download,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  Boxes,
  FileSpreadsheet,
  AlertCircle,
  X,
  ChevronDown,
  UserCheck,
  Tag,
  Plus,
  Minus
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { higienizarClasse, separarCodigoEDescricao } from '../hooks/useDashboardAutomacao';

interface GestaoExpedicaoProps {
  onBackToHub: () => void;
}

export interface ItemExpedicao {
  id: string; // Unique ID for keying
  originalId?: string; // Base ID before split
  itemIdRaw?: string | number;
  origem: 'Estoque Interno (RM)' | 'Compra Direta (Pedido)' | 'PEDIDO RECEBIDO' | string;
  origemTipo: 'RM' | 'Pedido';
  documentoNumero: string; // ex: RM-2026-0081 ou PC-10922
  classeFinanceira?: string;
  centroCusto: string;
  codigoMaterial: string;
  descricaoItem: string;
  unidade: string;
  quantidadeSeparada: number;
  quantidadeOriginalTotal?: number;
  dataSeparacao: string; // Formatted date
  requisitanteSol: string;
  statusMobilizacao: 'separado' | 'mobilizado' | 'mobilizado_parcial';
  rawRow: any;
  // Mobilization metadata (when mobilized)
  dataMobilizacao?: string;
  motoristaNome?: string;
  placaVeiculo?: string;
  motoristaPlaca?: string;
  observacaoExpedicao?: string;
  responsavelEnvio?: string;
}

export default function GestaoExpedicao({ onBackToHub }: GestaoExpedicaoProps) {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'aguardando' | 'historico'>('aguardando');
  
  // Data state
  const [itemsAguardando, setItemsAguardando] = useState<ItemExpedicao[]>([]);
  const [itemsHistorico, setItemsHistorico] = useState<ItemExpedicao[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMobilizing, setIsMobilizing] = useState<boolean>(false);

  // Custom quantity state for mobilization (itemId -> quantity to mobilize)
  const [quantidadesMobilizar, setQuantidadesMobilizar] = useState<{ [id: string]: number }>({});

  // Filters
  const [selectedCc, setSelectedCc] = useState<string>('');
  const [selectedOrigem, setSelectedOrigem] = useState<string>('all');
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selection for Batch Mobilization
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Batch Form details (Separate Driver and Plate inputs)
  const [motoristaNome, setMotoristaNome] = useState<string>('');
  const [placaVeiculo, setPlacaVeiculo] = useState<string>('');
  const [observacaoExpedicao, setObservacaoExpedicao] = useState<string>('');

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Custom Company Logo from Supabase
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);

  // Modal Romaneio / Print State
  const [showRomaneioModal, setShowRomaneioModal] = useState<boolean>(false);
  const [romaneioItems, setRomaneioItems] = useState<ItemExpedicao[]>([]);

  // Fetch custom company logo from configuracoes_sistema (id: 'geral')
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data, error } = await supabase
          .from('configuracoes_sistema')
          .select('logo_url')
          .eq('id', 'geral')
          .maybeSingle();

        if (data?.logo_url) {
          setCustomLogoUrl(data.logo_url);
        }
      } catch (err) {
        console.warn('Erro ao buscar logo personalizada:', err);
      }
    };
    fetchLogo();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper to get selected quantity to mobilize for an item
  const getQtdMobilizar = (item: ItemExpedicao): number => {
    const custom = quantidadesMobilizar[item.id];
    if (typeof custom === 'number' && !isNaN(custom)) {
      return Math.max(1, Math.min(custom, item.quantidadeSeparada));
    }
    return item.quantidadeSeparada;
  };

  const setQtdMobilizar = (id: string, val: number, maxVal: number) => {
    const clamped = Math.max(1, Math.min(Number(val) || 1, maxVal));
    setQuantidadesMobilizar(prev => ({ ...prev, [id]: clamped }));
  };

  // Helper to normalize Centro de Custo name (removes prefix numbers and dashes)
  const normalizeCentroCusto = (cc: string | undefined | null) => {
    if (!cc) return 'Obra Não Informada';
    // Remove números e hífens do início da string (ex: "308 - ALU CAL 31" -> "ALU CAL 31")
    return String(cc).replace(/^\d+\s*-\s*/, '').trim();
  };

  // Helper date formatter
  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  // Helper to extract embedded items from RMs (handles arrays and JSON strings)
  const extractEmbeddedItems = (row: any): any[] => {
    if (!row) return [];
    const candidates = [row.itens, row.itens_json, row.materiais, row.produtos, row.itens_solicitados];
    for (const cand of candidates) {
      if (!cand) continue;
      if (Array.isArray(cand) && cand.length > 0) {
        return cand;
      }
      if (typeof cand === 'string' && cand.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(cand);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (e) {}
      }
    }
    return [];
  };

  // Fetch all separated items from Supabase (RMs and Pedidos)
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch direto e único de expedicao_itens com Deduplicação por ID
      const historicoMap = new Map<string, ItemExpedicao>();

      try {
        const { data: expedicaoDbData, error: expDbError } = await supabase
          .from('expedicao_itens')
          .select('*')
          .order('data_expedicao', { ascending: false });

        if (expDbError) {
          console.warn('Tabela expedicao_itens ainda não criada ou indisponível:', expDbError.message);
        } else if (expedicaoDbData) {
          expedicaoDbData.forEach((exp: any) => {
            const rawId = String(exp.id || `${exp.numero_pc}_${exp.codigo_item}_${exp.data_expedicao || exp.created_at}`);
            if (!historicoMap.has(rawId)) {
              const docRaw = exp.numero_pc || exp.numero_pedido || exp.rm_origem || exp.documento || 'S/N';
              const isRm = String(docRaw).toUpperCase().startsWith('RM');
              const origemInferida = isRm ? 'ESTOQUE INTERNO (RM)' : 'PEDIDO RECEBIDO';
              const origemTipo: 'RM' | 'Pedido' = isRm ? 'RM' : 'Pedido';

              const rawDesc = String(exp.descricao_item || exp.material || exp.descricao || '').trim();
              const rawCod = String(exp.codigo_item || exp.codigo_material || exp.codigo || '').trim();
              const { codigo: codSeparado, descricao: descSeparada } = separarCodigoEDescricao(rawDesc, rawCod);
              const codigo = codSeparado || rawCod || '-';
              const descricao = descSeparada || rawDesc || '-';

              const rawClasse = exp.classe_financeira || exp.classeFinanceira || exp.classe || 'Sem Classe Vinculada';
              const classeFin = higienizarClasse(rawClasse);

              const dataExp = exp.data_expedicao || exp.created_at || '';
              const motNome = exp.motorista_nome || exp.motorista || '';
              const placa = exp.placa_veiculo || exp.placa || '';
              const motoristaPlaca = placa ? `${motNome || 'Motorista'} (${placa})` : (motNome || 'Transporte');

              historicoMap.set(rawId, {
                id: rawId,
                originalId: `${docRaw}_${codigo}`,
                origem: origemInferida,
                origemTipo: origemTipo,
                documentoNumero: String(docRaw),
                classeFinanceira: classeFin,
                centroCusto: normalizeCentroCusto(exp.centro_custo || exp.centroCusto || 'Obra Não Informada'),
                codigoMaterial: codigo,
                descricaoItem: descricao,
                unidade: String(exp.unidade || exp.un || 'UN'),
                quantidadeSeparada: Number(exp.qtd_enviada || exp.quantidade_mobilizada || exp.quantidade || 0),
                dataSeparacao: formatDate(dataExp),
                dataMobilizacao: formatDate(dataExp),
                motoristaNome: motNome,
                placaVeiculo: placa,
                motoristaPlaca: motoristaPlaca,
                observacaoExpedicao: exp.observacao || 'Mobilizado para Obra',
                responsavelEnvio: exp.expedidor || 'Almoxarifado',
                requisitanteSol: exp.expedidor || 'Almoxarifado',
                statusMobilizacao: 'mobilizado',
                rawRow: exp
              });
            }
          });
        }
      } catch (e) {
        console.warn('Erro ao consultar expedicao_itens:', e);
      }

      // Converte o Map de volta para Array garantindo unicidade absoluta
      const historicoFinal: ItemExpedicao[] = Array.from(historicoMap.values());

      // Map previous shipments to calculate total quantity mobilized so far per base ID or document+code
      const mobilizedTotalByBaseId: { [baseId: string]: number } = {};
      historicoFinal.forEach(m => {
        const qty = Number(m.quantidadeSeparada) || 0;
        if (m.originalId && m.originalId !== '-') {
          mobilizedTotalByBaseId[m.originalId] = (mobilizedTotalByBaseId[m.originalId] || 0) + qty;
        }
        if (m.id && m.id !== '-') {
          mobilizedTotalByBaseId[m.id] = (mobilizedTotalByBaseId[m.id] || 0) + qty;
        }
        const doc = String(m.documentoNumero || '').trim();
        const cod = String(m.codigoMaterial || '').trim();
        if (doc && doc !== '-' && cod && cod !== '-') {
          const docCodeKey = `${doc}_${cod}`;
          mobilizedTotalByBaseId[docCodeKey] = (mobilizedTotalByBaseId[docCodeKey] || 0) + qty;
        }
      });

      const aguardandoList: ItemExpedicao[] = [];
      const historicoList: ItemExpedicao[] = historicoFinal;

      // Buscar RMs e Recebimentos em paralelo
      const [rmsResponse, recResponse] = await Promise.all([
        supabase.from('requisicoes').select('*'),
        supabase.from('recebimentos_itens').select('*')
      ]);

      const rmsData = rmsResponse.data;
      const rmsError = rmsResponse.error;
      const recData = recResponse.data;
      const recError = recResponse.error;

      // Mapa para rastrear pedidos / RMs já recebidos fisicamente
      const receivedRmAndDocSet = new Set<string>();
      const receivedDocCodeSet = new Set<string>();

      if (recData) {
        recData.forEach((recItem: any) => {
          const pc = String(recItem.numero_pc || recItem.numero_pedido || recItem.pedido || recItem.nota_fiscal || '').trim().toUpperCase();
          const sol = String(recItem.solicitacao || recItem.rm_numero || recItem.numero_rm || recItem.rm || '').trim().toUpperCase();
          const rawCod = String(recItem.codigo_material || recItem.codigo_item || recItem.codigo || recItem.produto_codigo || '').trim();
          const rawDesc = String(recItem.descricao_material || recItem.descricao_item || recItem.descricao || recItem.material || '').trim();
          const { codigo: codLimpo } = separarCodigoEDescricao(rawDesc, rawCod);

          if (pc && pc !== '-') {
            receivedRmAndDocSet.add(pc);
            const digits = pc.replace(/\D/g, '');
            if (digits) receivedRmAndDocSet.add(digits);
            if (codLimpo && codLimpo !== '-') {
              receivedDocCodeSet.add(`${pc}_${codLimpo}`);
            }
          }
          if (sol && sol !== '-') {
            receivedRmAndDocSet.add(sol);
            const digits = sol.replace(/\D/g, '');
            if (digits) receivedRmAndDocSet.add(digits);
            if (codLimpo && codLimpo !== '-') {
              receivedDocCodeSet.add(`${sol}_${codLimpo}`);
            }
          }
        });
      }

      // ----------------------------------------------------------------------
      // ORIGEM A: RMs do Estoque Interno e Pré-Cotação (requisicoes)
      // ----------------------------------------------------------------------
      if (rmsError) {
        console.warn('Erro ao buscar RMs no Supabase:', rmsError);
      } else if (rmsData) {
        rmsData.forEach((rm: any) => {
          const tipo = String(rm.tipoRM || rm.tipo_rm || rm.tipo_requisicao || rm.tipo || rm.categoria || '').toUpperCase();
          const status = String(rm.status || rm.status_interno || rm.status_aprovacao || rm.situacao || '').toLowerCase();

          // BLOQUEIO CRÍTICO DE DUPLICAÇÃO: 
          // Se a RM for de compra (Pré-cotação, Compra Direta, etc), IGNORE.
          // Esse material físico vai chegar e ser renderizado pelo fetch de 'recebimentos_itens'.
          if (
            tipo.includes('COTAÇÃO') || 
            tipo.includes('COTACAO') || 
            tipo.includes('COMPRA') || 
            tipo.includes('PRE') || 
            tipo.includes('PRÉ')
          ) {
            return; // Interrompe o processamento desta RM específica
          }

          // Função auxiliar para processar um item de RM de Estoque e jogar no array da Expedição
          const processarItemRm = (item: any, origemNome: string, idx: number = 0) => {
            const qtdAtendida = Number(
              item.quantidade_atendida ??
              item.qtd_atendida ??
              item.qtd_atend ??
              item.qtdAtendida ??
              item.quantidadeAtendida ??
              item.qtd_separada ??
              item.quantidade_separada ??
              rm.quantidade_atendida ??
              rm.qtd_atendida ??
              rm.qtd_atend ??
              rm.qtdAtendida ??
              0
            );

            // Regra de Ouro: Só vai pra expedição se tiver quantidade separada/atendida > 0
            if (qtdAtendida <= 0) return;

            const rmNumber = String(rm.rmNumber || rm.rm_number || rm.numero || rm.id || 'RM-CMPC').trim();

            const rawMat = String(
              item.descricao_material ||
              item.material ||
              item.descricao ||
              item.descricao_item ||
              rm.material ||
              rm.descricao ||
              rm.descricao_material ||
              'Item sem descrição'
            ).trim();

            let codigo = String(
              item.codigo_material ||
              item.codigo ||
              item.codigo_item ||
              item.codigoMaterial ||
              rm.codigo_material ||
              rm.codigoMaterial ||
              rm.codigo ||
              rm.codigo_item ||
              ''
            ).trim();

            let descricao = rawMat;

            if (rawMat.includes(' - ')) {
              const parts = rawMat.split(' - ');
              if (!codigo) codigo = parts[0].trim();
              descricao = parts.slice(1).join(' - ').trim();
            }

            if (!codigo) codigo = '-';

            const rawClasse =
              item.classeFinanceira ??
              item.classe_financeira ??
              item.classe ??
              rm.classeFinanceira ??
              rm.classe_financeira ??
              rm.classe ??
              'Sem classe vinculada';
            const classeFin = higienizarClasse(rawClasse);

            const itemUniqueKey = item.id || `item_${idx}`;
            const idUnico = `RM-${rm.id || rmNumber}-${itemUniqueKey}-${codigo !== '-' ? codigo : idx}`;
            const docCodeKey = `${rmNumber}_${codigo}`;
            const idDocCode = `RM-${rmNumber}-${codigo}`;
            const legacyId = `rm_${rm.id}_item_${idx}_${rmNumber}`;

            const qtdJaMobilizada = Math.max(
              mobilizedTotalByBaseId[idUnico] || 0,
              mobilizedTotalByBaseId[idDocCode] || 0,
              mobilizedTotalByBaseId[docCodeKey] || 0,
              mobilizedTotalByBaseId[legacyId] || 0
            );

            const saldoDisponivel = Math.max(0, qtdAtendida - qtdJaMobilizada);

            if (saldoDisponivel > 0) {
              const rawDate = String(
                rm.data_conclusao_tratamento ||
                rm.updated_at ||
                rm.createdTimestamp ||
                rm.dataSolicitacao ||
                rm.created_at ||
                ''
              );
              const solicitante = String(
                rm.solicitante ||
                rm.requisitante ||
                rm.usuario_solicitante ||
                'Almoxarifado'
              );
              const centroCusto = normalizeCentroCusto(
                rm.centroCusto ||
                rm.centro_custo ||
                'Estoque Central'
              );

              aguardandoList.push({
                id: idUnico,
                originalId: idUnico,
                itemIdRaw: item.id || rm.id || idx,
                origem: origemNome,
                origemTipo: 'RM',
                documentoNumero: rmNumber,
                centroCusto,
                codigoMaterial: codigo,
                descricaoItem: descricao || rawMat,
                classeFinanceira: classeFin,
                unidade: String(item.unidade || item.un || rm.unidade || 'UN'),
                quantidadeSeparada: saldoDisponivel,
                quantidadeOriginalTotal: qtdAtendida,
                dataSeparacao: formatDate(rawDate),
                requisitanteSol: solicitante,
                statusMobilizacao: qtdJaMobilizada > 0 ? 'mobilizado_parcial' : 'separado',
                rawRow: rm
              });
            }
          };

          // Validação do Status da RM de Estoque baseada na regra de negócio
          const qtdDiretaRM = Number(rm.quantidade_atendida || rm.qtd_atendida || rm.qtd_atend || 0);
          const statusValido = 
            status.includes('atendid') || 
            status.includes('aprovad') || 
            status.includes('conclui') || 
            status.includes('concluíd') || 
            status.includes('finalizad') || 
            status.includes('reprovad') ||
            qtdDiretaRM > 0 ||
            status === '';

          if (statusValido) {
            const origemNome = 'RM DE ESTOQUE';
            
            const embeddedItems = extractEmbeddedItems(rm);

            if (embeddedItems.length > 0) {
              embeddedItems.forEach((i: any, idx: number) => processarItemRm(i, origemNome, idx));
            } else if (rm.materiais && Array.isArray(rm.materiais) && rm.materiais.length > 0) {
              rm.materiais.forEach((i: any, idx: number) => processarItemRm(i, origemNome, idx));
            } else {
              processarItemRm(rm, origemNome, 0);
            }
          }
        });
      }

      // ----------------------------------------------------------------------
      // ORIGEM B: Compras Diretas (recebimentos_itens) - Sem limits ou filtros no banco
      // ----------------------------------------------------------------------
      if (recError) {
        console.warn('Erro ao buscar recebimentos_itens no Supabase:', recError);
      } else if (recData) {
        recData.forEach((recItem, idx) => {
          // Pega a quantidade fisicamente recebida
          const qtdRecebida = Number(
            recItem.quantidade_recebida ??
            recItem.qtd_recebida ??
            recItem.quantidade ??
            recItem.qtd ??
            recItem.qtd_entregue ??
            0
          );

          // Todo item recebido com saldo físico entra na listagem
          if (qtdRecebida > 0) {
            const numDoc = String(
              recItem.numero_pedido ||
              recItem.pedido ||
              recItem.numero_pc ||
              recItem.numeroPc ||
              recItem.nota_fiscal ||
              recItem.nf ||
              `PC-${recItem.id || idx}`
            ).trim();

            const rawCod = String(
              recItem.codigo_material ||
              recItem.codigo_item ||
              recItem.codigo ||
              recItem.produto_codigo ||
              ''
            ).trim();

            const rawDesc = String(
              recItem.descricao_material ||
              recItem.descricao_item ||
              recItem.descricao ||
              recItem.material ||
              recItem.produto_descricao ||
              'Item sem descrição'
            ).trim();

            const { codigo: codSeparado, descricao: descSeparada } = separarCodigoEDescricao(rawDesc, rawCod);
            const codigo = codSeparado || rawCod || '-';
            const descricao = descSeparada || rawDesc;

            const rawClasses = recItem.classes_financeiras
              ? String(recItem.classes_financeiras)
              : (recItem.classe_financeira ? String(recItem.classe_financeira) : (recItem.classe ? String(recItem.classe) : ''));
            const classeFin = rawClasses ? higienizarClasse(rawClasses) : 'Sem Classe Vinculada';

            const recRowId = recItem.id ?? `row_${idx}`;
            const idUnico = `REC-${numDoc}-${recRowId}-${codigo !== '-' ? codigo : idx}`;
            const legacyId = `pedido_${recItem.id}`;
            const idDocCode = `REC-${numDoc}-${codigo}`;
            const docCodeKey = `${numDoc}_${codigo}`;

            let totalJaMobilizado = 0;
            if (mobilizedTotalByBaseId[idUnico]) {
              totalJaMobilizado = Math.max(totalJaMobilizado, mobilizedTotalByBaseId[idUnico]);
            }
            if (mobilizedTotalByBaseId[legacyId]) {
              totalJaMobilizado = Math.max(totalJaMobilizado, mobilizedTotalByBaseId[legacyId]);
            }
            if (recItem.id && mobilizedTotalByBaseId[String(recItem.id)]) {
              totalJaMobilizado = Math.max(totalJaMobilizado, mobilizedTotalByBaseId[String(recItem.id)]);
            }
            if (numDoc && numDoc !== '-' && codigo && codigo !== '-') {
              if (mobilizedTotalByBaseId[idDocCode]) {
                totalJaMobilizado = Math.max(totalJaMobilizado, mobilizedTotalByBaseId[idDocCode]);
              }
              if (mobilizedTotalByBaseId[docCodeKey]) {
                totalJaMobilizado = Math.max(totalJaMobilizado, mobilizedTotalByBaseId[docCodeKey]);
              }
            }

            const saldoDisponivel = Math.max(0, qtdRecebida - totalJaMobilizado);

            if (saldoDisponivel > 0) {
              const itemExp: ItemExpedicao = {
                id: idUnico,
                originalId: idUnico,
                itemIdRaw: recItem.id || idx,
                origem: 'PEDIDO RECEBIDO',
                origemTipo: 'Pedido',
                documentoNumero: numDoc,
                classeFinanceira: classeFin,
                centroCusto: normalizeCentroCusto(recItem.centro_custo || recItem.centroCusto || 'Obra Não Informada'),
                codigoMaterial: codigo,
                descricaoItem: descricao,
                unidade: String(recItem.unidade || recItem.un || 'UN'),
                quantidadeSeparada: saldoDisponivel,
                quantidadeOriginalTotal: qtdRecebida,
                dataSeparacao: formatDate(recItem.data_recebimento || recItem.data_entrada || recItem.created_at || ''),
                requisitanteSol: String(recItem.comprador_real || recItem.conferente || recItem.comprador || 'Comprador'),
                statusMobilizacao: totalJaMobilizado > 0 ? 'mobilizado_parcial' : 'separado',
                rawRow: recItem
              };

              aguardandoList.push(itemExp);
            }
          }
        });
      }

      setItemsAguardando(aguardandoList);
      setItemsHistorico(historicoList);
    } catch (err: any) {
      console.error('Erro na carga dos dados de expedição:', err);
      showToast(`Erro ao carregar dados de expedição: ${err.message || err}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter dynamic options (Centros de Custo vinculados à aba ativa)
  const uniqueCentrosCusto = useMemo(() => {
    const source = activeTab === 'aguardando' ? itemsAguardando : itemsHistorico;
    const ccs = source.map(it => it.centroCusto).filter(Boolean) as string[];
    return Array.from(new Set(ccs)).sort();
  }, [activeTab, itemsAguardando, itemsHistorico]);

  // Auto-limpeza inteligente do filtro de Centro de Custo se mudar de aba
  useEffect(() => {
    if (selectedCc && selectedCc !== 'all' && !uniqueCentrosCusto.includes(selectedCc)) {
      setSelectedCc('');
    }
  }, [uniqueCentrosCusto, selectedCc]);

  // Filter dynamic options (Classes Financeiras em cascata com Centro de Custo)
  const uniqueClasses = useMemo(() => {
    const source = activeTab === 'aguardando' ? itemsAguardando : itemsHistorico;
    
    // Se houver um Centro de Custo selecionado, filtra a base antes de extrair as classes
    const filteredSource = (selectedCc && selectedCc !== 'all')
      ? source.filter(it => it.centroCusto === selectedCc) 
      : source;
      
    const classes = filteredSource.map(it => it.classeFinanceira).filter(Boolean) as string[];
    return Array.from(new Set(classes)).sort();
  }, [activeTab, itemsAguardando, itemsHistorico, selectedCc]);

  // Apply filters
  const listToDisplay = activeTab === 'aguardando' ? itemsAguardando : itemsHistorico;

  const filteredItems = useMemo(() => {
    return listToDisplay.filter(item => {
      // CC filter
      if (selectedCc && selectedCc !== 'all' && item.centroCusto !== selectedCc) return false;
      // Origem filter
      if (selectedOrigem !== 'all' && item.origemTipo !== selectedOrigem) return false;
      // Classe Financeira filter
      if (selectedClasse && selectedClasse !== 'all' && item.classeFinanceira !== selectedClasse) return false;
      // Search term filter
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const doc = item.documentoNumero.toLowerCase();
        const cod = item.codigoMaterial.toLowerCase();
        const desc = item.descricaoItem.toLowerCase();
        const cc = item.centroCusto.toLowerCase();
        const req = item.requisitanteSol.toLowerCase();
        const classe = (item.classeFinanceira || '').toLowerCase();
        return doc.includes(term) || cod.includes(term) || desc.includes(term) || cc.includes(term) || req.includes(term) || classe.includes(term);
      }
      return true;
    });
  }, [listToDisplay, selectedCc, selectedOrigem, selectedClasse, searchTerm]);

  // Handle Multi-Selection
  const isAllSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every(item => selectedIds.has(item.id));
  }, [filteredItems, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set<string>();
      filteredItems.forEach(item => newSet.add(item.id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelectItem = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Total units selected for batch mobilization
  const totalSelectedUnits = useMemo(() => {
    return itemsAguardando
      .filter(item => selectedIds.has(item.id))
      .reduce((acc, item) => acc + getQtdMobilizar(item), 0);
  }, [itemsAguardando, selectedIds, quantidadesMobilizar]);

  // Core Mobilization Handler (Supports Partial and Full Mobilization)
  const handleMobilizarItens = async (itemsToMobilize: { item: ItemExpedicao; qtd: number }[]) => {
    if (itemsToMobilize.length === 0) {
      showToast('Selecione pelo menos 1 item para confirmar a mobilização.', 'error');
      return;
    }

    const motNome = motoristaNome.trim();
    const motPlaca = placaVeiculo.trim().toUpperCase();

    if (!motNome) {
      showToast('Por favor, preencha o Nome do Motorista antes de confirmar a mobilização.', 'error');
      return;
    }

    if (!motPlaca) {
      showToast('Por favor, preencha a Placa do Veículo antes de confirmar a mobilização.', 'error');
      return;
    }

    setIsMobilizing(true);
    const nowIso = new Date().toISOString();
    const formattedNow = formatDate(nowIso);
    const responsavel = session?.nome || session?.email || 'Almoxarifado CMPC';
    const compositeMotPlaca = `${motNome} (${motPlaca})`;

    try {
      const novosMobilizados: ItemExpedicao[] = [];
      const updatedAguardandoMap = new Map<string, ItemExpedicao>(itemsAguardando.map(i => [i.id, { ...i }]));

      // Build payload for expedicao_itens table in Supabase
      const payloadExpedicao = itemsToMobilize.map(({ item, qtd }) => {
        const validQtd = Math.max(1, Math.min(qtd, item.quantidadeSeparada));
        return {
          numero_pc: item.documentoNumero,
          codigo_item: item.codigoMaterial,
          descricao_item: item.descricaoItem,
          centro_custo: item.centroCusto,
          qtd_enviada: validQtd,
          motorista_nome: motNome,
          placa_veiculo: motPlaca,
          expedidor: responsavel,
          data_expedicao: nowIso
        };
      });

      // 1. Insert records into Supabase expedicao_itens table
      try {
        const { error: insertDbError } = await supabase
          .from('expedicao_itens')
          .insert(payloadExpedicao);

        if (insertDbError) {
          console.warn('Aviso ao registrar em expedicao_itens:', insertDbError.message);
        }
      } catch (dbErr) {
        console.warn('Exceção ao inserir em expedicao_itens:', dbErr);
      }

      for (const { item, qtd } of itemsToMobilize) {
        const validQtd = Math.max(1, Math.min(qtd, item.quantidadeSeparada));
        const remainingQtd = item.quantidadeSeparada - validQtd;
        const baseOriginalId = item.originalId || item.id;
        const shipmentId = `${baseOriginalId}_envio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const mobRecord: ItemExpedicao = {
          ...item,
          id: shipmentId,
          originalId: baseOriginalId,
          quantidadeSeparada: validQtd,
          quantidadeOriginalTotal: item.quantidadeOriginalTotal || item.quantidadeSeparada,
          statusMobilizacao: 'mobilizado',
          dataMobilizacao: formattedNow,
          motoristaNome: motNome,
          placaVeiculo: motPlaca,
          motoristaPlaca: compositeMotPlaca,
          observacaoExpedicao: observacaoExpedicao.trim() || (remainingQtd > 0 ? `Envio Parcial (${validQtd} de ${item.quantidadeSeparada})` : 'Enviado para Obra'),
          responsavelEnvio: responsavel
        };

        novosMobilizados.push(mobRecord);

        if (remainingQtd > 0) {
          // Keep remaining balance available in Aguardando
          updatedAguardandoMap.set(item.id, {
            ...item,
            quantidadeSeparada: remainingQtd,
            quantidadeOriginalTotal: item.quantidadeOriginalTotal || item.quantidadeSeparada,
            statusMobilizacao: 'mobilizado_parcial'
          });
        } else {
          // Fully mobilized -> remove from Aguardando
          updatedAguardandoMap.delete(item.id);
        }

        // Update status in origin tables
        const newStatus = remainingQtd > 0 ? 'mobilizado_parcial' : 'mobilizado';
        if (item.origemTipo === 'Pedido' && item.itemIdRaw) {
          await supabase
            .from('recebimentos_itens')
            .update({ status_mobilizacao: newStatus })
            .eq('id', item.itemIdRaw);
        } else if (item.origemTipo === 'RM' && item.rawRow?.id) {
          await supabase
            .from('requisicoes')
            .update({ status_mobilizacao: newStatus })
            .eq('id', item.rawRow.id);
        }
      }

      // Persist to local storage history database
      const existingHistoryRaw = localStorage.getItem('expedicao_mobilizados_db');
      const existingHistory: ItemExpedicao[] = existingHistoryRaw ? JSON.parse(existingHistoryRaw) : [];
      const newHistory = [...novosMobilizados, ...existingHistory];
      localStorage.setItem('expedicao_mobilizados_db', JSON.stringify(newHistory));

      // Update state
      setItemsAguardando(Array.from(updatedAguardandoMap.values()));
      setItemsHistorico(prev => [...novosMobilizados, ...prev]);

      // Open Romaneio Modal for the newly mobilized items
      setRomaneioItems(novosMobilizados);
      setShowRomaneioModal(true);

      // Clear batch selection and custom quantities for mobilized items
      const mobilizedSet = new Set(itemsToMobilize.map(x => x.item.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        mobilizedSet.forEach(id => next.delete(id));
        return next;
      });

      setQuantidadesMobilizar(prev => {
        const next = { ...prev };
        itemsToMobilize.forEach(({ item, qtd }) => {
          const remaining = item.quantidadeSeparada - qtd;
          if (remaining > 0) {
            next[item.id] = remaining;
          } else {
            delete next[item.id];
          }
        });
        return next;
      });

      const totalQtdMobilizada = novosMobilizados.reduce((acc, curr) => acc + curr.quantidadeSeparada, 0);
      showToast(`${novosMobilizados.length} item(ns) mobilizado(s) com sucesso (${totalQtdMobilizada} un enviadas para a obra)!`, 'success');
    } catch (err: any) {
      console.error('Erro ao mobilizar itens:', err);
      showToast(`Erro ao mobilizar itens: ${err.message || err}`, 'error');
    } finally {
      setIsMobilizing(false);
    }
  };

  // Perform Batch Mobilization Action
  const handleConfirmarMobilizacaoLote = () => {
    const selectedItemsList = itemsAguardando
      .filter(item => selectedIds.has(item.id))
      .map(item => ({ item, qtd: getQtdMobilizar(item) }));
    handleMobilizarItens(selectedItemsList);
  };

  // Export CSV of current list
  const handleExportCsv = () => {
    if (filteredItems.length === 0) {
      showToast('Nenhum item disponível para exportação com os filtros atuais.', 'error');
      return;
    }

    const headers = [
      'Origem',
      'Classe Financeira',
      'Nº Documento',
      'Centro de Custo',
      'Código Material',
      'Descrição do Item',
      'Unidade',
      'Quantidade Separada',
      'Requisitante/Fornecedor',
      'Status Mobilização'
    ];

    if (activeTab === 'historico') {
      headers.push('Data Mobilização', 'Motorista / Placa', 'Observação / Romaneio', 'Responsável Envio');
    }

    const escapeCsv = (field: any) => {
      if (field === null || field === undefined) return '""';
      let str = String(field).trim().replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = [headers.join(';')];

    filteredItems.forEach(item => {
      const rowArr = [
        escapeCsv(item.origem),
        escapeCsv(item.classeFinanceira || '-'),
        escapeCsv(item.documentoNumero),
        escapeCsv(item.centroCusto),
        escapeCsv(item.codigoMaterial),
        escapeCsv(item.descricaoItem),
        escapeCsv(item.unidade),
        escapeCsv(item.quantidadeSeparada),
        escapeCsv(item.requisitanteSol),
        escapeCsv(item.statusMobilizacao === 'mobilizado' ? 'Enviado para Obra' : 'Aguardando Retirada')
      ];

      if (activeTab === 'historico') {
        rowArr.push(
          escapeCsv(item.dataMobilizacao || '-'),
          escapeCsv(item.motoristaPlaca || '-'),
          escapeCsv(item.observacaoExpedicao || '-'),
          escapeCsv(item.responsavelEnvio || '-')
        );
      }

      rows.push(rowArr.join(';'));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gestao_expedicao_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Relatório de expedição baixado com sucesso!', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-900">
      {/* HEADER BAR */}
      <header className="bg-slate-950/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl print:hidden">
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
            title="Voltar ao HUB Central"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Voltar ao HUB</span>
          </button>

          <div className="flex items-center gap-3">
            {customLogoUrl ? (
              <img
                src={customLogoUrl}
                alt="Logo Empresa"
                className="max-h-12 max-w-[180px] object-contain shrink-0 bg-slate-900 p-1.5 rounded-lg border border-slate-700 shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="p-1.5 rounded-xl bg-white border border-slate-700 shadow-md flex items-center justify-center shrink-0">
                <CompanyLogo className="scale-90" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg lg:text-xl font-black uppercase tracking-wide text-white">
                  Almoxarifado CMPC
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Expedição & Mobilização
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                Controle de expedição e envio de materiais para obras e frentes de serviço
              </p>
            </div>
          </div>
        </div>

        {/* STATS & ACTIONS */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer disabled:opacity-50 flex items-center gap-2 text-xs font-bold"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden md:inline">Atualizar</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredItems.length === 0}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </header>

      {/* TOAST ALERTS */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 max-w-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-amber-950/90 border-amber-500/40 text-amber-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <span className="text-xs font-bold leading-tight">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-auto p-1 hover:opacity-75 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER */}
      <main id="gestao-expedicao-main-content" className="flex-1 p-4 lg:p-8 w-full space-y-6 print:hidden">
        
        {/* TOP METRIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-4 shadow-md">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Aguardando Envio</p>
              <h2 className="text-2xl font-black text-white">{itemsAguardando.length}</h2>
              <p className="text-[10px] text-amber-400 font-semibold mt-0.5">Separados no Almoxarifado</p>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-4 shadow-md">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Obras Destino</p>
              <h2 className="text-2xl font-black text-white">{uniqueCentrosCusto.length}</h2>
              <p className="text-[10px] text-indigo-300 font-semibold mt-0.5">Centros de Custo Ativos</p>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-4 shadow-md">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Enviados para Obra</p>
              <h2 className="text-2xl font-black text-white">{itemsHistorico.length}</h2>
              <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Mobilizações Concluídas</p>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-4 shadow-md">
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Itens Selecionados</p>
              <h2 className="text-2xl font-black text-amber-400">{selectedIds.size}</h2>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Para a Carga Atual</p>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS & FILTERS */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          
          {/* TAB BUTTONS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
            <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('aguardando');
                  setSelectedIds(new Set());
                }}
                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'aguardando'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                <span>Aguardando Expedição ({itemsAguardando.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('historico');
                  setSelectedIds(new Set());
                }}
                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'historico'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Histórico de Mobilizados ({itemsHistorico.length})</span>
              </button>
            </div>

            {/* FILTER DROPDOWNS */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto flex-1">
              {/* CENTRO DE CUSTO DROPDOWN */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 min-w-[180px] flex-1 sm:flex-none">
                <Building className="w-4 h-4 text-amber-400 shrink-0" />
                <select
                  value={selectedCc}
                  onChange={(e) => setSelectedCc(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none w-full cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-200">
                    Todas as Obras ({uniqueCentrosCusto.length})
                  </option>
                  {uniqueCentrosCusto.map(cc => (
                    <option key={cc} value={cc} className="bg-slate-900 text-slate-200">
                      {cc}
                    </option>
                  ))}
                </select>
              </div>

              {/* CLASSE FINANCEIRA DROPDOWN */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 min-w-[200px] flex-1 sm:flex-none">
                <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                <select
                  value={selectedClasse}
                  onChange={(e) => setSelectedClasse(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none w-full cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-200">
                    Todas as Classes ({uniqueClasses.length})
                  </option>
                  {uniqueClasses.map(classe => (
                    <option key={classe} value={classe} className="bg-slate-900 text-slate-200">
                      {classe}
                    </option>
                  ))}
                </select>
              </div>

              {/* ORIGEM DROPDOWN */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 min-w-[150px] flex-1 sm:flex-none">
                <Filter className="w-4 h-4 text-indigo-400 shrink-0" />
                <select
                  value={selectedOrigem}
                  onChange={(e) => setSelectedOrigem(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none w-full cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">Todas as Origens</option>
                  <option value="RM" className="bg-slate-900">Tratamento de RM</option>
                  <option value="Pedido" className="bg-slate-900">Compras Diretas (Pedidos)</option>
                </select>
              </div>

              {/* SEARCH INPUT */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar por RM, Pedido, Código, Item, CC ou Classe..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-100 placeholder-slate-500 focus:outline-none w-full"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* BATCH ACTION BAR (FOR AGUARDANDO EXPEDIÇÃO) */}
          {activeTab === 'aguardando' && (
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-inner">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={filteredItems.length === 0}
                  className="flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer disabled:opacity-40"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-500" />
                  )}
                  <span>Selecionar Todos ({filteredItems.length})</span>
                </button>

                <div className="h-4 w-px bg-slate-700 hidden sm:block" />

                <span className="text-xs text-slate-300 font-semibold">
                  {selectedIds.size > 0 ? (
                    <span className="text-amber-400 font-black">{selectedIds.size} item(ns) selecionado(s)</span>
                  ) : (
                    <span className="text-slate-500">Nenhum item selecionado</span>
                  )}
                </span>
              </div>

              {/* MOTORISTA, PLACA & ACTION BUTTON */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 w-full sm:w-48 focus-within:border-amber-500/60 transition">
                  <UserCheck className="w-4 h-4 text-amber-400/80 shrink-0" />
                  <input
                    type="text"
                    placeholder="Motorista (Nome)"
                    value={motoristaNome}
                    onChange={(e) => setMotoristaNome(e.target.value)}
                    className="bg-transparent text-xs font-medium text-slate-100 placeholder-slate-500 focus:outline-none w-full"
                  />
                  {motoristaNome && (
                    <button type="button" onClick={() => setMotoristaNome('')} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 w-full sm:w-40 focus-within:border-amber-500/60 transition">
                  <Truck className="w-4 h-4 text-amber-400/80 shrink-0" />
                  <input
                    type="text"
                    placeholder="Placa (ABC-1234)"
                    value={placaVeiculo}
                    onChange={(e) => setPlacaVeiculo(e.target.value)}
                    className="bg-transparent text-xs font-medium text-slate-100 placeholder-slate-500 focus:outline-none w-full uppercase"
                  />
                  {placaVeiculo && (
                    <button type="button" onClick={() => setPlacaVeiculo('')} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleConfirmarMobilizacaoLote}
                  disabled={selectedIds.size === 0 || isMobilizing}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {isMobilizing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processando Envio...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        Confirmar Mobilização ({selectedIds.size})
                        {totalSelectedUnits > 0 && ` • ${totalSelectedUnits} un`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DATA TABLE */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-300">Carregando itens de expedição e mobilização...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Boxes className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">Nenhum material encontrado</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {activeTab === 'aguardando'
                  ? 'Não há materiais separados aguardando retirada para os filtros selecionados.'
                  : 'Nenhum histórico de mobilização encontrado para o filtro selecionado.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-700 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    {activeTab === 'aguardando' && (
                      <th className="p-3.5 w-10 text-center">
                        <button onClick={toggleSelectAll} className="cursor-pointer" title="Selecionar Todos">
                          {isAllSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400 mx-auto" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 mx-auto" />
                          )}
                        </button>
                      </th>
                    )}
                    <th className="p-3.5">Origem</th>
                    <th className="p-3.5">Classe</th>
                    <th className="p-3.5">Nº Documento</th>
                    <th className="p-3.5">Centro de Custo</th>
                    <th className="p-3.5">Código</th>
                    <th className="p-3.5">Descrição do Material</th>
                    <th className="p-3.5 text-center">
                      {activeTab === 'aguardando' ? 'Qtd. Disponível' : 'Qtd. Mobilizada'}
                    </th>
                    {activeTab === 'aguardando' && (
                      <th className="p-3.5 text-center">Qtd. a Mobilizar</th>
                    )}
                    {activeTab === 'historico' && <th className="p-3.5">Data Mobilização</th>}
                    {activeTab === 'historico' && <th className="p-3.5">Motorista / Transporte</th>}
                    <th className="p-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 text-xs font-medium">
                  {filteredItems.map(item => {
                    const isSelected = selectedIds.has(item.id);
                    const currentQtdMob = getQtdMobilizar(item);
                    const isPartialSelected = currentQtdMob < item.quantidadeSeparada;
                    const remainingBalance = item.quantidadeSeparada - currentQtdMob;

                    return (
                      <tr
                        key={item.id}
                        className={`transition hover:bg-slate-700/40 ${
                          isSelected ? 'bg-amber-500/10 border-l-4 border-l-amber-500' : ''
                        }`}
                      >
                        {activeTab === 'aguardando' && (
                          <td className="p-3.5 text-center">
                            <button onClick={() => toggleSelectItem(item.id)} className="cursor-pointer">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-amber-400 mx-auto" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 hover:text-slate-400 mx-auto" />
                              )}
                            </button>
                          </td>
                        )}

                        {/* ORIGEM BADGE */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${
                              item.origem === 'TRATAMENTO DE RM' || item.origemTipo === 'RM'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            <Tag className="w-3 h-3" />
                            {item.origem || (item.origemTipo === 'RM' ? 'TRATAMENTO DE RM' : 'PEDIDO RECEBIDO')}
                          </span>
                        </td>

                        {/* CLASSE FINANCEIRA */}
                        <td className="p-3">
                          <div className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]" title={item.classeFinanceira || '-'}>
                            {item.classeFinanceira || '-'}
                          </div>
                        </td>

                        {/* DOCUMENTO */}
                        <td className="p-3.5 font-bold text-white whitespace-nowrap">
                          {item.documentoNumero}
                        </td>

                        {/* CENTRO DE CUSTO */}
                        <td className="p-3.5 font-semibold text-slate-300 whitespace-nowrap">
                          {item.centroCusto}
                        </td>

                        {/* CÓDIGO */}
                        <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                          {item.codigoMaterial}
                        </td>

                        {/* DESCRIÇÃO */}
                        <td className="p-3.5 font-bold text-slate-200 max-w-xs truncate" title={item.descricaoItem}>
                          {item.descricaoItem}
                        </td>

                        {/* QUANTIDADE DISPONÍVEL / MOBILIZADA */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-black text-amber-400 text-sm">
                              {item.quantidadeSeparada} <span className="text-xs font-bold text-slate-400">{item.unidade}</span>
                            </span>
                            {item.statusMobilizacao === 'mobilizado_parcial' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 mt-0.5" title="Item já teve remessas anteriores">
                                Saldo Restante
                              </span>
                            )}
                          </div>
                        </td>

                        {/* QUANTIDADE A MOBILIZAR (EDITÁVEL) - APENAS NA ABA AGUARDANDO */}
                        {activeTab === 'aguardando' && (
                          <td className="p-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 hover:border-amber-500/50 focus-within:border-amber-500 rounded-xl p-1 shadow-inner">
                                <button
                                  type="button"
                                  onClick={() => setQtdMobilizar(item.id, currentQtdMob - 1, item.quantidadeSeparada)}
                                  disabled={currentQtdMob <= 1}
                                  className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-25 text-amber-400 hover:text-white font-black text-xs flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                                  title="Diminuir quantidade a enviar"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.quantidadeSeparada}
                                  value={currentQtdMob}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setQtdMobilizar(item.id, isNaN(val) ? 1 : val, item.quantidadeSeparada);
                                  }}
                                  className="w-12 text-center bg-transparent font-black text-amber-400 text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => setQtdMobilizar(item.id, currentQtdMob + 1, item.quantidadeSeparada)}
                                  disabled={currentQtdMob >= item.quantidadeSeparada}
                                  className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-25 text-amber-400 hover:text-white font-black text-xs flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed"
                                  title="Aumentar quantidade a enviar"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                {isPartialSelected && (
                                  <button
                                    type="button"
                                    onClick={() => setQtdMobilizar(item.id, item.quantidadeSeparada, item.quantidadeSeparada)}
                                    className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 px-1.5 py-0.5 rounded transition cursor-pointer ml-0.5"
                                    title="Mobilizar saldo total"
                                  >
                                    Máx
                                  </button>
                                )}
                              </div>
                              {isPartialSelected && (
                                <span className="text-[10px] text-emerald-400 font-semibold">
                                  Restarão {remainingBalance} {item.unidade} disp.
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* HISTÓRICO COLUMNS */}
                        {activeTab === 'historico' && (
                          <td className="p-3.5 text-emerald-400 font-bold whitespace-nowrap">
                            {item.dataMobilizacao || '-'}
                          </td>
                        )}
                        {activeTab === 'historico' && (
                          <td className="p-3.5 text-slate-300 whitespace-nowrap text-xs">
                            {item.motoristaNome ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white">{item.motoristaNome}</span>
                                {item.placaVeiculo && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-amber-400 border border-slate-700">
                                    {item.placaVeiculo}
                                  </span>
                                )}
                              </div>
                            ) : (
                              item.motoristaPlaca || '-'
                            )}
                          </td>
                        )}

                        {/* AÇÕES INDIVIDUAIS */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          {activeTab === 'aguardando' ? (
                            <button
                              type="button"
                              onClick={() => {
                                handleMobilizarItens([{ item, qtd: currentQtdMob }]);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-[11px] uppercase tracking-wider transition cursor-pointer flex items-center gap-1 mx-auto"
                              title={`Mobilizar ${currentQtdMob} ${item.unidade} para a obra`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Mobilizar ({currentQtdMob})</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRomaneioItems([item]);
                                setMotoristaNome(item.motoristaNome || item.motoristaPlaca?.split('(')[0]?.trim() || item.motoristaPlaca || '');
                                setPlacaVeiculo(item.placaVeiculo || item.motoristaPlaca?.split('(')[1]?.replace(')', '')?.trim() || '');
                                setObservacaoExpedicao(item.observacaoExpedicao || '');
                                setShowRomaneioModal(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 font-bold text-[10.5px] uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 mx-auto border border-slate-700 shadow-xs"
                              title="Visualizar / Imprimir Romaneio"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-400" />
                              <span>Romaneio</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* EMBEDDED PRINT STYLES FOR HIGH-FIDELITY ZERO-PAGE-OVERFLOW ROMANEIO */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm;
          }
          html, body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          #root {
            display: block !important;
            background: transparent !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide main UI, backdrops and buttons */
          header, 
          #gestao-expedicao-main-content, 
          #romaneio-modal-backdrop,
          .print\\:hidden {
            display: none !important;
          }
          /* Force display of Romaneio Print View */
          #romaneio-print-view {
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 9999999 !important;
          }
          #romaneio-print-view * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* ROMANEIO DE CARGA MODAL (ON SCREEN PREVIEW) */}
      {showRomaneioModal && (
        <div id="romaneio-modal-backdrop" className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto print:hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-wide">
                    Romaneio de Saída e Mobilização
                  </h2>
                  <p className="text-xs text-slate-400">
                    Comprovante oficial de envio de materiais para obra
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRomaneioModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL ON-SCREEN PREVIEW */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 font-mono text-xs text-slate-200 shadow-inner max-h-[60vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  {customLogoUrl ? (
                    <img
                      src={customLogoUrl}
                      alt="Logo Empresa"
                      className="max-h-12 max-w-[180px] object-contain shrink-0 bg-slate-900 rounded-lg p-2"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="bg-white p-1 rounded-lg border border-slate-700 shadow-sm shrink-0">
                      <CompanyLogo className="scale-85" />
                    </div>
                  )}
                  <div>
                    <span className="font-black text-amber-400 text-sm uppercase tracking-wider block">
                      ALMOXARIFADO CMPC
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Controle de Expedição & Mobilizações de Obra</p>
                  </div>
                </div>
                <div className="text-right text-[11px]">
                  <p className="font-bold text-white">Data: {formatDate(new Date().toISOString())}</p>
                  <p className="text-slate-400">Emissor: {session?.nome || 'Almoxarifado CMPC'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[9.5px] block">Motorista:</span>
                  <span className="font-bold text-white text-xs">
                    {motoristaNome || (romaneioItems[0]?.motoristaNome) || (romaneioItems[0]?.motoristaPlaca?.split('(')[0]?.trim()) || 'Transporte Próprio'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[9.5px] block">Placa do Veículo:</span>
                  <span className="font-bold text-amber-400 text-xs font-mono">
                    {placaVeiculo || (romaneioItems[0]?.placaVeiculo) || (romaneioItems[0]?.motoristaPlaca?.split('(')[1]?.replace(')', '')?.trim()) || 'Interno'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[9.5px] block">Observações de Saída:</span>
                  <span className="font-bold text-white text-xs">{observacaoExpedicao || 'Carga Autorizada / Envio para Obra'}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 pr-2">Origem</th>
                      <th className="py-2.5 px-2">Doc Nº</th>
                      <th className="py-2.5 px-2">Centro Custo</th>
                      <th className="py-2.5 px-2">Código</th>
                      <th className="py-2.5 px-2">Descrição</th>
                      <th className="py-2.5 pl-2 text-right">Qtd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {romaneioItems.map((ritem, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/40">
                        <td className="py-2.5 pr-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            ritem.origemTipo === 'RM' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {ritem.origemTipo}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-bold text-amber-400">{ritem.documentoNumero}</td>
                        <td className="py-2.5 px-2 text-slate-300">{ritem.centroCusto}</td>
                        <td className="py-2.5 px-2 text-slate-400 font-mono text-[10px]">{ritem.codigoMaterial}</td>
                        <td className="py-2.5 px-2 text-white font-medium">{ritem.descricaoItem}</td>
                        <td className="py-2.5 pl-2 text-right font-black text-amber-400 whitespace-nowrap">
                          {ritem.quantidadeSeparada} <span className="text-[10px] text-slate-400 font-normal">{ritem.unidade}</span>
                          {ritem.quantidadeOriginalTotal && ritem.quantidadeOriginalTotal > ritem.quantidadeSeparada ? (
                            <span className="block text-[8.5px] text-amber-300/80 font-normal">
                              Parcial (de {ritem.quantidadeOriginalTotal})
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* SUMMARY TOTALS */}
              <div className="flex justify-between items-center bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                <span className="text-slate-400 font-bold uppercase">Total de Itens: <strong className="text-white">{romaneioItems.length}</strong></span>
                <span className="text-slate-400 font-bold uppercase">
                  Volume Total: <strong className="text-amber-400">
                    {romaneioItems.reduce((acc, curr) => acc + (Number(curr.quantidadeSeparada) || 0), 0)} unidades
                  </strong>
                </span>
              </div>

              <div className="pt-6 grid grid-cols-2 gap-8 text-[10px] text-center text-slate-400">
                <div className="border-t border-slate-700 pt-2 space-y-0.5">
                  <p className="font-bold text-slate-300">Assinatura Expedidor (Almoxarifado CMPC)</p>
                  <p className="text-[9px] text-slate-500">Responsável pela Liberação</p>
                </div>
                <div className="border-t border-slate-700 pt-2 space-y-0.5">
                  <p className="font-bold text-slate-300">Assinatura Recebedor (Obra)</p>
                  <p className="text-[9px] text-slate-500">Motorista / Encarregado</p>
                </div>
              </div>
            </div>

            {/* MODAL ACTIONS */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRomaneioModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Romaneio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIGH-FIDELITY PRINT-ONLY ROMANEIO DOCUMENT (DIRECTLY TARGETED BY @MEDIA PRINT) */}
      {(showRomaneioModal || romaneioItems.length > 0) && (
        <div id="romaneio-print-view" className="hidden print:block bg-white text-slate-950 font-sans p-6 w-full max-w-full">
          {/* HEADER */}
          <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
            <div className="flex items-center gap-4">
              {customLogoUrl ? (
                <img
                  src={customLogoUrl}
                  alt="Logo Empresa"
                  className="max-h-8 max-w-[140px] object-contain shrink-0 bg-slate-900 rounded-md p-1.5"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="p-1 rounded bg-white border border-slate-300 shrink-0">
                  <CompanyLogo height={28} className="shrink-0" />
                </div>
              )}
              <div className="space-y-0.5">
                <span className="font-black text-lg tracking-tight text-slate-950 uppercase block">
                  ALMOXARIFADO CMPC
                </span>
                <h1 className="text-base font-black uppercase text-slate-900 tracking-wide">
                  ROMANEIO DE SAÍDA E MOBILIZAÇÃO DE MATERIAIS
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  Controle de Expedição, Trânsito e Entrega em Obra
                </p>
              </div>
            </div>

            <div className="text-right text-xs space-y-1">
              <div className="bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Data / Hora de Emissão</span>
                <strong className="text-xs text-slate-900 font-mono">{formatDate(new Date().toISOString())}</strong>
              </div>
              <p className="text-[10px] text-slate-500">
                Emissor: <strong className="text-slate-900">{session?.nome || 'Almoxarifado CMPC'}</strong>
              </p>
            </div>
          </div>

          {/* DISPATCH / TRANSPORT METADATA CARD */}
          <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-300 p-3.5 rounded-xl mb-4 text-xs print-avoid-break">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Motorista Responsável
              </span>
              <p className="font-bold text-slate-900 text-sm">
                {motoristaNome || (romaneioItems[0]?.motoristaNome) || (romaneioItems[0]?.motoristaPlaca?.split('(')[0]?.trim()) || 'Transporte Próprio'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Placa do Veículo
              </span>
              <p className="font-black text-slate-900 text-sm font-mono tracking-wider">
                {placaVeiculo || (romaneioItems[0]?.placaVeiculo) || (romaneioItems[0]?.motoristaPlaca?.split('(')[1]?.replace(')', '')?.trim()) || 'Interno'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Observações / Destino de Saída
              </span>
              <p className="font-bold text-slate-900 text-sm">
                {observacaoExpedicao || 'Carga Autorizada / Envio para Obra'}
              </p>
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div className="mb-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 uppercase text-[10px] font-black">
                  <th className="py-2.5 px-2 w-10 text-center">#</th>
                  <th className="py-2.5 px-2 w-20">Origem</th>
                  <th className="py-2.5 px-2 w-28">Nº Doc</th>
                  <th className="py-2.5 px-2 w-36">Centro de Custo</th>
                  <th className="py-2.5 px-2 w-28 font-mono">Código</th>
                  <th className="py-2.5 px-2">Descrição do Material</th>
                  <th className="py-2.5 px-2 text-right w-24">Quantidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {romaneioItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 print-avoid-break">
                    <td className="py-2.5 px-2 text-center font-bold text-slate-500 text-[11px]">{idx + 1}</td>
                    <td className="py-2.5 px-2 font-bold uppercase text-[10px] text-slate-700">
                      {item.origemTipo === 'RM' ? 'Estoque (RM)' : 'Compra (PC)'}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-slate-900">{item.documentoNumero}</td>
                    <td className="py-2.5 px-2 text-slate-800 font-medium">{item.centroCusto}</td>
                    <td className="py-2.5 px-2 font-mono text-slate-700 text-[11px]">{item.codigoMaterial}</td>
                    <td className="py-2.5 px-2 font-bold text-slate-900">{item.descricaoItem}</td>
                    <td className="py-2.5 px-2 text-right font-black text-slate-900 whitespace-nowrap text-xs">
                      {item.quantidadeSeparada} <span className="font-medium text-slate-600">{item.unidade}</span>
                      {item.quantidadeOriginalTotal && item.quantidadeOriginalTotal > item.quantidadeSeparada ? (
                        <span className="block text-[9px] text-slate-500 font-normal">
                          (Parcial de {item.quantidadeOriginalTotal})
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TOTALS BAR */}
          <div className="flex justify-between items-center bg-slate-100 border border-slate-300 px-4 py-2 rounded-xl mb-8 text-xs print-avoid-break">
            <span className="font-bold uppercase text-slate-700">
              Total de Itens Listados: <strong className="text-slate-900">{romaneioItems.length}</strong>
            </span>
            <span className="font-bold uppercase text-slate-700">
              Quantidade Total Mobilizada: <strong className="text-slate-900 font-black">
                {romaneioItems.reduce((acc, curr) => acc + (Number(curr.quantidadeSeparada) || 0), 0)} unidades
              </strong>
            </span>
          </div>

          {/* SIGNATURES SECTION */}
          <div className="grid grid-cols-2 gap-12 pt-6 mb-8 print-avoid-break">
            <div className="space-y-3">
              <div className="border-b-2 border-slate-800 pb-1" />
              <div className="text-center space-y-0.5">
                <p className="font-bold text-xs text-slate-900 uppercase">Expedidor / Almoxarifado CMPC</p>
                <p className="text-[10px] text-slate-600">Nome Legível: ____________________________</p>
                <p className="text-[10px] text-slate-600">Data: ____/____/________  Hora: ____:____</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="border-b-2 border-slate-800 pb-1" />
              <div className="text-center space-y-0.5">
                <p className="font-bold text-xs text-slate-900 uppercase">Recebedor / Responsável pela Obra</p>
                <p className="text-[10px] text-slate-600">Nome Legível: ____________________________</p>
                <p className="text-[10px] text-slate-600">Data: ____/____/________  Hora: ____:____</p>
              </div>
            </div>
          </div>

          {/* LEGAL & AUDIT FOOTER */}
          <div className="border-t border-slate-300 pt-3 text-center text-[9px] text-slate-500 font-mono print-avoid-break">
            Documento emitido eletronicamente pelo Almoxarifado CMPC. Válido como comprovante oficial de saída, trânsito interno e entrega de materiais em campo.
          </div>
        </div>
      )}
    </div>
  );
}

