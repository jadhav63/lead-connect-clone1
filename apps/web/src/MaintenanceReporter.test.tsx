// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MaintenanceReporter} from './MaintenanceReporter';
import {LanguageProvider,LanguageSelect} from './mobile-language';

const mock=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('./api',()=>({api:mock.api}));
let tickets:any[];
const roomId='00000000-0000-4000-8000-000000000101';
const context={rooms:[{id:roomId,number:'101',floor:1}],areas:[{
  id:'00000000-0000-4000-8000-000000000102',name:'Lobby',location:'Ground floor'
}]};
beforeEach(()=>{
  tickets=[];mock.api.mockReset();
  mock.api.mockImplementation(async(path:string,method='GET',body:any)=>{
    if(method==='GET'&&path==='/maintenance/report-context')return structuredClone(context);
    if(method==='GET'&&path==='/maintenance/my-reports')return structuredClone(tickets);
    if(method==='POST'&&path==='/maintenance'){
      const ticket={id:'ticket-1',title:body.title,description:body.description,
        priority:body.priority,status:'OPEN',createdAt:'2026-11-10T15:00:00Z',
        resolution:null,room:body.roomId?{number:'101'}:null,
        publicArea:body.publicAreaId?{name:'Lobby',location:'Ground floor'}:null,assignedTo:null};
      tickets.unshift(ticket);
      return {id:ticket.id,status:'OPEN'};
    }
    throw Error('Unexpected API request '+path);
  });
});
afterEach(()=>cleanup());
it('prefills the housekeeping room and creates a confirmed ticket',async()=>{
  render(<LanguageProvider><MaintenanceReporter reportRequest={{number:"101",requestId:1}}/></LanguageProvider>);
  const location=await screen.findByLabelText('Location') as HTMLSelectElement;
  expect(location.value).toBe('room:'+roomId);
  fireEvent.change(screen.getByLabelText('Issue type'),{target:{value:'Plumbing / Water'}});
  fireEvent.change(screen.getByLabelText('What needs repair?'),{target:{value:'Sink leaks when running water'}});
  fireEvent.change(screen.getByLabelText('Priority'),{target:{value:'HIGH'}});
  fireEvent.click(screen.getByRole('button',{name:'Submit repair ticket'}));
  await screen.findByText('Maintenance request submitted. Supervisors were notified.');
  const writes=mock.api.mock.calls.filter(([,method])=>method==='POST');
  expect(writes).toHaveLength(1);
  expect(writes[0][2]).toEqual({title:'Plumbing / Water',description:'Sink leaks when running water',priority:'HIGH',roomId});
  expect(screen.getByText('Plumbing / Water · Room 101')).toBeTruthy();
});
it('offers bilingual reporting with public-area selection',async()=>{
  render(<LanguageProvider><LanguageSelect/><MaintenanceReporter reportRequest={null}/></LanguageProvider>);
  await screen.findByRole('button',{name:'Report maintenance issue'});
  fireEvent.change(screen.getByLabelText('Language'),{target:{value:'es'}});
  fireEvent.click(screen.getByRole('button',{name:'Reportar problema de mantenimiento'}));
  fireEvent.change(screen.getByLabelText('Ubicación'),{target:{value:'area:'+context.areas[0].id}});
  fireEvent.change(screen.getByLabelText('¿Qué necesita reparación?'),{target:{value:'Puerta principal no cierra'}});
  fireEvent.click(screen.getByRole('button',{name:'Enviar reporte'}));
  await waitFor(()=>expect(mock.api.mock.calls.filter(([,method])=>method==='POST')).toHaveLength(1));
  const submission=mock.api.mock.calls.find(([,method])=>method==='POST');
  expect(submission).toBeDefined();
  expect(submission![2]).toMatchObject({publicAreaId:context.areas[0].id});
});
