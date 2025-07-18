# GreenViva Email Tracker

## Background and Motivation
The project aims to create a mobile-optimized web application that tracks and analyzes money transfer emails from viva.com. The application will help users monitor their daily earnings and track historical data. Key features include Google authentication for secure access to emails, automated parsing of transfer notifications, and a goal-tracking system.

## Key Challenges and Analysis
1. Email Integration
   - Need to implement Google OAuth for secure email access
   - Must filter emails specifically from no-reply@viva.com
   - Need to parse email content to extract transfer amounts
   
2. Data Processing
   - Extract and store key information: date, amount, sender
   - Calculate daily totals
   - Track progress against daily goals
   
3. User Interface
   - Mobile-first design approach
   - Simple, intuitive interface
   - Real-time goal progress visualization
   - Historical data view with date selection

## High-level Task Breakdown

### Phase 1: Project Setup and Authentication
1. Initialize Next.js project with TypeScript and required dependencies
   - Success Criteria: Project runs without errors and has all necessary dependencies
   
2. Implement Google OAuth authentication
   - Set up Google Cloud project and obtain credentials
   - Implement login/logout functionality
   - Success Criteria: Users can successfully log in with their Google account

### Phase 2: Email Integration
3. Implement Gmail API integration
   - Set up Gmail API access
   - Create email fetching service
   - Success Criteria: Application can successfully fetch emails from the user's Gmail account

4. Implement email filtering and parsing
   - Filter emails from no-reply@viva.com
   - Parse email content to extract transfer amounts
   - Success Criteria: System correctly identifies and parses transfer amounts from viva.com emails

### Phase 3: User Interface Development
5. Create mobile-optimized layout
   - Implement responsive design
   - Create navigation structure
   - Success Criteria: Application is fully functional on mobile devices

6. Implement Today's Overview page
   - Display today's total earnings
   - Show progress towards daily goal
   - Success Criteria: Users can see their daily progress and goal status

7. Implement Historical Data page
   - Create date selector
   - Display historical email data
   - Success Criteria: Users can view and analyze past transfer data

## Project Status Board
- [x] Project initialization and dependency setup
  - Updated package.json with correct dependencies
  - Set up TailwindCSS configuration
  - Fixed security vulnerabilities
- [x] Mobile-optimized layout
  - Created responsive dashboard layout
  - Added mobile navigation
  - Implemented mobile-first design patterns
- [x] Today's overview page
  - Created dashboard with goal progress
  - Added transfers list
  - Implemented responsive design
- [x] Historical data page
  - Created history page with date selector
  - Added daily summary
  - Added transfers list
- [ ] Google OAuth implementation
  - Created NextAuth configuration
  - Created SessionProvider component
  - Created login page
  - Generated NEXTAUTH_SECRET
  - Waiting for Google Cloud client secret
- [x] Gmail API integration
  - Created GmailService class
  - Implemented email fetching
  - Added transfer parsing
  - Integrated with dashboard and history pages
- [x] Email filtering and parsing service
  - Implemented email body parsing
  - Added date filtering
  - Added sorting by timestamp

- [x] Add a sign out button to the dashboard navigation
- [x] Implement automatic sign out after 5 minutes of inactivity
- [x] Remove forced auto-login after sign out (let user choose to sign in again)
- [x] Disable auto-redirect/auto-login on the sign-in page (let user choose to sign in)
- [ ] Await user confirmation that all changes work as expected

## Current Status / Progress Tracking
Core functionality implementation is complete. Next steps:
1. Need Google Cloud client secret to complete OAuth setup
2. Once authentication is working, we can test:
   - Email fetching
   - Transfer parsing
   - Goal tracking
   - Historical data viewing

## Executor's Feedback or Assistance Requests
To complete the implementation, I need:
1. Google Cloud client secret to be added to .env.local along with the existing client ID

## Lessons
- Gmail API requires specific scopes for email access
- Email parsing needs to be robust to handle various email formats
- Mobile-first design improves overall user experience 

## New Requirements Analysis (2024-03-21)

### 1. Cross-Device Tips Storage
Current Implementation:
- Tips are stored in localStorage
- Not accessible across devices
- No persistence beyond browser storage

Proposed Solution:
1. Use IndexedDB for local storage with sync capability
   - More robust than localStorage
   - Can handle larger amounts of data
   - Better structured data storage
   
2. Implement sync mechanism using Gmail Draft folder
   - Store tips as draft emails in a specific format
   - Use Gmail API to read/write drafts
   - No need for external database
   - Leverages existing Gmail authentication
   - Provides automatic backup
   - Works across all devices

### 2. Email Fetching Optimization
Current Implementation:
- Fetches emails on demand
- 5-minute cache to prevent excessive API calls
- Sequential processing of emails

Optimization Strategies:
1. Implement Progressive Loading
   - Load most recent data first
   - Background load older data
   - Show loading progress

2. Improve Caching
   - Cache parsed results, not just raw data
   - Store cache in IndexedDB
   - Implement cache invalidation strategy

3. Parallel Processing
   - Process multiple emails simultaneously
   - Use Promise.all for parallel requests
   - Implement rate limiting to prevent API throttling

## High-level Task Breakdown (New Features)

### Phase 1: Tips Storage Migration
1. Implement IndexedDB Storage
   - Create IndexedDB schema for tips
   - Migrate existing localStorage data
   - Update CRUD operations
   Success Criteria: Tips persist across browser sessions

2. Implement Gmail Draft Sync
   - Create draft format specification
   - Implement draft read/write functions
   - Create sync mechanism
   Success Criteria: Tips sync across devices

### Phase 2: Email Fetching Optimization
1. Implement Progressive Loading
   - Add loading progress indicators
   - Implement background loading
   Success Criteria: Initial load under 2 seconds

2. Enhance Caching System
   - Implement IndexedDB cache
   - Add cache invalidation
   Success Criteria: Subsequent loads instant

3. Add Parallel Processing
   - Implement batch processing
   - Add rate limiting
   Success Criteria: Full sync under 30 seconds

## Project Status Board (New Tasks)
- [x] IndexedDB Implementation
  - [x] Create database schema
  - [x] Create sync service
  - [x] Add error handling
- [x] Gmail Draft Sync
  - [x] Design draft format
  - [x] Implement sync logic
  - [x] Add error handling
- [x] Email Fetch Optimization
  - [x] Add progress tracking
  - [x] Implement caching
  - [x] Add parallel processing

## Current Status / Progress Tracking
Implementation complete for:
1. Cross-device tips storage using IndexedDB + Gmail Draft sync
2. Email fetching optimization with:
   - Parallel processing (10 emails at a time)
   - Caching with IndexedDB (5 min TTL for daily data, 24h for monthly)
   - Rate limiting and retry mechanism

Next steps:
1. Test the implementation
2. Monitor performance improvements
3. Gather user feedback

## Executor's Feedback or Assistance Requests
Implementation is complete. Key points to note:
1. Users will need to re-authenticate due to new Gmail scope for drafts
2. First load might be slower due to cache population
3. Subsequent loads should be near-instant from cache 

All requested changes have been implemented:
- There is now a visible sign out button in the dashboard navigation (desktop only, can add to mobile if needed).
- The app will automatically sign out after 5 minutes of inactivity (mouse or keyboard events reset the timer).
- After sign out, the user is redirected to the home page and must manually click the sign in button (no more forced Google login).
- The sign-in page no longer auto-redirects or auto-logs in; the user must click the sign in button.

Please test the new behavior and confirm if it meets your requirements. If you need further adjustments (e.g., sign out button on mobile, different inactivity timeout, etc.), let me know before marking the tasks as complete. 