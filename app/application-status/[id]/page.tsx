import ApplicantStatus from '@/components/applicant-status';
export const metadata={title:'Application status',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}) {return <ApplicantStatus sessionId={(await params).id}/>;}
