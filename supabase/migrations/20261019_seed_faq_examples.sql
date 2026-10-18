begin;

insert into public.faq_entries (question, answer, display_order, is_published)
select examples.question, examples.answer, examples.display_order, true
from (
  values
    (
      'How do I open a ticket?',
      'Choose “Open a Ticket”, enter a clear title and description, select your department, and add a project if the request relates to one. You can also choose a request type, category, priority, and attach supporting files.',
      10
    ),
    (
      'What happens after I open a project ticket?',
      'A project-linked ticket waits for approval from the project PM or one of its designated approvers. After one of them approves it, the PMSG team can review, route, and assign the work. If it is rejected, the reason appears on the ticket.',
      20
    ),
    (
      'Who can see a confidential ticket?',
      'A confidential ticket is visible to its requester, administrators, the employee assigned to it, and project approvers who need to review it. Other employees cannot see its details or attachments.',
      30
    ),
    (
      'What should I include in an incident report?',
      'Describe what happened, when it happened, and what project, system, or people were affected. Include relevant references and attach supporting files if available. Avoid including passwords or other credentials.',
      40
    )
) as examples(question, answer, display_order)
where not exists (
  select 1
  from public.faq_entries existing
  where existing.question = examples.question
);

commit;
