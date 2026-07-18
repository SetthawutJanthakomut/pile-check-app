insert into project_settings (key, value, description) values
  ('tol_cross_check_m', 0.030,
   'Max as-built position diff between two surveys of the same pile+stage');

alter table asbuilt_records add column is_primary boolean not null default false;

create unique index one_primary_per_pile_stage
  on asbuilt_records (pile_id, pile_stage) where is_primary;

-- selecting a primary may touch other users' rows, so use a
-- SECURITY DEFINER rpc instead of widening RLS:
create or replace function set_primary_record(rec_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_pile uuid; v_stage text;
begin
  if not exists (select 1 from profiles p where p.id=auth.uid()
      and p.status='approved' and p.role in ('admin','recorder')) then
    raise exception 'not allowed';
  end if;
  select pile_id, pile_stage into v_pile, v_stage
    from asbuilt_records where id = rec_id;
  update asbuilt_records set is_primary=false
    where pile_id=v_pile and pile_stage is not distinct from v_stage;
  update asbuilt_records set is_primary=true where id=rec_id;
end $$;
