export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
            <span className="text-3xl">🎹</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">피아노 학원 관리</h1>
          <p className="text-sm text-gray-500 mt-1">학원 운영의 모든 것을 한 곳에서</p>
        </div>
        {children}
      </div>
    </div>
  );
}
