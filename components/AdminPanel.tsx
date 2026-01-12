
import React, { useState } from 'react';
import { GameState, CAST_NAMES, PlayerEntry, DraftPick } from '../types';
import { generateTraitorImage } from '../services/gemini';

interface AdminPanelProps {
  gameState: GameState;
  updateGameState: (state: GameState) => void;
  onSignOut?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  gameState,
  updateGameState,
  onSignOut,
}) => {
  const [pasteContent, setPasteContent] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerEntry | null>(null);
  const [isManagingTome, setIsManagingTome] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isGeneratingPlayer, setIsGeneratingPlayer] = useState(false);

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
        predTraitors
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
    updatedStatus[name] = { ...updatedStatus[name], [field]: value };
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

  const handleGeneratePortrait = async (name: string) => {
    setIsGenerating(name);
    try {
      const imageUrl = await generateTraitorImage(name, '1K');
      if (imageUrl) {
        updateCastMember(name, 'portraitUrl', imageUrl);
        setMsg({ text: `Portrait of ${name} revealed.`, type: 'success' });
      }
    } catch (err) {
      setMsg({ text: "The shadows refused to reveal a portrait.", type: 'error' });
    } finally {
      setIsGenerating(null);
    }
  };

  const handleGeneratePlayerAvatar = async () => {
    if (!selectedPlayer) return;
    setIsGeneratingPlayer(true);
    try {
      const prompt = `A mysterious fantasy character avatar for player named ${selectedPlayer.name}, dark academic aesthetic, high fashion cloak, moody lighting, the traitors tv show style.`;
      const imageUrl = await generateTraitorImage(prompt, '1K');
      if (imageUrl) {
        updatePlayerAvatar(selectedPlayer.id, imageUrl);
        setMsg({ text: `Avatar for ${selectedPlayer.name} summoned.`, type: 'success' });
      }
    } catch (err) {
      setMsg({ text: "Could not summon player avatar.", type: 'error' });
    } finally {
      setIsGeneratingPlayer(false);
    }
  };

  const handleGenerateAllPortraits = async () => {
    if (!confirm("This will summon portraits for the entire cast. Continue?")) return;
    setMsg({ text: "Invoking portraits for the assembly...", type: 'success' });
    for (const name of CAST_NAMES) {
      if (!(gameState.castStatus[name] as any)?.portraitUrl) {
        await handleGeneratePortrait(name);
      }
    }
    setMsg({ text: "The gallery is complete.", type: 'success' });
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
        <h2 className="text-3xl gothic-font text-[#D4AF37]">Management Vault</h2>
        <div className="flex gap-2">
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="px-4 py-2 bg-zinc-900 text-[10px] text-red-300 rounded border border-red-900 uppercase font-bold tracking-widest hover:bg-red-900/50 transition-all"
            >
              Sign Out
            </button>
          )}
          <button 
            onClick={handleGenerateAllPortraits}
            className="px-4 py-2 bg-zinc-900 text-[10px] text-[#D4AF37] rounded border border-[#D4AF37]/30 uppercase font-bold tracking-widest hover:bg-[#D4AF37] hover:text-black transition-all"
          >
            🎨 Summon All Cast Portraits
          </button>
          <button 
            onClick={() => setIsManagingTome(!isManagingTome)}
            className="px-4 py-2 bg-zinc-800 text-[10px] text-zinc-400 rounded border border-zinc-700 uppercase font-bold tracking-widest hover:text-[#D4AF37] transition-all"
          >
            {isManagingTome ? "Close Database Tools" : "Open Database Tools"}
          </button>
        </div>
      </div>

      {isManagingTome && (
        <div className="bg-black border-2 border-[#D4AF37]/50 p-6 rounded-lg animate-in slide-in-from-top-4">
          <h3 className="text-[#D4AF37] gothic-font mb-2 uppercase text-sm">The Tome of Secrets (JSON)</h3>
          <textarea 
            className="w-full h-32 bg-zinc-950 text-[10px] font-mono p-4 border border-zinc-800 rounded text-zinc-400 focus:border-[#D4AF37] outline-none"
            defaultValue={JSON.stringify(gameState, null, 2)}
            onChange={handleTomeImport}
            placeholder="Paste JSON Tome here to overwrite database..."
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-zinc-900/80 p-6 rounded-xl border border-zinc-800">
          <h3 className="text-xl gothic-font text-[#D4AF37] mb-4">League Roster</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {gameState.players.map(player => (
              <div 
                key={player.id} 
                className={`flex justify-between items-center p-3 rounded border transition-all cursor-pointer ${selectedPlayer?.id === player.id ? 'bg-[#D4AF37]/10 border-[#D4AF37]' : 'bg-black/40 border-zinc-800 hover:border-zinc-700'}`} 
                onClick={() => setSelectedPlayer(player)}
              >
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full border border-[#D4AF37]/30 overflow-hidden bg-black flex-shrink-0 flex items-center justify-center">
                      {player.portraitUrl ? (
                        <img src={player.portraitUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-zinc-600 font-bold uppercase text-xs">{player.name.charAt(0)}</span>
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
            {gameState.players.length === 0 && <p className="text-gray-500 italic text-center py-4 text-xs">No entries in the vault.</p>}
          </div>
          
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <h4 className="text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">Identify New Player</h4>
            <textarea 
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              className="w-full h-24 bg-black border border-zinc-800 p-3 rounded text-[10px] font-mono text-zinc-400 focus:border-[#D4AF37] outline-none"
              placeholder="Paste submission text or spreadsheet rows here..."
            />
            <button onClick={parseAndAdd} className="w-full mt-2 py-2 bg-[#D4AF37] text-black text-xs font-black rounded uppercase hover:bg-yellow-600 transition-all">
              Identify & Add Player
            </button>
            {msg.text && (
              <div className={`mt-3 p-2 rounded text-center text-[10px] font-bold border ${msg.type === 'success' ? 'text-green-500 border-green-900/30 bg-green-900/10' : 'text-red-500 border-red-900/30 bg-red-900/10'}`}>
                {msg.text}
              </div>
            )}
          </div>
        </div>

        <div className="bg-black/80 p-6 rounded-xl border border-[#D4AF37] min-h-[400px]">
          {selectedPlayer ? (
            <div className="space-y-6">
              <div className="border-b border-zinc-800 pb-4 flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-2 border-[#D4AF37] overflow-hidden bg-zinc-900 flex items-center justify-center">
                      {selectedPlayer.portraitUrl ? (
                        <img src={selectedPlayer.portraitUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl text-zinc-700 font-bold uppercase">{selectedPlayer.name.charAt(0)}</span>
                      )}
                    </div>
                    {isGeneratingPlayer && (
                      <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl gothic-font text-[#D4AF37]">{selectedPlayer.name}</h3>
                    <div className="flex gap-2 mt-2">
                      <button 
                        disabled={isGeneratingPlayer}
                        onClick={handleGeneratePlayerAvatar}
                        className="text-[9px] uppercase font-bold text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-1 rounded hover:bg-[#D4AF37] hover:text-black transition-all"
                      >
                        {isGeneratingPlayer ? 'Summoning...' : 'Summon Avatar'}
                      </button>
                      <button 
                        onClick={() => {
                          const url = prompt("Enter image URL for player avatar:", selectedPlayer.portraitUrl || "");
                          if (url !== null) updatePlayerAvatar(selectedPlayer.id, url);
                        }}
                        className="text-[9px] uppercase font-bold text-zinc-500 border border-zinc-800 px-2 py-1 rounded hover:text-white transition-all"
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

              <div>
                <p className="text-[11px] text-zinc-500 font-bold mb-3 uppercase tracking-widest border-b border-zinc-800 pb-1">Draft Squad</p>
                <div className="grid grid-cols-1 gap-2">
                  {selectedPlayer.picks.map((pick, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2 bg-zinc-900/40 border border-zinc-800 rounded">
                      <span className="text-zinc-500 font-bold w-6">#{i+1}</span>
                      <span className="flex-1 text-zinc-200">{pick.member}</span>
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
               <p className="text-xs gothic-font uppercase tracking-widest text-[#D4AF37]">Select a Player to Reveal their Fate</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-900/80 p-6 rounded-xl border border-zinc-800 mt-12">
        <h3 className="text-xl gothic-font text-[#D4AF37] mb-6">Cast Status Control</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {CAST_NAMES.map(name => {
            const status = gameState.castStatus[name];
            return (
              <div key={name} className="bg-black/40 p-4 rounded border border-zinc-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0 relative group">
                    {status?.portraitUrl ? (
                      <img src={status.portraitUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-700 font-bold uppercase">
                        {name.charAt(0)}
                      </div>
                    )}
                    {isGenerating === name && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-white truncate">{name}</p>
                    <button 
                      onClick={() => handleGeneratePortrait(name)}
                      className="text-[8px] uppercase font-bold text-[#D4AF37] hover:underline"
                    >
                      {status?.portraitUrl ? 'Regenerate' : 'Summon Portrait'}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => updateCastMember(name, 'isTraitor', !status?.isTraitor)}
                    className={`py-1 rounded text-[9px] font-bold uppercase border transition-all ${status?.isTraitor ? 'bg-red-900 border-red-700 text-white' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
                  >
                    Traitor
                  </button>
                  <button 
                    onClick={() => updateCastMember(name, 'isEliminated', !status?.isEliminated)}
                    className={`py-1 rounded text-[9px] font-bold uppercase border transition-all ${status?.isEliminated ? 'bg-zinc-700 border-zinc-600 text-white' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
                  >
                    Eliminated
                  </button>
                  <button 
                    onClick={() => updateCastMember(name, 'isFirstOut', !status?.isFirstOut)}
                    className={`py-1 rounded text-[9px] font-bold uppercase border transition-all ${status?.isFirstOut ? 'bg-orange-900 border-orange-700 text-white' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
                  >
                    1st Out
                  </button>
                  <button 
                    onClick={() => updateCastMember(name, 'isWinner', !status?.isWinner)}
                    className={`py-1 rounded text-[9px] font-bold uppercase border transition-all ${status?.isWinner ? 'bg-yellow-600 border-yellow-500 text-black' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
                  >
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
