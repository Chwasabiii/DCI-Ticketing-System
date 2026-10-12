import { TicketForm } from "@/components/tickets/ticket-form";

export default function NewTicketPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Submit a Ticket</h1>
        <p className="mt-2 text-sm text-slate-600">
          Send project support requests to PMSG for review, routing, and tracking.
        </p>
      </div>
      <TicketForm />
    </div>
  );
}
