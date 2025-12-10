import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export type PlanType = 'starter' | 'essential' | 'pro';
export type UserRole = 'user' | 'admin';

interface UserProfile {
  plan_type: PlanType;
  user_role: UserRole;
}

export interface PermissionConfig {
  canAccessDashboard: boolean;
  canAccessDashboardStarter: boolean;
  canAccessDashboardEssential: boolean;
  canAccessAnalysis: boolean;
  canAccessDetalhamento: boolean;
  canAccessConsumption: boolean;
  canAccessConfiguration: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<PermissionConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setPermissions(null);
      setLoading(false);
      return;
    }

    fetchUserProfile();
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan_type, user_role')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      // Convert legacy 'business' plan to 'pro'
      const planType = data.plan_type === 'business' ? 'pro' : data.plan_type as PlanType;
      const profileData = { ...data, plan_type: planType };

      setProfile(profileData);
      setPermissions(calculatePermissions(planType, data.user_role));
    } catch (error) {
      // Default permissions in case of error
      setPermissions({
        canAccessDashboard: true,
        canAccessDashboardStarter: true,
        canAccessDashboardEssential: false,
        canAccessAnalysis: false,
        canAccessDetalhamento: false,
        canAccessConsumption: true,
        canAccessConfiguration: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePermissions = (planType: PlanType, userRole: UserRole): PermissionConfig => {
    const basePermissions = {
      canAccessConsumption: true,
      canAccessConfiguration: userRole === 'admin',
    };

    switch (planType) {
      case 'starter':
        return {
          ...basePermissions,
          canAccessDashboard: false,
          canAccessDashboardStarter: true,
          canAccessDashboardEssential: false,
          canAccessAnalysis: false,
          canAccessDetalhamento: false,
        };

      case 'essential':
        return {
          ...basePermissions,
          canAccessDashboard: false,
          canAccessDashboardStarter: false,
          canAccessDashboardEssential: true,
          canAccessAnalysis: false,
          canAccessDetalhamento: false,
        };

      case 'pro':
        return {
          ...basePermissions,
          canAccessDashboard: false,
          canAccessDashboardStarter: false,
          canAccessDashboardEssential: true,
          canAccessAnalysis: true,
          canAccessDetalhamento: true,
        };

      default:
        return {
          ...basePermissions,
          canAccessDashboard: false,
          canAccessDashboardStarter: true,
          canAccessDashboardEssential: false,
          canAccessAnalysis: false,
          canAccessDetalhamento: false,
        };
    }
  };

  const getDefaultDashboard = (): string => {
    if (!permissions) return '/dashboard-starter';

    if (permissions.canAccessDashboard) return '/dashboard';
    if (permissions.canAccessDashboardEssential) return '/dashboard-essential';
    if (permissions.canAccessDashboardStarter) return '/dashboard-starter';
    
    return '/dashboard-starter';
  };

  return {
    profile,
    permissions,
    loading,
    getDefaultDashboard,
  };
}