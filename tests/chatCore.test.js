import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowChatRequest,
  cleanContext,
  createChatResponse,
  resetChatRateLimit,
  verifySupabaseSession,
} from '../api/ai/chat-core.js';

test('createChatResponse validates question, intercepts emergencies, and falls back without API key', async () => {
  const empty = await createChatResponse({ question: ' ' });
  assert.equal(empty.status, 400);

  const emergency = await createChatResponse({ question: 'My child has severe difficulty breathing' });
  assert.equal(emergency.status, 200);
  assert.equal(emergency.body.mode, 'guide');
  assert.match(emergency.body.answer, /emergency services/i);

  const guide = await createChatResponse({
    question: 'Is outdoor exercise safe today?',
    context: { city: 'Bengaluru', aqi: 42, aqiCategory: 'Good', updatedAt: '2026-11-25T10:00' },
  });
  assert.equal(guide.status, 200);
  assert.equal(guide.body.mode, 'guide');
  assert.match(guide.body.answer, /Open-Meteo model estimate/i);
});

test('createChatResponse calls NVIDIA NIM when configured and falls back on upstream failure', async () => {
  const nimResponse = await createChatResponse(
    {
      question: 'Should we open windows?',
      history: [{ role: 'user', content: 'Hi' }],
      context: { city: 'Bengaluru', aqi: 34, aqiCategory: 'Good' },
    },
    {
      apiKey: 'nim-key',
      model: 'nvidia/nemotron-3.5-bolt-e4b',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Model estimate is 34 (Good). Brief ventilation is reasonable.' } }] }),
      }),
    },
  );
  assert.equal(nimResponse.status, 200);
  assert.equal(nimResponse.body.mode, 'nim');
  assert.match(nimResponse.body.answer, /34/);

  const fallback = await createChatResponse(
    { question: 'Should we open windows?', context: { city: 'Bengaluru', aqi: 34 } },
    {
      apiKey: 'nim-key',
      fetchImpl: async () => ({ ok: false, status: 503 }),
    },
  );
  assert.equal(fallback.status, 200);
  assert.equal(fallback.body.mode, 'guide');
  assert.match(fallback.body.notice, /unavailable/i);
});

test('cleanContext strips control chars and limits ground stations', () => {
  const cleaned = cleanContext({
    city: 'Bengaluru\u0007',
    aqi: '45',
    groundStations: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    profile: { children: true, commute: 'Private car' },
  });
  assert.equal(cleaned.city, 'Bengaluru');
  assert.equal(cleaned.aqi, 45);
  assert.equal(cleaned.groundStations.length, 3);
  assert.equal(cleaned.household.commute, 'Private car');
});

test('allowChatRequest enforces per-client sliding window rate limit', () => {
  resetChatRateLimit();
  const baseTime = 1_700_000_000_000;
  for (let i = 0; i < 18; i += 1) {
    assert.equal(allowChatRequest('client-a', baseTime + i * 100), true);
  }
  assert.equal(allowChatRequest('client-a', baseTime + 2_000), false);
  assert.equal(allowChatRequest('client-b', baseTime + 2_000), true);
  assert.equal(allowChatRequest('client-a', baseTime + 61_000), true);
});

test('verifySupabaseSession checks token and credentials safely', async () => {
  assert.equal(await verifySupabaseSession('', { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' }), false);
  assert.equal(
    await verifySupabaseSession('jwt-token', {
      supabaseUrl: 'https://x.supabase.co',
      supabaseAnonKey: 'anon',
      fetchImpl: async () => ({ ok: true }),
    }),
    true,
  );
});
