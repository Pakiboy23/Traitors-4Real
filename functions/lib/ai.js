import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI, Modality } from "@google/genai";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";
import sharp from "sharp";
const MODEL_TEXT = "gemini-3-pro-preview";
const MODEL_IMAGE = "gemini-3-pro-image-preview";
const MODEL_TTS = "gemini-2.5-flash-preview-tts";
const ADMIN_EMAILS = ["s.haarisshariff@gmail.com"];
const CAST_NAMES = [
    "Candiace Dillard Bassett (RHOP)", "Caroline Stanbury (RHODubai)", "Dorinda Medley (RHONY)",
    "Lisa Rinna (RHOBH)", "Porsha Williams (RHOA)", "Maura Higgins (Love Island UK)",
    "Rob Rausch (Love Island USA)", "Rob Cesternino (Survivor)", "Yam Yam Arocho (Survivor)",
    "Natalie Anderson (Survivor/Amazing Race)", "Ian Terry (Big Brother)", "Tiffany Mitchell (Big Brother)",
    "Colton Underwood (The Bachelor)", "Johnny Weir (Olympian)", "Tara Lipinski (Olympian)",
    "Mark Ballas (DWTS)", "Kristen Kish (Top Chef)", "Eric Nam (Singer/Host)",
    "Monet X Change (Drag Race)", "Ron Funches (Comedian)", "Michael Rapaport (Actor)",
    "Stephen Colletti (One Tree Hill)", "Donna Kelce (Travis' Mom)"
].sort();
const adminApp = initializeAdminApp();
const adminDb = getFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const adminStorage = getStorage(adminApp);
const genAI = new GoogleGenAI({
    apiKey: process.env.GENAI_API_KEY || "",
});
const systemInstruction = `You are the 'Game Master' of the Titanic Swim Team's exclusive fantasy draft for 'The Traitors' Season 4.

Personality:
- Mysterious, dramatic, slightly devious.
- Speak with metaphors of shadows, scrolls, sealed fates.

Scoring Rules:
- Winner +10, 1st Out +5, Traitor ID +3, Penalty -2.`;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const EMULATOR_ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:4173", "http://localhost:3000"];
const getAllowedOrigins = () => {
    if (ALLOWED_ORIGINS.length)
        return ALLOWED_ORIGINS;
    if (process.env.FUNCTIONS_EMULATOR === "true")
        return EMULATOR_ALLOWED_ORIGINS;
    return [];
};
const allowCors = (req, res) => {
    const origin = req.headers?.origin;
    const allowedOrigins = getAllowedOrigins();
    if (origin) {
        if (!allowedOrigins.includes(origin)) {
            return false;
        }
        res.set("Access-Control-Allow-Origin", origin);
        res.set("Vary", "Origin");
    }
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    return true;
};
const requireAuth = async (req) => {
    const authHeader = req.headers?.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
        throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
};
const RATE_LIMITS = {
    ask: { key: "ask", limit: 60, windowSec: 60 },
    image: { key: "image", limit: 12, windowSec: 60 },
    speak: { key: "speak", limit: 20, windowSec: 60 },
};
export const ask = onRequest({ cors: false, secrets: ["GENAI_API_KEY"] }, async (req, res) => {
    if (!allowCors(req, res)) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
    }
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    let uid = "";
    try {
        uid = await requireAuth(req);
        await adminDb.runTransaction(async (tx) => {
            const cfg = RATE_LIMITS.ask;
            const window = Math.floor(Date.now() / 1000 / cfg.windowSec);
            const docId = `${uid}_${cfg.key}_${window}`;
            const ref = adminDb.collection("rateLimits").doc(docId);
            const snap = await tx.get(ref);
            const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
            if (count >= cfg.limit) {
                throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
            }
            tx.set(ref, { count: FieldValue.increment(1), uid, key: cfg.key, window }, { merge: true });
        });
    }
    catch (err) {
        const status = err instanceof HttpsError && err.code === "resource-exhausted" ? 429 : 401;
        res.status(status).json({ error: err?.message || "Unauthorized" });
        return;
    }
    const prompt = (req.body?.prompt || "").toString();
    if (!prompt) {
        res.status(400).json({ error: "Missing prompt" });
        return;
    }
    const stream = await genAI.models.generateContentStream({
        model: MODEL_TEXT,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { systemInstruction },
    });
    res.set("Content-Type", "text/event-stream");
    res.set("Cache-Control", "no-cache");
    try {
        for await (const chunk of stream) {
            const text = chunk.text ?? "";
            if (text)
                res.write(`data: ${text}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
    }
    catch (err) {
        console.error("ask stream failed", err);
        res.status(500).json({ error: err?.message || "AI error" });
    }
});
export const image = onRequest({ cors: false, secrets: ["GENAI_API_KEY"] }, async (req, res) => {
    if (!allowCors(req, res)) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
    }
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    try {
        const uid = await requireAuth(req);
        await adminDb.runTransaction(async (tx) => {
            const cfg = RATE_LIMITS.image;
            const window = Math.floor(Date.now() / 1000 / cfg.windowSec);
            const docId = `${uid}_${cfg.key}_${window}`;
            const ref = adminDb.collection("rateLimits").doc(docId);
            const snap = await tx.get(ref);
            const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
            if (count >= cfg.limit) {
                throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
            }
            tx.set(ref, { count: FieldValue.increment(1), uid, key: cfg.key, window }, { merge: true });
        });
    }
    catch (err) {
        const status = err instanceof HttpsError && err.code === "resource-exhausted" ? 429 : 401;
        res.status(status).json({ error: err?.message || "Unauthorized" });
        return;
    }
    const prompt = (req.body?.prompt || "").toString();
    const size = (req.body?.size || "1K").toString();
    if (!prompt) {
        res.status(400).json({ error: "Missing prompt" });
        return;
    }
    try {
        const response = await genAI.models.generateContent({
            model: MODEL_IMAGE,
            contents: {
                parts: [
                    {
                        text: `A cinematic, high-quality, moody portrait inspired by The Traitors TV show. A person in a hooded red cloak, dramatic lighting, gothic castle background. Theme: ${prompt}. Cinematic, hyper-realistic, 8k.`,
                    },
                ],
            },
            config: {
                imageConfig: { aspectRatio: "1:1", imageSize: size },
            },
        });
        const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        const inline = part?.inlineData;
        if (!inline?.data) {
            res.status(502).json({ error: "No image returned" });
            return;
        }
        const dataUrl = `data:${inline.mimeType || "image/png"};base64,${inline.data}`;
        res.json({ imageDataUrl: dataUrl });
    }
    catch (err) {
        console.error("image generation failed", err);
        res.status(500).json({ error: err?.message || "Image error" });
    }
});
export const speak = onRequest({ cors: false, secrets: ["GENAI_API_KEY"] }, async (req, res) => {
    if (!allowCors(req, res)) {
        res.status(403).json({ error: "Origin not allowed" });
        return;
    }
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    try {
        const uid = await requireAuth(req);
        await adminDb.runTransaction(async (tx) => {
            const cfg = RATE_LIMITS.speak;
            const window = Math.floor(Date.now() / 1000 / cfg.windowSec);
            const docId = `${uid}_${cfg.key}_${window}`;
            const ref = adminDb.collection("rateLimits").doc(docId);
            const snap = await tx.get(ref);
            const count = snap.exists ? Number(snap.data()?.count || 0) : 0;
            if (count >= cfg.limit) {
                throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
            }
            tx.set(ref, { count: FieldValue.increment(1), uid, key: cfg.key, window }, { merge: true });
        });
    }
    catch (err) {
        const status = err instanceof HttpsError && err.code === "resource-exhausted" ? 429 : 401;
        res.status(status).json({ error: err?.message || "Unauthorized" });
        return;
    }
    const text = (req.body?.text || "").toString();
    if (!text) {
        res.status(400).json({ error: "Missing text" });
        return;
    }
    try {
        const response = await genAI.models.generateContent({
            model: MODEL_TTS,
            contents: [{ parts: [{ text: `Say in a deep, mysterious, British accent: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
                },
            },
        });
        const inline = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
        if (!inline?.data) {
            res.status(502).json({ error: "No audio returned" });
            return;
        }
        const dataUrl = `data:${inline.mimeType || "audio/wav"};base64,${inline.data}`;
        res.json({ audioDataUrl: dataUrl });
    }
    catch (err) {
        console.error("speak failed", err);
        res.status(500).json({ error: err?.message || "TTS error" });
    }
});
const slugify = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
export const generateCastPortraits = onCall({ secrets: ["GENAI_API_KEY"], timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
    const email = request.auth?.token?.email;
    if (!email || !ADMIN_EMAILS.includes(String(email).toLowerCase())) {
        throw new HttpsError("permission-denied", "Admin access required.");
    }
    const force = Boolean(request.data?.force);
    const docRef = adminDb.collection("games").doc("default");
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new HttpsError("not-found", "Game state not found.");
    }
    const data = snap.data() || {};
    const state = data.state || {};
    const castStatus = { ...(state.castStatus || {}) };
    const bucket = adminStorage.bucket();
    let generated = 0;
    const skipped = [];
    for (const name of CAST_NAMES) {
        const current = castStatus[name]?.portraitUrl;
        if (current && !force) {
            skipped.push(name);
            continue;
        }
        const response = await genAI.models.generateContent({
            model: MODEL_IMAGE,
            contents: {
                parts: [
                    {
                        text: `A cinematic, high-quality portrait inspired by The Traitors. A moody, dramatic headshot in a gothic castle setting. Subject: ${name}. 1:1 aspect ratio, studio lighting, rich shadows.`,
                    },
                ],
            },
            config: {
                imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
            },
        });
        const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        const inline = part?.inlineData;
        if (!inline?.data) {
            throw new HttpsError("internal", `No image returned for ${name}.`);
        }
        const rawBuffer = Buffer.from(inline.data, "base64");
        const buffer = await sharp(rawBuffer).resize(64, 64).png().toBuffer();
        const file = bucket.file(`cast-portraits/${slugify(name)}.png`);
        const downloadToken = randomUUID();
        await file.save(buffer, {
            contentType: inline.mimeType || "image/png",
            metadata: {
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken,
                },
            },
        });
        const encodedPath = encodeURIComponent(file.name);
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
        castStatus[name] = { ...(castStatus[name] || {}), portraitUrl: url };
        generated += 1;
    }
    await docRef.set({ state: { ...state, castStatus }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return {
        generated,
        skipped,
        total: CAST_NAMES.length,
    };
});
export const ensureCastPortraits = onCall({ secrets: ["GENAI_API_KEY"], timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
    const email = request.auth?.token?.email;
    if (!email || !ADMIN_EMAILS.includes(String(email).toLowerCase())) {
        throw new HttpsError("permission-denied", "Admin access required.");
    }
    const docRef = adminDb.collection("games").doc("default");
    const lockWindowMs = 15 * 60 * 1000;
    const now = Date.now();
    const lockResult = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) {
            throw new HttpsError("not-found", "Game state not found.");
        }
        const data = snap.data() || {};
        const seededAt = data.portraitsSeededAt?.toMillis?.() || data.portraitsSeededAt;
        const seedingAt = data.portraitsSeedingAt?.toMillis?.() || data.portraitsSeedingAt;
        const isSeeded = Boolean(seededAt);
        const isLocked = Boolean(seedingAt && now - Number(seedingAt) < lockWindowMs);
        if (isSeeded) {
            return { status: "already_seeded" };
        }
        if (isLocked) {
            return { status: "in_progress" };
        }
        tx.set(docRef, { portraitsSeedingAt: now }, { merge: true });
        return { status: "locked" };
    });
    if (lockResult.status !== "locked") {
        return lockResult;
    }
    try {
        const snap = await docRef.get();
        const data = snap.data() || {};
        const state = data.state || {};
        const castStatus = { ...(state.castStatus || {}) };
        const bucket = adminStorage.bucket();
        let generated = 0;
        const skipped = [];
        const failed = [];
        for (const name of CAST_NAMES) {
            const current = castStatus[name]?.portraitUrl;
            if (current) {
                skipped.push(name);
                continue;
            }
            try {
                const response = await genAI.models.generateContent({
                    model: MODEL_IMAGE,
                    contents: {
                        parts: [
                            {
                                text: `A cinematic, high-quality portrait inspired by The Traitors. A moody, dramatic headshot in a gothic castle setting. Subject: ${name}. 1:1 aspect ratio, studio lighting, rich shadows.`,
                            },
                        ],
                    },
                    config: {
                        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
                    },
                });
                const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
                const inline = part?.inlineData;
                if (!inline?.data) {
                    throw new Error("No image data.");
                }
                const rawBuffer = Buffer.from(inline.data, "base64");
                const buffer = await sharp(rawBuffer).resize(64, 64).png().toBuffer();
                const downloadToken = randomUUID();
                const file = bucket.file(`cast-portraits/${slugify(name)}.png`);
                await file.save(buffer, {
                    contentType: inline.mimeType || "image/png",
                    metadata: {
                        metadata: {
                            firebaseStorageDownloadTokens: downloadToken,
                        },
                    },
                });
                const encodedPath = encodeURIComponent(file.name);
                const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
                castStatus[name] = { ...(castStatus[name] || {}), portraitUrl: url };
                generated += 1;
            }
            catch (err) {
                console.error("portrait generation failed", name, err);
                failed.push(name);
            }
        }
        const missingAfter = CAST_NAMES.filter((name) => !castStatus[name]?.portraitUrl);
        await docRef.set({
            state: { ...state, castStatus },
            portraitsSeededAt: missingAfter.length === 0 ? FieldValue.serverTimestamp() : null,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
            status: missingAfter.length === 0 ? "seeded" : "partial",
            generated,
            skipped,
            failed,
            missingAfter,
            total: CAST_NAMES.length,
        };
    }
    finally {
        await docRef.set({ portraitsSeedingAt: null }, { merge: true });
    }
});
