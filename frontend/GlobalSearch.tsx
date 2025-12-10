import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { LayoutDashboard, TrendingUp, Settings, ListTree, Search, Activity, Target } from "lucide-react";

const pages = [
  {
    id: "dashboard",
    name: "Dashboard",
    path: "/dashboard",
    permission: "canAccessDashboard",
    icon: <LayoutDashboard className="mr-2 h-4 w-4" />,
  },
  {
    id: "analysis",
    name: "Análise de Custos / Visão Geral",
    path: "/analysis",
    permission: "canAccessAnalysis",
    icon: <TrendingUp className="mr-2 h-4 w-4" />,
  },
  {
    id: "analysis-trends",
    name: "Análise de Custos / Tendências",
    path: "/analysis/trends",
    permission: "canAccessAnalysis",
    icon: <Activity className="mr-2 h-4 w-4" />,
  },
  {
    id: "analysis-forecast",
    name: "Análise de Custos / Preditiva",
    path: "/analysis/forecast",
    permission: "canAccessAnalysis",
    icon: <Target className="mr-2 h-4 w-4" />,
  },
  {
    id: "detalhamento",
    name: "Detalhamento de Consumo",
    path: "/detalhamento",
    permission: "canAccessDetalhamento",
    icon: <ListTree className="mr-2 h-4 w-4" />,
  },
  {
    id: "config",
    name: "Configurações",
    path: "/config",
    permission: "canAccessConfiguration",
    icon: <Settings className="mr-2 h-4 w-4" />,
  },
];

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { permissions, loading } = usePermissions();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const availablePages = React.useMemo(() => {
    if (loading || !permissions) return [];
    return pages.filter(page => permissions[page.permission as keyof typeof permissions]);
  }, [permissions, loading]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="sr-only">Buscar</span>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Digite um comando ou busque..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Páginas">
            {availablePages.map((page) => (
              <CommandItem
                key={page.id}
                value={page.name}
                onSelect={() => runCommand(() => navigate(page.path))}
              >
                {page.icon}
                <span>{page.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}