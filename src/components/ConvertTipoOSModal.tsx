import { useState } from 'react';
import { X, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConvertTipoOSModalProps {
  os: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConvertTipoOSModal({ os, onClose, onSuccess }: ConvertTipoOSModalProps) {
  const [novoTipo, setNovoTipo] = useState<'normal' | 'samsung_contigo' | 'acessorios'>(os.tipo_orcamento || 'normal');
  const [convertendo, setConvertendo] = useState(false);

  const tipoAtual = os.tipo_orcamento || 'normal';

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'samsung_contigo':
        return 'Samsung Contigo';
      case 'acessorios':
        return 'Acessórios';
      default:
        return 'Normal';
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'samsung_contigo':
        return '#FFA500';
      case 'acessorios':
        return '#39FF14';
      default:
        return '#00D4FF';
    }
  };

  const handleConvert = async () => {
    if (novoTipo === tipoAtual) {
      alert('Selecione um tipo diferente do atual');
      return;
    }

    if (!confirm(`Tem certeza que deseja converter esta OS de "${getTipoLabel(tipoAtual)}" para "${getTipoLabel(novoTipo)}"?`)) {
      return;
    }

    setConvertendo(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({ tipo_orcamento: novoTipo })
        .eq('id', os.id);

      if (error) throw error;

      alert(`OS convertida com sucesso para ${getTipoLabel(novoTipo)}!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao converter OS:', error);
      alert(`Erro ao converter OS: ${error.message}`);
    } finally {
      setConvertendo(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div
        className="w-full max-w-md rounded-xl p-6 shadow-2xl relative"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="p-3 rounded-lg"
            style={{
              backgroundColor: '#00D4FF15',
              border: '1px solid #00D4FF30',
            }}
          >
            <RefreshCw className="w-6 h-6" style={{ color: '#00D4FF' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Converter Tipo de OS
            </h2>
            <p className="text-sm text-gray-400">OS #{os.numero}</p>
          </div>
        </div>

        <div
          className="p-4 rounded-lg mb-6 flex items-start gap-3"
          style={{
            backgroundColor: '#FF660015',
            border: '1px solid #FF660030',
          }}
        >
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1">Atenção!</p>
            <p>
              Esta ação converterá o tipo da OS. Certifique-se de que todos os dados estão corretos antes de prosseguir.
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tipo Atual
            </label>
            <div
              className="px-4 py-3 rounded-lg"
              style={{
                backgroundColor: `${getTipoColor(tipoAtual)}10`,
                border: `1px solid ${getTipoColor(tipoAtual)}40`,
              }}
            >
              <span
                className="font-bold"
                style={{ color: getTipoColor(tipoAtual) }}
              >
                {getTipoLabel(tipoAtual)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center py-2">
            <RefreshCw className="w-5 h-5 text-gray-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Converter Para
            </label>
            <div className="space-y-2">
              {(['normal', 'samsung_contigo', 'acessorios'] as const).map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setNovoTipo(tipo)}
                  disabled={tipo === tipoAtual}
                  className="w-full px-4 py-3 rounded-lg text-left transition-all flex items-center justify-between"
                  style={{
                    backgroundColor: novoTipo === tipo ? `${getTipoColor(tipo)}20` : `${getTipoColor(tipo)}05`,
                    border: `2px solid ${novoTipo === tipo ? getTipoColor(tipo) : getTipoColor(tipo) + '20'}`,
                    opacity: tipo === tipoAtual ? 0.5 : 1,
                    cursor: tipo === tipoAtual ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span
                    className="font-bold"
                    style={{ color: getTipoColor(tipo) }}
                  >
                    {getTipoLabel(tipo)}
                  </span>
                  {novoTipo === tipo && (
                    <CheckCircle
                      className="w-5 h-5"
                      style={{ color: getTipoColor(tipo) }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={convertendo}
            className="flex-1 px-4 py-3 rounded-lg font-bold transition-all"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            CANCELAR
          </button>
          <button
            onClick={handleConvert}
            disabled={convertendo || novoTipo === tipoAtual}
            className="flex-1 px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: novoTipo === tipoAtual ? '#666' : `${getTipoColor(novoTipo)}20`,
              border: `1px solid ${getTipoColor(novoTipo)}60`,
              color: getTipoColor(novoTipo),
              opacity: convertendo || novoTipo === tipoAtual ? 0.5 : 1,
              cursor: convertendo || novoTipo === tipoAtual ? 'not-allowed' : 'pointer',
            }}
          >
            {convertendo ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                CONVERTENDO...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                CONVERTER
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
