create extension if not exists "pgcrypto";

create table if not exists public.trades (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_name text not null,
  stock_code text not null,
  market text not null,
  sector text,
  tags text[] not null default '{}',
  buy_price numeric not null,
  trade_amount numeric,
  buy_date date not null,
  action text not null check (action in ('初始持仓', '买入', '清仓', '做T买入', '做T卖出')),
  trade_type text not null check (trade_type in ('趋势交易', '反弹交易', '长期投资', '事件驱动', '止盈', '止损')),
  why_now text,
  bullish_factors text,
  risk_factors text,
  invalidation text,
  target_return text,
  holding_period text,
  stop_loss_price numeric,
  position_ratio text,
  status text not null check (status in ('持仓中', '已卖出')),
  current_return text default '0%',
  plan_followed text,
  exit_review text,
  lesson_learned text,
  is_initial_position boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  weekly_report_day text not null default 'Sunday',
  weekly_report_time text not null default '20:00',
  report_tone text not null default '简洁、直接、可执行',
  account_total_amount numeric,
  review_reminder_enabled boolean not null default false,
  return_color_mode text not null default 'red_up_green_down' check (return_color_mode in ('red_up_green_down', 'green_up_red_down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  title text not null,
  summary text not null,
  content text not null,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, week_start)
);

alter table public.trades
add column if not exists trade_amount numeric;

alter table public.trades
add column if not exists sector text;

alter table public.trades
add column if not exists tags text[] not null default '{}';

alter table public.trades
add column if not exists plan_followed text;

alter table public.trades
add column if not exists exit_review text;

alter table public.trades
add column if not exists lesson_learned text;

alter table public.trades
add column if not exists is_initial_position boolean not null default false;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'trades_action_check'
  ) then
    alter table public.trades
    drop constraint trades_action_check;
  end if;

  alter table public.trades
  add constraint trades_action_check
  check (action in ('初始持仓', '买入', '清仓', '做T买入', '做T卖出'));
end
$$;

alter table public.user_preferences
add column if not exists account_total_amount numeric;

alter table public.weekly_reports
add column if not exists snapshot jsonb;

alter table public.user_preferences
add column if not exists return_color_mode text not null default 'red_up_green_down';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_preferences_return_color_mode_check'
  ) then
    alter table public.user_preferences
    add constraint user_preferences_return_color_mode_check
    check (return_color_mode in ('red_up_green_down', 'green_up_red_down'));
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trades_set_updated_at on public.trades;
create trigger trades_set_updated_at
before update on public.trades
for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists weekly_reports_set_updated_at on public.weekly_reports;
create trigger weekly_reports_set_updated_at
before update on public.weekly_reports
for each row execute function public.set_updated_at();

alter table public.trades enable row level security;
alter table public.user_preferences enable row level security;
alter table public.weekly_reports enable row level security;

drop policy if exists "Users can read own trades" on public.trades;
create policy "Users can read own trades"
on public.trades for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own trades" on public.trades;
create policy "Users can insert own trades"
on public.trades for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own trades" on public.trades;
create policy "Users can update own trades"
on public.trades for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own trades" on public.trades;
create policy "Users can delete own trades"
on public.trades for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own preferences" on public.user_preferences;
create policy "Users can read own preferences"
on public.user_preferences for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own preferences" on public.user_preferences;
create policy "Users can insert own preferences"
on public.user_preferences for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
on public.user_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own weekly reports" on public.weekly_reports;
create policy "Users can read own weekly reports"
on public.weekly_reports for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own weekly reports" on public.weekly_reports;
create policy "Users can insert own weekly reports"
on public.weekly_reports for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own weekly reports" on public.weekly_reports;
create policy "Users can update own weekly reports"
on public.weekly_reports for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own weekly reports" on public.weekly_reports;
create policy "Users can delete own weekly reports"
on public.weekly_reports for delete
using (auth.uid() = user_id);

create index if not exists trades_user_id_buy_date_idx on public.trades(user_id, buy_date desc);
create index if not exists trades_user_id_stock_code_idx on public.trades(user_id, stock_code);
create index if not exists weekly_reports_user_id_week_start_idx on public.weekly_reports(user_id, week_start desc);
