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
        res.status(500).json({ error: 'Failed to create account' });
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
