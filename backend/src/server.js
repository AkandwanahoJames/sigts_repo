// =====================================================
// SIGTS - SMART INFORMATION GUIDE TOUR SYSTEM
// COMPLETE WORKING SERVER.JS - PASSWORD FIXED
// BWINDI IMPENETRABLE NATIONAL PARK
// =====================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const {
    createGeneralApiLimiter,
    createAuthLoginLimiter,
    isRateLimitDisabled,
} = require('./middleware/apiRateLimit');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
const { loadEnv } = require('./config/env');
loadEnv();

// Import configuration modules
const { pool, connectDB } = require('./config/database');
const { initializeRedis, getRedisClient } = require('./config/redis');
const { logger } = require('./utils/logger');
const { getEmailProvider, isEmailConfigured } = require('./services/emailService');
const { generateToken, verifyToken, hashPassword, verifyPassword } = require('./config/auth');
const { touchUserSessionActivity } = require('./utils/sessionPresence');
const { REQUIREMENTS, ensureSecurityConfiguration } = require('./config/requirements');
ensureSecurityConfiguration();

// Import middleware
const { authenticateJWT, authorize, ipWhitelist, rejectGuestAccounts } = require('./middleware/auth');
const { requireInsidePark } = require('./middleware/parkGeofence');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { correlationId } = require('./middleware/correlationId');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const animalRoutes = require('./routes/animals');
const wildlifeTourThemesRoutes = require('./routes/wildlifeTourThemes');
const locationRoutes = require('./routes/locations');
const sightingRoutes = require('./routes/sightings');
const tourRoutes = require('./routes/tours');
const culturalRoutes = require('./routes/cultural');
const geofenceRoutes = require('./routes/geofence');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const syncRoutes = require('./routes/sync');
const aiRoutes = require('./routes/ai');
const intranetRoutes = require('./routes/intranet');
const feedbackRoutes = require('./routes/feedback');
const uatRoutes = require('./routes/uat');
const geoRoutes = require('./routes/geo');
const guideMessagesRoutes = require('./routes/guideMessages');
const bookmarkRoutes = require('./routes/bookmarks');
const publicParkContentRoutes = require('./routes/publicParkContent');

// Initialize Express app
const app = express();
// Behind Vercel (and any reverse proxy) the client IP arrives via X-Forwarded-For.
// Trusting the first proxy hop lets express-rate-limit identify users correctly and
// stops it from throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0';

// =====================================================
// SIMPLE IN-MEMORY STORE FOR DEMO (No Redis dependency)
// =====================================================
const tokenBlacklist = new Set();

// =====================================================
// MIDDLEWARE SETUP
// =====================================================

// Correlation ID must run before anything else that logs.
app.use(correlationId());

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
// Always allow local development hosts and the known hosted domains, then merge in any
// origins supplied via CLIENT_URL. This way a Vercel domain/alias change can never silently
// block sign-in again (see isOriginAllowed for the same-origin / *.vercel.app fallbacks).
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://192.168.100.40:3000',
    'https://sigts.vercel.app',
    'https://sigts-static.vercel.app'
];
const envAllowedOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const allowedOrigins = Array.from(new Set([...envAllowedOrigins, ...DEFAULT_ALLOWED_ORIGINS]));

function isOriginAllowed(origin) {
    // No Origin header: same-origin navigations, curl, or server-to-server calls.
    if (!origin) return true;
    if (allowedOrigins.indexOf(origin) !== -1) return true;
    // Accept any Vercel deployment of this app (production alias and preview URLs) so the
    // frontend keeps working when it is served same-origin from a Vercel domain.
    try {
        const hostname = new URL(origin).hostname;
        if (/(^|\.)vercel\.app$/i.test(hostname)) return true;
    } catch (_) {
        // Malformed Origin header falls through to the checks below.
    }
    // Outside production, be permissive to keep local/dev tooling friction-free.
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
}

