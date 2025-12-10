import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const STABLE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))", 
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted))"
];

interface DashboardData {
  totalCost: number;
  totalIPU: number;
  avgDailyCost: number;
  historicalComparison: number;
  activeOrgs: number;
  contractedIPUs: number;
  pricePerIPU: number;
  historicalAvgDailyCost: number;
  currentPeriod: string;
  periodStart: string;
  periodEnd: string;
  organizations: Array<{ 
    org_id: string;
    org_name: string;
    consumption_ipu: number;
    cost: number;
    percentage: number;
    isPrincipal?: boolean;
    level?: number;
    parentOrgId?: string;
  }>;
  currentCycle: {
    billing_period_start_date: string;
    billing_period_end_date: string;
  } | null;
}

// Helper function to create hierarchical structure
const createHierarchicalStructure = (orgs: Array<any>) => {
  if (orgs.length <= 1) return orgs;

  // Sort organizations by consumption (highest first, so the main one becomes principal)
  const sortedOrgs = [...orgs].sort((a, b) => b.consumption_ipu - a.consumption_ipu);
  
  const [principalOrg, ...childOrgs] = sortedOrgs;
  
  // Mark principal organization
  const hierarchicalOrgs = [
    {
      ...principalOrg,
      isPrincipal: true,
      level: 0
    }
  ];

  // Add child organizations
  childOrgs.forEach(childOrg => {
    hierarchicalOrgs.push({
      ...childOrg,
      isPrincipal: false,
      level: 1,
      parentOrgId: principalOrg.org_id
    });
  });

  return hierarchicalOrgs;
};

