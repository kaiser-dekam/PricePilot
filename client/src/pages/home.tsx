import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { ShoppingCart, ClipboardList, Settings, LogOut } from "lucide-react";


export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back{(user as any)?.firstName ? `, ${(user as any).firstName}` : ''}!
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Manage your store products and work orders with Catalog Pilot
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/api/logout'}
            className="flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Link href="/products">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Browse, search, and manage your BigCommerce products. 
                  Sync inventory and update product details.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/work-orders">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-accent" />
                  Work Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Create and manage automated tasks for bulk price updates 
                  and scheduled product changes.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/settings">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-destructive" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-300">
                  Configure your BigCommerce API connection and 
                  manage application preferences.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* User Info */}
        {user && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {user.profileImageUrl && (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user.email
                    }
                  </p>
                  {user.email && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}