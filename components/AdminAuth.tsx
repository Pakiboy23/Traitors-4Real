import React, { useState } from 'react';

interface AdminAuthProps {
  onAuthenticate: (password: string) => boolean;
}

const AdminAuth: React.FC<AdminAuthProps> = ({ onAuthenticate }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onAuthenticate(password);

    if (!success) {
      setError(true);
      setPassword('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-zinc-900/90 border-2 border-red-900 p-8 rounded-lg shadow-[0_0_50px_rgba(138,28,28,0.3)] text-center relative overflow-hidden">
        {/* Visual Flourish */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50" />

        <div className="wax-seal mx-auto mb-6 scale-110">
          <span className="gothic-font text-2xl text-[#b04a4a] font-black">T</span>
        </div>

        <h2 className="gothic-font text-2xl text-[#D4AF37] mb-2">League Manager Access</h2>
        <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] mb-8 font-bold">
          Identity Verification Required
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Secret Phrase"
              className={`w-full bg-black border ${
                error ? 'border-red-600 animate-shake' : 'border-zinc-800'
              } p-4 rounded text-center text-[#D4AF37] focus:border-[#D4AF37] outline-none transition-all gothic-font tracking-[0.2em]`}
            />
            {error && (
              <p className="text-red-600 text-[10px] uppercase font-black mt-2 tracking-tighter">
                Access Denied. Traitors lurk everywhere.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-red-900/20 border border-red-900 text-red-100 hover:bg-red-900/40 transition-all gothic-font uppercase tracking-widest text-sm"
          >
            Unlock Forbidden Tools
          </button>
        </form>

        <p className="mt-8 text-[9px] text-zinc-600 italic uppercase">
          This chamber is reserved for the Conclave of the Titanic Swim Team.
        </p>
      </div>
    </div>
  );
};

export default AdminAuth;
