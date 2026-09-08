/**
 * Fonte Única da Verdade (Single Source of Truth - SSOT) para todos os Módulos do HUB
 * 
 * Regra de Negócio:
 * - A lista de módulos é imutável no código.
 * - Novos módulos cadastrados aqui nascem com status BLOQUEADO por padrão (Default Deny)
 *   para todos os perfis, exceto ADMINISTRADOR.
 * - O Painel Admin e o Hub consomem diretamente esta lista.
 */

export interface PermissaoModuloConfig {
  id: string; // ID correspondente exatamente ao nome da coluna booleana no banco
  columnName: string; // Nome da coluna no Supabase
  titulo: string;
  descricao?: string;
  badge?: string;
}

export type ModuloPermissaoConfig = PermissaoModuloConfig;

export const MODULOS_PERMISSOES_HUB: PermissaoModuloConfig[] = [
  {
    id: 'acesso_checklist',
    columnName: 'acesso_checklist',
    titulo: 'Check List & Inspeções',
    descricao: 'Gestão analítica de inspeções diárias, laudos e conformidade',
    badge: 'QUALIDADE'
  },
  {
    id: 'acesso_fluxo_oficina',
    columnName: 'acesso_fluxo_oficina',
    titulo: 'Fluxo de Oficina Central',
    descricao: 'Ciclo operacional de inspeção e manutenção de equipamentos',
    badge: 'OPERACIONAL'
  },
  {
    id: 'acesso_mobilizacao',
    columnName: 'acesso_mobilizacao',
    titulo: 'Mobilização & Oficina',
    descricao: 'Painel unificado de Headcount, Power BI e fluxos de ativos',
    badge: 'BI & GESTÃO'
  },
  {
    id: 'acesso_horas',
    columnName: 'acesso_horas',
    titulo: 'Previsão de Horas',
    descricao: 'Solicitação e controle analítico de horas extras (SGI-0242)',
    badge: 'SGI'
  },
  {
    id: 'acesso_inventario',
    columnName: 'acesso_inventario',
    titulo: 'Portal de Inventário',
    descricao: 'Inventários SGI Gerais/Parciais e apurações fiscais',
    badge: 'SGI FISCAL'
  },
  {
    id: 'acesso_requisicoes',
    columnName: 'acesso_requisicoes',
    titulo: 'Atendimento de Requisições',
    descricao: 'Tratamento de RMs e indicadores de atendimento de obra',
    badge: 'LOGÍSTICA'
  },
  {
    id: 'acesso_munck',
    columnName: 'acesso_munck',
    titulo: 'Agendamento Munck/PickUp',
    descricao: 'Agendamento e controle de prontidão da frota Munck',
    badge: 'FROTA INTERNA'
  },
  {
    id: 'acesso_consulta_pedido',
    columnName: 'acesso_consulta_pedido',
    titulo: 'Consulta de Pedido de Compra',
    descricao: 'Rastreio de pedidos de compra integrados via Approvo',
    badge: 'COMPRAS'
  },
  {
    id: 'acesso_rastreio_rm',
    columnName: 'acesso_rastreio_rm',
    titulo: "Rastreio de RM's com Pedidos de Compra",
    descricao: 'Rastreamento em tempo real do status das RMs via robô RPA',
    badge: 'RPA BI'
  },
  {
    id: 'acesso_expedicao',
    columnName: 'acesso_expedicao',
    titulo: 'Gestão de Expedição',
    descricao: 'Transição e baixa de materiais separados para obras',
    badge: 'EXPEDIÇÃO'
  },
  {
    id: 'acesso_devolucao_ativos',
    columnName: 'acesso_devolucao_ativos',
    titulo: 'Devolução de Ativos Locados',
    descricao: 'Rastreamento e logística reversa de equipamentos locados',
    badge: 'LOGÍSTICA'
  },
  {
    id: 'acesso_fardamento',
    columnName: 'acesso_fardamento',
    titulo: 'Central de Fardamento & Admissões',
    descricao: 'Gestão de kits de EPIs, fardamentos e triagem de admissão',
    badge: 'RH & ALMOXARIFADO'
  },
  {
    id: 'acesso_oficina',
    columnName: 'acesso_oficina',
    titulo: 'Oficina Elétrica',
    descricao: 'Planejamento e controle de demandas da manutenção elétrica',
    badge: 'ELÉTRICA'
  },
  {
    id: 'acesso_kpi',
    columnName: 'acesso_kpi',
    titulo: "Cockpit Gerencial de KPI's",
    descricao: 'Gestão de Desmobilização, Rádios e Parada Geral 2026',
    badge: 'PARADA 2026'
  },
  {
    id: 'acesso_medicao',
    columnName: 'acesso_medicao',
    titulo: 'MEDIÇÃO DE PRÓPRIOS',
    descricao: 'Controle e cálculo de custo de locação de ferramentas',
    badge: 'LOCAÇÕES'
  },
  {
    id: 'acesso_biometria',
    columnName: 'acesso_biometria',
    titulo: 'Onboarding de Biometria Facial',
    descricao: 'Cadastro e validação biométrica com rede neural IA',
    badge: 'REDE NEURAL'
  }
];

