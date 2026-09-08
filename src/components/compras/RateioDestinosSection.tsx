import React from 'react';
import { PedidoRateioDestino } from '../../types/compras';
import { formatBRL, formatNumberBR } from '../../hooks/useAgrupamentoPedidos';
import { Building2, FileText, Layers, PieChart, CheckCircle2, Clock, ArrowUpRight } from 'lucide-react';

interface RateioDestinosSectionProps {
  rateios: PedidoRateioDestino[];
  compact?: boolean;
  showProductTitle?: boolean;
  className?: string;
}

export function RateioDestinosSection({
  rateios,
  compact = false,
  showProductTitle = false,
  className = ''
}: RateioDestinosSectionProps) {
  if (!rateios || rateios.length === 0) {
    return (
      <div className="text-xs text-slate-500 italic p-3 bg-slate-900/50 rounded-xl border border-slate-800">
        Nenhum rateio ou centro de custo informado para este registro.
      </div>
    );
  }

  // Agrupamento por Centro de Custo para somatórios de rateio
  const rateioPorObra = React.useMemo(() => {
    const map = new Map<string, { totalQtd: number; totalValor: number; rms: Set<string>; count: number }>();
    rateios.forEach(r => {
      const cc = r.centro_custo || 'Não informado';
      if (!map.has(cc)) {
        map.set(cc, { totalQtd: 0, totalValor: 0, rms: new Set<string>(), count: 0 });
      }
      const entry = map.get(cc)!;
      entry.totalQtd += r.quantidade_pedida;
      entry.totalValor += r.valor_total_rateio;
      if (r.solicitacao && r.solicitacao !== 'RM-N/A') {
        entry.rms.add(r.solicitacao);
      }
      entry.count++;
    });
    return Array.from(map.entries()).map(([obra, data]) => ({
      obra,
      totalQtd: data.totalQtd,
      totalValor: data.totalValor,
      rms: Array.from(data.rms),
      count: data.count
    }));
  }, [rateios]);

  if (compact) {
    // Visualização compacta em formato de chips / pills solicitada pelo usuário
    // Exemplo visual: QTD: 400 | ALU CALC 2 SLZ 04-26 | RM: 11804
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {rateios.map((rateio, idx) => {
          const isTotalmenteEntregue = rateio.saldo_a_receber <= 0 && rateio.quantidade_pedida > 0;
          return (
            <div
              key={rateio.rawId || idx}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition shadow-sm ${
                isTotalmenteEntregue
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-amber-500/50'
              }`}
              title={`Produto: ${rateio.produto_descricao} | Saldo a Receber: ${rateio.saldo_a_receber} | Valor: ${formatBRL(rateio.valor_total_rateio)}`}
            >
              <span className="font-extrabold text-amber-400">
                QTD: {formatNumberBR(rateio.quantidade_pedida)}
              </span>

              <span className="text-slate-500">|</span>

              <span className="font-sans font-bold text-slate-100 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate max-w-[180px]">{rateio.centro_custo}</span>
              </span>

              <span className="text-slate-500">|</span>

              <span className="font-bold text-sky-300 flex items-center gap-1">
                <FileText className="w-3 h-3 text-sky-400 shrink-0" />
                <span>RM: {rateio.solicitacao}</span>
              </span>

              {rateio.saldo_a_receber > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans font-bold">
                  Falta: {formatNumberBR(rateio.saldo_a_receber)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* CABEÇALHO DO RATEIO COM RESUMO POR OBRA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Rateio Financeiro e Destinos de Custo
            </h4>
            <p className="text-[11px] text-slate-400">
              Distribuição fracionada entre Obras, Centros de Custo e Requisições (RMs)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold">
            {rateioPorObra.length} {rateioPorObra.length === 1 ? 'Centro de Custo' : 'Centros de Custo'}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-sky-950/60 border border-sky-800/60 text-sky-300 font-bold">
            {rateios.length} {rateios.length === 1 ? 'Fração / RM' : 'Frações / RMs'}
          </span>
        </div>
      </div>

      {/* CHIPS DE DESTAQUE COM O FORMATO ESPECIFICADO PELO USUÁRIO */}
      <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-2.5 shadow-inner">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>Detalhamento por Linha de Solicitação (Múltiplos Destinos)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {rateios.map((rateio, idx) => {
            const isTotalmenteEntregue = rateio.saldo_a_receber <= 0 && rateio.quantidade_pedida > 0;
            return (
              <div
                key={rateio.rawId || idx}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 shadow-sm ${
                  isTotalmenteEntregue
                    ? 'bg-emerald-950/30 border-emerald-500/30 hover:border-emerald-500/60'
                    : 'bg-slate-900/80 border-slate-700/80 hover:border-amber-400/60'
                }`}
              >
                {/* Linha 1: Formato solicitado pelo usuário */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-black border border-amber-500/30">
                      QTD: {formatNumberBR(rateio.quantidade_pedida)}
                    </span>
                    <span className="text-slate-600 font-bold">|</span>
                    <span className="font-sans font-bold text-slate-100 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate max-w-[200px]" title={rateio.centro_custo}>
                        {rateio.centro_custo}
                      </span>
                    </span>
                    <span className="text-slate-600 font-bold">|</span>
                    <span className="font-bold text-sky-400 flex items-center gap-1 bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-800/40">
                      <FileText className="w-3 h-3 text-sky-400 shrink-0" />
                      <span>RM: {rateio.solicitacao}</span>
                    </span>
                  </div>

                  {rateio.valor_total_rateio > 0 && (
                    <span className="text-xs font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {formatBRL(rateio.valor_total_rateio)}
                    </span>
                  )}
                </div>

                {/* Linha 2: Produto e Status de Entrega */}
                {showProductTitle && rateio.produto_descricao && (
                  <div className="text-[11px] text-slate-300 font-semibold line-clamp-1 border-t border-slate-800/60 pt-1.5 flex items-center justify-between gap-2">
                    <span className="truncate" title={rateio.produto_descricao}>
                      📦 {rateio.produto_descricao}
                    </span>
                    {rateio.saldo_a_receber > 0 ? (
                      <span className="text-[10px] text-amber-400 font-mono font-bold shrink-0">
                        Pendente: {formatNumberBR(rateio.saldo_a_receber)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Entregue
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RESUMO CONSOLIDADO POR CENTRO DE CUSTO / OBRA */}
      {rateioPorObra.length > 1 && (
        <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-xs space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Totais Consolidados por Obra / Centro de Custo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {rateioPorObra.map((obraData, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-1.5"
              >
                <div className="font-bold text-slate-200 truncate" title={obraData.obra}>
                  {obraData.obra}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-850 pt-1">
                  <span>Qtd: <strong className="text-amber-400">{formatNumberBR(obraData.totalQtd)}</strong></span>
                  {obraData.totalValor > 0 && (
                    <span className="text-emerald-400 font-bold">{formatBRL(obraData.totalValor)}</span>
                  )}
                </div>
                {obraData.rms.length > 0 && (
                  <div className="text-[10px] text-sky-400 font-mono flex items-center gap-1">
                    <span>RMs:</span>
                    <span className="truncate">{obraData.rms.join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
