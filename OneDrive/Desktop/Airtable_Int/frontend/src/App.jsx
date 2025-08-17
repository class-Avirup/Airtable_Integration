import React from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
import BuilderPage from "./components/BuilderPage";
import ViewerPage from "./components/ViewerPage";
import DashboardPage from "./components/DashboardPage";
import "./App.css";
import Navbar from "./components/Navbar";

function App() {
  return (
    <div className="App">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/form/:userId/:baseId/:tableId" element={<ViewerPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </div>
  );
}

export default App;
