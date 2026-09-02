revoke update on table public.owner_feedback from anon, authenticated;
grant update (status) on table public.owner_feedback to authenticated;

drop policy if exists "Owners can update their own feedback status" on public.owner_feedback;
create policy "Owners can update their own feedback status"
  on public.owner_feedback
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and status in ('open', 'closed')
  );

