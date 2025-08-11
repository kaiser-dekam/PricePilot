import { Button } from "@/components/ui/button";
import { ShoppingCart, BarChart3, Clock, Shield } from "lucide-react";
import { Link } from "wouter";
import logoPath from "@assets/Artboard 1_1754940868643.png";

export default function Landing() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="flex justify-center mb-6 sm:mb-8">
            <img 
              src={logoPath} 
              alt="Catalog Pilot" 
              className="h-16 sm:h-20 md:h-24 object-contain"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
            Catalog Pilot
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-6 sm:mb-8 px-4">
            Streamline your BigCommerce store management with powerful tools for product sync, 
            bulk price updates, and automated work orders. Manage your inventory like a pro.
          </p>
          <Link href="/login">
            <Button 
              size="lg"
              className="text-base sm:text-lg px-6 sm:px-8 py-2 sm:py-3 w-full sm:w-auto"
            >
              Sign In
            </Button>
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-12 sm:mb-16">
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg text-center">
            <ShoppingCart className="h-10 sm:h-12 w-10 sm:w-12 text-primary mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              Product Sync
            </h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              Seamlessly sync your BigCommerce products with real-time updates and inventory tracking.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg text-center">
            <BarChart3 className="h-10 sm:h-12 w-10 sm:w-12 text-accent mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              Bulk Price Updates
            </h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              Update prices for multiple products at once with intelligent scheduling and automation.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg text-center">
            <Clock className="h-10 sm:h-12 w-10 sm:w-12 text-primary mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              Scheduled Work Orders
            </h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              Create automated tasks that execute at specific times, perfect for sales and promotions.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg text-center">
            <Shield className="h-10 sm:h-12 w-10 sm:w-12 text-destructive mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              Secure & Reliable
            </h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
              Enterprise-grade security with user authentication and persistent data storage.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 dark:bg-blue-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-300">1</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Connect Your Store
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Enter your BigCommerce API credentials to securely connect your store.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 dark:bg-green-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600 dark:text-green-300">2</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Manage Products
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Browse, search, and filter your products with powerful management tools.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 dark:bg-purple-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-300">3</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Automate Updates
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Create work orders to automate price changes and inventory updates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}