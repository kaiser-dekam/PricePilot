# Catalog Pilot

## Overview

Catalog Pilot is a full-stack web application for managing BigCommerce products and automating bulk price updates via scheduled work orders. It provides an interface for syncing products, viewing details, and creating automated price update tasks. The business vision is to streamline e-commerce operations for BigCommerce store owners, offering a powerful tool for efficient product catalog management and dynamic pricing strategies.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modern full-stack architecture.

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS
- **State Management**: TanStack React Query
- **Routing**: Wouter
- **HTTP Client**: Axios

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM (Neon serverless PostgreSQL)
- **Task Scheduling**: Node-cron

### Key Components
- **Database Schema**: `api_settings` (BigCommerce credentials), `products` (local cache), `work_orders` (scheduled tasks).
- **Core Services**: `BigCommerceService` (API integration), `SchedulerService` (cron jobs), `Storage Layer` (abstracted database interface).
- **Frontend Pages**: Products (listing, search, sync), Work Orders (task management), Settings (API configuration).
- **Data Flow**: API configuration -> Product Sync (BigCommerce to local cache) -> Work Order Creation -> Task Execution (via scheduler) -> Price Updates (local to BigCommerce).
- **UI/UX Decisions**: Radix UI and shadcn/ui ensure consistent design and accessibility. Color schemes and component layouts are driven by Tailwind CSS.

### System Design Choices
- **Authentication**: Exclusive use of Firebase Auth for multi-user support and data isolation.
- **Data Persistence**: PostgreSQL with Drizzle ORM ensures data persistence across server restarts, including scheduled work orders.
- **Subscription System**: Implemented company-based subscription tiers with product limits enforced during sync operations (Trial, Starter, Premium).
- **Payment Processing**: Integrated Stripe for subscription payments and management.
- **Work Order Management**: Supports per-product pricing updates, undo functionality for completed orders, and an archiving system for organization. Includes quick-action presets for common pricing scenarios.
- **Product Sync**: Handles pagination efficiently, syncing all products from BigCommerce while respecting subscription plan limits.
- **Deployment**: Configured for Replit deployment, serving static files and API routes from a single Node.js process.

## External Dependencies

- **BigCommerce API**: V3 REST API for product management (retrieval, updates, category management). Requires store hash, access token, and client ID.
- **Stripe**: For payment processing and subscription management.
- **Firebase Auth**: For user authentication and authorization.
- **Neon**: Serverless PostgreSQL database provider.
- **Radix UI**: UI component primitives.
- **shadcn/ui**: Component library built on Radix UI.
- **Lucide React**: Icon library.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **Node-cron**: For scheduling tasks.