-- ===========================================================================
-- 0010 — editable website content, and credentials that move into the database.
--
-- Two changes, both about the same thing: taking values that could only be
-- changed by editing this repository and deploying it, and putting them behind
-- a form.
--
-- ---------------------------------------------------------------------------
-- site_content — one jsonb document per content area.
--
-- `app_settings` already exists and already works, but it stores text, one
-- scalar per row, with lists newline-joined. That shape is right for
-- `business.phone` and wrong for the FAQ: seven question/answer pairs are not a
-- string with newlines in them, and the moment an answer contains a newline the
-- encoding stops being reversible.
--
-- So the two tables split by shape, not by subject: app_settings keeps the
-- scalars, site_content takes the structured blocks ('contact', 'landing',
-- 'catalog', 'templates.bookingEmail', 'tooltips', ...). Both are read the same
-- way — merged over the code defaults, unknown keys ignored — so an
-- unapplied migration degrades to the values that ship in src/, exactly as an
-- empty app_settings does today.
--
-- ---------------------------------------------------------------------------
-- The Plasmic rows move namespace.
--
-- They were stored as `integrations.plasmicProjectId` / `.plasmicApiToken`, a
-- naming that only made sense while Plasmic was the single "integration". Every
-- managed credential now lives at `system.` + the environment variable's own
-- name, so the key in this table and the key in .env are the same string and
-- there is no mapping to keep honest. See src/lib/settings/env.ts.
--
-- Written as copy-then-delete rather than an UPDATE of the key, because the
-- destination row may already exist on an environment where somebody has
-- already saved through the new form.
--
-- Apply by pasting this whole file into the Supabase SQL Editor and running it.
-- ===========================================================================

begin;

create table if not exists public.site_content (
  key        text primary key,
  value      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

-- RLS on with zero policies = deny-all for anon and authenticated, the same
-- posture as crm_leads and app_settings. The service_role key bypasses RLS and
-- is the only key that reaches this table; nothing Supabase-related is used in
-- the browser.
alter table public.site_content enable row level security;

-- ---------------------------------------------------------------------------
-- integrations.* -> system.*
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value)
select 'system.PLASMIC_PROJECT_ID', value
  from public.app_settings
 where key = 'integrations.plasmicProjectId'
   and value <> ''
on conflict (key) do update set value = excluded.value;

insert into public.app_settings (key, value)
select 'system.PLASMIC_API_TOKEN', value
  from public.app_settings
 where key = 'integrations.plasmicApiToken'
   and value <> ''
on conflict (key) do update set value = excluded.value;

delete from public.app_settings
 where key in ('integrations.plasmicProjectId', 'integrations.plasmicApiToken');

commit;
