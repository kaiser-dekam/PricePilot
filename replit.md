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

## Recent Improvements (January 27, 2025)

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

## External Dependencies

- **BigCommerce Integration**: Utilizes the BigCommerce V3 REST API for all product management operations, including retrieval, updates, and category management. Requires BigCommerce store hash, access token, and client ID for authentication.
- **Stripe**: Integrated for subscription management, including handling checkout sessions, processing payments for plan upgrades, and applying coupon codes.
- **SendGrid**: Used for sending transactional emails, specifically for the invitation workflow.
- **Radix UI**: Provides accessible, unstyled UI primitives that serve as the foundation for the user interface.
- **shadcn/ui**: A collection of re-usable components built on Radix UI and Tailwind CSS, ensuring a consistent and polished design.
- **Lucide React**: Used for iconography throughout the application.