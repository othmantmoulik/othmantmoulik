-- Users table: Core user information with affiliate tracking
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    affiliate_code TEXT UNIQUE NOT NULL,
    referred_by_code TEXT,
    referred_by_user_id INTEGER,
    subscription_status TEXT DEFAULT 'free', -- free, active, canceled, past_due
    subscription_plan TEXT, -- monthly, yearly
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    upgraded_at DATETIME,
    last_payment_date DATETIME,
    profile_image TEXT,
    bio TEXT,
    FOREIGN KEY (referred_by_user_id) REFERENCES users(id)
);

-- Referrals table: Track all referral relationships permanently
CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_user_id INTEGER NOT NULL,
    referred_user_id INTEGER NOT NULL,
    referred_email TEXT NOT NULL,
    referral_code_used TEXT NOT NULL,
    signup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    upgrade_date DATETIME,
    status TEXT DEFAULT 'free', -- free, upgraded, churned
    lifetime_value REAL DEFAULT 0,
    FOREIGN KEY (referrer_user_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id),
    UNIQUE(referrer_user_id, referred_user_id)
);

-- Commissions table: Track every commission payment
CREATE TABLE IF NOT EXISTS commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_user_id INTEGER NOT NULL,
    referred_user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    subscription_payment_amount REAL NOT NULL,
    commission_percentage REAL NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    stripe_charge_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, paid, failed
    payout_date DATETIME,
    stripe_payout_id TEXT,
    FOREIGN KEY (referrer_user_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

-- Content Categories table: Organize courses into categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    access_level TEXT DEFAULT 'free', -- free, premium
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Courses table: Individual courses/masterclasses
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    instructor_name TEXT,
    category_id INTEGER,
    access_level TEXT DEFAULT 'free', -- free, premium
    thumbnail_url TEXT,
    duration_minutes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published BOOLEAN DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Lessons table: Individual video lessons within courses
CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    video_duration INTEGER,
    lesson_order INTEGER DEFAULT 0,
    access_level TEXT DEFAULT 'free', -- free, premium
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- User Progress table: Track what users have watched
CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed BOOLEAN DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    last_watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id),
    UNIQUE(user_id, lesson_id)
);

-- Community Posts table: Discussion forum
CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Community Comments table: Comments on posts
CREATE TABLE IF NOT EXISTS community_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    likes_count INTEGER DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES community_posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Affiliate Stats table: Cache affiliate performance metrics
CREATE TABLE IF NOT EXISTS affiliate_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_referrals INTEGER DEFAULT 0,
    active_referrals INTEGER DEFAULT 0,
    total_commissions_earned REAL DEFAULT 0,
    pending_commissions REAL DEFAULT 0,
    paid_commissions REAL DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id)
);

-- Webhook Events table: Log Stripe webhook events for debugging
CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    customer_id TEXT,
    subscription_id TEXT,
    processed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_affiliate_code ON users(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_referrer ON commissions(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
