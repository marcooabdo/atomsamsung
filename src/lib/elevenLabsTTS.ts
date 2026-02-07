let currentAudio: HTMLAudioElement | null = null;

export const speakGia = async (text: string): Promise<void> => {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    console.warn('ElevenLabs API key or Voice ID not configured');
    return;
  }

  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
    };

    await audio.play();
  } catch (error) {
    console.error('Erro ao reproduzir voz da GIA:', error);
  }
};

export const stopGiaSpeaking = (): void => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
};

export const isGiaSpeaking = (): boolean => {
  return currentAudio !== null && !currentAudio.paused;
};
