import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building2, Users, ArrowRight } from "lucide-react";

const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").max(100, "Company name too long"),
});

type CreateCompanyForm = z.infer<typeof createCompanySchema>;

export default function CompanySetup() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateCompanyForm>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: "",
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: CreateCompanyForm) => {
      return await apiRequest('POST', '/api/company/create', data);
    },
    onSuccess: () => {
      toast({
        title: "Company created",
        description: "Your company has been created successfully.",
      });
      // Invalidate user query to refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/firebase-user'] });
      // Refresh the page to redirect to the main app
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateCompany = async (data: CreateCompanyForm) => {
    setIsLoading(true);
    try {
      await createCompanyMutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Building2 className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to BigCommerce Manager
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            To get started, you'll need to create a company or join an existing one.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Company */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-2">
                <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Create a Company</CardTitle>
              <CardDescription>
                Start fresh with your own company and invite team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateCompany)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your company name" 
                            {...field}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      "Creating..."
                    ) : (
                      <>
                        Create Company
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Join Company */}
          <Card className="border-2 border-green-200 dark:border-green-800">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-2">
                <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Join a Company</CardTitle>
              <CardDescription>
                Have an invitation link? Click below to join an existing company
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  If you received an invitation email, click the link in that email to join the company.
                </p>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200 text-center">
                    💡 Invitation links are sent by company owners or administrators
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          Need help? Contact your system administrator or company owner.
        </div>
      </div>
    </div>
  );
}