import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CategoryNode {
  name: string;
  fullPath: string;
  children: CategoryNode[];
  level: number;
  isExpanded?: boolean;
}

interface NestedCategorySelectorProps {
  categories: string[];
  selectedCategories: string[];
  onChange: (selectedCategories: string[]) => void;
  title?: string;
  maxHeight?: string;
}

// Helper function to build category tree from flat paths
const buildCategoryTree = (categoryPaths: string[]): CategoryNode[] => {
  const nodeMap = new Map<string, CategoryNode>();
  const root: CategoryNode[] = [];

  // Create all nodes first
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
          level: index,
          isExpanded: false
        };
        nodeMap.set(currentPath, node);
        
        if (parentPath && nodeMap.has(parentPath)) {
          const parent = nodeMap.get(parentPath)!;
          parent.children.push(node);
        } else if (index === 0) {
          root.push(node);
        }
      }
    });
  });

  // Sort all levels alphabetically
  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach(node => sortNodes(node.children));
  };
  
  sortNodes(root);
  return root;
};

export const NestedCategorySelector: React.FC<NestedCategorySelectorProps> = ({
  categories,
  selectedCategories,
  onChange,
  title = "Categories",
  maxHeight = "400px"
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories);
  }, [categories]);

  const toggleExpanded = (fullPath: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(fullPath)) {
      newExpanded.delete(fullPath);
    } else {
      newExpanded.add(fullPath);
    }
    setExpandedNodes(newExpanded);
  };

  const handleCategorySelect = (fullPath: string, isSelected: boolean) => {
    let newSelected = [...selectedCategories];
    
    if (isSelected) {
      if (!newSelected.includes(fullPath)) {
        newSelected.push(fullPath);
      }
    } else {
      newSelected = newSelected.filter(path => path !== fullPath);
    }
    
    onChange(newSelected);
  };

  const getAllDescendantPaths = (node: CategoryNode): string[] => {
    const paths = [node.fullPath];
    node.children.forEach(child => {
      paths.push(...getAllDescendantPaths(child));
    });
    return paths;
  };

  const handleParentSelect = (node: CategoryNode, isSelected: boolean) => {
    const descendantPaths = getAllDescendantPaths(node);
    let newSelected = [...selectedCategories];
    
    if (isSelected) {
      // Add all descendants
      descendantPaths.forEach(path => {
        if (!newSelected.includes(path)) {
          newSelected.push(path);
        }
      });
    } else {
      // Remove all descendants
      newSelected = newSelected.filter(path => !descendantPaths.includes(path));
    }
    
    onChange(newSelected);
  };

  const isIndeterminate = (node: CategoryNode): boolean => {
    const descendantPaths = getAllDescendantPaths(node);
    const selectedDescendants = descendantPaths.filter(path => selectedCategories.includes(path));
    return selectedDescendants.length > 0 && selectedDescendants.length < descendantPaths.length;
  };

  const isNodeSelected = (node: CategoryNode): boolean => {
    const descendantPaths = getAllDescendantPaths(node);
    return descendantPaths.every(path => selectedCategories.includes(path));
  };

  const renderNode = (node: CategoryNode): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.fullPath);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedCategories.includes(node.fullPath);
    const nodeIsSelected = isNodeSelected(node);
    const nodeIsIndeterminate = isIndeterminate(node);

    return (
      <div key={node.fullPath} className="select-none">
        <div 
          className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded group"
          style={{ paddingLeft: `${8 + node.level * 24}px` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-4 h-4 p-0 hover:bg-gray-200"
              onClick={() => toggleExpanded(node.fullPath)}
              data-testid={`expand-${node.fullPath}`}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </Button>
          ) : (
            <div className="w-4 h-4" />
          )}
          
          <Checkbox
            checked={hasChildren ? nodeIsSelected : isSelected}
            ref={(el) => {
              if (el && hasChildren && nodeIsIndeterminate) {
                const inputEl = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
                if (inputEl) {
                  inputEl.indeterminate = true;
                }
              }
            }}
            onCheckedChange={(checked) => {
              if (hasChildren) {
                handleParentSelect(node, checked as boolean);
              } else {
                handleCategorySelect(node.fullPath, checked as boolean);
              }
            }}
            className="w-4 h-4"
            data-testid={`checkbox-${node.fullPath}`}
          />
          
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-blue-500" />
              ) : (
                <Folder className="w-4 h-4 text-blue-500" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
            <span 
              className="text-sm text-gray-700 truncate cursor-pointer"
              onClick={() => {
                if (hasChildren) {
                  toggleExpanded(node.fullPath);
                } else {
                  handleCategorySelect(node.fullPath, !isSelected);
                }
              }}
              data-testid={`label-${node.fullPath}`}
            >
              {node.name}
            </span>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-700">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea style={{ height: maxHeight }}>
          <div className="space-y-1">
            {categoryTree.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">
                No categories available
              </div>
            ) : (
              categoryTree.map(node => renderNode(node))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};