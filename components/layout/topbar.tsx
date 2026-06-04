"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Bell, User, Settings, LogOut } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ThemeToggleIcon } from "@/components/providers/theme-toggle"

interface TopBarProps {
  onMobileMenuOpen?: () => void;
}

export function TopBar({ onMobileMenuOpen }: TopBarProps) {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const handleLogout = () => {
    router.push("/")
  }

  return (
    <header className="topbar">
      {/* Search */}
      <div className="flex-1 max-w-xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Buscar editais, projetos ou usuários..."
          className="pl-10"
        />
      </div>

      {/* User Info */}
      <div className="flex items-center gap-4">
        <ThemeToggleIcon />
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
        <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 bg-transparent border-0 cursor-pointer p-1"
          >
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Prefeitura Municipal de Exemplo
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Gestor Administrativo</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute top-12 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg w-56 overflow-hidden z-20">
              <button
                onClick={() => {
                  router.push("/configuracoes")
                  setIsMenuOpen(false)
                }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left bg-transparent border-0 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Alterar dados</span>
              </button>
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