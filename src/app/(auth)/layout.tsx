import { Sprout } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 to-green-800 items-center justify-center p-12">
        <div className="text-center text-white">
          <Sprout className="h-16 w-16 mx-auto mb-6" />
          <h1 className="text-4xl font-bold mb-4">FarmOps</h1>
          <p className="text-xl text-green-100 mb-2">
            Field operations & input stock control
          </p>
          <p className="text-green-200 max-w-md">
            Know exactly what you have, where it is, and what you need.
            Intelligent inventory management for modern agriculture.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Sprout className="h-8 w-8 text-green-600" />
            <span className="text-2xl font-bold">FarmOps</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
