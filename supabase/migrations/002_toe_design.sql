alter table piles add column toe_pn numeric;
alter table piles add column toe_pe numeric;
alter table asbuilt_records add column measured_time timestamptz default now();
