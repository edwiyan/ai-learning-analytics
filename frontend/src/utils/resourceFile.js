import api from "../services/api";

// Uploaded course files are served behind auth, so fetch them with the token
// and hand the browser a blob to save.
export async function openResourceFile(resource) {
  const res = await api.get(resource.url, { responseType: "blob" });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = resource.file_name || "resource";
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}
