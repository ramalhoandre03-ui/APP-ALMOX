/**
 * Hook and utilities for Mobilizações and Dashboard Automacao
 */
export {
  useDashboardAutomacao,
  normalizarItemRequisicao
} from './useDashboardAutomacao';

export {
  useMobilizacoesProcessadas,
  normalizarCC,
  processarItemMobilizacao
} from './useMobilizacoesProcessadas';

export type {
  DashboardMetric,
  DashboardSummary,
  UseDashboardAutomacaoReturn,
  NormalizedItemRequisicao
} from './useDashboardAutomacao';

export type {
  ProcessedItemMobilizacao,
  UseMobilizacoesProcessadasReturn
} from './useMobilizacoesProcessadas';

