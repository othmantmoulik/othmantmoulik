require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');

const User = require('./models/User');
const StripeService = require('./services/stripe');
const { parseReferralCode, generateAffiliateLink } = require('./utils/affiliate');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year - for lifetime tracking
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Serve static files
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to track referral codes
app.use((req, res, next) => {
    const refCode = req.query.ref;

    if (refCode) {
        const cleanCode = parseReferralCode(refCode);
        if (cleanCode) {
            // Store in cookie for lifetime tracking
            res.cookie('ref_code', cleanCode, {
                maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
                httpOnly: true
            });

            // Store in session
            req.session.refCode = cleanCode;
        }
    }

    next();
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

// ============================================
// PUBLIC ROUTES
// ============================================

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const db = require('./config/database');
        await db.get('SELECT 1');
        res.json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message
        });
    }
});

// Home page
app.get('/', (req, res) => {
    res.render('home', {
        user: req.session.userId ? req.session : null
    });
});

// Join page (with referral tracking)
app.get('/join', (req, res) => {
    const refCode = req.cookies.ref_code || req.session.refCode;

    res.render('join', {
        refCode: refCode || null
    });
});

// Login page
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login');
});

// ============================================
// AUTH API ROUTES
// ============================================

// Sign up
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        console.log('Signup attempt:', { email, fullName, hasPassword: !!password });

        // Check if user exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Get referral code from cookie or session
        const refCode = req.cookies.ref_code || req.session.refCode;

        // Create user
        const userId = await User.create({
            email,
            password,
            fullName,
            referredByCode: refCode
        });

        // Log them in
        const user = await User.findById(userId);
        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.fullName = user.full_name;

        res.json({
            success: true,
            redirectUrl: '/dashboard'
        });
    } catch (error) {
        console.error('Signup error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Failed to create account',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await User.verifyPassword(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Log them in
        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.fullName = user.full_name;

        res.json({
            success: true,
            redirectUrl: '/dashboard'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to log in' });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// ============================================
// DEMO ROUTES (No login required - with fake data)
// ============================================

// Demo Dashboard
app.get('/demo', (req, res) => {
    const demoUser = {
        id: 999,
        full_name: 'Demo User',
        email: 'demo@almasterclass.com',
        affiliate_code: 'DEMO123ABC',
        subscription_status: 'free'
    };

    const demoStats = {
        total_referrals: 12,
        active_referrals: 5,
        total_commissions_earned: 423.50,
        pending_commissions: 141.00,
        paid_commissions: 282.50
    };

    const demoAffiliateLink = `${process.env.BASE_URL || 'http://localhost:3000'}/join?ref=DEMO123ABC`;

    res.render('dashboard', {
        user: demoUser,
        affiliateStats: demoStats,
        affiliateLink: demoAffiliateLink
    });
});

// Demo Affiliate Page
app.get('/demo/affiliate', (req, res) => {
    const demoUser = {
        id: 999,
        full_name: 'Demo User',
        email: 'demo@almasterclass.com',
        affiliate_code: 'DEMO123ABC'
    };

    const demoStats = {
        total_referrals: 12,
        active_referrals: 5,
        total_commissions_earned: 423.50,
        pending_commissions: 141.00,
        paid_commissions: 282.50
    };

    const demoReferrals = [
        {
            full_name: 'Sarah Johnson',
            email: 'sarah@example.com',
            signup_date: new Date('2024-11-15'),
            status: 'upgraded',
            upgraded_at: new Date('2024-12-01')
        },
        {
            full_name: 'Ahmed Hassan',
            email: 'ahmed@example.com',
            signup_date: new Date('2024-12-10'),
            status: 'upgraded',
            upgraded_at: new Date('2024-12-15')
        },
        {
            full_name: 'Maria Garcia',
            email: 'maria@example.com',
            signup_date: new Date('2025-01-02'),
            status: 'upgraded',
            upgraded_at: new Date('2025-01-02')
        },
        {
            full_name: 'John Smith',
            email: 'john@example.com',
            signup_date: new Date('2024-10-20'),
            status: 'upgraded',
            upgraded_at: new Date('2024-11-05')
        },
        {
            full_name: 'Lisa Chen',
            email: 'lisa@example.com',
            signup_date: new Date('2024-11-28'),
            status: 'upgraded',
            upgraded_at: new Date('2024-12-20')
        },
        {
            full_name: 'Omar Al-Rahman',
            email: 'omar@example.com',
            signup_date: new Date('2024-12-05'),
            status: 'free',
            upgraded_at: null
        },
        {
            full_name: 'Jennifer Lopez',
            email: 'jennifer@example.com',
            signup_date: new Date('2024-12-18'),
            status: 'free',
            upgraded_at: null
        }
    ];

    const demoAffiliateLink = `${process.env.BASE_URL || 'http://localhost:3000'}/join?ref=DEMO123ABC`;

    res.render('affiliate', {
        user: demoUser,
        affiliateStats: demoStats,
        referrals: demoReferrals,
        affiliateLink: demoAffiliateLink
    });
});

// Demo Upgrade Page
app.get('/demo/upgrade', (req, res) => {
    const demoUser = {
        id: 999,
        full_name: 'Demo User',
        subscription_status: 'free'
    };

    res.render('upgrade', {
        user: demoUser,
        monthlyPriceId: 'price_demo_monthly',
        yearlyPriceId: 'price_demo_yearly'
    });
});

// ============================================
// PROTECTED ROUTES
// ============================================

// Dashboard
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const affiliateStats = await User.getAffiliateStats(user.id);
        const affiliateLink = generateAffiliateLink(
            process.env.BASE_URL || `http://localhost:${PORT}`,
            user.affiliate_code
        );

        res.render('dashboard', {
            user,
            affiliateStats: affiliateStats || {
                total_referrals: 0,
                active_referrals: 0,
                total_commissions_earned: 0,
                pending_commissions: 0,
                paid_commissions: 0
            },
            affiliateLink
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Affiliate page
app.get('/affiliate', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const affiliateStats = await User.getAffiliateStats(user.id);
        const referrals = await User.getReferrals(user.id);
        const affiliateLink = generateAffiliateLink(
            process.env.BASE_URL || `http://localhost:${PORT}`,
            user.affiliate_code
        );

        res.render('affiliate', {
            user,
            affiliateStats: affiliateStats || {},
            referrals,
            affiliateLink
        });
    } catch (error) {
        console.error('Affiliate page error:', error);
        res.status(500).send('Error loading affiliate page');
    }
});

// Upgrade to premium
app.get('/upgrade', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        res.render('upgrade', {
            user,
            monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID,
            yearlyPriceId: process.env.STRIPE_YEARLY_PRICE_ID
        });
    } catch (error) {
        console.error('Upgrade page error:', error);
        res.status(500).send('Error loading upgrade page');
    }
});

// ============================================
// STRIPE ROUTES
// ============================================

// Create checkout session
app.post('/api/stripe/create-checkout', requireAuth, async (req, res) => {
    try {
        const { priceId } = req.body;
        const userId = req.session.userId;

        const session = await StripeService.createCheckoutSession(
            userId,
            priceId,
            `${process.env.BASE_URL || `http://localhost:${PORT}`}/upgrade/success`,
            `${process.env.BASE_URL || `http://localhost:${PORT}`}/upgrade`
        );

        res.json({ sessionId: session.id });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Stripe webhook
app.post('/api/stripe/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        await StripeService.handleWebhook(event);

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

// Customer portal
app.post('/api/stripe/portal', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);

        if (!user.stripe_customer_id) {
            return res.status(400).json({ error: 'No active subscription' });
        }

        const session = await StripeService.createPortalSession(
            user.stripe_customer_id,
            `${process.env.BASE_URL || `http://localhost:${PORT}`}/dashboard`
        );

        res.json({ url: session.url });
    } catch (error) {
        console.error('Portal error:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`\n🚀 Masterclass Platform Running!`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Copy .env.example to .env and add your Stripe keys`);
    console.log(`   2. Run: npm run migrate (to set up database)`);
    console.log(`   3. Visit http://localhost:${PORT}/join to create an account\n`);
});
