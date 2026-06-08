import React from "react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"
import { Sparkles } from "lucide-react"

export interface ProcessingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  title?: string;
  message?: string;
}

const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
  className,
  isOpen,
  title = "Processando",
  message = "Aguarde, a inteligência artificial está trabalhando...",
  ...props
}) => {
  if (!isOpen) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-all duration-300",
        className
      )}
      {...props}
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl max-w-md w-[90%] border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center gap-4 scale-in duration-200">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/40">
          <Spinner className="w-10 h-10 text-blue-600 dark:text-blue-400 border-2 border-slate-200 border-t-blue-600" />
          <Sparkles className="absolute w-5 h-5 text-amber-500 animate-pulse" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{message}</p>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
          <div className="bg-blue-600 h-full w-1/3 rounded-full animate-loading-bar" />
        </div>
      </div>
    </div>
  )
}

ProcessingOverlay.displayName = "ProcessingOverlay"

export { ProcessingOverlay }
