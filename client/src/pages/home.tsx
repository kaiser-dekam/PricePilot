import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { 
  ShoppingCart, 
  ClipboardList, 
  Settings, 
  LogOut, 
  RefreshCw,
  TrendingUp,
  Users,
  Calendar,
  Package,
  BarChart3,
  ArrowRight,
  Star
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  // Fetch dashboard data
  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard"],
    enabled: !!user,
  });

  const { data: productsData } = useQuery({
    queryKey: ["/api/products", { limit: 1 }],
    enabled: !!user,
  });

  const { data: workOrdersData } = useQuery({
    queryKey: ["/api/work-orders"],
    enabled: !!user,
  });

  const productCount = (productsData as any)?.total || 0;
  const pendingWorkOrders = (workOrdersData as any)?.filter((wo: any) => wo.status === 'pending')?.length || 0;
  const completedWorkOrders = (workOrdersData as any)?.filter((wo: any) => wo.status === 'completed')?.length || 0;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-green-50/30 dark:from-blue-950/20 dark:to-green-950/10"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-transparent"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-sm font-medium mb-4">
                <Star className="w-4 h-4" />
                Welcome to your catalog control center
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-3">
                Welcome back{(user as any)?.firstName ? `, ${(user as any).firstName}` : ''}!
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl">
                Efficiency, control, and teamwork for your BigCommerce product operations.
              </p>
            </div>
            
            <button 
              onClick={async () => {
                try {
                  const { signOutUser } = await import("@/lib/firebase");
                  await signOutUser();
                  window.location.href = '/';
                } catch (error) {
                  console.error("Logout error:", error);
                  window.location.href = '/';
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{productCount}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Products</div>
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{pendingWorkOrders}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Pending Orders</div>
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{completedWorkOrders}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Completed Orders</div>
                </div>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">24h</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Last Sync</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Main Actions */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quick Actions</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href="/products">
                  <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.02]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Products</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Browse & manage</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Sync, search, and update your BigCommerce catalog with real-time data.
                    </p>
                    <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                      View Products <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>

                <Link href="/work-orders">
                  <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.02]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-950/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ClipboardList className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Work Orders</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Schedule & execute</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Create bulk price updates with approval workflows and scheduling.
                    </p>
                    <div className="flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                      Manage Orders <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>

                <Link href="/team">
                  <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.02]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Users className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Team</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Collaborate</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Manage team members, roles, and company settings.
                    </p>
                    <div className="flex items-center text-red-600 dark:text-red-400 text-sm font-medium">
                      View Team <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>

                <Link href="/settings">
                  <div className="group bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.02]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Settings</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Configure</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Configure BigCommerce API and application preferences.
                    </p>
                    <div className="flex items-center text-purple-600 dark:text-purple-400 text-sm font-medium">
                      Open Settings <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Highlights Card */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Your Catalog Pilot</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">BigCommerce API Sync</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Real-time product + variant updates</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Work Orders</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Schedule bulk price changes safely</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Price History</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Track trends & accountability</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Teams & Roles</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Multi-user companies with permissions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}