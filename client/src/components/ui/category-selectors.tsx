import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Search, X, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CategoryNode {
  name: string;
  fullPath: string;
  children: CategoryNode[];
  level: number;
}

interface CategorySelectorProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Helper function to build category tree
const buildCategoryTree = (categoryPaths: string[]): CategoryNode[] => {
  const root: CategoryNode[] = [];
  const nodeMap = new Map<string, CategoryNode>();

  // Create all nodes
  categoryPaths.forEach(fullPath => {
    if (!fullPath || !fullPath.trim()) return;
    
    const parts = fullPath.split(' > ').map(p => p.trim());
    let currentPath = '';
    
    parts.forEach((name, index) => {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath} > ${name}` : name;
      
      if (!nodeMap.has(currentPath)) {
        const node: CategoryNode = {
          name,
          fullPath: currentPath,
          children: [],
          level: index
        };
        nodeMap.set(currentPath, node);
        
        if (parentPath) {
          const parent = nodeMap.get(parentPath);
          if (parent) {
            parent.children.push(node);
          }
        } else {
          root.push(node);
        }
      }
    });
  });

  // Sort all levels
  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach(node => sortNodes(node.children));
  };
  
  sortNodes(root);
  return root;
};

// Option 1: Breadcrumb Navigation
export const BreadcrumbCategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  value,
  onChange,
  placeholder = "Select category"
}) => {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  
  const getCurrentNodes = () => {
    let nodes = categoryTree;
    for (const pathPart of currentPath) {
      const node = nodes.find(n => n.name === pathPart);
      if (node) {
        nodes = node.children;
      } else {
        break;
      }
    }
    return nodes;
  };

  const filteredNodes = useMemo(() => {
    const nodes = getCurrentNodes();
    if (!searchTerm) return nodes;
    return nodes.filter(node => 
      node.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [currentPath, searchTerm, categoryTree]);

  const navigateToPath = (pathParts: string[]) => {
    setCurrentPath(pathParts);
  };

  const selectCategory = (node: CategoryNode) => {
    onChange(node.fullPath);
  };

  const goUp = () => {
    setCurrentPath(prev => prev.slice(0, -1));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {value === "all" ? "All Categories" : value || placeholder}
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
            />
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center space-x-1 mb-3 pb-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange("all")}
              className="text-xs px-2"
            >
              All Categories
            </Button>
            {currentPath.map((part, index) => (
              <div key={index} className="flex items-center space-x-1">
                <ChevronRight className="h-3 w-3 text-gray-400" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateToPath(currentPath.slice(0, index + 1))}
                  className="text-xs px-2"
                >
                  {part}
                </Button>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="max-h-64 overflow-y-auto">
            {currentPath.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={goUp}
                className="w-full justify-start mb-1 text-xs"
              >
                ← Back
              </Button>
            )}
            
            {filteredNodes.map((node) => (
              <div key={node.fullPath} className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (node.children.length > 0) {
                      setCurrentPath([...currentPath, node.name]);
                    } else {
                      selectCategory(node);
                    }
                  }}
                  className="flex-1 justify-start text-xs px-2"
                >
                  {node.children.length > 0 ? (
                    <Folder className="h-3 w-3 mr-2" />
                  ) : (
                    <div className="w-3 mr-2" />
                  )}
                  {node.name}
                </Button>
                {node.children.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectCategory(node)}
                    className="text-xs px-2 ml-1"
                  >
                    Select
                  </Button>
                )}
                {node.children.length > 0 && (
                  <ChevronRight className="h-3 w-3 text-gray-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Option 2: Searchable Flat List with Path Display
export const SearchableFlatCategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  value,
  onChange,
  placeholder = "Select category"
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    return categories.filter(category =>
      category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const formatCategoryDisplay = (category: string) => {
    const parts = category.split(' > ');
    if (parts.length <= 2) return category;
    
    return (
      <div className="flex flex-col">
        <div className="font-medium">{parts[parts.length - 1]}</div>
        <div className="text-xs text-gray-500 truncate">
          {parts.slice(0, -1).join(' > ')}
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">
            {value === "all" ? "All Categories" : (
              value ? value.split(' > ').pop() : placeholder
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3">
          <div className="relative mb-3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("all");
                setIsOpen(false);
              }}
              className="w-full justify-start mb-1 text-xs"
            >
              All Categories
            </Button>
            
            {filteredCategories.map((category) => (
              <Button
                key={category}
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(category);
                  setIsOpen(false);
                }}
                className="w-full justify-start mb-1 text-xs h-auto py-2"
              >
                {formatCategoryDisplay(category)}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Option 3: Multi-Level Dropdowns (Cascading)
export const CascadingCategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  value,
  onChange,
  placeholder = "Select category"
}) => {
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Get all unique levels
  const maxLevels = useMemo(() => {
    let max = 0;
    categories.forEach(cat => {
      const parts = cat.split(' > ');
      max = Math.max(max, parts.length);
    });
    return max;
  }, [categories]);

  const getOptionsForLevel = (level: number): CategoryNode[] => {
    if (level === 0) return categoryTree;
    
    let currentNodes = categoryTree;
    for (let i = 0; i < level && i < selectedLevels.length; i++) {
      const selectedName = selectedLevels[i];
      const node = currentNodes.find(n => n.name === selectedName);
      if (node) {
        currentNodes = node.children;
      } else {
        return [];
      }
    }
    return currentNodes;
  };

  const handleLevelChange = (level: number, selectedName: string) => {
    const newLevels = selectedLevels.slice(0, level);
    newLevels[level] = selectedName;
    setSelectedLevels(newLevels);

    // Find the full path
    let currentNodes = categoryTree;
    let fullPath = "";
    
    for (let i = 0; i <= level; i++) {
      const name = newLevels[i];
      if (!name) break;
      
      const node = currentNodes.find(n => n.name === name);
      if (node) {
        fullPath = node.fullPath;
        currentNodes = node.children;
      }
    }
    
    if (fullPath) {
      onChange(fullPath);
    }
  };

  return (
    <div className="space-y-2">
      {Array.from({ length: maxLevels }, (_, level) => {
        const options = getOptionsForLevel(level);
        const hasSelection = level < selectedLevels.length;
        const isDisabled = level > 0 && (level > selectedLevels.length);

        return (
          <Select
            key={level}
            value={hasSelection ? selectedLevels[level] : ""}
            onValueChange={(value) => handleLevelChange(level, value)}
            disabled={isDisabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={
                level === 0 ? "Choose main category" : `Choose subcategory ${level + 1}`
              } />
            </SelectTrigger>
            <SelectContent>
              {level === 0 && (
                <SelectItem value="all">All Categories</SelectItem>
              )}
              {options.map((node) => (
                <SelectItem key={node.name} value={node.name}>
                  {node.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </div>
  );
};

// Option 4: Tree View with Expand/Collapse
export const TreeViewCategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  value,
  onChange,
  placeholder = "Select category"
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const toggleExpanded = (fullPath: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(fullPath)) {
      newExpanded.delete(fullPath);
    } else {
      newExpanded.add(fullPath);
    }
    setExpandedNodes(newExpanded);
  };

  const renderNode = (node: CategoryNode, level: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.fullPath);
    const isSelected = value === node.fullPath;
    const matchesSearch = searchTerm === "" || 
      node.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch && searchTerm) {
      // Check if any children match
      const hasMatchingChildren = node.children.some(child => 
        child.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!hasMatchingChildren) return null;
    }

    return (
      <div key={node.fullPath}>
        <div className={`flex items-center py-1 px-2 hover:bg-gray-50 rounded ${
          isSelected ? "bg-blue-50 text-blue-600" : ""
        }`}>
          <div style={{ paddingLeft: `${level * 16}px` }} className="flex items-center flex-1">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpanded(node.fullPath)}
                className="p-0 w-4 h-4 mr-1"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            ) : (
              <div className="w-4 mr-1" />
            )}
            
            {hasChildren ? (
              <FolderOpen className="h-3 w-3 mr-2 text-blue-500" />
            ) : (
              <div className="w-3 h-3 mr-2 rounded-full bg-gray-300" />
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(node.fullPath);
                setIsOpen(false);
              }}
              className="flex-1 justify-start p-0 h-auto text-xs"
            >
              {node.name}
            </Button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">
            {value === "all" ? "All Categories" : (
              value ? value.split(' > ').pop() : placeholder
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3">
          <div className="relative mb-3">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("all");
                setIsOpen(false);
              }}
              className="w-full justify-start mb-2 text-xs"
            >
              All Categories
            </Button>
            
            {categoryTree.map(node => renderNode(node))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};