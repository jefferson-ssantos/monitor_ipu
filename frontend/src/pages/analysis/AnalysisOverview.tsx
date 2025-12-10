import { useMemo } from "react";
import { usePageHeader } from "@/components/layout/AppLayout";
import { Link } from "react-router-dom";
import { TrendingUp, Activity, Target, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AnalysisOverview() {
  const pageTitle = useMemo(() => (
    <div className="flex items-center gap-3">
      <TrendingUp className="h-8 w-8 text-primary" />
      <div>
        <h1 className="text-3xl font-bold">Análise de Custos</h1>
      </div>
    </div>
  ), []);
  usePageHeader(pageTitle);

  return (
    <div className="p-6 space-y-6">
      <p className="text-muted-foreground text-center max-w-2xl mx-auto">
        Escolha o tipo de análise que deseja realizar sobre seus custos do IDMC
      </p>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Card Análise de Tendências */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Análise de Tendências</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Visualize padrões históricos, identifique tendências de crescimento ou redução de custos e analise o comportamento dos gastos ao longo do tempo.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Análise por métrica de custos
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Análise por projeto
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Insights estatísticos e gráficos
              </div>
            </div>
            <Button asChild className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
              <Link to="/analysis/trends" className="flex items-center gap-2">
                Acessar Tendências
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Card Análise Preditiva */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Análise Preditiva</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Utilize algoritmos de machine learning para prever custos futuros, identificar possíveis aumentos e planejar orçamentos com base em dados históricos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Previsões de custos por métrica
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Projeções por projeto
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                Modelos de machine learning
              </div>
            </div>
            <Button asChild className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
              <Link to="/analysis/forecast" className="flex items-center gap-2">
                Acessar Análise Preditiva
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Seção adicional com informações */}
      <div className="mt-8 p-6 bg-muted/30 rounded-lg border max-w-4xl mx-auto">
        <h3 className="text-lg font-semibold mb-2">Como escolher a análise adequada?</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Use Análise de Tendências quando:</p>
            <ul className="space-y-1 ml-4">
              <li>• Quiser entender padrões históricos</li>
              <li>• Precisar identificar sazonalidades</li>
              <li>• Desejar comparar períodos passados</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Use Análise Preditiva quando:</p>
            <ul className="space-y-1 ml-4">
              <li>• Precisar planejar orçamentos futuros</li>
              <li>• Quiser prever aumentos de custos</li>
              <li>• Desejar otimizar recursos antecipadamente</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}