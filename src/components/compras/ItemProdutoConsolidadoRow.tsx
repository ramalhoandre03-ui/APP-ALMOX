import React, { useState } from 'react';
import { ItemProdutoConsolidado } from '../../types/compras';
import { formatBRL, formatNumberBR, formatDateBR, getForecastStatus } from '../../hooks/useAgrupamentoPedidos';
import { RateioDestinosSection } from './RateioDestinosSection';
import {
  Package,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface ItemProdutoConsolidadoRowProps {
  item: ItemProdutoConsolidado;
  index: number;
  showRateioInline?: boolean;
}

export function ItemProdutoConsolidadoRow({
  item,
  index,
  showRateioInline = false
}: ItemProdutoConsolidadoRowProps) {
  const [expandRateio, setExpandRateio] = useState<boolean>(showRateioInline);

  const forecastStatus = getForecastStatus(item.previsao_mais_recente);
  const formattedPrevisao = formatDateBR(item.previsao_mais_recente);

  const isTotalmenteEntregue = item.status_item === 'TOTALMENTE ENTREGUE';
  const isParcial = item.status_item === 'PARCIALMENTE ENTREGUE';

  return (
    <div className="bg-slate-950/60 hover:bg-slate-900/80 transition-all border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-sm">
      {/* LINHA PRINCIPAL DO ITEM */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        
        {/* LADO ESQUERDO: ÍCONE + DESCRIÇÃO DO PRODUTO */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
              isTotalmenteEntregue
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : isParcial
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Package className="w-4 h-4" />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-100 uppercase tracking-wide leading-snug">
                {item.produto_descricao}
              </span>
              
              {/* BADGE DE STATUS DE ATENDIMENTO DO ITEM */}
              {isTotalmenteEntregue ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  100% Entregue
                </span>
              ) : isParcial ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Parcial ({item.percentual_atendido}%)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Pendente
                </span>
              )}
            </div>

            {/* PREVISÃO DE ENTREGA E DESTINOS RÁPIDOS */}
            <div className="flex items-center gap-2.5 text-xs text-slate-400 flex-wrap">
              <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300">
                <Calendar className="w-3 h-3 text-amber-400" />
                <span>Previsão: <strong className="text-white">{formattedPrevisao}</strong></span>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border ${forecastStatus.bgStyle}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${forecastStatus.dotStyle}`} />
                {forecastStatus.label}
              </span>

              {item.rateios.length > 1 && (
                <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-800/40">
                  {item.rateios.length} Destinos / RMs
                </span>
              )}
            </div>
          </div>
        </div>

        {/* LADO DIREITO: QUANTIDADES, VALORES E PROGRESSO */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 sm:gap-6 border-t lg:border-t-0 border-slate-800/80 pt-2 lg:pt-0 shrink-0">
          
          {/* SOMA QUANTIDADE PEDIDA */}
          <div className="text-center sm:text-right space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Qtd Autorizada
            </span>
            <span className="text-sm font-black text-white font-mono">
              {formatNumberBR(item.quantidade_pedida_total)}
            </span>
          </div>

          {/* SOMA SALDO A RECEBER (PENDENTE) */}
          <div className="text-center sm:text-right space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Saldo a Receber
            </span>
            <span
              className={`text-sm font-black font-mono ${
                item.saldo_a_receber_total <= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {formatNumberBR(item.saldo_a_receber_total)}
            </span>
          </div>

          {/* VALOR UNITÁRIO & TOTAL */}
          {item.valor_total_produto > 0 && (
            <div className="text-center sm:text-right space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Valor Total Item
              </span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {formatBRL(item.valor_total_produto)}
              </span>
              {item.valor_unitario_medio > 0 && (
                <span className="text-[10px] text-slate-500 font-mono block">
                  Unit: {formatBRL(item.valor_unitario_medio)}
                </span>
              )}
            </div>
          )}

          {/* BOTÃO TOGGLE DE RATEIO DO ITEM */}
          {item.rateios.length > 0 && (
            <button
              type="button"
              onClick={() => setExpandRateio(!expandRateio)}
              className="p-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition cursor-pointer border border-slate-700 text-xs font-bold flex items-center gap-1.5"
              title={expandRateio ? 'Ocultar rateio deste item' : 'Ver rateio detalhado deste item'}
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Rateio ({item.rateios.length})</span>
              {expandRateio ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE PROGRESSO DE ATENDIMENTO DO ITEM */}
      {item.quantidade_pedida_total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>
              Entregue: <strong className="text-emerald-400">{formatNumberBR(item.qtd_recebida_total)}</strong> de {formatNumberBR(item.quantidade_pedida_total)} un
            </span>
            <span className="font-bold text-amber-400">{item.percentual_atendido}%</span>
          </div>

          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isTotalmenteEntregue ? 'bg-emerald-500' : isParcial ? 'bg-amber-500' : 'bg-slate-600'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, item.percentual_atendido))}%` }}
            />
          </div>
        </div>
      )}

      {/* SEÇÃO DETALHADA DE RATEIO EXPANDIDA PARA ESTE PRODUTO */}
      {expandRateio && (
        <div className="pt-2 border-t border-slate-800/80">
          <RateioDestinosSection rateios={item.rateios} compact={true} />
        </div>
      )}
    </div>
  );
}
