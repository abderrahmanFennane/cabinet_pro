const test = require('node:test');
const assert = require('node:assert/strict');
const { canAccessCabinet, effectivePermissions } = require('../dist/src/utils/tenant-access.js');

test('cabinet members reach only their own cabinet', () => {
  for (const role of ['OWNER', 'PRACTITIONER', 'ASSISTANT']) {
    assert.equal(canAccessCabinet(role, 'cabinet-a', 'cabinet-a'), true);
    assert.equal(canAccessCabinet(role, 'cabinet-a', 'cabinet-b'), false);
  }
});

test('missing tenant context or unknown role is denied', () => {
  assert.equal(canAccessCabinet('OWNER', 'cabinet-a', undefined), false);
  assert.equal(canAccessCabinet('ASSISTANT', null, 'cabinet-a'), false);
  assert.equal(canAccessCabinet('PATIENT', 'cabinet-a', 'cabinet-a'), false);
});

test('assistant never gets medical content', () => {
  const perms = effectivePermissions('ASSISTANT', null);
  assert.equal(perms.includes('VIEW_MEDICAL'), false);
  assert.equal(perms.includes('DENTAL_CHART'), false);
  assert.equal(perms.includes('MANAGE_PRESCRIPTIONS'), false);
  assert.equal(perms.includes('PRINT_DOCUMENTS'), true);
});

test('plan features restrict role permissions: Essentiel has no treatment plans, Pro has', () => {
  const essentiel = ['MANAGE_PATIENTS', 'VIEW_MEDICAL', 'DENTAL_CHART', 'MANAGE_TEAM'];
  const pro = [...essentiel, 'DENTAL_TREATMENT_PLAN'];
  assert.equal(effectivePermissions('OWNER', essentiel).includes('DENTAL_TREATMENT_PLAN'), false);
  assert.equal(effectivePermissions('OWNER', pro).includes('DENTAL_TREATMENT_PLAN'), true);
});

test('only the Super Admin manages cabinets', () => {
  assert.equal(effectivePermissions('OWNER', null).includes('MANAGE_CABINETS'), false);
  assert.equal(effectivePermissions('SUPER_ADMIN', null).includes('MANAGE_CABINETS'), true);
});
