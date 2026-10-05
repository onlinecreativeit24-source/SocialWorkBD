/* =========================================================
   SocialWorkBD - Input Validation & Sanitization
   ========================================================= */

/**
 * Escape HTML special characters to prevent XSS attacks
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';

  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate and sanitize email
 */
function validateEmail(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return null;
  }

  // Max length check
  if (trimmed.length > 254) {
    return null;
  }

  return trimmed;
}

/**
 * Validate and sanitize password
 */
function validatePassword(password) {
  if (typeof password !== 'string') {
    return null;
  }

  // Must be at least 6 characters
  if (password.length < 6) {
    return null;
  }

  // Maximum 128 characters
  if (password.length > 128) {
    return null;
  }

  return password;
}

/**
 * Validate and parse monetary amount (USD)
 */
function validateAmount(value) {
  // Convert to string and trim
  const trimmed = String(value || '').trim();

  // Check if empty
  if (!trimmed) {
    return null;
  }

  // Parse as float
  const amount = parseFloat(trimmed);

  // Must be a valid number
  if (!Number.isFinite(amount)) {
    return null;
  }

  // Must be positive
  if (amount <= 0) {
    return null;
  }

  // Maximum 999,999.99
  if (amount > 999999.99) {
    return null;
  }

  // Check format: only digits and one decimal point with max 2 decimals
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  // Round to 2 decimal places
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Validate and sanitize text input (general)
 */
function validateText(text, minLength = 1, maxLength = 5000) {
  const trimmed = String(text || '').trim();

  // Check length
  if (trimmed.length < minLength) {
    return null;
  }

  if (trimmed.length > maxLength) {
    return null;
  }

  // Check for suspicious patterns (off-platform contact)
  if (detectOffPlatformMessage(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Validate name/username
 */
function validateName(name, minLength = 2, maxLength = 100) {
  const trimmed = String(name || '').trim();

  if (trimmed.length < minLength || trimmed.length > maxLength) {
    return null;
  }

  // Allow letters, numbers, spaces, hyphens, apostrophes
  if (!/^[a-zA-Z0-9\s\-']+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Validate phone number (basic international format)
 */
function validatePhoneNumber(phone) {
  const trimmed = String(phone || '').trim();

  // Allow +, digits, spaces, hyphens, parentheses
  if (!/^[+]?[\d\s\-()]+$/.test(trimmed)) {
    return null;
  }

  // Must have at least 7 digits
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return null;
  }

  return trimmed;
}

/**
 * Detect off-platform contact information attempts
 * Prevents users from trying to move communication outside the platform
 */
function detectOffPlatformMessage(text) {
  if (!text) return false;

  const value = String(text).toLowerCase();

  const patterns = [
    /https?:\/\//i,           // URLs
    /www\./i,                 // Website domains
    /@[a-z0-9._-]+\.[a-z]{2,}/i, // Email-like patterns
    /\b\d{8,15}\b/i,          // Long phone numbers
    /\bwhatsapp\b/i,
    /\btelegram\b/i,
    /\bdiscord\b/i,
    /\bsignal\b/i,
    /\bmessenger\b/i,
    /\bfacebook\b/i,
    /\binstagram\b/i,
    /\blinkedin\b/i,
    /\btiktok\b/i,
    /\bskype\b/i,
    /\bsnapchat\b/i,
    /\bviber\b/i,
    /\bwechat\b/i
  ];

  return patterns.some(pattern => pattern.test(value));
}

/**
 * Sanitize and validate URL
 */
function validateURL(url) {
  try {
    const trimmed = String(url || '').trim();
    
    if (!trimmed) return null;

    // Create URL object (validates URL format)
    const urlObj = new URL(trimmed);

    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }

    return urlObj.href;
  } catch (error) {
    return null;
  }
}

/**
 * Validate form submission data
 */
function validateFormData(data, schema) {
  const errors = {};

  for (const [field, rules] of Object.entries(schema)) {
    let value = data[field];

    // Required check
    if (rules.required && (!value || String(value).trim() === '')) {
      errors[field] = `${rules.label || field} is required`;
      continue;
    }

    // Type validation
    if (rules.type && value) {
      if (typeof value !== rules.type) {
        errors[field] = `${rules.label || field} must be a ${rules.type}`;
        continue;
      }
    }

    // Custom validator function
    if (rules.validate && value) {
      const validationResult = rules.validate(value);
      if (validationResult !== true) {
        errors[field] = validationResult || `${rules.label || field} is invalid`;
        continue;
      }
    }

    // Min/max length
    if (rules.minLength && String(value).length < rules.minLength) {
      errors[field] = `${rules.label || field} must be at least ${rules.minLength} characters`;
    }

    if (rules.maxLength && String(value).length > rules.maxLength) {
      errors[field] = `${rules.label || field} must be no more than ${rules.maxLength} characters`;
    }
  }

  return Object.keys(errors).length === 0 ? null : errors;
}

/**
 * Rate limiting helper
 */
const rateLimitStore = {};

function checkRateLimit(identifier, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();

  if (!rateLimitStore[identifier]) {
    rateLimitStore[identifier] = [];
  }

  // Clean old attempts outside the time window
  rateLimitStore[identifier] = rateLimitStore[identifier].filter(
    timestamp => now - timestamp < windowMs
  );

  // Check if limit exceeded
  if (rateLimitStore[identifier].length >= maxAttempts) {
    return false;
  }

  // Record new attempt
  rateLimitStore[identifier].push(now);
  return true;
}

/**
 * Generate CSRF token (for forms)
 */
function generateCSRFToken() {
  return Math.random().toString(36).substr(2) + 
         Math.random().toString(36).substr(2);
}

/**
 * Validate CSRF token
 */
function validateCSRFToken(token, sessionToken) {
  if (!token || !sessionToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (token.length !== sessionToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ sessionToken.charCodeAt(i);
  }

  return result === 0;
}

// Export all functions
window.ValidationUtils = {
  escapeHtml,
  validateEmail,
  validatePassword,
  validateAmount,
  validateText,
  validateName,
  validatePhoneNumber,
  detectOffPlatformMessage,
  validateURL,
  validateFormData,
  checkRateLimit,
  generateCSRFToken,
  validateCSRFToken
};
