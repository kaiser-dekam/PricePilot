import { useState, useMemo } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SimpleCategorySelectorProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SimpleCategorySelector: React.FC<SimpleCategorySelectorProps> = ({
  categories,
  value,
  onChange,
  placeholder = "Select category"
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Process categories to create a simple hierarchical structure
  const processedCategories = useMemo(() => {
    if (!categories || categories.length === 0) {
      return { grouped: {}, standalone: [] };
    }
    
    // Remove duplicates and sort
    const uniqueCategories = Array.from(new Set(categories))
      .filter((cat): cat is string => Boolean(cat && cat.trim()))
      .sort();
    
    // Group by top-level category for better organization
    const grouped: { [key: string]: string[] } = {};
    const standalone: string[] = [];
    
    uniqueCategories.forEach((category: string) => {
      if (category.includes(' > ')) {
        const topLevel = category.split(' > ')[0].trim();
        if (!grouped[topLevel]) {
          grouped[topLevel] = [];
        }
        grouped[topLevel].push(category);
      } else {
        standalone.push(category);
      }
    });
    
    // Sort subcategories within each group
    Object.keys(grouped).forEach(key => {
      grouped[key].sort();
    });
    
    return { grouped, standalone };
  }, [categories]);

  // Filter categories based on search term
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return processedCategories;
    
    const searchLower = searchTerm.toLowerCase();
    const filteredGrouped: { [key: string]: string[] } = {};
    const filteredStandalone = processedCategories.standalone.filter((cat: string) =>
      cat.toLowerCase().includes(searchLower)
    );
    
    Object.entries(processedCategories.grouped).forEach(([topLevel, subcats]: [string, string[]]) => {
      const filteredSubs = subcats.filter((cat: string) =>
        cat.toLowerCase().includes(searchLower)
      );
      if (filteredSubs.length > 0) {
        filteredGrouped[topLevel] = filteredSubs;
      }
    });
    
    return { grouped: filteredGrouped, standalone: filteredStandalone };
  }, [processedCategories, searchTerm]);

  const handleSelect = (category: string) => {
    onChange(category);
    setOpen(false);
    setSearchTerm("");
  };

  const getDisplayValue = () => {
    if (value === "all") return "All Categories";
    if (!value) return placeholder;
    
    // Truncate long category paths for display
    if (value.length > 40) {
      return value.substring(0, 37) + "...";
    }
    return value;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid="category-selector-trigger"
        >
          {getDisplayValue()}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              data-testid="category-search-input"
            />
          </div>

          {/* All Categories Option */}
          <div className="mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSelect("all")}
              className={`w-full justify-start text-sm ${
                value === "all" ? "bg-blue-50 text-blue-700" : ""
              }`}
              data-testid="all-categories-option"
            >
              {value === "all" && <Check className="mr-2 h-4 w-4" />}
              All Categories
            </Button>
          </div>

          <Separator className="mb-2" />

          {/* Categories List */}
          <ScrollArea className="h-64">
            <div className="space-y-1">
              {/* Standalone categories */}
              {filteredCategories.standalone.map((category: string) => (
                <Button
                  key={category}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelect(category)}
                  className={`w-full justify-start text-sm ${
                    value === category ? "bg-blue-50 text-blue-700" : ""
                  }`}
                  data-testid={`category-option-${category}`}
                >
                  {value === category && <Check className="mr-2 h-4 w-4" />}
                  <span className="truncate">{category}</span>
                </Button>
              ))}

              {/* Grouped categories */}
              {Object.entries(filteredCategories.grouped).map(([topLevel, subcats]: [string, string[]]) => (
                <div key={topLevel} className="space-y-1">
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {topLevel}
                  </div>
                  {subcats.map((category: string) => (
                    <Button
                      key={category}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelect(category)}
                      className={`w-full justify-start text-sm pl-4 ${
                        value === category ? "bg-blue-50 text-blue-700" : ""
                      }`}
                      data-testid={`category-option-${category}`}
                    >
                      {value === category && <Check className="mr-2 h-4 w-4" />}
                      <span className="truncate">{category}</span>
                    </Button>
                  ))}
                </div>
              ))}

              {/* No results */}
              {filteredCategories.standalone.length === 0 && 
               Object.keys(filteredCategories.grouped).length === 0 && (
                <div className="py-4 text-center text-sm text-gray-500">
                  No categories found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};