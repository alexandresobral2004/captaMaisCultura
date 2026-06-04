'use client';

import { ThemeProvider } from './theme-provider';
import { ToastProvider } from '@/contexts/toast-context';
import { ToastContainer } from '@/components/ui/toast';
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
        {children}
        <ToastRenderer />
      </ToastProvider>
    </ThemeProvider>
  );
}