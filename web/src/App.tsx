import { Navigate, Route, Routes } from "react-router-dom";
import TopNav from "./components/TopNav";
import Home from "./pages/Home";
import MyTasks from "./pages/MyTasks";
import Knowledge from "./pages/Knowledge";
import AgentServicePage from "./pages/agents/AgentServicePage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tasks" element={<MyTasks />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/agent/:id" element={<AgentServicePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
