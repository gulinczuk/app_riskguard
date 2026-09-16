import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './pages/Layout'
import Login from './pages/Login'
import MapView from './pages/MapView'
import Farms from './pages/Farms'
import Devices from './pages/Devices'
import DeviceDetail from './pages/DeviceDetail'
import Geofences from './pages/Geofences'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<MapView />} />
            <Route path="/fazendas" element={<Farms />} />
            <Route path="/equipamentos" element={<Devices />} />
            <Route path="/equipamentos/:id" element={<DeviceDetail />} />
            <Route path="/geofences" element={<Geofences />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
