import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar, Clock, Search, Filter, Plus, Minus, Package, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ProductUpdate {
  productId: string;
  regularPrice?: number;
  salePrice?: number;
  variants?: Array<{
    variantId: string;
    regularPrice?: number;
    salePrice?: number;
  }>;
}

export default function CreateWorkOrder() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productUpdates, setProductUpdates] = useState<ProductUpdate[]>([]);
  const [scheduleType, setScheduleType] = useState("immediate");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedProducts, setExpandedProducts] = useState<string[]>([]);
  const [loadedVariants, setLoadedVariants] = useState<Record<string, any[]>>({});
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [priceType, setPriceType] = useState("regular");
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  const { toast } = useToast();

  // Fetch products with pagination
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["/api/products", { 
      search: searchTerm, 
      category: categoryFilter === "all" ? undefined : categoryFilter, 
      page, 
      limit 
    }],
    staleTime: 0,
  });

  // Fetch all categories
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
    staleTime: 60000,
  });

  const products = (productsData as any)?.products || [];
  const totalProducts = (productsData as any)?.total || 0;
  const totalPages = Math.ceil(totalProducts / limit);

  // Update allProducts when products change
  useEffect(() => {
    if (page === 1) {
      setAllProducts(products);
    } else {
      setAllProducts(prev => [...prev, ...products]);
    }
  }, [products, page]);

  // Get hierarchical categories for filter dropdown from API
  const categories = useMemo(() => {
    if (!categoriesData) return [];
    
    const categorySet = new Set<string>();
    
    (categoriesData as string[]).forEach((categoryPath: string) => {
      if (categoryPath && categoryPath.trim()) {
        const parts = categoryPath.split(' > ').map(p => p.trim());
        for (let i = 0; i < parts.length; i++) {
          const currentPath = parts.slice(0, i + 1).join(' > ');
          categorySet.add(currentPath);
        }
      }
    });
    
    const categoryPaths = Array.from(categorySet);
    
    const buildHierarchy = (paths: string[]): Array<{ fullPath: string; level: number; displayName: string }> => {
      const result: Array<{ fullPath: string; level: number; displayName: string }> = [];
      
      const pathsByParent = new Map<string, string[]>();
      const rootPaths: string[] = [];
      
      paths.forEach(path => {
        const parts = path.split(' > ');
        if (parts.length === 1) {
          rootPaths.push(path);
        } else {
          const parentPath = parts.slice(0, -1).join(' > ');
          if (!pathsByParent.has(parentPath)) {
            pathsByParent.set(parentPath, []);
          }
          pathsByParent.get(parentPath)!.push(path);
        }
      });
      
      const addCategory = (path: string, level: number) => {
        const parts = path.split(' > ');
        const displayName = parts[parts.length - 1];
        
        result.push({
          fullPath: path,
          level,
          displayName
        });
        
        const children = pathsByParent.get(path) || [];
        children.sort((a, b) => {
          const aName = a.split(' > ').pop() || '';
          const bName = b.split(' > ').pop() || '';
          return aName.localeCompare(bName);
        });
        
        children.forEach(childPath => {
          addCategory(childPath, level + 1);
        });
      };
      
      rootPaths.sort().forEach(rootPath => {
        addCategory(rootPath, 0);
      });
      
      return result;
    };
    
    return buildHierarchy(categoryPaths);
  }, [categoriesData]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/work-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Success",
        description: "Work order created successfully",
      });
      setLocation("/work-orders");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create work order",
        variant: "destructive",
      });
    },
  });

  const loadVariants = async (productId: string) => {
    if (loadedVariants[productId]) return;
    
    try {
      const variants = await apiRequest("GET", `/api/products/${productId}/variants`) as unknown as any[];
      setLoadedVariants(prev => ({ ...prev, [productId]: variants }));
    } catch (error) {
      console.error("Failed to load variants:", error);
    }
  };

  const checkVariantCounts = async () => {
    const counts: Record<string, number> = {};
    
    for (const product of allProducts) {
      try {
        const variants = await apiRequest("GET", `/api/products/${product.id}/variants`) as unknown as any[];
        counts[product.id] = variants.length;
      } catch (error) {
        console.error(`Failed to check variants for product ${product.id}:`, error);
        counts[product.id] = 0;
      }
    }
    
    setVariantCounts(counts);
  };

  useEffect(() => {
    if (allProducts.length > 0) {
      checkVariantCounts();
    }
  }, [allProducts]);

  const toggleProductExpansion = async (productId: string) => {
    if (expandedProducts.includes(productId)) {
      setExpandedProducts(prev => prev.filter(id => id !== productId));
    } else {
      await loadVariants(productId);
      setExpandedProducts(prev => [...prev, productId]);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const updateProductPrice = (productId: string, field: "regularPrice" | "salePrice", value: string) => {
    const numValue = value === "" ? undefined : parseFloat(value);
    
    setProductUpdates(prev => {
      const existing = prev.find(u => u.productId === productId);
      if (existing) {
        return prev.map(u => 
          u.productId === productId 
            ? { ...u, [field]: numValue }
            : u
        );
      } else {
        return [...prev, { productId, [field]: numValue }];
      }
    });
  };

  const updateVariantPrice = (productId: string, variantId: string, field: "regularPrice" | "salePrice", value: string) => {
    const numValue = value === "" ? undefined : parseFloat(value);
    
    setProductUpdates(prev => {
      const existing = prev.find(u => u.productId === productId);
      if (existing) {
        const variants = existing.variants || [];
        const existingVariant = variants.find(v => v.variantId === variantId);
        
        const updatedVariants = existingVariant
          ? variants.map(v => v.variantId === variantId ? { ...v, [field]: numValue } : v)
          : [...variants, { variantId, [field]: numValue }];
        
        return prev.map(u => 
          u.productId === productId 
            ? { ...u, variants: updatedVariants }
            : u
        );
      } else {
        return [...prev, { 
          productId, 
          variants: [{ variantId, [field]: numValue }] 
        }];
      }
    });
  };

  const getProductUpdate = (productId: string) => {
    return productUpdates.find(u => u.productId === productId);
  };

  const getVariantUpdate = (productId: string, variantId: string) => {
    const productUpdate = getProductUpdate(productId);
    return productUpdate?.variants?.find(v => v.variantId === variantId);
  };

  const handleSubmit = () => {
    setShowValidationErrors(true);

    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a work order title",
        variant: "destructive",
      });
      return;
    }

    if (selectedProducts.length === 0) {
      toast({
        title: "Validation Error", 
        description: "Please select at least one product",
        variant: "destructive",
      });
      return;
    }

    const relevantUpdates = productUpdates.filter(update => 
      selectedProducts.includes(update.productId)
    );

    if (relevantUpdates.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please set prices for selected products",
        variant: "destructive",
      });
      return;
    }

    let scheduledAt = null;
    if (scheduleType === "scheduled") {
      if (!scheduleDate || !scheduleTime) {
        toast({
          title: "Validation Error",
          description: "Please set both date and time for scheduled work order",
          variant: "destructive",
        });
        return;
      }
      scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }

    createMutation.mutate({
      title,
      productUpdates: relevantUpdates,
      scheduledAt,
    });
  };

  const loadMoreProducts = () => {
    if (page < totalPages) {
      setPage(prev => prev + 1);
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setPage(1);
    setAllProducts([]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/work-orders")}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Work Orders
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Create Work Order
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Set up a new price update for your products
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setLocation("/work-orders")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="bg-[#6792FF] hover:bg-[#5577DD] text-white"
            >
              {createMutation.isPending ? "Creating..." : "Create Work Order"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Work Order Settings */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Work Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter work order title"
                    className={showValidationErrors && !title.trim() ? "border-red-500" : ""}
                  />
                </div>

                <div>
                  <Label>Schedule</Label>
                  <Select value={scheduleType} onValueChange={setScheduleType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Execute Immediately</SelectItem>
                      <SelectItem value="scheduled">Schedule for Later</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scheduleType === "scheduled" && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="scheduleDate">Date *</Label>
                      <Input
                        id="scheduleDate"
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className={showValidationErrors && scheduleType === "scheduled" && !scheduleDate ? "border-red-500" : ""}
                      />
                    </div>
                    <div>
                      <Label htmlFor="scheduleTime">Time *</Label>
                      <Input
                        id="scheduleTime"
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className={showValidationErrors && scheduleType === "scheduled" && !scheduleTime ? "border-red-500" : ""}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label>Price Type</Label>
                  <Select value={priceType} onValueChange={setPriceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular Price</SelectItem>
                      <SelectItem value="sale">Sale Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedProducts.length > 0 && (
                  <div className="pt-3 border-t">
                    <Label>Selected Products</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Product Selection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Select Products</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="text-gray-600"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setPage(1);
                          setAllProducts([]);
                        }}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="w-full sm:w-48">
                    <Select 
                      value={categoryFilter} 
                      onValueChange={(value) => {
                        setCategoryFilter(value);
                        setPage(1);
                        setAllProducts([]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.fullPath} value={category.fullPath}>
                            <span style={{ paddingLeft: `${category.level * 16}px` }}>
                              {category.level > 0 && "└ "}
                              {category.displayName}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Product List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {isLoadingProducts && page === 1 ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">Loading products...</p>
                    </div>
                  ) : allProducts.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No products found</p>
                    </div>
                  ) : (
                    <>
                      {allProducts.map((product) => (
                        <div key={product.id} className="border rounded-lg p-3">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedProducts.includes(product.id)}
                              onCheckedChange={() => toggleProductSelection(product.id)}
                              className="mt-1"
                            />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 truncate">
                                    {product.name}
                                  </h4>
                                  {product.category && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {product.category}
                                    </p>
                                  )}
                                </div>
                                
                                {variantCounts[product.id] > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleProductExpansion(product.id)}
                                    className="text-gray-600 hover:text-gray-900"
                                  >
                                    {expandedProducts.includes(product.id) ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                    <span className="ml-1">
                                      {variantCounts[product.id]} variant{variantCounts[product.id] !== 1 ? 's' : ''}
                                    </span>
                                  </Button>
                                )}
                              </div>

                              {selectedProducts.includes(product.id) && (
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs">Regular Price</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder={product.price || "0.00"}
                                      value={getProductUpdate(product.id)?.regularPrice || ""}
                                      onChange={(e) => updateProductPrice(product.id, "regularPrice", e.target.value)}
                                      className="text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Sale Price</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder={product.salePrice || "0.00"}
                                      value={getProductUpdate(product.id)?.salePrice || ""}
                                      onChange={(e) => updateProductPrice(product.id, "salePrice", e.target.value)}
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Variants */}
                              {expandedProducts.includes(product.id) && loadedVariants[product.id] && (
                                <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                                  {loadedVariants[product.id].map((variant: any) => (
                                    <div key={variant.id} className="bg-gray-50 p-2 rounded">
                                      <p className="text-sm font-medium text-gray-800">
                                        {variant.skuText}
                                      </p>
                                      {selectedProducts.includes(product.id) && (
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                          <div>
                                            <Label className="text-xs">Regular Price</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              placeholder={variant.price || "0.00"}
                                              value={getVariantUpdate(product.id, variant.id)?.regularPrice || ""}
                                              onChange={(e) => updateVariantPrice(product.id, variant.id, "regularPrice", e.target.value)}
                                              className="text-sm"
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-xs">Sale Price</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              placeholder={variant.salePrice || "0.00"}
                                              value={getVariantUpdate(product.id, variant.id)?.salePrice || ""}
                                              onChange={(e) => updateVariantPrice(product.id, variant.id, "salePrice", e.target.value)}
                                              className="text-sm"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Load More Button */}
                      {page < totalPages && (
                        <div className="text-center pt-4">
                          <Button
                            variant="outline"
                            onClick={loadMoreProducts}
                            disabled={isLoadingProducts}
                          >
                            {isLoadingProducts ? "Loading..." : `Load More Products (${page}/${totalPages})`}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}