app.use(cors({
    origin: function (origin, callback) {
        if (isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy: origin not allowed'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-user-lat',
        'x-user-lng',
        'x-sigts-sim-boundary',
        'x-sigts-sim-network',
        'x-idempotency-key',
        'x-request-id'
    ]
}));

// Compression
app.use(compression());

// Body parsing (bounded by requirement-driven configuration)
app.use(express.json({ limit: REQUIREMENTS.performance.apiRequestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: REQUIREMENTS.performance.apiRequestBodyLimit }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/static', express.static(path.join(__dirname, '../public')));

// Request logging
app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: (req) => req.url === '/health'
}));

// General API rate limit (off in development; see middleware/apiRateLimit.js)
app.use('/api/', createGeneralApiLimiter());
if (isRateLimitDisabled()) {
    logger.info('API rate limiter DISABLED (development or DISABLE_API_RATE_LIMIT=true)');
} else {
    logger.info('API rate limiter ENABLED for production traffic');
}

// Auth rate limiter — disabled by default. Set ENABLE_AUTH_RATE_LIMIT=true to turn back on.
if (String(process.env.ENABLE_AUTH_RATE_LIMIT).toLowerCase() === 'true') {
    const authLimiter = createAuthLoginLimiter();
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/login-direct', authLimiter);
    logger.info('Auth rate limiter ENABLED');
} else {
    logger.info('Auth rate limiter DISABLED (set ENABLE_AUTH_RATE_LIMIT=true to enable)');
}

// =====================================================
// HEALTH CHECK ENDPOINTS
// =====================================================

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api/health', async (req, res) => {
    let dbStatus = 'disconnected';
    let dbLatency = null;

    const dbStart = Date.now();
    try {
        await pool.query('SELECT 1');
        dbStatus = 'connected';
        dbLatency = Date.now() - dbStart;
    } catch (err) {
        dbStatus = 'error';
        logger.error('Database health check failed:', err.message);
    }

    res.json({
        status: dbStatus === 'connected' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: { status: dbStatus, latency_ms: dbLatency },
        memory: { heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
        notifications: {
            email: isEmailConfigured() ? getEmailProvider() : 'not_configured',
            sms: Boolean(
                process.env.TWILIO_ACCOUNT_SID
                && process.env.TWILIO_AUTH_TOKEN
                && process.env.TWILIO_FROM_NUMBER
            ) ? 'twilio' : 'not_configured'
        }
    });
});

// =====================================================
// SIMPLE TEST ENDPOINTS
// =====================================================

if (process.env.NODE_ENV !== 'production') {
    app.get('/api/test', (req, res) => {
        res.json({ message: 'API is working!', timestamp: new Date().toISOString() });
    });

    app.get('/api/animals-test', (req, res) => {
        res.json([
            { id: 1, name: 'Mountain Gorilla', conservation_status: 'endangered' },
            { id: 2, name: 'African Elephant', conservation_status: 'vulnerable' },
            { id: 3, name: 'Great Blue Turaco', conservation_status: 'least_concern' }
        ]);
    });
}

