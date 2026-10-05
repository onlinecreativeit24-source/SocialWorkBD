# 🔐 SocialWorkBD Security Policy

## Overview
This document outlines the security measures and best practices implemented in SocialWorkBD.

---

## 1. Environment Variables & API Keys

### ✅ DO
- Store all API keys, tokens, and secrets in `.env` file
- Never commit `.env` file to version control
- Use `.gitignore` to exclude sensitive files
- Rotate keys regularly (especially PayPal, Firebase credentials)
- Use different keys for development, staging, and production

### ❌ DON'T
- Hardcode API keys in JavaScript files
- Commit Firebase config with real keys to GitHub
- Use the same keys across environments
- Share production keys via email or chat

### Setup Instructions
```bash
# Copy the example file
cp .env.example .env

# Edit and add your real configuration
nano .env

# Verify .env is in .gitignore
cat .gitignore | grep "^\.env"
```

---

## 2. Firestore Security Rules

### Authentication-Based Access Control
- Users can only access their own data
- Admin and superadmin roles have elevated permissions
- Financial data (balance, transactions) cannot be modified by clients

### Payment Security
- Payment requests must be created with valid amounts (1-10,000 USD)
- Only admins can approve/reject payments
- Transactions are immutable (cannot be modified or deleted)

### Implement Rules
```bash
# Deploy to Firebase
firebase deploy --only firestore:rules
```

---

## 3. Input Validation & Sanitization

### Validation Layers
1. **Client-side** - Immediate feedback to user
2. **Firestore Rules** - Enforce at database level
3. **Backend** - Additional validation (if using Cloud Functions)

### Implemented Validations
- Email format validation
- Password strength requirements (min 6 characters)
- Monetary amount validation (positive, max limit)
- Off-platform contact detection (prevents users sharing external contact info)
- HTML/XSS escape for all user-generated content

### Usage Example
```javascript
// Use validation utilities
const amount = ValidationUtils.validateAmount(userInput);
if (!amount) {
  alert('Invalid amount. Please enter 1-10,000 USD.');
  return;
}

// Use XSS protection
const safeText = ValidationUtils.escapeHtml(userInput);
document.getElementById('display').innerHTML = safeText;
```

---

## 4. Authentication & Session Management

### Firebase Authentication
- Email/password authentication
- Google OAuth integration
- Password reset functionality

### Session Security
- Sessions stored in localStorage (non-sensitive data only)
- Balance and payment info fetched fresh from database
- Automatic logout on account suspension
- Session timeout monitoring (optional 15-minute timeout)

### Best Practices
```javascript
// ✅ Store only non-sensitive data
const safeData = {
  id: user.uid,
  name: user.name,
  email: user.email,
  role: user.role
};
localStorage.setItem('currentUser', JSON.stringify(safeData));

// ❌ Don't store sensitive data
// localStorage.setItem('balance', user.balance); // WRONG!

// Fetch sensitive data from Firebase
const profile = await loadUserProfile(user.uid);
const balance = profile.balance; // Fresh from DB
```

---

## 5. Payment Security

### PayPal Integration
- Manual payment verification by admin
- User provides PayPal transaction reference
- Admin verifies reference before crediting wallet
- All transactions logged for audit trail

### Fraud Prevention
- Rate limiting on payment requests (max 5 per minute)
- Amount validation (min $1, max $10,000)
- Duplicate payment detection
- Admin must manually approve all payments

### Admin Verification Process
1. User submits payment request with PayPal reference
2. Admin reviews payment requests dashboard
3. Admin verifies with PayPal
4. Admin approves and system credits wallet
5. Transaction recorded in audit log

---

## 6. Data Protection

### GDPR & Privacy Compliance
- Users can delete their account
- User data is only used for service delivery
- No data sharing with third parties (except Firebase, PayPal)
- Clear privacy policy provided

### Data Deletion
Users can request data deletion through support. Implementation:
```javascript
async function deleteUserData(uid) {
  // Delete user profile
  await db.collection('users').doc(uid).delete();
  
  // Delete user's jobs
  const jobs = await db.collection('jobs')
    .where('ownerId', '==', uid).get();
  jobs.forEach(doc => doc.ref.delete());
  
  // Delete user's transactions (keep for audit)
  // Note: Keep transaction logs for legal compliance
  
  // Delete Firebase Auth user
  await admin.auth().deleteUser(uid);
}
```

---

## 7. Rate Limiting & DDoS Protection

### Implemented Rate Limits
- 5 payment requests per minute per user
- 10 job posts per hour per user
- 20 proposals per day per user

### Firebase Limits
- Firestore: 20,000 reads/second default
- Use composite indexes for complex queries
- Monitor usage in Firebase Console

---

## 8. XSS Protection

