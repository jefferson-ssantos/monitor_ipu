import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { useDashboardData } from "@/hooks/useDashboardData";
import { CYCLE_FILTER_OPTIONS } from "@/lib/cycleFilterOptions";

interface ConsolidatedChartStarterProps {
  selectedOrg?: string;
  availableOrgs: Array<{value: string, label: string}>;
}

interface ChartDataItem {
  period: string;
  totalCost: number;
}

export function ConsolidatedChartStarter({ selectedOrg, availableOrgs }: ConsolidatedChartStarterProps) {
  const [selectedOrgLocal, setSelectedOrgLocal] = useState<string>(selectedOrg || "all");
  const [period, setPeriod] = useState("12");
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { getChartData: getDashboardChartData, availableCycles } = useDashboardData(selectedOrgLocal === "all" ? undefined : selectedOrgLocal);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getDashboardChartData('billing-periods', selectedOrgLocal, period);
        if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
          // Convert detailed data to consolidated format
          const consolidatedData = result.data.map((item: any) => {
            const allMeters = result.meters || [];
            const totalCost = allMeters.reduce((sum: number, meter: string) => {
              return sum + (item[meter] || 0);
            }, 0);
            
            return {
              period: item.period,
              totalCost: totalCost
            };
          });
          
          setChartData(consolidatedData);
        } else if (result && Array.isArray(result)) {
          // Handle array result - convert to consolidated format
          const consolidatedData = result.map((item: any) => ({
            period: item.period || 'N/A',
            totalCost: item.totalCost || 0
          }));
          setChartData(consolidatedData);
        } else {
          setChartData([]);
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
  }, [selectedOrgLocal, period, getDashboardChartData]);

  useEffect(() => {
    setSelectedOrgLocal(selectedOrg || "all");
  }, [selectedOrg]);

  const yAxisDomain = () => {
    if (chartData.length === 0) return [0, 1000];

    const maxVal = Math.max(...chartData.map(d => d.totalCost));
    return [0, maxVal * 1.1];
  };

  const renderCustomizedLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value > 0) {
      return (
        <text x={x + width / 2} y={y} fill="#3a3a3a" textAnchor="middle" dy={-6} fontSize={12} fontWeight="bold">
          {formatCurrency(value)}
        </text>
      );
    }
    return null;
  };

  const handleDownload = async () => {
    try {
      const chartElement = document.getElementById('consolidated-chart-starter-container');
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
      link.download = `analise-custos-starter-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();

      toast.success('Gráfico exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar o gráfico');
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: 'hsl(24 70% 60%)' }}
            />
            <span className="text-muted-foreground">Custo Total:</span>
            <span className="font-medium text-foreground">
              {formatCurrency(payload[0].value)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-gradient-card shadow-medium" id="consolidated-chart-starter-container">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-heading font-bold">
              Análise Consolidada de Custos
            </CardTitle>
            <div className="text-sm text-muted-foreground mt-1">
              Custos totais consolidados ao longo dos ciclos(3 ciclos)
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

        {/* Simplified Filters */}
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
              {CYCLE_FILTER_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <div id="consolidated-chart-starter" className="h-[400px]">
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
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 55 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="period" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  angle={-35}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={formatCurrency}
                  domain={yAxisDomain()}
                />
                <Tooltip content={<CustomTooltip />} />
                
                <Bar
                  dataKey="totalCost"
                  fill="hsl(24 70% 60%)"
                  name="Custo Total"
                >
                  <LabelList dataKey="totalCost" content={renderCustomizedLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}