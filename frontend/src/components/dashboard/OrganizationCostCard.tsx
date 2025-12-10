import { Building2, Users } from "lucide-react";

interface OrganizationCostCardProps {
  org: {
    org_id: string;
    org_name: string;
    cost: number;
    consumption_ipu: number;
    percentage: number;
    isPrincipal?: boolean;
    level?: number;
    parentOrgId?: string;
  };
  onClick: () => void;
  formatCurrency: (value: number) => string;
  formatIPU: (value: number) => string;
}

export function OrganizationCostCard({ 
  org, 
  onClick, 
  formatCurrency, 
  formatIPU 
}: OrganizationCostCardProps) {
  return (
    <div
      className={`flex flex-col justify-between p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer min-h-[120px] ${
        org.isPrincipal ? 'ring-2 ring-primary/20' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`w-2 h-8 rounded-full ${
          org.isPrincipal ? 'bg-primary' : 'bg-secondary'
        }`} />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {org.isPrincipal ? (
            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
          ) : (
            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className={`font-medium text-sm leading-tight ${
              org.isPrincipal ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {org.isPrincipal && '🏢 '}{org.org_name}
              {org.isPrincipal && ' (Principal)'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatIPU(org.consumption_ipu)} IPUs
            </p>
          </div>
        </div>
      </div>

      <div className="text-right mt-3">
        <p className={`font-bold text-lg ${
          org.isPrincipal ? 'text-foreground' : 'text-muted-foreground'
        }`}>
          {formatCurrency(org.cost)}
        </p>
        <p className="text-sm text-muted-foreground">
          {org.percentage.toFixed(1)}% do total
        </p>
      </div>
    </div>
  );
}