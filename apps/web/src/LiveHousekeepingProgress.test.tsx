// @vitest-environment jsdom
import React from 'react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,waitFor,cleanup} from '@testing-library/react';
import {LiveHousekeepingProgress} from './LiveHousekeepingProgress';
const mock=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('./api',()=>({api:mock.api}));
const progress={
  date:'2026-11-10',updatedAt:'2026-11-10T18:00:00.000Z',
  total:4,done:2,pending:1,inProgress:1,awaitingInspection:1,verified:1,cancelled:0,unassigned:0,percent:50,
  roomStatusCounts:{DIRTY:2,INSPECTION:1,CLEAN:1},
  employees:[{id:'employee-1',name:'Housekeeper A',assigned:4,pending:1,inProgress:1,awaitingInspection:1,verified:1,done:2}],
  recent:[{id:'task-1',room:'101',status:'VERIFIED',at:'2026-11-10T18:00:00.000Z'}]
};
beforeEach(()=>{mock.api.mockReset();mock.api.mockResolvedValue(structuredClone(progress));});
afterEach(()=>{cleanup();vi.useRealTimers();});
it('shows completion and verification separately using confirmed task counts',async()=>{
  render(<LiveHousekeepingProgress date="2026-11-10"/>);
  expect(await screen.findByRole('progressbar',{name:'Housekeeping completion'})).toHaveProperty('value',undefined);
  const bar=screen.getByRole('progressbar',{name:'Housekeeping completion'});
  expect(bar.getAttribute('aria-valuenow')).toBe('50');
  expect(screen.getByText('2 of 4 active cleaning tasks completed · 1 inspected and verified')).toBeTruthy();
  expect(screen.getByText('Housekeeper A')).toBeTruthy();
  expect(screen.getByRole('progressbar',{name:'Housekeeper A completed rooms'}).getAttribute('aria-valuenow')).toBe('50');
  expect(mock.api).toHaveBeenCalledWith('/housekeeping/live-progress?date=2026-11-10');
});
it('shows no assignments without presenting zero work as employee failure',async()=>{
  mock.api.mockResolvedValue({...progress,total:0,done:0,pending:0,inProgress:0,awaitingInspection:0,verified:0,
    employees:[],recent:[]});
  render(<LiveHousekeepingProgress date="2026-11-10"/>);
  expect(await screen.findByText('No cleaning assignments are scheduled for this date. 0% is not a performance score.')).toBeTruthy();
  expect(screen.getByRole('progressbar',{name:'Housekeeping completion'}).getAttribute('aria-valuenow')).toBe('0');
});
it('shows a stale-data warning rather than claiming live updates',async()=>{
  mock.api.mockRejectedValue(Error('Service temporarily unavailable'));
  render(<LiveHousekeepingProgress date="2026-11-10"/>);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('Update unavailable')).toBeTruthy();
});
