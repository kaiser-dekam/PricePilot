import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Plus, RefreshCw, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import ProductCard from "@/components/products/product-card";
import ProductDetailPanel from "@/components/products/product-detail-panel";
import WorkOrderModal from "@/components/work-orders/work-order-modal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Product } from "@shared/schema";

export default function Products() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    stage: string;
    percentage: number;
    message: string;
    isActive: boolean;
  }>({ stage: '', percentage: 0, message: '', isActive: false });
  const { toast } = useToast();

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["/api/products", { 
      search, 
      category: category === "all" ? undefined : category, 
      page, 
      limit 
    }],
    enabled: true,
    staleTime: 0, // Always refetch when query changes
  });

  const { data: apiSettings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const isApiConnected = !!apiSettings;
  const showStockStatus = (apiSettings as any)?.showStockStatus || false;

  const syncMutation = useMutation({
    mutationFn: async () => {
      // Reset progress
      setSyncProgress({ stage: '', percentage: 0, message: '', isActive: true });
      
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await import("@/lib/firebase").then(m => m.getCurrentUserToken())}`,
        }
      });

      if (!response.ok) {
        throw new Error("Failed to start sync");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream available");
      }

      let result: any = null;
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const progressData = JSON.parse(line.slice(6));
              setSyncProgress({
                stage: progressData.stage,
                percentage: progressData.percentage,
                message: progressData.message || '',
                isActive: progressData.stage !== 'complete'
              });
            } else if (line.startsWith('result: ')) {
              result = JSON.parse(line.slice(8));
            } else if (line.startsWith('error: ')) {
              const errorData = JSON.parse(line.slice(7));
              throw new Error(errorData.message);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return result;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      // Reset progress after a brief delay
      setTimeout(() => {
        setSyncProgress({ stage: '', percentage: 0, message: '', isActive: false });
      }, 1000);
      
      // Show success message
      toast({
        title: "Success",
        description: data?.message || "Products synced successfully from BigCommerce",
      });

      // Show warning if user hit plan limits
      if (data?.warning) {
        setTimeout(() => {
          toast({
            title: "Plan Limit Reached",
            description: data.warning,
            variant: "destructive",
            duration: 8000, // Show longer for important plan information
          });
        }, 1000); // Delay slightly so success message shows first
      }
    },
    onError: (error: any) => {
      setSyncProgress({ stage: '', percentage: 0, message: '', isActive: false });
      toast({
        title: "Error",
        description: error.message || "Failed to sync products",
        variant: "destructive",
      });
    },
  });

  const products: Product[] = (productsData as any)?.products || [];
  const total = (productsData as any)?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleClosePanel = () => {
    setSelectedProduct(null);
  };

  const handleSync = () => {
    syncMutation.mutate();
  };

  // Reset to page 1 when search or category changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(1);
  };

  return (
    <>
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Products</h2>
            <p className="text-sm text-gray-500 mt-1">Manage your store products and inventory</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            {/* Search Bar */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full sm:w-64 pl-10"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            
            <div className="flex space-x-2">
              <Button
                onClick={handleSync}
                disabled={syncMutation.isPending || syncProgress.isActive}
                variant={isApiConnected ? "default" : "outline"}
                className={isApiConnected ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${(syncMutation.isPending || syncProgress.isActive) ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{syncMutation.isPending || syncProgress.isActive ? "Syncing..." : "Sync"}</span>
              </Button>
              
              <Button onClick={() => setShowWorkOrderModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Create Work Order</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Sync Progress Bar */}
        {syncProgress.isActive && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 sm:px-6 py-3">
            <div className="max-w-7xl">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-blue-900">
                  {syncProgress.message || 'Syncing products...'}
                </div>
                <div className="text-sm text-blue-700">
                  {syncProgress.percentage}%
                </div>
              </div>
              <Progress 
                value={syncProgress.percentage} 
                className="w-full h-2 bg-blue-200"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          {/* Filters Bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <Select value={category} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="electronics">Electronics</SelectItem>
                    <SelectItem value="clothing">Clothing</SelectItem>
                    <SelectItem value="home">Home & Garden</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                    setPage(1);
                  }}
                  className="w-full sm:w-auto"
                >
                  Clear Filters
                </Button>
              </div>
              
              <div className="flex items-center justify-center sm:justify-end space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <span>{total}</span>
                  <span>products found</span>
                </div>
                {(apiSettings as any)?.lastSyncAt && (
                  <div className="text-xs text-gray-500">
                    Last Sync'd: {new Date((apiSettings as any).lastSyncAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500 mb-4">
                {search || category ? "Try adjusting your filters" : "Sync products from BigCommerce to get started"}
              </p>
              {!search && !category && (
                <Button onClick={handleSync} disabled={syncMutation.isPending}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  Sync Products
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => handleProductClick(product)}
                    showStockStatus={showStockStatus}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="text-sm text-gray-600 text-center sm:text-left">
                      Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} products
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Show:</span>
                      <Select value={limit.toString()} onValueChange={(value) => {
                        setLimit(parseInt(value));
                        setPage(1); // Reset to first page when changing limit
                      }}>
                        <SelectTrigger className="w-20 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      // Show 5 pages centered around current page
                      const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
                      const pageNum = startPage + i;
                      
                      if (pageNum > totalPages) return null;
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    
                    <Button
                      variant="outline"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Product Detail Panel */}
      <ProductDetailPanel
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={handleClosePanel}
      />

      {/* Work Order Modal */}
      <WorkOrderModal
        isOpen={showWorkOrderModal}
        onClose={() => setShowWorkOrderModal(false)}
        products={products}
      />
    </>
  );
}
