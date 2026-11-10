// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {EmployeeRecovery} from './EmployeeRecovery';
import {LanguageProvider} from './mobile-language';
const mock=vi.hoisted(()=>({redeemAccess:vi.fn()}));vi.mock('./api',()=>mock);
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('requires matching private passwords and clears code/password fields only after confirmed redemption',async()=>{
  const password=crypto.randomUUID(),code=crypto.randomUUID();mock.redeemAccess.mockResolvedValue(undefined);
  render(<LanguageProvider><EmployeeRecovery/></LanguageProvider>);fireEvent.click(screen.getByText('Need access or forgot your password?'));
  fireEvent.change(screen.getByLabelText('Activation or recovery code'),{target:{value:code}});fireEvent.change(screen.getByLabelText('New password'),{target:{value:password}});fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:password+'wrong'}});
  fireEvent.click(screen.getByRole('button',{name:'Set private password'}));await screen.findByText('Passwords must match and contain 12–128 characters.');expect(mock.redeemAccess).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:password}});fireEvent.click(screen.getByRole('button',{name:'Set private password'}));
  await screen.findByText('Password set. Sign in with your individual account.');expect(mock.redeemAccess).toHaveBeenCalledWith(code,password);
  expect((screen.getByLabelText('Activation or recovery code') as HTMLInputElement).value).toBe('');
});