### Content Security Policy (CSP)
Meta tag enforcement (ideally set via server headers):
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://www.gstatic.com/firebasejs/;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://firebase.googleapis.com;
">
```

### XSS Prevention
- All user input escaped before display
- Use `textContent` instead of `innerHTML` when possible
- Validate all data from Firebase

```javascript
// ✅ Safe - escapes HTML
const name = escapeHtml(userInput);
element.textContent = name;

// ❌ Dangerous - allows HTML injection
element.innerHTML = userInput;
```

---

## 9. CSRF Protection

### Implementation
```javascript
// Generate token for forms
const csrfToken = generateCSRFToken();
sessionStorage.setItem('csrfToken', csrfToken);

// Validate on submission
const userToken = document.querySelector('[name="csrf"]').value;
if (!validateCSRFToken(userToken, csrfToken)) {
  throw new Error('CSRF validation failed');
}
```

---

## 10. Admin Security

### Admin Access Control
- Only users with 'admin' or 'superadmin' role can access admin panel
- Admin access verified both client-side and server-side
- All admin actions logged
- Require 2FA for admin accounts (optional)

### Admin Operations
- Approve/reject payment requests
- View user information
- Monitor fraud/violations
- Generate reports

---

## 11. Monitoring & Logging

### Security Events to Log
- Failed login attempts
- Unusual transaction amounts
- Off-platform contact attempts
- Admin actions
- Payment approvals/rejections

### Logging Implementation
```javascript
function logSecurityEvent(eventType, details) {
  const event = {
    timestamp: new Date().toISOString(),
    type: eventType,
    details: details
  };
  
  // Send to backend logging service
  fetch('/api/security-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
}
```

---

## 12. Incident Response

### If You Discover a Security Issue
1. **Do NOT** publicly disclose the vulnerability
2. Email security team: security@socialworkbd.com
3. Provide detailed steps to reproduce
4. Allow 30 days for us to fix before disclosure
5. We'll acknowledge receipt within 24 hours

### Breach Response Plan
1. Immediately revoke compromised credentials
2. Notify affected users
3. Force password reset if needed
4. Review logs to determine scope
5. Patch vulnerability
6. Communicate incident details transparently

---

## 13. Dependencies & Vulnerabilities

### Regular Security Audits
```bash
# Check for vulnerabilities in npm packages
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Check for outdated packages
npm outdated
```

### Keep Firebase Updated
- Monitor Firebase Console for security notices
- Update firebase SDK regularly
- Review Firebase security advisories

---

## 14. Third-Party Services

### Firebase
- Google-managed security
- Automatic SSL/TLS encryption
- SOC 2 Type II certified
- GDPR compliant

### PayPal
- PCI DSS Level 1 certified
- All transactions encrypted
- Fraud detection built-in
- Full audit trail

---

## 15. Amazon AppStore Compliance

### Required for App Store Submission
- ✅ Privacy Policy (updated)
- ✅ Terms of Service (updated)
- ✅ Data deletion capability
- ✅ Secure HTTPS connections
- ✅ Authentication security
- ✅ Payment security
- ✅ Age-appropriate content
- ✅ Permissions justify (Internet only)

### Testing Before Submission
```bash
# Security checklist
- [ ] No hardcoded API keys
- [ ] HTTPS enforced
- [ ] Sensitive data not in localStorage
- [ ] Input validation working
- [ ] Firestore rules deployed
- [ ] Admin functions protected
- [ ] User can delete account
- [ ] Privacy policy displayed
```

---

## 16. Security Checklist for Deployment

```markdown
Pre-Deployment Security Checklist:

Firebase
- [ ] API keys in .env file
- [ ] Firestore rules deployed
- [ ] Firebase Console restricted to admins
- [ ] Backups enabled
- [ ] Monitoring alerts configured

Application
- [ ] No console.log of sensitive data
- [ ] XSS protection enabled
- [ ] CSRF protection implemented
- [ ] Input validation on all forms
- [ ] Rate limiting enabled
- [ ] Session timeout configured

Admin Panel
- [ ] 2FA enforced (optional)
- [ ] All actions logged
- [ ] Access restricted to admins only
- [ ] Audit trail enabled

Deployment
- [ ] HTTPS certificate valid
- [ ] Security headers configured
- [ ] SSL/TLS version 1.2+
- [ ] Certificate pinning (optional)
- [ ] Backup and recovery tested

Monitoring
- [ ] Error logging configured
- [ ] Security event logging active
- [ ] Alerts configured for anomalies
- [ ] Regular security audits scheduled
```

---

## 17. Useful Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Best Practices](https://firebase.google.com/docs/database/security)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

## Questions?
For security questions or concerns, please reach out to the development team.

**Last Updated**: January 2026
**Version**: 1.0
