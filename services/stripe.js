const Stripe = require('stripe');
const db = require('../config/database');
const User = require('../models/User');
const { calculateCommission } = require('../utils/affiliate');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
    /**
     * Create a Stripe customer
     */
    static async createCustomer(email, name) {
        return await stripe.customers.create({
            email,
            name,
            metadata: {
                platform: 'masterclass'
            }
        });
    }

    /**
     * Create a subscription checkout session
     */
    static async createCheckoutSession(userId, priceId, successUrl, cancelUrl) {
        const user = await User.findById(userId);

        // Create customer if doesn't exist
        let customerId = user.stripe_customer_id;
        if (!customerId) {
            const customer = await this.createCustomer(user.email, user.full_name);
            customerId = customer.id;

            await db.run(
                'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
                [customerId, userId]
            );
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                user_id: userId
            },
            subscription_data: {
                metadata: {
                    user_id: userId
                }
            }
        });

        return session;
    }

    /**
     * Create a customer portal session for managing subscription
     */
    static async createPortalSession(customerId, returnUrl) {
        return await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
    }

    /**
     * Handle successful subscription payment
     */
    static async handleSubscriptionPayment(invoice) {
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        const amountPaid = invoice.amount_paid / 100; // Convert from cents

        // Find user by Stripe customer ID
        const user = await db.get(
            'SELECT * FROM users WHERE stripe_customer_id = ?',
            [customerId]
        );

        if (!user) {
            console.error('User not found for customer:', customerId);
            return;
        }

        // Update user's subscription status
        await User.updateSubscription(user.id, {
            status: 'active',
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId
        });

        // If user was referred, process commission
        if (user.referred_by_user_id) {
            await this.processCommission(user.id, user.referred_by_user_id, amountPaid, invoice.charge);
        }

        console.log(`✓ Subscription payment processed for user ${user.email}: $${amountPaid}`);
    }

    /**
     * Process commission for a referral
     */
    static async processCommission(referredUserId, referrerUserId, paymentAmount, chargeId) {
        const commissionPercentage = parseFloat(process.env.COMMISSION_PERCENTAGE || 30);
        const commissionAmount = calculateCommission(paymentAmount, commissionPercentage);

        // Create commission record
        await db.run(
            `INSERT INTO commissions
             (referrer_user_id, referred_user_id, amount, subscription_payment_amount, commission_percentage, stripe_charge_id, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [referrerUserId, referredUserId, commissionAmount, paymentAmount, commissionPercentage, chargeId]
        );

        // Update affiliate stats
        await User.updateAffiliateStats(referrerUserId);

        console.log(`✓ Commission created: $${commissionAmount} for user ${referrerUserId}`);

        // Check if referrer has reached minimum payout threshold
        const stats = await User.getAffiliateStats(referrerUserId);
        const minimumPayout = parseFloat(process.env.MINIMUM_PAYOUT || 50);

        if (stats.pending_commissions >= minimumPayout) {
            // You can trigger automatic payout here or notify admin
            console.log(`💰 User ${referrerUserId} has reached payout threshold: $${stats.pending_commissions}`);
        }
    }

    /**
     * Handle subscription canceled
     */
    static async handleSubscriptionCanceled(subscription) {
        const customerId = subscription.customer;

        const user = await db.get(
            'SELECT * FROM users WHERE stripe_customer_id = ?',
            [customerId]
        );

        if (!user) {
            console.error('User not found for customer:', customerId);
            return;
        }

        await User.updateSubscription(user.id, {
            status: 'canceled'
        });

        // Update referral status
        if (user.referred_by_user_id) {
            await db.run(
                `UPDATE referrals SET status = 'churned' WHERE referred_user_id = ?`,
                [user.id]
            );

            await User.updateAffiliateStats(user.referred_by_user_id);
        }

        console.log(`✓ Subscription canceled for user ${user.email}`);
    }

    /**
     * Process webhook from Stripe
     */
    static async handleWebhook(event) {
        // Log webhook event
        await db.run(
            `INSERT INTO webhook_events (event_id, event_type, customer_id, subscription_id, raw_data)
             VALUES (?, ?, ?, ?, ?)`,
            [
                event.id,
                event.type,
                event.data.object.customer || null,
                event.data.object.subscription || null,
                JSON.stringify(event)
            ]
        );

        // Handle different event types
        switch (event.type) {
            case 'invoice.payment_succeeded':
                await this.handleSubscriptionPayment(event.data.object);
                break;

            case 'customer.subscription.deleted':
            case 'customer.subscription.canceled':
                await this.handleSubscriptionCanceled(event.data.object);
                break;

            case 'customer.subscription.updated':
                // Handle subscription updates (e.g., plan changes)
                const subscription = event.data.object;
                const user = await db.get(
                    'SELECT * FROM users WHERE stripe_customer_id = ?',
                    [subscription.customer]
                );

                if (user) {
                    await User.updateSubscription(user.id, {
                        status: subscription.status
                    });
                }
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Mark event as processed
        await db.run(
            'UPDATE webhook_events SET processed = 1 WHERE event_id = ?',
            [event.id]
        );
    }

    /**
     * Get subscription details
     */
    static async getSubscription(subscriptionId) {
        return await stripe.subscriptions.retrieve(subscriptionId);
    }

    /**
     * Cancel subscription
     */
    static async cancelSubscription(subscriptionId) {
        return await stripe.subscriptions.cancel(subscriptionId);
    }

    /**
     * Payout commissions to affiliate (manual trigger)
     */
    static async payoutCommissions(userId) {
        const user = await User.findById(userId);
        const pendingCommissions = await db.all(
            `SELECT * FROM commissions
             WHERE referrer_user_id = ? AND status = 'pending'`,
            [userId]
        );

        if (pendingCommissions.length === 0) {
            return { success: false, message: 'No pending commissions' };
        }

        const totalAmount = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);

        // Here you would integrate with Stripe Connect or manual payout
        // For now, we'll mark as paid and log
        const commissionIds = pendingCommissions.map(c => c.id);

        await db.run(
            `UPDATE commissions
             SET status = 'paid', payout_date = CURRENT_TIMESTAMP
             WHERE id IN (${commissionIds.join(',')})`,
            []
        );

        await User.updateAffiliateStats(userId);

        console.log(`✓ Paid out $${totalAmount} to ${user.email}`);

        return { success: true, amount: totalAmount };
    }
}

module.exports = StripeService;
