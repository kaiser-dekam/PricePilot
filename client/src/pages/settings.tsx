import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Settings() {
  const [storeHash, setStoreHash] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const { toast } = useToast();

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
    });
  };

  return (
    <>
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-500 mt-1">Configure your BigCommerce API connection</p>
          </div>
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
