import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, History, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Product, PriceHistory } from "@shared/schema";
import { format } from "date-fns";

interface ProductDetailPanelProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductDetailPanel({ product, isOpen, onClose }: ProductDetailPanelProps) {
  const [regularPrice, setRegularPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
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

  // Update form when product changes
  React.useEffect(() => {
    if (product) {
      setRegularPrice(product.regularPrice || "");
      setSalePrice(product.salePrice || "");
    }
  }, [product]);

  const handleUpdate = () => {
    if (!product) return;

    const updates: any = {};
    if (regularPrice !== product.regularPrice) {
      updates.regularPrice = regularPrice;
    }
    if (salePrice !== product.salePrice) {
      updates.salePrice = salePrice || null;
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

  if (!product) return null;

  const stockStatus = getStockStatus(product.stock || 0);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-96">
        <SheetHeader>
          <SheetTitle>Product Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Product Info */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">{product.name}</h4>
            <p className="text-sm text-gray-500 mb-4">{product.category || 'Uncategorized'}</p>
            
            <div className="prose prose-sm text-gray-600">
              <p>{product.description || 'No description available'}</p>
            </div>
          </div>
          
          {/* Pricing Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h5 className="font-medium text-gray-900 mb-3">Pricing</h5>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="regularPrice" className="text-sm text-gray-600">
                  Regular Price
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
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="salePrice" className="text-sm text-gray-600">
                  Sale Price
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
                  />
                </div>
              </div>
            </div>
            
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="w-full mt-4"
            >
              {updateMutation.isPending ? "Updating..." : "Update Product"}
            </Button>
          </div>
          
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
              <div className="space-y-3 max-h-64 overflow-y-auto">
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
      </SheetContent>
    </Sheet>
  );
}
