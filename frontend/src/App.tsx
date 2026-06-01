import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';

function App() {
  return (
    <Router>
      <div className="bg-background min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<div>Login Page (Coming Soon)</div>} />
          <Route path="/register" element={<div>Register Page (Coming Soon)</div>} />
          <Route path="/search" element={<div>Search Results (Coming Soon)</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
