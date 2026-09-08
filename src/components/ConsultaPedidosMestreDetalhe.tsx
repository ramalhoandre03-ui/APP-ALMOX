import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Printer, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Building, 
  DollarSign, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  Hash, 
  FileText, 
  User, 
  Package, 
  Calendar,
  Layers,
  ArrowRight,
  Receipt,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  PackageX,
  HelpCircle,
  RotateCcw,
  FileWarning,
  ScanFace,
  UserCheck
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { PRE_REGISTERED_EMPLOYEES } from './ExtraHoursPanel';
import FaceValidationModal, { ValidatedBiometricUser } from './FaceValidationModal';

interface ConsultaPedidosMestreDetalheProps {
  initialPedidoId?: string;
  onRefreshParentHistorico?: () => void;
}

interface ItemAgrupadoShadow {
  key: string;
  produto_descricao: string;
  codigo: string;
  comprador_real: string;
  valor_unitario: number;
  centros_custo: string[];
  solicitacoes: string[];
  previsoes_entrega: string[];
  linhas_bi: any[];
  qtdPedida: number;
  saldoERP: number;
  qtdLancadaERP: number;
  qtdRecebidaFisico: number;
  totalJaRecebido: number;
  saldoRealPendente: number;
  historicoFisico: any[];
}

