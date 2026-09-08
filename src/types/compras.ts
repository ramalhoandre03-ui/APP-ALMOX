/**
 * Tipagens e Modelos de Dados para o Módulo de Monitoramento e Rastreio de Pedidos de Compra (Supabase BI)
 * Suporta estrutura Mestre-Detalhe (Documento de Pedido de Compra, Itens Consolidados e Rateio de Custos).
 */

export interface PedidoCompraBI {
  id?: string | number;
  pedido: string; // Número do Pedido de Compra (PC)
  solicitacao: string; // Número da RM / Solicitação
  comprador_real?: string; // Nome do Comprador
  fornecedor: string; // Fornecedor / Razão Social
  produto_descricao: string; // Descrição do Produto / Item
  quantidade_pedida: number; // Quantidade total autorizada
  saldo_a_receber: number; // O que ainda falta entregar (saldo pendente)
  valor_unitario: number; // Valor Unitário em R$
  valor_total: number; // Valor Total da linha em R$
  status_pedido: string; // Status da compra (ex: PEDIDO ATENDIDO, EM APROVAÇÃO, etc.)
  data_emissao?: string; // Data de emissão do pedido
  previsao_entrega: string; // Data de previsão de entrega
  centro_custo: string; // Centro de Custo / Obra (ex: ALU CALC 2 SLZ 04-26)
  atualizado_em?: string; // Timestamp de sincronização
  quantidade?: number | string; // Campo legado para compatibilidade
}

export interface PedidoRateioDestino {
  rawId?: string | number;
  solicitacao: string; // Número da RM
  centro_custo: string; // Obra / Centro de Custo de destino
  quantidade_pedida: number; // Quantidade solicitada nessa fração/RM
  saldo_a_receber: number; // Saldo pendente nessa fração
  qtd_recebida: number; // Quantidade já recebida (calculada)
  valor_total_rateio: number; // Valor proporcional deste rateio
  produto_descricao: string; // Produto do rateio
  previsao_entrega?: string; // Data de entrega desta linha
  status_linha?: string; // Status da linha
}

export interface ItemProdutoConsolidado {
  id_produto: string; // Chave do produto (normalizado)
  produto_descricao: string; // Descrição completa do produto
  quantidade_pedida_total: number; // Soma de quantidade_pedida
  saldo_a_receber_total: number; // Soma de saldo_a_receber
  qtd_recebida_total: number; // Calculado: quantidade_pedida_total - saldo_a_receber_total
  percentual_atendido: number; // 0 - 100%
  valor_unitario_medio: number; // Valor unitário de referência
  valor_total_produto: number; // Soma do valor total deste item
  previsoes: string[]; // Lista de previsões de entrega
  previsao_mais_recente: string; // Data mais recente
  status_item: 'TOTALMENTE ENTREGUE' | 'PARCIALMENTE ENTREGUE' | 'PENDENTE';
  rateios: PedidoRateioDestino[]; // Linhas originais que compõem este produto
}

export interface PedidoCompraDocumento {
  pedido: string; // Chave primária de agrupamento (Número do Pedido de Compra)
  status_pedido: string; // Status geral consolidado do pedido
  data_emissao: string; // Data de emissão consolidada
  comprador_real: string; // Nome do comprador responsável
  fornecedor: string; // Nome do Fornecedor / Empresa
  valor_liquido_total: number; // Soma do valor_total de todas as linhas do pedido
  quantidade_total_pedida: number; // Soma de todas as quantidades autorizadas
  saldo_total_a_receber: number; // Soma de todos os saldos a receber pendentes
  quantidade_total_recebida: number; // Soma das quantidades já atendidas
  percentual_geral_atendido: number; // 0 - 100% do pedido concluído
  previsao_entrega_destaque: string; // Data de previsão de entrega principal
  itens: ItemProdutoConsolidado[]; // Relação de Produtos Consolidados
  rateios_gerais: PedidoRateioDestino[]; // Detalhamento de todos os rateios (Múltiplos Destinos)
  centros_custo_unicos: string[]; // Lista de todos os Centros de Custo envolvidos
  rms_unicas: string[]; // Lista de todas as RMs envolvidas no pedido
  total_itens_distintos: number; // Quantidade de produtos diferentes
  linhas_originais_count: number; // Total de linhas no banco Supabase
  atualizado_em?: string; // Timestamp de sincronização mais recente
}

export interface ForecastStatusInfo {
  key: string;
  label: string;
  bgStyle: string;
  dotStyle: string;
}

export interface RecebimentoItemSupabase {
  id?: string;
  numero_pc: string; // Número do Pedido de Compra
  fornecedor: string; // Razão Social do Fornecedor
  centro_custo: string; // Centro de Custo / Obra
  classes_financeiras?: string[]; // Classes / Categorias
  nota_fiscal: string; // Número da Nota Fiscal (NF)
  codigo_item?: string; // Código do Produto no ERP
  descricao_item: string; // Descrição do Produto
  qtd_pedida: number; // Quantidade original autorizada
  qtd_recebida: number; // Quantidade recebida nesta entrada física
  saldo_pendente: number; // Saldo que resta a entregar
  status_fisico: 'total' | 'parcial' | 'reagendar' | 'recusar' | 'cancelado' | string;
  conferente: string; // Nome do Almoxarife conferente
  data_entrada: string; // Timestamp ISO de inserção
  data_recebimento?: string; // Data da NF/Recebimento (YYYY-MM-DD)
  comprador_real?: string; // Comprador extraído do BI
  valor_unitario?: number; // Valor Unitário em R$
  valor_total_item?: number; // Valor total do lote recebido (valor_unitario * qtd_recebida)
  motivo_recusa?: string;
  motivo_cancelamento?: string;
  observacao?: string;
  observacoes?: string;
  justificativa?: string;
  created_at?: string;
  updated_at?: string;
}

