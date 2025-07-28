import { Edit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  showStock?: boolean;
}

export default function ProductCard({ product, onClick, showStock = true }: ProductCardProps) {
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (stock < 10) return { label: "Low Stock", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  const stockStatus = getStockStatus(product.stock || 0);

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" onClick={onClick}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-sm sm:text-base truncate">{product.name}</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{product.category || 'Uncategorized'}</p>
          </div>
          <div className="flex items-center space-x-2 ml-2">
            <Button size="sm" variant="ghost" className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
              <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Regular Price:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
              ${product.regularPrice || '0.00'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Sale Price:</span>
            <span className={cn(
              "font-semibold text-sm sm:text-base",
              product.salePrice ? "text-accent" : "text-gray-400 dark:text-gray-500"
            )}>
              {product.salePrice ? `$${product.salePrice}` : '—'}
            </span>
          </div>
          
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 truncate mr-2">
                SKU: <span className="font-medium">{product.sku || 'N/A'}</span>
              </span>
              {showStock && (
                <Badge variant={stockStatus.variant} className="text-xs shrink-0">
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
