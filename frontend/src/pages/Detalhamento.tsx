import { useMemo } from "react";
import { AssetDetailWithFilter } from "@/components/consumption/AssetDetailWithFilter";
import { FileText } from "lucide-react";
import { usePageHeader } from "@/components/layout/AppLayout";

export default function Detalhamento() {

  const pageTitle = useMemo(() => (
    <div className="flex items-center gap-3">
      <FileText className="h-8 w-8 text-primary" />
      <div>
        <h1 className="text-3xl font-bold">Detalhamento por Asset</h1>
      </div>
    </div>
  ), []);
 usePageHeader(pageTitle);

  return (
    <div className="p-6 space-y-6">
      <AssetDetailWithFilter />
    </div>
  );
}