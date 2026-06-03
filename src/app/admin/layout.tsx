import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminGuard from "@/components/admin/AdminGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="flex h-full">
        <AdminSidebar />
        <div className="flex-1 h-full overflow-hidden">{children}</div>
      </div>
    </AdminGuard>
  );
}
