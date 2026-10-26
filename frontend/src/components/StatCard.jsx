export default function StatCard({ label, value, sub, color = "indigo" }) {
  const colors = {
    indigo: "text-indigo-600",
    red: "text-red-500",
    green: "text-green-600",
    blue: "text-blue-600",
    amber: "text-amber-500",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color] || colors.indigo}`}>{value ?? "—"}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
