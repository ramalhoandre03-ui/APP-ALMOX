import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { inferirClasse } from '../components/MobilizacaoView';
import { normalizarCC, processarItemMobilizacao } from './useMobilizacoesProcessadas';

export { normalizarCC, processarItemMobilizacao };

export interface DashboardMetric {
  obra: string;
  classeFinanceira: string;
  codigo: string;
  descricao: string;
  totalSolicitado: number;
  emTriagem: number;
  emCompras: number;
  disponivel: number;
  mobilizado: number;
  qtdTriagem?: number;
  qtdCompra?: number;
  qtdDisponivel?: number;
  qtdMobilizado?: number;
  previsaoEntrega?: string | null;
  statusPrazo?: 'NO PRAZO' | 'ATRASADO' | 'SEM PREVISÃO';
  numero_pc?: string | null;
  pedido_compra?: string | null;
  pc?: string | null;
  status_override_manual?: string | null;
  statusCalculado?: string;
  requisicaoIds?: (string | number)[];
  debugSources?: string[];
}

export interface NormalizedItemRequisicao {
  statusVisual: 'TRIAGEM' | 'COMPRA' | 'SEPARADO' | 'MOBILIZADO' | string;
  qtdSolicitada: number;
  qtdMobilizado: number;
  qtdSeparado: number;
  qtdCompra: number;
  qtdAnalise: number;
}

export function normalizarItemRequisicao(item: {
  status_override_manual?: string | null;
  quantidade?: number;
  quantidade_solicitada?: number;
  quantidade_atendida?: number;
  qtdSolicitada?: number;
  qtdMobilizada?: number;
  qtdSeparada?: number;
  comprasPendentes?: number;
  statusTriagem?: string;
  [key: string]: any;
}): NormalizedItemRequisicao {
  const statusForcado = item.status_override_manual ? String(item.status_override_manual).trim().toUpperCase() : null;

  const qtdSolicitada = Number(item.qtdSolicitada ?? item.quantidade_solicitada ?? item.quantidade ?? 0);
  const qtdMobilizada = Number(item.qtdMobilizada ?? item.qtdMobilizado ?? 0);
  const qtdSeparada = Number(item.qtdSeparada ?? item.qtdSeparado ?? item.quantidade_atendida ?? 0);
  const comprasPendentes = Number(item.comprasPendentes ?? item.emCompras ?? item.qtdCompra ?? 0);
  const statusTriagem = String(item.statusTriagem ?? item.status ?? '').toUpperCase();

  let statusVisual = 'TRIAGEM'; 
  
  if (statusForcado) {
    statusVisual = statusForcado; // OVERRIDE TEM PRIORIDADE MÁXIMA
  } else if (qtdMobilizada >= qtdSolicitada && qtdSolicitada > 0) {
    statusVisual = 'MOBILIZADO';
  } else if (qtdSeparada > 0 && comprasPendentes === 0) {
    statusVisual = 'ESTOQUE';
  } else if (comprasPendentes > 0) {
    statusVisual = 'RM COMPRA';
  } else if (statusTriagem === 'ATENDIDO' && qtdSeparada === 0) {
    statusVisual = 'ATENDIDO'; 
  }

  let qtdMobilizado = qtdMobilizada;
  let qtdSeparado = qtdSeparada;
  let qtdCompra = comprasPendentes;
  let qtdAnalise = Math.max(0, qtdSolicitada - qtdMobilizada - qtdSeparada - comprasPendentes);

  if (statusForcado === 'SEPARADO' || statusForcado === 'ESTOQUE' || statusForcado === 'DISPONIVEL') {
    qtdSeparado = qtdSolicitada;
    qtdMobilizado = 0;
    qtdCompra = 0;
    qtdAnalise = 0;
    statusVisual = 'SEPARADO';
  } else if (statusForcado === 'MOBILIZADO' || statusForcado === 'ATENDIDO') {
    qtdMobilizado = qtdSolicitada;
    qtdSeparado = 0;
    qtdCompra = 0;
    qtdAnalise = 0;
    statusVisual = 'MOBILIZADO';
  } else if (statusForcado === 'COMPRA' || statusForcado === 'EM COMPRAS' || statusForcado === 'RM COMPRA') {
    qtdCompra = qtdSolicitada;
    qtdMobilizado = 0;
    qtdSeparado = 0;
    qtdAnalise = 0;
    statusVisual = 'COMPRA';
  } else if (statusForcado === 'TRIAGEM' || statusForcado === 'EM TRIAGEM' || statusForcado === 'ANALISE') {
    qtdAnalise = qtdSolicitada;
    qtdMobilizado = 0;
    qtdSeparado = 0;
    qtdCompra = 0;
    statusVisual = 'TRIAGEM';
  }

  return {
    statusVisual,
    qtdSolicitada,
    qtdMobilizado,
    qtdSeparado,
    qtdCompra,
    qtdAnalise
  };
}

export interface DashboardSummary {
  totalSolicitado: number;
  emTriagem: number;
  emCompras: number;
  disponivel: number;
  mobilizado: number;
  obrasCount: number;
  classesCount: number;
}

export interface UseDashboardAutomacaoReturn {
  data: DashboardMetric[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  summary: DashboardSummary;
  vincularClasseManual: (codigo: string, descricao: string, novaClasse: string) => Promise<boolean>;
  todasAsClassesUnicas: string[];
}

/**
 * Converte com segurança qualquer valor para número float válido.
 */
export function safeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  if (typeof val === 'string') {
    let clean = val.trim().replace(/[R$\s]/g, '');
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean);
    return isNaN(num) ? fallback : num;
  }
  return fallback;
}

/**
 * Normaliza e higieniza chaves de texto para busca insensível a acentos, maiúsculas e espaços duplos.
 */
export const normalizarParaBusca = (texto?: string): string => {
  if (!texto) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toUpperCase()
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .trim();
};

/**
 * Higieniza e padroniza os nomes das classes financeiras (O Trator de Classes):
 * 1. Rejeita nulos, vazios e múltiplas classes concatenadas (contendo '|') retornando 'Sem Classe Vinculada'
 * 2. Remove códigos numéricos e sufixos entre parênteses
 * 3. Mapeamento forçado e unificação agressiva por substring (Regex / Includes)
 */
