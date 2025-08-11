# BigCommerce Product Manager

## Overview

This is a full-stack web application designed to manage BigCommerce products and handle bulk price updates through scheduled work orders. The application provides a clean interface for syncing products from BigCommerce, viewing product details, and creating automated price update tasks.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### January 27, 2025
- **Fixed Price History Duplicate Entries Bug**: Resolved issue where manual price updates created double history entries
  - **BUG FIX**: Modified storage.updateProduct to accept skipPriceHistory parameter to prevent automatic price tracking
  - API routes now explicitly control price history creation to avoid duplicates from both route and storage layers
  - Maintained proper price change tracking with correct timestamps and change types
- **Added Work Order Price History Tracking**: Work order executions now properly record price changes in history
  - **FEATURE**: Scheduler service now creates price history entries with 'work_order' changeType during execution
  - Added workOrderId reference to price history for better traceability
  - Work order price changes now appear in product detail panel price history timeline
  - Proper tracking of both regular and sale price changes from automated work order updates
- **Completed Product Variant Price Editing Support**: Full manual price update capability for product variations
  - **FEATURE**: Added expandable Product Variants section in product detail panel
  - Individual price editing forms for each product variant with real-time updates
  - Created API endpoints for fetching and updating product variant prices
  - Built VariantPriceEditor component with proper form validation and error handling
  - Database storage layer supports full CRUD operations for product variants with company isolation
- **Fixed Critical Work Order Scheduling Bug**: Resolved issue where work orders were stuck in pending status
  - **BUG FIX**: Missing scheduler initialization in routes.ts prevented work orders from executing
  - Added scheduler.init() call to properly restore pending work orders on server startup
  - Updated scheduler service to use correct field names (createdBy instead of userId)
  - Enhanced logging to debug work order execution flow and identify issues
  - Work orders now properly execute immediately or schedule for future execution based on configuration
- **Completed Product Price History Tracking System**: Implemented comprehensive price change monitoring
  - **DATABASE**: Added price_history table with proper relationships and company isolation
  - **BACKEND**: Created API endpoints for recording and retrieving product price changes
  - **AUTOMATION**: Automatic price tracking when products are updated through manual edits or work orders
  - **FRONTEND**: Enhanced ProductDetailPanel with chronological price history display
  - **UI**: Visual indicators for different change types (manual updates, work orders, system sync)
  - **USER EXPERIENCE**: Click any product to view its complete price change timeline with timestamps
  - All price modifications are now automatically tracked and displayed in a clean, organized interface
- **Enhanced API Security**: Fixed critical security vulnerability in authentication system
  - **SECURITY FIX**: Replaced insecure header-based authentication with proper Firebase token verification
  - Implemented JWT token decoding with expiration checking to prevent unauthorized access
  - Updated frontend to send Firebase ID tokens via Authorization Bearer headers
  - All API endpoints now properly protected - return 401 Unauthorized for invalid/missing tokens
  - Eliminated vulnerability where fake headers could bypass authentication
- **Migrated to Firebase Auth**: Replaced Replit Auth with Firebase Google Sign-In
  - Implemented Firebase app configuration with provided project credentials
  - Set up Google authentication with popup-based sign-in flow
  - Updated useAuth hook to use Firebase auth state management
  - Modified API client to send Firebase user credentials in headers
  - Simplified backend auth middleware for Firebase user verification
  - Updated landing page and settings page with Firebase auth integration
  - Automatic user creation in database for new Firebase users
- **Implemented Stripe Subscription Management**: Added complete payment processing for plan changes
  - Updated Starter plan from 10 to 100 products limit
  - Integrated Stripe checkout sessions for paid plan upgrades (Starter $10/month, Premium $20/month)
  - Added smart upgrade/downgrade button logic with proper tier comparison
  - Implemented confirmation dialogs with different messages for upgrades vs downgrades
  - Created backend endpoints for Stripe checkout session creation and subscription management
  - Added URL parameter handling for payment success/cancel redirects with user feedback
  - Trial plan remains free with direct plan changes, paid plans redirect to Stripe checkout
  - Fixed response parsing issue where upgrade buttons returned ReadableStream instead of parsed JSON
- **Added Stripe Coupon Code Support**: Implemented promotional code functionality for subscription checkouts
  - Added coupon code input field to subscription page with expandable UI
  - Backend validation ensures coupon codes exist in Stripe before applying discounts
  - Coupon codes are validated and applied during Stripe checkout session creation
  - Frontend sends coupon code to backend when provided, graceful error handling for invalid codes
  - Enabled Stripe's built-in promotion codes UI in checkout for additional discount options

