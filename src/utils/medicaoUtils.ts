import { ValorLocacao, MovimentacaoAtivo, ItemMedicaoCalculado } from '../types';

/**
 * Função de Sanitização Global:
 * Remove espaços no início e no fim (.trim()) e substitui múltiplos espaços em branco ou non-breaking spaces por um único espaço normal (.replace(/\s+/g, ' ')).
 */
export function sanitizeString(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Lógica de Lookup / Comparação de Centro de Custo (CC):
 * Compara dois CCs ou nomes de obra garantindo que ambos os lados estejam sanitizados, em caixa alta e sem zeros à esquerda.
 */
export function isSameCC(cc1: string | null | undefined, cc2: string | null | undefined): boolean {
  if (!cc1 || !cc2) return false;
  const clean1 = sanitizeString(cc1).toUpperCase();
  const clean2 = sanitizeString(cc2).toUpperCase();
  if (!clean1 || !clean2) return false;
  if (clean1 === clean2) return true;
  const norm1 = clean1.replace(/^0+/, '');
  const norm2 = clean2.replace(/^0+/, '');
  return norm1 === norm2 && norm1 !== '';
}

/**
 * Formata data YYYY-MM-DD para DD/MM/YYYY
 */
export function formatDateBR(dStr: string | null | undefined): string {
  if (!dStr || dStr === '-' || dStr === 'null') return '-';
  const cleanStr = dStr.trim().split('T')[0];
  const parts = cleanStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${day}/${month}/${year}`;
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${day}/${month}/${year}`;
    }
  }
  return dStr;
}

/**
 * Gera opções dinâmicas para o seletor de mês: 24 meses anteriores até 12 meses futuros
 */
export function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Exibir apenas meses do passado até o mês atual corrente (sem futuro)
  for (let offset = -24; offset <= 0; offset++) {
    const d = new Date(currentYear, currentMonth + offset, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const moStr = String(mo + 1).padStart(2, '0');
    const value = `${yr}-${moStr}`;
    const label = `${moStr}/${yr} - ${monthNames[mo]} de ${yr}`;
    options.push({ value, label });
  }

  return options;
}

/**
 * Regra Estrita: Calcula o total de dias que um ativo esteve alocado dentro dos limites do mês de referência (YYYY-MM).
 * @param dataEntradaStr Data de entrada (YYYY-MM-DD)
 * @param dataSaidaStr Data de saída opcional (YYYY-MM-DD ou null)
 * @param mesAnoRef Mês/Ano de referência (ex: "2026-08")
 */
export function calcularDiasMedicao(
  dataEntradaStr: string | null | undefined,
  dataSaidaStr: string | null | undefined,
  mesAnoRef: string
): number {
  if (!dataEntradaStr || !mesAnoRef) return 0;

  const refParts = mesAnoRef.trim().split('-');
  if (refParts.length < 2) return 0;
  const year = parseInt(refParts[0], 10);
  const month = parseInt(refParts[1], 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return 0;

  // Início e Fim do mês de referência (UTC midnight)
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));

  const parseDateUTC = (dStr: string): Date | null => {
    if (!dStr) return null;
    const cleanStr = dStr.trim().split('T')[0];
    const parts = cleanStr.split(/[-/]/).map(p => parseInt(p, 10));
    if (parts.length < 3 || parts.some(isNaN)) return null;
    if (parts[0] > 31) {
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    }
    if (parts[2] > 31) {
      return new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]));
    }
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  };

  const entryDate = parseDateUTC(dataEntradaStr);
  if (!entryDate) return 0;

  const exitDate = dataSaidaStr ? parseDateUTC(dataSaidaStr) : null;

  // Se entrou após o mês de referência
  if (entryDate > monthEnd) return 0;

  // Se saiu antes do mês de referência
  if (exitDate && exitDate < monthStart) return 0;

  // Data efetiva de início dentro do mês (INÍCIO MED.)
  const effectiveStart = entryDate < monthStart ? monthStart : entryDate;

  // Data efetiva de fim dentro do mês (FIM MED.)
  const effectiveEnd = exitDate ? (exitDate > monthEnd ? monthEnd : exitDate) : monthEnd;

  if (effectiveStart > effectiveEnd) return 0;

  const diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
  const rawDiffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Regra Estrita de Exclusão do Dia de Saída (Evitar Dupla Cobrança):
  // Se a ferramenta possui data_saida no mês (exitDate <= monthEnd),
  // a diferença é estritamente: (Data Fim - Data Início), sem somar +1.
  // Apenas se a ferramenta NÃO tiver saído no mês (continua alocada até/além do fim do mês), adiciona +1.
  const hasExitedInMonth = Boolean(exitDate && exitDate <= monthEnd);

  const diffDays = hasExitedInMonth ? rawDiffDays : rawDiffDays + 1;

  return Math.max(0, diffDays);
}

/**
 * Realiza o Left Join lógico entre movimentacoes_ativos e valores_locacao usando cod_material,
 * calculando os dias, período medido e valores totais para o mês de referência informado.
 */