export const higienizarClasse = (raw: string | any): string => {
  if (!raw) return 'Sem Classe Vinculada';
  
  let c = String(raw).trim().toUpperCase();
  
  // Rejeita valores nulos, vazios ou indefinidos
  if (!c || c === '-' || c === 'NULL' || c === 'UNDEFINED' || c === 'SEM CLASSE VINCULADA') {
    return 'Sem Classe Vinculada';
  }

  // Rejeita múltiplas classes (rateio)
  if (c.includes('|')) return 'Sem Classe Vinculada';

  // Remove aspas ou colchetes residuais
  c = c.replace(/[\[\]{}"]/g, '').trim();
  
  // Limpeza de códigos numéricos e sufixos em parênteses
  c = c.replace(/^\d+\s*-\s*/, '');
  c = c.replace(/\s*\([^)]*\)\s*$/, '');
  c = c.trim();

  // Mapeamento forçado e unificação (Trator de Nomes)
  if (c.includes('BENS DE PEQUENO VALOR')) return 'BENS DE PEQUENO VALOR';
  if (c.includes('LIMPEZA')) return 'LIMPEZA';
  if (c.includes('ESCRITORIO') || c.includes('ESCRITÓRIO')) return 'MATERIAL DE ESCRITORIO';
  if (c.includes('USO E CONSUMO')) return 'USO E CONSUMO';
  if (c.includes('PROTECAO INDIVIDUAL') || c.includes('PROTEÇÃO INDIVIDUAL') || c === 'EPI') return 'EPI';
  if (c.includes('PROTECAO COLETIVA') || c.includes('PROTEÇÃO COLETIVA') || c === 'EPC') return 'EPC';
  if (c.includes('CORTE E SOLDA')) return 'CORTE E SOLDA';
  if (c.includes('INFORMATICA') || c.includes('INFORMÁTICA')) return 'EQUIPAMENTOS DE INFORMATICA';
  if (c.includes('GRAFICO') || c.includes('GRÁFICO')) return 'SERVICOS GRAFICOS';
  if (c.includes('APLICACAO') || c.includes('APLICAÇÃO')) return 'MATERIAL DE APLICACAO';
  if (c.includes('ELETRICA') || c.includes('ELÉTRICA')) return 'ELÉTRICA';
  if (c === 'EQUIPAMENTO') return 'EQUIPAMENTOS';

  if (!c || c === 'SEM CLASSE VINCULADA') return 'Sem Classe Vinculada';

  return c;
};

/**
 * Extrai a classe financeira de forma robusta e agressiva:
 * 1. Prioridade Máxima: Dicionário Oficial (por código e por descrição normalizada)
 * 2. Prioridade Secundária: Tabelas transacionais (RMs, Pedidos, etc.)
 * 3. Prioridade Terciária: Inferência heurística por descrição
 * 4. Fallback: 'Sem Classe Vinculada'
 */
export const extrairClasse = (
  obj: any,
  codigoMaterialOuDesc?: string,
  descricaoOuDictMap?: string | Map<string, string>,
  dictMapParam?: Map<string, string>,
  dictByDescParam?: Map<string, string>
): string => {
  // Tratamento flexível de parâmetros para suportar (obj, cod, dictMap) ou (obj, cod, desc, dictMap, dictByDesc)
  let cod = codigoMaterialOuDesc ? String(codigoMaterialOuDesc).trim() : null;
  let descParam = typeof descricaoOuDictMap === 'string' ? descricaoOuDictMap : undefined;
  let dictMap = descricaoOuDictMap instanceof Map ? descricaoOuDictMap : dictMapParam;
  let dictByDesc = dictByDescParam;

  // Se o código contiver hífens ou texto embutido, extrai de forma limpa
  if (cod) {
    const separada = separarCodigoEDescricao(descParam || cod, cod);
    cod = separada.codigo || cod;
    if (!descParam) descParam = separada.descricao;
  }

  // 1. Prioridade Máxima: Dicionário Oficial (Por Código)
  if (cod && dictMap && dictMap.has(cod)) {
    const val = dictMap.get(cod);
    if (val && val.trim()) {
      const limpa = higienizarClasse(val);
      if (limpa !== 'Sem Classe Vinculada') return limpa;
    }
  }

  // 1.1 Prioridade Máxima: Dicionário Oficial (Por Descrição Normalizada)
  const descFinal = descParam || obj?.material || obj?.descricao || obj?.descricao_item || obj?.produto_descricao || (codigoMaterialOuDesc || '');
  const descNorm = normalizarParaBusca(descFinal);
  if (descNorm && dictByDesc && dictByDesc.has(descNorm)) {
    const val = dictByDesc.get(descNorm);
    if (val && val.trim()) {
      const limpa = higienizarClasse(val);
      if (limpa !== 'Sem Classe Vinculada') return limpa;
    }
  }

  // 2. Prioridade Secundária: Extração Bruta das tabelas transacionais
  let rawClass = 
    obj?.classeFinanceira ?? 
    obj?.classe_financeira ?? 
    obj?.classes_financeiras ?? 
    obj?.classe ?? 
    obj?.classe_custo ?? 
    obj?.classeCusto ?? 
    null;

  // Tratamento de array nativo
  if (Array.isArray(rawClass) && rawClass.length > 0) {
    rawClass = rawClass.length === 1 ? rawClass[0] : null; // Se múltiplos, forçará 'Sem Classe Vinculada'
  }

  // Tratamento de array stringificado (ex: '["748 - MATERIAIS"]')
  if (typeof rawClass === 'string' && rawClass.startsWith('[')) {
    try {
      const parsed = JSON.parse(rawClass);
      if (Array.isArray(parsed)) {
        rawClass = parsed.length === 1 ? parsed[0] : null;
      }
    } catch(e) {}
  }

  if (rawClass && rawClass !== 'undefined' && rawClass !== 'null') {
    const limpa = higienizarClasse(rawClass);
    if (limpa !== 'Sem Classe Vinculada') return limpa;
  }

  // 3. Prioridade Terciária: Inferência heurística pela descrição do material
  if (descFinal && String(descFinal).trim()) {
    const inferred = inferirClasse(String(descFinal));
    if (inferred && inferred !== 'OUTROS' && inferred !== 'DIVERSOS') {
      const limpa = higienizarClasse(inferred);
      if (limpa !== 'Sem Classe Vinculada') return limpa;
    }
  }

  // 4. Fallback
  return 'Sem Classe Vinculada';
};

/**
 * Normaliza e padroniza o nome do Centro de Custo / Obra:
 * 1. Remove qualquer código numérico e hífen do início (ex: "316 - ", "12-")
 * 2. Remove espaços múltiplos
 * 3. Força a inclusão do sufixo de ano caso o texto termine abruptamente no mês (ex: "SLZ 08", "SLZ08" -> "SLZ 08-26", "SLZ08-26")
 */
export const normalizarObra = (rawObra?: string | null | any): string => {
  if (!rawObra) return 'NÃO INFORMADA';
  
  let obra = String(rawObra).toUpperCase().trim();
  
  // 1. Remove qualquer código numérico e hífen do início (ex: "316 - ", "12-")
  obra = obra.replace(/^\d+\s*-\s*/, '');
  
  // 2. Remove espaços múltiplos
  obra = obra.replace(/\s+/g, ' ').trim();

  // 3. Aplica o Dicionário de Mapeamento Oficial (Pedra de Roseta)
  obra = normalizarCC(obra);

  if (obra === 'SEM OBRA DEFINIDA') return 'NÃO INFORMADA';

  // 4. Força a inclusão do sufixo de ano caso o texto termine abruptamente no mês (ex: "SLZ 08")
  obra = obra.replace(/(SLZ\s?\d{2})$/, '$1-26');

  return obra || 'NÃO INFORMADA';
};

/**
 * Normaliza o nome do Centro de Custo/Obra removendo códigos numéricos, corrigindo sufixos e espaços.
 */
export function normalizeCentroCusto(cc: string | undefined | null): string {
  return normalizarObra(cc);
}

/**
 * Normaliza e sanitiza a string da Classe Financeira usando extrairClasse.
 */
export function normalizeClasse(classe: any, materialDesc?: string, dictMap?: Map<string, string>): string {
  return extrairClasse(typeof classe === 'object' && classe !== null && !Array.isArray(classe) ? classe : { classeFinanceira: classe }, materialDesc, dictMap);
}

/**
 * Desmembra strings no formato "CODIGO - DESCRICAO" e extrai as duas partes de forma limpa.
 */
export const separarCodigoEDescricao = (textoBruto: string, codigoExistente?: string): { codigo: string; descricao: string } => {
  let codigo = codigoExistente ? String(codigoExistente).trim() : '';
  let descricao = String(textoBruto || '').trim();

  // Verifica se o próprio código existente veio concatenado (ex: "152342 - ELETRODO")
  if (codigo) {
    const matchCod = codigo.match(/^(\d+)\s*-\s*(.+)$/);
    if (matchCod) {
      codigo = matchCod[1].trim();
      if (!descricao || descricao === String(textoBruto || '').trim()) {
        descricao = matchCod[2].trim();
      }
    }
  }

  // Verifica padrão numérico inicial na descrição (ex: "298873 - APITO" ou "298873-APITO")
  const match = descricao.match(/^(\d+)\s*-\s*(.+)$/);
  if (match) {
    if (!codigo) codigo = match[1].trim(); // Só pega o código embutido se não tiver vindo um explícito
    descricao = match[2].trim();
  }

  // Fallbacks de segurança
  if (!descricao && codigo) {
    descricao = `MATERIAL (${codigo})`;
  } else if (!descricao) {
    descricao = 'ITEM SEM DESCRIÇÃO';
  }

  return { codigo, descricao: descricao.toUpperCase() };
};

/**
 * Normaliza e sanitiza código e descrição do material usando separarCodigoEDescricao.
 */
export function normalizeItemDetails(codigoRaw?: any, descricaoRaw?: any): { codigo: string; descricao: string } {
  return separarCodigoEDescricao(descricaoRaw, codigoRaw);
}

/**
 * Extrai a lista de itens embutidos de uma Requisição (itens, materiais, itens_json, items ou o próprio objeto).
 */
function extractEmbeddedItems(rm: any): any[] {
  if (Array.isArray(rm.itens) && rm.itens.length > 0) {
    return rm.itens;
  }
  if (Array.isArray(rm.materiais) && rm.materiais.length > 0) {
    return rm.materiais;
  }
  if (Array.isArray(rm.items) && rm.items.length > 0) {
    return rm.items;
  }
  if (Array.isArray(rm.itens_json) && rm.itens_json.length > 0) {
    return rm.itens_json;
  }
  if (typeof rm.itens_json === 'string' && rm.itens_json.trim()) {
    try {
      const parsed = JSON.parse(rm.itens_json);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  if (typeof rm.itens === 'string' && rm.itens.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rm.itens);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  if (typeof rm.materiais === 'string' && rm.materiais.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rm.materiais);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  return [];
}

/**
 * Custom Hook: useDashboardAutomacao
 * 
 * Executa a busca simultânea em 4 tabelas do Supabase (requisicoes, pedidos_compras_bi,
 * recebimentos_itens e expedicao_itens) e consolida os dados operacionais em métricas
 * matemáticas em tempo real agrupadas por Obra e Classe Financeira.
 */
export function useDashboardAutomacao(obrasFiltro?: string[]): UseDashboardAutomacaoReturn {
  const [data, setData] = useState<DashboardMetric[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const obrasFiltroKey = obrasFiltro ? obrasFiltro.join('|') : '';

  const fetchDashboardData = useCallback(async () => {
    // 1. Zera a memória para evitar contaminação cruzada e exibe loading
    setIsLoading(true);
    setData([]);
    setError(null);

    const safeQuery = async (queryPromise: any) => {
      try {
        const res = await queryPromise;
        return res || { data: [], error: null };
      } catch (err: any) {
        console.warn('Query Supabase falhou de forma controlada:', err?.message || err);
        return { data: [], error: err };
      }
    };

    try {
      // 2. Constrói o filtro dinâmico de obras com ILIKE para escapar do limit(1000) em todas as tabelas
      let reqQueryPromise: any;
      let pedQueryPromise: any;
      let recQueryPromise: any;
      let expItensQueryPromise: any;
      let expLegacyQueryPromise: any;

      // Dispara as consultas em TODAS as tabelas envolvidas com limite alto para garantir todos os dados
      reqQueryPromise = supabase.from('requisicoes').select('*').limit(100000);
      pedQueryPromise = supabase.from('pedidos_compras_bi').select('*').limit(100000);
      recQueryPromise = supabase.from('recebimentos_itens').select('*').limit(100000);
      expItensQueryPromise = supabase.from('expedicao_itens').select('*').limit(100000);
      expLegacyQueryPromise = supabase.from('expedicao').select('*').limit(100000);

      // 3. Dispara as consultas em TODAS as tabelas envolvidas simultaneamente usando Promise.all
      const [
        requisicoesRes,
        pedidosRes,
        recebimentosRes,
        expItensRes,
        expLegacyRes,
        dictRes
      ] = await Promise.all([
        safeQuery(reqQueryPromise),
        safeQuery(pedQueryPromise),
        safeQuery(recQueryPromise),
        safeQuery(expItensQueryPromise),
        safeQuery(expLegacyQueryPromise),
        safeQuery(supabase.from('dicionario_classes').select('codigo_material, descricao_material, classe_financeira').limit(100000))
      ]);

      let requisicoesData = requisicoesRes?.data;
      let reqError = requisicoesRes?.error;

      // Fallback resiliente para requisições
      if ((reqError || !requisicoesData || requisicoesData.length === 0) && obrasFiltro && obrasFiltro.length > 0) {
        const fallbackConditions = obrasFiltro
          .map(obra => `centroCusto.ilike.%${normalizarObra(obra).trim()}%`)
          .join(',');
        const fallbackRes = await safeQuery(
          supabase.from('requisicoes').select('*').or(fallbackConditions).limit(100000)
        );
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
          requisicoesData = fallbackRes.data;
          reqError = null;
        }
      }

      // Fallback resiliente para pedidos_compras_bi
      let pedidosBiData = pedidosRes?.data;
      let pedidosError = pedidosRes?.error;
      if (pedidosError || (!pedidosBiData && obrasFiltro && obrasFiltro.length > 0)) {
        const fallbackRes = await safeQuery(
          supabase.from('pedidos_compras_bi').select('*').or(
            obrasFiltro.map(o => `centro_custo.ilike.%${normalizarObra(o).trim()}%`).join(',')
          ).limit(100000)
        );
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
          pedidosBiData = fallbackRes.data;
          pedidosError = null;
        } else {
          const allRes = await safeQuery(supabase.from('pedidos_compras_bi').select('*').limit(10000));
          pedidosBiData = allRes.data || [];
        }
      }

      // Fallback resiliente para recebimentos_itens
      let recebimentosData = recebimentosRes?.data;
      let recError = recebimentosRes?.error;
      if (recError || (!recebimentosData && obrasFiltro && obrasFiltro.length > 0)) {
        const fallbackRes = await safeQuery(
          supabase.from('recebimentos_itens').select('*').or(
            obrasFiltro.map(o => `centro_custo.ilike.%${normalizarObra(o).trim()}%`).join(',')
          ).limit(10000)
        );
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
          recebimentosData = fallbackRes.data;
          recError = null;
        } else {
          const allRes = await safeQuery(supabase.from('recebimentos_itens').select('*').limit(10000));
          recebimentosData = allRes.data || [];
        }
      }

      // Unificação resiliente de dados de expedição (expedicao_itens + expedicao)
      let expedicaoData = [
        ...(expItensRes?.data || []),
        ...(expLegacyRes?.data || [])
      ];
      let expError = expItensRes?.error && expLegacyRes?.error ? expItensRes.error : null;
      if (expError || (expedicaoData.length === 0 && obrasFiltro && obrasFiltro.length > 0)) {
        const fallbackRes = await safeQuery(
          supabase.from('expedicao_itens').select('*').or(
            obrasFiltro.map(o => `centro_custo.ilike.%${normalizarObra(o).trim()}%`).join(',')
          ).limit(10000)
        );
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
          expedicaoData = fallbackRes.data;
          expError = null;
        } else {
          const allExp = await safeQuery(supabase.from('expedicao_itens').select('*').limit(10000));
          if (allExp.data && allExp.data.length > 0) {
            expedicaoData = allExp.data;
          }
        }
      }

      const dictData = dictRes?.data || [];
      const dictError = dictRes?.error;

      if (reqError) console.warn('Aviso: Erro ao buscar requisicoes:', reqError.message);
      if (pedidosError) console.warn('Aviso: Erro ao buscar pedidos_compras_bi:', pedidosError.message);
      if (recError) console.warn('Aviso: Erro ao buscar recebimentos_itens:', recError.message);
      if (expError) console.warn('Aviso: Erro ao buscar expedicao:', expError.message);
      if (dictError) console.warn('Aviso: Tabela dicionario_classes não encontrada ou sem permissão:', dictError.message);

      // Maps globais de busca ultrarrápida do dicionário oficial (por código e por descrição normalizada)
      const classDictionary = new Map<string, string>();
      const dictByDesc = new Map<string, string>();

      if (dictData && Array.isArray(dictData)) {
        dictData.forEach(row => {
          const val = row.classe_financeira ? higienizarClasse(row.classe_financeira) : '';
          if (!val || val === 'Sem Classe Vinculada') return;

          // 1. Indexação por código
          if (row.codigo_material) {
            const codKey = String(row.codigo_material).trim();
            if (codKey) {
              classDictionary.set(codKey, val);
              // Também indexa sem zeros à esquerda e apenas dígitos para tolerância
              const digits = codKey.replace(/\D/g, '');
              if (digits && !classDictionary.has(digits)) {
                classDictionary.set(digits, val);
              }
            }
          }

          // 2. Indexação por descrição normalizada (sem acentos, uppercase, espaços únicos)
          if (row.descricao_material) {
            const normDesc = normalizarParaBusca(row.descricao_material);
            if (normDesc) {
              dictByDesc.set(normDesc, val);
            }
          }
        });
      }

      let localExpedicoes: any[] = [];
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const raw = localStorage.getItem('expedicao_mobilizados_db');
          if (raw) localExpedicoes = JSON.parse(raw);
        } catch (e) {}
      }

      const seenExpIds = new Set<string>();
      const allExpedicoes: any[] = [];

      (expedicaoData || []).forEach((exp: any) => {
        if (exp.id) seenExpIds.add(String(exp.id));
        allExpedicoes.push(exp);
      });

      localExpedicoes.forEach((exp: any) => {
        if (!exp.id || !seenExpIds.has(String(exp.id))) {
          if (exp.id) seenExpIds.add(String(exp.id));
          allExpedicoes.push(exp);
        }
      });

      const requisicoes = requisicoesData || [];
      const pedidosBi = pedidosBiData || [];
      const recebimentos = recebimentosData || [];

      // ----------------------------------------------------------------------
      // MAPA DE MOBILIZAÇÕES POR OBRA E ITEM (expedicao_itens)
      // ----------------------------------------------------------------------
      const mobilizadosPorObraEItem = new Map<string, number>();

      allExpedicoes.forEach((exp: any) => {
        const rawCod = String(exp.codigo_material || exp.codigo_item || exp.codigo || exp.codigoMaterial || '').trim();
        const rawDesc = String(exp.material || exp.descricao_item || exp.descricao || exp.descricaoItem || '').trim();
        const { codigo, descricao } = separarCodigoEDescricao(rawDesc, rawCod);
        const obra = normalizarObra(exp.centro_custo || exp.centroCusto || exp.setor || exp.obra || '');

        const mapKey = `${obra}|${codigo}|${descricao}`;
        const qtdEnviada = Number(
          exp.quantidade_mobilizada ||
          exp.qtd_enviada ||
          exp.quantidadeSeparada ||
          exp.quantidade ||
          exp.qtd ||
          0
        );

        if (qtdEnviada > 0) {
          mobilizadosPorObraEItem.set(mapKey, (mobilizadosPorObraEItem.get(mapKey) || 0) + qtdEnviada);
        }
      });

      // Estrutura de agregação intermediária por chave composta: `${obra}|||${classeFinanceira}|||${codigo}|||${descricao}`
      interface AggregationBucket {
        obra: string;
        classeFinanceira: string;
        codigo: string;
        descricao: string;
        emTriagem: number;
        demandaPreCotacao: number;
        saldoPedidosBI: number;
        patioBruto: number;
        mobilizadoManual: number;
        previsaoEntrega: string | null;
        pcs: Set<string>;
        requisicaoIds: (string | number)[];
        statusOverride: string | null;
        debugSources: string[];
      }

      const bucketsMap: Map<string, AggregationBucket> = new Map();

      // Helper para enriquecimento cruzado com RMs caso a classe não venha no registro
      const buscarClasseCruzadaRM = (codItem: string, descItem: string, centroCustoItem?: string): string => {
        const codClean = String(codItem || '').trim().toLowerCase();
        const descClean = String(descItem || '').trim().toLowerCase();
        const ccClean = centroCustoItem ? normalizarObra(centroCustoItem).toLowerCase() : '';

        for (const rm of requisicoes) {
          const rmCc = normalizarObra(rm.centroCusto || rm.centro_custo || rm.setor || rm.obra || '').toLowerCase();
          if (ccClean && rmCc && ccClean !== rmCc && rmCc !== 'não informada') {
            // Se as obras forem explicitamente diferentes, não cruza
            continue;
          }

          const itemCod = String(rm.codigoMaterial || rm.codigo_material || rm.codigoItem || rm.codigo_item || rm.codigo || '').trim().toLowerCase();
          const itemDesc = String(rm.descricaoMaterial || rm.descricao_material || rm.descricaoItem || rm.descricao_item || rm.descricao || rm.material || '').trim().toLowerCase();

          // Match por código exato
          if (codClean && itemCod && codClean === itemCod) {
            const cl = extrairClasse(rm, itemCod || itemDesc || descItem, descItem, classDictionary, dictByDesc);
            if (cl !== 'Sem Classe Vinculada') return cl;
          }

          // Match por descrição cruzada
          if (descClean && itemDesc && (descClean.includes(itemDesc) || itemDesc.includes(descClean))) {
            const cl = extrairClasse(rm, itemCod || itemDesc || descItem, descItem, classDictionary, dictByDesc);
            if (cl !== 'Sem Classe Vinculada') return cl;
          }
        }
        return 'Sem Classe Vinculada';
      };

      const getBucket = (
        obraRaw: string | undefined | null,
        classeRaw: string | undefined | null,
        descRaw?: any,
        codRaw?: any
      ): AggregationBucket => {
        const obra = normalizarObra(obraRaw);
        const { codigo, descricao } = normalizeItemDetails(codRaw, descRaw);
        
        // 1. Tenta extrair com prioridade no dicionário passando o código e descrição normalizada
        let classeFinanceira = extrairClasse(
          typeof classeRaw === 'object' && classeRaw !== null ? classeRaw : { classeFinanceira: classeRaw },
          codigo,
          descricao,
          classDictionary,
          dictByDesc
        );

        // 2. Se ainda estiver 'Sem Classe Vinculada', tenta enriquecimento cruzado com a base de RMs
        if (classeFinanceira === 'Sem Classe Vinculada') {
          const cruzada = buscarClasseCruzadaRM(codigo, descricao, obraRaw ?? undefined);
          if (cruzada !== 'Sem Classe Vinculada') {
            classeFinanceira = cruzada;
          }
        }
        
        const compositeKey = `${obra}|||${classeFinanceira}|||${codigo}|||${descricao}`;

        let bucket = bucketsMap.get(compositeKey);
        if (!bucket) {
          bucket = {
            obra,
            classeFinanceira,
            codigo,
            descricao,
            emTriagem: 0,
            demandaPreCotacao: 0,
            saldoPedidosBI: 0,
            patioBruto: 0,
            mobilizadoManual: 0,
            previsaoEntrega: null,
            pcs: new Set<string>(),
            requisicaoIds: [],
            statusOverride: null,
            debugSources: []
          };
          bucketsMap.set(compositeKey, bucket);
        }
        return bucket;
      };

      // ----------------------------------------------------------------------
      // REGRA 3A: Quantidade Disponível / Pátio - Recebimentos Físicos (recebimentos_itens)
      // ----------------------------------------------------------------------
      for (const rec of recebimentos) {
        const qtdRec = safeNumber(rec.qtd_recebida ?? rec.quantidade_recebida ?? 0);
        if (qtdRec > 0) {
          const rawDesc = rec.descricao_item ?? rec.descricao ?? rec.material ?? '';
          const rawCod = rec.codigo_item ?? rec.codigo ?? rec.codigo_material ?? '';
          const { codigo: codLimpo, descricao: descLimpa } = separarCodigoEDescricao(rawDesc, rawCod);
          const obra = normalizarObra(rec.centro_custo || rec.centroCusto || rec.setor || rec.obra || '');

          let cl = extrairClasse(rec, codLimpo, descLimpa, classDictionary, dictByDesc);
          if (cl === 'Sem Classe Vinculada') {
            cl = buscarClasseCruzadaRM(codLimpo, descLimpa, obra);
          }
          const bucket = getBucket(obra, cl, descLimpa, codLimpo);
          bucket.patioBruto += qtdRec;

          const rawPc = String(rec.numero_pc ?? rec.pedido ?? rec.numero_pedido ?? '').trim();
          if (rawPc && rawPc !== '-' && rawPc !== 'NULL' && rawPc !== 'UNDEFINED' && !rawPc.startsWith('ID-')) {
            bucket.pcs.add(rawPc);
          }

          const numDoc = rec.numero_pc ?? rec.numero_pedido ?? rec.pedido ?? rec.nota_fiscal ?? `ID-${rec.id ?? 'S/N'}`;
          bucket.debugSources.push(`RECEBIMENTOS | Pedido/NF: ${numDoc}`);
        }
      }

      // ----------------------------------------------------------------------
      // REGRA 2A: Quantidade em Compras - Saldo a Receber do BI (pedidos_compras_bi)
      // ----------------------------------------------------------------------
      const pedidosBiRmSet = new Set<string>();

      for (const pedido of pedidosBi) {
        const sol = String(pedido.solicitacao ?? pedido.rm_numero ?? pedido.numero_rm ?? '').trim().toUpperCase();
        if (sol && sol !== '-') {
          pedidosBiRmSet.add(sol);
          // Adiciona também versão limpa (apenas dígitos) para compatibilidade
          const digitsOnly = sol.replace(/\D/g, '');
          if (digitsOnly) pedidosBiRmSet.add(digitsOnly);
        }

        const numPc = String(pedido.pedido ?? pedido.numero_pc ?? pedido.pc ?? pedido.numero_pedido ?? '').trim().toUpperCase();
        if (numPc && numPc !== '-' && numPc !== 'NULL' && numPc !== 'UNDEFINED') {
          pedidosBiRmSet.add(numPc);
        }

        const saldo = safeNumber(pedido.saldo_a_receber ?? pedido.saldoAReceber ?? 0);
        if (saldo > 0) {
          const rawDesc = pedido.produto_descricao ?? pedido.descricao ?? pedido.material ?? '';
          const rawCod = pedido.produto_codigo ?? pedido.codigo ?? pedido.codigo_item ?? '';
          const { codigo: codLimpo, descricao: descLimpa } = separarCodigoEDescricao(rawDesc, rawCod);
          const obra = normalizarObra(pedido.centro_custo || pedido.centroCusto || pedido.setor || pedido.obra || '');
          
          let cl = extrairClasse(pedido, codLimpo, descLimpa, classDictionary, dictByDesc);
          if (cl === 'Sem Classe Vinculada') {
            cl = buscarClasseCruzadaRM(codLimpo, descLimpa, obra);
          }

          const bucket = getBucket(obra, cl, descLimpa, codLimpo);
          bucket.saldoPedidosBI += saldo;
          if (numPc && numPc !== '-' && numPc !== 'NULL' && numPc !== 'UNDEFINED') {
            bucket.pcs.add(numPc);
          }

          // Captura a data de programação / previsão de entrega
          const dataPrevisaoRaw = 
            pedido.dt_progr || 
            pedido.previsao_entrega || 
            pedido.data_previsao || 
            pedido.data_entrega || 
            pedido.dt_entrega || 
            pedido.previsao || 
            null;
            
          if (dataPrevisaoRaw && !bucket.previsaoEntrega) {
            bucket.previsaoEntrega = String(dataPrevisaoRaw).trim();
          }
        }
      }

      // ----------------------------------------------------------------------
      // REGRAS 1, 2B e 3B: Processamento da tabela REQUISICOES (Mapeamento Exato do Banco)
      // ----------------------------------------------------------------------
      if (requisicoes && Array.isArray(requisicoes)) {
        requisicoes.forEach((rm: any) => {
          const rawMaterial = String(rm.material || rm.descricao || '').trim();
          if (!rawMaterial) return; // Ignora linhas inválidas

          // 1. SEPARAÇÃO FORÇADA: Isola o código numérico da descrição se vierem concatenados
          let codLimpo = String(rm.codigo || rm.codigoMaterial || rm.codigo_material || rm.codigoItem || rm.codigo_item || '').trim();
          let descLimpa = rawMaterial;

          // Se não tem código explícito na raiz, mas o 'material' começa com números seguidos de hífen
          if (!codLimpo) {
            const match = rawMaterial.match(/^(\d+)\s*-\s*(.+)$/);
            if (match) {
              codLimpo = match[1].trim();
              descLimpa = match[2].trim();
            }
          }

          // 2. Normalização e Chave
          const { codigo, descricao } = separarCodigoEDescricao(descLimpa, codLimpo);
          const obraNormalizada = normalizarCC(rm.setor || rm.centroCusto || rm.centro_custo || rm.obra || '');

          // TRAVA NO FRONT-END: Se houver filtro de obras ativo, processa apenas as obras selecionadas
          if (obrasFiltro && obrasFiltro.length > 0) {
            const normalizedFiltros = obrasFiltro.map(o => normalizarCC(o));
            if (!normalizedFiltros.includes(obraNormalizada)) return;
          }
          
          let classe = extrairClasse(rm, codigo, descricao, classDictionary, dictByDesc);
          if (classe === 'Sem Classe Vinculada') {
            classe = rm.classeFinanceira || rm.classe || 'Sem Classe Vinculada';
          }
          if (classe === 'Sem Classe Vinculada') {
            const cruzada = buscarClasseCruzadaRM(codigo, descricao, obraNormalizada);
            if (cruzada !== 'Sem Classe Vinculada') classe = cruzada;
          }

          const bucket = getBucket(obraNormalizada, classe, descricao, codigo);

          if (rm.id) {
            bucket.requisicaoIds.push(rm.id);
          }
          const rmPc = String(rm.numero_pc ?? rm.pedido_compra ?? rm.pc ?? rm.pedido ?? '').trim().toUpperCase();
          if (rmPc && rmPc !== '-' && rmPc !== 'NULL' && rmPc !== 'UNDEFINED') {
            bucket.pcs.add(rmPc);
          }

          // 2. Status Baseado Exatamente no JSON (Pendente, Aprovado, Reprovado)
          const statusRaw = String(rm.status || '').trim().toLowerCase();
          
          const isReprovado = statusRaw.includes('reprov') || statusRaw.includes('cancel');
          const isAprovado = statusRaw.includes('aprov') || statusRaw.includes('atendid') || statusRaw.includes('concluid');
          
          // Se não está aprovado nem reprovado, obrigatoriamente é Triagem (ex: "Pendente")
          const isEmTriagem = !isAprovado && !isReprovado;

          if (isReprovado) return; // Descarta sumariamente o que foi cancelado/reprovado

          // 3. Extração de Quantidades (A coluna real é 'quantidade', não 'quantidade_solicitada')
          const qtdSolicitada = Number(rm.quantidade || 0);
          const qtdAtendida = Number(rm.quantidade_atendida || 0);
          const tipoRM = String(rm.tipoRM || '').toLowerCase();
          const itemStatus = String(rm.item_status || '').toUpperCase();

          const rmNumber = String(rm.rmNumber ?? rm.rm_number ?? rm.numero ?? rm.id ?? 'S/N').trim();
          const rmNumberUpper = rmNumber.toUpperCase();
          const rmDigits = rmNumber.replace(/\D/g, '');

          // OVERRIDE MANUAL DE STATUS (Prioridade Máxima do Usuário)
          const statusForcado = rm.status_override_manual ? String(rm.status_override_manual).trim().toUpperCase() : null;
          if (statusForcado) {
            bucket.statusOverride = statusForcado;
            if (statusForcado === 'TRIAGEM' || statusForcado === 'EM TRIAGEM' || statusForcado === 'ANALISE') {
              bucket.emTriagem += qtdSolicitada;
              bucket.debugSources.push(`OVERRIDE: TRIAGEM | RM: ${rmNumber}`);
            } else if (statusForcado === 'COMPRA' || statusForcado === 'EM COMPRAS' || statusForcado === 'RM COMPRA') {
              bucket.demandaPreCotacao += qtdSolicitada;
              bucket.debugSources.push(`OVERRIDE: COMPRA | RM: ${rmNumber}`);
            } else if (statusForcado === 'SEPARADO' || statusForcado === 'ESTOQUE' || statusForcado === 'DISPONIVEL') {
              bucket.patioBruto += qtdSolicitada;
              bucket.debugSources.push(`OVERRIDE: SEPARADO | RM: ${rmNumber}`);
            } else if (statusForcado === 'MOBILIZADO' || statusForcado === 'ATENDIDO') {
              bucket.mobilizadoManual += qtdSolicitada;
              bucket.debugSources.push(`OVERRIDE: MOBILIZADO | RM: ${rmNumber}`);
            }
            return; // 🔴 Interrompe para respeitar o override como regra absoluta
          }

          // INTERCEPTAÇÃO DE INTANGÍVEIS SINALIZADOS MANUALMENTE
          const isIntangivel = /(LOCAÇÃO|LOCACAO|SERVIÇO|SERVICO|FACILITIES|CONSULTORIA)/.test(`${classe} ${descricao}`.toUpperCase());
          const isServicoSinalizado = itemStatus === 'MOBILIZADO';

          if (isIntangivel && isServicoSinalizado) {
            // Pula a fila de compras e joga a quantidade direto pro pátio (Mobilizado)
            const qtdMobilizada = qtdAtendida > 0 ? qtdAtendida : qtdSolicitada;
            bucket.mobilizadoManual += qtdMobilizada;
            bucket.debugSources.push(`SERVIÇO MOBILIZADO | RM: ${rmNumber}`);
            return; // 🔴 IMPORTANTE: interrompe o laço para o item não cair na lógica de compras padrão
          }

          // 4. Distribuição de Buckets (Regra de Negócio Absoluta)
          if (isEmTriagem) {
            if (qtdSolicitada > 0) {
              bucket.emTriagem += qtdSolicitada;
              bucket.debugSources.push(`TRIAGEM | RM: ${rmNumber}`);
            }
          } 
          else if (isAprovado) {
            const isCompra = tipoRM.includes('cotacao') || tipoRM.includes('cotação') || tipoRM.includes('compra') || itemStatus === 'COMPRA';
             
            if (isCompra) {
              // CRÍTICO: RMs de compra aprovadas muitas vezes têm qtd_atendida = 0 no banco.
              // Portanto, a demanda que vai para Suprimentos é a quantidade solicitada original (ou a atendida, se preenchida).
              const jaExisteNoBi = 
                pedidosBiRmSet.has(rmNumberUpper) ||
                (rmDigits.length > 0 && pedidosBiRmSet.has(rmDigits));

              if (!jaExisteNoBi) {
                const demandaCompra = qtdAtendida > 0 ? qtdAtendida : qtdSolicitada;
                if (demandaCompra > 0) {
                  bucket.demandaPreCotacao += demandaCompra;
                  bucket.debugSources.push(`RM COMPRA | RM: ${rmNumber}`);
                }
              }
            } else {
              // Para estoque interno, só conta como Disponível o que realmente foi separado (qtd_atendida > 0)
              if (qtdAtendida > 0) {
                bucket.patioBruto += qtdAtendida;
                bucket.debugSources.push(`RM ESTOQUE | RM: ${rmNumber}`);
              }
            }
          }
        });
      }

      // ----------------------------------------------------------------------
      // CONSOLIDAÇÃO FINAL COM TRANSPOSIÇÃO DE MOBILIZADOS E DEDUÇÃO DE PIPELINE
      // ----------------------------------------------------------------------
      const metricasConsolidadas: DashboardMetric[] = [];
      const remainingMobMap = new Map<string, number>(mobilizadosPorObraEItem);

      for (const bucket of bucketsMap.values()) {
        let emTriagem = bucket.emTriagem || 0;

        // 1. Detecta se o item é um serviço ou locação (Intangível)
        const textoVerificacao = `${bucket.classeFinanceira} ${bucket.descricao}`.toUpperCase();
        const isIntangivel = /(LOCAÇÃO|LOCACAO|SERVIÇO|SERVICO|FACILITIES|CONSULTORIA)/.test(textoVerificacao);

        let mobilizado = 0;
        let disponivel = 0;
        let emCompras = 0;
        let totalSolicitado = 0;

        if (isIntangivel) {
          // VIA EXPRESSA DE INTANGÍVEIS: Não passam por estoque físico.
          // Tudo que já foi comprado (tem pedido no BI) OU sinalizado como MOBILIZADO na RM é considerado "Mobilizado" na obra.
          const mobilizadoBI = bucket.saldoPedidosBI || 0;
          const mobilizadoManual = bucket.mobilizadoManual || 0;
          mobilizado = mobilizadoBI + mobilizadoManual;
          
          // O que sobra "Em Compras" é apenas a demanda da RM que o Comprador ainda não emitiu o Pedido nem foi sinalizada
          const demandaRM = bucket.demandaPreCotacao || 0;
          emCompras = Math.max(0, demandaRM - mobilizadoBI);
          
          // Garante que não crie falsos positivos no pátio físico
          disponivel = 0;
          
          // Refaz o total solicitado
          totalSolicitado = emTriagem + emCompras + mobilizado;
        } else {
          const mapKey = `${bucket.obra}|${bucket.codigo}|${bucket.descricao}`;
          const totalMobilizado = remainingMobMap.get(mapKey) || 0;

          // O bucket 'disponível' bruto contém RMs atendidas e Recebimentos (bucket.patioBruto).
          // Precisamos transpor a quantidade expedida dele para o 'mobilizado'.
          const brutoDisponivel = bucket.patioBruto || 0;

          // Evita mobilizar mais que o físico (se houver erro humano)
          mobilizado = Math.min(totalMobilizado, brutoDisponivel);
          remainingMobMap.set(mapKey, Math.max(0, totalMobilizado - mobilizado));

          // O saldo real no pátio (Disponível / Separado)
          disponivel = Math.max(0, brutoDisponivel - mobilizado);

          // Refaz o cálculo de Em Compras e Total Solicitado (Regra de Dedução de Pipeline)
          const demandaRM = bucket.demandaPreCotacao || 0;
          const saldoBI = bucket.saldoPedidosBI || 0;
          const totalFisico = disponivel + mobilizado;

          const pendenteDaRM = Math.max(0, demandaRM - saldoBI - totalFisico);
          emCompras = saldoBI + pendenteDaRM;

          totalSolicitado = emTriagem + emCompras + disponivel + mobilizado;
        }

        // PRIORIDADE MÁXIMA DE STATUS OVERRIDE MANUAL
        const statusForcado = bucket.statusOverride;
        let statusVisual = 'TRIAGEM';

        if (statusForcado) {
          statusVisual = statusForcado; // OVERRIDE TEM PRIORIDADE MÁXIMA
        } else if (mobilizado >= totalSolicitado && totalSolicitado > 0) {
          statusVisual = 'MOBILIZADO';
        } else if (disponivel > 0 && emCompras === 0) {
          statusVisual = 'ESTOQUE';
        } else if (emCompras > 0) {
          statusVisual = 'RM COMPRA';
        } else if (emTriagem > 0) {
          statusVisual = 'TRIAGEM';
        }

        if (statusForcado) {
          // O override move a totalidade do item para a coluna ditada pelo override
          const total = totalSolicitado > 0 ? totalSolicitado : (bucket.emTriagem + bucket.demandaPreCotacao + bucket.saldoPedidosBI + bucket.patioBruto + bucket.mobilizadoManual || 1);
          totalSolicitado = total;

          if (statusForcado === 'TRIAGEM' || statusForcado === 'EM TRIAGEM' || statusForcado === 'ANALISE') {
            emTriagem = total;
            emCompras = 0;
            disponivel = 0;
            mobilizado = 0;
            statusVisual = 'TRIAGEM';
          } else if (statusForcado === 'COMPRA' || statusForcado === 'EM COMPRAS' || statusForcado === 'RM COMPRA') {
            emCompras = total;
            emTriagem = 0;
            disponivel = 0;
            mobilizado = 0;
            statusVisual = 'COMPRA';
          } else if (statusForcado === 'SEPARADO' || statusForcado === 'ESTOQUE' || statusForcado === 'DISPONIVEL') {
            disponivel = total;
            emTriagem = 0;
            emCompras = 0;
            mobilizado = 0;
            statusVisual = 'SEPARADO';
          } else if (statusForcado === 'MOBILIZADO' || statusForcado === 'ATENDIDO') {
            mobilizado = total;
            emTriagem = 0;
            emCompras = 0;
            disponivel = 0;
            statusVisual = 'MOBILIZADO';
          }
        }

        // CÁLCULO DE PRAZO
        let statusPrazo: 'NO PRAZO' | 'ATRASADO' | 'SEM PREVISÃO' = 'SEM PREVISÃO'; // Default honesto

        if (emCompras > 0 && bucket.previsaoEntrega) {
          // Garante conversão segura de data ignorando fusos horários indesejados
          const prevStr = String(bucket.previsaoEntrega).trim();
          const dataPrev = new Date(prevStr + (prevStr.includes('T') ? '' : 'T12:00:00Z'));
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);

          if (!isNaN(dataPrev.getTime())) {
            // Se a data de previsão for menor que o dia de hoje, está atrasado
            if (dataPrev < hoje) {
              statusPrazo = 'ATRASADO';
            } else {
              statusPrazo = 'NO PRAZO';
            }
          }
        }

        const pcFinal = bucket.pcs.size > 0 ? Array.from(bucket.pcs).join(', ') : null;

        // Mantém apenas linhas que tenham alguma movimentação ou demanda
        if (totalSolicitado > 0 || disponivel > 0 || mobilizado > 0 || emCompras > 0 || emTriagem > 0) {
          metricasConsolidadas.push({
            obra: bucket.obra,
            classeFinanceira: bucket.classeFinanceira,
            codigo: bucket.codigo,
            descricao: bucket.descricao,
            totalSolicitado,
            emTriagem,
            emCompras,
            disponivel,
            mobilizado,
            previsaoEntrega: bucket.previsaoEntrega,
            statusPrazo,
            numero_pc: pcFinal,
            pedido_compra: pcFinal,
            pc: pcFinal,
            status_override_manual: bucket.statusOverride || null,
            statusCalculado: statusVisual,
            requisicaoIds: bucket.requisicaoIds,
            debugSources: bucket.debugSources
          });
        }
      }

      // Ordenação: Obra (alfabética) e depois Classe Financeira (alfabética)
      metricasConsolidadas.sort((a, b) => {
        const compObra = a.obra.localeCompare(b.obra, 'pt-BR');
        if (compObra !== 0) return compObra;
        return a.classeFinanceira.localeCompare(b.classeFinanceira, 'pt-BR');
      });

      setData(metricasConsolidadas);
    } catch (err: any) {
      console.error('Erro ao processar dados automatizados do Dashboard:', err);
      setError(err?.message || 'Erro desconhecido ao carregar dados do Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, [obrasFiltroKey]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Resumo analítico acumulado
  const summary: DashboardSummary = useMemo(() => {
    const obrasSet = new Set<string>();
    const classesSet = new Set<string>();

    let totalSolicitado = 0;
    let emTriagem = 0;
    let emCompras = 0;
    let disponivel = 0;
    let mobilizado = 0;

    data.forEach(item => {
      obrasSet.add(item.obra);
      classesSet.add(item.classeFinanceira);

      totalSolicitado += item.totalSolicitado;
      emTriagem += item.emTriagem;
      emCompras += item.emCompras;
      disponivel += item.disponivel;
      mobilizado += item.mobilizado;
    });

    return {
      totalSolicitado,
      emTriagem,
      emCompras,
      disponivel,
      mobilizado,
      obrasCount: obrasSet.size,
      classesCount: classesSet.size
    };
  }, [data]);

  // Lista global consolidada de classes únicas conhecidas
  const todasAsClassesUnicas: string[] = useMemo(() => {
    const setCls = new Set<string>();
    data.forEach(item => {
      if (item.classeFinanceira && item.classeFinanceira !== 'Sem Classe Vinculada') {
        setCls.add(item.classeFinanceira.trim());
      }
    });
    return Array.from(setCls).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data]);

  // Função de Ensino: Upsert / Insert no dicionário de classes do Supabase
  const vincularClasseManual = useCallback(async (codigoBruto: string, descricaoBruta: string, novaClasse: string): Promise<boolean> => {
    const { codigo, descricao } = separarCodigoEDescricao(descricaoBruta, codigoBruto);
    const classeLimpa = higienizarClasse(novaClasse);

    if (!descricao) {
      throw new Error('Descrição do material é obrigatória.');
    }
    if (!classeLimpa || classeLimpa === 'Sem Classe Vinculada') {
      throw new Error('Classe financeira selecionada é inválida.');
    }

    // Tenta upsert primário
    const { error: insertError } = await supabase.from('dicionario_classes').upsert(
      {
        codigo_material: codigo || null,
        descricao_material: descricao,
        classe_financeira: classeLimpa
      },
      { onConflict: 'codigo_material' }
    );

    if (insertError) {
      // Fallback para insert padrão caso onConflict não esteja configurado no schema
      const { error: rawInsertError } = await supabase.from('dicionario_classes').insert({
        codigo_material: codigo || null,
        descricao_material: descricao,
        classe_financeira: classeLimpa
      });

      if (rawInsertError) {
        throw rawInsertError;
      }
    }

    // Atualiza imediatamente a visualização e reprocessa as métricas
    await fetchDashboardData();
    return true;
  }, [fetchDashboardData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchDashboardData,
    summary,
    vincularClasseManual,
    todasAsClassesUnicas
  };
}
