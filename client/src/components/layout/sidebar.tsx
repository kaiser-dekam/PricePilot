import { Link, useLocation } from "wouter";
import { Package, ClipboardList, Settings, Wifi, Crown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import logoPath from "@assets/Artboard 1_1754940868643.png";

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
      name: "Team",
      href: "/team",
      icon: Users,
      current: location === "/team",
    },
    {
      name: "Subscription",
      href: "/subscription",
      icon: Crown,
      current: location === "/subscription",
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
        <div className="flex items-center space-x-3 mb-2">
          <img 
            src={logoPath} 
            alt="Catalog Pilot" 
            className="h-8 w-auto object-contain"
          />
          <h1 className="text-lg font-bold text-gray-900">Catalog Pilot</h1>
        </div>
        <p className="text-sm text-gray-500">
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
      

    </div>
  );
}
