import { DashboardShell } from "@/components/dashboard-shell";import { requireSession } from "@/lib/auth/server";
export default async function PortalLayout({children}:{children:React.ReactNode}){const session=await requireSession();return <DashboardShell session={session}>{children}</DashboardShell>}
