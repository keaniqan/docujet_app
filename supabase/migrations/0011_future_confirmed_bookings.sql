-- Apply after 0010. New bookings only; historical appointment statuses are unchanged.
begin;

create or replace function public.get_available_time_slots(p_date date)
returns table(preferred_time time without time zone)
language sql security definer set search_path = public as $$
  select distinct (weekly.start_time + offsets.minutes * interval '1 minute')::time
  from public.appointment_weekly_availability weekly
  cross join lateral generate_series(0, floor(extract(epoch from (weekly.end_time - weekly.start_time)) / 60)::integer - 30, 30) offsets(minutes)
  where weekly.day_of_week = extract(dow from p_date)::smallint and weekly.is_active and (p_date + (weekly.start_time + offsets.minutes * interval '1 minute')::time)
      > (clock_timestamp() at time zone 'Asia/Kuala_Lumpur')
    and not exists (select 1 from public.appointment_booking_closures c where c.closed_date = p_date)
    and not exists (select 1 from public.appointment_weekly_blocks block where block.day_of_week = weekly.day_of_week and block.is_active
      and (weekly.start_time + offsets.minutes * interval '1 minute')::time < block.end_time
      and (weekly.start_time + (offsets.minutes + 30) * interval '1 minute')::time > block.start_time)
    and not exists (select 1 from public.appointment_date_blocks block where block.blocked_date = p_date
      and block.blocked_time = (weekly.start_time + offsets.minutes * interval '1 minute')::time)
    and not exists (select 1 from public.appointments booked where booked.preferred_date = p_date
      and booked.preferred_time = (weekly.start_time + offsets.minutes * interval '1 minute')::time and booked.status <> 'Cancelled')
  order by 1;
$$;


-- Enforce the clock check even for direct RPC calls and rescheduling.
create or replace function public.reject_past_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' then
    if new.preferred_date is not distinct from old.preferred_date
       and new.preferred_time is not distinct from old.preferred_time then
      return new;
    end if;
  end if;
  if new.preferred_date is null or new.preferred_time is null
     or (new.preferred_date + new.preferred_time) <= (clock_timestamp() at time zone 'Asia/Kuala_Lumpur') then
    raise exception 'This appointment time has already passed. Please choose a future time.';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_reject_past_time on public.appointments;
create trigger appointments_reject_past_time
before insert or update of preferred_date, preferred_time on public.appointments
for each row execute function public.reject_past_appointment();

-- The legacy create_booking RPC explicitly inserts Pending, so a default alone
-- is insufficient. Reinstall the existing confirmation rule for every new row.
alter table public.appointments alter column status set default 'Confirmed';
create or replace function public.confirm_new_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.status := 'Confirmed';
  return new;
end;
$$;

drop trigger if exists appointments_confirm_on_insert on public.appointments;
create trigger appointments_confirm_on_insert before insert on public.appointments
for each row execute function public.confirm_new_appointment();

revoke all on function public.get_available_time_slots(date) from public;
grant execute on function public.get_available_time_slots(date) to anon, authenticated;
commit;

