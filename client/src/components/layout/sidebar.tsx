import { Link, useLocation } from "wouter";
import { Package, ClipboardList, Settings, Users, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function Sidebar() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { data: workOrders } = useQuery({
    queryKey: ["/api/work-orders"],
  });

  const { data: apiSettings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const pendingWorkOrders = (workOrders as any[])?.filter((wo: any) => wo.status === "pending") || [];
  const isConnected = !!apiSettings;

  const navigation = [
    {
      name: "Products",
      href: "/products",
      icon: Package,
      current: location === "/" || location === "/products",
    },
    {
      name: "Work Orders",
      href: "/work-orders",
      icon: ClipboardList,
      current: location === "/work-orders",
      badge: pendingWorkOrders.length > 0 ? pendingWorkOrders.length : undefined,
    },
    {
      name: "Team",
      href: "/team",
      icon: Users,
      current: location === "/team",
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      current: location === "/settings",
    },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        )}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-primary cursor-pointer transition-colors">
              Catalog Pilot
            </h1>
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isConnected ? "Connected Store" : "Not Connected"}
          </p>
        </div>
        
        <nav className="mt-6">
          <div className="px-3">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.href}>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors mb-1",
                      item.current
                        ? "text-white bg-primary dark:bg-primary"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                    {item.badge && (
                      <Badge className="ml-auto bg-warning text-white">
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}