// =====================================================
// DIRECT LOGIN ENDPOINT FOR TESTING (Bypasses routes)
// =====================================================
if (process.env.NODE_ENV !== 'production') {
app.post('/api/auth/login-direct', async (req, res) => {
    const { username, password } = req.body;
    
    console.log('========================================');
    console.log('DIRECT LOGIN ATTEMPT');
    console.log('Username:', username);
    console.log('Password provided:', password ? 'Yes' : 'No');
    console.log('========================================');
    
    try {
        // Get user from database
        const result = await pool.query(
            `SELECT user_id, username, password_hash, user_type, first_name, last_name, is_active
             FROM users WHERE username = $1`,
            [username]
        );

        if (result.rows.length === 0) {
            console.log('User not found:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        console.log('User found:', user.username);
        console.log('Stored hash:', user.password_hash);
        console.log('Hash length:', user.password_hash?.length);
        console.log('Hash prefix:', user.password_hash?.substring(0, 10));

        // Verify password directly with bcrypt
        const bcrypt = require('bcryptjs');
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        console.log('Password valid:', isValid);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token with the shared auth config path.
        const token = generateToken(user.user_id, user.user_type);
        await touchUserSessionActivity(user.user_id);

        console.log('Login successful for:', username);
        console.log('========================================');

        res.json({
            success: true,
            token,
            user: {
                id: user.user_id,
                username: user.username,
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                role: user.user_type
            }
        });

    } catch (error) {
        console.error('Direct login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// =====================================================
// CREATE TEST USER ENDPOINT
// =====================================================
app.post('/api/auth/create-test-user', async (req, res) => {
    const bcrypt = require('bcryptjs');
    const testPassword = 'test123';
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    
    console.log('Creating test user...');
    console.log('Password:', testPassword);
    console.log('Hash:', hashedPassword);
    
    try {
        // Check if user exists
        const existing = await pool.query(
            'SELECT user_id FROM users WHERE username = $1',
            ['testuser']
        );
        
        if (existing.rows.length > 0) {
            // Update existing user's password
            await pool.query(
                'UPDATE users SET password_hash = $1 WHERE username = $2',
                [hashedPassword, 'testuser']
            );
            console.log('Updated testuser password');
        } else {
            // Create new user
            await pool.query(
                `INSERT INTO users (user_id, username, password_hash, email, user_type, is_active)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, true)`,
                ['testuser', hashedPassword, 'test@bwindi.com', 'tourist']
            );
            console.log('Created new testuser');
        }
        
        res.json({
            success: true,
            message: 'Test user created/updated',
            credentials: {
                username: 'testuser',
                password: 'test123'
            },
            hash: hashedPassword
        });
        
    } catch (error) {
        console.error('Create test user error:', error);
        res.status(500).json({ error: error.message });
    }
});
}

// =====================================================
// API ROUTES
// =====================================================

// Public routes
app.use('/api/auth', authRoutes);

// Catalogue & visitor information ( FAQs, safety, weather, §3.1.1.3 )
app.use('/api', publicParkContentRoutes);

// Protected routes - route modules already enforce auth/roles.
app.use('/api/users', userRoutes);
app.use('/api/users/bookmarks', bookmarkRoutes);
app.use('/api/animals', animalRoutes);
app.use('/api/wildlife-tour-themes', wildlifeTourThemesRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/sightings', authenticateJWT, rejectGuestAccounts, requireInsidePark({ bypassRoles: ['it_manager'] }), sightingRoutes);
app.use('/api/tours', authenticateJWT, rejectGuestAccounts, requireInsidePark({ bypassRoles: ['it_manager', 'admin'] }), tourRoutes);
app.use('/api/cultural', culturalRoutes);
app.use('/api/geofence', geofenceRoutes);
app.use('/api/sync', authenticateJWT, rejectGuestAccounts, requireInsidePark({ bypassRoles: ['it_manager'] }), syncRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/geo', authenticateJWT, geoRoutes);
app.use('/api/guides/messages', guideMessagesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/intranet', intranetRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/uat', uatRoutes);

// =====================================================
// WEBSOCKET SETUP (Optional)
// =====================================================
const server = http.createServer(app);
let io = null;

try {
    io = socketIo(server, {
        cors: {
            origin: allowedOrigins,
            credentials: true
        },
        transports: ['websocket', 'polling'],
        pingInterval: 25000,
        pingTimeout: 60000,
        maxHttpBufferSize: 1e6,
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: true,
        },
    });

    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            // Reuse shared token verification logic for consistency.
            const decoded = verifyToken(token);
            const result = await pool.query(
                'SELECT user_id, username, user_type FROM users WHERE user_id = $1 AND is_active = true',
                [decoded.userId]
            );
            
            if (result.rows.length === 0) {
                return next(new Error('User not found'));
            }
            
            socket.user = result.rows[0];
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        logger.info(`WebSocket connected: ${socket.id}`);
        
        socket.on('join-tour', (tourId) => {
            socket.join(`tour:${tourId}`);
        });

        socket.on('join-it-ops', () => {
            if (socket.user?.user_type === 'it_manager') {
                socket.join('it:ops');
            }
        });

        socket.on('sync:notify', (payload) => {
            if (socket.user?.user_type === 'it_manager') {
                io.to('it:ops').emit('sync:update', {
                    ...payload,
                    at: new Date().toISOString(),
                    from: socket.user.user_id,
                });
            }
        });

        socket.on('disconnect', () => {
            logger.info(`WebSocket disconnected: ${socket.id}`);
        });
    });
    
    app.set('io', io);
    logger.info('WebSocket server initialized');
} catch (error) {
    logger.warn('WebSocket initialization failed:', error.message);
}

app.set('pool', pool);

// =====================================================
// FRONTEND (SPA) — same origin as /api for reliable registration/login
// =====================================================
const FRONTEND_PUBLIC_DIR = path.join(__dirname, '../../frontend/public');
const RUNTIME_CONFIG_GENERATOR = path.join(__dirname, '../../frontend/scripts/generateRuntimeConfig.js');
if (!process.env.VERCEL && fs.existsSync(RUNTIME_CONFIG_GENERATOR)) {
    try {
        require(RUNTIME_CONFIG_GENERATOR);
    } catch (e) {
        logger.warn(`Could not generate frontend runtime-config.js: ${e.message}`);
    }
}
if (fs.existsSync(FRONTEND_PUBLIC_DIR)) {
    const spaIndex = path.join(FRONTEND_PUBLIC_DIR, 'index.html');
    const serveSpa = (req, res, next) => {
        res.sendFile(spaIndex, (err) => {
            if (err) next(err);
        });
    };
    app.get(['/reset-password', '/verify-email'], serveSpa);
    app.use(express.static(FRONTEND_PUBLIC_DIR, { index: 'index.html', maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));
    app.get('*', (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (
            req.path.startsWith('/api')
            || req.path.startsWith('/uploads')
            || req.path.startsWith('/static')
            || req.path === '/health'
            || req.path.startsWith('/socket.io')
        ) {
            return next();
        }
        // Missing .js/.css/etc. must 404 — not index.html (breaks script loading).
        if (/\.[a-z0-9]{1,12}$/i.test(req.path) && !/\.html?$/i.test(req.path)) {
            return next();
        }
        res.sendFile(path.join(FRONTEND_PUBLIC_DIR, 'index.html'), (err) => {
            if (err) next(err);
        });
    });
    logger.info(`✅ Frontend static files: ${FRONTEND_PUBLIC_DIR}`);
}

// =====================================================
// ERROR HANDLING MIDDLEWARE
// =====================================================

app.use(notFound);
app.use(errorHandler);

// =====================================================
// SERVER STARTUP
// =====================================================

async function startServer() {
    try {
        // Connect to database
        await connectDB();
        logger.info('✅ PostgreSQL connected');

        // Create uploads directory
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            logger.info('✅ Uploads directory created');
        }

        // Test database with a simple query
        const testResult = await pool.query('SELECT NOW() as time');
        logger.info(`✅ Database time: ${testResult.rows[0].time}`);

        // Start server
        server.listen(PORT, HOST, () => {
            logger.info(`========================================`);
            logger.info(`🚀 SIGTS Backend Running Successfully!`);
            logger.info(`========================================`);
            logger.info(`📍 Server: http://${HOST}:${PORT}`);
            logger.info(`📍 App UI: http://localhost:${PORT}/  (when frontend/public is present)`);
            logger.info(`📍 Health: http://${HOST}:${PORT}/api/health`);
            if (process.env.NODE_ENV !== 'production') {
                logger.info(`📍 Test:   http://${HOST}:${PORT}/api/test`);
                logger.info(`📍 Direct Login: POST /api/auth/login-direct`);
                logger.info(`📍 Create Test User: POST /api/auth/create-test-user`);
            }
            logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🦍 Park: Bwindi Impenetrable National Park`);
            logger.info(`========================================`);
            if (process.env.NODE_ENV !== 'production') {
                logger.info(`📋 TEST LOGIN:`);
                logger.info(`   POST /api/auth/create-test-user (create test account)`);
                logger.info(`   POST /api/auth/login-direct with {"username":"testuser","password":"test123"}`);
            }
            logger.info(`========================================`);
        });

    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    server.close(() => {
        pool.end();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    server.close(() => {
        pool.end();
        process.exit(0);
    });
});

// Start the server only when this file is executed directly. Serverless
// platforms such as Vercel import the Express app and provide their own
// listener.
if (require.main === module) {
    startServer();
}

module.exports = { app, server, io };
