import { useState } from 'react';
import { ShoppingCart, Plus, Trash2, User, Calendar, DollarSign, Tag, Check } from 'lucide-react';
import { useSkywalker } from '../../contexts/SkywalkerContext';
import { TIPOS_VENDA } from './types';
import type { TipoVenda } from './types';

export function InputVendas() {
  const { colaboradores, vendas, addVenda, mesAtual } = useSkywalker();

  const [formData, setFormData] = useState({
    colaborador_id: '',
    tipo: 'store_plus' as TipoVenda,
    valor: '',
    data_venda: new Date().toISOString().split('T')[0],
    observacoes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.colaborador_id) return;

    setSubmitting(true);
    const result = await addVenda({
      colaborador_id: formData.colaborador_id,
      tipo: formData.tipo,
      valor: parseFloat(formData.valor) || 0,
      data_venda: formData.data_venda,
      mes_referencia: mesAtual,
      observacoes: formData.observacoes
    });

    if (result) {
      setSuccess(true);
      setFormData(prev => ({
        ...prev,
        valor: '',
        observacoes: ''
      }));
      setTimeout(() => setSuccess(false), 2000);
    }
    setSubmitting(false);
  };

  const getColaboradorNome = (id: string) => {
    const colab = colaboradores.find(c => c.id === id);
    return colab?.usuario?.nome || 'Colaborador';
  };

  const vendasRecentes = vendas.slice(0, 20);

  const estatisticas = {
    total: vendas.length,
    storePlus: vendas.filter(v => v.tipo === 'store_plus').length,
    carePlus: vendas.filter(v => v.tipo === 'care_plus').length,
    smb: vendas.filter(v => v.tipo === 'smb').length,
    valorTotal: vendas.reduce((sum, v) => sum + (v.valor || 0), 0)
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30">
          <ShoppingCart className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Input de Vendas</h2>
          <p className="text-gray-400 text-sm">Registre vendas Store+, Care+, SMB e mais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="p-6 bg-gray-900/50 border border-gray-700 rounded-xl space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">Nova Venda</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Vendedor
                </label>
                <select
                  value={formData.colaborador_id}
                  onChange={(e) => setFormData({ ...formData, colaborador_id: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  required
                >
                  <option value="">Selecione o vendedor</option>
                  {colaboradores.map(c => (
                    <option key={c.id} value={c.id}>{c.usuario?.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tipo de Venda
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoVenda })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  {Object.entries(TIPOS_VENDA).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Valor (R$)
                </label>
                <input
                  type="number"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Data da Venda
                </label>
                <input
                  type="date"
                  value={formData.data_venda}
                  onChange={(e) => setFormData({ ...formData, data_venda: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Observacoes (opcional)</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Detalhes da venda..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!formData.colaborador_id || submitting}
              className={`w-full py-4 rounded-lg font-bold text-white transition-all flex items-center justify-center gap-2 ${
                success
                  ? 'bg-green-500'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {success ? (
                <>
                  <Check className="w-5 h-5" />
                  Venda Registrada!
                </>
              ) : submitting ? (
                'Salvando...'
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Registrar Venda
                </>
              )}
            </button>
          </form>

          <div className="mt-6 bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-bold">Vendas Recentes</h3>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {vendasRecentes.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-800/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Vendedor</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase">Tipo</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Valor</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-400 uppercase">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {vendasRecentes.map(venda => {
                      const tipoConfig = TIPOS_VENDA[venda.tipo];
                      return (
                        <tr key={venda.id} className="hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-white text-sm">
                            {getColaboradorNome(venda.colaborador_id)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{
                                backgroundColor: `${tipoConfig.cor}20`,
                                color: tipoConfig.cor
                              }}
                            >
                              {tipoConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-green-400 text-sm">
                            {venda.valor > 0 ? `R$ ${venda.valor.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400 text-sm">
                            {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center">
                  <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Nenhuma venda registrada este mes.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total de Vendas</p>
            <p className="text-3xl font-bold text-cyan-400">{estatisticas.total}</p>
            <p className="text-gray-500 text-sm">este mes</p>
          </div>

          <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Valor Total</p>
            <p className="text-3xl font-bold text-green-400">
              R$ {estatisticas.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl space-y-3">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Por Tipo</p>

            {Object.entries(TIPOS_VENDA).map(([key, config]) => {
              const count = vendas.filter(v => v.tipo === key).length;
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config.cor }}
                    />
                    <span className="text-gray-300 text-sm">{config.label}</span>
                  </div>
                  <span className="text-white font-bold">{count}</span>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Top Vendedores</p>
            <div className="space-y-2">
              {colaboradores
                .map(c => ({
                  ...c,
                  vendas: vendas.filter(v => v.colaborador_id === c.id).length
                }))
                .sort((a, b) => b.vendas - a.vendas)
                .slice(0, 5)
                .map((c, idx) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                        idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-800 text-gray-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-gray-300 text-sm">{c.usuario?.nome}</span>
                    </div>
                    <span className="text-cyan-400 font-bold">{c.vendas}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
