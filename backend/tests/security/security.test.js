/**
 * SIGTS security tests — authentication cryptography, token integrity, and
 * input-handling defences. These exercise the actual libraries the application
 * uses (bcryptjs, jsonwebtoken) plus the shared identity-hardening helpers.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { normalizeEmail, isValidEmailShape, mapUniqueViolation } = require('../../src/utils/userIdentity');

describe('Password hashing (bcrypt)', () => {
    const plain = 'Gorilla#Trek2026';

    test('hash is salted and never equals the plaintext', async () => {
        const hash = await bcrypt.hash(plain, 10);
        expect(hash).not.toBe(plain);
        expect(hash.startsWith('$2')).toBe(true);
    });

    test('two hashes of the same password differ (unique salts)', async () => {
        const h1 = await bcrypt.hash(plain, 10);
        const h2 = await bcrypt.hash(plain, 10);
        expect(h1).not.toBe(h2);
    });

    test('correct password verifies and wrong password is rejected', async () => {
        const hash = await bcrypt.hash(plain, 10);
        expect(await bcrypt.compare(plain, hash)).toBe(true);
        expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
    });
});

describe('JWT issuance and verification', () => {
    const secret = 'unit-test-secret-key';
    const payload = { sub: 'u1', user_type: 'tourist' };

    test('valid token round-trips and preserves claims', () => {
        const token = jwt.sign(payload, secret, { expiresIn: '15m' });
        const decoded = jwt.verify(token, secret);
        expect(decoded.sub).toBe('u1');
        expect(decoded.user_type).toBe('tourist');
    });

    test('token signed with a different secret is rejected', () => {
        const token = jwt.sign(payload, 'attacker-secret');
        expect(() => jwt.verify(token, secret)).toThrow();
    });

    test('tampered token body fails verification', () => {
        const token = jwt.sign(payload, secret);
        const parts = token.split('.');
        const forged = `${parts[0]}.${Buffer.from('{"sub":"admin"}').toString('base64url')}.${parts[2]}`;
        expect(() => jwt.verify(forged, secret)).toThrow();
    });

    test('expired token is rejected', () => {
        const token = jwt.sign(payload, secret, { expiresIn: -1 });
        expect(() => jwt.verify(token, secret)).toThrow(/expired/i);
    });
});

describe('Account-deduplication hardening (Gmail folding)', () => {
    test('dotted/subaddressed Gmail variants normalise to one canonical identity', () => {
        const canonical = normalizeEmail('john@gmail.com');
        expect(normalizeEmail('j.o.h.n@gmail.com')).toBe(canonical);
        expect(normalizeEmail('john+bwindi@gmail.com')).toBe(canonical);
        expect(normalizeEmail('JOHN@googlemail.com')).toBe(canonical);
    });
});

describe('Input validation defences', () => {
    test.each([
        'plainaddress',
        'a@b',
        'two words@x.com',
        '',
        'noатdomain.com',
    ])('rejects malformed email %p', (bad) => {
        expect(isValidEmailShape(bad)).toBe(false);
    });

    test('unique-violation responses never leak which field beyond intended code', () => {
        const r = mapUniqueViolation({ code: '23505', constraint: 'users_email_key' });
        expect(r.status).toBe(409);
        expect(Object.keys(r.body)).toEqual(expect.arrayContaining(['error', 'code', 'field']));
        expect(r.body.error).not.toMatch(/select|insert|constraint|sql/i);
    });
});
