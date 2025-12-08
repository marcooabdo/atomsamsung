import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Camera, CheckCircle, Clock, AlertCircle, Navigation, FileText, Edit3, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CheckoutModalProps {
  agendamento: any;
  onClose: () => void;
  onSuccess: () => void;
}

interface ChecklistItem {
  ordem: number;
  texto: string;
  tipo_resposta: 'checkbox' | 'texto' | 'ambos';
  resposta_checkbox?: boolean;
  resposta_texto?: string;
}

export function CheckoutModal({ agendamento, onClose, onSuccess }: CheckoutModalProps) {
  const { usuario } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [endereco, setEndereco] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [observacao, setObservacao] = useState('');
  const [captandoLocalizacao, setCaptandoLocalizacao] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(true);
  const [pecaConfirmada, setPecaConfirmada] = useState(false);
  const [giPostado, setGiPostado] = useState(false);
  const [temPecas, setTemPecas] = useState(false);

  useEffect(() => {
    captarLocalizacao();
    loadChecklist();
    verificarPecas();
  }, []);

  const verificarPecas = async () => {
    try {
      const { data, error } = await supabase
        .from('requisicoes_pecas')
        .select('id')
        .eq('os_id', agendamento.os_id)
        .neq('status', 'reprovada')
        .limit(1);

      if (error) throw error;
      setTemPecas((data?.length || 0) > 0);
    } catch (error) {
      console.error('Erro ao verificar peças:', error);
    }
  };

  const loadChecklist = async () => {
    try {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('ativo', true)
        .or(`tipo_servico.eq.${agendamento.os?.tipo_atendimento},tipo_servico.eq.geral`)
        .or(`unidade_id.is.null,unidade_id.eq.${agendamento.unidade_id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data && data.itens) {
        const itens = Array.isArray(data.itens) ? data.itens : [];
        setChecklist(itens.map((item: any) => ({
          ordem: item.ordem,
          texto: item.texto,
          tipo_resposta: item.tipo_resposta,
          resposta_checkbox: false,
          resposta_texto: ''
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar checklist:', error);
    } finally {
      setLoadingChecklist(false);
    }
  };

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
            mensagem = 'Permissão de localização negada';
            break;
          case error.POSITION_UNAVAILABLE:
            mensagem = 'Localização indisponível';
            break;
          case error.TIMEOUT:
            mensagem = 'Tempo esgotado ao buscar localização';
            break;
        }
        setLocationError(mensagem);
        setCaptandoLocalizacao(false);
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
      console.error('Erro ao buscar endereço:', error);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#00D4FF';
    ctx.lineWidth = 2;
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
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

  const updateChecklistItem = (index: number, field: 'resposta_checkbox' | 'resposta_texto', value: any) => {
    const updated = [...checklist];
    updated[index] = { ...updated[index], [field]: value };
    setChecklist(updated);
  };

  const validarCheckout = () => {
    if (!location) {
      alert('Aguarde a captura da localização');
      return false;
    }

    if (!hasSignature) {
      alert('Assinatura do cliente é obrigatória');
      return false;
    }

    if (temPecas && !pecaConfirmada) {
      alert('É necessário confirmar o uso da peça');
      return false;
    }

    for (const item of checklist) {
      if (item.tipo_resposta === 'checkbox' && !item.resposta_checkbox) {
        alert(`Complete o item do checklist: ${item.texto}`);
        return false;
      }
      if (item.tipo_resposta === 'texto' && !item.resposta_texto) {
        alert(`Preencha o campo: ${item.texto}`);
        return false;
      }
      if (item.tipo_resposta === 'ambos' && (!item.resposta_checkbox || !item.resposta_texto)) {
        alert(`Complete todos os campos do item: ${item.texto}`);
        return false;
      }
    }

    return true;
  };

  const handleCheckout = async () => {
    if (!validarCheckout()) return;

    setLoading(true);

    try {
      const fotoUrls: string[] = [];
      for (const foto of fotos) {
        const fileName = `checkout_${agendamento.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { error: uploadError } = await supabase.storage
          .from('os-anexos')
          .upload(fileName, foto);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('os-anexos')
          .getPublicUrl(fileName);

        fotoUrls.push(publicUrl);
      }

      const canvas = canvasRef.current;
      let assinaturaUrl = '';
      if (canvas) {
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png');
        });
        const fileName = `assinatura_${agendamento.id}_${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from('os-anexos')
          .upload(fileName, blob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('os-anexos')
          .getPublicUrl(fileName);

        assinaturaUrl = publicUrl;
      }

      const { data: checkoutData, error: checkoutError } = await supabase
        .from('agendamentos_checkin_checkout')
        .insert({
          agendamento_id: agendamento.id,
          tipo: 'checkout',
          data_hora: new Date().toISOString(),
          localizacao_lat: location.lat,
          localizacao_lng: location.lng,
          localizacao_endereco: endereco,
          fotos: fotoUrls,
          assinatura_cliente: assinaturaUrl,
          observacao: observacao || null
        })
        .select()
        .single();

      if (checkoutError) throw checkoutError;

      for (const item of checklist) {
        await supabase.from('agendamento_checklist_respostas').insert({
          agendamento_id: agendamento.id,
          checkin_checkout_id: checkoutData.id,
          item_ordem: item.ordem,
          item_texto: item.texto,
          tipo_resposta: item.tipo_resposta,
          resposta_checkbox: item.resposta_checkbox || null,
          resposta_texto: item.resposta_texto || null
        });
      }

      const { error: updateError } = await supabase
        .from('agendamentos')
        .update({
          status: 'concluido',
          gi_postado: giPostado,
          peca_confirmada_usada: pecaConfirmada,
          checkout_observacoes: observacao,
          checkout_checklist_completo: true,
          checkout_pendente: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', agendamento.id);

      if (updateError) throw updateError;

      for (const fotoUrl of fotoUrls) {
        await supabase.from('os_anexos').insert({
          os_id: agendamento.os_id,
          tipo: 'checkout',
          url: fotoUrl,
          uploaded_by: usuario?.id
        });
      }

      await supabase.from('os_comentarios').insert({
        os_id: agendamento.os_id,
        usuario_id: usuario?.id,
        comentario: `Check-out realizado por ${usuario?.nome}. ${giPostado ? 'GI Postado. ' : ''}${pecaConfirmada ? 'Peça confirmada. ' : ''}Aguardando aprovação do operacional para movimento automático no Kanban.`,
        is_system: true
      });

      alert('Check-out realizado com sucesso! A OS será movida automaticamente para "Fechar OS" após aprovação do operacional.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao fazer checkout:', error);
      alert(`Erro ao fazer checkout: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[#39FF14]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#39FF14]/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#39FF14]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#39FF14]">CHECK-OUT</h2>
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

        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-6">
          {loadingChecklist ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="w-8 h-8 text-[#00D4FF] animate-spin" />
            </div>
          ) : (
            <>
              {checklist.length > 0 && (
                <div>
                  <h3 className="text-[#00D4FF] font-bold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Checklist de Serviço
                  </h3>
                  <div className="space-y-3">
                    {checklist.map((item, index) => (
                      <div key={index} className="premium-card p-4">
                        <div className="space-y-2">
                          <p className="text-white font-semibold text-sm">{item.texto}</p>
                          {(item.tipo_resposta === 'checkbox' || item.tipo_resposta === 'ambos') && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.resposta_checkbox || false}
                                onChange={(e) => updateChecklistItem(index, 'resposta_checkbox', e.target.checked)}
                                className="w-5 h-5 rounded border-[#00D4FF] bg-transparent checked:bg-[#00D4FF]"
                              />
                              <span className="text-sm text-gray-400">Concluído</span>
                            </label>
                          )}
                          {(item.tipo_resposta === 'texto' || item.tipo_resposta === 'ambos') && (
                            <textarea
                              value={item.resposta_texto || ''}
                              onChange={(e) => updateChecklistItem(index, 'resposta_texto', e.target.value)}
                              className="neon-input w-full h-20 resize-none text-sm"
                              placeholder="Adicione observações..."
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {temPecas && (
                <div>
                  <h3 className="text-[#00D4FF] font-bold mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Confirmação de Peça
                  </h3>
                  <div className="premium-card p-4 bg-[#FFBF00]/5">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pecaConfirmada}
                        onChange={(e) => setPecaConfirmada(e.target.checked)}
                        className="w-5 h-5 rounded border-[#FFBF00] bg-transparent checked:bg-[#FFBF00]"
                      />
                      <span className="text-sm text-white font-semibold">
                        Confirmo que a peça foi utilizada no serviço
                      </span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-[#00D4FF] font-bold mb-3">GI (Garantia Interna)</h3>
                <div className="premium-card p-4 bg-[#00D4FF]/5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={giPostado}
                      onChange={(e) => setGiPostado(e.target.checked)}
                      className="w-5 h-5 rounded border-[#00D4FF] bg-transparent checked:bg-[#00D4FF]"
                    />
                    <span className="text-sm text-white font-semibold">
                      GI foi postado no sistema
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#00D4FF] mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Fotos do Serviço Realizado
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFotoChange}
                  className="neon-input w-full mb-3"
                />
                {fotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-3">
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
                <label className="block text-sm font-semibold text-[#39FF14] mb-2 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Assinatura do Cliente *
                </label>
                <div className="premium-card p-4 bg-black/40">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="w-full border-2 border-dashed border-[#39FF14]/30 rounded cursor-crosshair bg-white/5"
                  />
                  <button
                    onClick={clearSignature}
                    className="mt-3 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Limpar Assinatura
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#00D4FF] mb-2">
                  Observações Finais
                </label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="neon-input w-full h-24 resize-none"
                  placeholder="Adicione observações sobre o serviço realizado..."
                />
              </div>

              {!captandoLocalizacao && location && (
                <div className="premium-card p-3 bg-[#39FF14]/10 border border-[#39FF14]/30">
                  <p className="text-[#39FF14] text-xs flex items-center gap-2">
                    <CheckCircle className="w-3 h-3" />
                    Localização capturada
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-[#39FF14]/20 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCheckout}
            disabled={loading || !location || loadingChecklist}
            className="flex-1 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: '#39FF1420',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#39FF14',
              color: '#39FF14',
              boxShadow: '0 0 20px rgba(57, 255, 20, 0.3)'
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                Processando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Finalizar Check-out
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
