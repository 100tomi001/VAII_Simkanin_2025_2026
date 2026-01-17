import Navbar from "./Navbar";

export default function Layout({ children }) {
  return (
    <div className="app">
      <Navbar />
      <main className="app-main">{children}</main>
    </div>
  );
}
