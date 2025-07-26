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

export default function WorkOrderModal({ isOpen, onClose, products }: WorkOrderModalProps) {
  const [title, setTitle] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [regularPrice, setRegularPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
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
    setRegularPrice("");
    setSalePrice("");
    setScheduleType("immediate");
    setScheduleDate("");
    setScheduleTime("");
    onClose();
  };

  const handleProductToggle = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, productId]);
    } else {
      setSelectedProducts(prev => prev.filter(id => id !== productId));
    }
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

    if (!regularPrice && !salePrice) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one price change",
        variant: "destructive",
      });
      return;
    }

    const workOrderData: any = {
      title: title.trim(),
      productIds: selectedProducts,
      executeImmediately: scheduleType === "immediate",
    };

    if (regularPrice) {
      workOrderData.newRegularPrice = regularPrice;
    }

    if (salePrice) {
      workOrderData.newSalePrice = salePrice;
    }

    if (scheduleType === "scheduled" && scheduleDate && scheduleTime) {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      workOrderData.scheduledAt = scheduledAt.toISOString();
    }

    createMutation.mutate(workOrderData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
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
                        {product.name}
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
          
          {/* Price Changes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="regularPrice">New Regular Price</Label>
              <div className="flex items-center mt-1">
                <span className="text-sm text-gray-500 mr-2">$</span>
                <Input
                  id="regularPrice"
                  type="number"
                  step="0.01"
                  value={regularPrice}
                  onChange={(e) => setRegularPrice(e.target.value)}
                  placeholder="0.00"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="salePrice">New Sale Price</Label>
              <div className="flex items-center mt-1">
                <span className="text-sm text-gray-500 mr-2">$</span>
                <Input
                  id="salePrice"
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0.00"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          
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
