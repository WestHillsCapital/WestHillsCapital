import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Calculator from "./pages/Calculator";
import Wrapped from "./pages/Wrapped";

const base = import.meta.env.BASE_URL;

export default function App() {
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/" element={<Calculator />} />
        <Route path="/wrapped" element={<Wrapped />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
