import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList } from "recharts";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { useDashboardData } from "@/hooks/useDashboardData";

// Custom cycle options for starter dashboard
const STARTER_CYCLE_OPTIONS = [
  { value: "1", label: "Ciclo Atual" },
  { value: "2", label: "Últimos 2 Ciclos" },
  { value: "3", label: "Últimos 3 Ciclos" }
];

interface ConsolidatedChartMetricProps {
  selectedOrg?: string;
  availableOrgs: Array<{value: string, label: string}>;
}

interface ChartDataItem {
  period: string;
  [key: string]: any;
}

interface MetricOption {
  value: string;
  label: string;
}

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

export function ConsolidatedChartMetric({ selectedOrg, availableOrgs }: ConsolidatedChartMetricProps) {
  const [selectedOrgLocal, setSelectedOrgLocal] = useState<string>(selectedOrg || "all");
  const [period, setPeriod] = useState("3");
  const [selectedMetric, setSelectedMetric] = useState<string>("all");
  const [valueType, setValueType] = useState<"cost" | "ipu">("ipu");
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricOptions, setMetricOptions] = useState<MetricOption[]>([]);
  const [allDataKeys, setAllDataKeys] = useState<string[]>([]);
  const [contractedValue, setContractedValue] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCycleData, setSelectedCycleData] = useState<{period: string, metrics: Array<{name: string, value: number, color: string}>} | null>(null);
  const [pricePerIpu, setPricePerIpu] = useState<number>(0);

  // Use useDashboardData hook to fetch data
  const { getChartData: getDashboardChartData, availableCycles, data: dashboardData } = useDashboardData(selectedOrgLocal === "all" ? undefined : selectedOrgLocal);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatIPU = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getDashboardChartData('billing-periods', selectedOrgLocal, period);
        if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
          // Get price per IPU for conversion
          const pricePerIPU = dashboardData?.pricePerIPU || 1;
          setPricePerIpu(pricePerIPU);
          
          // Process data based on value type
          let processedData = result.data;
          if (valueType === 'ipu' && pricePerIPU > 0) {
            // Convert cost values to IPU values
            processedData = result.data.map((item: any) => {
              const convertedItem = { ...item };
              // Convert all metric values from cost to IPU
              if (result.meters) {
                result.meters.forEach((meter: string) => {
                  if (convertedItem[meter]) {
                    convertedItem[meter] = convertedItem[meter] / pricePerIPU;
                  }
                });
              }
              return convertedItem;
            });
          }
          
          // Handle object result with data property
          setChartData(processedData);
          setAllDataKeys(result.meters || []);
          
          // Convert contracted value based on value type
          let adjustedContractedValue = result.contractedReferenceValue || 0;
          if (valueType === 'ipu' && pricePerIPU > 0) {
            adjustedContractedValue = adjustedContractedValue / pricePerIPU;
          }
          setContractedValue(adjustedContractedValue);

          // Update metric options based on fetched meters
          const newMetricOptions = (result.meters || []).map((meter: string) => ({ value: meter, label: meter }));
          setMetricOptions([{ value: "all", label: "Todas as Métricas" }, ...newMetricOptions]);
        } else if (result && Array.isArray(result)) {
          // Handle array result - try to convert to ChartDataItem format
          const convertedData = result.filter(item => item && typeof item === 'object' && 'period' in item) as ChartDataItem[];
          setChartData(convertedData);
          setAllDataKeys([]);
          setContractedValue(0);
          setMetricOptions([{ value: "all", label: "Todas as Métricas" }]);
        } else {
          setChartData([]);
          setAllDataKeys([]);
          setContractedValue(0);
          setMetricOptions([{ value: "all", label: "Todas as Métricas" }]);
        }
      } catch (error) {
        toast.error('Erro ao carregar dados do gráfico');
      } finally {
        setLoading(false);
      }
    };
    if (getDashboardChartData) {
      fetchData();
    }
  }, [selectedOrgLocal, period, getDashboardChartData, valueType, dashboardData?.pricePerIPU]);

  // Update selectedOrgLocal when selectedOrg prop changes
  useEffect(() => {
    setSelectedOrgLocal(selectedOrg || "all");
  }, [selectedOrg]);

  const getFilteredDataKeys = () => {
    if (selectedMetric === "all") {
        return allDataKeys;
    }
    
    const filtered = allDataKeys.filter(key => key === selectedMetric);
    
    if (filtered.length === 0 && selectedMetric !== "all") {
        return [];
    }

    return filtered;
  };

  const filteredDataKeys = getFilteredDataKeys();

  const chartDataWithDisplayTotal = chartData.map(d => {
    const displayTotal = filteredDataKeys.reduce((acc, key) => acc + (d[key] || 0), 0);
    return { ...d, displayTotal };
  });

  const yAxisDomain = () => {
    if (chartDataWithDisplayTotal.length === 0) return [0, 1000]; // Default if no data

    let maxVal = 0;
    chartDataWithDisplayTotal.forEach(d => {
      const total = d.displayTotal || 0;
      if (total > maxVal) {
        maxVal = total;
      }
    });

    // Include contracted value in domain calculation when showing in default view
    if (selectedOrgLocal === "all" && selectedMetric === "all" && contractedValue > 0) {
      maxVal = Math.max(maxVal, contractedValue);
    }

    return [0, maxVal * 1.1]; // Add 10% padding
  };

  const renderCustomizedLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value > 0) {
        return (
            <text x={x + width / 2} y={y} fill="#3a3a3a" textAnchor="middle" dy={-6} fontSize={12} fontWeight="bold">
                {valueType === 'cost' ? formatCurrency(value) : formatIPU(value)}
            </text>
        );
    }
    return null;
  };

  const handleDownload = async () => {
    try {
      const chartElement = document.getElementById('consolidated-chart-container');
      if (!chartElement) return;

      // Pequeno delay para garantir que elementos estejam renderizados
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        height: chartElement.offsetHeight,
        width: chartElement.offsetWidth,
        useCORS: true,
        allowTaint: false,
        ignoreElements: (element) => {
          return element.tagName === 'BUTTON' && element.textContent?.includes('Exportar');
        }
      });

      const link = document.createElement('a');
      link.download = `analise-consolidada-metricas-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();

      toast.success('Gráfico exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar o gráfico');
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Get metrics with values > 0 and sort by value (descending)
      const metricsWithValues = filteredDataKeys.map((key: string, index: number) => {
        const value = payload.find((p: any) => p.dataKey === key)?.value || 0;
        return {
          name: key,
          value,
          color: colors[index % colors.length]
        };
      }).filter((m: any) => m.value > 0).sort((a: any, b: any) => b.value - a.value);

      // Show first 12 metrics
      const displayMetrics = metricsWithValues.slice(0, 12);
      const total = metricsWithValues.reduce((sum: number, item: any) => sum + item.value, 0);
      
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-4 max-w-md">
          <p className="font-medium text-foreground mb-3">{label}</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {displayMetrics.map((metric: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: metric.color }}
                  />
                  <span className="text-muted-foreground truncate">
                    {metric.name}
                  </span>
                </div>
                <span className="font-medium text-foreground flex-shrink-0">
                  {valueType === 'cost' ? formatCurrency(metric.value) : formatIPU(metric.value)}
                </span>
              </div>
            ))}
          </div>
          {metricsWithValues.length > 12 && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              E mais {metricsWithValues.length - 12} métricas...
            </div>
          )}
          <div className="border-t border-border mt-3 pt-3">
            <div className="flex justify-between items-center text-sm font-medium">
              <span>Total:</span>
              <span>{valueType === 'cost' ? formatCurrency(total) : formatIPU(total)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleBarClick = useCallback((data: any) => {
    if (!data || !data.activePayload) return;
    
    const period = data.activeLabel;
    const metrics = filteredDataKeys.map((key, index) => ({
      name: key,
      value: data.activePayload.find((p: any) => p.dataKey === key)?.value || 0,
      color: colors[index % colors.length]
    })).filter(m => m.value > 0).sort((a, b) => b.value - a.value);
    
    setSelectedCycleData({ period, metrics });
    setModalOpen(true);
  }, [filteredDataKeys]);

  return (
    <Card className="bg-gradient-card shadow-medium" id="consolidated-chart-container">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-heading font-bold">
              Análise Consolidada por Métrica
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-1">
              IPUs por métrica ao longo dos últimos ciclos (3 Ciclos)
            </div>
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
            <span className="text-sm font-medium">Filtros:</span>
          </div>
          
          <Select value={selectedOrgLocal} onValueChange={setSelectedOrgLocal}>
            <SelectTrigger className="w-auto min-w-[180px] max-w-[200px]">
              <SelectValue placeholder="Organização" />
            </SelectTrigger>
            <SelectContent>
              {availableOrgs.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-auto min-w-[160px] max-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STARTER_CYCLE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-auto min-w-[160px] max-w-[200px]">
              <SelectValue placeholder="Métricas" />
            </SelectTrigger>
            <SelectContent>
              {metricOptions.map(option => (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

        </div>

        {/* Active Filters */}
        { selectedMetric !== 'all' && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              Métrica: {metricOptions.find(m => m.value === selectedMetric)?.label || selectedMetric}
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div id="consolidated-chart" className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartDataWithDisplayTotal} 
                margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
                onClick={handleBarClick}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="period" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  angle={-35}
                  textAnchor="end"
                  height={50}
                />
                 <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => 
                    valueType === 'cost' ? formatCurrency(value) : formatIPU(value)
                  }
                  domain={yAxisDomain()}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Show contracted value reference line in default view */}
                {selectedOrgLocal === "all" && selectedMetric === "all" && contractedValue > 0 && (
                  <ReferenceLine 
                    y={contractedValue} 
                    stroke="hsl(var(--destructive))" 
                    strokeDasharray="5 5" 
                    strokeWidth={2}
                    label={{ 
                      value: `${valueType === 'cost' ? 'Valor Contratado' : 'IPUs Contratadas'}: ${valueType === 'cost' ? formatCurrency(contractedValue) : formatIPU(contractedValue)}`, 
                      position: "insideTopRight",
                      fill: "hsl(var(--destructive))",
                      fontSize: 12,
                      fontWeight: 500
                    }}
                  />
                )}

                {filteredDataKeys.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="costs"
                    fill={colors[index % colors.length]}
                    radius={[4, 4, 0, 0]}                    
                    name={key}
                    style={{ cursor: 'pointer' }}
                  >
                    {index === filteredDataKeys.length - 1 && (
                        <LabelList dataKey="displayTotal" content={renderCustomizedLabel} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

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
                          {selectedCycleData.metrics.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Métricas</div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-card shadow-medium">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-primary mb-2">
                          {valueType === 'cost' 
                            ? formatCurrency(selectedCycleData.metrics.reduce((sum, m) => sum + m.value, 0))
                            : formatIPU(selectedCycleData.metrics.reduce((sum, m) => sum + m.value, 0))
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {valueType === 'cost' ? 'Custo Total' : 'IPUs Totais'}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-card shadow-medium">
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-primary mb-2">
                          {valueType === 'cost' 
                            ? formatCurrency(selectedCycleData.metrics.reduce((sum, m) => sum + m.value, 0) / selectedCycleData.metrics.length)
                            : formatIPU(selectedCycleData.metrics.reduce((sum, m) => sum + m.value, 0) / selectedCycleData.metrics.length)
                          }
                        </div>
                        <div className="text-sm text-muted-foreground">Média por Métrica</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid gap-4">
                    <h3 className="font-semibold text-lg mb-2">Métricas do Ciclo</h3>
                    <div className="grid gap-3">
                      {selectedCycleData.metrics.map((metric, index) => (
                        <div key={index} className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              <div
                                className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm"
                                style={{ backgroundColor: metric.color }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground truncate">
                                  {metric.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {((metric.value / selectedCycleData.metrics.reduce((sum, m) => sum + m.value, 0)) * 100).toFixed(1)}% do total
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-semibold text-lg">
                                {valueType === 'cost' ? formatCurrency(metric.value) : formatIPU(metric.value)} IPUs
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