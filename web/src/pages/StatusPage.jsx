import React from 'react';
import { ArrowLeft, ShieldX, SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StatusPage({ code = 404, title, message }) {
  const navigate = useNavigate();
  const forbidden = code === 403;
  return <main className="min-h-[60vh] flex items-center justify-center"><section className="panel max-w-md w-full p-8 text-center"><div className="mx-auto w-14 h-14 rounded-xl bg-teal-primary/10 text-teal-primary flex items-center justify-center mb-5">{forbidden ? <ShieldX className="w-7 h-7" /> : <SearchX className="w-7 h-7" />}</div><p className="text-5xl font-display font-bold text-ink">{code}</p><h1 className="text-xl font-display font-bold text-ink mt-3">{title || (forbidden ? 'Access denied' : 'Page not found')}</h1><p className="text-sm text-ink/60 mt-2">{message || (forbidden ? 'Your account does not have access to this workspace.' : 'The requested workspace could not be located.')}</p><button onClick={() => navigate(-1)} className="button-primary mt-6"><ArrowLeft className="w-4 h-4" /> Go back</button></section></main>;
}
