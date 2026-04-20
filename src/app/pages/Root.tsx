import { Outlet } from "react-router";

export function Root() {
  return (
    <div className="min-h-screen bg-[#1f2937] text-white">
      <Outlet />
    </div>
  );
}