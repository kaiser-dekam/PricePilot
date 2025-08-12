import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, History, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Product, PriceHistory, ProductVariant } from "@shared/schema";
import { format } from "date-fns";

interface ProductDetailPanelProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

interface VariantPriceEditorProps {
  variant: ProductVariant;
  onUpdate: (variant: ProductVariant, updates: { regularPrice?: string; salePrice?: string }) => void;
  isUpdating: boolean;
}

function VariantPriceEditor({ variant, onUpdate, isUpdating }: VariantPriceEditorProps) {
  const [regularPrice, setRegularPrice] = useState(variant.regularPrice?.toString() || "");
  const [salePrice, setSalePrice] = useState(variant.salePrice?.toString() || "");

  const handleUpdate = () => {
    onUpdate(variant, { regularPrice, salePrice });
  };

  React.useEffect(() => {
    setRegularPrice(variant.regularPrice?.toString() || "");
    setSalePrice(variant.salePrice?.toString() || "");
  }, [variant]);

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h6 className="font-medium text-sm">{variant.variantSku}</h6>
          {variant.variantSku && (
            <p className="text-xs text-gray-500 mt-1">SKU: {variant.variantSku}</p>
          )}
        </div>
        {variant.stock !== undefined && (
          <Badge variant="outline" className="text-xs">
            {variant.stock} in stock
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Label htmlFor={`regular-${variant.id}`} className="text-xs text-gray-600">
            Regular Price
          </Label>
          <div className="flex items-center mt-1">
            <span className="text-sm text-gray-500 mr-1">$</span>
            <Input
              id={`regular-${variant.id}`}
              type="number"
              step="0.01"
              value={regularPrice}
              onChange={(e) => setRegularPrice(e.target.value)}
              className="flex-1 h-8"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor={`sale-${variant.id}`} className="text-xs text-gray-600">
            Sale Price
          </Label>
          <div className="flex items-center mt-1">
            <span className="text-sm text-gray-500 mr-1">$</span>
            <Input
              id={`sale-${variant.id}`}
              type="number"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="flex-1 h-8"
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      <Button
        onClick={handleUpdate}
        disabled={isUpdating}
        size="sm"
        className="w-full"
      >
        {isUpdating ? "Updating..." : "Update Variant"}
      </Button>
    </div>
  );
}

export default function ProductDetailPanel({ product, isOpen, onClose }: ProductDetailPanelProps) {
  const [regularPrice, setRegularPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [showVariants, setShowVariants] = useState(false);
  const { toast } = useToast();

  // Fetch price history for this product
  const { data: priceHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["/api/products", product?.id, "price-history"],
    queryFn: async () => {
      if (!product?.id) return [];
      const response = await apiRequest("GET", `/api/products/${product.id}/price-history`);
      return response.json() as Promise<PriceHistory[]>;
    },
    enabled: !!product?.id && isOpen,
  });

  // Fetch product variants
  const { data: variants, isLoading: variantsLoading } = useQuery({
    queryKey: ["/api/products", product?.id, "variants"],
    queryFn: async () => {
      if (!product?.id) return [];
      const response = await apiRequest("GET", `/api/products/${product.id}/variants`);
      return response.json() as Promise<ProductVariant[]>;
    },
    enabled: !!product?.id && isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { regularPrice?: string; salePrice?: string }) =>
      apiRequest("PUT", `/api/products/${product?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", product?.id, "price-history"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ variantId, data }: { variantId: string; data: { regularPrice?: string; salePrice?: string }}) =>
      apiRequest("PUT", `/api/variants/${variantId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", product?.id, "variants"] });
      toast({
        title: "Success",
        description: "Product variant updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product variant",
        variant: "destructive",
      });
    },
  });

  // Calculate lowest prices from variants
  const lowestPrices = React.useMemo(() => {
    if (!variants || variants.length <= 1) {
      return null;
    }
    
    const regularPrices = variants
      .map(v => parseFloat(v.regularPrice?.toString() || '0'))
      .filter(p => p > 0);
    
    const salePrices = variants
      .map(v => parseFloat(v.salePrice?.toString() || '0'))
      .filter(p => p > 0);
    
    return {
      lowestRegularPrice: regularPrices.length > 0 ? Math.min(...regularPrices) : 0,
      lowestSalePrice: salePrices.length > 0 ? Math.min(...salePrices) : 0
    };
  }, [variants]);

  const hasMultipleVariants = variants && variants.length > 1;

  // Update form when product changes
  React.useEffect(() => {
    if (product && !hasMultipleVariants) {
      setRegularPrice(product.regularPrice || "");
      setSalePrice(product.salePrice || "");
    } else if (hasMultipleVariants && lowestPrices) {
      // For products with variants, show the lowest prices (read-only)
      setRegularPrice(lowestPrices.lowestRegularPrice.toFixed(2));
      setSalePrice(lowestPrices.lowestSalePrice > 0 ? lowestPrices.lowestSalePrice.toFixed(2) : "");
    }
  }, [product, hasMultipleVariants, lowestPrices]);

  const handleUpdate = () => {
    if (!product) return;

    const updates: any = {};
    if (regularPrice !== product.regularPrice) {
      updates.regularPrice = regularPrice;
    }
    if (salePrice !== product.salePrice) {
      updates.salePrice = salePrice.trim() === "" ? null : salePrice;
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No Changes",
        description: "No changes detected to update",
      });
      return;
    }

    updateMutation.mutate(updates);
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (stock < 10) return { label: "Low Stock", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  const handleVariantUpdate = (variant: ProductVariant, updates: { regularPrice?: string; salePrice?: string }) => {
    const filteredUpdates: { regularPrice?: string; salePrice?: string } = {};
    
    if (updates.regularPrice !== undefined && updates.regularPrice !== variant.regularPrice?.toString()) {
      filteredUpdates.regularPrice = updates.regularPrice;
    }
    
    if (updates.salePrice !== undefined && updates.salePrice !== (variant.salePrice?.toString() || "")) {
      filteredUpdates.salePrice = updates.salePrice.trim() === "" ? undefined : updates.salePrice;
    }

    if (Object.keys(filteredUpdates).length === 0) {
      toast({
        title: "No Changes",
        description: "No changes detected to update",
      });
      return;
    }

    updateVariantMutation.mutate({ variantId: variant.id, data: filteredUpdates });
  };

  if (!product) return null;

  const stockStatus = getStockStatus(product.stock || 0);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-96 flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle>Product Details</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-6 pr-2">
          <div className="space-y-6">
          {/* Product Info */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">{product.name}</h4>
            <p className="text-sm text-gray-500 mb-4">{product.category || 'Uncategorized'}</p>
          </div>
          
          {/* Pricing Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-gray-900">Pricing</h5>
              {hasMultipleVariants && (
                <Badge variant="outline" className="text-xs">
                  Lowest variant prices
                </Badge>
              )}
            </div>
            
            {hasMultipleVariants && (
              <p className="text-xs text-gray-600 mb-3">
                This product has variants. Edit individual variant prices below.
              </p>
            )}
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="regularPrice" className="text-sm text-gray-600">
                  Regular Price {hasMultipleVariants && "(Lowest)"}
                </Label>
                <div className="flex items-center mt-1">
                  <span className="text-sm text-gray-500 mr-1">$</span>
                  <Input
                    id="regularPrice"
                    type="number"
                    step="0.01"
                    value={regularPrice}
                    onChange={(e) => setRegularPrice(e.target.value)}
                    className="flex-1"
                    disabled={hasMultipleVariants}
                    title={hasMultipleVariants ? "Price is managed through variants" : undefined}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="salePrice" className="text-sm text-gray-600">
                  Sale Price {hasMultipleVariants && "(Lowest)"}
                </Label>
                <div className="flex items-center mt-1">
                  <span className="text-sm text-gray-500 mr-1">$</span>
                  <Input
                    id="salePrice"
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="flex-1"
                    placeholder="Optional"
                    disabled={hasMultipleVariants}
                    title={hasMultipleVariants ? "Price is managed through variants" : undefined}
                  />
                </div>
              </div>
            </div>
            
            {!hasMultipleVariants && (
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
                className="w-full mt-4"
              >
                {updateMutation.isPending ? "Updating..." : "Update Product"}
              </Button>
            )}
          </div>

          {/* Product Variants Section */}
          {variants && variants.length > 0 && (
            <div className="border-t pt-6 mt-6">
              <Collapsible open={showVariants} onOpenChange={setShowVariants}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="font-medium">Product Variants ({variants.length})</span>
                    {showVariants ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4">
                  {variantsLoading ? (
                    <div className="text-center text-sm text-muted-foreground">Loading variants...</div>
                  ) : (
                    variants.map((variant) => (
                      <VariantPriceEditor
                        key={variant.id}
                        variant={variant}
                        onUpdate={handleVariantUpdate}
                        isUpdating={updateVariantMutation.isPending}
                      />
                    ))
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
          
          {/* Product Metadata */}
          <div>
            <h5 className="font-medium text-gray-900 mb-3">Product Information</h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">SKU:</span>
                <span className="font-medium">{product.sku || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Stock:</span>
                <span className="font-medium">{product.stock || 0} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Weight:</span>
                <span className="font-medium">{product.weight || '0'} lbs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <Badge variant={stockStatus.variant} className="text-xs">
                  {stockStatus.label}
                </Badge>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Price History */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-gray-600" />
              <h5 className="font-medium text-gray-900">Price History</h5>
            </div>
            
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : !priceHistory || priceHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No price changes recorded yet</p>
                <p className="text-xs text-gray-400 mt-1">Price changes will appear here when you update pricing</p>
              </div>
            ) : (
              <div className="space-y-3">
                {priceHistory.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <Badge 
                        variant={entry.changeType === 'manual' ? 'default' : entry.changeType === 'work_order' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {entry.changeType === 'manual' ? 'Manual Update' : 
                         entry.changeType === 'work_order' ? 'Work Order' : 
                         'System Sync'}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {format(new Date(entry.createdAt!), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {/* Regular Price Changes */}
                      {(entry.oldRegularPrice !== null || entry.newRegularPrice !== null) && (
                        <div>
                          <span className="text-gray-600 block mb-1">Regular Price:</span>
                          <div className="flex items-center gap-2">
                            {entry.oldRegularPrice && (
                              <span className="text-gray-500 line-through">${entry.oldRegularPrice}</span>
                            )}
                            {entry.newRegularPrice && (
                              <span className="font-medium text-green-600">${entry.newRegularPrice}</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Sale Price Changes */}
                      {(entry.oldSalePrice !== null || entry.newSalePrice !== null) && (
                        <div>
                          <span className="text-gray-600 block mb-1">Sale Price:</span>
                          <div className="flex items-center gap-2">
                            {entry.oldSalePrice && (
                              <span className="text-gray-500 line-through">${entry.oldSalePrice}</span>
                            )}
                            {entry.newSalePrice ? (
                              <span className="font-medium text-blue-600">${entry.newSalePrice}</span>
                            ) : entry.oldSalePrice && entry.newSalePrice === null && (
                              <span className="font-medium text-gray-600">Removed</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
