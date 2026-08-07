import { Users } from "lucide-react";
import { getContractorRanking } from "@/lib/queries";
import { RankingList } from "@/components/ranking";

export const dynamic = "force-dynamic";

export default async function ContractorsPage() {
  const rows = await getContractorRanking();
  return (
    <RankingList
      title="Ranking de contratistas"
      subtitle="Contratistas con más señales en la contratación distrital."
      icon={<Users className="h-5 w-5" />}
      rows={rows}
    />
  );
}
