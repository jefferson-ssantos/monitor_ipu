import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    direction: "up" | "down" | "neutral";
  };
  variant?: "default" | "cost" | "success" | "warning";
  className?: string;
  contractedValue?: string | number;
  consumptionPercentage?: number;
  historicalComparison?: number;
  /**
   * Valor de referência para comparação (por exemplo, custo médio histórico).
   * Quando fornecido e o cartão for "Custo Médio Diário", ele será exibido
   * abaixo do subtítulo para esclarecer o valor do histórico usado.
   */
  baselineValue?: string | number;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
  contractedValue,
  consumptionPercentage,
  historicalComparison,
  baselineValue
}: KPICardProps) {
  // Definição de temas para as variações do cartão
  const variants = {
    default: {
      card: "bg-gradient-card border-border",
      icon: "bg-primary/10 text-primary",
      value: "text-foreground"
    },
    cost: {
      card: "bg-gradient-card border-border",
      icon: "bg-primary/10 text-primary",
      value: "text-cost-high"
    },
    success: {
      card: "bg-gradient-success/5 border-secondary/20",
      icon: "bg-secondary/10 text-secondary",
      value: "text-secondary"
    },
    warning: {
      card: "bg-gradient-card border-warning/20",
      icon: "bg-warning/10 text-warning",
      value: "text-warning"
    }
  };
  const variantStyles = variants[variant];

  const getTrendVariant = (direction: string) => {
    switch (direction) {
      case "up":
        return variant === "cost" ? "destructive" : "secondary";
      case "down":
        return variant === "cost" ? "secondary" : "destructive";
      default:
        return "outline";
    }
  };

  // Formatação numérica (K, M, etc.)
  const formatValue = (val: string | number) => {
    if (typeof val === "number") {
      if (val >= 1_000_000) {
        return (val / 1_000_000).toFixed(1) + "M";
      } else if (val >= 1_000) {
        return (val / 1_000).toFixed(1) + "K";
      }
      return val.toLocaleString();
    }
    return val;
  };

  // Cor e status da barra/progressão no “Custo Total”
  const getConsumptionStatus = (percentage?: number) => {
    if (percentage === undefined || percentage === null) {
      return { color: "text-foreground", status: "unknown" };
    }
    // >100% → vermelho; entre 90% e 100% → amarelo; <90% → verde
    if (percentage > 100) {
      return { color: "text-destructive", status: "danger" };
    }
    if (percentage >= 90) {
      return { color: "text-warning", status: "warning" };
    }
    return { color: "text-sucess", status: "good" };
  };

  // Cor do texto de comparação histórica (Custo Médio Diário)
  const getHistoricalComparisonColor = (comparison?: number) => {
    if (comparison === undefined || comparison === 0) {
      return "text-muted-foreground";
    }
    if (comparison > 0) {
      return "text-cost-high";     // acima do histórico
    }
    if (comparison >= -10) {
      return "text-cost-medium";   // até 10% abaixo do histórico
    }
    return "text-cost-low";        // mais de 10% abaixo do histórico
  };

  // Texto de comparação histórica com seta embutida
  const getHistoricalComparisonText = (comparison?: number) => {
    if (comparison === undefined) return "";
    const absComparison = Math.abs(comparison);
    const arrow = comparison > 0 ? "↗" : comparison < 0 ? "↘" : "→";
    if (comparison < 0) {
      return `${arrow} ${absComparison.toFixed(1)}% abaixo do histórico`;
    } else if (comparison > 0) {
      return `${arrow} ${absComparison.toFixed(1)}% acima do histórico`;
    } else {
      return `${arrow} Igual ao histórico`;
    }
  };

  /**
   * Determina a cor do valor principal do cartão:
   * - Custo Total: usa o % consumido (green/yellow/red conforme a regra 90/100/>100)
   * - Custo Médio Diário: usa a comparação histórica (acima, até 10% abaixo, ou mais de 10% abaixo)
   * - Outros cartões: mantém a cor do tema (variant)
   */
  const getMainValueColor = () => {
    // Custo Total
    if (title === "Custo Total" && consumptionPercentage !== undefined) {
      const { status } = getConsumptionStatus(consumptionPercentage);
      if (status === "good") return "text-cost-low";
      if (status === "warning") return "text-cost-medium";
      if (status === "danger") return "text-cost-high";
    }
    // Custo Médio Diário
    if (title === "Custo Médio Diário" && historicalComparison !== undefined) {
      const compClass = getHistoricalComparisonColor(historicalComparison);
      if (
        compClass === "text-cost-high" ||
        compClass === "text-cost-medium" ||
        compClass === "text-cost-low"
      ) {
        return compClass;
      }
    }
    // Demais
    return variantStyles.value;
  };

  // Tendência automática (usada em outros KPIs). Para “Custo Médio Diário” não usamos linha de tendência separada.
  const trendToShow = trend ?? (
    title === "Custo Médio Diário" && historicalComparison !== undefined
      ? {
          value: Math.abs(historicalComparison).toFixed(1),
          label: "",
          direction:
            historicalComparison > 0
              ? "up"
              : historicalComparison < 0
              ? "down"
              : "neutral"
        }
      : undefined
  );

  return (
    <Card
      className={cn(
        "transition-all duration-300 hover:shadow-medium",
        variantStyles.card,
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground font-body">
            {title}
          </CardTitle>
          <div
            className={cn(
              "p-2 rounded-lg transition-all duration-200",
              variantStyles.icon
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Valor principal colorido conforme a regra do KPI */}
          <div
            className={cn(
              "text-3xl font-bold font-heading tracking-tight",
              getMainValueColor()
            )}
          >
            {formatValue(value)}
          </div>

          {/* Subtítulo (quando existe) */}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}

          {/* Exibe o histórico como “Custo Médio Histórico” no KPI de Custo Médio Diário */}
          {baselineValue !== undefined && title === "Custo Médio Diário" && (
            <div className="text-sm text-muted-foreground">
              Custo Médio Histórico:{" "}
              {typeof baselineValue === "string"
                ? baselineValue
                : formatValue(baselineValue)}
            </div>
          )}

          {/* Se houver valor contratado e porcentagem consumida, mostra a barra e o % consumido */}
          {contractedValue && consumptionPercentage !== undefined && (
            <div className="space-y-2 mt-3">
              <div className="text-sm text-muted-foreground">
                {title === "Total IPUs"
                  ? `${formatValue(contractedValue)} IPUs contratadas`
                  : `Valor contratado: ${formatValue(contractedValue)}`}
              </div>
              <div className="flex items-center gap-2">
                {/* Texto neutro para % consumido */}
                <span className="text-sm font-medium text-muted-foreground">
                  {consumptionPercentage.toFixed(1)}% consumido
                </span>
                {/* Barra colorida conforme a regra (verde, amarelo, vermelho) */}
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      getConsumptionStatus(consumptionPercentage).status ===
                      "good"
                        ? "bg-cost-low"
                        : getConsumptionStatus(consumptionPercentage).status ===
                          "warning"
                        ? "bg-cost-medium"
                        : "bg-cost-high"
                    }`}
                    style={{
                      width: `${Math.min(consumptionPercentage, 100)}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Comparação histórica no Custo Médio Diário (com ícone de seta) */}
          {historicalComparison !== undefined &&
            title === "Custo Médio Diário" && (
              <div className="flex items-center gap-2 mt-2">
                {historicalComparison > 0 ? (
                  <TrendingUp className={`h-4 w-4 ${getHistoricalComparisonColor(historicalComparison)}`} />
                ) : historicalComparison < 0 ? (
                  <TrendingDown className={`h-4 w-4 ${getHistoricalComparisonColor(historicalComparison)}`} />
                ) : null}
                <span
                  className={`text-sm font-medium ${getHistoricalComparisonColor(
                    historicalComparison
                  )}`}
                >
                  {historicalComparison !== 0 ? (
                    `${Math.abs(historicalComparison).toFixed(1)}% ${
                      historicalComparison > 0 ? "acima" : "abaixo"
                    } do histórico`
                  ) : (
                    "Igual ao histórico"
                  )}
                </span>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
