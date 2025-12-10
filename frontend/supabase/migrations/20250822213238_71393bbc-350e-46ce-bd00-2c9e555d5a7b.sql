-- Update get_cost_distribution_data to filter out Sandbox Organizations IPU Usage
CREATE OR REPLACE FUNCTION public.get_cost_distribution_data(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date)
 RETURNS TABLE(org_id text, org_name character varying, consumption_ipu numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;