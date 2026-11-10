// @vitest-environment jsdom
import React from 'react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,within} from '@testing-library/react';
import {MyWorkToday} from './MyWorkToday';
import {LanguageProvider,LanguageSelect,rememberHotel,rememberedHotel} from './mobile-language';
const mock=vi.hoisted(()=>({api:vi.fn()}));vi.mock('./api',()=>({api:mock.api}));
let work:any,failWrite=false;
beforeEach(()=>{localStorage.clear();failWrite=false;work={businessDate:'2026-11-09',property:{name:'Fictional hotel',code:'TEST',timezone:'America/Phoenix'},rooms:[{id:'room-task',status:'PENDING',room:{number:'901',floor:1},instructions:'Fictional room instructions',startedAt:null,completedAt:null,verifiedAt:null,verifiedBy:null}],areas:[{id:'area-task',status:'PENDING',area:{name:'Fictional lobby',location:'Ground',notes:'Area instructions'},slot:1,checklist:['Wipe'],completedItems:[],startedAt:null,completedAt:null,verifiedAt:null,verifiedBy:null}]};mock.api.mockReset();mock.api.mockImplementation(async(path:string,method='GET',body:any)=>{if(method==='GET')return structuredClone(work);const tasks=path.startsWith('/housekeeping/')?work.rooms:work.areas;Object.assign(tasks[0],body,body.status==='IN_PROGRESS'?{startedAt:'2026-11-09T15:00:00Z'}:body.status==='COMPLETED'?{completedAt:'2026-11-09T15:20:00Z'}:{});if(failWrite)throw Error('Connection lost');return structuredClone(tasks[0]);});});
afterEach(()=>{cleanup();localStorage.clear();});
it('separates room and area work, uses confirmed timestamps and requires checklist completion',async()=>{
  render(<LanguageProvider><MyWorkToday/></LanguageProvider>);
  const room=await screen.findByRole('article',{name:'Guest rooms: 901'});expect(within(room).getByText('Fictional room instructions')).toBeTruthy();
  fireEvent.click(within(room).getByRole('button',{name:'Start'}));await waitFor(()=>expect(within(screen.getByRole('article',{name:'Guest rooms: 901'})).getByRole('button',{name:'Complete'})).toBeTruthy());
  fireEvent.click(within(screen.getByRole('article',{name:'Guest rooms: 901'})).getByRole('button',{name:'Complete'}));await screen.findByText('Saved — completion confirmed.');
  expect(within(screen.getByRole('region',{name:'Guest rooms'})).getByText('Completed: 1 · Remaining: 0')).toBeTruthy();
  const area=screen.getByRole('article',{name:'Fictional lobby'});fireEvent.click(within(area).getByRole('button',{name:'Start'}));
  await waitFor(()=>expect(within(screen.getByRole('article',{name:'Fictional lobby'})).getByRole('button',{name:'Complete'})).toBeTruthy());
  const activeArea=screen.getByRole('article',{name:'Fictional lobby'}),complete=within(activeArea).getByRole('button',{name:'Complete'});expect((complete as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(activeArea).getByLabelText('Wipe'));fireEvent.click(complete);
  await waitFor(()=>expect(within(screen.getByRole('article',{name:'Fictional lobby'})).queryByRole('button',{name:'Complete'})).toBeNull());
  expect(within(screen.getByRole('article',{name:'Fictional lobby'})).getAllByText(/Awaiting inspection/).length).toBeGreaterThan(0);
});
it('never automatically repeats an ambiguous completion or claims Saved; explicit refresh reconciles server state',async()=>{
  work.rooms[0].status='IN_PROGRESS';work.rooms[0].startedAt='2026-11-09T15:00:00Z';
  render(<LanguageProvider><MyWorkToday/></LanguageProvider>);const room=await screen.findByRole('article',{name:'Guest rooms: 901'});failWrite=true;
  fireEvent.click(within(room).getByRole('button',{name:'Complete'}));await screen.findByRole('alert');
  expect(screen.queryByText('Saved — completion confirmed.')).toBeNull();expect((within(room).getByRole('button',{name:'Complete'}) as HTMLButtonElement).disabled).toBe(true);
  expect(mock.api.mock.calls.filter(([,method])=>method==='PATCH')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'Refresh work'}));await waitFor(()=>expect(within(screen.getByRole('article',{name:'Guest rooms: 901'})).queryByRole('button',{name:'Complete'})).toBeNull());
  expect(mock.api.mock.calls.filter(([,method])=>method==='PATCH')).toHaveLength(1);
});
it('supports Spanish employee labels and remembers only hotel and language preferences',async()=>{
  rememberHotel('TEST');expect(rememberedHotel()).toBe('TEST');
  render(<LanguageProvider><LanguageSelect/><MyWorkToday/></LanguageProvider>);await screen.findByRole('article',{name:'Guest rooms: 901'});
  fireEvent.change(screen.getByLabelText('Language'),{target:{value:'es'}});
  await screen.findByRole('heading',{name:'Mi trabajo de hoy'});expect(screen.getAllByRole('button',{name:'Iniciar'})).toHaveLength(2);
  expect(localStorage.getItem('lead-connect-language')).toBe('es');expect(localStorage.getItem('lead-connect-hotel')).toBe('TEST');
  expect(Object.keys(localStorage).sort()).toEqual(['lead-connect-hotel','lead-connect-language']);
});
