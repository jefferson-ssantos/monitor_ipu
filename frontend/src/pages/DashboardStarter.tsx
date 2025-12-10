import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/dashboard/KPICard";
import { ConsolidatedChartStarter } from "@/components/dashboard/ConsolidatedChartStarter";
import { ConsolidatedChartMetric } from "@/components/dashboard/ConsolidatedChartMetric";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePageHeader } from "@/components/layout/AppLayout";
import { DollarSign, Building2, Calendar, BarChart3 } from "lucide-react";

export default function DashboardStarter() {
  const { user } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [selectedCycleFilter, setSelectedCycleFilter] = useState<string>("12");
  const [availableOrgs, setAvailableOrgs] = useState<Array<{
    value: string;
    label: string;
  }>>([]);
  
  const {
    data: dashboardData,
    loading,
    error,
    refetch,
  } = useDashboardData(selectedOrg === "all" ? undefined : selectedOrg, selectedCycleFilter);

  const pageTitle = useMemo(() => (
    <>
      <BarChart3 className="h-6 w-6 text-primary" />
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>
    </>
  ), []);
  usePageHeader(pageTitle);

  // Fetch available organizations
  useEffect(() => {
    if (!user) return;
    const fetchOrganizations = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('cliente_id')
          .eq('id', user.id)
          .single();
        if (!profile?.cliente_id) return;

        const { data: configs } = await supabase
          .from('api_configuracaoidmc')
          .select('id')
          .eq('cliente_id', profile.cliente_id);
        if (!configs || configs.length === 0) return;
        
        const configIds = configs.map(config => config.id);
        const { data: orgs } = await supabase
          .from('api_consumosummary')
          .select('org_id, org_name')
          .in('configuracao_id', configIds)
          .neq('meter_name', 'Sandbox Organizations IPU Usage');
        
        if (orgs) {
          const uniqueOrgs = Array.from(
            new Map(orgs.map(org => [org.org_id, org])).values()
          ).filter(org => org.org_id && org.org_name);
          
          setAvailableOrgs([
            { value: "all", label: "Todas as Organizações" },
            ...uniqueOrgs.map(org => ({
              value: org.org_id,
              label: org.org_name || org.org_id
            }))
          ]);

          const prodOrg = uniqueOrgs.find(org => 
            org.org_name?.toLowerCase().includes('produção') || 
            org.org_name?.toLowerCase().includes('production')
          );
          if (prodOrg) {
            setSelectedOrg(prodOrg.org_id);
          }
        }
      } catch (error) {
      }
    };
    fetchOrganizations();
  }, [user]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">Erro ao carregar dados: {error}</p>
          <Button onClick={refetch}>Tentar novamente</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-1 p-6 space-y-6">
        {/* KPI Section - Simplified for Starter */}
        <Card className="bg-gradient-card shadow-medium">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle className="text-xl font-heading font-bold text-foreground">
                    Indicadores
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {dashboardData?.periodStart && dashboardData?.periodEnd && (
                      <Badge variant="outline" className="text-primary">
                        <Calendar className="h-3 w-3 mr-1" />
                        {dashboardData.periodStart} - {dashboardData.periodEnd}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrgs.map(org => 
                      <SelectItem key={org.value} value={org.value}>
                        {org.label}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <KPICard 
                title="Custo Total" 
                value={formatCurrency(dashboardData?.totalCost || 0)} 
                icon={DollarSign} 
                variant="default" 
              />
              
              <KPICard 
                title="Organizações Ativas" 
                value={dashboardData?.activeOrgs || 0} 
                subtitle="Com consumo no período" 
                icon={Building2} 
                variant="default" 
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ConsolidatedChartStarter 
            selectedOrg={selectedOrg === "all" ? undefined : selectedOrg} 
            availableOrgs={availableOrgs} 
          />

          <ConsolidatedChartMetric 
            selectedOrg={selectedOrg === "all" ? undefined : selectedOrg} 
            availableOrgs={availableOrgs} 
          />
        </div>

      </div>
    </div>
  );
}