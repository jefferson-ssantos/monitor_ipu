import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Download, FileText, Filter, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { CYCLE_FILTER_OPTIONS } from '@/lib/cycleFilterOptions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AssetData {
  id: number | string;
  asset_name: string | null;
  asset_type: string | null;
  consumption_ipu: number | null;
  cost: number;
  consumption_date: string | null;
  project_name: string | null;
  folder_name: string | null;
  meter_id: string | null;
  meter_name: string | null;
  tier: string | null;
  runtime_environment: string | null;
  org_id: string | null;
  org_name: string | null;
  trend?: 'up' | 'down' | 'stable';
  trendPercentage?: number;
}

interface AssetDetailProps {
  selectedOrg?: string;
  selectedCycleFilter?: string;
  availableOrgs?: Array<{value: string, label: string}>;
  onOrgChange?: (value: string) => void;
  onCycleChange?: (value: string) => void;
}

export function AssetDetail({ selectedOrg, selectedCycleFilter, availableOrgs = [], onOrgChange, onCycleChange }: AssetDetailProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof AssetData; direction: 'ascending' | 'descending' } | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    if (user) {
      fetchAssetData();
    }
  }, [user, selectedOrg, selectedCycleFilter]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const uniqueFilterValues = useMemo(() => {
    const getUnique = (key: keyof AssetData, formatter?: (val: any) => string) => {
      const values = assets.map(a => {
        const val = a[key];
        return val ? (formatter ? formatter(val) : String(val)) : null;
      });
      return [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    };

    const assetDisplayNames = [...new Set(assets.map(a => a.asset_name || a.meter_name).filter(Boolean) as string[])].sort();

    return {
      display_asset_name: assetDisplayNames,
      project_name: getUnique('project_name'),
      org_name: getUnique('org_name'),
      consumption_date: getUnique('consumption_date', (val) => new Date(val).toLocaleDateString('pt-BR')),
    };
  }, [assets]);

  const finalAssets = useMemo(() => {
    let tempAssets = [...assets];

    // Aplicar busca global
    if (search.trim() !== '') {
      const lowercasedSearch = search.toLowerCase();
      tempAssets = tempAssets.filter(asset =>
        (asset.asset_name || asset.meter_name)?.toLowerCase().includes(lowercasedSearch) ||
        asset.project_name?.toLowerCase().includes(lowercasedSearch)
      );
    }

    // Aplicar filtros de coluna
    Object.entries(activeFilters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        tempAssets = tempAssets.filter(asset => {
          let assetValue: string | null = null;
          if (key === 'display_asset_name') {
            assetValue = asset.asset_name || asset.meter_name;
          } else if (key === 'consumption_date' && asset.consumption_date) {
            assetValue = new Date(asset.consumption_date).toLocaleDateString('pt-BR');
          } else {
            assetValue = asset[key as keyof AssetData] as string | null;
          }
          return assetValue ? values.includes(assetValue) : false;
        });
      }
    });

    // Aplicar ordenação
    if (sortConfig !== null) {
      tempAssets.sort((a, b) => {
        const key = sortConfig.key;
        let aVal: any = a[key];
        let bVal: any = b[key];

        // Lógica especial para colunas compostas ou que precisam de tratamento
        if (key === 'asset_name') {
          aVal = a.asset_name || a.meter_name;
          bVal = b.asset_name || b.meter_name;
        } else if (key === 'trendPercentage') {
          aVal = a.trendPercentage ?? -1;
          bVal = b.trendPercentage ?? -1;
        }

        const dir = sortConfig.direction === 'ascending' ? 1 : -1;

        if (aVal === null || aVal === undefined) return 1 * dir;
        if (bVal === null || bVal === undefined) return -1 * dir;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * dir;
        }

        if (key === 'consumption_date') {
          const dateA = new Date(aVal as string).getTime();
          const dateB = new Date(bVal as string).getTime();
          return (dateA - dateB) * dir;
        }

        return String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true }) * dir;
      });
    }

    return tempAssets;
  }, [assets, search, activeFilters, sortConfig]);

  useEffect(() => {
    // Resetar para a primeira página sempre que os filtros mudarem
    setCurrentPage(1);
  }, [search, activeFilters, rowsPerPage]);

  const calculateTrend = (asset: any, previousRecords: any[]): { trend: 'up' | 'down' | 'stable'; percentage: number } => {
    // Helper to safely convert values to number
    const toNumber = (v: any): number => {
      if (v === null || v === undefined) return 0;
      const n = typeof v === 'number' ? v : Number(v);
      return isNaN(n) ? 0 : n;
    };
    if (previousRecords.length === 0) {
      return { trend: 'stable', percentage: 0 };
    }

    const currentConsumption = toNumber(asset.consumption_ipu);
    const previousConsumptions = previousRecords.map((record) =>
      toNumber(record.consumption_ipu)
    );

    // Per user request: compare the current value with the average of the last 6 values (current + 5 previous).
    // "a soma dos valores das 6 linhas, dividido por 6, e comparado com a linha atual"
    const allConsumptions = [currentConsumption, ...previousConsumptions];
    const sumOfConsumptions = allConsumptions.reduce((sum, value) => sum + value, 0);
    const avgConsumption =
      sumOfConsumptions / allConsumptions.length;
    
    if (avgConsumption === 0) {
      if (currentConsumption === 0) return { trend: 'stable', percentage: 0 };
      // If average is 0 and current is not, it's a significant increase.
      return { trend: 'up', percentage: 100 };
    }

    const percentageChange =
      ((currentConsumption - avgConsumption) / avgConsumption) * 100;

    if (Math.abs(percentageChange) < 1e-6) {
      return { trend: 'stable', percentage: 0 };
    } else if (percentageChange > 0) {
      return { trend: 'up', percentage: Math.abs(percentageChange) };
    } else {
      return { trend: 'down', percentage: Math.abs(percentageChange) };
    }
  };

  const fetchAssetData = async () => {
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
        .select('id,apelido_configuracao')
        .eq('cliente_id', profile.cliente_id);

      if (!configs?.length) return;

      // First get organization names from summary table
      const { data: orgNames } = await supabase
        .from('api_consumosummary')
        .select('org_id, org_name')
        .in('configuracao_id', configs.map(c => c.id))
        .not('org_id', 'is', null)
        .not('org_name', 'is', null);

      // Create a map of org_id to org_name
      const orgNameMap = new Map();
      orgNames?.forEach(org => {
        if (org.org_id && org.org_name) {
          orgNameMap.set(org.org_id, org.org_name);
        }
      });

      let query = supabase
        .from('api_consumoasset')
        .select('*')
        .in('configuracao_id', configs.map(c => c.id))
        .not('consumption_ipu', 'is', null)
        .order('consumption_date',{ ascending: false })
        .order('consumption_ipu',{ ascending: false });

      if (selectedOrg) {
        query = query.eq('org_id', selectedOrg);
      }

      if (selectedCycleFilter) {
        const today = new Date();
        const monthsToSubtract = parseInt(selectedCycleFilter, 10);
        // Volta N meses a partir de hoje
        const startDate = new Date(today.getFullYear(), today.getMonth() - monthsToSubtract, today.getDate());
        const formattedStartDate = startDate.toISOString().split('T')[0];
        query = query.gte('consumption_date', formattedStartDate);
      }

      // Paginate to fetch all records, bypassing Supabase's 1000-row limit
      const BATCH_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while(hasMore) {
        const { data: batch, error } = await query.range(from, from + BATCH_SIZE - 1);

        if (error) {
          console.error("Supabase fetch error in AssetDetail:", error);
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

      // Agrupar os dados conforme solicitado
      const groupedAssets = new Map<string, AssetData>();
      data?.forEach(asset => {
        const assetKeyName = asset.asset_name ?? asset.meter_name;
        // Chave de agrupamento: Asset, Projeto, Organização e Data
        const key = `${assetKeyName}|${asset.project_name}|${asset.org_id}|${asset.consumption_date}`;

        const existing = groupedAssets.get(key);
        const assetCost = (asset.consumption_ipu || 0) * Number(clientPricing.preco_por_ipu);

        if (existing) {
          // Se o grupo já existe, somar os valores
          existing.consumption_ipu = (existing.consumption_ipu || 0) + (asset.consumption_ipu || 0);
          existing.cost += assetCost;
        } else {
          // Se não existe, criar um novo grupo
          groupedAssets.set(key, {
            ...asset,
            id: key, // Usar a chave única como ID
            cost: assetCost,
            org_name: orgNameMap.get(asset.org_id) || null,
          });
        }
      });

      // Converter o mapa para um array e ordenar
      const aggregatedData = Array.from(groupedAssets.values()).sort((a, b) => {
        if (a.consumption_date === b.consumption_date) {
          return (b.consumption_ipu || 0) - (a.consumption_ipu || 0);
        }
        return new Date(b.consumption_date!).getTime() - new Date(a.consumption_date!).getTime();
      });

      // Otimização: Pré-agrupar dados históricos para evitar N^2 no cálculo de tendência.
      const assetHistoryMap = new Map<string, AssetData[]>();
      aggregatedData.forEach(asset => {
        const assetKeyName = asset.asset_name ?? asset.meter_name;
        const historyKey = `${asset.meter_id}|${assetKeyName}|${asset.org_id}`;
        if (!assetHistoryMap.has(historyKey)) {
          assetHistoryMap.set(historyKey, []);
        }
        assetHistoryMap.get(historyKey)!.push(asset);
      });

      const processedData = aggregatedData.map(asset => {
        const assetKeyName = asset.asset_name ?? asset.meter_name;
        const historyKey = `${asset.meter_id}|${assetKeyName}|${asset.org_id}`;
        const history = assetHistoryMap.get(historyKey) || [];
        const currentIndex = history.findIndex(h => h.id === asset.id);
        const previousRecords = history.slice(currentIndex + 1, currentIndex + 1 + 5);

        const { trend, percentage } = calculateTrend(asset, previousRecords);
        return {
          ...asset,
          trend,
          trendPercentage: percentage
        };
      });
      setAssets(processedData);
    } catch (error) {
      console.error("Erro ao buscar dados dos assets:", error);
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      console.error("Falha ao carregar detalhes dos assets:", errorMessage);
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

  const getTrendBadge = (trend: 'up' | 'down' | 'stable', percentage: number) => {
    const formattedPercentage = percentage.toFixed(1);
    
    switch (trend) {
      case 'up':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            ↗ +{formattedPercentage}%
          </Badge>
        );
      case 'down':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            ↘ -{formattedPercentage}%
          </Badge>
        );
      case 'stable':
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            → ±{formattedPercentage}%
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">N/A</Badge>
        );
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Asset', 'IPU', 'Custo', 'Data', 'Projeto', 'Ambiente', 'Organização', 'Tendência'].join(','),
      ...finalAssets.map(asset => [
        asset.asset_name || asset.meter_name || '',
        formatIPU(asset.consumption_ipu || 0),
        formatCurrency(asset.cost),
        asset.consumption_date || '',
        asset.project_name || '',
        asset.runtime_environment || '',
        asset.org_name || asset.org_id || '',
        asset.trend ? `${asset.trend === 'up' ? '+' : asset.trend === 'down' ? '-' : '±'}${asset.trendPercentage?.toFixed(1)}%` : 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detalhamento_assets_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePageInputSubmit = () => {
    const page = parseInt(pageInput, 10);
    const total = totalPages > 0 ? totalPages : 1;
    if (!isNaN(page) && page >= 1 && page <= total) {
        setCurrentPage(page);
    } else {
        // Reverte para a página atual se o valor for inválido
        setPageInput(String(currentPage));
    }
  };

  const totalPages = Math.ceil(finalAssets.length / rowsPerPage);
  const paginatedAssets = finalAssets.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Componente de Cabeçalho com Filtro e Ordenação
  const SortableFilterHeader = ({
    title,
    sortKey,
    filterKey,
    filterOptions,
  }: {
    title: React.ReactNode;
    sortKey: keyof AssetData;
    filterKey?: string;
    filterOptions?: string[];
  }) => {
    const isFilterable = !!(filterOptions && filterOptions.length > 0);
    const effectiveFilterKey = filterKey || String(sortKey);
    const currentFilter = activeFilters[effectiveFilterKey] || [];

    const [popoverOpen, setPopoverOpen] = useState(false);
    const [localSelected, setLocalSelected] = useState<string[]>(currentFilter);

    useEffect(() => {
      setLocalSelected(activeFilters[effectiveFilterKey] || []);
    }, [activeFilters, effectiveFilterKey]);

    const handleSort = () => {
      let direction: 'ascending' | 'descending' = 'ascending';
      if (sortConfig?.key === sortKey && sortConfig.direction === 'ascending') {
        direction = 'descending';
      }
      setSortConfig({ key: sortKey, direction });
    };

    const applyFilter = () => {
      setActiveFilters(prev => ({ ...prev, [effectiveFilterKey]: localSelected }));
      setPopoverOpen(false);
    };

    const clearFilter = () => {
      setLocalSelected([]);
      const newFilters = { ...activeFilters };
      delete newFilters[effectiveFilterKey];
      setActiveFilters(newFilters);
      setPopoverOpen(false);
    };

    return (
      <TableHead className="group">
        <div className="flex items-center justify-between gap-1">
          <div onClick={handleSort} className="flex-1 cursor-pointer flex items-center gap-1 hover:text-foreground py-2">
            {title}
            {sortConfig?.key === sortKey && (
              sortConfig.direction === 'ascending' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </div>
          {isFilterable && (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${currentFilter.length > 0 ? 'opacity-100' : ''}`}>
                  <Filter className={`h-3 w-3 ${currentFilter.length > 0 ? 'text-primary' : ''}`} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                  <div className="flex items-center space-x-2 p-1">
                    <Checkbox id={`select-all-${effectiveFilterKey}`} checked={localSelected.length === filterOptions.length} onCheckedChange={(checked) => setLocalSelected(checked ? filterOptions : [])} />
                    <label htmlFor={`select-all-${effectiveFilterKey}`} className="text-sm font-medium">Selecionar Tudo</label>
                  </div>
                  {filterOptions.map(option => (
                    <div key={option} className="flex items-center space-x-2 p-1">
                      <Checkbox id={`${effectiveFilterKey}-${option}`} checked={localSelected.includes(option)} onCheckedChange={(checked) => setLocalSelected(prev => checked ? [...prev, option] : prev.filter(item => item !== option))} />
                      <label htmlFor={`${effectiveFilterKey}-${option}`} className="text-sm">{option}</label>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 p-2 border-t">
                  <Button variant="outline" size="sm" onClick={clearFilter}>Limpar</Button>
                  <Button size="sm" onClick={applyFilter}>Aplicar</Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </TableHead>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Análise detalhada do consumo por asset</CardTitle>
          {availableOrgs.length > 0 && onOrgChange && onCycleChange && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>
              
              <Select value={selectedCycleFilter || "1"} onValueChange={onCycleChange}>
                <SelectTrigger className="w-auto min-w-48">
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

              <Select value={selectedOrg ? selectedOrg : "all"} onValueChange={onOrgChange}>
                <SelectTrigger className="w-auto min-w-44 max-w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableOrgs.map(org => (
                    <SelectItem key={org.value} value={org.value}>
                      {org.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        <div className="flex gap-4 items-center justify-between">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 cursor-pointer"
              onClick={() => setSearch(inputValue)}
              aria-label="Buscar"
            />
            <Input
              placeholder="Buscar por asset ou projeto..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearch(inputValue);
                }
              }}
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
                    <SortableFilterHeader title="Asset" sortKey="asset_name" filterKey="display_asset_name" filterOptions={uniqueFilterValues.display_asset_name} />
                    <SortableFilterHeader title="Projeto" sortKey="project_name" filterOptions={uniqueFilterValues.project_name} />
                    <SortableFilterHeader title="Organização" sortKey="org_name" filterOptions={uniqueFilterValues.org_name} />
                    <SortableFilterHeader title="Data" sortKey="consumption_date" filterOptions={uniqueFilterValues.consumption_date} />
                    <SortableFilterHeader title="IPU" sortKey="consumption_ipu" />
                    <SortableFilterHeader title="Custo" sortKey="cost" />
                    <SortableFilterHeader
                      title={
                        <div className="flex items-center gap-1">
                          Tendência
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs text-sm">A tendência é calculada comparando o consumo de IPU do dia atual com a média de consumo dos últimos dias (até 6 dias) para o mesmo asset.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      }
                      sortKey="trendPercentage"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {search ? 'Nenhum asset encontrado com os critérios de busca' : 'Nenhum asset encontrado'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">
                          {asset.asset_name || asset.meter_name || 'N/A'}
                        </TableCell>
                        <TableCell>{asset.project_name || 'N/A'}</TableCell>
                        <TableCell className="font-medium">{asset.org_name || asset.org_id || 'N/A'}</TableCell>
                        <TableCell>
                          {asset.consumption_date ? new Date(asset.consumption_date).toLocaleDateString('pt-BR') : 'N/A'}
                        </TableCell>
                        <TableCell>{formatIPU(asset.consumption_ipu || 0)}</TableCell>
                        <TableCell>
                          {formatCurrency(asset.cost) && (
                            <Badge variant="secondary">{formatCurrency(asset.cost)}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {asset.trend && asset.trendPercentage !== undefined 
                            ? getTrendBadge(asset.trend, asset.trendPercentage)
                            : <Badge variant="outline">N/A</Badge>
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                    {finalAssets.length > 0 ? 
                        `Mostrando ${Math.min((currentPage - 1) * rowsPerPage + 1, finalAssets.length)} a ${Math.min(currentPage * rowsPerPage, finalAssets.length)} de ${finalAssets.length} registros.`
                        : 'Nenhum registro encontrado.'
                    }
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">Linhas por página:</span>
                        <Select value={String(rowsPerPage)} onValueChange={(value) => { setRowsPerPage(Number(value)); setCurrentPage(1); }}>
                            <SelectTrigger className="w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[25, 50, 100].map(size => (
                                    <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span>Página</span>
                        <Input
                            type="text"
                            className="w-16 h-8 text-center"
                            value={pageInput}
                            onChange={(e) => setPageInput(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter') {
                                    handlePageInputSubmit();
                                    e.currentTarget.blur();
                                }
                            }}
                            onBlur={handlePageInputSubmit}
                            aria-label="Ir para a página"
                        />
                        <span className="text-muted-foreground">
                            de {totalPages > 0 ? totalPages : 1}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}