const crypto = require('crypto');

/**
 * Generate a unique affiliate code for a user
 * Format: First 3 letters of name + random string
 */
function generateAffiliateCode(fullName) {
    const namePrefix = fullName
        .replace(/[^a-zA-Z]/g, '')
        .substring(0, 3)
        .toUpperCase();

    const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();

    return `${namePrefix}${randomSuffix}`;
}

/**
 * Calculate commission amount based on payment and percentage
 */
function calculateCommission(paymentAmount, commissionPercentage) {
    return (paymentAmount * commissionPercentage) / 100;
}

/**
 * Generate affiliate link for a user
 */
function generateAffiliateLink(baseUrl, affiliateCode) {
    return `${baseUrl}/join?ref=${affiliateCode}`;
}

/**
 * Parse referral code from various formats
 */
function parseReferralCode(refParam) {
    if (!refParam) return null;

    // Clean and validate the referral code
    const cleaned = refParam.trim().toUpperCase();

    // Basic validation (alphanumeric, reasonable length)
    if (/^[A-Z0-9]{5,20}$/.test(cleaned)) {
        return cleaned;
    }

    return null;
}

module.exports = {
    generateAffiliateCode,
    calculateCommission,
    generateAffiliateLink,
    parseReferralCode
};
