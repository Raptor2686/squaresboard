import { BrowserRouter, Routes, Route } from "react-router-dom";
import Marketplace from "./pages/Marketplace";
import BoardDetail from "./pages/BoardDetail";
import Auth from "./pages/Auth";
import MySquares from "./pages/MySquares";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-900 text-white">
        <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-blue-400">SquaresBoard</a>
          <div className="flex gap-6 text-sm">
            <a href="/" className="hover:text-blue-400">Marketplace</a>
            <a href="/my-squares" className="hover:text-blue-400">My Squares</a>
            <a href="/auth" className="hover:text-blue-400">Account</a>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<Marketplace />} />
          <Route path="/board/:boardId" element={<BoardDetail />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/my-squares" element={<MySquares />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
