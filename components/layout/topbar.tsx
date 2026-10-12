"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Settings, LogOut } from "lucide-react"
import NotificacaoBell from "@/components/NotificacaoBell"
import { ThemeToggleIcon } from "@/components/providers/theme-toggle"

interface TopBarProps {
  onMobileMenuOpen?: () => void;
}

export function TopBar({ onMobileMenuOpen }: TopBarProps) {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [usuario, setUsuario] = useState<{ nome: string; role: string } | null>(null)

  useEffect(() => {
    fetch('/api/v1/usuarios/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => u && setUsuario({ nome: u.nome, role: u.role }))
      .catch(() => {})
  }, [])

  const papel: Record<string, string> = {
    admin: 'Administrador',
    editor: 'Editor',
    leitor: 'Somente leitura',
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/usuarios/logout', { method: 'POST' })
    } finally {
      router.push('/login')
    }
  }

  return (
    <header className="topbar">
      <div className="flex-1" />

      {/* User Info */}
      <div className="flex items-center gap-4">
        <ThemeToggleIcon />
        <NotificacaoBell />
        <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Abrir menu da conta"
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-3 bg-transparent border-0 cursor-pointer p-1"
          >
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {usuario?.nome ?? 'Minha conta'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{usuario ? papel[usuario.role] ?? usuario.role : ""}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute top-12 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg w-56 overflow-hidden z-20">
              {usuario?.role === 'admin' && (
                <>
              <button
                onClick={() => {
                  router.push("/configuracoes")
                  setIsMenuOpen(false)
                }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Configurações</span>
              </button>
                </>
              )}
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}