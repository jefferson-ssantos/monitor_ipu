import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/useDashboardData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, LabelList } from "recharts";
import { ArrowUpDown, Download, Calendar, Filter } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { CYCLE_FILTER_OPTIONS } from "@/lib/cycleFilterOptions";
import { useChartSync } from "@/hooks/useChartSync";

interface OrganizationComparisonProps {
  selectedOrg?: string;
  selectedCycleFilter?: string;
  availableOrgs?: Array<{ value: string; label: string }>;
  onOrgChange?: (value: string) => void;
  onCycleFilterChange?: (value: string) => void;
  metric?: "cost" | "ipu";
  onMetricChange?: (metric: "cost" | "ipu") => void;
}

const CustomTooltip = ({ active, payload, label, metric, formatCurrency, formatIPU, uniqueOrgs, colors }: any) => {
  if (active && payload && payload.length) {
    // Get organizations with values > 0 and sort by value (descending)
    const orgsWithValues = uniqueOrgs.map((orgName: string, index: number) => {
      const orgKey = orgName.replace(/\s+/g, '_');
      const value = payload.find((p: any) => p.dataKey === orgKey)?.value || 0;
      return {
        name: orgName,
        value,
        color: colors[index % colors.length]
      };
    }).filter((o: any) => o.value > 0).sort((a: any, b: any) => b.value - a.value);

    // Show first 12 organizations
    const displayOrgs = orgsWithValues.slice(0, 12);
    const total = orgsWithValues.reduce((sum: number, item: any) => sum + item.value, 0);
    
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 max-w-md">
        <p className="font-medium text-foreground mb-3">Ciclo: {label}</p>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {displayOrgs.map((org: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: org.color }}
                />
                <span className="text-muted-foreground truncate">
                  {org.name}
                </span>
              </div>
              <span className="font-medium text-foreground flex-shrink-0">
                {metric === 'cost' ? formatCurrency(org.value) : formatIPU(org.value)}
              </span>
            </div>
          ))}
        </div>
        {orgsWithValues.length > 12 && (
          <div className="text-xs text-muted-foreground mt-2 text-center">
            E mais {orgsWithValues.length - 12} organizações...
          </div>
        )}
        <div className="border-t border-border mt-3 pt-3">
          <div className="flex justify-between items-center text-sm font-medium">
            <span>Total:</span>
            <span>{metric === 'cost' ? formatCurrency(total) : formatIPU(total)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function OrganizationComparison({ 
  selectedOrg = "all", 
  selectedCycleFilter = "12",
  availableOrgs = [],
  onOrgChange,
  onCycleFilterChange,
  metric: controlledMetric,
  onMetricChange
}: OrganizationComparisonProps) {
  const { data, loading, getChartData } = useDashboardData(selectedOrg === "all" ? undefined : selectedOrg, selectedCycleFilter);
  const [uncontrolledMetric, setUncontrolledMetric] = useState<"cost" | "ipu">("cost");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCycleData, setSelectedCycleData] = useState<{period: string, organizations: Array<{name: string, value: number, color: string}>} | null>(null);
  const [pricePerIpu, setPricePerIpu] = useState<number>(0);
  const chartRef = useRef<HTMLDivElement>(null);
  const { maxYValue, updateChartData, isReady } = useChartSync();

  // Use controlled state if provided, otherwise use internal state
  const metric = controlledMetric ?? uncontrolledMetric;
  const setMetric = onMetricChange ?? setUncontrolledMetric;

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, []);

  const formatIPU = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  }, []);

  const renderCustomizedLabel = useCallback((props: any) => {
    const { x, y, width, value } = props;
    if (value > 0) {
      return (
        <text x={x + width / 2} y={y} fill="#3a3a3a" textAnchor="middle" dy={-6} fontSize={12} fontWeight="bold">
          {metric === 'cost' ? formatCurrency(value) : formatIPU(value)}
        </text>
      );
    }
    return null;
  }, [metric, formatCurrency, formatIPU]);

  // Fetch evolution data to get cycles with organization breakdown
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchCycleData = async () => {
      if (!getChartData) return;
      
      // Debounce para evitar chamadas excessivas
      timeoutId = setTimeout(async () => {
        if (!isMounted) return;
        
        setChartLoading(true);
        try {
          const evolutionData = await getChartData('evolution', selectedOrg === "all" ? undefined : selectedOrg, selectedCycleFilter);
          
          if (!isMounted) return;
          
          // Check if evolutionData is an array
          const dataArray = Array.isArray(evolutionData) ? evolutionData : [];
          
          if (dataArray.length === 0) {
            setChartData([]);
            return;
          }

          // Get price per IPU
          const pricePerIPU = data?.pricePerIPU || 1;
          setPricePerIpu(pricePerIPU);

          // For now, we'll create dummy organization data per cycle
          // In a real scenario, you'd need to modify getChartData to return organization breakdown per cycle
          const processedData = dataArray.map((item: any) => ({
            cycle: item.period,
            displayTotal: metric === 'cost' ? item.cost : item.ipu,
            totalIPU: item.ipu,
            totalCost: item.cost,
            // For demonstration, we'll split data proportionally based on current org distribution
            ...(data?.organizations?.reduce((acc, org, index) => {
              const orgKey = org.org_name.replace(/\s+/g, '_');
              const proportion = org.percentage / 100;
              acc[orgKey] = metric === 'cost' ? (item.cost * proportion) : (item.ipu * proportion);
              return acc;
            }, {} as any) || {})
          }));

          if (isMounted) {
            setChartData(processedData);
          }
        } catch (error) {
          if (isMounted) {
            setChartData([]);
          }
        } finally {
          if (isMounted) {
            setChartLoading(false);
          }
        }
      }, 200); // Debounce de 200ms
    };

    fetchCycleData();
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [getChartData, selectedOrg, selectedCycleFilter, metric, data?.organizations, data?.pricePerIPU]);

  // Get unique organizations for creating bars
  const uniqueOrgs = useMemo(() => data?.organizations?.map(org => org.org_name) || [], [data?.organizations]);

  // Calculate contracted reference value based on metric
  const contractedReferenceValue = useMemo(() => (data ? 
    (metric === 'cost' ? (data.contractedIPUs * data.pricePerIPU) : data.contractedIPUs) : 0),
  [data, metric]);

  // Calculate max value and update sync context
  useEffect(() => {
    if (chartData.length > 0) {
      const maxDataValue = Math.max(...chartData.map(d => d.displayTotal));
      updateChartData('organizationComparison', {
        maxValue: maxDataValue,
        contractedValue: contractedReferenceValue
      });
    }
  }, [chartData, contractedReferenceValue, updateChartData]);

  // Use synchronized Y-axis domain
  const yAxisDomainMax = useMemo(() => {
    return isReady && maxYValue > 0 ? maxYValue : 'auto';
  }, [maxYValue, isReady]);

  // Color palette for different organizations
