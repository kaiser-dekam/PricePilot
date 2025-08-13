import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import {
  BreadcrumbCategorySelector,
  SearchableFlatCategorySelector,
  CascadingCategorySelector,
  TreeViewCategorySelector
} from "@/components/ui/category-selectors";

export default function CategoryDemo() {
  const [, setLocation] = useLocation();
  const [selectedValues, setSelectedValues] = useState({
    breadcrumb: "all",
    searchable: "all", 
    cascading: "all",
    treeview: "all"
  });

  // Fetch categories from API
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
    staleTime: 60000,
  });

  const categories = (categoriesData as string[]) || [
    // Sample data for demo if API not available
    "Electronics",
    "Electronics > Computers", 
    "Electronics > Computers > Laptops",
    "Electronics > Computers > Laptops > Gaming Laptops",
    "Electronics > Computers > Laptops > Business Laptops",
    "Electronics > Computers > Desktop PCs",
    "Electronics > Computers > Desktop PCs > Gaming PCs",
    "Electronics > Mobile Devices",
    "Electronics > Mobile Devices > Smartphones",
    "Electronics > Mobile Devices > Tablets",
    "Clothing",
    "Clothing > Men's Clothing",
    "Clothing > Men's Clothing > Shirts",
    "Clothing > Men's Clothing > Pants",
    "Clothing > Women's Clothing",
    "Clothing > Women's Clothing > Dresses",
    "Clothing > Women's Clothing > Tops",
    "Home & Garden",
    "Home & Garden > Furniture",
    "Home & Garden > Furniture > Living Room",
    "Home & Garden > Furniture > Bedroom",
    "Home & Garden > Tools",
    "Home & Garden > Tools > Hand Tools",
    "Home & Garden > Tools > Power Tools"
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/products")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Category Selector Comparison</h1>
            <p className="text-sm text-gray-600">Compare 4 different approaches for handling complex nested categories</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Option 1: Breadcrumb Navigation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Option 1: Breadcrumb Navigation
                <Badge variant="outline" className="bg-green-50 text-green-600">
                  ⭐ Recommended
                </Badge>
              </CardTitle>
              <CardDescription>
                Navigate through categories like folders. Best for deep hierarchies.
                <br />
                <strong>Pros:</strong> Intuitive, shows current path, searchable
                <br />
                <strong>Cons:</strong> Requires multiple clicks for deep categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BreadcrumbCategorySelector
                categories={categories}
                value={selectedValues.breadcrumb}
                onChange={(value) => setSelectedValues(prev => ({ ...prev, breadcrumb: value }))}
                placeholder="Select category..."
              />
              <div className="text-sm text-gray-600">
                Selected: <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {selectedValues.breadcrumb}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Option 2: Searchable Flat List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Option 2: Searchable Flat List
                <Badge variant="outline" className="bg-blue-50 text-blue-600">
                  Fast Selection
                </Badge>
              </CardTitle>
              <CardDescription>
                All categories in one searchable list with path context.
                <br />
                <strong>Pros:</strong> Fast search, one-click selection, shows full path
                <br />
                <strong>Cons:</strong> Long list, hard to browse without search
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SearchableFlatCategorySelector
                categories={categories}
                value={selectedValues.searchable}
                onChange={(value) => setSelectedValues(prev => ({ ...prev, searchable: value }))}
                placeholder="Select category..."
              />
              <div className="text-sm text-gray-600">
                Selected: <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {selectedValues.searchable}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Option 3: Cascading Dropdowns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Option 3: Multi-Level Dropdowns
                <Badge variant="outline" className="bg-orange-50 text-orange-600">
                  Clear Structure
                </Badge>
              </CardTitle>
              <CardDescription>
                Separate dropdown for each level of the hierarchy.
                <br />
                <strong>Pros:</strong> Clear hierarchy, shows structure well
                <br />
                <strong>Cons:</strong> Takes up more vertical space, many dropdowns for deep categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CascadingCategorySelector
                categories={categories}
                value={selectedValues.cascading}
                onChange={(value) => setSelectedValues(prev => ({ ...prev, cascading: value }))}
                placeholder="Select category..."
              />
              <div className="text-sm text-gray-600">
                Selected: <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {selectedValues.cascading}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Option 4: Tree View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Option 4: Expandable Tree View
                <Badge variant="outline" className="bg-purple-50 text-purple-600">
                  Traditional
                </Badge>
              </CardTitle>
              <CardDescription>
                Classic tree view with expand/collapse functionality.
                <br />
                <strong>Pros:</strong> Familiar interface, shows relationships clearly
                <br />
                <strong>Cons:</strong> Can become overwhelming with many categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TreeViewCategorySelector
                categories={categories}
                value={selectedValues.treeview}
                onChange={(value) => setSelectedValues(prev => ({ ...prev, treeview: value }))}
                placeholder="Select category..."
              />
              <div className="text-sm text-gray-600">
                Selected: <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {selectedValues.treeview}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recommendation Analysis</CardTitle>
            <CardDescription>
              Based on usability for complex nested categories with potentially hundreds of options
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-2">🏆 Winner: Breadcrumb Navigation (Option 1)</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• <strong>Scalable:</strong> Works well with any depth of categories</li>
                  <li>• <strong>Searchable:</strong> Users can quickly find categories without browsing</li>
                  <li>• <strong>Intuitive:</strong> File explorer-like navigation is familiar to users</li>
                  <li>• <strong>Space efficient:</strong> Compact footprint regardless of category complexity</li>
                  <li>• <strong>Context aware:</strong> Shows current path and easy navigation back</li>
                </ul>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">🥈 Runner-up: Searchable Flat List (Option 2)</h3>
                <p className="text-sm text-blue-700">
                  Great for power users who know what they're looking for. The search functionality makes it very fast to find specific categories.
                </p>
              </div>

              <div className="text-sm text-gray-600">
                <strong>Use Case Scenarios:</strong>
                <br />
                • <strong>Large e-commerce sites:</strong> Option 1 (Breadcrumb) - handles deep hierarchies gracefully
                <br />
                • <strong>Power users/Admin interfaces:</strong> Option 2 (Searchable) - fastest for experienced users
                <br />
                • <strong>Simple category structures:</strong> Option 3 (Cascading) - clear for 2-3 levels max
                <br />
                • <strong>Traditional desktop apps:</strong> Option 4 (Tree view) - familiar but overwhelming for web
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Implementation Button */}
        <div className="mt-6 text-center">
          <Button
            onClick={() => {
              // This would trigger implementation of the winning option
              alert("The Breadcrumb Navigation option will be implemented in your application!");
              setLocation("/products");
            }}
            className="bg-green-600 hover:bg-green-700"
          >
            Implement Breadcrumb Navigation (Recommended)
          </Button>
        </div>
      </div>
    </div>
  );
}