import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Play, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface JobExecutionData {
  id: number;
  task_name: string | null;
  task_type: string | null;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  metered_value_ipu: number | null;
  cost: number;
  environment_name: string | null;
  project_name: string | null;
  org_id: string | null;
  obm_task_time_seconds: number | null;
}

interface JobExecutionDetailProps {
  selectedOrg?: string;
  selectedCycleFilter?: string;
}

export function JobExecutionDetail({ selectedOrg, selectedCycleFilter }: JobExecutionDetailProps) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobExecutionData[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobExecutionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user) {
      fetchJobData();
    }
  }, [user, selectedOrg]);

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredJobs(jobs);
    } else {
      const filtered = jobs.filter(job =>
        job.task_name?.toLowerCase().includes(search.toLowerCase()) ||
        job.task_type?.toLowerCase().includes(search.toLowerCase()) ||
        job.project_name?.toLowerCase().includes(search.toLowerCase()) ||
        job.status?.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredJobs(filtered);
    }
  }, [search, jobs]);

  const fetchJobData = async () => {
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
        .from('api_consumocdijobexecucao')
        .select('*')
        .in('configuracao_id', configs.map(c => c.id))
        .order('start_time', { ascending: false });

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
          console.error("Supabase fetch error in JobExecutionDetail:", error);
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

      const processedData = data?.map(job => ({
        ...job,
        cost: (job.metered_value_ipu || 0) * Number(clientPricing.preco_por_ipu)
      })) || [];

      setJobs(processedData);
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

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-secondary" />;
    }
  };

  const getStatusVariant = (status: string | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'default';
      case 'failed':
      case 'error':
        return 'destructive';
      case 'running':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Task', 'Tipo', 'Status', 'IPU', 'Custo', 'Duração', 'Início', 'Fim', 'Projeto', 'Ambiente'].join(','),
      ...filteredJobs.map(job => [
        job.task_name || '',
        job.task_type || '',
        job.status || '',
        formatIPU(job.metered_value_ipu || 0),
        formatCurrency(job.cost),
        formatDuration(job.obm_task_time_seconds),
        job.start_time ? new Date(job.start_time).toLocaleString('pt-BR') : '',
        job.end_time ? new Date(job.end_time).toLocaleString('pt-BR') : '',
        job.project_name || '',
        job.environment_name || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execucao_jobs_${new Date().toISOString().split('T')[0]}.csv`;
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
              placeholder="Buscar por task, tipo, projeto ou status..."
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
                    <TableHead>Task</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IPU</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Projeto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {search ? 'Nenhuma execução encontrada com os critérios de busca' : 'Nenhuma execução de job encontrada'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">
                          {job.task_name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{job.task_type || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            <Badge variant={getStatusVariant(job.status)}>
                              {job.status || 'N/A'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{formatIPU(job.metered_value_ipu || 0)}</TableCell>
                        <TableCell>{formatCurrency(job.cost)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatDuration(job.obm_task_time_seconds)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.start_time ? new Date(job.start_time).toLocaleString('pt-BR') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {job.project_name && (
                            <Badge variant="secondary">{job.project_name}</Badge>
                          )}
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