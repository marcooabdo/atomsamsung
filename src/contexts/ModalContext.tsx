import { createContext, useContext, useState, ReactNode } from 'react';
import AlertModal from '../components/AlertModal';
import ConfirmModal from '../components/ConfirmModal';

interface AlertOptions {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ModalContextType {
  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<AlertOptions & { isOpen: boolean }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  const [confirmState, setConfirmState] = useState<ConfirmOptions & { isOpen: boolean; resolver?: (value: boolean) => void }>({
    isOpen: false,
    message: '',
    type: 'warning'
  });

  const showAlert = (options: AlertOptions) => {
    setAlertState({
      ...options,
      isOpen: true
    });
  };

  const showConfirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        ...options,
        isOpen: true,
        resolver: resolve
      });
    });
  };

  const handleAlertClose = () => {
    setAlertState({ ...alertState, isOpen: false });
  };

  const handleConfirmClose = () => {
    if (confirmState.resolver) {
      confirmState.resolver(false);
    }
    setConfirmState({ ...confirmState, isOpen: false, resolver: undefined });
  };

  const handleConfirmAccept = () => {
    if (confirmState.resolver) {
      confirmState.resolver(true);
    }
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={handleAlertClose}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        confirmText={alertState.confirmText}
      />
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirmAccept}
        onCancel={handleConfirmClose}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
