import { getScopedDb } from "@/db/scoped";
import { unauthorized } from "@/lib/api";
import { itemsToCsv } from "@/lib/csv";

export async function GET() {
  const sdb = await getScopedDb();
  if (!sdb) return unauthorized();
  const items = await sdb.exportMediaItems();
  const csv = itemsToCsv(items);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="stream-witus-media.csv"',
    },
  });
}
