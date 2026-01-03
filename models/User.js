const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateAffiliateCode } = require('../utils/affiliate');

class User {
    /**
     * Create a new user
     */
    static async create({ email, password, fullName, referredByCode = null }) {
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Generate unique affiliate code
        let affiliateCode = generateAffiliateCode(fullName);

        // Ensure affiliate code is unique
        let isUnique = false;
        while (!isUnique) {
            const existing = await db.get('SELECT id FROM users WHERE affiliate_code = ?', [affiliateCode]);
            if (!existing) {
                isUnique = true;
            } else {
                affiliateCode = generateAffiliateCode(fullName);
            }
        }

        // Find referrer if code provided
        let referredByUserId = null;
        if (referredByCode) {
            const referrer = await db.get('SELECT id FROM users WHERE affiliate_code = ?', [referredByCode]);
            if (referrer) {
                referredByUserId = referrer.id;
            }
        }

        // Create user
        const result = await db.run(
            `INSERT INTO users (email, password_hash, full_name, affiliate_code, referred_by_code, referred_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [email, passwordHash, fullName, affiliateCode, referredByCode, referredByUserId]
        );

        // If user was referred, create referral record
        if (referredByUserId) {
            await db.run(
                `INSERT INTO referrals (referrer_user_id, referred_user_id, referred_email, referral_code_used)
                 VALUES (?, ?, ?, ?)`,
                [referredByUserId, result.id, email, referredByCode]
            );

            // Update affiliate stats
            await this.updateAffiliateStats(referredByUserId);
        }

        return result.id;
    }

    /**
     * Find user by email
     */
    static async findByEmail(email) {
        return await db.get('SELECT * FROM users WHERE email = ?', [email]);
    }

    /**
     * Find user by ID
     */
    static async findById(id) {
        return await db.get('SELECT * FROM users WHERE id = ?', [id]);
    }

    /**
     * Find user by affiliate code
     */
    static async findByAffiliateCode(code) {
        return await db.get('SELECT * FROM users WHERE affiliate_code = ?', [code]);
    }

    /**
     * Verify user password
     */
    static async verifyPassword(password, passwordHash) {
        return await bcrypt.compare(password, passwordHash);
    }

    /**
     * Update user subscription status
     */
    static async updateSubscription(userId, { status, plan, stripeCustomerId, stripeSubscriptionId }) {
        const updates = [];
        const values = [];

        if (status) {
            updates.push('subscription_status = ?');
            values.push(status);
        }

        if (plan) {
            updates.push('subscription_plan = ?');
            values.push(plan);
        }

        if (stripeCustomerId) {
            updates.push('stripe_customer_id = ?');
            values.push(stripeCustomerId);
        }

        if (stripeSubscriptionId) {
            updates.push('stripe_subscription_id = ?');
            values.push(stripeSubscriptionId);
        }

        // Set upgrade date if going from free to paid
        if (status === 'active') {
            updates.push('upgraded_at = CURRENT_TIMESTAMP');
            updates.push('last_payment_date = CURRENT_TIMESTAMP');
        }

        values.push(userId);

        await db.run(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // If user upgraded, update referral status
        if (status === 'active') {
            await this.handleUserUpgrade(userId);
        }
    }

    /**
     * Handle when a user upgrades to paid
     */
    static async handleUserUpgrade(userId) {
        const user = await this.findById(userId);

        if (!user.referred_by_user_id) {
            return; // No referrer
        }

        // Update referral status
        await db.run(
            `UPDATE referrals
             SET status = 'upgraded', upgrade_date = CURRENT_TIMESTAMP
             WHERE referred_user_id = ?`,
            [userId]
        );

        // Update affiliate stats for referrer
        await this.updateAffiliateStats(user.referred_by_user_id);
    }

    /**
     * Update affiliate stats for a user
     */
    static async updateAffiliateStats(userId) {
        const stats = await db.get(
            `SELECT
                COUNT(*) as total_referrals,
                SUM(CASE WHEN status = 'upgraded' THEN 1 ELSE 0 END) as active_referrals
             FROM referrals
             WHERE referrer_user_id = ?`,
            [userId]
        );

        const commissions = await db.get(
            `SELECT
                SUM(amount) as total_earned,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid
             FROM commissions
             WHERE referrer_user_id = ?`,
            [userId]
        );

        await db.run(
            `INSERT INTO affiliate_stats (user_id, total_referrals, active_referrals, total_commissions_earned, pending_commissions, paid_commissions, last_updated)
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(user_id) DO UPDATE SET
                total_referrals = excluded.total_referrals,
                active_referrals = excluded.active_referrals,
                total_commissions_earned = excluded.total_commissions_earned,
                pending_commissions = excluded.pending_commissions,
                paid_commissions = excluded.paid_commissions,
                last_updated = CURRENT_TIMESTAMP`,
            [
                userId,
                stats.total_referrals || 0,
                stats.active_referrals || 0,
                commissions.total_earned || 0,
                commissions.pending || 0,
                commissions.paid || 0
            ]
        );
    }

    /**
     * Get user's referrals
     */
    static async getReferrals(userId) {
        return await db.all(
            `SELECT r.*, u.email, u.full_name, u.subscription_status, u.upgraded_at
             FROM referrals r
             JOIN users u ON r.referred_user_id = u.id
             WHERE r.referrer_user_id = ?
             ORDER BY r.signup_date DESC`,
            [userId]
        );
    }

    /**
     * Get user's affiliate stats
     */
    static async getAffiliateStats(userId) {
        return await db.get(
            'SELECT * FROM affiliate_stats WHERE user_id = ?',
            [userId]
        );
    }
}

module.exports = User;
