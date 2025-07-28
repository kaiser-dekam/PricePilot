import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { auth } from "./firebase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      console.log("Got Firebase token, length:", token.length);
      return {
        'Authorization': `Bearer ${token}`,
        'x-user-id': user.uid,
        'x-user-email': user.email || '',
      };
    } catch (error) {
      console.error("Error getting Firebase token:", error);
      return {};
    }
  }
  console.log("No Firebase user for auth headers");
  return {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const authHeaders = await getAuthHeaders();
    const headers = {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
    };

    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error("API request error:", { 
      url, 
      method, 
      error: error.message || error, 
      stack: error.stack 
    });
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const [baseUrl, params] = queryKey;
    let url = baseUrl as string;
    
    // Handle query parameters
    if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += '?' + queryString;
      }
    }

    try {
      const authHeaders = await getAuthHeaders();

      const res = await fetch(url, {
        credentials: "include",
        headers: authHeaders,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error("Query function error:", { 
        url, 
        error: error.message || error, 
        stack: error.stack 
      });
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
