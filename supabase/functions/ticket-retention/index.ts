import { createClient } from "npm:@supabase/supabase-js@2";

type StorageEntry = {
  name: string;
  id: string | null;
  metadata: Record<string, unknown> | null;
};

type StorageBucket = {
  list(folder: string, options: { limit: number; offset: number }): Promise<{ data: unknown[] | null; error: unknown | null }>;
  remove(paths: string[]): Promise<{ error: unknown | null }>;
};

const batchSize = 1000;

async function listTicketObjects(
  storage: StorageBucket,
  folder: string
): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await storage.list(folder, { limit: batchSize, offset });
    if (error) throw new Error("Storage listing failed.");

    for (const entry of (data ?? []) as StorageEntry[]) {
      const path = `${folder}/${entry.name}`;
      if (entry.id && entry.metadata) paths.push(path);
      else if (!entry.id) paths.push(...await listTicketObjects(storage, path));
    }
    if (!data || data.length < batchSize) break;
  }
  return paths;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });

  const cronSecret = Deno.env.get("TICKET_RETENTION_CRON_SECRET");
  const providedSecret = request.headers.get("x-retention-secret");
  if (!cronSecret || providedSecret !== cronSecret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    console.error("Ticket retention is missing its Supabase server configuration.");
    return Response.json({ error: "Ticket retention is not configured." }, { status: 500 });
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const now = new Date().toISOString();
  const { data: expired, error: expiredError } = await supabase
    .from("ticket_retention")
    .select("ticket_id")
    .lte("delete_after", now)
    .order("delete_after", { ascending: true })
    .limit(100);
  if (expiredError) {
    console.error("Could not load expired archived tickets.");
    return Response.json({ error: "Could not load expired archived tickets." }, { status: 500 });
  }

  let deleted = 0;
  let skipped = 0;
  for (const item of expired ?? []) {
    const ticketId = item.ticket_id as number;
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets").select("status").eq("id", ticketId).maybeSingle();
    if (ticketError || !ticket || !["resolved", "closed"].includes(ticket.status)) {
      skipped += 1;
      continue;
    }

    const storage = supabase.storage.from("ticket-attachments");
    let objectPaths: string[];
    try {
      objectPaths = await listTicketObjects(storage, String(ticketId));
    } catch {
      console.error("Could not list files for an expired archived ticket.");
      skipped += 1;
      continue;
    }

    let storageFailed = false;
    for (let offset = 0; offset < objectPaths.length; offset += batchSize) {
      const { error } = await storage.remove(objectPaths.slice(offset, offset + batchSize));
      if (error) {
        storageFailed = true;
        break;
      }
    }
    if (storageFailed) {
      console.error("Could not remove files for an expired archived ticket.");
      skipped += 1;
      continue;
    }

    const { data: removedTicket, error: deleteError } = await supabase
      .from("tickets")
      .delete()
      .eq("id", ticketId)
      .select("id")
      .maybeSingle();
    if (deleteError || !removedTicket) {
      console.error("Could not remove an expired archived ticket record.");
      skipped += 1;
      continue;
    }
    deleted += 1;
  }

  return Response.json({ processed: expired?.length ?? 0, deleted, skipped });
});
