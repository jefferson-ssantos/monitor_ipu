-- Corrigir avisos de segurança adicionando SET search_path nas funções
CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  org_filter text DEFAULT NULL
)
RETURNS TABLE(
  configuracao_id integer,
  billing_period_start_date date,
  billing_period_end_date date,
  total_ipu numeric,
  active_orgs bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_cliente_id bigint;
  config_ids integer[];
BEGIN
  -- Get user's client ID
  SELECT profiles.cliente_id INTO user_cliente_id
  FROM profiles
  WHERE profiles.id = auth.uid();
  
  IF user_cliente_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user's configuration IDs
  SELECT array_agg(c.id) INTO config_ids
  FROM api_configuracaoidmc c
  WHERE c.cliente_id = user_cliente_id;
  
  IF config_ids IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    cs.configuracao_id,
    cs.billing_period_start_date,
    cs.billing_period_end_date,
    SUM(cs.consumption_ipu) as total_ipu,
    COUNT(DISTINCT cs.org_id) as active_orgs
  FROM api_consumosummary cs
  WHERE cs.configuracao_id = ANY(config_ids)
    AND cs.meter_name != 'Sandbox Organizations IPU Usage'
    AND (start_date IS NULL OR cs.billing_period_start_date >= start_date)
    AND (end_date IS NULL OR cs.billing_period_end_date <= end_date)
    AND (org_filter IS NULL OR cs.org_id = org_filter)
  GROUP BY cs.configuracao_id, cs.billing_period_start_date, cs.billing_period_end_date
  ORDER BY cs.billing_period_end_date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_cost_evolution_data(
  cycle_limit integer DEFAULT NULL,
  org_filter text DEFAULT NULL
)
RETURNS TABLE(
  billing_period_start_date date,
  billing_period_end_date date,
  org_id text,
  org_name character varying,
  consumption_ipu numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_cliente_id bigint;
  config_ids integer[];
BEGIN
  -- Get user's client ID
  SELECT profiles.cliente_id INTO user_cliente_id
  FROM profiles
  WHERE profiles.id = auth.uid();
  
  IF user_cliente_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user's configuration IDs
  SELECT array_agg(c.id) INTO config_ids
  FROM api_configuracaoidmc c
  WHERE c.cliente_id = user_cliente_id;
  
  IF config_ids IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH unique_cycles AS (
    SELECT DISTINCT cs.billing_period_start_date, cs.billing_period_end_date
    FROM api_consumosummary cs
    WHERE cs.configuracao_id = ANY(config_ids)
      AND cs.meter_name != 'Sandbox Organizations IPU Usage'
    ORDER BY cs.billing_period_end_date DESC
    LIMIT COALESCE(cycle_limit, 1000)
  )
  SELECT 
    cs.billing_period_start_date,
    cs.billing_period_end_date,
    cs.org_id,
    cs.org_name,
    SUM(cs.consumption_ipu) as consumption_ipu
  FROM api_consumosummary cs
  INNER JOIN unique_cycles uc ON cs.billing_period_start_date = uc.billing_period_start_date 
    AND cs.billing_period_end_date = uc.billing_period_end_date
  WHERE cs.configuracao_id = ANY(config_ids)
    AND cs.meter_name != 'Sandbox Organizations IPU Usage'
    AND cs.consumption_ipu > 0
    AND (org_filter IS NULL OR cs.org_id = org_filter)
  GROUP BY cs.billing_period_start_date, cs.billing_period_end_date, cs.org_id, cs.org_name
  ORDER BY cs.billing_period_end_date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_cost_distribution_data(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL
)
RETURNS TABLE(
  org_id text,
  org_name character varying,
  consumption_ipu numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_cliente_id bigint;
  config_ids integer[];
BEGIN
  -- Get user's client ID
  SELECT profiles.cliente_id INTO user_cliente_id
  FROM profiles
  WHERE profiles.id = auth.uid();
  
  IF user_cliente_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user's configuration IDs
  SELECT array_agg(c.id) INTO config_ids
  FROM api_configuracaoidmc c
  WHERE c.cliente_id = user_cliente_id;
  
  IF config_ids IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    cs.org_id,
    cs.org_name,
    SUM(cs.consumption_ipu) as consumption_ipu
  FROM api_consumosummary cs
  WHERE cs.configuracao_id = ANY(config_ids)
    AND cs.meter_name != 'Sandbox Organizations IPU Usage'
    AND cs.consumption_ipu > 0
    AND (start_date IS NULL OR cs.billing_period_start_date >= start_date)
    AND (end_date IS NULL OR cs.billing_period_end_date <= end_date)
  GROUP BY cs.org_id, cs.org_name
  ORDER BY consumption_ipu DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_billing_periods_data(
  cycle_limit integer DEFAULT NULL,
  org_filter text DEFAULT NULL
)
RETURNS TABLE(
  billing_period_start_date date,
  billing_period_end_date date,
  org_id text,
  org_name character varying,
  meter_name character varying,
  consumption_ipu numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_cliente_id bigint;
  config_ids integer[];
BEGIN
  -- Get user's client ID
  SELECT profiles.cliente_id INTO user_cliente_id
  FROM profiles
  WHERE profiles.id = auth.uid();
  
  IF user_cliente_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user's configuration IDs
  SELECT array_agg(c.id) INTO config_ids
  FROM api_configuracaoidmc c
  WHERE c.cliente_id = user_cliente_id;
  
  IF config_ids IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH unique_cycles AS (
    SELECT DISTINCT cs.billing_period_start_date, cs.billing_period_end_date
    FROM api_consumosummary cs
    WHERE cs.configuracao_id = ANY(config_ids)
      AND cs.meter_name != 'Sandbox Organizations IPU Usage'
    ORDER BY cs.billing_period_end_date DESC
    LIMIT COALESCE(cycle_limit, 1000)
  )
  SELECT 
    cs.billing_period_start_date,
    cs.billing_period_end_date,
    cs.org_id,
    cs.org_name,
    cs.meter_name,
    SUM(cs.consumption_ipu) as consumption_ipu
  FROM api_consumosummary cs
  INNER JOIN unique_cycles uc ON cs.billing_period_start_date = uc.billing_period_start_date 
    AND cs.billing_period_end_date = uc.billing_period_end_date
  WHERE cs.configuracao_id = ANY(config_ids)
    AND cs.meter_name != 'Sandbox Organizations IPU Usage'
    AND cs.consumption_ipu > 0
    AND (org_filter IS NULL OR cs.org_id = org_filter)
  GROUP BY cs.billing_period_start_date, cs.billing_period_end_date, cs.org_id, cs.org_name, cs.meter_name
  ORDER BY cs.billing_period_end_date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_organization_details_data(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL
)
RETURNS TABLE(
  org_id text,
  org_name character varying,
  consumption_ipu numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_cliente_id bigint;
  config_ids integer[];
BEGIN
  -- Get user's client ID
  SELECT profiles.cliente_id INTO user_cliente_id
  FROM profiles
  WHERE profiles.id = auth.uid();
  
  IF user_cliente_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user's configuration IDs
  SELECT array_agg(c.id) INTO config_ids
  FROM api_configuracaoidmc c
  WHERE c.cliente_id = user_cliente_id;
  
  IF config_ids IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    cs.org_id,
    cs.org_name,
    SUM(cs.consumption_ipu) as consumption_ipu
  FROM api_consumosummary cs
  WHERE cs.configuracao_id = ANY(config_ids)
    AND cs.consumption_ipu > 0
    AND (start_date IS NULL OR cs.billing_period_start_date >= start_date)
    AND (end_date IS NULL OR cs.billing_period_end_date <= end_date)
  GROUP BY cs.org_id, cs.org_name
  ORDER BY consumption_ipu DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_available_cycles()
RETURNS TABLE(
  billing_period_start_date date,
  billing_period_end_date date
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_cliente_id bigint;
  config_ids integer[];
BEGIN
  -- Get user's client ID
  SELECT profiles.cliente_id INTO user_cliente_id
  FROM profiles
  WHERE profiles.id = auth.uid();
  
  IF user_cliente_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user's configuration IDs
  SELECT array_agg(c.id) INTO config_ids
  FROM api_configuracaoidmc c
  WHERE c.cliente_id = user_cliente_id;
  
  IF config_ids IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT DISTINCT
    cs.billing_period_start_date,
    cs.billing_period_end_date
  FROM api_consumosummary cs
  WHERE cs.configuracao_id = ANY(config_ids)
    AND cs.meter_name != 'Sandbox Organizations IPU Usage'
  ORDER BY cs.billing_period_end_date DESC;
END;
$$;