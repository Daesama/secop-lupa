import { Building2 } from "lucide-react";
import { getEntityRanking } from "@/lib/queries";
import { RankingList } from "@/components/ranking";

export const dynamic = "force-dynamic";

export default async function EntitiesPage() {
  const rows = await getEntityRanking();
  return (
    <RankingList
      title="Ranking de entidades"
      subtitle="Entidades distritales con más señales de contratación sospechosa."
      icon={<Building2 className="h-5 w-5" />}
      rows={rows}
    />
  );
}
