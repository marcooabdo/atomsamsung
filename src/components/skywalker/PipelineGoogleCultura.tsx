import { useState } from 'react';
import { Star, Check, X, Upload, User, CheckCircle, XCircle, Clock, Heart, Users } from 'lucide-react';
import { useSkywalker } from '../../contexts/SkywalkerContext';
import { REVIEW_STATUS_CONFIG } from './types';

export function PipelineGoogleCultura() {
  const {
    colaboradores,
    reviews,
    culturas,
    addReview,
    updateReviewStatus,
    updateCultura,
    mesAtual
  } = useSkywalker();

  const [selectedColaborador, setSelectedColaborador] = useState('');
  const [urlPrint, setUrlPrint] = useState('');
  const [uploading, setUploading] = useState(false);

  const reviewsPendentes = reviews.filter(r => r.status === 'pendente');
  const reviewsAprovados = reviews.filter(r => r.status === 'aprovado');
  const reviewsRejeitados = reviews.filter(r => r.status === 'rejeitado');

  const handleAddReview = async () => {
    if (!selectedColaborador) return;

    setUploading(true);
    const success = await addReview({
      colaborador_id: selectedColaborador,
      status: 'pendente',
      url_print: urlPrint,
      mes_referencia: mesAtual
    });

    if (success) {
      setSelectedColaborador('');
      setUrlPrint('');
    }
    setUploading(false);
  };

  const handleStatusChange = async (reviewId: string, status: 'aprovado' | 'rejeitado') => {
    await updateReviewStatus(reviewId, status);
  };

  const handleCulturaChange = async (colaboradorId: string, field: string, value: boolean) => {
    await updateCultura(colaboradorId, { [field]: value });
  };

  const getColaboradorNome = (id: string) => {
    const colab = colaboradores.find(c => c.id === id);
    return colab?.usuario?.nome || 'Colaborador';
  };

  const getCulturaForColaborador = (colaboradorId: string) => {
    return culturas.find(c => c.colaborador_id === colaboradorId) || {
      presenca_reuniao: false,
      sem_atrasos: false,
      proativo: false,
      exemplar: false
    };
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
            <Star className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Pipeline Google Reviews</h2>
            <p className="text-gray-400 text-sm">Gerencie as avaliacoes do Google</p>
          </div>
        </div>

        <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl mb-6">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-400" />
            Novo Upload de Review
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={selectedColaborador}
              onChange={(e) => setSelectedColaborador(e.target.value)}
              className="px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">Selecione o colaborador</option>
              {colaboradores.map(c => (
                <option key={c.id} value={c.id}>{c.usuario?.nome}</option>
              ))}
            </select>
            <input
              type="text"
              value={urlPrint}
              onChange={(e) => setUrlPrint(e.target.value)}
              placeholder="URL do print (opcional)"
              className="px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleAddReview}
              disabled={!selectedColaborador || uploading}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {uploading ? 'Enviando...' : 'Enviar Review'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900/50 border border-yellow-500/30 rounded-xl overflow-hidden">
            <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/30 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <h3 className="text-white font-bold">Pendente ({reviewsPendentes.length})</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {reviewsPendentes.map(review => (
                <div key={review.id} className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-white text-sm">{getColaboradorNome(review.colaborador_id)}</span>
                  </div>
                  {review.url_print && (
                    <a href={review.url_print} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline block mb-2">
                      Ver print
                    </a>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusChange(review.id, 'aprovado')}
                      className="flex-1 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleStatusChange(review.id, 'rejeitado')}
                      className="flex-1 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Rejeitar
                    </button>
                  </div>
                </div>
              ))}
              {reviewsPendentes.length === 0 && (
                <p className="text-gray-500 text-center py-4">Nenhum review pendente</p>
              )}
            </div>
          </div>

          <div className="bg-gray-900/50 border border-green-500/30 rounded-xl overflow-hidden">
            <div className="p-4 bg-green-500/10 border-b border-green-500/30 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h3 className="text-white font-bold">Aprovados ({reviewsAprovados.length})</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {reviewsAprovados.map(review => (
                <div key={review.id} className="p-3 bg-gray-800/50 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" fill="#facc15" />
                    <span className="text-white text-sm">{getColaboradorNome(review.colaborador_id)}</span>
                  </div>
                </div>
              ))}
              {reviewsAprovados.length === 0 && (
                <p className="text-gray-500 text-center py-4">Nenhum review aprovado</p>
              )}
            </div>
          </div>

          <div className="bg-gray-900/50 border border-red-500/30 rounded-xl overflow-hidden">
            <div className="p-4 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <h3 className="text-white font-bold">Rejeitados ({reviewsRejeitados.length})</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {reviewsRejeitados.map(review => (
                <div key={review.id} className="p-3 bg-gray-800/50 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-white text-sm">{getColaboradorNome(review.colaborador_id)}</span>
                  </div>
                </div>
              ))}
              {reviewsRejeitados.length === 0 && (
                <p className="text-gray-500 text-center py-4">Nenhum review rejeitado</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-pink-500/20 to-rose-500/20 rounded-xl border border-pink-500/30">
            <Heart className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Check de Cultura</h2>
            <p className="text-gray-400 text-sm">Avaliacao mensal de cultura e participacao</p>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Colaborador</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Presenca Reuniao</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Sem Atrasos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Proativo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Exemplar</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Estrelas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {colaboradores.map(colab => {
                const cultura = getCulturaForColaborador(colab.id);
                let estrelasCultura = 0;
                if (cultura.exemplar) estrelasCultura = 3;
                else if (cultura.proativo && cultura.sem_atrasos) estrelasCultura = 2;
                else if (cultura.sem_atrasos && cultura.presenca_reuniao) estrelasCultura = 1;

                return (
                  <tr key={colab.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-400" />
                        </div>
                        <span className="text-white">{colab.usuario?.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleCulturaChange(colab.id, 'presenca_reuniao', !cultura.presenca_reuniao)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                          cultura.presenca_reuniao
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : 'bg-gray-800 border-gray-600 text-gray-500 hover:border-gray-500'
                        }`}
                      >
                        {cultura.presenca_reuniao && <Check className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleCulturaChange(colab.id, 'sem_atrasos', !cultura.sem_atrasos)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                          cultura.sem_atrasos
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : 'bg-gray-800 border-gray-600 text-gray-500 hover:border-gray-500'
                        }`}
                      >
                        {cultura.sem_atrasos && <Check className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleCulturaChange(colab.id, 'proativo', !cultura.proativo)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                          cultura.proativo
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                            : 'bg-gray-800 border-gray-600 text-gray-500 hover:border-gray-500'
                        }`}
                      >
                        {cultura.proativo && <Check className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleCulturaChange(colab.id, 'exemplar', !cultura.exemplar)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                          cultura.exemplar
                            ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                            : 'bg-gray-800 border-gray-600 text-gray-500 hover:border-gray-500'
                        }`}
                      >
                        {cultura.exemplar && <Star className="w-5 h-5" fill="currentColor" />}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < estrelasCultura ? 'text-yellow-400' : 'text-gray-600'}`}
                            fill={i < estrelasCultura ? '#facc15' : 'none'}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {colaboradores.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Nenhum colaborador cadastrado.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
