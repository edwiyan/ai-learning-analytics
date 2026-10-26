import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const HOME_BY_ROLE = {
  student: "/student",
  instructor: "/instructor",
  admin: "/admin",
  program_director: "/program-director",
  dean: "/dean",
  vp_academic_affairs: "/vp",
};

export default function Unauthorized() {
  const { user } = useAuth();
  const home = (user && HOME_BY_ROLE[user.role]) || "/";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-5xl font-bold text-gray-800">403</h1>
      <p className="text-gray-500 mt-2 mb-6">
        You don't have permission to view this page.
      </p>
      <Link to={home} className="text-indigo-600 text-sm hover:underline">
        Back to your dashboard
      </Link>
    </div>
  );
}
