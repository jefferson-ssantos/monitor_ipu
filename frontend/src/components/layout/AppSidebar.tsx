import React, { useState, Fragment } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  LogOut,
  Cable,
  Activity,
  Target,
  PanelLeft,
  Sparkles
} from "lucide-react";
import orysLogo from "@/assets/logo-laranja.png";
import orysLogoCollapsed from "@/assets/orys-logo.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UpgradePlanModal } from "./UpgradePlanModal";

export function AppSidebar() {
  const { signOut } = useAuth();
  const { permissions, loading } = usePermissions();
  const { open, toggleSidebar } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const [analysisExpanded, setAnalysisExpanded] = useState(currentPath.startsWith('/analysis'));
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Move all hooks to the top - before any conditional returns

  if (loading) {
    return (
      <Sidebar
        className="transition-all duration-300 border-r border-border bg-card"
        collapsible="icon"
      >
        <SidebarContent>
          <div className="p-4">
            <div className="text-sm text-muted-foreground">Carregando...</div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  const getPlanInfo = () => {
    if (permissions?.canAccessAnalysis && permissions?.canAccessDetalhamento) {
      return { name: "Plano Pro", short: "P" };
    }
    if (permissions?.canAccessDashboardEssential) {
      return { name: "Plano Essential", short: "E" };
    }
    if (permissions?.canAccessDashboardStarter) {
      return { name: "Plano Starter", short: "S" };
    }
    return { name: "Não Aplicável", short: "N/A" }; // Fallback
  };

  const plan = getPlanInfo();
  const showUpgradeButton = plan.name !== "Não Aplicável";

  // Navigation data structures - filtered by permissions
  const getMainNavItems = () => {
    const items = [];
    
    if (permissions?.canAccessDashboardEssential) {
      items.push({
        title: "Dashboard",
        url: "/dashboard",
        icon: BarChart3,
        description: "Visão geral dos custos e consumo"
      });
    } else if (permissions?.canAccessDashboardStarter) {
      items.push({
        title: "Dashboard",
        url: "/dashboard-starter",
        icon: BarChart3, 
        description: "Visão geral dos custos e consumo"
      });
    }
    
    return items;
  };

  const getConfigItems = () => {
    if (!permissions?.canAccessConfiguration) return [];
    
    return [
      {
        title: "Configurações",
        url: "/config/connections",
        icon: Cable,
        description: "Configurações gerais"
      }
    ];
  };

  const getDetailItems = () => {
    if (!permissions?.canAccessDetalhamento) return [];
    
    return [
      {
        title: "Detalhamento",
        url: "/detalhamento",
        icon: PieChart,
        description: "Detalhamento por Asset"
      }
    ];
  };

  const getAnalysisItems = () => {
    if (!permissions?.canAccessAnalysis) return [];
    
    return [
      {
        title: "Tendências",
        url: "/analysis/trends",
        icon: Activity,
        description: "Análise de tendências de custos"
      },
      {
        title: "Análise Preditiva",
        url: "/analysis/forecast",
        icon: Target,
        description: "Previsões e análises preditivas"
      }
    ];
  };

  const mainNavItems = getMainNavItems();
  const configItems = getConfigItems();
  const analysisItems = getAnalysisItems();
  const detailItems = getDetailItems();

  const isActive = (path: string) => currentPath === path;
  const isAnalysisActive = currentPath.startsWith('/analysis');
  
  const getNavClasses = (path: string) => {
    const isItemActive = isActive(path);
    return `group transition-all duration-200 ${
      isItemActive
        ? "bg-primary/10 text-primary border-r-2 border-primary shadow-soft"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    }`;
  };

  const getSubNavClasses = (path: string) => {
    const isItemActive = isActive(path);
    return `group transition-all duration-200 pl-6 ${
      isItemActive
        ? "bg-primary/10 text-primary border-r-2 border-primary shadow-soft"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    }`;
  };

  const handleLogout = () => {
    signOut();
  };

  return (
    <Fragment>
      <Sidebar
      className="transition-all duration-300 border-r border-border bg-card"
      collapsible="icon"
    >
      {/* Header */}
      {open ? (
        // Expanded state
        <div className="flex items-center justify-between border-b border-border h-16 px-4">
          <img
            src={orysLogo}
            alt="Orys Logo" 
            className="h-14 w-40"
          />
          <Button
            onClick={toggleSidebar}
            variant="ghost"
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
            title="Recolher"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        // Collapsed state
        <div className="flex flex-col items-center gap-4 border-b border-border py-4">
          <img
            src={orysLogoCollapsed}
            alt="Orys Logo"
            className="h-10 w-10 object-contain"
          />
          <Button
            onClick={toggleSidebar}
            variant="ghost"
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
            title="Expandir"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        </div>
      )}

      <SidebarContent className="flex flex-col h-full">
        {/* Main Navigation */}
        {(mainNavItems.length > 0 || analysisItems.length > 0 || detailItems.length > 0) && (
          <SidebarGroup
            className={
              !open ? "border-t border-border/50 pt-2 mt-2 first:border-t-0 first:mt-0 first:pt-0" : ""
            }
          >
            <SidebarGroupLabel className={!open ? "sr-only" : ""}>
              Principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild className="h-12">
                      <NavLink
                        to={item.url}
                        className={getNavClasses(item.url)}
                        title={!open ? item.description : undefined}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {open && (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{item.title}</span>
                            <span className="text-xs opacity-70">{item.description}</span>
                          </div>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Analysis Section */}
                {analysisItems.length > 0 && (
                  <Fragment>
                {/* Parent Analysis Item */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    className="h-12"
                  >
                    <NavLink
                      to="/analysis"
                      className={`group transition-all duration-200 ${
                        isAnalysisActive
                          ? "bg-primary/10 text-primary border-r-2 border-primary shadow-soft"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                      title={!open ? "Análise de Custos" : undefined}
                    >
                      <TrendingUp className="h-5 w-5 flex-shrink-0" />
                      {open && (
                        <div className="flex flex-col items-start flex-1">
                          <span className="font-medium">Análise de Custos</span>
                          <span className="text-xs opacity-70">Análise Preditivas e Tendências</span>
                        </div>
                      )}
                      {open && (
                        <div 
                          className={`transition-transform duration-200 ${analysisExpanded ? 'rotate-90' : ''}`}
                          onClick={(e) => {
                            e.preventDefault();
                            setAnalysisExpanded(!analysisExpanded);
                          }}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Submenu Items */}
                {analysisExpanded && open && analysisItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild className="h-10">
                      <NavLink
                        to={item.url}
                        className={getSubNavClasses(item.url)}
                        title={item.description}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="font-normal text-sm">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Sub-items when collapsed */}
                {!open && analysisItems.map((item) => (
                  <SidebarMenuItem key={`collapsed-${item.url}`}>
                    <SidebarMenuButton asChild className="h-10">
                      <NavLink
                        to={item.url}
                        className={`group transition-all duration-200 flex items-center justify-center ${
                          isActive(item.url)
                            ? "bg-primary/10 text-primary border-r-2 border-primary shadow-soft"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                        title={item.description}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                  </Fragment>
                )}

                {/* Detalhamento Item */}
                {detailItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild className="h-12">
                      <NavLink
                        to={item.url}
                        className={getNavClasses(item.url)}
                        title={!open ? item.description : undefined}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {open && (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{item.title}</span>
                            <span className="text-xs opacity-70">{item.description}</span>
                          </div>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}


        {/* Configuration */}
        {configItems.length > 0 && (
          <SidebarGroup
            className={
              !open ? "border-t border-border/50 pt-2 mt-2 first:border-t-0 first:mt-0 first:pt-0" : ""
            }
          >
            <SidebarGroupLabel className={!open ? "sr-only" : ""}>
              Configuração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {configItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild className="h-12">
                      <NavLink
                        to={item.url}
                        className={getNavClasses(item.url)}
                        title={!open ? item.description : undefined}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {open && (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{item.title}</span>
                            <span className="text-xs opacity-70">{item.description}</span>
                          </div>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Logout at bottom */}
        <div className="mt-auto p-4 border-t border-border space-y-2">
          <div className={`flex flex-col w-full gap-2 ${open ? 'items-start' : 'items-center'}`}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs font-medium">
                    {open ? plan.name : plan.short}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col items-start p-2">
                  <span>{plan.name}</span>
                  {showUpgradeButton && <span className="text-xs text-muted-foreground">Clique para fazer upgrade</span>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {showUpgradeButton && (
              <div className="p-0.5 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 rounded-lg inline-block">
                <Button
                  variant="ghost"
                  onClick={() => setIsUpgradeModalOpen(true)}
                  title="Fazer Upgrade"
                  className={`h-9 bg-card text-secondary hover:bg-muted hover:text-secondary flex items-center ${open ? 'px-3' : 'w-9 justify-center px-0'}`}
                >
                  <Sparkles className="h-4 w-4 flex-shrink-0" />
                  {open && <span className="ml-1.5 text-sm font-semibold">Upgrade</span>}
                </Button>
              </div>
            )}
          </div>

          <Button
            onClick={handleLogout}
            variant="ghost"
            className={`w-full h-12 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 ${
              open ? "justify-start" : "justify-center px-0"
            }`}
            title={!open ? "Sair" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {open && <span className="ml-3">Sair</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
    <UpgradePlanModal open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen} permissions={permissions} />
    </Fragment>
  );
}