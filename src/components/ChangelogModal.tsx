import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Clock, Rocket, RefreshCw } from 'lucide-react';

interface ChangelogEntry {
  id: string;
  versao: string;
  data_lancamento: string;
  titulo: string;
  descricao: string;
}

interface ChangelogModalProps {
  onClose: () => void;
  isAdmin: boolean;
}

export default function ChangelogModal({ onClose, isAdmin }: ChangelogModalProps) {
  const [logs, setLogs] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [novaVersao, setNovaVersao] = useState('');
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');

  const DEFAULT_DESCRIPTION_TEMPLATE = `🚀 Nova Funcionalidade:\n- \n\n🛠️ Correções:\n- \n\n⚙️ Ajustes:\n- `;

  const calculateNextVersion = (latestVersion?: string): string => {
    if (!latestVersion) return '1.0.0';
    const clean = latestVersion.trim().replace(/^v/i, '');
    const parts = clean.split('.');
    if (parts.length >= 1) {
      const lastIndex = parts.length - 1;
      const parsed = parseInt(parts[lastIndex], 10);
      if (!isNaN(parsed)) {
        parts[lastIndex] = String(parsed + 1);
        return parts.join('.');
      }
    }
    return '1.0.0';
  };

  const handleOpenForm = () => {
    const latestVersion = logs.length > 0 ? logs[0].versao : undefined;
    const nextVer = calculateNextVersion(latestVersion);
    setNovaVersao(nextVer);
    setNovoTitulo('');
    setNovaDescricao(DEFAULT_DESCRIPTION_TEMPLATE);
    setShowForm(true);
  };

  const fetchChangelog = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('changelog')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      // Map Supabase 'created_at' to our interface 'data_lancamento' if needed, or keep it consistent
      setLogs(data.map(item => ({
        id: item.id,
        versao: item.versao,
        titulo: item.titulo,
        descricao: item.descricao,
        data_lancamento: item.created_at
      })));
    } else {
      console.error('Error fetching changelog:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChangelog();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaVersao || !novoTitulo || !novaDescricao) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('changelog')
        .insert([{ versao: novaVersao, titulo: novoTitulo, descricao: novaDescricao }]);
      
      if (!error) {
        setNovaVersao('');
        setNovoTitulo('');
        setNovaDescricao('');
        setShowForm(false);
        fetchChangelog(); // Atualiza a lista imediatamente
      } else {
        console.error("Erro ao salvar atualização:", error);
        alert('Erro ao salvar atualização: ' + error.message);
      }
    } catch (error) {
      console.error('Error saving changelog:', error);
      alert('Erro inesperado ao salvar atualização.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Data não disponível';
    let date = timestamp;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    }
    
    // Natively format date without date-fns
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date).replace(' às ', ', às ');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg">Novidades do Portal</h2>
              <p className="text-xs text-slate-500">Histórico de atualizações</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 relative">
          {isAdmin && !showForm && (
            <button 
              onClick={handleOpenForm}
              className="w-full mb-6 py-3 border-2 border-dashed border-indigo-200 text-indigo-600 font-bold text-sm rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Atualização
            </button>
          )}

          {showForm && (
            <form onSubmit={handleSave} className="mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-700 text-sm">Registrar Nova Versão</h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 hover:bg-slate-100 rounded-md">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Versão</label>
                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Auto</span>
                  </div>
                  <input 
                    type="text" 
                    value={novaVersao}
                    readOnly
                    placeholder="1.0.0" 
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold cursor-not-allowed focus:outline-none select-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Título</label>
                  <input 
                    type="text" 
                    value={novoTitulo}
                    onChange={(e) => setNovoTitulo(e.target.value)}
                    placeholder="Resumo da entrega" 
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Descrição</label>
                <textarea 
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Detalhes das novas funcionalidades e correções..."
                  rows={4}
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-800"
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Salvar Registro
              </button>
            </form>
          )}

          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
            {loading ? (
              <div className="flex justify-center items-center py-10 pl-10 relative">
                <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-10 pl-10 relative">
                <p className="text-sm text-slate-500">Nenhum registro encontrado.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="relative flex items-start gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 bg-indigo-100 text-indigo-600 shadow-sm shrink-0 z-10">
                    <Clock className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm mt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">v{log.versao}</span>
                      <time className="text-[10px] font-semibold text-slate-400">{formatDate(log.data_lancamento)}</time>
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm mb-2 leading-tight">{log.titulo}</h4>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{log.descricao}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
