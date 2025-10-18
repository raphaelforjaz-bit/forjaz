// api/patients.js — Vercel Serverless (Firebase Admin + Firestore)
// Suporta POST (criar/atualizar com merge) e DELETE (excluir documento)

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicializa Firebase Admin (singleton)
function getAdminDB() {
  if (!getApps().length) {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey    = process.env.FIREBASE_PRIVATE_KEY || '';

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Variáveis FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY ausentes.'
      );
    }

    // Normaliza privateKey: remove aspas acidentais e converte "\n" em quebras
    privateKey = privateKey.replace(/^"|"$/g, '');
    if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getFirestore();
}

function sendJSON(res, status, body) {
  res.status(status)
    .setHeader('Content-Type', 'application/json')
    .end(JSON.stringify(body));
}

export default async function handler(req, res) {
  // CORS simples
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const db = getAdminDB();
    const col = db.collection('patients');

    if (req.method === 'POST') {
      // Espera: { id?: string, data: object }
      const { id, data } = req.body || {};
      if (!data || typeof data !== 'object') {
        return sendJSON(res, 400, { ok: false, error: 'Payload inválido: "data" é obrigatório.' });
      }

      if (id) {
        // Atualiza/cria com merge no ID informado
        await col.doc(String(id)).set(data, { merge: true });
        return sendJSON(res, 200, { ok: true, id: String(id) });
      } else {
        // Cria novo doc sem ID custom (não é o fluxo do admin, mas suportado)
        const ref = await col.add(data);
        return sendJSON(res, 200, { ok: true, id: ref.id });
      }
    }

    if (req.method === 'DELETE') {
      // Espera: /api/patients?id=SEU_ID
      const { id } = req.query || {};
      if (!id) return sendJSON(res, 400, { ok: false, error: 'Parâmetro "id" é obrigatório.' });

      const docRef = col.doc(String(id));
      const snap = await docRef.get();
      if (!snap.exists) {
        return sendJSON(res, 404, { ok: false, error: 'Paciente não encontrado.' });
      }

      await docRef.delete();
      return sendJSON(res, 200, { ok: true });
    }

    return sendJSON(res, 405, { ok: false, error: 'Método não permitido.' });
  } catch (err) {
    console.error('API /api/patients error:', err);
    return sendJSON(res, 500, { ok: false, error: err?.message || 'Erro interno' });
  }
}
