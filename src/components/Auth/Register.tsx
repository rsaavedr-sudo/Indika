import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Loader2, AlertCircle, CheckCircle2, MapPin, Search } from 'lucide-react';
import { useCep, formatCep, cepDigits } from '../../hooks/useCep';

export default function Register() {
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    cpf: '',
    cep: '',
    uf: '',
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complemento: '',
    referencia: '',
    idade: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [addressUnlocked, setAddressUnlocked] = useState(false);
  const navigate = useNavigate();

  const { cepData, cepLoading, cepError, lookupCep, clearCepData } = useCep();

  // When CEP has 8 digits, trigger lookup automatically
  useEffect(() => {
    const digits = cepDigits(formData.cep);
    if (digits.length === 8) {
      lookupCep(formData.cep);
    } else {
      clearCepData();
      // Reset address fields when CEP changes and isn't complete
      setFormData(prev => ({ ...prev, uf: '', cidade: '', bairro: '', logradouro: '' }));
      setAddressUnlocked(false);
    }
  }, [formData.cep]);

  // When ViaCEP returns data, fill address fields
  useEffect(() => {
    if (cepData) {
      setFormData(prev => ({
        ...prev,
        uf: cepData.uf,
        cidade: cepData.cidade,
        bairro: cepData.bairro,
        logradouro: cepData.logradouro,
      }));
      setAddressUnlocked(false); // lock autocompleted fields
    }
  }, [cepData]);

  // On error, allow manual entry
  useEffect(() => {
    if (cepError) {
      setAddressUnlocked(true);
    }
  }, [cepError]);

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setFormData(prev => ({ ...prev, cep: formatted }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid,
        nome: formData.nome,
        sobrenome: formData.sobrenome,
        cpf: formData.cpf,
        idade: Number(formData.idade),
        email: formData.email,
        // Address fields
        cep: formData.cep,
        uf: formData.uf,
        cidade: formData.cidade,
        bairro: formData.bairro,
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento,
        referencia: formData.referencia,
        // System fields
        pontos: 0,
        ativo: true,
        hasAccess: true,
        organizationId: 'default-org',
        role: 'usuario',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await sendEmailVerification(user);
      setSuccess(true);
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Este email já está em uso.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const input = "w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400/30 focus:border-amber-500 outline-none transition-all text-sm text-zinc-800 placeholder:text-stone-400";
  const inputDisabled = "w-full px-4 py-2.5 bg-stone-100 border border-stone-200 rounded-xl outline-none text-sm text-zinc-500 cursor-not-allowed";
  const label = "block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1 ml-1";

  const cepComplete = cepDigits(formData.cep).length === 8;
  const addressFilled = !!(formData.cidade && formData.uf);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white p-8 rounded-2xl shadow-xl border border-stone-200"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center mb-4">
            <UserPlus className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Indika</h1>
          <p className="text-stone-500 text-sm">Crie sua conta gratuita</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              Conta criada com sucesso!
            </div>
            <p className="text-green-700 text-sm leading-relaxed">
              Enviamos um <strong>email de verificação</strong> para <strong>{formData.email}</strong>.<br />
              Verifique sua caixa de entrada e clique no link para ativar sua conta.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full mt-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Ir para o Login →
            </button>
          </div>
        )}

        {!success && (
          <form onSubmit={handleRegister} className="space-y-5">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Nome</label>
                <input required className={input} value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: João" />
              </div>
              <div>
                <label className={label}>Sobrenome</label>
                <input required className={input} value={formData.sobrenome}
                  onChange={e => setFormData({ ...formData, sobrenome: e.target.value })}
                  placeholder="Ex: Silva" />
              </div>
            </div>

            {/* CPF + Idade */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>CPF</label>
                <input required className={input} value={formData.cpf}
                  onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00" />
              </div>
              <div>
                <label className={label}>Idade</label>
                <input required type="number" min="1" max="120" className={input}
                  value={formData.idade}
                  onChange={e => setFormData({ ...formData, idade: e.target.value })}
                  placeholder="Ex: 25" />
              </div>
            </div>

            {/* ── Address block ── */}
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                <MapPin className="w-3.5 h-3.5" />
                Endereço
              </div>

              {/* CEP field */}
              <div>
                <label className={label}>CEP</label>
                <div className="relative">
                  <input
                    required
                    className={input + " pr-10"}
                    value={formData.cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    maxLength={9}
                    inputMode="numeric"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {cepLoading && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
                    {!cepLoading && cepComplete && addressFilled && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    {!cepLoading && cepComplete && !addressFilled && !cepError && (
                      <Search className="w-4 h-4 text-stone-400" />
                    )}
                  </div>
                </div>

                {/* CEP feedback */}
                <AnimatePresence>
                  {cepError && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-amber-700 mt-1 ml-1 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {cepError}
                    </motion.p>
                  )}
                  {cepData && !cepError && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-green-600 mt-1 ml-1"
                    >
                      ✓ Endereço encontrado — campos preenchidos automaticamente
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* UF + City */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={label}>Estado (UF)</label>
                  <input
                    required
                    className={addressUnlocked ? input : (formData.uf ? inputDisabled : input)}
                    value={formData.uf}
                    onChange={e => setFormData({ ...formData, uf: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="SP"
                    maxLength={2}
                    readOnly={!addressUnlocked && !!formData.uf}
                  />
                </div>
                <div className="col-span-2">
                  <label className={label}>Cidade</label>
                  <input
                    required
                    className={addressUnlocked ? input : (formData.cidade ? inputDisabled : input)}
                    value={formData.cidade}
                    onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                    placeholder="São Paulo"
                    readOnly={!addressUnlocked && !!formData.cidade}
                  />
                </div>
              </div>

              {/* Bairro + Logradouro */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Bairro</label>
                  <input
                    className={addressUnlocked ? input : (formData.bairro ? inputDisabled : input)}
                    value={formData.bairro}
                    onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                    placeholder="Centro"
                    readOnly={!addressUnlocked && !!formData.bairro}
                  />
                </div>
                <div>
                  <label className={label}>Logradouro / Rua</label>
                  <input
                    className={addressUnlocked ? input : (formData.logradouro ? inputDisabled : input)}
                    value={formData.logradouro}
                    onChange={e => setFormData({ ...formData, logradouro: e.target.value })}
                    placeholder="Av. Paulista"
                    readOnly={!addressUnlocked && !!formData.logradouro}
                  />
                </div>
              </div>

              {/* Number + Complement */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Número</label>
                  <input
                    required
                    className={input}
                    value={formData.numero}
                    onChange={e => setFormData({ ...formData, numero: e.target.value })}
                    placeholder="Ex: 1000"
                  />
                </div>
                <div>
                  <label className={label}>Complemento <span className="normal-case font-normal text-stone-400">(opcional)</span></label>
                  <input
                    className={input}
                    value={formData.complemento}
                    onChange={e => setFormData({ ...formData, complemento: e.target.value })}
                    placeholder="Apto 12, Bloco B"
                  />
                </div>
              </div>

              {/* Referencia */}
              <div>
                <label className={label}>Referência <span className="normal-case font-normal text-stone-400">(opcional)</span></label>
                <input
                  className={input}
                  value={formData.referencia}
                  onChange={e => setFormData({ ...formData, referencia: e.target.value })}
                  placeholder="Próximo ao metrô, portão azul..."
                />
              </div>

              {/* Unlock manual edit */}
              {cepData && !addressUnlocked && (
                <button
                  type="button"
                  onClick={() => setAddressUnlocked(true)}
                  className="text-xs text-stone-400 hover:text-amber-600 underline underline-offset-2 transition-colors"
                >
                  Editar endereço manualmente
                </button>
              )}
            </div>

            {/* Email */}
            <div>
              <label className={label}>Email</label>
              <input required type="email" className={input} value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="seu@email.com" />
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Senha</label>
                <input required type="password" className={input} value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••" />
              </div>
              <div>
                <label className={label}>Confirmar Senha</label>
                <input required type="password" className={input} value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="••••••" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Conta'}
            </button>
          </form>
        )}

        {!success && (
          <div className="mt-6 text-center">
            <p className="text-sm text-stone-500">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-amber-600 font-semibold hover:underline">
                Entre aqui
              </Link>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
