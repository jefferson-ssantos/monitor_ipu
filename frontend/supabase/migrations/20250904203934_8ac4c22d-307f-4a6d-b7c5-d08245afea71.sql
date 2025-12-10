-- Create enums for access control
CREATE TYPE public.plan_type AS ENUM ('starter', 'essential', 'pro', 'business');
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- Add plan and role columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN plan_type public.plan_type DEFAULT 'starter',
ADD COLUMN user_role public.user_role DEFAULT 'user';

-- Update existing profiles to have default values
UPDATE public.profiles 
SET plan_type = 'business', user_role = 'admin' 
WHERE id IS NOT NULL;