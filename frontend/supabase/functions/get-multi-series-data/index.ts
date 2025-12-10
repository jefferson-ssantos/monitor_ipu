import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  cycleLimit?: number;
  selectedMeters?: string[];
  selectedMetric?: string;
  dimension?: 'meter' | 'project';
  selectedItems?: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting get-multi-series-data function');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('❌ Error parsing JSON:', jsonError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { 
      cycleLimit = 12, 
      selectedMeters = [], 
      selectedMetric = 'ipu', 
      dimension = 'meter', 
      selectedItems = [] 
    } = body || {};
    
    console.log('📊 Request params:', { cycleLimit, selectedMeters, selectedMetric, dimension, selectedItems });
    
    // Validate and normalize parameters
    const normalizedMeters = Array.isArray(selectedMeters) ? selectedMeters : [];
    const normalizedItems = Array.isArray(selectedItems) ? selectedItems : [];
    const normalizedMetric = selectedMetric || 'ipu';
    
    console.log('🔧 Normalized params:', { 
      cycleLimit, 
      normalizedMeters, 
      normalizedItems, 
      normalizedMetric, 
      dimension 
    });

    // Get user profile and client data
    const { data: profile } = await supabase
      .from('profiles')
      .select('cliente_id')
      .eq('id', user.id)
      .single();

    if (!profile?.cliente_id) {
      console.error('❌ User profile not found or missing cliente_id');
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 User cliente_id:', profile.cliente_id);

    // Get client pricing
    const { data: client } = await supabase
      .from('api_clientes')
      .select('preco_por_ipu')
      .eq('id', profile.cliente_id)
      .single();

    if (!client?.preco_por_ipu) {
      console.error('❌ Client pricing not found');
      return new Response(
        JSON.stringify({ error: 'Client pricing not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('💰 Price per IPU:', client.preco_por_ipu);

    // Get configuration IDs
    const { data: configs } = await supabase
      .from('api_configuracaoidmc')
      .select('id')
      .eq('cliente_id', profile.cliente_id);

    if (!configs || configs.length === 0) {
      console.error('❌ No configurations found');
      return new Response(
        JSON.stringify({ error: 'No configurations found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const configIds = configs.map(config => config.id);
    console.log('⚙️ Configuration IDs:', configIds);

    // Fetch consumption data based on dimension
    const allConsumptionData = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    console.log('🔄 Starting data fetching with pagination...');

    if (dimension === 'project') {
      // Fetch project data from api_consumoasset
      while (hasMore) {
        console.log(`📦 Fetching project batch from ${from} to ${from + batchSize - 1}`);
        
        const { data: batchData, error } = await supabase
          .from('api_consumoasset')
          .select('consumption_date, consumption_ipu, project_name')
          .in('configuracao_id', configIds)
          .gt('consumption_ipu', 0)
          .not('project_name', 'is', null)
          .neq('project_name', '')
          .order('consumption_date')
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('❌ Error fetching project batch:', error);
          throw error;
        }

        if (!batchData || batchData.length === 0) {
          hasMore = false;
          break;
        }

        allConsumptionData.push(...batchData);
        console.log(`✅ Fetched ${batchData.length} project records, total: ${allConsumptionData.length}`);

        if (batchData.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      }
    } else {
      // Fetch meter data from api_consumosummary (existing logic)
      while (hasMore) {
        console.log(`📦 Fetching meter batch from ${from} to ${from + batchSize - 1}`);
        
        const { data: batchData, error } = await supabase
          .from('api_consumosummary')
          .select('billing_period_start_date, billing_period_end_date, consumption_ipu, meter_name')
          .in('configuracao_id', configIds)
          .gt('consumption_ipu', 0)
          .neq('meter_name', 'Sandbox Organizations IPU Usage')
          .order('billing_period_start_date')
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('❌ Error fetching meter batch:', error);
          throw error;
        }

        if (!batchData || batchData.length === 0) {
          hasMore = false;
          break;
        }

        allConsumptionData.push(...batchData);
        console.log(`✅ Fetched ${batchData.length} meter records, total: ${allConsumptionData.length}`);

        if (batchData.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      }
    }

    console.log(`🎯 Total consumption records fetched: ${allConsumptionData.length}`);

    if (allConsumptionData.length === 0) {
      console.error('❌ No consumption data found');
      return new Response(
        JSON.stringify({ error: 'No consumption data found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract cycles differently based on dimension
    let allCycles = [];
    
    if (dimension === 'project') {
      // For projects, get billing cycles from api_ciclofaturamento
      const { data: cycleData, error: cycleError } = await supabase
        .from('api_ciclofaturamento')
        .select('billing_period_start_date, billing_period_end_date')
        .in('configuracao_id', configIds)
        .order('billing_period_start_date');

      if (cycleError) {
        console.error('❌ Error fetching billing cycles:', cycleError);
        throw cycleError;
      }

      // Remove duplicates and sort
      const cycleMap = new Map();
      cycleData?.forEach(item => {
        const cycleKey = `${item.billing_period_start_date}_${item.billing_period_end_date}`;
        if (!cycleMap.has(cycleKey)) {
          cycleMap.set(cycleKey, {
            billing_period_start_date: item.billing_period_start_date,
            billing_period_end_date: item.billing_period_end_date
          });
        }
      });

      allCycles = Array.from(cycleMap.values())
        .sort((a, b) => new Date(a.billing_period_start_date).getTime() - new Date(b.billing_period_start_date).getTime());
    } else {
      // For meters, extract cycles from consumption data
      const cycleMap = new Map();
      allConsumptionData.forEach(item => {
        const cycleKey = `${item.billing_period_start_date}_${item.billing_period_end_date}`;
        if (!cycleMap.has(cycleKey)) {
          cycleMap.set(cycleKey, {
            billing_period_start_date: item.billing_period_start_date,
            billing_period_end_date: item.billing_period_end_date
          });
        }
      });

      allCycles = Array.from(cycleMap.values())
        .sort((a, b) => new Date(a.billing_period_start_date).getTime() - new Date(b.billing_period_start_date).getTime());
    }

    console.log('🗓️ Total unique cycles found:', allCycles.length);
    console.log('📋 Sample cycles:', allCycles.slice(0, 3));

    // Limit cycles as requested  
    const sortedCycles = allCycles.slice(-cycleLimit);
    console.log('📅 Processing cycles after limit:', sortedCycles.length);
    console.log('🎯 Selected cycles:', sortedCycles);

    // Get available items based on dimension
    let availableItems = [];
    let itemsToInclude = [];
    
    if (dimension === 'project') {
      availableItems = [...new Set(
        allConsumptionData
          .map(item => item.project_name)
          .filter(Boolean)
          .filter(name => name !== '')
      )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

      console.log('🏷️ Available projects:', availableItems.length);

      // Determine which projects to include
      const includeAll = normalizedItems.includes('all') || normalizedMeters.includes('all');
      itemsToInclude = includeAll ? availableItems : [...normalizedItems, ...normalizedMeters].filter(m => m !== 'all');
    } else {
      availableItems = [...new Set(
        allConsumptionData
          .map(item => item.meter_name)
          .filter(Boolean)
          .filter(name => name !== 'Sandbox Organizations IPU Usage' && name !== 'Metadata Record Consumption')
      )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

      console.log('🏷️ Available meters:', availableItems.length);

      // Determine which metrics to include
      const includeAll = normalizedMeters.includes('all');
      itemsToInclude = includeAll ? availableItems : normalizedMeters.filter(m => m !== 'all');
    }

    console.log('📋 Items to include:', itemsToInclude);

    // Process data into periods
    const periodMap = new Map();

    // Initialize all cycles
    console.log('🔧 Initializing periods for cycles...');
    sortedCycles.forEach((cycle, index) => {
      const periodKey = `${cycle.billing_period_start_date}_${cycle.billing_period_end_date}`;
      const periodLabel = `${new Date(cycle.billing_period_start_date + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})} - ${new Date(cycle.billing_period_end_date + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`;
      
      console.log(`📝 Creating period ${index + 1}: ${periodLabel}`);
      
      const periodData: any = {
        period: periodLabel,
        billing_period_start_date: cycle.billing_period_start_date,
        billing_period_end_date: cycle.billing_period_end_date,
        periodStart: cycle.billing_period_start_date,
        periodEnd: cycle.billing_period_end_date,
        totalIPU: 0,
        totalCost: 0
      };

      // Initialize each item with zero
      itemsToInclude.forEach(itemName => {
        const itemKey = itemName.replace(/[^a-zA-Z0-9]/g, '_');
        periodData[`${itemKey}_ipu`] = 0;
        periodData[`${itemKey}_cost`] = 0;
      });
      
      periodMap.set(periodKey, periodData);
    });

    console.log('🗺️ Initialized period map with', periodMap.size, 'periods');

    // Aggregate consumption data - filter by cycles we're showing
    let processedRecords = 0;
    let matchedPeriods = 0;
    const cyclePeriods = new Set(sortedCycles.map(c => `${c.billing_period_start_date}_${c.billing_period_end_date}`));
    
    console.log('🔄 Starting data aggregation...');
    console.log('🎯 Target cycle periods:', Array.from(cyclePeriods));
    
    if (dimension === 'project') {
      // Project aggregation logic - map consumption dates to billing cycles
      allConsumptionData.forEach((item, index) => {
        if (index < 5) {
          console.log(`📋 Sample project item ${index + 1}: ${item.consumption_date}, project: ${item.project_name}, ipu: ${item.consumption_ipu}`);
        }
        
        // Find which billing cycle this consumption date belongs to
        const consumptionDate = new Date(item.consumption_date);
        const matchingCycle = sortedCycles.find(cycle => {
          const startDate = new Date(cycle.billing_period_start_date);
          const endDate = new Date(cycle.billing_period_end_date);
          return consumptionDate >= startDate && consumptionDate <= endDate;
        });
        
        if (matchingCycle) {
          const periodKey = `${matchingCycle.billing_period_start_date}_${matchingCycle.billing_period_end_date}`;
          matchedPeriods++;
          const periodData = periodMap.get(periodKey);
          
          if (periodData) {
            const itemIPU = item.consumption_ipu || 0;
            const itemCost = itemIPU * client.preco_por_ipu;
            
            // Add to total
            periodData.totalIPU += itemIPU;
            periodData.totalCost += itemCost;
            
            // Add to specific project if selected
            if (itemsToInclude.includes(item.project_name)) {
              const projectKey = item.project_name.replace(/[^a-zA-Z0-9]/g, '_');
              periodData[`${projectKey}_ipu`] = (periodData[`${projectKey}_ipu`] || 0) + itemIPU;
              periodData[`${projectKey}_cost`] = (periodData[`${projectKey}_cost`] || 0) + itemCost;
            }
            
            processedRecords++;
          }
        }
      });
    } else {
      // Meter aggregation logic (existing)
      allConsumptionData.forEach((item, index) => {
        const periodKey = `${item.billing_period_start_date}_${item.billing_period_end_date}`;
        
        if (index < 5) {
          console.log(`📋 Sample meter item ${index + 1}: ${periodKey}, meter: ${item.meter_name}, ipu: ${item.consumption_ipu}`);
        }
        
        if (cyclePeriods.has(periodKey)) {
          matchedPeriods++;
          const periodData = periodMap.get(periodKey);
          
          if (periodData) {
            const itemIPU = item.consumption_ipu || 0;
            const itemCost = itemIPU * client.preco_por_ipu;
            
            // Add to total
            periodData.totalIPU += itemIPU;
            periodData.totalCost += itemCost;
            
            // Add to specific metric if selected
            if (itemsToInclude.includes(item.meter_name)) {
              const metricKey = item.meter_name.replace(/[^a-zA-Z0-9]/g, '_');
              periodData[`${metricKey}_ipu`] = (periodData[`${metricKey}_ipu`] || 0) + itemIPU;
              periodData[`${metricKey}_cost`] = (periodData[`${metricKey}_cost`] || 0) + itemCost;
            }
            
            processedRecords++;
          }
        }
      });
    }

    console.log('🔍 Processed', processedRecords, 'consumption records');
    console.log('🎯 Matched periods:', matchedPeriods);
    console.log('📊 Period map size after aggregation:', periodMap.size);

    // Convert to array and sort
    const result = Array.from(periodMap.values())
      .sort((a, b) => new Date(a.billing_period_start_date).getTime() - new Date(b.billing_period_start_date).getTime());

    console.log('📊 Final result contains', result.length, 'periods');
    
    // Log sample results for debugging
    if (result.length > 0) {
      console.log('🔍 Sample result data:', {
        period: result[0].period,
        totalIPU: result[0].totalIPU,
        totalCost: result[0].totalCost
      });
    } else {
      console.error('❌ Result is empty - no periods generated');
    }
    
    console.log('💯 Function completed successfully');

    return new Response(
      JSON.stringify({ 
        data: result, 
        totalRecords: allConsumptionData.length,
        availableMeters: dimension === 'meter' ? availableItems : [],
        availableProjects: dimension === 'project' ? availableItems : []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});