import { Link, useLocation } from "wouter";
import {
  Package,
  ClipboardList,
  Settings,
  Wifi,
  Crown,
  Users,
  Menu,
  X,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import logoPath from "@assets/Artboard 1_1754940868643.png";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [location] = useLocation();

  const { data: workOrders } = useQuery({
    queryKey: ["/api/work-orders"],
  });

  const { data: apiSettings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const pendingWorkOrders =
    (workOrders as any[])?.filter((wo: any) => wo.status === "pending") || [];
  const isConnected = !!apiSettings;

  const navigation = [
    {
      name: "Products",
      href: "/products",
      icon: Package,
      current: location === "/" || location === "/products",
      dataWalkthrough: "products-nav",
    },
    {
      name: "Work Orders",
      href: "/work-orders",
      icon: ClipboardList,
      current: location === "/work-orders",
      badge:
        pendingWorkOrders.length > 0 ? pendingWorkOrders.length : undefined,
      dataWalkthrough: "work-orders-nav",
    },
    {
      name: "Team",
      href: "/team",
      icon: Users,
      current: location === "/team",
      dataWalkthrough: "team-nav",
    },
    {
      name: "Subscription",
      href: "/subscription",
      icon: Crown,
      current: location === "/subscription",
    },
    {
      name: "Feedback",
      href: "/feedback",
      icon: MessageSquare,
      current: location === "/feedback",
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      current: location === "/settings",
      dataWalkthrough: "settings-nav",
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:transform-none",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <img
                  src={logoPath}
                  alt="Catalog Pilot"
                  className="h-8 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity"
                />
              </Link>
            </div>
            {/* Mobile close button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
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
                      "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors mb-1",
                      item.current
                        ? "text-white bg-primary"
                        : "text-gray-700 hover:bg-gray-100",
                    )}
                    data-walkthrough={item.dataWalkthrough}
                    onClick={() => {
                      // Close mobile menu when item is clicked
                      if (onClose) onClose();
                    }}
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
