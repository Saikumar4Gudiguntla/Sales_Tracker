-- ============================================================
-- CRM + License Management schema
-- Run in Supabase SQL editor (Project > SQL Editor > New query)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- profiles (roles) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'sales' check (role in ('admin','manager','sales','viewer')),
  created_at timestamptz default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'sales');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------- leads ----------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  lead_name text not null,
  contact_name text,
  topic_sku text,
  salesperson text,
  num_people text,
  rev_number text,
  segment text,               -- G / S (Gov / State, or whatever taxonomy)
  source text,                -- Partner Center, Recap Email, etc.
  date_received date,
  status text default 'New',  -- New / In Progress / Demo Scheduled / Won / Lost / Disqualified
  next_action text,
  follow_up_date date,
  last_contact_date date,
  demo_date date,
  demo_sku text,
  notes text,
  archived boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_salesperson on leads(salesperson);
create index if not exists idx_leads_follow_up on leads(follow_up_date);

-- ---------- licenses ----------
create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  customer_name text not null,
  agreement_client_signed boolean default false,
  agreement_countersigned boolean default false,
  invoice_shared boolean default false,
  payment_done boolean default false,
  payment_confirmed boolean default false,
  license_loaded boolean default false,
  sku text,
  license_qty int default 0,
  subscription_type text default 'A' check (subscription_type in ('A','M')), -- Annual / Monthly
  amount numeric(12,2) default 0,
  purchase_date date,
  renewal_date date,
  expiry_date date,
  status text default 'Pending', -- Pending / Active / Expiring / Expired / Cancelled
  roles_notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_licenses_status on licenses(status);
create index if not exists idx_licenses_expiry on licenses(expiry_date);
create index if not exists idx_licenses_customer on licenses(customer_name);

-- ---------- audit logs ----------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null, -- insert / update / delete
  changed_by uuid references profiles(id),
  changed_at timestamptz default now(),
  old_data jsonb,
  new_data jsonb
);

create or replace function log_audit()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into audit_logs(table_name, record_id, action, changed_by, new_data)
    values (tg_table_name, new.id, 'insert', auth.uid(), to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into audit_logs(table_name, record_id, action, changed_by, old_data, new_data)
    values (tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    new.updated_at = now();
    return new;
  elsif (tg_op = 'DELETE') then
    insert into audit_logs(table_name, record_id, action, changed_by, old_data)
    values (tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old));
    return old;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_leads_audit on leads;
create trigger trg_leads_audit
  before insert or update or delete on leads
  for each row execute procedure log_audit();

drop trigger if exists trg_licenses_audit on licenses;
create trigger trg_licenses_audit
  before insert or update or delete on licenses
  for each row execute procedure log_audit();

-- ---------- dashboard view ----------
create or replace view dashboard_stats as
select
  (select count(*) from leads where archived = false) as total_leads,
  (select count(*) from leads where status not in ('Won','Lost','Disqualified') and archived = false) as active_leads,
  (select count(*) from leads where status = 'Won') as won_leads,
  (select count(*) from leads where status in ('Lost','Disqualified')) as lost_leads,
  (select count(*) from licenses where status = 'Active' and created_at >= date_trunc('month', now())) as new_licenses_this_month,
  (select count(*) from licenses where status = 'Pending') as pending_licenses,
  (select count(*) from licenses where expiry_date is not null and expiry_date <= now() + interval '30 days' and expiry_date >= now()) as expiring_licenses,
  (select count(*) from leads where follow_up_date is not null and follow_up_date <= now() + interval '7 days' and follow_up_date >= now()) as upcoming_followups,
  (select coalesce(sum(amount),0) from licenses) as total_revenue;

-- ---------- row level security ----------
alter table leads enable row level security;
alter table licenses enable row level security;
alter table profiles enable row level security;
alter table audit_logs enable row level security;

create policy "authenticated read leads" on leads for select using (auth.role() = 'authenticated');
create policy "authenticated write leads" on leads for insert with check (auth.role() = 'authenticated');
create policy "authenticated update leads" on leads for update using (auth.role() = 'authenticated');
create policy "authenticated delete leads" on leads for delete using (auth.role() = 'authenticated');

create policy "authenticated read licenses" on licenses for select using (auth.role() = 'authenticated');
create policy "authenticated write licenses" on licenses for insert with check (auth.role() = 'authenticated');
create policy "authenticated update licenses" on licenses for update using (auth.role() = 'authenticated');
create policy "authenticated delete licenses" on licenses for delete using (auth.role() = 'authenticated');

create policy "read own profile" on profiles for select using (auth.role() = 'authenticated');
create policy "update own profile" on profiles for update using (auth.uid() = id);

create policy "authenticated read audit" on audit_logs for select using (auth.role() = 'authenticated');
