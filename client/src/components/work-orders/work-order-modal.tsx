import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Product } from "@shared/schema";

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
}

export default function WorkOrderModal({ isOpen, onClose, products }: WorkOrderModalProps) {
  const [title, setTitle] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productUpdates, setProductUpdates] = useState<ProductPriceUpdate[]>([]);
  const [scheduleType, setScheduleType] = useState("immediate");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
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

  const handleClose = () => {
    setTitle("");
    setSelectedProducts([]);
    setProductUpdates([]);
    setScheduleType("immediate");
    setScheduleDate("");
    setScheduleTime("");
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
            <ScrollArea className="border border-gray-300 rounded-lg p-4 max-h-40 mt-1">
              <div className="space-y-2">
                {products.length === 0 ? (
                  <p className="text-sm text-gray-500">No products available</p>
                ) : (
                  products.map((product) => (
                    <div key={product.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={product.id}
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => 
                          handleProductToggle(product.id, checked as boolean)
                        }
                      />
                      <Label htmlFor={product.id} className="text-sm">
                        {product.name} (Regular: ${product.regularPrice || "N/A"}, Sale: ${product.salePrice || "N/A"})
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <p className="text-xs text-gray-500 mt-1">
              Select products to include in this work order
            </p>
          </div>
          
          {/* Per-Product Price Updates */}
          {selectedProducts.length > 0 && (
            <div>
              <Label>Set New Prices for Each Product</Label>
              <div className="border rounded-lg overflow-hidden mt-2">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-700">
                    <div>Product</div>
                    <div>New Regular Price</div>
                    <div>New Sale Price</div>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {productUpdates.map((update) => (
                    <div key={update.productId} className="grid grid-cols-3 gap-4 p-4 border-b last:border-b-0">
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
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter new prices for each product. Leave blank to keep current price.
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