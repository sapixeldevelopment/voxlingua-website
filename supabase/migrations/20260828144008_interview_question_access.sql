create policy "active interview questions are available"
  on public.question_bank for select
  to authenticated
  using (is_active = true);;
