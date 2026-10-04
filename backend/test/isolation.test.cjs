// Clinic isolation through the real HTTP server: a clinic never reaches another clinic's data.
// Runs against a separate database (DATABASE_URL with the name "<name>_test", or TEST_DATABASE_URL),
// wiped and migrated at the start. Skipped when no MySQL is reachable.  npm test
require('dotenv/config');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');

const base = process.env.TEST_DATABASE_URL || (process.env.DATABASE_URL || '').replace(/\/([^/?]+)(\?|$)/, '/$1_test$2');
const dbName = (base.match(/\/([^/?]+)(\?|$)/) || [])[1] || '';
let skip = !base ? 'DATABASE_URL absent' : !dbName.endsWith('_test') ? `base de test invalide (${dbName})` : false;

const ctx = {};

test.before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = base;
  process.env.MFA_REQUIRED = 'false';
  process.env.NODE_ENV = 'test';
  try {
    execSync('npx prisma migrate reset --force --skip-seed --skip-generate', { cwd: path.join(__dirname, '..'), env: process.env, stdio: 'pipe' });
  } catch (err) {
    skip = `MySQL indisponible : ${String(err.stderr || err.message).split('\n').find(Boolean)}`;
    return;
  }
  const { prisma } = require('../dist/src/config/prisma.js');
  const { hashPassword, sessionToken } = require('../dist/src/utils/auth.js');
  const app = require('../dist/src/app.js').default;
  ctx.prisma = prisma;

  const password = await hashPassword('Test1234!');
  const clinic = async (key) => {
    const cabinet = await prisma.cabinet.create({ data: { name: `Cabinet ${key}`, plan: 'PRO', subscriptionStatus: 'ACTIVE', isActive: true } });
    const owner = await prisma.user.create({ data: { email: `owner.${key}@test.ma`, password, firstName: 'Owner', lastName: key, role: 'OWNER', cabinetId: cabinet.id, seesAllPatients: true } });
    const assistant = await prisma.user.create({ data: { email: `assistant.${key}@test.ma`, password, firstName: 'Assistant', lastName: key, role: 'ASSISTANT', cabinetId: cabinet.id } });
    const patient = await prisma.patient.create({ data: { cabinetId: cabinet.id, firstName: 'Patient', lastName: key, allergies: `secret allergy ${key}` } });
    const appointment = await prisma.appointment.create({ data: { cabinetId: cabinet.id, practitionerId: owner.id, patientId: patient.id, date: new Date(Date.now() + 86400000) } });
    const consultation = await prisma.consultation.create({ data: { cabinetId: cabinet.id, patientId: patient.id, practitionerId: owner.id, diagnosis: `diagnosis ${key}` } });
    const invoice = await prisma.invoice.create({ data: { cabinetId: cabinet.id, patientId: patient.id, number: `F-${key}-1` } });
    return { cabinet, owner, assistant, patient, appointment, consultation, invoice, ownerToken: sessionToken(owner), assistantToken: sessionToken(assistant) };
  };
  ctx.a = await clinic('a');
  ctx.b = await clinic('b');
  const admin = await prisma.user.create({ data: { email: 'super@test.ma', password, firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN' } });
  ctx.superToken = sessionToken(admin);

  await new Promise(resolve => { ctx.server = app.listen(0, resolve); });
  ctx.url = `http://127.0.0.1:${ctx.server.address().port}/api`;
});

test.after(async () => {
  ctx.server?.close();
  await ctx.prisma?.$disconnect();
});

const call = async (method, url, token, body) => {
  const res = await fetch(ctx.url + url, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
};

/** Refused (403/404) and nothing of clinic B in the answer. */
const refused = (r, label) => {
  assert.ok([401, 403, 404].includes(r.status), `${label}: attendu un refus, reçu ${r.status} ${r.text.slice(0, 160)}`);
  assert.ok(!/ b"|secret allergy b|diagnosis b|F-b-1/.test(r.text), `${label}: fuite de données du cabinet B`);
};

test('a clinic cannot open another clinic\'s space', async (t) => {
  if (skip) return t.skip(skip);
  const B = `/cabinets/${ctx.b.cabinet.id}`;
  for (const [method, url] of [
    ['GET', '/patients'], ['GET', `/patients/${ctx.b.patient.id}`], ['GET', '/appointments'], ['GET', '/billing/invoices'],
    ['GET', `/patients/${ctx.b.patient.id}/consultations`], ['GET', '/team'], ['GET', '/dashboard'], ['GET', '/acts'],
    ['POST', '/patients'], ['PATCH', `/patients/${ctx.b.patient.id}`], ['DELETE', `/appointments/${ctx.b.appointment.id}`],
  ]) {
    for (const token of [ctx.a.ownerToken, ctx.a.assistantToken]) {
      refused(await call(method, B + url, token, method === 'GET' || method === 'DELETE' ? undefined : { firstName: 'X', lastName: 'Y' }), `${method} ${url}`);
    }
  }
});

test('another clinic\'s records cannot be reached through one\'s own space', async (t) => {
  if (skip) return t.skip(skip);
  const A = `/cabinets/${ctx.a.cabinet.id}`;
  const b = ctx.b;
  const token = ctx.a.ownerToken;
  refused(await call('GET', `${A}/patients/${b.patient.id}`, token), 'patient B');
  refused(await call('PATCH', `${A}/patients/${b.patient.id}`, token, { firstName: 'Hacked' }), 'modifier patient B');
  refused(await call('GET', `${A}/patients/${b.patient.id}/timeline`, token), 'historique patient B');
  refused(await call('GET', `${A}/patients/${b.patient.id}/consultations`, token), 'consultations patient B');
  refused(await call('GET', `${A}/patients/${b.patient.id}/consultations/${b.consultation.id}`, token), 'consultation B');
  refused(await call('GET', `${A}/patients/${b.patient.id}/records`, token), 'dossier spécialité B');
  refused(await call('GET', `${A}/patients/${b.patient.id}/attachments`, token), 'pièces jointes B');
  refused(await call('PATCH', `${A}/appointments/${b.appointment.id}`, token, { notes: 'x' }), 'modifier RDV B');
  refused(await call('POST', `${A}/appointments/${b.appointment.id}/status`, token, { status: 'CANCELLED' }), 'statut RDV B');
  refused(await call('GET', `${A}/billing/invoices/${b.invoice.id}`, token), 'facture B');
  refused(await call('POST', `${A}/billing/invoices/${b.invoice.id}/items`, token, { label: 'x', price: 1, quantity: 1 }), 'ligne facture B');

  // Lists of clinic A never contain clinic B's rows.
  const range = `from=${new Date(Date.now() - 7 * 86400000).toISOString()}&to=${new Date(Date.now() + 7 * 86400000).toISOString()}`;
  for (const url of ['/patients', `/appointments?${range}`, '/billing/invoices']) {
    const r = await call('GET', A + url, token);
    assert.equal(r.status, 200, url);
    assert.ok(!r.text.includes(b.patient.id) && !r.text.includes('F-b-1'), `${url}: contient des données du cabinet B`);
  }
  const fresh = await ctx.prisma.patient.findUnique({ where: { id: b.patient.id } });
  assert.equal(fresh.firstName, 'Patient', 'le patient B a été modifié');
});

test('an owner manages only their own team', async (t) => {
  if (skip) return t.skip(skip);
  const token = ctx.a.ownerToken;
  const list = await call('GET', `/users?cabinetId=${ctx.b.cabinet.id}`, token);
  assert.ok(!list.text.includes('assistant.b@test.ma'), 'liste des comptes du cabinet B visible');
  refused(await call('PATCH', `/users/${ctx.b.assistant.id}`, token, { password: 'Hacked123!' }), 'mot de passe compte B');
  refused(await call('DELETE', `/users/${ctx.b.assistant.id}`, token), 'supprimer compte B');
  refused(await call('POST', `/users/${ctx.b.assistant.id}/mfa/reset`, token), '2FA compte B');
});

test('the assistant never sees medical content', async (t) => {
  if (skip) return t.skip(skip);
  const A = `/cabinets/${ctx.a.cabinet.id}`;
  for (const url of ['consultations', `consultations/${ctx.a.consultation.id}`]) {
    const r = await call('GET', `${A}/patients/${ctx.a.patient.id}/${url}`, ctx.a.assistantToken);
    assert.equal(r.status, 403, url);
    assert.ok(!r.text.includes('diagnosis a'), `${url}: diagnostic visible par l'assistante`);
  }
});

test('the Super Admin needs the clinic\'s support permission', async (t) => {
  if (skip) return t.skip(skip);
  refused(await call('GET', `/cabinets/${ctx.b.cabinet.id}/patients`, ctx.superToken), 'super admin sans accès support');
});

test('medical content is stored encrypted', async (t) => {
  if (skip) return t.skip(skip);
  const { PrismaClient } = require('@prisma/client');
  const raw = new PrismaClient({ datasources: { db: { url: base } } });
  try {
    const row = await raw.patient.findUnique({ where: { id: ctx.a.patient.id } });
    assert.match(row.allergies, /^enc:v1:/);
    const c = await raw.consultation.findUnique({ where: { id: ctx.a.consultation.id } });
    assert.match(c.diagnosis, /^enc:v1:/);
  } finally { await raw.$disconnect(); }
});

test('signing out everywhere and deactivation end existing sessions', async (t) => {
  if (skip) return t.skip(skip);
  const me = (token) => call('GET', '/auth/me', token);
  assert.equal((await me(ctx.a.assistantToken)).status, 200);
  assert.equal((await call('PATCH', `/users/${ctx.a.assistant.id}`, ctx.a.ownerToken, { isActive: false })).status, 200);
  assert.equal((await me(ctx.a.assistantToken)).status, 401, 'compte désactivé encore connecté');

  const before = ctx.b.ownerToken;
  assert.equal((await call('POST', '/auth/logout-all', before)).status, 200);
  assert.equal((await me(before)).status, 401, 'session encore valide après déconnexion générale');
});
