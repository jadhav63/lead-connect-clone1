// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {PublicAreas,PublicAreaReport,areaExamples} from './PublicAreas';
const mock=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('./api',()=>({api:mock.api}));
let areas:any[]=[];
beforeEach(()=>{areas=[];mock.api.mockReset();mock.api.mockImplementation(async(path:string,method='GET',data:any)=>{
  if(path==='/public-areas/assignees')return {users:[{id:'cleaner',name:'Fictional Cleaner'}],staff:[]};
  if(path.startsWith('/public-area-tasks?'))return [];
  if(path==='/public-areas'&&method==='POST'){areas=[{...data,id:'area1',sortOrder:0}];return areas[0];}
  if(path==='/public-areas/area1'&&method==='PATCH'){areas=[{...areas[0],...data}];return areas[0];}
  if(path==='/public-areas')return areas;
  if(path.startsWith('/public-area-reports'))return {assigned:0,completed:0,pending:0,verified:0,cancelled:0,missed:0,awaitingVerification:0,productivity:[],tasks:[],missedTasks:[],maintenanceIssues:[]};
  return {};
});});
afterEach(cleanup);
it('creates no example records automatically and lets a manager create and edit one chosen area',async()=>{
  render(<PublicAreas day="2026-11-09" manager userId="manager"/>);
  await screen.findByText('No public areas configured.');
  expect(mock.api.mock.calls.every(([,method])=>method!=='POST')).toBe(true);
  expect(areaExamples).toHaveLength(12);
  fireEvent.change(screen.getByLabelText('Optional area example'),{target:{value:'Lobby / Front Desk'}});
  fireEvent.change(screen.getByLabelText('Floor or location'),{target:{value:'Ground floor'}});
  fireEvent.change(screen.getByLabelText('Checklist (one item per line)'),{target:{value:'Sweep\nWipe desk'}});
  fireEvent.click(screen.getByRole('button',{name:'Create public area'}));
  await screen.findByRole('button',{name:'Edit Lobby / Front Desk'});
  expect(mock.api).toHaveBeenCalledWith('/public-areas','POST',expect.objectContaining({name:'Lobby / Front Desk',checklist:['Sweep','Wipe desk'],assignedToId:null,assignedStaffId:null}));
  fireEvent.click(screen.getByRole('button',{name:'Edit Lobby / Front Desk'}));
  fireEvent.change(screen.getByLabelText('Floor or location'),{target:{value:'Main entrance'}});
  fireEvent.click(screen.getByRole('button',{name:'Save area changes'}));
  await waitFor(()=>expect(mock.api).toHaveBeenCalledWith('/public-areas/area1','PATCH',expect.objectContaining({location:'Main entrance'})));
});
it('hides manager configuration, schedule and report controls from workers',async()=>{
  render(<PublicAreas day="2026-11-09" manager={false} userId="cleaner"/>);
  await screen.findByText('No public areas configured.');
  expect(screen.queryByRole('button',{name:'Create public area'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Prepare daily assignments'})).toBeNull();
});
it('shows public-area report separately and handles unavailable reports',async()=>{
  mock.api.mockRejectedValueOnce(new Error('Report unavailable'));
  render(<PublicAreaReport day="2026-11-09"/>);
  await screen.findByRole('alert');expect(screen.getByText('Report unavailable')).toBeTruthy();
});
