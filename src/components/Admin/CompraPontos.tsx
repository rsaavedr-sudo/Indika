import React from 'react';
import AdminLayout from './AdminLayout';
import { ShoppingCart, Trophy, Zap, Gift, ArrowRight } from 'lucide-react';

export default function CompraPontos() {
  return (
    <AdminLayout activeSection="comprar-pontos">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <ShoppingCart className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Comprar Pontos</h1>
          <p className="text-slate-500 text-lg">
            Adicione pontos à sua organização para distribuir entre usuários e campanhas.
          </p>
        </div>

        {/* Coming soon banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-8 text-center mb-10">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-xl font-bold text-indigo-900 mb-2">Em desenvolvimento</h2>
          <p className="text-indigo-600 max-w-md mx-auto">
            Esta área está sendo preparada. Em breve você poderá adquirir pacotes de pontos
            diretamente pela plataforma e distribuí-los para seus usuários.
          </p>
        </div>

        {/* Preview packages */}
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
          Pacotes planejados
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-50 pointer-events-none select-none">
          {[
            { label: 'Starter', pontos: '1.000', preco: 'R$ 49', icon: <Trophy className="w-6 h-6 text-amber-500" />, color: 'bg-amber-50 border-amber-100' },
            { label: 'Pro', pontos: '5.000', preco: 'R$ 199', icon: <Zap className="w-6 h-6 text-indigo-500" />, color: 'bg-indigo-50 border-indigo-200', highlight: true },
            { label: 'Enterprise', pontos: '20.000', preco: 'R$ 699', icon: <Gift className="w-6 h-6 text-purple-500" />, color: 'bg-purple-50 border-purple-100' },
          ].map((pkg) => (
            <div
              key={pkg.label}
              className={`${pkg.color} border rounded-2xl p-6 text-center flex flex-col items-center gap-3`}
            >
              <div className="p-3 bg-white rounded-xl shadow-sm">{pkg.icon}</div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">{pkg.label}</p>
                <p className="text-3xl font-black text-slate-900">{pkg.pontos}</p>
                <p className="text-xs text-slate-500">pontos</p>
              </div>
              <p className="text-lg font-bold text-slate-700">{pkg.preco}</p>
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-semibold py-2 rounded-xl opacity-60"
              >
                Em breve
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
