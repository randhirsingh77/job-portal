import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

export function Login() {
  const { login } = useAuth(); const nav = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState('');
  return (
    <div className="panel"><h1>Login</h1>
      <form onSubmit={(e) => { e.preventDefault(); login(email, password).then(() => nav('/')).catch((x: Error) => setErr(x.message)); }}>
        <label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="error">{err}</p>}
        <button className="btn" type="submit">Login</button>
      </form>
    </div>
  );
}

export function Signup() {
  const { register } = useAuth(); const nav = useNavigate();
  const [role, setRole] = useState<'seeker' | 'recruiter'>('seeker');
  const [f, setF] = useState({ name: '', email: '', password: '', companyName: '', companyDomain: '', consent: false });
  const [err, setErr] = useState('');
  const set = (k: string) => (e: { target: { value: string; checked: boolean } }) => setF({ ...f, [k]: k === 'consent' ? e.target.checked : e.target.value });
  return (
    <div className="panel"><h1>Sign up</h1>
      <label>I am a</label>
      <select value={role} onChange={(e) => setRole(e.target.value as 'seeker' | 'recruiter')}>
        <option value="seeker">Job seeker</option><option value="recruiter">Recruiter / Employer</option>
      </select>
      <form onSubmit={(e) => { e.preventDefault(); register({ ...f, role }).then(() => nav(role === 'recruiter' ? '/recruiter' : '/profile')).catch((x: Error) => setErr(x.message)); }}>
        <label>Full name</label><input value={f.name} onChange={set('name')} required />
        <label>Email</label><input type="email" value={f.email} onChange={set('email')} required />
        <label>Password (at least 10 characters)</label><input type="password" value={f.password} onChange={set('password')} required minLength={10} />
        {role === 'recruiter' && (<>
          <div className="banner">Recruiters must use a <strong>work email on the company domain</strong>. If your email is hr@yourcompany.com, the company domain must be yourcompany.com. Free email addresses (Gmail, Yahoo, Outlook) are rejected — this is how a claim is verified.</div>
          <label>Company name</label><input value={f.companyName} onChange={set('companyName')} required />
          <label>Company domain</label><input value={f.companyDomain} onChange={set('companyDomain')} placeholder="yourcompany.com" required />
        </>)}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={f.consent} onChange={set('consent')} /> I agree to the terms and the processing of my data for job matching (DPDP consent).</label>
        {err && <p className="error">{err}</p>}
        <button className="btn" type="submit">Create account</button>
      </form>
    </div>
  );
}
