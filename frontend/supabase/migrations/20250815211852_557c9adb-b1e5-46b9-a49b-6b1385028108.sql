-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert into profiles table when a new user is created
  -- For users with @orys.com.br email, assign to ORYS client (id=1)
  -- For users with @vli.com.br email, assign to VLI client (id=2)
  INSERT INTO public.profiles (id, cliente_id)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.email LIKE '%@orys.com.br' THEN 1
      WHEN NEW.email LIKE '%@vli.com.br' THEN 2
      ELSE 1 -- Default to ORYS
    END
  );
  RETURN NEW;
END;
$$;

-- Create trigger to execute the function when a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert profile for existing user based on their email
-- Get the current user's email and create their profile
INSERT INTO public.profiles (id, cliente_id)
SELECT 
  id,
  CASE 
    WHEN email LIKE '%@orys.com.br' THEN 1
    WHEN email LIKE '%@vli.com.br' THEN 2
    ELSE 1
  END as cliente_id
FROM auth.users 
WHERE id NOT IN (SELECT id FROM public.profiles);