export const HUB_MODULES_OFICIAIS = [
  { id: 'acesso_checklist', columnName: 'acesso_checklist', titulo: 'Check List & Inspeções' },
  { id: 'acesso_fluxo_oficina', columnName: 'acesso_fluxo_oficina', titulo: 'Fluxo de Oficina Central' },
  { id: 'acesso_mobilizacao', columnName: 'acesso_mobilizacao', titulo: 'Mobilização & Oficina' },
  { id: 'acesso_horas', columnName: 'acesso_horas', titulo: 'Previsão de Horas' },
  { id: 'acesso_inventario', columnName: 'acesso_inventario', titulo: 'Portal de Inventário' },
  { id: 'acesso_requisicoes', columnName: 'acesso_requisicoes', titulo: 'Atendimento de Requisições' },
  { id: 'acesso_munck', columnName: 'acesso_munck', titulo: 'Agendamento Munck/PickUp' },
  { id: 'acesso_consulta_pedido', columnName: 'acesso_consulta_pedido', titulo: 'Consulta de Pedido de Compra' },
  { id: 'acesso_rastreio_rm', columnName: 'acesso_rastreio_rm', titulo: "Rastreio de RM's com Pedidos de Compra" },
  { id: 'acesso_expedicao', columnName: 'acesso_expedicao', titulo: 'Gestão de Expedição' },
  { id: 'acesso_devolucao_ativos', columnName: 'acesso_devolucao_ativos', titulo: 'Devolução de Ativos Locados' },
  { id: 'acesso_fardamento', columnName: 'acesso_fardamento', titulo: 'Central de Fardamento & Admissões' },
  { id: 'acesso_oficina', columnName: 'acesso_oficina', titulo: 'Oficina Elétrica' },
  { id: 'acesso_kpi', columnName: 'acesso_kpi', titulo: "Cockpit Gerencial de KPI's" },
  { id: 'acesso_medicao', columnName: 'acesso_medicao', titulo: 'MEDIÇÃO DE PRÓPRIOS' },
  { id: 'acesso_biometria', columnName: 'acesso_biometria', titulo: 'Onboarding de Biometria Facial' }
];

export interface HubModule {
  id: string;
  titulo: string;
  descricao: string;
  iconName: 'Activity' | 'BarChart3' | 'FileText' | 'ClipboardList' | 'ClipboardCheck' | 'FileSpreadsheet' | 'Truck' | 'Search' | 'PackageSearch' | 'Shirt' | 'Zap' | 'Settings' | 'Calculator' | 'ShieldAlert' | 'Boxes' | 'Layers' | 'Fingerprint';
  badge: string;
  path: string;
  appKey: 'CHECKLIST' | 'fluxo-oficina' | 'mobilizacao-bi' | 'previsao-he' | 'portal-inventario' | 'atendimento-requisicoes' | 'agendamento-munck' | 'consulta-pedidos' | 'monitor-compras' | 'gestao-expedicao' | 'devolucao-ativos' | 'central-fardamento' | 'oficina-eletrica' | 'overhaul-2026' | 'medicao-proprios' | 'biometria-facial' | 'admin';
  chaveAcesso: string; // Chave de bind com a coluna da tabela permissoes_hub
  themeColor: 'indigo' | 'purple' | 'sky' | 'amber' | 'violet' | 'emerald';
  quickInfoLabel: string;
  quickInfoValue: string;
  categoria?: 'Operacional' | 'Logística' | 'Gestão & BI' | 'Administrativo';
  colunaLegada?: string; // Mapeamento retrocompatível para colunas booleanas em permissoes_hub
}

