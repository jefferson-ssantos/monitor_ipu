-- Add qtd_ipus_contratadas column to api_clientes table
ALTER TABLE public.api_clientes 
ADD COLUMN IF NOT EXISTS qtd_ipus_contratadas NUMERIC DEFAULT 0;

-- Update the existing client record with the contracted IPUs value
UPDATE public.api_clientes 
SET qtd_ipus_contratadas = 180 
WHERE id = 1; -- ORYS client

UPDATE public.api_clientes 
SET qtd_ipus_contratadas = 180 
WHERE id = 2; -- VLI client (assuming same contract)