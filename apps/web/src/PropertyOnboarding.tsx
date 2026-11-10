import {useEffect,useState} from 'react';
import {api} from './api';
export function PropertyOnboarding(){
  const [value,setValue]=useState<any>(null),[error,setError]=useState('');
  useEffect(()=>{let current=true;api('/property-onboarding').then(x=>{if(current)setValue(x);}).catch(e=>{if(current)setError(e.message);});return()=>{current=false;};},[]);
  return <section className="panel" aria-label="Property onboarding readiness"><h2>Property onboarding readiness</h2>{error&&<p role="alert">{error}</p>}{!value&&!error&&<p>Loading onboarding readiness…</p>}{value&&<>
    <p>Current property: {value.propertyCode}. {value.realHotel?'Tombstone Grand Hotel onboarding':'Demonstration or other property; real-hotel imports are unavailable here.'}</p>
    <ul><li>Hotel identity and Arizona timezone: {value.identityVerified?'Verified':'Not verified for 58835'}</li><li>Guest rooms: {value.guestRooms}; approved totals: {value.roomTotalsMatch?'Match':'Pending verification'}</li><li>Approved private room-map fingerprint: {value.approvedMapConfigured?'Configured':'Required before import'}</li><li>Import authorization: {value.importEnabled?'Enabled for reviewed production window':'Disabled'}</li></ul>
    <p>Before import, the manager must verify the exact private room map, accessibility codes, floors, current occupancy and cleaning status against an authorized hotel source. Unknown status must stay unimported. This screen never creates a hotel, rooms, logins, or passwords.</p>
    <p>Staff profiles are entered individually in Employees; profiles do not grant login access. Public Areas is managed separately from guest rooms.</p>
  </>}</section>;
}
