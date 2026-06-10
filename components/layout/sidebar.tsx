"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  FileText,
  CheckCircle,
  Settings,
  ChevronDown,
  AlertTriangle,
  FlaskConical
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

type ColorScheme = 'emerald' | 'amber' | 'sky' | 'violet' | 'slate';

interface SubMenuItem {
  href: string;
  label: string;
  colorScheme?: ColorScheme;
}

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  colorScheme: ColorScheme;
  submenu?: SubMenuItem[];
}

const colorMap: Record<ColorScheme, string> = {
  emerald: '#10B981',
  amber: '#F59E0B',
  sky: '#0EA5E9',
  violet: '#8B5CF6',
  slate: '#94A3B8',
};

const menuItems: MenuItem[] = [
  { href: "/dashboard", label: "Início", icon: Home, colorScheme: 'emerald' },
  { href: "/editais", label: "Meus Editais", icon: FileText, colorScheme: 'amber' },
  { href: "/projetos", label: "Projetos Culturais", icon: CheckCircle, colorScheme: 'sky' },
  {
    href: "/analise-cientifica",
    label: "Análise Científica",
    icon: FlaskConical,
    colorScheme: 'violet',
    submenu: [
      { href: "/analise-cientifica/projetos", label: "Meus Projetos", colorScheme: 'violet' },
      { href: "/analise-cientifica/editais", label: "Editais Científicos", colorScheme: 'violet' },
    ]
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    colorScheme: 'slate',
    submenu: [
      { href: "/configuracoes", label: "Geral", colorScheme: 'slate' },
      { href: "/usuarios", label: "Usuários", colorScheme: 'slate' },
      { href: "/configuracoes/logs", label: "Logs de Erro", colorScheme: 'slate' },
      { href: "/configuracoes/filtros", label: "Filtros de Editais", colorScheme: 'slate' },
      { href: "/configuracoes/portais", label: "Portais de Editais", colorScheme: 'slate' },
      { href: "/configuracoes/prompts", label: "Prompts de IA", colorScheme: 'slate' },
    ]
  },
]

interface SidebarProps {
  mobileOnClose?: () => void;
}

export function Sidebar({ mobileOnClose }: SidebarProps) {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<'admin' | 'editor' | 'leitor' | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/v1/usuarios/me');
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role);
        }
      } catch (err) {
        console.error('Erro ao buscar perfil do usuário:', err);
      }
    };
    fetchUser();
  }, []);

  const handleNavClick = () => {
    if (mobileOnClose) {
      mobileOnClose();
    }
  };

  const isSubMenuActive = (submenu: SubMenuItem[]) => {
    return submenu.some(item => pathname === item.href);
  };

  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    menuItems.forEach(item => {
      if (item.submenu && isSubMenuActive(item.submenu)) {
        initial.add(item.href);
      }
    });
    return initial;
  });

  const toggleSubMenu = (href: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  };

  return (
    <div className={cn(
      "sidebar",
      mobileOnClose && "h-full min-h-full"
    )}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            C+
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Capta</h1>
          <span className="text-blue-600 font-bold dark:text-blue-400">+</span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Gestão de Editais</p>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {menuItems
          .filter((item) => {
            if (item.href === '/configuracoes') {
              return userRole === 'admin';
            }
            return true;
          })
          .map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const hasSubMenu = item.submenu && item.submenu.length > 0;
          const isExpanded = expandedMenus.has(item.href);

          if (hasSubMenu) {
            return (
              <div key={item.href} className="nav-group">
                <button
                  onClick={() => toggleSubMenu(item.href)}
                  className={cn(
                    "nav-item nav-item-expandable",
                    (isActive || isSubMenuActive(item.submenu!)) && "active"
                  )}
                >
                  <Icon className="h-4 w-4" style={{ color: colorMap[item.colorScheme] }} />
                  <span>{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 ml-auto transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>
                {isExpanded && (
                  <div className="nav-submenu">
                    {item.submenu!.map((subItem) => {
                      const isSubActive = pathname === subItem.href;
                      const subColor = subItem.colorScheme ? colorMap[subItem.colorScheme] : colorMap[item.colorScheme];
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={handleNavClick}
                          className={cn(
                            "nav-submenu-item",
                            isSubActive && "active"
                          )}
                        >
                          {subItem.label === "Logs de Erro" && (
                            <AlertTriangle className="h-3 w-3" style={{ color: subColor }} />
                          )}
                          <span style={{ color: isSubActive ? subColor : undefined }}>{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "nav-item",
                isActive && "active"
              )}
            >
              <Icon className="h-4 w-4" style={{ color: colorMap[item.colorScheme] }} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Plano Governamental</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Vence em: 15 dias</p>
        </div>
      </div>
    </div>
  );
}