### January 26, 2025
- **Implemented User Authentication System**: Added multi-user support with Replit Auth
  - Created landing page for non-authenticated users with feature overview
  - Integrated Replit OpenID Connect for secure user authentication
  - Added user-specific data isolation (each user has their own products, settings, work orders)
  - Created home dashboard for authenticated users with navigation
  - Updated all API endpoints to require authentication and filter by user
- **Implemented PostgreSQL Database**: Migrated from in-memory storage to persistent database
  - Set up Neon serverless PostgreSQL with Drizzle ORM
  - Created database storage implementation with full CRUD operations
  - Added proper schema validation and type safety
  - Data now persists across server restarts (API settings, products, work orders)
  - Automatic restoration of scheduled work orders on server startup
- **Fixed Work Order Scheduling System**: Resolved critical scheduling bug where scheduledAt was being set to null
  - Fixed schema validation to properly handle ISO date strings from frontend
  - Added date/time validation requiring both fields for scheduled work orders
  - Implemented real-time status updates with 5-second polling interval
  - Added manual refresh button for immediate status checking
  - Verified end-to-end scheduling: create → schedule → execute → status update
- **Enhanced Work Order Modal with Search & Filters**:
  - Added real-time search by product name or ID
  - Category filter dropdown for product filtering
  - Bulk selection actions (Select All Visible, Deselect All Visible, Clear All)
  - Improved product display with expanded product details
  - Selection counters and filtered results display
- **Per-Product Pricing System**: Redesigned work order schema to support individual product pricing instead of bulk pricing
  - Changed `productIds`, `newRegularPrice`, `newSalePrice` fields to `productUpdates` array
  - Each product can now have different regular and sale price updates
  - Updated work order modal with tabular interface for per-product price input
  - Enhanced work order display to show individual product price changes
- **Fixed Product Pagination & UI Polish**: 
  - Fixed pagination buttons to properly navigate through all pages of products
  - Removed API connection banner from bottom of sidebar
  - Made Sync button green when API is connected for clear visual feedback
  - Added "Last Sync'd" timestamp display showing when products were last synchronized
- Fixed query parameter handling in React Query client for proper product loading
- Fixed React import errors in ProductDetailPanel component
- Resolved TypeScript type issues across all components
- Fixed BigCommerce API connection test endpoint from `/store` to `/catalog/products?limit=1`
- Added proper type casting for query responses

## System Architecture

The application follows a modern full-stack architecture with a clear separation between frontend and backend:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom theme variables
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **HTTP Client**: Axios for API communication

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Session Management**: PostgreSQL session store
- **Task Scheduling**: Node-cron for work order execution

## Key Components

### Database Schema
The application uses three main database tables:
- **api_settings**: Stores BigCommerce API credentials (store hash, access token, client ID)
- **products**: Local product cache with pricing and inventory data
- **work_orders**: Scheduled price update tasks with execution tracking

### Core Services
- **BigCommerceService**: Handles API integration with BigCommerce for product sync and updates
- **SchedulerService**: Manages cron jobs for executing scheduled work orders
- **Storage Layer**: Abstracted storage interface with in-memory fallback (designed for database implementation)

### Frontend Pages
- **Products**: Main product listing with search, filtering, and sync capabilities
- **Work Orders**: Task management for bulk price updates
- **Settings**: BigCommerce API configuration

## Data Flow

1. **API Configuration**: Users configure BigCommerce credentials in settings
2. **Product Sync**: Products are fetched from BigCommerce API and cached locally
3. **Work Order Creation**: Users create scheduled tasks for bulk price updates
4. **Task Execution**: Scheduler service executes work orders at specified times
5. **Price Updates**: Changes are pushed back to BigCommerce via API calls

## External Dependencies

### BigCommerce Integration
- Uses BigCommerce V3 REST API for product management
- Requires store hash, access token, and client ID for authentication
- Handles product retrieval, updates, and category management

### UI Components
- Extensive use of Radix UI primitives for accessibility
- shadcn/ui component library for consistent design
- Lucide React for icons

### Development Tools
- Replit-specific plugins for development environment
- ESBuild for production bundling
- TypeScript for type safety across the stack

## Deployment Strategy

The application is configured for deployment on Replit with:
- **Development**: Hot reloading with Vite dev server
- **Production**: Static files served by Express with SSR fallback
- **Database**: Neon serverless PostgreSQL for scalability
- **Environment Variables**: DATABASE_URL required for database connection

### Build Process
1. Frontend builds to `dist/public` directory
2. Backend bundles to `dist/index.js` with external dependencies
3. Single Node.js process serves both static files and API routes

### Database Migrations
- Drizzle Kit handles schema migrations
- Push-based deployment with `db:push` command
- PostgreSQL dialect with connection pooling