export const HUB_MODULES: HubModule[] = [
  {
    id: 'CHECKLIST',
    titulo: 'Check List & Inspeções',
    descricao: 'Gestão analítica de inspeções diárias de equipamentos, registro de avarias, laudos técnicos e histórico de conformidade.',
    iconName: 'ClipboardCheck',
    badge: 'QUALIDADE & MANUTENÇÃO',
    path: '/app/checklist',
    appKey: 'CHECKLIST',
    chaveAcesso: 'acesso_checklist',
    themeColor: 'amber',
    quickInfoLabel: 'Conformidade:',
    quickInfoValue: 'Inspeções Ativas',
    categoria: 'Operacional',
    colunaLegada: 'acesso_checklist'
  },
  {
    id: 'fluxo-oficina',
    titulo: 'Fluxo de Oficina Central',
    descricao: 'Gestão operacional do ciclo de vida de equipamentos enviados para inspeção na oficina.',
    iconName: 'Activity',
    badge: 'Alumar',
    path: '/app/fluxo-oficina',
    appKey: 'fluxo-oficina',
    chaveAcesso: 'acesso_fluxo_oficina',
    themeColor: 'indigo',
    quickInfoLabel: 'Inspeção & Laudos:',
    quickInfoValue: 'Oficina Central Ativa',
    categoria: 'Operacional',
    colunaLegada: 'acesso_fluxo_oficina'
  },
  {
    id: 'mobilizacao-bi',
    titulo: 'Mobilização & Oficina',
    descricao: 'Painel unificado para monitoração de Headcount e gestão analítica da Oficina Central, contendo status de Requisições, relatórios fotográficos e fluxos de ativos.',
    iconName: 'BarChart3',
    badge: 'Power BI',
    path: '/app/mobilizacao-bi',
    appKey: 'mobilizacao-bi',
    chaveAcesso: 'acesso_mobilizacao',
    themeColor: 'purple',
    quickInfoLabel: 'Indicadores:',
    quickInfoValue: 'BI & Painel Integrados',
    categoria: 'Gestão & BI',
    colunaLegada: 'acesso_mobilizacao'
  },
  {
    id: 'previsao-he',
    titulo: 'Previsão de Horas',
    descricao: 'Formulário e controle analítico de solicitação de horas extraordinárias de colaboradores, com preenchimento, rascunhos e exportação para impressão.',
    iconName: 'FileText',
    badge: 'PIN Restrito',
    path: '/app/previsao-he',
    appKey: 'previsao-he',
    chaveAcesso: 'acesso_horas',
    themeColor: 'purple',
    quickInfoLabel: 'Estratégico:',
    quickInfoValue: 'SGI-0242',
    categoria: 'Administrativo',
    colunaLegada: 'acesso_horas'
  },
  {
    id: 'portal-inventario',
    titulo: 'Portal de Inventário',
    descricao: 'Módulo completo sob norma SGI para inventários Gerais e Parciais, tratamento automatizado de re-contagens, apurações consolidadas e relatórios assinados corporativamente.',
    iconName: 'ClipboardList',
    badge: 'CMPC-PRO-0093',
    path: '/app/inventarios',
    appKey: 'portal-inventario',
    chaveAcesso: 'acesso_inventario',
    themeColor: 'purple',
    quickInfoLabel: 'Auditorias Fiscal:',
    quickInfoValue: 'SGI-0243/0244',
    categoria: 'Operacional',
    colunaLegada: 'acesso_inventario'
  },
  {
    id: 'atendimento-requisicoes',
    titulo: 'Atendimento de Requisições',
    descricao: 'Portal de gestão de tratamento de RM com alimentação periódica. Painel gerencial com indicadores de tempo de atendimento por obra e por almoxarife.',
    iconName: 'FileSpreadsheet',
    badge: 'Integração via API APPROVO',
    path: '/app/atendimento-requisicoes',
    appKey: 'atendimento-requisicoes',
    chaveAcesso: 'acesso_requisicoes',
    themeColor: 'indigo',
    quickInfoLabel: 'Ferramenta de Atendimento:',
    quickInfoValue: 'RMs EM TRATAMENTO',
    categoria: 'Operacional',
    colunaLegada: 'acesso_requisicoes'
  },
  {
    id: 'agendamento-munck',
    titulo: 'Agendamento Munck/PickUp',
    descricao: 'Portal para solicitação e agendamento de içamento/movimentação com o caminhão Munck da CMPC, incluindo controle de prontidão da frota.',
    iconName: 'Truck',
    badge: 'FROTA INTERNA',
    path: '/app/agendamento-munck',
    appKey: 'agendamento-munck',
    chaveAcesso: 'acesso_munck',
    themeColor: 'sky',
    quickInfoLabel: 'Status:',
    quickInfoValue: 'Frota Operante',
    categoria: 'Logística',
    colunaLegada: 'acesso_munck'
  },
  {
    id: 'consulta-pedidos',
    titulo: 'Consulta de Pedido de Compra',
    descricao: 'Módulo para rastreio, consulta de status e extração de dados de pedidos de compra (POs) integrados ao Approvo via Scraper.',
    iconName: 'Search',
    badge: 'Integração Approvo',
    path: '/app/consulta-pedidos',
    appKey: 'consulta-pedidos',
    chaveAcesso: 'acesso_consulta_pedido',
    themeColor: 'amber',
    quickInfoLabel: 'Modo de Operação:',
    quickInfoValue: 'Extração Online',
    categoria: 'Operacional',
    colunaLegada: 'acesso_consulta_pedido'
  },
  {
    id: 'monitor-compras',
    titulo: "Rastreio de RM's com Pedidos de Compra",
    descricao: 'Rastreamento em tempo real do status das RMs e pedidos de compra diretamente da tabela sincronizada pelo robô RPA.',
    iconName: 'PackageSearch',
    badge: 'RPA Supabase',
    path: '/app/monitor-compras',
    appKey: 'monitor-compras',
    chaveAcesso: 'acesso_rastreio_rm',
    themeColor: 'amber',
    quickInfoLabel: 'Tabela ERP:',
    quickInfoValue: 'pedidos_compras_bi',
    categoria: 'Gestão & BI',
    colunaLegada: 'acesso_rastreio_rm'
  },
  {
    id: 'gestao-expedicao',
    titulo: 'Gestão de Expedição',
    descricao: 'Área de transição e baixa manual de materiais separados (RMs de Estoque e Compras Diretas) aguardando envio/retirada para as obras.',
    iconName: 'Truck',
    badge: 'Aguardando Retirada',
    path: '/app/gestao-expedicao',
    appKey: 'gestao-expedicao',
    chaveAcesso: 'acesso_expedicao',
    themeColor: 'amber',
    quickInfoLabel: 'Fluxo de Carga:',
    quickInfoValue: 'Consolidado RMs + Pedidos',
    categoria: 'Logística',
    colunaLegada: 'acesso_expedicao'
  },
  {
    id: 'devolucao-ativos',
    titulo: 'Devolução de Ativos Locados',
    descricao: 'Módulo de rastreamento e logística reversa de equipamentos locados, monitorando as 5 etapas da transportadora até o destino.',
    iconName: 'Truck',
    badge: 'Global Cargo Express',
    path: '/app/devolucao-ativos',
    appKey: 'devolucao-ativos',
    chaveAcesso: 'acesso_devolucao_ativos',
    themeColor: 'violet',
    quickInfoLabel: 'Transporte Integrado:',
    quickInfoValue: 'Tracking SGI Ativo',
    categoria: 'Logística',
    colunaLegada: 'acesso_devolucao_ativos'
  },
  {
    id: 'central-fardamento',
    titulo: 'Central de Fardamento & Admissões',
    descricao: 'Gestão unificada de fardamento e EPIs para admissões. Elimine requisições por e-mail com geração automática de kits inteligentes e triagem no almoxarifado.',
    iconName: 'Shirt',
    badge: 'RH E ALMOXARIFADO',
    path: '/app/central-fardamento',
    appKey: 'central-fardamento',
    chaveAcesso: 'acesso_fardamento',
    themeColor: 'indigo',
    quickInfoLabel: 'Controle de Estoque:',
    quickInfoValue: 'KITS PADRONIZADOS SGI',
    categoria: 'Administrativo',
    colunaLegada: 'acesso_fardamento'
  },
  {
    id: 'oficina-eletrica',
    titulo: 'Oficina Elétrica',
    descricao: 'Planejamento e controle de demandas da manutenção elétrica. Gestão unificada de demandas semanais e avulsas com painel Kanban e aplicativo integrado para o executor.',
    iconName: 'Zap',
    badge: 'MANUTENÇÃO ELÉTRICA',
    path: '/app/oficina-eletrica',
    appKey: 'oficina-eletrica',
    chaveAcesso: 'acesso_oficina',
    themeColor: 'amber',
    quickInfoLabel: 'Indicadores de OS:',
    quickInfoValue: 'Nuvem Sincronizada Ativa',
    categoria: 'Operacional',
    colunaLegada: 'acesso_oficina'
  },
  {
    id: 'overhaul-2026',
    titulo: "Cockpit Gerencial de KPI's",
    descricao: 'Gestão centralizada de Desmobilização, Rádios e Fardamentos da Parada Geral 2026.',
    iconName: 'Settings',
    badge: 'PARADA GERAL 2026',
    path: '/app/overhaul-2026',
    appKey: 'overhaul-2026',
    chaveAcesso: 'acesso_kpi',
    themeColor: 'violet',
    quickInfoLabel: 'Módulos de Controle:',
    quickInfoValue: '3 áreas integradas',
    categoria: 'Gestão & BI',
    colunaLegada: 'acesso_kpi'
  },
  {
    id: 'medicao-proprios',
    titulo: 'MEDIÇÃO DE PRÓPRIOS',
    descricao: 'Controle e cálculo de custo de locação de ferramentas e equipamentos alocados em obras com base em mobilizações e desmobilizações.',
    iconName: 'Calculator',
    badge: 'GESTÃO DE LOCAÇÕES',
    path: '/app/medicao-proprios',
    appKey: 'medicao-proprios',
    chaveAcesso: 'acesso_medicao',
    themeColor: 'amber',
    quickInfoLabel: 'Cálculo de Diárias:',
    quickInfoValue: 'Intersecção Mensal',
    categoria: 'Gestão & BI',
    colunaLegada: 'acesso_medicao'
  },
  {
    id: 'biometria-facial',
    titulo: 'Onboarding de Biometria Facial',
    descricao: 'Cadastro e validação biométrica facial com IA (face-api.js) e redes neurais para autenticação de operadores e almoxarifes.',
    iconName: 'Fingerprint',
    badge: 'REDE NEURAL IA',
    path: '/app/biometria-facial',
    appKey: 'biometria-facial',
    chaveAcesso: 'acesso_biometria',
    themeColor: 'emerald',
    quickInfoLabel: 'Tecnologia:',
    quickInfoValue: 'Vetor 128-D / Supabase',
    categoria: 'Administrativo',
    colunaLegada: 'acesso_biometria'
  },
  {
    id: 'admin',
    titulo: 'Acesso Total - Painel Admin',
    descricao: 'Painel administrativo para gestão de usuários, controle de permissões por perfil (RBAC), auditoria e configurações.',
    iconName: 'ShieldAlert',
    badge: 'SISTEMA',
    path: '/admin',
    appKey: 'admin',
    chaveAcesso: 'acesso_admin',
    themeColor: 'purple',
    quickInfoLabel: 'Nível de Acesso:',
    quickInfoValue: 'Administrador Master',
    categoria: 'Administrativo',
    colunaLegada: 'acesso_admin'
  }
];

