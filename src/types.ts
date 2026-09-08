/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ShiftType {
  TURNO_A = 'Turno A',
  TURNO_B = 'Turno B',
  TURNO_C = 'Turno C',
  FOLGUISTA = 'Folguista',
}

export interface ManpowerCount {
  operacional: number;
  administrativo: number;
}

export interface UniformStock {
  itemId: string;
  itemName: string;
  size: string; // size list
  quantity: number;
  condition?: 'Higienizado' | 'Novo'; // condition of stock
}

export interface EquipmentStatus {
  equipmentId: string;
  name: string;
  totalQuantity: number;
  activeQuantity: number;      // Em uso na obra
  maintenanceQuantity: number; // Em manutenção
  availableInStore: number;    // No estoque do almoxarifado local da obra
  notes: 'Sem Pendências' | 'Calibração Vencida' | 'Manutenção Corretiva' | 'Aguardando Peça';
}

export interface MaterialConsumption {
  materialId: string;
  name: string;
  unit: string;
  quantityConsumed: number;
  purpose: 'Manutenção Corretiva' | 'Manutenção Preventiva' | 'Instalação Nova' | 'Descarte/Perda';
}

export interface SiteDailyReport {
  id: string;
  siteId: string;
  siteName: string;
  date: string; // YYYY-MM-DD
  shift?: ShiftType;
  storekeeperName: string;
  
  // 1. Manpower
  manpower: ManpowerCount;
  
  // 2. Uniform stock
  uniforms: UniformStock[];
  
  // 3. Equipment tracking
  equipments: EquipmentStatus[];
  
  // 4. Daily Material Consumption
  materialsConsumed: MaterialConsumption[];
  
  submittedAt: string; // ISO string
  
  // 5. Relato / Campo
  fieldObservations?: string;
}

export interface ProjectSite {
  id: string;
  name: string;
  location: string;
  clientCompany: string;
  managerName: string;
}

export interface PredefinedMaterial {
  id: string;
  name: string;
  unit: string;
  category: string;
}

export interface PredefinedEquipment {
  id: string;
  name: string;
  category: string;
}

export interface PredefinedUniform {
  id: string;
  name: string;
  sizes: string[];
}

export type DevolucaoEtapa = 'Remessa criada' | 'Emissão doc' | 'Em transferência' | 'Em rota de entrega' | 'Entrega realizada';

export interface DevolucaoAtivo {
  id: string;
  tagEquipamento: string;
  tag_equipamento?: string;
  descricaoItem?: string;
  descricao_item?: string;
  fornecedorDestino: string;
  fornecedor_destino?: string;
  cnpjDestino: string;
  cnpj_destino?: string;
  numeroNF: string;
  numero_nf?: string;
  nota_fiscal?: string;
  etapaAtual: DevolucaoEtapa;
  etapa_atual?: number | string;
  criadoEm: string;
  criado_em?: string;
  atualizadoEm: string;
  atualizado_em?: string;
  statusTexto?: string;
  status_texto?: string;
  dataUltimaAtualizacao?: string;
  data_ultima_atualizacao?: string;
  data_evento_transportadora?: string;
  data_previsao_entrega?: string;
  dataPrevisaoEntrega?: string;
  itens?: Array<{ tag: string; descricao: string }>;
  transportadora?: string;
  entrega_concluida?: boolean;
  entregaConcluida?: boolean;
}

/**
 * Estrutura de dados para Requisições de Material (RMs)
 * Suporta o sistema de rastreabilidade Mãe e Filha para entregas parciais
 */
export interface Requisicao {
  id: string | number;
  rmNumber?: string;
  rm_number?: string;
  material?: string;
  quantidade?: number;
  unidade?: string;
  setor?: string;
  solicitante?: string;
  dataSolicitacao?: string;
  data_solicitacao?: string;
  status?: string;
  status_interno?: string;
  
  // Rastreabilidade Mãe e Filha (Desmembramento de RMs)
  rm_mae_id?: string | number | null;
  rm_filha_id?: string | number | null;

  [key: string]: any;
}

export type RM = Requisicao;

// ==========================================
// MÓDULO MEDIÇÃO DE PRÓPRIOS (LOCAÇÃO DE ATIVOS)
// ==========================================

export interface ObraMedicao {
  id: string;
  numero_cc: string;
  nome_obra: string;
  nome_gestor: string;
  data_inicio: string; // YYYY-MM-DD
  status: boolean; // true = Ativa, false = Inativa
  created_at?: string;
}

export interface ValorLocacao {
  cod_material: string;
  descricao: string;
  valor_mensal: number;
  valor_diario: number;
  classe?: string;
  created_at?: string;
}

export interface MovimentacaoAtivo {
  id: string;
  obra_id: string;
  tag: string;
  cod_material: string;
  descricao: string;
  data_entrada: string; // YYYY-MM-DD
  data_saida?: string | null; // YYYY-MM-DD
  created_at?: string;
  modalidade?: string | null; // 'LOCACAO' | 'REAPROVEITAMENTO'
  valor_reaproveitamento?: number | null;
  quantidade?: number | null;
  rm_referencia?: string | null;
}

export interface ItemMedicaoCalculado {
  id: string;
  obra_id: string;
  tag: string;
  cod_material: string;
  descricao: string;
  data_entrada: string;
  data_saida?: string | null;
  inicio_medicao?: string | null;
  fim_medicao?: string | null;
  dias_medidos: number;
  valor_mensal: number;
  valor_diario: number;
  valor_total_item: number;
  tem_preco: boolean;
  classe?: string;
  modalidade?: string | null;
  valor_reaproveitamento?: number | null;
  quantidade?: number | null;
  rm_referencia?: string | null;
}

