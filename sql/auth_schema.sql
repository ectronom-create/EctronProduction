-- Run this in Supabase SQL Editor to set up Auth and Profiles

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  emp_id text references public.employees(emp_id) on delete set null,
  role text not null default 'staff' check (role in ('admin', 'supervisor', 'staff')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Turn on RLS for profiles
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Trigger for updated_at
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, emp_id, role)
  values (new.id, new.raw_user_meta_data->>'emp_id', coalesce(new.raw_user_meta_data->>'role', 'staff'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

notify pgrst, 'reload schema';
