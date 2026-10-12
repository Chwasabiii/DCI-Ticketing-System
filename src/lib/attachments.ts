import { createClient } from "@/lib/supabase/client";

export const MAX_TICKET_ATTACHMENTS = 5;
export const MAX_TICKET_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export function validateTicketAttachments(files: File[]) {
  if (files.length > MAX_TICKET_ATTACHMENTS) {
    return `Choose no more than ${MAX_TICKET_ATTACHMENTS} files.`;
  }

  const oversizedFiles = files.filter(
    (file) => file.size > MAX_TICKET_ATTACHMENT_SIZE
  );

  if (oversizedFiles.length > 0) {
    return `Each file must be 10 MB or smaller: ${oversizedFiles
      .map((file) => file.name)
      .join(", ")}`;
  }

  return null;
}

export async function uploadTicketAttachments(
  ticketId: string,
  userId: string,
  files: File[]
) {
  const validationError = validateTicketAttachments(files);
  if (validationError) {
    return { uploaded: [] as string[], failed: [] as string[], error: validationError };
  }

  const supabase = createClient();
  const uploaded: string[] = [];
  const failed: string[] = [];

  for (const file of files) {
    const filePath = `${ticketId}/${userId}/${crypto.randomUUID()}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(filePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false
        });

      if (uploadError) {
        failed.push(file.name);
        continue;
      }

      const { error: metadataError } = await supabase.from("attachments").insert({
        ticket_id: ticketId,
        uploaded_by: userId,
        file_name: file.name,
        file_path: filePath
      });

      if (metadataError) {
        await supabase.storage.from("ticket-attachments").remove([filePath]);
        failed.push(file.name);
        continue;
      }

      uploaded.push(file.name);
    } catch {
      failed.push(file.name);
    }
  }

  return { uploaded, failed, error: null };
}