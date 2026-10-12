'use client';

import { ThemeProvider } from './theme-provider';
import { ToastProvider } from '@/contexts/toast-context';
import { ToastContainer } from '@/components/ui/toast';
import { ConfirmProvider } from '@/contexts/confirm-context';
import { useToastContext } from '@/contexts/toast-context';

function ToastRenderer() {
  const { toasts, dismiss } = useToastContext();
  return <ToastContainer toasts={toasts} onDismiss={dismiss} />;
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
        <ToastRenderer />
      </ToastProvider>
    </ThemeProvider>
  );
}