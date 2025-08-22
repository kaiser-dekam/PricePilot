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
import { SimpleCategorySelector } from "@/components/ui/simple-category-selector";
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
  
  // Bulk adjustment states
  const [bulkAdjustmentType, setBulkAdjustmentType] = useState<"percentage" | "amount" | "remove">("percentage");
  const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState("");
  const [bulkPriceType, setBulkPriceType] = useState<"regularPrice" | "salePrice">("regularPrice");
  const [lastPercentageValue, setLastPercentageValue] = useState("");

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
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
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

  const applyBulkAdjustment = () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please select products first",
        variant: "destructive",
      });
      return;
    }

    // Handle remove sale prices option
    if (bulkPriceType === "salePrice" && bulkAdjustmentType === "remove") {
      selectedProducts.forEach(productId => {
        updateProductPrice(productId, "salePrice", "");
      });

      toast({
        title: "Success",
        description: `Removed sale prices from ${selectedProducts.length} products`,
      });
      return;
    }

    // Handle regular adjustments
    if (!bulkAdjustmentValue.trim()) {
      toast({
        title: "Error",
        description: "Please enter an adjustment value",
        variant: "destructive",
      });
      return;
    }

    const adjustmentValue = parseFloat(bulkAdjustmentValue);
    if (isNaN(adjustmentValue)) {
      toast({
        title: "Error",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }

    selectedProducts.forEach(productId => {
      const product = allProducts.find(p => p.id === productId);
      if (!product) return;

      let newPrice: number;
      let currentPrice = parseFloat(product[bulkPriceType]) || 0;
      
      // For sale price, if no current sale price, use regular price as base
      if (bulkPriceType === "salePrice" && currentPrice === 0) {
        currentPrice = parseFloat(product.regularPrice) || 0;
      }

      if (bulkAdjustmentType === "percentage") {
        // For sale prices, percentage should be a discount (reduction)
        // For regular prices, percentage could be an increase or decrease based on context
        if (bulkPriceType === "salePrice") {
          newPrice = currentPrice * (1 - adjustmentValue / 100); // Apply discount
        } else {
          newPrice = currentPrice * (1 + adjustmentValue / 100); // Apply increase for regular price
        }
      } else {
        // For amount adjustments, subtract for sale prices (discount), add for regular prices
        if (bulkPriceType === "salePrice") {
          newPrice = currentPrice - adjustmentValue; // Apply discount
        } else {
          newPrice = currentPrice + adjustmentValue; // Apply increase for regular price
        }
      }

      // Ensure price is not negative
      newPrice = Math.max(0, newPrice);
      
      updateProductPrice(productId, bulkPriceType, newPrice.toFixed(2));
    });

    // Create appropriate success message
    let adjustmentDescription = "";
    if (bulkAdjustmentType === "percentage") {
      if (bulkPriceType === "salePrice") {
        adjustmentDescription = `${adjustmentValue}% discount`;
      } else {
        adjustmentDescription = `${adjustmentValue}% increase`;
      }
    } else {
      if (bulkPriceType === "salePrice") {
        adjustmentDescription = `$${adjustmentValue} discount`;
      } else {
        adjustmentDescription = `$${adjustmentValue} increase`;
      }
    }

    toast({
      title: "Success",
      description: `Applied ${adjustmentDescription} to ${selectedProducts.length} products`,
    });

    // Remember the last percentage value if it was a percentage adjustment
    if (bulkAdjustmentType === "percentage") {
      setLastPercentageValue(bulkAdjustmentValue);
    }
    
    setBulkAdjustmentValue("");
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

    // Transform productUpdates to match the work order schema format
    const formattedProductUpdates = relevantUpdates.map(update => {
      const product = allProducts.find(p => p.id === update.productId);
      const result: any = {
        productId: update.productId,
        productName: product?.name || "Unknown Product",
      };

      // Add price updates if they exist
      if (update.regularPrice !== undefined) {
        result.newRegularPrice = update.regularPrice.toString();
      }
      if (update.salePrice !== undefined) {
        result.newSalePrice = update.salePrice.toString();
      }

      // Handle variants if they exist
      if (update.variants && update.variants.length > 0) {
        // For now, just include the first variant's data in the main update
        // TODO: Handle multiple variants properly
        const firstVariant = update.variants[0];
        const variant = loadedVariants[update.productId]?.find(v => v.id === firstVariant.variantId);
        
        if (variant) {
          result.variantId = firstVariant.variantId;
          result.variantSku = variant.variantSku;
          
          if (firstVariant.regularPrice !== undefined) {
            result.newRegularPrice = firstVariant.regularPrice.toString();
          }
          if (firstVariant.salePrice !== undefined) {
            result.newSalePrice = firstVariant.salePrice.toString();
          }
        }
      }

      return result;
    });

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
      productUpdates: formattedProductUpdates,
      scheduledAt,
      executeImmediately: scheduleType === "immediate",
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

  // Select all visible products
  const selectAllVisible = () => {
    const visibleProductIds = allProducts.map(product => product.id);
    const newSelected = Array.from(new Set([...selectedProducts, ...visibleProductIds]));
    setSelectedProducts(newSelected);
  };

  // Select all products with sale prices
  const selectAllSaleItems = () => {
    const saleProductIds = allProducts
      .filter(product => product.salePrice && parseFloat(product.salePrice) > 0)
      .map(product => product.id);
    const newSelected = Array.from(new Set([...selectedProducts, ...saleProductIds]));
    setSelectedProducts(newSelected);
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
        {/* Work Order Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Work Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
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

              <div>
                <Label>Selected Products</Label>
                <div className="h-10 flex items-center">
                  <Badge variant="secondary" className="text-sm">
                    {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </div>

            {scheduleType === "scheduled" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Selection */}
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Select Products</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllVisible}
                      disabled={isLoadingProducts || allProducts.length === 0}
                    >
                      Select All Visible
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllSaleItems}
                      disabled={isLoadingProducts}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      Select All Sale Items
                    </Button>
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
                  <div className="w-full sm:w-64">
                    {isLoadingCategories ? (
                      <div className="flex items-center justify-center h-10 border rounded bg-gray-50">
                        <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                      </div>
                    ) : (
                      <SimpleCategorySelector
                        categories={(categoriesData as string[]) || []}
                        value={categoryFilter}
                        onChange={(value) => {
                          setCategoryFilter(value);
                          setPage(1);
                          setAllProducts([]);
                        }}
                        placeholder="Filter by category"
                      />
                    )}
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
                                  <div className="flex items-center gap-4 mt-1">
                                    {product.category && (
                                      <p className="text-xs text-gray-500">
                                        {product.category}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-gray-500">Current:</span>
                                      <span className="font-medium text-gray-700">
                                        ${parseFloat(product.regularPrice || "0").toFixed(2)}
                                      </span>
                                      {product.salePrice && (
                                        <>
                                          <span className="text-gray-400">|</span>
                                          <span className="text-gray-500">Sale:</span>
                                          <span className="font-medium text-green-600">
                                            ${parseFloat(product.salePrice).toFixed(2)}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
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

                              {/* Variants */}
                              {expandedProducts.includes(product.id) && loadedVariants[product.id] && (
                                <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                                  {loadedVariants[product.id].map((variant: any) => (
                                    <div key={variant.id} className="bg-gray-50 p-2 rounded">
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-gray-800">
                                          {variant.skuText}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs">
                                          <span className="text-gray-500">Current:</span>
                                          <span className="font-medium text-gray-700">
                                            ${parseFloat(variant.price || "0").toFixed(2)}
                                          </span>
                                          {variant.salePrice && (
                                            <>
                                              <span className="text-gray-400">|</span>
                                              <span className="text-gray-500">Sale:</span>
                                              <span className="font-medium text-green-600">
                                                ${parseFloat(variant.salePrice).toFixed(2)}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
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

          {/* Price Changes Section */}
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Price Changes</CardTitle>
                  {selectedProducts.length > 0 && (
                    <Badge variant="secondary" className="text-sm">
                      {selectedProducts.length} selected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">Select products to set price changes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Bulk Price Adjustment */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <Label className="text-sm font-medium">Bulk Price Adjustment</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Price Type</Label>
                          <Select value={bulkPriceType} onValueChange={(value: "regularPrice" | "salePrice") => setBulkPriceType(value)}>
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="regularPrice">Regular Price</SelectItem>
                              <SelectItem value="salePrice">Sale Price</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs">Adjustment Type</Label>
                          <Select value={bulkAdjustmentType} onValueChange={(value: "percentage" | "amount" | "remove") => setBulkAdjustmentType(value)}>
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="amount">Fixed Amount</SelectItem>
                              {bulkPriceType === "salePrice" && (
                                <SelectItem value="remove">Remove All Sale Prices</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          {bulkPriceType === "salePrice" && bulkAdjustmentType === "remove" ? (
                            <div className="text-center py-2">
                              <p className="text-xs text-gray-600 mb-2">
                                This will remove all sale prices from selected products
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={applyBulkAdjustment}
                                className="whitespace-nowrap text-red-600 border-red-200 hover:bg-red-50"
                              >
                                Remove Sale Prices
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Label className="text-xs">
                                {bulkAdjustmentType === "percentage" ? "Percentage (%)" : "Amount ($)"}
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  step={bulkAdjustmentType === "percentage" ? "1" : "0.01"}
                                  placeholder={bulkAdjustmentType === "percentage" ? (lastPercentageValue || "10") : "5.00"}
                                  value={bulkAdjustmentValue}
                                  onChange={(e) => setBulkAdjustmentValue(e.target.value)}
                                  className="text-sm"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={applyBulkAdjustment}
                                  className="whitespace-nowrap"
                                >
                                  Apply
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Individual Product Price Settings */}
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {selectedProducts.map(productId => {
                        const product = allProducts.find(p => p.id === productId);
                        if (!product) return null;

                        return (
                          <div key={productId} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-medium text-gray-900 text-sm">
                                  {product.name}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                  <span>Current: ${parseFloat(product.regularPrice || "0").toFixed(2)}</span>
                                  {product.salePrice && (
                                    <>
                                      <span>|</span>
                                      <span>Sale: ${parseFloat(product.salePrice).toFixed(2)}</span>
                                    </>
                                  )}
                                </div>
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
                                  <span className="ml-1 text-xs">
                                    {variantCounts[product.id]} variant{variantCounts[product.id] !== 1 ? 's' : ''}
                                  </span>
                                </Button>
                              )}
                            </div>

                            {/* Product Base Price Inputs */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <Label className="text-xs">New Regular Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder={product.regularPrice || "0.00"}
                                  value={getProductUpdate(product.id)?.regularPrice || ""}
                                  onChange={(e) => updateProductPrice(product.id, "regularPrice", e.target.value)}
                                  className="text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">New Sale Price</Label>
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

                            {/* Variant Price Inputs */}
                            {expandedProducts.includes(product.id) && loadedVariants[product.id] && (
                              <div className="pl-4 border-l-2 border-gray-200 space-y-2">
                                {loadedVariants[product.id].map((variant: any) => (
                                  <div key={variant.id} className="bg-gray-50 p-2 rounded">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-sm font-medium text-gray-800">
                                        {variant.skuText}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span>Current: ${parseFloat(variant.price || "0").toFixed(2)}</span>
                                        {variant.salePrice && (
                                          <>
                                            <span>|</span>
                                            <span>Sale: ${parseFloat(variant.salePrice).toFixed(2)}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <Label className="text-xs">New Regular Price</Label>
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
                                        <Label className="text-xs">New Sale Price</Label>
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
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}