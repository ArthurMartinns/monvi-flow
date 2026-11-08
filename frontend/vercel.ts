const backendUrl = process.env.MONVIFLOW_BACKEND_URL?.trim();

if (!backendUrl) {
  throw new Error("Defina MONVIFLOW_BACKEND_URL na Vercel com a URL HTTPS do backend no Render.");
}

const backend = new URL(backendUrl);
if (
  backend.protocol !== "https:" || backend.username || backend.password ||
  backend.pathname !== "/" || backend.search || backend.hash
) {
  throw new Error("MONVIFLOW_BACKEND_URL deve ser uma origem HTTPS, sem caminho ou credenciais.");
}

export const config = {
  rewrites: [{ source: "/api/:path*", destination: `${backend.origin}/api/:path*` }],
};
