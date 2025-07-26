# BigCommerce Product Manager

## Overview

This is a full-stack web application designed to manage BigCommerce products and handle bulk price updates through scheduled work orders. The application provides a clean interface for syncing products from BigCommerce, viewing product details, and creating automated price update tasks.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### January 26, 2025
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