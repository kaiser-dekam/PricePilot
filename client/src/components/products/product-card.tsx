import React from "react";
import { Edit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product, ProductVariant } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product & { variants?: ProductVariant[] };
  onClick: () => void;
  showStockStatus?: boolean;
}

export default function ProductCard({ product, onClick, showStockStatus = false }: ProductCardProps) {
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (stock < 10) return { label: "Low Stock", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  // Calculate display prices and stock based on variants
  const hasMultipleVariants = product.variants && product.variants.length > 1;
  
  const displayData = React.useMemo(() => {
    if (!hasMultipleVariants) {
      return {
        regularPrice: product.regularPrice || "0.00",
        salePrice: product.salePrice,
        stock: product.stock || 0,
        isVariantPricing: false
      };
    }
    
    const variants = product.variants!;
    const regularPrices = variants
      .map(v => parseFloat(v.regularPrice?.toString() || '0'))
      .filter(p => p > 0);
    
    const salePrices = variants
      .map(v => parseFloat(v.salePrice?.toString() || '0'))
      .filter(p => p > 0);
      
    const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    
    return {
      regularPrice: regularPrices.length > 0 ? Math.min(...regularPrices).toFixed(2) : "0.00",
      salePrice: salePrices.length > 0 ? Math.min(...salePrices).toFixed(2) : null,
      stock: totalStock,
      isVariantPricing: true
    };
  }, [product, hasMultipleVariants]);

  const stockStatus = getStockStatus(displayData.stock);

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base truncate">{product.name}</h3>
            <p className="text-xs sm:text-sm text-gray-500">{product.category || 'Uncategorized'}</p>
          </div>
          <div className="flex items-center space-x-2 ml-2">
            <Button size="sm" variant="ghost" className="p-1 text-gray-400 hover:text-gray-600">
              <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-600">
              Regular Price{displayData.isVariantPricing ? " (from)" : ":"}
            </span>
            <span className="font-semibold text-gray-900 text-sm sm:text-base">
              ${displayData.regularPrice}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-600">
              Sale Price{displayData.isVariantPricing ? " (from)" : ":"}
            </span>
            <span className={cn(
              "font-semibold text-sm sm:text-base",
              displayData.salePrice ? "text-accent" : "text-gray-400"
            )}>
              {displayData.salePrice ? `$${displayData.salePrice}` : '—'}
            </span>
          </div>
          
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 truncate">
                SKU: <span className="font-medium">{product.sku || 'N/A'}</span>
              </span>
              {showStockStatus && (
                <Badge variant={stockStatus.variant} className="text-xs ml-2 shrink-0">
                  {stockStatus.label}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
