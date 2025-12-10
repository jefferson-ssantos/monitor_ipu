import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Download, Filter, Calendar } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { CYCLE_FILTER_OPTIONS } from "@/lib/cycleFilterOptions";

interface MetricData {
  meter_name: string;
  metric_category: string;
  total_consumption: number;
  total_cost: number;
  percentage: number;
}

export function MetricBreakdown() {
  const [data, setData] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [selectedCycleFilter, setSelectedCycleFilter] = useState<string>("1");
  const [organizations, setOrganizations] = useState<Array<{id: string, name: string}>>([]);
  const [availableCycles, setAvailableCycles] = useState<any[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Get user profile
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('cliente_id')
          .eq('id', user.id)
          .single();

        if (!profile) return;

        // Get client pricing
        const { data: clientData } = await supabase
          .from('api_clientes')
          .select('preco_por_ipu')
          .eq('id', profile.cliente_id)
          .single();

        if (!clientData) return;

        // Get configurations
        const { data: configs } = await supabase
          .from('api_configuracaoidmc')
          .select('id')
          .eq('cliente_id', profile.cliente_id);

        if (!configs?.length) return;

        const configIds = configs.map(c => c.id);

        // Get available cycles using the same function as dashboard
        const { data: cyclesData } = await supabase
          .rpc('get_available_cycles');

        setAvailableCycles(cyclesData || []);

        // Get organizations for filter
        const { data: orgData } = await supabase
          .from('api_consumosummary')
          .select('org_id, org_name')
          .in('configuracao_id', configIds)
          .neq('meter_name', 'Sandbox Organizations IPU Usage')
          .not('org_name', 'is', null);

        const uniqueOrgs = Array.from(
          new Map(orgData?.map(item => [item.org_id, item]) || []).values()
        ).map(org => ({ id: org.org_id, name: org.org_name }));

        setOrganizations(uniqueOrgs);

        // Use consumption summary data with cycle filtering
        const cycleLimit = selectedCycleFilter && selectedCycleFilter !== 'all' 
          ? parseInt(selectedCycleFilter) 
          : null;

        // Get unique cycles for filtering
        const { data: availableCyclesData } = await supabase
          .rpc('get_available_cycles');

        // Apply cycle filtering manually
        let billingQuery = supabase
          .from('api_consumosummary')
          .select('meter_name, metric_category, consumption_ipu, billing_period_start_date, billing_period_end_date')
          .in('configuracao_id', configIds)
          .neq('meter_name', 'Sandbox Organizations IPU Usage')
          .gt('consumption_ipu', 0);

        if (selectedOrg !== "all") {
          billingQuery = billingQuery.eq('org_id', selectedOrg);
        }

        // Apply cycle filtering
        if (cycleLimit && availableCyclesData?.length) {
          const cyclesToInclude = availableCyclesData.slice(0, cycleLimit);
          const periodFilters = cyclesToInclude.map(cycle => 
            `(billing_period_start_date.eq.${cycle.billing_period_start_date},billing_period_end_date.eq.${cycle.billing_period_end_date})`
          ).join(',');
          
          if (cyclesToInclude.length === 1) {
            billingQuery = billingQuery
              .eq('billing_period_start_date', cyclesToInclude[0].billing_period_start_date)
              .eq('billing_period_end_date', cyclesToInclude[0].billing_period_end_date);
          } else if (cyclesToInclude.length > 1) {
            // For multiple cycles, we need to use the or filter
            const orConditions = cyclesToInclude.map(cycle => 
              `and(billing_period_start_date.eq.${cycle.billing_period_start_date},billing_period_end_date.eq.${cycle.billing_period_end_date})`
            ).join(',');
            billingQuery = billingQuery.or(orConditions);
          }
        }

        const { data: billingData } = await billingQuery;

        if (!billingData) return;

        // Group by meter_name and metric_category
        const groupedData = billingData.reduce((acc, item) => {
          const processedMeterName = (item.meter_name || 'Outros').replace(/\s\s+/g, ' ').trim();
          const key = `${processedMeterName}-${item.metric_category || 'General'}`;
          if (!acc[key]) {
            acc[key] = {
              meter_name: processedMeterName,
              metric_category: item.metric_category || 'General',
              total_consumption: 0,
              total_cost: 0,
              percentage: 0
            };
          }
          acc[key].total_consumption += item.consumption_ipu;
          acc[key].total_cost += item.consumption_ipu * clientData.preco_por_ipu;
          return acc;
        }, {} as Record<string, MetricData>);

        const metricsArray = Object.values(groupedData);
        const totalConsumption = metricsArray.reduce((sum, item) => sum + item.total_consumption, 0);

        // Calculate percentages
        const processedData = metricsArray
          .map(item => ({
            ...item,
            percentage: totalConsumption > 0 ? (item.total_consumption / totalConsumption) * 100 : 0
          }))
          .sort((a, b) => b.total_consumption - a.total_consumption);

        setData(processedData);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedOrg, selectedCycleFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatIPU = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const colors = [
    'hsl(24 70% 60%)', // Orange
    'hsl(283 70% 60%)', // Purple
    'hsl(142 70% 45%)', // Green
    'hsl(346 70% 60%)', // Pink
    'hsl(197 70% 55%)', // Blue
    'hsl(43 70% 55%)', // Yellow
    'hsl(15 70% 55%)', // Red-orange
    'hsl(260 70% 65%)', // Violet
    'hsl(120 35% 50%)', // Teal
    'hsl(39 70% 50%)', // Amber
    'hsl(210 40% 60%)', // Slate
    'hsl(340 60% 65%)', // Rose
  ];

  const chartData = data.slice(0, 8).map((item, index) => ({
    name: `${item.meter_name} (${item.metric_category})`,
    value: item.total_consumption,
    percentage: item.percentage,
    cost: item.total_cost,
    fill: colors[index % colors.length]
  }));

  const handleDownload = async () => {
    const chartContainer = document.getElementById('metric-breakdown-container');
    if (!chartContainer) return;
    
    try {
      // Pequeno delay para garantir que elementos estejam renderizados
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(chartContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        height: chartContainer.offsetHeight,
        width: chartContainer.offsetWidth,
        useCORS: true,
        allowTaint: false,
        ignoreElements: (element) => {
          return element.tagName === 'BUTTON' && element.textContent?.includes('Exportar');
        }
      });
      
      const link = document.createElement('a');
      link.download = `detalhamento-metricas-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      toast("Gráfico exportado com sucesso!");
    } catch (error) {
      toast("Erro ao exportar gráfico");
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-primary">{formatCurrency(data.cost)}</p>
          <p className="text-muted-foreground">{formatIPU(data.value)} IPUs</p>
          <p className="text-muted-foreground">{data.percentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  const filterOptions = CYCLE_FILTER_OPTIONS;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-card shadow-medium" id="metric-breakdown-container">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Detalhamento por Métrica</CardTitle>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            </div>
            
            <Select value={selectedCycleFilter} onValueChange={setSelectedCycleFilter}>
              <SelectTrigger className="w-[180px] bg-background border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                {filterOptions.map((option) => {
                  const isDisabled = option.value !== 'all' && 
                                    !isNaN(parseInt(option.value)) && 
                                    parseInt(option.value) > availableCycles.length;
                  
                  return (
                    <SelectItem 
                      key={option.value} 
                      value={option.value}
                      disabled={isDisabled}
                      className="focus:bg-accent focus:text-accent-foreground"
                    >
                      {option.label}
                      {isDisabled && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (Indisponível)
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Organizações</SelectItem>
                {organizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div ref={chartRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    dataKey="value"
                    label={({ percentage }) => `${percentage.toFixed(1)}%`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.slice(0, 10).map((metric, index) => (
                <div key={`${metric.meter_name}-${metric.metric_category}`} 
                     className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    />
                    <div>
                      <div className="font-medium">{metric.meter_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {metric.metric_category}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge variant="secondary" className="text-sm mt-1"> {/* Aumentado para text-sm */}
                      {formatCurrency(metric.total_cost)}
                    </Badge>
                    <div className="text-xs text-muted-foreground">{formatIPU(metric.total_consumption)} IPUs</div> {/* Alterado para text-xs */}
                    <Badge variant="outline" className="text-xs mt-1">
                      {metric.percentage.toFixed(1)}%
                    </Badge>
                  </div>                  
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}