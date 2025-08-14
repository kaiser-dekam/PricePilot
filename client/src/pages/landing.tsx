import { Button } from "@/components/ui/button";
import { 
  ShoppingCart, 
  BarChart3, 
  Clock, 
  Shield, 
  ArrowRight, 
  Star,
  RefreshCw,
  Calendar,
  Users,
  Zap
} from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/layout/navbar";
import logoPath from "@assets/Artboard 1_1754940868643.png";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />
      {/* Hero Section */}
      <section className="relative overflow-hidden" id="features">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-green-50/30 dark:from-blue-950/20 dark:to-green-950/10"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-transparent"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-8">
              <img 
                src={logoPath} 
                alt="Catalog Pilot" 
                className="h-20 md:h-24 object-contain"
              />
            </div>
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
              <Star className="w-4 h-4" />
              Navigate your catalog with confidence
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Efficiency, control, and teamwork for <span className="font-mono text-primary">BigCommerce</span> product ops.
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto mb-8 leading-relaxed">
              Catalog Pilot syncs your store via API, schedules bulk price updates with <strong>Work Orders</strong>, tracks pricing history, and supports multi-user company accounts—covering both standard products and variations.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
              <Link href="/login">
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Trial Plan Available • No credit card required
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-8 shadow-lg max-w-4xl mx-auto mb-16">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              Everything you need in one platform
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">BigCommerce API Sync</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Real-time product + variant updates</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Work Orders</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Schedule bulk price changes safely</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Price History</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Track changes & accountability</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Teams & Roles</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Multi-user companies with permissions</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              What you can do with Catalog Pilot
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Everything you need to manage catalogs at scale—without spreadsheets and late-night price edits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Sync & Normalize</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Connect your BigCommerce store via API to pull products, variants, and pricing into a consistent workspace.
              </p>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Catalog Browsing</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Filter by brand, category, SKU, and change history. 
              </p>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Scheduled Work Orders</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Queue and approve bulk price updates with guardrails, and audit logs.
              </p>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Variant‑level Pricing</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Update individual variant prices and apply easy discounts across regular and sale prices. 
              </p>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Teams & Permissions</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Invite teammates, assign roles (Admin/Member), and restrict sensitive access.
              </p>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Audit & Rollback</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Price history with user attribution and easy rollbacks if something doesn't look right.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">How it works</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">From connection to collaboration in minutes.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg">
              <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-lg">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Connect your store</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Authenticate with BigCommerce and select which catalogs to manage. We auto‑map products and variants.
              </p>
            </div>

            <div className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg">
              <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-lg">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Plan updates</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Create a Work Order for price changes, choose products/variants, and schedule for hands off updates.
              </p>
            </div>

            <div className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg">
              <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-lg">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Track & improve</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Monitor execution, view pricing history, and refine rules—without losing control or visibility.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to take control of your catalog?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Get started today for free with our trial plan.
          </p>
          <Link href="/login">
            <button className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-primary to-blue-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              Start for Free
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Free trial plan available · No credit card required · Cancel anytime
          </p>
        </div>
      </section>
    </div>
  );
}