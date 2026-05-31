export default function SandboxPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-800">项目沙盒</h1>
        <button
          disabled
          className="px-4 py-1.5 text-sm text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
        >
          + 创建沙盒
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="text-2xl font-medium text-gray-400 mb-2">敬请期待</h2>
          <p className="text-sm text-gray-300">项目沙盒功能正在开发中</p>
        </div>
      </div>
    </div>
  );
}
