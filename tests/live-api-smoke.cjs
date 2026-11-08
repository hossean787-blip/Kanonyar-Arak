'use strict';
/**
 * Real remote probe of Kanonha's public Supabase Data API.
 * Uses only the publishable mobile key. Does not create users or mutate data.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/config.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context, { filename: 'config.js', timeout: 1500 });
const { url, publishableKey: apiKey } = context.window.KANONHA_CONFIG;
assert.equal(url, 'https://cnqcysnjinghzzrzanpj.supabase.co');
assert.match(apiKey, /^sb_publishable_[A-Za-z0-9_-]+$/);
const headers = { apikey: apiKey, Accept: 'application/json' };

async function get(endpoint) {
  const response = await fetch(url + '/rest/v1/' + endpoint, {
    headers,
    signal: AbortSignal.timeout(20000),
    cache: 'no-store'
  });
  const body = await response.text();
  let data;
  try { data = body ? JSON.parse(body) : null; }
  catch { throw new Error('Unexpected non-JSON response from ' + endpoint); }
  return { status: response.status, data };
}
(async () => {
  for (const item of [
    'kanonha_clubs?select=id,name,is_active&limit=2',
    'kanonha_events?select=id,title,is_published&limit=2'
  ]) {
    const result = await get(item);
    assert.equal(result.status, 200, 'Live public read failed: ' + item + ' / HTTP ' + result.status);
    assert.ok(Array.isArray(result.data), 'Catalog response must be an array');
    if (item.startsWith('kanonha_clubs')) assert.ok(result.data.every(r => r.is_active === true), 'Inactive clubs leaked');
    if (item.startsWith('kanonha_events')) assert.ok(result.data.every(r => r.is_published === true), 'Unpublished events leaked');
    console.log('PASS live public API:', item.split('?')[0], 'rows:', result.data.length);
  }
  for (const item of [
    'kanonha_profiles?select=user_id&limit=1',
    'kanonha_memberships?select=user_id&limit=1',
    'kanonha_registrations?select=user_id&limit=1',
    'kanonha_secretaries?select=user_id&limit=1'
  ]) {
    const result = await get(item);
    assert.ok(result.status === 401 || result.status === 403,
      'Anonymous access must be denied for ' + item + ', got HTTP ' + result.status);
    console.log('PASS live private API access denied:', item.split('?')[0], 'HTTP', result.status);
  }
  console.log('PASS Kanonha isolated live Data API: public catalog and private-row access control');
})().catch(e => { console.error('LIVE BACKEND TEST FAILED',e); process.exitCode = 1; });
