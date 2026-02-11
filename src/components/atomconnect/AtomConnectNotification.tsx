import { X, MessageSquare, ArrowRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Notification {
  id: string;
  type: 'message' | 'transfer' | 'sla';
  title: string;
  message: string;
  conversaId?: string;
  timestamp: Date;
}

interface Props {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onClick: (notification: Notification) => void;
  accentColor: string;
}

export function AtomConnectNotification({ notifications, onDismiss, onClick, accentColor }: Props) {
  const recentNotifications = notifications.slice(0, 3);

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {recentNotifications.map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
              delay: index * 0.05
            }}
            className="pointer-events-auto w-80 bg-[#1A1A2E]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden cursor-pointer"
            style={{
              boxShadow: `0 0 30px ${accentColor}20`
            }}
            onClick={() => onClick(notification)}
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: notification.type === 'sla'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : `${accentColor}20`
                  }}
                >
                  {notification.type === 'message' ? (
                    <MessageSquare className="w-5 h-5" style={{ color: accentColor }} />
                  ) : notification.type === 'transfer' ? (
                    <ArrowRight className="w-5 h-5" style={{ color: accentColor }} />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white truncate">
                      {notification.title}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(notification.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded transition-colors ml-2"
                    >
                      <X className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-2">
                    {notification.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress bar for auto-dismiss */}
            <motion.div
              className="h-0.5"
              style={{ backgroundColor: accentColor }}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 5, ease: 'linear' }}
              onAnimationComplete={() => onDismiss(notification.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
