-- Pro and Ultra interview allowances are monthly, not daily.
update public.owner_billing
set
  monthly_interview_limit = case plan_key
    when 'starter' then 15
    when 'small' then 50
    when 'medium' then 150
    when 'pro' then 300
    when 'ultra' then 750
    else monthly_interview_limit
  end,
  daily_interview_limit = -1,
  daily_interviews_used = 0,
  daily_period_start = current_date
where plan_key in ('starter', 'small', 'medium', 'pro', 'ultra');
