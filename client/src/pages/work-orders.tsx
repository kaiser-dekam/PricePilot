import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Calendar, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { WorkOrder } from "@shared/schema";
import { format } from "date-fns";

export default function WorkOrders() {
  const { toast } = useToast();

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ["/api/work-orders"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/work-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      toast({
        title: "Success",
        description: "Work order deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete work order",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "executing":
        return <Badge className="bg-blue-500">Executing</Badge>;
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this work order?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <>
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Work Orders</h2>
            <p className="text-sm text-gray-500 mt-1">Manage batch product updates and schedules</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !workOrders || (workOrders as any[]).length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No work orders</h3>
              <p className="text-gray-500 mb-4">
                Create your first work order to batch update product prices
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {(workOrders as WorkOrder[]).map((workOrder: WorkOrder) => (
                <Card key={workOrder.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{workOrder.title}</CardTitle>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(workOrder.status || "pending")}
                        {workOrder.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(workOrder.id!)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Products</h4>
                        <p className="text-sm text-gray-600">
                          {workOrder.productUpdates?.length || 0} product(s) with price updates
                        </p>
                        {workOrder.productUpdates && workOrder.productUpdates.length > 0 && (
                          <div className="mt-2 max-h-32 overflow-y-auto">
                            <div className="text-xs text-gray-500 space-y-1">
                              {workOrder.productUpdates.map((update: any, index: number) => (
                                <div key={index} className="bg-gray-50 p-2 rounded text-xs">
                                  <div className="font-medium truncate">{update.productName}</div>
                                  {update.newRegularPrice && (
                                    <div>Regular: ${update.newRegularPrice}</div>
                                  )}
                                  {update.newSalePrice && (
                                    <div>Sale: ${update.newSalePrice}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          {workOrder.productUpdates && (
                            <>
                              <p>
                                Regular Price Updates: {workOrder.productUpdates.filter((u: any) => u.newRegularPrice).length}
                              </p>
                              <p>
                                Sale Price Updates: {workOrder.productUpdates.filter((u: any) => u.newSalePrice).length}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Schedule</h4>
                        <div className="text-sm text-gray-600">
                          {workOrder.executeImmediately ? (
                            <p>Execute immediately</p>
                          ) : workOrder.scheduledAt ? (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {format(new Date(workOrder.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                          ) : (
                            <p>No schedule set</p>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Created</h4>
                        <p className="text-sm text-gray-600">
                          {workOrder.createdAt && format(new Date(workOrder.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                    
                    {workOrder.status === "failed" && workOrder.error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <h4 className="font-medium text-red-800 mb-1">Error</h4>
                        <p className="text-sm text-red-600">{workOrder.error}</p>
                      </div>
                    )}
                    
                    {workOrder.status === "completed" && workOrder.executedAt && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-1">Completed</h4>
                        <p className="text-sm text-green-600">
                          Executed on {format(new Date(workOrder.executedAt), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
