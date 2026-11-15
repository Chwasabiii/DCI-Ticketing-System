type TicketInProgressEmail = {
  to: string;
  requesterName: string | null;
  ticketNumber: string;
  title: string;
};

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

export async function sendTicketInProgressEmail(ticket: TicketInProgressEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TICKET_EMAIL_FROM;
  if (!apiKey || !from) return "not_configured" as const;

  const name = ticket.requesterName?.trim() || "there";
  const subject = `Ticket ${ticket.ticketNumber} is now in progress`;
  const text = `Hi ${name},\n\nYour support ticket "${ticket.title}" (${ticket.ticketNumber}) is now In Progress. The support team is working on it.\n\nYou can sign in to the ticketing system to view the latest details.`;
  const html = `<p>Hi ${escapeHtml(name)},</p><p>Your support ticket <strong>${escapeHtml(ticket.title)}</strong> (${escapeHtml(ticket.ticketNumber)}) is now <strong>In Progress</strong>. The support team is working on it.</p><p>You can sign in to the ticketing system to view the latest details.</p>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to: [ticket.to], subject, text, html }),
      cache: "no-store"
    });
    if (!response.ok) return "failed" as const;
    return "sent" as const;
  } catch {
    return "failed" as const;
  }
}
