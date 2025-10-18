// api/patients.js — Vercel Serverless Function (CommonJS)
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('Faltam variáveis FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY no Vercel (Production).');
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Lê o corpo JSON de uma Serverless Function “pura” (sem Next)
async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const str = Buffer.concat(chunks).toString() || '{}';
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { id, data } = await readJson(req);

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Payload inválido' });
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const col = db.collection('patients');

    if (id) {
      await col.doc(String(id)).set(data, { merge: true });
    } else {
      await col.add(data);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('API /api/patients error:', e);
    return res.status(500).json({ ok: false, error: e.message || 'Erro interno' });
  }
};
