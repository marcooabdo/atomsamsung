import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UserPresence {
  user_id: string;
  status: 'online' | 'offline';
  last_seen_at: string;
  device_type?: 'web' | 'mobile';
}

const HEARTBEAT_INTERVAL = 30000; // 30 segundos

export function useUserPresence(userId: string | undefined) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const deviceType = /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'web';

    const updatePresence = async () => {
      try {
        await supabase.rpc('update_user_presence', {
          p_user_id: userId,
          p_device_type: deviceType
        });
      } catch (error) {
        // ignored
      }
    };

    const setOffline = async () => {
      try {
        await supabase.rpc('set_user_offline', {
          p_user_id: userId
        });
      } catch (error) {
        // ignored
      }
    };

    updatePresence();

    intervalRef.current = setInterval(updatePresence, HEARTBEAT_INTERVAL);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsOnline(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setOffline();
      } else {
        setIsOnline(true);
        updatePresence();
        intervalRef.current = setInterval(updatePresence, HEARTBEAT_INTERVAL);
      }
    };

    const handleBeforeUnload = () => {
      setOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOffline();
    };
  }, [userId]);

  return { isOnline };
}

export function useOtherUserPresence(userId: string | undefined) {
  const [presence, setPresence] = useState<UserPresence | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchPresence = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setPresence(data);
      } else {
        setPresence(null);
      }
    };

    fetchPresence();

    const interval = setInterval(fetchPresence, 10000);

    const subscription = supabase
      .channel(`presence:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.new) {
            setPresence(payload.new as UserPresence);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [userId]);

  return presence;
}

export function formatLastSeen(lastSeenAt: string): string {
  const now = new Date();
  const lastSeen = new Date(lastSeenAt);
  const diffInSeconds = Math.floor((now.getTime() - lastSeen.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'agora';
  }

  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `há ${minutes} min`;
  }

  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `há ${hours}h`;
  }

  const days = Math.floor(diffInSeconds / 86400);
  if (days === 1) {
    return 'ontem às ' + lastSeen.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  if (days < 7) {
    return `há ${days} dias`;
  }

  return lastSeen.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ' às ' + lastSeen.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
