# Catalog Pilot

## Overview

Catalog Pilot is a full-stack web application designed to manage BigCommerce products and handle bulk price updates through scheduled work orders. The application provides a clean interface for syncing products from BigCommerce, viewing product details, and creating automated price update tasks.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### January 29, 2025
- **Implemented Partial Product Sync**: Enhanced sync functionality to respect subscription plan limits without blocking
  - Modified both `/api/sync` and `/api/products/sync` endpoints to sync up to plan limits instead of rejecting
  - Users with Starter plan (10 products) can now sync first 10 products from stores with 100+ products
  - Added informative response messages indicating partial sync status and upgrade prompts
  - Maintains pagination efficiency while respecting product limits for fair usage
  - Enhanced user experience by allowing immediate productivity within plan constraints
- **Fixed Firebase Logout Functionality**: Resolved logout button issues with proper Firebase signOut implementation
  - Updated logout buttons in Home and Settings pages to call Firebase signOut directly
  - Added proper error handling and success notifications for logout actions
  - Removed redundant `/api/logout` backend route dependencies
  - Logout now works correctly across all pages with Firebase authentication
- **Complete Replit Auth Removal**: Cleaned up all remaining Replit authentication code for Firebase-only setup
  - Removed `server/replitAuth.ts` file and all related imports
  - Uninstalled passport, openid-client, express-session, and related authentication packages
  - Removed sessions table from database schema (Firebase handles authentication state)
  - Updated invitation acceptance endpoint to use Firebase auth pattern
  - Cleaned up old backup files and redundant authentication files
  - Application now uses Firebase Auth exclusively for all authentication needs
- **Enhanced Render Deployment Support**: Updated environment variable handling for consistent Render deployment
  - Added support for alternative environment variable naming conventions used by Render hosting
  - Updated Stripe integration to support both `STRIPE_SECRET_KEY`/`Stripe_Secret_Key` naming patterns
  - Updated Firebase configuration to support both `VITE_FIREBASE_*`/`VITE_Firebase_*` naming patterns
  - Maintains backward compatibility with existing variable names while supporting Render conventions
  - All authentication and payment systems now work seamlessly with Render environment variable setup

### January 28, 2025
- **Database Reset**: Wiped all data for fresh start - cleared all products, users, companies, work orders, and settings
- **Fixed Subscription Plan Enforcement**: Added product limit checks to sync endpoints to properly enforce subscription tiers
  - Both /api/sync and /api/products/sync now check BigCommerce product count against plan limits
  - Trial plan: 5 products max, Starter: 10 products max, Premium: 1000 products max
  - Users get clear error messages when trying to sync beyond their plan limits
  - Sync operations are blocked until users upgrade their subscription plan
- **Implemented Subscription Plan System**: Added company-based subscription tiers with product limits
  - Created three plans: Trial (5 products), Starter (10 products), Premium (1000 products)
  - Added subscription fields to companies table: subscriptionPlan, productLimit, stripeCustomerId, etc.
  - Built comprehensive subscription management page with plan selection and Stripe integration
  - Added subscription menu item to sidebar navigation for easy access
  - Implemented product limit enforcement to prevent syncing beyond plan limits
  - Created subscription API endpoints for plan management, upgrades, and cancellations
- **Stripe Payment Integration**: Set up Stripe payment processing for paid subscriptions
  - Integrated @stripe/stripe-js and @stripe/react-stripe-js packages
  - Created StripeService for customer and subscription management
  - Added payment form with Elements integration for secure card processing
  - Implemented webhook handling for subscription status updates (foundation)
  - Added proper error handling and user feedback for payment flows
  - Trial plan works without Stripe payments, paid plans require Stripe integration
  - Updated pricing: Starter $10/month, Premium $20/month
  - Integrated actual Stripe price IDs for live payment processing
- **Fixed BigCommerce Sync Pagination**: Resolved issue where sync was only fetching 50 products instead of all products
  - Updated sync endpoints to use proper pagination with 250 products per page (BigCommerce maximum)
  - Added pagination loop to fetch all products automatically from multi-page stores
  - Fixed database foreign key constraint violation by deleting product variants before products during sync
  - Sync now properly handles stores with hundreds or thousands of products
