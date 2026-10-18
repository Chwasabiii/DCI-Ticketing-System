"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MAX_TICKET_ATTACHMENT_SIZE,
  MAX_TICKET_ATTACHMENTS,
  ACCEPTED_TICKET_ATTACHMENT_TYPES,
  uploadTicketAttachments,
  validateTicketAttachments
} from "@/lib/attachments";

export function AttachmentUploader({
  ticketId,
  userId
}: {
  ticketId: string;
  userId: string;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    const validationError = validateTicketAttachments(selectedFiles);
    setFiles(validationError ? [] : selectedFiles);
    setMessage(validationError);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading || files.length === 0) return;

    const form = event.currentTarget;
    setIsUploading(true);
    setMessage(null);

    try {
      const result = await uploadTicketAttachments(ticketId, userId, files);
      if (result.error) {
        setMessage(result.error);
      } else if (result.failed.length > 0) {
        setMessage(`Some files could not be uploaded: ${result.failed.join(", ")}.`);
        setFiles((selectedFiles) =>
          selectedFiles.filter((file) => result.failed.includes(file.name))
        );
        form.reset();
      } else {
        setMessage(`${result.uploaded.length} file${result.uploaded.length === 1 ? "" : "s"} uploaded.`);
        setFiles([]);
        form.reset();
      }
      if (result.uploaded.length > 0) router.refresh();
    } catch {
      setMessage("The files could not be uploaded. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 grid gap-3 border-t border-slate-100 pt-5">
      <label className="grid gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Paperclip className="h-4 w-4" />
          Add files
        </span>
        <input
          type="file"
          multiple
          accept={ACCEPTED_TICKET_ATTACHMENT_TYPES}
          disabled={isUploading}
          onChange={handleFileChange}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
        <span className="text-xs text-slate-500">
          Up to {MAX_TICKET_ATTACHMENTS} files, {MAX_TICKET_ATTACHMENT_SIZE / 1024 / 1024} MB each.
        </span>
      </label>
      {files.length > 0 && (
        <ul className="space-y-1 text-sm text-slate-600">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>{file.name}</li>
          ))}
        </ul>
      )}
      {message && (
        <p role="status" className="text-sm text-slate-600">
          {message}
        </p>
      )}
      <Button type="submit" loading={isUploading} disabled={files.length === 0} className="w-fit">
        <Upload className="h-4 w-4" />
        {isUploading ? "Uploading..." : "Upload files"}
      </Button>
    </form>
  );
}
