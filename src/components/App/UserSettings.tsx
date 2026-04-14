import React, { useState, useEffect } from 'react';
import {
  doc, getDoc, updateDoc, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import {
  updatePassword, sendPasswordResetEmail,
  reauthenticateWithCredential, EmailAuthProvider, deleteUser
} from 'firebase/auth';
import { db, auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, KeyRound, Lock, HelpCircle, FileText, ShieldCheck,
  LogOut, Trash2, ChevronRight, Loader2, CheckCircle2,
  AlertCircle, Mail, Phone, CreditCard, MapPin, Save,
  Eye, EyeOff, AlertTriangle, MessageCircle, ExternalLink
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { signOut } from 'firebase/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsSection =
  | 'perfil'
  | 'pix'
  | 'senha'
  | 'esqueci-senha'
  | 'cancelar-conta'
  | 'ajuda'
  | 'termos'
  | 'privacidade';

const PIX_TYPES = [
  { value: 'cpf',       label: 'CPF' },
  { value: 'email',     label: 'E-mail' },
  { value: 'telefone',  label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

const input = 'w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 outline-none transition-all text-sm text-zinc-800 placeholder:text-stone-400';
const label = 'block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 ml-0.5';

function Toast({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        'mb-5 px-4 py-3 rounded-xl border flex items-center gap-2 text-sm font-medium',
        ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
      )}
    >
      {ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </motion.div>
  );
}

// ─── Section: Perfil ──────────────────────────────────────────────────────────

function PerfilSection() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    nome: '', sobrenome: '', cpf: '', idade: '',
    cep: '', uf: '', cidade: '', bairro: '', logradouro: '', numero: '', complemento: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, 'usuarios', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setForm({
          nome: d.nome || '', sobrenome: d.sobrenome || '', cpf: d.cpf || '',
          idade: String(d.idade || ''), cep: d.cep || '', uf: d.uf || '',
          cidade: d.cidade || '', bairro: d.bairro || '',
          logradouro: d.logradouro || '', numero: d.numero || '', complemento: d.complemento || '',
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), {
        nome: form.nome, sobrenome: form.sobrenome,
        cpf: form.cpf, idade: Number(form.idade),
        cep: form.cep, uf: form.uf, cidade: form.cidade,
        bairro: form.bairro, logradouro: form.logradouro,
        numero: form.numero, complemento: form.complemento,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setToast({ ok: true, msg: 'Perfil atualizado com sucesso.' });
    } catch {
      setToast({ ok: false, msg: 'Erro ao salvar perfil.' });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-amber-500" /></div>;

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <AnimatePresence>{toast && <Toast ok={toast.ok} msg={toast.msg} />}</AnimatePresence>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>Nome</label><input required className={input} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="João" /></div>
        <div><label className={label}>Sobrenome</label><input required className={input} value={form.sobrenome} onChange={e => setForm({ ...form, sobrenome: e.target.value })} placeholder="Silva" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>CPF</label><input className={input} value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
        <div><label className={label}>Idade</label><input type="number" min="1" max="120" className={input} value={form.idade} onChange={e => setForm({ ...form, idade: e.target.value })} placeholder="25" /></div>
      </div>

      {/* Address */}
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />Endereço
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={label}>CEP</label><input className={input} value={form.cep} onChange={e => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" /></div>
          <div><label className={label}>UF</label><input className={input} value={form.uf} maxLength={2} onChange={e => setForm({ ...form, uf: e.target.value.toUpperCase() })} placeholder="SP" /></div>
          <div><label className={label}>Cidade</label><input className={input} value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} placeholder="São Paulo" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Bairro</label><input className={input} value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} placeholder="Centro" /></div>
          <div><label className={label}>Logradouro</label><input className={input} value={form.logradouro} onChange={e => setForm({ ...form, logradouro: e.target.value })} placeholder="Av. Paulista" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Número</label><input className={input} value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="1000" /></div>
          <div><label className={label}>Complemento</label><input className={input} value={form.complemento} onChange={e => setForm({ ...form, complemento: e.target.value })} placeholder="Apto 12" /></div>
        </div>
      </div>

      {/* Email (read-only) */}
      <div>
        <label className={label}>E-mail</label>
        <input className={input + ' bg-stone-100 text-zinc-400 cursor-not-allowed'} value={profile?.email || ''} readOnly />
        <p className="text-[10px] text-stone-400 mt-1 ml-0.5">Para alterar o e-mail, entre em contato com o suporte.</p>
      </div>

      <button type="submit" disabled={saving}
        className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar Perfil
      </button>
    </form>
  );
}

// ─── Section: Chave Pix ───────────────────────────────────────────────────────

function PixSection() {
  const { user } = useAuth();
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('cpf');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, 'usuarios', user.uid));
      if (snap.exists()) {
        const d = snap.data();
        if (d.pix_key) { setPixKey(d.pix_key); setPixKeyType(d.pix_key_type || 'cpf'); }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pixKey.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), { pix_key: pixKey.trim(), pix_key_type: pixKeyType, updatedAt: serverTimestamp() });
      setToast({ ok: true, msg: 'Chave Pix salva com sucesso.' });
    } catch {
      setToast({ ok: false, msg: 'Erro ao salvar chave Pix.' });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-amber-500" /></div>;

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <AnimatePresence>{toast && <Toast ok={toast.ok} msg={toast.msg} />}</AnimatePresence>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-800">
        Esta chave será usada para receber seus saques de pontos via Pix. Certifique-se de que ela está correta.
      </div>

      <div>
        <label className={label}>Tipo de Chave</label>
        <div className="grid grid-cols-2 gap-2">
          {PIX_TYPES.map(p => (
            <button key={p.value} type="button"
              onClick={() => setPixKeyType(p.value)}
              className={cn(
                'py-2.5 px-4 rounded-xl border text-sm font-medium transition-all',
                pixKeyType === p.value
                  ? 'bg-zinc-950 text-white border-zinc-950'
                  : 'bg-white text-zinc-600 border-stone-200 hover:border-zinc-400'
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={label}>Chave Pix</label>
        <input required className={input} value={pixKey} onChange={e => setPixKey(e.target.value)}
          placeholder={
            pixKeyType === 'cpf' ? '000.000.000-00' :
            pixKeyType === 'email' ? 'seu@email.com' :
            pixKeyType === 'telefone' ? '+55 11 99999-9999' : 'Chave aleatória'
          }
        />
      </div>

      <button type="submit" disabled={saving || !pixKey.trim()}
        className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar Chave Pix
      </button>
    </form>
  );
}

// ─── Section: Mudar Senha ─────────────────────────────────────────────────────

function SenhaSection() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    if (next !== confirm) { setToast({ ok: false, msg: 'As senhas não coincidem.' }); return; }
    if (next.length < 6) { setToast({ ok: false, msg: 'A nova senha deve ter pelo menos 6 caracteres.' }); return; }
    setLoading(true);
    try {
      // Reauthenticate first
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      setToast({ ok: true, msg: 'Senha alterada com sucesso.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setToast({ ok: false, msg: 'Senha atual incorreta.' });
      } else {
        setToast({ ok: false, msg: 'Erro ao alterar senha. Tente novamente.' });
      }
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <AnimatePresence>{toast && <Toast ok={toast.ok} msg={toast.msg} />}</AnimatePresence>

      <div>
        <label className={label}>Senha atual</label>
        <div className="relative">
          <input required type={showCurrent ? 'text' : 'password'} className={input + ' pr-10'} value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••" />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className={label}>Nova senha</label>
        <div className="relative">
          <input required type={showNext ? 'text' : 'password'} className={input + ' pr-10'} value={next} onChange={e => setNext(e.target.value)} placeholder="••••••" />
          <button type="button" onClick={() => setShowNext(!showNext)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {next.length > 0 && next.length < 6 && (
          <p className="text-xs text-amber-600 mt-1 ml-0.5">Mínimo de 6 caracteres</p>
        )}
      </div>

      <div>
        <label className={label}>Confirmar nova senha</label>
        <input required type="password" className={input} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••" />
        {confirm && next && confirm !== next && (
          <p className="text-xs text-red-500 mt-1 ml-0.5">As senhas não coincidem</p>
        )}
      </div>

      <button type="submit" disabled={loading || !current || !next || next !== confirm}
        className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        Alterar Senha
      </button>
    </form>
  );
}

// ─── Section: Esqueci Senha ───────────────────────────────────────────────────

function EsqueciSenhaSection() {
  const { profile } = useAuth();
  const [email, setEmail] = useState(profile?.email || '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true); setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch {
      setError('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm text-zinc-600">
        Enviaremos um link de redefinição de senha para o seu e-mail. O link expira em 1 hora.
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {sent ? (
        <div className="px-4 py-4 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-700 space-y-1">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-4 h-4" />E-mail enviado!</div>
          <p>Verifique a caixa de entrada de <strong>{email}</strong> (e a pasta de spam). Clique no link para redefinir sua senha.</p>
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className={label}>E-mail da conta</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input type="email" required className={input + ' pl-10'} value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Enviar link de redefinição
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Section: Cancelar Conta ──────────────────────────────────────────────────

function CancelarContaSection() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<'warning' | 'confirm' | 'reauth'>('warning');
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const CONFIRM_WORD = 'CANCELAR';

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    setLoading(true); setError(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      // Soft-delete in Firestore first
      await updateDoc(doc(db, 'usuarios', user.uid), {
        ativo: false, hasAccess: false,
        deletedAt: serverTimestamp(),
      });
      await deleteUser(user);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Senha incorreta. Tente novamente.');
      } else {
        setError('Erro ao cancelar conta. Tente novamente ou entre em contato com o suporte.');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      {step === 'warning' && (
        <>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-700 font-bold">
              <AlertTriangle className="w-5 h-5" />Atenção — esta ação é irreversível
            </div>
            <ul className="text-sm text-red-700 space-y-1.5 list-disc ml-5">
              <li>Todos os seus dados pessoais serão removidos</li>
              <li>Seu saldo de pontos será perdido permanentemente</li>
              <li>Saques pendentes serão cancelados</li>
              <li>Você não poderá mais acessar a plataforma</li>
            </ul>
          </div>
          <button onClick={() => setStep('confirm')}
            className="w-full border border-red-300 text-red-600 font-semibold py-3 rounded-xl hover:bg-red-50 transition-colors text-sm flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" />
            Entendo, quero cancelar minha conta
          </button>
        </>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            Digite <strong>{CONFIRM_WORD}</strong> para confirmar que deseja cancelar sua conta.
          </div>
          <input className={input} value={typed} onChange={e => setTyped(e.target.value.toUpperCase())} placeholder={CONFIRM_WORD} />
          <button onClick={() => setStep('reauth')} disabled={typed !== CONFIRM_WORD}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-200 disabled:text-red-400 text-white font-semibold py-3 rounded-xl transition-all text-sm">
            Continuar
          </button>
          <button onClick={() => setStep('warning')} className="w-full text-zinc-500 hover:text-zinc-700 text-sm py-2">← Voltar</button>
        </div>
      )}

      {step === 'reauth' && (
        <form onSubmit={handleDelete} className="space-y-4">
          <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-zinc-600">
            Por segurança, confirme sua senha para finalizar o cancelamento.
          </div>
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div>
            <label className={label}>Senha</label>
            <input type="password" required className={input} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
          </div>
          <button type="submit" disabled={loading || !password}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Cancelar minha conta definitivamente
          </button>
          <button type="button" onClick={() => setStep('warning')} className="w-full text-zinc-500 hover:text-zinc-700 text-sm py-2">← Cancelar</button>
        </form>
      )}
    </div>
  );
}

// ─── Section: Ajuda ───────────────────────────────────────────────────────────

function AjudaSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">Precisa de ajuda? Entre em contato conosco pelos canais abaixo.</p>
      {[
        { icon: <Mail className="w-5 h-5 text-amber-600" />, title: 'E-mail de suporte', sub: 'suporte@indika.com.br', href: 'mailto:suporte@indika.com.br' },
        { icon: <MessageCircle className="w-5 h-5 text-green-600" />, title: 'WhatsApp', sub: 'Atendimento de seg–sex, 9h–18h', href: 'https://wa.me/5511900000000' },
      ].map(item => (
        <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 bg-white border border-stone-200 rounded-2xl hover:border-amber-300 hover:bg-amber-50/30 transition-all group">
          <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors">
            {item.icon}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-800">{item.title}</p>
            <p className="text-xs text-zinc-500">{item.sub}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-zinc-300 group-hover:text-amber-500 transition-colors" />
        </a>
      ))}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs text-stone-500">
        <strong className="text-zinc-700">Horário de atendimento:</strong> Segunda a sexta, 9h às 18h (horário de Brasília). Respondemos em até 24 horas úteis.
      </div>
    </div>
  );
}

// ─── Section: Termos ──────────────────────────────────────────────────────────

function TermosSection() {
  return (
    <div className="space-y-5 text-sm text-zinc-700 leading-relaxed">
      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Última atualização: Janeiro de 2025</p>

      {[
        { title: '1. Aceitação dos Termos', content: 'Ao criar uma conta na plataforma Indika, você concorda com estes Termos de Uso. Se não concordar com qualquer parte, não utilize nossos serviços.' },
        { title: '2. Uso da Plataforma', content: 'A plataforma Indika é um programa de pontos de fidelidade. Você pode acumular pontos participando de campanhas e missões, e trocá-los por valores em reais via Pix, conforme as condições vigentes.' },
        { title: '3. Pontos e Resgates', content: 'Os pontos acumulados têm validade conforme definido pelo administrador da plataforma. A taxa de conversão pode ser alterada com aviso prévio. Saques estão sujeitos a aprovação.' },
        { title: '4. Responsabilidades', content: 'Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.' },
        { title: '5. Cancelamento', content: 'Você pode cancelar sua conta a qualquer momento. Pontos não resgatados serão perdidos. Saques pendentes serão cancelados.' },
        { title: '6. Modificações', content: 'Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações significativas serão comunicadas com antecedência.' },
      ].map(s => (
        <div key={s.title} className="space-y-1.5">
          <h4 className="font-bold text-zinc-900">{s.title}</h4>
          <p>{s.content}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Section: Privacidade ─────────────────────────────────────────────────────

function PrivacidadeSection() {
  return (
    <div className="space-y-5 text-sm text-zinc-700 leading-relaxed">
      <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Última atualização: Janeiro de 2025</p>

      {[
        { title: '1. Dados Coletados', content: 'Coletamos nome, e-mail, CPF, endereço e chave Pix para operar o programa de fidelidade e processar pagamentos. Não coletamos dados além do necessário.' },
        { title: '2. Uso dos Dados', content: 'Seus dados são usados exclusivamente para: gerenciar sua conta, processar saques via Pix, enviar comunicações relevantes sobre o programa e cumprir obrigações legais.' },
        { title: '3. Compartilhamento', content: 'Não vendemos nem compartilhamos seus dados pessoais com terceiros, exceto quando necessário para processar pagamentos ou exigido por lei.' },
        { title: '4. Segurança', content: 'Adotamos medidas técnicas e organizacionais para proteger seus dados. As senhas são armazenadas com criptografia e os dados de pagamento são transmitidos de forma segura.' },
        { title: '5. Seus Direitos (LGPD)', content: 'Conforme a Lei Geral de Proteção de Dados, você tem direito a acessar, corrigir, excluir e portar seus dados. Para exercer esses direitos, entre em contato pelo suporte.' },
        { title: '6. Retenção', content: 'Mantemos seus dados enquanto sua conta estiver ativa. Após o cancelamento, dados financeiros são retidos por 5 anos conforme exigência legal.' },
        { title: '7. Contato', content: 'Para dúvidas sobre privacidade: privacidade@indika.com.br' },
      ].map(s => (
        <div key={s.title} className="space-y-1.5">
          <h4 className="font-bold text-zinc-900">{s.title}</h4>
          <p>{s.content}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  dividerBefore?: boolean;
  danger?: boolean;
}[] = [
  { id: 'perfil',        label: 'Perfil',               icon: <User className="w-4 h-4" /> },
  { id: 'pix',           label: 'Chave Pix',             icon: <CreditCard className="w-4 h-4" /> },
  { id: 'senha',         label: 'Mudar senha',           icon: <Lock className="w-4 h-4" /> },
  { id: 'esqueci-senha', label: 'Esqueci minha senha',   icon: <KeyRound className="w-4 h-4" /> },
  { id: 'ajuda',         label: 'Ajuda / Suporte',       icon: <HelpCircle className="w-4 h-4" />, dividerBefore: true },
  { id: 'termos',        label: 'Termos de uso',         icon: <FileText className="w-4 h-4" /> },
  { id: 'privacidade',   label: 'Política de privacidade', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'cancelar-conta', label: 'Cancelar conta',       icon: <Trash2 className="w-4 h-4" />, dividerBefore: true, danger: true },
];

const SECTION_TITLES: Record<SettingsSection, string> = {
  perfil: 'Perfil',
  pix: 'Chave Pix',
  senha: 'Mudar Senha',
  'esqueci-senha': 'Esqueci Minha Senha',
  'cancelar-conta': 'Cancelar Conta',
  ajuda: 'Ajuda e Suporte',
  termos: 'Termos de Uso',
  privacidade: 'Política de Privacidade',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserSettings() {
  const [active, setActive] = useState<SettingsSection>('perfil');

  const renderSection = () => {
    switch (active) {
      case 'perfil':         return <PerfilSection />;
      case 'pix':            return <PixSection />;
      case 'senha':          return <SenhaSection />;
      case 'esqueci-senha':  return <EsqueciSenhaSection />;
      case 'cancelar-conta': return <CancelarContaSection />;
      case 'ajuda':          return <AjudaSection />;
      case 'termos':         return <TermosSection />;
      case 'privacidade':    return <PrivacidadeSection />;
    }
  };

  return (
    <div className="flex gap-6 min-h-[500px]">
      {/* Sidebar nav */}
      <aside className="w-52 flex-shrink-0">
        <nav className="space-y-0.5">
          {SECTIONS.map(s => (
            <React.Fragment key={s.id}>
              {s.dividerBefore && <div className="border-t border-stone-200 my-2" />}
              <button
                onClick={() => setActive(s.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all text-left',
                  active === s.id
                    ? s.danger ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    : s.danger
                      ? 'text-red-500 hover:bg-red-50 hover:text-red-700'
                      : 'text-zinc-500 hover:bg-stone-100 hover:text-zinc-900'
                )}
              >
                <span className={cn(
                  'flex-shrink-0',
                  active === s.id
                    ? s.danger ? 'text-red-600' : 'text-amber-600'
                    : s.danger ? 'text-red-400' : 'text-zinc-400'
                )}>
                  {s.icon}
                </span>
                {s.label}
              </button>
            </React.Fragment>
          ))}
        </nav>
      </aside>

      {/* Content panel */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.12 }}
            className="bg-white rounded-2xl border border-stone-200 p-6"
          >
            <h3 className="text-base font-bold text-zinc-900 mb-5 pb-4 border-b border-stone-100">
              {SECTION_TITLES[active]}
            </h3>
            {renderSection()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
