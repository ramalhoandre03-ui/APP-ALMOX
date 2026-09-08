import React, { useState } from 'react';
import { 
  X, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Package, 
  ShoppingCart, 
  Truck, 
  Clock, 
  Building2, 
  Hash, 
  FileText 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ItemMobilizacao } from './MobilizacaoView';

export interface ModalAjusteStatusManualProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemMobilizacao | null;
  onSuccess: () => Promise<void> | void;
}

export type StatusOverrideOption = 'TRIAGEM' | 'COMPRA' | 'SEPARADO' | 'MOBILIZADO';

export default function ModalAjusteStatusManual({
  isOpen,
  onClose,
  item,
  onSuccess
}: ModalAjusteStatusManualProps) {
  const [selectedStatus, setSelectedStatus] = useState<StatusOverrideOption | 'REMOVER' | null>(
    (item?.status_override_manual as StatusOverrideOption) || null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when modal opens or item changes
  React.useEffect(() => {
    if (item) {
      setSelectedStatus((item.status_override_manual as StatusOverrideOption) || null);
      setErrorMsg(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const descItem = item['Descrição do item'] || item.descricao || 'Item sem Descrição';
  const codItem = item['Código do item'] || item.codigo || '';
  const nomeObra = item.nome_arquivo || item.centroCusto || item.obra || 'Geral';
  const statusCalculadoAtual = item.statusCalculado || (
    item.qtdMobilizado >= item.qtdSolicitada && item.qtdSolicitada > 0 ? 'MOBILIZADO' :
    item.qtdSeparado > 0 && (item.emCompras ?? item.qtdCompra ?? 0) === 0 ? 'SEPARADO' :
    (item.emCompras ?? item.qtdCompra ?? 0) > 0 ? 'COMPRA' : 'TRIAGEM'
  );

  const statusOptions: {
    id: StatusOverrideOption;
    label: string;
    description: string;
    icon: React.ElementType;
    activeBorder: string;
    activeBg: string;
    textColor: string;
    badgeBg: string;
  }[] = [
    {
      id: 'TRIAGEM',
      label: 'EM TRIAGEM',
      description: 'Item em análise inicial ou aguardando aprovação.',
      icon: Clock,
      activeBorder: 'border-rose-500',
      activeBg: 'bg-rose-500/10',
      textColor: 'text-rose-400',
      badgeBg: 'bg-rose-500/20 border-rose-500/30 text-rose-300'
    },
    {
      id: 'COMPRA',
      label: 'EM COMPRAS',
      description: 'Demanda enviada para cotação e compra em Suprimentos.',
      icon: ShoppingCart,
      activeBorder: 'border-amber-500',
      activeBg: 'bg-amber-500/10',
      textColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/20 border-amber-500/30 text-amber-300'
    },
    {
      id: 'SEPARADO',
      label: 'SEPARADO / DISPONÍVEL',
      description: 'Material recebido ou separado fisicamente no pátio.',
      icon: Package,
      activeBorder: 'border-emerald-500',
      activeBg: 'bg-emerald-500/10',
      textColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
    },
    {
      id: 'MOBILIZADO',
      label: 'MOBILIZADO NA OBRA',
      description: 'Item fisicamente entregue e mobilizado no destino final.',
      icon: Truck,
      activeBorder: 'border-blue-500',
      activeBg: 'bg-blue-500/10',
      textColor: 'text-blue-400',
      badgeBg: 'bg-blue-500/20 border-blue-500/30 text-blue-300'
    }
  ];

  const handleSalvar = async () => {
    try {
      setIsSaving(true);
      setErrorMsg(null);

      const novoStatus = selectedStatus === 'REMOVER' ? null : selectedStatus;

      // 1. Tenta atualizar pelos IDs diretos das requisições mapeadas
      let updated = false;
      if (item.requisicaoIds && Array.isArray(item.requisicaoIds) && item.requisicaoIds.length > 0) {
        const { error } = await supabase
          .from('requisicoes')
          .update({ status_override_manual: novoStatus })
          .in('id', item.requisicaoIds);

        if (!error) {
          updated = true;
        } else {
          console.warn('Falha no update por ID, tentando fallback por código/material:', error);
        }
      }

      // 2. Fallback por código ou material e centro de custo se não houver IDs ou erro no update
      if (!updated) {
        let query = supabase.from('requisicoes').update({ status_override_manual: novoStatus });
        
        if (codItem) {
          query = query.or(`codigo.eq.${codItem},codigo_material.eq.${codItem},codigo_item.eq.${codItem}`);
        } else if (descItem) {
          query = query.ilike('material', `%${descItem}%`);
        }

        const { error } = await query;
        if (error) {
          throw error;
        }
      }

      // 3. Callback de sucesso para recarregar o dashboard
      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar override manual de status:', err);
      setErrorMsg(err?.message || 'Falha ao salvar no banco de dados. Verifique sua conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <SlidersHorizontal className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-black uppercase text-white tracking-tight flex items-center gap-2">
                Ajuste Manual de Status
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold">
                  OVERRIDE
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Forçar coluna de auditoria física na mobilização
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
          
          {/* Card Informativo do Item */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-bold text-slate-300">{nomeObra}</span>
                </div>
                <h4 className="text-xs font-bold text-white leading-snug">
                  {descItem}
                </h4>
                {codItem && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                    <Hash className="w-3 h-3 text-slate-500" />
                    <span>Cód: {codItem}</span>
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Solicitada</span>
                <span className="text-sm font-black font-mono text-amber-400">
                  {item.qtdSolicitada.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Status Calculado Atual vs Override */}
            <div className="pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Status do Sistema:</span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {statusCalculadoAtual}
                </span>
              </div>

              {item.status_override_manual && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-amber-400/80 uppercase font-medium">Override Atual:</span>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    {item.status_override_manual}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Seletor de Novo Status */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Selecione o Status Forçado:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {statusOptions.map((opt) => {
                const isSelected = selectedStatus === opt.id;
                const IconComponent = opt.icon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedStatus(opt.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected 
                        ? `${opt.activeBorder} ${opt.activeBg} ring-1 ${opt.activeBorder} shadow-lg` 
                        : 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <IconComponent className={`w-4 h-4 ${isSelected ? opt.textColor : 'text-slate-400'}`} />
                        <span className={`text-xs font-black uppercase tracking-tight ${isSelected ? opt.textColor : 'text-white'}`}>
                          {opt.label}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className={`w-4 h-4 ${opt.textColor}`} />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opção para Remover Override */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setSelectedStatus('REMOVER')}
              className={`w-full p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                selectedStatus === 'REMOVER'
                  ? 'border-slate-600 bg-slate-800 text-white shadow-md'
                  : 'border-slate-800/80 bg-slate-950/30 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Remover Override (Obedecer cálculos automáticos do sistema)</span>
            </button>
          </div>

          {/* Mensagem de Erro se houver */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSalvar}
            disabled={isSaving || selectedStatus === null}
            className="px-5 py-2 text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmar Ajuste</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
