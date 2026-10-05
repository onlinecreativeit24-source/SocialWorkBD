# 📋 Amazon AppStore Submission Checklist

## ✅ Pre-Submission Requirements

### 1. Account & Credentials
- [ ] Amazon Developer Account created and verified
- [ ] Developer profile completed with name, email, address
- [ ] Payment method added for publishing fees (if applicable)
- [ ] Tax information submitted
- [ ] Valid business/personal identification provided

### 2. App Information
- [ ] App name: **SocialWorkBD**
- [ ] Package name: `com.socialworkbd.app` (example)
- [ ] App version: 1.0.0
- [ ] Minimum API level: Android 6.0+ (API 21+)
- [ ] Target API level: Latest (API 34+)

### 3. App Description
- [ ] Short description (80 chars max): ✅ Done
- [ ] Full description (4000 chars): "A Bangladeshi freelance marketplace where clients post jobs and workers place competitive bids..."
- [ ] Category: Business
- [ ] Sub-category: Productivity
- [ ] Keywords: freelance, marketplace, Bangladesh, jobs, work

### 4. App Permissions
- [ ] Internet permission (✅ required for Firebase/API)
- [ ] No unnecessary permissions requested
- [ ] All permissions justified in description
- [ ] Privacy impact statement added

## 🔒 Security & Privacy Compliance

### Firebase Configuration
- [x] API keys moved to environment variables
- [x] `.env` file created with template
- [x] `firebase-config.js` updated to use env vars
- [x] Sensitive data NOT stored in client-side code
- [x] Firestore security rules deployed (production-safe)

### Data Protection
- [x] Privacy Policy published (privacy-policy.html)
- [x] Terms of Service published (terms-of-service.html)
- [x] GDPR/CCPA compliance statements included
- [x] User data deletion capability implemented
- [x] Data retention policy documented

### Authentication & Payments
- [x] Firebase Authentication configured
- [x] Google OAuth enabled
- [x] Password reset flow working
- [x] PayPal payment integration secure
- [x] Payment verification admin-only
- [x] No credit card data stored (PayPal handles it)
- [x] PCI DSS compliance via PayPal

### Input Validation
- [x] Email validation implemented
- [x] Password strength requirements (min 6 chars)
- [x] Amount validation (1-10000 USD)
- [x] XSS protection (HTML escaping)
- [x] Off-platform contact detection
- [x] Rate limiting on payment requests

## 📱 App Store Requirements

### Content Compliance
- [ ] Age rating: 12+ or higher (no explicit content)
- [ ] No copyright infringement
- [ ] No third-party trademark violations
- [ ] No misleading screenshots
- [ ] No fake or misleading functionality
- [ ] No promised features not implemented
- [ ] No political/religious bias
- [ ] No hate speech or discrimination

### App Functionality
- [ ] Login/registration working
- [ ] Profile creation functional
- [ ] Job posting for clients working
- [ ] Job browsing for workers working
- [ ] Proposal submission working
- [ ] Wallet/payment system functional
- [ ] Messaging system tested
- [ ] All features match description

### Performance & Stability
- [ ] App starts without crashes
- [ ] No memory leaks during extended use
- [ ] Network timeout handling implemented
- [ ] Offline mode graceful degradation
- [ ] Loading indicators on long operations
- [ ] Error messages clear and helpful
- [ ] Back button navigation working correctly
- [ ] No ANR (Application Not Responding) issues

### UI/UX Standards
- [ ] Follows Material Design or modern UI standards
- [ ] Responsive layout for different screen sizes
- [ ] Font sizes readable (min 12sp)
- [ ] Touch targets at least 48dp x 48dp
- [ ] Navigation intuitive and consistent
- [ ] No forced brightness/volume changes
- [ ] Battery consumption reasonable
- [ ] No ads or pop-ups (unless disclosed)

## 📝 Documentation & Assets

### Graphics & Icons
- [ ] App icon (512x512 or 1024x1024 PNG)
- [ ] Feature graphic (1024x500 PNG)
- [ ] Screenshots (minimum 2, recommended 5-8)
  - [ ] English language screenshots
  - [ ] Device: Phone (recommended resolutions)
  - [ ] Showcase key features
  - [ ] High quality, no blur
- [ ] Promo graphic (180x120 PNG, optional)

### Text & Descriptions
- [ ] App title appropriate and descriptive
- [ ] App description accurate and complete
- [ ] Release notes for version 1.0
- [ ] Support email: support@socialworkbd.com
- [ ] Privacy policy URL: https://yoursite.com/privacy-policy.html
- [ ] Terms URL: https://yoursite.com/terms-of-service.html

### Certification & Compliance
- [ ] Content rating questionnaire completed
- [ ] Age appropriate content verified
- [ ] No "Adult" or "Mature" content (unless rated 17+)
- [ ] COPPA compliance (if targeting children)
- [ ] Advertising disclosure (if contains ads)
- [ ] User-generated content disclaimer added

## 🧪 Testing Checklist

