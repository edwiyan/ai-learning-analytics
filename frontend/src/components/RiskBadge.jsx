const config = {
  "At-Risk":   { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500" },
  "On-Track":  { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500" },
  "Excelling": { bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500" },
};

export default function RiskBadge({ level, size = "md" }) {
  const c = config[level] || config["On-Track"];
  const padding = size === "lg" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${c.bg} ${c.text} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {level}
    </span>
  );
}