const colors = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))", 
  "hsl(var(--accent))",
  'hsl(283 70% 60%)', // Purple
  'hsl(142 70% 45%)', // Green
  'hsl(346 70% 60%)', // Pink
  'hsl(197 70% 55%)', // Blue
  'hsl(43 70% 55%)', // Yellow
  'hsl(15 70% 55%)', // Red-orange
  'hsl(260 70% 65%)', // Violet
  'hsl(120 35% 50%)', // Teal
  'hsl(210 40% 60%)', // Slate
  'hsl(340 60% 65%)', // Rose
];

  const handleDownload = async () => {
    const chartContainer = document.getElementById('organization-comparison-container');
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
      link.download = `analise-custos-organizacoes-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      toast("Gráfico exportado com sucesso!");
    } catch (error) {
      toast("Erro ao exportar gráfico");
    }
  };

  const yAxisTickFormatter = useCallback((value: number) => 
    metric === 'cost' ? formatCurrency(value) : formatIPU(value),
    [metric, formatCurrency, formatIPU]
  );

  const renderTooltip = useCallback((props: any) => (
    <CustomTooltip {...props} metric={metric} formatCurrency={formatCurrency} formatIPU={formatIPU} uniqueOrgs={uniqueOrgs} colors={colors} />
  ), [metric, formatCurrency, formatIPU, uniqueOrgs]);

  const handleBarClick = useCallback((data: any) => {
    if (!data || !data.activePayload) return;
    
    const period = data.activeLabel;
    const organizations = uniqueOrgs.map((orgName: string, index: number) => {
      const orgKey = orgName.replace(/\s+/g, '_');
      const value = data.activePayload.find((p: any) => p.dataKey === orgKey)?.value || 0;
      return {
        name: orgName,
        value,
        color: colors[index % colors.length]
      };
    }).filter(o => o.value > 0).sort((a, b) => b.value - a.value);
    
    setSelectedCycleData({ period, organizations });
    setModalOpen(true);
  }, [uniqueOrgs]);

  return (
    <Card className="bg-gradient-card shadow-medium" id="organization-comparison-container">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-heading font-bold">
              Análise Custos por Organização
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Custos por organização ao longo dos ciclos
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>
          
          {/* Organization Filter */}
          <Select value={selectedOrg} onValueChange={onOrgChange}>
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

          {/* Cycle Filter */}
          <Select value={selectedCycleFilter} onValueChange={onCycleFilterChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CYCLE_FILTER_OPTIONS.map(option => 
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select value={metric} onValueChange={(value) => setMetric(value as "cost" | "ipu")}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ipu">IPUs</SelectItem>
              <SelectItem value="cost">Custo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters */}
        { selectedOrg !== 'all' && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              Organização: {availableOrgs.find(o => o.value === selectedOrg)?.label || selectedOrg}
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {chartLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
         ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">Nenhum dado encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Tente ajustar os filtros ou o período selecionado
                </p>
              </div>
            </div>
        ) : (
          <div ref={chartRef} className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
                onClick={handleBarClick}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="cycle" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={yAxisTickFormatter}
                  domain={[0, yAxisDomainMax]}
                  tickCount={5}
                />
                <Tooltip content={renderTooltip} />
                
                 {/* Reference line for contracted value - always displayed when value exists */}
                 {contractedReferenceValue > 0 && (
                   <ReferenceLine 
                     y={contractedReferenceValue} 
                     stroke="hsl(var(--destructive))" 
                     strokeDasharray="5 5" 
                     strokeWidth={2}
                     label={{ 
                       value: `${metric === 'cost' ? 'Valor Contratado' : 'IPUs Contratadas'}: ${metric === 'cost' ? formatCurrency(contractedReferenceValue) : formatIPU(contractedReferenceValue)}`,
                       position: "insideTopRight",
                       fill: "hsl(var(--destructive))",
                       fontSize: 12,
                       fontWeight: 500
                     }}
                   />
                 )}
                
                {uniqueOrgs.map((orgName, index) => (
                  <Bar 
                    key={orgName}
                    dataKey={orgName.replace(/\s+/g, '_')} 
                    fill={colors[index % colors.length]} 
                    radius={[4, 4, 0, 0]}
                    name={orgName}
                    stackId="stack"
                    style={{ cursor: 'pointer' }}
                  >
                    {index === uniqueOrgs.length - 1 && (
                        <LabelList dataKey="displayTotal" content={renderCustomizedLabel} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Modal for cycle details */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden">
            <DialogHeader className="pb-6">
              <DialogTitle className="text-xl">
                <span className="font-semibold">Detalhes do Ciclo:</span> {selectedCycleData?.period}
              </DialogTitle>
            </DialogHeader>
            
            <div className="overflow-y-auto max-h-[calc(85vh-140px)] pr-2">
              {selectedCycleData && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-card shadow-medium">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-primary mb-2">
                          {selectedCycleData.organizations.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Organizações</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-card shadow-medium">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-primary mb-2">
                          {metric === 'cost' 
                            ? formatCurrency(selectedCycleData.organizations.reduce((sum, o) => sum + o.value, 0))
                            : formatIPU(selectedCycleData.organizations.reduce((sum, o) => sum + o.value, 0))
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {metric === 'cost' ? 'Custo Total' : 'IPUs Totais'}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-card shadow-medium">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-primary mb-2">
                          {metric === 'cost' 
                            ? formatCurrency(selectedCycleData.organizations.reduce((sum, o) => sum + o.value, 0) / selectedCycleData.organizations.length)
                            : formatIPU(selectedCycleData.organizations.reduce((sum, o) => sum + o.value, 0) / selectedCycleData.organizations.length)
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">Média por Organização</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Organizations Grid */}
                  <div className="grid gap-4">
                    <h3 className="font-semibold text-lg mb-2">Organizações do Ciclo</h3>
                    <div className="grid gap-3">
                      {selectedCycleData.organizations.map((org, index) => (
                        <div key={index} className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              <div
                                className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm"
                                style={{ backgroundColor: org.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground truncate">
                                  {org.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {((org.value / selectedCycleData.organizations.reduce((sum, o) => sum + o.value, 0)) * 100).toFixed(1)}% do total
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-semibold text-lg">
                                {metric === 'cost' ? formatCurrency(org.value) : formatIPU(org.value)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatIPU(metric === 'cost' ? org.value / pricePerIpu : org.value)} IPUs
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}