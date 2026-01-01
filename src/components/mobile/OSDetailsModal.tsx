import { X, MapPin, Phone, Package, FileText, PlayCircle, Navigation } from 'lucide-react';

interface OSDetailsModalProps {
  os: {
    id: string;
    numero_os_interna: string | null;
    numero_os_samsung: string | null;
    tipo_atendimento: string;
    tipo_reparo: string | null;
    tipo_os: string | null;
    cliente_nome: string;
    cliente_telefone: string;
    cliente_endereco: string;
    cliente_bairro: string | null;
    cliente_cidade: string;
    cliente_cep: string | null;
    aparelho_marca: string | null;
    aparelho_modelo: string | null;
    defeito_reclamado: string | null;
    observacoes: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  onClose: () => void;
  onStart: () => void;
}

export function OSDetailsModal({ os, onClose, onStart }: OSDetailsModalProps) {
  const enderecoCompleto = `${os.cliente_endereco}, ${os.cliente_bairro || ''}, ${os.cliente_cidade}${os.cliente_cep ? ` - CEP: ${os.cliente_cep}` : ''}`.trim();

  const openMaps = () => {
    if (os.latitude && os.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${os.latitude},${os.longitude}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`, '_blank');
    }
  };

  const openWaze = () => {
    if (os.latitude && os.longitude) {
      window.open(`https://waze.com/ul?ll=${os.latitude},${os.longitude}&navigate=yes`, '_blank');
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(enderecoCompleto)}`, '_blank');
    }
  };

  const openWhatsApp = () => {
    const phone = os.cliente_telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              OS #{os.numero_os_samsung || os.numero_os_interna || 'S/N'}
            </h2>
            <p className="text-gray-400 text-sm">{os.cliente_nome}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              Equipamento
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-gray-400 text-sm">Marca</p>
                <p className="text-white font-medium">{os.aparelho_marca || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Modelo</p>
                <p className="text-white font-medium">{os.aparelho_modelo || 'Não informado'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Tipo de Atendimento
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-gray-400 text-sm">Tipo de Atendimento</p>
                <p className="text-white font-medium">
                  {os.tipo_atendimento === 'IH' ? 'In-Home (IH)' : os.tipo_atendimento || 'Não especificado'}
                </p>
              </div>
              {os.tipo_reparo && (
                <div>
                  <p className="text-gray-400 text-sm">Tipo de Reparo</p>
                  <p className="text-white font-medium">{os.tipo_reparo}</p>
                </div>
              )}
              {os.tipo_os && (
                <div>
                  <p className="text-gray-400 text-sm">Tipo de OS</p>
                  <p className="text-white font-medium">{os.tipo_os}</p>
                </div>
              )}
            </div>
          </div>

          {os.defeito_reclamado && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-white font-bold mb-2">Defeito Reclamado</h3>
              <p className="text-gray-300">{os.defeito_reclamado}</p>
            </div>
          )}

          {os.observacoes && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-white font-bold mb-2">Observações</h3>
              <p className="text-gray-300">{os.observacoes}</p>
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Endereço
            </h3>
            <p className="text-white">{enderecoCompleto}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={openWaze}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500/20 border border-cyan-500/50 rounded-xl text-cyan-400 font-medium hover:bg-cyan-500/30 transition-all"
              >
                <Navigation className="w-5 h-5" />
                Waze
              </button>
              <button
                onClick={openMaps}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-400 font-medium hover:bg-blue-500/30 transition-all"
              >
                <MapPin className="w-5 h-5" />
                Maps
              </button>
            </div>
          </div>

          {os.cliente_telefone && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Phone className="w-5 h-5 text-cyan-400" />
                Contato
              </h3>
              <div className="flex items-center justify-between">
                <p className="text-white">{os.cliente_telefone}</p>
                <button
                  onClick={openWhatsApp}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 font-medium hover:bg-green-500/30 transition-all"
                >
                  <Phone className="w-4 h-4" />
                  WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4">
          <button
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
          >
            <PlayCircle className="w-6 h-6" />
            Iniciar Atendimento
          </button>
        </div>
      </div>
    </div>
  );
}
