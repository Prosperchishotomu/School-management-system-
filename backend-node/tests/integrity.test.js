const request = require('supertest');
const app = require('../src/app');

describe('integrity boundaries', () => {
  test('emits request ids and security headers', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  test('protects results publication behind authentication', async () => {
    const response = await request(app)
      .post('/api/v1/schools/SCH001/results/publish')
      .send({ class_id: 'CLASS1', term: 'Term 1' });
    expect(response.status).toBe(401);
  });

  test('protects conversations behind authentication', async () => {
    const response = await request(app).get('/api/v1/messages/conversations');
    expect(response.status).toBe(401);
  });
});
