import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ProjectData {
  project_name: string;
  total_ipu: number;
  total_cost: number;
  asset_count: number;
  folder_count: number;
  org_id: string;
  latest_date: string;
}

interface ProjectDetailProps {
  selectedOrg?: string;
  selectedCycleFilter?: string;
}

export function ProjectDetail({ selectedOrg, selectedCycleFilter }: ProjectDetailProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user) {
      fetchProjectData();
    }
  }, [user, selectedOrg]);

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(project =>
        project.project_name?.toLowerCase().includes(search.toLowerCase()) ||
        project.org_id?.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredProjects(filtered);
    }
  }, [search, projects]);

  const fetchProjectData = async () => {
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
        .select('project_name, consumption_ipu, consumption_date, org_id, folder_name')
        .in('configuracao_id', configs.map(c => c.id))
        .not('consumption_ipu', 'is', null)
        .not('project_name', 'is', null);

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
          console.error("Supabase fetch error in ProjectDetail:", error);
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

      // Aggregate data by project
      const projectMap = new Map<string, ProjectData>();
      
      data?.forEach(item => {
        const key = `${item.project_name}-${item.org_id}`;
        if (!projectMap.has(key)) {
          projectMap.set(key, {
            project_name: item.project_name!,
            total_ipu: 0,
            total_cost: 0,
            asset_count: 0,
            folder_count: 0,
            org_id: item.org_id!,
            latest_date: item.consumption_date!
          });
        }

        const project = projectMap.get(key)!;
        project.total_ipu += item.consumption_ipu || 0;
        project.total_cost += (item.consumption_ipu || 0) * Number(clientPricing.preco_por_ipu);
        project.asset_count += 1;

        // Count unique folders
        const folders = new Set();
        if (item.folder_name) folders.add(item.folder_name);
        project.folder_count = Math.max(project.folder_count, folders.size || 1);

        // Update latest date
        if (item.consumption_date && item.consumption_date > project.latest_date) {
          project.latest_date = item.consumption_date;
        }
      });

      const projectsArray = Array.from(projectMap.values())
        .sort((a, b) => b.total_cost - a.total_cost);

      setProjects(projectsArray);
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
      ['Projeto', 'IPU Total', 'Custo Total', 'Qtd Assets', 'Organização', 'Última Atualização'].join(','),
      ...filteredProjects.map(project => [
        project.project_name,
        formatIPU(project.total_ipu),
        formatCurrency(project.total_cost),
        project.asset_count,
        project.org_id,
        project.latest_date ? new Date(project.latest_date).toLocaleDateString('pt-BR') : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detalhamento_projetos_${new Date().toISOString().split('T')[0]}.csv`;
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
              placeholder="Buscar por projeto ou organização..."
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
                    <TableHead>Projeto</TableHead>
                    <TableHead>IPU Total</TableHead>
                    <TableHead>Custo Total</TableHead>
                    <TableHead>Qtd Assets</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead>Última Atualização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {search ? 'Nenhum projeto encontrado com os critérios de busca' : 'Nenhum projeto encontrado'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProjects.map((project, index) => (
                      <TableRow key={`${project.project_name}-${project.org_id}-${index}`}>
                        <TableCell className="font-medium">
                          {project.project_name}
                        </TableCell>
                        <TableCell>{formatIPU(project.total_ipu)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(project.total_cost)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{project.asset_count}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{project.org_id}</Badge>
                        </TableCell>
                        <TableCell>
                          {project.latest_date ? new Date(project.latest_date).toLocaleDateString('pt-BR') : 'N/A'}
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