export default function ConsultaPedidosMestreDetalhe({
  initialPedidoId,
  onRefreshParentHistorico
}: ConsultaPedidosMestreDetalheProps) {
  const { session } = useAuth();

  const [searchQuery, setSearchQuery] = useState(initialPedidoId || '');
  const [pedidoAtual, setPedidoAtual] = useState(initialPedidoId || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [biRows, setBiRows] = useState<any[]>([]);
  const [recebimentosPC, setRecebimentosPC] = useState<any[]>([]);

  // Estado da Logo Customizada do Supabase
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);

  // Estados dos inputs de recebimento inline por produto
  const [cardInputs, setCardInputs] = useState<{
    [key: string]: {
      nf: string;
      conferente: string;
      qtd: number | string;
      submitting?: boolean;
    };
  }>({});

  // Carrega a logo personalizada do Supabase (com fallback)
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
        console.error('Erro ao buscar logo personalizada do Supabase:', err);
      }
    };
    fetchLogo();
  }, []);

  // Modal de sucesso ao registrar recebimento
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    quantity: number;
    description: string;
  }>({
    isOpen: false,
    quantity: 0,
    description: ''
  });

  // Modal de Validação Biométrica Facial Obrigatória
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [pendingRecebimento, setPendingRecebimento] = useState<{
    item: ItemAgrupadoShadow;
    inputQtd: number;
    inputNF: string;
    inputConferente: string;
  } | null>(null);

  // Função principal de busca de dados no Supabase (pedidos_compras_bi + API do Robô + recebimentos_itens)
  const handleConsultar = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery !== undefined ? customQuery : searchQuery).trim();
    if (!query) {
      setErrorMsg('Por favor, informe o número do Pedido de Compra (PC) para consultar.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setPedidoAtual(query);

    try {
      const cleanQuery = query.trim();
      let biData: any[] | null = null;

      // 1. Busca em pedidos_compras_bi no Supabase
      const { data: directBi, error: biErr } = await supabase
        .from('pedidos_compras_bi')
        .select('*')
        .or(`pedido.eq.${cleanQuery},pedido.ilike.%${cleanQuery}%`);

      if (directBi && directBi.length > 0) {
        biData = directBi;
      }

      // Tentativa 2 no Supabase: Busca por dígitos
      if (!biData || biData.length === 0) {
        const digits = cleanQuery.replace(/\D/g, '');
        if (digits) {
          const { data: biDigits } = await supabase
            .from('pedidos_compras_bi')
            .select('*')
            .ilike('pedido', `%${digits}%`);
          if (biDigits && biDigits.length > 0) {
            biData = biDigits;
          }
        }
      }

      // 2. Se não encontrou no BI, consulta a API do robô Approvo / Mega (/api/consultar-pc)
      if (!biData || biData.length === 0) {
        try {
          const sessionAuth = (await supabase.auth.getSession()).data.session;
          const headers: Record<string, string> = { 'Accept': 'application/json' };
          if (sessionAuth?.access_token) {
            headers['Authorization'] = `Bearer ${sessionAuth.access_token}`;
          }

          const res = await fetch(`/api/consultar-pc?numero=${encodeURIComponent(cleanQuery)}`, {
            headers
          });

          if (res.ok) {
            const apiData = await res.json();
            if (apiData && (apiData.numero_pedido || apiData.numero || apiData.fornecedor || apiData.status)) {
              let fornecedorStr = 'FORNECEDOR HOMOLOGADO CMPC';
              if (typeof apiData.fornecedor === 'object' && apiData.fornecedor !== null) {
                fornecedorStr = apiData.fornecedor.razao_social || apiData.fornecedor.razaoSocial || apiData.fornecedor.nome || 'FORNECEDOR HOMOLOGADO CMPC';
              } else if (typeof apiData.fornecedor === 'string' && apiData.fornecedor.trim()) {
                fornecedorStr = apiData.fornecedor.trim();
              }

              const compradorStr = apiData.comprador || apiData.solicitante || apiData.comprador_real || apiData.comprador_nome || 'Comprador CMPC';
              const dataEmissao = apiData.data_emissao || apiData.dataEmissao || new Date().toLocaleDateString('pt-BR');
              const centroCusto = apiData.centro_custo || apiData.centroCusto || 'Almoxarifado Guaíba';
              const statusPedido = apiData.status || 'Aprovado';
              const rawItems = apiData.itens || apiData.items || apiData.materiais || [];

              if (Array.isArray(rawItems) && rawItems.length > 0) {
                biData = rawItems.map((it: any, idx: number) => {
                  const desc = (it.descricao || it.material || it.descricao_material || it.produto || `Item #${idx + 1}`).trim();
                  const qtd = Number(it.qtd || it.quantidade || it.qtd_pedida || 1);
                  const saldoERP = Number(
                    it.saldo_pendente !== undefined ? it.saldo_pendente : 
                    it.quantidade_saldo_pendente !== undefined ? it.quantidade_saldo_pendente : qtd
                  );
                  const vlUnit = Number(it.vl_unitario || it.valorUnitario || (Number(it.vl_total || it.valorTotal || 0) / (qtd || 1)) || 0);

                  return {
                    id: crypto.randomUUID(),
                    pedido: cleanQuery,
                    fornecedor: fornecedorStr,
                    produto_descricao: desc,
                    codigo: String(it.codigo || it.codigo_material || it.cod || `MAT-${idx + 1}`),
                    quantidade_pedida: qtd,
                    saldo_a_receber: saldoERP,
                    valor_unitario: vlUnit,
                    valor_total: Number(it.vl_total || (vlUnit * qtd)),
                    centro_custo: centroCusto,
                    solicitacao: String(it.solicitacao || it.rm || '-'),
                    previsao_entrega: dataEmissao,
                    comprador_real: compradorStr,
                    status_pedido: statusPedido
                  };
                });
              } else {
                // Pedidos sem itens discriminados no Approvo (contratos globais ou serviços, ex: 8069, 8076, 8077, 8078)
                const vlTotal = Number(apiData.valor_total || apiData.valorTotal || 0);
                const descPadrao = `FORNECIMENTO / SERVIÇO CONTRATADO (${fornecedorStr})`;
                biData = [{
                  id: crypto.randomUUID(),
                  pedido: cleanQuery,
                  fornecedor: fornecedorStr,
                  produto_descricao: descPadrao,
                  codigo: `PC-${cleanQuery}`,
                  quantidade_pedida: 1,
                  saldo_a_receber: 1,
                  valor_unitario: vlTotal > 0 ? vlTotal : 0,
                  valor_total: vlTotal > 0 ? vlTotal : 0,
                  centro_custo: centroCusto,
                  solicitacao: '-',
                  previsao_entrega: dataEmissao,
                  comprador_real: compradorStr,
                  status_pedido: statusPedido
                }];
              }

              // Salva em background na tabela pedidos_compras_bi no Supabase para acelerar futuras consultas
              if (biData && biData.length > 0) {
                try {
                  const biToInsert = biData.map(b => ({
                    pedido: b.pedido,
                    fornecedor: b.fornecedor,
                    produto_descricao: b.produto_descricao,
                    quantidade: b.quantidade_pedida,
                    quantidade_pedida: b.quantidade_pedida,
                    saldo_a_receber: b.saldo_a_receber,
                    valor_unitario: b.valor_unitario,
                    valor_total: b.valor_total,
                    centro_custo: b.centro_custo,
                    solicitacao: b.solicitacao,
                    data_emissao: b.previsao_entrega,
                    previsao_entrega: b.previsao_entrega,
                    comprador_real: b.comprador_real,
                    status_pedido: b.status_pedido
                  }));
                  supabase.from('pedidos_compras_bi').upsert(biToInsert).then(() => {});
                } catch (_) {}
              }
            }
          }
        } catch (apiErr) {
          console.warn('API Approvo fallback error:', apiErr);
        }
      }

      // 3. Se ainda não tiver itens, tenta buscar histórico de recebimentos em recebimentos_itens
      if (!biData || biData.length === 0) {
        const { data: recData } = await supabase
          .from('recebimentos_itens')
          .select('*')
          .or(`numero_pc.eq.${cleanQuery},numero_pc.ilike.%${cleanQuery}%`);

        if (recData && recData.length > 0) {
          biData = recData.map(r => ({
            id: r.id || crypto.randomUUID(),
            pedido: r.numero_pc || cleanQuery,
            fornecedor: r.fornecedor || 'FORNECEDOR HOMOLOGADO CMPC',
            produto_descricao: r.descricao_item || 'Item Recebido no Almoxarifado',
            codigo: r.codigo_item || '-',
            quantidade_pedida: Number(r.qtd_pedida || r.qtd_recebida || 1),
            saldo_a_receber: Number(r.saldo_pendente || 0),
            valor_unitario: Number(r.valor_unitario || 0),
            valor_total: Number(r.valor_total_item || 0),
            centro_custo: r.centro_custo || 'Almoxarifado Geral',
            solicitacao: '-',
            previsao_entrega: r.data_recebimento || new Date().toLocaleDateString('pt-BR'),
            comprador_real: r.comprador_real || 'Comprador CMPC',
            status_pedido: 'Aprovado'
          }));
        }
      }

      // 4. Se não encontrou em nenhuma das fontes (BI, Robô Approvo/Mega ou Histórico), aciona tela de não encontrado
      if (!biData || biData.length === 0) {
        setBiRows([]);
        setRecebimentosPC([]);
        setErrorMsg('PEDIDO NÃO ENCONTRADO, VERIFIQUE A NUMERAÇÃO OU PROCURE AUXÍLIO ADMINISTRATIVO');
        return;
      }

      setBiRows(biData);

      // 5. Busca check-ins físicos já realizados para este pedido em recebimentos_itens
      await fetchRecebimentosPC(cleanQuery);
    } catch (err: any) {
      console.error('Erro na consulta do pedido:', err);
      setErrorMsg('PEDIDO NÃO ENCONTRADO, VERIFIQUE A NUMERAÇÃO OU PROCURE AUXÍLIO ADMINISTRATIVO');
      setBiRows([]);
      setRecebimentosPC([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecebimentosPC = async (pcNum: string) => {
    if (!pcNum) return;
    const cleanNum = String(pcNum).trim().toLowerCase();
    const cleanDigits = cleanNum.replace(/\D/g, '') || cleanNum;

    try {
      const { data, error } = await supabase
        .from('recebimentos_itens')
        .select('*')
        .or(`numero_pc.ilike.%${cleanNum}%,numero_pc.ilike.%${cleanDigits}%`)
        .order('data_entrada', { ascending: false });

      if (!error && data) {
        setRecebimentosPC(data);
      } else {
        setRecebimentosPC([]);
      }
    } catch (e) {
      console.warn('Erro ao buscar recebimentos_itens:', e);
      setRecebimentosPC([]);
    }
  };

  useEffect(() => {
    if (initialPedidoId) {
      setSearchQuery(initialPedidoId);
      setPedidoAtual(initialPedidoId);
      handleConsultar(undefined, initialPedidoId);
    }
  }, [initialPedidoId]);

  // Desduplicação inteligente da matriz de dados do BI
  const biRowsDeduplicados = useMemo(() => {
    if (!biRows) return [];
    
    const mapaUnico = new Map();
    
    biRows.forEach((item) => {
      // Cria uma chave única juntando o PC e o Código do Material
      const chaveUnica = `${item.pedido || item.numero_pc || 'SEM_PC'}_${item.codigo || item.codigo_item || item.cod || item.produto_descricao || item.descricao_item || 'SEM_COD'}`;
      
      if (!mapaUnico.has(chaveUnica)) {
        // Se é a primeira vez que vemos esse PC+Item, guardamos ele
        mapaUnico.set(chaveUnica, { ...item, rmsVinculadas: [item.solicitacao || item.rmNumber || item.rm] });
      } else {
        // Se já existe, não somamos a quantidade! Apenas registramos que ele atende outra RM.
        const itemExistente = mapaUnico.get(chaveUnica);
        if (item.solicitacao || item.rmNumber || item.rm) {
           if (!itemExistente.rmsVinculadas) itemExistente.rmsVinculadas = [];
           itemExistente.rmsVinculadas.push(item.solicitacao || item.rmNumber || item.rm);
        }
      }
    });

    return Array.from(mapaUnico.values());
  }, [biRows]);

  // Agrupamento Mestre-Detalhe (Shadow Balance) por produto_descricao
  const produtosAgrupados = useMemo<ItemAgrupadoShadow[]>(() => {
    if (!biRowsDeduplicados || biRowsDeduplicados.length === 0) return [];

    const map = new Map<string, {
      key: string;
      produto_descricao: string;
      codigo: string;
      comprador_real: string;
      valor_unitario: number;
      centros_custo: string[];
      solicitacoes: string[];
      previsoes_entrega: string[];
      linhas_bi: any[];
      qtd_pedida_total: number;
      saldo_erp_total: number;
    }>();

    for (const row of biRowsDeduplicados) {
      const rawDesc = (row.produto_descricao || row.descricao_item || row.descricao || 'Item Sem Descrição').trim();
      const key = rawDesc.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          key,
          produto_descricao: rawDesc,
          codigo: row.codigo || row.codigo_item || row.cod || '-',
          comprador_real: row.comprador_real || row.comprador || '',
          valor_unitario: Number(row.valor_unitario || row.vl_unitario || row.preco_unitario || 0),
          centros_custo: [],
          solicitacoes: [],
          previsoes_entrega: [],
          linhas_bi: [],
          qtd_pedida_total: 0,
          saldo_erp_total: 0,
        });
      }

      const item = map.get(key)!;
      item.linhas_bi.push(row);
      item.qtd_pedida_total += Number(row.quantidade_pedida ?? row.qtd_pedida ?? row.quantidade ?? 0);
      item.saldo_erp_total += Number(row.saldo_a_receber ?? row.saldo_pendente ?? 0);

      if (row.centro_custo && !item.centros_custo.includes(row.centro_custo)) {
        item.centros_custo.push(row.centro_custo);
      }
      if (row.solicitacao && !item.solicitacoes.includes(row.solicitacao)) {
        item.solicitacoes.push(row.solicitacao);
      }
      if (row.previsao_entrega && !item.previsoes_entrega.includes(row.previsao_entrega)) {
        item.previsoes_entrega.push(row.previsao_entrega);
      }
      if (!item.comprador_real && (row.comprador_real || row.comprador)) {
        item.comprador_real = row.comprador_real || row.comprador;
      }
      if (!item.valor_unitario && (row.valor_unitario || row.vl_unitario)) {
        item.valor_unitario = Number(row.valor_unitario || row.vl_unitario);
      }
    }

    return Array.from(map.values()).map(grupo => {
      const qtdPedida = grupo.qtd_pedida_total;
      const saldoERP = grupo.saldo_erp_total;
      const qtdLancadaERP = Math.max(0, qtdPedida - saldoERP);

      // Cruzamento com recebimentos_itens
      const matchingRecebimentos = (recebimentosPC || []).filter(r => {
        const rDesc = String(r.descricao_item || r.produto_descricao || '').trim().toLowerCase();
        const gDesc = grupo.produto_descricao.toLowerCase();
        return rDesc === gDesc || rDesc.includes(gDesc) || gDesc.includes(rDesc);
      });

      const qtdRecebidaFisico = matchingRecebimentos.reduce((sum, r) => {
        return sum + Number(r.qtd_recebida ?? r.qtd_entregue ?? 0);
      }, 0);

      const totalJaRecebido = qtdLancadaERP + qtdRecebidaFisico;
      const saldoRealPendente = Math.max(0, qtdPedida - qtdLancadaERP - qtdRecebidaFisico);

      return {
        ...grupo,
        qtdPedida,
        saldoERP,
        qtdLancadaERP,
        qtdRecebidaFisico,
        totalJaRecebido,
        saldoRealPendente,
        historicoFisico: matchingRecebimentos,
      };
    });
  }, [biRows, recebimentosPC]);

  // Capa do Documento (Cabeçalho do Pedido)
  const capaPedido = useMemo(() => {
    if (!biRows || biRows.length === 0) return null;
    const first = biRows[0];
    const numPC = first.pedido || pedidoAtual || searchQuery;
    const fornecedor = first.fornecedor || 'FORNECEDOR HOMOLOGADO CMPC';
    const dataEmissao = first.data_emissao || new Date().toLocaleDateString('pt-BR');
    const comprador = first.comprador_real || first.comprador || 'Comprador CMPC';
    const status = first.status_pedido || 'Aprovado';

    const totalPedidaGeral = produtosAgrupados.reduce((acc, i) => acc + i.qtdPedida, 0);
    const totalRecebidaGeral = produtosAgrupados.reduce((acc, i) => acc + i.totalJaRecebido, 0);
    const saldoTotalGeral = produtosAgrupados.reduce((acc, i) => acc + i.saldoRealPendente, 0);

    return {
      numeroPedido: numPC,
      fornecedor,
      dataEmissao,
      comprador,
      status,
      totalPedidaGeral,
      totalRecebidaGeral,
      saldoTotalGeral,
      percentualAtendido: totalPedidaGeral > 0 ? Math.min(100, Math.round((totalRecebidaGeral / totalPedidaGeral) * 100)) : 0,
      totalItens: produtosAgrupados.length
    };
  }, [biRows, pedidoAtual, searchQuery, produtosAgrupados]);

  // Manipulação de inputs inline do Card
  const handleCardInputChange = (key: string, field: 'nf' | 'conferente' | 'qtd' | 'submitting', value: any) => {
    setCardInputs(prev => ({
      ...prev,
      [key]: {
        nf: prev[key]?.nf ?? '',
        conferente: prev[key]?.conferente ?? (session?.nome || session?.user?.name || 'Almoxarife Logado'),
        qtd: prev[key]?.qtd ?? '',
        [field]: value
      }
    }));
  };

  // Valida e extrai os dados digitados no card de recebimento
  const getValidatedItemInput = (item: ItemAgrupadoShadow) => {
    const inputData = cardInputs[item.key] || {
      nf: '',
      conferente: session?.nome || session?.user?.name || 'Almoxarife Logado',
      qtd: item.saldoRealPendente,
      submitting: false
    };
    const inputNF = (inputData.nf || '').trim();
    const inputConferente = (inputData.conferente || session?.nome || session?.user?.name || 'Almoxarife Logado').trim();
    
    // Se o usuário não digitou quantidade, assume o saldo total pendente
    const rawQtd = inputData.qtd !== undefined && inputData.qtd !== '' ? inputData.qtd : item.saldoRealPendente;
    const inputQtd = Number(rawQtd);

    if (isNaN(inputQtd) || inputQtd <= 0) {
      alert('A quantidade recebida deve ser um número maior que zero.');
      return null;
    }
    if (inputQtd > item.saldoRealPendente) {
      alert(`A quantidade informada (${inputQtd}) não pode ultrapassar o Saldo Real Pendente (${item.saldoRealPendente}).`);
      return null;
    }
    if (!inputNF) {
      alert('Por favor, informe o número da Nota Fiscal (NF) para garantir a auditoria e rastreabilidade.');
      return null;
    }

    return { inputQtd, inputNF, inputConferente };
  };

  // 1. Gatilho para Validação Biométrica (Abre o Scanner Facial)
  const handleReceberItem = (item: ItemAgrupadoShadow) => {
    const validated = getValidatedItemInput(item);
    if (!validated) return;

    // Salva os dados pendentes e abre o scanner biométrico
    setPendingRecebimento({
      item,
      inputQtd: validated.inputQtd,
      inputNF: validated.inputNF,
      inputConferente: validated.inputConferente
    });
    setIsFaceModalOpen(true);
  };

  // 2. Gatilho para Conclusão Manual Direta (Bypass da Biometria)
  const handleReceberManual = (item: ItemAgrupadoShadow) => {
    const validated = getValidatedItemInput(item);
    if (!validated) return;

    const pendingData = {
      item,
      inputQtd: validated.inputQtd,
      inputNF: validated.inputNF,
      inputConferente: validated.inputConferente
    };

    setPendingRecebimento(pendingData);

    const manualUser: ValidatedBiometricUser = {
      id: 'manual',
      nome: validated.inputConferente || session?.nome || session?.user?.name || 'Recebimento Manual',
      cargo: 'Conferente',
      confidence: 0,
      distance: 1
    };

    executarSalvamentoOficial(manualUser, pendingData);
  };

  // Executa a gravação oficial no Supabase (tanto para biometria quanto manual/bypass)
  const executarSalvamentoOficial = async (
    usuarioValidado: ValidatedBiometricUser, 
    customPending?: { item: ItemAgrupadoShadow; inputQtd: number; inputNF: string; inputConferente: string }
  ) => {
    setIsFaceModalOpen(false);
    const activePending = customPending || pendingRecebimento;
    if (!activePending) return;

    const { item, inputQtd, inputNF, inputConferente } = activePending;
    handleCardInputChange(item.key, 'submitting', true);

    try {
      const isBiometric = usuarioValidado.confidence > 0 && !String(usuarioValidado.id).includes('manual');
      const nomeResponsavel = usuarioValidado.nome || inputConferente || session?.nome || 'Conferente';
      const centrosAgregados = item.centros_custo.join(', ') || item.linhas_bi[0]?.centro_custo || '';
      const novoSaldoPendente = Math.max(0, item.saldoRealPendente - inputQtd);
      const statusFisico = novoSaldoPendente <= 0 ? 'total' : 'parcial';
      const valorUnitario = item.valor_unitario || 0;
      const valorTotalItem = Number((valorUnitario * inputQtd).toFixed(2));

      // Carimbo oficial do responsável registrado no Supabase
      const payload = {
        numero_pc: capaPedido?.numeroPedido || pedidoAtual,
        fornecedor: capaPedido?.fornecedor || '-',
        centro_custo: centrosAgregados,
        nota_fiscal: inputNF,
        codigo_item: item.codigo || '-',
        descricao_item: item.produto_descricao,
        qtd_pedida: item.qtdPedida,
        qtd_recebida: inputQtd,
        saldo_pendente: novoSaldoPendente,
        status_fisico: statusFisico,
        conferente: nomeResponsavel,
        recebido_por: nomeResponsavel,
        biometria_validada: isBiometric,
        biometria_usuario_id: isBiometric ? String(usuarioValidado.id) : null,
        biometria_confianca: isBiometric ? usuarioValidado.confidence : null,
        data_entrada: new Date().toISOString(),
        data_recebimento: new Date().toISOString().split('T')[0],
        comprador_real: item.comprador_real || '',
        valor_unitario: valorUnitario,
        valor_total_item: valorTotalItem,
        id: crypto.randomUUID()
      };

      const { error: insertError } = await supabase.from('recebimentos_itens').insert([payload]);
      if (insertError) throw insertError;

      // Log de Auditoria
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'PHYSICAL_CHECKIN',
            timestamp: new Date().toISOString(),
            description: isBiometric
              ? `[Almoxarifado] Check-in Físico Autenticado por Biometria Facial: ${item.produto_descricao} (Qtd: ${inputQtd}, NF: ${inputNF}, PC: ${capaPedido?.numeroPedido}) - Responsável: ${usuarioValidado.nome} (Confiança: ${usuarioValidado.confidence}%)`
              : `[Almoxarifado] Check-in Físico Manual (Bypass Biometria): ${item.produto_descricao} (Qtd: ${inputQtd}, NF: ${inputNF}, PC: ${capaPedido?.numeroPedido}) - Responsável: ${nomeResponsavel}`,
            details: payload
          })
        });
      } catch (_) {}

      // Limpa os campos do card
      setCardInputs(prev => ({
        ...prev,
        [item.key]: {
          nf: inputNF, // Mantém a NF para conveniência dos próximos itens
          conferente: nomeResponsavel,
          qtd: '',
          submitting: false
        }
      }));

      // Recarrega os recebimentos imediatamente
      await fetchRecebimentosPC(capaPedido?.numeroPedido || pedidoAtual);
      if (onRefreshParentHistorico) onRefreshParentHistorico();

      // Exibe modal de comemoração com indicação da forma de validação
      setSuccessModal({
        isOpen: true,
        quantity: inputQtd,
        description: isBiometric 
          ? `${item.produto_descricao} • Autenticado via Biometria por: ${usuarioValidado.nome}`
          : `${item.produto_descricao} • Registrado Manualmente por: ${nomeResponsavel}`
      });
    } catch (err: any) {
      console.error('Erro ao registrar recebimento:', err);
      alert('Falha ao registrar check-in no banco de dados: ' + (err.message || err));
    } finally {
      handleCardInputChange(item.key, 'submitting', false);
      setPendingRecebimento(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNovaConsulta = () => {
    setSearchQuery('');
    setPedidoAtual('');
    setBiRows([]);
    setRecebimentosPC([]);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-6 w-full print:space-y-4" id="mestre-detalhe-shadow-container">
      
      {/* 1. BARRA DE PESQUISA DO PEDIDO (Oculta na Impressão) */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-8 text-center space-y-4 print:hidden"
        id="search-box-container"
      >
        <div className="max-w-xl mx-auto space-y-2">
          <div className="inline-flex p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
            <Search className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Consulta de Pedido de Compra (SGI)
          </h1>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Consulte o Saldo Sombra em tempo real com base na sincronização de Compras (BI) e Check-ins do Almoxarifado.
          </p>
        </div>

        <form onSubmit={(e) => handleConsultar(e)} className="max-w-2xl mx-auto space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none text-slate-400">
              <Hash className="w-5 h-5" />
            </div>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="Digite o Número do Pedido (Ex: PC-2026-9874 ou 2026-9874)"
              className="w-full text-slate-900 placeholder-slate-400 bg-slate-50 hover:bg-slate-50/50 border-2 border-slate-200 rounded-2xl pl-12 pr-4.5 py-4 text-base md:text-lg font-mono font-black outline-hidden focus:border-indigo-500 focus:bg-white transition-all shadow-2xs text-center uppercase tracking-wider"
              id="input-numero-pc-busca"
            />
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-4 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              id="btn-executar-consulta"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Consultando Supabase...</span>
                </>
              ) : (
                <>
                  <span>Consultar Pedido</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* ESTADO DE CARREGAMENTO */}
      {loading && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-200 shadow-sm rounded-3xl p-12 text-center space-y-6 py-20 print:hidden"
        >
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
              <RefreshCw className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
              Buscando Dados de Compras & Almoxarifado
            </h3>
            <p className="text-xs text-indigo-600 font-bold uppercase animate-pulse">
              Carregando pedidos_compras_bi e calculando Saldo Sombra...
            </p>
          </div>
        </motion.div>
      )}

      {/* ESTADO DE PEDIDO NÃO ENCONTRADO */}
      {!capaPedido && !loading && errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-white border-2 border-rose-200 shadow-xl rounded-3xl p-8 md:p-12 text-center print:hidden space-y-6 max-w-3xl mx-auto overflow-hidden relative"
          id="pedido-nao-encontrado-container"
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />
          
          <div className="w-20 h-20 bg-rose-50 border-2 border-rose-200 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <PackageX className="w-10 h-10" />
          </div>

          <div className="space-y-3 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-[11px] font-black uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" />
              Resultado da Pesquisa
            </div>

            <h2 className="text-xl md:text-2xl font-black text-rose-900 tracking-tight uppercase leading-snug">
              PEDIDO NÃO ENCONTRADO, VERIFIQUE A NUMERAÇÃO OU PROCURE AUXÍLIO ADMINISTRATIVO
            </h2>

            <p className="text-sm text-slate-600 font-medium">
              O pedido <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">#{pedidoAtual || searchQuery}</span> não foi localizado no banco de dados do BI, no Approvo / Mega nem no histórico de recebimentos.
            </p>
          </div>

          {/* Orientações para o Almoxarife */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-3 max-w-xl mx-auto">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              Orientações de Verificação:
            </span>
            <ul className="text-xs text-slate-600 space-y-2.5 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                <span>Confira a numeração do Pedido de Compra (PC) impressa na Nota Fiscal ou DANFE.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                <span>Certifique-se de que o pedido já foi emitido e aprovado pela gerência no sistema Mega ERP.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                <span>Se a numeração estiver correta e o erro persistir, solicite suporte ao <strong>Comprador Responsável</strong> ou ao <strong>Setor Administrativo de Suprimentos</strong>.</span>
              </li>
            </ul>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleNovaConsulta}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar Nova Consulta
            </button>
          </div>
        </motion.div>
      )}

      {/* ESTADO VAZIO */}
      {!capaPedido && !loading && !errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 shadow-sm rounded-3xl p-8 text-center print:hidden"
        >
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Package size={48} className="mb-3 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-700 mb-1">Nenhum pedido consultado</h2>
            <p className="text-xs max-w-md mx-auto text-slate-500 font-medium">
              Digite o número do Pedido de Compra acima para exibir a capa mestre, seus itens agrupados e realizar os check-ins físicos.
            </p>
          </div>
        </motion.div>
      )}

      {/* 2. DOCUMENTO MESTRE-DETALHE DO PEDIDO */}
      {capaPedido && !loading && (
        <div id="documento-pedido-print" className="w-full">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 print:hidden"
            id="documento-pedido-web"
          >
          {/* BARRA DE AÇÕES SUPERIOR (Oculta na impressão) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-600 font-bold">
                Pedido <strong className="font-mono text-slate-900">{capaPedido.numeroPedido}</strong> carregado com sucesso
              </span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleNovaConsulta}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                id="btn-nova-consulta"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Nova Consulta</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
                id="btn-imprimir-a4"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Salvar A4</span>
              </button>
            </div>
          </div>

          {/* CAPA DO PEDIDO (CABEÇALHO MONUMENTAL) */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            
            {/* Linha 1: Marca Custom/CMPC + Número do Pedido + Status */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-150">
              <div className="flex items-center gap-4">
                {customLogoUrl ? (
                  <img 
                    src={customLogoUrl} 
                    alt="Logo Empresa" 
                    className="max-h-12 max-w-[180px] object-contain shrink-0" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <CompanyLogo height={38} className="shrink-0" />
                )}
                <div className="h-10 w-[1.5px] bg-slate-200 hidden md:block" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                    PEDIDO DE COMPRA SGI (BI & ALMOXARIFADO)
                  </span>
                  <h2 className="text-3xl md:text-5xl font-mono font-black tracking-tight text-slate-950">
                    {capaPedido.numeroPedido}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {capaPedido.status}
                </span>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  {capaPedido.totalItens} {capaPedido.totalItens === 1 ? 'Produto' : 'Produtos'}
                </span>
              </div>
            </div>

            {/* Linha 2: Metadados Estruturados da Capa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  Fornecedor Homologado
                </span>
                <p className="text-xs md:text-sm font-bold text-slate-900 line-clamp-2" title={capaPedido.fornecedor}>
                  {capaPedido.fornecedor}
                </p>
              </div>

              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  Comprador Responsável
                </span>
                <p className="text-xs md:text-sm font-bold text-slate-900 truncate">
                  {capaPedido.comprador}
                </p>
              </div>

              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Data de Emissão
                </span>
                <p className="text-xs md:text-sm font-mono font-bold text-slate-900">
                  {capaPedido.dataEmissao}
                </p>
              </div>

              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  Progresso Físico Global
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${capaPedido.percentualAtendido}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-black text-slate-900">
                    {capaPedido.percentualAtendido}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. CARDS DE ITENS AGRUPADOS (SHADOW BALANCE) */}
          <div className="space-y-6 print:space-y-4" id="lista-itens-agrupados">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                Itens e Balanço de Recebimento Físico ({produtosAgrupados.length})
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 print:hidden">
                Valores calculados em tempo real (Shadow Balance)
              </span>
            </div>

            {produtosAgrupados.map((item, idx) => {
              const cardState = cardInputs[item.key] || {
                nf: '',
                conferente: session?.nome || session?.user?.name || 'Almoxarife Logado',
                qtd: '',
                submitting: false
              };

              const isTotalmenteRecebido = item.saldoRealPendente <= 0;

              return (
                <div
                  key={item.key}
                  className="bg-white border-2 border-slate-200 hover:border-slate-300 rounded-3xl p-6 md:p-8 shadow-sm transition-all break-inside-avoid print:shadow-none print:border-slate-300 print:text-black print:p-6 print:rounded-2xl"
                  id={`item-card-${idx}`}
                >
                  {/* Topo do Item: Nome + Badges */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-slate-150">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-lg border border-slate-200">
                          CÓD: {item.codigo}
                        </span>
                        {item.comprador_real && (
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-150">
                            Comprador: {item.comprador_real}
                          </span>
                        )}
                        {item.valor_unitario > 0 && (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold rounded-lg border border-emerald-200">
                            Vl. Unit: R$ {item.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xl md:text-2xl font-black text-slate-950 leading-snug">
                        {item.produto_descricao}
                      </h4>
                    </div>

                    {isTotalmenteRecebido && (
                      <span className="px-3.5 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 self-start shrink-0 shadow-xs">
                        <CheckCircle className="w-4 h-4" />
                        100% Concluído
                      </span>
                    )}
                  </div>

                  {/* INDICADORES GIGANTES DE QUANTIDADE (O Chão de Fábrica) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
                    
                    {/* 1. QTD PEDIDA */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
                      <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider block">
                        📦 QTD PEDIDA
                      </span>
                      <div className="text-3xl md:text-4xl font-mono font-black text-slate-900">
                        {item.qtdPedida}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold block">
                        Total Solicitado no BI
                      </span>
                    </div>

                    {/* 2. JÁ RECEBIDO (ERP + PÁTIO) */}
                    <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-center space-y-1">
                      <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider block">
                        ✅ JÁ RECEBIDO
                      </span>
                      <div className="text-3xl md:text-4xl font-mono font-black text-emerald-600">
                        {item.totalJaRecebido}
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold block">
                        ERP: {item.qtdLancadaERP} | Pátio: {item.qtdRecebidaFisico}
                      </span>
                    </div>

                    {/* 3. SALDO REAL PENDENTE */}
                    <div className={`p-5 rounded-2xl border text-center space-y-1 ${
                      item.saldoRealPendente > 0 
                        ? 'bg-amber-50/60 border-amber-300' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <span className={`text-[11px] font-black uppercase tracking-wider block ${
                        item.saldoRealPendente > 0 ? 'text-amber-800' : 'text-slate-500'
                      }`}>
                        ⏳ SALDO REAL
                      </span>
                      <div className={`text-3xl md:text-4xl font-mono font-black ${
                        item.saldoRealPendente > 0 ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {item.saldoRealPendente}
                      </div>
                      <span className={`text-[10px] font-bold block ${
                        item.saldoRealPendente > 0 ? 'text-amber-700' : 'text-slate-400'
                      }`}>
                        {item.saldoRealPendente > 0 ? 'Pendente de Entrada' : 'Nenhuma Pendência'}
                      </span>
                    </div>
                  </div>

                  {/* 3. NOVO - BLOCO DE DESTINOS / RATEIO (SEMPRE VISÍVEL, SEM ACCORDION) */}
                  <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 my-6 space-y-3.5" id={`destinos-rateio-${idx}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-200/60">
                      <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <span className="text-base leading-none">📌</span>
                        <span>Destinos / Rateio (Siga a separação abaixo):</span>
                      </h5>
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100 self-start sm:self-auto">
                        {item.linhas_bi.length} {item.linhas_bi.length === 1 ? 'Destino / RM' : 'Destinos / RMs'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {item.linhas_bi.map((l, lIdx) => {
                        const qtdPedidaLinha = Number(l.quantidade_pedida ?? l.qtd_pedida ?? l.quantidade ?? 0);
                        const saldoReceberLinha = Number(l.saldo_a_receber !== undefined ? l.saldo_a_receber : (l.saldo_pendente !== undefined ? l.saldo_pendente : qtdPedidaLinha));
                        const ccName = l.centro_custo || 'Centro de Custo Geral / Obra Padrão';
                        const rmNum = l.solicitacao || l.rm || 'N/A';
                        const prevEntrega = l.previsao_entrega || l.data_emissao || '-';

                        return (
                          <div 
                            key={lIdx} 
                            className="flex items-center gap-3.5 p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all"
                          >
                            {/* 1. Bloco de Quantidade (Destaque Máximo) */}
                            <div className="flex flex-col items-center justify-center bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80 min-w-[85px] shrink-0 text-center">
                              <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider mb-0.5">
                                Qtd Pedida
                              </span>
                              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono leading-none tracking-tight">
                                {qtdPedidaLinha}
                              </span>
                            </div>

                            {/* 2. Informações do Destino (Obra / Centro de Custo) */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-start gap-1.5">
                                <Building className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                <span className="font-bold text-slate-800 text-xs sm:text-sm leading-tight line-clamp-2" title={ccName}>
                                  {ccName}
                                </span>
                              </div>

                              {/* 3. Badges de Identificação (RM e Falta) */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-indigo-600" />
                                  RM: {rmNum}
                                </span>

                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                  saldoReceberLinha > 0 
                                    ? 'bg-amber-50 border-amber-200 text-amber-800' 
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                }`}>
                                  {saldoReceberLinha > 0 ? (
                                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                                  )}
                                  Falta: {saldoReceberLinha}
                                </span>

                                {prevEntrega && prevEntrega !== '-' && (
                                  <span className="text-[10px] text-slate-400 font-medium ml-auto hidden sm:inline">
                                    Prev: {prevEntrega}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. FORMULÁRIO DE RECEBIMENTO FÍSICO NO RODAPÉ */}
                  {item.saldoRealPendente > 0 ? (
                    <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-5 space-y-4 print:hidden" id={`form-recebimento-${idx}`}>
                      <div className="flex items-center gap-2 text-amber-900">
                        <Receipt className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-black uppercase tracking-wider">
                          Sinalizar Recebimento Físico deste Item
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        {/* Campo NF */}
                        <div className="sm:col-span-3 space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                            Nota Fiscal (NF) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={cardState.nf}
                            onChange={(e) => handleCardInputChange(item.key, 'nf', e.target.value)}
                            placeholder="Ex: NF-123456"
                            className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs uppercase tracking-wider"
                          />
                        </div>

                        {/* Campo Conferente */}
                        <div className="sm:col-span-3 space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                            Conferente / Recebedor <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={cardState.conferente}
                            onChange={(e) => handleCardInputChange(item.key, 'conferente', e.target.value)}
                            className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-pointer"
                          >
                            <option value={session?.nome || session?.user?.name || 'Almoxarife Logado'}>
                              {session?.nome || session?.user?.name || 'Almoxarife Logado'} (Logado)
                            </option>
                            {PRE_REGISTERED_EMPLOYEES.map((emp, i) => (
                              <option key={i} value={emp.name}>
                                {emp.name} ({emp.cargo})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Campo Quantidade Gigante */}
                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block text-center">
                            Qtd Entrada <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={item.saldoRealPendente}
                            value={cardState.qtd !== undefined && cardState.qtd !== '' ? cardState.qtd : item.saldoRealPendente}
                            onChange={(e) => handleCardInputChange(item.key, 'qtd', e.target.value)}
                            className="w-full py-2.5 px-2 bg-white border-2 border-amber-400 focus:border-amber-600 rounded-xl text-xl font-mono font-black text-center text-slate-900 focus:outline-hidden shadow-inner"
                          />
                        </div>

                        {/* Grupo de Botões: Bypass Manual & Validação Biométrica */}
                        <div className="sm:col-span-4 flex flex-col sm:flex-row items-center gap-2">
                          {/* Botão Secundário: Bypass / Manual */}
                          <button
                            type="button"
                            disabled={cardState.submitting}
                            onClick={() => handleReceberManual(item)}
                            className="w-full sm:flex-1 py-3 px-3 bg-white hover:bg-slate-100 border border-slate-300 active:scale-98 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl shadow-2xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            id={`btn-receber-manual-${idx}`}
                            title="Concluir recebimento diretamente sem câmera"
                          >
                            <UserCheck className="w-4 h-4 text-slate-500" />
                            <span className="truncate">Manual</span>
                          </button>

                          {/* Botão Primário: Biometria */}
                          <button
                            type="button"
                            disabled={cardState.submitting}
                            onClick={() => handleReceberItem(item)}
                            className="w-full sm:flex-1 py-3 px-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            id={`btn-receber-item-${idx}`}
                            title="Validar e homologar com Reconhecimento Facial"
                          >
                            {cardState.submitting ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <ScanFace className="w-4 h-4 text-slate-900" />
                                <span className="truncate">Biometria</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full p-4 bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-sm md:text-base uppercase tracking-wider shadow-inner print:bg-emerald-50 print:text-emerald-900 print:border print:border-emerald-300">
                      <CheckCircle className="w-5 h-5 shrink-0" />
                      <span>100% Recebido Fisicamente no Almoxarifado</span>
                    </div>
                  )}

                  {/* 5. HISTÓRICO DE CHECK-INS FÍSICOS (SEMPRE VISÍVEL POR PADRÃO, TABELA MINIMALISTA) */}
                  {item.historicoFisico.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-150 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          Histórico de Lançamentos Físicos no Almoxarifado ({item.historicoFisico.length})
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">
                          Check-ins Registrados
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                          <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Data</th>
                              <th className="p-2.5">Nota Fiscal</th>
                              <th className="p-2.5">Conferente</th>
                              <th className="p-2.5 text-center">Qtd Recebida</th>
                              <th className="p-2.5 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white font-medium">
                            {item.historicoFisico.map((hist, hIdx) => (
                              <tr key={hIdx} className="hover:bg-slate-50/70 transition-colors">
                                <td className="p-2.5 font-mono text-slate-700">
                                  {hist.data_recebimento || (hist.data_entrada ? hist.data_entrada.split('T')[0] : '-')}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-slate-900">
                                  {hist.nota_fiscal || '-'}
                                </td>
                                <td className="p-2.5 text-slate-700">
                                  {hist.conferente || '-'}
                                </td>
                                <td className="p-2.5 text-center font-mono font-black text-emerald-600">
                                  +{hist.qtd_recebida} un
                                </td>
                                <td className="p-2.5 text-right">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                    hist.status_fisico === 'total' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {hist.status_fisico || 'parcial'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* B. VISUALIZAÇÃO EXCLUSIVA DE IMPRESSÃO (TABELA DE CONFERÊNCIA COMPACTA)   */}
        {/* ========================================================================= */}
        <div className="hidden print:block font-sans text-black space-y-2.5" id="tabela-conferencia-print">
          {/* 1. Cabeçalho da Folha de Impressão */}
          <div className="flex items-center justify-between pb-2 border-b-2 border-black">
            <div className="flex items-center gap-3">
              {customLogoUrl ? (
                <img 
                  src={customLogoUrl} 
                  alt="Logo Empresa" 
                  className="max-h-12 max-w-[180px] object-contain shrink-0 bg-slate-900 p-2 rounded-md" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="p-1 border border-slate-300 rounded bg-white shrink-0">
                  <CompanyLogo height={36} className="shrink-0" />
                </div>
              )}
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-black block leading-tight">
                  SISTEMA DE GESTÃO DE ALMOXARIFADO & RECEBIMENTO
                </span>
                <span className="text-[11px] font-bold text-slate-900 leading-tight block">
                  Espelho de Conferência de Entrada Física de Mercadorias
                </span>
              </div>
            </div>

            <div className="text-right space-y-0.5">
              <div className="text-lg font-black font-mono tracking-tight text-black leading-none">
                PEDIDO DE COMPRA: {capaPedido.numeroPedido}
              </div>
              <div className="text-[8.5px] font-mono text-slate-700">
                Data/Hora Impressão: {new Date().toLocaleString('pt-BR')}
              </div>
              <div className="text-[9px] font-black uppercase text-slate-900">
                Status: {capaPedido.status}
              </div>
            </div>
          </div>

          {/* 2. Dados da Capa (Em uma linha com borda fina) */}
          <div className="border border-black p-2 text-xs grid grid-cols-4 gap-2 bg-slate-50 text-black">
            <div className="truncate">
              <span className="font-bold text-[8.5px] uppercase text-slate-600 block leading-tight">Fornecedor:</span>
              <span className="font-bold text-[10.5px] truncate block" title={capaPedido.fornecedor}>
                {capaPedido.fornecedor}
              </span>
            </div>
            <div className="truncate">
              <span className="font-bold text-[8.5px] uppercase text-slate-600 block leading-tight">Comprador:</span>
              <span className="font-bold text-[10.5px] truncate block">
                {capaPedido.comprador}
              </span>
            </div>
            <div>
              <span className="font-bold text-[8.5px] uppercase text-slate-600 block leading-tight">Data de Emissão:</span>
              <span className="font-bold font-mono text-[10.5px] block">
                {capaPedido.dataEmissao}
              </span>
            </div>
            <div>
              <span className="font-bold text-[8.5px] uppercase text-slate-600 block leading-tight">Total de Itens:</span>
              <span className="font-bold text-[10.5px] block">
                {capaPedido.totalItens} itens ({capaPedido.percentualAtendido}% atendido)
              </span>
            </div>
          </div>

          {/* 3. A Tabela de Conferência (Compacta e Densa) */}
          <table className="table w-full text-[9.5px] border-collapse mt-2 border border-black">
            <thead className="bg-slate-200 border-b border-black font-black uppercase text-[8.5px] text-black">
              <tr>
                <th className="p-1 border border-black text-left w-14">CÓD.</th>
                <th className="p-1 border border-black text-left">DESCRIÇÃO DO ITEM</th>
                <th className="p-1 border border-black text-left w-44">DESTINO (CC / RM)</th>
                <th className="p-1 border border-black text-center w-14">QTD PEDIDA</th>
                <th className="p-1 border border-black text-center w-14">LANÇADO ERP</th>
                <th className="p-1 border border-black text-center w-14">RECEBIDO PÁTIO</th>
                <th className="p-1 border border-black text-center w-14">SALDO PENDENTE</th>
                <th className="p-1 border border-black text-center w-28">CONFERÊNCIA FÍSICA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-medium text-black">
              {produtosAgrupados.flatMap((item, pIdx) => {
                const rateios = item.linhas_bi && item.linhas_bi.length > 0 ? item.linhas_bi : [null];

                return rateios.map((linha, lIdx) => {
                  const isMultipleRateios = rateios.length > 1;
                  const qtdPedidaLinha = linha 
                    ? Number(linha.quantidade_pedida ?? linha.qtd_pedida ?? linha.quantidade ?? (item.qtdPedida / rateios.length))
                    : item.qtdPedida;

                  const saldoERPLinha = linha
                    ? Number(linha.saldo_a_receber !== undefined ? linha.saldo_a_receber : (linha.saldo_pendente !== undefined ? linha.saldo_pendente : Math.max(0, qtdPedidaLinha - (item.qtdLancadaERP / rateios.length))))
                    : item.saldoERP;

                  const lancadoERPLinha = Math.max(0, qtdPedidaLinha - saldoERPLinha);
                  const recebidoPatioLinha = lIdx === 0 ? item.qtdRecebidaFisico : 0;
                  const saldoPendenteLinha = Math.max(0, saldoERPLinha - recebidoPatioLinha);

                  const centroCusto = linha?.centro_custo || item.centros_custo?.[lIdx] || item.centros_custo?.[0] || 'Almoxarifado Central';
                  const solicitacaoRM = linha?.solicitacao || item.solicitacoes?.[lIdx] || item.solicitacoes?.[0] || '';

                  return (
                    <tr 
                      key={`${item.key}-rateio-${lIdx}`} 
                      className="print:break-inside-avoid print:nth-child(even):bg-gray-100 border-b border-black align-middle"
                    >
                      <td className="p-1 border border-black font-mono text-[9px]">
                        {item.codigo || '-'}
                      </td>
                      <td className="p-1 border border-black font-bold text-[9.5px]">
                        <div className="leading-tight">{item.produto_descricao}</div>
                        {isMultipleRateios && (
                          <div className="text-[8px] font-mono text-slate-600 font-normal">
                            Rateio {lIdx + 1} de {rateios.length}
                          </div>
                        )}
                      </td>
                      <td className="p-1 border border-black text-[9px]">
                        <span className="font-semibold">{centroCusto}</span>
                        {solicitacaoRM && solicitacaoRM !== '-' && (
                          <span className="text-[8.5px] text-slate-700 block font-mono">
                            RM: {solicitacaoRM}
                          </span>
                        )}
                      </td>
                      <td className="p-1 border border-black text-center font-mono font-bold">
                        {qtdPedidaLinha}
                      </td>
                      <td className="p-1 border border-black text-center font-mono">
                        {lancadoERPLinha}
                      </td>
                      <td className="p-1 border border-black text-center font-mono font-bold text-slate-800">
                        {recebidoPatioLinha > 0 ? `${recebidoPatioLinha}` : '-'}
                      </td>
                      <td className="p-1 border border-black text-center font-mono font-black text-black">
                        {saldoPendenteLinha}
                      </td>
                      <td className="p-1 border border-black text-center">
                        <div className="flex items-center justify-center gap-1.5 font-mono text-[9px]">
                          <span>[ &nbsp; ]</span>
                          <span className="text-[8px]">Qtd: _______</span>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>

          {/* 4. Rodapé de Auditoria e Assinaturas (Compacto na mesma folha) */}
          <div className="pt-6 border-t-2 border-black text-xs space-y-3 print:break-inside-avoid" id="bloco-assinatura-a4">
            <div className="grid grid-cols-3 gap-6">
              <div className="border-t border-black pt-1 text-center space-y-0.5">
                <p className="font-bold text-[10px] text-black">Almoxarife / Recebedor</p>
                <p className="text-[8px] text-slate-600">Assinatura & Matrícula</p>
              </div>
              <div className="border-t border-black pt-1 text-center space-y-0.5">
                <p className="font-bold text-[10px] text-black">Data & Hora da Conferência</p>
                <p className="text-[8px] text-slate-600 font-mono">____/____/________ às ____:____</p>
              </div>
              <div className="border-t border-black pt-1 text-center space-y-0.5">
                <p className="font-bold text-[10px] text-black">Visto da Portaria / Fiscal</p>
                <p className="text-[8px] text-slate-600">Conferência Física CMPC</p>
              </div>
            </div>
            <p className="text-[8px] text-slate-500 text-center uppercase tracking-widest font-mono">
              DOCUMENTO OFICIAL SGI • CMPC INDUSTRIAL • SISTEMA DE CONTROLE DE ENTRADA FÍSICA
            </p>
          </div>
        </div>
      </div>
      )}

      {/* MODAL DE SUCESSO APÓS RECEBIMENTO */}
      <AnimatePresence>
        {successModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl border border-slate-150"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  Recebimento Registrado!
                </h3>
                <p className="text-sm text-slate-600">
                  Foram registradas com sucesso <strong className="font-mono text-emerald-600 font-black text-base">{successModal.quantity} unidades</strong> de:
                </p>
                <p className="text-xs font-bold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {successModal.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSuccessModal({ isOpen: false, quantity: 0, description: '' })}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition"
                id="btn-fechar-modal-sucesso"
              >
                Continuar Conferência
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE VALIDAÇÃO BIOMÉTRICA FACIAL (OPCIONAL/HOMOLOGAÇÃO) */}
      <FaceValidationModal
        isOpen={isFaceModalOpen}
        onClose={() => {
          setIsFaceModalOpen(false);
          setPendingRecebimento(null);
        }}
        onSuccess={executarSalvamentoOficial}
        title="Autenticação Biométrica de Recebimento"
        subtitle="Posicione seu rosto e pisque os olhos para homologar a entrada física"
        actionLabel="Homologar Recebimento"
        orderNumber={capaPedido?.numeroPedido || pedidoAtual}
        itemDescription={pendingRecebimento?.item ? `${pendingRecebimento.item.produto_descricao} (${pendingRecebimento.inputQtd} un)` : undefined}
      />

    </div>
  );
}
