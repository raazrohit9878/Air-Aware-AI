import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import chatHandler, { createChatHandler } from '../api/ai/chat.js';
import stationsHandler, { createStationsHandler } from '../api/air-quality/stations.js';
import { InvalidCoordinatesError } from '../api/air-quality/stations-core.js';
import {
  InvalidJsonError,
  PayloadTooLargeError,
  extractBearerToken,
  getClientKey,
  parseBodyWithLimit,
  readStreamJsonBody,
} from '../api/_http.js';

function mockRes() {
  const headers = {};
  return {
    statusCode: 200,
    headers,
    body: null,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('http helpers parse bearer tokens, client IPs, and size-limited JSON bodies', async () => {
  assert.equal(extractBearerToken({ headers: { authorization: 'Bearer abc.123' } }), 'abc.123');
  assert.equal(extractBearerToken({ headers: {} }), '');
  assert.equal(getClientKey({ headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } }), '203.0.113.5');

  assert.deepEqual(parseBodyWithLimit('{"question":"hi"}', 100), { question: 'hi' });
  assert.throws(() => parseBodyWithLimit('not-json', 100), InvalidJsonError);
  assert.throws(() => parseBodyWithLimit('x'.repeat(200), 100), PayloadTooLargeError);

  const req = new EventEmitter();
  const promise = readStreamJsonBody(req, 100);
  req.emit('data', Buffer.from('{"ok":true}'));
  req.emit('end');
  assert.deepEqual(await promise, { ok: true });

  const bigReq = new EventEmitter();
  const bigPromise = readStreamJsonBody(bigReq, 10);
  bigReq.emit('data', Buffer.from('12345678901'));
  await assert.rejects(() => bigPromise, PayloadTooLargeError);
});

test('chat handler handles method, size, auth, rate limit, malformed JSON, and success paths', async () => {
  const getRes = mockRes();
  await chatHandler({ method: 'GET', headers: {} }, getRes);
  assert.equal(getRes.statusCode, 405);
  assert.equal(getRes.headers['x-content-type-options'], 'nosniff');

  const bigRes = mockRes();
  await chatHandler({ method: 'POST', headers: { 'content-length': '20000' } }, bigRes);
  assert.equal(bigRes.statusCode, 413);

  const unauthRes = mockRes();
  await chatHandler({ method: 'POST', headers: {} }, unauthRes);
  assert.equal(unauthRes.statusCode, 401);

  const badTypeRes = mockRes();
  await chatHandler({ method: 'POST', headers: { 'content-type': 'text/plain' } }, badTypeRes);
  assert.equal(badTypeRes.statusCode, 415);

  const limitedHandler = createChatHandler({
    verifySupabaseSession: async () => true,
    allowChatRequest: () => false,
  });
  const limitedRes = mockRes();
  await limitedHandler({ method: 'POST', headers: { authorization: 'Bearer ok' }, body: { question: 'Hi' } }, limitedRes);
  assert.equal(limitedRes.statusCode, 429);

  const okHandler = createChatHandler({
    verifySupabaseSession: async () => true,
    allowChatRequest: () => true,
    createChatResponse: async (payload) => ({ status: 200, body: { answer: `Echo: ${payload.question}`, mode: 'guide' } }),
    getEnv: () => ({ NVIDIA_API_KEY: '', NVIDIA_NIM_MODEL: '' }),
  });

  const badJsonRes = mockRes();
  await okHandler({ method: 'POST', headers: { authorization: 'Bearer ok' }, body: '{bad' }, badJsonRes);
  assert.equal(badJsonRes.statusCode, 400);

  const successRes = mockRes();
  await okHandler({ method: 'POST', headers: { authorization: 'Bearer ok' }, body: { question: 'AQI today?' } }, successRes);
  assert.equal(successRes.statusCode, 200);
  assert.equal(successRes.body.answer, 'Echo: AQI today?');
});

test('stations handler handles method, auth, invalid coords, upstream failure, and success paths', async () => {
  const postRes = mockRes();
  await stationsHandler({ method: 'POST', headers: {} }, postRes);
  assert.equal(postRes.statusCode, 405);
  assert.equal(postRes.headers['x-content-type-options'], 'nosniff');

  const unauthRes = mockRes();
  await stationsHandler({ method: 'GET', headers: {}, url: '/api/air-quality/stations?latitude=12.97&longitude=77.59' }, unauthRes);
  assert.equal(unauthRes.statusCode, 401);

  const badCoordsHandler = createStationsHandler({
    verifySupabaseSession: async () => true,
    getNearbyStations: async () => {
      throw new InvalidCoordinatesError('Valid coordinates are required.');
    },
    getEnv: () => ({ OPENAQ_API_KEY: 'k' }),
  });
  const badRes = mockRes();
  await badCoordsHandler({ method: 'GET', headers: { authorization: 'Bearer ok' }, url: '/api/air-quality/stations' }, badRes);
  assert.equal(badRes.statusCode, 400);

  const badCountryRes = mockRes();
  await badCoordsHandler(
    { method: 'GET', headers: { authorization: 'Bearer ok' }, url: '/api/air-quality/stations?latitude=12.97&longitude=77.59&country=INVALID' },
    badCountryRes,
  );
  assert.equal(badCountryRes.statusCode, 400);

  const upstreamErrHandler = createStationsHandler({
    verifySupabaseSession: async () => true,
    getNearbyStations: async () => {
      throw new Error('OpenAQ returned 503');
    },
    getEnv: () => ({ OPENAQ_API_KEY: 'k' }),
  });
  const errRes = mockRes();
  await upstreamErrHandler({ method: 'GET', headers: { authorization: 'Bearer ok' }, url: '/api/air-quality/stations?latitude=12.9&longitude=77.5' }, errRes);
  assert.equal(errRes.statusCode, 502);

  const okHandler = createStationsHandler({
    verifySupabaseSession: async () => true,
    getNearbyStations: async ({ latitude, longitude }) => ({ available: true, stations: [{ id: 1, lat: latitude, lon: longitude }] }),
    getEnv: () => ({ OPENAQ_API_KEY: 'k' }),
  });
  const okRes = mockRes();
  await okHandler({ method: 'GET', headers: { authorization: 'Bearer ok' }, url: '/api/air-quality/stations?latitude=12.97&longitude=77.59' }, okRes);
  assert.equal(okRes.statusCode, 200);
  assert.equal(okRes.body.available, true);
});
