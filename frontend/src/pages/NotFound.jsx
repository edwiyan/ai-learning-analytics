import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center">
      <h1 className="text-5xl font-bold text-gray-800">404</h1>
      <p className="text-gray-500 mt-2 mb-6">Page not found.</p>
      <Link to="/" className="text-indigo-600 text-sm hover:underline">Go home</Link>
    </div>
  );
}
