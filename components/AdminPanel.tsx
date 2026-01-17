
import React, { useState } from 'react';
import { GameState, CAST_NAMES, PlayerEntry, DraftPick } from '../types';
import { getCastPortraitSrc } from "../src/castPortraits";

interface AdminPanelProps {
  gameState: GameState;
  updateGameState: (state: GameState) => void;
  onSignOut?: () => void;
  lastSavedAt?: number | null;
  lastWriteError?: string | null;
  onSaveNow?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  gameState,
  updateGameState,
  onSignOut,
  lastSavedAt,
  lastWriteError,
  onSaveNow,
}) => {
  const defaultStatus = {
    isWinner: false,
    isFirstOut: false,
    isTraitor: false,
    isEliminated: false,
    portraitUrl: null,
  };
  const [pasteContent, setPasteContent] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerEntry | null>(null);
  const [isManagingTome, setIsManagingTome] = useState(false);

  const parseAndAdd = () => {
    try {
      if (!pasteContent.trim()) throw new Error("The scroll is empty.");

      const lines = pasteContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      let playerName = "";
      let playerEmail = "";
      let picks: DraftPick[] = [];
      let predFirstOut = "";
      let predWinner = "";
      let predTraitors: string[] = [];
      let weeklyBanished = "";
      let weeklyMurdered = "";
      
      let inTraitorSection = false;

      lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.startsWith("player:") || lowerLine.includes("name:")) {
          playerName = line.split(/[:\-]/)[1]?.trim() || "";
        }
        if (lowerLine.startsWith("email:")) {
          playerEmail = line.split(/[:\-]/)[1]?.trim() || "";
        }
        
        if (lowerLine.includes("pick") && (lowerLine.includes("#") || lowerLine.includes(":"))) {
          let content = line.replace(/pick\s*#?\d+[:\s]*/i, "").trim();
          const parts = content.split(/[|]/);
          const namePart = parts[0]?.trim() || "";
          
          let rank = 1;
          const rankMatch = line.match(/rank:\s*(\d+)/i);
          if (rankMatch) {
            rank = parseInt(rankMatch[1]);
          } else {
            const numbers = line.match(/\d+/g);
            if (numbers && numbers.length > 1) rank = parseInt(numbers[1]);
          }

          let role: 'Faithful' | 'Traitor' = 'Faithful';
          if (lowerLine.includes("traitor") && !lowerLine.includes("faithful")) role = 'Traitor';

          const matchedName = CAST_NAMES.find(c => namePart.includes(c) || c.includes(namePart));
          if (matchedName) {
            picks.push({ member: matchedName, rank, role });
          }
        }

        if (lowerLine.includes("first eliminated:") || lowerLine.includes("first out:")) {
          const val = line.split(":")[1]?.trim() || "";
          predFirstOut = CAST_NAMES.find(c => val.includes(c)) || val;
        }
        if (lowerLine.includes("winner pick:") || lowerLine.includes("sole winner:") || lowerLine.includes("winner:")) {
          const val = line.split(":")[1]?.trim() || "";
          predWinner = CAST_NAMES.find(c => val.includes(c)) || val;
        }

        if (lowerLine.includes("next banished:")) {
          const val = line.split(":")[1]?.trim() || "";
          weeklyBanished = CAST_NAMES.find(c => val.includes(c)) || val;
        }
        if (lowerLine.includes("next murdered:")) {
          const val = line.split(":")[1]?.trim() || "";
          weeklyMurdered = CAST_NAMES.find(c => val.includes(c)) || val;
        }

        if (lowerLine.includes("traitor guesses") || lowerLine.includes("traitor suspects") || lowerLine.includes("the traitors")) {
          inTraitorSection = true;
        } else if (inTraitorSection) {
          const cleanedLine = line.replace(/^\d+[\.\)]/, "").replace(/^[-•*]/, "").trim();
          const matchedTraitor = CAST_NAMES.find(c => cleanedLine.includes(c));
          if (matchedTraitor && predTraitors.length < 3) {
            predTraitors.push(matchedTraitor);
          }
          if (lowerLine.includes("===") || lowerLine.includes("---")) inTraitorSection = false;
        }
      });

      if (!playerName) throw new Error("The Tome is missing a Player Name.");
      if (picks.length === 0) throw new Error("No recognizable Draft Squad members found.");

      const newPlayer: PlayerEntry = {
        id: Date.now().toString(),
        name: playerName,
        email: playerEmail,
        picks,
        predFirstOut,
        predWinner,
        predTraitors,
        weeklyPredictions: {
          nextBanished: weeklyBanished,
          nextMurdered: weeklyMurdered,
        },
      };

      const updatedPlayers = [...gameState.players.filter(p => p.name.toLowerCase() !== playerName.toLowerCase()), newPlayer];
      updateGameState({ ...gameState, players: updatedPlayers });
      
      setMsg({ text: `Ritual Complete: ${playerName}'s entry has been inscribed.`, type: 'success' });
      setPasteContent('');
    } catch (e: any) {
      setMsg({ text: `Parsing Error: ${e.message}`, type: 'error' });
    }
  };

  const updateCastMember = (name: string, field: string, value: any) => {
    const updatedStatus = { ...gameState.castStatus };
    const currentStatus = updatedStatus[name] ?? defaultStatus;
    updatedStatus[name] = { ...currentStatus, [field]: value };
    if (field === 'isFirstOut' && value === true) updatedStatus[name].isWinner = false;
    if (field === 'isWinner' && value === true) updatedStatus[name].isFirstOut = false;
    updateGameState({ ...gameState, castStatus: updatedStatus });
  };

  const updatePlayerAvatar = (playerId: string, url: string) => {
    const updatedPlayers = gameState.players.map(p => 
      p.id === playerId ? { ...p, portraitUrl: url } : p
    );
    updateGameState({ ...gameState, players: updatedPlayers });
    if (selectedPlayer?.id === playerId) {
      setSelectedPlayer(prev => prev ? { ...prev, portraitUrl: url } : null);
    }
  };

  const setCastPortrait = (name: string) => {
    const current = gameState.castStatus[name]?.portraitUrl || "";
    const url = prompt("Enter image URL for cast portrait:", current);
    if (url === null) return;
    const trimmed = url.trim();
    updateCastMember(name, 'portraitUrl', trimmed ? trimmed : null);
  };

  const clearAllPortraits = () => {
    if (!confirm("Remove all stored portraits?")) return;
    const updatedStatus = { ...gameState.castStatus };
    Object.keys(updatedStatus).forEach((name) => {
      updatedStatus[name] = { ...updatedStatus[name], portraitUrl: null };
    });
    const updatedPlayers = gameState.players.map((p) => ({
      ...p,
      portraitUrl: null,
    }));
    updateGameState({ ...gameState, castStatus: updatedStatus, players: updatedPlayers });
    setMsg({ text: "All portraits removed.", type: 'success' });
  };


  const downloadGameState = () => {
    const payload = JSON.stringify(gameState, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `traitors-game-state-${new Date().toISOString().slice(0, 19)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleTomeImport = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const data = JSON.parse(e.target.value);
      if (data.players && data.castStatus) {
        updateGameState(data);
        setMsg({ text: "Database fully restored from Tome.", type: 'success' });
      }
    } catch (err) {
      setMsg({ text: "Invalid Tome format.", type: 'error' });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl gothic-font text-[color:var(--accent)]">Admin Console</h2>
        <div className="flex gap-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] self-center">
            {lastWriteError
              ? `Save failed: ${lastWriteError}`
              : lastSavedAt
              ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
              : "Not saved yet"}
          </div>
          {onSaveNow && (
            <button
              onClick={onSaveNow}
              className="px-4 py-2 bg-black/60 text-[10px] text-zinc-200 rounded-full border border-[color:var(--accent)]/40 uppercase font-semibold tracking-[0.2em] hover:bg-[color:var(--accent)] hover:text-black transition-all"
            >
              Save Now
            </button>
          )}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="px-4 py-2 bg-black/60 text-[10px] text-red-200 rounded-full border border-red-900/60 uppercase font-semibold tracking-[0.2em] hover:bg-red-900/40 transition-all"
            >
              Sign Out
            </button>
          )}
          <button 
            onClick={() => setIsManagingTome(!isManagingTome)}
            className="px-4 py-2 bg-black/50 text-[10px] text-zinc-300 rounded-full border border-zinc-700 uppercase font-semibold tracking-[0.2em] hover:text-white transition-all"
          >
            {isManagingTome ? "Close Database Tools" : "Open Database Tools"}
          </button>
          <button
            onClick={clearAllPortraits}
            className="px-4 py-2 bg-black/50 text-[10px] text-red-200 rounded-full border border-red-900/60 uppercase font-semibold tracking-[0.2em] hover:bg-red-900/40 transition-all"
          >
            Clear Portraits
          </button>
          <button
            onClick={downloadGameState}
            className="px-4 py-2 bg-black/50 text-[10px] text-zinc-200 rounded-full border border-[color:var(--accent)]/40 uppercase font-semibold tracking-[0.2em] hover:bg-[color:var(--accent)] hover:text-black transition-all"
          >
            Download JSON
          </button>
        </div>
      </div>

      {isManagingTome && (
        <div className="glass-panel p-6 rounded-2xl animate-in slide-in-from-top-4">
          <h3 className="text-[color:var(--accent)] gothic-font mb-2 uppercase text-sm">Data Import (JSON)</h3>
          <textarea 
            className="w-full h-32 bg-zinc-950 text-[10px] font-mono p-4 border border-zinc-800 rounded text-zinc-400 focus:border-[#D4AF37] outline-none"
            defaultValue={JSON.stringify(gameState, null, 2)}
            onChange={handleTomeImport}
            placeholder="Paste JSON Tome here to overwrite database..."
          />
        </div>
      )}

      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-lg gothic-font text-[color:var(--accent)] mb-4 uppercase tracking-[0.2em]">Weekly Results</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-red-400 font-semibold mb-1 uppercase tracking-[0.2em]">⚖️ Next Banished</label>
            <select
              value={gameState.weeklyResults?.nextBanished ?? ""}
              onChange={(e) =>
                updateGameState({
                  ...gameState,
                  weeklyResults: {
                    ...(gameState.weeklyResults ?? {}),
                    nextBanished: e.target.value,
                  },
                })
              }
              className="w-full p-3 rounded bg-black border border-zinc-800 text-xs text-white"
            >
              <option value="">Select...</option>
              {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-fuchsia-400 font-semibold mb-1 uppercase tracking-[0.2em]">🗡️ Next Murdered</label>
            <select
              value={gameState.weeklyResults?.nextMurdered ?? ""}
              onChange={(e) =>
                updateGameState({
                  ...gameState,
                  weeklyResults: {
                    ...(gameState.weeklyResults ?? {}),
                    nextMurdered: e.target.value,
                  },
                })
              }
              className="w-full p-3 rounded bg-black border border-zinc-800 text-xs text-white"
            >
              <option value="">Select...</option>
              {CAST_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mt-3">Used to score weekly council picks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-xl gothic-font text-[color:var(--accent)] mb-4">League Roster</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {gameState.players.map(player => (
              <div 
                key={player.id} 
                className={`flex justify-between items-center p-3 rounded border transition-all cursor-pointer ${selectedPlayer?.id === player.id ? 'bg-[#D4AF37]/10 border-[#D4AF37]' : 'bg-black/40 border-zinc-800 hover:border-zinc-700'}`} 
                onClick={() => setSelectedPlayer(player)}
              >
                <div className="flex items-center gap-3">
                   <div className="w-2.5 h-2.5 rounded-full border border-[#D4AF37]/30 overflow-hidden bg-black flex-shrink-0 flex items-center justify-center">
                      {player.portraitUrl ? (
                        <img src={player.portraitUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-zinc-600 font-bold uppercase text-[7px]">{player.name.charAt(0)}</span>
                      )}
                   </div>
                   <div>
                    <p className="text-gray-100 font-bold text-sm">{player.name}</p>
                    <p className="text-[10px] text-gray-500">{player.email}</p>
                   </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    updateGameState({ ...gameState, players: gameState.players.filter(p => p.id !== player.id) });
                    if(selectedPlayer?.id === player.id) setSelectedPlayer(null);
                  }}
                  className="text-red-500 hover:bg-red-900/20 p-2 rounded text-xs"
                >
                  Delete
                </button>
              </div>
            ))}
            {gameState.players.length === 0 && <p className="text-gray-500 text-center py-4 text-xs">No entries yet.</p>}
          </div>
          
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <h4 className="text-xs font-semibold text-[color:var(--accent)] mb-2 uppercase tracking-[0.25em]">Add Player</h4>
            <textarea 
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              className="w-full h-24 bg-black border border-zinc-800 p-3 rounded text-[10px] font-mono text-zinc-400 focus:border-[#D4AF37] outline-none"
              placeholder="Paste submission text or spreadsheet rows here..."
            />
            <button onClick={parseAndAdd} className="w-full mt-2 py-2 bg-[color:var(--accent)] text-black text-xs font-bold rounded-full uppercase hover:bg-[color:var(--accent-strong)] transition-all">
              Add Player
            </button>
            {msg.text && (
              <div className={`mt-3 p-2 rounded text-center text-[10px] font-bold border ${msg.type === 'success' ? 'text-green-500 border-green-900/30 bg-green-900/10' : 'text-red-500 border-red-900/30 bg-red-900/10'}`}>
                {msg.text}
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl min-h-[400px]">
          {selectedPlayer ? (
            <div className="space-y-6">
              <div className="border-b border-zinc-800 pb-4 flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full border border-[#D4AF37] overflow-hidden bg-zinc-900 flex items-center justify-center">
                      {selectedPlayer.portraitUrl ? (
                        <img src={selectedPlayer.portraitUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[7px] text-zinc-700 font-bold uppercase">{selectedPlayer.name.charAt(0)}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl gothic-font text-[color:var(--accent)]">{selectedPlayer.name}</h3>
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => {
                          const url = prompt("Enter image URL for player avatar:", selectedPlayer.portraitUrl || "");
                          if (url !== null) updatePlayerAvatar(selectedPlayer.id, url);
                        }}
                        className="text-[9px] uppercase font-semibold text-zinc-500 border border-zinc-800 px-2 py-1 rounded-full hover:text-white transition-all"
                      >
                        Set URL
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="text-zinc-600 hover:text-white text-xl">&times;</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-red-900/10 border border-red-900/20 rounded">
                  <p className="text-[10px] text-red-400 font-bold uppercase mb-1">💀 1st Out</p>
                  <p className="text-sm text-white">{selectedPlayer.predFirstOut || 'None'}</p>
                </div>
                <div className="p-3 bg-yellow-900/10 border border-yellow-900/20 rounded">
                  <p className="text-[10px] text-yellow-400 font-bold uppercase mb-1">🏆 Winner</p>
                  <p className="text-sm text-white">{selectedPlayer.predWinner || 'None'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded">
                  <p className="text-[10px] text-red-400 font-bold uppercase mb-1">⚖️ Next Banished</p>
                  <p className="text-sm text-white">{selectedPlayer.weeklyPredictions?.nextBanished || 'None'}</p>
                </div>
                <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded">
                  <p className="text-[10px] text-fuchsia-300 font-bold uppercase mb-1">🗡️ Next Murdered</p>
                  <p className="text-sm text-white">{selectedPlayer.weeklyPredictions?.nextMurdered || 'None'}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-zinc-500 font-bold mb-3 uppercase tracking-widest border-b border-zinc-800 pb-1">Draft Squad</p>
                <div className="grid grid-cols-1 gap-2">
                  {selectedPlayer.picks.map((pick, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2 bg-zinc-900/40 border border-zinc-800 rounded">
                      <span className="text-zinc-500 font-bold w-6">#{i+1}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-4 h-4 rounded-full overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[6px] text-zinc-600 font-bold uppercase">
                          {getCastPortraitSrc(pick.member, gameState.castStatus[pick.member]?.portraitUrl) ? (
                            <img src={getCastPortraitSrc(pick.member, gameState.castStatus[pick.member]?.portraitUrl)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            pick.member.charAt(0)
                          )}
                        </div>
                        <span className="text-zinc-200">{pick.member}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${pick.role === 'Traitor' ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>
                        {pick.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
               <div className="wax-seal mb-4">
                  <span className="gothic-font text-2xl text-[#b04a4a] font-black">T</span>
                </div>
               <p className="text-xs gothic-font uppercase tracking-[0.3em] text-[color:var(--accent)]">Select a player</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl mt-12">
        <h3 className="text-xl gothic-font text-[color:var(--accent)] mb-6">Cast Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {CAST_NAMES.map(name => {
            const status = gameState.castStatus[name] ?? defaultStatus;
            const portraitSrc = getCastPortraitSrc(name, status?.portraitUrl);
            const cardClass = status.isWinner
              ? "bg-black/75 border-lime-300/70 shadow-[0_0_24px_rgba(163,230,53,0.45)]"
              : status.isFirstOut
              ? "bg-black/75 border-amber-300/70 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
              : status.isEliminated
              ? "bg-black/80 border-red-600/70 shadow-[0_0_24px_rgba(239,68,68,0.45)]"
              : status.isTraitor
              ? "bg-black/80 border-fuchsia-400/70 shadow-[0_0_24px_rgba(232,121,249,0.45)]"
              : "bg-black/70 border-zinc-800";
            return (
              <div key={name} className={`p-4 rounded-2xl border space-y-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${cardClass}`}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCastPortrait(name)}
                    className="w-[22px] h-[22px] rounded-full overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0 relative group"
                    title="Set cast portrait"
                  >
                    {portraitSrc ? (
                      <img src={portraitSrc} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[7px] text-zinc-700 font-bold uppercase">
                        {name.charAt(0)}
                      </div>
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-white truncate">{name}</p>
                    <button
                      type="button"
                      onClick={() => setCastPortrait(name)}
                      className="text-[9px] uppercase font-semibold text-zinc-500 hover:text-zinc-200 transition-all"
                    >
                      Set Portrait
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => updateCastMember(name, 'isTraitor', !status?.isTraitor)}
                    className={`py-2 rounded-full text-[10px] font-semibold uppercase border transition-all flex items-center justify-center gap-1 ${
                      status?.isTraitor
                        ? 'bg-fuchsia-500 border-fuchsia-300 text-black ring-8 ring-fuchsia-300/80 shadow-[0_0_32px_rgba(232,121,249,0.95)] scale-[1.08]'
                        : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {status?.isTraitor && <span className="text-[10px]">✓</span>}
                    Traitor
                  </button>
                  <button 
                    onClick={() => updateCastMember(name, 'isEliminated', !status?.isEliminated)}
                    className={`py-2 rounded-full text-[10px] font-semibold uppercase border transition-all flex items-center justify-center gap-1 ${
                      status?.isEliminated
                        ? 'bg-sky-400 border-sky-300 text-black ring-8 ring-sky-300/80 shadow-[0_0_32px_rgba(56,189,248,0.95)] scale-[1.08]'
                        : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {status?.isEliminated && <span className="text-[10px]">✓</span>}
                    Eliminated
                  </button>
                  <button 
                    onClick={() => updateCastMember(name, 'isFirstOut', !status?.isFirstOut)}
                    className={`py-2 rounded-full text-[10px] font-semibold uppercase border transition-all flex items-center justify-center gap-1 ${
                      status?.isFirstOut
                        ? 'bg-orange-400 border-orange-300 text-black ring-8 ring-orange-300/80 shadow-[0_0_32px_rgba(251,146,60,0.95)] scale-[1.08]'
                        : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {status?.isFirstOut && <span className="text-[10px]">✓</span>}
                    1st Out
                  </button>
                  <button 
                    onClick={() => updateCastMember(name, 'isWinner', !status?.isWinner)}
                    className={`py-2 rounded-full text-[10px] font-semibold uppercase border transition-all flex items-center justify-center gap-1 ${
                      status?.isWinner
                        ? 'bg-lime-300 border-lime-200 text-black ring-8 ring-lime-200/80 shadow-[0_0_32px_rgba(163,230,53,0.95)] scale-[1.08]'
                        : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {status?.isWinner && <span className="text-[10px]">✓</span>}
                    Winner
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
