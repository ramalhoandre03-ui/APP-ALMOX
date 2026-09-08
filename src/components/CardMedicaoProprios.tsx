import React, { useState, useEffect } from 'react';
import { DollarSign, Building2, ArrowRight, Loader2, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { consolidarMedicaoMensal, formatCurrencyBRL } from '../utils/medicaoUtils';

interface CardMedicaoPropriosProps {
  onNavigate: (tab?: string) => void;
}

export interface ObraFaturamento {
  nome: string;
  total: number;
  percent: number;
}

export interface ClasseFaturamento {
  classe: string;
  total: number;
  percent: number;
}

export async function fetchResumoMedicaoMesAtual() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const mesAnoRef = `${year}-${month}`;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const nomeMes = `${monthNames[now.getMonth()]} de ${year}`;

  try {
    // 1. Fetch obras_medicao com status === true (obras ativas)
    const { data: dbObras, error: errObras } = await supabase
      .from('obras_medicao')
      .select('id, status, numero_cc, nome_obra')
      .eq('status', true);

    if (errObras || !dbObras || dbObras.length === 0) {
      return { valorTotal: 0, obrasAtivasCount: 0, mesAnoRef, nomeMes, topObras: [], topClasses: [] };
    }

    const idsObrasAtivas = dbObras.map(o => o.id);
    const mapaNomesObras = new Map<string, string>();
    dbObras.forEach(o => {
      const name = o.numero_cc ? `${o.numero_cc} - ${o.nome_obra}` : o.nome_obra;
      mapaNomesObras.set(o.id, name);
    });

    // 2. Fetch movimentacoes_ativos e valores_locacao
    const [resMovs, resVals] = await Promise.all([
      supabase.from('movimentacoes_ativos').select('id, obra_id, tag, cod_material, descricao, data_entrada, data_saida').in('obra_id', idsObrasAtivas),
      supabase.from('valores_locacao').select('cod_material, descricao, valor_mensal, valor_diario, classe')
    ]);

    const movimentacoes = resMovs.data || [];
    const valoresLocacao = resVals.data || [];

    // 3. Consolidar usando a regra de diárias
    const consolidado = consolidarMedicaoMensal(movimentacoes, valoresLocacao, mesAnoRef);

    let valorTotal = 0;
    const porObraMap = new Map<string, number>();
    const porClasseMap = new Map<string, number>();

    consolidado.forEach(item => {
      const val = item.valor_total_item || 0;
      valorTotal += val;

      // Group by Obra (Reduce por Obra)
      const obraNome = mapaNomesObras.get(item.obra_id) || 'Outra Obra';
      porObraMap.set(obraNome, (porObraMap.get(obraNome) || 0) + val);

      // Group by Classe (Reduce por Classe)
      const cl = item.classe && item.classe.trim() ? item.classe.trim().toUpperCase() : 'SEM CLASSE';
      porClasseMap.set(cl, (porClasseMap.get(cl) || 0) + val);
    });

    // Top Obras ordenadas do maior para o menor
    const topObras: ObraFaturamento[] = Array.from(porObraMap.entries())
      .map(([nome, total]) => ({
        nome,
        total,
        percent: valorTotal > 0 ? (total / valorTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    // Top Classes ordenadas do maior para o menor
    const topClasses: ClasseFaturamento[] = Array.from(porClasseMap.entries())
      .map(([classe, total]) => ({
        classe,
        total,
        percent: valorTotal > 0 ? (total / valorTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    return {
      valorTotal,
      obrasAtivasCount: idsObrasAtivas.length,
      mesAnoRef,
      nomeMes,
      topObras,
      topClasses
    };
  } catch (err) {
    console.error('Erro ao buscar resumo de medição do mês:', err);
    return { valorTotal: 0, obrasAtivasCount: 0, mesAnoRef, nomeMes, topObras: [], topClasses: [] };
  }
}

export default function CardMedicaoProprios({ onNavigate }: CardMedicaoPropriosProps) {
  const [loading, setLoading] = useState(true);
  const [valorTotal, setValorTotal] = useState(0);
  const [obrasCount, setObrasCount] = useState(0);
  const [nomeMes, setNomeMes] = useState('');
  const [topObras, setTopObras] = useState<ObraFaturamento[]>([]);
  const [topClasses, setTopClasses] = useState<ClasseFaturamento[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      const res = await fetchResumoMedicaoMesAtual();
      if (isMounted) {
        setValorTotal(res.valorTotal);
        setObrasCount(res.obrasAtivasCount);
        setNomeMes(res.nomeMes);
        setTopObras(res.topObras || []);
        setTopClasses(res.topClasses || []);
        setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div 
      onClick={() => onNavigate('bi')}
      className="bg-white rounded-3xl border border-slate-200 p-7 md:p-8 flex flex-col justify-between shadow-xs hover:shadow-lg transition-all duration-300 cursor-pointer group hover:border-emerald-500 relative overflow-hidden h-full"
      id="card-faturamento-proprios-kpi"
    >
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div>
        <div className="flex items-center justify-between">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
            <DollarSign className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 font-bold uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Torre de Controle
          </span>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider font-mono">
            Faturamento de Próprios (Mês Atual)
          </h3>

          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-slate-400 animate-pulse">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <div className="h-9 w-44 bg-slate-100 rounded-lg" />
            </div>
          ) : (
            <p className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 tracking-tight font-mono">
              {formatCurrencyBRL(valorTotal)}
            </p>
          )}
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
          {loading ? (
            <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-center gap-2 text-slate-600 font-sans">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs">Em operação em <strong className="text-slate-900 font-black">{obrasCount}</strong> {obrasCount === 1 ? 'obra' : 'obras'}</span>
            </div>
          )}

          <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
            {nomeMes || 'Mês Atual'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate('bi');
        }}
        className="w-full mt-8 bg-slate-900 hover:bg-emerald-600 text-white font-extrabold text-xs py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg shadow-emerald-100 uppercase tracking-wider active:scale-[0.98]"
      >
        <span>Acessar Medição de Próprios</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

