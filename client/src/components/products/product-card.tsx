import { Edit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  showStockStatus?: boolean;
}

export default function ProductCard({ product, onClick, showStockStatus = false }: ProductCardProps) {
  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (stock < 10) return { label: "Low Stock", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

  const stockStatus = getStockStatus(product.stock || 0);

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
            <p className="text-sm text-gray-500">{product.category || 'Uncategorized'}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="ghost" className="p-1 text-gray-400 hover:text-gray-600">
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Regular Price:</span>
            <span className="font-semibold text-gray-900">
              ${product.regularPrice || '0.00'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Sale Price:</span>
            <span className={cn(
              "font-semibold",
              product.salePrice ? "text-accent" : "text-gray-400"
            )}>
              {product.salePrice ? `$${product.salePrice}` : '—'}
            </span>
          </div>
          
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                SKU: <span className="font-medium">{product.sku || 'N/A'}</span>
              </span>
              {showStockStatus && (
                <Badge variant={stockStatus.variant} className="text-xs">
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
