import { createClient } from "@/lib/supabase/client";

export const MAX_TICKET_ATTACHMENTS = 5;
export const MAX_TICKET_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const ACCEPTED_TICKET_ATTACHMENT_TYPES = [
  ".pdf", ".jpg", ".jpeg", ".png", ".txt", ".csv", ".doc", ".docx",
  ".xls", ".xlsx", ".ppt", ".pptx"
].join(",");

const acceptedExtensions = new Set(ACCEPTED_TICKET_ATTACHMENT_TYPES.split(","));
const fallbackMimeTypes: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  txt: "text/plain", csv: "text/csv", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};

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

  const unsupportedFiles = files.filter((file) => {
    const extension = `.${file.name.split(".").pop()?.toLocaleLowerCase() ?? ""}`;
    return !acceptedExtensions.has(extension);
  });
  if (unsupportedFiles.length > 0) {
    return `These file types are not supported: ${unsupportedFiles.map((file) => file.name).join(", ")}. Choose PDF, image, text, CSV, or Office files.`;
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
    const extension = file.name.split(".").pop()?.toLocaleLowerCase() ?? "";

    try {
      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(filePath, file, {
          contentType: file.type || fallbackMimeTypes[extension] || "application/octet-stream",
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
