import { useState } from "react";
import { useMemo } from "react";
import { usePageHeader } from "@/components/layout/AppLayout";
import { CostTrendAnalysis } from "@/components/analysis/CostTrendAnalysis";
import { ProjectTrendAnalysis } from "@/components/analysis/ProjectTrendAnalysis";
import { Activity, BarChart3, FolderOpen } from "lucide-react";

export default function AnalysisTrends() {
  const [selectedSubTab, setSelectedSubTab] = useState("metrics");

  const pageTitle = useMemo(() => (
    <div className="flex items-center gap-3">
      <Activity className="h-8 w-8 text-primary" />
      <div>
        <h1 className="text-3xl font-bold">Análise de Tendências</h1>
      </div>
    </div>
  ), []);
  usePageHeader(pageTitle);

  return (
    <div className="p-6 space-y-6">
      {/* Seletor: Por Métrica/Por Projeto */}
      <div className="flex items-center gap-4">
        <div className="flex bg-gradient-card shadow-medium rounded-lg p-1">
          <button
            onClick={() => setSelectedSubTab("metrics")}
            className={`flex items-center gap-2 h-9 px-4 text-sm font-medium transition-all duration-200 rounded-md ${
              selectedSubTab === "metrics"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "hover:bg-background/50 text-muted-foreground"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Por Métrica
          </button>
          <button
            onClick={() => setSelectedSubTab("projects")}
            className={`flex items-center gap-2 h-9 px-4 text-sm font-medium transition-all duration-200 rounded-md ${
              selectedSubTab === "projects"
                ? "bg-background text-foreground shadow-sm border border-border"
                : "hover:bg-background/50 text-muted-foreground"
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            Por Projeto
          </button>
        </div>
      </div>

      {/* Conteúdo baseado na seleção */}
      <div>
        {selectedSubTab === "metrics" && <CostTrendAnalysis />}
        {selectedSubTab === "projects" && <ProjectTrendAnalysis />}
      </div>
    </div>
  );
}