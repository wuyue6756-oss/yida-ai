// App 负责装配手机壳、五个核心路由与底部导航。
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { isPublicDemo } from './config'
import PhoneFrame from './components/PhoneFrame'
import TabBar from './components/TabBar'
import Community from './pages/Community'
import Home from './pages/Home'
import Me from './pages/Me'
import Studio from './pages/Studio'
import Wardrobe from './pages/Wardrobe'

function App() {
  const Router = isPublicDemo ? HashRouter : BrowserRouter
  return (
    <Router>
      <PhoneFrame>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wardrobe" element={<Wardrobe />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/community" element={<Community />} />
          <Route path="/me" element={<Me />} />
        </Routes>
        <TabBar />
      </PhoneFrame>
    </Router>
  )
}

export default App
