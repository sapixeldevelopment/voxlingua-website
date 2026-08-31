alter table if exists public.servers
  alter column welcome_message
  set default 'Welcome to the Dexlyy interview portal.';

update public.servers
set welcome_message = 'Welcome to the Dexlyy interview portal.'
where welcome_message = 'Welcome to the VellaView interview portal.';
