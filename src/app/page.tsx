import Planner from "@/components/Planner";
import { isDemo } from "@/lib/http";
import { coord } from "@/lib/validation";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const parse = (v: unknown) => {
    if (typeof v !== "string") return undefined;
    const result = coord.safeParse(v.split(",").map(Number));
    return result.success ? result.data : undefined;
  };
  const from = parse(query.from),
    to = parse(query.to);
  // Server-rendered request timestamp initializes a stable client clock.
  // eslint-disable-next-line react-hooks/purity
  const initialNow = Date.now();
  return (
    <Planner
      demo={isDemo()}
      initialNow={initialNow}
      initialOrigin={from ? { name: "Shared origin", coord: from } : undefined}
      initialDestination={
        to ? { name: "Shared destination", coord: to } : undefined
      }
      initialMode={query.mode === "walking" ? "walking" : "driving"}
    />
  );
}
