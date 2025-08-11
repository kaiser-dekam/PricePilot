import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Mail, Crown, User, Building2, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertCompanyInvitationSchema } from '@shared/schema';

type ExtendedInvitationSchema = z.infer<typeof insertCompanyInvitationSchema> & {
  email: string;
  role: 'admin' | 'member';
};

export default function Team() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isEditingCompanyName, setIsEditingCompanyName] = useState(false);
  const [companyName, setCompanyName] = useState('');

  const form = useForm<ExtendedInvitationSchema>({
    resolver: zodResolver(insertCompanyInvitationSchema.extend({
      email: z.string().email('Please enter a valid email address'),
      role: z.enum(['admin', 'member'], { required_error: 'Please select a role' })
    })),
    defaultValues: {
      email: '',
      role: 'member'
    }
  });

  // Fetch company users
  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ['/api/company/users'],
  });

  // Fetch pending invitations (for admin/owner view)
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<any[]>({
    queryKey: ['/api/invitations'],
  });

  // Fetch user's own pending invitations
  const { data: myInvitations = [], isLoading: myInvitationsLoading } = useQuery<any[]>({
    queryKey: ['/api/my-invitations'],
  });

  // Fetch current user info
  const { data: currentUser } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: async (data: ExtendedInvitationSchema) => {
      return await apiRequest('POST', '/api/invitations', data);
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: "Team member invitation has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      setIsInviteDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return await apiRequest('DELETE', `/api/invitations/${invitationId}`);
    },
    onSuccess: () => {
      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel invitation",
        variant: "destructive",
      });
    },
  });

  // Accept invitation mutation  
  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return await apiRequest('POST', `/api/invitations/${invitationId}/accept`);
    },
    onSuccess: () => {
      toast({
        title: "Invitation Accepted",
        description: "You've successfully joined the company!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/my-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }); // Refresh user data
      // Refresh the page to show new company data
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    },
  });

  // Update company name mutation
  const updateCompanyNameMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('PUT', '/api/company/name', { name });
    },
    onSuccess: () => {
      toast({
        title: "Company Name Updated",
        description: "Company name has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setIsEditingCompanyName(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company name",
        variant: "destructive",
      });
    },
  });

  // Remove team member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest('DELETE', `/api/company/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Member Removed",
        description: "Team member has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/company/users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExtendedInvitationSchema) => {
    sendInvitationMutation.mutate(data);
  };

  const handleCancelInvitation = (invitationId: string) => {
    if (confirm('Are you sure you want to cancel this invitation?')) {
      cancelInvitationMutation.mutate(invitationId);
    }
  };

  const handleRemoveMember = (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to remove ${userName} from the team? They will be moved to their own company.`)) {
      removeMemberMutation.mutate(userId);
    }
  };

  const handleUpdateCompanyName = () => {
    if (companyName.trim().length === 0) {
      toast({
        title: "Error",
        description: "Company name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    updateCompanyNameMutation.mutate(companyName.trim());
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pending</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="text-green-600 border-green-300">Accepted</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-red-600 border-red-300">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleIcon = (role: string) => {
    return role === 'admin' ? <Crown className="h-4 w-4" /> : <User className="h-4 w-4" />;
  };

  if (usersLoading || invitationsLoading || myInvitationsLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Management</h1>
            {currentUser?.role === 'owner' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCompanyName(currentUser?.company?.name || '');
                  setIsEditingCompanyName(true);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">
              {currentUser?.company?.name || 'My Company'}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your team members and send invitations
          </p>
        </div>
        
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <UserPlus className="h-4 w-4" />
              <span>Invite Member</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to a new team member. They'll receive an email to join your company.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="team.member@example.com"
                          type="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInviteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sendInvitationMutation.isPending}>
                    {sendInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Company Name Edit Dialog */}
      <Dialog open={isEditingCompanyName} onOpenChange={setIsEditingCompanyName}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Company Name</DialogTitle>
            <DialogDescription>
              Change your company name. This will be visible to all team members.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company name"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingCompanyName(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateCompanyName}
                disabled={updateCompanyNameMutation.isPending}
              >
                {updateCompanyNameMutation.isPending ? "Updating..." : "Update Name"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Invitations for Current User */}
      {myInvitations.length > 0 && (
        <Card className="mb-8 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-blue-800">
              <Mail className="h-5 w-5" />
              <span>Pending Invitations ({myInvitations.length})</span>
            </CardTitle>
            <CardDescription className="text-blue-700">
              You have pending invitations to join companies. Accept them to access shared resources.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {myInvitations.map((invitation: any) => (
                <div key={invitation.id} className="flex items-center justify-between p-4 bg-white border border-blue-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {invitation.companyName}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                      <span>Role: {invitation.role}</span>
                      <span>•</span>
                      <span>Expires: {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => acceptInvitationMutation.mutate(invitation.id)}
                    disabled={acceptInvitationMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {acceptInvitationMutation.isPending ? "Accepting..." : "Accept Invitation"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Current Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Team Members ({users.length})</span>
            </CardTitle>
            <CardDescription>
              Current members of your company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No team members found
                </p>
              ) : (
                users.map((user: any) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {user.profileImageUrl ? (
                        <img
                          src={user.profileImageUrl}
                          alt={user.firstName || user.email}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.email}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(user.role)}
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                      {(currentUser?.role === 'admin' || currentUser?.role === 'owner') && 
                       user.role !== 'owner' && 
                       user.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(user.id, user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email)}
                          disabled={removeMemberMutation.isPending}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Pending Invitations ({invitations.length})</span>
            </CardTitle>
            <CardDescription>
              Invitations waiting for acceptance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invitations.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No pending invitations
                </p>
              ) : (
                invitations.map((invitation: any) => (
                  <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {invitation.email}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        {getRoleIcon(invitation.role)}
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {invitation.role}
                        </span>
                        <span className="text-gray-400">•</span>
                        {getStatusBadge(invitation.status)}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Sent {new Date(invitation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      disabled={cancelInvitationMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}