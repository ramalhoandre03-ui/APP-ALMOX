import React, { useState } from 'react';
import { PedidoCompraDocumento } from '../../types/compras';
import {
  formatBRL,
  formatNumberBR,
  formatDateBR,
  getStatusBadgeStyle,
  getForecastStatus
} from '../../hooks/useAgrupamentoPedidos';
import { ItemProdutoConsolidadoRow } from './ItemProdutoConsolidadoRow';
import { RateioDestinosSection } from './RateioDestinosSection';
import {
  FileText,
  Building2,
  UserCheck,
  Calendar,
  DollarSign,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Printer,
  ExternalLink,
  ShieldCheck,
  Tag
} from 'lucide-react';

interface PedidoDocumentoCardProps {
  documento: PedidoCompraDocumento;
  defaultExpanded?: boolean;
  recebimentoBalcao?: any;
}

export function PedidoDocumentoCard({
  documento,
  defaultExpanded = true,
  recebimentoBalcao
}: PedidoDocumentoCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'itens' | 'rateio'>('itens');
  const [copied, setCopied] = useState<boolean>(false);

  const statusStyle = getStatusBadgeStyle(documento.status_pedido);
  const forecastStatus = getForecastStatus(documento.previsao_entrega_destaque);
  const formattedEmissao = formatDateBR(documento.data_emissao);
  const formattedPrevisao = formatDateBR(documento.previsao_entrega_destaque);

  const isTotalmenteEntregue = documento.saldo_total_a_receber <= 0 && documento.quantidade_total_pedida > 0;
  const isParcial = documento.quantidade_total_recebida > 0 && documento.saldo_total_a_receber > 0;

  // Recebimento Balcão Realtime
  const temNoBalcao = !!(
    recebimentoBalcao && (
      Number(recebimentoBalcao.qtd_recebida || 0) > 0 ||
      Number(recebimentoBalcao.qtd_entregue || 0) > 0 ||
      Number(recebimentoBalcao.quantidade || 0) > 0 ||
      (recebimentoBalcao.status_fisico && String(recebimentoBalcao.status_fisico).toLowerCase() !== 'pendente')
    )
  );

  const handleCopyResumo = () => {
    const texto = `PEDIDO DE COMPRA: ${documento.pedido}
Fornecedor: ${documento.fornecedor}
Comprador: ${documento.comprador_real}
Status ERP: ${documento.status_pedido}
Emissão: ${formattedEmissao} | Previsão: ${formattedPrevisao}
Valor Líquido Total: ${formatBRL(documento.valor_liquido_total)}
Qtd Autorizada: ${formatNumberBR(documento.quantidade_total_pedida)} | Saldo Pendente: ${formatNumberBR(documento.saldo_total_a_receber)}
RMs Vinculadas: ${documento.rms_unicas.join(', ') || 'N/A'}
Centros de Custo: ${documento.centros_custo_unicos.join(' | ') || 'N/A'}`;

    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-3xl border transition-all duration-300 shadow-xl overflow-hidden font-sans ${
        isTotalmenteEntregue
          ? 'bg-slate-900/95 border-slate-700/80 hover:border-emerald-500/40'
          : 'bg-slate-900/95 border-slate-800 hover:border-amber-500/40'
      }`}
      id={`pedido-doc-${documento.pedido}`}
    >
      {/* 1. CAPA DO DOCUMENTO (CABEÇALHO DO PEDIDO DE COMPRA) */}
      <div className="p-5 lg:p-6 bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 space-y-4">
        
        {/* LINHA SUPERIOR DO CABEÇALHO: NÚMERO DO PEDIDO, STATUS E VALOR LÍQUIDO TOTAL */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* IDENTIFICAÇÃO DO PEDIDO DE COMPRA */}
          <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black tracking-widest text-amber-400 uppercase bg-amber-500/15 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                  Pedido de Compra
                </span>

                <h3 className="text-lg lg:text-xl font-black text-white font-mono tracking-tight">
                  {documento.pedido}
                </h3>

                {/* STATUS DO PEDIDO */}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 border ${statusStyle.bg}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                  {statusStyle.label}
                </span>

                {/* RECEBIDO NO BALCÃO (A LANÇAR) */}
                {temNoBalcao && (
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border shadow-sm"
                    style={{ backgroundColor: '#ff9800', color: '#ffffff', borderColor: '#f57c00' }}
                    title={recebimentoBalcao?.conferente ? `Conferido no balcão por: ${recebimentoBalcao.conferente}` : 'Material físico recebido no almoxarifado (A lançar no ERP)'}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    RECEBIDO FÍSICO (BALCÃO)
                  </span>
                )}
              </div>

              {/* FORNECEDOR COM DESTAQUE */}
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm truncate" title={documento.fornecedor}>
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-white font-bold truncate">{documento.fornecedor}</span>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: VALOR LÍQUIDO TOTAL DO PEDIDO E BOTÕES DE AÇÃO */}
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-4 w-full md:w-auto border-t md:border-t-0 border-slate-800 pt-3 md:pt-0 shrink-0">
            
            {/* VALOR LÍQUIDO TOTAL DO PEDIDO (SOMA DAS LINHAS) */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 px-4 text-right shadow-inner min-w-[170px]">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Valor Líquido Total
              </span>
              <span className="text-base lg:text-lg font-black text-emerald-400 font-mono tracking-tight">
                {formatBRL(documento.valor_liquido_total)}
              </span>
            </div>

            {/* BOTÕES DE CONTROLE E EXPANSÃO */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyResumo}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700 shadow-sm flex items-center gap-1.5 text-xs font-bold"
                title="Copiar espelho resumido deste pedido"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
                title={isExpanded ? 'Recolher detalhes' : 'Expandir itens e rateios'}
              >
                <span>{isExpanded ? 'Ocultar' : 'Ver Documento'}</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* LINHA DE METADADOS: COMPRADOR, DATAS, RMS E OBRAS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
          
          {/* COMPRADOR */}
          <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Comprador</span>
              <span className="font-bold text-slate-200 truncate block" title={documento.comprador_real}>
                {documento.comprador_real}
              </span>
            </div>
          </div>

          {/* DATA DE EMISSÃO */}
          <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Data Emissão</span>
              <span className="font-bold text-slate-200 font-mono block">
                {formattedEmissao}
              </span>
            </div>
          </div>

          {/* PREVISÃO DE ENTREGA */}
          <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Previsão Entrega</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-white font-mono">{formattedPrevisao}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase ${forecastStatus.bgStyle}`}
                >
                  {forecastStatus.label}
                </span>
              </div>
            </div>
          </div>

          {/* TOTAL DE PRODUTOS E RMS VINCULADAS */}
          <div className="flex items-center gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
            <Package className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Itens / RM's</span>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-200 truncate">
                <span className="text-amber-400">{documento.total_itens_distintos} itens</span>
                <span className="text-slate-600">•</span>
                <span className="text-sky-400" title={documento.rms_unicas.join(', ')}>
                  {documento.rms_unicas.length} RM(s)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESSO GERAL DO PEDIDO E TAGS DE RATEIO RÁPIDAS */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400">Atendimento Global:</span>
              <span className="font-bold text-emerald-400">
                {formatNumberBR(documento.quantidade_total_recebida)} un recebidas
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-white font-bold">
                {formatNumberBR(documento.quantidade_total_pedida)} un autorizadas
              </span>
              {documento.saldo_total_a_receber > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black">
                  Saldo Pendente: {formatNumberBR(documento.saldo_total_a_receber)} un
                </span>
              )}
            </div>

            <div className="font-bold text-amber-400">
              {documento.percentual_geral_atendido}% Concluído
            </div>
          </div>

          {/* BARRA DE PROGRESSO DO PEDIDO */}
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isTotalmenteEntregue
                  ? 'bg-emerald-500'
                  : isParcial
                  ? 'bg-amber-500'
                  : 'bg-slate-600'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, documento.percentual_geral_atendido))}%` }}
            />
          </div>

          {/* CENTROS DE CUSTO / OBRAS ENVOLVIDAS NO PEDIDO */}
          {documento.centros_custo_unicos.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-[11px] no-scrollbar">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] shrink-0 flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-500" />
                Destinos:
              </span>
              {documento.centros_custo_unicos.map((cc) => (
                <span
                  key={cc}
                  className="px-2.5 py-0.5 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700 font-sans font-medium shrink-0"
                >
                  {cc}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CORPO EXPANSÍVEL: 2. RELAÇÃO DE ITENS E 3. RATEIO FINANCEIRO */}
      {isExpanded && (
        <div className="p-4 lg:p-6 space-y-6 bg-slate-900/60">
          
          {/* NAVEGAÇÃO DE ABAS INTERNAS DO DOCUMENTO */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('itens')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border flex items-center gap-2 ${
                  activeTab === 'itens'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Relação de Itens Consolidados ({documento.itens.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('rateio')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border flex items-center gap-2 ${
                  activeTab === 'rateio'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Rateio & Múltiplos Destinos ({documento.rateios_gerais.length})</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Base Supabase: <strong className="text-slate-200">{documento.linhas_originais_count} registros</strong>
            </div>
          </div>

          {/* ABA 1: 2. RELAÇÃO DE ITENS (PRODUTOS CONSOLIDADOS) */}
          {activeTab === 'itens' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                  Produtos Agrupados por Descrição com Somatório de Qtd e Saldo a Receber
                </span>
                <span className="text-[11px] text-amber-400 font-mono font-bold">
                  {documento.itens.length} {documento.itens.length === 1 ? 'item diferente' : 'itens diferentes'}
                </span>
              </div>

              <div className="space-y-3">
                {documento.itens.map((item, idx) => (
                  <ItemProdutoConsolidadoRow
                    key={item.id_produto || idx}
                    item={item}
                    index={idx}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ABA 2: 3. RATEIO FINANCEIRO E CUSTOS (MÚLTIPLOS DESTINOS) */}
          {activeTab === 'rateio' && (
            <div className="space-y-4">
              <RateioDestinosSection
                rateios={documento.rateios_gerais}
                showProductTitle={true}
                compact={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
