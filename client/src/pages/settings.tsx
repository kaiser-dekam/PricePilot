import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, TestTube, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const [storeHash, setStoreHash] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [showStockStatus, setShowStockStatus] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "API settings saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const deleteProductsMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/products/all"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: data.message || "All products deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete products",
        variant: "destructive",
      });
    },
  });

  // Load existing settings
  useEffect(() => {
    if (settings) {
      setStoreHash((settings as any).storeHash || "");
      setAccessToken((settings as any).accessToken || "");
      setClientId((settings as any).clientId || "");
      setShowStockStatus((settings as any).showStockStatus || false);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeHash.trim() || !accessToken.trim() || !clientId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      storeHash: storeHash.trim(),
      accessToken: accessToken.trim(),
      clientId: clientId.trim(),
      showStockStatus,
    });
  };

  const handleLogout = async () => {
    try {
      const { signOutUser } = await import("@/lib/firebase");
      await signOutUser();
      toast({
        title: "Success",
        description: "Successfully signed out",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllProducts = () => {
    if (window.confirm("Are you sure you want to delete ALL products? This action cannot be undone.")) {
      deleteProductsMutation.mutate();
    }
  };

  return (
    <>
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-500 mt-1">Configure your BigCommerce API connection and preferences</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>BigCommerce API Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="storeHash">Store Hash *</Label>
                  <Input
                    id="storeHash"
                    type="text"
                    value={storeHash}
                    onChange={(e) => setStoreHash(e.target.value)}
                    placeholder="abc123def"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Found in your BigCommerce store URL (e.g., store-abc123def.mybigcommerce.com)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="accessToken">Access Token *</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    API token with products read/write scope
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="clientId">Client ID *</Label>
                  <Input
                    id="clientId"
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="abcdef123456789"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your app's client identifier
                  </p>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="showStockStatus">Display Stock Status</Label>
                      <p className="text-xs text-gray-500">
                        Show stock levels and inventory status in product listings
                      </p>
                    </div>
                    <Switch
                      id="showStockStatus"
                      checked={showStockStatus}
                      onCheckedChange={setShowStockStatus}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* User Profile */}
          {user && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    {(user as any).profileImageUrl && (
                      <img 
                        src={(user as any).profileImageUrl} 
                        alt="Profile"
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {(user as any).firstName && (user as any).lastName 
                          ? `${(user as any).firstName} ${(user as any).lastName}` 
                          : user.email}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Management */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Danger Zone</h4>
                  <p className="text-sm text-red-700 mb-3">
                    This will permanently delete all products from your local database. This action cannot be undone.
                  </p>
                  <Button
                    onClick={handleDeleteAllProducts}
                    disabled={deleteProductsMutation.isPending}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteProductsMutation.isPending ? "Deleting..." : "Delete All Products"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm">
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>
                  Log into your BigCommerce admin panel
                </li>
                <li>
                  Go to <strong>Settings → API Access</strong>
                </li>
                <li>
                  Click <strong>Create API Account</strong>
                </li>
                <li>
                  Set the following scopes:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Products: <strong>modify</strong></li>
                    <li>Information & Settings: <strong>read-only</strong></li>
                  </ul>
                </li>
                <li>
                  Copy the generated credentials and paste them above
                </li>
                <li>
                  Click "Save Settings" to test the connection
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
