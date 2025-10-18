// api/patients.js — Vercel Serverless Function (CommonJS para sites estáticos)

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('⚠ Variáveis do Firebase não configuradas no Vercel (Production).');
  }

  // CONVERTE \n em quebras reais
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// Lê o corpo JSON ("payload") do request manualmente
async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString() || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  // Permite só POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Pega o corpo enviado
    const { id, data } = await readJson(req);

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Payload inválido' });
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const collection = db.collection('patients');

    // Se veio id → atualiza o doc / senão → cria novo
    if (id) {
      await collection.doc(String(id)).set(data, { merge: true });
    } else {
      await collection.add(data);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('❌ Erro API /patients:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro interno' });
  }
};
