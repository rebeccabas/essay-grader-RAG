import React, { useState, useEffect } from 'react';
import { Pen, Book, User, LogOut, Award } from 'lucide-react';
import { BrowserRouter as Router, Route, Routes, Link, Navigate, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const EssayPrompt = ({ onSubmit }) => {
  const [essay, setEssay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const prompt = "Write about patience. Being patient means that you are understanding and tolerant. A patient person experiences difficulties without complaining. Do only one of the following: write a story about a time when you were patient OR write a story about a time when someone you know was patient OR write a story in your own way about patience.";

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const scoreResponse = await axios.post('http://localhost:8000/score-essay', { essay });
      const feedbackResponse = await axios.post('http://localhost:8000/generate-feedback', { essay });
      onSubmit(prompt, essay, scoreResponse.data, feedbackResponse.data);
    } catch (error) {
      console.error('Error submitting essay:', error);
      alert('An error occurred while processing the essay. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold mb-4">Essay Prompt</h2>
      <p className="mb-4">{prompt}</p>
      <textarea
        className="w-full h-64 p-4 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-gray-500"
        placeholder="Write your essay here..."
        value={essay}
        onChange={(e) => setEssay(e.target.value)}
      />
      <button
        className="mt-4 bg-gray-800 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition duration-300 disabled:opacity-50"
        onClick={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? 'Submitting...' : 'Submit Essay'}
      </button>
    </div>
  );
};

const calculateTotalScore = (score) => {
  return score.domain1_score || 0;
};

const ScoreDisplay = ({ score }) => {
  if (!score) return null;

  const totalScore = score.domain1_score || 0;

  const traitLabels = {
    trait1: "Idea",
    trait2: "Organization",
    trait3: "Style",
    trait4: "Convention"
  };

  const traitData = Object.entries(traitLabels).map(([trait, label]) => ({
    name: label,
    Rater1: score[`rater1_${trait}`],
    Rater2: score[`rater2_${trait}`],
  }));

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">Your Score</h2>
      <div className="text-6xl font-bold text-center text-gray-800">{totalScore.toFixed(1)}</div>
      <p className="text-center text-gray-600 mt-2">out of 24</p>
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Detailed Scores</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-semibold">Rater 1 Total: {score.rater1_domain1.toFixed(1)}</p>
            <p className="font-semibold">Rater 2 Total: {score.rater2_domain1.toFixed(1)}</p>
          </div>
        </div>
        <h4 className="text-lg font-semibold mt-4 mb-2">Trait Scores:</h4>
        {Object.entries(traitLabels).map(([trait, label]) => (
          <div key={trait} className="mb-1 flex justify-between">
            <p>{label}:</p>
            <p>R1: {score[`rater1_${trait}`].toFixed(1)} | R2: {score[`rater2_${trait}`].toFixed(1)}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Trait Score Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={traitData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 3]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Rater1" fill="#8884d8" name="Rater 1" />
            <Bar dataKey="Rater2" fill="#82ca9d" name="Rater 2" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const FeedbackDisplay = ({ feedback }) => {
  if (!feedback) return null;

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">Essay Feedback</h2>
      {Object.entries(feedback).map(([trait, content]) => (
        <div key={trait} className="mb-4">
          <h3 className="text-xl font-semibold mb-2">{trait}</h3>
          <p className="text-gray-700">{content}</p>
        </div>
      ))}
    </div>
  );
};


const PastEssays = ({ essays }) => {
  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Past Essays</h2>
      {essays.map((essay, index) => (
        <div key={index} className="mb-4 p-4 border rounded-md">
          <h3 className="font-bold">{essay.prompt}</h3>
          <p className="text-gray-600">{essay.content.substring(0, 100)}...</p>
          <p className="text-gray-800 font-bold mt-2">Score: {essay.score.domain1_score.toFixed(1)}</p>
        </div>
      ))}
    </div>
  );
};

const Profile = ({ user, essays }) => {
  const averageScore = essays.length > 0
    ? essays.reduce((sum, essay) => sum + essay.score.domain1_score, 0) / essays.length
    : 0;
  const scoreData = essays.map((essay, index) => ({ name: `Essay ${index + 1}`, score: essay.score.domain1_score }));

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Profile</h2>
      <p className="mb-2"><strong>Email:</strong> {user}</p>
      <p className="mb-4"><strong>Average Score:</strong> {averageScore.toFixed(2)}</p>
      <h3 className="text-xl font-bold mb-2">Progress Graph</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={scoreData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[0, 18]} />
          <Tooltip />
          <Legend />
          <Bar dataKey="score" fill="#4B5563" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const AuthPage = ({ onLogin, onSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isLogin && password !== confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    isLogin ? onLogin(email) : onSignup(email);
  };

  return (
    <div className="min-h-screen w-full flex bg-gray-100">
      <div className="w-full max-w-full mx-auto flex shadow-lg overflow-hidden">
        <div className="w-full bg-gray-800 text-white p-8 flex flex-col justify-center relative">
          <div className="absolute inset-0 bg-blue-500 opacity-20"></div>
          <div className="z-10">
            <h2 className="text-4xl font-bold mb-4">TOEFL/IELTS Essay Scorer</h2>
            <p className="text-lg mb-4">
              Our advanced AI algorithm analyzes your essays based on four key criteria:
            </p>
            <ul className="list-disc list-inside mb-4">
              <li>Task Response</li>
              <li>Coherence and Cohesion</li>
              <li>Lexical Resource</li>
              <li>Grammatical Range and Accuracy</li>
            </ul>
            <p>
              Get instant feedback and improve your writing skills for TOEFL and IELTS exams!
            </p>
          </div>
        </div>
        <div className="w-full bg-white p-8 flex flex-col justify-center">
          <h2 className="text-2xl font-bold mb-6 text-center">
            {isLogin ? "Login" : "Sign Up"}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <input
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                id="password"
                type="password"
                placeholder="******************"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {!isLogin && (
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                  id="confirm-password"
                  type="password"
                  placeholder="******************"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                type="submit"
              >
                {isLogin ? "Sign In" : "Sign Up"}
              </button>
              <button
                className="inline-block align-baseline font-bold text-sm text-gray-600 hover:text-gray-800"
                type="button"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Create an account" : "Already have an account?"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const Navbar = ({ user, onLogout }) => {
  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold">TOEFL/IELTS Essay Scorer</Link>
        {user && (
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center hover:text-gray-300">
              <Pen className="mr-1" size={18} />
              Write
            </Link>
            <Link to="/past-essays" className="flex items-center hover:text-gray-300">
              <Book className="mr-1" size={18} />
              Past Essays
            </Link>
            <Link to="/profile" className="flex items-center hover:text-gray-300">
              <User className="mr-1" size={18} />
              Profile
            </Link>
            <button onClick={onLogout} className="flex items-center hover:text-gray-300">
              <LogOut className="mr-1" size={18} />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

const App = () => {
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [user, setUser] = useState(null);
  const [essays, setEssays] = useState([]);

  const handleSubmit = (prompt, essay, newScore, newFeedback) => {
    setScore(newScore);
    setFeedback(newFeedback);
    setEssays([...essays, { prompt, content: essay, score: newScore, feedback: newFeedback }]);
  };

  useEffect(() => {
    if (user) {
      setEssays([
        { prompt: "Sample prompt 1", content: "Lorem ipsum...", score: { domain1_score: 15 } },
        { prompt: "Sample prompt 2", content: "Dolor sit amet...", score: { domain1_score: 16 } },
        { prompt: "Sample prompt 3", content: "Consectetur adipiscing...", score: { domain1_score: 14 } },
      ]);
    }
  }, [user]);

  const handleLogin = (email) => {
    setUser(email);
    navigate('/');
  };

  const handleSignup = (email) => {
    setUser(email);
    navigate('/');
  };

  const handleLogout = () => {
    setUser(null);
    setEssays([]);
    setScore(null);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="container mx-auto py-8">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <AuthPage onLogin={handleLogin} onSignup={handleSignup} />} />
          <Route
            path="/"
            element={
              user ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center">
                      <Pen className="text-gray-800 w-12 h-12 mb-4" />
                      <h2 className="text-xl font-semibold">Write</h2>
                      <p className="text-center text-gray-600">Compose your essay based on the given prompt.</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center">
                      <Book className="text-gray-800 w-12 h-12 mb-4" />
                      <h2 className="text-xl font-semibold">Submit</h2>
                      <p className="text-center text-gray-600">Submit your essay for instant scoring.</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center">
                      <Award className="text-gray-800 w-12 h-12 mb-4" />
                      <h2 className="text-xl font-semibold">Score</h2>
                      <p className="text-center text-gray-600">Receive your score and feedback.</p>
                    </div>
                  </div>
                  <EssayPrompt onSubmit={handleSubmit} />
                  {score && <ScoreDisplay score={score} />}
                  {feedback && <FeedbackDisplay feedback={feedback} />}
                </>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/past-essays"
            element={user ? <PastEssays essays={essays} /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile"
            element={user ? <Profile user={user} essays={essays} /> : <Navigate to="/login" />}
          />
        </Routes>
      </main>
      <footer className="bg-gray-800 text-white py-4">
        <div className="container mx-auto text-center">
          <p>&copy; 2024 TOEFL/IELTS Essay Scorer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const AppWrapper = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;