/**
 * SIGTS unit tests — user identity normalisation and registration/login resolution.
 * Pure logic only (no live database); database-backed helpers are exercised with an
 * injected fake query layer so the resolution logic itself is verified deterministically.
 */
const {
    normalizeUsername,
    normalizeEmail,
    isValidEmailShape,
    findRegistrationConflicts,
    findUserForLogin,
    registrationConflictResponse,
    mapUniqueViolation,
} = require('../../src/utils/userIdentity');

describe('normalizeUsername', () => {
    test('trims surrounding whitespace and lowercases', () => {
        expect(normalizeUsername('  AineGuide  ')).toBe('aineguide');
    });
    test('handles null/undefined safely', () => {
        expect(normalizeUsername(undefined)).toBe('');
        expect(normalizeUsername(null)).toBe('');
    });
});

describe('normalizeEmail', () => {
    test('lowercases and trims non-Gmail addresses without altering local part', () => {
        expect(normalizeEmail('  User.Name@Outlook.com ')).toBe('user.name@outlook.com');
    });
    test('folds Gmail dots and subaddresses (duplicate-account prevention)', () => {
        expect(normalizeEmail('J.o.h.n+park@gmail.com')).toBe('john@gmail.com');
        expect(normalizeEmail('john@googlemail.com')).toBe('john@gmail.com');
    });
    test('returns empty string for empty input', () => {
        expect(normalizeEmail('')).toBe('');
    });
});

describe('isValidEmailShape', () => {
    test.each([
        ['user@example.com', true],
        ['a.b-c@sub.domain.org', true],
        ['plainaddress', false],
        ['no-at-symbol.com', false],
        ['missing@dot', false],
        ['spaced address@x.com', false],
        ['', false],
    ])('isValidEmailShape(%s) === %s', (input, expected) => {
        expect(isValidEmailShape(input)).toBe(expected);
    });
});

describe('registrationConflictResponse', () => {
    test('no conflicts returns null', () => {
        expect(registrationConflictResponse({ username: null, email: null })).toBeNull();
    });
    test('username taken yields 409 USERNAME_TAKEN', () => {
        const r = registrationConflictResponse({
            username: { user_id: 'u1', username: 'aine', is_active: true },
            email: null,
        });
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('USERNAME_TAKEN');
        expect(r.body.field).toBe('username');
    });
    test('email taken yields 409 EMAIL_TAKEN', () => {
        const r = registrationConflictResponse({
            username: null,
            email: { user_id: 'u2', email: 'x@y.com', is_active: true },
        });
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('EMAIL_TAKEN');
    });
    test('same account on both fields yields combined CREDENTIALS_TAKEN', () => {
        const row = { user_id: 'u3', username: 'a', email: 'a@b.com', is_active: true };
        const r = registrationConflictResponse({ username: row, email: row });
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('CREDENTIALS_TAKEN');
        expect(r.body.conflict).toEqual({ username: true, email: true, inactive: false });
    });
    test('inactive account surfaces ACCOUNT_INACTIVE', () => {
        const row = { user_id: 'u4', username: 'a', email: 'a@b.com', is_active: false };
        const r = registrationConflictResponse({ username: row, email: row });
        expect(r.body.code).toBe('ACCOUNT_INACTIVE');
    });
});

describe('mapUniqueViolation', () => {
    test('non unique-violation error returns null', () => {
        expect(mapUniqueViolation({ code: '23502' })).toBeNull();
    });
    test('username constraint maps to USERNAME_TAKEN', () => {
        const r = mapUniqueViolation({ code: '23505', constraint: 'users_username_key' });
        expect(r.body.code).toBe('USERNAME_TAKEN');
    });
    test('email constraint maps to EMAIL_TAKEN', () => {
        const r = mapUniqueViolation({ code: '23505', detail: 'Key (email)=(x@y.com) exists' });
        expect(r.body.code).toBe('EMAIL_TAKEN');
    });
    test('unknown unique violation falls back to CREDENTIALS_TAKEN', () => {
        const r = mapUniqueViolation({ code: '23505', constraint: 'misc_key' });
        expect(r.body.code).toBe('CREDENTIALS_TAKEN');
    });
});

describe('findUserForLogin (resolution logic with injected db)', () => {
    const makeDb = (handlers) => ({
        query: jest.fn(async (sql) => {
            for (const [needle, rows] of handlers) {
                if (sql.includes(needle)) return { rows };
            }
            return { rows: [] };
        }),
    });

    test('resolves by username first', async () => {
        const db = makeDb([['LOWER(TRIM(username)) = LOWER(TRIM($1))', [{ user_id: 'u1', username: 'aine' }]]]);
        const res = await findUserForLogin(db, 'Aine');
        expect(res.matchedBy).toBe('username');
        expect(res.user.user_id).toBe('u1');
    });

    test('falls back to email when not a username and identifier has @', async () => {
        const db = makeDb([
            ['LOWER(TRIM(username)) = LOWER(TRIM($1))', []],
            ['LOWER(TRIM(email)) = $1', [{ user_id: 'u2', email: 'a@b.com' }]],
        ]);
        const res = await findUserForLogin(db, 'a@b.com');
        expect(res.matchedBy).toBe('email');
    });

    test('resolves by display name when a single match exists', async () => {
        const db = makeDb([
            ['LOWER(TRIM(username)) = LOWER(TRIM($1))', []],
            ['COALESCE(first_name', [{ user_id: 'u3', first_name: 'Aine', last_name: 'Guide' }]],
        ]);
        const res = await findUserForLogin(db, 'Aine Guide');
        expect(res.matchedBy).toBe('name');
    });

    test('returns null for empty identifier', async () => {
        const db = makeDb([]);
        expect(await findUserForLogin(db, '   ')).toBeNull();
    });
});

describe('findRegistrationConflicts (injected db)', () => {
    test('returns normalized values and matched rows', async () => {
        const db = {
            query: jest.fn(async (sql) => {
                if (sql.includes('LOWER(TRIM(username)) = $1')) {
                    return { rows: [{ user_id: 'u1', username: 'aine', is_active: true }] };
                }
                return { rows: [] };
            }),
        };
        const out = await findRegistrationConflicts(db, '  Aine ', 'J.ohn@gmail.com');
        expect(out.username.username).toBe('aine');
        expect(out.email).toBeNull();
        expect(out.normalized.username).toBe('aine');
        expect(out.normalized.email).toBe('john@gmail.com');
    });
});
