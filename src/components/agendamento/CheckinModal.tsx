import { useState, useEffect } from 'react';
import { X, MapPin, Camera, CheckCircle, Clock, AlertCircle, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CheckinModalProps {
  agendamento: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckinModal({ agendamento, onClose, onSuccess }: CheckinModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [endereco, setEndereco] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [observacao, setObservacao] = useState('');
  const [captandoLocalizacao, setCaptandoLocalizacao] = useState(false);

  useEffect(() => {
    captarLocalizacao();
  }, []);

  const captarLocalizacao = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada neste navegador');
      return;
    }

    setCaptandoLocalizacao(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        buscarEndereco(position.coords.latitude, position.coords.longitude);
        setCaptandoLocalizacao(false);
      },
      (error) => {
        let mensagem = 'Erro ao obter localização';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            mensagem = 'Permissão de localização negada. Por favor, habilite nas configurações do navegador.';
            break;
          case error.POSITION_UNAVAILABLE:
            mensagem = 'Localização indisponível no momento';
            break;
          case error.TIMEOUT:
            mensagem = 'Tempo esgotado ao buscar localização';
            break;
        }
        setLocationError(mensagem);
        setCaptandoLocalizacao(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const buscarEndereco = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      if (data.display_name) {
        setEndereco(data.display_name);
      }
    } catch (error) {
    }
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const novos = Array.from(e.target.files);
      setFotos([...fotos, ...novos]);
    }
  };

  const removerFoto = (index: number) => {
    setFotos(fotos.filter((_, i) => i !== index));
  };

  const handleCheckin = async () => {
    if (!location) {
      alert('Aguarde a captura da localização ou tente novamente');
      return;
    }

    setLoading(true);

    try {
      const fotoUrls: string[] = [];

      for (const foto of fotos) {
        const fileName = `checkin_${agendamento.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('os-anexos')
          .upload(fileName, foto);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('os-anexos')
          .getPublicUrl(fileName);

        fotoUrls.push(publicUrl);
      }

      const { error: checkinError } = await supabase
        .from('agendamentos_checkin_checkout')
        .insert({
          agendamento_id: agendamento.id,
          tipo: 'checkin',
          data_hora: new Date().toISOString(),
          localizacao_lat: location.lat,
          localizacao_lng: location.lng,
          localizacao_endereco: endereco,
          fotos: fotoUrls,
          observacao: observacao || null
        });

      if (checkinError) throw checkinError;

      const { error: updateError } = await supabase
        .from('agendamentos')
        .update({
          status: 'em_andamento',
          updated_at: new Date().toISOString()
        })
        .eq('id', agendamento.id);

      if (updateError) throw updateError;

      // Atualizar status da OS no kanban baseado no tipo de usuário
      const novoStatusKanban = usuario?.tipo === 'tecnico_ih' ? 'em_rota_ih' : 'em_rota_ci';

      const { error: osUpdateError } = await supabase
        .from('os')
        .update({
          status_kanban: novoStatusKanban,
          updated_at: new Date().toISOString()
        })
        .eq('id', agendamento.os_id);

      if (osUpdateError) throw osUpdateError;

      await supabase.from('os_comentarios').insert({
        os_id: agendamento.os_id,
        usuario_id: usuario?.id,
        comentario: `Check-in realizado por ${usuario?.nome}. Localização: ${endereco || 'N/A'}`,
        is_system: true
      });

      alert('Check-in realizado com sucesso!');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Erro ao fazer check-in: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-2xl">
        <div className="p-6 border-b border-[#00D4FF]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#00D4FF]/20 flex items-center justify-center">
                <Navigation className="w-6 h-6 text-[#00D4FF]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#00D4FF]">CHECK-IN</h2>
                <p className="text-sm text-gray-400">
                  {agendamento.os?.numero_os_samsung || agendamento.os?.numero_os_interna || 'S/N'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto cyber-scrollbar">
          <div className="premium-card p-4 bg-[#00D4FF]/5">
            <h3 className="text-[#00D4FF] font-bold mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Informações do Agendamento
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Cliente:</span>
                <p className="text-white font-semibold">{agendamento.os?.cliente_nome}</p>
              </div>
              <div>
                <span className="text-gray-400">Data:</span>
                <p className="text-white font-semibold">
                  {new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400">Endereço:</span>
                <p className="text-white text-xs">
                  {agendamento.os?.cliente_endereco}
                  {agendamento.os?.cliente_bairro && `, ${agendamento.os.cliente_bairro}`}
                  {agendamento.os?.cliente_cidade && `, ${agendamento.os.cliente_cidade}`}
                  {agendamento.os?.cliente_estado && ` - ${agendamento.os.cliente_estado}`}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#00D4FF] mb-3 flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              Localização Atual
            </label>

            {captandoLocalizacao && (
              <div className="premium-card p-4 bg-[#FFBF00]/10 border border-[#FFBF00]/30">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#FFBF00] animate-spin" />
                  <div>
                    <p className="text-[#FFBF00] font-semibold">Capturando localização...</p>
                    <p className="text-xs text-gray-400">Isso pode levar alguns segundos</p>
                  </div>
                </div>
              </div>
            )}

            {locationError && (
              <div className="premium-card p-4 bg-[#FF0064]/10 border border-[#FF0064]/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#FF0064] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[#FF0064] font-semibold">{locationError}</p>
                    <button
                      onClick={captarLocalizacao}
                      className="neon-button mt-2 px-4 py-1 text-xs"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                </div>
              </div>
            )}

            {location && !captandoLocalizacao && (
              <div className="premium-card p-4 bg-[#39FF14]/10 border border-[#39FF14]/30">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#39FF14] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[#39FF14] font-semibold mb-2">Localização capturada!</p>
                    <p className="text-xs text-gray-300 mb-1">
                      <strong>Coordenadas:</strong> {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </p>
                    {endereco && (
                      <p className="text-xs text-gray-300">
                        <strong>Endereço:</strong> {endereco}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#00D4FF] mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Fotos da Chegada (Opcional)
            </label>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFotoChange}
              className="neon-input w-full mb-3"
            />

            {fotos.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {fotos.map((foto, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(foto)}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-24 object-cover rounded border border-[#00D4FF]/30"
                    />
                    <button
                      onClick={() => removerFoto(index)}
                      className="absolute top-1 right-1 bg-[#FF0064] text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#00D4FF] mb-2">
              Observações (Opcional)
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="neon-input w-full h-24 resize-none"
              placeholder="Adicione observações sobre a chegada..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-[#00D4FF]/20 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCheckin}
            disabled={loading || !location || captandoLocalizacao}
            className="flex-1 neon-button px-6 py-3 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Processando check-in...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirmar Check-in
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
