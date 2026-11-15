-- Configure the Edge Function secret and both Vault values before running this:
--   TICKET_RETENTION_CRON_SECRET in Supabase Edge Function secrets
--   ticket_retention_project_url in Vault (https://<project-ref>.supabase.co)
--   ticket_retention_api_key in Vault (the project's anon/publishable API key)
--   ticket_retention_cron_secret in Vault (same value as the Edge Function secret)

create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'delete-expired-ticket-archives-daily';

select cron.schedule(
  'delete-expired-ticket-archives-daily',
  '30 2 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'ticket_retention_project_url')
        || '/functions/v1/ticket-retention',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'ticket_retention_api_key'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ticket_retention_api_key'),
        'x-retention-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ticket_retention_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
