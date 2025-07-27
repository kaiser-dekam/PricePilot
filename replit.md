# BigCommerce Product Manager

## Overview

This is a full-stack web application designed to manage BigCommerce products and handle bulk price updates through scheduled work orders. The application provides a clean interface for syncing products from BigCommerce, viewing product details, and creating automated price update tasks.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### January 27, 2025
- **Added Work Order Preset Options**: Implemented quick-action presets for common pricing scenarios
  - Added "Remove Sale Prices" preset button to instantly clear all sale prices from selected products
  - Added "Apply Discount" preset with percentage input (1-99%) to create sale prices based on regular prices
  - Presets include proper validation, error handling, and success notifications
  - Enhanced user workflow for bulk pricing changes with one-click actions
- **Enhanced Product Selection**: Added comprehensive selection options in Create Work Order modal
  - Added "Select All Products" button to select all available products regardless of current filters
  - Maintained existing "Select All Visible" for filtered product selection
  - Improved button layout with flex-wrap for better responsive design
  - Product counts displayed in button labels for clarity
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