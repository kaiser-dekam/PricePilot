import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestSimple() {
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const testApiCall = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/test');
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testHealthCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>API Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button onClick={testApiCall} disabled={loading} className="w-full">
              {loading ? "Loading..." : "Test API"}
            </Button>
            <Button onClick={testHealthCheck} disabled={loading} className="w-full">
              {loading ? "Loading..." : "Test Health"}
            </Button>
          </div>
          {response && (
            <div className="bg-gray-100 p-4 rounded text-sm font-mono">
              <pre>{response}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}