-- Remover a função anterior e criar uma nova versão corrigida
DROP FUNCTION IF EXISTS public.get_project_consumption_data(date, date, text);

-- Criar nova função para buscar dados de projetos sem limitação
CREATE OR REPLACE FUNCTION public.get_project_consumption_data(
  p_start_date date,
  p_end_date date,
  p_selected_project text DEFAULT NULL
)
RETURNS TABLE(
  project_name text,
  consumption_date date,
  consumption_ipu numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  -- Return all project consumption data within date range
  RETURN QUERY
  SELECT 
    asset.project_name,
    asset.consumption_date,
    asset.consumption_ipu
  FROM api_consumoasset asset
  WHERE asset.configuracao_id = ANY(config_ids)
    AND asset.project_name IS NOT NULL 
    AND asset.project_name != '' 
    AND asset.consumption_ipu > 0 
    AND asset.consumption_date >= p_start_date
    AND asset.consumption_date <= p_end_date
    AND (p_selected_project IS NULL OR asset.project_name = p_selected_project)
  ORDER BY asset.consumption_date DESC;
END;
$$;