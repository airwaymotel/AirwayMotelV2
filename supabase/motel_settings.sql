create table motel_settings (
  id text primary key default 'main',
  one_bed_rate double precision not null default 80,
  two_bed_rate double precision not null default 100,
  vat_enabled boolean not null default false,
  vat_rate double precision not null default 10.75,
  weekly_discount_enabled boolean not null default false,
  weekly_discount_amount double precision not null default 200,
  updated_at timestamp with time zone not null default now()
);

insert into motel_settings (id) values ('main')
on conflict (id) do nothing;

grant select on motel_settings to authenticated;
grant update on motel_settings to authenticated;