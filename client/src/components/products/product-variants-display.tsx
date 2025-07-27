import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ProductVariant } from "@shared/schema";

interface ProductVariantsDisplayProps {
  productId: string;
  productName: string;
  onVariantUpdate?: (productId: string, variantUpdates: Array<{
    variantId: string;
    variantSku: string;
    optionValues: Array<{
      option_display_name: string;
      label: string;
    }>;
    newRegularPrice?: string;
    newSalePrice?: string;
  }>) => void;
  isEditing?: boolean;
}

export default function ProductVariantsDisplay({ 
  productId, 
  productName, 
  onVariantUpdate, 
  isEditing = false 
}: ProductVariantsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [variantPrices, setVariantPrices] = useState<Record<string, { regular?: string; sale?: string }>>({});

  const { data: variants, isLoading } = useQuery<ProductVariant[]>({
    queryKey: [`/api/products/${productId}/variants`],
    enabled: isExpanded, // Only load when expanded
  });

  const handleVariantPriceChange = (variantId: string, field: 'regular' | 'sale', value: string) => {
    const newPrices = {
      ...variantPrices,
      [variantId]: {
        ...variantPrices[variantId],
        [field]: value
      }
    };
    setVariantPrices(newPrices);

    // Build variant updates array
    const variantUpdates = variants
      ?.filter(variant => newPrices[variant.id])
      ?.map(variant => ({
        variantId: variant.id,
        variantSku: variant.variantSku || '',
        optionValues: (variant.optionValues || []).map(opt => ({
          option_display_name: opt.option_display_name,
          label: opt.label
        })),
        newRegularPrice: newPrices[variant.id]?.regular,
        newSalePrice: newPrices[variant.id]?.sale,
      }))
      ?.filter(update => update.newRegularPrice || update.newSalePrice) || [];

    onVariantUpdate?.(productId, variantUpdates);
  };

  const formatOptionValues = (optionValues: Array<{ option_display_name: string; label: string }>) => {
    return optionValues?.map(opt => `${opt.option_display_name}: ${opt.label}`).join(', ') || 'No options';
  };

  if (!variants || variants.length === 0) {
    return null; // Don't show anything if no variants
  }

  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center space-x-2 text-sm font-medium mb-2"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Package className="w-4 h-4" />
        <span>{variants.length} Variant{variants.length !== 1 ? 's' : ''}</span>
      </Button>

      {isExpanded && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-gray-500">Loading variants...</div>
          ) : (
            variants.map((variant) => (
              <div key={variant.id} className="border rounded p-3 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {variant.variantSku || `Variant ${variant.id}`}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {formatOptionValues(variant.optionValues || [])}
                    </div>
                    <div className="flex space-x-2">
                      <Badge variant="outline" className="text-xs">
                        Regular: ${variant.regularPrice || '0'}
                      </Badge>
                      {variant.salePrice && (
                        <Badge variant="secondary" className="text-xs">
                          Sale: ${variant.salePrice}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor={`regular-${variant.id}`} className="text-xs">
                          New Regular Price
                        </Label>
                        <Input
                          id={`regular-${variant.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={variant.regularPrice || '0'}
                          value={variantPrices[variant.id]?.regular || ''}
                          onChange={(e) => handleVariantPriceChange(variant.id, 'regular', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`sale-${variant.id}`} className="text-xs">
                          New Sale Price
                        </Label>
                        <Input
                          id={`sale-${variant.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={variant.salePrice || '0'}
                          value={variantPrices[variant.id]?.sale || ''}
                          onChange={(e) => handleVariantPriceChange(variant.id, 'sale', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}