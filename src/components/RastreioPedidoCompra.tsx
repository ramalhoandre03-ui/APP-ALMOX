import React, { useState } from 'react';
import { 
  PackageSearch, 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  DollarSign, 
  Key, 
  FileText, 
  ChevronRight, 
  Tag, 
  RefreshCw,
  Clock,
  ShieldCheck,
  Server
} from 'lucide-react';

interface RastreioPedidoCompraProps {
  className?: string;
  onClose?: () => void;
  standalone?: boolean;
}

export default function RastreioPedidoCompra({ 
  className = '', 
  onClose,
  standalone = false 
}: RastreioPedidoCompraProps) {
  // 1. Estados
  const [orderId, setOrderId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  // 2. Função de Busca de Pedido (API Senior / Mega ERP)
  const handleBuscarPedido = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanId = orderId.trim();
    if (!cleanId) {
      setErro('Por favor, informe o ID ou número do Pedido de Compra.');
      setResultado(null);
      return;
    }

    setLoading(true);
    setErro(null);
    setResultado(null);

    try {
      // 1ª Tentativa: Via Proxy Backend para evitar CORS e ocultar API Key com segurança
      let proxyUrl = `/api/senior/purchase-order?orderId=${encodeURIComponent(cleanId)}`;
      if (customApiKey.trim()) {
        proxyUrl += `&apiKey=${encodeURIComponent(customApiKey.trim())}`;
      }

      const res = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        // Se o proxy retornou erro de autenticação ou não encontrado, verifica chamada direta como fallback
        if (json.status === 401 || json.status === 403) {
          throw new Error(
            'Chave de autorização Senior API inválida ou ausente. ' +
            'Por favor, configure a chave VITE_SENIOR_API_KEY no painel de segredos.'
          );
        }
        throw new Error(json.error || `Pedido de Compra nº ${cleanId} não localizado na plataforma Senior X.`);
      }

      // Sucesso na consulta
      setResultado(json.data || json);
    } catch (err: any) {
      console.error('Erro na consulta Senior API:', err);
      
      // Fallback em caso de erro de rede ou resposta customizada
      setErro(err.message || 'Falha ao conectar com o serviço Senior X Platform. Verifique a chave de API e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Helper de formatação de moeda
  const formatCurrency = (val: number | string | undefined) => {
    if (val === undefined || val === null || val === '') return 'R$ 0,00';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  // Helper de formatação de data
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all duration-300 ${className}`}>
      {/* Header do Card */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 border border-indigo-100 p-3 rounded-2xl shadow-2xs">
              <PackageSearch className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100 inline-block mb-1">
                API SENIOR / MEGA ERP
              </span>
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                Rastreamento de Pedido
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            title="Configurar Chave de API Senior"
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <Key className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-5 font-sans">
          Consulte o status e detalhes do Pedido de Compra diretamente na ponte <strong>Senior X Platform</strong> (erpx_sup_cpr).
        </p>

        {/* Input Opcional de API Key Personalizada */}
        {showKeyInput && (
          <div className="mb-4 p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 animate-in fade-in duration-200">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              Chave de API Senior (Authorization Token)
            </label>
            <input
              type="password"
              placeholder="Ex: Bearer eyJhbGciOi..."
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              className="w-full text-xs font-mono bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[10px] text-amber-700 mt-1">
              * Deixe em branco se a chave <code>VITE_SENIOR_API_KEY</code> estiver configurada nas variáveis de ambiente.
            </p>
          </div>
        )}

        {/* Formulário de Busca */}
        <form onSubmit={handleBuscarPedido} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Digite o ID do Pedido (Ex: 102938)..."
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              disabled={loading}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-slate-800 text-sm font-medium rounded-2xl pl-10 pr-24 py-3 transition-all outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            
            <button
              type="submit"
              disabled={loading || !orderId.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <span>Buscar</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-start gap-3 text-xs animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold text-rose-900 block">Falha na Consulta</strong>
              <p className="leading-relaxed">{erro}</p>
            </div>
          </div>
        )}

        {/* Área Condicional: Exibição dos Resultados do Pedido */}
        {resultado && (
          <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-slate-800 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                  Pedido #{resultado.orderNumber || resultado.orderId || orderId}
                </span>
              </div>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                resultado.orderStatus === 'APPROVED' || resultado.status === 'APROVADO'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : resultado.orderStatus === 'PENDING' || resultado.status === 'EM_APROVACAO'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {resultado.orderStatus || resultado.statusDescription || resultado.status || 'PROCESSADO'}
              </span>
            </div>

            {/* Grid de Informações Chave */}
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Fornecedor
                </span>
                <p className="font-semibold text-slate-800 truncate" title={resultado.supplierName || resultado.supplier || 'N/A'}>
                  {resultado.supplierName || resultado.supplier || resultado.vendorName || 'Fornecedor Cadastrado'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Data Emissão
                </span>
                <p className="font-semibold text-slate-800">
                  {formatDate(resultado.issueDate || resultado.createdDate || resultado.dataEmissao)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Valor Total
                </span>
                <p className="font-black text-indigo-700 text-sm">
                  {formatCurrency(resultado.netAmount || resultado.totalValue || resultado.valorTotal || resultado.amount)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                  <Server className="w-3 h-3" /> Origem ERP
                </span>
                <p className="font-semibold text-slate-700 text-xs">
                  {resultado.branch || resultado.empresa || 'Senior X Platform'}
                </p>
              </div>
            </div>

            {/* Detalhes Adicionais se Existirem */}
            {resultado.observation && (
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                <span className="font-bold text-slate-500 block mb-0.5">Observação:</span>
                <p className="bg-white p-2 rounded-xl border border-slate-150 leading-tight">
                  {resultado.observation}
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Atualizado agora via Bridge REST
              </span>
              <button
                type="button"
                onClick={() => handleBuscarPedido()}
                className="hover:text-indigo-600 underline font-bold cursor-pointer"
              >
                Atualizar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Informativo */}
      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>Endpoint: /purchase_orders/...</span>
        <span className="text-indigo-600 font-bold">Bridge 1.0</span>
      </div>
    </div>
  );
}
