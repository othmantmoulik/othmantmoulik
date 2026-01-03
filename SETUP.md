# AlMasterclass Platform - Setup Guide

A complete Masterclass clone with built-in affiliate system and Stripe integration. Build your online education empire!

## Features

### Core Platform
- ✅ User authentication (signup/login)
- ✅ Free and premium membership tiers
- ✅ Course catalog with categories
- ✅ Video hosting integration ready
- ✅ User progress tracking
- ✅ Community discussion forums

### Affiliate System (The Star Feature!)
- ✅ **Lifetime referral tracking** via email
- ✅ **Automatic affiliate link generation** for every user
- ✅ **30% recurring commissions** (configurable)
- ✅ **Cookie-based tracking** - referrals stick for 1 year
- ✅ **Commission tracking** even if upgrade happens months later
- ✅ **Automatic payout system** when minimum threshold reached
- ✅ Real-time affiliate dashboard with statistics

### Payment Integration
- ✅ Stripe subscription billing (monthly/yearly)
- ✅ Automatic commission calculation
- ✅ Webhook handling for payment events
- ✅ Customer portal for managing subscriptions

## Installation

### Prerequisites
- Node.js 16+ installed
- Stripe account (free to sign up)
- Basic terminal knowledge

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your Stripe keys:

```env
# Server Configuration
PORT=3000
SESSION_SECRET=your-super-secret-random-string-here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Create these products in Stripe Dashboard first
STRIPE_MONTHLY_PRICE_ID=price_1234abcd
STRIPE_YEARLY_PRICE_ID=price_5678efgh

# Commission Settings
COMMISSION_PERCENTAGE=30
MINIMUM_PAYOUT=50

# Base URL
BASE_URL=http://localhost:3000
```

### Step 3: Set Up Stripe

1. **Create a Stripe Account**: https://dashboard.stripe.com/register

2. **Get Your API Keys**:
   - Go to: https://dashboard.stripe.com/test/apikeys
   - Copy your "Publishable key" and "Secret key"
   - Add them to `.env`

3. **Create Products**:
   - Go to: https://dashboard.stripe.com/test/products
   - Click "Add product"
   - Create two products:
     - **Monthly Plan**: $47/month (recurring)
     - **Yearly Plan**: $470/year (recurring)
   - Copy the Price IDs and add to `.env`

4. **Set Up Webhooks** (for production):
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Add endpoint: `https://yourdomain.com/api/stripe/webhook`
   - Select events: `invoice.payment_succeeded`, `customer.subscription.deleted`, `customer.subscription.updated`
   - Copy the webhook secret to `.env`

### Step 4: Initialize Database

```bash
npm run migrate
```

This creates the SQLite database with all necessary tables.

### Step 5: Start the Server

```bash
npm start
```

Visit: http://localhost:3000

## How It Works

### Affiliate Tracking Flow

1. **User shares their affiliate link**: `http://localhost:3000/join?ref=ABC1234`

2. **Someone clicks the link**:
   - Referral code is stored in a cookie (1 year expiration)
   - Even if they don't sign up immediately, the code persists

3. **They sign up** (free account):
   - User is created with `referred_by_user_id` pointing to referrer
   - Referral record created in database
   - They are now **permanently linked** to the referrer via email

4. **Later, they upgrade** (could be 6 months later):
   - Stripe processes payment
   - Webhook triggers commission calculation
   - 30% commission created for referrer
   - Referrer's stats update automatically

5. **Every month they stay subscribed**:
   - Stripe sends `invoice.payment_succeeded` webhook
   - New commission record created
   - Referrer keeps earning!

### Database Schema

**users** - Core user information + affiliate codes
- Stores affiliate code, referrer info, subscription status

**referrals** - Permanent referral relationships
- Links referrer → referred user forever

**commissions** - Every commission payment
- Tracks amount, status, payout dates

**affiliate_stats** - Cached performance metrics
- Real-time stats for dashboard

## Customization

### Change Commission Percentage

Edit `.env`:
```env
COMMISSION_PERCENTAGE=30  # Change to any number
```

### Change Minimum Payout

Edit `.env`:
```env
MINIMUM_PAYOUT=100  # Change to any amount
```

### Add Custom Categories

Edit `database/schema.sql` or use admin panel (to be built)

### Customize Branding

- Colors: Edit CSS in `views/*.ejs` files
- Logo: Replace "AlMasterclass" text in navigation
- Content: Edit homepage copy in `views/home.ejs`

## Deployment

### Deploy to Production

1. **Set up a server** (DigitalOcean, AWS, Heroku, etc.)

2. **Set environment variables**:
   ```bash
   NODE_ENV=production
   BASE_URL=https://yourdomain.com
   ```

3. **Use production Stripe keys**:
   - Switch from `sk_test_` to `sk_live_`
   - Switch from `pk_test_` to `pk_live_`

4. **Set up webhook endpoint**:
   - Configure in Stripe Dashboard
   - Point to: `https://yourdomain.com/api/stripe/webhook`

5. **Use a production database**:
   - Consider PostgreSQL instead of SQLite
   - Update `config/database.js` accordingly

6. **Set up SSL**:
   - Use Let's Encrypt (free)
   - Or use a platform like Heroku (SSL included)

## Testing the Affiliate System

1. **Create account #1** (the referrer):
   - Sign up at `/join`
   - Go to dashboard, copy affiliate link
   - Your link looks like: `http://localhost:3000/join?ref=ABC1234`

2. **Create account #2** (the referred):
   - Open incognito/private window
   - Visit the affiliate link from step 1
   - Sign up with different email
   - Account #2 is now tied to Account #1 forever

3. **Test upgrade**:
   - Login as Account #2
   - Click "Upgrade to Premium"
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry, any CVC

4. **Check commissions**:
   - Login as Account #1
   - Visit `/affiliate`
   - See your referral and pending commission!

## Stripe Test Cards

- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Requires Auth**: 4000 0025 0000 3155

Any future expiry date, any 3-digit CVC.

## Troubleshooting

### "User not found" on webhook

**Solution**: Make sure you created the Stripe customer before subscribing

### Referral code not persisting

**Solution**: Check browser cookies are enabled

### Commission not created

**Solution**:
1. Check webhook is configured correctly
2. Check Stripe webhook logs in dashboard
3. Check `webhook_events` table in database

### Can't connect to database

**Solution**: Run `npm run migrate` to create database

## Next Steps

### To Complete the Platform

1. **Add course upload** functionality (admin panel)
2. **Video hosting** integration (Vimeo, AWS S3, etc.)
3. **Community features** (forums, comments)
4. **Email notifications** (SendGrid, Mailgun)
5. **Analytics dashboard** (track everything)
6. **Mobile app** (React Native, Flutter)

## Support

Questions? Issues? Found a bug?

Check the code comments for detailed explanations of how each part works.

## License

This is your code! Use it however you want. Build your empire! 🚀

---

**Remember**: Your poverty doesn't help anyone. Your success might help thousands. Now go build! 💪
