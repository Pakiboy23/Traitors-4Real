
import React, { useState, useRef, useEffect } from 'react';
import { streamAsk, generateTraitorImage, speakText, getApiKey, setApiKey } from '../services/gemini';
import { CAST_NAMES, GameState } from '../types';
import { getCastPortraitSrc } from "../src/castPortraits";

interface ChatInterfaceProps {
  gameState: GameState;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ gameState }) => {
  const [messages, setMessages] = useState<{id?: string, role: string, content: string, type?: 'text'|'image'}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [apiKey, setApiKeyState] = useState(getApiKey() || "");
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const hasEnvKey = !!import.meta.env.VITE_GEMINI_API_KEY;
  const hasProxy = !!import.meta.env.VITE_AI_ENDPOINT;
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const findCastMentions = (text: string) => {
    const haystack = text.toLowerCase();
    return CAST_NAMES.filter((name) => haystack.includes(name.toLowerCase()));
  };

  const getSafeImageHref = (url: string) => {
    const trimmed = (url || '').trim();
    if (!trimmed) return '#';
    if (trimmed.startsWith('/')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return '#';
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    
    setMessages(prev => [...prev, { role: 'user', content: userMsg, type: 'text' }]);
    setInput('');
    setLoading(true);
    setStreaming(false);
    abortRef.current?.abort();
    abortRef.current = null;

    try {
      if (!getApiKey() && !hasEnvKey && !hasProxy) { throw new Error("Missing API key. Paste it above and click Save Key."); }
      if (userMsg.toLowerCase().startsWith('/image')) {
        const prompt = userMsg.substring(6).trim() || "A mysterious traitor lurking in the castle shadows";
        const imageUrl = await generateTraitorImage(prompt, imageSize);
        
        if (imageUrl) {
          setMessages(prev => [...prev, { role: 'ai', content: imageUrl, type: 'image' }]);
        } else {
          setMessages(prev => [...prev, { role: 'ai', content: "The shadows did not yield an image. Try a different prompt.", type: 'text' }]);
        }
      } else {
        const aiId = crypto.randomUUID();
        setMessages(prev => [...prev, { role: 'ai', content: '', type: 'text', id: aiId }]);

        const controller = new AbortController();
        abortRef.current = controller;
        setStreaming(true);

        try {
          const full = await streamAsk(
            userMsg,
            (token) => {
              setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: (m.content || '') + token } : m));
            },
            controller.signal
          );

          if (!full) {
            setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: 'The Game Master remains silent...' } : m));
          }
        } finally {
          setStreaming(false);
          abortRef.current = null;
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'ai', content: "The ritual was halted mid-omen.", type: 'text' }]);
      } else {
        console.error(err);
        setMessages(prev => [...prev, { role: 'ai', content: "The ritual was interrupted. (API Error)", type: 'text' }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[75vh] glass-panel rounded-2xl overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-zinc-800/80 bg-black/40 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="gothic-font text-[color:var(--accent)] text-xl">The Cloistered Room</h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-[0.25em]">Strategy + Image prompts</p>
        </div>
        {!hasEnvKey && !hasProxy && (
          <div className="flex items-center gap-2">
            <input
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              placeholder="Gemini API key"
              className="p-2 text-xs rounded bg-black border border-zinc-800 text-white outline-none focus:border-[color:var(--accent)]"
            />
            <button
              onClick={() => setApiKey(apiKey)}
              className="px-3 py-2 text-xs font-semibold rounded-full bg-[color:var(--accent)] text-black"
            >
              Save
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-[0.2em]">Resolution</span>
          <div className="flex bg-black/60 p-1 rounded-full border border-zinc-800">
            {(['1K', '2K', '4K'] as const).map(size => (
              <button 
                key={size}
                onClick={() => setImageSize(size)}
                className={`px-3 py-1 text-[10px] rounded-full font-semibold transition-all ${imageSize === size ? 'bg-[color:var(--accent)] text-black' : 'text-zinc-500 hover:text-white'}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <div className="wax-seal scale-150">
              <span className="gothic-font text-2xl text-[#b04a4a] font-black">T</span>
            </div>
            <div className="gothic-font">
              <p className="text-lg">Ask a question</p>
              <p className="text-sm mt-2">Use <span className="text-[color:var(--accent)]">/image [prompt]</span> for portraits</p>
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const castMentions = m.type === 'text' ? findCastMentions(m.content) : [];
          return (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] p-4 rounded-xl shadow-lg border ${
              m.role === 'user' 
                ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-medium' 
                : 'bg-zinc-900 text-zinc-100 border-zinc-800'
            }`}>
              {m.type === 'image' ? (
                <div className="space-y-3">
                  <div className="relative group w-2.5 h-2.5 mx-auto">
                    <img src={getSafeImageHref(m.content)} alt="AI Prophecy" className="w-2.5 h-2.5 rounded-full object-cover border border-black shadow-inner" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                       <a href={getSafeImageHref(m.content)} download="traitor_prophecy.png" className="text-white text-xs underline gothic-font">Download Prophecy</a>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 italic text-center uppercase tracking-widest">A visual from the shadows ({imageSize})</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  {castMentions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/70">
                      {castMentions.map((name) => {
                        const portrait = getCastPortraitSrc(
                          name,
                          gameState.castStatus[name]?.portraitUrl
                        );
                        return (
                          <div key={name} className="flex items-center gap-2 rounded-full border border-zinc-800 px-2 py-1 bg-black/30">
                            <div className="w-3 h-3 rounded-full overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[6px] text-zinc-600 font-bold uppercase">
                              {portrait ? (
                                <img src={portrait} alt="" className="w-full h-full object-cover" />
                              ) : (
                                name.charAt(0)
                              )}
                            </div>
                            <span className="text-[10px] uppercase tracking-wide text-zinc-400">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {m.role === 'ai' && (
                    <button 
                      onClick={() => speakText(m.content)}
                      className="flex items-center gap-2 text-[10px] uppercase font-bold text-zinc-200 hover:text-white transition-colors pt-2 border-t border-zinc-800 w-full"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
                      </svg>
                      Hear the Game Master
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )})}
        
        {loading && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                <div className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
              </div>
              <span className="text-[10px] text-zinc-200 gothic-font uppercase tracking-[0.2em]">
                {streaming ? 'Translating omens...' : 'Consulting the Round Table...'}
              </span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-950 border-t border-[#D4AF37]/30">
        <div className="flex gap-3">
          <input 
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask for strategy or type /image..."
            className="flex-1 p-3 rounded-lg bg-black border border-zinc-800 text-white outline-none focus:border-[#D4AF37] transition-colors placeholder-zinc-700 font-medium"
          />
          <button 
            disabled={loading}
            onClick={handleSend}
            className={`px-8 py-3 bg-[#D4AF37] text-black font-black rounded-lg uppercase tracking-widest transition-all ${
              loading ? 'opacity-50 cursor-not-allowed scale-95' : 'hover:bg-[#b5952f] hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] active:scale-95'
            }`}
          >
            Send
          </button>
          {streaming && (
            <button
              onClick={handleCancel}
              className="px-4 py-3 bg-zinc-900 border border-zinc-800 text-[11px] uppercase rounded-lg font-semibold hover:border-[#D4AF37] transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        <div className="flex justify-between items-center mt-3">
          <p className="text-[9px] text-zinc-600 uppercase tracking-tighter">
            PROMPT: <span className="text-zinc-400">/image [description]</span> for high-quality portraits
          </p>
          <p className="text-[9px] text-zinc-600 italic">Trust No One.</p>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
