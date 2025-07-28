import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Plus, RefreshCw, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const { toast } = useToast();

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["/api/products", { 
      search, 
      category: category === "all" ? undefined : category, 
      page, 
      limit: 20 
    }],
    enabled: true,
    staleTime: 0, // Always refetch when query changes
  });

  const { data: apiSettings } = useQuery({
    queryKey: ["/api/settings"],
  });

  // Separate query for all products for work order modal
  const { data: allProductsData } = useQuery({
    queryKey: ["/api/products", { limit: 1000 }], // Get all products for work order creation
    enabled: showWorkOrderModal, // Only fetch when modal is opened
  });

  const isApiConnected = !!apiSettings;
  const showStock = (apiSettings as any)?.showStock ?? true;

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Products synced successfully from BigCommerce",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync products",
        variant: "destructive",
      });
    },
  });

  const products: Product[] = (productsData as any)?.products || [];
  const total = (productsData as any)?.total || 0;
  const totalPages = Math.ceil(total / 20);

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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Products</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your BigCommerce store products</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Bar */}
            <div className="relative flex-1 sm:flex-none">
              <Input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="sm:w-64 pl-10"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleSync}
                disabled={syncMutation.isPending}
                variant={isApiConnected ? "default" : "outline"}
                className={`flex-1 sm:flex-none ${isApiConnected ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 sm:mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </Button>
              
              <Button 
                onClick={() => setShowWorkOrderModal(true)}
                className="flex-1 sm:flex-none"
                size="sm"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Create Work Order</span>
                <span className="sm:hidden">Create</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
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
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-2">
                  <span>{total}</span>
                  <span>products found</span>
                </div>
                {(apiSettings as any)?.lastSyncAt && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
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
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-2/3"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No products found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
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
                    showStock={showStock}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} products
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
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
        products={(allProductsData as any)?.products || []}
      />
    </>
  );
}
