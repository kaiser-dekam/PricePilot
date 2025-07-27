import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Product } from "@shared/schema";
import ProductVariantsDisplay from "@/components/products/product-variants-display";

interface WorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

interface ProductPriceUpdate {
  productId: string;
  productName: string;
  newRegularPrice: string;
  newSalePrice: string;
  variantUpdates?: Array<{
    variantId: string;
    variantSku: string;
    optionValues: Array<{
      option_display_name: string;
      label: string;
    }>;
    newRegularPrice?: string;
    newSalePrice?: string;
  }>;
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
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [variantUpdates, setVariantUpdates] = useState<Record<string, Array<{
    variantId: string;
    variantSku: string;
    optionValues: Array<{
      option_display_name: string;
      label: string;
    }>;
    newRegularPrice?: string;
    newSalePrice?: string;
  }>>>({});
  const [presetTrigger, setPresetTrigger] = useState<{ type: 'removeSalePrices' | 'applyDiscount'; discountPercentage?: string } | null>(null);
  const { toast } = useToast();

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

  // Get unique categories for filter dropdown
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return cats.sort();
  }, [products]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = searchTerm === "" || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || 
        product.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  const handleClose = () => {
    setTitle("");
    setSelectedProducts([]);
    setProductUpdates([]);
    setVariantUpdates({});
    setScheduleType("immediate");
    setScheduleDate("");
    setScheduleTime("");
    setSearchTerm("");
    setCategoryFilter("all");
    setDiscountPercentage("");
    onClose();
  };

  const handleVariantUpdate = (productId: string, variants: Array<{
    variantId: string;
    variantSku: string;
    optionValues: Array<{
      option_display_name: string;
      label: string;
    }>;
    newRegularPrice?: string;
    newSalePrice?: string;
  }>) => {
    setVariantUpdates(prev => ({
      ...prev,
      [productId]: variants
    }));

    // Update the product updates to include variant updates
    setProductUpdates(prev => 
      prev.map(update => 
        update.productId === productId 
          ? { ...update, variantUpdates: variants }
          : update
      )
    );
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
      setProductUpdates(prev => prev.filter(update => update.productId !== productId));
    }
  };

  const updateProductPrice = (productId: string, field: 'newRegularPrice' | 'newSalePrice', value: string) => {
    setProductUpdates(prev => 
      prev.map(update => 
        update.productId === productId 
          ? { ...update, [field]: value }
          : update
      )
    );
  };

  const applyPreset = (presetType: 'removeSalePrices' | 'applyDiscount') => {
    if (selectedProducts.length === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select products before applying a preset",
        variant: "destructive",
      });
      return;
    }

    if (presetType === 'applyDiscount') {
      const percentage = parseFloat(discountPercentage);
      if (!percentage || percentage <= 0 || percentage >= 100) {
        toast({
          title: "Invalid Percentage",
          description: "Please enter a valid discount percentage (1-99)",
          variant: "destructive",
        });
        return;
      }
    }

    setProductUpdates(prev => 
      prev.map(update => {
        const product = products.find(p => p.id === update.productId);
        if (!product) return update;

        // Apply to main product
        let updatedProduct = { ...update };
        if (presetType === 'removeSalePrices') {
          updatedProduct.newSalePrice = "0.00";
        } else if (presetType === 'applyDiscount') {
          const regularPrice = parseFloat(product.regularPrice || "0");
          const percentage = parseFloat(discountPercentage);
          if (regularPrice > 0 && percentage > 0) {
            const salePrice = regularPrice * (1 - percentage / 100);
            updatedProduct.newSalePrice = salePrice.toFixed(2);
          }
        }

        // Variants will be handled by the ProductVariantsDisplay component via presetTrigger

        return updatedProduct;
      })
    );

    // Trigger preset application for variants
    setPresetTrigger({
      type: presetType,
      discountPercentage: presetType === 'applyDiscount' ? discountPercentage : undefined
    });
    
    // Clear the trigger after a short delay
    setTimeout(() => setPresetTrigger(null), 100);

    toast({
      title: "Preset Applied",
      description: presetType === 'removeSalePrices' 
        ? "Sale prices set to 0.00 for products and variants"
        : `${discountPercentage}% discount applied to products and variants`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

    // Check if at least one product has a price change (including variants)
    const hasChanges = productUpdates.some(update => 
      update.newRegularPrice.trim() !== "" || 
      update.newSalePrice.trim() !== "" ||
      (update.variantUpdates && update.variantUpdates.length > 0)
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
            <div className="flex gap-2 mb-3 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const allProductIds = products.map(p => p.id);
                  setSelectedProducts(allProductIds);
                  
                  const newUpdates = products.map(product => ({
                    productId: product.id,
                    productName: product.name,
                    newRegularPrice: product.regularPrice || "",
                    newSalePrice: product.salePrice || "",
                  }));
                  setProductUpdates(newUpdates);
                }}
                disabled={products.length === 0}
              >
                Select All Products ({products.length})
              </Button>
              
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

            <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
              <div className="p-4 space-y-2">
                {filteredProducts.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {searchTerm || categoryFilter !== "all" ? "No products match your filters" : "No products available"}
                  </p>
                ) : (
                  filteredProducts.map((product) => (
                    <div key={product.id} className="flex items-start space-x-2 py-1">
                      <Checkbox
                        id={product.id}
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => 
                          handleProductToggle(product.id, checked as boolean)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={product.id} className="text-sm font-medium cursor-pointer">
                          {product.name}
                        </Label>
                        <div className="text-xs text-gray-500 mt-1">
                          <div>ID: {product.id}</div>
                          <div>Regular: ${product.regularPrice || "N/A"} | Sale: ${product.salePrice || "N/A"}</div>
                          {product.category && <div>Category: {product.category}</div>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              {filteredProducts.length !== products.length && (
                <span>Showing {filteredProducts.length} of {products.length} products. </span>
              )}
              {selectedProducts.length > 0 && (
                <span>{selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected.</span>
              )}
            </p>
          </div>
          
          {/* Per-Product Price Updates */}
          {selectedProducts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Set New Prices for Each Product</Label>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset('removeSalePrices')}
                  >
                    Remove Sale Prices
                  </Button>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      placeholder="20"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                      className="w-16 h-8"
                      min="1"
                      max="99"
                    />
                    <span className="text-sm text-gray-500">% off</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset('applyDiscount')}
                    >
                      Apply Discount
                    </Button>
                  </div>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-700">
                    <div>Product</div>
                    <div>New Regular Price</div>
                    <div>New Sale Price</div>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {productUpdates.map((update) => (
                    <div key={update.productId} className="border-b last:border-b-0 p-4">
                      {/* Main Product Pricing */}
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium truncate">{update.productName}</span>
                          <span className="text-xs text-gray-500">ID: {update.productId}</span>
                        </div>
                        <div>
                          <div className="flex items-center">
                            <span className="text-sm text-gray-500 mr-2">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={update.newRegularPrice}
                              onChange={(e) => updateProductPrice(update.productId, 'newRegularPrice', e.target.value)}
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
                              onChange={(e) => updateProductPrice(update.productId, 'newSalePrice', e.target.value)}
                              className="h-8"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Product Variants */}
                      <ProductVariantsDisplay
                        productId={update.productId}
                        productName={update.productName}
                        onVariantUpdate={handleVariantUpdate}
                        isEditing={true}
                        presetTrigger={presetTrigger}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter new prices for each product. Leave blank to keep current price. Use the preset buttons above for quick bulk updates.
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