/**
 * Função utilitária para verificar se um determinado perfil possui permissão para um módulo
 * 
 * Regra: DEFAULT DENY
 * - Administradores têm permissão irrestrita (true)
 * - Outros perfis dependem de permissão explícita (true) registrada em permissoes_hub
 */
export function verificarPermissaoModulo(
  perfilUsuario: string | null | undefined,
  moduloId: string,
  permissoesDoPerfilRow?: any
): boolean {
  if (!perfilUsuario) return false;

  const perfilNorm = perfilUsuario.trim().toLowerCase();
  if (perfilNorm === 'administrador' || perfilNorm === 'admin' || perfilNorm === 'admin master') {
    return true;
  }

  if (!permissoesDoPerfilRow) {
    // Fallbacks operacionais padrão se a linha do banco ainda estiver carregando ou offline
    if (perfilNorm === 'almoxarifado' || perfilNorm === 'almoxarife') {
      const almoxarifadoAllowed = [
        'fluxo-oficina',
        'mobilizacao-bi',
        'portal-inventario',
        'atendimento-requisicoes',
        'agendamento-munck',
        'consulta-pedidos',
        'monitor-compras',
        'gestao-expedicao',
        'devolucao-ativos',
        'central-fardamento',
        'overhaul-2026',
        'medicao-proprios'
      ];
      return almoxarifadoAllowed.includes(moduloId);
    }
    if (perfilNorm === 'rh') {
      return moduloId === 'central-fardamento' || moduloId === 'previsao-he';
    }
    if (perfilNorm === 'eletricista') {
      return moduloId === 'oficina-eletrica';
    }
    if (perfilNorm === 'operador/motorista' || perfilNorm === 'motorista' || perfilNorm === 'operador') {
      return moduloId === 'agendamento-munck';
    }
    if (perfilNorm === 'operação' || perfilNorm === 'operacao') {
      const operacaoAllowed = [
        'atendimento-requisicoes',
        'agendamento-munck',
        'consulta-pedidos',
        'fluxo-oficina'
      ];
      return operacaoAllowed.includes(moduloId);
    }
    return false;
  }

  // 1. Verifica por coluna direta com nome do ID do módulo ou chave de acesso
  if (permissoesDoPerfilRow[moduloId] !== undefined && permissoesDoPerfilRow[moduloId] !== null) {
    return !!permissoesDoPerfilRow[moduloId];
  }

  // 2. Mapeamento explícito de todos os IDs de rotas/apps do HUB para as 16 colunas flat oficiais da tabela permissoes_hub
  const MODULE_TO_FLAT_COLUMN: Record<string, string> = {
    // 1. Check List & Inspeções -> acesso_checklist
    'CHECKLIST': 'acesso_checklist',
    'checklist': 'acesso_checklist',
    'acesso_checklist': 'acesso_checklist',

    // 2. Fluxo de Oficina Central -> acesso_fluxo_oficina
    'fluxo-oficina': 'acesso_fluxo_oficina',
    'fluxo_oficina': 'acesso_fluxo_oficina',
    'oficina_central': 'acesso_fluxo_oficina',
    'acesso_fluxo_oficina': 'acesso_fluxo_oficina',

    // 3. Mobilização & Oficina -> acesso_mobilizacao
    'mobilizacao-bi': 'acesso_mobilizacao',
    'mobilizacao_oficina': 'acesso_mobilizacao',
    'mobilizacao_bi': 'acesso_mobilizacao',
    'abastecimento': 'acesso_mobilizacao',
    'acesso_mobilizacao': 'acesso_mobilizacao',
    'acesso_efetivo': 'acesso_mobilizacao',

    // 4. Previsão de Horas -> acesso_horas
    'previsao-he': 'acesso_horas',
    'previsao_horas': 'acesso_horas',
    'acesso_horas': 'acesso_horas',

    // 5. Portal de Inventário -> acesso_inventario
    'portal-inventario': 'acesso_inventario',
    'portal_inventario': 'acesso_inventario',
    'inventarios': 'acesso_inventario',
    'acesso_inventario': 'acesso_inventario',

    // 6. Atendimento de Requisições -> acesso_requisicoes
    'atendimento-requisicoes': 'acesso_requisicoes',
    'atendimento_requisicoes': 'acesso_requisicoes',
    'acesso_requisicoes': 'acesso_requisicoes',

    // 7. Agendamento Munck/PickUp -> acesso_munck
    'agendamento-munck': 'acesso_munck',
    'agendamento_munck': 'acesso_munck',
    'acesso_munck': 'acesso_munck',

    // 8. Consulta de Pedido de Compra -> acesso_consulta_pedido
    'consulta-pedidos': 'acesso_consulta_pedido',
    'consulta_pedido': 'acesso_consulta_pedido',
    'acesso_consulta_pedido': 'acesso_consulta_pedido',
    'perm_consulta_pedidos': 'acesso_consulta_pedido',

    // 9. Rastreio de RM's com Pedidos de Compra -> acesso_rastreio_rm
    'monitor-compras': 'acesso_rastreio_rm',
    'monitor_compras': 'acesso_rastreio_rm',
    'acesso_rastreio_rm': 'acesso_rastreio_rm',

    // 10. Gestão de Expedição -> acesso_expedicao
    'gestao-expedicao': 'acesso_expedicao',
    'gestao_expedicao': 'acesso_expedicao',
    'acesso_expedicao': 'acesso_expedicao',
    'acesso_movimentacoes': 'acesso_expedicao',

    // 11. Devolução de Ativos Locados -> acesso_devolucao_ativos
    'devolucao-ativos': 'acesso_devolucao_ativos',
    'devolucao_ativos': 'acesso_devolucao_ativos',
    'acesso_devolucao_ativos': 'acesso_devolucao_ativos',

    // 12. Central de Fardamento & Admissões -> acesso_fardamento
    'central-fardamento': 'acesso_fardamento',
    'central_fardamento': 'acesso_fardamento',
    'acesso_fardamento': 'acesso_fardamento',

    // 13. Oficina Elétrica -> acesso_oficina
    'oficina-eletrica': 'acesso_oficina',
    'oficina_eletrica': 'acesso_oficina',
    'acesso_oficina': 'acesso_oficina',
    'acesso_eletrica': 'acesso_oficina',

    // 14. Cockpit Gerencial de KPI's -> acesso_kpi
    'overhaul-2026': 'acesso_kpi',
    'overhaul_2026': 'acesso_kpi',
    'cockpit_kpi': 'acesso_kpi',
    'acesso_kpi': 'acesso_kpi',
    'acesso_overhaul': 'acesso_kpi',

    // 15. MEDIÇÃO DE PRÓPRIOS -> acesso_medicao
    'medicao-proprios': 'acesso_medicao',
    'medicao_proprios': 'acesso_medicao',
    'acesso_medicao': 'acesso_medicao',

    // 16. Onboarding de Biometria Facial -> acesso_biometria
    'biometria-facial': 'acesso_biometria',
    'biometria_facial': 'acesso_biometria',
    'acesso_biometria': 'acesso_biometria',

    // Admin Panel
    'admin': 'acesso_admin',
    'painel_admin': 'acesso_admin',
    'acesso_admin': 'acesso_admin'
  };

  const flatCol = MODULE_TO_FLAT_COLUMN[moduloId];
  if (flatCol && permissoesDoPerfilRow[flatCol] !== undefined && permissoesDoPerfilRow[flatCol] !== null) {
    return !!permissoesDoPerfilRow[flatCol];
  }

  // 3. Verifica pela propriedade chaveAcesso ou colunaLegada no módulo registrado
  const moduloDef = HUB_MODULES.find(m => m.id === moduloId || m.appKey === moduloId);
  if (moduloDef?.chaveAcesso && permissoesDoPerfilRow[moduloDef.chaveAcesso] !== undefined && permissoesDoPerfilRow[moduloDef.chaveAcesso] !== null) {
    return !!permissoesDoPerfilRow[moduloDef.chaveAcesso];
  }
  if (moduloDef?.colunaLegada && permissoesDoPerfilRow[moduloDef.colunaLegada] !== undefined && permissoesDoPerfilRow[moduloDef.colunaLegada] !== null) {
    return !!permissoesDoPerfilRow[moduloDef.colunaLegada];
  }

  // 4. Fallback para objeto JSON `permissoes` (se presente em schemas legados)
  const permsObj = permissoesDoPerfilRow.permissoes;
  if (permsObj && typeof permsObj === 'object') {
    if (permsObj[moduloId] !== undefined) {
      return !!permsObj[moduloId];
    }
    if (flatCol && permsObj[flatCol] !== undefined) {
      return !!permsObj[flatCol];
    }
    if (moduloDef && permsObj[moduloDef.titulo] !== undefined) {
      return !!permsObj[moduloDef.titulo];
    }
  }

  // DEFAULT DENY: Se não houver permissão explícita, bloqueia
  return false;
}