export function useDashboardData(selectedOrg?: string, selectedCycleFilter?: string) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableCycles, setAvailableCycles] = useState<Array<{ 
    ciclo_id: number;
    billing_period_start_date: string;
    billing_period_end_date: string;
    configuracao_id: number;
  }>>([]);
  
  // Cache para evitar requisições desnecessárias
  const cacheRef = useRef<Map<string, any>>(new Map());
  const lastFetchRef = useRef<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  const fetchDashboardData = useCallback(async (force = false) => {
    if (!user) {
      return;
    }

    const cacheKey = `dashboard_${user.id}_${selectedOrg || 'all'}`;
    const now = Date.now();

    // Verificar cache se não for forçado
    if (!force && cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      if (now - cached.timestamp < CACHE_DURATION) {
        setData(cached.data);
        setLoading(false);
        return;
      }
    }

    // Evitar requisições muito frequentes
    if (!force && now - lastFetchRef.current < 1000) {
      return;
    }

    lastFetchRef.current = now;

    try {
      setLoading(true);
      setError(null);

      // Get user's client information
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('cliente_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.cliente_id) throw new Error('Cliente não encontrado');

      // Get client's price per IPU and contracted IPUs
      const { data: client, error: clientError } = await supabase
        .from('api_clientes')
        .select('preco_por_ipu, qtd_ipus_contratadas')
        .eq('id', profile.cliente_id)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!client?.preco_por_ipu) throw new Error('Informações de preço não encontradas para o cliente');

      // First get the configuration IDs for this client
      const { data: configs, error: configError } = await supabase
        .from('api_configuracaoidmc')
        .select('id')
        .eq('cliente_id', profile.cliente_id);

      if (configError) throw configError;
      if (!configs || configs.length === 0) throw new Error('Nenhuma configuração encontrada');

      const configIds = configs.map(config => config.id);

      // Get available billing cycles using optimized function
      const { data: cyclesData, error: cyclesError } = await supabase
        .rpc('get_available_cycles');

      if (cyclesError) throw cyclesError;
      
      // Create unique cycles map
      const cyclesMap = new Map();
      let cycleCounter = 1;
      const sortedCycles = cyclesData
        ?.sort((a, b) => new Date(b.billing_period_end_date).getTime() - new Date(a.billing_period_end_date).getTime()) || [];
      
      const uniqueCycles: Array<{ 
        ciclo_id: number;
        billing_period_start_date: string;
        billing_period_end_date: string;
        configuracao_id: number;
      }> = [];

      sortedCycles.forEach(item => {
        const key = `${item.billing_period_start_date}_${item.billing_period_end_date}`;
        if (!cyclesMap.has(key)) {
          cyclesMap.set(key, true);
          uniqueCycles.push({
            ciclo_id: cycleCounter,
            billing_period_start_date: item.billing_period_start_date,
            billing_period_end_date: item.billing_period_end_date,
            configuracao_id: configIds[0] || 0 // Use first config ID as reference
          });
          cycleCounter++;
        }
      });
      
      setAvailableCycles(uniqueCycles);

      // KPIs always use current cycle (most recent)
      const currentCycle = uniqueCycles.length > 0 ? uniqueCycles[0] : null;

      // Use optimized function for KPIs
      const { data: kpiData, error: kpiError } = await supabase
        .rpc('get_dashboard_kpis', {
          start_date: currentCycle?.billing_period_start_date,
          end_date: currentCycle?.billing_period_end_date,
          org_filter: selectedOrg && selectedOrg !== 'all' ? selectedOrg : null
        });

      if (kpiError) throw kpiError;

      // Get organization details for hierarchical structure
      const { data: orgData, error: orgError } = await supabase
        .rpc('get_organization_details_data', {
          start_date: currentCycle?.billing_period_start_date,
          end_date: currentCycle?.billing_period_end_date
        });

      if (orgError) throw orgError;

      const consumption = orgData || [];
      const kpiConsumption = kpiData || [];

      if (!consumption || consumption.length === 0) {
        const emptyData = {
          totalCost: 0,
          totalIPU: 0,
          avgDailyCost: 0,
          historicalComparison: 0,
          activeOrgs: 0,
          contractedIPUs: client.qtd_ipus_contratadas || 0,
          pricePerIPU: client.preco_por_ipu,
          historicalAvgDailyCost: 0,
          currentPeriod: currentCycle ? 
            new Date(currentCycle.billing_period_end_date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' , timeZone: 'UTC' }) :
            'Sem dados',
          periodStart: currentCycle ? 
            new Date(currentCycle.billing_period_start_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 
            '',
          periodEnd: currentCycle ? 
            new Date(currentCycle.billing_period_end_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 
            '',
          organizations: [],
          currentCycle
        };
        
        // Cache empty data
        cacheRef.current.set(cacheKey, { data: emptyData, timestamp: now });
        setData(emptyData);
        return;
      }

      // Calculate total IPU consumption for KPIs (already filtered by optimized functions)
      const totalIPU = kpiConsumption.reduce((sum, item) => sum + (item.total_ipu || 0), 0);
      
      // Calculate total cost for KPIs
      const totalCost = totalIPU * client.preco_por_ipu;

      // Calculate average daily cost
      const days = currentCycle ? 
        Math.max(1, Math.ceil((new Date(currentCycle.billing_period_end_date).getTime() - new Date(currentCycle.billing_period_start_date).getTime()) / (1000 * 60 * 60 * 24))) :
        30;
      const avgDailyCost = totalCost / days;

      // Calculate historical average daily cost for comparison
      let historicalAvgDailyCost = 0;
      let historicalComparison = 0;
      
      if (uniqueCycles.length > 1) {
        // Get historical data (all cycles except current)
        const historicalCycles = uniqueCycles.slice(1); // Skip current cycle (index 0)
        let totalHistoricalCost = 0;
        let totalHistoricalDays = 0;

        for (const cycle of historicalCycles) {
          const { data: historicalKpiData, error: historicalKpiError } = await supabase
            .rpc('get_dashboard_kpis', {
              start_date: cycle.billing_period_start_date,
              end_date: cycle.billing_period_end_date,
              org_filter: selectedOrg && selectedOrg !== 'all' ? selectedOrg : null
            });

          if (historicalKpiError) {
            continue;
          }

          if (historicalKpiData && historicalKpiData.length > 0) {
            const cycleTotalIPU = historicalKpiData.reduce((sum, item) => sum + (item.total_ipu || 0), 0);
            const cycleCost = cycleTotalIPU * client.preco_por_ipu;
            
            const cycleDays = Math.max(1, Math.ceil(
              (new Date(cycle.billing_period_end_date).getTime() - new Date(cycle.billing_period_start_date).getTime()) / (1000 * 60 * 60 * 24)
            ));
            
            totalHistoricalCost += cycleCost;
            totalHistoricalDays += cycleDays;
          }
        }

        if (totalHistoricalDays > 0) {
          historicalAvgDailyCost = totalHistoricalCost / totalHistoricalDays;
          if (historicalAvgDailyCost > 0) {
            historicalComparison = ((avgDailyCost - historicalAvgDailyCost) / historicalAvgDailyCost) * 100;
          }
        }
      }

      // Use distribution data function for hierarchical structure
      const { data: distributionData, error: distError } = await supabase
        .rpc('get_cost_distribution_data', {
          start_date: currentCycle?.billing_period_start_date,
          end_date: currentCycle?.billing_period_end_date
        });

      if (distError) {
      }

      const distributionConsumption = distributionData || [];
      
      // Calculate total IPU for organizations distribution data
      const totalIPUForOrgs = distributionConsumption.reduce((sum, item) => sum + (item.consumption_ipu || 0), 0);

      // Calculate costs and percentages for organizations using distribution data
      let organizations = distributionConsumption.map(org => ({
        org_id: org.org_id,
        org_name: org.org_name,
        consumption_ipu: org.consumption_ipu,
        cost: org.consumption_ipu * client.preco_por_ipu,
        percentage: totalIPUForOrgs > 0 ? Math.round((org.consumption_ipu / totalIPUForOrgs) * 100) : 0
      })).sort((a, b) => b.consumption_ipu - a.consumption_ipu);

      // Create hierarchical structure - first org is principal
      if (organizations.length > 1) {
        organizations = createHierarchicalStructure(organizations);
      }

      const newData = {
        totalCost,
        totalIPU,
        avgDailyCost,
        historicalComparison,
        activeOrgs: organizations.length,
        contractedIPUs: client.qtd_ipus_contratadas || 0,
        pricePerIPU: client.preco_por_ipu,
        historicalAvgDailyCost,
        currentPeriod: currentCycle ? 
          new Date(currentCycle.billing_period_end_date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) :
          'Período atual',
        periodStart: currentCycle ? 
          new Date(currentCycle.billing_period_start_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 
          '',
        periodEnd: currentCycle ? 
          new Date(currentCycle.billing_period_end_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 
          '',
        organizations,
        currentCycle
      };

      // Cache new data
      cacheRef.current.set(cacheKey, { data: newData, timestamp: now });
      setData(newData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [user, selectedOrg, selectedCycleFilter]);

  // Otimização: usar useRef para evitar re-renders desnecessários
  const stableUser = useRef(user);
  const stableSelectedOrg = useRef(selectedOrg);
  const stableSelectedCycleFilter = useRef(selectedCycleFilter);

  useEffect(() => {
    stableUser.current = user;
    stableSelectedOrg.current = selectedOrg;
    stableSelectedCycleFilter.current = selectedCycleFilter;
  });

  useEffect(() => {
    // Prevenir chamadas desnecessárias na mudança de foco da janela
    let timeoutId: NodeJS.Timeout;
    
    const delayedFetch = () => {
      timeoutId = setTimeout(() => {
        fetchDashboardData();
      }, 100); // Pequeno delay para evitar chamadas em rajada
    };

    delayedFetch();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchDashboardData]);

  const getChartData = useCallback(async (type: 'evolution' | 'distribution' | 'billing-periods', selectedOrg?: string, selectedCycleFilter?: string) => {
    if (!user) {
      return [];
    }

    const cacheKey = `chart_${type}_${user.id}_${selectedOrg || 'all'}_${selectedCycleFilter || '1'}`;
    const now = Date.now();

    try {
      // Get user's client information
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('cliente_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile?.cliente_id) return [];

      // Get client's price per IPU
      const { data: client, error: clientError } = await supabase
        .from('api_clientes')
        .select('preco_por_ipu, qtd_ipus_contratadas')
        .eq('id', profile.cliente_id)
        .maybeSingle();

      if (clientError || !client?.preco_por_ipu) return [];

      // Get configuration IDs - similar to your SQL query
      const { data: configs, error: configError } = await supabase
        .from('api_configuracaoidmc')
        .select('id, cliente_id')
        .eq('cliente_id', profile.cliente_id);

        if (configError || !configs || configs.length === 0) return [];

        const configIds = configs.map(config => config.id);

        // Get cycle limit for the optimized functions
        const cycleLimit = selectedCycleFilter && selectedCycleFilter !== 'all' 
          ? parseInt(selectedCycleFilter) 
          : null;

        // Use similar query structure to your SQL - fetch all consumption data first
        let baseQuery = supabase
          .from('api_consumosummary')
          .select('configuracao_id, org_id, org_name, meter_name, billing_period_start_date, billing_period_end_date, consumption_ipu')
          .in('configuracao_id', configIds)
          .gt('consumption_ipu', 0);

        // Filter by organization if selected and not 'all'
        if (selectedOrg && selectedOrg !== 'all') {
          baseQuery = baseQuery.eq('org_id', selectedOrg);
        }

        // Exclude "Sandbox Organizations IPU Usage" only for evolution and billing-periods charts
        if (type === 'evolution' || type === 'billing-periods') {
          baseQuery = baseQuery.neq('meter_name', 'Sandbox Organizations IPU Usage');
        }

        const { data: allConsumption, error: consumptionError } = await baseQuery
          .order('configuracao_id')
          .order('meter_name')
          .order('billing_period_start_date');

        if (consumptionError) {
          return [];
        }

        if (!allConsumption || allConsumption.length === 0) {
          return [];
        }

        if (type === 'evolution') {
          // Use optimized function for cost evolution
          const { data: evolutionData, error: evolutionError } = await supabase
            .rpc('get_cost_evolution_data', { 
              cycle_limit: cycleLimit,
              org_filter: selectedOrg && selectedOrg !== 'all' ? selectedOrg : null
            });

          if (evolutionError) {
            return [];
          }

          if (!evolutionData || evolutionData.length === 0) return [];

          // Group by billing period
          const periodMap = new Map();

          evolutionData.forEach(item => {
            const periodKey = `${item.billing_period_start_date}_${item.billing_period_end_date}`;
            const periodLabel = `${new Date(item.billing_period_start_date + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})} - ${new Date(item.billing_period_end_date + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`;

            if (periodMap.has(periodKey)) {
              periodMap.get(periodKey).totalIPU += item.consumption_ipu || 0;
            } else {
              periodMap.set(periodKey, {
                period: periodLabel,
                totalIPU: item.consumption_ipu || 0,
                billing_period_start_date: item.billing_period_start_date,
                billing_period_end_date: item.billing_period_end_date,
              });
            }
          });

          const result = Array.from(periodMap.values())
            .filter(item => item.totalIPU > 0)
            .sort((a, b) => new Date(a.billing_period_start_date).getTime() - new Date(b.billing_period_start_date).getTime())
            .map(item => ({
              period: item.period,
              ipu: item.totalIPU,
              cost: item.totalIPU * client.preco_por_ipu
            }));

          cacheRef.current.set(cacheKey, { data: result, timestamp: now });
          return result;

        } else if (type === 'billing-periods') {
          // Use optimized function for billing periods
          const { data: billingData, error: billingError } = await supabase
            .rpc('get_billing_periods_data', { 
              cycle_limit: cycleLimit,
              org_filter: selectedOrg && selectedOrg !== 'all' ? selectedOrg : null
            });

          if (billingError) {
            return [];
          }

          if (!billingData || billingData.length === 0) return [];

          // Group by billing period and meter_name
          const periodMap = new Map();
          let cycleCounter = 1;
          
          billingData.forEach(item => {
            const periodKey = `${item.billing_period_start_date}_${item.billing_period_end_date}`;
            const meterName = (item.meter_name || 'Outros').replace(/\s\s+/g, ' ').trim();
            
            if (!periodMap.has(periodKey)) {
              const periodLabel = `${new Date(item.billing_period_start_date + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})} - ${new Date(item.billing_period_end_date + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`;
              
              periodMap.set(periodKey, {
                period: periodLabel,
                billing_period_start_date: item.billing_period_start_date,
                billing_period_end_date: item.billing_period_end_date,
                cycleCounter: cycleCounter,
                meters: new Map()
              });
              cycleCounter++;
            }
            
            const period = periodMap.get(periodKey);
            const currentValue = period.meters.get(meterName) || 0;
            period.meters.set(meterName, currentValue + (item.consumption_ipu || 0));
          });

          // Get all unique meter names across all periods
          const allMeters = new Set<string>();
          periodMap.forEach(period => {
            period.meters.forEach((value, meter) => {
              if (value > 0) allMeters.add(meter);
            });
          });

          const meterNames = Array.from(allMeters);
          
          // Calculate contracted cost once
          const contractedReferenceValue = (client.qtd_ipus_contratadas || 0) * client.preco_por_ipu;

          // Convert to chart format
          const chartData = Array.from(periodMap.values())
            .filter(period => {
              // Only include periods with actual consumption
              let hasData = false;
              period.meters.forEach(value => {
                if (value > 0) hasData = true;
              });
              return hasData;
            })
            .sort((a, b) => new Date(a.billing_period_start_date).getTime() - new Date(b.billing_period_start_date).getTime())
            .map(period => {
              const dataPoint: any = { period: period.period };
              meterNames.forEach(meter => {
                const value = period.meters.get(meter) || 0;
                dataPoint[meter] = value * client.preco_por_ipu;
              });
              return dataPoint;
            });

          const result = { 
            data: chartData, 
            meters: meterNames.length > 0 ? meterNames : ['Sem dados'],
            colors: meterNames.map((_, index) => STABLE_COLORS[index % STABLE_COLORS.length]),
            contractedReferenceValue: contractedReferenceValue 
          };
          cacheRef.current.set(cacheKey, { data: result, timestamp: now });
          return result;

        } else if (type === 'distribution') {
          // For distribution, use separate query to get current cycle data including all meters
          let distributionQuery = supabase
            .from('api_consumosummary')
            .select('configuracao_id, org_id, org_name, meter_name, billing_period_start_date, billing_period_end_date, consumption_ipu')
            .in('configuracao_id', configIds)
            .neq('meter_name', 'Sandbox Organizations IPU Usage')
            .gt('consumption_ipu', 0);

          // Filter by organization if selected and not 'all'
          if (selectedOrg && selectedOrg !== 'all') {
            distributionQuery = distributionQuery.eq('org_id', selectedOrg);
          }

          // Get current cycle for distribution
          const { data: currentCycle } = await supabase
            .from('api_consumosummary')
            .select('billing_period_start_date, billing_period_end_date')
            .in('configuracao_id', configIds)
            .neq('meter_name', 'Sandbox Organizations IPU Usage')
            .order('billing_period_end_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (currentCycle) {
            distributionQuery = distributionQuery
              .eq('billing_period_start_date', currentCycle.billing_period_start_date)
              .eq('billing_period_end_date', currentCycle.billing_period_end_date);
          }

          const { data: distributionData, error: distError } = await distributionQuery;

          if (distError || !distributionData) return [];

          // Group by organization
          const orgMap = new Map();
          distributionData.forEach(item => {
            const orgId = item.org_id || 'unknown';
            const orgName = item.org_name || orgId;
            const ipu = item.consumption_ipu || 0;
            
            if (orgMap.has(orgId)) {
              orgMap.get(orgId).consumption_ipu += ipu;
            } else {
              orgMap.set(orgId, {
                org_id: orgId,
                org_name: orgName,
                consumption_ipu: ipu
              });
            }
          });

          const orgs = Array.from(orgMap.values());
          const totalIPU = orgs.reduce((sum, org) => sum + org.consumption_ipu, 0);

          const result = orgs
            .filter(org => org.consumption_ipu > 0)
            .map(org => ({
              name: org.org_name,
              value: totalIPU > 0 ? Math.round((org.consumption_ipu / totalIPU) * 100) : 0,
              cost: org.consumption_ipu * client.preco_por_ipu,
              color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
            }))
            .sort((a, b) => b.value - a.value);

          cacheRef.current.set(cacheKey, { data: result, timestamp: now });
          return result;
        }

        return [];
    } catch (error) {
      return [];
    }
  }, [user]);

  const refetch = useCallback(() => {
    // Limpar cache e forçar nova busca
    cacheRef.current.clear();
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  return { data, loading, error, refetch, getChartData, availableCycles };
}