- **Reconfigured Signup Process**: Streamlined user onboarding flow for better user experience
  - Changed flow from company-first to user-first registration
  - Users now create their account first, then set up their company
  - Updated landing page and signin page messaging to reflect new flow
  - Added automatic redirection to company setup page (/setup) for new users
  - Enhanced company setup page with clearer messaging about account completion
  - Fixed authentication API calls that were causing "Method is not a valid HTTP token" errors
- **Enhanced Authentication System**: Resolved all remaining authentication issues
  - Fixed API request format in company setup page (corrected parameter order)
  - Improved error handling and logging throughout authentication flow
  - Added proper TypeScript error handling for better debugging
  - Firebase authentication now works seamlessly with company creation
- **Completed Firebase Auth Migration**: Successfully migrated all API routes from Replit Auth to Firebase Auth
  - Updated all protected routes to use Firebase authentication middleware
  - Replaced old requireCompany middleware with getFirebaseUserAndCompany helper function
  - Fixed user session management to properly handle company associations
  - BigCommerce API settings can now be saved successfully with Firebase authentication
  - Fixed product sync endpoint routing to work with frontend sync calls
- **Rebranding to Catalog Pilot**: Updated application name and branding
  - Changed application name from "BigCommerce Manager" to "Catalog Pilot" in sidebar
  - Made application name clickable to link to homepage with hover effects
  - Updated project documentation to reflect new branding
- **Fixed Work Order Archive System**: Resolved archive/unarchive functionality issues
  - Added missing archive and unarchive API routes to server
  - Fixed server-side filtering for work orders based on archive status
  - Removed conflicting client-side filtering logic
  - Both archive and unarchive buttons now work correctly
- **Fixed Team Invitation System**: Resolved "Method is not a valid HTTP token" error
  - Corrected API request parameter order in team invitation calls
  - Team member invitations now work properly with Firebase authentication

### January 27, 2025
- **Added Work Order Preset Options**: Implemented quick-action presets for common pricing scenarios
  - Added "Remove Sale Prices" preset button to set sale prices to "0.00" for BigCommerce API compatibility
  - Added "Apply Discount" preset with percentage input (1-99%) to create sale prices based on regular prices
  - Presets include proper validation, error handling, and success notifications
  - Enhanced user workflow for bulk pricing changes with one-click actions
- **Enhanced Product Selection**: Added comprehensive selection options in Create Work Order modal
  - Added "Select All Products" button to select all available products regardless of current filters
  - Maintained existing "Select All Visible" for filtered product selection
  - Improved button layout with flex-wrap for better responsive design
  - Product counts displayed in button labels for clarity
- **Added Work Order Undo Functionality**: Implemented ability to reverse completed work orders
  - Added "Undo" button that appears only for completed work orders
  - Captures original prices before executing work order changes
  - Restores original regular and sale prices for all affected products in BigCommerce
  - Updates work order status to "undone" and adds timestamp
  - Includes confirmation dialog and comprehensive error handling
- **Fixed Create Work Order Modal Scrolling**: Resolved scrolling issues in product selection area
  - Replaced ScrollArea component with standard div using overflow-y-auto
  - Applied proper height constraints and scrolling functionality
  - Connected Create Work Order button functionality across the application
- **Added Stock Visibility Setting**: Implemented user preference for showing/hiding stock status badges
  - Added `showStock` boolean field to API settings database schema with default value true
  - Created toggle switch in Settings page under "Display Preferences" section
  - Updated ProductCard component to conditionally show/hide stock badges based on user preference
  - Connected Products page to respect the setting from saved user preferences
  - Stock badges (In Stock, Low Stock, Out of Stock) can now be toggled on/off per user
- **Implemented Work Order Archive System**: Added comprehensive archive feature to organize completed work orders
  - Added `archived` boolean field to work orders database schema with default value false
  - Created archive/unarchive API endpoints with proper user authentication
  - Updated storage layer with filtering capabilities for archived vs active work orders
  - Added dropdown filter in Work Orders page to switch between "Active" and "Archived" views
  - Implemented Archive button (folder icon) for active work orders and Unarchive button for archived ones
  - Updated empty states to show contextual messages for active vs archived views
  - Archived work orders are hidden from main view but preserved in database for organization

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