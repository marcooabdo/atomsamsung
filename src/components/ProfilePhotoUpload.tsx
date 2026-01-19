import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProfilePhotoUploadProps {
  userId: string;
  currentPhotoUrl?: string;
  userName: string;
  onPhotoUpdated: (url: string) => void;
  size?: 'small' | 'medium' | 'large';
  editable?: boolean;
}

export function ProfilePhotoUpload({
  userId,
  currentPhotoUrl,
  userName,
  onPhotoUpdated,
  size = 'medium',
  editable = true
}: ProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    small: 'w-10 h-10 text-sm',
    medium: 'w-16 h-16 text-xl',
    large: 'w-32 h-32 text-5xl'
  };

  const getUserColor = (name: string) => {
    const colors = [
      '#00D4FF', '#39FF14', '#FF6B35', '#FFD700', '#FF1493',
      '#8A2BE2', '#00FA9A', '#FF69B4'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setShowModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${userId}/profile.${fileExt}`;

      const { data: existingFiles } = await supabase.storage
        .from('profile-photos')
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        for (const file of existingFiles) {
          await supabase.storage
            .from('profile-photos')
            .remove([`${userId}/${file.name}`]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ foto_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      onPhotoUpdated(publicUrl);
      setShowModal(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Deseja remover sua foto de perfil?')) return;

    setUploading(true);
    try {
      const { data: existingFiles } = await supabase.storage
        .from('profile-photos')
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        for (const file of existingFiles) {
          await supabase.storage
            .from('profile-photos')
            .remove([`${userId}/${file.name}`]);
        }
      }

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ foto_url: null })
        .eq('id', userId);

      if (updateError) throw updateError;

      onPhotoUpdated('');
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      alert('Erro ao remover foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="relative group">
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden`}
          style={{
            backgroundColor: `${getUserColor(userName)}20`,
            border: `3px solid ${getUserColor(userName)}60`
          }}
        >
          {currentPhotoUrl ? (
            <img
              src={currentPhotoUrl}
              alt={userName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="font-bold"
              style={{ color: getUserColor(userName) }}
            >
              {userName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {editable && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 p-2 bg-[#00D4FF] rounded-full hover:bg-[#00B8E6] transition-all opacity-0 group-hover:opacity-100 shadow-lg"
            title="Alterar foto"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#0d1419] border border-[#1a3a4a] rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#0d1419] border-b border-[#1a3a4a] p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-200">Foto de Perfil</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="p-2 hover:bg-[#1a3a4a]/50 rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              {previewUrl && (
                <div className="mb-6">
                  <div className="w-40 h-40 mx-auto rounded-full overflow-hidden border-4 border-[#00D4FF]/30">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {currentPhotoUrl && (
                  <button
                    onClick={handleRemovePhoto}
                    disabled={uploading}
                    className="flex-1 px-4 py-3 bg-red-900/20 text-red-400 border border-red-900/50 rounded-lg hover:bg-red-900/30 transition-all disabled:opacity-50 text-sm"
                  >
                    Remover
                  </button>
                )}
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 px-4 py-3 bg-[#00D4FF] text-white rounded-lg hover:bg-[#00B8E6] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Confirmar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
