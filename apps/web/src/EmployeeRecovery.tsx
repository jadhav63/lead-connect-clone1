import {useState,type FormEvent} from 'react';
import {redeemAccess} from './api';
import {useLanguage} from './mobile-language';
export function EmployeeRecovery(){
  const {t}=useLanguage(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget,data=new FormData(form),password=String(data.get('password')),confirm=String(data.get('confirm'));
    if(password!==confirm||password.length<12||password.length>128){setMessage('Passwords must match and contain 12–128 characters.');return;}
    setBusy(true);setMessage('');try{await redeemAccess(String(data.get('code')).trim(),password);form.reset();setMessage('Password set. Sign in with your individual account.');}catch{setMessage('Code could not be redeemed. Ask your manager for a fresh code.');}finally{setBusy(false);}
  }
  return <details className="panel employee-recovery"><summary>{t('Need access or forgot your password?')}</summary><p>{t('Ask your manager to verify your identity and provide a private, one-time code. Never share a password.')}</p><form className="stack" onSubmit={submit}><label className="control">{t('Activation or recovery code')}<input name="code" type="password" autoComplete="one-time-code" required maxLength={512}/></label><label className="control">{t('New password')}<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label><label className="control">{t('Confirm password')}<input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label><button disabled={busy}>{t('Set private password')}</button></form>{message&&<p role="status">{t(message)}</p>}</details>;
}
