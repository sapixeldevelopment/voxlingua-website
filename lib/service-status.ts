export function applicantStatus(status: string) {
  if (status === 'interviewing') return { step: 1, title: 'Finish your interview', detail: 'Your application is started. Complete and submit your interview to join the review queue.' };
  if (['approved','role_assigned'].includes(status)) return { step: 3, title: 'You’re approved', detail: 'The community has approved your application. Check Discord for your access.' };
  if (status === 'declined') return { step: 3, title: 'Application declined', detail: 'The community has finished reviewing your application and declined it. Contact their team if you have questions.' };
  if (['role_pending','role_failed'].includes(status)) return { step: 2, title: 'Discord access is being arranged', detail: 'The team is completing your Discord access. You don’t need to submit another application.' };
  return { step: 2, title: 'Awaiting review', detail: 'Your application is with the community’s team. A person will make the final decision.' };
}
export const REVIEW_WAITING = ['pending','under_review','role_pending','role_failed'];
