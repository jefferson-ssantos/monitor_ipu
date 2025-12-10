import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface OrganizationData {
  org_id: string;
  org_name?: string;
  total_ipu: number;
  total_cost: number;
  project_count: number;
  asset_count: number;
  latest_date: string;
  percentage: number;
}

interface OrganizationDetailProps {
  selectedOrg?: string;
  selectedCycleFilter?: string;
}

export function OrganizationDetail({ selectedOrg, selectedCycleFilter }: OrganizationDetailProps) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationData[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<OrganizationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user) {
      fetchOrganizationData();
    }
  }, [user, selectedOrg]);

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredOrganizations(organizations);
    } else {
      const filtered = organizations.filter(org =>
        org.org_id?.toLowerCase().includes(search.toLowerCase()) ||
        org.org_name?.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredOrganizations(filtered);
    }
  }, [search, organizations]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from('profiles')
        .select('cliente_id')
        .eq('id', user?.id)
        .single();

      if (!profile?.cliente_id) return;

      const { data: clientPricing } = await supabase
        .from('api_clientes')
        .select('preco_por_ipu')
        .eq('id', profile.cliente_id)
        .single();

      if (!clientPricing?.preco_por_ipu) return;

      const { data: configs } = await supabase
        .from('api_configuracaoidmc')
        .select('id')
        .eq('cliente_id', profile.cliente_id);

      if (!configs?.length) return;

      let query = supabase
        .from('api_consumoasset')
        .select('org_id, consumption_ipu, consumption_date, project_name, asset_name')
        .in('configuracao_id', configs.map(c => c.id))
        .not('consumption_ipu', 'is', null)
        .not('org_id', 'is', null);

      if (selectedOrg) {
        query = query.eq('org_id', selectedOrg);
      }

      // Paginate to fetch all records, bypassing Supabase's 1000-row limit
      const BATCH_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while(hasMore) {
        const { data: batch, error } = await query.range(from, from + BATCH_SIZE - 1);

        if (error) {
          console.error("Supabase fetch error in OrganizationDetail:", error);
          throw error;
        }

        if (batch && batch.length > 0) {
          allData = allData.concat(batch);
          from += BATCH_SIZE;
          hasMore = batch.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }
      const data = allData;

      // Aggregate data by organization
      const orgMap = new Map<string, OrganizationData>();
      let totalCost = 0;
      
      data?.forEach(item => {
        if (!orgMap.has(item.org_id!)) {
          orgMap.set(item.org_id!, {
            org_id: item.org_id!,
            total_ipu: 0,
            total_cost: 0,
            project_count: 0,
            asset_count: 0,
            latest_date: item.consumption_date!,
            percentage: 0
          });
        }

        const org = orgMap.get(item.org_id!)!;
        const cost = (item.consumption_ipu || 0) * Number(clientPricing.preco_por_ipu);
        
        org.total_ipu += item.consumption_ipu || 0;
        org.total_cost += cost;
        org.asset_count += 1;
        totalCost += cost;

        // Count unique projects
        const projects = new Set();
        if (item.project_name) projects.add(item.project_name);
        org.project_count = Math.max(org.project_count, projects.size || 1);

        // Update latest date
        if (item.consumption_date && item.consumption_date > org.latest_date) {
          org.latest_date = item.consumption_date;
        }
      });

      // Calculate percentages and sort
      const orgsArray = Array.from(orgMap.values()).map(org => ({
        ...org,
        percentage: totalCost > 0 ? (org.total_cost / totalCost) * 100 : 0
      })).sort((a, b) => b.total_cost - a.total_cost);

      setOrganizations(orgsArray);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatIPU = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString('pt-BR');
  };

  const exportData = () => {
    const csvContent = [
      ['Organização', 'IPU Total', 'Custo Total', 'Percentual', 'Qtd Projetos', 'Qtd Assets', 'Última Atualização'].join(','),
      ...filteredOrganizations.map(org => [
        org.org_name || org.org_id,
        formatIPU(org.total_ipu),
        formatCurrency(org.total_cost),
        `${org.percentage.toFixed(1)}%`,
        org.project_count,
        org.asset_count,
        org.latest_date ? new Date(org.latest_date).toLocaleDateString('pt-BR') : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detalhamento_organizacoes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex gap-4 items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por organização..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={exportData} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>          
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="text-muted-foreground">Carregando dados...</div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Organização</TableHead>
                    <TableHead>IPU Total</TableHead>
                    <TableHead>Custo Total</TableHead>
                    <TableHead>Percentual</TableHead>
                    <TableHead>Projetos</TableHead>
                    <TableHead>Assets</TableHead>
                    <TableHead>Última Atualização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {search ? 'Nenhuma organização encontrada com os critérios de busca' : 'Nenhuma organização encontrada'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrganizations.map((org) => (
                      <TableRow key={org.org_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {org.org_name || org.org_id}
                          </div>
                        </TableCell>
                        <TableCell>{formatIPU(org.total_ipu)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(org.total_cost)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(org.percentage, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{org.percentage.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{org.project_count}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{org.asset_count}</Badge>
                        </TableCell>
                        <TableCell>
                          {org.latest_date ? new Date(org.latest_date).toLocaleDateString('pt-BR') : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}