### Functional Testing
- [ ] Create account functionality tested
- [ ] Login with email/password works
- [ ] Google OAuth login tested
- [ ] Password reset flow verified
- [ ] Edit profile functionality working
- [ ] Profile picture upload tested
- [ ] Create job/post job works for clients
- [ ] Browse jobs works for workers
- [ ] Search functionality tested
- [ ] Filter jobs by category tested
- [ ] Place bid/proposal works
- [ ] View proposals/bids works
- [ ] Messaging system tested
- [ ] Notification system working

### Payment Testing
- [ ] Wallet deposit flow tested
- [ ] Amount validation working (min $1, max $10,000)
- [ ] PayPal payment link opens correctly
- [ ] Payment verification form working
- [ ] Admin can approve/reject payments
- [ ] Payment receipt sent to user
- [ ] Wallet balance updates correctly
- [ ] Transaction history displays
- [ ] No balance manipulation possible

### Security Testing
- [ ] Can't access other users' data
- [ ] Can't modify balance directly
- [ ] Can't bypass payment verification
- [ ] Can't spam with rapid requests
- [ ] Session expires after inactivity
- [ ] Logout clears sensitive data
- [ ] Account suspension works
- [ ] Firestore rules enforced

### Device Testing
- [ ] Tested on minimum API level 21
- [ ] Tested on latest Android version
- [ ] Tested on various screen sizes
- [ ] Tested on low-memory devices
- [ ] Portrait and landscape orientation working
- [ ] Navigation drawer/menu functions
- [ ] Bottom navigation bar working
- [ ] Keyboard appears/disappears correctly

### Network Testing
- [ ] Works on WiFi
- [ ] Works on 4G/LTE
- [ ] Handles connection loss gracefully
- [ ] Retries failed requests
- [ ] Caches data appropriately
- [ ] Syncs when connection restored
- [ ] No data loss on disconnect

## 🚀 Deployment Steps

### 1. Build & Sign APK/AAB
```bash
# Generate signing key (if you don't have one)
keytool -genkey -v -keystore socialworkbd-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias socialworkbd-key

# Build release APK or AAB
./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

### 2. Firebase Security
- [ ] Deploy Firestore rules
  ```bash
  firebase deploy --only firestore:rules
  ```
- [ ] Enable app check in Firebase Console
- [ ] Rotate API keys if they were exposed
- [ ] Review Firebase security findings
- [ ] Enable audit logging

### 3. Environment Variables
- [ ] Create `.env.production` file
- [ ] Add all required Firebase credentials
- [ ] Add PayPal payment link
- [ ] Verify no hardcoded secrets in code
- [ ] Review git history for exposed keys

### 4. Backend (Optional but Recommended)
- [ ] Deploy admin dashboard for payment verification
- [ ] Set up email notifications for admins
- [ ] Configure automated daily backups
- [ ] Set up error logging (Sentry, Firebase Crashlytics)
- [ ] Configure analytics tracking
- [ ] Set up support ticketing system

### 5. Final Review
- [ ] Code review completed
- [ ] Security audit passed
- [ ] Performance testing done (< 3s load time)
- [ ] All bugs fixed
- [ ] All warnings resolved
- [ ] Lint/code quality checks passed
- [ ] No debug code in production
- [ ] Version number incremented

## 📤 AppStore Submission

### 1. Prepare Submission
- [ ] Create app listing in Amazon Appstore Console
- [ ] Upload APK or AAB file
- [ ] Add all required graphics and descriptions
- [ ] Set pricing (Free recommended)
- [ ] Select target countries (Bangladesh, Worldwide)
- [ ] Set availability date

### 2. Review & Approve
- [ ] Complete content rating questionnaire
- [ ] Accept developer agreement
- [ ] Verify all information is correct
- [ ] Submit for review

### 3. Wait for Review
- Expected review time: 5-24 hours
- Amazon will check:
  - Functionality
  - Security
  - Content appropriateness
  - Performance
  - Permissions justification

### 4. Post-Approval
- [ ] App goes live automatically
- [ ] Create launch announcement
- [ ] Monitor ratings and reviews
- [ ] Fix any issues quickly
- [ ] Release updates as needed

## 🔍 Monitoring Post-Launch

### First 30 Days
- [ ] Monitor crash reports daily
- [ ] Track user ratings and reviews
- [ ] Fix critical bugs immediately (< 24 hours)
- [ ] Monitor performance metrics
- [ ] Track download numbers
- [ ] Monitor server load

### Ongoing
- [ ] Monthly security audits
- [ ] Quarterly feature updates
- [ ] Regular user feedback review
- [ ] Maintain Firebase/PayPal integrations
- [ ] Update dependencies monthly
- [ ] Monitor payment processing

## 📞 Support Contacts

- **App Support:** support@socialworkbd.com
- **Privacy Inquiries:** privacy@socialworkbd.com
- **PayPal Support:** https://www.paypal.com/en/
- **Firebase Support:** https://firebase.google.com/support/
- **Amazon Developer Support:** https://developer.amazon.com/apps-and-games/support/

## ✨ Success Criteria

- [ ] App approved and published on Amazon Appstore
- [ ] 0 crashes on first day
- [ ] Positive user reviews
- [ ] Payment system working smoothly
- [ ] All features functioning as described
- [ ] User support responsive (< 24 hour response)

---

**Checklist Created:** October 5, 2026  
**Last Updated:** October 5, 2026  
**Status:** Ready for Submission
