import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Plus, RefreshCw, Package, Grid3X3, List, ChevronDown, ChevronUp, Code } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import ProductCard from "@/components/products/product-card";
import ProductDetailPanel from "@/components/products/product-detail-panel";

import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Product } from "@shared/schema";
import { BreadcrumbCategorySelector } from "@/components/ui/category-selectors";

export default function Products() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [syncProgress, setSyncProgress] = useState<{
    stage: string;
    percentage: number;
    message: string;
    isActive: boolean;
  }>({ stage: '', percentage: 0, message: '', isActive: false });
  const [rawSyncData, setRawSyncData] = useState<any>(null);
  const [showRawData, setShowRawData] = useState(false);
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

  // Fetch all categories
  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError } = useQuery({
    queryKey: ["/api/categories"],
    staleTime: 60000,
  });



  const isApiConnected = !!apiSettings;
  const showStockStatus = (apiSettings as any)?.showStockStatus || false;

  // Cancel sync mutation
  const cancelSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync/cancel");
      return response;
    },
    onSuccess: () => {
      setSyncProgress({ stage: '', percentage: 0, message: '', isActive: false });
      toast({
        title: "Sync Cancelled",
        description: "The product sync has been cancelled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancel Failed",
        description: error.message || "Failed to cancel sync",
        variant: "destructive",
      });
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      // Reset progress and raw data
      setSyncProgress({ stage: '', percentage: 0, message: '', isActive: true });
      setRawSyncData(null);
      setShowRawData(false);
      
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
                isActive: progressData.stage !== 'complete' && progressData.stage !== 'cancelled'
              });
              
              // Store raw data for debugging if available
              if (progressData.rawData) {
                setRawSyncData(progressData.rawData);
              }
              
              // If sync was cancelled, break out of the loop
              if (progressData.stage === 'cancelled') {
                break;
              }
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
              
              <Button onClick={() => setLocation('/work-orders/create')}>
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
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-blue-700">
                    {syncProgress.percentage}%
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelSyncMutation.mutate()}
                    disabled={cancelSyncMutation.isPending}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    {cancelSyncMutation.isPending ? "Cancelling..." : "Cancel"}
                  </Button>
                </div>
              </div>
              <Progress 
                value={syncProgress.percentage} 
                className="w-full h-2 bg-blue-200"
              />
              
              {/* Raw Data Toggle Button */}
              {rawSyncData && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowRawData(!showRawData)}
                    className="text-blue-700 border-blue-300 hover:bg-blue-50"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    {showRawData ? "Hide" : "Show"} Raw JSON Data
                    {showRawData ? (
                      <ChevronUp className="w-4 h-4 ml-2" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-2" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Raw Data Display */}
        {rawSyncData && showRawData && (
          <div className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-4">
            <div className="max-w-7xl">
              <div className="text-sm font-medium text-gray-900 mb-2">
                Raw BigCommerce API Data
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-auto">
                <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                  {JSON.stringify(rawSyncData, null, 2)}
                </pre>
              </div>
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
                <BreadcrumbCategorySelector
                  categories={(categoriesData as string[]) || []}
                  value={category}
                  onChange={handleCategoryChange}
                  placeholder="All Categories"
                />
                
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
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/category-demo")}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Compare Category Selectors
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end space-y-2 sm:space-y-0 sm:space-x-4 text-sm text-gray-600">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-none border-r px-3 py-1"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-none px-3 py-1"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
                
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
              {viewMode === 'grid' ? (
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
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            SKU
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Regular Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sale Price
                          </th>
                          {showStockStatus && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Stock
                            </th>
                          )}
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {products.map((product) => (
                          <tr 
                            key={product.id} 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleProductClick(product)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div>
                                  <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                    {product.name}
                                  </div>
                                  <div className="text-sm text-gray-500 truncate max-w-xs">
                                    {product.category || 'Uncategorized'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {product.sku || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {product.regularPrice ? `$${product.regularPrice}` : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {product.salePrice ? `$${product.salePrice}` : 'N/A'}
                            </td>
                            {showStockStatus && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {product.stock ?? 'N/A'}
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                product.status === 'published' 
                                  ? 'bg-green-100 text-green-800' 
                                  : product.status === 'draft'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {product.status || 'Unknown'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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


    </>
  );
}
