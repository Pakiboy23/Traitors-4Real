import { GoogleGenAI, Modality } from "@google/genai";
import { auth } from "../src/lib/firebase";

const KEY_STORAGE = "gemini_api_key";
const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT;

export const getApiKey = () => localStorage.getItem(KEY_STORAGE);
export const setApiKey = (key: string) => localStorage.setItem(KEY_STORAGE, key.trim());
export const clearApiKey = () => localStorage.removeItem(KEY_STORAGE);

// Create a new instance right before making calls to ensure it uses the latest key.
const getAI = () => {
  const apiKey = ENV_API_KEY || getApiKey();
  if (!apiKey) {
    throw new Error("Missing Gemini API key. Set VITE_GEMINI_API_KEY or use the Chat tab.");
  }
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: any) => {
  const msg = typeof error?.message === "string" ? error.message : JSON.stringify(error);
  throw new Error(msg || "Unknown Gemini API error");
};

const parseSSE = (chunk: string, onData: (data: string) => void) => {
  const lines = chunk.split("\n");
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    onData(data);
  }
};

const getProxyHeaders = async () => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!AI_ENDPOINT) return headers;
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Sign in required to use AI features.");
  }
  const token = await user.getIdToken();
  headers.Authorization = `Bearer ${token}`;
  return headers;
};

export const streamAsk = async (
  prompt: string,
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  if (!AI_ENDPOINT) {
    const full = await askGemini(prompt, []);
    onToken(full);
    return full;
  }

  const res = await fetch(`${AI_ENDPOINT}/ask`, {
    method: "POST",
    headers: await getProxyHeaders(),
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error("AI service unavailable");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    parseSSE(chunk, (token) => {
      full += token;
      onToken(token);
    });
  }

  return full;
};

export const askGemini = async (prompt: string, history: { role: string; parts: any[] }[]) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are the 'Game Master' of the Titanic Swim Team's exclusive fantasy draft for 'The Traitors' Season 4.

Your personality:
- Mysterious, dramatic, and slightly devious.
- You speak with the authority of the castle, using metaphors of shadows, scrolls, and sealed fates.

Scoring Rules:
- Winner +10, 1st Out +5, Traitor ID +3, Penalty -2.`,
      },
    });
    return response.text;
  } catch (err) {
    return handleApiError(err);
  }
};

export const generateTraitorImage = async (prompt: string, size: "1K" | "2K" | "4K" = "1K") => {
  if (AI_ENDPOINT) {
    const res = await fetch(`${AI_ENDPOINT}/image`, {
      method: "POST",
      headers: await getProxyHeaders(),
      body: JSON.stringify({ prompt, size }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.imageDataUrl) return json.imageDataUrl as string;
    }
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          {
            text: `A cinematic, high-quality, moody portrait inspired by The Traitors TV show. A person in a hooded red cloak, dramatic lighting, gothic castle background. Theme: ${prompt}. Cinematic, hyper-realistic, 8k.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: size,
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if ((part as any).inlineData) {
          const base64EncodeString = (part as any).inlineData.data;
          const mimeType = (part as any).inlineData.mimeType || "image/png";
          return `data:${mimeType};base64,${base64EncodeString}`;
        }
      }
    }
  } catch (error) {
    console.error("Image generation ritual failed:", error);
    handleApiError(error);
  }
  return null;
};

export const speakText = async (text: string) => {
  if (AI_ENDPOINT) {
    const res = await fetch(`${AI_ENDPOINT}/speak`, {
      method: "POST",
      headers: await getProxyHeaders(),
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.audioDataUrl) {
        const audio = new Audio(json.audioDataUrl);
        audio.play();
        return;
      }
    }
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say in a deep, mysterious, British accent: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0] as any;
    const data = base64Audio?.inlineData?.data;
    if (data) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const decode = (base64: string) => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes;
      };

      const decodeAudioData = async (raw: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
        const dataInt16 = new Int16Array(raw.buffer);
        const frameCount = dataInt16.length / numChannels;
        const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
        for (let channel = 0; channel < numChannels; channel++) {
          const channelData = buffer.getChannelData(channel);
          for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
          }
        }
        return buffer;
      };

      const audioData = decode(data);
      const audioBuffer = await decodeAudioData(audioData, audioContext, 24000, 1);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    }
  } catch (err) {
    handleApiError(err);
  }
};
