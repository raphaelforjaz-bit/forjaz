// api/patients.js — Vercel Serverless (Firebase Admin + Firestore)
// Aceita credenciais via:
// 1) FIREBASE_SERVICE_ACCOUNT (JSON cru ou base64 do JSON), OU
// 2) FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
//    (private_key pode ser multilinha real OU com "\n")

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ----- util: normaliza private_key em qualquer formato -----
function normalizePrivateKey(input = '') {
  if (!input) return '';
  let k = String(input).trim();

  // remove aspas acidentais do começo/fim
  k = k.replace(/^"|"$/g, '');

  // se vier com \r\n, \n (escapeados), converte para quebra real
  if (k.includes('\\n')) k = k.replace(/\\n/g, '\n');
  if (k.includes('\\r')) k = k.replace(/\\r/g, '\r');

  // remove espaços extras ao redor dos delimitadores (evita "Invalid PEM")
  k = k.replace(/-+\s*BEGIN\s+PRIVATE\s+KEY\s*-+/i, '-----BEGIN PRIVATE KEY-----');
  k = k.replace(/-+\s*END\s+PRIVATE\s+KEY\s*-+/i, '-----END PRIVATE KEY-----');

  return k;
}

// ----- carrega credencial a partir dos ENVs -----
function loadServiceAccountFromEnv() {
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (svc) {
    // Pode ser JSON cru ou base64 do JSON
    let jsonText = svc.trim();
    if (!jsonText.startsWith('{')) {
      try {
        jsonText = Buffer.from(jsonText, 'base64').toString('utf8');
      } catch (e) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT base64 inválido.');
      }
    }
    let obj;
    try {
      obj = JSON.parse(jsonText);
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT JSON inválido.');
    }
    if (!obj.project_id || !obj.client_email || !obj.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT sem campos necessários (project_id, client_email, private_key).');
    }
    obj.private_key = normalizePrivateKey(obj.private_key);
    return {
      projectId: obj.project_id,
      clientEmail: obj.client_email,
      privateKey: obj.private_key,
    };
  }

  // fallback: variáveis separadas
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let   privateKey  = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Credenciais ausentes. Configure FIREBASE_SERVICE_ACCOUNT (JSON/base64) ' +
      'ou FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.'
    );
  }

  privateKey = normalizePrivateKey(privateKey);

  return { projectId, clientEmail, privateKey };
}

// ----- inicializa Admin (singleton) -----
function getDB() {
  if (!getApps().length) {
    const { projectId, clientEmail, privateKey } = loadServiceAccountFromEnv();
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

// ----- helpers de resposta -----
function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
}

// ----- handler -----
export default async function handler(req, res) {
  // CORS básico
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db  = getDB();
    const col = db.collection('patients');

    if (req.method === 'POST') {
      // Espera: { id?: string, data: object }
      const { id, data } = req.body || {};
      if (!data || typeof data !== 'object') {
        return json(res, 400, { ok: false, error: 'Payload inválido: "data" é obrigatório.' });
      }
      if (id) {
        await col.doc(String(id)).set(data, { merge: true });
        return json(res, 200, { ok: true, id: String(id) });
      } else {
        const ref = await col.add(data);
        return json(res, 200, { ok: true, id: ref.id });
      }
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return json(res, 400, { ok: false, error: 'Parâmetro "id" é obrigatório.' });
      const ref = col.doc(String(id));
      const snap = await ref.get();
      if (!snap.exists) return json(res, 404, { ok: false, error: 'Paciente não encontrado.' });
      await ref.delete();
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { ok: false, error: 'Método não permitido.' });
  } catch (err) {
    console.error('API /api/patients error:', err);
    return json(res, 500, { ok: false, error: (err && err.message) || 'Erro interno' });
  }
}
