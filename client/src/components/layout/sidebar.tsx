import { Link, useLocation } from "wouter";
import { Package, ClipboardList, Settings, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function Sidebar() {
  const [location] = useLocation();
  
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
      name: "Settings",
      href: "/settings",
      icon: Settings,
      current: location === "/settings",
    },
  ];

  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">BigCommerce Manager</h1>
        <p className="text-sm text-gray-500 mt-1">
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
                  className={cn(
                    "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    item.current
                      ? "text-white bg-primary"
                      : "text-gray-700 hover:bg-gray-100"
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
      
      {/* Connection Status */}
      <div className="absolute bottom-6 left-6 right-6">
        <div className={cn(
          "border rounded-lg p-3",
          isConnected 
            ? "bg-accent/10 border-accent/20" 
            : "bg-red-50 border-red-200"
        )}>
          <div className="flex items-center">
            <div className={cn(
              "w-2 h-2 rounded-full mr-2",
              isConnected ? "bg-accent" : "bg-red-500"
            )} />
            <span className={cn(
              "text-sm font-medium",
              isConnected ? "text-accent" : "text-red-600"
            )}>
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {isConnected ? "API ready" : "Configure in Settings"}
          </p>
        </div>
      </div>
    </div>
  );
}
