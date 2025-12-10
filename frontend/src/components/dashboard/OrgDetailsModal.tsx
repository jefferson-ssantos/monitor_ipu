import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface MetricDetail {
  meter_name: string;
  quantity: string;
  consumption_ipu: number;
  ipu_rate: number;
  scalar: string;
  total_usage: number;
  cost: number;
}

interface OrgDetailsModalProps {
  orgId: string;
  onClose: () => void;
  billingPeriod?: {
    billing_period_start_date: string;
    billing_period_end_date: string;
  } | null;
}

export function OrgDetailsModal({ orgId, onClose, billingPeriod }: OrgDetailsModalProps) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<MetricDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState<string>('');
  const [pricePerIPU, setPricePerIPU] = useState<number>(0);

  useEffect(() => {
    if (!user || !billingPeriod) return;

    const fetchMetricDetails = async () => {
      try {
        setLoading(true);

        // Get user's client information
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('cliente_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile?.cliente_id) throw new Error('Cliente não encontrado');

        // Get client's price per IPU
        const { data: client, error: clientError } = await supabase
          .from('api_clientes')
          .select('preco_por_ipu')
          .eq('id', profile.cliente_id)
          .maybeSingle();

        if (clientError) throw clientError;
        if (!client?.preco_por_ipu) throw new Error('Preço por IPU não encontrado');

        setPricePerIPU(client.preco_por_ipu);

        // Get configuration IDs
        const { data: configs, error: configError } = await supabase
          .from('api_configuracaoidmc')
          .select('id')
          .eq('cliente_id', profile.cliente_id);

        if (configError) throw configError;
        if (!configs || configs.length === 0) throw new Error('Nenhuma configuração encontrada');

        const configIds = configs.map(config => config.id);

        // Get detailed consumption data for the organization
        const { data: consumptionData, error: consumptionError } = await supabase
          .from('api_consumosummary')
          .select('*')
          .in('configuracao_id', configIds)
          .eq('org_id', orgId)
          .neq('meter_name', 'Sandbox Organizations IPU Usage')
          .eq('billing_period_start_date', billingPeriod.billing_period_start_date)
          .eq('billing_period_end_date', billingPeriod.billing_period_end_date);

        if (consumptionError) throw consumptionError;

        if (consumptionData && consumptionData.length > 0) {
          setOrgName(consumptionData[0].org_name || orgId);

          // Group by meter_name, scalar, metric_category, ipu_rate
          const groupedData = new Map<string, MetricDetail>();

          consumptionData.forEach(item => {
            const key = `${item.meter_name}_${item.scalar}_${item.metric_category}_${item.ipu_rate}`;
            
            if (groupedData.has(key)) {
              const existing = groupedData.get(key)!;
              const additionalIPU = item.consumption_ipu || 0;
              existing.consumption_ipu += additionalIPU;
              existing.total_usage += item.meter_usage || 0;
              existing.cost += additionalIPU * client.preco_por_ipu;
              existing.quantity = `${existing.total_usage.toFixed(2)} ${item.metric_category || ''}`;
            } else {
              const consumption = item.consumption_ipu || 0;
              groupedData.set(key, {
                meter_name: item.meter_name || 'N/A',
                quantity: `${(item.meter_usage || 0).toFixed(2)} ${item.metric_category || ''}`,
                consumption_ipu: consumption,
                ipu_rate: item.ipu_rate || 0,
                scalar: item.scalar || 'N/A',
                total_usage: item.meter_usage || 0,
                cost: consumption * client.preco_por_ipu
              });
            }
          });

          const metricsArray = Array.from(groupedData.values())
            .filter(metric => metric.consumption_ipu > 0)
            .sort((a, b) => b.consumption_ipu - a.consumption_ipu);

          setMetrics(metricsArray);
        }
      } catch (error) {
        console.error('Error fetching metric details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetricDetails();
  }, [user, orgId, billingPeriod]);

  const formatIPU = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1).replace('.', ',')}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const exportData = () => {
    if (metrics.length === 0) return;

    const csvContent = [
      ['Nome da Métrica', 'Quantidade', 'Consumo IPU', 'Taxa IPU', 'Escala', 'Valor'].join(','),
      ...metrics.map(metric => [
        metric.meter_name,
        metric.quantity,
        metric.consumption_ipu,
        metric.ipu_rate,
        metric.scalar,
        metric.cost
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `detalhes_metricas_${orgName.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalIPUs = metrics.reduce((sum, metric) => sum + metric.consumption_ipu, 0);
  const totalCost = metrics.reduce((sum, metric) => sum + metric.cost, 0);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-heading font-bold">
                Detalhamento de Métricas - {orgName}
              </DialogTitle>
              <DialogDescription>
                Detalhamento por métrica para o período de {billingPeriod?.billing_period_start_date} a {billingPeriod?.billing_period_end_date}
              </DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </DialogHeader>

        <Card className="flex-1 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Resumo por Métrica
                <Badge variant="secondary" className="ml-2">
                  {metrics.length} métricas
                </Badge>
              </CardTitle>
              <div className="text-right space-y-2">
                <div>
                  <div className="text-sm text-muted-foreground">Total IPUs Consumidas</div>
                  <div className="text-lg font-bold text-primary">
                    {formatIPU(totalIPUs)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Valor Total</div>
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(totalCost)}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="overflow-auto max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2">Carregando detalhes...</span>
              </div>
            ) : metrics.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma métrica encontrada para esta organização no período selecionado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da Métrica</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead className="text-right">Consumo IPU</TableHead>
                    <TableHead className="text-right">Taxa IPU</TableHead>
                    <TableHead>Escala</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((metric, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {metric.meter_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {metric.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatIPU(metric.consumption_ipu)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {metric.ipu_rate.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {metric.scalar}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(metric.cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}