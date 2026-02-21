import { redirect } from "next/navigation";

// Roles are now managed under Users → Permission Roles tab
export default function RolesRedirect() {
  redirect("/settings/users?tab=roles");
}
