import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, X, ChevronDown, ChevronRight, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Product, ProductVariant } from "@shared/schema";

interface WorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

interface ProductPriceUpdate {
  productId: string;
  productName: string;
  variantId?: string;
  variantSku?: string;
  newRegularPrice: string;
  newSalePrice: string;
}

export default function WorkOrderModal({ isOpen, onClose, products }: WorkOrderModalProps) {
  const [title, setTitle] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productUpdates, setProductUpdates] = useState<ProductPriceUpdate[]>([]);
  const [scheduleType, setScheduleType] = useState("immediate");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedProducts, setExpandedProducts] = useState<string[]>([]);
  const [loadedVariants, setLoadedVariants] = useState<Record<string, ProductVariant[]>>({});
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const { toast } = useToast();

  // Fetch variants for a specific product
  const fetchProductVariants = async (productId: string): Promise<ProductVariant[]> => {
    if (loadedVariants[productId]) {
      return loadedVariants[productId];
    }
    const response = await apiRequest("GET", `/api/products/${productId}/variants`);
    const variants = await response.json() as ProductVariant[];
    setLoadedVariants(prev => ({ ...prev, [productId]: variants }));
    setVariantCounts(prev => ({ ...prev, [productId]: variants.length }));
    return variants;
  };

  // Check variant counts for visible products to show/hide dropdown arrows
  const checkVariantCounts = async () => {
    const visibleProductIds = filteredProducts.map(p => p.id);
    const uncheckedProducts = visibleProductIds.filter(id => !(id in variantCounts));
    
    if (uncheckedProducts.length === 0) return;
    
    // Fetch variant counts for products we haven't checked yet
    const promises = uncheckedProducts.map(async (productId) => {
      try {
        const response = await apiRequest("GET", `/api/products/${productId}/variants`);
        const variants = await response.json() as ProductVariant[];
        return { productId, count: variants.length, variants };
      } catch (error) {
        console.error(`Error fetching variants for product ${productId}:`, error);
        return { productId, count: 0, variants: [] };
      }
    });
    
    const results = await Promise.all(promises);
    const newCounts: Record<string, number> = {};
    const newVariants: Record<string, ProductVariant[]> = {};
    
    results.forEach(({ productId, count, variants }) => {
      newCounts[productId] = count;
      newVariants[productId] = variants;
    });
    
    setVariantCounts(prev => ({ ...prev, ...newCounts }));
    setLoadedVariants(prev => ({ ...prev, ...newVariants }));
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/work-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Success",
        description: "Work order created successfully",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create work order",
        variant: "destructive",
      });
    },
  });

  // Get unique categories for filter dropdown - include all category levels
  const categories = useMemo(() => {
    const allCategoryParts = new Set<string>();
    
    products.forEach(product => {
      if (product.category) {
        // Split the category path and add all parts
        const parts = product.category.split(' > ');
        // Add the full path
        allCategoryParts.add(product.category);
        // Add each individual part and partial paths
        for (let i = 0; i < parts.length; i++) {
          // Add individual category names
          allCategoryParts.add(parts[i]);
          // Add partial paths (e.g., "Parent", "Parent > Child")
          if (i > 0) {
            allCategoryParts.add(parts.slice(0, i + 1).join(' > '));
          }
        }
      }
    });
    
    return Array.from(allCategoryParts).sort();
  }, [products]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = searchTerm === "" || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || 
        (product.category && product.category.includes(categoryFilter));
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  // Check variant counts when products change or filter changes
  useEffect(() => {
    if (filteredProducts.length > 0) {
      checkVariantCounts();
    }
  }, [filteredProducts, variantCounts]);

  const handleClose = () => {
    setTitle("");
    setSelectedProducts([]);
    setProductUpdates([]);
    setScheduleType("immediate");
    setScheduleDate("");
    setScheduleTime("");
    setSearchTerm("");
    setCategoryFilter("all");
    setExpandedProducts([]);
    setLoadedVariants({});
    setVariantCounts({});
    setShowValidationErrors(false);
    onClose();
  };

  const handleProductToggle = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productId]);
      const product = products.find(p => p.id === productId);
      if (product) {
        setProductUpdates(prev => [...prev, {
          productId,
          productName: product.name,
          newRegularPrice: product.regularPrice || "",
          newSalePrice: product.salePrice || "",
        }]);
      }
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId));
      setProductUpdates(prev => prev.filter(update => 
        update.productId !== productId && !update.variantId?.startsWith(productId)
      ));
    }
  };

  const handleVariantToggle = (productId: string, variant: ProductVariant, checked: boolean) => {
    const updateId = `${productId}-${variant.id}`;
    
    if (checked) {
      const product = products.find(p => p.id === productId);
      if (product) {
        setProductUpdates(prev => [...prev, {
          productId,
          productName: product.name,
          variantId: variant.id,
          variantSku: variant.variantSku || '',
          newRegularPrice: variant.regularPrice || "",
          newSalePrice: variant.salePrice || "",
        }]);
      }
    } else {
      setProductUpdates(prev => prev.filter(update => 
        !(update.productId === productId && update.variantId === variant.id)
      ));
    }
  };

  const toggleProductExpansion = async (productId: string) => {
    if (expandedProducts.includes(productId)) {
      setExpandedProducts(prev => prev.filter(id => id !== productId));
    } else {
      setExpandedProducts(prev => [...prev, productId]);
      // Load variants if not already loaded
      if (!loadedVariants[productId]) {
        try {
          await fetchProductVariants(productId);
        } catch (error) {
          console.error('Error loading variants:', error);
        }
      }
    }
  };

  const updateProductPrice = (productId: string, variantId: string | undefined, field: 'newRegularPrice' | 'newSalePrice', value: string) => {
    setProductUpdates(prev => 
      prev.map(update => 
        update.productId === productId && update.variantId === variantId
          ? { ...update, [field]: value }
          : update
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowValidationErrors(true);

    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a work order title",
        variant: "destructive",
      });
      return;
    }

    if (productUpdates.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one product or variant",
        variant: "destructive",
      });
      return;
    }

    // Check if at least one product has a price change
    const hasChanges = productUpdates.some(update => 
      update.newRegularPrice.trim() !== "" || update.newSalePrice.trim() !== ""
    );

    if (!hasChanges) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one price change",
        variant: "destructive",
      });
      return;
    }

    // Validate scheduling if scheduled type is selected
    if (scheduleType === "scheduled" && (!scheduleDate || !scheduleTime)) {
      toast({
        title: "Validation Error",
        description: "Please select both date and time for scheduled execution",
        variant: "destructive",
      });
      return;
    }

    const workOrderData: any = {
      title: title.trim(),
      productUpdates: productUpdates.map(update => ({
        productId: update.productId,
        productName: update.productName,
        newRegularPrice: update.newRegularPrice.trim() || undefined,
        newSalePrice: update.newSalePrice.trim() || undefined,
      })),
      executeImmediately: scheduleType === "immediate",
    };

    if (scheduleType === "scheduled" && scheduleDate && scheduleTime) {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      workOrderData.scheduledAt = scheduledAt.toISOString();
    }
    createMutation.mutate(workOrderData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Work Order Title */}
          <div>
            <Label htmlFor="title">Work Order Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Black Friday Sale Pricing"
              className="mt-1"
            />
          </div>
          
          {/* Product Selection */}
          <div>
            <Label>Select Products</Label>
            
            {/* Search and Filter Controls */}
            <div className="flex gap-3 mt-2 mb-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 h-9"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category || ""}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selection Actions */}
            <div className="flex gap-2 mb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const visibleProductIds = filteredProducts.map(p => p.id);
                  const newSelected = Array.from(new Set([...selectedProducts, ...visibleProductIds]));
                  setSelectedProducts(newSelected);
                  
                  const newUpdates = [...productUpdates];
                  filteredProducts.forEach(product => {
                    if (!productUpdates.find(u => u.productId === product.id)) {
                      newUpdates.push({
                        productId: product.id,
                        productName: product.name,
                        newRegularPrice: product.regularPrice || "",
                        newSalePrice: product.salePrice || "",
                      });
                    }
                  });
                  setProductUpdates(newUpdates);
                }}
              >
                Select All Visible ({filteredProducts.length})
              </Button>
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const visibleProductIds = filteredProducts.map(p => p.id);
                  setSelectedProducts(prev => prev.filter(id => !visibleProductIds.includes(id)));
                  setProductUpdates(prev => prev.filter(update => !visibleProductIds.includes(update.productId)));
                }}
                disabled={filteredProducts.length === 0}
              >
                Deselect All Visible
              </Button>
              
              {selectedProducts.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProducts([]);
                    setProductUpdates([]);
                  }}
                >
                  Clear All ({selectedProducts.length})
                </Button>
              )}
            </div>

            {/* Product Selection with Variants */}
            <ScrollArea className="border rounded-lg h-72 mt-2">
              <div className="space-y-2 p-4">
                {filteredProducts.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <p>No products found matching your search criteria</p>
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const isExpanded = expandedProducts.includes(product.id);
                    const variants = loadedVariants[product.id] || [];
                    const variantCount = variantCounts[product.id] || 0;
                    const isProductSelected = selectedProducts.includes(product.id);
                    const hasSelectedVariants = productUpdates.some(update => 
                      update.productId === product.id && update.variantId
                    );

                    return (
                      <div key={product.id} className="border rounded-lg">
                        {/* Main Product Row */}
                        <div className="flex items-center space-x-3 p-3 hover:bg-gray-50">
                          <Checkbox
                            checked={isProductSelected && !hasSelectedVariants}
                            onCheckedChange={(checked) => handleProductToggle(product.id, checked as boolean)}
                          />
                          {/* Only show dropdown arrow if product has multiple variants */}
                          {variantCount > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleProductExpansion(product.id)}
                              className="p-1 h-6 w-6"
                            >
                              {isExpanded ? 
                                <ChevronDown className="h-4 w-4" /> : 
                                <ChevronRight className="h-4 w-4" />
                              }
                            </Button>
                          ) : (
                            <div className="p-1 h-6 w-6" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {product.name}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                  <span>ID: {product.id}</span>
                                  {product.category && <span>Category: {product.category}</span>}
                                  {variantCount > 1 && (
                                    <span className="text-blue-600">{variantCount} variants</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-gray-900">
                                  ${product.regularPrice || "0.00"}
                                </div>
                                {product.salePrice && (
                                  <div className="text-xs text-green-600">
                                    Sale: ${product.salePrice}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Variants Section - only show when expanded and has multiple variants */}
                        {isExpanded && variantCount > 1 && (
                          <div className="border-t bg-gray-50 p-3">
                            {variants.length === 0 ? (
                              <div className="text-center text-gray-500 py-4">
                                <p className="text-sm">No variants found for this product</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {variants.map((variant) => {
                                  const isVariantSelected = productUpdates.some(update => 
                                    update.productId === product.id && update.variantId === variant.id
                                  );
                                  
                                  return (
                                    <div key={variant.id} className="flex items-center space-x-3 p-2 bg-white rounded border">
                                      <Checkbox
                                        checked={isVariantSelected}
                                        onCheckedChange={(checked) => handleVariantToggle(product.id, variant, checked as boolean)}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-700 truncate">
                                              {variant.variantSku || `Variant ${variant.id}`}
                                            </p>
                                            {variant.optionValues && (
                                              <div className="flex gap-2 mt-1">
                                                {Object.entries(variant.optionValues).map(([key, value]) => (
                                                  <span key={key} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                    {key}: {value}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-right">
                                            <div className="text-sm font-medium text-gray-700">
                                              ${variant.regularPrice || "0.00"}
                                            </div>
                                            {variant.salePrice && (
                                              <div className="text-xs text-green-600">
                                                Sale: ${variant.salePrice}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            
            <p className="text-xs text-gray-500 mt-2">
              {filteredProducts.length !== products.length && (
                <span>Showing {filteredProducts.length} of {products.length} products. </span>
              )}
              {selectedProducts.length > 0 && (
                <span>{selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected.</span>
              )}
            </p>
          </div>
          
          {/* Per-Product/Variant Price Updates */}
          {productUpdates.length > 0 && (
            <div>
              <Label>Set New Prices for Each Selected Item</Label>
              <div className="border rounded-lg overflow-hidden mt-2">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-700">
                    <div>Product/Variant</div>
                    <div>New Regular Price</div>
                    <div>New Sale Price</div>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {productUpdates.map((update, index) => (
                    <div key={`${update.productId}-${update.variantId || 'main'}`} className="grid grid-cols-3 gap-4 p-4 border-b last:border-b-0">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate">{update.productName}</span>
                        {update.variantId ? (
                          <>
                            <span className="text-xs text-blue-600">Variant: {update.variantSku}</span>
                            <span className="text-xs text-gray-500">Product ID: {update.productId}</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">Product ID: {update.productId}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-500 mr-2">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={update.newRegularPrice}
                            onChange={(e) => updateProductPrice(update.productId, update.variantId, 'newRegularPrice', e.target.value)}
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-500 mr-2">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={update.newSalePrice}
                            onChange={(e) => updateProductPrice(update.productId, update.variantId, 'newSalePrice', e.target.value)}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter new prices for each item. Leave blank to keep current price.
              </p>
            </div>
          )}
          
          {/* Scheduling */}
          <div>
            <Label>Execution Schedule</Label>
            <RadioGroup
              value={scheduleType}
              onValueChange={setScheduleType}
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="immediate" id="immediate" />
                <Label htmlFor="immediate">Execute immediately</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scheduled" id="scheduled" />
                <Label htmlFor="scheduled">Schedule for later</Label>
              </div>
            </RadioGroup>
            
            {scheduleType === "scheduled" && (
              <div className="ml-6 grid grid-cols-2 gap-4 mt-3">
                <div>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Work Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}