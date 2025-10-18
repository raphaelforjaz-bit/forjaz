// api/patients.js — Serverless Function (Vercel + Firebase Admin)

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Variáveis FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY não configuradas no Vercel.');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { id, data } = req.body || {};

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ ok: false, error: 'Payload inválido' });
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const patientsCollection = db.collection('patients');

    if (id) {
      await patientsCollection.doc(String(id)).set(data, { merge: true });
    } else {
      await patientsCollection.add(data);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Erro /api/patients:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
