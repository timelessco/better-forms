import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClockIcon, MailIcon, PlusIcon, Trash2Icon, XIcon } from "@/components/ui/icons";
import { useId } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { useAppForm } from "@/components/ui/tanstack-form";
import { auth } from "@/lib/auth/auth-client";

export const MembersContent = () => {
  const queryClient = useQueryClient();
  const inviteForm = useAppForm({
    defaultValues: { email: "" },
  });
  const emailInputId = useId();

  const { data, isLoading: isLoadingMembers } = useQuery(
    auth.organization.listMembers.queryOptions(),
  );
  const members = data?.members ?? [];

  const { data: invitationsData } = useQuery(auth.organization.listInvitations.queryOptions());
  const invitations = invitationsData ?? [];

  const inviteMutation = useMutation(
    auth.organization.inviteMember.mutationOptions({
      onSuccess: () => {
        inviteForm.setFieldValue("email", "");
        queryClient.invalidateQueries({
          queryKey: auth.organization.listMembers.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: auth.organization.listInvitations.queryKey(),
        });
        toast.success("Invitation sent successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send invitation");
      },
    }),
  );

  const cancelInvitationMutation = useMutation(
    auth.organization.cancelInvitation.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: auth.organization.listInvitations.queryKey(),
        });
        toast.success("Invitation cancelled");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to cancel invitation");
      },
    }),
  );

  const removeMemberMutation = useMutation(
    auth.organization.removeMember.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: auth.organization.listMembers.queryKey(),
        });
        toast.success("Member removed successfully");
      },
    }),
  );

  return (
    <inviteForm.AppForm>
      <div className="flex flex-col gap-8">
        {/* Invite Section */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm text-[var(--gray-900)]">Invite member</h3>
          <p className="text-[13px] text-[var(--gray-600)]">
            Invite a new member to join your organization.
          </p>
          <inviteForm.AppField name="email">
            {(field) => (
              <InputGroup className="h-[30px]">
                <InputGroupInput
                  id={emailInputId}
                  type="email"
                  placeholder="colleague@example.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-label="Email"
                  variant="secondary"
                  className="h-[30px]"
                />
                <InputGroupButton
                  onClick={() => {
                    if (!field.state.value) return;
                    inviteMutation.mutate({
                      email: field.state.value,
                      role: "member",
                    });
                  }}
                  type="button"
                  disabled={inviteMutation.isPending || !field.state.value}
                  className="mr-1 gap-1.5"
                >
                  <PlusIcon className="size-3.5" />
                  {inviteMutation.isPending ? "Inviting..." : "Invite"}
                </InputGroupButton>
              </InputGroup>
            )}
          </inviteForm.AppField>
        </section>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm text-[var(--gray-900)]">Pending invitations</h3>
            <div className="flex flex-col gap-2">
              {invitations.map(
                (invitation: { id: string; email: string; role: string; status: string }) => (
                  <div
                    key={invitation.id}
                    className="flex items-center gap-3 rounded-xl bg-[var(--gray-100)] py-2 pr-2.5 pl-2"
                  >
                    <div className="flex size-[38px] items-center justify-center rounded-lg bg-background">
                      <MailIcon className="size-[22px] text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{invitation.email}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--gray-600)] capitalize">
                          {invitation.role}
                        </span>
                        <Badge
                          variant={invitation.status === "pending" ? "secondary" : "outline"}
                          className="h-4 px-1.5 py-0 text-[10px] capitalize"
                        >
                          {invitation.status === "pending" && (
                            <ClockIcon className="mr-1 h-2.5 w-2.5" />
                          )}
                          {invitation.status}
                        </Badge>
                      </div>
                    </div>
                    {invitation.status === "pending" && (
                      <button
                        type="button"
                        onClick={() =>
                          cancelInvitationMutation.mutate({
                            invitationId: invitation.id,
                          })
                        }
                        disabled={cancelInvitationMutation.isPending}
                        aria-label="Cancel invitation"
                        className="h-[30px] shrink-0 cursor-pointer rounded-lg bg-white px-3 text-[13px] text-destructive shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] transition-colors hover:bg-gray-50"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {/* Members List */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm text-[var(--gray-900)]">Members</h3>
          <p className="text-[13px] text-[var(--gray-600)]">Manage members of your organization.</p>
          <div className="flex flex-col gap-2">
            {isLoadingMembers ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No members yet</p>
            ) : (
              members.map(
                (member: { id: string; role: string; user: { name?: string; email?: string } }) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl bg-[var(--gray-100)] py-2 pr-2.5 pl-2"
                  >
                    <div className="flex size-[38px] items-center justify-center rounded-lg bg-background text-sm font-bold">
                      {member.user.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{member.user.name}</p>
                      <p className="truncate text-sm text-[var(--gray-600)]">{member.user.email}</p>
                    </div>
                    <Badge
                      variant={member.role === "owner" ? "default" : "outline"}
                      className="h-4 shrink-0 px-1.5 py-0 text-[10px] capitalize"
                    >
                      {member.role}
                    </Badge>
                    {member.role !== "owner" && (
                      <button
                        type="button"
                        onClick={() =>
                          removeMemberMutation.mutate({
                            memberIdOrEmail: member.id,
                          })
                        }
                        disabled={removeMemberMutation.isPending}
                        aria-label="Remove member"
                        className="h-[30px] shrink-0 cursor-pointer rounded-lg bg-white px-3 text-[13px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] transition-colors hover:bg-gray-50"
                      >
                        <Trash2Icon className="size-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                ),
              )
            )}
          </div>
        </section>
      </div>
    </inviteForm.AppForm>
  );
};