export function consolidarMedicaoMensal(
  movimentacoes: MovimentacaoAtivo[],
  valoresLocacao: ValorLocacao[],
  mesAnoRef: string
): ItemMedicaoCalculado[] {
  const mapaValores = new Map<string, ValorLocacao>();
  valoresLocacao.forEach(v => {
    if (v.cod_material) {
      mapaValores.set(String(v.cod_material).trim().toLowerCase(), v);
    }
  });

  const refParts = (mesAnoRef || '').trim().split('-');
  const year = parseInt(refParts[0] || '0', 10);
  const month = parseInt(refParts[1] || '0', 10);

  let primeiroDiaMesStr = '';
  let ultimoDiaMesStr = '';

  if (year > 0 && month >= 1 && month <= 12) {
    const pDate = new Date(Date.UTC(year, month - 1, 1));
    const uDate = new Date(Date.UTC(year, month, 0));

    primeiroDiaMesStr = pDate.toISOString().split('T')[0];
    ultimoDiaMesStr = uDate.toISOString().split('T')[0];
  }

  const parseDateUTC = (dStr: string): Date | null => {
    if (!dStr) return null;
    const cleanStr = dStr.trim().split('T')[0];
    const parts = cleanStr.split(/[-/]/).map(p => parseInt(p, 10));
    if (parts.length < 3 || parts.some(isNaN)) return null;
    if (parts[0] > 31) {
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    }
    if (parts[2] > 31) {
      return new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]));
    }
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  };

  return movimentacoes.map(mov => {
    // REGRA ESPECIAL DE REAPROVEITAMENTO (TAXA ÚNICA)
    if (mov.modalidade === 'REAPROVEITAMENTO') {
      const entMes = mov.data_entrada ? String(mov.data_entrada).trim().substring(0, 7) : '';
      const isNoMes = entMes === mesAnoRef;

      let desc = mov.descricao || '';
      if (mov.quantidade && Number(mov.quantidade) > 0 && !desc.startsWith('[')) {
        desc = `[${mov.quantidade} UN] - ${desc}`;
      }

      const valReap = Number(mov.valor_reaproveitamento) || 0;

      return {
        id: mov.id,
        obra_id: mov.obra_id,
        tag: mov.tag,
        cod_material: mov.cod_material,
        descricao: desc,
        data_entrada: mov.data_entrada,
        data_saida: mov.data_saida || mov.data_entrada,
        inicio_medicao: isNoMes ? mov.data_entrada : null,
        fim_medicao: isNoMes ? (mov.data_saida || mov.data_entrada) : null,
        dias_medidos: isNoMes ? 1 : 0,
        valor_mensal: 0,
        valor_diario: 0,
        valor_total_item: isNoMes ? valReap : 0,
        tem_preco: true,
        classe: 'REAPROVEITAMENTO',
        modalidade: 'REAPROVEITAMENTO',
        valor_reaproveitamento: valReap,
        quantidade: mov.quantidade || 1,
        rm_referencia: mov.rm_referencia
      };
    }

    const codKey = String(mov.cod_material || '').trim().toLowerCase();
    const valObj = mapaValores.get(codKey);

    const dias = calcularDiasMedicao(mov.data_entrada, mov.data_saida, mesAnoRef);

    let inicioMedicaoStr: string | null = null;
    let fimMedicaoStr: string | null = null;

    if (year > 0 && month >= 1 && month <= 12) {
      const entryDate = parseDateUTC(mov.data_entrada);
      const exitDate = mov.data_saida ? parseDateUTC(mov.data_saida) : null;
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 0));

      // Verifica se o item esteve presente na obra no mês de referência
      if (entryDate && entryDate <= monthEnd && (!exitDate || exitDate >= monthStart)) {
        if (entryDate > monthStart) {
          const y = entryDate.getUTCFullYear();
          const m = String(entryDate.getUTCMonth() + 1).padStart(2, '0');
          const d = String(entryDate.getUTCDate()).padStart(2, '0');
          inicioMedicaoStr = `${y}-${m}-${d}`;
        } else {
          inicioMedicaoStr = primeiroDiaMesStr;
        }

        if (exitDate && exitDate <= monthEnd) {
          const y = exitDate.getUTCFullYear();
          const m = String(exitDate.getUTCMonth() + 1).padStart(2, '0');
          const d = String(exitDate.getUTCDate()).padStart(2, '0');
          fimMedicaoStr = `${y}-${m}-${d}`;
        } else {
          fimMedicaoStr = ultimoDiaMesStr;
        }
      }
    }

    const valorMensal = valObj ? Number(valObj.valor_mensal) || 0 : 0;
    const valorDiario = valObj 
      ? (Number(valObj.valor_diario) || (valorMensal > 0 ? valorMensal / 30 : 0))
      : 0;

    const temPreco = Boolean(valObj && (valObj.valor_mensal > 0 || valObj.valor_diario > 0));
    const rawTotal = dias * valorDiario;
    const valorTotalItem = isNaN(rawTotal) ? 0 : Math.max(0, rawTotal);

    return {
      id: mov.id,
      obra_id: mov.obra_id,
      tag: mov.tag,
      cod_material: mov.cod_material,
      descricao: mov.descricao || (valObj ? valObj.descricao : ''),
      data_entrada: mov.data_entrada,
      data_saida: mov.data_saida,
      inicio_medicao: inicioMedicaoStr,
      fim_medicao: fimMedicaoStr,
      dias_medidos: dias,
      valor_mensal: valorMensal,
      valor_diario: valorDiario,
      valor_total_item: valorTotalItem,
      tem_preco: temPreco,
      classe: valObj ? (valObj.classe || '') : '',
      modalidade: mov.modalidade || 'LOCACAO',
      valor_reaproveitamento: mov.valor_reaproveitamento || null,
      quantidade: mov.quantidade || null,
      rm_referencia: mov.rm_referencia || null
    };
  });
}

/**
 * Formata valor para moeda BRL
 */
export function formatCurrencyBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val || 0);
}
