# Catalog Pilot - BigCommerce Product Manager

## Overview

Catalog Pilot is a full-stack web application designed to streamline the management of BigCommerce products, with a primary focus on automating bulk price updates through scheduled work orders. It offers a clean interface for syncing products, viewing detailed product information, and creating automated pricing tasks. The project aims to provide businesses with a robust tool for efficient e-commerce operations, enhancing market responsiveness and potentially increasing profitability through dynamic pricing strategies.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application adopts a modern full-stack architecture, ensuring clear separation between its frontend and backend components.

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Radix UI components integrated with shadcn/ui design system
- **Styling**: Tailwind CSS with custom themes
- **State Management**: TanStack React Query for server state
- **Routing**: Wouter
- **HTTP Client**: Axios

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL via Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Session Management**: PostgreSQL session store
- **Task Scheduling**: Node-cron for work order execution
- **Authentication**: Firebase Google Sign-In with JWT verification

### Key Features and Design Decisions
- **Brand Identity**: Integrated "Catalog Pilot" branding with a consistent logo and color palette across the application (Primary: #6792FF, Accent: #53E590, Destructive: #FD7572).
- **Product Management**: Syncs products from BigCommerce, allowing local caching and detailed viewing. Supports manual and automated price updates for individual products and variants.
- **Work Order System**: Enables creation and scheduling of bulk price update tasks. Work orders can define specific price changes for individual products within a batch.
- **Price History Tracking**: Comprehensive system to track all price changes (manual updates, work orders, system sync) with detailed history for each product.
- **Stock Status Visibility**: User-controlled setting to toggle the display of stock information on product cards.
- **Team Management**: Functionality for company owners to manage company names and for admins/owners to remove team members.
- **Invitation Workflow**: Manual invitation acceptance system where users create accounts and then accept invitations through the Team page.
- **Subscription Management**: Integration with Stripe for managing user subscriptions, including plan upgrades/downgrades and coupon code support.
- **Data Persistence**: Migration from in-memory storage to PostgreSQL for persistent data, including products, API settings, and work orders.
- **Security**: Enhanced API security through Firebase token verification, replacing header-based authentication.
- **Scalability**: Designed for deployment on Replit, leveraging Neon serverless PostgreSQL for database scalability.

## Recent Improvements (August 13, 2025)

### BigCommerce Category System Final Fix (August 13, 2025)
- **Root Cause Identified**: BigCommerce API doesn't provide `parent_category_list` field and has orphaned categories (missing parent IDs 129, 180)
- **Missing Parent Handling**: Implemented fallback logic to handle missing category parents (129 → "Universal Quick Attach", 180 → "Excavator Attachments")
- **Hierarchy Reconstruction**: Fixed category path building to traverse `parent_id` relationships while gracefully handling missing parents
- **Data Validation**: Discovered category 129 is referenced by Buckets/Grapples but missing from API response
- **Test Confirmation**: ES-STSB-0066 now correctly shows "Attachments > Universal Quick Attach > Buckets > Smooth Buckets" instead of "Shop All"
- **Sync Process**: Fixed hanging sync issues and duplicate key errors with proper upsert logic
- **API Debugging**: Comprehensive debugging revealed actual BigCommerce category structure and API limitations

### Interactive User Walkthrough (August 13, 2025)
- **Onboarding System**: Created comprehensive guided tour for new users appearing only once after registration
- **Database Integration**: Added hasSeenWalkthrough field to users table with API endpoint for completion tracking
- **Step-by-Step Guide**: Multi-step walkthrough covering Products, Work Orders, Team management, and Settings
- **Visual Highlighting**: Overlay system with element targeting and smooth transitions between steps
- **User Experience**: Auto-triggers after 1-second delay with skip/complete options and progress indicators

### Stripe Pricing Update (August 13, 2025)
- **Price Configuration**: Updated Stripe price IDs and amounts for subscription plans
- **Starter Plan**: Updated to price_1RvINwCQT46XbXAbXRC4YdQz ($5/month, 100 products)
- **Premium Plan**: Updated to price_1RvIOWCQT46XbXAb4c0bniaE ($10/month, 1000 products)
- **Integration**: Modified server/routes.ts planDetails object and frontend display pricing

### User Feedback Collection (August 13, 2025)
- **Feedback Page**: Created dedicated feedback collection page with embedded Notion form
- **Navigation Access**: Added "Feedback" button to sidebar navigation with MessageSquare icon
- **Embedded Form**: Integrated iframe with Notion feedback form for streamlined user input collection
- **User Experience**: Clean, professional interface with explanatory content about feedback types needed
- **Accessibility**: Full route integration in React Router with proper responsive design

### Google Ads Conversion Page (August 13, 2025)
- **Thank You Page**: Created professional post-purchase page at `/thank-you` optimized for Google Ads conversion tracking
- **Conversion Tracking**: Integrated Google Analytics gtag events for subscription conversion tracking with proper transaction IDs
- **Dynamic Content**: Page adapts to show Starter ($5) or Premium ($10) plan details based on URL parameters
- **Stripe Integration**: Updated Stripe success URL to redirect to thank-you page instead of subscription page
- **User Journey**: Includes guided next steps (Sync Products, Create Work Orders, Invite Team) with direct navigation
- **Professional Design**: Gradient background, feature highlights, and support section for optimal conversion experience

### Homepage Navigation & Pricing Page (August 13, 2025)
- **Navigation Bar**: Added responsive navigation bar to landing page with mobile menu support
- **Pricing Page**: Created comprehensive pricing page at `/pricing` explaining all subscription tiers (Trial, Starter, Premium)
- **Plan Details**: Detailed feature comparison with pricing, limitations, and benefits for each tier
- **FAQ Section**: Added frequently asked questions about billing, security, and plan changes
- **Mobile Responsive**: Full responsive design with mobile-optimized navigation and pricing cards
- **Call-to-Action**: Integrated with authentication flow and subscription upgrade paths

### Analytics Integration (August 13, 2025)
- **Google Analytics**: Added Google Analytics (G-YTPSTTPY9H) with gtag.js for comprehensive user behavior tracking
- **Google Tag Manager**: Integrated Google Tag Manager (GTM-NFSKFSGL) for advanced event tracking and marketing analytics
- **Implementation**: Both tracking scripts added to main HTML template with proper noscript fallbacks
- **Coverage**: Analytics now active on all pages including landing, authentication, dashboard, products, work orders, team management, and subscription pages
- **Dual Tracking**: Combines GA4 direct implementation with GTM for maximum tracking flexibility and marketing integration

### Mobile Responsiveness Implementation
- **Navigation**: Implemented responsive sidebar with hamburger menu and mobile overlay
- **Layouts**: Added comprehensive responsive breakpoints (sm, md, lg, xl) across all pages
- **Components**: Made all cards, forms, and UI elements mobile-friendly
- **Touch Interface**: Optimized buttons and interactions for mobile devices
- **Product Grid**: Responsive grid layout that adapts from 1 column (mobile) to 3 columns (desktop)

### Brand Identity Integration  
- **Logo**: Integrated Catalog Pilot logo throughout application (sidebar, headers, landing page)
- **Colors**: Applied brand color palette - Primary: #6792FF (blue), Accent: #53E590 (green), Destructive: #FD7572 (coral)
- **Typography**: Updated all branding to use "Catalog Pilot" consistently

### Sync Process Optimization (August 12, 2025)
- **Progress Bar**: Added real-time progress tracking with Server-Sent Events streaming
- **API Efficiency**: Optimized BigCommerce API calls by fetching variants with products (reduced from ~N+3 calls to ~3 calls for N products)
- **Performance**: Eliminated individual product variant API requests by including variants in product response
- **User Experience**: Progress bar shows detailed stages (fetching, processing, completing) with percentage and status messages

## External Dependencies

- **BigCommerce Integration**: Utilizes the BigCommerce V3 REST API for all product management operations, including retrieval, updates, and category management. Requires BigCommerce store hash, access token, and client ID for authentication.
- **Stripe**: Integrated for subscription management, including handling checkout sessions, processing payments for plan upgrades, and applying coupon codes.
- **SendGrid**: Used for sending transactional emails, specifically for the invitation workflow.
- **Radix UI**: Provides accessible, unstyled UI primitives that serve as the foundation for the user interface.
- **shadcn/ui**: A collection of re-usable components built on Radix UI and Tailwind CSS, ensuring a consistent and polished design.
- **Lucide React**: Used for iconography throughout the application.