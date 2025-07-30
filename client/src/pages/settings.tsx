import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, TestTube, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { signOutUser } from "@/lib/firebase";

export default function Settings() {
  const [storeHash, setStoreHash] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [showStock, setShowStock] = useState(true);
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

  // Load existing settings
  useEffect(() => {
    if (settings) {
      setStoreHash((settings as any).storeHash || "");
      setAccessToken((settings as any).accessToken || "");
      setClientId((settings as any).clientId || "");
      setShowStock((settings as any).showStock ?? true);
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
      showStock,
    });
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {/* Header Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your BigCommerce API connection</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950 w-full sm:w-auto"
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 max-w-2xl">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">BigCommerce API Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <div>
                  <Label htmlFor="storeHash" className="text-gray-900 dark:text-gray-100">Store Hash *</Label>
                  <Input
                    id="storeHash"
                    type="text"
                    value={storeHash}
                    onChange={(e) => setStoreHash(e.target.value)}
                    placeholder="abc123def"
                    className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Found in your BigCommerce store URL (e.g., store-abc123def.mybigcommerce.com)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="accessToken" className="text-gray-900 dark:text-gray-100">Access Token *</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    API token with products read/write scope
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="clientId" className="text-gray-900 dark:text-gray-100">Client ID *</Label>
                  <Input
                    id="clientId"
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="abcdef123456789"
                    className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your app's client identifier
                  </p>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="showStock" className="text-gray-900 dark:text-gray-100">Show Stock Status</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Display stock quantities on the Products page
                      </p>
                    </div>
                    <Switch
                      id="showStock"
                      checked={showStock}
                      onCheckedChange={setShowStock}
                    />
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    <Save className="w-4 h-4 sm:mr-2" />
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
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {(user as any).email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Authenticated User</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
