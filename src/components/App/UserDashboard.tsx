import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Trophy, 
  LogOut, 
  Megaphone, 
  History, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Calendar,
  Tag,
  Loader2,
  Settings,
  User
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Transacao {
  id: string;
  pontos: number;
  tipo: 'credito' | 'debito';
  origem: string;
  descricao: string;
  createdAt: any;
  saldoNovo: number;
}

interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  pontos: number;
  tipo: string;
  dataFim: any;
}

export default function UserDashboard() {
  const { profile, user } = useAuth();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Listen to user's transactions
    const qTrans = query(
      collection(db, 'transacoes_pontos'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transacao[];
      setTransacoes(docs);
    });

    // Listen to active campaigns
    const qCamps = query(
      collection(db, 'campanhas'),
      where('status', '==', 'ativa'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeCamps = onSnapshot(qCamps, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Campanha[];
      setCampanhas(docs);
      setLoading(false);
    });

    return () => {
      unsubscribeTrans();
      unsubscribeCamps();
    };
  }, [user]);

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Indika</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl mr-4">
              {profile?.role === 'admin' && (
                <Link 
                  to="/admin"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <Settings className="w-4 h-4" />
                  Admin
                </Link>
              )}
              <Link 
                to="/user"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  "bg-white text-indigo-600 shadow-sm"
                )}
              >
                <User className="w-4 h-4" />
                Usuário
              </Link>
            </nav>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{profile?.nome} {profile?.sobrenome}</span>
              <span className="text-xs text-slate-500">{profile?.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome & Points Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-2">Olá, {profile?.nome}! 👋</h2>
              <p className="text-indigo-100 mb-6">Que bom ter você de volta. Veja como está sua pontuação hoje.</p>
              
              <div className="flex items-end gap-2">
                <span className="text-5xl font-black tracking-tighter">{profile?.pontos || 0}</span>
                <span className="text-lg font-medium text-indigo-200 mb-1">pontos acumulados</span>
              </div>
            </div>
            
            {/* Decorative circles */}
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500 rounded-full opacity-20" />
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-400 rounded-full opacity-10" />
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Próximo Nível</h3>
            <p className="text-sm text-slate-500">Continue participando das campanhas para ganhar mais!</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Campaigns */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-indigo-600" />
                Campanhas Ativas
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campanhas.length === 0 ? (
                <div className="col-span-full p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center text-slate-500">
                  Nenhuma campanha ativa no momento.
                </div>
              ) : (
                campanhas.map((camp) => (
                  <motion.div 
                    key={camp.id}
                    whileHover={{ y: -4 }}
                    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-indigo-50 rounded-xl">
                        <Tag className="w-5 h-5 text-indigo-600" />
                      </div>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                        +{camp.pontos} pts
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 mb-2">{camp.nome}</h4>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{camp.descricao}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="w-4 h-4" />
                      Expira em {camp.dataFim?.toDate().toLocaleDateString('pt-BR')}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* History */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Histórico Recente
            </h3>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {transacoes.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    Você ainda não possui movimentações.
                  </div>
                ) : (
                  transacoes.slice(0, 5).map((t) => (
                    <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-1.5 rounded-lg",
                            t.tipo === 'credito' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                          )}>
                            {t.tipo === 'credito' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                          </div>
                          <span className="text-sm font-bold text-slate-900">
                            {t.tipo === 'credito' ? '+' : '-'}{t.pontos} pts
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {t.createdAt?.toDate().toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 ml-9 truncate">{t.descricao}</p>
                    </div>
                  ))
                )}
              </div>
              {transacoes.length > 5 && (
                <button className="w-full py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors border-t border-slate-100">
                  Ver histórico completo
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
